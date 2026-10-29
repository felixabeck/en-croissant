# Opening game references review evidence

Current status additions are appended chronologically below the raw plan reports.

Run: opening-game-references-20261029-064642-82fa88e8. User requested clickable ChessBase preparation citations and full-auto Codex execution in a separate worktree. This record owns that feature, its proof, task records and the bounded required-CI native-test repair described below. It does not claim to review published upstream changes.

Plan authorship and arbitration shared one context. Earlier implementation and detection ran in separate Codex sessions on the same OpenAI model family, with no family separation. Main writer and substantive corrections used gpt-6.1-sol high, with bounded presentation and proof-entry work on gpt-6-luna max. Felix subsequently selected Grok, with return to Executor Codex after an actual Grok quota limit. Grok4.6 medium validated the integrated measurement and wrote the R3 code/test repairs. Two reproduced Grok read-only sandbox failures required the disclosed native OpenAI review fallback for R3. Published kit49bd7587 subsequently fixed that cause, so R4 returns to canonical Executor Grok. R4 detection shares xAI family with the R3 repairs, while the original feature and root are OpenAI. No Grok quota has been observed. Round5 routing and original provenance are preserved below. Root owns proof, arbitration and release.

## Plan review disposition

Ten completed rounds. Adoptions r1=1 r2=0 r3=1 r4=0 r5=0 r6=1 r7=0 r8=0 r9=0 r10=0. Three unique adopted plan-lens issues opened and closed, no Skip or Defer. Supplied mechanism corrections remain separate from independent adoption counts. All four r10 lenses approved at plan level. R4 explicitly closed original DR1. Its new correction-created confidence follow-up DR12 remains pending repair and closure. Current publication aliases and the immutable private records are documented below.

- PR-1, error-handling r1 finding 1, should-fix confidence90. Fix. Source discovery already retains safe localized failure distinctions. O2 was corrected to carry safe typed source-qualified reasons through failed and zero-result searches. Plan and error-handling r2 explicitly closed it.
- PR-2, tests r3 finding 1, blocker confidence92. Fix. O4 requires candidate-retention through a query-sensitive source that excludes out-of-range dates. Plan and tests r4 explicitly closed the plan correction. Root later proved the implemented regression fails with only the production correction removed.
- PR-3, plan r6 finding1, blocker confidence100. Fix. Root supplied the explicit frozen operative plan path and canonical generated revision block. The same-revision plan evidence check explicitly CLOSED the packet omission. All five r6 lens classes approved the native test-proof contract. Implementation was separately unverified at that checkpoint, the completed native replay and gate below supersede it.

Round wall times are r1 239.7s, r2 208.6s, r3 435.9s, r4 196.2s, r5 437.5s and r6 711.8s from prompt preparation through its last report. Parallel reviewer durations are not summed as active work. Active review wall is unknown. R6 includes local memory launch waits and packet correction, with subsequent arbitration also overlapping the documented rebase recovery. No provider quota wait or executor switch occurred. Final implementation and cumulative code review are separate obligations.

## Early root implementation inspection and proof

The shared safe comment reader and all PGN text remain unchanged. Rendered references span existing rich formatting and skip external anchors. One notation owner bounds and cancels local Library search. Candidate matching preserves ordered players, ratings and outcome, then resolves event/site boundaries before dates. Search completeness and candidate verification are separate. Only an exhaustive single verified occurrence auto-opens. The existing tab transaction and original linked occurrence resolver retain FEN, headers, annotations and variations. The shared database-game seed serves both existing lists and the new opener.

Root inspected every production change and new module, their adjacent opening and query contracts and the associated tests. Initial worker proof passed 1166 tests but its pre-review attempt failed and ended143 after its own supervisor stopped mutation. It is never green evidence. Root adopted the observed AppModal boundary refusal, selective Unicode surname discovery and three path-only coverage scope alignments. The mirror seed-object test was removed in favor of decoded admission evidence. Subsequent related proofs passed1169 and1183 tests. The final label correction preserves the entire unterminated tail for matching while keeping ordinary following prose outside the clickable label.

Root gate-root-proof.xKg9ht completed0. Related proof passed24 files and1185 tests. UI boundary and frontend coverage mapping passed292 production files in10 existing areas. The parsed baseline comparison proves every non-scope value and every numeric area value is identical. git diff --check passed. pnpm build produced the release desktop binary successfully.

Root used a uniquely contextual Git patch to reverse only the event/date production correction, keeping the query-sensitive tests. git apply -R --verbose succeeded without offsets. Both retained candidate cases failed at status1. Exact forward restoration matched the saved source bytes, and the same selector passed0. Full related proof then passed. Scratch receipts are root-metadata-removed.log/.exit, root-metadata-restored.log/.exit and metadata-fix.patch under the run directory. No controlled source modification remains.

Exact published base f187917677a094c8f55dc926174308ea41254a3f measured gzip entry555617, largestLazy481476 and total1649805. At this early checkpoint, the candidate and root release build measured556148/485956/1660199. The later accepted phase1 measurement below supersedes those candidate figures. Packages, lockfile, workspace and Vite config were unchanged. Current decision d-20261029-18 governs the independently plan-reviewed total-only1670000 allowance and three scope-only coverage memberships. Its former branch-local identifier is mapped explicitly below. All numeric coverage floors and the entry565000/largestLazy550000 limits remain.

The first container citation run failed because its 800px Library preview intentionally hides notation. Its screenshot shows a healthy preview board and selected preparation, with no notation actions. The full-notation entry correction is delegated, with no product-layout change or reduced expectation. No snapshot from that failed run is accepted.

The first native staging attempt gate-citation-assertions-negative.ZzGNRh failed at existing practice rating6 before any CR assertion. The external controller had changed no input and was disconnected. Observed native exit1 is not CR staging. The failure and no-diagnosis rerun route were appended through findings.py to existing related f-20261011-05. Disposable profiles cleaned. The later completed native staging and ordinary acceptance receipts will supersede this pending status explicitly.

## Reviewed plan snapshot through round 4

The snapshot below retains its chronological pending statements as history. The disposition and measured proof above supersede their pending implementation status. The later cumulative review and release sections will name their own final state.

# Plan: clickable ChessBase game citations

## Goal
Click an imported preparation's game citation to find and replay that game from ChessFable's Library.

## MANDATE
Original request: "As you see in the animation, I have some games linked in my opening preparation. Those games, I added them in Chessbase. They are from the MEGA database 2025. I'm not sure if it's possible to link them here as well. So in Chesspace I could just click on them and then those games opened and I could replay them. Is it possible to add the same thing here?"
Scope amendment: "If you can do this, then do it full auto, execute the codex on a separate worktree."

## Threat model and non-goals
Ordinary imported ChessBase PGN comments, local Library databases and supported linked game collections, including incomplete metadata, abbreviated names, missing sources, multiple matches, source changes and cancelled searches. Imported text is data, never executable markup. Native capability checks and linked-source stamps remain authoritative.
No proprietary CBH/CBV reader, bundled Mega Database, network game search, new persistent citation format, automatic user-file edits, new dependency or new gate.

## Traced premises
- src/components/common/Comment.tsx:5 renders the shared comment notation with safe external links and no citation handling.
- src/utils/commentNotation.ts:23 and :58 share Markdown reading with the editor. src/utils/pgnComment.ts:35 preserves opaque PGN commands separately. Citation decoration can leave those contracts untouched.
- src/components/common/GameNotation.tsx:472 and :482 and src/components/common/CompleteMoveCell.tsx:146 and :177 converge on Comment, including root and variation-leading comments.
- The actual Schw_Caro Kann.pgn exported preparation at line 260 contains the screenshot's result-prefixed Beerdsen,T (2520)-Bluebaum,M (2651) and Srinath,R (2255)-Deac,B (2690) citations followed by event, year, round and ordinary prose. Across the workspace 332 result-prefixed citations were observed, including missing ratings, missing years, ICCF events and Unicode surnames. Source files were inspected read-only and must not be committed.
- Exact metadata fixtures copied from that read-only source are `0-1 Beerdsen,T (2520)-Bluebaum,M (2651) Elllobregat op 3rd Sant Boi de Llobregat 2022 (3)` and `0-1 Srinath,R (2255)-Deac,B (2690) Titled Tuesday intern op 19th Dec Late Chess.com INT blitz 2023 (6)`. The surrounding source prose is not part of either citation.
- src/utils/db.ts:261 discovers ordinary and linked collection databases and exposes unread or unavailable sources. src/utils/db.ts:202 and :232 provide cancellable, paginated game and player queries.
- src-tauri/src/db/mod.rs:1792, :1829, :1897 and :2216 define existing pagination, player IDs, color, outcome and inclusive date filters. Round and event are returned metadata. Player filters require explicit sides.
- src/utils/tabs.ts:531 and :551 guard admission and open original PGN for linked records using the existing locator. src/components/databases/GameTable.tsx:68 and src/components/panels/database/GamesTable.tsx:43 duplicate the same database-game tab seed.
- src/components/common/gameOpen.tsx:9 supplies repeat-activation protection. scripts/verify-app.mjs already has a disposable real-game opening journey and reusable native pointer helpers.
- Docker, WebKitWebDriver, tauri-driver, kwin_wayland and GStreamer are available. No server was listening on the project's shared 4173 or 1420 ports at Locate. The worktree is clean, tracks origin/master and has the expected origin.

## Approach

### O1 — recognize citations without changing the preparation
One shared pure recognizer derives non-overlapping references from the result and ordered player pair, including optional ratings and optional identifiable event/year/round metadata. The two actual screenshot citations must be recognized. Incomplete metadata remains searchable without inventing missing fields.
Decorate the visible citation label in rendered comments, retaining all characters, existing rich formatting, surrounding prose and existing external links. Recognition must work across ordinary emphasis within a citation. Unknown or malformed prose stays readable. Existing PGN import, editor, storage and export remain unchanged. Prove original source text and opaque commands survive a parse/save/reparse and that activation uses the correct reference.

### O2 — resolve local games honestly
Use existing Library discovery and cancellable paginated player/game APIs, with ordered colors and outcome filters. Resolve abbreviated initials against stored full names without treating surname substrings as identities. Unicode names, optional metadata and ratings must have explicit conservative matching semantics.
Return matching source-qualified game occurrences. A unique complete match may open immediately. Ambiguous matches show a compact selection with the actual players, date, event and source. Missing games or an empty Library explain that referenced games must first be exported from ChessBase as PGN and added to the Library.
Tournament names may themselves contain years. Candidate event/site headers must resolve that boundary before treating a numeral as the game date. A valid citation such as an event named BEL-NED 2017 at ICCF must not be rejected because its actual Date is unknown or later. Preserve all identifiable supplied metadata constraints, and require explicit selection if the remaining citation context cannot be verified. Do not filter the actual game out using an inferred date before its event boundary is known.
An unread database, unavailable collection, omitted games, query error or exhausted search budget is incomplete search, never a definitive no-match or uniqueness result. Preserve successful candidates with a localized warning and explicit selection. Use bounded pages and bounded retained candidates. A budget stop remains visible as incomplete.
Keep source-qualified failure reasons and safe typed error categories through lookup and display. Existing permission, missing-resource and unavailable-source guidance remains actionable, including when no candidates succeed. Never expose raw native diagnostics. Retry reruns failed reads through a new owned request rather than hiding a failed source as an empty result.
A search has an owner and generation, cancellation, terminal success/error state and cleanup. Closing, replacing the request or retiring its notation source prevents stale publication or automatic opening. Retry is an explicit read-only fresh request. No unbounded cache, background scan or persistence.

### O3 — open the selected full game through the existing admission path
Use createTab and runTabCreation, retaining every header, real FEN and database or linked-source identity. Extract the repeated database-game tab seed into one shared helper and route both existing database lists and the citation opener through it. Preserve existing list gestures and error behavior.
Protect duplicate activation. A selected open that has begun admission may finish under the existing createTab contract. Do not claim that aborting lookup cancels tab admission. Refused admission leaves the source preparation and shows the existing error. Linked-source staleness must never fall back to another ordinal. Prove replayable content and correct origin, including the original annotated linked PGN, rather than only mock call counts.

### O4 — verify the complete interaction
Meaningful unit and component tests cover recognition, matching, pagination, ambiguity, empty and incomplete search, cancellation and admission failure, with the actual screenshot metadata as fixtures and synthetic game moves.
The O2 event/year correction has a query-sensitive lookup regression that retains a BEL-NED 2017 / ICCF game with an unknown or later Date. The query fake must actually exclude rows outside submitted date bounds, so restoring the premature event-year filter makes the candidate assertion fail. Contradictory actual date metadata still rejects a candidate.
Add the citation journey to the existing container browser suite with committed screenshots of clickable notation, the choice state and missing-source guidance, including 320px layout and keyboard use. Existing snapshots are expected unchanged. New snapshots are recorded only inside the canonical container after its initial run and visual inspection.
Extend the existing real-app verification journey only as necessary to prove citation activation, native local lookup and full-game admission under its disposable profile. Use its existing driver, not another tool. Any added verifier assertions require source-derived staged failure evidence with observed exit status recorded in the verifier header or handoff.
The root reruns worker proof, performs production-fix removal with tests retained, and inspects screenshots. Type checks alone do not complete this task.

## Decisions and trade-offs
Decided autonomously under full auto:
- Derive citations at render time and search existing Library sources. Reject persistent proprietary links, guessed remote downloads and modifying user PGNs. This follows the existing Library product decision and the request to click imported citations.
- Open only a uniquely verified complete match automatically. Retain an explicit choice for ambiguity or incomplete searches. Reject selecting the first database row.
- Use the existing comment typography and blue link/action styling, and existing modal, alert and Open game controls. No new design system. Citation actions remain inside the chess notation and source metadata distinguishes candidates.
- Agent performs visual and real-product acceptance. Codex is the selected writer and review executor.
Applicable precedent: d-20261010-02, d-20261010-03, d-20261013-16, d-20261013-17 as amended by d-20261018-08 and d-20261018-10, and d-20261027-23. No existing list gesture or shared comment dialect is redefined.
Reversal path: remove the render decoration and citation lookup UI, retaining the shared database-game opener if its existing two callers remain.

## Risks / open questions
Mega Database contents may not be registered locally. The feature can resolve only games present in supported Library sources. Exporting those games as PGN is an external prerequisite for replay, never something reconstructible from citation text. No user question is needed to implement and verify this boundary.
Metadata may identify several occurrences. Preserve the choice rather than guessing. Search does not promise one immutable snapshot across concurrent standalone database mutations. Existing source validation remains authoritative at opening.

## Not part of this task
Changing preparation prose or drawings, converting repertoires to databases, engine behavior, downloading licensed games, redesigning Library, native GTK chrome.

## Phases
One cohesive implementation phase, followed by cumulative review, browser/desktop verification and final release gates.

Phase 1 — citation lookup and notation interaction. Codex write leaf, normal role because the architecture is settled and no sensitive native or persisted-state source changes are needed. File ownership:
- New src/utils/gameReferences.ts and src/utils/gameReferences.test.ts for recognition and lookup
- New src/utils/databaseGame.ts and its test if needed for the shared tab seed
- New src/components/common/GameReference.tsx and src/components/common/GameReference.test.tsx for the notation-owned interaction
- src/components/common/Comment.tsx, Comment.test.tsx, GameNotation.tsx and GameNotation.test.tsx as needed for rendering and ownership
- src/components/databases/GameTable.tsx and its test, src/components/panels/database/GamesTable.tsx and its test for shared opening
- Existing src/utils/tests/chess.test.ts and annotation/AnnotationEditor.test.tsx only for preservation proof when needed
- src/translation/ catalogs through i18next extraction, coverage-areas.json path membership only with no floor/baseline changes
- e2e/game-references.spec.ts, playwright.config.ts project registration if required, e2e/fixtures.ts only necessary mock support, and new canonical snapshots
- scripts/verify-app.mjs only the existing real-product scenario extension
- docs/game-references.md with concise feature operation and PGN prerequisite
No backend, bindings, dependency, capability, persistence or foreign work changes.
Gate-bookkeeping amendment, authorized by the existing docs/coverage.md and docs/bundle-budgets.md routes: coverage-baselines.json may add exactly the three new scope memberships while all parsed non-scope data and numeric areas remain identical. After independent review of measured feature growth, bundle-budgets.json may raise only total from 1,650,000 B to 1,670,000 B and refresh measurement metadata, with the comparison recorded in docs/bundle-budgets.md. Entry and largest-lazy limits retain their existing values. A fresh final candidate measurement must remain inside the proposed total. This amendment supersedes the earlier blanket metadata-file exclusion only for these exact operations.
Exact phase proof:
`pnpm exec vitest related --run src/utils/gameReferences.ts src/utils/databaseGame.ts src/components/common/GameReference.tsx src/components/common/Comment.tsx src/components/common/GameNotation.tsx src/components/databases/GameTable.tsx src/components/panels/database/GamesTable.tsx`
Then `pnpm checks:pre-review` before root commit and cumulative review.
Final visual proof: `pnpm test:e2e:container`, inspect screenshots, then `pnpm build` and `pnpm verify:app --screenshot <run-tmp>/verify-ui/citations.png`.
Final release proof on clean reviewed tree: `pnpm gates:push -- --frontend`, required remote CI and installer per push skill. Record plan/review history and technical decisions before final gates. Push only rebased commits to configured origin/master, then the validated post-push build-ledger record.

## Reviews
Pending round 1. Plan authorship and arbitration share one root context. Detection runs in separate Codex sessions on the same OpenAI model family as the code.

### Round 1 — retained history
All eight raw verdicts were APPROVED. Plan, minimalism, correctness, tests, error-handling and chess-semantics reviewed. PGN-index and persisted-state returned NOT APPLICABLE because no native search or persistence contract changes. Every raw report is retained in the run scratch and will be copied verbatim into the tracked review handoff before gates.
PR-1, error-handling r1 finding 1, should-fix, confidence 90: O2 did not explicitly retain actionable typed failure distinctions. Disposition Fix. Evidence: src/utils/db.ts retains source names and localized permission, missing-resource and unavailable-index guidance, and src/platform/errors.ts exposes safe typed categories. O2 now preserves source-qualified safe reasons through the warning even for zero successful candidates. Authority: MANDATE requires opening the cited game, which requires explaining source-read failures instead of treating them as absent games. Correction closure pending round 2.
The plan lens's named fixture limitation is addressed by adding the exact two metadata strings under Traced premises. This supplies missing source evidence without changing behavior or scope. Other named limitations concern implementation details and remain for cumulative diff review.
Plan adoptions r1=1. No issue was deferred or skipped. Plan authorship and arbitration share one context, detection uses the same OpenAI family as the selected code writer.

### Round 2 — correction closure
Plan and error-handling both returned APPROVED and explicitly closed PR-1 against the final O2 contract, with src/utils/db.ts and src/platform/errors.ts evidence. No new finding. Plan adoptions r2=0. All plan issues closed. The complete raw closure reports remain in the run scratch for the tracked handoff. Full auto skips a separate approval stop.

### Implementation evidence and round 3 technical correction
The implementation leaf's first related proof passed 1,166 tests. Pre-review was red for unaligned coverage scope and total bundle growth, and the worker stopped its own remaining mutation lane through its supervisor. Root found the direct Modal import with an observed ui:boundary:check exit 1. Bounded repair replaced it with AppModal, used selective Unicode surname fragments in large sources, removed a test that mirrored the tab-seed object and added supported-header admission proof. Its related proof passes 1,169 tests. Coverage mapping passes for 292 files across ten areas. The manual scope-only comparison proves all parsed non-scope baseline data identical and only the three new memberships added.
Measured published base f187917677a094c8f55dc926174308ea41254a3f, production build in a separately created and now removed owned worktree: entry 555,617 B, largest lazy 481,476 B, total 1,649,805 B gzip. Current repaired candidate based on that published source: entry 556,146 B, largest lazy 485,620 B, total 1,659,865 B. Whole-build differences are +529 B entry, +4,144 B largest lazy and +10,060 B total. package.json, pnpm-lock.yaml, pnpm-workspace.yaml and vite.config.ts are identical. Both measurements use pnpm build-vite and the existing buildBundleReport on this machine with the frozen lockfile. The existing total ceiling has only 195 B headroom at the published base. The proposed 1,670,000 B total leaves 10,135 B at the current candidate, subject to final remeasurement after any correctness repair. Lazy splitting cannot reduce this all-assets total. Removing required matching, source failure reporting or localized operation text would weaken the requested feature. No new library is added. Precedent is d-20261027-14 and docs/bundle-budgets.md's conscious feature-growth route. This is a technical gate allowance, not a product change.
Root identified a further O2 implementation risk from the real corpus: the citation BEL-NED 2017 ICCF contains a year followed by a site. The current recognizer treats the first standalone four-digit number as Date, then get_games filters by that inferred year. The candidate event may itself be BEL-NED 2017, so matching must use candidate event/site evidence before deciding which remaining fields are dates. Authority is the fixed MANDATE's existing imported game references and O2's conservative handling of optional metadata, not a new citation format. Proposed correction is the O2 boundary contract above, with bounded source-qualified matching and explicit choice for unverified context. Review round 3 judges this correction and the exact metadata allowance before further implementation. No past verdict is rewritten, and no new round-3 adoption is counted before reports.

### Round 3 — technical correction review
Plan, minimalism and correctness returned APPROVED, accepting the O2 event/site boundary and the exact scope-only and total-only allowances. Tests returned REVISE with PR-2, finding 1, blocker, confidence 92: the correction needs a query-sensitive lookup regression, because existing mocks return rows regardless of submitted date filters. Disposition Fix. O4 now requires the observable retained-candidate assertion through a query-sensitive fake, plus rejection of a contradictory actual date. Authority is O2 and the MANDATE's correct game-opening behavior. PR-2 closure pending round 4. Plan adoptions r3=1. No Skip or Defer. Raw reports remain unchanged in scratch for the durable handoff.

### Round 4 — PR-2 closure
Plan and tests returned APPROVED, explicitly closing PR-2 against the query-sensitive lookup obligation. No new issue. Plan adoptions r4=0. The metadata implementation and final measurement remain pending, not proven by plan approval. Detection is in separate Codex sessions on the same OpenAI model family as the code, and plan authorship and arbitration share the root context.



## Raw plan lens reports

### lens-chess-semantics-r1.txt

``````text
No chess-domain invariant violations found in plan-r1. O1 preserves tree comments, and O3 requires the selected game’s full headers, starting FEN and original linked PGN through the existing admission path. No new position comparison or retained move path is proposed.

Read-only source review. No files changed or tests run.

VERDICT: APPROVED
``````


### lens-correctness-r1.txt

``````text
No correctness mismatch found in O1–O4 against the inspected rendering, query and tab-admission contracts.

Limitation: recognition grammar, matching predicates and cancellation guards remain implementation-dependent and require diff review (confidence: 100). Review used the same OpenAI model family as the planned executor. No files changed or tests run.

VERDICT: APPROVED
``````

### lens-correctness-r3.txt

``````text
No correctness defects found in plan-r3. O2 addresses the BEL-NED 2017 boundary without dropping player, result or rating constraints. The supplied measurements support the exact gate amendment.

Limitation: the current source still uses the premature year filter. This approves the planned correction, not its implementation (confidence: 100).

VERDICT: APPROVED
``````

### lens-error-handling-r1.txt

``````text
[should-fix] /tmp/build-build-opening-game-references-20261029-064642-82fa88e8/plan-r1.md:34 — O2 requires a localized incomplete-search warning but leaves typed failure surfacing unspecified. Permission failures, missing sources and query failures could all become the same warning, losing actionable distinctions already available through `AppError` and discovery messages. Require source-qualified failure reasons to survive lookup and reach the warning, including when no candidates succeed (confidence: 90).

VERDICT: APPROVED
``````

### lens-error-handling-r2.txt

``````text
PR-1 CLOSED — O2 explicitly preserves source-qualified safe failure reasons and typed categories, actionable guidance with zero candidates, incomplete-search warnings, and retry through a fresh owned read-only request. O3 retains existing admission-error behavior.

VERDICT: APPROVED
``````

### lens-minimalism-r1.txt

``````text
No bloat or duplication defects found.

Smallest sufficient implementation by proposed new file:

- `gameReferences.ts` and its test: citation recognition and bounded lookup using existing database APIs.
- `databaseGame.ts` and optional test: extract the duplicated tab seed and route both existing lists plus citation opening through it.
- `GameReference.tsx` and its test: own citation lookup, selection and cancellation within notation.
- `e2e/game-references.spec.ts` and snapshots: verify the new interaction through existing browser infrastructure.
- `docs/game-references.md`: concise operation and local PGN prerequisite.

No planned file is demonstrably deletable without relocating required behavior or proof. O1–O4 support the mandate without requiring speculative backend, persistence or tooling extensions.

Limitation: implementation-level pass-through layers and duplicated matching logic remain assessable only once a diff exists (confidence: 100).

VERDICT: APPROVED
``````

### lens-minimalism-r3.txt

``````text
VERDICT: APPROVED
``````

### lens-persisted-state-r1.txt

``````text
NOT APPLICABLE: The Phase 1 manifest excludes persistence changes. O1 preserves storage, O2 prohibits persistence, and O3 retains the existing createTab admission contract. No obligation changes storage encoding, keys, atom families, hydration or tab lifecycle.

VERDICT: APPROVED
``````

### lens-pgn-index-r1.txt

``````text
NOT APPLICABLE: Phase 1 changes frontend citation recognition, lookup orchestration and game opening. PGN byte scanning, offset caches, database indexing, encoding, storage and native search predicates remain unchanged.

VERDICT: APPROVED
``````

### lens-plan-r1.txt

``````text
No substantiated plan defects found.

Named limitation — `/tmp/build-build-opening-game-references-20261029-064642-82fa88e8/plan-r1.md:18` supplies player names and ratings but omits complete citation strings. Fidelity of the required screenshot fixtures could not be independently verified (confidence: 100).

Read-only inspection traced comment rendering, Library queries and qualified tab admission. No tests or gates ran. No files changed.

Review used the orchestrator’s OpenAI model family, so family separation was absent.

VERDICT: APPROVED
``````

### lens-plan-r2.txt

``````text
PR-1 CLOSED — plan-r2 O2 at tasks/plans/.plan-2026-10-29-opening-game-references-r2.body.md:36 explicitly preserves source-qualified actionable reasons, safe typed errors and fresh retry with zero or successful candidates. This matches discovery guidance in src/utils/db.ts:255, :285, :307 and :344, plus typed normalization in src/platform/errors.ts:239. No additional substantiated plan defects found.

VERDICT: APPROVED
``````

### lens-plan-r3.txt

``````text
plan-r3 correction check: accepted. O2:35 addresses premature date filtering at `src/utils/gameReferences.ts:306`. Candidate event/site metadata already exists at `src-tauri/src/db/mod.rs:2182`.

The exact scope-only baseline amendment and total-only bundle allowance are supported by the supplied evidence. No plan defects found.

Limitation (confidence: 100): implementation repair and final gates remain unverified. Review and implementation share the OpenAI model family.

VERDICT: APPROVED
``````

### lens-plan-r4.txt

``````text
PR-2 CLOSED — plan-r4, tasks/plans/.plan-2026-10-29-opening-game-references-r4.body.md:46 now requires observable candidate retention through a date-sensitive query fake, plus contradictory-date rejection. This catches the premature filter at src/utils/gameReferences.ts:306 under the inclusive native predicates at src-tauri/src/db/mod.rs:1933. The plan-level verification gap is closed (confidence: 96).

VERDICT: APPROVED
``````

### lens-tests-r1.txt

``````text
VERDICT: APPROVED
``````

### lens-tests-r3.txt

``````text
[blocker] tasks/plans/.plan-2026-10-29-opening-game-references-r3.body.md:45 — The O2 correction has no explicit regression proof through lookup. Existing fixtures use unambiguous date years, and the query mock returns games regardless of date filters. Require a query-sensitive lookup assertion that retains a BEL-NED 2017 / ICCF candidate with unknown or later Date. Otherwise, restoring the premature 2017 date filter could pass the stated matching tests while excluding the actual game. (confidence: 92)

VERDICT: REVISE
``````

### lens-tests-r4.txt

``````text
PR-2 CLOSED — O4 at tasks/plans/.plan-2026-10-29-opening-game-references-r4.body.md:46 requires a query-sensitive fake and an observable retained-candidate assertion. Restoring the premature 2017 date bounds would exclude the unknown/later-Date game under the native inclusive comparisons and fail that assertion. Contradictory actual dates must still reject. This closes the plan obligation, not implementation verification. (confidence: 97)

VERDICT: APPROVED
``````

## Browser recording and real-input citation staging

The earlier pending browser-entry correction is complete. fix-2 opens the preparation through its existing Open game action, verifies e4/c5 and exact file origin, then waits for the referenced target's origin rather than the already-active route. The return path reselects the collection. Worker typecheck and bundle checks passed. Its final non-update container run reached the expected missing image and passed the unique-opening scenario.

Root inspected the actual notation, 320px candidate-choice and 320px missing-guidance images. Root then ran pnpm test:e2e:update --project=game-references in the canonical container. gate-citation-snapshot-recording.GMv9wG completed0 with both journeys passed. Exactly three new snapshots were written and inspected: citations-notation-game-references.png, citations-choice-320-game-references.png and citations-missing-320-game-references.png under e2e/game-references.spec.ts-snapshots. No existing snapshot changed. This is preliminary browser proof, with final acceptance after cumulative review still required.

fix-3 changes only the new native journey entry to the full preparation notation and waits for actual active-tab identity after citation lookup/selection. fix-4 reuses the existing file-probe wait bound, records the measured CR staging and corrects the inherited DS2 decoder. CR1–CR4 comparison predicates and fixture bytes are unchanged. Root inspected the exact diff against the staged module copy. Node syntax and diff checks passed.

The earlier practice-stop rerun passed all 50 real ratings and reached every new CR assertion. f-20261011-05 retains the original intermittent observation without an invented cause. The CR staging run deliberately changed only disposable actual DOM nodes or actual compressed session-storage values at the observation boundary, using the already-running WebDriver session. The unchanged verifier captured the bad input. Root restored the exact original input immediately, before its existing comparison evaluated the captured value. An external Node debugger only paused/resumed the unchanged module. No fake IPC, fixture, imported-library or verifier-logic change was used. The stager disconnected after restoration.

Native staging module SHA256 was 3915ce99453249561009967b1c483d167deebaeafd53234d79b9988914e3692d. The completion record below proves actual failure status1, equal to the documented assertion failure status1. It is not an isolated exit-causality claim. Inherited DS2 failed because it parsed the published compressed database selection as JSON. Four inherited screenshot assertions and the final screenshot also failed because root had omitted the output directory. Root created the missing directory. Those failures do not become product defects and are not credited as citation staging. The complete ordinary positive native journey remains pending.

f-20261029-02 records the observed DS2 decoder defect, with existing related f-20261010-01. The exact decoder correction keeps successful type, handle and decimal-string size comparisons and changes only the obsolete plain-JSON live wording. Historical receipts remain unchanged. Its own real-input staging and ordinary acceptance are separate obligations.

New source failure sinks are the four existing assertion-wrapper FAIL paths CR1–CR4, each staged below. Fixture-readiness guards, disabled/missing pointer targets and bounded-wait failures feed those same CR failure sinks and were not individually injected. No separate helper-branch staging or full inherited-verifier matrix completeness is claimed. Inherited normal/fatal/signal exit1, cleanup and historical assertion gaps retain their existing receipts and limitations.

Observed completion records:

```text
1 citation-assertions-negative 20aa84546d04e3bc7d9c76e96e72a4c424a2c0a0
0 citation-input-stager 20aa84546d04e3bc7d9c76e96e72a4c424a2c0a0
```

Actual distinguishable failure output:

```text
FAIL  CR1 imported formatted citations preserve prose and expose accessible notation actions
      citation notation mismatch: {"labels":["STAGED CR1 missing citation","0-1 Srinath,R (2255)-Deac,B (2690) Titled Tuesday intern op 19th Dec Late Chess.com INT blitz 2023 (6)","0-1 Unlisted,Z-Unknown,Q 2021 (99)"],"prose":true,"bold":null}, renderer state: {"selected":[],"controls":[],"path":"/"}
FAIL  CR2 citation native database lookup admits the exact full game and starting FEN
      citation database admission mismatch: {"tab":{"name":"Beerdsen, Thomas - Bluebaum, Matthias","value":"26799e27-7f3b-4123-9d9e-0693a483ce45","type":"analysis","gameOrigin":{"kind":"database","database":{"id":{"id":"0b33f316-e97c-4e11-9566-7d92504d7d75"},"kind":"database"},"gameId":1}},"tree":{"dirty":false,"sourceStamp":null,"appendAttempted":false,"position":[],"root":{"fen":"8/8/8/8/8/8/6k1/K7 b - - 12 23","move":null,"san":null,"children":[{"fen":"8/8/8/8/8/5k2/8/K7 w - - 13 24","move":{"from":14,"to":21},"san":"Kf3","children":[],"score":null,"depth":null,"halfMoves":46,"shapes":[],"nags":[],"comment":""}],"score":null,"depth":null,"halfMoves":45,"shapes":[],"nags":[],"comment":""},"headers":{"id":1,"fen":"8/8/8/8/8/8/6k1/K7 b - - 12 23","event":"Elllobregat op 3rd","site":"Sant Boi de Llobregat","date":"2022.12.01","time":null,"round":"99","white":"Beerdsen, Thomas","white_elo":2520,"black":"Bluebaum, Matthias","black_elo":2651,"result":"0-1","time_control":null,"eco":null},"report":{"inProgress":false,"operationId":null},"practicePath":null}}, renderer state: {"selected":[],"controls":[],"path":"/"}
FAIL  CR3 citation native linked lookup admits original annotations, variations and file occurrence
      citation linked admission mismatch: {"tab":{"name":"Srinath, Rao - Deac, Bogdan","value":"f0a9ef7b-f6f9-44ae-8ab9-2ae866cbc298","type":"analysis","gameOrigin":{"kind":"file","file":{"type":"file","handle":{"id":{"id":"3e1e3b4a-cbb5-4035-b99b-40f56997aae3"},"kind":"fileWorkspace"},"name":"verify-citations-447fabef-05e3-4592-92e5-e13779a3199a-linked.pgn","numGames":1,"metadata":{"type":"game","tags":[]},"lastModified":1793260776369},"gameNumber":0}},"tree":{"root":{"fen":"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1","move":null,"san":null,"children":[{"fen":"rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1","move":{"from":11,"to":27},"san":"d4","children":[{"fen":"rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2","move":{"from":51,"to":35},"san":"d5","children":[],"score":null,"depth":null,"halfMoves":2,"shapes":[],"nags":[],"comment":""}],"score":null,"depth":null,"halfMoves":1,"shapes":[],"nags":[1],"comment":"citation source annotation"},{"fen":"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1","move":{"from":12,"to":28},"san":"e4","children":[{"fen":"rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2","move":{"from":52,"to":36},"san":"e5","children":[],"score":null,"depth":null,"halfMoves":2,"shapes":[],"nags":[],"comment":""}],"score":null,"depth":null,"halfMoves":1,"shapes":[],"nags":[],"comment":""}],"score":null,"depth":null,"halfMoves":0,"shapes":[],"nags":[],"comment":""},"headers":{"id":0,"fen":"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1","event":"Titled Tuesday intern op 19th Dec Late","site":"Chess.com INT blitz","date":"2023.12.19","round":"6","white":"Srinath, Rao","white_elo":2255,"black":"Deac, Bogdan","black_elo":2690,"result":"0-1","other":{},"start":[],"orientation":"white"},"position":[],"dirty":false,"sourceStamp":"80b06775380543c16740b3e33bfae531b936c225b2e6bb0eb22870c0fe73c0d3","linkedSource":{"collection":"299ab2f1-8662-4809-9671-b1bf7e938a09","generation":"64513:91900890:293:1793260771949377447:1793260771964508915","ordinal":0,"stamp":"80b06775380543c16740b3e33bfae531b936c225b2e6bb0eb22870c0fe73c0d3"},"appendAttempted":false,"report":{"inProgress":false,"operationId":null}}}, renderer state: {"selected":[],"controls":[],"path":"/"}
FAIL  CR4 absent citation explains the ChessBase PGN Library prerequisite without admitting a tab
      missing citation guidance or source-tab preservation mismatch, renderer state: {"selected":[],"controls":[],"path":"/"}
```

Actual input changes and exact restoration hashes:

```json
[
  {
    "case": 1,
    "phase": "altered",
    "original": "45fdb5a0ca67c3f3fdc53553a97cdc8d88a18307432d4eda86e9278587f61e57",
    "input": "actual citation DOM label and formatting withheld"
  },
  {
    "case": 1,
    "phase": "restored",
    "before": "45fdb5a0ca67c3f3fdc53553a97cdc8d88a18307432d4eda86e9278587f61e57",
    "observed": "45fdb5a0ca67c3f3fdc53553a97cdc8d88a18307432d4eda86e9278587f61e57"
  },
  {
    "case": 2,
    "phase": "altered",
    "original": "533fdc896cefab29070b974e11d6ec77df9c4161e47646e6946d7a277cb8e2e2",
    "altered": "ffb870c39a532352e24af8dfb7af7567989eacc5f4efd7a50efd851e102c5e65",
    "input": "actual admitted tree Round changed"
  },
  {
    "case": 2,
    "phase": "restored",
    "before": "533fdc896cefab29070b974e11d6ec77df9c4161e47646e6946d7a277cb8e2e2",
    "observed": "533fdc896cefab29070b974e11d6ec77df9c4161e47646e6946d7a277cb8e2e2"
  },
  {
    "case": 3,
    "phase": "altered",
    "original": "5e8710733d27732a8411687dfd9e6b6593cea229d75aa09988b687fa9ed23892",
    "altered": "4d107cc205ef72da67efc1039ae6513d259f31c9ff8b402b9a4a92d9eff04c3e",
    "input": "actual admitted linked tree Custom removed"
  },
  {
    "case": 3,
    "phase": "restored",
    "before": "5e8710733d27732a8411687dfd9e6b6593cea229d75aa09988b687fa9ed23892",
    "observed": "5e8710733d27732a8411687dfd9e6b6593cea229d75aa09988b687fa9ed23892"
  },
  {
    "case": 4,
    "phase": "altered",
    "original": "6e7e508c8e5f2863baa7a1668172188b270f6b9366612c6d620bbe40ffb1c123",
    "input": "actual missing-game guidance text withheld"
  },
  {
    "case": 4,
    "phase": "restored",
    "before": "6e7e508c8e5f2863baa7a1668172188b270f6b9366612c6d620bbe40ffb1c123",
    "observed": "6e7e508c8e5f2863baa7a1668172188b270f6b9366612c6d620bbe40ffb1c123"
  }
]
```

## DS2 correction and supplemental real-input staging

Root inspected fix-4 against the frozen CR-staged module. Only the new receipt comments, DS2's obsolete JSON decoder/live wording and two new citation waits changed. The waits now use the existing FILES_PROBE_TIMEOUT_MS. No CR predicate, fixture, old wait constant, producer, codec library or product persistence changed. This corrects f-20261029-02's observed decoder failure while preserving its exact successful type, qualified handle and decimal-string size checks.

gate-database-storage-negative.m0Cqvd completed at actual1 with exactly one failed check, the intentionally altered DS2 storage input. The external stager completed0. Root inspected the original/restored compressed bytes' equal SHA256 values and the actual numeric4096 versus expected string4096 diagnostic. The debugger and actual input were restored before the existing comparison. All CR1–CR4 checks passed without injected faults in this same real-app run. Every other existing check and shutdown passed. Screenshot output was present and driver ports closed. This supersedes the earlier missing-directory problem, not the preserved earlier receipt.

The staging module SHA256 was de0a3d39390d2d4581dde43e49b4711af4ffa7f31c6e945317c6817dbad0710c. This is independent runtime input staging of the unchanged assertion, not proof that the ordinary unaltered DS2 run has passed. Root will run the complete ordinary verifier after cumulative review. f-20261029-02 remains open until that positive proof. The dated staging receipts remain historical, with later acceptance owned by the final browser section.

```text
1 database-storage-negative 1ca09d884a6e4e0a49bcfd11e7452f29915978e9
0 database-storage-stager 1ca09d884a6e4e0a49bcfd11e7452f29915978e9
FAIL  DS2 database explorer persists the successful selection with its exact decimal storage_size
      expected successful selection 984d3539-97a6-41f9-9a89-b5716cb24a14 with storage_size "4096", received {"type":"success","title":"verify opening database","description":"Dedicated game-opening proof","player_count":5,"event_count":3,"game_count":2,"storage_size":4096,"filename":"verify-game-opening.db3","indexed":true,"file":{"id":{"id":"984d3539-97a6-41f9-9a89-b5716cb24a14"},"kind":"database"}}, renderer state: {"selected":[],"controls":[{"disabled":true,"text":"Open game"}],"path":"/databases/984d3539-97a6-41f9-9a89-b5716cb24a14"}
  ok  CR1 imported formatted citations preserve prose and expose accessible notation actions
  ok  CR2 citation native database lookup admits the exact full game and starting FEN
  ok  CR3 citation native linked lookup admits original annotations, variations and file occurrence
  ok  CR4 absent citation explains the ChessBase PGN Library prerequisite without admitting a tab
1 check(s) failed
```

```json
[
  {
    "case": 5,
    "phase": "altered",
    "original": "c82c167774369a9f2ec5671dac6c50e845d69657f953671d8ff8f936a5ad56b9",
    "altered": "34a53882aae7e7266cfb1e5a348e1d8be526f3afe35ce331c151a2970fe1d942",
    "input": "actual database-view decimal storage_size changed to numeric value"
  },
  {
    "case": 5,
    "phase": "restored",
    "before": "c82c167774369a9f2ec5671dac6c50e845d69657f953671d8ff8f936a5ad56b9",
    "observed": "c82c167774369a9f2ec5671dac6c50e845d69657f953671d8ff8f936a5ad56b9"
  }
]
```


## Root correction lineage and plan round 5

f-20261029-03 is the root-observed loss of a valid short citation when its remaining tail is ordinary prose. It was introduced by the r4 metadata implementation. The retained pre-metadata source only constrained lexical event/year/round fields and did not reject this names-only pair for that prose. fix-1 changed the visible label bound only and did not create the rejection. This is a correction-created implementation defect, with r4 metadata implementation as its parent revision and PR-2 as that revision's verification lineage. It is not a newly discovered independent plan finding.

Root's actual source-module probe printed offered:false for the exact matching Beerdsen/Bluebaum 0-1 game after the tail White was better. The first fix-5 assignment added four substantive regressions, measured all four failing at1, then passed its three-file focused suite154 at0 and typecheck0 after a partial correction. Root's second actual-module probe below found that a year inside ordinary prose still hid the occurrence. That assignment was not accepted and f-20261029-03 remained open.

The first root pre-review had waited behind shared slots, then began immediately before root stopped its own group for this observed correctness repair. The canonical completion is125 with no remaining group. Its frontend build8.1s, format/lint1.2s, mapping0.4s and bundle0.5s passed, while mutation ended143 after0.5s. The complete pre-review remains red and none of those lane passes are a completed gate receipt.

Root had also unnecessarily wrapped the short fix-5 production-build proof in agent-gate, although the existing build-vite command is tsgo plus Vite and the mandated pre-review/final commands already own their wrappers. That auxiliary command waited more than20minutes behind shared jobs. Root stopped its owned waiting wrapper, then the still-running executor assignment after it retried the obsolete command. The write attempt terminated failed, all owned containment children were gone and no overall green or candidate measurement is claimed. The same persistent Codex thread was resumed at sensitive role with the r5-approved guard, corrected production proof command and the jointly owned citation-lifetime repair. No executor switch or root business-code implementation occurred.

Round5 plan, correctness and tests all returned APPROVED with zero new findings. Adoptions r5=0. Their boundary retains the existing year-led BEL-NED2017/ICCF negative against a different known site while refusing to interpret a year buried in ordinary prose as Date. The partial implementation is not approved by those plan verdicts. Actual measured round wall is 437.5s, active wall unknown. The build-queue wait overlapped this review and is not summed into active review time. No new plan issue opened. The still-open root implementation defect is distinct from lens adoption counts.

Actual production-module probe output, isolated JSDOM only for normal browser-module initialization:

```text
[DEPRECATED] atomFamily is deprecated and will be removed in v3. Please use the `jotai-family` package instead: https://github.com/jotaijs/jotai-family
{"tail":"White was better.","closed":false,"offered":true}
{"tail":"White was better before 2020.","closed":false,"offered":false}
{"tail":"Elllobregat op 3rd White was better before 2020.","closed":false,"offered":false}
{"tail":"Elllobregat op 3rd Sant Boi de Llobregat White was better before 2020.","closed":false,"offered":false}
```

### Round 5 reviewed contract additions

O2 adds: An unterminated tail after a short citation may be ordinary preparation prose, including references to other years. Such unverified text must retain an otherwise matching occurrence for explicit selection. A number inside that prose is not the game's Date. Exact actual event/site context remains verifiable without a closing round. Unambiguously supplied metadata contradictions and complete citations through a closing round retain their hard constraints.

O4 adds: Unterminated-tail regression proof includes ordinary prose mentioning another year. Lookup retains an unverified occurrence and actual admission waits for explicit choice, including after an actual event/site prefix. Exact metadata remains verified, and contradictory identifiable metadata remains rejected.

The frozen candidate was plan-r5.md in the run directory. All other stable O1–O4 obligations, source manifest, MANDATE, threat model and the existing measured allowance remain as in the reviewed snapshot above. These two additions and their cumulative record fully recover the substantive r5 delta without ignored plan files.

### Raw plan r5

``````text
No plan defects found in plan-r5’s O2/O4 correction (confidence: 94).

The boundary is consistent with the existing negative case at `src/utils/gameReferences.test.ts:248`: `BEL-NED 2017 ICCF` leaves a year-led metadata remainder against a different known site. Retaining that rejection does not require treating a year inside unknown prose as Date. Exact event/site verification and explicit choice for unresolved prose remain compatible.

O4:48 requires observable candidate retention and admission waiting for explicit choice, which would catch the supplied global-year-scan failure.

Limitation: this accepts the correction contract, not the unfinished implementation. f-20261029-03 remains open. No files changed or tests run. Review and authorship share the OpenAI model family.

VERDICT: APPROVED
``````

### Raw correctness r5

``````text
No correctness defect found in the r5 plan clarification (confidence: 93).

The obligations remain consistent on the critical cases:

- `White was better before 2020.` retains an unverified occurrence, including after actual event/site prefixes, and requires explicit selection.
- Exact `BEL-NED 2017` / `ICCF` metadata can verify without constraining Date.
- The existing negative case with Event `BEL-NED`, Date `2017.01.01` and Site `Unrelated site` remains rejected as identifiable contradictory metadata. Lack of a closing round alone cannot waive that constraint.

Limitation: this approves the plan boundary, not the unfinished implementation or closure of f-20261029-03 (confidence: 100). No tests were run or files changed. Review uses the same OpenAI model family as authorship, with a separate detection context.

VERDICT: APPROVED
``````

### Raw tests r5

``````text
VERDICT: APPROVED
``````


## Citation owner correction

Root source inspection found f-20261029-04 before implementation acceptance. EvalListener calls the actual setScore action, which uses Immer and changes root identity. The provider's root-keyed layout effect therefore aborts ordinary lookup during analysis. This is an initial implementation defect, not a prior closed issue reopened.

Separate read-only Locate confirmed the existing stable store plus physical workspace tree key boundary, and its identity-preserving reload exception. Root independently read the actual TreeStateProvider, tab scope, getTabTreeKey, replaceFileGame, FileFreshnessGate and BoardsPage paths before settling decision d-20261029-14. The existing freshness gate removes notation while unverified, so unmount remains the reload guard. A fresh treeKey handles same-file game replacement while a score update leaves both owners intact. The result guard must inspect the current captured workspace owner and live store, not rely solely on a later effect.

This introduces no new stored epoch or registry and no source edits to tree/tab persistence. The resumed bounded writer owns both repairs because their admission tests share files. Meaningful real-store score and replacement proof, root source-removal proof and final inspection remain required. Plan authorship and arbitration shared one context. Detection used the same OpenAI family as code.

Raw independent Locate report:

``````text
Optimal: use the existing tree-store identity plus workspace document generation → I recommend `store` from `TreeStateContext` together with `getTabTreeKey(ownerTab)`, with provider unmount ending the notation lifetime. For ephemeral previews, use `store` alone. Compare these dependencies separately, without allocating a new owner object on every render.

No single existing identity changes on **every** source replacement. File reload is the important exception, already guarded by the freshness gate’s removal of its children.

Evidence for that boundary:

- **Engine updates must preserve ownership.** [GameNotation.tsx:106](src/components/common/GameNotation.tsx#L106) currently passes `root`. [EvalListener.tsx:280](src/components/boards/EvalListener.tsx#L280) calls `setScore`, whose Immer update mutates the current node’s score and depth at [tree.ts:745](src/state/store/tree.ts#L745). That changes the root reference. The provider consequently aborts and clears its dialog through [GameReference.tsx:62](src/components/common/GameReference.tsx#L62).
- **The store is stable.** [TreeStateContext.tsx:30](src/components/common/TreeStateContext.tsx#L30) creates it once per provider. Workspace stores are also cached by logical tab ID at [tree.ts:299](src/state/store/tree.ts#L299).
- **Same-file game selection needs the document generation.** `getTabTreeKey` returns `tab.treeKey ?? tab.value` at [workspaceTypes.ts:30](src/state/workspaceTypes.ts#L30). Existing `sameTabOwner` compares logical ID and this key at [tabs.ts:99](src/utils/tabs.ts#L99). `replaceFileGame` retains the store but installs a fresh `treeKey` at [tabs.ts:475](src/utils/tabs.ts#L475). Store identity alone therefore misses genuine replacement.
- **InfoPanel discard/load follows that replacement path.** The dirty-tree confirmation captures a snapshot, validates the pending request, then calls `replaceFileGame` at [InfoPanel.tsx:380](src/components/panels/info/InfoPanel.tsx#L380). Discard confirmation itself does not retire the document. Successful replacement does.

Actual replacement that preserves both identities:

- **File reload and automatic disk reconciliation** call `store.getState().setState(tree)` through [FileFreshnessGate.tsx:170](src/components/tabs/FileFreshnessGate.tsx#L170). They preserve the store, logical tab ID and `treeKey`. Explicit reload reaches this at [FileFreshnessGate.tsx:328](src/components/tabs/FileFreshnessGate.tsx#L328), reconciliation at [FileFreshnessGate.tsx:253](src/components/tabs/FileFreshnessGate.tsx#L253).
- Existing protection is the **mounted notation lifetime**. The gate renders children only while verified at [FileFreshnessGate.tsx:437](src/components/tabs/FileFreshnessGate.tsx#L437). Unverified, conflict and unavailable states render replacement content, unmounting notation and triggering its request cleanup. `reloadCount` is only a data attribute, not a remount key. Neither store identity nor `treeKey` independently detects this in-place replacement.

Other lifecycle paths:

- **Library previews:** [GamePreview.tsx:60](src/components/databases/GamePreview.tsx#L60) derives an existing record key and keys `GamePreview` with it. Each preview creates its own unpersisted `TreeStateProvider` and `EphemeralTabScope` at [GamePreview.tsx:109](src/components/databases/GamePreview.tsx#L109). `useOwnerTab` returns no workspace tab for that scope, while `useOwnerTabId` throws, as shown at [tabScope.tsx:50](src/state/tabScope.tsx#L50). Use the preview store and unmount cleanup.
- **Switching tabs:** `keepMounted={false}` at [BoardsPage.tsx:288](src/components/tabs/BoardsPage.tsx#L288) unmounts inactive notation. Cached stores survive that switch, intentionally, at [tree.ts:818](src/state/store/tree.ts#L818).
- **Closing tabs:** successful workspace close removes the cached owner at [BoardsPage.tsx:148](src/components/tabs/BoardsPage.tsx#L148), with cache removal implemented at [tree.ts:236](src/state/store/tree.ts#L236).

A meaningful regression should mount **real GameNotation with a real tree store**, start a deferred reference lookup, then call `store.getState().setScore(...)`. Assert the root changed, the signal remains live and the dialog remains visible. Next perform real `replaceFileGame` admission in the same logical tab. Assert the store remains identical, `treeKey` changes, the lookup aborts, the dialog closes and a late verified result cannot open a tab. Add a freshness-gate reload case to prove the identity-preserving exception retires through unmount.

The current “retire” test only supplies a fresh literal owner at [GameReference.test.tsx:393](src/components/common/GameReference.test.tsx#L393), so it cannot establish this integration.

Read-only inspection completed. No changes, tests or services were run.
``````

## Accepted implementation corrections and root proof

The final resumed fix-5 writer completed at the sensitive role, gpt-6.1-sol high, and root inspected its complete eight-path correction. It retains unknown open-tail prose before incidental-year parsing. Exact event/site prefixes still verify without a closing round, while identifiable metadata contradictions retain their rejection. The provider now reads the real TreeStateContext store and existing workspace physical key. It validates the current workspace owner, closing state and live cache before accepting a late lookup. GameNotation no longer passes root identity or adds a pass-through owner component.

Root independently removed only the open-tail production correction through a normalized Git patch, retained the tests and observed ten substantive retained-candidate/admission failures at exit1. Exact forward restoration passed at0. Root independently removed only the GameNotation/GameReference ownership correction and observed five substantive real-store failures at1. Exact restoration passed at0. Neither patch applied with an offset, and restored files were byte-identical to the candidate. Receipts are root-open-tail-removed/restored.log and .exit, root-citation-owner-removed/restored.log and .exit under the run directory.

The first final-proof attempt used an incorrect selector and did not produce the required failures. It was rejected, the source was restored exactly and its diagnostic was retained as root-open-tail-selector-diagnostic.log. It receives no reversal-proof credit. The corrected selector was open tail. The completed substantive controls above precede the later root related run.

Root then ran 24 related files with 1,204 passing tests, UI boundary checks, frontend coverage mapping across292 production files and10 areas, and a parsed non-scope baseline comparison. All passed. Numeric baseline metadata is unchanged. The final candidate production measurement is entry556146, largestLazy486067 and total1660313 gzip bytes. Compared with published f187917677a094c8f55dc926174308ea41254a3f, deltas are529,4591 and10508. The reviewed total ceiling1670000 retains9687 bytes. Entry565000 and largestLazy550000 ceilings remain unchanged.

The root-final-proof.oAzqe2 attempt subsequently entered pre-review after the shared FIFO wait. Frontend build, formatting, mapping and bundle passed, but oxlint found one no-conditional-expect violation in the new real-owner replacement test. Root deliberately stopped only its owned gate group before editing. The canonical poll confirmed no remaining group and recorded125. Mutation was interrupted143. This is a red pre-review attempt and supplies no completed gate credit. A bounded mechanical fix-6 assignment moves the replacement-result assertion outside the conditional while preserving the successful real replacement and pre-cleanup result checks. No product change is part of that lint repair.

f-20261029-03 and f-20261029-04 remain open until the corrected complete pre-review and source commit. f-20261029-02 remains open until ordinary positive acceptance. Final cumulative code review, positive acceptance of the corrected native build, final affected gates, push, required CI and installation are still pending at this historical point. Plan authorship and arbitration shared one context. Detection used the same OpenAI model family as code.

### Raw final implementation handoff

``````text
Implemented both corrections. All changes remain unstaged.

Changed paths:

- `src/utils/gameReferences.ts` — retain unclosed prose without extracting incidental years.
- `src/utils/gameReferences.test.ts` — cover all three prose-year positions and retain hard metadata negatives.
- `src/components/common/GameReference.tsx` — derive ownership from store and physical tree key, with live workspace/cache validation.
- `src/components/common/GameReference.test.tsx` — real lookup, explicit admission, score-update, replacement and pre-cleanup race regressions.
- `src/components/common/GameNotation.tsx` — remove root-based ownership and the pass-through component.
- `docs/game-references.md` — document confidence and ownership boundaries.
- `bundle-budgets.json` — refresh measurement values only.
- `docs/bundle-budgets.md` — refresh leading comparison figures only.

Ownership follows the traced `EvalListener → setScore` path. Scores change root identity while preserving store ownership. Real `replaceFileGame` changes the physical key while retaining the store. The result guard rejects replaced, closed or uncached owners before React cleanup. Existing unmount cleanup remains intact.

Evidence under `/tmp/build-build-opening-game-references-20261029-064642-82fa88e8`, with paired `.exit` files:

| Raw log | Observable result | Exit |
|---|---|---:|
| `fix-6-prose-before.log` | Six retained-candidate/admission assertions failed | 1 |
| `fix-6-owner-before-final.log` | Five substantive ownership regressions failed | 1 |
| `fix-6-owner-after-final.log` | All five ownership regressions passed | 0 |
| `fix-6-related.log` | 24 files, 1,204 tests passed | 0 |

Type-checking, oxfmt, direct `pnpm build-vite`, bundle check, UI boundary, frontend coverage mapping and `git diff --check` all passed with exit 0.

Fresh gzip report: `RUN_TMP/final-candidate-bundle.json`.

| Metric | Final bytes | Growth from published base | Ceiling |
|---|---:|---:|---:|
| Entry | 556,146 | +529 | 565,000 |
| Largest lazy | 486,067 | +4,591 | 550,000 |
| Total | 1,660,313 | +10,508 | 1,670,000 |

Total margin is 9,687 B. Hard metadata constraints, exact screenshot labels and names-only automatic admission remain covered.

No scope deviations or unresolved implementation ambiguity. The interrupted auxiliary wrapper’s exit 143 is excluded from green proof. An initial ownership-harness import failure was corrected with a platform-keybinding mock before recording substantive failures.
``````

### Mechanical test lint correction

The bounded fix-6 lint writer completed. Root inspected its single-file change. It records the actual replaceFileGame result inside startTransition and asserts the result outside the action branches, before resolving the pending lookup. The successful replacement and before-cleanup assertions remain. Oxfmt, oxlint with deny-warnings, all27 GameReference tests, tsgo and diff checks passed0. The component test file was untracked, so diff-check alone did not cover its contents, while the formatter, linter, compiler and tests did. The complete pre-review rerun is gate-pre-review-final.PrPl2e and remains pending at this checkpoint.

The earlier scratch logs named fix-6-prose-before, fix-6-owner-before-final, fix-6-owner-after-final and fix-6-related were written by the resumed fix-5 substantive assignment. Their basename is historical and does not make the later fix-6 lint assignment their author. The distinct launcher JSONL and final report paths retain that provenance.

## Completed citation phase gates

gate-pre-review-final.PrPl2e completed0, canonically polled. Its launch HEAD was8229323cbc9e6e6a620c0e1192436caeec765fa2. During the run, the required immediate hosted-failure annotation committed e3769737 in findings only. No tested source changed. Logs artifacts/gates/20261029T102609544Z-3676468 record frontend build8.0s, format/lint/typecheck1.2s, frontend mapping0.3s, bundle0.5s and changed-file mutation1381.9s, all0. The three selected mutation packages passed100 percent. Windows and backend mapping were legitimately unselected because citation phase source has no Rust changes. The queue wait is included in the wrapper span, not active review time.

The independent phase contract check gate-phase-contract.DxPILu also completed0 and was canonically polled. This includes findings validation, i18n, boundary, tooling, workflow and other existing contract checks. These green results supersede the prior red pre-review attempts, which remain historical and receive no green credit. They are implementation-phase proof, not the later clean cumulative final-gate receipt.

## Upstream required-CI release precondition and round 6

The required remote check returned1 for the newest completed rust-macos-test result, job123368096273 in Test40850387164 at published5a016bd295a13954ad956e1d4155539c2b2bba90. The live master API still named5a and no newer Test run existed at discovery. Its actual log reports warm_transition_termination_stops_after_one_slow_exchange_on_fresh_and_reuse_paths failing at src/chess.rs:4249 with Err(Elapsed(())),2828 passed,1 failed,1 ignored and command101. The supplied engine source is identical to that published version. No rerun was dispatched. Root annotated existing f-20261011-03 in e3769737, without claiming a host-I/O or product diagnosis.

The separate read-only diagnostic below traced the600ms aggregate completion proxy against actual10s readiness,3s quit and2s kill/reap defaults, existing5s wire observation and12s real-child cleanup conventions. Root independently read those paths. Proposed phase2 changes only this native test and shared cfg(test) helpers in chess.rs. It separates quit progress from successful full cleanup, preserves exact/all preemption and graceful release, and requires healthy-delay and actual product-regression controls. It introduces no production deadline, scheduler, gate, binding, persistence or capability change. Final gates expand to Rust plus frontend because that bounded required-CI precondition must pass before release. The broader f-20261011-03 question remains open.

The r6 amendment was initially beneath Reviews and the initial packet omitted the explicit path and canonical revision block. The plan lens retained PR-3, blocker100, Fix. Root moved the literal unchanged amendment before Reviews and supplied the canonical generated ROUND6 block from r5 to the corrected frozen r6 candidate. The original plan-r6.md, original packet and raw report remain intact. plan-r6-final.md and plan-r6-body.md are the corrected full/body snapshots. The exact block names the release amendment REVISED and all prior operative obligations SETTLED. This is a same-proposal evidence-only packet correction, not a new acceptance criterion or an invented additional round. The plan closure and first successful test review remain pending at this checkpoint.

Initial plan and correctness launched successfully. The first test CLI and engine launcher were refused by the local agent-run memory reserve, not provider capacity, quota or model refusal. Test's canonical unclassified retry was again refused during launch. Engine's unclassified helper correctly returned10 with class=launch-refused, then its unchanged fresh launch after recovered headroom succeeded in lens-engine-protocol-r6.launch-retry-1. Platform subsequently launched and completed. No reserve override, foreign process change or executor fallback occurred. Four original reports are complete and retained below. Memory was available after mutation workers completed, so corrected plan and test packets launched as lens-plan-r6-evidence and lens-tests-r6-evidence. No verdict is inferred from a launch.

Implementation source commits are92f2d302, the isolated DS2 codec correction, and682e8da6, the39-path citation feature. The latter names all three new canonical snapshots. Root inspected the DS2 staged hunk and full owned manifest, with zero unowned dirt. The DS2 hunk applied to the original index with a38-line positional offset because the mixed worktree also contained preceding feature additions. Its exact four-line committed diff contains only the decoder and obsolete live label correction. This was not a source-removal proof or an offset-free claim. f-20261029-03 and f-20261029-04 closures follow the verified source commit through findings.py. DS2 stays open pending ordinary positive acceptance.

Plan authorship and arbitration shared one context. Detection used the same OpenAI model family as code. The r6 proposal and all native controls remain unimplemented at this checkpoint.

### Raw probe-4-r1.txt

``````text
The failure proves that termination did not finish within the test’s 600 ms outer wait. It does **not** establish host pressure, a product deadline violation, or which termination path failed.

The retained log reports 2,828 passed, one failed and one ignored. The panic precedes the helper’s cancellation, search-result and wire assertions. It supplies neither the fresh/reuse case nor the `"exact"`, `"all"` or `"release"` value.

The inspected engine sources are identical to published `5a016bd295a13954ad956e1d4155539c2b2bba90`, despite this worktree having a different HEAD.

**Termination trace**

- **Exact:** `terminate_exact` marks the exact generation cancelled, cancels its actor interrupt and binds the shared cleanup attempt under the publication barrier. Only then does it await the lifecycle lease. `exchange_io` gives interruption priority over protocol I/O. Failed readiness invokes physical teardown before its reply completes.
- **All:** `terminate_all` seals admission and marks actors cancelled. `drain_matching` binds generation-specific attempts. `start_termination_with_stop(false)` cancels each interrupt before lifecycle waits.
- **Release:** `release_generation` cancels the selected search and lifetime barriers, then binds cleanup with `stop_first=true`. It deliberately allows the current readiness exchange to finish. Cancellation checks prevent another exchange or `go`. The pending owner performs graceful stop, then termination.

Fresh readiness occurs in `WarmEngine::new`. Reuse reaches the readiness barrier in option application. Both execute under `start_interactive_search`’s lifecycle lease.

Successful termination includes child OS wait, stderr-drain cleanup and actor join. Registry removal alone is insufficient evidence of reaping. Failed cleanup retains its owner and original child handle.

**What 600 ms means**

It is a test proxy for the historical one-exchange guarantee, not an asserted product latency contract. The fixture sleeps 200 ms before `readyok`, but the 600 ms stopwatch also includes scheduling, teardown and OS reaping.

The actual defaults are readiness 10 s, graceful quit 3 s, kill/reap 2 s and stderr join 200 ms. Decisions `d-20261008-10`, `-13` and `-14` require preemption for physical termination, preserve graceful release and retain those constants. The f-20260927-06 history explicitly identifies this test as the earlier **one-exchange** witness.

**Optimal: separate wire progress from cleanup completion → I recommend a test-only repair in `assert_warm_transition_termination`.**

The smallest grounded change is:

1. After observing the new `wire=isready`, spawn and retain the selected terminator.
2. Observe `wire=quit` using the existing five-second `wait_for_fixture_capture` convention.
3. Await successful termination and the search join under a separate bounded completion ceiling, using the existing twelve-second real-child cleanup convention.
4. Remove both 600 ms speed assertions. Preserve cancellation flags, `Error::Cancellation`, exact unregistration, exactly one additional `isready`, unchanged `go` count and observed `quit`.
5. Preserve the silent-readiness exact/all matrix. Its fixture emits no `readyok` but continues reading commands. Observing `quit` within five seconds rejects waiting for the ten-second readiness deadline, including any proposed 30-second wait.

This makes wire progress the preemption witness and successful termination the cleanup witness. Increasing only the outer timeout would lose that distinction. Existing `PendingTermination` already retains an immutable result and completion notification. No new production coordinator is needed.

Required future controls:

- **Healthy delay:** delay fixture exit after logging `wire=quit`, for example by 900 ms while remaining within graceful quit’s three-second budget. The old test should reject it and the repaired test should pass with confirmed cleanup.
- **Product regression:** suppress the targeted pre-lease interrupt for a silent exact/all case. The wire-progress witness must fail before readiness times out. Separately remove the relevant between-exchange cancellation check and confirm the unchanged extra-`isready` or `go` assertion rejects continuation.
- Release fixture holds and observe owned tasks before reporting control failures, so negative controls leave no children behind.

A real implementation issue remains possible. The log cannot distinguish barrier delay, exchange interruption, lease release, child exit, OS reaping or task completion. The successful silent sibling is useful evidence, but does not diagnose this failure.

Inspected paths: the four assigned rules, scoped portions of `src-tauri/src/chess.rs`, `engine/process.rs`, `engine/types.rs`, the two named findings, relevant termination decisions and the supplied CI log. `engine/supervisor.rs` does not exist. Supervisor implementation resides in `process.rs`.

No files changed, tests ran, reruns dispatched or external services contacted. The proposed repair and controls remain unverified.
``````

### Raw lens-plan-r6.txt

``````text
[blocker] /tmp/build-build-opening-game-references-20261029-064642-82fa88e8/plan-r6.md:122 — The round-6 packet supplies an inline plan and raw diff, but omits the explicit plan path and required generated `ROUND / DELTA / REVISED / SETTLED` block. Earlier rounds are documented at line 119. The review contract requires that block at /home/felixb/.claude/references/review-lens-contract.md:245 and forbids reconstructing it from summaries. Supply these inputs before claiming scoped approval (confidence: 100).

Named limitation: source inspection supports separating wire progress from cleanup completion. The proposed controls remain unexecuted, and this review approves no implementation.

VERDICT: REVISE
``````

### Raw lens-correctness-r6.txt

``````text
No correctness findings in the r6 amendment. The separate quit observation and cleanup completion requirements preserve the termination contract across the stated matrices.

Limitation (confidence: 100): the proposed helper and negative controls remain unimplemented and unexecuted. This approves only the plan contract, not the citation code or native repair.

Review used a separate OpenAI context, without family separation. No files changed.

VERDICT: APPROVED
``````

### Raw lens-engine-protocol-r6.launch-retry-1/lens-engine-protocol-r6.txt

``````text
No findings in the round-6 amendment within this lens. The proposed proof separates protocol progress from child cleanup while retaining generation-specific cancellation, exchange-count and no-`go` assertions, with negative controls and bounded failure cleanup.

This approves the plan contract only. Implementation and staged proof remain pending. Review used a separate Codex context in the same OpenAI family.

VERDICT: APPROVED
``````

### Raw lens-platform-semantics-r6.txt

``````text
No new platform-semantics findings.

The native matrices and fixture helpers are consistently `cfg(unix)`, covering Linux and macOS. Separating observed `wire=quit` from successful cleanup completion preserves distinct protocol-progress and OS-reaping witnesses. The required negative controls guard against accepting the ten-second readiness fallback or extra exchanges.

Platform proof remains pending:

- `rust-macos-test` supplies macOS runtime confirmation.
- `rust-windows-test` supplies Windows runtime coverage, but excludes these Unix-only matrices.
- `rust-platform` supplies target-specific compilation and Clippy checks.
- Planned `pnpm rust:windows:check` is compile-only and was not run during this review.
- The Linux-to-FreeBSD source probe was not run.

No files changed or tests ran. This approves only the release amendment’s plan contract, not the citation implementation or the future Rust repair. Review and implementation use separate sessions within the same OpenAI family.

VERDICT: APPROVED
``````

## Round 6 closure, allocation recovery and phase2 start

The corrected same-revision plan check explicitly CLOSED PR-3 and approved. The first successfully started tests lens also approved. Correctness, engine-protocol and platform-semantics approvals remain applicable to the identical amendment criteria. R6 therefore completes all five selected classes with one adopted finding and one unique issue closed. The original REVISE and runtime-refused attempts are preserved. No code, native control or implementation approval is inferred from these verdicts. The measured prompt-to-last-report span is711.803s, including the packet correction and memory launch waits. Active reviewer wall is unknown. Subsequent root arbitration overlapped integration and is not separately attributed as active review time.

Initial rebase onto current published5a016bd295a13954ad956e1d4155539c2b2bba90 found two feature decision identifiers colliding with different already-published gate decisions. Per the ledger contract's collision rule, root kept every published entry intact and used findings.py record-decision to reallocate only the unpublished feature entries, preserving each former allocation in fenced history. The writer produced validated receipts but explicitly refused detached-HEAD self-commit. Root then committed only that writer-produced decisions path and continued the rebase. No receipt hash was hand-edited, no source commit was skipped and no public history was rewritten. All13 owned commits were replayed successfully. The complete range-diff is retained as initial-rebase.range-diff.

The current feature allocation is d-20261029-17, formerly the branch-local feature d-20261029-01. The current measured budget allocation is d-20261029-18, formerly the branch-local feature d-20261029-03. Earlier raw feature reports and the dated reviewed snapshot retain those old branch-local labels verbatim and must be interpreted through this mapping. They do not refer to the different published gate decisions now owning the old IDs. The source-ownership decision d-20261029-14 had no collision. The budget record also explicitly distinguishes earlier candidate measurements from the accepted phase1 figures.

Root compared every one of the39 source-manifest paths between pre-rebase1ab9c5fa and rebased0df804cf and found zero changed source paths. The feature commit is now f60dca22, the isolated DS2 correction c82edffe, and phase1 proof therefore remains tied to byte-identical feature inputs. f-20261029-03 and f-20261029-04 are handled. f-20261029-02 remains open for ordinary native positive acceptance. Current full findings validation passed after the rebase. Fresh cumulative gates still cover the final rebased tree.

Decision d-20261029-19 records the approved bounded native test repair and reversal path. A sensitive Codex phase-2 writer is now assigned only chess.rs cfg(test) helpers/matrices and the exact stale budget-doc decision citation, with temporary engine/process.rs faults requiring byte-identical restoration. Its mandatory controls are healthy900ms post-quit exit delay, absent interruption and absent between-exchange cancellation. The phase has not yet completed, and no positive control, pre-review, cumulative code review, release, hosted confirmation or installation is claimed here. The broader f-20261011-03 stays open. Plan authorship and arbitration shared one context. Detection used the same OpenAI model family as code.

### Raw lens-plan-r6-evidence.txt

``````text
PR-3 CLOSED — The explicit frozen `plan-r6-body.md` is supplied. Its amendment starts at line 91, before Reviews in `plan-r6-final.md:114`. The canonical delta against r5 and generated ROUND/DELTA/REVISED/SETTLED block now cover that amendment.

LATE OBSERVATIONS

Named limitation — The proposed controls remain unexecuted. Approval covers the plan, not implementation or repair acceptance (confidence: 100). Review used a separate Codex context in the same OpenAI family, with shared plan authorship and arbitration.

VERDICT: APPROVED
``````

### Raw lens-tests-r6-evidence.txt

``````text
VERDICT: APPROVED
``````

### Raw plan-r6-block.txt

``````text
ROUND: 6
DELTA: /tmp/build-build-opening-game-references-20261029-064642-82fa88e8/plan-r6-canonical.delta
REVISED:
## Release precondition amendment and plan round 6
SETTLED:
# Plan: clickable ChessBase game citations
## Goal
## MANDATE
## Threat model and non-goals
## Traced premises
## Approach
## Approach > ### O1 — recognize citations without changing the preparation
## Approach > ### O2 — resolve local games honestly
## Approach > ### O3 — open the selected full game through the existing admission path
## Approach > ### O4 — verify the complete interaction
## Decisions and trade-offs
## Risks / open questions
## Not part of this task
## Phases
``````

### Reviewed round6 native release contract

The following amendment is the literal reviewed proposal text. It predates implementation and does not claim completed controls.

``````markdown
## Release precondition amendment and plan round 6

The required upstream rust-macos-test job123368096273 in Test40850387164 at published5a016bd295a13954ad956e1d4155539c2b2bba90 failed only warm_transition_termination_stops_after_one_slow_exchange_on_fresh_and_reuse_paths. Actual Result::unwrap on Err(Elapsed(())) is at src/chess.rs:4249, the600ms completion wait after wire=isready observation. The preceding API check confirmed master still5a and no newer Test existed. pnpm ci:remote:check returns1. No rerun was dispatched. The observation is annotated onto existing f-20261011-03, which remains open for its broader gate-design question. This is an external required-CI release precondition, not a citation implementation regression and not a claim of host pressure or product malfunction.

Root and separate read-only probe inspected identical published engine sources. assert_warm_transition_termination uses a200ms slow-ready fixture and its600ms outer stopwatch includes graceful release, child OS wait, stderr cleanup and actor join. Exact/all interrupt before lifecycle waiting, release preserves its current exchange and stops at subsequent cancellation checks. Product defaults are readyok10s, quit3s, kill/reap2s. Existing d-20261008-10, -13 and -14 preserve those contracts. The600ms bound was a proxy for one exchange, not a documented product latency. Existing wait_for_fixture_capture uses5s and assert_abandoned_engine_removed uses12s for real-child cleanup. Fixture capture and completed termination prove different facts.

Additional bounded phase2, after citation phase1 passes pre-review and is committed: repair only this test witness and its shared cfg(test) helpers in src-tauri/src/chess.rs. No production source behavior, deadlines, new hook, scheduler, gate, registry, persistence, bindings, dependency or capability change. This exact test-only exception supersedes the earlier blanket Rust exclusion only for the release precondition. Citation scope and MANDATE remain unchanged. Broader f-20261011-03 cases remain separate.

The helper will retain the spawned terminator and search task after actual readiness observation. It will require observed wire=quit through the existing5s fixture-capture convention, independently of awaiting successful termination and search completion under the existing12s real-child cleanup convention. Preserve all six slow fresh/reuse x exact/all/release cases and all four silent fresh/reuse x exact/all cases. Preserve cancellation of the exact actor/search, Error::Cancellation, exact unregistration, exactly one new isready, unchanged go count and quit. Successful termination must still establish completed child cleanup. Remove only the two600ms aggregate speed assertions. A missing interrupt must not be accepted merely because the ten-second readiness deadline eventually expires. Reuse existing fixture observation and cleanup primitives. If an observation must be retained for cleanup before asserting, extract its result-returning core and route existing and new consumers through that shared concept, preserving prior callers' assertion behavior. Do not copy another capture polling implementation. Retain bounded cleanup of owned tasks and child even in negative-control failures.

Meaningful proof before phase2 acceptance:

- Freeze baseline and repaired helper. Apply an identical temporary900ms healthy fixture-exit delay after wire=quit, inside the unchanged3s graceful quit allowance. The baseline600ms witness must fail101 and the repaired witness must pass0 with cleanup, proving the actual phase conflation. Do not delay or weaken protocol progress. Restore exact fixture source and retain logs/statuses.
- Suppress targeted pre-lease interruption temporarily for silent exact/all. The repaired wire-progress witness must reject it before the unchanged10s readiness deadline, despite the larger completion allowance. Restore exact source and retain logs/statuses.
- Remove the relevant between-exchange cancellation guard temporarily and require retained extra-isready or go assertions to reject continuation. Keep exact production restoration and cleanup evidence. If source tracing establishes a different necessary negative control, obtain fresh judgment before substituting it, never silently waive this obligation.
- Run both complete warm-transition matrices, related affected native tests, Rust formatting, existing Windows GNU check and complete pre-review. No backend mutation suite. Root independently replays the decisive staged behavior and exact restoration before commit. An existing suite is enough, no custom source-text verifier.

Phase2 is a separate source commit, with root inspection and sensitive Codex writer. The cumulative review now adds engine-protocol and platform-semantics, plus existing applicable correctness/root-cause/tests/chess lenses. The final clean reviewed gate becomes pnpm gates:push -- --rust --frontend. Hosted macOS is not runnable on this Linux host, so one hosted dispatch per verified repair attempt is permitted under the existing policy exception, only after every locally reproducible affected check is green. No rerun-until-green loop. A current red remote remains a refusal until this repair demonstrably owns the listed failure. Exact pushed-SHA required CI and reviewed installer remain mandatory.

Round6 reviews this precise test-proof contract before any Rust edit. No adoption or approval is assumed. Plan authorship and arbitration share one context. Detection uses separate Codex contexts in the same OpenAI model family as code.
``````

## Native implementation proof and round7 correction

Initial phase2 completed the healthy exit-delay contrast, missing-interruption fault, ten restored matrix cases,82 affected chess tests, Rustfmt and Windows GNU proof. Root found no permanent production change in its returned diff. The worker correctly left control3 unresolved because the first temporary scope omitted production chess.rs, where several guards live. Root independently traced WarmEngine::new/start, EngineProcess::set_options_inner and start_interactive_search, then explicitly clarified that temporary faults may touch both existing production files. This was scope authorization for the same declared proof, with no behavior or acceptance change. It required no Felix input.

The first sensitive same-thread resume tried both the narrow and expanded guard removals. Both complete six-case slow matrices passed0 with no additional readiness/go, successful termination and physical cleanup. Those attempts remain diagnostic-only and receive no negative-control credit. The code's other cancellation and teardown safeguards prevented the desired bad wire result. The earlier premise that removing this guard class must make the retained counter fail was unsupported. The worker restored both production files exactly, retained every assertion and reported the unresolved criterion. No source acceptance or silent substitute followed.

Root-known RC-1 therefore required a plan-level recipe correction. R7 changed only that temporary control to one real additional isready command in the existing ProcessChildControl::write_quit, sent through write_line to the owned child's stdin immediately before quit. The fixture, capture file, matrix, expected count and test assertions stay unchanged. Root inspected that producer and the physical-cleanup-before-counter path. All four fresh r7 lenses explicitly CLOSED RC-1 at plan level and approved with no new findings. Adoptions r7=0, the supplied root observation is not counted as independent lens discovery. Measured prompt-to-last-report wall121.962s, active wall unknown. Decision d-20261029-20 supersedes only decision19's ineffective third fault recipe and explicitly retains its complete permanent test mechanism. The old record's trailer was updated through findings.py, with original decision text preserved.

The final second same-thread proof resume then applied exactly one real producer write. Its direct Rust run failed both slow and silent matrices at no second readiness exchange, actual2 versus expected1, actual101. Both cases confirmed physical cleanup and successful termination before panicking. Their real captures contain uci, isready, isready and quit, with no forged log or fixture edit. The fault was restored byte-identically, without offsets. Both full matrices passed all ten cases at0, the full affected chess module passed82 at0, Rustfmt and whole-tree diff checks passed0. The prior Windows GNU0 remains tied to unchanged Windows-compiled inputs, with only Unix assertion order/diagnostics changed after it. The complete later pre-review will check that platform again.

All three phase2 reports are retained below. The first two flat launcher outputs were archived before resuming, under phase2-attempt1 and phase2-attempt2. Persistent thread01a18757-275f-7751-abf3-ebb8220e8b66, sensitive gpt-6.1-sol high, no writer switch. Exactly two proof resumes, the first clarifies temporary path authority and the second executes the independently reviewed actual-command control. No new permanent production API, framework or test case was added. Permanent code is the shared result-returning fixture-observation core, separate wire/completion waits and retained exact ownership/cancellation/wire assertions. The budget doc only corrects the mapped governing decision18.

Earlier observe-run.py output is supplementary observation, not exhaustive descendant-lifetime proof. Its historical raw process dumps and actual command statuses remain in scratch. The final extra-command control did not use that helper. Primary cleanup evidence is the actual retained Rust terminator/search joins, exact published/pending unregistration and captured-PID disappearance before assertion, with the existing real Child::wait path. Root independently inspected the complete final proof index and source diff.

Root independent replay and full phase pre-review are now launched as gate-phase2-root-proof.eynu7z. The one-off driver uses the existing Rust test harness directly, replays baseline/healthy delay, repaired/healthy delay, absent interruption and actual extra command, restores through exact Git patches, then runs positive matrices and82-test module. The outer existing agent-gate protects the heavy Rust/native and mutation workload. Contract and complete pre-review follow only after successful source restoration and native proof. This attempt is pending at this checkpoint, no green is inferred from launch. No cumulative code review, final browser/native acceptance, clean final gates, push, hosted confirmation or installation is claimed. The broader f-20261011-03 remains open. Plan authorship and arbitration shared one context. Detection used the same OpenAI model family as code.

### Raw lens-plan-r7.txt

``````text
RC-1 CLOSED — At plan level, `plan-r7-body.md:105` replaces the guard-removal premise contradicted by both retained controls. The replacement targets the real producer in `src-tauri/src/engine/process.rs:985`, using stdin writes and flushing at `:993`. The unchanged fixture records received commands at `src-tauri/src/chess.rs:2294`. Physical cleanup and successful termination precede the retained readiness-count assertion at `:4327`. This is a faithful behavioral negative control (confidence: 95).

No new delta or dependency defects found.

LATE OBSERVATIONS

Named limitation — The revised control has not run. Approval covers the plan correction only. Observed failure101, exact restoration, root replay and remaining proof are still required (confidence: 100).

Read-only review. No files changed or tests run. Review used a separate Codex session within the same OpenAI family, with shared plan authorship and arbitration.

VERDICT: APPROVED
``````

### Raw lens-correctness-r7.txt

``````text
RC-1 CLOSED — At plan level, the revised control sends a genuine additional `isready` through `ProcessChildControl::write_line` before `quit`. The unchanged fixture records it, and the retained count assertion rejects it after physical cleanup. Both previous controls correctly retain diagnostic-only status (confidence: 98).

No new correctness defects found in the delta or affected dependencies.

LATE OBSERVATIONS

Named limitation — The revised control has not run. Approval covers its plan-level contract, not successful negative proof or implementation acceptance (confidence: 100).

Review used a separate Codex context in the same OpenAI family. Plan authorship and arbitration shared one context.

VERDICT: APPROVED
``````

### Raw lens-tests-r7.txt

``````text
RC-1 CLOSED at plan level — The proposed fault uses the real stdin producer at `src-tauri/src/engine/process.rs:985`. The unchanged fixture records every command before processing it at `src-tauri/src/chess.rs:2294`. An additional `isready` would violate the retained `previous_ready + 1` assertion at `src-tauri/src/chess.rs:4327`, after physical cleanup is confirmed. This is a faithful negative control for the command-count requirement (confidence: 99).

No new delta or dependency defects, or blockers found.

Named limitation — The revised control remains unexecuted. Approval covers its proof design only. Acceptance still requires the specified assertion failure, exit101, cleanup, exact restoration and independent replay (confidence: 100).

Review used a separate Codex context in the same OpenAI family. Plan authorship and arbitration share one context.

VERDICT: APPROVED
``````

### Raw lens-engine-protocol-r7.txt

``````text
RC-1 CLOSED — at plan level (confidence: 98). The replacement injects a genuine extra `isready` through the owned stdin in `process.rs:985–999`. The unchanged fixture records it before processing, and `chess.rs:4327` checks its count after physical cleanup. This faithfully challenges the retained one-exchange assertion without forging evidence or changing expectations.

No new delta/dependency defects or engine-protocol blockers found. Execution, observed exit101, root replay and byte-identical production restoration remain required before phase2 acceptance. Review used a separate Codex context within the same model family.

VERDICT: APPROVED
``````

### Raw phase2-attempt1/phase-2.txt

``````text
Changed only [chess.rs](src-tauri/src/chess.rs) to separate wire progress from cleanup, and [docs/bundle-budgets.md](docs/bundle-budgets.md) to correct the citation to `d-20261029-18`. Changes remain unstaged.

| Proof | Exit | Result |
|---|---:|---|
| Baseline + 900 ms exit delay | 101 | 600 ms completion timeout |
| Repair + identical delay | 0 | All six slow cases passed with cleanup |
| Preemption suppressed | 101 | Wire witness failed at 5.0002 s, cleanup completed |
| Unmodified matrices | 0 | All ten cases passed |
| Full `chess::tests::` | 0 | 82 passed |
| Rustfmt / Windows check | 0 / 0 | Passed |
| Owned / whole-tree diff check | 0 / 2 | Foreign review record has blank EOF at line 810 |

All temporary controls were Git-restored byte-identically, without offsets. Every monitored run ended with no remaining descendants.

**Control 3 remains unresolved.** Its relevant guards are in production `chess.rs`, outside the authorized temporary-edit scope. The source trace and requested root judgment are recorded. No substitute control was used.

[Proof index, raw logs, patches, commands and source snapshots](/tmp/build-build-opening-game-references-20261029-064642-82fa88e8/phase2-proof/proof-index.md). Root replay, pre-review and acceptance remain pending.
``````

### Raw phase2-attempt2/phase-2.txt

``````text
The continuation criterion remains unmet. Both guard-removal controls exited **0**, with no extra `isready` or `go`. Each run confirmed physical cleanup and successful termination for all six cases. No exit-101 proof was fabricated.

Both production sections are restored byte-identically. The [exact permanent diff](/tmp/build-build-opening-game-references-20261029-064642-82fa88e8/phase2-proof/continuation/final-owned.diff) contains only the test witness repair, Unix-only assertion ordering and diagnostics, and the approved budget citation correction.

Final proofs:

- Warm matrices: **0**, all ten cases passed.
- Full chess module: **0**, 82 passed.
- Rustfmt and both diff checks: **0**.
- Windows: prior **0** reused, Windows-compiled code unchanged.

[Proof index](/tmp/build-build-opening-game-references-20261029-064642-82fa88e8/phase2-proof/continuation/proof-index.md) contains exact patches, commands, logs, restoration hashes, cleanup trace and historical control statuses.

Source remains unstaged. Root judgment on the unresolved continuation proof, independent replay and pre-review remain pending.
``````

### Raw phase-2.txt

``````text
The approved control produced the required **101**: both matrices failed `no second readiness exchange`, actual **2**, expected **1**, after confirmed physical cleanup and successful termination.

The fault was Git-restored byte-identically without offsets. This resume leaves permanent files unchanged from entry.

| Restored proof | Exit |
|---|---:|
| Both matrices, all ten cases | 0 |
| Full chess module, 82 tests | 0 |
| Rustfmt | 0 |
| `git diff --check` | 0 |
| Prior Windows proof, reused | 0 |

Historical delay **101→0** and missing-preemption **101** receipts remain retained. Both guard-removal **0** attempts remain diagnostic-only.

[Exact permanent diff](/tmp/build-build-opening-game-references-20261029-064642-82fa88e8/phase2-proof/extra-ready/final-owned.diff) · [Final proof index, logs, commands, snapshots and hashes](/tmp/build-build-opening-game-references-20261029-064642-82fa88e8/phase2-proof/extra-ready/proof-index.md)

Changes remain unstaged. Root replay, pre-review and final gates remain pending.
``````

### Raw plan-r7-block.txt

``````text
ROUND: 7
DELTA: /tmp/build-build-opening-game-references-20261029-064642-82fa88e8/plan-r7.delta
REVISED:
## Release precondition amendment and plan round 6
## Release precondition amendment and plan round 6 > ### Round7 proof-control correction
SETTLED:
# Plan: clickable ChessBase game citations
## Goal
## MANDATE
## Threat model and non-goals
## Traced premises
## Approach
## Approach > ### O1 — recognize citations without changing the preparation
## Approach > ### O2 — resolve local games honestly
## Approach > ### O3 — open the selected full game through the existing admission path
## Approach > ### O4 — verify the complete interaction
## Decisions and trade-offs
## Risks / open questions
## Not part of this task
## Phases
``````

## Root native replay and phase2 gate completion

Root canonically polled gate-phase2-root-proof.eynu7z at actual0, launch HEAD1ff1e7bd1753b011ff17fa925fd041324de8cf03. Its wrapper span was2339.519s, including1005.702s before the first owned source operation. That interval includes shared FIFO wait and minimal startup, it is not active review time. Native replay, complete contract and complete pre-review all finished0. This supersedes the preceding pending-launch status while preserving it as history.

Root used direct Cargo test commands and uniquely contextual Git patches, without observe-run.py. The old helper with900ms healthy exit delay failed101 at its600ms aggregate wait. The repaired helper with the identical fixture input passed0 across six cases. Removing the three actual interruption sites failed101 on the five-second quit witness, with physical cleanup confirmed before assertion. The real extra isready command failed both slow/silent tests101 on count2 versus1 after successful termination and physical cleanup. Every fault and the old-test reversal restored exact source bytes, no offsets. Both complete matrices passed ten cases at0, and the full affected chess module passed82 at0. Rustfmt and global diff check passed0. Exact commands, exits, logs, frozen source and restoration hashes are retained under root-native-proof.

The fresh pre-review logs artifacts/gates/20261029T122317092Z-2715846 record build12.5s, format/lint/type checks4.0s, frontend mapping0.7s, backend mapping1.8s, Windows GNU clippy18.6s, bundle0.8s and selected mutation972.4s, all0. Every selected mutation package met its100 percent floor. The existing bundle reporter measured entry556146, largestLazy486067 and total1660313 exactly on this rebased production build, matching the recorded candidate with9687 bytes under the reviewed total ceiling. No further numeric allowance or coverage change occurred.

Root inspected the final permanent diff before committing sourcefecc1e0b, the native test-only repair, separately from779727dd, the budget-doc decision reference. No production diff remains in engine/process.rs. Only the39 original citation source paths plus the native test file belong to the source manifest. Source roles, matrices, cancellation, no further readiness/go and cleanup requirements are unchanged. The bounded implementation and proof are annotated on existing f-20261011-03, whose broader question remains open. Hosted macOS confirmation is still required, no local result is presented as Mac runtime proof.

The implementation phases are now locally complete and committed. The next required step is the first cumulative code review, including records. Final browser/native acceptance, final clean-tree gates, push, required hosted CI and reviewed installation remain pending. Plan authorship and arbitration shared one context. Detection used the same OpenAI model family as code.


### Canonical round7 delta

Exact UTF-8 delta bytes are retained as base64 to preserve the unified diff's space-only context lines without introducing trailing whitespace into this record. Decode this block with standard base64 to recover the canonical file. Raw scratch source is plan-r7.delta, SHA256 40a6150cf664a815e0c20a1588f78f219401def069dd5d26e32aa6146b8b61a5.

``````text
LS0tIC90bXAvYnVpbGQtYnVpbGQtb3BlbmluZy1nYW1lLXJlZmVyZW5jZXMtMjAyNjEwMjktMDY0NjQyLTgyZmE4OGU4L3BsYW4t
cjYtZmluYWwubWQKKysrIC90bXAvYnVpbGQtYnVpbGQtb3BlbmluZy1nYW1lLXJlZmVyZW5jZXMtMjAyNjEwMjktMDY0NjQyLTgy
ZmE4OGU4L3BsYW4tcjcubWQKQEAgLTEwMiw3ICsxMDIsNyBAQAogCiAtIEZyZWV6ZSBiYXNlbGluZSBhbmQgcmVwYWlyZWQgaGVs
cGVyLiBBcHBseSBhbiBpZGVudGljYWwgdGVtcG9yYXJ5OTAwbXMgaGVhbHRoeSBmaXh0dXJlLWV4aXQgZGVsYXkgYWZ0ZXIgd2ly
ZT1xdWl0LCBpbnNpZGUgdGhlIHVuY2hhbmdlZDNzIGdyYWNlZnVsIHF1aXQgYWxsb3dhbmNlLiBUaGUgYmFzZWxpbmU2MDBtcyB3
aXRuZXNzIG11c3QgZmFpbDEwMSBhbmQgdGhlIHJlcGFpcmVkIHdpdG5lc3MgbXVzdCBwYXNzMCB3aXRoIGNsZWFudXAsIHByb3Zp
bmcgdGhlIGFjdHVhbCBwaGFzZSBjb25mbGF0aW9uLiBEbyBub3QgZGVsYXkgb3Igd2Vha2VuIHByb3RvY29sIHByb2dyZXNzLiBS
ZXN0b3JlIGV4YWN0IGZpeHR1cmUgc291cmNlIGFuZCByZXRhaW4gbG9ncy9zdGF0dXNlcy4KIC0gU3VwcHJlc3MgdGFyZ2V0ZWQg
cHJlLWxlYXNlIGludGVycnVwdGlvbiB0ZW1wb3JhcmlseSBmb3Igc2lsZW50IGV4YWN0L2FsbC4gVGhlIHJlcGFpcmVkIHdpcmUt
cHJvZ3Jlc3Mgd2l0bmVzcyBtdXN0IHJlamVjdCBpdCBiZWZvcmUgdGhlIHVuY2hhbmdlZDEwcyByZWFkaW5lc3MgZGVhZGxpbmUs
IGRlc3BpdGUgdGhlIGxhcmdlciBjb21wbGV0aW9uIGFsbG93YW5jZS4gUmVzdG9yZSBleGFjdCBzb3VyY2UgYW5kIHJldGFpbiBs
b2dzL3N0YXR1c2VzLgotLSBSZW1vdmUgdGhlIHJlbGV2YW50IGJldHdlZW4tZXhjaGFuZ2UgY2FuY2VsbGF0aW9uIGd1YXJkIHRl
bXBvcmFyaWx5IGFuZCByZXF1aXJlIHJldGFpbmVkIGV4dHJhLWlzcmVhZHkgb3IgZ28gYXNzZXJ0aW9ucyB0byByZWplY3QgY29u
dGludWF0aW9uLiBLZWVwIGV4YWN0IHByb2R1Y3Rpb24gcmVzdG9yYXRpb24gYW5kIGNsZWFudXAgZXZpZGVuY2UuIElmIHNvdXJj
ZSB0cmFjaW5nIGVzdGFibGlzaGVzIGEgZGlmZmVyZW50IG5lY2Vzc2FyeSBuZWdhdGl2ZSBjb250cm9sLCBvYnRhaW4gZnJlc2gg
anVkZ21lbnQgYmVmb3JlIHN1YnN0aXR1dGluZyBpdCwgbmV2ZXIgc2lsZW50bHkgd2FpdmUgdGhpcyBvYmxpZ2F0aW9uLgorLSBU
ZW1wb3JhcmlseSBpbnNlcnQgb25lIGFjdHVhbCBhZGRpdGlvbmFsIGlzcmVhZHkgY29tbWFuZCBpbW1lZGlhdGVseSBiZWZvcmUg
cXVpdCBpbiBQcm9jZXNzQ2hpbGRDb250cm9sOjp3cml0ZV9xdWl0LCB0aHJvdWdoIGl0cyBleGlzdGluZyB3cml0ZV9saW5lIG1l
dGhvZC4gS2VlcCB0aGUgZml4dHVyZSwgY2FwdHVyZSBmaWxlLCBtYXRyaXggYW5kIGFsbCBhc3NlcnRpb25zIHVuY2hhbmdlZC4g
UmVxdWlyZSB0aGUgcmV0YWluZWQgbm8tc2Vjb25kLXJlYWRpbmVzcyBhc3NlcnRpb24gdG8gcmVqZWN0IHRoZSBleHRyYSByZWFs
IGNvbW1hbmQgYXQxMDEgYWZ0ZXIgc3VjY2Vzc2Z1bCBwaHlzaWNhbCBjbGVhbnVwLCB0aGVuIHJlc3RvcmUgcHJvZHVjdGlvbiBz
b3VyY2UgYnl0ZS1pZGVudGljYWxseS4gVGhpcyByZXBsYWNlcyBvbmx5IHRoZSBpbmVmZmVjdGl2ZSBndWFyZC1yZW1vdmFsIGZh
dWx0IHJlY2lwZSwgbm90IHRoZSBvbmUtZXhjaGFuZ2Uvbm8tZ28gY29udHJhY3QuCiAtIFJ1biBib3RoIGNvbXBsZXRlIHdhcm0t
dHJhbnNpdGlvbiBtYXRyaWNlcywgcmVsYXRlZCBhZmZlY3RlZCBuYXRpdmUgdGVzdHMsIFJ1c3QgZm9ybWF0dGluZywgZXhpc3Rp
bmcgV2luZG93cyBHTlUgY2hlY2sgYW5kIGNvbXBsZXRlIHByZS1yZXZpZXcuIE5vIGJhY2tlbmQgbXV0YXRpb24gc3VpdGUuIFJv
b3QgaW5kZXBlbmRlbnRseSByZXBsYXlzIHRoZSBkZWNpc2l2ZSBzdGFnZWQgYmVoYXZpb3IgYW5kIGV4YWN0IHJlc3RvcmF0aW9u
IGJlZm9yZSBjb21taXQuIEFuIGV4aXN0aW5nIHN1aXRlIGlzIGVub3VnaCwgbm8gY3VzdG9tIHNvdXJjZS10ZXh0IHZlcmlmaWVy
LgogCiBQaGFzZTIgaXMgYSBzZXBhcmF0ZSBzb3VyY2UgY29tbWl0LCB3aXRoIHJvb3QgaW5zcGVjdGlvbiBhbmQgc2Vuc2l0aXZl
IENvZGV4IHdyaXRlci4gVGhlIGN1bXVsYXRpdmUgcmV2aWV3IG5vdyBhZGRzIGVuZ2luZS1wcm90b2NvbCBhbmQgcGxhdGZvcm0t
c2VtYW50aWNzLCBwbHVzIGV4aXN0aW5nIGFwcGxpY2FibGUgY29ycmVjdG5lc3Mvcm9vdC1jYXVzZS90ZXN0cy9jaGVzcyBsZW5z
ZXMuIFRoZSBmaW5hbCBjbGVhbiByZXZpZXdlZCBnYXRlIGJlY29tZXMgcG5wbSBnYXRlczpwdXNoIC0tIC0tcnVzdCAtLWZyb250
ZW5kLiBIb3N0ZWQgbWFjT1MgaXMgbm90IHJ1bm5hYmxlIG9uIHRoaXMgTGludXggaG9zdCwgc28gb25lIGhvc3RlZCBkaXNwYXRj
aCBwZXIgdmVyaWZpZWQgcmVwYWlyIGF0dGVtcHQgaXMgcGVybWl0dGVkIHVuZGVyIHRoZSBleGlzdGluZyBwb2xpY3kgZXhjZXB0
aW9uLCBvbmx5IGFmdGVyIGV2ZXJ5IGxvY2FsbHkgcmVwcm9kdWNpYmxlIGFmZmVjdGVkIGNoZWNrIGlzIGdyZWVuLiBObyByZXJ1
bi11bnRpbC1ncmVlbiBsb29wLiBBIGN1cnJlbnQgcmVkIHJlbW90ZSByZW1haW5zIGEgcmVmdXNhbCB1bnRpbCB0aGlzIHJlcGFp
ciBkZW1vbnN0cmFibHkgb3ducyB0aGUgbGlzdGVkIGZhaWx1cmUuIEV4YWN0IHB1c2hlZC1TSEEgcmVxdWlyZWQgQ0kgYW5kIHJl
dmlld2VkIGluc3RhbGxlciByZW1haW4gbWFuZGF0b3J5LgpAQCAtMTExLDMgKzExMSwxMSBAQAogCiAKIAorIyMjIFJvdW5kNyBw
cm9vZi1jb250cm9sIGNvcnJlY3Rpb24KKworUm9vdC1rbm93biBSQy0xIGlzIHRoZSB1bmZ1bGZpbGxlZCBjb250aW51YXRpb24g
Y29udHJvbCwgbm90IGFuIGluZGVwZW5kZW50IG5ldyBsZW5zIGRpc2NvdmVyeS4gVGhlIHBoYXNlMiB3cml0ZXIgcGVyZm9ybWVk
IHR3byBhY3R1YWwgZ3VhcmQtcmVtb3ZhbCBjb250cm9scywgaW5jbHVkaW5nIGFsbCB0cmFjZWQgZ3VhcmRzIGFjcm9zcyBXYXJt
RW5naW5lOjpuZXcvc3RhcnQsIEVuZ2luZVByb2Nlc3M6OnNldF9vcHRpb25zX2lubmVyIGFuZCB0aGUgc3VwZXJ2aXNvcidzIHdh
cm0tc3RhcnQgYm91bmRhcnkuIEJvdGggc2xvdyBtYXRyaWNlcyBzdGlsbCBwYXNzZWQwIHdpdGggbm8gZXh0cmEgcmVhZGluZXNz
IG9yIGdvLiBDYXB0dXJlIGFuZCBwaHlzaWNhbCBjbGVhbnVwIHdlcmUgcmVhbC4gT3RoZXIgY2FuY2VsbGF0aW9uIGFuZCB0ZWFy
ZG93biBzYWZlZ3VhcmRzIHByZXZlbnRlZCBjb250aW51YXRpb24sIHNvIHRoZXNlIGFyZSBkaWFnbm9zdGljMCBvdXRjb21lcyBh
bmQgcmVjZWl2ZSBubyBuZWdhdGl2ZS1jb250cm9sIGNyZWRpdC4gVGhlIGZpcnN0IG5hcnJvdyB0ZW1wb3Jhcnkgc2NvcGUgbmVl
ZGVkIHJvb3QgY2xhcmlmaWNhdGlvbiBmb3IgcHJvZHVjdGlvbiBjaGVzcy5ycy4gVGhhdCBzY29wZSB3YXMgZ3JhbnRlZCB3aXRo
b3V0IGNoYW5naW5nIHRoZSBhcHByb3ZlZCBhY2NlcHRhbmNlIGNvbnRyYWN0LiBJdHMgY29tcGxldGUgYXV0aG9yaXplZCBmYXVs
dCBzdGlsbCBkaWQgbm90IGV4cG9zZSBhIGJhZCB3aXJlIHJlc3VsdC4gRXhhY3Qgc291cmNlIHdhcyByZXN0b3JlZCwgYW5kIHRo
ZSB3cml0ZXIgZGlkIG5vdCBzdWJzdGl0dXRlIGFub3RoZXIgY29udHJvbCBzaWxlbnRseS4KKworVGhlIHJldmlzZWQgcmVjaXBl
IGFib3ZlIGNoYW5nZXMgdGhlIGFjdHVhbCBwcm9kdWN0aW9uIGNvbW1hbmQgcHJvZHVjZXIgdGhyb3VnaCBvbmUgdGVtcG9yYXJ5
IGxpbmUgaW4gdGhlIGV4aXN0aW5nIFByb2Nlc3NDaGlsZENvbnRyb2w6OndyaXRlX3F1aXQuIFRoYXQgbWV0aG9kIGNhbGxzIHdy
aXRlX2xpbmUgb24gdGhlIG93bmVkIHN0ZGluLCBhcHBlbmRzIGEgbmV3bGluZSBhbmQgZmx1c2hlcywgdGhlbiB3cml0ZXMgcXVp
dC4gQWRkaW5nIGlzcmVhZHkgdGhlcmUgbWFrZXMgdGhlIGNoaWxkIG9ic2VydmUgYSBnZW51aW5lIGV4dHJhIFVDSSBjb21tYW5k
IGFmdGVyIHRlcm1pbmF0aW9uLCByYXRoZXIgdGhhbiBlZGl0aW5nIHRoZSBjYXB0dXJlIG9yIGV4cGVjdGVkIGZpeHR1cmUuIFRo
ZSBleGlzdGluZyBjaGlsZCBsb2dzIGVhY2ggcmVjZWl2ZWQgY29tbWFuZCBiZWZvcmUgcHJvY2Vzc2luZyBpdC4gSXRzMjAwbXMg
cmVhZGluZXNzIGJlaGF2aW9yIHN0YXlzIHVuY2hhbmdlZCwgcXVpdCBzdGlsbCBmb2xsb3dzLCBhbmQgdGhlIG5ldyB0ZXN0IG11
c3QgZmlyc3QgY29uZmlybSBwaHlzaWNhbCBjbGVhbnVwIGFuZCB0aGVuIHJlamVjdCB0aGUgcmVhbCBjb3VudCBpbmNyZW1lbnQu
IFRoZSBzZXBhcmF0ZTVzIHByb2dyZXNzIGFuZDEycyBzdWNjZXNzZnVsLWNsZWFudXAgd2l0bmVzc2VzLCBhbGwgdGVuIGNhc2Vz
LCBjYW5jZWxsYXRpb24sIG5vLWdvLCBvd25lcnNoaXAgYW5kIHByb2R1Y3Rpb24gZGVmYXVsdHMgcmVtYWluIHVuY2hhbmdlZC4g
Tm8gcGVybWFuZW50IHByb2R1Y3Rpb24gc291cmNlIGNoYW5nZSBpcyBwcm9wb3NlZC4gSGVhbHRoeTkwMG1zIGRlbGF5IGFuZCBh
YnNlbnQgaW50ZXJydXB0aW9uIHdlcmUgYWxyZWFkeSBpbmRlcGVuZGVudGx5IG9ic2VydmVkIGJ5IHRoZSB3cml0ZXIgYXMxMDEv
MCBhbmQxMDEgcmVzcGVjdGl2ZWx5LCB3aXRoIHN1Y2Nlc3NmdWwgY2xlYW51cC4gUm9vdCByZXBsYXkgYW5kIGZ1bGwgcHJlLXJl
dmlldyBhcmUgc3RpbGwgcmVxdWlyZWQuCisKK0F1dGhvcml0eSBpcyB0aGUgc2FtZSByZXF1aXJlZC1DSSByZWxlYXNlIHByZWNv
bmRpdGlvbiBhbmQgYmVoYXZpb3JhbCB0ZXN0LXByb29mIG9ibGlnYXRpb24uIFRoZSBlYXJsaWVyIHJlcXVpcmVtZW50IHRoYXQg
cmVtb3Zpbmcgb25lIGNsYXNzIG9mIHJlZHVuZGFudCBndWFyZHMgbXVzdCBjYXVzZSBhIGJhZCB3aXJlIG91dGNvbWUgd2FzIGFu
IHVuc3VwcG9ydGVkIGltcGxlbWVudGF0aW9uIHByZW1pc2UuIEFjdHVhbCB6ZXJvLXJlc3VsdCBjb250cm9scyBhcmUgbmV3IGV2
aWRlbmNlIGZvciByZXZpc2luZyB0aGF0IHJlY2lwZS4gVGhpcyBpcyBhIHByb29mLWRlc2lnbiBjb3JyZWN0aW9uLCBubyBwcm9k
dWN0IGludGVudCBjaGFuZ2UuIERlY2lzaW9uIGQtMjAyNjEwMjktMTkgcmVtYWlucyBhdXRob3JpdGF0aXZlIGZvciB0aGUgcGVy
bWFuZW50IHRlc3QgbWVjaGFuaXNtLCB3aXRoIGl0cyBvbGQgdGhpcmQtY29udHJvbCByZWNpcGUgcmVxdWlyaW5nIGV4cGxpY2l0
IHNjb3BlZCBjb3JyZWN0aW9uIGFmdGVyIGZyZXNoIHJldmlldy4gUm91bmQ3IHBsYW4sIGNvcnJlY3RuZXNzLCB0ZXN0cyBhbmQg
ZW5naW5lLXByb3RvY29sIGp1ZGdlIFJDLTEgYW5kIHRoaXMgZXhhY3QgYWx0ZXJuYXRpdmUgYmVmb3JlIGl0IHJ1bnMuIE5vIHZl
cmRpY3Qgb3IgYWRvcHRpb24gaXMgYXNzdW1lZC4gUmV0YWluIHRoZSBvbGQgY29udHJvbHMgYXMgZGlhZ25vc3RpY3MgYW5kIGFs
bCByYXcgaGlzdG9yaWVzLgorCg==
``````


## Cumulative code review round1

REVIEWED_THROUGH=7cd902f1ccfe7eec3c8e8990ed0f056c563c8af9. Published base9b76350b66518a2cfbf1ff2739370dc24ad38ffb. All eleven launcher leaves completed under the canonical poller. Ten code lenses used the sensitive read role and the records lens used mechanical read. All resolved to gpt-6.1-sol medium in separate Codex sessions. Plan authorship and arbitration shared one context. Detection used the same OpenAI model family as code.

The second fetch/rebase preserved all40 owned source files byte-identically. Its range-diff carries nineteen commits with equality, the remaining findings annotation changed only surrounding published ledger context. Published content was retained and no source was skipped. Root inspected the actual range before launch. This first cumulative review does not claim to review the already published variation-chooser work beneath it.

Round1 wall from packet preparation to the final report was 244.248 seconds. Parallel reviewer durations are not summed as active work, active wall is unknown. No provider quota wait or executor fallback occurred. Seven plan rounds remain complete, with unchanged adoptions r1=1 r2=0 r3=1 r4=0 r5=0 r6=1 r7=0. Plan r7 wall was121.962s. The native phase and its original proof are completed, later citation repairs below require their own proof and closure.

### Retained findings and upfront dispositions

Blocking correctness:

- DR1, correctness src/utils/gameReferences.ts:47, blocker99, Fix. A parenthesized event section can prematurely end the citation, dropping supplied date/round and allowing an incorrect automatic opening. Filed f-20261029-05. Preserve all later metadata, real final label and prose boundary. Ambiguity remains explicit choice.
- DR2, correctness src/utils/gameReferences.ts:116, blocker96, Fix. Uppercase full JOHN is treated as initials and matches supplied JO. Filed with DR3 as f-20261029-06. Identity must be case-insensitive, full given names derive initials by words.
- DR3, correctness src/utils/gameReferences.ts:108, blocker98, Fix. Given-first JK loses abbreviation meaning after lowercasing and is omitted while surname-first JK matches. Both orders and all capitalization retain an equal compact initial token conservatively as unverified. Explicit spaced/dotted initials and real multiword initials can verify. This removes uppercase-only guessing and prevents ambiguous compact words from auto-opening.

Maintainability and proof:

- DR4, minimalism scripts/verify-app.mjs:3013, should-fix98, Fix. Consolidate the second PGN fixture creator with the existing creator at2018, preserving every command, fixture and assertion.
- DR5, minimalism src/utils/gameReferences.ts:53, should-fix99, Fix. Delete unused event/year/round lexical hints and their separate parser. Preserve visible recognition and lookup assertions.
- DR6, tests src/utils/gameReferences.ts:287, should-fix99, Fix. Add retained-candidate evidence that an empty page before the advertised count is incomplete.
- DR7, tests src/utils/gameReferences.test.ts:681, should-fix99, Fix. Exercise the64-source and256-player caps and their incomplete classification with production-only removal controls.
- DR8, tests src/components/common/GameReference.test.tsx:530, should-fix98, Fix. Exercise closing intent while the tab and cached store remain intact before React cleanup. Removing only that guard must fail.
- DR9, code-quality src/utils/gameReferences.ts:324, nit99, Fix. Rename complete Player records from ids to matchedPlayers.

Nine unique findings adopted in diff r1, none Skip or Defer. Root-cause, error-handling, chess-semantics, persisted-state, engine-protocol, platform-semantics and records reported no findings. Named limitations, including final positive native acceptance, hosted Mac proof and the unrun FreeBSD probe, remain explicit. The count of332 actual repertoire citations is root-observed, not independently remeasured by the records lens.

Three disjoint write scopes were specified, matching module and test, fixture creator, and close-intent test. The first launch was refused before any JSONL/report path was printed because only2494MiB of the existing3072MiB memory reserve was available. No writer started, no reserve override or provider/model fallback was used. Retry waits for existing headroom and preserves this refusal as history. Repair, complete pre-review and closure remain pending at this checkpoint.

### Raw cumulative round1 reports

#### correctness

``````text
[blocker] src/utils/gameReferences.ts:47 — For `0-1 Beerdsen,T-Bluebaum,M Tata Steel (A) Wijk aan Zee 2022 (3)`, `(A)` prematurely closes the citation. A candidate whose event is `Tata Steel (A)` becomes verified even with date `2021.01.01` and round `9`, allowing automatic opening despite contradictory supplied metadata. Preserve the remaining constraints. (confidence: 99)

[blocker] src/utils/gameReferences.ts:116 — Reference `Smith,JO` incorrectly matches database name `Smith, JOHN`. The uppercase-name heuristic interprets JOHN as four initials and accepts prefix JO, while `Smith, John` correctly produces only initial J and rejects it. Capitalization therefore changes player identity and can automatically open the wrong game. (confidence: 96)

[blocker] src/utils/gameReferences.ts:108 — Reference `Smith,JK` rejects database name `JK Smith`. This branch lowercases JK before abbreviation detection, producing only initial j. The equivalent `Smith, JK` succeeds. A valid ordered-initial match is consequently omitted from lookup. (confidence: 98)

Limitation: source tracing and existing native receipts only. No tests or UI runs were performed under this read-only assignment. Review shares the author’s model family.

VERDICT: REVISE
``````

#### root-cause

``````text
No root-cause or prior-fix regression findings. The corrections reach the mechanisms causing premature candidate rejection, false search retirement and conflated protocol/cleanup timing. Inspected reversal receipts substantiate the fixes.

Named limitation — Final positive real-app acceptance and hosted macOS confirmation remain pending (confidence: 100).

Read-only review. No files changed or tests run. Reviewer and authors share the OpenAI model family.

VERDICT: APPROVED
``````

#### minimalism

``````text
[should-fix] scripts/verify-app.mjs:3013 — `createCitationFile` duplicates the existing PGN fixture creator at line 2018, including metadata and content construction. Extract one shared creator accepting the existing invocation function and workspace, then route both verification sections through it. This removes the second implementation without changing either proof. (confidence: 98)

[should-fix] src/utils/gameReferences.ts:53 — The recognizer parses `event`, `year` and `round` hints that no production caller reads. Lookup interprets `context` independently against candidate headers. Delete the hint fields, their assignments and the separate lexical parser, approximately 21 production lines. Replace hint-only test expectations with recognition or lookup assertions. Recognition, verification and admission behavior remain covered. (confidence: 99)

Minimum-diff counterfactuals for added files:

- `docs/game-references.md`: retain the feature and local-source guidance.
- `e2e/game-references.spec.ts`: retain the existing fixture harness and interaction coverage.
- Each of the three citation PNG snapshots: retain its distinct notation, choice or missing-state evidence.
- `GameReference.tsx`: retain the notation-owned request and dialog.
- `GameReference.test.tsx`: retain ownership, cancellation and admission coverage.
- `databaseGame.ts`: retain the extraction used by three production callers.
- `gameReferences.ts`: retain recognition and bounded lookup, remove the unused hints above.
- `gameReferences.test.ts`: retain behavioral coverage, remove hint-only expectations.

Review was read-only, with no tests run. Author and reviewer share the OpenAI model family.

VERDICT: REVISE
``````

#### tests

``````text
[should-fix] src/utils/gameReferences.ts:287 — No test supplies an empty page before the advertised count is exhausted. Removing this branch’s `budget(source)` would leave tests green while marking a truncated search complete, allowing a retained unique candidate to auto-open. (confidence: 99)

[should-fix] src/utils/gameReferences.test.ts:681 — The limit tests exercise requests, candidates and failure details, but never exceed 64 sources or 256 matching player IDs. Removing either corresponding bound, or the source-overflow incomplete warning, would pass the suite. (confidence: 99)

[should-fix] src/components/common/GameReference.test.tsx:530 — The close case removes the tab and cached store together. No case settles lookup while `closingTabsAtom` marks an otherwise intact owner. Deleting the closing-intent guard would pass these tests and permit automatic admission during pending close cleanup. (confidence: 98)

VERDICT: APPROVED
``````

#### error-handling

``````text
No error-handling defects found in the reviewed range. Source failures surface as incomplete searches, block automatic opening and retain guidance. Admission failures reach the existing notification path.

VERDICT: APPROVED
``````

#### code-quality

``````text
[nit] src/utils/gameReferences.ts:324 — `ids` contains complete `Player` records and returns them to callers that access `.id`. Rename it `matchedPlayers` so the name describes the retained values (confidence: 99).

Review used the same OpenAI model family as the implementation.

VERDICT: APPROVED
``````

#### chess-semantics

``````text
No chess-domain violations found in the admission, FEN initialization, variation parsing, annotation preservation, or affected path and cache handling.

Review was read-only. No tests were run. Author and reviewer share the OpenAI model family.

VERDICT: APPROVED
``````

#### persisted-state

``````text
No findings within this lens. Tab seed writes and hydration share the compressed codec and validated schema. Citation lookup state remains transient and scoped to the tree store and physical document key. Existing quota handling, close cleanup and unload flushing remain intact.

Read-only source review. No files changed or tests run. Review used the same OpenAI model family as implementation.

VERDICT: APPROVED
``````

#### engine-protocol

``````text
No in-scope defects found. Traced supervisor ownership, UCI ordering, warm option state, analysis payload guards and shared report/game flows.

Inspected native receipts confirm the missing-preemption and extra-readiness faults fail, while restored termination matrices and all 82 affected chess tests pass. No files changed or tests run by this lens.

Review used a separate session within the same OpenAI family as implementation.

VERDICT: APPROVED
``````

#### platform-semantics

``````text
No platform-semantics findings.

Inspected the changed Rust helpers, Unix fixtures, citation lookup and admission dependencies, native proof receipts, Windows compile log and CI definitions. Matching `cfg(unix)` guards cover helpers and callers. Citation lookup preserves opaque handles. Windows correctly retains standalone database support.

Recorded proof confirms 82 Linux chess tests passed and `pnpm rust:windows:check` passed. The latter establishes compilation only.

Limitations: the Linux-to-FreeBSD source probe was not run. Candidate macOS runtime confirmation remains pending in `rust-macos-test`. Windows runtime proof belongs to `rust-windows-test`, which excludes these Unix matrices. `rust-platform` checks macOS architectures and Windows MSVC compilation and Clippy.

Read-only review completed without changes or test runs. Reviewer and authors share the OpenAI model family.

VERDICT: APPROVED
``````

#### records

``````text
No findings. Source claims, proof receipts, raw-report preservation and explicit supersessions checked consistently. The original repertoire’s 332-citation count was not independently verifiable from the supplied artifacts. No files changed.

Review used a separate Codex context in the same OpenAI model family.

VERDICT: APPROVED
``````


## First review-repair batch and root RC-2

All three repair-launch2 writers completed under the canonical poller. Matching and close-proof used normal gpt-6.1-sol high, fixture extraction mechanical gpt-6-luna max. The earlier memory refusal was retried without changing reserves. No foreign state was modified. Source and tests remain unstaged until complete root proof and pre-review.

DR4 extraction routes nine linked and three citation fixtures through one createWorkspacePgnFixture, preserving the exact native command, metadata and PGN payload. Node syntax, format, lint and diff checks passed0. Its reversal/restoration is byte-identical but has no behavioral red, correctly disclosed for a behavior-preserving extraction. Full ordinary native acceptance remains required.

DR8's real-workspace pending-close test retains both tab and cached-store identities, settles before React cleanup and checks no resolution, lexing, navigation, admission or publication. Removing only the close-intent guard failed1 on actual unintended admission, restored28 tests passed0 with identical source/test bytes and no offsets. Its types2 occurred during the concurrent matching edit's stale hint assertion. The matching writer's later final types0 resolves that temporary integration failure, no green is invented for the earlier command.

The matching writer's first candidate ran eight separate production-only controls. Each red was1, each Git reverse/restore0 with no offsets and equal source/test hashes, and each restored test0. They cover original parenthesized-event wrong automatic admission, ambiguous context verification, initials identity, empty-page classification, source traversal bound, source-overflow classification, matching-player bound and failed-visit classification. Final four-file suite reported203 passed and1 failed, the out-of-scope Comment.test.tsx assertion on deleted year/round hints. Types, format, lint and diff checks passed0. The stale consumer must be updated, unused hints stay deleted. These are valid historical controls, not acceptance of every new boundary branch.

Root found RC-2 on the first completed repair. parenthesis-prose-candidate.log imports the actual module and shows offered:false for the exact valid Tata Steel (A), Wijk aan Zee, Date2022.12.01, Round3 game when its full citation is followed by Better was Bd3 (A). or Better was Bd3 (1). It returns offered:true for Better was Bd3. The last-parenthesis rule fails to establish the real close and the global round scan turns ordinary prose into a contradiction. Source SHA256 f9e88763f52b0e6c22e089bb1d3550281974fc0d9c21d6cb04c760bc43fb3c3d was unchanged during the probe and equals the completed writer's final file. Root annotated still-open f-20261029-05 immediately. This is correction-created rework under DR1, with no new lens adoption or closure. Earlier parenthesis-prose-diagnostic.log observed a temporary worker reversal and is excluded from candidate evidence.

### Plan round8 mechanism judgment

Four fresh read-only lenses explicitly CLOSED RC-2 at plan level and APPROVED the full-tail and candidate-prefix boundary, with no additional findings. Plan lens used review-plan high, correctness/minimalism/tests sensitive read medium, all gpt-6.1-sol. Round8 wall was 163.079 seconds, from packet preparation to final report. Active wall is unknown, parallel durations are not summed. No provider quota wait or executor switch occurred. Adoptions now r1=1 r2=0 r3=1 r4=0 r5=0 r6=1 r7=0 r8=0, unchanged three unique adopted plan issues closed. RC-1 and RC-2 are supplied root issues, not counted again as independent lens discoveries.

The operative frozen plan-r8.md separates full bounded matching tail from visible label end, resolves actual event/site headers before anchored date/round fields, and excludes ordinary prose after the actual round. It preserves identifiable contradictions, names-only and unknown-tail behavior, rich labels, all bounds and ownership. It explicitly includes Comment.test.tsx's stale consumer and operation semantics in docs/game-references.md. No other source/native/gate obligation changes.

Root resumed the original matching thread01a187c2-f085-7033-9ef1-c844df7e18a8 at normal high in repair-r1-resume1, with a new report directory preserving the first raw output and receipts. The launcher noted no local pin in that fresh directory and resolved the same normal gpt-6.1-sol high from the unchanged registry. This is a same-thread, same-role continuation, no model escalation or fallback. Eight regenerated controls and the new RC-2 reversal proof run inside one existing agent-gate scope before temporary mutations, removing the observed separate admission waits. Source repair, root replay, complete pre-review and cumulative closure remain pending at this checkpoint. Plan authorship and arbitration shared one context. Detection used the same OpenAI model family as code.

### First repair raw reports

#### fix-citation-matching-r1.txt

``````text
Implemented the requested repairs, left unstaged:

- [gameReferences.ts](/home/felixb/Projekte/chessfable.worktrees/opening-game-references-opening-game-references-20261029-064642-82fa88e8/src/utils/gameReferences.ts) preserves citation context, shares player certainty, removes unused hints and renames `matchedPlayers`.
- [gameReferences.test.ts](/home/felixb/Projekte/chessfable.worktrees/opening-game-references-opening-game-references-20261029-064642-82fa88e8/src/utils/gameReferences.test.ts) adds matching, rich-offset, pagination and limit regressions.

All eight production-only controls failed with exit 1, then passed with exit 0 after Git restoration. No offsets occurred, and source/test hashes matched.

Types, formatting, lint and diff checks passed. The required four-file suite finished **203 passed, 1 failed**. The remaining failure is the out-of-scope `Comment.test.tsx:118` expectation for DR5’s deleted `year` and `round` hints. Root must update that assertion.

[Exact commands, logs, reversal evidence and limitations](/tmp/build-build-opening-game-references-20261029-064642-82fa88e8/citation-matching-proof/RESULTS.md). Foreign changes were preserved. No browser or native acceptance was run.
``````

#### fix-citation-fixtures-r1.txt

``````text
Implemented the shared PGN fixture creator in [scripts/verify-app.mjs](/home/felixb/Projekte/chessfable.worktrees/opening-game-references-opening-game-references-20261029-064642-82fa88e8/scripts/verify-app.mjs:747). The linked collection flow now uses it for nine fixtures, and the citation flow for three. The sole `create_workspace_file` payload construction is inside the helper. Fixture data, metadata, defaults, assertions, waits, and failure handling remain unchanged.

**Checks:** `node --check scripts/verify-app.mjs`, `pnpm exec oxfmt --check scripts/verify-app.mjs`, `pnpm exec oxlint --deny-warnings scripts/verify-app.mjs`, and `git diff --check` all exited 0.

**Reversal:** The production-only inverse patch applied cleanly with exit 0, and the target matched `HEAD` while reversed. Restoration also applied cleanly with exit 0 and no offsets. The restored patch matched the captured patch byte-for-byte. Logs and exits are in [the proof directory](/tmp/build-build-opening-game-references-20261029-064642-82fa88e8/dr4-should-fix98-proof/commands.txt).

An actual red specific to this structural change was not available: the extraction preserves behavior, and the assignment forbids adding a mirror test or verifier. The root-owned `pnpm verify:app` was not run.

Other worktree changes were present in `src/components/common/GameReference.test.tsx`, `src/utils/gameReferences.test.ts`, `src/utils/gameReferences.ts`, and `tasks/handoffs/2026-10-29-opening-game-references-review.md`. I left them untouched.
``````

#### fix-citation-close-proof-r1.txt

``````text
Changed only [GameReference.test.tsx](src/components/common/GameReference.test.tsx:532), adding pending-close coverage with the real Jotai workspace, intact owner and cached store.

Proof:

- Guard-only Git reversal applied without offsets. New test failed on unintended native admission, with 27 tests passing.
- Git restoration applied without offsets. Source is byte-identical and the test remained unchanged.
- Restored suite: **28 passed**.
- Formatting, lint and `git diff --check`: exit **0**.
- TypeScript: exit **2**, outside scope at `src/utils/gameReferences.test.ts:364`, referencing missing `GameReference.year`.

Changes remain unstaged. Foreign work was preserved. No desktop acceptance is claimed.

[Exact commands, logs, exits and limitations](/tmp/build-build-opening-game-references-20261029-064642-82fa88e8/dr8-proof/results.md).
``````

### Round8 raw plan reports

#### lens-plan-r8.txt

``````text
RC-2 / DR1 (f-20261029-05) CLOSED at plan level — plan-r8.md:126 separates complete matching context from the visible label, resolves candidate headers before date/round fields, and excludes prose after the established round. This addresses the last-parenthesis selection and global metadata scans in src/utils/gameReferences.ts:44, :154 and :159, corroborated by parenthesis-prose-candidate.log:2–4. Plan-r8.md:128 requires lookup/admission regressions, contradictory-metadata rejection, header-embedded year/round coverage and production-fix removal proof. The stale consumer at src/components/common/Comment.test.tsx:118 is explicitly included. Confidence: 96.

No additional delta defects or blockers found. Implementation acceptance remains pending. Review used a separate session in the same OpenAI model family.

VERDICT: APPROVED
``````

#### lens-correctness-r8.txt

``````text
RC-2 CLOSED at plan level — r8 requires full matching context independent of label end, candidate event/site resolution before anchored date/round interpretation, and exclusion of prose after the established round. This covers the supplied `(A)`, `(1)` and later-year counterexamples while retaining contradictory metadata rejection. Observable lookup and admission proof remains mandatory. Confidence: 95.

No correctness defects found in the complete delta or dependent obligations. The Comment consumer update covers the removed lexical hints. The opener already requires a complete search and one verified occurrence before automatic admission.

No blocker found elsewhere in PLAN. Limitation: the unimplemented r8 correction and its runtime branches remain unverified, so this closes only the plan contract. Confidence: 100. Review uses a separate context in the same OpenAI model family.

VERDICT: APPROVED
``````

#### lens-minimalism-r8.txt

``````text
RC-2 CLOSED at plan level — r8 separates full bounded matching context from visible-label offsets, resolves candidate headers before anchored fields, and excludes following prose after the actual round. Lookup and admission regressions cover both supplied counterexamples and preserved contradictions. Implementation acceptance remains pending.

No bloat or duplication defects introduced by the complete delta. The shared field grammar has two concrete consumers, recognition and candidate verification. The smallest sufficient correction fits the four named existing files without another parser, framework or persistent representation.

No minimalism blocker found elsewhere in PLAN. Review used a separate context in the same OpenAI model family as the writer.

VERDICT: APPROVED
``````

#### lens-tests-r8.txt

``````text
RC-2 CLOSED at plan level — Round8 requires observable verified lookup and correct admission for both parenthesized-prose counterexamples and a following incidental year. It also requires rejection of contradictory metadata, candidate-header precedence, retained rendering regressions and production-only removal yielding substantive red before exact restoration and green. Reverting to the supplied candidate would fail the retained-candidate assertion. The stale Comment consumer assertion is explicitly included.

No additional verification defects found in the complete delta or dependent obligations. Implementation and executed proof remain pending. Review used a separate context in the same OpenAI model family.

VERDICT: APPROVED
``````

### Round8 canonical block

``````text
ROUND: 8
DELTA: /tmp/build-build-opening-game-references-20261029-064642-82fa88e8/plan-r8.delta
REVISED:
## Release precondition amendment and plan round 6 > ### Round8 citation-boundary mechanism correction
SETTLED:
# Plan: clickable ChessBase game citations
## Goal
## MANDATE
## Threat model and non-goals
## Traced premises
## Approach
## Approach > ### O1 — recognize citations without changing the preparation
## Approach > ### O2 — resolve local games honestly
## Approach > ### O3 — open the selected full game through the existing admission path
## Approach > ### O4 — verify the complete interaction
## Decisions and trade-offs
## Risks / open questions
## Not part of this task
## Phases
## Release precondition amendment and plan round 6
## Release precondition amendment and plan round 6 > ### Round7 proof-control correction
``````

### Round8 exact canonical delta

Base64 retains the exact UTF-8 bytes and unified-diff space-only context without trailing whitespace in this record. SHA256 bc59841c75bfc00a11da9c8b5081ba53ba79e246a73edf359dad8d9da719bd9f.

``````text
LS0tIC90bXAvYnVpbGQtYnVpbGQtb3BlbmluZy1nYW1lLXJlZmVyZW5jZXMtMjAyNjEwMjktMDY0NjQyLTgyZmE4OGU4L3BsYW4t
cjcubWQKKysrIC90bXAvYnVpbGQtYnVpbGQtb3BlbmluZy1nYW1lLXJlZmVyZW5jZXMtMjAyNjEwMjktMDY0NjQyLTgyZmE4OGU4
L3BsYW4tcjgubWQKQEAgLTExOSwzICsxMTksMTMgQEAKIAogQXV0aG9yaXR5IGlzIHRoZSBzYW1lIHJlcXVpcmVkLUNJIHJlbGVh
c2UgcHJlY29uZGl0aW9uIGFuZCBiZWhhdmlvcmFsIHRlc3QtcHJvb2Ygb2JsaWdhdGlvbi4gVGhlIGVhcmxpZXIgcmVxdWlyZW1l
bnQgdGhhdCByZW1vdmluZyBvbmUgY2xhc3Mgb2YgcmVkdW5kYW50IGd1YXJkcyBtdXN0IGNhdXNlIGEgYmFkIHdpcmUgb3V0Y29t
ZSB3YXMgYW4gdW5zdXBwb3J0ZWQgaW1wbGVtZW50YXRpb24gcHJlbWlzZS4gQWN0dWFsIHplcm8tcmVzdWx0IGNvbnRyb2xzIGFy
ZSBuZXcgZXZpZGVuY2UgZm9yIHJldmlzaW5nIHRoYXQgcmVjaXBlLiBUaGlzIGlzIGEgcHJvb2YtZGVzaWduIGNvcnJlY3Rpb24s
IG5vIHByb2R1Y3QgaW50ZW50IGNoYW5nZS4gRGVjaXNpb24gZC0yMDI2MTAyOS0xOSByZW1haW5zIGF1dGhvcml0YXRpdmUgZm9y
IHRoZSBwZXJtYW5lbnQgdGVzdCBtZWNoYW5pc20sIHdpdGggaXRzIG9sZCB0aGlyZC1jb250cm9sIHJlY2lwZSByZXF1aXJpbmcg
ZXhwbGljaXQgc2NvcGVkIGNvcnJlY3Rpb24gYWZ0ZXIgZnJlc2ggcmV2aWV3LiBSb3VuZDcgcGxhbiwgY29ycmVjdG5lc3MsIHRl
c3RzIGFuZCBlbmdpbmUtcHJvdG9jb2wganVkZ2UgUkMtMSBhbmQgdGhpcyBleGFjdCBhbHRlcm5hdGl2ZSBiZWZvcmUgaXQgcnVu
cy4gTm8gdmVyZGljdCBvciBhZG9wdGlvbiBpcyBhc3N1bWVkLiBSZXRhaW4gdGhlIG9sZCBjb250cm9scyBhcyBkaWFnbm9zdGlj
cyBhbmQgYWxsIHJhdyBoaXN0b3JpZXMuCiAKKyMjIyBSb3VuZDggY2l0YXRpb24tYm91bmRhcnkgbWVjaGFuaXNtIGNvcnJlY3Rp
b24KKworUm9vdC1rbm93biBSQy0yIGlzIGNvcnJlY3Rpb24tY3JlYXRlZCByZXdvcmsgdW5kZXIgc3RpbGwtb3BlbiBmLTIwMjYx
MDI5LTA1IGFuZCBEUjEsIG5vdCBhIG5ldyBsZW5zIGFkb3B0aW9uLiBUaGUgY29tcGxldGVkIGZpcnN0IHJlcGFpciBhdCBzb3Vy
Y2UgU0hBMjU2IGY5ZTg4NzYzZjUyYjBlNmMyMmUwODliYjFkMzU1MDI4MTk3NGZjMGQ5YzIxZDZjYjA0Yzc2MGJjNDNmYjNjM2Qg
cGFzc2VzIHRoZSBvcmlnaW5hbCBjb250cmFkaWN0b3J5LWV2ZW50IGNhc2UsIGJ1dCBhY3R1YWwgcHJvZHVjdGlvbi1tb2R1bGUg
cHJvYmluZyByZWplY3RzIHRoZSB2YWxpZCBUYXRhIFN0ZWVsIChBKSwgV2lqayBhYW4gWmVlLCAyMDIyLjEyLjAxLCBSb3VuZDMg
b2NjdXJyZW5jZSB3aGVuIG9yZGluYXJ5IGZvbGxvd2luZyBwcm9zZSBpcyBCZXR0ZXIgd2FzIEJkMyAoQSkuIG9yIEJldHRlciB3
YXMgQmQzICgxKS4gVGhlIHNhbWUgZ2FtZSB3aXRoIEJldHRlciB3YXMgQmQzLiBpcyByZXRhaW5lZC4gVGhlIGxhc3QtcGFyZW50
aGVzaXMgaGV1cmlzdGljIGxvc2VzIHRoZSByZWFsIGNsb3NpbmcgYm91bmRhcnkgYW5kIGludGVycHJldHMgcHJvc2UgcGFyZW50
aGVzZXMgYXMgY29uZmxpY3Rpbmcgcm91bmRzLiBFeGFjdCBzb3VyY2UgYnl0ZXMgcmVtYWluZWQgdW5jaGFuZ2VkIGR1cmluZyB0
aGUgcHJvYmUgYW5kIG1hdGNoIHRoZSBjb21wbGV0ZWQgd3JpdGVyLiBUaGUgZmlyc3Qgcm9vdCBkaWFnbm9zdGljIG9jY3VycmVk
IHdoaWxlIHRoZSB3b3JrZXIgdGVtcG9yYXJpbHkgcmV2ZXJzZWQgRFIxIGFuZCBpcyBleHBsaWNpdGx5IGV4Y2x1ZGVkIGZyb20g
Y2FuZGlkYXRlIGV2aWRlbmNlLgorCitPMS9PMiBjb3JyZWN0aW9uIGNvbnRyYWN0OiByZXRhaW4gdGhlIGZ1bGwgbGluZS1ib3Vu
ZGVkIHRhaWwgdGhyb3VnaCB0aGUgbmV4dCByZWNvZ25pemVkIHBsYXllciBwYWlyIGluZGVwZW5kZW50bHkgb2YgdGhlIHZpc2li
bGUgYWN0aW9uJ3MgZW5kLiBOZXZlciBkaXNjYXJkIHBvdGVudGlhbGx5IHN1cHBsaWVkIGV2ZW50L3NpdGUvZGF0ZS9yb3VuZCBj
b25zdHJhaW50cyBtZXJlbHkgYmVjYXVzZSBhIGxleGljYWwgcm91bmQtc2hhcGVkIGdyb3VwIGVuZHMgdGhlIGxhYmVsLiBSZXNv
bHZlIGFjdHVhbCBjYW5kaWRhdGUgZXZlbnQgYW5kIHNpdGUgcHJlZml4ZXMsIGluY2x1ZGluZyBwYXJlbnRoZXNlcyBhbmQgeWVh
cnMgaW5zaWRlIHRoZW0sIGJlZm9yZSBpbnRlcnByZXRpbmcgdGhlIHJlbWFpbmluZyBjaXRhdGlvbiBmaWVsZHMuIEludGVycHJl
dCBhbiBhbmNob3JlZCByZW1haW5pbmcgZGF0ZS9yb3VuZCBzZXF1ZW5jZSwgdGhlbiBzZXBhcmF0ZSBvcmRpbmFyeSBwcm9zZSBh
ZnRlciB0aGUgZXN0YWJsaXNoZWQgY2xvc2luZyByb3VuZC4gQSBsYXRlciBwYXJlbnRoZXNpemVkIHZhcmlhdGlvbiBtYXJrZXIg
b3IgaW5jaWRlbnRhbCBwcm9zZSB5ZWFyIGlzIG5vdCBhbm90aGVyIGdhbWUtZGF0ZSBvciByb3VuZCBjb25zdHJhaW50LiBNaXNz
aW5nIG9yIGFtYmlndW91cyBib3VuZGFyaWVzIHJldGFpbiBhbiB1bnZlcmlmaWVkIG9jY3VycmVuY2UgZm9yIGV4cGxpY2l0IHNl
bGVjdGlvbiwgd2hpbGUgaWRlbnRpZmlhYmxlIHN1cHBsaWVkIGRhdGUsIHJvdW5kLCBldmVudCBhbmQgc2l0ZSBjb250cmFkaWN0
aW9ucyByZW1haW4gaGFyZCByZWplY3Rpb25zLiBVbmtub3duIG9wZW4tdGFpbCBwcm9zZSBhbmQgZXhpc3RpbmcgZXZlbnQteWVh
ciBoYW5kbGluZyByZXRhaW4gdGhlaXIgcmV2aWV3ZWQgc2VtYW50aWNzLiBWaXNpYmxlIGxhYmVscyBzdGlsbCBleHRlbmQgdGhy
b3VnaCB0aGUgcmVhbCByb3VuZCBmb3IgYm90aCBzY3JlZW5zaG90IGV4YW1wbGVzIGFuZCB0aGUgdW5hbWJpZ3VvdXMgcGFyZW50
aGVzaXplZC1ldmVudCBjYXNlLCBleGNsdWRpbmcgb3JkaW5hcnkgZm9sbG93aW5nIHByb3NlIGFuZCBsYXRlciBjaXRhdGlvbnMu
IFdoZW4gbGV4aWNhbCBldmlkZW5jZSBjYW5ub3QgcmVzb2x2ZSB0aGUgdmlzaWJsZSBib3VuZGFyeSB3aXRob3V0IGNhbmRpZGF0
ZSBoZWFkZXJzLCB1c2UgYSBjb25zZXJ2YXRpdmUgcGxheWVyLXBhaXIgbGFiZWwgd2hpbGUgcmV0YWluaW5nIHRoZSBmdWxsIHRh
aWwgZm9yIG1hdGNoaW5nLiBLZWVwIG9uZSBzaGFyZWQgbGV4aWNhbCBkb21haW4gY29uY2VwdCB3aGVyZSByZWNvZ25pdGlvbiBh
bmQgdmVyaWZpY2F0aW9uIHVzZSB0aGUgc2FtZSBmaWVsZCBncmFtbWFyLCB3aXRoIG5vIHNlY29uZCBpbmRlcGVuZGVudCBtZXRh
ZGF0YSBwYXJzZXIsIGRlYWQgaGludCBmaWVsZHMsIG5ldyBmcmFtZXdvcmsgb3IgcGVyc2lzdGVudCBmb3JtYXQuCisKK0FjY2Vw
dGFuY2UgdXNlcyBib3RoIHJvb3QgY291bnRlcmV4YW1wbGVzIHRocm91Z2ggb2JzZXJ2YWJsZSBsb29rdXAgYW5kIGFkbWlzc2lv
biwgbm90IG9ubHkgaGVscGVyIG9mZnNldHMuIFRoZSB2YWxpZCBsb2NhbCBnYW1lIHJlbWFpbnMgdmVyaWZpZWQgYW5kIG9wZW5z
IGNvcnJlY3RseSBkZXNwaXRlIG9yZGluYXJ5IGZvbGxvd2luZyBwcm9zZSBjb250YWluaW5nIChBKSwgKDEpLCBhbmQgYSBkaWZm
ZXJlbnQgeWVhciBhZnRlciB0aGUgYWN0dWFsIGNsb3Npbmcgcm91bmQuIENvbnRyYWRpY3Rvcnkgc3VwcGxpZWQgZGF0ZS9yb3Vu
ZCBiZWZvcmUgdGhhdCBib3VuZGFyeSBzdGlsbCByZWplY3RzIGl0LiBJbmNsdWRlIGEgeWVhci1yb3VuZC1zaGFwZWQgc3Vic3Ry
aW5nIGluc2lkZSBhY3R1YWwgZXZlbnQvc2l0ZSBoZWFkZXJzIHRvIHByb3ZlIGNhbmRpZGF0ZS1wcmVmaXggcmVzb2x1dGlvbiBw
cmVjZWRlcyBmaWVsZCBpbnRlcnByZXRhdGlvbi4gUmV0YWluIHJpY2ggZm9ybWF0dGluZywgZXhhY3QgdmlzaWJsZSB0ZXh0LCBu
ZXh0LWNpdGF0aW9uIGJvdW5kYXJpZXMgYW5kIGV2ZXJ5IHByaW9yIGV2ZW50L3llYXIvb3Blbi10YWlsIHJlZ3Jlc3Npb24uIEtl
ZXAgdGhlIG5ldyB0ZXN0cyB3aGlsZSByZW1vdmluZyBvbmx5IHRoZSBwcm9kdWN0aW9uIGNvcnJlY3Rpb24gd2l0aCBHaXQsIHJl
cXVpcmUgc3Vic3RhbnRpdmUgcmVkLCBleGFjdCBuby1vZmZzZXQgcmVzdG9yYXRpb24gYW5kIGdyZWVuLiBBZGQgdGhlIG1pc3Np
bmcgQ29tbWVudC50ZXN0LnRzeCBjb25zdW1lciB1cGRhdGUgZm9yIHRoZSByZW1vdmVkIGxleGljYWwgaGludHMsIGFzc2VydGlu
ZyByZXRhaW5lZCBjb250ZXh0IGFuZCBhY3R1YWwgYWN0aXZhdGlvbiBpbnN0ZWFkIG9mIGRlYWQgZXZlbnQveWVhci9yb3VuZCBm
aWVsZHMuIFRoaXMgY29ycmVjdHMgRFI1J3Mgc3RhbGUgdGVzdCBhc3NlcnRpb24sIG5ldmVyIHJlc3RvcmVzIHVudXNlZCBmaWVs
ZHMuCisKK1Blcm1hbmVudCBjb3JyZWN0aW9uIHNjb3BlIGlzIHNyYy91dGlscy9nYW1lUmVmZXJlbmNlcy50cywgc3JjL3V0aWxz
L2dhbWVSZWZlcmVuY2VzLnRlc3QudHMsIHNyYy9jb21wb25lbnRzL2NvbW1vbi9Db21tZW50LnRlc3QudHN4IGFuZCBkb2NzL2dh
bWUtcmVmZXJlbmNlcy5tZCBvbmx5IGZvciBjb3JyZXNwb25kaW5nIG9wZXJhdGlvbiBzZW1hbnRpY3MuIFRoZSBvcmlnaW5hbCBz
dWNjZXNzZnVsIHdyaXRlciByZXN1bWVzIGF0IHRoZSBub3JtYWwgcm9sZSBhZnRlciBmb2N1c2VkIGZyZXNoIHBsYW4sIGNvcnJl
Y3RuZXNzLCBtaW5pbWFsaXNtIGFuZCB0ZXN0cyBqdWRnbWVudC4gRXhpc3RpbmcgbmF0aXZlIHRlc3QgcmVwYWlyLCBmaXh0dXJl
IGV4dHJhY3Rpb24sIGNsb3NlLWludGVudCBwcm9vZiwgY2FuY2VsbGF0aW9uLCBidWRnZXRzLCBsb2NhbC1vbmx5IHNvdXJjZXMg
YW5kIGZpbmFsIGdhdGVzIHJlbWFpbiB1bmNoYW5nZWQuIFJvb3QgcmVydW5zIGRlY2lzaXZlIGNvbnRyb2xzIGFuZCBjb21wbGV0
ZSByZWxhdGVkIHByb29mLCB0aGVuIGNvbXBsZXRlIHByZS1yZXZpZXcgYmVmb3JlIGNvbW1pdHRpbmcgcmVwYWlycyBhbmQgY3Vt
dWxhdGl2ZSBjbG9zdXJlIHJldmlldy4gUmVxdWlyZWQgZmluYWwgcmVhbC1icm93c2VyLCBmcmVzaCByZWxlYXNlLWJ1aWxkLCBv
cmRpbmFyeSBuYXRpdmUgYWNjZXB0YW5jZSwgY2xlYW4gcmV2aWV3ZWQgUnVzdC9mcm9udGVuZCBnYXRlcywgZXhhY3QtU0hBIGhv
c3RlZCBDSSBhbmQgaW5zdGFsbGF0aW9uIHN0aWxsIGFwcGx5LiBBdXRob3JpdHkgaXMgdGhlIGZpeGVkIE1BTkRBVEUgYW5kIGQt
MjAyNjEwMjktMTcncyBzYWZlIGNpdGF0aW9uIGJlaGF2aW9yLCBubyBuZXcgcHJvZHVjdCBjaG9pY2UuIFJldmVyc2FsIHJlbW92
ZXMgdGhpcyB0cmFuc2llbnQgY2xhc3NpZmllciB0b2dldGhlciB3aXRoIHRoZSBmZWF0dXJlLCBub3QgdXNlciBkYXRhLiBObyBy
OCBhcHByb3ZhbCBpcyBhc3N1bWVkLgorCg==
``````


## Completed citation repair root proof and committed closure candidate

The original matching writer resumed the reviewed r8 mechanism and completed at0. Its final four-file suite passed210 tests, types, formatting, lint and diff checks0. Full matching context now survives lexical label boundaries. Shared field grammar serves recognition and candidate-relative verification, actual event/site headers precede anchored fields, and ordinary prose after the actual closing round is excluded from metadata. Compact initials, safe source completeness and all ownership bounds remain. Comment.test.tsx now checks retained context and actual activation instead of deleted hints. The operation document reflects those semantics.

Worker source.first-candidate.ts retains the rejected f9e88763f52b0e6c22e089bb1d3550281974fc0d9c21d6cb04c760bc43fb3c3d bytes. Final source SHA256 is421b48f92e0060de05d43c271e41e3d3fa50834a0adf3291bb16d3776d82f58e. Nine regenerated worker controls, RC-2 and the eight earlier cases, each failed1 and restored passed0 without offsets or fuzz, preserving all four permitted file hashes. The single existing agent-gate scope was acquired before temporary source mutations. Original receipts were retained. This supplies executed correction proof, separately from plan8 approval.

Root inspected the complete production repair, both existing fixture call groups and the new lookup/admission/cap/close tests. Its actual-module parenthesis-prose-restored.log retains the correct round3 label and prints offered:true for (A), (1) and plain following prose at unchanged final source hash421b48f. The complete tail remains available for candidate matching. Earlier first-candidate rejection remains recorded as correction-created rework, it is superseded by this final proof.

Root independently replayed ten production-only controls, RC-2, all eight matching/budget controls and the isolated closing-intent guard. Every intended test failed1 for the expected substantive assertion, not an import or selector error. RC-2 restoration to the rejected first candidate caused five real candidate-retention failures and one full-context failure. First-parenthesis truncation caused unintended admission, identity reversal reproduced seven certainty/retention failures, source/player bound removals traversed the65th source or five versus three pages, classification removals falsely completed a truncated search, and close-guard removal caused unintended resolution/admission. All exact Git reverse/restore operations passed0 without offsets or fuzz. Six source/test/doc SHA256 values were equal before and after every control, each restored selector passed0. Raw root commands, logs, exits, diffs and hashes remain under root-citation-repair-proof.

Root then passed24 related test files/1244 tests, complete type checking, native verifier syntax, UI boundary, frontend mapping and the full contract at0. The whole composite gate-citation-repair-root-proof.DajIu9 canonically completed0, launchHEADbbd5e49421f61ef227f998b6343811d64d66e22a. Wrapper wall was 1193.463 seconds, including proof, admission/startup and contract/pre-review, not active review time. Complete pre-review artifacts/gates/20261029T134849845Z-3940317 passed build7.3s, format/lint/types2.6s, frontend mapping0.4s, backend mapping1.1s, GNU Windows clippy14.5s, bundle0.5s and selected frontend mutation1008.3s. All selected packages met the unchanged100 percent floor. No backend mutation ran.

The existing bundle reporter on that fresh restored build measured entry556147, largestLazy486203 and total1660459, with9541 bytes below total1670000. Entry565000 and largestLazy550000 ceilings are unchanged. The earlier recorded1660313 is the initial feature candidate before these review repairs, current whole-build growth over it is146 bytes. No dependency, lock, Vite configuration, numeric floor or extra budget allowance changed. Current measurement receipt is root-repaired-citation-bundle.json.

Root committed only owned source paths after that complete gate:73fb4fab matching/context/initials plus tests and operation document,8bcd1d84 isolated pending-close test,0ee458a4 shared native PGN fixture creator. Matching and close authors used Codex normal gpt-6.1-sol high, fixture author mechanical gpt-6-luna max. All three remain subject to cumulative code closure. DR1 throughDR9 have executed local repair evidence, explicit independent closure is the next step. Findings f-20261029-05 and06 remain open until that acceptance, DS2 remains open until ordinary native positive. Broader f-20261011-03 is unchanged and open.

The first repair203pass/1fail and close-writer temporary types2 are superseded by final210tests/types0 and root1244tests0, their raw receipts remain historical. No source writer or mutation remains active. Final normal browser/native acceptance, clean reviewed final Rust/frontend gates, push, exact-SHA required CI and installation have not yet occurred. Plan authorship and arbitration shared one context. Detection used the same OpenAI model family as code.

### Raw same-thread r8 implementation report

``````text
Implemented r8 in the four allowed files: citation matching now retains full context independently of labels, resolves candidate headers before fields, and excludes prose after the closing round. Updated regressions, the stale Comment expectation and operation docs.

All requested checks passed: **210 tests**, type checking, formatting, lint and diff checks.

RC-2 removal and all eight earlier controls produced red exit 1, followed by exact Git restoration and green exit 0. No offsets occurred, and all four file hashes matched after restoration.

[Exact commands, logs, exits and proof details](/tmp/build-build-opening-game-references-20261029-064642-82fa88e8/citation-rc2-proof/RESULTS.md).

Changes remain unstaged. Foreign work was preserved. No browser, native app or full pre-review was run.
``````


## Cumulative code round2 and complete-header counterexample

All six r2 read-only lenses completed under the canonical poller over7cd902f1ccfe7eec3c8e8990ed0f056c563c8af9..5d6dd8570819ae21ad75ce39b0b77e2c46f44401, with full published-base9b76350b..HEAD code context and records separated. Root read every raw report. REVIEWED_THROUGH=5d6dd8570819ae21ad75ce39b0b77e2c46f44401 identifies the reviewed candidate, not approval of its unresolved defect. Round2 wall was 148.845 seconds from packet preparation to last report. Active wall is unknown, parallel durations are not summed. No provider quota wait or executor fallback occurred.

Correctness explicitly CLOSED DR2 andDR3. Minimalism CLOSED DR4 andDR5. Tests CLOSED DR6,DR7 andDR8. Code-quality CLOSED DR9. Root-cause and records approved without a new finding. Eight unique adopted code issues are closed, original DR1 remains open. Diff adoptions r1=9 r2=0, the remaining DR1 counterexample is carried, not counted as an independent new adoption.

Correctness leaves DR1 NOT CLOSED at confidence99. For citation0-1 Beerdsen,T-Bluebaum,M Tata Steel (A) Wijk aan Zee2022(3), candidate eventTata Steel, siteWijk aan Zee, date2021.01.01 and roundA becomes verified. A shorter event prefix leaves (A) Wijk aan Zee2022(3), the first anchored parenthesis returns success and ignores the later supplied date and round. The r8 full-tail repair retains the evidence but does not yet resolve a complete header boundary.

Root arbitration adopts the NOT CLOSED result under the original Fix. The root-cause approval covered the supplied r8 cases and did not examine this new shorter-prefix premise. Root independently imported the actual module and called public lookupGameReference with schema-shaped API rows. partial-event-before.log records complete:true, one candidate and verification:verified at unchanged source SHA256421b48f92e0060de05d43c271e41e3d3fa50834a0adf3291bb16d3776d82f58e. The existing provider's complete/unique/verified condition permits automatic admission, so this is a release blocker. This probe is lookup and eligibility evidence, not a native database run. Root immediately annotated still-open f-20261029-05 through the writer, commit1314c7ce. No source correction or release occurred before focused mechanism review.

### Plan round9 complete-header confidence

All four fresh plan, correctness, minimalism and tests lenses explicitly CLOSED RC-3 at plan level and APPROVED0newfindings. Round9 wall was 115.661 seconds, active wall unknown. Plan used review-plan high and the three class lenses sensitive read medium, all gpt-6.1-sol. No executor/model fallback occurred. Plan adoptions r1=1 r2=0 r3=1 r4=0 r5=0 r6=1 r7=0 r8=0 r9=0. Three unique adopted plan issues remain closed, carried DR1 is not re-counted in plan adoption totals.

The operative plan-r9.md requires complete-header confidence before an early metadata success, across event-only, site-only and combined proper prefixes and parenthesized or year-round-shaped header extensions. Identifiable constraints remain, competing unresolved interpretations require existing unverified choice. The exact shorter-event case must not become verified or auto-open, while full-header controls and all r8 prose behavior remain. Shared grammar and bounded local lookup stay, no NLP framework or new product surface.

Root resumed the same matching thread01a187c2-f085-7033-9ef1-c844df7e18a8 at normal gpt-6.1-sol high in repair-r1-resume2, preserving every earlier report and proof. The fresh directory had no local pin, the unchanged registry resolved the same model/role. Scope is only the matching module, its test and corresponding operation prose. Other eight repaired findings and every native/release obligation remain. New proof must reverse this correction against the actual421b48f source while retaining new tests. A prior guard control made ineffective by a correct new mechanism receives diagnostic0 only, no weakened safety or invented negative credit. Source correction, root proof, complete pre-review and code closure remain pending at this checkpoint. Plan authorship and arbitration shared one context. Detection used the same OpenAI model family as code.

### Raw cumulative round2 reports

#### lens-correctness-diff-r2.txt

``````text
DR1 NOT CLOSED — full context is retained, but a shorter candidate event prefix can still establish the wrong closing round. The supplied RC-2 prose cases are corrected, as covered by `gameReferences.test.ts:493` and the restored probe log.

[blocker] src/utils/gameReferences.ts:168 — For citation `0-1 Beerdsen,T-Bluebaum,M Tata Steel (A) Wijk aan Zee 2022 (3)`, a candidate with matching players/result, event `Tata Steel`, site `Wijk aan Zee`, date `2021.01.01` and round `A` becomes **verified**. The event-only prefix leaves `(A) Wijk aan Zee 2022 (3)`, `(A)` matches the anchored field, and this return ignores the remaining supplied metadata. A complete unique lookup consequently auto-opens that contradictory occurrence. The unresolved boundary must prevent verified admission and preserve the supplied constraints. This is a remaining DR1 case, not a separate discovery. (confidence: 99)

DR2 CLOSED — `referencePlayerVerification` derives `j` from full `JOHN` in either name order, consistently rejecting supplied `JO`. The six casing/order regressions at `gameReferences.test.ts:606` cover discovery and final matching.

DR3 CLOSED — both name orders use the same normalized certainty path. Equal compact `JK` remains unverified, while spaced/dotted initials and full multiword names verify. The matrix at `gameReferences.test.ts:628` covers lookup and admission.

Limitation: source review only, with no tests executed under this assignment. Final application acceptance remains pending. Reviewer and repair authors share the OpenAI model family.

VERDICT: REVISE
``````

#### lens-root-cause-diff-r2.txt

``````text
No issues were originally adopted from this lens.

DR1 / supplied RC-2 CLOSED — `gameReferences.ts:54–76` retains full matching context independently of label boundaries. Candidate headers resolve before anchored fields at `:133–170`, and matching stops interpreting metadata after the established round. Regressions cover parenthesized prose, header-embedded years/rounds and contradictory metadata. Inspected reversal logs show unintended admission under first-parenthesis truncation and valid-candidate loss under the rejected repair. Restored tests pass. (confidence: 97)

DR2 / DR3 CLOSED — `referencePlayerVerification` supplies one case-insensitive certainty path for discovery and final verification. It rejects JO/JOHN and retains ambiguous compact JK tokens for explicit choice in both name orders. Inspected identity reversal reproduced seven failures, followed by 26 passing restored cases. (confidence: 97)

No new symptom-patching or prior-fix reintroduction found. History and sibling searches show both consumers use the shared matching mechanism. The fixture extraction preserves invocation arguments and returned promises.

Read-only review completed without writes or test execution. Final screenshots, ordinary native acceptance, final gates, hosted CI and installation remain pending. This review shares the code author’s OpenAI model family.

VERDICT: APPROVED
``````

#### lens-minimalism-diff-r2.txt

``````text
DR4 CLOSED — `scripts/verify-app.mjs:747` provides one concrete fixture creator used by all nine linked and three citation fixtures. Commands, payloads and assertions are preserved. (confidence: 99)

DR5 CLOSED — `src/utils/gameReferences.ts` removes unused event/year/round hints and their parser. Recognition and Comment tests now assert full context and activation. (confidence: 99)

No new bloat or duplication defects found. The repair adds no files. New grammar and identity helpers have multiple callers, and the UI harness supports distinct regression cases.

Read-only review, no tests run. Inspected the canonical receipt and pre-review log. Final acceptance remains pending. Author and reviewer share the OpenAI model family.

VERDICT: APPROVED
``````

#### lens-tests-diff-r2.txt

``````text
DR6 CLOSED — `gameReferences.test.ts:1066` retains a valid candidate, asserts incomplete status and budget guidance, and rejects automatic admission. Removing the empty-page classification fails the completeness assertion.

DR7 CLOSED — `gameReferences.test.ts:1101` and `:1131` exercise source and player limits, bounded traversal, retained candidates and incomplete UI guidance. Recorded bound-removal and classification controls fail.

DR8 CLOSED — `GameReference.test.tsx:532` settles lookup with close intent set, owner/cache intact and signal unaborted. Removing only the closing-intent guard causes unintended admission and fails the test.

The central metadata and identity repairs have assertions that fail on reversal, including RC-2 candidate retention and contradictory-game rejection. Tests are reachable through Vitest configuration and CI coverage.

No new findings. Final screenshots, release build and ordinary native verification remain pending. This read-only review ran no tests. Author and reviewer share the OpenAI model family.

VERDICT: APPROVED
``````

#### lens-code-quality-diff-r2.txt

``````text
DR9 CLOSED — `src/utils/gameReferences.ts:321–354` consistently uses `matchedPlayers` for complete `Player` records. Tests at `src/utils/gameReferences.test.ts:769` and `:1131` cover ID consumption and bounded retention (confidence: 99).

No new readability or local-consistency defects found.

Read-only review. No tests run or files changed. Final application acceptance remains pending. Reviewer and implementation share the OpenAI model family.

VERDICT: APPROVED
``````

#### lens-records-diff-r2.txt

``````text
No records findings. No prior records-lens issues required DR closure.

Raw reports, canonical delta encoding, repair lineage, source claims and proof receipts agree. Historical failures are explicitly superseded. Final browser/native acceptance, final gates, hosted CI and installation remain pending.

The original 332-citation corpus count was not independently verifiable.

Read-only review, no files changed or tests run. Reviewer and authors share the OpenAI model family.

VERDICT: APPROVED
``````

### Raw plan round9 reports

#### lens-plan-r9.txt

``````text
RC-3 / DR1 CLOSED at plan level — plan-r9.md:136 requires complete-header resolution and examination of competing boundaries before verified admission, addressing the first-prefix selection at src/utils/gameReferences.ts:140 and early return at :168. Plan-r9.md:138 covers all three prefix kinds, parenthesized and year-round extensions, preserved prose behavior, lookup/admission eligibility and production-only removal proof. The existing provider enforces verification at src/components/common/GameReference.tsx:95. Confidence: 96.

No additional defects found in the complete delta or affected dependencies. No blocker found elsewhere in PLAN.

Limitation: this closes the plan contract only. The correction and runtime proof remain unverified. No files changed or tests run. Review used a separate context in the same OpenAI model family as the writer. Confidence: 100.

VERDICT: APPROVED
``````

#### lens-correctness-r9.txt

``````text
RC-3 / DR1 CLOSED at plan level — `plan-r9.md:136` requires a resolved complete header boundary before verified admission, covering event-only, site-only and combined prefixes with parenthesized or year-round extensions. Line 138 explicitly prevents automatic opening for the supplied shorter-event counterexample and preserves rejection of established later contradictions. (confidence: 96)

No correctness defects found in the complete delta or affected obligations. Exact full-header matches, genuine round-only citations and r8 ordinary prose remain supported. Competing interpretations require unverified explicit choice, consistent with the existing opener’s verified-only admission predicate.

Limitation: the concrete classifier remains unimplemented and unverified. This closes RC-3’s plan contract only, not DR1’s code acceptance. No tests or probes were executed. Review and authorship share the OpenAI model family.

VERDICT: APPROVED
``````

#### lens-minimalism-r9.txt

``````text
RC-3 / DR1 CLOSED at plan level — plan-r9.md:137–141 requires complete-header confidence before verified admission, covers all three prefix kinds and both extension forms, and preserves ordinary prose after a real round. Ambiguity uses the existing unverified choice. Lookup and admission regression proof remains mandatory. (confidence: 96)

No bloat or duplication defects found in the complete delta or affected dependencies. The smallest sufficient correction fits the three named existing files, reusing the shared field grammar and existing verification states. No added file, parser framework, configuration or admission layer is required. The regression cases address the observed failure mechanism without expanding the mandate.

No minimalism blocker found elsewhere in PLAN. Implementation and proof remain pending. Read-only review, no tests run or files changed. Reviewer and writer share the OpenAI model family.

VERDICT: APPROVED
``````

#### lens-tests-r9.txt

``````text
RC-3 / DR1 CLOSED at plan level for this lens — plan-r9.md requires observable lookup and admission assertions covering event-only, site-only and combined prefixes, with both parenthesized and year-round extensions. Reverting the correction would restore the supplied verified candidate and automatic opening, violating those assertions. Matching full-header controls and retained r8 prose cases guard against blanket rejection. Production-only removal, substantive red, exact restoration and green are explicitly required. (confidence: 97)

No verification defects found in the complete delta or its affected dependencies. The related-test command includes the changed module, and `vite.config.ts:74` includes its test file in the full suite. Browser, native application and final Rust/frontend release proof remain required.

Limitation: this closes the proposed proof contract only. The r9 assertions and removal controls remain unimplemented and unexecuted. Existing green r8 tests do not prove RC-3 fixed. Reviewer and authors share the OpenAI model family.

VERDICT: APPROVED
``````

### Round9 canonical block

``````text
ROUND: 9
DELTA: /tmp/build-build-opening-game-references-20261029-064642-82fa88e8/plan-r9.delta
REVISED:
## Release precondition amendment and plan round 6 > ### Round9 complete-header confidence correction
SETTLED:
# Plan: clickable ChessBase game citations
## Goal
## MANDATE
## Threat model and non-goals
## Traced premises
## Approach
## Approach > ### O1 — recognize citations without changing the preparation
## Approach > ### O2 — resolve local games honestly
## Approach > ### O3 — open the selected full game through the existing admission path
## Approach > ### O4 — verify the complete interaction
## Decisions and trade-offs
## Risks / open questions
## Not part of this task
## Phases
## Release precondition amendment and plan round 6
## Release precondition amendment and plan round 6 > ### Round7 proof-control correction
## Release precondition amendment and plan round 6 > ### Round8 citation-boundary mechanism correction
``````

### Round9 exact canonical delta

Base64 retains exact UTF-8 unified-diff bytes without trailing whitespace. SHA256 d389ac7b8e9da68185be2e64c904e2e248dbd5a0fbad1b4c055f49b568f8f8c4.

``````text
LS0tIC90bXAvYnVpbGQtYnVpbGQtb3BlbmluZy1nYW1lLXJlZmVyZW5jZXMtMjAyNjEwMjktMDY0NjQyLTgyZmE4OGU4L3BsYW4t
cjgubWQKKysrIC90bXAvYnVpbGQtYnVpbGQtb3BlbmluZy1nYW1lLXJlZmVyZW5jZXMtMjAyNjEwMjktMDY0NjQyLTgyZmE4OGU4
L3BsYW4tcjkubWQKQEAgLTEyOSwzICsxMjksMTMgQEAKIAogUGVybWFuZW50IGNvcnJlY3Rpb24gc2NvcGUgaXMgc3JjL3V0aWxz
L2dhbWVSZWZlcmVuY2VzLnRzLCBzcmMvdXRpbHMvZ2FtZVJlZmVyZW5jZXMudGVzdC50cywgc3JjL2NvbXBvbmVudHMvY29tbW9u
L0NvbW1lbnQudGVzdC50c3ggYW5kIGRvY3MvZ2FtZS1yZWZlcmVuY2VzLm1kIG9ubHkgZm9yIGNvcnJlc3BvbmRpbmcgb3BlcmF0
aW9uIHNlbWFudGljcy4gVGhlIG9yaWdpbmFsIHN1Y2Nlc3NmdWwgd3JpdGVyIHJlc3VtZXMgYXQgdGhlIG5vcm1hbCByb2xlIGFm
dGVyIGZvY3VzZWQgZnJlc2ggcGxhbiwgY29ycmVjdG5lc3MsIG1pbmltYWxpc20gYW5kIHRlc3RzIGp1ZGdtZW50LiBFeGlzdGlu
ZyBuYXRpdmUgdGVzdCByZXBhaXIsIGZpeHR1cmUgZXh0cmFjdGlvbiwgY2xvc2UtaW50ZW50IHByb29mLCBjYW5jZWxsYXRpb24s
IGJ1ZGdldHMsIGxvY2FsLW9ubHkgc291cmNlcyBhbmQgZmluYWwgZ2F0ZXMgcmVtYWluIHVuY2hhbmdlZC4gUm9vdCByZXJ1bnMg
ZGVjaXNpdmUgY29udHJvbHMgYW5kIGNvbXBsZXRlIHJlbGF0ZWQgcHJvb2YsIHRoZW4gY29tcGxldGUgcHJlLXJldmlldyBiZWZv
cmUgY29tbWl0dGluZyByZXBhaXJzIGFuZCBjdW11bGF0aXZlIGNsb3N1cmUgcmV2aWV3LiBSZXF1aXJlZCBmaW5hbCByZWFsLWJy
b3dzZXIsIGZyZXNoIHJlbGVhc2UtYnVpbGQsIG9yZGluYXJ5IG5hdGl2ZSBhY2NlcHRhbmNlLCBjbGVhbiByZXZpZXdlZCBSdXN0
L2Zyb250ZW5kIGdhdGVzLCBleGFjdC1TSEEgaG9zdGVkIENJIGFuZCBpbnN0YWxsYXRpb24gc3RpbGwgYXBwbHkuIEF1dGhvcml0
eSBpcyB0aGUgZml4ZWQgTUFOREFURSBhbmQgZC0yMDI2MTAyOS0xNydzIHNhZmUgY2l0YXRpb24gYmVoYXZpb3IsIG5vIG5ldyBw
cm9kdWN0IGNob2ljZS4gUmV2ZXJzYWwgcmVtb3ZlcyB0aGlzIHRyYW5zaWVudCBjbGFzc2lmaWVyIHRvZ2V0aGVyIHdpdGggdGhl
IGZlYXR1cmUsIG5vdCB1c2VyIGRhdGEuIE5vIHI4IGFwcHJvdmFsIGlzIGFzc3VtZWQuCiAKKyMjIyBSb3VuZDkgY29tcGxldGUt
aGVhZGVyIGNvbmZpZGVuY2UgY29ycmVjdGlvbgorCitDdW11bGF0aXZlIGNvZGUgY2xvc3VyZSByMiBsZWF2ZXMgdGhlIG9yaWdp
bmFsIERSMSBOT1QgQ0xPU0VELCB3aXRoIGEgbmV3IGNvbmZpZGVuY2U5OSBjb3VudGVyZXhhbXBsZSBpbiB0aGUgc2FtZSBib3Vu
ZGFyeSBtZWNoYW5pc20uIE90aGVyIGVpZ2h0IGZpbmRpbmdzIGNsb3NlZC4gQXQgZmluYWwgcjggc291cmNlIFNIQTI1NjQyMWI0
OGY5MmUwMDYwZGUwNWQ0M2MyNzFlNDFlM2QzZmE1MDgzNGEwYWRmMzI5MWJiMTZkMzc3NmQ4MmY1OGUsIHRoZSBhY3R1YWwtbW9k
dWxlIGxvb2t1cCBwcm9iZSBwYXJ0aWFsLWV2ZW50LWJlZm9yZS5sb2cgcmV0dXJucyBjb21wbGV0ZTp0cnVlIGFuZCBvbmUgdmVy
aWZpZWQgb2NjdXJyZW5jZSBmb3IgY2l0YXRpb24gMC0xIEJlZXJkc2VuLFQtQmx1ZWJhdW0sTSBUYXRhIFN0ZWVsIChBKSBXaWpr
IGFhbiBaZWUgMjAyMiAoMyksIHdoZW4gdGhlIGNhbmRpZGF0ZSBoYXMgc2hvcnRlciBldmVudCBUYXRhIFN0ZWVsLCBleGFjdCBz
aXRlIFdpamsgYWFuIFplZSwgZGF0ZTIwMjEuMDEuMDEgYW5kIHJvdW5kQS4gVGhlIGV2ZW50LW9ubHkgcHJlZml4IGxlYXZlcyAo
QSkgV2lqayBhYW4gWmVlIDIwMjIgKDMpLiBUcmVhdGluZyB0aGUgZmlyc3QgYW5jaG9yZWQgKEEpIGFzIGFuIGVzdGFibGlzaGVk
IHJvdW5kIHBlcm1pdHMgYW4gZWFybHkgc3VjY2VzcyB0aGF0IGRpc2NhcmRzIGxhdGVyIGNvbnN0cmFpbnRzLiBSb290IGluZGVw
ZW5kZW50bHkgcmVwcm9kdWNlZCB0aGlzIHdpdGggdGhlIHB1YmxpYyBsb29rdXAgZnVuY3Rpb24gYW5kIHNjaGVtYS1zaGFwZWQg
bG9jYWwgQVBJIHJvd3MsIHdpdGhvdXQgcmVjb25zdHJ1Y3RpbmcgbWF0Y2hlciBsb2dpYy4gRXhhY3Qgc291cmNlIGJ5dGVzIHN0
YXllZCB1bmNoYW5nZWQuIFRoZSByb290LWNhdXNlIHIyIGFwcHJvdmFsIGNvdmVyZWQgdGhlIHN1cHBsaWVkIGNhc2VzIGFuZCBk
aWQgbm90IHJlZnV0ZSB0aGlzIHNob3J0ZXItcHJlZml4IGNvdW50ZXJleGFtcGxlLiBJdCBpcyByZW1haW5pbmcgRFIxLCBubyBu
ZXcgaW5kZXBlbmRlbnQgZmluZGluZyBvciBsZW5zIGFkb3B0aW9uLiBTYW1lIG1lY2hhbmlzbSBmYWlsZWQgYSBwcmlvciBjb3Jy
ZWN0aW9uLCBzbyBmdXJ0aGVyIHBhdGNoaW5nIHN0b3BzIGZvciBmcmVzaCBmb2N1c2VkIG1lY2hhbmlzbSBqdWRnbWVudC4KKwor
TzIgY29uZmlkZW5jZSBpbnZhcmlhbnQ6IGEgbWF0Y2hpbmcgY2FuZGlkYXRlIGhlYWRlciBwcmVmaXggYWxvbmUgZG9lcyBub3Qg
cHJvdmUgdGhhdCB0aGUgbmV4dCBmaWVsZC1zaGFwZWQgdG9rZW4gc3RhcnRzIGdhbWUgbWV0YWRhdGEuIFRoZSBjYW5kaWRhdGUg
bXVzdCBhY2NvdW50IGZvciB0aGUgY29tcGxldGUgcHJvdmlkZWQgaGVhZGVyIGJvdW5kYXJ5IGJlZm9yZSBhIHJvdW5kIGNhbiBl
c3RhYmxpc2ggdGhlIGVuZCBvZiBtZXRhZGF0YS4gQSBwcm9wZXIgcHJlZml4IG9mIGFuIGV2ZW50LCBzaXRlIG9yIHRoZWlyIGNv
bWJpbmF0aW9uIG11c3Qgbm90IGNvbnN1bWUgYSBwYXJlbnRoZXNpemVkIG9yIHllYXItcm91bmQtc2hhcGVkIGhlYWRlciBleHRl
bnNpb24gYXMgdGhlIGdhbWUncyBvd24gcm91bmQgYW5kIHRoZW4gc2lsZW50bHkgZGlzY2FyZCBsYXRlciBmaWVsZHMuIFJldGFp
biB0aGUgZnVsbCB0YWlsIGFuZCBzaGFyZWQgZmllbGQgZ3JhbW1hciBmcm9tIHI4LiBFeGFtaW5lIGNvbXBldGluZyBzdXBwb3J0
ZWQgYm91bmRhcmllcyBiZWZvcmUgcmV0dXJuaW5nIHZlcmlmaWVkLiBTdXBwbGllZCBtZXRhZGF0YSB0aGF0IGlzIGlkZW50aWZp
YWJsZSBpbmRlcGVuZGVudGx5IG9mIGEgZ3Vlc3NlZCBlYXJseSBjbG9zZSByZXRhaW5zIGl0cyBjb25zdHJhaW50cy4gSWYgY29t
cGV0aW5nIGhlYWRlci9maWVsZC9wcm9zZSBpbnRlcnByZXRhdGlvbnMgY2Fubm90IGJlIHJlc29sdmVkIGNvbnNlcnZhdGl2ZWx5
LCByZXRhaW4gdW52ZXJpZmllZCBleHBsaWNpdCBjaG9pY2UsIG5ldmVyIGZpcnN0LXByZWZpeCB2ZXJpZmllZCBhZG1pc3Npb24u
IERvIG5vdCB1c2UgdGhlIHZpc2libGUgbGFiZWwgYXMgdGhlIHNvbGUgbWV0YWRhdGEgY3V0b2ZmLCBhZGQgZ2VuZXJhbCBOTFAs
IGEgcGFyc2VyIGZyYW1ld29yaywgYSBuZXcgc291cmNlLCBwZXJzaXN0ZW5jZSwgc2V0dGluZ3MsIHJlZ2lzdHJ5IG9yIHVuYm91
bmRlZCBpbnRlcnByZXRhdGlvbiBzZWFyY2guIFRoaXMgaXMgdGhlIGV4aXN0aW5nIGV4cGxpY2l0LWNob2ljZSBjb25maWRlbmNl
IGNvbnRyYWN0LCBub3QgYSBuZXcgcHJvZHVjdCBzdXJmYWNlLgorCitBY2NlcHRhbmNlIGNvdmVycyB0aGUgZXhhY3Qgc2hvcnRl
ci1ldmVudCBjb3VudGVyZXhhbXBsZSB0aHJvdWdoIG9ic2VydmFibGUgbG9va3VwIGFuZCBhdXRvbWF0aWMtYWRtaXNzaW9uIGVs
aWdpYmlsaXR5LCByZXF1aXJpbmcgbm8gdmVyaWZpZWQgY2FuZGlkYXRlIG9yIGF1dG9tYXRpYyBvcGVuaW5nLiBXaGVyZSB0aGUg
bGF0ZXIgc3VwcGxpZWQgZGF0ZS9yb3VuZCBib3VuZGFyeSBpcyBlc3RhYmxpc2hlZCwgaXRzIGNvbnRyYWRpY3Rpb25zIHN0aWxs
IHJlamVjdC4gR2VuZXJhbGl6ZSB0aGUgcmVncmVzc2lvbiB0byBwcm9wZXIgcHJlZml4ZXMgb2YgZXZlbnQtb25seSwgc2l0ZS1v
bmx5IGFuZCBjb21iaW5lZCBoZWFkZXJzLCBhbmQgdG8gYW4gZWFybHkgcGFyZW50aGVzaXplZCBvciBjb21wbGV0ZSB5ZWFyLXJv
dW5kLXNoYXBlZCBoZWFkZXIgZXh0ZW5zaW9uLiBFeGFjdCBmdWxsIGV2ZW50L3NpdGUgY291bnRlcnBhcnRzIHdpdGggdGhlIHRy
dWUgc3VwcGxpZWQgZGF0ZSBhbmQgcm91bmQgcmVtYWluIHZlcmlmaWVkIGFuZCBvcGVuIGNvcnJlY3RseS4gUHJlc2VydmUgdGhl
IHZhbGlkIHI4IHBhcmVudGhlc2l6ZWQtcHJvc2UgY2FzZXMsIGhlYWRlci1lbWJlZGRlZCB5ZWFycy9yb3VuZHMsIGEgZ2VudWlu
ZSByb3VuZC1vbmx5IGNpdGF0aW9uIGZvbGxvd2VkIGJ5IG9yZGluYXJ5IHByb3NlLCBtaXNzaW5nIG9wdGlvbmFsIHNpdGUgbWV0
YWRhdGEsIHVua25vd24gb3Blbi10YWlsIHByb3NlLCBhbGwgZXhpc3RpbmcgaGFyZCBjb25zdHJhaW50cywgYm91bmRzIGFuZCBv
d25lcnNoaXAuIEFtYmlndWl0eSBtYXkgcmVxdWlyZSBleHBsaWNpdCBjaG9pY2UsIGl0IG11c3Qgbm90IGJlIHJlbGFiZWxlZCBh
cyB2ZXJpZmllZCBtZXJlbHkgYmVjYXVzZSBvbmUgcmVhZGluZyBtYXRjaGVzLiBQcmVzZXJ2ZSB0aGUgbmV3IHRlc3RzIHdoaWxl
IHJlbW92aW5nIG9ubHkgdGhlIHByb2R1Y3Rpb24gY29uZmlkZW5jZSBjb3JyZWN0aW9uIHdpdGggR2l0LCByZXF1aXJlIHN1YnN0
YW50aXZlIHJlZCwgZXhhY3Qgbm8tb2Zmc2V0IHJlc3RvcmF0aW9uIGFuZCBncmVlbi4gUmVydW4gdGhlIHByaW9yIGNvbnRyb2xz
IGFuZCBmdWxsIHJlbGF0ZWQvcHJlLXJldmlldyBwcm9vZiBiZWZvcmUgY29kZSBjbG9zdXJlLgorCitTY29wZSBpcyBzcmMvdXRp
bHMvZ2FtZVJlZmVyZW5jZXMudHMsIHNyYy91dGlscy9nYW1lUmVmZXJlbmNlcy50ZXN0LnRzIGFuZCBkb2NzL2dhbWUtcmVmZXJl
bmNlcy5tZCBmb3IgY29ycmVzcG9uZGluZyBjb25maWRlbmNlIHNlbWFudGljcyBvbmx5LiBUaGUgb3JpZ2luYWwgbWF0Y2hpbmcg
dGhyZWFkIHJlc3VtZXMgYXQgbm9ybWFsIGhpZ2ggYWZ0ZXIgZnJlc2ggcGxhbiwgY29ycmVjdG5lc3MsIG1pbmltYWxpc20gYW5k
IHRlc3RzIGp1ZGdtZW50LiBUaGUgQ29tbWVudCBjb25zdW1lciB1cGRhdGUsIGZpeHR1cmUgZXh0cmFjdGlvbiwgY2xvc2UgcHJv
b2YsIG5hdGl2ZSB0ZXN0IHJlcGFpciBhbmQgZXZlcnkgcHJldmlvdXNseSByZXZpZXdlZCByZWxlYXNlIHJlcXVpcmVtZW50IHJl
bWFpbiB1bmNoYW5nZWQuIFJvb3QgY29tbWl0cyB0aGUgcHJvdmVkIGNvcnJlY3Rpb24sIHRoZW4gY29ycmVjdG5lc3MsIHJvb3Qt
Y2F1c2UsIHRlc3RzIGFuZCBhbnkgb3RoZXIgYWZmZWN0ZWQgbGVucyBjbG9zZSB0aGUgY29tbWl0dGVkIGRlbHRhIHdpdGggZnVs
bCBjb250ZXh0LiBBdXRob3JpdHkgaXMgZml4ZWQgTUFOREFURSBhbmQgZC0yMDI2MTAyOS0xNydzIHZlcmlmaWVkLW9ubHkgb3Bl
bmluZyBydWxlLiBObyBhZGRpdGlvbmFsIGJ1ZGdldCBvciBmbG9vciBjaGFuZ2UuIE5vIHI5IHZlcmRpY3QsIGFkb3B0aW9uIG9y
IGltcGxlbWVudGF0aW9uIGFjY2VwdGFuY2UgaXMgYXNzdW1lZC4gUGxhbiBhdXRob3JzaGlwIGFuZCBhcmJpdHJhdGlvbiBzaGFy
ZWQgb25lIGNvbnRleHQuIERldGVjdGlvbiB1c2VkIHRoZSBzYW1lIE9wZW5BSSBtb2RlbCBmYW1pbHkgYXMgY29kZS4KKwo=
``````


## First r9 candidate and same-revision year-led evidence check

The matching writer's second continuation completed at normal gpt-6.1-sol high. First r9 source7d5f888a85f72d58adb3477360dadb61bf96250f82fe446cca524b84ff9afeb6 passes222 tests across the four requested files, types, formatting, lint and diff checks0. Ten source controls each observed red1, exact restoration and green0. The new correction-only reversal restored actual421b48f source and produced nine substantive failures, including unwanted automatic admission. Eight original controls remained discriminating. The old RC-2 whole-source reversal would also remove the dependent new confidence correction, so the writer used an explicitly adapted global-round consumption fault that retained the new guard and caused five real candidate losses. It is not presented as a literal replay of the old whole-source patch. Original receipts remain historical and unmodified. No diagnostic0 or independent isolation credit is invented.

Root read the complete report and inspected the36-line confidence change. It then found YP-1, correction-created rework under still-open RC-3/DR1. Actual-module year-led-prose-before.log at unchanged7d5f888a source returns offered:false for the exact valid Tata Steel (A), Wijk aan Zee, Date2022.12.01, Round3 game when the complete2022(3) citation is followed by2024: Better was Bd3. or2024 improvements included Bd3. The same game remains offered when the prose is Better was Bd3 in2024. The immediate lexical continuation unconditionally replaces identifiable2022 fields with the bare prose2024 before comparing Date. Root annotated f-20261029-05 through the writer, commit504838e9, before further correction. The222-test candidate is not accepted, no full pre-review or code closure is claimed for it.

The existing r9 confidence invariant already says that unresolved header/field/prose interpretations require unverified retention, with identifiable original and header-established later constraints preserved. Root therefore requested a fresh same-revision mechanism evidence check against unchanged plan-r9.md, reusing the originating canonical r9 block/delta and naming the new probe/source. No artificial revision or tenth round was created. Plan, correctness and tests all APPROVED, explicitly YP-1 addressed by unchanged contract, no contract correction necessary. No new independent finding or adoption. Evidence-check wall was 126.839 seconds, active wall unknown, parallel durations not summed. Plan used review-plan high and class lenses sensitive read medium, all gpt-6.1-sol with separate contexts. No executor/model fallback occurred.

The reports require lexical continuation to be distinguished from actual header evidence. A bare following prose year cannot replace supplied2022 merely because grammar matches. The known-site boundary in the shorter-event case must still preserve its later date/round constraints. New lookup/provider regressions must retain the otherwise correct candidate, prohibit automatic admission while unresolved, and open the exact selected source. Production-only reversal must restore the actual7d5f888a failure, then exact no-offset restoration and green. This is implementation rework under the original Fix, not a new product surface or parser framework.

Root resumed the same matching thread01a187c2-f085-7033-9ef1-c844df7e18a8 at normal high in repair-r1-resume3. The unchanged registry resolved gpt-6.1-sol high in the fresh report directory, no escalation or fallback. Scope remains matching module/test and corresponding operation prose, all other work is preserved. Root proof, complete pre-review and committed code closure remain required. Nine completed plan rounds and adoptions r1=1 r2=0 r3=1 r4=0 r5=0 r6=1 r7=0 r8=0 r9=0 remain unchanged. Diff r1=9 r2=0, eight unique issues closed and original DR1 still open. Plan authorship and arbitration shared one context. Detection used the same OpenAI model family as code.

### Raw first r9 implementation report

``````text
Implemented RC-3 in `gameReferences.ts`, its tests and the confidence documentation. Shorter header prefixes now preserve later constraints or require explicit choice.

All requested checks passed, including **222 tests**.

Reversing only RC-3 restored exact `421b48f…` and produced nine failures, including automatic admission in root’s counterexample. Exact restoration passed with no offsets. The eight original controls remained red-to-green. RC-2 used an independent global-round scan fault while retaining RC-3.

[Exact commands, logs, exits, full hashes and control dispositions](/tmp/build-build-opening-game-references-20261029-064642-82fa88e8/citation-rc3-proof/RESULTS.md).

Changes remain unstaged. Foreign work was preserved. No browser, native or full pre-review acceptance was run.
``````

### Raw unchanged-r9 evidence reports

#### lens-plan-r9-year-evidence.txt

``````text
YP-1 ADDRESSED by the unchanged r9 contract. `plan-r9.md:126` excludes incidental prose years after an established round. `plan-r9.md:136` requires unverified retention when header, field and prose readings remain unresolved. Neither permits replacing supplied 2022 with an ambiguous trailing 2024. No contract correction is necessary (confidence: 99).

The supplied failure matches `src/utils/gameReferences.ts:168`, where any anchored continuation replaces the original fields before date comparison at `:187`. This is implementation rework under RC-3 / DR1, not a new independent adoption or code closure.

The proposed mechanism preserves the contract provided it retains identifiable original date/round constraints and later constraints established by header evidence. Existing shorter-prefix negatives and complete-header positives at `src/utils/gameReferences.test.ts:605` distinguish these obligations. The provider already requires a verified occurrence for automatic admission at `src/components/common/GameReference.tsx:95`, so unverified retention needs no consumer contract change. The existing lookup/provider harness at `src/utils/gameReferences.test.ts:131` supports the proposed behavioral proof (confidence: 97).

No new plan defects, contradictory acceptance obligations, missing dependencies or complete-plan blockers identified in this focused check.

Named limitation: I inspected source and supplied probe evidence without executing tests, probes or native lookup. Implementation acceptance and RC-3 / DR1 code closure remain pending (confidence: 100). Reviewer and writer share the OpenAI model family.

VERDICT: APPROVED
``````

#### lens-correctness-r9-year-evidence.txt

``````text
YP-1 ADDRESSED by the unchanged r9 contract (confidence: 98). R8 excludes incidental prose years after an established closing round. R9 requires unresolved competing interpretations to retain an unverified occurrence for explicit choice. Neither permits replacing supplied 2022 with prose-led 2024 solely because the shared grammar matches it. No contract correction is necessary.

The proposed mechanism preserves metadata constraints if it distinguishes lexical continuation from established header evidence. For the shorter-event counterexample, `(A) Wijk aan Zee 2022 (3)` must still expose the later date and round constraints through the known site boundary. Conversely, `2024: Better was Bd3.` and `2024 improvements included Bd3.` alone cannot establish another definite game date. An unconditional continuation override or unconditional disregard of all later fields would violate r9.

No new correctness defect, contradictory acceptance obligation or missing dependency identified in the proposed correction or complete plan.

Limitation (confidence: 100): this is plan-level judgment only. The patch, lookup/provider regressions and correction-removal proof remain unverified. DR1 remains open at code level. Review used a separate Codex context in the same OpenAI family as the writer, without family separation. No files changed or tests run.

VERDICT: APPROVED
``````

#### lens-tests-r9-year-evidence.txt

``````text
YP-1 ADDRESSED by unchanged r9 contract at plan level (confidence: 96). Competing interpretations require retained unverified choice. A bare prose year cannot replace the established 2022 date without boundary evidence. No contract correction is needed.

The proposed proof has a specific revert witness: restoring unconditional continuation substitution loses both candidates, failing retained-candidate assertions. Provider assertions additionally require no automatic admission, explicit selection and the correct selected source. Retained shorter-prefix negatives and complete-header positives guard against discarding established metadata constraints.

No new verification defect, contradictory obligation, missing dependency or complete-plan blocker found within this lens.

Limitation: implementation and reversal proof remain unexecuted obligations. The inspected probe proves classification failure only. This is plan approval, not code acceptance (confidence: 100).

Review used a separate OpenAI context in the same model family as the writer. Plan authorship and arbitration shared one context.

VERDICT: APPROVED
``````


## Completed r9 bare-year rework and r10 viable-reading correction

The third matching continuation produced source afad77e6ae5fca27ecac0fc9d700497570f0f05f8390d2758be51221c18ba041. Its four-file suite passed225 tests, types, formatting, lint and diff checks0. Eleven production controls observed red1, exact restoration and green0. Root read citation-year-led-proof/RESULTS.md and the complete raw report. The correction-only reversal restored actual7d5f888a source and lost both valid candidates. Earlier whole-source reversals are explicitly coupled historical evidence, not current independent credit. No full pre-review or code closure was claimed for afad77e6.

Root then observed RC-4 through the actual production matcher in probe-competing-rounds.mjs and competing-rounds-before.log. The exact valid Tata Steel (A), Wijk aan Zee, Date2022.12.01, Round3 game is lost after its complete2022(3) citation when following prose is2024 (A): Better was Bd3. or2024 (1) was a different tournament. Ordinary in2024 retains it. Source bytes stayed unchanged. This disproves adjacency as definite metadata evidence and remains correction-created rework under original DR1, not a new adoption. Root immediately annotated f-20261029-05 through the findings writer, commit152fffce. The candidate remains unaccepted.

Round10 materially revises the mechanism to finite viable-reading composition. Where no known header establishes the later boundary, compatibility under any applicable reading retains an unverified choice. All applicable contradictions reject. No matching alternative becomes verified merely by fitting the candidate. Definite known-site boundaries, original bare-year constraints and unambiguous full-header matches remain strict. A shared date/round comparator avoids duplication, with linear bounded work and no new parser framework or module. Only three existing files remain in scope.

All four fresh r10 reports were canonically polled completed4/4 and read in full. Plan, correctness, minimalism and tests APPROVED and explicitly CLOSED RC-4 at plan level, no new finding. Implementation, source-reversal proof and code closure remain pending. Ten plan rounds completed, adoptions r1=1 r2=0 r3=1 r4=0 r5=0 r6=1 r7=0 r8=0 r9=0 r10=0. Three independent adopted plan issues remain closed. Diff adoptions r1=9 r2=0, DR2–9 closed and DR1 open. Plan authorship and arbitration shared one context. Detection used the same OpenAI model family as code.

The same matching thread01a187c2-f085-7033-9ef1-c844df7e18a8 resumed in repair-r1-resume4 at registry normal gpt-6.1-sol high, no fallback or escalation. An initial launcher invocation with the Grok-only --fix-text-file option refused before launch. The corrected Codex resume used the prompt-file argument and launched successfully. Earlier reports and receipts remain unchanged.

### Raw completed bare-year implementation report

``````text
Updated the matcher, regression tests and confidence docs. Both year-led prose cases now retain an unverified candidate for explicit selection, while original metadata contradictions and known-site later constraints still reject.

All requested checks passed, including **225 tests**. The correction-only reversal reproduced both failures on exact `7d5f888a…`. Restoration had no offsets. All 11 controls failed as expected, then passed after restoration.

Source SHA256:

- Before: `7d5f888a85f72d58adb3477360dadb61bf96250f82fe446cca524b84ff9afeb6`
- After: `afad77e6ae5fca27ecac0fc9d700497570f0f05f8390d2758be51221c18ba041`

[Paths, commands, logs, exits and control dispositions](/tmp/build-build-opening-game-references-20261029-064642-82fa88e8/citation-year-led-proof/RESULTS.md).

Changes remain unstaged. Foreign work was preserved. No browser, native or full pre-review acceptance was run.
``````

### Raw r10 canonical review block and exact delta

``````text
ROUND: 10
DELTA: /tmp/build-build-opening-game-references-20261029-064642-82fa88e8/plan-r10.delta
REVISED:
## Release precondition amendment and plan round 6 > ### Round10 viable competing field readings
SETTLED:
# Plan: clickable ChessBase game citations
## Goal
## MANDATE
## Threat model and non-goals
## Traced premises
## Approach
## Approach > ### O1 — recognize citations without changing the preparation
## Approach > ### O2 — resolve local games honestly
## Approach > ### O3 — open the selected full game through the existing admission path
## Approach > ### O4 — verify the complete interaction
## Decisions and trade-offs
## Risks / open questions
## Not part of this task
## Phases
## Release precondition amendment and plan round 6
## Release precondition amendment and plan round 6 > ### Round7 proof-control correction
## Release precondition amendment and plan round 6 > ### Round8 citation-boundary mechanism correction
## Release precondition amendment and plan round 6 > ### Round9 complete-header confidence correction
``````

The delta is stored byte-exact as base64 because diff context includes space-only lines.

``````text
LS0tIC90bXAvYnVpbGQtYnVpbGQtb3BlbmluZy1nYW1lLXJlZmVyZW5jZXMtMjAyNjEwMjktMDY0NjQyLTgyZmE4OGU4L3BsYW4tcjkubWQKKysrIC90bXAvYnVpbGQtYnVpbGQtb3BlbmluZy1nYW1lLXJlZmVyZW5jZXMtMjAyNjEwMjktMDY0NjQyLTgyZmE4OGU4L3BsYW4tcjEwLm1kCkBAIC0xMzksMyArMTM5LDE1IEBACiAKIFNjb3BlIGlzIHNyYy91dGlscy9nYW1lUmVmZXJlbmNlcy50cywgc3JjL3V0aWxzL2dhbWVSZWZlcmVuY2VzLnRlc3QudHMgYW5kIGRvY3MvZ2FtZS1yZWZlcmVuY2VzLm1kIGZvciBjb3JyZXNwb25kaW5nIGNvbmZpZGVuY2Ugc2VtYW50aWNzIG9ubHkuIFRoZSBvcmlnaW5hbCBtYXRjaGluZyB0aHJlYWQgcmVzdW1lcyBhdCBub3JtYWwgaGlnaCBhZnRlciBmcmVzaCBwbGFuLCBjb3JyZWN0bmVzcywgbWluaW1hbGlzbSBhbmQgdGVzdHMganVkZ21lbnQuIFRoZSBDb21tZW50IGNvbnN1bWVyIHVwZGF0ZSwgZml4dHVyZSBleHRyYWN0aW9uLCBjbG9zZSBwcm9vZiwgbmF0aXZlIHRlc3QgcmVwYWlyIGFuZCBldmVyeSBwcmV2aW91c2x5IHJldmlld2VkIHJlbGVhc2UgcmVxdWlyZW1lbnQgcmVtYWluIHVuY2hhbmdlZC4gUm9vdCBjb21taXRzIHRoZSBwcm92ZWQgY29ycmVjdGlvbiwgdGhlbiBjb3JyZWN0bmVzcywgcm9vdC1jYXVzZSwgdGVzdHMgYW5kIGFueSBvdGhlciBhZmZlY3RlZCBsZW5zIGNsb3NlIHRoZSBjb21taXR0ZWQgZGVsdGEgd2l0aCBmdWxsIGNvbnRleHQuIEF1dGhvcml0eSBpcyBmaXhlZCBNQU5EQVRFIGFuZCBkLTIwMjYxMDI5LTE3J3MgdmVyaWZpZWQtb25seSBvcGVuaW5nIHJ1bGUuIE5vIGFkZGl0aW9uYWwgYnVkZ2V0IG9yIGZsb29yIGNoYW5nZS4gTm8gcjkgdmVyZGljdCwgYWRvcHRpb24gb3IgaW1wbGVtZW50YXRpb24gYWNjZXB0YW5jZSBpcyBhc3N1bWVkLiBQbGFuIGF1dGhvcnNoaXAgYW5kIGFyYml0cmF0aW9uIHNoYXJlZCBvbmUgY29udGV4dC4gRGV0ZWN0aW9uIHVzZWQgdGhlIHNhbWUgT3BlbkFJIG1vZGVsIGZhbWlseSBhcyBjb2RlLgogCisjIyMgUm91bmQxMCB2aWFibGUgY29tcGV0aW5nIGZpZWxkIHJlYWRpbmdzCisKK1Jvb3Qta25vd24gUkMtNCByZW1haW5zIHVuZGVyIG9yaWdpbmFsIG9wZW4gRFIxL2YtMjAyNjEwMjktMDUuIFRoZSBjb21wbGV0ZWQgcjkgY2FuZGlkYXRlIGFmYWQ3N2U2YWU1ZmNhMjdlY2FjMGZjOWQ3MDA0OTc1NzBmMGYwNWY4MzkwZDI3NThiZTUxMjIxYzE4YmEwNDEgcGFzc2VzMjI1IHRlc3RzIGFuZDExIHNvdXJjZSBjb250cm9scywgaW5jbHVkaW5nIHRoZSBiYXJlLXllYXIgY29ycmVjdGlvbiwgYnV0IGFjdHVhbC1tb2R1bGUgY29tcGV0aW5nLXJvdW5kcy1iZWZvcmUubG9nIGxvc2VzIHRoZSBleGFjdCB2YWxpZCBUYXRhIFN0ZWVsIChBKSwgV2lqayBhYW4gWmVlLCBEYXRlMjAyMi4xMi4wMSwgUm91bmQzIGdhbWUgd2hlbiB0aGUgY29tcGxldGUgY2l0YXRpb24gaXMgZm9sbG93ZWQgYnkyMDI0IChBKTogQmV0dGVyIHdhcyBCZDMuIG9yMjAyNCAoMSkgd2FzIGEgZGlmZmVyZW50IHRvdXJuYW1lbnQuIFNvdXJjZSBieXRlcyBzdGF5ZWQgdW5jaGFuZ2VkLiBUaGUgb3JkaW5hcnkgaW4yMDI0IGNvbnRyb2wgcmVtYWlucyBvZmZlcmVkLiBTZWxlY3RpbmcgYW4gYWRqYWNlbnQgY29tcGxldGUgdHVwbGUgYXMgdGhlIGRlZmluaXRlIGdhbWUgZmllbGRzIGlzIGFub3RoZXIgdW5zdXBwb3J0ZWQgYm91bmRhcnkgcHJlbWlzZS4gTm8gcm9vdCBmdWxsIHByZS1yZXZpZXcgb3IgY29kZSBjbG9zdXJlIGlzIGNsYWltZWQgZm9yIHRoaXMgY2FuZGlkYXRlLiBGdXJ0aGVyIGNhc2Utc2hhcGVkIHBhdGNoZXMgc3RvcCBmb3IgYSBmb2N1c2VkIG1lY2hhbmlzbSByZXZpZXcsIGRvY3VtZW50ZWQgaW4gY2l0YXRpb24tY29tcGV0aW5nLXJlYWRpbmdzLW1lY2hhbmlzbS5tZCB1bmRlciB0aGUgcnVuIGRpcmVjdG9yeS4KKworTzIgYW1iaWd1aXR5IGNvbnRyYWN0OiB3aGVyZSBubyBoZWFkZXIgZXZpZGVuY2UgZXN0YWJsaXNoZXMgYSBsYXRlciBib3VuZGFyeSwgY29tcGFyZSB0aGUgc3VwcG9ydGVkIG9yaWdpbmFsIGFuZCBhbHRlcm5hdGl2ZSBjb21wbGV0ZSBmaWVsZCByZWFkaW5ncyBiZWZvcmUgZGVjaWRpbmcgY2VydGFpbnR5LiBBIGNvbXBhdGlibGUgb3JpZ2luYWwgcmVhZGluZyBjYW5ub3QgYmUgZGlzY2FyZGVkIG1lcmVseSBiZWNhdXNlIGEgbGF0ZXIgcmVhZGluZyBjb25mbGljdHMuIFJldGFpbiBhbiB1bnZlcmlmaWVkIG9jY3VycmVuY2UgaWYgYW4gYXBwbGljYWJsZSByZWFkaW5nIHJlbWFpbnMgY29tcGF0aWJsZSwgcmVqZWN0IHdoZW4gYWxsIGFwcGxpY2FibGUgcmVhZGluZ3MgY29udHJhZGljdCBpZGVudGlmaWFibGUgY29uc3RyYWludHMsIGFuZCBuZXZlciBtYXJrIHRoZSByZWFkaW5nIHRoYXQgaGFwcGVucyB0byBmaXQgdGhlIGNhbmRpZGF0ZSB2ZXJpZmllZCB3aGlsZSBjb21wZXRpbmcgaW50ZXJwcmV0YXRpb25zIHJlbWFpbiB1bnJlc29sdmVkLiBEZWZpbml0ZSBrbm93bi1zaXRlL2hlYWRlciBldmlkZW5jZSByZXRhaW5zIHByaW9yaXR5IGFuZCBpdHMgZXN0YWJsaXNoZWQgY29uc3RyYWludHMuIEJhcmUgcHJvc2UgeWVhcnMgcmV0YWluIHRoZSByOSBvcmlnaW5hbC1jb25zdHJhaW50IHNlbWFudGljcy4gT25lIHVuYW1iaWd1b3VzIHJlc29sdmVkIHJlYWRpbmcgcmV0YWlucyB2ZXJpZmllZCBiZWhhdmlvci4gUHJlc2VydmUgZnVsbCBjb250ZXh0IGluZGVwZW5kZW50bHkgb2YgbGFiZWwgb2Zmc2V0cyBhbmQgdGhlIGV4aXN0aW5nIHNoYXJlZCBmaWVsZCBncmFtbWFyLgorCitVc2UgYSBmaW5pdGUgY29tcGFyaXNvbiBvZiB0aGUgbGV4aWNhbCBhbHRlcm5hdGl2ZXMgYWxyZWFkeSBzdXBwb3J0ZWQsIHdpdGggbGluZWFyIHdvcmsgaW4gcmV0YWluZWQgY29udGV4dCwgbm90IHJlY3Vyc2l2ZSBvciBjb21iaW5hdG9yaWFsIGludGVycHJldGF0aW9uIHNlYXJjaCwgTkxQIG9yIGEgcGFyc2VyIGZyYW1ld29yay4gRXh0cmFjdCBhbmQgc2hhcmUgZGF0ZS9yb3VuZCBjb21wYXJpc29uIG9uY2UgdXNlZCBmb3IgbXVsdGlwbGUgcmVhZGluZ3MuIE5vIG5ldyBtb2R1bGUsIHNldHRpbmcsIHJlZ2lzdHJ5LCBkZXBlbmRlbmN5LCBzb3VyY2UsIHBlcnNpc3RlbnQgZm9ybWF0IG9yIHByb2R1Y3Qgc3VyZmFjZS4gVGhlIG1lY2hhbmlzbSBtYXkgcmVtYWluIGEgZmV3IGNvbmNyZXRlIGhlbHBlcnMgaW4gdGhlIGV4aXN0aW5nIG1hdGNoaW5nIG1vZHVsZS4gVGhlIHN0YWJsZSBjb250cmFjdCBpcyB2aWFibGUtcmVhZGluZyBjb21wb3NpdGlvbiwgcHJpdmF0ZSByZXByZXNlbnRhdGlvbiByZW1haW5zIHdpdGggdGhlIGV4ZWN1dG9yLgorCitBY2NlcHRhbmNlIHJldGFpbnMgdGhlIGV4YWN0MjAyMi9yb3VuZDMgb2NjdXJyZW5jZSBmb3IgYm90aCBuZXcgZnVsbC10dXBsZSBwcm9zZSBjYXNlcyBhcyB1bnZlcmlmaWVkLCBwcm9oaWJpdHMgYXV0b21hdGljIGFkbWlzc2lvbiBhbmQgb3BlbnMgdGhlIGV4YWN0IHNlbGVjdGVkIHNvdXJjZS4gTWF0Y2hpbmcgb25seSB0aGUgbGF0ZXIgcmVhZGluZyBhbHNvIHJlcXVpcmVzIGV4cGxpY2l0IGNob2ljZSwgbmV2ZXIgc2VsZi1zZWxlY3RpbmcgdmVyaWZpZWQgY2VydGFpbnR5LiBDb250cmFkaWN0aW9ucyB1bmRlciBldmVyeSBhcHBsaWNhYmxlIHJlYWRpbmcgcmVqZWN0LCB3aXRoIHVua25vd24gYWN0dWFsIGRhdGUvcm91bmQgcmVtYWluaW5nIGhvbmVzdGx5IHVudmVyaWZpZWQuIEtlZXAgb3JkaW5hcnkgc2luZ2xlLXR1cGxlIGRhdGUvcm91bmQgY29udHJhZGljdGlvbnMgYW5kIGtub3duLXNpdGUtZXN0YWJsaXNoZWQgbGF0ZXIgY29uc3RyYWludHMgc3RyaWN0LiBQcmVzZXJ2ZSB0aGUgb3JpZ2luYWwgc2hvcnRlci1ldmVudCBuby13cm9uZy1hZG1pc3Npb24gY2FzZSwgYWxsIHRocmVlIHByb3Blci1wcmVmaXgga2luZHMgYW5kIGJvdGggZXh0ZW5zaW9uIGZvcm1zLCBleGFjdCBmdWxsLWhlYWRlciBjb3VudGVycGFydHMsIHI4IHByb3NlL2hlYWRlci15ZWFyIGNhc2VzLCBiYXJlLXllYXIgcHJvc2UgYW5kIG9yaWdpbmFsLWNvbnN0cmFpbnQgdGVzdHMsIG5hbWVzLW9ubHkgYmVoYXZpb3IsIG9wdGlvbmFsIG1ldGFkYXRhLCBib3VuZHMsIGNhbmNlbGxhdGlvbiBhbmQgb3duZXJzaGlwLiBDb3JyZWN0IG9ubHkgcjkgdGVzdCBleHBlY3RhdGlvbnMgd2hvc2UgYXNzdW1wdGlvbiB0aGF0IGFkamFjZW5jeSBhbG9uZSBlc3RhYmxpc2hlZCBtZXRhZGF0YSBpcyByZWZ1dGVkIGJ5IHRoaXMgY29uY3JldGUgZXZpZGVuY2UsIHJldGFpbmluZyBvYnNlcnZhYmxlIGxvb2t1cCwgbm8tYXV0b21hdGljLWFkbWlzc2lvbiBhbmQgc2VsZWN0ZWQtb3JpZ2luIGFzc2VydGlvbnMuIERvIG5vdCB3ZWFrZW4gZXN0YWJsaXNoZWQtYm91bmRhcnkgbmVnYXRpdmVzIG9yIHJlbW92ZSBhIGZhaWxpbmcgd2l0bmVzcy4gS2VlcCB0aGUgbmV3IHRlc3RzIGR1cmluZyBwcm9kdWN0aW9uLW9ubHkgR2l0IHJldmVyc2FsIHRvIGFjdHVhbCBhZmFkNzdlNiBzb3VyY2UsIHJlcXVpcmUgc3Vic3RhbnRpdmUgY2FuZGlkYXRlLWxvc3MgcmVkLCBleGFjdCBuby1vZmZzZXQgcmVzdG9yYXRpb24gYW5kIGdyZWVuLiBSb290IGluZGVwZW5kZW50bHkgcmVwbGF5cyB0aGUgZGVjaXNpdmUgc291cmNlIGNvbnRyb2wgYW5kIHJlbGF0ZWQgcHJvb2YgYmVmb3JlIGZ1bGwgcHJlLXJldmlldywgc291cmNlIGNvbW1pdCBhbmQgY3VtdWxhdGl2ZSBjbG9zdXJlLgorCitDb3JyZWN0aW9uIHNjb3BlIHJlbWFpbnMgc3JjL3V0aWxzL2dhbWVSZWZlcmVuY2VzLnRzLCBzcmMvdXRpbHMvZ2FtZVJlZmVyZW5jZXMudGVzdC50cyBhbmQgZG9jcy9nYW1lLXJlZmVyZW5jZXMubWQuIFRoZSBvcmlnaW5hbCBub3JtYWwtaGlnaCB3cml0ZXIgcmVzdW1lcyBvbmx5IGFmdGVyIGZyZXNoIHBsYW4sIGNvcnJlY3RuZXNzLCBtaW5pbWFsaXNtIGFuZCB0ZXN0cyBqdWRnbWVudC4gRXhpc3RpbmcgY2xvc2VkIGZpbmRpbmdzLCBuYXRpdmUgcmVwYWlyLCBmaW5hbCBicm93c2VyL29yZGluYXJ5IG5hdGl2ZSBhY2NlcHRhbmNlLCBjbGVhbiBSdXN0L2Zyb250ZW5kIGdhdGVzLCBleGFjdC1TSEEgaG9zdGVkIENJLCByZXZpZXdlZCBpbnN0YWxsYXRpb24gYW5kIHJlY29yZC9jbGVhbnVwIHJlcXVpcmVtZW50cyBhcmUgdW5jaGFuZ2VkLiBBdXRob3JpdHkgaXMgZml4ZWQgTUFOREFURSBhbmQgZC0yMDI2MTAyOS0xNydzIGFtYmlndWl0eSBjb250cmFjdC4gVGhlIG5ldyBldmlkZW5jZSBzdXBlcnNlZGVzIHRoZSBhZ2VudCdzIGFkamFjZW5jeSBwcmVtaXNlLCBubyBGZWxpeCBkZWNpc2lvbiBpcyBpbnZlbnRlZC4gTm8gcjEwIHZlcmRpY3QsIGFkb3B0aW9uIG9yIGltcGxlbWVudGF0aW9uIGFjY2VwdGFuY2UgaXMgYXNzdW1lZC4gUGxhbiBhdXRob3JzaGlwIGFuZCBhcmJpdHJhdGlvbiBzaGFyZWQgb25lIGNvbnRleHQuIERldGVjdGlvbiB1c2VkIHRoZSBzYW1lIE9wZW5BSSBtb2RlbCBmYW1pbHkgYXMgY29kZS4KKwo=
``````

### Raw lens-plan-r10.txt

``````text
RC-4 CLOSED at plan level — `plan-r10.md:146` replaces adjacency-based selection with viable-reading composition, directly addressing the substitution at `src/utils/gameReferences.ts:168–173`. It preserves established header constraints and prevents a matching alternative from becoming verified certainty. `plan-r10.md:150` requires lookup/provider proof for both compatibility directions, all-conflicting and unknown metadata, explicit selected-source admission, and production-only reversal to afad77e6 with substantive candidate-loss failures. Confidence: 96.

No additional defects found in the complete delta or affected dependencies. No blocker identified elsewhere in the frozen plan. DR1/f-20261029-05 remains open at implementation level.

Limitation: implementation and executable proof remain pending. The supplied probe establishes matcher behavior, not native database behavior. No files changed or tests run. Review used a separate context within the writer’s OpenAI model family.

VERDICT: APPROVED
``````

### Raw lens-correctness-r10.txt

``````text
RC-4 CLOSED at plan level — plan-r10.md:146–150 requires both compatible-original/conflicting-later and conflicting-original/compatible-later cases to remain unverified choices. All-conflicting readings reject. Known-header constraints, bare-year behavior and unambiguous verified matches remain strict. This addresses the supplied candidate-loss cases without permitting automatic admission (confidence: 97).

No correctness defect found in the complete delta or affected O1–O4 contracts. No additional blocker identified in the frozen plan. DR1 implementation closure remains pending.

Limitation: implementation, reversal proof and native/UI acceptance were not executed in this read-only plan review (confidence: 100). Review used the same OpenAI model family as the writer. Plan authorship and arbitration shared one context.

VERDICT: APPROVED
``````

### Raw lens-minimalism-r10.txt

``````text
RC-4 CLOSED at plan level for minimalism (confidence: 95). Round10 replaces unsupported tuple selection with finite comparison of existing lexical readings, requires shared date/round comparison, and preserves definite header constraints and explicit-choice admission.

No bloat or duplication defects in the complete delta or affected obligations. The smallest sufficient correction fits the three named existing files. No added file, parser framework, configuration or speculative extension is required. Regression and reversal proof directly address the witnessed candidate loss.

Implementation and code closure remain unproven. Review uses a separate Codex context in the same OpenAI model family. Plan authorship and arbitration shared one context.

VERDICT: APPROVED
``````

### Raw lens-tests-r10.txt

``````text
RC-4 CLOSED at plan level (confidence: 98). plan-r10.md:150 requires both exact counterexamples through lookup/provider, asserting retained unverified candidates, no automatic admission and correct selected-source opening. Reverting production alone to afad77e6 must produce substantive candidate-loss failures with those tests retained.

The proof also covers later-only compatibility, all-conflicting readings and unknown metadata, while preserving strict established-boundary negatives and full-header positives. The complete delta removes no verification obligations. The test file is reachable through both the named related-test command and frontend coverage.

No verification blockers found. Implementation proof remains pending. The supplied probe establishes matcher rejection, not native lookup or admission. Browser/native acceptance and release gates remain required. Review used the same OpenAI model family as the writer.

VERDICT: APPROVED
``````


## Completed r10 source candidate and root replay start

The original matching thread completed its fourth continuation at normal gpt-6.1-sol high. Final matching source615df424789c4f4cdcd162e32a0caf38289042d3874ded4b300a467fb41124ff compares the original and immediate complete alternative through one shared date/round comparator. Any compatible applicable reading retains an unverified choice. Both contradictions reject, established known-site constraints keep priority and bare prose years retain original constraints. Root inspected the complete production/doc/test delta and read the entire proof and raw report. The fourteen current production controls all observed substantive red1, exact restoration with no offsets/fuzz, identical source/test/doc hashes and restored green0. Mandatory correction-only reversal restored actual afad77e6 and lost both exact root candidates. Prior coupled whole-source receipts stay historical and unchanged, with isolated current controls explicitly distinguished. No diagnostic0 was credited.

The four-file suite passed227 tests, types, formatting, lint and diff checks0. Four site-only/combined expectation rows changed only where concrete evidence refuted adjacency as a definite later boundary. Both event-only known-site rows remain strict, all-conflicting readings reject and all six exact full-header counterparts verify. Tests retain lookup/provider no-automatic-admission and exact selected-origin assertions. Only the three permitted permanent paths changed. Canonical completion was completed1/1, no fallback or escalation. Source acceptance remains pending root replay, full pre-review and committed code closure. Root will independently replay fourteen matching controls plus the unchanged isolated pending-close control, then complete related/type/contract/pre-review proof. Existing historical artifacts remain immutable.

### Raw r10 implementation report

``````text
Implemented r10 in the matcher, tests and docs. Competing readings now share one date/round comparator, retain an unverified choice when either is compatible, and reject when both contradict metadata. Known-site constraints remain strict.

All requested checks passed, including **227 tests**. All 14 current controls produced substantive failures, then passed after exact restoration with no offsets or fuzz.

Source hashes:

- Before: `afad77e6ae5fca27ecac0fc9d700497570f0f05f8390d2758be51221c18ba041`
- After: `615df424789c4f4cdcd162e32a0caf38289042d3874ded4b300a467fb41124ff`

The correction-only reversal restored exact `afad77e6…` and reproduced both candidate-loss failures.

[Changed paths, commands, logs, exits and control dispositions](/tmp/build-build-opening-game-references-20261029-064642-82fa88e8/citation-viable-readings-proof/RESULTS.md).

Changes remain unstaged. Foreign work was preserved. No browser, native or full pre-review acceptance was run.
``````

Plan authorship and arbitration shared one context. Detection used the same OpenAI model family as code.


## Root viable-reading proof completed

Canonical gate-viable-root-proof.5ftt9N completed0 at launch HEAD152fffce67cd7e0e618df8b531b8a7bd23da1ddf. One outer agent-gate admitted all temporary faults before source mutations. Root independently replayed fourteen matching controls and the pending-close guard, all fifteen reverse0, substantive red1, restore0, exact six-file hashes and no offsets/fuzz, restored green0. Each bad matching source matched the writer's frozen bad snapshot, including exact original afad77e6 for the required r10 correction-only reversal. Root inspected every failed assertion and its distinct observed mismatch. Competing certainty actually changed unverified to verified, known-site removal admitted forbidden candidates, compatible-reading removal lost games, bounds changed traversal or completeness, and close-intent removal caused actual admission. No diagnostic0 or coupled historical source reversal was credited.

Related proof passed24 files and1261 tests, types0, native verifier syntax0, UI boundary0, frontend mapping0, diff check0 and full unconditional contract0. Complete pnpm checks:pre-review passed0 after the final implementation edit. Artifacts/gates/20261029T154947848Z-644099 records frontend-build9.6s, format-lint3.0s, frontend mapping0.5s, backend mapping1.3s, Windows clippy13.6s, bundle0.6s and changed-file mutation1124.3s, all0. The tree-path mutation report reached100%, with all selected packages passing. Source615df424789c4f4cdcd162e32a0caf38289042d3874ded4b300a467fb41124ff stayed exact. Existing budget reporter measured entry556150, largest lazy486374 and total1660628 gzip bytes,9372 under the already approved1670000 total ceiling. Entry565000 and lazy550000 limits and all coverage/mutation floors remain unchanged.

The existing actual-module probe was also replayed through Node's module stdin in the owned checkout. Both exact complete-tuple prose cases and the ordinary in2024 control return offered:true with unchanged615df424 source. This is matcher evidence, not native database or pixel acceptance. The initial file-path invocation could not resolve Vite from TMP and exited1 before importing production code. It earned no proof credit. The unchanged probe then resolved dependencies from the checkout through stdin and exited0. Competing-rounds-before.log and competing-rounds-restored.log preserve both candidate versions, with no source edits during either successful probe.

The contemporaneous remote preflight returned0, all newest completed required Test jobs succeeded on master. This is a volatile preflight only and will be repeated before publication. DR1 remains open pending committed code closure. No final browser/native acceptance, final clean Rust/frontend gate, push or install is claimed here. Plan authorship and arbitration shared one context. Detection used the same OpenAI model family as code.


## Publication recovery onto the moved upstream

The full root proof above completed0 before integration. The subsequent fetch observed published bd5d61b5875bfbceb6ddaada9c80ccc7f6e4efa1. The original private stack forked at9b76350b66518a2cfbf1ff2739370dc24ad38ffb, although the shared origin/master ref had already advanced to47f7ac6e before the fetch. The first rebase stopped at private filing37da30ed because published findings f-20261029-02,03 and04 describe different defects. The merge driver refused the duplicate identities as designed. No conflict was skipped, no receipt/hash was manually rewritten and no published entry was replaced. The protected original snapshot is62159f00cf0e232f74c6362e2af805aaf6575022, retained by the original owned branch and backup/opening-game-references-20261029-before-third-rebase.

Root aborted that rebase and created build/opening-game-references-publication-20261029 in the same owned worktree, tracking the same authorized origin/master target. The original checkout remains untouched. The current canonical writer allocates across worktrees, including reservations. Root used new filing and decision inputs with explicit publication provenance. Original private identifiers and exact records remain stable in the archived snapshot and verbatim blocks below. New publication identities provide current references without attributing either private defect to a different published finding. This is publication recovery, not another defect discovery, plan issue, adoption or product choice. The metadata and initials records also received publication aliases so their current dependency references use this same namespace. Their original private records remain unchanged.

| Private historical identity | Current publication identity | Meaning |
| --- | --- | --- |
| f-20261029-02 | f-20261029-10 | DS2 compressed database-selection verification |
| f-20261029-03 | f-20261029-11 | Open-tail prose retains an unverified occurrence |
| f-20261029-04 | f-20261029-12 | Actual document/store lookup ownership |
| f-20261029-05 | f-20261029-13 | DR1 metadata boundary and confidence |
| f-20261029-06 | f-20261029-14 | DR2/DR3 case and order independent identity |
| d-20261029-14 | d-20261029-32 | Unchanged lookup ownership choice, governs publication finding12 |
| d-20261029-19 | d-20261029-31 | Unchanged native progress and cleanup mechanism |
| d-20261029-20 | d-20261029-33 | Unchanged actual extra-command control, supersedes only31's third recipe |

Feature decision17 and budget decision18 retain their identities and exact receipt-bearing records. Current native31 is marked superseded-by33 through the canonical set-trailer command. The private owner14 was archived rather than replayed as an operative decision whose old Governs4 would now misidentify the published coverage finding. Current owner32 correctly governs finding12. All current writer checks print ok. The new-input trailer validation refused two attempts before publication because its trailer must finish the unfenced body. Moving the trailer to the end repaired the inputs. An initial set-trailer invocation also refused a missing required flag. These are prepublication command corrections, no failed product proof or bypass.

A second cherry-pick attempt stopped at native decision19 because its old merge base required private owner14. Root aborted that record sequence and replayed the source commits separately, with records regenerated only through the writer. No source commit or requirement was omitted. Code mappings are DS2 17a2cabe→57d76b09, feature dc75c939→da1e206c, native e67f2b08→13f5b851, budget pointer aaeb25b5→f7a368e0, earlier matching73fb4fab→ef727271, pending-close8bcd1d84→228830c0, shared fixture0ee458a4→66c9fd5c and viable readingsab7f450a→d393d287. The projected previous code-review anchor is66c9fd5c, matching the source state previously reviewed through5d6dd857 before the last matching correction. Source gameReferences.ts is byte-identical to the frozen615df424 candidate after replay.

Only bundle-budgets.json and docs/bundle-budgets.md required source merge resolution. A bounded mechanical gpt-6-luna max leaf preserved the1670000 already-approved total ceiling and the genuine earlier citation-phase measurement object. It retained both competing history paragraphs verbatim and all later history unchanged. The reviewed pointer-only commit then restored the feature reference to decision18. Published ChessDB strings, its Playwright project, common chess tests and other source additions merged alongside this feature. Frozen phase measurement values are not an integrated-build claim. A fresh integrated build, exact measurement update and complete proof remain pending. The raw merge report follows. The complete original handoff content above was restored verbatim from62159f00 before these additions.

Ten plan rounds completed, adoptions r1=1 r2=0 r3=1 r4=0 r5=0 r6=1 r7=0 r8=0 r9=0 r10=0, three unique plan issues closed. Diff r1=9 r2=0, original DR1 remains pending code r3. DR2–9 source closures remain accepted subject to preservation. Publication aliases do not change counts. Final browser/native acceptance, final clean Rust/frontend gate, exact pushed-SHA hosted proof, reviewed install and completion ledger remain outstanding. Plan authorship and arbitration shared one context. Detection used the same OpenAI model family as code.

### Raw mechanical merge report

``````text
Resolved [bundle-budgets.json](/home/felixb/Projekte/chessfable.worktrees/opening-game-references-opening-game-references-20261029-064642-82fa88e8/bundle-budgets.json) and [docs/bundle-budgets.md](/home/felixb/Projekte/chessfable.worktrees/opening-game-references-opening-game-references-20261029-064642-82fa88e8/docs/bundle-budgets.md) only.

- The JSON parses and is byte-identical to `dc75c939:bundle-budgets.json`. Limits are entry **565000**, largest lazy **550000**, total **1670000**. Measurement is `pnpm build-vite`, **2026-10-29**, entry **556146**, largest lazy **486067**, total **1660313**. These are frozen citation-phase measurements, not an integrated-build measurement.
- The document’s opening paragraphs byte-match stage 3’s citation paragraph followed by stage 2’s ChessDB paragraph. The later historical text byte-matches both stage sources.
- No conflict-marker lines remain. Scoped `git diff --check` passed, and `git diff --name-only` lists only these two paths.

Both paths remain `UU` because I did not stage the resolutions. No tests or build were run. Integrated-source remeasurement remains for the root to perform after replaying the remaining commits.
``````

### Immutable private record archive

Each block below is an exact text range from the protected private snapshot, including its original identities and receipt metadata. These fenced historical records are not operative entries in the current ledger. The source range hash is supplied for comparison, no receipt was regenerated inside these blocks.

#### Private f-20261029-02

Source backup/opening-game-references-20261029-before-third-rebase:tasks/findings.md, range SHA256 73e51f381d40de7cefd50a4670dbec87fb0fbe6cb88820bd7b381583f3488ab3.

`````````text
### Native database-selection verifier decodes the compressed store as plain JSON

* **ID:** f-20261029-02 · **Status:** open · **Area:** e2e-gate · **Root:** - · **Entry:** inline · **Blocked:** none
* **Filed from:** build-opening-game-references-20261029-064642-82fa88e8
* **Impact class:** tooling
* **Where:** scripts/verify-app.mjs DS2, selected database read at line2535.
* **Defect:** The actual native citation staging run gate-citation-assertions-negative.zVQCAj failed DS2 with Unexpected token and compressed UTF-16 bytes at JSON.parse(raw). The published database store writes database-view through serializeStorageValue after f-20261010-01, while DS2 still requires plain JSON. All newly staged citation checks were reached separately, and this failure predates their input changes.
* **Failure scenario:** Open the native database explorer in the ordinary full verify:app journey after successful selection. The correct compressed database-view value throws in the verifier's JSON parser, so the full desktop proof reports failure despite the admitted selection.
* **Spotted outside diff:** Root real-product verification of opening-game-references, based on published f187917677a094c8f55dc926174308ea41254a3f.
* **Fix:** Decode through the existing deserializeStorageValue already imported by the verifier, retain exact successful type, handle and decimal-string storage_size comparisons, remove only the obsolete plain-JSON wording from the live assertion label and stage its real stored input at the observation boundary. No product persistence or fixture change.
* **Evidence:** /tmp/build-build-opening-game-references-20261029-064642-82fa88e8/gate-citation-assertions-negative.zVQCAj/log and completion.record, actual status1. src/state/store/database.ts writes serialized compressed state at lines211 and337.
* **Related:** f-20261010-01 is the handled compressed admission change. No shared Root with the older practice flake f-20261011-05 is claimed.
* **Found by:** Codex root. Plan authorship and arbitration shared one context. Detection ran on the same OpenAI model family as the code.

---

## 2026-10-29 — filed through the inbox spool
`````````

#### Private f-20261029-03

Source backup/opening-game-references-20261029-before-third-rebase:tasks/findings.md, range SHA256 fd3e75d410f4e9e8a851357450ea8e3ea2d28a420c6f413d72616eb839d806e8.

`````````text
### Ordinary prose after a short game citation hides a valid local occurrence

* **ID:** f-20261029-03 · **Status:** handled · **Area:** frontend-ui · **Root:** - · **Entry:** inline · **Blocked:** none
* **Filed from:** build-opening-game-references-20261029-064642-82fa88e8
* **Impact class:** behaviour
* **Where:** src/utils/gameReferences.ts metadataVerification, the unknown event/site prefix rejection.
* **Defect:** Root loaded the actual production module through Vite's module runner in an isolated JSDOM environment and called recognizeGameReferences and matchesReferenceGame. For the comment 0-1 Beerdsen,T-Bluebaum,M White was better., the visible action correctly ends at the player pair but its retained context is White was better. The exact matching Beerdsen/Bluebaum 0-1 game with known Elllobregat event/site returns offered:false. Lookup therefore drops it and can report no matching game solely because ordinary prose was interpreted as a contradictory event.
* **Failure scenario:** A preparation comment cites a game by result and abbreviated opponents, followed by ordinary notes without a closing round. Clicking the recognized action hides a real local match instead of offering it for explicit selection.
* **Fix:** Retain an unverifiable occurrence when unterminated trailing text cannot be established as citation metadata. Never auto-open it. Preserve exact event/site-prefix verification, anchored date and round constraints, all hard player/rating/outcome constraints and rejection of contradictory complete citations. No source text or external links change.
* **Proof:** Add observable lookup and actual admission tests. The prose case must return one unverified occurrence, admit no tab automatically and open the exact target only after explicit selection. Names-only without a tail and exact actual event/site context retain established behavior. Complete contradictory metadata still rejects. Retain tests during root-controlled removal of the correction and exact restoration.
* **Evidence:** Root source probe on 2026-10-29 printed context White was better. and offered:false at exit0. The actual module was imported, no matcher reconstruction was used. The pre-fix source is retained as gameReferences-before-open-tail.ts under /tmp/build-build-opening-game-references-20261029-064642-82fa88e8.
* **Found by:** Codex root while the pre-review gate was queued. Plan authorship and arbitration shared one context. Detection ran on the same OpenAI model family as the code.
* **Handled (2026-10-29, source682e8da6):** Unclosed ordinary prose is retained as unverified context before incidental-year parsing. Otherwise matching local occurrences require explicit selection, including prose mentioning another year after bare opponents, actual event or event/site prefixes. Exact identifiable metadata, players, ratings, ordered colors and outcome retain their constraints. Root independently removed only the production correction with a Git patch, kept all tests and observed ten substantive candidate/admission failures at1. Byte-identical restoration passed0. Root related24 files/1204 tests, UI boundary, scope-only baseline comparison and complete pre-review gate-pre-review-final.PrPl2e all passed0. Contract gate-phase-contract.DxPILu passed0. The tracked review handoff retains raw proof and the r4 correction-created lineage. This closes the implementation defect, not the still-pending cumulative review or release gates. Plan authorship and arbitration shared one context. Detection used the same OpenAI model family as code.
<!-- ledger-meta {"command":"close","effect_lines":1,"effect_sha256":"b7e64c73611075d9c56b4188a080934269c4ddf5dd1d2fad0b44d6db639e615c","header_sha256":"7d8d1cb665d690b5bd699ceead8c90be790a2f75b0b29182842e3eaf6b0bb713","header_status":"handled","input_sha256":"b540560408d9433ff2c8781ab84c325509d7b416da7dc57ed90c28d21ddd085a","kind":"mutation-receipt","operation":"24686ea2f7929159a8762af1fb4559d5747c3f55e6e495ac28c65b0510a1c011","options":{"section":null},"request_id_sha256":null,"results":["f-20261029-03"],"target":"f-20261029-03","v":1} -->

---

## 2026-10-29 — filed through the inbox spool
`````````

#### Private f-20261029-04

Source backup/opening-game-references-20261029-before-third-rebase:tasks/findings.md, range SHA256 d648b40123c8b81d06a339e4c15d02b31115ad1cafa9bf48a7cabcfc4662c23a.

`````````text
### Engine score updates retire an in-flight citation search

* **ID:** f-20261029-04 · **Status:** handled · **Area:** frontend-state · **Root:** - · **Entry:** lens · **Blocked:** none
* **Filed from:** build-opening-game-references-20261029-064642-82fa88e8
* **Impact class:** behaviour
* **Where:** src/components/common/GameNotation.tsx GameReferenceProvider owner={root}, and GameReference.tsx useLayoutEffect keyed by owner.
* **Defect:** Citation ownership is the immutable root object. EvalListener calls the actual tree store setScore for arriving engine lines. setScore uses Immer to update a root node score, replacing that root object's identity without replacing the preparation. The new provider effect therefore aborts its request and clears the dialog on an ordinary analysis update.
* **Failure scenario:** Click a preparation citation while an engine is analyzing and Library search is pending. An arriving score update closes the search and suppresses its result even though the preparation and citation still own the request. Repeated engine updates can prevent any lookup from completing.
* **Fix:** Bind lookup retirement to the existing actual document/store lifetime, preserving cancellation on real owner retirement or replacement and avoiding cancellation on score-only updates. Trace existing tree/tab generation ownership before choosing a boundary. Do not introduce a registry or hash the entire tree on engine events.
* **Proof:** A real-tree-store component regression must hold lookup pending, apply an actual score update, prove the same lookup remains live and can open the correct result. A genuine source owner retirement still cancels and suppresses stale admission. Retain the regression during root-controlled production-fix removal.
* **Evidence:** src/components/boards/EvalListener.tsx calls setScore at line286. src/state/store/tree.ts setScore at745 updates node.score inside produce. GameNotation selects root at108 and passes it as owner at110. Source trace establishes the ordinary path, runtime regression is still required.
* **Found by:** Codex root during implementation inspection. Plan authorship and arbitration shared one context. Detection ran on the same OpenAI model family as the code.
* **Handled (2026-10-29, source682e8da6, decision d-20261029-14):** The citation provider reads its existing TreeStateContext store and physical workspace document key separately. Current-result checks reject a replaced, closing or uncached owner before React cleanup. Real setScore updates preserve the pending lookup and its eventual exact-origin admission. Existing unmount cleanup owns freshness reload and mounted preview lifetime. Root independently removed only GameNotation/GameReference ownership corrections while retaining real-store tests, measured five substantive failures at1 and passed after byte-identical restoration at0. Root related24 files/1204 tests, complete pre-review gate-pre-review-final.PrPl2e and contract gate-phase-contract.DxPILu passed0. No registry, persisted epoch or tree/tab source change. Raw proof is retained in the task review handoff. This closes this implementation defect, cumulative review and release remain pending. Plan authorship and arbitration shared one context. Detection used the same OpenAI model family as code.
<!-- ledger-meta {"command":"close","effect_lines":1,"effect_sha256":"e5868bb7c9a189bfc47e6c8293ec9d1c5535b0ebf0a498f7e50ae256eca360b9","header_sha256":"f51868c807b8ef7f806ccd428bea84f653d5f515218d5ee43c3bd46ff4fb22ec","header_status":"handled","input_sha256":"2e98bb22bbef5e124dc9ea690af8be6f3890ba0dfeea0b33fd572f33f64feb2d","kind":"mutation-receipt","operation":"fbce203b7347d3d7bfc6507cb6304dc89522d93beff4d9c3c333873ef781e32c","options":{"section":null},"request_id_sha256":null,"results":["f-20261029-04"],"target":"f-20261029-04","v":1} -->

---

## 2026-10-29 — filed through the inbox spool
`````````

#### Private f-20261029-05

Source backup/opening-game-references-20261029-before-third-rebase:tasks/findings.md, range SHA256 1960b8f24d85ff357aff614dbc3cb3cad2d4b1cca92c5c19201f8614aea5f307.

`````````text
### Parenthesized event text ends a citation before its supplied date and round

* **ID:** f-20261029-05 · **Status:** open · **Area:** frontend-ui · **Root:** - · **Entry:** lens · **Blocked:** none
* **Filed from:** build-opening-game-references-20261029-064642-82fa88e8
* **Impact class:** behaviour
* **Where:** src/utils/gameReferences.ts:47, recognizeGameReferences.
* **Defect:** The first round-shaped parenthesis closes the context even when it belongs to the event. For 0-1 Beerdsen,T-Bluebaum,M Tata Steel (A) Wijk aan Zee 2022 (3), context stops at Tata Steel (A). An otherwise matching candidate with event Tata Steel (A), date2021 and round9 is marked verified, allowing an incorrect automatic opening.
* **Failure scenario:** Click a preparation citation whose event includes a section in parentheses before the site, year and round. A contradictory local game can open automatically because supplied constraints were dropped.
* **Related:** f-20261029-03 concerns unknown open-tail prose, a distinct boundary mechanism. This issue existed before that correction, so it is not attributed to its repair.
* **Fix:** Preserve later supplied metadata across parenthesized event/site text. Ambiguous boundaries require explicit choice rather than automatic opening. Preserve ordinary prose, rich text and next-citation boundaries.
* **Proof:** Add retained-candidate and contradictory-metadata lookup regressions, observe them fail with only the production correction removed, restore exactly and pass.
* **Found by:** Correctness cumulative review r1, confidence99, opening-game-references build. Plan authorship and arbitration shared one context. Detection used the same OpenAI model family as code.
* **Root repair counterexample, 2026-10-29:** DR1 remains open. The first correction chooses the last round-shaped parenthesis before separating citation fields from prose. Actual production-module probe parenthesis-prose-candidate.log at source SHA256 f9e88763f52b0e6c22e089bb1d3550281974fc0d9c21d6cb04c760bc43fb3c3d returns offered:false for the exact local Tata Steel (A), Wijk aan Zee, Date2022.12.01, Round3 game when the citation is followed by Better was Bd3 (A). or Better was Bd3 (1). The same citation with Better was Bd3. returns offered:true. The added prose group prevents a recognized close, then its A or1 is reinterpreted as a contradictory round. Source bytes were unchanged during the actual probe and match the completed writer's final source. This is correction-created rework under this still-open finding, not closure or a new lens adoption. Full supplied metadata must survive independently of the visible label, candidate event/site headers must resolve their boundary, and ordinary prose after the actual closing round must not become metadata. The earlier parenthesis-prose-diagnostic.log observed the worker's temporary reversed control and is not candidate evidence. Fresh focused plan judgment precedes further correction. Plan authorship and arbitration shared one context. Detection used the same OpenAI model family as code.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"08069e6fa8e68bdb026e6306a9bc183608f194259e23c2b3b787d4729a82b35e","input_sha256":"e2c1fbf64ce8e1c8b6f6699259af6a942dda0c4285fe68d20c3418d4de1b18fc","kind":"mutation-receipt","operation":"4c2231c2a4aa22b581c49034cecc905561bddec259e54626cbd710769d6c0934","options":{"section":null},"request_id_sha256":null,"results":["f-20261029-05"],"target":"f-20261029-05","v":1} -->

* **Cumulative closure r2, 2026-10-29:** Correctness explicitly leaves DR1 NOT CLOSED with confidence99 at src/utils/gameReferences.ts:168. For citation 0-1 Beerdsen,T-Bluebaum,M Tata Steel (A) Wijk aan Zee 2022 (3), a candidate with event Tata Steel, site Wijk aan Zee, date2021.01.01 and roundA becomes verified. The shorter event-only prefix leaves (A) Wijk aan Zee 2022 (3), the first anchored parenthesis is treated as a closing round and the return discards the later supplied date/round. This is contrary evidence against the r8 boundary premise, under the same still-open DR1 rather than a new independent discovery. Other eight adopted findings explicitly closed, root-cause approved the supplied cases but did not address this new shorter-prefix case. Stop patching for fresh focused mechanism judgment before correction. No final UI, push or installation has occurred. Plan authorship and arbitration shared one context. Detection used the same OpenAI model family as code.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"5168db1a3c57269c8b693480532456e1744aad03e55b54bbb1827b4172fda064","input_sha256":"6b399f8747f905f20c483d44f39936036b3f73ebf3d5d388c22aada5ee329e48","kind":"mutation-receipt","operation":"aa9facce368ecdecf378219030dabb7a96970551a32434606c96e2c4dd800718","options":{"section":null},"request_id_sha256":null,"results":["f-20261029-05"],"target":"f-20261029-05","v":1} -->

* **Root r9 implementation inspection, 2026-10-29:** The first r9 candidate at source SHA2567d5f888a85f72d58adb3477360dadb61bf96250f82fe446cca524b84ff9afeb6 passes222 tests and its ten controls, but is not accepted. Actual-module probe year-led-prose-before.log returns offered:false for the exact valid Tata Steel (A), Wijk aan Zee, Date2022.12.01, Round3 game when its complete citation is followed by 2024: Better was Bd3. or 2024 improvements included Bd3. The same game with Better was Bd3 in2024. remains offered. Exact source bytes were unchanged. The immediate-continuation branch reinterprets a bare following year as another game date and rejects, despite unresolved prose/header readings. This is correction-created rework under still-open DR1, not an independent adoption. The existing r9 invariant already requires unverified explicit choice for unresolved readings and preserved ordinary prose. Fresh same-revision mechanism judgment will examine this concrete implementation gap before a further correction. No full pre-review or code closure is claimed for the r9 candidate. Prior accepted-source controls and all raw failures remain historical. Plan authorship and arbitration shared one context. Detection used the same OpenAI model family as code.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"3aa3c7cafdd3390b7b3a14021585a8d577937fd2aed0e718f19bda3e0f67d31e","input_sha256":"3002a5fd3a0d9763ff9f7bab798baec9cd97463368af8843dec5d099a9f707bb","kind":"mutation-receipt","operation":"69c3f735ea2adbf350f4319179c5e08c685c44b1b663466b257c566ab4cbb4b9","options":{"section":null},"request_id_sha256":null,"results":["f-20261029-05"],"target":"f-20261029-05","v":1} -->

* **Root competing-round evidence, 2026-10-29:** The completed225-test candidate afad77e6ae5fca27ecac0fc9d700497570f0f05f8390d2758be51221c18ba041 fixes bare-year prose but still returns offered:false for the exact valid2022/round3 game when its complete citation is followed by2024 (A): Better was Bd3. or2024 (1) was a different tournament. Actual-module competing-rounds-before.log records both failures, the ordinary in2024 control remains offered and source bytes are unchanged. The branch still substitutes an adjacent complete tuple without header-boundary evidence and rejects the original viable reading. This is correction-created rework under the still-open DR1, with a concrete changed premise: adjacency alone does not establish which complete tuple is game metadata. Stop further case-shaped patches for focused bounded-reading mechanism judgment. A viable original reading must remain available as unverified when a later tuple may be prose, while known-site-established constraints and ordinary single-tuple contradictions remain. No root full pre-review or code closure is claimed for this candidate. Prior225-test and11-control receipts remain historical. Plan authorship and arbitration shared one context. Detection used the same OpenAI model family as code.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"e1a88a2f98c8b3a066fa4b945294c784dd47b71510557232c0f6832e9508ed27","input_sha256":"22d953b5b4a242de6a182f3c23f0f3cd721d4ff83be903e8d46ebccb0cc72047","kind":"mutation-receipt","operation":"2c05498849c8dcc6d01bffe6a7fab49f4e3a86fb26ef78234b6bf0d9b15adb5f","options":{"section":null},"request_id_sha256":null,"results":["f-20261029-05"],"target":"f-20261029-05","v":1} -->

---

## 2026-10-29 — filed through the inbox spool
`````````

#### Private f-20261029-06

Source backup/opening-game-references-20261029-before-third-rebase:tasks/findings.md, range SHA256 c7007a9fb6a704a3e85299c4d71e98af80fd67ac64b53dc95f0682a4f5f1317b.

`````````text
### Citation initials matching changes identity with database name capitalization and order

* **ID:** f-20261029-06 · **Status:** open · **Area:** frontend-ui · **Root:** - · **Entry:** lens · **Blocked:** none
* **Filed from:** build-opening-game-references-20261029-064642-82fa88e8
* **Impact class:** behaviour
* **Where:** src/utils/gameReferences.ts:108-116, matchesReferencePlayer.
* **Defect:** The uppercase-word heuristic interprets JOHN as four initials, so Smith,JO matches Smith, JOHN while Smith, John is rejected. The given-first branch instead lowercases JK before this heuristic, so Smith,JK rejects JK Smith but accepts Smith, JK. Name capitalization and storage order can therefore change candidate identity or omit a valid occurrence.
* **Failure scenario:** Click a multi-initial citation against a Library with uppercase full given names or given-first compact initials. An unrelated name may auto-open, or the intended local game is missing.
* **Related:** f-20261029-03 is in the same citation module but concerns prose context, not player identity. There is no evidenced shared cause.
* **Fix:** Make identity case-insensitive across both name orders, preserve ordered initials, reject JO against JOHN, and conservatively retain ambiguous compact initials for explicit selection.
* **Proof:** Add player and observable lookup regressions for both name orders and capitalization, with real failure on production-fix removal and exact restoration.
* **Found by:** Correctness cumulative review r1, confidence96 and98, opening-game-references build. Plan authorship and arbitration shared one context. Detection used the same OpenAI model family as code.
`````````

#### Private d-20261029-14

Source backup/opening-game-references-20261029-before-third-rebase:tasks/decisions.md, range SHA256 af2648a079cca210761e05908e700c02ebc7bbd56d9ac02a7c7eab948994b10f.

`````````text
### d-20261029-14 — Which identity owns a pending citation lookup while engine scores change?

* **Question:** Which existing identity owns a pending citation lookup while an engine changes scores on the same preparation tree?
* **Governs:** f-20261029-04
* **Chosen:** Use the existing tree-store identity and the workspace tab's existing physical tree key as separate lookup lifetime dependencies. Ephemeral previews use their existing store and mounted lifetime. A current-result guard checks the actual captured workspace owner against current metadata, rather than relying only on a later React cleanup. Preserve cancellation on unmount, source replacement and retired stores. Keep source ownership with the component that owns the asynchronous lookup, using existing context and ownership helpers.
* **Rejected:** The immutable root object as source identity, a new owner object on every render, a new registry or persisted epoch, whole-tree hashing on engine updates, store identity alone for same-file game replacement, or treating a score change as preparation retirement.
* **Reason:** Root and separate Codex Locate inspection traced EvalListener setScore through Immer to a new root reference, which currently aborts lookup. TreeStateProvider retains its store. replaceFileGame retains that store but publishes an existing fresh treeKey. getTabTreeKey and sameTabOwner already express that document boundary. FileFreshnessGate in-place reload preserves both identities but removes notation while unverified, so unmount cleanup owns that boundary. Library previews already use a keyed ephemeral provider. BoardsPage unmounts inactive tabs and removes closed cached stores. No new persistence or resource registry is required.
* **Reversal path:** If the application replaces its document lifetime abstraction, route citation ownership through that existing replacement and retain the score-update, real replacement and unmount regression proof. No migration or stored value needs reversal.
* **Decided by:** Codex under Felix's full-auto feature request of 2026-10-29. Plan authorship and arbitration shared one context. Detection ran on the same OpenAI model family as the code. **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":9,"effect_sha256":"67b23d8b7da6a0db97fd37ce602fdb50d3861fedcbdaa42f332298daef64cb0d","input_sha256":"c352e8414b5ce9d7df0854e09e0599defde7128f202b97ef397e57ae6efd8978","kind":"mutation-receipt","operation":"1e51b3a21f3491c60328e827c9bd3de87bd4d89c18475e0de52c638dad84d416","options":{"section":null},"request_id_sha256":null,"results":["d-20261029-14"],"target":"decisions-ledger","v":1} -->
`````````

#### Private d-20261029-19

Source backup/opening-game-references-20261029-before-third-rebase:tasks/decisions.md, range SHA256 f1d87e042fe14b70b221b085856d5f02a3e2f0edfb5bcaa6bf4ac31cca1e6c16.

`````````text
### d-20261029-19 — Separate warm-transition protocol progress from completed child cleanup in the native test

* **Question:** How should the required macOS warm-transition test prove one-exchange termination without treating full child cleanup as a600ms product promise?
* **Governs:** f-20261011-03
* **Chosen:** Repair only assert_warm_transition_termination and its shared cfg(test) fixture-observation helpers. Observe actual wire=quit through the existing5s capture convention, independently await successful terminator and search completion through the existing12s real-child cleanup convention, and retain all fresh/reuse, exact/all/graceful-release, silent-readiness, cancellation, exact ownership, no-extra-readiness and no-go assertions. Preserve completed OS-child cleanup and bounded failure cleanup. Keep every production deadline unchanged. Reuse the existing shared observation concept and defer failure assertions until owned work is cleaned up.
* **Rejected:** Raising only one aggregate timeout, accepting the ten-second readiness fallback, dropping matrix cases or cleanup assertions, changing production engine timing, adding a scheduler, gate, generic synchronization framework or new persistent coordination.
* **Reason:** Actual required job123368096273 in Test40850387164 at5a016bd295a13954ad956e1d4155539c2b2bba90 failed the600ms termination wait after observing readiness, with2828 passed and one failed. Source trace and a separate read-only Codex diagnostic show that the proxy includes child OS wait, stderr cleanup and actor join beyond protocol progress. Existing product defaults are readyok10s, quit3s and kill/reap2s. Existing d-20261008-10, d-20261008-13 and d-20261008-14 preserve exact/all preemption, graceful release and those deadlines. No host-pressure cause or product deadline violation is established. All five r6 plan classes approved the bounded contract, and PR-3 packet completeness was independently CLOSED. Healthy900ms post-quit exit delay, missing-interruption and missing-between-exchange-guard controls remain mandatory before implementation acceptance. This repairs only this observed required-CI witness. The broader governing finding remains open.
* **Reversal path:** Replace these test observations only with equally discriminating protocol-progress, no-continuation and completed-cleanup proof. A real new product latency requirement would need its own explicit, platform-appropriate acceptance contract and evidence before changing this witness. No production value or stored data needs reversal.
* **Decided by:** Codex under Felix's full-auto feature request and its mandatory verified-release workflow. Plan authorship and arbitration shared one context. Detection used the same OpenAI model family as code. **Superseded-by:** d-20261029-20
<!-- ledger-meta {"command":"record-decision","effect_lines":9,"effect_sha256":"29e3e3805bf2f3cd252a19529a841e1f3f44b1e3d24e146eb41bdd01f8031b2c","input_sha256":"608f258f9da5e868846062939016f778be43423aae4299970e74e11c9b2a7a16","kind":"mutation-receipt","operation":"e3f92a2420edf7d986cad7523d0e8326def10e264170880b383f7403a797702f","options":{"section":null},"request_id_sha256":null,"results":["d-20261029-19"],"target":"decisions-ledger","v":1} -->
`````````

#### Private d-20261029-20

Source backup/opening-game-references-20261029-before-third-rebase:tasks/decisions.md, range SHA256 07104388356af20908c30ebb0c9d2f65dc9e00db4e7f1a5b9ab5dfc107ee7904.

`````````text
### d-20261029-20 — Use a real extra readiness command for the continuation proof

* **Question:** Which faithful negative control should prove the retained no-extra-exchange assertion after complete guard-removal attempts still pass?
* **Governs:** f-20261011-03
* **Chosen:** Preserve d-20261029-19's entire permanent native-test mechanism, all ten cases, cancellation and physical-cleanup requirements,5s progress,12s completion and every production deadline. Correct only its third temporary-fault recipe. Add one actual isready write through the existing ProcessChildControl::write_line immediately before its quit write, keep the fixture/capture/assertions unchanged, require the real no-second-readiness assertion to fail101 after successful cleanup, then restore production source byte-identically. Root independently replays the control. No permanent production change or new fault API.
* **Rejected:** Requiring removal of redundant guards to cause bad behavior despite contrary observations, counting either diagnostic0 as negative proof, forging a capture line, changing an expected value, dropping the continuation assertion, or broadening production timing and coordination.
* **Reason:** Two actual complete guard-removal controls in phase2-proof/continuation still passed0 for all six slow cases with successful physical cleanup and no extra command. Other cancellation/teardown defenses prevented the intended continuation, so the old private implementation premise was unsupported. Root inspected ProcessChildControl::write_quit/write_line and the fixture's real command capture. The revised fault changes the actual owned stdin producer, while the retained counter is checked after real cleanup. Plan, correctness, tests and engine-protocol all approved r7 and explicitly CLOSED root-known RC-1 at plan level. The revised fault remains unexecuted and source acceptance still requires its actual101, restoration, root replay and full pre-review. This supersedes only the old control recipe in the earlier record, with measured new evidence and no product-design reversal.
* **Reversal path:** Replace this temporary proof only with equally faithful actual-producer regression evidence that falsifies the retained one-exchange requirement, preserving all permanent mechanism and cleanup obligations. Do not revive the ineffective guard-only recipe without contrary observable evidence. No stored data or production value needs reversal.
* **Decided by:** Codex under the full-auto feature request and mandatory verified-release workflow. Plan authorship and arbitration shared one context. Detection used the same OpenAI model family as code. **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":9,"effect_sha256":"74c3eecee61db6c82d40a8a598d464a0d8fbc0a468ecf309d8ef03306d1c6a54","input_sha256":"36a7487c91658fda58f742caa1063261ba875e9ca37f463b87d8bc8f59e6fd24","kind":"mutation-receipt","operation":"b954e06c8febe51ca0ea8eae6534db37668d0b457a2c6643c118260de80bc37c","options":{"section":null},"request_id_sha256":null,"results":["d-20261029-20"],"target":"decisions-ledger","v":1} -->
`````````


## Integrated build and explicit executor change

The final Codex measurement writer built the integrated checkout at HEADf5f71e4fbdc412b122062d2ec5290f542c32ddbb through pnpm gate:run frontend-build, actual exit0. Existing production buildBundleReport measured entry556213, largest lazy487189 and total1661867 gzip bytes,8133 under the same1670000 ceiling. Limits565000/550000/1670000 remain exact. The measurement object now records these real combined values, with one new explanatory paragraph. Older separate-candidate history remains unchanged. The build could not record a receipt because this task handoff was already untracked. Successful build evidence is not a receipt, final gate or install.

Felix then explicitly changed the remaining executor and authorized a quota-triggered return. His exact steering is preserved below. The already launched Codex worker completed its existing job during the transition. Canonical completion was completed1/1. No replacement Codex worker was started. Root selected DRAIN_EXECUTOR=grok after the owner environment boundary for every subsequent launch. A rollover requires an actual Grok quota limit, not an assumed imminent limit. Root remains responsible for integration, proof, arbitration and release.

``````text
If there is still some work to be done, do this with Executor grok from now on.

The grog quota will be reached soon. When you hit the grog quota limit, then just continue with Executor Codex again.
``````

The first Grok worker resolved mechanical to grok-4.6 medium, completed1/1, and passed the canonical profile check LEAF commands=7. Its extracted complete report follows. It independently measured the existing actual dist through the production reporter, obtaining the same556213/487189/1661867 figures and unchanged limits. It corrected only the new paragraph's wording to identify615df424 as a SHA256 prefix of src/utils/gameReferences.ts. That is a file hash, not a Git commit or whole-checkout identity. No rebuild or numerical change was necessary. Existing budget/format/diff checks passed0. Supplemental comparison outputs are retained as structural observations, with no invented behavioral negative-control credit. Root inspected the actual diff and measured output.

Earlier implementation and detection shared the OpenAI family. The new Grok check is xAI, a different family from the original feature source, while later Grok review of this Grok wording shares its family. Plan authorship and arbitration shared one root context. Fresh integrated related proof, complete pre-review and code r3 remain required. No final UI/native acceptance, push or installation is claimed.

### Raw completed Codex measurement report

``````text
Updated [bundle-budgets.json](/home/felixb/Projekte/chessfable.worktrees/opening-game-references-opening-game-references-20261029-064642-82fa88e8/bundle-budgets.json) and added one integrated-measurement paragraph to [docs/bundle-budgets.md](/home/felixb/Projekte/chessfable.worktrees/opening-game-references-opening-game-references-20261029-064642-82fa88e8/docs/bundle-budgets.md). The earlier separate-candidate paragraphs remain unchanged.

The measured source HEAD is `f5f71e4fbdc412b122062d2ec5290f542c32ddbb`, matching source SHA `615df424`. The integrated build combines the published ChessDB changes from `bd5d61b5` with the citation feature under decision `d-20261029-18`.

- Entry: **556,213 B**
- Largest lazy: **487,189 B**
- Total: **1,661,867 B**, leaving **8,133 B** under the total ceiling

All ceilings remain unchanged: **565,000 B Entry, 550,000 B largest lazy, 1,670,000 B total**. Parsed limit values match the frozen original.

`pnpm gate:run frontend-build` passed with exit **0**. Its output and exit are recorded in [frontend-build.log](/tmp/build-build-opening-game-references-20261029-064642-82fa88e8/publication-integrated-measurement/frontend-build.log) and [frontend-build.exit.txt](/tmp/build-build-opening-game-references-20261029-064642-82fa88e8/publication-integrated-measurement/frontend-build.exit.txt). The gate reported that it could not record a receipt because the worktree was dirty from the pre-existing untracked handoff.

`pnpm bundle:check`, `pnpm exec oxfmt --check bundle-budgets.json`, parsed-limit equality, and scoped `git diff --check` all exited **0**. Their logs are in the same evidence directory. The existing handoff remains untouched, and the two permitted changes are unstaged.
``````

### Raw first Grok report

``````text
Corrected `docs/bundle-budgets.md` opening wording only. Independent production measurement of existing `dist/` matches the recorded values. Historic body paragraphs match HEAD byte-for-byte. Changes remain unstaged.

## Paths and why
- `docs/bundle-budgets.md`: replaced ambiguous `matches source SHA \`615df424\`` with `matches SHA256 prefix \`615df424\` of \`src/utils/gameReferences.ts\``. That names the file and the SHA256 prefix so the token cannot be read as a Git commit or a whole-source hash.
- `bundle-budgets.json`: left as already recorded. Independent `buildBundleReport` on actual `dist/.vite/manifest.json` matched `entry` 556213, `largestLazy` 487189, `total` 1661867. Ceilings stayed 565000 / 550000 / 1670000.
- Proof: `/tmp/build-build-opening-game-references-20261029-064642-82fa88e8/publication-grok-measurement-proof`.

## Independent measurement
- Measured source HEAD: `f5f71e4fbdc412b122062d2ec5290f542c32ddbb`
- `src/utils/gameReferences.ts` SHA256: `615df424789c4f4cdcd162e32a0caf38289042d3874ded4b300a467fb41124ff`
- Reporter (`scripts/check-bundle-budget.mjs` `buildBundleReport`): entry **556213**, largest lazy **487189** (`src/routes/index.lazy.tsx`), total **1661867**, margin **8133**
- Parsed JSON limits: **565000 / 550000 / 1670000**
- No rebuild. Existing `dist/` was reused.

## Exits
- independent measurement: **0**
- parsed measurement/limits equality: **0**
- `pnpm bundle:check`: **0**
- `pnpm exec oxfmt --check bundle-budgets.json`: **0**
- scoped `git diff --check -- bundle-budgets.json docs/bundle-budgets.md`: **0**
- historic body vs `HEAD:docs/bundle-budgets.md`: **0** (13000 bytes, 10 paragraphs)

## Caveats
- Prior `pnpm gate:run frontend-build` exit 0 is successful build evidence. It is not a receipt or a final gate. Receipt recording failed because of the pre-existing untracked handoff.
- `tasks/handoffs/2026-10-29-opening-game-references-review.md` remains untracked and untouched.
- `bundle-budgets.json` and `docs/bundle-budgets.md` remain unstaged.
- No ceiling or floor was changed. No numeric value was changed. No new verifier module was added to the repo.
- Earlier feature code and detection were Codex in the same OpenAI family. This Grok executor is a different family from that original code. Plan authorship and arbitration shared one root context. Do not treat later Grok review of this Grok wording correction as family-separated.
``````

## Integrated root proof and selected-executor limitations

Root publication proof gate-publication-root-proof.iVL6Q6 at f5f71e4fbdc412b122062d2ec5290f542c32ddbb passed all15 independently replayed reversals, related24 files and1272 tests, types, verifier syntax, UI boundary, mapping, diff and contract checks. Its complete pre-review scheduler returned0. The mutation result is excluded from acceptance because the exact owned18GiB scope recorded two OOM kills. The original logs, actual observations and caveats are preserved through f-20261022-05 and the publication-oom files in the runtime directory. No false-green or individual-timeout cause is asserted.

Grok1.0.70 refused the first bounded read-only locate probe before reaching the model. The generated bundled symlink was rejected as a retargetable hook source, and bwrap refused to start with denied paths unprotected. The prescribed leaf-quota-retry.py --unclassified retry used the same route and prompt and failed identically. The canonical poll reported a failed leaf and completed0/1. Both extraction and profile check returned2, with no end record or available_commands record. These are failed launches, never reviews. Their exact stderr and artifacts remain under grok-memory-budget-probe and its probe-memory-budget-compatibility-r1.retry-1 subdirectory. No actual Grok quota was observed.

The same observed failure was already filed by another session in agent-kit's inbox entry20261029-175854-2547352-1793293134657459084-5.md, titled Grok read-only leaves refuse the bundled symlink before starting. Root read that pending entry and its related handled f-20260911-03 rather than filing a duplicate or changing shared tooling. The native read-only review fallback is authorized by review-lens-contract.md's reproducibly failing executor trigger and was disclosed to Felix. Grok remains selected for write and verify-ui leaves until an actual quota limit invokes his explicit Codex rollover. Native fallback detection shares the OpenAI family with the original code. Plan authorship and arbitration shared one root context.

Source tracing found that the historical GATE_MEMORY_BYTES=6442450944 workaround also reaches rustBuildEnvironment, which correctly refuses less than9GiB usable memory. The combined Rust/frontend gate therefore cannot faithfully use that6GiB global override. A first attempt with the existing GATE_CPU_SHARE hint printed four planned runners at the outer process, but makeLaneEnvironment deliberately writes1 to the sequential mutation lane. Its real package log still showed13 runners. Root retained raw counters and logs, stopped only its owned agent-gate-3428509-1793295305505891.scope, and canonically polled143. This attempt is excluded. Its raw pre-stop OOM counters were zero. A first affinity attempt then failed1 before the scheduler because cp could not overwrite the retained read-only kernel snapshot files. Those artifacts are preserved, and the corrected one-off capture creates a fresh directory per attempt.

The fresh gate-pre-review-affinity-retry.aoezFe constrains only its process tree to four already allowed CPU cores through agent-gate taskset. Existing sizing sees availableParallelism4 and the unchanged18253611008-byte usable budget, chooses two package slots with two runners each, and retains Cargo jobs2. The real annotate-comment package confirms two runners. The actual memory.max remains19327352832. All selected checks, files, tests, mutants,100% score floors and deadlines are unchanged. No permanent scheduler, setting, new gate, dependency or shared-machine policy is added. The process affinity vanishes when that proof shell exits. This is a bounded delivery mitigation, not closure of the general f-20261022-05 accounting finding. Final outcome remains pending until the canonical completion and raw end-of-scope counters are inspected.

### Accepted bounded pre-review on the integrated publication candidate

Canonical gate-pre-review-affinity-retry.aoezFe completed0 at f7dea8dd44c42b35db2540dd724ad1e912549811 with the two owned measurement edits and the existing untracked handoff. Every selected complete pre-review lane passed. Build7.9s, format/lint/types3.4s, frontend mapping0.5s, backend mapping1.5s, Windows clippy6.6s, bundle0.7s and changed-file mutation1120.2s all exited0. The complete scheduler logs are artifacts/gates/20261029T173819381Z-3502323. Its source matcher remains exact SHA256615df424789c4f4cdcd162e32a0caf38289042d3874ded4b300a467fb41124ff. Root inspected the final summaries and the actual raw memory files.

Fresh before/after snapshots in pre-review-memory.jGeKTk capture the exact owned agent-gate-3502230-1793295499151436.scope. memory.max remained19327352832 bytes. Final memory.peak was6653956096 bytes. All before and after oom, oom_kill and oom_group_kill counters were0. The raw files were copied before the scope exited. This accepts the unchanged full pre-review through the bounded process-affinity mitigation and supersedes only the preceding pending retry outcome. Earlier contaminated and stopped attempts remain excluded. It does not close f-20261022-05 or attribute the retained mutation timeouts to a cause.

All15 root controls independently read and retained their actual failure witnesses. Each reverse exited0, its retained anchor failed1, restoration exited0, final green exited0, and exact source-hash restoration passed. Related24 files/1272 tests, types, verifier syntax, UI boundary, coverage mapping and the complete contract had already passed in the publication root proof before its excluded mutation attempt. The accepted complete pre-review supplies the missing uncontaminated integration check.

Meanwhile origin/master advanced to ca3ea13dd187e258d4cd1dc7adecf098899c9fdc with the separately authorized ChessRiddle visual refresh. Root inspected the overlap, the published DESIGN.md and actual decision allocations. Existing current feature17/budget18 and native/ownership31/32/33 do not collide with the published design identities21–30. No new alias or source-feature decision is necessary. The next integration must preserve both the new design and all citation behavior, refresh only the three owned citation screenshots after inspected container differences and remeasure the actual combined production build. This paragraph does not claim that rebase, final code closure, UI/native acceptance, push or installation is complete.

## Published design and later tablebase integration

The first design rebase onto ca3ea13dd187e258d4cd1dc7adecf098899c9fdc preserved all source commits. Grok resolved exactly bundle-budgets.json, docs/bundle-budgets.md and Comment.tsx by preserving both complete measurement histories and the union of citation decoration with published typography. The canonical leaf completed1/1 and profile check reported LEAF commands=7. Root read the entire report and exact three-file resolution before staging and continuing. Other overlaps auto-merged, including Lucide mocks/icons, provider placement, catalogues and existing tab-seed extraction. The matching module remained SHA256615df424789c4f4cdcd162e32a0caf38289042d3874ded4b300a467fb41124ff. pnpm install --frozen-lockfile adopted only the published icon swap.

The subsequent published source e14a8547 added the independently authorized mover-perspective tablebase fix and its tests. It also published its different tablebase decision as d-20261029-31. Root preserved that published record and source. Canonical writer-created native adoptions are now d-20261029-34 for protocol progress and completed cleanup, and d-20261029-35 for the already-proven actual extra-readiness control. Native34 is superseded by35 only for that corrected control. Historical continuation33 remains byte-preserved and is canonically superseded by35. Feature17, budget18, owner32 and findings10–14 remain unchanged. These current operative aliases supersede earlier current-identity statements31/33 in this chronological handoff. Old private19/20 and the earlier publication31/33 are preserved in the raw history and protected backup branches, without changing a published ID or forging a receipt.

During that private rebase, the first attempt also dropped historical33. The append-only driver correctly refused the new34 replay because its merge base lost33. Root aborted that attempt, retained historical33 in the next retry, and the complete rebase succeeded. Only the old unpublished native31 record and its supersession mutation were omitted from the new publication range, with their immutable originals retained. No source payload was skipped. The existing three owned Grok changes were stashed by explicit path and restored after rebase. No foreign stash, published tablebase record or unrelated checkout was changed. Canonical set-trailer then linked historical33 to35. This is identity recovery, not a changed native mechanism or a new plan adoption.

The initial design-pixels.xouCZS run returned1 at its first notation screenshot, with the other unique-auto-open test passing. To inspect every intended difference before updating any baseline, the bounded Grok proof changed exactly three screenshot expectations to Playwright soft expectations temporarily. All three screenshot assertions still failed, with no behavioral assertion failure. The original spec was then restored byte-identically, SHA256158ef0c7c539c46effc83dab36b20f6de66be48069a5e946b926c42d31bad53b. This exit1 is a capture, never acceptance. Canonical completion and LEAF commands=7 were inspected, together with the full report and restored source. Root opened all six actual/diff PNGs and found the intended published fonts, surfaces, gold controls, icons and maple default. Narrow choices and missing-game guidance retained their behavior and no horizontal overflow. Exactly citations-notation-game-references.png, citations-choice-320-game-references.png and citations-missing-320-game-references.png are approved to refresh. Actual/diff copies remain in design-initial-diffs and the leaf's actual-diff directory. Original hard screenshot assertions remain unchanged for the acceptance rerun.

Grok remains the selected writer, with no actual quota observed. Its reproducibly failing read-only sandbox still uses the disclosed native-review fallback. The original source and earlier detection share the OpenAI family, and the later Grok literal integration uses xAI. Plan authorship and arbitration shared one root context. Fresh root pre-review, code r3, ordinary UI/native acceptance, final gates, push, exact-SHA hosted confirmation and installation remain pending.

### Raw Grok design conflict resolution report

``````text
Resolved the three current unmerged paths for replayed commit `da1e206c` (`feat(notation): open local games from preparation citations`) onto `ca3ea13d`. Working-tree resolutions are unstaged. No `git add`, continue, tests, or build.

## Changes

**`bundle-budgets.json`**
- Limits remain 565000 / 550000 / 1670000 (citation stage `:3`; `:2` still had total 1660000).
- Measurement is the citation commit’s historical figures: source `pnpm build-vite`, entry 556146, largestLazy 486067, total 1660313.
- File is byte-identical to `:3`. Design figures 550971 / 496862 / 1658119 stay in the docs paragraph only. No combined measurement.

**`docs/bundle-budgets.md`**
- Citation paragraph from `:3` kept byte-identical, still under `d-20261029-03` (later `f7a368e0` owns the pointer to `d-20261029-18`).
- Published design paragraph from `:2` kept byte-identical (`d-20261029-26`, `d-20261029-28`, `d-20261029-29`).
- Shared history from ChessDB `d-20261029-13` onward matches both stages.
- Order: citation (this commit) → design (onto) → existing history. Decision IDs 31/32/33 and findings 10–14 were not touched.

**`src/components/common/Comment.tsx`**
- Union of `:3` citation work and `:2` typography class.
- Imports: `recognizeGameReferences` / `GameReference`, `useGameReference`, and `classes` from `GameNotation.module.css`.
- Body: decoration, safe rich formatting, `activate` guard, and `className={classes.comment}`.
- Resolved file equals `:3` plus the CSS import and `className`.

## Already auto-merged (not edited)

Git had already staged these without markers:
- `GameNotation.tsx`: lucide toolbar icons and `GameReferenceProvider` wrap.
- `GameNotation.test.tsx`: lucide mocks and `GameReferenceProvider` mock.
- `GameTable.tsx`: `databaseGameSeed(record, file)` original-game seed.
- 16 catalogues: `GameReferences.*` entries present.

## Proof run

- No conflict markers in the three resolved files.
- `python3` parsed `bundle-budgets.json`; limits and citation measurement asserted.
- `git diff --check -- bundle-budgets.json docs/bundle-budgets.md src/components/common/Comment.tsx` exited 0.
- Stage comparison: JSON `== :3`; citation paragraph `== :3`; design paragraph `== :2`; remaining markdown `==` both stages; Comment `== :3` plus published class.

## Limitations

- Index still has the three paths unmerged until root stages them.
- No tests, build, or green-gate claim.
- JSON still records the citation-only candidate, not a later integrated design+citation build (`1946b59b` is still ahead).
- Later `f7a368e0` may conflict: it expected the ChessDB paragraph immediately after the citation paragraph; the design paragraph now sits between them.

``````


### Raw Grok first combined design measurement report

``````text
The incomplete-lookup Alert now uses the semantic warning palette, and the integrated production build is recorded under the unchanged `d-20261029-18` ceilings.

## Changed paths (unstaged)

- `src/components/common/GameReference.tsx:143` — `Alert color="yellow"` → `color="warning"`. Contents, role, conditions and actions unchanged.
- `bundle-budgets.json` — measurement object only (`source`, `date`, `entry`, `largestLazy`, `total`).
- `docs/bundle-budgets.md` — one new opening paragraph. Every earlier paragraph is byte-identical to `HEAD`.

## Source freeze

- Measured source HEAD: `c2e244918a04898684a6e5ec8e46f12ed208698b`
- `src/utils/gameReferences.ts` SHA256: `615df424789c4f4cdcd162e32a0caf38289042d3874ded4b300a467fb41124ff`
- Design/ChessDB/citation combination: published ChessRiddle visual design `ca3ea13dd187e258d4cd1dc7adecf098899c9fdc` with ChessDB and this cited-game lookup under `d-20261029-18`
- `package.json`, `pnpm-lock.yaml`, `vite.config.ts` equal `origin/master` (0-byte diff)
- Proof: `/tmp/build-build-opening-game-references-20261029-064642-82fa88e8/design-integrated-measurement-proof/`

The historical `f5f71e4f` paragraph remains historical evidence. It is not this source revision.

## Exact gzip metrics (`buildBundleReport`)

| metric | actual | limit | remaining |
| --- | ---: | ---: | ---: |
| entry | 551364 | 565000 | 13636 |
| largestLazy (`src/routes/index.lazy.tsx`) | 501597 | 550000 | 48403 |
| total | 1668660 | 1670000 | 1340 |

Limits stay `565000 / 550000 / 1670000`. Parsed `limits` equal `HEAD`. No ceiling was raised.

## Commands / exits

- `pnpm gate:run frontend-build` — exit **0**. `gate passed: frontend-build`. Wrapper command: `agent-gate node scripts/gate-receipt.mjs run frontend-build` → `pnpm build-vite`. Receipt not recorded because the working tree is dirty. Transcript: `artifacts/gates/20261029T215413658Z-479398/receipt-frontend-build.log`
- Dist measured with the existing `buildBundleReport` export on `dist/.vite/manifest.json`
- `pnpm bundle:check` — exit **0** (`entry: 538.4 KiB / 551.8 KiB`, `largestLazy: 489.8 KiB / 537.1 KiB`, `total: 1629.6 KiB / 1630.9 KiB`)
- `pnpm exec oxfmt --check bundle-budgets.json src/components/common/GameReference.tsx` — exit **0**
- `pnpm exec oxlint --deny-warnings src/components/common/GameReference.tsx` — exit **0** (0 warnings, 0 errors)
- `pnpm exec tsgo --noEmit` — exit **0**
- `git diff --check -- src/components/common/GameReference.tsx bundle-budgets.json docs/bundle-budgets.md` — exit **0**

## Preservation

- Later `docs/bundle-budgets.md` prose from the `f5f71e4f` paragraph through EOF is byte-equal to `HEAD`
- `bundle-budgets.json` `version`/`unit`/`limits` unchanged
- No other source, snapshots, package/lockfiles, thresholds or prior prose were edited
- Nothing staged or committed

Unstaged status:

```
 M bundle-budgets.json
 M docs/bundle-budgets.md
 M src/components/common/GameReference.tsx
```

``````


### Raw Grok complete visual-difference capture report

``````text
## Capture result (not acceptance)

Canonical `agent-gate pnpm test:e2e:container --project=game-references` **exited 1**. Three screenshot mismatches were captured. Soft assertions were removed. Spec bytes match the saved original. **This is not green proof.**

### Hashes

- original SHA256: `158ef0c7c539c46effc83dab36b20f6de66be48069a5e946b926c42d31bad53b`
- restored SHA256: `158ef0c7c539c46effc83dab36b20f6de66be48069a5e946b926c42d31bad53b`
- live spec SHA256: `158ef0c7c539c46effc83dab36b20f6de66be48069a5e946b926c42d31bad53b`
- `cmp` original vs live: equal (`cmp-exit=0`)
- restore status: `restore-sha256-equal`
- `expect.soft` remaining: 0
- hard `await expect(page).toHaveScreenshot`: 3
- snapshot git status for `e2e/game-references.spec.ts` and its snapshot dir: empty (no baseline update)

Saved original: `/tmp/build-build-opening-game-references-20261029-064642-82fa88e8/design-all-diffs/game-references.spec.ts.original`

### Command / exit / log

- command: `agent-gate pnpm test:e2e:container --project=game-references`
- recorded in: `/tmp/build-build-opening-game-references-20261029-064642-82fa88e8/design-all-diffs/e2e-soft.command`
- exit file: `1` (`.../design-all-diffs/e2e-soft.exit`)
- attempt completion: `1 design-all-diffs 492dce5c26a5bd1976e1c818a514487acdb5cfd3`
- attempt dir: `/tmp/build-build-opening-game-references-20261029-064642-82fa88e8/gate-design-all-diffs.E4pq5D`
- full log: `/tmp/build-build-opening-game-references-20261029-064642-82fa88e8/design-all-diffs/e2e-soft.log`
- poll: `headless_gate_poll` exit 1 / RED GATE because the gate status was 1 (expected)

### Three screenshot differences

Pixel ratios from the log:

| snapshot | pixels different | ratio |
| --- | ---: | ---: |
| `citations-notation.png` | 52373 | 0.10 |
| `citations-choice-320.png` | 18445 | 0.09 |
| `citations-missing-320.png` | 12473 | 0.06 |

Artifact paths:

- actual: `artifacts/frontend-audit/test-results/game-references-citations--f1fee-and-narrow-missing-guidance-game-references/citations-notation-actual.png`
- diff: `artifacts/frontend-audit/test-results/game-references-citations--f1fee-and-narrow-missing-guidance-game-references/citations-notation-diff.png`
- actual: `artifacts/frontend-audit/test-results/game-references-citations--f1fee-and-narrow-missing-guidance-game-references/citations-choice-320-actual.png`
- diff: `artifacts/frontend-audit/test-results/game-references-citations--f1fee-and-narrow-missing-guidance-game-references/citations-choice-320-diff.png`
- actual: `artifacts/frontend-audit/test-results/game-references-citations--f1fee-and-narrow-missing-guidance-game-references/citations-missing-320-actual.png`
- diff: `artifacts/frontend-audit/test-results/game-references-citations--f1fee-and-narrow-missing-guidance-game-references/citations-missing-320-diff.png`

Owned copies (same bytes):

- `/tmp/build-build-opening-game-references-20261029-064642-82fa88e8/design-all-diffs/actual-diff/citations-notation-actual.png`
- `/tmp/build-build-opening-game-references-20261029-064642-82fa88e8/design-all-diffs/actual-diff/citations-notation-diff.png`
- `/tmp/build-build-opening-game-references-20261029-064642-82fa88e8/design-all-diffs/actual-diff/citations-choice-320-actual.png`
- `/tmp/build-build-opening-game-references-20261029-064642-82fa88e8/design-all-diffs/actual-diff/citations-choice-320-diff.png`
- `/tmp/build-build-opening-game-references-20261029-064642-82fa88e8/design-all-diffs/actual-diff/citations-missing-320-actual.png`
- `/tmp/build-build-opening-game-references-20261029-064642-82fa88e8/design-all-diffs/actual-diff/citations-missing-320-diff.png`

### Behavioral result

- `citations: only a complete unique occurrence opens automatically` **passed** (973ms).
- `citations: formatted notation, keyboard choice and narrow missing guidance` **failed only** the three soft screenshot matchers. The test continued through choice, open, missing, and the later screenshot captures, so the intervening behavioral expects ran. No behavioral assertion failure is in the log.
- Summary: **1 failed, 1 passed** (12.4s). `ELIFECYCLE` exit 1.

### Proof limitations

- Exit 1 with three screenshot failures is the intended capture, not acceptance.
- Soft assertions were temporary and are gone. Baselines were not updated.
- Root still owns PNG inspection and any later three-file baseline update.
- `pnpm build` and `pnpm verify:app` remain pending per the UI contract.
- No other source files were changed. Dirty bundle/docs/`GameReference.tsx` work was left untouched. No process cleanup.

``````



### Completed design acceptance and final candidate measurements

Grok's final bounded writer completed1/1, with LEAF commands=7 and its entire report inspected. Fresh production build and original unchanged container suite both exited0. Only the three predicted citation PNGs changed. Root independently measured actual dist through production buildBundleReport and obtained551356 entry,501577 largest lazy and1668615 total gzip bytes,1385 below unchanged1670000. Root compared each new baseline byte-for-byte with its already inspected actual PNG, all three equal. The spec remains exact SHA256158ef0c7c539c46effc83dab36b20f6de66be48069a5e946b926c42d31bad53b and the matcher remains615df424. The measured source is492dce5c plus the explicitly named existing warning-palette change, including published tablebase basee14a8547. Both earlier integrated measurements remain historical. The two-slot machine-capacity wait delayed this writer's build, with both holders independently confirmed as correction-app sessions. Root did not interfere. Complete root pre-review, code closure and ordinary native acceptance remain pending.

### Raw Grok final measurement and three-baseline report

``````text
The integrated production build at HEAD `492dce5c26a5bd1976e1c818a514487acdb5cfd3` plus the existing uncommitted warning-palette change is under the unchanged `d-20261029-18` ceilings, and the three permitted citation screenshots were refreshed in the pinned container.

## Source identity

- Measured HEAD: `492dce5c26a5bd1976e1c818a514487acdb5cfd3`
- Published tablebase base: `e14a8547968a6ac24ec3604c94a9b7ee0e0e0120` (ancestor of HEAD)
- Matcher `src/utils/gameReferences.ts` SHA256: `615df424789c4f4cdcd162e32a0caf38289042d3874ded4b300a467fb41124ff`
- Spec `e2e/game-references.spec.ts` SHA256: `158ef0c7c539c46effc83dab36b20f6de66be48069a5e946b926c42d31bad53b`
- Dirty source delta included in the measured dist: existing uncommitted `src/components/common/GameReference.tsx` Alert `color="yellow"` → `color="warning"` (SHA256 `f13c3dffd7692c8c5a62ad6164691fd1c6fea7e1d0ded744e166508f64afb186`, byte-identical to freeze)
- The earlier `c2e244918a04898684a6e5ec8e46f12ed208698b` measurement remains historical. It does not include this later tablebase fix.

Freeze: `/tmp/build-build-opening-game-references-20261029-064642-82fa88e8/design-final-proof/`

## Exact gzip metrics (`buildBundleReport` on `dist/.vite/manifest.json`)

| metric | actual | limit | remaining |
| --- | ---: | ---: | ---: |
| entry | 551356 | 565000 | 13644 |
| largestLazy (`src/routes/index.lazy.tsx`) | 501577 | 550000 | 48423 |
| total | 1668615 | 1670000 | 1385 |

Limits stay `565000 / 550000 / 1670000`. Parsed `limits` equal the freeze. No ceiling was raised.

## Commands / exits / canonical completions

- `pnpm gate:run frontend-build` — exit **0**. `gate passed: frontend-build`. Command is `agent-gate node scripts/gate-receipt.mjs run frontend-build` → `pnpm build-vite`. Receipt not recorded because the working tree is dirty. Transcript: `artifacts/gates/20261029T222626235Z-924621/receipt-frontend-build.log`. Attempt `gate-design-final-frontend-build.Lv2I1N` completion `0 design-final-frontend-build 492dce5c26a5bd1976e1c818a514487acdb5cfd3`.
- Dist measured with the existing `buildBundleReport` export.
- `pnpm bundle:check` — exit **0** (`entry: 538.4 KiB / 551.8 KiB`, `largestLazy: 489.8 KiB / 537.1 KiB`, `total: 1629.5 KiB / 1630.9 KiB`)
- `pnpm exec oxfmt --check bundle-budgets.json` — exit **0**
- `git diff --check -- bundle-budgets.json docs/bundle-budgets.md e2e/game-references.spec.ts-snapshots` — exit **0**
- later `docs/bundle-budgets.md` prose from the `c2e24491` paragraph through EOF is byte-equal to the freeze (`later-prose-equal`, 15730 bytes)
- `pnpm test:e2e:update --project=game-references` — exit **0**. 2 passed (12.6s). Regenerated exactly the three permitted PNGs. Attempt `gate-design-final-e2e-update.g4lyrD` completion `0`.
- `pnpm test:e2e:container --project=game-references` — exit **0**. 2 passed (17.9s), both tests and all screenshots. Attempt `gate-design-final-e2e-container.mgcgbu` completion `0`. Spec unmodified.

## Modified files (unstaged)

- `bundle-budgets.json` — measurement object only: `551356 / 501577 / 1668615`, source `pnpm gate:run frontend-build`, date `2026-10-29`
- `docs/bundle-budgets.md` — one new opening paragraph naming HEAD `492dce5c`, the existing warning-palette change, matcher SHA256, published base `e14a8547`, and 551,356 / 501,577 / 1,668,615 with 1,385 B total remaining
- `e2e/game-references.spec.ts-snapshots/citations-notation-game-references.png` `a680b07e…` → `f6d73bc70f85ec3349db7dc9e67231546887eb307be2087fd9c7752e8a23252f`
- `e2e/game-references.spec.ts-snapshots/citations-choice-320-game-references.png` `8ffe05d4…` → `a8d800421bbe96dabfd8d257a3f15500865b4966cee4576e511127fed970064d`
- `e2e/game-references.spec.ts-snapshots/citations-missing-320-game-references.png` `4c10124d…` → `72f9b3af24bc646490068b414529f45a2062ec03ecfc30632ca56e8e07c3a517`

No other snapshot moved. All-e2e PNG inventory: only those three hashes changed.

## Preservation

- `GameReference.tsx` warning palette remains byte-identical
- Spec hash remains `158ef0c7c539c46effc83dab36b20f6de66be48069a5e946b926c42d31bad53b`
- Matcher hash remains `615df424789c4f4cdcd162e32a0caf38289042d3874ded4b300a467fb41124ff`
- Nothing staged or committed

Foreign dirt that appeared during this run and was left untouched: `tasks/handoffs/2026-10-29-opening-game-references-review.md` (+195 lines of root integration notes). It is outside this leaf’s scope.

No full pre-review or native journey. Root owns those next. Plan authorship and arbitration shared one context. Earlier detection shared the OpenAI family with the original code. This Grok leaf is xAI. No actual quota. Executor was not switched.

``````


### Fresh final-candidate root proof

Canonical gate-design-root-proof.86J0o2 completed0 at492dce5c plus the named owned UI, snapshot, measurement and handoff edits. All24 related files/1274 tests passed, together with types, verifier syntax, UI boundary, mapping, diff and the complete contract. Complete pre-review artifacts/gates/20261029T223419251Z-3015621 passed every selected lane, including1451.5s of mutation. Annotate-comment killed77. Workspace-storage killed1317 with2 timeouts and6 existing ignored. Tree-path killed193 with7 timeouts and13 existing ignored. No survivors or errors, unchanged100% floors. No individual timeout cause is asserted.

Raw before/after snapshots in pre-review-memory.40i9F4 show actual memory.max19327352832, peak8324558848 and zero oom, oom_kill and oom_group_kill throughout. Root inspected the files before accepting the result and retained each package's complete stryker.log/mutation.json separately under design-root-proof-retained, so later full gates cannot overwrite this evidence. The15 earlier negative controls remain source-carried, with byte-identical615df424 parser/query logic and only the nonlogical warning palette change in the owner component. Current related tests pass on the integrated design and tablebase source. This supersedes the latest pre-review-pending status, without claiming code closure or ordinary native acceptance.

Canonical technical decision d-20261030-01 records the final resource invocation. On the clean reviewed final tree, the mutation guard precedes full coverage at the existing3GiB budget and full mutation at the existing6GiB budget. Each actual proof and exact-tree receipt check must pass, then the unchanged complete Rust/frontend scheduler runs with normal detected memory. Production sizing resolved six coverage workers, one mutation slot/four runners and two Rust jobs at17GiB usable. Existing receipts bind complete clean tree, command, platform, toolchain and12-hour validity and recheck the tree. No source or HEAD change is allowed between priming and the full scheduler. This extends the existing C1 isolation and documented mutation mitigation through existing capabilities, preserving every selected gate, test, file, mutant, floor and timeout. This is a reviewed technical choice awaiting actual execution, never preclaimed final proof. General f-20261022-05 remains open. Plan authorship and arbitration shared one context. Earlier detection and original code shared the OpenAI family.


## Code closure round3 and adopted repair

All seven read-only native fallback lenses completed over9aa9bd2fd25e93b89ce2159bcc9b2069a424ab82, after accepted complete root pre-review. Quality approved. Correctness, root cause, tests and chess semantics independently kept existing DR1 NOT CLOSED because later year-round prose bypasses anchored original constraints. This is further supplied DR1 rework, not a new independent adoption. Root read every report and traced the early return before referenceFieldsVerification. No code closure or publication is claimed.

DR10 is a new adopted minimalism Fix. TournamentCard duplicated the database-game seed and omitted its linked locator. Root traced native query qualification, createTab's null argument, and actual CollectionService.resolve_game rejection of an absent locator with StaleGame. This is recorded as f-20261030-01, claimed for this build's persistent owner3169465, and included in the same game-opening repair batch. The existing pagination finding f-20261010-03 is unrelated and remains preserved. The fix must route this fourth caller through the existing shared helper and retain a meaningful row-activation regression.

DR11 is a new adopted records Fix. The old broad sentence saying the task changes no engine or Rust source belonged to its feature-only checkpoint. The final range includes the already-proven cfg(test) warm-transition witness repair. Canonical annotation39f9c671 on f-20261011-03 explicitly withdraws that broad scope assertion while preserving historical evidence, unchanged production engine behavior and unchanged production deadlines. That record correction awaits reviewer closure. Canonical annotationc04e20cd on f-20261029-13 records the still-open DR1 implementation gap. No ledger body or receipt was hand-edited.

New adoptions are r1=9 r2=0 r3=2, eleven unique code/record issues overall. DR2–9 are closed, DR1 andDR10 require source repair, DR11 is corrected pending closure. No Skip or Defer. Plan rounds remain ten, the code gap violates an existing obligation rather than introducing a new plan premise. Root assigned the bounded code repair to Grok, with retained regressions required to fail on the old producer before repair and pass after, plus independent root reversals and complete pre-review before round4. Source SHA615df424 belongs to the pre-repair candidate and must not be represented as a future fixed revision. Plan authorship and arbitration shared one context. Earlier detection and original code shared OpenAI, and the new repair writer is xAI. No actual quota rollover has occurred.

# Code closure round3 raw reports

Reviewed HEAD9aa9bd2fd25e93b89ce2159bcc9b2069a424ab82. All7 native read-only fallback reports completed and read. Quality approved, other6 revised. DR1 remains NOT CLOSED, repeated supplied rework. New adoptions2, DR10 minimalism and DR11 records, both Fix. No Skip or Defer. Root traced metadataVerification's early return and the tournament linked-locator requirement in tabs.ts572 and linked_collections.rs3291. Current producer drops the required locator, and the real native resolver refuses None with StaleGame. This is a live linked-game opening failure, not merely a duplicate seed. Planning/arbitration shared one context, detection shared original code's OpenAI family. No quota rollover. This is not code closure.

## correctness

``````text
DR1 NOT CLOSED — with the exact event/site prefix `Tata Steel (A) Wijk aan Zee`, `metadataVerification` returns `unverified` when prose between `2022 (3)` and a later dated round prevents an immediate continuation. It skips checking the anchored `2022 (3)` against the game. The competing-reading tests cover adjacent tuples, not this intervening-prose case.

[blocker] src/utils/gameReferences.ts:212 — For `Tata Steel (A) Wijk aan Zee 2022 (3) Better was Bd3 2024 (A)`, a game with matching players and result but date `2021.01.01` and round `9` is retained as an unverified choice, though it conflicts with both readings. The resolved header makes `2022 (3)` identifiable, so this candidate should be rejected. (confidence: 96)

No additional blocker found in the reviewed matcher, lookup, or admission path. No tests were run by this read-only review.

Plan authorship and arbitration shared one root context. Detection ran on the same OpenAI model family as the code, so family separation was absent.

VERDICT: REVISE
``````

## root-cause

``````text
DR1 NOT CLOSED. The adjacent competing tuples in the new tests are covered, but a later tuple separated by prose bypasses the comparison that rejects conflicting metadata.

[blocker] src/utils/gameReferences.ts:212 — With the exact event and site followed by `2022 (3) Better was Bd3 in 2024 (A).`, a candidate dated `2021.01.01` with round `9` conflicts with the original tuple and any later-field reading. The intervening prose means `continuation` is absent, so this early return marks the candidate unverified before `referenceFieldsVerification` checks the anchored `2022 (3)`. `lookupGameReference` therefore retains and offers the contradictory game for manual opening. The pre-repair base rejected its conflicting anchored fields, so this repair reopens that contradiction-filter failure. The added tests cover only the adjacent form at `src/utils/gameReferences.test.ts:918`. (confidence: 99)

I found no duplicate implementation of this matcher. Plan authorship and arbitration shared one root context. Detection ran in the disclosed orchestrator-native read-only fallback after reproducible Grok launcher startup failures, with no quota rollover, and shares the OpenAI model family that authored the code.

VERDICT: REVISE
``````

## minimalism

``````text
Plan authorship and arbitration shared one root context. Detection ran on the same OpenAI model family as the code.

The r3 field-verification helper is justified by its reuse across competing readings. It adds no new module or parser framework.

[should-fix] src/components/databases/TournamentCard.tsx:165 — This database-game opening path still builds the tab seed inline, while the new `databaseGameSeed` serves `GameTable`, `GamesTable`, and `GameReferenceProvider`. It also omits `game.linked`. Route it through `databaseGameSeed(game, file)` so all four paths share the same seed and preserve linked occurrence identity (confidence: 98).

VERDICT: REVISE
``````

## code-quality

``````text
Plan authorship and arbitration shared one context. Detection ran on the same OpenAI model family as the code, so family separation was absent.

No readability or local-consistency findings at 80+ confidence. The change uses clear names and comments for competing metadata readings, extracts shared normalization and field comparison logic, and keeps the earlier single-reading and known-site examples visible in the tests. I found no dead paths, stale comments, undocumented suppressions, or new unlabeled behavior literals. No tests were run.

VERDICT: APPROVED
``````

## chess-semantics

``````text
[blocker] src/utils/gameReferences.ts:212 — DR1 NOT CLOSED. For `Tata Steel (A) Wijk aan Zee 2022 (3) Better was Bd3 in 2024 (A).`, the matching event/site prefix anchors `2022 (3)`, but the later year-round text returns `unverified` before those fields are checked. A game dated `2021.01.01`, round `9` is therefore offered despite conflicting with both readings, and can be opened as the wrong game. The resulting tree is internally consistent. I found no separate FEN, path or parity defect. This is supplied DR1 rework, not a new independent adoption. (confidence: 100)

Plan authorship and arbitration shared one context. Detection ran on the same model family as the code.

VERDICT: REVISE
``````

## records

``````text
[should-fix] tasks/findings.md:16811 — The full range changes Rust source in `src-tauri/src/chess.rs` for the warm-transition test repair (commit `7237a6c2`). The change is test-only, but “The citation task changes no engine or Rust source” is too broad. Clarify that production engine behavior is unchanged and identify the Rust test change. (confidence: 99)

The recorded mutation, snapshot and memory figures match their retained artifacts. The d-20261030-01 sequence is accurately described as planned and unexecuted. No tests were run.

Plan authorship and arbitration shared one context. Detection ran on the same OpenAI model family as the code.

VERDICT: REVISE
``````

## tests

``````text
DR1 NOT CLOSED — In [gameReferences.ts](/home/felixb/Projekte/chessfable.worktrees/opening-game-references-opening-game-references-20261029-064642-82fa88e8/src/utils/gameReferences.ts:206), a year-round match anywhere after the anchored tuple returns `unverified` before the original tuple is checked. If `2024 (A)` follows prose, a game dated 2021 with round 9 is still offered despite contradicting the applicable `2022 (3)` citation. This is supplied DR1 rework, not a new adoption.

[blocker] [gameReferences.test.ts](/home/felixb/Projekte/chessfable.worktrees/opening-game-references-opening-game-references-20261029-064642-82fa88e8/src/utils/gameReferences.test.ts:918) — The new competing-reading tests cover adjacent tuples only. They do not catch a full year-round tuple after intervening prose, so the contradictory game remains available in the choice dialog. (confidence: 99)

The file is included by Vitest’s `src/**/*.{test,spec}.{ts,tsx}` selector, and the planned frontend coverage lane runs `pnpm test:coverage`. I read the 24-file, 1,274-test related-proof log and the prior reversal logs without rerunning tests. Those reversal logs show the adjacent-reading tests fail on the earlier source and pass after restoration. The final unchanged scheduler and exact-tree receipt sequence are source-supported by `d-20261030-01`, but final-gate execution is still pending.

Plan authorship and arbitration shared one context. Detection ran in the same OpenAI model family as the code.

VERDICT: REVISE
``````




## R3 repair proof and return to canonical Grok review

Current R4 candidate is c04e20cd plus5 bounded Grok-owned source/test/doc changes, subsequently committed without changing their bytes. Matching module SHA25671e915f5539b9994d9430e33d3e80ad91d5a90e548d98527c1e079a37b7899fb. TournamentCard SHA2568ec6e4f5a35e9141fdee5a704b7c19ec448a0084dfddc26270defa69ac637840. Original hard E2E spec SHA256158ef0c7c539c46effc83dab36b20f6de66be48069a5e946b926c42d31bad53b remains unchanged. Prior615 candidate failed R3 and is never final acceptance.
Grok repair completed1/1, profile LEAF commands7 and full report inspected. Tests-first assertions failed1 for both metadata prose forms and the linked TournamentCard action on original producers. Focused gameReferences109 and TournamentCard10 passed0, types and scoped oxfmt/oxlint/diff0. Separate production-only patches preserve retained tests. Root independently reversed each exact producer patch, observed substantive assertion red1, restored every source/test/doc hash exactly and observed targeted green0. The metadata failure retained incompatible2021/9 as unverified, the tournament failure omitted its required locator. Artifacts TMP/root-code-r3-controls contain complete commands/logs/exits/hash comparisons. No temporary reversal remains.
Root canonical gate-code-r3-root-proof.oWbbXT completed0 at c04e20cd with the explicit6 owned dirty paths. Related26 files/1300 tests, tsgo, verifier syntax, UI boundary, frontend mapping, diff and full contract all passed. Complete pre-review artifacts/gates/20261029T232648182Z-3313515 passed frontend-build7.6s, format/lint/types3.1s, frontend mapping0.5s, backend mapping1.4s, Windows clippy10.8s, bundle0.8s and changed-file mutation822.7s. All actual exit codes0.
Raw mutation reports: annotate-comment77 Killed. Workspace-storage1317 Killed,2 Timeout,6 Ignored. Tree-path193 Killed,7 Timeout,13 Ignored. No Survived or errors and unchanged100% floors. No individual timeout cause inferred. All3 raw stryker.log/mutation.json retained under TMP/root-code-r3-proof-retained before later gates overwrite ordinary artifacts.
Before/after kernel snapshots TMP/pre-review-memory.dIRvM2 were captured inside the exact root gate before its exit. memory.max19327352832, final peak7781748736 bytes, before/after oom/oom_kill/oom_group_kill all0. Four-core taskset uses the existing17GiB usable budget, two mutation slots/two runners each and Cargo jobs2. This temporary delivery mitigation does not close broad f-20261022-05.
Earlier15 root controls in TMP/root-publication-proof were real historical reverse0/red1/restore0/green0 on615. Their old exact-module claim is historical, not a claim that current71 bytes equal615. This candidate changes only the identified DR1 branch and fourth seed caller, and independently reruns all related dependencies plus the new2 controls.
Published design/tablebase integration, equality range diffs, current native decisions34/35 (historical33 superseded35), owner32, feature17 and budget18 remain preserved. Already published31 is the independent tablebase decision. Source archive62159f00 remains protected, published finding aliases10–14 preserve original receipts. No source payload was skipped.
Previous original-hard-spec pinned container suite passed2 tests on R3, root inspected3 intended published-design baseline updates and all6 original actual/diff images. No new baseline update is requested by this repair. Previous actual bundle point551356/501577/1668615 is retained as measured history, current pre-review bundle passes unchanged caps565000/550000/1670000. Fresh final container, pnpm build and ordinary pnpm verify:app remain pending on this repaired candidate. No staged native positive is accepted.
Plan10 rounds, adoptions r1=1 r2=0 r3=1 r4=0 r5=0 r6=1 r7=0 r8=0 r9=0 r10=0,3 unique closed. Code adoptions r1=9 r2=0 r3=2,11 unique. DR2–9 closed, DR1 andDR10 implemented pending R4 reviewer closure, DR11 canonically corrected pending records closure. No Skip/Defer. DR1 is repeated supplied rework, never a new adoption.
R3 detection used the disclosed native OpenAI fallback after two reproduced Grok read-only startup failures at kit400072b4. During this proof published kit advanced toe759a67b including49bd7587, which fixes that actual bundled symlink cause. R4 returns to canonical Executor Grok. No quota observed, no Codex rollover. Source/test repair author and R4 detection share xAI family, original code/root share OpenAI. Planning and arbitration shared one root context. Do not claim whole-range family separation.
Full clean Rust/frontend final scheduler, exact pushed-SHA required hosted jobs and reviewed installation still pending. Broad f-20261011-03 and f-20261022-05 remain open.

### Raw Grok R3 repair report

````text
Both repairs are in place, unstaged, with old-producer red and restored-producer green recorded.

## Changed paths
- `src/utils/gameReferences.ts`
- `src/utils/gameReferences.test.ts`
- `src/components/databases/TournamentCard.tsx`
- `src/components/databases/TournamentCard.test.tsx`
- `docs/game-references.md` (same-contract clarification only)

Outside-scope `tasks/handoffs/2026-10-29-opening-game-references-review.md` appeared during the session from root; it was left untouched.

## Mechanism
**FIX1 / DR1.** After a complete event+site prefix, a later year-round tuple separated by ordinary prose no longer early-returns `unverified`. The anchored original fields go through existing `referenceFieldsVerification`. A candidate dated `2021.01.01` / round `9` against `Tata Steel (A) Wijk aan Zee 2022 (3) Better was Bd3 in 2024 (A).` (and the form without `in`) is rejected. A compatible original match stays verified. Unknown actual date/round stays an explicit choice. A candidate that fits only the later prose tuple is rejected. Unresolved headers, `siteFollows` header extensions, adjacent competing readings, and bare-year prose keep their previous paths.

**FIX2 / DR10.** `TournamentCard` opens through `databaseGameSeed(game, file)`. The IconAction / `runTabCreation` / navigate / error path is unchanged. Linked locators now reach `createTab`. Standalone origins still have no locator.

## Proof
Directory: `/tmp/build-build-opening-game-references-20261029-064642-82fa88e8/code-r3-repair-proof`

**Original hashes**
- `gameReferences.ts` `615df424789c4f4cdcd162e32a0caf38289042d3874ded4b300a467fb41124ff`
- `TournamentCard.tsx` `52c8e4d5c1a56839c654245c068660e787becf20c2f8c5e268e48d4b8dd33549`

**Final hashes**
- `gameReferences.ts` `71e915f5539b9994d9430e33d3e80ad91d5a90e548d98527c1e079a37b7899fb`
- `TournamentCard.tsx` `8ec6e4f5a35e9141fdee5a704b7c19ec448a0084dfddc26270defa69ac637840`

**Production patches** (reverse independently; tests stay)
- `/tmp/build-build-opening-game-references-20261029-064642-82fa88e8/code-r3-repair-proof/metadata-production.patch`
- `/tmp/build-build-opening-game-references-20261029-064642-82fa88e8/code-r3-repair-proof/tournamentcard-production.patch`

**Red then green**

| step | command | exit | evidence |
|---|---|---|---|
| FIX1 old producer | `vitest run src/utils/gameReferences.test.ts -t "intervening prose keeps the anchored year and round"` | **1** | `2021.01.01` / round `9` retained as `unverified` |
| FIX1 after repair | same | **0** | 2 passed |
| FIX1 reverse production only | same | **1** | same contradiction retained; reversed hash = original `615df424…`; restored hash = final `71e915f5…` |
| FIX2 old producer | `vitest run …/TournamentCard.test.tsx -t "opening a linked tournament game carries the qualified locator"` | **1** | `createTab` called without `linked` |
| FIX2 after repair | same | **0** | 1 passed |
| FIX2 reverse production only | same | **1** | locator omitted again; reversed hash = original `52c8e4d5…`; restored hash = final `8ec6e4f5…` |
| focused `gameReferences` | `vitest run src/utils/gameReferences.test.ts` | **0** | 109 passed |
| focused `TournamentCard` | `vitest run src/components/databases/TournamentCard.test.tsx` | **0** | 10 passed |
| types | `pnpm exec tsgo --noEmit` | **0** | |
| oxfmt | scoped `--check` | **0** | |
| oxlint | scoped `--deny-warnings` | **0** | |
| diff check | `git diff --check` on scoped files | **0** | |

No source or test reversal remains. Production files match the restored final hashes.

## Limits
No full pre-review, browser snapshots, or native journey in this leaf. Pagination/ownership TournamentCard tests still pass. Shared original-game admission coverage was not duplicated. Confidence: 92.

````


## Code closure R4 and new confidence repair

R4 reviewed9aa9bd2f..70199ec1 with fulle14a8547..70199ec1 context. Seven canonical Grok read-only leaves completed, each profile LEAF commands7 and every complete raw report read. Six APPROVED, correctness REVISE. DR1,DR10 andDR11 are explicitly CLOSED. That closes all11 earlier adopted code/record issues. This does not approve the candidate, because R4 adopted3 new issues.

DR12 Fix, correctness blocker confidence93 at src/utils/gameReferences.ts208. The R3 combined-prefix exception promotes an ambiguous shorter header prefix to verified after intervening prose. Exact supplied2020(A) and round-only(A) counterexamples and their original full reports are below. This is a correction-created false-certainty regression in28e4b71a, parentDR1/f-20261029-13, canonically filed asf-20261030-02 inb53517cd. It differs from the now-closed missing-constraint bypass. Technical resolution under the existing uncertainty contract: retain applicable original constraints and otherwise compatible candidates, but require explicit choice when multiple complete readings leave the boundary unresolved. A candidate's own matching combined prefix alone is insufficient certainty. Single unambiguous readings still verify. No new product policy or parser framework is authorized.

DR13 Fix, minimalism nit confidence82 at TournamentCard.test.tsx89. Reuse the real runTabCreation instead of copying its operation into a synchronous mock, keeping the admission spy and shared seed real. This removes duplicated protocol and preserves asynchronous behavior.
DR14 Fix, code-quality nit confidence84 at gameReferences.ts208. Name the matched-header predicate accurately rather than invert an anonymous conjunction. A matching prefix and a certain citation boundary are distinct.

Code adoptions r1=9 r2=0 r3=2 r4=3. Four completed rounds,14 unique adopted issues,11 CLOSED and3 pending repair/closure. No Skip or Defer. DR1 supplied rework remains separate from the new independent DR12 adoption. Plan10 rounds and its3 unique closed issues are unchanged. This is implementation correction within the existing ambiguity obligation, no changed mandate or plan premise.

R4 measured wall from packet generation through this arbitration checkpoint is717.3s, including report extraction, root source inspection and immediate canonical filing. Active review wall is unknown, parallel durations are not summed. No quota wait or writer rollover. Installed kite759a67b includes49bd7587 fixing the earlier Grok read-only launch failure. R4 used the real selected Executor Grok, not native fallback. Detection and the R3 repairs share xAI family. Original feature/root are OpenAI. Plan authorship and arbitration shared one root context. No whole-range family separation is claimed.

Root independently confirmed the record lens's ignored JSON counts6 and13 from the retained raw mutation reports and the installed kit identities from the immutable release. Live hosted state and final installed app proof remain pending. f-20261011-03 and f-20261022-05 remain open. This R4 record and its raw reports are known before final gates. The new canonical filingb53517cd occurred after the frozen R4 candidate and belongs to R5 records closure, never claimed reviewed by R4.

### R4 complete raw reports

## correctness

DR1 CLOSED for the R3 supplied complete-prefix inputs. `metadataVerification` no longer returns early `unverified` when `prefix.text === "${event} ${site}"` and a later dated round sits in ordinary prose. For `Tata Steel (A) Wijk aan Zee 2022 (3) Better was Bd3 in 2024 (A).` and the same form without `in`, remaining starts at `2022 (3)`, `continuation` is absent, the new guard is skipped, and `referenceFieldsVerification` runs on that anchored tuple. Date `2021.01.01` round `9` is `rejected`. The matching 2022/3 original is `verified`. Adjacent `2022 (3) 2024 (A)` still uses the competing-reading arm at `gameReferences.ts:194`. Known-site `siteFollows` still wins before the new guard.

The same guard is the complete-prefix test, including a candidate whose full event+site is only a shorter prefix of the citation. That is a wrong result the repair introduces.

[blocker] src/utils/gameReferences.ts:208 — For citation `0-1 Beerdsen,T-Bluebaum,M Tata Steel Wijk aan Zee 2020 (A) Better was Bd3 2022 (3).` and candidate event `Tata Steel`, site `Wijk aan Zee`, date `2020.01.01`, round `A`, the selected prefix is the candidate’s full combined headers, so the new `prefix.text === \`${event} ${site}\`` exception skips the later-tuple unverified return. `anchored` is `2020 (A)`, `afterRound` is `Better was Bd3 2022 (3).` (no immediate `continuation`), and the function verifies on `2020 (A)` only. The later `2022 (3)` is treated as incidental prose. The same short combined year-round row without that prose is retained `unverified` (`gameReferences.test.ts:651`, `retained[0] === true`) because adjacency still competes. The contract forbids a shorter matching header prefix from establishing a closing round, and parenthesized or year-round header extensions must not hide later supplied constraints. This candidate is therefore auto-opened as `verified` when it must remain an unverified choice. The same promotion happens for `Tata Steel Wijk aan Zee (A) Better was Bd3 2022 (3).` with date `2021.01.01` round `A`. (confidence: 93)

TournamentCard now spreads `databaseGameSeed(game, file)` into `createTab`. That seed still passes `linked: game.linked ?? undefined`, and `createTab` still forwards `gameOrigin.linked ?? null` to `resolveLinkedGame`. No caller/callee mismatch on that path.

Detection shares the xAI family that wrote the R3 repairs. Plan authorship and arbitration remain the root context. Pending final gates are not treated as passed.

VERDICT: REVISE

## root-cause

DR1 CLOSED. The R3 failure was `metadataVerification` at `src/utils/gameReferences.ts:206-215`. After a complete event+site prefix, an anchored `2022 (3)` was followed by ordinary prose containing a later dated round. `continuation` was absent, so the old `afterRound` dated-round check returned `unverified` before `referenceFieldsVerification` ran. A candidate dated `2021.01.01` with round `9` was therefore retained for choice even though the original fields were identifiable. `28e4b71a` keeps that early return only when the matched prefix is not the complete combined event+site header. With that header the anchored fields fall through to the shared date/round comparison at `src/utils/gameReferences.ts:221`. The later prose tuple stays incidental.

The new cases at `src/utils/gameReferences.test.ts:994` cover both supplied prose forms. They reject `2021.01.01`/`9`, later-only `2024 (A)`, and partial original conflicts. They verify the matching original and keep unknown actual date/round as explicit choice. Adjacent competing tuples at `src/utils/gameReferences.test.ts:918`, known-site later fields at `src/utils/gameReferences.test.ts:874`, and bare-year prose at `src/utils/gameReferences.test.ts:810` still use their earlier branches. `git blame` shows `8347afa2` introduced the too-broad early return with the competing-reading repair. This delta narrows that return. It leaves the adjacent-tuple comparison, the bare-year `verified = false` path, and shorter-prefix unresolved-header returns in place. There is one matcher. Root reverse/restore evidence in the assignment matches this producer: old code kept incompatible `2021`/`9` as unverified, restored bytes went green.

DR10 CLOSED. Linked tournament rows already carry locators from `query_games` through `getTournamentGames`. `createTab` at `src/utils/tabs.ts:571-575` forwards `gameOrigin.linked` into `resolveLinkedGame`. Native `resolve_game` at `src-tauri/src/db/linked_collections.rs:3318-3328` returns `StaleGame` when that locator is missing. TournamentCard built a database origin with only `kind`, `database`, and `gameId`, so the locator never reached admission. It now spreads `databaseGameSeed(game, file)` at `src/components/databases/TournamentCard.tsx:167`, the same helper as `GameTable`, `GamesTable`, and `GameReference`. That helper copies `game.linked`. Component tests at `src/components/databases/TournamentCard.test.tsx:332` observe `createTab` receiving the locator on a linked row and omitting it on a standalone row.

DR11 is a records annotation of `f-20261011-03`. This lens has no code-cause judgment for it.

No new cause-level defect in the repair or in the other three seed callers. This leaf did not rerun tests. Closure rests on the source path, the added assertions, blame/history, and the supplied producer reverse/restore.

VERDICT: APPROVED

## minimalism

DR10 CLOSED. `TournamentCard` is the fourth database-game opener and now calls the shared `databaseGameSeed` helper. Clicking Open spreads that seed into `createTab`, then `runTabCreation` still navigates on success and reports errors. `createTab` still resolves `gameOrigin.kind === "database"` through `tauri.resolveLinkedGame(..., gameOrigin.linked ?? null)`.

Callers of `databaseGameSeed`:
- `src/components/common/GameReference.tsx:52`
- `src/components/databases/GameTable.tsx:74`
- `src/components/panels/database/GamesTable.tsx:47`
- `src/components/databases/TournamentCard.tsx:167`

`kind: "database"` is built only in `src/utils/databaseGame.ts:15`. The inline tab name, PGN, headers, and origin object are gone from `TournamentCard.tsx:164`. Linked rows pass `game.linked`. Standalone rows omit it (`linked: game.linked ?? undefined`).

The component tests click the real Open control and assert `createTab` arguments from that helper, including the standalone origin.

The DR1 source change is the complete event-plus-site prefix falling through to `referenceFieldsVerification`. No new helper, parser, or module.

[nit] `src/components/databases/TournamentCard.test.tsx:89` — the `runTabCreation` mock repeats the existing try/create/success/error shape in `src/utils/tabs.ts:531`. Spying `createTab` and keeping the real `runTabCreation` would observe the same seed. (confidence: 82)

The smallest production repair for DR10 is the spread that shipped. The new reference tests and the two tournament opening cases are the named DR1 and DR10 coverage.

VERDICT: APPROVED

## tests

DR1 CLOSED. `src/utils/gameReferences.test.ts:994` (`intervening prose keeps the anchored year and round`) drives both supplied forms (`Better was Bd3 in 2024 (A).` and `Better was Bd3 2024 (A).`) through real `lookupGameReference` and rendered `lookupUI`. `querySensitiveSource` only pages games. Metadata still runs in `referenceGameVerification`. Restoring the old `afterRound` year-round early return at `src/utils/gameReferences.ts:206` makes `verification: "verified"` at line 1042 fail, auto-open `admission.create` at line 1049 fail, and the empty-candidate checks at line 1024 fail for `2021.01.01`/`9` and for later-only `2024`/`A`. Missing `????.??.??` / `?` still asserts an explicit `GameReferences.Choose` open. Adjacent tuples, known-site later fields, shorter prefixes, and bare years stay on their earlier tests. Vitest includes `src/**/*.{test,spec}.{ts,tsx}`.

DR10 CLOSED. `src/components/databases/TournamentCard.test.tsx:332` clicks the real `TournamentCard` actions column. `databaseGameSeed` is unmocked. `createTab` is the admission spy. Dropping `linked` from that caller makes `gameOrigin.linked: locator` at line 340 fail. The standalone case at line 351 asserts `gameOrigin.linked ?? null` is null. Shared `createTab` → `resolveLinkedGame` remains in `GameTable.test.tsx` and `GamesTable.test.tsx`.

DR11 is a records annotation. This tests lens does not close it.

No blocker in this class. Central revert anchors exist for both source repairs. Fresh `pnpm verify:app` / final scheduler were not rerun here.

VERDICT: APPROVED

## code-quality

DR1 CLOSED for this class. In `metadataVerification` (`src/utils/gameReferences.ts:206-219`) the rewritten early-return comment matches the remaining unresolved-header and `siteFollows` path, and the fallthrough comment states that a complete event/site prefix keeps the anchored year/round while a later prose tuple is incidental. The new tests are titled `intervening prose keeps the anchored year and round`. Docs `docs/game-references.md:11` use the same examples as the tests.

DR10 CLOSED for this class. `TournamentCard.tsx:167` spreads `databaseGameSeed(game, file)` in the same shape as `GameTable.tsx:74` and `GamesTable.tsx:47`. The new tests name the shared seed and the standalone origin.

DR11 is the records class. This lens does not close it.

No new unlabeled literals, dead paths, stale comments, or undocumented suppressions in the repair. `"a".repeat(64)` and the `locator` fixture match `GamesTable.test.tsx:46-51`. Import order of `databaseGameSeed` matches `GamesTable.tsx`.

[nit] src/utils/gameReferences.ts:208 — the complete event/site prefix is an inverted anonymous conjunction (`!(prefix && event && site && prefix.text === \`${event} ${site}\`)`) beside the named `siteFollows` in the same branch. A next reader inverts that conjunction to see the fallthrough that keeps the anchored year/round. Adjacent comments restate both sides (confidence: 84)

R4 detection shares the xAI family with the R3 repairs. No tests were run.

VERDICT: APPROVED

## records

DR11 CLOSED. Canonical annotation `39f9c671` at `tasks/findings.md:16814` withdraws the earlier “citation task changes no engine or Rust source” sentence at `:16811` for the final range, names `cfg(test)` warm-transition observation and fixture helpers in `src-tauri/src/chess.rs` at `7237a6c2`, keeps production engine behavior and readiness/quit/reap deadlines unchanged, keeps all ten matrix cases, and leaves broader `f-20261011-03` open (`Status: open` at `:16758`). `7237a6c2` touches only `src-tauri/src/chess.rs` inside `#[cfg(test)] mod tests` (`:1698`). The ten cases are `2×{exact,all,release}` plus `2×{exact,all}` silent (`:4163–4176`). Historical hosted observation and the original sentence remain standing. Mutation receipts are present. This is the records correction only.

DR1 and DR10 stay outside this class. Findings `f-20261029-13` and `f-20261030-01` remain `Status: open`. The dated R3 annotation at `tasks/findings.md:19171` is a preserved R3 snapshot. Later handoff text at `tasks/handoffs/2026-10-29-opening-game-references-review.md:2669` supersedes it with implemented pending R4 reviewer closure. Current source matches that later claim: complete event+site prefixes fall through to `referenceFieldsVerification` (`src/utils/gameReferences.ts:206–221`), intervening-prose tests exist at `src/utils/gameReferences.test.ts:994`, `TournamentCard` calls `databaseGameSeed` (`src/components/databases/TournamentCard.tsx:167`), four seed callers share that helper, `tabs.ts:572` passes `gameOrigin.linked ?? null`, and `linked_collections.rs:3291` / `:3318` refuse a missing locator with `StaleGame`. `search.rs:930` still qualifies query rows.

Lineage checked and matching: plan r1=1 r2=0 r3=1 r4=0 r5=0 r6=1 r7=0 r8=0 r9=0 r10=0, three unique plan issues. Code adoptions r1=9 r2=0 r3=2, eleven unique. DR2–9 closed in earlier reviewed history. Matcher SHA256 `71e915f5…`, TournamentCard SHA256 `8ec6e4f5…`. Gate `gate-code-r3-root-proof.oWbbXT` exit 0 at `c04e20cd` with six dirty paths. Related 26 files / 1300 tests. Focused counts 109 and 10. Frontend-build `7185.5 ms`. Mutation tables 77 killed, 1317 killed + 2 timeout, 193 killed + 7 timeout, 0 survived, 0 errors. Memory.max `19327352832`, peak `7781748736`, oom counters 0. `d-20261029-34`/`35` current native, `33` superseded by `35`, `31` tablebase, `d-20261030-01` planned and unexecuted. `docs/game-references.md:11` matches the repaired incidental later-tuple rule. Final container, `pnpm build`, `pnpm verify:app`, clean Rust/frontend scheduler, hosted jobs and install remain pending. `f-20261011-03` and `f-20261022-05` remain open.

Unverifiable here: persistent owner `3169465`, kit SHAs `49bd7587`/`e759a67b`, live hosted job state, exact ignored-mutant JSON counts 6 and 13.

No records findings.

VERDICT: APPROVED

## chess-semantics

DR1 CLOSED. For `0-1 Beerdsen,T-Bluebaum,M Tata Steel (A) Wijk aan Zee 2022 (3) Better was Bd3 in 2024 (A).` and the same citation with `Better was Bd3 2024 (A).`, `metadataVerification` at `src/utils/gameReferences.ts:206` keeps the complete event/site prefix `Tata Steel (A) Wijk aan Zee` and does not return early. Control falls through to `referenceFieldsVerification` of the anchored `2022 (3)` at `src/utils/gameReferences.ts:221`. A candidate dated `2021.01.01` round `9` is rejected. A candidate dated `2024.01.01` round `A` is rejected. The matching `2022.12.01` round `3` game is `verified` and auto-opens through existing `createTab` admission. Missing date/round stay `unverified` choice. Adjacent `2022 (3) 2024 (A): Better was Bd3.` still takes `src/utils/gameReferences.ts:194` and remains an unverified choice. Tests at `src/utils/gameReferences.test.ts:994` cover both prose forms, including lookup and UI admission.

DR10 CLOSED for this class. `TournamentCard.tsx:167` now spreads `databaseGameSeed(game, file)`, which sets `gameOrigin.linked` from `game.linked`. `createTab` at `src/utils/tabs.ts:572` passes that locator into `resolveLinkedGame`. Native `resolve_game` at `src-tauri/src/db/linked_collections.rs:3318` refuses `None` with `StaleGame`. A matching locator reads original PGN bytes and `parsePGN(linked.game.pgn)` at `src/utils/tabs.ts:578` builds the tree from that text, so FEN, headers, NAGs, comments, and variations such as `1. e4 $1 (1. d4 d5) e5` stay on the existing linked admission path. Standalone rows keep ordinary database origin.

DR11 is outside this class. The unpublished `src-tauri/src/chess.rs` change is a `cfg(test)` warm-transition helper. It does not alter in-memory tree, FEN identity, paths, or ply.

No FEN truncation, stale path, ply-parity, `children[0]` continuation, or header/tree drift remains in the repair or the admission it now shares.

VERDICT: APPROVED


### Preserved opening provenance before the explicit executor change

``````text
Plan authorship and arbitration shared one context. Implementation and detection ran in separate Codex sessions on the same OpenAI model family. Family separation was absent. Main writer and resumed substantive corrections used gpt-6.1-sol high. Detection uses the selected Codex read roles. Round 5 used review-plan for the plan lens and normal read for correctness and tests. Per-lens effort for r1-r4 is not independently reconstructed here. Exact bounded presentation and proof-entry corrections used gpt-6-luna max. Root owns proof, triage and release.
``````

