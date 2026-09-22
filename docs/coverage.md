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

One consequence worth stating plainly: `scopeSignature` and the blank-measurement check are the two
guards against narrowing the measured set. A wholesale narrowing looks exactly like a deletion once
the numeric backstop is gone, so any future mechanism that changes *what gets measured* — an
exclusion in `rust-branch-coverage.mjs`, a new include/exclude glob — must be expressed through the
config so it reaches that signature, or the narrowing becomes invisible.

**A narrowing can also arrive through the test suite, where the numeric ratchets do not look.**
An eager `?raw` import of a file inside the coverage include set registers that file in the v8
coverage map as a string module with no coverable statements. Vitest generates empty-but-counted
coverage only for files *absent* from that map, so the file is then reported as `LF:0 FNF:0 BRF:0`
instead of its real uncovered counts — it silently leaves the denominator. Measured: a single raw import of one
file zeroes exactly that file and nothing else; an eager `import.meta.glob` of `src/**` with
`query: "?raw"` in one test file zeroed 91 of 232 production files between 2026-09-19 and
2026-09-20, taking the reported `settings` line coverage from 13.39 % to 98.88 % while the gate
stayed green (`f-20260920-18`).

**The class is narrower than that, and the bound was measured on 2026-09-22.** Only a file that no
test imports as a *module* can be blanked this way, because only such a file is absent from the v8
map and therefore depends on the generated counts the raw import displaces. Raw-importing
`src/utils/format.ts`, which other tests import normally, left it at `LF:56 LH:19 FNF:18 FNH:6
BRF:35 BRH:7` — its ordinary measurement — and the gate stayed green. Raw-importing
`src/components/boards/EditingCard.tsx`, which nothing imports, took it from `LF:19` to
`LF:0 FNF:0 BRF:0`. The 91 files that `f-20260920-18` blanked were, consistently with this, exactly
the 91 with non-zero totals and zero hits. The practical reading: the defect hides in the untested
part of the tree, where it is least likely to be noticed and where the reported ratio improves
most.

Nothing catches this numerically, in either direction of arrival. The covered counts never move —
a blanked file contributed no covered records before or after — so neither ratchet clause fires,
and the shrink allowance above forgives the vanished totals by construction. Measured: a broken
measurement passes against the pre-existing baseline *and* against a baseline written from a
repaired run. Only the reverse fails, loudly: a repaired measurement checked against a baseline
written from a broken run reports a ratio regression. So refreshing a baseline from a corrupted
measurement is the trap to avoid above all — afterwards the repair itself looks like the
regression, and the cheapest green is to keep the instrument broken.

The blank-measurement check now enforces this class mechanically: a measured file with zero line,
function, and branch records fails unless it is declared under `statementFree`. The residual hole
is deliberate and narrow: condition 3 cannot tell that a declared file gained statements if it is
also raw-imported and therefore remains blank. That limitation covers only the declared
statement-free files, not the whole measured set.

The practical rule: a test may read source text off disk, but **must not import a file inside
`src/**/*.{ts,tsx}` through `?raw`, `?url` or `?inline`**. Raw imports of files outside that set —
`src-tauri/**`, `.github/**`, `@/catalogs/*.json` — are unaffected and are used deliberately. If a
source scan needs the whole renderer tree, it belongs in a `scripts/**` checker, where several
already live, not in a renderer test.

If a new production file is genuinely statement-free, declare its literal path under
`statementFree` with a reason, then re-record the `scope` subtree in the relevant baseline by
hand. Leave `areas` untouched and prove the edit is scope-only by comparing the parsed committed
baseline with the parsed working-tree baseline; the hand-edit procedure is also the route for a
changed declaration.

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

After adding coverage, deliberately refresh the frontend baseline so the new gains become
binding. First require a green full coverage run against the existing baseline. Obtain the
`frontend-coverage` LCOV artifact from a successful `Test` run in `felixabeck/en-croissant`,
verify that its frontend source, dependencies, test configuration and coverage scope match
the candidate tree, and compare its area metrics with a fresh local `pnpm test:coverage`.
Do not use an old artifact across changed measurement inputs. Require every covered count
and ratio to stay level or rise without using a shrink allowance; otherwise investigate
the difference separately rather than including it in an upward refresh.

Record the CI run, commit, artifact, all metric deltas and the reasoned exception in the
task records before committing the refresh. Use the existing `coverage-report.mjs`
baseline writer with that CI LCOV, then run `pnpm coverage:frontend:check` against the
fresh local LCOV and the normal push gates. Baseline commands remain denied by default;
an actual runtime refusal is a blocker, never a reason to disguise the command. Never
refresh automatically during tests or to clear a red gate. The 2026-09-11 refresh follows
this procedure under `d-20260911-02` in `tasks/decisions.md`.
