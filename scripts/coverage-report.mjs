/**
 * The failure matrix for this artefact.
 *
 * `push-review-policy.md:211-219` asks that a verification artefact whose output is read as
 * evidence outside a test run carry, in its own header, the message and exit status each of its
 * assertions was *seen* to produce; `:221-243` asks that the enumeration be complete, every path
 * staged or argued. This script is such an artefact — `package.json:37,40` and
 * `.github/workflows/test.yml:157,230` cite its exit status for both coverage ratchets and both
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
 * **87 distinct failure paths**, plus one swallowed cleanup path that deliberately produces no
 * failure of its own (row 32) and one shared sink (row 41). No row is *argued*: every one is
 * staged. "Argued" is reserved for a path that could only be reached by editing the verifier,
 * doing harm that outlives the run, or touching something the run may not modify, and none of
 * these is. Rows are staged against scratch directories and scratch configs; nothing here names
 * `coverage-baselines.json` or `backend-coverage-baselines.json` as a target.
 *
 * Module-level rows are reached by calling the exported function directly, which is a real caller:
 * `scripts/coverage-report-tests.mjs` does the same. Their exit status is the CLI's only when they
 * are reached through it, and row 41 records what that is. `TypeError` rows are the wrong-shape
 * class and are recorded as what they are, not dressed up as diagnostics.
 *
 *  #  site                what fails                          message (to its distinguishing part)
 * --- ------------------- ---------------------------------- ------------------------------------
 *  1  :454    assignArea   no area claims a production file   `Unmapped production file: src/other.ts`
 *  2  :455    assignArea   two areas claim the same file      `Production file belongs to multiple
 *                                                             coverage areas: src/utils/a.ts
 *                                                             (utilities, second)`
 *  3  :509                 an area's declared source is not   `Coverage area utilities has the
 *                          the source the file came from      wrong source for src/utils/example.ts`
 *  4  :538                 a production file has no LCOV      `Coverage data missing for production
 *                          record at all                      files: src/utils/example.ts`
 *  5  :554                 an undeclared blank record         `Coverage measurement is blank for
 *                          (condition 1)                      production files: src/utils/blank.ts.`
 *  6  :564                 a declared path outside the        `Coverage statementFree declarations
 *                          measured set (condition 2)         are outside the measured production
 *                                                             set: src/gone.ts.`
 *  7  :574                 a declared path that is measured   `Coverage statementFree declarations
 *                          and not blank (condition 3)        are no longer blank:
 *                                                             src/utils/example.ts.`
 *  8  :580                 a configured area with no          `Coverage data missing for area:
 *                          measured file at all               empty`
 *  9  :475    ->           the source root is unreadable      `EACCES: permission denied, scandir
 *      files-below.mjs:5   (readdir at the root)              '<root>/src'`
 * 10  files-below.mjs:5    a directory *below* the source     `EACCES: permission denied, scandir
 *      via :9 recursion    root is unreadable                 '<root>/src/locked'`
 * 11  :471                 config of the wrong shape: `{}`    TypeError: `config.sources is not
 *                                                             iterable`
 * 12  :512                 `{"sources":[],"areas":null}`      TypeError: `Cannot read properties of
 *                                                             null (reading 'map')`
 * 13  :490    ->           a source with no `include` list    TypeError: `Cannot read properties of
 *      coverage-scope.mjs:34                                   undefined (reading 'some')`
 * 14  :491    ->           a source with no `exclude` list    TypeError: `Cannot read properties of
 *      coverage-scope.mjs:39                                   undefined (reading 'map')`
 * 14a :542                 a `statementFree` that is not an    TypeError: `(source.statementFree ??
 *                          array: `{}`                        []).map is not a function`
 * 14b :542                 a `statementFree` entry that is     TypeError: `Cannot destructure
 *                          not an object: `[null]`            property 'path' of 'object null' as
 *                                                             it is null.`
 * 15  :365    parseLcov    given something not a string       TypeError: `Cannot read properties of
 *                                                             null (reading 'replaceAll')`
 * 16  :613                 the baseline's version is not 1    `Unsupported coverage baseline format`
 *                          or it carries no `areas`
 * 17  :616                 no recorded scope, checked         `Coverage baseline is missing its
 *                          against a config                   recorded scope`
 * 18  :618                 the recorded scope no longer       `Coverage measurement scope changed:
 *                          matches the config                 source ids and roots, include globs,
 *                                                             exclude globs, statementFree
 *                                                             declarations, or area ids, sources,
 *                                                             and paths ... Re-record the scope
 *                                                             subtree by hand ...`
 * 19  :630                 a measured area the baseline       `Missing baseline for area: utilities`
 *                          does not carry
 * 20  :635                 a baseline area missing one        `Missing functions baseline for area:
 *                          metric                             utilities`
 * 21  :667                 a covered count or ratio           `utilities lines regressed: 1/2,
 *                          regressed                          baseline 2/2`
 * 22  :674                 a baseline area absent from the    `Baseline references unknown area:
 *                          report                             ghost`
 * 23  :612                 a baseline of the wrong shape:     TypeError: `Cannot read properties of
 *                          `null`                             null (reading 'version')`
 * 24  :682                 an area with no                    `Missing minimum coverage for area:
 *                          `minimumCoverage`                  utilities`
 * 25  :684                 an area with no entry in the       `Missing coverage report for area:
 *                          report. Reachable through the      utilities`
 *                          exported API, not through the
 *                          CLI, and it stays for that
 * 26  :688                 a minimum that is not a            `Invalid lines minimum coverage for
 *                          percentage                         area: utilities`
 * 27  :693                 a measured area below its floor    `utilities lines is below minimum
 *                                                             coverage: 50.00% < 80.00%`
 * 28  :972                 the temporary write rejects        the rejection, unchanged:
 *                                                             `writeFile refused`
 * 29  :989                 the formatter exits non-zero       `Failed to format coverage baseline
 *                                                             with <path>: status=23; signal=null;
 *                                                             stderr="rejected"`
 * 29b :989                 the formatter is killed by a       `... status=null; signal=SIGTERM;
 *                          signal                             stderr=""` -- `status !== 0` is true
 *                                                             for `null`, so a kill is caught
 *                                                             rather than reported as success
 * 30  :989                 the formatter binary is missing    `... status=null; signal=null;
 *                                                             stderr=""; error.code=ENOENT;
 *                                                             error.message="spawnSync <path>
 *                                                             ENOENT"`
 * 31  :994                 the rename into place rejects      the rejection, unchanged:
 *                                                             `rename refused`
 * 32  :963                 cleanup's unlink rejects after a   **no failure of its own**: the
 *                          failure. Deliberately swallowed    primary error is rethrown unchanged
 *                          so it cannot replace the           (`rename refused`) and the temporary
 *                          actionable error                   file survives as evidence
 * 33  :1013                an option with no value            `Missing value for --config`
 *                                                             — exit 1
 * 34  :1016                an unknown argument                `Unknown argument: --nope` — exit 1
 * 35  :1019                a required option omitted          `Usage: coverage-report.mjs --config
 *                                                             <file> ...` — exit 1
 * 36  :1037                the config file does not exist     `ENOENT: no such file or directory,
 *                                                             open '<root>/missing.json'` — exit 1
 * 37  :1037                the config file is not JSON        SyntaxError: `Expected property name
 *                                                             or '}' in JSON at position 2` — exit 1
 * 38  :1039                an LCOV file does not exist        `ENOENT: ... '<root>/missing.info'`
 *                                                             — exit 1
 * 39  :1059                the baseline file does not exist   `ENOENT: ... '<root>/missing.json'`
 *                                                             — exit 1
 * 40  :1059                the baseline file is not JSON      SyntaxError, as row 37 — exit 1
 * 41  :1074                `main().catch` — the shared sink,  every CLI throw, reached through
 *                          **not an independent failure**     the CLI, prints `error.message` on
 *                                                             stderr and exits **1**. Measured with
 *                                                             row 17's throw: exit 1, message on
 *                                                             stderr, nothing on stdout
 * 42  :761    write guard  prior baseline is not JSON          `Invalid prior coverage baseline at
 *                                                             <path>: <JSON parse message>` — exit 1
 * 43  :709    validate     prior version or `areas` is         `Invalid prior coverage baseline
 *                          wrong-shaped                        from <path>: expected version 1
 *                                                             and an areas object` — exit 1
 * 44  :715    validate     a prior area's metrics container    `Invalid prior coverage baseline
 *                          is not an object                     from <path>: utilities must
 *                                                             contain all metrics` — exit 1
 * 45  :729    validate     a prior area is missing one metric  `Invalid prior coverage baseline
 *                                                             from <path>: utilities lines must
 *                                                             have non-negative integer covered
 *                                                             and total counts with covered <=
 *                                                             total` — exit 1
 * 46  :729    validate     prior `covered` is not an integer  same invalid-count message, with
 *                                                             `covered: "bad"` — exit 1
 * 47  :729    validate     prior `covered` is negative        same invalid-count message, with
 *                                                             `covered: -1` — exit 1
 * 48  :729    validate     prior `covered > total`             same invalid-count message, with
 *                                                             `covered: 2, total: 1` — exit 1
 * 49  :729    validate     prior `covered` is fractional      same invalid-count message, with
 *                                                             `covered: 1.5` — exit 1
 * 50  :729    validate     prior `total` is fractional        same invalid-count message, with
 *                                                             `total: 2.5` — exit 1
 * 51  :729    validate     prior `total` is negative          same invalid-count message, with
 *                                                             `total: -1` — exit 1
 * 52  :951    write guard  covered count decreases while the  `Coverage baseline write refused
 *                          ratio stays level                    (decreases: utilities lines
 *                                                             (covered count 10 → 9)); ...` — exit 1
 * 53  :951    write guard  ratio decreases while `covered`   `Coverage baseline write refused
 *                          rises                                (decreases: utilities lines
 *                                                             (ratio 50.00% → 46.15%)); ...` — exit 1
 * 54  :951    write guard  an area is removed                 `Coverage baseline write refused
 *                                                             (... retired lines (area removed)
 *                                                             ...); ...` — exit 1
 * 55  :840→951 ratio check `0/0 → 0/1` is a decrease          `Coverage baseline write refused
 *                                                             (... utilities lines (ratio
 *                                                             100.00% → 0.00%)); ...` — exit 1
 * 56  :951    write guard  recorded scope changes             `Coverage baseline write refused
 *                                                             (... scope keys changed:
 *                                                             sources[0].exclude[0]); ...` — exit 1
 * 57  :951    write guard  an area is added                   `Coverage baseline write refused
 *                                                             (... areas changed: added=[puzzles],
 *                                                             removed=[]); ...` — exit 1
 * 58  :901    authorize    `tasks/decisions.md` is missing    `Instrument change authorization
 *                                                             requires tasks/decisions.md for
 *                                                             decision d-20260927-23 governing
 *                                                             f-20260829-04` — exit 1
 * 59  :909    authorize    decision id has no entry           `No decision entry found for
 *                                                             --instrument-change d-20260927-23
 *                                                             in tasks/decisions.md` — exit 1
 * 60  :914    authorize    `Governs:` misses the exact finding `Decision d-20260927-23 does not
 *                                                             govern finding f-20260829-04` — exit 1
 * 61  :1008   parse         `--instrument-change` has no value `Missing value for
 *                                                             --instrument-change` — exit 1
 * 62  :1008   parse         `--finding` has no value           `Missing value for --finding` — exit 1
 * 63  :1026   parse         authorization flags without       `--instrument-change and --finding
 *                          `--write-baseline`                 require --write-baseline` — exit 1
 * 64  :1029   parse         only `--instrument-change`        `--instrument-change and --finding
 *                                                             must be used together` — exit 1
 * 65  :1029   parse         only `--finding`                  `--instrument-change and --finding
 *                                                             must be used together` — exit 1
 * 66  :777    git           `rev-parse` fails for another     `Failed to inspect prior coverage
 *                          reason than not-a-repository        baseline with git rev-parse
 *                                                             --is-inside-work-tree: status=37;
 *                                                             stderr="fatal: simulated repository
 *                                                             metadata error\n"` — exit 1
 * 67  :750    git           git cannot be spawned             `Failed to inspect prior coverage
 *                                                             baseline with git rev-parse
 *                                                             --is-inside-work-tree: status=null;
 *                                                             stderr=""; error.code=ENOENT;
 *                                                             error.message="spawnSync git
 *                                                             ENOENT"` — exit 1
 * 68  :782    git           `ls-tree` fails for unborn `HEAD` `Failed to inspect prior coverage
 *                                                             baseline with git ls-tree
 *                                                             --full-name HEAD -- scratch-
 *                                                             baseline.json: status=128;
 *                                                             stderr="fatal: Not a valid object
 *                                                             name HEAD\n"` — exit 1
 * 69  :786    git           `ls-tree` output is ambiguous or  `Failed to inspect prior coverage
 *                          malformed                            baseline with git ls-tree
 *                                                             --full-name HEAD -- scratch-
 *                                                             baseline.json: expected one tracked
 *                                                             file entry; stderr=""` — exit 1
 * 70  :794    git           `show` fails for a tracked path    `Failed to inspect prior coverage
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
 * What this matrix does **not** cover, stated rather than implied: `parseLcov`'s tolerance of
 * malformed counter lines, which fail no assertion and are merged as written — a non-numeric hit
 * count is coerced, and an `FNDA` with no matching `FN` in its record becomes a phantom function
 * (`f-20260922-05`) — and the behaviour of any consumer of this script beyond its exit status and
 * `error.message`.
 */
import { spawnSync } from "node:child_process";
import { readFile, rename as renameFile, unlink as unlinkFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { excluded, excludePatterns, matches, normalisePath } from "./coverage-scope.mjs";
import { isEntrypoint } from "./entrypoint.mjs";
import { filesBelow } from "./files-below.mjs";
import { scanRustTestOnly, validateExclusionConfig } from "./rust-test-only.mjs";

const METRICS = ["lines", "functions", "branches"];

// Counter identities are built from LCOV field values, which are unvalidated text: a field may
// contain any character, including whatever separator the identity would otherwise be joined on.
// `FN:<line>,<name>` splits on the first comma, so `FN:1,f:g` is line `1`, name `f:g` while
// `FN:1:f,g` is line `1:f`, name `g` -- two declarations a colon-joined key merged into one. Every
// other separator has an input that does the same to it. Encoding the fields as a JSON array is
// injective for arbitrary strings, so the question does not arise again.
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

  for (const rawLine of lcov.replaceAll("\r\n", "\n").split("\n")) {
    if (rawLine === "end_of_record") {
      mergeReport(report);
      report = undefined;
      continue;
    }
    if (!rawLine) continue;
    const separator = rawLine.indexOf(":");
    const key = separator === -1 ? rawLine : rawLine.slice(0, separator);
    const value = separator === -1 ? "" : rawLine.slice(separator + 1);
    if (key === "SF") {
      report = {
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
    if (!report) continue;
    if (key === "DA") {
      const [line, hits, checksum = ""] = value.split(",");
      if (includeLine(report.file, Number(line))) {
        addCounter(report.lines, identity(line, checksum), Number(hits));
      }
    } else if (key === "FN") {
      // The occurrence index counts same-named declarations *on the same line*, not same-named
      // declarations anywhere in the file. Both spellings disambiguate the only case that needs
      // it -- two functions sharing a name and a line -- but only this one is independent of
      // declaration order, and two records for one file need not list their functions in the same
      // order. Counting per name made `FN:10,f; FN:20,f` and `FN:20,f; FN:10,f` four distinct
      // functions instead of two. `functionIdsByName` keeps declaration order regardless, because
      // that is what pairs an `FNDA` line with its `FN`.
      const [line, name] = value.split(",");
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
      const [hits, name] = value.split(",");
      const occurrence = report.functionDataOccurrences.get(name) ?? 0;
      // `null` where a declaration would carry its line: no `FN` line can produce it, so an
      // `FNDA` with no matching declaration cannot collide with a real function.
      const declaration = report.functionIdsByName.get(name)?.[occurrence];
      report.functionDataOccurrences.set(name, occurrence + 1);
      if (!declaration || declaration.included) {
        const functionIdentity = declaration?.identity ?? identity(null, name, occurrence);
        addCounter(report.functions, functionIdentity, Number(hits));
      }
    } else if (key === "BRDA") {
      const [line, block, branch, hits] = value.split(",");
      if (includeLine(report.file, Number(line))) {
        addCounter(report.branches, identity(line, block, branch), hits === "-" ? 0 : Number(hits));
      }
    }
  }
  mergeReport(report);
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

export async function buildCoverageReport({ config, configPath, lcov, root }) {
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

  // Every production file's area must belong to the source the file came from. This is the only
  // place that is checked, and the LCOV loop below deliberately does not repeat it: it reaches a
  // record only when `productionFiles` already holds the file, this loop has run the identical
  // comparison over every entry of that map, and neither the map nor `assignArea` -- a pure
  // function of (path, config) -- changes in between. The duplicate copy was therefore dead for
  // every input and unreachable by any caller, being interior to this function, and was removed
  // (`f-20260921-02`). `assertAreaFloors`' similar-looking branch is a different case: it is
  // exported and the tests call it directly, so it stays.
  for (const [file, sourceId] of productionFiles) {
    const area = assignArea(file, config);
    if (area.source !== sourceId)
      throw new Error(`Coverage area ${area.id} has the wrong source for ${file}`);
  }

  const report = Object.fromEntries(config.areas.map((area) => [area.id, emptyMetrics()]));
  const coverageFilesByArea = Object.fromEntries(config.areas.map((area) => [area.id, 0]));
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
    const area = assignArea(file, config);
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
  const statementFreeDeclarations = config.sources.flatMap((source) =>
    (source.statementFree ?? []).map(({ path }) => ({ path, sourceId: source.id })),
  );
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
  const deadStatementFree = statementFreeDeclarations
    .filter(({ path, sourceId }) => productionFiles.get(path) !== sourceId)
    .map(({ path }) => path)
    .sort();
  if (deadStatementFree.length)
    throw new Error(
      `Coverage statementFree declarations are outside the measured production set: ${deadStatementFree.join(", ")}. ` +
        "Remove each dead declaration or restore the file to the measured production set.",
    );
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

export function assertBaseline(report, baseline, config) {
  const allowances = [];
  if (baseline.version !== 1 || !baseline.areas)
    throw new Error("Unsupported coverage baseline format");
  if (config) {
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
  const options = { lcov: [] };
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === "--write-baseline") options.writeBaseline = true;
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
  if (!options.config || !options.baseline || options.lcov.length === 0) {
    throw new Error(
      "Usage: coverage-report.mjs --config <file> --baseline <file> --lcov <file> [--lcov <file>] [--write-baseline [--instrument-change <d-id> --finding <f-id>]]",
    );
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
