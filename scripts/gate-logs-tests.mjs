import assert from "node:assert/strict";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve } from "node:path";
import test from "node:test";
import {
  GATE_LOG_DIRECTORY_ENV,
  LOG_TAIL_BYTES,
  MAX_GATE_LOG_RUNS,
  formatFailureTrailer,
  makeLogDirectory,
  obtainLogDirectory,
  readLogTail,
  transcriptFileName,
} from "./gate-logs.mjs";

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "gate-logs-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const base = join(root, "artifacts", "gates");
  mkdirSync(base, { recursive: true });
  return { root, base };
}

const creationOptions = { now: () => Date.UTC(2026, 9, 7, 12, 34, 56, 789), pid: 123 };

test("creation retains the newest 100 real run directories and preserves other entries", (t) => {
  const { root, base } = fixture(t);
  const names = Array.from(
    { length: 105 },
    (_, index) => `20261006T${String(index).padStart(9, "0")}Z-1`,
  );
  for (const name of names) mkdirSync(join(base, name));
  const unrelated = join(base, "keep-this-directory");
  mkdirSync(unrelated);
  const file = join(base, "20260101T000000000Z-1");
  writeFileSync(file, "keep this file\n");
  const outside = join(root, "outside");
  mkdirSync(outside);
  const marker = join(outside, "marker");
  writeFileSync(marker, "keep target\n");
  const link = join(base, "20260102T000000000Z-1");
  symlinkSync(outside, link, "dir");
  // Recursive removal must unlink an inner symlink without following its target.
  symlinkSync(outside, join(base, names[0], "inner-link"), "dir");
  const warnings = [];
  const directory = makeLogDirectory(root, {
    ...creationOptions,
    warn: (line) => warnings.push(line),
  });

  assert.equal(basename(directory), "20261007T123456789Z-123");
  assert.ok(lstatSync(directory).isDirectory());
  const retained = readdirSync(base).filter((name) => lstatSync(join(base, name)).isDirectory());
  assert.deepEqual(
    retained.sort(),
    [...names.slice(6), basename(directory), basename(unrelated)].sort(),
  );
  assert.equal(retained.length - 1, MAX_GATE_LOG_RUNS);
  assert.ok(lstatSync(link).isSymbolicLink());
  assert.equal(readFileSync(file, "utf8"), "keep this file\n");
  assert.equal(readFileSync(marker, "utf8"), "keep target\n");
  assert.deepEqual(warnings, []);
});

test("the run just created survives pruning even when the clock moves backwards", (t) => {
  const { root, base } = fixture(t);
  for (let index = 0; index < 105; index += 1) {
    mkdirSync(join(base, `20990101T${String(index).padStart(9, "0")}Z-1`));
  }
  const directory = makeLogDirectory(root, creationOptions);
  assert.ok(existsSync(directory));
  assert.equal(readdirSync(base).length, MAX_GATE_LOG_RUNS);
});

test(
  "pruning failure warns with its path and still returns the new run",
  { skip: process.getuid?.() === 0 },
  (t) => {
    const { root, base } = fixture(t);
    const blocked = join(base, "20200101T000000000Z-1");
    mkdirSync(blocked);
    writeFileSync(join(blocked, "marker"), "cannot remove without directory access\n");
    chmodSync(blocked, 0o500);
    for (let index = 0; index < 99; index += 1) {
      mkdirSync(join(base, `20261006T${String(index).padStart(9, "0")}Z-1`));
    }
    const warnings = [];
    try {
      const directory = makeLogDirectory(root, {
        ...creationOptions,
        warn: (line) => warnings.push(line),
      });
      assert.ok(existsSync(directory));
      assert.ok(existsSync(blocked));
      assert.equal(warnings.length, 1);
      assert.ok(warnings[0].includes(blocked));
      assert.equal(warnings[0].split("\n").length, 1);
    } finally {
      chmodSync(blocked, 0o700);
    }
  },
);

test("an inherited real direct child is reused, including a relative path", (t) => {
  const { root, base } = fixture(t);
  const inherited = join(base, "existing-run");
  mkdirSync(inherited);
  for (const value of [inherited, relative(root, inherited), `${inherited}/../existing-run/`]) {
    const warnings = [];
    assert.equal(
      obtainLogDirectory(root, {
        env: { [GATE_LOG_DIRECTORY_ENV]: value },
        warn: (line) => warnings.push(line),
      }),
      inherited,
    );
    assert.deepEqual(warnings, []);
    assert.deepEqual(readdirSync(base), ["existing-run"]);
  }
});

test("invalid inherited directories warn once and are replaced by a fresh run", async (t) => {
  for (const kind of ["outside", "missing", "symlink", "file", "nested", "base", "empty"]) {
    await t.test(kind, (subtest) => {
      const { root, base } = fixture(subtest);
      const outside = join(root, "outside");
      mkdirSync(outside);
      const link = join(base, "link");
      symlinkSync(outside, link, "dir");
      const file = join(base, "file");
      writeFileSync(file, "not a directory");
      const nested = join(base, "parent", "nested");
      mkdirSync(nested, { recursive: true });
      const value = {
        outside,
        missing: join(base, "missing"),
        symlink: link,
        file,
        nested,
        base,
        empty: "",
      }[kind];
      const warnings = [];
      const directory = obtainLogDirectory(root, {
        env: { [GATE_LOG_DIRECTORY_ENV]: value },
        ...creationOptions,
        warn: (line) => warnings.push(line),
      });
      assert.equal(directory, join(base, "20261007T123456789Z-123"));
      assert.ok(lstatSync(directory).isDirectory());
      assert.equal(warnings.length, 1);
      assert.match(warnings[0], /Ignoring invalid GATE_LOG_DIRECTORY:/u);
      assert.equal(warnings[0].split("\n").length, 1);
    });
  }
});

test("an absent inheritance key creates a run without a warning", (t) => {
  const { root } = fixture(t);
  const warnings = [];
  const directory = obtainLogDirectory(root, {
    env: {},
    ...creationOptions,
    warn: (line) => warnings.push(line),
  });
  assert.ok(lstatSync(directory).isDirectory());
  assert.deepEqual(warnings, []);
});

test("a symlinked gate-log base cannot create or prune outside the repository", (t) => {
  const { root, base } = fixture(t);
  const outside = join(root, "outside");
  mkdirSync(outside);
  rmSync(base, { recursive: true });
  symlinkSync(outside, base, "dir");
  assert.throws(() => makeLogDirectory(root, creationOptions), /not a real directory/u);
  assert.deepEqual(readdirSync(outside), []);
});

test("transcript names remain distinct from scheduler lane logs", () => {
  assert.equal(transcriptFileName("frontend-build"), "receipt-frontend-build.log");
  assert.equal(transcriptFileName("backend-test"), "receipt-backend-test.log");
});

test("the tail reader returns the last 8 KiB as UTF-8 and handles empty or missing logs", (t) => {
  const { root } = fixture(t);
  const path = join(root, "tail.log");
  const text = `${"discard\n".repeat(2000)}${"ä\n".repeat(3000)}`;
  writeFileSync(path, text);
  const bytes = Buffer.from(text);
  assert.equal(LOG_TAIL_BYTES, 8192);
  assert.equal(readLogTail(path), bytes.subarray(bytes.length - LOG_TAIL_BYTES).toString("utf8"));
  writeFileSync(path, "small log");
  assert.equal(readLogTail(path), "small log");
  writeFileSync(path, "");
  assert.equal(readLogTail(path), "");
  const missing = readLogTail(join(root, "missing\nfile"));
  assert.match(missing, /^Unable to read log tail: .*ENOENT/u);
  assert.equal(missing.split("\n").length, 1);
  assert.match(readLogTail(root), /^Unable to read log tail:/u);
});

test("failure trailers share absolute path formatting for lanes and receipt gates", () => {
  const path = resolve("artifacts/gates/example/contract.log");
  assert.equal(
    formatFailureTrailer("push gate failed: contract", path),
    `push gate failed: contract — log: ${path}`,
  );
  assert.equal(
    formatFailureTrailer("pre-review check failed: bundle", path),
    `pre-review check failed: bundle — log: ${path}`,
  );
  assert.equal(
    formatFailureTrailer(
      "gate failed: backend-test (exit 143, signal SIGTERM)",
      path,
      "transcript",
    ),
    `gate failed: backend-test (exit 143, signal SIGTERM) — transcript: ${path}`,
  );
});
