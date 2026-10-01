import assert from "node:assert/strict";
import test from "node:test";
import {
  formatNestedError,
  installMultiChildSignalForwarding,
  signalExitCode,
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
    formatNestedError(error, (message, nested, _error, depth) =>
      [`${"  ".repeat(depth)}${message}`, ...nested].join("\n"),
    ),
    "root failure\n  child failure\n  aggregate cause\n  root cause",
  );
});
