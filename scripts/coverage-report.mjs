/**
 * The failure matrix for this artefact.
 *
 * `push-review-policy.md:300-307` asks that a verification artefact whose output is read as
 * evidence outside a test run carry, in its own header, the message and exit status each of its
 * assertions was *seen* to produce; `:376-380` asks that the enumeration be complete, every path
 * staged or argued. This script is such an artefact — `package.json:48,52` and
 * `.github/workflows/test.yml:154,226` cite its exit status for both coverage ratchets and both
 * area-floor gates — and until 2026-09-22 it had no matrix at all (`f-20260921-02`).
 *
 * **Every row below was run.** The enumeration was rebuilt from this source rather than copied
 * from the finding: two `grep` passes — `throw new Error|process.exitCode|stderr.write`, then
 * `await |spawnSync` for the rejections that reach `main().catch` — plus a reading of every entry
 * point's parameters for the class neither pattern can see, a property access on unvalidated input
 * before it is checked. Five consecutive review rounds corrected a matrix that had been assembled
 * from the previous matrix, and each inherited the last one's errors; that is why this one starts
 * from the file.
 *
 * **114 distinct failure paths**, plus one swallowed cleanup path that deliberately produces no
 * failure of its own (row 32) and one shared sink (row 41). Rows 8–13, 15–17, 19–20, 22–26,
 * and 33–40 are not staged by a test; every other path is staged. No row is *argued*: that is
 * reserved for a path reachable only by editing the verifier, doing harm that outlives the run,
 * or touching something the run may not modify. Failure-case CLI tests use scratch inputs;
 * writer tests target only scratch baselines.
 *
 * Module-level rows are reached by calling the exported function directly, which is a real caller:
 * `scripts/coverage-report-tests.mjs` does the same. Their exit status is the CLI's only when they
 * are reached through it, and row 41 records what that is. `TypeError` rows are the wrong-shape
 * class and are recorded as what they are, not dressed up as diagnostics.
 *
 *  #  site                what fails                          message (to its distinguishing part)
 * --- ------------------- ---------------------------------- ------------------------------------
 *  1  :566    assignArea   no area claims a production file   `Unmapped production file: src/other.ts`
 *  2  :567    assignArea   two areas claim the same file      `Production file belongs to multiple
 *                                                             coverage areas: src/utils/a.ts
 *                                                             (utilities, second)`
 *  3  :615                 an area's declared source is not   `Coverage area utilities has the
 *                          the source the file came from      wrong source for src/utils/example.ts`
 *  4  :690                 a production file has no LCOV      `Coverage data missing for production
 *                          record at all                      files: src/utils/example.ts`
 *  5  :704                 an undeclared blank record         `Coverage measurement is blank for
 *                          (condition 1)                      production files: src/utils/blank.ts.`
 *  6  :639                 a declared path outside the        `Coverage statementFree declarations
 *                          measured set (condition 2)         are outside the measured production
 *                                                             set: src/gone.ts.`
 *  7  :716                 a declared path that is measured   `Coverage statementFree declarations
 *                          and not blank (condition 3)        are no longer blank:
 *                                                             src/utils/example.ts.`
 *  8  :721                 a configured area with no          `Coverage data missing for area:
 *                          measured file at all               empty` — not staged by a test
 *  9  :589    ->           the source root is unreadable      `EACCES: permission denied, scandir
 *      files-below.mjs:5   (readdir at the root)              '<root>/src'` — not staged by a test
 * 10  files-below.mjs:5    a directory *below* the source     `EACCES: permission denied, scandir
 *      via :9 recursion    root is unreadable                 '<root>/src/locked'` — not staged by a test
 * 11  :583                 config of the wrong shape: `{}`    TypeError: `config.sources is not
 *                                                             iterable` — not staged by a test
 * 12  :611                 `{"sources":[],"areas":null}`      TypeError: `Cannot read properties of
 *                                                             null (reading 'map')` — not staged by a test
 * 13  :602    ->           a source with no `include` list    TypeError: `Cannot read properties of
 *      coverage-scope.mjs:34                                   undefined (reading 'some')` — not staged by a test
 * 14  :603    ->           a source with no `exclude` list    TypeError: `Cannot read properties of
 *      coverage-scope.mjs:39                                   undefined (reading 'map')` — not staged by a test
 * 14a :624                 a `statementFree` that is not an    TypeError: `(source.statementFree ??
 *                          array: `{}`                        []).map is not a function`
 * 14b :624                 a `statementFree` entry that is     TypeError: `Cannot destructure
 *                          not an object: `[null]`            property 'path' of 'object null' as
 *                                                             it is null.`
 * 15  :433    parseLcov    given something not a string       TypeError: `Cannot read properties of
 *                                                             null (reading 'replaceAll')` — not staged by a test
 * 16  :771                 the baseline's version is not 1    `Unsupported coverage baseline format`
 *                          or it carries no `areas` — not staged by a test
 * 17  :755                 no recorded scope, checked         `Coverage baseline is missing its
 *                          against a config                   recorded scope` — not staged by a test
 * 18  :758                 the recorded scope no longer       `Coverage measurement scope changed:
 *                          matches the config                 source ids and roots, include globs,
 *                                                             exclude globs, statementFree
 *                                                             declarations, or area ids, sources,
 *                                                             and paths ... Re-record the scope
 *                                                             subtree by hand ...`
 * 19  :775                 a measured area the baseline       `Missing baseline for area: utilities`
 *                          does not carry — not staged by a test
 * 20  :780                 a baseline area missing one        `Missing functions baseline for area:
 *                          metric                             utilities` — not staged by a test
 * 21  :813                 a covered count or ratio           `utilities lines regressed: 1/2,
 *                          regressed                          baseline 2/2`
 * 22  :819                 a baseline area absent from the    `Baseline references unknown area:
 *                          report                             ghost` — not staged by a test
 * 23  :770                 a baseline of the wrong shape:     TypeError: `Cannot read properties of
 *                          `null`                             null (reading 'version')` — not staged by a test
 * 24  :831                 an area with no                    `Missing minimum coverage for area:
 *                          `minimumCoverage`                  utilities` — not staged by a test
 * 25  :833                 an area with no entry in the       `Missing coverage report for area:
 *                          report. Reachable through the      utilities`
 *                          exported API, not through the
 *                          CLI, and it stays for that — not staged by a test
 * 26  :837                 a minimum that is not a            `Invalid lines minimum coverage for
 *                          percentage                         area: utilities` — not staged by a test
 * 27  :843                 a measured area below its floor    `utilities lines is below minimum
 *                                                             coverage: 50.00% < 80.00%`
 * 28  :1117                the temporary write rejects        the rejection, unchanged:
 *                                                             `writeFile refused`
 * 29  :1135                the formatter exits non-zero       `Failed to format coverage baseline
 *                                                             with <path>: status=23; signal=null;
 *                                                             stderr="rejected"`
 * 29b :1135                the formatter is killed by a       `... status=null; signal=SIGTERM;
 *                          signal                             stderr=""` -- `status !== 0` is true
 *                                                             for `null`, so a kill is caught
 *                                                             rather than reported as success
 * 30  :1135                the formatter binary is missing    `... status=null; signal=null;
 *                                                             stderr=""; error.code=ENOENT;
 *                                                             error.message="spawnSync <path>
 *                                                             ENOENT"`
 * 31  :1139                the rename into place rejects      the rejection, unchanged:
 *                                                             `rename refused`
 * 32  :1108                cleanup's unlink rejects after a   **no failure of its own**: the
 *                          failure. Deliberately swallowed    primary error is rethrown unchanged
 *                          so it cannot replace the           (`rename refused`) and the temporary
 *                          actionable error                   file survives as evidence
 * 33  :1159                an option with no value            `Missing value for --config`
 *                                                             — exit 1; not staged by a test
 * 34  :1162                an unknown argument                `Unknown argument: --nope` — exit 1; not staged by a test
 * 35  :1166                a required option omitted          `Usage: coverage-report.mjs --config
 *                                                             <file> ...` — exit 1; not staged by a test
 * 36  :1189                the config file does not exist     `ENOENT: no such file or directory,
 *                                                             open '<root>/missing.json'` — exit 1; not staged by a test
 * 37  :1189                the config file is not JSON        SyntaxError: `Expected property name
 *                                                             or '}' in JSON at position 2` — exit 1; not staged by a test
 * 38  :1200                an LCOV file does not exist        `ENOENT: ... '<root>/missing.info'`
 *                                                             — exit 1; not staged by a test
 * 39  :1220                the baseline file does not exist   `ENOENT: ... '<root>/missing.json'`
 *                                                             — exit 1; not staged by a test
 * 40  :1220                the baseline file is not JSON      SyntaxError, as row 37 — exit 1; not staged by a test
 * 41  :1233                `main().catch` — the shared sink,  every CLI throw, reached through
 *                          **not an independent failure**     the CLI, prints `error.message` on
 *                                                             stderr and exits **1**. Measured with
 *                                                             row 18's throw: exit 1, message on
 *                                                             stderr, nothing on stdout
 * 42  :910    write guard  prior baseline is not JSON          `Invalid prior coverage baseline at
 *                                                             <path>: <JSON parse message>` — exit 1
 * 43  :859    validate     prior version or `areas` is         `Invalid prior coverage baseline
 *                          wrong-shaped                        from <path>: expected version 1
 *                                                             and an areas object` — exit 1
 * 44  :865    validate     a prior area's metrics container    `Invalid prior coverage baseline
 *                          is not an object                     from <path>: utilities must
 *                                                             contain all metrics` — exit 1
 * 45  :879    validate     a prior area is missing one metric  `Invalid prior coverage baseline
 *                                                             from <path>: utilities lines must
 *                                                             have non-negative integer covered
 *                                                             and total counts with covered <=
 *                                                             total` — exit 1
 * 46  :879    validate     prior `covered` is not an integer  same invalid-count message, with
 *                                                             `covered: "bad"` — exit 1
 * 47  :879    validate     prior `covered` is negative        same invalid-count message, with
 *                                                             `covered: -1` — exit 1
 * 48  :879    validate     prior `covered > total`             same invalid-count message, with
 *                                                             `covered: 2, total: 1` — exit 1
 * 49  :879    validate     prior `covered` is fractional      same invalid-count message, with
 *                                                             `covered: 1.5` — exit 1
 * 50  :879    validate     prior `total` is fractional        same invalid-count message, with
 *                                                             `total: 2.5` — exit 1
 * 51  :879    validate     prior `total` is negative          same invalid-count message, with
 *                                                             `total: -1` — exit 1
 * 52  :1097   write guard  covered count decreases while the  `Coverage baseline write refused
 *                          ratio stays level                    (decreases: utilities lines
 *                                                             (covered count 10 → 9)); ...` — exit 1
 * 53  :1097   write guard  ratio decreases while `covered`   `Coverage baseline write refused
 *                          rises                                (decreases: utilities lines
 *                                                             (ratio 50.00% → 46.15%)); ...` — exit 1
 * 54  :1097   write guard  an area is removed                 `Coverage baseline write refused
 *                                                             (... retired lines (area removed)
 *                                                             ...); ...` — exit 1
 * 55  :985→1097 ratio check `0/0 → 0/1` is a decrease          `Coverage baseline write refused
 *                                                             (... utilities lines (ratio
 *                                                             100.00% → 0.00%)); ...` — exit 1
 * 56  :1097   write guard  recorded scope changes             `Coverage baseline write refused
 *                                                             (... scope keys changed:
 *                                                             sources[0].exclude[0]); ...` — exit 1
 * 57  :1097   write guard  an area is added                   `Coverage baseline write refused
 *                                                             (... areas changed: added=[puzzles],
 *                                                             removed=[]); ...` — exit 1
 * 58  :1047    authorize    `tasks/decisions.md` is missing    `Instrument change authorization
 *                                                             requires tasks/decisions.md for
 *                                                             decision d-20260927-23 governing
 *                                                             f-20260829-04` — exit 1
 * 59  :1055    authorize    decision id has no entry           `No decision entry found for
 *                                                             --instrument-change d-20260927-23
 *                                                             in tasks/decisions.md` — exit 1
 * 60  :1059    authorize    `Governs:` misses the exact finding `Decision d-20260927-23 does not
 *                                                             govern finding f-20260829-04` — exit 1
 * 61  :1154   parse         `--instrument-change` has no value `Missing value for
 *                                                             --instrument-change` — exit 1
 * 62  :1154   parse         `--finding` has no value           `Missing value for --finding` — exit 1
 * 63  :1178   parse         authorization flags without       `--instrument-change and --finding
 *                          `--write-baseline`                 require --write-baseline` — exit 1
 * 64  :1181   parse         only `--instrument-change`        `--instrument-change and --finding
 *                                                             must be used together` — exit 1
 * 65  :1181   parse         only `--finding`                  `--instrument-change and --finding
 *                                                             must be used together` — exit 1
 * 66  :926    git           `rev-parse` fails for another     `Failed to inspect prior coverage
 *                          reason than not-a-repository        baseline with git rev-parse
 *                                                             --is-inside-work-tree: status=37;
 *                                                             stderr="fatal: simulated repository
 *                                                             metadata error\n"` — exit 1
 * 67  :899    git           git cannot be spawned             `Failed to inspect prior coverage
 *                                                             baseline with git rev-parse
 *                                                             --is-inside-work-tree: status=null;
 *                                                             stderr=""; error.code=ENOENT;
 *                                                             error.message="spawnSync git
 *                                                             ENOENT"` — exit 1
 * 68  :931    git           `ls-tree` fails for unborn `HEAD` `Failed to inspect prior coverage
 *                                                             baseline with git ls-tree
 *                                                             --full-name HEAD -- scratch-
 *                                                             baseline.json: status=128;
 *                                                             stderr="fatal: Not a valid object
 *                                                             name HEAD\n"` — exit 1
 * 69  :936    git           `ls-tree` output is ambiguous or  `Failed to inspect prior coverage
 *                          malformed                            baseline with git ls-tree
 *                                                             --full-name HEAD -- scratch-
 *                                                             baseline.json: expected one tracked
 *                                                             file entry; stderr=""` — exit 1
 * 70  :943    git           `show` fails for a tracked path    `Failed to inspect prior coverage
 *                                                             baseline with git show
 *                                                             HEAD:scratch-baseline.json:
 *                                                             status=38; stderr="fatal: simulated
 *                                                             committed object failure\n"` — exit 1
 * 71  rust-test-only.mjs   invalid exclusion object or        `Coverage source backend
 *     validateExclusionConfig empty reason                      excludeTestOnlyItems must be an
 *                                                             object with a non-empty reason
 *                                                             string` — exit 1
 * 72  rust-test-only.mjs   include-matched non-Rust file       `src-tauri/src/config.ts:1:
 *     scanRustTestOnly                                         excludeTestOnlyItems can scan only
 *                                                             .rs files` — exit 1
 * 73  rust-test-only.mjs   unbalanced delimiter at EOF         `src-tauri/src/lib.rs:2: unbalanced
 *     delimiterPairs                                           delimiter at end of file` — exit 1
 * 74  rust-test-only.mjs   unparseable `cfg` predicate         `src-tauri/src/lib.rs:1:
 *     parsePredicate                                           unparseable cfg predicate (not()
 *                                                             requires one cfg predicate)` — exit 1
 * 75  rust-test-only.mjs   unparseable `cfg_attr` predicate    `src-tauri/src/lib.rs:1:
 *     evaluateCfgAttribute                                      unparseable cfg_attr predicate
 *                                                             (expected a condition and
 *                                                             attribute)` — exit 1
 * 76  rust-test-only.mjs   braced macro expression followed    `src-tauri/src/lib.rs:4: unsupported
 *     findStatementEnd      by `?`                              test-only form; give it its own
 *                                                             item/statement or extend
 *                                                             rust-test-only.mjs` — exit 1
 * 77  rust-test-only.mjs   test-only attribute in unplaced     `src-tauri/src/lib.rs:3:
 *     analyzeRustFile       `try` block                         unplaceable test-only context;
 *                                                             extend rust-test-only.mjs only for
 *                                                             a listed Rust form` — exit 1
 * 78  rust-test-only.mjs   statement reaches `}` without `;`   `src-tauri/src/lib.rs:3: test-only
 *     findStatementEnd                                         statement reaches its enclosing }
 *                                                             without a terminator` — exit 1
 * 79  rust-test-only.mjs   shared line with production call    `src-tauri/src/lib.rs:1: shared
 *     lineRanges                                               coverage line; give the test-only
 *                                                             item its own lines` — exit 1
 * 80  rust-test-only.mjs   shared line with production string  same shared-line message, with
 *     lineRanges                                                `const VALUE: &str = "production"`
 *                                                             outside the test-only fn — exit 1
 * 81  rust-test-only.mjs   nested module in a test-only inline `src-tauri/src/lib.rs:1: unsupported
 *     resolveModulePath    module                               test-only module declaration inside
 *                                                             an inline module` — exit 1
 * 82  rust-test-only.mjs   `#[path]` on test-only `mod`        `src-tauri/src/lib.rs:3: unsupported
 *     resolveModulePath                                          #[path] on a test-only module
 *                                                             declaration` — exit 1
 * 83  rust-test-only.mjs   unresolved test-only `mod`          `src-tauri/src/lib.rs:2: cannot
 *     resolveModulePath                                          resolve test-only module missing`
 *                                                             — exit 1
 * 84  rust-test-only.mjs   ambiguous module file layouts       `src-tauri/src/lib.rs:2: ambiguous
 *     resolveModulePath                                          test-only module helper:
 *                                                             src-tauri/src/helper.rs,
 *                                                             src-tauri/src/helper/mod.rs` — exit 1
 * 85  rust-test-only.mjs   test-only attribute in unrelated    `src-tauri/src/lib.rs:2: unsupported
 *     analyzeRustFile       macro input                          test-only context inside a macro
 *                                                             input` — exit 1
 * 86  rust-test-only.mjs   unreadable included Rust file       `src-tauri/src/unreadable.rs:1:
 *     scanRustTestOnly                                          unable to read Rust source: EACCES`
 *                                                             — exit 1
 * 87  rust-test-only.mjs   `.`, `?` or `as` after the `}` of a `src-tauri/src/lib.rs:4: unsupported
 *     findStatementEnd      statement-position braced macro or   test-only form; give it its own
 *                          `if`/`else` (four staged cases:      item/statement or extend
 *                          `.await`, `.method()`, `as`, `?`)    rust-test-only.mjs` — exit 1
 * 88  rust-test-only.mjs   `path = …` reached through a         `src-tauri/src/lib.rs:3: unsupported
 *     resolveModulePath    (nested) `cfg_attr` on a test-only   #[path] on a test-only module
 *                          `mod name;`                          declaration` — exit 1
 * 89  rust-test-only.mjs   module candidate not accessible for  `src-tauri/src/parent.rs:2: unable to
 *     resolveModulePath    a reason other than ENOENT/ENOTDIR   access test-only module candidate
 *                          (parent directory chmod 000)         …: EACCES: permission denied …`
 *                                                             — exit 1
 * 90  :651   mapping-only an area has no production files; test "area claims no production file":
 *                          `Coverage areas claim no production files: empty` — exit 1
 * 91  :1170  parse         `--mapping-only` with `--lcov`; test "mapping-only rejects LCOV arguments":
 *                          `--mapping-only cannot be combined with --lcov` — exit 1
 * 92  :1173  parse         `--mapping-only` with `--write-baseline`; test "mapping-only rejects baseline writes":
 *                          `--mapping-only cannot be combined with --write-baseline` — exit 1
 * 93  :465   parseLcov DA has neither 2 nor 3 fields       `Malformed LCOV ... DA requires 2 or 3 fields` — exit 1
 * 94  :469             DA line is not canonical and >= 1   `Malformed LCOV ... DA line must be a canonical decimal >= 1` — exit 1
 * 95  :472             DA hits are not canonical decimal   `Malformed LCOV ... DA hits must be a canonical decimal` — exit 1
 * 96  :475             present DA checksum is empty        `Malformed LCOV ... DA checksum must be non-empty when present` — exit 1
 * 97  :481             FN has other than 2 fields          `Malformed LCOV ... FN requires 2 fields` — exit 1
 * 98  :484             FN line is not canonical and >= 1   `Malformed LCOV ... FN line must be a canonical decimal >= 1` — exit 1
 * 99  :486             FN name is empty                    `Malformed LCOV ... FN name must be non-empty` — exit 1
 * 100 :504             FNDA has other than 2 fields        `Malformed LCOV ... FNDA requires 2 fields` — exit 1
 * 101 :507             FNDA hits are not canonical decimal `Malformed LCOV ... FNDA hits must be a canonical decimal` — exit 1
 * 102 :509             FNDA name is empty                  `Malformed LCOV ... FNDA name must be non-empty` — exit 1
 * 103 :518             BRDA has other than 4 fields        `Malformed LCOV ... BRDA requires 4 fields` — exit 1
 * 104 :521             BRDA line is not canonical and >= 1 `Malformed LCOV ... BRDA line must be a canonical decimal >= 1` — exit 1
 * 105 :524             BRDA block is not canonical decimal `Malformed LCOV ... BRDA block must be a canonical decimal` — exit 1
 * 106 :527             BRDA branch is not canonical decimal `Malformed LCOV ... BRDA branch must be a canonical decimal` — exit 1
 * 107 :530             BRDA taken is neither decimal nor - `Malformed LCOV ... BRDA taken must be a canonical decimal or -` — exit 1
 * 108 :446             empty SF path                       `Malformed LCOV ... SF path is empty` — exit 1
 * 109 :447             SF while a record is open           `Malformed LCOV ... SF before end_of_record` — exit 1
 * 110 :461             counter with no open record         `Malformed LCOV ... counter without an open record` — exit 1
 * 111 :436             end_of_record with no open record   `Malformed LCOV ... end_of_record without an open record` — exit 1
 * 112 :538             input ends with an open record      `Malformed LCOV at end of input: open record for SF "..."` — exit 1
 * 113 :512             FNDA has no earlier matching FN     `Malformed LCOV ... FNDA has no earlier matching FN` — exit 1
 *
 * **The rows the blank-measurement work added or changed were also staged against the real
 * frontend LCOV**, not only against fixtures, because that is the artefact an operator runs. Rows
 * 5 and 7 were run twice there, once with one offender and once with two, since a message naming
 * only the first offender passes every single-offender run; row 6 four times, because a dead
 * declaration has two distinct shapes and each got both offender counts; row 18 once, a scope
 * mismatch having no offender list to aggregate. Nine runs, one record each, all exit 1:
 *
 *   row 5   staged by raw-importing one never-imported production file, then two:
 *           `... files: src/components/boards/EditingCard.tsx.` and
 *           `... files: src/components/boards/AnnotationHint.tsx,
 *           src/components/boards/EditingCard.tsx.` — one message, both paths, sorted. The gate
 *           was measured green before and green again after the throwaway test was deleted.
 *   row 6   scratch config declaring `src/does-not-exist.ts`, then it and `src/also-missing.ts`;
 *           and separately `src/routeTree.gen.ts`, then it and `src/vite-env.d.ts` — files that
 *           exist on disk and are excluded, because condition 2 is measured-set membership and
 *           not filesystem existence.
 *   row 7   scratch config declaring `src/utils/format.ts`, then it and `src/utils/chess.ts`.
 *   row 18  a scratch baseline whose recorded scope was one `statementFree` entry stale — and the
 *           message does **not** name a baseline-write command. The baseline denies were removed
 *           under `d-20260927-23`; write protection now lives in the writer guard (rows 42-70).
 *
 * **Baseline-writer rows 42-70 and Rust-exclusion rows 71-86** were staged by CLI subtests in
 * `scripts/coverage-report-tests.mjs`; every refused write asserts exit 1 and byte-identical
 * scratch baseline-file bytes. Rows 42-51 are the individual prior-JSON/schema/counter cases; 52-55
 * are covered-count, ratio, removed-area, and zero-total decreases; 56-57 are scope and area-set
 * changes; 58-60 are missing or non-governing decisions; 61-65 are authorization-flag usage
 * errors; and 66-70 stage unexpected `rev-parse`, missing git, unborn `HEAD`, ambiguous/malformed
 * `ls-tree`, and failing `show` results. The tracked-`HEAD`, untracked-disk, first-write, accepted increase,
 * and accepted authorization cases also use scratch baselines; none names a repository baseline.
 *
 * **Malformed-LCOV rows 93–113** are each staged by a CLI subtest in
 * `scripts/coverage-report-tests.mjs`, asserting exit 1, the complete unique diagnostic and empty
 * stdout. Row 95 is also staged through `--write-baseline`, with unchanged scratch baseline bytes.
 * Diagnostics name the 1-based input line, JSON-quoted raw line and the open record's raw SF.
 * Row 112 names the open SF at end of input instead of a line.
 *
 * **Real-instrument negative controls, measured 2026-10-07:** scratch copies under /tmp of the
 * just-written frontend `coverage/lcov.info` (41,466 lines) and backend
 * `backend-coverage/lcov.info` (140,818 lines), run through the CLI with each package script's
 * own --config/--baseline and --lcov pointing at the copy. Both untouched files exited 0.
 * Four damaged copies, four runs, all exit 1. `<repo>` abbreviates the absolute checkout path:
 *
 *   row 112 frontend, final end_of_record removed:
 *           `Malformed LCOV at end of input: open record for SF "src/utils/lichess/explorer.ts"`
 *   row 112 backend, final end_of_record removed:
 *           `Malformed LCOV at end of input: open record for SF "<repo>/src-tauri/src/sound.rs"`
 *   row 95  frontend, first DA at input line 39, DA:46,1 → DA:46,x:
 *           `Malformed LCOV at line 39 in SF "src/App.tsx": DA hits must be a canonical decimal: "DA:46,x"`
 *   row 95  backend, first DA at input line 52, DA:27,47 → DA:27,x:
 *           `Malformed LCOV at line 52 in SF "<repo>/src-tauri/src/cancellable_read.rs": DA hits must be a canonical decimal: "DA:27,x"`
 *
 * What this matrix does **not** cover, stated rather than implied: unknown keys are ignored,
 * including damaged counter keys, to tolerate informational keys from future instruments.
 * Summary lines are not cross-checked, because llvm-cov's own summaries disagree with records in
 * 45 of 49 backend records measured 2026-10-07. Repeated DA or BRDA identities within a record take
 * the maximum hit count. Repeated identical FN declarations remain distinct functions. Line
 * numbers count the joined input when several `--lcov` files are supplied. Current callers each
 * pass one LCOV (`package.json:48,52`), so those numbers are file-local. Source-side line existence
 * (`f-20260920-20`) and consumer behaviour beyond exit status and `error.message` remain unchecked.
 */
import { spawnSync } from "node:child_process";
import { readFile, rename as renameFile, unlink as unlinkFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { excluded, excludePatterns, matches, normalisePath } from "./coverage-scope.mjs";
import { isEntrypoint } from "./entrypoint.mjs";
import { filesBelow } from "./files-below.mjs";
import { scanRustTestOnly, validateExclusionConfig } from "./rust-test-only.mjs";

const METRICS = ["lines", "functions", "branches"];

// Integer fields are canonical decimals, but function names and DA checksums remain opaque text
// and can contain identity separators. JSON array encoding preserves their field boundaries and
// is injective for arbitrary strings, including colons, NULs, quotes and backslashes.
const identity = (...fields) => JSON.stringify(fields);

function emptyMetrics() {
  return Object.fromEntries(METRICS.map((metric) => [metric, { covered: 0, total: 0 }]));
}

/**
 * `identify` maps an `SF` value to the identity records are merged under, and defaults to the
 * value itself. `buildCoverageReport` passes the repo-relative normaliser, because one file can
 * legitimately appear under two spellings — `llvm-cov` writes absolute paths, `@vitest/coverage-v8`
 * repo-relative ones, and several LCOV files may be joined in one run. Merging them here, by
 * counter identity, is the only place that can do it correctly: past this function the counters are
 * gone and only totals remain, which can be summed but not unioned.
 */
export function parseLcov(lcov, identify = (file) => file, includeLine = () => true) {
  const reports = new Map();
  let report;
  const canonicalDecimal = /^(0|[1-9][0-9]*)$/;
  const positiveDecimal = /^[1-9][0-9]*$/;

  function malformed(reason, rawLine, lineNumber) {
    const record = report ? ` in SF ${JSON.stringify(report.sourceFile)}` : "";
    return new Error(
      `Malformed LCOV at line ${lineNumber}${record}: ${reason}: ${JSON.stringify(rawLine)}`,
    );
  }

  function addCounter(counters, identity, hits) {
    counters.set(identity, Math.max(counters.get(identity) ?? 0, hits));
  }

  function mergeReport(next) {
    if (!next?.file) return;
    const existing = reports.get(next.file);
    if (!existing) {
      reports.set(next.file, next);
      return;
    }
    for (const metric of ["lines", "functions", "branches"]) {
      for (const [identity, hits] of next[metric]) addCounter(existing[metric], identity, hits);
    }
  }

  for (const [index, rawLine] of lcov.replaceAll("\r\n", "\n").split("\n").entries()) {
    const lineNumber = index + 1;
    if (rawLine === "end_of_record") {
      if (!report) throw malformed("end_of_record without an open record", rawLine, lineNumber);
      mergeReport(report);
      report = undefined;
      continue;
    }
    if (!rawLine) continue;
    const separator = rawLine.indexOf(":");
    const key = separator === -1 ? rawLine : rawLine.slice(0, separator);
    const value = separator === -1 ? "" : rawLine.slice(separator + 1);
    if (key === "SF") {
      if (!value) throw malformed("SF path is empty", rawLine, lineNumber);
      if (report) throw malformed("SF before end_of_record", rawLine, lineNumber);
      report = {
        sourceFile: value,
        file: identify(value),
        lines: new Map(),
        functions: new Map(),
        branches: new Map(),
        functionIdsByName: new Map(),
        functionsByDeclaration: new Map(),
        functionDataOccurrences: new Map(),
      };
      continue;
    }
    if (!["DA", "FN", "FNDA", "BRDA"].includes(key)) continue;
    if (!report) throw malformed("counter without an open record", rawLine, lineNumber);
    const fields = value.split(",");
    if (key === "DA") {
      if (fields.length !== 2 && fields.length !== 3) {
        throw malformed("DA requires 2 or 3 fields", rawLine, lineNumber);
      }
      const [line, hits, checksum = ""] = fields;
      if (!positiveDecimal.test(line)) {
        throw malformed("DA line must be a canonical decimal >= 1", rawLine, lineNumber);
      }
      if (!canonicalDecimal.test(hits)) {
        throw malformed("DA hits must be a canonical decimal", rawLine, lineNumber);
      }
      if (fields.length === 3 && !checksum) {
        throw malformed("DA checksum must be non-empty when present", rawLine, lineNumber);
      }
      if (includeLine(report.file, Number(line))) {
        addCounter(report.lines, identity(line, checksum), Number(hits));
      }
    } else if (key === "FN") {
      if (fields.length !== 2) throw malformed("FN requires 2 fields", rawLine, lineNumber);
      const [line, name] = fields;
      if (!positiveDecimal.test(line)) {
        throw malformed("FN line must be a canonical decimal >= 1", rawLine, lineNumber);
      }
      if (!name) throw malformed("FN name must be non-empty", rawLine, lineNumber);
      // The occurrence index counts same-named declarations *on the same line*, not same-named
      // declarations anywhere in the file. Both spellings disambiguate the only case that needs
      // it -- two functions sharing a name and a line -- but only this one is independent of
      // declaration order, and two records for one file need not list their functions in the same
      // order. Counting per name made `FN:10,f; FN:20,f` and `FN:20,f; FN:10,f` four distinct
      // functions instead of two. `functionIdsByName` keeps declaration order regardless, because
      // that is what pairs an `FNDA` line with its `FN`.
      const functionsWithName = report.functionIdsByName.get(name) ?? [];
      const declarationKey = identity(line, name);
      const sameLine = report.functionsByDeclaration.get(declarationKey) ?? 0;
      const functionIdentity = identity(line, name, sameLine);
      report.functionsByDeclaration.set(declarationKey, sameLine + 1);
      const included = includeLine(report.file, Number(line));
      if (included) report.functions.set(functionIdentity, 0);
      functionsWithName.push({ identity: functionIdentity, included });
      report.functionIdsByName.set(name, functionsWithName);
    } else if (key === "FNDA") {
      if (fields.length !== 2) throw malformed("FNDA requires 2 fields", rawLine, lineNumber);
      const [hits, name] = fields;
      if (!canonicalDecimal.test(hits)) {
        throw malformed("FNDA hits must be a canonical decimal", rawLine, lineNumber);
      }
      if (!name) throw malformed("FNDA name must be non-empty", rawLine, lineNumber);
      const occurrence = report.functionDataOccurrences.get(name) ?? 0;
      const declaration = report.functionIdsByName.get(name)?.[occurrence];
      if (!declaration) throw malformed("FNDA has no earlier matching FN", rawLine, lineNumber);
      report.functionDataOccurrences.set(name, occurrence + 1);
      if (declaration.included) {
        addCounter(report.functions, declaration.identity, Number(hits));
      }
    } else if (key === "BRDA") {
      if (fields.length !== 4) throw malformed("BRDA requires 4 fields", rawLine, lineNumber);
      const [line, block, branch, hits] = fields;
      if (!positiveDecimal.test(line)) {
        throw malformed("BRDA line must be a canonical decimal >= 1", rawLine, lineNumber);
      }
      if (!canonicalDecimal.test(block)) {
        throw malformed("BRDA block must be a canonical decimal", rawLine, lineNumber);
      }
      if (!canonicalDecimal.test(branch)) {
        throw malformed("BRDA branch must be a canonical decimal", rawLine, lineNumber);
      }
      if (hits !== "-" && !canonicalDecimal.test(hits)) {
        throw malformed("BRDA taken must be a canonical decimal or -", rawLine, lineNumber);
      }
      if (includeLine(report.file, Number(line))) {
        addCounter(report.branches, identity(line, block, branch), hits === "-" ? 0 : Number(hits));
      }
    }
  }
  if (report) {
    throw new Error(
      `Malformed LCOV at end of input: open record for SF ${JSON.stringify(report.sourceFile)}`,
    );
  }
  return [...reports.values()].map((report) => ({
    file: report.file,
    metrics: {
      lines: {
        covered: [...report.lines.values()].filter((hits) => hits > 0).length,
        total: report.lines.size,
      },
      functions: {
        covered: [...report.functions.values()].filter((hits) => hits > 0).length,
        total: report.functions.size,
      },
      branches: {
        covered: [...report.branches.values()].filter((hits) => hits > 0).length,
        total: report.branches.size,
      },
    },
  }));
}

export function assignArea(path, config) {
  const candidates = config.areas.filter((area) => matches(path, area.paths));
  if (candidates.length !== 1) {
    throw new Error(
      candidates.length === 0
        ? `Unmapped production file: ${path}`
        : `Production file belongs to multiple coverage areas: ${path} (${candidates.map((area) => area.id).join(", ")})`,
    );
  }
  return candidates[0];
}

function addMetrics(total, addition) {
  for (const metric of METRICS) {
    total[metric].covered += addition[metric].covered;
    total[metric].total += addition[metric].total;
  }
}

export async function enumerateProductionFiles({ config, root }) {
  const productionFiles = new Map();
  const scansBySource = new Map();
  for (const source of config.sources) {
    if (source.excludeTestOnlyItems !== undefined) validateExclusionConfig(source);
    let paths;
    try {
      paths = await filesBelow(resolve(root, source.root));
    } catch (error) {
      if (source.excludeTestOnlyItems === undefined) throw error;
      throw new Error(`${source.root}:1: unable to scan Rust source tree: ${error.message}`, {
        cause: error,
      });
    }
    const files = paths.map((path) => normalisePath(path, root));
    const testOnlyScan =
      source.excludeTestOnlyItems === undefined
        ? undefined
        : await scanRustTestOnly({ root, source, files: paths });
    if (testOnlyScan) scansBySource.set(source.id, testOnlyScan);
    for (const file of files) {
      if (
        matches(file, source.include) &&
        !excluded(file, source) &&
        !testOnlyScan?.testOnlyFiles.has(file)
      )
        productionFiles.set(file, source.id);
    }
  }

  const areaByFile = new Map();
  const productionFilesByArea = new Map(config.areas.map((area) => [area.id, 0]));
  for (const [file, sourceId] of productionFiles) {
    const area = assignArea(file, config);
    if (area.source !== sourceId)
      throw new Error(`Coverage area ${area.id} has the wrong source for ${file}`);
    areaByFile.set(file, area);
    productionFilesByArea.set(area.id, productionFilesByArea.get(area.id) + 1);
  }
  return { productionFiles, scansBySource, areaByFile, productionFilesByArea };
}

function statementFreeDeclarationsFor(config) {
  return config.sources.flatMap((source) =>
    (source.statementFree ?? []).map(({ path }) => ({ path, sourceId: source.id })),
  );
}

function assertStatementFreeScope(
  config,
  productionFiles,
  statementFreeDeclarations = statementFreeDeclarationsFor(config),
) {
  const deadStatementFree = statementFreeDeclarations
    .filter(({ path, sourceId }) => productionFiles.get(path) !== sourceId)
    .map(({ path }) => path)
    .sort();
  if (deadStatementFree.length)
    throw new Error(
      `Coverage statementFree declarations are outside the measured production set: ${deadStatementFree.join(", ")}. ` +
        "Remove each dead declaration or restore the file to the measured production set.",
    );
  return statementFreeDeclarations;
}

export async function assertCoverageMapping({ config, root }) {
  const enumeration = await enumerateProductionFiles({ config, root });
  const emptyAreas = [...enumeration.productionFilesByArea]
    .filter(([, count]) => count === 0)
    .map(([area]) => area);
  if (emptyAreas.length) {
    throw new Error(`Coverage areas claim no production files: ${emptyAreas.join(", ")}`);
  }
  assertStatementFreeScope(config, enumeration.productionFiles);
  return enumeration;
}

export async function buildCoverageReport({ config, configPath, lcov, root }) {
  const { productionFiles, scansBySource, areaByFile } = await enumerateProductionFiles({
    config,
    root,
  });

  const report = Object.fromEntries(config.areas.map((area) => [area.id, emptyMetrics()]));
  const coverageFilesByArea = Object.fromEntries(config.areas.map((area) => [area.id, 0]));
  const statementFreeDeclarations = statementFreeDeclarationsFor(config);
  // `parseLcov` is given the normaliser, so every spelling of one file arrives as ONE record with
  // its counters unioned. Doing it here instead would be too late twice over: the area totals
  // below would add the same file's records once each, and the blank check further down would see
  // whichever record happened to come last.
  const coverageMetricsByFile = new Map();
  for (const record of parseLcov(
    lcov,
    (file) => normalisePath(file, root),
    (file, line) =>
      !scansBySource.get(productionFiles.get(file))?.excludedLines.get(file)?.has(line),
  )) {
    const file = record.file;
    const sourceId = productionFiles.get(file);
    if (!sourceId) continue;
    const area = areaByFile.get(file);
    addMetrics(report[area.id], record.metrics);
    coverageFilesByArea[area.id] += 1;
    coverageMetricsByFile.set(file, record.metrics);
  }

  const missingFiles = [...productionFiles.keys()].filter(
    (file) => !coverageMetricsByFile.has(file),
  );
  if (missingFiles.length)
    throw new Error(`Coverage data missing for production files: ${missingFiles.join(", ")}`);
  const isBlankMeasurement = (metrics) =>
    metrics.lines.total === 0 && metrics.functions.total === 0 && metrics.branches.total === 0;
  const declaredStatementFree = new Set(
    statementFreeDeclarations
      .filter(({ path, sourceId }) => productionFiles.get(path) === sourceId)
      .map(({ path }) => path),
  );
  const blankFiles = [...productionFiles.keys()]
    .filter((file) => isBlankMeasurement(coverageMetricsByFile.get(file)))
    .filter((file) => !declaredStatementFree.has(file))
    .sort();
  if (blankFiles.length)
    throw new Error(
      `Coverage measurement is blank for production files: ${blankFiles.join(", ")}. ` +
        "A file present in the LCOV with no line, function or branch records has left the denominator without changing any percentage. " +
        `If the file genuinely has no statements, declare it under statementFree in ${configPath}; otherwise something removed it from the measurement (see docs/coverage.md).`,
    );
  assertStatementFreeScope(config, productionFiles, statementFreeDeclarations);
  const nonBlankStatementFree = statementFreeDeclarations
    .filter(({ path, sourceId }) => productionFiles.get(path) === sourceId)
    .filter(({ path }) => !isBlankMeasurement(coverageMetricsByFile.get(path)))
    .map(({ path }) => path)
    .sort();
  if (nonBlankStatementFree.length)
    throw new Error(
      `Coverage statementFree declarations are no longer blank: ${nonBlankStatementFree.join(", ")}. ` +
        "Remove each declaration so the file contributes its coverage records.",
    );
  for (const area of config.areas) {
    if (coverageFilesByArea[area.id] === 0)
      throw new Error(`Coverage data missing for area: ${area.id}`);
  }
  return report;
}

/**
 * The globs that decide *what gets measured*, plus the measured files permitted
 * to contribute nothing. Numbers alone cannot tell deleting an untested file
 * apart from carving one out of the measured set: both leave `covered` unchanged
 * and shrink `total`. Pinning the scope separates them, so the ratchets below
 * can judge coverage without also having to police the denominator.
 */
export function scopeSignature(config) {
  return {
    sources: config.sources.map((source) => ({
      id: source.id,
      root: source.root,
      include: [...source.include].sort(),
      exclude: [...excludePatterns(source)].sort(),
      statementFree: source.statementFree?.map(({ path }) => path).sort(),
      excludeTestOnlyItems: source.excludeTestOnlyItems ? true : undefined,
    })),
    areas: config.areas.map((area) => ({
      id: area.id,
      source: area.source,
      paths: [...area.paths].sort(),
    })),
  };
}

export function assertScopeMatchesBaseline(config, baseline) {
  if (baseline.version !== 1 || !baseline.areas)
    throw new Error("Unsupported coverage baseline format");
  const actualScope = JSON.stringify(scopeSignature(config));
  if (!baseline.scope) throw new Error("Coverage baseline is missing its recorded scope");
  if (JSON.stringify(baseline.scope) !== actualScope) {
    throw new Error(
      "Coverage measurement scope changed: source ids and roots, include globs, exclude globs, " +
        "statementFree declarations, test-only Rust exclusion, or area ids, sources, and paths no longer match the " +
        "baseline. Narrowing the measured set hides untested code without changing any " +
        "percentage. Re-record the scope subtree by hand, leave areas untouched, and prove " +
        "the edit is scope-only by comparing the parsed committed baseline with the parsed " +
        "working-tree baseline (see docs/coverage.md).",
    );
  }
}

export function assertBaseline(report, baseline, config) {
  const allowances = [];
  if (baseline.version !== 1 || !baseline.areas)
    throw new Error("Unsupported coverage baseline format");
  if (config) assertScopeMatchesBaseline(config, baseline);
  for (const [area, metrics] of Object.entries(report)) {
    const expected = baseline.areas[area];
    if (!expected) throw new Error(`Missing baseline for area: ${area}`);
    for (const metric of METRICS) {
      const actual = metrics[metric];
      const prior = expected[metric];
      if (!prior || !Number.isInteger(prior.covered) || !Number.isInteger(prior.total)) {
        throw new Error(`Missing ${metric} baseline for area: ${area}`);
      }
      // Two independent ratchets, and deliberately no third one on `total`:
      //   - covered may drop only by the measured shrink of `total`;
      //   - the ratio may never drop after the same adjustment, so untested
      //     code cannot be added to win (a growing total with unchanged
      //     covered fails here).
      //
      // Both comparisons run against a baseline shrunk by however many records
      // the measurement lost, because deleting a covered record lowers `covered`
      // and `total` together and would otherwise fail both clauses -- the ratio
      // included, since (c-1)/(t-1) < c/t for every ratio below 1. The name says
      // `shrink` rather than `deleted` on purpose: a smaller denominator is the
      // only thing observable here, and deletion is merely its likely cause, so
      // the allowance is bounded by the shrink and announced for every use
      // instead of being silently applied.
      const totalShrink = Math.max(0, prior.total - actual.total);
      const shrinkAdjusted = {
        covered: Math.max(0, prior.covered - totalShrink),
        total: prior.total - totalShrink,
      };
      const regressedUnadjusted =
        actual.covered < prior.covered ||
        actual.covered * prior.total < prior.covered * actual.total;
      const regressed =
        actual.covered < shrinkAdjusted.covered ||
        actual.covered * shrinkAdjusted.total < shrinkAdjusted.covered * actual.total;
      // Only an adjustment that actually changed the verdict is an allowance.
      // Reporting every shrink would announce "forgiven" for a deletion of
      // untested code, which needs no allowance and was never at risk.
      if (regressedUnadjusted && !regressed) allowances.push({ area, metric, totalShrink });
      if (regressed) {
        throw new Error(
          `${area} ${metric} regressed: ${actual.covered}/${actual.total}, baseline ${prior.covered}/${prior.total}`,
        );
      }
    }
  }
  for (const area of Object.keys(baseline.areas)) {
    if (!report[area]) throw new Error(`Baseline references unknown area: ${area}`);
  }
  return allowances;
}

function percentage({ covered, total }) {
  return total === 0 ? 100 : (covered / total) * 100;
}

export function assertAreaFloors(report, config) {
  for (const area of config.areas) {
    const floors = area.minimumCoverage;
    if (!floors) throw new Error(`Missing minimum coverage for area: ${area.id}`);
    const metrics = report[area.id];
    if (!metrics) throw new Error(`Missing coverage report for area: ${area.id}`);
    for (const metric of METRICS) {
      const minimum = floors[metric];
      if (typeof minimum !== "number" || minimum < 0 || minimum > 100) {
        throw new Error(`Invalid ${metric} minimum coverage for area: ${area.id}`);
      }
      const actual = metrics[metric];
      const actualPercentage = percentage(actual);
      if (actualPercentage < minimum) {
        throw new Error(
          `${area.id} ${metric} is below minimum coverage: ${actualPercentage.toFixed(2)}% < ${minimum.toFixed(2)}%`,
        );
      }
    }
  }
}

const defaultFileSystem = { rename: renameFile, unlink: unlinkFile, writeFile };

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validatePriorBaseline(baseline, source) {
  if (!isRecord(baseline) || baseline.version !== 1 || !isRecord(baseline.areas)) {
    throw new Error(
      `Invalid prior coverage baseline from ${source}: expected version 1 and an areas object`,
    );
  }
  for (const [area, metrics] of Object.entries(baseline.areas)) {
    if (!isRecord(metrics)) {
      throw new Error(
        `Invalid prior coverage baseline from ${source}: ${area} must contain all metrics`,
      );
    }
    for (const metric of METRICS) {
      const counts = metrics[metric];
      if (
        !isRecord(counts) ||
        !Number.isInteger(counts.covered) ||
        !Number.isInteger(counts.total) ||
        counts.covered < 0 ||
        counts.total < 0 ||
        counts.covered > counts.total
      ) {
        throw new Error(
          `Invalid prior coverage baseline from ${source}: ${area} ${metric} must have non-negative integer covered and total counts with covered <= total`,
        );
      }
    }
  }
  return baseline;
}

function gitFailure(args, result) {
  const command = `git ${args.join(" ")}`;
  const spawnError = result.error
    ? `; error.code=${result.error.code}; error.message=${JSON.stringify(result.error.message)}`
    : "";
  return new Error(
    `Failed to inspect prior coverage baseline with ${command}: status=${result.status}; stderr=${JSON.stringify(result.stderr ?? "")}${spawnError}`,
  );
}

function runGit(cwd, args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.error) throw gitFailure(args, result);
  return result;
}

async function readDiskBaseline(path) {
  try {
    const contents = await readFile(path, "utf8");
    let baseline;
    try {
      baseline = JSON.parse(contents);
    } catch (error) {
      throw new Error(`Invalid prior coverage baseline at ${path}: ${error.message}`);
    }
    return { source: path, baseline: validatePriorBaseline(baseline, path) };
  } catch (error) {
    if (error.code === "ENOENT") return { source: null, baseline: null };
    throw error;
  }
}

async function readPriorBaseline(path) {
  const directory = dirname(path);
  const file = basename(path);
  const revParseArgs = ["rev-parse", "--is-inside-work-tree"];
  const revParse = runGit(directory, revParseArgs);
  if (revParse.status !== 0) {
    if (/not a git repository/i.test(revParse.stderr ?? "")) return readDiskBaseline(path);
    throw gitFailure(revParseArgs, revParse);
  }

  const lsTreeArgs = ["ls-tree", "--full-name", "HEAD", "--", file];
  const lsTree = runGit(directory, lsTreeArgs);
  if (lsTree.status !== 0) throw gitFailure(lsTreeArgs, lsTree);
  const entries = (lsTree.stdout ?? "").trimEnd().split("\n").filter(Boolean);
  if (entries.length === 0) return readDiskBaseline(path);
  if (entries.length !== 1 || !entries[0].includes("\t")) {
    throw new Error(
      `Failed to inspect prior coverage baseline with git ${lsTreeArgs.join(" ")}: expected one tracked file entry; stderr=${JSON.stringify(lsTree.stderr ?? "")}`,
    );
  }

  const fullName = entries[0].slice(entries[0].indexOf("\t") + 1);
  const showArgs = ["show", `HEAD:${fullName}`];
  const show = runGit(directory, showArgs);
  if (show.status !== 0) throw gitFailure(showArgs, show);
  let baseline;
  try {
    baseline = JSON.parse(show.stdout);
  } catch (error) {
    throw new Error(
      `Invalid prior coverage baseline from git ${showArgs.join(" ")}: ${error.message}`,
    );
  }
  const source = `git ${showArgs.join(" ")}`;
  return { source, baseline: validatePriorBaseline(baseline, source) };
}

function scopeDiffPaths(before, after, prefix = "scope") {
  if (before === undefined || after === undefined) {
    return before === after ? [] : [prefix];
  }
  if (Array.isArray(before) || Array.isArray(after)) {
    if (!Array.isArray(before) || !Array.isArray(after)) return [prefix];
    const paths = [];
    const length = Math.max(before.length, after.length);
    for (let index = 0; index < length; index += 1) {
      paths.push(...scopeDiffPaths(before[index], after[index], `${prefix}[${index}]`));
    }
    return paths;
  }
  if (isRecord(before) || isRecord(after)) {
    if (!isRecord(before) || !isRecord(after)) return [prefix];
    const paths = [];
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
    for (const key of keys) {
      const beforeValue = Object.hasOwn(before, key) ? before[key] : undefined;
      const afterValue = Object.hasOwn(after, key) ? after[key] : undefined;
      paths.push(...scopeDiffPaths(beforeValue, afterValue, `${prefix}.${key}`));
    }
    return paths;
  }
  return Object.is(before, after) ? [] : [prefix];
}

function ratioDecreased(after, before) {
  if (before.total === 0) {
    return after.total !== 0 && after.covered < after.total;
  }
  return after.covered * before.total < before.covered * after.total;
}

function formatMetric(counts) {
  return `${counts.covered}/${counts.total} (${percentage(counts).toFixed(2)}%)`;
}

function printBaselineDeltas(report, prior) {
  const deltas = [];
  const priorAreas = prior ? prior.areas : {};
  const areas = [...new Set([...Object.keys(priorAreas), ...Object.keys(report)])].sort();
  for (const area of areas) {
    for (const metric of METRICS) {
      const priorArea = Object.hasOwn(priorAreas, area) ? priorAreas[area] : undefined;
      const reportArea = Object.hasOwn(report, area) ? report[area] : undefined;
      const before = priorArea?.[metric];
      const after = reportArea?.[metric];
      const coveredDecrease = Boolean(before && after && after.covered < before.covered);
      const ratioDecrease = Boolean(before && after && ratioDecreased(after, before));
      const removed = Boolean(before && !after);
      const decreased = coveredDecrease || ratioDecrease || removed;
      const from = before ? formatMetric(before) : "NEW";
      const to = after ? formatMetric(after) : "REMOVED";
      const marks = decreased ? " [DECREASE]" : !before && after ? " [NEW]" : "";
      console.log(`Coverage baseline delta: ${area} ${metric}: ${from} → ${to}${marks}`);
      if (decreased) {
        const reasons = [];
        if (removed) reasons.push("area removed");
        if (coveredDecrease) reasons.push(`covered count ${before.covered} → ${after.covered}`);
        if (ratioDecrease) {
          reasons.push(
            `ratio ${percentage(before).toFixed(2)}% → ${percentage(after).toFixed(2)}%`,
          );
        }
        deltas.push(`${area} ${metric} (${reasons.join(", ")})`);
      }
    }
  }
  return deltas;
}

function governingFinding(decisions, decisionId) {
  const entry = decisions
    .split(/^### /m)
    .map((section) => (section.startsWith("### ") ? section : `### ${section}`))
    .find((section) => section.split("\n", 1)[0].startsWith(`### ${decisionId} —`));
  if (!entry) return null;
  const line = entry.match(/^\* \*\*Governs:\*\*\s*(.*)$/m)?.[1];
  if (!line) return [];
  return line.split(/[^A-Za-z0-9_-]+/).filter(Boolean);
}

async function assertInstrumentChange(decisionId, finding, cwd) {
  const decisionsPath = resolve(cwd, "tasks/decisions.md");
  let decisions;
  try {
    decisions = await readFile(decisionsPath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(
        `Instrument change authorization requires tasks/decisions.md for decision ${decisionId} governing ${finding}`,
      );
    }
    throw error;
  }
  const governing = governingFinding(decisions, decisionId);
  if (governing === null) {
    throw new Error(
      `No decision entry found for --instrument-change ${decisionId} in tasks/decisions.md`,
    );
  }
  if (!governing.includes(finding)) {
    throw new Error(`Decision ${decisionId} does not govern finding ${finding}`);
  }
}

async function guardBaselineWrite({ areas, scope, path, instrumentChange, finding, cwd }) {
  const priorResult = await readPriorBaseline(path);
  const prior = priorResult.baseline;
  const decreases = printBaselineDeltas(areas, prior);
  const changedScope = prior ? scopeDiffPaths(prior.scope, scope) : [];
  const scopeKeys = changedScope.map((key) =>
    key.startsWith("scope.") ? key.slice("scope.".length) : key,
  );
  const previousAreas = prior ? Object.keys(prior.areas) : [];
  const nextAreas = Object.keys(areas);
  const previousAreaSet = new Set(previousAreas);
  const nextAreaSet = new Set(nextAreas);
  const addedAreas = prior ? nextAreas.filter((area) => !previousAreaSet.has(area)).sort() : [];
  const removedAreas = prior ? previousAreas.filter((area) => !nextAreaSet.has(area)).sort() : [];
  if (changedScope.length > 0) {
    console.log(`Coverage baseline scope changed: ${scopeKeys.join(", ")}`);
  }
  if (addedAreas.length > 0 || removedAreas.length > 0) {
    console.log(
      `Coverage baseline areas changed: added=[${addedAreas.join(", ")}], removed=[${removedAreas.join(", ")}]`,
    );
  }

  const changes = [];
  if (decreases.length > 0) changes.push(`decreases: ${decreases.join("; ")}`);
  if (scopeKeys.length > 0) changes.push(`scope keys changed: ${scopeKeys.join(", ")}`);
  if (addedAreas.length > 0 || removedAreas.length > 0) {
    changes.push(
      `areas changed: added=[${addedAreas.join(", ")}], removed=[${removedAreas.join(", ")}]`,
    );
  }
  if (changes.length === 0) return;
  if (!instrumentChange || !finding) {
    throw new Error(
      `Coverage baseline write refused (${changes.join("; ")}); pass --instrument-change <d-id> --finding <f-id>`,
    );
  }
  await assertInstrumentChange(instrumentChange, finding, cwd);
  console.log(
    `Coverage baseline write authorized by decision ${instrumentChange} for finding ${finding}`,
  );
}

async function cleanupTemporaryFile(unlink, temporaryPath) {
  try {
    await unlink(temporaryPath);
  } catch {
    // Preserve the primary failure. A failed cleanup leaves the temporary file as evidence.
  }
}

export async function writeBaseline({ areas, scope, path }, fileSystem = defaultFileSystem) {
  const temporaryPath = `${path}.tmp.json`;
  try {
    await fileSystem.writeFile(
      temporaryPath,
      `${JSON.stringify({ version: 1, scope, areas }, null, 2)}\n`,
    );
    // `JSON.stringify` cannot reproduce oxfmt's style (it collapses short arrays onto one line),
    // so a freshly written baseline fails `oxfmt --check` and therefore `pnpm lint:ci`. Formatting
    // it here keeps the trap out of the workflow: re-recording a baseline is rare and deliberate,
    // and discovering afterwards that the linter is red for a reason unrelated to your change is
    // exactly the kind of detour nobody remembers the fix for. Measured 2026-08-29, when it
    // reddened CI one commit after an authorized re-record.
    const formatter = resolve("node_modules/.bin/oxfmt");
    const formatted = spawnSync(formatter, [temporaryPath], { encoding: "utf8" });
    if (formatted.status !== 0 || formatted.error) {
      const spawnError = formatted.error;
      const errorDetails = spawnError
        ? `; error.code=${spawnError.code}; error.message=${JSON.stringify(spawnError.message)}`
        : "";
      throw new Error(
        `Failed to format coverage baseline with ${formatter}: status=${formatted.status}; ` +
          `signal=${formatted.signal}; stderr=${JSON.stringify(formatted.stderr ?? "")}${errorDetails}`,
      );
    }
    await fileSystem.rename(temporaryPath, path);
  } catch (error) {
    await cleanupTemporaryFile(fileSystem.unlink, temporaryPath);
    throw error;
  }
}

function parseArguments(argumentsList) {
  const options = { lcov: [], mappingOnly: false };
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === "--write-baseline") options.writeBaseline = true;
    else if (argument === "--mapping-only") options.mappingOnly = true;
    else if (argument === "--instrument-change" || argument === "--finding") {
      const value = argumentsList[++index];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${argument}`);
      if (argument === "--instrument-change") options.instrumentChange = value;
      else options.finding = value;
    } else if (["--config", "--baseline", "--lcov"].includes(argument)) {
      const value = argumentsList[++index];
      if (!value) throw new Error(`Missing value for ${argument}`);
      if (argument === "--lcov") options.lcov.push(value);
      else options[argument.slice(2)] = value;
    } else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!options.config || !options.baseline || (!options.mappingOnly && options.lcov.length === 0)) {
    throw new Error(
      "Usage: coverage-report.mjs --config <file> --baseline <file> --lcov <file> [--lcov <file>] [--mapping-only] [--write-baseline [--instrument-change <d-id> --finding <f-id>]]",
    );
  }
  if (options.mappingOnly && options.lcov.length > 0) {
    throw new Error("--mapping-only cannot be combined with --lcov");
  }
  if (options.mappingOnly && options.writeBaseline) {
    throw new Error("--mapping-only cannot be combined with --write-baseline");
  }
  const hasInstrumentChange = options.instrumentChange !== undefined;
  const hasFinding = options.finding !== undefined;
  if ((hasInstrumentChange || hasFinding) && !options.writeBaseline) {
    throw new Error("--instrument-change and --finding require --write-baseline");
  }
  if (hasInstrumentChange !== hasFinding) {
    throw new Error("--instrument-change and --finding must be used together");
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const root = process.cwd();
  const config = JSON.parse(await readFile(resolve(root, options.config), "utf8"));
  if (options.mappingOnly) {
    const baseline = JSON.parse(await readFile(resolve(root, options.baseline), "utf8"));
    assertScopeMatchesBaseline(config, baseline);
    const { productionFiles } = await assertCoverageMapping({ config, root });
    console.log(
      `Coverage mapping passed: ${productionFiles.size} production files across ${config.areas.length} areas`,
    );
    return;
  }
  const lcov = (
    await Promise.all(options.lcov.map((file) => readFile(resolve(root, file), "utf8")))
  ).join("\n");
  const areas = await buildCoverageReport({ config, configPath: options.config, lcov, root });
  if (options.writeBaseline) {
    const baselinePath = resolve(root, options.baseline);
    await guardBaselineWrite({
      areas,
      scope: scopeSignature(config),
      path: baselinePath,
      instrumentChange: options.instrumentChange,
      finding: options.finding,
      cwd: root,
    });
    await writeBaseline({
      areas,
      scope: scopeSignature(config),
      path: baselinePath,
    });
    console.log(`Wrote coverage baseline: ${options.baseline}`);
  } else {
    const baseline = JSON.parse(await readFile(resolve(root, options.baseline), "utf8"));
    const allowances = assertBaseline(areas, baseline, config);
    assertAreaFloors(areas, config);
    for (const { area, metric, totalShrink } of allowances) {
      console.log(
        `Coverage baseline allowance: ${area} ${metric}, ${totalShrink} record(s) forgiven due to total shrink`,
      );
    }
    console.log("Coverage ratchet and area floors passed");
  }
}

if (isEntrypoint(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
