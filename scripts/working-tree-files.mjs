import { spawnSync } from "node:child_process";

export function listWorkingTreeFiles({
  workspaceRoot = process.cwd(),
  pathspec = "src",
  runGit = spawnSync,
  includeIgnored = false,
  directories = false,
} = {}) {
  const directoryArgs = directories ? ["--directory"] : [];
  const nulArgs = directories ? ["-z"] : [];
  const separator = directories ? "\0" : "\n";
  const commands = [
    {
      args: [
        "ls-files",
        "--others",
        ...directoryArgs,
        "--exclude-standard",
        ...nulArgs,
        "--",
        pathspec,
      ],
      separator,
    },
    { args: ["ls-files", ...nulArgs, "--", pathspec], separator },
  ];
  if (includeIgnored) {
    commands.splice(1, 0, {
      args: [
        "ls-files",
        "--others",
        "--ignored",
        "--exclude-standard",
        ...directoryArgs,
        ...nulArgs,
        "--",
        pathspec,
      ],
      separator,
    });
  }
  const paths = [];

  for (const { args, separator: outputSeparator } of commands) {
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
    paths.push(...String(result.stdout ?? "").split(outputSeparator));
  }

  return [...new Set(paths.map((path) => path.trim()).filter(Boolean))];
}
