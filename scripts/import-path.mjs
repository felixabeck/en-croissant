import { posix } from "node:path";

/** Map supported local import spellings to a repository-relative base path. */
export function importSpecifierBasePath(
  importingPath,
  specifier,
  { allowSourceRoot = false, allowAnyDotRelative = false } = {},
) {
  if (typeof specifier !== "string") return undefined;
  if (specifier.startsWith("@/")) {
    return posix.normalize(`src/${specifier.slice(2)}`);
  }
  if (
    (allowAnyDotRelative && specifier.startsWith(".")) ||
    specifier.startsWith("./") ||
    specifier.startsWith("../")
  ) {
    return posix.normalize(posix.join(posix.dirname(importingPath), specifier));
  }
  if (allowSourceRoot && specifier.startsWith("src/")) {
    return posix.normalize(specifier);
  }
  return undefined;
}
