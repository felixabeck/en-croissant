# Coverage gates

`pnpm coverage:frontend:check` applies two independent checks to every frontend area:

- The baseline ratchet rejects a lower covered count, a larger total, or a lower percentage.
- `minimumCoverage` in `coverage-areas.json` rejects a report below the permanent line,
  function, or branch floor for that area.

Every area has a permanent, behavior-derived floor calibrated below its verified baseline; the
floor prevents broad test-suite collapse while the exact-count baseline catches smaller
regressions. Settings (2% lines, 3% functions, 1% branches) is backed by directory-workspace
success, failure, and duplicate-submit controller tests. Puzzles/Engines (5% lines, 6%
functions, 1.5% branches) is backed by workspace/download mutation success and failure tests
plus engine lifecycle/analysis IPC controller tests. Raise floors when additional central flows
are covered; never lower them to accept a regression.

The backend uses the same two-layer policy. Its floors are calibrated just below the verified
instrumented result for each cohesive native area: app infrastructure 66/47/36%, filesystem
boundaries 50/38/36%, OAuth and credentials 68/61/53%, database and search 65/54/65%, engine,
game, and chess 48/54/55%, and auxiliary domain services 55/41/79% (lines/functions/branches).
The exact-count baseline catches changes above those floors; new security or IPC surfaces require
focused tests before the baseline is refreshed.
