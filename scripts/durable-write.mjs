import { randomUUID } from "node:crypto";
import {
  closeSync,
  fsyncSync,
  linkSync,
  openSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, basename } from "node:path";
import { fsyncDirectory } from "./fsync-directory.mjs";

function removeTemporary(path) {
  try {
    unlinkSync(path);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

/** Publish a whole durable record, exclusively on creation or atomically on replacement. */
export function durableWrite(
  path,
  contents,
  { exclusive = false, beforePublish = undefined, onPublished = undefined } = {},
) {
  const directory = dirname(path);
  const temporary = join(directory, `.${basename(path)}.tmp-${randomUUID()}`);
  let fd;
  try {
    fd = openSync(temporary, "wx", 0o600);
    writeFileSync(fd, contents, "utf8");
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined;
    beforePublish?.();
    if (exclusive) {
      linkSync(temporary, path);
      onPublished?.();
      unlinkSync(temporary);
    } else {
      renameSync(temporary, path);
      onPublished?.();
    }
    fsyncDirectory(directory);
  } finally {
    if (fd !== undefined) closeSync(fd);
    removeTemporary(temporary);
  }
}
