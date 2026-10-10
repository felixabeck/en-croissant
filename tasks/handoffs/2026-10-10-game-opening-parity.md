# Game opening PGN variation counter correction

# R9 parser variation parity repair

Completed the bounded correction. The two owned files are changed and unstaged. The production change is exactly one argument in `innerParsePGN`: the recursive variation root now receives `prevNode.halfMoves` alongside `prevNode.fen`, replacing `node.halfMoves - 1`. The shared legal move parser and invalid-token continue policy remain intact.

## Scope and candidate

Root: `/home/felixb/Projekte/chessfable`.

Launch status was clean. Launch and final HEAD are `6d9bee59c776aaa0553dc537944a0c341d26def2`.

Changed paths:

- `src/utils/chess.ts`: one argument, one deleted line and one added line.
- `src/utils/tests/chess.test.ts`: `parseFen` import and eight added regressions. Existing tests remain intact.
- Scratch artifacts only under `/tmp/build-game-opening-3b67c3b9/r9-parity-proof`.

The disposable final candidate was derived with `git archive` from that exact HEAD, then received the two final owned files and a byte copy of the launch index. Its Git object lookup uses an alternate to the existing object store. There was no staging or commit. The actual candidate revision is the base HEAD plus `final-candidate.patch`, whose SHA256 is `8c87b967967ea4218276d4fa9919620e2342947036044acd9565f4497fd8e81f`.

Final source/test SHA256:

| Path | SHA256 |
| --- | --- |
| `src/utils/chess.ts` | `db9d702050b9c3a0a6e3ce5eeb469b7d3f73e4aa3bfaecaccfdd9a1a77606a1b` |
| `src/utils/tests/chess.test.ts` | `41a8c8795f5a32bee5b2c5d0b11824fdc9e12d6e3ad179e3c0513bd4bf0399bc` |

These identities are recorded in `candidate-revision.json`. Exact diffs are retained in `source-diff.patch`, `test-diff.patch`, `final-candidate.patch`, and `parity.repair.patch`. Final bytes are retained in `final-owned/`.

## Regressions and execution path

The tests call actual `parsePGN` with native-shaped header, SAN, parenthesis, comment, NAG and outcome tokens. The native lexer boundary is mocked. All tree construction, legality, FEN generation, public PGN export and annotation statistics remain real renderer code.

For a standard White start, skipped `e2e5` is followed by legal `d4 d5` in a variation and later legal `e4`. The expected child plies are `[1, 2, 1]`. For a custom Black start at fullmove 23, the analogous `d5 d4` variation and later `e5` must produce `[46, 47, 46]`. Tests assert exact legal FENs, independently parsed FEN turn/fullmove values, actual node counters, preserved starting/body comments, clock, NAGs and annotation colours.

Separate public `getPGN` assertions verify move numbers and ellipses for the whole tree and selected paths. Export options were read before fixing expectations. Custom-root expectations include the actual automatic `SetUp` and `FEN` headers. Whitespace normalization preserves numbers, parity, glyphs and metadata. Existing child order is preserved.

Two further controls cover accepted ordinary and nested variations from both standard White and custom Black fullmove-23 roots. They verify children, replies, legal FEN turn/fullmove agreement, counters and public export. These controls remain green under the fault.

Before editing, the enclosing parser/export APIs, root/counter creation and normalization, notation consumer, annotation statistics consumer and existing parser/export tests were opened. The four assigned domain rules, both review references, complete `lens-chess-semantics-r9.txt`, and complete `tasks/handoffs/2026-10-10-game-opening-round9.md` were read. The review references were read earlier in this same context. Full project CLAUDE.md was not loaded as context. Environment files were excluded.

## Exact proof

Executed in main and again after exact restoration in the disposable candidate:

```sh
pnpm test src/utils/tests/chess.test.ts src/utils/tests/chessops.test.ts src/state/store/tree.test.ts src/platform/errors.test.ts src/components/boards/BoardAnalysis.test.tsx src/utils/tabs.test.ts src/components/tabs/FileFreshnessGate.test.tsx src/components/tabs/TreeRecoveryGate.test.tsx src/components/panels/info/InfoPanel.test.tsx src/state/atoms.lifecycle.test.ts src/state/store/tree.hydration.test.ts
pnpm exec oxfmt --check src/utils/chess.ts src/utils/tests/chess.test.ts
pnpm exec oxlint --deny-warnings src/utils/chess.ts src/utils/tests/chess.test.ts
pnpm exec tsgo --noEmit
git diff --check
```

Every recorded proof/Git command uses `GIT_OPTIONAL_LOCKS=0`.

| Proof | Main result | Restored candidate result |
| --- | --- | --- |
| Exact test command | 604 passed, 11 files, exit 0 | 604 passed, 11 files, exit 0 |
| Scoped format check | exit 0 | exit 0 |
| Scoped lint, warnings denied | exit 0 | exit 0 |
| Typecheck | exit 0 | exit 0 |
| Diff check | exit 0 | exit 0 |

Full logs, argv/cwd/environment records and exit files are `main-proof.{tests,format,lint,types,diff-check}.*` and `parity.restored.{tests,format,lint,types,diff-check}.*`. Both completion JSON files certify immutable tracked bytes during proof. The initial focused parser run passed 70 tests, but acceptance uses the final full runs above.

## Discriminating source reversal

Only `parity.repair.patch` was reversed in the fresh disposable candidate:

```sh
git apply --check --reverse /tmp/build-game-opening-3b67c3b9/r9-parity-proof/parity.repair.patch
git apply --verbose --reverse /tmp/build-game-opening-3b67c3b9/r9-parity-proof/parity.repair.patch
pnpm test src/utils/tests/chess.test.ts
git apply --check /tmp/build-game-opening-3b67c3b9/r9-parity-proof/parity.repair.patch
git apply --verbose /tmp/build-game-opening-3b67c3b9/r9-parity-proof/parity.repair.patch
```

Both reversal and restoration checks/applications exited 0 with no offset relocation. The faulty production file equals the launch HEAD's `src/utils/chess.ts` exactly. Only this source file differed from the final candidate during the fault. All 235 tracked test/spec files remained byte-identical throughout fault and restoration.

The fault test command exited **1**, with **6 failed and 64 passed out of 70**. Direct assertion failures in `parity.fault.tests.log`:

| Assertion | Expected | Fault result |
| --- | --- | --- |
| White variation child counter | 1 | 0 |
| Black fullmove-23 variation child counter | 46 | 45 |
| White public PGN export | `1. d4! (1. e4) d5?` | `0... d4! (1. e4) 1. d5?` |
| Black public PGN export, after identical setup headers | `23... d5! (23... e5) 24. d4?` | `23. d5! (23... e5) d4?` |
| First mover's `!` annotation count, White fixture | 1 | 0 |
| First mover's `!` annotation count, Black fixture | 1 | 0 |

Exact FEN and parsed turn/fullmove checks passed before the counter assertion failed, demonstrating legal positions with incorrect counters under the reversal. The existing 62 tests and both new accepted ordinary/nested controls passed. This witness depends on real counters and export output, not parser invocation counts or replacement generations.

The restored candidate matched every final tracked-file hash before the full command and checks were rerun. All passed as recorded above. Commands, logs and exits are in `parity.reverse*`, `parity.fault.tests.*`, `parity.restore*`, and `parity.restored.*`. Fault source, diffs and before/after manifests are preserved.

## Integrity and preserved evidence

`final-integrity.json` and `final-integrity.log` report exit 0:

- 1,084 tracked paths hashed. Only the two owned paths changed. All 1,082 protected tracked paths remained identical to launch.
- Main HEAD stayed exact. Main raw index SHA256 stayed `1e93e7a0832aceceab47126259da047de8824e0c6fc97f8dbff860fea58a9682`. Main and candidate cached diffs are empty.
- Main final tracked bytes and restored candidate tracked bytes are identical. Source/test identities equal the frozen candidate revision.
- The copied candidate index refreshed stat metadata on 1,083 entries. Its final raw SHA256 is `77989a5a1a1bc7a0f055737c68900368afccfa9e0f8ac9d561e798c5522b0491`. All object IDs, flags, file modes and stage inventories remained equal, and index extensions remained equal. This is explicitly a disposable copied-index stat refresh, not byte-identical copied-index integrity. Raw launch/main/candidate index snapshots and stage inventories are retained.
- All 15,658 selected historical regular proof artifacts remained hash-identical. The historical manifest excludes disposable candidate/checkout/worktree directories, dependency/build/Git directories, symlinks and environment filenames. Prior proof artifacts were not rewritten.
- `r8-frozen-baseline-preservation.json` confirms that all seven returned R8 final source/test files matched R9 launch bytes. The five outside R9 ownership remain unchanged. The two owned files carry only this correction and regressions.

Launch/final identities, tracked/source/test manifests, raw index snapshots and diffs are retained under `identity-before.json`, `tracked-before.json`, `main*`, `candidate*`, `parity.fault*` and `parity.restored*`. Historical manifests are `historical-artifacts-before.json` and `historical-artifacts-after.json`.

## Limits and handoff

No scope deviation or blocker. The copied-index stat refresh is qualified above. Earlier frozen46 and R8 proof remain evidence for their former candidates. They were neither replayed here nor claimed identical to the R9 candidate.

This is renderer test evidence with a mocked native lexer boundary. No native execution, pixel verification, runtime acceptance, heavy gates or push is claimed. No skills, agents, staging, commits or push were used. Production outside the one recursive argument, existing tests, admission mechanism, verifier/driver, dependencies, budgets, coverage, snapshots, translations, configuration and records remain unchanged. The separate f-20260922-13 batch rollback/puzzle terminality obligation remains outside this correction.

Plan authorship and arbitration shared one context. Detection ran on the code's model family. Root owns actual pre-review after EOS, further gates/review, runtime and push.


Root read the complete report and both-file diff. Exact production change is the actual parent's existing halfMoves value, preserving child ordering and token skip policy. Counter, public export and annotation-colour reversal failures are accepted as discriminating outward/domain evidence. Main index/protected paths remain intact, copied-index stat refresh remains honestly qualified. Current604-test source proof is separate from previous596/frozen424 evidence. Root integrated pre-review, fresh correction closure, pixels/native14 and final push remain pending. Plan authorship and arbitration shared one context. Detection ran on the same model family as code.

## Actual root integration checkpoint

Root passes875 tests in15 suites, scoped formatting/lint/types/diff and actual pre-review build/bundle/coverage mapping/changed-file mutation/contract, all exit0. The immutable absolute receipt is /home/felixb/.claude/drain-state/chessfable-0a459a4f.d/gates-e838b3a7-7402-4e53-a614-eb2da79f3765/gate-r9-source-pre-review.IkreEY/completion.record, recording clean5b8c8da645e2b688471b68a19560846d587d8da1. Full transcript /tmp/build-game-opening-3b67c3b9/root-r9-source-proof.log. This supersedes only the pending root integrated pre-review state above. Fresh focused correction closure and pixels/native14/full gates/push remain pending. Four code lenses apply to the two-path counter delta: correctness, root cause, tests and chess semantics. Quality, minimalism, error handling, persistence and IPC have no new mechanism or failure surface in this one-argument correction, and their completed R9 closures remain enclosing context. A mechanical records lens covers the known coordination additions. Plan authorship and arbitration shared one context. Detection ran on the same model family as code.
