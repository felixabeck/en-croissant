import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import {
  formatNestedError,
  installMultiChildSignalForwarding,
  signalExitCode,
  superviseChild,
} from "./child-supervisor.mjs";

test("multi-child forwarding treats an already-aborted signal as cancellation", async () => {
  const controller = new AbortController();
  controller.abort();
  const forwarding = installMultiChildSignalForwarding({
    label: "test child",
    abortSignal: controller.signal,
  });
  let terminations = 0;
  try {
    assert.equal(forwarding.requestedReason, "abort");
    assert.equal(forwarding.requestedSignal, undefined);
    assert.equal(await forwarding.signalRequested, "abort");
    forwarding.attach({ terminate: async () => (terminations += 1) }, "late child");
    await forwarding.termination;
    assert.equal(terminations, 1);
  } finally {
    forwarding.uninstall();
  }
});

test("signal exit codes retain 128 plus signal number and default unknowns to 128", () => {
  assert.equal(signalExitCode("SIGINT"), 130);
  assert.equal(signalExitCode("SIGTERM"), 143);
  assert.equal(signalExitCode("SIG_NOT_A_REAL_SIGNAL"), 128);
  assert.equal(signalExitCode("SIG_NOT_A_REAL_SIGNAL", 1), 1);
});

test("supervisor settlement reports a child exit", async () => {
  const child = new EventEmitter();
  child.exitCode = null;
  child.signalCode = null;
  const supervisor = superviseChild(child, { terminationTimeoutMs: 10 });
  const settled = supervisor.settled();
  child.exitCode = 0;
  child.emit("close", 0, null);

  assert.deepEqual(await settled, {
    type: "exit",
    result: { code: 0, signal: null, error: undefined },
  });
});

test("supervisor settlement reports a termination failure before a later child exit", async () => {
  const child = new EventEmitter();
  child.exitCode = null;
  child.signalCode = null;
  const terminationError = Object.assign(new Error("injected EPERM"), { code: "EPERM" });
  child.kill = () => {
    throw terminationError;
  };
  const supervisor = superviseChild(child, { terminationTimeoutMs: 10 });
  const settled = supervisor.settled();
  const termination = supervisor.terminate();

  assert.deepEqual(await settled, { type: "termination-failed", error: terminationError });
  await assert.rejects(termination, /injected EPERM/u);
  child.exitCode = 1;
  child.emit("close", 1, null);
  assert.deepEqual(await supervisor.done, { code: 1, signal: null, error: undefined });
});

test("supervisor settlement does not wait for a child after termination fails", async () => {
  const child = new EventEmitter();
  child.exitCode = null;
  child.signalCode = null;
  child.kill = () => {
    const error = new Error("injected kill failure");
    error.code = "EPERM";
    throw error;
  };
  const supervisor = superviseChild(child, { terminationTimeoutMs: 10 });
  const termination = supervisor.terminate();
  const terminationRejected = assert.rejects(termination, /injected kill failure/u);
  let timer;
  const outcome = await Promise.race([
    supervisor.settled(),
    new Promise((resolve) => {
      timer = setTimeout(() => resolve({ type: "timeout" }), 250);
    }),
  ]);
  clearTimeout(timer);

  assert.equal(outcome.type, "termination-failed");
  assert.match(outcome.error.message, /injected kill failure/u);
  await terminationRejected;
});

test("nested errors share traversal while callers choose their formatting", () => {
  const error = new AggregateError(
    [new Error("child failure"), new Error("aggregate cause")],
    "root failure",
    { cause: new Error("root cause") },
  );
  assert.equal(
    formatNestedError(error, (message, nested) =>
      nested.length ? `${message}: ${nested.join("; ")}` : message,
    ),
    "root failure: child failure; aggregate cause; root cause",
  );
  assert.equal(
    formatNestedError(error, (message, nested, depth) =>
      [`${"  ".repeat(depth)}${message}`, ...nested].join("\n"),
    ),
    "root failure\n  child failure\n  aggregate cause\n  root cause",
  );
});
