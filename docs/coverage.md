# Coverage gates

`pnpm coverage:frontend:check` applies two independent checks to every frontend area:

- The baseline ratchet independently rejects a lower covered count or a lower coverage ratio;
  deliberately, it does not reject a larger total when covered code grows with it. Both comparisons
  run against a baseline shrunk by however many records the measurement lost, because deleting a
  covered record lowers `covered` and `total` together and would otherwise fail both clauses — the
  ratio included, since `(c-1)/(t-1) < c/t` for every ratio below 1. When the total does not shrink
  the allowance is zero and the rule is arithmetically identical to the one before it.
- `minimumCoverage` in `coverage-areas.json` rejects a report below the permanent line,
  function, or branch floor for that area.

The allowance says `shrink`, not `deleted`, on purpose. A smaller denominator is the only thing
observable from four aggregate numbers: they cannot tell "one covered record was deleted" apart from
"one uncovered record was deleted and another lost its tests", and this repository has measured that
~170 `BRDA` block/branch identities flip per build without any source change. Record-level baselines
would settle it and are ruled out by that same instability — they would be permanently red. So the
allowance is **bounded** by the observed shrink, and every use that actually changes a verdict is
printed by `coverage-report.mjs`, landing in the CI log instead of being applied silently. A shrink
that would have passed anyway reports nothing.

One consequence worth stating plainly: `scopeSignature` is now the **only** guard against narrowing
the measured set, because a wholesale narrowing looks exactly like a deletion once the numeric
backstop is gone. Any future mechanism that changes *what gets measured* — an exclusion in
`rust-branch-coverage.mjs`, a new include/exclude glob — must be expressed through the config so it
reaches that signature, or the narrowing becomes invisible.

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
