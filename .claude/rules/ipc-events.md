---
paths:
  - "src-tauri/src/main.rs"
  - "src-tauri/src/progress.rs"
  - "src-tauri/src/db/search.rs"
  - "src/platform/**"
  - "src/bindings/**"
  - "src-tauri/capabilities/**"
  - "src-tauri/tauri.conf.json"
---

# IPC Event and Command Contract Rule

> **Relevant when working on:** anything that crosses the Rust↔renderer boundary — a
> `#[tauri::command]`, an `emit`, a `listen`, progress reporting, or a capability scope.
>
> *Path-scoped: this file loads automatically when Claude Code touches the paths in the frontmatter
> above, but the rule binds for **any** file that emits or listens — the glob cannot express that.
> Codex and other agents never auto-load it — read it directly, as the rules table in the repo-root
> `CLAUDE.md` instructs.*

## The single rule

**Nothing reaches the renderer except through the Specta registry: every event payload type appears
in `collect_events!` and every command in `collect_commands!` in `src-tauri/src/main.rs`. Progress
is reported through the existing `ProgressEvent` in `src-tauri/src/progress.rs`, never through a new
ad-hoc event. Anything broadcast globally carries an id the receiver filters on.**

## Why

This failure class type-checks on each side independently and fails only at runtime, so "the types
are fine" is never evidence.

* **A bare-string emit carrying another event's payload.** `d09de3c0` — report progress was emitted
  via `app.emit_all` with the download-progress struct and a final value of `progress: 1.0` while
  the renderer expected a percentage. `bc660364` later collapsed the duplicated progress events into
  the single `ProgressEvent` that exists today: `{ id, generation, progress, finished, state,
  cleared }`, with `progress` clamped to `0.0..=100.0` (`src-tauri/src/progress.rs:126`) and updates
  authenticated by a generation-bound lease so a stale id cannot recreate a finished job.
* **Broadcast events without a discriminator.** `daecd674` — `id` was hardcoded `0` on progress
  payloads, so concurrent operations drove each other's progress bars; it became a real `String` id.
* **A capability scope identifier that silently grants nothing.** `bd4edd4d` — `"fs:scope"` was
  replaced by `"fs:scope-appdata-recursive"`; the original identifier did not actually grant
  `$APPDATA`. The opposite failure is `551030cc`, which widened the fs scope to `"**"`. `93acc93c`
  replaced a blanket `http:default` with a host allowlist, and `e001c5f6` shows that allowlist
  rotting (`explorer.lichess.ovh` → `.org`).
* **Listener lifetime.** `aebc490e` — `app.listen_global("stop_engine", …)` never unlistened; the
  fix captures the returned `id` and calls `app.unlisten(id)`.
* **Command signature drift.** `fc7b70f5` — renaming a parameter from `file` to `file_path` changed
  the camelCase invoke key from `file` to `filePath`. Any caller not regenerated breaks only at
  runtime.

## The one known exception, and it is a defect

`search_progress` is emitted by bare string in `src-tauri/src/db/search.rs` (lines 428 and 452) with
its own `progress: f64` payload, and listened to by a hand-written
`listen<ProgressPayload>("search_progress", …)`. It is **not** in `collect_events!`, which today
lists only `BestMovesPayload`, `DatabaseProgress`, `ProgressEvent`, `GameMoveEvent`,
`ClockUpdateEvent`, `GameOverEvent`. Nothing keeps the two sides in agreement. Do not copy this
shape for a new event, and prefer routing this one through `ProgressEvent` if the surrounding code
is being touched anyway.

## What the gates already prove — do not restate it as a rule

`pnpm bindings:check` re-runs the exporter and fails if `src/bindings/generated.ts` differs by a
byte; `pnpm tauri:boundary:check` rejects direct `@tauri-apps/*` imports, raw `listen()` outside
`src/platform/`, `:default`/`:write-all` permissions, renderer `fs:*` authority, and a wildcard CSP.
The unguarded surface is the **Rust emit side** and the agreement between emitter and listener —
that is where attention belongs.

## DO

* Grep the event literal in `src-tauri/src/main.rs` after adding an emit, and confirm the payload
  type is in `collect_events!`.
* Read the listener, not only the emitter: check the struct is the one that event owns, and that
  scale, range and optionality match.
* Pair every `listen`/`listen_global` with an unlisten on the path that ends the subscription, and
  every renderer subscription with an effect cleanup.
* Justify a widened capability glob in the diff — it is a security decision, not a build fix. For a
  *narrowed* or renamed scope, prove the identifier exists and grants what the code now needs.

## DO NOT

* Hand-edit `src/bindings/generated.ts`. Regenerating is `pnpm bindings:generate`; editing the file
  to make a gate pass is always wrong, whether or not it works.
* Add a second progress channel. There is one `ProgressEvent`.
* Rename a command parameter without checking the camelCase invoke key its callers use.

Reviewed by the `review-ipc-contract` lens, which treats a new unregistered event as a blocker.
