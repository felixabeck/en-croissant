import { readFileSync } from "node:fs";

export function identityForPid(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return undefined;
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
    const commandEnd = stat.lastIndexOf(")");
    if (commandEnd < 0) return undefined;
    const fieldsFromState = stat
      .slice(commandEnd + 2)
      .trim()
      .split(/\s+/u);
    const startTime = fieldsFromState[19];
    return startTime ? { pid, startTime } : undefined;
  } catch {
    return undefined;
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
