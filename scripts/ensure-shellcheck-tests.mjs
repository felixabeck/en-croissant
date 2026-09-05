import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, watch } from "node:fs";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  readlink,
  rm,
  symlink,
  utimes,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  cliMain,
  DOWNLOAD_TIMEOUT_MS,
  ensureShellcheck,
  PRODUCTION_OPTIONS,
  RELEASE_BASE_URL,
  SHELLCHECK_SHA256,
  SHELLCHECK_VERSION,
} from "./ensure-shellcheck.mjs";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const expectedAssetPath = "/v0.11.0/shellcheck-v0.11.0.linux.x86_64.tar.xz";

function digest(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

async function assertVerifiedBinary(binaryPath) {
  assert.equal(existsSync(binaryPath), true);
  const recordedHash = await readFile(join(dirname(binaryPath), "shellcheck.sha256"), "utf8");
  assert.equal(recordedHash.trim(), digest(await readFile(binaryPath)));
}

async function assertNoPublishedGeneration(cacheDir) {
  const versionDirectory = join(cacheDir, "v0.11.0");
  assert.equal(existsSync(join(versionDirectory, "current")), false);
  assert.deepEqual(
    (await readdir(versionDirectory)).filter(
      (name) => name.startsWith(".tmp-") || name.startsWith("gen-"),
    ),
    [],
  );
}

async function fixtureArchive(t, contents = undefined) {
  const root = await mkdtemp(join(tmpdir(), "ensure-shellcheck-fixture-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const packageDirectory = join(root, "shellcheck-v0.11.0");
  await mkdir(packageDirectory);
  const binaryPath = join(packageDirectory, "shellcheck");
  await writeFile(
    binaryPath,
    contents ??
      '#!/bin/sh\nif [ "$1" = "--fail" ]; then exit 23; fi\nif [ "$1" = "--version" ]; then echo 0.11.0; fi\n',
  );
  await chmod(binaryPath, 0o755);
  const archivePath = join(root, "fixture.tar.xz");
  const tar = spawnSync("tar", ["-cJf", archivePath, "shellcheck-v0.11.0"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(tar.status, 0, tar.stderr);
  const archive = await readFile(archivePath);
  return { archive, hash: digest(archive) };
}

async function temporaryCache(t) {
  const cacheDir = await mkdtemp(join(tmpdir(), "ensure-shellcheck-cache-"));
  t.after(() => rm(cacheDir, { recursive: true, force: true }));
  return cacheDir;
}

async function fixtureServer(t, handler) {
  const requests = [];
  const sockets = new Set();
  const server = createServer((request, response) => {
    requests.push(request.url);
    handler(request, response);
  });
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  t.after(
    () =>
      new Promise((resolve) => {
        for (const socket of sockets) socket.destroy();
        server.close(resolve);
      }),
  );
  const { port } = server.address();
  return { baseUrl: `http://127.0.0.1:${port}`, requests };
}

function options({ cacheDir, baseUrl, hash, fetchImpl = globalThis.fetch, timeoutMs = 1_000 }) {
  return {
    version: "v0.11.0",
    sha256: { "linux-x64": hash },
    baseUrl,
    cacheDir,
    platform: "linux",
    arch: "x64",
    fetchImpl,
    timeoutMs,
  };
}

test("requests only the pinned release asset through the injected fetch", async (t) => {
  const fixture = await fixtureArchive(t);
  const cacheDir = await temporaryCache(t);
  const server = await fixtureServer(t, (_request, response) => {
    response.end(fixture.archive);
  });
  const fetchedUrls = [];
  const recordingFetch = (url, init) => {
    const requestedUrl = String(url);
    fetchedUrls.push(requestedUrl);
    if (!requestedUrl.startsWith(server.baseUrl)) {
      return Promise.resolve(new Response("external request refused by test", { status: 418 }));
    }
    return globalThis.fetch(url, init);
  };

  await ensureShellcheck(options({ ...fixture, ...server, cacheDir, fetchImpl: recordingFetch }));

  assert.deepEqual(fetchedUrls, [`${server.baseUrl}${expectedAssetPath}`]);
  assert.deepEqual(server.requests, [expectedAssetPath]);
});

test("refuses a wrong archive hash and installs nothing", async (t) => {
  const fixture = await fixtureArchive(t);
  const cacheDir = await temporaryCache(t);
  const server = await fixtureServer(t, (_request, response) => {
    response.end(fixture.archive);
  });

  await assert.rejects(
    ensureShellcheck(options({ ...fixture, ...server, cacheDir, hash: "0".repeat(64) })),
    /archive hash mismatch/,
  );
  await assertNoPublishedGeneration(cacheDir);
});

test("installs once and serves a verified cache hit without another request", async (t) => {
  const fixture = await fixtureArchive(t);
  const cacheDir = await temporaryCache(t);
  const server = await fixtureServer(t, (_request, response) => {
    response.end(fixture.archive);
  });
  const fixtureOptions = options({ ...fixture, ...server, cacheDir });

  const first = await ensureShellcheck(fixtureOptions);
  const second = await ensureShellcheck(fixtureOptions);

  assert.equal(first, second);
  assert.deepEqual(server.requests, [expectedAssetPath]);
});

test("cliMain propagates the fixture binary's non-zero status", async (t) => {
  const fixture = await fixtureArchive(t);
  const cacheDir = await temporaryCache(t);
  const server = await fixtureServer(t, (_request, response) => {
    response.end(fixture.archive);
  });

  assert.equal(await cliMain(["--fail"], options({ ...fixture, ...server, cacheDir })), 23);
});

test("cliMain maps bad-shebang ENOENT to status 1", async (t) => {
  const fixture = await fixtureArchive(t, "#!/nonexistent/interpreter\nexit 0\n");
  const cacheDir = await temporaryCache(t);
  const server = await fixtureServer(t, (_request, response) => {
    response.end(fixture.archive);
  });

  assert.equal(await cliMain([], options({ ...fixture, ...server, cacheDir })), 1);
});

test("cliMain does not fall back to a releases/latest endpoint", async (t) => {
  const fixture = await fixtureArchive(t);
  const cacheDir = await temporaryCache(t);
  const server = await fixtureServer(t, (request, response) => {
    if (request.url === "/releases/latest") response.end(fixture.archive);
    else {
      response.statusCode = 404;
      response.end("not found");
    }
  });

  assert.equal(await cliMain([], options({ ...fixture, ...server, cacheDir })), 1);
  assert.deepEqual(server.requests, [expectedAssetPath]);
});

test("reclaims stale temporary directories and unreferenced generations only", async (t) => {
  const fixture = await fixtureArchive(t);
  const cacheDir = await temporaryCache(t);
  const versionDirectory = join(cacheDir, "v0.11.0");
  await mkdir(versionDirectory);
  const oldDirectory = join(versionDirectory, ".tmp-old");
  const liveDirectory = join(versionDirectory, ".tmp-live");
  const staleGeneration = join(versionDirectory, "gen-stale");
  const referencedGeneration = join(versionDirectory, "gen-current");
  await mkdir(oldDirectory);
  await mkdir(liveDirectory);
  await mkdir(staleGeneration);
  await mkdir(referencedGeneration);
  await symlink("gen-current", join(versionDirectory, "current"));
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1_000);
  await utimes(oldDirectory, twoHoursAgo, twoHoursAgo);
  await utimes(staleGeneration, twoHoursAgo, twoHoursAgo);
  await utimes(referencedGeneration, twoHoursAgo, twoHoursAgo);
  const server = await fixtureServer(t, (_request, response) => {
    response.end(fixture.archive);
  });

  await ensureShellcheck(options({ ...fixture, ...server, cacheDir }));

  assert.equal(existsSync(oldDirectory), false);
  assert.equal(existsSync(liveDirectory), true);
  assert.equal(existsSync(staleGeneration), false);
  assert.equal(existsSync(referencedGeneration), true);
});

test("aborts a never-ending response and removes its temporary directory", async (t) => {
  const fixture = await fixtureArchive(t);
  const cacheDir = await temporaryCache(t);
  const server = await fixtureServer(t, (_request, response) => {
    response.writeHead(200);
    response.write("partial");
  });

  await assert.rejects(
    ensureShellcheck(options({ ...fixture, ...server, cacheDir, timeoutMs: 50 })),
    /download failed while reading the response/,
  );
  assert.deepEqual(
    (await readdir(join(cacheDir, "v0.11.0"))).filter((name) => name.startsWith(".tmp-")),
    [],
  );
});

test("two cold-cache callers publish stable verified generations behind current", async (t) => {
  const fixture = await fixtureArchive(t);
  const cacheDir = await temporaryCache(t);
  const server = await fixtureServer(t, (_request, response) => {
    setTimeout(() => response.end(fixture.archive), 20);
  });
  const versionDirectory = join(cacheDir, "v0.11.0");
  await mkdir(versionDirectory);
  const currentPath = join(versionDirectory, "current");
  let currentWasPublished = false;
  let currentWasAbsentAfterPublication = false;
  const pointerChecks = [];
  const cacheWatcher = watch(versionDirectory, (_event, filename) => {
    if (filename !== "current") return;
    if (currentWasPublished && !existsSync(currentPath)) currentWasAbsentAfterPublication = true;
    if (existsSync(currentPath)) {
      currentWasPublished = true;
      pointerChecks.push(
        readlink(currentPath).then((generation) =>
          assertVerifiedBinary(join(versionDirectory, generation, "shellcheck")),
        ),
      );
    }
  });
  t.after(() => cacheWatcher.close());
  const fixtureOptions = options({ ...fixture, ...server, cacheDir });

  const [first, second] = await Promise.all([
    ensureShellcheck(fixtureOptions),
    ensureShellcheck(fixtureOptions),
  ]);
  await new Promise((resolve) => setTimeout(resolve, 30));
  await Promise.all(pointerChecks);

  await assertVerifiedBinary(first);
  await assertVerifiedBinary(second);
  assert.equal(currentWasPublished, true);
  assert.equal(currentWasAbsentAfterPublication, false);
  await assertVerifiedBinary(join(versionDirectory, await readlink(currentPath), "shellcheck"));
  assert.equal(server.requests.length, 2);
  assert.deepEqual(
    (await readdir(versionDirectory)).filter((name) => name.startsWith(".tmp-")),
    [],
  );
});

test("refuses an unsupported platform and names the pinned map", async (t) => {
  const cacheDir = await temporaryCache(t);
  const requested = [];
  await assert.rejects(
    ensureShellcheck({
      ...options({ cacheDir, baseUrl: "http://127.0.0.1:1", hash: "unused" }),
      platform: "darwin",
      arch: "arm64",
      fetchImpl: (...args) => {
        requested.push(args);
        return globalThis.fetch(...args);
      },
    }),
    /Unsupported ShellCheck platform darwin-arm64; pinned platforms: linux-x64/,
  );
  assert.deepEqual(requested, []);
});

test("a connection closed mid-body rejects without leaving cache state", async (t) => {
  const fixture = await fixtureArchive(t);
  const cacheDir = await temporaryCache(t);
  const server = await fixtureServer(t, (request, response) => {
    response.writeHead(200, { "Content-Length": fixture.archive.length });
    response.write(fixture.archive.subarray(0, 20));
    request.socket.destroy();
  });

  await assert.rejects(
    ensureShellcheck(options({ ...fixture, ...server, cacheDir })),
    /ShellCheck download failed/,
  );
  await assertNoPublishedGeneration(cacheDir);
});

test("a well-hashed invalid archive fails extraction and leaves no cache", async (t) => {
  const archive = Buffer.from("not an xz archive");
  const fixture = { archive, hash: digest(archive) };
  const cacheDir = await temporaryCache(t);
  const server = await fixtureServer(t, (_request, response) => {
    response.end(archive);
  });

  await assert.rejects(
    ensureShellcheck(options({ ...fixture, ...server, cacheDir })),
    /ShellCheck extraction failed/,
  );
  await assertNoPublishedGeneration(cacheDir);
});

test("a truncated cached binary is replaced and never returned", async (t) => {
  const fixture = await fixtureArchive(t);
  const cacheDir = await temporaryCache(t);
  const server = await fixtureServer(t, (_request, response) => {
    response.end(fixture.archive);
  });
  const fixtureOptions = options({ ...fixture, ...server, cacheDir });
  const first = await ensureShellcheck(fixtureOptions);
  await writeFile(first, "truncated");

  const repaired = await ensureShellcheck(fixtureOptions);

  assert.notEqual(repaired, first);
  assert.equal(existsSync(first), true);
  assert.notEqual(await readFile(repaired, "utf8"), "truncated");
  assert.equal(server.requests.length, 2);
});

test("two callers concurrently repair a truncated cache without invalidating returned paths", async (t) => {
  const fixture = await fixtureArchive(t);
  const cacheDir = await temporaryCache(t);
  const server = await fixtureServer(t, (_request, response) => {
    setTimeout(() => response.end(fixture.archive), 20);
  });
  const fixtureOptions = options({ ...fixture, ...server, cacheDir });
  const binaryPath = await ensureShellcheck(fixtureOptions);
  await writeFile(binaryPath, "truncated");
  server.requests.length = 0;

  const versionDirectory = join(cacheDir, "v0.11.0");
  const currentPath = join(versionDirectory, "current");
  let republished = false;
  let absentAfterRepublication = false;
  const pointerChecks = [];
  const cacheWatcher = watch(versionDirectory, (_event, filename) => {
    if (filename !== "current") return;
    if (existsSync(currentPath)) {
      republished = true;
      pointerChecks.push(
        readlink(currentPath).then((generation) =>
          assertVerifiedBinary(join(versionDirectory, generation, "shellcheck")),
        ),
      );
    } else if (republished) absentAfterRepublication = true;
  });
  t.after(() => cacheWatcher.close());

  const [first, second] = await Promise.all([
    ensureShellcheck(fixtureOptions),
    ensureShellcheck(fixtureOptions),
  ]);
  await new Promise((resolve) => setTimeout(resolve, 30));
  await Promise.all(pointerChecks);

  await assertVerifiedBinary(first);
  await assertVerifiedBinary(second);
  assert.ok(server.requests.length <= 2, "a caller downloaded more than once");
  assert.equal(republished, true);
  assert.equal(absentAfterRepublication, false);
  await assertVerifiedBinary(join(versionDirectory, await readlink(currentPath), "shellcheck"));
});

test("production constants and hooks wiring stay pinned", async () => {
  assert.equal(SHELLCHECK_VERSION, "v0.11.0");
  assert.deepEqual(SHELLCHECK_SHA256, {
    "linux-x64": "8c3be12b05d5c177a04c29e3c78ce89ac86f1595681cab149b65b97c4e227198",
  });
  assert.equal(RELEASE_BASE_URL, "https://github.com/koalaman/shellcheck/releases/download");
  assert.equal(DOWNLOAD_TIMEOUT_MS, 120_000);
  assert.equal(PRODUCTION_OPTIONS.version, SHELLCHECK_VERSION);
  assert.equal(PRODUCTION_OPTIONS.sha256, SHELLCHECK_SHA256);
  assert.equal(PRODUCTION_OPTIONS.baseUrl, RELEASE_BASE_URL);
  assert.equal(PRODUCTION_OPTIONS.timeoutMs, DOWNLOAD_TIMEOUT_MS);

  const packageJson = JSON.parse(await readFile(join(projectRoot, "package.json"), "utf8"));
  assert.match(packageJson.scripts["hooks:check"], /node scripts\/ensure-shellcheck\.mjs/);
  assert.doesNotMatch(packageJson.scripts["hooks:check"], /dlx shellcheck/);
  assert.match(packageJson.scripts["hooks:check"], /&& pnpm hooks:shellcheck:test$/);
  assert.equal(
    packageJson.scripts["hooks:shellcheck:test"],
    "node --test scripts/ensure-shellcheck-tests.mjs",
  );
});
