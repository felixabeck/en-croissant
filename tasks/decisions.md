# Technical decisions made while working findings

Findings are worked in **fresh sessions**, so a decision that lives only in a run's context is lost
the moment that run ends — and the next session re-derives the question and can land on the other
option. This file is what later sessions read instead. `scripts/findings.py next` prints the entries
governing the cluster it picks.

**A decision here is input, not an open question.** The rules for reversing one, the second-reversal
park, and why the whole mechanism exists are in
`~/.claude/references/findings-ledger-contract.md` ("Decisions bind later sessions"). Not repeated
here. Universal rule 4c applies without exception: a recorded decision is reversed by Felix, in the
chat, and by nothing else, and no session writes `(Felix, <date>)` against something he did not say.

**Technical calls only** — which mechanism, which default, which failure mode is preferable.

## Format

```
### d-YYYYMMDD-nn — <the question, as a question>

* **Governs:** f-20260829-01
* **Chosen:** <what was decided>
* **Rejected:** <the alternative, and it must be a real one>
* **Because:** <the reason, in terms a later session can check against evidence>
* **Decided by:** <session/run> · **Superseded-by:** -
```

---

### d-20260829-01 — Where does the canonical Playwright rasterization environment live?

* **Governs:** -
* **Chosen:** the pinned container image `mcr.microsoft.com/playwright:v1.62.1-noble`, used both
  locally (`pnpm test:e2e:container`) and by the CI e2e step, with the committed snapshots recorded
  inside it.
* **Rejected:** re-recording the snapshots natively on `tuxedo-atlas` and treating that machine as
  the reference (it moves the failure to every other machine, including the CI runner, so the
  visual matrix could never be verified anywhere but atlas); and relaxing the comparison with
  `maxDiffPixelRatio ≈ 0.02` (the observed antialiasing noise is ratio 0.01, so a threshold wide
  enough to absorb it also absorbs a genuinely changed label).
* **Because:** the 8 failing specs differed only along glyph edges — every box, icon and control
  aligned to the pixel — so the defect was the *environment*, not the layout or the tolerance. One
  canonical environment removes the machine from the measurement instead of widening the gate.
* **Measured after deciding, 2026-08-29:** the committed snapshots needed **no** rewrite. All eight
  specs pass unchanged inside the image (`8 passed (18.2s)`), so the images already match what it
  renders and `tuxedo-atlas` running natively is the outlier. Nothing was re-recorded.
  `pnpm test:e2e:update` was repointed at the container runner on the same day, so there is no
  script that re-records on the host at all; a direct `playwright … --update-snapshots` stays
  denied in `.claude/settings.json`.
* **Decided by:** Felix, in the chat, 2026-08-29 · **Superseded-by:** -

### d-20260829-02 — The coverage baselines record a machine nobody uses. Re-record, or keep them?

* **Governs:** f-20260829-06, f-20260829-01, f-20260829-04
* **Chosen:** re-establish both baselines from the canonical environment, in two steps so the
  backend is measured and not assumed — re-record the frontend baseline on atlas (which measures
  identically to CI), push, let CI run through to the backend ratchet, then re-record the backend
  baseline from CI's own LCOV artifact. Every per-area delta is listed in the commit message so a
  later reader can audit each one instead of trusting a rewritten file.
* **Rejected:** keeping the baselines and accepting a permanently red `test.yml` (one stale number
  would keep eleven working gates switched off — `build-vite`, `bindings:check`, `bundle:check`,
  the container e2e, `mutation:frontend` and the whole Rust half never run again); and weakening the
  ratchet to compare covered counts only, which would pass today but would stop catching a change
  that adds untested lines faster than tested ones — the property the ratchet exists for.
* **Because:** CI run 33275934621 measured `tauri-ipc-platform` at 156/218, byte-identical to
  atlas, while the baseline records 155/215. Two independent current environments agree and the
  baseline matches neither, so it describes the laptop the 2026-08-09 audit ran on. Covered lines
  went **up** (156 vs 155) on an unchanged tree; only the counted total rose, so the ratio slipped.
  This is re-recording on a changed instrument, not silencing a regression — which is the case
  `docs/coverage.md` actually forbids.
* **Standing constraint this does NOT relax:** `coverage:baseline:*` stays denied in
  `.claude/settings.json`, and a red ratchet still means "investigate", never "re-record". Lifting
  it requires a recorded decision like this one, naming the evidence that the baseline — not the
  code — is what moved. Do not cite this entry as precedent for a re-baseline that lacks such
  evidence.
* **Decided by:** Felix, in the chat, 2026-08-29 · **Superseded-by:** -

### d-20260829-03 — Deleting a covered dead branch trips the ratchet. Refresh, or keep the dead code?

* **Governs:** f-20260829-08, f-20260829-15
* **Chosen:** refresh the baseline for the one metric that moved. Removing the dead
  `queuedGeneration !== null` clause deleted one branch that happened to be covered, so
  `boards-game-analysis` branches went 181/5677 to 180/5676 — numerator and denominator each down
  by exactly one, because the branch no longer exists.
* **Rejected:** restoring the dead clause to keep the number. That would let the gate dictate worse
  code — and the clause is provably unreachable-as-false, which is why mutation testing flagged it.
* **Because:** `docs/coverage.md` forbids refreshing a baseline *to accept a regression*, and treats
  refreshing as ordinary practice otherwise ("new security or IPC surfaces require focused tests
  before the baseline is refreshed"). No behaviour lost coverage here: a branch that could never be
  false stopped existing. The audit is one line wide and in the commit message, so the claim is
  checkable rather than asserted.
* **Note the general problem this exposes:** the ratchet rejects a lower covered count outright, so
  it penalises *deleting* covered code — exactly the cleanup mutation testing asks for. Filed as
  f-20260829-15; this decision is the local workaround, not the fix.
* **Decided by:** Claude Code, autonomously while Felix was away, under his standing instruction to
  proceed — flagged in the report for him to reverse if he disagrees · **Superseded-by:** -

## 2026-08-30 — recorded through the decisions lock

### d-20260830-01 — How does the recursive delete bind a verified inode to the syscall that acts on it: `openat2` or `fstat` on the opened descriptor?

* **Governs:** f-20260830-02, f-20260830-05
* **Chosen:** `openat(..., NOFOLLOW)` followed by `rustix::fs::fstat` on the descriptor actually
  held, compared against the inode `RawDirEntry::ino()` reported for that child; plus the expected
  identity threaded from `remove_entry_at` into the walk so `assert_entry_identity`'s result is used
  rather than recomputed; plus the child's own `statat` compared against the listing, which costs no
  extra syscall because the recursion already performs it.
* **Rejected:** `openat2` with `RESOLVE_NO_SYMLINKS` / `RESOLVE_BENEATH` / `RESOLVE_NO_XDEV`.
* **Because:** four reasons, none of them effort. (1) `openat2` resolves a *name*, so a directory
  substituted for another directory *inside* the subtree is opened normally — it does not close
  f-20260830-02, and the `fstat` comparison would be needed beside it anyway. (2) It does nothing
  for the depth bound. (3) rustix 1.1.4 issues the raw `__NR_OPENAT2` syscall with no fallback
  (`backend/linux_raw/fs/syscalls.rs:83`) and returns `ENOSYS` below Linux 5.6, so a delete
  primitive built on it stops working rather than checking less — a second implementation must
  exist beside it. (4) It deepens the Linux-only dependency in a file that already cannot compile
  for three of the four configured release targets.
* **Decided by:** Claude Code, autonomously under `full auto` while Felix was away · **Superseded-by:** -

### d-20260830-02 — Is the recursion depth capped, or is the walk converted to an iterative explicit stack?

* **Governs:** f-20260830-03
* **Chosen:** keep the recursion and bound it — `MAX_REMOVE_TREE_DEPTH = 64`, refusing with
  `Error::ResourceLimit`, with `REMOVE_TREE_DIR_BUFFER_BYTES = 8192` named beside it because the
  worst-case stack is the product of the two (~512 KiB against a Tokio worker's 2 MiB).
* **Rejected:** converting the walk to an iterative explicit stack of descriptors.
* **Because:** the iterative form removes the stack-overflow class rather than capping it, which is
  genuinely the stronger property — but it trades the thread stack for `RLIMIT_NOFILE` (commonly
  1024) and still needs one `RawDir` buffer per open level, so the memory moves to the heap and the
  resource is merely a different one. `.claude/rules/async-resource-invariants.md` requires a stated
  bound either way, so the bound has to be paid for in both designs; having paid for it, the
  recursion is the smaller expression of the same guarantee.
* **Decided by:** Claude Code, autonomously under `full auto` while Felix was away · **Superseded-by:** -

### d-20260830-03 — How is a mount boundary detected, and what does the walk do below the kernel version that can detect it?

* **Governs:** f-20260830-05
* **Chosen:** `statx` with `StatxAttributes::MOUNT_ROOT` as the primary check, guarded by
  `stx_attributes_mask` exactly as rustix's own documented recipe does
  (`rustix-1.1.4/src/fs/statx.rs:183-200`), with an `st_dev` comparison against the parent as a
  backstop. Crossing is refused with `Error::InvalidInput`. Below Linux 5.8 only `st_dev` applies,
  and the residual — a same-filesystem bind mount is invisible there — is stated in a code comment
  and filed as its own finding rather than described as graceful degradation.
* **Rejected:** three alternatives. (a) `st_dev` alone, which was this run's first choice and is
  wrong: a bind mount whose source is on the same filesystem keeps the device number, so it accepts
  exactly the case the finding names. (b) Refusing to descend whenever the kernel cannot prove the
  absence of a mount, which stops permanent deletion from working at all below 5.8. (c) Parsing
  `/proc/self/mountinfo`, which is complete on any kernel but adds a parser and a `/proc`
  dependency and carries its own read-then-mount race.
* **Because:** (a) is a correctness failure and was reversed on lens evidence within this run. (b)
  breaks a working feature for users on pre-2020 kernels in order to defend against a configuration
  that requires `CAP_SYS_ADMIN` or a user namespace to create — the wrong trade in the wrong
  direction, since the uncovered case is a user who mounted something into their own workspace
  rather than an attacker. (c) buys the residual back at the cost of permanent parsing surface for
  a case already covered on every kernel since August 2020.
* **Note for whoever answers the supported-platform question:** if Linux 5.8 is declared the floor,
  `MOUNT_ROOT` becomes unconditional and both the backstop and the filed residual disappear.
* **Decided by:** Claude Code, autonomously under `full auto` while Felix was away · **Superseded-by:** -

### d-20260830-04 — What happens to the authority record when a recursive delete fails partway, and when it completes but the parent sync fails?

* **Governs:** f-20260830-04
* **Chosen:** two different answers, because the two states are different. On a **partial** removal
  the record is **kept**: the top directory still exists — `unlinkat(REMOVEDIR)` never ran — with an
  unchanged inode, so the record still resolves to the object it names and is accurate. On a
  **completed** removal whose final `parent.sync_all()` failed, the record is **removed** and
  `Error::CommittedDurabilityUncertain` is returned afterwards, because the entry is genuinely gone.
* **Rejected:** removing the record on a partial removal (it would discard a valid capability and
  leave the surviving files unreachable until a relist), and the current code's `?` on the sync
  failure (it exits before `remove_workspace_entry`, keeping a record for an entry that no longer
  exists — the exact stale-state defect this cluster exists to remove).
* **Because:** the authority's invariant is that a usable record resolves to the same object and
  type it recorded (`path_authority.rs:3325`, `:3614-3635`). A partial removal does not violate it;
  a completed removal does. Mapping the sync failure to `CommittedDurabilityUncertain` without also
  fixing the caller would have made that path strictly worse than the plain `Io` it replaces — a
  review lens caught this at 99 confidence.
* **Not fixed here, and filed separately:** every *descendant* of a removed directory keeps its own
  authority record, on the successful path too, because `tree_entry` registers each one
  (`file_workspace.rs:218-245`) and `remove_workspace_entry` removes exactly one
  (`path_authority.rs:3361`). That is an unbounded registry against
  `.claude/rules/async-resource-invariants.md` and belongs to `path_authority.rs`.
* **Decided by:** Claude Code, autonomously under `full auto` while Felix was away · **Superseded-by:** -

### d-20260830-05 — How does the renderer learn that a destructive operation partly happened, given that every backend error crosses IPC as a plain string?

* **Governs:** f-20260830-04
* **Chosen:** a `partially-applied` category in `src/platform/errors.ts`'s `normalizeError`,
  matching the two static message literals `partially removed:` (`Error::PartialRemoval`) and
  `committed but durability uncertain:` (`Error::CommittedDurabilityUncertain`), placed before the
  existing `not found` / `missing` tests so a nested cause cannot capture it. `FilesPage` relists
  only on that category and its copy does not promise that a refresh succeeded. The contract is
  pinned by three tests: the backend asserts the exact serialized literal, the frontend asserts that
  literal categorises, and the component test asserts the rendered copy — because the test
  translation mock returns `defaultValue`, so a category assertion alone would not notice the copy
  reverting.
* **Rejected:** giving `Error` a real `specta::Type` instead of the hand-written
  `DataType::Primitive(String)` at `error.rs:225-231`, so the renderer receives a structured error.
* **Because:** that is the right long-term answer and it is a repo-wide IPC decision, not this
  cluster's: it re-types the error of every `#[tauri::command]` in the application, regenerates
  `src/bindings/generated.ts` wholesale, and needs a ruling on how much backend detail may cross
  into the renderer at all — `.claude/rules/ipc-events.md` forbids moving a raw backend diagnostic
  there, so a structured error must be designed rather than derived. It is filed as its own finding.
  Until then the substring idiom is the file's own established mechanism (eleven existing keys), and
  the three tests are what make its fragility loud instead of silent.
* **Decided by:** Claude Code, autonomously under `full auto` while Felix was away · **Superseded-by:** -

### d-20260830-06 — Does `Error::PartialRemoval` carry its cause as a `String` or as a typed error?

* **Governs:** f-20260830-04
* **Chosen:** `PartialRemoval { removed_entries: usize, cause: Box<Error> }`.
* **Rejected:** `cause: String`.
* **Because:** the walk stops for materially different reasons — `ResourceLimit` (depth bound),
  `Conflict` (an entry was substituted), `InvalidInput` (a symlink, a special file, a mount) — and a
  backend caller that wants to distinguish them is exactly who this error is for. Flattening to a
  string at construction discards that for no gain, since the outer `Display` flattens it for IPC
  either way. `removed_entries` rather than `removed` so the unit is readable from the shape.
* **Decided by:** Claude Code, autonomously under `full auto` while Felix was away · **Superseded-by:** -

### d-20260830-07 — `docs/coverage.md` and the repo-root `CLAUDE.md` both say the coverage ratchet rejects a larger total. The implementation says it deliberately does not. Which is corrected?

* **Governs:** -
* **Chosen:** correct both documents to match the implementation. `scripts/coverage-report.mjs:249-257`
  runs exactly two ratchets, with a comment written on purpose: *"Two independent ratchets, and
  deliberately no third one on `total`"* — covered may never drop, and the ratio may never drop.
  Fully covered growth passes, and a *shrinking* total (deleting dead or untested code) improves
  both ratchets and must pass.
* **Rejected:** adding a total ratchet to the script so the documents become true.
* **Because:** the code's comment states the reason the third ratchet was left out, and it is
  right — a total ratchet punishes deleting untested code, which is the cleanup mutation testing
  asks for and which `d-20260829-03` already recorded as a live problem. The documents are the
  thing that drifted.
* **Why this is worth recording rather than just editing:** the wrong sentence is in the
  always-loaded project contract, so every agent reads "a larger total is rejected" and can talk
  itself into rewriting a baseline it never needed to touch — which `docs/coverage.md` and
  `d-20260829-02` both forbid. The stale doc was actively pushing toward the one action the rule
  prohibits.
* **Decided by:** Claude Code, autonomously under `full auto` while Felix was away · **Superseded-by:** -
