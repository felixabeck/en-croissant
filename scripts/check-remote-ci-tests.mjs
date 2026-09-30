import assert from "node:assert/strict";
import test from "node:test";
import { checkRemoteCi, REMOTE_RUN_LIMIT } from "./check-remote-ci.mjs";

function run(databaseId, createdAt, { status = "completed", conclusion = "success" } = {}) {
  return {
    databaseId,
    headSha: `sha-${databaseId}`,
    status,
    conclusion,
    createdAt,
  };
}

function job(name, { status = "completed", conclusion = "success" } = {}) {
  return {
    name,
    status,
    conclusion,
    url: `https://github.com/felixabeck/en-croissant/actions/runs/1/jobs/${encodeURIComponent(name)}`,
  };
}

function cannedRunner({ upstream = "origin/master", runs, jobsByRun, overrides = {} }) {
  const calls = [];
  const runner = (command, args, options) => {
    calls.push({ command, args, options });
    const key = `${command} ${args.join(" ")}`;
    if (key in overrides) return overrides[key];
    if (command === "git") return { status: 0, stdout: `${upstream}\n`, stderr: "" };
    if (command === "gh" && args[0] === "run" && args[1] === "list") {
      return { status: 0, stdout: JSON.stringify(runs), stderr: "" };
    }
    if (command === "gh" && args[0] === "run" && args[1] === "view") {
      return {
        status: 0,
        stdout: JSON.stringify({ jobs: jobsByRun[args[2]] }),
        stderr: "",
      };
    }
    return { status: 1, stdout: "", stderr: `unexpected call: ${key}` };
  };
  return { runner, calls };
}

const recent = "2026-10-01T12:00:00Z";
const older = "2026-10-01T11:00:00Z";

test("passes when every newest completed job result succeeds", () => {
  const { runner } = cannedRunner({
    runs: [run(101, recent)],
    jobsByRun: {
      101: [job("test"), job("rust-windows-test"), job("rust-platform (MSVC)")],
    },
  });

  assert.deepEqual(checkRemoteCi({ runner }), {
    exitCode: 0,
    branch: "master",
    redJobs: [],
  });
});

test("uses an older completed result when the newer run is still in progress", () => {
  const { runner } = cannedRunner({
    runs: [
      run(102, recent, { status: "in_progress", conclusion: "" }),
      run(101, older, { conclusion: "failure" }),
    ],
    jobsByRun: {
      102: [job("test", { status: "in_progress", conclusion: "" })],
      101: [job("test", { conclusion: "failure" })],
    },
  });

  const result = checkRemoteCi({ runner });
  assert.equal(result.exitCode, 1);
  assert.deepEqual(
    result.redJobs.map(({ name, conclusion, runId, headSha }) => ({
      name,
      conclusion,
      runId,
      headSha,
    })),
    [{ name: "test", conclusion: "failure", runId: 101, headSha: "sha-101" }],
  );
});

test("refuses on a red job outside the named platform jobs", () => {
  const { runner } = cannedRunner({
    runs: [run(103, recent)],
    jobsByRun: {
      103: [job("rust-windows-test"), job("test", { conclusion: "failure" })],
    },
  });

  const result = checkRemoteCi({ runner });
  assert.equal(result.exitCode, 1);
  assert.deepEqual(
    result.redJobs.map(({ name }) => name),
    ["test"],
  );
  assert.match(result.redJobs[0].url, /actions\/runs\/1\/jobs/u);
});

test("a newer green result supersedes an older red result for the same job", () => {
  const { runner } = cannedRunner({
    runs: [run(104, older), run(105, recent)],
    jobsByRun: {
      104: [job("test", { conclusion: "failure" })],
      105: [job("test")],
    },
  });

  assert.equal(checkRemoteCi({ runner }).exitCode, 0);
});

test("treats skipped and neutral conclusions as red because Test has no designed job skips", () => {
  const { runner } = cannedRunner({
    runs: [run(106, recent)],
    jobsByRun: {
      106: [
        job("skipped-job", { conclusion: "skipped" }),
        job("neutral-job", { conclusion: "neutral" }),
      ],
    },
  });

  const result = checkRemoteCi({ runner });
  assert.equal(result.exitCode, 1);
  assert.deepEqual(
    result.redJobs.map(({ name, conclusion }) => [name, conclusion]),
    [
      ["skipped-job", "skipped"],
      ["neutral-job", "neutral"],
    ],
  );
});

test("filters the gh query to the upstream branch and Test workflow", () => {
  const { runner, calls } = cannedRunner({
    upstream: "origin/release/ci-remote",
    runs: [run(107, recent)],
    jobsByRun: { 107: [job("test")] },
  });

  assert.equal(checkRemoteCi({ runner }).exitCode, 0);
  const listCall = calls.find(
    ({ command, args }) => command === "gh" && args[0] === "run" && args[1] === "list",
  );
  assert.deepEqual(listCall.args, [
    "run",
    "list",
    "--workflow",
    "Test",
    "--branch",
    "release/ci-remote",
    "--limit",
    String(REMOTE_RUN_LIMIT),
    "--json",
    "databaseId,headSha,status,conclusion,createdAt",
  ]);
});

test("refuses with the gh failure cause", () => {
  const { runner } = cannedRunner({
    runs: [],
    jobsByRun: {},
    overrides: {
      "gh run list --workflow Test --branch master --limit 5 --json databaseId,headSha,status,conclusion,createdAt":
        {
          status: 1,
          stdout: "",
          stderr: "API rate limit exceeded",
        },
    },
  });

  const result = checkRemoteCi({ runner });
  assert.equal(result.exitCode, 2);
  assert.match(result.error, /API rate limit exceeded/u);
});

test("refuses with the git failure cause", () => {
  const { runner } = cannedRunner({
    runs: [],
    jobsByRun: {},
    overrides: {
      "git rev-parse --abbrev-ref --symbolic-full-name @{u}": {
        status: 128,
        stdout: "",
        stderr: "no upstream configured",
      },
    },
  });

  const result = checkRemoteCi({ runner });
  assert.equal(result.exitCode, 2);
  assert.match(result.error, /no upstream configured/u);
});

test("refuses an unparsable upstream result", () => {
  const { runner } = cannedRunner({ upstream: "not-an-upstream" });
  const result = checkRemoteCi({ runner });
  assert.equal(result.exitCode, 2);
  assert.match(result.error, /invalid upstream ref/u);
});

test("refuses a malformed gh payload with its cause", () => {
  const { runner } = cannedRunner({
    runs: [],
    jobsByRun: {},
    overrides: {
      "gh run list --workflow Test --branch master --limit 5 --json databaseId,headSha,status,conclusion,createdAt":
        {
          status: 0,
          stdout: "{ malformed",
          stderr: "",
        },
    },
  });

  const result = checkRemoteCi({ runner });
  assert.equal(result.exitCode, 2);
  assert.match(result.error, /invalid JSON/u);
});

test("refuses an empty run list", () => {
  const { runner } = cannedRunner({ runs: [], jobsByRun: {} });
  const result = checkRemoteCi({ runner });
  assert.equal(result.exitCode, 2);
  assert.match(result.error, /no Test runs/u);
});

test("refuses an empty jobs list", () => {
  const { runner } = cannedRunner({
    runs: [run(108, recent)],
    jobsByRun: { 108: [] },
  });
  const result = checkRemoteCi({ runner });
  assert.equal(result.exitCode, 2);
  assert.match(result.error, /empty jobs list/u);
});

test("refuses when a seen job has no completed result in the window", () => {
  const { runner } = cannedRunner({
    runs: [run(109, recent)],
    jobsByRun: {
      109: [job("test"), job("rust-platform", { status: "in_progress", conclusion: "" })],
    },
  });
  const result = checkRemoteCi({ runner });
  assert.equal(result.exitCode, 2);
  assert.match(result.error, /no completed result.*rust-platform/u);
});

test("refuses when no job in the window has a completed result", () => {
  const { runner } = cannedRunner({
    runs: [run(110, recent, { status: "in_progress", conclusion: "" })],
    jobsByRun: {
      110: [job("test", { status: "in_progress", conclusion: "" })],
    },
  });
  const result = checkRemoteCi({ runner });
  assert.equal(result.exitCode, 2);
  assert.match(result.error, /No completed Test workflow jobs/u);
});
