# Findings deferred to their own run

Written the moment a finding is found, per universal rule 4b — a deferred finding that lives only
in a session's context dies with the next compaction. `Defer` is not a soft `Skip`: each open entry
below will be fixed, just in a separate run. Handled entries stay as the record.

**This file is an append-only log, not a queue.** The queue is *derived* from it by
`scripts/findings.py`, which groups open findings by `Root` first and `Area` second. A new finding
is appended wherever the run that found it happens to be writing — its position in the file carries
no meaning, and nothing has to be filed "in the right place".

## Header contract

Every `###` entry carries exactly one header line, immediately after its heading:

```
* **ID:** f-YYYYMMDD-nn · **Status:** open · **Area:** e2e-gate · **Root:** some-shared-cause · **Entry:** build · **Blocked:** none
```

`python3 scripts/findings.py check` enforces it. This repository has no Python test suite to gate
that check from, so it is run directly — by `$push` on any diff touching `tasks/`, and by any run
that files an entry. The universal contract — field meanings, ranking rules, why grouping is
derived — is `~/.claude/references/findings-ledger-contract.md`. Only the vocabulary below is
En Croissant's own.

* **ID** — `f-YYYYMMDD-nn`, the date the finding was *filed*, sequential within that date. Stable
  forever: commits, handoffs and `tasks/decisions.md` reference it. Never renumber. **The merge
  always allocates it; every filing route writes `f-PENDING`** — never pick one yourself.
* **Status** — `open` · `handled` · `rejected`. `rejected` needs a stated reason in the body and is
  only for a finding that is genuinely not a defect; it is never a quiet way to drop work.
* **Area** — one of the closed set below. `check` fails on any other value, which is what stops a
  run inventing `engine-protocol` next to `engine-uci` and orphaning a finding from its siblings.
  Adding an area is a deliberate edit to this list.
* **Root** — optional slug shared by findings with one underlying cause, `-` when none. Ranked
  *above* Area, because a shared root crosses area boundaries. Only assign a Root the ledger
  actually asserts; do not infer one.
* **Entry** — how it gets executed, decided by the run that *files* it: `inline` (fix it, no
  interview) · `lens` (inline plus one named review lens, run on Codex) · `build` (a real design
  question — the interview is the point). Universal rule 6b's three tiers. **When uncertain, write
  `build`.** A cluster takes the highest tier of its members.
* **Blocked** — `none`, or a slug naming what it waits on (`felix-decision`, `upstream-tauri`).
  A blocked finding is excluded from the queue; it is not "next". `felix-decision` additionally
  requires a `**Decision:**` brief ending the entry, containing both a `**Recommend:**` and a
  `**Session:**` sub-bullet — `check` fails the park without all three.

Felix answers through `/decide`, which publishes to `tasks/findings-answers/` and is applied by
`findings.py apply-answers`. `python3 scripts/findings.py decisions` lists what is waiting on him.

**Area vocabulary:** `app-startup` · `bindings-ipc` · `chess-tree` · `ci-workflows` ·
`db-search` · `deps` · `docs-agent-config` · `e2e-gate` · `engine-uci` · `frontend-state` ·
`frontend-ui` · `gate-scripts` · `i18n` · `native-fs` · `oauth-credentials` · `pgn-import`

---

---

## 2026-08-29 — filed through the inbox spool

### 1. Backend branch coverage is machine-dependent — atlas measures one branch fewer than the baseline

* **ID:** f-20260829-01 · **Status:** open · **Area:** gate-scripts · **Root:** machine-dependent-measurement · **Entry:** build · **Blocked:** none
* **Where:** `scripts/rust-branch-coverage.mjs`, `backend-coverage-baselines.json`
  (`app-infrastructure`), area paths `src-tauri/src/error.rs`, `src-tauri/src/infra/**`,
  `src-tauri/src/main.rs`.
* **Defect:** `pnpm coverage:backend:check` fails on atlas with
  `app-infrastructure branches regressed: 745/2018, baseline 746/2018`. The total is identical
  (2018), so the tree is the one the baseline was recorded against; exactly one branch that the
  recording machine covered is not covered here. Two full runs on atlas produced byte-identical
  per-file numbers, so this is deterministic, not flake. The uncovered candidates are concentrated
  in `infra/fs.rs` (441/1468) and `infra/path_authority.rs` (243/412), both of which exercise
  real filesystem behaviour that varies between machines.
* **Why it matters:** the ratchet is the backend's only coverage gate, and it currently cannot be
  green on the machine Felix actually works on. That is the failure mode that gets a baseline
  quietly rewritten, which `docs/coverage.md` forbids.
* **Not done:** the baseline was **not** rewritten and `coverage:baseline:backend` was not run.
* **What decides it:** the dispatched CI run on `master`. If CI measures 746, the baseline is
  correct and atlas is the outlier, and the fix is to make the measurement environment canonical —
  the same move already taken for the e2e snapshots. If CI also measures 745, the baseline itself
  was recorded on a machine nobody uses any more and must be re-established from CI.
* **Found by:** the atlas setup audit, 2026-08-29, running the gate for the first time on this
  machine.

* **Still unanswered as of 2026-08-29, and now blocked behind `f-20260829-06`.** CI run 33275934621
  failed at the *frontend* ratchet, which sits earlier in `test.yml`, so every Rust step —
  including `test:coverage:backend` and `coverage:backend:check` — was skipped. No CI measurement of
  the backend number exists yet.
* **What the frontend result implies, without proving it here:** CI and atlas produced identical
  frontend numbers, and the baseline matched neither. The most probable reading for the backend is
  the same shape — `backend-coverage-baselines.json` describes the laptop's instrumentation rather
  than a machine anyone now uses. That is an inference, not a measurement; it is confirmed only when
  a CI run gets far enough to print the backend line.

* **Measured in CI at last, 2026-08-29 (run 33276821748) — and the backend is NOT the frontend's
  story.** Three environments, three numbers, on an identical total:

  | environment | `app-infrastructure` branches |
  | --- | --- |
  | CI, `ubuntu-latest` | **744**/2018 |
  | `tuxedo-atlas` | **745**/2018 |
  | baseline (the laptop) | **746**/2018 |

  `f-20260829-06` resolved as "the baseline was stale and the two live environments agree". This one
  cannot: CI and atlas disagree with each other as well. The total is identical everywhere, so the
  tree is the same and **two branches are genuinely environment-dependent** — consistent with the
  candidates named above, `infra/fs.rs` and `infra/path_authority.rs`, which exercise real
  filesystem behaviour rather than a stubbed one.
* **Consequence for any re-record:** the ratchet rejects a *lower* covered count, so a baseline set
  to the minimum across environments (CI's 744) passes everywhere — atlas's 745 is simply "better
  than the floor". A baseline set to atlas's 745 would leave CI red forever. So the environment that
  covers least has to define the number, which is defensible for a floor but silently stops
  enforcing the two branches that only some machines reach.
* **The better fix, which is why this stays `build`:** identify the two branches and make them
  environment-independent, instead of lowering the floor until the disagreement is invisible. That
  needs CI's LCOV to diff against the local one — the upload was skipped because it sat after the
  ratchet, fixed in `3a2142c1`, so the next run produces the artifact this needs.
* **Not done:** no backend baseline was rewritten. `d-20260829-02` authorised re-recording it from
  CI's LCOV, but that decision was taken when the backend was expected to have the same shape as the
  frontend. It does not, and lowering the floor is a different act from correcting a stale
  instrument — so it goes back to Felix rather than proceeding on an assumption he was not shown.

* **Diagnosed 2026-08-30 by diffing CI's LCOV against atlas's, and the "two environment-dependent
  branches" reading was wrong.** Comparing the two artefacts record by record over
  `app-infrastructure`:

  | metric | atlas | CI | records that differ |
  | --- | --- | --- | --- |
  | lines | 4208/6292 | 4207/6292 | **1** |
  | branches | 745/2018 | 744/2018 | **337** |

  **337 branch records flip, in both directions, and net out to one.** Line coverage over the same
  code differs by a single record. So the branch *identity* in the LCOV — the `BRDA:line,block,branch`
  triple — is not stable across builds: LLVM renumbers blocks and branches, and the exact-count
  ratchet then compares two numberings rather than two coverage results. Most of the ±1 the gate
  fires on is that renumbering, not a change in what is tested.
* **The one real difference is `src-tauri/src/infra/fs.rs:414`**, atlas HIT / CI miss — the
  recursive `remove_tree_at(&child, OsStr::from_bytes(bytes))?` inside the `RawDir` walk. It is
  reached only when the directory being removed *contains a subdirectory*, and no test creates that
  shape deterministically, so whether it is covered depends on what the temp tree happens to hold.
  The concentration of churn at `fs.rs:195-324` fits: those lines are the atomic-write path guarded
  by `metadata.dev()`/`ino()` identity checks and fault injection, which is exactly the code whose
  codegen and execution vary with the filesystem underneath.
* **So the fix is not a lower floor.** Two separate pieces of work, neither of which is "re-record
  at the minimum":
  1. **Cover `fs.rs:414` deterministically** — a test that removes a directory containing a nested
     subdirectory. That is a genuine gap in its own right: recursive deletion is the dangerous half
     of `remove_tree_at`, and today nothing exercises it on purpose. It also makes the two
     environments agree at 4208/6292 lines.
  2. **Stop ratcheting this area on raw branch-record counts**, which are not comparable across
     machines. Line counts are (one record apart across two very different hosts). This is the same
     mechanism as `f-20260829-15` from the other side: the exact-count rule assumes a stable
     identity that LCOV branch records do not have.
* **Evidence:** CI run 33277621360, artifact `backend-coverage`; local LCOV from the same tree. The
  artifact only exists because `3a2142c1` moved the upload to `always()` — before that, a red
  ratchet withheld exactly the measurement needed to explain it.

* **2026-08-30 — the disagreement is diagnosed at record level, and it is one function.** Comparing
  CI's `backend-coverage` artifact (run 33278503556) with atlas's LCOV on the *same* commit
  `b8f844de`, area `app-infrastructure`:

  ```
    src-tauri/src/infra/fs.rs      atlas 443/1468    CI 440/1468   <-- the entire gap
    every other file in the area   identical
  ```

  Within `fs.rs`, ~170 branch records flip in each direction and cancel out — `BRDA` block/branch
  identity is not stable across builds, so the exact-count ratchet is largely comparing two LLVM
  numberings rather than two coverage results. Exactly three records differ with no counterpart:
  `BRDA:409,0,1`, `BRDA:412,0,1` and `BRDA:412,1,3`, all inside `remove_tree_at`'s directory walk.
* **The mechanism is not a machine-dependent filesystem.** It is how often the directory arm runs:
  `DA:407` is 21 on atlas and **1** on the runner, with `DA:414`/`DA:416` at 30/9 versus **0/0**.
  The single CI entry is the symlink-refusal test, whose `?` propagates out of the walk before the
  loop reaches a second entry, the `.`/`..` skip, or the closing `unlinkat(REMOVEDIR)`. Atlas
  reaches it 21 times only because other tests' workspace cleanup takes the permanent-delete branch
  of `file_workspace.rs:515` on this host and does not on the runner. Nothing was ever asserting
  that path — it was being covered by accident, differently per environment.
* **Also corrected: the numbers in the header of this finding.** Three consecutive
  `pnpm test:coverage:backend` runs on unmodified `HEAD` today measure `app-infrastructure` at
  **747/2018** on atlas, identical across all six areas, and `coverage:backend:check` **passes**.
  The 745 recorded earlier does not reproduce on this tree and should not be relied on. The live
  three-way split is: atlas 747, baseline 746, CI 744.
* **Resolution attempted — a test, not a baseline.** `f-20260830-01` adds a deterministic descent
  test, which changes nothing on atlas (fs.rs is 443/1468 before and after) and should move CI from
  744 to 747 by covering exactly those three records. If the next CI run confirms it, this finding
  closes with the baseline untouched, and `d-20260829-02` stays unexercised for the backend.
* **If CI does not confirm it**, the remaining difference is `BRDA` renumbering rather than
  coverage, and the answer is `f-20260829-15`'s — stop ratcheting this area on raw branch-record
  counts. Lowering the floor to 744 remains the wrong move either way: it would retire the only
  enforcement of a recursive-delete path that guards against directory traversal.

---

## 2026-08-29 — filed through the inbox spool

### 2. The 320px / 200% font-scale layout is broken and its screenshots record the breakage

* **ID:** f-20260829-02 · **Status:** open · **Area:** frontend-ui · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `e2e/async-errors.spec.ts-snapshots/*`, `e2e/settings-responsive.spec.ts-snapshots/*`,
  and the components they render.
* **Defect:** headings and account text are clipped at 320px with a 200% app font scale. The
  committed screenshots record the clipped state, and `assertNoHorizontalOverflow` passes only
  because the content is clipped inside its container rather than widening the document — so the
  suite is green on a defect it was meant to catch.
* **Carried from:** `FRONTEND_AUDIT_PLAN.md`, "Final exact-tree verification (2026-08-13)", where
  it is explicitly listed as *not* evidence of a correct layout. Filed here so it lives in the
  queue rather than only in a plan document.
* **Note:** re-recording these snapshots in the container (2026-08-29 decision) does not fix this
  and is not evidence that it is fixed.

---

## 2026-08-29 — filed through the inbox spool

### 3. `src/App.tsx` has no test coverage for its startup sequence

* **ID:** f-20260829-03 · **Status:** open · **Area:** app-startup · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src/App.tsx`.
* **Defect:** 0 of 75 lines covered. `useDocumentLanguage` was extracted to `src/hooks/` to unblock
  the frontend ratchet, but `useAppStartup`, `preloadReferenceDb`, the update check, the telemetry
  gate and the splashscreen `finally` are still untested inside the composition file, so the
  application's startup path has no regression cover at all.
* **Carried from:** `FRONTEND_AUDIT_PLAN.md`, which names this "the next piece of real work".
* **Related:** the `convert_progress` incident in `.claude/rules/ipc-events.md` was a listener
  removed from exactly this file, unnoticed because nothing tested it.

---

## 2026-08-29 — filed through the inbox spool

### 4. Backend coverage counts `#[cfg(test)]` modules against production ratios

* **ID:** f-20260829-04 · **Status:** open · **Area:** gate-scripts · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `scripts/rust-branch-coverage.mjs`, `backend-coverage-areas.json`.
* **Defect:** the exporter measures `#[cfg(test)] mod tests` alongside production code, so a test's
  own untaken branches count against the area ratio — 89 of 4254 branch records today. Adding tests
  can therefore *lower* an area's number, which inverts the incentive the ratchet exists to create.
* **Why it was deferred:** excluding test modules shifts every baseline at once, so it needs its own
  run and a deliberate re-baseline against a known-good measurement environment. It is coupled to
  finding 1 — decide where the canonical measurement happens first.
* **Carried from:** `BACKEND_AUDIT_PLAN.md`, "Final exact-tree verification (2026-08-13)".

---

## 2026-08-29 — filed through the inbox spool

### 5. Mutation evidence has never been produced on this tree

* **ID:** f-20260829-05 · **Status:** handled · **Area:** gate-scripts · **Root:** - · **Entry:** inline · **Blocked:** none
* **Where:** `scripts/run-frontend-mutation.mjs`, `scripts/run-backend-mutation.mjs`.
* **Defect:** the backend run of 2026-08-09 was aborted mid-flight (unsynchronised `Cargo.lock`
  under `--locked`) and its numbers are explicitly discarded; the frontend numbers describe an older
  tree. `cargo-mutants` and `cargo-llvm-cov` were installed on atlas on 2026-08-29, so both suites
  can now run here for the first time — `stryker.config.mjs` sets `break: 100`, so any survivor
  fails the run.
* **Carried from:** both audit plans. The tooling half is closed; the evidence half is not.

* **Frontend half produced, 2026-08-29:** `pnpm mutation:frontend` ran for the first time on this
  tree and is **red**: the `game-practice` package scores 97.93 with **3 surviving mutants**, and
  `stryker.config.mjs` sets `break: 100`. The runner stops at the first failing package, so
  `workspace-storage` and `tree-path` are still unmeasured. Report:
  `artifacts/mutation/frontend/game-practice/`. The survivors are filed separately as
  `f-20260829-08`; rerun this once they are killed to measure the remaining two packages.

* **Backend half in flight overnight, 2026-08-29 22:06.** `pnpm mutation:backend` is running
  detached on `tuxedo-atlas`, log
  `/tmp/claude-1000/-home-felixb-Projekte-en-croissant/2a3f2513-98bb-4b33-b142-653d3280ddd0/scratchpad/mutation-backend.log`.
  Measured rate: 5 of package 1's 96 mutants in ~6 minutes, so the full 8 packages are plausibly
  6–12 h. Verified before leaving it: the machine does not auto-suspend
  (`powerdevilrc AutoSuspendAction=0`, logind `IdleAction=ignore`), so only the display sleeps.
  Deliberately **not** killed in favour of a CI matrix: the local run is the only source of
  per-package timing and outcome data, and that data is what shapes the matrix correctly instead
  of guessing job sizes and timeouts.
* **Reading it the next morning, in this order:**
  1. `git status -- src-tauri` — empty means cargo-mutants restored the tree. A
     `/* ~ changed by cargo-mutants ~ */` marker means the run was interrupted; restore with
     `git checkout -- src-tauri` before anything else (`f-20260829-09`).
  2. `grep -E "MUT_BE_STATUS" <log>` for the verdict, and `mutants.out/backend/<package>/mutants.out/missed.txt`
     per package for survivors. Exit 3 is a timeout, which the runner tolerates only when
     `missed.txt` is empty.
  3. Per-package wall time from the log — that is the input for splitting `mutation:backend` out of
     `test.yml` into its own dispatchable workflow with a matrix over the 8 packages
     (`BACKEND_MUTATION_PACKAGE` already exists for exactly this).
* **Why the split is needed at all:** `test.yml` runs `mutation:backend` as its last step inside
  GitHub's 6 h per-job limit, on a slower 2-core runner. At the measured local rate that step alone
  would very likely exceed the limit, so every CI run would end red at it regardless of the code.
  Mutation is a periodic deep check, not a per-commit gate. `mutation:frontend` (21 s) stays in
  `test.yml`.
* **Timeouts observed so far are legitimate kills, not a too-low threshold:** the baseline test run
  is 0 s and cargo-mutants auto-set 30 s, and the four early timeouts are all in
  `MainlineMoveBytesIter::next`, where mutating the cursor advance produces an infinite loop.

* **Backend half complete and green, 2026-08-29.** All eight packages, **324 mutants: 305 caught,
  9 timeouts, 10 unviable, 0 survivors.**

  | package | generated | caught | timeout | unviable | missed |
  | --- | --- | --- | --- | --- | --- |
  | `database-encoding` | 96 | 85 | 7 | 4 | 0 |
  | `game-rules` | 84 | 81 | 0 | 3 | 0 |
  | `pgn-parser` | 59 | 56 | 2 | 1 | 0 |
  | `database-search` | 36 | 36 | 0 | 0 | 0 |
  | `path-authority` | 20 | 20 | 0 | 0 | 0 |
  | `download-policy` | 18 | 18 | 0 | 0 | 0 |
  | `lexer` | 10 | 8 | 0 | 2 | 0 |
  | `engine-protocol` | 1 | 1 | 0 | 0 | 0 |

  The nine timeouts are legitimate kills, not a threshold set too low: the baseline test run is 0 s
  against an auto-set 30 s limit, and they are all mutations of a cursor advance (`+=` to `*=` or
  `-=`) inside an iterator, which produces an infinite loop.

  Run in two parts. Seven packages completed in one ~50-minute run; a machine shutdown then
  interrupted the eighth, which was reran on its own through `BACKEND_MUTATION_PACKAGE=pgn-parser`
  in 5 minutes rather than repeating the hour. That selector earning its keep on the first real
  interruption is also the argument for the CI matrix in `.github/workflows/mutation.yml`.

  The interruption left an injected mutant in tracked source; see `f-20260829-09`, which now carries
  the actual diff.
* **Status handled:** the evidence this finding asked for now exists on both sides. The backend is
  green; the frontend produced three survivors, which are their own finding, `f-20260829-08`, and
  the two frontend packages behind it remain unmeasured until those are killed.

---

## 2026-08-29 — filed through the inbox spool

### Frontend coverage measures differently on atlas than the baseline records

* **ID:** f-20260829-06 · **Status:** handled · **Area:** gate-scripts · **Root:** machine-dependent-measurement · **Entry:** build · **Blocked:** none
* **Where:** `coverage-baselines.json`, `scripts/coverage-report.mjs`, area `tauri-ipc-platform`.
* **Defect:** `pnpm coverage:frontend:check` fails on atlas with
  `tauri-ipc-platform lines regressed: 156/218, baseline 155/215`. One line *more* is covered
  than the baseline records, but three more lines are counted in total, so the ratio falls and
  the ratchet rejects it. Nothing in that area changed: its paths are explicit files plus
  `src/chessground/**`, and `git status` shows none of them touched.
* **Not an isolated area.** Comparing the fresh LCOV against the baseline area by area, six of
  ten areas disagree — `application-bootstrap` 39/130 vs 39/137, `databases-files` 211/1680 vs
  204/1679, `accounts-remote` 185/1022 vs 179/1016, `settings` 73/659 vs 15/653,
  `state-persistence` 689/956 vs 673/941, `tauri-ipc-platform` 156/218 vs 155/215. Only the last
  one *regresses*, which is why the reporter stops there; the rest happen to move upward, and a
  ratchet does not object to improvement. So the baseline is not describing this machine's
  measurement at all — it only stays green where the difference points the right way.
* **Suspected cause:** V8 line and branch attribution differs by Node version, and the baselines
  were recorded on another machine (atlas runs Node 24.20.0; CI pins `node-version: lts/*`, which
  floats). This has the same shape as `f-20260829-01` on the backend, hence the shared `Root`.
* **Not done:** no baseline was rewritten, and `coverage:baseline:frontend` was not run.
* **What decides it:** the CI run dispatched on 2026-08-29 also runs `coverage:frontend:check`.
  If CI is green, the baselines describe the CI environment and the fix is to make that the
  canonical measurement — the same move already taken for the e2e snapshots (`d-20260829-01`).
  If CI is red too, the baselines describe a machine nobody uses and must be re-established.
* **Found by:** the atlas setup audit, 2026-08-29, running the gate for the first time on this
  machine.

* **Adjudicated 2026-08-29 by CI run 33275934621 — and it inverts the hypothesis above.** The
  push-triggered run on `ubuntu-latest` measured

  ```
  tauri-ipc-platform lines regressed: 156/218, baseline 155/215
  ```

  **byte-identical to what atlas measures.** So the answer is not "atlas is the outlier": GitHub's
  runner and atlas agree, and the *baseline* matches neither. `coverage-baselines.json` records the
  instrumentation of a third machine — the laptop the audit ran on — which is no longer part of the
  loop.
* **This is not a coverage regression, and that matters for how it is fixed.** Covered lines went
  *up* (156 vs 155). The total went up too (218 vs 215), so the ratio slipped from 72.09 % to
  71.56 % and the ratchet fired on the ratio. Nothing got less tested; the instrumentation counts
  three more lines than the recording machine did.
* **Consequence for the whole gate, not just this area:** the frontend ratchet is the fourth step in
  `test.yml`, so its failure skipped everything after it — `build-vite`, `bindings:check`,
  `bundle:check`, the container e2e, `mutation:frontend`, and the entire Rust half including
  `coverage:backend:check`. **CI cannot answer `f-20260829-01` until this one is settled**, and no
  push can currently get a green run.

* **Decision:** the coverage baselines record a machine that is no longer in the loop, and no push
  can produce a green CI run until that is resolved. Which way?
  * **Option A — re-establish both baselines from the canonical environment (CI).** Since CI and
    atlas measure identically for the frontend, re-recording on atlas produces numbers CI agrees
    with. Cost: the historical comparison point is discarded, and if any of the six differing areas
    conceals a genuine regression, re-recording buries it. Mitigation: record the per-area deltas in
    the commit message rather than writing the file blind, so a later reader can audit each one.
  * **Option B — leave the baselines and accept a permanently red gate.** Cost: `test.yml` fails at
    step four forever, so `bindings:check`, `bundle:check`, the container e2e, `mutation:frontend`
    and the whole Rust half never run in CI again. That is strictly worse than having no ratchet:
    one stale number disables eleven working gates.
  * **Option C — weaken the ratchet to compare covered counts only, not the ratio.** The covered
    count did rise (156 vs 155), so this would pass. Cost: it removes the property the ratchet
    exists for — a change that adds untested lines faster than tested ones would no longer be
    caught anywhere.
  * **Ruled out — reproduce the old numbers.** The recording machine was the laptop, which is
    unreachable from atlas and out of the loop. There is nothing to reproduce them on.
  * **Could not determine:** whether the backend baseline has the same cause. CI never reached that
    step, so the backend remains an inference from the frontend result, not a measurement.
  * **Recommend:** Option A, executed in two steps so the backend is measured rather than assumed —
    re-record the frontend baseline, push, let CI run through to the backend ratchet, then re-record
    the backend baseline from what CI prints there. The counter-argument against A is real and is
    the reason for the per-area delta audit: this is a *re-recording on a changed instrument*, not
    the forbidden move of silencing a regression. The tree is unchanged, and covered lines went up,
    not down.
  * **Session:** session_01J6xiFxQ3rvXRka5UGQWANZ (2026-08-29 setup audit and push)

* **Handled 2026-08-29** under `d-20260829-02`. The frontend baseline was re-recorded from the
  current instrument on atlas, with a per-area audit in the commit message (`9c50a9ef`): no area
  lost covered lines, every delta zero or positive, and `settings` gaining 58 covered lines on an
  unchanged tree is the clearest single sign that the old file recorded a different instrument.
* **Confirmed by CI, which is the point of the exercise:** run 33276346587 reported
  `Enforce frontend coverage ratchet: success` on GitHub's runner against the baseline recorded on
  atlas. Two independent environments now agree with the committed numbers.
* **One trap surfaced on the way and is fixed** (`7eaf9948`): `--write-baseline` emitted
  `JSON.stringify` output, which oxfmt rejects, so *every* legitimate re-record left `lint:ci` red
  for an unrelated reason — it reddened CI one commit later. `writeBaseline` now formats what it
  writes.
* The deny on `coverage:baseline:*` was lifted for exactly one command and restored with **zero net
  diff** to `.claude/settings.json`. A red ratchet still means "investigate", never "re-record".

---

## 2026-08-29 — filed through the inbox spool

### CI has never completed: `bindings:check` ran before `dist/` existed — handled 2026-08-29

* **ID:** f-20260829-07 · **Status:** handled · **Area:** ci-workflows · **Root:** - · **Entry:** inline · **Blocked:** none
* **Where:** `.github/workflows/test.yml`, step `Verify generated bindings`.
* **Defect:** `pnpm bindings:check` compiles the Tauri binary, and `tauri::generate_context!()`
  (`src-tauri/src/main.rs:1271`) panics at compile time when the configured `frontendDist`
  (`../dist`) does not exist. The step sat third in the job, before `Build frontend`, so on a clean
  runner `dist/` was absent and the job died with
  `proc macro panicked … The frontendDist configuration is set to "../dist" but this path doesn't
  exist`. Every subsequent step was skipped, and the three `if: always()` artifact uploads then
  failed a second time on `if-no-files-found: error`, which buries the real cause under four red
  steps.
* **Why nobody saw it:** the fork had **zero** workflow runs — `gh run list -R
  felixabeck/en-croissant` returned an empty list although both workflows were `active` and
  `actions/permissions` reported `enabled: true`. Locally the ordering is harmless because `dist/`
  is left over from an earlier build, so a developer machine cannot reproduce it.
* **Handled 2026-08-29:** the step moved to directly after `Build frontend`, with a comment naming
  the dependency. The Rust steps that also compile `generate_context!` (`cargo check`, `clippy`,
  `test:coverage:backend`) already sat after it and were never affected.
* **Not yet proven:** the fix lives in the working tree. CI can only confirm it once the branch is
  pushed, because `workflow_dispatch` runs the workflow as committed on the ref.
* **Found by:** the first workflow run ever dispatched on this fork, run 33272351210, 2026-08-29.

* **Proven on a clean runner, 2026-08-29:** CI run 33276346587 reported
  `Build frontend: success` followed by `Verify generated bindings: success`. The reorder holds
  where it actually mattered — the environment that could never have passed before.
* The same run also carried the two previously orphaned boundary checks
  (`Enforce the Tauri command boundary`, `Enforce the UI component boundary`) green, and the
  containerized e2e (`Run browser accessibility and visual contracts: success`) — the first proof
  that the committed snapshots verify on a GitHub runner as well as on atlas, which is what
  `d-20260829-01` claimed.

---

## 2026-08-29 — filed through the inbox spool

### Three mutants survive in `gameSession.ts` — the game-session correlation guards are untested

* **ID:** f-20260829-08 · **Status:** handled · **Area:** frontend-state · **Root:** - · **Entry:** lens · **Blocked:** none
* **Where:** `src/components/boards/gameSession.ts`, lines 21, 47 and 49.
* **Defect:** the first-ever valid `pnpm mutation:frontend` run on this tree (2026-08-29) leaves
  three mutants alive at 97.93, under the `break: 100` threshold in `stryker.config.mjs`:
  * **line 21**, `typeof session !== "bigint"` replaced by `false` — no test feeds
    `nextAcceptedGameRevision` a payload whose `revision` is a valid non-negative bigint while
    `session` is not a bigint. A malformed native payload would be accepted as a live revision.
    Genuine gap.
  * **line 49**, `queuedSession !== null` replaced by `true` — behaviour really does change when
    `queuedSession` and `currentSession` are **both** `null`: the guard makes
    `isCurrentQueuedGameUpdate` return `false`, the mutant lets `null === null` return `true`.
    Genuine gap, and the more interesting one: it is the case where a throttled update carries no
    session at all.
  * **line 47**, `queuedGeneration !== null` replaced by `true` — `currentGeneration` is typed
    `number`, so `null === currentGeneration` is false either way and the guard is redundant. This
    looks like an **equivalent mutant**; confirm that reading before writing a test for it, and if
    it is equivalent, the honest fix is to drop the redundant clause, not to add a test that cannot
    fail.
* **Why it matters beyond the score:** these three functions are the correlation discriminators for
  game payloads — exactly what `.claude/rules/async-resource-invariants.md` requires every async
  result to be matched on. An untested discriminator is the failure the rule exists to prevent.
* **Entry `lens`:** the fix is small and local, but it decides whether a guard is redundant, so it
  wants `review-tests` over the diff (on Codex, per rule 6b).
* **Found by:** `pnpm mutation:frontend`, 2026-08-29. Report:
  `artifacts/mutation/frontend/game-practice/index.html`.

* **The runner stops here, so two packages are never measured.** `scripts/run-frontend-mutation.mjs`
  runs `game-practice`, `workspace-storage` and `tree-path` sequentially and exits on the first
  failing package. Because `game-practice` is red with these three survivors, `workspace-storage`
  and `tree-path` have never been measured on this tree at all, and a regression in either is
  invisible until these are killed. Killing them therefore buys more than the score: it is what
  reveals whether the other two packages are green. Raised by `review-tests` (confidence 99) during
  the 2026-08-29 `$push` review.

* **Handled 2026-08-29** (commits `d414020c`, `8760bb35`). Two of the three were real gaps and are
  now covered by tests; the third was dead code and was removed rather than given a test that could
  not fail — `queuedGeneration !== null` can never change the result because `currentGeneration` is
  `useRef(0)` and never null. The asymmetry with the session check is now documented in the
  function, because it reads like an oversight and is not: `currentSession` is genuinely nullable.
* **`pnpm mutation:frontend` now exits 0 across all three packages**, and the two that sat behind
  the failing one were measured for the first time ever:

  | package | killed | timeout | survived |
  | --- | --- | --- | --- |
  | `game-practice` | 141 | 0 | 0 |
  | `workspace-storage` | 311 | 0 | 0 |
  | `tree-path` | 129 | 5 | 0 |

  So the concern recorded above — that a regression in either later package was invisible — is
  answered: both are clean.

---

## 2026-08-29 — filed through the inbox spool

### `mutation:backend` mutates the real working tree and nothing guards it

* **ID:** f-20260829-09 · **Status:** open · **Area:** gate-scripts · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `scripts/run-backend-mutation.mjs`, the `--in-place` argument to `cargo mutants`.
* **Defect:** the runner mutates tracked source in place rather than in a copy — a deliberate
  choice, since copying the tree would duplicate a multi-gigabyte `src-tauri/target`, but it is
  unguarded in both directions:
  * **Nothing stops a concurrent write.** While the run is in flight, tracked files carry injected
    `/* ~ changed by cargo-mutants ~ */` markers. Observed 2026-08-29: `git status` reported
    `M src-tauri/src/db/encoding.rs` mid-run, and a commit taken at that moment with a path that
    happened to include it would have captured a mutation. The push skill's ban on `git add -A` is
    the only thing standing between that and a committed mutant.
  * **An abort leaves the markers behind.** cargo-mutants restores on a clean exit; a SIGKILL, a
    reaped process group (universal rule 7a) or a machine crash does not. The next session then
    sees corrupted source with no explanation, and the plausible reading is a broken checkout.
* **Suggested direction, not decided:** refuse to start when `git status --porcelain -- src-tauri`
  is non-empty, and write a marker file for the duration whose presence a later run reports as
  "a previous mutation run did not restore the tree; check `git status -- src-tauri`". A lock would
  also stop two runners racing. Whether the guard belongs in the runner or in the push skill is the
  open question.
* **Interim mitigation, 2026-08-29:** the hazard is documented at the top of the runner and in the
  Gates section of `CLAUDE.md`. That is a note, not a guard.
* **Found by:** the atlas setup audit, 2026-08-29, running the suite for the first time.

* **Observed for real, 2026-08-29 ~22:5x.** The machine was shut down while the run was inside the
  eighth package, and the injected mutant stayed in tracked source exactly as predicted:

  ```
  src-tauri/src/pgn.rs:194
  -        } else if character == '\\' {
  +        } else if character != /* ~ changed by cargo-mutants ~ */ '\\' {
  ```

  Restored with `git checkout -- src-tauri/src/pgn.rs`. Note what makes this the dangerous shape
  rather than a merely annoying one: the mutation is a **single inverted comparison inside a PGN
  tag-header scanner**, it compiles, and the file it sits in is one of the repository's
  highest-review paths. A session that resumed here and ran `git add src-tauri` without reading the
  diff would have committed it, and the next reviewer would have been looking at a plausible-looking
  one-character change to escape handling.
* **Second effect the shutdown exposed:** the run's stdout log lived in the session scratchpad,
  which the next session replaced, so the human-readable progress was gone. The durable evidence
  survived only because cargo-mutants writes `mutants.out/backend/<package>/mutants.out/` to the
  repo. Whatever guard is built should treat `mutants.out/` as the record and the console log as
  disposable.

---

## 2026-08-29 — filed through the inbox spool

### Polyglot book lookups hash a FEN built with `EnPassantMode::Legal`, so legal-only ep positions miss

* **ID:** f-20260829-10 · **Status:** open · **Area:** chess-tree · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/game.rs:2397-2398` — the FEN is built with
  `Fen::from_position(controller.position.clone(), EnPassantMode::Legal)` and handed straight to
  `polyglot_hash_from_fen` in `CancellablePolyglotBook::get_all_moves_from_fen` (`game.rs:2058`).
* **Defect:** the Polyglot key includes the en-passant file when a pawn of the side to move can
  capture there — the standard generators apply the *pseudo-legal* test. `EnPassantMode::Legal`
  only serialises the ep square when the capture is fully legal, so in a position where the
  capture is pseudo-legal but leaves the king in check, our FEN omits the square, the key omits
  the file, and the lookup misses an entry the book actually contains.
* **Concrete case from the lens, worth reproducing before fixing:** from
  `4r2k/3p4/8/4P3/8/8/8/4K3 b - - 0 1` play `d7d5`, giving
  `4r2k/8/8/3pP3/8/8/8/4K3 w - d6 0 2`. `e5xd6` is illegal (it exposes the white king to the e8
  rook), so shakmaty drops `d6` under `Legal` — while a standard Polyglot book hashed the d-file.
* **Why this is `build` and not `inline`:** the one-word change to `PseudoLegal` is only correct if
  `polyglot_book_rs::polyglot_hash_from_fen` does not itself re-derive the ep condition, and if the
  same FEN is not relied on elsewhere for a different purpose (the same expression appears at
  `game.rs:358`, `370`, `513`, `549`, `1283`, `1689` for state reporting, where `Legal` is right).
  It needs a test against a known book entry, not a blind swap. `.claude/rules/chess-tree-semantics.md`
  is the governing rule: which FEN fields define identity is exactly its subject.
* **Found by:** `review-chess-semantics` (confidence 97) during the `$push` review of the
  2026-08-29 setup work; call site verified by hand.

---

## 2026-08-29 — filed through the inbox spool

### `opening_book_ext` never returns `"zip"`, so the whole zip opening-book branch is dead

* **ID:** f-20260829-11 · **Status:** open · **Area:** native-fs · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/game.rs:1854-1865` (`opening_book_ext`), the `Some("zip")` arm at
  `game.rs:1973`, and the test at `game.rs:2911-2919`.
* **Defect:** `opening_book_ext` maps only `.epd`, `.pgn` and `.bin`, returning `None` otherwise.
  The `Some("zip")` arm — with `read_zip_inner_cancellable` and a full inner dispatch onto epd/pgn/bin
  — is therefore unreachable, and every `.zip` opening book is rejected even though the code to
  handle one exists and the user-facing error implies zip is supported.
* **The open question, which is why this is not a one-line fix:** the test at `game.rs:2916`
  asserts `("book.zip", None)` explicitly, so somebody either disabled zip deliberately and left
  the branch, or wrote the test to match the bug. Both readings are consistent with the code. The
  fix is either to add `.zip` to `opening_book_ext` and correct that assertion, or to delete the
  dead arm and `read_zip_inner_cancellable` — opposite directions, and the wrong one is a silent
  regression for anyone whose books are zipped.
* **Found by:** the adjacent-defects lens (confidence 100) during the `$push` review of the
  2026-08-29 setup work; verified by reading both sites.

---

## 2026-08-29 — filed through the inbox spool

### Backend coverage hardcodes the x86_64 Linux target triple

* **ID:** f-20260829-12 · **Status:** open · **Area:** gate-scripts · **Root:** machine-dependent-measurement · **Entry:** inline · **Blocked:** none
* **Where:** `scripts/rust-branch-coverage.mjs:59` —
  `resolve(sysroot, "lib/rustlib/x86_64-unknown-linux-gnu/bin")`.
* **Defect:** the path to `llvm-profdata` and `llvm-cov` is built from a literal triple, so
  `pnpm test:coverage:backend` cannot work on ARM Linux, macOS or Windows. It fails looking like a
  missing toolchain rather than an unsupported platform.
* **Fix direction:** derive the host triple instead of writing it down — `rustc -vV` prints a
  `host:` line, and the script already shells out to `rustup run <toolchain> rustc` for the sysroot,
  so the same call can yield both.
* **Why it sits with the coverage root:** it belongs to the same story as `f-20260829-01` and
  `f-20260829-06` — the backend coverage measurement is tied to one machine shape in more than one
  way, and whoever settles where the canonical measurement lives should settle this in the same
  pass rather than fixing the triple and re-opening the file later.
* **Found by:** the adjacent-defects lens (confidence 100) during the `$push` review of the
  2026-08-29 setup work.

---

## 2026-08-29 — filed through the inbox spool

### The Rust channel floats, so a promoted clippy lint can redden an unchanged tree

* **ID:** f-20260829-13 · **Status:** open · **Area:** ci-workflows · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `rust-toolchain.toml` (`channel = "stable"`) and `.github/workflows/test.yml`
  (`dtolnay/rust-toolchain@stable`).
* **Defect, as raised:** `cargo clippy -D warnings` went red on 2026-08-29 on a tree nobody had
  touched, because clippy 1.98 promoted `chunks_exact_to_as_chunks`. The expression was fixed
  (`f1b2445b`), but the *mechanism* — an unpinned channel deciding which lints exist — is
  unchanged, so the same class recurs on every Rust release.
* **The genuine trade, which is why this is `build`:** pinning an exact version
  (`channel = "1.98.0"`) makes the gate reproducible and makes lint changes arrive as a deliberate
  bump; it also means nothing exercises a newer compiler until somebody bumps it, so the breakage
  is deferred rather than removed and can arrive as a pile. The counter-shape is to keep the float
  and treat a promoted lint as ordinary maintenance. Both are defensible; the repository should
  choose once and say so where the toolchain is declared.
* **Note:** whichever is chosen, the two declarations must agree. Today `rust-toolchain.toml`
  pins components while CI installs its own via the action, so deleting the file would leave CI
  green — nothing proves the file is still doing anything.
* **Found by:** `review-root-cause` (confidence 97) during the `$push` review of the 2026-08-29
  setup work.

---

## 2026-08-29 — filed through the inbox spool

### `findings.py` can report the cleanup error and swallow the write error that caused it

* **ID:** f-20260829-14 · **Status:** open · **Area:** gate-scripts · **Root:** - · **Entry:** inline · **Blocked:** none
* **Where:** `scripts/findings.py`, the ledger-write path around line 1391 (`finally` block).
* **Defect:** if writing, syncing or replacing the ledger fails and the temporary-file cleanup in
  the `finally` block then also fails, the cleanup `OSError` propagates and replaces the original
  exception. `main` prints only the cleanup failure, so the operator sees "could not remove
  /tmp/...tmp-x" instead of the actual reason the ledger could not be written — for a tool whose
  entire purpose is not losing findings, the informative half of the failure is the half that is
  dropped.
* **Fix direction:** suppress (or chain) the cleanup exception so the primary error survives —
  `contextlib.suppress(OSError)` around the unlink, which the file already imports `suppress` for.
* **Important constraint — do not fix only here.** `scripts/findings.py` is deliberately identical
  across Felix's projects (see this repository's `CLAUDE.md`, "Findings ledger", and
  `~/.claude/references/findings-ledger-contract.md`). A repo-local patch would fork the shared
  tool, which is worse than the bug. The change belongs in the canonical copy and must then be
  propagated to every project that carries it.
* **Found by:** `review-error-handling` (confidence 95) during the `$push` review of the
  2026-08-29 setup work.

---

## 2026-08-29 — filed through the inbox spool

### The coverage ratchet penalises deleting covered code

* **ID:** f-20260829-15 · **Status:** open · **Area:** gate-scripts · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `scripts/coverage-report.mjs`, `assertBaseline`; the rule is stated in
  `docs/coverage.md:5` — "rejects a lower covered count, a larger total, or a lower percentage".
* **Defect:** the covered-count clause fires on any deletion of covered code, because removing a
  covered line or branch necessarily lowers the count. Observed 2026-08-29: deleting one provably
  dead branch (`queuedGeneration !== null`, which mutation testing had flagged as an equivalent
  mutant) moved `boards-game-analysis` branches from 181/5677 to 180/5676 and reddened the gate,
  even though the ratio was effectively unchanged and no behaviour lost cover.
* **Why it matters more than the one incident:** this makes the ratchet push against exactly the
  cleanup that mutation testing asks for. The cheapest way to keep a gate green is then to leave
  dead code in place, which is the opposite of what both gates exist to encourage — and the
  workaround is a baseline refresh, i.e. the operation the same document warns about. Every such
  deletion now needs a decision entry (`d-20260829-03` is the first).
* **Fix directions, not decided:** compare ratios with a tolerance instead of raw counts; or scale
  the expected covered count by the change in total, so a proportional deletion is neutral; or
  exempt a decrease whose covered/total deltas are equal. Each has a different failure mode and the
  choice deserves its own interview — a tolerance that is too loose silently readmits the small
  regressions this ratchet was built to catch (`docs/coverage.md:9-11`).
* **Found by:** the 2026-08-29 setup run, when killing the `f-20260829-08` mutants required
  deleting the dead branch.

---

## 2026-08-30 — filed through the inbox spool

### `remove_tree_at` recursion into a nested subdirectory is not deterministically tested

* **ID:** f-20260830-01 · **Status:** handled · **Area:** native-fs · **Root:** - · **Entry:** lens · **Blocked:** none
* **Where:** `src-tauri/src/infra/fs.rs:413-414`, the recursive arm of the `RawDir` walk:
  `if bytes != b"." && bytes != b".." { remove_tree_at(&child, OsStr::from_bytes(bytes))?; }`.
* **Defect:** the recursion is only reached when the directory being removed *contains a
  subdirectory*, and no test constructs that shape on purpose. Whether the line executes depends on
  what the temporary tree happens to hold, which is why it is the **single** line record that
  differs between `tuxedo-atlas` (HIT) and GitHub's runner (miss) out of 6292 in the area — see
  `f-20260829-01` for the full diff.
* **Why it deserves a test on its own merits, independent of coverage bookkeeping:** recursive
  deletion is the dangerous half of this function. It descends through directory entries and calls
  `unlinkat(..., REMOVEDIR)`, under a `dev`/`ino` identity guard meant to stop a concurrently
  swapped parent from redirecting the walk. Nothing currently proves the descent happens, that it
  terminates, or that the guard still holds one level down.
* **Suggested shape:** create `a/b/c` with a file at the deepest level, remove `a`, assert the tree
  is gone and that the identity guard rejects a parent swapped between the walk and the unlink —
  the neighbouring tests already use the `AtomicFileFaultPoint` injector for exactly that kind of
  interleaving.
* **Side effect worth having:** with the line deterministically covered, atlas and CI agree at
  4208/6292 lines for `app-infrastructure`, removing the only real cross-machine difference there.
* **Found by:** diffing CI's `backend-coverage` artifact (run 33277621360) against the local LCOV,
  2026-08-30.

* **Corrected 2026-08-30, before any of the below was acted on.** The premise recorded above — that
  `fs.rs:413` is "reached by nothing deliberate" and is the single differing *line* record — is
  **wrong**, and a review lens caught it at 99 confidence. Measured on atlas against unmodified
  `HEAD`: `DA:413` is hit 18 times and every branch record in the walk is already covered
  (`BRDA:409,0,{0,1}` and `BRDA:412,{0,1},{0..3}` all non-zero). The pre-existing test
  `recursive_delete_rejects_symlink_children_without_traversing_them` **does** execute the
  recursive call — that call is how its symlink child gets inspected and refused.
* **What is actually true, from CI's artifact for run 33278503556 against atlas's LCOV on the same
  commit `b8f844de`:** the entire cross-machine gap is in this one function, and it is a difference
  in *how often the directory arm is entered at all*, not in which line is instrumented.

  ```
              DA:407 (directory arm)   DA:414   DA:416 (unlinkat REMOVEDIR)
    atlas               21                30        9
    CI                   1                 0        0
  ```

  On the runner the arm is entered exactly once — by the symlink test, whose `?` propagates out of
  the walk before the loop reaches a second entry, the `.`/`..` skip, or the closing `unlinkat`.
  On atlas it is entered 21 times, because other tests' workspace cleanup takes the
  permanent-delete branch of `file_workspace.rs:515` here and does not there. The three branch
  records that CI misses and atlas covers — `BRDA:409,0,1`, `BRDA:412,0,1`, `BRDA:412,1,3` — are
  exactly the 747 vs 744 difference in `app-infrastructure`.
* **So the tests are still the right answer, for a better reason than the one first recorded.** They
  do not fix a gap on atlas (fs.rs measures 443/1468 before and after, unchanged). They make the
  successful descent happen *deterministically in every environment*, instead of as a side effect of
  which cleanup path the host filesystem selects. The falsifiable prediction: CI moves 744 -> 747
  and `coverage:backend:check` passes there against the unchanged 746 baseline.

* **Handled 2026-08-30.** Two tests added to `src-tauri/src/infra/fs.rs`, each proven to fail
  against the defect it exists for rather than merely to pass:
  * `recursive_delete_descends_through_nested_directories` — three levels with a file at each and a
    sibling outside the removed entry. Replacing the recursive call with a no-op fails it with
    `DirectoryNotEmpty`; three levels rather than two, so a recursion that only ever unwinds once
    cannot pass it.
  * `recursive_delete_rejects_a_symlink_planted_below_the_top_level` — the link sits two directory
    levels below the removed entry, so unlike the pre-existing test it is reached only after a real
    descent. Dropping `AtFlags::SYMLINK_NOFOLLOW` from the `statat` — a real directory-traversal
    escape, since the link then resolves to a directory and the walk deletes outside the tree —
    fails both refusal tests.
* **Not done:** re-verifying `(dev, ino)` during the walk. The guard is established once, at the top
  of `remove_entry_at`; per-level protection is `NOFOLLOW` plus the `FileType` match, which is what
  the two refusal tests now pin at two depths. Substitution racing the walk is a separate defect and
  is filed as its own finding, not claimed as covered here.

---

## 2026-08-30 — filed through the inbox spool

### `remove_entry_at` verifies an inode and then removes a path, with nothing binding the two

* **ID:** f-20260830-02 · **Status:** open · **Area:** native-fs · **Root:** remove-tree-unhardened · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/infra/fs.rs:836-838` (`assert_entry_identity` then
  `unix::remove_tree_at(parent, name)`), and `fs.rs:392-406` for the same pattern one level down
  (`statat` then `openat`/`unlinkat` on the same `name`).
* **Defect:** the `(dev, ino)` guard is checked once, against a *name*, and every subsequent
  syscall re-resolves that name. Between the assertion and the removal, a concurrent writer can
  replace the entry: `NOFOLLOW` blocks a symlink substitution, but not replacement by another real
  directory or file. The walk then deletes a tree whose identity was never authorised, while the
  entry that *was* authorised survives elsewhere. Inside the recursion the guard is not
  re-established at all — each level repeats `statat` -> `openat`/`unlinkat` with no check that the
  descriptor it opened is the inode `RawDir` reported.
* **Why it matters here:** this is the one function in the codebase that deletes user data
  recursively, and the identity guard is the entire reason it is considered safe to point at a
  renderer-supplied path. A guard that does not survive to the syscall it guards is decoration.
* **Shape of a fix (open — this is why `Entry: build`):** either re-`statat` the opened descriptor
  with `fstat` and compare `(dev, ino)` before acting at each level, or move to `openat2` with
  `RESOLVE_NO_SYMLINKS`/`RESOLVE_BENEATH` and hold descriptors rather than re-resolving names. The
  choice affects the minimum kernel version and is a real design decision, not an implementation
  detail.
* **Found by:** `$push` review lenses (adjacent-defects and adversarial, both 99 confidence) over
  the `f-20260830-01` test diff, 2026-08-30.

---

## 2026-08-30 — filed through the inbox spool

### Recursive delete puts 8 KiB on the stack per directory level, with no depth bound

* **ID:** f-20260830-03 · **Status:** open · **Area:** native-fs · **Root:** remove-tree-unhardened · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/infra/fs.rs:407` — `let mut buffer = [MaybeUninit::uninit(); 8192];`
  inside the `FileType::Directory` arm, with the recursive call at `fs.rs:413`.
* **Defect:** the `RawDir` buffer is a stack array allocated once per recursion level, and the
  recursion has no depth limit. A directory tree nested deep enough — which a user can create, and
  which an archive extracted into the workspace can create without the user noticing — exhausts the
  thread stack. Stack overflow in Rust aborts the process; it is not a catchable error, so this is
  an application-kill on user-controlled input rather than a failed operation.
* **Contradicts a standing rule:** `.claude/rules/async-resource-invariants.md` requires that
  anything which accumulates is bounded and that the bound is stated. Recursion depth here is
  unbounded and unstated.
* **Shape of a fix (open):** an explicit depth limit returning `Error::ResourceLimit` (the pattern
  `read_bounded_engine_line` already uses for a different unbounded input), or convert the walk to
  an iterative one holding an explicit stack of descriptors. The second removes the class instead
  of capping it, but changes the error-reporting shape.
* **Found by:** `$push` review lens (adjacent defects, 98 confidence) over the `f-20260830-01` test
  diff, 2026-08-30.

---

## 2026-08-30 — filed through the inbox spool

### A failed recursive delete reports failure after having already deleted part of the tree

* **ID:** f-20260830-04 · **Status:** open · **Area:** native-fs · **Root:** remove-tree-unhardened · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/infra/fs.rs:409-415` — the `?` on the recursive call and on
  `entries.next()`, inside a loop that has already unlinked earlier siblings.
* **Defect:** an error partway through the walk — a nested symlink, an unreadable directory, a
  `RawDir` error, a concurrent mutation — propagates out after siblings visited earlier were
  permanently unlinked. The caller sees only `Err`, with no indication that anything was removed.
  `file_workspace.rs:515` treats that `Err` as "the entry is still there" and keeps its authority
  entry, so the recorded state and the filesystem disagree, in the direction of claiming data still
  exists after it has been destroyed.
* **Note on scope:** partial progress is unavoidable for a recursive unlink; what is missing is
  that the error does not *say* it happened, so no caller can react to it. The two new refusal
  tests in `f-20260830-01` exercise exactly this path (the symlink is rejected mid-walk) and assert
  only that the outside tree survives — they do not pin what happened inside `victim`.
* **Shape of a fix (open):** carry a "partially removed" flag or a removed-entry count in the error,
  and decide at `file_workspace.rs:515` what the authority entry should then say. That is a
  contract question about the workspace model, not a local repair.
* **Found by:** `$push` review lens (adjacent defects, 96 confidence) over the `f-20260830-01` test
  diff, 2026-08-30.

---

## 2026-08-30 — filed through the inbox spool

### Recursive delete crosses mount boundaries

* **ID:** f-20260830-05 · **Status:** open · **Area:** native-fs · **Root:** remove-tree-unhardened · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/infra/fs.rs:398-406` — `openat` with `NOFOLLOW`, which refuses a
  symlink but accepts a mount point.
* **Defect:** a bind mount or any mounted filesystem inside the tree being removed is opened as an
  ordinary directory, so the walk descends into it and deletes the *mounted* content before the
  final `unlinkat(..., REMOVEDIR)` fails with `EBUSY`. The containment property the `NOFOLLOW`
  checks exist to provide — deletion stays inside the named subtree — does not hold across a mount,
  and the failure is reported only after the damage.
* **Why it is worth a decision rather than a silent accept:** the same `(dev, ino)` pair that the
  top-level guard compares is exactly what changes at a mount boundary, so the information needed
  to refuse is already being read at `fs.rs:392` and simply is not compared against the parent.
* **Shape of a fix (open):** compare `st_dev` against the parent directory's at each level and
  refuse on change, or use `openat2` with `RESOLVE_NO_XDEV`. Both are cheap; whether crossing should
  be an error or a skip is the actual question.
* **Found by:** `$push` review lens (adversarial, 98 confidence) over the `f-20260830-01` test diff,
  2026-08-30.
