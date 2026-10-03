# Plan review: f-20260913-05 — listing failure copy on Files and Databases

Cluster: singleton `f-20260913-05` (area `frontend-ui`). Orchestrator: Claude Code, drain session `53d740d4-5be5-4005-a744-b433a462eb1b`, executor `codex`, full auto. Plan file (git-ignored): `tasks/plans/2026-10-03-listing-failure-copy.md`; its final body is Appendix A so this record stands alone.

This run started Step 3 from the set-aside planner draft `consumed/42548d18-1af4-46bd-a37c-20f82f9ba6c8-finding-f-20260913-05-rejected` (rejected by the supervisor only for a mirrored-evidence defect on its round-7 `review-plan` row) and ran a complete fresh plan review. The draft's own seven-round record (issues I1-I16) is Appendix B, verbatim.

Outcome: 6 rounds, 23 unique issues (N1-N23), no open plan-level obligation. The round-1 correctness finding plus locate probe `probe-1-r1` showed the draft's renderer-only design (category plus copied message literals) mislabels child-entry failures as lost roots, so the plan was rewritten around a backend `rootFailure` label (d-20261003-21, d-20261003-22) — this also dissolves the draft's I16 Defer (inbox `20261003-184054-586846-1791045654702385479-4.md`), whose premise the probe falsified. Two lineages needed focused fresh-context judgments: N9 (root-failure origin; `judge-n9-r3`) and N1 → N14 → N17 (Databases recovery ordering; round-6 `review-plan`).

Successor ownership: N10 (a child failure fails the whole listing) is filed through the inbox (`20261003-193400-1366703-1791048840413767072-4.md`); its entry links this record and must load it before review. N15 is `f-20261003-02` (picker `into_path` diagnostic), unchanged. The between-listings fallback of an unavailable custom database root is owned by `f-20260917-12`, named as a dependency in Known limits.

Implementation commits: `dccd9636` (Phase 1, backend to facade), `20ae3a5a` (Phase 2, pages, picker guard, catalogues, bundle ceiling), Phase 3 (verify-app live assertion) and cumulative diff review follow in this run.

## Reviews (this run)

Fresh review of this run (orchestrator session 53d740d4, executor codex). Prior draft history I1-I16: `~/.claude/drain-plans/chessfable-0a459a4f/consumed/42548d18-1af4-46bd-a37c-20f82f9ba6c8-finding-f-20260913-05-rejected/reviews-handoff.md`, carried into the tracked handoff.

### Round 1 — `plan-r1.md` (the draft body, unchanged)

Lenses: plan (review-plan role), minimalism, correctness, tests, error-handling, ipc-contract (normal). Not run: code-quality and root-cause (`plan-review: false`); chess-semantics, engine-protocol, pgn-index, persisted-state, tauri-security, platform-semantics (no plan file or obligation in their trigger set at r1; the r2 rewrite adds tauri-security and platform-semantics). Wall elapsed about 11 min (launch 19:02, last report 19:13), no quota wait. Locate probe `probe-1-r1` (normal, 15 min) traced root versus child failure sites after the reports.

| Lens | Verdict | Findings |
| --- | --- | --- |
| plan | REVISE | 1 |
| correctness | REVISE | 1 |
| minimalism | REVISE | 3 |
| tests | APPROVED | 3 |
| error-handling | APPROVED | 1 |
| ipc-contract | APPROVED, NOT APPLICABLE | 0 |

Raw reports, verbatim:

plan r1:
```
[blocker] tasks/plans/2026-10-03-listing-failure-copy.md:121 — Databases recovery can reuse a listing for the previous root. The page keeps one request identity, `"databases"` (`src/components/databases/DatabasesPage.tsx:68`), and `useNativeRequestOwner.run` returns an existing generation’s promise (`src/hooks/useNativeRequestOwner.ts:80`). If re-selection succeeds while an automatic revalidation is pending, `mutate()` can adopt that previous-root result; `getDatabases` already captured its root at `src/utils/db.ts:233`. Require recovery to retire or bypass the previous-root generation. The proof at plan line 205 only counts `mutate()` calls, so it misses this failure: require rendered new-root content and disappearance of the original alert, including an overlapping revalidation. (confidence: 94)

VERDICT: REVISE
```
correctness r1:
```
[blocker] tasks/plans/2026-10-03-listing-failure-copy.md:65 — Mapping every `missing-resource` to “This collection is no longer available. Choose another.” misdirects users when a PGN file disappears during Files listing: `list_file_workspace_core` resolves each collected file handle after the tree walk (`file_workspace.rs:638-648`), and a missing file produces `Io(NotFound)`, categorized as `missing-resource` (`path_authority/mod.rs:7272-7280`, `error.rs:305-310`). The collection root can still be accessible and a relist can succeed without re-selection. (confidence: 97)

VERDICT: REVISE
```
minimalism r1:
```
[should-fix] tasks/plans/2026-10-03-listing-failure-copy.md:143 — The plan leaves `DirectorySetting`’s picker guard and lifecycle separate while introducing a shared runner for Files and Databases. `src/components/settings/DirectorySetting.tsx:24` already has the same pending guard, success/error callbacks, and cleanup. Route it through the shared runner with its existing callbacks so the picker lifecycle has one implementation and Settings behavior stays the same. (confidence: 88)

[nit] tasks/plans/2026-10-03-listing-failure-copy.md:194 — The unit table at line 208 already checks all six changed literals through normalization, but the page tests also render every literal on both pages. Test the changed presentation once per page and keep all six mapping checks in the unit table; this cuts 10 redundant page cases. (confidence: 92)

[nit] tasks/plans/2026-10-03-listing-failure-copy.md:70 — Mapping `authentication` and `credential` to the folder permission message is speculative: neither traced listing command produces those categories, and the mandate does not require them. Let them fall through to retry and remove those extra cases. (confidence: 89)

VERDICT: REVISE
```
tests r1:
```
[should-fix] tasks/plans/2026-10-03-listing-failure-copy.md:205 — The tests don’t explicitly require clicking the new Choose database folder button to invoke `issueDatabaseWorkspace`; the container proof checks visibility only. A missing or incorrect button handler could pass while re-selection never opens. (confidence: 90)

[should-fix] tasks/plans/2026-10-03-listing-failure-copy.md:205 — The in-flight guard is tested while the picker is pending, but no assertion retries after a terminal outcome. A guard left latched after cancellation or rejection would pass the listed cases and permanently disable re-selection. (confidence: 94)

[should-fix] tasks/plans/2026-10-03-listing-failure-copy.md:201 — The `backendCategory`-absent branch maps renderer `not-found` and `permission` errors to distinct presentations, but the listed test covers only `validation`. Regressing either mapping to `retry` could pass because other tests exercise those presentations through backend categories. (confidence: 88)

VERDICT: APPROVED
```
error-handling r1:
```
[should-fix] tasks/plans/2026-10-03-listing-failure-copy.md:195 — A poisoned path-authority mutex remains poisoned for the process, and both `get_database_workspace` and `issue_database_workspace` fail on that same mutex. Mapping it to “Please try again” without a chooser leaves the Databases page unusable until ChessFable restarts; specify an actionable recovery message (confidence: 97)

VERDICT: APPROVED
```
ipc-contract r1:
```
NOT APPLICABLE: The plan adds no Rust↔renderer IPC contract. Its existing picker command is registered in Specta, and its typed error categories already match the renderer mapping.

VERDICT: APPROVED
```

### N1 — Databases recovery can adopt a generation that read the old root

* Witnesses: plan r1 finding 1 (blocker, 94).
* Evidence: confirmed. `useNativeRequestOwner.run` returns the first running generation's promise for the identity (`useNativeRequestOwner.ts:76-82`); `getDatabases` reads the root first (`db.ts:233`); both pages' SWR key is constant `"databases"`.
* Obligation: MANDATE "retrying cannot succeed until the root is re-selected" — re-selection must actually relist the new root.
* Disposition: Fix, plan-level. Correction: "Databases alert — Recovery refresh": after a returned handle, await `runningNativeRequest` for `"databases"`, then revalidate; proof renders new-root content and alert removal with an overlapping revalidation. Authority: not a new mechanism; the existing helper used by `useDatabaseContentValidation.ts:28`. Closure pending round 2.

### N2 — poisoned authority stays on retry

* Witnesses: error-handling r1 finding 1 (should-fix, 97).
* Evidence: confirmed that poison is permanent for the process and both commands take the same mutex (`main.rs:1288-1292`, `:1315-1317`). Poison is reachable only after a panic while the lock is held; mapping it to `Conflict` is the deliberate fail-closed pattern of `f-20260830-41` (handled, `d2a48b8e`).
* Obligation: none of the MANDATE's named roots; the hazard and its retry sentence exist equally before this change.
* Disposition: Skip. Reason: a pre-existing, process-internal condition the plan neither causes nor worsens; build §4 makes such a hazard a named known limit, never a new mechanism. Known limits names it with "only a restart recovers it".

### N3, N4, N5 — picker click, latched guard, renderer-only categories untested

* Witnesses: tests r1 findings 1, 2, 3 (should-fix, 90/94/88).
* Evidence: the r1 phase list asserted visibility only, pending-only guard behaviour, and only the `validation` renderer-only case.
* Disposition: Fix — carried to CR-3, CR-4, CR-5 (test assertions inside unchanged obligations). Closed by the cumulative diff review.

### N6 — `DirectorySetting` keeps a third copy of the picker guard

* Witnesses: minimalism r1 finding 1 (should-fix, 88).
* Evidence: confirmed, `DirectorySetting.tsx:24-39` is the same guard and pending state as `FilesPage.tsx:96-109`.
* Obligation: the frozen threat-model sentence "A second click must not open a second native dialog"; universal rule 11 (route every copy through the extraction). The draft's "no Settings change" non-goal was agent-authored; this run keeps Settings' visible behaviour unchanged and shares only the guard.
* Disposition: Fix, plan-level ("Shared picker guard", non-goal now "no Settings behaviour change"). Closure pending round 2.

### N7 — page tests repeat the six changed literals

* Witnesses: minimalism r1 finding 2 (nit, 92).
* Disposition: Fix, dissolved by the N9 redesign: there are no literals; each page renders each `rootFailure` value once. Arbiter-closed (nit-only witness).

### N8 — `authentication`/`credential` mapped to permission speculatively

* Witnesses: minimalism r1 finding 3 (nit, 89).
* Disposition: Fix, dissolved by N9: only `rootFailure` selects a re-select presentation; categories alone map to retry. Arbiter-closed (nit-only witness).

### N9 — category and message cannot tell a root failure from a child failure

* Witnesses: correctness r1 finding 1 (blocker, 97).
* Evidence: confirmed by source and by probe `probe-1-r1`: Files' post-walk loop resolves each child PGN (`file_workspace.rs:638-648`) and yields `Io(NotFound)` → `missing-resource`, `Io(PermissionDenied)`, and the very literal `path authority is unavailable because its object changed` for a child (`path_authority/mod.rs:7243-7281`, `resolved.rs:767-780`); Databases child resolution yields `directory changed while resolving` and `verified identity does not match registration target` (`path_authority/mod.rs:6515-6580`). `Error::Io` always displays `I/O failure` (`error.rs`), so no renderer rule can separate them.
* Obligation: MANDATE "a root whose object changed, a root that became unavailable and a transient failure all look identical, and 'try again' is the wrong instruction for the first two". The draft's design made a transient child failure look like a lost root.
* Disposition: Fix, plan-level and substantive. Correction: rewrite around "Root-failure reason (backend contract)" and "Facade": the producers label root failures with an optional `rootFailure` field; the renderer reads only that field. This also dissolves the draft's I16 (copied literals; inbox `20261003-184054-586846-1791045654702385479-4.md`), whose Defer premise ("today every literal matches its producer") the probe falsified. Frozen non-goal "no backend or IPC change" amended under the threat model; focused fresh-context `review-plan` judgment requested in round 2. Authority: the MANDATE words above. Phases: new Phase 1 (backend to facade, `sensitive`), Phase 2 renderer.

### N10 — a child failure fails the whole listing

* Witnesses: none (orchestrator, from the N9 probe).
* Disposition: Defer. Separate open design question (error rows versus skip versus fail) outside the MANDATE, which is about roots. `findings.py related` showed no entry; filed through `./scripts/findings.py file`: "drain owns the ledger and will merge this entry: /home/felixb/Projekte/chessfable/tasks/findings-inbox/20261003-193400-1366703-1791048840413767072-4.md".

Round 1 adoptions (plan-level, excluding carried and arbiter-closed): N1, N6, N9 → 3.

### Round 2 — `plan-r2.md` (rewrite around `rootFailure`)

Lenses: plan (review-plan, with the focused judgment on the amended non-goal), correctness, minimalism, tests, error-handling, ipc-contract, tauri-security, platform-semantics (all `sensitive`: the plan now touches `main.rs`, `infra/**`, `generated.ts`). tauri-security and platform-semantics had their first look. Delta `tasks/plans/.plan-delta-2026-10-03-listing-failure-copy.md-r2.diff` (exit 0, 18 REVISED headings). Wall elapsed about 19 min (launch 19:40, last report 19:59), no quota wait.

| Lens | Verdict | Findings |
| --- | --- | --- |
| plan | REVISE | N9 NOT CLOSED + 2 |
| correctness | REVISE | N9 NOT CLOSED + 1 (same defect) |
| minimalism | APPROVED | 0 |
| tests | REVISE | 1 |
| error-handling | APPROVED | 1 |
| ipc-contract | APPROVED | 0 |
| tauri-security | REVISE | 1 |
| platform-semantics | REVISE | 1 |

N1 CLOSED — plan, correctness, minimalism, tests, error-handling, ipc-contract, tauri-security, platform-semantics r2 (then re-opened in mechanism by N14; see there).
N6 CLOSED — plan, correctness, minimalism, tests, error-handling, ipc-contract, tauri-security, platform-semantics r2.
N9 NOT CLOSED — plan r2 and correctness r2 (closed by the other six): root enumeration propagates child `statat` failures, so call-site labelling still mislabels a child race.

Focused judgment (fresh-context `review-plan` r2, verbatim): `JUDGMENT: The optional additive `rootFailure` field is the simplest reliable contract that preserves existing categories and messages. Renderer-only classification cannot distinguish identical root and child payloads; backend-local remapping changes those contracts. The field is justified, but the proposed producer boundaries and coverage remain incomplete.` Recorded: contested invariant "no backend or IPC change"; previous answer: renderer classification by category and message; new evidence: `probe-1-r1` and correctness r1; judgment: amend, additive optional field; obligation changes: N9 and its residual.

Raw reports, verbatim:

plan r2:
```
N1 CLOSED — r2 recovery waits for running generations before revalidating (tasks/plans/2026-10-03-listing-failure-copy.md:117), and proof requires rendered new-root content during overlap (:214). This matches src/hooks/useNativeRequestOwner.ts:36 and prevents reuse at :80.

N6 CLOSED — r2 routes all three callers through one guard (tasks/plans/2026-10-03-listing-failure-copy.md:129), preserving Settings behavior and testing recovery after terminal outcomes. The existing copies are src/components/settings/DirectorySetting.tsx:26 and src/components/files/FilesPage.tsx:98.

[blocker] N9 NOT CLOSED — tasks/plans/2026-10-03/listing-failure-copy.md:64 — the proposed enumeration boundary still mixes root and child failures. Both pages call `CapabilityDirectory.entries`, which propagates child `statat` failures from src-tauri/src/infra/fs.rs:185. A child disappearing before stat produces `Io(NotFound)` while the root remains healthy; the existing test at :5838 pins this case. Labeling the entire root enumeration call would incorrectly produce `rootFailure: missing`. Phase 1’s child cases at plan :187 omit this window. Require origin separation within enumeration and corresponding consumer proof; `infra/fs.rs` is currently read-only context. (confidence: 99)

[blocker] tasks/plans/2026-10-03-listing-failure-copy.md:60 — excluding every other `Io` kind leaves an unusable default database root on retry without recovery. `default_root_refusal` deliberately returns `Io(InvalidInput)` for a symlink or non-directory (src-tauri/src/infra/path_authority/mod.rs:2628), propagated by src-tauri/src/main.rs:1328. Include this root-specific refusal in `unusable`, preserving category/message, and require proof using the actual producer. (confidence: 99)

[blocker] tasks/plans/2026-10-03-listing-failure-copy.md:69 — the promised next-attempt root label is false for Databases. If a custom root changes during child resolution (src-tauri/src/infra/path_authority/mod.rs:6525), the next `active_database_root` refresh returns `None` (:6257, :6269); src-tauri/src/main.rs:1328 then selects the default root. Retry can therefore clear the alert with unrelated content without ever labeling the changed root. Cover actual root recheck failures when observed and require a native root-swap case; this concerns root recovery, not deferred N10’s child-failure policy. (confidence: 97)

JUDGMENT: The optional additive `rootFailure` field is the simplest reliable contract that preserves existing categories and messages. Renderer-only classification cannot distinguish identical root and child payloads; backend-local remapping changes those contracts. The field is justified, but the proposed producer boundaries and coverage remain incomplete.

VERDICT: REVISE
```
correctness r2:
```
N1 CLOSED — Databases waits for running `"databases"` generations before revalidating, and the acceptance case checks that overlapping old-root work cannot leave the old content or alert.

N6 CLOSED — Files, Databases, and `DirectorySetting` share the picker guard; CR-4 checks that each can be activated again after cancellation or rejection.

[blocker] N9 NOT CLOSED — the root enumeration site can return errors from statting child entries, so variant-based root labeling still misclassifies some child races.

[blocker] tasks/plans/.plan-2026-10-03-listing-failure-copy.md-r2.body.md:64 — The plan maps `Io(NotFound)` at root enumeration to `missing`, but `CapabilityDirectory::entries` stats each accepted child and propagates `statat` failures as `Error::Io` (`src-tauri/src/infra/path_authority/mod.rs:540-550`; `src-tauri/src/infra/fs.rs:185-186`). If a direct PGN or `.db3` vanishes between enumeration and stat, the page says the root is unavailable and tells the user to choose another, although the contract requires child-entry races to keep the retry sentence. The backend contract must preserve whether the error came from the root or a child before assigning `rootFailure`. (confidence: 99)

VERDICT: REVISE
```
minimalism r2:
```
N1 CLOSED — Recovery awaits running `databases` generations before revalidation and requires new-root content after an overlapping request (`body:117, 214`; `useNativeRequestOwner.ts:36-42`).

N6 CLOSED — One shared guard replaces the existing Files and `DirectorySetting` copies and serves Databases, while preserving Settings behavior (`body:127-131, 216`; `FilesPage.tsx:96-109`; `DirectorySetting.tsx:23-39`).

N9 CLOSED — The probe shows category and message can collide across root and child failures; the optional typed field is the minimal reliable discriminator (`body:56-74`; `probe-1-r1`).

VERDICT: APPROVED
```
tests r2:
```
N1 CLOSED — Phase 2 requires an overlapping old-root revalidation case and asserts the new root’s content appears and the alert clears after re-selection.

N6 CLOSED — The plan routes Files, Databases, and `DirectorySetting` through one picker guard; Phase 2 tests the guard and `DirectorySetting` behavior, and CR-4 checks that all three can be activated again after cancellation or rejection.

N9 CLOSED — Phase 1 tests root labels against same-variant child failures and pins unchanged category/message serialization; Phase 2 tests the rendered copy selected by `rootFailure`.

[blocker] tasks/plans/.plan-2026-10-03-listing-failure-copy.md-r2.body.md:187 — The new Rust-to-renderer `rootFailure` path is tested only in separate serialization and synthetic facade/component tests. The container tests mock IPC, and the planned live-app pass covers success layouts only. If the real Tauri command path drops or reshapes the field, all listed assertions can pass while the pages still show retry copy. Add a `pnpm verify:app` assertion that drives a real root failure through IPC and checks the rendered message (confidence: 96).

VERDICT: REVISE
```
error-handling r2:
```
N1 CLOSED — Recovery waits for the running `"databases"` generation, then revalidates; the proof requires new-root content after an overlapping request.

N6 CLOSED — The shared picker guard covers Files, Databases, and `DirectorySetting`, and CR-4 requires another activation after cancellation or rejection.

N9 CLOSED — The typed `rootFailure` field distinguishes root failures from child failures; Phase 1 requires tests for both while preserving category and message.

[should-fix] tasks/plans/.plan-2026-10-03-listing-failure-copy.md-r2.body.md:181 — The recovery wait has no timeout or cancellation. `runningNativeRequest` uses `Promise.allSettled` on active requests, so a stalled old-root listing can prevent `mutate` from running after the new root is selected, leaving the old list or alert indefinitely (confidence: 86).

VERDICT: APPROVED
```
ipc-contract r2:
```
N1 CLOSED — Recovery waits for running `"databases"` generations before revalidating, and Phase 2 requires proof that an overlapping old-root request cannot win (plan lines 117, 214).

N6 CLOSED — One picker guard serves Files, Databases, and `DirectorySetting`; the plan preserves Settings callbacks and requires proof the guard clears after cancellation or rejection (lines 129, 216; CR-4).

N9 CLOSED — Rust’s `Error` serializes through the Specta-typed `ErrorPayload`; the plan adds optional `rootFailure`, carries it through `normalizeError` and `TauriCommandError.details`, and requires wire-shape, facade, and regenerated-binding proof. The affected commands are already in `collect_commands!`.

VERDICT: APPROVED
```
tauri-security r2:
```
N1 CLOSED — after the picker returns a handle, the Databases recovery refresh waits for running request generations before revalidation, so the relist reads the active root (`useNativeRequestOwner.ts:36`).

N6 CLOSED — the shared picker guard covers Files, Databases, and `DirectorySetting`, preserving the Settings outcome handling (`DirectorySetting.tsx:24`).

N9 CLOSED — the bounded `rootFailure` enum distinguishes root from child failures without putting paths in the field; child failures remain unlabeled (Root-failure reason; `src-tauri/src/error.rs:499`).

[blocker] src-tauri/src/error.rs:499 — Phase 1 changes the shared error serializer while requiring the message to remain unchanged. A native `into_path()` failure interpolates OS text at `src-tauri/src/main.rs:1265` and `src-tauri/src/file_workspace.rs:575`; serialization sends it in the payload before renderer redaction at `src/platform/errors.ts:197`. Phase 2 also forwards picker rejections to notifications. This reopens `f-20261003-02` because N9 adds a backend serialization change to the plan. (confidence: 96)

VERDICT: REVISE
```
platform-semantics r2:
```
N1 CLOSED — recovery waits for running `databases` generations, then requires the relist to render the new root and clear the alert.

N6 CLOSED — the shared picker guard includes Files, Databases and `DirectorySetting`, with Settings’ visible behavior preserved.

N9 CLOSED — the optional `rootFailure` field distinguishes root failures from same-variant child failures, with tests required for both.

[should-fix] tasks/plans/.plan-2026-10-03-listing-failure-copy.md-r2.body.md:192 — Phase 1’s Rust test command runs on the executor’s host. The later `--rust` gate supplies the Windows GNU compile check, but the plan does not require Windows and macOS runtime proof (`rust-windows-test`, `rust-macos-test`), the relevant Windows MSVC and macOS targets in `rust-platform`, or the non-Linux Unix FreeBSD source probe recorded in `tasks/build-ledger.md:124`. Require these checks and ensure the root/child cases execute on each applicable test platform; Linux alone cannot verify the platform-specific resolver branches or test-helper `cfg` parity. (confidence: 98)

VERDICT: REVISE
```

### N9 residual — call-site origin is not root origin

* Witnesses: plan r2 finding (N9 NOT CLOSED, blocker 99); correctness r2 findings 1-2 (blocker 99).
* Evidence: confirmed. `read_directory_entries_at` stats each kept child and maps a `statat` failure to `Error::Io` (`infra/fs.rs:185-186`), called from `CapabilityDirectory::entries` (`path_authority/mod.rs:540-550`), so the root enumeration call fails with a child's `Io(NotFound)`.
* Disposition: Fix, plan-level. Correction: "Root-failure reason" now labels by the root's actual state — explicit `too-large` at the bound and depth producers, and otherwise a read-only post-failure root probe in the two listing commands that labels the probe's own error by variant; the original error stays unlabelled when the root still resolves. Phase 1 proof adds the `readdir`/`statat` child race and the in-listing root swap. Authority: MANDATE "a root ... and a transient failure all look identical". Closure pending round 3 (lineage N9, first NOT CLOSED).

### N11 — the default-root shape refusal is `Io(InvalidInput)`

* Witnesses: plan r2 finding 2 (blocker 99).
* Evidence: confirmed, `default_root_refusal` builds `std::io::Error::new(InvalidInput, …)` (`path_authority/mod.rs:2626-2632`).
* Disposition: Fix, plan-level (mapping contract). Correction: `Io(InvalidInput)` → `unusable` in the variant mapping; Rust test with that producer. Closure pending round 3.

### N12 — the "next attempt labels it" claim is false for Databases

* Witnesses: plan r2 finding 3 (blocker 97).
* Evidence: confirmed. `active_database_root` returns `Ok(None)` for an entry that is not `Available` (`path_authority/mod.rs:6252-6270`) and `get_database_workspace_blocking` then uses the default root (`main.rs:1326-1338`). Owned by `f-20260917-12` (open, `app-startup`): "An unavailable persisted active root is indistinguishable from none, so the app silently substitutes a fresh default workspace".
* Disposition: Fix, plan-level. Correction: the claim is removed; the N9 probe labels an in-listing root swap at the attempt that observes it (Rust test required); the between-listings fallback is a named known limit with `f-20260917-12` as the owning dependency (separate area and open design question spanning puzzle and engine roots; build §4 prerequisite route). Closure pending round 3.

### N13 — no proof that the real IPC path carries the field

* Witnesses: tests r2 finding 1 (blocker 96).
* Evidence: container specs mock IPC; the Rust serialization test and the facade test are separate.
* Disposition: Fix, plan-level (verification level). Correction: "Live-app evidence" — one `scripts/app-driver.mjs` run in a throwaway `HOME` with a non-directory default database root renders the `unusable` sentence and chooser. One-off, not committed (rule 6d note given in chat before writing it). Closure pending round 3.

### N14 — the recovery wait can block forever

* Witnesses: error-handling r2 finding 1 (should-fix 86). Lineage: N1.
* Evidence: `runningNativeRequest` resolves only when every running generation settles (`useNativeRequestOwner.ts:36-42`); a stalled old-root listing keeps it pending.
* Disposition: Fix, plan-level (failure semantics). Correction: supersede — abort and detach running `"databases"` generations as the owner's last-subscriber cleanup does (`useNativeRequestOwner.ts:61-68`), then revalidate; proof includes an old-root request that never settles. Authority: `async-resource-invariants.md` (stale-result and cancellation guard) and N1. Closure pending round 3.

### N15 — picker `into_path` diagnostic (draft I8, `f-20261003-02`)

* Witnesses: tauri-security r2 finding 1 (blocker 96).
* Evidence: the interpolation is real and pre-existing (`main.rs:1263-1265`, `file_workspace.rs:575`). The plan keeps every `message` byte-identical, so the new field neither adds nor widens content; the same command's error is already shown by Settings.
* Disposition: Defer — stands as filed `f-20261003-02` (open, `bindings-ipc`, Entry lens). Reason: a hazard equal before and after this change is a named known limit or a filed finding, never a new mechanism in this plan (build §4); the fix spans ten `into_path` sites in `main.rs` (rule 11 extraction), which is that finding's own run. Not re-filed.

### N16 — platform proof for the new Rust tests

* Witnesses: platform-semantics r2 finding 1 (should-fix 98).
* Disposition: Fix, plan-level (verification level). Correction: Phase 1 "Platform proof" paragraph — portable tests where the producer is portable, the FreeBSD source probe when a touched function has `cfg(target_os)` branches, and the CI `rust-windows-test`, `rust-macos-test` and `rust-platform` jobs awaited after push. Closure pending round 3.

Round 2 adoptions (plan-level): N9 residual, N11, N12, N13, N14, N16 → 6.

### Round 3 — `plan-r3.md` (post-failure root probe)

Lenses: plan (review-plan), correctness, tests, error-handling, platform-semantics (N-witnesses), minimalism (new mechanism scope), persisted-state (first look: `src/hooks/useNativeRequestOwner.ts`), all `sensitive` except plan. Delta `tasks/plans/.plan-delta-2026-10-03-listing-failure-copy.md-r3.diff` (exit 0, 9 REVISED). Wall elapsed about 20 min (launch 20:05, last report 20:25), no quota wait. Then the focused fresh-context `review-plan` judgment `judge-n9-r3` (build §4: lineage N9 failed closure a second time), about 9 min.

| Lens | Verdict | Findings |
| --- | --- | --- |
| plan | REVISE | N9 NOT CLOSED |
| correctness | REVISE | N9 NOT CLOSED + 1 (same defect) |
| tests | REVISE | N13 NOT CLOSED + 1 (same defect) |
| error-handling | APPROVED | N9 NOT CLOSED (should-fix) + 2 |
| platform-semantics | APPROVED | 0 |
| minimalism | APPROVED | 1 nit |
| persisted-state | APPROVED, NOT APPLICABLE | 0 |
| judge-n9-r3 | REVISE | 1 |

N11 CLOSED — plan, correctness, tests, error-handling, platform-semantics, minimalism r3.
N12 CLOSED — plan, correctness, tests, error-handling, platform-semantics, minimalism r3.
N14 CLOSED — plan, correctness, tests, error-handling, platform-semantics, minimalism r3 (its claim refined by N17).
N16 CLOSED — plan, correctness, tests, error-handling, platform-semantics, minimalism r3.
N9 NOT CLOSED — plan r3, correctness r3, error-handling r3 (closed by tests, platform-semantics, minimalism r3).
N13 NOT CLOSED — tests r3 (closed by plan, correctness, error-handling, platform-semantics, minimalism r3).

Raw reports, verbatim:

plan r3:
```
[blocker] N9 NOT CLOSED — tasks/plans/.plan-2026-10-03-listing-failure-copy.md-r3.body.md:65 returns the probe’s error, contradicting unchanged-message requirements at :31, :60 and :73. A database root swap after child resolution reaches `Conflict("workspace is unavailable because its root changed")` through src-tauri/src/infra/path_authority/mod.rs:6577 and :7405; the probe instead returns `Conflict("path authority is unavailable because its object changed")` at :7282. Classify using the probe, attach the label to the original error, and require command-level proof that its category and message remain unchanged. (confidence: 99)

N11 CLOSED — candidate :69 explicitly maps `Io(InvalidInput)` to `unusable`, and :73 requires the real default-root refusal test; its producer is src-tauri/src/infra/path_authority/mod.rs:2628.

N12 CLOSED — candidate :184 removes the next-attempt guarantee and names the fallback limitation and owning finding. This matches src-tauri/src/infra/path_authority/mod.rs:6269 and src-tauri/src/main.rs:1328.

N13 CLOSED — candidate :137 requires real-backend evidence of the rendered sentence and chooser. scripts/app-driver.mjs:211 creates an isolated profile, :237 exposes its directory before Session.open at :250, allowing the proposed fixture.

N14 CLOSED — candidate :119 aborts and detaches old generations before revalidation; :224 requires recovery while old work remains pending. This addresses the generation reuse at src/hooks/useNativeRequestOwner.ts:76 using the cleanup mechanism at :64.

N16 CLOSED — candidate :197 requires portable producer tests, applicable platform probes, and CI completion; the platform jobs exist in .github/workflows/test.yml:15, :54 and :82.

VERDICT: REVISE
```
correctness r3:
```
[blocker] N9 NOT CLOSED — the post-failure probe can fail before reaching `capability_directory` when the authority is poisoned or uninitialized; those `Conflict` errors map to `changed`, despite the plan requiring them to stay unlabelled.

N11 CLOSED — `Io(InvalidInput)` maps to `unusable`, with the default-root refusal covered.

N12 CLOSED — the false “next attempt labels it” claim is removed, and the custom-root fallback is named as a limit owned by `f-20260917-12`.

N13 CLOSED — the real-app check exercises the default-root error through Tauri IPC and verifies the rendered message and chooser.

N14 CLOSED — recovery aborts and detaches running generations before revalidation, so it does not wait for a stalled request.

N16 CLOSED — Phase 1 specifies portable test coverage and the relevant cross-platform checks.

[blocker] tasks/plans/.plan-2026-10-03-listing-failure-copy.md-r3.body.md:65 — With a poisoned authority mutex before a listing, the listing and the follow-up probe can both return `Conflict("path authority lock was poisoned")`. Mapping that probe error to `changed` tells the user to choose another root, contrary to the explicit unlabelled/retry contract at lines 71–73. Only errors returned by root resolution after lock and initialization succeed should receive root labels. (confidence: 99)

VERDICT: REVISE
```
tests r3:
```
N9 CLOSED — Phase 1 requires tests that distinguish child failures with an intact root from roots replaced or removed during listing.

N11 CLOSED — The plan maps `Io(InvalidInput)` to `unusable` and requires a test using the non-directory default root.

N12 CLOSED — The between-listings fallback is now a named limit; the plan requires a test for a root change observed during listing.

[blocker] N13 NOT CLOSED — The real-app assertion has no runnable command or named test.

N14 CLOSED — Phase 2 requires the new root’s content to render while the old-root revalidation is still pending; reverting to waiting on it would leave that assertion unmet.

N16 CLOSED — The plan requires platform-specific Rust tests on Windows and macOS, the CI platform matrix, and a FreeBSD source probe when applicable.

[blocker] tasks/plans/.plan-2026-10-03-listing-failure-copy.md-r3.body.md:137 — The proposed live-app check names the expected text and button, but no command runs that scenario. `scripts/app-driver.mjs` is a generic harness, and the existing `pnpm verify:app` suite has no Databases or `rootFailure` assertion. The field could be dropped on the real IPC path while every named proof passes. (confidence: 97)

VERDICT: REVISE
```
error-handling r3:
```
[should-fix] N9 NOT CLOSED — the `Conflict(_) → changed` mapping also covers authority errors, despite the plan requiring those to stay unlabelled.
N11 CLOSED — `Io(InvalidInput)` maps to `unusable`, with proof required for the default-root refusal.
N12 CLOSED — the “next attempt” claim is removed; the between-listings fallback is named as a known limit owned by f-20260917-12.
N13 CLOSED — the plan adds a real-app check of the default-root failure through `app-driver.mjs`.
N14 CLOSED — recovery detaches running generations and revalidates without waiting for them.
N16 CLOSED — Phase 1 now specifies portable tests and platform proof.

[should-fix] tasks/plans/.plan-2026-10-03-listing-failure-copy.md-r3.body.md:69 — Mapping every `Conflict` to `changed` labels authority failures too: Files can return `Conflict("path authority is not initialized")` before resolving the root (`src-tauri/src/file_workspace.rs:519-523`), and the probe can encounter the same error. The UI then tells the user “This collection changed. Choose another,” although changing roots cannot fix the uninitialized authority. This contradicts the unlabelled-error contract on line 71. (confidence: 98)

[should-fix] tasks/plans/.plan-2026-10-03-listing-failure-copy.md-r3.body.md:119 — Aborting does not ensure every superseded request ends as `Cancellation`: `getDatabases` calls `getDatabaseWorkspace` and `getDbInfo` without the abort signal (`src/utils/db.ts:233, 249`), while `useNativeRequestOwner.run` does not race the request against abort. If either call stalls, the old fetch and native operation can remain pending even as revalidation proceeds. Specify how those stages terminate, or narrow the stated cancellation guarantee. (confidence: 90)

VERDICT: APPROVED
```
platform-semantics r3:
```
N9 CLOSED — The probe distinguishes root state from child failures, and tests pin both cases (`tasks/plans/.plan-2026-10-03-listing-failure-copy.md-r3.body.md:65, :73`).

N11 CLOSED — The plan maps `Io(InvalidInput)` to `unusable` and requires a default-root shape test (`tasks/plans/.plan-2026-10-03-listing-failure-copy.md-r3.body.md:69, :73`).

N12 CLOSED — The custom-root fallback is recorded as a known limit owned by `f-20260917-12` (`tasks/plans/.plan-2026-10-03-listing-failure-copy.md-r3.body.md:184`).

N13 CLOSED — The plan adds a real-app IPC check for the `unusable` payload (`tasks/plans/.plan-2026-10-03-listing-failure-copy.md-r3.body.md:137`).

N14 CLOSED — Recovery aborts and detaches running requests before revalidation, so it does not wait on a stalled generation (`tasks/plans/.plan-2026-10-03-listing-failure-copy.md-r3.body.md:119`).

N16 CLOSED — Phase 1 names the conditional FreeBSD source probe, the Windows compile check, and the Windows, macOS, and platform CI jobs. No implementation diff exists yet to report as compiled (`tasks/plans/.plan-2026-10-03-listing-failure-copy.md-r3.body.md:197`).

VERDICT: APPROVED
```
minimalism r3:
```
N9 CLOSED — the post-failure root probe distinguishes the child `statat` race from root replacement, with tests for both.

N11 CLOSED — `Io(InvalidInput)` maps to `unusable`, and the default-root refusal has a test.

N12 CLOSED — the false “next attempt labels it” claim is removed; the between-listings fallback is named as a limit owned by `f-20260917-12`.

N13 CLOSED — the throwaway-`HOME` live-app check exercises the real command path and renders the `unusable` message and chooser.

N14 CLOSED — recovery aborts and detaches old generations without waiting; Phase 2 covers a still-pending old-root request while requiring the new-root listing to complete.

N16 CLOSED — Phase 1 specifies portable test coverage and the Windows, macOS and FreeBSD proof paths.

[nit] tasks/plans/2026-10-03-listing-failure-copy.md:168 — The shared bound producer will add `too-large` to puzzle listing errors, though nothing reads the field there. Suppress that unused IPC value for puzzle listings to keep the new label within the Files and Databases scope (confidence: 84).

VERDICT: APPROVED
```
persisted-state r3:
```
NOT APPLICABLE: The listed files and obligations concern listing errors, request ownership, and presentation; none concerns renderer state persisted, keyed, hydrated, or scoped across tabs.
VERDICT: APPROVED
```
judge-n9-r3 (focused fresh-context review-plan judgment):
```
[blocker] tasks/plans/.plan-2026-10-03-listing-failure-copy.md-r3.body.md:65 — N9 remains open: successful `capability_directory` does not prove the root is listable. On Unix, a previously granted root changed to mode `0400` retains read permission but loses search permission. The probe opens the root pathname with `RDONLY` (`src-tauri/src/infra/path_authority/resolved.rs:774`) and supplies no child components (`src-tauri/src/infra/path_authority/mod.rs:4276`), so it succeeds. Enumeration instead opens `.` relative to that descriptor (`src-tauri/src/infra/fs.rs:1300`), which requires search permission and fails with `PermissionDenied`. The correction therefore returns an unlabelled error for an unusable root. Require a root-only traversal/access check and a producer test for retained-read/lost-search permission. (confidence: 95)

JUDGMENT: The correction fixes lock-poison misclassification and preserves the original category and message, but its successful-probe implication is insufficient. Retain the post-failure approach and strengthen the probe to cover root traversal permission without inspecting children. Limitation: this permission case was traced in source; no runtime probe was performed under the read-only rails.
VERDICT: REVISE
```

### N9 residual, second failed closure — focused judgment

* Witnesses: plan r3 (blocker 99: the probe's error replaces the original message, e.g. `workspace is unavailable because its root changed` at `path_authority/mod.rs:6577`, `:7395-7407`); correctness r3 (blocker 99: the probe meets a poisoned lock first and `Conflict` maps to `changed`); error-handling r3 finding 1 (should-fix 98: `path authority is not initialized`, `file_workspace.rs:519-523`); judge-n9-r3 (blocker 95: a root with read but no search permission resolves — `resolved.rs:774` opens it `RDONLY`, `mod.rs:4276` passes no components — yet enumeration's `openat(dir, ".")` at `infra/fs.rs:1300` fails).
* Trace (orchestrator, source read): `file_workspace.rs:97-103` and `main.rs:1373-1378` map lock poison to `Conflict`; `read_directory_entries_at` reads the stream through `unix::walk_directory` and stats only kept names (`infra/fs.rs:150-186`, `:1292-1310`).
* Judgment recorded: contested invariant "label if and only if the chosen root itself is unusable, original category and message unchanged"; previous answers r1 (renderer literals), r2 (call-site variant), r3 (probe returning its own error); new evidence as above; judgment verbatim above — "Retain the post-failure approach and strengthen the probe to cover root traversal permission without inspecting children."
* Disposition: Fix, plan-level. Correction: probe steps (1) lock and initialization — failure ends with no label; (2) `capability_directory`; (3) read the root's own entry stream under the same bound keeping no entry; a step-2/3 failure's variant gives the label, attached to the original error. The mapping applies only to root resolution, root enumeration and default-root acquisition errors. Rust tests add: probe meets poison / uninitialized → unlabelled; mode-`0400` root → `permission`; Databases in-child root swap keeps its original message and gains `changed`. Closure pending round 4 with the judge's question re-checked by `review-plan`.

### N13 residual — the live-app check had no runnable command

* Witnesses: tests r3 findings 1-2 (blocker 97).
* Disposition: Fix, plan-level (verification level). Correction: the assertion is committed into `scripts/verify-app.mjs` (`pnpm verify:app`) with its staged-failure row; command `pnpm build` then `pnpm verify:app`, in the browser-verification stage; Phase 2 proof adds `node --check scripts/verify-app.mjs`. A check inside the existing real-window suite rather than a one-off script, so the proof is re-runnable (rule 6d line given in chat). Closure pending round 4.

### N17 — abort does not reach every stage of a superseded generation

* Witnesses: error-handling r3 finding 2 (should-fix 90). Lineage: N14.
* Evidence: confirmed. `getDatabases` calls `tauri.getDatabaseWorkspace()` and `getDbInfo` without the signal (`db.ts:233`, `:249`); `run` does not race the request against abort (`useNativeRequestOwner.ts:76-90`).
* Disposition: Fix, plan-level (stated failure semantics). Correction: "Recovery refresh" now claims only what holds — the superseded generation is detached and never rendered; abort reaches the signal-taking stages; a stage without a signal finishes on its own and SWR discards it as stale. Closure pending round 4.

### N18 — the bound label also reaches the puzzle listing

* Witnesses: minimalism r3 finding 1 (nit 84).
* Disposition: Skip. The field is inert where nothing reads it; suppressing it per caller would add a switch to the shared `CapabilityDirectory::entries` path for no behaviour. The plan already names it under Risks.

Round 3 adoptions (plan-level): N9 residual, N13 residual, N17 → 3.

### Round 4 — `plan-r4.md` (probe after focused judgment)

Lenses: plan (review-plan, with the N9 lineage check), correctness, tests, error-handling, platform-semantics (`sensitive`). Delta `tasks/plans/.plan-delta-2026-10-03-listing-failure-copy.md-r4.diff` (exit 0, 4 REVISED). Wall elapsed about 19 min (launch 20:40, last report 20:59), no quota wait.

| Lens | Verdict | Findings |
| --- | --- | --- |
| plan | REVISE | N17 NOT CLOSED |
| correctness | APPROVED | 0 |
| tests | APPROVED | N17 NOT CLOSED + 1 + 1 late |
| error-handling | APPROVED | N17 NOT CLOSED + 1 (same defect) |
| platform-semantics | REVISE | 1 |

N9 CLOSED — plan, correctness, tests, error-handling, platform-semantics r4 (third check, after the recorded focused judgment).
N13 CLOSED — plan, correctness, tests, error-handling, platform-semantics r4.
N17 NOT CLOSED — plan r4 (blocker 99), tests r4, error-handling r4; closed by correctness and platform-semantics r4.

Orchestrator errors recorded (no review evidence produced): (1) the round-2 record script appended its record but dropped three body edits it had computed (the N15 reference, the `root_failure` test-name note, and the N14 "never settles" proof clause), so rounds 3-4 reviewed a body without them; they land in the round-5 revision. (2) After a failed edit assertion, four round-5 leaves (`plan`, `correctness`, `tests`, `error-handling`) were launched although `plan-review-delta.py` had exited 3 (`UNCHANGED`); they were killed within a minute, before any report, and their artefacts moved to `$RUN_TMP/aborted-r5/`. They are not review evidence.

Raw reports, verbatim:

plan r4:
```
N9 CLOSED — r4 plan:65,73 excludes lock/initialization failures, preserves the original error, and probes root enumeration without retaining children. `src-tauri/src/infra/fs.rs:1300` opens `.` to check traversal permission; `:173` skips child stats. This addresses the focused judgment’s mode-`0400` case (confidence: 96).

N13 CLOSED — r4 plan:137 commits the real-window assertion into `scripts/verify-app.mjs`, names `pnpm build` then `pnpm verify:app`, and requires an independent staged-failure row. The existing harness provides profile isolation at `scripts/app-driver.mjs:211` (confidence: 97).

[blocker] N17 NOT CLOSED — tasks/plans/.plan-2026-10-03-listing-failure-copy.md-r4.body.md:119 incorrectly assumes SWR discards every superseded result. SWR 2.4.0 checks request identity for successful responses (`node_modules/swr/dist/index/index.mjs:416`), but its catch path publishes errors without that check (`:463`, `:470`, `:497`). An old `getDatabaseWorkspace` rejection can still reach SWR (`src/utils/db.ts:233`; `src/hooks/useNativeRequestOwner.ts:88`) and restore an alert after recovery succeeds. Require stale-rejection suppression and extend plan:224’s proof to settle the old request with a rejection after new-root content renders. This is contrary evidence to the revised discard premise (confidence: 99).

VERDICT: REVISE
```
correctness r4:
```
N9 CLOSED — The probe now excludes lock/init failures from labeling, checks root resolution and traversal, and attaches a step 2/3 label to the original error. Phase 1 requires tests for poison/init, mode `0400`, and an in-listing root swap with its original message preserved (r4 body:65, 69, 73).

N13 CLOSED — The live-app assertion is assigned to `scripts/verify-app.mjs`, includes a staged-failure row, and specifies `pnpm build` followed by `pnpm verify:app` (r4 body:137, 211, 239).

N17 CLOSED — The revised recovery claim matches the signal-taking and non-signal-taking stages in `db.ts` and the request owner; SWR’s mutation revalidation starts a fresh request and discards the superseded result (r4 body:119).

VERDICT: APPROVED
```
tests r4:
```
N9 CLOSED — Phase 1 specifies producer tests for child failures with an intact root, changed or missing roots, poison and initialization failures, lost search permission, and a Databases child-step swap that preserves the original message.

N13 CLOSED — The plan adds a runnable real-app assertion for the Databases message and chooser, with a staged failure for removing `rootFailure` from `get_database_workspace`.

[should-fix] N17 NOT CLOSED — The assertion at `:224` checks that the new root appears while the old request is pending, but not that a later completion from the non-abortable generation is discarded and cannot overwrite it.

[should-fix] tasks/plans/.plan-2026-10-03-listing-failure-copy.md-r4.body.md:73 — The revised probe contract at `:65` says cancellation before or during the probe returns `Cancellation`, but the Rust test list does not exercise that path. The UI cancellation test at `:221` uses a prebuilt cancellation and would not catch the real command returning its original error after abort. (confidence: 88)

LATE OBSERVATIONS

[should-fix] tasks/plans/.plan-2026-10-03-listing-failure-copy.md-r4.body.md:233 — The component tests use `defaultValue`, and `i18n:check` validates catalogues statically; neither proves that every shipped catalogue renders these keys with fallback disabled as CR-2 requires. (confidence: 91)

VERDICT: APPROVED
```
error-handling r4:
```
N9 CLOSED — The revised probe checks the root’s entry stream without inspecting children and preserves the original error; the listed tests cover permission loss, child races, and root swaps.

N13 CLOSED — The plan adds a real-window `pnpm verify:app` assertion and a staged-failure row for the default-root refusal.

[should-fix] N17 NOT CLOSED — SWR 2.4.0 discards stale successes, but its rejection path still writes the stale error into shared state. The recovery claim needs an error-path guard.

[should-fix] tasks/plans/.plan-2026-10-03-listing-failure-copy.md-r4.body.md:119 — A delayed non-cancellation failure from signal-free `getDatabaseWorkspace` can surface after the new root loads. SWR checks request identity before applying successful data (`node_modules/swr/dist/index/index.mjs:416`), but its catch still stores the error and calls `onError` (`:470-497`). Add a stale-error guard and proof that a late rejection cannot restore the old alert alongside the new list (confidence: 95).

VERDICT: APPROVED
```
platform-semantics r4:
```
N9 CLOSED — The probe now checks initialization, root resolution, and root enumeration without opening children, then attaches the probe label to the original error. Tests cover the Unix permission case and preserve the in-child root-swap message. The plan names the Windows compile check, conditional FreeBSD source probe, and platform CI jobs; there is no implementation diff to report as compiled yet ([plan](</home/felixb/Projekte/chessfable/tasks/plans/.plan-2026-10-03-listing-failure-copy.md-r4.body.md:65>), [platform proof](</home/felixb/Projekte/chessfable/tasks/plans/.plan-2026-10-03-listing-failure-copy.md-r4.body.md:197>)).

N13 CLOSED — The plan adds a staged-failure assertion to `verify-app.mjs` and specifies `pnpm build` followed by `pnpm verify:app` ([plan](</home/felixb/Projekte/chessfable/tasks/plans/.plan-2026-10-03-listing-failure-copy.md-r4.body.md:137>), [proof](</home/felixb/Projekte/chessfable/tasks/plans/.plan-2026-10-03-listing-failure-copy.md-r4.body.md:239>)).

N17 CLOSED — Recovery is specified as detaching superseded requests and letting unsignaled stages finish while SWR discards stale results; the proof requires new-root content while old-root work remains pending ([plan](</home/felixb/Projekte/chessfable/tasks/plans/.plan-2026-10-03-listing-failure-copy.md-r4.body.md:119>), [acceptance](</home/felixb/Projekte/chessfable/tasks/plans/.plan-2026-10-03-listing-failure-copy.md-r4.body.md:224>)).

[should-fix] tasks/plans/.plan-2026-10-03-listing-failure-copy.md-r4.body.md:73 — Windows has no planned access-denied root fixture. The specified permission case uses Unix mode `0400`, so `rust-windows-test` skips it; the Windows compile check cannot prove that an `ERROR_ACCESS_DENIED` root failure receives `permission` while preserving the original category and message. Add a Windows ACL-based producer case to exercise root resolution or enumeration. (confidence: 92)

VERDICT: REVISE
```

### N17 residual — SWR publishes a stale rejection

* Witnesses: plan r4 (blocker 99), error-handling r4 findings 1-2 (should-fix 95), tests r4 finding 1 (should-fix).
* Evidence: confirmed in `node_modules/swr/dist/index/index.mjs`: the success path returns early when `FETCH[key][1] !== startAt` (`:416`), while the `catch` sets `finalState.error = err` and calls `onError` without that check (`:463-497`).
* Disposition: Fix, plan-level (failure semantics). Correction: the request owner settles an aborted generation as a cancellation for every subscriber, whatever its stages return or throw; Phase 2 proof adds a never-settling old request and a late non-cancellation rejection after the new root renders. Authority: `async-resource-invariants.md` ("Identity and stale-result guard") and N1. Closure pending round 5. Lineage N1 → N14 → N17, first NOT CLOSED of N17.

### N19 — the probe's cancellation path has no Rust test

* Witnesses: tests r4 finding 2 (should-fix 88).
* Disposition: Fix — carried to CR-6 (a test assertion inside the unchanged probe obligation).

### N20 — fallback-disabled catalogue render (late observation)

* Witnesses: tests r4 late observation (should-fix 91).
* Disposition: Skip — already carried as CR-2 since the draft (I12); the cumulative diff review closes it.

### N21 — no Windows access-denied root fixture

* Witnesses: platform-semantics r4 finding 1 (should-fix 92).
* Evidence: the label is computed from the platform-neutral `io::ErrorKind`; Rust's standard library maps Windows `ERROR_ACCESS_DENIED` to `ErrorKind::PermissionDenied`, the same kind the Unix `0400` case produces. The probe's Windows path (`read_directory_entries_at` → `win::read_directory_entries`) is exercised on `rust-windows-test` by the portable missing and replaced root cases. No ACL-deny fixture exists in `src-tauri/src` (grep for `icacls`, `SetNamedSecurityInfo`, `SetFileSecurity` found none).
* Disposition: Skip. An ACL-deny fixture would add new test infrastructure to re-prove the standard library's error-kind mapping; the Windows-specific code it would cover is already reached by the portable cases. The arbiter closes the lens's REVISE on this evidence.

Round 4 adoptions (plan-level): N17 residual → 1.

### Round 5 — `plan-r5.md` (owner-level cancellation of superseded generations)

Lenses: plan (review-plan), correctness, tests, error-handling (`sensitive`). Delta `tasks/plans/.plan-delta-2026-10-03-listing-failure-copy.md-r5.diff` (exit 0, 5 REVISED). Wall elapsed about 12 min, no quota wait.

| Lens | Verdict | Findings |
| --- | --- | --- |
| plan | APPROVED | N17 CLOSED + 1 |
| correctness | APPROVED | N17 CLOSED + 1 (same as plan's) |
| tests | APPROVED | N17 CLOSED + 1 |
| error-handling | APPROVED | N17 NOT CLOSED + 1 (same defect) |

Raw reports, verbatim:

plan r5:
```
N17 CLOSED — r5 plan:119 requires owner-level cancellation for every subscriber; :224 requires recovery with never-settling old work and suppression of a late rejection after new-root content renders. This addresses the signal-free stages at src/utils/db.ts:233,249 and SWR’s stale-rejection path.

[should-fix] tasks/plans/.plan-2026-10-03-listing-failure-copy.md-r5.body.md:119 — “never reaches SWR state … as an error” overstates the correction: SWR stores cancellation rejections too (node_modules/swr/dist/index/index.mjs:470,497). State that cancellation suppresses the page alert and prevents later stage failures from replacing it. The recovery behavior remains achievable. (confidence: 99)

VERDICT: APPROVED
```
correctness r5:
```
N17 CLOSED — Owner-level cancellation now covers every subscriber regardless of later stage outcomes; proof includes a never-settling old request and a late rejection after new-root content renders.

[should-fix] tasks/plans/.plan-2026-10-03-listing-failure-copy.md-r5.body.md:119 — “Never reaches SWR state … as an error” contradicts cancellation settlement: an owner promise rejected with cancellation still enters SWR’s catch, which publishes it as `error` (`node_modules/swr/dist/index/index.mjs:470-497`). `silent` suppresses the alert, not that cache field. State that the original outcome is suppressed while cancellation may enter SWR state. (confidence: 100)

VERDICT: APPROVED
```
tests r5:
```
N17 CLOSED — Plan :119 requires owner-side cancellation guarding; Phase 2 :224 requires new-root content while old work never settles and asserts no alert or content loss after a late non-cancellation rejection. Reverting stale-rejection suppression would fail that assertion.

[should-fix] tasks/plans/.plan-2026-10-03-listing-failure-copy.md-r5.body.md:119 — The new “every subscriber” contract lacks a shared-generation proof. The page assertions can pass if cancellation guarding wraps only the initiating `run`, while joining callers still receive the raw `current.promise` (`src/hooks/useNativeRequestOwner.ts:80`). Existing hook cancellation tests make the fetcher itself reject on abort. Add an owner-level test with two callers sharing signal-ignoring work, asserting both receive cancellation after supersession despite a later fulfillment or rejection. (confidence: 92)

VERDICT: APPROVED
```
error-handling r5:
```
[should-fix] N17 NOT CLOSED — Cancellation still enters SWR’s error state; converting a stale rejection does not establish that it cannot overwrite the current generation’s failure.

[should-fix] tasks/plans/.plan-2026-10-03-listing-failure-copy.md-r5.body.md:119 — SWR stores cancellation rejections through the same unchecked catch path (`node_modules/swr/dist/index/index.mjs:470,497`). If the owner converts an old request’s eventual rejection to cancellation after the new-root listing fails, `silent` hides the new failure and its chooser. Require cancellation settlement before fresh revalidation, or suppression of obsolete state updates, and extend line 224’s proof to preserve a new-root failure after old work rejects. The current successful-recovery case cannot detect this loss (confidence: 95).

VERDICT: APPROVED
```

### N17 second residual — a late cancellation can overwrite the fresh generation's failure

* Witnesses: error-handling r5 findings 1-2 (should-fix 95). Lineage N1 → N14 → N17; second NOT CLOSED of N17.
* Evidence: confirmed; SWR's `catch` stores any rejection, cancellation included, with no staleness check (`dist/index/index.mjs:463-497`). If the old generation's cancellation arrives after the fresh generation failed, the stored error becomes the cancellation and `silent` hides the real failure and its chooser.
* Trace and mechanism note (build §4, second failure of the lineage): the defect is ordering, not classification. The simplest correct mechanism is to make the old generation's outcome immediate and ordered — reject every subscriber with a cancellation at abort time (raced against the signal) and start revalidation only after those rejections are delivered. That makes "old outcome before new outcome" a property of the owner rather than of timing (`async-resource-invariants.md`: "Use a discriminator, never timing"). The round-6 `review-plan` packet asks for the focused fresh-context judgment on this mechanism.
* Disposition: Fix, plan-level (failure semantics). Correction in "Databases alert — Recovery refresh"; Phase 2 proof adds "the new root's listing fails and the old request settles afterwards". Closure pending round 6.

### N22 — "never reaches SWR state as an error" overstated

* Witnesses: plan r5 finding 1 (should-fix 99), correctness r5 finding 1 (should-fix 100).
* Disposition: Fix, plan-level wording of failure semantics; folded into the N17 correction ("the old generation's only outcome is a cancellation … The cancellation itself is `silent`"). Closure pending round 6.

### N23 — no shared-generation proof for "every subscriber"

* Witnesses: tests r5 finding 1 (should-fix 92).
* Disposition: Fix — carried to CR-7 (an owner-level test inside the unchanged supersede obligation).

### Arbiter note — FreeBSD probe and `d-20261003-14`

The Phase 1 "Platform proof" paragraph now cites `d-20261003-14`, which records the file-wide FreeBSD flip of `infra/fs.rs` and `path_authority/mod.rs` as a known limitation; without the citation the plan would have gated on a probe that decision says fails for pre-existing reasons. Reference alignment with a recorded decision; checked by `review-plan` in round 6.

Round 5 adoptions (plan-level): N17 second residual, N22 → 2.

### Round 6 — `plan-r6.md` (ordered cancellation; focused judgment on lineage N17)

Lenses: plan (review-plan, with the focused judgment), correctness, tests, error-handling (`sensitive`). Delta `tasks/plans/.plan-delta-2026-10-03-listing-failure-copy.md-r6.diff` (exit 0, 4 REVISED). Wall elapsed about 10 min, no quota wait.

| Lens | Verdict | Findings |
| --- | --- | --- |
| plan | APPROVED | N17, N22 CLOSED |
| correctness | APPROVED | N17, N22 CLOSED |
| tests | APPROVED | N17, N22, N23 CLOSED |
| error-handling | APPROVED | N17, N22 CLOSED |

Raw reports, verbatim:

plan r6:
```
N17 CLOSED — r6 body:119 requires immediate cancellation of every subscriber and delivery to SWR before fresh revalidation. This addresses SWR’s unchecked rejection publication (`node_modules/swr/dist/index/index.mjs:470,497`); body:224 now requires preserving the fresh failure after old work settles, and full plan:255 adds shared-subscriber proof (confidence: 94).

N22 CLOSED — r6 body:119 explicitly acknowledges that cancellation enters SWR’s error state and renders silently, matching `node_modules/swr/dist/index/index.mjs:470,497` (confidence: 99).

JUDGMENT: Yes—an abort-raced shared promise with a settlement barrier before `mutate()` is the simplest correction I found within the existing shared key. All production `"databases"` fetchers return `owner.run(...)` directly; the barrier must drain those SWR-facing promises, not merely abort controllers or await underlying work. The `d-20261003-14` citation correctly limits the file-wide FreeBSD probe exception.

VERDICT: APPROVED
```
correctness r6:
```
N17 CLOSED — Round 6 requires every superseded subscriber’s cancellation to reach SWR before fresh revalidation starts, drops later underlying outcomes, and requires preservation of a new-root failure after old work settles.

N22 CLOSED — The revised text correctly acknowledges that SWR stores cancellation as an error; `silent` suppresses its presentation.

VERDICT: APPROVED
```
tests r6:
```
N17 CLOSED — Phase 2:224 requires the fresh failure’s sentence and chooser to survive late old-work settlement; reverting cancellation ordering would fail this assertion.

N22 CLOSED — Recovery refresh:119 now acknowledges cancellation entering SWR’s error state and being rendered silently.

N23 CLOSED — CR-7 requires immediate cancellation for both subscribers sharing signal-ignoring work. The final frontend coverage gate selects the hook tests.

VERDICT: APPROVED
```
error-handling r6:
```
N17 CLOSED — Plan:119 requires immediate cancellation for every subscriber, delivered to SWR before fresh revalidation; :224 requires the fresh failure and chooser to survive late old-request settlement. CR-7 covers shared subscribers.
N22 CLOSED — Plan:119 explicitly acknowledges that cancellation enters SWR’s error state and is rendered silently.
VERDICT: APPROVED
```

Focused judgment (fresh-context `review-plan` r6, lineage N1 → N14 → N17), recorded: contested invariant "after a successful re-selection, no outcome of a generation that started before the switch may change what the Databases page shows"; previous answers wait / abort-and-detach / late cancellation; new evidence SWR 2.4.0 `catch` stores every rejection unchecked; judgment verbatim above ("an abort-raced shared promise with a settlement barrier before `mutate()` is the simplest correction … the barrier must drain those SWR-facing promises, not merely abort controllers or await underlying work"). The barrier detail is an implementation contract already stated ("Revalidation starts only after those cancellations have been delivered to SWR") and goes into the Phase 2 brief verbatim.

### Review totals

Completed rounds 6. Unique issues opened 23 (N1-N23): Fix closed at plan level 12 (N1, N6, N9, N11, N12, N13, N14, N16, N17, N22, plus N7 and N8 arbiter-closed as nits); Fix carried 5 (N3, N4, N5, N19, N23 as CR-3..CR-7); Skip 4 (N2, N18, N20, N21); Defer 2 (N10 inbox `20261003-193400-1366703-1791048840413767072-4.md`; N15 = `f-20261003-02`). Open plan-level obligations: none. Adoptions per round `r1=3 r2=6 r3=3 r4=1 r5=2 r6=0`. Lineages: N9 (r1 → r2 NOT CLOSED → r3 NOT CLOSED → focused judgment `judge-n9-r3` → r4 CLOSED); N1 → N14 → N17 (r2 closed N1; N14 r2 → r3 closed; N17 r3 → r4 NOT CLOSED → r5 NOT CLOSED → focused judgment r6 → r6 CLOSED). Correction-introduced defects: N14 (by N1's correction, r2), N17 (by N14's, r3), N9's r2 and r3 residuals (by its own corrections). Inherited draft history I1-I16 (seven planner rounds) is prior evidence, not counted here; its I16 Defer was dissolved by N9. Non-convergence trigger not reached (r4-r6 adopted 3 against 12 in r1-r3). Orchestrator errors: see the note under Round 4.

## Appendix A — final plan body

# Plan: Listing failure copy on Files and Databases

## Goal

When the Files or Databases listing fails because the chosen root itself changed, is missing, cannot be opened, cannot be read, or is too large to list, the page says so and offers a supported re-selection. The backend, which alone knows whether a failure came from the root or from a child entry, says so in a typed field; the renderer never matches message text. Every other failure, including a child-entry race, keeps today's retry sentence. Cancellation shows no failure sentence and does not paint the empty-success state.

## MANDATE

f-20260913-05, verbatim from the ledger:

The Files and Databases pages render every listing failure as "please try again", discarding the typed error category.

Where: `src/components/files/FilesPage.tsx` (`Files.LoadFailed`), `src/components/databases/DatabasesPage.tsx` (`Databases.LoadError`).

Defect: both pages show one fixed retry sentence whenever the listing query errors, without reading the `TauriCommandError` category the platform facade already carries. A workspace or database root whose object changed (`Conflict`), a root that became unavailable (`Io` / missing resource) and a transient failure all look identical, and "try again" is the wrong instruction for the first two: retrying cannot succeed until the root is re-selected.

Open question: which categories get their own message and recovery action (re-select the root, remove the stale entry) versus the generic retry text, and does that belong in these two pages or in a shared listing-error component both reuse?

Why it matters: from `f-20260905-05` on, a directory or `.db3` replaced while it is being listed is deliberately refused with `Conflict` rather than silently bound; the UI currently turns that refusal into an unexplained dead end.

Related: `f-20260905-05`, `f-20260913-04` (handled). Annotation 2026-10-03: root and parent open swaps now return `Conflict`, not `Io`; `EACCES` still returns `Io`; this finding remains only the page copy.

Inherited review history: load `tasks/handoffs/2026-09-13-workspace-directory-enumeration-review.md` before plan review. This finding inherits W42 (listing-error rendering), disposition Defer.

## Threat model and non-goals

Accidental input is a user-chosen directory that is replaced, removed, or refused between the grant and the listing, or a child entry under it that vanishes or changes during the listing. The backend already refuses those listings. There is no adversarial remote input and no new filesystem authority: the backend change below only labels errors it already returns.

A picker dismissal is `Error::Cancellation` and must not become a toast or a second failure sentence. A second click must not open a second native dialog.

Non-goals: no new renderer `AppErrorCategory` (`d-20260901-34`, `d-20260904-06`), no change to any error's `category` or Display text, no change to which operations fail or succeed (listing bound, partial-list refusal, registry semantics stay as `d-20261003-09` through `d-20261003-12` set them), no root-deletion command, no change to per-database metadata rows, no Settings behaviour change.

Amended in round 2 of this run (N9): the draft's frozen non-goal "no backend or IPC change" is withdrawn. Evidence: the round-1 `review-correctness` finding and locate probe `probe-1-r1` show that category plus message cannot tell a root failure from a child failure (Traced premises, last three bullets). The MANDATE's own words — a changed root, an unavailable root "and a transient failure all look identical" — cannot be met without a producer-side signal. The amendment is limited to one optional, additive payload field and the producers that set it. A focused fresh-context `review-plan` judgment on this amendment is requested in round 2.

## Traced premises

* Files lists with `tauri.listFileWorkspace` under SWR key `["file-workspace", workspace]` (`FilesPage.tsx:83-89`). A truthy SWR `error` renders only `Files.LoadFailed` ("Files could not be loaded. Please try again.") and replaces the tree. The header button `Files.ChangeCollection` / `Files.ChooseCollection` stays mounted and calls `chooseWorkspace` → `issueFileWorkspace` with an in-flight guard (`FilesPage.tsx:96-109`).
* Databases lists with `getDatabases` under SWR key `"databases"` through `useNativeRequestOwner("databases")` (`DatabasesPage.tsx:67-74`). `getDatabases` calls `getDatabaseWorkspace` then `listWorkspaceDatabases(root)`, and turns per-file `getDbInfo` failures into error rows (`db.ts:230-260`); those rows are not this alert. A truthy SWR `error` renders only `Databases.LoadError` (`DatabasesPage.tsx:270-276`). `Databases.Empty.NoInstalled` / `.AddHint` render whenever `!isLoading && filteredDatabases.length === 0` (`DatabasesPage.tsx:327-341`), including a failed first load. The page never calls `issueDatabaseWorkspace`.
* `useNativeRequestOwner.run` returns an existing in-flight generation's promise for the same identity instead of starting a new request (`useNativeRequestOwner.ts:76-82`). `runningNativeRequest(cache, key)` awaits every running generation of a key without starting one (`useNativeRequestOwner.ts:36-42`); `useDatabaseContentValidation.ts:28` already uses it before revalidating.
* SWR (`swr` ^2.4.0) is used with default options on both pages, so a failed listing is retried automatically with backoff while the page is visible.
* `issue_database_workspace` picks a folder, then `get_or_create_database_root(&path, display_name, None)` and `set_active_database_root` (`main.rs:1280-1296`). Re-selecting a replaced, already-registered path returns `Conflict("database root changed; select it again")` and mints nothing (`path_authority/mod.rs:5578-5580`). `issue_file_workspace` promotes the dialog grant (`file_workspace.rs:600-619`); an existing persistent entry whose identity differs returns `Conflict("persistent target changed; acquire a new capability")` (`path_authority/mod.rs:5065-5068`). Dismissal is `Error::Cancellation` on both.
* `DirectorySetting` (`settings/DirectorySetting.tsx:24-39`) holds the same in-flight guard and pending state around its `issueWorkspace` prop, used four times by `SettingsPage.tsx:523-595`.
* `Error` serializes as `ErrorPayload { tag, category, message }` with `message` = Display (`error.rs:124-129`, `:490-503`); `Type for Error` reuses `ErrorPayload`'s Specta type (`error.rs:505-520`); generated `ErrorPayload` is `{ tag; category; message }` (`generated.ts:1201`). `normalizeError` copies `category` into `backendCategory` and redacts `message` (`errors.ts:192-207`); `Error::Io` always displays `I/O failure` and its category is `missing-resource` for `NotFound`, `permission` for `PermissionDenied`, `io` otherwise (`error.rs:305-310`). `#[specta(optional)]` with `skip_serializing_if` is already used for optional fields (`db/models.rs:153-165`).
* Files root boundary: `collect_tree_entries` resolves the workspace root with `capability_directory(workspace.path_ref(), ReadPgn)` (`file_workspace.rs:517-527`, `capability_directory` at `path_authority/mod.rs:4268-4280`), then `walk` enumerates the root with `dir.entries` and applies `MAX_WORKSPACE_LISTING_DEPTH` and `check_directory_listing_bound` (`file_workspace.rs:362-410`). The authority lock and `workspace_listing_snapshot` run around it.
* Databases root boundary: `list_workspace_databases_blocking` → `list_database_children_cancellable` → `reconcile_db3_listing`, which takes `directory_listing_snapshot` then `capability_directory(root, operation)` (`path_authority/mod.rs:6379-6393`), then `map_db3_children_cancellable` enumerates the root with `entries` (bound applies) (`path_authority/mod.rs:65-75`) and calls `prepare_database_listing_child` per `.db3` candidate, which re-resolves root plus child (`path_authority/mod.rs:6515-6580`). `reconcile_db3_listing` is shared with the puzzle listing. `get_database_workspace_blocking` takes the lock, returns the active root if any, else acquires and registers the app-owned default root (`main.rs:1310-1338`).
* Probe `probe-1-r1` (this run): in Files, `Conflict("path authority is unavailable because its object changed")`, `Io(NotFound)` and `Io(PermissionDenied)` arise both from the root resolve and from the post-walk per-file `resolve`/count loop over child PGNs (`file_workspace.rs:638-648`, `path_authority/mod.rs:7243-7281`, `resolved.rs:767-780`); child directory walk failures also produce `Io(kind)`, `workspace directory changed concurrently`, `workspace entry changed concurrently`.
* Probe `probe-1-r1`: in Databases listing, `directory changed while resolving`, `verified identity does not match registration target`, `Io(NotFound)` and `Io(PermissionDenied)` arise from per-child `.db3` resolution; `root changed concurrently` and `workspace is unavailable because its root changed` are root-only.
* Probe `probe-1-r1`: authority-internal failures — poisoned or uninitialized lock, operation admission, ticket claims, registry capacity (`path registry identifier limit reached`), registry persistence, durability — precede or follow root resolution and are not properties of the chosen root.
* Round 2 evidence: `CapabilityDirectory::entries` → `read_directory_entries_at` stats each kept child with `statat` and propagates its failure as `Error::Io` (`infra/fs.rs:170-186`, `path_authority/mod.rs:540-550`), so enumeration of a healthy root fails with `Io(NotFound)` when a child vanishes between `readdir` and `statat`.
* `default_root_refusal` turns a symlinked or non-directory app-owned default root into `Io(InvalidInput)` (`path_authority/mod.rs:2622-2632`), reached from `get_database_workspace_blocking` (`main.rs:1326-1338`).
* `active_database_root` refreshes the stored entry and returns `Ok(None)` when it is not `Available` (`path_authority/mod.rs:6252-6270`); `get_database_workspace_blocking` then acquires the default root. An unavailable custom database root is therefore silently replaced by the default between listings. That behaviour is owned by `f-20260917-12` (open, `app-startup`, Entry build), whose open question includes surfacing it "as a re-selection prompt".
* `useNativeRequestOwner`'s last-subscriber cleanup aborts every generation and clears the set (`useNativeRequestOwner.ts:61-68`); `run` starts a new generation only when the set is empty (`:76-82`).
* `d-20261003-05` maps root and parent open swaps to `Conflict` and leaves `EACCES` as `Io`; `d-20261003-12` assigns the over-bound Files and Databases sentence to this finding. `d-20260830-05`: page tests render `t()` `defaultValue`. `scripts/i18n-completeness.mjs` rejects an empty value and a non-English, non-`en-GB` value byte-identical to `en-US` unless technical; `docs/localization.md` requires literal `t()` keys, `pnpm i18n:extract`, `pnpm i18n:check`, and testing a finite message set against shipped catalogues with fallback disabled.
* `e2e/async-errors.spec.ts` mocks listing commands and asserts no horizontal overflow, no page clipping, and a screenshot; `pnpm test:e2e:container` forwards extra arguments; `pnpm gates:push -- --frontend` includes `e2e-container`.

## Approach

### Root-failure reason (backend contract)

`ErrorPayload` gains one optional field, `rootFailure`, typed by a new Specta enum with exactly the values `changed`, `missing`, `unusable`, `permission`, `too-large`. It is absent (not `null`) when unset, so every existing payload, mock and test stays valid. Labelling never changes an error's `category`, Display text or diagnostic, and no other consumer reads the field. Generated bindings are regenerated with `pnpm bindings:generate`, never hand-edited.

The label answers one question: is the chosen root itself unusable, so that retrying cannot succeed until it is re-selected? It is set in four places and nowhere else:

* **Too large.** A refusal by the user-chosen listing bound (`check_directory_listing_bound` with `MAX_DIRECTORY_LISTING_ENTRIES`) or by `MAX_WORKSPACE_LISTING_DEPTH` is labelled `too-large` where it is raised. Both are properties of the root's tree (`d-20261003-12`), deterministic on every retry.
* **Post-failure root probe in the two listing commands.** When `list_file_workspace` or `list_workspace_databases` fails with any error that is not `Cancellation` and not already labelled, the command probes the same root once more, read-only and off the async workers, with no registry write: (1) take the authority lock and the initialization check — a failure there ends the probe with no label; (2) resolve the root with `capability_directory` on the same handle and operation; (3) open and read the root's own entry stream the way enumeration does, under the same listing bound, keeping no entry, so no child is stat'ed or opened (this proves search and read permission: a root whose mode lost search permission still resolves in step 2 but fails here). If step 2 or 3 fails, the label is derived from that probe error's variant (below) and attached to the **original** error, whose category and message stay unchanged. If both succeed, the original error is returned unlabelled: the root is listable, so the failure belonged to a child entry or a transient race. This is origin-agnostic by design: a child `statat` failure inside root enumeration, a child file or `.db3` replaced or vanished, and a root swap first observed inside a child step are all decided by the root's actual state. A cancellation observed before or during the probe returns `Cancellation`.
* **`get_database_workspace`.** A failure acquiring, registering or activating the app-owned default root (after the authority lock, the initialization check and the app-data bootstrap) is labelled by its variant. Registry capacity, persistence and durability errors are not labelled.
* **Pickers.** The same-path identity refusal in `get_or_create_database_root` (`expected_identity: None`, reached from `issue_database_workspace`) and the identity refusal in `promote_dialog` (reached from `issue_file_workspace`) are labelled `changed` where they are constructed.

Variant mapping, applied only to an error returned by a root resolution, root enumeration or default-root acquisition call — never to an authority lock or initialization check, which stay unlabelled — and used by the probe and by `get_database_workspace`: `Io(NotFound)` → `missing`; `Io(PermissionDenied)` → `permission`; `InvalidInput(_)` and `Io(InvalidInput)` (the default-root shape refusal) → `unusable`; `Conflict(_)` → `changed`; a listing-bound `ResourceLimit` → `too-large`. Every other error is returned unlabelled. An `InvalidInput` from root resolution means the stored root handle itself can no longer be used (revoked, foreign-platform or malformed stored path, not a directory), so re-selection is its recovery too.

Never labelled: authority lock poisoning and initialization, operation admission and ticket claims, registry capacity, persistence and durability, and any error while the root itself still resolves.

Rust tests pin, with the real producers: each label and its unchanged category and message; a listing whose child entry vanishes or is replaced (Files: a child PGN between walk and count, and a child entry between `readdir` and `statat`; Databases: a child `.db3` replaced during enumeration) fails unlabelled while the root is intact; a listing whose root is replaced or removed during the listing fails labelled `changed` / `missing`; poison and uninitialized authority are unlabelled, both when the listing and when the probe meets them; a root that keeps read but loses search permission (unix mode `0400`) is labelled `permission`; a root swap first seen inside a Databases child step keeps its original `workspace is unavailable because its root changed` message and gains `changed`; the over-bound and over-deep listings are `too-large`; the default-root non-directory refusal is `unusable`; both picker same-path refusals are `changed`; the payload serializes without `rootFailure` when unset and with it when set.

### Facade

`normalizeError` copies `rootFailure` from an `ErrorPayload` onto `AppError` as an optional field and passes it through `TauriCommandError.details`. No change to `BACKEND_CATEGORY`, `AppErrorCategory`, redaction, or `classify`.

### Listing presentation

One pure function, used by both pages, maps a listing error to `silent`, `changed`, `missing`, `unusable`, `permission`, `tooLarge`, or `retry`. It does not render and does not choose a sentence.

* `errorUnlessCancelled(error) === null` → `silent` (owner abort and backend cancellation).
* Otherwise the normalized error's `rootFailure` decides: `changed` → `changed`, `missing` → `missing`, `unusable` → `unusable`, `permission` → `permission`, `too-large` → `tooLarge`.
* No `rootFailure` → `retry`, whatever the category or message. The function never reads `message`.

### Files alert

Inside the existing `workspace` branch, the single `Files.LoadFailed` sentence becomes:

| Presentation | Rendered key | English contract |
| --- | --- | --- |
| `retry` | `Files.LoadFailed` | Files could not be loaded. Please try again. |
| `changed` | `Files.LoadFailed.Changed` | This collection changed. Choose another. |
| `missing` | `Files.LoadFailed.Missing` | This collection is no longer available. Choose another. |
| `unusable` | `Files.LoadFailed.Unusable` | This collection cannot be opened. Choose another. |
| `permission` | `Files.LoadFailed.Permission` | ChessFable is not allowed to read this collection. Choose another. |
| `tooLarge` | `Files.LoadFailed.TooLarge` | This collection is too large to list. Choose another. |
| `silent` | none | Treat the error as absent: the existing loading line without `data`, otherwise the tree. |

The alert stays `role="alert"`, `c="red"`. The header Change/Choose collection button stays the re-select control for every presentation; no second button. Sentences do not embed the button label.

### Databases alert

| Presentation | Rendered key | English contract |
| --- | --- | --- |
| `retry` | `Databases.LoadError` | Could not load databases. Please try again. |
| `changed` | `Databases.LoadError.Changed` | This database folder changed. Choose another. |
| `missing` | `Databases.LoadError.RootMissing` | This database folder is no longer available. Choose another. |
| `unusable` | `Databases.LoadError.Unusable` | This database folder cannot be opened. Choose another. |
| `permission` | `Databases.LoadError.RootPermission` | ChessFable is not allowed to read this database folder. Choose another. |
| `tooLarge` | `Databases.LoadError.TooLarge` | This database folder is too large to list. Choose another. |
| `silent` | none | No red alert. |

`Databases.LoadError.Missing`, `.Permission`, `.Title` and `.Description` belong to one database file and are not reused.

For the five re-select presentations only, the alert contains one button, `Databases.ChooseFolder` ("Choose database folder"), which runs the shared picker guard with `issueDatabaseWorkspace`. Retry shows no button. Add New is unchanged.

Recovery refresh: when the picker returns a handle, every running `"databases"` request generation is superseded — aborted and detached from the shared owner, as the owner's own last-subscriber cleanup already does (`useNativeRequestOwner.ts:61-68`) — and then the `"databases"` key is revalidated, so the relist starts a fresh generation that calls `getDatabaseWorkspace` again and reads the new active root. It never adopts or waits for a generation that started before the switch, so a stalled old-root listing cannot block recovery. Abort reaches only the stages that take the signal (`listWorkspaceDatabases` and the metadata loop); `getDatabaseWorkspace` and `getDbInfo` take none, so a superseded generation stalled there finishes on its own. SWR discards a stale success but stores any rejection, including a cancellation, without a staleness check (`swr` 2.4.0 `dist/index/index.mjs:416` versus `:463-497`). So the request owner settles a superseded generation itself, and at once: aborting a generation rejects every subscriber's promise for it with a cancellation at that moment — raced against the abort signal, not waiting for the underlying work — and whatever its stages later return or throw is dropped. Revalidation starts only after those cancellations have been delivered to SWR. The order is therefore fixed: the old generation's only outcome is a cancellation, recorded before the fresh generation starts, so no outcome of old work can overwrite the fresh generation's data or failure. The cancellation itself is `silent`. A refusal or cancellation of the picker supersedes nothing and does not revalidate.

Empty state: `Databases.Empty.NoInstalled` and `.AddHint` render only after a successful listing whose unfiltered list is empty and with no active failure. `Common.NoResults` still renders for a successful list whose search matches nothing.

* Non-silent failure, no list data: the alert (and the button when it has one); not the empty-success state.
* Non-silent failure, cached data: the cached list and the alert.
* `silent`, no list data: the existing loading presentation; no alert, not the empty-success state.
* `silent`, cached data: the cached list, no alert.
* Successful empty list, no failure: today's empty state.

### Shared picker guard

The in-flight guard and pending state around a native picker exist in `FilesPage.chooseWorkspace` and `DirectorySetting`; Databases would be the third copy. One shared primitive owns them: a second activation while one is pending does nothing, and pending clears on every outcome (success, cancellation, rejection). Files, Databases and `DirectorySetting` all use it; each keeps its own command and outcome handling, and Settings' visible behaviour (button, `aria-busy`, loading text, `onSelect`, `onError`) is unchanged.

Picker notification on Files and Databases: cancellation notifies nothing; a rejection whose normalized `rootFailure` is `changed` notifies that page's changed sentence instead of the backend message; every other rejection is notified with its visible message as today (`runUnlessCancelled`). A rejection never updates the workspace atom or revalidates.

### Live-app evidence

Mocked IPC cannot show that the real command path carries `rootFailure`. `scripts/verify-app.mjs` (`pnpm verify:app`, the committed real-window suite on `scripts/app-driver.mjs`) gains one assertion: in an isolated profile whose app-owned default database root is a regular file instead of a directory, the Databases page renders the `unusable` sentence and the Choose database folder button. It runs in its own profile or after every check that needs a working database root, so no other assertion changes outcome. Per that file's staged-failure rule it gets a row: with the `rootFailure` assignment removed from `get_database_workspace` the assertion fails. Command: `pnpm build` then `pnpm verify:app`. It is not a push gate; it runs in the browser-verification stage.

### Catalogues

Every new key is a literal `t()` call; run `pnpm i18n:extract`. `en-US` values are the English contracts above; `en-GB` may match. Each other shipped catalogue gets a translation in the voice of its neighbouring `Files.*` / `Databases.*` strings, not byte-identical to `en-US`. `pnpm i18n:check` checks keys and non-empty values.

### Container evidence

Component tests prove sentences; they do not prove visibility inside the Databases `overflow: hidden` panel, and the Files page test replaces Mantine with plain elements. Container cases for both pages, using the existing IPC mock (with `rootFailure` on the mocked payload) and the existing overflow, clipping and screenshot helpers: each of the five re-select presentations and `retry` renders its sentence; the Databases choose button is visible for the five and absent for `retry`; no clipping or horizontal overflow at the specs' narrow viewport. Success-layout checks stay.

## Decisions and trade-offs

Provenance: this plan starts from the set-aside draft `~/.claude/drain-plans/chessfable-0a459a4f/consumed/42548d18-1af4-46bd-a37c-20f82f9ba6c8-finding-f-20260913-05-rejected/plan.md` (seven rounds of planner review, rejected by the supervisor only for a mirrored-evidence defect on its round-7 `review-plan` row, not for plan content). It is not adopted as reviewed: this run re-runs a complete plan review from round 1. The draft's issue history (I1-I16) is prior evidence; its two Defers are on record as `f-20261003-02` (I8, picker `into_path` diagnostic) and the pending inbox entry `20261003-184054-586846-1791045654702385479-4.md` (I16, machine-readable listing reason). Base `1d0fc9ca` is the draft's refresh base, so no source drift separates the draft from this run.

## Decided autonomously

* Question: how does the renderer know which listing failures are root failures? Chosen: the backend labels them with an optional typed `rootFailure` on `ErrorPayload`, set only at root sites. Rejected: category plus exact message literals (the draft's design) — probe `probe-1-r1` shows the same category and literal arise from child entries, so it would tell users to choose another collection when one PGN vanished mid-listing (N9); it also copies eight backend strings into the renderer (draft I16). Rejected: new backend `ErrorCategory` values per root failure — they would replace the existing category every other consumer reads. Rejected: renderer-only hedged copy ("if this keeps happening, choose another") — it keeps the instruction wrong for one of the two cases. Rejected: a new `AppErrorCategory` (`d-20260901-34`, `d-20260904-06`).
* Question: how does the backend decide that a failure is a root failure? Chosen: an explicit `too-large` label where the bound and depth refusals are raised, and otherwise a read-only post-failure root probe in the two listing commands, labelling the probe's own error by variant. Rejected: labelling by variant at the root call sites (r2 draft) — root enumeration propagates child `statat` failures and a root swap can first surface inside a child step, so call-site origin is not root origin (plan r2, correctness r2). Rejected: threading an origin flag through `read_directory_entries_at` and the resolver — more surface in shared filesystem code, and it still cannot see a root swap the child step observes. Rejected: labelling poison, uninitialized authority, admission, registry capacity or persistence — choosing another root cannot recover them.
* Question: which variants map to which label? Chosen: `Io(NotFound)` missing, `Io(PermissionDenied)` permission, `InvalidInput` and `Io(InvalidInput)` unusable, `Conflict` changed; everything else unlabelled (plan r2 added `Io(InvalidInput)` for the default-root shape refusal).
* Question: what do the pages say for the over-bound listing? Chosen: `tooLarge`, "too large to list. Choose another.", with the Databases chooser (`d-20261003-12` gives this sentence to this finding). The bound number is not in the sentence; the backend owns it.
* Question: what does `changed` tell the user to do? Chosen: choose another. The same replaced path is refused by both pickers and mints nothing, so "choose it again" would be false. The picker's own same-path refusal is labelled `changed` and notifies the page's changed sentence.
* Question: shared component or two pages? Chosen: one presentation function and one picker guard shared by Files, Databases and `DirectorySetting`; page-owned copy and buttons. Rejected: one shared React alert (Files already has a header button; Databases must not show the button on retry). Rejected: leaving `DirectorySetting` on its own copy of the guard (rule 11; minimalism r1).
* Question: does recovery remove a stale entry? Chosen: no. There is no selected entry in a whole-list failure and no command that removes a root.
* Question: where does Databases re-select, and how does it refresh? Chosen: `issueDatabaseWorkspace` on the alert for the five re-select presentations; after a returned handle, supersede running `"databases"` generations, then revalidate. Rejected: a link to Settings; a bare `mutate()`, which can adopt a generation that already read the old root (plan r1); waiting for running generations, which a stalled old-root listing can block indefinitely (error-handling r2).
* Question: what is the Databases empty state during a failure? Chosen: empty-success only after a successful empty listing.
* Question: does a poisoned or uninitialized authority get its own sentence? Chosen: no, it stays on retry (error-handling r1, Skip with reason in Reviews).

## Risks / open questions

* Labelling must not change `category` or Display anywhere; every existing Rust and renderer test that asserts a payload, a message or a category is the regression net, and the serialization test pins the new field's absence by default.
* The probe adds one root resolution on the failure path only; it must not hold the authority lock across an await, must run off the async workers, and must not call `BLOCKING_GATEWAY` from inside a gateway closure (`async-resource-invariants.md`).
* The bound label is also set on the puzzle listing, which shares `CapabilityDirectory::entries`; nothing reads it there.

## Not part of this task

* Changing the listing bound, depth cap or registry cap (`f-20260913-06`, handled; `d-20261003-09` through `d-20261003-11`).
* Whether one unreadable or vanished child should fail the whole Files or Databases listing at all (filed separately in this run; see Reviews N10).
* Per-file database metadata errors in `getDatabase`.
* Settings directory rows' display strings and SWR behaviour; only the picker guard is shared.
* Mapping the picker `into_path` diagnostic to a stable error (`f-20261003-02`).
* A manual Retry button; SWR already revalidates.

## Known limits

* A poisoned or uninitialized path-authority mutex stays on the retry sentence; only a restart recovers it, and re-selection cannot.
* A full path registry (`path registry identifier limit reached`) stays on retry; it is not a property of the chosen root.
* A child-entry failure that recurs on every attempt (an unreadable child PGN or `.db3`) stays on the retry sentence; see N10.
* A custom database root that is unavailable when `getDatabaseWorkspace` runs is silently replaced by the default root, so the Databases page shows the default folder instead of the `missing` / `changed` alert; an in-listing root failure is labelled, but SWR's next automatic revalidation then falls back the same way. Dependency named: `f-20260917-12` owns that fallback, and this plan's labels and presentations are the renderer surface its re-selection prompt needs.
* The raw `into_path` diagnostic still reaches the renderer through the existing picker commands (`f-20261003-02`, open); this plan neither widens its content nor changes its serialization (Reviews N15).

## Phases

### Phase 1 — Root-failure reason, backend to facade

Files and subsystems: `src-tauri/src/error.rs`, `src-tauri/src/infra/fs.rs` (bound label), `src-tauri/src/file_workspace.rs`, `src-tauri/src/main.rs`, `src-tauri/src/infra/path_authority/mod.rs` (and their tests), regenerated `src/bindings/generated.ts`, `src/platform/errors.ts` and its tests. Touches the IPC payload contract (additive) and sensitive paths (`main.rs`, `infra/**`, `generated.ts`). No auth, persistence or concurrency change. Obligations: "Root-failure reason (backend contract)" and "Facade".

Model and effort: executor `codex`, leaf role `sensitive`.

Proof must show the Rust test list under "Root-failure reason (backend contract)", plus: `normalizeError` carries `rootFailure` from a payload and from `TauriCommandError.details`, and leaves it absent otherwise.

Platform proof: the new Rust tests run on every platform whose code path they exercise — gate a test with `cfg` only where its hook or fixture is platform-specific, and keep a portable root/child case where the producer is portable. `pnpm rust:windows:check` runs inside `checks:pre-review`. If a touched function has `cfg(target_os)` branches, the FreeBSD source probe (flip `target_os = "linux"` to `"freebsd"` in a scratch copy and `cargo check`) runs before the first push, except where `d-20261003-14` records the file-wide flip of `infra/fs.rs` and `path_authority/mod.rs` as a known limitation; there the probe's result is reported, not gated. `rust-windows-test`, `rust-macos-test` and the `rust-platform` matrix run in CI on the pushed SHA and are awaited by the push skill §4; a red job returns to repair.

PROOF COMMAND:

```bash
cargo test --manifest-path src-tauri/Cargo.toml --locked root_failure   # every new Rust test name contains root_failure
pnpm bindings:check
pnpm exec vitest run src/platform/errors.test.ts
pnpm checks:pre-review
pnpm gates:contract:check
```

### Phase 2 — Presentation, both pages, picker guard, catalogues, container cases

Depends on Phase 1 (the field). Files and subsystems: `scripts/verify-app.mjs` (the "Live-app evidence" assertion and its staged-failure row), the presentation function and its unit tests, `src/hooks/useNativeRequestOwner.ts` (supersede) and its test, the shared picker guard, `src/components/files/FilesPage.tsx` (+ test), `src/components/databases/DatabasesPage.tsx` (+ tests), `src/components/settings/DirectorySetting.tsx` (+ test), `src/components/files/notifyError.ts` if the changed-sentence notification lives there, the sixteen `src/translation/*.json` catalogues, and the container specs that render Files and Databases failures. No Rust edit. Obligations: "Listing presentation", "Files alert", "Databases alert", "Shared picker guard", "Catalogues", "Container evidence".

Model and effort: executor `codex`, leaf role `normal`.

The existing Files relist behaviour that throws `new Error("list unavailable")` must still render `Files.LoadFailed`. Private helpers and the SWR mock shape are the executor's.

Behaviours the proof must show, on rendered text (`defaultValue`), not on a presentation name alone:

* Each `rootFailure` value renders its sentence on each page; Databases shows Choose database folder for all five.
* An error with no `rootFailure` renders the retry sentence regardless of category (cover `conflict`, `missing-resource`, `permission`, `resource-limit`, `io`, and a plain `Error`); Databases shows no button.
* `Cancellation` renders no failure sentence and no button; Databases with no data shows the loading presentation, not `Databases.Empty.NoInstalled`; with cached data it keeps the list.
* A non-silent Databases failure with no data shows the alert and neither empty-state line; with cached data it keeps the list and shows the alert.
* Files header still shows Change collection during a re-select alert and still calls `issueFileWorkspace`.
* Databases chooser: a resolved `issueDatabaseWorkspace` leads to a relist that renders the new root's content and removes the alert, including when a revalidation of the old root was still pending when the picker resolved, when that old-root request never settles, when it settles with a non-cancellation rejection after the new root's content has rendered (no alert appears and the new content stays), and when the new root's listing fails and the old request settles afterwards (the new failure's sentence and button stay); cancellation neither notifies nor relists; a non-cancellation rejection notifies and does not relist; a second click while pending does not call the command twice.
* A picker rejection labelled `changed` notifies the page's changed sentence; any other rejection notifies its own message.
* `DirectorySetting` keeps its button, `aria-busy`, loading text, `onSelect` and `onError` behaviour through the shared guard.
* The presentation unit table covers every row, including that `message` is never read.

PROOF COMMAND:

```bash
pnpm exec vitest run src/components/common/listingFailure.test.ts src/components/files/FilesPage.test.tsx src/components/databases src/components/settings
pnpm i18n:check
pnpm test:e2e:container e2e/async-errors.spec.ts e2e/database-files.spec.ts e2e/files-preview.spec.ts
pnpm checks:pre-review
pnpm gates:contract:check
```

If the phase adds another container spec for these presentations, it is added to the e2e command. The run then performs cumulative review, `verify-ui` for the Files and Databases success layouts plus the "Live-app evidence" `pnpm verify:app` run, and `pnpm gates:push -- --rust --frontend --bindings` as the final affected gate.

## Carried to diff review

CR-1. A successful empty Databases listing, with no failure, renders `Databases.Empty.NoInstalled` and `Databases.Empty.AddHint` and no load-failure alert. The suppression rules must not delete that success state.

CR-2. Each new listing-failure key is rendered from every shipped catalogue with fallback disabled, and the rendered string equals that catalogue's value.

CR-3. Clicking Choose database folder invokes `issueDatabaseWorkspace` (asserted on the click, not only on visibility).

CR-4. After a cancellation and after a rejection, a second activation of each picker (Files, Databases, `DirectorySetting`) calls its command again: the guard does not stay latched.

CR-6. A Rust test cancels a listing before and during the post-failure probe and observes `Cancellation`, unlabelled.

CR-7. An owner-level test with two subscribers sharing one signal-ignoring generation: after supersession both receive the cancellation immediately, and a later fulfilment or rejection of the underlying work reaches neither.

CR-5. The facade test covers a renderer-only `AppError` (no `backendCategory`) with each collapsed category and asserts the presentation is `retry` unless a `rootFailure` is present.

## Appendix B — inherited draft review record (verbatim)

# Plan review: f-20260913-05

Cluster: singleton `f-20260913-05`, area frontend-ui. Plan: `tasks/plans/2026-10-03-listing-failure-copy.md`.

Rounds: 7. Rounds 1-4 reviewed the plan at `f0cbda6524234e94075fa3fa51f20404bf46ce58`. Rounds 5-7 are the PLAN-REFRESH to `1d0fc9ca5c23c219813741bd2e45f34c23ea277c` (drift round 5 over fourteen lenses, closure rounds 6 and 7). I1-I7 closed in round 2. I8 deferred to the bindings-ipc spool (`file --status` printed `published`). I9 and I10 closed in round 3. I11 carried as CR-1. I12 carried as CR-2. I13 (the listing bound now owned here; `tooLarge` presentation; frozen non-goal amended after a focused fresh-context `review-plan` judgment) closed in round 6. I14 skipped (round 5 had no plan revision). I15 (templates rather than fixed numbers; lineage I13) closed in round 7. I16 (no producer-consumer proof for copied literals) deferred to the bindings-ipc spool, receipt `20261003-184054-586846-1791045654702385479-4.md`. Open plan-level obligations: none.

Evidence warning: the mirrored `plan r7` pair is not one leaf's record. Its JSONL is the first capacity-failed attempt and its report is the third, completed attempt. The supervisor's evidence validation rejects that row. See "Evidence defect" under Round 7.

## Reviews

Round 1 of 2. Lens set: every plan-capable user-wide and project lens. Snapshot `$RUN_TMP/plan-r1.md`. Raw reports stay in `$RUN_TMP/lens-*-r1.txt`. Witness lens names are the validator's normalised names (`review-` stripped).

### Round 1 verdicts

| Lens | Verdict | Findings |
| --- | --- | --- |
| plan | REVISE | 4 |
| correctness | REVISE | 1 |
| minimalism | REVISE | 1 |
| tauri-security | REVISE | 1 |
| error-handling | APPROVED | 1 |
| tests | APPROVED | 1 |
| code-quality | APPROVED | 0 |
| ipc-contract | APPROVED | 0 |
| root-cause | APPROVED | 0 |
| platform-semantics | APPROVED | 0 |
| chess-semantics | APPROVED, NOT APPLICABLE: listing presentation and folder selection, no in-memory chess tree | 0 |
| engine-protocol | APPROVED, NOT APPLICABLE: no engine process or UCI state | 0 |
| persisted-state | APPROVED, NOT APPLICABLE: no persisted renderer state | 0 |
| pgn-index | APPROVED, NOT APPLICABLE: no PGN scan or index | 0 |

### I1 — changed copy promises a re-selection the picker refuses

* Witnesses: plan r1 finding 1.
* Raw: `[blocker] plan-r1.md:90 — “This database folder changed. Choose it again” promises recovery the existing picker refuses. `src-tauri/src/main.rs:1293` registers the selection with `expected_identity: None`; `src-tauri/src/infra/path_authority/mod.rs:5578` rejects the previously registered path after replacement. The existing test at `mod.rs:17080` asserts this refusal. The mocked success case at plan-r1.md:148 cannot detect that failure. Make the recovery instruction match supported behavior or explicitly resolve this dependency. (confidence: 99)`
* Verdict: REVISE.
* Evidence: confirmed. `issue_database_workspace_blocking` calls `get_or_create_database_root(&path, display_name, None)` (`main.rs:1293`). The `None` arm returns `Error::Conflict(format!("{changed_noun} root changed; select it again"))` (`mod.rs:5578-5580`) and does not mint an id. `database_root_reuse_rejects_a_replaced_directory` expects `"database root changed; select it again"` (`mod.rs:17085`). Files `promote_dialog` returns `"persistent target changed; acquire a new capability"` when an existing persistent entry's identity differs (`mod.rs:5065-5068`).
* Obligation: the `changed` sentence, MANDATE "retrying cannot succeed until the root is re-selected".
* Disposition: Fix. Correction: both changed sentences say "Choose another." Known limit records the same-path refusal. Closure pending round 2.
* Authority: not a new mechanism. The copy matches the recovery the existing commands already support.

### I2 — failure presentations have no container evidence

* Witnesses: plan r1 finding 2.
* Raw: `[blocker] plan-r1.md:158 — Browser verification covers success layouts only, leaving the changed alerts and new recovery button visually unverified. The proposed Files test style replaces Mantine containers with plain elements (`src/components/files/FilesPage.test.tsx:95`), while Databases places the alert inside an overflow-constrained panel (`src/components/databases/DatabasesPage.tsx:210`). A clipped recovery control could pass every proposed check. Require container-browser evidence for the failure presentations. (confidence: 95)`
* Verdict: REVISE.
* Evidence: confirmed. `FilesPage.test.tsx` replaces Mantine with plain elements. `DatabasesPage.tsx:210` is `overflow: hidden` on the panel that contains the alert. `e2e/async-errors.spec.ts` already mocks a database-workspace failure and calls `assertNoHorizontalOverflow`, `assertPageNotClipped`, and a screenshot.
* Obligation: verification level of the visible alert and the new Databases button.
* Disposition: Fix. Correction: container cases for the five visible presentations and the choose button, in the phase proof. Closure pending round 2.

### I3 — Databases paints empty-success when the listing has not succeeded

* Witnesses: plan r1 finding 3; error-handling r1 finding 1.
* Raw plan: `[blocker] plan-r1.md:146 — Cancellation tests assert only absent failure text and controls, leaving the loading/cached-content contracts at lines 79 and 94 unproved. Databases currently gates skeletons on `isLoading` (`src/components/databases/DatabasesPage.tsx:268`) and shows the empty state when it is false (`:330`). Merely hiding the alert would pass these tests while showing “no installed databases” after cancellation without data. Verify loading without cached data and retained content with cached data. (confidence: 94)`
* Raw error-handling: `[should-fix] /tmp/drain-plan-chessfable-0a459a4f-slot0/build/plan-r1.md:98 — For a settled initial Databases listing failure, `databases` is absent and `isLoading` is false, so the existing empty state also renders “No databases installed” and its Add New hint beneath the new failure alert. Specify and test that this success-shaped empty state is suppressed until a listing succeeds. (confidence: 91)`
* Verdicts: plan REVISE; error-handling APPROVED.
* Evidence: confirmed. `DatabasesPage.tsx:330` renders `Databases.Empty.NoInstalled` whenever `!isLoading && filteredDatabases.length === 0`, including a first load whose `data` is absent and whose `error` is set.
* Obligation: cancellation and failure presentation. MANDATE "please try again" is the wrong instruction; the empty-success sentence is a second wrong instruction for the same failed load.
* Disposition: Fix. Correction: empty-success only after a successful empty listing; cancellation and failure behaviors in the phase proof. Closure pending round 2.

### I4 — the plan freezes the test harness

* Witnesses: plan r1 finding 4.
* Raw: `[should-fix] plan-r1.md:134 — The prescribed private test helper, SWR mocking strategy and per-case test list belong in the phase brief. `src/components/files/FilesPage.test.tsx:49` contains the current harness; its implementation need not become a frozen plan contract. Retain behavioral and verification obligations in the plan. (confidence: 95)`
* Verdict: REVISE.
* Evidence: the round-1 phase named `commandError`, the SWR mock style, and `DatabasesPage.listing.test.tsx` as the contract. `FilesPage.test.tsx:49` is the existing harness.
* Obligation: verification. The behaviors stay; the helper shape does not.
* Disposition: Fix. Correction: the phase states rendered behaviors and the proof command, and it no longer prescribes the helper or the mock. Closure pending round 2. Not arbiter: the witness rank is should-fix, not nit.

### I5 — conflict is not "the folder changed"

* Witnesses: correctness r1 finding 1.
* Raw: `[blocker] /tmp/drain-plan-chessfable-0a459a4f-slot0/build/plan-r1.md:53 — If `getDatabaseWorkspace` fails because the path authority mutex is poisoned, `main.rs:1321` returns `Error::Conflict`. This mapping would say the database folder changed and offer re-selection, but `issue_database_workspace` also needs that mutex (`main.rs:1288`), so re-selection cannot recover. The category does not establish that the root changed. (confidence: 95)`
* Verdict: REVISE.
* Evidence: confirmed. `get_database_workspace_blocking` returns poison at `main.rs:1321` and uninitialized at `main.rs:1324`. `issue_database_workspace_blocking` locks the same mutex at `main.rs:1288-1292`. Display is `Conflict: {inner}` (`error.rs:237`), and Serialize sends that Display (`error.rs:499`).
* Obligation: which failures get the re-select sentence. MANDATE "a workspace or database root whose object changed (`Conflict`)". Poison is not that root.
* Disposition: Fix. Correction: `changed` is exact equality with the six object-changed literals. Poison, uninitialized, and the documented retryable child-walk conflicts stay `retry`. Closure pending round 2.

### I6 — the Databases picker repeats the Files in-flight guard

* Witnesses: minimalism r1 finding 1.
* Raw: `[should-fix] /tmp/drain-plan-chessfable-0a459a4f-slot0/build/plan-r1.md:98 — The new Databases picker repeats the pending guard, cancellation handling, and cleanup already in `FilesPage.chooseWorkspace` (`src/components/files/FilesPage.tsx:98`). Extract a shared picker runner that accepts the command and success callback, then route both pages through it. (`DirectorySetting` has the same in-flight guard at `src/components/settings/DirectorySetting.tsx:26`.) Confidence: 86`
* Verdict: REVISE.
* Evidence: confirmed. `FilesPage.chooseWorkspace` is the in-flight guard. The round-1 plan added the same sequence on Databases and left it inline.
* Obligation: "A second click must not open a second native dialog." MANDATE open question on a shared listing-error component versus the two pages.
* Authority: the frozen threat-model sentence "A second click must not open a second native dialog." The runner is the second copy of that guard, not a new filesystem authority.
* Disposition: Fix. Correction: one runner, Files and Databases only. `DirectorySetting` stays out because Settings is a frozen non-goal. Closure pending round 2.

### I7 — picker rejection is specified and not asserted

* Witnesses: tests r1 finding 1.
* Raw: `[should-fix] `/tmp/drain-plan-chessfable-0a459a4f-slot0/build/plan-r1.md:148` — The Databases picker tests cover success and cancellation, but not a non-cancellation rejection. If the handler stops using `runUnlessCancelled` or swallows a real picker error, these cases still pass despite the plan promising that the error is notified; add a rejection case asserting notification and no `mutate`. (confidence: 92)`
* Verdict: APPROVED.
* Evidence: the round-1 test list named success and cancellation only. The approach already said a thrown error is notified and does not call `mutate`.
* Obligation: verification of the picker failure semantics.
* Disposition: Fix. Correction: the phase proof requires a non-cancellation rejection that notifies and does not call `mutate`. Closure pending round 2.

### I8 — picker conversion diagnostic is pre-existing

* Witnesses: tauri-security r1 finding 1.
* Raw: `[should-fix] src-tauri/src/main.rs:1265 — If the native picker returns a `FilePath` that cannot be converted, its raw conversion diagnostic is interpolated into `Error::InvalidInput`. `src-tauri/src/error.rs:499` serializes that message into the renderer-facing payload, and the planned Databases picker flow displays it through `runUnlessCancelled`. Map it to a stable, safe error before serialization; renderer-side redaction happens after the diagnostic crosses the boundary. (confidence: 86)`
* Verdict: REVISE. Limitation recorded by the lens: no refresh-token flow in the named paths.
* Evidence: confirmed, and older than this plan. `issue_database_workspace` interpolates `invalid database folder selection: {error}` (`main.rs:1265`). `issue_file_workspace` and `issue_download_destination` interpolate `invalid native folder selection: {error}` (`file_workspace.rs:533`, `main.rs:1174`). Settings and Files already show those payloads. `related` on `native-fs` plus `main.rs` and `file_workspace.rs` found no entry for this interpolation. `f-20260915-04` is the engine-opener diagnostic, a different command. The findings inbox directory was absent, so no pending entry matched.
* Obligation: none of this mandate. A backend mapping would violate the frozen non-goal "no backend or IPC change". The hazard exists equally before the change.
* Disposition: Defer. Reason: out of area (`bindings-ipc`), pre-existing on three picker commands, and not made worse by showing the same command's error on the Databases alert. `findings.py related --area bindings-ipc --file src-tauri/src/main.rs --file src-tauri/src/file_workspace.rs` printed no pending-inbox note. `findings.py file --spool-only` published `/home/felixb/Projekte/chessfable/tasks/findings-inbox/20261003-061606-3307327-1791000966812673434-4.md`, and `file --status` on the same entry printed `published`. The complete entry, including the `Filed from` line the filer added, is the plan-meta `entry`. Closure of this Defer does not wait on a later lens round.

### Round 2 verdicts

Closure round over the round-1 corrections. Snapshot `$RUN_TMP/plan-r2.md`. Delta `$RUN_TMP/delta-r2.stdout`.

| Lens | Verdict | Findings |
| --- | --- | --- |
| plan | APPROVED | 0 |
| correctness | REVISE | 1 |
| error-handling | APPROVED | 2 |
| minimalism | APPROVED | 0 |
| tests | REVISE | 1 |

I1 CLOSED — plan r2: candidate lines for both changed sentences say "Choose another," matching `mod.rs:5065` and `:5578`.
I2 CLOSED — plan r2: container evidence and the forwarded spec list.
I3 CLOSED — plan r2 and error-handling r2: empty-success requires a successful empty listing; cancellation and failure suppress it.
I4 CLOSED — plan r2: the helper and SWR mock shape are no longer prescribed.
I5 CLOSED — plan r2 and correctness r2: six exact conflict messages; poison and the retryable workspace-directory conflict stay on retry.
I6 CLOSED — plan r2 and minimalism r2: one picker runner; `DirectorySetting` stays out.
I7 CLOSED — plan r2 and tests r2: a non-cancellation rejection notifies and does not call `mutate`.

### I9 — the decision summary reversed the retry rule

* Witnesses: correctness r2 finding 1; error-handling r2 finding 1.
* Raw correctness: `[blocker] tasks/plans/.plan-2026-10-03-listing-failure-copy.md-r2.body.md:141 — For `Conflict: path authority is unavailable because its object changed`, this summary says `changed` “leave[s]” the retry sentence, contradicting the presentation rules and acceptance, which require the changed sentence and Databases choose button. The summary needs to say these presentations leave the retry sentence behind. (confidence: 96)`
* Raw error-handling: `[should-fix] tasks/plans/.plan-2026-10-03-listing-failure-copy.md-r2.body.md:141 — This summary says `silent`, `changed`, `missing`, `unusable`, and `permission` “leave” the retry sentence, contradicting the presentation contract at lines 51–68. Correct the summary so it does not reverse which failures show retry copy (confidence: 99)`
* Verdicts: correctness REVISE; error-handling APPROVED.
* Evidence: the sentence was "which listing failures leave the retry sentence?" and then said those presentations "leave it". That reads as keeping the retry sentence. The presentation table says the opposite.
* Obligation: which failures replace the retry sentence.
* Disposition: Fix. Correction: the summary now says those four presentations show their own sentences and every other failure keeps the retry sentence. Closure pending round 3.

### I10 — the same-path picker toast still says to select it again

* Witnesses: error-handling r2 finding 2.
* Raw: `[should-fix] tasks/plans/.plan-2026-10-03-listing-failure-copy.md-r2.body.md:125 — If the new Databases picker is given the same replaced folder, the known rejection at line 165 is surfaced by `runUnlessCancelled` as `Conflict: database root changed; select it again` (`notifyError.ts:11`). That contradicts the “Choose another” recovery instruction. Specify an accurate user-facing message for this rejection (confidence: 93)`
* Verdict: APPROVED.
* Evidence: confirmed. `notifyUnlessCancelled` sets the toast message to `errorUnlessCancelled(error).message` (`notifyError.ts:11`). `Error::Conflict` Display is `Conflict: {inner}` (`error.rs:237`). The same-path database refusal is one of the six `changed` literals, and the Files refusal is `persistent target changed; acquire a new capability` (`mod.rs:5065`).
* Obligation: MANDATE "try again" is the wrong instruction, and I1's supported recovery is a different directory. The toast was the false instruction again.
* Authority: those mandate words. The mapping is which string the existing notification shows. It is not a new picker or a backend change.
* Disposition: Fix. Correction: those two redacted messages notify the caller's changed sentence. Every other non-cancellation error still notifies its own message. Closure pending round 3.

### I11 — successful emptiness is specified and not asserted

* Witnesses: tests r2 finding 1.
* Raw: `[blocker] tasks/plans/.plan-2026-10-03-listing-failure-copy.md-r2.body.md:189 — The planned assertions cover suppressing the empty state after failure or cancellation, but none requires a successful empty listing to render “No databases installed” and its hint. Removing the empty state would pass those assertions; the named container specs do not cover this case (`database-files.spec.ts` uses a populated database, and `async-errors.spec.ts` checks Accounts’ empty state). Add a successful-empty assertion. (confidence: 95)`
* Verdict: REVISE.
* Evidence: the Databases alert section already said a successful empty list renders today's empty state. The phase proof list did not require that render.
* Obligation: the success empty state, unchanged. The missing piece is the assertion.
* Disposition: Fix, carried to CR-1. The assertion is inside that existing obligation. Cumulative diff review closes CR-1.

### Round 3 verdicts

Closure round for I9 and I10. Snapshot `$RUN_TMP/plan-r3.md`.

| Lens | Verdict | Findings |
| --- | --- | --- |
| plan | APPROVED | 0 |
| correctness | APPROVED | 0 |
| error-handling | APPROVED | 1, under LATE OBSERVATIONS |

I9 CLOSED — plan r3, correctness r3, and error-handling r3: the summary says the four presentations show their own sentences and every other failure keeps the retry sentence.
I10 CLOSED — plan r3, correctness r3, and error-handling r3: the two exact same-path refusals notify the caller's changed sentence and do not mutate.

### I12 — catalogue values are not rendered with fallback disabled

* Witnesses: error-handling r3 finding 1.
* Raw: `[should-fix] tasks/plans/.plan-2026-10-03-listing-failure-copy.md-r3.body.md:131 — The locale obligation requires translations and `i18n:check`, while the phase proof checks only `en-US`. The localization contract requires testing these messages against shipped catalogues with fallback disabled; otherwise a wrong translation could give users the wrong recovery instruction. (confidence: 88)`
* Verdict: APPROVED. The line is a LATE OBSERVATION on settled catalogue text.
* Evidence: `docs/localization.md` says to test a finite set of messages against the shipped catalogues with fallback disabled after extraction. `pnpm i18n:check` checks the key set and non-empty values. The phase bullet named only the `en-US` equality.
* Obligation: the catalogue obligation already requires a translation in every shipped catalogue. This adds the assertion the localization doc names. It does not change the sentences.
* Disposition: Fix, carried to CR-2. Not a new plan-level mechanism. Cumulative diff review closes CR-2.

### Round 4 verdicts

Closure round for the carried catalogue assertion. Snapshot `$RUN_TMP/plan-r4.md`. No open issue.

| Lens | Verdict | Findings |
| --- | --- | --- |
| plan | APPROVED | 0 |

I12 stays carried as CR-2. The catalogue obligation and the phase proof now require the fallback-disabled render. No new finding.

### Round 5 verdicts — PLAN-REFRESH drift round

Refresh of the published plan from BASE `f0cbda6524234e94075fa3fa51f20404bf46ce58` to NEW-BASE `1d0fc9ca5c23c219813741bd2e45f34c23ea277c`. The plan body was byte-identical to the round-4 revision: `plan-review-delta.py plan-r4.md <plan> --round 5` printed `UNCHANGED` and exited 3. Correction evidence was the drift file `$RUN_TMP/drift-f0cbda6524234e94075fa3fa51f20404bf46ce58-1d0fc9ca5c23c219813741bd2e45f34c23ea277c.diff` (`git diff` of the two SHAs, verified byte-equal with `cmp`). Lens set: exactly `REFRESH-LENSES`, all fourteen. Snapshot `$RUN_TMP/plan-r5.md`; body `tasks/plans/.plan-2026-10-03-listing-failure-copy.md-r5.body.md`. Wall elapsed 965 s (stage start 1791043203, last report 1791044168), no quota or dependency wait.

| Lens | Verdict | Findings |
| --- | --- | --- |
| plan | APPROVED | 1, plus 1 `[out-of-drift]` |
| root-cause | REVISE | 1 |
| error-handling | APPROVED | 1 |
| correctness | APPROVED | 0 |
| tests | APPROVED | 0 |
| minimalism | APPROVED | 0 |
| ipc-contract | APPROVED | 0 |
| persisted-state | APPROVED | 0 |
| platform-semantics | APPROVED | 0. Limitation: the `f-20260913-06` record does not separately state `pnpm rust:windows:check`; this plan has no Rust edit. |
| tauri-security | APPROVED | 0 |
| code-quality | APPROVED, NOT APPLICABLE: drift does not change the listing presentation, picker, page, translation or e2e targets | 0 |
| chess-semantics | APPROVED, NOT APPLICABLE: no chess-tree obligation | 0 |
| engine-protocol | APPROVED, NOT APPLICABLE: no UCI or engine-process obligation | 0 |
| pgn-index | APPROVED, NOT APPLICABLE: no PGN scan or index obligation | 0 |

### I13 — the listing bound now lands here, and retry is the wrong instruction for it

* Witnesses: root-cause r5 finding 1; error-handling r5 finding 1; plan r5 finding 1.
* Raw root-cause: `[blocker] src-tauri/src/infra/path_authority/mod.rs:548 — The drift now caps listings at 4,096 names; a database folder over the cap returns `ResourceLimit` on each retry while that folder remains unchanged. The plan maps `resource-limit` to retry and omits the Databases choose-folder button for that presentation (plan lines 65, 113), leaving users without a recovery path. Its f-20260913-06 deferral is stale: d-20261003-12 assigns the Files and Databases sentence to f-20260913-05. (confidence: 95)`
* Raw error-handling: `[should-fix] src-tauri/src/infra/fs.rs:32 — `check_directory_listing_bound` now returns `ResourceLimit` at the 4,097th name, but Phase 1 maps that stable failure to “Please try again” and hides the Databases folder picker. Retrying the unchanged root will hit the same cap until entries are removed or another root is chosen. The drift also assigns the Files and Databases sentence to f-20260913-05, contradicting the plan’s claim that f-20260913-06 owns it. (confidence: 91)`
* Raw plan: `[should-fix] tasks/plans/.plan-2026-10-03-listing-failure-copy.md-r5.body.md:150 — Resource-limit ownership and status are stale. The drift adds the bound at `src-tauri/src/infra/fs.rs:32`, and `tasks/decisions.md:5031` explicitly assigns the Files/Databases sentence to f-20260913-05. Correct the ownership prose; this does not require changing the frozen retry behavior. (confidence: 100)`
* Verdicts: root-cause REVISE; error-handling APPROVED; plan APPROVED.
* Evidence: confirmed at NEW-BASE. `check_directory_listing_bound` returns `Error::ResourceLimit(format!("directory listing exceeded {limit} entries"))` (`infra/fs.rs:32-38`). Every `Some` limit is `MAX_DIRECTORY_LISTING_ENTRIES = 4_096` (`infra/fs.rs:29`; callers `infra/fs.rs:170`, `:2976`, `file_workspace.rs:406`; `platform_support.rs:1151-1156` pins `CapabilityDirectory::entries` as the only `Some`). The depth cap returns `"workspace listing exceeded {MAX_WORKSPACE_LISTING_DEPTH} levels"` with the constant at 64 (`file_workspace.rs:324`, `:366-368`, `:402-403`). Display is `Resource limit: {0}` (`error.rs:242-243`). `redact` replaces only secrets and `PATH_PATTERN` matches (`errors.ts:91-104`). `d-20261003-09` and `d-20261003-10` record no partial success and no registry write on refusal, so the unchanged root fails identically on every retry. `d-20261003-12`: "f-20260913-05 owns the Files and Databases sentence." The registry cap `path registry identifier limit reached` (`path_authority/mod.rs:8419-8420`) is not tied to the chosen root.
* Obligation: MANDATE "which categories get their own message and recovery action … versus the generic retry text" and "'try again' is the wrong instruction … retrying cannot succeed until the root is re-selected". The round-4 plan's premise, "f-20260913-06 owns that sentence", was removed by the drift.
* Disposition: Fix, plan-level and substantive (new presentation, two keys per page, the Databases button on that presentation, a changed frozen non-goal). Correction: `resource-limit` returns `tooLarge` only for the two exact redacted messages above; every other resource limit, including the full registry, stays `retry`. Files `Files.LoadFailed.TooLarge` and Databases `Databases.LoadError.TooLarge` ("… is too large to list. Choose another."), with the Databases choose button. The non-goal "no resource-limit message" now reads "other than the listing-bound sentence", with the amendment recorded under the threat model. Traced premise, Decided autonomously, Risks, Not part of this task, Known limits, and the Phase 1 behaviour list are updated to match. The adopted correction goes beyond the plan lens's ownership-only edit because keeping retry would leave the MANDATE's own defect in place for the bound. Closure pending round 6.
* Authority: MANDATE words above, plus `d-20261003-12`. This is not a new component, watcher, lock, protocol, state file or process. It is one more row in the existing presentation function and two more catalogue keys per page. The frozen non-goal changes, so round 6 asks a fresh-context `review-plan` for the focused judgment §4 requires: the contested invariant is "no resource-limit message"; the previous answer was that `f-20260913-06` owned it; the new evidence is `d-20261003-12` and the deterministic bound.

### I14 — the round-5 packet had no ROUND/DELTA block

* Witnesses: plan r5 finding 2 (`[out-of-drift]`).
* Raw: `[out-of-drift] [should-fix] tasks/plans/2026-10-03-listing-failure-copy.md:214 — Prior rounds are recorded, but the r5 packet omits the required script-produced `ROUND`, `DELTA`, `REVISED`, and `SETTLED` block (`/home/felixb/.claude/references/review-lens-contract.md:244`). This limits re-review coverage claims; no closure result was reconstructed. (confidence: 100)`
* Verdict: APPROVED.
* Evidence: `python3 ~/.claude/scripts/plan-review-delta.py $RUN_TMP/plan-r4.md tasks/plans/2026-10-03-listing-failure-copy.md --round 5 --out tasks/plans/.plan-delta-2026-10-03-listing-failure-copy.md-r5.diff` printed `UNCHANGED` and exited 3. Build §4: "Exit 3 (`UNCHANGED`): no plan revision exists, so never fabricate a revision round." Refresh mode makes the drift diff, not a plan delta, the round-5 correction evidence, and the packet named both SHAs and that file.
* Disposition: Skip. The claimed defect does not exist: there was no plan revision to produce a delta block for. Round 6 is a real revision and carries the script output.

### Round 6 verdicts

Closure round for I13, plus the focused fresh-context `review-plan` judgment that §4 requires for the amended frozen non-goal. Snapshot `$RUN_TMP/plan-r6.md`; body `tasks/plans/.plan-2026-10-03-listing-failure-copy.md-r6.body.md`; delta `tasks/plans/.plan-delta-2026-10-03-listing-failure-copy.md-r6.diff` (`plan-review-delta.py` exit 0, twelve REVISED headings). Lenses: `review-plan` and the I13 witnesses `root-cause` and `error-handling`. Also `correctness` and `tests` (newly affected: a new mapping row and new test obligations) and `minimalism` (MANDATE scope check). Every prompt named both refresh SHAs and the drift file. Wall elapsed 1231 s (launch 1791044371, last report 1791045602), no quota or dependency wait.

| Lens | Verdict | Findings |
| --- | --- | --- |
| plan | APPROVED | 0 |
| root-cause | APPROVED | 0 |
| error-handling | APPROVED | 1 |
| correctness | APPROVED | 0 |
| tests | APPROVED | 1 |
| minimalism | APPROVED | 0 |

I13 CLOSED — plan, root-cause, error-handling, correctness, tests and minimalism r6: both bound messages get the too-large presentation and the Databases chooser; the registry limit stays on retry; producers traced at `infra/fs.rs:29-38`, `file_workspace.rs:324-368,401-406`, `error.rs:242-243`, `path_authority/mod.rs:8414-8421`.

Focused judgment (fresh-context `review-plan` r6, verbatim): `JUDGMENT: Amending the frozen non-goal is justified by the deterministic listing bound and changed ownership premise (`tasks/decisions.md:5031`). Ownership-only correction would preserve the mandate’s misleading retry instruction. The exact-two-literal mapping is the simplest faithful mechanism within the unchanged IPC contract; mapping every resource-limit to tooLarge would misclassify registry exhaustion.` The other five lenses gave concurring `JUDGMENT:` lines. Recorded: contested invariant "no resource-limit message"; previous answer "f-20260913-06 owns it"; new evidence `d-20261003-12` and the deterministic bound; judgment "amend; two-message row"; obligation changes as in I13.

### I15 — the too-large match bakes today's bound values into the renderer

* Witnesses: error-handling r6 finding 1. Lineage: I13 (refines the r6 correction).
* Raw: `[should-fix] tasks/plans/.plan-2026-10-03-listing-failure-copy.md-r6.body.md:67 — exact matching bakes the current 4096-entry and 64-level values into the renderer. If either backend limit changes, its interpolated `ResourceLimit` message falls through to “Please try again,” although the same root will keep failing. The planned mocked tests cannot catch producer drift. Match anchored listing-specific message templates or add a producer-consumer contract proof (confidence: 92).`
* Verdict: APPROVED.
* Evidence: confirmed. Both messages interpolate a constant: `format!("directory listing exceeded {limit} entries")` (`infra/fs.rs:34-35`) and `format!("workspace listing exceeded {MAX_WORKSPACE_LISTING_DEPTH} levels")` (`file_workspace.rs:367-368`). A changed constant changes the message, and the r6 exact strings would then miss.
* Obligation: Listing presentation, the `tooLarge` predicate (I13's correction). MANDATE "'try again' is the wrong instruction … retrying cannot succeed".
* Disposition: Fix, plan-level (it changes the mapping contract). Correction: `tooLarge` matches two whole-message templates, `Resource limit: directory listing exceeded <n> entries` and `Resource limit: workspace listing exceeded <n> levels`, with `<n>` one or more ASCII digits and the surrounding text compared exactly, never as a substring. The unit table covers today's numbers, one other number each, and near misses that stay `retry`. Decided autonomously and Known limits updated. Closure pending round 7.
* Authority: not a new mechanism. It changes the comparison inside the I13 row.

### I16 — no proof ties the copied literals to their Rust producers

* Witnesses: tests r6 finding 1.
* Raw: `[should-fix] tasks/plans/.plan-2026-10-03-listing-failure-copy.md-r6.body.md:206 — The new table tests copied messages through `normalizeError`, while the page and container tests use mocked IPC. No listed proof ties those literals to the Rust producers: the directory-bound test checks only category and tag, and the depth test checks only the error variant. If either producer’s wording changes, real listings can fall back to retry while the planned suite stays green; the plan acknowledges this limit at line 177. (confidence: 93)`
* Verdict: APPROVED.
* Evidence: confirmed. The bound serialization test builds its own `Error::ResourceLimit("directory listing exceeded 4096 entries")` and asserts only `category` and `tag` (`infra/fs.rs:5732-5735`); the depth test asserts `matches!(error, Error::ResourceLimit(_))` (`file_workspace.rs:3283`). The six `changed` literals share the same property, recorded since I5. `f-20260830-08` (handled) removed substring classification. The payload has no field that distinguishes reasons inside one category (`ErrorPayload { tag, category, message }`).
* Obligation: verification level of the copied literals. It does not block the MANDATE: today every literal matches its producer, as traced in I5 and I13.
* Disposition: Defer. Reason: the durable fix is a machine-readable reason from the backend, which is an IPC and generated-binding change (frozen non-goal "no backend or IPC change"), in area `bindings-ipc`, with an open design question bounded by `d-20260901-34` and `d-20260904-06`. A renderer source-scan of Rust files would be a new mechanism with no MANDATE authority. `findings.py related --area bindings-ipc --file src-tauri/src/error.rs --file src/platform/errors.ts` showed `f-20260830-08` (handled) and no open entry for this. The findings inbox directory was absent, so nothing was pending. `findings.py file --spool-only --inbox /home/felixb/Projekte/chessfable/tasks/findings-inbox` published `/home/felixb/Projekte/chessfable/tasks/findings-inbox/20261003-184054-586846-1791045654702385479-4.md` ("entry awaits a merge"). Known limits names it. The numeric half of the same risk is I15, fixed here.

### Round 7 verdicts

Closure round for I15. Snapshot `$RUN_TMP/plan-r7.md`; body `tasks/plans/.plan-2026-10-03-listing-failure-copy.md-r7.body.md`; delta `tasks/plans/.plan-delta-2026-10-03-listing-failure-copy.md-r7.diff` (`plan-review-delta.py` exit 0, five REVISED headings). Lenses: `review-plan`, the I15 witness `error-handling`, plus `correctness` and `tests` (the predicate and its unit-table obligations changed). Every prompt named both refresh SHAs and the drift file. Wall elapsed 634 s (launch 1791045718, last report 1791046352). That includes two Codex capacity failures of `lens-plan-r7`, retried on the same route by `leaf-quota-retry.py --capacity` (`executor-profiles.md` §1h; fixed delays of 60 s and 180 s, wait category other: provider capacity). The third attempt completed.

Capacity evidence handling: the planner evidence mirror copies only top-level `RUN_TMP` files, and the §1h helper writes each retry into a nested `<name>.capacity-retry-<n>/` directory. The completed attempt's `lens-plan-r7.jsonl`, `.txt` and `.err` were copied to the canonical top-level names (byte-identical, `cmp`; jsonl sha256 `715b09da…bc8a3`). Its prompt is byte-identical to the original `lens-plan-r7.prompt`. The first failed attempt moved to `$RUN_TMP/capacity-attempts/lens-plan-r7.attempt-0/` (jsonl sha256 `11339419…0e1d4`, terminal `turn.failed` "Selected model is at capacity"). The second stays in `$RUN_TMP/lens-plan-r7.capacity-retry-1/` (sha256 `deeac613…1ce8e`). Neither failed attempt carries a review report.

Evidence defect, found after the fact and not repairable by this planner: the supervisor's live evidence mirror (`slot-2/run/evidence/`) is write-once by name, and it had already copied the first failed attempt's `lens-plan-r7.jsonl` (sha256 `11339419…0e1d4`, terminal `turn.failed`) before the promotion above. It then copied the promoted `lens-plan-r7.txt` (sha256 `d37606ed…`, the third attempt's report). The mirrored pair for `plan r7` is therefore a failed-attempt JSONL beside a completed-attempt report. That pair is not one leaf's record. A dry run of `validate_review_evidence` over a copy of that mirror (refresh bases and the published round 1-4 manifest supplied) returned `failed review-evidence: terminal/profile/verdict (plan r7: terminal=failed verdict='APPROVED' profile_clean=None)`. The planner may write only `tasks/plans/` and `RUN_TMP`, so it cannot correct the mirror. The I15 closure by `review-plan` rests on the third attempt's genuine JSONL, `$RUN_TMP/lens-plan-r7.jsonl` (sha256 `715b09da…bc8a3`, terminal `turn.completed`), and on the three other r7 lenses. Root cause in the kit: `mirror_review_evidence` and the live mirror read only top-level `RUN_TMP` names, while `leaf-quota-retry.py --capacity` writes each retry under a nested `<name>.capacity-retry-<n>/`. A planner lane that needs a §1h retry cannot produce a valid row for that leaf, and promoting the retry by hand races the live mirror. Promoting it was a mistake on this run.

| Lens | Verdict | Findings |
| --- | --- | --- |
| plan | APPROVED | 0 |
| error-handling | APPROVED | 0 |
| correctness | APPROVED | 0 |
| tests | APPROVED | 0 |

I15 CLOSED — plan, error-handling, correctness and tests r7: whole-message templates with an ASCII-digit slot; today's bounds, another number per template, and near misses on retry are required; producers `infra/fs.rs:34-35`, `file_workspace.rs:367-368`, prefix `error.rs:242-243`.

### Review totals after the refresh

Completed rounds 7 (1-4 at BASE, 5-7 in this refresh). Unique issues opened 16, resolved 16: Fix closed 11 (I1-I7, I9, I10, I13, I15), Fix carried 2 (I11 as CR-1, I12 as CR-2), Defer 2 (I8, I16, both spool-published), Skip 1 (I14). Open plan-level obligations: none. Adoptions per round `r1=8 r2=3 r3=0 r4=0 r5=1 r6=1 r7=0`. I14 has no parsed witness: its raw line begins `[out-of-drift] [should-fix]`, which the validator's finding regex (`^\s*\[(blocker|should-fix|nit)\]`) does not parse, so its plan-meta row lists no witness and quotes the line in its reason. Correction-introduced defects: 1. I15 was introduced by I13's correction (revision r6), carries lineage I13, and closed in r7. Downstream implementation and final-review rework: none yet, because this is a planner lane. Non-convergence trigger not reached: the last three rounds adopted 2 issues.

