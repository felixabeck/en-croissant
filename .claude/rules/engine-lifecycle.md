---
paths:
  - "src-tauri/src/engine/**"
  - "src-tauri/src/chess.rs"
  - "src/components/engines/**"
  - "src/components/panels/analysis/**"
  - "src/components/boards/EvalListener.tsx"
  - "src/utils/engines.ts"
---

# Engine Lifecycle and UCI Protocol Rule

> **Relevant when working on:** spawning, killing or supervising an engine process, aggregating UCI
> `info` lines, caching engine options, or consuming a `best_moves` payload.
>
> *Path-scoped: this file loads automatically when Claude Code touches the paths in the frontmatter
> above. Codex and other agents never auto-load it — read it directly, as the rules table in the
> repo-root `CLAUDE.md` instructs.*

## The single rule

**An engine is identified by its immutable id, never by name or path. Every spawn has an owner and
a kill on every exit path. A `best_moves` payload is used only when the engine id, the tab, the FEN
*and* the searched move list all match and the engine is still loaded.**

## Why

An engine is an external process that emits unsolicited output forever. The consuming code compiles,
type-checks and reads correctly while binding results to the wrong engine or to a position the user
already left. Every incident below is a verified regression here.

* **Identity keyed on a mutable, non-unique field.** `73207410` — the process map was keyed by
  `(tab, engine)`, so two engines sharing a path collapsed into one; it became `(tab, id)`.
  `5b5d006a` carried the same fix through the frontend, replacing name-keyed lookups with ids.
  `ca5f3245` — generated engine ids were never written back, so they did not survive.
* **A stale result attributed to the current position.** `4e8d10b0` — the guard in
  `EvalListener.tsx` compared `payload.moves.join(",")` against the searched moves and was replaced
  by a real deep equality; the join form silently matches across different move lists. `03826167` —
  results from unloaded engines were consumed because `.filter((e) => e.loaded)` was missing.
  `749419f7` — a stale engine object was held after the engine list was edited.
* **Info-line aggregation without a sequence guard.** `067311d1` — duplicated `info` messages were
  pushed unconditionally; the fix accepts a line only when
  `multipv as usize == proc.best_moves.len() + 1`, i.e. exactly the next expected line — live at
  `src-tauri/src/chess.rs:419` and `:771`, each followed by the `real_multipv` check. `143b1817` —
  the comparison used the configured `multipv` instead of `real_multipv`, which is clamped to the
  number of legal moves (`src-tauri/src/chess.rs:134`). `64fad3d6` — scores flagged
  `lowerbound`/`upperbound` were accepted as final results instead of being skipped.
* **Processes without an owner.** `e5422566` — no `Drop` on `BaseEngine`, no handling of
  `RunEvent::ExitRequested`, so engine children outlived the application (issue #723). `1f60af1c`
  added kill-on-tab-close; `0189958b` removed a per-move spawn by reusing the process.
* **Cached option state diverging from the real engine.** `f1896a79` mirrors the engine's options to
  avoid redundant `setoption`; `2d7befb5` gates restarts on an equality check and returns
  `last_best_moves` from cache. Both mean a wrong mirror silently yields stale analysis. `37757834`
  wrote Threads/Hash to a key that was never read back.

## Two engines that must both work

Every change to a lookup, map, React key, atom key or drag id gets checked against both of these:

* two engines with **the same path** (a user copied a binary), and
* two engines with **the same name** (a user renamed one).

If either collapses them into one entry, the key is wrong. A newly generated id is persisted, never
recomputed on the next read.

## DO

* Treat `real_multipv` — not the configured `multipv` option — as the expected line count.
* Exclude `lowerbound`/`upperbound` scores from anything treated as a final evaluation.
* State what resets a cached option belief when the process is replaced or the option is written by
  another path, and prove a cached `last_best_moves` still belongs to the current position.
* Check that stopping one tab's engine cannot kill another tab's.

## DO NOT

* Compare move lists by string-joining or by reference — both give false matches.
* Assume a response is the answer to the most recent `go` because it arrived after it. Results
  arriving after a `stop`, a `go` issued before `readyok`, and a position set between the two are
  all normal.
* Add a spawn without naming its kill for: normal stop, tab close, engine swap, application exit,
  and error.

The cross-cutting half of this rule — ownership, cancellation, cleanup — is
`async-resource-invariants.md`. Whether the event carrying a payload is registered and typed at all
is `ipc-events.md`. Reviewed by the `review-engine-protocol` lens.
