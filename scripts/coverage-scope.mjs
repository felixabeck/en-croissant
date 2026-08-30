import { relative, resolve, sep } from "node:path";

/**
 * The measurement scope shared by the coverage gate and the coverage report.
 *
 * Both `coverage-report.mjs` and `rust-branch-coverage.mjs` decide which source
 * files are measured from the same `exclude` lists in the *-coverage-areas.json
 * files, so the matching has to live in one place. It did not: the report
 * matched the entries as globs while the Rust gate compared them as exact
 * paths, and they agreed only because every entry happened to be literal. A
 * glob entry matching every `mod.rs` would have been honoured by one and
 * ignored by the other.
 */

export function globToRegExp(pattern) {
  let expression = "";
  for (let index = 0; index < pattern.length; index += 1) {
    if (pattern.slice(index, index + 3) === "**/") {
      expression += "(?:.*/)?";
      index += 2;
    } else if (pattern.slice(index, index + 2) === "**") {
      expression += ".*";
      index += 1;
    } else if (pattern[index] === "*") {
      expression += "[^/]*";
    } else {
      expression += pattern[index].replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${expression}$`);
}

export function matches(path, patterns) {
  return patterns.some((pattern) => globToRegExp(pattern).test(path));
}

/** The `exclude` entries of one source, as plain glob strings. */
export function excludePatterns(source) {
  return source.exclude.map((entry) => (typeof entry === "string" ? entry : entry.pattern));
}

export function excluded(path, source) {
  return matches(path, excludePatterns(source));
}

/** Repo-relative POSIX path — the form every pattern above is written against. */
export function normalisePath(path, root) {
  return relative(root, resolve(root, path)).split(sep).join("/");
}
