import { readFileSync } from "node:fs";

const START_TIME_FIELD = 22;
// /proc/<pid>/stat field 22 (starttime), counted from 1 per proc(5); fields 1-2 are
// pid and (comm), so after the closing parenthesis the state field is index 0 and
// starttime is index 19.
const START_TIME_INDEX_AFTER_COMMAND = START_TIME_FIELD - 3;

export class ProcessIdentityError extends Error {
  constructor(pid, message, options = undefined) {
    super(`Cannot read process identity for pid ${pid}: ${message}`, options);
    this.name = "ProcessIdentityError";
    this.pid = pid;
  }
}

function defaultReadStat(pid) {
  return readFileSync(`/proc/${pid}/stat`, "utf8");
}

export function isCompleteIdentity(record) {
  return Boolean(
    record &&
    Number.isSafeInteger(record.pid) &&
    record.pid > 0 &&
    typeof record.startTime === "string" &&
    record.startTime.length > 0,
  );
}

export function identityForPid(pid, readStat = defaultReadStat) {
  if (!Number.isSafeInteger(pid) || pid <= 0) {
    throw new ProcessIdentityError(pid, "pid must be a positive safe integer");
  }
  try {
    const stat = readStat(pid);
    if (typeof stat !== "string") {
      throw new ProcessIdentityError(pid, "stat reader returned a non-string value");
    }
    const commandEnd = stat.lastIndexOf(")");
    const commandStart = stat.indexOf(" (");
    if (commandStart < 1 || commandEnd <= commandStart + 1) {
      throw new ProcessIdentityError(pid, "malformed /proc stat line");
    }
    const fieldsFromState = stat
      .slice(commandEnd + 2)
      .trim()
      .split(/\s+/u);
    const startTime = fieldsFromState[START_TIME_INDEX_AFTER_COMMAND];
    if (fieldsFromState.length <= START_TIME_INDEX_AFTER_COMMAND || !startTime) {
      throw new ProcessIdentityError(
        pid,
        `unexpected /proc stat field count ${fieldsFromState.length + 2}; expected at least ${START_TIME_FIELD}`,
      );
    }
    return { pid, startTime };
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ESRCH") return undefined;
    if (error instanceof ProcessIdentityError) throw error;
    throw new ProcessIdentityError(pid, error instanceof Error ? error.message : String(error), {
      cause: error,
    });
  }
}

export function currentIdentity() {
  const identity = identityForPid(process.pid);
  if (!identity) throw new Error(`Cannot read process identity for pid ${process.pid}`);
  return identity;
}

export function identityIsLive(record) {
  if (!record || !Number.isSafeInteger(record.pid) || record.pid <= 0) return false;
  if (record.startTime === undefined) {
    try {
      process.kill(record.pid, 0);
      return true;
    } catch (error) {
      return error?.code === "EPERM";
    }
  }
  if (typeof record.startTime !== "string" || record.startTime.length === 0) return false;
  const current = identityForPid(record.pid);
  return current?.startTime === record.startTime;
}
