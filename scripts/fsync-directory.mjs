import { closeSync, fsyncSync, openSync } from "node:fs";

export function fsyncDirectory(directoryPath) {
  const fd = openSync(directoryPath, "r");
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}
