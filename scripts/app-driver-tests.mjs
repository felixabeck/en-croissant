import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import { createServer } from "node:http";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { syncBuiltinESMExports } from "node:module";
import { PassThrough } from "node:stream";
import test from "node:test";
import { verifyConversionCancellationContract } from "./verify-app.mjs";
import {
  Session,
  APP_BINARY,
  appProcesses,
  cleanUpResources,
  cleanUpWithProfiles,
  createSharedShutdown,
  requirePrerequisites,
} from "./app-driver.mjs";

async function conversionContractCase(breakAssertion) {
  const reports = [];
  const retired = new Set();
  const cancelled = new Set();
  let nextTicket = 0;
  let count = 0;
  let revision = 0;
  let paired = false;
  const invoke = async (command, args) => {
    if (command === "prepare_conversion") return `ticket:${++nextTicket}`;
    if (command === "cancel_conversion") {
      if (retired.has(args.ticket)) return breakAssertion === "CC5";
      cancelled.add(args.ticket);
      return true;
    }
    if (command === "release_conversion") {
      retired.add(args.ticket);
      return null;
    }
    if (command === "convert_pgn") {
      if (cancelled.has(args.ticket) && breakAssertion !== "CC1")
        throw { category: "cancellation" };
      if (paired && breakAssertion === "CC4") throw new Error("retry refused");
      count += breakAssertion === "CC0" && count === 0 ? 2 : 1;
      revision++;
      return null;
    }
    throw new Error(`unexpected command ${command}`);
  };
  await verifyConversionCancellationContract({
    invoke,
    seed: { id: "seed" },
    source: { id: "large" },
    database: { id: "database" },
    snapshot: async () => ({
      count,
      revision,
      games: paired && breakAssertion === "CC3" ? "changed content" : "seed content",
    }),
    cancelledPair: async () => {
      paired = true;
      retired.add("running");
      retired.add("queued");
      return {
        started: true,
        tickets: ["running", "queued"],
        acknowledged: [true, true],
        running: { category: breakAssertion === "CC2" ? "success" : "cancellation" },
        queued: { category: "cancellation" },
      };
    },
    report: (condition, label, detail) => reports.push({ condition, label, detail }),
  });
  return reports;
}

test("conversion harness runs its six native-outcome assertions without starting an application on import", async () => {
  const reports = await conversionContractCase();
  assert.equal(reports.length, 6);
  assert.ok(
    reports.every(({ condition }) => condition),
    JSON.stringify(reports),
  );
});

for (const assertion of ["CC0", "CC1", "CC2", "CC3", "CC4", "CC5"]) {
  test(`conversion harness distinguishes ${assertion} failure from its successful assertions`, async () => {
    const reports = await conversionContractCase(assertion);
    const report = reports.find(({ label }) => label.startsWith(`${assertion} `));
    assert.equal(report.condition, false);
    assert.equal(typeof report.detail, "string");
    assert.ok(report.detail.length > 0);
  });
}

test("prerequisites check the selected application even when the default binary is absent", (t) => {
  const application = join(tmpdir(), "app-driver-selected-application");
  const missingApplication = join(tmpdir(), "app-driver-missing-application");
  const exists = t.mock.method(
    fs,
    "existsSync",
    (path) => path === "/usr/bin/WebKitWebDriver" || path === application,
  );
  const execute = t.mock.method(childProcess, "execFileSync", () => Buffer.alloc(0));
  syncBuiltinESMExports();
  t.after(() => {
    t.mock.restoreAll();
    syncBuiltinESMExports();
  });

  assert.equal(fs.existsSync(APP_BINARY), false);
  assert.doesNotThrow(() => requirePrerequisites(application));
  assert.deepEqual(
    execute.mock.calls.map(({ arguments: [command, args] }) => [command, args]),
    [
      ["sh", ["-c", "command -v tauri-driver"]],
      ["sh", ["-c", "command -v kwin_wayland"]],
      ["gst-inspect-1.0", ["--exists", "fakeaudiosink"]],
    ],
  );
  assert.ok(exists.mock.calls.some(({ arguments: [path] }) => path === application));
  assert.throws(
    () => requirePrerequisites(missingApplication),
    (error) => error.message.includes(`${missingApplication} — build it with: pnpm build`),
  );
  assert.throws(
    () => requirePrerequisites(),
    (error) => error.message.includes(`${APP_BINARY} — build it with: pnpm build`),
  );
});

for (const cpuRendering of [undefined, "0"]) {
  test(`startDriver spawns with CPU rendering ${cpuRendering === undefined ? "enabled by default" : "explicitly disabled"}`, async (t) => {
    const variable = "WEBKIT_SKIA_ENABLE_CPU_RENDERING";
    const hadVariable = Object.hasOwn(process.env, variable);
    const originalValue = process.env[variable];
    const child = {
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      exitCode: null,
      signalCode: null,
    };
    let driver;
    let profile;
    t.after(async () => {
      try {
        await driver?.shutdown();
        assert.equal(child.stdout.destroyed, true);
        assert.equal(child.stderr.destroyed, true);
        if (profile) assert.equal(fs.existsSync(profile), false);
      } finally {
        t.mock.restoreAll();
        syncBuiltinESMExports();
        if (hadVariable) process.env[variable] = originalValue;
        else delete process.env[variable];
      }
    });

    if (cpuRendering === undefined) delete process.env[variable];
    else process.env[variable] = cpuRendering;
    const spawn = t.mock.method(childProcess, "spawn", () => child);
    let statusRequests = 0;
    const fetch = t.mock.method(globalThis, "fetch", async () => {
      if (++statusRequests === 1) {
        throw new Error("connect ECONNREFUSED 127.0.0.1:4444");
      }
      return { ok: true, body: null };
    });
    syncBuiltinESMExports();
    driver = await import(`./app-driver.mjs?cpu-rendering=${cpuRendering ?? "default"}`);
    await driver.startDriver({ waylandDisplay: "offscreen-test-display" });

    assert.equal(spawn.mock.calls.length, 1);
    const [command, args, options] = spawn.mock.calls[0].arguments;
    profile = options.env.HOME;
    assert.equal(command, "tauri-driver");
    assert.deepEqual(args, ["--port", "4444", "--native-port", "4445"]);
    assert.equal(options.env[variable], cpuRendering ?? "1");
    assert.equal(options.env.WAYLAND_DISPLAY, "offscreen-test-display");
    assert.equal(options.env.GST_PLUGIN_FEATURE_RANK, "fakeaudiosink:MAX");
    assert.equal(options.env.LANG, "en_US.UTF-8");
    assert.equal(options.env.LC_ALL, "en_US.UTF-8");
    assert.notEqual(profile, process.env.HOME);
    assert.ok(profile.startsWith(join(tmpdir(), "chessfable-verify-")));
    assert.equal(fs.existsSync(profile), true);
    for (const name of ["XDG_DATA_HOME", "XDG_CONFIG_HOME", "XDG_CACHE_HOME", "XDG_STATE_HOME"]) {
      assert.equal(Object.hasOwn(options.env, name), false);
    }
    assert.deepEqual(
      fetch.mock.calls.map(({ arguments: [url] }) => url),
      ["http://127.0.0.1:4444/status", "http://127.0.0.1:4444/status"],
    );
  });
}

async function webdriverServer() {
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const requestBody = chunks.length > 0 ? JSON.parse(Buffer.concat(chunks).toString()) : null;
    const application = requestBody?.capabilities?.alwaysMatch?.["tauri:options"]?.application;
    const send = (status, body, contentType = "application/json") => {
      response.writeHead(status, { "content-type": contentType });
      response.end(body);
    };

    if (request.url === "/session") {
      if (application === "malformed") return send(200, "not json", "text/plain");
      if (application === "missing-envelope") return send(200, JSON.stringify({}));
      if (application === "missing-session-id") {
        return send(200, JSON.stringify({ value: { capabilities: {} } }));
      }
      if (application === "http-failure") {
        return send(500, JSON.stringify({ value: { error: "session not created" } }));
      }
      return send(200, JSON.stringify({ value: { sessionId: "fixture-session" } }));
    }

    if (request.url?.endsWith("/null")) return send(200, JSON.stringify({ value: null }));
    if (request.url?.endsWith("/screenshot")) {
      return send(200, JSON.stringify({ value: "x".repeat(128 * 1024) }));
    }
    if (request.url?.endsWith("/malformed")) return send(200, "{", "text/plain");
    if (request.url?.endsWith("/missing")) return send(200, JSON.stringify({ result: null }));
    if (request.url?.endsWith("/failure")) {
      return send(404, JSON.stringify({ value: { error: "unknown command" } }));
    }
    return send(404, JSON.stringify({ value: { error: "unknown route" } }));
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return { server, port: server.address().port };
}

test("Session rejects malformed protocol results and accepts an explicit null value", async (t) => {
  const { server, port } = await webdriverServer();
  const realFetch = globalThis.fetch;
  globalThis.fetch = (input, options) => {
    const url = new URL(input);
    if (url.hostname === "127.0.0.1" && url.port === "4444") url.port = String(port);
    return realFetch(url, options);
  };
  t.after(async () => {
    globalThis.fetch = realFetch;
    await new Promise((resolve) => server.close(resolve));
  });

  await assert.rejects(
    Session.open("malformed"),
    /POST \/session -> HTTP 200: malformed JSON response/u,
  );
  await assert.rejects(
    Session.open("missing-envelope"),
    /POST \/session -> HTTP 200: response is missing the value envelope/u,
  );
  await assert.rejects(
    Session.open("missing-session-id"),
    /POST \/session -> HTTP 200: response is missing a valid session id/u,
  );
  await assert.rejects(
    Session.open("http-failure"),
    /POST \/session -> HTTP 500: WebDriver request failed/u,
  );

  const session = await Session.open("valid");
  assert.equal(await session.call("GET", "/null"), null);
  assert.equal((await session.screenshot()).length, 128 * 1024);
  await assert.rejects(
    session.call("POST", "/malformed"),
    /POST \/malformed -> HTTP 200: malformed JSON response/u,
  );
  await assert.rejects(
    session.call("GET", "/missing"),
    /GET \/missing -> HTTP 200: response is missing the value envelope/u,
  );
  await assert.rejects(
    session.call("DELETE", "/failure"),
    /DELETE \/failure -> HTTP 404: WebDriver request failed/u,
  );
});

test("appProcesses reports ps execution and parse failures instead of process absence", async () => {
  const fixtureDirectory = await mkdtemp(join(tmpdir(), "app-driver-ps-"));
  const ps = join(fixtureDirectory, "ps");
  const originalPath = process.env.PATH;
  try {
    await writeFile(ps, "#!/bin/sh\nexit 23\n");
    await chmod(ps, 0o755);
    process.env.PATH = fixtureDirectory;
    assert.throws(appProcesses, (error) => {
      assert.match(error.message, /could not inspect application processes with ps/u);
      assert.ok(error.cause);
      return true;
    });

    await writeFile(ps, "#!/bin/sh\nprintf 'not-a-process-row\\n'\n");
    assert.throws(appProcesses, (error) => {
      assert.match(error.message, /could not inspect application processes with ps/u);
      assert.match(error.cause.message, /malformed process row/u);
      return true;
    });
  } finally {
    process.env.PATH = originalPath;
    await rm(fixtureDirectory, { recursive: true, force: true });
  }
});

function fakeChild(pid, destroyed) {
  return {
    pid,
    stdout: { destroy: () => destroyed.push(`stdout:${pid}`) },
    stderr: { destroy: () => destroyed.push(`stderr:${pid}`) },
  };
}

test("cleanup rejects surviving groups after attempting every owned resource", async () => {
  const signals = [];
  const destroyed = [];
  let profileRemoved = false;

  await assert.rejects(
    cleanUpResources({
      children: [fakeChild(12001, destroyed), fakeChild(12002, destroyed)],
      profileToRemove: "/fixture/profile",
      signalGroup: (pid, signal) => signals.push(`${pid}:${signal}`),
      waitForGroup: async (pid) => pid === 12002,
      groupExists: (pid) => pid === 12001,
      removeProfile: async () => {
        profileRemoved = true;
      },
    }),
    /process groups still alive after SIGKILL: 12001/u,
  );

  assert.deepEqual(signals, ["12001:SIGTERM", "12002:SIGTERM", "12001:SIGKILL"]);
  assert.deepEqual(destroyed, ["stdout:12001", "stderr:12001", "stdout:12002", "stderr:12002"]);
  assert.equal(profileRemoved, true);
});

test("successful cleanup is shared and idempotent", async () => {
  const destroyed = [];
  let cleanupCalls = 0;
  const shutdown = createSharedShutdown(async () => {
    cleanupCalls += 1;
    await cleanUpResources({
      children: [fakeChild(13001, destroyed)],
      signalGroup: () => true,
      waitForGroup: async () => true,
      groupExists: () => false,
    });
  });

  const first = shutdown();
  const second = shutdown();
  assert.strictEqual(first, second);
  await Promise.all([first, second]);
  assert.equal(cleanupCalls, 1);
  assert.deepEqual(destroyed, ["stdout:13001", "stderr:13001"]);
});

// Revert proof (2026-10-08): only the helper body used the old try/finally + Promise.all form.
// pnpm app:driver:test exited 1 on this test at assert.ok(error instanceof AggregateError).
// The helper was restored byte-for-byte, then all five tests passed.
test("cleanup aggregates the original failure and profile removal failures after attempting every profile", async () => {
  const cleanupError = new Error("injected child cleanup failure");
  const removalError = new Error("injected profile removal failure");
  const removed = [];
  await assert.rejects(
    cleanUpWithProfiles(
      async () => {
        throw cleanupError;
      },
      ["/fixture/failing-profile", "/fixture/successful-profile"],
      async (profile) => {
        removed.push(profile);
        if (profile === "/fixture/failing-profile") throw removalError;
      },
    ),
    (error) => {
      assert.ok(error instanceof AggregateError);
      assert.deepEqual(error.errors, [cleanupError, removalError]);
      assert.strictEqual(error.errors[0], cleanupError);
      assert.strictEqual(error.errors[1], removalError);
      assert.match(error.message, /injected child cleanup failure/u);
      assert.match(error.message, /injected profile removal failure/u);
      assert.match(error.message, /could not remove temporary profile \/fixture\/failing-profile/u);
      return true;
    },
  );
  assert.deepEqual(removed, ["/fixture/failing-profile", "/fixture/successful-profile"]);
});
