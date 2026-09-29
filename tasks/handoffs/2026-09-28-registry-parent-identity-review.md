# Registry parent identity (f-20260912-05) — plan review record

Scope: `f-20260912-05` — bind each persisted file entry in the path-authority registry to the
identity of the directory it was authorized in. Plan (ignored run artefact):
`tasks/plans/2026-09-28-registry-parent-identity.md`. This tracked record preserves the complete
issue and round history so that the plan, its snapshots and the lens reports under `/tmp` may
disappear. Decision: `d-20260929-01`.

## Lineage and run facts

* Picked by `/next-finding --pin f-20260912-05 full auto` in drain session
  `6f9c4b3e-8255-48b2-82b2-497c962dd7df` (drain run `fe3f6a25-fb43-4a79-b22a-8795670316d1`),
  2026-09-28. Entry tier `build` confirmed at revalidation (open design question, sensitive path);
  defect reproduced by reading: the symlink variant is already refused by the canonical-path
  comparison in `database_file_target`, the hard-link variant was not.
* Inherits W57 from `tasks/handoffs/2026-09-13-workspace-directory-enumeration-review.md`
  ("persisted child handles bind pathname + leaf identity only"). W57 is closed by this run.
* Orchestrator: Claude Code (Opus 5.5). Executor: Codex (`gpt-6-luna`; `review-plan` role for the
  plan lens, `sensitive` for every other lens and for the implementation phase). Plan authorship
  and arbitration shared one context; detection ran in separate Codex processes of a different
  model family.
* Four read-only locate probes preceded the plan (producers, consumers, persistence/migration,
  Windows helpers); they surfaced `resolve()` (via `resolved.rs`) as a consumer the finding did not
  name.
* Plan review: 7 completed rounds, no rewrite, no split, no pauses; run from about 01:40 to 02:40
  CEST on 2026-09-29 (per-round wall time not separately recorded; unknown). Lens sets: r1–r2
  seven (plan, minimalism, correctness, root-cause, tests, error-handling, tauri-security); r3 six
  (error-handling carried); r4 four; r5 three; r6 two; r7 three (plan, tests, correctness).
* `plan_adopted_per_round`: r1=11 r2=8 r3=7 r4=4 r5=2 r6=3 r7=0 (adoption counts). Unique issues:
  36 (P1–P36) plus inherited W57; 34 Fix, 2 Skip (P11, P12), 1 withdrawal (P7 by P19); 0 open.
  Correction-introduced defects: P7 (introduced by the r1 `refresh_entry` addition, withdrawn by
  P19); P23 (the r2 wording "stays Unavailable" contradicted P19); P25 and P33 (the r2/r3 explicit
  door list over-included puzzle); P29/P31 (the r3/r4 race and recovery cases assumed a
  non-root parent for root-parent children); P36 (r1's O4 did not account for the startup pass's
  early `continue` on canonical entries — an old-code fact the plan missed, not a correction).
* Final latest verdicts: plan r7, tests r7, correctness r7 APPROVED; tauri-security r4 APPROVED;
  minimalism r3 APPROVED; root-cause r3 APPROVED; error-handling r2 APPROVED.

## Issues

| ID | Issue | Witnesses (round: lens#finding) | Disposition | Correction / reason | Closed |
|---|---|---|---|---|---|
| W57 | inherited: persisted child handles bind pathname + leaf identity only | 2026-09-13 root-cause | Fix | this plan (O2.5, W57 race test) | r4 (tests r4), confirmed r7 |
| P1 | `None` passes → an unverifiable legacy entry resolves later through a hard link under a replacement parent (`resolve` ignores availability) | r1: plan#1, correctness#3, error-handling#1, root-cause#2, tauri-security#2, tests#2 | Fix | persistent file entry with `None` refused | r2/r3 |
| P2 | Windows DB registration reopened the parent by pathname though `ResolvedPath` retains it | r1: plan#2, correctness#4, root-cause#4, tauri-security#1 | Fix | `resolved.parent()` on both platforms | r3/r4 |
| P3 | installed-engine producer missed | r1: plan#3 | Fix | O2.4a | r3 |
| P4 | `promote_dialog` dedupe omitted | r1: plan#4, correctness#2, root-cause#3 | Fix | O4 | r2 |
| P5 | promotion must compare against the grant's picked parent | r1: correctness#1 | Fix | O2.1/O2.2 | r2 |
| P6 | download artifact attack untested | r1: plan#5, tests#3 | Fix | O5 | r3 |
| P7 | `refresh_entry` classification untested | r1: plan#6, tests#4 | Withdrawn | behaviour removed by P19 | — |
| P8 | `serde(default)` serializes `null` | r1: plan#7, correctness#5 | Fix | `skip_serializing_if` | r2 |
| P9 | W57 ordering (swap between enumeration and registration) untested | r1: tests#1 | Fix | O5 | r2 |
| P10 | no Windows attack test | r1: tests#5 | Fix | O5 Windows tests | r2 |
| P11 | TOFU adopts a pre-upgrade swapped parent; force re-registration instead | r1: root-cause#1, tauri-security#2 | Skip | a dialog re-pick selects by pathname and authorizes whatever parent is there — no stronger guarantee, all registrations lost | upheld r2–r4 |
| P12 | failed startup upgrade commit repeats TOFU next start | r1: error-handling#2 | Skip | persisted state = pre-upgrade state; failing `open()` bricks an unwritable data dir; same precedent | upheld r2 |
| P13 | checking transient grants in `resolve()` exceeds MANDATE | r1: minimalism#1, error-handling#3 | Fix | check scoped to registry entries | r2 |
| P14 | explicit re-pick after a parent change would hit `Conflict` forever | r2: correctness#1 | Fix | explicit doors rebind | r3 |
| P15 | passive listing would revive a `None` legacy handle | r2: root-cause#1 | Fix | passive doors require `Some` equality | r3 |
| P16 | refusal-only tests cannot detect a producer storing `None` | r2: plan#1, tests#1 | Fix | positive binding assertions | r4 |
| P17 | registration-time race untested | r2: plan#1, tauri-security#2 | Fix | race tests (finalized by P29) | r5 |
| P18 | opening book misfiled as verified-branch caller | r2: plan#2, minimalism#1 | Fix | inventory corrected | r3 |
| P19 | `refresh_entry` availability change exceeds MANDATE | r2: plan#3, minimalism#2 | Fix | removed | r4 |
| P20 | pathname-reopen fallback records a replacement parent | r2: tauri-security#1 | Fix | no fallback | r3 |
| P21 | Windows workspace consumers untested | r2: tests#2 | Fix | O5 Windows list | r3 |
| P22 | `retired_attachments` excluded | r3: correctness#1 | Fix | check covers retired entries | r4/r5 (test P30) |
| P23 | "stays Unavailable" contradicts unchanged `refresh_entry` | r3: correctness#2, plan#2 | Fix | wording | r4 |
| P24 | `rebind_pgn_file_after_replace` not asserted | r3: plan#1 | Fix | O5 | r4 |
| P25 | puzzle discovery is passive | r3: tauri-security#1 | Fix | door kind | r4 |
| P26 | proof command with three positional filters | r3: tests#1 | Fix | full `cargo test` | r4 |
| P27 | engine-image race untested | r3: tests#2 | Fix | O5 | r4 |
| P28 | Windows W57 producer race untested | r3: tests#3 | Fix | O5 | r4 |
| P29 | DB/puzzle race outcome unreachable (root revalidation first; Windows share mode) | r4: correctness#1, plan#2 | Fix | refusal-with-no-entry outcome | r5 |
| P30 | retired attachment check untested | r4: plan#1, tests#1 | Fix | O5 | r5 |
| P31 | recovery claims unreachable for root-parent children | r4: plan#3; r6: plan#1 | Fix | no recovery promised; replaced root refused by design (`get_or_create_root`) | r7 |
| P32 | download-artifact race untested | r4: tests#2 | Fix | (P34) | r6 |
| P33 | explicit puzzle registration has no production caller | r5: plan#1 | Fix | puzzle passive-only | r6 |
| P34 | download-artifact post-resolve window untested | r5: tests#1 | Fix | O5 | r6 |
| P35 | created-child/rebind race untested | r6: tests#1 | Fix | race invariant over all descriptor-recording producers | r7 |
| P36 | startup pass skips canonical entries before acquiring | r6: plan#2 | Fix | canonical upgrade + canonical fixture | r7 |

## Implementation and final review

* Phase 1 (one phase, Codex `sensitive`, thread `01a0ea9c-e769-7191-8b59-aadbd4b93a19`): commit
  `5953bafd`. Two executor fix rounds: (1) clippy `too_many_arguments` on three functions →
  `IdentityBinding` value type; (2) three test failures (a fixture ordering error, a download
  race test asserting an unreachable outcome, a structural delegation pin in `platform_support.rs`
  recording the old `register_created_entry` signature). Orchestrator takeover: a self-deadlock
  in the leaf's new `pgn.rs` assertions (MutexGuard held across a second lock — the "hanging"
  test) and two Windows-only dead test-hook setters (gated `cfg(all(test, unix))`, the file's
  own precedent). Proof on the final tree: fmt, clippy `-D warnings`, `cargo test --locked`
  1598 passed / 1 ignored, `pnpm rust:windows:check` green. Mutation spot-check: removing the
  `database_file_target` parent check turns
  `database_file_target_refuses_a_same_inode_parent_replacement_without_sidecars` red.
* Downstream rework attributable to plan review gaps: none of the executor failures traced to a
  plan obligation; the download-race outcome (change-stamp refusal before insertion) was not
  foreseen by P34 — the test asserts the reachable refusal.
* Cumulative review (8 Codex lenses over `c06f66a5..5953bafd`): correctness APPROVED,
  pgn-index APPROVED, code-quality APPROVED (3 should-fix), error-handling APPROVED
  (2 should-fix), minimalism REVISE (1), root-cause REVISE (1), tauri-security REVISE (2),
  tests REVISE (1).

| ID | Finding | Lens | Verdict | Resolution |
|---|---|---|---|---|
| R1 | stale `ResolvedPath::parent` comment | code-quality | Fix | `869f79f4` |
| R2 | acquisition-failure log names "path rebinding" on a parent upgrade | code-quality | Fix | `869f79f4` |
| R3 | `Option<&Option<Identity>>` three states undocumented | code-quality | Fix | `869f79f4` doc comment |
| R4 | created-file parent identity read after install | error-handling | Fix | `869f79f4` identity passed up front |
| R5 | move/rename/trash/restore parent identity read after the rename | error-handling | Fix | `869f79f4` |
| R6 | swap helper duplicated in unix and Windows test modules | minimalism | Fix | `869f79f4` one helper in `portable_tests` |
| R7 | SQLite opens by pathname after the parent-bound probe (`-wal`/`-shm` redirect window) | root-cause | Defer | filed through the inbox spool (db-search, `build`); out of this plan's scope ("Not part of this task") and a separate design question |
| R8 | startup TOFU adopts a pre-upgrade swapped parent | tauri-security | Skip | = P11, upheld by this lens in plan review r2–r4; no new evidence |
| R9 | intermediate ancestor symlink to an "outside copy" | tauri-security | Skip | a copy cannot preserve the leaf and parent identities, which are both verified; moving the authorized directory keeps writes in the authorized directory; ancestor following is recorded design (2026-09-13 W1) |
| R10 | download late-swap test cannot observe a pathname-derived parent | tests | Skip | the swap changes the leaf's ctime and `commit_download_artifact` refuses on the change stamp before insertion (observed: `Conflict("download artifact target changed before activation")`); a published handle through that window is unreachable |

Successor: the R7 finding (spool-filed 2026-09-29, id allocated at drain merge) owns the SQLite
pathname-open residual; it builds on this binding and needs no issue from this record.
