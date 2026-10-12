# Reviewed plan handoff: f-20261001-09

Owner: the drain adopting session. Load this complete history before drift review, implementation or cumulative diff review. The planner leaves the finding open and makes no source commit.

Plan: 2026-10-10-database-resizable-preview.md
Metadata: plan-meta.json
BASE: 86305a389c9acbef03af6489a6761f7e0e2ca157 (r1 to r3)
NEW-BASE: d3a6f614f30269faf0faf566963ace264c39a66b (PLAN-REFRESH r4 to r6, drain session a25e3e07-447c-4203-96d2-7e253b0a51ab)
Executor: Codex, resolved by leaf-launch.sh role routing. Review-plan used review-plan. Every other lens used sensitive because the preference state and later dependency patch are sensitive paths. No native-agent fallback or retries occurred.

Plan authorship and arbitration shared one root context. Detection ran in fresh leaf contexts on the same model family as prospective implementation. This is a limitation of review independence.

The final design reuses fixed two-tile Mosaic with keyboard alternatives, shares one validated bounded percentage preference across database tabs, derives a font-aware compact stack without overwriting that preference, and opts the database game card into adaptive square-board sizing while preserving Files. Its existing Mosaic dependency needs the reviewed lifecycle patch for release, unmount and touch cancellation. The r4 to r6 refresh reconciled drift that added a viewport-keyed compact mode, a stacked compact preview, GameCard selection/open states and font-scaled database proof: one container-derived compact decision now replaces the viewport query in every database consumer, and the proof covers the font-scaled-breakpoints project and the intermediate viewport/container band. One cohesive sensitive implementation phase owns the layout and its proof. Autonomous decisions and their reversal paths remain in the plan for the adopter to record.

## Frozen mandate

### The database Games view splits list and preview 50/50 with no resize, so the preview board can never be larger than a quarter of the window width

* **ID:** f-20261001-09 · **Status:** open · **Area:** frontend-ui · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src/components/databases/GridLayout.tsx` (`<Group grow>` with two equal columns, no splitter), `src/components/databases/GamePreview.tsx:60` (`boardSide = min(frameHeight, frameWidth / 2)` when controls are shown, so the board takes at most half of the preview column), used by `GameTable.tsx`, `PlayerTable.tsx`, `TournamentTable.tsx`.
* **Defect:** Felix (2026-10-01, 2000px-wide window) wanted a bigger board while browsing "Meine Partien" and found no way to enlarge it: the table and the preview are fixed halves and the board is capped at half of its half. The analysis tab already offers resizable panes (`BoardsPage.tsx`, `react-mosaic-component`), so the database view is the odd one out.
* **Fix shape:** a draggable divider between table and preview (persisted width, bounded min/max), and a preview layout that lets the board grow into available height (stack notation under the board when the column is tall rather than always beside it). Reuse whatever splitter primitive the app already ships rather than adding a second one. Pixels via `pnpm test:e2e:container`; check the 320px / 200% font-scale case (`f-20260829-02`).
* **Open question:** which splitter primitive the database view adopts (reuse of the analysis tab's mosaic or a lighter divider), how its width is persisted, and how the preview arranges board and notation when the column is tall versus wide.
* **Why `build`:** layout design with persistence and three consumers of `GridLayout`.
* **Related:** the open-affordance finding filed in the same session (same pages, different files); `f-20260829-02` (narrow-layout clipping).
* **Found by:** Felix, session e3bd1021-4d34-443f-96c0-a1af650f0984, 2026-10-01.

## Reviews

Plan authorship and arbitration share one root context. Detection ran in fresh Codex leaf contexts on the same model family as prospective code. No source implementation exists in this run. Raw reports and prompts remain unchanged in RUN_TMP. The review handoff will copy their complete text for adoption.

### Round 1: full plan-capable set

All twelve required leaves completed. Raw verdicts: review-plan REVISE, all other lenses APPROVED. Chess semantics, engine protocol, IPC contract, PGN index, platform semantics and Tauri security returned NOT APPLICABLE. Their reasons match the unchanged chess/native/security boundaries. Correctness reported an implementation-evidence limitation, not a finding. It remains an explicit verification limit.

* **I1 — Mosaic release and removal leave throttled movement pending.** Witness: review-plan, round 1, raw finding 1, blocker, confidence 95. **Disposition:** Fix. **Authority:** the draggable persisted split and frozen ordinary drag/reflow threat model. **Evidence:** installed 6.1.1 src/Split.tsx releases without cancelling its throttle and unmounts without cancelling it. The shipped lib/Split.js has the same mechanism. A scratch probe against that actual shipped class recorded `[["change",30],["release",60],["change",40]]`, and on separate unmount recorded `Cannot read properties of null (reading 'parentElement')`. The DOM geometry was a minimal fixture and this was not a browser proof. **Correction revision:** r2 adds Terminal ownership of Mosaic drag updates and extends its affected-consumer proof. **Dependencies:** Shared bounded database split and One validated preference across database tabs. **Closure:** awaiting review-plan and newly affected correctness, error handling, persisted-state, tests and minimalism in round 2.

Round metrics: one unique issue opened, zero resolved, one substantive plan-level adoption. No withdrawals, rewrites or splits. No carried items. Timing is recorded in the metadata/handoff after the round boundary. Downstream implementation and diff-review rework are not yet observable.

### Round 2: terminal correction and affected domains

All six selected leaves completed. Raw verdicts: review-plan REVISE, correctness, error handling, minimalism, tests and persisted-state APPROVED. The tests report nevertheless contains a should-fix and is triaged independently of its verdict. Review-plan, correctness, error handling and persisted-state explicitly closed I1 at plan level. I1 is resolved in revision r2, with implementation proof still pending.

* **I2 — Analysis regression projects do not exercise divider dragging.** Witness: review-tests, round 2, raw finding 1, should-fix, confidence 95. **Disposition:** Fix. **Authority:** correctness proof for the same primitive reused by the mandated splitter. **Evidence:** BoardsPage.test.tsx mocks Mosaic to null. Neither workspace-tabs.spec.ts nor board-keyboard.spec.ts contains a divider drag. BoardsPage's analysis tree has both a row split and a nested column split, saved to windowsState. **Correction revision:** r3 strengthens the terminal obligation's existing analysis-preservation proof with actual drags, pane dimensions, persisted percentages and reload. **Dependencies:** I1, Terminal ownership of Mosaic drag updates. **Closure:** pending review-plan and review-tests in round 3.
* **I3 — Still-mounted touch cancellation leaves the drag owner active.** Witness: review-plan, round 2, raw finding 1, blocker, confidence 93. **Disposition:** Fix. **Authority:** the frozen ordinary touch-drag threat model and the mandated draggable persisted split. **Evidence:** actual installed Split binds movement, mouseup and touchend but no touchcancel. A second runtime probe recorded four document listeners remaining after cancellation, then `[["change",30],["change",40],["change",45],["release",60]]` after unrelated movement/release. Its DOM/event dispatch is a minimal fixture, not browser proof. **Correction revision:** r3 extends the existing terminal cleanup with touchcancel, no commit on interruption, no stale document updates, and new-gesture recovery. It does not add a public API. **Dependencies:** I1, Terminal ownership of Mosaic drag updates and One validated preference across database tabs. **Closure:** pending review-plan and newly affected correctness, error handling, persisted-state and tests in round 3.

Round metrics: I1 resolved, two unique new issues opened and two substantive plan-level adoptions. Cumulative three opened, one resolved, two open. I2 and I3 are coverage/lifecycle gaps exposed by I1's adopted dependency patch, not a rewrite or a split. No withdrawals or carried items. Downstream rework remains unobservable.

### Round 3: touch cancellation and direct analysis proof

All five selected leaves completed with raw verdict APPROVED and no findings. Review-plan explicitly closed I2 and I3 against revision r3. Review-tests explicitly closed both proof obligations. Correctness, error handling and persisted-state explicitly closed I3 and its release-only database persistence dependency. These closures approve the plan, not an implementation.

I2 and I3 are resolved at r3. Cumulative totals: three unique issues opened, three resolved, zero open. Plan-level adoptions are r1=1 r2=2 r3=0. Twenty-three lens reports completed across three rounds. No Skip, Defer or carried lens findings. No withdrawals, rewrites, splits or inherited rounds. I3's underlying missing touchcancel path predates this plan, while its required ownership contract was exposed by I1. No code or tests were implemented and downstream rework remains unknown.

The final metadata and reviews-handoff.md record measured wall durations, the complete raw reports and source/probe evidence. No quota, dependency or release wait occurred during review. Ordinary leaf execution and polling count as review elapsed. Active time separated from that elapsed time is unknown.

### Round 4: PLAN-REFRESH drift round (BASE 86305a38 → NEW-BASE d3a6f614)

Refresh of the published r3 plan after 266 commits (217 files) of drift. The drift touched the plan's own files: GridLayout.tsx, GridLayout.module.css, GamePreview.tsx, GameCard.tsx, DatabaseView.tsx, FileCard.tsx, BoardsPage.tsx, e2e/fixtures.ts, e2e/database-files.spec.ts, e2e/workspace-tabs.spec.ts and translations. All twelve REFRESH-LENSES ran on the unchanged r3 text with the drift diff `drift-86305a38…-d3a6f614….diff` and a scoped excerpt `tasks/plans/.drift-scope-r4.diff`. Wall elapsed 945 s.

Raw verdicts: all twelve APPROVED. Engine protocol, IPC contract, PGN index, platform semantics and Tauri security returned NOT APPLICABLE with reasons matching the unchanged native boundaries. Review-plan, correctness, error handling, minimalism, persisted-state and tests returned no drift finding. Chess semantics reported one finding under `OUT OF DRIFT SCOPE`.

* **I4 — Preview tree identity ignores the starting FEN.** Witness: review-chess-semantics, round 4, raw finding 1, blocker, confidence 95. **Disposition:** Defer. **Reason:** outside the drift scope and outside MANDATE. It predates both bases and concerns which game the preview shows, not pane size or arrangement. **Evidence:** `GamePreview.tsx:58` mounts `<GamePreview key={pgn} …>` while the parse key is `[pgn, headers?.fen]`, and `TreeStateContext.tsx:31` creates the store only once, so a changed `initial` is ignored. Filed to the spool (`findings-inbox/20261012-181930-2629656-1791821970814007967-6.md`, status `published`). **Dependencies:** none. The adaptive obligation keeps its rule that arrangement changes never remount the tree.

Arbiter drift reconciliation (no lens witness, so no issue ID). Reading the drift against the plan showed three premises the r3 text predates. First, e95a864d introduced a second compact signal, a font-scaled viewport media query evaluated separately in DatabaseView and GamePreview. The plan's container-derived compact decision would otherwise coexist with it, and in the band where the container is below the split floors but the viewport is above 36em, stacked panes would sit in a non-scrolling view. That breaks the reachability MANDATE names ("check the 320px / 200% font-scale case") and the bounded split. Second, the new `font-scaled-breakpoints` database 320px/200% assertions and `database-game-open-320-200` snapshot were outside the phase proof and snapshot-update command. Third, GameCard's no-selection state, `OpenGameButton` and the preview's `EphemeralTabScope` are new structure the adaptive layout must keep. **Revision r5:** refresh premises appended to Traced premises, one compact decision replacing the viewport query in every database consumer, the stacked preview named as the adaptive compact case below TreeStateProvider and EphemeralTabScope, GameCard states kept, and the font-scaled-breakpoints project added to Phase 1 paths, proof and snapshot update. **Authority:** MANDATE "check the 320px / 200% font-scale case" and "Reuse whatever splitter primitive the app already ships rather than adding a second one" (one mechanism per concept, universal rule 11), plus the frozen threat model's ordinary window resizing. No new component, watcher, state file or dependency. **Closure:** review-plan and the affected correctness, tests, minimalism and chess-semantics lenses in round 5.

Round metrics: one unique issue opened (I4, Defer), zero plan-level adoptions from lens findings. Cumulative four opened, three resolved by Fix, one deferred, zero open. No withdrawals, rewrites or splits.

### Round 5: drift reconciliation closure

All five selected leaves completed (wall elapsed 213 s). Raw verdicts: review-plan APPROVED, correctness APPROVED, minimalism APPROVED, chess-semantics APPROVED, tests REVISE. Review-plan, correctness, minimalism and chess-semantics each explicitly closed R4-A against revision r5. Tests reported R4-A not closed for one proof gap.

* **I5 — The compact-decision unification has no regression case in the band where viewport and container disagree.** Witnesses: review-tests, round 5, raw findings 1 (R4-A NOT CLOSED, blocker, confidence 94) and 2 (blocker, confidence 94). **Disposition:** Fix. **Authority:** MANDATE "check the 320px / 200% font-scale case" and the r5 one-compact-decision obligation. Proof only, no new mechanism. **Evidence:** the r5 Phase 1 required-assertion list covered 2000px growth, bounds, saved ratio, compact transitions and 320px/200% reachability, but no viewport above the scaled 36em breakpoint with a container below the two 20rem floors and the divider. Reverting DatabaseView to `useScaledMaxWidth` (`DatabaseView.tsx:26`) would pass every listed assertion while stacked panes sit in a non-scrolling view there. **Correction revision:** r6 adds a populated intermediate case asserting splitter absence, view-level vertical scroll reachability of table, board, notation and controls, and no document horizontal overflow. **Dependencies:** R4-A, Shared bounded database split. **Closure:** review-plan and review-tests in round 6.

Round metrics: one unique issue opened (I5), one plan-level adoption. Cumulative five opened, three resolved, one deferred, one open.

### Round 6: intermediate-band proof closure

Both selected leaves completed (wall elapsed 173 s) with raw verdict APPROVED and no findings. Review-plan explicitly closed I5 against revision r6 and confirmed R4-A remains closed. Review-tests explicitly closed I5: keeping DatabaseView's viewport query would omit the `.view[data-compact]` scroll rule and fail the new intermediate case. These closures approve the plan, not an implementation.

Refresh totals (r4 to r6): two unique issues opened (I4 Defer, I5 Fix closed at r6), one arbiter drift reconciliation (R4-A, closed at r5 by four lenses and at r6 by review-plan). Plan-level adoptions r4=0 r5=1 r6=0. Cumulative lineage r1=1 r2=2 r3=0 r4=0 r5=1 r6=0: five unique issues opened, four resolved by Fix, one deferred and filed, zero open. Forty-two lens reports across six rounds. No withdrawals, rewrites, splits or carried items. No quota, dependency or release wait occurred. Ordinary leaf execution and polling count as review elapsed. Active time separated from elapsed time is unknown. Downstream implementation rework remains unknown.

### Measured round history

| Round | Lenses | Wall seconds | Adopted | Unique opened | Resolved | Open after arbitration |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 12 | 282.875 | 1 | 1 | 0 | 1 |
| 2 | 6 | 238.486 | 2 | 2 | 1 | 2 |
| 3 | 5 | 170.045 | 0 | 0 | 2 | 0 |
| 4 (drift) | 12 | 945.0 | 0 | 1 (I4 Defer) | 0 | 0 |
| 5 | 5 | 213.0 | 1 | 1 (I5) | 0 | 1 |
| 6 | 2 | 173.0 | 0 | 0 | 1 | 0 |

Counts are adoptions, not raw rank counts. Through r3: three unique issues, three resolved and zero open. After the r4 to r6 refresh: five unique issues, four resolved by Fix, one deferred and filed (I4), zero open. The r4 arbiter drift reconciliation R4-A has no lens witness and no issue ID. It was closed at r5 by review-plan, correctness, minimalism and chess-semantics, and confirmed at r6 by review-plan. Round 4 wall time includes waiting on the slowest of twelve parallel leaves. No inherited rounds, withdrawal, rewrite, split or carried issue. There were no known quota, dependency, release or other non-overlapping idle waits. Leaf execution, polling and arbitration belong to measured review elapsed. Separately measured active time is unknown. Downstream implementation/final-review rework remains unknown.

### Complete raw reports

These report bodies are copied programmatically without changing their text or raw verdict. The tests lens's r2 APPROVED verdict coexists with its should-fix finding. I2 was adopted and closed independently of that verdict. All round-1 NOT APPLICABLE reasons were checked against the frozen boundaries. The correctness r1 implementation-evidence limitation persists through plan approval.

#### review-correctness — r1

Source lens: /home/felixb/.claude/agents/review-correctness.md

Raw artifact: /tmp/drain-plan-chessfable-0a459a4f-slot1/build/lens-correctness-r1.txt

```text
No correctness defects identified in the proposed contracts.

Limitation (confidence: 100): This plan-only review cannot verify final geometry, compact-transition position retention, or transient/onRelease synchronization. Those require implementation evidence.

VERDICT: APPROVED
```

#### review-error-handling — r1

Source lens: /home/felixb/.claude/agents/review-error-handling.md

Raw artifact: /tmp/drain-plan-chessfable-0a459a4f-slot1/build/lens-error-handling-r1.txt

```text
VERDICT: APPROVED
```

#### review-minimalism — r1

Source lens: /home/felixb/.claude/agents/review-minimalism.md

Raw artifact: /tmp/drain-plan-chessfable-0a459a4f-slot1/build/lens-minimalism-r1.txt

```text
VERDICT: APPROVED
```

#### review-plan — r1

Source lens: /home/felixb/.claude/agents/review-plan.md

Raw artifact: /tmp/drain-plan-chessfable-0a459a4f-slot1/build/lens-plan-r1.txt

```text
[blocker] tasks/plans/.plan-2026-10-10-database-resizable-preview-r1.body.md:62 — Mosaic’s `onRelease` is not a terminal drag boundary. Installed `/home/felixb/Projekte/chessfable/node_modules/react-mosaic-component/src/Split.tsx:103` releases without cancelling its throttled update at line 116. Lodash enables trailing execution (`/home/felixb/Projekte/chessfable/node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/throttle.js:51`). A queued movement can therefore overwrite the displayed ratio after its release value was saved. Removing the splitter during a compact transition also leaves that callback pending because `Split.tsx:55` never cancels it, and it subsequently dereferences the cleared element ref at line 125. The plan needs a lifecycle correction and proof covering pending movement across release and removal. The acceptance cases at plan line 113 do not require either timing case. (confidence: 95)

Limitation: this was source-only inspection. Runtime drag timing and pixel behavior were not exercised under the assignment’s restrictions. (confidence: 100)

VERDICT: REVISE
```

#### review-tests — r1

Source lens: /home/felixb/.claude/agents/review-tests.md

Raw artifact: /tmp/drain-plan-chessfable-0a459a4f-slot1/build/lens-tests-r1.txt

```text
VERDICT: APPROVED
```

#### review-chess-semantics — r1

Source lens: /home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-1/wt/.claude/agents/review-chess-semantics.md

Raw artifact: /tmp/drain-plan-chessfable-0a459a4f-slot1/build/lens-chess-semantics-r1.txt

```text
NOT APPLICABLE: The three obligations cover pane geometry, layout preference persistence and adaptive preview sizing. They preserve existing tree ownership and navigation without proposing changes to positions, move paths, chess rules or tree metadata.
VERDICT: APPROVED
```

#### review-engine-protocol — r1

Source lens: /home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-1/wt/.claude/agents/review-engine-protocol.md

Raw artifact: /tmp/drain-plan-chessfable-0a459a4f-slot1/build/lens-engine-protocol-r1.txt

```text
NOT APPLICABLE: The listed files and three Approach obligations cover database pane layout, preference persistence and preview geometry. They introduce no engine process, UCI protocol or asynchronous engine result routing changes.

VERDICT: APPROVED
```

#### review-ipc-contract — r1

Source lens: /home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-1/wt/.claude/agents/review-ipc-contract.md

Raw artifact: /tmp/drain-plan-chessfable-0a459a4f-slot1/build/lens-ipc-contract-r1.txt

```text
NOT APPLICABLE: The three obligations cover renderer layout, local preference storage and preview geometry. The planned files introduce no Rust↔renderer event, command, payload, native resource or capability change. Rust/IPC and generated bindings are explicitly excluded.
VERDICT: APPROVED
```

#### review-persisted-state — r1

Source lens: /home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-1/wt/.claude/agents/review-persisted-state.md

Raw artifact: /tmp/drain-plan-chessfable-0a459a4f-slot1/build/lens-persisted-state-r1.txt

```text
VERDICT: APPROVED
```

#### review-pgn-index — r1

Source lens: /home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-1/wt/.claude/agents/review-pgn-index.md

Raw artifact: /tmp/drain-plan-chessfable-0a459a4f-slot1/build/lens-pgn-index-r1.txt

```text
NOT APPLICABLE: The files and three Approach obligations cover UI layout, preference storage and preview sizing. They introduce no PGN scanning, byte indexing, move encoding, database storage or search changes.
VERDICT: APPROVED
```

#### review-platform-semantics — r1

Source lens: /home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-1/wt/.claude/agents/review-platform-semantics.md

Raw artifact: /tmp/drain-plan-chessfable-0a459a4f-slot1/build/lens-platform-semantics-r1.txt

```text
NOT APPLICABLE: The three obligations cover renderer layout, localStorage preferences and preview geometry. They introduce no OS-specific path, handle, ABI, filesystem, `cfg` or native behavior within this lens.
VERDICT: APPROVED
```

#### review-tauri-security — r1

Source lens: /home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-1/wt/.claude/agents/review-tauri-security.md

Raw artifact: /tmp/drain-plan-chessfable-0a459a4f-slot1/build/lens-tauri-security-r1.txt

```text
NOT APPLICABLE: The files and three Approach obligations concern renderer layout, board geometry and a public numeric preference. They introduce no credential/session, filesystem authority, signed-download or backend-data boundary changes.

VERDICT: APPROVED
```

#### review-correctness — r2

Source lens: /home/felixb/.claude/agents/review-correctness.md

Raw artifact: /tmp/drain-plan-chessfable-0a459a4f-slot1/build/lens-correctness-r2.txt

```text
I1 CLOSED — At plan level, the revised obligation cancels queued movement before release and unmount, removes touchstart from its owning element, and requires the final controlled and persisted ratios to agree. Runtime implementation proof remains pending.

VERDICT: APPROVED
```

#### review-error-handling — r2

Source lens: /home/felixb/.claude/agents/review-error-handling.md

Raw artifact: /tmp/drain-plan-chessfable-0a459a4f-slot1/build/lens-error-handling-r2.txt

```text
I1 CLOSED — The revised obligation cancels pending throttle work before release and on unmount, preventing the traced cleared-ref exception and stale updates. It requires final displayed and persisted ratios to agree, preserves the committed preference on interruption, and mandates actual-runtime regression proof.

VERDICT: APPROVED
```

#### review-minimalism — r2

Source lens: /home/felixb/.claude/agents/review-minimalism.md

Raw artifact: /tmp/drain-plan-chessfable-0a459a4f-slot1/build/lens-minimalism-r2.txt

```text
VERDICT: APPROVED
```

#### review-plan — r2

Source lens: /home/felixb/.claude/agents/review-plan.md

Raw artifact: /tmp/drain-plan-chessfable-0a459a4f-slot1/build/lens-plan-r2.txt

```text
I1 CLOSED — r2’s terminal obligation at tasks/plans/.plan-2026-10-10-database-resizable-preview-r2.body.md:60 addresses the reviewed release/unmount throttle mechanism in `/home/felixb/Projekte/chessfable/node_modules/react-mosaic-component/lib/Split.js:58`, with explicit runtime patching and timer proof at plan lines 62–64. This closes the plan defect, not implementation verification.

[blocker] tasks/plans/.plan-2026-10-10-database-resizable-preview-r2.body.md:60 — Terminal ownership omits ordinary touch cancellation. `/home/felixb/Projekte/chessfable/node_modules/react-mosaic-component/lib/Split.js:92` binds document movement and release listeners but no `touchcancel` handler. A cancelled gesture while the view remains mounted therefore leaves pending throttle work and listeners active. Later mouse movement changes the split, and an unrelated mouseup commits it. Cancellation only at release/unmount leaves this broken foundation intact, while the proof at plan line 64 exercises neither this terminal path nor its stale-write consequence. Require cancellation without committing and real-runtime proof that subsequent movement/release cannot update the cancelled owner (confidence: 93).

VERDICT: REVISE
```

#### review-tests — r2

Source lens: /home/felixb/.claude/agents/review-tests.md

Raw artifact: /tmp/drain-plan-chessfable-0a459a4f-slot1/build/lens-tests-r2.txt

```text
[should-fix] tasks/plans/.plan-2026-10-10-database-resizable-preview-r2.body.md:64 — The named analysis regression projects never drag a Mosaic divider, and BoardsPage.test.tsx:266 mocks Mosaic to null. They cannot prove preserved analysis resizing after the shared dependency patch. A regression in document event binding or nested splitter geometry could pass these suites. Name an analysis drag assertion that checks the resulting pane size and saved layout. (confidence: 95)

VERDICT: APPROVED
```

#### review-persisted-state — r2

Source lens: /home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-1/wt/.claude/agents/review-persisted-state.md

Raw artifact: /tmp/drain-plan-chessfable-0a459a4f-slot1/build/lens-persisted-state-r2.txt

```text
I1 CLOSED — At plan level, r2 requires cancellation before release and on unmount, agreement between displayed and saved final ratios, retention of the last committed preference after interruption, and real-package timer proof against stale writes.

VERDICT: APPROVED
```

#### review-correctness — r3

Source lens: /home/felixb/.claude/agents/review-correctness.md

Raw artifact: /tmp/drain-plan-chessfable-0a459a4f-slot1/build/lens-correctness-r3.txt

```text
I3 CLOSED — The revised terminal obligation cancels throttled movement, removes all document drag listeners, suppresses release and persistence after cancellation, and permits a new gesture. This agrees with the database’s release-only persistence contract. Closure is at plan level, with implementation proof pending.

VERDICT: APPROVED
```

#### review-error-handling — r3

Source lens: /home/felixb/.claude/agents/review-error-handling.md

Raw artifact: /tmp/drain-plan-chessfable-0a459a4f-slot1/build/lens-error-handling-r3.txt

```text
I3 CLOSED — The revised terminal obligation requires cancelling queued movement, detaching all document drag listeners, suppressing release and persistence after touchcancel, retaining the committed preference, and allowing a new gesture. Its actual-runtime proof covers stale movement and release after cancellation.

VERDICT: APPROVED
```

#### review-plan — r3

Source lens: /home/felixb/.claude/agents/review-plan.md

Raw artifact: /tmp/drain-plan-chessfable-0a459a4f-slot1/build/lens-plan-r3.txt

```text
I2 CLOSED — Final r3, tasks/plans/.plan-2026-10-10-database-resizable-preview-r3.body.md:66 requires real row and nested-column drags, pane dimensions, saved percentages and reload restoration. These match src/components/tabs/BoardsPage.tsx:468, src/state/layoutStorage.ts:61 and e2e/fixtures.ts:277.

I3 CLOSED — Final r3, tasks/plans/.plan-2026-10-10-database-resizable-preview-r3.body.md:62 specifies mounted cancellation cleanup, no unfinished commit and new-gesture recovery. Line 66 requires actual-runtime stale-update proof against the listener/throttle mechanism in /home/felixb/Projekte/chessfable/node_modules/react-mosaic-component/lib/Split.js:58. Closure is at plan level. Implementation verification remains pending.

VERDICT: APPROVED
```

#### review-tests — r3

Source lens: /home/felixb/.claude/agents/review-tests.md

Raw artifact: /tmp/drain-plan-chessfable-0a459a4f-slot1/build/lens-tests-r3.txt

```text
I2 CLOSED — Plan line 66 requires actual analysis row and nested column drags, changed pane dimensions, saved windowsState percentages and reload restoration. Phase 1 explicitly runs the workspace-tabs project.

I3 CLOSED — Proposed runtime proof queues movement before still-mounted touchcancel, advances timers, then asserts unrelated document movement/release cannot change or save the split. It also requires a working new gesture. Reverting cancellation cleanup would fail these assertions.

VERDICT: APPROVED
```

#### review-persisted-state — r3

Source lens: /home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-1/wt/.claude/agents/review-persisted-state.md

Raw artifact: /tmp/drain-plan-chessfable-0a459a4f-slot1/build/lens-persisted-state-r3.txt

```text
I3 CLOSED — The revised terminal obligation cancels queued movement and document listeners on touchcancel, suppresses release and persistence, retains the committed preference, and requires stale-write and new-gesture proof using the actual patched runtime. Closure is at plan level, with implementation proof pending.
VERDICT: APPROVED
```

### Source and probe evidence

I1 source: Mosaic 6.1.1 src/Split.tsx:103 releases without cancelling throttledUpdatePercentage at 116. Its componentWillUnmount at 55 also omits cancellation. Lodash 4.17.21 throttle enables trailing execution. The shipped lib/Split.js has the same runtime mechanism. The actual installed class was exercised with minimal DOM geometry and real timers by RUN_TMP/mosaic-lifecycle-probe.cjs. Observed: `[["change",30],["release",60],["change",40]]`. Separate unmount observed `Cannot read properties of null (reading 'parentElement')`. This is runtime mechanism evidence, not browser proof.

I2 source: src/components/tabs/BoardsPage.test.tsx mocks Mosaic to null. Neither e2e/workspace-tabs.spec.ts nor e2e/board-keyboard.spec.ts contains a divider drag. BoardsPage.tsx analysis rendering uses windowsState.currentNode with row and nested-column splits. src/state/layoutStorage.ts validates and saves that tree through createZodStorage. The r3 obligation adds the missing direct consumer proof at the existing container level.

I3 source: installed lib/Split.js binds document mousemove, touchmove, mouseup and touchend, with no touchcancel. RUN_TMP/mosaic-touchcancel-probe.cjs exercised the actual class against a minimal event-listener fixture and real timers. Observed listeners after cancellation: `["mousemove","touchmove","mouseup","touchend"]`. Observed later events: `[["change",30],["change",40],["change",45],["release",60]]`. The r3 obligation adds cancellation and stale-write proof without a new public API. This source defect predates the change and became necessary to resolve for the introduced touch-drag owner.

### Separately filed Locate observations

These were not raw lens findings and therefore are not extra issue IDs in plan-meta.json. They do not change the frozen f-20261001-09 mandate. No guessed ledger ID is assigned. The shared inbox already contains the independent GameCard deletion-failure entry from another planner, so it was not duplicated.

Tournament pagination publication: /home/felixb/Projekte/chessfable/tasks/findings-inbox/20261010-010322-1599304-1791587002480594316-6.md

ArrowDown page-boundary publication: /home/felixb/Projekte/chessfable/tasks/findings-inbox/20261010-010437-1673949-1791587077378473927-6.md

Both session-free status probes returned published. Ordinary drain inbox merge owns allocation and pickup. No manual transfer through Felix is required.

### Refresh-filed finding

I4 (review-chess-semantics r4 #1, out of drift scope): the game preview is keyed by movetext alone. Publication: /home/felixb/Projekte/chessfable/tasks/findings-inbox/20261012-181930-2629656-1791821970814007967-6.md. The session-free status probe returned published. Its exact filed bytes are the I4 `entry` in plan-meta.json. Ordinary drain inbox merge owns allocation and pickup. No manual transfer through Felix is required.

### Adoption boundary and remaining proof

No implementation, phase proof, pixel verification, dependency installation, server, commit or push ran. Worktree dependencies are absent. The original observation and source trace justify the plan, not a verified UI claim. The adopter must perform ordinary volatile preflight checks and follow the exact Phase 1 proof, cumulative diff review, verify-ui and full affected gates. Preserve this review history in the tracked adopting handoff before closure, as required by build. No finding status or decision ledger is changed here.

The final plan body matches the r6 reviewed snapshot, confirmed by plan-review-delta.py returning exit 3 with UNCHANGED after only append-only review history was added. Raw r4 to r6 report bodies are not pasted here: the publisher appends them under Evidence from the hash-indexed mirror. The r4 to r6 review-evidence self-check against the live mirror returned validated with 42 rows. Head and clean-tree checks, review-evidence validation and read-only ledger check are recorded in RUN_TMP/validation.json before final reporting.


## Evidence

### Manifest

[
  {
    "artefact": "lens-chess-semantics-r1.jsonl",
    "findings": [],
    "lens": "chess-semantics",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-chess-semantics-r1.prompt",
    "report": "lens-chess-semantics-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-correctness-r1.jsonl",
    "findings": [],
    "lens": "correctness",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-correctness-r1.prompt",
    "report": "lens-correctness-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-correctness-r2.jsonl",
    "findings": [],
    "lens": "correctness",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-correctness-r2.prompt",
    "report": "lens-correctness-r2.txt",
    "round": 2,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-correctness-r3.jsonl",
    "findings": [],
    "lens": "correctness",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-correctness-r3.prompt",
    "report": "lens-correctness-r3.txt",
    "round": 3,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-engine-protocol-r1.jsonl",
    "findings": [],
    "lens": "engine-protocol",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-engine-protocol-r1.prompt",
    "report": "lens-engine-protocol-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-error-handling-r1.jsonl",
    "findings": [],
    "lens": "error-handling",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-error-handling-r1.prompt",
    "report": "lens-error-handling-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-error-handling-r2.jsonl",
    "findings": [],
    "lens": "error-handling",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-error-handling-r2.prompt",
    "report": "lens-error-handling-r2.txt",
    "round": 2,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-error-handling-r3.jsonl",
    "findings": [],
    "lens": "error-handling",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-error-handling-r3.prompt",
    "report": "lens-error-handling-r3.txt",
    "round": 3,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-ipc-contract-r1.jsonl",
    "findings": [],
    "lens": "ipc-contract",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-ipc-contract-r1.prompt",
    "report": "lens-ipc-contract-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-minimalism-r1.jsonl",
    "findings": [],
    "lens": "minimalism",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-minimalism-r1.prompt",
    "report": "lens-minimalism-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-minimalism-r2.jsonl",
    "findings": [],
    "lens": "minimalism",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-minimalism-r2.prompt",
    "report": "lens-minimalism-r2.txt",
    "round": 2,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-persisted-state-r1.jsonl",
    "findings": [],
    "lens": "persisted-state",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-persisted-state-r1.prompt",
    "report": "lens-persisted-state-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-persisted-state-r2.jsonl",
    "findings": [],
    "lens": "persisted-state",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-persisted-state-r2.prompt",
    "report": "lens-persisted-state-r2.txt",
    "round": 2,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-persisted-state-r3.jsonl",
    "findings": [],
    "lens": "persisted-state",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-persisted-state-r3.prompt",
    "report": "lens-persisted-state-r3.txt",
    "round": 3,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-pgn-index-r1.jsonl",
    "findings": [],
    "lens": "pgn-index",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-pgn-index-r1.prompt",
    "report": "lens-pgn-index-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-plan-r1.jsonl",
    "findings": [
      {
        "kind": "blocker",
        "text": "tasks/plans/.plan-2026-10-10-database-resizable-preview-r1.body.md:62 — Mosaic’s `onRelease` is not a terminal drag boundary. Installed `/home/felixb/Projekte/chessfable/node_modules/react-mosaic-component/src/Split.tsx:103` releases without cancelling its throttled update at line 116. Lodash enables trailing execution (`/home/felixb/Projekte/chessfable/node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/throttle.js:51`). A queued movement can therefore overwrite the displayed ratio after its release value was saved. Removing the splitter during a compact transition also leaves that callback pending because `Split.tsx:55` never cancels it, and it subsequently dereferences the cleared element ref at line 125. The plan needs a lifecycle correction and proof covering pending movement across release and removal. The acceptance cases at plan line 113 do not require either timing case. (confidence: 95)"
      }
    ],
    "lens": "plan",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-plan-r1.prompt",
    "report": "lens-plan-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "REVISE"
  },
  {
    "artefact": "lens-plan-r2.jsonl",
    "findings": [
      {
        "kind": "blocker",
        "text": "tasks/plans/.plan-2026-10-10-database-resizable-preview-r2.body.md:60 — Terminal ownership omits ordinary touch cancellation. `/home/felixb/Projekte/chessfable/node_modules/react-mosaic-component/lib/Split.js:92` binds document movement and release listeners but no `touchcancel` handler. A cancelled gesture while the view remains mounted therefore leaves pending throttle work and listeners active. Later mouse movement changes the split, and an unrelated mouseup commits it. Cancellation only at release/unmount leaves this broken foundation intact, while the proof at plan line 64 exercises neither this terminal path nor its stale-write consequence. Require cancellation without committing and real-runtime proof that subsequent movement/release cannot update the cancelled owner (confidence: 93)."
      }
    ],
    "lens": "plan",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-plan-r2.prompt",
    "report": "lens-plan-r2.txt",
    "round": 2,
    "terminal": "completed",
    "verdict": "REVISE"
  },
  {
    "artefact": "lens-plan-r3.jsonl",
    "findings": [],
    "lens": "plan",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-plan-r3.prompt",
    "report": "lens-plan-r3.txt",
    "round": 3,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-platform-semantics-r1.jsonl",
    "findings": [],
    "lens": "platform-semantics",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-platform-semantics-r1.prompt",
    "report": "lens-platform-semantics-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-tauri-security-r1.jsonl",
    "findings": [],
    "lens": "tauri-security",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tauri-security-r1.prompt",
    "report": "lens-tauri-security-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-tests-r1.jsonl",
    "findings": [],
    "lens": "tests",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tests-r1.prompt",
    "report": "lens-tests-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-tests-r2.jsonl",
    "findings": [
      {
        "kind": "should-fix",
        "text": "tasks/plans/.plan-2026-10-10-database-resizable-preview-r2.body.md:64 — The named analysis regression projects never drag a Mosaic divider, and BoardsPage.test.tsx:266 mocks Mosaic to null. They cannot prove preserved analysis resizing after the shared dependency patch. A regression in document event binding or nested splitter geometry could pass these suites. Name an analysis drag assertion that checks the resulting pane size and saved layout. (confidence: 95)"
      }
    ],
    "lens": "tests",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tests-r2.prompt",
    "report": "lens-tests-r2.txt",
    "round": 2,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-tests-r3.jsonl",
    "findings": [],
    "lens": "tests",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tests-r3.prompt",
    "report": "lens-tests-r3.txt",
    "round": 3,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-chess-semantics-r4.jsonl",
    "findings": [
      {
        "kind": "blocker",
        "text": "src/components/databases/GamePreview.tsx:58 — Preview identity omits the starting FEN. After caching two games with identical movetext `1. e4 *`, switching between them preserves the previous tree because `key={pgn}` remains unchanged and TreeStateProvider consumes `initial` only at creation. Use the standard starting FEN for one game and `rnbqkbnr/pppppppp/8/8/8/8/1PPPPPPP/RNBQKBNR w KQkq - 0 1` for the other. Switching back to the cached standard game leaves its a2 pawn missing. This predates the drift and does not invalidate a plan obligation. (confidence: 95)"
      }
    ],
    "lens": "chess-semantics",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-chess-semantics-r4.prompt",
    "report": "lens-chess-semantics-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-chess-semantics-r5.jsonl",
    "findings": [],
    "lens": "chess-semantics",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-chess-semantics-r5.prompt",
    "report": "lens-chess-semantics-r5.txt",
    "round": 5,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-correctness-r4.jsonl",
    "findings": [],
    "lens": "correctness",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-correctness-r4.prompt",
    "report": "lens-correctness-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-correctness-r5.jsonl",
    "findings": [],
    "lens": "correctness",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-correctness-r5.prompt",
    "report": "lens-correctness-r5.txt",
    "round": 5,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-engine-protocol-r4.jsonl",
    "findings": [],
    "lens": "engine-protocol",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-engine-protocol-r4.prompt",
    "report": "lens-engine-protocol-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-error-handling-r4.jsonl",
    "findings": [],
    "lens": "error-handling",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-error-handling-r4.prompt",
    "report": "lens-error-handling-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-ipc-contract-r4.jsonl",
    "findings": [],
    "lens": "ipc-contract",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-ipc-contract-r4.prompt",
    "report": "lens-ipc-contract-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-minimalism-r4.jsonl",
    "findings": [],
    "lens": "minimalism",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-minimalism-r4.prompt",
    "report": "lens-minimalism-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-minimalism-r5.jsonl",
    "findings": [],
    "lens": "minimalism",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-minimalism-r5.prompt",
    "report": "lens-minimalism-r5.txt",
    "round": 5,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-persisted-state-r4.jsonl",
    "findings": [],
    "lens": "persisted-state",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-persisted-state-r4.prompt",
    "report": "lens-persisted-state-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-pgn-index-r4.jsonl",
    "findings": [],
    "lens": "pgn-index",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-pgn-index-r4.prompt",
    "report": "lens-pgn-index-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-plan-r4.jsonl",
    "findings": [],
    "lens": "plan",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-plan-r4.prompt",
    "report": "lens-plan-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-plan-r5.jsonl",
    "findings": [],
    "lens": "plan",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-plan-r5.prompt",
    "report": "lens-plan-r5.txt",
    "round": 5,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-plan-r6.jsonl",
    "findings": [],
    "lens": "plan",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-plan-r6.prompt",
    "report": "lens-plan-r6.txt",
    "round": 6,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-platform-semantics-r4.jsonl",
    "findings": [],
    "lens": "platform-semantics",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-platform-semantics-r4.prompt",
    "report": "lens-platform-semantics-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-tauri-security-r4.jsonl",
    "findings": [],
    "lens": "tauri-security",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tauri-security-r4.prompt",
    "report": "lens-tauri-security-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-tests-r4.jsonl",
    "findings": [],
    "lens": "tests",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tests-r4.prompt",
    "report": "lens-tests-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-tests-r5.jsonl",
    "findings": [
      {
        "kind": "blocker",
        "text": "R4-A NOT CLOSED — the revised mechanism is specified, but its container-versus-viewport disagreement case has no required regression assertion (confidence: 94)."
      },
      {
        "kind": "blocker",
        "text": "tasks/plans/.plan-2026-10-10-database-resizable-preview-r5.body.md:137 — The “Shared bounded database split” obligation at line 59 requires DatabaseView, GridLayout and GamePreview to share one compact decision. The proposed proof does not require exercising a viewport above the old scaled 36em breakpoint while the container cannot fit both pane floors. Restoring DatabaseView’s viewport query could pass the required 320px reachability, wide-board and saved-ratio assertions while leaving stacked panes inside a non-scrolling view in that intermediate band. Require populated container interaction proof there that asserts splitter absence and scroll reachability of the complete preview and controls. That assertion would fail on this partial revert (confidence: 94)."
      }
    ],
    "lens": "tests",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tests-r5.prompt",
    "report": "lens-tests-r5.txt",
    "round": 5,
    "terminal": "completed",
    "verdict": "REVISE"
  },
  {
    "artefact": "lens-tests-r6.jsonl",
    "findings": [],
    "lens": "tests",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tests-r6.prompt",
    "report": "lens-tests-r6.txt",
    "round": 6,
    "terminal": "completed",
    "verdict": "APPROVED"
  }
]

### Issues

[
  {
    "claim": "Mosaic onRelease and unmount do not cancel pending throttled movement, allowing stale layout updates after the saved final ratio and a cleared-ref exception after removal.",
    "closed_round": 2,
    "correction": "Revision r2 adds Terminal ownership of Mosaic drag updates. A reproducible patch of the locked runtime cancels pending movement before release and on unmount, removes the element-owned touchstart listener correctly, makes final controlled and persisted ratios agree, and requires actual-package timing and affected-consumer proof.",
    "dependencies": [],
    "disposition": "Fix",
    "id": "I1",
    "witnesses": [
      {
        "index": 1,
        "lens": "plan",
        "round": 1
      }
    ]
  },
  {
    "claim": "The named analysis regression suites do not drag a Mosaic divider and BoardsPage component tests mock Mosaic away, so they cannot prove preserved analysis resizing after the shared patch.",
    "closed_round": 3,
    "correction": "Revision r3 requires a real analysis root-row and nested-column drag in e2e/workspace-tabs.spec.ts with resulting pane dimensions, persisted windowsState percentages and restoration through preserveStorageForReload.",
    "dependencies": [
      "I1"
    ],
    "disposition": "Fix",
    "id": "I2",
    "witnesses": [
      {
        "index": 1,
        "lens": "tests",
        "round": 2
      }
    ]
  },
  {
    "claim": "Ordinary touch cancellation on a still-mounted Split leaves queued movement and document listeners active, allowing unrelated later movement and release to update and commit the cancelled drag.",
    "closed_round": 3,
    "correction": "Revision r3 extends the existing Split owner with touchcancel cleanup, cancelling pending work and detaching document listeners without release or persistence. Actual-runtime proof exercises stale movement/release after cancellation and successful new-gesture recovery. No new public cancellation API is introduced.",
    "dependencies": [
      "I1"
    ],
    "disposition": "Fix",
    "id": "I3",
    "witnesses": [
      {
        "index": 1,
        "lens": "plan",
        "round": 2
      }
    ]
  },
  {
    "claim": "The game preview is keyed by movetext alone and TreeStateProvider consumes its initial tree once, so selecting another game with identical movetext but a different start FEN or headers keeps the previous game's tree.",
    "dependencies": [],
    "disposition": "Defer",
    "entry": "### The database and Files game preview keys its tree by movetext alone, so selecting another game with identical moves keeps the previous game's start position and headers\n\n* **ID:** f-PENDING · **Status:** open · **Area:** chess-tree · **Root:** - · **Entry:** lens · **Blocked:** none\n* **Filed from:** a25e3e07-447c-4203-96d2-7e253b0a51ab\n* **Where:** `src/components/databases/GamePreview.tsx:58` (`<GamePreview key={pgn} game={parsedGame} …/>`), `src/components/common/TreeStateContext.tsx:31` (`createTreeStore(id, initial, treeKey)` runs only while `storeRef.current === null`, so a changed `initial` is ignored). Callers: `src/components/databases/GameCard.tsx:66` (database Games preview, passes `headers={game}`) and `src/components/files/FileCard.tsx:142` (Files preview).\n* **Defect:** `GamePreviewWrapper` parses with the SWR key `[pgn, headers?.fen]`, but mounts the preview keyed by `pgn` only. Two games whose movetext is identical (for example both `1. e4 *`, or two short games) but whose start FEN or headers differ reuse the same `TreeStateProvider`, which consumed its `initial` tree on first mount. The preview then shows the earlier game's position, start FEN, orientation and headers for the newly selected game.\n* **Failure scenario:** a database holds game A with the standard start and `1. e4 *`, and game B with `[FEN \"rnbqkbnr/pppppppp/8/8/8/8/1PPPPPPP/RNBQKBNR w KQkq - 0 1\"]` and `1. e4 *`. Select A, then B: the preview still shows A's tree with the a2 pawn present. Select A again after B was cached first: A's preview is missing the a2 pawn.\n* **Impact class:** behaviour\n* **Fix shape:** key the preview by the parsed game's identity — at least the movetext plus the start FEN, or the SWR request key / a database game id where one exists — so a different game always creates a fresh tree store. Keep the existing rule that a layout change alone never remounts the tree. Add a component test selecting two games with equal movetext and different start FEN, asserting the board and position after each switch.\n* **Spotted outside diff:** reported by the review-chess-semantics lens (r4 drift round, out of drift scope) during the f-20261001-09 plan refresh. Predates the drift between 86305a38 and d3a6f614. Confirmed by reading `GamePreview.tsx:58` and `TreeStateContext.tsx:31`.\n* **Related:** f-20261001-09 (resizable database preview, same component, different defect; its plan must not remount the tree on arrangement changes).\n* **Found by:** review-chess-semantics lens, drain session a25e3e07-447c-4203-96d2-7e253b0a51ab, 2026-10-12.\n",
    "id": "I4",
    "reason": "Outside the r4 drift scope and outside MANDATE: it predates both bases and concerns which game the preview shows, not pane size or arrangement. Confirmed at GamePreview.tsx:58 and TreeStateContext.tsx:31, filed to the spool and status-probed published.",
    "witnesses": [
      {
        "index": 1,
        "lens": "chess-semantics",
        "round": 4
      }
    ]
  },
  {
    "claim": "The r5 one-compact-decision obligation has no required regression case for a viewport above the old scaled COMPACT_DATABASE_WIDTH_EM breakpoint while the content container cannot fit both pane floors, so a partial revert to the viewport query would pass every listed assertion.",
    "closed_round": 6,
    "correction": "Revision r6 adds a populated intermediate case to Phase 1's required assertions: no splitter, and the complete table, preview board, notation and controls reachable through the view's own vertical scroll without document-level horizontal overflow.",
    "dependencies": [],
    "disposition": "Fix",
    "id": "I5",
    "witnesses": [
      {
        "index": 1,
        "lens": "tests",
        "round": 5
      },
      {
        "index": 2,
        "lens": "tests",
        "round": 5
      }
    ]
  }
]

### lens-chess-semantics-r1.txt

(identical text already appears above in this handoff)

### lens-chess-semantics-r4.txt

OUT OF DRIFT SCOPE

[blocker] src/components/databases/GamePreview.tsx:58 — Preview identity omits the starting FEN. After caching two games with identical movetext `1. e4 *`, switching between them preserves the previous tree because `key={pgn}` remains unchanged and TreeStateProvider consumes `initial` only at creation. Use the standard starting FEN for one game and `rnbqkbnr/pppppppp/8/8/8/8/1PPPPPPP/RNBQKBNR w KQkq - 0 1` for the other. Switching back to the cached standard game leaves its a2 pawn missing. This predates the drift and does not invalidate a plan obligation. (confidence: 95)

VERDICT: APPROVED
### lens-chess-semantics-r5.txt

R4-A CLOSED — Plan lines 59, 93–95 and 131–139 require one container-derived compact decision, preserve TreeStateProvider and EphemeralTabScope across arrangement changes, and include font-scaled database proof with snapshot updates restricted to database expectations. No new chess-domain violation found in the complete delta or its dependent obligations.

VERDICT: APPROVED
### lens-correctness-r1.txt

(identical text already appears above in this handoff)

### lens-correctness-r2.txt

(identical text already appears above in this handoff)

### lens-correctness-r3.txt

(identical text already appears above in this handoff)

### lens-correctness-r4.txt

(identical text already appears above in this handoff)

### lens-correctness-r5.txt

R4-A CLOSED — The delta requires one container-derived compact decision across DatabaseView, GridLayout and GamePreview, includes font-scaled-breakpoints proof with database-only snapshot updates, and preserves arrangement state below TreeStateProvider and EphemeralTabScope plus GameCard’s selection/open states. These obligations match the inspected drift boundaries (confidence: 95). Implementation and runtime correctness remain unverified in this plan-only review.

VERDICT: APPROVED
### lens-engine-protocol-r1.txt

(identical text already appears above in this handoff)

### lens-engine-protocol-r4.txt

NOT APPLICABLE: The four plan obligations cover pane resizing, Mosaic drag ownership, layout preferences and preview geometry. Engine-related drift does not bear on these obligations or the proposed files.
VERDICT: APPROVED
### lens-error-handling-r1.txt

(identical text already appears above in this handoff)

### lens-error-handling-r2.txt

(identical text already appears above in this handoff)

### lens-error-handling-r3.txt

(identical text already appears above in this handoff)

### lens-error-handling-r4.txt

(identical text already appears above in this handoff)

### lens-ipc-contract-r1.txt

(identical text already appears above in this handoff)

### lens-ipc-contract-r4.txt

NOT APPLICABLE: The four plan obligations concern renderer layout, Mosaic drag ownership, preference storage and preview geometry. IPC drift does not alter those contracts, and the plan excludes Rust, events, commands, generated bindings and capability changes.
VERDICT: APPROVED
### lens-minimalism-r1.txt

(identical text already appears above in this handoff)

### lens-minimalism-r2.txt

(identical text already appears above in this handoff)

### lens-minimalism-r4.txt

(identical text already appears above in this handoff)

### lens-minimalism-r5.txt

R4-A CLOSED — r5 lines 58–59 require one container-derived compact decision across all database consumers. Lines 93–95 preserve provider ownership and reuse the stacked preview. Lines 131–139 include font-scaled database proof and restrict snapshot updates. These corrections introduce no bloat, duplication or mandate expansion.

VERDICT: APPROVED
### lens-persisted-state-r1.txt

(identical text already appears above in this handoff)

### lens-persisted-state-r2.txt

(identical text already appears above in this handoff)

### lens-persisted-state-r3.txt

(identical text already appears above in this handoff)

### lens-persisted-state-r4.txt

(identical text already appears above in this handoff)

### lens-pgn-index-r1.txt

(identical text already appears above in this handoff)

### lens-pgn-index-r4.txt

NOT APPLICABLE: The four plan obligations cover pane layout, Mosaic drag ownership, layout preference storage and preview geometry. PGN scanning and indexing drift does not invalidate those obligations, and import/search semantics are explicit non-goals.
VERDICT: APPROVED
### lens-plan-r1.txt

(identical text already appears above in this handoff)

### lens-plan-r2.txt

(identical text already appears above in this handoff)

### lens-plan-r3.txt

(identical text already appears above in this handoff)

### lens-plan-r4.txt

(identical text already appears above in this handoff)

### lens-plan-r5.txt

R4-A CLOSED — Final r5, `tasks/plans/.plan-2026-10-10-database-resizable-preview-r5.body.md:59`, replaces both viewport decisions (`DatabaseView.tsx:26`, `GamePreview.tsx:67`) with one container-derived compact decision governing scrolling, splitter presence and preview arrangement. Plan lines 93–95 preserve the existing tree/tab scopes (`GamePreview.tsx:76`) and GameCard states (`GameCard.tsx:34`, `GameCard.tsx:62`). Lines 131, 135 and 139 include the font-scaled spec, project and database-only snapshot updates, matching `playwright.config.ts:70` and `e2e/font-scaled-breakpoints.spec.ts:46`. Closure is at plan level. Implementation and runtime proof remain pending.

VERDICT: APPROVED
### lens-plan-r6.txt

I5 CLOSED — r6 `tasks/plans/.plan-2026-10-10-database-resizable-preview-r6.body.md:137` requires the populated viewport/container disagreement case and view-owned scrolling. It would reject retaining `DatabaseView.tsx:26`’s viewport query because `GridLayout.module.css:37` enables scrolling only with `data-compact` (confidence: 95).

R4-A remains CLOSED — plan lines 59 and 99 unify compact decisions while preserving GameCard actions and preview scope ownership. The r6 delta strengthens verification without changing that mechanism. Closure is at plan level, with implementation proof pending (confidence: 95).

VERDICT: APPROVED
### lens-platform-semantics-r1.txt

(identical text already appears above in this handoff)

### lens-platform-semantics-r4.txt

NOT APPLICABLE: The drift affecting the four plan obligations concerns renderer layout, tab ownership and frontend proof. It introduces no relevant OS-specific path, handle, ABI, filesystem or `cfg` mechanism. Native Rust drift does not bear on this plan.

VERDICT: APPROVED
### lens-tauri-security-r1.txt

(identical text already appears above in this handoff)

### lens-tauri-security-r4.txt

NOT APPLICABLE: The four plan obligations cover renderer layout, Mosaic drag cleanup, numeric preferences and preview geometry. Native security drift does not affect those obligations or introduce credential, filesystem, signed-download or sensitive backend-data flows into the plan.
VERDICT: APPROVED
### lens-tests-r1.txt

(identical text already appears above in this handoff)

### lens-tests-r2.txt

(identical text already appears above in this handoff)

### lens-tests-r3.txt

(identical text already appears above in this handoff)

### lens-tests-r4.txt

(identical text already appears above in this handoff)

### lens-tests-r5.txt

[blocker] R4-A NOT CLOSED — the revised mechanism is specified, but its container-versus-viewport disagreement case has no required regression assertion (confidence: 94).

[blocker] tasks/plans/.plan-2026-10-10-database-resizable-preview-r5.body.md:137 — The “Shared bounded database split” obligation at line 59 requires DatabaseView, GridLayout and GamePreview to share one compact decision. The proposed proof does not require exercising a viewport above the old scaled 36em breakpoint while the container cannot fit both pane floors. Restoring DatabaseView’s viewport query could pass the required 320px reachability, wide-board and saved-ratio assertions while leaving stacked panes inside a non-scrolling view in that intermediate band. Require populated container interaction proof there that asserts splitter absence and scroll reachability of the complete preview and controls. That assertion would fail on this partial revert (confidence: 94).

VERDICT: REVISE
### lens-tests-r6.txt

I5 CLOSED — PLAN:136 now requires a populated intermediate-width container case with no splitter and complete content reachable through the view’s own vertical scroll. Keeping DatabaseView’s old viewport query would omit the `.view[data-compact]` scroll rule and fail that assertion. The proof command includes both database e2e projects. This closes the plan-level gap, with execution still pending.

VERDICT: APPROVED
### plan-r1.md

# Plan: Resizable database panes and adaptive game preview

## Goal

Resolve f-20261001-09 by letting users enlarge the selected preview in Games, Players and Tournaments, with a saved bounded split and a board that uses the space available to it. Preserve Files preview behavior and reachability at 320px with 200% font scaling.

## MANDATE

### The database Games view splits list and preview 50/50 with no resize, so the preview board can never be larger than a quarter of the window width

* **ID:** f-20261001-09 · **Status:** open · **Area:** frontend-ui · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src/components/databases/GridLayout.tsx` (`<Group grow>` with two equal columns, no splitter), `src/components/databases/GamePreview.tsx:60` (`boardSide = min(frameHeight, frameWidth / 2)` when controls are shown, so the board takes at most half of the preview column), used by `GameTable.tsx`, `PlayerTable.tsx`, `TournamentTable.tsx`.
* **Defect:** Felix (2026-10-01, 2000px-wide window) wanted a bigger board while browsing "Meine Partien" and found no way to enlarge it: the table and the preview are fixed halves and the board is capped at half of its half. The analysis tab already offers resizable panes (`BoardsPage.tsx`, `react-mosaic-component`), so the database view is the odd one out.
* **Fix shape:** a draggable divider between table and preview (persisted width, bounded min/max), and a preview layout that lets the board grow into available height (stack notation under the board when the column is tall rather than always beside it). Reuse whatever splitter primitive the app already ships rather than adding a second one. Pixels via `pnpm test:e2e:container`; check the 320px / 200% font-scale case (`f-20260829-02`).
* **Open question:** which splitter primitive the database view adopts (reuse of the analysis tab's mosaic or a lighter divider), how its width is persisted, and how the preview arranges board and notation when the column is tall versus wide.
* **Why `build`:** layout design with persistence and three consumers of `GridLayout`.
* **Related:** the open-affordance finding filed in the same session (same pages, different files); `f-20260829-02` (narrow-layout clipping).
* **Found by:** Felix, session e3bd1021-4d34-443f-96c0-a1af650f0984, 2026-10-01.

## Threat model and non-goals

The inputs are ordinary window resizing, mouse/touch dragging, keyboard use, persisted preferences that may be missing or corrupted, and storage operations that may throw. The UI must remain usable after those failures. No adversarial layout input, remote protocol, filesystem privilege or native window boundary changes are proposed. The supported renderer proof is the pinned container Playwright harness, including its Tauri command mocks. Native GTK chrome remains outside that harness and this mandate.

This is the f-20261001-09 singleton slice. Opening a game directly, merging libraries, comment rendering, deletion semantics, table paging and analysis-pane management are independent mandates. No new dependency, service, watcher or alternative draggable splitter is authorized.

## Traced premises

These premises record the BASE source trace, not implementation obligations.

* BASE is `86305a389c9acbef03af6489a6761f7e0e2ca157`. The worktree was clean. Read-only `findings.py next --pin f-20261001-09 --json` selected this singleton at build tier. The splitter, persistence and adaptive-layout choices remain unsettled by existing decisions, so build remains the correct entry.
* `GridLayout.tsx:20` owns both database columns. Its three consumers are `GameTable.tsx`, `PlayerTable.tsx` and `TournamentTable.tsx`. `DatabaseView.tsx:51` bounds their tab panels inside the available desktop content area.
* `GameCard.tsx:38` places metadata, actions and preview inside a full-height ScrollArea. It does not opt into `GamePreview`'s fitHeight branch. The finding's cited explicit half-width formula therefore currently applies to Files, while the database's growing Group still allocates equal board and notation columns. Both structures constrain the database board.
* `GamePreview.tsx:60` measures a square in fitHeight mode. `GamePreview.tsx:80` owns OpeningName, board, notation and controls under one TreeStateProvider. `FileCard.tsx:164` is the other production consumer and already depends on fitHeight and hideControls. `GamePreview.test.tsx:285` and `e2e/files-preview.spec.ts:48` cover that contract.
* `BoardsPage.tsx:372` uses the installed `react-mosaic-component` and imports its stylesheet plus `src/styles/react-mosaic.css`. Its editable layout and `windowsState` preference are specific to analysis and are not a database layout model.
* The locked and installed Mosaic version is 6.1.1. Its public controlled Mosaic supports onChange, onRelease, fixed row splits, symmetric minimumPaneSizePercentage and disabled resize. Its internal Split is not a public keyboard-accessible separator. This was traced in the matching installed package under the main checkout, because this plan-only worktree has no node_modules.
* `src/state/utils.ts:19` exports createZodStorage with caught read, repair, write and remove failures and redacted reporting. Decision d-20260906-13 retains raw JSON for ordinary preferences. `layoutStorage.ts` validates a different domain, the three analysis pane IDs, and cannot be reused as the database preference schema.
* `e2e/fixtures.ts:277` provides preserveStorageForReload. The database-files project currently uses an 800px viewport at 200% font scale and empty database tab responses. The Files preview project uses 1920px at 100%. Existing clipping assertions and screenshots provide regression infrastructure but no populated database board or splitter evidence yet.
* The existing GameCard deletion failure is already pending in the shared inbox. Locate separately filed TournamentCard page-size slicing and PlayerTable/TournamentTable ArrowDown page-boundary failures. They predate this layout and are known limits, not additions to this mandate.

## Approach

### Shared bounded database split

Authority: "a draggable divider between table and preview" and "Reuse whatever splitter primitive the app already ships".

GridLayout owns a controlled Mosaic with exactly two stable tile IDs, table and preview, in row direction. Preserve all three callers' search, table and preview content. There is no pane removal, tree editing or drag-to-rearrange. Import the existing Mosaic styling where this shared layout uses it rather than depending on BoardsPage being mounted. Any database-specific CSS stays scoped to database layout.

The preferred table percentage defaults to 50 and is bounded to 20 through 80. Both panes have a font-aware floor of 20rem in split mode. Derive Mosaic's symmetric minimum percentage from the available container width and that floor, with the 20% preference bound as the minimum. Clamp the displayed ratio to those effective bounds without replacing the preferred ratio when the container shrinks.

When the container cannot accommodate both floors and the divider, show search/table followed by preview in a vertically scrollable compact layout. The splitter is absent there. Pane content remains reachable, independently scrollable where needed, with no document-level horizontal overflow or hidden rows, board ranks, notation or actions at 320px and 200% font scale. Account for the application's root font scale and actual content-container size, including sidebar space, rather than a viewport-only breakpoint. Do not persist this derived compact mode.

Dragging changes the controlled layout immediately. Since Mosaic's internal divider lacks keyboard semantics, provide small labelled controls using the existing IconAction pattern to enlarge the table or preview by a bounded step. Those controls use the same ratio and constraints as dragging and visibly disable at a bound. All new labels use i18next. Keyboard navigation must reach these controls without traversing a second draggable implementation.

Proof level: unit geometry/state transitions plus populated container pixel and interaction assertions. The evidence must distinguish effective clamping from modification of the saved preference.

### One validated preference across database tabs

Authority: "persisted width, bounded min/max" and "three consumers of GridLayout".

Use one dedicated database split preference shared by Games, Players and Tournaments, with a finite bounded numeric schema and a distinct key. Do not key it by database path or reuse windowsState. Use the existing createZodStorage adapter and its failure reporting in accordance with d-20260906-13. No serializer migration is part of this change.

All mounted instances observe the same preferred ratio. Intermediate pointer movement stays responsive in memory. Persist completed dragging through Mosaic's onRelease and completed keyboard adjustments through the same preference update. Storage must not be rewritten on every pointer event or merely because of a resize, inactive tab render, compact transition or initial measurement. Missing, malformed, nonfinite or out-of-range data falls back to 50 under the existing repair contract. A read or write exception reports through the existing translated redacted path and does not destroy the usable in-memory state. No subscriptions or listeners may outlive their layout owner.

Proof level: focused preference tests for validation, throwing storage and committed versus transient changes, plus drag, cross-tab and reload interaction tests using preserveStorageForReload. Ordinary fixture resets are not persistence evidence.

### Adaptive database board and notation

Authority: "lets the board grow into available height" and "stack notation under the board when the column is tall rather than always beside it".

GameCard opts into adaptive preview sizing and supplies a definite remaining frame after its metadata, actions and opening label. Both expanded and compact layouts keep that content reachable. Use measured space to choose between board beside notation in a wide frame and notation below the board in a tall or narrow frame. Size the largest square board that fits the selected arrangement while reserving usable notation and control space, including gaps and font scaling. Use pixel widths for measured board geometry, so Mantine's rem scaling does not multiply that size again. Do not retain a half-of-preview-width cap in the database's adaptive mode.

The board, scrollable notation and all four navigation actions remain usable together. On very narrow frames the navigation actions may wrap to avoid clipping. Resizing or changing arrangement preserves the current game position, selection and variation chooser ownership. Do not remount the game tree merely to change orientation of the layout. Keep board orientation, move numbering, wheel navigation and chooser behavior intact.

Adaptive behavior is an explicit database opt-in. Files retains its current fitHeight/hideControls sizing and interaction contract. Share common geometry where it is the same concept, while preserving that distinct contract rather than forcing Files into the database layout.

Proof level: measured component cases for both arrangements, available height after headers, pixel scaling, retained position and existing Files behavior, followed by pinned container snapshots and reachability assertions.

## Decisions and trade-offs

### Decided autonomously

* **Question:** Which existing splitter fulfills the mandate? **Chosen:** controlled two-tile Mosaic. **Rejected:** a new pointer divider or exposing Mosaic's internal Split. **Reason:** the public component already provides the required drag lifecycle and bounded split without another implementation. Keyboard controls complement its missing keyboard input. **Reversal:** change only after evidence that the public component cannot satisfy the bounded split contract.
* **Question:** Which width is persisted? **Chosen:** one bounded percentage across database tabs, default 50, with transient responsive clamping. **Rejected:** per-database keys, pixel widths and the editable analysis-tree schema. **Reason:** the three shared callers express one layout preference and percentage survives window changes. The 20rem floors protect usable panes, while compact stacking preserves access below them. **Reversal:** revise bounds or scope only with observed usability evidence and review of persisted compatibility.
* **Question:** How does the board grow without regressing Files? **Chosen:** an adaptive database opt-in with definite remaining height and reserved notation/control space. **Rejected:** changing every fitHeight consumer or merely widening the fixed equal-column preview. **Reason:** the former breaks a proven separate Files contract and the latter retains the limiting half-width layout. **Reversal:** revisit through shared-preview geometry evidence, retaining Files regression proof.
* **Question:** Who performs visual acceptance and what is excluded? **Chosen:** the implementing agent through verify-ui, including both arrangements and compact mode. **Excluded:** sibling findings and the independently filed pre-existing defects. **Reason:** full auto authorizes the necessary layout decisions and the mandate specifies shared components and breakpoints. No statement here is attributed to Felix as a new decision.

Governing decisions: d-20260831-16 and d-20260831-17 require reachable content and independent clipping evidence at 320px/200%. d-20260906-13 governs ordinary preference validation and failure handling. The adopting session records these new technical choices in tasks/decisions.md under that ledger's reversal rules. This plan-only session does not write that ledger.

## Risks / open questions

There are no unresolved product choices. Measurements may refine the arrangement threshold and reserved notation/control dimensions within the contracts above. Mosaic must not collapse into a zero-size initial container. Existing per-tab panels and long player/tournament metadata need scrollable wrappers, not fixed-height clipping.

The native product has not been reproduced in this plan-only run, and no screenshot, test or gate has been run for a proposed implementation. Existing source and the original observation justify design, not a claim of verified pixels. Before implementation the adopter must recheck ownership, dependency installation, Docker/container availability and the ordinary gate prerequisites. The missing worktree dependencies do not block independent plan review.

The pending deletion failure and separately filed pagination/navigation defects remain known pre-change limits. Layout must not claim to fix them. Their independent follow-up may touch these components later and requires drift review before adoption.

## Not part of this task

No change to game opening affordances, database import/search semantics, pagination, deletion, comments, personal-card statistics, analysis Mosaic editing, engine processes, Rust/IPC, generated bindings, native chrome, permissions or dependency versions. No coverage floor or snapshot budget reduction.

## Phases

### Phase 1: Shared database layout, preference and adaptive preview

This is one cohesive independently green phase. The shared layout, persistence and preview geometry have coupled behavior and are implemented together with their regression proof. Role: sensitive, resolved through executor-profiles.md and leaf-launch.sh. Persistence is touched. No authentication, native concurrency, Rust API or permission boundary is touched.

Paths: GridLayout.tsx and its scoped stylesheet, GameCard.tsx, GamePreview.tsx and optional scoped stylesheet, a dedicated src/state/databaseLayout.ts and its tests, corresponding layout/preview/card component tests, populated database e2e coverage and fixtures, affected database snapshots, and translated labels under src/translation/. DatabaseView.tsx may change only where required to provide a bounded or scrollable layout container. Shared Mosaic CSS must not change analysis behavior. GameTable, PlayerTable and TournamentTable remain consumers of the shared component.

Implement the three Approach obligations above. The executor determines private helper names and fixture placement within those contracts. Follow async-resource-invariants.md, persisted-state.md and chess-tree-semantics.md, plus the push and verify-ui contracts. No manual generated binding edits. Add meaningful tests at the changed state/geometry boundaries rather than tests that mirror helper code.

**PROOF COMMAND:** `pnpm exec vitest related --run src/components/databases/GridLayout.tsx src/components/databases/GamePreview.tsx src/components/databases/GameCard.tsx src/state/databaseLayout.ts && pnpm test:e2e:container --project=database-files --project=files-preview && pnpm checks:pre-review && pnpm gates:contract:check`

The static-import related set is a floor. Include explicit new tests if the resolver cannot discover them. Required assertions are: populated Games at 2000px can enlarge its square board beyond the original quarter-window cap when height permits, split endpoints enforce bounds, the saved ratio survives switching tabs and reload, compact transitions preserve it, all three populated tab layouts remain reachable at 320px/200%, and both adaptive arrangements preserve board/notation/control usability and current position. Keep the existing Files square-board, clipping and chooser regressions green. Use both document overflow and independent ancestor-clipping checks, not screenshots alone.

The database-files fixture's ordinary 200% font setting must not silently stand in for the requested wide 100% case. Explicitly set scale/viewport for each acceptance case. First run container proof without accepting snapshots, inspect intended diffs, and update only changed database expectations through `pnpm test:e2e:update --project=database-files` under verify-ui. Do not re-record Files or unrelated snapshots to hide a regression.

After implementation, cumulative diff review runs on the complete final change. Final verify-ui inspects the pinned container pixel evidence and interactions across these modes. Run the full affected frontend gate set through `pnpm gates:push -- --frontend` after the final verified commit, with the canonical push mapping controlling any additional path-triggered checks. No new native behavior is claimed, so this plan does not add a native database journey. If implementation introduces native lifecycle or IPC claims, their mandatory real-app proof must be added before release.

This PLAN-ONLY run stops after plan review and produces its metadata and review handoff. It does not implement Phase 1, mutate findings or decisions, start servers, run browser verification, stage, commit or push.

### plan-r2.md

# Plan: Resizable database panes and adaptive game preview

## Goal

Resolve f-20261001-09 by letting users enlarge the selected preview in Games, Players and Tournaments, with a saved bounded split and a board that uses the space available to it. Preserve Files preview behavior and reachability at 320px with 200% font scaling.

## MANDATE

### The database Games view splits list and preview 50/50 with no resize, so the preview board can never be larger than a quarter of the window width

* **ID:** f-20261001-09 · **Status:** open · **Area:** frontend-ui · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src/components/databases/GridLayout.tsx` (`<Group grow>` with two equal columns, no splitter), `src/components/databases/GamePreview.tsx:60` (`boardSide = min(frameHeight, frameWidth / 2)` when controls are shown, so the board takes at most half of the preview column), used by `GameTable.tsx`, `PlayerTable.tsx`, `TournamentTable.tsx`.
* **Defect:** Felix (2026-10-01, 2000px-wide window) wanted a bigger board while browsing "Meine Partien" and found no way to enlarge it: the table and the preview are fixed halves and the board is capped at half of its half. The analysis tab already offers resizable panes (`BoardsPage.tsx`, `react-mosaic-component`), so the database view is the odd one out.
* **Fix shape:** a draggable divider between table and preview (persisted width, bounded min/max), and a preview layout that lets the board grow into available height (stack notation under the board when the column is tall rather than always beside it). Reuse whatever splitter primitive the app already ships rather than adding a second one. Pixels via `pnpm test:e2e:container`; check the 320px / 200% font-scale case (`f-20260829-02`).
* **Open question:** which splitter primitive the database view adopts (reuse of the analysis tab's mosaic or a lighter divider), how its width is persisted, and how the preview arranges board and notation when the column is tall versus wide.
* **Why `build`:** layout design with persistence and three consumers of `GridLayout`.
* **Related:** the open-affordance finding filed in the same session (same pages, different files); `f-20260829-02` (narrow-layout clipping).
* **Found by:** Felix, session e3bd1021-4d34-443f-96c0-a1af650f0984, 2026-10-01.

## Threat model and non-goals

The inputs are ordinary window resizing, mouse/touch dragging, keyboard use, persisted preferences that may be missing or corrupted, and storage operations that may throw. The UI must remain usable after those failures. No adversarial layout input, remote protocol, filesystem privilege or native window boundary changes are proposed. The supported renderer proof is the pinned container Playwright harness, including its Tauri command mocks. Native GTK chrome remains outside that harness and this mandate.

This is the f-20261001-09 singleton slice. Opening a game directly, merging libraries, comment rendering, deletion semantics, table paging and analysis-pane management are independent mandates. No new dependency, service, watcher or alternative draggable splitter is authorized.

## Traced premises

These premises record the BASE source trace, not implementation obligations.

* BASE is `86305a389c9acbef03af6489a6761f7e0e2ca157`. The worktree was clean. Read-only `findings.py next --pin f-20261001-09 --json` selected this singleton at build tier. The splitter, persistence and adaptive-layout choices remain unsettled by existing decisions, so build remains the correct entry.
* `GridLayout.tsx:20` owns both database columns. Its three consumers are `GameTable.tsx`, `PlayerTable.tsx` and `TournamentTable.tsx`. `DatabaseView.tsx:51` bounds their tab panels inside the available desktop content area.
* `GameCard.tsx:38` places metadata, actions and preview inside a full-height ScrollArea. It does not opt into `GamePreview`'s fitHeight branch. The finding's cited explicit half-width formula therefore currently applies to Files, while the database's growing Group still allocates equal board and notation columns. Both structures constrain the database board.
* `GamePreview.tsx:60` measures a square in fitHeight mode. `GamePreview.tsx:80` owns OpeningName, board, notation and controls under one TreeStateProvider. `FileCard.tsx:164` is the other production consumer and already depends on fitHeight and hideControls. `GamePreview.test.tsx:285` and `e2e/files-preview.spec.ts:48` cover that contract.
* `BoardsPage.tsx:372` uses the installed `react-mosaic-component` and imports its stylesheet plus `src/styles/react-mosaic.css`. Its editable layout and `windowsState` preference are specific to analysis and are not a database layout model.
* The locked and installed Mosaic version is 6.1.1. Its public controlled Mosaic supports onChange, onRelease, fixed row splits, symmetric minimumPaneSizePercentage and disabled resize. Its internal Split is not a public keyboard-accessible separator. This was traced in the matching installed package under the main checkout, because this plan-only worktree has no node_modules.
* `src/state/utils.ts:19` exports createZodStorage with caught read, repair, write and remove failures and redacted reporting. Decision d-20260906-13 retains raw JSON for ordinary preferences. `layoutStorage.ts` validates a different domain, the three analysis pane IDs, and cannot be reused as the database preference schema.
* `e2e/fixtures.ts:277` provides preserveStorageForReload. The database-files project currently uses an 800px viewport at 200% font scale and empty database tab responses. The Files preview project uses 1920px at 100%. Existing clipping assertions and screenshots provide regression infrastructure but no populated database board or splitter evidence yet.
* The existing GameCard deletion failure is already pending in the shared inbox. Locate separately filed TournamentCard page-size slicing and PlayerTable/TournamentTable ArrowDown page-boundary failures. They predate this layout and are known limits, not additions to this mandate.

## Approach

### Shared bounded database split

Authority: "a draggable divider between table and preview" and "Reuse whatever splitter primitive the app already ships".

GridLayout owns a controlled Mosaic with exactly two stable tile IDs, table and preview, in row direction. Preserve all three callers' search, table and preview content. There is no pane removal, tree editing or drag-to-rearrange. Import the existing Mosaic styling where this shared layout uses it rather than depending on BoardsPage being mounted. Any database-specific CSS stays scoped to database layout.

The preferred table percentage defaults to 50 and is bounded to 20 through 80. Both panes have a font-aware floor of 20rem in split mode. Derive Mosaic's symmetric minimum percentage from the available container width and that floor, with the 20% preference bound as the minimum. Clamp the displayed ratio to those effective bounds without replacing the preferred ratio when the container shrinks.

When the container cannot accommodate both floors and the divider, show search/table followed by preview in a vertically scrollable compact layout. The splitter is absent there. Pane content remains reachable, independently scrollable where needed, with no document-level horizontal overflow or hidden rows, board ranks, notation or actions at 320px and 200% font scale. Account for the application's root font scale and actual content-container size, including sidebar space, rather than a viewport-only breakpoint. Do not persist this derived compact mode.

Dragging changes the controlled layout immediately. Since Mosaic's internal divider lacks keyboard semantics, provide small labelled controls using the existing IconAction pattern to enlarge the table or preview by a bounded step. Those controls use the same ratio and constraints as dragging and visibly disable at a bound. All new labels use i18next. Keyboard navigation must reach these controls without traversing a second draggable implementation.

Proof level: unit geometry/state transitions plus populated container pixel and interaction assertions. The evidence must distinguish effective clamping from modification of the saved preference.

### Terminal ownership of Mosaic drag updates

Authority: "a draggable divider" with "persisted width", and the frozen threat model's ordinary mouse/touch dragging and window resizing. The shared split and preference obligations depend on this terminal boundary.

Apply a narrowly scoped pnpm patch to the locked Mosaic 6.1.1 dependency. Cancel its pending throttled movement before delivering the final release percentage and when Split unmounts. Release is the authoritative final displayed and persisted percentage, with no subsequent movement callback from that drag. Unmount caused by compact reflow, tab removal or leaving the view must leave no queued callback that accesses a cleared ref or updates a surviving layout owner. Correct removal of the element-owned touchstart listener on unmount as part of that same cleanup. Keep the existing public Mosaic API and version. Do not create a wrapper timer, a second splitter or a new dependency.

The patch must affect the package's shipped runtime entry, not only its TypeScript source, and be registered in pnpm configuration and the lockfile so frozen installs reproduce it. Preserve analysis pane editing and normal drag behavior, which share this dependency. Release's final value must update the in-memory controlled layout as well as storage. Interrupted removal retains the last committed preference instead of silently saving unfinished movement.

Proof level: use the actual patched Mosaic runtime, without mocking away Split or its throttle, to queue multiple movements inside one throttle interval followed by release and separately by unmount. Advancing timers must yield neither a post-release movement nor a cleared-ref exception or stale write. Verify the final controlled and saved ratios agree. Run the existing analysis workspace and board regression projects as affected consumers, plus a frozen dependency install that applies the patch.

### One validated preference across database tabs

Authority: "persisted width, bounded min/max" and "three consumers of GridLayout".

Use one dedicated database split preference shared by Games, Players and Tournaments, with a finite bounded numeric schema and a distinct key. Do not key it by database path or reuse windowsState. Use the existing createZodStorage adapter and its failure reporting in accordance with d-20260906-13. No serializer migration is part of this change.

All mounted instances observe the same preferred ratio. Intermediate pointer movement stays responsive in memory. Persist completed dragging through Mosaic's onRelease and completed keyboard adjustments through the same preference update. Storage must not be rewritten on every pointer event or merely because of a resize, inactive tab render, compact transition or initial measurement. Missing, malformed, nonfinite or out-of-range data falls back to 50 under the existing repair contract. A read or write exception reports through the existing translated redacted path and does not destroy the usable in-memory state. No subscriptions or listeners may outlive their layout owner.

Proof level: focused preference tests for validation, throwing storage and committed versus transient changes, plus drag, cross-tab and reload interaction tests using preserveStorageForReload. Ordinary fixture resets are not persistence evidence.

### Adaptive database board and notation

Authority: "lets the board grow into available height" and "stack notation under the board when the column is tall rather than always beside it".

GameCard opts into adaptive preview sizing and supplies a definite remaining frame after its metadata, actions and opening label. Both expanded and compact layouts keep that content reachable. Use measured space to choose between board beside notation in a wide frame and notation below the board in a tall or narrow frame. Size the largest square board that fits the selected arrangement while reserving usable notation and control space, including gaps and font scaling. Use pixel widths for measured board geometry, so Mantine's rem scaling does not multiply that size again. Do not retain a half-of-preview-width cap in the database's adaptive mode.

The board, scrollable notation and all four navigation actions remain usable together. On very narrow frames the navigation actions may wrap to avoid clipping. Resizing or changing arrangement preserves the current game position, selection and variation chooser ownership. Do not remount the game tree merely to change orientation of the layout. Keep board orientation, move numbering, wheel navigation and chooser behavior intact.

Adaptive behavior is an explicit database opt-in. Files retains its current fitHeight/hideControls sizing and interaction contract. Share common geometry where it is the same concept, while preserving that distinct contract rather than forcing Files into the database layout.

Proof level: measured component cases for both arrangements, available height after headers, pixel scaling, retained position and existing Files behavior, followed by pinned container snapshots and reachability assertions.

## Decisions and trade-offs

### Decided autonomously

* **Question:** Which existing splitter fulfills the mandate? **Chosen:** controlled two-tile Mosaic. **Rejected:** a new pointer divider or exposing Mosaic's internal Split. **Reason:** the public component already provides the required drag lifecycle and bounded split without another implementation. Keyboard controls complement its missing keyboard input. **Reversal:** change only after evidence that the public component cannot satisfy the bounded split contract.
* **Question:** Which width is persisted? **Chosen:** one bounded percentage across database tabs, default 50, with transient responsive clamping. **Rejected:** per-database keys, pixel widths and the editable analysis-tree schema. **Reason:** the three shared callers express one layout preference and percentage survives window changes. The 20rem floors protect usable panes, while compact stacking preserves access below them. **Reversal:** revise bounds or scope only with observed usability evidence and review of persisted compatibility.
* **Question:** How does the board grow without regressing Files? **Chosen:** an adaptive database opt-in with definite remaining height and reserved notation/control space. **Rejected:** changing every fitHeight consumer or merely widening the fixed equal-column preview. **Reason:** the former breaks a proven separate Files contract and the latter retains the limiting half-width layout. **Reversal:** revisit through shared-preview geometry evidence, retaining Files regression proof.
* **Question:** Who performs visual acceptance and what is excluded? **Chosen:** the implementing agent through verify-ui, including both arrangements and compact mode. **Excluded:** sibling findings and the independently filed pre-existing defects. **Reason:** full auto authorizes the necessary layout decisions and the mandate specifies shared components and breakpoints. No statement here is attributed to Felix as a new decision.
* **Question:** How is the required terminal drag boundary made reliable? **Chosen:** a reproducible pnpm patch of Mosaic's existing throttle and listener cleanup. **Rejected:** relying on onRelease alone, retaining a hidden splitter to avoid cleanup, or adding a wrapper timer. **Reason:** source inspection and the actual shipped Split.js probe show a change callback after release and a cleared-ref exception after unmount. These break the new persisted split and compact transition. **Reversal:** remove the patch when a reviewed dependency release supplies equivalent lifecycle behavior and regression tests pass against it.

Governing decisions: d-20260831-16 and d-20260831-17 require reachable content and independent clipping evidence at 320px/200%. d-20260906-13 governs ordinary preference validation and failure handling. The adopting session records these new technical choices in tasks/decisions.md under that ledger's reversal rules. This plan-only session does not write that ledger.

## Risks / open questions

There are no unresolved product choices. Measurements may refine the arrangement threshold and reserved notation/control dimensions within the contracts above. Mosaic must not collapse into a zero-size initial container. Existing per-tab panels and long player/tournament metadata need scrollable wrappers, not fixed-height clipping.

The native product has not been reproduced in this plan-only run, and no screenshot, test or gate has been run for a proposed implementation. Existing source and the original observation justify design, not a claim of verified pixels. Before implementation the adopter must recheck ownership, dependency installation, Docker/container availability and the ordinary gate prerequisites. The missing worktree dependencies do not block independent plan review.

The pending deletion failure and separately filed pagination/navigation defects remain known pre-change limits. Layout must not claim to fix them. Their independent follow-up may touch these components later and requires drift review before adoption.

## Not part of this task

No change to game opening affordances, database import/search semantics, pagination, deletion, comments, personal-card statistics, analysis Mosaic editing, engine processes, Rust/IPC, generated bindings, native chrome, permissions or dependency versions. No coverage floor or snapshot budget reduction.

## Phases

### Phase 1: Shared database layout, preference and adaptive preview

This is one cohesive independently green phase. The shared layout, persistence and preview geometry have coupled behavior and are implemented together with their regression proof. Role: sensitive, resolved through executor-profiles.md and leaf-launch.sh. Persistence is touched. No authentication, native concurrency, Rust API or permission boundary is touched.

Paths: GridLayout.tsx and its scoped stylesheet, GameCard.tsx, GamePreview.tsx and optional scoped stylesheet, a dedicated src/state/databaseLayout.ts and its tests, corresponding layout/preview/card component tests, src/components/common/MosaicLifecycle.test.tsx, the generated dependency patch under patches/, pnpm-workspace.yaml and pnpm-lock.yaml, populated database e2e coverage and fixtures, affected database snapshots, and translated labels under src/translation/. DatabaseView.tsx may change only where required to provide a bounded or scrollable layout container. Shared Mosaic CSS must not change analysis behavior. GameTable, PlayerTable and TournamentTable remain consumers of the shared component.

Implement the four Approach obligations above. The executor determines private helper names and fixture placement within those contracts. Follow async-resource-invariants.md, persisted-state.md and chess-tree-semantics.md, plus the push and verify-ui contracts. No manual generated binding edits. Add meaningful tests at the changed state/geometry boundaries rather than tests that mirror helper code.

**PROOF COMMAND:** `pnpm install --frozen-lockfile && pnpm exec vitest run src/components/common/MosaicLifecycle.test.tsx && pnpm exec vitest related --run src/components/databases/GridLayout.tsx src/components/databases/GamePreview.tsx src/components/databases/GameCard.tsx src/state/databaseLayout.ts src/components/tabs/BoardsPage.tsx && pnpm test:e2e:container --project=database-files --project=files-preview --project=workspace-tabs --project=board-keyboard && pnpm checks:pre-review && pnpm gates:contract:check`

The static-import related set is a floor. Include explicit new tests if the resolver cannot discover them. Required assertions are: populated Games at 2000px can enlarge its square board beyond the original quarter-window cap when height permits, split endpoints enforce bounds, the saved ratio survives switching tabs and reload, compact transitions preserve it, all three populated tab layouts remain reachable at 320px/200%, and both adaptive arrangements preserve board/notation/control usability and current position. Keep the existing Files square-board, clipping and chooser regressions green. Use both document overflow and independent ancestor-clipping checks, not screenshots alone.

The database-files fixture's ordinary 200% font setting must not silently stand in for the requested wide 100% case. Explicitly set scale/viewport for each acceptance case. First run container proof without accepting snapshots, inspect intended diffs, and update only changed database expectations through `pnpm test:e2e:update --project=database-files` under verify-ui. Do not re-record Files or unrelated snapshots to hide a regression.

After implementation, cumulative diff review runs on the complete final change. Final verify-ui inspects the pinned container pixel evidence and interactions across these modes. Run the full affected frontend gate set through `pnpm gates:push -- --frontend` after the final verified commit, with the canonical push mapping controlling any additional path-triggered checks. No new native behavior is claimed, so this plan does not add a native database journey. If implementation introduces native lifecycle or IPC claims, their mandatory real-app proof must be added before release.

This PLAN-ONLY run stops after plan review and produces its metadata and review handoff. It does not implement Phase 1, mutate findings or decisions, start servers, run browser verification, stage, commit or push.

## Reviews

Plan authorship and arbitration share one root context. Detection ran in fresh Codex leaf contexts on the same model family as prospective code. No source implementation exists in this run. Raw reports and prompts remain unchanged in RUN_TMP. The review handoff will copy their complete text for adoption.

### Round 1: full plan-capable set

All twelve required leaves completed. Raw verdicts: review-plan REVISE, all other lenses APPROVED. Chess semantics, engine protocol, IPC contract, PGN index, platform semantics and Tauri security returned NOT APPLICABLE. Their reasons match the unchanged chess/native/security boundaries. Correctness reported an implementation-evidence limitation, not a finding. It remains an explicit verification limit.

* **I1 — Mosaic release and removal leave throttled movement pending.** Witness: review-plan, round 1, raw finding 1, blocker, confidence 95. **Disposition:** Fix. **Authority:** the draggable persisted split and frozen ordinary drag/reflow threat model. **Evidence:** installed 6.1.1 src/Split.tsx releases without cancelling its throttle and unmounts without cancelling it. The shipped lib/Split.js has the same mechanism. A scratch probe against that actual shipped class recorded `[["change",30],["release",60],["change",40]]`, and on separate unmount recorded `Cannot read properties of null (reading 'parentElement')`. The DOM geometry was a minimal fixture and this was not a browser proof. **Correction revision:** r2 adds Terminal ownership of Mosaic drag updates and extends its affected-consumer proof. **Dependencies:** Shared bounded database split and One validated preference across database tabs. **Closure:** awaiting review-plan and newly affected correctness, error handling, persisted-state, tests and minimalism in round 2.

Round metrics: one unique issue opened, zero resolved, one substantive plan-level adoption. No withdrawals, rewrites or splits. No carried items. Timing is recorded in the metadata/handoff after the round boundary. Downstream implementation and diff-review rework are not yet observable.

### plan-r3.md

# Plan: Resizable database panes and adaptive game preview

## Goal

Resolve f-20261001-09 by letting users enlarge the selected preview in Games, Players and Tournaments, with a saved bounded split and a board that uses the space available to it. Preserve Files preview behavior and reachability at 320px with 200% font scaling.

## MANDATE

### The database Games view splits list and preview 50/50 with no resize, so the preview board can never be larger than a quarter of the window width

* **ID:** f-20261001-09 · **Status:** open · **Area:** frontend-ui · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src/components/databases/GridLayout.tsx` (`<Group grow>` with two equal columns, no splitter), `src/components/databases/GamePreview.tsx:60` (`boardSide = min(frameHeight, frameWidth / 2)` when controls are shown, so the board takes at most half of the preview column), used by `GameTable.tsx`, `PlayerTable.tsx`, `TournamentTable.tsx`.
* **Defect:** Felix (2026-10-01, 2000px-wide window) wanted a bigger board while browsing "Meine Partien" and found no way to enlarge it: the table and the preview are fixed halves and the board is capped at half of its half. The analysis tab already offers resizable panes (`BoardsPage.tsx`, `react-mosaic-component`), so the database view is the odd one out.
* **Fix shape:** a draggable divider between table and preview (persisted width, bounded min/max), and a preview layout that lets the board grow into available height (stack notation under the board when the column is tall rather than always beside it). Reuse whatever splitter primitive the app already ships rather than adding a second one. Pixels via `pnpm test:e2e:container`; check the 320px / 200% font-scale case (`f-20260829-02`).
* **Open question:** which splitter primitive the database view adopts (reuse of the analysis tab's mosaic or a lighter divider), how its width is persisted, and how the preview arranges board and notation when the column is tall versus wide.
* **Why `build`:** layout design with persistence and three consumers of `GridLayout`.
* **Related:** the open-affordance finding filed in the same session (same pages, different files); `f-20260829-02` (narrow-layout clipping).
* **Found by:** Felix, session e3bd1021-4d34-443f-96c0-a1af650f0984, 2026-10-01.

## Threat model and non-goals

The inputs are ordinary window resizing, mouse/touch dragging, keyboard use, persisted preferences that may be missing or corrupted, and storage operations that may throw. The UI must remain usable after those failures. No adversarial layout input, remote protocol, filesystem privilege or native window boundary changes are proposed. The supported renderer proof is the pinned container Playwright harness, including its Tauri command mocks. Native GTK chrome remains outside that harness and this mandate.

This is the f-20261001-09 singleton slice. Opening a game directly, merging libraries, comment rendering, deletion semantics, table paging and analysis-pane management are independent mandates. No new dependency, service, watcher or alternative draggable splitter is authorized.

## Traced premises

These premises record the BASE source trace, not implementation obligations.

* BASE is `86305a389c9acbef03af6489a6761f7e0e2ca157`. The worktree was clean. Read-only `findings.py next --pin f-20261001-09 --json` selected this singleton at build tier. The splitter, persistence and adaptive-layout choices remain unsettled by existing decisions, so build remains the correct entry.
* `GridLayout.tsx:20` owns both database columns. Its three consumers are `GameTable.tsx`, `PlayerTable.tsx` and `TournamentTable.tsx`. `DatabaseView.tsx:51` bounds their tab panels inside the available desktop content area.
* `GameCard.tsx:38` places metadata, actions and preview inside a full-height ScrollArea. It does not opt into `GamePreview`'s fitHeight branch. The finding's cited explicit half-width formula therefore currently applies to Files, while the database's growing Group still allocates equal board and notation columns. Both structures constrain the database board.
* `GamePreview.tsx:60` measures a square in fitHeight mode. `GamePreview.tsx:80` owns OpeningName, board, notation and controls under one TreeStateProvider. `FileCard.tsx:164` is the other production consumer and already depends on fitHeight and hideControls. `GamePreview.test.tsx:285` and `e2e/files-preview.spec.ts:48` cover that contract.
* `BoardsPage.tsx:372` uses the installed `react-mosaic-component` and imports its stylesheet plus `src/styles/react-mosaic.css`. Its editable layout and `windowsState` preference are specific to analysis and are not a database layout model.
* The locked and installed Mosaic version is 6.1.1. Its public controlled Mosaic supports onChange, onRelease, fixed row splits, symmetric minimumPaneSizePercentage and disabled resize. Its internal Split is not a public keyboard-accessible separator. This was traced in the matching installed package under the main checkout, because this plan-only worktree has no node_modules.
* `src/state/utils.ts:19` exports createZodStorage with caught read, repair, write and remove failures and redacted reporting. Decision d-20260906-13 retains raw JSON for ordinary preferences. `layoutStorage.ts` validates a different domain, the three analysis pane IDs, and cannot be reused as the database preference schema.
* `e2e/fixtures.ts:277` provides preserveStorageForReload. The database-files project currently uses an 800px viewport at 200% font scale and empty database tab responses. The Files preview project uses 1920px at 100%. Existing clipping assertions and screenshots provide regression infrastructure but no populated database board or splitter evidence yet.
* The existing GameCard deletion failure is already pending in the shared inbox. Locate separately filed TournamentCard page-size slicing and PlayerTable/TournamentTable ArrowDown page-boundary failures. They predate this layout and are known limits, not additions to this mandate.

## Approach

### Shared bounded database split

Authority: "a draggable divider between table and preview" and "Reuse whatever splitter primitive the app already ships".

GridLayout owns a controlled Mosaic with exactly two stable tile IDs, table and preview, in row direction. Preserve all three callers' search, table and preview content. There is no pane removal, tree editing or drag-to-rearrange. Import the existing Mosaic styling where this shared layout uses it rather than depending on BoardsPage being mounted. Any database-specific CSS stays scoped to database layout.

The preferred table percentage defaults to 50 and is bounded to 20 through 80. Both panes have a font-aware floor of 20rem in split mode. Derive Mosaic's symmetric minimum percentage from the available container width and that floor, with the 20% preference bound as the minimum. Clamp the displayed ratio to those effective bounds without replacing the preferred ratio when the container shrinks.

When the container cannot accommodate both floors and the divider, show search/table followed by preview in a vertically scrollable compact layout. The splitter is absent there. Pane content remains reachable, independently scrollable where needed, with no document-level horizontal overflow or hidden rows, board ranks, notation or actions at 320px and 200% font scale. Account for the application's root font scale and actual content-container size, including sidebar space, rather than a viewport-only breakpoint. Do not persist this derived compact mode.

Dragging changes the controlled layout immediately. Since Mosaic's internal divider lacks keyboard semantics, provide small labelled controls using the existing IconAction pattern to enlarge the table or preview by a bounded step. Those controls use the same ratio and constraints as dragging and visibly disable at a bound. All new labels use i18next. Keyboard navigation must reach these controls without traversing a second draggable implementation.

Proof level: unit geometry/state transitions plus populated container pixel and interaction assertions. The evidence must distinguish effective clamping from modification of the saved preference.

### Terminal ownership of Mosaic drag updates

Authority: "a draggable divider" with "persisted width", and the frozen threat model's ordinary mouse/touch dragging and window resizing. The shared split and preference obligations depend on this terminal boundary.

Apply a narrowly scoped pnpm patch to the locked Mosaic 6.1.1 dependency. Cancel its pending throttled movement before delivering the final release percentage and when Split unmounts. Release is the authoritative final displayed and persisted percentage, with no subsequent movement callback from that drag. Unmount caused by compact reflow, tab removal or leaving the view must leave no queued callback that accesses a cleared ref or updates a surviving layout owner. Correct removal of the element-owned touchstart listener on unmount as part of that same cleanup. Keep the existing public Mosaic API and version. Do not create a wrapper timer, a second splitter or a new dependency.

Handle ordinary touchcancel as an interrupted drag while the splitter stays mounted. Cancel pending movement and detach the document drag listeners, including the cancellation listener itself. Cancellation does not deliver onRelease or persist unfinished movement. Keep the last displayed ratio usable in memory and retain the last committed preference. Until a new gesture starts on the divider, later document movement or release must neither update that cancelled drag nor commit it. This uses the existing Split owner and public callback contract, without adding a new cancellation API.

The patch must affect the package's shipped runtime entry, not only its TypeScript source, and be registered in pnpm configuration and the lockfile so frozen installs reproduce it. Preserve analysis pane editing and normal drag behavior, which share this dependency. Release's final value must update the in-memory controlled layout as well as storage. Interrupted removal retains the last committed preference instead of silently saving unfinished movement.

Proof level: use the actual patched Mosaic runtime, without mocking away Split or its throttle, to queue multiple movements inside one throttle interval followed separately by release, unmount and touchcancel. Advancing timers must yield neither a post-release movement nor a cleared-ref exception or stale write. In the still-mounted cancellation case, subsequent document mouse movement and release cannot change or save the cancelled split. A new divider gesture works normally. Verify completed release's final controlled and saved ratios agree. Extend e2e/workspace-tabs.spec.ts with a real analysis-view drag assertion for both the root row divider and nested column divider. Check the affected pane dimensions, persisted windowsState node percentages and restoration through preserveStorageForReload, without mocking Mosaic. Existing workspace and board tests supplement this direct shared-consumer proof. Also run a frozen dependency install that applies the patch.

### One validated preference across database tabs

Authority: "persisted width, bounded min/max" and "three consumers of GridLayout".

Use one dedicated database split preference shared by Games, Players and Tournaments, with a finite bounded numeric schema and a distinct key. Do not key it by database path or reuse windowsState. Use the existing createZodStorage adapter and its failure reporting in accordance with d-20260906-13. No serializer migration is part of this change.

All mounted instances observe the same preferred ratio. Intermediate pointer movement stays responsive in memory. Persist completed dragging through Mosaic's onRelease and completed keyboard adjustments through the same preference update. Storage must not be rewritten on every pointer event or merely because of a resize, inactive tab render, compact transition or initial measurement. Missing, malformed, nonfinite or out-of-range data falls back to 50 under the existing repair contract. A read or write exception reports through the existing translated redacted path and does not destroy the usable in-memory state. No subscriptions or listeners may outlive their layout owner.

Proof level: focused preference tests for validation, throwing storage and committed versus transient changes, plus drag, cross-tab and reload interaction tests using preserveStorageForReload. Ordinary fixture resets are not persistence evidence.

### Adaptive database board and notation

Authority: "lets the board grow into available height" and "stack notation under the board when the column is tall rather than always beside it".

GameCard opts into adaptive preview sizing and supplies a definite remaining frame after its metadata, actions and opening label. Both expanded and compact layouts keep that content reachable. Use measured space to choose between board beside notation in a wide frame and notation below the board in a tall or narrow frame. Size the largest square board that fits the selected arrangement while reserving usable notation and control space, including gaps and font scaling. Use pixel widths for measured board geometry, so Mantine's rem scaling does not multiply that size again. Do not retain a half-of-preview-width cap in the database's adaptive mode.

The board, scrollable notation and all four navigation actions remain usable together. On very narrow frames the navigation actions may wrap to avoid clipping. Resizing or changing arrangement preserves the current game position, selection and variation chooser ownership. Do not remount the game tree merely to change orientation of the layout. Keep board orientation, move numbering, wheel navigation and chooser behavior intact.

Adaptive behavior is an explicit database opt-in. Files retains its current fitHeight/hideControls sizing and interaction contract. Share common geometry where it is the same concept, while preserving that distinct contract rather than forcing Files into the database layout.

Proof level: measured component cases for both arrangements, available height after headers, pixel scaling, retained position and existing Files behavior, followed by pinned container snapshots and reachability assertions.

## Decisions and trade-offs

### Decided autonomously

* **Question:** Which existing splitter fulfills the mandate? **Chosen:** controlled two-tile Mosaic. **Rejected:** a new pointer divider or exposing Mosaic's internal Split. **Reason:** the public component already provides the required drag lifecycle and bounded split without another implementation. Keyboard controls complement its missing keyboard input. **Reversal:** change only after evidence that the public component cannot satisfy the bounded split contract.
* **Question:** Which width is persisted? **Chosen:** one bounded percentage across database tabs, default 50, with transient responsive clamping. **Rejected:** per-database keys, pixel widths and the editable analysis-tree schema. **Reason:** the three shared callers express one layout preference and percentage survives window changes. The 20rem floors protect usable panes, while compact stacking preserves access below them. **Reversal:** revise bounds or scope only with observed usability evidence and review of persisted compatibility.
* **Question:** How does the board grow without regressing Files? **Chosen:** an adaptive database opt-in with definite remaining height and reserved notation/control space. **Rejected:** changing every fitHeight consumer or merely widening the fixed equal-column preview. **Reason:** the former breaks a proven separate Files contract and the latter retains the limiting half-width layout. **Reversal:** revisit through shared-preview geometry evidence, retaining Files regression proof.
* **Question:** Who performs visual acceptance and what is excluded? **Chosen:** the implementing agent through verify-ui, including both arrangements and compact mode. **Excluded:** sibling findings and the independently filed pre-existing defects. **Reason:** full auto authorizes the necessary layout decisions and the mandate specifies shared components and breakpoints. No statement here is attributed to Felix as a new decision.
* **Question:** How is the required terminal drag boundary made reliable? **Chosen:** a reproducible pnpm patch of Mosaic's existing throttle and listener cleanup. **Rejected:** relying on onRelease alone, retaining a hidden splitter to avoid cleanup, or adding a wrapper timer. **Reason:** source inspection and the actual shipped Split.js probe show a change callback after release and a cleared-ref exception after unmount. These break the new persisted split and compact transition. **Reversal:** remove the patch when a reviewed dependency release supplies equivalent lifecycle behavior and regression tests pass against it.

Governing decisions: d-20260831-16 and d-20260831-17 require reachable content and independent clipping evidence at 320px/200%. d-20260906-13 governs ordinary preference validation and failure handling. The adopting session records these new technical choices in tasks/decisions.md under that ledger's reversal rules. This plan-only session does not write that ledger.

## Risks / open questions

There are no unresolved product choices. Measurements may refine the arrangement threshold and reserved notation/control dimensions within the contracts above. Mosaic must not collapse into a zero-size initial container. Existing per-tab panels and long player/tournament metadata need scrollable wrappers, not fixed-height clipping.

The native product has not been reproduced in this plan-only run, and no screenshot, test or gate has been run for a proposed implementation. Existing source and the original observation justify design, not a claim of verified pixels. Before implementation the adopter must recheck ownership, dependency installation, Docker/container availability and the ordinary gate prerequisites. The missing worktree dependencies do not block independent plan review.

The pending deletion failure and separately filed pagination/navigation defects remain known pre-change limits. Layout must not claim to fix them. Their independent follow-up may touch these components later and requires drift review before adoption.

## Not part of this task

No change to game opening affordances, database import/search semantics, pagination, deletion, comments, personal-card statistics, analysis Mosaic editing, engine processes, Rust/IPC, generated bindings, native chrome, permissions or dependency versions. No coverage floor or snapshot budget reduction.

## Phases

### Phase 1: Shared database layout, preference and adaptive preview

This is one cohesive independently green phase. The shared layout, persistence and preview geometry have coupled behavior and are implemented together with their regression proof. Role: sensitive, resolved through executor-profiles.md and leaf-launch.sh. Persistence is touched. No authentication, native concurrency, Rust API or permission boundary is touched.

Paths: GridLayout.tsx and its scoped stylesheet, GameCard.tsx, GamePreview.tsx and optional scoped stylesheet, a dedicated src/state/databaseLayout.ts and its tests, corresponding layout/preview/card component tests, src/components/common/MosaicLifecycle.test.tsx, the generated dependency patch under patches/, pnpm-workspace.yaml and pnpm-lock.yaml, populated database e2e coverage and fixtures, e2e/workspace-tabs.spec.ts for the shared analysis drag proof, affected database snapshots, and translated labels under src/translation/. DatabaseView.tsx may change only where required to provide a bounded or scrollable layout container. Shared Mosaic CSS must not change analysis behavior. GameTable, PlayerTable and TournamentTable remain consumers of the shared component.

Implement the four Approach obligations above. The executor determines private helper names and fixture placement within those contracts. Follow async-resource-invariants.md, persisted-state.md and chess-tree-semantics.md, plus the push and verify-ui contracts. No manual generated binding edits. Add meaningful tests at the changed state/geometry boundaries rather than tests that mirror helper code.

**PROOF COMMAND:** `pnpm install --frozen-lockfile && pnpm exec vitest run src/components/common/MosaicLifecycle.test.tsx && pnpm exec vitest related --run src/components/databases/GridLayout.tsx src/components/databases/GamePreview.tsx src/components/databases/GameCard.tsx src/state/databaseLayout.ts src/components/tabs/BoardsPage.tsx && pnpm test:e2e:container --project=database-files --project=files-preview --project=workspace-tabs --project=board-keyboard && pnpm checks:pre-review && pnpm gates:contract:check`

The static-import related set is a floor. Include explicit new tests if the resolver cannot discover them. Required assertions are: populated Games at 2000px can enlarge its square board beyond the original quarter-window cap when height permits, split endpoints enforce bounds, the saved ratio survives switching tabs and reload, compact transitions preserve it, all three populated tab layouts remain reachable at 320px/200%, and both adaptive arrangements preserve board/notation/control usability and current position. Keep the existing Files square-board, clipping and chooser regressions green. Use both document overflow and independent ancestor-clipping checks, not screenshots alone.

The database-files fixture's ordinary 200% font setting must not silently stand in for the requested wide 100% case. Explicitly set scale/viewport for each acceptance case. First run container proof without accepting snapshots, inspect intended diffs, and update only changed database expectations through `pnpm test:e2e:update --project=database-files` under verify-ui. Do not re-record Files or unrelated snapshots to hide a regression.

After implementation, cumulative diff review runs on the complete final change. Final verify-ui inspects the pinned container pixel evidence and interactions across these modes. Run the full affected frontend gate set through `pnpm gates:push -- --frontend` after the final verified commit, with the canonical push mapping controlling any additional path-triggered checks. No new native behavior is claimed, so this plan does not add a native database journey. If implementation introduces native lifecycle or IPC claims, their mandatory real-app proof must be added before release.

This PLAN-ONLY run stops after plan review and produces its metadata and review handoff. It does not implement Phase 1, mutate findings or decisions, start servers, run browser verification, stage, commit or push.

## Reviews

Plan authorship and arbitration share one root context. Detection ran in fresh Codex leaf contexts on the same model family as prospective code. No source implementation exists in this run. Raw reports and prompts remain unchanged in RUN_TMP. The review handoff will copy their complete text for adoption.

### Round 1: full plan-capable set

All twelve required leaves completed. Raw verdicts: review-plan REVISE, all other lenses APPROVED. Chess semantics, engine protocol, IPC contract, PGN index, platform semantics and Tauri security returned NOT APPLICABLE. Their reasons match the unchanged chess/native/security boundaries. Correctness reported an implementation-evidence limitation, not a finding. It remains an explicit verification limit.

* **I1 — Mosaic release and removal leave throttled movement pending.** Witness: review-plan, round 1, raw finding 1, blocker, confidence 95. **Disposition:** Fix. **Authority:** the draggable persisted split and frozen ordinary drag/reflow threat model. **Evidence:** installed 6.1.1 src/Split.tsx releases without cancelling its throttle and unmounts without cancelling it. The shipped lib/Split.js has the same mechanism. A scratch probe against that actual shipped class recorded `[["change",30],["release",60],["change",40]]`, and on separate unmount recorded `Cannot read properties of null (reading 'parentElement')`. The DOM geometry was a minimal fixture and this was not a browser proof. **Correction revision:** r2 adds Terminal ownership of Mosaic drag updates and extends its affected-consumer proof. **Dependencies:** Shared bounded database split and One validated preference across database tabs. **Closure:** awaiting review-plan and newly affected correctness, error handling, persisted-state, tests and minimalism in round 2.

Round metrics: one unique issue opened, zero resolved, one substantive plan-level adoption. No withdrawals, rewrites or splits. No carried items. Timing is recorded in the metadata/handoff after the round boundary. Downstream implementation and diff-review rework are not yet observable.

### Round 2: terminal correction and affected domains

All six selected leaves completed. Raw verdicts: review-plan REVISE, correctness, error handling, minimalism, tests and persisted-state APPROVED. The tests report nevertheless contains a should-fix and is triaged independently of its verdict. Review-plan, correctness, error handling and persisted-state explicitly closed I1 at plan level. I1 is resolved in revision r2, with implementation proof still pending.

* **I2 — Analysis regression projects do not exercise divider dragging.** Witness: review-tests, round 2, raw finding 1, should-fix, confidence 95. **Disposition:** Fix. **Authority:** correctness proof for the same primitive reused by the mandated splitter. **Evidence:** BoardsPage.test.tsx mocks Mosaic to null. Neither workspace-tabs.spec.ts nor board-keyboard.spec.ts contains a divider drag. BoardsPage's analysis tree has both a row split and a nested column split, saved to windowsState. **Correction revision:** r3 strengthens the terminal obligation's existing analysis-preservation proof with actual drags, pane dimensions, persisted percentages and reload. **Dependencies:** I1, Terminal ownership of Mosaic drag updates. **Closure:** pending review-plan and review-tests in round 3.
* **I3 — Still-mounted touch cancellation leaves the drag owner active.** Witness: review-plan, round 2, raw finding 1, blocker, confidence 93. **Disposition:** Fix. **Authority:** the frozen ordinary touch-drag threat model and the mandated draggable persisted split. **Evidence:** actual installed Split binds movement, mouseup and touchend but no touchcancel. A second runtime probe recorded four document listeners remaining after cancellation, then `[["change",30],["change",40],["change",45],["release",60]]` after unrelated movement/release. Its DOM/event dispatch is a minimal fixture, not browser proof. **Correction revision:** r3 extends the existing terminal cleanup with touchcancel, no commit on interruption, no stale document updates, and new-gesture recovery. It does not add a public API. **Dependencies:** I1, Terminal ownership of Mosaic drag updates and One validated preference across database tabs. **Closure:** pending review-plan and newly affected correctness, error handling, persisted-state and tests in round 3.

Round metrics: I1 resolved, two unique new issues opened and two substantive plan-level adoptions. Cumulative three opened, one resolved, two open. I2 and I3 are coverage/lifecycle gaps exposed by I1's adopted dependency patch, not a rewrite or a split. No withdrawals or carried items. Downstream rework remains unobservable.

### plan-r4.md

# Plan: Resizable database panes and adaptive game preview

## Goal

Resolve f-20261001-09 by letting users enlarge the selected preview in Games, Players and Tournaments, with a saved bounded split and a board that uses the space available to it. Preserve Files preview behavior and reachability at 320px with 200% font scaling.

## MANDATE

### The database Games view splits list and preview 50/50 with no resize, so the preview board can never be larger than a quarter of the window width

* **ID:** f-20261001-09 · **Status:** open · **Area:** frontend-ui · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src/components/databases/GridLayout.tsx` (`<Group grow>` with two equal columns, no splitter), `src/components/databases/GamePreview.tsx:60` (`boardSide = min(frameHeight, frameWidth / 2)` when controls are shown, so the board takes at most half of the preview column), used by `GameTable.tsx`, `PlayerTable.tsx`, `TournamentTable.tsx`.
* **Defect:** Felix (2026-10-01, 2000px-wide window) wanted a bigger board while browsing "Meine Partien" and found no way to enlarge it: the table and the preview are fixed halves and the board is capped at half of its half. The analysis tab already offers resizable panes (`BoardsPage.tsx`, `react-mosaic-component`), so the database view is the odd one out.
* **Fix shape:** a draggable divider between table and preview (persisted width, bounded min/max), and a preview layout that lets the board grow into available height (stack notation under the board when the column is tall rather than always beside it). Reuse whatever splitter primitive the app already ships rather than adding a second one. Pixels via `pnpm test:e2e:container`; check the 320px / 200% font-scale case (`f-20260829-02`).
* **Open question:** which splitter primitive the database view adopts (reuse of the analysis tab's mosaic or a lighter divider), how its width is persisted, and how the preview arranges board and notation when the column is tall versus wide.
* **Why `build`:** layout design with persistence and three consumers of `GridLayout`.
* **Related:** the open-affordance finding filed in the same session (same pages, different files); `f-20260829-02` (narrow-layout clipping).
* **Found by:** Felix, session e3bd1021-4d34-443f-96c0-a1af650f0984, 2026-10-01.

## Threat model and non-goals

The inputs are ordinary window resizing, mouse/touch dragging, keyboard use, persisted preferences that may be missing or corrupted, and storage operations that may throw. The UI must remain usable after those failures. No adversarial layout input, remote protocol, filesystem privilege or native window boundary changes are proposed. The supported renderer proof is the pinned container Playwright harness, including its Tauri command mocks. Native GTK chrome remains outside that harness and this mandate.

This is the f-20261001-09 singleton slice. Opening a game directly, merging libraries, comment rendering, deletion semantics, table paging and analysis-pane management are independent mandates. No new dependency, service, watcher or alternative draggable splitter is authorized.

## Traced premises

These premises record the BASE source trace, not implementation obligations.

* BASE is `86305a389c9acbef03af6489a6761f7e0e2ca157`. The worktree was clean. Read-only `findings.py next --pin f-20261001-09 --json` selected this singleton at build tier. The splitter, persistence and adaptive-layout choices remain unsettled by existing decisions, so build remains the correct entry.
* `GridLayout.tsx:20` owns both database columns. Its three consumers are `GameTable.tsx`, `PlayerTable.tsx` and `TournamentTable.tsx`. `DatabaseView.tsx:51` bounds their tab panels inside the available desktop content area.
* `GameCard.tsx:38` places metadata, actions and preview inside a full-height ScrollArea. It does not opt into `GamePreview`'s fitHeight branch. The finding's cited explicit half-width formula therefore currently applies to Files, while the database's growing Group still allocates equal board and notation columns. Both structures constrain the database board.
* `GamePreview.tsx:60` measures a square in fitHeight mode. `GamePreview.tsx:80` owns OpeningName, board, notation and controls under one TreeStateProvider. `FileCard.tsx:164` is the other production consumer and already depends on fitHeight and hideControls. `GamePreview.test.tsx:285` and `e2e/files-preview.spec.ts:48` cover that contract.
* `BoardsPage.tsx:372` uses the installed `react-mosaic-component` and imports its stylesheet plus `src/styles/react-mosaic.css`. Its editable layout and `windowsState` preference are specific to analysis and are not a database layout model.
* The locked and installed Mosaic version is 6.1.1. Its public controlled Mosaic supports onChange, onRelease, fixed row splits, symmetric minimumPaneSizePercentage and disabled resize. Its internal Split is not a public keyboard-accessible separator. This was traced in the matching installed package under the main checkout, because this plan-only worktree has no node_modules.
* `src/state/utils.ts:19` exports createZodStorage with caught read, repair, write and remove failures and redacted reporting. Decision d-20260906-13 retains raw JSON for ordinary preferences. `layoutStorage.ts` validates a different domain, the three analysis pane IDs, and cannot be reused as the database preference schema.
* `e2e/fixtures.ts:277` provides preserveStorageForReload. The database-files project currently uses an 800px viewport at 200% font scale and empty database tab responses. The Files preview project uses 1920px at 100%. Existing clipping assertions and screenshots provide regression infrastructure but no populated database board or splitter evidence yet.
* The existing GameCard deletion failure is already pending in the shared inbox. Locate separately filed TournamentCard page-size slicing and PlayerTable/TournamentTable ArrowDown page-boundary failures. They predate this layout and are known limits, not additions to this mandate.

## Approach

### Shared bounded database split

Authority: "a draggable divider between table and preview" and "Reuse whatever splitter primitive the app already ships".

GridLayout owns a controlled Mosaic with exactly two stable tile IDs, table and preview, in row direction. Preserve all three callers' search, table and preview content. There is no pane removal, tree editing or drag-to-rearrange. Import the existing Mosaic styling where this shared layout uses it rather than depending on BoardsPage being mounted. Any database-specific CSS stays scoped to database layout.

The preferred table percentage defaults to 50 and is bounded to 20 through 80. Both panes have a font-aware floor of 20rem in split mode. Derive Mosaic's symmetric minimum percentage from the available container width and that floor, with the 20% preference bound as the minimum. Clamp the displayed ratio to those effective bounds without replacing the preferred ratio when the container shrinks.

When the container cannot accommodate both floors and the divider, show search/table followed by preview in a vertically scrollable compact layout. The splitter is absent there. Pane content remains reachable, independently scrollable where needed, with no document-level horizontal overflow or hidden rows, board ranks, notation or actions at 320px and 200% font scale. Account for the application's root font scale and actual content-container size, including sidebar space, rather than a viewport-only breakpoint. Do not persist this derived compact mode.

Dragging changes the controlled layout immediately. Since Mosaic's internal divider lacks keyboard semantics, provide small labelled controls using the existing IconAction pattern to enlarge the table or preview by a bounded step. Those controls use the same ratio and constraints as dragging and visibly disable at a bound. All new labels use i18next. Keyboard navigation must reach these controls without traversing a second draggable implementation.

Proof level: unit geometry/state transitions plus populated container pixel and interaction assertions. The evidence must distinguish effective clamping from modification of the saved preference.

### Terminal ownership of Mosaic drag updates

Authority: "a draggable divider" with "persisted width", and the frozen threat model's ordinary mouse/touch dragging and window resizing. The shared split and preference obligations depend on this terminal boundary.

Apply a narrowly scoped pnpm patch to the locked Mosaic 6.1.1 dependency. Cancel its pending throttled movement before delivering the final release percentage and when Split unmounts. Release is the authoritative final displayed and persisted percentage, with no subsequent movement callback from that drag. Unmount caused by compact reflow, tab removal or leaving the view must leave no queued callback that accesses a cleared ref or updates a surviving layout owner. Correct removal of the element-owned touchstart listener on unmount as part of that same cleanup. Keep the existing public Mosaic API and version. Do not create a wrapper timer, a second splitter or a new dependency.

Handle ordinary touchcancel as an interrupted drag while the splitter stays mounted. Cancel pending movement and detach the document drag listeners, including the cancellation listener itself. Cancellation does not deliver onRelease or persist unfinished movement. Keep the last displayed ratio usable in memory and retain the last committed preference. Until a new gesture starts on the divider, later document movement or release must neither update that cancelled drag nor commit it. This uses the existing Split owner and public callback contract, without adding a new cancellation API.

The patch must affect the package's shipped runtime entry, not only its TypeScript source, and be registered in pnpm configuration and the lockfile so frozen installs reproduce it. Preserve analysis pane editing and normal drag behavior, which share this dependency. Release's final value must update the in-memory controlled layout as well as storage. Interrupted removal retains the last committed preference instead of silently saving unfinished movement.

Proof level: use the actual patched Mosaic runtime, without mocking away Split or its throttle, to queue multiple movements inside one throttle interval followed separately by release, unmount and touchcancel. Advancing timers must yield neither a post-release movement nor a cleared-ref exception or stale write. In the still-mounted cancellation case, subsequent document mouse movement and release cannot change or save the cancelled split. A new divider gesture works normally. Verify completed release's final controlled and saved ratios agree. Extend e2e/workspace-tabs.spec.ts with a real analysis-view drag assertion for both the root row divider and nested column divider. Check the affected pane dimensions, persisted windowsState node percentages and restoration through preserveStorageForReload, without mocking Mosaic. Existing workspace and board tests supplement this direct shared-consumer proof. Also run a frozen dependency install that applies the patch.

### One validated preference across database tabs

Authority: "persisted width, bounded min/max" and "three consumers of GridLayout".

Use one dedicated database split preference shared by Games, Players and Tournaments, with a finite bounded numeric schema and a distinct key. Do not key it by database path or reuse windowsState. Use the existing createZodStorage adapter and its failure reporting in accordance with d-20260906-13. No serializer migration is part of this change.

All mounted instances observe the same preferred ratio. Intermediate pointer movement stays responsive in memory. Persist completed dragging through Mosaic's onRelease and completed keyboard adjustments through the same preference update. Storage must not be rewritten on every pointer event or merely because of a resize, inactive tab render, compact transition or initial measurement. Missing, malformed, nonfinite or out-of-range data falls back to 50 under the existing repair contract. A read or write exception reports through the existing translated redacted path and does not destroy the usable in-memory state. No subscriptions or listeners may outlive their layout owner.

Proof level: focused preference tests for validation, throwing storage and committed versus transient changes, plus drag, cross-tab and reload interaction tests using preserveStorageForReload. Ordinary fixture resets are not persistence evidence.

### Adaptive database board and notation

Authority: "lets the board grow into available height" and "stack notation under the board when the column is tall rather than always beside it".

GameCard opts into adaptive preview sizing and supplies a definite remaining frame after its metadata, actions and opening label. Both expanded and compact layouts keep that content reachable. Use measured space to choose between board beside notation in a wide frame and notation below the board in a tall or narrow frame. Size the largest square board that fits the selected arrangement while reserving usable notation and control space, including gaps and font scaling. Use pixel widths for measured board geometry, so Mantine's rem scaling does not multiply that size again. Do not retain a half-of-preview-width cap in the database's adaptive mode.

The board, scrollable notation and all four navigation actions remain usable together. On very narrow frames the navigation actions may wrap to avoid clipping. Resizing or changing arrangement preserves the current game position, selection and variation chooser ownership. Do not remount the game tree merely to change orientation of the layout. Keep board orientation, move numbering, wheel navigation and chooser behavior intact.

Adaptive behavior is an explicit database opt-in. Files retains its current fitHeight/hideControls sizing and interaction contract. Share common geometry where it is the same concept, while preserving that distinct contract rather than forcing Files into the database layout.

Proof level: measured component cases for both arrangements, available height after headers, pixel scaling, retained position and existing Files behavior, followed by pinned container snapshots and reachability assertions.

## Decisions and trade-offs

### Decided autonomously

* **Question:** Which existing splitter fulfills the mandate? **Chosen:** controlled two-tile Mosaic. **Rejected:** a new pointer divider or exposing Mosaic's internal Split. **Reason:** the public component already provides the required drag lifecycle and bounded split without another implementation. Keyboard controls complement its missing keyboard input. **Reversal:** change only after evidence that the public component cannot satisfy the bounded split contract.
* **Question:** Which width is persisted? **Chosen:** one bounded percentage across database tabs, default 50, with transient responsive clamping. **Rejected:** per-database keys, pixel widths and the editable analysis-tree schema. **Reason:** the three shared callers express one layout preference and percentage survives window changes. The 20rem floors protect usable panes, while compact stacking preserves access below them. **Reversal:** revise bounds or scope only with observed usability evidence and review of persisted compatibility.
* **Question:** How does the board grow without regressing Files? **Chosen:** an adaptive database opt-in with definite remaining height and reserved notation/control space. **Rejected:** changing every fitHeight consumer or merely widening the fixed equal-column preview. **Reason:** the former breaks a proven separate Files contract and the latter retains the limiting half-width layout. **Reversal:** revisit through shared-preview geometry evidence, retaining Files regression proof.
* **Question:** Who performs visual acceptance and what is excluded? **Chosen:** the implementing agent through verify-ui, including both arrangements and compact mode. **Excluded:** sibling findings and the independently filed pre-existing defects. **Reason:** full auto authorizes the necessary layout decisions and the mandate specifies shared components and breakpoints. No statement here is attributed to Felix as a new decision.
* **Question:** How is the required terminal drag boundary made reliable? **Chosen:** a reproducible pnpm patch of Mosaic's existing throttle and listener cleanup. **Rejected:** relying on onRelease alone, retaining a hidden splitter to avoid cleanup, or adding a wrapper timer. **Reason:** source inspection and the actual shipped Split.js probe show a change callback after release and a cleared-ref exception after unmount. These break the new persisted split and compact transition. **Reversal:** remove the patch when a reviewed dependency release supplies equivalent lifecycle behavior and regression tests pass against it.

Governing decisions: d-20260831-16 and d-20260831-17 require reachable content and independent clipping evidence at 320px/200%. d-20260906-13 governs ordinary preference validation and failure handling. The adopting session records these new technical choices in tasks/decisions.md under that ledger's reversal rules. This plan-only session does not write that ledger.

## Risks / open questions

There are no unresolved product choices. Measurements may refine the arrangement threshold and reserved notation/control dimensions within the contracts above. Mosaic must not collapse into a zero-size initial container. Existing per-tab panels and long player/tournament metadata need scrollable wrappers, not fixed-height clipping.

The native product has not been reproduced in this plan-only run, and no screenshot, test or gate has been run for a proposed implementation. Existing source and the original observation justify design, not a claim of verified pixels. Before implementation the adopter must recheck ownership, dependency installation, Docker/container availability and the ordinary gate prerequisites. The missing worktree dependencies do not block independent plan review.

The pending deletion failure and separately filed pagination/navigation defects remain known pre-change limits. Layout must not claim to fix them. Their independent follow-up may touch these components later and requires drift review before adoption.

## Not part of this task

No change to game opening affordances, database import/search semantics, pagination, deletion, comments, personal-card statistics, analysis Mosaic editing, engine processes, Rust/IPC, generated bindings, native chrome, permissions or dependency versions. No coverage floor or snapshot budget reduction.

## Phases

### Phase 1: Shared database layout, preference and adaptive preview

This is one cohesive independently green phase. The shared layout, persistence and preview geometry have coupled behavior and are implemented together with their regression proof. Role: sensitive, resolved through executor-profiles.md and leaf-launch.sh. Persistence is touched. No authentication, native concurrency, Rust API or permission boundary is touched.

Paths: GridLayout.tsx and its scoped stylesheet, GameCard.tsx, GamePreview.tsx and optional scoped stylesheet, a dedicated src/state/databaseLayout.ts and its tests, corresponding layout/preview/card component tests, src/components/common/MosaicLifecycle.test.tsx, the generated dependency patch under patches/, pnpm-workspace.yaml and pnpm-lock.yaml, populated database e2e coverage and fixtures, e2e/workspace-tabs.spec.ts for the shared analysis drag proof, affected database snapshots, and translated labels under src/translation/. DatabaseView.tsx may change only where required to provide a bounded or scrollable layout container. Shared Mosaic CSS must not change analysis behavior. GameTable, PlayerTable and TournamentTable remain consumers of the shared component.

Implement the four Approach obligations above. The executor determines private helper names and fixture placement within those contracts. Follow async-resource-invariants.md, persisted-state.md and chess-tree-semantics.md, plus the push and verify-ui contracts. No manual generated binding edits. Add meaningful tests at the changed state/geometry boundaries rather than tests that mirror helper code.

**PROOF COMMAND:** `pnpm install --frozen-lockfile && pnpm exec vitest run src/components/common/MosaicLifecycle.test.tsx && pnpm exec vitest related --run src/components/databases/GridLayout.tsx src/components/databases/GamePreview.tsx src/components/databases/GameCard.tsx src/state/databaseLayout.ts src/components/tabs/BoardsPage.tsx && pnpm test:e2e:container --project=database-files --project=files-preview --project=workspace-tabs --project=board-keyboard && pnpm checks:pre-review && pnpm gates:contract:check`

The static-import related set is a floor. Include explicit new tests if the resolver cannot discover them. Required assertions are: populated Games at 2000px can enlarge its square board beyond the original quarter-window cap when height permits, split endpoints enforce bounds, the saved ratio survives switching tabs and reload, compact transitions preserve it, all three populated tab layouts remain reachable at 320px/200%, and both adaptive arrangements preserve board/notation/control usability and current position. Keep the existing Files square-board, clipping and chooser regressions green. Use both document overflow and independent ancestor-clipping checks, not screenshots alone.

The database-files fixture's ordinary 200% font setting must not silently stand in for the requested wide 100% case. Explicitly set scale/viewport for each acceptance case. First run container proof without accepting snapshots, inspect intended diffs, and update only changed database expectations through `pnpm test:e2e:update --project=database-files` under verify-ui. Do not re-record Files or unrelated snapshots to hide a regression.

After implementation, cumulative diff review runs on the complete final change. Final verify-ui inspects the pinned container pixel evidence and interactions across these modes. Run the full affected frontend gate set through `pnpm gates:push -- --frontend` after the final verified commit, with the canonical push mapping controlling any additional path-triggered checks. No new native behavior is claimed, so this plan does not add a native database journey. If implementation introduces native lifecycle or IPC claims, their mandatory real-app proof must be added before release.

This PLAN-ONLY run stops after plan review and produces its metadata and review handoff. It does not implement Phase 1, mutate findings or decisions, start servers, run browser verification, stage, commit or push.

## Reviews

Plan authorship and arbitration share one root context. Detection ran in fresh Codex leaf contexts on the same model family as prospective code. No source implementation exists in this run. Raw reports and prompts remain unchanged in RUN_TMP. The review handoff will copy their complete text for adoption.

### Round 1: full plan-capable set

All twelve required leaves completed. Raw verdicts: review-plan REVISE, all other lenses APPROVED. Chess semantics, engine protocol, IPC contract, PGN index, platform semantics and Tauri security returned NOT APPLICABLE. Their reasons match the unchanged chess/native/security boundaries. Correctness reported an implementation-evidence limitation, not a finding. It remains an explicit verification limit.

* **I1 — Mosaic release and removal leave throttled movement pending.** Witness: review-plan, round 1, raw finding 1, blocker, confidence 95. **Disposition:** Fix. **Authority:** the draggable persisted split and frozen ordinary drag/reflow threat model. **Evidence:** installed 6.1.1 src/Split.tsx releases without cancelling its throttle and unmounts without cancelling it. The shipped lib/Split.js has the same mechanism. A scratch probe against that actual shipped class recorded `[["change",30],["release",60],["change",40]]`, and on separate unmount recorded `Cannot read properties of null (reading 'parentElement')`. The DOM geometry was a minimal fixture and this was not a browser proof. **Correction revision:** r2 adds Terminal ownership of Mosaic drag updates and extends its affected-consumer proof. **Dependencies:** Shared bounded database split and One validated preference across database tabs. **Closure:** awaiting review-plan and newly affected correctness, error handling, persisted-state, tests and minimalism in round 2.

Round metrics: one unique issue opened, zero resolved, one substantive plan-level adoption. No withdrawals, rewrites or splits. No carried items. Timing is recorded in the metadata/handoff after the round boundary. Downstream implementation and diff-review rework are not yet observable.

### Round 2: terminal correction and affected domains

All six selected leaves completed. Raw verdicts: review-plan REVISE, correctness, error handling, minimalism, tests and persisted-state APPROVED. The tests report nevertheless contains a should-fix and is triaged independently of its verdict. Review-plan, correctness, error handling and persisted-state explicitly closed I1 at plan level. I1 is resolved in revision r2, with implementation proof still pending.

* **I2 — Analysis regression projects do not exercise divider dragging.** Witness: review-tests, round 2, raw finding 1, should-fix, confidence 95. **Disposition:** Fix. **Authority:** correctness proof for the same primitive reused by the mandated splitter. **Evidence:** BoardsPage.test.tsx mocks Mosaic to null. Neither workspace-tabs.spec.ts nor board-keyboard.spec.ts contains a divider drag. BoardsPage's analysis tree has both a row split and a nested column split, saved to windowsState. **Correction revision:** r3 strengthens the terminal obligation's existing analysis-preservation proof with actual drags, pane dimensions, persisted percentages and reload. **Dependencies:** I1, Terminal ownership of Mosaic drag updates. **Closure:** pending review-plan and review-tests in round 3.
* **I3 — Still-mounted touch cancellation leaves the drag owner active.** Witness: review-plan, round 2, raw finding 1, blocker, confidence 93. **Disposition:** Fix. **Authority:** the frozen ordinary touch-drag threat model and the mandated draggable persisted split. **Evidence:** actual installed Split binds movement, mouseup and touchend but no touchcancel. A second runtime probe recorded four document listeners remaining after cancellation, then `[["change",30],["change",40],["change",45],["release",60]]` after unrelated movement/release. Its DOM/event dispatch is a minimal fixture, not browser proof. **Correction revision:** r3 extends the existing terminal cleanup with touchcancel, no commit on interruption, no stale document updates, and new-gesture recovery. It does not add a public API. **Dependencies:** I1, Terminal ownership of Mosaic drag updates and One validated preference across database tabs. **Closure:** pending review-plan and newly affected correctness, error handling, persisted-state and tests in round 3.

Round metrics: I1 resolved, two unique new issues opened and two substantive plan-level adoptions. Cumulative three opened, one resolved, two open. I2 and I3 are coverage/lifecycle gaps exposed by I1's adopted dependency patch, not a rewrite or a split. No withdrawals or carried items. Downstream rework remains unobservable.

### Round 3: touch cancellation and direct analysis proof

All five selected leaves completed with raw verdict APPROVED and no findings. Review-plan explicitly closed I2 and I3 against revision r3. Review-tests explicitly closed both proof obligations. Correctness, error handling and persisted-state explicitly closed I3 and its release-only database persistence dependency. These closures approve the plan, not an implementation.

I2 and I3 are resolved at r3. Cumulative totals: three unique issues opened, three resolved, zero open. Plan-level adoptions are r1=1 r2=2 r3=0. Twenty-three lens reports completed across three rounds. No Skip, Defer or carried lens findings. No withdrawals, rewrites, splits or inherited rounds. I3's underlying missing touchcancel path predates this plan, while its required ownership contract was exposed by I1. No code or tests were implemented and downstream rework remains unknown.

The final metadata and reviews-handoff.md record measured wall durations, the complete raw reports and source/probe evidence. No quota, dependency or release wait occurred during review. Ordinary leaf execution and polling count as review elapsed. Active time separated from that elapsed time is unknown.

### plan-r5.md

# Plan: Resizable database panes and adaptive game preview

## Goal

Resolve f-20261001-09 by letting users enlarge the selected preview in Games, Players and Tournaments, with a saved bounded split and a board that uses the space available to it. Preserve Files preview behavior and reachability at 320px with 200% font scaling.

## MANDATE

### The database Games view splits list and preview 50/50 with no resize, so the preview board can never be larger than a quarter of the window width

* **ID:** f-20261001-09 · **Status:** open · **Area:** frontend-ui · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src/components/databases/GridLayout.tsx` (`<Group grow>` with two equal columns, no splitter), `src/components/databases/GamePreview.tsx:60` (`boardSide = min(frameHeight, frameWidth / 2)` when controls are shown, so the board takes at most half of the preview column), used by `GameTable.tsx`, `PlayerTable.tsx`, `TournamentTable.tsx`.
* **Defect:** Felix (2026-10-01, 2000px-wide window) wanted a bigger board while browsing "Meine Partien" and found no way to enlarge it: the table and the preview are fixed halves and the board is capped at half of its half. The analysis tab already offers resizable panes (`BoardsPage.tsx`, `react-mosaic-component`), so the database view is the odd one out.
* **Fix shape:** a draggable divider between table and preview (persisted width, bounded min/max), and a preview layout that lets the board grow into available height (stack notation under the board when the column is tall rather than always beside it). Reuse whatever splitter primitive the app already ships rather than adding a second one. Pixels via `pnpm test:e2e:container`; check the 320px / 200% font-scale case (`f-20260829-02`).
* **Open question:** which splitter primitive the database view adopts (reuse of the analysis tab's mosaic or a lighter divider), how its width is persisted, and how the preview arranges board and notation when the column is tall versus wide.
* **Why `build`:** layout design with persistence and three consumers of `GridLayout`.
* **Related:** the open-affordance finding filed in the same session (same pages, different files); `f-20260829-02` (narrow-layout clipping).
* **Found by:** Felix, session e3bd1021-4d34-443f-96c0-a1af650f0984, 2026-10-01.

## Threat model and non-goals

The inputs are ordinary window resizing, mouse/touch dragging, keyboard use, persisted preferences that may be missing or corrupted, and storage operations that may throw. The UI must remain usable after those failures. No adversarial layout input, remote protocol, filesystem privilege or native window boundary changes are proposed. The supported renderer proof is the pinned container Playwright harness, including its Tauri command mocks. Native GTK chrome remains outside that harness and this mandate.

This is the f-20261001-09 singleton slice. Opening a game directly, merging libraries, comment rendering, deletion semantics, table paging and analysis-pane management are independent mandates. No new dependency, service, watcher or alternative draggable splitter is authorized.

## Traced premises

These premises record the BASE source trace, not implementation obligations.

* BASE is `86305a389c9acbef03af6489a6761f7e0e2ca157`. The worktree was clean. Read-only `findings.py next --pin f-20261001-09 --json` selected this singleton at build tier. The splitter, persistence and adaptive-layout choices remain unsettled by existing decisions, so build remains the correct entry.
* `GridLayout.tsx:20` owns both database columns. Its three consumers are `GameTable.tsx`, `PlayerTable.tsx` and `TournamentTable.tsx`. `DatabaseView.tsx:51` bounds their tab panels inside the available desktop content area.
* `GameCard.tsx:38` places metadata, actions and preview inside a full-height ScrollArea. It does not opt into `GamePreview`'s fitHeight branch. The finding's cited explicit half-width formula therefore currently applies to Files, while the database's growing Group still allocates equal board and notation columns. Both structures constrain the database board.
* `GamePreview.tsx:60` measures a square in fitHeight mode. `GamePreview.tsx:80` owns OpeningName, board, notation and controls under one TreeStateProvider. `FileCard.tsx:164` is the other production consumer and already depends on fitHeight and hideControls. `GamePreview.test.tsx:285` and `e2e/files-preview.spec.ts:48` cover that contract.
* `BoardsPage.tsx:372` uses the installed `react-mosaic-component` and imports its stylesheet plus `src/styles/react-mosaic.css`. Its editable layout and `windowsState` preference are specific to analysis and are not a database layout model.
* The locked and installed Mosaic version is 6.1.1. Its public controlled Mosaic supports onChange, onRelease, fixed row splits, symmetric minimumPaneSizePercentage and disabled resize. Its internal Split is not a public keyboard-accessible separator. This was traced in the matching installed package under the main checkout, because this plan-only worktree has no node_modules.
* `src/state/utils.ts:19` exports createZodStorage with caught read, repair, write and remove failures and redacted reporting. Decision d-20260906-13 retains raw JSON for ordinary preferences. `layoutStorage.ts` validates a different domain, the three analysis pane IDs, and cannot be reused as the database preference schema.
* `e2e/fixtures.ts:277` provides preserveStorageForReload. The database-files project currently uses an 800px viewport at 200% font scale and empty database tab responses. The Files preview project uses 1920px at 100%. Existing clipping assertions and screenshots provide regression infrastructure but no populated database board or splitter evidence yet.
* The existing GameCard deletion failure is already pending in the shared inbox. Locate separately filed TournamentCard page-size slicing and PlayerTable/TournamentTable ArrowDown page-boundary failures. They predate this layout and are known limits, not additions to this mandate.

Refresh premises at NEW-BASE `d3a6f614f30269faf0faf566963ace264c39a66b` (drift from the BASE above, traced in the r4 refresh):

* e95a864d added a database compact mode keyed to a font-scaled viewport media query. `GridLayout.tsx:6` exports `COMPACT_DATABASE_WIDTH_EM = 36`. `DatabaseView.tsx:26` and `GamePreview.tsx:67` each evaluate it through `useScaledMaxWidth`. DatabaseView sets `data-compact` on the view, and `GridLayout.module.css` then makes the view the vertical scroll container, stacks the two panes, gives the table a fixed font-scaled viewport and wraps search and actions. GamePreview's non-fitHeight `stacked` branch puts a full-width board above notation in its own fixed-height scroll viewport with wrapped controls. GridLayout now styles its panes through that module rather than inline styles.
* e72f8008 and 367f8cdb made GameCard's `game` optional with a translated no-selection text, and added `onOpen`/`pending` with the shared `OpenGameButton` from `gameOpen.tsx`. GameInfo and the preview now render only for a selection, below the actions.
* 159de8ec and c21fce13 wrap GamePreview's content in `EphemeralTabScope` inside its `TreeStateProvider`. BoardsPage's analysis Mosaic keeps the same controlled `windowsState` contract inside a new `WorkspaceTabScope`.
* `e2e/fixtures.ts:363` and `:431` now provide a populated two-game database (`gameOpeningFixture`, `gameOpeningCommands`). `database-files.spec.ts` opens it at 1400px with a `database-labelled-game` snapshot. The `font-scaled-breakpoints` project asserts compact database preview reachability at 320px/200% with a `database-game-open-320-200` snapshot.

## Approach

### Shared bounded database split

Authority: "a draggable divider between table and preview" and "Reuse whatever splitter primitive the app already ships".

GridLayout owns a controlled Mosaic with exactly two stable tile IDs, table and preview, in row direction. Preserve all three callers' search, table and preview content. There is no pane removal, tree editing or drag-to-rearrange. Import the existing Mosaic styling where this shared layout uses it rather than depending on BoardsPage being mounted. Any database-specific CSS stays scoped to database layout.

The preferred table percentage defaults to 50 and is bounded to 20 through 80. Both panes have a font-aware floor of 20rem in split mode. Derive Mosaic's symmetric minimum percentage from the available container width and that floor, with the 20% preference bound as the minimum. Clamp the displayed ratio to those effective bounds without replacing the preferred ratio when the container shrinks.

When the container cannot accommodate both floors and the divider, show search/table followed by preview in a vertically scrollable compact layout. The splitter is absent there. Pane content remains reachable, independently scrollable where needed, with no document-level horizontal overflow or hidden rows, board ranks, notation or actions at 320px and 200% font scale. Account for the application's root font scale and actual content-container size, including sidebar space, rather than a viewport-only breakpoint. Do not persist this derived compact mode.

There is exactly one compact decision for the database view. This container-derived decision replaces the existing `COMPACT_DATABASE_WIDTH_EM` viewport media query in every database consumer: the view's scroll container in DatabaseView, the split's absence in GridLayout and the preview's compact arrangement. They must always agree, so stacked panes never sit inside a non-scrolling view or beside an active splitter. Keep the existing compact reachability behavior (view-level vertical scroll, bounded table viewport, wrapped search and actions) as this compact layout. `useScaledMaxWidth` stays for its non-database consumers.

Dragging changes the controlled layout immediately. Since Mosaic's internal divider lacks keyboard semantics, provide small labelled controls using the existing IconAction pattern to enlarge the table or preview by a bounded step. Those controls use the same ratio and constraints as dragging and visibly disable at a bound. All new labels use i18next. Keyboard navigation must reach these controls without traversing a second draggable implementation.

Proof level: unit geometry/state transitions plus populated container pixel and interaction assertions. The evidence must distinguish effective clamping from modification of the saved preference.

### Terminal ownership of Mosaic drag updates

Authority: "a draggable divider" with "persisted width", and the frozen threat model's ordinary mouse/touch dragging and window resizing. The shared split and preference obligations depend on this terminal boundary.

Apply a narrowly scoped pnpm patch to the locked Mosaic 6.1.1 dependency. Cancel its pending throttled movement before delivering the final release percentage and when Split unmounts. Release is the authoritative final displayed and persisted percentage, with no subsequent movement callback from that drag. Unmount caused by compact reflow, tab removal or leaving the view must leave no queued callback that accesses a cleared ref or updates a surviving layout owner. Correct removal of the element-owned touchstart listener on unmount as part of that same cleanup. Keep the existing public Mosaic API and version. Do not create a wrapper timer, a second splitter or a new dependency.

Handle ordinary touchcancel as an interrupted drag while the splitter stays mounted. Cancel pending movement and detach the document drag listeners, including the cancellation listener itself. Cancellation does not deliver onRelease or persist unfinished movement. Keep the last displayed ratio usable in memory and retain the last committed preference. Until a new gesture starts on the divider, later document movement or release must neither update that cancelled drag nor commit it. This uses the existing Split owner and public callback contract, without adding a new cancellation API.

The patch must affect the package's shipped runtime entry, not only its TypeScript source, and be registered in pnpm configuration and the lockfile so frozen installs reproduce it. Preserve analysis pane editing and normal drag behavior, which share this dependency. Release's final value must update the in-memory controlled layout as well as storage. Interrupted removal retains the last committed preference instead of silently saving unfinished movement.

Proof level: use the actual patched Mosaic runtime, without mocking away Split or its throttle, to queue multiple movements inside one throttle interval followed separately by release, unmount and touchcancel. Advancing timers must yield neither a post-release movement nor a cleared-ref exception or stale write. In the still-mounted cancellation case, subsequent document mouse movement and release cannot change or save the cancelled split. A new divider gesture works normally. Verify completed release's final controlled and saved ratios agree. Extend e2e/workspace-tabs.spec.ts with a real analysis-view drag assertion for both the root row divider and nested column divider. Check the affected pane dimensions, persisted windowsState node percentages and restoration through preserveStorageForReload, without mocking Mosaic. Existing workspace and board tests supplement this direct shared-consumer proof. Also run a frozen dependency install that applies the patch.

### One validated preference across database tabs

Authority: "persisted width, bounded min/max" and "three consumers of GridLayout".

Use one dedicated database split preference shared by Games, Players and Tournaments, with a finite bounded numeric schema and a distinct key. Do not key it by database path or reuse windowsState. Use the existing createZodStorage adapter and its failure reporting in accordance with d-20260906-13. No serializer migration is part of this change.

All mounted instances observe the same preferred ratio. Intermediate pointer movement stays responsive in memory. Persist completed dragging through Mosaic's onRelease and completed keyboard adjustments through the same preference update. Storage must not be rewritten on every pointer event or merely because of a resize, inactive tab render, compact transition or initial measurement. Missing, malformed, nonfinite or out-of-range data falls back to 50 under the existing repair contract. A read or write exception reports through the existing translated redacted path and does not destroy the usable in-memory state. No subscriptions or listeners may outlive their layout owner.

Proof level: focused preference tests for validation, throwing storage and committed versus transient changes, plus drag, cross-tab and reload interaction tests using preserveStorageForReload. Ordinary fixture resets are not persistence evidence.

### Adaptive database board and notation

Authority: "lets the board grow into available height" and "stack notation under the board when the column is tall rather than always beside it".

GameCard opts into adaptive preview sizing and supplies a definite remaining frame after its metadata, actions and opening label. Both expanded and compact layouts keep that content reachable. Use measured space to choose between board beside notation in a wide frame and notation below the board in a tall or narrow frame. Size the largest square board that fits the selected arrangement while reserving usable notation and control space, including gaps and font scaling. Use pixel widths for measured board geometry, so Mantine's rem scaling does not multiply that size again. Do not retain a half-of-preview-width cap in the database's adaptive mode.

The board, scrollable notation and all four navigation actions remain usable together. On very narrow frames the navigation actions may wrap to avoid clipping. Resizing or changing arrangement preserves the current game position, selection and variation chooser ownership. Do not remount the game tree merely to change orientation of the layout. Arrangement switching stays below the preview's `TreeStateProvider` and `EphemeralTabScope`. Keep board orientation, move numbering, wheel navigation and chooser behavior intact.

The existing compact `stacked` preview (full-width board, notation in its own bounded scroll viewport below, wrapped controls) is the compact case of this adaptive arrangement. It follows the single compact decision above, never a separate media query. GameCard keeps its no-selection state and its `OpenGameButton` action reachable in every layout.

Adaptive behavior is an explicit database opt-in. Files retains its current fitHeight/hideControls sizing and interaction contract. Share common geometry where it is the same concept, while preserving that distinct contract rather than forcing Files into the database layout.

Proof level: measured component cases for both arrangements, available height after headers, pixel scaling, retained position and existing Files behavior, followed by pinned container snapshots and reachability assertions.

## Decisions and trade-offs

### Decided autonomously

* **Question:** Which existing splitter fulfills the mandate? **Chosen:** controlled two-tile Mosaic. **Rejected:** a new pointer divider or exposing Mosaic's internal Split. **Reason:** the public component already provides the required drag lifecycle and bounded split without another implementation. Keyboard controls complement its missing keyboard input. **Reversal:** change only after evidence that the public component cannot satisfy the bounded split contract.
* **Question:** Which width is persisted? **Chosen:** one bounded percentage across database tabs, default 50, with transient responsive clamping. **Rejected:** per-database keys, pixel widths and the editable analysis-tree schema. **Reason:** the three shared callers express one layout preference and percentage survives window changes. The 20rem floors protect usable panes, while compact stacking preserves access below them. **Reversal:** revise bounds or scope only with observed usability evidence and review of persisted compatibility.
* **Question:** How does the board grow without regressing Files? **Chosen:** an adaptive database opt-in with definite remaining height and reserved notation/control space. **Rejected:** changing every fitHeight consumer or merely widening the fixed equal-column preview. **Reason:** the former breaks a proven separate Files contract and the latter retains the limiting half-width layout. **Reversal:** revisit through shared-preview geometry evidence, retaining Files regression proof.
* **Question:** Who performs visual acceptance and what is excluded? **Chosen:** the implementing agent through verify-ui, including both arrangements and compact mode. **Excluded:** sibling findings and the independently filed pre-existing defects. **Reason:** full auto authorizes the necessary layout decisions and the mandate specifies shared components and breakpoints. No statement here is attributed to Felix as a new decision.
* **Question:** How is the required terminal drag boundary made reliable? **Chosen:** a reproducible pnpm patch of Mosaic's existing throttle and listener cleanup. **Rejected:** relying on onRelease alone, retaining a hidden splitter to avoid cleanup, or adding a wrapper timer. **Reason:** source inspection and the actual shipped Split.js probe show a change callback after release and a cleared-ref exception after unmount. These break the new persisted split and compact transition. **Reversal:** remove the patch when a reviewed dependency release supplies equivalent lifecycle behavior and regression tests pass against it.

Governing decisions: d-20260831-16 and d-20260831-17 require reachable content and independent clipping evidence at 320px/200%. d-20260906-13 governs ordinary preference validation and failure handling. The adopting session records these new technical choices in tasks/decisions.md under that ledger's reversal rules. This plan-only session does not write that ledger.

## Risks / open questions

There are no unresolved product choices. Measurements may refine the arrangement threshold and reserved notation/control dimensions within the contracts above. Mosaic must not collapse into a zero-size initial container. Existing per-tab panels and long player/tournament metadata need scrollable wrappers, not fixed-height clipping.

The native product has not been reproduced in this plan-only run, and no screenshot, test or gate has been run for a proposed implementation. Existing source and the original observation justify design, not a claim of verified pixels. Before implementation the adopter must recheck ownership, dependency installation, Docker/container availability and the ordinary gate prerequisites. The missing worktree dependencies do not block independent plan review.

The pending deletion failure, separately filed pagination/navigation defects and the spool-filed preview tree identity defect (I4: the preview is keyed by movetext alone) remain known pre-change limits. Layout must not claim to fix them. Their independent follow-up may touch these components later and requires drift review before adoption.

## Not part of this task

No change to game opening affordances, database import/search semantics, pagination, deletion, comments, personal-card statistics, analysis Mosaic editing, engine processes, Rust/IPC, generated bindings, native chrome, permissions or dependency versions. No coverage floor or snapshot budget reduction.

## Phases

### Phase 1: Shared database layout, preference and adaptive preview

This is one cohesive independently green phase. The shared layout, persistence and preview geometry have coupled behavior and are implemented together with their regression proof. Role: sensitive, resolved through executor-profiles.md and leaf-launch.sh. Persistence is touched. No authentication, native concurrency, Rust API or permission boundary is touched.

Paths: GridLayout.tsx and its scoped stylesheet, GameCard.tsx, GamePreview.tsx and optional scoped stylesheet, a dedicated src/state/databaseLayout.ts and its tests, corresponding layout/preview/card component tests, src/components/common/MosaicLifecycle.test.tsx, the generated dependency patch under patches/, pnpm-workspace.yaml and pnpm-lock.yaml, populated database e2e coverage and fixtures, e2e/font-scaled-breakpoints.spec.ts for the compact database case, e2e/workspace-tabs.spec.ts for the shared analysis drag proof, affected database snapshots under the database-files and font-scaled-breakpoints projects, and translated labels under src/translation/. DatabaseView.tsx may change only where required to provide a bounded or scrollable layout container and to consume the single compact decision. Shared Mosaic CSS must not change analysis behavior. GameTable, PlayerTable and TournamentTable remain consumers of the shared component.

Implement the four Approach obligations above. The executor determines private helper names and fixture placement within those contracts. Follow async-resource-invariants.md, persisted-state.md and chess-tree-semantics.md, plus the push and verify-ui contracts. No manual generated binding edits. Add meaningful tests at the changed state/geometry boundaries rather than tests that mirror helper code.

**PROOF COMMAND:** `pnpm install --frozen-lockfile && pnpm exec vitest run src/components/common/MosaicLifecycle.test.tsx && pnpm exec vitest related --run src/components/databases/GridLayout.tsx src/components/databases/GamePreview.tsx src/components/databases/GameCard.tsx src/state/databaseLayout.ts src/components/tabs/BoardsPage.tsx && pnpm test:e2e:container --project=database-files --project=font-scaled-breakpoints --project=files-preview --project=workspace-tabs --project=board-keyboard && pnpm checks:pre-review && pnpm gates:contract:check`

The static-import related set is a floor. Include explicit new tests if the resolver cannot discover them. Populated cases may reuse the existing two-game database fixture. Required assertions are: populated Games at 2000px can enlarge its square board beyond the original quarter-window cap when height permits, split endpoints enforce bounds, the saved ratio survives switching tabs and reload, compact transitions preserve it, all three populated tab layouts remain reachable at 320px/200%, and both adaptive arrangements preserve board/notation/control usability and current position. Keep the existing Files square-board, clipping and chooser regressions green. Use both document overflow and independent ancestor-clipping checks, not screenshots alone.

The database-files fixture's ordinary 200% font setting must not silently stand in for the requested wide 100% case. Explicitly set scale/viewport for each acceptance case. First run container proof without accepting snapshots, inspect intended diffs, and update only changed database expectations through `pnpm test:e2e:update --project=database-files --project=font-scaled-breakpoints` under verify-ui. In font-scaled-breakpoints only the database snapshots may change. Do not re-record Files or unrelated snapshots to hide a regression.

After implementation, cumulative diff review runs on the complete final change. Final verify-ui inspects the pinned container pixel evidence and interactions across these modes. Run the full affected frontend gate set through `pnpm gates:push -- --frontend` after the final verified commit, with the canonical push mapping controlling any additional path-triggered checks. No new native behavior is claimed, so this plan does not add a native database journey. If implementation introduces native lifecycle or IPC claims, their mandatory real-app proof must be added before release.

This PLAN-ONLY run stops after plan review and produces its metadata and review handoff. It does not implement Phase 1, mutate findings or decisions, start servers, run browser verification, stage, commit or push.

## Reviews

Plan authorship and arbitration share one root context. Detection ran in fresh Codex leaf contexts on the same model family as prospective code. No source implementation exists in this run. Raw reports and prompts remain unchanged in RUN_TMP. The review handoff will copy their complete text for adoption.

### Round 1: full plan-capable set

All twelve required leaves completed. Raw verdicts: review-plan REVISE, all other lenses APPROVED. Chess semantics, engine protocol, IPC contract, PGN index, platform semantics and Tauri security returned NOT APPLICABLE. Their reasons match the unchanged chess/native/security boundaries. Correctness reported an implementation-evidence limitation, not a finding. It remains an explicit verification limit.

* **I1 — Mosaic release and removal leave throttled movement pending.** Witness: review-plan, round 1, raw finding 1, blocker, confidence 95. **Disposition:** Fix. **Authority:** the draggable persisted split and frozen ordinary drag/reflow threat model. **Evidence:** installed 6.1.1 src/Split.tsx releases without cancelling its throttle and unmounts without cancelling it. The shipped lib/Split.js has the same mechanism. A scratch probe against that actual shipped class recorded `[["change",30],["release",60],["change",40]]`, and on separate unmount recorded `Cannot read properties of null (reading 'parentElement')`. The DOM geometry was a minimal fixture and this was not a browser proof. **Correction revision:** r2 adds Terminal ownership of Mosaic drag updates and extends its affected-consumer proof. **Dependencies:** Shared bounded database split and One validated preference across database tabs. **Closure:** awaiting review-plan and newly affected correctness, error handling, persisted-state, tests and minimalism in round 2.

Round metrics: one unique issue opened, zero resolved, one substantive plan-level adoption. No withdrawals, rewrites or splits. No carried items. Timing is recorded in the metadata/handoff after the round boundary. Downstream implementation and diff-review rework are not yet observable.

### Round 2: terminal correction and affected domains

All six selected leaves completed. Raw verdicts: review-plan REVISE, correctness, error handling, minimalism, tests and persisted-state APPROVED. The tests report nevertheless contains a should-fix and is triaged independently of its verdict. Review-plan, correctness, error handling and persisted-state explicitly closed I1 at plan level. I1 is resolved in revision r2, with implementation proof still pending.

* **I2 — Analysis regression projects do not exercise divider dragging.** Witness: review-tests, round 2, raw finding 1, should-fix, confidence 95. **Disposition:** Fix. **Authority:** correctness proof for the same primitive reused by the mandated splitter. **Evidence:** BoardsPage.test.tsx mocks Mosaic to null. Neither workspace-tabs.spec.ts nor board-keyboard.spec.ts contains a divider drag. BoardsPage's analysis tree has both a row split and a nested column split, saved to windowsState. **Correction revision:** r3 strengthens the terminal obligation's existing analysis-preservation proof with actual drags, pane dimensions, persisted percentages and reload. **Dependencies:** I1, Terminal ownership of Mosaic drag updates. **Closure:** pending review-plan and review-tests in round 3.
* **I3 — Still-mounted touch cancellation leaves the drag owner active.** Witness: review-plan, round 2, raw finding 1, blocker, confidence 93. **Disposition:** Fix. **Authority:** the frozen ordinary touch-drag threat model and the mandated draggable persisted split. **Evidence:** actual installed Split binds movement, mouseup and touchend but no touchcancel. A second runtime probe recorded four document listeners remaining after cancellation, then `[["change",30],["change",40],["change",45],["release",60]]` after unrelated movement/release. Its DOM/event dispatch is a minimal fixture, not browser proof. **Correction revision:** r3 extends the existing terminal cleanup with touchcancel, no commit on interruption, no stale document updates, and new-gesture recovery. It does not add a public API. **Dependencies:** I1, Terminal ownership of Mosaic drag updates and One validated preference across database tabs. **Closure:** pending review-plan and newly affected correctness, error handling, persisted-state and tests in round 3.

Round metrics: I1 resolved, two unique new issues opened and two substantive plan-level adoptions. Cumulative three opened, one resolved, two open. I2 and I3 are coverage/lifecycle gaps exposed by I1's adopted dependency patch, not a rewrite or a split. No withdrawals or carried items. Downstream rework remains unobservable.

### Round 3: touch cancellation and direct analysis proof

All five selected leaves completed with raw verdict APPROVED and no findings. Review-plan explicitly closed I2 and I3 against revision r3. Review-tests explicitly closed both proof obligations. Correctness, error handling and persisted-state explicitly closed I3 and its release-only database persistence dependency. These closures approve the plan, not an implementation.

I2 and I3 are resolved at r3. Cumulative totals: three unique issues opened, three resolved, zero open. Plan-level adoptions are r1=1 r2=2 r3=0. Twenty-three lens reports completed across three rounds. No Skip, Defer or carried lens findings. No withdrawals, rewrites, splits or inherited rounds. I3's underlying missing touchcancel path predates this plan, while its required ownership contract was exposed by I1. No code or tests were implemented and downstream rework remains unknown.

The final metadata and reviews-handoff.md record measured wall durations, the complete raw reports and source/probe evidence. No quota, dependency or release wait occurred during review. Ordinary leaf execution and polling count as review elapsed. Active time separated from that elapsed time is unknown.

### Round 4: PLAN-REFRESH drift round (BASE 86305a38 → NEW-BASE d3a6f614)

Refresh of the published r3 plan after 266 commits (217 files) of drift. The drift touched the plan's own files: GridLayout.tsx, GridLayout.module.css, GamePreview.tsx, GameCard.tsx, DatabaseView.tsx, FileCard.tsx, BoardsPage.tsx, e2e/fixtures.ts, e2e/database-files.spec.ts, e2e/workspace-tabs.spec.ts and translations. All twelve REFRESH-LENSES ran on the unchanged r3 text with the drift diff `drift-86305a38…-d3a6f614….diff` and a scoped excerpt `tasks/plans/.drift-scope-r4.diff`. Wall elapsed 945 s.

Raw verdicts: all twelve APPROVED. Engine protocol, IPC contract, PGN index, platform semantics and Tauri security returned NOT APPLICABLE with reasons matching the unchanged native boundaries. Review-plan, correctness, error handling, minimalism, persisted-state and tests returned no drift finding. Chess semantics reported one finding under `OUT OF DRIFT SCOPE`.

* **I4 — Preview tree identity ignores the starting FEN.** Witness: review-chess-semantics, round 4, raw finding 1, blocker, confidence 95. **Disposition:** Defer. **Reason:** outside the drift scope and outside MANDATE. It predates both bases and concerns which game the preview shows, not pane size or arrangement. **Evidence:** `GamePreview.tsx:58` mounts `<GamePreview key={pgn} …>` while the parse key is `[pgn, headers?.fen]`, and `TreeStateContext.tsx:31` creates the store only once, so a changed `initial` is ignored. Filed to the spool (`findings-inbox/20261012-181930-2629656-1791821970814007967-6.md`, status `published`). **Dependencies:** none. The adaptive obligation keeps its rule that arrangement changes never remount the tree.

Arbiter drift reconciliation (no lens witness, so no issue ID). Reading the drift against the plan showed three premises the r3 text predates. First, e95a864d introduced a second compact signal, a font-scaled viewport media query evaluated separately in DatabaseView and GamePreview. The plan's container-derived compact decision would otherwise coexist with it, and in the band where the container is below the split floors but the viewport is above 36em, stacked panes would sit in a non-scrolling view. That breaks the reachability MANDATE names ("check the 320px / 200% font-scale case") and the bounded split. Second, the new `font-scaled-breakpoints` database 320px/200% assertions and `database-game-open-320-200` snapshot were outside the phase proof and snapshot-update command. Third, GameCard's no-selection state, `OpenGameButton` and the preview's `EphemeralTabScope` are new structure the adaptive layout must keep. **Revision r5:** refresh premises appended to Traced premises, one compact decision replacing the viewport query in every database consumer, the stacked preview named as the adaptive compact case below TreeStateProvider and EphemeralTabScope, GameCard states kept, and the font-scaled-breakpoints project added to Phase 1 paths, proof and snapshot update. **Authority:** MANDATE "check the 320px / 200% font-scale case" and "Reuse whatever splitter primitive the app already ships rather than adding a second one" (one mechanism per concept, universal rule 11), plus the frozen threat model's ordinary window resizing. No new component, watcher, state file or dependency. **Closure:** review-plan and the affected correctness, tests, minimalism and chess-semantics lenses in round 5.

Round metrics: one unique issue opened (I4, Defer), zero plan-level adoptions from lens findings. Cumulative four opened, three resolved by Fix, one deferred, zero open. No withdrawals, rewrites or splits.

### plan-r6.md

# Plan: Resizable database panes and adaptive game preview

## Goal

Resolve f-20261001-09 by letting users enlarge the selected preview in Games, Players and Tournaments, with a saved bounded split and a board that uses the space available to it. Preserve Files preview behavior and reachability at 320px with 200% font scaling.

## MANDATE

### The database Games view splits list and preview 50/50 with no resize, so the preview board can never be larger than a quarter of the window width

* **ID:** f-20261001-09 · **Status:** open · **Area:** frontend-ui · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src/components/databases/GridLayout.tsx` (`<Group grow>` with two equal columns, no splitter), `src/components/databases/GamePreview.tsx:60` (`boardSide = min(frameHeight, frameWidth / 2)` when controls are shown, so the board takes at most half of the preview column), used by `GameTable.tsx`, `PlayerTable.tsx`, `TournamentTable.tsx`.
* **Defect:** Felix (2026-10-01, 2000px-wide window) wanted a bigger board while browsing "Meine Partien" and found no way to enlarge it: the table and the preview are fixed halves and the board is capped at half of its half. The analysis tab already offers resizable panes (`BoardsPage.tsx`, `react-mosaic-component`), so the database view is the odd one out.
* **Fix shape:** a draggable divider between table and preview (persisted width, bounded min/max), and a preview layout that lets the board grow into available height (stack notation under the board when the column is tall rather than always beside it). Reuse whatever splitter primitive the app already ships rather than adding a second one. Pixels via `pnpm test:e2e:container`; check the 320px / 200% font-scale case (`f-20260829-02`).
* **Open question:** which splitter primitive the database view adopts (reuse of the analysis tab's mosaic or a lighter divider), how its width is persisted, and how the preview arranges board and notation when the column is tall versus wide.
* **Why `build`:** layout design with persistence and three consumers of `GridLayout`.
* **Related:** the open-affordance finding filed in the same session (same pages, different files); `f-20260829-02` (narrow-layout clipping).
* **Found by:** Felix, session e3bd1021-4d34-443f-96c0-a1af650f0984, 2026-10-01.

## Threat model and non-goals

The inputs are ordinary window resizing, mouse/touch dragging, keyboard use, persisted preferences that may be missing or corrupted, and storage operations that may throw. The UI must remain usable after those failures. No adversarial layout input, remote protocol, filesystem privilege or native window boundary changes are proposed. The supported renderer proof is the pinned container Playwright harness, including its Tauri command mocks. Native GTK chrome remains outside that harness and this mandate.

This is the f-20261001-09 singleton slice. Opening a game directly, merging libraries, comment rendering, deletion semantics, table paging and analysis-pane management are independent mandates. No new dependency, service, watcher or alternative draggable splitter is authorized.

## Traced premises

These premises record the BASE source trace, not implementation obligations.

* BASE is `86305a389c9acbef03af6489a6761f7e0e2ca157`. The worktree was clean. Read-only `findings.py next --pin f-20261001-09 --json` selected this singleton at build tier. The splitter, persistence and adaptive-layout choices remain unsettled by existing decisions, so build remains the correct entry.
* `GridLayout.tsx:20` owns both database columns. Its three consumers are `GameTable.tsx`, `PlayerTable.tsx` and `TournamentTable.tsx`. `DatabaseView.tsx:51` bounds their tab panels inside the available desktop content area.
* `GameCard.tsx:38` places metadata, actions and preview inside a full-height ScrollArea. It does not opt into `GamePreview`'s fitHeight branch. The finding's cited explicit half-width formula therefore currently applies to Files, while the database's growing Group still allocates equal board and notation columns. Both structures constrain the database board.
* `GamePreview.tsx:60` measures a square in fitHeight mode. `GamePreview.tsx:80` owns OpeningName, board, notation and controls under one TreeStateProvider. `FileCard.tsx:164` is the other production consumer and already depends on fitHeight and hideControls. `GamePreview.test.tsx:285` and `e2e/files-preview.spec.ts:48` cover that contract.
* `BoardsPage.tsx:372` uses the installed `react-mosaic-component` and imports its stylesheet plus `src/styles/react-mosaic.css`. Its editable layout and `windowsState` preference are specific to analysis and are not a database layout model.
* The locked and installed Mosaic version is 6.1.1. Its public controlled Mosaic supports onChange, onRelease, fixed row splits, symmetric minimumPaneSizePercentage and disabled resize. Its internal Split is not a public keyboard-accessible separator. This was traced in the matching installed package under the main checkout, because this plan-only worktree has no node_modules.
* `src/state/utils.ts:19` exports createZodStorage with caught read, repair, write and remove failures and redacted reporting. Decision d-20260906-13 retains raw JSON for ordinary preferences. `layoutStorage.ts` validates a different domain, the three analysis pane IDs, and cannot be reused as the database preference schema.
* `e2e/fixtures.ts:277` provides preserveStorageForReload. The database-files project currently uses an 800px viewport at 200% font scale and empty database tab responses. The Files preview project uses 1920px at 100%. Existing clipping assertions and screenshots provide regression infrastructure but no populated database board or splitter evidence yet.
* The existing GameCard deletion failure is already pending in the shared inbox. Locate separately filed TournamentCard page-size slicing and PlayerTable/TournamentTable ArrowDown page-boundary failures. They predate this layout and are known limits, not additions to this mandate.

Refresh premises at NEW-BASE `d3a6f614f30269faf0faf566963ace264c39a66b` (drift from the BASE above, traced in the r4 refresh):

* e95a864d added a database compact mode keyed to a font-scaled viewport media query. `GridLayout.tsx:6` exports `COMPACT_DATABASE_WIDTH_EM = 36`. `DatabaseView.tsx:26` and `GamePreview.tsx:67` each evaluate it through `useScaledMaxWidth`. DatabaseView sets `data-compact` on the view, and `GridLayout.module.css` then makes the view the vertical scroll container, stacks the two panes, gives the table a fixed font-scaled viewport and wraps search and actions. GamePreview's non-fitHeight `stacked` branch puts a full-width board above notation in its own fixed-height scroll viewport with wrapped controls. GridLayout now styles its panes through that module rather than inline styles.
* e72f8008 and 367f8cdb made GameCard's `game` optional with a translated no-selection text, and added `onOpen`/`pending` with the shared `OpenGameButton` from `gameOpen.tsx`. GameInfo and the preview now render only for a selection, below the actions.
* 159de8ec and c21fce13 wrap GamePreview's content in `EphemeralTabScope` inside its `TreeStateProvider`. BoardsPage's analysis Mosaic keeps the same controlled `windowsState` contract inside a new `WorkspaceTabScope`.
* `e2e/fixtures.ts:363` and `:431` now provide a populated two-game database (`gameOpeningFixture`, `gameOpeningCommands`). `database-files.spec.ts` opens it at 1400px with a `database-labelled-game` snapshot. The `font-scaled-breakpoints` project asserts compact database preview reachability at 320px/200% with a `database-game-open-320-200` snapshot.

## Approach

### Shared bounded database split

Authority: "a draggable divider between table and preview" and "Reuse whatever splitter primitive the app already ships".

GridLayout owns a controlled Mosaic with exactly two stable tile IDs, table and preview, in row direction. Preserve all three callers' search, table and preview content. There is no pane removal, tree editing or drag-to-rearrange. Import the existing Mosaic styling where this shared layout uses it rather than depending on BoardsPage being mounted. Any database-specific CSS stays scoped to database layout.

The preferred table percentage defaults to 50 and is bounded to 20 through 80. Both panes have a font-aware floor of 20rem in split mode. Derive Mosaic's symmetric minimum percentage from the available container width and that floor, with the 20% preference bound as the minimum. Clamp the displayed ratio to those effective bounds without replacing the preferred ratio when the container shrinks.

When the container cannot accommodate both floors and the divider, show search/table followed by preview in a vertically scrollable compact layout. The splitter is absent there. Pane content remains reachable, independently scrollable where needed, with no document-level horizontal overflow or hidden rows, board ranks, notation or actions at 320px and 200% font scale. Account for the application's root font scale and actual content-container size, including sidebar space, rather than a viewport-only breakpoint. Do not persist this derived compact mode.

There is exactly one compact decision for the database view. This container-derived decision replaces the existing `COMPACT_DATABASE_WIDTH_EM` viewport media query in every database consumer: the view's scroll container in DatabaseView, the split's absence in GridLayout and the preview's compact arrangement. They must always agree, so stacked panes never sit inside a non-scrolling view or beside an active splitter. Keep the existing compact reachability behavior (view-level vertical scroll, bounded table viewport, wrapped search and actions) as this compact layout. `useScaledMaxWidth` stays for its non-database consumers.

Dragging changes the controlled layout immediately. Since Mosaic's internal divider lacks keyboard semantics, provide small labelled controls using the existing IconAction pattern to enlarge the table or preview by a bounded step. Those controls use the same ratio and constraints as dragging and visibly disable at a bound. All new labels use i18next. Keyboard navigation must reach these controls without traversing a second draggable implementation.

Proof level: unit geometry/state transitions plus populated container pixel and interaction assertions. The evidence must distinguish effective clamping from modification of the saved preference.

### Terminal ownership of Mosaic drag updates

Authority: "a draggable divider" with "persisted width", and the frozen threat model's ordinary mouse/touch dragging and window resizing. The shared split and preference obligations depend on this terminal boundary.

Apply a narrowly scoped pnpm patch to the locked Mosaic 6.1.1 dependency. Cancel its pending throttled movement before delivering the final release percentage and when Split unmounts. Release is the authoritative final displayed and persisted percentage, with no subsequent movement callback from that drag. Unmount caused by compact reflow, tab removal or leaving the view must leave no queued callback that accesses a cleared ref or updates a surviving layout owner. Correct removal of the element-owned touchstart listener on unmount as part of that same cleanup. Keep the existing public Mosaic API and version. Do not create a wrapper timer, a second splitter or a new dependency.

Handle ordinary touchcancel as an interrupted drag while the splitter stays mounted. Cancel pending movement and detach the document drag listeners, including the cancellation listener itself. Cancellation does not deliver onRelease or persist unfinished movement. Keep the last displayed ratio usable in memory and retain the last committed preference. Until a new gesture starts on the divider, later document movement or release must neither update that cancelled drag nor commit it. This uses the existing Split owner and public callback contract, without adding a new cancellation API.

The patch must affect the package's shipped runtime entry, not only its TypeScript source, and be registered in pnpm configuration and the lockfile so frozen installs reproduce it. Preserve analysis pane editing and normal drag behavior, which share this dependency. Release's final value must update the in-memory controlled layout as well as storage. Interrupted removal retains the last committed preference instead of silently saving unfinished movement.

Proof level: use the actual patched Mosaic runtime, without mocking away Split or its throttle, to queue multiple movements inside one throttle interval followed separately by release, unmount and touchcancel. Advancing timers must yield neither a post-release movement nor a cleared-ref exception or stale write. In the still-mounted cancellation case, subsequent document mouse movement and release cannot change or save the cancelled split. A new divider gesture works normally. Verify completed release's final controlled and saved ratios agree. Extend e2e/workspace-tabs.spec.ts with a real analysis-view drag assertion for both the root row divider and nested column divider. Check the affected pane dimensions, persisted windowsState node percentages and restoration through preserveStorageForReload, without mocking Mosaic. Existing workspace and board tests supplement this direct shared-consumer proof. Also run a frozen dependency install that applies the patch.

### One validated preference across database tabs

Authority: "persisted width, bounded min/max" and "three consumers of GridLayout".

Use one dedicated database split preference shared by Games, Players and Tournaments, with a finite bounded numeric schema and a distinct key. Do not key it by database path or reuse windowsState. Use the existing createZodStorage adapter and its failure reporting in accordance with d-20260906-13. No serializer migration is part of this change.

All mounted instances observe the same preferred ratio. Intermediate pointer movement stays responsive in memory. Persist completed dragging through Mosaic's onRelease and completed keyboard adjustments through the same preference update. Storage must not be rewritten on every pointer event or merely because of a resize, inactive tab render, compact transition or initial measurement. Missing, malformed, nonfinite or out-of-range data falls back to 50 under the existing repair contract. A read or write exception reports through the existing translated redacted path and does not destroy the usable in-memory state. No subscriptions or listeners may outlive their layout owner.

Proof level: focused preference tests for validation, throwing storage and committed versus transient changes, plus drag, cross-tab and reload interaction tests using preserveStorageForReload. Ordinary fixture resets are not persistence evidence.

### Adaptive database board and notation

Authority: "lets the board grow into available height" and "stack notation under the board when the column is tall rather than always beside it".

GameCard opts into adaptive preview sizing and supplies a definite remaining frame after its metadata, actions and opening label. Both expanded and compact layouts keep that content reachable. Use measured space to choose between board beside notation in a wide frame and notation below the board in a tall or narrow frame. Size the largest square board that fits the selected arrangement while reserving usable notation and control space, including gaps and font scaling. Use pixel widths for measured board geometry, so Mantine's rem scaling does not multiply that size again. Do not retain a half-of-preview-width cap in the database's adaptive mode.

The board, scrollable notation and all four navigation actions remain usable together. On very narrow frames the navigation actions may wrap to avoid clipping. Resizing or changing arrangement preserves the current game position, selection and variation chooser ownership. Do not remount the game tree merely to change orientation of the layout. Arrangement switching stays below the preview's `TreeStateProvider` and `EphemeralTabScope`. Keep board orientation, move numbering, wheel navigation and chooser behavior intact.

The existing compact `stacked` preview (full-width board, notation in its own bounded scroll viewport below, wrapped controls) is the compact case of this adaptive arrangement. It follows the single compact decision above, never a separate media query. GameCard keeps its no-selection state and its `OpenGameButton` action reachable in every layout.

Adaptive behavior is an explicit database opt-in. Files retains its current fitHeight/hideControls sizing and interaction contract. Share common geometry where it is the same concept, while preserving that distinct contract rather than forcing Files into the database layout.

Proof level: measured component cases for both arrangements, available height after headers, pixel scaling, retained position and existing Files behavior, followed by pinned container snapshots and reachability assertions.

## Decisions and trade-offs

### Decided autonomously

* **Question:** Which existing splitter fulfills the mandate? **Chosen:** controlled two-tile Mosaic. **Rejected:** a new pointer divider or exposing Mosaic's internal Split. **Reason:** the public component already provides the required drag lifecycle and bounded split without another implementation. Keyboard controls complement its missing keyboard input. **Reversal:** change only after evidence that the public component cannot satisfy the bounded split contract.
* **Question:** Which width is persisted? **Chosen:** one bounded percentage across database tabs, default 50, with transient responsive clamping. **Rejected:** per-database keys, pixel widths and the editable analysis-tree schema. **Reason:** the three shared callers express one layout preference and percentage survives window changes. The 20rem floors protect usable panes, while compact stacking preserves access below them. **Reversal:** revise bounds or scope only with observed usability evidence and review of persisted compatibility.
* **Question:** How does the board grow without regressing Files? **Chosen:** an adaptive database opt-in with definite remaining height and reserved notation/control space. **Rejected:** changing every fitHeight consumer or merely widening the fixed equal-column preview. **Reason:** the former breaks a proven separate Files contract and the latter retains the limiting half-width layout. **Reversal:** revisit through shared-preview geometry evidence, retaining Files regression proof.
* **Question:** Who performs visual acceptance and what is excluded? **Chosen:** the implementing agent through verify-ui, including both arrangements and compact mode. **Excluded:** sibling findings and the independently filed pre-existing defects. **Reason:** full auto authorizes the necessary layout decisions and the mandate specifies shared components and breakpoints. No statement here is attributed to Felix as a new decision.
* **Question:** How is the required terminal drag boundary made reliable? **Chosen:** a reproducible pnpm patch of Mosaic's existing throttle and listener cleanup. **Rejected:** relying on onRelease alone, retaining a hidden splitter to avoid cleanup, or adding a wrapper timer. **Reason:** source inspection and the actual shipped Split.js probe show a change callback after release and a cleared-ref exception after unmount. These break the new persisted split and compact transition. **Reversal:** remove the patch when a reviewed dependency release supplies equivalent lifecycle behavior and regression tests pass against it.

Governing decisions: d-20260831-16 and d-20260831-17 require reachable content and independent clipping evidence at 320px/200%. d-20260906-13 governs ordinary preference validation and failure handling. The adopting session records these new technical choices in tasks/decisions.md under that ledger's reversal rules. This plan-only session does not write that ledger.

## Risks / open questions

There are no unresolved product choices. Measurements may refine the arrangement threshold and reserved notation/control dimensions within the contracts above. Mosaic must not collapse into a zero-size initial container. Existing per-tab panels and long player/tournament metadata need scrollable wrappers, not fixed-height clipping.

The native product has not been reproduced in this plan-only run, and no screenshot, test or gate has been run for a proposed implementation. Existing source and the original observation justify design, not a claim of verified pixels. Before implementation the adopter must recheck ownership, dependency installation, Docker/container availability and the ordinary gate prerequisites. The missing worktree dependencies do not block independent plan review.

The pending deletion failure, separately filed pagination/navigation defects and the spool-filed preview tree identity defect (I4: the preview is keyed by movetext alone) remain known pre-change limits. Layout must not claim to fix them. Their independent follow-up may touch these components later and requires drift review before adoption.

## Not part of this task

No change to game opening affordances, database import/search semantics, pagination, deletion, comments, personal-card statistics, analysis Mosaic editing, engine processes, Rust/IPC, generated bindings, native chrome, permissions or dependency versions. No coverage floor or snapshot budget reduction.

## Phases

### Phase 1: Shared database layout, preference and adaptive preview

This is one cohesive independently green phase. The shared layout, persistence and preview geometry have coupled behavior and are implemented together with their regression proof. Role: sensitive, resolved through executor-profiles.md and leaf-launch.sh. Persistence is touched. No authentication, native concurrency, Rust API or permission boundary is touched.

Paths: GridLayout.tsx and its scoped stylesheet, GameCard.tsx, GamePreview.tsx and optional scoped stylesheet, a dedicated src/state/databaseLayout.ts and its tests, corresponding layout/preview/card component tests, src/components/common/MosaicLifecycle.test.tsx, the generated dependency patch under patches/, pnpm-workspace.yaml and pnpm-lock.yaml, populated database e2e coverage and fixtures, e2e/font-scaled-breakpoints.spec.ts for the compact database case, e2e/workspace-tabs.spec.ts for the shared analysis drag proof, affected database snapshots under the database-files and font-scaled-breakpoints projects, and translated labels under src/translation/. DatabaseView.tsx may change only where required to provide a bounded or scrollable layout container and to consume the single compact decision. Shared Mosaic CSS must not change analysis behavior. GameTable, PlayerTable and TournamentTable remain consumers of the shared component.

Implement the four Approach obligations above. The executor determines private helper names and fixture placement within those contracts. Follow async-resource-invariants.md, persisted-state.md and chess-tree-semantics.md, plus the push and verify-ui contracts. No manual generated binding edits. Add meaningful tests at the changed state/geometry boundaries rather than tests that mirror helper code.

**PROOF COMMAND:** `pnpm install --frozen-lockfile && pnpm exec vitest run src/components/common/MosaicLifecycle.test.tsx && pnpm exec vitest related --run src/components/databases/GridLayout.tsx src/components/databases/GamePreview.tsx src/components/databases/GameCard.tsx src/state/databaseLayout.ts src/components/tabs/BoardsPage.tsx && pnpm test:e2e:container --project=database-files --project=font-scaled-breakpoints --project=files-preview --project=workspace-tabs --project=board-keyboard && pnpm checks:pre-review && pnpm gates:contract:check`

The static-import related set is a floor. Include explicit new tests if the resolver cannot discover them. Populated cases may reuse the existing two-game database fixture. Required assertions are: populated Games at 2000px can enlarge its square board beyond the original quarter-window cap when height permits, split endpoints enforce bounds, the saved ratio survives switching tabs and reload, compact transitions preserve it, all three populated tab layouts remain reachable at 320px/200%, a populated intermediate case whose viewport is wider than the old scaled `COMPACT_DATABASE_WIDTH_EM` breakpoint while the database content container cannot fit both pane floors and the divider shows no splitter and keeps the complete table, preview board, notation and controls reachable through the view's own vertical scroll without document-level horizontal overflow, and both adaptive arrangements preserve board/notation/control usability and current position. Keep the existing Files square-board, clipping and chooser regressions green. Use both document overflow and independent ancestor-clipping checks, not screenshots alone.

The database-files fixture's ordinary 200% font setting must not silently stand in for the requested wide 100% case. Explicitly set scale/viewport for each acceptance case. First run container proof without accepting snapshots, inspect intended diffs, and update only changed database expectations through `pnpm test:e2e:update --project=database-files --project=font-scaled-breakpoints` under verify-ui. In font-scaled-breakpoints only the database snapshots may change. Do not re-record Files or unrelated snapshots to hide a regression.

After implementation, cumulative diff review runs on the complete final change. Final verify-ui inspects the pinned container pixel evidence and interactions across these modes. Run the full affected frontend gate set through `pnpm gates:push -- --frontend` after the final verified commit, with the canonical push mapping controlling any additional path-triggered checks. No new native behavior is claimed, so this plan does not add a native database journey. If implementation introduces native lifecycle or IPC claims, their mandatory real-app proof must be added before release.

This PLAN-ONLY run stops after plan review and produces its metadata and review handoff. It does not implement Phase 1, mutate findings or decisions, start servers, run browser verification, stage, commit or push.

## Reviews

Plan authorship and arbitration share one root context. Detection ran in fresh Codex leaf contexts on the same model family as prospective code. No source implementation exists in this run. Raw reports and prompts remain unchanged in RUN_TMP. The review handoff will copy their complete text for adoption.

### Round 1: full plan-capable set

All twelve required leaves completed. Raw verdicts: review-plan REVISE, all other lenses APPROVED. Chess semantics, engine protocol, IPC contract, PGN index, platform semantics and Tauri security returned NOT APPLICABLE. Their reasons match the unchanged chess/native/security boundaries. Correctness reported an implementation-evidence limitation, not a finding. It remains an explicit verification limit.

* **I1 — Mosaic release and removal leave throttled movement pending.** Witness: review-plan, round 1, raw finding 1, blocker, confidence 95. **Disposition:** Fix. **Authority:** the draggable persisted split and frozen ordinary drag/reflow threat model. **Evidence:** installed 6.1.1 src/Split.tsx releases without cancelling its throttle and unmounts without cancelling it. The shipped lib/Split.js has the same mechanism. A scratch probe against that actual shipped class recorded `[["change",30],["release",60],["change",40]]`, and on separate unmount recorded `Cannot read properties of null (reading 'parentElement')`. The DOM geometry was a minimal fixture and this was not a browser proof. **Correction revision:** r2 adds Terminal ownership of Mosaic drag updates and extends its affected-consumer proof. **Dependencies:** Shared bounded database split and One validated preference across database tabs. **Closure:** awaiting review-plan and newly affected correctness, error handling, persisted-state, tests and minimalism in round 2.

Round metrics: one unique issue opened, zero resolved, one substantive plan-level adoption. No withdrawals, rewrites or splits. No carried items. Timing is recorded in the metadata/handoff after the round boundary. Downstream implementation and diff-review rework are not yet observable.

### Round 2: terminal correction and affected domains

All six selected leaves completed. Raw verdicts: review-plan REVISE, correctness, error handling, minimalism, tests and persisted-state APPROVED. The tests report nevertheless contains a should-fix and is triaged independently of its verdict. Review-plan, correctness, error handling and persisted-state explicitly closed I1 at plan level. I1 is resolved in revision r2, with implementation proof still pending.

* **I2 — Analysis regression projects do not exercise divider dragging.** Witness: review-tests, round 2, raw finding 1, should-fix, confidence 95. **Disposition:** Fix. **Authority:** correctness proof for the same primitive reused by the mandated splitter. **Evidence:** BoardsPage.test.tsx mocks Mosaic to null. Neither workspace-tabs.spec.ts nor board-keyboard.spec.ts contains a divider drag. BoardsPage's analysis tree has both a row split and a nested column split, saved to windowsState. **Correction revision:** r3 strengthens the terminal obligation's existing analysis-preservation proof with actual drags, pane dimensions, persisted percentages and reload. **Dependencies:** I1, Terminal ownership of Mosaic drag updates. **Closure:** pending review-plan and review-tests in round 3.
* **I3 — Still-mounted touch cancellation leaves the drag owner active.** Witness: review-plan, round 2, raw finding 1, blocker, confidence 93. **Disposition:** Fix. **Authority:** the frozen ordinary touch-drag threat model and the mandated draggable persisted split. **Evidence:** actual installed Split binds movement, mouseup and touchend but no touchcancel. A second runtime probe recorded four document listeners remaining after cancellation, then `[["change",30],["change",40],["change",45],["release",60]]` after unrelated movement/release. Its DOM/event dispatch is a minimal fixture, not browser proof. **Correction revision:** r3 extends the existing terminal cleanup with touchcancel, no commit on interruption, no stale document updates, and new-gesture recovery. It does not add a public API. **Dependencies:** I1, Terminal ownership of Mosaic drag updates and One validated preference across database tabs. **Closure:** pending review-plan and newly affected correctness, error handling, persisted-state and tests in round 3.

Round metrics: I1 resolved, two unique new issues opened and two substantive plan-level adoptions. Cumulative three opened, one resolved, two open. I2 and I3 are coverage/lifecycle gaps exposed by I1's adopted dependency patch, not a rewrite or a split. No withdrawals or carried items. Downstream rework remains unobservable.

### Round 3: touch cancellation and direct analysis proof

All five selected leaves completed with raw verdict APPROVED and no findings. Review-plan explicitly closed I2 and I3 against revision r3. Review-tests explicitly closed both proof obligations. Correctness, error handling and persisted-state explicitly closed I3 and its release-only database persistence dependency. These closures approve the plan, not an implementation.

I2 and I3 are resolved at r3. Cumulative totals: three unique issues opened, three resolved, zero open. Plan-level adoptions are r1=1 r2=2 r3=0. Twenty-three lens reports completed across three rounds. No Skip, Defer or carried lens findings. No withdrawals, rewrites, splits or inherited rounds. I3's underlying missing touchcancel path predates this plan, while its required ownership contract was exposed by I1. No code or tests were implemented and downstream rework remains unknown.

The final metadata and reviews-handoff.md record measured wall durations, the complete raw reports and source/probe evidence. No quota, dependency or release wait occurred during review. Ordinary leaf execution and polling count as review elapsed. Active time separated from that elapsed time is unknown.

### Round 4: PLAN-REFRESH drift round (BASE 86305a38 → NEW-BASE d3a6f614)

Refresh of the published r3 plan after 266 commits (217 files) of drift. The drift touched the plan's own files: GridLayout.tsx, GridLayout.module.css, GamePreview.tsx, GameCard.tsx, DatabaseView.tsx, FileCard.tsx, BoardsPage.tsx, e2e/fixtures.ts, e2e/database-files.spec.ts, e2e/workspace-tabs.spec.ts and translations. All twelve REFRESH-LENSES ran on the unchanged r3 text with the drift diff `drift-86305a38…-d3a6f614….diff` and a scoped excerpt `tasks/plans/.drift-scope-r4.diff`. Wall elapsed 945 s.

Raw verdicts: all twelve APPROVED. Engine protocol, IPC contract, PGN index, platform semantics and Tauri security returned NOT APPLICABLE with reasons matching the unchanged native boundaries. Review-plan, correctness, error handling, minimalism, persisted-state and tests returned no drift finding. Chess semantics reported one finding under `OUT OF DRIFT SCOPE`.

* **I4 — Preview tree identity ignores the starting FEN.** Witness: review-chess-semantics, round 4, raw finding 1, blocker, confidence 95. **Disposition:** Defer. **Reason:** outside the drift scope and outside MANDATE. It predates both bases and concerns which game the preview shows, not pane size or arrangement. **Evidence:** `GamePreview.tsx:58` mounts `<GamePreview key={pgn} …>` while the parse key is `[pgn, headers?.fen]`, and `TreeStateContext.tsx:31` creates the store only once, so a changed `initial` is ignored. Filed to the spool (`findings-inbox/20261012-181930-2629656-1791821970814007967-6.md`, status `published`). **Dependencies:** none. The adaptive obligation keeps its rule that arrangement changes never remount the tree.

Arbiter drift reconciliation (no lens witness, so no issue ID). Reading the drift against the plan showed three premises the r3 text predates. First, e95a864d introduced a second compact signal, a font-scaled viewport media query evaluated separately in DatabaseView and GamePreview. The plan's container-derived compact decision would otherwise coexist with it, and in the band where the container is below the split floors but the viewport is above 36em, stacked panes would sit in a non-scrolling view. That breaks the reachability MANDATE names ("check the 320px / 200% font-scale case") and the bounded split. Second, the new `font-scaled-breakpoints` database 320px/200% assertions and `database-game-open-320-200` snapshot were outside the phase proof and snapshot-update command. Third, GameCard's no-selection state, `OpenGameButton` and the preview's `EphemeralTabScope` are new structure the adaptive layout must keep. **Revision r5:** refresh premises appended to Traced premises, one compact decision replacing the viewport query in every database consumer, the stacked preview named as the adaptive compact case below TreeStateProvider and EphemeralTabScope, GameCard states kept, and the font-scaled-breakpoints project added to Phase 1 paths, proof and snapshot update. **Authority:** MANDATE "check the 320px / 200% font-scale case" and "Reuse whatever splitter primitive the app already ships rather than adding a second one" (one mechanism per concept, universal rule 11), plus the frozen threat model's ordinary window resizing. No new component, watcher, state file or dependency. **Closure:** review-plan and the affected correctness, tests, minimalism and chess-semantics lenses in round 5.

Round metrics: one unique issue opened (I4, Defer), zero plan-level adoptions from lens findings. Cumulative four opened, three resolved by Fix, one deferred, zero open. No withdrawals, rewrites or splits.

### Round 5: drift reconciliation closure

All five selected leaves completed (wall elapsed 213 s). Raw verdicts: review-plan APPROVED, correctness APPROVED, minimalism APPROVED, chess-semantics APPROVED, tests REVISE. Review-plan, correctness, minimalism and chess-semantics each explicitly closed R4-A against revision r5. Tests reported R4-A not closed for one proof gap.

* **I5 — The compact-decision unification has no regression case in the band where viewport and container disagree.** Witnesses: review-tests, round 5, raw findings 1 (R4-A NOT CLOSED, blocker, confidence 94) and 2 (blocker, confidence 94). **Disposition:** Fix. **Authority:** MANDATE "check the 320px / 200% font-scale case" and the r5 one-compact-decision obligation. Proof only, no new mechanism. **Evidence:** the r5 Phase 1 required-assertion list covered 2000px growth, bounds, saved ratio, compact transitions and 320px/200% reachability, but no viewport above the scaled 36em breakpoint with a container below the two 20rem floors and the divider. Reverting DatabaseView to `useScaledMaxWidth` (`DatabaseView.tsx:26`) would pass every listed assertion while stacked panes sit in a non-scrolling view there. **Correction revision:** r6 adds a populated intermediate case asserting splitter absence, view-level vertical scroll reachability of table, board, notation and controls, and no document horizontal overflow. **Dependencies:** R4-A, Shared bounded database split. **Closure:** review-plan and review-tests in round 6.

Round metrics: one unique issue opened (I5), one plan-level adoption. Cumulative five opened, three resolved, one deferred, one open.

## Adoption and implementation (drain session d8910561-8552-4b30-bf33-e9b481739416)

Adopted through `ADOPT-PLAN` after `drain_supervisor_plans.py gate` printed `clear` (selection `b5b708fcdb86459d85fcd67270ff2136`). The plan's five autonomous decisions were recorded as d-20261012-10 to d-20261012-14. Executor: Codex (`DRAIN_EXECUTOR=codex`), routed by `leaf-launch.sh`. The orchestrator (Claude Code, Opus 5.5) wrote the briefs, arbitrated and committed. Detection ran in fresh Codex leaf contexts on the same model family as the implementing leaves, which limits independence.

### Phase 1 — one sensitive write leaf

* First proof run: red. 40 of 41 container tests passed. The only failure was `database-adaptive-wide.png` (2412 px). The orchestrator compared expected, actual and diff: the only differing region was the table's Mantine hover-type ScrollArea scrollbar, which hides `scrollHideDelay` (1000 ms) after the pointer leaves, so the capture raced that timer. This was test flakiness, not a layout defect.
* Fix round 1 (resume, same role): `waitForScrollAreaScrollbarsHidden` in `e2e/fixtures.ts` before every new database capture, re-recorded in the container, with a second container run green without updates.
* Orchestrator proof re-run: install, MosaicLifecycle (4), vitest related (12 files, 179 tests), five-project container e2e (41 passed), `pnpm checks:pre-review` (frontend mutation 365 s) and `pnpm gates:contract:check` all green. The first contract run failed only because the detached shell lacked `~/.cargo/bin` (`rustup: command not found`); a rerun with the PATH prefix was green (f-20261012-03 covers that prefix).
* Commit: `55a8808d` (after rebase onto the moved upstream).

### Diff review round 1 — REVIEWED_THROUGH 55a8808d

Lenses (Codex, `--role sensitive` for code because `src/state/**` and `pnpm-lock.yaml` are sensitive globs; `--role mechanical` for the records lens): correctness APPROVED, root-cause APPROVED, persisted-state APPROVED, code-quality REVISE, minimalism REVISE, records REVISE, error-handling APPROVED with one should-fix, tests APPROVED with one should-fix. Mixed range: the code lenses received the diff without `tasks/findings.md`/`tasks/decisions.md`, and the records lens received those two paths (push-review-policy §1b).

| ID | Lens, rank, confidence | Claim | Disposition |
|---|---|---|---|
| D1 | code-quality, blocker, 99 | `GridLayout.tsx:60/68` hardcode the keyboard step `5` | Fix — `9df3cc2e` (`DATABASE_SPLIT_STEP_PERCENT`) |
| D2 | code-quality, blocker, 97 | bare rem/px multipliers in `databaseLayout.ts` geometry | Fix — `9df3cc2e` (named constants, values unchanged) |
| D3 | tests, should-fix, 96 | GridLayout's transient-reset effects untested with an unfinished drag | Fix — `9df3cc2e` (reflow and unmount/remount tests; each red with its effect removed) |
| D4 | minimalism, should-fix, 88 | Mosaic drag gesture duplicated in two e2e specs | Fix — `05b3c0f5` (`dragMosaicDivider`) |
| D5 | error-handling, should-fix, 98 | pre-existing: DatabaseView ignores the SWR error, so a failed listing spins forever | Fix (same area: a file this diff changed) — `5bb11ebe` (alert, Retry, overview link; shared `databaseLoadFailureMessage`; key `Databases.LoadRetry`) |
| R1 | records, should-fix, 100 | f-20261012-02 overstates missing cleanup in the listed suites | Fix — `cd240051` (annotation naming the existing cleanup sites) |
| R2 | records, should-fix, 97 | d-20261010-11's 36em viewport clause is left unsuperseded | Fix — `1317179b` d-20261012-17 plus `3bfc847f` Superseded-by trailer |
| R3 | records, should-fix, 99 | f-20261012-08 attributes the failure to a late observer callback; the observer is synchronous (`process.rs:3397`, `:4568`) | Fix — `5ea70474` (annotation: cause undetermined, longer wait withdrawn) |

Arbiter note: fix-1 was first launched at `--role normal` and stopped within a minute, before it had edited any file. It was relaunched at `--role sensitive` because it touches `src/state/databaseLayout.ts`. Repairs ran the pre-review block green (frontend mutation 492 s).

### Diff review round 2 (closure) — REVIEWED_THROUGH 5bb11ebe

Lenses: code-quality (D1, D2 CLOSED), tests (D3 CLOSED), minimalism (D4 CLOSED), error-handling (D5 CLOSED), records (R1, R2, R3 CLOSED), correctness APPROVED, persisted-state APPROVED (newly triggered by the `src/state` delta; persisted contract unchanged). All raw verdicts APPROVED.

| ID | Lens, rank, confidence | Claim | Disposition |
|---|---|---|---|
| D6 | tests, should-fix, 94 | the new failure alert has no browser reachability proof (unit test mocks Mantine; no e2e enters the state) | Fix — container e2e case at 320px/200% (fix-4) |

Adopted per diff round: r1=8 r2=1.

### Diff review round 3 (closure) — REVIEWED_THROUGH fb6b993f

Repair `fb6b993f` adds a container case at 320px/200%: `list_workspace_databases` fails once, then the test asserts the alert's message, Retry and overview link are fully in view, nothing is clipped, there is no horizontal overflow, and Retry recovers. It was red with the failure branch disabled. Lenses: tests (D6 CLOSED), correctness APPROVED.

| ID | Lens, rank, confidence | Claim | Disposition |
|---|---|---|---|
| D7 | tests, should-fix, 95 | Retry causality unguarded: with no app SWRConfig, swr 2.4.0's default onErrorRetry (5 or 10 s) could satisfy the recovery assertions without the click | Fix — `96ca6ddb` (Playwright clock paused before navigation; 2 s advance shows no second listing; the click must produce the second call with the clock unchanged; red 3/3 with Retry's handler disabled) |

Process note: the round-3 lenses were launched in parallel with the pre-review run on `fb6b993f` instead of after it. That pre-review run was stopped unfinished before fix-5 (it would have held the heavy-gate lock against fix-5's container runs). The pre-review on `96ca6ddb` passed before round 4.

### Diff review round 4 (closure) — REVIEWED_THROUGH 96ca6ddb

Lenses: tests (D7 CLOSED), correctness APPROVED. No new findings. Review converged: diff_adopted_per_round r1=8 r2=1 r3=1 r4=0. No `Skip` or `Defer` in diff review. No same-mechanism reopen (the D6 to D7 lineage was a stronger test of the same new alert, not a reopened finding).

### Browser verification

Contract: `.claude/skills/verify-ui/SKILL.md`. Pixels come from the pinned container Playwright matrix (`pnpm test:e2e:container`). The change makes no native lifecycle or IPC claim, so `pnpm verify:app` is not required, and native GTK chrome is untouched. The orchestrator inspected every moved or new snapshot. `database-adaptive-wide` (2000px/100%, table at 20%): square board about 736 px, beyond the old quarter-window cap of 500 px, notation beside it. `database-adaptive-tall` (table at 80%): notation below the board, controls in view. `database-labelled-game` (1400px/200%): container-derived compact mode. `database-preview-320-200`: compact board, notation viewport and wrapped controls. `database-game-open-320-200`: the metadata row is now a horizontally scrollable, reachable strip where the old baseline overlapped its glyphs ("WHI‑TE", "S₂S"). "Open game" breaking per syllable at 320px/200% predates this change and is unchanged. Load-failure capture at 320px/200%: message, Retry and overview link fully visible. Verdict: PASS.
