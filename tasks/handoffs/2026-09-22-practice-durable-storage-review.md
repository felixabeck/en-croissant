# Plan review handoff — f-20260906-23, durable native storage for practice decks

**Date:** 2026-09-22 · **Status:** plan closed for review at revision r27, not implemented ·
**Plan file:** `tasks/plans/2026-09-22-practice-durable-storage.md` (git-ignored; this record is the
durable one) · **Executor for every lens:** Codex, `gpt-5.6-luna`.

This is the record rule 12a requires before a parent mandate closes. The plan file carries the full
per-round tables; everything needed to *recover* the run without it is here.

## Mandate

Finding `f-20260906-23`, "Practice positions and review history use unbounded raw localStorage"
(area `frontend-state`, entry `build`), verbatim in the plan's `## Mandate`. Plus one product
decision by Felix, in chat, 2026-09-22: practice data moves to a **native app-data store**, per
machine, migrated from `localStorage`; he rejected a sidecar file beside the PGN and rejected
staying in `localStorage` with a retention cap.

A second question — whether a deck stays keyed per `(file, game)` or becomes one record per file —
was put to him after three rounds read his option text as deciding it. He answered "keep per game,
as today", **and corrected the escalation**: that class of question is technical and is to be
decided in the run, with a lens if needed. Recorded in auto-memory as
`technical-vs-product-decision-boundary`.

## What the plan specifies, in one page

A new `AppOwnedDefaultRoot::Practice` root holds flat leaves per deck, named by SHA-256 over
`"<file_id>\u{0}<game>"`: a positions document, byte-budgeted sealed review-log shards, a migration
state leaf and a lock leaf. Nine Specta commands. The renderer sends `{positions}` and opaque
strings; Rust owns every envelope field and every digest.

* **Nothing is discarded.** The only deletions are the user's own Reset and the user's own repair,
  both behind confirmations that exist today or are added with their own warning.
* **One rating is one command**, idempotent on a renderer-generated `entry_id`, scanning exactly the
  entries whose `rev` exceeds the caller's `base_revision`, always completing the positions write,
  and stopping before it when the shard append reports uncertain durability.
* **Optimistic concurrency** on `revision` **and** `generation`, enforced across processes by an
  advisory file lock (`flock` / `LockFileEx`; `rustix` and `windows-sys` are already dependencies).
* **Migration happens once per deck**, gated on the state leaf, with every legacy entry id and shard
  boundary derived from the legacy content so a retry rewrites byte-identical shards.
* **The legacy `deck-*` key is never deleted** by this change — `localStorage` has no
  compare-and-swap, so a safe deletion is not constructible. `f-20260922-06` carries the deletion
  for a later release.
* **Startup ordering is fixed**: migrate, enumerate, then build the path-owner snapshot as the union
  — get this wrong and a repertoire loses its native authorisation.

Four phases, area-cohesive and dependency-ordered: the native store; the IPC surface plus the
renderer storage module; the atom and its consumers; migration, the startup gate and path-owner
continuity. The finding's closure condition — "real large-deck and reload proof" — is a new
`pnpm verify:app` scenario in `scripts/verify-app.mjs`.

## Review record

**Twenty-six rounds**, ten lenses each (`review-plan` at `--role review-plan`, the rest
`--role sensitive` because the file set hits `src/state/**`, `src-tauri/src/main.rs`,
`src-tauri/src/infra/**` and `src/bindings/generated.ts`). `review-chess-semantics` ran in rounds 1
and 2 and was retired with a recorded reason after it approved r2 and its five findings were filed.

Adopted findings per round: **28, 30, 20, 16, 18, 14, 9, 7, 7, 9, 6, 8, 3, 6, 10, 8, 11, 10, 6, 11,
9, 9, 7, 3, 1, 2.**

Closed at r27 by the arbiter on this record: complete coverage, an explicit disposition for every
issue, and each round's corrections checked by the next round's lenses against the file. `review-plan`
approved r26; the two defects round 26 raised are corrected in r27, which has not itself been through
a lens round — the implementation run reviews the real diff, a stronger check than a twenty-seventh
reading of prose.

### Mechanisms adopted and then withdrawn

Recorded because each looked right when adopted, and two of them were *worse* than what they replaced:

1. **Last-write-wins** → revision check (round 1).
2. **Debounce plus `pagehide` flush** → write-through; the flush cannot await asynchronous IPC.
3. **A logs modal showing only recent entries** → full paging; it was an unmandated product change.
4. **Three orphan-counting mechanisms** — `rev > revision`, then "after `lastEntryId`", then a capped
   id list — all defeated, replaced by an exact count plus an acknowledged-count.
5. **Deleting the legacy browser key**, with its compare-before-remove protocol, read-back gate and
   cross-language digest agreement — five rounds of making a deletion safe that cannot be.
6. **`Extended` migration with a prefix digest** — harmful once the key is retained.
7. **A sentinel removed on completion** → a state leaf that outlives every other leaf.
8. **A generation bump at the `u32` ceiling** (round 23) → withdrawn in round 24: reads address the
   current generation by design, so it would have made every earlier shard unreadable.
9. **A repair that wrote a fresh positions document** (round 24) → withdrawn in round 25: the
   migration gate reads that as "already has this deck", suppressing the import the repair existed to
   enable.
10. **A repair that deleted the state leaf** (round 25) → corrected in round 27: it resurrected
    history a Reset had discarded. The leaf now survives as `phase: "reset"`.

### Limits carried into implementation as recorded `Skip`s

* **The `u32` rating ceiling per deck** — 4.29 billion ratings; the escape is a Reset that discards
  that deck's log. Stated rather than engineered away, because the one attempt to engineer it away
  made retained history unreadable.
* **Pre-upgrade-instance races** — a second, older build of the application can write a `deck-*` key
  in windows no renderer-side check can close. Bounded, named in the plan's *Risks*, and the reason
  `f-20260922-06` exists.
* **The last unacknowledged rating on window close** — `entry_id` makes a repeat harmless.

### Filed rather than folded in

| Finding | What |
|---|---|
| `f-20260922-02` | `syncDeck` keeps a card's stale full FEN, so an exact `findFen` lookup drops the card and hides its history |
| `f-20260922-03` | The practice logs modal numbers every move from the wrong side and keys its cards by a repeating FEN |
| `f-20260922-04` | Three tree-mutation paths leave the practice path and the custom start FEN stale — reported, not re-measured |
| `f-20260922-06` | The migrated `deck-*` browser keys are left in place and need a later deletion pass |
| `f-20260922-07` | The application has no single-instance guard, so two instances share one app-data directory |

## For the successor

Load this record and the plan file before doing anything. The plan is frozen; implement it, and if a
phase cannot be built as written, report the deviation rather than re-planning — twenty-six rounds
of review stand behind the wording, and several of the sentences that read like fussiness are
scar tissue from a mechanism that was measurably wrong.

This file is **uncommitted** on purpose: another session held the repository's build lock for the
whole of this run, and an inert Markdown file left dirty is what its push contract permits. Commit it
with the implementation.
