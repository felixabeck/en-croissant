# Review record — f-20260911-02

## Mandate and scope

`f-20260911-02`: an unscoped Stop must not select pending admission G2 and leave live actor G1 searching. The fixed design question was whether Stop targets the actor, admission, or both. The chosen contract targets both identities captured for the key; explicit generation calls remain exact, and later generations survive an older Stop. The implementation changes only `src-tauri/src/engine/process.rs`. Other engine findings remain in the ledger.

Plan authorship and arbitration shared one context. Detection ran on the same model family as the code (Codex executor and Codex lenses); model-family separation was absent. The plan was reviewed before implementation. The durable record is this file; the ignored working plan was `tasks/plans/2026-09-27-unscoped-engine-stop.md`.

## Plan review

Round 1 reviewed the plan before code. `review-plan`: `VERDICT: APPROVED`, no findings. `review-engine-protocol`: `VERDICT: APPROVED`, no findings. `review-tests`: `VERDICT: APPROVED` with P1, should-fix, confidence 90: the `stop_generation` test filter could omit new tests if their names did not match. **Fix:** require the `stop_generation_` prefix for every new test. MANDATE dependency: the regression proof must run the tests it claims to cover. The proposed change does not expand scope.

Round 2 reviewed the corrected verification obligation and the unchanged dependencies. The exact semantic delta was the `stop_generation_` naming requirement; the phase command stayed `cargo test --manifest-path src-tauri/Cargo.toml --all-targets --locked -- stop_generation`. `review-tests`: `VERDICT: APPROVED`, P1 closed at revision 2. `review-plan`: verified P1 but returned `VERDICT: REVISE` for P2, blocker, confidence 99: the correction packet omitted the verbatim `ROUND`/`DELTA`/`REVISED`/`SETTLED` script output. **Fix:** send the exact `plan-review-delta.py` output and the complete delta; an evidence-only check at the same revision returned `VERDICT: APPROVED`, P2 closed. No further plan revision, rewrite, split, or successor. Adoption counts: r1=1 r2=0. Unique issues opened/resolved: 2/2. Review elapsed and non-overlapping wait times were not separately measured; no quota wait is known.

The round-2 script classified `Approach > Verification` as REVISED; Goal, Stop ownership, Failure and concurrency semantics, Decisions, Risks, Not part of task, and Phase 1 as SETTLED. The corrected requirement affects proof selection only. P1 and P2 both have explicit closure; open plan issues: 0.

## Phase and cumulative diff review

The Codex sensitive-path phase produced the supervisor diff and four focused tests. The orchestrator found an exact-generation regression before its phase commit: a matching admission created while Stop waited for `registration` would be missed by the initial snapshot. The same executor resumed and restored the post-registration lookup for exact stops, with a fifth test. The orchestrator reran the five-test proof, formatting check, and all-targets check. Phase commit: `84160615`.

The cumulative diff review covered `b824629d..84160615` with six read-only lenses. Raw verdicts and findings:

| Lens | Raw verdict and finding | Arbiter |
| --- | --- | --- |
| `review-correctness` | `VERDICT: APPROVED`; no finding. | Skip: no defect reported. |
| `review-root-cause` | `VERDICT: APPROVED`; no finding. Limitation: the failing-before case was reasoned from the old branch and new assertion, not run by the lens. | Skip: direct test reasoning supports the regression anchor. |
| `review-engine-protocol` | `VERDICT: APPROVED`; no qualifying finding. | Skip: no defect reported. |
| `review-error-handling` | `VERDICT: APPROVED`; no finding. Stop and terminate errors remain combined and propagated. | Skip: no defect reported. |
| `review-tests` | `VERDICT: APPROVED`; should-fix, confidence 88, at `process.rs:6155`: `yield_now()` did not prove Stop captured G1 before G2 was inserted, so the replacement test could be flaky. | Fix: first-poll the Stop future while registration is held, require `Poll::Pending`, then insert G2. |
| `review-code-quality` | `VERDICT: APPROVED`; nit, confidence 99, at `process.rs:1403`: the captured-admission filter was a no-op because its generation was already in the target set. | Fix: remove the filter. |

Focused read-only closure checks on the final diff returned `VERDICT: APPROVED` for both fixes. The test lens confirmed that `Poll::Pending` is reached only after the G1 snapshot and at the held registration lock. The quality lens confirmed the filter removal preserves exact and unscoped semantics. Orchestrator reran the five-test proof and formatting check. Repair commit: `7d74564c`. No review finding remains open. No out-of-area finding was discovered or filed by this run.

## Verification and delivery

The five focused supervisor tests passed after the repair. `pnpm build` passed. `pnpm verify:app` passed all checks, including launch, real IPC, and shutdown within its budget in the Tauri window. It cannot register a live engine through its native picker; the targeted supervisor tests are the direct proof for this Stop race. Final gate and push results belong in the run completion report and Git history after this handoff is committed.

## Raw lens findings and closure text

Round 1 plan lens: `No findings. VERDICT: APPROVED`. Round 1 engine lens: `VERDICT: APPROVED`. Round 1 tests lens: `[should-fix] tasks/plans/2026-09-27-unscoped-engine-stop.md:40 — The stop_generation filter selects test names, but existing supervisor tests use names such as broad_stop_*, generation_stop_*, and exact_stop_*. The plan does not require the new regression and race tests to include stop_generation, so this command could omit them. Name the tests to match the filter or select them explicitly. (confidence: 90) VERDICT: APPROVED`.

Round 2 tests lens: `P1 closure: closed for revision 2. The plan requires every new test name to start with stop_generation_; the phase proof filters on stop_generation, so it selects the planned regression and race cases. VERDICT: APPROVED`. Round 2 plan lens: `P1 closure on r2: verified. [blocker] plan review record — The round 2 packet lacks the required ROUND/DELTA/REVISED/SETTLED block. Since the plan records a prior review, the review contract requires reporting this gap and bars scoped approval without that block. (confidence: 99) VERDICT: REVISE`. Same-revision evidence check: `P1 closure remains verified at r2. P2 is closed: the packet supplies the required round-2 block, and its REVISED entry matches the Verification change in the complete delta; the remaining listed obligations are settled. VERDICT: APPROVED`.

Final code lenses: correctness `No correctness defects found ... VERDICT: APPROVED`; root cause `No root-cause finding ... the old code cancels G2, leaves G1 registered, and fails the assertion that G1 was terminated ... VERDICT: APPROVED`; engine protocol `No qualifying findings ... VERDICT: APPROVED`; error handling `The changed shutdown path preserves failures ... VERDICT: APPROVED`; tests `[should-fix] process.rs:6155 — yield_now() does not guarantee the stop task has captured G1 before the test inserts G2. If the stop task runs afterward, it captures and terminates G2, making this race test fail intermittently. Add a synchronization signal that confirms target capture before inserting the replacement. (confidence: 88) VERDICT: APPROVED`; code quality `[nit] process.rs:1403 — this filter is always a no-op: an unscoped stop adds the captured admission’s generation to target_generations immediately above, while an explicit-generation stop has no captured admission. Remove the redundant filter to clarify the snapshot logic (confidence: 99) VERDICT: APPROVED`.

Focused closures: tests `Closed ... A Poll::Pending therefore means the stop future passed its target snapshot and reached the held registration lock. G2 is inserted only after that poll ... VERDICT: APPROVED`; quality `Closure verified ... uses the captured admission directly; its generation was already added to the unscoped target set ... VERDICT: APPROVED`. These are preserved as report text; source links and expanded explanations were omitted here because the file and issues are named above.

The records lens then returned `VERDICT: REVISE` with one should-fix, confidence 99: the handled finding still carried its historical `**Open question:**` wording. The arbiter kept that filed text under the append-only contract and appended an explicit `**Open question resolved:**` note through `findings.py annotate`. Its focused closure check returned `VERDICT: APPROVED`, confidence 98: no active-state contradiction remains. The lens could not independently verify historical run claims from the supplied committed range; the proof log is `/tmp/build-f-20260911-02-20260927/verify-app.log`, and the Codex executor proof is `/tmp/build-f-20260911-02-20260927/phase-1-fix-1.txt`. These scratch paths are run evidence, not durable handoff dependencies.
