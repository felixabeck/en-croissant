import { constants, accessSync, existsSync } from "node:fs";
import { delimiter, extname, resolve } from "node:path";

export const DEFAULT_WINDOWS_PATHEXT = ".EXE;.CMD;.BAT;.COM";

const defaultFileSystem = Object.freeze({ existsSync, accessSync });
const absentExecutableErrorCodes = new Set(["ENOENT", "ENOTDIR", "EACCES"]);

function executableNames(name, { platform, pathExt }) {
  if (platform !== "win32") return [name];

  const extensions = (pathExt ?? process.env.PATHEXT ?? DEFAULT_WINDOWS_PATHEXT)
    .split(";")
    .filter(Boolean);
  const candidates = [name];
  if (extname(name) !== "") return candidates;

  for (const extension of extensions) {
    candidates.push(`${name}${extension}`);
    const lowercaseExtension = extension.toLowerCase();
    if (lowercaseExtension !== extension) candidates.push(`${name}${lowercaseExtension}`);
  }

  return [...new Set(candidates)];
}

function isExecutable(path, { fileSystem, platform }) {
  try {
    if (platform !== "win32" && typeof fileSystem.accessSync === "function") {
      fileSystem.accessSync(path, constants.X_OK);
      return true;
    }
    return fileSystem.existsSync(path);
  } catch (error) {
    if (absentExecutableErrorCodes.has(error?.code)) return false;
    throw error;
  }
}

/** Find an executable in PATH and return its absolute path, or undefined when absent. */
export function findExecutableOnPath(
  name,
  {
    pathValue,
    fileSystem = defaultFileSystem,
    cwd = process.cwd(),
    platform = process.platform,
    pathExt,
  } = {},
) {
  if (typeof name !== "string" || name.length === 0) return undefined;
  if (typeof pathValue !== "string" || pathValue.length === 0) return undefined;

  const names = executableNames(name, { platform, pathExt });
  for (const directory of pathValue.split(delimiter)) {
    for (const executableName of names) {
      const candidate = resolve(cwd, directory || ".", executableName);
      if (isExecutable(candidate, { fileSystem, platform })) return candidate;
    }
  }

  return undefined;
}
