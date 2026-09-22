# Plan-review record — f-20260920-19 (the blank-measurement coverage guard)

Durable record of the nineteen-round plan review that produced
`tasks/plans/2026-09-21-coverage-blank-file-guard.md`. **The plan itself is not tracked** —
`.gitignore:70` excludes `tasks/plans/` — so this file is the only surviving copy of the review
history, and the `## Reviews` section below is lifted from it verbatim, raw lens verdicts included.

## Why this record exists, and who must read it

Two reasons, and the second is a prerequisite rather than an archive:

1. Rule 12a requires the full issue and cumulative round history to be preserved in a tracked
   record before the parent mandate closes.
2. **`f-20260921-02`'s ledger entry tells its worker to read this record before starting**, and
   Phases 2b and 3 of that plan *are* that worker. The record is therefore written and committed
   **before** any implementation phase, not at the end. `f-20260921-01` is named inside
   `f-20260921-02` as one of the rows of the same failure matrix.

## The run

* **Finding:** `f-20260920-19` · area `gate-scripts` · filed 2026-09-20 by `review-tests`
  (blocker, confidence 99) in the `$push` review of `2cec0093..HEAD`.
* **Planning run:** 2026-09-21, worktree `/home/felixb/Projekte/chessfable-f19` on branch
  `plan/f-20260920-19`, from `7a061ee5`.
* **19 rounds**, seven Codex lenses on rounds 1–15 and the scoped pair `review-plan` +
  `review-tests` on rounds 16–19 — **119 lens reports**. Round 19 closed with both **APPROVED**.
* **Elapsed:** every round is dated 2026-09-21. Per-round elapsed, wait and active times were not
  instrumented during the run, so they are **unknown** and are recorded as unknown rather than
  reconstructed after the fact.
* **Implementation run:** 2026-09-22, main checkout `/home/felixb/Projekte/chessfable` on
  `master`. Nothing in the plan had been implemented when this record was written.

## Inherited issue IDs

Issue series **I through AJ**: **155 unique issues opened, 155 dispositioned, 0 open at closure**,
counted from the per-round tables below rather than from any summary. The tables carry each
witness, claim, disposition and reason.

Dispositions other than `Fix`, which are the ones a later reader is most likely to re-litigate:

* **I14** — `review-minimalism` (96) called the acceptance oracle a repetition of the guard's own
  validation. `Skip` in r1, kept as an oracle independent of `parseLcov`; then withdrawn entirely in
  r4 for the stronger reason recorded under round 4 — it could only be right by reproducing
  `filesBelow` and `parseLcov`, at which point it is a second copy of the gate.
* **J3 / I1** — `review-tests` (99) held that the residual hole in condition 3 fails the "every
  production file" mandate. Arbitrated `Skip` in r2: an allowlist whose entries may not be blank is
  not an allowlist, the residual is bounded to three named files, and closing it needs the
  parser-backed statement-free check that is explicitly out of scope and already filed as
  `f-20260920-20`. The raw `REVISE` stands unchanged. `review-tests` returned APPROVED over r3 and
  did not re-raise it.
* **L8** — `review-code-quality` (95): "every production record still accounted for" overstated the
  oracle. **Moot**, because r4 withdrew the oracle.
* **M1** — `review-error-handling` (blocker, 99): `writeBaseline` warns and returns after `oxfmt`
  fails. **Defer — filed** as `f-20260921-01` (commit `7910b680`). r6 then routed it back into the
  run under rule 4b as Phase 2a; the finding stays on disk and is closed by that phase.
* **P9** — `review-minimalism` (93) objected to threading `options.config` through only to print a
  path. `Skip`: two configs share this one script, so "the coverage configuration" is ambiguous
  exactly where the reader needs the filename.
* **X2, X3, X5** — **Split out** in r9 into `f-20260921-02` (the unreachable LCOV-loop branch, the
  `rename` path the atomic write adds, and the missing/duplicated wrong-shape rows). **X8, X9, X10**
  — **Transferred** to the same finding. r10 reversed the split 6 lenses to 1; the finding stays
  filed, carries the enumeration and the measured corrections, and is closed by Phases 2b and 3.
* **X6** — `review-root-cause` (96): the raw-import negative control had never actually been run.
  **Accepted as a stated limitation**, because the planning worktree had no `node_modules`; it is
  acceptance criterion 4's work and belongs to the implementation run.
* **X7** — `review-correctness` (100), with a probe: the signal-kill premise is false.
  **Corrected in `f-20260921-02`** rather than in the plan, since the matrix went with the split.
* **X11** — `review-minimalism` (93) called the `format.ts` experiment unnecessary Phase 1 scope.
  `Skip`: O6 owns the `docs/coverage.md` paragraph describing this defect class, and a narrower
  class makes that paragraph false, so the experiment is kept.
* **T1 / Z15** — `review-plan` (100) and `review-minimalism` (100) held that phases sharing
  `scripts/coverage-report.mjs` contradict independent, file-cohesive commits. `Skip`, arbitrated:
  rule 4a cuts by area cohesion, and file-disjointness only makes an *order* free. The same lens
  accepted this reading in r8 at the same confidence it rejected it in r11.
* **AD2** — `review-minimalism` (86) called the enumerated scope-mismatch message an expansion of
  maintenance surface. `Skip`: `review-error-handling` asked for exactly that at 87 for the
  opposite reason, and the accurate message wins.

There are therefore **seven `Skip` dispositions** — I14, J3, P9, T1, X11, Z15 and AD2. The plan's
own closing tally says "four `Skip`s"; it counts the paired IDs I1/J3 and T1/Z15 as one each and
omits X11. The measured count is the one recorded here.

## What the review established that implementation must not undo

* **Never** rewrite `coverage-baselines.json` through `coverage:baseline:frontend` or
  `--write-baseline`; the `scope` subtree is hand-edited and proved scope-only by O3's parsed-object
  comparison, run before the Phase 1 commit or afterwards against `HEAD~1`.
* **When a correct and a broken implementation leave the same final state, assert the action.**
  Three separate fixtures in this run were shown unable to fail: the acceptance oracle (r2–r4), the
  declared partial-zero predicate (r12), and the cleanup fixture (r16–r18). The cleanup cases
  assert the injected `unlink` **was called**; the declared partial-zero fixtures exist because an
  any-zero-metric predicate would otherwise pass every other case.
* **Rebuild the failure matrix from source.** Five consecutive rounds corrected a matrix assembled
  from the previous matrix, and each inherited its errors. Two grep passes plus a control-flow
  reading; do not copy the table out of `f-20260921-02`, which is annotated twice with corrections
  for exactly this reason.
* **Seven orchestrator assertions were disproved by a lens probe** and re-measured before adoption:
  the signal-kill premise, the wrong-shape baseline row, `assertAreaFloors`' reachability,
  `format.ts`'s coverage, the stale-file redirection claim, the vacuous post-rename cleanup case,
  and the vacuous cleanup outcome assertion. Rule 12b, inside a plan whose own O3 makes that
  argument.
* **Two reversals of the arbiter's own decisions**, kept rather than tidied: the r9 rule-12a split
  of Phases 2a/2b/3 and its r10 reversal on 6 lenses to 1, and the r13→r14 formatter seam added and
  then removed. The next run to hit rules 4b and 12a together will need the reasoning more than the
  conclusion.
* **Two edit-tooling losses**, both detected by the next round and recorded: the r9→r10 whole-document
  duplication, and r13's AB1 fix that aborted before reaching disk and existed only in a transcript.

## Metrics

Counted from the per-round disposition tables in this file, with each round's continuation entries
folded into that round.

* `plan_adopted_per_round` (adoptions, i.e. `Fix` dispositions, per completed round):
  `r1=15 r2=10 r3=8 r4=9 r5=8 r6=9 r7=12 r8=10 r9=2 r10=8 r11=16 r12=13 r13=4 r14=6 r15=2 r16=2
  r17=2 r18=2 r19=0`.
* Unique issues opened: **155**. Resolved: **155**. Open or deferred at closure: **0**.
* Non-`Fix` dispositions: 7 `Skip`, 1 `Defer` (filed, then worked in-run), 1 `Moot`, 3 `Split`,
  3 `Transferred`, 1 `Accepted as a stated limitation`, 1 `Corrected in the successor finding`.
* One issue's adopted correction was later **withdrawn**: AG1's "cleanup fails after a successful
  rename" fixture, withdrawn by AH1 in r16 as vacuous.
* Rewrite/split lineage: **no rewrite** of the mandate — O1–O6 unchanged since r5. **One split**
  (r9: `f-20260921-02` filed, `f-20260921-01` already filed in r5) and **its reversal** (r11).
* Per-round elapsed, wait and active time: **not instrumented, unknown**.
* Downstream rework: not measurable at the time this record was written; the implementation run had
  not started.

## The plan's obligations, in one line each

* **O1** — a measured production file whose merged LCOV totals are
  `lines.total === 0 && functions.total === 0 && branches.total === 0` fails the gate unless
  declared. The rule sits in `buildCoverageReport`, so it also guards `--write-baseline`.
* **O2** — a per-source `statementFree` list of exact literal paths with reasons, reaching
  `scopeSignature`, with three failure conditions: undeclared blank, dead declaration, and a
  declaration that has become a lie. One named residual: a declared file that gains statements
  *and* is raw-imported stays blank and is not caught.
* **O3** — the frontend baseline's recorded `scope` is hand-edited and proved scope-only.
* **O4** — one error naming every offending file, with an instrument-neutral cause clause, plus the
  rewritten scope-mismatch message that no longer recommends the denied baseline writer.
* **O5** — thirteen cases in `scripts/coverage-report-tests.mjs`.
* **O6** — `docs/coverage.md` and `CLAUDE.md:74`, whose "only guard" sentences become false.

## The implementation run, 2026-09-22 — appended after the record was first written

No further review round ran: round 19 had closed with both lenses APPROVED and every issue of the
I–AJ series dispositioned. What follows is what implementation added to the history, recorded here
because `tasks/plans/` is gitignored and this file is the durable end of that thread.

**Commits**, in order: the record above; `feat(coverage)` (Phase 1, the guard); `fix(coverage)`
(Phase 2a, the baseline writer, closing `f-20260921-01`); `refactor(coverage)` (Phase 2b, the dead
check, part of `f-20260921-02`); `docs(coverage)` (Phase 3, the failure matrix, closing
`f-20260921-02`); then one commit per ledger mutation.

**Decisions allocated:** `d-20260922-04` (the declaration list over three more `exclude` entries),
`d-20260922-05` (the residual hole shipped, stated and pinned — the I1/J3 arbitration),
`d-20260922-06` (Phases 2a, 2b and 3 in the run under rule 4b, not as mandate obligations),
`d-20260922-07` (the negative control's three runs, with exit statuses and stderr, and the
`format.ts` experiment), `d-20260922-08` (the partial supersession of `d-20260830-08`'s "only
guard" clause, which `set-trailer` records at the target).

**The negative control ran, and the plan's `X6` limitation is discharged.** Green before, exit 0;
a throwaway `?raw` import of `src/components/boards/EditingCard.tsx` took it from `LF:19` to blank
and the gate to exit 1 naming exactly that file; a second never-imported file beside it produced
one message naming both, sorted; green restored, exit 0. Full text in `d-20260922-07`.

**The `format.ts` experiment came out the way `review-tests` suspected in round 8, and the plan was
right to keep it over `review-minimalism`'s X11 objection.** Raw-importing a file that other tests
import as a module does **not** blank it: `format.ts` kept `LF:56 LH:19 FNF:18 FNH:6 BRF:35 BRH:7`
and the gate stayed green. Only a file absent from the v8 map can be blanked. `docs/coverage.md`
described the class more widely than that and was corrected in the Phase 1 commit — so the
"finding about the existing paragraph" the plan anticipated was handled in place rather than filed,
the paragraph being inside the commit's own scope.

**Downstream rework, the metric the record left open.** Two defects in the delegated Phase 1 work,
both caught by the orchestrator's diff review before the commit, neither traceable to the plan:
the existing exclude-driven scope-mismatch assertion had been *replaced* by the new
`statementFree` one instead of joined by it, and the corrected `CLAUDE.md` sentence read badly.
Both are one-line repairs. No plan obligation was found wrong during implementation, and no
acceptance criterion had to be renegotiated.

**One departure from the plan's letter, recorded rather than left to be noticed.** The plan's
acceptance criterion 5 calls row 9 "a scratch config whose `statementFree` differs from the
committed baseline's recorded `scope`". No such config exists: adding a declaration trips
condition 2 or 3, removing one trips condition 1, and the order is normalised — so a config with a
different list cannot reach `assertBaseline` at all. The row was staged the other way round, with a
scratch *baseline* whose recorded scope is one `statementFree` entry stale, which is also the
realistic case: the config edited and the baseline not re-recorded. The obligation — that the
rewritten message be proved at the CLI, with its stderr and exit status — is met in full.

**The matrix is larger than the plan's upper bound, as the plan expected.** Rebuilt from the source
rather than from `f-20260921-02`'s table: **39 distinct failure paths**, all staged and none argued,
plus one swallowed cleanup path and one shared sink. The plan named "roughly 36 plus one shared
sink" as an upper bound on a table that had never been rebuilt.

---

The remainder of this file is the plan's `## Reviews` section, verbatim.

## Reviews

Append-only. Raw lens verdicts are preserved exactly as returned.

### Round 1 — 2026-09-21, seven Codex lenses over r1

No prior history existed; this was the first round. Raw verdicts: `review-plan` **REVISE**,
`review-correctness` **REVISE**, `review-code-quality` **REVISE**, `review-minimalism` **APPROVED**,
`review-tests` **APPROVED**, `review-error-handling` **APPROVED**, `review-root-cause` **APPROVED**.
Reports kept at `$RUN_TMP/../reports-r1/lens-*.txt`.

| ID | Witness(es) | Claim | Disposition |
| --- | --- | --- | --- |
| I1 | `review-correctness` (blocker, 99) | Condition 3 misses a declared file that gains code *and* is raw-imported | **Fix** — claim narrowed in O2, residual hole named, pinned by O5 case 7 |
| I2 | `review-plan` (blocker, 97), `review-correctness` (99), `review-root-cause` (99) | Negative control may pick a declared file and prove nothing | **Fix** — target named as `src/utils/format.ts`, three results required |
| I3 | `review-correctness` (99), `review-code-quality` (99) | Acceptance `awk` checks only `LF:0` and scans non-production records | **Fix** — replaced with the three-metric oracle in acceptance 5; non-production concern answered by the measured 232/232 identity |
| I4 | `review-code-quality` (blocker, 99) | O1 states the conjunction and then calls `lines.total === 0` the same rule | **Fix** — predicate stated once, the coincidence explained as an instrument observation |
| I5 | `review-code-quality` (97) | Serialized `statementFree` contract underspecified | **Fix** — exact contract in O2 |
| I6 | `review-code-quality` (93) | Dead-entry rejection may exceed MANDATE | **Fix** — MANDATE obligation named in O2; condition 2 justified as what keeps condition 3 evaluable |
| I7 | `review-code-quality` (97) | R1 promises `tasks/decisions.md`, Phase 1 omits it | **Fix** — added to the file list |
| I8 | `review-plan` (blocker, 96) | `git diff --stat` cannot prove a scope-only edit | **Fix** — replaced with the parsed-object proof in O3 |
| I9 | `review-plan` (blocker, 95), `review-error-handling` (96), `review-tests` (93) | No multi-file, exact-message or CLI exit-status proof | **Fix** — O5 cases 2 and 10, O4 message contract |
| I10 | `review-plan` (93) | Supplied FILES list included files Phase 1 omits | **Fix** — explicit read-but-not-changed list |
| I11 | `review-plan` (blocker, 99) | No `## Reviews` section and no empty-history marker supplied | **Fix** — this section; round ≥ 2 prompts carry it |
| I12 | `review-tests` (95) | No test proving literal, non-glob matching | **Fix** — O5 case 6 |
| I13 | `review-tests` (89) | No test that a changed list actually reddens the scope check | **Fix** — O5 case 9 |
| I14 | `review-minimalism` (nit, 96) | Acceptance repeats the guard's own validation | **Skip** — kept deliberately as an oracle independent of `parseLcov`; reason recorded at acceptance 5 |
| I15 | `review-minimalism` (nit, 93) | `coverage:report:test` duplicated by `gates:contract:check` | **Fix** — folded into acceptance 6 |
| I16 | `review-root-cause` (nit, 96) | "CI green on the pushed SHA" is delivery evidence, not root-cause proof | **Fix** — moved out of the numbered criteria |

Open issues after r1 triage: none. Every issue is dispositioned; I1 is closed by a narrowed claim
plus a pinning test rather than by a mechanism, which is itself a substantive correction and needs
an explicit reviewer closure check in round 2.

### Round 2 — 2026-09-21, seven Codex lenses over r2

Raw verdicts: `review-plan` **REVISE**, `review-tests` **REVISE**, `review-minimalism` **APPROVED**,
`review-correctness` **APPROVED**, `review-code-quality` **APPROVED**, `review-error-handling`
**APPROVED**, `review-root-cause` **APPROVED**. Reports kept at
`$RUN_TMP/../reports-r2/lens-*.txt`.

**I1 closure check (the r1 correction that changed a claim rather than a mechanism): closed.**
Six of seven lenses returned an explicit closure result accepting it — `review-plan` ("accepted;
the mandate specifies the allowlist guard, not a parser-backed source check"), `review-root-cause`
("CLOSED, confidence 96"), `review-correctness` ("CLOSED against r2"), `review-code-quality`,
`review-error-handling` and `review-minimalism`. `review-tests` dissented at confidence 99, holding
that the stated residual does not satisfy the "every production file" mandate.

**Arbitration on that dissent — `Skip`, with the reason recorded.** The MANDATE prescribes "an
allowlist of the genuinely statement-free files … configured beside the scope in
`coverage-areas.json`". An allowlist whose entries may not be blank is not an allowlist; the
residual is a property of the mechanism the finding itself specifies, not an omission in this plan.
Closing it needs a parser-backed statement-free check, which is out of scope by the third bullet of
`## Not part of this task` and is the same open design question already filed as `f-20260920-20`.
The residual is bounded to three named files, documented in `docs/coverage.md` (O6) and pinned as
O5 case 7. A rejected alternative was weighed and is recorded here rather than adopted: pinning a
content hash of each declared file in the config would close the hole exactly and without a parser,
but it reddens the gate on every ordinary edit to `src/platform/native.ts`, and it is scope beyond
MANDATE that the adoption gate would reject. This is the arbiter's call under rule 12a; the raw
`REVISE` stands unchanged.

| ID | Witness(es) | Claim | Disposition |
| --- | --- | --- | --- |
| J1 | `review-plan` (blocker, 99) | `tasks/decisions.md` absent from the FILES manifest; record content unspecified | **Fix** — Phase 1 entry now specifies the clause-1 record and its two calls; the r3 prompt manifest names the file |
| J2 | `review-plan` (94) | O6 leaves `docs/coverage.md`'s "only guard" sentence contradicting the new gate | **Fix** — O6 now requires correcting it |
| J3 | `review-tests` (blocker, 99) | I1 remains open | **Skip** — arbitrated above |
| J4 | `review-tests` (blocker, 99), `review-error-handling` (92) | Acceptance 5 only printed and always exited 0 | **Fix** — now throws on mismatch |
| J5 | `review-tests` (95) | No test with one zero metric and non-zero others | **Fix** — O5 case 10 |
| J6 | `review-tests` (92), `review-error-handling` (94) | Conditions 2 and 3 untested for multi-offender naming and distinct messages | **Fix** — O5 cases 4, 5 and 11 |
| J7 | `review-tests` (98) | O3 proof never asserted that `scope` differs | **Fix** — both halves now asserted |
| J8 | `review-minimalism` (nit, 99) | R1 stale: `f-20260920-06` is handled as `d-20260921-01` | **Fix** — R1 withdrawn, the settled fact recorded; verified against `tasks/decisions.md:3768` and commit `7a061ee5` |
| J9 | `review-correctness` (99), `review-code-quality` (99) | O1 cited acceptance criterion 6 for the oracle, which r2 moved to 5 | **Fix** |
| J10 | `review-correctness` (99), `review-code-quality` (99) | The residual-hole paragraph cited Q2, which is about the backend migration | **Fix** |
| J11 | `review-code-quality` (88) | O3's runnable proof used an undefined `$RUN_TMP` | **Fix** — concrete path |

Open issues after r2 triage: none. J3 is dispositioned `Skip` with its evidence; every other issue
is corrected in r3. J4 and J7 are substantive corrections to verification semantics and need an
explicit reviewer closure check in round 3.

### Round 3 — 2026-09-21, seven Codex lenses over r3

Raw verdicts: `review-plan` **REVISE**, `review-correctness` **REVISE**, `review-error-handling`
**REVISE**, `review-minimalism` **APPROVED**, `review-tests` **APPROVED**, `review-code-quality`
**APPROVED**, `review-root-cause` **APPROVED**. Reports kept at `$RUN_TMP/../reports-r3/lens-*.txt`.

**J4 and J7 closure checks: closed by all seven lenses**, each returning an explicit result against
r3. `review-correctness` additionally confirmed the oracle's exit status by running it standalone.

**I1/J3 is settled.** `review-tests`, the sole dissenter in r2, returned **APPROVED** over r3 and
did not re-raise it. No lens re-opened it. The arbitration recorded under round 2 stands, now
without a live objection.

| ID | Witness(es) | Claim | Disposition |
| --- | --- | --- | --- |
| K1 | `review-plan` (blocker, 99), `review-correctness` (blocker, 99), `review-code-quality` (100), `review-tests` (100) | Acceptance 3 still quoted r2's output string, which the J7 correction changed | **Fix** |
| K2 | `review-correctness` (95) | The oracle counted blank records outside the measured set, which `buildCoverageReport` ignores — a false red | **Fix** — oracle restricted through `coverage-scope.mjs`; r3's reliance on the 232/232 identity dropped as not a property of the format |
| K3 | `review-plan` (blocker, 96) | Conditions 2 and 3 had no recorded per-assertion failure matrix against the artefact; unit tests do not substitute | **Fix** — acceptance 5 is now that matrix |
| K4 | `review-plan` (91) | O1 claims the guard protects `--write-baseline`, but no proof exercised that branch | **Fix** — O5 case 12, on a scratch config and scratch baseline path |
| K5 | `review-plan` (92), `review-error-handling` (95) | The existing scope-mismatch message names only include/exclude globs and recommends the baseline writer, which O3 forbids | **Fix** — O4 now requires updating it |
| K6 | four lenses (nit, 99–100) | "all ten O5 cases" stale after r3 added case 11 | **Fix** — now twelve |
| K7 | `review-error-handling` (blocker, 97) | A failed `git show` could leave a stale file and the O3 proof print success | **Fix, mechanism corrected** — measured: `>` truncates before the command runs, so the file is 0 bytes and `JSON.parse("")` throws; the proof already failed closed. `&&` added for exit-status propagation, and the measurement recorded in O3 |
| K8 | `review-error-handling` (blocker, 96) | The oracle skipped an unterminated final record that `parseLcov` would merge | **Fix** — the oracle now closes a trailing record |

Open issues after r3 triage: none. K2, K3 and K8 are substantive corrections to verification
semantics and need explicit reviewer closure checks in round 4. An orchestrator editing error also
duplicated the Phase 1 tail and the acceptance section in the working file between r3 and r4; it was
repaired before the r4 delta was taken, and it changed no obligation.

### Round 4 — 2026-09-21, seven Codex lenses over r4

Raw verdicts: `review-plan` **REVISE**, `review-correctness` **REVISE**, `review-error-handling`
**REVISE**, `review-root-cause` **REVISE**, `review-tests` **REVISE**, `review-minimalism`
**APPROVED**, `review-code-quality` **APPROVED**. Reports at `$RUN_TMP/../reports-r4/lens-*.txt`.

**Closure checks: K3, K7 and K8 closed; K2 NOT closed.** K3 was closed by all seven. K7 was closed
by all who checked it, on the supplied measurement. K8 was closed by six; `review-tests` held it
open on the different ground that no fixture omits a trailing `end_of_record`, so reverting the fix
would stay green. **K2 was reported not closed by five lenses** — `review-plan` (99),
`review-correctness` (98, 97), `review-error-handling` (99, 98), `review-tests` (99) and
`review-root-cause` (97) — two of them with probes showing the oracle diverging from the gate on a
stale `SF` record and on duplicate records that `parseLcov` merges.

**Resolution: the oracle is withdrawn, not patched a fourth time.** Every K2 witness pointed at the
same structure — the oracle can only be right by reproducing `filesBelow` and `parseLcov`, at which
point it is a second copy of the gate. Removing it dissolves K2 and `review-tests`'s K8 objection
together, and costs nothing that acceptance 4 and 5 do not already prove. The reasoning is recorded
under `## Acceptance` so a later reader does not re-add it. This is the root-cause repair rather
than the symptom repair, and it is the third time `review-minimalism`'s round-1 nit turned out to
be the correct call.

| ID | Witness(es) | Claim | Disposition |
| --- | --- | --- | --- |
| L1 | `review-plan` (blocker, 96) | `CLAUDE.md:74` carries the same "only guard" claim as `docs/coverage.md` | **Fix** — verified in the file; added to O6 and Phase 1 |
| L2 | `review-plan` (blocker, 97) | `d-20260830-08`'s consequence clause records `scopeSignature` as the only guard, `Superseded-by: -` | **Fix** — verified at `tasks/decisions.md:274-280`; partial supersession through `set-trailer`, with the shrink-allowance mechanism explicitly untouched |
| L3 | `review-plan` (94), `review-error-handling` (96), `review-tests` (99) | O5 case 9 asserted only rejection, not the corrected scope-mismatch message | **Fix** — case 9 now asserts the new text and the absence of the forbidden advice |
| L4 | five lenses (K2, ≥ 97) | The oracle cannot match the gate's measured-set and merge semantics | **Fix by removal** — see above |
| L5 | `review-code-quality` (99) | O3 says `--write-baseline` is not used while O5 case 12 invokes it | **Fix** — scoped to "against the committed baselines" |
| L6 | `review-code-quality` (99) | "Each row uses a scratch config" is false for row 1 | **Fix** |
| L7 | `review-code-quality` (95) | The failure matrix had no durable destination | **Fix** — quoted in the `tasks/decisions.md` record |
| L8 | `review-code-quality` (95) | "Every production record still accounted for" overstated the oracle | **Moot** — the oracle is withdrawn |
| L9 | `review-tests` (94) | One partial-zero example cannot catch an implementation keyed on functions or branches alone | **Fix** — O5 case 10 requires all three permutations |
| L10 | `review-tests` (92) | Condition 2 staged only with absent paths; an `fs.existsSync` implementation would pass | **Fix** — matrix row 2b uses an existing but excluded file |

Open issues after r4 triage: none. L4 is a removal rather than a correction, and L1, L2, L3 and L10
are substantive; all five need explicit reviewer closure checks in round 5.

### Round 5 — 2026-09-21, seven Codex lenses over r5

Raw verdicts: `review-plan` **REVISE**, `review-error-handling` **REVISE**, `review-minimalism`
**APPROVED**, `review-correctness` **APPROVED**, `review-tests` **APPROVED**, `review-code-quality`
**APPROVED**, `review-root-cause` **APPROVED**. Reports at `$RUN_TMP/../reports-r5/lens-*.txt`.

**Closure checks: L1, L2, L3, L4 and L10 closed by every lens that reported them, with no
dissent.** L4 — the withdrawal of the oracle — was put up for judgement rather than asserted, and
`review-root-cause` ("CLOSED BY REMOVAL: the oracle's reasoning holds"), `review-minimalism` ("the
minimal solution and loses no mandate coverage"), `review-correctness`, `review-code-quality`,
`review-error-handling` and `review-plan` each accepted it independently.

| ID | Witness(es) | Claim | Disposition |
| --- | --- | --- | --- |
| M1 | `review-error-handling` (blocker, 99) | `writeBaseline` warns and returns after `oxfmt` fails; `main` then prints success and exits 0 | **Defer — filed** as `f-20260921-01`, committed `7910b680`. Pre-existing, same file, unrelated mandate |
| M2 | `review-error-handling` (91) | O4's "declare it in `<config path>`" cannot be written: `buildCoverageReport` never receives the path | **Fix** — Phase 1 threads `options.config`; decorating in `main` rejected, because the tests need the same message |
| M3 | `review-code-quality` (99) | "only a parser could" contradicts r2's own record of the content-hash alternative | **Fix** — reworded to name both and say neither is adopted |
| M4 | `review-code-quality` (98) | D2 claimed every `src/**/*.{ts,tsx}` module, but the measured set is narrower | **Fix** — scoped to the measured production set, exclusions named |
| N1 | `review-plan` (blocker, 99) | The matrix stages only the new conditions; policy wants every failure path staged or argued | **Fix** — the argument is now explicit, and the one uncovered pre-existing path is M1 |
| N2 | `review-plan` (blocker, 99), `review-code-quality` (95) | Evidence recorded only in `tasks/decisions.md`, not with the artefact | **Fix** — also in `docs/coverage.md`, this instrument's documentation |
| N3 | `review-plan` (blocker, 98) | No ledger closure step; `f-20260920-19` would stay `open` | **Fix** — `set-header --status handled` is part of the phase |
| N4 | `review-minimalism` (nit, 91) | `coverage:report:test` run twice | **Fix** — dropped from the phase proof, with the reason |
| N5 | `review-tests` (95) | O5 asserted the forbidden advice is absent, not that a correct route replaces it | **Fix** — case 9 now requires the O3 route to be named |

Open issues after r5 triage: none. M1 is the only one not fixed here, and it is on disk as a
finding rather than deferred to memory.

**A second, operational one, found by `review-error-handling` in round 7 (confidence 98) and
verified:** this planning worktree sits on `plan/f-20260920-19` at `7a061ee5`, and the
`f-20260921-01` ledger entry was committed to `master` as `7910b680` afterwards. Phase 4's
`set-header f-20260921-01` therefore has no target on this branch. Implementation must run on
`master`, or on a branch rebased onto it, and the preflight must check that both finding ids
resolve before Phase 2 starts.

**One environmental limitation, reported by `review-plan` and worth carrying to implementation:**
this planning worktree has no `node_modules` and no LCOV files, so no lens could re-run a coverage
gate. Phase 1 must therefore run in the main checkout, or in a worktree with its own install; the
plan's proof commands are unexecuted until then, apart from the O3 shell measurement and the
232/232 production-set measurement, which were run in the main checkout and are recorded inline.

### Round 6 — 2026-09-21, seven Codex lenses over r6

Raw verdicts: **REVISE** from all seven — `review-plan`, `review-correctness`, `review-tests`,
`review-code-quality`, `review-error-handling`, `review-root-cause` and `review-minimalism`.
Reports at `$RUN_TMP/../reports-r6/lens-*.txt`.

Closure results: **N2 closed** (four lenses; `review-correctness` at 88 and
`review-error-handling` at 96 dissented on the destination, and r7 resolves that by colocating the
matrix in the artefact's own header instead). **N3 closed**, with `review-plan` noting at
confidence 96 that `--status handled` alone leaves the stale `Blocked` field. **M2 closed** by all.
**N1 NOT closed by six lenses**, each naming different missing paths. **M1's routing rejected by
five lenses.**

**Two corrections here are to my own judgement, not to wording.**

*M1.* r6 kept `f-20260921-01` outside the plan because it is pre-existing and outside the mandate.
Universal rule 4b says in terms that "pre-existing" and "not part of the diff" justify nothing, and
that a same-area finding is handled now; `push-review-policy.md`'s inherited-artefact clause says
the same for an artefact's missing matrix. The defect is in the file Phase 1 changes. **Phase 2 now
fixes it**, as its own commit — which is what rule 4b prescribes for a finding handled along the
way, and what keeps the rule 12a adoption gate satisfied at the same time: it closes
`f-20260921-01`, not the mandate.

*N1.* r6 argued the remaining failure paths away as "pre-existing and covered by
`scripts/coverage-report-tests.mjs:88-329`". That was asserted, not measured — a rule 12b failure
inside a plan that opens by insisting on measurement — and six lenses each found paths it does not
cover. **Phase 3 now builds the complete matrix**, enumerated from the source with `grep`, 26 rows,
each staged or argued. The enumeration is in the plan so the next round can check it against the
file rather than against my recollection.

| ID | Witness(es) | Claim | Disposition |
| --- | --- | --- | --- |
| P1 | `review-correctness` (99), `review-code-quality` (99), `review-error-handling` (99), `review-tests` (99), `review-plan` (93) | M1 wrongly deferred; rule 4b requires same-area handling | **Fix** — Phase 2 |
| P2 | all six | N1: the failure-path argument is incomplete and its coverage claim false | **Fix** — Phase 3, enumerated from source |
| P3 | `review-tests` (99), `review-correctness` (99) | No matrix row for the rewritten scope-mismatch path | **Fix** — row 9, staged because this run changes it |
| P4 | `review-plan` (98), `review-code-quality` (99), `review-minimalism` | `tasks/findings.md` missing from the manifest of the phase that mutates it | **Fix** — Phase 4 owns it |
| P5 | `review-plan` (98) | No tracked review handoff; the history lives only in gitignored `tasks/plans/` | **Fix** — Phase 4 writes `tasks/handoffs/2026-09-21-coverage-blank-file-guard-review.md` before the final gates |
| P6 | `review-plan` (96) | `--status handled` leaves `Blocked: felix-tooling-nod` | **Fix** — `--blocked none` too |
| P7 | `review-correctness` (88), `review-error-handling` (96) | `docs/coverage.md` is adjacent documentation, not the artefact | **Fix** — matrix moves to the script's own header; docs and the decision record link to it |
| P8 | `review-minimalism` (95) | O5 cases 3 and 7 assert the same behaviour | **Fix** — merged into case 3 |
| P9 | `review-minimalism` (93) | Threading `options.config` exists only to print a path | **Skip** — two configs share this script (`package.json:37,40`), so "the coverage configuration" is ambiguous exactly where the reader needs the filename; reason recorded in O4 |
| P10 | `review-minimalism` (92) | The matrix required identically in two tracked files | **Fix** — one canonical copy in the header, links elsewhere |

Open issues after r6 triage: none. P1, P2, P3, P5 and P7 are substantive and restructure the plan
from one phase into four; they need explicit reviewer closure checks in round 7.

### Round 7 — 2026-09-21, seven Codex lenses over r7

Raw verdicts: `review-code-quality` **APPROVED**, `review-error-handling` **REVISE**,
`review-minimalism` **REVISE**, `review-root-cause` **REVISE**, `review-tests` **REVISE**
(`review-plan` and `review-correctness` are recorded in round 8's entry if they arrived late).
Reports at `$RUN_TMP/../reports-r7/lens-*.txt`.

**Closure results: P1, P3, P5 and P7 closed by every lens that reported them. P2 not closed**, for
the fourth time, and for a reason that was finally specific: the enumeration used
`grep "throw new Error"`, which cannot see a rejected promise. Five lenses independently named
`filesBelow` at `:120` and `writeFile` at `:272`.

**The repair is to the method, not the list.** r8 enumerates in two passes — `throw`-shaped
failures and then `await`/`spawnSync`-shaped ones, whose rejections reach `main().catch` at `:337` —
and writes both commands into the plan so the next reviewer re-runs them instead of trusting me.
The matrix grew from 26 rows to 31, splitting the two aggregate rows that hid distinct messages.

| ID | Witness(es) | Claim | Disposition |
| --- | --- | --- | --- |
| S1 | `review-error-handling` (98) | The plan branch is at `7a061ee5` and has no `f-20260921-01`; Phase 4's `set-header` would fail | **Fix** — verified; implementation runs on `master` or a rebased branch, and a preflight check is named |
| S2 | `review-code-quality` (99) | R4 still cited "O5 case 7", removed when P8 merged it | **Fix** |
| S3 | `review-code-quality` (96) | Rollback claimed Phase 2 reverts independently, but Phase 3 and acceptance 7 record its behaviour | **Fix** — the coupling is stated |
| S4 | `review-code-quality` (91) | `scopeSignature`'s docblock describes only measurement globs | **Fix** — extended in the same commit |
| S5 | `review-minimalism` (98) | The area/source check is copied in both loops of `buildCoverageReport` | **Fix** — Phase 2b, own commit; rule 11 at the second copy, rule 4b for the area |
| S6 | `review-minimalism` (nit, 93) | Files owned by two phases | **Fix** — one phase owner per file |
| S7 | five lenses (≥ 97) | The matrix missed `filesBelow` and `writeFile` rejections, and aggregated rows 18 and 23 | **Fix** — 31 rows, two enumeration passes, both commands recorded |

Open issues after r7 triage: none. S5 and S7 are substantive; S7 is P2's fourth correction and needs
an explicit closure check against the *list*, not the prose.

### Round 7, continued — `review-plan` and `review-correctness`

Both **REVISE**, arriving after the other five. Closure results: `review-plan` — P5 and P7 closed,
P1, P2 and P3 not closed; `review-correctness` — P3, P5 and P7 closed, P1 and P2 not closed. Their
P1 and P2 objections are the same ones already fixed above (the branch's missing ledger entry, the
`filesBelow`/`writeFile` rows, row 23's aggregation, the spawn-error proof), which is corroboration
rather than new work.

| ID | Witness(es) | Claim | Disposition |
| --- | --- | --- | --- |
| T1 | `review-plan` (blocker, 100) | Phases share files, contradicting independent file-cohesive commits | **Skip, with the reason written into the plan** — rule 4a cuts by area cohesion, not by file disjointness; disjointness only makes order free, and here the order is fixed by a real dependency. The wording that invited the reading is corrected and per-region ownership is named |
| T2 | `review-plan` (96), `review-correctness` | Row 9 was marked staged but had only a unit assertion | **Fix** — a CLI row for the scope mismatch, with stderr and exit status |
| T3 | `review-plan` (94) | Phase 2's proof never exercised the spawn-error branch | **Fix** — already split into rows 18a/18b and two tests |
| T4 | `review-plan` (98) | Phase 1 changes the reporter tests but its proof does not run them | **Fix** — `pnpm coverage:report:test` restored to the phase proof; r7 misapplied `review-minimalism`'s acceptance-level objection to the phase level |
| T5 | `review-plan` (98) | `coverage:backend:check` was run without first generating backend LCOV | **Fix** — `pnpm test:coverage:backend` precedes it, per `.claude/skills/push/SKILL.md:84-88` |
| T6 | `review-plan` (99) | The supplied FILES manifest omits `tasks/findings.md` and the handoff | **Fix** — added to the round-8 prompt manifest |

Open issues after the full r7 triage: none. T2 and T4 are substantive and need closure checks in
round 8.

### Round 8 — 2026-09-21, seven Codex lenses over r8

Reports at `$RUN_TMP/../reports-r8/lens-*.txt`. Raw verdicts for the two that reported before this
entry was written: `review-plan` **REVISE**, `review-error-handling` **REVISE**.

**Closure results: T1, T2 and T4 closed. S7/P2 not closed — a fifth time.**

T1 is worth recording because it is the one place a lens changed its own mind on the evidence:
`review-plan` held at confidence 100 in r7 that phases sharing `scripts/coverage-report.mjs`
contradicted independent commits, and in r8 accepted the rule-4a reading — "shared files are
allowed when phases are area-cohesive and dependency-ordered".

**S7/P2 failed on arithmetic this time, not on omissions.** r8's prose claimed 31 rows over a table
of 33, and `review-plan` additionally observed that row 22 is a sink rather than a failure of its
own. Two genuine omissions remained: `filesBelow` recurses, so a `readdir` rejection below the
source root is a different stage from one at it; and `spawnSync` reports a signal kill through
`signal` with `status` null, which a `status !== 0` test misses. The table is now 35 labelled rows —
34 distinct failure paths plus the one sink — and the plan states that decomposition instead of a
bare total.

| ID | Witness(es) | Claim | Disposition |
| --- | --- | --- | --- |
| U1 | `review-plan` (blocker, 99), `review-error-handling` (blocker, 99) | The claimed row count contradicts the table; row 22 is a sink, not a failure | **Fix** — counted, stated as 34 + 1 sink, with row 22's nature named |
| U2 | `review-error-handling` (99) | No row for a nested `readdir` rejection or for a formatter killed by a signal | **Fix** — rows 24b and 18c |
| U3 | `review-plan` (99), `review-error-handling` (99) | Rollback still said four commits and rows 24-26 | **Fix** — five commits, rows 26-28 |
| U4 | `review-plan` (96) | Phase 2b is promised as independently green but has no proof; neither source-mismatch branch is covered today | **Fix** — a test per branch in that commit |
| U5 | `review-plan` (99) | The plan called the two source-mismatch messages identical and then claimed they are distinct | **Fix** — they share a template today; Phase 2b's extraction passes the call site in, so rows 3 and 4 get the messages the matrix requires |
| U6 | `review-error-handling` (91) | Phase 2a throws *after* `writeFile` has already replaced the baseline, so "nothing was written" would be false | **Fix** — write to a temporary file, format there, rename on success |

Open issues after r8 triage: none. U1, U2, U4, U5 and U6 are substantive; U6 changes Phase 2a's
mechanism and needs an explicit closure check in round 9.

### Round 8, continued — the remaining five lenses

Raw verdicts: `review-minimalism` **APPROVED**, `review-code-quality` **APPROVED**,
`review-root-cause` **APPROVED**, `review-correctness` **REVISE** (`review-tests` arrived after this
entry and is recorded in round 9). Round 8 total: **4 APPROVED / 3 REVISE**.

S7/P2 split the lenses for the first time: `review-minimalism` and `review-root-cause` closed it
against the source list, `review-code-quality` called the remaining defect "bookkeeping only", and
`review-correctness`, `review-plan` and `review-error-handling` held it open. The arbiter treats it
as open, because `review-correctness` found a class with no row at all rather than a miscount.

| ID | Witness(es) | Claim | Disposition |
| --- | --- | --- | --- |
| V1 | `review-correctness` (blocker, 98) | No row for valid JSON of the wrong shape: `{}` config throws a `TypeError` at `:119`, a `null` baseline at `:185` | **Fix** — rows 23f and 23g, and the completeness claim is now scoped in writing to what the table covers |
| V2 | `review-code-quality` (100) | The writer phase is headed "Phase 2" and referred to as "Phase 2a" | **Fix** — Phase 2a and Phase 2b throughout, both promoted to headings |
| V3 | `review-code-quality` (nit, 96) | O5 jumps from case 6 to case 8 with the explanation only in the history | **Fix** — case 7 is retained as an explicit merged-into-3 note, so the review record keeps pointing at real case numbers |

One process note, from `review-root-cause`: the plan advanced from r8 to r9 while that round was
still reporting, so its verdict covers the r8 delta it was given. That is the intended behaviour of
the snapshot mechanism — each round judges the revision it was handed — but the edits should wait
for the last report of a round, and from round 9 they do.

### Round 8, final — `review-tests`

**REVISE.** Round 8 closes at **4 APPROVED / 3 REVISE**. Its S7 blockers (the row count, the
signal-killed formatter, the nested `readdir`) are the ones r9 had already fixed, but it found one
thing no other lens did, and it is the most consequential finding of the round.

| ID | Witness | Claim | Disposition |
| --- | --- | --- | --- |
| W1 | `review-tests` (95) | `src/utils/format.ts` already has covered records, so a `?raw` import may not blank it and the negative control could stay green while proving nothing | **Fix, after measuring** — `format.ts` is `LF:56 LH:19 FNF:18 FNH:6`, genuinely executed. The control moves to `src/components/boards/EditingCard.tsx`, `LF:19` with zero hits in all three metrics |

**And it opened a question about the defect itself.** Exactly 91 files in this LCOV have non-zero
totals and zero hits — the same count `f-20260920-18` blanked. If that is not a coincidence, a raw
import cannot blank a file another test imports normally, and the class is narrower than
`docs/coverage.md` states. Phase 1 now measures it on both files and records the answer; if it
holds, the existing paragraph is wrong and that is a finding about it. Eight rounds of review on the
guard, and the lens with the narrowest remit was the one that looked at whether the proof could
fail at all.

### Round 9 — 2026-09-21, seven Codex lenses over r9

Raw verdicts from the four that reported: `review-plan` **REVISE**, `review-correctness`
**REVISE**, `review-error-handling` **REVISE**, `review-root-cause` **REVISE**,
`review-code-quality` **REVISE**. Reports at `$RUN_TMP/../reports-r9/lens-*.txt`.

Closure results: **U4 and U5 closed** by `review-plan`. **S7/P2, U6 and W1 not closed.** W1's new
target was accepted as sound; what kept it open was that acceptance 4 still named the rejected file.

**This round is where the run's shape changed, so the reasoning is recorded in full.**

Three things arrived together. `review-plan` (confidence 98) and `review-root-cause` (confidence 94)
found that Phase 2a **fails the rule 12a adoption gate** — it states that `f-20260921-01` is outside
the mandate and adopts it anyway, and no obligation of the blank-measurement mandate fails without
it. Four lenses found that matrix row 4, the LCOV-loop source mismatch, is **unreachable**, because
the production-file loop has already validated the same relation — so it can be neither staged nor
honestly argued until that is settled. And r9's own U6 correction, making the baseline write atomic,
**created a new failure path** (`rename`) that the matrix did not have, which is the fourth
consecutive round in which correcting the matrix enlarged it.

That is the same design dispute returning after disposition — r6 settled it one way on five lenses,
r9 reopens it on the mandatory lens — and rule 12a's answer is not another fan-out. The evidence for
a genuinely separable mandate is this plan's own history: O1-O6 have been stable and closed since
r5, while every round from r6 to r9 churned inside the added scope, the matrix going 26 → 31 → 33 →
37 rows without converging.

**Disposition: split, under rule 12a.** The artefact repair and its matrix are filed as
`f-20260921-02` with the enumeration, the unreachable-branch question as its `Open question`, and a
pointer to this review record; `f-20260921-01` stays open and is named inside it as one of its rows.
Rule 4b's requirement is met the way the split clause prescribes — a filed finding plus a tracked
handoff naming the inherited IDs — not by dropping the work.

| ID | Witness(es) | Claim | Disposition |
| --- | --- | --- | --- |
| X1 | `review-plan` (98), `review-root-cause` (94) | Phase 2a fails the adoption gate | **Fix by splitting** — `f-20260921-02` |
| X2 | `review-code-quality` (98), `review-error-handling` (99), `review-root-cause` (99), `review-plan` | Matrix row 4 is unreachable | **Split out** — it is `f-20260921-02`'s `Open question` |
| X3 | `review-plan` (98), `review-error-handling` (99), `review-code-quality` (98), `review-root-cause` (97) | U6's atomic write adds a `rename` path the matrix lacks, with no cleanup specified | **Split out** — recorded in `f-20260921-02` |
| X4 | `review-plan` (100), `review-code-quality` (100), `review-error-handling` (99), `review-root-cause` (99) | Acceptance 4 still named `src/utils/format.ts` after W1 moved the control | **Fix** — acceptance 4 now names `EditingCard.tsx`, and requires the `format.ts` experiment to be recorded whichever way it comes out |
| X5 | `review-plan` (96), `review-root-cause` (99), `review-code-quality` (98) | Row 23g bundles the `:186` wrong-version throw already covered by row 7; `{"sources":[]}` at `:135` and `{"version":1,"areas":null}` at `:199` have no rows | **Split out** — carried into `f-20260921-02`'s enumeration |
| X6 | `review-root-cause` (96) | The raw-import negative control has not actually been run; the evidence so far is the existing LCOV only | **Accepted as a stated limitation** — it is Phase 1's work and cannot be run in a worktree with no `node_modules`; acceptance 4 owns it |

Open issues after r9 triage: none in this plan. X1, X2, X3 and X5 are transferred, with their
witnesses and evidence, to `f-20260921-02`; the handoff record names them so the successor does not
re-derive them.

**An orchestrator error is recorded here rather than quietly fixed:** applying the split, a text
anchor matched inside the revision line and duplicated the whole document. It was detected by a
structure check immediately afterwards, repaired before the r10 delta was taken, and changed no
obligation — the same class of error as the one recorded between r3 and r4.

### Round 9, continued — `review-minimalism`, `review-tests`, `review-correctness`

All three **REVISE**. Round 9 closes at **7 REVISE / 0 APPROVED**, and all seven corroborate the
split rather than contradict it — `review-minimalism` reached it independently at confidence 97:
"the smallest mandate-sufficient plan removes Phase 2a and handles `f-20260921-01` separately."

**`review-correctness` disproved one of this plan's own assertions with a probe, and it was right.**
r9 claimed a formatter killed by a signal would evade a `status !== 0` test because `spawnSync`
leaves `status` null. Re-measured by the orchestrator:
`spawnSync("/bin/sh", ["-c", "kill -TERM $$"])` returns `status: null`, `signal: "SIGTERM"`, and
`status !== 0` evaluates **true**. The premise was false — an asserted shell/runtime behaviour that
rule 12b says must be measured before adoption, inside a plan whose own O3 section makes that
argument. It is corrected in `f-20260921-02` rather than here, since the matrix went with the split.

| ID | Witness(es) | Claim | Disposition |
| --- | --- | --- | --- |
| X7 | `review-correctness` (100), with a probe | Row 18c's premise is false: `null !== 0` is true, so a signal kill is already caught | **Corrected in `f-20260921-02`** — re-measured and recorded there; at most a distinct message, not a missing branch |
| X8 | `review-correctness` (99) | `assertAreaFloors`' missing-report branch at `:254` is also unreachable, for the same structural reason as row 4 | **Transferred** — recorded in `f-20260921-02` beside the Open question |
| X9 | `review-tests` (99), `review-correctness` (99), `review-root-cause` (99), `review-minimalism` (99) | Row 23g duplicates row 7's wrong-version throw | **Transferred** |
| X10 | `review-tests` (99) | U6's tests assert the throw but not that the previous baseline survives, so reverting atomicity would pass | **Transferred** — recorded as a required assertion |
| X11 | `review-minimalism` (93) | The `format.ts` experiment is unnecessary Phase 1 scope | **Skip** — kept, with the MANDATE obligation named: O6 owns the `docs/coverage.md` paragraph describing this class, and a narrower class makes that paragraph false. Cost is one extra run of a command the phase already runs |

Open issues after the full r9 triage: none in this plan. X7-X10 are transferred to
`f-20260921-02`, which was annotated with the measured corrections before this entry was written,
so the successor inherits the corrected enumeration and not the confident one.

### Round 10 — 2026-09-21, seven Codex lenses over r10

Raw verdicts: `review-minimalism` **APPROVED**; `review-plan`, `review-correctness`,
`review-tests`, `review-code-quality`, `review-error-handling` and `review-root-cause` all
**REVISE**. Reports at `$RUN_TMP/../reports-r10/lens-*.txt`. X4 and X11 closed by all seven.

**X1 — the split — is rejected 6 to 1, and r11 reverses it.** Every dissenting lens made the same
argument, and it is correct: the rule 12a adoption gate governs what the **MANDATE** obliges, not
**when** a finding is worked. Rule 4b decides that, and it says same area is handled now, with
"pre-existing" and "not part of the diff" explicitly excluded as grounds.
`scripts/coverage-report.mjs` is the file Phase 1 changes, so `f-20260921-01` and the matrix belong
in this run.

**What was actually wrong in r6 was the framing, not the adoption.** r6 justified the extra phases
*through the mandate*, which is what `review-plan` correctly failed at the gate in r9; r9 then
removed the work instead of renaming its authority. r11 keeps both rules: the phases are in the run
under rule 4b, they are marked as **not MANDATE obligations**, no acceptance criterion of
`f-20260920-19` depends on them, and they close their own findings in their own commits.

The filing was not wasted. `f-20260921-01` and `f-20260921-02` stay on disk, carry the enumeration
and the measured corrections, and are closed by these phases — so the work is both durable and done,
which is what rule 4b was protecting.

| ID | Witness(es) | Claim | Disposition |
| --- | --- | --- | --- |
| Y1 | `review-plan` (99), `review-correctness` (98), `review-root-cause` (98), `review-error-handling` (97), `review-tests` (97), `review-code-quality` (98) | The split defers same-area work that rule 4b binds to this run | **Fix** — split reversed; Phases 2a, 2b and 3 restored under rule 4b |
| Y2 | `review-plan` (92) | The matrix stages only single-offender runs, while O4 requires one message naming every offending path | **Fix** — each row is run twice, once with two offenders |
| Y3 | `review-minimalism` (100), `review-error-handling` (99), `review-plan` | A stale bullet said `f-20260921-01` was fixed here while the split section said it was open | **Fix** — resolved by the reversal, and the bullet rewritten |
| Y4 | `review-plan` (100), `review-tests` (99), `review-code-quality` (100), `review-minimalism` (100) | The dependency paragraph was duplicated verbatim | **Fix** — one paragraph |
| Y5 | `review-correctness` (97), `review-tests` (94) | Acceptance 5 required a partial matrix while acceptance 7 said there was none | **Fix** — resolved by the reversal; acceptance 7 now covers the complete matrix |
| Y6 | `review-plan` (100) | Stale ownership text kept `tasks/decisions.md` in Phase 1 | **Fix** — Phase 4 owns it, stated in both places |
| Y7 | `review-error-handling` (87) | The rewritten scope message names only the globs, but `scopeSignature` pins source ids and roots and area ids, sources and paths too | **Fix** — the message names every component |
| Y8 | `review-tests` (91) | "All three results are recorded" named no durable destination | **Fix** — the `tasks/decisions.md` record Phase 4 writes, with exit statuses and stderr |

Open issues after r10 triage: none. Y1 is a structural reversal and needs an explicit closure check
in round 11, as does Y2.

**On the two reversals in this run.** r6 adopted this work, r9 removed it, r11 restores it. That is
not a plan oscillating for want of a decision: each move was made on a lens finding that was correct
about the rule it cited, and what changed was the arbiter's understanding of how rules 4b and 12a
divide. The record is kept in full rather than tidied, because the next run to hit the same pair of
rules will need the reasoning more than the conclusion.

### Round 11 — 2026-09-21, seven Codex lenses over r11

Raw verdicts from the five that reported before this entry: `review-error-handling` **APPROVED**;
`review-plan`, `review-correctness`, `review-minimalism` and `review-code-quality` **REVISE**.
Reports at `$RUN_TMP/../reports-r11/lens-*.txt`.

**Y1 and Y2 are closed.** `review-plan`, `review-correctness`, `review-error-handling` and
`review-minimalism` each closed Y1 explicitly, and `review-minimalism` stated the reconciliation in
the form the arbiter had reached independently: "rule 4b requires same-area work now, while rule 12a
only forbids pretending that work is mandated by `f-20260920-19`." The dispute that ran from r6 to
r10 is settled.

**`review-correctness` corrected the plan twice more, with probes, and was right both times.** Both
were re-measured before adoption:

* `{"version":1,"areas":null}` does **not** reach `baseline.areas[area]`; `:185-186` rejects a falsy
  `areas` first — `assertBaseline({}, {version:1, areas:null})` throws
  `Unsupported coverage baseline format`, an existing row. The claimed row was never real.
* "Unreachable" needed qualifying. `assertAreaFloors` is exported and the tests call it directly:
  `assertAreaFloors({}, {areas:[{id:"a",minimumCoverage:{lines:0,functions:0,branches:0}}]})` throws
  `Missing coverage report for area: a` today. That branch is a live contract and stays; deleting it
  would turn a clear message into a `TypeError`. Only the LCOV-loop check remains a deletion
  candidate, and it gets the same test — reachable by *any* caller, not only the CLI.

Both corrections went into `f-20260921-02` as well, since that finding carries the enumeration.

| ID | Witness(es) | Claim | Disposition |
| --- | --- | --- | --- |
| Z1 | `review-correctness` (100) | The wrong-shape baseline row duplicates the `:186` throw | **Fix** — measured, row withdrawn, finding annotated |
| Z2 | `review-correctness` (99), `review-code-quality` (99), `review-plan` | `assertAreaFloors`' branch is reachable through the exported API | **Fix** — measured; the branch stays, and "unreachable" is qualified as "through the CLI" everywhere |
| Z3 | `review-code-quality` (97), `review-minimalism` (99) | Mandate acceptance and rule-4b completion were one undifferentiated list | **Fix** — two headed sections; criteria 1-6 are the mandate and depend on nothing in Phases 2a-3 |
| Z4 | `review-code-quality` (98) | The double-offender requirement said "once" and "twice" and named rows that the table does not label | **Fix** — rows 1, 2a, 2b and 3 run twice, row 9 once, seven recorded runs |
| Z5 | `review-code-quality` (98) | The two `grep` commands were line-wrapped, so copying them matches nothing | **Fix** — both written unwrapped in a code block |
| Z6 | `review-code-quality` (96), `review-correctness` (98) | "One coupling" understated the revert couplings | **Fix** — three, enumerated, including that reverting work without its ledger closure is worse than either alone |
| Z7 | `review-code-quality` (94) | Region ownership was asserted without a map | **Fix** — a per-region table covering both shared files |
| Z8 | `review-plan` (blocker) | Phase 2a's failures cannot be staged: `writeBaseline` hard-codes the formatter path | **Fix** — an optional `formatter` parameter defaulting to today's path; the CLI is unchanged |
| Z9 | `review-plan` (blocker) | Temporary-file cleanup was required but not proved | **Fix** — asserted per failure branch |
| Z10 | `review-plan` (blocker), `review-error-handling` (92) | The formatter throw carried no actionable detail | **Fix** — path, `status`, `signal` and the formatter's stderr |
| Z11 | `review-plan` (blocker) | The two `grep` passes cannot find the wrong-shape class | **Fix** — a third pass that is a control-flow reading, not a command, with the reason it cannot be one |
| Z12 | `review-plan` (blocker) | The handoff is created in Phase 4, but `f-20260921-02` tells its worker to read it first — and Phases 2b/3 are that worker | **Fix** — it becomes **Phase 0**, written first and amended at the end |
| Z13 | `review-plan` (blocker) | Phase 4 cannot be one commit: `findings.py` commits each mutation itself | **Fix** — the accounting says one commit per ledger mutation, and drops the "five commits" claim |
| Z14 | `review-minimalism` (96) | Phase 1 wrote a `docs/coverage.md` pointer to a matrix Phase 3 creates | **Fix** — the pointer moves to Phase 3 |
| Z15 | `review-plan` (100), `review-minimalism` (100) | Phases share `coverage-report.mjs` and its tests, violating one-phase-owner-per-file | **Skip** — arbitrated. Neither rule 4a nor the build skill requires file disjointness; 4a cuts by area cohesion and disjointness only makes ordering free. The same lens accepted this reading in r8 at the same confidence it now rejects it. The region map answers the actionable part of the objection |

Open issues after this triage: none. Z2, Z8, Z12 and Z13 are substantive and need closure checks in
round 12.

### Round 11, final — `review-tests` and `review-root-cause`

`review-root-cause` **APPROVED**, `review-tests` **REVISE**. Round 11 closes at
**2 APPROVED / 5 REVISE**. Y2 closed by both; Y1 closed by `review-root-cause` and held open by
`review-tests` on one specific ground, which is fixed below rather than argued.

| ID | Witness(es) | Claim | Disposition |
| --- | --- | --- | --- |
| Z16 | `review-tests` (97), `review-root-cause` (98), `review-minimalism` (99) | Acceptance 5 was called "the failure matrix", making mandate acceptance depend on Phase 3 | **Fix** — it is now the failure *evidence for the paths this run changes*, owned by Phase 1 and complete without Phase 3. The boundary sentence is corrected everywhere to "no O1-O6 behavioural obligation and no **Mandate acceptance** criterion", since Phase 3's matrix genuinely *is* required verification under rule-4b completion |
| Z17 | `review-tests` (94) | D4 claims the guard covers the backend, but no case feeds a backend-shaped config a blank record | **Fix** — O5 case 11; the claim becomes testable instead of asserted |

`review-tests` also noted that the worktree had advanced to r12 while it was still reporting. That
is the second time, and the earlier note said edits would wait for the last report of a round; they
did not. The snapshot mechanism makes it harmless — each round judges the revision it was handed,
and the delta for the next round is taken from the snapshot, not from the live file — but the note
was written and then not followed, which is worth recording as such rather than quietly dropping.

### Round 12 — 2026-09-21, seven Codex lenses over r12

Raw verdicts from the three that reported before this entry: `review-minimalism` **APPROVED**,
`review-code-quality` **REVISE**, `review-root-cause` **REVISE**. Reports at
`$RUN_TMP/../reports-r12/lens-*.txt`.

**The important result is the one the round was asked for.** All three reported separately on the
mandate: `review-code-quality` — "O1–O6 have no remaining defect identified here. Mandate acceptance
criteria 1–5 are coherent"; `review-root-cause` — "O1–O6 are otherwise covered without a root-cause
defect. Mandate acceptance criteria 1–5 are sound"; `review-minimalism` — "O1–O6 and mandate
acceptance criteria 1–6 remain sufficient", APPROVED outright. Every remaining defect was located in
the rule-4b phase planning or in criterion 6's classification, not in the guard.

Closures: **Z8 and Z17 closed by all three. Z2, Z12, Z13 and Z16 closed by `review-minimalism` and
partially by the other two**, each holding open one stale sentence rather than the mechanism.

| ID | Witness(es) | Claim | Disposition |
| --- | --- | --- | --- |
| AA1 | `review-code-quality` (100), `review-root-cause` (99) | Criterion 6 closed the two rule-4b findings inside *mandate* acceptance | **Fix** — the findings' closure moves to Rule-4b completion; the mandate keeps `f-20260920-19`, the `d-20260830-08` trailer and the handoff |
| AA2 | `review-code-quality` (100), `review-root-cause` (99) | "The five commits" was stale after Phase 0 and the per-mutation ledger commits | **Fix** |
| AA3 | `review-code-quality` (99) | The ownership map gave the handoff to Phase 4, though Phase 0 creates it | **Fix** — created by Phase 0, amended by Phase 4, both listed |
| AA4 | `review-code-quality` (blocker, 100) | Phase 2b called the reachability an open question and then left both repairs conditional — the plan did not choose | **Fix, by doing the trace** — see below |
| AA5 | `review-root-cause` (94) | Phase 3's summary still called both branches unreachable | **Fix** — one row is lost to the deletion; `assertAreaFloors`' branch stays and is staged through a direct call |
| AA6 | `review-code-quality` (98) | The O3 proof used a line-continuation backslash and the multi-command blocks stated no command counts, against universal rule 22 | **Fix** — counts stated, backslash removed |
| AA7 | `review-code-quality` (100) | "and plus the" | **Fix** |

**AA4 is the one worth reading.** r11 told Phase 2b to trace the branch before writing anything;
`review-code-quality` pointed out that a plan which defers its own decision to implementation has
not planned it. The trace is done and recorded in Phase 2b, and it is structural rather than
empirical: the LCOV loop reaches that check only for files already in `productionFiles`, the first
loop has run the identical comparison over every one of them, and neither the map nor `assignArea`
changes in between. It is dead for every input and, being interior to `buildCoverageReport`,
unreachable by any caller — the opposite of `assertAreaFloors`, whose branch survives precisely
because it *is* separately exported. That distinction is `review-correctness`'s from r11, applied in
the other direction.

**So the repair changed shape: deletion, not extraction.** From r6 to r12 this was planned as a
rule-11 extraction of a duplicated invariant. With the dead copy removed there is no second copy,
and a helper for one caller would be the speculative abstraction `review-minimalism` is there to
catch. Rule 11 is satisfied by deleting the duplicate. The matrix **loses** a row rather than
gaining one — the first time in twelve rounds that correcting it made it smaller.

### Round 12, continued — the remaining four lenses

`review-plan`, `review-correctness`, `review-tests` and `review-error-handling`, all **REVISE**.
Round 12 closes at **1 APPROVED / 6 REVISE**.

**The result the round was asked for held across all seven.** `review-plan`: "No MANDATE obligation
O1–O6 or Mandate acceptance criterion 1–6 remains defective. The blocker is confined to the rule-4b
Phase 2a proof." `review-error-handling`: "No MANDATE obligation O1–O6 or Mandate acceptance
criterion 1–6 is defective; both findings concern rule-4b completion phases."
`review-correctness`: "O1–O6 have no remaining behavioral defect." `review-tests` was the one
exception and found a real mandate defect, below.

Four of these judged the r12 snapshot, so their objections to Phase 2b's conditional wording,
criterion 6's placement, the stale "five commits" and the ownership map were already fixed in r13
before the reports arrived. `review-error-handling` (confidence 99) derived the deletion conclusion
for the LCOV-loop branch independently and by the same structural argument, which is corroboration
of r13's trace rather than a new issue.

| ID | Witness(es) | Claim | Disposition |
| --- | --- | --- | --- |
| AB1 | `review-tests` (blocker, 97) | **Mandate defect.** O2 condition 3 had no declared *partial-zero* fixture, so an implementation treating "any zero metric" as blank would accept a declared file, pass case 5's all-positive fixture and case 10's undeclared partial-zero fixture, and silently stop enforcing the allowlist | **Fix** — case 5 gains a partial-zero variant; condition 3 must use the same three-metric predicate as condition 1 |
| AB2 | `review-error-handling` (95) | **Mandate defect.** The blank-measurement message named Vite's `?raw`/`?url`/`?inline`, which cannot apply to a backend LCOV, and one script serves both configs | **Fix** — the cause clause is instrument-neutral and points at `docs/coverage.md`, where the frontend-specific cause lives |
| AB3 | `review-plan` (blocker, 98) | The `rename` failure cannot be staged: only the formatter is injectable, a rename over a regular file succeeds on Linux, and renaming onto a directory leaves no previous baseline to compare | **Fix** — the rename is injected like the formatter, rather than recorded as argued, because an argued row would leave the atomicity unproven |
| AB4 | `review-tests` (94) | A `formatter` parameter is reachable only by direct call, so the assertions about `main`'s exit status cannot exercise it | **Fix** — the CLI cases point the *default* path at a scratch `node_modules/.bin/oxfmt` in a temporary working directory |
| AB5 | `review-tests` (91) | "Argued" rows could excuse stageable `readdir` and `writeFile` failures | **Fix** — argued is reserved for the three unstageable cases the policy names; both of those are staged against scratch directories |
| AB6 | `review-correctness` (100) | Four rows run twice is eight runs, not six; with row 9, nine not seven | **Fix** |

Open issues after this triage: none. AB1 and AB2 are the first mandate-level defects found since r5
and both are corrected; AB3 is substantive and changes Phase 2a's seam. All need closure checks in
round 13.

### Round 13 — 2026-09-21, seven Codex lenses over r13

Raw verdicts from the four that reported before this entry: `review-code-quality`,
`review-correctness`, `review-error-handling` and `review-tests`, all **REVISE**. Reports at
`$RUN_TMP/../reports-r13/lens-*.txt`.

**AB2, AB3, AB4, AB5 and AA4 closed by all four.** Every lens reported separately that O1, O3, O4
and O6 and mandate acceptance criteria 1–4 and 6 have no remaining defect.

**AB1 was not closed, and the reason is an orchestrator error, not a disagreement.** The fix had
been written but never reached disk: the edit script that carried it aborted on a later assertion
before writing, so the "fixed" case 5 existed only in a transcript. All four lenses read the
unchanged text and reported the same defect at confidence 99. It is now applied and, being the
second edit-tooling loss in this run after the r9→r10 duplication, it is recorded here rather than
quietly corrected.

The correction is also stronger than the one that was lost. Case 5 now carries **three** declared
partial-zero fixtures, one per metric, each of which condition 3 must reject. A single
`lines.total === 0` fixture would still have let an implementation keyed on `functions.total === 0`
alone slip through, which is the same hole one metric deeper.

| ID | Witness(es) | Claim | Disposition |
| --- | --- | --- | --- |
| AC1 | `review-code-quality` (98) | The O3 proof called the second command "guarded by the first's exit status" while the block holds two independent commands | **Fix** — the text now says what it is, and why nothing is lost: a failed `git show` truncates the file to zero bytes and `JSON.parse("")` throws, as measured in r9 |
| AC2 | `review-error-handling` (93) | The formatter diagnostic omitted `spawnSync`'s `error.code`/`error.message`; a missing binary yields `status: null`, `signal: null` and empty stderr, so `ENOENT` is the only distinguishing detail | **Fix** |
| AC3 | `review-code-quality` (99), `review-correctness` (94) | Grammar in the dependency sentence, and "and and the `docs/coverage.md` pointer" | **Fix** |

### Round 13, continued — `review-plan`, `review-minimalism`, `review-root-cause`

`review-minimalism` **APPROVED**; `review-plan` and `review-root-cause` **REVISE**. Round 13 closes
at **1 APPROVED / 6 REVISE**, and unanimously: AB1 open, AB2, AB3, AB4, AB5 and AA4 closed, and no
defect anywhere in O1, O3, O4, O6 or mandate acceptance criteria 1–4 and 6.

`review-plan` added a detail worth carrying to implementation: the existing fixture config in
`scripts/coverage-report-tests.mjs:33-44` declares no `statementFree` at all and its only blank
fixture is all-zero (`:94-109`), so every condition-2 and condition-3 case needs a new fixture
rather than a variation of an existing one.

| ID | Witness(es) | Claim | Disposition |
| --- | --- | --- | --- |
| AD1 | `review-minimalism` (91) | The injectable `formatter` parameter has one production caller and is redundant once AB4 stages formatter failures through the real CLI | **Fix** — dropped. `resolve("node_modules/.bin/oxfmt")` is cwd-relative, so a temporary working directory with its own `node_modules/.bin/oxfmt` controls it completely *and* exercises the real `main()`. Only the rename seam remains, which no working directory can stage |
| AD2 | `review-minimalism` (nit, 86) | Requiring the scope-mismatch message to enumerate every `scopeSignature` component expands the maintenance surface beyond the mandate | **Skip** — `review-error-handling` asked for exactly that at confidence 87 for the opposite reason: a message naming only the globs misdiagnoses an area-list change. Two lenses, one trade-off; the arbiter keeps the accurate message, and the surface it adds is one sentence that changes when the signature does |

AD1 is worth noting beyond itself: it is the second time in this run that a seam was planned for
testability and then removed once someone checked what the existing code already allowed — the
first was the LCOV oracle in r4. Both were caught by `review-minimalism`, and both times the
cheaper answer was already in the source.

### Round 14 — 2026-09-21, seven Codex lenses over r14

Raw verdicts: `review-minimalism`, `review-correctness`, `review-tests`, `review-root-cause`,
`review-error-handling` and `review-code-quality` **APPROVED**; `review-plan` **REVISE**. Round 14
closes at **6 APPROVED / 1 REVISE**. Reports at `$RUN_TMP/../reports-r14/lens-*.txt`.

**AB1, AD1, AC1 and AC2 are closed by all seven.** And all seven answered the question the round was
asked: **no MANDATE obligation O1–O6 and no mandate acceptance criterion 1–6 remains defective.**
`review-plan`'s single blocker is explicitly "confined to rule-4b completion", and
`review-root-cause` recorded that the guard intercepts the real mechanism without reintroducing
`f-20260920-18`.

| ID | Witness(es) | Claim | Disposition |
| --- | --- | --- | --- |
| AE1 | `review-code-quality` (99) | O3 said "run the second only after success" and then called the commands independent | **Fix** — they are independent, and the text says why that is safe |
| AE2 | `review-code-quality` (94) | Case 5's fixture and run structure was ambiguous after the AB1 correction | **Fix** — it is five fixtures: one two-path and three single-path partial-zero |
| AE3 | `review-code-quality` (98) | Acceptance 5 said "recorded once" and then required two runs for four rows | **Fix** — "one record per run" at first mention |
| AE4 | `review-code-quality` (99) | Both citations of the verification-artefact clause pointed at `push-review-policy.md:139-151`, which is the records-lens section | **Fix** — verified in the file; the clause is at `:211-219` and the matrix requirement at `:221-243` |
| AF1 | `review-plan` (blocker, 98), `review-error-handling` (96) | The rename test was required to prove the real CLI's absent success line, but the seam is on `writeBaseline`, which `main` calls without it | **Fix** — the CLI assertions belong to the two formatter cases, which do run through `main()`; the rename case asserts at the writer level, and the plan says so. `main`'s behaviour on a throw is not rename-specific — it is the one `catch` at `:337-340` the CLI cases already exercise |
| AF2 | `review-error-handling` (91) | Temporary-file cleanup adds a rejection path that a naive `finally` would let mask the primary error | **Fix** — cleanup failures are swallowed after the primary error is preserved, and "cleanup failed after a successful rename" becomes its own matrix row |

Open issues after this triage: none.

### Round 15 — 2026-09-21, seven Codex lenses over r15

Raw verdicts: `review-plan`, `review-minimalism`, `review-correctness`, `review-code-quality`,
`review-error-handling` and `review-root-cause` **APPROVED**; `review-tests` **REVISE**. Round 15
closes at **6 APPROVED / 1 REVISE**. Reports at `$RUN_TMP/../reports-r15/lens-*.txt`.

**AF1 closed by all seven. AF2 closed by six.** And for the second consecutive round, every one of
the seven stated it explicitly: **no MANDATE obligation O1–O6 and no mandate acceptance criterion
1–6 is defective.** `review-plan`, the mandatory lens, returned **APPROVED** with "No additional
plan defects found."

| ID | Witness | Claim | Disposition |
| --- | --- | --- | --- |
| AG1 | `review-tests` (blocker, 96) | AF2 was specified but unproven: no listed test forces cleanup to fail, so a regression letting cleanup mask the primary error, or turn a successful rename into a failure, would pass every other case | **Fix** — two cases added through the same injected filesystem seam: unlink fails after a formatter error (the thrown message must still be the formatter's), and unlink fails after a successful rename (the call must still **succeed** and leave the new baseline in place) |
| AG2 | `review-code-quality` (95) | "Five fixtures" conflicted with the enumeration of one two-path plus three single-path | **Fix** — four fixture setups covering five declared paths |

AG1 is the fourth time in this review that a *specified* behaviour had no test forcing it, and the
third of those found by `review-tests`: the rename atomicity in r9, the declared partial-zero
predicate in r12, and now the cleanup path. The pattern is consistent enough to be worth stating
for the implementation: every "must not" in Phase 2a needs a fixture that makes it happen, not only
a sentence saying it must not.

### Round 16 — 2026-09-21, scoped re-review: `review-plan` and `review-tests`

Both **REVISE**. A scoped round, per the re-review rule that a round runs `review-plan` plus every
lens whose findings drove the correction. Reports at `$RUN_TMP/../reports-r16/lens-*.txt`.

**AG2 closed by both. AG1 not closed, and the reason dissolved the design rather than patching it.**
`review-plan` (98) and `review-tests` (99) independently observed that the r15 fixture
"cleanup fails after a successful rename" is **vacuous**: `rename` consumes the temporary path, so
after it succeeds there is no unlink left to fail, and a fixture asserting "no temporary file
remains" would pass even with cleanup deleted outright.

| ID | Witness(es) | Claim | Disposition |
| --- | --- | --- | --- |
| AH1 | `review-plan` (98), `review-tests` (99) | The post-rename cleanup case cannot fail and cannot detect cleanup being removed | **Fix by withdrawal** — cleanup belongs in the `catch`, not a `finally`; a successful rename has nothing to clean, and the case is dropped as vacuous rather than strengthened |
| AH2 | `review-plan` (98) | "No temporary file is left behind" cannot hold for the cleanup-failure case, where the point is that it *does* remain | **Fix** — the first three cases assert the file is gone; the cleanup case asserts it survives and the primary error is unchanged, which is exactly what separates swallowing an unlink error from skipping cleanup |

Both are corrections to the plan's own r15 wording, and both make it smaller. The remaining cleanup
obligation is one sentence — swallow the unlink error, rethrow the primary one — proved by one
fixture that asserts the thrown message is still the formatter's.

### Round 17 — 2026-09-21, scoped: `review-plan` and `review-tests`

`review-tests` **APPROVED**, `review-plan` **REVISE**. Both confirmed again: no MANDATE obligation
O1–O6 and no mandate acceptance criterion 1–6 is defective. Reports at
`$RUN_TMP/../reports-r17/lens-*.txt`.

**AH1 closed by both** — the post-rename obligation is correctly gone. **AG1 and AH2 closed by
`review-tests`, held open by `review-plan`**, on a distinction `review-tests` missed and the
arbiter accepts: outcome assertions cannot separate a *swallowed* cleanup failure from *no cleanup
at all*. Skip the unlink and the temporary file survives and the formatter error is rethrown —
byte for byte the asserted result.

| ID | Witness | Claim | Disposition |
| --- | --- | --- | --- |
| AI1 | `review-plan` (blocker, 99) | The cleanup fixture is still vacuous: it never proves the injected `unlink` was called | **Fix** — the injected `unlink` records its calls, and the fixture asserts the call *and* the preserved formatter message. Deleting cleanup fails the call assertion; letting the unlink error escape fails the message assertion |
| AI2 | `review-plan` (99) | Cleanup on the `writeFile` failure path had no case at all | **Fix** — two cleanup fixtures, after a `writeFile` failure and after a formatter failure, and `writeFile` failure gains its own branch test |

This is the third time in the run that a fixture asserting only an *outcome* was shown unable to
fail, after the acceptance oracle in r2–r4 and the declared partial-zero predicate in r12. The
pattern for the implementation: when the correct and the broken implementation produce the same
final state, the test has to assert the *action*, not the state.

### Round 18 — 2026-09-21, scoped: `review-plan` and `review-tests`

Both **REVISE**, and both confirmed once more that no MANDATE obligation O1–O6 and no mandate
acceptance criterion 1–6 is defective. Reports at `$RUN_TMP/../reports-r18/lens-*.txt`.

**AI1 and AI2 closed by both.** `review-plan`: "Skipping unlink fails the call assertion;
propagating its error fails the formatter-message assertion."

| ID | Witness(es) | Claim | Disposition |
| --- | --- | --- | --- |
| AJ1 | `review-tests` (97), `review-plan` (94), independently | Cleanup failure was injected on only two of the four failure paths, so a regression special-casing the missing-binary or rename exit would pass | **Fix** — one cleanup fixture per failure path, all four, as a single parameterised test. The plan also states why that is cheap: cleanup is one helper called from every failure exit, and the parameterised test is what proves that structure holds |
| AJ2 | `review-plan` (90) | **Mandate-level sequencing.** The O3 proof reads `git show HEAD:coverage-baselines.json`, so run after Phase 1 is committed it reads the already-edited scope and fails its own "scope did not change" check | **Fix** — O3 and acceptance 3 now say it runs before the Phase 1 commit, or afterwards against `HEAD~1` |

AJ2 is the last mandate-level defect found in the run, and it is a good example of why the review
continued past the point where every lens was calling the mandate clean: the *obligation* was
right, the *proof procedure* was right, and the order in which the two had to happen was stated
nowhere — invisible until someone asked what `HEAD` means at the moment the command runs.

### Round 19 — 2026-09-21, scoped: `review-plan` and `review-tests`

**Both APPROVED. AJ1 and AJ2 closed by both. No MANDATE obligation O1–O6 and no mandate acceptance
criterion 1–6 is defective.** Reports at `$RUN_TMP/../reports-r19/lens-*.txt`.

`review-tests` verified the `HEAD~1` reasoning independently, including the detail that makes it
work: Phase 0 commits the handoff before Phase 1, so immediately after Phase 1 lands, `HEAD~1` is
that Phase 0 commit and still carries the pre-edit baseline.

**Convergence.** No issue from any of the nineteen rounds remains open or deferred. Final tally:

* **19 rounds**, 7 lenses on rounds 1–15, `review-plan` + `review-tests` on the scoped rounds 16–19
  — **119 lens reports**.
* **Issue series I through AJ**: every one dispositioned, with its witnesses, raw verdicts and
  reasons preserved above. Four `Skip`s, each with its reasoning recorded — I14 (the oracle, later
  withdrawn anyway), J3/I1 (the residual hole), P9 (the config-path argument), T1/Z15 (file
  sharing), AD2 (the scope-message components).
* **Two reversals of the arbiter's own decisions**, both recorded rather than tidied: the r9 split
  and its r10 reversal, and the r13→r14 formatter seam added then removed.
* **Two edit-tooling losses** (r9→r10 duplication, r13's lost AB1 fix), both detected by the next
  round and recorded.
* **Seven occasions where a lens disproved an orchestrator assertion with a probe**, every one
  re-measured before adoption: the signal-kill premise, the wrong-shape baseline row,
  `assertAreaFloors`' reachability, `format.ts`'s coverage, the stale-file redirection claim, the
  vacuous post-rename cleanup case, and the vacuous cleanup outcome assertion.

The plan is ready for approval. Nothing in it has been implemented.
