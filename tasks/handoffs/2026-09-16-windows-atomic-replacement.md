# Plan-review record — f-20260914-10 (Windows atomic-replacement primitive)

**Run:** 2026-09-16, orchestrator Claude Code (Opus 5), `next-finding` → `build`, `full auto`.
Executor selection began as `gemini`; every agy leaf in round 1 hit the individual quota
("Resets in 2h31m"), two were retried on Codex through `leaf-quota-retry.py` §1d, and Felix then
directed **all lenses to Codex** ("All lenses with codecs from now on because Gemini is out of
quota"). Rounds 1–11 therefore ran the lenses on Codex.

**The plan file is gitignored** (`tasks/plans/2026-09-16-windows-atomic-replacement.md`), so this
record is the only durable carrier of the review history. Load it before reviewing or resuming.

**Cumulative rounds:** 12 broad plan-review rounds, one focused architecture judgment, one
seven-lens closure round, and five verification rounds (four, four, two, one and one lenses).
**The review is CLOSED at r20**, every issue dispositioned and every adopted substantive correction
closure-checked against the final revision.
Plan revisions r1…r19, of which **r19 is records-only**: it changes `## Reviews` and this handoff,
and `plan-review-delta.py` reports the plan body `UNCHANGED` from r18. The last body changes were
r17 (R16-02's filter path, R16-01's Phase E obligation) and r18 (R17-01's E10 arithmetic). No delta
was manufactured for r19, per rule 12a's rule against a fabricated revision round.
**The disposition tables run r15, r16, r17, r19 — there is no r18 table and none is missing:** r17
dispositioned the r16 round, r18 was a round dispositioned in r19, and R17-01 came from the
orchestrator's own sweep with no lens. Stated because this run's other numbering gap (R12-03) was
re-reported by four lenses until it was recorded.
Lenses per round: r1 nine, r2 eight, r3–r11 seven, r12 seven, the judgment one, the closure round
seven, and the two verification rounds four each (`review-plan` plus the lenses whose findings drove
the correction under review). The seven are the six
universal lenses plus `review-tauri-security` **in place of** `review-code-quality` — a deliberate,
constant substitution, because the whole surface is the path-authority security boundary and no code
exists yet for a style lens to read.

`plan_adopted_per_round`: r1=21 r2=18 r3=13 r4=9 r5=8 r6=11 r7=9 r8=6 r9=9 r10=3 r11=8 r12=7
r13=3 r14=6 r15=2 r16=2 r17=1 r18=2 r19=1 r20=0 — where r13 is the focused architecture judgment (J-01…J-03),
r14 the seven-lens closure round, and r15/r16/r18 the verification rounds. r17=1 is R17-01, found by
the orchestrator's own sweep with no lens involved.

**Verdict trend (APPROVED / total):** r1 2/9 · r2 1/8 · r3 1/7 · r4 1/7 · r5 1/7 · r6 **0/7** ·
r7 1/7 · r8 1/7 · r9 **5/7** · r10 **5/7** · r11 3/7 · r12 2/7 · closure (r14) 2/7 ·
verification (r15) **0/4** · verification (r16) **2/4** · verification (r18) **1/2** · verification (r19) **0/1** · verification (r20) **1/1 APPROVED,
closing the review** — the r16
approvals are the run's first from `review-tests` and `review-root-cause`. **At r18 the two lenses
disagreed:** `review-plan` returned APPROVED with R16-01/R16-02 closed, `review-correctness` returned
REVISE reopening both. The arbiter re-measured and sided with the REVISE; the APPROVED is preserved
exactly as returned and was not used to close an evidenced defect.

**Issue IDs:** R1-01…R1-21, R2-01…R2-18, R3-01…R3-13, R4-01…R4-09, R5-01…R5-08, R6-01…R6-11,
R7-01…R7-09, R8-01…R8-06, R9-01…R9-09, R10-01…R10-03, R11-01…R11-08, R12-01/-02/-04…-07 (**R12-03 was never allocated** — a numbering
gap in the round-12 triage, flagged by four lenses and recorded as such, not a lost defect),
J-01…J-03, R14-01…R14-06, R15-01/-02, R16-01/-02, R17-01, R18-01/-02.

## The orchestrator's own error in round 6 — read this first

**r6 replaced the plan's entire verification model on a false measurement, and r7 reverted it.**

The plan's proof rested on un-ignoring 48 tests that carry
`#[cfg_attr(not(unix), ignore = "unported on this platform: f-20260914-10")]`. In round 6 the
orchestrator grepped for `#[ignore` and `cfg_attr(windows, ignore` — **neither of which matches the
actual spelling** — concluded from the negative result that nothing was ignored, recorded that as
evidence "E13", invoked rule 12a's rewrite trigger on the strength of it, and rewrote O6, O7,
Phases B–D and the proof block around a "Class 1 / Class 2" model. All seven round-6 lenses refuted
it independently at confidence 100, citing the live attributes and the durable records. r7 reverted
every conclusion drawn from it.

Three lessons are recorded here because they cost a full round:

1. A negative grep is not proof of non-existence. The measurement was real; the generalisation was not.
2. `d-20260916-01` — in this run's own governing-decisions list — states the fact plainly
   (81 gated tests, 63 owned by `f-20260914-10` and 18 by `f-20260914-11`, runner run 35049284019:
   "462 passed; 0 failed; 81 ignored"). It was never opened.
3. The green `rust-windows-test` job was the anomaly that should have caught it: it is green
   *because* 81 tests are ignored. That was explained away instead of chased.

**Recurring failure mode — split records, and the sweep that kept missing shapes of it.** Twelve
times a cut or correction was recorded in one place
while live text survived elsewhere: ADS (rounds 4, 5 and 6 — three consecutive), `sanitize_download_error`
(r7), gzip (r8), the R7-08 combine bullet (r9), the R8-04 fixture bullet (r10, caught by the
orchestrator's own post-write sweep rather than a lens), R10-01's stale test-list entry (r11), and
R11-01 — two assertion anchors named in O7's prose but never added to any exact-filter list, so the
probe would have stayed green if either regression landed. From r8 onward every cut is followed by a
whole-file sweep before the snapshot.

**The sweep had a blind spot, and it cost two more instances.** Until r12 it only checked that text
removed by a correction was gone. It never checked the opposite: that a test *described* in O7's
prose actually appears in a phase's exact-filter list. R11-01 was two such tests
(`windows_replace_succeeds_on_target_denying_generic_write`,
`windows_missing_non_final_component_is_refused`) — named in the assertion bullets, in no list, so
the Windows probe would have stayed green if either regression landed. The orchestrator then made
the same mistake **while fixing it**, writing Phase A's new test into the narrative and not into
Phase A's list (the eighth instance). The ninth followed immediately: r13 corrected Phase A's proof
paragraph, manifest and proof block to say the second test is a non-ignored regression guard, and
left two O7 sites still calling it an ignored test "required to fail at the test-first commit" — a
live instruction to make a test fail that provably cannot. From r12 the sweep asserts, for every
test name the plan mentions, that it appears as a list entry, and from r13 it also greps for the
claim a correction just overturned. The closure round then exposed **two further shapes** the sweep
still did not cover: a mechanism corrected in O7 while the **decision record** and a neighbouring
bullet still asserted the old rule (R14-01, R14-06), and a test named in one phase's **prose** while
listed under a **different phase** (R14-04) — so Phase B's proof would never have executed the only
fixture that discriminates descriptor-relative replacement. The lesson for a successor is blunt:
spot-fixing the sites a lens names is what produced twelve instances. Every mechanism change needs a
full-file reconciliation of **all** sites mentioning that mechanism — prose, lists, counts, decision
records and phase manifests — performed *before* the snapshot, not after a report arrives. — and its first run produced four hits, all four of which
were false positives (a function name, a crate macro path, a deliberately unlisted test, and one
whose module prefix the matcher failed to parse). A crude sweep is worth running and never worth
trusting unchecked.

## Evidence E1–E13

Measured on real `windows-latest` runners, throwaway branch `probe-windows-atomic-1` (runs
35057909143, 35058533966, 35059003792; branch deleted). Probe rounds 1–2 are recorded because their
uniform `ERROR_ACCESS_DENIED` was a **defect in the probe** (handles lacked `DELETE`, buffers were
1-aligned), not a property of NTFS. Full transcript: `/tmp/build-88901a42-winatomic/MEASUREMENTS.md`.

* **E1** descriptor-relative rename exists via NT, not Win32: `NtSetInformationFile` with
  `FileRenameInformationEx` + `RootDirectory` → SUCCESS; the Win32
  `SetFileInformationByHandle` form with `RootDirectory` → os error 87. `FileRenameInformation = 10`,
  `FileRenameInformationEx = 65`; x64 layout union@0, `RootDirectory`@8, `FileNameLength`@16, `FileName`@20.
* **E2** parent-directory flush works only on a writable handle: `GENERIC_READ` → os error 5;
  `GENERIC_READ|GENERIC_WRITE` → SUCCESS; `GENERIC_WRITE|SYNCHRONIZE` → SUCCESS;
  `FILE_LIST_DIRECTORY|FILE_TRAVERSE` → os error 5.
* **E3** no-replace rename exists: `STATUS_OBJECT_NAME_COLLISION` (0xC0000035).
* **E4** identity stable across the rename and equal to the target.
* **E5** `ChangeTime` tracks a rewrite; `last_write_time` is what the consumer reads. Not adopted
  here (R1-01/R1-08); retained for `f-20260914-29`.
* **E6** replacing an open target needs the other holder to share DELETE
  (`STATUS_SHARING_VIOLATION`, 0xC0000043).
* **E7** no atomic directory replace on NTFS; the two-rename fallback has a real crash window.
  Recorded for `f-20260914-12`.
* **E8** exclusive create works (`FILE_CREATE`; second attempt os error 80).
* **E9** the Unix contract being reproduced (`unix::replace_at`, `fs.rs:996-1185`).
* **E10** test reachability, verified per test: 36 need only the primitive, 11 additionally the
  missing-leaf fix, 1 a Windows directory open in scaffolding, 15 (all `pgn.rs`) out of slice.
  **48 in slice, not 63.** (The 36/11/1 split is r16's correction of an earlier 35/11/2; the total
  never changed.)
* **E11/E12** source facts verified during round-2 and round-3 triage (pin counts, `is_write_operation`,
  whole-path `identity()`, the `save_entries_with_baseline` retry, the null security descriptor).
* **E13** the correction of the round-6 error, above.

**Marker accounting (measured per file, final after r16).** Phase B = `db/search_index.rs` 14,
`engine/types.rs` 1, `fs.rs` 11, `game.rs` 1, **`infra/fs.rs` 6**, `main.rs` 3 → **36**.
Phase C = `chesscom.rs` 3, `fs.rs` 8 → 11. Phase D = `db/search_index.rs` 1 → **1**. Total 48 in
slice. **Corrected in r16/r17 (R15-01, R16-01):** r15 moved
`retained_parent_descriptor_installs_without_reopening_a_target_path` from Phase D to Phase B and
this paragraph kept the old split (B 35 / `infra/fs.rs` 5 / D 2) for two revisions — the defect
`review-plan` caught at r16, in the one record that is tracked and durable. Executed-test counts
follow: **B 36 + 18 = 54, C 11 + 4 = 15, D 1 + 3 = 4**, and Phase A's 2 non-ignored guards sit
outside the 48. Tree-wide the markers are 63 `f-20260914-10` + 18 `f-20260914-11` = 81, unchanged
from `d-20260916-01`.
`path_authority/mod.rs` carries **zero** markers.

**Ownership correction (R10-03/R11-03).** The 15 `pgn.rs` markers were all labelled
`f-20260914-10` by this slice's own commit `aadc4dd5`, and that is wrong: every one is blocked at
fixture construction by `create_pgn_export_destination` (`resolved_for` `pgn.rs:1048-1066` and
`writable_for` `:1133-1152` both call it), which is `f-20260914-08`'s surface. **11 of them never
reach `replace_pgn_atomic` at all** — 9 read/scan/cache tests plus the two `shutdown_cancels_*`
tests, which cancel at the held edit lock and assert the file is unchanged
(`queued_edit_shutdown_preserves_file` `:1874-1932`). Those 11 re-own to `f-20260914-08`. The **4
mutation tests keep `f-20260914-10`**, because once f08 lands they are blocked next by the
`replace_pgn_atomic` refusal this slice adds (R9-03) — labelling them f08 would name only the first
blocker (review-root-cause 99, correcting an r11 overcorrection that three other lenses had passed).
**This is the clearest caution in the record:** review-correctness, review-tauri-security and
review-plan all closed the all-fifteen version approvingly, and one lens alone was right. Lens
agreement is evidence, not proof, and a majority of approvals never settled a question in this run.
`d-20260916-01`'s accounting therefore becomes **81 = 52 `f-20260914-10` + 18 `f-20260914-11` + 11
`f-20260914-08`**, and its "40 refusal sites / 29 body / 11 guard" record becomes 36 sites once
R9-03's new guard row lands (R11-07).

## Assertions that did not discriminate — the run's second recurring class

Alongside the split-record failures, one question kept returning across rounds 3, 4, 5, 8, 9, 11 and
12: **does each named test actually go red if the thing it guards regresses?** Three findings in
round 12 are the sharpest instances, and two concern claims the plan made about code that was
readable the whole time:

* `retained_parent_descriptor_installs_without_reopening_a_target_path` (`infra/fs.rs:4424-4440`)
  opens `parent`, replaces through it, then reads back via `dir.path().join(...)`. It **never
  invalidates or moves the directory**, so a pathname-reopening implementation passes it. The plan
  asserted the opposite from **r5 to r12** — twelve rounds of a false claim about existing source.
  The fix extends the test to rename the directory after `parent` is opened.
* `windows_missing_non_final_component_is_refused`, added in r12, **cannot fail before the change**:
  `resolve_windows` already opens every component through `open_windows_child(...)?`
  (`resolved.rs:809-815`). It is a regression guard, not a failing-before anchor.
* The Windows DACL assertion added in r11 had **no observation mechanism**: `inject` receives only a
  fault-point enum and no handle, while `FILE_SHARE_READ` stays disabled until the ACL is set, so
  nothing could inspect the live temporary.

Because the class kept returning after disposition, rule 12a's remedy applied: broad seven-lens
fan-out was stopped on this question and a **focused architecture judgment** was obtained instead of
a thirteenth broad round. It returned **REVISE** with three blockers and, more usefully, with the
general rule the twelve rounds had been groping toward:

* an artefact the implementation produces can attest to **ordering** and **returned outcomes**,
  never to **occurrence**;
* occurrence and receiver identity belong to **exact source assertions**;
* a runtime observer proves a property only if it can be placed **before** the code that could
  subvert it.

Measured against those rules, three obligations were reaching for the wrong mechanism. **J-01 (98):**
the Windows DACL observer ran "before the first write", which is still *after* ACL setup, so an
implementation could create the temporary with `SecurityDescriptor: null_mut()` and
`FILE_SHARE_READ`, apply a restrictive ACL, then call the observer — green while the creation race
survived. **J-02 (96):** "logs a completed identity query" did not prove the query used the retained
handle, since `windows_identity(path)` passes an uncontended fixture. **J-03 (92):** the
`DURABILITY_LOG` is written by the implementation under test, so replacing `dir.sync_all()` with
`Ok(())` plus the log entry stayed green — a mechanism introduced in r8 and relied upon for five
rounds could not prove its own premise. The judgment explicitly endorsed the *existing* source pins
for the `TargetStat`/`TempMetadata` and parent-flush error arms as honest, and endorsed keeping the
test-first and count checks and the corrected moved-directory fixture.

A successor should apply the three rules above directly rather than re-deriving them, and should
treat "is this assertion discriminating?" as the default question for every named test in O7.

## Skips upheld with recorded evidence

* **R3-13** "any pathname re-resolution violates A3" — refuted: `unix::replace` (`fs.rs:964-995`)
  itself re-resolves the logical parent by pathname inside precommit and compares `(dev,ino)` against
  the identity captured at `open_parent`. The shipped Unix contract uses pathname re-resolution as a
  **guard**. Upheld unanimously in rounds 3–9.
* **R4-05** "a successful flush is not proven persistence" — refuted: `unix::replace_at` returns
  `DurableCommit` when `dir.sync_all()` returns success (`fs.rs:1173-1184`), having proven no more.
  The Windows mapping applies the same standard. Upheld rounds 3–9.

Reopening either requires a changed premise or contrary evidence, not a restatement.

## Cut from the slice under A6, and filed

Each is a pre-existing gap this port merely makes **reachable**, not work required to remove the
parent-durability refusal:

* `f-20260916-02` — alternate-stream (`:`) rejection in `validate_components`/`single_leaf`.
* `f-20260916-03` — `UNICODE_STRING` byte length truncated to `u16` in `open_windows_child`.
* `f-20260916-04` — signed manifest verifies the raw URL while transport fetches the normalized one.
* `f-20260916-05` — the download durability warning names neither job nor destination.
* `f-20260916-06` — Windows resolution authenticates only the leaf, not its parent (keeps
  `f-20260915-03`'s containment defect reachable).
* `f-20260916-07` — both renderer adapters discard `durability`; **also annotated** with the two
  backend combine sites (`fs.rs:936` and `install_staged_pgn_artifact` `fs.rs:1012-1021`, reached by
  `chesscom.rs:379`).

Also cut: `sanitize_download_error` category preservation (R6-11/R7-01), and R8-01's "surface both"
combine requirement — **withdrawn as wrong**, because `d-20260906-03` clause (3) and commit
`9d450dc5` pin that a later non-uncertainty error *outranks* the earlier uncertain stage. Adopting
it would have reintroduced the defect `9d450dc5` fixed.

## Round-by-round issue history

* **R1 (21).** Broad structural round. R1-01, -02, -03, -05, -07, -08, -09, -10, -11, -13, -17, -19,
  -20, -21 closed in r2; R1-04→R2-02, R1-06→R2-08, R1-12→R2-13/R2-14, R1-14→R2-03, R1-15→R2-07,
  R1-16→R2-06, R1-18→R2-05.
* **R2 (18).** R2-05→R3-02, R2-14→R3-04…R3-08, R2-18→R3-12; the rest closed.
* **R3 (13).** ADS placement (R3-01), restrictive creation descriptor (R3-02), typed NT statuses
  (R3-03/R3-10), the proof's missing test list (R3-04), R3-12 reversing an earlier Skip on gate
  scope, and R3-13 recorded as an evidenced Skip.
* **R4 (9).** R4-01 was the literal `<test paths…>` placeholder — rejected by all seven lenses.
  R4-03 cut ADS. R4-05 recorded as an evidenced Skip.
* **R5 (8).** R5-01 (ADS still live despite the r4 cut — unanimous), R5-03 (listed download tests
  call helpers below the public guard), R5-04 (fault hooks fire *before* the real calls), R5-05
  (`UNICODE_STRING`, cut and filed).
* **R6 (11, zero approvals).** The orchestrator's error, above, plus genuine findings that survived
  the revert: R6-01 ADS still live (third consecutive), R6-02 the red-before proof impossible,
  R6-04/-05 hook-timing, R6-07 no parent-flush failure test, R6-08 cleanup unanchored, R6-11
  sanitisation outside A6.
* **R7 (9).** R7-01 sanitisation still live in O4; R7-02 O7 lost its test-name lists and shipped a
  `<name>` placeholder (R4-01 reintroduced by the orchestrator's own rewrite); R7-03 Phase B manifest;
  R7-04 new tests skipped by `--ignored`; R7-05 the ParentSync hook cannot reach the real arm;
  R7-09 **the Goal overpromised gzip** — the first change to that section in seven rounds.
* **R8 (6).** R8-01 the combine requirement withdrawn as wrong; R8-02 counts vs lists; R8-03 Phase A
  counted inside the 48 though it has no ignore attribute; R8-04 the flush fixture; R8-05 cleanup
  mechanism and Phase B counts; R8-06 registry record-contract adoption.
* **R9 (9, five approvals).** R9-01 `--ignored` still demanded for Phase A; R9-02 Phase D manifest
  missing `main.rs`; **R9-03 the slice silently unblocked the production PGN edit-existing path**;
  R9-04 missing `pnpm bindings:check`; R9-05 no runnable executed-count carrier; R9-06/-07 unnamed
  fixtures; R9-08 native export is dialog-gated so a command-entry test is undeliverable; R9-09 the
  read-only-parent flush fixture is unreachable.

* **R10 (3, five approvals).** R10-01 a stale entry left in a test list; R10-02 withdrew the
  native-export command-entry test as undeliverable (R9-08); **R10-03 the `pgn.rs` ownership**,
  re-owning all fifteen markers to `f-20260914-08`.
* **R11 (8).** R11-01 two assertion anchors described in O7's prose and present in no filter list —
  the "described but not listed" shape; **R11-03 corrected R10-03's overcorrection** to 11 re-owned
  and 4 kept; R11-07 widened the planned `d-20260916-01` annotation to cover its refusal-site record
  as well as the test split.
* **R12 (7 allocated, R12-03 never issued).** R12-01/R12-02 Phase A: an ignored and a non-ignored
  test in one phase meant no single command could execute both, and the new test provably cannot
  fail before the change; R12-04 recorded Phase B as *extending* the descriptor fixture, which r15
  then relocated outright.
* **Focused architecture judgment (r13, J-01…J-03).** Obtained under rule 12a after the same design
  dispute returned post-disposition. It produced the three rules that now govern O7 and overturned
  three obligations that were reaching for the wrong mechanism.
* **Closure round (r14, 6).** R14-01/-02/-03 stale text contradicting the judgment; R14-04 a test
  named in one phase's prose but listed under another; R14-05 the J-01/J-03 source pins listed in no
  filter; R14-06 a superseded claim in the orchestrator's own bullet.
* **Verification round (r15, 2; 0/4 approvals).** Both findings were consequences of r14's own fix:
  R15-01 the arithmetic never re-derived after moving a test between phases (unanimous, four lenses
  at confidence 100), R15-02 a second ignore-rule site missed when the first was corrected.
* **Verification round (r16, 2; 2/4 approvals).** R15-01 and R15-02 closed by all four lenses from
  source. Two new findings, both records-and-proof rather than design: R16-01 the handoff never
  refreshed by Phase E, R16-02 a filter entry naming the wrong module, which under `--exact` would
  have executed zero tests and made the 54-count proof unreachable.

* **Verification round (r18, 2; 1/2 approvals).** R18-01: the plan's recorded sweep numbers were
  from a buggy first run, and the corrected run still covered only 59 of the 75 listed test paths —
  the fifteen Phase B tests listed as bare names under a shared module header had never been
  resolved against source. R18-02: this handoff still read `r1…r17` with artefacts through r16, so
  R16-01's synchronization was incomplete. **The sweep's own coverage was the last thing to be
  verified, and it was wrong twice** — first a string-suffix comparison that passed R16-02
  silently (`"search_cache_tests".endswith("tests")`), then a token pattern blind to bare names.
  **Final measurement: 75 distinct listed paths = 48 existing + 26 authored + 1 relocation** —
  the 48 being the in-slice ignore-marked tests (B 36 + C 11 + D 1), the 26 the tests this plan
  authors (A 1, B 18, C 4, D 3 — each phase's declared `N new`), and the 1 the Phase A relocation.** There is no "module artefact" category: an earlier revision
  recorded `48 + 24 + 1 + 2`, where two module prefixes scraped from prose exactly offset two
  authored tests the script had silently dropped. **Four extractors were written and all four were
  wrong** — a suffix comparison, then `::`-only matching, then discarding lines containing prose
  punctuation, then failing to strip a header-line prefix so Phase C's first entry vanished. The
  recorded classification is therefore derived from the plan's own phase declarations, confirmed
  test-by-test against source for the 48 and read directly for Phase C's four; `review-correctness`
  derived the identical 48 + 26 + 1 independently. **A total that reconciles is not evidence that
  its parts are classified correctly** — it summed to 75 while both parts were wrong.
  **Every one of the four returned a clean-looking result *because it was not looking*** — which is
  exactly the failure this plan pins against by requiring occurrence to be proven by exact source
  assertion rather than by the absence of a failure. The sweep had been violating the rule it exists
  to enforce.

* **Verification round (r19, 1; 0/1).** `review-correctness` REOPENED R18-01: the recorded
  `48 + 24 + 1 + 2` misclassified planned source-pin tests as module artefacts, and the phase
  declarations imply 26 authored (A 1 + B 18 + C 4 + D 3) + 48 existing + 1 relocation = 75. Correct,
  and the diagnosis went further — the two bogus artefacts exactly offset two authored tests the
  script had silently dropped, so the total reconciled to 75 while both parts were wrong. R18-02,
  R16-01 and R16-02 CLOSED in the same report.
* **Closure round (r20, 0; 1/1 APPROVED).** `review-correctness` CLOSED R18-01 at confidence 100,
  reconciling 75 = 48 existing + 26 authored + 1 relocation independently and confirming the source
  marker counts, `search_cache_tests` (`main.rs:2311`) and the Phase A relocation
  (`mod.rs:6927`/`:7042`). **The last open issue; the review is closed.**

## The shape of the ending, for whoever resumes this

The plan **body** was unchanged from r18 onward — r19 and r20 touched only `## Reviews` and this
record. Of the final six findings, one was a dead test filter and one was arithmetic in Evidence;
the other four were the **records** disagreeing with the plan or with themselves. The design
converged well before the bookkeeping did. Every one of those four was caught by re-measuring
against source, and twice a lens returned APPROVED on a revision that still carried the defect
another lens then found — so **lens agreement was never what settled a question in this run**, and
the completion report says so rather than presenting the ending as a clean convergence.

## Two obligations narrowed after verifying them undeliverable

* **R9-08.** `save_native_export` (`main.rs:721`) calls `DialogExt`/`.blocking_save_file()`
  (`:729-742`) before `save_native_export_blocking` (`:757`), which is what reaches `atomic_replace`
  + `require_durable`. This repo's `verify-ui` contract records native dialogs as unautomatable, so
  the test targets the helper and the wiring is source-pinned.
* **R9-09.** The production parent is a single retained `GENERIC_WRITE` descriptor that also serves
  `FILE_CREATE` and the `RootDirectory` rename, so a read-only parent fails at temp creation; and E2
  measured `GENERIC_WRITE` → SUCCESS, so the call does not fail under production's access mask. A
  Linux fixture was probed and refuted (`sync_all()` returned `Ok` for a read-only directory handle,
  a removed-directory fd, a read-only file, and `metadata()` on a removed file; only `/proc/self`
  errored). The real `Err` arm is pinned by source assertion instead — `d-20260916-01`'s mechanism.

## Scope decided in this review

* **PGN writes are not delivered**, and from r10 that is enforced rather than asserted:
  `replace_pgn_atomic` gains a `#[cfg(not(unix))]` refusal and a pin row, moving the remaining pin
  count from 35 to 36. Without it the port would silently make PGN edit-existing live on Windows,
  because `replace_pgn_atomic` has no cfg gate and production `WritePgn` capabilities come from
  `issue_pgn_workspace` (ungated), not from the refused `create_pgn_export_destination`. It cannot be
  tested here: every write-path PGN fixture routes through `writable_for` (`pgn.rs:1133-1152`) →
  `create_pgn_export_destination`, which is `f-20260914-08`'s surface.
* **`atomic_install_dir` is not ported** (E7); its callers are `f-20260914-12`'s.
* **gzip extraction is not delivered** (R7-09); `download_engine_archive` keeps its guard.
* `f-20260914-10` therefore stays **open** after this slice for the PGN remainder.

## Raw artefacts retained for this run

* Lens reports: `/tmp/build-88901a42-winatomic/codex-r{1..12,14,15,16,18}/lens-*.txt` and the
  focused judgment's `codex-judgment-r13/`, plus round 1's
  `lens-{correctness,error-handling}.codex-retry/lens-*.txt`.
* Plan snapshots per revision: `/tmp/build-88901a42-winatomic/plan-r{1..18}.md`.
* Review packets per round: `/tmp/build-88901a42-winatomic/lens-*-r{2..18}.prompt`, with the
  round inputs in `inputs-r{2..18}.*`.
* Deltas: `tasks/plans/.plan-delta-r{6..15}.diff`; r16's is
  `/tmp/build-88901a42-winatomic/plan-delta-r16.txt`, kept out of `tasks/plans/` because
  `.plan-delta-r16.diff` there belongs to an unrelated plan reviewed earlier the same day. r17's and
  r18's are `plan-delta-r17.txt` and `plan-delta-r18.txt` beside it, with the cumulative packet
  delta in `plan-delta-r16-to-r18.txt`.
* NTFS measurements: `/tmp/build-88901a42-winatomic/MEASUREMENTS.md`.

These are temporary paths and will disappear; this record and the ledger entries are written so the
history is recoverable without them.
