import assert from "node:assert/strict";
import { createServer } from "node:http";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { Session, appProcesses, cleanUpResources, createSharedShutdown } from "./app-driver.mjs";

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
