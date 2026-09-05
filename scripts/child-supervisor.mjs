const PROCESS_GROUP_POLL_MS = 10;

function childIsRunning(child) {
  return child.exitCode === null && child.signalCode === null;
}

function signalChild(child, signal, killProcessGroup) {
  try {
    if (killProcessGroup) {
      if (child.pid === undefined) return false;
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
  signalChild(child, "SIGKILL", true);
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
