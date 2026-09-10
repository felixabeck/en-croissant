# Findings deferred to their own run

Written the moment a finding is found, per universal rule 4b — a deferred finding that lives only
in a session's context dies with the next compaction. `Defer` is not a soft `Skip`: each open entry
below will be fixed, just in a separate run. Handled entries stay as the record.

**This file is an append-only log, not a queue.** The queue is *derived* from it by
`scripts/findings.py`, which groups open findings by `Root` only; findings without a root are singletons. A new finding
is appended wherever the run that found it happens to be writing — its position in the file carries
no meaning, and nothing has to be filed "in the right place".

## Header contract

Every `###` entry carries exactly one header line, immediately after its heading:

```
* **ID:** f-YYYYMMDD-nn · **Status:** open · **Area:** e2e-gate · **Root:** some-shared-cause · **Entry:** build · **Blocked:** none
```

`./scripts/findings.py check` enforces it. This repository has no Python test suite to gate
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
  Adding an area is a deliberate edit to this list. Area is a filter and report dimension,
  never a work unit.
* **Root** — optional slug shared by findings with one evidenced underlying cause, `-` when
  none. Only Root groups work; rootless findings are singletons, ranked after roots by age.
  A new slug needs a sentence naming the code or observation that establishes the shared cause,
  as required by the universal contract; sharing an Area or file is not enough.
* **Entry** — initial execution tier chosen by the run that *files* it: `inline` (fix it, no
  interview) · `lens` (inline plus one named review lens, run on Codex) · `build` (a real design
  question — the interview is the point). Universal rule 6b's three tiers. **When uncertain, write
  `build`.** Revalidate against current evidence before plan review under the universal contract
  and `next-finding` skill. A cluster takes the highest current tier of its members, raised when
  the combined scope requires it.
* **Blocked** — `none`, or a slug naming what it waits on (`felix-decision`, `upstream-tauri`).
  A blocked finding is excluded from the queue; it is not "next".
  **`felix-decision` additionally requires a `**Decision:**` brief ending the entry, which
  must contain a `**Recommend:**`, a `**Session:**` and a `**Product impact:**` sub-bullet** —
  `check` fails the park without all four.
  **`Product impact` is the gate on whether the question is Felix's at all:** it names what a
  user of En Croissant sees, gets, pays or is promised differently depending on the answer. A
  technical question never parks, however consequential; if that sentence cannot be written
  honestly, decide it, record it in `tasks/decisions.md` and name it in the completion message.
  A *precondition* — waiting on a branch, an issue or a permission — is not a park either and
  takes a slug naming what must become true (`felix-*` when Felix must clear it). The
  ChessRiddle incident that produced the four-marker gate is recorded in the kit contract
  (`/home/felixb/Projekte/agent-kit/references/findings-ledger-contract.md`). `Recommend` is
  required but need not come last; `Ruled out` and `Could not determine` legitimately follow
  it. The brief is the question, each option with its cost, what was ruled out and why, the
  recommendation and the strongest case against it, and the parking session's `**Session:**`
  id so its transcript can be mined.
  Felix answers through `/decide`, which publishes to `tasks/findings-answers/` and is applied
  by `findings.py apply-answers` — the drain runs it between clusters, so an answer given
  mid-run rejoins that run. `./scripts/findings.py decisions` lists what is waiting.
* **Tooling areas** — the subset of the area vocabulary that is not product work. Membership
  means `./scripts/findings.py list --json` reports `tooling: true` for findings in
  those areas, and the drain's closed-by-tooling summary counts them. The set must stay
  non-product; adding one is a deliberate edit to the labelled token list below.

**Area vocabulary:** `app-startup` · `bindings-ipc` · `chess-tree` · `ci-workflows` ·
`db-search` · `deps` · `docs-agent-config` · `e2e-gate` · `engine-uci` · `frontend-state` ·
`frontend-ui` · `gate-scripts` · `i18n` · `native-fs` · `oauth-credentials` · `pgn-import`

**Tooling areas:** `ci-workflows` · `deps` · `docs-agent-config` · `gate-scripts`

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

* **ID:** f-20260829-02 · **Status:** open · **Area:** frontend-ui · **Root:** - · **Entry:** build · **Blocked:** felix-snapshot-deny-lifted
* **Where:** `e2e/async-errors.spec.ts-snapshots/*`, `e2e/settings-responsive.spec.ts-snapshots/*`,
  `e2e/security-consent.spec.ts-snapshots/*`, and the components they render. Those are the four
  committed snapshots from the three 320px / 200% Playwright projects.
* **Defect:** headings and account text are clipped at 320px with a 200% app font scale. The
  committed screenshots record the clipped state. `assertNoHorizontalOverflow` stays green because
  it compares `Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)` to the
  viewport (`e2e/fixtures.ts:221-223`), which does not see content clipped by an ancestor or
  overflowing to the left — so the suite is green on a defect it was meant to catch. The 2026-08-31
  investigation below names the mechanisms.
* **Carried from:** `FRONTEND_AUDIT_PLAN.md`, "Final exact-tree verification (2026-08-13)", where
  it is explicitly listed as *not* evidence of a correct layout. Filed here so it lives in the
  queue rather than only in a plan document.
* **Note:** re-recording these snapshots in the container (2026-08-29 decision) does not fix this
  and is not evidence that it is fixed.

* **Investigated 2026-08-31 by the `frontend-ui` build run (slice: this finding alone). The defect
  is confirmed, its root causes are measured rather than inferred, and the fix is specified below —
  but the run could not land it, for the authority reason in the `Decision:` bullet at the end.**
* **Measurement method, so the next session does not repeat it:** a throwaway Playwright project at
  320x720 with `localStorage["font-size"] = 200`, running against the real built renderer, walking
  every element and classifying it as `LOST-at-viewport`, `CLIPPED-by-ancestor`, or exempt when any
  ancestor between the element and the clip provides `overflow-x: auto|scroll`. Run natively, which
  is legitimate here because only geometry was read and no screenshot was compared (`d-20260829-01`
  establishes that native and container layout agree to the pixel and differ only in glyph
  rasterisation). The harness was deleted afterwards; the tree is clean.
* **Measured, at root font 32px and viewport 320px:** `/settings` has **83** irrecoverably clipped
  elements before any interaction and **27** after activating the Appearance tab; `/accounts` has
  **2**. `document.documentElement.scrollWidth` is **320** in all three states while real content
  sits at `x = 353`.
* **The instrument is blinder than a container-clipping story, and this is a sharpening of it, not
  a correction.** Two further mechanisms defeat `scrollWidth` independently: overflow to the
  *left* (`x = 63` on `/accounts`, under the sidebar) never contributes to `scrollWidth` at all, and
  an ancestor with `overflow: hidden` absorbs the rest before it can reach `documentElement`. So the
  assertion cannot be repaired by tightening its threshold — it measures the wrong quantity.
* **Root cause 1 — the app font scale scales the chrome and the spacing, not just the text.**
  `src/App.tsx:146` sets `document.documentElement.style.fontSize` to the `fontSize` atom as a
  percent (`200` in this matrix), so the root em becomes 32px and *every* rem length in the app
  doubles, including Mantine's spacing tokens. On a 320px viewport: the `3rem` navbar
  (`src/routes/__root.tsx:323`) takes 96px, leaving 224px; `Stack px="md"` (`SettingsPage.tsx:827`)
  takes 32px on each side; `Card p="lg"` (`:829`) takes 40px on each side.
  224 - 64 - 80 = **80px of usable content width**, which is what the 83 clipped elements are clipped
  into. The viewport is the one quantity that does not scale.
* **Root cause 2 — the responsive breakpoints cannot see the scale.** `SettingsPage.tsx:127` uses
  `useMediaQuery("(max-width: 50rem)")` and `SettingsPage.module.css:60` uses the same threshold.
  `rem` in a media query resolves against the *initial* font size, never the scaled root, so both
  mean 800px at every scale. They fire correctly at 320px — the compact branch really is active —
  but nothing in the codebase can express "the effective content width is now ten root-em", which is
  the condition that actually matters.
* **Root cause 3 — the custom title bar reserves 84% of its width for three buttons.**
  `src/components/TopBar.module.css:21-22` gives `.windowControls` `flex: 0 0 auto` while
  `.icon` at `:26` and `.close` at `:38` each size a control `2.8125rem` wide. At 200% that is
  3 x 90px = 270px of a 320px bar, so `.menuArea` (`flex: 0 1 auto`, `min-width: 0`, `:12-14`)
  collapses to 50px and clips File/View/Help with no scroll affordance. This is the stray "cht"
  fragment in the `async-errors` snapshot: German "Ansicht", clipped to its tail.
* **Root cause 4 — long unbreakable words overflow their box with no wrapping opt-in.** On
  `/accounts` the heading "No accounts connected" (`src/components/home/EmptyAccounts.tsx:9`
  `Center`, `:14` `Title`, copy at `src/translation/en-US.json:501`) measures 290px inside a 144px
  `Center` (`mantine-Center-root`, `scrollW=217 clientW=144`). The German "Datenbanken" on
  `/databases` is the same class of overflow (sidebar `SideBar.Databases` / the databases page
  title). These are the only two clipped elements on `/accounts`, so this cause is cheap to close
  on its own.
* **Fix specification, in dependency order.** (1) Add `assertNoClippedContent()` to `e2e/fixtures.ts`
  implementing exactly the classification above, and call it beside `assertNoHorizontalOverflow` in
  the three 320px specs; keep the old assertion, which is still a valid check for a different thing.
  (2) In the compact branch, stop spending scaled rem on horizontal padding — the navbar rail, the
  settings `Stack px` and the `Card p` are the three places that matter, and together they are the
  80px. (3) Give `.windowControls` a shrink allowance or move the menu into a scrollable strip.
  (4) Add `overflow-wrap: break-word` where the two headings are rendered, and `min-width: 0` on the
  `Center`/`Stack` chain that holds them.
* **What "correct" means here was settled by this run and is not an open question** — see
  `tasks/decisions.md`, the two entries recorded on 2026-08-31 for this finding: content must reflow
  or become scrollable, never be silently clipped; a scrollable container is an acceptable outcome
  and a clipped one is not. Do not re-derive that; it is derived from the repository's own existing
  compact branch and from the assertion the suite already carries.
* **Not absorbed, deliberately:** `src/routes/__root.tsx` is also named by `f-20260830-47` and
  `f-20260830-49`, and `src/components/TopBar.tsx` neighbours them. Root cause 1 touches line 323 of
  that file and root cause 3 touches the title bar, so whoever lands this and whoever lands those two
  should expect to meet.
* **Decision:** May a session re-record the four committed 320px/200% e2e snapshots inside the
  pinned Playwright container, once, as the closing step of a reviewed layout fix?
  * **(a) Yes — lift the snapshot-update deny for one run.** The layout fix lands complete: instrument,
    all four root causes, refreshed snapshots, green gates, one push. Costs: the four images change in
    the same commit as the code that changed them, so the diff that proves the fix is also the diff
    that rewrites its own evidence — exactly the shape the guard exists to make deliberate.
  * **(b) No — you run `pnpm test:e2e:update` yourself after the code lands.** Keeps the guard intact
    and puts a human eye on the four images. Costs: the code cannot be committed before the images
    exist, because `pnpm test:e2e:container` runs in CI and would be red between the two steps, so
    this is not "commit then refresh" — it is one interactive session where you run one command
    mid-run, and it recurs for every future visible change.
  * **Ruled out:** deleting the four snapshots and letting Playwright regenerate them as "new" — that
    is the denied action under another name, and it silently drops the only pixel record of three
    projects. Also ruled out: narrowing the e2e matrix so the 320px projects stop asserting pixels —
    `src-tauri/tauri.conf.json` declares no `minWidth`, so 320px is genuinely reachable and the
    matrix is right to cover it. Also ruled out: shipping the instrument alone without the layout fix
    — it goes red on today's tree by construction, so it cannot be committed either.
  * **Recommend:** (a), because the guard's own recorded reason is host rendering
    (`.claude/skills/verify-ui/SKILL.md`: "there is deliberately no script that re-records them on the
    host"), and the project `Skip` catalog in `.claude/skills/push/SKILL.md` forbids re-recording
    "natively" — neither reason reaches the container path, which that same file names as the
    sanctioned route. Against it: the deny in `.claude/settings.json` is deliberately broader than
    both of those texts, it is the only mechanical thing standing between an agent and a green-looking
    gate, and `f-20260829-04` is already parked on the same authority boundary for the coverage
    baselines — answering this one loosely would weaken that one too. If you prefer (b), say so and
    the fix will be prepared as a single interactive session rather than a drain cluster.
  * **Could not determine:** whether the four refreshed images would differ only where intended. That
    needs the fix to exist and the container to run, and this run could not reach either.
  * **Session:** 1ed74d8d-8302-41f3-9a68-c165accad91d — transcript
    `~/.claude/projects/*/1ed74d8d-8302-41f3-9a68-c165accad91d.jsonl`

* **Un-parked 2026-09-02:** technical under rule 22e — a `**Product impact:**` sentence cannot be written honestly. The parked question is who may refresh Playwright snapshot evidence after a layout fix, not what an En Croissant user sees (that contract is `d-20260831-16` / `d-20260831-17`). Decided as the brief's Recommend (a); recorded as `d-20260902-01`.

* **Reclassified 2026-09-02:** this is a precondition, not a park. `Blocked: felix-snapshot-deny-lifted` names what must become true (the `.claude/settings.json` deny of snapshot-refresh spellings must lift) before the last landing step can run; rule 22e.

---

## 2026-08-29 — filed through the inbox spool

### 3. `src/App.tsx` has no test coverage for its startup sequence

* **ID:** f-20260829-03 · **Status:** handled · **Area:** app-startup · **Root:** - · **Entry:** lens · **Blocked:** none
* **Where:** `src/App.tsx`.
* **Defect:** 0 of 75 lines covered. `useDocumentLanguage` was extracted to `src/hooks/` to unblock
  the frontend ratchet, but `useAppStartup`, `preloadReferenceDb`, the update check, the telemetry
  gate and the splashscreen `finally` are still untested inside the composition file, so the
  application's startup path has no regression cover at all.
* **Carried from:** `FRONTEND_AUDIT_PLAN.md`, which names this "the next piece of real work".
* **Related:** the `convert_progress` incident in `.claude/rules/ipc-events.md` was a listener
  removed from exactly this file, unnoticed because nothing tested it.

* **Entry revalidated 2026-09-10: `build` → `lens`.** The finding's premise ("0 of 75 lines
  covered", "no regression cover at all") no longer holds. `src/App.test.tsx` exists with four
  `useAppStartup` cases, and the measured state on this checkout is 34/64 lines, 6/9 functions and
  10/36 branches (`pnpm test:coverage`, `coverage/lcov.info`, 2026-09-10). What is left is a set of
  named uncovered paths inside one file plus its one test file — the `preloadReferenceDb` body and
  its abort/error branches, the two post-`attachConsole` abort returns, the telemetry-enabled
  branch, the CLI `occurrences > 0` branch, and the `App` component render itself. No design
  question remains: the test harness shape is already established in the file, and the proof is a
  deterministic oracle (`pnpm test`, then `pnpm test:coverage` plus
  `pnpm coverage:frontend:check`). One cohesive file set, no cross-area phases, so `lens`
  (`review-tests`) rather than `build`.
<!-- ledger-meta {"command":"annotate","effect_lines":11,"effect_sha256":"2c32684504a0b289bed93b82bb8aba36cb1bd1a4b81c0ec6c2fc563cc054d7f5","input_sha256":"079ebf5f490f948d70ff26de95987c05ce36116cbcf26bacb152cc311039c8ae","kind":"mutation-receipt","operation":"995b466260c0409ea63ea6048ffc9d4e7114a851a9b59f5efa25bfa96e1d8865","options":{"section":null},"request_id_sha256":null,"results":["f-20260829-03"],"target":"f-20260829-03","v":1} -->

* **Handled 2026-09-10.** `src/App.test.tsx` gained eleven cases covering the startup paths that had
  no cover: the telemetry-enabled branch (`analytics.enable` plus an `app_started` capture carrying
  the version), the CLI `occurrences > 0` branch, the `preloadReferenceDb` success, failure,
  cancelled-failure and skipped-before-start paths, the three cancellation returns (after
  `initializePathOwners`, after `attachConsole`, after the telemetry block), the outer
  `startupSequence().catch` warn path reached when `closeSplashscreen` rejects, a negative case
  proving both optional branches stay unentered when nothing is configured, and a render of the
  `App` component itself pinning the font-size effect and the theme inputs. The jotai and theme
  mocks are now parameterised per atom so the component can be rendered at all.
* **Measured:** `src/App.tsx` went from 34/64 lines, 6/9 functions, 10/36 branches to **64/64 lines,
  9/9 functions, 27/36 branches** (`pnpm test:coverage`, `coverage/lcov.info`). `pnpm test` is
  green at 1065 tests and `pnpm coverage:frontend:check` passes without touching a baseline.
* **Proven, not assumed.** Seven mutants of `src/App.tsx` were run by hand and each turned exactly
  one test red: an always-true telemetry guard; the removed post-telemetry abort check; the removed
  post-`attachConsole` abort handling; the removed abort check inside the preload `catch`; the
  removed font-size effect; the CLI guard widened to `>= 0`; and the `referenceDb &&` conjunct
  deleted. The last two exist because `review-tests` returned REVISE in round 1 on exactly those two
  branches being proven in one direction only; both were adopted and round 2 returned APPROVED.
* **Left uncovered, deliberately:** the `initialized.current` early return (`src/App.tsx:78`), which
  is reachable only when the same hook instance remounts — React StrictMode or fast refresh. The
  renderer does not mount under `StrictMode` (`src/index.tsx` renders `App` directly), so pinning
  that branch would pin dev-only behaviour, and the nine residual branch records in the JSX body are
  v8 range artefacts on lines that are fully executed.
<!-- ledger-meta {"command":"annotate","effect_lines":23,"effect_sha256":"5f886c4c4aa75c81cae492b60b7c109e31f525a55dd5c1a341970fea7ab9a790","input_sha256":"aa73064ca549afddf7c05f326ffa39ef8faef6360ae4963bbf81a31f1e649d2a","kind":"mutation-receipt","operation":"8cc38df89b8529b7f86f74b2d580b6d7a440ced7b83c29a661997f96856bfd14","options":{"section":null},"request_id_sha256":null,"results":["f-20260829-03"],"target":"f-20260829-03","v":1} -->

* **Correction 2026-09-10, from the `$push` review of this very change.** The "Proven, not assumed"
  list above is accurate but was not complete, and the gap it left was the one this finding names.
  The `review-root-cause` lens deleted `useConversionProgress();` from `src/App.tsx` — the exact
  edit shape of the `convert_progress` incident this entry cites — and all fifteen tests stayed
  green. Coverage cannot see that class at all: a deleted hook call leaves no uncovered line behind,
  and the mocked hook was a no-op nobody asserted on. `src/App.test.tsx` now tracks both
  `useConversionProgress` and `useDocumentLanguage` as mocks, and "keeps the renderer-side
  subscriptions wired" asserts each was called during an `App` render. Verified by hand: deleting
  either call turns exactly one test red.
* **Two further review findings were repaired in the same commit, and one of them is a real defect
  rather than test work.** The stale `app_started` emit past cancellation is filed on its own as
  `f-20260910-02`, so the incident class stays findable under its own mechanism. The second is a
  severity relabel: a failed reference-database preload logged through `info` and now logs through
  `warn`, so a genuine failure is no longer indistinguishable from startup chatter at a warn-level
  filter. A rejecting `getMatches()` also gained the test it never had.
* **Review record:** seven lens rounds on Claude Code — `review-tests` twice (REVISE, then
  APPROVED), then `review-correctness`, `review-root-cause`, `review-code-quality` and
  `review-error-handling`, with a scoped second round on the last three. Eight findings at
  confidence 80 or above were adopted; twelve repair mutants were run by hand and each killed
  exactly one test.
<!-- ledger-meta {"command":"annotate","effect_lines":20,"effect_sha256":"6d07dad9c4afb8d85d6ad1a9d91d4be3dd9ce3c91879992dadba5464af1e1dd5","input_sha256":"c64c3ff60f053cbada5e91c009fab0db85118738e8b669dc1a4ade19c24254c1","kind":"mutation-receipt","operation":"13bbbb8e7a23dd3d04f8838b611b2e88fd3a4b5da16fa47438d98ac93b61bdcd","options":{"section":null},"request_id_sha256":null,"results":["f-20260829-03"],"target":"f-20260829-03","v":1} -->

---

## 2026-08-29 — filed through the inbox spool

### 4. Backend coverage counts `#[cfg(test)]` modules against production ratios

* **ID:** f-20260829-04 · **Status:** open · **Area:** gate-scripts · **Root:** - · **Entry:** build · **Blocked:** felix-baseline-deny-lifted
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

* **Un-parked 2026-09-02:** technical under rule 22e — a `**Product impact:**` sentence cannot be written honestly. Coverage floors and `#[cfg(test)]` filtering are not what a user of En Croissant sees, gets, or is promised. Decided as the brief's Recommend (a); recorded as `d-20260902-02`.

* **Reclassified 2026-09-02:** this is a precondition, not a park. `Blocked: felix-baseline-deny-lifted` names what must become true (the `.claude/settings.json` deny of `coverage:baseline:*` must lift) before the last landing step can run; rule 22e.

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

* **ID:** f-20260829-10 · **Status:** handled · **Area:** chess-tree · **Root:** - · **Entry:** lens · **Blocked:** none
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

* **Entry revalidation (2026-09-10):** `build` → `lens`, with `review-chess-semantics`. The original uncertainty is resolved by reading polyglot-book-rs 0.1.0 `src/fen.rs` and `src/hash.rs`: the parser stores the supplied ep file and the hasher XORs it without checking pawn attacks or king safety. Shakmaty 0.27.1 `Position::pseudo_legal_ep_square` supplies exactly the pawn-attack condition. `try_polyglot_book_move` constructs a local FEN consumed only by `get_all_moves_from_fen`; repository search finds no other caller. State reporting and repetition use separate `Legal` expressions. No governing Polyglot decision was found in `tasks/decisions.md` or surfaced by `next`.
* **Bounded change and proof:** Change only the book-lookup FEN to `PseudoLegal`, retain legal-move filtering, and exercise the actual binary-book loader and `try_polyglot_book_move` against fixed independently checked keys for pinned, legal, and absent ep captures (both colours). `cargo test --manifest-path src-tauri/Cargo.toml --locked polyglot` must pass; reverting the production change must fail the pinned-pawn regression. Full Rust push gates follow review.
<!-- ledger-meta {"command":"annotate","effect_lines":2,"effect_sha256":"5932efa40ca55eb99d1a8db9e9aae40d673c58c4575861d8844b4cdab9b0bc0a","input_sha256":"e59c725cf9451341db44024e1accc014a8a18c00b79ae4603bc992ba3ceae529","kind":"mutation-receipt","operation":"b17b64bbc94f80057ff091a44759de1dedd06e010c19223a92d4f053767801c3","options":{"section":null},"request_id_sha256":null,"results":["f-20260829-10"],"target":"f-20260829-10","v":1} -->

* **Handled (2026-09-10):** `2ae6deca` changes only the private Polyglot lookup FEN to `PseudoLegal`; legal move filtering, published state/move FENs and repetition keys retain their prior semantics. Regression fixtures use fixed keys from Shakmaty 0.27.1's independent Zobrist64 implementation and exercise the real binary loader and selector for pinned attackers of both colours, legal en passant, no adjacent capturer, and an illegal-only book. `Legal` reproduced the missing move (exit 101); the fix and final fixture cleanup pass `cargo test --manifest-path src-tauri/Cargo.toml --locked polyglot` (1 test, all table cases), `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`, and `git diff --check`.
* **Review:** correctness, root-cause, tests, code-quality, minimalism and chess-semantics lenses approved. The code-quality finding about numeric tuple-field access was fixed with named bindings and the regression rerun. Five read-only reviewer contexts were used; chess-semantics followed correctness in that reviewer context after the native thread limit prevented another thread. The authoring context never acted as a lens. Plan authorship and arbitration shared one context; detection ran on the same model family as the code. No new findings were deferred.
* **Decision:** d-20260910-02 records the purpose-specific ep mode and rejects `Always` and a global FEN change. Final affected push gates and local installation follow this closure through the project's push skill.
<!-- ledger-meta {"command":"annotate","effect_lines":3,"effect_sha256":"bfeab43550a928a6972e3385471e9064c5101b8ac986e2e892f7a210ad5ba66e","input_sha256":"9b545120eba6abac1ca305b53a7e23da110f44ae5ae457ef22e6c347d8cebde3","kind":"mutation-receipt","operation":"990e27eb491ea3a2d963c832ca6040f5798b6cbc4699358d7fe60c1db9ce5294","options":{"section":null},"request_id_sha256":null,"results":["f-20260829-10"],"target":"f-20260829-10","v":1} -->

---

## 2026-08-29 — filed through the inbox spool

### `opening_book_ext` never returns `"zip"`, so the whole zip opening-book branch is dead

* **ID:** f-20260829-11 · **Status:** handled · **Area:** native-fs · **Root:** - · **Entry:** build · **Blocked:** none
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

Enabled. `.zip` was never deliberately disabled: upstream `455ba6be` ("add support for zipped
opening books") added both the arm and `opening_book_ext`, the latter for detecting the format of
the member *inside* the archive, and fork commit `97c29add` then reused that inner-only helper for
the outer dispatch and wrote `("book.zip", None)` to match. Decision recorded as `d-20260831-02`.

Commit `9d3dba98`. `opening_book_ext` returns `Some("zip")`, the assertion is corrected, and a new
test drives `apply_opening_book_descriptor` — the outer dispatch — with a real archive containing a
`.epd` member. That test is the point: the three existing zip tests call `read_zip_inner*` directly,
which is exactly why nothing went red when the outer dispatch broke. Reverting the one-line fix was
verified to make it fail with the unsupported-format error before the commit was made.

A zip nested inside a zip is unchanged: the inner dispatch matches only epd/pgn/bin and routes
everything else to its existing arm with "Zip must contain a .pgn, .epd, or .bin file".

---

## 2026-08-29 — filed through the inbox spool

### Backend coverage hardcodes the x86_64 Linux target triple

* **ID:** f-20260829-12 · **Status:** handled · **Area:** gate-scripts · **Root:** machine-dependent-measurement · **Entry:** inline · **Blocked:** none
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

* **Entry revalidation (2026-09-05):** Retained `inline`. The current source still contains the literal LLVM host directory. `d-20260902-02` governs a separate coverage-scope change and does not change tool discovery. Bounded implementation queries the pinned compiler and tests host metadata; proof is `pnpm coverage:report:test`, `pnpm test:coverage:backend`, and `pnpm coverage:backend:check`.
* **Adjacent source-trace findings:** The coverage executable matcher excludes `.exe` and the entrypoint builds a file URL from a native path. Both belong to the same script's host portability and are fixed in this change.

* **Handled (2026-09-05):** Implementation commit `8dcbf294` derives LLVM tool paths from the pinned compiler's sysroot and host, handles Windows executable names, and compares native entrypoint paths. Technical choice and rejected alternatives: `d-20260905-17`.
* **Proof:** `pnpm coverage:report:test` passed all 27 tests; `pnpm test:coverage:backend` passed 594 tests and exported 33 sources / 6250 branch records; `pnpm coverage:backend:check` passed unchanged floors and ratchets; `pnpm gates:contract:check` passed. ARM Linux, macOS, and Windows metadata are fixture-tested, not verified on those operating systems.
* **Delivery:** Executed at `inline` tier, committed locally and not pushed as required by `next-finding`. No independent lens review; plan authorship and arbitration shared one context, and detection ran on the same model family as the code.

---

## 2026-08-29 — filed through the inbox spool

### The Rust channel floats, so a promoted clippy lint can redden an unchanged tree

* **ID:** f-20260829-13 · **Status:** handled · **Area:** ci-workflows · **Root:** - · **Entry:** build · **Blocked:** none
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

* **Integration review, 2026-09-10:** Root measured a bypass in the first implementation (2a0312a6): inserting a blank line followed by `if: false` after the test workflow's setup command left `checkRustToolchainContract` green (`[]`). The real checked-in workflow was copied to a temporary fixture; baseline was also `[]`. The setup step must be unconditional and must propagate failure, using the existing parsed step metadata and per-workflow regression cases. Fix before closing this finding. Plan authorship and arbitration share the root context; detection uses the same model family as code.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"d2ec798cbd28a46f3cd0576b88a4e66f7e30c4de331e04e3cd39f6f2eb26d171","input_sha256":"e658b731c194a72c89c7a6a24c70a34576648c7585709c7e2d5687e64a57558f","kind":"mutation-receipt","operation":"7d5eeecf4aabdd0ed10e82dc69028ae831b1a9d05cd2acff72a728f7c4133cb4","options":{"section":null},"request_id_sha256":null,"results":["f-20260829-13"],"target":"f-20260829-13","v":1} -->

* **Handled, 2026-09-10:** `2a0312a6` pins Rust 1.98.0 in the single toolchain file and routes test, mutation and release setup through its strict shared installer. `7835f990` uses the shared workflow parser to refuse disabled/failure-tolerant setup and repository Rustup overrides; required components and both macOS targets are guarded. `767a51ae` corrects the surrounding mutation scheduling comment. The integration-review bypass above is repaired. Root repeated the complete phase proof (43 tests plus setup, workflow validation, fmt/check/clippy) and repair proof (133 combined tests and workflow validation), both exit 0. `d-20260910-03` records deliberate compiler maintenance and the policy's reversal path; floating required gates and a dedicated updater were rejected. The separately pinned coverage nightly stays unchanged. Plan authorship and arbitration share the root context; detection ran on the same model family as code.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"a7faaf3a3653a33b75d7f8c9ccdc811c2d6e1cd0f2e4eded45dbe85520b473e8","input_sha256":"1c6f389c940291747164238a9c20320043966f6e26fbaf846429f8c6fda88edc","kind":"mutation-receipt","operation":"b8132d2279e9ea775bccfce5ea582edbe22912143d78bdd9bd423f2afa82ac69","options":{"section":null},"request_id_sha256":null,"results":["f-20260829-13"],"target":"f-20260829-13","v":1} -->

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

* **ID:** f-20260830-06 · **Status:** open · **Area:** native-fs · **Root:** - · **Entry:** build · **Blocked:** felix-decision
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

**Investigated but not fixed, and parked on Felix.** Worked as part of the `native-fs` cluster on
2026-08-31; the other seven findings in that cluster landed.

**What was proved, statically.** macOS: `infra/fs.rs`'s directory-walk module is gated on plain
`#[cfg(unix)]` but uses `rustix::fs::RawDir`, `statx`, `StatxFlags`, `StatxAttributes::MOUNT_ROOT`
and `AtFlags::EMPTY_PATH`/`NO_AUTOMOUNT` — six references across five sites, all exported by rustix
only under `linux_kernel` (or, for the flags, `linux_like`), confirmed against the vendored
`rustix-1.1.4` source. `RenameFlags::EXCHANGE` is *not* a break: Apple rustix defines it as
`RENAME_SWAP`. Windows: seven ungated `#[tauri::command]`s in `file_workspace.rs` call the
`#[cfg(unix)]` helpers `mutation_target`, `register_created_entry` and `paired_rename`, and both
`mod file_workspace;` and the command registration in `main.rs` are unconditional.

**What was proved, empirically, and it is the decisive part: this machine cannot observe the
defect.** `rustup target add` plus `cargo check --target` was run for both targets.
`aarch64-apple-darwin` dies in `bzip2-sys` with `cc: error: unrecognized command-line option
'-arch'`; `x86_64-pc-windows-msvc` dies in the same crate with `error occurred in cc-rs: failed to
find tool "lib.exe"`. Both stop in a dependency build script long before reaching this crate's own
errors. There is no macOS SDK and no MSVC toolchain here, so no local route surfaces it — and
therefore no local route verifies a port either. A real macOS and Windows runner is the only
instrument.

* **Decision:** Does this fork support macOS and Windows?
  * **(a) Keep them, and port.** `infra/fs.rs` gets a second directory-reading implementation for
    non-Linux unix (`fdopendir`/`readdir`, with different error and reentrancy properties) and a
    mount-detection fallback; `file_workspace.rs`'s seven commands get Windows counterparts for
    identity-checked mutation, paired rename and recursive removal. Then `test.yml` gains
    `cargo check` jobs on `macos-latest` and `windows-latest` — using the platform setup
    `release.yml` already has — so it can never silently drift again. Cost: a few hundred lines of
    platform code that cannot be compiled or tested on this machine, verified only by CI, in a file
    whose Linux-specific design was chosen deliberately three days ago (`d-20260830-01` through
    `d-20260830-03`).
  * **(b) Declare Linux-only, and make the config say so.** Drop the macOS and Windows entries from
    `release.yml`'s matrix, gate `file_workspace`'s commands and their registration to Linux, and
    remove the inherited macOS/Windows bundle blocks from `tauri.conf.json`. Cheap, verifiable
    today, and it makes the promise and the implementation agree. Cost: the fork gives up two
    platforms upstream supports, and reversing it later is the porting work in (a) plus whatever has
    accumulated by then.
  * **Ruled out:** adding the CI compile-check jobs *now*, before either answer. Measured: the jobs
    would be red on arrival, and `d-20260830-20` settled that a gate which cannot report the truth
    must not report success — so there is no honest "add it red and fix later" variant. Also ruled
    out: verifying a port locally, which the two cross-compile attempts above proved impossible.
  * **Recommend:** (b), Linux-only, for now. The evidence is that the fork has already chosen it in
    every way except its config: the 2026-08-09 audit built Linux-specific primitives knowingly,
    `d-20260830-01` explicitly noted that three of four targets already could not build and deepened
    the Linux dependency anyway, `d-20260830-15` defers the fork's release channel entirely, the
    last tag predates the fork, and the machine is Linux. Writing an unverifiable macOS port for a
    build nobody has ever produced is the larger risk. **Against it:** upstream ships all three
    platforms, so (b) is a visible narrowing of what this fork could ever be, and it is much easier
    to keep a port working than to write one later — the divergence only grows.
  * **Could not determine:** whether the fork is ever intended to ship to anyone but Felix. Nothing
    in the repository says: there is no README, no `docs/context/`, and `tauri.conf.json` still
    carries upstream's publisher. That is the fact the whole question turns on, and it is not
    derivable from the code.
  * **Session:** 291b4f09-b746-4078-bdc2-32760714373b — transcript `~/.claude/projects/*/291b4f09-b746-4078-bdc2-32760714373b.jsonl`; cross-compile log kept at `/tmp/build-291b4f09-b746-4078-bdc2-32760714373b/xcompile.log`
  * **Product impact:** A macOS or Windows user of this fork either gets a working, shippable En Croissant (keep and port) or is told those platforms are unsupported and will not receive a build from this fork (declare Linux-only).

* **Additional porting evidence (2026-09-06, Codex):** The final Luna correctness lens over 9330ef47..5b51fa6a found that resolve_windows returns no file/target for an empty-component directory resource (current path_authority.rs:5703), so engine_resource refuses that directory lease. Root confirmed the branch and preserves the existing non-Linux support decision/verification boundary. Include it in the platform work rather than add Windows-only behavior unobservable by current gates. Follow-up: tasks/handoffs/2026-09-06-non-linux-directory-resources.md. Existing blocked status is unchanged.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"64f8e99421b3de0a8b9c4d9d56f421eea05e5f2f5ea5a25929e6c1de36550a7e","input_sha256":"e1c864499215d24e3e4798a9555119f8bf3ff4a5575abac29ccb06e611122862","kind":"mutation-receipt","operation":"2d1e5ba5907a84e07356b5a567e4d186f46a4d902c8c993d5018e73118c17247","options":{"section":null},"request_id_sha256":null,"results":["f-20260830-06"],"target":"f-20260830-06","v":1} -->

### Deleting a workspace directory leaves an authority record for every descendant behind

* **ID:** f-20260830-07 · **Status:** handled · **Area:** native-fs · **Root:** - · **Entry:** build · **Blocked:** none
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

Handled. Commit `ad03e196`.

`remove_workspace_entry` now prunes the whole subtree in the same registry commit, reusing the
component-aware `strip_prefix` walk `rebase_workspace_entries` already established, and taking the
removed entry's path and directory flag from the registry rather than from the caller.

On a *partial* removal the top record stays — `d-20260830-04` — while descendants are reconciled
individually through the identity re-stat the authority already performs. A review lens showed at
confidence 100 that keeping every descendant on that path leaves exactly the accumulation this
finding is about, since a partial removal has genuinely deleted some of them. `d-20260831-06`
records that, and records why the tempting general repair — dropping records at load time whose
object no longer resolves — is unsafe: a capability on an unmounted volume does not resolve either,
which is why `refresh_persistent` marks unavailable instead of removing.

Three further leaks on the same path went with it. `commit_candidate` clears an active database,
puzzle or engine root whose record has gone. Pending artifact intents whose root this operation
removed are dropped, since activation would fail and startup recovery skips them forever. And the
`CommitDurability` that `remove_workspace_entry` used to discard is propagated, so a registry fsync
failure after the files are gone stops being reported as success.

`permanently_delete_entry` is restructured so authority reconciliation always runs once the unlink
succeeded. The sidecar cleanup `?` returned *before* it, so a sidecar failure left a deleted file
holding a live capability — a lens caught that at 97. Failures after the unlink now map to
`CommittedDurabilityUncertain`, so `normalizeError` categorises them as `applied-despite-error` and
`FilesPage` relists. That category name is not what `d-20260830-05` wrote; see `d-20260831-01`.

**The bound is narrow and stated as such:** workspace records no longer outlive the objects they
name. The registry as a whole is *not* bounded — it also holds engine binaries, engine resources,
engine images, opening books and downloaded PGNs — and two lenses refuted a wider claim in the plan.

**Not done, and filed:** if `save_entries` fails the prune is not adopted, so the records survive
until something else reconciles. That is deliberate — in-memory state must not diverge from what was
persisted — and now has its own finding rather than living only in a code comment.

**A test gap in the first version was caught and closed:** the removal tests asserted only private
in-memory maps, so persisting the pre-delete state while adopting the prune only in memory would
have passed and then resurrected every stale record on restart. One test now reopens the registry
from disk (commit `2565ee3d`).

### Every backend error reaches the renderer as one opaque string, so the UI classifies it by substring

* **ID:** f-20260830-08 · **Status:** handled · **Area:** bindings-ipc · **Root:** - · **Entry:** build · **Blocked:** none
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

**Handled 2026-09-04.** `Error` has a real Specta type. It serialises as
`ErrorPayload { tag, category, message }`; `impl Type` delegates both `inline` and `reference` to
that struct, so 108 of the 109 `Result<T, string>` command signatures became
`Result<T, ErrorPayload>` and `src/bindings/generated.ts` gained `ErrorCategory`, `ErrorPayload`
and `ErrorPayloadTag`. `closeSplashscreen` keeps `Result<null, string>` because its Rust error
really is a `String` — filed separately.

The classifier already existed: `Error::category()` was a private exhaustive match whose only
caller was `PartialRemoval`'s own format string. It is now `pub`, returns a 19-value
`ErrorCategory`, and its `Display` returns the same prose, so `PartialRemoval`'s message is
byte-identical. The renderer maps those 19 onto its existing seven `AppErrorCategory` values
through one exhaustive `Record`, so the loop closes at compile time on both sides: a new `Error`
variant fails `cargo check`, a new `ErrorCategory` fails `tsgo --noEmit`.

**Two things this found that the finding did not describe.** First, six variants were still
`#[error(transparent)]` around a foreign error, so `Io`, `Zip`, `Tauri`, `TauriOpener`, `Diesel`
and `R2d2` were shipping absolute paths, SQL fragments and connection strings to the renderer
*today* — the finding described the loss of structure, not the live leak. They now carry an owned
literal and keep the cause on `#[source]`, finishing the conversion `Reqwest`, `CredentialFailure`
and `OperationAndCleanup` had already made. Second, making `Diesel` opaque would have silently
deleted the localised `Puzzle.DatabaseOutdated` alert, which read `no such table` out of a Diesel
`Display`; nothing covered it, so every gate would have stayed green. Plan review found it, and it
is fixed here with a typed `PuzzleThemesUnavailable` and four tests crossed against the four ways
the check can be written wrong.

`classify()` survives unchanged as the fallback for renderer-originated errors, listener failures
and `close_splashscreen`. `errorUnlessCancelled` still keys on the exact message `Cancellation`,
because `Analysis cancelled` shares the category and must stay visible (`f-20260830-28`).

**Proof, all run on this machine:** `cargo test` 522, `pnpm vitest run` 616, `cargo clippy -D
warnings`, `cargo fmt`, `rust:surface:check`, `lint:ci`, both boundary checks, `bindings:check`,
both coverage ratchets, `bundle:check`, `frontend-build`, `e2e-container` 8/8, the findings gates,
and `pnpm verify:app` against the real Tauri window with the real backend — the last because this
re-types the error of every command, and it is the only check that observes real IPC in the real
product. Demonstrated reverts rather than asserted ones: dropping the structured branch from
`errors.ts` reddens 21 tests; `#[serde(skip)]` on the wire `tag` reddens 11; each of the four wrong
puzzle-alert implementations reddens a different one of its four cases.

**Commits:** `b7b41866`, `51cf9c3f`, `4116051b`, `0c6f77c2`, `eae41d85`, `7f5ae060`.

**Rejected:** category-only and 40-arm-union wire shapes; emitting the renderer's seven categories
from the backend; a membership guard instead of the `tag` discriminant; logging the dropped cause
from `Serialize`; deleting the substring table; leaving `Diesel` transparent; branching the puzzle
alert on `AppError.category`; a `tauri.ts` type re-export where the `@/bindings` barrel already
existed. Recorded as `d-20260904-05` through `d-20260904-13`.

**Filed, not folded in:** the debug log target is the webview (`main.rs:1615` +
`App.tsx:89`), which is the second, unguarded channel into the renderer; and `close_splashscreen`
is the last `Result<(), String>` command.

**Slice:** this run worked `f-20260830-08` alone. The rest of the `bindings-ipc` cluster —
`f-20260901-04` (build), `f-20260901-08` (lens), `f-20260904-02` (build) — is the
progress-broadcast discriminator, a disjoint file set with no shared `Root`, and stays open
(`d-20260904-13`).

### Every removal in `infra/fs.rs` unlinks by name, and Linux offers no way to unlink by descriptor

* **ID:** f-20260830-09 · **Status:** open · **Area:** native-fs · **Root:** remove-tree-unhardened · **Entry:** build · **Blocked:** inode-conditional-unlink-unavailable
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

* **Pickup evidence (2026-09-06):** A local Python probe opened a directory, renamed it beneath a 0700 private parent, then created a file with `os.open(..., dir_fd=retained_fd)`. Output: `retained descriptor can create after private staging: True`. Private staging does not revoke previously opened directory descriptors and therefore does not reduce an adversarial retained-handle writer to a single top-level race. The final unlink race remains; the build plan evaluates rejection of the proposed staging fix rather than claiming inode-conditional deletion. Entry remains build.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"c3500d5b31db22dbbda0539af2dfd855ecc33c6424814641b2316e3931c06a9d","input_sha256":"ff990757ff52b93dfa371241e1eda2e9d82fd6bce17ee814e3567e2532952367","kind":"mutation-receipt","operation":"41136ea7b263586b602c906996213699e25d4afaa44a3f02883ae1b50a4dd92b","options":{"section":null},"request_id_sha256":null,"results":["f-20260830-09"],"target":"f-20260830-09","v":1} -->

* **Disposition (2026-09-06):** remains open, blocked on `inode-conditional-unlink-unavailable`, governed by d-20260906-01. Rejecting private staging does not reject the real defect. The retained-descriptor probe disproves its claimed isolation; no implementation in this run claims to close the final identity-check-to-unlink window. Reopen for a proven inode-conditional removal primitive or truly exclusive writer authority. This is a technical precondition, not a request for a product decision. Evidence was committed in 3044dc2b; the accompanying filesystem documentation will state the residual explicitly.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"a0dd0c2357a197a726f39ecabaf1da8997829c090e0d30b77561a7f4ff50dda9","input_sha256":"0f8ac2faa4de7b0bbdb192f750bb40f4e04d601eba98931d5572798cb02b725c","kind":"mutation-receipt","operation":"8914d50b896e3b91ad1d721109705f58db0743932cdd9c8aecb464492b4f0bd4","options":{"section":null},"request_id_sha256":null,"results":["f-20260830-09"],"target":"f-20260830-09","v":1} -->

### Below Linux 5.8 the recursive delete cannot see a same-filesystem bind mount

* **ID:** f-20260830-10 · **Status:** handled · **Area:** native-fs · **Root:** remove-tree-unhardened · **Entry:** build · **Blocked:** none
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

* **Pickup evidence (2026-09-06):** In a fresh user/mount namespace, a real bind mount made by `mount --bind` produced equal parent/child `st_dev` values but distinct mount IDs in the held descriptors under `/proc/self/fdinfo`: `same device: True`, `different descriptor mount IDs: True`. Linux documents this descriptor field since 3.15 (https://www.man7.org/linux/man-pages/man5/proc_pid_fdinfo.5.html). This is new evidence beyond the pathname mountinfo parser considered in d-20260830-03. The build plan evaluates a bounded descriptor-based fallback without changing platform declarations. Entry remains build.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"c92b4b56093b7201241d3c12bf4bb7a84fd1a62ce122ed04d7ef17adab5eb11c","input_sha256":"e19a572d9c09e4e812407eaf67ae94b44b297161db28b20c6da10b460c426f60","kind":"mutation-receipt","operation":"ff14af83456ff55ea98391c0a35c8ec90aae3ea9500a05f9faefdf3a388be96d","options":{"section":null},"request_id_sha256":null,"results":["f-20260830-10"],"target":"f-20260830-10","v":1} -->

* **Handled 2026-09-06 — 5f2a3dc5, governed by d-20260906-02.** The recursive walk now compares mount IDs from bounded fdinfo records on held parent/child descriptors when statx returns NOSYS or lacks MOUNT_ROOT support. Missing, malformed, duplicate, oversized or unreadable evidence refuses descent; supported statx and the device backstop retain their behavior. No platform declaration or minimum-kernel comparison was added.
* **Proof:** the root reran `cargo test --manifest-path src-tauri/Cargo.toml --locked infra::fs::tests` (46 passed, one explicitly ignored namespace test), `unshare --user --map-root-user --mount sh -c 'mount --make-rprivate / && cargo test --manifest-path src-tauri/Cargo.toml --locked recursive_delete_refuses_bind_mount_without_mount_root -- --ignored --nocapture'` (one passed, testing both fallback forms at top-level and nested bind mounts), and the partial-delete authority regression (one passed). Formatting, all-target check and clippy also passed. Temporarily reverting only the comparison to the old false result deleted the mounted regular fixture file and failed with ENOENT; restoring it passed. Logs: `/run/user/1000/chessfable-phase-fs-20260906/` and `/tmp/build-e7cf229e-c8c7-4977-b54f-e2fe3a77f1fb/root-proof.log`.
* **Limits and rejected alternatives:** no old-kernel machine was used; test injection supplies raw unsupported statx outcomes while fdinfo and bind mounts are real. The pathname mountinfo parser and a new Linux 5.8 support floor were rejected. The sibling f-20260830-09 remains open at build tier with its separate technical blocker; this change does not claim to close final name-based unlink races.
<!-- ledger-meta {"command":"annotate","effect_lines":3,"effect_sha256":"8e3dfdb05b771cec42d51597d0c2e9845db58958b72d49a2ebfea701215afed8","input_sha256":"e7fe3ee46d9594ecc9a31fb66413a08c69f0bab246eb8dd2b559d7a6913f60bf","kind":"mutation-receipt","operation":"e603688f28ea191df9ae204b1c3aa40811279c315f0ed13044aa9b284c3af518","options":{"section":null},"request_id_sha256":null,"results":["f-20260830-10"],"target":"f-20260830-10","v":1} -->

### Every confirmation-error message is English in all 16 locales, because its key is built dynamically

* **ID:** f-20260830-11 · **Status:** handled · **Area:** i18n · **Root:** - · **Entry:** build · **Blocked:** none
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

* **Cumulative review 2026-09-10, in-scope repairs pending:** error-handling lens found two confirmation-caller defects in the neighbourhood of this localization change. (1) `GameSelector.tsx:151` drops `InfoPanel.deleteGame`'s promise and toggles the modal independently, so rejection is unhandled and completion is reported too early (blocker, confidence 99). (2) `FilesPage.tsx:330` clears the trash banner after native restore but lets relist rejection become a generic restore failure (should-fix, confidence 94). Both are triaged Fix in this run; they are pre-existing caller defects, not introduced by `288a6d77`. The other five cumulative lenses approved without findings. Plan authorship and arbitration shared one context; detection ran on the same model family as implementation.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"198977ad6b4d7ced15f65c3bc1e61612f00d7fe544ea3838a8023cd73fe9d27b","input_sha256":"5b3d28b61aa42d9bfcda6fa9d186f755cb8e1ba7988d0b42bada0d20591c5699","kind":"mutation-receipt","operation":"97859a3ea064fcfff51c6ecfd2fa571a41cd29f6c9661787abe495cb14857acb","options":{"section":null},"request_id_sha256":null,"results":["f-20260830-11"],"target":"f-20260830-11","v":1} -->

* **Handled 2026-09-10:** `288a6d77` replaces the dynamic confirmation key with literal calls for the existing two outcomes and adds translations to all 16 catalogues, under d-20260910-04. f-20260830-11 and f-20260830-19 describe the same defect and are closed together.
* **Proof:** extraction followed by extraction CI, 36 targeted tests, completeness for 16 locales, and lint passed; the import-graph test floor passed 106 tests. Restoring the old dynamic production call and extracting deleted the messages and made both new real-catalogue tests fail; restoring the fix passed. The container directory-trash scenario exercises the German generic failure, and the real-catalogue component test exercises the applied warning. Its new screenshot records reachable scrollable controls; existing Files-page background overflow is separately filed and is not claimed fixed.
* **Inventory:** a bounded scan classified all 21 nonliteral production translation calls. Missing Board and accent labels plus the halfmove error-key typo were filed to the drain inbox for separate component work; f-20260901-21 stays separate. Plan authorship and arbitration shared one context; detection ran on the same model family as the implementation.
* **Review repairs completed:** `7ed32218` returns GameSelector's delete promise to the real confirmation flow and closes explicitly; `e0bc6937` shares restore/purge relisting policy so failed refresh cannot replace the native result. The orchestrator inspected both diffs and reran their exact proofs: 9 game/confirmation tests, 93 restore/error tests, and lint passed. Both repairs include failing-before regression evidence. All six cumulative lenses completed, with these two findings fixed and no unresolved Fix. The separate Files-page overflow and e2e argument-forwarding defects are recorded in the drain inbox.
<!-- ledger-meta {"command":"annotate","effect_lines":4,"effect_sha256":"b3f9d90e99e3e732eeb1145bd163e2681e367622cd004693b1e6c97deb74def9","input_sha256":"b2c10b3a4e57dd082c1dcae88612a1653ccf4a1ab184ddb2fb682dfb41484b24","kind":"mutation-receipt","operation":"f5d5fcf9dbaae61a8b1675730e55a5106bc6e7e1bcafb28d70b94447e77913ce","options":{"section":null},"request_id_sha256":null,"results":["f-20260830-11"],"target":"f-20260830-11","v":1} -->

### A cancelled or failed workspace folder picker produces an unhandled rejection and no user feedback

* **ID:** f-20260830-12 · **Status:** handled · **Area:** frontend-ui · **Root:** - · **Entry:** build · **Blocked:** none
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

**Handled 2026-08-31.** `chooseWorkspace` catches, `errorUnlessCancelled` silences `Cancellation`, and real failures notify. Duplicate picks are ignored (`pendingRef` + `picking`). Display `"Cancellation"` is pinned in `error.rs`. Picker JoinError panics map to `InvalidInput`, not cancel.

* **Commits:** `17973bd7` (FilesPage + helper), `6024fcb5` (unwrap), `320f535e` (delete useOperation).
* **Rejected:** `useOperation` on the picker (`d-20260831-25`); inline `actionError` (`d-20260831-26`).
* **Left open:** AddDatabase / DatabasesPage export / AccountCard, filed separately.

### The permanent-delete confirmation flow has no e2e coverage, only jsdom with the modal mocked

* **ID:** f-20260830-13 · **Status:** handled · **Area:** e2e-gate · **Root:** - · **Entry:** lens · **Blocked:** none
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

* **Entry revalidation (2026-09-10):** build -> lens, with review-tests. The original uncertainty was a missing workspace fixture and browser modal route. Current e2e/async-errors.spec.ts already grants a workspace, reaches a real Files confirmation dialog and asserts its accessibility and geometry at 320px / 200% German fonts; e2e/fixtures.ts supports sequential refresh results. d-20260829-01 settles container rasterization. Extend that existing journey with trash followed by permanent-delete partial-removal and durability error payloads, asserting the visible warning, refreshed state, and dialog screenshot. No new application architecture or product choice remains. Proof: pnpm test:e2e:container --project=async-errors, followed by the full container suite and push contract gates.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"2e10eae082abef6ca5dc202372ef315ac74a019a4981c64ad614e0c0787bb3d0","input_sha256":"4d573962301dac81388cd044f12dbc00d9e9fab45ed0f50a14b085622a6954da","kind":"mutation-receipt","operation":"b16e799c3ef6a245369867f3c4b019b6e8599432a98e3f6af9d2505dfcca5304","options":{"section":null},"request_id_sha256":null,"results":["f-20260830-13"],"target":"f-20260830-13","v":1} -->

* **Handled (2026-09-10), implementation commit 5fcb9f94:** Added real-browser partial-removal and durability warning journeys through FilesPage, the generated command facade and Mantine confirmation dialog. Both run in German at 320px / 200% font scale, assert the complete visible warning, absence of raw diagnostics, removal of trash recovery controls, exact purge handles and rendered post-purge list data. The Files workspace fixture is shared with the existing database-files journey. Two new container snapshots pin the warnings; existing snapshots were preserved.
* **Review:** correctness and root-cause approved without findings. All six reported review items were fixed: helper naming, observable refresh, unnecessary cancel branch, shared workspace fixture, unused/duplicated mock types, and falsy-error handling. Root image inspection additionally drove deterministic warning scrolling and full-alert bounds assertions. Plan authorship and arbitration shared one context; detection ran on the same model family as the code, with separate reviewer sessions.
* **Proof:** affected container projects passed (6 tests), full container suite passed (13 tests), and lint:ci passed. Negative probe changing partial-removal to io failed the warning assertion; restoring the structured category passed. See /tmp/chessfable-purge-negative.log and /tmp/chessfable-purge-positive-restored.log. d-20260910-07 records the chosen test strategy and rejected new-harness/jsdom-only alternatives. The test checks browser rendering with mocked IPC, not native filesystem deletion or GTK chrome.
<!-- ledger-meta {"command":"annotate","effect_lines":3,"effect_sha256":"130db61fa78a7336e80944105d053ebd1b1e13ace783f0332d2f77e95fc9e19c","input_sha256":"7693e797e2ca303586ca4d92075f5a05e88e8687fdc0923f667584a9be53aaeb","kind":"mutation-receipt","operation":"80de30f05bedb1c1112838964d036bb1c2b421386b6f686d6cdd681e4cf3ee61","options":{"section":null},"request_id_sha256":null,"results":["f-20260830-13"],"target":"f-20260830-13","v":1} -->

---

## 2026-08-30 — filed through the inbox spool

### The `_atomic_write` fix has not reached the two sibling copies of `findings.py`

* **ID:** f-20260830-14 · **Status:** handled · **Area:** gate-scripts · **Root:** - · **Entry:** inline · **Blocked:** none
* **Where:** `~/Projekte/chess-tactics-app/scripts/findings.py` and
  `~/Projekte/correction-app/scripts/findings.py`, the `finally` block of `_atomic_write`.
* **Defect:** `f-20260829-14` was fixed in `en-croissant` only (commit `514cfb40`). Both siblings
  still re-raise a failing `tmp.unlink` when the write did not commit, so a failed ledger write
  followed by a failed cleanup still reaches the operator as "could not remove /tmp/...tmp-x" while
  the reason the ledger could not be written is discarded. `scripts/findings.py` is deliberately
  identical across Felix's projects (`~/.claude/references/findings-ledger-contract.md`), so this is
  a **declared pending divergence**, which that contract permits — not a fork nobody chose. It stops
  being permitted once the port lands or the copies drift further.
* **Why it was not done in that run:** both checkouts are live and were moving while they were being
  measured — `chess-tactics-app` went from 11 to 12 commits ahead of `origin/develop`;
  `correction-app` went from 5 dirty files to 0 to 3, and from 2 to 3 commits ahead. Committing into
  a tree moving underneath, on top of an unpushed stack that run had not reviewed and could not
  push, was judged worse than declaring the pendency (`d-20260830-11`).
* **The exact change to apply.** In `_atomic_write`'s `finally` block, replace the
  `if committed: print(...) else: raise` pair with an unconditional warning so both diagnostics
  survive:

  ```python
          except OSError as exc:
              # Never re-raise here. A ``raise`` inside ``finally`` replaces the
              # exception already in flight, so a failed write followed by a failed
              # cleanup would reach ``main`` as "could not remove /tmp/...tmp-x" and
              # the reason the ledger could not be written would be gone. For a tool
              # whose whole purpose is not losing findings, that is the wrong half to
              # keep. Report the orphaned temporary file instead, so both diagnostics
              # survive, and let the primary error propagate.
              detail = "after atomic write" if committed else "after a failed atomic write"
              print(
                  f"WARN could not clean up temporary file {tmp} {detail}: {exc}",
                  file=sys.stderr,
              )
  ```

* **Per repository.** `chess-tactics-app` was byte-identical to en-croissant before this fix
  (md5 `edc21d38`), so the patch applies exactly and the result should diff to zero hunks against
  en-croissant. `correction-app` has already diverged independently (md5 `1c0ea94d`); read its block
  before patching rather than applying blind, and check whether its divergence is declared anywhere.
* **Proof after porting:** in each repository,
  `diff -u <(git -C ~/Projekte/en-croissant show HEAD:scripts/findings.py) scripts/findings.py`
  and confirm the `_atomic_write` hunk is gone. en-croissant's
  `scripts/findings-atomic-write-tests.py` is repo-local and is **not** part of the shared tool; a
  sibling may copy it, but it must not be added to `findings.py`.
* **Found by:** the `gate-scripts` build run, 2026-08-30, while closing f-20260829-14.

**Handled 2026-08-31** by the `gate-scripts` build run (findings.py-sharing slice), commits
`7113c19e` and `485dc8af`. Less was owed than this entry asserts, and two of its measurements had
gone stale in the day since it was filed.

* **`correction-app` needed no port.** This entry records it at md5 `1c0ea94d` carrying the
  defective block. It is now `b98574f7` and carries the *identical* fix, landed independently as
  its own commit `0378e5251` and declared in its own parity test among 64 changed lines of
  Korrigio-first divergences. Nothing was owed there and nothing was done there.
* **`chess-tactics-app` still carries the defect, and the port is that repository's own work.**
  Its copy is still md5 `edc21d38` with the `if committed: print else: raise` block, and its own
  ledger has carried the port since 2026-08-30 as its `f-20260830-14` (area `dev-scripts`,
  `Entry: inline`), filed from here with the exact hunk and the re-pin instruction.
* **The port was deliberately not performed from here** — `d-20260831-08`. A drain holds that
  checkout, verified by `flock` on its lock file rather than by the file's existence. Leaving an
  uncommitted edit there would put a foreign dirty gate-input path in front of its own `$push`,
  whose rule is to stop on exactly that; committing there would bypass its review and gates over
  an entry already in its queue. This is not `d-20260830-11` repeated: that decision deferred
  because the trees were moving and delivered a handoff prompt, whereas the entry now exists in
  the upstream's own queue, which is the durable form.
* **What was owed here, and is done:** the declaration in
  `scripts/findings-parity-tests.py` said `sibling_told=False`, which was false — the upstream had
  been told on 2026-08-30. It is corrected to `True` with the upstream's ledger id as the
  evidence, and the flag is no longer decorative: a declaration with `port_pending=True` and
  `sibling_told=False` now fails the gate, because a pending port the other repository has not
  been told about is a fork nobody is tracking. Proved by reverting the flag and watching
  `test_findings_diff_is_fully_declared` go red.
* **Rejected:** repeating `d-20260830-21`'s shape here (repair or edit uncommitted in the sibling
  and file a finding). That shape was measured this same run and it does not hold — see
  `d-20260831-11`.

This slice did not touch the other members of the `gate-scripts` cluster — `f-20260830-17`,
`-23`, `-46`, `-54` and `-55` — which carry disjoint file sets and get their own runs.

**Correction to the decision references above.** The annotation was written before
`record-decision` allocated the ids, and its guesses are wrong. The decisions recorded by this run
are: `d-20260831-09` sibling movement warns rather than blocking · `d-20260831-10` a probe that
cannot run fails closed · `d-20260831-11` the gate stays out of CI and the upstream copy is not
vendored · **`d-20260831-12` who performs the port into `chess-tactics-app`** (cited above as
`d-20260831-08`) · **`d-20260831-13` a working-tree-only repair in a foreign repository is not a
fix for a committed defect** (cited above as `d-20260831-11`) · `d-20260831-14` no fourth parity
edge · `d-20260831-15` the declared-divergence framework stays.

### Nothing detects divergence between this repository's `findings.py` and the sibling copies

* **ID:** f-20260830-15 · **Status:** handled · **Area:** gate-scripts · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `scripts/findings.py`; the missing guard would live beside
  `scripts/findings-atomic-write-tests.py` and in `.github/workflows/test.yml`.
* **Defect:** `~/.claude/references/findings-ledger-contract.md` requires `findings.py` to stay
  identical across Felix's projects and says that clause "is enforced, not merely asserted" —
  Korrigio carries `backend/tests/scripts/test_findings_upstream_parity.py`, which diffs the local
  file against the sibling repository's *committed* copy and holds a closed list of declared
  divergences, failing in both directions. **En Croissant has no such test.** The copies have
  already drifted here: `correction-app` differs (md5 `1c0ea94d` against `edc21d38`) and nothing
  reported it, and this repository now carries a deliberate one-hunk divergence of its own
  (`d-20260830-11`) whose only record is a finding somebody has to read.
* **Why this is `build` and not `inline`:** the design question is real and answering it wrongly
  produces a gate that looks green and checks nothing. **The sibling repository does not exist on a
  CI runner.** A parity test that skips when the sibling is absent is vacuous in exactly the
  environment that matters — the same defect this repository already hit when two
  `ui:boundary:check` rules were diff-scoped and were therefore vacuous on every clean checkout,
  including every CI run. Options that need weighing, none of them free:
  * vendor the canonical copy's hash or content into this repository and compare against that, which
    makes CI meaningful but adds a second artefact to keep current;
  * run the parity check only locally and accept that CI cannot, which is honest but repeats the
    vacuous-gate shape unless the local gate is genuinely mandatory in `$push`;
  * publish `findings.py` from one place — a small shared repository or a released artefact — and
    have each project vendor it, which removes the divergence class outright and is the largest
    change;
  * declare divergences in a checked-in list, as Korrigio does, so an undeclared hunk fails and a
    stale declaration also fails.
* **Constraint on any answer:** whatever is built must fail in **both** directions. An undeclared
  hunk is a fork nobody chose, and a declaration that no longer matches a hunk means the divergence
  was ported and the entry must go, so the list cannot rot into a permanent amnesty. That is the
  contract's own wording and it is the part that makes the mechanism worth having.
* **Related:** the pending port filed alongside this entry, and `d-20260830-11`, which declared the
  current divergence. Korrigio's implementation is the reference to read first.
* **Found by:** the `gate-scripts` build run, 2026-08-30, while closing f-20260829-14.

**Handled 2026-08-31** by the `gate-scripts` build run (findings.py-sharing slice), commits
`7113c19e` and `485dc8af`.

**Most of what this entry asks for already existed when it was picked up, and the entry did not
know.** `scripts/findings-parity-tests.py` (commits `b2e7ed31`, `d6fd39f1`, 2026-08-30) already
diffed this copy against the upstream's *committed* blob at a pinned ref and already failed in
both directions the entry's "Constraint on any answer" requires: an undeclared hunk fails, and a
declaration matching no hunk fails, so the list cannot rot into a permanent amnesty. It also fails
on a changed-line-count drift, a delta-digest drift, a blank marker, a duplicate marker and an
ambiguous hunk, and it refuses to skip silently — an absent sibling fails unless
`--allow-missing-sibling` is passed, which is stricter than either peer (both `pytest.skip`). It
is wired as `findings:parity:check` and named in `.claude/skills/push/SKILL.md:114`. It was never
closed by the run that built it.

**The entry's premise about the topology was also wrong**, which matters because its option list
rested on it. There are three parity edges, not one missing one: En Croissant → `chess-tactics-app`
pinned `4c83bf50c`; `correction-app` → `chess-tactics-app` pinned at the same commit; and
`chess-tactics-app` → `correction-app` pinned `3e80b0735`. Every copy guards itself against one
pinned peer. Nothing points at En Croissant, which is correct — a parity edge protects the
repository that owns it.

**What was genuinely missing, and is now fixed:** the pin is a fixed commit, and nothing observed
upstream commits *after* it. The single event this gate exists to catch — the upstream moving while
this copy stands still — produced no signal at all. Both peers do look; neither looks correctly,
and both look invisibly.

* **Correctly:** `git log <REF>..HEAD -- <path>` lists what `HEAD` reaches and the pin does not, so
  a pin on a diverged branch yields an empty range and reads as current while the copies have
  parted. Ancestry is now asked separately (`NOT-ANCESTOR`), the newest commit touching the path is
  resolved from `HEAD` and compared by identity, and the mirror case — the pin being ahead of the
  upstream's own history for the file — is reported as `PIN-AHEAD` rather than mislabelled `NEWER`.
* **Visibly:** both peers use `warnings.warn`, which under a plain runner leaves exit 0 and one
  line that scrolls past; inside an unattended drain nobody reads it. `main()` now prints the
  offending commits and the remedy itself.
* **Without changing the severity** — `d-20260831-09`. This half stays advisory, because
  ChessRiddle made it blocking (`d-20260826-10`) and measured the cost on 2026-08-26: eight sound
  commits stranded unpushed by a gate that repository could neither cause nor fix, after which
  Felix qualified it in chat on 2026-08-27. The probe itself is nevertheless fail-closed
  (`d-20260830-20`): a git failure raises rather than flattening into the empty "current" result.

**Decided against, from the entry's own option list:** vendoring the upstream copy or publishing
`findings.py` from one shared place (`d-20260831-10`); a fourth parity edge to `correction-app`
(`d-20260831-12`); and wiring the gate into CI, where no upstream checkout exists
(`d-20260831-10`).

Thirteen tests now cover this file's probe and rule, each proved revert-sensitive by mutating the
production line and confirming the named test goes red.

**Correction to the decision references above.** The annotation was written before
`record-decision` allocated the ids. `d-20260831-09` (severity stays advisory) is correct as
cited. The others are not: vendoring and CI are **`d-20260831-11`** (cited as `d-20260831-10`), the
fourth parity edge is **`d-20260831-14`** (cited as `d-20260831-12`), and the fail-closed probe is
**`d-20260831-10`** — `d-20260830-20` is the earlier, general precedent it applies, not this run's
own decision.

* **2026-09-02:** the living enforcement is now `kit sync --check` (kit-owned bytes). The three-way parity mesh (`scripts/findings-parity-tests.py` / `pnpm findings:parity:check`) is gone.

---

## 2026-08-30 — filed through the inbox spool

### The renderer's error redaction emits a literal `$1` and destroys FENs, SANs and PGN results

* **ID:** f-20260830-16 · **Status:** handled · **Area:** bindings-ipc · **Root:** platform-error-redaction · **Entry:** build · **Blocked:** none
* **Where:** `src/platform/errors.ts:16-20` (`SECRET_PATTERN`, `PATH_PATTERN`, `redact`).
* **Defect:** two independent bugs in one function, both reproduced by evaluating the shipped
  regexes directly against the shipped replacement strings.
  1. `SECRET_PATTERN` is built entirely from non-capturing groups `(?:...)`, but `redact` replaces
     with the string `"$1[redacted]"`. There is no group 1, so `$1` is emitted verbatim.
     `"Authorization: Bearer sk-abc123 rejected"` becomes
     `"Authorization: $1[redacted] rejected"`, and `"token=xyz expired"` becomes
     `"$1[redacted] expired"`. The secret is removed, so this is cosmetic rather than a leak, but
     it is user-visible in every credential-related error.
  2. `PATH_PATTERN` matches any `/`-separated token, not just filesystem paths. In a chess
     application this eats the domain data:
     `"Invalid FEN: rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"` becomes
     `"Invalid FEN: rnbqkbnr[path] w KQkq - 0 1"`, and `"1/2-1/2 result malformed"` becomes
     `"1[path] result malformed"`.
* **Why it matters:** the second bug removes exactly the information a user needs to repair a
  malformed import or a bad FEN, and it is unrecoverable downstream: `errors.ts:73` assigns
  `diagnostic` the same already-redacted string as `message`, so no channel to the original cause
  survives the facade. `normalizeError` also computes the category from the *redacted* text
  (`errors.ts:40-41`), so evidence is destroyed before classification.
* **Why the tests did not catch it:** `src/platform/errors.test.ts:5-9` and
  `src/platform/tauri.test.ts:33-34` assert only `not.toContain(secret)`. A redaction that
  over-matches, or that emits a literal `$1`, passes that assertion.
* **Open design question (hence `build`):** what the redaction policy should actually be. Removing
  `PATH_PATTERN` restores FENs but re-admits home-directory paths into user-facing text; a
  path-shaped heuristic that excludes FEN/SAN needs to be specified deliberately, and the
  `diagnostic` field needs to carry the unredacted cause if the category is to be computed from
  anything trustworthy.
* **Found by:** Claude review of the 2026-08-13 audit diff, 2026-08-30 — the first read of
  `src/platform/` by a model outside the run that produced it. Reproduced by evaluating the
  regexes out of the file rather than by inspection.

* **Handled 2026-09-01.** `redact` uses a callback for secrets (no literal `$1`), shields FEN boards and `1/2-1/2` before path scan, and only then redacts Windows/UNC/`~/`/Unix filesystem paths. Classification runs on the unredacted source; generated IPC strings are used as-is. Paths with spaces, long root-file extensions, and `http(s)://` URLs are covered. `diagnostic` is omitted.
* **Commits:** `838b7104`, `34a8be0c`
* **Rejected:** deleting `PATH_PATTERN`; classifying after redaction; putting the unredacted source in `diagnostic`.
* **Decisions:** d-20260901-33 redaction vs chess notation.

---

## 2026-08-30 — filed through the inbox spool

### The Tauri boundary checker has verified blind spots, and `native.ts` is exempt from every rule

* **ID:** f-20260830-17 · **Status:** handled · **Area:** gate-scripts · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `scripts/check-tauri-command-boundary.mjs:9-13` (the regexes), `:40` (the
  `src/platform/native.ts` exemption), `src/platform/native.ts`.
* **Defect:** the gate is green today and there are no `from`-form violations, but it recognises
  only `from`-shaped imports and the literal substring `.listen(`. Constructs it does not flag:
  `await import("@tauri-apps/api/core")`, `await import("@/bindings/generated")`,
  `require("@tauri-apps/api/event")`, a bare `listen(...)` call imported from the facade, and the
  window-object subscription forms `onResized` / `onCloseRequested` / `once` / `onDragDropEvent`.
  `src/state/keybinds.test.ts:2` already carries a `@tauri-apps` specifier outside `src/platform`
  without tripping the gate.
* **Second half:** `:40` skips `native.ts` before all four checks, so adding
  `export { listen } from "@tauri-apps/api/event"` or `export * from "@tauri-apps/plugin-fs"` to
  that one file legalises raw listeners or raw filesystem access application-wide with the gate
  still green. The single-line diff that dissolves the boundary is the one the checker refuses to
  look at.
* **Why it matters:** `src/platform/` is the only structural guarantee the renderer has, and the
  checker is its sole enforcement. Unlike its two siblings
  (`check-untranslated-jsx.test.mjs`, `i18n-completeness.test.mjs`) it has **no test**, so there is
  no proof it ever goes red.
* **Open design question (hence `build`):** whether to keep regex detection and widen it, or parse
  the module graph; and what contract `native.ts` should be held to instead of a blanket exemption.
* **Found by:** Claude review of the 2026-08-13 audit diff, 2026-08-30. Blind spots confirmed by
  running the checker's own regexes against each construct.

**Handled 2026-08-31.** `scripts/check-tauri-command-boundary.mjs` no longer skips `native.ts`. It matches syntactic import forms (`from`, `export from`, side-effect `import`, `import()`, `require()`, `vi.mock`) of `@tauri-apps/(?:api|plugin-)` and of `bindings/generated` (except `vi.mock` of generated). `native.ts` is held to an exact `{ specifier, exported, local }` allowlist of today's re-exports plus an independent denylist (`@tauri-apps/api`, `api/event`, `plugin-fs`/`http`/`shell`/`updater`, `api/core` `invoke`); `export *` / `export * as` are forbidden. `tauri.ts` remains the generated-command/event facade and may not import `@tauri-apps`. `listWorkingTreeFiles` in `scripts/working-tree-files.mjs` is the shared git enumerator; `check-ui-boundaries.mjs` uses it too.

Suite: `scripts/check-tauri-command-boundary.test.mjs` (47 cases), including skip-restoration (listen re-export), denylist-independence (injected allowlist), `invoke as convertFileSrc`, untracked `leak.ts` CLI, and both git-failure branches. `src/state/keybinds.test.ts` mocks `@/platform/native` instead of `@tauri-apps/plugin-os`.

* **Commits:** `a2e6774f`
* **Rejected:** module-graph parser; denylist-only native contract; flagging `onResized`; flagging `vi.mock("@/bindings/generated")`; copying the git walker instead of extracting it.
* **Decisions:** d-20260831-28 native allowlist · d-20260831-29 regex forms · d-20260831-30 window methods · d-20260831-31 walker extract · d-20260831-32 generated mocks.
* **Left open:** f-20260830-23, -46, -54 (other three checkers onto the helper), -55.

---

## 2026-08-30 — filed through the inbox spool

### Two dead paths left behind by the facade migration: `operation.ts` has no consumer, `unwrap.tsx` is unreachable

* **ID:** f-20260830-18 · **Status:** handled · **Area:** frontend-ui · **Root:** - · **Entry:** inline · **Blocked:** none
* **Where:** `src/platform/operation.ts`, `src/utils/unwrap.tsx`, and its call sites
  `src/utils/engines.ts:149,155,167`, `src/components/databases/PlayerCard.tsx`,
  `src/components/databases/PlayerSearchInput.tsx`, `src/components/panels/info/FileInfo.tsx`,
  `src/components/tabs/NewTabHome.tsx`.
* **Defect 1:** `useOperation` has **zero consumers** anywhere in `src/` outside its own file, and
  no test beside the other five `src/platform/*.test.ts`. 51 lines of untested abstraction shipped
  with the facade and never wired up.
* **Defect 2:** `unwrap()` is still called at the sites above, but the facade Proxy
  (`src/platform/tauri.ts:55`) has already unwrapped the `Result` before the value reaches it.
  `unwrap.tsx:11-12` therefore early-returns on every call, and lines 14-21 — the `error()` log,
  the Mantine failure notification, the `throw` — cannot execute at any site. The file is also the
  only place that would log the **raw, unredacted** backend error, so it contradicts the facade's
  redaction contract while being unable to run.
* **Why it matters:** the visible symptom is an error toast that never appears. The next person to
  investigate that will fix `unwrap.tsx` and it will still never appear, because the reason is the
  early return, not the notification code.
* **Fix shape:** delete `operation.ts` unless a caller is intended, and remove the `unwrap()` calls
  at the seven sites rather than repairing them.
* **Found by:** Claude review of the 2026-08-13 audit diff, 2026-08-30. Both confirmed by grep, not
  by inference.

* **Partially overtaken 2026-08-30 by commit `04921a1d`, and deliberately only partially.**
  Defect 1 said `useOperation` is "51 lines of untested abstraction". It is now tested:
  `src/platform/operation.test.tsx` covers idle/pending/success, the error path and its re-throw,
  the abort-vs-error distinction, cancellation, unmount cleanup, and the stale-generation guard.
* **That does not answer this finding — it narrows it.** The tests were written because deleting
  the well-covered `src/platform/updater.ts` in the same commit dropped the `tauri-ipc-platform`
  area to 69.00% against its permanent 70% floor, and covering the area's genuinely untested member
  was the honest response. Deleting `operation.ts` would ALSO have cleared the floor, and that is
  precisely why it was not done: clearing a coverage ratchet by deleting code is the gaming the
  shrink-adjusted baselines exist to prevent (`docs/coverage.md`, `d-20260829-03`).
* **The real question this finding asks is still open, and it is the more important half:**
  `useOperation` still has ZERO production consumers. `CLAUDE.md`'s layout table names
  `src/platform/operation.ts` as part of the renderer's sanctioned door to Tauri, and
  `.claude/rules/async-resource-invariants.md` mandates exactly the contract it implements — "one
  operation type has one facade and one error/loading/cancellation contract". So the choice is
  **adopt or delete**, and it is a design decision about the facade, not a cleanup:
  - **Adopt** — migrate the ad-hoc async paths that currently hand-roll loading/error/cancellation
    onto it, which is what the rule asks for and what the audit presumably intended.
  - **Delete** — accept that the facade shipped a primitive nobody wired up, and remove it together
    with its tests and its `coverage-areas.json` entry.
  Two review lenses (`review-minimalism` 99, `review-code-quality` 99) argued for deletion on this
  run's diff. That was not overruled — it was left to this finding, which already owns the question
  and names `unwrap.tsx` alongside it. **Whoever takes this must decide adopt-vs-delete first;**
  the tests are not an argument for keeping it.
* Defect 2 (`unwrap.tsx` unreachable) is untouched by that commit and remains exactly as filed.

**Handled 2026-08-31.** `unwrap.tsx` deleted; every production call was a no-op after the Result facade. `useOperation` deleted (zero consumers). `coverage-areas.json` still lists the stale paths so `scopeSignature` does not change (`d-20260831-27`).

* **Commits:** `6024fcb5` (unwrap), `320f535e` (operation.ts).
* **Rejected:** adopting `useOperation` as FilesPage's first consumer; deleting coverage-area paths to "clean up" the config.

---

## 2026-08-30 — filed through the inbox spool

### `ConfirmModal` builds a dynamic i18n key whose catalogue entries do not exist

* **ID:** f-20260830-19 · **Status:** handled · **Area:** i18n · **Root:** - · **Entry:** inline · **Blocked:** none
* **Where:** `src/components/common/ConfirmModal.tsx:16`, all 16 catalogues under
  `src/translation/`.
* **Defect:** the component builds `Common.ConfirmationError.${category}` from the facade's
  seven-category `AppErrorCategory` taxonomy. `grep -rn ConfirmationError src/translation/` returns
  **nothing** — not one of the seven keys exists in any locale. Every category therefore falls
  through to the `defaultValue` at `ConfirmModal.tsx:12-15`, which branches only on
  `applied-despite-error`. The seven categories collapse to two user-visible outcomes.
* **Why the gate did not catch it:** the key is constructed at runtime by template literal, so
  `pnpm i18n:check` — which matches literal key usages — cannot see it. This is a known blind spot
  of key-completeness checking, not a bug in the checker.
* **Fix shape:** add the seven keys to all 16 catalogues, or drop the dynamic lookup and keep the
  explicit branch that is doing the work today. The second is smaller and matches actual behaviour.
* **Found by:** Claude review of the 2026-08-13 audit diff, 2026-08-30.

* **Handled 2026-09-10:** `288a6d77` replaces the dynamic confirmation key with literal calls for the existing two outcomes and adds translations to all 16 catalogues, under d-20260910-04. f-20260830-11 and f-20260830-19 describe the same defect and are closed together.
* **Proof:** extraction followed by extraction CI, 36 targeted tests, completeness for 16 locales, and lint passed; the import-graph test floor passed 106 tests. Restoring the old dynamic production call and extracting deleted the messages and made both new real-catalogue tests fail; restoring the fix passed. The container directory-trash scenario exercises the German generic failure, and the real-catalogue component test exercises the applied warning. Its new screenshot records reachable scrollable controls; existing Files-page background overflow is separately filed and is not claimed fixed.
* **Inventory:** a bounded scan classified all 21 nonliteral production translation calls. Missing Board and accent labels plus the halfmove error-key typo were filed to the drain inbox for separate component work; f-20260901-21 stays separate. Plan authorship and arbitration shared one context; detection ran on the same model family as the implementation.
* **Review repairs completed:** `7ed32218` returns GameSelector's delete promise to the real confirmation flow and closes explicitly; `e0bc6937` shares restore/purge relisting policy so failed refresh cannot replace the native result. The orchestrator inspected both diffs and reran their exact proofs: 9 game/confirmation tests, 93 restore/error tests, and lint passed. Both repairs include failing-before regression evidence. All six cumulative lenses completed, with these two findings fixed and no unresolved Fix. The separate Files-page overflow and e2e argument-forwarding defects are recorded in the drain inbox.
<!-- ledger-meta {"command":"annotate","effect_lines":4,"effect_sha256":"b3f9d90e99e3e732eeb1145bd163e2681e367622cd004693b1e6c97deb74def9","input_sha256":"b2c10b3a4e57dd082c1dcae88612a1653ccf4a1ab184ddb2fb682dfb41484b24","kind":"mutation-receipt","operation":"64a619d8c0a9fa5d8791e7c857df60cf8c421e92c8f257e12e147c0227123171","options":{"section":null},"request_id_sha256":null,"results":["f-20260830-19"],"target":"f-20260830-19","v":1} -->

---

## 2026-08-30 — filed through the inbox spool

### Renderer-supplied pagination is unvalidated: overflow panic in debug, `LIMIT -1` reads the whole table in release

* **ID:** f-20260830-20 · **Status:** handled · **Area:** db-search · **Root:** - · **Entry:** inline · **Blocked:** none
* **Where:** `src-tauri/src/db/mod.rs:1083-1090`, and the same expression at `:1399` and `:1471`.
  Type at `:984-986`; reachable from the registered commands `get_games`, `get_players`,
  `get_tournaments` (`main.rs:93-94`), exported as `getGames`/`getPlayers` in
  `src/bindings/generated.ts:760,784`.
* **Defect:** `page` and `page_size` are `Option<i32>` deserialised straight from the renderer and
  validated nowhere in the crate. Two consequences from the same two lines:
  1. `offset(((page - 1) * query_options.page_size.unwrap_or(10)) as i64)` multiplies two
     renderer-controlled `i32` values *before* widening to `i64`. `src-tauri/Cargo.toml` has no
     `[profile]` section, so this **panics in debug** and **wraps to a negative offset in release**.
     `page = 2_000_000_000, pageSize = 2` triggers it.
  2. `sql_query.limit(limit as i64)` passes the value through unchecked. SQLite treats a negative
     `LIMIT` as *no upper bound*, so `pageSize: -1` materialises the entire games table — on a
     multi-million-game Lichess database that is an out-of-memory abort from one renderer call.
* **Why it matters:** this is the most easily reachable defect found in the backend review. It needs
  no crafted file and no adversary — a renderer bug that computes a page number wrongly is enough.
* **Fix shape:** validate both fields at the deserialisation boundary (clamp `page_size` to a sane
  maximum, reject non-positive values, widen to `i64` before multiplying). Applies to all three
  call sites.
* **Found by:** Claude review of the 2026-08-13 audit diff, 2026-08-30. Confirmed by reading the
  expression, the type, the command registration and the absent `[profile]` section — not inferred.

Handled by `d1c2fb34`. `pagination_limit_offset` rejects non-positive and >1000 page/page_size as InvalidInput and computes LIMIT/OFFSET in i64. All three of get_games, get_players, get_tournaments call it. Rejected: silent clamp, changing Specta to u32, renderer-side checks (d-20260831-22).

---

## 2026-08-30 — filed through the inbox spool

### `AtomicFileOutcome` is discarded at four call sites, and one of them deletes the only durable copy

* **ID:** f-20260830-21 · **Status:** handled · **Area:** native-fs · **Root:** durability-outcome-contract · **Entry:** build · **Blocked:** none
* **Where:** producer `src-tauri/src/infra/fs.rs:383,395`; enum declared at `infra/fs.rs:12-13`.
  Eleven consumers disagree. Hard error: `fs.rs:523`, `fs.rs:1225`, `pgn.rs:419`,
  `db/mod.rs:2013`. Treated as success: `credentials.rs:200-205`, `file_workspace.rs:154`,
  `path_authority.rs:3557`. **Silently discarded:** `main.rs:535`, `main.rs:956`,
  `db/search_index.rs:240`, `db/search_index.rs:515`.
* **Defect:** `atomic_replace` returns `CommittedDurabilityUncertain` to mean "the rename landed but
  the parent directory fsync failed" — the caller must decide what that means. Nothing forces the
  decision: `AtomicFileOutcome` is **not `#[must_use]`**, so `atomic_replace(...)?;` compiles and
  throws the outcome away.
* **The verified failure:** `db/search_index.rs:515` copies the legacy search index to the preferred
  location with `atomic_replace(&preferred, ...)?`, discarding the outcome, then line 530 runs
  `std::fs::remove_file(&legacy)`. If durability of the new copy was uncertain, this deletes the one
  copy known to be on disk. A crash afterwards loses the search index entirely.
* **Why it matters:** the type was introduced by the audit precisely to make partial durability
  explicit, and four of eleven callers opted out silently. The design question is real — three other
  callers deliberately treat it as success, and `credentials.rs:200-205` carries a comment arguing
  that erroring would be wrong — so the contract needs deciding once, not eleven times.
* **Fix shape:** mark the enum `#[must_use]` so the compiler forces a decision, then settle the
  contract per call site. `db/search_index.rs:515-530` is a defect under any contract.
* **Found by:** Claude review of the 2026-08-13 audit diff, 2026-08-30. The `search_index` sequence
  and the absent `#[must_use]` were both read directly.

The overlapping promotion site (`search_index.rs` `atomic_replace` then unlink of the legacy sidecar) was fixed under f-20260830-33 / `eb3ddf82`: `promote_legacy_index_sidecar_at` now inspects `AtomicFileOutcome` and leaves the legacy file on `CommittedDurabilityUncertain`. `#[must_use]` and the other ten callers remain this finding.

Handled by `69682c14`. `AtomicFileOutcome` is `#[must_use]`; the compiler then named the remaining silent discards on the current tree: two production sites (native export in `main.rs`, the workspace rename's sidecar rewrite in `file_workspace.rs`) and 19 test sites. Both production sites keep the landed file and return `Error::CommittedDurabilityUncertain` with new stages `NativeExport` / `WorkspaceSidecarReplacement`; the rename rebinds the registry before reporting. The "nothing left to do after the replacement" contract is one function, `infra::fs::require_durable`, routed through by the PGN edit, search-index generation and `SearchIndexChunk::write_to`. Tests assert via test-only `expect_durable`; eight local parent-sync injectors became `infra::fs::ParentSyncFault`. Contract per site recorded in d-20260906-01. Rejected: treating uncertain durability as success at the export site (the user is promised a saved file); erroring without rebinding on rename (the rename landed, so the registry must follow).
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"e2fd57c5be3efa0a7a5f12ffad555a142bcd602e7ea8e34a52bccede00adec11","input_sha256":"95fdbfca4b2c022b9f7c5cab6ac36d62439a6d9c8d6a6c82fa8b1a93abe42ea9","kind":"mutation-receipt","operation":"59a32223735ce9e97fcb0ca25de93ce279eb18615d65830476eb36c82d29e35c","options":{"section":null},"request_id_sha256":null,"results":["f-20260830-21"],"target":"f-20260830-21","v":1} -->

Correction after the Gemini 3.8 Flash review round: the handling commit is `73ba0db2` (the earlier `69682c14` was amended into it), the archive and gzip extraction and the database PGN dump are routed through `require_durable` as well, three rename tests replace the single one, a `PgnEdit` fault test was added, and the decision is d-20260906-03.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"b9279cdf3de241fc46133f840119d9ba476db4094cd0c5f5f43eb9d8486df5b9","input_sha256":"b7bebe2f1783200d5aec14d553cbfacf0debdd424765769294854093bfd563a1","kind":"mutation-receipt","operation":"afa009901dd7bd7db6bc13cbd9eab7e3e2ad00d545f555415dacdd144189e43e","options":{"section":null},"request_id_sha256":null,"results":["f-20260830-21"],"target":"f-20260830-21","v":1} -->

Final hashes after the committer rewrite before push: fix `fbf519cb` (was 73ba0db2), ledger `21c32825`, second-round tests `9d450dc5`, kit vendoring `305c82bd`.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"ab64734387652a9aa73e2bbd96f8eeadec2a72549a13066665383c35cd82749b","input_sha256":"b4082d007c7378b168e9485b51d02adf2234cea260c81873207acae1437ad31f","kind":"mutation-receipt","operation":"8d1df05ff75e9555a6a073282903627e60fb274456c0c4d61bf92d046a826514","options":{"section":null},"request_id_sha256":null,"results":["f-20260830-21"],"target":"f-20260830-21","v":1} -->

---

## 2026-08-30 — filed through the inbox spool

### A second, weaker path authority is still in the tree, dead, behind a file-level `allow(dead_code)` — and a comment asserts it is protecting callers

* **ID:** f-20260830-22 · **Status:** handled · **Area:** native-fs · **Root:** - · **Entry:** inline · **Blocked:** none
* **Where:** `src-tauri/src/infra/path.rs` (236 lines, `#![allow(dead_code)]` at line 1);
  the false comment at `src-tauri/src/db/repository.rs:559`.
* **Defect:** `infra/path.rs` contains `AuthorizedPath` and `PathGrants` — a prefix-allow-list
  authorization model that `path_authority.rs` was built to replace. It is **completely dead**:
  `grant()` and `revoke()` have zero callers anywhere in the crate, so `resolve()` can only ever
  return `None` and the `grant:` branch is unreachable. `PathGrants` is nonetheless a live
  `AppState` field. The only two items in the file with real callers are `safe_canonicalize` and
  `to_utf8_str`, both used from `db/repository.rs`.
* **Second half:** `db/repository.rs:559` reads
  `// AuthorizedPath already does this for command inputs.` — the sole reference to `AuthorizedPath`
  anywhere outside its own file is a comment claiming a security property it does not provide. A
  reader concludes canonicalisation happens upstream. It does not.
* **Why it matters:** the dead module's fallback accepts *any* absolute renderer-supplied path under
  `document_dir`, `download_dir` or `~/EnCroissant`. It cannot be reached today, but it is a
  ready-made bypass of the capability model sitting in the tree with its dead-code warnings switched
  off — which is why it survived. Two competing authorities is also the single most misleading thing
  in the backend for anyone reading it fresh.
* **Fix shape:** move `safe_canonicalize` and `to_utf8_str` to where they are used, delete the rest
  of the file and the `PathGrants` field from `AppState`, and correct the comment.
* **Found by:** Claude review of the 2026-08-13 audit diff, 2026-08-30. Confirmed by grepping every
  caller, not by inference.

Deleted. Commit `eef9148c`. `infra/path.rs` is gone, along with `pub mod path;` and the
`AppState.path_grants` field it backed. The caller map was re-verified over the whole crate
including tests before deleting: `grant()` and `revoke()` had zero callers, so `resolve()` could
only return `None`, and `validate_regular_file`, `validate_directory`, `check_extension`,
`canonical_compare`, `AuthorizedPath::parse`, `as_path` and `into_inner` had none either.

The two live helpers went to their single consumer rather than to `infra/fs.rs` — `d-20260831-08`
records why, and why `safe_canonicalize` was folded into the existing `canonical_database_path`
wrapper instead of arriving beside it under a second name. The false comment at
`db/repository.rs` is replaced by one that says what the function actually does: it normalises for
identity, it is not a containment check, and it tolerates a missing final component.
`CHESS_LOGIC_MAP.md` no longer names the removed field or module.

Coverage: the deletion is a shrink, the shrink-aware baseline forgave it, and the
`app-infrastructure` floor still holds. No baseline or floor was touched; `pnpm gate:ensure
backend-coverage` was part of the phase proof rather than left to the final gate run.

**Regression anchor:** rule R1 of the new `scripts/check-rust-release-surface.mjs` (commit
`f9141425`, `d-20260831-07`). Restoring this module means restoring its file-level
`#![allow(dead_code)]`, which R1 rejects because its allowlist may only shrink; restoring it without
the suppression fails clippy. Four review lenses refused to accept an annotation in place of that
anchor, correctly.

---

## 2026-08-30 — filed through the inbox spool

### The Rust filesystem boundary is convention only — the renderer side is gate-enforced, the native side is not

* **ID:** f-20260830-23 · **Status:** handled · **Area:** gate-scripts · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** no `src-tauri/clippy.toml` exists; `scripts/check-tauri-command-boundary.mjs` and
  `scripts/check-ui-boundaries.mjs` cover only the renderer.
* **Defect:** `infra/fs.rs` exposes `atomic_replace(&Path, ...)` as a `pub` path-taking function,
  called directly from `main.rs:535`, `main.rs:956`, `credentials.rs:196` and
  `db/search_index.rs:515`. It sits *beside* `path_authority.rs` rather than under it, so any code
  in the crate can write any path with no capability check. The invariant that every filesystem
  reach goes through the authority is stated in the module header and enforced by nothing.
* **Why it matters:** this is the leverage item of the whole backend review. The renderer-to-Rust
  boundary has a gate; the Rust-to-filesystem boundary has review only, and review is what already
  missed it. A `clippy.toml` with `disallowed-methods` for `std::fs::*` / `tokio::fs::*` outside
  `infra/`, wired into `lint:ci`, converts convention into a gate and would have caught several of
  the sibling findings at write time rather than three weeks later.
* **Open design question (hence `build`):** which functions belong on the allow-list, whether
  `infra/fs.rs` should stop taking raw `&Path` at all, and how to scope the lint so test modules and
  the primitives themselves are exempt without punching a hole through the rule.
* **Found by:** Claude review of the 2026-08-13 audit diff, 2026-08-30.

**Handled 2026-09-01.** `scripts/check-rust-release-surface.mjs` now enforces R3 (production `std::fs` / `tokio::fs` calls, including module aliases and imported `File::open`) and R4 (pathname `atomic_replace` / `atomic_replace_with_precommit` / `atomic_install_dir` imports, globs, FQNs, turbofish and aliases) outside `src-tauri/src/infra/`. Test-only regions are exempt after a parser fix for multiline and statement-level `#[cfg(test)]`. Enumeration uses `listWorkingTreeFiles` (`pathspec: src-tauri/src`), so untracked leaks fail closed. Nine current production files sit on a shrink-only allowlist with pinned match counts. `clippy.toml` was rejected (`d-20260901-02`). Emptying the allowlist is a native-fs follow-on filed through the inbox.

* **Commits:** `367113a3`
* **Rejected:** clippy `disallowed-methods` as the gate; migrating the 48 sites in this run; `AuthorizedPath` on pathname primitives; a fifth walker; Path-method matching (false positive on `AccountRecord::metadata`).
* **Decisions:** d-20260901-01 slice · d-20260901-02 checker not clippy · d-20260901-03 shrink-only allowlist.
* **Left open:** f-20260830-46, -54, -55 at their filed `inline` tiers.

---

## 2026-08-30 — filed through the inbox spool

### The renderer's native reach is wider than the capability model claims: unmediated asset scope over `$APPDATA`, and unscoped `core:path:resolve`

* **ID:** f-20260830-24 · **Status:** handled · **Area:** bindings-ipc · **Root:** capability-surface-wider-than-claimed · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/tauri.conf.json:75-82`, `src-tauri/capabilities/main.json:15-16`, against the
  invariant stated at `src-tauri/src/infra/path_authority.rs:1-6`.
* **Defect 1 — the asset protocol is enabled over `$APPDATA/**` and is not capability-mediated.**
  `"assetProtocol": { "scope": ["$APPDATA/**", "$RESOURCE/**"], "enable": true }`. There is **no
  ACL permission for the asset protocol anywhere** — not in `capabilities/main.json`, not in the
  generated schemas under `src-tauri/gen/schemas/`, and there is no `register_uri_scheme` handler in
  the crate. The scope is therefore enforced by Tauri's own `scope::fs::Scope` alone and
  `PathAuthority` never sees it. `$APPDATA` is where `credentials/`, `db/`, `engines/`,
  `engine-images/` and `puzzles/` live (`main.rs:684,787,953,1299`, `puzzle.rs:249`). The only thing
  preventing byte-level reads today is that the CSP `connect-src` omits `asset:` while `img-src`
  and `media-src` include it (`tauri.conf.json:82`) — an injected script can still probe existence
  and decodability of those files through `<img>` / `<audio>`.
  **`$APPDATA/**` is also unused scope:** `convertFileSrc` has exactly one production call site
  (`src/utils/sound.ts:88`), fed by `resolveResource`, which resolves under `$RESOURCE`. Engine
  images — the only other `$APPDATA` asset the UI shows — go through the `readEngineImage` command
  instead (`src/components/common/LocalImage.tsx:15`). No `asset://` URL is constructed anywhere.
* **Defect 2 — `core:path:allow-resolve` and `core:path:allow-resolve-directory` are granted and
  unscoped.** Both permissions are documented in the generated ACL manifest as enabling their
  command "without any pre-configured scope", so the renderer can call
  `plugin:path|resolve_directory` with any `BaseDirectory` — AppData, AppConfig, Home — and receive
  the raw native path. That is precisely the information the `PathRef` indirection exists to
  withhold, and it makes the module header "Physical paths never cross the renderer boundary"
  false as written. One production caller genuinely needs it (`$RESOURCE`, for sounds).
* **Why it matters:** these are the two places where the capability model's guarantee is asserted in
  a comment but not enforced by configuration. Neither is exploitable today, but both are one CSP
  edit or one renderer XSS away from mattering, and the first grants reach over the credential
  directory.
* **Fix shape:** narrow the asset scope to `$RESOURCE/**`; decide whether `core:path:resolve*` can
  be replaced by a command that returns a `PathRef`, and if it must stay, correct the module header
  so it stops asserting something untrue.
* **Found by:** Claude review of the 2026-08-13 audit diff, 2026-08-30, verified against the config
  files and the generated ACL schemas.

* **Correction appended 2026-08-30, and it reverses the framing of Defect 1.** Upstream's
  `tauri.conf.json` declares `"assetProtocol": { "scope": ["**"], "enable": true }` — the asset
  protocol over the **entire filesystem**. The audit narrowed that to `$APPDATA/**` + `$RESOURCE/**`,
  so this finding is not a gap the audit opened; it is a large upstream over-grant the audit mostly
  closed and can close completely. `$RESOURCE/**` alone is still the right end state, because
  `$APPDATA/**` has no production consumer. Upstream's `capabilities/main.json` has no `core:path`
  entries in the form this fork uses, so Defect 2 is not directly comparable.
  **Upstream-reportable:** yes, and it is the most serious of the inherited defects found so far.

* **Handled (2026-09-06).** Defect 1: `assetProtocol.scope` is exactly `["$RESOURCE/**"]` (`e7445a8b`). Defect 2: both `core:path` grants are gone; the non-Linux sound route asks the backend for the one bundled file through `sound_resource_path(collection, kind)` — `collection` validated against the eight bundled directories with per-collection kind availability, `kind` a three-variant `SoundKind` — and the `path_authority.rs` header now states that single exception instead of an absolute that was false (`48720827`, `c3da4be4`). Guard: `check-tauri-command-boundary.mjs` refuses `core:path:allow-resolve*` and any `assetProtocol` other than enabled with scope exactly `$RESOURCE/**`; `pnpm verify:app` exercises the refusal in the real window (`plugin:path|resolve_directory` is "not allowed") and the replacement end to end. The CSP is untouched. **Rejected:** one loopback sound server on every platform — measured `#[cfg(not(unix))]` stubs would silence Windows and the platform question is `f-20260830-06`, parked on Felix (`d-20260906-04`); bytes-over-IPC with `blob:` audio — measured `MEDIA_ERR_SRC_NOT_SUPPORTED` for `asset://` media under WebKitGTK; keeping the unscoped grant with an honest header. The measured `blob:` blocking of engine images is `f-20260906-09`. Plan review: eleven rounds (two on the Claude fallback, the rest on Codex and Gemini); diff review on Codex.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"93967a39ca6f84760e5687c8c7100bdcf544fe15a315d4cbed587bab4cc1a70b","input_sha256":"82bded6bcb75e1e5608dd9cd8e81d0ff5ca3d8674f8bd55700ed73ad19888526","kind":"mutation-receipt","operation":"7424c1a472e6442c79c843bdaf422a27b5ad378c489fd02ea025ff1227e11cb3","options":{"section":null},"request_id_sha256":null,"results":["f-20260830-24"],"target":"f-20260830-24","v":1} -->

---

## 2026-08-30 — filed through the inbox spool

### The path-capability migration was never finished: five dead entry points and three unreferenced IPC commands, all invisible behind `allow(dead_code)`

* **ID:** f-20260830-25 · **Status:** handled · **Area:** bindings-ipc · **Root:** capability-surface-wider-than-claimed · **Entry:** inline · **Blocked:** none
* **Where:** `src-tauri/src/infra/path_authority.rs:8` (the file-level suppression), the five
  functions below, and `src-tauri/src/main.rs:1072,1086,1101` with their bindings at
  `src/bindings/generated.ts:303,311,319`.
* **Defect 1 — dead production API.** With the test module starting at `path_authority.rs:3896`,
  production callers across the whole crate are:

  | Symbol | Line | Production callers | Test callers |
  | --- | --- | --- | --- |
  | `read_bytes` | 1408 | 0 | 4 |
  | `read_bounded_bytes` | 1428 | **0** | **0** |
  | `write_bytes` | 1452 | 0 | 1 |
  | `register_downloaded_pgn` | 1579 | 0 | 1 |
  | `register_download_artifact` | 2946 | **0** | **0** |

  Two of them have no caller at all, not even a test, so they are unproven as well as unused. Note
  `read_bounded_bytes` (:1428) is a *different symbol* from the genuinely used
  `read_bounded_bytes_cancellable` (:337, one caller at `game.rs:1943`) — easy to conflate.
* **Defect 2 — the capability-management IPC surface has no consumer.** `list_path_capabilities`,
  `revoke_path_capability` and `promote_path_capability` are registered commands, exported to the
  renderer, and referenced by nothing in `src/` or `e2e/`. Two of the three are mutating, and
  `promote_path_capability` takes an arbitrary `operations: PathOperation[]`. They are reachable by
  any injected renderer script while no legitimate UI path uses them. Reproducing the wider count:
  **8 of 113 commands are unreferenced** — the three above plus `cancelDownload`,
  `getFileMetadata`, `getOpeningFromFen`, `getPuzzleDbInfo`, `setFileAsExecutable`.
* **Why it matters:** the comment at `path_authority.rs:8` reads "Foundation API; command consumers
  are migrated separately" — it describes a migration that never completed, and the file-level
  suppression is why nothing has flagged it in three weeks. The unbounded registry that
  `revoke_path_capability` was presumably meant to prune is a separate open finding.
* **Fix shape:** delete what has no intended consumer; wire up what does; then remove the
  file-level `#![allow(dead_code)]` so the next gap is a compiler warning rather than a review
  finding.
* **Found by:** Claude review of the 2026-08-13 audit diff, 2026-08-30, caller counts verified by
  whole-crate grep separating production from test regions.

* **Handled (2026-09-06).** The file-level `#![allow(dead_code)]` is gone (`48720827`), and with it the checker's shrink-only dead-code allowlist entry (now empty; any new one is an R1 violation). Deleted: `register_downloaded_pgn`, `register_download_artifact`, `read_bounded_bytes`, `write_bytes`, `revoke_dialog`, and the three capability-management commands with their bindings. Test-only: `save`, `read_bytes`, `file_mut`, `descriptors`, `descriptor`, `PathDescriptor`. `allows_delete_sharing_for_operation` keeps a `cfg_attr(not(windows), allow(dead_code))` naming its only production caller and keeps its test everywhere. `READ_TOKENS` keeps its `"read_bounded_bytes"` needle (it still guards `read_bounded_bytes_cancellable`). The `DownloadFile` refusal on a registered artifact moved onto the `reserve_download_artifact` recovery test. Oracle: `cargo clippy --all-targets -- --force-warn dead_code` reports exactly the Windows helper (`d-20260906-05`). Of the five other unreferenced commands: `cancel_download` → `f-20260906-07`, `set_file_as_executable` → `f-20260906-08` (real, never-wired consumers, left registered); the three superseded ones → `f-20260906-11`; a syntactic command-consumer gate → `f-20260906-12` (`d-20260906-06`). **Rejected:** a narrower file-level allow; gating the Windows sealing test; a lexical command-consumer checker (a comment or mock satisfies it).
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"e89b2ec0d2c159f39d98e034c1a2411a869caaf38912121913dd9d90d395e321","input_sha256":"291ddf3cae84a435a5b740468e51b430a686541f7af9d2c1181733aa4b724860","kind":"mutation-receipt","operation":"3809896c4dd2c15df62efd8751cac1237c33f486cacfffac83cbe265e9d6539b","options":{"section":null},"request_id_sha256":null,"results":["f-20260830-25"],"target":"f-20260830-25","v":1} -->

---

## 2026-08-30 — filed through the inbox spool

### `file_exists` demands a write capability to answer a read question, and reports every failure as "file absent"

* **ID:** f-20260830-26 · **Status:** handled · **Area:** native-fs · **Root:** - · **Entry:** inline · **Blocked:** none
* **Where:** `src-tauri/src/fs.rs:1293-1311` (`file_exists`) and `:1320-1337`
  (`get_file_metadata`); the write-class list at `src-tauri/src/infra/path_authority.rs:1432-1444`;
  sole consumer `src/components/engines/EnginesPage.tsx:688-697,715-717`.
* **Defect:** both commands resolve with `PathOperation::EngineInstall`, which
  `is_write_operation` lists as a write class, in order to answer a read-only question. `file_exists`
  then returns `resolve(...).is_ok()`, collapsing "capability revoked", "registry entry lost across
  restart" and "filesystem identity changed" into the same answer as "the file is not there".
* **Scope correction, verified:** this is cosmetic today, not a functional break. The only renderer
  consumer renders a red `"(file missing)"` label beside the engine name; **no re-download or
  reinstall is triggered**, and `get_file_metadata` has no renderer caller at all. It is also not
  unsatisfiable by construction: every `EngineHandle` is minted at the single site
  `path_authority.rs:2187-2191`, which always grants `EngineInstall`.
* **Why it matters:** it becomes a real denial the moment revocation is wired up — `revoke_path_capability`
  is currently unreferenced (see the sibling finding on the unfinished migration), and the first
  thing a revocation feature would do is make a present engine claim to be missing.
* **Fix shape:** introduce or use a read-class operation for existence and metadata, and distinguish
  "denied" from "absent" in the return type rather than flattening both to `false`.
* **Found by:** Claude review of the 2026-08-13 audit diff, 2026-08-30. The originally reported
  consequence (an engine being re-downloaded) was checked against the call site and does not occur;
  the over-demand and the error collapse do.

Handled. Commit `c4fc3002`. A new read-class `PathOperation::EngineBinaryInspect` replaces
`EngineInstall` on `file_exists` and `get_file_metadata`; `d-20260831-04` records why a dedicated
variant was chosen over reusing the already-granted `EngineExecute`, and why the name says
*Inspect* — it is deliberately not accepted by `read_bytes` or `into_read_file`, and a test pins
that.

The load-time backfill is narrow on purpose: `PersistentFile` records whose operation vector is
exactly the legacy engine-file triple. Engine *root* records carry the same three operations and
are `PersistentCustomRoot`; two review lenses showed at 98 and 99 confidence that an unrestricted
backfill would break `get_or_create_engine_root`'s exact-vector reuse and mint a new durable root
capability on every restart — the same unbounded growth `f-20260830-07` is about. A test proves a
reloaded root keeps its exact vector and id. The backfill is idempotent, so `SCHEMA_VERSION` is
unchanged.

The error collapse is closed at both ends. `file_exists` returns `Ok(false)` only for a genuine
`NotFound`; denial and every other failure are typed errors, and neither probe propagates the raw
resolution error — `validate_target` calls `symlink_metadata(path)?` and `Error` serialises its
whole `Display`, so a bare `?` would have put a native path into the renderer.
`get_file_metadata` got the same mapping, which a lens caught as missing at 96.

`EngineName` no longer re-collapses the distinction it was just given: three states, with a
rejection rendering `Common.Error` rather than the missing-file label. Its test drives the real
fetcher rather than mocking SWR, after the first version of that test was found to pass even if the
renderer went back to reporting denials as "file missing".

**Not done here, and filed:** the label still cannot distinguish denial from an unknown handle from
a replaced object — all three render one string. The hardcoded English literal that sat beside it is
fixed (`Engines.FileMissing`, sixteen catalogues, commit `2565ee3d`).

---

## 2026-08-30 — filed through the inbox spool

### The engine manifest is transport-trusted and supplies a path component, while its signature fields protect a different value

* **ID:** f-20260830-27 · **Status:** handled · **Area:** native-fs · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src/utils/engines.ts:104-113` (schema) and `:172-179` (fetch),
  `src/components/engines/AddEngine.tsx:220-228`, guarded by
  `src-tauri/src/infra/path_authority.rs:2338-2356` and `validate_components` at `:3436-3459`.
* **Defect:** the default-engine manifest is fetched from `https://www.encroissant.org/engines` and
  validated client-side by `defaultEngineManifestSchema`, in which `path` is constrained by nothing
  but `z.string().min(1)` — no traversal, separator or absolute-path rejection. That string is passed
  straight to `registerInstalledEngine`, where it decides the path component an executable is
  registered from. The manifest as a whole is **never signed**: the per-entry `sha256` and
  `signature` fields cover the downloaded archive and are passed only to `downloadEngineArchive`, so
  they give no assurance about `path` at all.
* **Verified as stopped today:** traversal does not succeed. `register_installed_engine` rejects any
  component that is not `Component::Normal` (`path_authority.rs:2346`), and `validate_components`
  independently rejects empty, `.`, `..`, multi-component names, and on unix any `/` or NUL byte.
* **Why it matters:** the entire defence is those two backend checks, with nothing in front of them.
  Anyone controlling or MITM-ing `www.encroissant.org` writes a value that reaches path resolution,
  and the adjacent `sha256`/`signature` fields make the manifest look authenticated when the field
  that matters is not. Weakening either backend check turns this into arbitrary-path engine
  registration with no second line of defence — and this repository already documents signed
  download manifests (`docs/signed-download-manifests.md`) for the archive, so the asymmetry is
  visible in its own docs.
* **Open design question (hence `build`):** sign the manifest itself, or constrain `path` in the
  client schema to a single normal component, or both. The second is cheap and immediate; the first
  is the actual fix.
* **Note for upstream:** the manifest endpoint and its trust model are inherited from upstream
  unchanged — this is not a defect the audit introduced.
* **Found by:** Claude review of the 2026-08-13 audit diff, 2026-08-30.

Handled for the half this repository can close; the other half is filed rather than pretended away.

Commit `1c307330`. The client schema now rejects everything the backend would reject — NUL,
backslash, a leading `/`, a Windows drive prefix, empty segments from a doubled or trailing slash,
and any `.` or `..` segment — and is commented as defence in depth in front of `Component::Normal`
and `validate_components`, which remain the containment boundary. `docs/signed-download-manifests.md`
is retitled and carries an authentication-scope section, and the same statement sits as a comment
beside the schema and the fetch. `defaultEngineManifestSchema` is exported so its test can reach it.

**This finding's own suggested fix was wrong and is rejected with evidence.** Constraining `path` to
a single normal component would reject every real engine entry: `AddEngine.tsx` computes
`engine.path.split("/").at(-1)`, and `register_installed_engine` folds *every* normal component onto
the engine root. Recorded as `d-20260831-03`.

**Signing the manifest is not done and is not claimed.** This fork does not serve
`www.encroissant.org`, and `d-20260830-15` (Felix, 2026-08-30) defers the fork's self-hosted engine
manifest and download page to a later run — so a document signature cannot be produced from here.
A review lens objected at confidence 96 that the client constraint hardens a symptom without
authenticating the state that produced it, and it is right; that is why the signing work is filed as
its own finding, with `d-20260830-15` named as its precondition and the existing `minisign-verify`
machinery named as what it can reuse.

**Also found while here, and filed separately:** the operation class that decides whether a download
must be signed at all is derived from a renderer-supplied `id` string prefix.

---

## 2026-08-30 — filed through the inbox spool

### The error taxonomy collapses distinct backend failures, and `diagnostic` is a byte-identical copy of the message it is meant to explain

* **ID:** f-20260830-28 · **Status:** handled · **Area:** frontend-ui · **Root:** platform-error-redaction · **Entry:** build · **Blocked:** none
* **Where:** `src/platform/errors.ts:57-73`, against the real literals in `src-tauri/src/error.rs:93,101,104,113`;
  rendered at `src/components/ErrorComponent.tsx:17-20`; bypassed at `src/routes/__root.tsx:100-104,115-120`.
* **Defect 1 — substring matching mis-routes live variants.** Verified by running `normalizeError`
  on the actual `#[error(...)]` strings:
  - `Error::EngineTimeout` renders `"Engine timeout: …"` and matches the `network` branch
    (`errors.ts:63`). It is live at `chess.rs:1065`, wrapping a real UCI handshake wait — so **a hung
    local engine is reported to the user as a connectivity problem.**
  - `Error::Conflict` (live at `fs.rs:52,595,597,655`) and `Error::ResourceLimit` (live at
    `lichess.rs:94,98,120,124`) both fall through to `unexpected`.
  - The `"cancel"|"abort"` test runs *before* `network` (`errors.ts:61`), so `"connection aborted"`
    is categorised `cancelled` — a transport failure presented as a user cancellation.
  - `Error::CredentialOperationRequiresRecovery` also lands in `unexpected`, but it is a **dead
    variant**: no construction site exists outside `error.rs`.
* **Defect 2 — `diagnostic` carries no diagnostic.** `errors.ts:73` returns
  `{ category, message, diagnostic: message }` — the same binding. This is worse than dead surface:
  `ErrorComponent.tsx:17-20` renders it in a `<Code>` block **with a copy button**, presenting it as
  the technical detail behind the human message. A user copying "the details" for a bug report
  copies the sentence already on screen. There is no channel from the unredacted cause to any
  diagnostic surface anywhere in the layer.
* **Defect 3 — two error-presentation conventions in one file.** `__root.tsx:119` and `:100-104`
  show `error.message` directly, bypassing `normalizeError`. `TauriCommandError` messages are
  already redacted by `tauri.ts:22`, but any non-facade rejection — a raw `@tauri-apps` error from
  `ask`, `exit`, `platform` or the updater, all imported at `__root.tsx:4-9` — is displayed verbatim,
  which is exactly the path the redaction patterns exist to cover.
* **Open design question (hence `build`):** the categoriser should match on a discriminant the
  backend sends, not on substrings of a prose message that was redacted first. That is a change to
  the `Error` type and the IPC contract, not a tweak to a regex.
* **Found by:** Claude review of the 2026-08-13 audit diff, 2026-08-30, verified by executing
  `normalizeError` against the real Rust literals under vitest.

* **Handled 2026-09-01.** Owned `#[error]` prefixes from `error.rs` are matched before generic English words. `Engine timeout:` is `unexpected`, `connection aborted` is `network`, Conflict/ResourceLimit/turn-state strings are `validation`, credential/OAuth failures are `permission`, missing-resource strings are `not-found`. No new `AppErrorCategory`. `ErrorComponent` no longer presents a byte-identical diagnostic.
* **Commits:** `838b7104`, `34a8be0c`
* **Rejected:** a Specta `Error` type (`f-20260830-08` / `d-20260830-05`); adding categories that ConfirmModal interpolates into missing locale keys (`f-20260830-11`).
* **Decisions:** d-20260901-34 owned prefixes on existing categories.

---

## 2026-08-30 — filed through the inbox spool

### The already-normalised error is thrown away and recomputed at seven sites, and a destructive-operation guard survives only by accident

* **ID:** f-20260830-29 · **Status:** handled · **Area:** frontend-ui · **Root:** platform-error-redaction · **Entry:** build · **Blocked:** none
* **Where:** `src/platform/tauri.ts:17-25` (`TauriCommandError.details`), and the seven consumers
  `SettingsPage.tsx:144`, `ConfirmModal.tsx:11`, `FilesPage.tsx:336`, `AddPuzzle.tsx:41,107`,
  `Puzzles.tsx:425`, `ErrorComponent.tsx:9`.
* **Defect:** `TauriCommandError` computes an `AppError` and stores it as `.details`. Grepping the
  whole renderer for `.details` returns exactly one hit — the assignment itself. Every consumer
  instead calls `normalizeError(error)` **again** on the already-normalised error, recomputing the
  category from the lossy redacted message rather than reading the correct one that is already
  attached.
* **Why it matters — the guard that is at risk.** `FilesPage.tsx:336` reads
  `normalizeError(cause).category === "applied-despite-error"`, and the comment three lines above
  states what is at stake: *"`applied-despite-error` means files were destroyed even though this
  failed."* Re-normalisation is stable there **only because** the two Rust literals that produce
  that category (`"Partially removed: …"`, `"Committed but durability uncertain: …"`) happen to
  contain no `/` and no secret pattern, so `redact` leaves the matched prefix untouched on the second
  pass. Reword either variant so its text contains a path — which is the natural thing to do when
  improving an error message — and the destructive-operation guard silently degrades to `unexpected`
  and stops warning the user that files were destroyed.
* **Fix shape:** read `error.details` when the error is a `TauriCommandError` instead of
  re-normalising; keep `normalizeError` for the genuinely unknown-shaped case.
* **Found by:** Claude review of the 2026-08-13 audit diff, 2026-08-30. Idempotence of the two
  load-bearing literals was measured, not assumed.

* **Handled 2026-09-01.** `normalizeError` returns an `AppError` unchanged and returns `TauriCommandError.details` when present. The command proxy rethrows an already-wrapped `TauriCommandError` instead of wrapping twice. Consumers keep calling `normalizeError`.
* **Commits:** `838b7104`, `34a8be0c`
* **Rejected:** rewriting the seven call sites to read `.details`.
* **Decisions:** d-20260901-35 idempotent normalizeError and omitted diagnostic.

---

## 2026-08-30 — filed through the inbox spool

### Every listener registration failure in the renderer is invisible, and one subscriber writes parent state after unmount

* **ID:** f-20260830-30 · **Status:** handled · **Area:** frontend-state · **Root:** - · **Entry:** inline · **Blocked:** none
* **Where:** `src/platform/useTauriListener.ts:13-15,20,31-33,38-44`; all eight call sites
  `BoardGame.tsx:660,683,699`, `EvalListener.tsx:206`, `Databases.tsx:128`, `AccountCard.tsx:155`,
  `useConversionProgress.ts:27`, `useProgress.ts:58`.
* **Defect 1 — `options.onError` is dead surface.** The hook falls back to
  `console.error` when no `onError` is supplied (`:43`). **None of the eight call sites supplies
  one** — verified by inspecting every call. In a packaged Tauri build there is no devtools console,
  so a subscription that fails to register presents as an eval bar, a progress bar, or a clock that
  simply never updates, with no error surfaced anywhere. All seven Specta event subscriptions in the
  application are affected.
* **Defect 2 — `AccountCard.tsx:155` passes an `async` callback into a `(event: T) => void` slot.**
  The hook discards the returned promise (`:31-33`), so it is never awaited and never caught, and
  the `disposed` guard at `:32` is evaluated **once, before entry**. At `AccountCard.tsx:160`,
  `setDatabases(await getDatabases())` runs after an unbounded await and writes into the *parent's*
  state — the exact stale write the guard exists to prevent — while a rejection there becomes an
  unhandled promise rejection.
* **Note:** the hook itself is otherwise sound and well tested; these are contract gaps at its edge,
  not defects in its disposal logic.
* **Fix shape:** either make `onError` required, or route the fallback to a user-visible surface;
  and change the callback slot to accept and await a promise, re-checking `disposed` after it.
* **Found by:** Claude review of the 2026-08-13 audit diff, 2026-08-30, verified by inspecting all
  eight call sites.

* **Handled:** `useTauriListener` requires `onError`, awaits async callbacks, and passes an `AbortSignal`. Every production site uses `notifyListenerError`. AccountCard checks `signal.aborted` before `setDatabases`. Proof: `tsgo --noEmit` plus `useTauriListener.test.tsx`, `notifyError.test.ts`, `AccountCard.test.tsx`.
* **Commits:** `8d754b0e`, remediations in `ddea3a56`.
* **Rejected:** importing Mantine into `src/platform/`; relying on a post-await disposed check in the hook alone.

---

## 2026-08-30 — filed through the inbox spool

### The renderer chooses the URL path for Lichess requests, and every call rebuilds the HTTP client

* **ID:** f-20260830-31 · **Status:** handled · **Area:** oauth-credentials · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/lichess.rs:145-149` (validation + interpolation), `:202-210` (the
  post-hoc check), against the correct helper `exact_url` at `:56-70`; client at `:47-55`.
* **Defect 1 — renderer-controlled path.** `PublicLichessRequest::Account { username }` is validated
  only for `1..=80` bytes, then interpolated: `format!("/api/user/{username}")`, applied by
  `url.set_path(&path)` at `:202`. The check at `:204-207` validates scheme, userinfo, password and
  fragment — **not the path, and not the host**. `username = "../account"` normalises to
  `/api/account`. `exact_url` exists for exactly this and pins host, port and path; it is used at
  `:239` and `:288` but not here.
* **Scope, verified — this is not token exfiltration.** `set_path` never re-parses the authority, so
  the host cannot be changed, and `public_json` (`:111-112`) attaches **no** credential — the bearer
  path is the separate `authenticated_json` at `:86`, which is only ever called with `exact_url`
  results. The real shape is: renderer-controlled fetch of any path on `lichess.org`, response
  returned to the renderer as a string, bounded at 5 MB. SSRF-shaped against a fixed host.
* **Defect 2 — `client()` (`:47`) runs a full `reqwest::Client::builder()` per request**, at `:86`
  and `:112`, rebuilding TLS configuration, the connection pool and the custom `SafeResolver` every
  call, so no keep-alive is ever reused. `AppState` holds a shared transport (`main.rs:404-405`) but
  it is an `Arc<dyn DownloadTransport>` rather than an exposed client, and
  `get_public_lichess_json` takes no `State` — so reuse needs an accessor, which is why this is
  `build` rather than a one-line change.
* **Fix shape:** route the account request through `exact_url` with the username as a validated
  single path segment; expose the shared client.
* **Found by:** Claude review of the 2026-08-13 audit diff, 2026-08-30. The no-host-change and
  no-credential corrections were verified against the `url` crate's `set_path` and the two request
  helpers, not assumed.

* **Handled:** Public Lichess Account URLs go through `lichess_user_segment` (`[A-Za-z0-9_-]{2,30}`) and generalized `exact_url` that pins host/port to the intended base, so `../account` is `InvalidInput`. JSON and OAuth share `AppState.json_http_client` (10s/30s/30s); `fn client()` and `fn provider_http_client()` are gone. Proof: `public_account_url_rejects_traversal_and_invalid_usernames`, `json_and_oauth_requests_reuse_the_app_state_client`.
* **Commits:** `60192478` (URL pin + shared client), `3a1b856d` (named timeouts, stable JSON errors).
* **Rejected:** Reusing `ProdTransport`'s 3600s download client for JSON.

---

## 2026-08-30 — filed through the inbox spool

### Two native reads are unbounded in practice: a metadata sidecar that follows symlinks, and an engine image read after a TOCTOU window

* **ID:** f-20260830-32 · **Status:** handled · **Area:** native-fs · **Root:** unbounded-native-reads · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/file_workspace.rs:110-118` (`metadata_from`) against its correct sibling
  at `:223-227`; `src-tauri/src/infra/path_authority.rs:2283-2305` (`read_engine_image`) against the
  two correct bounded readers at `:337-370` and `:1428-1443`.
* **Defect 1 — the `.info` sidecar has neither a symlink check nor a size bound.** `sidecar.exists()`
  and `fs::read(sidecar)` both follow symlinks, and nothing limits the byte count. The sidecar name
  is derived by string manipulation (`info_path`, `:103-108`, via `with_file_name`) and is never
  resolved through the path authority. The `.pgn` file beside it **is** correctly guarded —
  `fs::symlink_metadata` at `:223` with an explicit `is_symlink()` refusal. Reachable from
  `list_file_workspace` (`:333`) through `tree_entry` (`:277`) and the recursive walk at `:244`, so a
  `game.info` symlink in a workspace directory makes a plain directory listing read an arbitrary
  file of arbitrary size into memory — and any JSON-shaped target is then deserialised into
  `WorkspaceMetadata` and handed to the renderer.
* **Defect 2 — `read_engine_image` checks the declared size, then reads unbounded.** It calls
  `file.metadata()?.len()`, rejects if over the limit, allocates with that capacity, and then runs
  `file.read_to_end(&mut bytes)` with **no limit**, checking the length only afterwards. A file that
  grows between the `metadata()` call and the read is fully allocated before rejection. The correct
  pattern is in the same file twice: the chunked loop at `:352-370`, and `.take(max+1)` at `:1442`,
  whose doc comment states it exists so "a sparse or concurrently growing file cannot force an
  allocation".
* **Correction to how this was first reported:** the three readers are not a progression from strong
  to weak — `git log -L` shows all three landed in the same commit `97c29add`. One change shipped
  three divergent copies of the same idea at once, which is the more useful fact: it is a
  consistency failure inside one diff, not drift over time.
* **Found by:** Claude review of the 2026-08-13 audit diff, 2026-08-30.

**Handled 2026-09-06 (Codex):** 7a4d6fc8 shares bounded cap-plus-one consumption across metadata, images and opening books. Metadata opens no-follow relative to the retained authorized PGN parent; only absence defaults. The 1 MiB serialized-byte cap is checked before create/rename mutations. Regular-file acquisition refuses FIFO swaps. Root proof: `cargo test --manifest-path src-tauri/Cargo.toml --locked` passed (660 passed, 1 ignored), format and diff checks passed. Production metadata/image consumed-byte assertions failed when the bound was deliberately weakened and passed after restoration. Decision d-20260906-07 rejects pathname prechecks and post-read-only limits.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"6acf28f7db47738324bd127d157fa639c5bb39dcaac30b65e216d6c8d5de49e1","input_sha256":"03c7723242ede351a20e648a7444b05787cabb2b277ec8de14e4ebf7cc2be5d8","kind":"mutation-receipt","operation":"155bf80c6ee36e9e6eaa229c4b9f5a922e82b7196a8135039c82de016c94f865","options":{"section":null},"request_id_sha256":null,"results":["f-20260830-32"],"target":"f-20260830-32","v":1} -->

---

## 2026-08-30 — filed through the inbox spool

### `search_position` performs a create, fsync and unlink while holding only a `DatabaseRead` capability

* **ID:** f-20260830-33 · **Status:** handled · **Area:** db-search · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/db/search.rs:482` (the capability), `:504` and `:167` and `:209` (the
  paths reached), `src-tauri/src/db/search_index.rs:515` (write) and `:530` (unlink), `:240`
  (regeneration write); the write-class list at `src-tauri/src/infra/path_authority.rs:1472-1481`.
* **Defect:** the command resolves with `PathOperation::DatabaseRead`, which `is_write_operation`
  deliberately excludes. From there `load_search_index` reaches `promote_legacy_index_sidecar`,
  which **writes** `<db>.ecsi` via `atomic_replace` and then **unlinks** the legacy sidecar, and
  `generate_search_index` writes the index outright. `DatabaseMutate` already exists in the enum
  (`path_authority.rs:515`) and is not used here.
* **Second half — the sidecar paths bypass the authority entirely.** They are derived by string
  manipulation from the canonicalised database path: `get_index_path` uses `with_file_name`
  (`search_index.rs:461-470`) and `legacy_index_path` uses `with_extension` (`:477-478`). Neither
  goes through fd-relative resolution, so the capability model does not mediate the files it
  creates and deletes — only the database file it was granted.
* **Why it matters:** a read-only capability is the one thing a user or a future revocation feature
  can rely on to mean "this cannot change anything on disk". Here it deletes a file.
* **Fix shape:** require `DatabaseMutate` for the promotion and regeneration paths, and resolve the
  sidecar through the authority rather than deriving it as a string.
* **Found by:** Claude review of the 2026-08-13 audit diff, 2026-08-30.

Handled by `eb3ddf82`. load_search_index keeps DatabaseRead for a valid preferred sidecar; promotion and generation re-resolve DatabaseMutate. Sidecar mutation uses PathAuthority::database_file_target (retained parent fd) plus atomic_replace_at / remove_optional_regular_at. Uncertain durability no longer unlinks the legacy copy. SearchIndexReplacement was added to DurabilityStage and bindings regenerated. The overlapping AtomicFileOutcome discard at promote (also named by f-20260830-21) is fixed here; #[must_use] and the other callers stay on 21. Rejected: always-Mutate on search; returning a PathBuf for callers to reopen (d-20260831-23).

---

## 2026-08-30 — filed through the inbox spool

### Lichess tokens are written to an in-process mock store and can never be read back — the `keyring` crate has no backend compiled in

* **ID:** f-20260830-34 · **Status:** handled · **Area:** oauth-credentials · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/Cargo.toml:79` (`keyring = "3.6.3"`, no features),
  `src-tauri/src/credentials.rs:106-112` (`OsCredentialStore::get`), `:289-294` (`token`),
  wired in as the production store at `src-tauri/src/main.rs:1371`.
* **Defect:** the dependency is declared with **default features only**, and `keyring` 3.x enables no
  platform backend by default. `Cargo.lock` proves it — the resolved dependency list for `keyring`
  is exactly `log` and `zeroize`: no `secret-service`, no `linux-keyutils`, no native backend for any
  platform. keyring's own `lib.rs` then falls back to `pub use mock as default` for Linux, macOS
  **and** Windows when none of `linux-native` / `sync-secret-service` / `async-secret-service` /
  `apple-native` / `windows-native` is set. No `set_default_credential_builder` call exists anywhere
  in the crate to override it.
* **Consequence:** the mock store keeps the password *inside the `Entry` object*. `OsCredentialStore`
  constructs a fresh `Entry` on every `set` and every `get` (`credentials.rs:107`), so each write goes
  into a throwaway object and every read misses. `Entry::get_password` returns `NoEntry`, which
  `credentials.rs:109` maps to `Ok(None)`. **A stored Lichess token is therefore never retrievable —
  on any platform, in debug or release.** Empirically reproduced in a standalone crate pinned to the
  same version and features: `set` succeeds, a read from the same `Entry` returns the value, and a
  read from a new `Entry` returns `NoEntry`.
* **Why it matters:** this is a live, user-visible functional defect, not a latent hazard. Every
  feature behind a Lichess account token — the authenticated fetches at `lichess.rs:86` and the
  game download at `fs.rs:885` — silently behaves as if no account were linked. Nothing fails loudly,
  because "no token" is a legitimate state.
* **Not inherited:** `git show upstream/master:src-tauri/Cargo.toml` has **no keyring dependency at
  all**. This was introduced by the 2026-08-13 audit and is the audit's own regression, not an
  upstream bug. It is therefore not upstream-reportable.
* **Open design question (hence `build`):** which backend per platform, and how to reach it without
  blocking. Enabling `sync-secret-service` makes `token()` a real D-Bus round trip that can show an
  unlock prompt — and it is currently called inline from `async fn` at `lichess.rs:82-84` and
  `fs.rs:885-887`, so the same change that fixes storage creates a Tokio-worker stall unless the call
  is offloaded in the same diff.
* **Found by:** Claude review of the 2026-08-13 audit diff, 2026-08-30. Found by *refuting* a
  different claim (that the keyring call blocks on D-Bus) — the mechanism alleged there cannot occur,
  and establishing why exposed this.

* **Handled:** `keyring` now enables `sync-secret-service`, `crypto-rust`, `apple-native`, and `windows-native`. `OsCredentialStore` still builds a fresh `Entry` per call, but a real backend makes that work. Async `token`/`store`/`remove` run on `BlockingGateway::spawn_cancellable`. Startup chmod of app-data/registry uses `O_NOFOLLOW`. Proof: `keyring_lockfile_includes_a_platform_backend`, `async_store_methods_do_not_run_on_the_caller_thread`, symlink-refusal tests. Default suite does not write a live Secret Service item.
* **Commits:** `575ea99a` (backend + offload), `3a1b856d` (shared spawn helper).
* **Rejected:** `linux-native` (d-20260830-14); `crypto-openssl` (d-20260831-21); default-suite D-Bus round-trip (unlock prompt / CI without a session bus).

---

## 2026-08-30 — filed through the inbox spool

### The path registry grows without bound, `revoke_path_capability` cannot prune it, and one operation-list edit orphans every persisted root

* **ID:** f-20260830-35 · **Status:** handled · **Area:** native-fs · **Root:** unbounded-path-registry · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/infra/path_authority.rs:1489-1492` (the two maps), `:1828-1837`
  (dialog bounding), `:1864-1866` (`revoke_dialog`), `:3361-3372` (the only persistent removal),
  `:1991`/`:2033`/`:2073`/`:2111` (the identity comparisons), `:3786-3790` (the latent directory
  bug); command surface at `src-tauri/src/main.rs:1086-1096`.
* **Defect 1 — only `dialogs` is bounded.** `dialogs` has a capacity and an eviction pass;
  `persistent` has neither. The single removal path is `remove_workspace_entry`, which takes a
  `FileWorkspaceHandle` — so database roots, puzzle roots, engine roots, engine resources, opening
  books, engine images and persistent files have **no removal path at all**. Every distinct file or
  directory ever opened enlarges the registry permanently.
* **Defect 2 — the renderer-facing revoke cannot prune any of it.** `revoke_path_capability`
  delegates to `revoke_dialog`, which touches `dialogs` only and returns `false` for every persistent
  id — while `descriptors()` (`:1736-1751`) lists persistent entries first. The command is exported
  (`generated.ts:311`) and, per the sibling finding on the unfinished migration, has no consumer
  anyway.
* **Defect 3 — cost.** Every insertion clones the whole `BTreeMap` (13 production sites), then
  re-serialises **all** entries and commits through `atomic_replace`, which does two `sync_all()`
  calls. The syscall count per commit is constant, but the payload cloned, serialised and fsynced
  grows linearly, and `refresh_persistent()` stats every entry on each `descriptors()`/`resolve`.
  Per-operation cost is O(n); session cost O(n²).
* **Defect 4 — identity is order-sensitive vector equality.** The four `get_or_create_*_root`
  lookups compare `entry.stored.operations == operations`, an elementwise `Vec` comparison over a
  literal built at each call site. Appending or **reordering** one `PathOperation` in a future
  release makes every persisted root miss, and the fallthrough inserts a duplicate under a fresh
  `PathRef` without removing the old one — which, given Defect 1, is permanent.
* **Defect 5 (latent) — wrong-directory capability.** At `:3786-3790`, `directory` is set to `handle`,
  which only advances for non-final components (`:3759`). If the final component is a directory,
  `directory` is its **parent** while `target` is the child. Unreachable today: the only reader of
  that field is `engine_resource` (`:2247`), whose sole `resolve` call passes empty components. The
  first caller that resolves a subdirectory gets the wrong directory silently.
* **Found by:** Claude review of the 2026-08-13 audit diff, 2026-08-30.

Source revalidation during plan review, 2026-09-06: database deletion now calls PathAuthority::remove_database and prunes its entry, so the original all-classes no-removal wording is partly historical. Remaining live production gaps include single PGN/export grants, old workspace/active-root selections, executable/opening-book grants, completed download grants and puzzle deletion. In particular puzzle.rs:453-481 physically deletes via ResolvedPath and invalidates its cache without removing the persistent PathAuthority entry; get_or_create_persistent_file then conflicts when the same path is recreated with a new inode. These are the same missing persistent-owner/release mechanism, not reasons to close this finding with a hard admission cap alone. The plan is being revised for typed owner reachability and explicit known-removal cleanup. No source implementation or handled status yet.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"f0d463134eaa9d5120d023e066e3b7001d0a2cb8f3ed4b4664db93b312e297a7","input_sha256":"7da5dbdd226605eca1b2dd42cd1026d415510dd4b3c81628c2047fa96cee0971","kind":"mutation-receipt","operation":"19b196ccde517f68c5c4b62b2192d8ef2b24a8cdab70d1b16e21dde76af3e3b5","options":{"section":null},"request_id_sha256":null,"results":["f-20260830-35"],"target":"f-20260830-35","v":1} -->

Root phase-1 integration traced both production download/provider artifact reservations in src-tauri/src/fs.rs (ReadPgn-only vectors at lines 794 and 947 on the task base). They require their own read-only PGN purpose in the reclaimable owner map; mapping only ReadPgn+WritePgn leaves finalized downloaded artifacts permanently unknown/unreclaimable. Preserve read-only rights and test reserve/finalize/reload/trusted-sweep plus retained survival. This is a required sibling of the selected registry accumulation cause, not a new feature or authority widening.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"f1a3a66a2fa82b9ff802e82021319fa40caf7bb916c21e7d2265cf7759d2a804","input_sha256":"04aa3ddd6bc253b98a20f56b0086fdf11f19a3cd5c11df1567b80462262440de","kind":"mutation-receipt","operation":"1bac7aaaf3a4b11a3f704e346fd80d52d9be4a2361faf69c3113f3b09324a3cc","options":{"section":null},"request_id_sha256":null,"results":["f-20260830-35"],"target":"f-20260830-35","v":1} -->

* **Integration finding (2026-09-06, Codex, confidence 98):** `reconcile_startup_owners` rejects more than 4096 retained IDs at `src-tauri/src/infra/path_authority.rs:3696`, and `reconcile_engine_attachments` applies the same fixed count at `:3812-3816`. Valid legacy registries above 4096 IDs are intentionally loadable and may shrink or stay equal (plan line 21), but a complete trusted owner snapshot above that count is rejected before any non-growing operation can run. The renderer prepares the entire engines/player union before writing, so even removing one owner from a 4098-attachment legacy set produces 4097 retained IDs and refuses the save. Existing `attachment_prepare_allows_non_growing_readoption_from_an_overlimit_legacy_state` submits only one ID and does not cover the full-owner protocol. Fix the request-bound/admission interaction without allowing unbounded input or registry growth, and prove the complete legacy snapshot plus a shrinking owner update. This is required by the existing grandfathered-state contract, not a new product decision.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"6f0a617228e15146d9e6920fa4bdd9ca4a45f6de9e65285920dbe93be5ea197c","input_sha256":"33d784fa58560a7031b6cb16df904d4aaf25b337a4a485b1f63bffd3abec8f60","kind":"mutation-receipt","operation":"93420da09497763240abeee5df69b2683b806aec666b6fa72486eb3fc2dd9165","options":{"section":null},"request_id_sha256":null,"results":["f-20260830-35"],"target":"f-20260830-35","v":1} -->

* **Final root-cause review (2026-09-06, Codex Luna Extra High, confidence 88):** `reconcile_startup_owners` treats equal candidate length as Durable after an earlier uncertain replacement adopted the pruned map, then marks families complete without re-establishing registry durability (path_authority.rs:3750). Root adopts a real durability retry fence for startup just as for attachment prepare: an injected parent-sync uncertainty followed by an identical retry under an I/O fault must not report success; a later durable retry marks completion and survives reopen. Preserve truthful adopted state and avoid redundant writes for ordinary already-durable no-ops.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"66cc0b384485723c737e12e0435ad412a9dfe0db72ab54b7885ba22c45ccf967","input_sha256":"3ee1df47da920057d76919b8c42fc3d821f4d8ddd9efbfad549906a78b17167e","kind":"mutation-receipt","operation":"bdc7df847ebc4e5857e6a4220178d81c01f5453b08a3b6c6e6c2efac4204b520","options":{"section":null},"request_id_sha256":null,"results":["f-20260830-35"],"target":"f-20260830-35","v":1} -->

* **Final minimalism review (2026-09-06, Codex Luna Extra High):** Root adopts shared candidate/current registry snapshot and admission accounting rather than the duplicate calculation in validate_attachment_admission (path_authority.rs:3980) and save_entries_with (:5141). The current-state input must remain the actual pre-mutation attachment metadata, not the candidate maps, preserving the over-limit legacy no-growth fix. Test the real unique-ID union, byte limits, pending bound and rollback state after extraction. Also route the two shutdown tests directly through the production generic teardown function instead of its test-only no-op wrapper.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"92ca02e5e28faa98d08f5aba7ad597f80c81fbf5a53e3019f8515eecfa942faa","input_sha256":"bcc3f177bd04bd56411eb919573548607c64affbc0fb09d31977a09784d244c2","kind":"mutation-receipt","operation":"ca492a8423c5cedbf4c80505ba15a683e92cdbeef5934bb4e22792429f9754cb","options":{"section":null},"request_id_sha256":null,"results":["f-20260830-35"],"target":"f-20260830-35","v":1} -->

* **Final error-handling review (2026-09-06, Codex Luna Extra High, confidence 98):** Physical puzzle database deletion succeeds before remove_puzzle_database registry cleanup can fail. Native code invalidates the cache but returns that ordinary failure; Puzzles.tsx only removes its selected/listed entry on success. Root traced both branches. Fix the applied-despite-error result and renderer convergence using the established typed destructive-operation contract, preserving visible cleanup failure and proving pre-delete failure versus landed deletion plus failed registry cleanup. This is required integration of the new authority pruning, not a separately deferred area.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"6b9f8484e0de6250c9594859de4aa8f1adb2b07a7beee399ed6fc6f30139a442","input_sha256":"126d039c83429c1d22a02d3b66450de5af8c2b8f419e24db1a6e163fa424b4b8","kind":"mutation-receipt","operation":"202d4986b2f79fa73116f2e79e23dc49ce562456c26d3fda2d4472596fc550f5","options":{"section":null},"request_id_sha256":null,"results":["f-20260830-35"],"target":"f-20260830-35","v":1} -->

Handled 2026-09-06 by 4494070f and final integration 806005f1/c0f4b341/6422009f. Schema-1 purpose metadata stabilizes root/file IDs across canonical operation changes; a shared admission snapshot bounds unique retained authority, artifact intents, serialized bytes and legacy reader consumption while allowing non-growing legacy convergence. Single-ID refresh touches only its target, final-directory resolution retains the child descriptor, and trusted original-storage owner snapshots reclaim stale grants without treating offline status as abandonment. Issued/reissued/used grants, active roots, pending work and untrusted owner families remain protected. Puzzle deletion prunes authority and reports already-applied cleanup failure truthfully. The obsolete generic revoke command stays removed under d-20260906-05 rather than being recreated. Root phase proof and final 159 path-authority, 55 filesystem, 17 puzzle and associated frontend tests passed. Actual pnpm verify:app passed automatic startup reclamation, owned-root survival and no user-file deletion; the fixture invokes no startup-reconciliation command to obtain that result. Screenshot and full log are /tmp/chessfable-path-ownership-OMFFz4/path-ownership-real-app.png and root-real-app-fix3.log. Decisions d-20260906-09/-10 and -15 record the technical contracts and reversal paths. All eleven cumulative lenses are triaged; full clean-tree push gates remain the release boundary.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"28d72c5c9ef36d2f1324b593bbfad974d94e770c778ef09c7371ba0902cdc6d3","input_sha256":"500b42f7b0b6bc124caa6079596144ff33b25bbee0ed896c16af22aa6e79af56","kind":"mutation-receipt","operation":"26cabbf87242d4ced5e15f425bcd10bfc17b78eeec1f90b30154d2167ffe6d56","options":{"section":null},"request_id_sha256":null,"results":["f-20260830-35"],"target":"f-20260830-35","v":1} -->

Final backend coverage gate passed all 715 tests but refused auxiliary-domain-services at 35/46 branches versus baseline 27/34 (79% floor unchanged). The new delete_puzzle_database_resolved helper is exercised only through poisoned authority cleanup; its production success/idempotent/pre-delete-failure branches need direct proof. LCOV reports both sides of the NotFound guard at puzzle.rs:491 uncovered. Root assigned tests to the existing Luna/xhigh puzzle worker; no baseline, floor or measurement-scope change is authorized. This is a required integration verification fix for the original confirmed-deletion cleanup, not a deferred finding. Failed gate log: final-gates-attempt2.log.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"05d5596e2e5e811cc1b3e826ca8367efebd54ef23d10745cd4044926da8a5635","input_sha256":"f662b190337b768be62491b8724024b7f0eb88cb1c7e172362d72677c7d4cff4","kind":"mutation-receipt","operation":"2f5fcacdf48742efca433657406cc3d9f3496845fb64d835d62d6057b9986576","options":{"section":null},"request_id_sha256":null,"results":["f-20260830-35"],"target":"f-20260830-35","v":1} -->

Resolved the final coverage gap with production-helper tests for ordinary puzzle deletion, already-missing idempotent deletion and pre-delete identity failure, plus cache isolation assertions for a different rating range and database. Shared the existing real deletion fixture; no production behavior or test-only outcome injection changed. Root read the complete test diff and reran all 20 focused puzzle tests, formatting and the unchanged coverage checker. Full backend coverage measured 718 passed, one existing ignored, with auxiliary-domain-services at 38/46 branches (82.61%); all area floors and ratchets pass. Final all-target check and Clippy also pass. Evidence: /tmp/chessfable-path-ownership-OMFFz4/puzzle-coverage-backend-2.log and puzzle-coverage-check-backend-2.log, both exit 0. Full clean-tree gates are rerun after committing this test correction.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"01b45e9cb160df400520433aad93176e81cf78157cd3eaf1f30bfc812db02371","input_sha256":"5ab09b1c0b834ed88ae68727c44aecbffaf6f4add2590d09b577fc6971e461f7","kind":"mutation-receipt","operation":"9a70320637654d356a03d4729f98e246c07ed77b6e34626f876cf163a5834c94","options":{"section":null},"request_id_sha256":null,"results":["f-20260830-35"],"target":"f-20260830-35","v":1} -->

---

## 2026-08-30 — filed through the inbox spool

### One process-wide blocking mutex serialises 51 call sites, and three of them hold it across a whole-file SHA-256 or a full registry fsync

* **ID:** f-20260830-36 · **Status:** handled · **Area:** native-fs · **Root:** blocking-work-not-offloaded · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/main.rs:389-390` (the mutex), `:603-620` (fsync under lock),
  `src-tauri/src/fs.rs:651-664` and `:807-820` (SHA-256 under lock),
  `src-tauri/src/infra/path_authority.rs:3060` and `:692-707` (the hash), `:1929` (the commit).
* **Defect:** `pgn_path_authority` is a `std::sync::Mutex<Option<PathAuthority>>` on `AppState` —
  one instance process-wide. **51 production lock sites** across seven modules (`main.rs` 23,
  `fs.rs` 13, `puzzle.rs` 5, `chess.rs` 4, `db/mod.rs` 4, `file_workspace.rs` 2, `pgn.rs` 1;
  one further site is a test). Three of them do heavy work while holding it, from inside `async fn`
  commands:
  - `issue_download_destination` (`main.rs:582`) holds the guard across `promote_dialog`, which
    serialises the entire registry and performs two `sync_all()` calls.
  - `download_to_destination` (`fs.rs:651`) and `install_staged_pgn_artifact` (`fs.rs:807`) each hold
    it across `reserve_download_artifact`, which streams a **SHA-256 over the whole downloaded
    payload** in 64 KiB chunks and then commits the registry — hash plus two fsyncs, under one guard.
* **Why it matters:** a blocking mutex held across file I/O inside an async command is the exact
  pattern `.claude/rules/async-resource-invariants.md` forbids ("no lock is held across `.await`",
  "blocking work stays off the Tokio workers"). Hashing a multi-gigabyte database download stalls
  every unrelated path operation in the process for the duration, and blocks a Tokio worker while
  doing it.
* **Fix shape:** compute the hash and stage the file before taking the lock; hold the guard only for
  the registry mutation. Whether the registry commit itself should move off the worker is the design
  question — it is coupled to the unbounded-registry finding, since the commit cost is what grows.
* **Found by:** Claude review of the 2026-08-13 audit diff, 2026-08-30. The lock-site count was
  independently derived and is roughly twice what the first pass reported.

**Partial progress, 2026-09-03 (drain session ce8785e6) — four of nine phases shipped. It remained open after that run; the rest landed on 2026-09-04, see the closing note below.**

The plan is `tasks/plans/2026-09-03-blocking-work-not-offloaded.md`; it converged after 18 rounds of
adversarial review and is the specification for the rest. The design questions are settled in
`d-20260903-04` (no gateway re-entrancy guard, non-nesting invariant instead), `d-20260903-05`
(`Arc` handles, no context bundle), `d-20260903-06` (thin command + `<name>_blocking` shape),
`d-20260903-07` (test injectors cross the worker) and `d-20260903-08` (engine-image `VerifiedFile`).
Do not re-derive them.

Shipped and green (`cargo test` 492, clippy, fmt, `bindings:check`, `rust:surface:check`):

* `85437156` — `infra/blocking.rs` gets its first four tests, one join mapper that logs the panic
  payload it used to discard, and the non-nesting invariant on the type and in the rule file.
* `cc9af733` — `pgn_path_authority` and `search_cache` become `Arc`; three helpers retyped onto the
  one field each reads; `invalidate_search_cache` deleted and inlined; the two test failure
  injectors become `Arc<dyn … + Send + Sync>` and the gateway carries them into its worker under
  `#[cfg(test)]`.
* `b345ea01` — the engine-image read leaves the authority guard: `open_engine_image` /
  `engine_image_reader_for` / `read_engine_image_bytes`, the `VerifiedFile` newtype, two `const`
  arity pins, a `READ_TOKENS` scan and four behavioural tests. Residual hole filed separately.
* `a47d9066` — sixteen synchronous `main.rs` / `puzzle.rs` capability commands become thin `async`
  wrappers over `*_blocking` functions on the gateway, dialogs deliberately outside the permit, plus
  the S-1 / S-2 / S-8 source scans.

Not started: the `file_workspace.rs` mutators and the `workspace_mutation` lock (plan phase 3, third
sub-step), the already-`async` `issue_*` capability commands (phase 3b), the whole `db/**` offload
and the `chess.rs` novelty pass (phase 4), and the staged-download hash (phase 5).

**Why it stopped:** the Grok executor went down mid-phase. Two write leaves stalled after emitting
only `available_commands`, and two minimal probes (`grok-4.5`, `--effort low`, one-line prompt)
timed out at 180 s and 240 s with the same signature. Per
`~/.claude/references/review-lens-contract.md` a write leaf that dies this way is a failed phase:
no `Agent` fallback writes files and there is no mid-run executor switch. Nothing was pushed. The
four commits above are local, green and individually sound. **Resume with
`--executor codex`.**

**Handled, 2026-09-04 (drain session 0a2310ce). Both halves of this finding are closed.**

The staged SHA-256 no longer runs under the guard or on a Tokio worker: `reserve_download_artifact`
takes the already-computed `(size, digest)` pair, and the one new helper `hash_staged_payload`
hashes inside `BLOCKING_GATEWAY` before either caller locks (`f98a3987`). S-5 pins all four
properties, including the ordering, because hashing and then entering an empty gateway call
satisfies mere presence and leaves the Tokio-worker stall intact.

The 51-call-site mutex half is closed by the conversions themselves: `714e470d` (the five
`file_workspace.rs` mutators, the three restructures, and the explicit `workspace_mutation` lock
that replaces dispatch-thread serialisation), `c5362e0d` (the fourteen already-async `issue_*`
commands, whose guard used to span `promote_dialog`'s three fsyncs) and `a22bbdf4` (the database
layer). `7b1d92ca` closes the engine-image call-site half by proving no lock encloses
`read_engine_image_bytes` (`f-20260903-05`).

Not closed, and filed rather than dropped: `activate_download_artifact` still hashes the published
inode under the same process-wide mutex on a Tokio worker — the original stall one step later. The
plan ruled that function out of scope for the caller-digest question only, which is a security
argument about *whether* to hash, not about the guard or the thread. See `d-20260904-03` and the
new `native-fs` finding under this root. The same-module `VerifiedFile` forgery residual is filed
too, as plan phase 7 required.

Review of the cumulative range found five of its own scans green against the mutant they were
written for; `7fe851ed` makes each fail, each demonstrated red and reverted. `c8a5228b` restores the
backend coverage ratchet with tests, not a baseline, using the fact that the offload made these
bodies synchronous and therefore unit-testable for the first time. `pnpm verify:app` passes all
seven checks against the real window after `f6c3240a`.

---

## 2026-08-30 — filed through the inbox spool

### Every database command, the PGN import and the search-index scans run on Tokio workers with no offload, while the blocking gateway bounds a different population

* **ID:** f-20260830-37 · **Status:** handled · **Area:** db-search · **Root:** blocking-work-not-offloaded · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/db/mod.rs` (no `spawn_blocking` or `BLOCKING_GATEWAY` anywhere in the
  file), `db/search.rs:476,622,659,717`, `db/mod.rs:502,654,1037,1346,1364,1441,1561`,
  `db/repository.rs:314-326,535-548`, `chess.rs:811`, `infra/blocking.rs:8,31`.
* **Defect 1 — rayon scans inline in async.** `search_position_inner` (`search.rs:476`) and
  `is_position_in_db` (`:659`) each run `mmap_index.par_iter().try_for_each(...)` over the whole
  game index directly in an `async fn` body. `analyze_game` triggers `is_position_in_db` **per
  analysed position** (`chess.rs:811`, inside a loop over every move), so one game analysis parks a
  Tokio worker repeatedly for full-index scans.
* **Defect 2 — all Diesel work is inline.** `get_games` (`db/mod.rs:1037`), `get_player`,
  `get_players`, `get_tournaments`, `get_players_game_info` are `async fn` with `.load(db)` in the
  body. `convert_pgn` (`:502`) runs the entire bz2/zstd decode, PGN parse and insert transaction
  inline — minutes to hours on one worker for a large import. `generate_search_index_locked` (`:654`)
  and the `db/repository.rs` helpers are sync functions, but their only callers reach them inline
  from `async fn` with no `spawn_blocking`, so the effect is identical. `delete_database`
  (`db/mod.rs:1717`) reaches a `Condvar::wait` (`repository.rs:542`) that can block a worker
  indefinitely waiting for in-flight connections.
* **Defect 3 — the gateway bounds the wrong work.** `BLOCKING_GATEWAY` (semaphore of 4) has 17 call
  sites: `puzzle.rs` 7, `pgn.rs` 4, `fs.rs` 4, `game.rs` 1, `lexer.rs` 1. It appears **nowhere** in
  `db/`, `file_workspace.rs`, `credentials.rs` or `opening.rs`. So it throttles the work that is
  already correctly offloaded while the heaviest blocking work in the process runs unbounded — and
  since the gateway also carries the only `catch_unwind` (`blocking.rs:31`), the unbounded paths are
  the unprotected ones too. That matters concretely at `db/search_index.rs:415`, an `.expect` over a
  live mmap that a concurrent on-disk modification can reach.
* **Note:** `puzzle.rs:409` wraps the same `delete_exclusive` in `BLOCKING_GATEWAY.spawn` that
  `db/mod.rs:1724` calls inline — the correct pattern is in-tree and simply was not applied here.
* **Found by:** Claude review of the 2026-08-13 audit diff, 2026-08-30.

**Not started, 2026-09-03 (drain session ce8785e6).** The cluster's shared groundwork shipped but no
`db/**` work did. See the progress note on `f-20260830-36` for the four commits, and
`tasks/plans/2026-09-03-blocking-work-not-offloaded.md` phase 4 for the specification, which is
frozen after 18 review rounds. Load-bearing points that plan review established and that a fresh
session should not re-derive:

* Wrapping `db/` layer by layer **deadlocks** the four-permit gateway. The concrete chains are
  `search_position_inner` → `load_search_index` → `generate_search_index` →
  `generate_search_index_locked`, and every `command → with_write_lock → get_db_or_create` pair. One
  permit per command, at the command boundary, callees stay synchronous (`d-20260903-04`).
* `load_search_index` must become synchronous; its only `.await` is a `tokio::sync::Mutex` that
  becomes a `std::sync::Mutex` with poison mapped to `Error::Conflict`. Four `#[test]`s and one
  `include_str!` scan change with it, all named in the plan's Risks section.
* `convert_pgn` holds a `!Send` `MutexGuard` across the whole import, so the write lease must be
  acquired **inside** the closure.
* `new_request`'s `OwnedSemaphorePermit` must be moved **into** the closure, not held across the
  gateway await — `spawn` drops its own permit when the caller is abandoned while the worker keeps
  running, which would release the two-search cap mid-scan.
* `SearchProgress` stays on the async frame; the worker gets a cloned `ProgressLease` plus
  `AppHandle`, or an abandoned search reports `Succeeded` after the scan finishes.
* `retire_and_wait`'s unbounded `Condvar` becomes a bounded wait **with an unwind** — on timeout it
  must clear `retiring` and remove the tombstone, or the database is left neither openable nor
  deletable until restart.

Stopped because the Grok executor went down; resume with `--executor codex`. Nothing pushed.

**Handled, 2026-09-04 (drain session 0a2310ce).**

`a22bbdf4` offloads the database layer. All twenty commands take exactly one permit at the command
boundary and their callees stay synchronous — `load_search_index`, `generate_search_index`,
`generate_search_index_locked`, `is_position_in_db` and `get_db_or_create` were made sync precisely
so a second permit cannot be taken, since wrapping layer by layer deadlocks the four-permit pool
through `search_position_inner` to `generate_search_index_locked` and through every command to
`get_db_or_create`. The rayon scans, all Diesel work, the whole `convert_pgn` decode-parse-insert,
and `delete_database`'s `Condvar` wait now run on the pool rather than on a Tokio worker, so the
gateway bounds the heaviest blocking work in the process instead of only the work that was already
correctly offloaded — and that work now has the `catch_unwind` too.

Two things deliberately did not move: `new_request`'s permit is moved into the closure, because
`spawn` drops its own permit when the caller is abandoned while the worker runs, which would
release the two-search cap mid-scan; and `SearchProgress` stays on the async frame, because
`ProgressStore::transition` keeps the first terminal state, so a worker completing the lease would
make an abandoned search paint as `Succeeded`.

`analyze_game` now kills the engine between the UCI loop and the novelty pass, closing the window
where a slow lookup kept a live child with no reachable kill. The lookups run in one worker and
still stop at the first unseen position (`d-20260904-02`); the order-dependent tagging stays async.
`retire_and_wait` is bounded and unwinds (`d-20260904-01`).

S-4, S-7, the extended S-8, T-2 and T-3 cover it; `7fe851ed` closed the holes review found in S-4
and S-8. `c8a5228b` covers the bodies the offload made unit-testable, restoring the coverage
ratchet without touching a baseline.

Three pre-existing defects in `db/**` that this run read but did not fix are filed rather than
absorbed: the partial-import index staleness, the silent row-drop in `export_to_pgn`, and the
memory half already tracked as `f-20260831-06`.

---

## 2026-08-30 — filed through the inbox spool

### A third of the IPC surface runs on the GTK main thread, including a directory walk that fsyncs once per file it discovers

* **ID:** f-20260830-38 · **Status:** handled · **Area:** bindings-ipc · **Root:** blocking-work-not-offloaded · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/main.rs:693` (`list_workspace_databases`), `:970` (`read_engine_image`),
  `src-tauri/src/file_workspace.rs:490,539,561,595,635,665` (the six mutators);
  registry at `main.rs:1120-1232`.
* **Defect:** **37 of the 113 registered commands are `fn`, not `async fn`** — count independently
  derived from the registry. `tauri::command` defaults to a blocking execution context and upgrades
  to async only when the signature is `async`, so a sync command body executes on the dispatching
  thread, which on this target (Linux, WebKitGTK) is the GTK main loop. No command uses
  `#[command(async)]`.
* **What runs there:**
  - `list_workspace_databases` walks a directory (`path_authority.rs:2551-2563`) and calls
    `register_database_child` per entry, which performs a full `resolve` traversal and, for an
    unregistered child, a registry clone plus commit — **two fsyncs per newly discovered database
    file, on the UI thread.**
  - `read_engine_image` reads image bytes inline while holding the authority lock.
  - All six file-workspace mutators perform synchronous `sync_all()` on the main thread — via
    `atomic_replace_at` for `rename_workspace_file`, and via `rename_entry_at`, `create_dir_at` or
    `remove_entry_at` for the others — and `permanently_delete_workspace_entry` adds a registry
    commit on top.
* **Why it matters:** the window freezes for the duration of the I/O. Opening a workspace with many
  databases is the worst case, because the cost scales with the number of files discovered and each
  one can cost two fsyncs.
* **Fix shape:** make these commands `async fn` and move the filesystem work behind the blocking
  gateway. The design question is which of them need to stay ordered relative to each other once
  they no longer run on a single thread.
* **Found by:** Claude review of the 2026-08-13 audit diff, 2026-08-30.

**Partially shipped, 2026-09-03 (drain session ce8785e6). It remained open after that run; the rest landed on 2026-09-04, see the closing note below.**

`a47d9066` converted sixteen of the synchronous commands — `save_board_snapshot`,
`save_engine_logs`, `open_app_log`, `get_database_workspace`, `list_workspace_databases`,
`create_workspace_database`, `database_download_destination`, `get_engine_workspace`,
`read_engine_image`, `engine_archive_destination`, `register_installed_engine`,
`open_engine_workspace`, `list_path_capabilities`, `promote_path_capability`,
`get_puzzle_workspace`, `issue_puzzle_download_destination` — plus `issue_engine_image`, with
`revoke_path_capability` made `async` without a permit because `revoke_dialog` is a `HashMap::remove`.
Native dialogs are deliberately outside the permit. S-1, S-2 and S-8 scans are in
`main.rs::blocking_offload_scans`.

Still to do, specified in `tasks/plans/2026-09-03-blocking-work-not-offloaded.md`:

* The five `file_workspace.rs` mutators, the `workspace_mutation` lock over the
  `mutation_target` → registry window in seven bodies, and the three restructures —
  `list_file_workspace` (the recursive `tree_entry` walk interleaves `count_pgn_games_core` per PGN
  leaf, so it needs a sync `collect_tree_entries` returning `FileWorkspaceHandle`s plus an async
  counting pass, not a wrap), `create_workspace_file`, and `permanently_delete_entry` — where the
  blocking half must return the dropped `PathRef` vector **alongside** an error so the wrapper can
  still `retire_executables` on the failure path (`d-20260901-29`).
* Phase 3b: the already-`async` `issue_*` capability commands in `main.rs`, `fs.rs`, `puzzle.rs` and
  `file_workspace.rs`, which hold the authority guard across `promote_dialog`'s three fsyncs on a
  Tokio worker.

The count in the original entry was low: 114 registered commands, 36 sync, not 37 of 113.

Stopped because the Grok executor went down; resume with `--executor codex`. Nothing pushed.

**Handled, 2026-09-04 (drain session 0a2310ce).**

The remaining sync commands left the GTK main loop in `714e470d`: the five `file_workspace.rs`
mutators are thin async wrappers over their blocking bodies, with the three keep-name helpers
(`create_workspace_directory_inner`, `trash_entry`, `restore_entry`) staying synchronous while the
command holds the spawn. `list_file_workspace` — the directory walk that fsynced once per file it
discovered — is a restructure rather than a wrap: `collect_tree_entries` does the whole recursive
walk and registration in one closure and returns the handles whose PGN counts are missing, and an
async pass counts them. `create_workspace_file` and `permanently_delete_entry` got the same split.

`c5362e0d` finished the other side, converting the fourteen already-async `issue_*` capability
commands in `main.rs`, `fs.rs`, `puzzle.rs` and `file_workspace.rs`, with every native picker
awaited outside the permit and `list_puzzle_databases` split so its per-file
`puzzle_database_info_for_file` await cannot nest a second acquisition.

The serialisation those seven mutation entry points used to get for free from the single dispatch
thread is now explicit — `AppState.workspace_mutation`, taken inside the worker, covering
`mutation_target` through the registry write, poison mapped to `Error::Conflict`.

S-1, S-2, S-3, S-8 and S-9 cover these symbols, and `7fe851ed` made S-1's closure walk the shared
one so a decoy spawn cannot satisfy any of them.

Every converted command uses `spawn` rather than `spawn_cancellable`, because no path carries a
`CancellationToken`. That is filed as its own `bindings-ipc` finding under this root rather than
half-done here, as D-G requires.

---

## 2026-08-30 — filed through the inbox spool

### Extracted archive directories are group-writable, and a deep archive makes every reinstall report failure after succeeding

* **ID:** f-20260830-39 · **Status:** handled · **Area:** native-fs · **Root:** - · **Entry:** inline · **Blocked:** none
* **Where:** `src-tauri/src/fs.rs:1116,1119,1181,1184` (`create_dir_all`), `:1261-1267`
  (`private_output_file`), `:1045-1047` (`validate_archive_path`);
  `src-tauri/src/infra/fs.rs:76` (`MAX_REMOVE_TREE_DEPTH = 64`), `:456-460`, `:687-704`.
* **Defect 1 — permission asymmetry.** Extracted *files* are opened with `options.mode(0o600)`, but
  the directories holding them are created with `std::fs::create_dir_all`, which applies
  `0o777 & ~umask`. On this machine `umask` is `0002`, so those directories are **0775 —
  group-writable**. No `set_permissions` or `DirBuilder::mode` appears anywhere in `fs.rs`.
* **Defect 2 — writer and remover disagree on depth.** `validate_archive_path` bounds total path
  *length* at 1024 bytes and rejects `Prefix`, `RootDir`, `ParentDir` and NUL — but never the
  component *count*, so `"a/"` repeated 512 times passes. `remove_tree_at` refuses beyond
  `MAX_REMOVE_TREE_DEPTH = 64`. An engine archive nested deeper than 64 levels installs fine; on the
  next reinstall `install_dir` swaps the old tree into the staging name via `RENAME_EXCHANGE` and
  the cleanup of that old tree hits the depth limit, so `download_file` returns
  `CommittedDurabilityUncertain` — **permanently, on every subsequent reinstall, even though the
  exchange already committed successfully.**
* **Correction to the first report:** the old tree is *not* leaked. The staging directory is a
  `tempfile::TempDir` (`fs.rs:1083`, `:1143`) and the error propagates by `?`, so `TempDir::drop`
  runs `remove_dir_all`, which has no depth cap. The defect is a permanent false failure signal, not
  an unremovable directory.
* **Also noted, and it corrects the framing:** `infra/fs.rs:902` `create_dir_at` is a *leaf*
  primitive (`parent: &File, name: &OsStr`, one `mkdirat`), not a recursive one, and it does not use
  `NOFOLLOW` — so it is not a drop-in replacement for `create_dir_all` over a multi-component
  archive path. The symlink-component concern is also theoretical here: the staging root is a fresh
  temp directory and neither extractor can create a symlink inside it (`extract_tar` rejects them at
  `fs.rs:1167-1171`; `extract_zip` writes every entry as a regular file).
* **Fix shape:** set the directory mode explicitly at creation, and bound component count in
  `validate_archive_path` to match `MAX_REMOVE_TREE_DEPTH`.
* **Found by:** Claude review of the 2026-08-13 audit diff, 2026-08-30.

Handled. Commit `2736e832`.

**Permissions.** One `DirBuilder::mode(0o700)` helper replaces every `create_dir_all` in the
extraction and install paths, and the three staging `TempDir`s are created with explicit 0700.
The mode tests set umask to `0o000` and assert the exact mode: four review lenses independently
showed at confidence 100 that the first version, using umask `0o022`, would have stayed green on a
revert, because the unfixed `create_dir_all` yields 0755 under that umask and 0755 already satisfies
a "not group-writable" assertion. umask is process-global, so the assertions serialise and restore
it on every exit path.

**Depth.** `validate_archive_path` now bounds the `Component::Normal` count, derived from
`MAX_REMOVE_TREE_DEPTH` rather than hard-coded; `d-20260830-02` fixes that cap and it is unchanged.
The constant was `pub(super)` inside the private `unix` module, so it is widened at the declaration
and re-exported — a re-export alone cannot widen visibility, which a lens caught at 98. The existing
1024-byte bound is named beside it.

**The off-by-one was measured, not reasoned:** 63 components install and reinstall cleanly; 64
reproduce the false failure, committing the exchange and then returning
`CommittedDurabilityUncertain` on every subsequent reinstall. That is the failing-before evidence
for this fix.

**The finding's own two corrections both held.** The old tree is not leaked — `TempDir::drop` runs
`remove_dir_all`, which has no depth cap — and `infra/fs.rs`'s `create_dir_at` is a leaf `mkdirat`
taking `(parent, name)`, not a recursive creator, so it was not usable here.

**Deliberately not done:** directories installed before this change keep their 0775. Rewriting the
modes of existing user data on upgrade is a separate and riskier change, and is stated here rather
than silently omitted.

The raw staging path and OS diagnostic this path used to hand the renderer are gone as a class
rather than at this one site — see `f-20260830-40`'s note and `d-20260831-05`.

---

## 2026-08-30 — filed through the inbox spool

### Fault-injection scaffolding ships in release builds, next to two suppressions that no longer suppress anything

* **ID:** f-20260830-40 · **Status:** handled · **Area:** native-fs · **Root:** - · **Entry:** inline · **Blocked:** none
* **Where:** `src-tauri/src/infra/fs.rs:25,38,1180,1188,1196` (ungated), against `:81-130`
  (correctly gated); `:760` and `:1100` (stale suppressions);
  `src-tauri/src/infra/path_authority.rs:3564,3578`; `src-tauri/src/fs.rs:1041-1043` (shadowing).
* **Defect 1 — inconsistent gating inside one file.** `AtomicFileFaultPoint` (:25),
  `AtomicWriterInjector` (:38), `AtomicDirFaultPoint` (:1180), `AtomicDirInjector` (:1188) and
  `atomic_install_dir_with_injector` (:1196) are ungated `pub`, so their vtables and generic
  instantiations are part of the shipped surface. Twenty lines away the *removal* injector is
  correctly `#[cfg(test)]` throughout (`:81-130`). `path_authority.rs:3564` `save_with_injector`
  compiles in release for the same reason. Caveat for whoever fixes it:
  `atomic_install_dir_with_injector` is not pure scaffolding — `atomic_install_dir` (:1214)
  delegates to it with a default injector, so it cannot simply be `cfg`-gated away.
* **Defect 2 — two `#[allow(dead_code)]` that suppress nothing.** `:760` on `atomic_replace_at` and
  `:1100` on `atomic_replace_at_identified`; both have real production callers in ungated
  `#[tauri::command]` bodies (`file_workspace.rs:433,440,583`) and are exercised by tests. They would
  now only hide a future regression to genuinely dead code.
* **Defect 3 — a zero-value shadowing pass-through.** `fs.rs:1041-1043` defines a private
  `atomic_install_dir` whose entire body calls `crate::infra::fs::atomic_install_dir`. Two names at
  two layers with no added behaviour, so a reader at the call site (`fs.rs:1132`, `:1197`) cannot
  tell which one runs and misses where the real `RENAME_EXCHANGE` and backup semantics live.
* **Found by:** Claude review of the 2026-08-13 audit diff, 2026-08-30.

Handled. Commit `7b9afd3a`, with the error-payload half in `6d9c8e4b` and the anchor in `f9141425`.

**Gating.** Both atomic seams now use the pattern the removal seam twenty lines away already used:
a `#[cfg(test)]` thread-local plus `inject_atomic_file` / `inject_atomic_dir`, whose call sites sit
individually gated inside the ungated operations. All sixteen injection points keep their exact
positions — ten in the file path, six in the directory path.

Three review lenses refuted the first plan at 94-97 confidence: routing production through "an
ungated inner that performs no injection" cannot preserve in-operation injection points, so the
tests would have exercised a wrapper rather than the shipped path. They were right, and the plan was
rewritten before any code existed.

`path_authority.rs` turned out to be a consumer too, which the finding did not mention: it imported
`AtomicWriterInjector` and `atomic_replace_with_injector` **ungated** at module scope, which is why
the trait had to exist in a release build at all. Its two `*_with_injector` helpers and their tests
are converted with it. `atomic_install_dir_with_injector` is gone entirely — tests set the
thread-local — which also removed the caveat that made a naive `cfg` gate break the build.

**Suppressions.** Both `#[allow(dead_code)]` are removed; `atomic_replace_at` and
`atomic_replace_at_identified` have production callers in `file_workspace.rs` and clippy `-D
warnings` agrees.

**Shadow.** The private `atomic_install_dir` in `fs.rs` whose whole body called
`crate::infra::fs::atomic_install_dir` is deleted and both callers name the real one.

**Regression anchor:** rule R2 of `scripts/check-rust-release-surface.mjs` — no public
`FaultPoint`/`Injector`/`_with_injector` item or import outside a `#[cfg(test)]` region — plus
`cargo check` without `--all-targets`, which fails if a production signature names a fault type
again. The checker was verified by hand to fail on both reverts before its commit. `d-20260831-07`
records why the checker was built rather than the gap annotated onto `f-20260830-23`.

---

## 2026-08-30 — filed through the inbox spool

### Panic-on-poison and unguarded `unwrap` on paths reachable from a database, an engine or the network

* **ID:** f-20260830-41 · **Status:** handled · **Area:** oauth-credentials · **Root:** panic-on-untrusted-input · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/credentials.rs:359-374` and its `.expect` sites `:256,271,280,305,362,388`;
  `src-tauri/src/fs.rs:84-90`, `:50`, `:69`; `src-tauri/src/oauth.rs:450,463`;
  `src-tauri/src/infra/net.rs:136-147`.
* **Defect 1 — a wide lock span whose poisoning is fatal to the feature.** `credentials.rs:359-374`
  holds the registry `std::sync::Mutex` across `persist_locked` (write + fsync), `token()` and
  `store.delete()`. A panic anywhere in that span poisons the mutex, after which every later
  credential operation panics at its `.expect("credential registry mutex poisoned")`. Same shape at
  `oauth.rs:450,463`.
* **Corrections to the first report, both material:** the eight cited `.expect` lines are **two
  different mutexes** — `:260` and `:484` guard a *path* mutex, so poisoning the registry does not
  affect them. And the outcome is **not** a process abort: no `panic = "abort"` is configured
  anywhere, so this panics per call and unwinds.
* **Defect 2 — `.expect` inside `Drop`.** `fs.rs:84-90` `DownloadLease::drop` unwraps the download
  registry lock, which `:50` and `:69` can poison. A panic in `Drop` *during unwinding* does abort —
  that is the one place where the abort claim holds.
* **Defect 3 — `unwrap` in a `Default` impl on the startup path.** `infra/net.rs:144`
  `safe_http_client(...).unwrap()` inside `impl Default for ProdTransport`, reached at `AppState`
  construction (`main.rs:404-405`). `safe_http_client` is fallible and returns a `reqwest` build
  error, so a TLS backend initialisation failure panics with no message and no adjacent comment —
  which `.claude/rules/async-resource-invariants.md` requires for any provable-invariant unwrap.
* **The correct pattern is already in this codebase** and should be applied: `chess.rs:63,362,586,733`
  and `fs.rs:595` all map a poisoned lock to `Error::Conflict("path authority lock was poisoned")`
  rather than expecting. (The exemplar cited in the first report, `chess.rs:441`, is unrelated code.)
* **Found by:** Claude review of the 2026-08-13 audit diff, 2026-08-30.

* **Handled 2026-09-07:** d2a48b8e replaces credential registry/path lock expects with fallible shared guards; listing propagates through IPC and authenticated identity verification. Download begin/cancel fail closed and lease Drop performs token-matched cleanup even on a poisoned mutex. Both native HTTP clients are constructed fallibly before AppState is published. Existing OAuth delivery/persistence poison mapping was already fixed; persistence now has a regression test. Credential journal lock spans remain serialized under d-20260907-03/-04.
* **Proof:** cargo test --manifest-path src-tauri/Cargo.toml --locked: 734 passed, 0 failed, 1 ignored; cargo fmt check, all-target Clippy with -D warnings, and pnpm bindings:check passed. Separate probes cover registry/path poisoning without secret-store effects, unwinding lease cleanup, stale-token identity, and failure of each client constructor.
<!-- ledger-meta {"command":"annotate","effect_lines":2,"effect_sha256":"26b75d49b53dbdbd53778ba0844a2080a5958ae0f04bf6264fdb9568502d21c6","input_sha256":"eee81ad5ed8a3847c4fd181973bd7657e4a976d4aa4cd131181b61142b999a78","kind":"mutation-receipt","operation":"35f3d8f64ed5beee2e47f5b6f33fa34d6164a893f113971057555ac62df16871","options":{"section":null},"request_id_sha256":null,"results":["f-20260830-41"],"target":"f-20260830-41","v":1} -->

* **Diff review follow-up 2026-09-07 (Fix, pending):** review-minimalism found two removable layers introduced by d2a48b8e: credentials.rs:252 has near-identical registry and registry_path acquisition helpers (96 confidence), and main.rs:436 has a single-caller new_with_clients layer (94 confidence). Consolidate credential lock acquisition into one typed helper and inline state initialization into the existing builder seam. Preserve failure policy and all regression tests. Root adopted both findings; no architecture or eligibility change.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"cd55a634f6606cf0a850da50b02a4a9cb708c3e2aa48c0e84f754c21948c07cd","input_sha256":"58c9b9559ded5a1c2c7ef4c497e78b5d10a0945bce6a755deddd006dff247fb0","kind":"mutation-receipt","operation":"956488bfdfd2363c674ed1a853271bae3ace98230f48a0c854940d86e27514a9","options":{"section":null},"request_id_sha256":null,"results":["f-20260830-41"],"target":"f-20260830-41","v":1} -->

* **Additional diff review follow-up 2026-09-07 (Fix, pending):** review-error-handling identified token() bypassing the poisoned registry (credentials.rs:319, confidence 97), allowing authenticated provider requests despite a failed registry. Acquire the registry guard on token reads and retain it through the secret-store read; remove already owns that guard and must call the store directly to avoid nested locking. Extend the poison test to cover token/token_async and retain ordinary removal tests. It also identified startup client construction before the log plugin (main.rs:1801, confidence 90). Build the Tauri application/plugins first, then construct and manage state before app.run/setup, logging construction failure while returning it from main. Local tauri app.rs confirms initialize_plugins runs in build, while setup runs on the event loop. Both fixes preserve normal behavior and the original fail-closed policy.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"e0b1b18bd71bb84583da192f8359c1b8fa783cd93f5b833c424736180a6445a7","input_sha256":"6bbe6a87214d23edcb30fc90ab65cb6fe748391128289729a1a493fb1cde471b","kind":"mutation-receipt","operation":"2333fd2cb0027228ee83d73fb65114f14d274ae4d6ea9a7e2dd6c58159ac90b4","options":{"section":null},"request_id_sha256":null,"results":["f-20260830-41"],"target":"f-20260830-41","v":1} -->

* **Code-quality diff review 2026-09-07:** Fix the unnamed ProdTransport timeout roles at infra/net.rs:158 (confidence 99), keeping 10/30/3600 seconds unchanged. Skip the alleged dead AppState::new_request field (confidence 99): repository search proves live semaphore readers at chess.rs:936 and db/search.rs:471. Preserve the field and its two-permit default; this is a false positive, not dead code.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"f1181f3c0cf2ace58c49dd7f3266ff6254f9eb1415d538a06f832d24dbb3fc7f","input_sha256":"03fbedae5e78118de12e797dafc1c9dde5bb8f3755a8fddee9263a70be275887","kind":"mutation-receipt","operation":"33f71caa0571847735c5f78f1019e367ced139400b70e4faca23ee93218a591f","options":{"section":null},"request_id_sha256":null,"results":["f-20260830-41"],"target":"f-20260830-41","v":1} -->

* **Review remediation completed 2026-09-07:** e706399a resolves all five adopted native findings: generic credential lock helper; token/token_async poison barrier without recursive remove locking; single state-construction body; log-plugin initialization before returnable HTTP construction failure; named download timeout roles. Rejected the dead-semaphore report with the two live caller locations above. Root independently reran the full Rust proof: 738 passed, 0 failed, 1 ignored; formatter and all-target Clippy passed.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"a5c54a58758689d8cff880bfc36128fa47d92c706fe29da0ac11e17c227a218c","input_sha256":"2bc4c53ff0a47341d03540c6bbe16afc43ee560d90a73ce686413932e840d5e9","kind":"mutation-receipt","operation":"51b30fa4466044446a708f4418c51b037ac64a6978401cc71a1a34dd97950623","options":{"section":null},"request_id_sha256":null,"results":["f-20260830-41"],"target":"f-20260830-41","v":1} -->

---

## 2026-08-30 — filed through the inbox spool

### Five `unwrap()` on database-loaded values, protected only by an unlabelled condition fifty lines earlier

* **ID:** f-20260830-42 · **Status:** handled · **Area:** db-search · **Root:** panic-on-untrusted-input · **Entry:** inline · **Blocked:** none
* **Where:** `src-tauri/src/db/mod.rs:1676,1678,1681,1683,1685`, guarded by the compound condition at
  `:1626-1635`.
* **Defect:** five `unwrap()` calls on values loaded from SQLite — `player`, `date`, `white_elo`,
  `black_elo` — plus `result`, which is derived by `GameOutcome::from_str` at `:1624` rather than
  read as a column. Their only protection is a seven-clause `if ... { return None; }` roughly fifty
  lines earlier, with **no comment anywhere between the two** tying them together. The code runs
  inside a Rayon closure, so a panic there is a worker-thread panic on database-driven data.
* **Why it matters:** this is precisely the class `.claude/rules/async-resource-invariants.md`
  forbids — a panic on values that reach the process from a database. One edit to the guard
  condition, by someone who has no reason to connect it to code fifty lines below, turns on five
  panics.
* **Fix shape:** destructure the options at the guard and carry the unwrapped values forward, so the
  compiler enforces the relationship instead of a comment.
* **Correction to the first report:** the guard is at `:1626-1635` (not 1624-1633) and the distance
  is ~50 lines (not 25).
* **Found by:** Claude review of the 2026-08-13 audit diff, 2026-08-30.

* **Handled 2026-09-07:** 47c9c5bf binds required player, date, parsed outcome, site and selected rating before move replay. No distant unwraps remain in row construction. Eligibility remains unchanged, including the same-player edge case requiring both ratings; ordinary games accept missing opponent ratings. This is behavior preservation, not a claim that the previous guard already failed.
* **Proof:** cargo test --manifest-path src-tauri/Cargo.toml --locked db::: 138 passed, 0 failed; cargo fmt check and all-target Clippy with -D warnings passed. SQLite cases cover each missing field, NULL and non-null invalid outcome, both colors and all outcomes, normalization/defaults, FEN exclusion and self-play eligibility. Separate statistics materialization design is filed as f-20260907-05.
<!-- ledger-meta {"command":"annotate","effect_lines":2,"effect_sha256":"b56692c37b89d71d1fd9fbd413c1f58fe4dc6100ff1c97edd95c3c1f55c349bb","input_sha256":"f2be93b9acb187f929d7622d2d0bbff4e5240e15e664e6a7ecf3a3566b6dcf19","kind":"mutation-receipt","operation":"e6b8f5e1dc843b2fcdff5683573310d6e708cbca87e99561a59a74f4431e3d40","options":{"section":null},"request_id_sha256":null,"results":["f-20260830-42"],"target":"f-20260830-42","v":1} -->

* **Diff review follow-up 2026-09-07 (Fix, pending):** review-pgn-index found database-owned move blobs using permissive iter_mainline_move_bytes at db/mod.rs:1899 (confidence 98). Truncated comment/NAG data or unbalanced variation markers become a plausible shorter game. The existing try_iter_mainline_move_bytes boundary explicitly requires validating database-owned streams. Apply it before statistics move replay and exclude malformed rows, with SQLite fixtures for corrupt streams plus a valid retained game. Adjacent permissive uses here read freshly encoded TempGame moves, not database-owned blobs, and remain unchanged.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"e372505f83e13f333f4ab07c41201dbe8dd761987829d541ef0486ca25baba32","input_sha256":"b233bf37d83ecf5a8e7494eb5634c7aa4537f178b4a7a86de260a735f07b50e2","kind":"mutation-receipt","operation":"d7518daef938073a1a2c66179494fd938ec50ec2afa9e3198af18f0b11967e95","options":{"section":null},"request_id_sha256":null,"results":["f-20260830-42"],"target":"f-20260830-42","v":1} -->

* **Code-quality diff review 2026-09-07 (Fix, pending):** name the opening-statistics replay limit at db/mod.rs:1900 (confidence 96) as 55 plies rather than the zero-based i > 54 condition. Preserve the established 55-ply behavior; do not claim the opening database proves a universal maximum or conflate the unrelated game.rs input-size limits.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"ab0f3a3cc4aa61c249ade87ce00d9d09b20cdbcb4fb95a3dfaea645c7c9d69ed","input_sha256":"0d5b99cfc06d1085fe30710b467ca1ebe6a8398f35a8a81b2d3c362c8448999e","kind":"mutation-receipt","operation":"e776fd33d9ca725794c4751318bf512910d1c69618a196fd9f79fb519a1e4e1d","options":{"section":null},"request_id_sha256":null,"results":["f-20260830-42"],"target":"f-20260830-42","v":1} -->

* **Review remediation completed 2026-09-07:** 31e98b8c resolves both adopted statistics findings: validates database-owned structural move streams before replay and names the established 55-ply opening lookup cap. Mixed SQLite rows cover valid data and all four corrupt annotation/variation structures. Root independently reran cargo test --manifest-path src-tauri/Cargo.toml --locked db:: with 139 passed, 0 failed; formatter and all-target Clippy passed.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"91ebeadf135df65278d2a3b7847db05ac3f6d813cb97d0246b92c6433ad569c6","input_sha256":"c876f548b2c875e503ebbc639224c92ffa25521234a87ed4f2007491461d7f6a","kind":"mutation-receipt","operation":"d7eeaf7121c391b1b079a44096188f52f8c41d847f57383067e173ed5d902842","options":{"section":null},"request_id_sha256":null,"results":["f-20260830-42"],"target":"f-20260830-42","v":1} -->

---

## 2026-08-30 — filed through the inbox spool

### `assert_eq!` on engine-subprocess output in one of two structurally identical loops

* **ID:** f-20260830-43 · **Status:** handled · **Area:** engine-uci · **Root:** panic-on-untrusted-input · **Entry:** inline · **Blocked:** none
* **Where:** `src-tauri/src/chess.rs:780`, against the sibling loop at `:419-421`.
* **Defect:** `assert_eq!(proc.best_moves.len(), proc.real_multipv as usize)` fires on values derived
  entirely from engine stdout — `chess.rs:402` reads the line, `:407` parses it, `:409`
  `parse_uci_attrs` produces `multipv` and `best_moves`. A misbehaving or crashing UCI engine that
  emits an unexpected multipv sequence panics the analysis path. The structurally identical loop at
  `:419-421` accepts the same input with no assert, so the two disagree about whether this is an
  invariant.
* **Why it matters:** an engine is exactly the kind of external process the repository's own rule
  names as untrusted input, and the inconsistency means one of the two loops is wrong — either the
  invariant holds and `:419` is missing a check, or it does not and `:780` is a crash.
* **Fix shape:** decide which loop is right; if the invariant is real, enforce it in both by
  returning an error rather than asserting.
* **Found by:** Claude review of the 2026-08-13 audit diff, 2026-08-30.

* **Handled:** the report-path `assert_eq!(proc.best_moves.len(), proc.real_multipv as usize)` is gone. The sequence guard in `ingest_info_line` is the collector invariant; a complete set that is mixed-depth or shallower still clears without panicking. Proof: `ingest_mixed_depth_set_is_complete_but_not_publishable`, `ingest_shallower_than_last_depth_is_not_publishable`, `ingest_rejects_out_of_sequence_multipv`.
* **Commits:** `10192873`
* **Rejected:** returning an `Error` from both loops for a mismatch the surrounding conditions cannot produce.

---

## 2026-08-30 — filed through the inbox spool

### The fork checks upstream's update endpoint on every launch and trusts upstream's signing key, so a future upstream release would replace this build

* **ID:** f-20260830-44 · **Status:** handled · **Area:** app-startup · **Root:** fork-identity-not-separated · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/tauri.conf.json:58-63` (`updater.endpoints`, `updater.pubkey`), `:45-47`
  (`productName`, `identifier`); `src/App.tsx:97` (the automatic check);
  `src/utils/engines.ts:173` (the engine manifest origin).
* **Defect:** every one of these values is **byte-identical to upstream** — verified by diffing
  `tauri.conf.json` and `package.json` against `upstream/master`, where only the CSP line differs.
  Concretely:
  - `endpoints` is `https://www.encroissant.org/updates` and `pubkey` is upstream's minisign public
    key. `App.tsx:97` runs `checkForUpdates` automatically at startup. So this build polls an update
    channel it cannot publish to, and **any release upstream ships would verify against the trusted
    key and be offered as an update to this fork** — silently replacing a heavily modified tree with
    upstream's binary. There is no private key here to sign a fork release with, so the channel is
    unusable in the intended direction and harmful in the other.
  - `identifier` is `org.encroissant.app`: a reverse-DNS name for a domain this fork does not own,
    and the same identifier upstream ships. It determines the app-data directory (databases, engines,
    puzzles, credentials) **and** the keyring service namespace, which this fork's own
    `fix(credentials): derive the keyring namespace from the bundle identifier` derives from it. Two
    builds with this identifier installed side by side share all of it.
  - `src/utils/engines.ts:173` fetches the default-engine manifest from `www.encroissant.org`, an
    origin this fork does not control, over a manifest that is never signed (see the sibling finding
    on the engine path component).
* **Why it matters:** this is the difference between "a fork" and "a build that can be taken over by
  the project it forked from". It is live today, not latent — the startup check already runs.
* **Fix shape:** generate a fork-owned minisign keypair, point `endpoints` at this repository's own
  releases, replace the pubkey, change `identifier` to a domain the fork owns, choose a distinct
  `productName`, and host the engine manifest at a controlled origin (updating the CSP and the
  capability scope with it). The dev split at `tauri.dev.conf.json` already shows the identifier is
  parameterisable.
* **Note:** GPL-3 §5(a) additionally requires a modified version to carry prominent notices that it
  was changed and when — worth satisfying in the same change.
* **Found by:** Claude review of the 2026-08-13 audit diff, 2026-08-30, while answering whether the
  fork is independent of upstream infrastructure.

* **Exposure assessment appended 2026-08-30 — this is not on fire, and here is exactly why.** Two
  independent conditions currently make the takeover path inert: upstream's newest release is
  **v0.15.0 (2026-03-17)** with no commits since 2026-04-20, and this fork's `package.json` version
  is **also 0.15.0**, so the updater's version comparison finds nothing newer even when the startup
  check runs. It also cannot overwrite anything today, because `pnpm build` runs `--no-bundle` and
  no installed bundle exists on this machine.
  **What makes it live:** upstream tagging any version above 0.15.0 — and the probability of that
  went *up* on 2026-08-26, when the maintainer publicly offered to add maintainers (issue #880) with
  another contributor actively pursuing the role. The source tree is never at risk; git is not
  reachable from the updater. The real loss scenario is the **app-data directory**: upstream's 0.15
  binary would own `$APPDATA/org.encroissant.app`, which this fork's schema work (`db/migrations.rs`),
  its persisted-state versioning and its credential layout now expect to control.
  **Therefore: must land before any bundled build is produced or installed, and before real
  repertoire data is stored — not before the next commit.**

* **Scope narrowed by decision `d-20260830-15`, and identifier fixed by `d-20260830-16` (2026-08-30).**
  This run does the **identity half only**: bundle identifier → `com.chessriddle.encroissant`
  (`.dev` variant in `tauri.dev.conf.json`), sever `updater.endpoints` and `updater.pubkey` so no
  upstream release can be offered, and add the GPL-3 §5(a) modification notice. `productName`, the
  fork's own signing keypair, the CI release workflow, the self-hosted engine manifest and the
  download page are **explicitly out of scope here** and stay open for a later run — they need a
  product name that is not chosen yet. Read both decisions before planning; they are answers, not
  questions to re-derive.

* **Handled 2026-08-30 (build run, `full auto`).** The identity half is done, exactly as
  `d-20260830-15` scoped it and `d-20260830-16` valued it. Commits, in order:
  - `6c2749ad` — bundle identifier is `com.chessriddle.encroissant` (`.dev` in the dev config), so
    the app-data directory, config directory, log directory, window-state file, asset-protocol scope
    and keyring service name are all disjoint from an installed upstream build.
  - `04921a1d` — the updater is gone end to end: Rust plugin and Cargo dependency, `plugins.updater`
    block, `createUpdaterArtifacts`, both capability permissions plus `process:allow-restart`, the
    npm dependency, `src/platform/updater.ts` and its test, the startup check, the Help-menu item,
    the e2e stub, and four catalogue keys.
  - `dcbb087b` — the GPL-3 §5(a) notice in the README and the About dialog, translated into all 16
    catalogues, naming what, by whom, from when, and under which licence.
  - Follow-ups from the review of that diff: `868f0711`, `ae7226f9`, `b293ef42`, `2dfcafd7`,
    `626188b4`, `971255a5`.
* **One thing was found that the entry did not name, and it changes `d-20260830-16`'s reasoning.**
  `src-tauri/src/oauth.rs:689` held a **second, independent copy** of the identifier as the Lichess
  OAuth `ClientId` — the name under which this build asks a real third party for a real user's
  token, and one Lichess shows the user on its authorization screen. It was not derived from the
  configuration, so the rename would not have reached it. Rather than substitute a new literal,
  which leaves the drift mechanism that caused the defect, the client id is now sourced from
  `app.config().identifier` through `AuthInternalConfig`, making `tauri.conf.json` the single place
  the fork's identity is written. `d-20260830-16` itself stands; only its "never user-visible"
  clause is wrong, corrected in `d-20260830-17` rather than by editing his record.
* **Rejected alternative, and why it matters:** blanking `updater.endpoints` and `updater.pubkey`
  in place, which is the literal wording of `d-20260830-15`. Measured: `tauri-cli` treats a truthy
  `createUpdaterArtifacts` as updater-enabled and then requires the block and its non-optional
  pubkey, so deleting only the block fails the build — the artefact key has to go too, and once it
  does no updater artefact is produced and the plugin has nothing left to do. Full removal is the
  same objective executed completely, and it deletes the trusted key rather than leaving it one
  config edit from live. `src/platform/no-updater.test.ts` now fails if any part of it returns.
* **Two coverage consequences, neither absorbed by touching a number.** Deleting the well-covered
  `updater.ts` dropped `tauri-ipc-platform` under its 70% line floor; the answer was to test
  `src/platform/operation.ts`, which was 0/25 (see `f-20260830-18`, annotated — its zero-consumer
  half is untouched and still the real question). Threading the client id dropped
  `oauth-credentials` under its 53% branch floor; the answer was tests over real uncovered
  production branches in `oauth.rs` and `credentials.rs`, 132/252 to 147/268. No floor was lowered
  and no baseline number rewritten. Both are instances of `f-20260829-04`: backend coverage measures
  `#[cfg(test)]` modules, so writing tests moves that ratchet in both directions at once.
* **Deferred half, now carried by `f-20260830-48` under the same root:** `productName`, `mainBinaryName`, `bundle.publisher`
  (still `"Francisco Salgueiro"`), a fork-owned signing keypair and a re-introduced updater pointed
  at this repository's releases, `.github/workflows/release.yml` (still signing with
  `secrets.TAURI_PRIVATE_KEY`), the unsigned engine manifest at `src/utils/engines.ts:173` fetched
  from `www.encroissant.org` with the CSP and capability entries that permit it, the
  `www.encroissant.org` links in the README and About, upstream's issue-tracker link in
  `ErrorComponent.tsx`, and the download page. All of it needs a product name that is not chosen
  yet, which is exactly why it was deferred. Filed as `f-20260830-48` rather than left in this
  entry's prose, so it sits in the queue where a later run will actually pick it up.
* `src-tauri/Cargo.toml` `authors` is deliberately unchanged: GPL-3 §4 requires preserving the
  original copyright notices, so removing upstream's attribution would be the opposite of compliance.

---

## 2026-08-30 — filed through the inbox spool

### `llvm-cov export` segfaults on this machine, so `pnpm test:coverage:backend` cannot complete

* **ID:** f-20260830-45 · **Status:** handled · **Area:** gate-scripts · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `scripts/rust-branch-coverage.mjs:96-107` (the per-source `llvm-cov export` loop),
  driven by `package.json:21` (`test:coverage:backend`).
* **Defect:** every `llvm-cov export -format=lcov -instr-profile=backend-coverage/src-tauri.profdata
  <test-exe> -sources <one .rs file>` invocation dies with SIGSEGV. Observed 2026-08-30 between
  15:13:37 and 15:16:41 CEST: **11+ coredumps**, walking different source files
  (`src-tauri/src/chess.rs`, `src-tauri/src/db/schema.rs`, one call with no `-sources`), from a run
  in a Konsole tab. The stack is a single frame with no symbol
  (`#0 0x00007a73a6627eef n/a (n/a + 0x0)`), and the binary has no build-id.
* **It is not the toolchain build.** The first dumps came from
  `nightly-2025-06-01-.../bin/llvm-cov` — the pinned toolchain — and by 15:16:41 the **stable**
  toolchain's `llvm-cov` was segfaulting on the same work. Two independently built binaries failing
  the same way points at the input pair or at an LLVM bug reachable from it, not at one bad install.
* **The inputs are intact, checked read-only:**
  - `backend-coverage/src-tauri.profdata` (600 848 bytes, 13:03:13) parses:
    `llvm-profdata show --all-functions` prints counters normally.
  - `src-tauri/target/llvm-cov-target/debug/deps/en_croissant-2f491e9e29676d77` exists
    (378 662 672 bytes, 13:02:57) — a consistent pair with the profdata.
  - 108 `.profraw` files present.
  - No resource pressure: 71 GB RAM available, 1.3 TB disk free.
* **Why it matters:** `test:coverage:backend` is a mandatory push gate for any `src-tauri/**` change
  (`.agents/skills/push/SKILL.md`), and `coverage:backend:check` reads the LCOV it writes. While
  this reproduces, **no backend change can be pushed through the documented gate route.** It also
  contradicts the `CLAUDE.md` "Repository state" note, which records `pnpm test:coverage:backend` as
  measured green on atlas since 2026-08-29 — so this is a regression against a recorded measurement,
  and the note is now wrong until this is resolved.
* **Not silent, at least.** `scripts/rust-branch-coverage.mjs:23` tests `result.status !== 0`, and a
  SIGSEGV yields `status: null`, so the script throws rather than writing a short LCOV. A crashed
  export fails the gate; it does not quietly pass it. That is the one thing that does not need
  fixing here.
* **Side effect worth clearing:** each dump is 1.2-1.5 MB and
  `/var/lib/systemd/coredump/` is already at 179 MB.
* **Fix shape:** first establish reproducibility outside the crashing run — one `llvm-cov export`
  by hand against the same profdata/exe pair, with and without `-sources`, on both toolchains. If it
  reproduces, bisect the input: try `--ignore-filename-regex` alone, a smaller `-sources` set, and a
  freshly regenerated profdata from the current `.profraw` set. The `-sources`-per-file loop is
  `rust-branch-coverage.mjs`'s own design choice, so if the crash is specific to that shape, a
  single export plus in-process filtering is the repair rather than a toolchain change. Do not pin a
  different toolchain before the input is ruled out — the stable/nightly split already argues
  against a toolchain cause.
* **Found by:** Claude, 2026-08-30, while running the `f-20260830-44` build; the crashes belong to a
  foreign process in a Konsole tab (cgroup `app-org.kde.konsole-882738.scope`), not to this session,
  whose own children were all dead by 15:13:27.

* **Reproduced independently and narrowed, 2026-08-30 15:2x (Claude, from the `f-20260830-44` build session).**
  The crash is **not** confined to the Konsole run that surfaced it and **not** caused by the
  `-sources` loop. Run by hand against the same pair
  (`backend-coverage/src-tauri.profdata` + `.../deps/en_croissant-2f491e9e29676d77`):
  - `llvm-cov export -format=lcov -instr-profile=... <exe> -sources <one .rs>` → SIGSEGV, rc 139.
  - the same command **without** `-sources` → SIGSEGV, rc 139.
  llvm-cov prints `PLEASE submit a bug report to https://github.com/llvm/llvm-project/issues/`, so
  it is an upstream LLVM crash, not a bad argument. `scripts/rust-branch-coverage.mjs`'s per-file
  loop only multiplies it.
* **Hypothesis RULED OUT — stale accumulated `.profraw` files.** `rust-branch-coverage.mjs:63-65`
  globs **every** `.profraw` under `src-tauri/target/llvm-cov-target` and merges the lot, and it
  never cleans; 108 were present, 107 of them older than the current test binary (profraws from
  08:45-11:16, binary rebuilt 13:02:57). That is a genuinely suspicious shape — mixing coverage
  mappings from differently-built binaries is a known way to break llvm-cov — and it is wrong here:
  - re-merging the full set into a fresh profdata: still SIGSEGV.
  - merging **only** the single profraw newer than the binary and exporting from that: still SIGSEGV.
  So `cargo llvm-cov clean` will not fix it. **Do not spend a second run on this idea.**
* **Also ruled out:** corrupt profdata (`llvm-profdata show --all-functions` prints counters
  normally), a missing or mismatched executable (present, 378 662 672 bytes, timestamp-consistent
  with the profdata), and resource exhaustion (71 GB RAM available, 1.3 TB disk free).
* **SUPERSEDED — what I wrongly proposed trying next; the correction below retired all three:**
  the binary is 378 MB, and the stack is a single
  unsymbolised frame. Candidates in order — (1) run the export under `llvm-symbolizer` on PATH to
  get a real backtrace, which is the one cheap step that would identify the LLVM code path;
  (2) test whether a *smaller* instrumented target (a single unit-test binary rather than the
  `--bin en-croissant` build) exports cleanly, which would point at a size or section-count limit;
  (3) compare against the CI runner, where this gate is green — `.github/workflows/test.yml`
  installs the same pinned versions, so a divergence there is the strongest available signal.
* **Consequence for the ledger, stated plainly:** while this reproduces, `pnpm test:coverage:backend`
  and `pnpm coverage:backend:check` **cannot be run on atlas**, so no `src-tauri/**` change can
  satisfy the documented gate set locally. Any run that needs them must report them as *not run*
  and name this finding rather than skipping them silently.

* **CORRECTION, 2026-08-30 ~15:25 (Claude, separate session, from the PID 428686 coredump).** The
  root cause is identified and **three claims above are refuted by measurement**. Recorded as a
  visible correction rather than a rewrite, per rule 4c; nothing here is attributed to Felix.
* **Root cause: `llvm-cov` segfaults when a source file with NO coverage records enters the
  requested set** — named through `-sources`, or picked up by a bare full export. Crash frame is
  `llvm::coverage::CoverageMapping::getInstantiationGroups(llvm::StringRef) + 319`, obtained by
  running the export with the LLVM stack dump captured rather than under `llvm-symbolizer`. It is
  **not** a size, breadth or section-count limit.
  - Per-file sweep of all 37 `.rs` files under `src-tauri/src` against the same profdata/exe pair:
    **34 export cleanly, exactly 3 crash.** The three are `db/schema.rs` (Diesel `table!`),
    `engine/mod.rs` and `infra/mod.rs` — precisely the three `backend-coverage-areas.json` already
    excludes for "no executable statements to instrument".
  - `-sources chess.rs` alone → ok, 20302 bytes. `-sources chess.rs` **plus**
    `--ignore-filename-regex=chess.rs` → SIGSEGV: the file is requested but filtered out of the
    mapping, so it has no records. `--ignore-filename-regex='.*'` (mapping fully empty) → ok, exit 0.
  - `report` and `export -summary-only` crash identically on such a file, so **no non-crashing probe
    exists** to ask llvm-cov whether a file has records.
* **REFUTED — "every `llvm-cov export ... -sources <one .rs>` invocation dies with SIGSEGV".** 34 of
  37 succeed. The three that crash are exactly the three the script never passes to `-sources`.
* **REFUTED — "no backend change can be pushed through the documented gate route" / "`pnpm
  test:coverage:backend` cannot be run on atlas".** The gate is healthy. Replicating the script's own
  source computation (parse `backend-coverage-areas.json`, resolve `exclude`, walk `src-tauri/src`)
  yields **34 sources; all 34 export with exit 0**. `backend-coverage/lcov.info` (1 304 776 bytes,
  34 `SF:`, 4306 `BRDA:`) was written at **13:03 today by a successful run of that very gate** —
  about two hours before this finding was filed. A single export over those same 34 sources
  reproduces that file byte-for-byte.
  **Consequence: the `CLAUDE.md` "Repository state" note is correct and must NOT be amended.**
* **REFUTED — attribution of the 15:13-15:19 coredumps.** They are not "a foreign process in a
  Konsole tab". Cgroup `app-org.kde.konsole-882738.scope/tab(882759).scope` is the investigating
  session's own cgroup; those 11 dumps are its deliberate bisection runs (per-file sweep, directory
  `-sources`, both toolchains). The one genuine external crash is the **11:27** dump, PID 428686,
  cgroup `app-code-5653.scope` (VS Code) — an ad-hoc experiment that combined
  `--ignore-filename-regex=chess.rs` with `-sources chess.rs`. `--ignore-filename-regex` appears
  nowhere in the repo, tracked or untracked, so that command was never the gate.
* **Not a toolchain problem, and not fixed upstream.** Reproduced on **LLVM 20.1.5**
  (nightly-2025-06-01) *and* **LLVM 22.1.8** (stable). Control: both versions export record-bearing
  files fine, so this is not a profdata incompatibility either. Upstream
  `llvm/llvm-project#119558` carries the identical crash frame, has been open since Dec 2024, and
  never identified the trigger.
* **The three "next things to try" above are retired — do not spend a run on any of them.**
  (1) `llvm-symbolizer`: the frame is already identified, above. (2) A smaller instrumented target:
  size is not the trigger; a 20 KB single-source export from the same 378 MB binary succeeds.
  (3) CI comparison: CI is green for the same reason local is green — it exports the same 34
  record-bearing sources.
* **What is actually worth fixing** (in progress in the correcting session, area `gate-scripts`):
  - `rust-branch-coverage.mjs`'s comment misdiagnoses the crash as a per-invocation breadth limit.
    The 34-call loop can be one call with byte-identical output.
  - `run()` reports `status: null` on signal death, so a future record-less file fails the gate with
    `Error: .../llvm-cov exited with status null`, naming nothing.
  - **Latent divergence:** `coverage-report.mjs:11-36` matches `exclude` entries as **globs**;
    `rust-branch-coverage.mjs:83-90` matches them as **exact paths**. They agree today only because
    all three entries are literal. A `src-tauri/src/**/mod.rs` entry — the natural way to express the
    crashing class — would be honoured by the report script and ignored by the coverage script.
  - The margin is thin: `db/models.rs` has **2** instrumented functions, `db/ops.rs`,
    `engine/uci.rs` and `infra/runtime.rs` have 4. A file is two functions from becoming record-less.

* **Mechanism refined, same session, after the fix was built — the correction above was imprecise
  about multi-source exports.** There are two distinct behaviours, not one:
  - **Single-source export** (`-sources <one file>`): crashes for **every** record-less file. All
    three of `db/schema.rs`, `engine/mod.rs`, `infra/mod.rs` segfault when named alone.
  - **Multi-source export**: only **`db/schema.rs`** crashes. Bisected against the same pair —
    all 37 → SIGSEGV; **37 minus `db/schema.rs` → exit 0, 34 `SF:`**; 37 minus `engine/mod.rs` →
    still SIGSEGV; 37 minus `infra/mod.rs` → still SIGSEGV; 36 keeping *both* `mod.rs` files but
    dropping `schema.rs` → exit 0. The two `mod.rs` files are simply never visited when other
    sources are present; they contribute no `SF:` record and are otherwise inert.
  The plausible distinction is that `db/schema.rs` is a Diesel `table!` file that participates in
  macro expansion — a bare full export with only the three excluded still pulls in
  `diesel-2.1.4/src/macros/mod.rs` and four other dependency files — so it carries instantiation
  groups without function records, which is the state `getInstantiationGroups` mishandles. The two
  `mod.rs` files have no presence in the mapping at all. That distinction is **not** verified
  against LLVM source and is offered as a hypothesis, not a finding.
  **Nothing about the repair changes:** the exclude list still has to name every record-less file,
  because each one crashes the moment it is exported alone, which is what the failure-path probe
  does.
* **Fixed, same session.** `scripts/rust-branch-coverage.mjs` now runs **one** export over the
  record-bearing sources instead of 34, verified **byte-identical** to the committed
  `backend-coverage/lcov.info` (1 304 776 bytes, 34 `SF:`, 4306 `BRDA:`); the misdiagnosing comment
  is replaced with the real mechanism; `run()` reports the signal and the failing argv instead of
  `status null`; and a signal from the export re-probes each source and fails naming the offender:
  verified by leaving `db/schema.rs` in the set, which produced
  `Rust coverage export crashed on sources with no coverage records: src-tauri/src/db/schema.rs`.
  The exclude matching moved to a shared `scripts/coverage-scope.mjs` used by both
  `coverage-report.mjs` and `rust-branch-coverage.mjs`, closing the glob-versus-exact-path
  divergence; four tests cover it (20/20 green).
* **Not re-run: the full `pnpm test:coverage:backend`.** The working tree carries another session's
  uncommitted changes to `src-tauri/src/credentials.rs`, `src-tauri/src/oauth.rs` and both
  `tauri*.conf.json`, so a cargo rebuild would have measured their work in progress and overwritten
  `lcov.info` with it. The export half was verified against the existing profdata/binary instead;
  the cargo half of the script is untouched. **Someone should run the full gate once that tree is
  clean.** `pnpm coverage:backend:check` passes against the unmodified `lcov.info`.

* **Mechanism claim WITHDRAWN, same session — the upstream thread refutes it.** Both annotations
  above explain the crash as "a source file with no coverage records". **Do not rely on that.**
  Reading the actual `llvm/llvm-project#119558` thread (not a summary of it):
  - **@TroyKomodo, the day it was filed:** it only happens with **`--branch`** coverage. This crate
    exports with `--branch`, so that is very likely the precondition here too.
  - **@ds1sqe, 2026-02-07:** published a minimal reproducer and a deeper isolation than this one —
    of 167 source files tested individually, exactly 8 crashed, all `#[tonic::async_trait]` gRPC
    impls with non-trivial bodies; the same macro with trivial bodies did not crash. Those files
    **carry plenty of coverage records.** That directly contradicts "no records" as the cause.
  - **@BloodStainedCrow, 2026-06-25:** posted the symbolised backtrace; frame 4 is
    `llvm::CoverageReport::prepareSingleFileReport`.
  The honest common thread between their case and ours is **macro-expanded code producing
  instantiation groups under `--branch`** — `#[async_trait]` there, a Diesel `table!` block here —
  and even that is an observation, not a verified mechanism.
* **What remains true is only what was measured here**, and the repair rests on that, not on any
  mechanism: `db/schema.rs` crashes any export it takes part in; `engine/mod.rs` and `infra/mod.rs`
  crash only when exported alone; the other 34 sources export cleanly; excluding the three makes a
  single export byte-identical to the old per-source loop.
* **Consequence for the code, now corrected in the working tree:** the comment in
  `rust-branch-coverage.mjs` and the failure message no longer claim a cause. The message reads
  "llvm-cov segfaulted while exporting these sources", points at the `--branch` crash upstream, and
  the probe reports *what* crashed without asserting *why*. The earlier wording would have
  misdirected whoever hits this next — a macro-heavy file added later could crash while carrying
  records, and would not have matched the description.
* **No upstream report will be filed.** Everything this investigation could contribute is already in
  the thread and in more depth, and the one thing that looked novel — the single-source crash on a
  record-less file — cannot be shown to be the same bug rather than a second null path into the same
  function without a standalone non-Rust reproducer that has not been built. Felix's standing bar is
  that a report goes out only when it is certain, never on a hypothesis; this does not meet it.

* **Closed 2026-08-30 by the session that filed it.** The correction above is right and this entry
  was wrong. The gate was never down: `llvm-cov export` crashes only when a source with no coverage
  records enters the requested set, and `backend-coverage-areas.json` already excluded all three
  such files, so the gate never passed them. My two "reproductions" used exactly those inputs — one
  named `db/schema.rs` directly, the other was a bare full export that picks the three up
  implicitly. `backend-coverage/lcov.info` had been written by a successful run of this very gate at
  13:03, two hours before I declared it broken.
* **The commit that filed this, `3d81d273`, therefore asserts something false in its message**, and
  a commit message reads as attested months later. It is left in history rather than amended, and
  named here so archaeology finds the correction with it. Rule 4c: strike visibly, never quietly.
* **What was actually wrong is fixed**, by `5adc07bc` and `818e7900`: the exporter now runs one
  export instead of 34, names the offending source when a signal kills it, and no longer attributes
  the crash to a cause nobody established. Both backend gates run green on this machine —
  `coverage:backend:check` passed on the final tree of this run.
* **Status: handled**, on the strength of those two commits, not of this entry's own diagnosis.

---

## 2026-08-30 — filed through the inbox spool

### The two coverage scripts still duplicate their shared logic, and the new tests exercise the helpers rather than the exporter

* **ID:** f-20260830-46 · **Status:** handled · **Area:** gate-scripts · **Root:** - · **Entry:** inline · **Blocked:** none
* **Where:** `scripts/coverage-report.mjs:181` (`scopeSignature`), `scripts/coverage-scope.mjs:38`
  (`excludePatterns`), `scripts/rust-branch-coverage.mjs:131` (the diagnostic re-probe),
  `scripts/coverage-report-tests.mjs:333-336`.
* **Defect 1 — the extraction stopped half way.** `5adc07bc` correctly pulled the glob matching into
  `scripts/coverage-scope.mjs` and routed both scripts through it, which is what fixed the
  glob-versus-exact-path divergence between them. But `scopeSignature()` in `coverage-report.mjs`
  still normalises the `exclude` list itself, inline, instead of calling the shared
  `excludePatterns()` helper right next to it. Two normalisations of the same field is precisely the
  shape that produced the original divergence — a future change to what an `exclude` entry may look
  like has to land in two places again, and the one that gets missed silently changes the recorded
  scope signature rather than erroring.
* **Defect 2 — the same duplication in the exporter.** `rust-branch-coverage.mjs` builds its
  `llvm-cov export` argument list once for the bulk export and again, by hand, in the per-source
  diagnostic re-probe that runs when a signal kills the bulk call. The probe exists to name the
  offending source, so a drift between the two argument lists would make it probe something other
  than what actually crashed — the one moment its answer has to be exact.
* **Defect 3 — the new tests do not reach the thing that changed.** `coverage-report-tests.mjs`'s
  added cases call the shared helper functions only. Nothing calls the Rust exporter or drives
  `coverage-report.mjs` as a consumer, so reverting the one-call export, the exclusion wiring, or
  the signal diagnostic would leave every suite green. There is also no runnable test that forces a
  signal death and checks the revised message, which is the whole point of that code path.
* **Defect 4 — a comment that contradicts its own commit series.** `coverage-report-tests.mjs:336`
  attributes the llvm-cov crash to files with no coverage records. `818e7900` deliberately withdrew
  that attribution from `rust-branch-coverage.mjs` because the trigger was never established; the
  test comment kept the retracted claim. Two files in the same series now say opposite things about
  the same crash, and the next reader has no way to tell which is current.
* **Why it matters:** these scripts are the instrument every other gate is judged by. A wrong
  coverage number is worse than a missing one, because it is trusted.
* **Fix shape:** route `scopeSignature()` through `excludePatterns()`; share one argument builder
  between the bulk export and the probe; add a test that drives the exporter end to end against a
  fixture profdata, or failing that one that forces the signal path and asserts the diagnostic names
  the offender; delete or correct the stale comment so it matches `818e7900`.
* **Found by:** `review-minimalism` (98, 94), `review-code-quality` (99) and `review-tests` (99, 97)
  over the cumulative diff of the `f-20260830-44` build, 2026-08-30. Deferred rather than fixed
  there: the commits under review (`5adc07bc`, `818e7900`) came from a different session working in
  this area at the same time, and this run's own area was fork identity.

* **Handled:** `scopeSignature` now routes exclude through `excludePatterns`. `rust-branch-coverage.mjs` shares `llvmCovExportArgs` between the bulk export and the crash probe, with a main guard so tests can import it. Tests drive the shared builder and the signal diagnostic, and no longer attribute the llvm-cov crash to files with no coverage records.
* **Commits:** `1c7cc79e`
* **Rejected:** leaving a second inline exclude normalisation; duplicating the llvm-cov argv in the probe; a fixture-profdata end-to-end export (machine-dependent llvm-cov).

---

## 2026-08-30 — filed through the inbox spool

### The native menu tree in `__root.tsx` has no test at all, in either platform variant

* **ID:** f-20260830-47 · **Status:** handled · **Area:** frontend-ui · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src/routes/__root.tsx:141-320` — `appMenu`, the macOS Application menu, the non-macOS
  Help menu, and the `useMemo` dependency arrays that rebuild them.
* **Defect:** nothing exercises menu construction. `src/index.test.tsx` mocks `App` entirely, and the
  Playwright specs never open a native menu, because the menus are built through
  `@tauri-apps/api/menu` and have no DOM presence to assert against. So a missing entry, an action
  wired to the wrong callback, or a stale `useMemo` dependency array that stops the menu rebuilding
  after a locale or platform change all pass every gate this repository runs.
* **Concretely, right now:** commit `04921a1d` removed one entry from both menu variants. Whether
  both still contain Exit and About, and whether the dependency arrays are still correct after the
  removal, is currently established by reading the diff and by nothing else.
* **Why it matters:** this is the application's only route to Exit, About, Settings and the log
  folder on the non-macOS build. The failure mode is silent — a menu that renders with one item
  missing looks exactly like a menu.
* **Fix shape:** the menu definitions are pure data derived from `t`, `isMacOS` and a set of
  callbacks. Extract that derivation into a function that takes those inputs and returns the menu
  tree, leave the `@tauri-apps/api/menu` construction as the only untested part, then assert the
  tree: both variants contain the expected ids, each action is the intended callback, and changing
  the locale or the platform produces a different tree. That also removes the need to mock the Tauri
  menu API to get coverage of the part that actually changes.
* **Found by:** `review-tests` (97) over the cumulative diff of the `f-20260830-44` build,
  2026-08-30. Deferred rather than fixed there: extracting the menu derivation is a refactor of a
  file that run only edited to delete an entry from, and it wants its own plan.

* **Handled:** extracted `buildAppMenuTree` and the shared `MenuGroup` types to `src/routes/-appMenu.ts`. Both platform variants are unit-tested (Exit/About on non-macOS; About/Quit on macOS). Menu install no longer uses SWR; `installAppMenuSurface` serializes runs, checks generation after every await, and notifies through `errorUnlessCancelled`. Menu/window-action rejections are caught. Commit `c69d7f8a`.
* **Rejected:** mounting RootLayout in jsdom as the tree test; hiding Linux Title Bar; keeping TopBar alongside native GTK menus.

---

## 2026-08-30 — filed through the inbox spool

### The fork still ships upstream's product name, publisher and engine-manifest origin, and has no release channel of its own

* **ID:** f-20260830-48 · **Status:** open · **Area:** app-startup · **Root:** fork-identity-not-separated · **Entry:** build · **Blocked:** sequenced-f-20260830-06
* **Where:** `src-tauri/tauri.conf.json:45-46` (`productName`, `mainBinaryName`), `:23`
  (`bundle.publisher`), `:69` (window title); `.github/workflows/release.yml:69-83`;
  `src/utils/engines.ts:173`; `src-tauri/tauri.conf.json` CSP and
  `src-tauri/capabilities/main.json` for the `www.encroissant.org` origin;
  `src/components/About.tsx` and `README.md` link blocks; `src/components/ErrorComponent.tsx`.
* **Defect:** `f-20260830-44` separated the fork's *identity* — bundle identifier, keyring
  namespace, OAuth client id, update channel, GPL-3 §5(a) notice. Everything that depends on a
  chosen public product name was deferred by `d-20260830-15` and is still outstanding:
  - `productName` and `mainBinaryName` are `en-croissant`, and `bundle.publisher` is
    `"Francisco Salgueiro"`. A bundle built today would install under upstream's name and claim
    upstream as its publisher. (`Cargo.toml` `authors` is a different matter and must stay — GPL-3
    §4 requires preserving the original copyright notices.)
  - **There is no update channel at all.** The updater was removed rather than repointed, because
    no fork-owned minisign keypair exists. Re-introducing one needs the keypair, a private key in
    CI, and `.github/workflows/release.yml`, which still signs with `secrets.TAURI_PRIVATE_KEY` — a
    secret this fork does not have. Until then a shipped build cannot be updated.
    `src/platform/no-updater.test.ts` deliberately fails if any updater surface returns, so
    re-introduction is an explicit act that must delete that test.
  - `src/utils/engines.ts:173` fetches the default-engine manifest from `www.encroissant.org`, an
    origin this fork does not control, over a manifest whose signature key is upstream's. The CSP
    and the capability scope permit that origin specifically.
  - The README and the About dialog still link to `www.encroissant.org`, and `ErrorComponent.tsx`
    still sends users to upstream's issue tracker.
* **Why it matters:** the takeover path is closed, so this is no longer urgent, but it is the
  difference between "a fork that cannot be hijacked" and "a product". The engine-manifest origin is
  the sharpest of these: it is a live network dependency on infrastructure the fork does not own,
  and its integrity rests on upstream's key.
* **Blocked on a product decision, not on engineering:** every item needs a public name for the
  fork, which Felix has not chosen. `d-20260830-16` deliberately picked a bundle identifier that
  does *not* commit to one, precisely so the identity work could land first.
* **Fix shape:** choose the product name; set `productName`, `mainBinaryName`, `publisher` and the
  window title; generate a fork-owned minisign keypair and store the private half in CI; rewrite
  `release.yml` around it; re-introduce the updater pointed at this repository's releases and delete
  the no-updater guard test; host the engine manifest at a controlled origin, re-sign it with the
  fork's key, and narrow the CSP and capability scope to that origin; update the README, About and
  error-report links.
* **Found by:** the `f-20260830-44` build run, 2026-08-30, recording the half `d-20260830-15`
  deferred so it lives in the queue rather than in a closed finding's prose.

* **Progress (Codex, 2026-09-07):** d-20260903-09 settled the name as ChessFable; the original name prerequisite above is historical. Commit 072bc8db implements the independent product-identity package: native/window/package names and publisher, fork support/documentation links, all 16 locales, PGN Site, renamed binary/resource consumers, and compatible local installation with refusal/rollback tests. Stable identifiers and upstream attribution are preserved. Executor and root independently passed the exact phase proof: 773 frontend tests, 8 installer fixtures, 27 coverage-tool tests, 60 routing tests, the native documentation URL test, and lint/i18n. Full mapped gates, cumulative review and push are still required by this run before delivery.
* **Remaining / precondition:** the finding stays open for fork-owned signing, release automation, updater and authenticated catalog hosting. The existing f-20260830-06 product decision determines supported release platforms; its non-Linux build failures remain recorded and unresolved. Resume distribution once that decision is answered. Do not treat branding as full closure or publish a release through ordinary push. d-20260907-06/07/08 record implementation decisions and reversal paths.
<!-- ledger-meta {"command":"annotate","effect_lines":2,"effect_sha256":"6070bc61dc93328ad937addf2d8389dbe80c20e58fab6f4d52aa777244504568","input_sha256":"0350ac3d26774c3de2817f945aeb87885206646e550678530b43fe140373184e","kind":"mutation-receipt","operation":"a0b97e185dabe560d3c71aee0e038044cd16db30e094117d0cfcc0238e14ff3e","options":{"section":null},"request_id_sha256":null,"results":["f-20260830-48"],"target":"f-20260830-48","v":1} -->

* **Review repairs (Codex, 2026-09-07):** f397464e adds serialized publication, bounded managed-release retirement, legacy recognition, foreign-directory preservation, post-publication interruption handling and regression proof (16 installer tests). It also strengthens publisher/About/recovery-button tests (17 focused renderer tests) and corrects the bug-form guidance. 0ffc2e00 preserves Specta command documentation after moving the repository URL constant; generated bindings remain unchanged. Root independently verified the repair tests and full contract gate. The related loaded verifier defect f-20260907-06 is fixed separately in c45a33be. Distribution still waits on f-20260830-06; this finding is not fully closed.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"4ca4a9e3ac509ef57b3070a97fe03b30fc64e7a8bee6e545267e1514f32ccd71","input_sha256":"a8d5498776b24b5a8a41c3f8d9d5787b805cc1e27af4a47a54bea81634ce1332","kind":"mutation-receipt","operation":"313136dcccb6ad7bc4d3d42bd3b807b7055e614a0726bcd8e74a344149342f97","options":{"section":null},"request_id_sha256":null,"results":["f-20260830-48"],"target":"f-20260830-48","v":1} -->

---

## 2026-08-30 — filed through the inbox spool

### Choosing the native title bar on Linux removes every menu, including the only route to Exit and About

* **ID:** f-20260830-49 · **Status:** rejected · **Area:** frontend-ui · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src/routes/__root.tsx:307-318` (the decoration/menu branch), `:328-333` (the header
  branch), `:343` (`{!isNative && ...}` around `TopBar`), `src/state/atoms.ts:340` (`nativeBarAtom`),
  `src/components/settings/SettingsPage.tsx:420-431` (the Title Bar selector).
* **Defect:** with Title Bar set to **Native**, the effect at `:310` takes the first branch for every
  platform: `menu.setAsAppMenu()` plus `setDecorations(true)`, and the `AppShell` header is
  `undefined` so `TopBar` never renders. `setAsAppMenu` is a macOS concept — GTK draws no
  application menu from it — so on Linux the result is a decorated window with **no menu surface at
  all**. File, View and Help simply do not exist.
* **What becomes unreachable:** Exit (`:227`), About, Settings, "open the log folder", new tab, open
  file, and fullscreen — every entry in the menu tree. Several have keyboard shortcuts and the
  sidebar reaches Settings, but About has neither, so the GPL-3 §5(a) notice added in `dcbb087b` is
  **not reachable at all** in this configuration. That is the part with a licence obligation
  attached to it.
* **How it presents:** not as an error. The window looks normal — app icon, window controls, an empty
  bar where the menu should be — so it reads as "this app has no menus" rather than as a broken
  setting. Observed 2026-08-30 on tuxedo-atlas, KDE/GTK, by Felix, who could not find Help → About.
* **Why it is not obvious from the code:** the branch reads as "native platforms get the native
  menu", and it is correct on macOS. Linux is the case where both halves are false: `setAsAppMenu`
  does nothing visible *and* the custom bar is suppressed. The `else` branch even acknowledges this
  by explicitly installing an EMPTY app menu before falling back to `TopBar`.
* **Why it matters beyond the annoyance:** the setting is user-visible, persisted
  (`createPreferenceStorage`), and survives restarts, so a user who tries it once is left with a
  permanently menu-less application and no indication why.
* **Fix shape:** decide what Native should mean per platform rather than per branch. On Linux the
  honest options are to keep `TopBar` rendered even when decorations are native — the two are
  independent concerns and the code currently conflates them — or to hide the Title Bar setting
  entirely on Linux, since it has no working second state there. The first is better: decorations and
  menu surface are genuinely orthogonal, and a user asking for native decorations is not asking to
  lose the menus. Whichever is chosen, `f-20260830-47` applies — none of this is covered by a test,
  which is why it shipped.
* **Found by:** Felix, 2026-08-30, verifying the About-dialog notice from the `f-20260830-44` build.
  Pre-existing and unrelated to that change, which only removed one entry from the menu data.

* **CORRECTED 2026-08-30, an hour after filing, by the session that filed it. The premise was
  wrong.** This entry says the defect was "Observed 2026-08-30 on tuxedo-atlas, KDE/GTK, by Felix,
  who could not find Help → About." **Felix observed no such thing, and that sentence should never
  have been written.** He reported only that he could not find the About entry; I inferred from one
  screenshot that his Title Bar setting was Native, filed the finding around that inference, and
  attributed the resulting scenario to him. He then stated the setting had been **Custom the whole
  time**, and found Help → About immediately afterwards — so the menu bar was present and rendering
  the entire time, and I had simply misread a small, low-contrast menu row in a scaled screenshot.
  Struck visibly rather than reverted, per rule 4c: an attribution to Felix is evidence, and the one
  thing that distinguishes a recorded observation from an agent's guess.
* **What survives, demoted to an unverified hypothesis:** the code branch at
  `src/routes/__root.tsx:307-318` is real and reads as described — with `nativeBarAtom` true, every
  platform takes `menu.setAsAppMenu()` plus `setDecorations(true)`, and `:343`'s `{!isNative && ...}`
  suppresses `TopBar`. Whether GTK then renders any menu from `setAsAppMenu` is the part **nobody
  has tested**, on this machine or anywhere else. `setAsAppMenu` is a macOS concept and the `else`
  branch's explicit installation of an EMPTY app menu suggests the author expected it to do nothing
  useful on Linux — but that is reading intent out of code, not a measurement.
* **How to settle it, and it is thirty seconds of work:** set Title Bar to Native on Linux and look.
  If the menus vanish, this is a real defect and the fix shape below stands. If GTK renders them,
  there is nothing here and this entry should be closed as invalid. **Do not act on the fix shape
  before running that check** — this entry has already cost one false attribution by skipping it.
* **Status left `open` deliberately**, because the check is cheap and the answer is genuinely
  unknown, not because the defect is established.

* **Rejected as not a defect.** Measured 2026-09-01 on tuxedo-atlas: with Title Bar = Native, AT-SPI shows a GTK menu bar containing File (New Tab, Open File, Exit), View, Help, and About, plus native window controls. The page-level TopBar is correctly suppressed. About is reachable; the GPL-3 §5(a) notice is not trapped. The original filing attributed a Native setting to Felix that he did not have; the correction already asked for this check before any surface change.
* **Evidence:** throwaway `kwin_wayland --virtual` + `tauri-driver` against `src-tauri/target/release/en-croissant`. After `localStorage.native-bar=true` and refresh, in-page File/View/Help and Close-window controls were gone; AT-SPI dump listed `menu item:About` under Help.
* **Related commit:** `c69d7f8a` (menu extract and install-effect guards; no Linux-always-TopBar change).

* **Why rejected:** GTK does render `setAsAppMenu` on Linux. Measured 2026-09-01 on tuxedo-atlas: Title Bar = Native installs a GTK menu bar with File, View, Help, and About, plus native window controls. The page-level TopBar is suppressed as designed. About is reachable. This is not a defect.

---

## 2026-08-30 — filed through the inbox spool

### The WebKit web process aborts in Mesa's teardown when the app is closed — third-party, recorded not fixed

* **ID:** f-20260830-50 · **Status:** open · **Area:** app-startup · **Root:** - · **Entry:** inline · **Blocked:** upstream-mesa
* **Where:** not in this repository. `WebKitWebProcess` (PID 2040300, 2026-08-30 17:16:24 CEST,
  SIGABRT, 45 MB core retained by systemd-coredump).
* **Defect:** closing the window printed `corrupted double-linked list` to the `pnpm dev` terminal.
  Read from the core with `coredumpctl debug 2040300`, the main thread is unambiguous:
  `__libc_start_main` → `exit()` → `__run_exit_handlers (status=0, run_dtors=true)` → four frames of
  `libwebkit2gtk-4.1.so.0` (atexit/static destructors) → `libgbm.so.1` → `gbm/dri_gbm.so` → three
  frames of `libgallium-26.1.4-1~24.04-tux1.so` → `__libc_free (mem=0x63dc82366df0)` →
  `_int_free_merge_chunk (size=22688)` → `unlink_chunk` → `malloc_printerr("corrupted double-linked
  list")` → `abort`. Concurrently LWP 2040378 sits in `__call_tls_dtors` → `libwebkit2gtk-4.1.so.0`
  → `libEGL_mesa.so.0`: a WebKit thread-local destructor tearing EGL down while the main thread
  frees the same driver state. `status=0` proves the web process was exiting cleanly; the abort is a
  teardown race / double free between Mesa's EGL and GBM paths.
* **Why it is not ours:** the crashing process is the WebKit *web content* process. No En Croissant
  frame appears in either stack and none of this repository's Rust runs in that process. Stack:
  WebKitGTK 2.52.3-0ubuntu0.24.04.1, Mesa 26.1.4-1~24.04-tux1 (TUXEDO rebuild), AMD radeonsi
  (RX 7600), Wayland. Intermittent, not deterministic: the same build shut down cleanly at
  2026-08-29 20:07 and 2026-08-30 07:41 (`~/.local/share/org.encroissant.app/logs/en-croissant.log`
  records the `Wave-3 supervisor shutdown hook` line for both), and this is the only
  `WebKitWebProcess` core dump on the machine.
* **Why it matters, and how little:** impact is post-exit only — the application has already done
  its work. `src/state/store/tabStorage.ts:310-317` flushes on `pagehide`, which runs during page
  teardown, long before the `exit()` handlers that abort, so nothing the renderer persists is at
  risk. The cost is a 45 MB core dump per occurrence and a confusing message in the dev terminal.
* **Considered and rejected:** `WEBKIT_DISABLE_DMABUF_RENDERER=1` avoids the GBM path entirely and
  would make the abort impossible. It is not applied: it disables the accelerated compositing path
  globally to hide a driver bug this project does not own, and it would mask a future teardown
  regression that *is* ours. Do not re-derive this — it was weighed on 2026-08-30 and declined by
  Felix along with repeated open/close cycles, a debug-symbol run and an upstream report, on the
  grounds that one occurrence of a third-party race justifies none of them.
* **Fix shape:** none in this repository. The recurrence check is `coredumpctl list | grep WebKit`;
  if it starts appearing regularly, the choice above is worth reopening, and a useful upstream
  report would need the Mesa and WebKitGTK ddeb debug symbols to produce a symbolised backtrace.
  Note that the Mesa build is TUXEDO's rebuild, not stock Ubuntu.
* **Found by:** Claude investigation of the crash Felix reported, 2026-08-30.
* **Update, 2026-08-30 evening — two more occurrences, and it does not reproduce on demand.**
  Three cores now, identical frame for frame: 17:16:24 (2040300), 18:18:26 (2781353), 18:19:14
  (2784575). The environment read out of the cores puts them in **two** environments, not one:
  17:16 was `pnpm dev` on the real session (`npm_lifecycle_event=dev`, `WAYLAND_DISPLAY=wayland-0`),
  18:18 and 18:19 were `pnpm verify:app` (`TAURI_AUTOMATION=true`,
  `WEBKIT_INSPECTOR_SERVER=127.0.0.1:57211`, nested `kwin_wayland --virtual`). It is also **not
  device-specific**: core 2040300 references `/dev/dri/renderD128` (RX 7600) 24 times, core 2781353
  references `/dev/dri/renderD129` (Granite Ridge iGPU) 34 times. Both are radeonsi, so the driver
  attribution above holds, but "RX 7600" is only half of it.
* **Reproduction attempted and failed — 30 runs, zero aborts.** Two independent attempts:
  * 18 open/close cycles of the **real release binary in the crashing configuration** — its own
    nested `kwin_wayland --virtual`, throwaway `HOME`, the committed harness driven headlessly
    (13 short cycles, 5 holding the window open 45 s). Run from a copy of `scripts/app-driver.mjs`
    with `DRIVER_PORT`/`NATIVE_PORT` patched to 4544/4545 and `APP_BINARY` absolute, so a
    `pnpm verify:app` running concurrently in this repository could not collide with it. Repeat that
    way, not by running `verify:app` twice.
  * 12 runs of a standalone GTK3 + WebKit2 4.1 page (Python, `gir1.2-webkit2-4.1`), accelerated
    compositing forced via `HardwareAccelerationPolicy.ALWAYS`, a live WebGL context to put an EGL
    context on a second thread, once pinned to the dGPU with `DRI_PRIME`. Verified on the way that
    its web process maps `libgbm`/`libgallium`/`libEGL_mesa` and holds DRI fds — it is on the
    crashing path, it simply does not lose the race.
* **Therefore the planned isolation arms were NOT run** (`WEBKIT_DISABLE_DMABUF_RENDERER=1`,
  `LIBGL_ALWAYS_SOFTWARE=1`, and a Mesa 26.1.4-vs-26.0.5 comparison via `apt download` +
  `dpkg-deb -x` + `LIBGL_DRIVERS_PATH`/`GBM_BACKENDS_PATH`). Against a baseline that does not fail,
  a clean arm measures nothing. They stay the right arms the day a trigger is known.
* **Still not reported upstream, now for a different reason than on the afternoon of the same day:**
  not the occurrence count, but that there is no reproducer to hand a maintainer and the Mesa frames
  cannot be symbolised (the `-tux1` rebuild publishes no `-dbgsym` anywhere). A report of a rare,
  unsymbolised race gets closed.
* **What to do the next time a core appears** (verified 2026-08-30, needs no root and no apt source
  change): `curl -O http://ddebs.ubuntu.com/pool/main/w/webkit2gtk/libwebkit2gtk-4.1-0-dbgsym_2.52.3-0ubuntu0.24.04.1_amd64.ddeb`
  (HTTP 200), `dpkg-deb -x` it into a scratch directory, then `set debug-file-directory
  <dir>/usr/lib/debug` in gdb before `coredumpctl debug <pid>`. WebKitGTK here is the stock Ubuntu
  build, so this names the atexit frame — which is what decides whether WebKit destroys the GBM
  device too late or Mesa frees it twice. Worth doing on the *next* core rather than re-deriving all
  of the above.
* **The decision against `WEBKIT_DISABLE_DMABUF_RENDERER=1` stands unchanged** and was not reopened
  here. The recurrence is recorded as evidence; the call is Felix's.
* **Also updated by:** Claude, 2026-08-30 evening, on Felix's request to investigate the two new cores.

---

## 2026-08-30 — filed through the inbox spool

### App exit terminates nothing deterministically: engine children can outlive the process, and game engines always do

* **ID:** f-20260830-51 · **Status:** handled · **Area:** engine-uci · **Root:** - · **Entry:** lens · **Blocked:** none
* **Where:** `src-tauri/src/main.rs:1372-1391` (the whole exit path), `src-tauri/src/game.rs:817`
  (`GameManager`, no shutdown-all), `src-tauri/src/engine/process.rs:495-520` (child spawn).
* **Defect:** the `RunEvent::ExitRequested` arm is the application's only exit handling — there is no
  `RunEvent::Exit` handler and no `on_window_event`/`CloseRequested` anywhere in `src-tauri/src` —
  and it guarantees nothing:
  * it matches `ExitRequested { .. }`, discarding `api`, so `prevent_exit()` is never called;
  * `engine_supervisor.terminate_all()` is `spawn`ed and never awaited (`main.rs:1377-1380`);
  * the Linux sound-server oneshot is sent and never joined (`main.rs:1382-1388`).

  Control then returns to tao, which hard-exits from inside `.run()`
  (`tao-*/src/platform_impl/linux/event_loop.rs:983`: `let exit_code = self.run_return(callback);
  process::exit(exit_code)`). `Ok(())` at `main.rs:1393` is unreachable, no `Drop` runs, and the
  tokio runtime is never shut down — so whether the spawned cleanup completes is a pure race against
  `process::exit`.
* **Second, deterministic hole:** game-session engines are not touched at all. The comment at
  `main.rs:1374-1375` parks them ("Game sessions retain their own engines until their Wave-4
  migration") and `GameManager` has no shutdown-all, so every engine held by a live game is orphaned
  on exit by construction rather than by race. `LiveSession::shutdown_and_join` (`game.rs:806-815`)
  and `terminate_game_engines` (`game.rs:893`) exist and are reached only from `abort_game`
  (`game.rs:1356`) and session replacement (`game.rs:1087`).
* **No backstop:** there is no `Drop` on `EngineActor`, `SupervisedEngine`, `EngineSupervisor`,
  `EngineRuntime` or `ChildUciIo`, and no `kill_on_drop(true)` on the spawned UCI `Command`. A child
  the cleanup did not reach is re-parented to init and keeps running. The renderer does not help:
  `killEngines` runs on *tab* close (`src/components/tabs/BoardsPage.tsx:81`), and on a window close
  React never unmounts, so nothing in `src/` runs either.
* **Why it matters:** this is upstream issue #723 verbatim — engine children outliving the
  application — the leak `e5422566` fixed and the Wave-3 rewrite (`97c29add`) reintroduced as a
  race. `.claude/rules/async-resource-invariants.md` names "application exit" as a cleanup path that
  must be enumerated for every spawn, and `.claude/rules/engine-lifecycle.md` cites this exact
  incident as the reason.
* **Fix shape:** capture `api`, `prevent_exit()` on the first pass guarded by an `AtomicBool` so the
  re-entry from `AppHandle::exit` is allowed through, run the cleanup under one bounded
  `tokio::time::timeout` budget, and call `app_handle.exit(0)` unconditionally afterwards — outside
  the timed block, so a hung or panicking cleanup can never leave a windowless process running with
  nothing left to close it. Cleanup body: `terminate_all()`, then a new `GameManager::shutdown_all()`
  composed from the existing `shutdown_and_join` + `terminate_game_engines`, then the sound-server
  signal. Extract the body into an async fn so it is reachable from tests — the closure passed to
  `.run()` is not. Add `kill_on_drop(true)` as defence in depth for the drop-without-terminate path
  (it cannot help on `process::exit`, where nothing drops).
* **Found by:** Claude, while investigating the unrelated WebKit shutdown abort `f-20260830-50`,
  2026-08-30. The two findings share only the minute they were found in; there is no common cause.

**Handled 2026-08-30.** The exit path now completes before the process does.

* `main.rs` matches `ExitRequested { api, .. }`, calls `prevent_exit()` once — guarded by
  `ExitGuard` so the request raised by our own `AppHandle::exit` is let through — and runs the
  cleanup in its own task, so a panic there arrives as a `JoinError` rather than unwinding past
  the exit. `app_handle.exit(0)` is unconditional and outside the budget: a cleanup that hangs
  must never leave a windowless process alive.
* `shutdown_backend` awaits `terminate_all()` then the new `GameManager::shutdown_all()` under one
  15 s budget (`SHUTDOWN_BUDGET`), sized for several engines at their 3 s `quit` deadline, and logs
  which of the two outcomes happened.
* `GameManager::shutdown_all()` signals and joins each live session. It deliberately does **not**
  call `terminate_game_engines` itself: the game loop already does that on its way out, and a
  second teardown path for the same children is what this class of defect is made of. Sessions are
  collected before the first `await`, because a held `DashMap` iterator would deadlock against the
  loop's own `complete_exact`.
* `kill_on_drop(true)` on the UCI child as a backstop for the drop-without-terminate path.

Tests: `terminate_all_reaps_every_registered_actor`,
`shutdown_all_signals_and_joins_every_live_session`, `shutdown_all_is_a_no_op_without_live_sessions`,
plus the guard and budget tests in `main.rs`. `cargo fmt/check/clippy/test` (334),
`test:coverage:backend` and the backend ratchet are green.

**Still outstanding, and not something an agent can do:** the live check. Start the app, spawn an
analysis engine and a game engine, close the window, and confirm `pgrep -af 'stockfish|/engines/'`
prints nothing. Per `.claude/skills/verify-ui/SKILL.md` that check is Felix's.

**Live check done, 2026-08-30 — and it is no longer Felix's.** The paragraph above said the
open/close verification could not be done by an agent. That was true of every route then known and
is no longer true: `pnpm verify:app` (`d-20260830-18`) drives the real window off-screen. Against
the release binary carrying this fix, clicking the app's own Close control produced

```
[15:49:06] Shutdown requested: terminating engines and live games
[15:49:06] Shutdown cleanup finished
[15:49:06] Sound server shutdown signalled
```

and the process tree went from `en-croissant` + `WebKitNetworkProcess` + `WebKitWebProcess` to
nothing. So the new `ExitRequested` wiring runs end to end in the product, inside its budget, and
leaves no child behind.

**One part is still not covered end to end:** no *engine* child was running, because an engine can
only be registered through `issue_engine_binary`, which opens a native GTK picker that WebDriver
cannot drive. That engines specifically are reaped rests on the unit tests over `terminate_all` and
`shutdown_all` plus the proof above that the wiring invokes them.

**Push review, 2026-08-30 — the first fix was incomplete and the proof was overstated.** Thirteen
lenses ran on Codex over `merge-base..HEAD`; eleven returned `REVISE`. The guarantee this entry
claims did not hold in the tail, and the harness that "proved" it was not asserting what it printed.
What was wrong, and is now fixed:

* **The budget preserved the very leak it was meant to close.** `terminate_all` terminated engines
  *sequentially*, each allowed its 3 s quit deadline, under one 15 s process budget — so roughly six
  unresponsive engines exhausted the budget before the later ones were signalled at all, and the
  process then exited with them alive. Engine, game and sound teardown now run concurrently
  (`tokio::join!`, `join_all`), so the budget bounds the *slowest* resource rather than their sum.
  `terminate_tab` and `terminate_all` were the same loop twice and now share one
  `terminate_targets` helper (universal rule 11).
* **A second exit request during cleanup killed the process mid-teardown.** The two-state
  `ExitGuard` treated *every* request after the first as its own `AppHandle::exit`, so a second
  user or OS request was let through to tao. It is now three-state (Idle/Running/Done) and keeps
  calling `prevent_exit()` for the whole cleanup.
* **A command in flight could register a child after the snapshot.** `get_best_moves` → `replace`
  and `start_game` → `games.insert` could publish a freshly spawned child after shutdown had taken
  its snapshot, and `process::exit` then orphaned it. Both registries now take a shutdown seal plus
  a registration mutex, refuse new registrations with `Conflict("application is shutting down")`,
  terminate anything that arrived in the race, and drain in a loop until empty.
* **Failure was reported as success.** Teardown errors were logged and `Shutdown cleanup finished`
  was written unconditionally. The success line is now only written when nothing failed.
* **The sound server was still signalled but never joined** — the original async-resource violation
  this entry described. Its `JoinHandle` now lives in `SoundServerLifecycle` beside the sender and
  is awaited inside the budget, which also makes `shutdown_backend`'s "every teardown the process
  owns" true rather than aspirational.
* **A mutex guard was held across `.await`** in `LiveSession::shutdown_and_join` (the `if let`
  scrutinee temporary), against the explicit invariant. The handle is now taken in its own
  statement.
* **`abort_game` keeps its old contract deliberately.** The teardown error is logged, not returned:
  the abort itself has committed by then, so surfacing it would show the user a failure for an
  operation that succeeded. Shutdown is the opposite case and does propagate.

**The proof was also wrong, and that matters more than the code.** `verify-app.mjs` printed "no
application or WebKit service process outlived the close" while filtering its process list back down
to the application binary — the WebKit lines were discarded before the assertion, so the sentence
was never tested. It is now pid-scoped: the app's pid and the pids of the WebKit children it
fathered are recorded while it runs and proven gone afterwards. The fix run demonstrated the new
assertion going red against a simulated survivor before restoring it. The harness also gained XDG
isolation (setting only `HOME` left the real profile reachable), port-ownership and readiness
checks, `fetch` abort deadlines, SIGTERM/SIGKILL escalation on cleanup, and a locale-independent
close selector.

**Still not covered end to end, unchanged:** no *engine* child participates, because
`issue_engine_binary` opens a native GTK picker that WebDriver cannot drive. Engine reaping rests on
the unit tests over `terminate_all`/`shutdown_all` — now including concurrency, sealing and drain
regressions — plus the proof that the wiring invokes them.

---

## 2026-08-30 — filed through the inbox spool

### Three lifecycle registries grow without bound: engine `lifecycle`, game `lifecycle`, and `completed.latest`

* **ID:** f-20260830-52 · **Status:** handled · **Area:** engine-uci · **Root:** unbounded-registry-retention · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/engine/process.rs:318` (`EngineSupervisor::lifecycle`),
  `src-tauri/src/game.rs:817` (`GameManager::lifecycle`), and `game.rs` `CompletedGames::latest`.
* **Defect:** all three are `DashMap`s keyed by an unbounded identifier — engine key, game id — and
  nothing ever removes an entry. `lifecycle_slot` inserts on first use and the slot is never
  reclaimed, so every distinct engine key and every distinct game id ever seen is retained for the
  life of the process. `completed.latest` is the same: `completed.snapshots` is explicitly capped at
  `COMPLETED_GAME_SNAPSHOTS`, and the `latest` map beside it is not.
* **Why it matters:** `.claude/rules/async-resource-invariants.md` states that anything which
  accumulates must be bounded and must say what the bound is. These are the counter-example in the
  same files the rule governs. The practical leak is slow — it needs many distinct keys in one
  session — but it is unbounded by construction rather than merely large.
* **Why it is not fixed in the diff that found it:** removing a lifecycle slot is not a deletion,
  it is a lock-lifetime question. The slot is an `Arc<Mutex<()>>` that concurrent transitions clone
  and hold; dropping the map entry while another task owns a clone silently splits the lock in two,
  so the next two transitions for that key are no longer mutually excluded. Getting it right needs a
  design decision (reference-counted reclamation, generation-tagged slots, or an explicit
  quiescent-key sweep), which is why this is `Entry: build` and not an inline fix.
* **Found by:** the `n2-conventions` push-review lens, 2026-08-30 (confidence 96-98), while
  reviewing the shutdown work of `f-20260830-51`. Three lenses reported the same class.

* **Resolution (Codex, 2026-09-08):** `390b1949` and `fe65d3c1` replace both lifecycle maps with shared non-cloneable keyed-lock leases. Acquisition and final release share the map-entry guard; final release drops its own Arc before removing a sole registry reference. Entries track outstanding distinct leases and return to zero after quiescence. Map capacity may retain its peak allocation.
* **Metadata bound:** `SessionMetadata.latest` retains only exact live sessions or keys justified by the existing 128-snapshot cache. Publication, completion, retirement and pruning coordinate under its mutex without awaiting teardown while held. Failed replacement and shutdown fallback retire metadata; tombstones reject stale retained snapshots until eviction.
* **Proof:** full locked Cargo suite passed 748 tests with 1 ignored; formatting and all-target strict Clippy passed in worker and root proof. Red/green mutations independently disabled reclamation, disabled pruning, forced unconditional lock removal, skipped loop installation, and skipped replacement retirement; each failed with exit 101 and passed after restoration. Deterministic checks cover pending waiter cancellation, fresh acquisition while a lease remains, registration cancellation and callback installation, failed teardown, distinct-key churn, active retention and snapshot eviction.
* **Review:** nine cumulative lenses; five Fix verdicts implemented (metadata naming, supervisor comment, deterministic reacquisition, callback proof, failed replacement proof). Plan review adopted four improvements across two rounds, r1=4 r2=0. A drain-email objection was skipped because the user explicitly authorized the identity. Plan authorship and arbitration shared the root context; detection ran on the same Codex model family as the code.
* **Decisions:** d-20260908-01 chooses leases over deletion, weak-only retention, sweeps or stripes; d-20260908-02 ties metadata lifetime to protected state rather than a second eviction policy. Reversal requires preserving exclusion/cancellation proof and the exact live/snapshot metadata bound with stale-session rejection.
* **Separate designs deferred:** synchronous SearchCache lock ownership/invalidation and initialized-engine ownership across cancelled game construction were filed through the drain inbox. Neither is claimed fixed here.
* **Real product proof:** `pnpm build` and `pnpm verify:app --screenshot /tmp/build-f52/verify-app.png` passed on fe65d3c1. The real IPC bridge, startup ownership checks, titlebar close, completed shutdown and disappearance of the app and recorded WebKit processes were asserted. Screenshot inspected. This smoke does not claim native engine-picker or live-engine verification; Rust tests establish the lock and session invariants.
<!-- ledger-meta {"command":"annotate","effect_lines":7,"effect_sha256":"322dc95459565b52d1534fc0547c187427a7fa73de1ce9ea358ba54727a57888","input_sha256":"2ca005aa6f99332717ed13f444d03feecd5c9130237ee0c3dd97b3bb5f37c8b6","kind":"mutation-receipt","operation":"4d020afa063010803db30c6798dc1f1116dfbaa294c49744c5a61186eb377b2c","options":{"section":null},"request_id_sha256":"88b4a27ca21ae718a6cbd56a36fe8fb9ae235a088e242414f5e6af1dd14e66c5","results":["f-20260830-52"],"target":"f-20260830-52","v":1} -->

---

## 2026-08-30 — filed through the inbox spool

### The engine stderr reader is a detached task with no owner, no cancellation and no terminal state

* **ID:** f-20260830-53 · **Status:** handled · **Area:** engine-uci · **Root:** - · **Entry:** lens · **Blocked:** none
* **Where:** `src-tauri/src/engine/process.rs`, in `EngineRuntime::spawn` — the
  `tokio::spawn` that reads the child's stderr.
* **Defect:** the task's `JoinHandle` is dropped at the spawn site. It has no owner, no
  cancellation path, no identity tying it to the engine whose stderr it drains, and no observable
  terminal state; it ends only as a side effect of the pipe closing when the child is reaped. Its
  byte budget (`MAX_ENGINE_STDERR_BYTES`) is enforced, so this is a lifetime defect rather than an
  unbounded one.
* **Why it matters:** `.claude/rules/async-resource-invariants.md` requires every spawn to name its
  owner and the exit paths it is cleaned up on. This one names none, and it sits in the file whose
  shutdown path was just rewritten precisely because an unowned spawn is how engine children
  outlived the application (`f-20260830-51`, upstream issue #723).
* **Why it is not fixed in the diff that found it:** it is genuinely outside that diff's area — the
  spawn path, not the teardown path — and the fix is a small ownership change that should be judged
  against the actor's own lifecycle rather than bolted onto a shutdown change. One lens is enough
  for it (`review-engine-protocol`).
* **Found by:** the `n2-conventions` push-review lens, 2026-08-30 (confidence 96).

* **Handled:** `EngineRuntime` now owns the stderr drain `JoinHandle`. `spawn` stores it; `terminate` joins it after the child is reaped (abort after `STDERR_REAP_TIMEOUT` if stuck); `Drop` aborts if the runtime is discarded first. `Stop` does not cancel stderr. Tests: finished join, stuck abort, drop abort, and a real-child spawn that keeps the handle until terminate.
* **Commits:** `7ea86d35`
* **Rejected:** leaving the drain detached until pipe EOF (the previous behaviour); cancelling stderr on `Stop` (the child is still alive); pulling f-20260831-10/11/12/19 into this slice (different file sets / a design question on 11).
* **Lens:** `review-engine-protocol` on Codex `gpt-5.6-sol`/`medium` — `VERDICT: APPROVED`.

---

## 2026-08-30 — filed through the inbox spool

### The four new tooling checkers each carry their own directory walker

* **ID:** f-20260830-54 · **Status:** handled · **Area:** gate-scripts · **Root:** - · **Entry:** inline · **Blocked:** none

`scripts/check-skill-bridges.mjs`, `scripts/check-tool-version-parity.mjs` and
`scripts/check-gate-routing.mjs` each implement their own recursive repository walk, and each
maintains its own exclusion handling. `review-minimalism` flagged this at confidence 92 during the
2026-08-30 tooling-parity run.

The glob half of the same finding was fixed in that run: all three now route through the
`globToRegExp` and `matches` exports of `scripts/coverage-scope.mjs` instead of compiling globs by
hand. The walk half was not, so the three files still differ in what they skip and in whether they
follow symlinks.

Fix: one shared enumerator with exclusions passed as data, beside the existing glob helpers rather
than inside any one checker. Prefer the tracked-path inventory where a checker only cares about
tracked files, since `git ls-files` already answers that and cannot disagree with git.

Also in the same class, smaller: `scripts/check-skill-bridges.mjs:4-5` exports `CODEX_ONLY` and
`CLAUDE_ONLY` allowlists that are both empty, with injectable overrides no caller and no test
uses. `review-minimalism` at 94 called it an unrequested escape hatch in a checker whose value is
that it is strict. Delete both unless a skill actually needs to exist on one side only — Korrigio
needs that allowance for `local-ci` and `frontend-design`, this repository currently does not.

* **Handled:** `check-skill-bridges.mjs`, `check-tool-version-parity.mjs`, and `check-gate-routing.mjs` now enumerate through `listWorkingTreeFiles` (`d-20260831-31`). Tool-parity globs go through `coverage-scope.mjs`. Empty `CODEX_ONLY`/`CLAUDE_ONLY` allowlists are deleted. Fixtures git-init so untracked files fail closed.
* **Commits:** `87ec9c46`
* **Rejected:** keeping per-checker `readdir` walkers; injectable empty one-side allowlists this repository does not need.

---

## 2026-08-30 — filed through the inbox spool

### Three of the new checkers' suites assert less than their checker promises

* **ID:** f-20260830-55 · **Status:** handled · **Area:** gate-scripts · **Root:** - · **Entry:** inline · **Blocked:** none

`review-tests` found three places where the tooling added on 2026-08-30 has a suite that would
stay green while the checker stopped doing its job. The blockers it found alongside these were
fixed in that run; these three were filed rather than fixed because each needs a judgement about
what the right assertion is, not just an extra case.

* `scripts/gate-receipt-tests.mjs` — every toolchain case injects a fake fingerprint for
  `frontend-build`, so the per-gate `REQUIRED_TOOLS` registry is never exercised. Deleting a real
  probe — the Playwright image derivation, the nightly Rust pin, `cargo-llvm-cov` — leaves the
  whole suite green and permits a false cache hit on a gate whose toolchain is no longer
  fingerprinted (confidence 98). The open question is whether to assert the registry's shape or to
  drive each gate's probe for real, which costs the tool invocations the tests currently avoid.
* `scripts/check-skill-bridges-tests.mjs:52` — the canonical-pointer case asserts only that the
  canonical path occurs somewhere in the bridge. A bridge saying "do not read
  `.claude/skills/push/SKILL.md`" and then carrying divergent instructions under the line cap
  passes (confidence 98). Anchoring "delegation" mechanically is the design question: the line cap
  is a proxy for it and a weak one.
* `scripts/findings-parity-tests.py` — `review-minimalism` reads the divergence framework as
  ~220 lines serving one declared divergence, arguing the pinned digest alone already rejects every
  added, removed, adjacent and same-size-substituted change (confidence 96). Worth deciding
  deliberately rather than by default: the framework's value is that it stays honest when a SECOND
  divergence appears, which is the situation the ledger contract expects to recur.

Related, same run and same class, no Root because the cause differs: `scripts/run-backend-mutation-tests.mjs`
asserted the mutation-guard preflight against `.agents/skills/push/SKILL.md` and went red when that
file became a bridge. Nothing generic caught the dangling reference — `check-skill-bridges.mjs`
scans documentation for bridge-as-gate-source claims but not scripts, and extending it there would
flag the bridge checker's own fixtures. Distinguishing a fixture from an assertion is the open
question.

**Third bullet, partially answered 2026-08-31** by the `gate-scripts` build run (findings.py-sharing
slice). The other two bullets — `scripts/gate-receipt-tests.mjs` and
`scripts/check-skill-bridges-tests.mjs` — are untouched and this entry stays open for them.

`review-minimalism`'s reading of `scripts/findings-parity-tests.py` splits into two questions that
this entry states as one, and they have different answers.

* **The declared-divergence framework stays** — `d-20260831-13`.
  `~/.claude/references/findings-ledger-contract.md:475-486` *mandates* a closed list of declared
  divergences, each carrying its reason and whether the other repository has been told. Trimming to
  a bare digest would put this repository out of contract, and it would lose the property the
  mechanism exists for: a digest reports only *that* something moved, with no declaration to walk
  and no justification attached, so it cannot express a second divergence and cannot stop the list
  rotting into a permanent amnesty. The `sibling_told` field in particular is no longer
  bookkeeping — as of `485dc8af` a `port_pending` declaration that has not been told fails the gate.
* **`EXPECTED_CHANGED_LINES` genuinely is redundant, and is deliberately left in place for now.**
  `review-minimalism` (97) is right that it adds no *detection*: the changed-line set is an input to
  `_delta_digest`, so any change that moves the count also moves the digest. Its only unique
  contribution is a readable cardinality in the failure message, which could be printed without
  being pinned. It is not removed here because all three copies of this harness pin it deliberately,
  each with a written rationale, and removing it in this one would make En Croissant the only
  implementation of three without it — a convergence question across three repositories, decided
  where they can be changed together, not unilaterally from the one that happened to be loaded.
  This is a rule-4b area boundary, not an effort argument: the other two files are outside this
  slice.

Also rejected in that run and recorded here so it is not re-proposed: extracting a shared core
across the three parity implementations (`review-minimalism`, 90). There is no shared package to
publish it into, and the ledger contract deliberately makes `scripts/findings.py` the shared
artefact while each project's parity test is its own — the harnesses legitimately differ, since
each pins a different peer at a different ref with a different declaration set.

**Correction to the decision reference above.** The decision recorded for this bullet is
**`d-20260831-15`**, not `d-20260831-13`; the annotation was written before `record-decision`
allocated the id.

* **Handled:** Gate receipts export `REQUIRED_TOOLS` and `TOOL_PROBES`, pin the exact per-gate lists, and drive a real `frontend-build` fingerprint (`d-20260901-27`). A Codex bridge must positively point at its canonical skill; `Do not read` plus extra instructions under the line cap is now red (`d-20260901-28`). The declared-divergence framework and `EXPECTED_CHANGED_LINES` stay per `d-20260831-15`.
* **Commits:** `87ec9c46`
* **Rejected:** driving rustc/cargo/nightly/llvm-cov/playwright-image on every receipt test; substring `includes(pointer)` as the canonical pointer; trimming the parity harness to the digest alone.

---

## 2026-08-31 — filed through the inbox spool

### The renderer chooses the operation class that decides whether a download must be signed

* **ID:** f-20260831-01 · **Status:** handled · **Area:** native-fs · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/fs.rs`, `validate_artifact_integrity` (the `required` computation) and
  `OpClass::from_id`; reached from the `download_file` command, whose `id: String` comes straight
  from the renderer.
* **Defect:** `OpClass::from_id` classifies by string prefix — `lichess_`, `engine_`, `db_`,
  `puzzle_db_` — and `validate_artifact_integrity` makes signature and digest verification
  mandatory only for `Engine`, `Db` and `PuzzleDb`. The `id` is renderer-supplied, so prefixing a
  download with `lichess_` makes `integrity: None` acceptable and the transfer proceeds with no
  Minisign signature and no SHA-256 comparison. The destination is still capability-gated, but the
  renderer legitimately holds `DownloadFile` on the database and puzzle roots, so the bytes land
  where a signed artifact would have.
* **Why it matters:** `.claude/rules/async-resource-invariants.md` states that renderer state is not
  authoritative for downloads. Here the untrusted side chooses the *security class* of the
  operation — the one input that decides whether the signature check runs at all. The whole signed
  manifest apparatus (`docs/signed-download-manifests.md`, the pinned Minisign key) is bypassed by
  changing a string prefix. `OpClass` also drives `max_size` and `payload_format`, so the same
  string picks the size cap and the extraction path.
* **Not exploitable by a third party today**, and that is the honest framing: the renderer only
  sends well-formed ids, so this is a broken trust boundary rather than a live hole. It becomes one
  the moment any renderer path takes an id from data instead of a literal.
* **Why it is `build`:** the fix is a design question, not a mechanical one. The natural answer is
  to derive the class from the destination capability — the `PathRef` already knows whether it is a
  database, puzzle or engine root — and to stop trusting the id for anything security-relevant. That
  touches every caller of `download_file`, the generated bindings, and the Lichess path that
  deliberately has no integrity metadata. It needs its own plan.
* **Found by:** the `review-tauri-security` lens (confidence 99) over the cumulative diff of the
  `native-fs` cluster, 2026-08-31. Verified directly against `OpClass::from_id` and the `required`
  computation.

* **Closed:** 2026-09-01, commit `016ec27a`. `OpClass` is derived from the destination PathRef's stored operations. A `lichess_` id plus a database destination plus `integrity: None` is rejected. Specta `download_file` signature unchanged. `from_id` deleted. Rejected: trusting the renderer id prefix; rejected: a Specta class enum.

### `persist_workspace_child` discards the durability of the commit that registers a workspace entry

* **ID:** f-20260831-02 · **Status:** handled · **Area:** native-fs · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/infra/path_authority.rs`, `persist_workspace_child` — its
  `self.commit_candidate(candidate, None)?;` drops the returned `CommitDurability`; reached from
  `register_workspace_child` and `register_workspace_child_expected`, and through them from
  `file_workspace.rs`'s create/list paths.
* **Defect:** the registry write can come back `CommitDurability::DurabilityUncertain` — the
  replacement happened but its parent directory sync failed — and the function still returns a
  successful `FileWorkspaceHandle`. The renderer receives a handle for an entry whose authority
  record may not survive a crash, and nothing tells it so.
* **Relation:** this is the same defect class the `native-fs` cluster fixed in
  `remove_workspace_entry` on 2026-08-31 (commit `ad03e196`, finding `f-20260830-07`), in a sibling
  function of the same file. It was deliberately not fixed there because it is not the same
  question.
* **Why it is `build` and not a mechanical port:** removal is destructive, so "the record may not
  be durable" clearly has to reach the caller. Registration is not: nothing was destroyed, the
  object is still there, and a later list re-registers it. Failing the call may well be worse than
  succeeding — the user would see a create fail although the file exists. So the open question is
  what the caller should *do*, not how to propagate. Answering it also decides the return type of
  two public authority methods and their `file_workspace.rs` callers.
* **Found by:** the `review-error-handling` lens (confidence 95) over the cumulative diff of the
  `native-fs` cluster, 2026-08-31.

* **Closed:** 2026-09-01, commit `dd2c0f58`. Persist/register/rebind/rebase return `CommittedDurabilityUncertain` after adopting. Create callers do not roll back that variant. Renderer create/move refresh on `applied-despite-error`. Rejected: silent Ok; rejected: fail-and-rollback; rejected: a new Specta return type.

### A failed registry save discards the subtree prune, so the deleted entry's records survive

* **ID:** f-20260831-03 · **Status:** handled · **Area:** native-fs · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/infra/path_authority.rs`, `commit_state` — it returns before assigning
  the candidate when `save_entries` fails — reached from `remove_workspace_entry` and from
  `permanently_delete_entry` in `src-tauri/src/file_workspace.rs`.
* **Defect:** when a permanent delete succeeds on disk but the registry write fails, the pruned
  candidate is never adopted. The descendant records, the cleared active root and the dropped
  pending intent all survive in memory and on disk, and are re-serialised by every later commit —
  the exact stale-registry accumulation `f-20260830-07` was filed for, surviving on this one exit
  path. The caller correctly reports `CommittedDurabilityUncertain`, so the user is told; the
  registry is simply never repaired.
* **This is a recorded residual, not an oversight.** The `native-fs` run of 2026-08-31 chose it
  deliberately and wrote the reason at the site: in-memory state must not diverge from what was
  persisted, and the obvious repair — dropping records at load time whose object no longer
  resolves — is unsafe, because a capability on an unmounted volume does not resolve either. That
  is why `refresh_persistent` marks unavailable rather than removing. The accumulation is therefore
  bounded by registry-save failures rather than by ordinary create-and-delete use.
* **What is actually open:** whether anything should reconcile afterwards, and what. Candidates: a
  retry of the same candidate; a reconciliation pass at the next successful commit; or an explicit,
  user-visible repair action. Each has a different failure mode and none is obviously right, which
  is why this is `build` rather than `inline`.
* **Found by:** the `review-root-cause` lens (confidence 99) over the cumulative diff of the
  `native-fs` cluster, 2026-08-31. It reported the documented residual as a blocker; the residual
  stands, and this entry is where it now lives instead of only in a code comment.

* **Closed:** 2026-09-01, commit `dd2c0f58`. `commit_registry` retries `Error::Io` once and queues failed prune ids so a later successful save does not resurrect them. Crash before the next successful save still reloads the stale registry (documented residual). Rejected: load-time drop; rejected: retrying DurabilityUncertain; rejected: a pre-unlink tombstone in this slice (`d-20260901-09`).

### The engine manifest document is unsigned, and can only be signed once the fork serves its own

* **ID:** f-20260831-04 · **Status:** open · **Area:** native-fs · **Root:** - · **Entry:** build · **Blocked:** sequenced-d-20260830-15
* **Where:** `src/utils/engines.ts` (`defaultEngineManifestSchema`, `useDefaultEngines`), the
  `https://www.encroissant.org/engines` endpoint, and `docs/signed-download-manifests.md`.
* **Defect:** the manifest document carries no signature. Its per-entry `signature` authenticates
  only `` `${downloadLink}\n${sha256}` ``, so `path`, `name`, `version`, `os`, `bmi2` and
  `imageUrl` are unauthenticated while sitting beside two fields that make the entry look signed.
  Anyone controlling or MITM-ing that origin chooses the path component an executable is registered
  from, and every other displayed field.
* **What already stops the worst of it:** `register_installed_engine` accepts only
  `Component::Normal`, `validate_components` rejects `.`, `..`, separators and NUL, and since
  2026-08-31 the client schema rejects the same shapes before a download starts (commit
  `1c307330`). Containment holds; authentication does not.
* **Blocked on a sequencing decision that is already recorded.** `d-20260830-15` (Felix,
  2026-08-30) defers the fork's self-hosted engine manifest and download page to a later run, and
  this fork does not control `www.encroissant.org` — so it cannot make that server emit a document
  signature. **This finding becomes actionable at the moment the fork serves its own manifest, and
  should be worked as part of that change rather than before it.**
* **The machinery already exists:** `minisign-verify` is a dependency, the release public key is
  pinned in `src-tauri/src/fs.rs`, and `validate_artifact_integrity` already verifies a Minisign
  signature over an exact payload. What is missing is a signed document, a canonical serialisation
  to sign, and a verification call before the entries are trusted.
* **Inherited from upstream unchanged** — this is not a defect the 2026-08-09 audit introduced.
* **Found by:** Claude review of the 2026-08-13 audit diff (as `f-20260830-27`), and re-raised by
  the `review-root-cause` lens at confidence 96 over the `native-fs` cluster diff, 2026-08-31, which
  correctly objected that the client-side constraint hardens a symptom without authenticating the
  state that produced it.

* **Sequenced:** 2026-09-01. Not handled. `d-20260830-15` (Felix, 2026-08-30) defers the fork's own signed engine manifest. Blocked as `sequenced-d-20260830-15` so it leaves the native-fs pick until that work starts (`d-20260901-08`).

### An inline `;` comment after a move opens a brace comment, merging the next game into the current one

* **ID:** f-20260831-05 · **Status:** handled · **Area:** pgn-import · **Root:** - · **Entry:** lens · **Blocked:** none
* **Where:** `src-tauri/src/pgn.rs`, the game-boundary scanner: the `;` handling recognises a
  rest-of-line comment only when `;` is the first character of the line.
* **Defect:** PGN allows `;` to start a comment anywhere on a line, running to the end of it. The
  scanner only treats a line-initial `;` that way, so in `1. e4 ; { ignored` the `{` is read as the
  start of a brace comment. Everything after it — including the next game's `[Event "..."]` header —
  is swallowed until a later `}` or a header that happens to resynchronise the scanner.
* **Why it matters:** two games silently become one. The byte-offset index built from these
  boundaries then points at the wrong game for every entry after the merge, so counts, paging and
  the "read game N" path are all wrong for that file — and nothing errors. `.claude/rules/pgn-scanning.md`
  makes boundary detection the invariant this file exists to protect.
* **Fix shape:** treat `;` as a comment start wherever it appears outside a brace comment and
  outside a quoted string, and skip to end of line. The test to write first is the exact input
  above, asserting two games rather than one.
* **Entry `lens`:** the change itself is small and local, but it is a scanner boundary rule, so it
  gets `review-pgn-index` over the diff before it lands.
* **Found by:** the `review-pgn-index` lens (confidence 97) over the cumulative diff of the
  `native-fs` cluster, 2026-08-31. Pre-existing; that cluster touched `pgn.rs` only for an error
  payload.

* **Implementation review, 2026-09-05:** The first regression fixture accidentally included a later closing brace before the next game header, so the old scanner could recover and pass the test. Root required the exact inline-semicolon input immediately followed by game B, with range/content assertions, and separate quoted/brace-comment cases. The same executor is correcting the fixture before acceptance. Plan authorship and arbitration shared the root context; detection used the same model family as code.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"0a8e755299bf5af11ef7ed947cfeeb1f2019f80b3401adc982afdf87040d2b24","input_sha256":"452a040a371876796ed828e72bff45b479e47fc5b969ed76e3da6236208cdb57","kind":"mutation-receipt","operation":"7e387e6c3453f49ae2576cf2e212d10be0907a66958ec942ddc7764aa8860c86","options":{"section":null},"request_id_sha256":null,"results":["f-20260831-05"],"target":"f-20260831-05","v":1} -->

* **Handled, 2026-09-05:** 6694b6e7 corrects inline semicolon boundaries and reescapes decoded export tags without changing raw stored tag representation. Root reran 17 PGN tests and 130 database tests, formatting and clean-diff checks. The exact semicolon regression checks both games and their byte ranges without a later brace masking the defect. Import -> production export -> import verifies quotes/backslashes in both players and optional decoded tags, plus unchanged raw Event/Site escapes.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"8fab175268994a4a3322ffeff9c8e9bf434717882c60d98ff24f2b135e27058e","input_sha256":"59e223b9b59dad5b336b772a08f0a1eea2f81a68cdb3c2e39a24235f6c0221a4","kind":"mutation-receipt","operation":"e4202a115c38e8ca4f29a24287909929bc0d5b9d4baf31c6737ed6f5d1e48db6","options":{"section":null},"request_id_sha256":null,"results":["f-20260831-05"],"target":"f-20260831-05","v":1} -->

### The PGN pipeline materialises whole corpora: a 64 MiB scan cap, and three corpus-sized buffers

* **ID:** f-20260831-06 · **Status:** handled · **Area:** pgn-import · **Root:** whole-corpus-materialisation · **Entry:** build · **Blocked:** none
* **Where:** four sites, one cause.
  * `src-tauri/src/pgn.rs` — the streaming scanner refuses any file above 64 MiB before it scans.
  * `src-tauri/src/db/mod.rs` — search-index generation loads every game and move blob into one
    `Vec`, and the writer then clones and serialises the complete index.
  * `src-tauri/src/db/search_index.rs` — opening the memory-mapped index deserialises the entire
    `SearchArchive` merely to read `source`.
  * `src-tauri/src/db/mod.rs` — database export buffers the complete PGN in a `BufWriter<Vec<u8>>`
    before the atomic write.
* **Defect:** a routine PGN database is hundreds of megabytes. The first site refuses to scan one
  at all, so it cannot be counted, paged, edited or read. The other three succeed only by holding
  one or more corpus-sized allocations, and the third defeats the point of the mmap design by
  building a second full in-memory copy on open.
* **Why it matters:** this is the size class the application is for. `.claude/rules/pgn-scanning.md`
  names whole-file materialisation of large PGNs as the thing the byte-offset index exists to
  avoid, and three of these four sites do it anyway.
* **Related:** `f-20260830-37` (`blocking-work-not-offloaded`) covers the *thread* these run on;
  this finding is about the *memory* they hold. Fixing either does not fix the other, but they will
  likely be worked together, since streaming a record at a time changes both.
* **Why it is `build`:** the answer is a streaming design for four different pipelines — scan,
  index build, index open, export — with a shared question about what the on-disk index format has
  to look like to be readable incrementally. That is a plan, not a patch. The 64 MiB cap is the one
  piece that may be liftable on its own, and even that needs the scanner proven on a large file
  first.
* **Found by:** the `review-pgn-index` lens (confidence 100, 100, 99, 100 on the four sites) over
  the cumulative diff of the `native-fs` cluster, 2026-08-31. All four pre-existing.

* **Implementation review, 2026-09-05:** the first chunk-reader draft allowed an untrusted source_len to reach IndexSource deserialization, whose NativePath contains an owned vector. That could reintroduce a corpus-sized allocation through malformed provenance. The database worker must bound provenance bytes before deserialization and reject oversized source framing; this enforces the small-metadata requirement in f-20260831-06.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"de905e5c8f872188dd9ec75409cd645f2fba34c84e53beb645a53150d4cdc7de","input_sha256":"d3cea63c6646f67d22b60e6ba9574e70c90e4bdcda82f8e294ec6234d1b90a6b","kind":"mutation-receipt","operation":"df764c1f91f8e58c21e7ade215d467bcd5a0a7b8e7bc4ef3e242863acf38bc36","options":{"section":null},"request_id_sha256":null,"results":["f-20260831-06"],"target":"f-20260831-06","v":1} -->

* **Implementation review, 2026-09-05:** Root found that the initial export laziness test only counted total iterator calls after completion, so collecting all rows first would still pass. The initial index chunk-count/borrowed-pointer tests likewise prove storage/open behavior but not streaming construction. Assigned stronger production-writer observations before source exhaustion, plus a small buffered terminal-write failure case, to the same phase executor before acceptance. Plan authorship and arbitration shared the root context; detection used the same model family as the code.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"890aa4c180a56d0ac808da1ad2ee20a05fa483411ceb8deb67ff7f2ef7f47928","input_sha256":"03a707f0a3af02168b73a9d5935d1194388e758b93ae2de815d342f65f2c302c","kind":"mutation-receipt","operation":"8cb37662901e949a488612853b8e680a04c4fa7436f4105bccfbc546790a8c4a","options":{"section":null},"request_id_sha256":null,"results":["f-20260831-06"],"target":"f-20260831-06","v":1} -->

* **Handled, 2026-09-05:** 244898f7 removes the corpus-size/game-count scanner refusals, shares Arc ranges, and limits retained scan bytes. 7e3d91e9 streams Diesel rows into bounded version-7 index chunks, validates/maps entries without corpus deserialization, and streams PGN export into the fd-authorized atomic destination. Root reran 15 PGN tests (including valid 301 MiB input and 100,005 games), 129 database tests, formatting and clean-diff checks. Streaming writer observations run before source exhaustion; corrupt framing/provenance and export row/FEN/move/write/final-flush failures are covered. Final cumulative review and affected gates belong to the same authorized push run. Decisions d-20260905-20 and d-20260905-21 record format/atomicity choices and reversal paths.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"abf5974da706148a86c1281581ac4e7f19559f36f90eb2608d29941e11001429","input_sha256":"dbac553c26ecb353419ce67e8f9a51b50b27c57e6b4f8c1f70412f859ffde6f4","kind":"mutation-receipt","operation":"7e733176730a9ff5b949e651381e50a3ed96391e50a8ba70d59316fccff697ef","options":{"section":null},"request_id_sha256":null,"results":["f-20260831-06"],"target":"f-20260831-06","v":1} -->

* **Final gate, 2026-09-05:** Contract checks and cargo check passed; clippy with -D warnings rejected two pointer-alignment modulo expressions (manual_is_multiple_of) and two existing err().expect() test assertions newly diagnosable because MmapSearchIndex now derives Debug. Replace with is_multiple_of and expect_err respectively; no lint suppression or baseline change. This is required before final push.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"2f703314cba5af096fb8ef96dac5fa94bca0180c24ab88ec5bc796995731afcc","input_sha256":"85cd8c0b39548e7b3e92a669ecf44b7d6753a6d25d1188b949b878087e7a2a3a","kind":"mutation-receipt","operation":"67e10162453640d88bd9514fb7a5907627aabcaa6f5188754a978d3dd307b124","options":{"section":null},"request_id_sha256":null,"results":["f-20260831-06"],"target":"f-20260831-06","v":1} -->

* **Final test lens, 2026-09-05 (Sol/medium):** Four accepted proof gaps: export production query could collect rows before the synthetic-iterator writer test; index production query has only a source-string guard against precollection; mmap borrowed-pointer proof does not detect transient owned corpus allocation on open; non-zero source/chunk padding rejection lacks mutation coverage. Add bounded-memory evidence around complete production index generation/export and mmap open, and corrupt actual padding. These are verification repairs within f-20260831-06, not new product behavior. Confidence 99/99/97/96. Plan authorship and arbitration shared the root context; detection used the same model family as code.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"a043ce32db397855d5d65e1d7fcf757c24958bab76209d5d27abb09688b4f97e","input_sha256":"b5a705e86df6dc971ba3ebd2c33da29a764297bb2b2b3ca4ad08b571b1f97100","kind":"mutation-receipt","operation":"f7caaf5f3e819536bb8eb662e0f673ebf8527f3099cd38a03eac6db2c422773e","options":{"section":null},"request_id_sha256":null,"results":["f-20260831-06"],"target":"f-20260831-06","v":1} -->

* **Final quality lens, 2026-09-05 (Sol/medium):** Accepted clarity fixes: rename cache insert to expose best-effort byte-budget retention; rename the serialized SearchIndex payload to SearchIndexChunk now that a mapped index owns many chunks; gate test-only builder methods/Default consistently. Confidence 99/98/97. These do not change behavior. Root-cause lens independently corroborated the three complete-production-path memory proof gaps already assigned from the tests lens (96/99/97); these are duplicates, not additional fixes. Plan authorship and arbitration shared the root context; detection used the same model family as code.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"2a4ecdb1f035c642cf2dd53c0df02591c9e793d16fb5281f6bfd7b43e17e05d9","input_sha256":"5defc2cb8d9872c21b36e6db105b4021f97571a9786954dfb84c0e86d8c2b6d6","kind":"mutation-receipt","operation":"ee48d6417941dfb68206f450b4c3e17bbab5bd5a44e30104e193ab1543263105","options":{"section":null},"request_id_sha256":null,"results":["f-20260831-06"],"target":"f-20260831-06","v":1} -->

* **Final minimalism lens, 2026-09-05 (Sol/medium):** Accepted removal of export_row_decode_error_is_not_silently_skipped, fully subsumed by the following atomic-preservation test asserting the same error (confidence 99). Correctness, error-handling and IPC lenses approved without additional findings. Plan authorship and arbitration shared the root context; detection used the same model family as code.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"1530f0d68459297efacfbb0ec45755aca9d3b389157913dd89bdf1667bffc9c7","input_sha256":"0abb91326b432670b6adf702a0989bef02fb3e3034e9b8b1702a24b06bf51e7a","kind":"mutation-receipt","operation":"400586628f865d90aacf48c78d6a46d931a77645282aed0f33e87aab66d77bc5","options":{"section":null},"request_id_sha256":null,"results":["f-20260831-06"],"target":"f-20260831-06","v":1} -->

* **Review correction on measured producer evidence, 2026-09-05:** The requested source-padding mutation is impossible for valid emitted IndexSource payloads: the actual writer across NativePath lengths 0..15 always emits source_len divisible by 16 because the archived root contains u128. After successful aligned rkyv access, the old source-padding slice was always empty. Replace that unreachable scan with explicit aligned source_len validation and mutate the emitted header to test rejection. Real chunk padding is variable and its nonzero corruption test remains. This supersedes only that subcase of the accepted test-lens criterion, not the provenance or framing requirement.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"bbfee1d25d6be80a0346369581d586504469c8845db2b245e165b1b4a577113a","input_sha256":"801bf41f55d15320b041d4d83a65a2bd5a47874bd1b74a0ad63fbf41c3c4dc81","kind":"mutation-receipt","operation":"b3b944cb866290ae34438e37a9ed0f5adf2879914e9294c7176aea9705f24915","options":{"section":null},"request_id_sha256":null,"results":["f-20260831-06"],"target":"f-20260831-06","v":1} -->

* **Final remediation, 2026-09-05:** f6ad8005 implements the accepted complete-production-path heap probes, source alignment/chunk padding tests, chunk naming, test-only builders, redundant-test removal and clippy repairs. 0b386735 names best-effort scan retention and separately fixes f-20260905-16. All nine distinct cumulative-lens findings are resolved or their precisely identified subcases superseded by producer/caller evidence above; three root-cause findings duplicated memory-test gaps. Root proof: 19 PGN tests, 133 database tests, cargo fmt and clippy passed. The 33,557,504-byte fixture measured generation 8,785,265 bytes, mmap open 873 bytes and export 270,747 bytes of tracked current-thread Rust heap growth; a corpus-sized sanity allocation crossed thresholds. This is not RSS or native SQLite memory. Plan authorship and arbitration shared one context; all eight detection lenses used Codex Sol/medium from the implementation family. The main.rs test-only rename triggers the additional frontend/bindings gates under the canonical mapping; no IPC signature or UI source changed.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"d9265c3f4ff618565ac941522440e1bb88b283a0145672a56b576640f83c32ac","input_sha256":"ee46e5a47919229b3fd6e4ddfbcee54096e3e6be3bf2ff0f64fe192009d61f38","kind":"mutation-receipt","operation":"0891584f94ed5d36bd47843e3d78d6b90a1c5e1602e156f62798f54e1bf4c9f5","options":{"section":null},"request_id_sha256":null,"results":["f-20260831-06"],"target":"f-20260831-06","v":1} -->

* **Final coverage gate, 2026-09-05:** All 624 backend tests passed, but app-infrastructure branch coverage measured 1293/3512 against the unchanged 746/2018 ratio ratchet. LCOV shows uncovered atomic-writer refusal/durability branches in infra/fs.rs instantiated by the new exporter/writer paths. Investigating meaningful fault injection through production export/generation calls; no baseline, floor or measured-scope changes are permitted. The complete final gate must pass before push.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"5cfa2e609b6f3eb7e13c5a32241f7eedf846fa2383d14ad4722db7d709c95b49","input_sha256":"9be1b62dafc21abe8b0efca2e3496a0bdff3cac72591652b4249db6bfd84f20d","kind":"mutation-receipt","operation":"b5097e8075c84f6cc84e3be8cab43a66beae155fa0ee02f73f2c132c5e570577","options":{"section":null},"request_id_sha256":null,"results":["f-20260831-06"],"target":"f-20260831-06","v":1} -->

* **Coverage repair verified, 2026-09-05:** Production-export fault tests cover TempfileCreate, Write, Flush, FileSync, PermissionCopy, PreCommitRevalidate, Rename, PostRenameMetadata and ParentSync. They check exact preserved old bytes before publication, complete parsed PGN and DatabasePgnReplacement uncertainty after publication, and removal of .atomic-* residue. Root reran 135 database tests, formatting and clippy; the backend coverage run passed all 626 tests and unchanged ratchets, with app-infrastructure branches 1301/3512. No infrastructure implementation, baseline or scope changes were needed.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"42cb05fe3303474843ac30dfe1c95a6b3f8eae2fa4ec05d4f713d2959b9797f3","input_sha256":"c6f1fe4005d7f21a04c08f376a01811a4a5656beb9210d915fbd71b0ab17d4e6","kind":"mutation-receipt","operation":"fd2a7f69360bcc476a86f76b3bea2b021988723437124573d1b1c4c942efff63","options":{"section":null},"request_id_sha256":null,"results":["f-20260831-06"],"target":"f-20260831-06","v":1} -->

### A multi-file PGN import commits each file in its own transaction, so a mid-import failure leaves games behind

* **ID:** f-20260831-07 · **Status:** handled · **Area:** pgn-import · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/db/mod.rs`, the import path that iterates source files and opens a
  transaction per file.
* **Defect:** importing three PGNs and failing on the third leaves the games from the first two
  committed while the command returns an error. The user is told the import failed and the database
  nevertheless contains part of it, with no record of how much.
* **Why it matters:** the renderer's error handling treats a failed import as "nothing happened" —
  the same false-negative shape that `d-20260830-05` introduced the `applied-despite-error`
  category for on the filesystem side. Here there is no equivalent signal at all, and a retry
  duplicates whatever already landed.
* **Why it is `build`:** there are two defensible answers and they differ in cost. One transaction
  across all files makes the operation atomic but holds a write transaction for the whole import,
  which for a corpus-sized import is exactly the memory and lock-duration problem
  `whole-corpus-materialisation` describes. Per-file transactions plus a reported partial outcome
  keeps the current shape but needs a new error carrying how many files landed, and a renderer that
  acts on it. Choosing needs the import's size profile, not just its code.
* **Found by:** the `review-pgn-index` lens (confidence 100) over the cumulative diff of the
  `native-fs` cluster, 2026-08-31. Pre-existing.

* **Cumulative path-ownership review (2026-09-06):** Luna PGN/index lens re-confirmed per-file transactions at db/mod.rs:614 (confidence 100; origin cbdf2a09). Root traced the transaction loop and existing f-20260903-04/f-20260904-03 companion design. Defer to this existing multi-file import outcome/invalidation design run; no new finding or policy reversal. Detection and code share the Codex family; plan authorship/arbitration share root context.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"5eaa2c2fdce1a4cf12150e39f2772012de81d7cfddf76ba18d1c56b4dfdaa8ac","input_sha256":"ff8fa5eaa6aa74b62d3ee24ad57224e99e4e59d57356181bad387ffe4d6a82e7","kind":"mutation-receipt","operation":"7db60f7783fe505d43fd96da2f0dd0a472bf38f92d7096454eeac7399b9af2dd","options":{"section":null},"request_id_sha256":null,"results":["f-20260831-07"],"target":"f-20260831-07","v":1} -->

* **Cancellation plan review, 2026-09-08:** The PGN/index lens re-confirmed the per-file transaction at `src-tauri/src/db/mod.rs:621` (confidence 98). The f-20260904-05 run preserves accepted-import ownership through cleanup but does not choose a new multi-file failure/partial-outcome contract. Defer that distinct design to this existing entry and f-20260903-04; cancellation is not evidence for reversing the standing import record. Plan authorship and arbitration share the root context; this review ran on Codex, the family of the existing code.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"a04cd92d610a6ce5324b88169277f6ed6e6bcdabd0c4f66c85d73ec161243f67","input_sha256":"33234c671849a2ca4e1da9341d31174e5663588b8f36df4be764164b3b838e8f","kind":"mutation-receipt","operation":"6853fda5fc146e2a69e00b046236a0f62b9b1423dfa6fa9420b6644940859444","options":{"section":null},"request_id_sha256":null,"results":["f-20260831-07"],"target":"f-20260831-07","v":1} -->

* **Integration review, 2026-09-10:** Fix the duplicated authority/mock-app setup in the new `empty_database_case` and existing `blocking_database_case` fixtures (`src-tauri/src/db/mod.rs`, introduced by 5e32f572). Both create an authorized temporary database; extract the common empty fixture and let the existing fixture initialize schema on it. Keep existing database name and operation grants stable, preserve the new-schema rollback test, and rerun the database suite. This is an in-task test-maintainability correction before final gates. Plan authorship and arbitration share root context; detection and code use the Codex family.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"14ba444b7438d33d2de4992a54ee7176fb1ac228b9f3bbae07e2e4ce1c130992","input_sha256":"a62da975007a2470570b72e9b82662af5e216d633052f6f21470fa95464088eb","kind":"mutation-receipt","operation":"81d0ec74afa9045b7a98b6071bfeb32c50c8a1c60082d92643a9c8fc45f4aa86","options":{"section":null},"request_id_sha256":null,"results":["f-20260831-07"],"target":"f-20260831-07","v":1} -->

* **Cumulative review, 2026-09-10:** Fix `review-code-quality` findings in 5e32f572: distinguish the physical parser result from its accepted game at the import loop, and replace misleading `stored_counts` plus unlabeled tuple fields with explicitly named live row counts. Fix `review-minimalism`'s duplicate empty-database fixture (same finding already recorded by root). Skip the proposed constant for unchanged 1000-game progress cadence: the unit is explicit in `imported_games.is_multiple_of(1000)`, and this naming-only proposal was removed in plan round 2 for no future payoff. Plan authorship and arbitration share root context; detection and code use the Codex family.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"b2d81e474144ab2010e752631db2c7b2eec82ec3d558e7bceea6028f05c3f87e","input_sha256":"bf789a73037e9ea33aa2b677e4858623f3b116dbc63ba4070d97292d3f63c9e5","kind":"mutation-receipt","operation":"d8505a1f8ae3641236cf57b3febbad6b560b9345bc937439430473278a6ef4cf","options":{"section":null},"request_id_sha256":null,"results":["f-20260831-07"],"target":"f-20260831-07","v":1} -->

* **Resolved, 2026-09-10:** 5e32f572 implements d-20260910-08: one streaming transaction covers schema preparation, every source, indexes, row counts and revision/cache publication; terminal progress follows commit. Reader/decompression errors propagate, and replacement reads only the first physical game. Production regressions cover later-file and metadata/revision rollback, failed-new-database retry, preserved optional-index policy, real WAL index/query-cache consistency, skip semantics and streaming memory. Root's original-code comparison produced six explicit failures and reproduced the compressed-reader loop; restored code passed 189 database tests plus formatting. The cumulative review accepted four test-maintainability/proof corrections before final gates. Plan authorship and arbitration shared root context; detection and implementation used the same Codex family. No partial-outcome IPC or renderer redesign was introduced.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"65cf6eb7af2bd4ba464408d000ce1d217a7117073a2086c0287543333558c885","input_sha256":"bbb0cfa261d8f817b05fe970f8697d9cf742db32744612bd8525aa01b35519ec","kind":"mutation-receipt","operation":"7a55cf34e288759c2f1b11763ce9989e80d8cda816cf891fa01e4400a1bed9f0","options":{"section":null},"request_id_sha256":null,"results":["f-20260831-07"],"target":"f-20260831-07","v":1} -->

### Deleting a database removes its primary file first, so a later failure leaves it unusable and unretryable

* **ID:** f-20260831-08 · **Status:** handled · **Area:** db-search · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/db/mod.rs`, the database-deletion command: it unlinks the primary
  database file before its index sidecars.
* **Defect:** if removing a later file fails, the command returns an ordinary `Io` error. The UI
  reports that the action failed and offers a retry — but the retry cannot succeed, because
  capability resolution needs the primary file that is already gone. The database is left partly
  deleted, unusable, and unremovable through the interface.
* **Why it matters:** it is the same class the `native-fs` cluster fixed for workspace deletion on
  2026-08-31 — a destructive operation that partly applied and reported as if nothing had happened.
  There the answer was `Error::CommittedDurabilityUncertain` mapping to the
  `applied-despite-error` category so the renderer relists (`d-20260830-05`). This path has no such
  signal.
* **Fix shape, and why it is `build`:** ordering the unlinks so the primary file goes last makes
  the operation retryable, and is probably right on its own; but the failure still needs a truthful
  outcome, which means deciding whether this reuses `applied-despite-error` or gets its own
  category, and what the renderer does with a half-deleted database. That is a contract question
  across the boundary.
* **Found by:** the `review-error-handling` lens (confidence 94) over the cumulative diff of the
  `native-fs` cluster, 2026-08-31. Pre-existing.

Handled by `2d545015`. Unlink order is preferred sidecar, provenance-matching legacy sidecar, then primary, all via the retained parent fd. PartialRemoval is emitted only when the primary is gone; sidecar-only failures stay Io/InvalidInput. FilesPage and deleteDatabaseAndInvalidate share runDestructiveWithRefresh so applied-despite-error relists. No new error category (d-20260830-05, d-20260831-01, d-20260831-24). Rejected: PartialRemoval when only sidecars were removed; unlinking a colliding foo.ecsi that belongs to another database named foo.

### Engine results are bound to a tab and a position but not to the process that produced them

* **ID:** f-20260831-09 · **Status:** handled · **Area:** engine-uci · **Root:** result-not-bound-to-its-process · **Entry:** build · **Blocked:** none
* **Where:** three sites on one axis.
  * `src/components/boards/EvalListener.tsx` — the result fingerprint covers tab, FEN, moves and
    settings, but not the executable handle or a process generation.
  * `src-tauri/src/chess.rs` — `stop_engine` snapshots the current actor without its generation.
  * `src-tauri/src/engine/process.rs` — `terminate_tab` snapshots the actor set without preventing
    a later registration.
* **Defect:** each site assumes "the engine for this tab" is a stable identity. It is not.
  Replacing an engine binary while keeping its id lets a queued result from the old process arrive
  for the same tab, FEN, moves and settings and be accepted as the new engine's. A position change
  that issues a stop while a replacement is starting can have the stop resolve against the *new*
  search and drain its result. Closing a tab while `getBestMoves` is spawning can return from
  `killEngines` before `replace_handle` publishes the new actor, leaving an infinite search running
  for a tab that no longer exists.
* **Why it matters:** `.claude/rules/async-resource-invariants.md` requires an identity and a
  stale-result guard on every asynchronous operation, and names commit `4e8d10b0` — a guard that
  compared `payload.moves.join(",")` and silently matched across different move lists — as the
  incident behind it. This is the same defect one level up: the discriminator is real but does not
  include the producer.
* **Why it is `build`:** all three need the same missing thing — a monotonic generation minted when
  an actor is registered, carried on every result and honoured by stop and terminate — and it has
  to cross the IPC boundary, so it touches the event payloads and the generated bindings. Fixing
  one site without the generation just moves the race.
* **Found by:** the `review-engine-protocol` lens (confidence 96, 94, 99) over the cumulative diff
  of the `native-fs` cluster, 2026-08-31. All three pre-existing.

* **Resolution (2026-09-08):** Implemented producer-bound interactive searches in `67941e1b`, with cumulative review repairs in `802bf7f0` and `6f57f34e`. Native preparation reserves a non-wrapping opaque generation before start; one-use bounded admissions cross spawn/publication safely, tab closure cancels pending ownership, and automatic stops target their captured generation. Info and terminal events carry producer identity. Renderer attempts bind executable/options/go/full FEN/moves, clear stale cache/progress, reject stale events/promises, and observe synchronous close intent, including failed-close retry and unmount.
* **Proof:** Root independent full proof: 768 Rust tests passed, 1 ignored; 799 frontend tests in 103 files passed; TypeScript, generated bindings, formatting and diff checks passed. All-target Clippy with warnings denied passed after narrowly scoped command/test fixes. Deterministic tests cover reservation misuse/replay/capacity, generation exhaustion, registration/publication/stop races, removal and failed close, event broadcast identity, and stale remote completions. Actual-command stop and actual production info/terminal emission tests anchor the IPC boundary. Negative controls for stale event/promise guards, stop forwarding, both emitted generations, and generation wrapping failed, then passed after restoration.
* **Review:** Ten fresh Sol/medium lenses: six approved and four requested revisions; all fifteen reported findings adopted, with raw error-cause exposure rejected under the existing redaction decision. Shared validation/cancellation/rejection helpers and typed shutdown failure propagation address the surrounding lifecycle findings. No unresolved Fix or deferred work. Plan authorship and arbitration shared the root context; detection ran on the same model family as the code in separate sessions. Decisions: `d-20260908-03`–`d-20260908-05`.
<!-- ledger-meta {"command":"annotate","effect_lines":3,"effect_sha256":"743a20624d94b46bdf2cbe63718087b2727ef8c0b76ff12641c2fa8620e0a697","input_sha256":"831efaa2cbbffe47258dee68070fb301c1201c33c5d89db124649d871e76601f","kind":"mutation-receipt","operation":"0d983efb9ff953c5f727182e4055052ec187a7d05abd77b80ac66925ab00c6a0","options":{"section":null},"request_id_sha256":null,"results":["f-20260831-09"],"target":"f-20260831-09","v":1} -->

### `analyze_game` accepts `lowerbound`/`upperbound` scores as final, while the interactive path rejects them

* **ID:** f-20260831-10 · **Status:** handled · **Area:** engine-uci · **Root:** - · **Entry:** inline · **Blocked:** none
* **Where:** `src-tauri/src/chess.rs`, the report path (`analyze_game`) writing into
  `current_analysis.best`; the interactive path a few hundred lines earlier already rejects bound
  scores.
* **Defect:** UCI `score cp N lowerbound` / `upperbound` means the engine has not finished
  narrowing the window — the value is a bound, not an evaluation. The interactive analysis path
  discards those lines. The report path does not, so an engine that emits a bound score followed by
  the expected MultiPV lines at the same depth has the bound entered as the annotated evaluation of
  that move.
* **Why it matters:** two structurally identical loops disagree about the same protocol detail, and
  the one that disagrees is the one whose output is written into a game as a durable annotation.
  The user sees an evaluation that no engine ever asserted.
* **Fix shape:** apply the interactive path's existing rejection in the report loop. The two loops
  are close enough that the real fix is to route both through one aggregation helper — see the
  `4e8d10b0` lineage in `.claude/rules/engine-lifecycle.md`, and universal rule 11 on the second
  near-identical copy.
* **Found by:** the `review-engine-protocol` lens (confidence 99) over the cumulative diff of the
  `native-fs` cluster, 2026-08-31, and independently during that cluster's plan review. Pre-existing.

* **Handled:** both UCI loops go through `ingest_info_line`, which drops `lowerbound`/`upperbound` scores, enforces sequential MultiPV, and returns a complete set only when the last line is `real_multipv`. `analyze_game` can no longer store a bound as the annotated evaluation. Proof: `ingest_skips_lowerbound_and_keeps_the_exact_score`, `ingest_skips_upperbound`, `ingest_bound_between_pvs_does_not_desync_sequence`.
* **Commits:** `10192873`
* **Rejected:** copying the four-line bound skip into the report loop only (the two loops would drift again); taking the rest of the `engine-uci` area cluster through `build`.

### Removing a local engine deletes renderer state without terminating its process

* **ID:** f-20260831-11 · **Status:** handled · **Area:** engine-uci · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src/components/engines/EnginesPage.tsx`, the engine-removal handler; the supervisor
  it does not call is `stopEngine`/`killEngine` in `src/utils/engines.ts` and
  `src-tauri/src/engine/process.rs`.
* **Defect:** removing a local engine removes it from the persisted renderer list and nothing else.
  If an infinite search is running when the user removes it, the listener unmounts while the
  supervised child keeps running — until the tab is closed or the application exits.
* **Why it matters:** `.claude/rules/async-resource-invariants.md` requires every spawn to name the
  exit paths it is cleaned up on, and lists "resource swap" and "tab close" among them; engine
  removal is a resource swap with no cleanup at all. Issue #723 and commit `e5422566` are the
  recorded incidents for engine children outliving the application, and this is the same class
  reached by a different route.
* **Related:** the same capability record can also be removed underneath a running engine by a
  workspace delete — that is the removal side of the same missing ownership, and is why this is
  filed as `build` rather than as a one-line handler change. The question is who owns terminating
  an engine when its identity disappears, not where to add a call.
* **Found by:** the `review-engine-protocol` lens (confidence 96 and 99 in two separate rounds)
  during the `native-fs` cluster's plan review and final review, 2026-08-31. Pre-existing.

Handled in `b9250a36`, `7d834f82`, `dc458a78`. `EngineSupervisor::retire_engine` tombstones the application id, barriers on `registration`, and drains every actor whose key or `engine_id` matches, including report analysis (`analyze_game` now records `engine_id`). `EnginesPage` awaits `retireEngine` and always drops `enginesAtom`. Rejected: renderer-only kill loop; one-shot snapshot; matching games by handle (`d-20260901-17`, `d-20260901-20`). Workspace-delete of the binary and `GameManager` children are filed separately.

### Two engine-settings paths identify engines by display name, and duplicate MultiPV settings are accepted

* **ID:** f-20260831-12 · **Status:** handled · **Area:** engine-uci · **Root:** - · **Entry:** inline · **Blocked:** none
* **Where:** `src/components/panels/analysis/EngineSettingsForm.tsx` — the runtime lookups behind
  Sync Settings and Advanced Settings; and `src-tauri/src/chess.rs` — the settings-to-UCI
  translation that accepts a repeated `MultiPV`.
* **Defect (name lookup):** both settings paths find the engine by its display name rather than its
  id. Two engines sharing a name — which nothing prevents, and which happens naturally with two
  builds of the same engine — make both actions target the first one even when the second is
  selected. The user edits an engine they did not choose.
* **Defect (duplicate MultiPV):** a settings list containing `MultiPV` twice, say 2 then 4, derives
  the expected line count from the first value while sending both `setoption` commands, so the
  engine ends up configured at 4 and the aggregator discards lines 3 and 4. The count the renderer
  waits for and the count the engine produces disagree silently.
* **Why it matters:** the first is an identity bug in exactly the place this codebase otherwise
  uses opaque handles — `EngineHandle` exists so that names are not identities. The second is the
  cached-option-state class `.claude/rules/engine-lifecycle.md` names: a setting tracked apart from
  what the engine was actually told.
* **Fix shape:** look engines up by id in both settings paths; reject or last-wins a duplicated
  option name at one place in the translation, and derive the expected count from the value
  actually sent.
* **Found by:** the `review-engine-protocol` lens (confidence 95 and 92) over the cumulative diff
  of the `native-fs` cluster, 2026-08-31. Both pre-existing.

Handled in `b9250a36`, `7d834f82`. Settings and advanced navigation look up by `engine.id`. `scoreTypeFamily` is keyed by id; copied output keeps the display name. `set_options` builds one last-wins `to_send` list and derives `real_multipv` from it. Persisted settings collapse the same way. `analyze_game` forces `REPORT_MULTIPV` on extras and inherited values (`d-20260901-19`). Rejected: reject-as-error; first-wins.

### The default-engine list keys installed state by the mutable, non-unique engine name

* **ID:** f-20260831-13 · **Status:** handled · **Area:** frontend-ui · **Root:** - · **Entry:** inline · **Blocked:** none
* **Where:** `src/components/engines/AddEngine.tsx`, where a manifest entry is marked as already
  installed by comparing against the installed engines' `name`.
* **Defect:** `name` is neither unique nor immutable. Installing one engine, or renaming an
  installed engine to match another manifest entry's name, marks that distinct entry as installed —
  so it cannot be added, although it has a different `path` and a different binary.
* **Why it matters:** it is the same identity mistake as the engine-settings lookups, in the one
  screen where the consequence is that a user simply cannot install an engine and is given no
  reason.
* **Fix shape:** compare on something that identifies the artifact — the manifest `path`, or the
  download URL — rather than on the display name.
* **Found by:** the `review-engine-protocol` lens (confidence 98) during the `native-fs` cluster's
  plan review, 2026-08-31. Pre-existing.

* **Handled:** Default-engine cards compare `downloadLink`, not display name (`isManifestEngineInstalled`). A renamed install stays marked installed; a same-named distinct download stays installable. Proof: `src/utils/engines.test.ts`.
* **Commits:** (this run)
* **Rejected:** name or filename last-component matching (`d-20260901-23`).
* **Governed-by:** d-20260901-21, d-20260901-23

* **Commits:** `8952f592`

### Account linking reports success when the credential registry write may not have survived

* **ID:** f-20260831-14 · **Status:** handled · **Area:** oauth-credentials · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/credentials.rs`, `AtomicRegistryPersistence` — a parent-directory sync
  failure becomes `Ok(RegistryCommit::CommittedDurabilityUncertain)`; its production callers
  discard that status.
* **Defect:** the rename happened but its durability is unconfirmed, and the account-linking path
  returns success anyway. After a crash the registry entry can be gone while the keyring secret it
  named remains — an orphaned secret and an account the user believes is linked.
* **Why it matters:** keeping the new in-memory state is deliberate and correct — the comment at
  the site explains that compensating can destroy the only committed copy — but "we kept it" is not
  the same as "it is durable", and the caller currently cannot tell the difference. This is the
  same defect class the `native-fs` cluster fixed for `remove_workspace_entry` on 2026-08-31
  (`f-20260830-07`, commit `ad03e196`), in a different subsystem.
* **Related:** `f-20260830-34` — Lichess tokens currently go to an in-process mock store because
  the `keyring` crate has no backend compiled in. Whoever works that will be in this file anyway,
  and the two answers interact: what "the secret survived" means depends on which store it is.
* **Why it is `build`:** the open question is what the user should be told and what the app should
  do next, not how to propagate a flag. Failing the link outright is wrong — the credential may
  well be there. Succeeding silently is what happens now. A third option is to succeed and schedule
  a re-verification at next start. That is a product decision about a real user's account.
* **Found by:** the `review-error-handling` lens (confidence 96) over the cumulative diff of the
  `native-fs` cluster, 2026-08-31. Pre-existing; that cluster touched `credentials.rs` only to log
  the previously discarded cause.

* **Handled:** `store_lichess_token` returns `LichessAccountStoreResult { account, durability_uncertain }`. `AuthenticationStatus::Succeeded` carries the flag; the poller still upserts. Removal is `Removed { revocation_pending, durability_uncertain }`. Accounts shows `Home.Accounts.LinkDurabilityUncertain` instead of `AuthenticationFailed`. Native success with a failed public fetch still upserts `{ id, username }`. Pending vs final persist uncertainty are tested independently.
* **Commits:** `4544875b` (IPC + UI), `3a1b856d` (independent persist tests).
* **Rejected:** mapping uncertain persist to `Failed` (Felix, d-20260831-18); a fourth unit variant `RemovedDurabilityUncertain` (d-20260831-20).

---

## 2026-08-31 — filed through the inbox spool

### Native pickers in AddDatabase, DatabasesPage export, and AccountCard still ignore rejection

* **ID:** f-20260831-15 · **Status:** handled · **Area:** frontend-ui · **Root:** - · **Entry:** inline · **Blocked:** none
* **Where:** `src/components/databases/AddDatabase.tsx` (`issuePgnWorkspace` in FileInput `onClick`),
  `src/components/databases/DatabasesPage.tsx` (`issuePgnExportDestination` inside `try/finally` with
  no `catch`), `src/components/home/AccountCard.tsx` (`ensureDownloadDestination` /
  `issueDownloadDestination` in a download click that only has `finally`).
* **Defect:** the same unhandled-rejection class as `f-20260830-12`. A dismissed native dialog is
  `Error::Cancellation` and becomes an unhandled promise rejection; a real failure is silent.
  `f-20260830-12` closed FilesPage, AddPuzzle, and Settings onto `errorUnlessCancelled`. These three
  sites were left because they have no test that would go red if the catch were omitted
  (plan-review, confidence 100).
* **Why it matters:** cancel looks like a hung click; a permission failure never notifies.
* **Fix shape:** the same catch as FilesPage: `errorUnlessCancelled`, notify on non-null, `void` the
  click promise. Add a DirectorySetting-sized test per site so reverting the catch is red. Helper
  and Display contract already exist (`d-20260831-25`, `d-20260831-26`).
* **Found by:** locate + `review-error-handling` over the `f-20260830-12` build, 2026-08-31.
  Related: `f-20260830-12` (same class, Root `-`, handled in this run).

* **Handled:** AddDatabase PGN picker, DatabasesPage export (`runPgnExport`), and AccountCard download destination use `runUnlessCancelled` / `notifyUnlessCancelled`. Cancellation is silent; real failures notify; export loading always clears. Proof: `AddDatabase.test.tsx`, `databaseMutation.test.ts`, `AccountCard.picker.test.tsx`.
* **Commits:** `35889711`
* **Rejected:** mounting DatabasesPage to test the export catch (`d-20260903-03`); showing a Cancellation notification (`d-20260831-26`).
* **Governed-by:** d-20260831-26, d-20260903-03

### Tab-tree flush failures are only logged, so a full sessionStorage quota drops pending edits on quit

* **ID:** f-20260831-16 · **Status:** handled · **Area:** frontend-state · **Root:** - · **Entry:** lens · **Blocked:** none
* **Where:** `src/state/store/tabStorage.ts` `flush()` (`:282-294`).
* **Defect:** each pending tree write is inside `try/catch` that only `warn`s. If sessionStorage is full when `beforeunload`/`pagehide` flushes, the debounce is dropped and the next load restores the last successful write with no user-facing error. `.claude/rules/persisted-state.md` requires a handled, comprehensible quota failure — the live `serializeStorageValue` path already has one; flush does not.
* **Why it matters:** quitting with a large game open is the realistic quota case (`d250925f`). The user thinks the last moves were saved.
* **Fix shape:** surface the same quota error the store uses on a live write; keep the per-key try so one full tab cannot block flushing the others.
* **Found by:** `review-persisted-state` over the `f-20260830-12` cumulative diff, 2026-08-31, confidence 99. Pre-existing, different area from the picker work.
* **Lens:** `review-persisted-state`

* **Handled:** `flush()` returns failed tab ids, keeps the per-key try, and notifies on the live debounce path with the same quota Error as `seed()`. `beforeunload`/`pagehide` never throw and never notify. Proof: `tabStorage.test.ts`, `persistError.test.ts`.
* **Commits:** `e4ccd864`, remediations in `ddea3a56`.
* **Rejected:** throwing from unload; a `beforeunload` confirm dialog; a durable next-startup flush-failed marker.

### Workspace ID migration removes legacy tree keys before the new envelope is durably written

* **ID:** f-20260831-17 · **Status:** handled · **Area:** frontend-state · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src/state/workspace.ts` `repairWorkspace` (`:64-67`) then `createWorkspaceStorage.getItem` (`:110-115`).
* **Defect:** copied trees are flushed and uniquely-owned legacy tab IDs are `remove`d, and only afterwards is the migrated workspace envelope `setItem`ed. If that envelope write fails (quota, private-mode, abort), the next startup still sees the old tab metadata (old IDs) whose trees are already gone, and reconstructs empty tabs.
* **Why it matters:** a one-time migration plus a full quota is a silent loss of every open game tree, not a recoverable hydrate failure.
* **Fix shape:** persist the new envelope (or fail closed) before deleting legacy tree keys; if the envelope write fails, leave the old keys in place. The comment at `:64-66` already states the intent — the envelope write is outside `repairWorkspace` and so does not honour it.
* **Found by:** `review-persisted-state` over the `f-20260830-12` cumulative diff, 2026-08-31, confidence 96. Pre-existing. Related: the tabStorage flush finding filed in the same review (Root `-`).

* **Handled:** ID migration clones, flushes, then writes a compressed envelope before deleting legacy tree keys. Envelope or clone-flush failure rolls clones back, leaves old keys, notifies, and returns the unrepaired workspace. Live `setItem` no longer remaps IDs. Proof: `workspace.test.ts` including envelope-write failure, clone-flush failure, and setItem preserving legacy ids.
* **Commits:** `a85a7474`, remediations in `ddea3a56`.
* **Rejected:** deleting old keys inside `repairWorkspace` before the envelope is durable; remapping ids on live `setItem`.

### Engine list persistence is uncompressed, unbounded, and its async setItem is uncaught

* **ID:** f-20260831-18 · **Status:** handled · **Area:** frontend-state · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src/state/atoms.ts` `enginesStorage` (`:172-188`) feeding `enginesAtom` via `atomWithStorage` / `createAsyncZodStorage`.
* **Defect:** engine state is written to localStorage key `engines` as uncompressed JSON. `setItem` is async and neither awaited nor caught, so a quota `QuotaExceededError` becomes an unhandled rejection and the edit disappears on reload. Tree state already compresses and raises a user-facing quota error (`src/state/store/debouncedStorage.ts`); this adapter does not.
* **Why it matters:** a handful of engines with option maps is usually small, but the contract is the same quota as every other origin-scoped key, and an unhandled rejection is the failure `persisted-state.md` names.
* **Fix shape:** route writes through `serializeStorageValue` (or the same quota-handled helper the tree uses), catch `setItem`, and tell the user when the engine list could not be saved. Do not invent a second storage encoding.
* **Found by:** `review-persisted-state` over the `f-20260830-12` cumulative diff, 2026-08-31, confidence 96. Pre-existing. The same lens also claimed a missing migration from `engines/engines.json`; that path is not in this tree, so it is not part of this finding.

* **Handled:** `createAsyncZodStorage` awaits `serializeStorageValue` writes and reads compressed-or-JSON. `enginesStorage.setItem` catches quota, reports `Engines.SaveError`, and resolves. Proof: `utils.test.ts`, `enginesStorage.test.ts`, `pnpm i18n:check`.
* **Commits:** `2effbf97`.
* **Rejected:** a third engines-specific encoding; compressing every `createZodStorage` preference atom; a max-engines cap that would wipe a large list on hydrate (product number; notify-on-quota is the bound that exists).

### stopEngine and killEngine rejections are discarded at the call site

* **ID:** f-20260831-19 · **Status:** handled · **Area:** engine-uci · **Root:** - · **Entry:** inline · **Blocked:** none
* **Where:** `src/utils/engines.ts` `stopEngine` / `killEngine` (`:165-171`); callers `src/components/boards/EvalListener.tsx` (`void stopEngine`, `:232-270`), `src/components/panels/analysis/EngineSelection.tsx` (`:22`), `src/components/panels/analysis/EngineSettingsForm.tsx` (`killEngine`, `:143`).
* **Defect:** the wrappers return the facade promise. Callers fire-and-forget, including with `void`, which does not catch. `stop_engine` can return timeout or disconnected errors, which become unhandled rejections while the UI still treats the engine as stopped.
* **Why it matters:** `.claude/rules/engine-lifecycle.md` — a stop that failed is not a stop. The unwrap removal in `f-20260830-18` did not introduce this; it only made the wrappers pass the already-throwing facade through.
* **Fix shape:** each caller catches with `errorUnlessCancelled` / `notifyUnlessCancelled` (or a dedicated engine-stop path) and does not mark the engine stopped until the command succeeds. Related: `f-20260831-11` (removing a local engine does not terminate its process) is a different defect, Root `-`.
* **Found by:** `review-error-handling` over the `f-20260830-12` cumulative diff, 2026-08-31, confidence 97. Different area from the picker work.

Handled in `7d834f82`, `dc458a78`. `EvalListener`, `EngineSelection`, and `EngineSettingsForm` await stop/kill, `notifyUnlessCancelled` on failure, and do not flip `loaded`/`enabled` until success. `stop_engine` reaps a dead actor so retry can spawn. Current `getBestMoves` failures notify. Success-path tests cover the flips.

---

## 2026-08-31 — filed through the inbox spool

### Final child reaping after force-kill is an unbounded `child.wait()`

* **ID:** f-20260831-20 · **Status:** handled · **Area:** engine-uci · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/engine/process.rs`, `ChildUciIo::terminate` after `start_kill()` —
  `self.child.wait().await` with no timeout.
* **Defect:** the graceful `quit` wait is bounded by `deadlines.quit`, but the force-kill path
  then awaits reaping with no deadline. A child in uninterruptible sleep cannot be delivered
  SIGKILL, so `wait` never returns. That stalls `EngineRuntime::terminate`; the new stderr-drain
  timeout is never reached and tab/app shutdown waits forever.
* **Why it matters:** the comment at the site says a failed graceful wait is never a reason
  to abandon the child, and that is a real invariant — bounding the wait leaks a zombie.
  Leaving it unbounded leaks the whole supervisor. That is a design question, not a timeout
  constant to pick in this push: abandon after kill, or stall.
* **Related:** f-20260830-53 (handled) owns the stderr drain; this is the child-reap path
  that still sits in front of that join. Root `-` because the cause is not the drain's
  missing owner.
* **Found by:** `$push` high-review lenses `n3-adjacent` (confidence 90) and
  `n5-adversarial` (confidence 98) over `685825c0..HEAD`, 2026-08-31.

Handled in `b9250a36`. `terminate_child` over `ChildControl` bounds the quit write, the graceful wait, and the post-kill wait (`EngineDeadlines.kill_reap`, default 2s). A timeout drops the `Child` so `kill_on_drop` can fire. No detached unbounded waiter (`d-20260901-18`). D-state residual is a zombie until app exit.

---

## 2026-08-31 — filed through the inbox spool

### addAnalysis reads previous ply best[0] without a length guard

* **ID:** f-20260831-21 · **Status:** handled · **Area:** chess-tree · **Root:** - · **Entry:** inline · **Blocked:** none
* **Where:** `src/state/store/tree.ts:765-769`, inside `addAnalysis`. The same function already
  guards `analysis[i - 1].best.length > 0` at `:790` before using that ply's PV for variations.
* **Defect:** the current-ply branch requires `analysis[i].best.length > 0`, then immediately
  reads `analysis[i - 1].best[0]` and `analysis[i - 2].best[0]` with no length check. An empty
  previous `MoveAnalysis.best` (no publishable MultiPV set for that ply) throws at runtime
  while annotating a later ply that did get lines.
* **Why it matters:** after `10192873`, bound-only UCI output no longer becomes a fake
  evaluation, so `analyze_game` can legitimately return `best: []` for a ply. The renderer
  assumption that every previous index has `best[0]` is then a crash rather than a skipped
  annotation. `src/utils/tests/store.test.ts` only drives two non-empty analyses.
* **Related:** f-20260831-10 (handled) made empty `best` reachable; this is the consumer that
  was not updated. Root `-` because the missing guard predates the bound-score skip.
* **Fix shape:** treat a missing previous/previous-previous `best[0]` as null scores and empty
  `prevMoves`, matching the `:790` length guard. Add a store test with an empty middle or
  previous analysis.
* **Found by:** `$push` high-review lens `review-error-handling` (confidence 94) over
  `8307bacc..HEAD`, 2026-08-31. Deferred: this run's loaded context is the UCI aggregation
  loops in `src-tauri/src/chess.rs`, not the renderer tree store.

* **Handled:** 2026-09-10, commit `42d2fce3`. Both predecessor reads in `addAnalysis`
  (`src/state/store/tree.ts`) now carry `analysis[i - 1].best.length > 0` /
  `analysis[i - 2].best.length > 0`, matching the guard the variation branch already used.
  A missing predecessor yields `prevScore = null` and `prevMoves = []`; `getAnnotation`
  already handles both (`prev || { type: "cp", value: 0 }` and a `prevMoves.length > 1`
  gate), so no change was needed in `src/utils/score.ts`.
* **Proof:** `addAnalysis skips plies whose predecessor has no lines` in
  `src/utils/tests/store.test.ts` drives a three-ply analysis with an empty middle entry.
  Measured red without the guards (`TypeError: Cannot read properties of undefined
  (reading 'score')`) and green with them; 30/30 in that file.
* **Rejected:** skipping the whole ply when its predecessor has no lines. That would drop
  the current ply's score as well, which is available and correct; the finding's stated fix
  shape — null scores and empty `prevMoves` — preserves it.
<!-- ledger-meta {"command":"annotate","effect_lines":13,"effect_sha256":"38b6e83b604e452285c493b0db9f750558106a77616d25dff08e44aa0eea4e11","input_sha256":"681526b66e28b11646a3b2f4afdc6f12a88b006f68cd3f47f15ce4e6146a4bc1","kind":"mutation-receipt","operation":"ffe24e70ccaa32b950e503434a72f5147fae1b9815e31b6194052c566173b561","options":{"section":null},"request_id_sha256":null,"results":["f-20260831-21"],"target":"f-20260831-21","v":1} -->

* **Correction to the closing note above.** It was written before the push review and is
  superseded in two respects: the commit hashes changed when the range was rewritten to carry
  the acting agent as committer, and the claim that `src/utils/score.ts` needed no change was
  wrong. The delivered commits are `d6e62077` (the two `addAnalysis` length guards),
  `531829ee` (the `getAnnotation` repair) and `915b846d` (the round-2 test repairs).
* **Guarding the crash was not sufficient.** `review-chess-semantics` found that
  `getAnnotation` coerced a null previous score to an invented 0.00 evaluation, so the ply
  after a lineless predecessor was measured against a baseline that does not exist — from a
  won position that reads as a blunder and the ply received a `??` it had not earned. The same
  coercion let a null previous-previous score manufacture the improvement `!` asserts.
  `getAnnotation` now derives no mistake annotation without the previous evaluation and no `!`
  without the previous-previous one; `!!` and `!?` depend on neither and are unchanged
  (`d-20260910-01`).
* **Proof, measured on the final tree:** reverting either length guard reproduces
  `TypeError: Cannot read properties of undefined (reading 'score')`; restoring the 0.00
  coercion fails with `expected '??' to be ''` and `expected [ '??' ] to strictly equal []`;
  nesting the `is_sacrifice` branch back under the prevprev guard fails with
  `expected '' to be '!!'`. All three branches are individually pinned. 43/43 in
  `src/utils/tests/score.test.ts` and `src/utils/tests/store.test.ts`.
<!-- ledger-meta {"command":"annotate","effect_lines":19,"effect_sha256":"acb7ca3c20c621f69a0a5a4e7ae7d86aa023fca3ebb3a59bf5dc45305a9d4fa7","input_sha256":"3c1a4264276437c0b468e0150d302948d741f24c45c49e6e5ef8960de4c0ca57","kind":"mutation-receipt","operation":"a20700af016b02eb4035024cb46b5523bf8a87c75cffab6074aeea080665342f","options":{"section":null},"request_id_sha256":null,"results":["f-20260831-21"],"target":"f-20260831-21","v":1} -->

* **Correction:** the decision reference in the note above is `d-20260910-09`, not
  `d-20260910-01` — the id was written before `record-decision` allocated it, and
  `d-20260910-01` is an unrelated entry about the desktop-entry basename.
<!-- ledger-meta {"command":"annotate","effect_lines":3,"effect_sha256":"4d5153297eb13174bae9366a6cf9f77cd4470b421b6a0d79393a291d68dc53ba","input_sha256":"56b8a712936768f5cab817ad4e832b63d00ba83ded2c64d6eba7c250f448474a","kind":"mutation-receipt","operation":"5237b41b1969b610c4378d0fd0dd0779827282aefd1d23f6ee1769dda3e36c74","options":{"section":null},"request_id_sha256":null,"results":["f-20260831-21"],"target":"f-20260831-21","v":1} -->

---

## 2026-09-01 — filed through the inbox spool

### Empty the Rust filesystem-surface allowlist by routing remaining production reaches through PathAuthority

* **ID:** f-20260901-01 · **Status:** handled · **Area:** native-fs · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** the shrink-only allowlist in `scripts/check-rust-release-surface.mjs` (`INITIAL_FS_SURFACE_ALLOWLIST` / `INITIAL_FS_SURFACE_COUNTS`), covering production `std::fs` / `tokio::fs` / pathname `atomic_replace` in `credentials.rs`, `db/mod.rs`, `db/repository.rs`, `db/search_index.rs`, `file_workspace.rs`, `fs.rs`, `main.rs`, `puzzle.rs`, `sound.rs`.
* **Defect:** f-20260830-23 landed the write-time gate (R3/R4) with those nine files exempted at pinned match counts. The original invariant — every filesystem reach goes through PathAuthority, and pathname `&Path` primitives are not callable from outside it — is still false for those files. `atomic_replace(&Path)` remains `pub` and is still used from `main.rs`, `credentials.rs`, `fs.rs` and `search_index.rs`.
* **Why it matters:** the gate stops *new* modules; it does not stop a new `std::fs::write` in `main.rs` except via the per-file count (same-count substitution on one line still passes). Emptying the allowlist is what makes the convention true.
* **Fix shape:** route each remaining production site through PathAuthority / descriptor `*_at` forms, then shrink the allowlist and counts to empty. Related: f-20260830-23 (the gate; Root `-`, so named here rather than shared). Do not reopen clippy.toml (`d-20260901-02`).
* **Found by:** Grok, drain session d0b4541b, while closing f-20260830-23, 2026-09-01.

* **Handled:** 2026-09-05, commits `6e1d76fd` (the gate rule), `2a207ae0` (`db/search_index.rs`),
  `080fd335` (the registration-body extraction) and `66fce39e` (the app-owned default root).
  Measured: **37 counted R3/R4 sites to 30**, and **nine allowlisted files to seven** —
  `src-tauri/src/db/search_index.rs` and `src-tauri/src/puzzle.rs` removed entirely, `main.rs`
  lowered from 5 to 2.
* **The allowlist is NOT empty, and this closure does not claim the convention is now true.**
  The remaining 30 sites are six distinct design questions in three ledger areas, each filed as
  its own build-tier entry with this run's evidence: **`f-20260905-02`** (credential
  initialisation runs before `PathAuthority::open`, 5 sites), **`f-20260905-03`**
  (`canonical_database_path` is the repository's map key, 3 sites), **`f-20260905-04`**
  (`DatabaseIdentity.path` is archived into every `.ecsi` sidecar's provenance, plus the
  lock-across-pool-construction defect in the same function family), **`f-20260905-05`**
  (`PathAuthority` has no directory-enumeration capability, 5 sites),
  **`f-20260905-06`** (the temp-to-temp `atomic_install_dir` pair), and **`f-20260905-07`**
  (the backend-chosen-destination token question, 10 sites — the one that actually gates
  emptying the allowlist, and which names the still-open engine-image symlink window).
  `f-20260905-01` records a defect this run's design deliberately carries forward: a deleted
  **default** root directory is now a permanent dead end.
* **What makes the shrink provable rather than asserted:** before `6e1d76fd`, an allowlist entry
  could sit at count 0 for ever, or survive the deletion of its file, with every gate green —
  `checkFilesystemSurface` emitted nothing for a path with no matches. Both shapes are now
  violations, and `rust:surface:check` passes `--check-allowlist-residency`, so the two removals
  are enforced by the gate rather than described in a commit message.
* **Decisions:** `d-20260905-01` (shrink rather than empty, and why the residue is six entries
  and not one), `d-20260905-02` (the closed-enum shape and the three rejected alternatives),
  `d-20260905-03` (why the dialog callers keep refusing an absent directory),
  `d-20260905-05` (why the outermost triplication stays).

---

## 2026-09-01 — filed through the inbox spool

### Engine registration callers drop CommittedDurabilityUncertain without recovering the adopted handle

* **ID:** f-20260901-02 · **Status:** handled · **Area:** frontend-ui · **Root:** - · **Entry:** lens · **Blocked:** none
* **Where:** `src/components/engines/EngineForm.tsx`, `src/components/engines/EnginesPage.tsx`, `src/components/engines/AddEngine.tsx`, `src/components/boards/BoardGame.tsx`
* **Defect:** after `dd2c0f58`, engine binary/resource/image/opening-book registration adopts the registry record then returns `CommittedDurabilityUncertain` when parent sync fails. File and database create paths recover that category (`runAppliedMutationWithRefresh` / `runWithAppliedRecovery`). Engine callers treat it as a hard failure and lose the adopted handle, leaving a UUID-named image unattached.
* **Related:** f-20260831-02 (handled). Root `-` so named here rather than shared. Found during cumulative review of the native-fs download/registry slice.
* **Entry `lens`:** apply the existing `applied-despite-error` helpers; one `review-error-handling` pass.

* **Handled:** Engine file/image/book/resource registration returns the adopted handle after an uncertain parent sync (`keep_adopted_handle`). `registerInstalledEngineHandle` recovers via `runWithAppliedRecovery`. Picker clicks use `runUnlessCancelled`. ProgressButton treats only `succeeded` as completed; AddEngine clears progress on install failure. Proof: `engine_path_commit_wrappers_return_handle_on_uncertain_without_rollback`, `engines.controller.test.ts`, `EngineForm.test.tsx`, `ProgressButton.test.tsx`.
* **Commits:** (this run)
* **Rejected:** Err plus a renderer list; a new Specta result type; treating any `finished` progress as installed (`d-20260901-22`, `d-20260901-24`).
* **Lens:** `review-error-handling` on Codex `gpt-5.6-sol`/medium, VERDICT REVISE then fixed: failed download no longer shows Installed; durability log now names the adopted handle.
* **Governed-by:** d-20260901-21, d-20260901-22, d-20260901-24

* **Commits:** `8952f592`

---

## 2026-09-01 — filed through the inbox spool

### RootLayout and TopBar still have no wiring test for menu and window-control handlers

* **ID:** f-20260901-03 · **Status:** handled · **Area:** frontend-ui · **Root:** - · **Entry:** inline · **Blocked:** none
* **Where:** `src/routes/__root.tsx` (`menuCallbacks` / `runMenu` / `useHotkeys`), `src/components/TopBar.tsx` (minimize/maximize/close click handlers).
* **Defect:** f-20260830-47 extracted and tested the menu tree and the `runNativeMenuAction` / `runWindowAction` helpers. The product still wires those helpers in RootLayout and TopBar, and nothing mounts either component. Removing `runMenu` from a menu callback, or the `runWindowAction` wrapper from a window-control click, leaves every current test green. `createMenu` is now a thin `assembleNativeMenuResources` wrapper; the remaining untested surface is that wiring, not the sequential assembler.
* **Why it matters:** an unhandled rejection on Help → Clear saved data, Open file, or a window-control click is the same class the extract was meant to close, and it would ship again without a red test.
* **Fix shape:** extract the RootLayout callback object and the TopBar window-control handlers into the existing `-appMenu.ts` / `TopBar.window` test surface so each handler's returned promise is the helper's promise (same pending-until-settled proof as `openPgnFromMenu`). Do not jsdom-mount RootLayout — that was rejected in `tasks/plans/2026-09-01-native-menu-tree.md` because it would mock every native import and would not catch GTK. Related: f-20260830-47 (handled). Root `-`, so named here rather than shared.
* **Found by:** cumulative review of the native-menu-tree slice (drain session 98e601ec), recovered after the 2026-09-01 04:00 shutdown. `review-tests` confidence 98/97.

* **Handled:** RootLayout menu callbacks go through `bindAppMenuCallbacks`; TopBar minimize/maximize/close go through `bindWindowControls`. Each handler returns `runNativeMenuAction` / `runWindowAction`'s promise. Proof: `-appMenu.test.ts`, `TopBar.window.test.ts`.
* **Commits:** `eed230e5`
* **Rejected:** jsdom-mounting RootLayout (already rejected in the native-menu-tree plan).
* **Governed-by:** d-20260901-11

---

## 2026-09-01 — filed through the inbox spool

### ConvertProgress and DatabaseProgress broadcasts still lack a discriminator the renderer filters on

* **ID:** f-20260901-04 · **Status:** handled · **Area:** bindings-ipc · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/db/mod.rs` ConvertProgress emit; `src/hooks/useConversionProgress.ts:30`; `DatabaseProgress.id` at `src/bindings/generated.ts:1003` vs `src/components/home/Databases.tsx:129`.
* **Defect:** `ConvertProgress` is globally emitted without an operation id, and `useConversionProgress` writes every event into one shared atom, so concurrent conversions mix counts and source names. `DatabaseProgress` carries an `id`, but `Databases.tsx` ignores it and `Promise.allSettled` of `getPlayersGameInfo` therefore drives one bar with interleaved percentages. Related: ipc-events.md incidents `daecd674` / `convert_progress`; this is the remaining discriminator gap, not the unregistered-event bug already handled. Root `-` because the two payloads already differ (one has a unused id, one has none).
* **Why it matters:** `.claude/rules/ipc-events.md` — anything broadcast globally carries an id the receiver filters on. Concurrent imports or player-info queries present as a jumping or false-complete bar.
* **Fix shape:** give ConvertProgress a real operation id and filter on it; filter DatabaseProgress on an id that uniquely identifies the in-flight `getPlayersGameInfo` (not a database-local player row id).
* **Found by:** `review-ipc-contract` over the f-20260830-30 cluster cumulative diff, 2026-09-01. Pre-existing; different area from the listener/persist work.

Handled 2026-09-04. `DatabaseProgress` is deleted: `get_players_game_info` takes a
renderer-minted `progress_id` and reports through the one `ProgressEvent` registry, copying
`search_position`'s division of labour (guard on the async frame, cloned lease into the blocking
closure, `complete(Succeeded|Failed)` from the join result without `?`). That gave the command a
terminal state for the first time. `ConvertProgress` is kept as a counter event — a conversion has
no total to divide by — and gains an `id` set from a new `progress_id` argument;
`useConversionProgress` accepts a frame only when it matches
`conversionProgressId(previous.targetDatabase)`. The half that decides whether the filter works is
the teardown: the two sites that cannot compare a handle (`DatabasesPage`'s `setLoading` bridge,
`AccountCard`'s `onClick` `finally`) stop writing the atom entirely, and the handle-owning ones
compare with `sameDatabaseHandle`. `SearchProgress` was extracted to `progress.rs` as the shared
runtime-generic `JobProgress` rather than copied. Commits `a5f81f5d`, `e3d12ba4`, plus the review
fixes in the follow-up commit. Decisions `d-20260904-14`, `-15`, `-16`, `-18`, `-19`.
Rejected: giving `DatabaseProgress` a better id; folding the conversion counters into
`ProgressEvent`; a lease for `convert_pgn`; making all four conversion teardowns compare-and-clear.

### createTab seeds the tree before the workspace envelope is durable

* **ID:** f-20260901-05 · **Status:** open · **Area:** frontend-state · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src/utils/tabs.ts:64-81` (`tabStorage.seed` then `setTabs` / `setActiveTab`); `src/state/workspace.ts` `createWorkspaceStorage.setItem`.
* **Defect:** an import can persist the game tree and then fail to persist the workspace envelope (quota). The next reload reconstructs tabs from the last durable envelope, so the new game is missing and the seeded tree key is an orphan. `setItem` now catches and notifies, but the two writes are still not one commit. Related: f-20260831-17 (startup migration order; Root `-`).
* **Why it matters:** quitting or reloading after a large import is the same quota case as d250925f; the user thinks the game opened.
* **Fix shape:** do not seed a tree whose tab is not yet in a durable envelope, or roll the seed back if the envelope write fails.
* **Found by:** `review-persisted-state` over the f-20260830-30 cluster cumulative diff, 2026-09-01.
* **Lens:** `review-persisted-state`

* **Entry revalidation, 2026-09-06:** lens to build. Final review confirmed the live-close counterpart f-20260906-22 deletes existing tree data before envelope durability. createWorkspaceStorage.setItem catches failure and returns no receipt, so a local creation rollback or close reordering cannot know whether the envelope landed. A shared live create/close commit acknowledgment and rollback contract now needs a design round. This is new cross-lifecycle evidence, not a tier change for effort or quota. Keep startup ID-migration decision/f-20260831-17 intact; it already solves a different migration path. Defer to the dedicated live workspace lifecycle design run.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"3581c0da9e58321c2ec1bc1916f2157e08f0ddcbe96461a0c629a75df8371b65","input_sha256":"c593eeabec039afa7e8abcf7a986cc027019e23368fdd966dc4fc13c71ecd2d9","kind":"mutation-receipt","operation":"110b47ef1da7f59b7be650931425328c429084e660d5740206a3cb9878a4ca6f","options":{"section":null},"request_id_sha256":null,"results":["f-20260901-05"],"target":"f-20260901-05","v":1} -->

---

## 2026-09-01 — filed through the inbox spool

### Workspace delete of an engine binary does not retire its supervised process

* **ID:** f-20260901-06 · **Status:** handled · **Area:** engine-uci · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/file_workspace.rs` trash/permanent-delete; `src-tauri/src/infra/fs.rs` recursive unlink; the supervisor it does not call is `EngineSupervisor::retire_engine` in `src-tauri/src/engine/process.rs`.
* **Defect:** deleting a workspace directory unlinks descendant engine binaries with no supervisor lookup. A UCI child whose executable lived in that tree keeps running (open fd) until tab close or app exit.
* **Why it matters:** `f-20260831-11` (handled) added `retire_engine` for renderer identity removal. Workspace delete is the other identity-disappearance path named in that finding and was left out because it lives in the native-fs file set (`d-20260901-17`).
* **Related:** f-20260831-11 (handled). Root `-` because the missing caller is a different file set, not the same unowned spawn.
* **Found by:** locate probe during the `engine-uci` cluster pinned at f-20260831-11, 2026-09-01.

Handled 2026-09-01. Permanent workspace delete reports dropped EngineExecute/Configure PathRefs even on registry-save Err, tombstones those PathRefs, and `retire_executables` terminates matching actors. Application ids are not `retire_engine`d so a replacement PathRef can still publish. Trash only rebinds. Commits `dc6b7841`, `fd90e3b2`. Rejected: renderer FilesPage scan; `retire_engine(E)` on unlink (`d-20260901-29`).

### Game-manager engines have no application id, so engine removal cannot terminate them

* **ID:** f-20260901-07 · **Status:** handled · **Area:** engine-uci · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/game.rs` `PlayerConfig::Engine` (`name` + `handle`) and `GameController.white_engine` / `black_engine`.
* **Defect:** a game against a local engine holds an `EngineActor` outside `EngineSupervisor`. Removing that engine from EnginesPage retires the supervisor id but leaves the game child running. There is no application id on the session to match.
* **Why it matters:** matching by `EngineHandle` would kill a duplicate config that still exists. Adding an id is a game-start Specta contract change. Related handled `f-20260830-51` recorded that game engines outlive app exit; this is the removal-path sibling (`d-20260901-20`).
* **Related:** f-20260831-11 (handled), f-20260830-51 (handled). Root `-`.
* **Found by:** `review-engine-protocol` during plan review of the f-20260831-11 cluster, 2026-09-01.

Handled 2026-09-01. `PlayerConfig::Engine` requires `engine_id`. Game actors register through `EngineSupervisor` after spawn and before UCI init, keyed `game:{id}:{session}:{side}` / application id so `retire_engine` reaps that game without matching by handle or by the word "white". Cleanup is `terminate_exact`. Commits `9c115083`, `fd90e3b2`. Rejected: second GameManager kill path; handle matching (`d-20260901-20`, `d-20260901-30`).

### Report analysis progress is emitted under a UUID id that ReportPanel never subscribes to

* **ID:** f-20260901-08 · **Status:** handled · **Area:** bindings-ipc · **Root:** - · **Entry:** lens · **Blocked:** none
* **Where:** `src/components/panels/analysis/ReportModal.tsx` builds `report_${tab}_${uuid}`; `src-tauri/src/chess.rs` `analyze_game` emits `ProgressEvent` under that id; `ReportPanel.tsx` subscribes and clears `report_${activeTab}`.
* **Defect:** `useProgress` requires exact id equality, so the report progress bar never shows real progress and cancellation clears the wrong entry.
* **Why it matters:** the same producer/consumer split as `search_progress` / `convert_progress` in `.claude/rules/ipc-events.md`. Pre-existing; surfaced while adding `engine_id` to `analyzeGame`.
* **Related:** not the same defect as f-20260831-11. Root `-`.
* **Found by:** `review-ipc-contract` over the f-20260831-11 cumulative diff, 2026-09-01. Confidence 99.

Handled 2026-09-04, together with `f-20260904-02`, which is the same defect filed four days later
by a second lens run. The report operation id now lives on the per-tab zustand tree's `report`
slice, so `ProgressButton` subscribes to the id `analyze_game` actually emits under and the bar
moves. Because `ReportPanel` unmounts on every board-tab and sub-tab switch (`keepMounted={false}`),
putting the id in the store also fixes the reattach: Cancel works after a remount, where it
previously found a null ref. Two traps decided the shape — the persisted Zod schema strips unknown
keys (so the schema and `migrateTreeForStorage` had to change, coercing rather than rejecting, or a
wrong-typed value would discard a whole analysed game), and `isCurrentOperation` must read the live
store because `ReportModal` captures that callback at submit time and zustand `set` does not update
a closed-over value. The button gets `completeOnProgressSuccess={false}` so a succeeded progress
entry cannot claim a report whose result the unmount dropped. Commit `f73298f7` plus the review
fixes. Decisions `d-20260904-17`, `-20`, `-21`.
Rejected: `useState`/`useRef` for the id; emitting the per-tab id from the backend; a
`tauri.startProgress` handshake before `analyzeGame` (`d-20260904-21` records why it is unsafe).

### report-settings hydrates unvalidated JSON and an unguarded write can throw

* **ID:** f-20260901-09 · **Status:** handled · **Area:** frontend-state · **Root:** - · **Entry:** lens · **Blocked:** none
* **Where:** `src/components/panels/analysis/ReportModal.tsx` `atomWithStorage("report-settings", …)` without `createPreferenceStorage`.
* **Defect:** older or hostile JSON such as `{"engine":"id"}` hydrates without defaults, then rendering dereferences missing `goMode.t`. A full localStorage makes the unguarded write throw and blocks starting a report.
* **Why it matters:** `.claude/rules/persisted-state.md` — every write/read goes through serialize/deserialize, and corrupt data must fall back. Pre-existing; ReportModal was opened to pass `engine.id`.
* **Related:** f-20260831-18 (handled) is engine-list persistence, different key. Root `-`.
* **Found by:** `review-persisted-state` over the f-20260831-11 cumulative diff, 2026-09-01. Confidence 98.

* **Final persisted-state review, 2026-09-06:** Luna confidence98 repeated missing goMode hydration at ReportModal.tsx:16. Root verified the raw atom and loaded validated preference helper. Fix now with an explicit report-settings domain schema and guarded preference storage; include actual malformed hydration and quota-save tests. No expansion into report operation ownership/lifecycle.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"2196e00ca9421e66679af7974d5fea690210b95148a6e37981db960482411a41","input_sha256":"d537217b23f0ee74fe3f30304687110c4c83ceb369c86930e0f2cd9f1c0bf7a7","kind":"mutation-receipt","operation":"6c08133e90aa861d3439d60e843c8e71c980667a25fc0d8a07def933410e7529","options":{"section":null},"request_id_sha256":null,"results":["f-20260901-09"],"target":"f-20260901-09","v":1} -->

Final review repair completed in 88c1b7bb (tab transitions), 3de47fe2 (ordinary preference/report validation and safe failures), and c0016006 (exact opponent branches, legacy engine identity migration, shared startup snapshot and visible binary-path validation). Root read each complete package and retained proof in root-final-frontend-proof.log: 18 focused files / 137 tests and 49 related files / 317 tests passed, TypeScript and full lint:ci passed, all 16 locale catalogs pass extraction/completeness, diff check passed. The actual container Add Engine / Local validation screenshot also passed with both required errors visible and no native capability issuance. Earlier failed lint attempts were corrected before these commits (locale key order and unnecessary internal schema-message literals). Full task gates and actual native-app lifecycle verification still follow; these narrow claims do not substitute for them. Decisions d-20260906-12/-13 record the migration/failure contracts. Plan authorship and arbitration shared root context; detection ran on the same Codex family in separate sessions.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"04218074af88a9d65352faa49210581f3e58440aa5c368637305977f1abc7f4c","input_sha256":"4a2e2517e787868ac144ce73bb4345ec2cf0c305f09eeaee9ab1fc323042b2c7","kind":"mutation-receipt","operation":"f41bf08f269ce6176473b72e3d2f9cceb14f760e3931b531f7684e80270d278d","options":{"section":null},"request_id_sha256":null,"results":["f-20260901-09"],"target":"f-20260901-09","v":1} -->

### get_engine_logs returns success with an empty vector when the actor channel fails

* **ID:** f-20260901-10 · **Status:** handled · **Area:** engine-uci · **Root:** - · **Entry:** inline · **Blocked:** none
* **Where:** `src-tauri/src/engine/process.rs` `logs()`; `src-tauri/src/chess.rs` `get_engine_logs`.
* **Defect:** a disconnected actor yields `Ok(vec![])`, so `LogsPanel` renders empty logs instead of an error.
* **Why it matters:** a failed stop is not a stop; a failed log query is not "the engine said nothing". Pre-existing; not part of the retire/reap diff.
* **Related:** f-20260831-19 (handled) is renderer stop/kill rejections. Root `-`.
* **Fix shape:** return the channel error; renderer `notifyUnlessCancelled`.
* **Found by:** `review-error-handling` over the f-20260831-11 cumulative diff, 2026-09-01. Confidence 98.

Handled 2026-09-01. `logs()` returns `Result` without `unwrap_or_default`. Absent process is still `Ok([])`. Channel failure is `EngineDisconnected` through chess and game commands. LogsPanel and BoardGame notify once (`errorRetryCount: 0`). Commit `77a232f4`. Rejected: empty success (`d-20260901-32`).

---

## 2026-09-01 — filed through the inbox spool

### Decision toasts fire on review, not only on a new park
* **ID:** f-20260901-11 · **Status:** handled · **Area:** gate-scripts · **Root:** - · **Entry:** inline · **Blocked:** none

* **Where:** `scripts/findings.py` (`cmd_decisions`, `_announce_felix_blockers_unlocked`), `scripts/findings-parity-tests.py` (`SIBLING_REF`).
* **Defect:** Bare `python3 scripts/findings.py decisions` posted a persistent desktop toast for every waiting Felix item. ChessRiddle `6f83b80d8` and Korrigio `30a44a75d` now toast only when the drain names newly parked ids, expire at 30 s, and drop the stamp when the blocker is cleared.
* **Fix:** Adopt those announce hunks. Re-pin `SIBLING_REF` to ChessRiddle `6f83b80d8`. Keep the existing `atomic-write-cleanup-preserves-primary-error` declaration. Do not edit `scripts/findings.py` until this drain releases the consumer lock.

**Handled 2026-09-01.** Bare `findings.py decisions` no longer toasts. Named ids (the drain park path) ping once at 30 s, then expire. Cleared ids drop their announcement stamp so a later re-park can fire. ChessRiddle sibling re-pinned to `6f83b80d8`. The remaining ChessRiddle-ahead delta (product-impact park gate, `_BULLET` grammar, product/Sentry listing split) is declared `product-decision-gate-and-listing` and is not this finding.

### register_installed_engine discards the no-follow descriptors and re-walks by pathname

* **ID:** f-20260901-12 · **Status:** handled · **Area:** native-fs · **Root:** unbounded-native-reads · **Entry:** build · **Blocked:** none

* **Where:** `src-tauri/src/infra/path_authority.rs` `register_installed_engine`, after `resolve` of the engine-root plus relative components.
* **Defect:** the verified descriptors from the no-follow resolve are discarded. The function then reacquires the workspace root path, joins the renderer-supplied relative components, and registers by pathname. A file replaced at that path between the two walks is adopted with engine-execution authority. Registering from the already-opened descriptor is an architecture change in PathAuthority, not a one-line guard.
* **Why it matters:** `installDefaultEngine` and `registerInstalledEngineHandle` now retry this path as a lookup after uncertain parent sync, so the window is on the default-engine install recovery this range just added.
* **Related:** f-20260830-32 (handled class, image-read TOCTOU). Root `unbounded-native-reads` is the shared cause.
* **Found by:** `review-tauri-security` over the f-20260831-13 / f-20260901-02 push range, 2026-09-01. Confidence 96. Pre-existing; not part of the keep_adopted_handle change.

**Progress 2026-09-05 (AuthorizedDir run).** Phase 2 closed the registry-binding half: `register_installed_engine` now binds the `resolve` it previously discarded and calls `register_engine_file_verified(..., resolved.identity()?)`, so the stored identity is the descriptor's, not a second pathname walk. The finding's own subject remains open: `register_installed_engine` still throws the no-follow descriptors away and re-walks by pathname to build the `PathBuf` it hands the registrar (`workspace_root` + `Path::join` of the relative components). The recorded fix shape — "an architecture change in `PathAuthority`, not a one-line guard" — is no longer the whole truth; the identity check is now one argument, and what is left is routing registration through the retained descriptor instead of a reconstructed path. Stays `open` at `build`.

**Handled 2026-09-06 (Codex):** 7a4d6fc8 persists installed-engine identity directly from the resolved descriptor, using its target only as a restart locator. Shared insertion preserves stable IDs, operation sets and rollback without pathname reacquisition. A deterministic post-resolve replacement now permits registration of the original identity and rejects replacement on later use after restart. Directory/link/traversal, stable retry/restart and persistence-failure tests pass. Root proof: `cargo test --manifest-path src-tauri/Cargo.toml --locked` passed (660 passed, 1 ignored), format and diff checks passed. Decision d-20260906-08 extends d-20260905-08 and rejects redundant pathname revalidation.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"79197cdd319b7d7ea620a59387dafa471b4e9803ac9fb3ac875261fe6d337410","input_sha256":"214ccad25875a4441a66b5d26dfe623ec77e043219b915391e4499c57e23e2a2","kind":"mutation-receipt","operation":"dd40bc76b086a70dca2c05ce6a416337ddd7fd2fd3521f2c3ed68be20dab0145","options":{"section":null},"request_id_sha256":null,"results":["f-20260901-12"],"target":"f-20260901-12","v":1} -->

### Engine image and resource replacement never releases the previous capability

* **ID:** f-20260901-13 · **Status:** handled · **Area:** native-fs · **Root:** unbounded-path-registry · **Entry:** build · **Blocked:** none

* **Where:** `src-tauri/src/infra/path_authority.rs` `promote_dialog`; renderer callers `EngineForm` image picker and `EnginesPage` resource/image replacement.
* **Defect:** each replacement creates a fresh persistent capability. There is no release or reconciliation on the previous image/resource handle, so repeated selections accumulate registry entries and UUID-named copied images remain on disk.
* **Why it matters:** `keep_adopted_handle` now returns Ok on uncertain parent sync, so more of those entries stay reachable instead of being dropped as Err. The missing owner/cleanup is the path-registry bound, not the durability mapping.
* **Related:** f-20260830-35. Root `unbounded-path-registry`.
* **Found by:** numbered-3 adjacent lens over the f-20260901-02 push range, 2026-09-01. Confidence 98. Pre-existing.

* **Integration follow-up (2026-09-06, Codex):** After phase2 commit `739db8db`, root traced the EditEngine submit receipt through EngineForm adoption. A target deleted before the queued functional update correctly stays deleted, but the unchanged-list write still returns `saved: true`; the form then forgets newly picked provisional attachments that no persisted record contains. The same-file validation worker will return an unsuccessful correlated edit receipt when no immutable target was present, and test that result. This is part of the attachment draft ownership defect, not a new product question; do not claim completion until the follow-up is verified.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"58169bb77641fffcba811045c2f31cfe2a99e859734c32a747ac1ab6130d9923","input_sha256":"7bcc5d381eca0bbd5b31ece5248615f6f6bae5e6dc1dd9a2fdd641653317f1b1","kind":"mutation-receipt","operation":"a0dae1f5f308cad65bc9b2bd1cb175b39038cffd8956a165da3ef7e47df4200d","options":{"section":null},"request_id_sha256":null,"results":["f-20260901-13"],"target":"f-20260901-13","v":1} -->

* **Final test review (2026-09-06, Codex Luna Extra High):** Add the complete quota-failed first-add to fresh-startup protocol regression and page-level file/directory resource picker, append/replacement and cleanup assertions. The current collector already asserts that absent engines plus a valid player is trusted, so the lens claim that any absence-trust regression would pass all tests is too broad; the full quota/restart sequence and resource picker wiring still lack direct anchors. Root adopts those test improvements under the existing ownership acceptance, not a new feature.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"053c665c67dd9ff89d7e29584773bd891a5bde1ecfb98ced2463510053f57b43","input_sha256":"42b43f1d48732686c1fb5c4c3b4e061af5f347a89c48f2dc58e93faa9097efcf","kind":"mutation-receipt","operation":"6e06b063eaf7c5c7d43f9c5ef9517700be77a4eee9473f9a50f0bd5e56cbb20a","options":{"section":null},"request_id_sha256":null,"results":["f-20260901-13"],"target":"f-20260901-13","v":1} -->

* **Final root-cause review (2026-09-06, Codex Luna Extra High, confidence 94):** `issue_engine_image_blocking` reads/copies outside the authority mutex, then checks the shutdown seal only when registering the copied UUID. Shutdown currently seals and cleans without draining active image issuance, so ordinary close can exit after a late copy but before registration-refusal cleanup. Root confirmed main.rs:1133-1219. Add an in-process issuance lifetime/fence: reject new work after sealing, keep the lease alive through the complete blocking copy/registration/error-cleanup operation, and wait for active image operations before final cleanup outside the authority mutex and within the existing aggregate shutdown budget. Prove a paused real issuance and concurrent shutdown; do not put the 10 MiB read/copy back under the global authority mutex. This is a required ownership fix, not a background service.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"042143d751395dbb33f80e5b9e2312f40ded40ec7c37a6947a1fd8e59cb6353f","input_sha256":"e2bbc9f77d7dbf6857fc3e6a8fda726ada9d36beddbc1eda8188fa9118b7b52f","kind":"mutation-receipt","operation":"9ac80d19c0d618f84a9f30fb2f41d3e79cefe02c15d4d041063f325be7c5f9d0","options":{"section":null},"request_id_sha256":null,"results":["f-20260901-13"],"target":"f-20260901-13","v":1} -->

* **Final minimalism review (2026-09-06, Codex Luna Extra High):** Root adopts one raw pass for both startup owner snapshots, shared engine/attachment traversal, removal of the now production-unused enginesStorage/string adapter with useful tests migrated to the real coordinator, and removal of the redundant single-caller abandon wrapper. The three owner keys are currently read and parsed twice at startup (pathOwners.ts:130-150 and :226), and ownership traversal is duplicated across pathOwners/engineOwnerStorage. These are shared-domain/update-surface corrections under the same ownership task, not cosmetic API expansion. Preserve every current trust/error/receipt behavior and test it.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"463721cf6358620236021c1492b02bf3d7babd40b6621a9a09ebcf54097db7b3","input_sha256":"b7d4867557b3bff822735d55e2457762d610e2353d2d7782adf056ae71a9f911","kind":"mutation-receipt","operation":"40b0d7054381bebfd1f223a3628dacd7098976c17e5bc6e4eaaa8131feb360bd","options":{"section":null},"request_id_sha256":null,"results":["f-20260901-13"],"target":"f-20260901-13","v":1} -->

* **Final review follow-up (2026-09-06, Codex Luna Extra High):** Engine-protocol confidence 98 found hydration now rejects a schema-valid legacy engine lacking its default-generated id because normalization is not deeply equal to raw input. Root confirmed createEngineOwnerStorage. Keep original raw owner evidence conservative, but restore valid legacy rendering/migration with a durable stable identity through the owner coordinator; do not confuse deletion trust with display hydration. Error-handling confidence 93 found quota causes are wrapped in a generic translated message then discarded by the notification normalizer. Preserve safe actionable cause context at the owner-save notification without broad error-normalizer changes. Fix both with regression tests. The same lens claim that prepared-but-unsaved attachments are permanently orphaned is too broad: conservative same-session ownership is deliberate and trusted next-start cleanup is the recovery contract; the complete failed-first-add/restart proof is already in this run's fix set.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"57e9d64cb89dd0c9f774116a5ba8976e4b8ffd8856f5c85288ac592b7ca0a545","input_sha256":"b2f07a54407bdd7376ab9fb381cee3d66c7213034783d1a7e5ce584ca23edb4d","kind":"mutation-receipt","operation":"e87722c55d486bf09c3307276ae8f73e997d41e3f77337aa2ace3c0f22500193","options":{"section":null},"request_id_sha256":null,"results":["f-20260901-13"],"target":"f-20260901-13","v":1} -->

Final gate preview found that the new engineAttachments.ts and opponentSettings.ts utilities sit outside the closed frontend coverage area mappings. The complete Vitest coverage run passed, but coverage:frontend:check correctly refused the unmapped production surface. Fix in this run: place the engine-only draft controller beside its engine consumers, and the persisted opponent schema beside the owner coordinator in state; preserve behavior and update imports/tests. Do not change measurement includes/excludes, coverage floors, numeric baselines or the gate. Re-run exact coverage and related tests after the move. This is an integration defect of this task, not a reason to skip or reset coverage.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"e332deccdc5ee1788788c8d539b9ba369d14ab402cb35e1ab9e9203e52227325","input_sha256":"1af3e39628c9359205e3671147315c016f08f305d08685f37d3f4330e7e5484f","kind":"mutation-receipt","operation":"90eb9f7d0d1b80fb14db4502fde767bbe3b8b12d64a7bfe66ecaf2b05473649b","options":{"section":null},"request_id_sha256":null,"results":["f-20260901-13"],"target":"f-20260901-13","v":1} -->

Final real-app acceptance exposed a harness lifecycle defect in the new two-session fixture: closing and proving the seed application/WebKit processes exited did not delete its WebDriver session, so opening the asserted session failed with Maximum number of active sessions. Fix now under the original ownership acceptance: release the seed WebDriver session only after process-exit proof, then open the second session. This preserves the real product shutdown assertion rather than replacing it with driver cleanup. First failed log: root-real-app-final.log. Exact real-app rerun is required before closure.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"38bee929ac51a0417374cd6e7634387eac8692588c0605c651b5385ecb270370","input_sha256":"a52597a84f38e6831a5147314dbc9c01d20cdda1a6c9d3bc43ada73a93b0eb5b","kind":"mutation-receipt","operation":"6303c0a3146be7a474ab3f00fa46b299f7460bf434066474f07c0033c0855028","options":{"section":null},"request_id_sha256":null,"results":["f-20260901-13"],"target":"f-20260901-13","v":1} -->

Handled 2026-09-06 by 739db8db plus 5e8912e7/c0016006/806005f1/086deaf1. Engine list and both player snapshots share compressed legacy-compatible ownership persistence: durable prepare, correlated renderer save, then reconciliation. Strict original hydration trust protects malformed/lossy data; identity-only legacy migration preserves records and raw-write conflicts. Shared draft ownership releases replaced/stale/cancelled attachments, retains failed saves, and never resurrects deleted engines. Retired attachments resolve for the session; only identity-verified managed image copies are removed, never source resources. Native issuance leases cover actual blocking copy/registration/error cleanup through shutdown sealing and draining. Root focused/related frontend proof, 154 then 159 native authority tests, image/shutdown/offload tests, full 764-test coverage and nine container screenshots passed. Actual pnpm verify:app passed automatic orphan-image cleanup, exact durable prepare/storage/reconcile, live retired-image survival, titlebar shutdown deletion of retired bytes/intents and survival of retained owners; application and recorded WebKit children exited. Root found and corrected two fixture-harness defects during this acceptance: omitted seed WebDriver release and wrong imageRead operation spelling. Decisions d-20260906-10 through -14 govern ordering, schemas, narrow legacy migration and domain ownership. All final-lens Fix findings are resolved; full clean-tree push gates remain the release boundary.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"7357c8f1a31cc1b019eca9b931b738f2235ae5275968e78cb04b3e41ab38e72d","input_sha256":"a3568fbe9a551f76cba354ebdac431482e4d01a4b8732ca4cfe5d59a5525d03f","kind":"mutation-receipt","operation":"b9d2c759cdf87df2e263867a64eabbd95748d92aa13fab2f698c6f61af526936","options":{"section":null},"request_id_sha256":null,"results":["f-20260901-13"],"target":"f-20260901-13","v":1} -->

### get_engine_config spawns an EngineActor outside EngineSupervisor

* **ID:** f-20260901-14 · **Status:** handled · **Area:** engine-uci · **Root:** - · **Entry:** build · **Blocked:** none

* **Where:** `src-tauri/src/chess.rs` `get_engine_config`.
* **Defect:** probing a newly picked or installed binary spawns an `EngineActor` that `EngineSupervisor` never sees. If the user closes the application while that probe is awaiting `uciok`, `shutdown_backend` cannot reap it; tao then `process::exit`, so `kill_on_drop`/`Drop` never run and the child can outlive the application.
* **Why it matters:** EngineForm now stores the adopted handle before this probe, so the probe is on the success path of picker and default-engine install rather than only after a later form submit.
* **Related:** f-20260830-51 (handled; app-exit termination). Root `-` because this is a missing supervisor registration, not the same unowned-spawn as the stderr drain. Named here rather than shared.
* **Found by:** `review-engine-protocol` over the f-20260901-02 push range, 2026-09-01. Confidence 98. Pre-existing enclosing flow from `97c29add`.

Handled 2026-09-01. `get_engine_config` and interactive/analysis `EngineProcess` spawn, `replace_handle`, then await `uciok`. Config probes use `("engine-config", uuid)`. Drop guard terminates a cancelled registration. Commit `77a232f4`. Rejected: register after `spawn_initialized`; key by binary path (`d-20260901-31`).

### Database and puzzle install cards still key progress by manifest array index

* **ID:** f-20260901-15 · **Status:** handled · **Area:** frontend-ui · **Root:** - · **Entry:** lens · **Blocked:** none

* **Where:** `src/components/databases/AddDatabase.tsx` (`db_${databaseId}`), `src/components/puzzles/AddPuzzle.tsx` (`puzzle_db_${databaseId}`).
* **Defect:** progress identity is the manifest array index. A refetch or reorder can attach another card's running or succeeded job, the same class the engine download cards just left.
* **Why it matters:** ProgressButton still treats `succeeded` as completed for these callers. A stale succeeded job disables the wrong card as Installed.
* **Related:** f-20260831-13 (handled; engine cards now use `downloadLink`). Root `-` so named here. Different file set from the engine install slice.
* **Found by:** numbered-1/2/4 review of the engine progress-id fix, 2026-09-01. Confidence 97.

* **Handled:** Database and puzzle install cards key ProgressButton and `downloadFile` by `db:${downloadLink}` / `puzzle_db:${downloadLink}`. React keys use that progress id. `initInstalled` stays title-based because native DatabaseInfo has no download URL (`d-20260903-02`). Proof: `db.test.ts`, `AddDatabase.test.tsx`, `AddPuzzle.test.tsx`.
* **Commits:** `35889711`
* **Rejected:** keeping the manifest array index; persisting downloadLink on install (Specta/schema, not required to stop stale progress attachment).
* **Lens:** `review-correctness` APPROVED
* **Governed-by:** d-20260903-02

---

## 2026-09-01 — filed through the inbox spool

### Two older checkers still walk the tree themselves

* **ID:** f-20260901-16 · **Status:** open · **Area:** gate-scripts · **Root:** - · **Entry:** inline · **Blocked:** none
* **Where:** `scripts/check-untranslated-jsx.mjs:69`, `scripts/check-workflow-permissions.mjs:288`.
* **Defect:** both still recurse with `readdir({ withFileTypes: true })` after f-20260830-54 routed skill-bridge, tool-parity, and gate-routing onto `listWorkingTreeFiles`. Skip, symlink, and untracked handling can drift again on these two checkers.
* **Why it matters:** an ignored or untracked file that the shared walker would fail closed on is invisible to i18n JSX scanning and workflow-permission checks.
* **Related:** f-20260830-54 (handled). Root `-`, so named here rather than shared.
* **Fix shape:** enumerate through `listWorkingTreeFiles` with the pathspec each checker already walks (`src` and `.github/workflows`).
* **Found by:** numbered-3 adjacent lens over the f-20260830-46/54/55 push range, 2026-09-01. Confidence 94.

---

## 2026-09-01 — filed through the inbox spool

### ChessRiddle's product-impact park gate has not been adopted
* **ID:** f-20260901-17 · **Status:** handled · **Area:** gate-scripts · **Root:** - · **Entry:** inline · **Blocked:** none

* **Where:** `scripts/findings.py` (`PRODUCT_IMPACT_RE`, `_park_brief_issues`, `cmd_decisions` listing), `scripts/findings-parity-tests.py` (`product-decision-gate-and-listing`).
* **Defect:** After f-20260901-11 re-pinned to ChessRiddle `6f83b80d8`, this copy still lacks the shared `_BULLET` grammar, the `**Product impact:**` park gate, the product/Sentry listing split, and printing the precondition slug. Declared `port_pending` rather than adopted in that run because the impact gate would redden three existing parks (`f-20260829-02`, `f-20260829-04`, `f-20260830-06`) that have no such bullet.
* **Fix:** Adopt those hunks, give each of the three parks a real product-impact sentence or unpark it as technical, then delete the `product-decision-gate-and-listing` declaration and re-measure the parity constants.

* **Resolution 2026-09-02:** closed by phase 1b of the agent-setup overhaul. `scripts/findings.py` is now the vendored copy of `~/Projekte/agent-kit/scripts/findings.py` (written by `kit sync`, verified by `kit sync --check`), which carries the `_BULLET` grammar, the `**Product impact:**` park gate and the product/Sentry listing split; the three parks were triaged (`f-20260829-02` and `f-20260829-04` un-parked as technical — `d-20260902-01`, `d-20260902-02`; `f-20260830-06` gained its Product-impact sentence); `scripts/findings-parity-tests.py` and its `port_pending` declarations are deleted with the parity mesh.

---

## 2026-09-01 — filed through the inbox spool

### UCI resource option values put native paths into renderer logs

* **ID:** f-20260901-18 · **Status:** open · **Area:** engine-uci · **Root:** - · **Entry:** lens · **Blocked:** none
* **Where:** `src-tauri/src/engine/process.rs` log capture of `setoption` lines; `get_engine_logs` / `get_game_engine_logs`.
* **Defect:** A renderer-supplied `EngineOption::Resource` is resolved to a backend-only path and then written as a raw UCI `setoption ... value <path>` line. On Windows that is the full native resource path. `get_engine_logs` returns it to the renderer.
* **Why it matters:** `.claude/rules/async-resource-invariants.md` forbids moving raw backend diagnostics into the renderer. Native paths are the same class as capability contents.
* **Related:** f-20260901-10 (handled). That finding changed logs() to return errors; it did not introduce this leak. Pre-existing enclosing log capture. Root `-`.
* **Found by:** `review-tauri-security` over the f-20260901-06 cumulative diff, 2026-09-01. Confidence 98. Pre-existing.
* **Lens:** `review-tauri-security`

---

## 2026-09-01 — filed through the inbox spool

### 22 frontend test files charge a component-graph import to the 5000 ms test timeout

* **ID:** f-20260901-19 · **Status:** handled · **Area:** frontend-ui · **Root:** - · **Entry:** inline · **Blocked:** none

`src/components/boards/BoardGame.test.tsx` reddened master CI three times on 2026-09-01 (runs
33517593225, 33522388348, 33522556421) with `Test timed out in 5000ms`, because
`await import("./BoardGame")` sat inside the test body and charged the transform and evaluation of
a 1127-line component graph to a single test's budget. That instance was fixed by extracting the
two pure helpers under test (`d-20260901-36`).

The pattern remains in 22 other files. Each performs a dynamic `await import(...)` inside a test
body or an async `beforeEach`, so the imported module's cost lands inside a timed region:
`testTimeout` (5000 ms) for a test body, `hookTimeout` (10000 ms) for a hook. Neither is configured
anywhere — `vite.config.ts` sets only environment, include, exclude, workers and coverage, and no
per-test timeout argument exists in the repository.

Most of the 22 import a React component and so carry a real graph; three do not and are listed here
only for completeness of the pattern, not because they are slow: `src/utils/session.test.ts` and
`src/utils/lichess/authentication.test.ts` import utility modules, and `src/components/About.test.tsx`
imports `@/translation/en-US.json` (that file already imports `AboutModal` statically).

None of these files needs the dynamic form. `vi.mock` is hoisted above imports, so a static
top-level import behaves identically. The five files that genuinely require a dynamic import — they
call `vi.resetModules()` and re-evaluate module-init state — are `src/index.test.tsx`,
`src/i18n.test.ts`, `src/components/home/Accounts.test.tsx`, `src/state/workspace.test.ts` and
`src/state/store/tabStorage.test.ts`, plus `PromotionModal.test.tsx` (import inside a hoisted
`vi.mock` factory) and `src/chessground/Chessground.test.tsx` (non-hoisted `window.matchMedia` setup
must run first). Those seven stay as they are.

The remaining files, all category "stylistic": `src/utils/session.test.ts`,
`src/utils/lichess/authentication.test.ts`, `EvalListener.test.tsx`, `ProgressButton.test.tsx`,
`AccountCards.test.tsx`, `PersonalCardPanels/selectors.test.tsx`, `SideInput.test.tsx`,
`FilesPage.test.tsx`, `DirectoryTree.test.tsx`, `ConfirmChangesModal.test.tsx`,
`NewTabHome.test.tsx` (13 sites), `EnginesPage.test.tsx`, `AddEngine.test.tsx`,
`EngineForm.test.tsx` (6 sites), `ReportModal.test.tsx`, `EngineSettingsForm.test.tsx`,
`EngineSelection.test.tsx`, `AnalysisRow.test.tsx`, `LogsPanel.test.tsx`, `FileInfo.test.tsx`,
`AddPuzzle.test.tsx`, `About.test.tsx`.

**Not urgent, and the measurement says so.** In CI run 33517964230, BoardGame was 4802 ms and the
next-slowest whole file was 1100 ms (`AnalysisRow.test.tsx`), then 1068 ms
(`ConfirmChangesModal.test.tsx`), 886 ms (`EnginesPage.test.tsx`), 770 ms (`FilesPage.test.tsx`).
So there is roughly 4x headroom. The fix is mechanical — replace the in-test `await import(...)`
with a static top-level import, keeping the existing `vi.mock` block — and moves the cost into
vitest's untimed collection phase (`@vitest/runner` `index.js:1781-1834`; `testTimeout` is applied
only at `:1137-1143`). Doing it once removes the whole class rather than waiting for the next file
to cross 5000 ms on a slow runner.

* **Handled:** The 22 listed files now statically import the unit under test. `vi.mock` stays hoisted. The seven files that call `vi.resetModules` or need pre-import window setup were left dynamic. FileInfo's mock state moved into `vi.hoisted` so the static import does not hit TDZ.
* **Commits:** `a44396c9` (AddPuzzle.test.tsx also in `35889711`)
* **Rejected:** raising `testTimeout` (`d-20260901-36`).
* **Governed-by:** d-20260901-36

---

## 2026-09-01 — filed through the inbox spool

### The frontend coverage baselines have drifted far enough to stop constraining most areas

* **ID:** f-20260901-20 · **Status:** open · **Area:** gate-scripts · **Root:** - · **Entry:** lens · **Blocked:** none

`coverage-baselines.json` records what the frontend measured when it was last written; the ratchet
in `scripts/coverage-report.mjs` then rejects any lower covered count or ratio. Tests added since
have raised the real measurement well above the recorded numbers, so in most areas the ratchet now
permits a large silent regression before it fires.

Measured on atlas 2026-09-01 with a full `pnpm test:coverage`, covered lines, current versus
recorded baseline:

| Area | Current | Baseline | Slack |
| --- | ---: | ---: | ---: |
| puzzles-engines | 382 | 60 | 322 |
| boards-game-analysis | 484 | 249 | 235 |
| accounts-remote | 326 | 185 | 141 |
| tabs-routing | 281 | 148 | 133 |
| shared-shell-ui | 124 | 36 | 88 |
| databases-files | 268 | 211 | 57 |
| state-persistence | 743 | 689 | 54 |
| tauri-ipc-platform | 210 | 156 | 54 |
| application-bootstrap | 72 | 39 | 33 |
| settings | 73 | 73 | 0 |

`puzzles-engines` would have to lose 84 % of its covered lines before the gate noticed. Only
`settings` is actually tight.

**Why this is worth a deliberate decision rather than a reflexive re-record.** The `docs/coverage.md`
rule — never rewrite a baseline to clear a red gate — is about *regressions*. Re-recording upward
after coverage has genuinely improved is the opposite operation and is what keeps the ratchet
meaningful. But it must be done from the reference environment, not from a developer machine: the
frontend baseline was last re-recorded from CI under `d-20260829-02` precisely because atlas and the
runner disagreed. `.claude/settings.json` denies the `coverage:baseline:*` command forms, so this
needs an explicit, reasoned exception, and the numbers must come from a CI run rather than from
here.

**Second-order cost, already paid once.** Two independent reviewers blocked the extraction in
`d-20260901-36` by projecting a red ratchet from the baseline file, on the assumption that the
recorded numbers describe the current tree. They do not, and the change passed with 474 covered
lines against a 249 baseline. A baseline that is 235 lines stale is not just a weak gate; it
actively misleads anyone reasoning about coverage impact without running the suite.

---

## 2026-09-01 — filed through the inbox spool

### Game-start failures are shown to the user as raw untranslated error messages

* **ID:** f-20260901-21 · **Status:** open · **Area:** i18n · **Root:** - · **Entry:** lens · **Blocked:** none

`BoardGame.tsx`'s `startGame` catch does `setCommandError(err instanceof Error ? err.message : "Unable
to start the game.")`, and that string is rendered verbatim in a `role="alert"` block further down the
same component. Every message reaching that alert is therefore English-only and never passes through
i18next, in a UI that ships 16 locales.

Two distinct sources feed it:

* Any backend error from the game-start command, whose message is a Rust `#[error]` string. This has
  always reached the alert.
* The renderer's own guard, `A local engine must be selected for an engine player`, thrown by
  `toPlayerConfig` (moved to `src/components/boards/playerConfig.ts` under `d-20260901-36`). Until
  the control-flow repair in that same change this throw escaped `run()` entirely — it was raised
  while the `GameConfig` was being built, above the `try` — so it reached no alert at all and instead
  left `pendingCommand` stuck at `"start"`. Now that the `try` covers the config construction, the
  message does reach the alert, untranslated.

`pnpm i18n:jsx` does not catch either: `scripts/check-untranslated-jsx.mjs` scans `*.tsx` only, and
even there it recognises `ask` and `message` sinks rather than a `Text` child bound to state. So the
checker's silence is not evidence.

The fix is a small design question, which is why this is `lens` and not `inline`: the honest options
are a typed error carrying a translation key that the caller resolves, or a caller-side mapping from
error identity to a key, with a translated fallback for anything unrecognised. Whichever is chosen
has to cover the backend messages too, or it fixes one string and leaves the surface as it was.
Run `review-error-handling` over the diff — the risk is losing the underlying cause while making the
message presentable.

---

## 2026-09-01 — filed through the inbox spool

### BoardGame's native game session has no terminal state, so completed games poison abort and close

* **ID:** f-20260901-22 · **Status:** handled · **Area:** frontend-state · **Root:** boardgame-session-lifecycle · **Entry:** build · **Blocked:** none

Found by the `$push` review of `d-20260901-36` (a Codex lens over the enclosing code, confidence 99
on each item). None was introduced by that change; all are pre-existing in `src/components/boards/BoardGame.tsx`
and `gameSession.ts`. They are filed rather than fixed inline because they share one root — the
renderer keeps a session id after the backend has finished with it, and there is no represented
"terminal" state — and choosing that representation is a design question, not an implementation
detail (universal rule 4b's design-question exception).

1. **A finished session is still stored and still aborted.** After completion, resignation or abort,
   `gameIdRef`/`backendSessionRef` keep their values, so New Game and unmount call `tauri.abortGame`
   on a session the backend has already removed. The rejection is discarded, producing routine
   unhandled `GameNotFound` errors; when the abort was meant to tear down a *replaced* session, a
   failure there can leave the old session alive.
2. **`abortExactTabGame` assumes non-null means abortable** (`gameSession.ts:77-87`). `BoardsPage`
   propagates the backend rejection before `closeWorkspaceTab`, so a tab holding a completed game
   cannot be closed. Its test covers the success and the missing-session cases only, never the
   finished-session case.
3. **`startGame` ignores a terminal `state.status`.** An initial position that is already checkmate
   or stalemate can emit `GameOver` before `startGame`'s response is processed, while the listeners
   still reject it as setup. The following poll sees the same revision and rejects it too, leaving
   the UI in `playing` forever.
4. **One revision cursor serves two payload shapes.** Full `GameMove` snapshots and partial
   `ClockUpdate` payloads share `latestRevisionRef`, so a clock update delivered first advances the
   cursor and the lower-revision move is discarded — a lost move in human-vs-human play. The tests
   exercise scalar ordering only, never two payload shapes against one cursor.

`.claude/rules/async-resource-invariants.md` is the governing rule: every async operation needs an
identity, a stale-result guard, **a terminal state**, an error path and a cleanup. Items 1-3 are all
the missing terminal state; item 4 is a stale-result guard that discriminates on the wrong thing.
Run `review-engine-protocol` and `review-persisted-state` over whatever repair is planned.

* **Pickup evidence (2026-09-08):** The real WebKitGTK/native probe exposed an additional prerequisite of this repair: native start_game serializes session and revision as JavaScript numbers, despite generated declarations naming bigint. The current nextAcceptedGameRevision rejects those values. Sending BigInt(session) to get_game_state fails with `TypeError: JSON.stringify cannot serialize BigInt.` The probe calls the actual start_game/get_game_state/abort_game commands, not reconstructed serializer inputs. Retained proof: `/tmp/build-0b810ced-boardgame/counter-probe.mjs`, output `/tmp/build-0b810ced-boardgame/counter-only.DieF22/log`, exit 0. Binary built at 2026-09-08 10:12; renderer source matches current HEAD f696978b for BoardGame.tsx/gameSession.ts. Include bounded game-counter normalization in the session repair and verify again on the rebuilt artifact. Do not widen this into unrelated IPC schemas.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"6a91a3ca2e68c98d8a4e6010cb5c06bd99e134e1bc009cc4e04ff2edb2c646af","input_sha256":"15e8e4382ff537b798da0a3ad264a679df306b856049e4c9ac212776e0e81404","kind":"mutation-receipt","operation":"810b7ad43a0676fc54b9373ea28955bda96ff25e90fce7863572194a5b70ac23","options":{"section":null},"request_id_sha256":null,"results":["f-20260901-22"],"target":"f-20260901-22","v":1} -->

Root phase inspection found repair work before commit: (1) the log-fetch effect starts a request before the following colour/open effect increments its sequence, so initial-open and colour-change automatic responses are discarded; (2) move recovery starts an unawaited query but the outer finally immediately releases the same guard required by the query handlers, making current recovery success/error handlers inert; (3) clearOwnershipIfMatches compares only component refs, so a late old-instance cleanup can clear a newer native pair stored by a remounted instance; cleanup completion must compare actual captured atoms and set gameOver only for the matching retired pair; (4) successful unmount cleanup currently clears identity without leaving gameOver; (5) applyAuthoritativeState dropped validation of response.session; (6) start sets pendingCommand=start then invalidateUiSession immediately clears it before the native start resolves. These remain within f-20260901-22/f-20260901-23 and will be repaired and regression-tested before acceptance. Plan authorship and arbitration share root context; detection uses the same model family as code.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"504dfa8c2540fe7c1fdeca5f017b0d4916bb622bfcfbf7efcc62a48603d7a189","input_sha256":"b6dd23a88484e4ff8041f1906b7408a4c0042887e26aac6de04b60308c41adff","kind":"mutation-receipt","operation":"1fcff914d93b9438a6706b1da1cf885a8458cbe3618d6d692de35755dc98398a","options":{"section":null},"request_id_sha256":null,"results":["f-20260901-22"],"target":"f-20260901-22","v":1} -->

Further root inspection: start applies terminal result and then setHeaders spreads stale render-time headers, overwriting that result; initialize also calls setFen and then synchronizes against the pre-reset render-time root, which can skip restoring initial moves. Synchronization must use the live tree store snapshot. Current BoardGame tests mock tree setters without state mutation and only assert setResult was called, so they miss actual final headers/moves. The repair will add stateful tree assertions and genuine current recovery/log success tests. Four identical counter normalization bodies should share one implementation under the existing extraction rule; unchanged generated game-command signatures should not be manually redeclared. Subscription registration errors are also silently dropped by reportGameEventError when event is absent, contrary to the frozen mounted-registration error path. These are in-scope repairs before acceptance, not deferred work. Plan authorship and arbitration share root context; detection uses the same model family as code.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"5a722db94ed8a71e53b3d5aecc36adec62246897df52c02a34d9bc038245e4bb","input_sha256":"7e7e4813ff545a61a6dee4c1f734fdde51de88c257ed2beaeb9db579669b7231","kind":"mutation-receipt","operation":"88fabd2302301ae9d4a5ee20c380e8628c87eb2daad46b315938f48c31e64386","options":{"section":null},"request_id_sha256":null,"results":["f-20260901-22"],"target":"f-20260901-22","v":1} -->

Cumulative persisted-state review of 065c8936 found a remaining admission hole: close clears closingTabsAtom after synchronously removing workspace metadata, while a suspended React transition can retain the old setup panel. BoardGame.startGame only checks closing intent and its pending-start atom, so a retained handler can admit a native game through disposed owner atoms. Root confirmed the close ordering and missing workspace membership check. Fix within f-20260901-22: admission must require that the captured owner tab still exists, including after any awaited prior cleanup, with an actual retained-handler regression.

The same lens repeated the durable-close quota defect already tracked by f-20260906-22 and its creation counterpart f-20260901-05. Defer to that existing shared workspace transaction design; no duplicate and no change to the recorded separate-design disposition. Plan authorship and arbitration share root context; detection uses the same model family as code.
<!-- ledger-meta {"command":"annotate","effect_lines":3,"effect_sha256":"d666d7fee894a5b6de6e0caadfb1ae3a618894172bfca89c3147ec14b8f026f1","input_sha256":"83066b3c05bddfb29dce1b4bed655167244e2b91b6429ded72e0596e7014c6bb","kind":"mutation-receipt","operation":"e75228940914b3106faf6a1d00543b1abacd4fc7d60603b474b277418b16ad63","options":{"section":null},"request_id_sha256":null,"results":["f-20260901-22"],"target":"f-20260901-22","v":1} -->

Root inspection of the cumulative BoardGame repair found the retained-panel ownership gap also applies to replies/events/queued updates: ownsSession checks mounted/generation/render-time refs only, while event callbacks separately compare render-time gameState/gameId/session. After close removes workspace metadata and clears captured owner atoms, React may still retain the old panel. Such continuations can write the removed tree or notify. The Start membership guard alone is insufficient. Prove the interval with controlled replies/events while the owner tab is removed before unmount; use the same actual primitive-atom pair plus workspace membership predicate for UI admission/application, retaining independent unconditional exact native teardown. Root arbitration and plan authorship share context; detection uses the same model family as code.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"f100dc9d0ec603512bcfbd73ff6e2b062b5fbdc1d41aa4b2142b2f653c57e186","input_sha256":"9acec12da4930e43b5acbb285bff2232c9de3f7387cd69def6d8a54e28557312","kind":"mutation-receipt","operation":"04e8b7f00b42d52529ec57992b6b844f961da4a2d99d0f24caf3623cbdd7f1e4","options":{"section":null},"request_id_sha256":null,"results":["f-20260901-22"],"target":"f-20260901-22","v":1} -->

The same retained-panel inspection also found the five owner atom-family lookups at the top of BoardGame execute on every render. After disposeTabAtoms removes family registry entries, a still-mounted retained panel rerender can recreate those entries even if new command admission is blocked. Preserve the actual primitive atom references for the lifetime of the immutable ownerTabId (memoize the owner-atom bundle), and test a retained rerender after family disposal without registry recreation. This implements the already-frozen no-recreation ownership invariant, not a new state representation. Plan authorship and arbitration share root context; detection uses the same model family as code.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"54769f5e45f733975dd0eebb660528845968ca1070a79d57c3a560263e13f581","input_sha256":"0b88ddff1d167d7956d39e1f5d86c2b5bd40d7cf825d363627a8a0bd4bfa7aca","kind":"mutation-receipt","operation":"fb6527ceffe0d9fffba8f1a2d92377063259251bc674d41d990635730d961b3f","options":{"section":null},"request_id_sha256":null,"results":["f-20260901-22"],"target":"f-20260901-22","v":1} -->

Handled by source commits 065c8936 and d80a4446. Terminal ownership, terminal starts, separate move/clock revision ordering, exact teardown, owner-bound pending admission, guarded commands/recovery/logs/events/queues, retained-panel rejection, and stable primitive atoms are implemented and covered by behavioral regressions. Root independently inspected the complete source/test diffs and passed 127 focused frontend tests across eight files, 44 native game tests, typechecking, formatting and lint. Red-first evidence includes original terminal startup, stale result/log races, retained owner removal/replacement and atom registry recreation.

Real-product proof on the rebuilt release binary: pnpm verify:app passed actual Tauri IPC/startup/shutdown checks; game-flow.mjs drove human Start, Resign, New Game, replacement Start/Resign and terminal tab close without unhandled rejection. Root inspected app/playing/terminal/replacement/closed screenshots under /tmp/build-0b810ced-boardgame/ui-proof. pnpm test:e2e:container passed all 9 tests without snapshot changes. No native GTK chrome change needs manual verification.

Cumulative review: all nine named lenses completed; 12 adopted lens findings and two additional root ownership gaps were fixed. Final test-only conditional assertions were made unconditional during root takeover. Existing durable workspace transaction findings f-20260901-05/f-20260906-22 remain separate; two native emit-error reports were grouped and filed as f-PENDING in tasks/findings-inbox/20260908-172134-1144915-1788880894198392509-2.md for a separate native delivery/recovery design. Full-start native exhaustion integration was not claimed: the allocator boundary test and inspected pre-side-effect call order are the evidence. Complete arbitration is /tmp/build-0b810ced-boardgame/code-triage.md.

Decisions d-20260908-06 through 09 remain the documented contracts and carry their reversal paths. Plan authorship and arbitration shared root context; detection used the same model family as code. Full affected final gates and ordinary push follow these pre-gate records.
<!-- ledger-meta {"command":"annotate","effect_lines":7,"effect_sha256":"764fb63ed5c2c261eae67eb1a6c2313a4d6fcecfead10023175a4720365e2bcb","input_sha256":"cdff7df250e6ccc91084b584b47c1e21fdbe85ebcfac6600952fb9c5373cd798","kind":"mutation-receipt","operation":"91ca82526907dc3afac3ca08ab1bb6be28b60393935099e53489da6a4f4541d3","options":{"section":null},"request_id_sha256":null,"results":["f-20260901-22"],"target":"f-20260901-22","v":1} -->

Final contract gate detected a direct generated-binding type import in gameTransport.ts. Root traced the checker and the existing bindings/index.ts type-only barrel, then changed the single import to @/bindings. No boundary allowlist, generated file, runtime value import or behavior changed. Direct pnpm tauri:boundary:check passed; both transport/facade test files passed 17 tests; TypeScript and formatting passed. Previous real-app/pixel proof remains applicable because the repair only changes an erased type import to the existing identical re-exported types. All final gates rerun on the newly committed clean tree. Plan authorship and arbitration shared root context; detection used the same model family as code.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"4ef924999dc2033ac15ec743e7a14fbdd3290ca0e218f8c132cbbf6401298b88","input_sha256":"a4023b3908fde0c397bab9174d92873e13f51bd6eca1b6e867a08bb491bdf869","kind":"mutation-receipt","operation":"22f560e969a77c9bfb9f1342decb1bc51b4f39e1a8e86863cf5987c869000aaa","options":{"section":null},"request_id_sha256":null,"results":["f-20260901-22"],"target":"f-20260901-22","v":1} -->

The unmapped-module coverage failure is repaired under d-20260908-10: the full former gameTransport.ts helper block is preserved verbatim inside the existing measured tauri.ts facade, and the extra production module is removed. Root verified the exact block comparison and complete diff. Focused helper tests import the same exported functions from the facade; BoardGame imports the same decoder/input type there, and its existing native mock retains the actual decoder. No conversion behavior, coverage config, baseline, floor or generated binding changed.

The workspace-write leaf could not spawn Git inside CLI checks (EPERM); root reran all proof without altering its sandbox. Root proof directory /tmp/build-0b810ced-boardgame/root-coverage-repair-proof: 127 focused frontend tests, 44 native game tests, TypeScript, boundary check, full frontend coverage run (881 tests), and coverage ratchet/area floors all passed. Updated real-app verification and clean-tree final gates follow the commit. Plan authorship and arbitration shared root context; detection used the same model family as code.
<!-- ledger-meta {"command":"annotate","effect_lines":3,"effect_sha256":"aae52a777bed23b30692ba28751af575eee8e831ccfbcc94c7f71ff29d49e205","input_sha256":"b5a48a9d739309a0d6a82197f70c90b2df6eb8d8888957e6587b21b773edfc10","kind":"mutation-receipt","operation":"b7a126700f694b7f99cf175b5cffd1b444cb4c9af748d923078de0dcf1db3e77","options":{"section":null},"request_id_sha256":null,"results":["f-20260901-22"],"target":"f-20260901-22","v":1} -->

Real-product and pixel verification repeated on b74206bd after the facade relocation: release build, pnpm test:e2e:container (9 passed), pnpm verify:app (all actual startup/IPC/shutdown assertions passed), and the complete human game start/resign/reset/replacement/terminal-close flow all exited 0. No unhandled rejection or snapshot update. Root inspected all five screenshots under /tmp/build-0b810ced-boardgame/ui-proof-r2; the startup image is 800x648 and matches the prior startup artifact. The normalized game transport now lives in src/platform/tauri.ts; focused gameTransport.test.ts remains. Both findings remain handled. All known records now precede the fresh clean-tree final gate run. Plan authorship and arbitration shared root context; detection used the same model family as code.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"09f7d77e0bfb60c920b3e8ead8d7f724051613ba6009da9500ef56cc09b5c708","input_sha256":"0c9a75197123a8bb4506a5c6699b78d09181fa9c5431d4b1c9562dcf75edb93c","kind":"mutation-receipt","operation":"0a9a70343c1cf5c7b51829ed60a29d6f564721200ae29568812704ee72294438","options":{"section":null},"request_id_sha256":null,"results":["f-20260901-22"],"target":"f-20260901-22","v":1} -->

---

## 2026-09-01 — filed through the inbox spool

### Late command results in BoardGame overwrite newer state, and two async paths have no rejection handler

* **ID:** f-20260901-23 · **Status:** handled · **Area:** frontend-state · **Root:** boardgame-session-lifecycle · **Entry:** lens · **Blocked:** none

Also from the `$push` review of `d-20260901-36`, same lens, all pre-existing in
`src/components/boards/BoardGame.tsx`. Separated from `f-20260901-22` because these are guard bugs
with an obvious shape rather than a missing state representation — the repair is mechanical once
someone decides to make it.

1. **`catch`/`finally` blocks do not check the session generation, while the success paths do.** The
   abort, resign, takeback and move handlers all verify `sessionGenerationRef.current === generation`
   before applying a result, but their `catch` and `finally` blocks do not. A late failure from a
   superseded command therefore overwrites the current `commandError` and clears a *newer* command's
   `pendingCommand`. (confidence 97)
2. **Two fire-and-forget `tauri.getGameState` queries have no rejection handler.** Session
   invalidation makes those rejections routine rather than exceptional, so they surface as unhandled
   promise rejections. (confidence 99)
3. **The engine-log fetch is guarded by session, generation and game id, but not by the requested
   colour.** Switching the engine-log colour while two requests overlap lets a late `white` response
   overwrite the selected `black` logs. A stale failure also still notifies after a handoff.
   (confidence 99)

Item 3 sits at the call site the `d-20260901-36` change touched: it now reads
`runUnlessCancelled(t("Common.Error"), () => tauri.getGameEngineLogs(gameId, expectedSession, color))`
followed by a three-way guard that omits `color`. The guard, not the fetch, is what needs the extra
discriminator — `.claude/rules/async-resource-invariants.md` requires an identity per async
operation, and colour is part of this one's identity.

Root repair inspection found one remaining stale-header write: toggleOrientation still spreads render-time headers, and handleHumanMove calls it after authoritative terminal application when automatic flipping is enabled. It can overwrite the newly stored result. Use the live store headers for orientation updates and prove a terminal human move preserves its result while flipping. Also require an adversarial test where old log success/failure settles after the colour/close handler is invoked but before the subsequent passive effect: sequence/open refs currently change only on render/effect, leaving that interval unguarded. Confirm with failing tests before repair. These are within the same lifecycle and stale-result findings. Plan authorship and arbitration share root context; detection uses the same model family as code.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"586368d5053ea16f74c6d72de06f44c5ddcd6437d12c87c09fcde59c6b4d39c9","input_sha256":"c310cd243729169628799919b60b03e4bd36f757d04e9a22285a9dffb2264902","kind":"mutation-receipt","operation":"e050b0f79b8212acfe276f11a8ffe72f98e7bd0c5c42a9c492eee0a219e434d8","options":{"section":null},"request_id_sha256":null,"results":["f-20260901-23"],"target":"f-20260901-23","v":1} -->

Cumulative review of 065c8936 adopted these additional repairs within the current lifecycle cluster: stale successful start teardown must leave the still-matching owner tab in gameOver; remove duplicate command identity ownership and route move/takeback/abort/resign through one shared command runner; remove three pass-through subscription callbacks; remove a duplicate terminal-start test and reuse the existing engine fixture; type transport normalizer inputs to admit measured numeric wire counters without lying casts; assert normalized replies for all five GameState commands; make teardown completion explicit at call sites and correct the outdated event-identity comment. The zero-delay premove callback is intentional next-task deferral, so document that intent rather than treating an idiomatic zero as a runtime blocker. Reports are under /tmp/build-0b810ced-boardgame/code-review. Plan authorship and arbitration share root context; detection uses the same model family as code.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"252f453aa631c3097eb8cfede281816d513c871a487c5c48460f3f57854cbf43","input_sha256":"96b31240c6aa54c6385bb9d83d949048b92a17a149dfb3e957c48fafff4436a1","kind":"mutation-receipt","operation":"12deb667bf72c08fe29fc4c9b7890c0911a44fba84812a2f1c5a8ace090cc781","options":{"section":null},"request_id_sha256":null,"results":["f-20260901-23"],"target":"f-20260901-23","v":1} -->

Cumulative review repairs completed and inspected in full. Twelve adopted lens findings are repaired, plus root inspection followups for retained-panel replies/events and stable primitive atom capture. Both followups had real red-first regressions. Root took over the final test-only lint cleanup after the two BoardGame repair resumes: seven conditional-expect warnings became unconditional outcome assertions, with no suppression or weakened assertion. Root independently reran the final combined eight-file suite (127 passed), TypeScript check (exit 0), all native game tests (44 passed), scoped formatting/lint (0 warnings), and diff check. Evidence: /tmp/build-0b810ced-boardgame/root-code-fix-final-proof and code-triage.md. Native event-delivery reliability was filed to the drain inbox; durable workspace close remains f-20260906-22/f-20260901-05; native full-start exhaustion integration was not claimed. Real-app verification and full final gates still follow. Plan authorship and arbitration shared root context; detection used the same model family as code.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"cfe355eb5aea9c46422ab6c7a7ade8a53c042727633ab8e8ad6724f7ea304937","input_sha256":"fd43ea491986abea285b02e173184627fa2f3cd9bbea7c146e00bc2a3016387b","kind":"mutation-receipt","operation":"ce8919ea674a930140daeb44086e5a8a6d00cdc269772b893d9a7ae9b90a5264","options":{"section":null},"request_id_sha256":null,"results":["f-20260901-23"],"target":"f-20260901-23","v":1} -->

Handled by source commits 065c8936 and d80a4446. Terminal ownership, terminal starts, separate move/clock revision ordering, exact teardown, owner-bound pending admission, guarded commands/recovery/logs/events/queues, retained-panel rejection, and stable primitive atoms are implemented and covered by behavioral regressions. Root independently inspected the complete source/test diffs and passed 127 focused frontend tests across eight files, 44 native game tests, typechecking, formatting and lint. Red-first evidence includes original terminal startup, stale result/log races, retained owner removal/replacement and atom registry recreation.

Real-product proof on the rebuilt release binary: pnpm verify:app passed actual Tauri IPC/startup/shutdown checks; game-flow.mjs drove human Start, Resign, New Game, replacement Start/Resign and terminal tab close without unhandled rejection. Root inspected app/playing/terminal/replacement/closed screenshots under /tmp/build-0b810ced-boardgame/ui-proof. pnpm test:e2e:container passed all 9 tests without snapshot changes. No native GTK chrome change needs manual verification.

Cumulative review: all nine named lenses completed; 12 adopted lens findings and two additional root ownership gaps were fixed. Final test-only conditional assertions were made unconditional during root takeover. Existing durable workspace transaction findings f-20260901-05/f-20260906-22 remain separate; two native emit-error reports were grouped and filed as f-PENDING in tasks/findings-inbox/20260908-172134-1144915-1788880894198392509-2.md for a separate native delivery/recovery design. Full-start native exhaustion integration was not claimed: the allocator boundary test and inspected pre-side-effect call order are the evidence. Complete arbitration is /tmp/build-0b810ced-boardgame/code-triage.md.

Decisions d-20260908-06 through 09 remain the documented contracts and carry their reversal paths. Plan authorship and arbitration shared root context; detection used the same model family as code. Full affected final gates and ordinary push follow these pre-gate records.
<!-- ledger-meta {"command":"annotate","effect_lines":7,"effect_sha256":"764fb63ed5c2c261eae67eb1a6c2313a4d6fcecfead10023175a4720365e2bcb","input_sha256":"cdff7df250e6ccc91084b584b47c1e21fdbe85ebcfac6600952fb9c5373cd798","kind":"mutation-receipt","operation":"92969ab4f2a1061f1bca6fe00c1bac1142c2f203dfd05a97da30e01d45429ab0","options":{"section":null},"request_id_sha256":null,"results":["f-20260901-23"],"target":"f-20260901-23","v":1} -->

---

## 2026-09-01 — filed through the inbox spool

### The EngineOption value normalisation is written out three times

* **ID:** f-20260901-24 · **Status:** open · **Area:** engine-uci · **Root:** - · **Entry:** inline · **Blocked:** none

The same mapping — pass a `resource` option through untouched, stringify the value of every other
option — appears in three places:

* `src/components/boards/playerConfig.ts` (`toPlayerConfig`, moved there by `d-20260901-36`), which
  additionally filters out `MultiPV` because a game engine plays one move;
* `src/components/panels/analysis/ReportModal.tsx` around line 98;
* `src/components/boards/EvalListener.tsx` around line 252.

Universal rule 11 puts the extraction at the second copy, and this is the third. The shape that fits
all three is one shared `EngineOption[]` normaliser with the game-specific `MultiPV` filter applied
by the caller afterwards, rather than folded into the shared unit.

Filed rather than fixed during `d-20260901-36` because two of the three sites are in
`src/components/panels/analysis/**` and `EvalListener.tsx`, which that change never read — universal
rule 4b routes a finding outside the loaded file set to its own run, so it gets its own cut instead
of an appended one. `review-engine-protocol` owns both of those paths and should run over the repair.

---

## 2026-09-02 — filed through the inbox spool

### The findings CLI's documented entry point has no version floor here either, only an accident of formatting

* **ID:** f-20260902-01 · **Status:** handled · **Area:** gate-scripts · **Root:** - · **Entry:** lens · **Blocked:** none

* **Where:** `scripts/findings.py` (the import block and the `except (OSError, UnicodeError)` /
  `except (OSError, UnicodeError, LedgerError)` handler sites), and
  `scripts/findings-parity-tests.py`, which pins the sibling at
  `SIBLING_REF = 6f83b80d8772a2196538f94dbc7ff40b582c6988`.
* **The defect.** `python3 scripts/findings.py …` is the documented route, and in any shell
  without a repo interpreter on `PATH` that is the system Python — 3.12 on this machine. This
  copy parses there today, but only because its `except` clauses happen to be parenthesized; no
  contract, test or gate states the floor. In Korrigio the same file was taken 3.14-only by
  `ruff format` at `target-version = "py314"`, which strips redundant parentheses into PEP 758
  form. The documented route then died with a bare `SyntaxError` naming syntax rather than a
  version, and that misdescribed failure produced **three false "the CLI is dead" findings in two
  days** (`f-20260830-26`, `f-20260831-10`, `f-20260831-13` there), costing five agent runs.
* **Why it is filed here and not only in the siblings.** The mechanism is copy-shaped: this repo
  carries its own copy of `scripts/findings.py` and the failure follows the copy. It happens to be
  furthest from the edge — this repo has no `pyproject.toml`, no ruff Python configuration and
  therefore no formatter that would strip the parentheses — so the risk here arrives by
  *adoption*, on the next reconciliation that pulls sibling hunks in, rather than on its own.
* **The fix, once the precondition clears:** adopt the sibling's block verbatim — `import shlex`,
  the `if sys.version_info < (3, 14):` guard as the FIRST statement after the imports (plain
  3.8-compatible syntax, so it stays reachable below the floor), and the named
  `_READ_ERRORS` / `_READ_ERRORS_LEDGER` tuples at their handler sites. Adopt it byte-for-byte:
  the parity gate compares this file against the pinned sibling blob, so any local adaptation
  buys nothing and keeps a declaration open permanently.
* **Blocked on `chessriddle-adopts-entrypoint-guard`, and that is a real dependency, not caution.**
  This repo's parity gate diffs against ChessRiddle. Adopting the guard **before** ChessRiddle
  does means writing a fresh `port_pending=True` declaration here plus a re-measurement of
  `EXPECTED_CHANGED_LINES` and the digest — growing the declared delta, which is the opposite of
  what the change is for. After ChessRiddle adopts it (filed there 2026-09-02 from the Korrigio
  drain, covering the version guard plus the `VACUOUS_IMPACT_RE` and validator ports in one run),
  the same hunks arrive here as a plain reconciliation with **no** new declaration. Clear the
  blocker when ChessRiddle's `scripts/findings.py` carries the guard at a commit this repo's
  `SIBLING_REF` can advance to.
* **Do not adopt the sibling's product-impact gate in the same step unless it is decided
  separately.** `scripts/findings-parity-tests.py` already declares
  `product-decision-gate-and-listing` as port-pending with a stated reason — the impact gate would
  redden three existing parks here that carry no `**Product impact:**` bullet. That is an
  independent decision and is not made by this entry.
* **Proof:** with a clean `PATH`, `python3 scripts/findings.py check` on a pre-3.14 interpreter
  exits non-zero with a message naming the floor and a paste-ready absolute command, and no
  `SyntaxError`; `pnpm findings:parity:check` passes with no new declaration; and the sibling
  ancestry probe reports the newly re-pinned `SIBLING_REF` as current.
* **Found by:** the Korrigio drain session 3c88f139-fa92-485d-ac12-53595ee060da on 2026-09-02,
  working Korrigio's `f-20260831-17`, whose title names this repo as the second port target. No
  entry for it existed in this ledger. This repo's working tree was not touched.

**Handled 2026-09-02.** The kit copy vendored at `faf40ca3` already carries `_enforce_python_floor` (header-driven; a no-op here because this ledger has no `**Python floor:**` line) and `_READ_ERRORS` / `_READ_ERRORS_LEDGER`. The ChessRiddle parity mesh the blocker `chessriddle-adopts-entrypoint-guard` named — `scripts/findings-parity-tests.py`, `SIBLING_REF`, `pnpm findings:parity:check` — no longer exists. Identity is `kit sync --check`. Closing as handled; a later En-Croissant `**Python floor:**` header line would be a different finding.

---

## 2026-09-03 — filed through the inbox spool

### Live analysis `onBestMoves` accepts in-flight lines after a same-position settings change

* **ID:** f-20260903-01 · **Status:** handled · **Area:** engine-uci · **Root:** result-not-bound-to-its-process · **Entry:** build · **Blocked:** none
* **Where:** `src/components/boards/EvalListener.tsx` around the `onBestMoves` callback (currently `:157`). `generation.current` is incremented only for the post-stop `getBestMoves` promise (`:234`); the live `best_moves` listener never consults it. `BestMovesPayload` has no request id, go mode, or options.
* **Defect:** the live listener accepts a payload when engine id, tab, FEN and move list match the current render. Changing MultiPV, Hash, Threads, or go on the same position updates `requestFingerprint` and the callback ref immediately, while `stopEngine` runs only after the 50ms throttle. In-flight `info` from the previous search still matches fen/moves/tab/engine and is written into `engineMovesFamily` under `${fen}:${moves.join(",")}`, which is also not cleared on settings change. Sequence: analyze the start position at MultiPV 3, then set MultiPV to 1 — the three old lines stay visible, and one more old info event can land, until the replacement search emits.
* **Why it matters:** `.claude/rules/engine-lifecycle.md` requires a `best_moves` payload to be used only when engine id, tab, FEN *and* the searched move list all match *and* the engine is still loaded. Settings are part of the search identity; the live path does not bind the result to the search that requested it. Sibling of `f-20260831-09`, which already names the missing process generation on this file's fingerprint and on `stop_engine` / `terminate_tab`. This is the same missing discriminator on the live event path for a *same-process* settings change, which that finding's "replace the binary" framing does not spell out.
* **Why it is `build`:** a local clear of `engineMovesFamily` on fingerprint change still cannot tell an old info line from a new one while both share fen/moves/tab/engine. Binding the event to the search that produced it is the generation-on-payload question already opened by `f-20260831-09`. Do not "fix" this with a frontend-only epoch that the payload cannot carry.
* **Found by:** the `review-engine-protocol` lens (confidence 88) during `$push` of `ee564004..HEAD` (import-hoist of `EvalListener.test.tsx` only). Pre-existing enclosing defect.

* **Cumulative path-ownership review (2026-09-06):** Luna engine-protocol lens re-confirmed live BestMoves event fingerprint lacks request/settings generation at EvalListener.tsx:153-166 (confidence 98; origins 3afed0317/ba42a3905). This repeats the existing same-position-settings evidence, not a new product decision. Defer to the existing result-not-bound-to-its-process event identity design; no frontend-only epoch can identify an event that carries no generation. Detection and code share the Codex family; plan authorship/arbitration share root context.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"b8a0b6336e4c21e378b71722cc0303b157b3dcd0c37ab8a09225e071f77a7d7b","input_sha256":"37cb5d2b0599faa87d079d07a73aa944eb0f2774b9ad6de8bf0a88845532460c","kind":"mutation-receipt","operation":"fbcb8f7f2f74ed119d9c59159bf1263d717656efeb0473fe17d7f00da27fc946","options":{"section":null},"request_id_sha256":null,"results":["f-20260903-01"],"target":"f-20260903-01","v":1} -->

* **Resolution (2026-09-08):** Implemented producer-bound interactive searches in `67941e1b`, with cumulative review repairs in `802bf7f0` and `6f57f34e`. Native preparation reserves a non-wrapping opaque generation before start; one-use bounded admissions cross spawn/publication safely, tab closure cancels pending ownership, and automatic stops target their captured generation. Info and terminal events carry producer identity. Renderer attempts bind executable/options/go/full FEN/moves, clear stale cache/progress, reject stale events/promises, and observe synchronous close intent, including failed-close retry and unmount.
* **Proof:** Root independent full proof: 768 Rust tests passed, 1 ignored; 799 frontend tests in 103 files passed; TypeScript, generated bindings, formatting and diff checks passed. All-target Clippy with warnings denied passed after narrowly scoped command/test fixes. Deterministic tests cover reservation misuse/replay/capacity, generation exhaustion, registration/publication/stop races, removal and failed close, event broadcast identity, and stale remote completions. Actual-command stop and actual production info/terminal emission tests anchor the IPC boundary. Negative controls for stale event/promise guards, stop forwarding, both emitted generations, and generation wrapping failed, then passed after restoration.
* **Review:** Ten fresh Sol/medium lenses: six approved and four requested revisions; all fifteen reported findings adopted, with raw error-cause exposure rejected under the existing redaction decision. Shared validation/cancellation/rejection helpers and typed shutdown failure propagation address the surrounding lifecycle findings. No unresolved Fix or deferred work. Plan authorship and arbitration shared the root context; detection ran on the same model family as the code in separate sessions. Decisions: `d-20260908-03`–`d-20260908-05`.
<!-- ledger-meta {"command":"annotate","effect_lines":3,"effect_sha256":"743a20624d94b46bdf2cbe63718087b2727ef8c0b76ff12641c2fa8620e0a697","input_sha256":"831efaa2cbbffe47258dee68070fb301c1201c33c5d89db124649d871e76601f","kind":"mutation-receipt","operation":"02d650ae1c80f3dd3b9158c5deb31deff6f2611c861ff17630b1a89278c968f3","options":{"section":null},"request_id_sha256":null,"results":["f-20260903-01"],"target":"f-20260903-01","v":1} -->

---

## 2026-09-03 — filed through the inbox spool

### Engine-image provenance is unforgeable outside `path_authority.rs` and still forgeable inside it

* **ID:** f-20260903-02 · **Status:** open · **Area:** native-fs · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/infra/path_authority.rs` — `mod verified` / `VerifiedFile`,
  `open_engine_image`, `engine_image_reader_for`, and `ResolvedPath` (fields at `:1041-1052`).
* **Defect:** `b345ea01` split `read_engine_image` so the authority guard is no longer held across
  the read, and made the descriptor a `VerifiedFile` whose only constructor takes the file out of a
  `ResolvedPath`. Outside `path_authority.rs` that is airtight: no caller can construct one, so a
  pathname reopen does not compile. **Inside that file it is not.** `ResolvedPath.file` is
  module-private, so code in `path_authority.rs` can do
  `resolved.file = Some(fs::File::open(stored_path)?)` and then call `from_resolved`, or read into a
  discarded `Vec`, `seek(SeekFrom::Start(0))`, and return the descriptor anyway. The `READ_TOKENS`
  scan on the opener and the wrapper narrows this but cannot close it — a token ban is a list, and
  eight successive versions of it were each defeated by a concrete port during plan review.
* **Why it matters:** `resolve` produces a **no-follow** descriptor. If a future edit in that file
  substituted one obtained by opening the stored path by name, a symlink swap after the metadata
  check would send up to 10 MiB of an attacker-chosen file to the renderer. The consequence is the
  same one `resolve` exists to prevent.
* **This is pre-existing, not introduced.** Before the split, `read_engine_image` resolved and read
  in one method and nothing stopped a future edit there from opening by name either. The split
  *narrows* the reach from "any caller of the method" to "an edit inside one file". It is filed
  because the narrowing is not the closure, not because the change regressed anything.
* **Fix shape:** relocate `ResolvedPath` and the opener into separate modules so the file that can
  mint a `VerifiedFile` is not the file that can mutate a `ResolvedPath`. That is a module-boundary
  change across `path_authority.rs`, which is why it is a different area from the offload cluster
  and is filed rather than absorbed.
* **Related:** `f-20260830-36` (`blocking-work-not-offloaded`), whose engine-image half this came
  out of; the design and the eight rejected scans are `d-20260903-08`.
* **Found by:** Claude Code plan review, rounds 6-13, 2026-09-03.

### `issue_puzzle_download_destination_blocking` is untested, and the puzzle path cannot be unit-tested without a `Runtime` generic

* **ID:** f-20260903-03 · **Status:** handled · **Area:** native-fs · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/puzzle.rs` — `issue_puzzle_download_destination_blocking` (~:318) and
  `active_or_default_puzzle_workspace` (~:236).
* **Defect:** the command conversions in `a47d9066` added new production code on the puzzle-workspace
  path with no test. `issue_puzzle_download_destination_blocking` resolves the workspace and then
  takes the authority lock to derive the download destination; nothing exercises it.
* **Why it is not merely a number, and what actually happened:** the first version of this entry
  reported `pnpm gate:ensure backend-coverage` **red** —
  `auxiliary-domain-services functions regressed: 56/135, baseline 53/127`. It is green again as of
  `<this run's puzzle.rs commit>`, but **not** because anything was tested: reviewing the diff
  against decision `d-20260903-06` showed the conversion had also created a redundant
  `get_puzzle_workspace_blocking` that did nothing but forward to
  `active_or_default_puzzle_workspace`. D-H says an existing *synchronous* helper **is** the blocking
  function and no new symbol is created, so that wrapper was a deviation from the reviewed plan.
  Deleting it is a plan-compliance fix on its own merits — and it removed one uncovered function,
  which took the ratio back above its baseline. The debt it was signalling is still here.
* **Why the remaining function is hard to cover:** `active_or_default_puzzle_workspace` takes the
  concrete `&tauri::AppHandle` (`AppHandle<Wry>`), while `tauri::test::mock_app()` yields
  `AppHandle<MockRuntime>`. A unit test cannot call it, or anything downstream of it, without making
  it generic over `R: tauri::Runtime` — along with `issue_puzzle_download_destination_blocking`,
  `list_puzzle_databases` and `resolve_puzzle`. The in-tree precedent for that shape exists
  (`db/search.rs:851`, `fs.rs:1678`). That is a production signature change, and the run that found
  this had already lost its executor, so it would have landed unreviewed by any lens.
* **Fix shape:** genericise those four over `R: tauri::Runtime`, then unit-test the blocking function
  against a `mock_app()` and a temp-dir `PathAuthority` — the fixtures already exist in that file's
  test module. Do it together with phase 3b of
  `tasks/plans/2026-09-03-blocking-work-not-offloaded.md`, which converts `issue_puzzle_workspace`
  and `list_puzzle_databases` in the same file and will move this area's counts again anyway.
* **Do not** clear a future recurrence by editing `backend-coverage-baselines.json` or lowering the
  area floor — `docs/coverage.md`, and `.claude/settings.json` denies the known spellings
  deliberately.
* **Related:** `f-20260830-38`, whose command conversions introduced it; `d-20260903-06` for the
  shape those wrappers have and why a pass-through is not one.
* **Found by:** Claude Code, running `pnpm gate:ensure backend-coverage` on its own diff, 2026-09-03.

* **Handled:** 2026-09-05, commit `fb85ed36`.
  `active_or_default_puzzle_workspace`, `issue_puzzle_download_destination_blocking` and
  `list_puzzle_databases_blocking` are now generic over `R: tauri::Runtime`, so the
  puzzle-workspace path is reachable from `tauri::test::mock_app()` for the first time. The
  three commands stay concrete and `pnpm bindings:check` is green, so `src/bindings/generated.ts`
  is byte-identical — the IPC surface did not move.
* **Four tests, and none of them is an `is_ok()`.** `puzzle_download_destination` returns
  `root.path_ref().clone()` verbatim, so "the returned `PathRef` is under the seeded root" is
  satisfied identically by a body that never asks the authority at all — the one mutation that
  deletes the `DownloadFile` authorization. So: (1) the destination equals the seeded root's own
  `PathRef` **and** resolves through `workspace_root` to the temp directory; (2) a second root
  carrying `PuzzleRead` and `PuzzleDelete` but **not** `DownloadFile` activates — activation
  gates on `PuzzleRead` alone — and only the download resolve errors; (3) the listing test seeds
  a decoy `notes.txt` beside `lichess.db3` and asserts the exact list; (4) the absent-authority
  arm is covered once.
* **The hazard the tests had to be built around:** `mock_app()` still resolves `app_data_dir()`
  against the **real** user directory, so a silently unseeded authority takes the default branch
  and creates `~/.local/share/<identifier>/puzzles` on the machine running the tests. Every case
  therefore asserts `active_puzzle_root()?.is_some()` **before** the call — scoped to its own
  block, because `active_puzzle_root` takes `&mut self` and the call under test locks the same
  mutex one line later, so a live guard turns the safety check into a deadlock. `XDG_DATA_HOME`
  was considered and rejected: `std::env::set_var` is process-global, `cargo test` runs tests as
  threads in one process, and an unwinding test would leak the mutated value into every test
  that starts after it.
* **Two deviations from the filed fix shape**, both recorded in `d-20260905-04`: three symbols
  are genericised rather than four (`resolve_puzzle` is not on the tested path), and the test
  module had none of the fixtures the finding assumed — all of it is new.
* **Sliced together with `f-20260901-01`** per `d-20260904-23`, because `puzzle.rs`'s only
  production filesystem reach sat inside the very function this finding needed generic.
* The filed sequencing dependency on phase 3b of
  `tasks/plans/2026-09-03-blocking-work-not-offloaded.md` was already cleared by `c5362e0d`.

---

## 2026-09-03 — filed through the inbox spool

### A failed or truncated PGN import commits its games and reports success, and never invalidates the search cache

* **ID:** f-20260903-04 · **Status:** handled · **Area:** pgn-import · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/db/mod.rs` — the import loop around `convert_pgn` (the
  `BufferedReader::into_iter` consumption), and `write_db_game`.
* **Defect:** two layers of `Result` are `.flatten()`ed away. `BufferedReader::into_iter` yields
  `Result<Option<TempGame>, io::Error>` (pgn-reader 0.26: underlying reads *and* irrecoverable
  parse errors), and both the outer and inner layers are flattened, so an I/O or parse error is
  indistinguishable from "no more games". The transaction then commits and the import returns
  `Ok`. Concrete input: a `.pgn.bz2` whose bzip2 stream is truncated after N complete games —
  those N games are stored and the user is told the import succeeded, with the tail silently
  missing. `write_db_game` has the same double-flatten: a two-game paste whose first game is
  skipped (`Importer.skip`, `end_game` → `None`) stores the *second* game under the requested
  `game_id`.
* **Second half, on the error path:** when a multi-file import does fail, `data_changed` and
  `search_cache.invalidate_database` run only after every file has succeeded. Connections use
  `PRAGMA journal_mode = WAL`, so a committed file need not change the `.db3` length or mtime that
  `IndexSource` fingerprints. A later position search therefore reopens the stale `.ecsi` sidecar —
  its source still "matches" — and answers from games that are no longer what the database holds.
* **Why it matters:** silent data loss presented as success is the worst shape this pipeline can
  fail in; the user has no signal to retry, and the stale index means the wrong answer is served
  from then on rather than an obvious error.
* **The design question that makes this `build`:** whether a truncated or unparsable source should
  fail the whole import, or import what it could and report the loss explicitly. That is a product
  question about what the user is promised, and it decides the shape of the fix; the swallowed
  `Result` is the mechanism either way.
* **Related, already filed:** `f-20260831-07` owns the per-file transaction boundary (a mid-import
  failure leaving games behind); this entry is the *error propagation* and cache-invalidation half
  of the same path and should be worked with it. `f-20260831-05` is a different game-boundary
  defect in the same area.
* **Found by:** the `review-pgn-index` lens during the `$push` review of the
  `blocking-work-not-offloaded` range, 2026-09-03 (confidence 90).

* **Test review, 2026-09-10:** `review-tests` found the compressed-reader regression can hang indefinitely when the original flatten chain returns (confidence 100). Fix: run that production-path regression in a bounded child process, reusing an extracted test-only subprocess runner from the existing bounded SQLite factory probes; kill and reap on timeout. Root measured the original implementation continuing past 60 seconds and the fixed suite passing 189 tests. The new bounded regression must fail by itself on the original reader loop and pass after restoration. Plan authorship and arbitration share root context; detection and code use the Codex family.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"6319f2dcc945d84bc0ece1ac823c9be69bc25b3eeaff02918ce4107db4e247e5","input_sha256":"11a8d04460e64a3824f237f4d46bd7585e81ab37811084f151c47a4c2e2948b4","kind":"mutation-receipt","operation":"43cee49f6cbb97447352c8942fe84316f287ebe1a4c896a48ee5225c1e0bd44a","options":{"section":null},"request_id_sha256":null,"results":["f-20260903-04"],"target":"f-20260903-04","v":1} -->

* **Resolved, 2026-09-10:** 5e32f572 implements d-20260910-08: one streaming transaction covers schema preparation, every source, indexes, row counts and revision/cache publication; terminal progress follows commit. Reader/decompression errors propagate, and replacement reads only the first physical game. Production regressions cover later-file and metadata/revision rollback, failed-new-database retry, preserved optional-index policy, real WAL index/query-cache consistency, skip semantics and streaming memory. Root's original-code comparison produced six explicit failures and reproduced the compressed-reader loop; restored code passed 189 database tests plus formatting. The cumulative review accepted four test-maintainability/proof corrections before final gates. Plan authorship and arbitration shared root context; detection and implementation used the same Codex family. No partial-outcome IPC or renderer redesign was introduced.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"65cf6eb7af2bd4ba464408d000ce1d217a7117073a2086c0287543333558c885","input_sha256":"bbb0cfa261d8f817b05fe970f8697d9cf742db32744612bd8525aa01b35519ec","kind":"mutation-receipt","operation":"53cbfb5624d7db8f3ba36a4fe5f4be68f03fc60b6ec2ffd84746c80093450585","options":{"section":null},"request_id_sha256":null,"results":["f-20260903-04"],"target":"f-20260903-04","v":1} -->

---

## 2026-09-03 — filed through the inbox spool

### Nothing stops a caller putting the 10 MiB engine-image read back under the path-authority mutex

* **ID:** f-20260903-05 · **Status:** handled · **Area:** native-fs · **Root:** blocking-work-not-offloaded · **Entry:** lens · **Blocked:** none
* **Where:** `src-tauri/src/main.rs` — `issue_engine_image_blocking` and `read_engine_image_blocking`;
  helpers `engine_image_reader_for` / `read_engine_image_bytes` in
  `src-tauri/src/infra/path_authority.rs`.
* **Defect:** `b345ea01` split the engine-image read so the process-wide `pgn_path_authority` mutex
  is held only to resolve and bound the no-follow descriptor, and the up-to-10 MiB `read_to_end`
  runs after the guard drops. The helper-level tests
  (`engine_image_reader_then_bytes_returns_exact_contents` and the oversize/growth cases) plus the
  `READ_TOKENS` scan pin that the *helpers* keep that shape: they go red if `read_to_end` moves back
  into the opener. **They do not constrain the call sites.** A caller that re-acquires
  `authority.lock()` around `read_engine_image_bytes` after `engine_image_reader_for` has returned
  puts the whole read back under the mutex, and every existing test stays green.
* **Why it matters:** that mutex is process-wide, so holding it across a 10 MiB read stalls every
  other path-authority operation — the exact failure `b345ea01` removed. The guard that exists
  today lives one layer below the place the mistake would be made.
* **What a fix looks like:** a source scan in the same family as `s1`/`s8` asserting that in each
  `*_engine_image_blocking` body no lock acquisition encloses the `read_engine_image_bytes` call —
  or, better, a type-level seam that makes the reader unusable while a guard is held, so the
  property is not carried by a text scan at all. The choice between those is why this is `lens`
  rather than `inline`.
* **Explicitly not claimed:** the current call sites are correct. This is about the absence of a
  proof, not a live defect.
* **Related:** same root as `f-20260830-36`/`-37`/`-38`; the `d-20260903-08` seam is what this would
  finish guarding.
* **Found by:** the `review-tests` lens during the `$push` review of the
  `blocking-work-not-offloaded` range, 2026-09-03 (confidence 90).

**Handled, 2026-09-04 (drain session 0a2310ce), commit `7b1d92ca`.**

`s10_engine_image_call_sites_read_outside_the_authority_guard` is the caller-side half the helper
tests could not provide. For both `*_engine_image_blocking` bodies it pins that the split is wired
up at all — `engine_image_reader_for` exactly once, `read_engine_image_bytes` exactly once, in that
order, with `MAX_ENGINE_IMAGE_BYTES` — and then walks every `.lock(` occurrence against a running
brace depth: a guard taken before the reader must sit at a strictly deeper block level, so it has
provably closed; a guard taken anywhere between the reader and the end of the read call fails
outright; a guard after the read is allowed, because `issue_engine_image_blocking` legitimately
re-locks to register the image. Verified red by inserting `let _guard = authority.lock()` before
the read, then reverted.

**The type-level seam was considered and rejected.** The entry asks for it in preference to a scan.
Rust cannot express "no lock is currently held": the mutex is an ordinary `std::sync::Mutex` that
any code in the crate may lock, so no witness token threaded through `read_engine_image_bytes`
would be sound unless lock ownership itself were restructured — which is the module split already
filed as the S-6 residual. The scan is what is actually provable here, and it is stated as such.
Reversal path: if `ResolvedPath` and the opener are ever relocated into separate modules, the seam
becomes expressible and this scan can be replaced by it.

The shared `closing_paren` helper introduced here became the basis of the closure walk that
`7fe851ed` later gave S-4, S-5 and S-7.

---

## 2026-09-04 — filed through the inbox spool

### `activate_download_artifact` still hashes the published inode under the process-wide authority mutex, on a Tokio worker

* **ID:** f-20260904-01 · **Status:** handled · **Area:** native-fs · **Root:** blocking-work-not-offloaded · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/infra/path_authority.rs` — `activate_download_artifact` and its
  `sha256_open_file` call; call sites `src-tauri/src/fs.rs` in `download_to_destination_inner`
  (the mark-and-activate block) and `install_staged_pgn_artifact`; restart recovery in
  `recover_pending_artifacts`.
* **Defect:** `f-20260830-36` was a whole-file SHA-256 of a downloaded payload held on the
  process-wide `pgn_path_authority` mutex from an async command. That hash was removed from
  `reserve_download_artifact` and now runs through `hash_staged_payload` on `BLOCKING_GATEWAY`
  before the lock is taken. The *same two commands* then re-acquire the mutex and call
  `activate_download_artifact`, which SHA-256s the **published** inode through `sha256_open_file`
  while `&mut self` is held — so after a multi-gigabyte database install the success path still
  hashes the whole file under the process-wide mutex, on a Tokio worker. It is the original stall,
  one step later.
* **Why it matters:** the guard is process-wide, so every unrelated path operation in the process
  waits for that hash, and a Tokio worker is parked for its duration. That is precisely the pair of
  properties `f-20260830-36` was filed about, and the range that closed it does not close this half.
* **Why this was not fixed in that range:** the plan
  (`tasks/plans/2026-09-03-blocking-work-not-offloaded.md`, approach point 5) rules
  `activate_download_artifact` out of scope, and correctly — but for a *different* question. Three
  review lenses independently rejected giving activate a caller-supplied digest, because activate
  hashes the published inode through the no-follow descriptor `resolve()` just opened, whereas
  reserve hashes an exclusive private tempfile; a caller digest would be compared against the number
  the caller got from reserve, making the check tautological, and `recover_pending_artifacts` builds
  its reservation from the journalled digest, so restart recovery would compare a record to itself.
  **That argument is about whether to hash, not about holding the registry mutex or running on
  Tokio.** The offload question for activate was never asked.
* **Why it is `build`:** the fix shape exists in-tree — `engine_image_reader_for` /
  `read_engine_image_bytes` with the `VerifiedFile` newtype (`b345ea01`): resolve the no-follow
  descriptor under the guard, drop the guard, hash the descriptor, re-acquire to commit. Applying it
  here is not mechanical, because activate's hash is a *verification* of the published inode against
  the journalled digest and its ordering relative to the post-rename identity marker is what closes
  the swap window. Deciding where the guard may be dropped without opening a TOCTOU gap is the same
  design question that took thirteen rounds of plan review for the engine image. `S-5` currently
  pins the sibling in place by requiring activate's body to contain `sha256_open_file`, so that
  assertion has to move with the split.
* **Related:** same root as `f-20260830-36`, whose other half this is;
  `d-20260903-08` is the engine-image seam this would mirror.
* **Found by:** the `review-root-cause` lens (confidence 90) over the cumulative diff of the
  `blocking-work-not-offloaded` range, 2026-09-04.

* **Plan review, 2026-09-08:** The activation slice retains build tier. Before implementation, review identified missing independent stale-intent field tests, runtime marker-persistence failure coverage and caller durability/progress checks; these are included in the plan. Two adjacent error-path defects are also being repaired: recovery currently discards activation failures with no diagnostic, and a failed progress report can replace the primary activation error. Recovery will retain quarantine and emit only a stable error category; runtime error reporting will preserve the primary failure. No repair is claimed complete yet. Plan authorship and arbitration share the Codex root context; Gemini ran review-plan and Codex ran the sensitive detection lenses.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"7cf43a1f1eed3c0d6c63859fc7a3c123044de91360236d90a1f28e6a44d3d997","input_sha256":"69d120857b3d63ada229e89bc95713440634a628aebc38157f3ac8bb5c087a4d","kind":"mutation-receipt","operation":"c9cbbf985298001c4c4aea8dbf0fac4c6d744bb6275f0392d3f4daa3574064e8","options":{"section":null},"request_id_sha256":null,"results":["f-20260904-01"],"target":"f-20260904-01","v":1} -->

Root phase inspection before acceptance: the independent proof passed 781 tests (one ignored), fmt, Clippy and diff-check, but six implementation/proof defects need a same-session repair. The new verifier duplicates sha256_open_file instead of sharing the descriptor hash implementation; prepared/verified types and prepare/verify/commit methods remain pub(crate) despite the module-private design; the mutation test fabricates a zero Windows change stamp; the stale progress test accepts any Conflict although both primary and secondary failures are Conflict; the ordinary marker-write test lacks the required zero-observer assertion; and new installed-artifact test setup is repeatedly copied despite the shared-concept rule. These are in-scope phase corrections before commit, not additional ledger work. Plan authorship and arbitration share the root context; this inspection is Codex over Gemini code, while plan and existing-code detection included the same Codex model family.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"07af35b97b6bb99464d02f3cc2ff432325bab49e1adf1678e121d20571232dd9","input_sha256":"5fc382f0fec642dba8cbfd16f435fe96a76e67a2c42b2bddd0d752be50ee9333","kind":"mutation-receipt","operation":"c0ee843c4fc94554dce06023c29220f9d266ac2cb80cb1ba9d955b76cd0e385a","options":{"section":null},"request_id_sha256":null,"results":["f-20260904-01"],"target":"f-20260904-01","v":1} -->

First Gemini correction pass addressed privacy, portable timestamps, exact primary-error assertions, marker observer coverage and shared fixtures. Root rejected its remaining duplicate test/production SHA256 loops: tests must execute the same read/hash implementation that production uses. A second narrow continuation will compile out only the observer parameter and callback within one shared loop. No mandate or design change. Plan authorship and arbitration share root context; correction detection is Codex over Gemini, with same-family Codex plan/existing-code review also present in this run.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"4cc4ef3ed4d7cc1f0cc2d29ae29a2a2041d78768f11c4202473d5d726f883d23","input_sha256":"ca3dd4b54b199fed2256582efe214a31fd7e7909cb80a1d2fecac3a92e39b9c1","kind":"mutation-receipt","operation":"b002ad17a6ebd32235db516bc16e26ec50cfcaca9fd4c23a1682fab3a2042d98","options":{"section":null},"request_id_sha256":null,"results":["f-20260904-01"],"target":"f-20260904-01","v":1} -->

**Cumulative review at 67ecbdc1**

Correctness, root-cause, IPC and Tauri-security: approved without findings. Twelve Fix verdicts and one Skip across the remaining thirteen reports:

* Tests: Fix the post-hash change-stamp proof with a same-byte rewrite at the EOF read hook. Fix retained-descriptor sampling coverage with a narrowly named test-only commit-stage hook after current-leaf validation; this proves rejection at that sample, not filesystem/registry atomicity. Skip the repeated warning-format test request for the recorded plan-round reason: low-impact diagnostic additions are inspected directly and do not justify a global logger harness.
* Minimalism: Fix repeated successful MockTransport setup, duplicate corruption observers, and duplicate marker injectors/reset guards.
* Code quality: Fix platform-specific names on new internal change-stamp fields, the stale prepare comment, the staged-only S5 name, and the unqualified short-lock wording. Existing persisted field names stay compatible.
* Error handling: Fix silently unavailable cleanup authority in both callers, reserve lock/initialization failure leaving progress Running, and successful publication discarded by terminal progress failure.

Root additionally found raw Error Display in the existing abandon-reservation warning while tracing cleanup. Fix it to an opaque reservation ID and stable category in the same native-authority repair package.

Repairs are grouped by file ownership: native authority plus its main.rs structural test; fs.rs runtime progress/cleanup and shared test setup. Both run through Gemini write leaves. No separate design deferrals. Plan authorship and arbitration share the root context; new code detection is Codex over Gemini, while plan and existing-code review include same-family Codex detection.
<!-- ledger-meta {"command":"annotate","effect_lines":12,"effect_sha256":"1d2237d98e45f713cdb7dd40556413df42f763d543eb31f86b0e9e8d1731c02e","input_sha256":"e464e44c840e8f984bf629f1caafd1167ef7bf5be04d7381acf71b48252605e7","kind":"mutation-receipt","operation":"e2e89550be65ba2ac32e038b0594ccc868db5b64b072f9808cf5c6887b4fa8ae","options":{"section":null},"request_id_sha256":null,"results":["f-20260904-01"],"target":"f-20260904-01","v":1} -->

Resolved by 67ecbdc1, 24e84a60 and 05aea7a9. Both runtime callers now persist the marker and prepare under authority access, hash one retained no-follow descriptor on a blocking worker outside the mutex, then revalidate the complete intent, root, current leaf and retained descriptor before publication. Recovery reuses the private primitives. Pending quarantine and durability overrides are preserved; reporting failures cannot overwrite primary errors or a completed publication.

All twelve cumulative Fix findings and the additional cleanup-log redaction correction are resolved. The repeated diagnostic-format test request remains Skip for the documented low-impact diagnostic reason. Root serial proof after the repairs and formatting: cargo test --manifest-path src-tauri/Cargo.toml --locked passed 784 tests, one ignored; fmt, Clippy all-targets and diff-check passed. Negative control disabled the post-hash and retained-descriptor guards: exactly the two targeted tests failed; both guards were restored and the full suite passed again. Evidence: /tmp/build-chessfable-next-nzJwvVpS/root-proof-5 and negative-control.log. Final affected push gates follow on the committed tree.

d-20260908-11 and d-20260908-12 record slice and implementation choices with reversal paths. f-20260904-05 remains open at build tier for its distinct cancellation/admission ownership design. No filesystem/registry atomicity beyond the final identity/stamp samples is claimed. Plan authorship and arbitration shared the root context. Gemini authored implementation and repairs; Codex performed sensitive cumulative detection. Plan/existing-code review included same-family Codex detection.
<!-- ledger-meta {"command":"annotate","effect_lines":5,"effect_sha256":"b850a3c3fa29fdbd4e8f1b8af971b61df60ffaccfd8e0eb86ae45a9c6240d09a","input_sha256":"4ef6938196620be6cac927a20f05f6725a4514ab8d47bd8ec703f1896d155ec4","kind":"mutation-receipt","operation":"83be6b1bf926f95297289e02dfc7f8eb3e002d99d4caef19f777cff521ac2a72","options":{"section":null},"request_id_sha256":null,"results":["f-20260904-01"],"target":"f-20260904-01","v":1} -->

### The analysis report's progress bar never updates, because the backend's operation id and the button's listener id can never be equal

* **ID:** f-20260904-02 · **Status:** handled · **Area:** bindings-ipc · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src/components/panels/analysis/ReportModal.tsx` (`operationId` is
  `` `report_${tab}_${crypto.randomUUID()}` ``, passed to `tauri.analyzeGame`),
  `src/components/panels/analysis/ReportPanel.tsx` (the `ProgressButton` is given
  `` id={`report_${activeTab}`} ``), `src/hooks/useProgress.ts` (the listener keeps a payload only
  when `payload.id === id`), and `src-tauri/src/chess.rs` `analyze_game`, which takes its lease on
  the `id` it was handed and emits `ProgressEvent` at `(i / fens.len()) * 100` and then `100.0`.
* **Defect:** the emitted id always carries a UUID suffix; the listened-for id never does. The
  strings therefore cannot match, `useProgress` discards every report update, and
  `ProgressButton` renders its bar only when `progress !== 0`, so the overlay stays empty for the
  whole analysis. Cancellation is unaffected because `cancel_analysis` routes through the UUID
  `EngineKey` rather than the progress id.
* **Why it matters:** a full-game report is the longest-running user-visible operation in the
  application, and it currently shows no progress at all. It is also the same class as the two
  incidents in `.claude/rules/ipc-events.md`: both sides type-check, the payload is well-formed,
  and nothing in the Specta registry or `bindings:check` can see that the discriminator does not
  line up — `bindings:check` validates types, never emitted values.
* **Why it is `build`:** the two sides disagree about what a progress id identifies, and either
  could be the one to change. Making the button listen for the operation id means lifting the id
  out of `ReportModal` into shared state so `ReportPanel` can read it, which touches how a report
  operation is registered and cancelled. Making the backend emit the per-tab id instead loses the
  ability to distinguish two reports on one tab. That is a contract decision, not a string fix, and
  it should be settled once for every `registerOperation` consumer rather than patched here.
* **Related:** `f-20260901-04` is the same failure family on the other two progress broadcasts —
  `ConvertProgress` and `DatabaseProgress` lack a discriminator the renderer filters on, where this
  one has a discriminator that never matches.
* **Pre-existing:** yes. The `blocking-work-not-offloaded` range moved `analyze_game`'s novelty
  lookup onto the blocking pool and did not touch either id.
* **Found by:** the `review-ipc-contract` lens (confidence 95) over the cumulative diff of the
  `blocking-work-not-offloaded` range, 2026-09-04. Verified by reading the three renderer files.

Handled 2026-09-04. Same defect as `f-20260901-08`, filed independently four days apart by two
`review-ipc-contract` runs; both are closed by commit `f73298f7`. The trade-off this entry spelled
out — lift the id out of `ReportModal` into shared state, versus emit the per-tab id from the
backend — was settled the first way: the id lives on the per-tab tree store, which additionally
survives the `keepMounted={false}` unmount that made Cancel a no-op. See the closing note on
`f-20260901-08` and decisions `d-20260904-17`, `-20`, `-21`.

### A partly-failed multi-file import leaves the search index describing the database as it was before

* **ID:** f-20260904-03 · **Status:** handled · **Area:** db-search · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/db/mod.rs` — `convert_pgn_blocking`, which opens one Diesel transaction
  per input file and calls `data_changed` / `search_cache.invalidate_database` only after the last
  file has succeeded. Connections run `PRAGMA journal_mode = WAL`. Index freshness is decided by
  `IndexSource { revision, database_length, database_modified_nanos, object }` read from the main
  `.db3` plus the in-process revision.
* **Defect:** import two files where the first is a small PGN and the second is unreadable — a
  truncated `.zst`, an empty handle, an I/O error. File one commits into the WAL; the command then
  returns `Err` without ever bumping `data_revision` or invalidating the mmap sidecar. Below
  SQLite's autocheckpoint threshold the main file's size and mtime often do not change, so
  `open_valid_preferred` treats the stale sidecar as current. `get_games` reads the new rows through
  the connection, while `search_position` and `is_position_in_db` do not see them at all — until
  some unrelated call reaches `data_changed` or a checkpoint rewrites the main file.
* **Why it matters:** the two read paths disagree about the contents of the same database, silently
  and for an unbounded time. A user who imports, sees the error, and searches gets results computed
  against a database that no longer exists. `.claude/rules/pgn-scanning.md` makes the byte-offset
  index authoritative for search; nothing here tells it that it is stale.
* **Why it is `build`:** this is the index half of a question `f-20260831-07` already opens on the
  data half — whether the import is one transaction across all files or per-file commits plus a
  reported partial outcome. The invalidation cannot be decided independently: with one transaction
  there is nothing to invalidate on failure, and with per-file commits the invalidation has to
  happen per file, which changes when the sidecar is regenerated during a long import. The two
  should be planned together.
* **Related:** `f-20260831-07` (the same import path, the user-facing atomicity half) and
  `f-20260831-06` (`whole-corpus-materialisation`, which constrains the one-transaction option).
* **Pre-existing:** yes. The `blocking-work-not-offloaded` range moved this body into a gateway
  closure and changed neither the transaction boundaries nor the invalidation point.
* **Found by:** the `review-pgn-index` lens (confidence 90) over the cumulative diff of the
  `blocking-work-not-offloaded` range, 2026-09-04.

* **Resolved, 2026-09-10:** 5e32f572 implements d-20260910-08: one streaming transaction covers schema preparation, every source, indexes, row counts and revision/cache publication; terminal progress follows commit. Reader/decompression errors propagate, and replacement reads only the first physical game. Production regressions cover later-file and metadata/revision rollback, failed-new-database retry, preserved optional-index policy, real WAL index/query-cache consistency, skip semantics and streaming memory. Root's original-code comparison produced six explicit failures and reproduced the compressed-reader loop; restored code passed 189 database tests plus formatting. The cumulative review accepted four test-maintainability/proof corrections before final gates. Plan authorship and arbitration shared root context; detection and implementation used the same Codex family. No partial-outcome IPC or renderer redesign was introduced.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"65cf6eb7af2bd4ba464408d000ce1d217a7117073a2086c0287543333558c885","input_sha256":"bbb0cfa261d8f817b05fe970f8697d9cf742db32744612bd8525aa01b35519ec","kind":"mutation-receipt","operation":"3d05821f52e5f8c463ce83a120f333c1df1e834ee0e1af30b9e89e3bb6d629d0","options":{"section":null},"request_id_sha256":null,"results":["f-20260904-03"],"target":"f-20260904-03","v":1} -->

### Exporting a database silently omits every game whose row fails to decode

* **ID:** f-20260904-04 · **Status:** handled · **Area:** db-search · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/db/mod.rs` — `export_to_pgn_blocking`, the `load_iter(...).flatten()`
  over the game rows.
* **Defect:** `.flatten()` on an iterator of `Result` discards the `Err` variants. A row that fails
  to decode — a corrupt move blob, a value outside its expected range, a Diesel type error — is
  dropped from the export, and the command returns `Ok`. The user gets a PGN file that is missing
  games and is told the export succeeded.
* **Why it matters:** an export is what a user does to get their data out of the application, and
  this is the one operation where silent omission is indistinguishable from success. It is the same
  class as the `applied-despite-error` category on the filesystem side (`d-20260830-05`), inverted:
  there an error was reported after the work applied; here no error is reported at all.
* **Why it is `build`:** the alternative to dropping is not obvious. Failing the whole export on one
  bad row means a single corrupt game makes the database unexportable, which is worse for the user
  who is exporting precisely because something is wrong. Reporting a partial export needs an error
  or result shape carrying which games were skipped, and a renderer that shows it — the same
  decision `f-20260831-07` faces for imports, and it should get the same answer.
* **Related:** `f-20260831-06` covers the *memory* defect at this same site (the export buffers the
  complete PGN in a `BufWriter<Vec<u8>>` before writing); this finding is the *correctness* defect
  beside it. `f-20260831-07` is the same partial-outcome question on the import side.
* **Pre-existing:** yes. The `blocking-work-not-offloaded` range moved this body into a gateway
  closure and did not change its error handling.
* **Found by:** the `review-pgn-index` lens (confidence 93) over the cumulative diff of the
  `blocking-work-not-offloaded` range, 2026-09-04.

* **Handled, 2026-09-05:** 7e3d91e9 replaces flattened/discarded export conversion results with fallible row-by-row serialization into the existing atomic temporary file. Invalid rows, FEN, moves, writes and terminal buffered flushes fail before replacement, preserving the old destination. Root reran all 129 database tests including these cases. d-20260905-21 preserves the existing complete-success Result contract; no partial-export mode or UI was introduced.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"ad64adecc95baa2df908520be32297a3185149fcd18151f6aee672d973b5f2de","input_sha256":"f02330886de37aa47b1e45eecf0a390cc66b9987afdcfdd8d7ca78db70eb4606","kind":"mutation-receipt","operation":"e4070484fef9027511c6e06ad4432c78b5fd2d7d1fec6cdd3776c7ee117741f4","options":{"section":null},"request_id_sha256":null,"results":["f-20260904-04"],"target":"f-20260904-04","v":1} -->

### Every offloaded command uses `spawn` rather than `spawn_cancellable`, because no path carries a `CancellationToken`

* **ID:** f-20260904-05 · **Status:** handled · **Area:** bindings-ipc · **Root:** blocking-work-not-offloaded · **Entry:** build · **Blocked:** none
* **Where:** the ~50 commands converted by `714e470d`, `c5362e0d`, `a22bbdf4` and `f98a3987` across
  `src-tauri/src/main.rs`, `fs.rs`, `puzzle.rs`, `file_workspace.rs`, `db/mod.rs`, `db/search.rs`
  and `chess.rs`; `BlockingGateway::spawn` and `spawn_cancellable` in
  `src-tauri/src/infra/blocking.rs`.
* **Defect:** decision D-G of `tasks/plans/2026-09-03-blocking-work-not-offloaded.md` says to use
  `spawn_cancellable` wherever a `CancellationToken` already exists on the path and `spawn`
  otherwise, and to file whatever is left on `spawn` only for want of a token. That is every single
  converted command: none of these paths carries a token today. `spawn_cancellable` consequently has
  no production caller at all outside its own tests.
* **Why it matters:** the work that moved onto the pool is the long work — a full PGN import, a
  rayon scan over an entire game index, a recursive delete, a multi-gigabyte hash. A caller that is
  abandoned (tab closed, window closed, the renderer stops awaiting) drops the gateway's own permit,
  but the worker keeps running to completion and keeps holding one of only four permits. With four
  abandoned long operations the pool is fully occupied by work nobody is waiting for. Search has a
  cancellation path (`SearchProgress`'s `Drop`) but it signals the renderer, not the worker.
* **Why it is `build`:** giving these paths a token is not a per-command edit. It needs a decision
  about where a token is owned and how it reaches the worker — per tab, per operation id, per
  command invocation — and how it interacts with the existing `SearchProgress` `Drop` path and the
  `EngineKey` generation used by `cancel_analysis`, so a cancelled operation ends up in exactly one
  terminal state rather than two. That is the same identity question
  `.claude/rules/async-resource-invariants.md` puts at the top of its single rule.
* **Related:** same root as `f-20260830-36` / `-37` / `-38`; `d-20260903-04` records why the gateway
  has no re-entrancy guard, which is the neighbouring decision about the same type.
* **Found by:** the `blocking-work-not-offloaded` build run, 2026-09-04, as D-G and plan phase 7
  require.

* **Cumulative path-ownership review (2026-09-06):** Luna PGN/index lens re-confirmed search_position uses uncancellable BLOCKING_GATEWAY.spawn at db/search.rs:478 (confidence 96; origins a22bbdf4/a5f81f5d). Root confirmed no cancellation token reaches this worker. Defer to this existing native job identity/token ownership design; not a frontend-only cancellation flag. No duplicate finding. Detection and code share the Codex family; plan authorship/arbitration share root context.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"67a1899e4dc605272c4384c94f109108f0962e56379d2e47ee7b1e82cfb45e15","input_sha256":"417a90b5278de89d16c255972a14053c20eba120573367d940c846e91a19e459","kind":"mutation-receipt","operation":"dba56eb982289bbd2f645c111aa14747cf41bfb374770274e098f1bb8cc90071","options":{"section":null},"request_id_sha256":null,"results":["f-20260904-05"],"target":"f-20260904-05","v":1} -->

* **Pickup evidence, 2026-09-08:** The current `BlockingGateway::spawn` keeps a borrowed semaphore permit in the awaiting future, while its `spawn_blocking` closure owns no permit. Dropping that future releases capacity before the worker exits, so abandonment can exceed the intended concurrency bound rather than merely occupy four slots. `spawn_cancellable` owns its permit in the worker but waits for admission without selecting cancellation. This run includes both in the existing cancellation/lifetime repair. Current PGN paths already use `spawn_cancellable` with `CancelOnDrop` and cooperative scan/copy checkpoints; the original no-production-callers observation is now stale. Entry remains `build` because other command lifetimes and commit-safe cancellation remain unresolved.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"74fae43fba27f232cf678ad148bb3bd9bc9e2618022d09c724ea945cb4d235c9","input_sha256":"c79ee4c0f3cb252a9b85c3fcd2a50f29987be799b44735da9e848312eccd942d","kind":"mutation-receipt","operation":"8cd61b4af60556e2c5d54b7fe4b1ba48ad09d59bbcc95ad8b22a50c8d22261fd","options":{"section":null},"request_id_sha256":null,"results":["f-20260904-05"],"target":"f-20260904-05","v":1} -->

* **Pickup scope correction, 2026-09-08:** Source tracing established independent activation and native cancellation-owner contracts. This build takes f-20260904-01 only; f-20260904-05 remains open at build tier, including the permit-lifetime and queued-cancellation evidence above. The prior pickup sentence saying this run includes those gateway repairs is corrected by the recorded slice decision. No cancellation repair is claimed complete.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"99fa7eeaeabf41678da26eafcaf7152139804e0fa592a02eafc358bb7323e4c8","input_sha256":"8573a9a0cc5707cb0a797d7946012d4add21eac059744938b32dadadbee83847","kind":"mutation-receipt","operation":"a8d788e98267efe697019e1fbc494412e520f9a492ea3cd16c61c2465021620f","options":{"section":null},"request_id_sha256":null,"results":["f-20260904-05"],"target":"f-20260904-05","v":1} -->

* **Pickup evidence (2026-09-08, native cancellation run):** Entry remains build. Root inspection and three Gemini locate probes confirm the gateway permit/admission defects already recorded here. The current PGN/opening-book paths have cancellation-on-Rust-drop guards, but the renderer facade sends no cancellation on promise abandonment. Transient owners include database search, player summaries, preload, PGN count/read and workspace listing. InfoPanel.tsx:171-185 and FileCard.tsx:40-47 also publish completed page reads without an identity/cleanup guard; request ownership must guard both native work and later renderer publication. Imports already have app-wide progress ownership through useConversionProgress and accepted mutations must retain native cleanup through commit. ProgressStore clear/eviction is not cancellation authority. The proposed plan is tasks/plans/2026-09-08-native-blocking-cancellation.md; retained probe reports are /tmp/build-cancellation-ohUBW1/probe-{1,2,3}.txt. No repair is claimed complete. Plan authorship and arbitration share one root context. Gemini performed locate; plan review uses Gemini review-plan and Codex sensitive lenses.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"8f3507a57b38e06570054b1ad86bf9c646ec35376574edaf081046c811d0c61a","input_sha256":"0a6d20e02b8ca6fe03c86b55879a2631d56d56e7c1ff7350ca19115ebaeb2080","kind":"mutation-receipt","operation":"9e5a3b57e14384337457f3c85650601e07d2c26a1d98dbfc39aab45ef125cb17","options":{"section":null},"request_id_sha256":null,"results":["f-20260904-05"],"target":"f-20260904-05","v":1} -->

* **Cancellation plan review, 2026-09-08:** Two completed review rounds additionally confirmed uncancelled game table/autocomplete/tournament reads, native lexing after a completed PGN read, all puzzle snapshot/query paths, and analysis surviving board-tab closure. `get_puzzle` uses `ORDER BY RANDOM() LIMIT 20`; its result bound does not bound work. The reviewed ownership design must preserve accepted PGN write/delete cache cleanup after caller drop and keep progress reporting independent of cancellation authority. The proposed new rusqlite pathname adapter was rejected by the security lens: before/after identity checks cannot bind the opened connection against A-B-A swaps. Exact authorized-object reads with live WAL consistency remain under design at `tasks/plans/2026-09-08-native-blocking-cancellation.md`; no source repair or finding closure is claimed. Gemini plan review exhausted provider quota in each round and each received the mandated single successful ordinary Codex retry. Plan authorship and arbitration shared root context; detection ran on the Codex family of existing code.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"a5ecc262c2b8532ec69b7381fde4ac1091432109e3c0fb5fa7162a2c0cac4ef6","input_sha256":"16cfd6696cd19f2f9c9d611e3e9b44111d750f69be9361af1a21169057f01b92","kind":"mutation-receipt","operation":"32a6e5f1cb676e9579c268ad537c1d662ab2e2cce572d95d88d67353fc7700fc","options":{"section":null},"request_id_sha256":null,"results":["f-20260904-05"],"target":"f-20260904-05","v":1} -->

* **Handled, 2026-09-09:** Implemented in 6c35b23b, 78d303fe, db8a07c5, 6ab7c3f3 and d835ac77: exact operation tickets own admission, worker capacity, cooperative SQL/PGN/CPU cancellation and commit-safe mutation cleanup. Renderer abort, tab/window destruction and shutdown reach native owners. Root integration passed 1,003 frontend tests and 900 native tests (one ignored), bindings, lint and all-target Clippy. Production checkpoint and held-worker tests include negative controls. Nine pinned container checks and real Tauri cancellation/window-destruction/shutdown verification passed. Separate archive staging authority and repository identity designs remain recorded as f-20260909-01 and f-20260905-03; no final archive installation proof is claimed.
* **Review provenance:** Plan authorship and arbitration shared root context. Codex detection used the same model family as phases 1, 2, 4 and the repairs; Gemini authored original phase 3. Final delivery gates follow these verified implementation records.
<!-- ledger-meta {"command":"annotate","effect_lines":2,"effect_sha256":"03e02b69fee862554f72baca53fb09f970ecfb40c11675ae7893a53f5550c0fd","input_sha256":"6da888aa434748d56019898a2575f7d7e3011069068381845975f34d22f13d6e","kind":"mutation-receipt","operation":"6ced3581c9d12cd9d1c57ee2024888ec8cfb7756a0e71a2bd3784529e48df759","options":{"section":null},"request_id_sha256":null,"results":["f-20260904-05"],"target":"f-20260904-05","v":1} -->

### Inside `path_authority.rs` a `VerifiedFile` can still be built from a pathname-opened descriptor

* **ID:** f-20260904-06 · **Status:** open · **Area:** native-fs · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/infra/path_authority.rs` — the private `mod verified`, its
  `VerifiedFile::from_resolved` constructor, `ResolvedPath`'s module-private `file` field,
  `open_engine_image` and `engine_image_reader_for`.
* **Defect:** `b345ea01` made the engine image read from `resolve`'s no-follow descriptor after the
  authority guard drops, and `VerifiedFile`'s private field means no caller *outside*
  `path_authority.rs` can construct one, open by name, or read without going through
  `read_engine_image_bytes`. Inside that module the property is still forgeable: `ResolvedPath.file`
  is module-private, so code in the file can set `resolved.file = Some(fs::File::open(stored_path)?)`
  and then call `from_resolved`, and a wrapper can read into a discarded `Vec`, `seek(SeekFrom::Start(0))`
  and still return the descriptor.
* **Why it matters:** the consequence if it were forged is a symlink swap after the metadata check
  sending up to 10 MiB of an attacker-chosen file to the renderer, bypassing `resolve`'s no-follow
  descriptor entirely.
* **What it is and is not:** this is a **pre-existing** property, not a regression. Today's
  `read_engine_image` already resolved and read in one method, and nothing stopped a future edit
  there from opening by name. The split does not weaken it and does narrow it: the reach shrinks
  from "any caller in the crate" to "an edit inside one file".
* **Why it is `build`:** neither a newtype nor a token ban closes it, because the offending code
  would live in the module that owns both primitives. Closing it means relocating `ResolvedPath` and
  the opener into separate modules so the constructor cannot see a raw `File` at all — a module
  boundary change across a 6000-line security-critical file, with its own question about what else
  has to move with `ResolvedPath`.
* **Related:** `f-20260830-36`, whose engine-image half produced the split; `d-20260903-08` records
  the seam. `S-6` in `tasks/plans/2026-09-03-blocking-work-not-offloaded.md` states this hole
  explicitly under "What is NOT proved" rather than claiming a proof it does not have.
* **Found by:** rounds 6 to 13 of the plan review for the `blocking-work-not-offloaded` cluster;
  filed by that plan's phase 7, 2026-09-04.

* **2026-09-04 — duplicate of `f-20260903-02`, not an independent finding.** Both entries describe
  the same defect in the same symbols: `ResolvedPath.file` is module-private, so code *inside*
  `path_authority.rs` can set `resolved.file = Some(fs::File::open(stored_path)?)` and call
  `VerifiedFile::from_resolved`, or read into a discarded `Vec`, `seek(SeekFrom::Start(0))` and
  return the descriptor anyway; both cite `d-20260903-08` as the seam, both name the same
  consequence (a symlink swap after the metadata check sending up to 10 MiB of an attacker-chosen
  file to the renderer), and both prescribe the same fix — relocate `ResolvedPath` and the opener
  into separate modules. `f-20260903-02` was filed by the plan review that found it (rounds 6-13,
  2026-09-03); this entry was filed by that same plan's phase 7 on 2026-09-04, which did not check
  that the review had already filed it.
* Neither is `rejected`: the defect is real and still open. The run that closes it works
  **`f-20260903-02`** and sets **both** to `handled` with the same commits. Noted here rather than
  in `f-20260903-02` so whichever entry a future `next` surfaces first leads to the other.
* Left open by `d-20260904-23`, which sliced this run to `f-20260901-01` + `f-20260903-03`.

---

## 2026-09-04 — filed through the inbox spool

### Debug builds send every log record to the renderer, so any logged native cause is renderer-visible

* **ID:** f-20260904-07 · **Status:** open · **Area:** bindings-ipc · **Root:** - · **Entry:** lens · **Blocked:** none
* **Where:** `src-tauri/src/main.rs:1615` (`let log_targets = [TargetKind::Stdout, TargetKind::Webview];`
  under `#[cfg(debug_assertions)]`), `src-tauri/src/main.rs:1635` (`.level(LevelFilter::Info)`),
  and `src/App.tsx:89` (`attachConsole()`).
* **Defect:** in a debug build every `log::info!`/`warn!`/`error!` record in the backend is
  emitted on the `log://log` channel by `tauri-plugin-log` and attached to the renderer console.
  The renderer is therefore a live sink for arbitrary backend log text, including absolute paths,
  SQL fragments, connection strings and keyring diagnostics. Release builds are unaffected
  (`main.rs:1618-1622` uses `Stdout` + `LogDir`), but debug is the build the project is developed
  and driven in, and `pnpm verify:app` runs a release binary while `pnpm dev` does not.
* **Why it matters:** `.claude/rules/async-resource-invariants.md` forbids moving a raw backend
  diagnostic into the renderer, and `.claude/rules/ipc-events.md` owns the renderer boundary. The
  command surface is being made typed and leak-free by `f-20260830-08`, and this is the second,
  unguarded channel into the same process — a backend author who logs a cause reasonably believes
  it stays backend-side. No gate can see it: `tauri:boundary:check` inspects renderer imports and
  `bindings:check` inspects types, and neither models a log target.
* **How it surfaced:** the `review-tauri-security` lens (confidence 93) during plan review of the
  `f-20260830-08` typed-error plan, 2026-09-04. That plan's first draft logged the dropped native
  cause from `impl Serialize for Error`, which would have delivered the exact text it was removing
  from the wire straight back to the renderer. The plan dropped the logging instead
  (`d-PENDING`, D-G) and filed this, because the log-target configuration is `main.rs` bootstrap
  and a different file set.
* **Fix shape:** decide whether the webview target is wanted at all; if it is, it needs its own
  level or its own filtered target rather than sharing `LevelFilter::Info` with stdout, so that
  a diagnostic can be logged backend-side without reaching the renderer. Verified by a test that
  a record containing a path is absent from the webview target's stream.
* **Related:** `f-20260830-08` (open) is the command-surface half of the same boundary; `Root` is
  `-` because the mechanism is a log target, not the error contract.

### `close_splashscreen` is the one command whose IPC error stays an untyped string

* **ID:** f-20260904-08 · **Status:** open · **Area:** bindings-ipc · **Root:** - · **Entry:** inline · **Blocked:** none
* **Where:** `src-tauri/src/main.rs:410-414` — `close_splashscreen` returns `Result<(), String>` and
  builds its two failures with `ok_or_else(|| "no window labeled 'main' found".to_string())` and
  `main_win.show().map_err(|e| e.to_string())`. Renderer side: `src/bindings/generated.ts:8`
  (`Promise<Result<null, string>>`).
* **Defect:** every other fallible command in the application returns `Result<_, crate::error::Error>`
  (108 of 114). This one carries a hand-rolled `String`, so after `f-20260830-08` types the `Error`
  wire contract it is the single remaining `Result<T, string>` in `generated.ts` and the single
  command whose error the renderer must still classify by prose. `map_err(|e| e.to_string())` on a
  `tauri::Error` also puts that error's `Display` — which can name a window label or a path — on the
  wire unredacted, the same class the typed contract removes everywhere else.
* **Why it matters:** one untyped exception to a typed contract is the shape that makes the next
  author think the contract is optional, and it is the reason `src/platform/errors.ts` must keep a
  string-classification fallback path for a command at all. Converting it lets the fallback be
  documented as renderer-originated errors only.
* **Fix shape:** return `Result<(), Error>`; `Error::InvalidInput` (or a `MissingResource` arm) for
  the absent window, `Error::Tauri` for the `show()` failure. Regenerate bindings. `src/App.tsx` is
  the only caller — check whether it inspects the error at all.
* **Pre-existing:** yes; untouched by the typed-error work, which deliberately scoped it out.
* **Related:** `f-20260830-08` (open) types the other 108. `Root` is `-` because this is a single
  command's signature rather than the shared serialization mechanism.
* **Found by:** the locate probe and three lenses during plan review of the `f-20260830-08` typed-error
  plan, 2026-09-04.

---

## 2026-09-04 — filed through the inbox spool

### The analysis report's result is dropped when the panel unmounts, so a report finished in the background is silently lost

* **ID:** f-20260904-09 · **Status:** handled · **Area:** frontend-state · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src/components/panels/analysis/ReportModal.tsx:56-60` (`mounted.current`) and
  `:120-129` (the `.then` that calls `addAnalysis`, and the `.finally` that clears
  `report.inProgress`); the unmount boundaries are `src/components/tabs/BoardsPage.tsx:194` and
  `src/components/panels/analysis/AnalysisPanel.tsx:99`, both Mantine `keepMounted={false}`.
* **Defect:** `analyze_game`'s `Vec<MoveAnalysis>` has exactly one reader — the `.then` inside the
  `ReportModal` instance that started it, gated on `mounted.current`. Leaving the Report sub-tab or
  the board tab unmounts `TreeStateProvider`, `ReportPanel` and `ReportModal`, so `mounted.current`
  becomes `false`. The UCI child keeps running under `EngineKey { tab: "analysis", engine: <id> }`
  and finishes normally, but the resolved analysis is discarded and `report.inProgress` is never
  cleared. On return the panel is a fresh instance that never called `analyzeGame`, and the store it
  would write to is a fresh `createTreeStore` — the old store's writes cannot reach it. The user
  waited for a full-game analysis and gets no annotations.
* **Why it matters:** `.claude/rules/async-resource-invariants.md` — "Renderer state is not
  authoritative for native jobs" and "give every spawn, subscription and job an owner". A native
  job whose result is only deliverable while a particular component happens to be mounted has no
  owner. `useConversionProgress` is mounted application-wide in `src/App.tsx:143` for precisely this
  reason, with the comment "an import keeps running while the user navigates away"; the report has
  no equivalent.
* **Why it is `build`:** the fix is to move ownership of the report operation above the
  `keepMounted={false}` boundary — an app- or `BoardsPage`-level owner that holds the promise and
  applies the result to the right tab, reaching a tab whose store may not be mounted (so probably
  through `tabStorage`, the way `createTab` seeds a tree). That is a design question about where a
  long-running renderer-initiated native job lives, not a patch to a guard.
* **Related:** `f-20260901-08` / `f-20260904-02` (both handled by the progress-discriminator run of
  2026-09-04) are the *progress* half of the same panel. `Root` is `-` because the mechanism is
  result ownership, not the id mismatch. That run deliberately set
  `completeOnProgressSuccess={false}` on the report `ProgressButton` (`d-PENDING`) so that fixing
  the bar would not newly render "Report generated" for an analysis the tree never received; when
  this finding is fixed, that prop should be reconsidered.
* **Found by:** the `review-engine-protocol` lens (confidence 95) during plan review of the
  progress-discriminator plan, 2026-09-04.

* **Handled, 2026-09-09:** Implemented in 6ab7c3f3 and d835ac77: report promises retain the live per-tab tree owner across provider unmount/remount; only persisted hydration clears stale report state. Actual provider lifecycle tests passed. completeOnProgressSuccess=false is retained because result application, rather than progress success, owns completion. Root integration passed 1,003 frontend tests.
* **Review provenance:** Plan authorship and arbitration shared root context. Codex detection used the same model family as phases 1, 2, 4 and the repairs; Gemini authored original phase 3. Final delivery gates follow these verified implementation records.
<!-- ledger-meta {"command":"annotate","effect_lines":2,"effect_sha256":"70d1301029a2130abf6df983c0bf923a7c05bda35523dd61768aa5624eefd069","input_sha256":"89ed1323e7f386fe60cef68a2148fb99ae27d73b841adb2364d94a8e03323d36","kind":"mutation-receipt","operation":"7b7b7f10df3bddee77891f840b23a44a96a821b0ecae615988f0d0bdaf33d475","options":{"section":null},"request_id_sha256":null,"results":["f-20260904-09"],"target":"f-20260904-09","v":1} -->

### Closing a board tab does not terminate a running analysis report's engine

* **ID:** f-20260904-10 · **Status:** handled · **Area:** engine-uci · **Root:** - · **Entry:** lens · **Blocked:** none
* **Where:** `src-tauri/src/chess.rs:685` — `EngineKey::new("analysis".into(), id.clone())` gives
  every report actor the literal tab `"analysis"`; `src-tauri/src/chess.rs:396-397` `kill_engines(tab)`
  and the supervisor's `terminate_tab` match on `key.tab == <ui tab id>`; the renderer side is
  `src/components/tabs/BoardsPage.tsx:81` and `closeWorkspaceTabAtom` in `src/state/atoms.ts:104`.
* **Defect:** a report's UCI child is keyed under the constant tab `"analysis"`, never under the
  board tab that started it. Closing that board tab removes its session storage and calls
  `killEngines(uiTabId)`, which cannot match `"analysis"`, so the engine keeps searching the whole
  game until it finishes on its own or the application exits. `cancel_analysis` is the only path
  that reaches it, and it is called only from `ReportPanel`'s Cancel button — which the tab close
  does not go through.
* **Why it matters:** `.claude/rules/async-resource-invariants.md` — "Give every spawn a name of the
  exit paths it is cleaned up on: normal completion, cancel, tab close, resource swap, application
  exit, error." Tab close is a named exit path and this spawn is not cleaned up on it. The same
  class as `e5422566` (issue #723, engine children outliving the application) and the sibling of
  the handled `f-20260831-11` / `f-20260901-06` / `f-20260901-07` retire-on-identity-loss work — a
  full-game report is a long search, so the leak is a real CPU cost, not a theoretical one.
* **Fix shape:** either key report actors under the originating board tab (so `terminate_tab`
  already reaches them, at the cost of the `"analysis"` namespace that keeps them out of the board's
  own engine set), or have the tab-close path cancel the operation id the tree store now holds. The
  progress-discriminator run of 2026-09-04 put that id in `report.operationId` on the per-tab tree,
  so it is available to a close handler for the first time; `closeWorkspaceTabAtom` currently
  constructs a fresh `createTreeStore(value)` rather than reading the live provider, which is the
  part to check first.
* **Related:** `f-20260901-08` / `f-20260904-02` (handled 2026-09-04) put `report.operationId` in
  the store and are what makes the second fix shape possible. `Root` is `-` because the mechanism is
  an engine key namespace, not the progress id mismatch.
* **Found by:** the `review-engine-protocol` lens (confidence 93) during plan review of the
  progress-discriminator plan, 2026-09-04.

* **Handled, 2026-09-09:** Implemented in 6ab7c3f3 and d835ac77: tab closure cancels the exact retained analysis operation ticket, including cancellation before native claim. Native owner cancellation covers engine initialization, UCI waits, post-dequeue publication and exact-generation reap without killing siblings. Production-path cancellation and shutdown tests passed within the 900-test native suite (one ignored); renderer ownership tests passed.
* **Review provenance:** Plan authorship and arbitration shared root context. Codex detection used the same model family as phases 1, 2, 4 and the repairs; Gemini authored original phase 3. Final delivery gates follow these verified implementation records.
<!-- ledger-meta {"command":"annotate","effect_lines":2,"effect_sha256":"6d78112f30062be51d5217229a0328f4fa727f0b7a99f0ec17fe9a25db56517d","input_sha256":"50eaf3f6f62bf876c0c18e61e3a46750cb27631bfce7868297bc78c25b8be5a1","kind":"mutation-receipt","operation":"3241c36a57d0b08995eb932f954256729f91a67aabbfe896d08df1da4289f08d","options":{"section":null},"request_id_sha256":null,"results":["f-20260904-10"],"target":"f-20260904-10","v":1} -->

### Cancelling an analysis report before its engine is published is a silent no-op

* **ID:** f-20260904-11 · **Status:** open · **Area:** engine-uci · **Root:** - · **Entry:** lens · **Blocked:** none
* **Where:** `src-tauri/src/chess.rs:656-665` (`cancel_analysis`), `:684-721` (everything
  `analyze_game` does before the lease), `:748` (`EngineProcess::new`, where the actor is first
  published to the supervisor); renderer side `src/components/panels/analysis/ReportPanel.tsx`
  `handleCancel`.
* **Defect:** `cancel_analysis` sets the `cancelled` flag only when
  `engine_supervisor.get_exact(EngineKey { tab: "analysis", engine: id })` already returns a
  published actor, and otherwise returns `Ok(())`. `analyze_game` does not publish that actor
  until after executable resolution and a full mainline replay that runs `naive_eval` twice per
  ply. For a long game that window is seconds, and a cancel issued inside it is accepted,
  reported as success, and forgotten: the command then goes on to spawn the UCI child and
  analyse the whole game. The user pressed Cancel, the button returned to its idle state, and the
  engine kept running.
* **Why it matters:** `.claude/rules/async-resource-invariants.md` — "a cancel flag checked after
  the emit is not cancellation", and every asynchronous operation needs a cancellation guard that
  covers its whole lifetime rather than the part after registration. `06c23b6a` is the same class
  on the search path. It is now more reachable than before: the progress-discriminator run of
  2026-09-04 made the report's Cancel button actually work (`f-20260901-08` / `f-20260904-02`),
  so a user who could previously never cancel a report at all can now press it during exactly
  this window.
* **Fix shape:** register the cancellation intent against the key before the long pre-spawn work,
  so `analyze_game` observes it at its first `cancelled` check rather than requiring the actor to
  exist — for example publishing a placeholder/reservation at the top of the command, or keeping
  a set of cancelled operation ids the command consults after resolution. Either way
  `cancel_analysis` must stop returning `Ok(())` for an id it did nothing about.
* **Related:** `f-20260830-51` (handled) and `f-20260831-11` (handled) are the termination-path
  siblings; the tab-close half of the report engine's lifetime is the finding filed alongside this
  one on 2026-09-04. `Root` is `-` because the mechanism here is a registration-order race, not a
  missing terminate caller.
* **Found by:** the `review-engine-protocol` lens (confidence 88) over the cumulative diff of the
  progress-discriminator range, 2026-09-04. Pre-existing; the range did not touch `chess.rs`.

---

## 2026-09-05 — filed through the inbox spool

### A deleted default root directory is a permanent dead end with no way back

* **ID:** f-20260905-01 · **Status:** open · **Area:** native-fs · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/infra/path_authority.rs` — `refresh_entry` (`:3948`), the reuse
  lookup inside `get_or_create_root` (the `self.persistent.values().find(...)` at `:2130`), and
  `validate_target`; reached from `get_database_workspace_blocking` (`main.rs`),
  `get_engine_workspace_blocking` (`main.rs`) and `active_or_default_puzzle_workspace`
  (`puzzle.rs`).
* **Defect:** if a user deletes one of the four app-owned default root directories, the
  application cannot recover, and there is no user-facing way out. `refresh_entry` marks the
  stale persistent entry `Unavailable` but never prunes it. The reuse lookup keys on
  `stored.path` regardless of availability, so the entry is still found. The default branch
  then recreates the directory — with a **new inode** — so `validate_target` mismatches the
  stored identity and the call returns
  `Conflict("<noun> root changed; select it again")`. There is no picker on this path to act
  on that instruction: these are the *default* roots, materialised by
  `ensure_app_owned_default_dir`, not chosen through a dialog.
* **Why it matters:** it is a permanently wedged workspace produced by an ordinary user action
  (cleaning out an app-data directory), and the error message tells the user to do something
  the interface does not offer.
* **Why it is filed rather than fixed here:** the answer is a design question, not an
  extraction. Candidates, none of them free: prune an `Unavailable` persistent entry whose
  path is an app-owned default leaf; make the reuse lookup skip unavailable entries and
  re-register; or add a re-selection surface for default roots. Each changes what a stale
  registry means, which the registry format and the dialog-caller contract both depend on.
* **Evidence from this run:** the three dialog callers now have regression tests proving they
  refuse an absent directory (`get_or_create_{database,engine,puzzle}_root_refuses_an_absent_directory`),
  which is the *correct* behaviour for a user-picked path and the exact mechanism that leaves
  the default path wedged. The two behaviours are now separated in code by
  `ensure_app_owned_default_dir`, so this can be fixed for defaults without weakening the
  dialog contract.
* **Related:** `f-20260830-07` (deleting a workspace directory leaves an authority record for
  every descendant behind) is the same class of registry rot; `d-20260904-*` from this run
  records why the create-if-missing shortcut was rejected for the dialog callers.
* **Found by:** Claude Code, plan review of `tasks/plans/2026-09-04-fs-surface-allowlist-shrink.md`, 2026-09-05.

---

## 2026-09-05 — filed through the inbox spool

### Credential initialisation runs before the path authority exists, so its five filesystem reaches cannot be routed

* **ID:** f-20260905-02 · **Status:** open · **Area:** oauth-credentials · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/credentials.rs` — five counted R3/R4 sites, including
  `secure_directory` (`:612-621`) and `open_registry_file` (`:626-632`); ordering at
  `src-tauri/src/main.rs`, where credential initialisation runs **before**
  `PathAuthority::open`.
* **Defect:** `credentials.rs` is one of the seven files still on
  `INITIAL_FS_SURFACE_ALLOWLIST`, at five sites, and none of them can be routed through
  `PathAuthority` as things stand: the credential store is materialised before the authority
  exists. There is also an asymmetry inside the file — `secure_directory` opens with
  `O_DIRECTORY|O_NOFOLLOW` while `open_registry_file` opens with `O_NOFOLLOW` alone.
* **Why it matters:** this is one of the six design questions standing between the current
  30-site allowlist and the empty one `f-20260901-01` asks for, and it is the one that touches
  credentials.
* **Fix shape (the decision, not the edit):** either a pre-authority bootstrap — a minimal,
  explicitly-scoped descriptor-based primitive the credential store may use before
  `PathAuthority::open`, with its own gate exemption stated as a rule rather than an allowlist
  count — or moving credential initialisation after the authority, which changes startup
  ordering and what happens when the registry itself is unreadable. Both are startup-ordering
  decisions with a failure mode on first launch.
* **Related:** `f-20260901-01`, which this splits out of; `d-20260901-03`, which recorded that
  `PathRef` cannot represent a backend-chosen destination.
* **Found by:** Claude Code, locate stage of `tasks/plans/2026-09-04-fs-surface-allowlist-shrink.md`, 2026-09-05.

---

## 2026-09-05 — filed through the inbox spool

### The repository is keyed on a normalised pathname, so its three filesystem reaches cannot be routed without re-keying it

* **ID:** f-20260905-03 · **Status:** open · **Area:** db-search · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/db/repository.rs` — `canonical_database_path` and the three counted
  sites at `:610`, `:614`, `:635`; `RepositoryState.entries: HashMap<PathBuf, _>`.
* **Defect:** three of `repository.rs`'s six allowlisted filesystem reaches exist only because
  the repository is keyed on a normalised pathname. `canonical_database_path` turns a database
  name into that key, so the reaches are not incidental IO — they compute the map key.
* **Why it cannot be routed as an extraction:** replacing the pathname key with an identity
  key means re-keying `entries` on `(dev, ino)` and moving LRU eviction, the tombstone set and
  `DatabaseIdentity.path` with it. And `:635`'s case is a database that does **not yet exist**,
  which has no `(dev, ino)` at all — so the key type would have to admit a second, pre-creation
  shape, which is exactly the design question.
* **Why it matters:** one of the six questions between the 30-site allowlist and the empty one.
* **Related:** `f-20260901-01`, which this splits out of; the sibling entry filed in the same
  run for `DatabaseIdentity.path` in the `.ecsi` provenance, which shares the "the pathname is
  load-bearing data, not just an argument" cause.
* **Found by:** Claude Code, locate stage of `tasks/plans/2026-09-04-fs-surface-allowlist-shrink.md`, 2026-09-05.

* **Cancellation design evidence, 2026-09-08:** The Tauri-security lens identified the concrete A-B-A opening window in `DatabaseRepository::connection` (repository.rs:159-174): pathname-based pool creation plus later identity confirmation cannot authenticate the already-open SQLite connection if the leaf is swapped and restored around opening. `schema_specific_connection_expected_file` documents why exact-descriptor snapshots are used for puzzles. This extends the existing pathname repository design question here, not the cancellation token identity question. A proposed new rusqlite pathname adapter was rejected; a measured SQLite public auto-extension/progress-callback bridge can interrupt existing Diesel queries without adding connections or changing authority. Full live-WAL snapshotting would need repository-wide exclusion, pool retirement, all writer/schema paths, and a defined external-writer contract (probe-5); it is not a safe incidental replacement. Retain this opening risk as acceptance evidence for this repository redesign. Plan authorship and arbitration share root context; detection uses Codex, the family of existing code. No authority repair is claimed.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"c8cf9656d88c175e6ca98599cd77860943137c2d1b64c20af4b8e69916a82389","input_sha256":"5c8f72d6c507e10b2151a5e87c79867e66d5fe373d7d260098bcba9bc9dcc9a3","kind":"mutation-receipt","operation":"b5d2c684de441b25197e34b137e15195730f73dd74256b6896b2cfb83c02eb15","options":{"section":null},"request_id_sha256":null,"results":["f-20260905-03"],"target":"f-20260905-03","v":1} -->

---

## 2026-09-05 — filed through the inbox spool

### `DatabaseIdentity.path` is archived into every `.ecsi` sidecar, and the entry lookup holds its lock across pool construction

* **ID:** f-20260905-04 · **Status:** open · **Area:** db-search · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/db/repository.rs:265`, `src-tauri/src/db/mod.rs:138`,
  `src-tauri/src/db/search_index.rs:180-195` (the archived provenance) and `:20` (`VERSION`);
  plus `repository.rs` `entry()` (`:411-446`).
* **Defect, part one:** `DatabaseIdentity` carries a pathname, and that pathname is **archived
  into every `.ecsi` search-index sidecar's provenance**. Dropping it is therefore not a
  refactor of two call sites: it takes `search_index.rs`'s `VERSION` from 6 to 7 and
  regenerates every existing index on every user's machine.
* **Defect, part two — a lock held across IO, in the same function family:** in `entry()`, the
  `state` binding taken at `:411` is still live across
  `Pool::builder()…build(ConnectionManager::new(key))` at `:429`. Building the pool opens
  SQLite connections, and every other database's entry lookup is blocked for the duration.
  This is `.claude/rules/async-resource-invariants.md`'s "no lock is held across blocking
  work" clause.
* **What was nearly filed here instead, and why it is recorded:** an earlier draft of the plan
  that produced this entry named `repository.rs:454-458`, claiming the `EntryState` guard is
  held across `DatabaseSchemaIdentity::from_path`. That is **false** — in `a = b` Rust
  evaluates the value operand first, so `from_path(path)?` completes, and can return early
  through `?`, before `entry.state.lock()` is taken; the guard covers the field store alone.
  Filing it as written would have put a non-defect into an append-only ledger and lost the
  real site. Stated here so the next reader does not re-derive it.
* **Why it matters:** part one is one of the six design questions between the 30-site
  allowlist and the empty one. Part two is a live contention defect independent of the
  allowlist, and it is filed here rather than separately because the fix opens the same
  function family.
* **Related:** `f-20260901-01`, which part one splits out of; the sibling `canonical_database_path`
  re-keying entry filed in the same run.
* **Found by:** Claude Code, plan review of `tasks/plans/2026-09-04-fs-surface-allowlist-shrink.md`, 2026-09-05.

---

## 2026-09-05 — filed through the inbox spool

### `PathAuthority` has no directory-enumeration capability, so `file_workspace.rs`'s five reaches have nowhere to go

* **ID:** f-20260905-05 · **Status:** open · **Area:** native-fs · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/file_workspace.rs` — five counted R3/R4 sites;
  `src-tauri/src/infra/fs.rs` (no primitive lists a directory);
  `src-tauri/src/infra/path_authority.rs` — `workspace_mutation_target` (`:3501`), which is
  `#[cfg(unix)]`.
* **Defect:** all five of `file_workspace.rs`'s allowlisted reaches are directory
  enumeration, and there is nothing in `infra/` to route them through: `infra/fs.rs` has no
  primitive that lists a directory at all. Closing them needs a new capability on
  `PathAuthority` — an `openat`-based iterator yielding `(name, identity, kind)` and **never a
  pathname**, since handing back a pathname would recreate the reach it replaces.
* **Why it is a design question, not an extraction:** the iterator's identity and lifetime
  semantics are the decision (what a caller may hold across iterations, what happens when an
  entry is replaced mid-walk), and **Windows is genuinely open**: the nearest existing
  primitive, `workspace_mutation_target`, is `#[cfg(unix)]`, so a portable directory capability
  has no in-tree precedent to copy.
* **Why it matters:** one of the six questions between the 30-site allowlist and the empty one,
  and the only one that requires new infrastructure rather than a change of key or ordering.
* **Related:** `f-20260901-01`, which this splits out of; `f-20260830-09` (every removal in
  `infra/fs.rs` unlinks by name) is the same descriptor-versus-pathname gap on the write side.
* **Found by:** Claude Code, locate stage of `tasks/plans/2026-09-04-fs-surface-allowlist-shrink.md`, 2026-09-05.

---

## 2026-09-05 — filed through the inbox spool

### The temp-to-temp `atomic_install_dir` pair is counted by bare name and cannot use the download-directory route

* **ID:** f-20260905-06 · **Status:** open · **Area:** native-fs · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/fs.rs:1374` and `:1436` — the two `atomic_install_dir` call sites;
  `src-tauri/src/infra/path_authority.rs` — `ResolvedPath::atomic_install_download_dir`.
* **Defect:** these two sites are counted because `PATHNAME_FNS` matches by **bare name**, and
  they are genuinely temp-to-temp: both operands are inside a staging directory the backend
  itself created. The authority-mediated route cannot take them —
  `ResolvedPath::atomic_install_download_dir` demands `PathOperation::DownloadArchive` and a
  **registered** target, and a staging directory is neither registered nor a download target.
* **Why it matters:** two of the 30 remaining counted sites, and the only pair where the
  pathname reach is arguably already contained; deciding them is deciding whether the gate
  should be able to express "both operands are backend-owned temporaries" at all, or whether
  the authority grows a staging concept.
* **Options, neither free:** teach the checker a narrow, named exemption for a staging-scoped
  install (which weakens a bare-name rule that is deliberately blunt), or give `PathAuthority`
  a staging-directory concept these two can register against (which adds a lifetime and a
  cleanup path to the authority).
* **Related:** `f-20260901-01`, which this splits out of.
* **Found by:** Claude Code, locate stage of `tasks/plans/2026-09-04-fs-surface-allowlist-shrink.md`, 2026-09-05.

---

## 2026-09-05 — filed through the inbox spool

### Ten reaches write to a backend-chosen destination that `PathRef` cannot represent — and the engine-image write is still a live symlink window

* **ID:** f-20260905-07 · **Status:** open · **Area:** native-fs · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/fs.rs:484`, `:591`, `:592`, `:827`, `:1243`, `:1444`, `:1503`;
  `src-tauri/src/main.rs:569` and `main.rs:1104` (the engine-image write);
  `src-tauri/src/sound.rs:113`. Also `src-tauri/src/infra/path_authority.rs` —
  `register_engine_image` (`:2367-2377`) and `ensure_app_owned_default_dir`;
  `src-tauri/src/infra/fs.rs:864` (`atomic_replace_at`).
* **Defect:** ten of the 30 remaining counted sites are one class — the backend picks the
  destination itself, and `d-20260901-03` already recorded that `PathRef` cannot represent
  such a destination. This is the `AuthorizedPath`-shaped token question, and it is the one
  that actually gates emptying the allowlist: the other five residual questions together
  account for fewer sites than this one does.
* **The engine-image window, named explicitly because it is narrower than it now looks:**
  `ensure_app_owned_default_dir` (added by this run) post-checks the `engine-images` leaf for a
  symlink, which closes the *pre-planted* symlink. It does **not** close the window between
  that check and the write: `main.rs:1104` then writes through
  `atomic_replace(&image_dir.join(uuid))` **by pathname**, so a symlink swapped in afterwards
  still redirects the bytes, and `register_engine_image` then registers the result for
  `ImageRead` with **no containment check** back to the app-data directory.
  `EngineImages` is the one `AppOwnedDefaultRoot` variant with no `get_or_create_*_root` — and
  therefore no `validate_target` — behind it, which is exactly why it is the exposed one.
* **Fix shape:** the close is a descriptor-relative write through `atomic_replace_at`
  (`infra/fs.rs:864`) against a descriptor for the checked directory, plus a containment check
  in `register_engine_image`. That is a subset of the token question and could be taken first.
* **Why it matters:** ten sites, and one of them is a live TOCTOU on a file the renderer is
  then handed a read capability for.
* **Related:** `f-20260901-01`, which this splits out of; `d-20260901-03` (`PathRef` cannot
  represent a backend-chosen destination); `f-20260830-32` (unbounded native reads, including
  an engine image read after a TOCTOU window) is the read side of the same window;
  `f-20260830-27` (the engine manifest supplies a path component).
* **Found by:** Claude Code, locate stage and plan review of
  `tasks/plans/2026-09-04-fs-surface-allowlist-shrink.md`, 2026-09-05.

**Progress 2026-09-05 (this run).** Converted the live check-then-reopen windows this slice could reach: engine-image install and registration now go through `AuthorizedDir` (`issue_engine_image_blocking` uses `atomic_replace_leaf_identified`; `register_engine_image` takes `(&AuthorizedDir, &OsStr, VerifiedIdentity, String)`); the three app-owned default roots pass `Some(dir.identity())` into `get_or_create_*_root`; the sound server retains an `AuthorizedDir` opened at startup and `serve_sound` walks descriptor-relative. `src-tauri/src/sound.rs` left `INITIAL_FS_SURFACE_ALLOWLIST`; `src-tauri/src/main.rs` dropped from 2 counted reaches to 1. The pre-existing `open_verified_directory` impostor-open is fixed (`VerifiedDir`). Commits `bc7ca1d0`, `2585fc3c`, `ec6f4149`, `97aefa9f`, `405cb2b8`.

**Still open, explicitly out of this slice.** Seven backend-owned staging reaches in `src-tauri/src/fs.rs` (`:484`, `:591`, `:592`, `:827`, `:1243`, `:1444`, `:1503`) — filed as a sibling, cross-linked to `f-20260905-06`. The dialog-chosen export destination at `src-tauri/src/main.rs:570` (`save_native_export_blocking`; filed as `569` in this finding) — filed as a sibling. `d-20260901-03` already recorded that `PathRef` cannot represent a native save-dialog destination. This finding stays `open` until those two residues are closed or rejected.

---

## 2026-09-05 — filed through the inbox spool

### Seven backend-owned staging reaches still write by pathname inside a tempfile the process just created

* **ID:** f-20260905-08 · **Status:** open · **Area:** native-fs · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/fs.rs:484` (`create_dir_all` of a download parent), `:591` (`create_dir_all` of an archive parent), `:592` (`atomic_replace` into that parent), `:827` (`File::open` of a staged download), `:1243` (`DirBuilder` in `create_private_dir_all`), `:1444` (`atomic_replace` in `extract_gz`), `:1503` (`OpenOptions` in `private_output_file`).
* **Defect:** these seven of the original ten "backend-chosen destination" counted sites in `f-20260905-07` are one class — they write inside a `tempfile` directory the process just created. They are the same design question as `f-20260905-06`'s two `atomic_install_dir` sites: whether `PathAuthority` grows a staging concept these can register against, or whether the release-surface checker learns a named exemption for backend-owned temporaries. Answering it inside the `f-20260905-07` AuthorizedDir run would have decided `f-20260905-06`'s question in a slice that does not own it.
* **Why it matters:** seven of the remaining counted sites in `fs.rs`, and the only residue of `f-20260905-07` that is not a dialog destination. Closing them empties most of that file's count.
* **Related:** `f-20260905-06` (temp-to-temp `atomic_install_dir`; Root `-`, so the relation is named here rather than shared); `f-20260905-07`, which this splits out of; `d-20260901-03` (`PathRef` cannot represent backend temp dirs).
* **Found by:** Grok, implementation of `tasks/plans/2026-09-05-authorized-directory-descriptors.md` phase 5, 2026-09-05.

---

## 2026-09-05 — filed through the inbox spool

### The native save-dialog export writes by pathname to a destination PathRef cannot represent

* **ID:** f-20260905-09 · **Status:** open · **Area:** native-fs · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/main.rs:570` (`save_native_export_blocking`; filed as `main.rs:569` in `f-20260905-07`).
* **Defect:** the export destination comes from a native save dialog. `d-20260901-03` already recorded that `PathRef` cannot represent that destination. There is no check-then-use pair to close with `AuthorizedDir`: the process never owned the parent, and `AuthorizedDir`'s producers cannot express an arbitrary path. This is a different design question from the app-owned and resource-root conversions `f-20260905-07` closed.
* **Why it matters:** the last counted reach in `main.rs` (the allowlist count is now 1). Emptying `main.rs` from the filesystem-surface allowlist waits on this.
* **Related:** `f-20260905-07`, which this splits out of; `d-20260901-03`.
* **Found by:** Grok, implementation of `tasks/plans/2026-09-05-authorized-directory-descriptors.md` phase 5, 2026-09-05.

---

## 2026-09-05 — filed through the inbox spool

### `ensure_app_owned_default_dir` still uses pathname `create_dir_all`, so a swapped ancestor symlink can mkdir outside the Tauri app-data tree

* **ID:** f-20260905-10 · **Status:** open · **Area:** native-fs · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/infra/path_authority.rs:924` (`fs::create_dir_all(&path)` in `ensure_app_owned_default_dir`). `AppDataDir::for_app` at `:844` is still a `PathBuf` from `app.path().app_data_dir()`.
* **Defect:** the AuthorizedDir conversion closed the *leaf* symlink window: after `create_dir_all`, `symlink_metadata` refuses a non-directory leaf and `authorize_existing_dir` opens a verified descriptor used for the subsequent write. `create_dir_all` itself still walks the pathname and follows ancestor symlinks. If an attacker replaces an ancestor of the Tauri-derived app-data path with a symlink before the first default-root materialisation, mkdir of `db` / `engines` / `engine-images` / `puzzles` happens in the symlink target. The later verified open then either rejects the swapped ancestor or adopts the directory that was created outside the intended tree, and the out-of-root directory is left behind. Closing it means retaining a descriptor on `AppDataDir` and using `mkdirat` for the leaf — a producer-shape question this run's plan did not settle (`d-20260905-02` kept `create_dir_all` on a closed enum of leaves).
* **Why it matters:** the four default roots are created on first use. An ancestor swap is a different window from the leaf-symlink check the conversion added, and it is not covered by `credentials`'s "app-data directory itself is not a symlink" test, which looks at the last component.
* **Related:** `f-20260905-07` (the conversion this residue survived; Root `-`, so the relation is named here rather than shared); `d-20260905-02`, `d-20260905-07`.
* **Found by:** Codex `review-tauri-security` over `83376d74..HEAD`, 2026-09-05. Confidence 96. Same-area as this run; deferred because the fix is a design question (descriptor-backed `AppDataDir` + `mkdirat`) the frozen plan did not decide.

* **Reconfirmed/deferred (2026-09-06, Codex):** The final Luna tauri-security lens over 9330ef47..5b51fa6a reidentified the ancestor-symlink bootstrap window at current path_authority.rs:1209. Root reread this finding and d-20260905-02/-07. The existing separate descriptor-backed AppDataDir producer design remains deferred; the ownership task does not claim to solve it. Follow-up: tasks/handoffs/2026-09-06-app-data-bootstrap.md.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"11a13291e0cc627220290fa1c72d261c7d04e10425509eb28efb32af2c3ffeff","input_sha256":"7fdd2177d368ef287ae9300cc0b7386f8ae584adf016fbfb10a9c2a8160763ee","kind":"mutation-receipt","operation":"b5588ce4e4f77d9797db734a200b13764c795138ac4613b5b5e7c8302b78a188","options":{"section":null},"request_id_sha256":null,"results":["f-20260905-10"],"target":"f-20260905-10","v":1} -->

---

## 2026-09-05 — filed through the inbox spool

### `install-local.sh` still records provenance `reviewed` for a binary it never bound to HEAD

* **ID:** f-20260905-11 · **Status:** open · **Area:** gate-scripts · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `scripts/install-local.sh:47` (`--untracked-files=no`), `:48` (`provenance="reviewed"` before any rebuild), `:71-74` (`pnpm build` with no post-build recheck), `:5` (`--no-build` copies `target/release` as-is). Tracking ref stored in a local named `upstream` at `:46`.
* **Defect:** the versioned `releases/<commit>-<timestamp>` layout and atomic `current` swap (4c487d3b) closed the partial-publication hole: VERSION, icon, binary and sound resources land in a staging directory before `current` is renamed. Three provenance holes remain. `--no-build` copies whatever executable is in ignored `target/release` and still labels it `reviewed` with the current HEAD. The dirty check ignores untracked files, so an untracked build input can be compiled. Validation runs only before `pnpm build`; a concurrent edit during the compile is installed under the earlier HEAD. The local `upstream` is `@{upstream}` (origin/master here), which is this fork's tracking ref, not the `upstream` remote (the original project).
* **Why it matters:** `$push` on master now runs this script as its last step and CLAUDE.md tells Felix the daily app is a reviewed copy. A stale or concurrently-edited binary published as `reviewed` is the failure the script exists to prevent.
* **Related:** foreign commits `24720681`, `56b171ae`, `bcd7c9e4`, `4c487d3b` (Claude session `01JAkRySrZTT3Xzew3Jv7uJk`) landed on master during the AuthorizedDir push review.
* **Found by:** Codex `review-correctness` / `review-root-cause` / `review-error-handling` over `d25d12a6..56b171ae`, 2026-09-05; re-checked against `4c487d3b`. Confidence 99. Deferred because that session is still iterating the installer on the same branch; rewriting it here races them.

---

## 2026-09-05 — filed through the inbox spool

### The local opening explorer cannot filter by rating or restrict to recent games in one step

* **ID:** f-20260905-12 · **Status:** open · **Area:** db-search · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src/components/panels/database/DatabasePanel.tsx` (`LocalOptions`),
  `src/components/panels/database/options/LocalOptionsPanel.tsx`, `src-tauri/src/db/search.rs`
  (`search_position` and the `PositionStats` aggregation), `src-tauri/src/db/mod.rs` (`GameQuery`
  already carries `range1`/`range2` and `start_date`/`end_date`).
* **Defect:** the local position explorer — the panel that answers "what is played here, how
  often, with what score" from a local database — filters only by player, colour, date range and
  result. There is no rating band and no "last N years" shortcut, so a reference database of
  11 million games answers with club-level and historical noise mixed into the counts. The
  `GameQuery` used by the games table already has `range1`/`range2` Elo bounds, but the position
  aggregation does not take them and the explorer UI does not expose them.
* **Why it matters (product, Felix, 2026-09-05):** this is the central preparation view. In
  ChessBase Felix kept a materialised slice "Mega25_Elo_1850_2350" (6.8 M games) solely to get
  this filter; the decision on 2026-09-05 was to *not* migrate that slice and to build the filter
  live in ChessFable instead, so the same view follows every reference-database update. Until it
  exists, the reference database is unusable for opponent-frequency work at his level.
* **Scope:** Elo band (min/max, applied to the side to move or to both — the panel must say
  which) and a date-from control with year presets, on the local explorer; the backend position
  aggregation honours both, with the search index unchanged (the filter applies to the candidate
  games after the position match). Time-control is deliberately *not* in scope: Mega/Gigabase
  games carry no `TimeControl` tag, so it would match nothing.
* **Why it is `build`:** it touches the aggregation contract on the Rust side and the explorer UI;
  the open design question is whether the Elo band filters on the mover, the average, or both
  players — a product-visible choice that must be stated in the panel, not guessed.
* **Related:** `f-20260831-06` (large PGN import) — without it the reference database this
  filter is for cannot be imported from PGN; the manifest downloads are unaffected.
* **Found by:** Felix's preparation-workflow description, session 2026-09-05.

* **Addendum (2026-09-05, Felix):** the explorer must also let him exclude fast games. Mega and
  YottaBase carry no `TimeControl` tag, but official rapid and blitz events are recognisable by
  the event name ("rapid", "blitz", "Schnell", "bullet", "armageddon"). Add an "exclude rapid/blitz
  events" toggle implemented as a case-insensitive event-name predicate, and state in the panel
  that it is name-based. Felix's target set: classical only, rapid tolerated, nothing faster.

---

## 2026-09-05 — filed through the inbox spool

### The Files page's Move control renders the word "Move" inside an icon-sized button, showing as "1ov"

* **ID:** f-20260905-13 · **Status:** open · **Area:** frontend-ui · **Root:** - · **Entry:** lens · **Blocked:** none
* **Where:** `src/components/files/DirectoryTree.tsx`, the second `IconAction` in the row actions
  (`label={t("Files.Move")}` with `{t("Files.Move")}` as its *child*), next to the delete action
  that correctly renders `<IconTrash size={16} aria-hidden />`.
* **Defect:** `IconAction` wraps Mantine's `ActionIcon`, a fixed-size square button meant for a
  glyph. Putting text in it clips the word to the button width: on the real window on
  2026-09-05 every row shows a grey "1ov" after the trash icon (screenshot in the session). The
  control is unrecognisable as "move" and looks like a rendering error.
* **Fix:** render an icon child (`IconFolderSymlink` or `IconArrowsMove` from `@tabler/icons-react`,
  `size={16} aria-hidden`) and keep `label` for the tooltip and `aria-label`, mirroring the delete
  action. Update the `DirectoryTree.test.tsx` query that finds the button by text, if any, to
  the accessible name. Verify through `verify-ui`: Files page pixels are pinned by the container
  e2e run, so the snapshot changes and must be re-recorded **inside the container**, never on
  the host (`d-20260829-01`).
* **Why `lens`:** one mechanical change in one component plus its test and snapshot; the
  `review-code-quality` lens for the icon choice against neighbouring rows. No design question.
* **Found by:** Felix's screenshot of the Files page after choosing the repertoire collection,
  session 2026-09-05.

---

## 2026-09-05 — filed through the inbox spool

### The Files page lost its file card in the audit commit, and double-click does not open a file in the real window

* **ID:** f-20260905-14 · **Status:** open · **Area:** frontend-ui · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src/components/files/FilesPage.tsx` (renders only `DirectoryTree`, with
  `search=""` and `filter=""` hard-coded), `src/components/files/FileCard.tsx` (still in the
  tree, imported by nothing), `src/components/files/DirectoryTree.tsx` (row `onDoubleClick` on a
  `draggable` `Box`).
* **Defect, part 1 — missing pane:** upstream's Files page is a two-column layout: the tree on the
  left and `FileCard` on the right, which shows the selected file's name, its game list with
  paging, a search box and a type filter, and the Open action. Commit `3afed031` ("audit
  implementation for state, components, hooks and routes") dropped `FileCard` from the page and
  froze the tree's search and filter props to empty strings, so the only way to open a file is the
  row's double-click or Enter, and there is no way to see or pick a game inside a multi-game
  file. Nothing in the audit plans or `tasks/decisions.md` records this as intended. Measured on
  2026-09-05: after clicking a row the page shows only Rename / Move / Trash above the tree
  (screenshot in the session).
* **Defect, part 2 — double-click:** on the real WebKitGTK window, double-clicking a file row
  opens nothing and shows no error. The PGN is not the cause: the Rust lexer and the renderer's
  `parsePGN` were run on the first game of the very file (`Weiß_Pirc.pgn`, BOM + CRLF + ChessBase
  `[%cal]`/`[%evp]` annotations) and both succeed. Renderer failures are not written to the log
  file, so the failing step is not yet identified. Prime suspect is the `draggable` attribute on
  the row `Box` (WebKit starts a drag on the second mousedown and swallows `dblclick`); second is
  a rejected `readGames`/`createTab` promise, which `openEntry` discards with `void` and never
  notifies.
* **Fix shape:** restore the two-column layout with `FileCard` and wire search/filter to real
  state; route `openEntry` through `notifyUnlessCancelled` (`edc8943a`) so a failure is visible;
  prove double-click through `pnpm verify:app` on the real window, which is the only proof for
  WebKitGTK event behaviour (`d-20260830-18`).
* **Why `build`:** it restores a whole pane whose interaction with the tree, tabs and persisted
  selection needs a plan, and the double-click cause must be measured before it is fixed.
* **Related:** `f-20260905-13` (the clipped Move control in the same tree row).
* **Found by:** Felix opening his imported repertoires, session 2026-09-05.

---

## 2026-09-05 — filed through the inbox spool

### PGN export writes decoded player names into quoted tags without escaping

* **ID:** f-20260905-15 · **Status:** handled · **Area:** db-search · **Root:** - · **Entry:** lens · **Blocked:** none
* **Where:** `src-tauri/src/db/mod.rs:336` decodes escaped White/Black headers; `PgnGame::write` at `:2259` writes the stored names verbatim inside quotes.
* **Defect:** a valid player name containing a quote or backslash becomes a malformed or changed tag after export. The importer uses `RawHeader::decode_utf8_lossy` for player names, so the exported text must escape these decoded characters again.
* **Related:** f-20260904-04 concerns export omission; f-20260831-06 streams the same exporter. This is a distinct serialization defect, not the corpus allocation cause.
* **Found by:** Codex source trace during the whole-corpus-materialisation build. Fix in this run's export verification/remediation with a round-trip regression; do not silently broaden the selected cluster's root.

* **Handled, 2026-09-05:** 6694b6e7 corrects inline semicolon boundaries and reescapes decoded export tags without changing raw stored tag representation. Root reran 17 PGN tests and 130 database tests, formatting and clean-diff checks. The exact semicolon regression checks both games and their byte ranges without a later brace masking the defect. Import -> production export -> import verifies quotes/backslashes in both players and optional decoded tags, plus unchanged raw Event/Site escapes.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"8fab175268994a4a3322ffeff9c8e9bf434717882c60d98ff24f2b135e27058e","input_sha256":"59e223b9b59dad5b336b772a08f0a1eea2f81a68cdb3c2e39a24235f6c0221a4","kind":"mutation-receipt","operation":"2812e46bc68f6e9be290bb2040e686d8ce371708efc21ee2abba10adc4cb37a4","options":{"section":null},"request_id_sha256":null,"results":["f-20260905-15"],"target":"f-20260905-15","v":1} -->

---

## 2026-09-05 — filed through the inbox spool

### A partially out-of-bounds PGN page silently drops valid requested games

* **ID:** f-20260905-16 · **Status:** handled · **Area:** pgn-import · **Root:** - · **Entry:** lens · **Blocked:** none
* **Where:** src-tauri/src/pgn.rs:578, read_games_core, games.get(start..end).unwrap_or(&[]).
* **Defect:** A two-game PGN requested as read_games(1, 2) returns successful empty output, silently losing valid game 1 rather than reporting that the requested range became unavailable. Stale pagination therefore looks like an empty page.
* **Related:** f-20260831-06 shares the reader but addresses corpus materialisation; this is a distinct range-result defect.
* **Fix:** Reject unavailable ranges on non-empty PGNs with the existing typed error boundary and test the production core. Preserve the legitimate empty-file opening case (0, 0): NewTabHome explicitly uses pgn[0] || "" to create an empty analysis board, and ImportModal probes that same range for empty files. The lens claim that this case must error confuses absent cached offsets with a freshly scanned empty file; that portion is skipped based on callers.
* **Found by:** final Codex PGN-index lens, confidence 99. In-area remediation in this run. Plan authorship and arbitration shared the root context; detection used the same model family as code.

* **Handled, 2026-09-05:** 0b386735 rejects partial/wholly unavailable PGN ranges through the existing typed error while preserving empty-file (0,0) opening. Production-core tests cover all five cases. Root reran all 19 PGN tests and 133 database tests, cargo fmt and clippy successfully.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"363829c6fdf280dc2ec61f3288e3d4b0be939039ac59505068528b3936e67c01","input_sha256":"0f819d60309434eccb0b3f0a5b3a7988cc648626da772b2d7910418871322f63","kind":"mutation-receipt","operation":"37ec84c333c2f3ba40f555c02d317210c0db5cacb6af85bc5f57df08d43ff62b","options":{"section":null},"request_id_sha256":null,"results":["f-20260905-16"],"target":"f-20260905-16","v":1} -->

---

## 2026-09-06 — filed through the inbox spool

### `computeCoverageForFen` has no in-progress guard, so a repetition line recurses until the stack overflows

* **ID:** f-20260906-01 · **Status:** open · **Area:** chess-tree · **Root:** - · **Entry:** inline · **Blocked:** none
* **Where:** `src/utils/repertoire.ts:104-185`, specifically the `memo.get(fen)` read at line 112.
* **Defect:** `memo.set(fen, res)` runs only *after* the recursive calls return (lines 148, 181 and
  the early-return branches). While a FEN is still on the call stack its memo entry does not exist,
  so `memo.get(fen)` returns `undefined` for it. `stateMoves` is keyed by FEN, not by tree node, and
  the keys come from `getBoardState` — the first four FEN fields, with the clocks stripped. A
  repertoire containing a repetition (1. Nf3 Nf6 2. Ng1 Ng8, or any perpetual-check line) therefore
  produces `stateMoves[A] -> B` and `stateMoves[B] -> A` with *identical* keys on both visits, and
  `computeCoverageForFen` recurses between them until the runtime throws
  `RangeError: Maximum call stack size exceeded`.
* **Why it matters:** the throw is not caught anywhere on the coverage path, so it takes down the
  repertoire panel rather than degrading one position's number. Stripping the clocks is what makes
  the cycle reachable — it is correct for position identity (`.claude/rules/chess-tree-semantics.md`)
  and is exactly what closes the loop here.
* **Fix shape:** mark the FEN as in-progress before recursing and treat a re-entry as coverage 1 /
  missing 0 (the same neutral value the `total < minGames` branch already returns), then overwrite
  with the real result on the way out.
* **Found by:** an Antigravity CLI (`agy`) lens evaluation on 2026-09-06, reported independently by
  `gemini-3.8-flash-medium` (confidence 98) and `gemini-3.8-flash-high` (confidence 100); the memo
  ordering and the `getBoardState` key shape were then verified by reading the source.

---

## 2026-09-06 — filed through the inbox spool

### The repertoire gap finders can never report the position the user is standing on

* **ID:** f-20260906-02 · **Status:** rejected · **Area:** chess-tree · **Root:** repertoire-gap-selection · **Entry:** inline · **Blocked:** none
* **Where:** `src/utils/repertoire.ts:292` (`findNextGap`) and `src/utils/repertoire.ts:343` (`findBiggestGap`).
* **Defect:** both traversals begin at `startNode` with `path = startPath`
  (`return findNextInSubtree(startNode, startPath)`), then gate acceptance on
  `if (path.length > startPath.length)`. The start node itself therefore fails the gate on every
  call and can never be returned. For a brand-new repertoire — `startPath = []`, `root.children`
  empty — the traversal has nothing else to visit and returns `null`.
* **Why it matters:** `null` is rendered as "no gaps found", so an empty repertoire, and any
  position the user has navigated to and prepared nothing from, reports itself as complete. That is
  the exact case a repertoire tool exists to flag, and it is silent.
* **Found by:** an Antigravity CLI (`agy`) lens evaluation on 2026-09-06, reported by
  `gemini-3.8-flash-medium` (confidence 95) and `gemini-3.8-flash-high` (confidence 100 and 95);
  the `findNextInSubtree(startNode, startPath)` call site was then verified by reading the source.
* **Why rejected:** rejected 2026-09-06, same session, by the `$push` `review-correctness` lens
  (Codex, confidence 94), verified against the source before accepting. the exclusion is deliberate and the
  user-visible consequence asserted above does not occur. `root.san` is `null`
  (`src/utils/treeReducer.ts:88-92`), and both gap labels return `null` without a `san`
  (`RepertoireInfo.tsx:530-539`), so the start node could not name a navigable move even if it were
  returned. The "no gaps found - your repertoire is complete" banner is additionally gated on
  `(isUserTurn ? hasResponses : positionMoves.length > 0)` (`RepertoireInfo.tsx:747`), so an empty
  repertoire renders no completeness claim at all. The filing over-read `null` as "reads as
  complete". Left in the ledger rather than deleted so the next session does not re-derive it.

---

## 2026-09-06 — filed through the inbox spool

### `findBiggestGap` discards a large opponent gap whenever any descendant has a smaller one

* **ID:** f-20260906-03 · **Status:** handled · **Area:** chess-tree · **Root:** repertoire-gap-selection · **Entry:** inline · **Blocked:** none
* **Where:** `src/utils/repertoire.ts:347` — `else if (!isUserTurn && !childHasGap)`.
* **Defect:** on an opponent node the position is only eligible to be a gap when **no** child
  subtree reported one. `childHasGap` is set by the loop above from any descendant at any depth. So
  an opponent move that is missing from the repertoire entirely, carrying the whole weight of
  `missing` for that node, is suppressed the moment one already-prepared sibling line has any
  unfinished continuation further down.
* **Why it matters:** the function's entire purpose is to rank gaps by how many games they
  represent. This inverts that ranking in the common case: a 500 000-game hole at move 1 is
  discarded in favour of a 10-game hole fifteen plies inside a line the user already knows. The
  `maxMissing` comparison below it never sees the larger candidate.
* **Found by:** an Antigravity CLI (`agy`) lens evaluation on 2026-09-06, reported by
  `gemini-3.8-flash-medium` (confidence 95) and `gemini-3.8-flash-high` (confidence 100); the
  branch was then verified by reading `src/utils/repertoire.ts:343-350`.

* **Handled:** 2026-09-09 in `d8220598`: opponent positions now compete by their own missing-games count regardless of descendant gaps. Removed the unused traversal boolean; preserved pruning, start-path exclusion, orientation parity and tie order. Entry revalidated as inline after tracing the producer, selector and caller; no governing decision changed the route.
* **Proof:** `pnpm exec vitest run src/utils/repertoire.test.ts` passes 14 tests. Four original regression cases failed before the fix. Additional deliberate mutations of game-threshold pruning, its equality boundary, coverage subtree pruning and user-node leaf eligibility each failed their regression, then passed after restoration. Scoped oxfmt, `pnpm exec tsgo --noEmit` and `git diff --check` pass. `pnpm test:e2e:container --project=board-keyboard` passes its screenshot (1 test); this is a board rendering check, while ranking behavior is covered by the unit tests. Full affected push gates follow this closure commit.
* **Review:** correctness and root-cause (Codex Luna/xhigh), plus tests, minimalism, code-quality and chess-semantics (Gemini 3.8 Flash high). Correctness/root-cause/chess-semantics approved without findings. Fixed the test lens's missing threshold, prepared-user-node and covered-subtree anchors; the prepared-user-node case is structural selector coverage, not a claimed live defect because the producer normally supplies missing=0. Fixed minimalism/code-quality's redundant isGap branching, shared mutable orientation fixture and misleading cross-scenario variable reuse; the latter was downgraded from blocker to readability. Skipped the claim that opponent/user position names must denote the move author: the production contract uses side to move. Consolidated repeated fixtures and corrected two fixture-position inconsistencies during integration. No unresolved Fix remains.
* **Review limits:** Gemini implemented and performed four detection lenses on the same model family as the code; Codex performed correctness and root-cause detection with family separation. Plan authorship and arbitration shared the Codex root context. Retained reports and mutation proof: `/tmp/chessfable-next-20260909/`. No new findings filed; separately recorded f-20260906-01 remains open.
<!-- ledger-meta {"command":"annotate","effect_lines":4,"effect_sha256":"c7fa501873dbecee68d83f184a36e753ab564b9eb25697dbc315e484b09e2aec","input_sha256":"6c6f062e3e306a9b5808dbd089753fa21a3ed81e186838a3104f7eced57afeb8","kind":"mutation-receipt","operation":"b10f4ccb90bc86e5a6f5e79029e681292b3f838dd59efdb587b3d1929101a6c6","options":{"section":null},"request_id_sha256":null,"results":["f-20260906-03"],"target":"f-20260906-03","v":1} -->

---

## 2026-09-06 — filed through the inbox spool

### A failed position query is indistinguishable from a fully covered position

* **ID:** f-20260906-04 · **Status:** handled · **Area:** chess-tree · **Root:** - · **Entry:** inline · **Blocked:** none
* **Where:** `src/utils/repertoire.ts:52-54` — the bare `catch { return { moves: [], total: 0 }; }`
  in `fetchPositionMoves`, consumed at `src/utils/repertoire.ts:119`.
* **Defect:** any failure of `searchPosition` — unreadable database, lock contention, a dropped
  handle — is swallowed and returned as a legitimate empty result. `computeCoverageForFen` then
  reads `total = 0`, takes the `total < minGames` branch and returns `{ coverage: 1, missing: 0 }`,
  which is the value meaning "nothing left to prepare here".
* **Why it matters:** the failure mode is silent and inverted. A database that cannot be read makes
  the whole repertoire report as complete, which is the most reassuring possible answer and the
  least true one. `.claude/rules/async-resource-invariants.md` requires typed errors mapped at the
  facade and failing the one item rather than fabricating a success value; a bare `catch` returning
  a neutral-looking literal is the shape that rule exists to prevent.
* **Fix shape:** distinguish "queried, no games" from "query failed" in the return type and let the
  caller mark coverage unknown rather than complete.
* **Found by:** an Antigravity CLI (`agy`) lens evaluation on 2026-09-06, reported only by
  `gemini-3.8-flash-high` (confidence 95); the catch and the `total < minGames` branch were then
  verified by reading the source.

Handled structurally rather than by a Bash allowlist: `scripts/leaf-launch.sh` runs the Claude read-only leaf through `scripts/agy-worktree-leaf.sh`, a throwaway detached worktree of HEAD carrying the checkout's uncommitted tracked diff and untracked files, so the `--restricted` file tools and every cwd-relative shell command (`pnpm bindings:check`, `cargo test`) land in a copy that is removed when the leaf ends. Measured on chessfable: `pwd` was the worktree, `git status` there showed the checkout's dirty file, the worktree was gone afterwards, the checkout unchanged; `leaf-launch.test.sh` pins it for Claude and agy. Residual, stated in `executor-profiles.md` §6: an absolute path into the checkout is still reachable from Bash, so it remains a policy boundary, now confined to a leaf that names the parent on purpose. Rejected: sandbox settings under `--restricted` (ignores settings files), a Bash allowlist (removes `git diff`), bubblewrap (more software; rule 6d). Decision d-20260906-01 in this ledger; commit named in the completion message.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"329802c0229032f6b429f32c22091baf073a160da31245c57f3effcb3b45157c","input_sha256":"a0bdabd19a40009dd5f8fc1bcf6ee752733d5550251e25b65870dc3f24552888","kind":"mutation-receipt","operation":"98f07e1bfda175a21494fe4d31f71725a081da97a57a7d3120e75bb099197d25","options":{"section":null},"request_id_sha256":null,"results":["f-20260906-04"],"target":"f-20260906-04","v":1} -->

Correction: the "Handled structurally …" annotation above and the earlier status flip to handled were misdirected. They describe agent-kit's f-20260906-04 (the Claude read-only leaf) and were written by a session whose shell stood in this checkout while it meant the kit's ledger. This finding, fetchPositionMoves swallowing a failed query, is untouched and stays open; nothing in it was investigated or fixed. Status restored to open in the same commit.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"f5545ae603a033e70828dff2ad83b8fc267fa6eca63f91292645096094c06a41","input_sha256":"6886cb0b11a83ecd6d8ed1a0ab38e089d11b6d066d7708054808862c18762678","kind":"mutation-receipt","operation":"f5291d2ab216659b3c60a384f9b278569a9b058df8ee60bdcba38090892b47ca","options":{"section":null},"request_id_sha256":null,"results":["f-20260906-04"],"target":"f-20260906-04","v":1} -->

* **Handled, 2026-09-09:** Implemented in a6d72a26: ordinary position-query errors propagate instead of becoming empty successful results; current repertoire failures notify through the existing error UI while stale/cancelled requests remain quiet. Five focused utility/component tests passed, including rejecting false coverage after a query failure.
* **Review provenance:** Plan authorship and arbitration shared root context. Codex detection used the same model family as phases 1, 2, 4 and the repairs; Gemini authored original phase 3. Final delivery gates follow these verified implementation records.
<!-- ledger-meta {"command":"annotate","effect_lines":2,"effect_sha256":"f52c98b4f062192b0b44a820731fbae5d76dfeaa6a856229651693b31d7334ea","input_sha256":"b4aa15b71c70751aa1e92abd94e394cd834a2ddddc8b8298121150960ac4b2a7","kind":"mutation-receipt","operation":"af5f834381fb53557405e0d15ca78a9274245264b780ae61e3cd5cd76901f0d9","options":{"section":null},"request_id_sha256":null,"results":["f-20260906-04"],"target":"f-20260906-04","v":1} -->

---

## 2026-09-06 — filed through the inbox spool

### `getTreeStats` counts the root of an empty tree as a variation

* **ID:** f-20260906-05 · **Status:** rejected · **Area:** frontend-ui · **Root:** - · **Entry:** inline · **Blocked:** none
* **Where:** `src/utils/repertoire.ts:373-374`.
* **Defect:** `total` is `tree.length - 1`, which correctly excludes the root, but `leafs` filters
  the same array for `children.length === 0` without that exclusion. On a tree with no moves
  `treeIterator` yields the root alone, so `total` is 0 while `leafs` is 1.
* **Why it matters:** cosmetic but wrong and user-visible — the panel reports "Variations: 1" for a
  game or repertoire that contains no moves at all. The two numbers are derived from one array and
  disagree about whether the root counts.
* **Found by:** an Antigravity CLI (`agy`) lens evaluation on 2026-09-06, reported independently at
  all three effort levels (`low` 92, `medium` 95, `high` 95); verified by reading the source.
* **Why rejected:** rejected 2026-09-06, same session, by the `$push` `review-correctness` lens
  (Codex, confidence 91), verified against the source before accepting. `total` and `leafs` answer different
  questions and are not required to agree. `treeIterator` yields the root deliberately
  (`src/utils/treeReducer.ts:36-43`); `total` counts move nodes while `leafs` counts terminal paths,
  and a game with no moves genuinely has one empty line. "Variations: 1, TotalMoves: 0"
  (`InfoPanel.tsx:67-75`) is a defensible reading, not a demonstrable defect. Three lens cells
  agreeing on it is evidence of a shared prior about what "variations" ought to mean, not of a bug.

---

## 2026-09-06 — filed through the inbox spool

### `pnpm bindings:check` rewrites `src/bindings/generated.ts` and refuses any receipt-backed gate running beside it

* **ID:** f-20260906-06 · **Status:** open · **Area:** gate-scripts · **Root:** - · **Entry:** inline · **Blocked:** none
* **Where:** `scripts/check-bindings.mjs` (runs the exporter, which writes the file unconditionally);
  `scripts/gate-receipt.mjs` `trackedFileMetadata` (snapshots size and mtime_ns of every tracked
  file); `.claude/skills/push/SKILL.md` "Cross-layer contracts" (names `pnpm bindings:check` with
  no ordering constraint against the receipt-backed gates).
* **Defect:** measured 2026-09-06 on atlas: after `pnpm bindings:check` on a clean tree,
  `src/bindings/generated.ts` has the same size and a new mtime; `cargo test` and
  `pnpm gates:contract:check` change no tracked file. So `bindings:check` running concurrently
  with any `pnpm gate:ensure <gate>` makes the receipt refuse with "tree changed during the
  gate" although the gate passed and the tree is byte-identical. That is exactly what happened
  twice on 2026-09-06 (session 546d8a14): the first refusal of `frontend-mutation` coincided
  with the session's own parallel backend gate script, whose last step was `bindings:check`
  (its log ended 08:08:52 while the frontend script was inside the mutation gate); in both
  rounds the agy lenses of that push also reported running `pnpm bindings:check` inside the
  checkout. The handoff blamed `cargo test` and the contract check; both are innocent.
* **Fix shape:** two parts. (1) `check-bindings.mjs` exports to a temporary path and compares,
  writing the tracked file only when it differs — then the check is read-only on a green tree
  and can never disturb a receipt. (2) The push skill states that no command that rewrites a
  tracked file (`bindings:check`, `bindings:generate`, `i18n:extract`, `format`) may run
  concurrently with a receipt-backed gate, and that the seven `gate:ensure` gates run
  serially against one another. Add a `gates:receipt:test` case: a tracked-file rewrite with
  identical bytes still refuses the receipt (documents the mtime rule that (1) then satisfies).
* **Found by:** Claude, agent-kit run of 2026-09-06 (executor tooling), measuring the
  refusal mechanism the chessfable handoff had asserted.

Precision, from the Codex review-correctness lens over ea65d4b1: the refusal is possible, not guaranteed. `gate:ensure` returns from a valid receipt without running the gate, and a cache miss refuses only when the rewrite lands between the receipt's two metadata snapshots. The defect stands: a tracked-file rewriter running beside a gate can refuse its receipt, and did twice on 2026-09-06.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"7b4e0553a758f03a2a18bc7c95ca59cd8afe7d81aca131def13d2a653d42c242","input_sha256":"b81e949c84adb75dc314dec4defa906cbd78c7504f140917a7b8d9f2de2001c3","kind":"mutation-receipt","operation":"1a63ce7f44898fef52f711f7ac43246ca4f509a1c5f0b7b0c66dc81352fee137","options":{"section":null},"request_id_sha256":null,"results":["f-20260906-06"],"target":"f-20260906-06","v":1} -->

---

## 2026-09-06 — filed through the inbox spool

### Download cancellation never reaches the download: `cancel_download` has no renderer caller and the three download flows discard their job id

* **ID:** f-20260906-07 · **Status:** open · **Area:** bindings-ipc · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/fs.rs:1233-1237` (`cancel_download` → `download_registry.cancel(&id)`), `src/hooks/useProgress.ts:75` (`clear()` → `tauri.clearProgress(id)`), `src-tauri/src/progress.rs:374-390` (`clear_progress`), `src/components/databases/AddDatabase.tsx:246-254`, `src/components/puzzles/AddPuzzle.tsx:97-105`, `src/utils/engines.ts:285-294`, `src/components/common/ProgressButton.tsx:62`.
* **Defect:** the only thing that aborts an in-flight download is the lease token that `download_file_core_control_with_integrity` selects on (`fs.rs:430`, `:495`, `:546`, `:601`), and the only command that cancels that token is `cancel_download`, bound as `cancelDownload` and called by nothing. What the UI calls instead, `clear_progress`, bumps the progress generation and emits a `Cancelled` item; it never touches `download_registry`, so the transfer keeps running to completion while the bar disappears. The three download call sites pass `crypto.randomUUID()` inline as the job id and discard it, and none passes `onCancel` to `ProgressButton`, so no cancel control is rendered for a download at all; the comment at `ProgressButton.tsx:62` ("Keep the running UI if native cancellation could not be acknowledged") describes a cancellation that never reaches the download. `git log -S cancelDownload -- src` shows only the generated binding (`75fa4fec`): the command never had a hand-written caller.
* **Why it matters:** a user who starts a multi-hundred-megabyte database or engine download has no way to stop it; the network and disk work continues after the UI says it was cancelled.
* **Fix shape:** retain the job id at the three call sites and pass `onCancel={() => tauri.cancelDownload(jobId)}`, or fold cancellation into the progress lease so `clear_progress` on a download-owned id cancels its token (one cancel path instead of two — the async-resource rule's "one operation type has one cancellation contract"). Which of the two is the design question that makes this `build`. Measured 2026-09-06 while working `f-20260830-25`, which leaves this command registered because it has a real consumer.
* **Found by:** Claude, 2026-09-06, probe over the eight unreferenced IPC commands (fallback probe on Claude while agy's quota was exhausted).

---

## 2026-09-06 — filed through the inbox spool

### Archive-installed engines are written mode 0600 on unix and nothing sets the execute bit: the default-engine install cannot launch what it installs

* **ID:** f-20260906-08 · **Status:** open · **Area:** engine-uci · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src/utils/engines.ts:275-297` (`installDefaultEngine`), `src-tauri/src/fs.rs:1492-1501` (`private_output_file`, `mode(0o600)` for every extracted zip/tar entry at `:1361` and `:1420`), `src-tauri/src/fs.rs:1503-1531` (`set_file_as_executable`, the only caller of `ResolvedPath::mark_engine_executable` at `src-tauri/src/infra/path_authority.rs:1414`).
* **Defect:** extraction deliberately drops archive mode bits (every file is created `0o600`) and `atomic_install_dir` preserves that mode. The command that restores the execute bit, `set_file_as_executable`, is registered and bound (`setFileAsExecutable`) but has **no renderer caller**: `installDefaultEngine` goes `downloadEngineArchive` → `registerInstalledEngineHandle` → `getEngineConfig`, and `getEngineConfig` is the first thing that spawns the binary. Launch execs the opened inode through `/proc/self/fd/N` (`path_authority.rs:592-597`), and exec permission is checked on the inode, so a `0600` binary fails with EACCES. The last renderer caller, `await commands.setFileAsExecutable(enginePath)`, was deleted in `3afed031` with the old path-based install flow; the capability flow never re-added it (`git log -S set_file_as_executable`: added `67021e65` "set downloaded engines as executable on unix", caller removed `3afed031`).
* **Why it matters:** on Linux and macOS the Engines → Add engine → default-engine card installs a binary that cannot be started. Engines registered before 2026-08-13, or picked through `issue_engine_binary` from a user-supplied executable, are unaffected, which is why nothing on this machine shows it.
* **Fix shape:** call `tauri.setFileAsExecutable(handle.id)` in `installDefaultEngine` between `registerInstalledEngineHandle` and `getEngineConfig` (the registered handle already carries `EngineInstall`, `path_authority.rs:2642-2647`), or — better long-term, one fewer IPC round trip and no renderer-ordered invariant — have `register_installed_engine` mark the registered file executable on unix itself and delete the command. Prove it by installing an archive with a `0600` binary under `pnpm verify:app` or a Rust test that registers and then execs. Measured 2026-09-06 while working `f-20260830-25`, which deletes the three superseded commands and leaves this one in place because it has a real consumer.
* **Found by:** Claude, 2026-09-06, probe over the eight unreferenced IPC commands (fallback probe on Claude while agy's quota was exhausted).

---

## 2026-09-06 — filed through the inbox spool

### Engine images never render: `LocalImage` builds a `blob:` URL the CSP `img-src` does not permit, and swallows the failure

* **ID:** f-20260906-09 · **Status:** open · **Area:** frontend-ui · **Root:** - · **Entry:** lens · **Blocked:** none
* **Where:** `src/components/common/LocalImage.tsx:14-23` (`URL.createObjectURL(new Blob(...))` at `:18`, the `.catch(() => setSrc(undefined))` at `:21-23`), `src-tauri/tauri.conf.json` `security.csp` (`img-src 'self' data: … https://…`, no `blob:`).
* **Defect:** measured 2026-09-06 in the real WebKitGTK window (release binary of `8bd44649`, WebDriver session): an `<img>` whose `src` is an object URL fires `securitypolicyviolation` with `violatedDirective: img-src`, `blockedURI: blob`, then `error`. Tauri 2.10.2 rewrites only `script-src` and `style-src` (`tauri-2.10.2/src/manager/mod.rs:78-100`), so nothing injects `blob:`. The policy was authored in `97c29add`; the consumer was rewritten to object URLs in `3afed031`; the two never met, and `LocalImage` reports nothing on failure — a blocked image is visually identical to no image (`EnginesPage` / `EngineSelection` cards show the fallback), and `readEngineImage` errors are swallowed the same way.
* **Fix shape:** two options, either of which is a five-line change plus a direct `LocalImage.test.tsx` (both existing consumers mock `LocalImage` — `EnginesPage.test.tsx:72`, `EngineSelection.test.tsx:64` — so no current test can observe it): (a) build a `data:${mimeType};base64,…` URL from the bytes, which the policy already permits and drops the `revokeObjectURL` lifecycle (narrower CSP, base64 in memory for a logo-sized image); (b) add `blob:` to `img-src`. Either way, surface the failure branch (`warn` from `@/platform/native`) instead of `setSrc(undefined)`. `pnpm verify:app` can prove the choice with an in-page image-load probe. Found while working `f-20260830-24`, whose plan carried this fix for two review rounds until seven lenses independently classed it as a separate defect; the measurement above is the evidence.
* **Found by:** Claude, 2026-09-06, WebDriver probe against the release build during the capability-surface build run.

---

## 2026-09-06 — filed through the inbox spool

### Both native sound lookups in `sound.ts` discard their rejection, so a rejected `soundResourcePath` or `getSoundServerPort` is indistinguishable from silence

* **ID:** f-20260906-10 · **Status:** open · **Area:** frontend-ui · **Root:** - · **Entry:** inline · **Blocked:** none
* **Where:** `src/utils/sound.ts` — the two `.catch(() => {})` handlers (Linux branch on `getSoundServerPort`, non-Linux branch on `soundResourcePath` after `e7445a8b`).
* **Defect:** `playSound` is fire-and-forget and both handlers swallow the normalised `TauriCommandError`, so a backend that rejects the collection, cannot name the resource path, or has no sound server leaves the user with silence and no log line. The non-Linux branch also retries the IPC on every move because a failure never populates `soundUrlCache`. Review lenses in the capability-surface run (`f-20260830-24`) proposed three different remedies across three rounds — a once-per-key `warn` through `@/platform/native`, a per-key failure latch, an unbounded set — and each was rejected by another lens as unbounded, unmandated, or an unhandled `warn` promise; the plan (`tasks/plans/2026-09-06-capability-surface.md`, rounds 8–11) froze the handlers unchanged and left the shape to this finding.
* **Fix shape:** one decision, applied to both branches: report once per process (or per `cacheKey`, bounded by the eight collections × three kinds) through `warn` from `@/platform/native` (the precedent is `src/state/utils.ts:34`, a bare call; note `warn` returns a promise that rejects when Tauri is absent, which matters only in tests where the module is mocked), and stop re-invoking the IPC for a key that already failed. Add the cases to `src/utils/sound.test.ts` under fake timers (the 75 ms throttle otherwise neutralises them).
* **Found by:** review-error-handling (Codex) over the capability-surface diff, 2026-09-06; carried by Claude Code.

---

## 2026-09-06 — filed through the inbox spool

### Three superseded IPC commands are still registered and bound: `get_file_metadata`, `get_opening_from_fen`, `get_puzzle_db_info`

* **ID:** f-20260906-11 · **Status:** open · **Area:** bindings-ipc · **Root:** - · **Entry:** inline · **Blocked:** none
* **Where:** `src-tauri/src/fs.rs` (`get_file_metadata`, `get_file_metadata_blocking`, `get_file_metadata_with_authority`, `pub struct FileMetadata`, tests at the `get_file_metadata` cases), `src-tauri/src/opening.rs` (`get_opening_from_fen`, `#[tauri::command]` only), `src-tauri/src/puzzle.rs` (`get_puzzle_db_info`), `src-tauri/src/main.rs` (their `use` lines, `collect_commands!` entries, and the `get_file_metadata` offload tuple in the BLOCKING_GATEWAY source scan), `src-tauri/src/infra/path_authority.rs` (`ResolvedPath::modified_seconds`, whose sole caller is `get_file_metadata_with_authority`).
* **Defect:** none of the three has a renderer or e2e caller (measured 2026-09-06: zero references to `getFileMetadata`, `getOpeningFromFen` (word-bounded), `getPuzzleDbInfo` outside the generated binding). `get_file_metadata` was superseded by `WorkspaceEntry.lastModified` from `list_file_workspace` (`src/components/files/file.ts`), its last caller removed in `3afed031`, and since `c4fc3002` it resolves under `EngineBinaryInspect`, a scope no UI reads a mtime for. `get_opening_from_fen` was superseded by `get_opening_from_fens` (`src/utils/chess.ts`, since `1f0b54b9`) — only its command attributes are dead, the function body is called by the plural. `get_puzzle_db_info` is a line-for-line duplicate of `puzzle_database_info_for_file`, which `list_puzzle_databases` uses; the renderer moved to `listPuzzleDatabases` in `3afed031`. They stay reachable by any injected renderer script for no benefit.
* **Fix shape:** delete the three commands with the collateral named above (keep `get_opening_from_fen`'s body, narrowed to `fn`; keep `resolve_engine_binary_for_inspection` and `file_exists_with_authority`; keep `PuzzleDatabaseInfo`), `pnpm bindings:generate`, then the cross-layer gates (`bindings:check`, backend and frontend sets). Backend coverage area floors have ~0.2 pp margin (`filesystem-native-boundaries`, `auxiliary-domain-services`), so deleting the covered `get_file_metadata` tests may red a floor; the admissible response is tests for uncovered production code in that area, never a lower floor. Sorted out of `f-20260830-25` by the capability-surface run (`d-20260906-06`), which deleted the three capability-management commands the finding names and left these because two review rounds classed them as beyond that mandate.
* **Found by:** Claude Code, 2026-09-06, probe over the eight unreferenced commands (`f-20260830-25`).

---

## 2026-09-06 — filed through the inbox spool

### No gate notices an exported IPC command without a renderer caller, which is how eight of them accumulated

* **ID:** f-20260906-12 · **Status:** open · **Area:** gate-scripts · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `scripts/check-tauri-command-boundary.mjs` (the contract-gate checker that already reads `src/bindings/generated.ts`'s neighbours and the renderer sources), `src/bindings/generated.ts`, `src/platform/tauri.ts` (a `Proxy` over `commands`, so every real call is `tauri.<name>(…)`).
* **Defect:** a Rust command stays registered, Specta-exported and renderer-reachable after its last caller is deleted, and nothing flags it: `f-20260830-25` counted eight such commands on 2026-08-30 (three deleted by the capability-surface run, two filed as unwired consumers `f-20260906-07`/`-08`, three filed as superseded). The class regrows silently with every renderer refactor.
* **Fix shape:** a checker rule that proves a *call*, not a mention — six review lenses in the capability-surface run measured that whole-word counting over `src/**` is satisfied by a comment, a mock key (`analyzeGame: vi.fn()`), a string or a type name. The honest shape is syntactic: parse `src/**/*.{ts,tsx}` for member accesses on the `tauri` facade (`tauri.<name>(`, or a destructured/aliased form the parser can resolve) and for `commands.<name>` in `src/platform/`, compare against the `async <name>(` methods of the generated `commands` object, and report each command with zero call sites unless an allowlist entry names the finding that owns the exception (`cancelDownload: f-20260906-07`, `setFileAsExecutable: f-20260906-08`); an allowlist entry whose command has gained a caller, or no longer exists, is itself a violation so the list cannot rot. Tests: an unreferenced command; a command referenced only in a comment / a mock / a string; a stale allowlist entry; the real tree clean. Filed rather than built in the capability-surface run because it is its own design (parser choice, facade shapes) and the lens contract asks that a plan review not absorb a separate design question.
* **Found by:** review-root-cause (Claude Opus fallback, round 2, and Codex, round 3) over the capability-surface plan, 2026-09-06; carried by Claude Code.

---

## 2026-09-06 — filed through the inbox spool

### Findings breadcrumb failure discards the captured cause
* **ID:** f-20260906-13 · **Status:** handled · **Area:** gate-scripts · **Root:** - · **Entry:** lens · **Blocked:** none

* **Where:** `scripts/findings.py:272-288`, canonical `~/Projekte/agent-kit/scripts/findings.py`, introduced here by vendored sync `33559689`.
* **Defect:** `append_drain_breadcrumb` captures subprocess stderr but catches every exception without retaining its cause. A missing/unreadable helper and a failed shell invocation both emit only `breadcrumb not written: <step-file>`. The successful ledger update is intentional; losing its auxiliary failure diagnosis is unnecessary.
* **Evidence:** On 2026-09-06, called the real vendored function through runpy with DRAIN_STEP_FILE pointing to a scratch path and DRAIN_BREADCRUMB_LIB pointing to a nonexistent scratch file. It exited 0 and emitted only `breadcrumb not written: /tmp/chessfable-native-reads-20260906/nonexistent-step`, with no missing-library cause. Error-handling lens confidence 96.
* **Fix direction:** Preserve nonfatal ledger success and exactly one useful warning while retaining a safe failure reason or captured helper diagnostic. Change the canonical kit producer and its missing-helper tests, commit it, then guarded-sync the vendored copy. Never edit this generated copy independently.
* **Related:** f-20260829-14 also concerned lost failure context, but in the separate atomic-write cleanup mechanism; no shared Root is established. f-20260830-15 governs canonical-copy parity and is already handled.
* **Why deferred:** This run implements the native-fs descriptor-read cluster. Breadcrumb diagnostics belong to shared agent-kit tooling and its separate test/propagation contract; the native correction does not depend on changing them.
* **Handoff:** `tasks/handoffs/2026-09-06-breadcrumb-failure-context.md`.

* **Handled (2026-09-06, Codex):** Guarded-sync the committed canonical agent-kit producer at `4eb4ff6` (consumer blob `3f9ce2e436da848dc400cf5d6409bae799f174ff`). Missing-helper and canonical helper write failures now retain the real cause and helper identity in one nonfatal, newline-terminated diagnostic bounded to 4096 characters. Canonical producer tests cover missing helpers, subprocess/OS failure, oversized diagnostics, and successful ledger mutation despite breadcrumb failure.
* **Verification:** `env -u KIT_ROOT pnpm findings:kit:check`, `pnpm findings:test` (3 passed), and `python3 scripts/findings.py check` passed. Root additionally exercised the actual consumer against a missing helper and the real canonical helper with a nonexistent destination parent; both retained `No such file or directory`, exactly one failure marker, and nonfatal return. Root probe: `/tmp/chessfable-path-ownership-OMFFz4/kit-consumer-probe.py`. No independent manual edit to the vendored source.
<!-- ledger-meta {"command":"annotate","effect_lines":2,"effect_sha256":"a1cf5d6957781767be6c1f1dcfc644fbeeb54eb43b4217af154c8b351d9bdb10","input_sha256":"c67c194cd06902d3323bcbc99eb348e6b313208a456dafe8fe823fa002b2bdb5","kind":"mutation-receipt","operation":"91307cbfe094d28888ef4f7d07e63f64ff7df0785f97d05d88a88a06978c9ed2","options":{"section":null},"request_id_sha256":null,"results":["f-20260906-13"],"target":"f-20260906-13","v":1} -->

Required final parity check detected newer committed canonical tooling. Guarded consumer sync cb74e755 integrates agent-kit 4c942a6 (producer findings.py blob b9de8c31f5d88ccd66ce5fa6b7c0b67c4f10c4fd): multi-reference decision trailers, receipt-preserving set-trailer, and locked scratch/claim cleanup. Root read both deltas; separate Luna/xhigh read-only verification passed 202 findings/citations/receipts tests (one existing skipped) plus 19 targeted claim/notification tests. Consumer byte parity, three atomic-write tests and findings validation passed. No project-specific change was added to the canonical consumer and no foreign producer work was committed by this run.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"461e062ee970d8389bd92b100514dea78f66e6347b48d6f149a6d87ae538ca3d","input_sha256":"949ab4c16fb2948bdb17a0a47053a6c47424020f694261862f53e8a8adb8df5f","kind":"mutation-receipt","operation":"ad9f198c2961bdca836ed45f9297d4bed985255a223d2731da7535e31f4fa83f","options":{"section":null},"request_id_sha256":null,"results":["f-20260906-13"],"target":"f-20260906-13","v":1} -->

---

## 2026-09-06 — filed through the inbox spool

### Saved engine-player settings hydrate through a human-only default schema and lose the selected engine

* **ID:** f-20260906-14 · **Status:** handled · **Area:** frontend-state · **Root:** - · **Entry:** lens · **Blocked:** none
* **Where:** `src/state/atoms.ts:453-469`, `src/state/utils.ts:48-73`, `src/components/boards/OpponentForm.tsx:20-36`.
* **Defect:** Both game-player setting atoms use `createPreferenceStorage(defaultPlayerSettings)`. Its generated object schema contains only the human default fields: it strips engine/go/engineSettings from stored engine-player records, or rejects a valid engine record lacking the default human name and repairs it to the human default. The next app start loses the selected engine and resource settings.
* **Proof:** Round-trip a valid engine OpponentSettings record through the two actual storage adapters, then pass it through toPlayerConfig; engine handle, go mode and resource handles must survive. Use a dedicated union schema rather than inferring the domain from the human default.
* **Review lens:** persisted-state.
* **Relation:** f-20260831-18 governs the separate engine-list storage adapter; no shared root is asserted. Found while tracing durable attachment owners for f-20260830-35/f-20260901-13. The owner-aware storage integration must preserve these existing persisted owner records, so the required domain-schema correction is included in that plan revision rather than left as a destructive ownership precondition.
* **Found by:** Codex root source trace after the engine-protocol plan lens identified game-player settings as additional durable attachment owners, 2026-09-06.

* **Final persisted-state review (2026-09-06, confidence 99):** OpponentForm updateType spreads branch-specific fields into the new type. Strict shared owner validation correctly refuses this lossy shape, breaking human-to-engine and engine-to-human saves. Root confirmed both branches. Construct exact target union branches with only shared fields retained, then test both directions through coordinator and reload. Required fix of this run's discriminated-union integration.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"f6c3bdb8e13e19d153e6f8979d466b02e32afa3cc6bb94f7e2e68def41a8328a","input_sha256":"8807e66624b507f9d044b8b59fa064142178d134ba1487e526cb82fd75a75642","kind":"mutation-receipt","operation":"06879a62a82ba2b30f165c4f4ad9af70bc179a0f0dcc5283ec00bf6cf4b453a9","options":{"section":null},"request_id_sha256":null,"results":["f-20260906-14"],"target":"f-20260906-14","v":1} -->

Final review repair completed in 88c1b7bb (tab transitions), 3de47fe2 (ordinary preference/report validation and safe failures), and c0016006 (exact opponent branches, legacy engine identity migration, shared startup snapshot and visible binary-path validation). Root read each complete package and retained proof in root-final-frontend-proof.log: 18 focused files / 137 tests and 49 related files / 317 tests passed, TypeScript and full lint:ci passed, all 16 locale catalogs pass extraction/completeness, diff check passed. The actual container Add Engine / Local validation screenshot also passed with both required errors visible and no native capability issuance. Earlier failed lint attempts were corrected before these commits (locale key order and unnecessary internal schema-message literals). Full task gates and actual native-app lifecycle verification still follow; these narrow claims do not substitute for them. Decisions d-20260906-12/-13 record the migration/failure contracts. Plan authorship and arbitration shared root context; detection ran on the same Codex family in separate sessions.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"04218074af88a9d65352faa49210581f3e58440aa5c368637305977f1abc7f4c","input_sha256":"4a2e2517e787868ac144ce73bb4345ec2cf0c305f09eeaee9ab1fc323042b2c7","kind":"mutation-receipt","operation":"dc36445e4565d0333d851e2f65e3b5152f5c553ba58e198e7d8faa0e59e7dd83","options":{"section":null},"request_id_sha256":null,"results":["f-20260906-14"],"target":"f-20260906-14","v":1} -->

---

## 2026-09-06 — filed through the inbox spool

### Saved game-player selection still submits an engine ID after that engine is permanently retired

* **ID:** f-20260906-15 · **Status:** open · **Area:** engine-uci · **Root:** - · **Entry:** lens · **Blocked:** none
* **Where:** `src/components/engines/EnginesPage.tsx:620-626`, `src/components/boards/EnginesSelect.tsx:17-27`, `src/components/boards/BoardGame.tsx:359-397`, `src-tauri/src/engine/process.rs:629-630`.
* **Defect:** Select local engine A as a game player, remove A in Engines, then start the game in the same session. Removal permanently tombstones application ID A, but EnginesSelect leaves an absent selected ID intact and BoardGame forwards it. The supervisor correctly rejects the retired ID, so the saved selection offers a game configuration that cannot start.
* **Fix direction:** Revalidate game-player selection against current engine identities; preserve the native retirement barrier from d-20260901-17 rather than unretiring a removed ID. Cover deletion with zero/other remaining engines and delete-then-start-game.
* **Review lens:** engine-protocol.
* **Related:** handled f-20260831-11 and f-20260901-07 established native termination on engine identity removal. Root remains absent: this is a missed renderer selection reconciliation, not unbounded native path authority.
* **Deferral:** Reported during plan review for f-20260830-35/f-20260901-13. Preserving attachment capabilities referenced by durable player records does not make a deleted executable identity runnable. This pre-existing engine-retirement/selection contract is separate from attachment release and remains its own file-set task; no native unretirement or game selection behavior is added to the attachment mandate.
* **Found by:** Codex engine-protocol plan lens, round 2, confidence 93; root verified the cited call chain, 2026-09-06.

---

## 2026-09-06 — filed through the inbox spool

### A saved download destination that is absent from native authority has no re-selection recovery

* **ID:** f-20260906-16 · **Status:** open · **Area:** frontend-state · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src/state/atoms.ts:142-148`, `src/components/home/AccountCard.tsx:205-210`.
* **Defect:** Persist a shape-valid download-destination-capability such as an ID whose native registry record is missing after registry loss/partial recovery. ensureDownloadDestination returns that ID solely because its shape is valid; subsequent native download resolution fails and the normal picker branch is never reached. This already occurs before any startup reclamation change.
* **Needed:** A bounded native-validity/re-selection recovery contract that distinguishes missing authority from offline/permission/other download failures; do not silently discard a valid offline destination or turn every backend error into a new picker. Prove reload with an unknown ID can recover, while a valid owned/offline destination is preserved.
* **Related:** handled f-20260831-15 covers picker rejection, not stale authority recovery. No shared root is asserted with unbounded-path-registry: that task preserves a known destination but cannot reconstruct a native path for an ID whose registry record is already absent.
* **Deferral:** Separate recovery design outside f-20260830-35/f-20260901-13. The startup sweep ignores already-unknown references to avoid blocking unrelated reclamation; it does not create this pre-existing invalid-reference state and will retain every known saved destination. AccountCard is not an implementation owner in that task.
* **Found by:** Codex persisted-state plan lens, round 4, confidence 96; main verified the stored-key/consumer chain, 2026-09-06.

---

## 2026-09-06 — filed through the inbox spool

### EditEngine validation bypasses existing translated messages

* **ID:** f-20260906-17 · **Status:** handled · **Area:** i18n · **Root:** - · **Entry:** inline · **Blocked:** none
* **Where:** src/components/engines/EditEngine.tsx:17-22; AddEngine.tsx:67-71.
* **Defect:** EditEngine returns raw English name-required, duplicate-name and path-required errors even in the German UI. The sibling AddEngine already uses Common.RequireName, Common.NameAlreadyUsed and Common.RequirePath for the same validation.
* **Fix:** Reuse those three existing keys, with an observable validation test. No catalogue or copy decision is needed.
* **Relation:** f-20260830-11/-19 concern dynamic missing confirmation keys; f-20260901-21 concerns native game-start errors. This is a separate literal-validation bypass, with no shared root asserted.
* **Disposition:** Fix in this run as a small separate commit after the attachment worker releases EditEngine ownership; do not overlap its source writes.
* **Found by:** Codex root while tracing the phase-2 EditEngine integration, 2026-09-06.

* **Root visual-proof trace (2026-09-06):** EngineForm's actual binary FileInput receives no form.errors.filename, while earlier Add/Edit tests rendered that error only in their mocked form. The shared validator prevents submit but the path error is invisible. Pass the error through the existing InputWrapperProps contract and prove both required messages in the real renderer's container screenshot journey, with no native picker invocation on empty submit.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"23bac577c4b916838cc27e3fc4e6d8a1e9ed015a2042a03ead4d6f500c90c6c2","input_sha256":"3fa8dc3ca0547475f2aacbcbb6d5066f81eff43f7516a11a2c713b3eb02decd5","kind":"mutation-receipt","operation":"98d7b196610247c8352723be78e6bbe5861c1e2fbb5f3fb6f008c7110a14b67d","options":{"section":null},"request_id_sha256":null,"results":["f-20260906-17"],"target":"f-20260906-17","v":1} -->

Final review repair completed in 88c1b7bb (tab transitions), 3de47fe2 (ordinary preference/report validation and safe failures), and c0016006 (exact opponent branches, legacy engine identity migration, shared startup snapshot and visible binary-path validation). Root read each complete package and retained proof in root-final-frontend-proof.log: 18 focused files / 137 tests and 49 related files / 317 tests passed, TypeScript and full lint:ci passed, all 16 locale catalogs pass extraction/completeness, diff check passed. The actual container Add Engine / Local validation screenshot also passed with both required errors visible and no native capability issuance. Earlier failed lint attempts were corrected before these commits (locale key order and unnecessary internal schema-message literals). Full task gates and actual native-app lifecycle verification still follow; these narrow claims do not substitute for them. Decisions d-20260906-12/-13 record the migration/failure contracts. Plan authorship and arbitration shared root context; detection ran on the same Codex family in separate sessions.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"04218074af88a9d65352faa49210581f3e58440aa5c368637305977f1abc7f4c","input_sha256":"4a2e2517e787868ac144ce73bb4345ec2cf0c305f09eeaee9ab1fc323042b2c7","kind":"mutation-receipt","operation":"4ccf253826ee1e251e0f709cdb8160fe8f6917951cdceda5d45e7f762b7fa8a8","options":{"section":null},"request_id_sha256":null,"results":["f-20260906-17"],"target":"f-20260906-17","v":1} -->

---

## 2026-09-06 — filed through the inbox spool

### Saving engine metadata discards existing engine options and resource owners

* **ID:** f-20260906-18 · **Status:** handled · **Area:** frontend-state · **Root:** - · **Entry:** inline · **Blocked:** none
* **Where:** src/components/engines/EngineForm.tsx:35-49; src/components/engines/EditEngine.tsx:15-17,32-37.
* **Defect:** EngineForm initializes its detected binary config to null, derives only required defaults from that config, and always submits `settings: settings || []`. EditEngine supplies an existing engine to this form. Editing only its name/image therefore replaces all existing options/resource handles with an empty array unless a binary was repicked; repicking still replaces custom options with only required defaults.
* **Evidence:** Root read the complete form submit and EditEngine initialValues/submit path on 2026-09-06. No original-value fallback or merge exists. The existing EditEngine tests mock EngineForm entirely and therefore cannot catch the loss.
* **Fix direction:** Preserve current settings for ordinary metadata/image edits. Apply newly detected defaults only at an explicit binary-change boundary with the intended existing contract, never as an unconditional submit-time replacement. Add an observable real-form submission regression with scalar and resource options.
* **Relation:** f-20260906-14 covers the separate human-default hydration schema loss; this is a form submit producer defect. No common Root is asserted. Necessary integration correction for f-20260901-13: the new owner reconciliation must not treat resources accidentally dropped by the producer as deliberately abandoned.
* **Disposition:** Fix in the active attachment phase before it can retire such falsely dropped owners. It is not deferred as pre-existing.
* **Found by:** Codex root integration review of phase-2 renderer handoff, confidence 99.

Handled in 739db8db, retained and reverified through c0016006. Ordinary EngineForm submissions preserve existing scalar/resource settings; only the current successful binary-detection generation applies required defaults. Root read the actual form regression and reran it in the final 18-file / 137-test focused suite and 49-file / 317-test related suite; both passed, along with TypeScript and lint:ci. The separate local validation screenshot passes without issuing native capabilities. No filesystem source resource is deleted by editing settings. Plan authorship and arbitration shared root context; detection ran in separate sessions on the same Codex family as the code.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"2f129eedeba649fd2e63bdf7f53148bab7ef4398f412dae73df875f6ce01c82a","input_sha256":"d4496d256836571638cbd1dd6d392d08cb961330c27889e4a53ee9243e1cefe3","kind":"mutation-receipt","operation":"069744bbb2f6e92ffe21bd83db24e524a30e6c4ae6c925e619c79578a359a354","options":{"section":null},"request_id_sha256":null,"results":["f-20260906-18"],"target":"f-20260906-18","v":1} -->

---

## 2026-09-06 — filed through the inbox spool

### Database child creation follows a swapped selected-root pathname

* **ID:** f-20260906-19 · **Status:** handled · **Area:** native-fs · **Root:** - · **Entry:** lens · **Blocked:** none
* **Where:** src-tauri/src/infra/path_authority.rs:3556-3575, create_database_child.
* **Defect:** database_root_path validates the selected root, then OpenOptions::create_new opens its joined pathname. Replacing that root with a symlink in between redirects creation of the renderer-requested .db3 outside the selected root. Registration refusal occurs after the mutation; error cleanup also removes by pathname rather than the checked parent identity.
* **Evidence:** Final tauri-security lens reported the validation/open gap at confidence 96; root read the whole function and confirmed the pathname create and cleanup. The behavior predates this task (lens attributes it to 97c29addc). Add a deterministic production-hook swap regression with an outside sentinel before correcting it.
* **Fix direction:** Create and clean up the exclusive single leaf through a verified descriptor for the selected database root, carry the created inode identity into registration, and preserve truthful durable/error outcomes. Do not expand capability scope or permit arbitrary path constructors.
* **Relation:** f-20260905-10 concerns bootstrap of AppDataDir before default-root materialization and remains a separate descriptor-producer design. This finding is an existing selected database-root consumer; no shared Root is asserted.
* **Disposition:** Fix in this run because the function and its descriptor/registration dependencies are loaded; give the adjacent correction its own commit.
* **Found by:** Codex Luna Extra High tauri-security final lens over 9330ef47..5b51fa6a, 2026-09-06.

Closed by 6422009f. Database creation now uses a retained parent descriptor with exclusive no-follow creation and sealed inode identity. Ordinary registration failures clean only the original identified leaf; substitutions are neither adopted nor removed, and combined cleanup failures remain visible. Committed durability uncertainty preserves the created database. Root reviewed the full production and test delta, then independently passed 159 path-authority tests, 55 filesystem tests (one existing ignored test), fmt, all-target check, Clippy with warnings denied and diff check. Proof: /tmp/chessfable-path-ownership-OMFFz4/root-db-final-proof.log and exit-0 sentinel. The separate AppDataDir bootstrap and non-Linux capability-port designs remain deferred.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"5b51ee7f1a43b83b03e950622ef11efc277b7b9f7dece2abef7290f6b4c262dd","input_sha256":"5f6420208cbbcb1f6bb051fb0ee8cef988d29dcf3a03d772c730525c5bf22235","kind":"mutation-receipt","operation":"d8acec4c990e9d757505d701fbfee86c85d01af31a1c6fa9dba267f998f2f145","options":{"section":null},"request_id_sha256":null,"results":["f-20260906-19"],"target":"f-20260906-19","v":1} -->

---

## 2026-09-06 — filed through the inbox spool

### Preference hydration throws when corrupt-value repair hits storage failure

* **ID:** f-20260906-20 · **Status:** handled · **Area:** frontend-state · **Root:** - · **Entry:** lens · **Blocked:** none
* **Where:** src/state/utils.ts:25-36, createZodStorage.getItem.
* **Defect:** Invalid JSON enters catch, which calls setItem outside any failure guard. A full or unavailable storage makes hydration throw instead of returning its fallback; initial getItem is also unguarded. Root confirmed both branches.
* **Fix:** Bound recovery to validated/default values, preserve raw bytes on failed repair and surface safe persistence failure through existing reporting. Keep legacy key encodings unchanged; test corrupt/read/repair/write failures and normal roundtrips.
* **Relation:** f-20260901-09 is the ReportModal consumer's absent domain validation; related but no shared root asserted. f-20260831-16 handles a separate tab-tree flush adapter.
* **Disposition:** Fix in this run with the already-loaded preference producer and ReportModal consumer.
* **Found by:** Luna Extra High persisted-state final lens, confidence 97, 2026-09-06; root verified.

Final review repair completed in 88c1b7bb (tab transitions), 3de47fe2 (ordinary preference/report validation and safe failures), and c0016006 (exact opponent branches, legacy engine identity migration, shared startup snapshot and visible binary-path validation). Root read each complete package and retained proof in root-final-frontend-proof.log: 18 focused files / 137 tests and 49 related files / 317 tests passed, TypeScript and full lint:ci passed, all 16 locale catalogs pass extraction/completeness, diff check passed. The actual container Add Engine / Local validation screenshot also passed with both required errors visible and no native capability issuance. Earlier failed lint attempts were corrected before these commits (locale key order and unnecessary internal schema-message literals). Full task gates and actual native-app lifecycle verification still follow; these narrow claims do not substitute for them. Decisions d-20260906-12/-13 record the migration/failure contracts. Plan authorship and arbitration shared root context; detection ran on the same Codex family in separate sessions.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"04218074af88a9d65352faa49210581f3e58440aa5c368637305977f1abc7f4c","input_sha256":"4a2e2517e787868ac144ce73bb4345ec2cf0c305f09eeaee9ab1fc323042b2c7","kind":"mutation-receipt","operation":"6088ba848cac61f83c75b2ca2b6a79ce6c5669fa0a79edf382d383c75041ad0c","options":{"section":null},"request_id_sha256":null,"results":["f-20260906-20"],"target":"f-20260906-20","v":1} -->

---

## 2026-09-06 — filed through the inbox spool

### Closing a board tab bypasses the transition boundary for the next active view

* **ID:** f-20260906-21 · **Status:** handled · **Area:** frontend-ui · **Root:** - · **Entry:** lens · **Blocked:** none
* **Where:** src/components/tabs/BoardsPage.tsx:88, closeTab; selectTab/cycleTabs share direct active setters.
* **Defect:** After native teardown closeWorkspaceTab synchronously changes the active view. The prior b829b562 protection wrapped next active selection in startTransition to avoid suspension during an urgent update; root read that historical diff and current caller. Existing duplicate/handleSetActiveTab retain transitions while close/cycle/select do not.
* **Fix:** One consistent React transition boundary for active selection/close and a real Suspense-sensitive close regression. Preserve awaited engine/game teardown and failure behavior; do not fold durable workspace transaction redesign into this correction.
* **Relation:** f-20260901-22 concerns native session terminal state, not React update priority; no shared root asserted.
* **Found by:** Luna Extra High persisted-state final lens, confidence 98, 2026-09-06. Fix in this run.

Final review repair completed in 88c1b7bb (tab transitions), 3de47fe2 (ordinary preference/report validation and safe failures), and c0016006 (exact opponent branches, legacy engine identity migration, shared startup snapshot and visible binary-path validation). Root read each complete package and retained proof in root-final-frontend-proof.log: 18 focused files / 137 tests and 49 related files / 317 tests passed, TypeScript and full lint:ci passed, all 16 locale catalogs pass extraction/completeness, diff check passed. The actual container Add Engine / Local validation screenshot also passed with both required errors visible and no native capability issuance. Earlier failed lint attempts were corrected before these commits (locale key order and unnecessary internal schema-message literals). Full task gates and actual native-app lifecycle verification still follow; these narrow claims do not substitute for them. Decisions d-20260906-12/-13 record the migration/failure contracts. Plan authorship and arbitration shared root context; detection ran on the same Codex family in separate sessions.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"04218074af88a9d65352faa49210581f3e58440aa5c368637305977f1abc7f4c","input_sha256":"4a2e2517e787868ac144ce73bb4345ec2cf0c305f09eeaee9ab1fc323042b2c7","kind":"mutation-receipt","operation":"f18981e2c2c6446cd916f92982d8a6a3b83df3e9a043414e0861b2b44e4c0eab","options":{"section":null},"request_id_sha256":null,"results":["f-20260906-21"],"target":"f-20260906-21","v":1} -->

---

## 2026-09-06 — filed through the inbox spool

### Closing a tab removes its tree before the durable workspace stops referencing it

* **ID:** f-20260906-22 · **Status:** open · **Area:** frontend-state · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** src/state/atoms.ts:110, closeWorkspaceTabAtom; src/state/workspace.ts storage adapter.
* **Defect:** tabStorage.remove and disposeTabAtoms precede set(workspaceAtom). If workspace envelope persistence fails, reload retains old metadata referencing a deleted tree and opens a blank game. Root confirmed current order.
* **Design:** Establish a durable lifecycle commit receipt across workspace metadata and tab-tree creation/removal; the related creation path f-20260901-05 seeds before metadata durability. Choose consistent create/close rollback and failure presentation together, preserving original tree until metadata removal is known durable. No standalone reordering that treats a swallowed adapter failure as success.
* **Relation:** f-20260901-05 is the live creation counterpart; f-20260831-17 handled startup ID migration only, not this live close path. No shared Root asserted against those recorded entries.
* **Disposition:** Defer to its own lifecycle transaction design run; changing the workspace API/receipt contract is a separate open design, not required by attachment ownership. React transition repair is separate and being fixed now.
* **Found by:** Luna Extra High persisted-state final lens, confidence 96, 2026-09-06; root verified.

---

## 2026-09-06 — filed through the inbox spool

### Practice positions and review history use unbounded raw localStorage

* **ID:** f-20260906-23 · **Status:** open · **Area:** frontend-state · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** src/state/atoms.ts:731, deckAtomFamily/practiceDataSchema; practice producers in src/components/panels/practice.
* **Defect:** positions and review-log arrays have no retention/admission bound and createZodStorage serializes raw JSON into the shared localStorage quota. Large repertoires or accumulated history can exhaust storage and lose durable practice progress. Root confirmed both unbounded arrays and raw writer.
* **Design:** Define durable practice storage and migration/admission across deck contents and review history without truncating user repertoire or silently deleting learning history. Retention of user history is not the same policy as disposable expansion UI state; do not invent an arbitrary array cap to green a test.
* **Disposition:** Defer to a dedicated practice persistence design run. Current generic preference failure repair will make failures handled but does not solve capacity; keep this finding open until capacity/retention and real large-deck/reload proof are addressed.
* **Relation:** f-20260831-18 handled engine metadata compression; this is a different owner and retention contract, no shared root asserted.
* **Found by:** Luna Extra High persisted-state final lens, confidence 95, 2026-09-06.

---

## 2026-09-06 — filed through the inbox spool

### Expanded-directory preferences accumulate without a session-storage budget

* **ID:** f-20260906-24 · **Status:** open · **Area:** frontend-state · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** src/state/atoms.ts:115, expandedDirectoriesAtom; workspace expansion consumers.
* **Defect:** An unbounded string array is persisted as raw JSON in sessionStorage, sharing capacity with tab trees. A sufficiently large expanded hierarchy can exhaust that quota and fail future persistence. Root confirmed schema/writer.
* **Design:** Specify disposable expansion-state retention/admission and its workspace identity lifetime, with legacy read compatibility and truthful storage failure handling. This is not permission to prune tab trees or user practice history to fit UI cache state.
* **Disposition:** Defer to its own expansion-state storage policy design; the generic preference error fix in this run is not a capacity solution.
* **Relation:** f-20260831-16 is tab-tree flush reporting; no shared root asserted.
* **Found by:** Luna Extra High persisted-state final lens, confidence 91, 2026-09-06.

---

## 2026-09-06 — filed through the inbox spool

### Changing puzzle workspaces destroys the saved database selection

* **ID:** f-20260906-25 · **Status:** handled · **Area:** frontend-ui · **Root:** - · **Entry:** lens · **Blocked:** none
* **Where:** src/components/puzzles/Puzzles.tsx:114-133, workspace/list refresh effect.
* **Defect:** Workspace change or a listing without the saved handle calls setSelectedDb(null), deleting the preference rather than deriving an inactive effective selection. Switching A to B and back to A loses the selected database. Root traced the effect and persisted-state rule; no contrary decision found.
* **Fix:** Preserve the stored choice, derive effective authority from the current successful workspace listing, and prevent stale/loading lists from authorizing theme or puzzle requests. Workspace change cancels/reset live practice; explicit confirmed deletion still clears its own persisted selection. Cover A-B-A, missing listing and concurrent selection/deletion.
* **Relation:** Puzzle theme effective selection already uses this rule, but database selection does not. No duplicate finding returned by related query.
* **Found by:** Luna Extra High persisted-state final lens, confidence 94, 2026-09-06. Fix in this run's puzzle lifecycle package.

Closed by c0f4b341. Puzzle selection is derived against the current successful root-specific listing without erasing the saved choice on root changes or failed lists; A/B/A restores selection and stale loads cannot overwrite current state. Explicit deletion clears only its matching saved selection, and a concurrent new database request survives an older delete result. Landed native deletion plus ordinary registry failure reports PartialRemoval so the UI converges. Root full diff review, 13 direct and 22 related renderer tests, 17 native puzzle tests and the full nine-test container screenshot suite passed. No coverage or existing screenshot baseline was relaxed.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"5a9a63eecafa83cfd5ceea1ad20490c1bc1644abc2c305bf02392958955bfec5","input_sha256":"cc220cc01e6d8107a5a5554ab8697e4b226d262cd68fc12193145c812a4f392d","kind":"mutation-receipt","operation":"ae5519de92cf7843274e1c9bcdadcf90748d24407401754b46273f5faf82601c","options":{"section":null},"request_id_sha256":null,"results":["f-20260906-25"],"target":"f-20260906-25","v":1} -->

---

## 2026-09-07 — filed through the inbox spool

### PGN quoted-movetext and percent escape regression assertions leave mutation survivors

* **ID:** f-20260907-01 · **Status:** handled · **Area:** pgn-import · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/pgn.rs:914-956`, tests of `update_brace_comment` and `scan_games_cancelled`.
* **Defect:** The existing quoted-movetext fixture places a semicolon before the literal brace, masking broken quote handling. Missing escaped-quote, closing-quote, quoted-semicolon and unmatched-brace percent-line cases leave six PGN survivors reported in Felix's approved 2026-09-07 repair request.
* **Related:** f-20260831-05 fixed semicolon scanning behavior; this entry records missing regression assertions, without reopening its production fix.
* **Repair:** Five shared LF/CRLF and BOM/no-BOM fixture groups, exact ranges and extracted bytes for successful scans, InvalidData for actual unterminated comments. Production behavior stays unchanged.
* **Verification:** Focused PGN tests and complete isolated pgn-parser mutation accounting with zero survivors, followed by delivered-revision CI artifacts.

Closed by the repair delivered and installed at f8df0140e6a99242de35100c2f4160a81fa0db45. Five shared LF/CRLF and BOM/no-BOM fixture groups assert exact successful ranges and bytes or InvalidData. Focused PGN tests: 25 passed. Final isolated candidate and delivered CI each account for 64 mutants: 61 caught, one unviable, two genuine test timeouts, zero survivors, with successful baselines. All six names missed in prior run 34020549919 are explicitly CaughtMutant in run 34082891426. All affected Rust and contract gates passed without ratchet changes. Full eight-package CI was inspected to completion; its separate four path-authority survivors are f-20260907-04, not a PGN failure. Evidence: tasks/handoffs/2026-09-07-backend-mutation-repair.md.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"05bb6f54c1a3088008f9f326067344b1680d07239d2e3afa6ddae6f5a5acca1d","input_sha256":"1eabe8bd678218c5e9468322295cb34e38404faff5477cfc51573f042cf43412","kind":"mutation-receipt","operation":"960887341911f824b14ed7a4502b8d176b83a2014e79ad0318ee493769dfee18","options":{"section":null},"request_id_sha256":null,"results":["f-20260907-01"],"target":"f-20260907-01","v":1} -->

---

## 2026-09-07 — filed through the inbox spool

### Database encoding mutation tests can allocate without a process memory bound

* **ID:** f-20260907-02 · **Status:** handled · **Area:** gate-scripts · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/db/encoding.rs:503-522`, `scripts/run-backend-mutation.mjs:239-258,335`.
* **Defect:** Three test collections exhaust the iterator rather than checking a bounded expected sequence. The mutation runner starts test executables without a memory limit, so an allocating decoder mutant can exhaust memory before a timeout. Felix's supplied prior probe found indefinite allocation while the ordinary encoding suite passed at 2 GiB. The historical runner-shutdown cause remains unproven.
* **Related:** f-20260829-09 protects the source tree with a mutation fence; it does not contain executable allocations.
* **Repair:** Bounded iterator assertions plus Linux encoding-only prlimit runner, forced native Cargo target and exact command-line runner, shared Rust metadata parser, fail-closed diagnostics, and caught/unviable output. Preserve the existing timeout and fence policy.
* **Verification:** Real dependency-free Cargo containment fixture with conflicting ambient target/runner settings and missing tools, existing contract tests, complete isolated encoding mutation accounting, and all delivered-revision CI package artifacts.

Closed by the repair delivered and installed at f8df0140e6a99242de35100c2f4160a81fa0db45. All three unbounded test collections use bounded next/None assertions. Linux encoding test executables run under the exact native Cargo target runner with a 2147483648-byte address-space limit and core limit zero; setup and baseline errors fail closed. Shared host parsing preserves pinned coverage selection. Real dependency-free Cargo fixtures prove conflicting target/runner configuration cannot bypass limits; all 48 runner and 27 coverage-report tests pass. Final isolated and CI encoding runs each account for 96 mutants: 91 caught, four unviable, one genuine test timeout, zero survivors; baselines pass all 15 tests. Four allocating decoder mutations retain allocation diagnostics and SIGABRT. The separately observed desktop core gap was repaired under f-20260907-03 before delivery. All affected gates passed. The historical CI shutdown cause remains unproven. Evidence: tasks/handoffs/2026-09-07-backend-mutation-repair.md and Mutation run 34082891426.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"5b51e8168efda542aadac6443fc7d15af79ea96b9b4bb2b25bb8d26d2da421cd","input_sha256":"a9d2283c5fd324b2613c15d54f3e2df9cf3c310495fa8a75d07dd841eca131f5","kind":"mutation-receipt","operation":"261921b2b3d9cb7ed538ab3a3f16fb5d9d52252a5224d7385faf2da38bda863e","options":{"section":null},"request_id_sha256":null,"results":["f-20260907-02"],"target":"f-20260907-02","v":1} -->

---

## 2026-09-07 — filed through the inbox spool

### Encoding mutation aborts create desktop crash reports despite zero core limit
* **ID:** f-20260907-03 · **Status:** handled · **Area:** gate-scripts · **Root:** - · **Entry:** lens · **Blocked:** none

* **Observed:** SIGABRT reports for PIDs 1989588 (2026-09-07 05:41:56 CEST, 20.9M core) and 2047128 (05:43:27, 873.8K core), both from the disposable /tmp/build-backend-mutation-20260907.sYCKNG/candidate encoding mutation executable.
* **Cause:** scripts/run-backend-mutation.mjs:267 configures prlimit --as=2147483648 --core=0. The memory bound catches allocating mutants, but RLIMIT_CORE does not suppress the piped collector. /proc/sys/kernel/core_pattern invokes /usr/local/sbin/coredump-filter, which forwards these binaries to systemd-coredump.
* **Evidence:** Candidate mutants.out/backend/database-encoding/mutants.out/log/src__db__encoding.rs_line_185_col_16_001.log and src__db__encoding.rs_line_227_col_24_001.log report allocation failures (268435456 and 2147483648 bytes), the exact prlimit invocation and SIGABRT. The first mutant changes cursor += 1 to cursor *= 1 in decode_game, preventing progress. Supplied stack offsets symbolize to std::alloc::rust_oom, __rust_alloc_error_handler and RawVec<DecodedGameNode>::grow_one. The baseline passed; cargo-mutants counted these mutants as caught and continued.
* **Related:** f-20260907-02 is the active memory-containment repair; this is the separate core-suppression gap in its candidate. Preserve the 2 GiB test-only bound and ongoing isolated run. No evidence here of an installed-app crash or system-wide memory exhaustion.
* **Fix direction:** Follow interactive-workflow rule 18d: call prctl(PR_SET_DUMPABLE, 0) inside the deliberately faulting Linux test executable after exec, check success, and scope this explicitly to mutation tests. Preserve stderr, exit status and ordinary application crash collection. A pre-exec wrapper or zero core limit alone is insufficient. No daemon or global suppression is needed.
* **Verification:** Exercise the real mutation launch path with a disposable aborting executable; confirm non-dumpability inside it, retained failure diagnostics, and no systemd core event. Confirm ordinary launches retain normal dumpability. The current scripts/run-backend-mutation-tests.mjs containment fixture only checks /proc/self/limits, which cannot prove this property.
* **Disposition:** Investigation only; another session owns the active candidate. Record for project queue pickup without editing its runner or production code.

The active backend-mutation repair adopts this finding before delivery. Root independently confirmed both allocation-failure logs and systemd core records. A bounded Sol/medium follow-up implements checked after-exec, explicitly mutation-only Linux test suppression; root owns review, proof, full gates and another complete isolated candidate run. The existing zero core limit is retained, but is no longer treated as proof against a piped collector.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"5f7233291e7d660c7f8a70b62d75dc3ef778637bcfb6e0206a502e9cdcd03627","input_sha256":"154cb2e0adb6fd857b10b5cff484429bdd095b1a066c7d5e479bdd6d025f8991","kind":"mutation-receipt","operation":"bd97e4c04c1ee857238fb110ec9a9662a471fc833c6e7fb84f550ca6dd2bbbcc","options":{"section":null},"request_id_sha256":null,"results":["f-20260907-03"],"target":"f-20260907-03","v":1} -->

Completed-run inspection extends the original two-report observation: journal records name four SIGABRT PIDs (1989588, 2047128, 2056259, 2068440), all for the isolated candidate encoding executable. The four corresponding allocation-failure logs are decoder mutations at 185:16, 227:24, 240:24 and 245:24. The complete pre-suppression run at 80d6cc8a passed its baseline and accounted for 96 mutants: 91 caught, four unviable, one genuine timeout, zero survivors. Its full reports are retained under /tmp/build-backend-mutation-20260907.sYCKNG/pre-core-fix-complete/backend/. This confirms memory containment while refuting zero-core-limit-only desktop suppression.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"e13e1e29e8879030dfee11a6a9197df05fc74a0d7099377cf3858eb08995803c","input_sha256":"b4231526e3b727fe40e4bf730f25e47c2203f0a9c2e93796c3482105200d5392","kind":"mutation-receipt","operation":"3e5951acc61e8d8e24398ab1ffcd512aed819ab583f977d0ff80e7352beac944","options":{"section":null},"request_id_sha256":null,"results":["f-20260907-03"],"target":"f-20260907-03","v":1} -->

Closed by f8df0140, delivered and installed. The Linux encoding mutation child receives an explicit suppression marker; other package children remove ambient marker contamination. Every encoding test checks PR_SET_DUMPABLE=0 and PR_GET_DUMPABLE=0 inside the executable after exec before exercising mutable code. This code is cfg(test); ordinary tests and application launches retain normal crash collection. The actual native Cargo/prlimit abort probe PID 2322402 reported dumpability=0, preserved its abort diagnostic and SIGABRT/Cargo exit 101, and produced no core journal event. A complete contained baseline passed 15/15: ordinary child 2492680 reported dumpability=1; protected child 2492706 reported 0 and SIGABRT, with no matching core event. Full candidate f8df0140 then completed 96/96 encoding mutants with zero survivors and zero candidate core journal events since its 2026-09-07T04:02:17Z run start; all four allocating decoder mutations were caught with allocation diagnostics and SIGABRT retained. Delivered CI reproduced 91 caught, four unviable, one genuine timeout and zero survivors. Root full gates and four Luna follow-up lenses completed; the stderr-before-status fix was adopted and a claimed exec-inheritance blocker was experimentally refuted. Evidence: tasks/handoffs/2026-09-07-backend-mutation-repair.md. Plan authorship and arbitration shared one context; detection ran on the same model family as the code.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"e0fe6fd6fd997fc298ea41eab903fdf262ae134774fe8e28f551cd982b6469ff","input_sha256":"d5aeeec8781cd9676bd48bd9619885ac49a628f6f63166a11a3ba6ec380d7224","kind":"mutation-receipt","operation":"7028ba89a24044c1ad00f155faea55aa4ee54a9027301cdbff4b72d01f65df60","options":{"section":null},"request_id_sha256":null,"results":["f-20260907-03"],"target":"f-20260907-03","v":1} -->

---

## 2026-09-07 — filed through the inbox spool

### Persisted authority shape validation has four surviving mutation cases
* **ID:** f-20260907-04 · **Status:** handled · **Area:** native-fs · **Root:** - · **Entry:** lens · **Blocked:** none

* **Observed:** Delivered-revision Mutation run 34082891426, job 101621461567, at f8df0140e6a99242de35100c2f4160a81fa0db45 completed path-authority with a successful baseline and 19/19 mutants accounted: 15 caught, four missed, no unviable or timeout cases.
* **Evidence:** Artifact backend-mutation-path-authority, mutants.out/outcomes.json and missed.txt. Survivors in src-tauri/src/infra/path_authority.rs::validate_persisted_shape: 5544:13 changes legacy_engine conjunction from && to ||; 5543:37 changes the EngineExecutable equality to inequality; 5558:13 changes purpose-shape rejection || to &&; 5558:17 deletes the legacy-engine negation. Local copy: /tmp/build-backend-mutation-20260907.sYCKNG/ci-artifacts/path-authority/mutants.out/. Run: https://github.com/felixabeck/en-croissant/actions/runs/34082891426.
* **Impact:** The selected infra::path_authority::tests suite does not distinguish these changes to legacy-engine authority acceptance and purpose/operation-shape validation. A production acceptance defect is not established by the survivor report alone.
* **Related:** f-20260830-35 previously handled path-registry operation validation and persistence. Related-area/file search found no existing entry naming these four survivors. The PGN/encoding repair changes neither this function nor its mutation selection.
* **Repair:** Trace persisted-entry acceptance and add direct positive and negative cases that distinguish canonical, historical-subset and exact legacy-engine operations from mismatched purposes or shapes. Verify each reported survivor is caught without weakening filters, production authority semantics or coverage floors.
* **Verification:** Focused infra::path_authority::tests, all affected Rust/contract gates, and a complete isolated BACKEND_MUTATION_PACKAGE=path-authority pnpm mutation:backend run with successful baseline, complete accounting and zero survivors. Review the sensitive authority boundary.
* **Disposition:** Deferred from the explicitly scoped PGN/encoding mutation repair; discovered while inspecting the required full eight-package delivered-revision workflow. No user decision is needed.

* **Handled (2026-09-07):** Commit `0f85706f` adds direct purpose-tagged acceptance and refusal cases to `infra::path_authority::tests`. Canonical engine operations, a historical database subset, and the exact tagged legacy engine set remain accepted; mismatched purposes, persistent class/directory shapes, and foreign operations are rejected. Production validation and mutation selection are unchanged. Entry remains `lens`; the scoped test gap needs no new design decision and preserves d-20260906-09.
* **Proof:** Focused suite: 161 passed. Full backend suite: 726 passed, one ignored; Rust fmt/check/clippy, backend coverage floors/ratchets, unconditional contract gates, kit parity and clean-diff checks passed. The complete isolated `BACKEND_MUTATION_PACKAGE=path-authority pnpm mutation:backend` run on `0f85706f` passed its baseline and accounted for all 19 mutants: 19 caught, zero missed, zero timeouts, zero unviable. Each of the four named survivors is caught. Artefacts: `/tmp/chessfable-f-20260907-04.xBDndf/mutation-artifacts/backend/path-authority/mutants.out/`; command log: `/tmp/chessfable-f-20260907-04.xBDndf/mutation.log`. An initial isolated baseline lacked ignored Tauri dist assets and tested no mutants; copying the existing build assets resolved that setup failure before the successful complete run. The detached checkout was clean after mutation and removed after preserving its artefacts.
* **Review:** Codex sensitive-rung correctness, root-cause, tests, code-quality and Tauri-security lenses approved. One code-quality naming suggestion was fixed and all affected gates rerun. Plan authorship and arbitration shared one context; detection ran on the same model family as the code, with session-level separation. No new finding, product decision, production acceptance change, filter exclusion or coverage-floor change was needed.
<!-- ledger-meta {"command":"annotate","effect_lines":3,"effect_sha256":"d95c82dbe2a437b6a94d55598127c624e2fa86156025523a1306f899439b122d","input_sha256":"b6b8a59084916a3b42ed69bcb57cc869ea180630477dc710c1841fd8f95c74a2","kind":"mutation-receipt","operation":"2eb4b673b4a0d0bb34c580498bf69aab6b9acf65023cf1bfd8d6bf34d891a830","options":{"section":null},"request_id_sha256":null,"results":["f-20260907-04"],"target":"f-20260907-04","v":1} -->

* **Final review repair and proof (2026-09-07):** The final multi-file range triggered the minimalism lens. Its accepted finding identified the existing `stored_entry_for` helper; commit `43ab3050` routes both new test fixtures and their adjacent structural-validation fixture through it without changing explicit operations or assertions. The lens approved the repair. All six applicable lenses are approved; plan authorship/arbitration and same-family detection retain the disclosure above. The focused 161-test suite and full affected gates passed again. A second complete isolated mutation run on `43ab3050` also passed its baseline and caught all 19/19 mutants, with zero missed, timeout or unviable cases. Final artefacts: `/tmp/chessfable-f-20260907-04.xBDndf/mutation-final-artifacts/backend/path-authority/mutants.out/`. The isolated tree was clean and removed after preserving evidence. This supersedes the earlier mutation run as proof of the final test implementation.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"7e5c3498f15ed5e6d13e768606756b14480db9ebe73a9df7bb7a4a60c2df6f56","input_sha256":"3a2756a4b0376ed2c6d6f0dd52860c0f43a6865bfd1341b266183111b0985454","kind":"mutation-receipt","operation":"f824ca1c527455a0bf86bcfd08113debca685c86a80ad3c03eeceef39a5e6c3b","options":{"section":null},"request_id_sha256":null,"results":["f-20260907-04"],"target":"f-20260907-04","v":1} -->

---

## 2026-09-07 — filed through the inbox spool

### Player statistics materialize every matching game and full move blob

* **ID:** f-20260907-05 · **Status:** open · **Area:** db-search · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** src-tauri/src/db/mod.rs:1851, get_players_game_info_blocking; GameInfo includes Vec<u8> moves and sql_query.load builds Vec<GameInfo> before Rayon processing.
* **Defect:** All matching game rows and their complete encoded move blobs coexist in memory, although opening lookup reads at most 55 mainline moves. A large personal database with most games matching one player therefore needs memory proportional to its move corpus, plus the accumulated SiteStatsData output.
* **Evidence:** The query selects games::moves at line 1829 and loads the full query at line 1851; the subsequent par_iter at line 1856 processes it only after collection. Review-pgn-index identified this while reviewing f-20260830-42.
* **Scope:** Design bounded query iteration and move-prefix handling together with the result accumulation contract; removing only the input Vec does not bound the returned per-game statistics. Preserve grouping, result orientation, progress and consumers in PlayerCard.tsx and Databases.tsx.
* **Why deferred:** Separate memory/query-result design outside the panic-binding mandate, under build plan-review MANDATE and push-review-policy section 4. Required-value binding does not depend on or worsen materialization.
* **Related:** f-20260831-06 handled whole-corpus PGN import/export buffers in this file, but did not change this statistics query. No shared Root assigned without evidence of one implementation cause.
* **Proof sought:** Real SQLite large-row/many-row fixtures and a measured memory bound, with identical statistics for both colors and missing optional fields.
* **Found by:** Codex review-pgn-index plan lens, 2026-09-07 (confidence 98).

---

## 2026-09-07 — filed through the inbox spool

### Real-app verification converts observation and cleanup failures into successful results

* **ID:** f-20260907-06 · **Status:** handled · **Area:** e2e-gate · **Root:** verification-harness-fails-open · **Entry:** lens · **Blocked:** none
* **Where:** scripts/app-driver.mjs Session.call, appProcesses and cleanUp; scripts/verify-app.mjs final cleanup and success reporting.
* **Defect:** Session.call catches invalid JSON as an empty object, so a successful HTTP status with a malformed body returns undefined success. appProcesses catches process inspection failure as an empty set. cleanUp discards post-SIGKILL wait failures and only logs surviving groups, so shutdown can resolve while processes remain. These are one evidenced failure mode: loss of observation/cleanup evidence becomes a successful harness result.
* **Why it matters:** this run uses the real-app verifier to prove the renamed native executable starts and cleans up. A verifier that discards protocol, monitoring or teardown failure cannot establish that proof.
* **Fix shape:** reject malformed WebDriver responses and process-inspection failures with context; make surviving groups fail cleanup and the verifier exit; retain best-effort cleanup of other resources; add executable failure-path regressions and route them through the contract gate.
* **Related:** f-20260830-50 shares app-driver.mjs but records an upstream Mesa teardown crash, not this harness reporting defect; no shared root is claimed. f-20260830-13 shares e2e-gate but concerns a separate modal flow.
* **Found by:** error-handling cumulative review during f-20260830-48 on 2026-09-07 (confidence 97–99), confirmed by root reading the concrete catch and cleanup paths. Fixing now in a separate commit because these files are already loaded dependencies of this run.

* **Resolution (Codex, 2026-09-07):** c45a33be rejects malformed/missing WebDriver envelopes, propagates process-inspection failures and makes failed teardown fail verification after attempting all owned cleanup. Response-body deadlines remain active without rejecting valid large screenshots. Executor and root independently passed the four harness tests and 60 routing tests; the full contract gate also passed. The real-app run is part of the final verification before this run pushes. Decision d-20260907-10 records the contract and reversal path.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"061a832e423c396a3d97b3d2e047a1918a6e9855972b25938a28bcc5b37b9eeb","input_sha256":"7d8fd606aa2d3b73e20c9b670e8a9f3eeb48bd3b23c963f72959b3d25dbf557f","kind":"mutation-receipt","operation":"94e78aa7802900e04d5813c4632076040f43060a06f6871b7f3a84d01eca94a6","options":{"section":null},"request_id_sha256":null,"results":["f-20260907-06"],"target":"f-20260907-06","v":1} -->

---

## 2026-09-07 — filed through the inbox spool

### Push workflow still orders final gates before review and omits drain stages
* **ID:** f-20260907-07 · **Status:** handled · **Area:** docs-agent-config · **Root:** - · **Entry:** inline · **Blocked:** none
* **Where:** `.claude/skills/push/SKILL.md`, `.agents/skills/push/SKILL.md`.
* **Evidence:** At 9e9c0584, section 2 explicitly reruns failed gates before review; section 4 commits after final gates, and neither route owns explicit drain stage records. Review repairs invalidate those earlier gates and leave the drain display without reliable state boundaries. ChessRiddle and the shared build workflow already have the settled review-before-final-gates contract.
* **Scope:** Align the canonical push order and bridge with that contract; preserve existing gates, ordinary push and local installer requirements.
* **Related:** f-20260906-06 concerns concurrent gate inputs in the same workflow; this finding concerns ordering and stage reporting, not generated bindings.

* **Resolution (2026-09-07):** The canonical skill now orders review and repairs, relevant browser verification and known commits before final gates and ordinary push. It owns balanced named drain stages and requires same-shell helper sourcing for every emission; the Codex bridge points to that contract. Final-gate repair loops and post-push coordination records retain their shared-policy paths. Existing gates and the local installer remain required.
* **Verification:** `node scripts/check-skill-bridges.mjs` and `git diff --check` passed. The final contract/parity gates and ordinary push are still required by the delivery workflow; this record does not claim those future outcomes. This documentation port has not been observed in a new drain run.
* **Review provenance:** Plan authorship and arbitration shared one root context; detection uses fresh Luna contexts on the same model family as the implementation.
<!-- ledger-meta {"command":"annotate","effect_lines":3,"effect_sha256":"faf98d9c232f17f680132a5c61b68084c08f55f4ffba5d86c8c5a154b6221feb","input_sha256":"fb391033a596f557712325ec16c0f09a4e25bca3c89ea7cdc5dcd89a4f8b662c","kind":"mutation-receipt","operation":"dba71d1aa52f370686179927b221709499c00eb92e9ffa8e36aa685963096093","options":{"section":null},"request_id_sha256":null,"results":["f-20260907-07"],"target":"f-20260907-07","v":1} -->

* **Review:** Fresh Luna/xhigh correctness and root-cause lenses approved without findings. Minimalism reported duplication of the full order in the Codex bridge; fixed by retaining the canonical pointer and genuine Codex attribution only, then inspected and rechecked. No unresolved Fix findings remain.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"923f3a02f6197a2a4b4afb6a9560fa4eb171c3456b77800cad261bf914e17f95","input_sha256":"69990c70102f3002e8035056cfc9a3b6029f9012ae6795c7a4dd2cfc541e8297","kind":"mutation-receipt","operation":"85918229dbb926d8d302ef3a5f11c1d5a64dea3c3849974ac8a69fde90a04fec","options":{"section":null},"request_id_sha256":null,"results":["f-20260907-07"],"target":"f-20260907-07","v":1} -->

---

## 2026-09-08 — filed through the inbox spool

### Search-cache lock reclamation can split a lock while a new waiter acquires it

* **ID:** f-20260908-01 · **Status:** open · **Area:** db-search · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/main.rs:346-379`, `src-tauri/src/db/search.rs:306-330`.
* **Defect:** `remove_generation_lock_if_idle` and `remove_collision_if_idle` check `Arc::strong_count == 2` before acquiring the DashMap entry guard. A concurrent `generation_lock`/`collision_lock` can clone the same Arc after that check but before `remove_if`, whose predicate checks only pointer identity. Removal then allows a third caller to create a second mutex for the same key while the second caller still owns the first. `SearchCache::clear` also clears these maps without honoring outstanding owners.
* **Why it matters:** generation and collision exclusion can disappear during a database/index operation. The lifecycle-retention plan review found these synchronous registries while reviewing the analogous async engine/game locks in f-20260830-52.
* **Design:** establish one atomic acquire/release lifetime contract for synchronous search locks, including cache clear/invalidation and the two cleanup guards; consider sharing the keyed-lease mechanism with the async engine/game registries while preserving synchronous blocking-worker semantics. The Tokio lease is not a drop-in for std::sync::Mutex and its poison/error paths.
* **Proof:** deterministic acquire-between-count-and-remove regression; outstanding waiter plus cache clear; concurrent final cleanup; distinct-key churn returns entry count to zero; run backend tests and all affected push gates.
* **Disposition:** Defer from the engine/game retention run: the database search invalidation/locking contract is a separate design question outside its fixed mandate. No source fix in that run.
* **Found by:** Sol/medium minimalism plan lens plus root source trace, 2026-09-08, confidence 94.

### Cancelling game construction after engine initialization leaves registered actors without a live game owner

* **ID:** f-20260908-02 · **Status:** open · **Area:** engine-uci · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/game.rs:1060-1268`, `src-tauri/src/engine/process.rs:958-961`.
* **Defect:** `spawn_registered` disarms its cancellation guard after protocol initialization. `start_game` then holds the returned actor through further awaits (second engine setup, old-session join, registration barrier), without an owner that terminates it if the construction future is cancelled. Dropping the controller does not call `terminate_exact`; the actor stays in EngineSupervisor and its process survives until global shutdown. This precedes the lifecycle-retention change in f-20260830-52.
* **Design question:** define transfer of cancellation ownership from per-engine initialization to game construction and then to the published LiveSession/loop. Existing cloneable RegisteredGameEngine handles are not ownership guards; adding Drop there can kill a still-shared actor. Decide an explicit construction transaction/guard and its exact handoff, including both players, replacement, event publication, and cleanup failure reporting.
* **Proof:** use initialized supervised actors, hold game registration or old-session teardown, poll construction to the blocked await, cancel, and assert exact generations are terminated and registry entries removed while unrelated/newer actors survive. Include the first-player/second-player boundary and publication handoff. Backend tests plus real-app lifecycle smoke and affected push gates.
* **Disposition:** Defer under build section 4 and push-review-policy section 4: this is a separate game-construction cancellation ownership design, not required to reclaim the three historical metadata maps in the fixed f-20260830-52 mandate. That run changes metadata publication ordering but does not claim to repair cancellation of engine construction.
* **Found by:** Sol/medium error-handling plan lens, 2026-09-08, confidence 94. Related d-20260901-30/-31 establish supervisor ownership and initialization registration, but do not settle ownership through later game construction awaits.

---

## 2026-09-08 — filed through the inbox spool

### Native game events discard transport failures without a delivery recovery contract

* **ID:** f-20260908-03 · **Status:** handled · **Area:** engine-uci · **Root:** native-game-event-delivery · **Entry:** build · **Blocked:** none
* **Where:** src-tauri/src/game.rs:768-784 emit_terminal_event and :2916 engine GameMoveEvent emission; renderer BoardGame post-adoption query is one-shot.
* **Defect:** terminal emission sets terminal_event_emitted before ignoring emit errors; engine move emission uses unwrap_or(()). An actual transport failure is neither observable nor retried/reconciled. If a surviving renderer misses an engine move or terminal transition, it can remain on stale state. Root verified both discarded Results; the trigger is an injected or actual emit failure, not demonstrated in the real app.
* **Root evidence:** both are native game snapshots published through best-effort Tauri emission without a common failure/recovery owner.
* **Design:** choose and verify a bounded native delivery/reconciliation contract across moves, clocks and terminal results, including logging, retry or authoritative resynchronization, and shutdown behavior. Merely resetting the terminal flag or logging cannot guarantee a later publisher runs after game completion. Do not introduce an unowned retry task.
* **Disposition:** Defer the separate native event-delivery design under push-review-policy section 4. The current f-20260901-22/23 repair handles renderer ownership, terminal snapshots, pre-adoption events, and stale continuations under existing delivery semantics; it does not redesign native transport reliability. Related f-20260908-02 concerns cancelled construction/engine ownership and has a different cause.
* **Found by:** cumulative error-handling lens over 065c8936, confidence 94 and 91, 2026-09-08. Plan authorship and arbitration shared root context; detection used the same model family as code.

* **Resolution (2026-09-09):** b8376fa8 adds bounded safe native delivery diagnostics and exact-owner periodic authoritative reconciliation. 913940b1 verifies actual warning records, retained state/clocks and per-occurrence publishing/shutdown routing. 968b55ed preserves recovery through failed close and owner replacement, retained tree annotations, and accepted move/auto-flip behavior when a newer poll beats the command response. Decisions d-20260909-02 and the native mainline-retention refinement document the contract and reversal paths.
* **Proof:** Root independently passed 907 native tests (one ignored), Rust fmt/Clippy, and 132 targeted renderer/tree/lifecycle tests plus typecheck/format/lint. Negative controls failed for dropped-event scheduling, missing warning emission, each of 29 publisher/cleanup occurrences, old endpoint pruning, missing owner outage reset, and accepted-command revision ordering. Nine pinned container UI tests passed with unchanged snapshots. The real Tauri harness passed all 23 lifecycle/IPC/shutdown assertions; a separate normal game probe confirmed native e2e4, rendered e4 and resignation result/New Game with cleanup.
* **Verification boundary:** Native emit-Err proof is helper injection plus fail-closed production-routing assertions, not a live AppHandle error. A supplemental live event-suppression probe cannot wrap Tauri's non-writable/non-configurable invoke and transformCallback properties. Deterministic renderer tests prove missed-event recovery; real-product proof covers normal game behavior and lifecycle. Evidence: /tmp/build-game-delivery-Ld40vB/. Full affected final gates run after this record.
* **Review:** Four plan rounds adopted 7/5/2/0 findings. Eight cumulative lenses produced 12 adopted Fix reports, all resolved, and one Skip for a redundant fixed-label table test; no deferrals. Plan authorship and arbitration shared root context. Codex detection shares family with existing code and quota repairs; Gemini authored the initial implementation, with prescribed Codex repairs after positively identified Gemini quota exhaustion.
<!-- ledger-meta {"command":"annotate","effect_lines":4,"effect_sha256":"370b8173bf5c88728764471dfeaaa2e682bf0e2627ec1c9630226b20332ad439","input_sha256":"d5660fb2f489945a0eb6c04586daad36c9813d6a9a1b70b33c6e728197aff4b5","kind":"mutation-receipt","operation":"a3fa05e7ec7c090c0dd36df9e5d7e87fe5c9b516eb8731f4d6160e31df36f304","options":{"section":null},"request_id_sha256":null,"results":["f-20260908-03"],"target":"f-20260908-03","v":1} -->

---

## 2026-09-08 — filed through the inbox spool

### File import materializes a complete PGN through a page-limited IPC command

* **ID:** f-20260908-04 · **Status:** open · **Area:** pgn-import · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src/components/tabs/ImportModal.tsx:81-87`, `src-tauri/src/pgn.rs` read-games range limit.
* **Defect:** Selecting a file calls `readGames(handle, 0, count - 1)` and joins the complete returned corpus before checking whether saving was requested. A file with 1,001 games exceeds the backend's 1,000-game page limit; a large corpus below that count is copied as one IPC payload and renderer string. Opening without saving performs that unnecessary complete read too.
* **Why it matters:** Routine large PGNs cannot be imported reliably and may allocate several corpus-sized copies, contradicting the streaming rule.
* **Design to settle:** Split opening the first game from saving a retained source file; choose a native streaming copy/publication operation that preserves existing destination metadata, authority and error semantics. Merely paging and joining on the renderer keeps the memory defect.
* **Related:** f-20260831-06 handled native scanner/index/export materialization, not this renderer whole-file import. No shared Root assigned: this is a different producer and requires its own native copy boundary.
* **Found by:** Codex PGN/index plan lens for f-20260904-05, confidence 99, confirmed by root source trace on 2026-09-08. Deferred as a separate import/copy design outside the cancellation mandate. Plan authorship and arbitration share the root context; detection ran on the family of the existing code.

---

## 2026-09-09 — filed through the inbox spool

### Engine archive publication passes a system-temp child to an installer requiring a target-parent sibling

* **ID:** f-20260909-01 · **Status:** open · **Area:** native-fs · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/fs.rs` — `download_engine_archive`, `private_tempdir`; `src-tauri/src/infra/path_authority.rs` — `ResolvedPath::atomic_install_download_dir`; `src-tauri/src/infra/fs.rs` — `unix::install_dir`.
* **Defect:** the command extracts into `private_tempdir()?.path().join("extracted")`, whose parent is a fresh system temporary directory, then passes that child to `ResolvedPath::atomic_install_download_dir`. The resolved destination is below the engine workspace. `unix::install_dir` opens both parent directories and rejects unless device AND inode match, returning `directory staging source must be in the target's real parent directory`. The final command publication therefore cannot succeed for an ordinary engine workspace, even after valid download and extraction. The internal zip/tar temp-to-temp installs use same-parent staging and do not prove the final command route.
* **Evidence:** source trace on HEAD `db8a07c5` plus current native-cancellation phase diff; `git blame` attributes the final system-temp command route to `016ec27a7` and same-parent installer check to `97c29addc`. This mismatch predates the current cancellation work; it is not a newly introduced cancellation failure. No real engine download was performed in this trace.
* **Required proof:** drive the real final archive command/core with a valid mocked archive and authority-resolved engine workspace, assert installed contents, then exercise prepublication failure/cancellation and exact staging cleanup without weakening parent/inode checks.
* **Design boundary:** choose an authority-preserving, lifetime-owned sibling staging representation; do not merely remove the same-parent guard or reopen an unchecked parent pathname. The separate staging-authority questions in `f-20260905-06` and `f-20260905-08` already need a design run. This functional failure is distinct from their allowlist/token questions and from `f-20260906-08` (installed executable mode).
* **Found by:** Codex root source tracing during the resumed native-blocking-cancellation build, 2026-09-09. Plan authorship and arbitration share root context; Codex detection shares family with phases 1/2/4, Gemini authored phase 3.

---

## 2026-09-09 — filed through the inbox spool

### An over-limit live workspace write replaces all saved tabs with the default workspace

* **ID:** f-20260909-02 · **Status:** handled · **Area:** frontend-state · **Root:** - · **Entry:** lens · **Blocked:** none
* **Where:** src/state/workspace.ts:109, workspaceFromValue and createWorkspaceStorage.setItem.
* **Defect:** The input schema rejects more than 100 tabs; live serialization converts that rejection into defaultWorkspace and persists it. A 101st tab can therefore erase the previously saved workspace on reload instead of rejecting the write safely.
* **Evidence:** Cumulative persisted-state lens, confidence 99; root traced the schema maximum and fallback. Origin 3afed031 predates the reviewed range. Related f-20260901-05 owns durable tab creation; this specific destructive validation fallback is separate.
* **Repair:** Preserve the last valid durable workspace when a live write fails validation, and make admission/error handling observable. Keep the existing bound; prove boundary writes and reload preserve existing tabs. Adopted for the active cancellation build's review repair.
* **Provenance:** Plan authorship/arbitration share root context. Codex detection shares family with phase 1/2/4 code; Gemini authored phase 3.

* **Handled, 2026-09-09:** Implemented in cc5b2c6e: invalid live workspace writes preserve the last durable value, and tab admission refuses the 101st tab without seeding or activating a nonexistent ID. Creation callers handle refusal. The existing 100-tab bound is retained. Workspace, atom lifecycle and caller tests passed in a 61-test focused run. The separate durable tab-creation contract f-20260901-05 is unchanged.
* **Review provenance:** Plan authorship and arbitration shared root context. Codex detection used the same model family as phases 1, 2, 4 and the repairs; Gemini authored original phase 3. Final delivery gates follow these verified implementation records.
<!-- ledger-meta {"command":"annotate","effect_lines":2,"effect_sha256":"2d23e1f5f921a75368c7380f5e480ff423810e17e018ffe898b16bcf579c14bd","input_sha256":"b985f7273a36fbfc0febdb8a5ea801d4ea8ab68c5389107138819b8d2fc57c76","kind":"mutation-receipt","operation":"51fdf2964b5f752d90d4df0f4a90a8c78bfe79624ce8030d221f11b0ec0e4385","options":{"section":null},"request_id_sha256":null,"results":["f-20260909-02"],"target":"f-20260909-02","v":1} -->

---

## 2026-09-09 — filed through the inbox spool

### Board layout persistence bypasses validation and write-failure handling

* **ID:** f-20260909-03 · **Status:** handled · **Area:** frontend-state · **Root:** - · **Entry:** lens · **Blocked:** none
* **Where:** src/components/tabs/BoardsPage.tsx:416, windowsStateAtom.
* **Defect:** Raw atomWithStorage accepts malformed or obsolete Mosaic pane IDs and lets quota-full writes reject without the application's persistence error path. Reload can render blank panes.
* **Evidence:** Cumulative persisted-state lens, confidence 98; root confirmed the raw adapter and unrestricted hydration. Origin 089e8ffd predates the reviewed range.
* **Repair:** Use the existing validated, canonical persistence adapter with a bounded layout schema and safe fallback/error reporting. Prove corrupt pane hydration and storage failure. Adopted for the active cancellation build's review repair.
* **Provenance:** Plan authorship/arbitration share root context. Codex detection shares family with phase 1/2/4 code; Gemini authored phase 3.

* **Handled, 2026-09-09:** Implemented in cc5b2c6e: board layout uses a shared bounded Mosaic schema and canonical storage adapter with corrupt-value fallback and write-failure handling. Layout tests cover invalid pane IDs and quota failure; the 61-test persistence/caller run and nine pinned container checks passed.
* **Review provenance:** Plan authorship and arbitration shared root context. Codex detection used the same model family as phases 1, 2, 4 and the repairs; Gemini authored original phase 3. Final delivery gates follow these verified implementation records.
<!-- ledger-meta {"command":"annotate","effect_lines":2,"effect_sha256":"116fd783e67a4bc5e28ce9f97b5120a726b1f0ec7a66d61b50f19ca49a79bab8","input_sha256":"3a0b373556fa026ab54f691d93c2a37087d6951186073b2c9c1c946a229b3605","kind":"mutation-receipt","operation":"3c8514b36e2c05f91577641a508513e944d47e9db0f2a71a8690ccad20638760","options":{"section":null},"request_id_sha256":null,"results":["f-20260909-03"],"target":"f-20260909-03","v":1} -->

---

## 2026-09-09 — filed through the inbox spool

### Puzzle and theme reads silently discard ordinary backend failures

* **ID:** f-20260909-04 · **Status:** handled · **Area:** frontend-ui · **Root:** - · **Entry:** lens · **Blocked:** none
* **Where:** src/components/puzzles/Puzzles.tsx:214 and :292, theme and puzzle request catch paths.
* **Defect:** A failed getPuzzle returns silently; getPuzzleThemes converts ordinary database or I/O failure into an empty list. Users receive neither a puzzle nor a useful failure notification, or see failure represented as no themes.
* **Evidence:** Cumulative error-handling lens confidence 99/97; root traced both catch paths. Origin 3afed031 predates the reviewed range; phase2 cancellation changes retained the behavior.
* **Repair:** Report current ordinary failures through existing error UI while preserving quiet cancellation, stale-request guards, and the established outdated-schema state. Add current-error and obsolete-error tests. Adopted for the active cancellation build's review repair.
* **Provenance:** Plan authorship/arbitration share root context. Codex detection shares family with phase 1/2/4 code; Gemini authored phase 3.

* **Handled, 2026-09-09:** Implemented in 87ff739f: current ordinary puzzle/theme failures notify while cancellation and obsolete requests remain quiet; the established outdated-schema state is preserved. All 21 puzzle component tests passed, including current and stale error cases.
* **Review provenance:** Plan authorship and arbitration shared root context. Codex detection used the same model family as phases 1, 2, 4 and the repairs; Gemini authored original phase 3. Final delivery gates follow these verified implementation records.
<!-- ledger-meta {"command":"annotate","effect_lines":2,"effect_sha256":"a26680b87c8d44c0e94e45d16516252c3141f483ca6fc8f67e3411cf2a6a1112","input_sha256":"2f35060d8abae3ccf12be61670fc6c03008814842a857643f8227564b3413cc6","kind":"mutation-receipt","operation":"833b0a784835ea8906221e555a8f4eb57b4da702986ea0908526d9d079a4624c","options":{"section":null},"request_id_sha256":null,"results":["f-20260909-04"],"target":"f-20260909-04","v":1} -->

---

## 2026-09-09 — filed through the inbox spool

### Partial position search ignores the colours of requested pieces

* **ID:** f-20260909-05 · **Status:** handled · **Area:** db-search · **Root:** - · **Entry:** lens · **Blocked:** none
* **Where:** src-tauri/src/db/search.rs:133, PositionQuery::Partial matching.
* **Defect:** The predicate checks piece-role bitboards but omits white/black containment. A white queen requested on d4 therefore matches a black queen on d4.
* **Evidence:** Cumulative PGN/index lens confidence 100; root inspected the predicate. Origin 97c29add removed the colour checks from ca2ed804 before the current reviewed range.
* **Repair:** Restore role and colour containment for every requested piece, preserving unspecified squares. Add opposite-colour and valid-partial regressions through production matching. Adopted into the active cancellation build's search review repair.
* **Provenance:** Plan authorship/arbitration share root context. Codex detection shares family with phase 1/2/4 code; Gemini authored phase 3.

* **Handled, 2026-09-09:** Implemented in 5fc49d4d: partial matching requires both role and colour containment while allowing unspecified pieces. Five focused native partial-match tests passed; removing colour containment failed the new regression before restoration.
* **Review provenance:** Plan authorship and arbitration shared root context. Codex detection used the same model family as phases 1, 2, 4 and the repairs; Gemini authored original phase 3. Final delivery gates follow these verified implementation records.
<!-- ledger-meta {"command":"annotate","effect_lines":2,"effect_sha256":"3134d6b1c4db9e67392775f99ba87be9eab5907fb6e68f9d2de5aa0c477a3bdd","input_sha256":"85e30b588f99eceaf72c9f78c76b3367d27553ef4f00b9d270ff13c45ef63ed4","kind":"mutation-receipt","operation":"46b92ebb54bb68b41f0c06de581c4e5a33ccb1da46c9144cb7207e92d9488194","options":{"section":null},"request_id_sha256":null,"results":["f-20260909-05"],"target":"f-20260909-05","v":1} -->

---

## 2026-09-09 — filed through the inbox spool

### Custom-start move numbering ignores the root FEN fullmove number

* **ID:** f-20260909-06 · **Status:** handled · **Area:** chess-tree · **Root:** - · **Entry:** lens · **Blocked:** none
* **Where:** src/utils/treeReducer.ts:95 and src/utils/chess.ts:479.
* **Defect:** Root halfMoves starts at zero or one based only on turn. From a Black-to-move FEN at fullmove23, the next move renders as 1...e5 instead of23...e5.
* **Evidence:** Cumulative chess-semantics lens confidence99; root confirmed defaultTree ignores fullmove number. Origin10a49bab predates reviewed range.
* **Repair:** Share root ply derivation from parsed FEN fullmove/turn for default and PGN-parsed trees; prove nonstandard White/Black starts and round trips. Adopted for active review repair.
* **Provenance:** Plan authorship/arbitration share root context; Codex detection shares family with phase1/2/4 code, Gemini authored phase3.

* **Handled, 2026-09-09:** Implemented in 2c8d2c07: shared root ply derives from the FEN fullmove and turn fields; hydrated legacy derived ply is normalized through every branch. Custom White/Black starts and PGN round trips are covered. All 46 focused numbering/chess/store tests passed.
* **Review provenance:** Plan authorship and arbitration shared root context. Codex detection used the same model family as phases 1, 2, 4 and the repairs; Gemini authored original phase 3. Final delivery gates follow these verified implementation records.
<!-- ledger-meta {"command":"annotate","effect_lines":2,"effect_sha256":"7df0ade32cc42435d358dcd1cd8ebacf16992b971bef2e211e17253c2007e4db","input_sha256":"60203a62452600e2c491b4569578503fb30c444820a864ded3d8b8311f4e8b25","kind":"mutation-receipt","operation":"96b2b7f135f4bc064b9e8f8ded5abee6034b9c1e677ec763c42e405c58fa7f69","options":{"section":null},"request_id_sha256":null,"results":["f-20260909-06"],"target":"f-20260909-06","v":1} -->

---

## 2026-09-09 — filed through the inbox spool

### Tree sibling mutations leave cursor and repertoire-start paths pointing at other nodes

* **ID:** f-20260909-07 · **Status:** handled · **Area:** chess-tree · **Root:** tree-path-rebasing · **Entry:** lens · **Blocked:** none
* **Where:** src/state/store/tree.ts:789–812, deleteMove and promoteVariation.
* **Defect:** Deleting a sibling rewrites an unrelated cursor index to zero, while surviving headers.start paths are not rebased on deletion or promotion. With branches e4/d4/c4, deleting d4 redirects the c4 cursor to e4; promoting c4 leaves its repertoire start referring to another branch.
* **Evidence:** Cumulative chess-semantics lens confidence99 for both manifestations; root traced splice, cursor assignment and missing start rebasing. Originse401958e/e125544e predate reviewed range.
* **Repair:** Share identity-preserving path rebasing for affected cursor/start paths after sibling deletion/promotion and update derived maps. Test before/after sibling and descendant paths. Adopted for active review repair.
* **Provenance:** Plan authorship/arbitration share root context; Codex detection shares family with phase1/2/4 code, Gemini authored phase3.

* **Handled, 2026-09-09:** Implemented in b82021ec: shared path rebasing preserves cursor and repertoire-start identity after deletion/promotion and refreshes derived maps. All 32 focused store tests passed, including sibling and descendant paths.
* **Review provenance:** Plan authorship and arbitration shared root context. Codex detection used the same model family as phases 1, 2, 4 and the repairs; Gemini authored original phase 3. Final delivery gates follow these verified implementation records.
<!-- ledger-meta {"command":"annotate","effect_lines":2,"effect_sha256":"df5380353e594b64f0eaea3116f8b1e88adb238c2ab183a0626bacc176244e4f","input_sha256":"fa8e584ea198c66105677a39c71c55b4a547aeed3ef0861251fdbe6bf3ca300b","kind":"mutation-receipt","operation":"4e1a07ffd61080282cc95c531300b461574ab0cd6d48b520ea8d26091a940e21","options":{"section":null},"request_id_sha256":null,"results":["f-20260909-07"],"target":"f-20260909-07","v":1} -->

---

## 2026-09-09 — filed through the inbox spool

### Practice-card deduplication treats FEN clock differences as different positions

* **ID:** f-20260909-08 · **Status:** handled · **Area:** chess-tree · **Root:** - · **Entry:** lens · **Blocked:** none
* **Where:** src/components/files/opening.ts:32, buildFromTree.
* **Defect:** Deduplication compares full FEN strings. Transpositions with identical board/turn/castling/en-passant but different clocks create separately scheduled cards for one repertoire position.
* **Evidence:** Cumulative chess-semantics lens confidence97; root confirmed full-FEN comparison violates the existing getBoardState identity rule. Originb279d5bf predates reviewed range.
* **Repair:** Use the existing canonical position identity and test clock-different transpositions plus genuinely distinct positions. Adopted for active review repair.
* **Provenance:** Plan authorship/arbitration share root context; Codex detection shares family with phase1/2/4 code, Gemini authored phase3.

* **Handled, 2026-09-09:** Implemented in 18f6a1a2: practice card generation and deck synchronization use canonical board identity rather than full FEN clocks. Both focused tests passed for clock-different transpositions and distinct positions.
* **Review provenance:** Plan authorship and arbitration shared root context. Codex detection used the same model family as phases 1, 2, 4 and the repairs; Gemini authored original phase 3. Final delivery gates follow these verified implementation records.
<!-- ledger-meta {"command":"annotate","effect_lines":2,"effect_sha256":"03c32dbf4ce8ea4abc4390276a00ef3830b110b443d5b63f9a9793d5068e6264","input_sha256":"3e0d5dc2df522852ff728e2d8ca20ce0a43401fb95704cc756493aa39ffd2901","kind":"mutation-receipt","operation":"c82dc3526f3190e25fe4090b8f1af120a812c3723d4f1a7b3f3d8bfbc6847943","options":{"section":null},"request_id_sha256":null,"results":["f-20260909-08"],"target":"f-20260909-08","v":1} -->

---

## 2026-09-09 — filed through the inbox spool

### Valid saved trees are rejected because the Zustand persistence version differs from the storage adapter
* **ID:** f-20260909-09 · **Status:** handled · **Area:** frontend-state · **Root:** - · **Entry:** inline · **Blocked:** none

* **Evidence:** `src/state/store/tabStorage.ts` validates and returns persisted tree envelopes with `TREE_STORAGE_VERSION = 1`, while `src/state/store/tree.ts` configured Zustand persist without a version (default 0). A focused production-store hydration regression reported `State loaded from storage couldn't be migrated since no migrate function was provided` and returned default root ply 0 instead of the saved custom root ply 45. Setting the matching version makes that regression pass.
* **Impact:** A valid saved game tree can reopen as the default tree instead of restoring its saved moves and metadata.
* **Repair:** Share the adapter's version with the Zustand store and prove valid stored trees hydrate, including legacy envelopes repaired by the adapter. This is being repaired in the resumed native cancellation build after its stale-report hydration regression exposed the defect.
* **Related:** f-20260904-09 concerns live report completion ownership; f-20260901-05 concerns durable tab creation. Neither is this version mismatch. f-20260831-21 shares the store file but concerns a separate analysis-array guard.
* **Provenance:** Root inspected both production boundaries; the Codex tree repair worker ran the failing/passing hydration regression. Plan authorship and arbitration share root context; detection and repair use the Codex model family, while original phase 3 used Gemini.

* **Handled, 2026-09-09:** Implemented in 33eb2614: Zustand persistence and the validated storage adapter share TREE_STORAGE_VERSION. Both actual-store hydration tests passed for current and legacy envelopes, restoring moves, headers, cursor and comments. Removing only the version configuration failed both tests; restoration passed.
* **Review provenance:** Plan authorship and arbitration shared root context. Codex detection used the same model family as phases 1, 2, 4 and the repairs; Gemini authored original phase 3. Final delivery gates follow these verified implementation records.
<!-- ledger-meta {"command":"annotate","effect_lines":2,"effect_sha256":"0defeca1fc3223d9e32e9c24c9052a1ab591a446bdbd260ebfaf8b4af18e0d20","input_sha256":"508035e49726a4b5af856f794da17287bbf69de965e21b31cfa3811ebd48b7cf","kind":"mutation-receipt","operation":"5ade37ee66f20c4cd3170f7e84c491b03ef07b0dd64aab4ae9b62725e78990cb","options":{"section":null},"request_id_sha256":null,"results":["f-20260909-09"],"target":"f-20260909-09","v":1} -->

---

## 2026-09-09 — filed through the inbox spool

### Atomic-file test temporary names leak across parallel tests

* **ID:** f-20260909-10 · **Status:** handled · **Area:** native-fs · **Root:** - · **Entry:** inline · **Blocked:** none
* **Where:** src-tauri/src/infra/fs.rs, unix::test_temp_names and set_test_temp_names.
* **Defect:** A process-global temporary-name queue supplies the collision test's names to unrelated atomic writers running on parallel test threads. The thread-local BreakCleanup injector searches its own parent for an .atomic- temporary file and can panic when its writer consumed another test's non-prefixed override instead.
* **Evidence:** Full instrumented run backend-coverage-repair-HDhX3W failed file_post_commit_and_cleanup_precedence_are_explicit at fs.rs:2956 (expect temp), while 900 other tests passed. Root traced the global queue and its sole setter in the collision test; injection ownership is otherwise thread-local.
* **Repair:** Bind temporary-name overrides to the invoking test thread, preserve collision behavior, and prove another thread cannot consume the override. Adopted into this build's gate repair, with a separate commit.
* **Related:** f-20260829-01 and f-20260830-01 concern earlier recursive-delete coverage and do not own this fixture race.
* **Provenance:** Plan authorship and arbitration share root context; Codex detection and repair use the same model family as the surrounding code.

* **Handled, 2026-09-09:** Commit 23ad1ce2 makes temporary-name overrides thread-local and scope-owned, with restoration on return and unwinding. The deterministic two-thread isolation regression failed against the former global queue and passed after restoration; collision, cleanup and isolation focused tests passed. Root instrumented suite passed 902 tests (one ignored), all backend coverage floors/ratchets, and all-target Clippy. No production filesystem semantics changed.
* **Provenance:** Plan authorship and arbitration shared root context. Codex detection and repair used the same model family as the surrounding code.
<!-- ledger-meta {"command":"annotate","effect_lines":2,"effect_sha256":"4584e9f1c53da125b1cd87ef131ebba815536b65881fea4f38a8fd7b97366fd5","input_sha256":"2c73e44092938c1a422b2caf92b5e036f3adcd55faed6292f95403b61495aae2","kind":"mutation-receipt","operation":"9ca3d7f5e4bc9268e6152e8111a7c51e2d757f3b213b817db5827c464e18d8b0","options":{"section":null},"request_id_sha256":null,"results":["f-20260909-10"],"target":"f-20260909-10","v":1} -->

---

## 2026-09-10 — filed through the inbox spool

### The local installer publishes a second desktop entry and splits the taskbar icon

* **ID:** f-20260910-01 · **Status:** handled · **Area:** gate-scripts · **Root:** - · **Entry:** inline · **Blocked:** none
* **Where:** scripts/install-local.sh, the DESKTOP path and the desktop-entry heredoc.
* **Defect:** The desktop entry's basename and StartupWMClass were derived from productName. The 2026-09-07 rename to ChessFable therefore published ~/.local/share/applications/ChessFable.desktop beside the older hand-maintained en-croissant.desktop instead of replacing it, and wrote StartupWMClass=ChessFable, which no window ever reports. The application menu lists ChessFable twice and the running window no longer groups under its pinned taskbar launcher.
* **Evidence:** A KWin script over workspace.windowList() on 2026-09-10 reported resourceClass en-croissant, resourceName chessfable, desktopFileName en-croissant for the live window: the Wayland app id follows argv[0], which is the bin/en-croissant compatibility link named by Exec, not productName and not the real binary. Both desktop files existed, with identical Name and Exec; the ChessFable.desktop mtime matches the 2026-09-09 install.
* **Repair:** Derive the entry basename and StartupWMClass from mainBinaryName, launch bin/chessfable directly so app id, entry name and WMClass are one string, and retire any other desktop entry whose Exec points into the install root so a later rename cannot leave a duplicate. Retire the tuxedo-config en-croissant module, which owned the older entry, and repoint the Plasma launcher.
* **Related:** No sibling finding covers the installer's desktop publication.

* **Handled, 2026-09-10:** Commit edb5eb1a derives the desktop entry basename and StartupWMClass from mainBinaryName, points Exec at bin/chessfable, and retires any other regular-file entry whose Exec points into the install root; d-20260910-01 records why. The metadata of the retired hand-maintained entry (GenericName, Comment, StartupNotify, BoardGame) moved into the generated entry so consolidating the two loses nothing Felix could see. The retirement unlink is best-effort: current and the entry are already published at that point, so a permission-denied unlink is reported instead of aborting a completed install through set -e.
* **Verified on tuxedo-atlas, 2026-09-10:** After `bash scripts/install-local.sh` at dab5a60e the installer printed "retired superseded desktop entry .../ChessFable.desktop" and published chessfable.desktop, which passes desktop-file-validate. Exactly one file across every XDG applications directory now declares Name=ChessFable. A KWin script over workspace.windowList() reports the relaunched window as resourceClass chessfable, resourceName chessfable, desktopFileName chessfable, against en-croissant/chessfable/en-croissant before the change. The dangling ~/.local/share/applications/en-croissant.desktop symlink was removed by hand, and all three Icons-Only Task Managers were repointed from applications:en-croissant.desktop to applications:chessfable.desktop through org.kde.PlasmaShell.evaluateScript; panel-launcher-sync --status reports the three lists identical. A full-screen capture shows a single ChessFable icon in the taskbar, with the running window grouped into its pin.
* **Out of repository:** tuxedo-config commit 497733d retires the en-croissant module that owned the older entry and moves the launcher-matching knowledge into panel-launcher. The installer cannot retire a symlinked entry or a Plasma pin by design; CLAUDE.md now states that limit.
<!-- ledger-meta {"command":"annotate","effect_lines":3,"effect_sha256":"ad95c79a0687660de81eefddebc5d6e62e621252dd2b207e98e45555e979ee8e","input_sha256":"8ee9bfd118792443381e924255c944df1373ff6412b0b3cf16b23271d490e182","kind":"mutation-receipt","operation":"24c1535124b452f66249887b620e29d94bbbbafaeaf3474e3c1c5a3c92287d11","options":{"section":null},"request_id_sha256":null,"results":["f-20260910-01"],"target":"f-20260910-01","v":1} -->

---

## 2026-09-10 — filed through the inbox spool

### `app_started` telemetry was emitted after startup had been cancelled

* **ID:** f-20260910-02 · **Status:** handled · **Area:** app-startup · **Root:** - · **Entry:** inline · **Blocked:** none
* **Where:** `src/App.tsx` (`useAppStartup`, the `telemetryEnabled` block).
* **Defect:** the startup sequence read `analytics.capture("app_started", { version: await
  getVersion() })` and only then checked `signal.aborted`. The cancellation check therefore sat
  *after* the emit, so a startup torn down while the version was being read still reported the
  application as started. This is the class `.claude/rules/async-resource-invariants.md` names by
  its own incident (`06c23b6a`, search cancellation checked after the progress emit): a cancel flag
  checked after the emit is not cancellation.
* **Found by:** the `review-error-handling` lens (confidence 88) during the `$push` review of
  `f-20260829-03`, which had just added the first tests over this file. The test written for the
  cancellation path had asserted the capture *did* fire — it pinned the defect rather than
  catching it.
* **Related:** `f-20260829-03`, whose coverage work surfaced this. Filed separately so the incident
  class is findable under its own mechanism rather than inside a coverage-gap closure.

* **Handled 2026-09-10, in the same session that filed it.** `src/App.tsx` now reads the version,
  checks `signal.aborted`, and only then emits: `analytics.enable()` still runs, because it is a
  configuration toggle rather than a report, but a cancelled startup no longer captures
  `app_started`. The standalone cancellation check that followed the telemetry block was removed
  with it — measured as dead for the `telemetryEnabled === false` branch, where no `await` sits
  between the post-`attachConsole` check and `getMatches()`.
* **Proof:** `src/App.test.tsx`'s "does not report a start when cancellation lands while the version
  is read" asserts `enable` fired and `capture` did not. Restoring the old order (capture before the
  check) turns exactly that test red; measured by hand.
<!-- ledger-meta {"command":"annotate","effect_lines":9,"effect_sha256":"508eeebe8129afe6752191af35beadeda7f01e2f4ad6f831682fee3710ead688","input_sha256":"7852420b66efbde66be18ef3a8e4e646ffa729a30de7020736e5fac1b8ad8d9f","kind":"mutation-receipt","operation":"4de5d9329097b81e8a492e5de0b03214b130f6ecbe982214d41dbdea8464d321","options":{"section":null},"request_id_sha256":null,"results":["f-20260910-02"],"target":"f-20260910-02","v":1} -->

---

## 2026-09-10 — filed through the inbox spool

### Accent colour radio labels expose raw translation keys

* **ID:** f-20260910-03 · **Status:** handled · **Area:** i18n · **Root:** dynamic-translation-extraction · **Entry:** lens · **Blocked:** none
* **Where:** `src/components/settings/ColorControl.tsx:29`, `i18next.config.ts`, all `src/translation/*.json`.
* **Defect:** the accent-colour radio label interpolates `t(`Settings.Appearance.AccentColor.${color}`)`. The Value template is translated, but no colour-name keys exist, so its accessible label includes the raw translation key even in English.
* **Evidence:** `Object.keys(theme.colors)` drives the dynamic lookup; the only matching catalogue keys are the group title, Desc and Value. The prefix is not preserved by extraction. Same causal chain as f-20260830-11 and the board-label finding: dynamically constructed keys are invisible to extraction, with consistently absent keys invisible to completeness. That evidenced mechanism is the shared Root.
* **Fix:** make the current theme's colour names extractable and translated in every locale; retain existing colour selection and light/dark behaviour. Run review-tests over real-catalogue accessibility assertions.
* **Proof:** extraction followed by assertions covering every current theme colour in all shipped locales, with no raw key or English fallback; settings-responsive container scenario and affected frontend push gates.
* **Deferred from:** the confirmation-localization plan inventory; settings colour controls are a distinct file set from confirmation handling.

* **Handled:** implemented in 9b6b0eb0 under d-20260910-05. Fourteen literal colour-name calls survive extraction; all 16 shipped catalogues contain translated values. Existing selection and light/dark shades remain intact. The separate board slice f-20260910-04 stays open at lens tier.
* **Proof:** `pnpm i18n:extract`, `pnpm exec vitest run src/components/settings/ColorControl.test.tsx`, and `pnpm i18n:check` passed. Baseline catalogue test failed on the absent be-BY dark key. The strengthened test fails when every click is mutated to select red, then passes after restoration; it covers all 14 colours, 16 locales without fallback, both schemes and every colour selection. `pnpm test:e2e:container --project=settings-responsive` passed both scenarios; existing snapshot unchanged, new wide-view swatch capture retained in `artifacts/frontend-audit/test-results/`.
* **Review:** correctness, root-cause, tests, code-quality and minimalism lenses completed. One test-coverage finding was Fix: every colour now gets click-and-rerender selected-state assertions. No unresolved findings; inherited ledger commit 310f595b was included and had no findings. Plan authorship and arbitration shared one context; detection ran on the same model family as implementation.
* **Rejected alternative:** extractor prefix preservation or English fallback, as recorded in d-20260910-05. Final affected push gates and installed SHA are reported by the completing root session.
<!-- ledger-meta {"command":"annotate","effect_lines":4,"effect_sha256":"32068294f19bf3aea1223340c7dd53e46e587c387bbc6a9dc64ca66530e50d2e","input_sha256":"d29088fdc5345dc9dfa262185b8ba5944b0939e70b73b1233873f405ee24c53e","kind":"mutation-receipt","operation":"e09967488d58876d056bbdcc9e7d11ce675d15a75c42fd2f759511438c0bfd2e","options":{"section":null},"request_id_sha256":null,"results":["f-20260910-03"],"target":"f-20260910-03","v":1} -->

### Board square labels use untranslated piece and colour names

* **ID:** f-20260910-04 · **Status:** handled · **Area:** i18n · **Root:** dynamic-translation-extraction · **Entry:** lens · **Blocked:** none
* **Where:** `src/components/boards/Board.tsx:354-355`, `i18next.config.ts`, all `src/translation/*.json`.
* **Defect:** `accessibleSquareLabel` constructs `Board.Aria.Color.${piece.color}` and `Board.Aria.PieceType.${piece.role}`. Neither family has catalogue entries or a preservation pattern, so square labels use English chessops colour/role names in every locale.
* **Evidence:** the production calls supply `piece.color` and `piece.role` as default values; inspection of all catalogues found no family entries. Same causal chain as f-20260830-11: dynamic keys are invisible to extraction and the completeness comparison cannot detect consistently absent keys. The shared Root with the accent-colour finding denotes this exact extraction mechanism.
* **Fix:** use extractable finite colour/role translation calls and translate every shipped locale. Preserve the board keyboard and chess semantics. Run review-chess-semantics over the repair.
* **Proof:** run extraction before real-catalogue assertions for both colours and all six roles in every locale; prove those assertions fail on the old calls after extraction. Run the board-keyboard container scenario and affected frontend push gates.
* **Deferred from:** the confirmation-localization plan inventory; board accessibility is a distinct file set from the two confirmation findings.

* **Handled:** a76e0762 replaces dynamic colour/role keys with exhaustive literal translation calls in the existing board accessibility module. Both colours and six roles are translated in all 16 shipped catalogues; piece/side and bottom-orientation templates avoid adjective-agreement defects. Board keyboard and chess semantics are preserved.
* **Entry revalidation:** retained lens tier. docs/localization.md and d-20260910-04/05 already settle finite-message extraction; d-20260901-36 concerns BoardGame test loading and does not reopen this question. No extraction preservation prefix was added.
* **Proof:** root ran pnpm i18n:extract then pnpm exec vitest run src/components/boards/boardAccessibility.test.ts. Restoring only the old dynamic producer calls/defaults removed all eight colour/role keys during extraction and failed two tests (missing Board.Aria.Color.white; raw white instead of Belarusian белыя). Restoring the repair and re-extracting passed 4/4 tests. Logs: /tmp/f-20260910-04-run/extraction-negative-tests.log and extraction-positive-tests.log. Separate fixed-string tests also failed on old grammatical composition and passed after catalogue repairs. pnpm lint:ci and pnpm i18n:check pass across 16 locales.
* **Browser proof:** pnpm test:e2e:container --project=board-keyboard passes with the unchanged screenshot, inspected by root. Assertions cover both colours, every role, empty/selected squares and white/black orientation. Added flip assertions follow the existing snapshot checkpoint; running them before it perturbed the scrollbar by 12 pixels, so no snapshot was rewritten. No native GTK check is needed for this label-only change.
* **Review:** six read-only lenses (correctness, root-cause, tests, minimalism, code-quality, chess-semantics). Fixed malformed piece/orientation grammar, added fixed localized-string assertions and exact full-role browser wiring coverage. Rejected the test-extraction-seeding blocker with the installed extractor and the full negative probe: no colour/role keys are extracted from the tests. Kept the small private role-name helper as readable composition rather than stylistic inlining. All Fix items resolved. Plan authorship and arbitration shared one context; detection ran on the same model family as the code, with session separation only. Initial source/grammar work ran on Luna; mechanical E2E assertions ran on Spark.
<!-- ledger-meta {"command":"annotate","effect_lines":5,"effect_sha256":"119b114b44ef19b3e8730b8c6500a560d60efa2c5ab541a0c4dbf71a3435a0e3","input_sha256":"d4232bc41d31472f138aff1e63de7750f88dcc4f40a9a5d980111391f952b9ee","kind":"mutation-receipt","operation":"8a43c214158c89644641d40abaed24adfca9d55a9a82e9e740fc44035eb56310","options":{"section":null},"request_id_sha256":null,"results":["f-20260910-04"],"target":"f-20260910-04","v":1} -->

### Invalid halfmove errors reference a misspelled catalogue key

* **ID:** f-20260910-05 · **Status:** open · **Area:** i18n · **Root:** - · **Entry:** lens · **Blocked:** none
* **Where:** `src/utils/chessops.ts:90`, consumed by `src/components/boards/Board.tsx`, all `src/translation/*.json`.
* **Defect:** `chessopsError` maps `InvalidFen.Halfmoves` to `Errors.InvalidHalfmoves`, but all 16 catalogues contain only `Errors.InvalidHaldmoves`. A malformed FEN halfmove field therefore displays the untranslated key.
* **Evidence:** the producer spelling differs from the retained catalogue spelling in every locale. Unlike f-20260830-11, extraction already preserves `Errors.*`; this is a producer/catalogue typo, so it does not share the dynamic-extraction root.
* **Fix:** align the catalogue name with the existing producer without discarding the existing translations; assert real localized output from an invalid-halfmove error. Run review-chess-semantics over the repair.
* **Proof:** extraction then real-catalogue error-message assertions for all locales, relevant chessops/board tests, and affected frontend gates.
* **Deferred from:** the confirmation-localization inventory; the FEN validation producer is outside that phase's confirmation component file set.

### Files workspace controls overflow a narrow viewport at 200% font scale

* **ID:** f-20260910-06 · **Status:** open · **Area:** frontend-ui · **Root:** - · **Entry:** lens · **Blocked:** none
* **Where:** `src/components/files/FilesPage.tsx:130-153`, workspace controls and surrounding layout.
* **Defect:** after choosing a workspace at 320px and 200% font scale in German, document scrollWidth is 448px. The page behind a confirmation dialog visibly clips its heading and controls. The dialog itself is bounded to 288px. This is additional Files-page evidence related to f-20260829-02; it is separate from confirmation message extraction.
* **Evidence:** the new directory-trash scenario in `e2e/async-errors.spec.ts` reached its translated alert, then the existing full-document overflow assertion failed with 448 > 320. The screenshot and trace are in `/tmp/build-confirmation-704e13a8/snapshot-1/log` and `artifacts/frontend-audit/test-results/async-errors-async-errors--6a375--in-the-confirmation-dialog-async-errors/` for this run.
* **Fix:** make Files workspace controls and content fit the existing narrow/large-font matrix; use review-correctness and the container visual harness. Do not hide overflow to pass the assertion.
* **Proof:** a Files workspace scenario at 320px and 200% German passes the existing document-width assertion, with a reviewed screenshot and affected frontend gates.
* **Deferred from:** f-20260830-11; Files layout is outside its confirmed message-localization scope.

### Documented container e2e argument separator silently defeats project selection

* **ID:** f-20260910-07 · **Status:** open · **Area:** e2e-gate · **Root:** - · **Entry:** lens · **Blocked:** none
* **Where:** `.claude/skills/verify-ui/SKILL.md:91`, `scripts/run-e2e-container.mjs:91` argument forwarding.
* **Defect:** the documented pnpm invocation includes `-- --project=...`. pnpm retains that separator, and the wrapper forwards it to Playwright, where following options become test-file filters. A supposedly scoped snapshot-update run executes the complete suite instead, risking unrelated snapshot updates.
* **Evidence:** `pnpm test:e2e:update -- --project=async-errors --grep="localizes directory-trash"` ran all ten tests, including workspace-tabs, board-keyboard and security-consent. Log: `/tmp/build-confirmation-704e13a8/snapshot-1/log`. No existing snapshots changed in that run. The wrapper forwards `process.argv.slice(2)` unchanged.
* **Fix:** reconcile the documented command and wrapper argument contract; choose one canonical pnpm usage and cover forwarded project/grep options. Run review-correctness.
* **Proof:** project and grep selection reach Playwright as options, selecting only the named test; the snapshot command cannot silently select unrelated projects.
* **Deferred from:** the f-20260830-11 build, which uses pnpm arguments without the extra separator as the immediate command-level workaround.

---

## 2026-09-10 — filed through the inbox spool

### CI contract gate cannot launch the ledger after its uv shebang migration

* **ID:** f-20260910-08 · **Status:** handled · **Area:** ci-workflows · **Root:** - · **Entry:** lens · **Blocked:** none
* **Where:** `.github/workflows/test.yml`, contract gate; `scripts/findings.py` executable shebang.
* **Defect:** commit 20f3969641eccd59e30d4891540ecdfc9818cd2c changed the ledger invocation to its uv-managed executable but never installs uv on the GitHub runner. Run 34484554877 fails after the three findings atomic-write tests pass with `/usr/bin/env: ‘uv’: No such file or directory` and exit 1.
* **Proof:** `gh run view 34484554877 -R felixabeck/en-croissant --log-failed`; final contract gate invocation at 2026-09-10T13:47:24Z. Install the declared interpreter prerequisite before the gate and verify workflow checks plus the actual runner.
* **Review:** review-correctness over the workflow prerequisite/order change.
* **Related:** f-20260829-07 is a handled different CI prerequisite-order defect; no common root mechanism is asserted.
* **Origin:** Felix reported the failed run during the atomic PGN import build; Codex traced the failure directly. This CI repair is a separate task-owned commit.

* **Resolved, 2026-09-10:** 5bc64961 installs astral-sh/setup-uv v10.0.1 at verified commit 20cfd1bf945f4377ade1205e4dbc17946fc9a30d immediately after checkout, before the executable ledger gate. The script retains ownership of its Python requirement. `pnpm workflows:check`, `pnpm workflows:permissions:test` (12 passed), and `./scripts/findings.py check` passed locally. Cumulative correctness/root-cause review found no defect in the prerequisite repair; actual GitHub execution remains a required post-push verification, not something these local syntax checks prove. Plan authorship and arbitration shared root context; detection and code used the Codex family.
<!-- ledger-meta {"command":"annotate","effect_lines":1,"effect_sha256":"3e506e4241f837ef093b100a83187fcf67d0b0b5561bda6c3bbb08621f1ef4dd","input_sha256":"11dcb532c7c617909b9abed08915b6b2b95da0acbacb256902dbbe14eb28408c","kind":"mutation-receipt","operation":"093903c0338dc880b8f3d5b757c482466af94730dcbce9ae4018d40863fe9363","options":{"section":null},"request_id_sha256":null,"results":["f-20260910-08"],"target":"f-20260910-08","v":1} -->

---

## 2026-09-10 — filed through the inbox spool

### Existing-tab import overwrites its stored tree before metadata commit and bypasses the live tree owner

* **ID:** f-20260910-09 · **Status:** open · **Area:** frontend-state · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** src/components/tabs/ImportModal.tsx handleSubmit file branch, tabStorage.seed inside setCurrentTab; src/state/store/tabStorage.ts seed/read; src/state/store/tree.ts createTreeStore cache.
* **Defect:** importing a selected file into the current tab seeds the existing tab id before the workspace metadata is saved. A quota rejection of the workspace write leaves the prior durable origin/name referencing the replacement tree. A pending old tree also takes precedence over this seed in TabStorageRepository.read and can overwrite it on flush. The live cached store is not replaced by seed.
* **Evidence:** ImportModal.tsx calls tabStorage.seed(prev.value, tree) inside the currentTabAtom updater; seed writes sessionStorage directly, while read checks pending first. The new-tab rollback protocol in f-20260901-05 cannot safely delete an existing id to undo this replacement.
* **Open question:** What shared existing-tab replacement transaction updates live store, pending tree, durable tree and metadata together while retaining the original game on failed commit and handling async import ownership?
* **Relation:** f-20260901-05 and f-20260906-22 cover new-id creation and close; f-20260831-17 covers startup migration. Their Root is '-', so no shared Root is invented. f-20260908-04 concerns whole-file IPC import materialization, a separate cause.
* **Disposition:** Defer under the same-area separate-design exception: existing-owner replacement and recovery needs its own transaction design, beyond this run's new-id creation/close mandate. Current run only changes ImportModal's setter type plumbing.
* **Proof required:** real-store tests with pending and cached old tree, successful replacement, quota failures on tree and workspace writes, stale async result, reload and retry; UI import journey through the container harness.
* **Found by:** Codex root during f-20260901-05 caller trace, 2026-09-10.
