# Async and Resource Invariants Rule

> **Relevant when working on:** any command, any spawned process or task, any subscription, any
> registry that outlives one call — in Rust and in the renderer alike.
>
> *Not path-scoped: this file has no `paths:` frontmatter because it applies to essentially every
> diff in this repository, the same way `git-ci-workflow.md` does in ChessRiddles. Codex and other
> agents never auto-load it — read it directly, as the rules table in the repo-root `CLAUDE.md`
> instructs.*

## The single rule

**Every asynchronous operation carries an identity, a stale-result or cancellation guard, a
terminal state, an error path, and a cleanup. Every registry that holds a resource has an owner,
per-resource identity, cleanup on *every* exit path, and a bounded retention policy. No
`unwrap`/`expect`/`panic!` on anything that reaches the process from a renderer call, a
user-selected file, a database, an engine, or the network.**

## Why

These three sentences are the distilled result of the backend and frontend audits of 2026-08-09
(107 and 98 execution items). They are stated once here because the two plans that produced them,
`BACKEND_AUDIT_PLAN.md` and `FRONTEND_AUDIT_PLAN.md`, are wave-structured process documents:
their section 1 is the only normative part and the remaining 600+ lines are completed history.
Both files are committed, but working from them means reading a plan to find a rule.

Each clause has a repository incident behind it, catalogued in the review lenses:

* **Identity and stale-result guard** — `4e8d10b0`: an engine result guard compared
  `payload.moves.join(",")`, which silently matches across different move lists. `03826167`:
  results from unloaded engines were still consumed.
* **Cancellation before use** — `06c23b6a`: search cancellation was checked *after* the progress
  emit, dropping in-flight results. A cancel flag checked after the emit is not cancellation.
* **Cleanup on every exit path** — `e5422566`: no `Drop` on `BaseEngine` and no handling of
  `RunEvent::ExitRequested`, so engine children outlived the application (issue #723).
  `aebc490e`: `app.listen_global("stop_engine", …)` never unlistened.
* **Panic-free on untrusted input** — `4e46ed52`: `btoi(...).expect("WhiteElo")` and
  `Fen::from_ascii(...).unwrap()` crashed an entire import on one malformed tag; `d12f43cc` is the
  same class for `Unrated` ratings.

## What this means concretely

* **Renderer state is not authoritative** for native jobs, credentials, files, databases, engines,
  or games. Persist only versioned, schema-validated user state and reconcile it against native
  state at startup.
* **Blocking work stays off the Tokio workers.** Filesystem, compression, parsing, Diesel, Rayon,
  and child-process waits must not monopolise runtime workers, and no lock is held across `.await`.
* **The second approximately similar implementation gets extracted**, and both callers are routed
  through it — one operation type has one facade and one error/loading/cancellation contract. This
  is not a cleanup task for later; it happens in the same change.
* **Do not weaken CSP or capabilities**, and never move a bearer token or raw backend diagnostic
  into the renderer, to preserve an older shortcut.

## DO

* Give every spawn, subscription and job an owner, and name the exit paths it is cleaned up on:
  normal completion, cancel, tab close, resource swap, application exit, error.
* Return typed errors from commands and map them at the facade; fail the one item, not the process.
* Bound anything that accumulates — logs, caches, registries — and say what the bound is.

## DO NOT

* Assume a response belongs to the most recent request because it arrived last. Use a
  discriminator, never timing.
* Add a `unwrap`/`expect` in a renderer-, file-, network-, database- or engine-driven path. A
  provable startup invariant may use one, with an adjacent comment saying why it is provable.
* Leave a spawned process, listener or registry entry whose removal depends on the happy path.
