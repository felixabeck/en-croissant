# 2026-09-19 — Windows CI repair: plan and review history

Durable copy of the plan and its complete `## Reviews` history for the interactive run that repaired
seventeen red `Test` runs (findings f-20260918-03, f-20260919-04, f-20260919-05; decision
d-20260919-10; successors f-20260919-06 and the agent-kit drain finding). Push review: seven Claude
lenses APPROVED on 87c0f5ad..5284874d, one security closure APPROVED on 5bf8e48c; orchestrator and
lenses were both Claude, so model separation was absent. Runner proof: run 35424524326.

---


MANDATE (Felix, fixed): "There are many runs that were not successful. Investigate this carefully
and fix this." Executor: Claude. **Implementation starts only when Felix says the drain is done.**

## Context

All 17 failed mails (e0ec710 … 48c1df2, 2026-09-18 22:46 → 09-19 06:13) are the **same job**:
`rust-windows-test` (twice also Windows clippy, already repaired by `4a79314`). Linux, macOS,
frontend, e2e, mutation are green in every one of them. Measured from the job logs
(`gh api …/actions/jobs/<id>/logs`), latest run 35419821731: `697 passed; 18 failed`.

Three independent failure classes, introduced by three drain clusters, none fixed since:

| # | Since | Tests | Root cause |
| - | --- | --- | --- |
| A | `d9c538a` (f-20260905-06, OwnedStagingDir) | 16: 9× `infra::fs::tests::owned_staging_dir_*`, 7× `fs::tests::extract_{zip,tar}_*` | `open_parent_directory` (`src-tauri/src/infra/fs.rs:4763`) opens `".."` relative to a handle. On Windows `open_directory_at` → `open_windows_child` → `single_leaf` → `windows_component_refusal` refuses a name ending in `.` before any syscall (and NT relative opens have no `..`). `OwnedStagingDir::adopt` — the only production caller — can **never** succeed on Windows. **Production defect**: zip/tar engine install (`src-tauri/src/fs.rs:1477`, `:1537`) fails on Windows. |
| B | `4403420` (f-20260917-13) | `path_authority::portable_tests::ensure_app_owned_default_dir_creates_each_root_under_its_own_leaf` | Test-only. Production and `for_test` both canonicalise via `AppDataDir::acquire_canonical` (`\\?\C:\Users\runneradmin\…`); the assertion compares against the raw 8.3 tempdir spelling (`RUNNER~1`). Same class as `8932aea`. |
| C | `e0ec710` (f-20260917-04) | `search_index_mapping_gate_external_mapper_fails_once_with_user_mapped_file` | Wrong, never-measured premise (rule 12b). The replace is `FILE_RENAME_POSIX_SEMANTICS \| REPLACE_IF_EXISTS` (`infra/fs.rs:2503`); the runner measured `Ok(DurableCommit)` on every run. Filed as **f-20260918-03** (open). The delete path (`unlink_posix`, `infra/fs.rs:2686`, `FILE_DISPOSITION_POSIX_SEMANTICS`) rests on the same premise and has **no** Windows external-mapper test at all. |

Why there are *many* mails: a drain is running and `$push` ends at "HEAD == @{u}". Neither the
shared `push-review-policy.md` §8 nor the project skill ever reads the remote CI result, and Windows
tests cannot run locally, so each cluster pushed onto an already-red master. Classes A and B were
never filed.

## Constraints while executing

- Start only after Felix confirms the drain finished; then rebase nothing — work on current master.
  If a drain is nevertheless live, use a `git worktree` and the findings inbox spool.
- **For every `#[cfg(windows)]` line the runner is the ONLY proof.** Local `cargo test` on Linux
  compiles none of it; the Windows cross-target clippy (`d-20260916-07`) proves compile/lint only.
  `test.yml` triggers on push to `*`; the Windows job takes ≈5 min.
- Route (rule 6b): inline + lenses at `$push`. Read `.claude/rules/pgn-scanning.md` before editing
  `db/search_index.rs` (path-scoped rule; content is not about mmap, but it binds the area).

## Changes

### 1. Class A — reuse the existing verified-parent open (`src-tauri/src/infra/fs.rs`)
- `adopt` already holds `temp.path()`. Windows arm of `adopt`: replace
  `open_parent_directory(&child)` with the existing
  `win::open_verified_parent(temp.path(), identity, true, ParentAccess::Writable)`
  (`infra/fs.rs:3052`; one caller today, `open_writable_verified_directory` :3082; it returns
  `(parent, leaf)` — take the parent, keep `adopt`'s own shared `leaf` binding): no-follow component walk of the parent with per-component reparse refusal, then the leaf
  under that parent must carry the child's identity. **No new Win32 API.**
- `open_parent_directory`, `OPEN_PARENT_CHILD_IDENTITY_HOOK`, `set_open_parent_child_identity_hook`
  **and `parent_child_mismatch`** (its only caller, :4775/:4796/:4806) become `#[cfg(unix)]`; the
  `".."` arm is unimplementable on Windows. Delete `open_parent_refused`. After the edit, grep every
  helper in this block for a remaining Windows caller — Windows `dead_code` under `-D warnings` is
  the class that already reddened Windows clippy twice; the cross-target clippy is its local proof.
- Why a pathname open is acceptable here although `d-20260918-18` rejected use-time
  canonicalisation: nothing is canonicalised or trusted from the string. Authority is identity —
  NTFS file ids are unique per volume and every component refuses reparse points — so a swapped
  path ends in `Conflict`, never in redirection (fail-closed). After adopt, everything is relative
  to the held parent handle, as on unix. State this in the `OwnedStagingDir` doc comment, which
  today claims path-freedom for all platforms.
- Tests (the new arm must be exercised, not assumed):
  - `owned_staging_dir_open_parent_refuses_when_child_identity_does_not_match` (:9091, ungated
    today) **gains `#[cfg(unix)]`** — it calls the two now-unix-only items and would otherwise not
    compile on Windows; add a `#[cfg(windows)]` sibling calling `win::open_verified_parent` with each substituted
    identity half and asserting the fixed `Conflict`.
  - Un-gate `owned_staging_dir_parent_path_swap_cannot_redirect_install` (:9072). On Windows the OS
    may refuse renaming a parent with a held descendant handle — unmeasured, so the Windows arm
    accepts exactly two outcomes: rename refused (swap impossible; assert install lands under the
    original parent) or rename succeeded (assert install lands under `moved`, swapped dir empty).
    Redirection into the swapped-in directory fails both.
  - The planted-symlink walk test (:9171) stays `cfg(unix)`: it exercises
    `ensure_owned_staging_walk` → `open_windows_child`'s reparse refusal, which this change does not
    touch and which the junction tests in `path_authority` `windows_tests` (`mklink_junction`,
    mod.rs:114/:223/:367/:463) already run on the stock runner.

### 2. Class B — `src-tauri/src/infra/path_authority/mod.rs:8124`
`assert_eq!(created.path(), canonical_binding(&dir.path().join(leaf))?)` — reuse the existing
helper (`mod.rs:1859`), exactly as `8932aea` did. Not tautological: leaf stays a verbatim literal.

### 3. Class C — `src-tauri/src/db/search_index.rs` (closes f-20260918-03)
- Replace: rewrite the test to pin what protects a reader — unleased external `Mmap` held,
  generation returns `Ok`, exactly one `TempfileCreate` attempt, the mapping still reads the **old**
  bytes, the leaf holds the **new** bytes. Drop `#[cfg(windows)]` (property holds everywhere; gives a
  local backstop) and rename the test.
- Delete (same premise, same file — handled now, rule 4b): add the sibling measurement test for
  `remove_entry_at` of the sidecar under an unleased external mapping. Expected by the same
  POSIX-semantics reasoning: `Ok`, mapping still readable, leaf absent. **Unmeasured** — if the
  runner shows 1224 instead, that result is the measurement: pin it and keep the gate's delete wait
  as justified.
- Record in `tasks/decisions.md` (supersedes the 1224 premise of `d-20260918-17` with the measured
  results, clause 2). Whether the in-process mapping gate is then removable is a design question →
  new finding via `findings.py file`, citing both measurements.

### 4. Pushes must not stack on a red remote
- **Shared contract** — `~/Projekte/agent-kit/references/push-review-policy.md` (symlinked to
  `~/.claude/references/`), new clause under §8, same severity as a red local gate: (before) read
  the latest completed CI run of the upstream branch; if a job the project skill names as
  not-locally-reproducible is red, **the push is refused** unless this push is the repair of that job
  (its commits handle the finding that owns the failure). An unowned failure is filed first. A
  filed finding alone never licenses the push — that would legalise the 17-push stack. Commits stay
  local; the drain already reports a refused release and carries the range. (after) wait on the
  pushed SHA's named jobs; red = red gate, repair in the same session.
  Commit in agent-kit (own repo).
- **Drain enforcement is a different area** (drain runtime + `findings-ledger-contract.md` release
  preconditions, :780-809): "remote CI red on the named jobs" as a third drain-measured release
  precondition, so the wait does not rest on the session's self-report. Filed as an agent-kit
  finding with this incident as evidence (rule 4b: different area → handoff), not built here. The
  finding states the gap precisely: a refusal is a "completed release without pushing" (:795-797),
  gets one release resume (:778-779), and the remeasure loop (:780-793) measures only kit parity
  and the foreign dirty set — so what a drain does after a resume while CI is still red is
  unspecified. The carried range clears through the closing `/push` protocol (:803-804) once green.
- **Project** — `.claude/skills/push/SKILL.md`: names the jobs (`rust-windows-test`,
  `rust-macos-test`, `rust-platform`) and the commands (`gh run list --branch … --workflow Test`,
  `gh run watch`/poll on the SHA, ≈5 min). Prose only; `check-skill-bridges.mjs` needs no mirror,
  `check-gate-routing.mjs` is untouched.

### 5. Ledger
File class A (production impact named) and class B via `findings.py file`; mark them and
f-20260918-03 handled with commit ids and the green run id. File the mapping-gate design question
(chessfable) and the drain remote-CI precondition (agent-kit ledger) as new findings.

## Commits (atomic, per area)
1. `fix(infra-fs): adopt the Windows staging parent through open_verified_parent` (+ tests)
2. `test(path-authority): compare default-root paths through canonical_binding`
3. `test(search-index): pin reader isolation under POSIX replace and delete` + decision
4. agent-kit: `docs(push-policy): a red remote is a red gate`; chessfable: `docs(push): name the remote-only jobs`
5. findings records.

## Verification
- Local (proves unix arms + ungated tests only): `cargo test --manifest-path src-tauri/Cargo.toml
  --all-targets`, native clippy, Windows cross-target clippy `-D warnings`,
  `pnpm gates:contract:check`, `./scripts/findings.py check`.
- Runner (sole proof for A, C-delete and all Windows arms): `$push`, then require on that SHA
  `rust-windows-test` **0 failed**, Windows clippy green, and the whole `Test` run green. Any red →
  read the job log, repair, re-push in the same session (this is change 4 applied to itself).
- Revert check for class A: the 16 currently-red tests are the proof the fix is load-bearing — they
  are red on `48c1df2` and must be green on the fix SHA.

## Reviews

Round 1 (2026-09-19, Claude lenses, snapshot r0). Raw verdicts: review-plan `APPROVED`,
review-tauri-security `REVISE`, review-root-cause `REVISE`, review-tests `REVISE`.

| ID | Lens(es) | Issue | Disposition |
| --- | --- | --- | --- |
| P1 | security#1, root-cause#3, plan#2 | `GetFinalPathNameByHandleW` is new surface; `adopt` has the path, `open_verified_parent` exists; shape unreconciled with `d-20260918-18` | **Fix** — change 1 rewritten; obligation: class A without a 2nd copy (rule 11) |
| P2 | security#2 | pathname reopen contradicts the path-free doc comment | **Fix** — fail-closed argument + doc comment in change 1 |
| P3 | security#3 | "log carries the real IO error" imprecise; `Error::Io` displays a fixed literal | **Fix** — claim removed (no `map_err` change remains) |
| P4 | root-cause#1 | delete path shares the disproven premise, untested on Windows | **Fix** — measurement test in change 3; gate removal stays a filed design question (rule 4b design exception) |
| P5 | root-cause#2 | remote-CI gap is a shared-contract gap (rule 38) | **Fix** — change 4 split shared/project |
| P6 | tests#1 | swap/TOCTOU tests are `cfg(unix)`; Windows arm unexercised | **Fix** — Windows tests in change 1 |
| P7 | tests#2 | runner is the only proof for Windows code | **Fix** — stated in Constraints and Verification |
| P8 | plan#1 | class B should reuse `canonical_binding` | **Fix** |
| P9 | tests#4 | drop `cfg(windows)` on the class C replace test | **Fix** |
| P10 | plan#3 | pointer to `pgn-scanning.md` | **Fix** — Constraints |
| P11 | tests#5, plan | bridge mirror not needed | **Fix** — hedge removed |

Round 2 (closure checks, snapshot r1). Raw verdicts: review-tauri-security `APPROVED` (P1-P3
closed, no new issue); review-root-cause `REVISE` (P1, P4 closed; P5 not closed); review-plan+tests
`REVISE` (P6-P11 reflected; three new issues).

| ID | Lens | Issue | Disposition |
| --- | --- | --- | --- |
| P12 | root-cause r2#1 | "owned by an open finding" still lets every cluster push onto red | **Fix** — before-clause is a refusal unless the push is the repair |
| P13 | root-cause r2#2 | no drain-level enforcement of the after-clause | **Defer** — different area (drain runtime, agent-kit); filed as agent-kit finding. The refusal in P12 already stops the stack at the push step |
| P14 | plan r2 | `parent_child_mismatch` dead on Windows → clippy red | **Fix** — unix-gated, plus caller grep + cross clippy |
| P15 | plan r2 | test :9091 must gain `cfg(unix)` explicitly | **Fix** |
| P16 | plan r2 | wrong "needs privileges" reason (junctions need none, mod.rs:114) | **Fix** — reason replaced by the verified one |

Round 3 (closure checks, snapshot r2). Raw verdicts: review-root-cause `REVISE` (P12 closed, P13
deferral accepted as legitimate; one should-fix); review-plan `APPROVED` (P14-P16 closed; two
should-fix).

| ID | Lens | Issue | Disposition |
| --- | --- | --- | --- |
| P17 | root-cause r3 | agent-kit finding must name the unspecified post-resume behaviour | **Fix** — wording of the finding only; no plan obligation changes |
| P18 | plan r3 | `replace :3958` is not a caller of `open_verified_parent` | **Fix** — reference corrected; semantics unchanged |
| P19 | plan r3 | `(File, OsString)` return must be destructured | **Fix** — stated; compile-proven by cross clippy |

Closure (arbiter): P1-P12, P14-P16 closed by explicit lens closure checks; P13 deferred to a filed
agent-kit finding (different area, accepted by the raising lens); P17-P19 are reference/wording
edits that change no behaviour, contract or proof, so no further lens round. The root-cause r3
`REVISE` is preserved as returned; its only issue is P17. Open: 0. Plan adopted per round:
r1=11, r2=4, r3=3.
