import { spawnSync } from "node:child_process";

export function listWorkingTreeFiles({
  workspaceRoot = process.cwd(),
  pathspec = "src",
  runGit = spawnSync,
  includeIgnored = false,
  untrackedOnly = false,
} = {}) {
  const commands = untrackedOnly
    ? [["ls-files", "--others", "--exclude-standard", "-z", "--", pathspec]]
    : [
        ["ls-files", "--others", "--exclude-standard", "-z", "--", pathspec],
        ...(includeIgnored
          ? [["ls-files", "--others", "--ignored", "--exclude-standard", "-z", "--", pathspec]]
          : []),
        ["ls-files", "-z", "--", pathspec],
      ];
  const paths = [];

  for (const args of commands) {
    const result = runGit("git", args, { cwd: workspaceRoot, encoding: "utf8" });
    if (result.error || result.status !== 0) {
      const detail =
        result.error?.message ||
        result.stderr?.trim() ||
        `exit status ${result.status ?? "unknown"}`;
      throw new Error(
        `Cannot enumerate working-tree files: git ${args.join(" ")} failed (${detail})`,
      );
    }
    paths.push(...String(result.stdout ?? "").split("\0"));
  }

  return [...new Set(paths.filter(Boolean))];
}
