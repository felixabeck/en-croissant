# Plan-review and diff-review history — Files page file card (`f-20260905-14`, `f-20260910-06`)

Build run of 2026-09-19, orchestrator Claude Code (Fable), executor `claude` for every leaf. The plan
itself lives under the git-ignored `tasks/plans/` and may disappear; this record carries the full
review history. No successor mandate was split off: `f-20260919-07` (type editing needs a native
metadata command) was filed from the locate stage as an independent finding and inherits no issue.

Disclosure: the same context wrote the plan, arbitrated every finding and wrote the post-review
repairs. Phases 1–3 were written by Claude leaves (`claude-opus-5`/low) and reviewed by Claude
lenses — same model family, so detection was session-separated, not family-separated. The
orchestrator-written repairs were reviewed by the same lenses.

## Plan review (verbatim from the plan's `## Reviews`)

### Round 1 — r1 snapshot `/tmp/build-4e832c0a/plan-r1.md`, executor claude, wall 243s incl. triage and two probes (no waits)

Raw verdicts: review-plan APPROVED · review-minimalism REVISE · review-root-cause APPROVED ·
review-correctness APPROVED · review-tests REVISE · review-code-quality APPROVED. Raw reports:
`/tmp/build-4e832c0a/lens-{plan,minimalism,root-cause,correctness,tests,code-quality}.txt` (round-1 copies kept as `*.r1.txt`).
All six reported that reads outside their worktree (the probe script, the screenshot, `~/.claude/references`) were denied; they judged the measured facts as quoted.

| ID | Claim | Witnesses (rank, conf.) | Disposition | Correction (r2) | Mandate obligation / evidence |
|---|---|---|---|---|---|
| PR-01 | O4's overflow assertion is never seen red | tests (blocker, 88) | Fix | O4 "Staged red": page temporarily at pre-fix content, container run, restore proven | f-20260910-06 proof + push-review-policy §2 |
| PR-02 | Overflow is checked only with a dialog open and no file selected; the new card column is never at 320px | tests (blocker, 85) | Fix | O4 file-selected 320px scenario in `async-errors` (config read: `database-files` is 800px) | f-20260910-06 "controls and content fit" |
| PR-03 | verify:app check "row rendered" never staged red | plan (should-fix, 80), tests (should-fix, 80) | Fix | O5: recorded as argued-not-staged with the policy's first unstageable class; unique message | push-review-policy §2 fourth condition |
| PR-04 | Re-deriving `selected` gives FileCard a new object per refresh → page reset + re-read | plan (should-fix, 82), correctness (should-fix, 82) | Fix | O2 "Card identity is the handle key"; `games` becomes card state; O6 tests | f-20260905-14 "game list with paging" must survive a refresh |
| PR-05 | Handle-id stability across rename was unmeasured | correctness (should-fix, 72) | Fix | measured fact 4 (same id before/after a real rename) | O2 selection freshness |
| PR-06 | O5 copies ~100 lines of seed/close sequence | minimalism (should-fix, 83) | Fix | O5 folds into the existing seed session and `entries` array | verification work, smaller |
| PR-07 | Dead-code deletions are outside MANDATE and touch the other session's file | minimalism (should-fix, 85), correctness, code-quality (nit, 80), root-cause (nit, 80), plan (scope note) | Fix | moved out of the phases into "Along the way" (rule 4b own commit, not acceptance) | none — hence not acceptance |
| PR-08 | `Session.actions()` rationale wrong, `call` is public | minimalism (nit, 80) | Fix | O5 uses `Session.call`; `app-driver.mjs` and its tests leave the plan | — |
| PR-09 | O4 misquotes the spec comment; comment goes stale | code-quality (should-fix, 90) | Fix | O4 quotes `:123-124` exactly and deletes it | — |
| PR-10 | Neighbour's column Stack has `overflow: hidden`, O4 forbids it | code-quality (should-fix, 85) | Fix | O2 last bullet | f-20260910-06 "Do not hide overflow" |
| PR-11 | `Files.EditMetadata` key left without a user | code-quality (should-fix, 80), plan (limitation, 50) | Fix | O2 FileCard bullet | — |
| PR-12 | Directory pane, NoSelection, filter toggle-clear lack a mandate reason | code-quality (should-fix, 80), correctness, root-cause, minimalism (limitation 65) | Fix (reason stated, behaviour kept) | O2 bullet citing upstream's three right-column states; O3 reason + test | "restore the two-column layout" = upstream's column; a filter needs a way back |
| PR-13 | No test for filter toggle-clear | tests (should-fix, 80) | Fix | O6 | O3 |
| PR-14 | 60 ms click gap as bare literal | code-quality (nit, 80) | Fix | O5 named constant | — |
| PR-15 | `games`-cleared test couples to internals | tests (nit, 65) | below threshold; dissolved by PR-04 | — | — |
| PR-16 | No assertion that the Edit-metadata control is gone | tests (nit, 60) | below threshold; adopted anyway (one line) | O6 FileCard test | D3 |
| PR-17 | D3 (icon removal) is a visible scope change to be marked | root-cause (nit, 80) | Skip — already marked under "Decided autonomously" | — | — |

plan_adopted r1=15. Unique issues opened 17, resolved-pending-closure 15, skipped 1, below-threshold 1.

### Round 2 — r2 snapshot `/tmp/build-4e832c0a/plan-r2.md`, wall 135s incl. triage (no waits)

Raw verdicts: review-plan APPROVED · review-minimalism APPROVED · review-root-cause APPROVED ·
review-correctness APPROVED · review-tests REVISE · review-code-quality APPROVED. Raw reports kept as
`/tmp/build-4e832c0a/lens-*.r2.txt`. Closure results reported by the witnessing lenses: PR-01, PR-02, PR-04–PR-14 CLOSED.

| ID | Claim | Witnesses | Disposition | Correction (r3) |
|---|---|---|---|---|
| PR-03 | STILL OPEN — check (1) is stageable: the release binary is an owned input | plan (82), tests (should-fix, 80) | Fix | O5: staged via a temporary no-tree renderer build at the end of phase 2; "argued" label withdrawn |
| PR-18 | O4's staged red of the file-selected scenario would fail on a card locator, not on the overflow message (correction-introduced by PR-01/PR-02) | plan (should-fix, 80), correctness (should-fix), tests (should-fix) | Fix | O4: overflow assertion ordered before any card-dependent wait; stated why |
| PR-19 | Phase-1 proof impossible as written: a throwing `waitFor` aborts the run and skips later checks; navigation kind unspecified vs. the retained-reservation check | plan (should-fix, 80) | Fix | O5 "Harness contract": checks never throw, in-app navigation only, pre-existing checks stay green |
| PR-20 | The new 320px PNG is not in the review list (correction-introduced by PR-02) | correctness (should-fix), tests (should-fix), code-quality (should-fix) | Fix | Phase 3: all five images reviewed |
| PR-21 | `overflow: hidden` is at `DatabasesPage.tsx:199`, outside the cited range | code-quality (nit, 85) | Fix | O2 cites `:199` |

plan_adopted r2=5. Open after r2 triage: PR-03, PR-18, PR-19, PR-20, PR-21 (closure pending r3). Handle-id stability across a *move* is unmeasured (plan lens, limitation 60): accepted — a changed id clears the selection, which is correct behaviour.

### Round 3 — r3 snapshot `/tmp/build-4e832c0a/plan-r3.md`, lenses plan/correctness/tests/code-quality, wall 91s incl. triage (no waits)

Raw verdicts: review-plan REVISE · review-correctness APPROVED · review-tests APPROVED ·
review-code-quality APPROVED. Raw reports `/tmp/build-4e832c0a/lens-*.r3.txt`. Closure results: PR-03 CLOSED (tests;
plan "closed in design", execution defect → PR-22) · PR-18 CLOSED (plan, correctness, tests) · PR-19
CLOSED (plan) · PR-20 CLOSED (correctness, tests, code-quality) · PR-21 CLOSED (plan, code-quality).

| ID | Claim | Witnesses | Disposition | Correction (r4) |
|---|---|---|---|---|
| PR-22 | Staging check (1) "at the end of phase 2" restores from `HEAD` before phase 2 is committed → erases the fix (correction-introduced by PR-03) | plan (blocker, 85) | Fix | O5 + phase 2: staging runs after phase 2's commit, by the orchestrator, record as a one-file follow-up commit |
| PR-23 | Nav click and `POST /actions` sit outside the never-throw contract | plan (nit, 72) | below threshold; adopted (same contract sentence) | O5 harness contract |
| PR-24 | `verify-app.mjs` header says "nine things"; plan never extends the list | code-quality (should-fix, 82) | Fix | O5: item 10 + count |
| PR-25 | The new PNG is never named | code-quality (nit, 60) | below threshold; adopted | O6 names it |

plan_adopted r3=4. Open after r3 triage: PR-22, PR-24 (closure pending r4); PR-23, PR-25 adopted below threshold.

### Round 4 — r4 snapshot `/tmp/build-4e832c0a/plan-r4.md`, lenses plan/code-quality, wall 51s (no waits)

Raw verdicts: review-plan APPROVED · review-code-quality APPROVED. Closure: PR-22 CLOSED (plan) ·
PR-23 CLOSED (plan) · PR-24 CLOSED (code-quality) · PR-25 CLOSED on substance (code-quality), with
one readability nit (conf. 80) on the O6 sentence naming the new PNG: adopted as a wording-only
reorder after the round — it changes no behaviour, file, proof or ownership, so under rule 12a it
needs no further lens (arbiter's reason recorded here).

plan_adopted_per_round: r1=15 r2=5 r3=4 r4=1. Unique issues opened 26 (PR-01…PR-25 + the r4 wording
nit), closed 24, skipped 1 (PR-17), dissolved 1 (PR-15); open 0. Correction-introduced: PR-18 and
PR-20 (from PR-01/02), PR-22 (from PR-03). No rewrite, no split. Review wall time r1–r4: 547s,
no quota/dependency waits. Final raw verdicts per lens at their last run: plan APPROVED (r4),
minimalism APPROVED (r2), root-cause APPROVED (r2), correctness APPROVED (r3), tests APPROVED (r3),
code-quality APPROVED (r4). Orchestrator: APPROVED.

**State: plan frozen at r4+wording. PAUSED before phase 0 on Felix's instruction (another session
holds uncommitted work in the Files area). Open precondition: snapshot-refresh deny (see Risks).**

### Phase 0 — re-anchor on `b2b84ed3` (2026-09-19, after Felix's "go")

Tree clean, `HEAD` = `origin/master`. The other session landed `c21d71b1` (Move icon; moved
`confirmation-error-async-errors.png` and `database-files-database-files.png`) and `cb9d3c30`
(`IconAction` text child is a compile error). Re-checked: `FilesPage.tsx:118/169-187/231-232`,
`DirectoryTree.tsx:21/94/188`, `e2e/async-errors.spec.ts:123-124`, `DatabasesPage.tsx:199` — all
unchanged. No obligation altered → no review round.

## Cumulative diff review (after phase 3, range `b2b84ed3..HEAD` plus the uncommitted e2e edits)

Raw verdicts: review-correctness APPROVED · review-root-cause APPROVED · review-tests REVISE ·
review-code-quality APPROVED · review-minimalism APPROVED · review-persisted-state APPROVED.

| ID | Finding | Lens (rank, conf.) | Verdict | Where fixed |
|---|---|---|---|---|
| DR-01 | The 320px screenshot never shows the card: the page scrolls in its own container, `fullPage` is one screen | tests (should-fix, 88) | Fix | scenario enlarges the window to 320x3200 before the capture |
| DR-02 | `assertNoClippedAncestor` misses clipping inside controls (placeholder cut to "Date", nowrap button labels) | tests (should-fix, 82) | Fix | `assertNothingClipped` inspects every descendant of both columns (ellipsis exempt); the Select placeholder became a label; it then found real clipping in `FileCard` (header `Group grow`, preview move list), fixed in `1eee6218` |
| DR-03 | `database-files` overflow assertion has no staged red | tests (nit, 80) | Skip — false positive: the assertion predates this change (context line in the diff) | — |
| DR-04 | `selectedEntry` with a setter named `setSelected` | code-quality (should-fix, 85) | Fix | `1eee6218` |
| DR-05 | Folder entry count not locale-formatted, no plural | code-quality (should-fix, 80) | Fix (formatNumber); plural Skip — "Entries: {{number}}" is a label form that needs none | `1eee6218` |
| DR-06 | Bare size literals next to a named one | code-quality (nit, 80) | Fix | `1eee6218` |
| DR-07 | Missing blank line after the e2e helper | code-quality (nit, 80) | Fix | formatter / helper moved to fixtures |
| DR-08 | `FILE_TYPES` duplicated in FilesPage and ImportModal | minimalism (should-fix, 88) | Fix | extracted to `files/file.ts`, `1eee6218` |
| DR-09 | FileCard resets itself in an effect although the parent's `key` remounts it | minimalism (should-fix, 80) | Fix | effect removed, `1eee6218` |
| DR-10 | Row-selection lines duplicated in two specs | minimalism (nit, 80) | Fix | `selectFilesTreeRow` in `e2e/fixtures.ts` |
| DR-11 | A vanished selection can return when the handle id reappears (Undo from trash) | correctness (nit, 60) | below threshold; not adopted | — |
| DR-12 | At 320px the centre of a wrapped row is an icon button | root-cause (nit, 60) | below threshold; not adopted | — |

Closing pass over the repairs (`409a6378..` plus e2e): review-correctness APPROVED ·
review-tests APPROVED · review-pgn-index APPROVED (ImportModal touched).

| ID | Finding | Lens | Verdict | Where fixed |
|---|---|---|---|---|
| DR-13 | The two-column card at 800px / 200% is only checked for document width | tests (should-fix, 80) | Fix | `assertFilesColumnsNotClipped` in `database-files`; it found the preview's move list at 62px for 74px of content; the card now switches on its own width in rem (last `fix(files)` commit) |
| DR-14 | The clipping check ran at 320x720, the picture is 320x3200 | tests (nit, 65) | below threshold; adopted | assertion repeated after the resize |

Defects found by executing the proofs rather than by a lens: the first two-column layout overlapped
its columns at a 200% font scale (container e2e could not click a row), and the document-width
assertion was being satisfied by the page's own scroll container absorbing 213px of content in a
108px column. Both fixed in `409a6378`.
