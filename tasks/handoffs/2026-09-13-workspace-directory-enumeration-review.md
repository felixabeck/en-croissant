# Workspace directory enumeration — plan review record

Scope: `f-20260905-05` (descriptor-based directory enumeration for the PGN workspace, plus the
`map_db3_children_cancellable` scope amendment under rule 11). Plan (ignored run artifact):
`tasks/plans/2026-09-13-workspace-directory-enumeration.md`. This tracked record preserves the complete
issue and round history so that the plan, its snapshots and the lens reports under `/tmp` may disappear.

## Lineage and run facts

* Picked by `/next-finding` on 2026-09-13 as the next oldest unblocked finding after `f-20260905-04`,
  which the session then holding the repository build lock was building (04+06+08, pushed as
  `origin/master` `0fd454ac`). No rewrite and no split of this mandate occurred.
* Orchestrator: Claude Code (Opus 5). Executor: Codex (`gpt-5.6-luna`/xhigh on every rung used). Plan
  authorship and arbitration shared one context; detection ran in separate Codex processes of a
  different model family.
* Plan review: 12 completed rounds (r1–r12) plus two focused rule-12a judgments (`focus-w47` after r4,
  `focus-w85` beside r9), all `APPROVED`/`(a)` at closure. Active review ran from about 18:10 to 22:55
  CEST on 2026-09-13 without pauses; three locate probes ran between rounds 1 and 2.
* Round lens sets: r1–r6 all seven (`plan`, `minimalism`, `correctness`, `root-cause`, `tests`,
  `error-handling`, `tauri-security`); r7 five; r8–r10 four; r11 three; r12 two — each later round ran
  `review-plan`, every lens whose findings drove the correction, and newly affected lenses, carrying
  forward the others' latest `APPROVED`.
* `plan_adopted_per_round`: r1=22 r2=13 r3=11 r4=10 r5=5 r6=5 r7=3 r8=4 r9=9 r10=5 r11=2 r12=1 (adoption
  counts, not unique defects). Unique issues: 105 (W1–W105), all closed, skipped with evidence, or
  deferred to a filed successor.
* Measurements taken during review (rule 12b): a removed directory read through its fd lists `[]` with
  `st_nlink == 0` and `openat(fd, ".")` succeeding; at a bind mount the dirent `d_ino` is the covered
  directory while `st_ino` is the mounted one (W8, W75).

## Successors that inherit issues from this record

Each successor must load this file before its own plan review.

| Successor | Inherited issue IDs | What it owns |
|---|---|---|
| `f-20260913-02` | W6, W17, W24 | create-path `timestamp` metadata reach |
| `f-20260913-03` | W11 | `*_root_path` wrapper duplication |
| `f-20260913-04` | W20, W40, W63, W98 (category) | replacement surfacing as a non-`Conflict` category in `resolve`'s root window and `register_database_child_verified` |
| `f-20260913-05` | W42 | listing-error rendering in the Files and Databases pages |
| `f-20260913-06` | W65, W97 (registry churn) | bounding listing snapshots and registry churn from failed listings |
| `f-20260912-05` | W57 | registered handles binding pathname plus leaf identity only |

## Round-by-round review history (verbatim from the plan)

### Round 1 — r1, 7 lenses (Codex), all `REVISE`

Raw verdicts: `review-plan` REVISE · `review-minimalism` REVISE · `review-correctness` REVISE ·
`review-root-cause` REVISE · `review-tests` REVISE · `review-error-handling` REVISE ·
`review-tauri-security` REVISE. Raw reports: `/tmp/build-a52478d4/r1-lens-*.txt`. Locate probes after
triage: `/tmp/build-a52478d4/probe-{1,2,3}.txt`.

| ID | Issue | Witnesses | Disposition | Evidence / correction |
|---|---|---|---|---|
| W1 | `open_verified_directory` refuses symlinked ancestors; listing would regress | plan, correctness | Fix | probe-2: `resolve` follows ancestors and verifies identity; root via `resolve` + `take_directory` |
| W2 | `.db3` registration discards observed identity | correctness, error-handling, root-cause, tauri-security, tests | Fix | `observed` param + `Conflict` |
| W3 | `cfg(unix)` types behind non-unix signatures | plan, correctness, root-cause, tauri-security | Fix | data types unconditional; functions refuse on non-unix |
| W4 | Unmigrated callers of deleted/changed fns | plan, correctness, tauri-security | Fix | probe-1/3 inventory |
| W5 | No initial cancellation check; no mid-walk cancellation test | correctness, tests | Fix | A.1; tests 3–5 |
| W6 | `timestamp`/create paths outside MANDATE | minimalism, root-cause, tauri-security | Skip → filed `f-20260913-02` | metadata, not enumeration; allowlist 4 → 1 |
| W7 | stat/mtime of discarded entries aborts listing | plan | Fix | `keep` before stat; raw mtime |
| W8 | Removed directory lists as empty `Ok` | plan, error-handling | Fix (premise corrected) | measured `openat('.')` ok, `[]`, `nlink 0`; `st_nlink` check |
| W9 | Metadata not bound to observed PGN | root-cause | Fix | final mechanism: W31/W62 |
| W10 | Swap error categories | error-handling | Fix | errno → `Conflict` |
| W11 | `*_root_path` wrapper duplication | minimalism | Plan part moot; pre-existing filed `f-20260913-03` | |
| W12 | Double sort | minimalism | Fix | primitive unsorted |
| W13 | Filtered `cargo test` green on zero matches | tests | Fix | full log + exact-name grep |
| W14 | No proof of no pathname in the entry type | tests | Fix | W32 |
| W15 | No PGN-replacement test | tests | Fix | tests 22, 23 |
| W16 | Cancellation only pre-cancelled | tests | Fix | tests 3–5, 17, 25, 26 |
| W17 | Create-path guard untested | tests | Moot (W6) | |
| W18 | Pre-epoch refusal untested | tests | Fix | test 27 |
| W19 | Specials untested | tests, tauri-security | Fix | FIFO fixtures |
| W20 | Root swap between validation and open | tests | Skip → re-dispositioned as W40 (`f-20260913-04`) | |
| W21 | Stale allowlist count | tests | Skip | checker `!==` (`:579`) |
| W22 | Sidecar not in shape test | tests | Fix | test 18 |
| W23 | Non-UTF-8 ordering | tests | Fix | test 18 |
| W24 | Create-path components source | tauri-security | Moot (W6) | |
| W25 | Registration consolidation expands MANDATE | correctness | Skip | rule 11 |
| W26 | DB3 test passes on old code | root-cause | Fix | test 14 |
| W27 | `AuthorizedDir` producer set pinned | orchestrator trace | Fix | `CapabilityDirectory` |

Adopted in round 1: 22.

### Round 2 — r2, 7 lenses (Codex)

Raw verdicts: `review-plan` REVISE · `review-minimalism` REVISE · `review-correctness` REVISE ·
`review-root-cause` APPROVED · `review-tests` REVISE · `review-error-handling` APPROVED ·
`review-tauri-security` REVISE. Raw reports: `/tmp/build-a52478d4/r2-lens-*.txt`.

| ID | Issue | Witnesses | Disposition | Evidence / correction |
|---|---|---|---|---|
| W28 | Cancellation after `keep`/stat/EOF | plan, correctness | Fix | A.3/A.4; tests 4, 5 |
| W29 | `PuzzleRead \| DatabaseRead` not an expression | plan | Fix | named operations |
| W30 | Vanished entry before `statat` untested | plan, tests | Fix | tests 6, 24 |
| W31 | Metadata re-resolution binds only the leaf | tauri-security; r3: correctness, plan, root-cause, tauri-security | Fix — final: descriptor-relative sidecar | tests 12, 21 |
| W32 | Token-based no-pathname check | tests | Fix | test 8 |
| W33 | Same-count substitution | tests | Fix → W47 | test 15 |
| W34 | Filtered-name stat unobservable | tests | Fix → W51/W59 | test 2 |
| W35 | Before-syscall cancel ordering | tests | Fix | test 3 |
| W36 | `ENOTDIR`/`ENOENT` untested | tests | Fix | test 11 |
| W37 | Symlinked ancestor at consumer | tests | Fix | test 19 |
| W38 | Unused `identity` field | minimalism | Fix | descriptor-only |
| W39 | Single-caller helper | minimalism | Fix | private stat |
| W40 | Root race inside `resolve` → `Io` | error-handling | Defer → `f-20260913-04` | |
| W41 | Type-change category | error-handling | Fix → W43/W63 | |
| W42 | Listing-error UI | error-handling | Defer → `f-20260913-05` | |

Adopted in round 2: 13.

### Round 3 — r3, 7 lenses (Codex)

Raw verdicts: `review-plan` REVISE · `review-minimalism` REVISE · `review-correctness` REVISE ·
`review-root-cause` REVISE · `review-tests` REVISE · `review-error-handling` APPROVED ·
`review-tauri-security` REVISE. Raw reports: `/tmp/build-a52478d4/r3-lens-*.txt`.

Recurring dispute (rule 12a): W31 returned a third time; broad fan-out stopped; the orchestrator traced
`resolved.rs:620-631` / `:636-721` and `mod.rs:4354-4392`; the obligation changed structurally to no
re-resolution below the root.

| ID | Issue | Witnesses | Disposition | Evidence / correction |
|---|---|---|---|---|
| W43 | `.db3` → directory reaches the identity check → `Conflict` | correctness | Fix | test 14 |
| W44 | Registration before fallible reads | error-handling | Fix | C ordering |
| W45 | `open_child_directory` duplicates `open_verified_directory` | minimalism | Skip (upheld r4) | only `VerifiedDir::new` is shared, already one copy |
| W46 | Duplicated observed-identity guard | minimalism | Fix | `refuse_unobserved` |
| W47 | Body scan misses aliases/helpers | plan, tests | Fix per focused judgment (a) (r4) | test 15 tripwire; decision 9 |
| W48 | Cancellation after empty snapshot | plan | Fix | tests 17, 25 |
| W49 | Unbounded descriptor depth | plan | Fix | depth 64; test 28 |
| W50 | One test for two cancellation checks | root-cause, tests | Fix | tests 4, 5 |
| W51 | Pre-stat hook only for kept names | tests | Fix → W59 | test 2 |
| W52 | No "nothing registered" assertions | tests | Fix | tests 14, 22–24, 26, 27 |
| W53 | Type-replacement asserts only `Err` | tests | Fix | test 14 |
| W54 | Obligations beyond MANDATE | tests | Skip | regression safety + MANDATE's replacement semantics |
| W55 | Symlinked-parent test vacuous | plan | Fix | tests 12, 21 |

Adopted in round 3: 11.

### Round 4 — r4, 7 lenses (Codex) + one focused judgment

Raw verdicts: `review-plan` REVISE · `review-minimalism` REVISE · `review-correctness` REVISE ·
`review-root-cause` REVISE · `review-tests` REVISE · `review-error-handling` REVISE ·
`review-tauri-security` **APPROVED**. Focused rule-12a judgment on W47 (`review-plan`, fresh context,
`/tmp/build-a52478d4/focus-w47.txt`): **JUDGMENT (a)**, raw verdict REVISE — complete the token list,
narrow test 15 to a direct-producer tripwire, state root acquisition as outside the below-root
invariant; its other blocker was the missing round-4 record, supplied here. Raw reports:
`/tmp/build-a52478d4/r4-lens-*.txt`.

Closure results reported against r4: CLOSED — W31 (minimalism, plan, tauri-security, correctness,
error-handling for the parent mechanism), W9 (plan, tauri-security, correctness), W5/W28 (plan,
correctness, root-cause, tests), W34/W51 (plan), W41/W43 (plan, root-cause, error-handling), W44 (plan,
root-cause, error-handling), W45 (minimalism), W46 (minimalism, plan, root-cause, tests), W48, W49,
W52, W55. NOT CLOSED — W31/W9 (root-cause: persisted handle binding → W57), W33/W47 (plan, tests →
focused judgment), W34/W51 (tests → W59), W41/W43 (correctness → W63), W44 (tests → W60).

| ID | Issue | Witnesses | Disposition | Evidence / correction (r5) |
|---|---|---|---|---|
| W56 | Shared helper would remove the literal `resolved.identity()?` that `guarded_registrars_require_the_resolved_descriptor_identity` pins | plan | Fix | helper takes the identity as an argument (`mod.rs:6425-6437` unchanged) |
| W57 | Persisted child handles bind pathname + leaf identity only | root-cause | Defer → `f-20260912-05` (annotated) | the registry model is that finding's open question; this plan adds a producer, not the gap |
| W58 | Sidecar identity check duplicates `assert_entry_identity` | minimalism | Fix | `fs.rs:1236-1254` made `pub(crate)` and reused via `confirm_entry` |
| W59 | Skipped-name stat still unobservable | tests | Fix | test 2: `keep` unlinks rejected names |
| W60 | mtime failure after registration would leave stale entries undetected | tests | Fix | test 27 asserts nothing registered, incl. a directory case |
| W61 | No `.db3` ordering test | tests | Fix | test 16 |
| W62 | PGN checked before the sidecar open — both replaced in between returns other metadata | correctness, error-handling | Fix | sidecar opened first, then `confirm_entry`; test 13 |
| W63 | `.db3` → directory inside `register_database_child_verified`'s resolve→validate window is `InvalidInput` | correctness | Fix (wording) + Defer category → `f-20260913-04` (annotated) | acceptance 2 scoped to "before its registration's `resolve`"; risk bullet |
| W64 | No final binding check before registration | correctness, error-handling | Fix | `confirm_entry` before every registration; test 23; residual stated |
| W65 | Unbounded snapshot vectors | error-handling | Defer → `f-20260913-06` | open design question: which bound, what the UI shows |
| W66 | No failing-before evidence for the key tests | root-cause | Fix | red demonstration obligation in Phases |
| W67 | Round-4 re-review record missing from `## Reviews` | focused judgment | Fix | this section |

Adopted in round 4: 10 (W56, W58, W59, W60, W61, W62, W63 wording, W64, W66, W67), plus the W47
judgment applied. Open after r4: closure checks for W47, W56, W58–W64, W66, and W9/W31 given W62/W64.
Cumulative: 4 completed rounds plus one focused judgment; unique issues 67; adoption counts r1=22
r2=13 r3=11 r4=10.

### Round 5 — r5, 7 lenses (Codex)

Raw verdicts: `review-plan` REVISE · `review-minimalism` REVISE · `review-correctness` REVISE ·
`review-root-cause` REVISE · `review-tests` **APPROVED** · `review-error-handling` REVISE ·
`review-tauri-security` REVISE. Raw reports: `/tmp/build-a52478d4/r5-lens-*.txt`.

Closure results reported against r5: CLOSED — W47 (plan, correctness, root-cause, tests,
error-handling), W56, W58, W59 (plan, error-handling), W61 (plan, error-handling), W62, W63 (plan,
correctness), W64, W66 (plan, tests), W9/W31 (all seven, persisted-handle residual owned by W57), W45,
W46. NOT CLOSED — W60/W44 (plan, correctness, error-handling, tauri-security → W68), W66 (root-cause →
W71), W59 (tests → W72), W61 (tests → W73), W63 category (error-handling: deferred by design,
`f-20260913-04`).

| ID | Issue | Witnesses | Disposition | Evidence / correction (r6) |
|---|---|---|---|---|
| W68 | Directory registers descendants before its own `listed_mtime`, so test 27(2) cannot hold | plan, correctness, error-handling, tauri-security, minimalism (as scope conflict) | Fix | `listed_mtime` before descent in C; red demonstration moves the check back after descent |
| W69 | `depth >= 64` refuses the 64th level test 28 requires to succeed | correctness, tauri-security | Fix | root depth 0, refuse `depth > 64`; test 28 restated by chain length |
| W70 | `confirm_entry` addresses a name without `single_leaf` | tauri-security | Fix | `single_leaf` first in every `CapabilityDirectory` method taking a name |
| W71 | Red demonstration for the `VerifiedDir` check uses test 20, whose symlink swap fails at `O_NOFOLLOW` first | root-cause | Fix | demonstration on test 10 (fresh real directory) |
| W72 | An unhooked `statat` before `keep` would still pass test 2 | tests | Skip | observing an extra syscall needs syscall tracing; the primitive is one reviewed function body and the lens's overall verdict is APPROVED |
| W73 | `.db3` ordering fixture is ASCII-only | tests | Fix | non-UTF-8 names whose lossy order inverts their byte order |
| W74 | Directory mtime case exceeds MANDATE | minimalism | Skip | with W68 the case costs no rollback and pins W44's "failed entry registers nothing" for directories |

Adopted in round 5: 5 (W68, W69, W70, W71, W73). Open after r5: closure checks for W68–W71, W73, and
W60/W44/W66 through them. Cumulative: 5 completed rounds plus one focused judgment; unique issues 74;
adoption counts r1=22 r2=13 r3=11 r4=10 r5=5.

### Round 6 — r6, 7 lenses (Codex)

Raw verdicts: `review-plan` REVISE · `review-minimalism` **APPROVED** · `review-correctness` **APPROVED** ·
`review-root-cause` **APPROVED** · `review-tests` REVISE · `review-error-handling` **APPROVED** ·
`review-tauri-security` REVISE. Raw reports: `/tmp/build-a52478d4/r6-lens-*.txt`.

Closure results reported against r6: CLOSED — W68, W69, W71, W73, W44/W60 (all lenses reporting them),
W70 (plan, correctness, root-cause, error-handling, tauri-security), W66 (plan, correctness, root-cause,
tests, tauri-security), W74 skip upheld (minimalism), W72 skip upheld (tests). NOT CLOSED — W70 (tests
→ W77), W66 (error-handling → W78).

| ID | Issue | Witnesses | Disposition | Evidence / correction (r7) |
|---|---|---|---|---|
| W75 | Identity taken by `statat` after `readdir` is not compared with the dirent's `d_ino`, so a bind mount placed before the stat is traversed | tauri-security | Skip (rejected with measurement) | Disposable probe under `unshare -Urm`: without a mount `d_ino 94517190 st_ino 94517190`; after `mount --bind outside ws/sub`: `d_ino 94517190 st_ino 94517191 outside st_ino 94517191`, `listing under mount: ['leak.pgn']`. `d_ino` is the covered directory at **every** mount point, so the comparison would refuse legitimate mounts inside a workspace, and it carries no `st_dev`. A replacement in the `readdir`→`statat` interval is indistinguishable from one before `readdir`; binding starts at observation and every later window is covered (child open, confirmation). Mounting in the app's namespace already requires control of the user's session. |
| W76 | Proof shell: the name loop can overwrite a failed `cargo test` status | tests | Fix | status captured into a variable and checked immediately with `exit` |
| W77 | No test drives the new `single_leaf` guards with a forged name | tests | Fix | test 29 |
| W78 | Test 13 cannot observe that the sidecar was opened before the PGN confirmation | tests, error-handling | Fix | post-open hook must have fired |
| W79 | Workspace fixture's single non-UTF-8 name cannot distinguish byte order from lossy order | tests | Fix | two names whose orders differ, asserted |
| W80 | Pseudocode registers the full display name; today strips `.pgn` (`file_workspace.rs:320-331`) | plan | Fix | C reproduces `trim_end_matches(".pgn")` for registration and entry name; test 18 lists `a` and `B.PGN` |

Adopted in round 6: 5 (W76, W77, W78, W79, W80). Open after r6: closure checks for W76–W80, and W66/W70
through W77/W78. Cumulative: 6 completed rounds plus one focused judgment; unique issues 80; adoption
counts r1=22 r2=13 r3=11 r4=10 r5=5 r6=5.

### Round 7 — r7, 5 lenses (Codex); minimalism and root-cause carried forward from their r6 APPROVED

Raw verdicts: `review-plan` REVISE · `review-correctness` **APPROVED** · `review-tests` **APPROVED** ·
`review-error-handling` REVISE · `review-tauri-security` **APPROVED**. Raw reports:
`/tmp/build-a52478d4/r7-lens-*.txt`.

Closure results reported against r7: CLOSED — W66, W70, W76, W77, W78, W79, W80 (every reporting lens);
W71, W72 (skip), W73, W74 (skip), W75 (skip upheld by tauri-security, tests and error-handling).

| ID | Issue | Witnesses | Disposition | Evidence / correction (r8) |
|---|---|---|---|---|
| W81 | Descendants are durably registered before their ancestor's final confirmation; a refused ancestor leaves descendant handles and grows the registry | error-handling | Fix | C split into pass 1 (walk, checks, confirmations) and pass 2 (registration after the whole walk succeeds); test 23(2) |
| W82 | Depth test does not assert ancestors unregistered or the depth-64 entry listed | tests | Fix | test 28 |
| W83 | Removed-directory failure not exercised at the consumer | tests | Skip | `entries()` returns the same `Error::Io(NotFound)` for a removed directory (test 7) and a vanished entry (test 6); the consumer propagates both through the same `?`, and test 24 is red if it swallows `NotFound` |
| W84 | `.db3` registration still re-resolves its child by pathname, contradicting "nothing below the root is re-resolved" | plan | Fix (wording) | the child's parent is the capability root, re-verified by identity in that `resolve`; no intermediate directory exists; acceptance 2 and Risks state it |

Adopted in round 7: 3 (W81, W82, W84). Open after r7: closure checks for W81, W82, W84 and the red
demonstration change on test 23(2). Cumulative: 7 completed rounds plus one focused judgment; unique
issues 84; adoption counts r1=22 r2=13 r3=11 r4=10 r5=5 r6=5 r7=3.

### Round 8 — r8, 4 lenses (Codex); tauri-security (r7), minimalism and root-cause (r6) carried forward

Raw verdicts: `review-plan` REVISE · `review-correctness` REVISE · `review-tests` REVISE ·
`review-error-handling` REVISE. Raw reports: `/tmp/build-a52478d4/r8-lens-*.txt`.

Closure results reported against r8: CLOSED — W81, W82, W84 and the red demonstration on test 23(2)
(all four lenses); metadata ordering, output shape, W68–W70, W73, W76–W80 (correctness, plan); W83
skip upheld (correctness, tests). NOT CLOSED — W64 (correctness, error-handling, plan: the pass split
widens the confirmation→registration interval), pass-2 cancellation (error-handling, tests), nested
missing handles (tests).

Recurring dispute (rule 12a): registration timing versus replacement has now returned four times
(W44 → W64 → W81 → W85). Broad fan-out on it stops. The orchestrator's trace: every use of a
registered handle passes `resolve`'s identity comparison (`resolved.rs:602-618`, `:636-721`), so the
safety property — a handle never authorizes an object other than the observed one — holds for any
timing; timing decides only whether an `Ok` listing can carry a handle whose first use fails. The
three stronger mechanisms each break an adopted invariant (descriptor retention per directory vs
`RLIMIT_NOFILE`; pass-2 `resolve` vs the no-re-resolution rule and W31; rollback vs the absence of a
registry transaction). A focused fresh-context `review-plan` judgment on exactly this invariant is run
beside round 9.

| ID | Issue | Witnesses | Disposition | Evidence / correction (r9) |
|---|---|---|---|---|
| W85 | Pass split lets a replacement after pass-1 confirmation be persisted and returned in an `Ok` listing, contradicting acceptance 2 | correctness, error-handling, plan, tests | Fix (semantics stated, acceptance corrected, test added) | C "Replacement semantics"; acceptance 2; test 30 |
| W86 | Acceptance 3 claims a failed or cancelled listing registers nothing, but pass 2 can leave registrations | correctness, error-handling, plan | Fix (wording) | acceptance 3 scoped to pass 1 |
| W87 | No test cancels during pass 2 | tests, error-handling | Fix | pre-register hook; test 31 |
| W88 | Nested `missing` handles not asserted | tests | Fix | test 18 |

Adopted in round 8: 4 (W85, W86, W87, W88). Open after r8: closure checks for W85–W88 and the
focused judgment on W85. Cumulative: 8 completed rounds plus one focused judgment; unique issues 88;
adoption counts r1=22 r2=13 r3=11 r4=10 r5=5 r6=5 r7=3 r8=4.

### Round 9 — r9, 4 lenses (Codex) + focused judgment on the registration-timing invariant

Raw verdicts: `review-plan` REVISE · `review-correctness` REVISE · `review-tests` **APPROVED** ·
`review-error-handling` **APPROVED**. Focused rule-12a judgment (`review-plan`, fresh context,
`/tmp/build-a52478d4/focus-w85.txt`): **JUDGMENT (a)**, raw verdict **APPROVED** — the snapshot semantics
are complete for the safety invariant; the stronger alternatives each violate an adopted invariant;
should-fix: qualify the refusal category on use. The registration-timing dispute is settled by that
judgment. Raw reports: `/tmp/build-a52478d4/r9-lens-*.txt`.

Closure results reported against r9: CLOSED — W85 (correctness, tests, error-handling), W86, W87, W88
(all four lenses). NOT CLOSED — W85 (plan: stale decision text and category → W89, W90).

| ID | Issue | Witnesses | Disposition | Evidence / correction (r10) |
|---|---|---|---|---|
| W89 | Decisions 4 and 7 still require confirmation "immediately before registration" / "a final confirmation", contradicting C | correctness, plan | Fix | decisions 4 and 7 restated for pass 1 / pass 2 |
| W90 | Use-time refusal of a post-confirmation replacement is `Conflict` only for a same-type replacement | plan, focused judgment | Fix | C and acceptance 2 name `InvalidInput` / `Io(NotFound)`; test 30 cases (2), (3) |
| W91 | Unconditional existing tests would fail where the capability refuses by design | plan | Fix | `#[cfg(unix)]` gating list |
| W92 | Test 30's hook is thread-local but `list_file_workspace_core` collects on a `BLOCKING_GATEWAY` worker | plan | Fix | test 30 drives `collect_tree_entries` and the handle resolves on the test thread |
| W93 | `open_child_directory`'s kind guard untested | tests | Fix | test 29 |
| W94 | Pass-2 registration failure untested | tests | Fix | test 32 |
| W95 | Pass-2 cancellation not exercised inside a child's registration | tests | Fix | test 31(2) |
| W96 | Post-confirmation replacement of a directory untested | tests | Fix (with W90) | test 30(2) |
| W97 | Pass-2 failure after a durability-uncertain commit also leaves the failing entry; registry churn on repeated failures | error-handling | Fix (wording) + churn annotated on `f-20260913-06` | acceptance 3; Risks |

Adopted in round 9: 9 (W89–W97). Open after r9: closure checks for W89–W97. Cumulative: 9 completed
rounds plus two focused judgments; unique issues 97; adoption counts r1=22 r2=13 r3=11 r4=10 r5=5 r6=5
r7=3 r8=4 r9=9.

### Round 10 — r10, 4 lenses (Codex)

Raw verdicts: `review-plan` REVISE · `review-correctness` REVISE · `review-tests` REVISE ·
`review-error-handling` **APPROVED**. Raw reports: `/tmp/build-a52478d4/r10-lens-*.txt`. `review-plan`
additionally witnessed W99 and W100 and raised W101 and W102.

Closure results reported against r10: CLOSED — W89, W91, W92, W93, W94, W95, W96 (correctness, tests),
W97 (correctness, error-handling). NOT CLOSED — W90 (correctness: nested ancestor symlink category;
tests: removal untested), W97 (tests: test 32 lacks a registry assertion).

| ID | Issue | Witnesses | Disposition | Evidence / correction (r11) |
|---|---|---|---|---|
| W98 | A nested handle whose ancestor became a symlink is refused by `resolve` with `Io(ELOOP)`, not the promised `InvalidInput` | correctness | Fix (contract narrowed) | the use-time error category is `resolve`'s existing behaviour and not this plan's contract (its gaps are `f-20260913-04`); acceptance 2 and C promise refusal without opening; test 30 case (5) |
| W99 | Test 32 never checks the registry after the injected failure | tests | Fix | test 32 asserts registry contents for a durability-uncertain and a hard failure |
| W100 | Post-confirmation removal untested | tests, plan | Fix | test 30 case (4) |
| W101 | A removal before confirmation surfaces as `Io(NotFound)` from `assert_entry_identity`'s `statat`, not `Conflict` | plan | Fix (wording) | C and acceptance 2 scope `Conflict` to replacements; removal is acceptance 3's vanished entry (tests 6, 24) |
| W102 | `map_db3_children_cancellable` contract dropped `T` and its `Result` types | plan | Fix | generic signature restated |

Arbiter note on W90 → W98: the round-9 correction promised exact categories that `resolve` owns. Each
added category produced a further edge case; the category promise is withdrawn rather than extended,
because the MANDATE's replacement semantics are about refusal, and the category question is already
filed. Adopted in round 10: 5 (W98, W99, W100, W101, W102). Cumulative: 10 completed rounds plus two
focused judgments; unique issues 102; adoption counts r1=22 r2=13 r3=11 r4=10 r5=5 r6=5 r7=3 r8=4 r9=9
r10=5.

### Round 11 — r11, 3 lenses (Codex); error-handling carried forward from its r10 APPROVED

Raw verdicts: `review-plan` REVISE · `review-correctness` **APPROVED** · `review-tests` **APPROVED**. Raw
reports: `/tmp/build-a52478d4/r11-lens-*.txt`.

Closure results reported against r11: CLOSED — W90, W98, W99, W100, W101, W102, W97 (correctness,
tests); W90, W100, W101, W102 (plan). NOT CLOSED — W98 (plan: "never opens" unobservable → W103), W99/W97
(plan: fault injector scope → W104).

| ID | Issue | Witnesses | Disposition | Evidence / correction (r12) |
|---|---|---|---|---|
| W103 | "Never opens the replacement" is not observable and not true of `resolve_unix`, which may open before comparing identity | plan | Fix (contract wording) | contract is "no descriptor or authorization reaches the caller", which `is_err()` of `resolve` establishes |
| W104 | `ParentSyncFault` fails every parent sync, so test 32's per-entry registry expectations cannot be produced | plan | Fix | counting test-local injector faulting only the second commit, on the test thread |
| — | macOS `st_nlink` unmeasured (lens limitation, not a finding) | plan | Recorded in Risks | macOS does not compile today (`f-20260830-06`) |

Adopted in round 11: 2 (W103, W104). Cumulative: 11 completed rounds plus two focused judgments; unique
issues 104; adoption counts r1=22 r2=13 r3=11 r4=10 r5=5 r6=5 r7=3 r8=4 r9=9 r10=5 r11=2.

### Round 12 — r12, 2 lenses (Codex); correctness (r11), error-handling (r10), tauri-security (r7), minimalism and root-cause (r6) carried forward

Raw verdicts: `review-plan` **APPROVED** · `review-tests` **APPROVED**. Raw reports:
`/tmp/build-a52478d4/r12-lens-*.txt`.

Closure results reported against r12: CLOSED — W103, W104, and W97/W98/W99 through them (both lenses).

| ID | Issue | Witnesses | Disposition | Evidence / correction |
|---|---|---|---|---|
| W105 | Stale evidence reference `search.rs:340-346` (moved by the pushed search-index work) | plan | Fix (reference-only) | replaced by `AuthorizedDir::open_regular_relative` (`mod.rs:393-457`); no semantics or proof changed, so no further lens (rule 12a) |

**Closure.** Latest raw verdict per lens: `review-plan` APPROVED (r12), `review-tests` APPROVED (r12),
`review-correctness` APPROVED (r11), `review-error-handling` APPROVED (r10), `review-tauri-security`
APPROVED (r7), `review-minimalism` APPROVED (r6), `review-root-cause` APPROVED (r6); focused judgments
W47 (a) and registration timing (a). Every adopted substantive correction has an explicit closure result
recorded above. Open issues: none. Deferred to filed findings: W6 `f-20260913-02`, W11 `f-20260913-03`,
W40/W63 `f-20260913-04`, W42 `f-20260913-05`, W65/W97-churn `f-20260913-06`, W57 `f-20260912-05`.
Cumulative: 12 completed rounds plus two focused judgments; unique issues 105; adoption counts r1=22 r2=13
r3=11 r4=10 r5=5 r6=5 r7=3 r8=4 r9=9 r10=5 r11=2 r12=1.
