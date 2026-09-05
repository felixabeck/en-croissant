import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, watch } from "node:fs";
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, utimes, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  cliMain,
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
  assert.equal(existsSync(join(cacheDir, "v0.11.0")), false);
  assert.deepEqual(
    (await readdir(cacheDir)).filter((name) => name.startsWith(".tmp-")),
    [],
  );
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

test("reclaims only temporary directories older than one hour", async (t) => {
  const fixture = await fixtureArchive(t);
  const cacheDir = await temporaryCache(t);
  const oldDirectory = join(cacheDir, ".tmp-old");
  const liveDirectory = join(cacheDir, ".tmp-live");
  await mkdir(oldDirectory);
  await mkdir(liveDirectory);
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1_000);
  await utimes(oldDirectory, twoHoursAgo, twoHoursAgo);
  const server = await fixtureServer(t, (_request, response) => {
    response.end(fixture.archive);
  });

  await ensureShellcheck(options({ ...fixture, ...server, cacheDir }));

  assert.equal(existsSync(oldDirectory), false);
  assert.equal(existsSync(liveDirectory), true);
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
    (await readdir(cacheDir)).filter((name) => name.startsWith(".tmp-")),
    [],
  );
});

test("two cold-cache callers adopt one atomically published installation", async (t) => {
  const fixture = await fixtureArchive(t);
  const cacheDir = await temporaryCache(t);
  const server = await fixtureServer(t, (_request, response) => {
    setTimeout(() => response.end(fixture.archive), 20);
  });
  const finalDirectory = join(cacheDir, "v0.11.0");
  let finalWasPublished = false;
  let finalWasAbsentAfterPublication = false;
  let finalWasTouchedAfterPublication = false;
  const cacheWatcher = watch(cacheDir, (_event, filename) => {
    if (filename !== "v0.11.0") return;
    if (finalWasPublished) {
      finalWasTouchedAfterPublication = true;
      if (!existsSync(finalDirectory)) finalWasAbsentAfterPublication = true;
    } else if (existsSync(finalDirectory)) finalWasPublished = true;
  });
  t.after(() => cacheWatcher.close());
  const fixtureOptions = options({ ...fixture, ...server, cacheDir });

  const [first, second] = await Promise.all([
    ensureShellcheck(fixtureOptions),
    ensureShellcheck(fixtureOptions),
  ]);
  await new Promise((resolve) => setTimeout(resolve, 30));

  assert.equal(first, second);
  assert.equal(finalWasPublished, true);
  assert.equal(finalWasAbsentAfterPublication, false);
  assert.equal(finalWasTouchedAfterPublication, false);
  assert.equal(server.requests.length, 2);
  assert.deepEqual(
    (await readdir(cacheDir)).filter((name) => name === "v0.11.0"),
    ["v0.11.0"],
  );
  assert.deepEqual(
    (await readdir(cacheDir)).filter((name) => name.startsWith(".tmp-")),
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
  assert.equal(existsSync(join(cacheDir, "v0.11.0")), false);
  assert.deepEqual(
    (await readdir(cacheDir)).filter((name) => name.startsWith(".tmp-")),
    [],
  );
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
  assert.equal(existsSync(join(cacheDir, "v0.11.0")), false);
  assert.deepEqual(
    (await readdir(cacheDir)).filter((name) => name.startsWith(".tmp-")),
    [],
  );
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

  assert.equal(repaired, first);
  assert.notEqual(await readFile(repaired, "utf8"), "truncated");
  assert.equal(server.requests.length, 2);
});

test("production constants and hooks wiring stay pinned", async () => {
  assert.equal(SHELLCHECK_VERSION, "v0.11.0");
  assert.deepEqual(SHELLCHECK_SHA256, {
    "linux-x64": "8c3be12b05d5c177a04c29e3c78ce89ac86f1595681cab149b65b97c4e227198",
  });
  assert.equal(RELEASE_BASE_URL, "https://github.com/koalaman/shellcheck/releases/download");
  assert.equal(PRODUCTION_OPTIONS.version, SHELLCHECK_VERSION);
  assert.equal(PRODUCTION_OPTIONS.sha256, SHELLCHECK_SHA256);
  assert.equal(PRODUCTION_OPTIONS.baseUrl, RELEASE_BASE_URL);

  const packageJson = JSON.parse(await readFile(join(projectRoot, "package.json"), "utf8"));
  assert.match(packageJson.scripts["hooks:check"], /node scripts\/ensure-shellcheck\.mjs/);
  assert.doesNotMatch(packageJson.scripts["hooks:check"], /dlx shellcheck/);
  assert.match(packageJson.scripts["hooks:check"], /&& pnpm hooks:shellcheck:test$/);
  assert.equal(
    packageJson.scripts["hooks:shellcheck:test"],
    "node --test scripts/ensure-shellcheck-tests.mjs",
  );
});
