# Rule history

History, rationale and dated state moved from `CLAUDE.md` on 2026-10-11. Operative rules and their delivery remain in the homes recorded in `tasks/handoffs/2026-10-11-context-trim-rule-map.md`. Quotations preserve the original wording apart from wrapping. Historical claims do not override the current rules.

## CLAUDE.md — Identity

From `CLAUDE.md` → project identity, this rationale describes learning from En Croissant's upstream history.

> Upstream history is the error history this project learns from;

## CLAUDE.md — Layout

From `CLAUDE.md` → Layout, this provenance describes the backend and frontend audit plans and the tooling they produced.

> `BACKEND_AUDIT_PLAN.md` and `FRONTEND_AUDIT_PLAN.md` are the wave-structured audit plans that produced most of the current tooling;

## CLAUDE.md — Domain rules

From `CLAUDE.md` → Domain rules, “These” names `.claude/rules/*.md` and “below” refers to the Review lenses table retained in the root context.

> These carry the write-time invariants of this codebase: the facts that stop the defect from being written, as opposed to the review lenses below, which catch it afterwards. Each file states one rule and the incidents that produced it.

## CLAUDE.md — Gates

From `CLAUDE.md` → Gates → coverage ratchets, “before that” means before the shrink allowance described in `docs/coverage.md`, and “it” is the dead code the old ratchet discouraged deleting.

> — before that, removing one provably dead branch reddened the gate and the cheapest way to stay green was to leave dead code in place (`f-20260829-15`, `d-20260829-03`).

From `CLAUDE.md` → Gates → frontend mutation, these dated measurements describe the frontend-mutation lane's memory sizing, sequential packages and timings on tuxedo-atlas, including the all-blocks push runs.

> inside the `agent-gate` scope (28 GiB `memory.max` on tuxedo-atlas, a 27 GiB budget after the reserve) one package at a time with 21 Stryker runners. Measured 2026-10-02 as the last lane of an all-blocks `pnpm gates:push` on `c49a852c`: 346.9 s for the mutation lane and 444 s for the whole gate, the three packages strictly sequential, with no observed OOM event and no swap use, under load average 14.9 / 19.8 / 21.0 at start. The scope's `memory.peak` reached `memory.max` because it includes page cache (post-exit split 0.75 MB anonymous against 8.48 GB file); a second run that day took 382.3 s and 481 s.

From `CLAUDE.md` → Gates → backend mutation, this runtime rationale explains keeping the eight backend packages outside test.yml and local push gates.

> A single sequential backend run is slow enough to crowd GitHub's 6-hour per-job limit,

## CLAUDE.md — Review lenses

From `CLAUDE.md` → Review lenses, the ChessFable-specific lenses in `.claude/agents/` carry the codebase's failure history.

> carry this codebase's failure history:

## CLAUDE.md — Findings ledger

From `CLAUDE.md` → Findings ledger → vendored findings.py, this date describes the stamp exception to kit byte-parity and replacement of the former parity-test mesh.

> (since 2026-09-02; the former parity-test mesh is gone)

## CLAUDE.md — Multi-agent coordination

From `CLAUDE.md` → Multi-agent coordination → gate scope, this explains splitting per-commit pre-review checks from the once-per-task full affected gate set.

> because the full set is slow enough that running it per commit is not practical.

## CLAUDE.md — Verifying UI changes

From `CLAUDE.md` → Verifying UI changes, “this” refers to treating Chrome MCP or a Vite-only browser as proof for the Tauri app, a recurring verification mistake.

> The short version, because getting this wrong is the recurring mistake:

From `CLAUDE.md` → Verifying UI changes → daily desktop app, this dates the measurement that resources beside the installed binary are not found and Tauri requires the bin/ plus lib/ChessFable/ layout.

> (measured 2026-09-05)

From `CLAUDE.md` → Verifying UI changes → desktop-entry identity, this incident describes naming the entry after productName instead of mainBinaryName, which left a duplicate entry and split the taskbar icon.

> Naming the entry after `productName` between 2026-09-07 and 2026-09-10 published a second entry beside the older one and split the taskbar icon (`f-20260910-01`).

## CLAUDE.md — Repository state

From `CLAUDE.md` → Repository state, this is the original snapshot heading. The dated material below is historical, with operative cautions retained in the root context.

> ## Repository state (as of 2026-08-30; later updates are dated inline)

From `CLAUDE.md` → Repository state, this describes the committed audit implementation and branch relationships at the recorded snapshot date.

> The audit implementation is committed; `master` tracks `origin/master` and is well ahead of `upstream/master`. Work here is a side project, picked up in bursts.

From `CLAUDE.md` → Repository state → commit-count caution, “it” names an exact commit count or an in-sync claim that becomes stale after a commit.

> — it is wrong the moment anything is committed, and it was.

From `CLAUDE.md` → Repository state, “this machine” means tuxedo-atlas, and the listed green gates are measurements from the recorded 2026-08-29 snapshot.

> The working checkout is on **`tuxedo-atlas`** (cloned 2026-08-29 from `felixabeck/en-croissant` over SSH; commits are ssh-signed). Measured green on this machine: `pnpm test`, `cargo test` (338), `pnpm lint:ci`, `pnpm bindings:check`, both boundary checks, `pnpm bundle:check`, `pnpm build` (Tauri release, `--no-bundle`), and — since the toolchain was completed on 2026-08-29 — `pnpm test:coverage:backend`.

From `CLAUDE.md` → Repository state, this introduces the historical snapshot list. As of 2026-10-11, the listed layout and App.tsx findings f-20260829-02 and f-20260829-03 are handled.

> What is **not** settled, all of it filed in `tasks/findings.md` rather than only described here:

From `CLAUDE.md` → Repository state → ratchet disagreement, “They” names the two coverage ratchets, “here” means tuxedo-atlas, and “runner” means CI. This records the former machine-measurement diagnosis and missing recursive-delete test.

> - **Both coverage ratchets are green again, and only one of them was a stale instrument.** They looked like one problem under the root `machine-dependent-measurement` and were two. The frontend (`f-20260829-06`) really was a baseline describing a machine nobody uses, and was re-recorded from CI under `d-20260829-02`. The backend (`f-20260829-01`) was a **missing test wearing the same symptoms**: the entire atlas-versus-runner gap was three branch records in `remove_tree_at`'s directory walk, which no test drove deliberately — it was reached only as a side effect of other tests' workspace cleanup, 21 times here and once on the runner. Asserting the descent (`f-20260830-01`) made all six areas measure *identically* in both environments, with no baseline touched.

From `CLAUDE.md` → Repository state → never rewrite a red ratchet baseline, this explains why the runner's former floor of 744 would have removed recursive-delete enforcement.

> — lowering the backend floor to the runner's 744 would have permanently retired the only enforcement of a recursive delete that guards against directory traversal.

From `CLAUDE.md` → Repository state → ratchet guard mechanisms, these settings describe host-snapshot and force-push protection alongside the operative baseline writer guard retained under Standing cautions.

> `.claude/settings.json` denies direct host `playwright … --update-snapshots` and force-push command forms.

From `CLAUDE.md` → Repository state → snapshot and secret-file guards, container snapshot re-recording remains governed by the canonical verify-ui skill. “These” names the settings deny forms, coverage baseline writer and secret-file hook, whose defenses do not replace the rules.

> Re-recording inside the pinned container is open to every agent under the rule in `.claude/skills/verify-ui/SKILL.md` (`d-20260919-13`). The user-wide guards `~/.claude/hooks/block-secret-file-access.py` (Bash, Claude and Codex) and `~/.claude/hooks/restrict-file-access.py` (file tools) protect secret-file access in every repository (`agent-kit` decision `d-20261013-14`). These are defense-in-depth guards: the rule is what binds, and a determined invocation can phrase a command differently.

From `CLAUDE.md` → Repository state → mutation evidence, “this tree” is the checkout measured on the listed dates. The green scores and first-red-package behavior describe that dated tooling snapshot.

> - **Mutation testing now has valid evidence on this tree for the first time** (`f-20260829-05`, handled), after the pinned tooling was installed on atlas on 2026-08-29. The **backend is green**: all eight packages, 324 mutants, 305 caught, 9 timeouts, 10 unviable, **0 survivors**. The **frontend is green** as of 2026-09-30: all three packages at a 100 % score in the final push-gate run of the gate-parallelism change. The first red package now terminates its running siblings and starts no queued package, so a red package still hides the others' results until it is fixed.

From `CLAUDE.md` → Repository state → layout clipping and App.tsx coverage, these are stale historical claims. As of 2026-10-11, f-20260829-02 and f-20260829-03 are handled in tasks/findings.md.

> - **The 320px / 200% font-scale layout is broken** — `f-20260829-02`. The committed screenshots record the clipping rather than contradict it. - **`src/App.tsx` is untested** (0 of 67 lines) — `f-20260829-03`.

From `CLAUDE.md` → Repository state → e2e measurement, “that image” is the pinned Playwright container. This records the former atlas-only glyph-antialiasing failure and decision d-20260829-01.

> E2E runs go through `pnpm test:e2e:container`, inside the pinned Playwright image — the reasoning is `d-20260829-01` in `tasks/decisions.md`. The committed snapshots already match what that image renders (8/8 green there on 2026-08-29, none rewritten); it is the *native* run on atlas that fails, on glyph antialiasing alone.

From `CLAUDE.md` → Repository state → CI measurement, this names run 33298305678 and the workflow inventory recorded in that snapshot.

> CI on the fork is green end to end as of run 33298305678 (2026-08-30) — linter, both boundary checks, both coverage ratchets, bindings, bundle budgets, container e2e, and `mutation:frontend`. The current test workflow additionally runs routing, skills, tool-parity, workflow-permission, hook-lint and findings-ledger validation.

From `CLAUDE.md` → Repository state → audit provenance, this names the producer of the 2026-08-09 audit, whose unreviewed status stays operative under Standing cautions.

> the 2026-08-09 audit was produced by a Gemini-driven agent run

From `CLAUDE.md` → Repository state → audit coverage ratchets, “above” refers to the ratchet diagnosis and repair history quoted earlier in this history section.

> The two coverage ratchets it once reddened are green again, for the reasons recorded above.
