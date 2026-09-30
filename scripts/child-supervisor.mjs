const PROCESS_GROUP_POLL_MS = 10;

function childIsRunning(child) {
  return child.exitCode === null && child.signalCode === null;
}

function signalChild(child, signal, killProcessGroup, { allowExitedGroup = false } = {}) {
  try {
    if (killProcessGroup) {
      if (child.pid === undefined) return false;
      if (!allowExitedGroup && !childIsRunning(child)) return false;
      process.kill(-child.pid, signal);
      return true;
    }
    if (!childIsRunning(child)) return false;
    return child.kill(signal);
  } catch (error) {
    if (error?.code === "ESRCH") return false;
    throw error;
  }
}

async function sweepProcessGroup(child) {
  if (child.pid === undefined) return;
  signalChild(child, "SIGKILL", true, { allowExitedGroup: true });
  while (true) {
    try {
      process.kill(-child.pid, 0);
    } catch (error) {
      if (error?.code === "ESRCH") return;
      throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, PROCESS_GROUP_POLL_MS));
  }
}

export function superviseChild(child, { terminationTimeoutMs, killProcessGroup = false }) {
  const childDone = new Promise((resolve) => {
    let spawnError;
    child.once("error", (error) => {
      spawnError = error;
    });
    child.once("close", (code, signal) => resolve({ code, signal, error: spawnError }));
  });
  const done = (async () => {
    const result = await childDone;
    if (killProcessGroup) await sweepProcessGroup(child);
    return result;
  })();
  let termination;

  return {
    done,
    unref() {
      child.unref?.();
    },
    terminate() {
      if (termination) return termination;
      termination = (async () => {
        signalChild(child, "SIGTERM", killProcessGroup);
        let escalationTimer;
        const escalation = new Promise((resolve, reject) => {
          escalationTimer = setTimeout(() => {
            try {
              signalChild(child, "SIGKILL", killProcessGroup);
              resolve();
            } catch (error) {
              reject(error);
            }
          }, terminationTimeoutMs);
        });
        try {
          await Promise.race([done, escalation]);
          return await done;
        } finally {
          clearTimeout(escalationTimer);
        }
      })();
      return termination;
    },
  };
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

/** Attempt every child termination and report all failures after every attempt settles. */
async function terminateChildren(children, label) {
  const entries = [...children];
  const results = await Promise.allSettled(entries.map(({ supervisor }) => supervisor.terminate()));
  const failures = results.flatMap((result, index) => {
    if (result.status === "fulfilled") return [];
    const { name } = entries[index];
    return [
      new Error(`Failed to terminate ${label} child ${name}: ${errorMessage(result.reason)}`, {
        cause: result.reason,
      }),
    ];
  });
  if (failures.length > 0) {
    for (const [index, result] of results.entries()) {
      if (result.status === "rejected") entries[index].supervisor.unref?.();
    }
    throw new AggregateError(failures, `Failed to terminate ${failures.length} ${label} child(s).`);
  }
}

/** Forward runner signals to every attached child and latch attachment into termination. */
export function installMultiChildSignalForwarding({ label = "frontend mutation" } = {}) {
  let requestedSignal;
  let resolveSignalRequested;
  const signalRequested = new Promise((resolve) => {
    resolveSignalRequested = resolve;
  });
  const children = [];
  const terminationBatches = [];
  const terminateAll = () => {
    const termination = terminateChildren(children, label);
    terminationBatches.push(termination);
    termination.catch(() => {});
    return termination;
  };
  const handler = (signal) => {
    if (requestedSignal) return;
    requestedSignal = signal;
    resolveSignalRequested(signal);
    terminateAll();
  };
  process.on("SIGINT", handler);
  process.on("SIGTERM", handler);
  return {
    get requestedSignal() {
      return requestedSignal;
    },
    signalRequested,
    get termination() {
      return Promise.allSettled(terminationBatches).then((results) => {
        const failures = results.flatMap((result) =>
          result.status === "rejected" ? [result.reason] : [],
        );
        if (failures.length > 0) {
          throw new AggregateError(failures, `${label} signal cleanup failed.`);
        }
      });
    },
    attach(supervisor, name) {
      children.push({ supervisor, name });
      if (requestedSignal) terminateAll();
    },
    terminateAll,
    uninstall() {
      process.off("SIGINT", handler);
      process.off("SIGTERM", handler);
    },
  };
}

export function installSignalForwarding(getSupervisor) {
  let requestedSignal;
  let termination = Promise.resolve();
  const handler = (signal) => {
    if (requestedSignal) return;
    requestedSignal = signal;
    const supervisor = getSupervisor();
    if (supervisor) {
      termination = supervisor.terminate();
      termination.catch(() => {});
    }
  };
  process.on("SIGINT", handler);
  process.on("SIGTERM", handler);
  return {
    get requestedSignal() {
      return requestedSignal;
    },
    get termination() {
      return termination;
    },
    attach(supervisor) {
      if (!requestedSignal) return;
      termination = supervisor.terminate();
      termination.catch(() => {});
    },
    uninstall() {
      process.off("SIGINT", handler);
      process.off("SIGTERM", handler);
    },
  };
}
