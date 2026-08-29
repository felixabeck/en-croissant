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

* **ID:** f-20260829-05 · **Status:** open · **Area:** gate-scripts · **Root:** - · **Entry:** inline · **Blocked:** none
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

---

## 2026-08-29 — filed through the inbox spool

### Frontend coverage measures differently on atlas than the baseline records

* **ID:** f-20260829-06 · **Status:** open · **Area:** gate-scripts · **Root:** machine-dependent-measurement · **Entry:** build · **Blocked:** none
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

---

## 2026-08-29 — filed through the inbox spool

### Three mutants survive in `gameSession.ts` — the game-session correlation guards are untested

* **ID:** f-20260829-08 · **Status:** open · **Area:** frontend-state · **Root:** - · **Entry:** lens · **Blocked:** none
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
