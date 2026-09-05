import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";
import { currentIdentity, identityForPid, identityIsLive } from "./process-identity.mjs";

function waitForChild(child) {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });
}

test("a child identity is live until that child has been reaped", async () => {
  const child = spawn("/bin/sleep", ["30"]);
  const identity = identityForPid(child.pid);
  assert.ok(identity);
  assert.equal(identityIsLive(identity), true);
  child.kill("SIGTERM");
  await waitForChild(child);
  assert.equal(identityForPid(identity.pid), undefined);
  assert.equal(identityIsLive(identity), false);
});

test("a live pid with a different start time is not the same process", () => {
  const identity = currentIdentity();
  assert.equal(identityIsLive({ ...identity, startTime: `${identity.startTime}-wrong` }), false);
});

test("a legacy pid-only identity remains live", () => {
  assert.equal(identityIsLive({ pid: process.pid }), true);
});
