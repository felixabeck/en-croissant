import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * True when the module at `importMetaUrl` is the script Node was started with.
 *
 * Compare native paths, not URL strings. `import.meta.url` is percent-encoded
 * (`probe%20dir`), while `file://` + `process.argv[1]` is not, so every gate
 * script that guarded its `main` with that template silently skipped it on a
 * checkout path containing a space and exited green having checked nothing
 * (measured 2026-09-05). Node absolutises `argv[1]`; `resolve` keeps a caller
 * who passes a relative path honest.
 */
export function isEntrypoint(importMetaUrl, argv = process.argv) {
  const script = argv[1];
  if (!script) return false;
  return fileURLToPath(importMetaUrl) === resolve(script);
}
