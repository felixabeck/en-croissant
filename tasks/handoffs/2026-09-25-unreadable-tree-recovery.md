# Unreadable tree recovery — review and delivery record

Finding: `f-20260924-03`. Decision: `d-20260925-09`. The reviewed plan is `tasks/plans/2026-09-25-unreadable-tree-recovery.md` (ignored run artifact). Plan authorship and arbitration shared one Codex context. Plan-review quota retries detected issues on Codex, the same model family as the code; the cumulative code review ran on Gemini, a different model family.

## Plan review

Seven completed rounds closed every plan issue. Round 1 opened R1-01 through R1-09: pending precedence, read-error default overwrite, close ownership loss, legacy ID detach, incomplete gate/copy proof, copy error proof, persisted-state rule conflict, a duplicate-decision wording suggestion, and an unrelated transposition fallback. R1-01 through R1-07 were fixed in revision 2; R1-08 was skipped because the autonomous-decision field is required; R1-09 was filed separately through the findings inbox. Round 2 closed those corrections and opened R2-01 through R2-03 (retry, corrupt-byte migration proof, empty-string case), fixed in revision 3. Round 3 closed them and opened R3-01 (same cached-store retry proof), fixed in revision 4. Round 4 closed R3-01 and opened R4-01/R4-02 (absent-key retry and refused-read discard), fixed in revision 5. Round 5 closed those and opened R5-01 (undecodable retry outcome), fixed in revision 6. Round 6 closed R5-01 and opened R6-01/R6-02 (real route wiring and pixel case), fixed in revision 7. Round 7 closed both. Raw reports: `/tmp/build-2049a568-6411-42a1-b116-cb0ad1230e55/lens-*-rN.codex-retry/lens-*-rN.txt`.

## Cumulative review

Reviewed range: merge base with `origin/master` through all ahead commits, including pre-existing drain commits `4781829b` (findings inbox merge) and `155764b5` (decision record). Those records matched their ledger purpose and produced no finding. Eight named Gemini lenses completed with profile checks; raw reports: `/tmp/build-2049a568-6411-42a1-b116-cb0ad1230e55/lens-*-final.txt`.

| Origin | Finding and verdict | Resolution |
| --- | --- | --- |
| `4e4ce39a` | `Fix`: unreadable/unavailable `cloneDurable` silently admitted a clean duplicate; legacy repair retained a redundant unreadable source; reserved metadata could be mistaken for a copy target or orphan tree; duplicate cleanup error reporting. | `f856c72f`, `b4a78371` |
| `4e4ce39a` | `Fix`: dead `retryRead` and `parseLegacyTreeJson`, task-phase docstring, negative-path test gaps for seed/clone/copy/raw recovery. | `f856c72f` |
| `95746f0b` | `Fix`: align discard error tag, prove healthy/recovered close and duplicate failure. | `f856c72f` |
| Earlier tree code | `Fix`: unbounded annotation search, repetition at wrong append path, 50-move header update despite `changeHeaders: false`, annotation array in PGN, penultimate mainline path. | Separate commit `e91b1912` |
| `4e4ce39a` | `Skip`: inline the repository's unreadable-copy helper or raw-value guard. | Those are storage ownership and precondition boundaries; moving raw writes into the workspace or bypassing a checked recovery accessor reduces safety. |
| `95746f0b` | `Skip`: replace semantic recovery markup and contrast-tested button styling with sibling Mantine markup, or remove the defensive `not-read` close guard. | The current markup passed accessibility and screenshot checks; the guard protects ownership if hydration timing changes. |
| `4e4ce39a` | `Skip`: sweep all unowned undecodable session values. | A raw undecodable string cannot be identified as a tree rather than unrelated session data, so sweeping it risks deleting foreign data. |
| `4e4ce39a` | `Skip`: direct test of the flush blocker after `write()` already rejects the key. | The blocked write path and unchanged raw value are covered; reaching the flush branch requires an artificial invalid pending state. |

## Verification and limit

`pnpm lint:ci` passed; combined focused Vitest passed 244 tests; pinned `pnpm test:e2e:container` passed 19 scenarios. The one new screenshot is `e2e/tree-recovery.spec.ts-snapshots/tree-recovery-unreadable-tree-recovery.png`, recorded and compared only in the pinned container. `pnpm build` passed. `pnpm verify:app` passed real startup, IPC, practice, and migration checks, then timed out in the already tracked stale-PGN conflict-panel case `f-20260924-06`. This timeout does not exercise the new recovery panel. Native GTK chrome remains outside these verifiers.

Final affected push gates and upstream equality are recorded by the completing session after this handoff.
