# Comment dialect and inline comment flow — plan review handoff

Finding: f-20261001-10. Plan: `2026-10-11-comment-dialect-and-inline-flow.md`. BASE: `8b3e94cbdfa1b3c1638ba73c31d46f8bbd1b821e`.
PLAN-ONLY drain planner run (session d821472a-f457-45ef-8d6d-24425e1db68a): no source changes,
tests, browser, dev server, ledger command, commit or push. The adopting session records the plan's
`## Decided autonomously` entries before implementation. The plan's `## Carried to diff review`
item CR-1 goes verbatim into the phase-1 brief and every step-6 lens packet. Raw lens reports,
prompts and probe scripts were under `/tmp/drain-plan-chessfable-0a459a4f-slot1/build/`; the raw
reports are reproduced below, so this record stands alone. The following is the complete
append-only review history.

Disclosure: plan authorship and arbitration shared one Claude context. Detection ran in separate
Codex leaves (OpenAI high tier), a different model family from the orchestrator.

## Reviews

### Round 1 — plan-r1 (12 lenses, every plan-capable lens)

Wall elapsed 354 s (first prompt 1791709851 → last report 1791710205); no waits. Verdicts:
REVISE — plan, correctness, tests; APPROVED — minimalism, error-handling (one should-fix),
chess-semantics; NOT APPLICABLE + APPROVED — engine-protocol, ipc-contract, persisted-state,
pgn-index, platform-semantics, tauri-security.

| ID | Claim | Witnesses (lens#finding) | Evidence checked by the arbiter | Disposition | Authority | Status |
| --- | --- | --- | --- | --- | --- | --- |
| I1 | Disabling fenced code but keeping inline code spans turns ```` ```\nx\n``` ```` into a lossy inline code span in reader and editor | correctness-r1#1, plan-r1#1 | probe `codefree.mjs keep-code`: reader `inlineCode="hello"`, editor writes `` `hello` `` (P14) | Fix — code leaves the dialect (O1, O2; decision 1) | MANDATE "at minimum disable the block constructs"; O1 literal-text contract | open → closure r2 |
| I2 | Reader drops leading spaces of `    indented`; "no character lost" contract not met, reader and editor inconsistent | correctness-r1#2, plan-r1#1 | probe `remark.mjs`: `paragraph(text="indented")`; editor keeps the spaces (P14) | Fix — O1 contract: no non-whitespace character lost; reader display-only under HTML collapsing; editor byte-exact | MANDATE Defect (1), plain-text comments | open → closure r2 |
| I3 | "Inline builder only" also changes table-view variation runs | plan-r1#2 | `notationRows.ts:151-160`, `:343`, `:359`, `:365`, `:370` (P15) | Fix — O3 states the table view's variation runs follow the flow; mainline table rows unchanged; new table-view test (decision 4) | MANDATE "Let short single-line comments stay inline in the move flow" | open → closure r2 |
| I4 | Tall rows: centring the row hides the current move | plan-r1#3 | `GameNotation.tsx:89-103` (P16) | Fix — new O5 (scroll to the current move's cell), proven in the container (phase 3) | MANDATE "Let short single-line comments stay inline…" (necessary correctness of O3) | open → closure r2 |
| I5 | No proof that `GameNotation` forwards the starting comment to the cell | plan-r1#4 | `GameNotation.tsx:300-316` `moveProps`; `GameNotation.test.tsx:34-40,59-75` hides comments and mocks the cell | Fix — O3 verification adds a `GameNotation.test.tsx` forwarding assertion | MANDATE (O3 verification) | open → closure r2 |
| I6 | Parser/serializer failure semantics undefined in O2 | error-handling-r1#1 | `AnnotationEditor.tsx:38-40`: the store is written only from `onUpdate` on a user edit, so a load can never overwrite a comment; the P9 throw class is removed because parser and schema now match, and O2's mounted test loads every case | Skip — no failure path the plan introduces; a new error surface for an unobserved failure is outside MANDATE (confidence 92, verdict APPROVED) | — | closed (Skip) |
| I7 | O2 tests bypass `AnnotationEditor` (toolbar, input rules, store write) | tests-r1#1 | `AnnotationEditor.tsx:93-105` controls, `:38-40` `setComment` path | Fix — O2 verification mounts the production component in a `TreeStateContext` store | MANDATE "the Annotate editor … output format must be checked" | open → closure r2 |
| I8 | O1 assertions do not prove retained inline formatting | tests-r1#2 | test-assertion detail inside unchanged O1 | Fix — carried to CR-1 | — | carried (CR-1) |

Round 1 adopted plan-level corrections: 6 (I1, I2, I3, I4, I5, I7); carried 1 (I8 → CR-1);
skipped 1 (I6). Unique issues opened 8; resolved 1 (Skip); carried 1; open 6.

#### lens-plan-r1 (raw)

```text
[blocker] tasks/plans/.plan-2026-10-11-comment-dialect-and-inline-flow.md-r1.body.md:124 — O1/O2’s parser mechanism does not preserve literal block text. Running the supplied `remark.mjs:9` and `tiptap3.mjs:11` mechanisms with `"```\nfenced text\n```"` produces an `inlineCode` node in the reader and ``"`fenced text`"`` from the editor. The fences and line breaks disappear, contrary to O1 and O2:152. The reader probe also drops all four spaces from `"    indented"`. Require a preservation mechanism and shared regression cases for both inputs (confidence: 100).

[blocker] tasks/plans/.plan-2026-10-11-comment-dialect-and-inline-flow.md-r1.body.md:177 — The “inline builder only” boundary does not preserve table view as promised at line 188. `notationRows.ts:159` routes variation rendering through `appendInlineTasks`, and table view calls that route at `notationRows.ts:343`, `:359`, `:365` and `:370`. Removing comment boundaries and starting-comment rows therefore changes table-view variations too. The retained table tests at `notationRows.test.ts:251` cover mainline moves, so they would miss this consumer. Specify how table-view variations retain their current behavior and prove that boundary (confidence: 100).

[blocker] tasks/plans/.plan-2026-10-11-comment-dialect-and-inline-flow.md-r1.body.md:185 — Combining multiline comments into tall rows breaks current-move visibility. `GameNotation.tsx:93` resolves navigation to a row, then `:99` centers the whole row rather than the selected move. The installed virtualizer’s center-offset probe returned visible coordinates `[384,576]` for a 960px row in a 192px viewport, hiding moves near either end. Multiline comments render as blocks at `Comment.tsx:56`, so this is reachable through ordinary annotated games. Dynamic measurement prevents overlapping rows, but does not reveal the selected move. O3 needs a navigation obligation and proof for rows taller than the viewport (confidence: 96).

[blocker] tasks/plans/.plan-2026-10-11-comment-dialect-and-inline-flow.md-r1.body.md:192 — The proofs do not verify that starting comments reach the notation through `GameNotation`. Row-model tests and direct cell tests can pass while `GameNotation.tsx:304` drops the new value. Existing integration tests hide comments at `GameNotation.test.tsx:39` and mock the cell without displaying comment props at `:68`. O4’s fixture contains only move comments. Require an integration assertion that fails when starting-comment forwarding is omitted (confidence: 98).

VERDICT: REVISE
```

#### lens-minimalism-r1 (raw)

```text
No bloat or duplication defects found.

Minimum-diff counterfactual: the new editor test verifies round-trip behavior, the shared case list serves both parser tests, and the single new snapshot supplies the mandated pixel proof. No proposed added file is demonstrably unnecessary.

VERDICT: APPROVED
```

#### lens-correctness-r1 (raw)

```text
[blocker] tasks/plans/.plan-2026-10-11-comment-dialect-and-inline-flow.md-r1.body.md:150 — Disabling block tokenizers leaves fenced backticks consumed by inline-code parsing. Using the supplied probes with `"```\nhello\n```"`, the reader produces `inlineCode="hello"` and the editor serializes `` `hello` ``. After an edit it writes `` `!hello` ``, losing the fences and newlines. O1 requires literal block syntax, and O2 requires preservation outside edited characters. This is not a P10 exception. (confidence: 100)

[blocker] tasks/plans/.plan-2026-10-11-comment-dialect-and-inline-flow.md-r1.body.md:124 — Parse-time disabling of indented code drops leading whitespace. The reader probe maps `"    indented"` to `paragraph(text="indented")`, while the editor preserves all four spaces. The proposed mechanisms therefore violate O1’s character-preservation guarantee and leave reader/editor behavior inconsistent. The plan needs a source-preservation contract for this case. (confidence: 100)

VERDICT: REVISE
```

#### lens-error-handling-r1 (raw)

```text
[should-fix] tasks/plans/.plan-2026-10-11-comment-dialect-and-inline-flow.md-r1.body.md:150 — O2 specifies successful round trips but leaves parser and serializer failure semantics undefined. Current editor creation, `setContent` and `getMarkdown` calls have no error handling. Specify that failure preserves the original comment, prevents replacement writes, and surfaces a distinguishable error. Include failure-path proof alongside the round-trip tests (confidence: 92).

VERDICT: APPROVED
```

#### lens-tests-r1 (raw)

```text
[blocker] tasks/plans/.plan-2026-10-11-comment-dialect-and-inline-flow.md-r1.body.md:164 — O2 tests construct an editor and serialize directly, without exercising AnnotationEditor’s toolbar, typing input rules, or saved store value. Restoring block controls or breaking `onUpdate → setComment` would leave these proofs green. O4 only visits the preview, so the container suite supplies no editor proof either. Add a mounted editor journey asserting block controls are absent, typed block markers remain text, and an edit saves the expected comment. (confidence: 97)

[should-fix] tasks/plans/.plan-2026-10-11-comment-dialect-and-inline-flow.md-r1.body.md:131 — Rendered-text and forbidden-block assertions do not prove retained inline formatting. Replacing strong, emphasis, strike, and links with unformatted text would preserve those assertions and the existing underline/code tests. Assert the formatting elements and link destinations, including formatting within literal block-looking prose. (confidence: 96)

VERDICT: REVISE
```

#### lens-chess-semantics-r1 (raw)

```text
No chess-domain invariant violations found in plan-r1. The proposed flow preserves node ownership, root-anchored move numbering, path reconstruction, and separately stored comment metadata.

VERDICT: APPROVED
```

#### lens-engine-protocol-r1 (raw)

```text
NOT APPLICABLE: The plan’s files and obligations cover comment parsing, editor formatting, notation layout and pixel verification. They do not change engine process supervision, UCI protocol state or asynchronous engine result routing.
VERDICT: APPROVED
```

#### lens-ipc-contract-r1 (raw)

```text
NOT APPLICABLE: O1–O4 cover renderer comment parsing, editor formatting, notation layout and pixel verification. No Rust commands, events, IPC payloads, subscriptions or capability scopes are changed.
VERDICT: APPROVED
```

#### lens-persisted-state-r1 (raw)

```text
NOT APPLICABLE: The plan’s files and obligations change comment parsing, editor formatting and notation layout. They do not change renderer storage encoding, keys, atom families, hydration or tab lifecycle.

VERDICT: APPROVED
```

#### lens-pgn-index-r1 (raw)

```text
NOT APPLICABLE: O1–O4 change comment rendering, editor Markdown parsing, notation layout and pixel tests. They do not change PGN byte scanning, offsets, move encoding, database storage, search or disk export.

VERDICT: APPROVED
```

#### lens-platform-semantics-r1 (raw)

```text
NOT APPLICABLE: O1–O4 change JavaScript comment parsing, editor configuration and notation layout. They introduce no OS-specific paths, handles, filesystem operations, FFI or target branches. Container pixels do not claim macOS or Windows runtime proof.
VERDICT: APPROVED
```

#### lens-tauri-security-r1 (raw)

```text
NOT APPLICABLE: The plan’s files and O1–O4 obligations cover renderer comment parsing, editor formatting, notation layout and pixel tests. They introduce no credentials, session persistence, native filesystem authority or mutation, signed downloads, or backend diagnostic flows.

VERDICT: APPROVED
```

### Round 2 — plan-r2 (closure round: plan, correctness, tests; newly affected: minimalism, chess-semantics)

Wall elapsed 213 s (first prompt 1791710525 → last report 1791710738); no waits. Verdicts:
APPROVED — plan, tests, minimalism, chess-semantics; REVISE — correctness (one new blocker).

| ID | Closure result r2 |
| --- | --- |
| I1 | CLOSED — correctness-r2, plan-r2 (both re-ran `codefree.mjs` with and without `keep-code`) |
| I2 | CLOSED — correctness-r2, plan-r2 |
| I3 | CLOSED — plan-r2 |
| I4 | CLOSED — plan-r2 |
| I5 | CLOSED — plan-r2 |
| I7 | CLOSED — plan-r2, tests-r2 |

New issue:

| ID | Claim | Witnesses (lens#finding) | Evidence checked by the arbiter | Disposition | Authority | Status |
| --- | --- | --- | --- | --- | --- | --- |
| I9 | Table view reads a black move's alternatives from the black move's own children, so `1. e4 e5 (1... c5) 2. Nf3` never shows `c5` (and its comments) unless `Nf3` has alternatives, in which case an empty variation row is emitted | correctness-r2#1 | read `notationRows.ts:348-370` (`blackVariations = black.children.slice(1)` vs rows built from `child`), `:333`/`:340` for the correct black-only branch; the existing table test `notationRows.test.ts:112-126` cannot see it; introduced by `88ad35ef` (P17) | Fix — O3 table-view bullet: a black move's variations are the white move's other children; two new table-view tests | Same-area defect in the O3 builder (rule 4b; plan-only "same-area findings become plan obligations"); O3's table-variation flow clause (I3) depends on it | open → closure r3 |

Lineage: I9 is a newly found pre-existing defect (not correction-introduced); it surfaced because I3
extended O3 to table-view variation runs. Round 2 adopted plan-level corrections: 1 (I9). Unique
issues opened 9 cumulative; resolved 7 (I1–I5, I7 closed, I6 Skip); carried 1 (I8 → CR-1);
open 1 (I9).

#### lens-plan-r2 (raw)

```text
I1 CLOSED — plan-r2 O1/O2 disable inline code as well as code blocks. Both `codefree.mjs` runs confirm the correction preserves fences and backticks, while `keep-code` reproduces the loss (confidence: 100).

I2 CLOSED — `tasks/plans/.plan-2026-10-11-comment-dialect-and-inline-flow.md-r2.body.md:141` distinguishes display whitespace from editor preservation. The probe confirms indented text survives and the editor retains its spaces (confidence: 100).

I3 CLOSED — plan-r2:203 covers table-view variation runs and requires their regression test at :227. This matches `src/components/common/notationRows.ts:160`, :343, :359, :365 and :370 (confidence: 100).

I4 CLOSED — plan-r2:240 requires visibility of the move’s own cell and layout proof at :245, addressing row-centering at `src/components/common/GameNotation.tsx:99` (confidence: 96).

I5 CLOSED — plan-r2:230 requires a mounted forwarding assertion through `GameNotation`, covering the boundary at `src/components/common/GameNotation.tsx:304` that the existing mock at `GameNotation.test.tsx:68` does not expose (confidence: 99).

I7 CLOSED — plan-r2:186 requires the production editor, toolbar, typing rules and store-write journey, covering `src/components/panels/annotation/AnnotationEditor.tsx:24`, :40 and :93 (confidence: 99).

VERDICT: APPROVED
```

#### lens-correctness-r2 (raw)

```text
I1 CLOSED — O1/O2 disable inline code too. Both `codefree.mjs` runs confirm that disabling it preserves fenced text and editor round trips, while `keep-code` collapses the fences.

I2 CLOSED — O1 explicitly permits display-only whitespace collapsing. O2 retains byte-exact editor whitespace, confirmed for `    indented` by the probe.

[blocker] src/components/common/notationRows.ts:349 — O3’s expanded table-variation contract leaves a caller/builder mismatch unresolved. For `1. e4 e5 ({before} 1... c5 {after}) 2. Nf3`, `blackVariations` reads `e5.children.slice(1)` instead of `e4.children.slice(1)`. With no alternative to `Nf3`, the predicate is false, so `c5` and both comments never reach the inline builder. Correct the producer’s predicate while preserving mainline table rows. (confidence: 100)

VERDICT: REVISE
```

#### lens-tests-r2 (raw)

```text
I7 CLOSED — O2 now mounts production `AnnotationEditor` in `TreeStateContext` and asserts toolbar controls, typed markers, load-without-write, and the saved store value after an edit. Restoring block controls or breaking `onUpdate → setComment` would fail these assertions.

VERDICT: APPROVED
```

#### lens-minimalism-r2 (raw)

```text
VERDICT: APPROVED
```

#### lens-chess-semantics-r2 (raw)

```text
VERDICT: APPROVED
```

### Round 3 — plan-r3 (closure round: plan, correctness; newly affected: chess-semantics)

Wall elapsed 91 s (first prompt 1791710820 → last report 1791710911); no waits. Verdicts: APPROVED —
plan, correctness, chess-semantics. No new findings.

| ID | Closure result r3 |
| --- | --- |
| I9 | CLOSED — correctness-r3, plan-r3, chess-semantics-r3 |

Round 3 adopted plan-level corrections: 0. Final totals: 3 completed rounds (r1=6 r2=1 r3=0), 658 s
review wall time (354 + 213 + 91; active review time equals wall time, no waits); 9 unique issues
opened; 7 closed by reviewer closure checks (I1, I2, I3, I4, I5, I7 in r2; I9 in r3); 1 Skip (I6);
1 carried to the cumulative diff review (I8 → CR-1); 0 open; 0 Defer; 0 withdrawn; no rewrite or
split. Correction-introduced defects: none (I9 is a pre-existing `88ad35ef` defect surfaced by the
I3 correction's wider scope). Plan authorship and arbitration were one Claude context; detection ran
in separate Codex leaves (OpenAI high tier, `review-plan` role for the plan lens and `sensitive` for
the others because `package.json` / `pnpm-lock.yaml` are Sensitive-Path globs), a different model
family from the orchestrator; the prospective implementation is a Codex write leaf, so diff review
will be same-family with the code author.

#### lens-plan-r3 (raw)

```text
I9 CLOSED — plan-r3 O3 at tasks/plans/.plan-2026-10-11-comment-dialect-and-inline-flow.md-r3.body.md:225 corrects black-variation ownership to match the builder calls at src/components/common/notationRows.ts:365 and :370. Verification at plan-r3:239 covers missing `c5`, duplicate variations and empty rows, which the existing notationRows.test.ts:112 test misses (confidence: 100).

VERDICT: APPROVED
```

#### lens-correctness-r3 (raw)

```text
I9 CLOSED — O3 now requires black-move alternatives from the white move’s other children, matching the parent passed to the inline builder at notationRows.ts:365/370. Verification covers c5 without an Nf3 alternative and both variation sets appearing exactly once without empty rows.

VERDICT: APPROVED
```

#### lens-chess-semantics-r3 (raw)

```text
I9 CLOSED — P17 and O3 correctly locate `e5`’s alternatives in `e4.children.slice(1)`. Required tests cover `1. e4 e5 (1... c5) 2. Nf3`, both without and with an alternative to `Nf3`, asserting correct placement, exactly-once rendering and no empty variation row. No additional chess-domain blockers found.

VERDICT: APPROVED
```

### Round 4 — plan-r4 (PLAN-REFRESH drift round, 12 lenses from REFRESH-LENSES)

Plan refresh by drain planner session 9f3302f1-28a2-4a42-9755-f14e47a1f89e: old BASE
`8b3e94cbdfa1b3c1638ba73c31d46f8bbd1b821e` → NEW-BASE `b5385ac206ca34456c2ec71613fe24144bcc452d`
(137 commits, 232 files; drift file `drift-8b3e94cbdfa1b3c1638ba73c31d46f8bbd1b821e-b5385ac206ca34456c2ec71613fe24144bcc452d.diff`,
exactly `git diff <old>..<new>`). The plan text is unchanged since plan-r3 (plan-r4 differs only in
this record). Drift touching the plan's files or traced premises, given to every lens:
`GameNotation.tsx`/`GameNotation.test.tsx` (per-tab atoms now `useTabAtom(showCommentsFamily)` etc.,
`159de8ec`/`c21fce13`), `CompleteMoveCell.tsx`/`CompleteMoveCell.test.tsx` (`useOwnerTab` replaces
`currentTabAtom`), `src/state/atoms.ts`, `e2e/files-preview.spec.ts` (`/files` → `/library`, `bb296f33`)
and its two existing snapshots, `pnpm-lock.yaml` (`marked@17.0.3` unchanged), `src/translation/*.json`
(no `RichText` key changed), `coverage-areas.json`, the verify-ui and push skills. Scope was exact:
a finding had to name a drift path or symbol and the plan obligation it invalidates. No FIRST-LOOK
lenses; every REFRESH lens was already in the r1 manifest. Roles: `review-plan` for the plan lens,
`sensitive` for the others (`package.json`/`pnpm-lock.yaml` Sensitive-Path globs), as in r1–r3.

Wall elapsed 167 s (first launch 1791863152 → last report 1791863319); no waits. Each lens inspected the drift
(10–26 commands, 3–5 `git diff <old>..<new>` reads per lens). Raw verdicts:

| Lens | Raw verdict line(s) | Drift findings |
| --- | --- | --- |
| plan | `VERDICT: APPROVED` | none |
| correctness | `VERDICT: APPROVED` | none |
| tests | `VERDICT: APPROVED` | none |
| chess-semantics | `VERDICT: APPROVED` | none |
| minimalism | `VERDICT: APPROVED` | none |
| error-handling | `VERDICT: APPROVED` | none |
| persisted-state | `VERDICT: APPROVED` | none |
| engine-protocol | `NOT APPLICABLE: …` + `VERDICT: APPROVED` | none |
| ipc-contract | `NOT APPLICABLE: …` + `VERDICT: APPROVED` | none |
| pgn-index | `NOT APPLICABLE: …` + `VERDICT: APPROVED` | none |
| platform-semantics | `NOT APPLICABLE: …` + `VERDICT: APPROVED` | none |
| tauri-security | `NOT APPLICABLE: …` + `VERDICT: APPROVED` | none |

The arbiter read each NOT APPLICABLE reason (engine supervision, IPC contract, PGN scanning/storage,
OS-specific code, native security) against the plan's FILES and O1–O5: correct, no relaunch. No
OUT OF DRIFT SCOPE item was reported, so nothing was filed. Arbiter check of the frozen premises
against the drift: P6/P12/P16 line citations shift by one import line in `GameNotation.tsx` and the
existing `files-preview` scenarios now navigate to `/library`; neither changes an obligation — O4's
new scenario follows the spec file's current navigation, and "no existing snapshot moves" now means
the two snapshots as re-recorded at NEW-BASE.

Round 4 adopted plan-level corrections: 0; issues opened 0. Cumulative totals: 4 completed rounds
(r1=6 r2=1 r3=0 r4=0), 825 s review wall time (354 + 213 + 91 + 167; no waits); 9 unique issues
opened; 7 closed by reviewer closure checks; 1 Skip (I6); 1 carried (I8 → CR-1); 0 open; 0 Defer;
0 withdrawn; no rewrite or split. Disclosure: plan refresh arbitration ran in one Claude context;
detection ran in separate Codex leaves (OpenAI high tier), a different model family.


## Evidence

### Manifest

[
  {
    "artefact": "lens-chess-semantics-r1.jsonl",
    "findings": [],
    "lens": "chess-semantics",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-chess-semantics-r1.prompt",
    "report": "lens-chess-semantics-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-chess-semantics-r2.jsonl",
    "findings": [],
    "lens": "chess-semantics",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-chess-semantics-r2.prompt",
    "report": "lens-chess-semantics-r2.txt",
    "round": 2,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-chess-semantics-r3.jsonl",
    "findings": [],
    "lens": "chess-semantics",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-chess-semantics-r3.prompt",
    "report": "lens-chess-semantics-r3.txt",
    "round": 3,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-correctness-r1.jsonl",
    "findings": [
      {
        "kind": "blocker",
        "text": "tasks/plans/.plan-2026-10-11-comment-dialect-and-inline-flow.md-r1.body.md:150 — Disabling block tokenizers leaves fenced backticks consumed by inline-code parsing. Using the supplied probes with `\"```\\nhello\\n```\"`, the reader produces `inlineCode=\"hello\"` and the editor serializes `` `hello` ``. After an edit it writes `` `!hello` ``, losing the fences and newlines. O1 requires literal block syntax, and O2 requires preservation outside edited characters. This is not a P10 exception. (confidence: 100)"
      },
      {
        "kind": "blocker",
        "text": "tasks/plans/.plan-2026-10-11-comment-dialect-and-inline-flow.md-r1.body.md:124 — Parse-time disabling of indented code drops leading whitespace. The reader probe maps `\"    indented\"` to `paragraph(text=\"indented\")`, while the editor preserves all four spaces. The proposed mechanisms therefore violate O1’s character-preservation guarantee and leave reader/editor behavior inconsistent. The plan needs a source-preservation contract for this case. (confidence: 100)"
      }
    ],
    "lens": "correctness",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-correctness-r1.prompt",
    "report": "lens-correctness-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "REVISE"
  },
  {
    "artefact": "lens-correctness-r2.jsonl",
    "findings": [
      {
        "kind": "blocker",
        "text": "src/components/common/notationRows.ts:349 — O3’s expanded table-variation contract leaves a caller/builder mismatch unresolved. For `1. e4 e5 ({before} 1... c5 {after}) 2. Nf3`, `blackVariations` reads `e5.children.slice(1)` instead of `e4.children.slice(1)`. With no alternative to `Nf3`, the predicate is false, so `c5` and both comments never reach the inline builder. Correct the producer’s predicate while preserving mainline table rows. (confidence: 100)"
      }
    ],
    "lens": "correctness",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-correctness-r2.prompt",
    "report": "lens-correctness-r2.txt",
    "round": 2,
    "terminal": "completed",
    "verdict": "REVISE"
  },
  {
    "artefact": "lens-correctness-r3.jsonl",
    "findings": [],
    "lens": "correctness",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-correctness-r3.prompt",
    "report": "lens-correctness-r3.txt",
    "round": 3,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-engine-protocol-r1.jsonl",
    "findings": [],
    "lens": "engine-protocol",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-engine-protocol-r1.prompt",
    "report": "lens-engine-protocol-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-error-handling-r1.jsonl",
    "findings": [
      {
        "kind": "should-fix",
        "text": "tasks/plans/.plan-2026-10-11-comment-dialect-and-inline-flow.md-r1.body.md:150 — O2 specifies successful round trips but leaves parser and serializer failure semantics undefined. Current editor creation, `setContent` and `getMarkdown` calls have no error handling. Specify that failure preserves the original comment, prevents replacement writes, and surfaces a distinguishable error. Include failure-path proof alongside the round-trip tests (confidence: 92)."
      }
    ],
    "lens": "error-handling",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-error-handling-r1.prompt",
    "report": "lens-error-handling-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-ipc-contract-r1.jsonl",
    "findings": [],
    "lens": "ipc-contract",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-ipc-contract-r1.prompt",
    "report": "lens-ipc-contract-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-minimalism-r1.jsonl",
    "findings": [],
    "lens": "minimalism",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-minimalism-r1.prompt",
    "report": "lens-minimalism-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-minimalism-r2.jsonl",
    "findings": [],
    "lens": "minimalism",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-minimalism-r2.prompt",
    "report": "lens-minimalism-r2.txt",
    "round": 2,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-persisted-state-r1.jsonl",
    "findings": [],
    "lens": "persisted-state",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-persisted-state-r1.prompt",
    "report": "lens-persisted-state-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-pgn-index-r1.jsonl",
    "findings": [],
    "lens": "pgn-index",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-pgn-index-r1.prompt",
    "report": "lens-pgn-index-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-plan-r1.jsonl",
    "findings": [
      {
        "kind": "blocker",
        "text": "tasks/plans/.plan-2026-10-11-comment-dialect-and-inline-flow.md-r1.body.md:124 — O1/O2’s parser mechanism does not preserve literal block text. Running the supplied `remark.mjs:9` and `tiptap3.mjs:11` mechanisms with `\"```\\nfenced text\\n```\"` produces an `inlineCode` node in the reader and ``\"`fenced text`\"`` from the editor. The fences and line breaks disappear, contrary to O1 and O2:152. The reader probe also drops all four spaces from `\"    indented\"`. Require a preservation mechanism and shared regression cases for both inputs (confidence: 100)."
      },
      {
        "kind": "blocker",
        "text": "tasks/plans/.plan-2026-10-11-comment-dialect-and-inline-flow.md-r1.body.md:177 — The “inline builder only” boundary does not preserve table view as promised at line 188. `notationRows.ts:159` routes variation rendering through `appendInlineTasks`, and table view calls that route at `notationRows.ts:343`, `:359`, `:365` and `:370`. Removing comment boundaries and starting-comment rows therefore changes table-view variations too. The retained table tests at `notationRows.test.ts:251` cover mainline moves, so they would miss this consumer. Specify how table-view variations retain their current behavior and prove that boundary (confidence: 100)."
      },
      {
        "kind": "blocker",
        "text": "tasks/plans/.plan-2026-10-11-comment-dialect-and-inline-flow.md-r1.body.md:185 — Combining multiline comments into tall rows breaks current-move visibility. `GameNotation.tsx:93` resolves navigation to a row, then `:99` centers the whole row rather than the selected move. The installed virtualizer’s center-offset probe returned visible coordinates `[384,576]` for a 960px row in a 192px viewport, hiding moves near either end. Multiline comments render as blocks at `Comment.tsx:56`, so this is reachable through ordinary annotated games. Dynamic measurement prevents overlapping rows, but does not reveal the selected move. O3 needs a navigation obligation and proof for rows taller than the viewport (confidence: 96)."
      },
      {
        "kind": "blocker",
        "text": "tasks/plans/.plan-2026-10-11-comment-dialect-and-inline-flow.md-r1.body.md:192 — The proofs do not verify that starting comments reach the notation through `GameNotation`. Row-model tests and direct cell tests can pass while `GameNotation.tsx:304` drops the new value. Existing integration tests hide comments at `GameNotation.test.tsx:39` and mock the cell without displaying comment props at `:68`. O4’s fixture contains only move comments. Require an integration assertion that fails when starting-comment forwarding is omitted (confidence: 98)."
      }
    ],
    "lens": "plan",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-plan-r1.prompt",
    "report": "lens-plan-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "REVISE"
  },
  {
    "artefact": "lens-plan-r2.jsonl",
    "findings": [],
    "lens": "plan",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-plan-r2.prompt",
    "report": "lens-plan-r2.txt",
    "round": 2,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-plan-r3.jsonl",
    "findings": [],
    "lens": "plan",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-plan-r3.prompt",
    "report": "lens-plan-r3.txt",
    "round": 3,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-platform-semantics-r1.jsonl",
    "findings": [],
    "lens": "platform-semantics",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-platform-semantics-r1.prompt",
    "report": "lens-platform-semantics-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-tauri-security-r1.jsonl",
    "findings": [],
    "lens": "tauri-security",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tauri-security-r1.prompt",
    "report": "lens-tauri-security-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-tests-r1.jsonl",
    "findings": [
      {
        "kind": "blocker",
        "text": "tasks/plans/.plan-2026-10-11-comment-dialect-and-inline-flow.md-r1.body.md:164 — O2 tests construct an editor and serialize directly, without exercising AnnotationEditor’s toolbar, typing input rules, or saved store value. Restoring block controls or breaking `onUpdate → setComment` would leave these proofs green. O4 only visits the preview, so the container suite supplies no editor proof either. Add a mounted editor journey asserting block controls are absent, typed block markers remain text, and an edit saves the expected comment. (confidence: 97)"
      },
      {
        "kind": "should-fix",
        "text": "tasks/plans/.plan-2026-10-11-comment-dialect-and-inline-flow.md-r1.body.md:131 — Rendered-text and forbidden-block assertions do not prove retained inline formatting. Replacing strong, emphasis, strike, and links with unformatted text would preserve those assertions and the existing underline/code tests. Assert the formatting elements and link destinations, including formatting within literal block-looking prose. (confidence: 96)"
      }
    ],
    "lens": "tests",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tests-r1.prompt",
    "report": "lens-tests-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "REVISE"
  },
  {
    "artefact": "lens-tests-r2.jsonl",
    "findings": [],
    "lens": "tests",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tests-r2.prompt",
    "report": "lens-tests-r2.txt",
    "round": 2,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-chess-semantics-r4.jsonl",
    "findings": [],
    "lens": "chess-semantics",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-chess-semantics-r4.prompt",
    "report": "lens-chess-semantics-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-correctness-r4.jsonl",
    "findings": [],
    "lens": "correctness",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-correctness-r4.prompt",
    "report": "lens-correctness-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-engine-protocol-r4.jsonl",
    "findings": [],
    "lens": "engine-protocol",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-engine-protocol-r4.prompt",
    "report": "lens-engine-protocol-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-error-handling-r4.jsonl",
    "findings": [],
    "lens": "error-handling",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-error-handling-r4.prompt",
    "report": "lens-error-handling-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-ipc-contract-r4.jsonl",
    "findings": [],
    "lens": "ipc-contract",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-ipc-contract-r4.prompt",
    "report": "lens-ipc-contract-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-minimalism-r4.jsonl",
    "findings": [],
    "lens": "minimalism",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-minimalism-r4.prompt",
    "report": "lens-minimalism-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-persisted-state-r4.jsonl",
    "findings": [],
    "lens": "persisted-state",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-persisted-state-r4.prompt",
    "report": "lens-persisted-state-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-pgn-index-r4.jsonl",
    "findings": [],
    "lens": "pgn-index",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-pgn-index-r4.prompt",
    "report": "lens-pgn-index-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-plan-r4.jsonl",
    "findings": [],
    "lens": "plan",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-plan-r4.prompt",
    "report": "lens-plan-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-platform-semantics-r4.jsonl",
    "findings": [],
    "lens": "platform-semantics",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-platform-semantics-r4.prompt",
    "report": "lens-platform-semantics-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-tauri-security-r4.jsonl",
    "findings": [],
    "lens": "tauri-security",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tauri-security-r4.prompt",
    "report": "lens-tauri-security-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-tests-r4.jsonl",
    "findings": [],
    "lens": "tests",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tests-r4.prompt",
    "report": "lens-tests-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "APPROVED"
  }
]

### Issues

[
  {
    "claim": "Disabling fenced code while keeping inline code spans turns a fenced block into a lossy inline code span in the reader and the editor.",
    "closed_round": 2,
    "correction": "Code (inline spans, fenced and indented blocks) leaves the dialect; backticks are literal in both parsers (O1, O2, P14, decision 1).",
    "dependencies": [],
    "disposition": "Fix",
    "id": "I1",
    "witnesses": [
      {
        "index": 1,
        "lens": "correctness",
        "round": 1
      },
      {
        "index": 1,
        "lens": "plan",
        "round": 1
      }
    ]
  },
  {
    "claim": "The reader drops leading spaces of an indented line, so the O1 'no character lost' contract and reader/editor consistency fail.",
    "closed_round": 2,
    "correction": "O1 contract: no non-whitespace character lost; the reader is display-only under HTML whitespace collapsing; the editor keeps whitespace byte-exact.",
    "dependencies": [],
    "disposition": "Fix",
    "id": "I2",
    "witnesses": [
      {
        "index": 2,
        "lens": "correctness",
        "round": 1
      },
      {
        "index": 1,
        "lens": "plan",
        "round": 1
      }
    ]
  },
  {
    "claim": "The inline builder also builds the table view's variation runs, so 'inline builder only' changes table-view variations unannounced and untested.",
    "closed_round": 2,
    "correction": "O3 covers every inline move run including table-view variation runs; mainline table rows unchanged; new table-view test; decision 4 reworded (P15).",
    "dependencies": [],
    "disposition": "Fix",
    "id": "I3",
    "witnesses": [
      {
        "index": 2,
        "lens": "plan",
        "round": 1
      }
    ]
  },
  {
    "claim": "With comments inline a row can be taller than the viewport, and centring the row hides the current move.",
    "closed_round": 2,
    "correction": "New obligation O5: navigation scrolls the current move's own cell into the viewport; proven in the container scenario (phase 3, P16).",
    "dependencies": [
      "I3"
    ],
    "disposition": "Fix",
    "id": "I4",
    "witnesses": [
      {
        "index": 3,
        "lens": "plan",
        "round": 1
      }
    ]
  },
  {
    "claim": "No proof that GameNotation forwards a variation's starting comment to the move cell.",
    "closed_round": 2,
    "correction": "O3 verification adds a GameNotation.test.tsx forwarding assertion with comments shown.",
    "dependencies": [],
    "disposition": "Fix",
    "id": "I5",
    "witnesses": [
      {
        "index": 4,
        "lens": "plan",
        "round": 1
      }
    ]
  },
  {
    "claim": "O2 leaves parser and serializer failure semantics undefined.",
    "dependencies": [],
    "disposition": "Skip",
    "id": "I6",
    "reason": "AnnotationEditor writes the store only from onUpdate on a user edit (AnnotationEditor.tsx:38-40), so a load never overwrites a comment; the measured throw class (P9) is removed because parser and schema now match, and O2's mounted test loads every case. No failure path the plan introduces; a new error surface for an unobserved failure is outside MANDATE (lens verdict APPROVED, confidence 92).",
    "witnesses": [
      {
        "index": 1,
        "lens": "error-handling",
        "round": 1
      }
    ]
  },
  {
    "claim": "O2's tests construct an editor directly and bypass AnnotationEditor's toolbar, input rules and store write.",
    "closed_round": 2,
    "correction": "O2 verification mounts the production AnnotationEditor in a TreeStateContext store and asserts toolbar controls, typed markers, load-without-write and the saved store value.",
    "dependencies": [],
    "disposition": "Fix",
    "id": "I7",
    "witnesses": [
      {
        "index": 1,
        "lens": "tests",
        "round": 1
      }
    ]
  },
  {
    "carried": "CR-1",
    "claim": "O1's assertions do not prove retained inline formatting elements and link destinations.",
    "closed_round": "carried",
    "correction": "Carried to CR-1: Comment.test.tsx asserts strong/em/del/u/a[href], including formatting inside block-looking prose.",
    "dependencies": [],
    "disposition": "Fix",
    "id": "I8",
    "witnesses": [
      {
        "index": 2,
        "lens": "tests",
        "round": 1
      }
    ]
  },
  {
    "claim": "The table view reads a black move's alternatives from the black move's own children (notationRows.ts:349), so a black-move variation is hidden unless the next white move has alternatives, and an empty variation row appears otherwise.",
    "closed_round": 3,
    "correction": "O3 table-view bullet: a black move's variations are the white move's other children, no empty variation row; two new table-view tests (P17).",
    "dependencies": [
      "I3"
    ],
    "disposition": "Fix",
    "id": "I9",
    "witnesses": [
      {
        "index": 1,
        "lens": "correctness",
        "round": 2
      }
    ]
  }
]

### lens-chess-semantics-r1.txt

(identical text already appears above in this handoff)

### lens-chess-semantics-r2.txt

(identical text already appears above in this handoff)

### lens-chess-semantics-r3.txt

(identical text already appears above in this handoff)

### lens-chess-semantics-r4.txt

(identical text already appears above in this handoff)

### lens-correctness-r1.txt

(identical text already appears above in this handoff)

### lens-correctness-r2.txt

(identical text already appears above in this handoff)

### lens-correctness-r3.txt

(identical text already appears above in this handoff)

### lens-correctness-r4.txt

(identical text already appears above in this handoff)

### lens-engine-protocol-r1.txt

(identical text already appears above in this handoff)

### lens-engine-protocol-r4.txt

NOT APPLICABLE: The plan’s files and O1–O5 obligations concern comment rendering, annotation editing, notation rows, navigation and snapshots. They do not change engine supervision, UCI protocol state or asynchronous engine result routing. The engine termination drift has no dependency in these obligations.

VERDICT: APPROVED
### lens-error-handling-r1.txt

(identical text already appears above in this handoff)

### lens-error-handling-r4.txt

(identical text already appears above in this handoff)

### lens-ipc-contract-r1.txt

(identical text already appears above in this handoff)

### lens-ipc-contract-r4.txt

NOT APPLICABLE: O1–O5 cover renderer comment parsing, editor serialization, notation layout and UI proof. The scoped drift changes no Rust–renderer event, command, payload, subscription or capability contract.
VERDICT: APPROVED
### lens-minimalism-r1.txt

(identical text already appears above in this handoff)

### lens-minimalism-r2.txt

(identical text already appears above in this handoff)

### lens-minimalism-r4.txt

(identical text already appears above in this handoff)

### lens-persisted-state-r1.txt

(identical text already appears above in this handoff)

### lens-persisted-state-r4.txt

(identical text already appears above in this handoff)

### lens-pgn-index-r1.txt

(identical text already appears above in this handoff)

### lens-pgn-index-r4.txt

NOT APPLICABLE: O1–O5 cover comment rendering, editor-to-store round trips, notation layout and navigation. The plan explicitly excludes PGN export and database comment storage. The drift changes no scanning, indexing, disk encoding or search obligation.

VERDICT: APPROVED
### lens-plan-r1.txt

(identical text already appears above in this handoff)

### lens-plan-r2.txt

(identical text already appears above in this handoff)

### lens-plan-r3.txt

(identical text already appears above in this handoff)

### lens-plan-r4.txt

(identical text already appears above in this handoff)

### lens-platform-semantics-r1.txt

(identical text already appears above in this handoff)

### lens-platform-semantics-r4.txt

NOT APPLICABLE: The plan and relevant drift change renderer components, JavaScript parsing, tab atoms and container snapshots. They introduce no OS-specific path, handle, ABI, filesystem or `cfg` mechanism within this lens.

VERDICT: APPROVED
### lens-tauri-security-r1.txt

(identical text already appears above in this handoff)

### lens-tauri-security-r4.txt

NOT APPLICABLE: The plan’s files and O1–O5 obligations concern renderer comment formatting, editing, notation layout and UI verification. They do not touch credentials, filesystem authority or mutation, signed downloads, or sensitive backend data.

VERDICT: APPROVED
### lens-tests-r1.txt

(identical text already appears above in this handoff)

### lens-tests-r2.txt

(identical text already appears above in this handoff)

### lens-tests-r4.txt

(identical text already appears above in this handoff)

### plan-r1.md

# Plan: PGN comments render as plain text with inline formatting, and stay in the move flow

Plan path: `tasks/plans/2026-10-11-comment-dialect-and-inline-flow.md` · Finding: `f-20261001-10` ·
Base: `8b3e94cbdfa1b3c1638ba73c31d46f8bbd1b821e` · Mode: PLAN-ONLY (drain planner, `full auto`).

## Goal

A ChessBase-style PGN comment such as `{59. Olvidé mi preparación.}` reads as the text it is, and a
game where nearly every move carries a short comment (`{62}`, `{59}`) reads as a flowing line of
moves, not one half-move per line — in the analysis tab and in every preview that mounts
`GameNotation`. The Annotate editor writes exactly the comment format the notation reads.

## MANDATE

Verbatim from `tasks/findings.md`, `f-20261001-10`:

* **Where:** `src/components/common/Comment.tsx` (comment text goes through `react-markdown` + `remark-gfm`; a comment with several non-empty lines switches to `display: block`), `src/components/common/notationRows.ts` (~339-383: every move comment is emitted as its own `comment` row via `addComment`, which closes the current move row).
* **Defect:** in Felix's game Beck–Riewe (Elo Vierer Caissa Center, 2026.08.09, `~/Documents/Sport/Schach/ChessFable/Eigene Partien/Meine Partien.pgn` line 2178) almost every move carries a comment with the remaining clock minutes (`6. Nf3 {62} h6 7. Be3 {59. Olvidé mi preparación. Tengo Ld3 en mi prep.} Bd6 8. Be2 {59}`). Two effects, both visible in the database preview and the analysis tab: (1) the comment `59. Olvidé…` starts with "number + period + space", which Markdown parses as an ordered list starting at 59, rendering a block-level list with margins and an empty gap; ChessBase/PGN comments are plain text, so any comment opening with `12. `, `- `, `# ` or `> ` is restyled; (2) because each comment ends the row, a game where nearly every move has a short comment collapses to one half-move per line and wastes most of the panel width.
* **Fix shape:** decide whether PGN comments are Markdown at all (they are written by ChessBase and other tools as plain text; the Annotate editor is a rich-text editor whose output format must be checked before changing the reader); at minimum disable the block constructs (lists, headings, blockquotes) for comment rendering. Let short single-line comments stay inline in the move flow instead of forcing a row break. Pixels via `pnpm test:e2e:container`.
* **Open question:** are PGN comments Markdown at all, given what the Annotate editor writes back, and which comments may stay inline in the move flow instead of ending the row.
* **Why `build`:** the Markdown question interacts with the Annotate editor's write format (round-trip), and the row model change touches `notationRows.ts` shared by every notation view.

## Threat model and non-goals

* **Input is accidental, not adversarial.** Comment text comes from PGN files written by ChessBase,
  Lichess, other GUIs and ChessFable's own Annotate editor, and from imported databases. No
  attacker model beyond the one already pinned: raw HTML in a comment is shown as text and never
  executed (`src/components/common/Comment.test.tsx:25`); that guarantee is kept unchanged.
* **Environments:** the renderer on Linux, macOS and Windows (WebKitGTK / WebKit / WebView2) and
  the pinned Playwright Chromium image for pixels. No Rust, IPC, persistence or capability change.
* Frozen with the MANDATE.

## Traced premises

Locate evidence, frozen. Probe scripts and their full output are in the run directory
(`$RUN_TMP/probe/`); the observed results are quoted here.

* P1 — Reader: `src/components/common/Comment.tsx:48-71` renders every comment through
  `react-markdown` with `remarkGfm` and a local `remarkUnderline` plugin; `multipleLine` (more than
  one non-empty line) switches the wrapper to `display: block` and paragraphs to `<p>`, otherwise
  `<span>`.
* P2 — Editor: `src/components/panels/annotation/AnnotationEditor.tsx:24-44` uses tiptap
  `StarterKit` + `@tiptap/markdown` (`contentType: "markdown"`, `setComment(editor.getMarkdown())`
  on every user update) and offers H1–H4, blockquote, horizontal rule, bullet list and ordered list
  controls (`:93-105`). Comments written by ChessFable are therefore Markdown, including block
  constructs.
* P3 — The inline row model breaks the run after every commented move:
  `src/components/common/notationRows.ts:224-237` (`hasComment || hasVariations || reachedLimit`
  closes the `moves` row). In the inline view the comment itself is not a row — it is drawn inside
  the move cell (`src/components/common/CompleteMoveCell.tsx:174`); only the break is the row
  model's. A variation's starting comment additionally closes the run *before* its move and becomes
  its own `comment` row (`notationRows.ts:205-219`).
* P4 — The break after a commented move is a regression of `88ad35ef` (2026-09-23, virtualized
  notation, `d-20260923-01`): before it, `RenderVariationTree` (`git show 88ad35ef^:src/components/common/GameNotation.tsx:195-264`)
  drew the mainline as one flow with single-line comments inline (`cb12c03d` "Put single line
  comments inline"). `d-20260923-01` records no reason for the break.
* P5 — Table view emitted comments as their own table rows before `88ad35ef` too
  (`88ad35ef^:GameNotation.tsx:313-440`) and still does (`notationRows.ts:321-375`).
* P6 — Every notation surface goes through one component: `BoardAnalysis.tsx:294`,
  `BoardGame.tsx:1430`, `databases/GamePreview.tsx:112`, `puzzles/Puzzles.tsx:881` mount
  `GameNotation`; the inline view is the default (`src/state/atoms.ts:286`, `tableViewAtom`
  defaults to `false`). Rows are measured dynamically (`GameNotation.tsx:82-84,157`,
  `measureElement`), so a row's height is not fixed.
* P7 — Measured, micromark construct disabling (`$RUN_TMP/probe/remark.mjs`, unified 11 /
  remark-parse 11 / remark-gfm 4.0.0 / micromark 4.0.0): a remark plugin pushing
  `{disable: {null: ["blockQuote","codeFenced","codeIndented","headingAtx","htmlFlow","list","setextUnderline","thematicBreak","definition"]}}`
  into `micromarkExtensions` turns `59. Olvidé mi preparación.`, `- a dash`, `# not heading`,
  `> quote`, `---`, `a\n---` and `[a]: https://x` into one paragraph holding the source text, and
  keeps `**bold** *it* ~~s~~ https://lichess.org [l](https://x.y)` as strong/emphasis/delete/link.
  Two GFM constructs are anonymous and cannot be disabled by name: a GFM table still parses as
  `table` and `[^1]: foot` still as `footnoteDefinition`
  (`micromark-extension-gfm-table@2.0.0/lib/syntax.js:36-44`, `micromark-extension-gfm-footnote@2.0.0/lib/syntax.js:35-46`).
  `    indented` becomes a paragraph `indented` (leading spaces dropped by paragraph parsing).
* P8 — Measured, today's editor round trip (`$RUN_TMP/probe/tiptap.mjs`, tiptap 3.20.0, marked
  17.0.3): loading `59. Olvidé…` yields an `orderedList`; a paragraph typed as `59. typed text`
  serializes unescaped as `59. typed text`, so it re-reads as a list; `1\. escaped` loads as
  `1 escaped` and is written back without the `.` (data loss on the next edit).
* P9 — Measured, disabling the StarterKit block nodes alone is unsafe: with heading, blockquote,
  horizontalRule, bulletList, orderedList, listItem, listKeymap and codeBlock off but the default
  parser, `# not heading` throws `RangeError: Unknown node type: heading` on load and `> quote`
  loads as `quote` (the marker is lost).
* P10 — Measured, a dedicated `marked` instance (`new Marked({tokenizer: {...}})` from `marked`
  17.0.3, the copy `@tiptap/markdown` resolves, `pnpm-lock.yaml:5960`) whose `heading`, `lheading`,
  `blockquote`, `hr`, `list`, `code`, `fences`, `html`, `def` and `table` tokenizers return
  `undefined`, passed as `Markdown.configure({ marked })` together with those StarterKit nodes off,
  loads and serializes `59. Olvidé…`, `- a dash`, `# not heading`, `> quote`, `---`,
  `    indented`, a GFM table, `**bold** and ++u++ ~~s~~`, `a\n\nb`, `a\nb` and `plain *star text`
  byte-identically, and an edit changes only the edited characters. An `escape` tokenizer returning
  a `text` token with the raw `\.` keeps `1\. escaped` byte-identical as well.
  Normalisations that remain on an edit (not losses): a bare URL becomes `[url](url)`, `<b>x</b>`
  becomes `**x**`, `a\n---` becomes `a\n\n---`.
* P11 — Measured, `@tiptap/markdown` registers its tokenizers on the marked instance at every
  editor creation (`@tiptap/markdown/dist/index.js:186-234`, `markedInstance.use`), and without a
  `marked` option that instance is the global `marked` singleton (`:110`). The editor is recreated
  on every move change (`AnnotationEditor.tsx:43`, deps `[position.join(",")]`). Probe
  `$RUN_TMP/probe/growth.mjs`: the global instance held 1, 11 and 61 inline and block extensions
  after 1, 11 and 61 editor creations — unbounded growth today.
* P12 — Pixels: the only e2e scenario with comment text is `e2e/files-preview.spec.ts:67-121`
  (a root comment, which stays a row). No e2e spec shows the Annotate panel. Container snapshots
  are re-recorded only through `pnpm test:e2e:update` under `d-20260919-13`
  (`.claude/skills/verify-ui/SKILL.md:40-53`).
* P13 — Gates: `Comment.tsx`, `CompleteMoveCell.tsx`, `GameNotation.tsx`, `notationRows.ts` and
  `src/components/panels/annotation/**` are measured in the `boards-game-analysis` coverage area
  (`coverage-areas.json:51-84`); none is in a frontend mutation package
  (`scripts/frontend-mutation-packages.mjs`). `package.json` and `pnpm-lock.yaml` are
  Sensitive-Path globs (`.claude/skills/push/SKILL.md:293-325`). Translation catalogues have no
  unused-key check (`scripts/i18n-completeness.mjs`).

## Approach

### O1 — One comment dialect: inline Markdown, block syntax is literal text

Rests on: "decide whether PGN comments are Markdown at all", "at minimum disable the block
constructs (lists, headings, blockquotes) for comment rendering", "ChessBase/PGN comments are plain
text, so any comment opening with `12. `, `- `, `# ` or `> ` is restyled".

A comment is read as: paragraphs (blank-line separated) and soft line breaks; inline emphasis,
strong, `++underline++`, strikethrough, inline code, links and autolink literals. Every block
construct is shown as the source text that wrote it: ordered and bullet lists, ATX and setext
headings, blockquotes, thematic breaks, indented and fenced code blocks, HTML blocks, link
reference definitions, GFM tables, GFM footnote definitions (and a footnote reference therefore
stays literal text too). Raw HTML stays text, never markup (existing guarantee).

Required behaviour, reader (`Comment.tsx`): the named constructs are disabled at parse time, and
the two anonymous GFM constructs (P7) are replaced by their own source text, so no character of the
comment disappears and no block element (`ol`, `ul`, `li`, `h1`–`h6`, `blockquote`, `hr`, `pre`,
`table`, footnote section) is ever rendered. Inline formatting inside text that would have been a
block construct still renders (for named constructs it is ordinary paragraph text). The
`multipleLine` inline/block rule is unchanged.

Verification level: unit tests in `Comment.test.tsx` covering at least `59. Olvidé mi
preparación.`, `- a`, `# a`, `> a`, `---`, `a\n---`, a fenced block, a GFM table, `[^1]: x` with a
`[^1]` call, and `**b** ++u++ ~~s~~ [l](https://x.y) https://lichess.org`; each asserts the
rendered text and the absence of every block element listed above. The existing two tests stay
green.

### O2 — The Annotate editor reads and writes the same dialect, without loss

Rests on: "the Annotate editor is a rich-text editor whose output format must be checked before
changing the reader"; "Why `build`: the Markdown question interacts with the Annotate editor's
write format (round-trip)".

Required behaviour (`AnnotationEditor.tsx`):

* The editor cannot author a block construct: the H1–H4, blockquote, horizontal-rule, bullet-list
  and ordered-list toolbar controls are removed, and the matching StarterKit nodes (heading,
  blockquote, horizontalRule, bulletList, orderedList, listItem, listKeymap, codeBlock) are
  disabled, so their input rules (`# `, `1. `, `> `, `---`, fences) no longer fire. Bold, italic,
  underline, strike, clear-formatting, link and unlink stay.
* Its Markdown parser is a dedicated `marked` instance with the block tokenizers off and backslash
  escapes kept as literal text (P10). A comment loaded into the editor and saved after an edit is
  byte-identical outside the edited characters for every O1 case except the P10 normalisations,
  which are named known limits.
* The instance is created per editor (inside the `useEditor` configuration), never shared at
  module level or left on the global `marked`, so tiptap's per-creation tokenizer registration
  (P11) no longer accumulates: the number of registered extensions on an editor's instance does not
  grow with the number of editors created.
* `marked` becomes a direct dependency at the exact version `@tiptap/markdown` already resolves
  (`17.0.3`), so the lockfile keeps one `marked` copy.
* Locale keys that no source references any more after the toolbar change (`RichText.H1`–`H4`,
  `RichText.Quote`, `RichText.HLine`, `RichText.BulletList`, `RichText.NumberedList`) are removed
  from every catalogue under `src/translation/`.

Verification level: a unit test (jsdom, the repo's vitest environment) that constructs the editor
with its production extension list and asserts, per O1 case, load → serialize identity and
load → one edit → serialize equals the input plus exactly that edit; that `59. Olvidé…` loads as a
paragraph, not a list; and that creating several editors leaves each instance's registered
extension count constant. The O1 case list is defined once and consumed by both the O1 and the O2
tests, so reader and editor are proven against the same inputs.

### O3 — Comments stay in the move flow in the inline view

Rests on: "because each comment ends the row, a game where nearly every move has a short comment
collapses to one half-move per line"; "Let short single-line comments stay inline in the move flow
instead of forcing a row break."

Required behaviour (`notationRows.ts`, inline builder only):

* A move's comment never closes the `moves` row. The run continues to the next move; rows still
  close on variations, on `NOTATION_ROW_MAX_MOVES`, and at the end of a line, exactly as today.
* A variation's starting comment no longer closes the run before its move nor becomes a `comment`
  row in the inline view: it travels with that move in the `moves` row (its prose only, commands
  stripped exactly as today by `splitPgnComment`) and is drawn in front of the move, inline, by the
  move cell; that move keeps `first: true` so its move number follows the comment.
* "Short" is not a length threshold: every comment is drawn in the flow, and the existing
  `Comment` line rule decides inline (`span`) versus block. A multi-line comment is a block inside
  the row and therefore starts and ends its own line without a row break.
* The root (game) comment row, the table view (P5) and the `rowForNode` / path contracts are
  unchanged. Move numbering after a comment is unchanged (a black move after a white move's comment
  still shows no `1...`; pre-`88ad35ef` behaviour).

Verification level: `notationRows.test.ts` — a mainline with a comment on every move yields one
`moves` row (for fewer than `NOTATION_ROW_MAX_MOVES` moves) in the inline view and the unchanged
per-comment rows in the table view; the existing inline starting-comment tests are rewritten to
the new contract (comment travels with the move, no `comment` row, `first: true`, commands
stripped, nothing when the comment is commands-only or comments are hidden); the table-view
starting-comment tests stay as they are. `CompleteMoveCell.test.tsx` — the starting comment
renders before the move and not when comments are hidden.

### O4 — Pixel proof of both effects

Rests on: "Pixels via `pnpm test:e2e:container`".

A new Playwright scenario in `e2e/files-preview.spec.ts` previews a game whose mainline carries the
MANDATE's comments (`6. Nf3 {62} h6 7. Be3 {59. Olvidé mi preparación. Tengo Ld3 en mi prep.} Bd6
8. Be2 {59}`, as lexer tokens like the existing scenarios). It asserts that the notation contains
no `ol`/`li`, that the text `59. Olvidé mi preparación.` is visible, and that `Nf3` and `h6` share
one line (equal bounding-box top), then records one new container snapshot. Existing snapshots
must not move; if one does, it is a regression to fix, not to re-record (P12).

Depends on O1 and O3.

## Decisions and trade-offs

* PGN comments are not full Markdown (O1). Kept: inline formatting, because ChessFable's own
  editor has written it into users' PGNs and inline markers are rare in plain-text prose.
  Dropped: block constructs, because their markers (`12. `, `- `, `# `, `> `) are ordinary at the
  start of chess prose and every other PGN tool shows them as text.
* The editor is narrowed to the dialect (O2) instead of the reader special-casing editor output:
  a PGN comment carries no marker of who wrote it.
* Comments in the inline view return to the pre-`88ad35ef` flow (O3); the table view keeps its
  rows.

## Decided autonomously

1. **Question:** are PGN comments Markdown at all? **Chosen:** an inline-only Markdown dialect;
   block constructs render as their source text. **Rejected:** plain text everywhere (removes the
   bold/italic/underline/strike/link formatting the editor has already written into users' files,
   and the editor itself); full Markdown with a special case for a leading `N. ` (leaves `- `,
   `# `, `> ` restyled — the same class); detecting editor-authored comments (PGN has no such
   marker). **Reason:** PGN comments are plain text for ChessBase, Lichess and every other tool;
   block markers are common at the start of chess prose, inline markers are not. **Reversal
   path:** re-enable constructs in the one disable list per parser (O1/O2).
2. **Question:** what happens to the editor's block controls? **Chosen:** removed, with their
   StarterKit nodes, and the editor parses with an inline-only `marked` instance. **Rejected:**
   keep the controls (the editor would author text the notation shows literally); disable the
   nodes only (P9: crash on `#`, marker lost on `>`); one module-level instance (P11: tiptap
   re-registers its tokenizers on every editor creation). **Reason:** one dialect on both sides,
   measured lossless (P10). Existing comments that contain a list or heading now display as their
   Markdown source text. **Reversal path:** restore the controls and nodes and drop the custom
   instance.
3. **Question:** which comments stay inline? **Chosen:** all of them in the inline view; the
   existing `Comment` line rule decides inline versus block; starting comments too. **Rejected:** a
   character-length threshold for "short" (panel-width dependent, absent before `88ad35ef`);
   keeping a row break after multi-line comments (a block comment already occupies its own line).
   **Reason:** restores the flow `88ad35ef` broke without a recorded reason (P4). **Reversal
   path:** the break condition in the inline builder.
4. **Question:** does the table view change? **Chosen:** no. **Rejected:** comments inside table
   cells (a two-column move table has no move flow; table rows for comments predate `88ad35ef`,
   P5). **Reason:** the MANDATE's flow is the inline view, the default (P6).
5. **Question:** how does the editor get `marked`? **Chosen:** a direct dependency pinned to
   `17.0.3`, the version `@tiptap/markdown@3.20.0` resolves. **Rejected:** importing tiptap's
   transitive copy (not resolvable under pnpm's strict layout); mutating the global instance
   through `markedOptions` (keeps the P11 accumulation and affects every marked user).
   **Reason:** an isolated per-editor instance needs the `Marked` class.

## Risks / open questions

* tiptap-markdown internals (`registerTokenizer`, the `marked` option) are a dependency contract;
  the O2 test pins them so a tiptap bump that breaks them goes red.
* A user's existing editor-authored heading or list now reads as `# …` / `1. …`. Accepted under
  decision 2.
* Rows may grow taller in comment-heavy games; rows are measured dynamically (P6) and still capped
  at `NOTATION_ROW_MAX_MOVES` moves.

## Not part of this task

* Move-number display after a comment (`1. e4 {c} e5` vs `1... e5`).
* Table-view layout of comments (decision 4).
* Editor normalisations on edit listed in P10 (bare URL → link, HTML → Markdown, setext break).
* The comment format written by any other tool, PGN export, and the database storage of comments.

## Phases

Phases 1 and 2 are file-disjoint and independent; phase 3 depends on both. Each ends green and is
committed by the orchestrator.

### Phase 1 — Comment dialect (O1, O2)

* Files: `src/components/common/Comment.tsx`, `src/components/common/Comment.test.tsx`,
  `src/components/panels/annotation/AnnotationEditor.tsx`, a new
  `src/components/panels/annotation/AnnotationEditor.test.tsx`, the shared O1 case list (in a test
  file or test fixture; never a production module), `package.json`, `pnpm-lock.yaml`,
  `src/translation/*.json`.
* Touches: an npm dependency (Sensitive Path); no auth, persistence, concurrency or IPC.
* Role: `sensitive` (Sensitive-Path hit).
* Proof: `pnpm install --frozen-lockfile && pnpm vitest run src/components/common/Comment.test.tsx src/components/panels/annotation && pnpm lint:ci && pnpm i18n:check && pnpm checks:pre-review`.

### Phase 2 — Inline flow (O3)

* Files: `src/components/common/notationRows.ts`, `src/components/common/notationRows.test.ts`,
  `src/components/common/CompleteMoveCell.tsx`, `src/components/common/CompleteMoveCell.test.tsx`,
  `src/components/common/GameNotation.tsx` (passes the starting comment to the cell),
  `src/components/common/GameNotation.test.tsx` if its fixtures need the new field.
* Touches: no auth, persistence, concurrency or API contract; the row model is shared by every
  notation surface (P6).
* Role: `normal`.
* Proof: `pnpm vitest run src/components/common && pnpm lint:ci && pnpm checks:pre-review`.

### Phase 3 — Pixel proof (O4)

* Files: `e2e/files-preview.spec.ts`, its new snapshot under `e2e/files-preview.spec.ts-snapshots/`.
* Role: `normal`.
* Proof: `pnpm test:e2e:container` first (every existing snapshot green, the new one missing),
  then `pnpm test:e2e:update` limited to the new scenario's snapshot, then `pnpm test:e2e:container`
  green; the commit message names the one new snapshot.

### plan-r2.md

# Plan: PGN comments render as plain text with inline formatting, and stay in the move flow

Plan path: `tasks/plans/2026-10-11-comment-dialect-and-inline-flow.md` · Finding: `f-20261001-10` ·
Base: `8b3e94cbdfa1b3c1638ba73c31d46f8bbd1b821e` · Mode: PLAN-ONLY (drain planner, `full auto`).

## Goal

A ChessBase-style PGN comment such as `{59. Olvidé mi preparación.}` reads as the text it is, and a
game where nearly every move carries a short comment (`{62}`, `{59}`) reads as a flowing line of
moves, not one half-move per line — in the analysis tab and in every preview that mounts
`GameNotation`. The Annotate editor writes exactly the comment format the notation reads.

## MANDATE

Verbatim from `tasks/findings.md`, `f-20261001-10`:

* **Where:** `src/components/common/Comment.tsx` (comment text goes through `react-markdown` + `remark-gfm`; a comment with several non-empty lines switches to `display: block`), `src/components/common/notationRows.ts` (~339-383: every move comment is emitted as its own `comment` row via `addComment`, which closes the current move row).
* **Defect:** in Felix's game Beck–Riewe (Elo Vierer Caissa Center, 2026.08.09, `~/Documents/Sport/Schach/ChessFable/Eigene Partien/Meine Partien.pgn` line 2178) almost every move carries a comment with the remaining clock minutes (`6. Nf3 {62} h6 7. Be3 {59. Olvidé mi preparación. Tengo Ld3 en mi prep.} Bd6 8. Be2 {59}`). Two effects, both visible in the database preview and the analysis tab: (1) the comment `59. Olvidé…` starts with "number + period + space", which Markdown parses as an ordered list starting at 59, rendering a block-level list with margins and an empty gap; ChessBase/PGN comments are plain text, so any comment opening with `12. `, `- `, `# ` or `> ` is restyled; (2) because each comment ends the row, a game where nearly every move has a short comment collapses to one half-move per line and wastes most of the panel width.
* **Fix shape:** decide whether PGN comments are Markdown at all (they are written by ChessBase and other tools as plain text; the Annotate editor is a rich-text editor whose output format must be checked before changing the reader); at minimum disable the block constructs (lists, headings, blockquotes) for comment rendering. Let short single-line comments stay inline in the move flow instead of forcing a row break. Pixels via `pnpm test:e2e:container`.
* **Open question:** are PGN comments Markdown at all, given what the Annotate editor writes back, and which comments may stay inline in the move flow instead of ending the row.
* **Why `build`:** the Markdown question interacts with the Annotate editor's write format (round-trip), and the row model change touches `notationRows.ts` shared by every notation view.

## Threat model and non-goals

* **Input is accidental, not adversarial.** Comment text comes from PGN files written by ChessBase,
  Lichess, other GUIs and ChessFable's own Annotate editor, and from imported databases. No
  attacker model beyond the one already pinned: raw HTML in a comment is shown as text and never
  executed (`src/components/common/Comment.test.tsx:25`); that guarantee is kept unchanged.
* **Environments:** the renderer on Linux, macOS and Windows (WebKitGTK / WebKit / WebView2) and
  the pinned Playwright Chromium image for pixels. No Rust, IPC, persistence or capability change.
* Frozen with the MANDATE.

## Traced premises

Locate evidence, frozen. Probe scripts and their full output are in the run directory
(`$RUN_TMP/probe/`); the observed results are quoted here.

* P1 — Reader: `src/components/common/Comment.tsx:48-71` renders every comment through
  `react-markdown` with `remarkGfm` and a local `remarkUnderline` plugin; `multipleLine` (more than
  one non-empty line) switches the wrapper to `display: block` and paragraphs to `<p>`, otherwise
  `<span>`.
* P2 — Editor: `src/components/panels/annotation/AnnotationEditor.tsx:24-44` uses tiptap
  `StarterKit` + `@tiptap/markdown` (`contentType: "markdown"`, `setComment(editor.getMarkdown())`
  on every user update) and offers H1–H4, blockquote, horizontal rule, bullet list and ordered list
  controls (`:93-105`). Comments written by ChessFable are therefore Markdown, including block
  constructs.
* P3 — The inline row model breaks the run after every commented move:
  `src/components/common/notationRows.ts:224-237` (`hasComment || hasVariations || reachedLimit`
  closes the `moves` row). In the inline view the comment itself is not a row — it is drawn inside
  the move cell (`src/components/common/CompleteMoveCell.tsx:174`); only the break is the row
  model's. A variation's starting comment additionally closes the run *before* its move and becomes
  its own `comment` row (`notationRows.ts:205-219`).
* P4 — The break after a commented move is a regression of `88ad35ef` (2026-09-23, virtualized
  notation, `d-20260923-01`): before it, `RenderVariationTree` (`git show 88ad35ef^:src/components/common/GameNotation.tsx:195-264`)
  drew the mainline as one flow with single-line comments inline (`cb12c03d` "Put single line
  comments inline"). `d-20260923-01` records no reason for the break.
* P5 — Table view emitted comments as their own table rows before `88ad35ef` too
  (`88ad35ef^:GameNotation.tsx:313-440`) and still does (`notationRows.ts:321-375`).
* P6 — Every notation surface goes through one component: `BoardAnalysis.tsx:294`,
  `BoardGame.tsx:1430`, `databases/GamePreview.tsx:112`, `puzzles/Puzzles.tsx:881` mount
  `GameNotation`; the inline view is the default (`src/state/atoms.ts:286`, `tableViewAtom`
  defaults to `false`). Rows are measured dynamically (`GameNotation.tsx:82-84,157`,
  `measureElement`), so a row's height is not fixed.
* P7 — Measured, micromark construct disabling (`$RUN_TMP/probe/remark.mjs`, unified 11 /
  remark-parse 11 / remark-gfm 4.0.0 / micromark 4.0.0): a remark plugin pushing
  `{disable: {null: ["blockQuote","codeFenced","codeIndented","headingAtx","htmlFlow","list","setextUnderline","thematicBreak","definition"]}}`
  into `micromarkExtensions` turns `59. Olvidé mi preparación.`, `- a dash`, `# not heading`,
  `> quote`, `---`, `a\n---` and `[a]: https://x` into one paragraph holding the source text, and
  keeps `**bold** *it* ~~s~~ https://lichess.org [l](https://x.y)` as strong/emphasis/delete/link.
  Two GFM constructs are anonymous and cannot be disabled by name: a GFM table still parses as
  `table` and `[^1]: foot` still as `footnoteDefinition`
  (`micromark-extension-gfm-table@2.0.0/lib/syntax.js:36-44`, `micromark-extension-gfm-footnote@2.0.0/lib/syntax.js:35-46`).
  `    indented` becomes a paragraph `indented` (leading spaces dropped by paragraph parsing).
* P8 — Measured, today's editor round trip (`$RUN_TMP/probe/tiptap.mjs`, tiptap 3.20.0, marked
  17.0.3): loading `59. Olvidé…` yields an `orderedList`; a paragraph typed as `59. typed text`
  serializes unescaped as `59. typed text`, so it re-reads as a list; `1\. escaped` loads as
  `1 escaped` and is written back without the `.` (data loss on the next edit).
* P9 — Measured, disabling the StarterKit block nodes alone is unsafe: with heading, blockquote,
  horizontalRule, bulletList, orderedList, listItem, listKeymap and codeBlock off but the default
  parser, `# not heading` throws `RangeError: Unknown node type: heading` on load and `> quote`
  loads as `quote` (the marker is lost).
* P10 — Measured, a dedicated `marked` instance (`new Marked({tokenizer: {...}})` from `marked`
  17.0.3, the copy `@tiptap/markdown` resolves, `pnpm-lock.yaml:5960`) whose `heading`, `lheading`,
  `blockquote`, `hr`, `list`, `code`, `fences`, `html`, `def` and `table` tokenizers return
  `undefined`, passed as `Markdown.configure({ marked })` together with those StarterKit nodes off,
  loads and serializes `59. Olvidé…`, `- a dash`, `# not heading`, `> quote`, `---`,
  `    indented`, a GFM table, `**bold** and ++u++ ~~s~~`, `a\n\nb`, `a\nb` and `plain *star text`
  byte-identically, and an edit changes only the edited characters. An `escape` tokenizer returning
  a `text` token with the raw `\.` keeps `1\. escaped` byte-identical as well.
  Normalisations that remain on an edit (not losses): a bare URL becomes `[url](url)`, `<b>x</b>`
  becomes `**x**`, `a\n---` becomes `a\n\n---`.
* P11 — Measured, `@tiptap/markdown` registers its tokenizers on the marked instance at every
  editor creation (`@tiptap/markdown/dist/index.js:186-234`, `markedInstance.use`), and without a
  `marked` option that instance is the global `marked` singleton (`:110`). The editor is recreated
  on every move change (`AnnotationEditor.tsx:43`, deps `[position.join(",")]`). Probe
  `$RUN_TMP/probe/growth.mjs`: the global instance held 1, 11 and 61 inline and block extensions
  after 1, 11 and 61 editor creations — unbounded growth today.
* P12 — Pixels: the only e2e scenario with comment text is `e2e/files-preview.spec.ts:67-121`
  (a root comment, which stays a row). No e2e spec shows the Annotate panel. Container snapshots
  are re-recorded only through `pnpm test:e2e:update` under `d-20260919-13`
  (`.claude/skills/verify-ui/SKILL.md:40-53`).
* P13 — Gates: `Comment.tsx`, `CompleteMoveCell.tsx`, `GameNotation.tsx`, `notationRows.ts` and
  `src/components/panels/annotation/**` are measured in the `boards-game-analysis` coverage area
  (`coverage-areas.json:51-84`); none is in a frontend mutation package
  (`scripts/frontend-mutation-packages.mjs`). `package.json` and `pnpm-lock.yaml` are
  Sensitive-Path globs (`.claude/skills/push/SKILL.md:293-325`). Translation catalogues have no
  unused-key check (`scripts/i18n-completeness.mjs`).
* P14 — Added in round 1 from review evidence (`lens-correctness-r1`, `lens-plan-r1`), measured
  (`$RUN_TMP/probe/codefree.mjs`): with fenced code disabled but inline code spans kept, the
  reader parses ```` ```\nhello\n``` ```` as `inlineCode="hello"` and the editor writes it back as
  `` `hello` `` (fences and line breaks lost). With inline code spans disabled as well (reader
  `codeText`, editor `codespan` tokenizer and StarterKit `code` mark), both keep it as literal
  text, and the editor round trip of every probe case is byte-identical. The reader drops the
  leading spaces of `    indented` (paragraph parsing); the editor keeps them.
* P15 — Added in round 1 (`lens-plan-r1`), read: the table view builds its variation runs through
  the same inline builder (`notationRows.ts:151-160` `addInlineVariationRows` →
  `appendInlineTasks`, called from the table builder at `:343`, `:359`, `:365`, `:370`).
* P16 — Added in round 1 (`lens-plan-r1`), read: navigation scrolls the current move's *row* to
  the centre of the viewport (`GameNotation.tsx:89-103`, `scrollToIndex(rowIndex, { align:
  "center" })`); a row taller than the viewport therefore centres its middle, not the move.

## Approach

### O1 — One comment dialect: inline Markdown, block syntax is literal text

Rests on: "decide whether PGN comments are Markdown at all", "at minimum disable the block
constructs (lists, headings, blockquotes) for comment rendering", "ChessBase/PGN comments are plain
text, so any comment opening with `12. `, `- `, `# ` or `> ` is restyled".

A comment is read as: paragraphs (blank-line separated) and soft line breaks; inline emphasis,
strong, `++underline++`, strikethrough, links and autolink literals. Every block construct is shown
as the source text that wrote it: ordered and bullet lists, ATX and setext headings, blockquotes,
thematic breaks, indented and fenced code blocks, HTML blocks, link reference definitions, GFM
tables, GFM footnote definitions (and a footnote reference therefore stays literal text too).
Code is not part of the dialect at all: backticks are literal text, inline and fenced alike (P14;
a fenced block would otherwise collapse into an inline code span and lose its fences and line
breaks). Raw HTML stays text, never markup (existing guarantee).

Required behaviour, reader (`Comment.tsx`): the named constructs, including inline code spans, are
disabled at parse time, and the two anonymous GFM constructs (P7) are replaced by their own source
text, so no non-whitespace character of the comment disappears and no block or code element
(`ol`, `ul`, `li`, `h1`–`h6`, `blockquote`, `hr`, `pre`, `code`, `table`, footnote section) is ever
rendered. The reader is display-only: whitespace renders under normal HTML whitespace collapsing
(leading spaces of a line are not shown, as for any comment text today); the editor, which writes,
keeps whitespace byte-exact (O2). Inline formatting inside text that would have been a block
construct still renders (for named constructs it is ordinary paragraph text). The `multipleLine`
inline/block rule is unchanged.

Verification level: unit tests in `Comment.test.tsx` covering at least `59. Olvidé mi
preparación.`, `- a`, `# a`, `> a`, `---`, `a\n---`, `    indented`, a fenced block, `` `x` ``, a
GFM table, `[^1]: x` with a `[^1]` call, and `**b** ++u++ ~~s~~ [l](https://x.y)
https://lichess.org`; each asserts the rendered text (non-whitespace characters, in order) and the
absence of every block and code element listed above. The existing raw-HTML test stays green; the
existing inline-code underline test is replaced by one asserting that backticks are literal and
that `++x++` between backticks is underlined like any other text.

### O2 — The Annotate editor reads and writes the same dialect, without loss

Rests on: "the Annotate editor is a rich-text editor whose output format must be checked before
changing the reader"; "Why `build`: the Markdown question interacts with the Annotate editor's
write format (round-trip)".

Required behaviour (`AnnotationEditor.tsx`):

* The editor cannot author a block construct: the H1–H4, blockquote, horizontal-rule, bullet-list
  and ordered-list toolbar controls are removed, and the matching StarterKit nodes (heading,
  blockquote, horizontalRule, bulletList, orderedList, listItem, listKeymap, codeBlock) and the
  inline `code` mark are disabled, so their input rules and shortcuts (`# `, `1. `, `> `, `---`,
  fences, backticks) no longer fire. Bold, italic, underline, strike, clear-formatting, link and
  unlink stay.
* Its Markdown parser is a dedicated `marked` instance with the block tokenizers and the inline
  code-span tokenizer off and backslash escapes kept as literal text (P10, P14). A comment loaded
  into the editor and saved after an edit is
  byte-identical outside the edited characters for every O1 case except the P10 normalisations,
  which are named known limits.
* The instance is created per editor (inside the `useEditor` configuration), never shared at
  module level or left on the global `marked`, so tiptap's per-creation tokenizer registration
  (P11) no longer accumulates: the number of registered extensions on an editor's instance does not
  grow with the number of editors created.
* `marked` becomes a direct dependency at the exact version `@tiptap/markdown` already resolves
  (`17.0.3`), so the lockfile keeps one `marked` copy.
* Locale keys that no source references any more after the toolbar change (`RichText.H1`–`H4`,
  `RichText.Quote`, `RichText.HLine`, `RichText.BulletList`, `RichText.NumberedList`) are removed
  from every catalogue under `src/translation/`.

Verification level: `AnnotationEditor.test.tsx` (jsdom, the repo's vitest environment) mounts the
production `AnnotationEditor` inside a `TreeStateContext` store and asserts: the toolbar renders no
heading, quote, rule or list control and still renders bold, italic, underline, strike, clear,
link and unlink; per O1 case, a comment loaded from the store and edited once reaches the store
(through the component's own update path) as the input plus exactly that edit, and loading alone
writes nothing; typed block markers (`1. `, `# `, `> `, `- `) and backticks stay paragraph text in
the saved comment; `59. Olvidé…` loads as a paragraph, not a list; and remounting the editor
several times (node switches) leaves the registered tokenizer extensions of each editor's
instance constant. The O1 case list is defined once (test-only) and consumed by both the O1 and
the O2 tests, so reader and editor are proven against the same inputs.

### O3 — Comments stay in the move flow

Rests on: "because each comment ends the row, a game where nearly every move has a short comment
collapses to one half-move per line"; "Let short single-line comments stay inline in the move flow
instead of forcing a row break."

Required behaviour (`notationRows.ts`, the inline run builder — which builds every inline move
run: the inline view's mainline and variations, and the table view's variation runs, P15):

* A move's comment never closes the `moves` row. The run continues to the next move; rows still
  close on variations, on `NOTATION_ROW_MAX_MOVES`, and at the end of a line, exactly as today.
* A variation's starting comment no longer closes the run before its move nor becomes a `comment`
  row in an inline run: it travels with that move in the `moves` row (its prose only, commands
  stripped exactly as today by `splitPgnComment`) and is drawn in front of the move, inline, by the
  move cell; that move keeps `first: true` so its move number follows the comment.
* "Short" is not a length threshold: every comment is drawn in the flow, and the existing
  `Comment` line rule decides inline (`span`) versus block. A multi-line comment is a block inside
  the row and therefore starts and ends its own line without a row break.
* Table view: its variation runs follow the two rules above, because they are inline move runs
  drawn as flowing text (P15); its two-column mainline table rows keep their comment rows and
  starting-comment rows exactly as today (P5).
* The root (game) comment row and the `rowForNode` / path contracts are unchanged. Move numbering
  after a comment is unchanged (a black move after a white move's comment still shows no `1...`;
  pre-`88ad35ef` behaviour).

Verification level: `notationRows.test.ts` — a mainline with a comment on every move yields one
`moves` row (for fewer than `NOTATION_ROW_MAX_MOVES` moves) in the inline view and the unchanged
per-comment rows in the table view; the existing inline starting-comment tests are rewritten to
the new contract (comment travels with the move, no `comment` row, `first: true`, commands
stripped, nothing when the comment is commands-only or comments are hidden); the table-view
starting-comment tests for mainline moves stay as they are, and a new table-view case puts a move
comment and a starting comment inside a variation and asserts one `moves` row with no `comment`
row for that variation. `CompleteMoveCell.test.tsx` — the starting comment renders before the move
and not when comments are hidden. `GameNotation.test.tsx` — with comments shown, the mounted
notation passes a variation's starting comment to that move's cell (the existing cell mock exposes
it), so a dropped forwarding goes red.

### O5 — Navigation keeps the current move visible in a tall row

Rests on: "Let short single-line comments stay inline in the move flow instead of forcing a row
break" — once comments no longer end rows, a row of up to `NOTATION_ROW_MAX_MOVES` commented moves
can be taller than the notation viewport, and centring the row (P16) would hide the current move.

Required behaviour (`GameNotation.tsx`): when the current move changes, the notation scrolls so that
the current move's own cell is inside the viewport, also when its row is taller than the viewport;
rows that fit keep today's centring. The fallback for a node without a row (P16's parent walk) and
the scroll to the top for an empty selection are unchanged.

Verification level: a Playwright container scenario (O4's game, extended with comments long enough
that one row is taller than the viewport) navigates to a move at the start and at the end of that
row and asserts the current move is in the viewport each time; jsdom has no layout, so no unit test
can prove this.

### O4 — Pixel proof of both effects

Rests on: "Pixels via `pnpm test:e2e:container`".

A new Playwright scenario in `e2e/files-preview.spec.ts` previews a game whose mainline carries the
MANDATE's comments (`6. Nf3 {62} h6 7. Be3 {59. Olvidé mi preparación. Tengo Ld3 en mi prep.} Bd6
8. Be2 {59}`, as lexer tokens like the existing scenarios). It asserts that the notation contains
no `ol`/`li`, that the text `59. Olvidé mi preparación.` is visible, and that `Nf3` and `h6` share
one line (equal bounding-box top), then records one new container snapshot. The O5 assertions run
in the same spec file. Existing snapshots must not move; if one does, it is a regression to fix,
not to re-record (P12).

Depends on O1, O3 and O5.

## Decisions and trade-offs

* PGN comments are not full Markdown (O1). Kept: inline formatting, because ChessFable's own
  editor has written it into users' PGNs and inline markers are rare in plain-text prose.
  Dropped: block constructs, because their markers (`12. `, `- `, `# `, `> `) are ordinary at the
  start of chess prose and every other PGN tool shows them as text.
* The editor is narrowed to the dialect (O2) instead of the reader special-casing editor output:
  a PGN comment carries no marker of who wrote it.
* Comments in every inline move run return to the pre-`88ad35ef` flow (O3); the table view's
  mainline keeps its rows. Tall rows are handled by scrolling to the move (O5), not by re-breaking
  rows on comment length.

## Decided autonomously

1. **Question:** are PGN comments Markdown at all? **Chosen:** an inline-only Markdown dialect;
   block constructs render as their source text, and code (inline and fenced) is not part of it —
   backticks are literal (P14: keeping inline code turns a fenced block into a lossy code span).
   **Rejected:** keeping inline code and adding a source-text fallback for fenced blocks in both
   parsers (a second preservation mechanism per parser for a construct with no chess use; the
   editor has no code control); plain text everywhere (removes the
   bold/italic/underline/strike/link formatting the editor has already written into users' files,
   and the editor itself); full Markdown with a special case for a leading `N. ` (leaves `- `,
   `# `, `> ` restyled — the same class); detecting editor-authored comments (PGN has no such
   marker). **Reason:** PGN comments are plain text for ChessBase, Lichess and every other tool;
   block markers are common at the start of chess prose, inline markers are not. **Reversal
   path:** re-enable constructs in the one disable list per parser (O1/O2).
2. **Question:** what happens to the editor's block controls? **Chosen:** removed, with their
   StarterKit nodes, and the editor parses with an inline-only `marked` instance. **Rejected:**
   keep the controls (the editor would author text the notation shows literally); disable the
   nodes only (P9: crash on `#`, marker lost on `>`); one module-level instance (P11: tiptap
   re-registers its tokenizers on every editor creation). **Reason:** one dialect on both sides,
   measured lossless (P10). Existing comments that contain a list or heading now display as their
   Markdown source text. **Reversal path:** restore the controls and nodes and drop the custom
   instance.
3. **Question:** which comments stay inline? **Chosen:** all of them in every inline move run; the
   existing `Comment` line rule decides inline versus block; starting comments too; a row taller
   than the viewport is handled by scrolling to the current move (O5). **Rejected:** a
   character-length threshold for "short" (panel-width dependent, absent before `88ad35ef`);
   keeping a row break after multi-line comments (a block comment already occupies its own line);
   re-breaking rows by accumulated comment length to keep them short (a heuristic that still
   leaves one long comment taller than a small viewport).
   **Reason:** restores the flow `88ad35ef` broke without a recorded reason (P4). **Reversal
   path:** the break condition in the inline builder.
4. **Question:** does the table view change? **Chosen:** its two-column mainline keeps its comment
   rows; its variation runs, which are inline move runs built by the same builder (P15), follow the
   inline flow. **Rejected:** comments inside table cells (a two-column move table has no move
   flow; table rows for comments predate `88ad35ef`, P5); a table-view flag that keeps the old
   breaks in variation runs (two behaviours for one kind of run). **Reason:** the MANDATE's flow is
   the move flow wherever moves flow as text.
5. **Question:** how does the editor get `marked`? **Chosen:** a direct dependency pinned to
   `17.0.3`, the version `@tiptap/markdown@3.20.0` resolves. **Rejected:** importing tiptap's
   transitive copy (not resolvable under pnpm's strict layout); mutating the global instance
   through `markedOptions` (keeps the P11 accumulation and affects every marked user).
   **Reason:** an isolated per-editor instance needs the `Marked` class.

## Risks / open questions

* tiptap-markdown internals (`registerTokenizer`, the `marked` option) are a dependency contract;
  the O2 test pins them so a tiptap bump that breaks them goes red.
* A user's existing editor-authored heading or list now reads as `# …` / `1. …`. Accepted under
  decision 2.
* Rows may grow taller in comment-heavy games; rows are measured dynamically (P6) and still capped
  at `NOTATION_ROW_MAX_MOVES` moves; navigation scrolls to the current move inside them (O5).

## Not part of this task

* Move-number display after a comment (`1. e4 {c} e5` vs `1... e5`).
* Table-view mainline layout of comments (decision 4).
* Editor display of a backslash escape (`1\.` shows the backslash in the editor; the notation shows
  `1.`): no character is lost either way (P14).
* Editor normalisations on edit listed in P10 (bare URL → link, HTML → Markdown, setext break).
* The comment format written by any other tool, PGN export, and the database storage of comments.

## Phases

Phases 1 and 2 are file-disjoint and independent; phase 3 depends on both. Each ends green and is
committed by the orchestrator.

### Phase 1 — Comment dialect (O1, O2)

* Files: `src/components/common/Comment.tsx`, `src/components/common/Comment.test.tsx`,
  `src/components/panels/annotation/AnnotationEditor.tsx`, a new
  `src/components/panels/annotation/AnnotationEditor.test.tsx`, the shared O1 case list (in a test
  file or test fixture; never a production module), `package.json`, `pnpm-lock.yaml`,
  `src/translation/*.json`.
* Touches: an npm dependency (Sensitive Path); no auth, persistence, concurrency or IPC.
* Role: `sensitive` (Sensitive-Path hit).
* Proof: `pnpm install --frozen-lockfile && pnpm vitest run src/components/common/Comment.test.tsx src/components/panels/annotation && pnpm lint:ci && pnpm i18n:check && pnpm checks:pre-review`.

### Phase 2 — Inline flow and navigation (O3, O5)

* Files: `src/components/common/notationRows.ts`, `src/components/common/notationRows.test.ts`,
  `src/components/common/CompleteMoveCell.tsx`, `src/components/common/CompleteMoveCell.test.tsx`,
  `src/components/common/GameNotation.tsx` (passes the starting comment to the cell; O5 scroll),
  `src/components/common/GameNotation.test.tsx`.
* Touches: no auth, persistence, concurrency or API contract; the row model is shared by every
  notation surface (P6).
* Role: `normal`.
* Proof: `pnpm vitest run src/components/common && pnpm lint:ci && pnpm checks:pre-review`.

### Phase 3 — Pixel and navigation proof (O4, O5)

* Files: `e2e/files-preview.spec.ts`, its new snapshot under `e2e/files-preview.spec.ts-snapshots/`.
* Role: `normal`.
* Proof: `pnpm test:e2e:container` first (every existing snapshot green; the new scenario fails
  only on its missing snapshot, its O4/O5 assertions green), then
  `pnpm test:e2e:update -- --grep "<new scenario title>"` (the runner drops pnpm's `--`,
  `scripts/run-e2e-container.mjs:45-59`), then `pnpm test:e2e:container` green; the commit message
  names the one new snapshot.

## Carried to diff review

* CR-1 (from I8, `lens-tests-r1` finding 2) — O1's `Comment.test.tsx` cases assert the retained
  formatting elements, not only text: `strong`, `em`, `del`, `u` and `a` with its `href`, including
  formatting inside block-looking prose (`59. **x**` renders `59. ` as text and `x` in `strong`).

## Reviews

### Round 1 — plan-r1 (12 lenses, every plan-capable lens)

Wall elapsed 354 s (first prompt 1791709851 → last report 1791710205); no waits. Verdicts:
REVISE — plan, correctness, tests; APPROVED — minimalism, error-handling (one should-fix),
chess-semantics; NOT APPLICABLE + APPROVED — engine-protocol, ipc-contract, persisted-state,
pgn-index, platform-semantics, tauri-security.

| ID | Claim | Witnesses (lens#finding) | Evidence checked by the arbiter | Disposition | Authority | Status |
| --- | --- | --- | --- | --- | --- | --- |
| I1 | Disabling fenced code but keeping inline code spans turns ```` ```\nx\n``` ```` into a lossy inline code span in reader and editor | correctness-r1#1, plan-r1#1 | probe `codefree.mjs keep-code`: reader `inlineCode="hello"`, editor writes `` `hello` `` (P14) | Fix — code leaves the dialect (O1, O2; decision 1) | MANDATE "at minimum disable the block constructs"; O1 literal-text contract | open → closure r2 |
| I2 | Reader drops leading spaces of `    indented`; "no character lost" contract not met, reader and editor inconsistent | correctness-r1#2, plan-r1#1 | probe `remark.mjs`: `paragraph(text="indented")`; editor keeps the spaces (P14) | Fix — O1 contract: no non-whitespace character lost; reader display-only under HTML collapsing; editor byte-exact | MANDATE Defect (1), plain-text comments | open → closure r2 |
| I3 | "Inline builder only" also changes table-view variation runs | plan-r1#2 | `notationRows.ts:151-160`, `:343`, `:359`, `:365`, `:370` (P15) | Fix — O3 states the table view's variation runs follow the flow; mainline table rows unchanged; new table-view test (decision 4) | MANDATE "Let short single-line comments stay inline in the move flow" | open → closure r2 |
| I4 | Tall rows: centring the row hides the current move | plan-r1#3 | `GameNotation.tsx:89-103` (P16) | Fix — new O5 (scroll to the current move's cell), proven in the container (phase 3) | MANDATE "Let short single-line comments stay inline…" (necessary correctness of O3) | open → closure r2 |
| I5 | No proof that `GameNotation` forwards the starting comment to the cell | plan-r1#4 | `GameNotation.tsx:300-316` `moveProps`; `GameNotation.test.tsx:34-40,59-75` hides comments and mocks the cell | Fix — O3 verification adds a `GameNotation.test.tsx` forwarding assertion | MANDATE (O3 verification) | open → closure r2 |
| I6 | Parser/serializer failure semantics undefined in O2 | error-handling-r1#1 | `AnnotationEditor.tsx:38-40`: the store is written only from `onUpdate` on a user edit, so a load can never overwrite a comment; the P9 throw class is removed because parser and schema now match, and O2's mounted test loads every case | Skip — no failure path the plan introduces; a new error surface for an unobserved failure is outside MANDATE (confidence 92, verdict APPROVED) | — | closed (Skip) |
| I7 | O2 tests bypass `AnnotationEditor` (toolbar, input rules, store write) | tests-r1#1 | `AnnotationEditor.tsx:93-105` controls, `:38-40` `setComment` path | Fix — O2 verification mounts the production component in a `TreeStateContext` store | MANDATE "the Annotate editor … output format must be checked" | open → closure r2 |
| I8 | O1 assertions do not prove retained inline formatting | tests-r1#2 | test-assertion detail inside unchanged O1 | Fix — carried to CR-1 | — | carried (CR-1) |

Round 1 adopted plan-level corrections: 6 (I1, I2, I3, I4, I5, I7); carried 1 (I8 → CR-1);
skipped 1 (I6). Unique issues opened 8; resolved 1 (Skip); carried 1; open 6.

#### lens-plan-r1 (raw)

```text
[blocker] tasks/plans/.plan-2026-10-11-comment-dialect-and-inline-flow.md-r1.body.md:124 — O1/O2’s parser mechanism does not preserve literal block text. Running the supplied `remark.mjs:9` and `tiptap3.mjs:11` mechanisms with `"```\nfenced text\n```"` produces an `inlineCode` node in the reader and ``"`fenced text`"`` from the editor. The fences and line breaks disappear, contrary to O1 and O2:152. The reader probe also drops all four spaces from `"    indented"`. Require a preservation mechanism and shared regression cases for both inputs (confidence: 100).

[blocker] tasks/plans/.plan-2026-10-11-comment-dialect-and-inline-flow.md-r1.body.md:177 — The “inline builder only” boundary does not preserve table view as promised at line 188. `notationRows.ts:159` routes variation rendering through `appendInlineTasks`, and table view calls that route at `notationRows.ts:343`, `:359`, `:365` and `:370`. Removing comment boundaries and starting-comment rows therefore changes table-view variations too. The retained table tests at `notationRows.test.ts:251` cover mainline moves, so they would miss this consumer. Specify how table-view variations retain their current behavior and prove that boundary (confidence: 100).

[blocker] tasks/plans/.plan-2026-10-11-comment-dialect-and-inline-flow.md-r1.body.md:185 — Combining multiline comments into tall rows breaks current-move visibility. `GameNotation.tsx:93` resolves navigation to a row, then `:99` centers the whole row rather than the selected move. The installed virtualizer’s center-offset probe returned visible coordinates `[384,576]` for a 960px row in a 192px viewport, hiding moves near either end. Multiline comments render as blocks at `Comment.tsx:56`, so this is reachable through ordinary annotated games. Dynamic measurement prevents overlapping rows, but does not reveal the selected move. O3 needs a navigation obligation and proof for rows taller than the viewport (confidence: 96).

[blocker] tasks/plans/.plan-2026-10-11-comment-dialect-and-inline-flow.md-r1.body.md:192 — The proofs do not verify that starting comments reach the notation through `GameNotation`. Row-model tests and direct cell tests can pass while `GameNotation.tsx:304` drops the new value. Existing integration tests hide comments at `GameNotation.test.tsx:39` and mock the cell without displaying comment props at `:68`. O4’s fixture contains only move comments. Require an integration assertion that fails when starting-comment forwarding is omitted (confidence: 98).

VERDICT: REVISE
```

#### lens-minimalism-r1 (raw)

```text
No bloat or duplication defects found.

Minimum-diff counterfactual: the new editor test verifies round-trip behavior, the shared case list serves both parser tests, and the single new snapshot supplies the mandated pixel proof. No proposed added file is demonstrably unnecessary.

VERDICT: APPROVED
```

#### lens-correctness-r1 (raw)

```text
[blocker] tasks/plans/.plan-2026-10-11-comment-dialect-and-inline-flow.md-r1.body.md:150 — Disabling block tokenizers leaves fenced backticks consumed by inline-code parsing. Using the supplied probes with `"```\nhello\n```"`, the reader produces `inlineCode="hello"` and the editor serializes `` `hello` ``. After an edit it writes `` `!hello` ``, losing the fences and newlines. O1 requires literal block syntax, and O2 requires preservation outside edited characters. This is not a P10 exception. (confidence: 100)

[blocker] tasks/plans/.plan-2026-10-11-comment-dialect-and-inline-flow.md-r1.body.md:124 — Parse-time disabling of indented code drops leading whitespace. The reader probe maps `"    indented"` to `paragraph(text="indented")`, while the editor preserves all four spaces. The proposed mechanisms therefore violate O1’s character-preservation guarantee and leave reader/editor behavior inconsistent. The plan needs a source-preservation contract for this case. (confidence: 100)

VERDICT: REVISE
```

#### lens-error-handling-r1 (raw)

```text
[should-fix] tasks/plans/.plan-2026-10-11-comment-dialect-and-inline-flow.md-r1.body.md:150 — O2 specifies successful round trips but leaves parser and serializer failure semantics undefined. Current editor creation, `setContent` and `getMarkdown` calls have no error handling. Specify that failure preserves the original comment, prevents replacement writes, and surfaces a distinguishable error. Include failure-path proof alongside the round-trip tests (confidence: 92).

VERDICT: APPROVED
```

#### lens-tests-r1 (raw)

```text
[blocker] tasks/plans/.plan-2026-10-11-comment-dialect-and-inline-flow.md-r1.body.md:164 — O2 tests construct an editor and serialize directly, without exercising AnnotationEditor’s toolbar, typing input rules, or saved store value. Restoring block controls or breaking `onUpdate → setComment` would leave these proofs green. O4 only visits the preview, so the container suite supplies no editor proof either. Add a mounted editor journey asserting block controls are absent, typed block markers remain text, and an edit saves the expected comment. (confidence: 97)

[should-fix] tasks/plans/.plan-2026-10-11-comment-dialect-and-inline-flow.md-r1.body.md:131 — Rendered-text and forbidden-block assertions do not prove retained inline formatting. Replacing strong, emphasis, strike, and links with unformatted text would preserve those assertions and the existing underline/code tests. Assert the formatting elements and link destinations, including formatting within literal block-looking prose. (confidence: 96)

VERDICT: REVISE
```

#### lens-chess-semantics-r1 (raw)

```text
No chess-domain invariant violations found in plan-r1. The proposed flow preserves node ownership, root-anchored move numbering, path reconstruction, and separately stored comment metadata.

VERDICT: APPROVED
```

#### lens-engine-protocol-r1 (raw)

```text
NOT APPLICABLE: The plan’s files and obligations cover comment parsing, editor formatting, notation layout and pixel verification. They do not change engine process supervision, UCI protocol state or asynchronous engine result routing.
VERDICT: APPROVED
```

#### lens-ipc-contract-r1 (raw)

```text
NOT APPLICABLE: O1–O4 cover renderer comment parsing, editor formatting, notation layout and pixel verification. No Rust commands, events, IPC payloads, subscriptions or capability scopes are changed.
VERDICT: APPROVED
```

#### lens-persisted-state-r1 (raw)

```text
NOT APPLICABLE: The plan’s files and obligations change comment parsing, editor formatting and notation layout. They do not change renderer storage encoding, keys, atom families, hydration or tab lifecycle.

VERDICT: APPROVED
```

#### lens-pgn-index-r1 (raw)

```text
NOT APPLICABLE: O1–O4 change comment rendering, editor Markdown parsing, notation layout and pixel tests. They do not change PGN byte scanning, offsets, move encoding, database storage, search or disk export.

VERDICT: APPROVED
```

#### lens-platform-semantics-r1 (raw)

```text
NOT APPLICABLE: O1–O4 change JavaScript comment parsing, editor configuration and notation layout. They introduce no OS-specific paths, handles, filesystem operations, FFI or target branches. Container pixels do not claim macOS or Windows runtime proof.
VERDICT: APPROVED
```

#### lens-tauri-security-r1 (raw)

```text
NOT APPLICABLE: The plan’s files and O1–O4 obligations cover renderer comment parsing, editor formatting, notation layout and pixel tests. They introduce no credentials, session persistence, native filesystem authority or mutation, signed downloads, or backend diagnostic flows.

VERDICT: APPROVED
```

### plan-r3.md

# Plan: PGN comments render as plain text with inline formatting, and stay in the move flow

Plan path: `tasks/plans/2026-10-11-comment-dialect-and-inline-flow.md` · Finding: `f-20261001-10` ·
Base: `8b3e94cbdfa1b3c1638ba73c31d46f8bbd1b821e` · Mode: PLAN-ONLY (drain planner, `full auto`).

## Goal

A ChessBase-style PGN comment such as `{59. Olvidé mi preparación.}` reads as the text it is, and a
game where nearly every move carries a short comment (`{62}`, `{59}`) reads as a flowing line of
moves, not one half-move per line — in the analysis tab and in every preview that mounts
`GameNotation`. The Annotate editor writes exactly the comment format the notation reads.

## MANDATE

Verbatim from `tasks/findings.md`, `f-20261001-10`:

* **Where:** `src/components/common/Comment.tsx` (comment text goes through `react-markdown` + `remark-gfm`; a comment with several non-empty lines switches to `display: block`), `src/components/common/notationRows.ts` (~339-383: every move comment is emitted as its own `comment` row via `addComment`, which closes the current move row).
* **Defect:** in Felix's game Beck–Riewe (Elo Vierer Caissa Center, 2026.08.09, `~/Documents/Sport/Schach/ChessFable/Eigene Partien/Meine Partien.pgn` line 2178) almost every move carries a comment with the remaining clock minutes (`6. Nf3 {62} h6 7. Be3 {59. Olvidé mi preparación. Tengo Ld3 en mi prep.} Bd6 8. Be2 {59}`). Two effects, both visible in the database preview and the analysis tab: (1) the comment `59. Olvidé…` starts with "number + period + space", which Markdown parses as an ordered list starting at 59, rendering a block-level list with margins and an empty gap; ChessBase/PGN comments are plain text, so any comment opening with `12. `, `- `, `# ` or `> ` is restyled; (2) because each comment ends the row, a game where nearly every move has a short comment collapses to one half-move per line and wastes most of the panel width.
* **Fix shape:** decide whether PGN comments are Markdown at all (they are written by ChessBase and other tools as plain text; the Annotate editor is a rich-text editor whose output format must be checked before changing the reader); at minimum disable the block constructs (lists, headings, blockquotes) for comment rendering. Let short single-line comments stay inline in the move flow instead of forcing a row break. Pixels via `pnpm test:e2e:container`.
* **Open question:** are PGN comments Markdown at all, given what the Annotate editor writes back, and which comments may stay inline in the move flow instead of ending the row.
* **Why `build`:** the Markdown question interacts with the Annotate editor's write format (round-trip), and the row model change touches `notationRows.ts` shared by every notation view.

## Threat model and non-goals

* **Input is accidental, not adversarial.** Comment text comes from PGN files written by ChessBase,
  Lichess, other GUIs and ChessFable's own Annotate editor, and from imported databases. No
  attacker model beyond the one already pinned: raw HTML in a comment is shown as text and never
  executed (`src/components/common/Comment.test.tsx:25`); that guarantee is kept unchanged.
* **Environments:** the renderer on Linux, macOS and Windows (WebKitGTK / WebKit / WebView2) and
  the pinned Playwright Chromium image for pixels. No Rust, IPC, persistence or capability change.
* Frozen with the MANDATE.

## Traced premises

Locate evidence, frozen. Probe scripts and their full output are in the run directory
(`$RUN_TMP/probe/`); the observed results are quoted here.

* P1 — Reader: `src/components/common/Comment.tsx:48-71` renders every comment through
  `react-markdown` with `remarkGfm` and a local `remarkUnderline` plugin; `multipleLine` (more than
  one non-empty line) switches the wrapper to `display: block` and paragraphs to `<p>`, otherwise
  `<span>`.
* P2 — Editor: `src/components/panels/annotation/AnnotationEditor.tsx:24-44` uses tiptap
  `StarterKit` + `@tiptap/markdown` (`contentType: "markdown"`, `setComment(editor.getMarkdown())`
  on every user update) and offers H1–H4, blockquote, horizontal rule, bullet list and ordered list
  controls (`:93-105`). Comments written by ChessFable are therefore Markdown, including block
  constructs.
* P3 — The inline row model breaks the run after every commented move:
  `src/components/common/notationRows.ts:224-237` (`hasComment || hasVariations || reachedLimit`
  closes the `moves` row). In the inline view the comment itself is not a row — it is drawn inside
  the move cell (`src/components/common/CompleteMoveCell.tsx:174`); only the break is the row
  model's. A variation's starting comment additionally closes the run *before* its move and becomes
  its own `comment` row (`notationRows.ts:205-219`).
* P4 — The break after a commented move is a regression of `88ad35ef` (2026-09-23, virtualized
  notation, `d-20260923-01`): before it, `RenderVariationTree` (`git show 88ad35ef^:src/components/common/GameNotation.tsx:195-264`)
  drew the mainline as one flow with single-line comments inline (`cb12c03d` "Put single line
  comments inline"). `d-20260923-01` records no reason for the break.
* P5 — Table view emitted comments as their own table rows before `88ad35ef` too
  (`88ad35ef^:GameNotation.tsx:313-440`) and still does (`notationRows.ts:321-375`).
* P6 — Every notation surface goes through one component: `BoardAnalysis.tsx:294`,
  `BoardGame.tsx:1430`, `databases/GamePreview.tsx:112`, `puzzles/Puzzles.tsx:881` mount
  `GameNotation`; the inline view is the default (`src/state/atoms.ts:286`, `tableViewAtom`
  defaults to `false`). Rows are measured dynamically (`GameNotation.tsx:82-84,157`,
  `measureElement`), so a row's height is not fixed.
* P7 — Measured, micromark construct disabling (`$RUN_TMP/probe/remark.mjs`, unified 11 /
  remark-parse 11 / remark-gfm 4.0.0 / micromark 4.0.0): a remark plugin pushing
  `{disable: {null: ["blockQuote","codeFenced","codeIndented","headingAtx","htmlFlow","list","setextUnderline","thematicBreak","definition"]}}`
  into `micromarkExtensions` turns `59. Olvidé mi preparación.`, `- a dash`, `# not heading`,
  `> quote`, `---`, `a\n---` and `[a]: https://x` into one paragraph holding the source text, and
  keeps `**bold** *it* ~~s~~ https://lichess.org [l](https://x.y)` as strong/emphasis/delete/link.
  Two GFM constructs are anonymous and cannot be disabled by name: a GFM table still parses as
  `table` and `[^1]: foot` still as `footnoteDefinition`
  (`micromark-extension-gfm-table@2.0.0/lib/syntax.js:36-44`, `micromark-extension-gfm-footnote@2.0.0/lib/syntax.js:35-46`).
  `    indented` becomes a paragraph `indented` (leading spaces dropped by paragraph parsing).
* P8 — Measured, today's editor round trip (`$RUN_TMP/probe/tiptap.mjs`, tiptap 3.20.0, marked
  17.0.3): loading `59. Olvidé…` yields an `orderedList`; a paragraph typed as `59. typed text`
  serializes unescaped as `59. typed text`, so it re-reads as a list; `1\. escaped` loads as
  `1 escaped` and is written back without the `.` (data loss on the next edit).
* P9 — Measured, disabling the StarterKit block nodes alone is unsafe: with heading, blockquote,
  horizontalRule, bulletList, orderedList, listItem, listKeymap and codeBlock off but the default
  parser, `# not heading` throws `RangeError: Unknown node type: heading` on load and `> quote`
  loads as `quote` (the marker is lost).
* P10 — Measured, a dedicated `marked` instance (`new Marked({tokenizer: {...}})` from `marked`
  17.0.3, the copy `@tiptap/markdown` resolves, `pnpm-lock.yaml:5960`) whose `heading`, `lheading`,
  `blockquote`, `hr`, `list`, `code`, `fences`, `html`, `def` and `table` tokenizers return
  `undefined`, passed as `Markdown.configure({ marked })` together with those StarterKit nodes off,
  loads and serializes `59. Olvidé…`, `- a dash`, `# not heading`, `> quote`, `---`,
  `    indented`, a GFM table, `**bold** and ++u++ ~~s~~`, `a\n\nb`, `a\nb` and `plain *star text`
  byte-identically, and an edit changes only the edited characters. An `escape` tokenizer returning
  a `text` token with the raw `\.` keeps `1\. escaped` byte-identical as well.
  Normalisations that remain on an edit (not losses): a bare URL becomes `[url](url)`, `<b>x</b>`
  becomes `**x**`, `a\n---` becomes `a\n\n---`.
* P11 — Measured, `@tiptap/markdown` registers its tokenizers on the marked instance at every
  editor creation (`@tiptap/markdown/dist/index.js:186-234`, `markedInstance.use`), and without a
  `marked` option that instance is the global `marked` singleton (`:110`). The editor is recreated
  on every move change (`AnnotationEditor.tsx:43`, deps `[position.join(",")]`). Probe
  `$RUN_TMP/probe/growth.mjs`: the global instance held 1, 11 and 61 inline and block extensions
  after 1, 11 and 61 editor creations — unbounded growth today.
* P12 — Pixels: the only e2e scenario with comment text is `e2e/files-preview.spec.ts:67-121`
  (a root comment, which stays a row). No e2e spec shows the Annotate panel. Container snapshots
  are re-recorded only through `pnpm test:e2e:update` under `d-20260919-13`
  (`.claude/skills/verify-ui/SKILL.md:40-53`).
* P13 — Gates: `Comment.tsx`, `CompleteMoveCell.tsx`, `GameNotation.tsx`, `notationRows.ts` and
  `src/components/panels/annotation/**` are measured in the `boards-game-analysis` coverage area
  (`coverage-areas.json:51-84`); none is in a frontend mutation package
  (`scripts/frontend-mutation-packages.mjs`). `package.json` and `pnpm-lock.yaml` are
  Sensitive-Path globs (`.claude/skills/push/SKILL.md:293-325`). Translation catalogues have no
  unused-key check (`scripts/i18n-completeness.mjs`).
* P14 — Added in round 1 from review evidence (`lens-correctness-r1`, `lens-plan-r1`), measured
  (`$RUN_TMP/probe/codefree.mjs`): with fenced code disabled but inline code spans kept, the
  reader parses ```` ```\nhello\n``` ```` as `inlineCode="hello"` and the editor writes it back as
  `` `hello` `` (fences and line breaks lost). With inline code spans disabled as well (reader
  `codeText`, editor `codespan` tokenizer and StarterKit `code` mark), both keep it as literal
  text, and the editor round trip of every probe case is byte-identical. The reader drops the
  leading spaces of `    indented` (paragraph parsing); the editor keeps them.
* P15 — Added in round 1 (`lens-plan-r1`), read: the table view builds its variation runs through
  the same inline builder (`notationRows.ts:151-160` `addInlineVariationRows` →
  `appendInlineTasks`, called from the table builder at `:343`, `:359`, `:365`, `:370`).
* P16 — Added in round 1 (`lens-plan-r1`), read: navigation scrolls the current move's *row* to
  the centre of the viewport (`GameNotation.tsx:89-103`, `scrollToIndex(rowIndex, { align:
  "center" })`); a row taller than the viewport therefore centres its middle, not the move.
* P17 — Added in round 2 (`lens-correctness-r2`), read: in the table view's white-move branch the
  black move's alternatives are read as `black.children.slice(1)` (`notationRows.ts:349`) — the
  alternatives to the *next* white move — while the rows are built from the white move
  (`addInlineVariationRows(…, child, …)`, `:365`, `:370`). For `1. e4 e5 (1... c5) 2. Nf3` with no
  alternative to `Nf3`, `c5` and its comments never reach the builder; when `Nf3` does have an
  alternative, an empty variation row for `e4`'s single child is emitted instead. The `!isWhite`
  branch reads `current.children.slice(1)` correctly (`:333`, `:340`). Introduced by `88ad35ef`; the
  existing table test (`notationRows.test.ts:112-126`) only checks that some variation row exists.

## Approach

### O1 — One comment dialect: inline Markdown, block syntax is literal text

Rests on: "decide whether PGN comments are Markdown at all", "at minimum disable the block
constructs (lists, headings, blockquotes) for comment rendering", "ChessBase/PGN comments are plain
text, so any comment opening with `12. `, `- `, `# ` or `> ` is restyled".

A comment is read as: paragraphs (blank-line separated) and soft line breaks; inline emphasis,
strong, `++underline++`, strikethrough, links and autolink literals. Every block construct is shown
as the source text that wrote it: ordered and bullet lists, ATX and setext headings, blockquotes,
thematic breaks, indented and fenced code blocks, HTML blocks, link reference definitions, GFM
tables, GFM footnote definitions (and a footnote reference therefore stays literal text too).
Code is not part of the dialect at all: backticks are literal text, inline and fenced alike (P14;
a fenced block would otherwise collapse into an inline code span and lose its fences and line
breaks). Raw HTML stays text, never markup (existing guarantee).

Required behaviour, reader (`Comment.tsx`): the named constructs, including inline code spans, are
disabled at parse time, and the two anonymous GFM constructs (P7) are replaced by their own source
text, so no non-whitespace character of the comment disappears and no block or code element
(`ol`, `ul`, `li`, `h1`–`h6`, `blockquote`, `hr`, `pre`, `code`, `table`, footnote section) is ever
rendered. The reader is display-only: whitespace renders under normal HTML whitespace collapsing
(leading spaces of a line are not shown, as for any comment text today); the editor, which writes,
keeps whitespace byte-exact (O2). Inline formatting inside text that would have been a block
construct still renders (for named constructs it is ordinary paragraph text). The `multipleLine`
inline/block rule is unchanged.

Verification level: unit tests in `Comment.test.tsx` covering at least `59. Olvidé mi
preparación.`, `- a`, `# a`, `> a`, `---`, `a\n---`, `    indented`, a fenced block, `` `x` ``, a
GFM table, `[^1]: x` with a `[^1]` call, and `**b** ++u++ ~~s~~ [l](https://x.y)
https://lichess.org`; each asserts the rendered text (non-whitespace characters, in order) and the
absence of every block and code element listed above. The existing raw-HTML test stays green; the
existing inline-code underline test is replaced by one asserting that backticks are literal and
that `++x++` between backticks is underlined like any other text.

### O2 — The Annotate editor reads and writes the same dialect, without loss

Rests on: "the Annotate editor is a rich-text editor whose output format must be checked before
changing the reader"; "Why `build`: the Markdown question interacts with the Annotate editor's
write format (round-trip)".

Required behaviour (`AnnotationEditor.tsx`):

* The editor cannot author a block construct: the H1–H4, blockquote, horizontal-rule, bullet-list
  and ordered-list toolbar controls are removed, and the matching StarterKit nodes (heading,
  blockquote, horizontalRule, bulletList, orderedList, listItem, listKeymap, codeBlock) and the
  inline `code` mark are disabled, so their input rules and shortcuts (`# `, `1. `, `> `, `---`,
  fences, backticks) no longer fire. Bold, italic, underline, strike, clear-formatting, link and
  unlink stay.
* Its Markdown parser is a dedicated `marked` instance with the block tokenizers and the inline
  code-span tokenizer off and backslash escapes kept as literal text (P10, P14). A comment loaded
  into the editor and saved after an edit is
  byte-identical outside the edited characters for every O1 case except the P10 normalisations,
  which are named known limits.
* The instance is created per editor (inside the `useEditor` configuration), never shared at
  module level or left on the global `marked`, so tiptap's per-creation tokenizer registration
  (P11) no longer accumulates: the number of registered extensions on an editor's instance does not
  grow with the number of editors created.
* `marked` becomes a direct dependency at the exact version `@tiptap/markdown` already resolves
  (`17.0.3`), so the lockfile keeps one `marked` copy.
* Locale keys that no source references any more after the toolbar change (`RichText.H1`–`H4`,
  `RichText.Quote`, `RichText.HLine`, `RichText.BulletList`, `RichText.NumberedList`) are removed
  from every catalogue under `src/translation/`.

Verification level: `AnnotationEditor.test.tsx` (jsdom, the repo's vitest environment) mounts the
production `AnnotationEditor` inside a `TreeStateContext` store and asserts: the toolbar renders no
heading, quote, rule or list control and still renders bold, italic, underline, strike, clear,
link and unlink; per O1 case, a comment loaded from the store and edited once reaches the store
(through the component's own update path) as the input plus exactly that edit, and loading alone
writes nothing; typed block markers (`1. `, `# `, `> `, `- `) and backticks stay paragraph text in
the saved comment; `59. Olvidé…` loads as a paragraph, not a list; and remounting the editor
several times (node switches) leaves the registered tokenizer extensions of each editor's
instance constant. The O1 case list is defined once (test-only) and consumed by both the O1 and
the O2 tests, so reader and editor are proven against the same inputs.

### O3 — Comments stay in the move flow

Rests on: "because each comment ends the row, a game where nearly every move has a short comment
collapses to one half-move per line"; "Let short single-line comments stay inline in the move flow
instead of forcing a row break."

Required behaviour (`notationRows.ts`, the inline run builder — which builds every inline move
run: the inline view's mainline and variations, and the table view's variation runs, P15):

* A move's comment never closes the `moves` row. The run continues to the next move; rows still
  close on variations, on `NOTATION_ROW_MAX_MOVES`, and at the end of a line, exactly as today.
* A variation's starting comment no longer closes the run before its move nor becomes a `comment`
  row in an inline run: it travels with that move in the `moves` row (its prose only, commands
  stripped exactly as today by `splitPgnComment`) and is drawn in front of the move, inline, by the
  move cell; that move keeps `first: true` so its move number follows the comment.
* "Short" is not a length threshold: every comment is drawn in the flow, and the existing
  `Comment` line rule decides inline (`span`) versus block. A multi-line comment is a block inside
  the row and therefore starts and ends its own line without a row break.
* Table view: its variation runs follow the two rules above, because they are inline move runs
  drawn as flowing text (P15); its two-column mainline table rows keep their comment rows and
  starting-comment rows exactly as today (P5). A black move's variations are its siblings — the
  white move's other children — so they reach the inline builder whether or not the next white
  move has alternatives (P17), and no empty variation row is emitted.
* The root (game) comment row and the `rowForNode` / path contracts are unchanged. Move numbering
  after a comment is unchanged (a black move after a white move's comment still shows no `1...`;
  pre-`88ad35ef` behaviour).

Verification level: `notationRows.test.ts` — a mainline with a comment on every move yields one
`moves` row (for fewer than `NOTATION_ROW_MAX_MOVES` moves) in the inline view and the unchanged
per-comment rows in the table view; the existing inline starting-comment tests are rewritten to
the new contract (comment travels with the move, no `comment` row, `first: true`, commands
stripped, nothing when the comment is commands-only or comments are hidden); the table-view
starting-comment tests for mainline moves stay as they are, and a new table-view case puts a move
comment and a starting comment inside a variation and asserts one `moves` row with no `comment`
row for that variation; a table-view case `1. e4 e5 (1... c5) 2. Nf3` (no alternative to `Nf3`)
asserts that `c5` is in a variation run after the `e5` row, and a case where `Nf3` also has an
alternative asserts each variation appears exactly once after its own move with no empty
variation row. `CompleteMoveCell.test.tsx` — the starting comment renders before the move
and not when comments are hidden. `GameNotation.test.tsx` — with comments shown, the mounted
notation passes a variation's starting comment to that move's cell (the existing cell mock exposes
it), so a dropped forwarding goes red.

### O5 — Navigation keeps the current move visible in a tall row

Rests on: "Let short single-line comments stay inline in the move flow instead of forcing a row
break" — once comments no longer end rows, a row of up to `NOTATION_ROW_MAX_MOVES` commented moves
can be taller than the notation viewport, and centring the row (P16) would hide the current move.

Required behaviour (`GameNotation.tsx`): when the current move changes, the notation scrolls so that
the current move's own cell is inside the viewport, also when its row is taller than the viewport;
rows that fit keep today's centring. The fallback for a node without a row (P16's parent walk) and
the scroll to the top for an empty selection are unchanged.

Verification level: a Playwright container scenario (O4's game, extended with comments long enough
that one row is taller than the viewport) navigates to a move at the start and at the end of that
row and asserts the current move is in the viewport each time; jsdom has no layout, so no unit test
can prove this.

### O4 — Pixel proof of both effects

Rests on: "Pixels via `pnpm test:e2e:container`".

A new Playwright scenario in `e2e/files-preview.spec.ts` previews a game whose mainline carries the
MANDATE's comments (`6. Nf3 {62} h6 7. Be3 {59. Olvidé mi preparación. Tengo Ld3 en mi prep.} Bd6
8. Be2 {59}`, as lexer tokens like the existing scenarios). It asserts that the notation contains
no `ol`/`li`, that the text `59. Olvidé mi preparación.` is visible, and that `Nf3` and `h6` share
one line (equal bounding-box top), then records one new container snapshot. The O5 assertions run
in the same spec file. Existing snapshots must not move; if one does, it is a regression to fix,
not to re-record (P12).

Depends on O1, O3 and O5.

## Decisions and trade-offs

* PGN comments are not full Markdown (O1). Kept: inline formatting, because ChessFable's own
  editor has written it into users' PGNs and inline markers are rare in plain-text prose.
  Dropped: block constructs, because their markers (`12. `, `- `, `# `, `> `) are ordinary at the
  start of chess prose and every other PGN tool shows them as text.
* The editor is narrowed to the dialect (O2) instead of the reader special-casing editor output:
  a PGN comment carries no marker of who wrote it.
* Comments in every inline move run return to the pre-`88ad35ef` flow (O3); the table view's
  mainline keeps its rows. Tall rows are handled by scrolling to the move (O5), not by re-breaking
  rows on comment length.

## Decided autonomously

1. **Question:** are PGN comments Markdown at all? **Chosen:** an inline-only Markdown dialect;
   block constructs render as their source text, and code (inline and fenced) is not part of it —
   backticks are literal (P14: keeping inline code turns a fenced block into a lossy code span).
   **Rejected:** keeping inline code and adding a source-text fallback for fenced blocks in both
   parsers (a second preservation mechanism per parser for a construct with no chess use; the
   editor has no code control); plain text everywhere (removes the
   bold/italic/underline/strike/link formatting the editor has already written into users' files,
   and the editor itself); full Markdown with a special case for a leading `N. ` (leaves `- `,
   `# `, `> ` restyled — the same class); detecting editor-authored comments (PGN has no such
   marker). **Reason:** PGN comments are plain text for ChessBase, Lichess and every other tool;
   block markers are common at the start of chess prose, inline markers are not. **Reversal
   path:** re-enable constructs in the one disable list per parser (O1/O2).
2. **Question:** what happens to the editor's block controls? **Chosen:** removed, with their
   StarterKit nodes, and the editor parses with an inline-only `marked` instance. **Rejected:**
   keep the controls (the editor would author text the notation shows literally); disable the
   nodes only (P9: crash on `#`, marker lost on `>`); one module-level instance (P11: tiptap
   re-registers its tokenizers on every editor creation). **Reason:** one dialect on both sides,
   measured lossless (P10). Existing comments that contain a list or heading now display as their
   Markdown source text. **Reversal path:** restore the controls and nodes and drop the custom
   instance.
3. **Question:** which comments stay inline? **Chosen:** all of them in every inline move run; the
   existing `Comment` line rule decides inline versus block; starting comments too; a row taller
   than the viewport is handled by scrolling to the current move (O5). **Rejected:** a
   character-length threshold for "short" (panel-width dependent, absent before `88ad35ef`);
   keeping a row break after multi-line comments (a block comment already occupies its own line);
   re-breaking rows by accumulated comment length to keep them short (a heuristic that still
   leaves one long comment taller than a small viewport).
   **Reason:** restores the flow `88ad35ef` broke without a recorded reason (P4). **Reversal
   path:** the break condition in the inline builder.
4. **Question:** does the table view change? **Chosen:** its two-column mainline keeps its comment
   rows; its variation runs, which are inline move runs built by the same builder (P15), follow the
   inline flow. **Rejected:** comments inside table cells (a two-column move table has no move
   flow; table rows for comments predate `88ad35ef`, P5); a table-view flag that keeps the old
   breaks in variation runs (two behaviours for one kind of run). **Reason:** the MANDATE's flow is
   the move flow wherever moves flow as text.
5. **Question:** how does the editor get `marked`? **Chosen:** a direct dependency pinned to
   `17.0.3`, the version `@tiptap/markdown@3.20.0` resolves. **Rejected:** importing tiptap's
   transitive copy (not resolvable under pnpm's strict layout); mutating the global instance
   through `markedOptions` (keeps the P11 accumulation and affects every marked user).
   **Reason:** an isolated per-editor instance needs the `Marked` class.

## Risks / open questions

* tiptap-markdown internals (`registerTokenizer`, the `marked` option) are a dependency contract;
  the O2 test pins them so a tiptap bump that breaks them goes red.
* A user's existing editor-authored heading or list now reads as `# …` / `1. …`. Accepted under
  decision 2.
* Rows may grow taller in comment-heavy games; rows are measured dynamically (P6) and still capped
  at `NOTATION_ROW_MAX_MOVES` moves; navigation scrolls to the current move inside them (O5).

## Not part of this task

* Move-number display after a comment (`1. e4 {c} e5` vs `1... e5`).
* Table-view mainline layout of comments (decision 4).
* Editor display of a backslash escape (`1\.` shows the backslash in the editor; the notation shows
  `1.`): no character is lost either way (P14).
* Editor normalisations on edit listed in P10 (bare URL → link, HTML → Markdown, setext break).
* The comment format written by any other tool, PGN export, and the database storage of comments.

## Phases

Phases 1 and 2 are file-disjoint and independent; phase 3 depends on both. Each ends green and is
committed by the orchestrator.

### Phase 1 — Comment dialect (O1, O2)

* Files: `src/components/common/Comment.tsx`, `src/components/common/Comment.test.tsx`,
  `src/components/panels/annotation/AnnotationEditor.tsx`, a new
  `src/components/panels/annotation/AnnotationEditor.test.tsx`, the shared O1 case list (in a test
  file or test fixture; never a production module), `package.json`, `pnpm-lock.yaml`,
  `src/translation/*.json`.
* Touches: an npm dependency (Sensitive Path); no auth, persistence, concurrency or IPC.
* Role: `sensitive` (Sensitive-Path hit).
* Proof: `pnpm install --frozen-lockfile && pnpm vitest run src/components/common/Comment.test.tsx src/components/panels/annotation && pnpm lint:ci && pnpm i18n:check && pnpm checks:pre-review`.

### Phase 2 — Inline flow and navigation (O3, O5)

* Files: `src/components/common/notationRows.ts`, `src/components/common/notationRows.test.ts`,
  `src/components/common/CompleteMoveCell.tsx`, `src/components/common/CompleteMoveCell.test.tsx`,
  `src/components/common/GameNotation.tsx` (passes the starting comment to the cell; O5 scroll),
  `src/components/common/GameNotation.test.tsx`.
* Touches: no auth, persistence, concurrency or API contract; the row model is shared by every
  notation surface (P6).
* Role: `normal`.
* Proof: `pnpm vitest run src/components/common && pnpm lint:ci && pnpm checks:pre-review`.

### Phase 3 — Pixel and navigation proof (O4, O5)

* Files: `e2e/files-preview.spec.ts`, its new snapshot under `e2e/files-preview.spec.ts-snapshots/`.
* Role: `normal`.
* Proof: `pnpm test:e2e:container` first (every existing snapshot green; the new scenario fails
  only on its missing snapshot, its O4/O5 assertions green), then
  `pnpm test:e2e:update -- --grep "<new scenario title>"` (the runner drops pnpm's `--`,
  `scripts/run-e2e-container.mjs:45-59`), then `pnpm test:e2e:container` green; the commit message
  names the one new snapshot.

## Carried to diff review

* CR-1 (from I8, `lens-tests-r1` finding 2) — O1's `Comment.test.tsx` cases assert the retained
  formatting elements, not only text: `strong`, `em`, `del`, `u` and `a` with its `href`, including
  formatting inside block-looking prose (`59. **x**` renders `59. ` as text and `x` in `strong`).

## Reviews

### Round 1 — plan-r1 (12 lenses, every plan-capable lens)

Wall elapsed 354 s (first prompt 1791709851 → last report 1791710205); no waits. Verdicts:
REVISE — plan, correctness, tests; APPROVED — minimalism, error-handling (one should-fix),
chess-semantics; NOT APPLICABLE + APPROVED — engine-protocol, ipc-contract, persisted-state,
pgn-index, platform-semantics, tauri-security.

| ID | Claim | Witnesses (lens#finding) | Evidence checked by the arbiter | Disposition | Authority | Status |
| --- | --- | --- | --- | --- | --- | --- |
| I1 | Disabling fenced code but keeping inline code spans turns ```` ```\nx\n``` ```` into a lossy inline code span in reader and editor | correctness-r1#1, plan-r1#1 | probe `codefree.mjs keep-code`: reader `inlineCode="hello"`, editor writes `` `hello` `` (P14) | Fix — code leaves the dialect (O1, O2; decision 1) | MANDATE "at minimum disable the block constructs"; O1 literal-text contract | open → closure r2 |
| I2 | Reader drops leading spaces of `    indented`; "no character lost" contract not met, reader and editor inconsistent | correctness-r1#2, plan-r1#1 | probe `remark.mjs`: `paragraph(text="indented")`; editor keeps the spaces (P14) | Fix — O1 contract: no non-whitespace character lost; reader display-only under HTML collapsing; editor byte-exact | MANDATE Defect (1), plain-text comments | open → closure r2 |
| I3 | "Inline builder only" also changes table-view variation runs | plan-r1#2 | `notationRows.ts:151-160`, `:343`, `:359`, `:365`, `:370` (P15) | Fix — O3 states the table view's variation runs follow the flow; mainline table rows unchanged; new table-view test (decision 4) | MANDATE "Let short single-line comments stay inline in the move flow" | open → closure r2 |
| I4 | Tall rows: centring the row hides the current move | plan-r1#3 | `GameNotation.tsx:89-103` (P16) | Fix — new O5 (scroll to the current move's cell), proven in the container (phase 3) | MANDATE "Let short single-line comments stay inline…" (necessary correctness of O3) | open → closure r2 |
| I5 | No proof that `GameNotation` forwards the starting comment to the cell | plan-r1#4 | `GameNotation.tsx:300-316` `moveProps`; `GameNotation.test.tsx:34-40,59-75` hides comments and mocks the cell | Fix — O3 verification adds a `GameNotation.test.tsx` forwarding assertion | MANDATE (O3 verification) | open → closure r2 |
| I6 | Parser/serializer failure semantics undefined in O2 | error-handling-r1#1 | `AnnotationEditor.tsx:38-40`: the store is written only from `onUpdate` on a user edit, so a load can never overwrite a comment; the P9 throw class is removed because parser and schema now match, and O2's mounted test loads every case | Skip — no failure path the plan introduces; a new error surface for an unobserved failure is outside MANDATE (confidence 92, verdict APPROVED) | — | closed (Skip) |
| I7 | O2 tests bypass `AnnotationEditor` (toolbar, input rules, store write) | tests-r1#1 | `AnnotationEditor.tsx:93-105` controls, `:38-40` `setComment` path | Fix — O2 verification mounts the production component in a `TreeStateContext` store | MANDATE "the Annotate editor … output format must be checked" | open → closure r2 |
| I8 | O1 assertions do not prove retained inline formatting | tests-r1#2 | test-assertion detail inside unchanged O1 | Fix — carried to CR-1 | — | carried (CR-1) |

Round 1 adopted plan-level corrections: 6 (I1, I2, I3, I4, I5, I7); carried 1 (I8 → CR-1);
skipped 1 (I6). Unique issues opened 8; resolved 1 (Skip); carried 1; open 6.

#### lens-plan-r1 (raw)

```text
[blocker] tasks/plans/.plan-2026-10-11-comment-dialect-and-inline-flow.md-r1.body.md:124 — O1/O2’s parser mechanism does not preserve literal block text. Running the supplied `remark.mjs:9` and `tiptap3.mjs:11` mechanisms with `"```\nfenced text\n```"` produces an `inlineCode` node in the reader and ``"`fenced text`"`` from the editor. The fences and line breaks disappear, contrary to O1 and O2:152. The reader probe also drops all four spaces from `"    indented"`. Require a preservation mechanism and shared regression cases for both inputs (confidence: 100).

[blocker] tasks/plans/.plan-2026-10-11-comment-dialect-and-inline-flow.md-r1.body.md:177 — The “inline builder only” boundary does not preserve table view as promised at line 188. `notationRows.ts:159` routes variation rendering through `appendInlineTasks`, and table view calls that route at `notationRows.ts:343`, `:359`, `:365` and `:370`. Removing comment boundaries and starting-comment rows therefore changes table-view variations too. The retained table tests at `notationRows.test.ts:251` cover mainline moves, so they would miss this consumer. Specify how table-view variations retain their current behavior and prove that boundary (confidence: 100).

[blocker] tasks/plans/.plan-2026-10-11-comment-dialect-and-inline-flow.md-r1.body.md:185 — Combining multiline comments into tall rows breaks current-move visibility. `GameNotation.tsx:93` resolves navigation to a row, then `:99` centers the whole row rather than the selected move. The installed virtualizer’s center-offset probe returned visible coordinates `[384,576]` for a 960px row in a 192px viewport, hiding moves near either end. Multiline comments render as blocks at `Comment.tsx:56`, so this is reachable through ordinary annotated games. Dynamic measurement prevents overlapping rows, but does not reveal the selected move. O3 needs a navigation obligation and proof for rows taller than the viewport (confidence: 96).

[blocker] tasks/plans/.plan-2026-10-11-comment-dialect-and-inline-flow.md-r1.body.md:192 — The proofs do not verify that starting comments reach the notation through `GameNotation`. Row-model tests and direct cell tests can pass while `GameNotation.tsx:304` drops the new value. Existing integration tests hide comments at `GameNotation.test.tsx:39` and mock the cell without displaying comment props at `:68`. O4’s fixture contains only move comments. Require an integration assertion that fails when starting-comment forwarding is omitted (confidence: 98).

VERDICT: REVISE
```

#### lens-minimalism-r1 (raw)

```text
No bloat or duplication defects found.

Minimum-diff counterfactual: the new editor test verifies round-trip behavior, the shared case list serves both parser tests, and the single new snapshot supplies the mandated pixel proof. No proposed added file is demonstrably unnecessary.

VERDICT: APPROVED
```

#### lens-correctness-r1 (raw)

```text
[blocker] tasks/plans/.plan-2026-10-11-comment-dialect-and-inline-flow.md-r1.body.md:150 — Disabling block tokenizers leaves fenced backticks consumed by inline-code parsing. Using the supplied probes with `"```\nhello\n```"`, the reader produces `inlineCode="hello"` and the editor serializes `` `hello` ``. After an edit it writes `` `!hello` ``, losing the fences and newlines. O1 requires literal block syntax, and O2 requires preservation outside edited characters. This is not a P10 exception. (confidence: 100)

[blocker] tasks/plans/.plan-2026-10-11-comment-dialect-and-inline-flow.md-r1.body.md:124 — Parse-time disabling of indented code drops leading whitespace. The reader probe maps `"    indented"` to `paragraph(text="indented")`, while the editor preserves all four spaces. The proposed mechanisms therefore violate O1’s character-preservation guarantee and leave reader/editor behavior inconsistent. The plan needs a source-preservation contract for this case. (confidence: 100)

VERDICT: REVISE
```

#### lens-error-handling-r1 (raw)

```text
[should-fix] tasks/plans/.plan-2026-10-11-comment-dialect-and-inline-flow.md-r1.body.md:150 — O2 specifies successful round trips but leaves parser and serializer failure semantics undefined. Current editor creation, `setContent` and `getMarkdown` calls have no error handling. Specify that failure preserves the original comment, prevents replacement writes, and surfaces a distinguishable error. Include failure-path proof alongside the round-trip tests (confidence: 92).

VERDICT: APPROVED
```

#### lens-tests-r1 (raw)

```text
[blocker] tasks/plans/.plan-2026-10-11-comment-dialect-and-inline-flow.md-r1.body.md:164 — O2 tests construct an editor and serialize directly, without exercising AnnotationEditor’s toolbar, typing input rules, or saved store value. Restoring block controls or breaking `onUpdate → setComment` would leave these proofs green. O4 only visits the preview, so the container suite supplies no editor proof either. Add a mounted editor journey asserting block controls are absent, typed block markers remain text, and an edit saves the expected comment. (confidence: 97)

[should-fix] tasks/plans/.plan-2026-10-11-comment-dialect-and-inline-flow.md-r1.body.md:131 — Rendered-text and forbidden-block assertions do not prove retained inline formatting. Replacing strong, emphasis, strike, and links with unformatted text would preserve those assertions and the existing underline/code tests. Assert the formatting elements and link destinations, including formatting within literal block-looking prose. (confidence: 96)

VERDICT: REVISE
```

#### lens-chess-semantics-r1 (raw)

```text
No chess-domain invariant violations found in plan-r1. The proposed flow preserves node ownership, root-anchored move numbering, path reconstruction, and separately stored comment metadata.

VERDICT: APPROVED
```

#### lens-engine-protocol-r1 (raw)

```text
NOT APPLICABLE: The plan’s files and obligations cover comment parsing, editor formatting, notation layout and pixel verification. They do not change engine process supervision, UCI protocol state or asynchronous engine result routing.
VERDICT: APPROVED
```

#### lens-ipc-contract-r1 (raw)

```text
NOT APPLICABLE: O1–O4 cover renderer comment parsing, editor formatting, notation layout and pixel verification. No Rust commands, events, IPC payloads, subscriptions or capability scopes are changed.
VERDICT: APPROVED
```

#### lens-persisted-state-r1 (raw)

```text
NOT APPLICABLE: The plan’s files and obligations change comment parsing, editor formatting and notation layout. They do not change renderer storage encoding, keys, atom families, hydration or tab lifecycle.

VERDICT: APPROVED
```

#### lens-pgn-index-r1 (raw)

```text
NOT APPLICABLE: O1–O4 change comment rendering, editor Markdown parsing, notation layout and pixel tests. They do not change PGN byte scanning, offsets, move encoding, database storage, search or disk export.

VERDICT: APPROVED
```

#### lens-platform-semantics-r1 (raw)

```text
NOT APPLICABLE: O1–O4 change JavaScript comment parsing, editor configuration and notation layout. They introduce no OS-specific paths, handles, filesystem operations, FFI or target branches. Container pixels do not claim macOS or Windows runtime proof.
VERDICT: APPROVED
```

#### lens-tauri-security-r1 (raw)

```text
NOT APPLICABLE: The plan’s files and O1–O4 obligations cover renderer comment parsing, editor formatting, notation layout and pixel tests. They introduce no credentials, session persistence, native filesystem authority or mutation, signed downloads, or backend diagnostic flows.

VERDICT: APPROVED
```

### Round 2 — plan-r2 (closure round: plan, correctness, tests; newly affected: minimalism, chess-semantics)

Wall elapsed 213 s (first prompt 1791710525 → last report 1791710738); no waits. Verdicts:
APPROVED — plan, tests, minimalism, chess-semantics; REVISE — correctness (one new blocker).

| ID | Closure result r2 |
| --- | --- |
| I1 | CLOSED — correctness-r2, plan-r2 (both re-ran `codefree.mjs` with and without `keep-code`) |
| I2 | CLOSED — correctness-r2, plan-r2 |
| I3 | CLOSED — plan-r2 |
| I4 | CLOSED — plan-r2 |
| I5 | CLOSED — plan-r2 |
| I7 | CLOSED — plan-r2, tests-r2 |

New issue:

| ID | Claim | Witnesses (lens#finding) | Evidence checked by the arbiter | Disposition | Authority | Status |
| --- | --- | --- | --- | --- | --- | --- |
| I9 | Table view reads a black move's alternatives from the black move's own children, so `1. e4 e5 (1... c5) 2. Nf3` never shows `c5` (and its comments) unless `Nf3` has alternatives, in which case an empty variation row is emitted | correctness-r2#1 | read `notationRows.ts:348-370` (`blackVariations = black.children.slice(1)` vs rows built from `child`), `:333`/`:340` for the correct black-only branch; the existing table test `notationRows.test.ts:112-126` cannot see it; introduced by `88ad35ef` (P17) | Fix — O3 table-view bullet: a black move's variations are the white move's other children; two new table-view tests | Same-area defect in the O3 builder (rule 4b; plan-only "same-area findings become plan obligations"); O3's table-variation flow clause (I3) depends on it | open → closure r3 |

Lineage: I9 is a newly found pre-existing defect (not correction-introduced); it surfaced because I3
extended O3 to table-view variation runs. Round 2 adopted plan-level corrections: 1 (I9). Unique
issues opened 9 cumulative; resolved 7 (I1–I5, I7 closed, I6 Skip); carried 1 (I8 → CR-1);
open 1 (I9).

#### lens-plan-r2 (raw)

```text
I1 CLOSED — plan-r2 O1/O2 disable inline code as well as code blocks. Both `codefree.mjs` runs confirm the correction preserves fences and backticks, while `keep-code` reproduces the loss (confidence: 100).

I2 CLOSED — `tasks/plans/.plan-2026-10-11-comment-dialect-and-inline-flow.md-r2.body.md:141` distinguishes display whitespace from editor preservation. The probe confirms indented text survives and the editor retains its spaces (confidence: 100).

I3 CLOSED — plan-r2:203 covers table-view variation runs and requires their regression test at :227. This matches `src/components/common/notationRows.ts:160`, :343, :359, :365 and :370 (confidence: 100).

I4 CLOSED — plan-r2:240 requires visibility of the move’s own cell and layout proof at :245, addressing row-centering at `src/components/common/GameNotation.tsx:99` (confidence: 96).

I5 CLOSED — plan-r2:230 requires a mounted forwarding assertion through `GameNotation`, covering the boundary at `src/components/common/GameNotation.tsx:304` that the existing mock at `GameNotation.test.tsx:68` does not expose (confidence: 99).

I7 CLOSED — plan-r2:186 requires the production editor, toolbar, typing rules and store-write journey, covering `src/components/panels/annotation/AnnotationEditor.tsx:24`, :40 and :93 (confidence: 99).

VERDICT: APPROVED
```

#### lens-correctness-r2 (raw)

```text
I1 CLOSED — O1/O2 disable inline code too. Both `codefree.mjs` runs confirm that disabling it preserves fenced text and editor round trips, while `keep-code` collapses the fences.

I2 CLOSED — O1 explicitly permits display-only whitespace collapsing. O2 retains byte-exact editor whitespace, confirmed for `    indented` by the probe.

[blocker] src/components/common/notationRows.ts:349 — O3’s expanded table-variation contract leaves a caller/builder mismatch unresolved. For `1. e4 e5 ({before} 1... c5 {after}) 2. Nf3`, `blackVariations` reads `e5.children.slice(1)` instead of `e4.children.slice(1)`. With no alternative to `Nf3`, the predicate is false, so `c5` and both comments never reach the inline builder. Correct the producer’s predicate while preserving mainline table rows. (confidence: 100)

VERDICT: REVISE
```

#### lens-tests-r2 (raw)

```text
I7 CLOSED — O2 now mounts production `AnnotationEditor` in `TreeStateContext` and asserts toolbar controls, typed markers, load-without-write, and the saved store value after an edit. Restoring block controls or breaking `onUpdate → setComment` would fail these assertions.

VERDICT: APPROVED
```

#### lens-minimalism-r2 (raw)

```text
VERDICT: APPROVED
```

#### lens-chess-semantics-r2 (raw)

```text
VERDICT: APPROVED
```

### plan-r4.md

# Plan: PGN comments render as plain text with inline formatting, and stay in the move flow

Plan path: `tasks/plans/2026-10-11-comment-dialect-and-inline-flow.md` · Finding: `f-20261001-10` ·
Base: `8b3e94cbdfa1b3c1638ba73c31d46f8bbd1b821e` · Mode: PLAN-ONLY (drain planner, `full auto`).

## Goal

A ChessBase-style PGN comment such as `{59. Olvidé mi preparación.}` reads as the text it is, and a
game where nearly every move carries a short comment (`{62}`, `{59}`) reads as a flowing line of
moves, not one half-move per line — in the analysis tab and in every preview that mounts
`GameNotation`. The Annotate editor writes exactly the comment format the notation reads.

## MANDATE

Verbatim from `tasks/findings.md`, `f-20261001-10`:

* **Where:** `src/components/common/Comment.tsx` (comment text goes through `react-markdown` + `remark-gfm`; a comment with several non-empty lines switches to `display: block`), `src/components/common/notationRows.ts` (~339-383: every move comment is emitted as its own `comment` row via `addComment`, which closes the current move row).
* **Defect:** in Felix's game Beck–Riewe (Elo Vierer Caissa Center, 2026.08.09, `~/Documents/Sport/Schach/ChessFable/Eigene Partien/Meine Partien.pgn` line 2178) almost every move carries a comment with the remaining clock minutes (`6. Nf3 {62} h6 7. Be3 {59. Olvidé mi preparación. Tengo Ld3 en mi prep.} Bd6 8. Be2 {59}`). Two effects, both visible in the database preview and the analysis tab: (1) the comment `59. Olvidé…` starts with "number + period + space", which Markdown parses as an ordered list starting at 59, rendering a block-level list with margins and an empty gap; ChessBase/PGN comments are plain text, so any comment opening with `12. `, `- `, `# ` or `> ` is restyled; (2) because each comment ends the row, a game where nearly every move has a short comment collapses to one half-move per line and wastes most of the panel width.
* **Fix shape:** decide whether PGN comments are Markdown at all (they are written by ChessBase and other tools as plain text; the Annotate editor is a rich-text editor whose output format must be checked before changing the reader); at minimum disable the block constructs (lists, headings, blockquotes) for comment rendering. Let short single-line comments stay inline in the move flow instead of forcing a row break. Pixels via `pnpm test:e2e:container`.
* **Open question:** are PGN comments Markdown at all, given what the Annotate editor writes back, and which comments may stay inline in the move flow instead of ending the row.
* **Why `build`:** the Markdown question interacts with the Annotate editor's write format (round-trip), and the row model change touches `notationRows.ts` shared by every notation view.

## Threat model and non-goals

* **Input is accidental, not adversarial.** Comment text comes from PGN files written by ChessBase,
  Lichess, other GUIs and ChessFable's own Annotate editor, and from imported databases. No
  attacker model beyond the one already pinned: raw HTML in a comment is shown as text and never
  executed (`src/components/common/Comment.test.tsx:25`); that guarantee is kept unchanged.
* **Environments:** the renderer on Linux, macOS and Windows (WebKitGTK / WebKit / WebView2) and
  the pinned Playwright Chromium image for pixels. No Rust, IPC, persistence or capability change.
* Frozen with the MANDATE.

## Traced premises

Locate evidence, frozen. Probe scripts and their full output are in the run directory
(`$RUN_TMP/probe/`); the observed results are quoted here.

* P1 — Reader: `src/components/common/Comment.tsx:48-71` renders every comment through
  `react-markdown` with `remarkGfm` and a local `remarkUnderline` plugin; `multipleLine` (more than
  one non-empty line) switches the wrapper to `display: block` and paragraphs to `<p>`, otherwise
  `<span>`.
* P2 — Editor: `src/components/panels/annotation/AnnotationEditor.tsx:24-44` uses tiptap
  `StarterKit` + `@tiptap/markdown` (`contentType: "markdown"`, `setComment(editor.getMarkdown())`
  on every user update) and offers H1–H4, blockquote, horizontal rule, bullet list and ordered list
  controls (`:93-105`). Comments written by ChessFable are therefore Markdown, including block
  constructs.
* P3 — The inline row model breaks the run after every commented move:
  `src/components/common/notationRows.ts:224-237` (`hasComment || hasVariations || reachedLimit`
  closes the `moves` row). In the inline view the comment itself is not a row — it is drawn inside
  the move cell (`src/components/common/CompleteMoveCell.tsx:174`); only the break is the row
  model's. A variation's starting comment additionally closes the run *before* its move and becomes
  its own `comment` row (`notationRows.ts:205-219`).
* P4 — The break after a commented move is a regression of `88ad35ef` (2026-09-23, virtualized
  notation, `d-20260923-01`): before it, `RenderVariationTree` (`git show 88ad35ef^:src/components/common/GameNotation.tsx:195-264`)
  drew the mainline as one flow with single-line comments inline (`cb12c03d` "Put single line
  comments inline"). `d-20260923-01` records no reason for the break.
* P5 — Table view emitted comments as their own table rows before `88ad35ef` too
  (`88ad35ef^:GameNotation.tsx:313-440`) and still does (`notationRows.ts:321-375`).
* P6 — Every notation surface goes through one component: `BoardAnalysis.tsx:294`,
  `BoardGame.tsx:1430`, `databases/GamePreview.tsx:112`, `puzzles/Puzzles.tsx:881` mount
  `GameNotation`; the inline view is the default (`src/state/atoms.ts:286`, `tableViewAtom`
  defaults to `false`). Rows are measured dynamically (`GameNotation.tsx:82-84,157`,
  `measureElement`), so a row's height is not fixed.
* P7 — Measured, micromark construct disabling (`$RUN_TMP/probe/remark.mjs`, unified 11 /
  remark-parse 11 / remark-gfm 4.0.0 / micromark 4.0.0): a remark plugin pushing
  `{disable: {null: ["blockQuote","codeFenced","codeIndented","headingAtx","htmlFlow","list","setextUnderline","thematicBreak","definition"]}}`
  into `micromarkExtensions` turns `59. Olvidé mi preparación.`, `- a dash`, `# not heading`,
  `> quote`, `---`, `a\n---` and `[a]: https://x` into one paragraph holding the source text, and
  keeps `**bold** *it* ~~s~~ https://lichess.org [l](https://x.y)` as strong/emphasis/delete/link.
  Two GFM constructs are anonymous and cannot be disabled by name: a GFM table still parses as
  `table` and `[^1]: foot` still as `footnoteDefinition`
  (`micromark-extension-gfm-table@2.0.0/lib/syntax.js:36-44`, `micromark-extension-gfm-footnote@2.0.0/lib/syntax.js:35-46`).
  `    indented` becomes a paragraph `indented` (leading spaces dropped by paragraph parsing).
* P8 — Measured, today's editor round trip (`$RUN_TMP/probe/tiptap.mjs`, tiptap 3.20.0, marked
  17.0.3): loading `59. Olvidé…` yields an `orderedList`; a paragraph typed as `59. typed text`
  serializes unescaped as `59. typed text`, so it re-reads as a list; `1\. escaped` loads as
  `1 escaped` and is written back without the `.` (data loss on the next edit).
* P9 — Measured, disabling the StarterKit block nodes alone is unsafe: with heading, blockquote,
  horizontalRule, bulletList, orderedList, listItem, listKeymap and codeBlock off but the default
  parser, `# not heading` throws `RangeError: Unknown node type: heading` on load and `> quote`
  loads as `quote` (the marker is lost).
* P10 — Measured, a dedicated `marked` instance (`new Marked({tokenizer: {...}})` from `marked`
  17.0.3, the copy `@tiptap/markdown` resolves, `pnpm-lock.yaml:5960`) whose `heading`, `lheading`,
  `blockquote`, `hr`, `list`, `code`, `fences`, `html`, `def` and `table` tokenizers return
  `undefined`, passed as `Markdown.configure({ marked })` together with those StarterKit nodes off,
  loads and serializes `59. Olvidé…`, `- a dash`, `# not heading`, `> quote`, `---`,
  `    indented`, a GFM table, `**bold** and ++u++ ~~s~~`, `a\n\nb`, `a\nb` and `plain *star text`
  byte-identically, and an edit changes only the edited characters. An `escape` tokenizer returning
  a `text` token with the raw `\.` keeps `1\. escaped` byte-identical as well.
  Normalisations that remain on an edit (not losses): a bare URL becomes `[url](url)`, `<b>x</b>`
  becomes `**x**`, `a\n---` becomes `a\n\n---`.
* P11 — Measured, `@tiptap/markdown` registers its tokenizers on the marked instance at every
  editor creation (`@tiptap/markdown/dist/index.js:186-234`, `markedInstance.use`), and without a
  `marked` option that instance is the global `marked` singleton (`:110`). The editor is recreated
  on every move change (`AnnotationEditor.tsx:43`, deps `[position.join(",")]`). Probe
  `$RUN_TMP/probe/growth.mjs`: the global instance held 1, 11 and 61 inline and block extensions
  after 1, 11 and 61 editor creations — unbounded growth today.
* P12 — Pixels: the only e2e scenario with comment text is `e2e/files-preview.spec.ts:67-121`
  (a root comment, which stays a row). No e2e spec shows the Annotate panel. Container snapshots
  are re-recorded only through `pnpm test:e2e:update` under `d-20260919-13`
  (`.claude/skills/verify-ui/SKILL.md:40-53`).
* P13 — Gates: `Comment.tsx`, `CompleteMoveCell.tsx`, `GameNotation.tsx`, `notationRows.ts` and
  `src/components/panels/annotation/**` are measured in the `boards-game-analysis` coverage area
  (`coverage-areas.json:51-84`); none is in a frontend mutation package
  (`scripts/frontend-mutation-packages.mjs`). `package.json` and `pnpm-lock.yaml` are
  Sensitive-Path globs (`.claude/skills/push/SKILL.md:293-325`). Translation catalogues have no
  unused-key check (`scripts/i18n-completeness.mjs`).
* P14 — Added in round 1 from review evidence (`lens-correctness-r1`, `lens-plan-r1`), measured
  (`$RUN_TMP/probe/codefree.mjs`): with fenced code disabled but inline code spans kept, the
  reader parses ```` ```\nhello\n``` ```` as `inlineCode="hello"` and the editor writes it back as
  `` `hello` `` (fences and line breaks lost). With inline code spans disabled as well (reader
  `codeText`, editor `codespan` tokenizer and StarterKit `code` mark), both keep it as literal
  text, and the editor round trip of every probe case is byte-identical. The reader drops the
  leading spaces of `    indented` (paragraph parsing); the editor keeps them.
* P15 — Added in round 1 (`lens-plan-r1`), read: the table view builds its variation runs through
  the same inline builder (`notationRows.ts:151-160` `addInlineVariationRows` →
  `appendInlineTasks`, called from the table builder at `:343`, `:359`, `:365`, `:370`).
* P16 — Added in round 1 (`lens-plan-r1`), read: navigation scrolls the current move's *row* to
  the centre of the viewport (`GameNotation.tsx:89-103`, `scrollToIndex(rowIndex, { align:
  "center" })`); a row taller than the viewport therefore centres its middle, not the move.
* P17 — Added in round 2 (`lens-correctness-r2`), read: in the table view's white-move branch the
  black move's alternatives are read as `black.children.slice(1)` (`notationRows.ts:349`) — the
  alternatives to the *next* white move — while the rows are built from the white move
  (`addInlineVariationRows(…, child, …)`, `:365`, `:370`). For `1. e4 e5 (1... c5) 2. Nf3` with no
  alternative to `Nf3`, `c5` and its comments never reach the builder; when `Nf3` does have an
  alternative, an empty variation row for `e4`'s single child is emitted instead. The `!isWhite`
  branch reads `current.children.slice(1)` correctly (`:333`, `:340`). Introduced by `88ad35ef`; the
  existing table test (`notationRows.test.ts:112-126`) only checks that some variation row exists.

## Approach

### O1 — One comment dialect: inline Markdown, block syntax is literal text

Rests on: "decide whether PGN comments are Markdown at all", "at minimum disable the block
constructs (lists, headings, blockquotes) for comment rendering", "ChessBase/PGN comments are plain
text, so any comment opening with `12. `, `- `, `# ` or `> ` is restyled".

A comment is read as: paragraphs (blank-line separated) and soft line breaks; inline emphasis,
strong, `++underline++`, strikethrough, links and autolink literals. Every block construct is shown
as the source text that wrote it: ordered and bullet lists, ATX and setext headings, blockquotes,
thematic breaks, indented and fenced code blocks, HTML blocks, link reference definitions, GFM
tables, GFM footnote definitions (and a footnote reference therefore stays literal text too).
Code is not part of the dialect at all: backticks are literal text, inline and fenced alike (P14;
a fenced block would otherwise collapse into an inline code span and lose its fences and line
breaks). Raw HTML stays text, never markup (existing guarantee).

Required behaviour, reader (`Comment.tsx`): the named constructs, including inline code spans, are
disabled at parse time, and the two anonymous GFM constructs (P7) are replaced by their own source
text, so no non-whitespace character of the comment disappears and no block or code element
(`ol`, `ul`, `li`, `h1`–`h6`, `blockquote`, `hr`, `pre`, `code`, `table`, footnote section) is ever
rendered. The reader is display-only: whitespace renders under normal HTML whitespace collapsing
(leading spaces of a line are not shown, as for any comment text today); the editor, which writes,
keeps whitespace byte-exact (O2). Inline formatting inside text that would have been a block
construct still renders (for named constructs it is ordinary paragraph text). The `multipleLine`
inline/block rule is unchanged.

Verification level: unit tests in `Comment.test.tsx` covering at least `59. Olvidé mi
preparación.`, `- a`, `# a`, `> a`, `---`, `a\n---`, `    indented`, a fenced block, `` `x` ``, a
GFM table, `[^1]: x` with a `[^1]` call, and `**b** ++u++ ~~s~~ [l](https://x.y)
https://lichess.org`; each asserts the rendered text (non-whitespace characters, in order) and the
absence of every block and code element listed above. The existing raw-HTML test stays green; the
existing inline-code underline test is replaced by one asserting that backticks are literal and
that `++x++` between backticks is underlined like any other text.

### O2 — The Annotate editor reads and writes the same dialect, without loss

Rests on: "the Annotate editor is a rich-text editor whose output format must be checked before
changing the reader"; "Why `build`: the Markdown question interacts with the Annotate editor's
write format (round-trip)".

Required behaviour (`AnnotationEditor.tsx`):

* The editor cannot author a block construct: the H1–H4, blockquote, horizontal-rule, bullet-list
  and ordered-list toolbar controls are removed, and the matching StarterKit nodes (heading,
  blockquote, horizontalRule, bulletList, orderedList, listItem, listKeymap, codeBlock) and the
  inline `code` mark are disabled, so their input rules and shortcuts (`# `, `1. `, `> `, `---`,
  fences, backticks) no longer fire. Bold, italic, underline, strike, clear-formatting, link and
  unlink stay.
* Its Markdown parser is a dedicated `marked` instance with the block tokenizers and the inline
  code-span tokenizer off and backslash escapes kept as literal text (P10, P14). A comment loaded
  into the editor and saved after an edit is
  byte-identical outside the edited characters for every O1 case except the P10 normalisations,
  which are named known limits.
* The instance is created per editor (inside the `useEditor` configuration), never shared at
  module level or left on the global `marked`, so tiptap's per-creation tokenizer registration
  (P11) no longer accumulates: the number of registered extensions on an editor's instance does not
  grow with the number of editors created.
* `marked` becomes a direct dependency at the exact version `@tiptap/markdown` already resolves
  (`17.0.3`), so the lockfile keeps one `marked` copy.
* Locale keys that no source references any more after the toolbar change (`RichText.H1`–`H4`,
  `RichText.Quote`, `RichText.HLine`, `RichText.BulletList`, `RichText.NumberedList`) are removed
  from every catalogue under `src/translation/`.

Verification level: `AnnotationEditor.test.tsx` (jsdom, the repo's vitest environment) mounts the
production `AnnotationEditor` inside a `TreeStateContext` store and asserts: the toolbar renders no
heading, quote, rule or list control and still renders bold, italic, underline, strike, clear,
link and unlink; per O1 case, a comment loaded from the store and edited once reaches the store
(through the component's own update path) as the input plus exactly that edit, and loading alone
writes nothing; typed block markers (`1. `, `# `, `> `, `- `) and backticks stay paragraph text in
the saved comment; `59. Olvidé…` loads as a paragraph, not a list; and remounting the editor
several times (node switches) leaves the registered tokenizer extensions of each editor's
instance constant. The O1 case list is defined once (test-only) and consumed by both the O1 and
the O2 tests, so reader and editor are proven against the same inputs.

### O3 — Comments stay in the move flow

Rests on: "because each comment ends the row, a game where nearly every move has a short comment
collapses to one half-move per line"; "Let short single-line comments stay inline in the move flow
instead of forcing a row break."

Required behaviour (`notationRows.ts`, the inline run builder — which builds every inline move
run: the inline view's mainline and variations, and the table view's variation runs, P15):

* A move's comment never closes the `moves` row. The run continues to the next move; rows still
  close on variations, on `NOTATION_ROW_MAX_MOVES`, and at the end of a line, exactly as today.
* A variation's starting comment no longer closes the run before its move nor becomes a `comment`
  row in an inline run: it travels with that move in the `moves` row (its prose only, commands
  stripped exactly as today by `splitPgnComment`) and is drawn in front of the move, inline, by the
  move cell; that move keeps `first: true` so its move number follows the comment.
* "Short" is not a length threshold: every comment is drawn in the flow, and the existing
  `Comment` line rule decides inline (`span`) versus block. A multi-line comment is a block inside
  the row and therefore starts and ends its own line without a row break.
* Table view: its variation runs follow the two rules above, because they are inline move runs
  drawn as flowing text (P15); its two-column mainline table rows keep their comment rows and
  starting-comment rows exactly as today (P5). A black move's variations are its siblings — the
  white move's other children — so they reach the inline builder whether or not the next white
  move has alternatives (P17), and no empty variation row is emitted.
* The root (game) comment row and the `rowForNode` / path contracts are unchanged. Move numbering
  after a comment is unchanged (a black move after a white move's comment still shows no `1...`;
  pre-`88ad35ef` behaviour).

Verification level: `notationRows.test.ts` — a mainline with a comment on every move yields one
`moves` row (for fewer than `NOTATION_ROW_MAX_MOVES` moves) in the inline view and the unchanged
per-comment rows in the table view; the existing inline starting-comment tests are rewritten to
the new contract (comment travels with the move, no `comment` row, `first: true`, commands
stripped, nothing when the comment is commands-only or comments are hidden); the table-view
starting-comment tests for mainline moves stay as they are, and a new table-view case puts a move
comment and a starting comment inside a variation and asserts one `moves` row with no `comment`
row for that variation; a table-view case `1. e4 e5 (1... c5) 2. Nf3` (no alternative to `Nf3`)
asserts that `c5` is in a variation run after the `e5` row, and a case where `Nf3` also has an
alternative asserts each variation appears exactly once after its own move with no empty
variation row. `CompleteMoveCell.test.tsx` — the starting comment renders before the move
and not when comments are hidden. `GameNotation.test.tsx` — with comments shown, the mounted
notation passes a variation's starting comment to that move's cell (the existing cell mock exposes
it), so a dropped forwarding goes red.

### O5 — Navigation keeps the current move visible in a tall row

Rests on: "Let short single-line comments stay inline in the move flow instead of forcing a row
break" — once comments no longer end rows, a row of up to `NOTATION_ROW_MAX_MOVES` commented moves
can be taller than the notation viewport, and centring the row (P16) would hide the current move.

Required behaviour (`GameNotation.tsx`): when the current move changes, the notation scrolls so that
the current move's own cell is inside the viewport, also when its row is taller than the viewport;
rows that fit keep today's centring. The fallback for a node without a row (P16's parent walk) and
the scroll to the top for an empty selection are unchanged.

Verification level: a Playwright container scenario (O4's game, extended with comments long enough
that one row is taller than the viewport) navigates to a move at the start and at the end of that
row and asserts the current move is in the viewport each time; jsdom has no layout, so no unit test
can prove this.

### O4 — Pixel proof of both effects

Rests on: "Pixels via `pnpm test:e2e:container`".

A new Playwright scenario in `e2e/files-preview.spec.ts` previews a game whose mainline carries the
MANDATE's comments (`6. Nf3 {62} h6 7. Be3 {59. Olvidé mi preparación. Tengo Ld3 en mi prep.} Bd6
8. Be2 {59}`, as lexer tokens like the existing scenarios). It asserts that the notation contains
no `ol`/`li`, that the text `59. Olvidé mi preparación.` is visible, and that `Nf3` and `h6` share
one line (equal bounding-box top), then records one new container snapshot. The O5 assertions run
in the same spec file. Existing snapshots must not move; if one does, it is a regression to fix,
not to re-record (P12).

Depends on O1, O3 and O5.

## Decisions and trade-offs

* PGN comments are not full Markdown (O1). Kept: inline formatting, because ChessFable's own
  editor has written it into users' PGNs and inline markers are rare in plain-text prose.
  Dropped: block constructs, because their markers (`12. `, `- `, `# `, `> `) are ordinary at the
  start of chess prose and every other PGN tool shows them as text.
* The editor is narrowed to the dialect (O2) instead of the reader special-casing editor output:
  a PGN comment carries no marker of who wrote it.
* Comments in every inline move run return to the pre-`88ad35ef` flow (O3); the table view's
  mainline keeps its rows. Tall rows are handled by scrolling to the move (O5), not by re-breaking
  rows on comment length.

## Decided autonomously

1. **Question:** are PGN comments Markdown at all? **Chosen:** an inline-only Markdown dialect;
   block constructs render as their source text, and code (inline and fenced) is not part of it —
   backticks are literal (P14: keeping inline code turns a fenced block into a lossy code span).
   **Rejected:** keeping inline code and adding a source-text fallback for fenced blocks in both
   parsers (a second preservation mechanism per parser for a construct with no chess use; the
   editor has no code control); plain text everywhere (removes the
   bold/italic/underline/strike/link formatting the editor has already written into users' files,
   and the editor itself); full Markdown with a special case for a leading `N. ` (leaves `- `,
   `# `, `> ` restyled — the same class); detecting editor-authored comments (PGN has no such
   marker). **Reason:** PGN comments are plain text for ChessBase, Lichess and every other tool;
   block markers are common at the start of chess prose, inline markers are not. **Reversal
   path:** re-enable constructs in the one disable list per parser (O1/O2).
2. **Question:** what happens to the editor's block controls? **Chosen:** removed, with their
   StarterKit nodes, and the editor parses with an inline-only `marked` instance. **Rejected:**
   keep the controls (the editor would author text the notation shows literally); disable the
   nodes only (P9: crash on `#`, marker lost on `>`); one module-level instance (P11: tiptap
   re-registers its tokenizers on every editor creation). **Reason:** one dialect on both sides,
   measured lossless (P10). Existing comments that contain a list or heading now display as their
   Markdown source text. **Reversal path:** restore the controls and nodes and drop the custom
   instance.
3. **Question:** which comments stay inline? **Chosen:** all of them in every inline move run; the
   existing `Comment` line rule decides inline versus block; starting comments too; a row taller
   than the viewport is handled by scrolling to the current move (O5). **Rejected:** a
   character-length threshold for "short" (panel-width dependent, absent before `88ad35ef`);
   keeping a row break after multi-line comments (a block comment already occupies its own line);
   re-breaking rows by accumulated comment length to keep them short (a heuristic that still
   leaves one long comment taller than a small viewport).
   **Reason:** restores the flow `88ad35ef` broke without a recorded reason (P4). **Reversal
   path:** the break condition in the inline builder.
4. **Question:** does the table view change? **Chosen:** its two-column mainline keeps its comment
   rows; its variation runs, which are inline move runs built by the same builder (P15), follow the
   inline flow. **Rejected:** comments inside table cells (a two-column move table has no move
   flow; table rows for comments predate `88ad35ef`, P5); a table-view flag that keeps the old
   breaks in variation runs (two behaviours for one kind of run). **Reason:** the MANDATE's flow is
   the move flow wherever moves flow as text.
5. **Question:** how does the editor get `marked`? **Chosen:** a direct dependency pinned to
   `17.0.3`, the version `@tiptap/markdown@3.20.0` resolves. **Rejected:** importing tiptap's
   transitive copy (not resolvable under pnpm's strict layout); mutating the global instance
   through `markedOptions` (keeps the P11 accumulation and affects every marked user).
   **Reason:** an isolated per-editor instance needs the `Marked` class.

## Risks / open questions

* tiptap-markdown internals (`registerTokenizer`, the `marked` option) are a dependency contract;
  the O2 test pins them so a tiptap bump that breaks them goes red.
* A user's existing editor-authored heading or list now reads as `# …` / `1. …`. Accepted under
  decision 2.
* Rows may grow taller in comment-heavy games; rows are measured dynamically (P6) and still capped
  at `NOTATION_ROW_MAX_MOVES` moves; navigation scrolls to the current move inside them (O5).

## Not part of this task

* Move-number display after a comment (`1. e4 {c} e5` vs `1... e5`).
* Table-view mainline layout of comments (decision 4).
* Editor display of a backslash escape (`1\.` shows the backslash in the editor; the notation shows
  `1.`): no character is lost either way (P14).
* Editor normalisations on edit listed in P10 (bare URL → link, HTML → Markdown, setext break).
* The comment format written by any other tool, PGN export, and the database storage of comments.

## Phases

Phases 1 and 2 are file-disjoint and independent; phase 3 depends on both. Each ends green and is
committed by the orchestrator.

### Phase 1 — Comment dialect (O1, O2)

* Files: `src/components/common/Comment.tsx`, `src/components/common/Comment.test.tsx`,
  `src/components/panels/annotation/AnnotationEditor.tsx`, a new
  `src/components/panels/annotation/AnnotationEditor.test.tsx`, the shared O1 case list (in a test
  file or test fixture; never a production module), `package.json`, `pnpm-lock.yaml`,
  `src/translation/*.json`.
* Touches: an npm dependency (Sensitive Path); no auth, persistence, concurrency or IPC.
* Role: `sensitive` (Sensitive-Path hit).
* Proof: `pnpm install --frozen-lockfile && pnpm vitest run src/components/common/Comment.test.tsx src/components/panels/annotation && pnpm lint:ci && pnpm i18n:check && pnpm checks:pre-review`.

### Phase 2 — Inline flow and navigation (O3, O5)

* Files: `src/components/common/notationRows.ts`, `src/components/common/notationRows.test.ts`,
  `src/components/common/CompleteMoveCell.tsx`, `src/components/common/CompleteMoveCell.test.tsx`,
  `src/components/common/GameNotation.tsx` (passes the starting comment to the cell; O5 scroll),
  `src/components/common/GameNotation.test.tsx`.
* Touches: no auth, persistence, concurrency or API contract; the row model is shared by every
  notation surface (P6).
* Role: `normal`.
* Proof: `pnpm vitest run src/components/common && pnpm lint:ci && pnpm checks:pre-review`.

### Phase 3 — Pixel and navigation proof (O4, O5)

* Files: `e2e/files-preview.spec.ts`, its new snapshot under `e2e/files-preview.spec.ts-snapshots/`.
* Role: `normal`.
* Proof: `pnpm test:e2e:container` first (every existing snapshot green; the new scenario fails
  only on its missing snapshot, its O4/O5 assertions green), then
  `pnpm test:e2e:update -- --grep "<new scenario title>"` (the runner drops pnpm's `--`,
  `scripts/run-e2e-container.mjs:45-59`), then `pnpm test:e2e:container` green; the commit message
  names the one new snapshot.

## Carried to diff review

* CR-1 (from I8, `lens-tests-r1` finding 2) — O1's `Comment.test.tsx` cases assert the retained
  formatting elements, not only text: `strong`, `em`, `del`, `u` and `a` with its `href`, including
  formatting inside block-looking prose (`59. **x**` renders `59. ` as text and `x` in `strong`).

## Reviews

### Round 1 — plan-r1 (12 lenses, every plan-capable lens)

Wall elapsed 354 s (first prompt 1791709851 → last report 1791710205); no waits. Verdicts:
REVISE — plan, correctness, tests; APPROVED — minimalism, error-handling (one should-fix),
chess-semantics; NOT APPLICABLE + APPROVED — engine-protocol, ipc-contract, persisted-state,
pgn-index, platform-semantics, tauri-security.

| ID | Claim | Witnesses (lens#finding) | Evidence checked by the arbiter | Disposition | Authority | Status |
| --- | --- | --- | --- | --- | --- | --- |
| I1 | Disabling fenced code but keeping inline code spans turns ```` ```\nx\n``` ```` into a lossy inline code span in reader and editor | correctness-r1#1, plan-r1#1 | probe `codefree.mjs keep-code`: reader `inlineCode="hello"`, editor writes `` `hello` `` (P14) | Fix — code leaves the dialect (O1, O2; decision 1) | MANDATE "at minimum disable the block constructs"; O1 literal-text contract | open → closure r2 |
| I2 | Reader drops leading spaces of `    indented`; "no character lost" contract not met, reader and editor inconsistent | correctness-r1#2, plan-r1#1 | probe `remark.mjs`: `paragraph(text="indented")`; editor keeps the spaces (P14) | Fix — O1 contract: no non-whitespace character lost; reader display-only under HTML collapsing; editor byte-exact | MANDATE Defect (1), plain-text comments | open → closure r2 |
| I3 | "Inline builder only" also changes table-view variation runs | plan-r1#2 | `notationRows.ts:151-160`, `:343`, `:359`, `:365`, `:370` (P15) | Fix — O3 states the table view's variation runs follow the flow; mainline table rows unchanged; new table-view test (decision 4) | MANDATE "Let short single-line comments stay inline in the move flow" | open → closure r2 |
| I4 | Tall rows: centring the row hides the current move | plan-r1#3 | `GameNotation.tsx:89-103` (P16) | Fix — new O5 (scroll to the current move's cell), proven in the container (phase 3) | MANDATE "Let short single-line comments stay inline…" (necessary correctness of O3) | open → closure r2 |
| I5 | No proof that `GameNotation` forwards the starting comment to the cell | plan-r1#4 | `GameNotation.tsx:300-316` `moveProps`; `GameNotation.test.tsx:34-40,59-75` hides comments and mocks the cell | Fix — O3 verification adds a `GameNotation.test.tsx` forwarding assertion | MANDATE (O3 verification) | open → closure r2 |
| I6 | Parser/serializer failure semantics undefined in O2 | error-handling-r1#1 | `AnnotationEditor.tsx:38-40`: the store is written only from `onUpdate` on a user edit, so a load can never overwrite a comment; the P9 throw class is removed because parser and schema now match, and O2's mounted test loads every case | Skip — no failure path the plan introduces; a new error surface for an unobserved failure is outside MANDATE (confidence 92, verdict APPROVED) | — | closed (Skip) |
| I7 | O2 tests bypass `AnnotationEditor` (toolbar, input rules, store write) | tests-r1#1 | `AnnotationEditor.tsx:93-105` controls, `:38-40` `setComment` path | Fix — O2 verification mounts the production component in a `TreeStateContext` store | MANDATE "the Annotate editor … output format must be checked" | open → closure r2 |
| I8 | O1 assertions do not prove retained inline formatting | tests-r1#2 | test-assertion detail inside unchanged O1 | Fix — carried to CR-1 | — | carried (CR-1) |

Round 1 adopted plan-level corrections: 6 (I1, I2, I3, I4, I5, I7); carried 1 (I8 → CR-1);
skipped 1 (I6). Unique issues opened 8; resolved 1 (Skip); carried 1; open 6.

#### lens-plan-r1 (raw)

```text
[blocker] tasks/plans/.plan-2026-10-11-comment-dialect-and-inline-flow.md-r1.body.md:124 — O1/O2’s parser mechanism does not preserve literal block text. Running the supplied `remark.mjs:9` and `tiptap3.mjs:11` mechanisms with `"```\nfenced text\n```"` produces an `inlineCode` node in the reader and ``"`fenced text`"`` from the editor. The fences and line breaks disappear, contrary to O1 and O2:152. The reader probe also drops all four spaces from `"    indented"`. Require a preservation mechanism and shared regression cases for both inputs (confidence: 100).

[blocker] tasks/plans/.plan-2026-10-11-comment-dialect-and-inline-flow.md-r1.body.md:177 — The “inline builder only” boundary does not preserve table view as promised at line 188. `notationRows.ts:159` routes variation rendering through `appendInlineTasks`, and table view calls that route at `notationRows.ts:343`, `:359`, `:365` and `:370`. Removing comment boundaries and starting-comment rows therefore changes table-view variations too. The retained table tests at `notationRows.test.ts:251` cover mainline moves, so they would miss this consumer. Specify how table-view variations retain their current behavior and prove that boundary (confidence: 100).

[blocker] tasks/plans/.plan-2026-10-11-comment-dialect-and-inline-flow.md-r1.body.md:185 — Combining multiline comments into tall rows breaks current-move visibility. `GameNotation.tsx:93` resolves navigation to a row, then `:99` centers the whole row rather than the selected move. The installed virtualizer’s center-offset probe returned visible coordinates `[384,576]` for a 960px row in a 192px viewport, hiding moves near either end. Multiline comments render as blocks at `Comment.tsx:56`, so this is reachable through ordinary annotated games. Dynamic measurement prevents overlapping rows, but does not reveal the selected move. O3 needs a navigation obligation and proof for rows taller than the viewport (confidence: 96).

[blocker] tasks/plans/.plan-2026-10-11-comment-dialect-and-inline-flow.md-r1.body.md:192 — The proofs do not verify that starting comments reach the notation through `GameNotation`. Row-model tests and direct cell tests can pass while `GameNotation.tsx:304` drops the new value. Existing integration tests hide comments at `GameNotation.test.tsx:39` and mock the cell without displaying comment props at `:68`. O4’s fixture contains only move comments. Require an integration assertion that fails when starting-comment forwarding is omitted (confidence: 98).

VERDICT: REVISE
```

#### lens-minimalism-r1 (raw)

```text
No bloat or duplication defects found.

Minimum-diff counterfactual: the new editor test verifies round-trip behavior, the shared case list serves both parser tests, and the single new snapshot supplies the mandated pixel proof. No proposed added file is demonstrably unnecessary.

VERDICT: APPROVED
```

#### lens-correctness-r1 (raw)

```text
[blocker] tasks/plans/.plan-2026-10-11-comment-dialect-and-inline-flow.md-r1.body.md:150 — Disabling block tokenizers leaves fenced backticks consumed by inline-code parsing. Using the supplied probes with `"```\nhello\n```"`, the reader produces `inlineCode="hello"` and the editor serializes `` `hello` ``. After an edit it writes `` `!hello` ``, losing the fences and newlines. O1 requires literal block syntax, and O2 requires preservation outside edited characters. This is not a P10 exception. (confidence: 100)

[blocker] tasks/plans/.plan-2026-10-11-comment-dialect-and-inline-flow.md-r1.body.md:124 — Parse-time disabling of indented code drops leading whitespace. The reader probe maps `"    indented"` to `paragraph(text="indented")`, while the editor preserves all four spaces. The proposed mechanisms therefore violate O1’s character-preservation guarantee and leave reader/editor behavior inconsistent. The plan needs a source-preservation contract for this case. (confidence: 100)

VERDICT: REVISE
```

#### lens-error-handling-r1 (raw)

```text
[should-fix] tasks/plans/.plan-2026-10-11-comment-dialect-and-inline-flow.md-r1.body.md:150 — O2 specifies successful round trips but leaves parser and serializer failure semantics undefined. Current editor creation, `setContent` and `getMarkdown` calls have no error handling. Specify that failure preserves the original comment, prevents replacement writes, and surfaces a distinguishable error. Include failure-path proof alongside the round-trip tests (confidence: 92).

VERDICT: APPROVED
```

#### lens-tests-r1 (raw)

```text
[blocker] tasks/plans/.plan-2026-10-11-comment-dialect-and-inline-flow.md-r1.body.md:164 — O2 tests construct an editor and serialize directly, without exercising AnnotationEditor’s toolbar, typing input rules, or saved store value. Restoring block controls or breaking `onUpdate → setComment` would leave these proofs green. O4 only visits the preview, so the container suite supplies no editor proof either. Add a mounted editor journey asserting block controls are absent, typed block markers remain text, and an edit saves the expected comment. (confidence: 97)

[should-fix] tasks/plans/.plan-2026-10-11-comment-dialect-and-inline-flow.md-r1.body.md:131 — Rendered-text and forbidden-block assertions do not prove retained inline formatting. Replacing strong, emphasis, strike, and links with unformatted text would preserve those assertions and the existing underline/code tests. Assert the formatting elements and link destinations, including formatting within literal block-looking prose. (confidence: 96)

VERDICT: REVISE
```

#### lens-chess-semantics-r1 (raw)

```text
No chess-domain invariant violations found in plan-r1. The proposed flow preserves node ownership, root-anchored move numbering, path reconstruction, and separately stored comment metadata.

VERDICT: APPROVED
```

#### lens-engine-protocol-r1 (raw)

```text
NOT APPLICABLE: The plan’s files and obligations cover comment parsing, editor formatting, notation layout and pixel verification. They do not change engine process supervision, UCI protocol state or asynchronous engine result routing.
VERDICT: APPROVED
```

#### lens-ipc-contract-r1 (raw)

```text
NOT APPLICABLE: O1–O4 cover renderer comment parsing, editor formatting, notation layout and pixel verification. No Rust commands, events, IPC payloads, subscriptions or capability scopes are changed.
VERDICT: APPROVED
```

#### lens-persisted-state-r1 (raw)

```text
NOT APPLICABLE: The plan’s files and obligations change comment parsing, editor formatting and notation layout. They do not change renderer storage encoding, keys, atom families, hydration or tab lifecycle.

VERDICT: APPROVED
```

#### lens-pgn-index-r1 (raw)

```text
NOT APPLICABLE: O1–O4 change comment rendering, editor Markdown parsing, notation layout and pixel tests. They do not change PGN byte scanning, offsets, move encoding, database storage, search or disk export.

VERDICT: APPROVED
```

#### lens-platform-semantics-r1 (raw)

```text
NOT APPLICABLE: O1–O4 change JavaScript comment parsing, editor configuration and notation layout. They introduce no OS-specific paths, handles, filesystem operations, FFI or target branches. Container pixels do not claim macOS or Windows runtime proof.
VERDICT: APPROVED
```

#### lens-tauri-security-r1 (raw)

```text
NOT APPLICABLE: The plan’s files and O1–O4 obligations cover renderer comment parsing, editor formatting, notation layout and pixel tests. They introduce no credentials, session persistence, native filesystem authority or mutation, signed downloads, or backend diagnostic flows.

VERDICT: APPROVED
```

### Round 2 — plan-r2 (closure round: plan, correctness, tests; newly affected: minimalism, chess-semantics)

Wall elapsed 213 s (first prompt 1791710525 → last report 1791710738); no waits. Verdicts:
APPROVED — plan, tests, minimalism, chess-semantics; REVISE — correctness (one new blocker).

| ID | Closure result r2 |
| --- | --- |
| I1 | CLOSED — correctness-r2, plan-r2 (both re-ran `codefree.mjs` with and without `keep-code`) |
| I2 | CLOSED — correctness-r2, plan-r2 |
| I3 | CLOSED — plan-r2 |
| I4 | CLOSED — plan-r2 |
| I5 | CLOSED — plan-r2 |
| I7 | CLOSED — plan-r2, tests-r2 |

New issue:

| ID | Claim | Witnesses (lens#finding) | Evidence checked by the arbiter | Disposition | Authority | Status |
| --- | --- | --- | --- | --- | --- | --- |
| I9 | Table view reads a black move's alternatives from the black move's own children, so `1. e4 e5 (1... c5) 2. Nf3` never shows `c5` (and its comments) unless `Nf3` has alternatives, in which case an empty variation row is emitted | correctness-r2#1 | read `notationRows.ts:348-370` (`blackVariations = black.children.slice(1)` vs rows built from `child`), `:333`/`:340` for the correct black-only branch; the existing table test `notationRows.test.ts:112-126` cannot see it; introduced by `88ad35ef` (P17) | Fix — O3 table-view bullet: a black move's variations are the white move's other children; two new table-view tests | Same-area defect in the O3 builder (rule 4b; plan-only "same-area findings become plan obligations"); O3's table-variation flow clause (I3) depends on it | open → closure r3 |

Lineage: I9 is a newly found pre-existing defect (not correction-introduced); it surfaced because I3
extended O3 to table-view variation runs. Round 2 adopted plan-level corrections: 1 (I9). Unique
issues opened 9 cumulative; resolved 7 (I1–I5, I7 closed, I6 Skip); carried 1 (I8 → CR-1);
open 1 (I9).

#### lens-plan-r2 (raw)

```text
I1 CLOSED — plan-r2 O1/O2 disable inline code as well as code blocks. Both `codefree.mjs` runs confirm the correction preserves fences and backticks, while `keep-code` reproduces the loss (confidence: 100).

I2 CLOSED — `tasks/plans/.plan-2026-10-11-comment-dialect-and-inline-flow.md-r2.body.md:141` distinguishes display whitespace from editor preservation. The probe confirms indented text survives and the editor retains its spaces (confidence: 100).

I3 CLOSED — plan-r2:203 covers table-view variation runs and requires their regression test at :227. This matches `src/components/common/notationRows.ts:160`, :343, :359, :365 and :370 (confidence: 100).

I4 CLOSED — plan-r2:240 requires visibility of the move’s own cell and layout proof at :245, addressing row-centering at `src/components/common/GameNotation.tsx:99` (confidence: 96).

I5 CLOSED — plan-r2:230 requires a mounted forwarding assertion through `GameNotation`, covering the boundary at `src/components/common/GameNotation.tsx:304` that the existing mock at `GameNotation.test.tsx:68` does not expose (confidence: 99).

I7 CLOSED — plan-r2:186 requires the production editor, toolbar, typing rules and store-write journey, covering `src/components/panels/annotation/AnnotationEditor.tsx:24`, :40 and :93 (confidence: 99).

VERDICT: APPROVED
```

#### lens-correctness-r2 (raw)

```text
I1 CLOSED — O1/O2 disable inline code too. Both `codefree.mjs` runs confirm that disabling it preserves fenced text and editor round trips, while `keep-code` collapses the fences.

I2 CLOSED — O1 explicitly permits display-only whitespace collapsing. O2 retains byte-exact editor whitespace, confirmed for `    indented` by the probe.

[blocker] src/components/common/notationRows.ts:349 — O3’s expanded table-variation contract leaves a caller/builder mismatch unresolved. For `1. e4 e5 ({before} 1... c5 {after}) 2. Nf3`, `blackVariations` reads `e5.children.slice(1)` instead of `e4.children.slice(1)`. With no alternative to `Nf3`, the predicate is false, so `c5` and both comments never reach the inline builder. Correct the producer’s predicate while preserving mainline table rows. (confidence: 100)

VERDICT: REVISE
```

#### lens-tests-r2 (raw)

```text
I7 CLOSED — O2 now mounts production `AnnotationEditor` in `TreeStateContext` and asserts toolbar controls, typed markers, load-without-write, and the saved store value after an edit. Restoring block controls or breaking `onUpdate → setComment` would fail these assertions.

VERDICT: APPROVED
```

#### lens-minimalism-r2 (raw)

```text
VERDICT: APPROVED
```

#### lens-chess-semantics-r2 (raw)

```text
VERDICT: APPROVED
```

### Round 3 — plan-r3 (closure round: plan, correctness; newly affected: chess-semantics)

Wall elapsed 91 s (first prompt 1791710820 → last report 1791710911); no waits. Verdicts: APPROVED —
plan, correctness, chess-semantics. No new findings.

| ID | Closure result r3 |
| --- | --- |
| I9 | CLOSED — correctness-r3, plan-r3, chess-semantics-r3 |

Round 3 adopted plan-level corrections: 0. Final totals: 3 completed rounds (r1=6 r2=1 r3=0), 658 s
review wall time (354 + 213 + 91; active review time equals wall time, no waits); 9 unique issues
opened; 7 closed by reviewer closure checks (I1, I2, I3, I4, I5, I7 in r2; I9 in r3); 1 Skip (I6);
1 carried to the cumulative diff review (I8 → CR-1); 0 open; 0 Defer; 0 withdrawn; no rewrite or
split. Correction-introduced defects: none (I9 is a pre-existing `88ad35ef` defect surfaced by the
I3 correction's wider scope). Plan authorship and arbitration were one Claude context; detection ran
in separate Codex leaves (OpenAI high tier, `review-plan` role for the plan lens and `sensitive` for
the others because `package.json` / `pnpm-lock.yaml` are Sensitive-Path globs), a different model
family from the orchestrator; the prospective implementation is a Codex write leaf, so diff review
will be same-family with the code author.

#### lens-plan-r3 (raw)

```text
I9 CLOSED — plan-r3 O3 at tasks/plans/.plan-2026-10-11-comment-dialect-and-inline-flow.md-r3.body.md:225 corrects black-variation ownership to match the builder calls at src/components/common/notationRows.ts:365 and :370. Verification at plan-r3:239 covers missing `c5`, duplicate variations and empty rows, which the existing notationRows.test.ts:112 test misses (confidence: 100).

VERDICT: APPROVED
```

#### lens-correctness-r3 (raw)

```text
I9 CLOSED — O3 now requires black-move alternatives from the white move’s other children, matching the parent passed to the inline builder at notationRows.ts:365/370. Verification covers c5 without an Nf3 alternative and both variation sets appearing exactly once without empty rows.

VERDICT: APPROVED
```

#### lens-chess-semantics-r3 (raw)

```text
I9 CLOSED — P17 and O3 correctly locate `e5`’s alternatives in `e4.children.slice(1)`. Required tests cover `1. e4 e5 (1... c5) 2. Nf3`, both without and with an alternative to `Nf3`, asserting correct placement, exactly-once rendering and no empty variation row. No additional chess-domain blockers found.

VERDICT: APPROVED
```


## Adoption, implementation and diff review (adopting drain session 92629247-30b0-484a-a451-64fd78836bcb)

Adopted 2026-10-13 at BASE `b5385ac2` after `drain_supervisor_plans.py gate` printed `clear`; plan
copied to `tasks/plans/2026-10-13-comment-dialect-and-inline-flow.md`; the plan's five
`## Decided autonomously` entries recorded as d-20261013-09..13 before implementation.
Executor: Codex (OpenAI high tier for normal/sensitive write leaves and every lens, OpenAI low tier
for mechanical writes). Disclosure: one Claude context wrote every brief and arbitrated every
finding; detection ran in separate Codex lens leaves, which are the same model family as the Codex
write leaves that authored the code (same-model review for normal and sensitive writes).

### Phases

| Phase | Commit | Role | Proof (orchestrator re-run) |
| --- | --- | --- | --- |
| 1 — comment dialect (O1, O2) | `d4552d8b` | sensitive | vitest Comment + annotation 52 passed; lint:ci; i18n:check; checks:pre-review green |
| 2 — inline flow and navigation (O3, O5) | `90e3cb60` | normal | vitest src/components/common 145 passed; lint:ci; checks:pre-review green |
| 3 — pixel and navigation proof (O4, O5) | `7d018df7` | normal | test:e2e:container 124 passed, one new snapshot `files-inline-comment-prose-files-preview.png` inspected; checks:pre-review green |
| 4 — one shared comment lexer (added by the D3 lineage escalation) | `e56b16e2` (+ `c944289e` coverage mapping) | sensitive | install --frozen-lockfile; vitest 745 passed; tsgo; lint:ci; test:e2e:container 125 passed, no snapshot moved; checks:pre-review green |

CR-1 (carried from plan review) closed in round D1 by all seven code lenses (`CR-1 CLOSED` lines below; the records lens reviews ledger prose only).

### Diff-review issues and dispositions

| ID | Round | Lens | Claim (short) | Disposition | Repair | Closed |
| --- | --- | --- | --- | --- | --- | --- |
| D1-1 | D1 | correctness (blocker) | stale scrollToIndex verification undoes tall-row reveal | Fix (verified in virtual-core 3.13.18 source) | 0525eb8c | D2 |
| D1-2 | D1 | correctness (blocker) | `++**x**++` not underlined by the reader | Fix | db2f547d | D2 |
| D1-3 | D1 | code-quality | bare reveal retry limit | Fix | 0525eb8c | D2 |
| D1-4 | D1 | minimalism | duplicated mdast traversal | Fix | db2f547d | D2 |
| D1-5 | D1 | tests | unmounted tall row untested | Fix | 0525eb8c | D2 |
| D1-6 | D1 | records | d-20261013-10 round-trip claim omitted `_x_` → `*x*` (lens probe confirmed) | Fix | d-20261013-14 | D2 |
| D1-7 | D1 | records | f-20261013-01 consumer list too wide (ENOENT guards verified) | Fix | annotation de848169 | D2 |
| D2-1 | D2 | correctness (blocker) | stock tiptap underline tokenizer trims/accepts whitespace-flanked `++` (verified dist/index.js:38-43); chess `Qh7++ Kh8 Qg8++` underlined and corrupted | Fix | 19637ced, d86f368c | D3 |
| D2-2 | D2 | code-quality (blocker) | cancel helper also scrolled | Fix | 2d27b27d | D3 |
| D2-3 | D2 | code-quality | synthetic coordinate string undocumented | Fix | 19637ced | D3 |
| D2-4 | D2 | minimalism | duplicated tall-row fixture | Fix | 2d27b27d | D3 |
| D2-5 | D2 | tests | rapid-navigation sample, scrollToFn wiring | Fix | 2d27b27d | D3 |
| D2-6 | D2 | records | d-20261013-14 normalisation list incomplete | Fix | d-20261013-15 | D3 |
| D3-1 | D3 | correctness (blocker) | `++**a\nb**++` underlined by reader only — second reopening of the reader/editor underline lineage | Escalated (§4a.3): focused review-plan judgment "Underline judgment" below → new Phase 4 (shared lexer) | e56b16e2 | D4 |
| D3-2 | D3 | code-quality | bare 15 settle frames | Fix (derived 32) | 2bb5f752 | D4 |
| D3-3 | D3 | tests | editor fixtures ignored formatting expectations | Fix | e56b16e2 | D4 |
| D3-4 | D3 | records | d-20261013-15 text-preservation claim vs HTML whitespace collapse | Fix (HTML now literal) | e56b16e2, d-20261013-16 | D4 |
| D4-1 | D4 | correctness (blocker) | empty paragraph saved as visible `&nbsp;` | Fix | c00ccd0d | D5 |
| D4-2 | D4 | correctness (blocker) | link titles with `"` unescaped | Fix | c00ccd0d | D5 |
| D4-3 | D4 | root-cause (blocker) | textBetween fallback drops hard breaks | Fix | c00ccd0d | D5 |
| D4-4 | D4 | code-quality (nit) | test title overstated | Fix | c00ccd0d | D5 |
| D4-5 | D4 | tests | underline authoring over whitespace/newlines untested and lossy (judgment-named risk) | Fix | c00ccd0d | D5 |
| D4-6 | D4 | records | d-20261013-16 reversal path incomplete | Fix | d-20261013-17 | D5 |
| D4-7 | D4 | records (nit) | "only option" overclaim | Fix | d-20261013-17 | D5 |
| D4-8 | D4 | minimalism | four copied assertion loops | Fix | c00ccd0d | D5 |
| D5-1 | D5 | correctness (blocker) | literal `a++bc` + underlined `c` saves `a++b++c++` (pre-existing class; stock tiptap writes the same) | Defer — "Serializer judgment" below (REVISE: needs an escape-contract decision and an owned serializer with a semantic save gate; beyond O2's bounded case list) | filed to the inbox (successor) | — |
| D5-2 | D5 | correctness (blocker) | adjacent links merged `[ab](b)` (pre-existing tiptap mark-boundary helper) | Defer — same successor | filed to the inbox (successor) | — |

`diff_adopted_per_round`: r1=7 r2=6 r3=4 r4=8 r5=0 (r5: 2 Defer). Lineage: the reader/editor
underline mechanism reopened in D2-1 and D3-1 → escalated to the underline judgment, which replaced
the two-parser model (Phase 4); the editor-serializer lineage reopened in D5-1 → escalated to the
serializer judgment, which returned REVISE on the question (it needs a product-adjacent escape
contract and a separate design) → deferred as one `build`-tier successor.

**Successor:** filed through the inbox spool as
`tasks/findings-inbox/20261013-095358-2561660-1791878038456800562-6.md` ("The Annotate editor's
Markdown save can still change a comment …", Entry `build`). It owns D5-1 and D5-2 and must load
this file before plan review. Its filed entry carries no `**Proof:**` bullet (records lens, round
D6); the proof it owes, red at `2fd8711f` and green after its fix:
`pnpm vitest run src/components/panels/annotation` with mounted save → reload cases for (a) literal
`a++bc` with only `c` underlined — the reload shows the text `a++bc` with `c` underlined, or the
save is refused with the draft kept; (b) `[a](https://a.test)[b](https://b.test)` plus a typed `!`
— both links keep their own `href` after reload; (c) an unmarked literal `**x**` typed in the
editor — it reloads as the text `**x**`, not bold.

Capacity: five lens leaves hit provider capacity and were retried once on the same route
(`leaf-quota-retry.py --capacity`, attempt 1/3 each); the retried reports are the ones quoted.

### Round D1 — cumulative diff `ba5542a4..7d018df7` (round 1)

#### lens-correctness-d1 (raw)

```text
CR-1 CLOSED — shared fixtures and `Comment.test.tsx` assert `strong`, `em`, `del`, `u`, link destinations, and the literal prefix in `59. **x**`.

[blocker] src/components/common/GameNotation.tsx:118 — Rapidly navigate from a short row to an unmounted tall row before the previous `scrollToIndex` verification finishes. The new `scrollToOffset` calls leave the virtualizer’s `currentScrollToIndex` pointing at the previous row. Its pending verification detects the changed offset and retries that old index, scrolling away from the newly selected move. Effect cleanup cancels only this component’s frames. O5 requires the new selection to remain visible (confidence: 95).

[blocker] src/components/common/Comment.tsx:79 — For `++**x**++`, Markdown produces separate text, strong, and text nodes. Underline processing examines each text node separately, so neither `++` pair matches. The reader displays literal `++` around bold `x`, without underline. The editor’s underline tokenizer parses the enclosed strong token and applies both marks. This pre-existing defect in the changed function violates O1/O2’s shared inline-formatting contract (confidence: 99).

Limitation: Navigation scheduling was traced through the installed virtualizer source, without browser reproduction (runtime verification confidence: 60).

VERDICT: REVISE
```

#### lens-root-cause-d1 (raw)

```text
CR-1 CLOSED — `Comment.test.tsx` asserts `strong`, `em`, `del`, `u`, link `href`s, and the literal `59. ` prefix before `<strong>x</strong>`.

No root-cause blockers or reintroduced prior fixes found. Block parsing is disabled in both reader and editor. The shared inline builder removes comment-triggered row breaks across notation surfaces. Starting-comment preservation, raw-HTML protection, and bounded virtualization remain intact.

Named limitation — no recorded failing-before run of the new regression tests was supplied. Before-state evidence comes from the plan’s parser probes and Git history, with post-change passes supplied by the orchestrator (confidence: 95).

VERDICT: APPROVED
```

#### lens-code-quality-d1 (raw)

```text
CR-1 CLOSED — `Comment.test.tsx` and shared fixtures assert `strong`, `em`, `del`, `u`, links with their `href`, and the literal `59. ` prefix before `strong`.

[blocker] src/components/common/GameNotation.tsx:126 — Bare `10` controls when move-reveal retries stop, without a named limit or rationale. Nearby behavior limits use named constants, including `NOTATION_ROW_MAX_MOVES` in `notationRows.ts` and `DATABASE_LIST_MAX_RETRIES` in `useDatabaseList.ts`. Name this frame limit and explain its value. (confidence: 99)

VERDICT: REVISE
```

#### lens-minimalism-d1 (raw)

```text
CR-1 CLOSED — `Comment.test.tsx` asserts retained formatting elements, link destinations, and the literal `59. ` prefix before `strong`.

[should-fix] src/components/common/Comment.tsx:37 — New `remarkInlineOnly` duplicates `remarkUnderline`’s recursive child-replacement traversal at line 76. Both serve the same comment renderer. Consolidate source recovery and underline expansion into one traversal, preserving recovery-before-formatting order. This removes the second visitor and plugin wrapper, roughly ten lines, without losing O1 coverage (confidence: 88).

Minimum-diff counterfactual for added files: `commentDialectCases.ts` serves both reader and editor tests. `AnnotationEditor.test.tsx` provides the required mounted editor proof. The new PNG supplies O4’s single snapshot. None is deletable wholesale while retaining acceptance coverage.

VERDICT: REVISE
```

#### lens-tests-d1 (raw)

```text
CR-1 CLOSED — shared dialect cases assert `strong`, `em`, `del`, `u`, and links with their destinations. The `59. **x**` case separately asserts the literal prefix and strong element.

[should-fix] e2e/files-preview.spec.ts:251 — Tall-row navigation covers only an already-mounted row containing all 15 moves. The deep-navigation unit test takes the zero-height viewport fallback. Removing the unmounted-row mounting scroll at `GameNotation.tsx:115–119` would therefore leave both tests green while navigation to an unmounted tall row could fail to reveal the selected move. Add a layout scenario that starts with the target row unmounted and asserts its selected cell becomes visible. (confidence: 99)

VERDICT: APPROVED
```

#### lens-error-handling-d1 (raw)

```text
CR-1 CLOSED — `Comment.test.tsx` and shared dialect cases assert `strong`, `em`, `del`, `u`, link destinations, and literal `59. ` before bold text.

No traced error-handling defects found. The scrolling retry is bounded, frame-delayed, cancellable, and performs no data mutation.

Limitation: parser exceptions and retry exhaustion were reviewed statically without fault injection (confidence: 95).

VERDICT: APPROVED
```

#### lens-chess-semantics-d1 (raw)

```text
CR-1 CLOSED — `Comment.test.tsx` and shared fixtures assert `strong`, `em`, `del`, `u`, link destinations, and literal `59. ` before `strong`.

No chess-domain violations found. Black-to-move numbering remains root-anchored, Black alternatives use the correct parent, and notation paths and caches refresh with the immutable root after mutations.

VERDICT: APPROVED
```

#### lens-records-d1 (raw)

```text
[should-fix] tasks/decisions.md:7428 — The byte-identical round-trip claim omits formatting normalisation. A read-only probe using HEAD’s actual editor configuration loads `_x_` but `getMarkdown()` returns `*x*`, outside the listed exceptions. The shared fixture also explicitly gives reader and editor different backslash-escape semantics. Qualify the preservation and shared-dialect claims. (confidence: 100)

[should-fix] tasks/findings.md:15520 — Three named consumers already tolerate pending deletions: `check-ui-boundaries.mjs:39`, `check-tauri-command-boundary.mjs:510`, and `check-ipc-command-consumers.mjs:402` skip `ENOENT`. Narrow the affected-consumer list and the “any uncommitted deletion” claims at lines 15515 and 15523 to the demonstrated untranslated-JSX failure. (confidence: 100)

Unverifiable: universal third-party behavior and the original Library proof-run observations.

VERDICT: REVISE
```

### Round D2 — closure `7d018df7..0525eb8c` (repairs db2f547d, 0525eb8c; records de848169, d779264a, 28b7e4ee)

#### lens-correctness-d2 (raw)

```text
D1-1 CLOSED — cancellation clears the pending index, and the scroll guard suppresses an already queued retry while allowing direct reveals and resize adjustments.

D1-2 CLOSED — sibling-aware pairing renders `++**x**++` as underlined bold text.

D1-3 CLOSED — the retry bound is named `NOTATION_REVEAL_MAX_ATTEMPTS`.

D1-4 CLOSED — one recursive traversal performs source preservation and underline processing.

D1-5 CLOSED — the new scenario asserts row 40 is unmounted before navigation and checks the selected cell’s visibility after mounting.

[blocker] src/components/panels/annotation/AnnotationEditor.tsx:46 — The configured parser retains Tiptap’s underline tokenizer, which calls `match[2].trim()`. Loading `a++ b ++c` therefore produces `abc` in the editor, although the reader displays `a b c`. Appending an unformatted `!` saves `a++b++c!`, permanently deleting both spaces. This violates O2’s whitespace-preservation contract and is outside the normalisations named in d-20261013-14. This is a surrounding-code defect in the full range, not introduced by the repair delta. (confidence: 98)

Limitation: the additional whitespace case was traced through installed parser and serializer source, without a runtime probe under the read-only command rails.

VERDICT: REVISE
```

#### lens-code-quality-d2 (raw)

```text
D1-1 CLOSED — GameNotation.tsx:164 cancels the previous index verification. The scroll boundary also rejects queued retries. GameNotation.test.tsx:152 covers both retry states against the real virtualizer.

D1-2 CLOSED — Comment.tsx:58 pairs underline delimiters across formatted siblings. Shared fixtures assert `u strong`, `u em`, and underlined links.

D1-3 CLOSED — GameNotation.tsx:57 names the limit `NOTATION_REVEAL_MAX_ATTEMPTS`, used at line 177.

D1-4 CLOSED — Comment.tsx:36 performs one recursive traversal. The separate `remarkUnderline` traversal is removed.

D1-5 CLOSED — e2e/files-preview.spec.ts:322 asserts the distant tall row is unmounted before navigation, then checks selected-cell visibility. Supplied mutation evidence confirms removing the mounting scroll makes this scenario fail.

[blocker] src/components/common/GameNotation.tsx:82 — `cancelNotationIndexScroll` also initiates scrolling when passed an offset. Calls at lines 169 and 196 perform the actual mounting and reveal scrolls under a cancellation-only name. Name both actions explicitly or expose a separately named offset-scroll helper (confidence: 90).

[should-fix] src/components/common/Comment.tsx:60 — The underline parser’s synthetic coordinate system is undocumented. Formatted nodes occupy one `\0` character, paragraph boundaries occupy `\n`, and `take(length)` consumes those synthetic positions while advancing shared cursors. The existing comment describes the goal but leaves this essential mapping implicit. Name the synthetic string accordingly and document its correspondence with `take` (confidence: 88).

VERDICT: REVISE
```

#### lens-minimalism-d2 (raw)

```text
D1-1 CLOSED — cancellation clears the virtualizer’s pending index, and the scroll adapter blocks already-queued retries. The real-virtualizer test covers both retry states.

D1-2 CLOSED — `underlineChildren` preserves formatted siblings inside underline pairs. Shared reader/editor cases cover bold, italic and links.

D1-3 CLOSED — the reveal bound is now `NOTATION_REVEAL_MAX_ATTEMPTS`.

D1-4 CLOSED — `remarkUnderline` is removed. Source preservation and underline processing share one recursive traversal.

D1-5 CLOSED — the new e2e scenario asserts the distant tall row is initially unmounted, then verifies mounting and selected-cell visibility. Supplied mutation evidence confirms removing the mounting scroll makes it fail.

[should-fix] e2e/files-preview.spec.ts:294 — the repair introduces a second identical tall-comment fixture: paragraph generation and the Nf3/Be3 comment mapping duplicate lines 241–253. Extract one `tallCommentTokens` fixture and use it in both scenarios, retaining the distant scenario’s prefix moves. This removes roughly eight duplicated lines without losing acceptance coverage (confidence: 97).

Minimum-diff counterfactual: the repair adds no files. In the full range, the shared dialect fixture has two consumers, the editor test supplies required component-level proof, and the snapshot supplies mandated pixel evidence. None is demonstrably deletable.

VERDICT: REVISE
```

#### lens-tests-d2 (raw)

```text
D1-1 CLOSED — `GameNotation.test.tsx:152-210` exercises the real virtualizer with pending verification and an already-queued retry. After draining frames, assertions require no stale scroll writes and offset 2000.

D1-2 CLOSED — the shared `++**x**++` case requires `u strong` containing `x`. Reverting the reader repair fails this assertion.

D1-3 CLOSED — retries use the named `NOTATION_REVEAL_MAX_ATTEMPTS` constant. No behavior change needs a separate assertion.

D1-4 CLOSED — one recursive traversal performs source preservation and underline transformation. Formatting and delimiter-boundary assertions guard the combined behavior.

D1-5 CLOSED — `e2e/files-preview.spec.ts:323-328` asserts the distant row is initially unmounted, then checks selected-cell containment and tall-row geometry. The supplied mounting-scroll revert turns this scenario red.

[should-fix] e2e/files-preview.spec.ts:340 — The rapid-navigation assertion accepts the first visible sample without draining pending retries or checking continued visibility. A later stale scroll can escape detection, particularly because navigation immediately changes again. The supplied cancellation-disabled probe passed two of three runs. The deterministic unit test calls the helpers directly, so it does not guard their production wiring. (confidence: 96)

VERDICT: APPROVED
```

#### lens-records-d2 (raw)

```text
D1-6 CLOSED — d-20261013-14 records emphasis normalization and the escape-display difference. d-20261013-10 points to its replacement.

D1-7 CLOSED — the annotation correctly identifies the three `ENOENT` guards and the unguarded untranslated-JSX reader.

[should-fix] tasks/decisions.md:7472 — The replacement still incorrectly limits normalization to four cases. Using HEAD’s editor configuration, appending `!` changes `[x](https://x.y 'title')` to `[x](https://x.y "title")!` and `a\n\n\nb` to `a\n\nb!`. Narrow the preservation claim or acknowledge additional normalization. (confidence: 100)

VERDICT: REVISE
```

### Round D3 — closure `0525eb8c..d86f368c` (repairs 19637ced, 2d27b27d, d86f368c; records d-20261013-15)

#### lens-correctness-d3 (raw)

```text
D2-1 CLOSED — Both parsers use `COMMENT_UNDERLINE` without trimming, preserving the reported whitespace and double-check inputs.
D2-2 CLOSED — Cancellation and offset scrolling are separate, and both callers use the appropriate function.
D2-3 CLOSED — The synthetic coordinate representation and cursor consumption are documented.
D2-4 CLOSED — Both tall-comment scenarios use `tallCommentTokens`.
D2-5 CLOSED — Visibility is checked again after 15 frames, and the mounted test asserts production `scrollToFn` wiring.

[blocker] src/components/common/Comment.tsx:72 — For `++**a\nb**++`, Markdown produces a multiline strong node, which this mapping replaces with `\0`. The underline regex therefore sees `++\0++`, removes the literal delimiters and underlines both lines. The editor checks the original source and rejects that match. This violates the shared one-line rule in d-20261013-15 and leaves reader/editor formatting inconsistent. (confidence: 98)

Limitation: the additional multiline case was traced through source, not executed under these review rails.

VERDICT: REVISE
```

#### lens-code-quality-d3 (raw)

```text
D2-1 CLOSED — Both parsers use `COMMENT_UNDERLINE`. The editor tokenizer preserves `match[1]` without trimming, and shared fixtures cover whitespace and double-check prose.

D2-2 CLOSED — `cancelNotationIndexScroll` only cancels. Offset scrolling uses `scrollNotationToOffset`, with separate assertions for both effects.

D2-3 CLOSED — `underlineChildren` documents its synthetic coordinates and cursor consumption.

D2-4 CLOSED — Both tall-row scenarios use `tallCommentTokens`.

D2-5 CLOSED — Visibility is checked again after queued frames, and the mounted unit test asserts production `scrollToFn` wiring.

[should-fix] e2e/files-preview.spec.ts:75 — The new bare `15` controls the retry-observation window without explaining why fifteen frames suffice. Name this budget and document its rationale, following `NOTATION_REVEAL_MAX_ATTEMPTS` in `src/components/common/GameNotation.tsx` (confidence: 92).

LIMITATION: `src/components/common/tests/commentDialectCases.ts` has no sibling file in its directory, so a directory-local fixture convention cannot be established (confidence: 100).

VERDICT: APPROVED
```

#### lens-tests-d3 (raw)

```text
D2-1 CLOSED — Exact saved-comment assertions catch stock-tokenizer whitespace loss. Reader assertions check preserved spaces and absence of `<u>` for double-check prose.

D2-2 CLOSED — `GameNotation.test.tsx:204–213` asserts cancellation leaves the offset unchanged, explicit scrolling reaches 2000, and queued retries cannot overwrite it.

D2-3 CLOSED — The synthetic-coordinate comment explains the tested formatted-sibling preservation.

D2-4 CLOSED — Both tall-row browser scenarios use the shared fixture and retain cell-visibility assertions.

D2-5 CLOSED — Browser visibility is checked again after 15 animation frames. The mounted wiring assertion fails if production omits `scrollToFn`, while the real virtualizer test drains queued retries.

[should-fix] src/components/panels/annotation/AnnotationEditor.test.tsx:96 — Editor fixtures ignore their `formatting` and `absent` expectations. Replacing the editor’s underline regex with the stock permissive regex while retaining untrimmed content would underline `a++ b ++c` and double-check prose, yet preserve the asserted serialized strings. Assert the editor DOM’s underline presence and absence alongside saved output. (confidence: 97)

VERDICT: APPROVED
```

#### lens-records-d3 (raw)

```text
D2-6 CLOSED — d-20261013-14 points to d-20261013-15, whose normalization examples are explicitly non-exhaustive. All six examples match HEAD’s editor output.

[should-fix] tasks/decisions.md:7484 — The replacement still incorrectly claims preservation of text characters outside the edit. Using HEAD’s editor configuration, loading `<b>a  b</b>` and appending an unformatted `!` saves `**a b**!`, deleting an internal space. `@tiptap/markdown/dist/index.js:674` parses HTML through `generateJSON`, which collapses that whitespace. This changes text, beyond rewriting Markdown syntax. Qualify the preservation claim accordingly (confidence: 100).

VERDICT: REVISE
```

#### lens-minimalism-d3 (raw)

```text
D2-1 CLOSED — Reader and editor use `COMMENT_UNDERLINE`. The editor tokenizer preserves captured text without trimming, and shared fixtures cover whitespace and double-check prose.

D2-2 CLOSED — Cancellation and offset scrolling are separate operations. Both production offset-scroll sites use `scrollNotationToOffset`.

D2-3 CLOSED — `underlineChildren` documents synthetic coordinates and how `take()` preserves formatted siblings.

D2-4 CLOSED — Both tall-comment scenarios use `tallCommentTokens`. Its prefix parameter serves the distant-row scenario.

D2-5 CLOSED — Visibility is checked again after queued frames. The mounted unit test asserts production `scrollToFn` wiring, supported by the supplied red-on-removal proof.

No new bloat or duplication defects found in the repair delta, and no minimalism blocker found in the full range. The scroll helper has two production callers and adds cancellation and guard state, so it is justified.

Minimum-diff counterfactual for each added file:

- `commentDialectCases.ts` supplies one fixture set to two suites. Deleting it would duplicate the dialect cases.
- `AnnotationEditor.test.tsx` supplies the required mounted editor proofs. Reader tests cannot replace its store-write, input-rule and parser-isolation checks.
- `files-inline-comment-prose-files-preview.png` supplies the required pixel baseline. Deleting it loses that acceptance proof.

Verification limitation: this read-only review inspected source and assertions. Test execution results are the supplied evidence.

VERDICT: APPROVED
```

### Round D4 — closure `d86f368c..c944289e` (2bb5f752, Phase 4 e56b16e2, c944289e; records d-20261013-16)

#### lens-correctness-d4 (raw)

```text
D3-1 CLOSED — Both consumers use the shared lexer. Its anchored underline match rejects `++**a\nb**++` before parsing strong tokens. The supplied revert check confirms the regression case.

D3-2 CLOSED — The bare frame count is replaced by `SCROLL_SETTLE_FRAMES`, with its bound documented.

D3-3 CLOSED — Editor fixtures now assert loaded text, formatting, and absent marks, then reload and render saved comments.

[blocker] src/components/panels/annotation/AnnotationEditor.tsx:29 — Empty paragraphs become literal entity text after saving. Load `x` and press Enter at its end. The inherited paragraph serializer emits `x\n\n&nbsp;`. The new reader displays `&nbsp;`, and this parser reloads it as six text characters. The fallback at line 53 does not apply because serialization is nonempty. A blank paragraph must not introduce visible comment text. (confidence: 99)

[blocker] src/components/panels/annotation/AnnotationEditor.tsx:40 — Link titles containing double quotes are serialized without escaping them. Load `[x](https://x.y 'a "b"')` and append an unformatted `!`. Saving produces `[x](https://x.y "a "b"")!`, which fails marked’s explicit-link grammar on reload. Link syntax becomes visible instead of preserving the linked `x` and its title. This inherited defect remains in the replacement serializer. (confidence: 98)

Limitation — Findings are source-traced through the installed serializers and tokenizer grammar. No runtime probes were run under the assignment’s command restrictions. Tall-row retry timing was not independently reverified (confidence: 85).

VERDICT: REVISE
```

#### lens-root-cause-d4 (raw)

```text
D3-1 CLOSED — Both consumers now tokenize original source through the shared factory. Newlines cannot hide behind synthetic placeholders. The supplied revert-red/restore-green evidence covers the original failure.

D3-2 CLOSED — The settle window is named and derived from the virtualizer retry budget.

D3-3 CLOSED — Editor fixtures assert loaded marks, absent marks, saved text, reloaded content and reader output.

[blocker] src/components/panels/annotation/AnnotationEditor.tsx:53 — The entity-preservation fallback leaves the serializer’s wrong empty-state classification intact and introduces another loss. Load `"&nbsp;  \n&nbsp;!"`, then delete `!`. `MarkdownManager.serialize()` strips entities when checking emptiness and returns `""`. The fallback calls ProseMirror `textBetween()` without a leaf-text handler, so the intervening `hardBreak` disappears and the saved comment becomes `"&nbsp;&nbsp;"`. Reloading loses the line break. The existing deletion tests cover paragraphs but miss this sibling manifestation. Fix the empty-output classification at the serialization boundary rather than substituting plain text. Source-traced, not executed under the read-only review rails. (confidence: 99)

VERDICT: REVISE
```

#### lens-code-quality-d4 (raw)

```text
D3-1 CLOSED — Both consumers use `createCommentMarkdown()`. Shared multiline fixtures require literal `++` and no underline.
D3-2 CLOSED — `SCROLL_SETTLE_FRAMES` replaces the bare wait count and documents its budget.
D3-3 CLOSED — Editor fixtures now assert loaded text, formatting and absent marks, then reload and render saved comments.

[nit] src/components/panels/annotation/AnnotationEditor.test.tsx:100 — “saves only the edit” overstates the contract. Cases explicitly expect delimiter normalization, autolink serialization and merged underlines. Name the preserved text and permitted normalization so test output describes what it proves (confidence: 96).

VERDICT: APPROVED
```

#### lens-minimalism-d4 (raw)

```text
D3-1 CLOSED — reader and editor use `createCommentMarkdown()`. The multiline regression fixtures require literal `++` and no underline.
D3-2 CLOSED — `SCROLL_SETTLE_FRAMES` replaces the bare frame count and documents its bound.
D3-3 CLOSED — editor fixtures now assert text, formatting and absent marks on load and after reload.

[should-fix] src/components/panels/annotation/AnnotationEditor.test.tsx:130 — the absent-mark and formatting assertions duplicate lines 109–117, with near-identical copies at lines 153–159 and `Comment.test.tsx:61`. Extract one shared test assertion helper, parameterizing the editor’s escape-display difference, and route all four sites through it. These checks enforce one dialect contract and must stay synchronized (confidence: 96).

Minimum-diff counterfactual: retain the shared lexer file, which has two production consumers, and its focused test file. Consolidating the assertion loops removes approximately 20 net lines without losing any required checks. The shared fixtures, mounted editor tests and pixel snapshot each serve required verification.

VERDICT: REVISE
```

#### lens-tests-d4 (raw)

```text
D3-1 CLOSED — Shared fixtures assert literal `++`, preserved nested formatting, and absence of `u` in both reader and editor. Reverting the reader fails these assertions.

D3-2 CLOSED — The named 32-frame settle window precedes a final viewport assertion that detects delayed recentering.

D3-3 CLOSED — Editor fixtures now assert loaded text, expected marks, and forbidden marks before editing, then verify saved output and reload.

[should-fix] src/components/panels/annotation/AnnotationEditor.test.tsx:224 — Underline authoring is tested only on `"x"`. The judgment explicitly identifies whitespace and multiline selections as serialization risks. Loaded Markdown fixtures never create those marks through authoring. A serializer that trims whitespace or drops text only from such selections would pass every current assertion. Add authoring → save → reload text-preservation assertions for these selections. (confidence: 98)

VERDICT: APPROVED
```

#### lens-error-handling-d4 (raw)

```text
D3-1 CLOSED — Reader and editor use the shared lexer. Multiline formatting fixtures assert literal plus delimiters and no underline.

D3-2 CLOSED — The named 32-frame settle constant replaces the unexplained 15 frames.

D3-3 CLOSED — Editor fixtures now assert loaded text, formatting and absent marks, then check serialization and reload.

No error-handling defects found. The empty-serialization fallback preserves document text and does not catch exceptions. Disallowed links remain literal, and HTML is rendered as text.

Limitation: supplied test results were inspected, not independently rerun.

VERDICT: APPROVED
```

#### lens-records-d4 (raw)

```text
D3-4 CLOSED — HEAD saves `<b>a  b</b>` plus an appended edit as `<b>a  b</b>!`. d-20261013-16 supersedes the obsolete wording, with both required trailers present.

[should-fix] tasks/decisions.md:7498 — The reversal path incorrectly says enabling a construct in the factory makes both consumers follow. Enabling headings alone produces `Unknown node type: heading` and an empty editor paragraph because AnnotationEditor.tsx:74 disables that node. The reader also lacks a heading renderer. Record the required adapter changes (confidence: 100).

[nit] tasks/decisions.md:7498 — The judgment does not establish the shared lexer as the “only option that agrees by construction”. `.judgment-underline-d3.md:32` explicitly says reusing MarkdownManager can also share conversion semantics, rejecting it for complexity and conversion concerns (confidence: 99).

VERDICT: REVISE
```

### Round D5 — closure `c944289e..c00ccd0d` (repair c00ccd0d; records d-20261013-17)

#### lens-correctness-d5 (raw)

```text
D4-1 CLOSED — empty paragraphs are filtered before serialization, with Enter/reload cases covering visible sentinel text.
D4-2 CLOSED — link titles escape backslashes and quotes, with title-preservation reload cases.
D4-3 CLOSED — serialization uses renderNodes directly, preserving entity text and hard-break boundaries.
D4-4 CLOSED — the test title now acknowledges syntax normalization.
D4-5 CLOSED — the reported multiline, nested-mark, whitespace-only and literal-`++` selections are handled.
D4-8 CLOSED — all four assertion sites use assertCommentFormatting.

[blocker] src/components/panels/annotation/AnnotationEditor.tsx:148 — Load literal `a++bc`, then underline only the final `c`. Serialization writes `a++b++c++`. The shared lexer pairs the original unmatched `++` with the generated opening delimiter, so reload displays `abc++` with `b` underlined. Validating the isolated run does not preserve surrounding text or the selected mark. (confidence: 99)

[blocker] src/components/panels/annotation/AnnotationEditor.tsx:75 — Load `[a](https://a.test)[b](https://b.test)` and append an unformatted `!`. Serialization produces `[ab](https://b.test)!`, changing `a`’s destination. Tiptap’s mark-boundary helpers compare link types without comparing attributes, then close the combined run using the second link’s attributes. The paragraph renderer delegates both ordinary and underlined content to this mismatched boundary logic. (confidence: 99)

Limitation: findings are source-traced. Runtime probes and the supplied gate results were not rerun, and full-range notation scrolling was not runtime-verified (confidence: 85).

VERDICT: REVISE
```

#### lens-root-cause-d5 (raw)

```text
D4-1 CLOSED — The paragraph renderer no longer emits `&nbsp;` for empty paragraphs. The document renderer normalizes their boundaries. Enter and consecutive-empty-paragraph regressions cover saving and reloading.

D4-2 CLOSED — The link serializer escapes both backslashes and double quotes at the producer boundary. Reload tests assert preserved titles, including mixed quoting.

D4-3 CLOSED — `CommentMarkdown` removes the entity-stripping emptiness check from serialization. Both save and synchronization paths use that serializer, and the lossy `textBetween()` fallback is gone. Regression cases cover entity-only text beside hard breaks and paragraph boundaries.

D4-4 CLOSED — The test title now explicitly permits syntax normalization while requiring text preservation.

D4-5 CLOSED — Paragraph serialization supplies actual underline runs instead of placeholder-derived delimiters. Soft newlines split before nested marks render, and unrepresentable runs preserve text without generated delimiters. Tests cover the reproduced failures and whitespace-edge/hard-break compatibility.

D4-8 CLOSED — All four copied formatting-assertion loops now call `assertCommentFormatting`.

No root-cause blocker or prior-fix reintroduction found. History inspection confirms the shared lexer, active-lexer recursion, strict chess `++` rule, and per-editor tokenizer isolation remain intact.

Verification limitation: this read-only review inspected source, dependency internals, tests, and history. Runtime conclusions rely on the supplied failing-before/passing-after evidence and reported 767-test green run, which I did not rerun (confidence: 97).

VERDICT: APPROVED
```

#### lens-code-quality-d5 (raw)

```text
D4-1 CLOSED — Empty paragraphs are filtered during serialization. Enter and consecutive-empty-paragraph tests cover save and reload.
D4-2 CLOSED — Link titles escape backslashes and quotes. Reload tests cover quoted and multiline titles.
D4-3 CLOSED — The serialization-boundary override replaces the `textBetween()` fallback. Entity regressions cover hard breaks and paragraph boundaries.
D4-4 CLOSED — The test title now explicitly allows syntax normalization.
D4-5 CLOSED — Underline serialization handles whitespace edges, line boundaries, nested formatting, and unrepresentable selections, with regression coverage.
D4-8 CLOSED — All four assertion loops now call `assertCommentFormatting()`.

No additional readability or local-consistency defects found. Closure assessment uses source inspection and the supplied proof results.

VERDICT: APPROVED
```

#### lens-minimalism-d5 (raw)

```text
D4-1 CLOSED — document serialization filters empty paragraphs. Enter and consecutive-empty-paragraph tests verify no visible entity sentinel is saved.

D4-2 CLOSED — link titles escape backslashes and quotes. Reload tests assert the original title survives.

D4-3 CLOSED — serialization bypasses Tiptap’s entity-stripping emptiness check. The plain-text fallback is removed, and regression cases assert preserved hard breaks and paragraph boundaries.

D4-4 CLOSED — the test title now explicitly permits syntax normalization.

D4-5 CLOSED — underline serialization receives actual runs, splits before rendering nested marks, and validates generated delimiters against `COMMENT_UNDERLINE`. Tests cover soft/hard breaks, nested formatting, whitespace-only selections and literal `++`.

D4-8 CLOSED — all four copied assertion loops now call `assertCommentFormatting`.

No bloat or duplication defects found. The new helper serves both test suites. The serialization overrides each address a traced Tiptap behavior, so none is a redundant pass-through layer.

Minimum-diff counterfactual: retain the shared assertion helper and targeted serializer repairs. No added file in the delta can be deleted while preserving the required shared assertions and regression coverage.

Verification limitation: closure is source-traced against Tiptap 3.20.0 and the supplied proof results. I did not rerun tests.

VERDICT: APPROVED
```

#### lens-tests-d5 (raw)

```text
D4-1 CLOSED — AnnotationEditor.test.tsx:203 asserts Enter saves `"x"` without a sentinel, then checks reloaded text.
D4-2 CLOSED — :247–249 assert escaped saved titles and their original values after reload.
D4-3 CLOSED — :231–234 assert entity-only serialization preserves hard breaks and paragraph boundaries. Restoring the fallback fails these assertions.
D4-4 CLOSED — :100 now explicitly allows syntax normalization.
D4-5 CLOSED — :298–339 assert multiline underline serialization, nested mark coverage, and literal text preservation for unrepresentable selections.
D4-8 CLOSED — reader and editor formatting checks now use assertCommentFormatting.

The central repairs have assertions that fail on revert. Vitest’s configured selectors and CI coverage command include these tests. No additional verification defects found.

VERDICT: APPROVED
```

#### lens-records-d5 (raw)

```text
D4-6 CLOSED — d-20261013-17 records all three required changes, consistent with HEAD’s tokenizer, reader and editor. d-20261013-16’s trailer names the replacement.

D4-7 CLOSED — the replacement acknowledges MarkdownManager could share semantics, matching the judgment, and explicitly supersedes the “only option” claim.

No findings. The serialization claims match the implementation and committed test cases.

VERDICT: APPROVED
```

### Underline judgment (focused fresh-context review-plan, after D3-1)

```text
1. **JUDGMENT:** Recommend **(c), with the shared factory owning underline tokenization directly as a native `marked` extension**. Both consumers must call instances created by that factory through `.lexer(source)`, and underline must recursively parse its untrimmed capture through the **active lexer’s** `this.lexer.inlineTokens(...)`. This gives identical delimiter selection, precedence, and nested parsing by construction: `marked` invokes inline extensions before its built-in tokenizers ([marked.esm.js:52](/home/felixb/Projekte/chessfable/node_modules/marked/lib/marked.esm.js:52)), instance `.lexer()` supplies instance defaults ([marked.esm.js:70](/home/felixb/Projekte/chessfable/node_modules/marked/lib/marked.esm.js:70)), and Tiptap uses that method for parsing ([MarkdownManager.ts:291](/home/felixb/Projekte/chessfable/node_modules/@tiptap/markdown/src/MarkdownManager.ts:291)). Retain Tiptap’s underline mark parser and serializer ([underline.ts:64](/home/felixb/Projekte/chessfable/node_modules/@tiptap/extension-underline/src/underline.ts:64)), but suppress its tokenizer registration. Sharing the current callback unchanged is insufficient: Tiptap constructs its helper lexer without instance options and passes that helper into custom tokenizers ([MarkdownManager.ts:70](/home/felixb/Projekte/chessfable/node_modules/@tiptap/markdown/src/MarkdownManager.ts:70), [MarkdownManager.ts:162](/home/felixb/Projekte/chessfable/node_modules/@tiptap/markdown/src/MarkdownManager.ts:162)).

2. **OBLIGATIONS:**

- **Shared production factory**, for example `src/utils/commentMarkdown.ts`: retain `COMMENT_UNDERLINE` from `src/utils/pgnComment.ts`, register its anchored tokenizer exactly once, consume the full match, and recurse through the active lexer. Keep GFM enabled. Disable the existing block tokenizers and `codespan` in this one factory.
- **`AnnotationEditor.tsx`:** create a fresh instance per editor. Preserve the underline mark’s parsing, serialization, controls, and shortcuts, while explicitly suppressing its inherited Markdown tokenizer. Assigning `undefined` does **not** suppress inheritance: `getExtensionField` falls back to the parent when the field is undefined ([getExtensionField.ts:18](/home/felixb/Projekte/chessfable/node_modules/.pnpm/@tiptap+core@3.20.0_@tiptap+pm@3.20.0/node_modules/@tiptap/core/src/helpers/getExtensionField.ts:18)). Verify isolated instances and constant registration counts.
- **`Comment.tsx`:** replace both remark passes and `react-markdown` with a small recursive renderer for the shared token stream. Render strong, emphasis, delete, underline, links, text, paragraphs, and breaks. Preserve the current wrapper’s line rule, link target/rel, and equivalent URL filtering. React text children must carry literal text. Never inject generated HTML.
- **HTML:** disabling `html` alone disables block HTML. Inline `tag` remains active and emits `html` tokens ([marked.esm.js:38](/home/felixb/Projekte/chessfable/node_modules/marked/lib/marked.esm.js:38)). Make recognized inline tags opaque literal text in the shared tokenizer, without HTML lexer-state side effects. No `html` token may reach Tiptap’s HTML conversion path, which calls `generateJSON` ([MarkdownManager.ts:798](/home/felixb/Projekte/chessfable/node_modules/@tiptap/markdown/src/MarkdownManager.ts:798)). Consequently, `<b>x</b>` must remain literal in both views and after editing. Update the fixture currently expecting `**x**!` and explicitly supersede that normalization example in d-20261013-15.
- **Escapes:** preserve distinct escape tokens. The reader renders their decoded character, while a small Tiptap Markdown parse handler creates text from their `raw` value. This preserves the recorded `1\.` display exception without changing lexical decisions. Tiptap otherwise drops an unhandled inline token with no children ([MarkdownManager.ts:649](/home/felixb/Projekte/chessfable/node_modules/@tiptap/markdown/src/MarkdownManager.ts:649)). Do not unescape source before tokenization or reparse decoded text.
- **Tests:** expand `commentDialectCases.ts`, `Comment.test.tsx`, and `AnnotationEditor.test.tsx`. The editor tests must assert loaded formatting as well as saved strings. Compare semantic text and mark coverage, allowing Tiptap’s different DOM nesting and the explicit escape-display exception. Render the saved comment and reload it into the editor.

Required cases include:

| Purpose | Cases and required result |
|---|---|
| D1-2 | `++**x**++`, `++*x*++`, `++~~x~~++`, underlined explicit links, and mixed formatted siblings retain both marks |
| D2-1 | `a++ b ++c`, `++ x++`, `++x ++`, `Qh7++ Kh8 Qg8++ wins` remain literal and preserve spaces after editing |
| D3-1 | `++**a\nb**++`, equivalent emphasis/strike/link-label cases, and blank-line variants retain literal `++` with no underline |
| Parsing boundaries | `++https://x.y/p++`, `**++x++**`, `++**x++**`, repeated pairs, unmatched pairs, `++++`, `+++++` |
| Nested configuration | ``++`x`++`` keeps backticks, `++1\.++` preserves the editor’s backslash, escaped plus delimiters stay literal |
| Existing contract | Every current block/code fixture, autolink literals, strike, raw HTML and the existing `<img ... onerror=...>` test |
| Converter loss | Markdown image syntax and literal `&nbsp;` must not silently disappear |

The final two cases matter because sharing tokenization alone does not prove lossless conversion. Unsupported tokens are discarded by Tiptap, and its paragraph parser treats standalone `&nbsp;` as an empty paragraph.

3. **REJECTED:**

- **(a), source slices in the post-parse pass:** fixes the reported hidden-newline case, but does **not** establish identical semantics. Parsing has already assigned ownership of characters. For `++https://x.y/p++`, GFM’s autolink parser consumes the closing pluses into the URL path, since `+` is neither a terminator nor trailing punctuation ([autolink syntax.js:627](/home/felixb/Projekte/chessfable/node_modules/.pnpm/micromark-extension-gfm-autolink-literal@2.0.0/node_modules/micromark-extension-gfm-autolink-literal/lib/syntax.js:627)). The proposed text-node delimiter check therefore rejects a pair the editor accepts before parsing that URL. Crossing emphasis boundaries causes the same ownership problem. It preserves current HTML, escape, block, and code behavior, but requires source-to-decoded-text mapping because mdast merges text and decodes references ([from-markdown index.js:1070](/home/felixb/Projekte/chessfable/node_modules/.pnpm/mdast-util-from-markdown@2.0.0/node_modules/mdast-util-from-markdown/lib/index.js:1070)). Low initial change cost, continuing mapping and boundary complexity.

- **(b), attention-like micromark/mdast extension:** removes the projection bug, but “same stage” does **not** mean “same semantics.” GFM strikethrough resolves delimiter events, checks matching run sizes, and recursively resolves existing span events ([strikethrough syntax.js:74](/home/felixb/Projekte/chessfable/node_modules/.pnpm/micromark-extension-gfm-strikethrough@2.0.0/node_modules/micromark-extension-gfm-strikethrough/lib/syntax.js:74)). The editor greedily recognizes a source substring before parsing its interior. An attention-style implementation introduces different boundary and precedence behavior. Exact equivalence is possible only by additionally specifying and implementing those behaviors across both parsers. It retains current reader HTML/escape handling and existing block/code configuration, but costs a tokenizer, resolver, mdast bridge, and cross-parser compatibility contract.

- **(d), reuse Tiptap’s complete MarkdownManager in the reader:** can also share conversion semantics, but requires the editor’s extension configuration and another renderer for Tiptap JSON. It retains the manager’s HTML conversion, unknown-token dropping, and paragraph normalization concerns. It offers no simpler underline mechanism than the shared lexer and small token renderer.

4. **RISKS:**

The shared lexer guarantees identical tokenization. The React adapter, Tiptap conversion, toolbar authoring, and serialization still need behavioral proof. In particular, underline controls can mark whitespace or multiline selections that the chosen syntax cannot represent, and serialization must preserve their text.

Moving the reader to `marked` also adopts its emphasis, autolink, entity-text, and paragraph behavior. Formatting inside table-looking prose will now parse consistently with the editor instead of being replaced wholesale with source by the reader. Keep the recorded escape-display exception explicit, and test these compatibility changes.

This judgment is source-traced, confidence **98**. No files were written and no tests were run.

VERDICT: APPROVED
```

### Serializer judgment (focused fresh-context review-plan, after D5-1/D5-2)

```text
1. **JUDGMENT:** **Revise the contract first, then use (c): a small owned dialect serializer with a mandatory semantic check before saving.** The current escape contract prevents a general lossless encoder: [AnnotationEditor.tsx:21](/home/felixb/Projekte/chessfable/src/components/panels/annotation/AnnotationEditor.tsx:21) loads escapes from `token.raw`, whereas [Comment.tsx:10](/home/felixb/Projekte/chessfable/src/components/common/Comment.tsx:10) renders their decoded text. Measured with the production lexer and editor overrides, `a\+\+b++c++` correctly represents literal `a++b` plus underlined `c` in the notation, but introduces visible backslashes on editor reload. Conversely, an unmarked document containing `**x**` serializes as `**x**` and reloads as bold `x`. An owned serializer therefore needs consistent escape decoding first. Thereafter, the construction guarantee is **accepting a save only when the complete saved string, parsed by the production adapters, equals the intended text and mark coverage, including link attributes**. Balanced delimiters alone are insufficient, and a mismatch is not proof that a mark is unrepresentable.

2. **OBLIGATIONS:**

- **Define one semantic text contract.** Amend O2 and explicitly supersede the relevant wording of d-20261013-16/17. Decide how imported backslash escapes map to editor text before introducing serializer escapes. The existing fixture deliberately expects different reader/editor text at [commentDialectCases.ts:34](/home/felixb/Projekte/chessfable/src/components/common/tests/commentDialectCases.ts:34). That exception cannot coexist with the literal invariant posed here.

- **Own serialization in a focused utility**, alongside `commentMarkdown.ts`. Handle only paragraphs, hard breaks, text, and the five supported marks. Escape literal syntax independently of formatting. Compare links by `(href, title)`, use actual runs rather than placeholder-derived delimiters, and close/reopen marks when necessary to maintain balanced nesting. Preserve literal entities, HTML and image syntax under the existing shared lexer.

- **Specify permitted mark loss independently of serializer output.** Preserve every expressible mark. Drop only coverage that the dialect demonstrably cannot represent, preserving its text. Do not classify “the first serialization failed” as unrepresentability. Do not blanket-trim underline whitespace: the production lexer accepts `++[ x ](https://a.test)++` with underline and link covering both spaces. Likewise, escaped pluses can be represented inside underline once escape decoding is consistent.

- **Gate the actual save boundary** at [AnnotationEditor.tsx:169](/home/felixb/Projekte/chessfable/src/components/panels/annotation/AnnotationEditor.tsx:169). Flatten the editor document and reparsed output into comparable text/boundaries and mark coverage, ignoring node segmentation and mark nesting order. Compare `href` and `title` exactly. Use the production editor parser and reader semantics, rather than treating token equality as sufficient. A failed check must prevent the write, preserve the draft, and report a serialization failure. It must not silently remove otherwise expressible formatting.

- **Use the same serializer for synchronization comparisons.** The effect currently compares `editor.getMarkdown()` against stored text at [AnnotationEditor.tsx:186](/home/felixb/Projekte/chessfable/src/components/panels/annotation/AnnotationEditor.tsx:186). Replacing only `onUpdate` would leave that effect able to reload a differently serialized comment and reset selection.

- **Add property-style round-trip tests** in the serializer tests, plus mounted save/reload tests in `AnnotationEditor.test.tsx`. Generate short text containing delimiter runs, punctuation, whitespace, soft/hard breaks, backslashes, entities and URLs. Generate overlapping mark layouts, adjacent links with different destinations or titles, and equivalent documents split into different text nodes. Assert exact text and per-position mark coverage against an independently defined expected document. Require full preservation for known expressible layouts, and exact, documented degradation for unrepresentable coverage.

  Include explicit seeds for D4-5’s authored whitespace/newline underline, D5-1’s literal `a++b` followed by underlined `c`, and D5-2’s adjacent differently attributed links. Also include unmarked `**x**`, removing a URL’s link, escaped delimiters, whitespace-only selections, and linked whitespace under underline. The current formatting helper strips whitespace at [assertCommentFormatting.ts:22](/home/felixb/Projekte/chessfable/src/components/common/tests/assertCommentFormatting.ts:22), so it cannot serve as this oracle.

3. **REJECTED:**

| Option | Construction guarantee and user-visible result | Cost and failure modes |
|---|---|---|
| **(a) Continue per-case fixes** | **No.** Underline is checked in isolation at [AnnotationEditor.tsx:147](/home/felixb/Projekte/chessfable/src/components/panels/annotation/AnnotationEditor.tsx:147). Tiptap’s boundary helpers compare mark types, not attributes at [utils.ts:34](/home/felixb/Projekte/chessfable/node_modules/@tiptap/markdown/src/utils.ts:34) and [utils.ts:50](/home/felixb/Projekte/chessfable/node_modules/@tiptap/markdown/src/utils.ts:50). Fixing those witnesses establishes no general preservation rule. Users remain exposed to text changes, moved marks and wrong links. | Low initial cost, continuing case discovery. Escaping, overlapping marks and delimiter precedence remain separate failure classes. |
| **(b) Guard, then drop offending marks, ultimately plain text** | **Not as proposed.** A guard detects corruption, but dropping links in D5-2 discards expressible formatting. “Plain text” is still parsed as Markdown: measured unmarked `**x**` loses its stars, and an unlinked URL regains a link. | Moderate cost once it needs a reliable literal-text encoder and principled representability rules. Risks include excessive degradation and a fallback that also fails its check. |
| **(c) Owned serializer with only balanced runs or test-only checking** | **Insufficient alone.** Marked’s emphasis rules are context-sensitive, and underline runs before built-in inline parsing at [marked.esm.js:52](/home/felixb/Projekte/chessfable/node_modules/marked/lib/marked.esm.js:52). Use the corrected version recommended above. Users retain text and expressible marks, with only explicitly permitted losses. | Moderate, bounded implementation cost and responsibility for the dialect. A faulty comparator remains a risk, which is why adapter-level tests matter. |
| **(d) Remove underline authoring** | **No.** It leaves link-boundary and literal-text failures. Removing the schema mark would additionally lose existing underline formatting. Keeping its parser but removing the control preserves old files, yet changes the authoring capability expressly retained by O2 and d-20261013-09. | Small code change, incompatible behavior change. Removing just the button also leaves `Mod-U`, whose implementation is at [underline.ts:119](/home/felixb/Projekte/chessfable/node_modules/@tiptap/extension-underline/src/underline.ts:119). |
| **(e) Add only a fail-closed guard** | Guarantees that an incorrect candidate is never written, **but does not provide a working save for every supported document**. Users encounter failed saves instead of corruption. | Smallest containment measure. Appropriate during repair, insufficient as the completed serializer mechanism. |

4. **RISKS:**

The central risk is confusing a serializer defect with dialect unrepresentability. That turns the guard into an automatic formatting-loss policy. Escapes, paragraph normalization and mark coverage on whitespace/breaks need explicit semantics before the comparator can judge correctly.

Changing escape decoding alters an intentionally recorded editor behavior. Preserve the decision history and document the supersession. Do not hide that change inside a serializer repair.

Read-only probes reproduced D5-1, D5-2, the literal-text fallback failure and the escape mismatch. No files were written and no test suite was run.

VERDICT: REVISE
```
