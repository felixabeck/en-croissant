import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";
import {
  currentIdentity,
  identityForPid,
  identityIsLive,
  ProcessIdentityError,
} from "./process-identity.mjs";

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

test("identity lookup propagates non-ENOENT read failures with the pid", () => {
  const denied = Object.assign(new Error("permission denied"), { code: "EACCES" });
  assert.throws(
    () =>
      identityForPid(123, () => {
        throw denied;
      }),
    (error) =>
      error instanceof ProcessIdentityError &&
      error.pid === 123 &&
      /pid 123: permission denied/u.test(error.message),
  );
});

test("identity lookup rejects malformed stat contents with the pid", () => {
  assert.throws(
    () => identityForPid(456, () => "456 malformed"),
    (error) =>
      error instanceof ProcessIdentityError &&
      error.pid === 456 &&
      /pid 456: malformed \/proc stat line/u.test(error.message),
  );
  assert.throws(
    () => identityForPid(456, () => "456 (short) S 1 2 3"),
    (error) =>
      error instanceof ProcessIdentityError &&
      /pid 456: unexpected \/proc stat field count/u.test(error.message),
  );
});
