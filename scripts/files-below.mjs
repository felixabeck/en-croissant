import { readdir } from "node:fs/promises";
import { resolve } from "node:path";

export async function filesBelow(directory, predicate = () => true) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) return filesBelow(path, predicate);
      return entry.isFile() && predicate(path) ? [path] : [];
    }),
  );
  return files.flat();
}
