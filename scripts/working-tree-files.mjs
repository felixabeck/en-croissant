import { spawnSync } from "node:child_process";

export function listWorkingTreeFiles({
  workspaceRoot = process.cwd(),
  pathspec = "src",
  runGit = spawnSync,
} = {}) {
  const commands = [
    ["ls-files", "--others", "--exclude-standard", "--", pathspec],
    ["ls-files", "--", pathspec],
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
    paths.push(...String(result.stdout ?? "").split("\n"));
  }

  return [...new Set(paths.map((path) => path.trim()).filter(Boolean))];
}
