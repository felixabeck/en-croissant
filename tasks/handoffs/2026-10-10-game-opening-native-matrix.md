# Game opening — native fault matrix and delivery takeover (2026-10-10)

Finding `f-20261001-08`. Predecessors: `2026-10-10-game-opening-source-acceptance.md`,
`2026-10-10-game-opening-delivery-continuation.md`, `2026-10-10-game-opening-tab-actions.md`.

## Takeover

Felix stopped the drain run `3b67c3b9` at 22:10 and handed the cluster to an interactive
Claude Code session. The supervisor exited on SIGINT. The detached `native-matrix-continuation`
gate group was terminated, and the run was retired (`drain-findings --retire`). The stopped
release session had completed the R6–R10 cumulative source review, the R11–R14 pixel/source
cohorts, the native verifier repair (`8a591760`) and its five closure lenses. The only open work
was the native fault matrix, the final gates and the push.

## Native fault matrix on 8a591760

Every run uses the unchanged `scripts/verify-app.mjs` (sha256 `a879e3b1…`) and `scripts/app-driver.mjs`
(`727687d7…`). Each healthy restoration and the fixture pair run the reviewed release binary
(`6c6609ba…`). Each source-fault run uses its own disposable fault binary from
`runtime-staging/binaries/<variant>/`, whose hash `runs.json` records. HEAD, the index and the tracked
worktree stayed unchanged throughout, and the healthy binary was restored byte-exact after each
fault. Evidence lives under `/tmp/build-game-opening-3b67c3b9/native-source-matrix-continuation-4/`
and `/tmp/build-game-opening-3b67c3b9/native-fixture-fault/` (`runs.json`, `integrity.json`,
logs, screenshots).

| Fault input | Targeted checks | Fault run (exit 1) | Healthy restoration (exit 0, 102 checks) |
| --- | --- | --- | --- |
| A shortcuts | GO6, GO7, GO11, GO12 | exactly the four targets | passed |
| B labelled buttons | GO5, GO10 | targets plus dependent GO11 and the two `f-20261008-01` metadata checks | passed |
| C selection | GO4, GO9 | targets plus dependent GO5, GO10 | passed |
| D missing controls | GO2, GO8 | targets plus downstream GO3–GO7, GO9–GO12 and GO14 (GO13 passed), and the freshness-budget and selected-root-missing chooser checks | passed on attempt 2 |
| E route and empty PGN | GO3, GO13 | targets plus dependent GO4–GO7 | passed |
| F discard | GO14 | exactly GO14 | passed |
| GO1 fixture (second PGN game removed) | GO1 | GO1 count failure, dependent GO2–GO14, and the two `f-20261008-01` metadata checks | passed; regenerated fixture matched the original bytes |

## Failed healthy and inconclusive runs, kept as evidence

The healthy control failed several times for reasons outside the opening code. Each failed
attempt is kept, and none counted as acceptance. A pair counts only when a healthy run exits 0
with all 102 checks.

- Practice-rating request abort (`f-20261009-02`): B restoration in continuation 2, D attempt 1
  in continuations 3 and 4. Each stopped during practice ratings, before any opening check.
- Files metadata checks (`f-20261008-01`): D attempts 2 and 3 in continuation 3. All 14 GO checks
  passed. Only the Repertoire filter and the sidecar assertion failed.
- D fault in continuation 3: `WebDriver session creation failed` after 34 checks, before any
  assertion. It was rerun as inconclusive and is not counted.

Both flaky classes remain open under their existing findings. No timeout, assertion, fixture or
budget was changed. Healthy restorations rose from one attempt to at most three, and fault runs
that reached no assertion may be rerun up to three times.

## External CI precondition (`f-20261009-04`)

The repository's Actions page showed GitHub's "Workflows on this fork have been disabled" banner.
GitHub disables workflows on forks independently of the permissions API, which still reported
`enabled: true`. With Felix's approval the workflows were re-enabled. Test run 38083147123 on
`5a5dc7e6` then concluded success on every job.
