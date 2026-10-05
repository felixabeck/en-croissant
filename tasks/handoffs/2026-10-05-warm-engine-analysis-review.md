# Plan-review handoff: warm engine analysis — no spinner on every move

Load this file before reviewing a successor of this work. Inherited issue IDs: R1–R11 (all
closed; none deferred, none carried). Plan: `tasks/plans/2026-10-05-warm-engine-analysis.md`
(gitignored); raw lens prompts and reports were preserved under the gitignored
`tasks/plans/.reviews-2026-10-05-warm-engine-analysis/`. Plan written and reviewed (rounds r1–r4)
in an interactive Claude Code session on 2026-10-05 at base
`9cabdb3cd7b492026a4b943dfd4038cac716dc47`; drift round r5 and implementation by Claude Code
session `a2b7ad99-4750-4430-b26c-f280fe05e9e3` (full auto, executor Codex). Codex (OpenAI high
tier) ran every lens. Claude orchestrated and arbitrated, so the context that wrote each plan
revision also arbitrated its triage. No finding governs this work; it came from Felix's report of
2026-10-05.

## Mandate (fixed)

Felix, 2026-10-05 (verbatim):

> I note that when I analyze a file with the engine, that the engine seems very slow. When I click
> on the next move, there's a loading spinner first before the engine shows some values. This is
> only a fraction of a second or maybe a second, but it still feels very heavy and not very small.
> not very smooth, because I expect the engine to immediately switch to the new position and start
> calculating. And not like this, that I see a loading spinner every time I click to a new move.
> That's not how it should be. I know for example that lead chest and there it works very well
> without those loading spinners. So plan this carefully.

Felix's answers in questioning (2026-10-05):

* M-A — gap display: "Keep old lines dimmed" — the previous position's lines stay visible but
  greyed out and not clickable, and get replaced as soon as the new lines arrive. No "Loading…"
  badge, no skeleton, no layout jump. A skeleton appears only if nothing has arrived after about
  1 second (e.g. the very first engine start).
* M-B — revisit: "Yes, remember per position" — each tab remembers the latest lines per position
  (bounded, e.g. last 256 positions, cleared when the tab closes). Revisiting shows them at once;
  the engine restarts on that position and its new lines replace the remembered ones only once
  they reach at least the same depth.

## Planned answer (obligations O1–O6)

* O1 — warm interactive engine per (tab, engine id); reuse on healthy actor with equal
  executable identity and satisfiable resource leases; option-state equivalence; resource
  options compared by handle identity; protocol failure reaps the actor.
* O2 — per-search identity on a warm actor (search generation, per-search
  cancellation/publication barrier, generation-qualified stop never terminates).
* O3 — bounded retention and release triggers; stop/release split shipped with its renderer
  callers.
* O4 — immediate search start, coalescing, failure recovery.
* O5 — per-position line memory (256 LRU per (tab, engine)), replacement by depth, mode-correct
  selection, threat payloads never write the node score.
* O6 — gap display: dimmed inert previous lines, 1000 ms skeleton threshold, one shared hook for
  three readers.

Decisions recorded: `d-20261005-13` (supersedes `d-20260908-03`), `d-20261005-14`,
`d-20261005-15`, `d-20261005-16`.

## Reviews

Executor: Codex (`leaf-launch.sh read-only`, role `review-plan` for review-plan, `sensitive` for the
others — `chess.rs`, `engine/**`, `main.rs`, `generated.ts`, `src/state/**` are sensitive globs).
Raw reports: `$RUN_TMP/lens-<lens>-r<N>.txt` (scratchpad `build-warm-engine/`).

### Round 1 — revision r1 (plan as first written), 12 lenses, 276 s

Verdicts: review-plan REVISE · minimalism APPROVED · correctness REVISE · tests APPROVED (1
should-fix) · error-handling APPROVED (1 should-fix) · chess-semantics REVISE · engine-protocol
REVISE · ipc-contract APPROVED · persisted-state APPROVED · pgn-index NOT APPLICABLE/APPROVED ·
platform-semantics REVISE (1 should-fix) · tauri-security APPROVED.

| ID | Claim | Witnesses (lens#finding) | Evidence checked | Disposition | Authority | Status |
|---|---|---|---|---|---|---|
| R1 | Lens packet lacked revision identity / history / open-issue fields (round 1 must say so explicitly) | plan#1 blocker | `review-lens-contract.md` Inputs | Fix — process: r2 packets carry REVISION, history, open IDs | lens contract | open → r2 |
| R2 | O6 showed skeleton immediately when no previous lines, contradicting M-A's ~1 s | plan#2 blocker, correctness#1 blocker | plan O6 text vs M-A | Fix — O6 second bullet: no skeleton before 1000 ms in any case | M-A | open → r2 |
| R3 | Phase 1 changed qualified stop to keep-warm while release callers moved only in Phase 2 → leaked warm actors between commits | plan#3 blocker | `EvalListener.tsx:75,195,359` | Fix — stop/release split + renderer callers in Phase 1; O3 bullet "ship in the same phase" | async-resource-invariants (owner/cleanup), MANDATE O1 | open → r2 |
| R4 | Retained entries + unconditional threat-first lookup show the other side's PV/arrows after threat off | plan#4 blocker, chess-semantics#1 blocker | `atoms.ts:903-905`, `:950-952` read threat key first | Fix — O5 "Mode-correct selection" + one key-derivation function | M-B (memory must not show wrong-position lines) | open → r2 |
| R5 | New e2e spec would be ignored by per-project `testMatch` | tests#1 should-fix | `playwright.config.ts:35-81` | Fix — Phase 3 file list names the project entry | verification of M-A | open → r2 |
| R6 | Rejected predecessor stop is inherited forever; navigation never reaches a fresh launch | error-handling#1 should-fix | `EvalListener.tsx:75,339,360-365` | Fix — O4 failure-recovery bullet; O1 "failed stop leaves no actor" | MANDATE "immediately switch" (same-area, rule 4b) | open → r2 |
| R7 | Removed option overrides keep their old value on a warm engine (Skill Level example) | engine-protocol#1 blocker | `chess.rs:162-182` sends only listed options | Fix — O1 option-state equivalence (restore default or relaunch) + regression test | MANDATE O1 + engine-lifecycle "cached option belief" | open → r2 |
| R8 | Re-resolving unchanged resource options yields new fd/path values; verification rejects them (Linux fd numbers, macOS pinned paths) | platform-semantics#1 should-fix | `process.rs:2095-2125`, `:3120-3150` (`uci_value` equality) | Fix — O1 compare by handle identity, reuse actor leases; macOS witness | MANDATE O1 | open → r2 |

Adopted plan-level corrections r1: 7 (R2–R8); R1 is a packet fix.

### Round 2 — revision r2, closure round, 9 lenses, 346 s

Verdicts: review-plan REVISE · correctness REVISE · chess-semantics APPROVED · engine-protocol
APPROVED · error-handling APPROVED · tests APPROVED · platform-semantics APPROVED · ipc-contract
APPROVED · persisted-state APPROVED.

Closures: R1 CLOSED (plan) · R3 CLOSED (plan) · R4 CLOSED (plan, chess-semantics) · R5 CLOSED
(plan, tests) · R6 CLOSED (plan, error-handling) · R7 CLOSED (plan, engine-protocol) · R8 CLOSED
(plan, platform-semantics) · R2 CLOSED by correctness, NOT CLOSED by plan (residual below).

| ID | Claim | Witnesses | Evidence checked | Disposition | Authority | Status |
|---|---|---|---|---|---|---|
| R2 (residual) | 1000 ms rule verified only through the hook; rendered first start could still show skeleton | plan r2 blocker | `BestMoves.tsx:286,369` render the skeleton/badge directly | Fix — Phase 3 rendered `BestMoves` fake-timer tests at 999/1000 ms and on position change | M-A | open → r3 |
| R9 (lineage R4) | Kept opposite-mode deletion erases a position's remembered normal entry after a threat toggle | plan r2 blocker | `EvalListener.tsx:270-274` deletes the other mode's key on every accepted payload | Fix — O5: deletion removed, both mode entries coexist in the bound; toggle-restore test | M-B | open → r3 |
| R10 (lineage R4) | O6 dimmed fallback could show threat lines after threat off, contradicting O5 | correctness r2 blocker | threat is not part of the settings fingerprint (`EvalListener.tsx:220-227`); it only changes the searched FEN/moves | Fix — O6 mode-scoped fallback bullet | M-A, M-B | open → r3 |

Adopted plan-level corrections r2: 3 (R2 residual, R9, R10).

### Round 3 — revision r3, closure round, 4 lenses, 207 s

Verdicts: review-plan APPROVED · correctness APPROVED · chess-semantics REVISE · persisted-state
APPROVED.

Closures: R2 residual CLOSED (plan) · R9 CLOSED (plan) · R10 CLOSED (plan, correctness).

| ID | Claim | Witnesses | Evidence checked | Disposition | Authority | Status |
|---|---|---|---|---|---|---|
| R11 (lineage R4/R9) | Threat-mode payloads write the swapped position's score into the current node; with the no-downgrade rule the wrong score sticks after threat off | chess-semantics r3 blocker | `EvalListener.tsx:278-282` calls `setScore` regardless of `threat`; `tree.ts:621` stores it on the current node | Fix — O5: only normal-mode payloads write the node score; Phase 2 test | M-B (remembered values must belong to the position), rule 4b same area | open → r4 |

Adopted plan-level corrections r3: 1 (R11).

### Round 4 — revision r4, closure round, 2 lenses, 152 s

Verdicts: review-plan APPROVED · chess-semantics APPROVED. Closures: R11 CLOSED (plan,
chess-semantics).

### Closure summary

* Latest verdict per lens: review-plan APPROVED (r4) · minimalism APPROVED (r1) · correctness
  APPROVED (r3) · tests APPROVED (r2) · error-handling APPROVED (r2) · chess-semantics APPROVED (r4)
  · engine-protocol APPROVED (r2) · ipc-contract APPROVED (r2) · persisted-state APPROVED (r3) ·
  pgn-index NOT APPLICABLE (r1) · platform-semantics APPROVED (r2) · tauri-security APPROVED (r1).
  Not plan-capable (`plan-review: false`): code-quality, root-cause — they run at diff review.
* Issues: 11 opened (R1–R11), 11 closed, 0 Skip, 0 Defer, 0 carried. Lineages: R9, R10, R11 from R4.
* `plan_adopted_per_round`: r1=7 r2=3 r3=1 r4=0. Active review seconds per round: see round
  headings (r1 276, r2–r4 as recorded).
* Plan BASE for drift checks: `9cabdb3cd7b492026a4b943dfd4038cac716dc47` (HEAD of master when review closed, 2026-10-05).
* Raw lens reports and prompts: `tasks/plans/.reviews-2026-10-05-warm-engine-analysis/`
  (git-ignored copy of the run directory). Copy this `## Reviews` section into the tracked
  `tasks/handoffs/2026-10-05-warm-engine-analysis-review.md` before final gates (rule 12a).
* Post-closure arbiter edit (reference only): P1's probe-script location now names the preserved
  copy under `tasks/plans/.reviews-2026-10-05-warm-engine-analysis/`; no obligation, contract or
  proof changed, so no further lens round.

### Round 5 — drift round at implementation start, 2 lenses (2026-10-05)

Implementing session a2b7ad99-4750-4430-b26c-f280fe05e9e3 (Claude Code, full auto). Plan text
unchanged since r4. `git diff 9cabdb3c..7e22b11b` touched one phase file: `src-tauri/src/main.rs`,
+6 lines in the `blocking_offload_scans` test module (a lichess progress-id source-scan
assertion). Scoped drift round per Felix's order: review-plan (role review-plan) and
review-ipc-contract (owner of `main.rs`, role sensitive), scope "a finding must name a path or
symbol changed in the drift diff and the obligation it invalidates".

Verdicts: review-plan APPROVED (no findings) · ipc-contract APPROVED (no findings). No issue
opened. `plan_adopted_per_round`: r1=7 r2=3 r3=1 r4=0 r5=0.

Autonomous decisions recorded before implementation: entry 1 → `d-20261005-13` (supersedes
`d-20260908-03`, trailer set), entry 2 → `d-20261005-14`, entry 3 → `d-20261005-15`, entry 4 →
`d-20261005-16`.
