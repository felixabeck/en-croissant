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

* **ID:** f-20260829-01 · **Status:** handled · **Area:** gate-scripts · **Root:** machine-dependent-measurement · **Entry:** build · **Blocked:** none
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

* **Closed 2026-08-30 by CI run 33298305678 on `4d3f8ffa` — green, with no baseline rewritten.**
  The prediction recorded above held to the record:

  ```
    area                          CI before    CI now      atlas   baseline
    app-infrastructure             744/2018   747/2018   747/2018   746/2018
    filesystem-native-boundaries   379/1052   379/1052   379/1052   379/1052
    oauth-credentials               130/244    130/244    130/244    130/244
    database-search                 249/378    249/378    249/378    247/376
    engine-game-chess               292/526    292/526    292/526    258/468
    auxiliary-domain-services         29/36      29/36      29/36      27/34
  ```

  The three records that were zero on the runner are now hit: `BRDA:409,0,1` = 3,
  `BRDA:412,0,1` = 4, `BRDA:412,1,3` = 4. **Every area now measures identically on atlas and on
  GitHub's runner.** The instrument was never describing a different machine — one function was
  being covered by accident, at a rate that depended on which cleanup path the host filesystem
  selected, and asserting it deliberately made the two environments agree.
* **`d-20260829-02` is spent without being exercised for the backend.** It authorised re-recording
  the baseline from CI's LCOV. Doing so would have written the floor down to 744 and permanently
  retired the enforcement of a recursive-delete path that guards against directory traversal. The
  delta audit it asked for is what showed that: the delta was three branch records in one function,
  not a stale instrument.
* **The root `machine-dependent-measurement` does not survive for the backend half.** The frontend
  half of that root (`f-20260829-06`) was a genuinely stale baseline and was re-recorded. This half
  was a missing test wearing the same symptoms. Two findings, one apparent root, two different
  causes — worth remembering before the next ratchet disagreement is attributed to the machine.

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

* **ID:** f-20260829-04 · **Status:** open · **Area:** gate-scripts · **Root:** - · **Entry:** build · **Blocked:** felix-decision
* **Where:** `scripts/rust-branch-coverage.mjs`, `backend-coverage-areas.json`.
* **Defect:** the exporter measures `#[cfg(test)] mod tests` alongside production code, so a test's
  own untaken branches count against the area ratio — 89 of 4254 branch records today. Adding tests
  can therefore *lower* an area's number, which inverts the incentive the ratchet exists to create.
* **Why it was deferred:** excluding test modules shifts every baseline at once, so it needs its own
  run and a deliberate re-baseline against a known-good measurement environment. It is coupled to
  finding 1 — decide where the canonical measurement happens first.
* **Carried from:** `BACKEND_AUDIT_PLAN.md`, "Final exact-tree verification (2026-08-13)".

* **Parked 2026-08-30** by the `gate-scripts` build run. The investigation is complete and the
  mechanism is chosen; only the last step is blocked, so this is a one-word decision rather than a
  fresh investigation.

* **The finding understated the defect by an order of magnitude, and its sign is inverted.** It
  described "89 of 4254 branch records". Measured on the committed
  `backend-coverage/lcov.info` (2026-08-30 11:16) against all 37 files under `src-tauri/src`: the
  28 inline `#[cfg(test)] mod` blocks contribute **6295 DA, 584 FN and 130 BRDA records**, and a
  further **43** `#[cfg(test)]`-guarded `fn`/`impl`/`struct`/`use`/`const`/statement items sit
  outside those blocks. Test code does not mainly depress the numbers — it **inflates** them.
  Backend production line coverage is not ~66 %. It is ~50 %.

  | Area | now (lines · functions · branches) | with `#[cfg(test)] mod` excluded |
  |---|---|---|
  | app-infrastructure | 4533/6601 · 752/1542 · 780/2064 | 2625/4687 · 621/1406 · 737/2016 |
  | filesystem-native-boundaries | 1643/3145 · 204/509 · 382/1058 | 862/2350 · 134/430 · 376/1050 |
  | oauth-credentials | 1427/2070 · 241/389 · 130/244 | 658/1281 · 124/259 · 105/204 |
  | database-search | 3284/4965 · 279/502 · 249/378 | 1759/3434 · 178/400 · 233/354 |
  | engine-game-chess | 2273/4453 · 327/571 · 292/526 | 1353/3528 · 212/455 · 290/522 |
  | auxiliary-domain-services | 595/1002 · 56/127 · 29/36 | 254/661 · 35/106 · 25/30 |

  These are module-only figures; excluding the 43 non-`mod` items moves every number slightly
  further down.

* **Why it is blocked.** Landing the exclusion requires two things in the same commit, or every
  backend gate is red: re-recording `backend-coverage-baselines.json`, and re-deriving
  `minimumCoverage`, because **14 of the 18 area floors break**. The four survivors are the branch
  floors of app-infrastructure (36.56 vs 36), database-search (65.82 vs 65), engine-game-chess
  (55.56 vs 55) and auxiliary-domain-services (83.33 vs 79, which would *rise*); every line and
  function floor fails. The baseline-writing commands are in `.claude/settings.json`'s `deny` list,
  and the harness genuinely refuses them — a bare `echo` of the pattern was refused during this
  run, not only the real command. The only non-denied route is a differently-phrased invocation of
  the same code, which is the evasion the repo `CLAUDE.md` names and forbids.

  `d-20260829-02` names this finding in its own `Governs:` line and prescribes the re-record
  procedure, so the *authority* exists; what is missing is the ability to execute it. Three
  plan-review lenses examined this specifically and returned the same verdict: a genuine external
  constraint, not effort, risk, size or recency.

* **Mechanism, already settled by measurement — do not re-derive it.** Three candidates are ruled
  out by evidence:
  * `llvm-cov export` name filters: `--name-regex=a^` (matches nothing) produced a byte-identical
    export, SHA-256 `d533c7ee…` both ways, `FN=88 FNDA=88 DA=748 BRDA=22` unchanged. The LCOV
    exporter ignores name filters; `--skip-functions` drops FN/FNDA only.
  * LCOV `::tests::` name filtering: the exporter emits v0-mangled names, so the count of
    `::tests::` in the LCOV is **0**, and `db/repository.rs:570` is a DA record inside a test module
    enclosed by no function at all.
  * `#[coverage(off)]`: the pinned `nightly-2025-06-01` (rustc 1.89.0-nightly) rejects it with
    `error[E0658]`. It is stable on this machine's rustc 1.98, so it would need a coverage-toolchain
    bump that re-scales every number anyway — and it is unenforced, since a future `mod tests`
    without the attribute silently re-inflates.

  The surviving mechanism is **source-range exclusion inside `scripts/rust-branch-coverage.mjs`**,
  driven by a new field in `backend-coverage-areas.json`, excluding **every** `#[cfg(test)]`-guarded
  item rather than only `mod`. Two implementation constraints that are not optional:
  * Naive brace counting fails at exactly one site — `src-tauri/src/pgn.rs:676`, where byte strings
    at 731/738/741 carry unbalanced literal braces and the scan runs to EOF. A masking pass over
    comments, strings, raw strings and char literals is required.
  * **`scopeSignature` must be extended in the same change.** `scripts/coverage-report.mjs` copies a
    fixed key list (`id`, `root`, `include`, `exclude`, `source`, `paths`), so a new config field is
    invisible to the scope guard otherwise. Since `f-20260829-15` landed, that signature is the
    *only* guard against narrowing the measured set — a narrowing now looks exactly like a deletion
    to the numeric ratchets.

* **Decision:** Should the backend coverage exporter stop measuring `#[cfg(test)]` code, accepting
  that the honest numbers are ~15 points lower and that 14 of 18 permanent floors must be re-derived
  onto the new scale?
  * **(a) Yes — exclude test code and re-derive.** `scripts/rust-branch-coverage.mjs` gets the
    masking scanner, `backend-coverage-areas.json` gets the exclusion field and 18 recomputed
    floors, `scopeSignature` gets the field, and `backend-coverage-baselines.json` is re-recorded
    once. Costs: one commit that lowers 17 floors and raises 1, with every delta audited in the
    message; and you must run the baseline command yourself, or lift the deny entry for one run.
    Gains: the gate starts measuring production code, and adding a test can no longer lower an
    area's ratio.
  * **(b) No — keep measuring test code.** Costs nothing today. The gate keeps reporting ~66 % line
    coverage for a backend that is at ~50 %, the floors keep certifying a number that includes the
    tests certifying it, and a test whose own branches are untaken still lowers its area.
  * **Ruled out:** annotating with `#[coverage(off)]` — `E0658` on the pinned toolchain, measured;
    filtering by function name — 0 matches and an unenclosed DA record, measured; leaving the floors
    untouched and writing new production tests until the corrected instrument clears them — the gap
    is 10 to 21 points across 14 floors, which is a coverage programme, not a fix for this finding.
  * **Recommend:** (a), because a gate that measures its own tests is measuring the wrong thing, and
    the current floors give false assurance about production code. Against it: re-deriving 18 floors
    in one commit is exactly the shape `docs/coverage.md` warns about, and once done, nobody can
    tell from the file alone that the lowering was an instrument change rather than a retreat — the
    audit lives only in the commit message. If that trade is unacceptable, (b) is a defensible hold
    provided the ~50 % figure is written into `docs/coverage.md` so the inflation is at least known.
  * **Could not determine:** the exact post-exclusion numbers for the decided design. The table
    above excludes `mod` blocks only; the 43 non-`mod` items were located but not measured, because
    that needs the scanner this run did not build.
  * **Session:** 3b1b6830-9591-40d2-a64b-50a8c928b0f1 — transcript
    `~/.claude/projects/*/3b1b6830-9591-40d2-a64b-50a8c928b0f1.jsonl`

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

* **ID:** f-20260829-09 · **Status:** handled · **Area:** gate-scripts · **Root:** - · **Entry:** build · **Blocked:** none
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

* **Handled 2026-08-30**, commit `1d93db6a`, by the `gate-scripts` build run.
* **The open question — runner or push skill — is answered: both, and neither alone is enough.**
  The push skill already forbade *starting* a mutation run on a dirty tree; the hazard is an
  *abort*, which no skill is present to observe, and `.github/workflows/mutation.yml` invokes the
  runner directly, so a skill-only guard protects neither CI nor a manual run. Conversely a
  runner-only fence is invisible to the concurrent session that is about to commit. So the runner
  owns the fence and `--check-guard` answers for it; `$push` runs `pnpm mutation:guard:check` before
  any other gate.
* **Four guards, because the defect has four shapes.** Entry refuses a dirty `src-tauri`, and a
  failing `git` is a refusal too — empty stdout from a broken `git` must never read as a clean tree.
  An fsynced `wx` fence at `mutants.out/backend/.mutation-in-progress` covers the whole run and
  doubles as the lock against a second runner. `spawnSync` became `spawn` so the cargo child has an
  owner: SIGINT/SIGTERM kill it and **await its terminal event**, escalating to SIGKILL, because
  cargo-mutants reverts cooperatively and a finaliser racing `kill()` can see a briefly clean file,
  clear the fence and exit while the mutator writes again. Every exit path runs one finaliser,
  including cargo exiting non-zero and cargo failing to spawn — the old `process.exit(status ?? 1)`
  returned with no cleanup at all and discarded `result.error`, losing the cargo ENOENT PATH
  diagnosis.
* **The exit invariant is precise, not "the tree is clean":** the fence clears only after proving no
  tracked file under `src-tauri` still contains a `~ changed by cargo-mutants ~` marker, so an
  unrelated concurrent edit is not reported as an unrestored mutation.
* **Recovery is ordered and path-specific.** Step one is always "confirm no `cargo mutants` process
  is running, and terminate it if one is" — correct even when no pid was recorded, which matters
  because `spawn` creates the child before its pid can be written and that window cannot be closed
  here. Safety therefore does not depend on the pid: the fence's existence is the fence. Step two
  restores **only** the marked files; a blanket `git checkout -- src-tauri` would destroy a
  concurrent editor's legitimate work along with the mutant. Step three removes the fence. It is
  never auto-cleared.
* **Rejected:** an `--allow-dirty` or env-var override, whose only use is the case the guard exists
  to prevent (`d-20260830-10`); a separate `check-mutation-guard.mjs`, which would give the fence
  invariant two implementations; and a CI step for the guard check, which would be vacuous because
  CI runs in a fresh checkout where a gitignored fence cannot exist — the same defect this repo hit
  when two `ui:boundary:check` rules were diff-scoped.
* **Verification.** 14 tests drive the real CLI as a subprocess against temporary git repositories
  with a cargo shim, because helper-level tests cannot prove the CLI calls the helpers. One asserts
  the push skill still names `mutation:guard:check`, so deleting that wiring turns a test red. Both
  claims were checked by hand rather than taken from the implementing leaf: removing the exit
  verification fails "exit verification keeps the fence for a marker but ignores an unrelated edit",
  and deleting the push-skill block fails "the push skill keeps the executable mutation guard
  preflight wired".
* `pnpm mutation:backend` was **not** run — it mutates the tree and no gate may run beside it.

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

* **ID:** f-20260829-14 · **Status:** handled · **Area:** gate-scripts · **Root:** - · **Entry:** inline · **Blocked:** none
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

* **Handled 2026-08-30**, commit `514cfb40`, by the `gate-scripts` build run.
* **Fix.** The `finally` block no longer re-raises a failing `tmp.unlink` when the write did not
  commit. It warns on stderr — as the committed branch already did — and lets the primary error
  propagate, so both diagnostics survive. A bare `contextlib.suppress` was rejected: it would trade
  one lost message for another, since an orphaned temporary file is worth knowing about too.
* **The shared-tool constraint was verified, not assumed.** Diffing this copy against
  `chess-tactics-app`'s committed `scripts/findings.py` yields **exactly one hunk**, and it is this
  one.
* **Anchor.** `scripts/findings-atomic-write-tests.py`, wired as `pnpm findings:test` in CI and in
  the push skill's ledger gate. `findings.py check` never exercises this path, so without it
  reverting the fix would have passed every committed command. Checked by hand: restoring the old
  `raise` fails `test_write_failure_survives_a_failing_cleanup` with "OSError('permission denied')
  is not OSError('no space left on device')". The test lives beside the shared tool, never inside
  it.
* **The port to the sibling copies is filed, not performed** — `d-20260830-11`. Both
  `chess-tactics-app` and `correction-app` carry the identical defective block, read directly. They
  were measured three times during this run and moved every time: `chess-tactics-app` went 11 to 12
  commits ahead of `origin/develop`, `correction-app` went 5 dirty files to 0 to 3 and 2 to 3
  commits ahead. Both are live checkouts with another session working in them; committing into a
  tree moving under me, whose unpushed stack this run has not reviewed and may not push, is worse
  than a declared pendency. The shared-tool contract permits "a fix this copy carries first while
  the port is pending" and requires only that the pendency be declared.

---

## 2026-08-29 — filed through the inbox spool

### The coverage ratchet penalises deleting covered code

* **ID:** f-20260829-15 · **Status:** handled · **Area:** gate-scripts · **Root:** - · **Entry:** build · **Blocked:** none
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

* **Handled 2026-08-30**, commit `d388767b`, by the `gate-scripts` build run.
* **The finding named one of the two guilty clauses.** The ratio clause penalises deletion just as
  hard: for any ratio below 1, deleting a covered record moves `c/t` to `(c-1)/(t-1)`, which is
  strictly smaller. The observed incident fails both — `180·5677 = 1021860 < 1027356 = 181·5676` —
  so repairing only `actual.covered < prior.covered` would not have made that gate green.
* **What landed.** Both comparisons now run against a baseline shrunk by however many records the
  measurement lost: `totalShrink = max(0, prior.total - actual.total)`, and the baseline is adjusted
  down by that amount in both numerator and denominator. When the total does not shrink the rule is
  arithmetically identical to the previous one, so adding untested code and losing cover on code
  that still exists fail exactly as before. The observed case passes with zero slack; 179/5676 still
  fails. No tolerance constant, and the integer cross-multiplication form is unchanged.
* **The names say `shrink`, not `deleted`, deliberately.** Four aggregate numbers cannot tell
  "one covered record was deleted" apart from "one uncovered record was deleted and another lost
  its tests", and `CLAUDE.md` records that ~170 BRDA identities flip per build with no source
  change. So the allowance is bounded by the observed shrink, and every use that actually changes a
  verdict is printed by `main` — a shrink that would have passed anyway reports nothing, because
  claiming records were "forgiven" when none were at risk is a false statement in a gate log.
* **Rejected:** a ratio tolerance — an arbitrary constant that readmits exactly the small
  regressions `docs/coverage.md` says the ratchet exists to catch; scaling the expected covered
  count by the change in total — proportional, so it forgives cover lost on records that were not
  deleted; the finding's own "exempt a decrease whose covered/total deltas are equal" — it handles
  only the exactly-balanced case and wrongly fails a mixed deletion of 1 covered plus 2 uncovered
  records, the ordinary shape of deleting a dead block; and record-level baselines, ruled out by
  this repository's measured BRDA identity instability, which would make them permanently red.
  Recorded as `d-20260830-08`.
* **Consequence that outlives this fix:** `scopeSignature` is now the only guard against narrowing
  the measured set, since a narrowing looks exactly like a deletion to the numeric ratchets. Written
  into `docs/coverage.md` and `CLAUDE.md`, and it constrains how `f-20260829-04` must be built.
* **`d-20260829-03`, which refreshed a baseline as the local workaround for this defect, needs no
  further action** — the refreshed numbers remain correct; only the rule that forced the refresh
  changed.
* Verified: `coverage:report:test` 16/16 (including the rewritten test that previously pinned the
  old behaviour), `coverage:frontend:check`, `coverage:backend:check`, oxfmt, oxlint.

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

* **ID:** f-20260830-02 · **Status:** handled · **Area:** native-fs · **Root:** remove-tree-unhardened · **Entry:** build · **Blocked:** none
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

* **Handled 2026-08-30**, commits `69421a04` and `dfd1cf6f`. The guard now survives into the
  descent, which is the escalation path, and the part that cannot be closed is filed rather than
  glossed.
  * `remove_entry_at` threads `assert_entry_identity`'s expectation into the walk instead of
    letting it re-`statat` from scratch.
  * Each child's `RawDirEntry::ino()` is passed into its recursive call and compared against the
    `statat` that call already performed — no extra syscall; the recursion previously did that
    lookup and simply trusted it.
  * Every `openat(..., NOFOLLOW)` is followed by `fstat` on the descriptor actually held,
    compared with `same_inode` against what was expected. The descriptor is pinned to the object
    it opened, so the listing, the recursion and every child open below it are bound to a verified
    inode.
* **Not closable, and filed as its own finding:** Linux has no `funlinkat`, so the terminal
  `unlinkat` resolves a name. Verified against the vendored rustix 1.1.4 — no such call exists.
  The residual is confined by the kernel's own refusals (a substituted directory fails `EISDIR`, a
  substituted file `ENOTDIR`, a non-empty directory `ENOTEMPTY`), so the only substitutions that
  succeed are an empty directory, which destroys nothing, and a regular file placed by someone who
  can already write into the tree being deleted.
* **Two tests, and the second exists because the first was not enough.** A review lens found at 96
  confidence that swapping the entry at `BeforeChildOpen` proves only the post-`openat` `fstat` —
  restricting the expected-inode check to depth zero would have left it green. `BeforeChildStat`
  and `recursive_delete_rejects_child_substitution_before_stat` close that. Both were confirmed by
  performing the revert: deleting the expected-inode comparison turns two tests red.
* **Rejected: `openat2` with `RESOLVE_NO_SYMLINKS`/`RESOLVE_BENEATH`.** It resolves a name, so a
  directory substituted for another directory inside the subtree is opened normally; it would have
  needed the `fstat` comparison beside it regardless, and it returns `ENOSYS` below Linux 5.6 with
  no fallback in rustix. `d-20260830-01`.

---

## 2026-08-30 — filed through the inbox spool

### Recursive delete puts 8 KiB on the stack per directory level, with no depth bound

* **ID:** f-20260830-03 · **Status:** handled · **Area:** native-fs · **Root:** remove-tree-unhardened · **Entry:** build · **Blocked:** none
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

* **Handled 2026-08-30**, commits `69421a04` and `dfd1cf6f`. The walk refuses at
  `MAX_REMOVE_TREE_DEPTH = 64` with `Error::ResourceLimit`, the variant this codebase already uses
  for a bounded input in 57 places; the wording follows `read_bounded_engine_line`.
* **The bare `8192` was half the safety argument, so it is now named.**
  `REMOVE_TREE_DIR_BUFFER_BYTES` sits beside the depth constant with a comment stating that the
  worst-case stack is their product — 512 KiB against a Tokio worker's 2 MiB.
* **Off-by-one, caught by a review lens at 97 confidence and fixed:** the first cut refused at
  `depth > MAX_REMOVE_TREE_DEPTH`, which admits depths 0 through 64 and therefore 65 buffers, about
  520 KiB. It refuses at `>=`, so exactly 64 buffers exist and the comment is true rather than
  approximately true.
* **Test:** `MAX_REMOVE_TREE_DEPTH + 1` real nested directories, no seam involved. Confirmed red
  against restoring `>`.
* **Rejected: converting the walk to an iterative explicit stack.** It removes the class instead of
  capping it, which is the stronger property — but it trades the thread stack for `RLIMIT_NOFILE`
  and still needs one `RawDir` buffer per open level, so the bound is required either way.
  `d-20260830-02`.

---

## 2026-08-30 — filed through the inbox spool

### A failed recursive delete reports failure after having already deleted part of the tree

* **ID:** f-20260830-04 · **Status:** handled · **Area:** native-fs · **Root:** remove-tree-unhardened · **Entry:** build · **Blocked:** none
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

* **Handled 2026-08-30**, commits `69421a04`, `7bb28c6a` and `dfd1cf6f`. The error now says what
  happened *and* reaches the person it happened to — the second half turned out to be the whole
  difficulty.
* **Backend:** `Error::PartialRemoval { removed_entries: usize, cause: Box<Error> }`. The walk
  counts successful unlinks; a mid-walk failure with a non-zero count is wrapped, and a failure
  that removed nothing stays the error it was. `cause` is boxed rather than stringified so a
  backend caller can still distinguish a depth refusal from a substitution from a symlink
  (`d-20260830-06`). Adding a variant changed no bindings: `Error` has a hand-written
  `specta::Type` exporting it as `DataType::Primitive(String)` — measured, not assumed.
* **A second, worse case found while fixing this one.** `remove_entry_at`'s final
  `parent.sync_all()` runs *after* the entry is gone, and propagated as a plain `Io`, so a
  **completed** deletion also read as "nothing happened". It maps to
  `CommittedDurabilityUncertain`, and `permanently_delete_workspace_entry` now drops the authority
  record before returning it — previously the `?` returned first and left a record for an entry
  that no longer existed. A `PartialRemoval` keeps the record, because the top directory still
  exists with an unchanged inode. `d-20260830-04`.
* **The backend half alone closed nothing**, which two review lenses said at 98 and 94 confidence
  and which was correct. Every `Error` crosses IPC as a plain string; `ConfirmModal` runs it
  through `normalizeError`, both new cases fell through to `unexpected`, and the user was shown
  "The action could not be completed. Please try again." — a false statement at the one moment
  files were destroyed. `normalizeError` gained an `applied-despite-error` category matching the
  two static literals, and `FilesPage` relists on it. `d-20260830-05`.
* **The category is `applied-despite-error`, not `partially-applied`** — renamed after a lens
  pointed out at 98 confidence that it also covers `CommittedDurabilityUncertain`, where the
  deletion completed in full. What it means is "the destructive change reached the filesystem even
  though this is an error", which is exactly what decides whether the view must be refreshed.
* **It is tested first, ahead of every other branch**, because it is the only category keyed on a
  literal this codebase owns while the others match generic English words a wrapped cause can
  contain. A partial removal whose cause reads "connection aborted" would otherwise be reported as
  `cancelled`. The test table is worded so every case would be claimed by a different branch if the
  order were wrong.
* **A relist failure never becomes the reported outcome.** The first cut swallowed it only on the
  partial path; a lens found at 99 confidence that a failing `mutate()` on the *success* path still
  surfaced as "could not be completed" for a delete that had happened. Both paths go through one
  helper now, pinned by a test that goes red when the `.catch` is removed.
* **Both backend branches are tested**, which took removing two obstacles the first attempt
  reported as blockers rather than working around: the `#[cfg(test)]` removal seam in `infra::fs`
  is widened to `pub(crate)` under `cfg(test)` only, and the command body was extracted into
  `permanently_delete_entry(&AppState, ..)` because `tauri::State` cannot be built in a unit test.
  The tests assert the record's fate positively in both directions and were confirmed red against a
  one-line revert.
* **Filed rather than done here:** the untyped IPC error channel that forces the substring contract
  at all; the English-only `Common.ConfirmationError.*` copy, which `i18next-cli extract --ci`
  strips from all 16 catalogues because the key is built dynamically; and the absence of any e2e
  coverage for this flow.

---

## 2026-08-30 — filed through the inbox spool

### Recursive delete crosses mount boundaries

* **ID:** f-20260830-05 · **Status:** handled · **Area:** native-fs · **Root:** remove-tree-unhardened · **Entry:** build · **Blocked:** none
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

* **Handled 2026-08-30**, commits `69421a04` and `dfd1cf6f`. Crossing is refused with
  `Error::InvalidInput`, worded like the two refusals already in that arm.
* **Two checks, because one of them was wrong.** The first cut compared `st_dev` against the
  parent's. A review lens refuted it at 99 confidence: **a bind mount whose source is on the same
  filesystem keeps the device number**, so `st_dev` alone accepts precisely the case this finding
  names. The primary check is now `statx` with `StatxAttributes::MOUNT_ROOT`, guarded by
  `stx_attributes_mask` exactly as rustix's own documented recipe does
  (`rustix-1.1.4/src/fs/statx.rs:183-200`); `st_dev` stays as the backstop, since it is the only
  check available when the attribute is not.
* **Below Linux 5.8 only the backstop applies**, so a same-filesystem bind mount is invisible
  there. That is stated in a code comment and **filed as its own finding**, not called graceful
  degradation. Holding it was a judgement, not a saving: the alternative is refusing to delete at
  all when the kernel cannot prove the absence of a mount, which breaks a working feature for
  pre-2020 kernels against a configuration that needs `CAP_SYS_ADMIN` to create. Parsing
  `/proc/self/mountinfo` was considered and rejected. `d-20260830-03`.
* **What the test proves, and what it does not.** No test anywhere under `src-tauri/` can create a
  mount unprivileged — verified. The first cut had the seam force the detector's *answer*, which
  two lenses correctly called worthless at 100 and 99 confidence: replacing the whole detector with
  `false` left it green. The seam now overrides the detector's *input*, the parent device, so the
  production comparison executes; confirmed red against reverting
  `opened.st_dev != compared_parent_dev` to `false`. The `statx`/`MOUNT_ROOT` branch itself remains
  unexercised, and that is a limitation rather than something this cluster papered over.

---

## 2026-08-30 — filed through the inbox spool

### The crate cannot compile for the configured macOS *or* Windows release targets

* **ID:** f-20260830-06 · **Status:** open · **Area:** native-fs · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** two independent breaks.
  * **macOS:** `src-tauri/src/infra/fs.rs:53` (`#[cfg(unix)] mod unix`), using `rustix::fs::RawDir`
    at `fs.rs:347` (`sync_tree`) and `fs.rs:408` (`remove_tree_at`).
  * **Windows:** `src-tauri/src/file_workspace.rs:663` (`permanently_delete_workspace_entry`) and
    its siblings are ungated `#[tauri::command]`s that call `mutation_target`
    (`file_workspace.rs:135`), which is `#[cfg(unix)]` with no `not(unix)` counterpart. `mod
    file_workspace;` at `main.rs:12` is unconditional and the commands are registered
    unconditionally at `main.rs:1143`.
* **Defect (macOS):** rustix exports `RawDir` only under `#[cfg(linux_kernel)]`
  (`~/.cargo/registry/src/*/rustix-1.1.4/src/fs/mod.rs:48`, and `build.rs:166` sets that cfg for
  Linux and Android only). The module that uses it is gated on plain `#[cfg(unix)]`, which includes
  macOS. `release.yml:16-24` builds `aarch64-apple-darwin` and `x86_64-apple-darwin` as release
  targets, so two configured targets reference an item that does not exist for them.
* **Defect (Windows):** the unix-only helpers have no non-unix counterpart, so the ungated commands
  that call them do not resolve. `release.yml` builds `windows-latest` as a third target.
* **Why nothing has caught it:** `test.yml:13` runs `ubuntu-latest` only, so no per-commit gate ever
  compiles for macOS. `release.yml` runs only on a `v*` tag or manual dispatch. `RawDir` entered in
  the 2026-08-09 audit commit `97c29add`, which is after the last tag `v0.15.0` (2026-03-17) — so
  the breakage has never been through a release and nobody has hit it. **Three of the four
  configured release targets are therefore unbuildable and nothing says so**, which is the finding's
  real weight: the missing gate, not any one `cfg` attribute.
* **Why it is `build` and not `inline`:** the fix is a real design question, not a mechanical one.
  Either the module gets a second directory-reading implementation for non-Linux unix
  (`fdopendir`/`readdir`, which has different error and reentrancy properties), or the affected
  functions are narrowed to `#[cfg(target_os = "linux")]` and their callers get a non-Linux path, or
  macOS is dropped from `release.yml` as a deliberate decision. That last one is a product call and
  is not an agent's to make.
* **Verification is the hard part, and it is why this was not folded into the
  `remove-tree-unhardened` cluster:** there is no macOS host and no macOS SDK on `tuxedo-atlas`, so
  any port would be unproven code sitting behind a green Linux-only gate — which is the exact
  failure mode this repository's gate discipline exists to prevent. Whoever takes this needs either
  a macOS runner added to `test.yml` or a `cargo check --target *-apple-darwin` route that actually
  resolves the SDK. **Adding the compile check to CI is arguably the whole finding**; the code fix
  is downstream of being able to see it fail.
* **Found by:** the `review-plan` and `review-root-cause` lenses (100 and 99 confidence) during the
  plan review of the `remove-tree-unhardened` cluster, 2026-08-30, and confirmed directly against
  the vendored rustix source and both workflow files.

### Deleting a workspace directory leaves an authority record for every descendant behind

* **ID:** f-20260830-07 · **Status:** open · **Area:** native-fs · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/infra/path_authority.rs:3361` (`remove_workspace_entry`), reached from
  `src-tauri/src/file_workspace.rs:663` (`permanently_delete_workspace_entry`); records are created
  for every descendant by `tree_entry` at `src-tauri/src/file_workspace.rs:218-245`.
* **Defect:** `list_file_workspace` walks the tree and calls `register_entry` for **every**
  directory and file it finds, so each descendant holds a persistent authority record.
  `remove_workspace_entry` removes exactly one record — the handle it was given — and returns.
  Deleting a directory with a hundred files under it therefore destroys a hundred files and leaves a
  hundred records naming paths that no longer exist. Nothing prunes them: `refresh_persistent`
  (`path_authority.rs:3431`) only re-validates recorded paths and marks them unavailable, and there
  is no watcher.
* **This is not confined to the failure path.** It happens on the ordinary, fully successful delete.
  It was found while working `f-20260830-04` (partial deletion), but a partial delete only makes the
  same accumulation harder to reason about; it is not its cause.
* **Contradicts a standing rule:** `.claude/rules/async-resource-invariants.md` — "Bound anything
  that accumulates — logs, caches, registries — and say what the bound is." The persistent registry
  is a registry, it accumulates across every create-and-delete cycle, and it has no bound and no
  reclamation.
* **Severity is availability and size, not escalation.** A stale record fails closed:
  `workspace_mutation_target` (`path_authority.rs:3325`) re-verifies `(dev, ino)` through
  `open_verified_parent` and refuses on a mismatch, so a stale record cannot be used to reach a
  different file. The cost is an unbounded registry that is persisted through `commit_candidate` on
  every mutation, so it grows the saved state and the work of every save.
* **Why it is `build`:** pruning by path prefix looks obvious and is not. `commit_candidate`'s
  persistence protocol, the pending-artifact intents at `path_authority.rs:3010-3096`, and the
  trash/restore lifecycle all read `self.persistent`, and a prefix sweep has to be right about
  which of those a removed subtree may still be referenced by. That is a contract question about
  the authority model, in a 3600-line file, and it deserves its own plan.
* **Found by:** the `review-root-cause` lens (96 confidence) during the plan review of the
  `remove-tree-unhardened` cluster, 2026-08-30. Confirmed directly by reading `tree_entry` and
  `remove_workspace_entry`.

### Every backend error reaches the renderer as one opaque string, so the UI classifies it by substring

* **ID:** f-20260830-08 · **Status:** open · **Area:** bindings-ipc · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/error.rs:216-231` (the hand-written `serde::Serialize` and `specta::Type`
  impls) and `src/platform/errors.ts:37-54` (`normalizeError`).
* **Defect:** `Error` implements `Type` as `DataType::Primitive(PrimitiveType::String)` and
  `Serialize` as `serializer.serialize_str(self.to_string())`. Every one of the enum's ~40 variants
  — including the ones carrying structured data, `OperationAndCleanup { primary, cleanup }` and
  `PartialRemoval { removed_entries, cause }` — is flattened to prose before it crosses the IPC
  boundary. `src/bindings/generated.ts` consequently types every command as
  `Promise<Result<T, string>>` and contains no `Error` type at all.
  The renderer then has to reconstruct the category it was never sent:
  `normalizeError` lowercases the message and tests it for the substrings `cancel`, `abort`,
  `network`, `timeout`, `fetch`, `not found`, `missing`, `permission`, `denied`, `invalid`,
  `validation`, defaulting to `unexpected`.
* **Why it matters:** the coupling is invisible and untyped in both directions. Rewording a Rust
  `#[error("...")]` string — an act that looks purely cosmetic and passes every gate, including
  `pnpm bindings:check`, which cannot see it — silently reclassifies an error in the UI. In the
  other direction a variant carrying real data cannot deliver it: a partial destructive delete has
  to be recognised by its prose or not at all.
* **Contradicts a standing rule:** `.claude/rules/ipc-events.md` and
  `.claude/rules/async-resource-invariants.md` both require typed errors returned from commands and
  mapped at the facade. This is the one contract in the IPC surface that is deliberately untyped,
  and it is the error contract.
* **Partially mitigated, deliberately, by the `remove-tree-unhardened` work (2026-08-30):** that
  cluster adds a `partially-applied` category to `normalizeError`, keyed on the stable message
  prefix of `Error::PartialRemoval`, with a test on each side of the boundary pinning the exact
  string so a reword goes red instead of silent. That follows the file's existing idiom because
  replacing the idiom is this finding, not that one.
* **Why it is `build`:** giving `Error` a real Specta type changes the error type of every
  `#[tauri::command]` in the app and every renderer call site, regenerates
  `src/bindings/generated.ts` wholesale, and needs a decision about how much backend detail may
  cross into the renderer at all — `.claude/rules/ipc-events.md` explicitly forbids moving a raw
  backend diagnostic into the renderer, so a structured error has to be designed, not merely
  derived. Also worth deciding: whether the substring table survives as a fallback for variants
  that stay prose.
* **Found by:** the `review-ipc-contract` and `review-error-handling` lenses (94 and 98 confidence)
  during the plan review of the `remove-tree-unhardened` cluster, 2026-08-30.

### Every removal in `infra/fs.rs` unlinks by name, and Linux offers no way to unlink by descriptor

* **ID:** f-20260830-09 · **Status:** open · **Area:** native-fs · **Root:** remove-tree-unhardened · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/infra/fs.rs` — every `unlinkat` call site: the two arms of
  `remove_tree_at` (`fs.rs:394`, `fs.rs:416`), `remove_entry_at` (`fs.rs:840`),
  `remove_optional_regular_at` (`fs.rs:859`) and `remove_regular_at`.
* **Defect:** the module verifies an object's `(st_dev, st_ino)` and then unlinks a *name*, and
  `unlinkat` re-resolves that name. A writer who can create entries in the containing directory can
  substitute a same-type object in the window between the last `statat` and the `unlinkat`, so the
  authorized inode survives and a different one is destroyed.
* **This is the irreducible remainder of `f-20260830-02`, not a restatement of it.** That finding is
  handled: the descent is now bound to descriptors, `RawDirEntry::ino()` is compared against the
  `statat` each recursion level already performs, and the top-level expectation is threaded in from
  the authority. Those close every window that *can* be closed at this layer. This one cannot be:
  **Linux has no `funlinkat`** (FreeBSD has it; rustix 1.1.4 exposes no such call — verified by
  grep over the vendored source), so there is no syscall that removes the object a descriptor
  refers to. `openat2`, `statx` and `fstat` all resolve or describe; none of them unlink.
* **Bounded, which is why it is filed rather than treated as a red gate.** The kernel refuses the
  dangerous shapes on its own: `unlinkat(name, 0)` against a substituted directory fails `EISDIR`;
  `unlinkat(name, REMOVEDIR)` against a substituted file fails `ENOTDIR` and against a non-empty
  directory fails `ENOTEMPTY`. The only substitutions that succeed are an *empty* directory, which
  destroys no data, and a regular file placed by someone who can already write into the directory
  being deleted. Nothing outside the named subtree is reachable.
* **What a fix would have to look like:** hold the parent directory under an exclusive lease for the
  duration (no such primitive for this), or move the whole subtree to a private staging name before
  walking it so the attacker no longer has a path to race on — `renameat` has the same
  name-resolution property, but it is a *single* window per delete instead of one per entry, and it
  is `RENAME_NOREPLACE`-able. That is a real design option and the reason this is `Entry: build`
  rather than a permanent "won't fix".
* **Found by:** the `review-plan` and `review-root-cause` lenses (100 and 99 confidence) in round 2
  of the plan review for the `remove-tree-unhardened` cluster, 2026-08-30, arguing that
  `f-20260830-02` was not closed. They were right that the window exists; the part of it that no
  plan can close is recorded here instead of being argued away in a plan that closes.

### Below Linux 5.8 the recursive delete cannot see a same-filesystem bind mount

* **ID:** f-20260830-10 · **Status:** open · **Area:** native-fs · **Root:** remove-tree-unhardened · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/infra/fs.rs`, the mount check in `remove_tree_at` added while handling
  `f-20260830-05`.
* **Defect:** the walk refuses to cross a mount using two checks — `statx` with
  `StatxAttributes::MOUNT_ROOT` as the primary, and an `st_dev` comparison against the parent as
  the backstop. `MOUNT_ROOT` requires Linux 5.8 and is reported as available through
  `stx_attributes_mask`; below that the code has only `st_dev`, and **a bind mount whose source is
  on the same filesystem keeps the same device number**. On such a kernel the walk therefore enters
  a bind-mounted directory and deletes its contents before the mount point's own
  `unlinkat(REMOVEDIR)` fails `EBUSY`.
* **Why this was accepted rather than closed, and it is not an effort argument.** The only
  mechanism that closes it on every kernel is refusing to descend whenever the kernel cannot prove
  the absence of a mount — which stops permanent deletion from working at all below 5.8 (August
  2020), to defend against a configuration that requires `CAP_SYS_ADMIN` or a user namespace to
  create. Breaking a working feature for a user who deliberately mounted something into their own
  workspace is the worse of the two failures. Parsing `/proc/self/mountinfo` was also considered:
  it is complete on any kernel, but it adds a parser plus a `/proc` dependency and carries its own
  read-then-mount race.
* **What would settle it:** a decision on the minimum supported kernel. If En Croissant declares
  Linux 5.8 as its floor — every currently maintained desktop distribution is well past it; RHEL 8
  at 4.18 is the notable exception — then `MOUNT_ROOT` becomes unconditional, the `st_dev`
  backstop and this finding both disappear, and the refusal is total. That is a product decision
  about supported platforms, which is why this is `Entry: build` and not `inline`.
* **Related:** the sibling finding about the three unbuildable release targets. Both are really the
  same question — which platforms this application claims to support — approached from opposite
  ends, and answering it once would resolve part of each.
* **Found by:** the `review-plan`, `review-root-cause` and `review-error-handling` lenses (100, 100
  and 99 confidence) in round 2 of the plan review for the `remove-tree-unhardened` cluster,
  2026-08-30.

### Every confirmation-error message is English in all 16 locales, because its key is built dynamically

* **ID:** f-20260830-11 · **Status:** open · **Area:** i18n · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src/components/common/ConfirmModal.tsx:7-18` (`confirmationErrorMessage`), which calls
  `t(\`Common.ConfirmationError.${category}\`, { defaultValue: ... })` with the category computed at
  runtime by `normalizeError` (`src/platform/errors.ts:37`).
* **Defect:** the key is a template literal, so `i18next-cli extract` cannot see it. Any
  `Common.ConfirmationError.*` entry written into the catalogues by hand is deleted again the next
  time `pnpm lint:ci` runs — its pipeline ends in `i18next-cli extract --ci`, which fails the build
  precisely *because* it rewrote the files. `src/translation/en-US.json` accordingly contains **no**
  `ConfirmationError` key at all, for any of the six categories. Every one of those messages
  therefore reaches a German, Korean or Ukrainian user in English, from the `defaultValue`.
* **How it was found, which is the part worth keeping:** the `remove-tree-unhardened` cluster added
  a seventh category (`partially-applied`) and wrote real translations into all 16 catalogues. The
  extractor removed all 16 in the same `lint:ci` run, and `pnpm i18n:check` still passed —
  consistently absent is complete. The gate cannot see this class of defect at all: it compares
  every locale against `en-US`, so a key missing from *all* of them is invisible.
* **Why it is `build`:** the fix is a choice, not a repair. Either the six (now seven) categories
  get a static lookup table so the extractor sees literal keys — cheap and mechanical, but it moves
  the copy away from the point of use — or `i18next-cli` is configured to preserve this key prefix,
  which needs the config to be right about which prefixes are dynamic and stays fragile. Either way
  the copy for all seven categories has to be written in 16 languages, which is the actual work.
  There is also a prior question worth settling once: how many other dynamically built keys exist
  in this codebase and are silently untranslated for the same reason.
* **Scope note:** this is not specific to the new category. It is the pre-existing state for
  `cancelled`, `network`, `not-found`, `permission`, `validation` and `unexpected`.
* **Found by:** the `remove-tree-unhardened` `build` run, 2026-08-30, when `lint:ci` failed with
  "Some files were updated. This should not happen in CI mode." after the catalogues were edited.

### A cancelled or failed workspace folder picker produces an unhandled rejection and no user feedback

* **ID:** f-20260830-12 · **Status:** open · **Area:** frontend-ui · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src/components/files/FilesPage.tsx:48-52` (`chooseWorkspace`), wired to a `Button`'s
  `onClick` further down the same component.
* **Defect:** `await tauri.issueFileWorkspace()` is not guarded. React's `onClick` does not consume
  the returned promise, so any rejection — the user dismissing the native folder dialog, a denied
  path, an authority error — becomes an unhandled promise rejection. The user sees nothing at all:
  no error, no indication the dialog was cancelled, and the workspace silently stays as it was.
  `setWorkspace` and `setWorkspaceDisplayName` simply never run.
* **Why it is not fixed alongside the `remove-tree-unhardened` cluster that found it:** it raises a
  design question that cluster has no standing to answer — *where does a workspace-selection
  failure surface?* Swallowing it is right for a cancelled dialog and wrong for a real error, and
  this component has no error channel for the picker: the `error` it renders comes from the SWR
  listing hook, which describes a different operation. Answering that means deciding whether the
  platform facade should distinguish user-cancellation from failure (`src/platform/errors.ts`
  already has a `cancelled` category, so the pieces exist), and whether the page grows a
  notification surface or reuses one. That is a plan, not a patch.
* **Related:** the same page's delete flow was just given exactly this treatment — see
  `f-20260830-04` and `d-20260830-05`, where a destructive failure was made visible rather than
  swallowed. The picker is the same question with a different answer for the cancel case, and
  whoever takes this should read that decision first rather than re-deriving it.
* **Found by:** the `review-error-handling` lens (95 confidence) over the cumulative diff of the
  `remove-tree-unhardened` cluster, 2026-08-30. Pre-existing; not introduced by that diff.

### The permanent-delete confirmation flow has no e2e coverage, only jsdom with the modal mocked

* **ID:** f-20260830-13 · **Status:** open · **Area:** e2e-gate · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src/components/files/FilesPage.test.tsx` (`trash confirmations`) is the only coverage;
  nothing under `e2e/` reaches the Files purge flow.
* **Defect:** the tests that prove a destructive delete warns the user run in jsdom with the Tauri
  command mocked and Mantine's modal primitives stubbed. What they verify is that the component
  computes the right category and calls the right things. They cannot see the warning being
  invisible at the real modal boundary — wrong z-index, the dialog closing before the message
  renders, the `role="alert"` node never reaching the accessibility tree, the copy overflowing its
  container at 320px.
* **Why it matters more here than for an ordinary surface:** this is the message shown when files
  were destroyed and the operation still failed. If it does not actually reach the screen, the
  fallback the user gets is the generic "The action could not be completed. Please try again." —
  which is false, and the jsdom tests would stay green while it happened.
* **Why it is `build` and its own finding:** `e2e/` runs through `pnpm test:e2e:container` inside
  the pinned Playwright image with committed snapshots (`d-20260829-01`), so adding a spec means
  adding snapshots recorded in that image, and reaching this flow needs a workspace fixture and a
  trashed entry — neither exists in the current specs. That is e2e-harness work, not a test to
  append to an existing file.
* **Found by:** the `review-tests` lens (94 confidence) over the cumulative diff of the
  `remove-tree-unhardened` cluster, 2026-08-30.
