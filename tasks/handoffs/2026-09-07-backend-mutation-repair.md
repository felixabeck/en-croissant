# Backend mutation repair: delivery evidence and remaining authority finding

Delivered and installed code: `f8df0140e6a99242de35100c2f4160a81fa0db45`, on `origin/master`.
The installed `VERSION` records reviewed provenance. This was an ordinary push and local
installation, with no release or deployment. Findings f-20260907-01, -02 and -03 are repaired.

## Scope and implementation

The two implementation phases ran sequentially through bounded Codex Sol/medium workers.
Phase 1 adds five PGN regression groups over shared LF/CRLF and BOM/no-BOM fixtures, checking
exact byte ranges and extracted bytes or InvalidData. Phase 2 replaces all three unbounded
iterator collections with bounded next/None assertions, adds empty/single termination cases,
and contains Linux encoding mutation test executables with existing prlimit: 2 GiB address
space and core limit zero. Command-line native target and exact target runner override ambient
Cargo configuration. A shared Rust host parser preserves pinned coverage behavior. Tool setup
and unmodified baseline failures fail closed; caught and unviable output is enabled.

The completed first candidate exposed the piped-core-collector gap recorded independently in
fe077430 as f-20260907-03. A Sol/medium follow-up adds checked PR_SET_DUMPABLE suppression after
exec, only in explicitly selected Linux encoding tests. Ordinary test/app crash collection
remains unchanged. Four earlier allocation aborts were confirmed, not just the original two
recorded observations. Decisions d-20260907-01 and -02 retain the rationale and reversal paths.
The historical CI runner-shutdown cause remains unproven.

Production parser behavior, public APIs, database format, UI, mutation filters, timeout policy,
and coverage floors are unchanged. The separate path-authority finding below remains open.

## Verification

Root independently ran the focused PGN suite (25 passed), encoding suite (15 passed), mutation
runner suite (48 passed) and coverage-report suite (27 passed). Full affected gates passed:
Rust formatting, all-target locked check, clippy with warnings denied, backend tests (724 passed,
one existing ignored), backend coverage and its unchanged ratchets, `pnpm gates:contract:check`,
kit synchronization and clean-diff checks. Clean-tree final proof: scratch directory
`contained-final-gates.Ni42UF`, exit zero.

The dependency-free Cargo fixture proves actual executable limits despite conflicting file and
environment target/runner configuration. Refusal tests cover missing/broken tools, host failures,
setup signals and baseline failure; existing cancellation, child cleanup and fence tests pass.

The real Cargo/prlimit protected abort emitted PID 2322402 and dumpability zero, then retained
the diagnostic and SIGABRT (Cargo exit 101). Its systemd journal query returned no core event.
A full contained baseline passed 15 tests: ordinary child 2492680 was dumpable (1), protected
child 2492706 was non-dumpable (0) and aborted, with no core event. The worker probe 2252015
likewise produced no core event. Child stderr is forwarded before status assertions.

Final local mutation commands ran serially in a clean detached clone at f8df0140 with its own
build output and prepared frontend assets. Both baselines passed and every mutant was accounted:

| Package | Mutants | Caught | Unviable | Test timeouts | Survivors |
| --- | ---: | ---: | ---: | ---: | ---: |
| pgn-parser | 64 | 61 | 1 | 2 | 0 |
| database-encoding | 96 | 91 | 4 | 1 | 0 |

The final run produced zero new core journal events for the candidate executable. All four
allocating decoder mutations retained allocation errors and SIGABRT and were caught. Timeouts
are the existing non-advancing test loops: PGN 263:5 and 306:18, encoding 111:16. Source and fence
cleanup completed. An earlier interim encoding attempt was intentionally stopped for review
fixes, recorded as interrupted, and replaced by complete final runs; it is not completion evidence.

## Delivered CI: every job and artifact inspected

[Mutation run 34082891426](https://github.com/felixabeck/en-croissant/actions/runs/34082891426)
ran at exactly f8df0140. Discovery and all eight package jobs completed; none was interrupted.
Every baseline succeeded. Each artifact contains a terminal report, the full enumerated mutant
inventory, exactly one outcome per mutant plus baseline, and consistent accounting.

| Package | Mutants | Caught | Unviable | Test timeouts | Survivors | Job |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| database-encoding | 96 | 91 | 4 | 1 | 0 | Success |
| database-search | 36 | 36 | 0 | 0 | 0 | Success |
| engine-protocol | 1 | 1 | 0 | 0 | 0 | Success |
| download-policy | 23 | 23 | 0 | 0 | 0 | Success |
| game-rules | 84 | 81 | 3 | 0 | 0 | Success |
| path-authority | 19 | 15 | 0 | 0 | 4 | Failure |
| lexer | 10 | 8 | 2 | 0 | 0 | Success |
| pgn-parser | 64 | 61 | 1 | 2 | 0 | Success |

The workflow conclusion is **failure**, exclusively for the four path-authority survivors.
All six PGN names missed by original run 34020549919 are explicitly caught in this delivered
artifact. Encoding logs confirm the native prlimit runner, all 15 baseline tests, four allocation
aborts and the genuine validator test timeout. All three timeout logs were inspected.

Scratch evidence root: `/tmp/build-backend-mutation-20260907.sYCKNG`.
Final local reports are under `candidate/mutants.out/backend/`; local wrapper is
`contained-mutation-proof.JWXEfL` (exit zero). All eight downloaded CI artifacts are under
`ci-artifacts/<package>/mutants.out/`; `ci-run.json`, `ci-artifacts.json` and `ci-failed.log`
retain job, artifact and failure evidence. GitHub artifacts are the remotely retained source.

## Review and arbitration

Seven initial Luna/xhigh read-only lenses covered correctness, root cause, tests, minimalism,
error handling, PGN index semantics and code quality. Five code findings were fixed, the
root-cause mutation-evidence obligation was fulfilled, and a duplicate non-encoding selector
fixture was skipped: the changed branch already had direct coverage and the real PGN run
verified its unchanged selector/accounting.

Four follow-up Luna/xhigh lenses covered correctness, root cause, tests and error handling.
The stderr-ordering finding was fixed. A claimed blocker that ordinary exec preserves
dumpability zero was refuted by the actual contained Cargo baseline and its ordinary child
reporting one. The requested no-core-event and complete-accounting proof was fulfilled.

Plan authorship and arbitration shared one context; detection ran on the same model family
as the code. The user supplied the prior account session plan review and its target-bypass,
package-selection and shared-parser corrections; its original round counts were unavailable
and have not been invented.

## Follow-up handoff: f-20260907-04

Goal: close the four path-authority survivors without weakening authority semantics, mutation
selection or coverage floors. Read the repository AGENTS.md and CLAUDE.md, applicable async,
persisted-state and engine rules, the finding and its cited artifacts before changing code.
The sensitive boundary requires the normal build/push review contract, including correctness
and root-cause review and applicable authority/security lenses.

Key path: `src-tauri/src/infra/path_authority.rs::validate_persisted_shape`, around lines
5530-5568 at f8df0140. Survivors change the legacy-engine conjunction (5544:13), engine-purpose
equality (5543:37), rejection disjunction (5558:13), and legacy-engine negation (5558:17).
Trace acceptance through persisted-entry loading and distinguish canonical, historical-subset
and exact legacy-engine operations from mismatched purposes and shapes. A production defect
has not been established solely by these survivors. This function and package selection were
not changed by the PGN/encoding repair.

Proof: focused `infra::path_authority::tests`, all affected Rust and contract gates, then a
complete isolated `BACKEND_MUTATION_PACKAGE=path-authority pnpm mutation:backend` run with
successful baseline, complete accounting and zero survivors. Preserve other sessions and never
mutate the shared checkout concurrently with gates. No product decision is required.
