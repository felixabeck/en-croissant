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

### d-20260830-08 — The coverage ratchet rejects deleting covered code. Which repair?

* **Governs:** f-20260829-15, f-20260829-04
* **Chosen:** compare against a baseline shrunk by however many records the measurement lost.
  `totalShrink = max(0, prior.total - actual.total)`; both the covered clause and the ratio clause
  run against `(prior.covered - totalShrink, prior.total - totalShrink)`. When the total does not
  shrink the allowance is zero and the rule is arithmetically identical to the previous one. The
  allowance is bounded by the shrink and every use that changes a verdict is printed.
* **Rejected:** a ratio tolerance — an arbitrary constant that readmits exactly the small
  regressions `docs/coverage.md` says the ratchet exists to catch, unboundedly at small area sizes;
  scaling the expected covered count by the change in total — proportional, so it forgives cover
  lost on records that were **not** deleted whenever the total also moved; the finding's own
  "exempt a decrease whose covered/total deltas are equal" — it handles only the exactly-balanced
  case and wrongly fails a mixed deletion of 1 covered plus 2 uncovered records, which is the
  ordinary shape of deleting a dead block; and record-level baselines, which would resolve the
  ambiguity outright and are ruled out because this repository has measured that ~170 `BRDA`
  block/branch identities flip per build with no source change, so such a baseline would be
  permanently red.
* **Because:** the chosen rule is the finding's own third suggestion generalised to its correct
  bound, with no constant anywhere. Note that the finding named only the covered clause; the ratio
  clause is equally guilty, since `(c-1)/(t-1) < c/t` for every ratio below 1, and the observed
  incident fails both — `180*5677 = 1021860 < 1027356 = 181*5676`.
* **The residual is named rather than hidden.** Four aggregate numbers cannot distinguish "one
  covered record was deleted" from "one uncovered record was deleted and another lost its tests",
  and instrument drift can shrink the total with no deletion at all. That ambiguity is irreducible
  at this layer. It is answered by bounding the allowance to the observed shrink and by announcing
  every use in the gate output, not by pretending it does not exist.
* **Consequence that constrains later work:** `scopeSignature` is now the only guard against
  narrowing the measured set, because a narrowing looks exactly like a deletion to the numeric
  ratchets. Any future change to *what gets measured* must be expressed through the config so it
  reaches that signature — including f-20260829-04's exclusion, whose implementation must therefore
  extend `scopeSignature` too.
* **Decided by:** Claude Code, autonomously under `full auto` while Felix was away, after three
  rounds of six plan-review lenses · **Superseded-by:** -

### d-20260830-09 — f-20260829-04 was pinned for this run. Land the instrument change, or park it?

* **Governs:** f-20260829-04
* **Chosen:** park it on Felix with `Blocked: felix-decision` and the complete measurement, and
  deliver the other three findings of the cluster.
* **Rejected:** landing it under an autonomous decision citing d-20260829-02 and d-20260829-03 as
  precedent; and landing the exporter change without the simultaneous re-record, which leaves every
  backend gate red and is not a coherent partial state.
* **Because:** completing it requires re-recording `backend-coverage-baselines.json` and
  re-deriving `minimumCoverage`, since 14 of 18 area floors break under the corrected instrument.
  The baseline-writing commands sit in `.claude/settings.json`'s `deny` list and the harness
  genuinely refuses them — verified during this run, where even a bare `echo` of the pattern was
  refused, not only the real command. The only non-denied route is a differently-phrased invocation
  of the same code, which the repo `CLAUDE.md` names as evasion and forbids. That is a hard external
  constraint, the one ground universal rule 4 accepts.
* **What was wrong with the first version of this reasoning, recorded because it matters.** The
  first draft justified the park by citing the deny list, which `CLAUDE.md` itself calls "a speed
  bump rather than enforcement", and missed that **d-20260829-02 names f-20260829-04 in its own
  `Governs:` line** and prescribes the re-record procedure. Four plan-review lenses called that a
  deferral in an authority costume and were right about the argument. The conclusion survived only
  because the constraint was then tested instead of asserted; three lenses in the following rounds
  re-examined it and returned "genuine external constraint".
* **Not a `Skip` and not a deferral for cost:** effort, risk, size and recency played no part, and
  the mechanism is fully specified in the finding so the answering session implements rather than
  investigates.
* **Decided by:** Claude Code, autonomously under `full auto` while Felix was away · **Superseded-by:** -

### d-20260830-10 — Where does the mutation guard live, and does it get an escape hatch?

* **Governs:** f-20260829-09
* **Chosen:** both ends, and no escape hatch. The runner owns an fsynced exclusive fence and answers
  `--check-guard` as a mode on itself; `$push` runs `pnpm mutation:guard:check` before any other
  gate. The entry refusal on a dirty `src-tauri` has no override.
* **Rejected:** a push-skill-only guard — the hazard is an *abort*, which no skill is present to
  observe, and `.github/workflows/mutation.yml` invokes the runner directly, so it would protect
  neither CI nor a manual run; a runner-only guard — invisible to the concurrent session that is
  about to commit, which is where the damage actually happens; a separate
  `scripts/check-mutation-guard.mjs` — it would give the fence invariant two implementations; a CI
  step for the guard check — vacuous, because CI runs in a fresh checkout where a gitignored fence
  cannot exist, the same defect this repository already hit when two `ui:boundary:check` rules were
  diff-scoped; and an `--allow-dirty` flag or env var, whose only use is the case the guard exists
  to prevent.
* **Because:** the finding left "runner or push skill" open, and the answer is that neither is
  sufficient alone. The prose in the skill is kept honest by a test that asserts the skill still
  names the command, so deleting the wiring turns a test red instead of passing silently.
* **Related design point:** safety does not depend on the recorded cargo pid. `spawn` creates the
  child before its pid can be written to the fence, and that window cannot be closed at this layer,
  so recovery's first step is always "confirm no `cargo mutants` process is running" whether or not
  a pid was recorded. The pid only makes that step precise.
* **Decided by:** Claude Code, autonomously under `full auto` while Felix was away · **Superseded-by:** -

### d-20260830-11 — `findings.py` is shared across projects. Port the fix to the siblings now, or declare the pendency?

* **Governs:** f-20260829-14
* **Chosen:** fix `en-croissant`'s copy, and declare the pending port — filed as a finding here,
  carrying the exact hunk, and delivered as a handoff prompt.
* **Rejected:** committing the identical hunk into `chess-tactics-app` and `correction-app` during
  this run; and withholding the fix here until all three could move together.
* **Because:** both siblings carry the identical defective block, read directly rather than assumed.
  Both were also measured three times during this run and moved every time — `chess-tactics-app`
  went from 11 to 12 commits ahead of `origin/develop`; `correction-app` went from 5 dirty files to
  0 to 3, and from 2 to 3 commits ahead. Another session is working in each of them right now.
  Committing into a tree that is moving underneath, on top of an unpushed stack this run has not
  reviewed and may not push, is worse than a declared pendency. The shared-tool contract explicitly
  permits "a fix this copy carries first while the port is pending" and requires only that the
  pendency be *declared*, which is what filing it does.
* **Verified rather than asserted:** diffing this copy against `chess-tactics-app`'s committed
  `scripts/findings.py` yields exactly one hunk, and it is the intended one. `correction-app` has
  already diverged independently (md5 `1c0ea94d` against `edc21d38`), so its port needs its own
  reading rather than a patch application.
* **What this does not settle:** en-croissant has no parity test, so nothing detects the divergence
  automatically. That is filed separately, because its design question is real — the sibling
  repository does not exist on a CI runner, and a test that skips there is vacuous in exactly the
  environment that matters.
* **Decided by:** Claude Code, autonomously under `full auto` while Felix was away · **Superseded-by:** -

### d-20260830-12 — When the `#[cfg(test)]` coverage exclusion is built, does it cover only `mod` blocks?

* **Governs:** f-20260829-04
* **Chosen:** exclude **every** `#[cfg(test)]`-guarded item through one uniform
  attribute-to-item-extent rule, not only `mod` blocks — and extend `scopeSignature` in the same
  change so the narrowing reaches the recorded scope.
* **Rejected:** excluding `#[cfg(test)] mod` blocks only.
* **Because:** 43 non-`mod` `#[cfg(test)]`-guarded items exist today under `src-tauri/src`
  (`fn`, `impl`, `struct`, `use`, `const`, `enum`, `trait`, a `thread_local!` invocation and bare
  statements), all of them test-only code in production files. A `mod`-only rule leaves a hole that
  the next test helper widens, and the hole is invisible because nothing fails when it grows.
* **Implementation constraint that is part of this decision:** naive brace counting is not
  sufficient. It fails at exactly one site — `src-tauri/src/pgn.rs:676`, where byte strings at lines
  731, 738 and 741 carry unbalanced literal braces and the scan runs to EOF — so a masking pass over
  comments, strings, raw strings and char literals is required.
* **Recorded now although the work is parked**, so the session that answers d-20260830-09 implements
  rather than re-derives it.
* **Decided by:** Claude Code, autonomously under `full auto` while Felix was away · **Superseded-by:** -

### d-20260830-13 — How do the two new gate scripts get regression anchors, and how are they wired?

* **Governs:** f-20260829-09, f-20260829-14
* **Chosen:** one test suite per script, named after the existing convention —
  `mutation:runner:test` and `findings:test` beside `coverage:report:test` and
  `bundle:report:test` — each with its own CI step. The `findings.py` anchor is a self-contained
  `unittest` file beside the shared tool, never inside it. The mutation runner's tests drive the
  real CLI as a subprocess against temporary git repositories with a `cargo` shim.
* **Rejected:** a hand-run reproduction pasted into the run report — reverting either fix would then
  still pass every committed command, which is not an anchor; unit tests over exported helpers for
  the mutation runner — they cannot prove the CLI calls the helpers, and an implementation that
  stranded the fence after every successful run would have passed them; and one aggregate
  script-test command consumed by CI and `$push`, proposed by `review-minimalism`, because it would
  rewire two gates this cluster does not otherwise touch and collapse four CI steps into one, so a
  failure would no longer name its suite in the step list.
* **Because:** this repository had no Python test suite, which is why the `findings.py` defect had
  no anchor in the first place; adding one small file is cheaper than the class of defect it
  catches. Both anchors were checked by reverting the fix by hand and confirming the named test goes
  red, rather than trusting the implementing agent's claim about which test would fail.
* **Decided by:** Claude Code, autonomously under `full auto` while Felix was away · **Superseded-by:** -

### d-20260830-14 — Which keyring backend does the Linux build use?

* **Governs:** f-20260830-34
* **Chosen:** the `sync-secret-service` feature on the `keyring` crate, so credentials go to the
  desktop Secret Service (GNOME Keyring / KWallet) over D-Bus. The synchronous call must be moved
  off the Tokio worker **in the same change** — it is currently reached inline from `async fn` at
  `lichess.rs:82-84` and `fs.rs:885-887`, and enabling a real backend is what turns that from
  harmless into a worker stall with a possible unlock prompt.
* **Rejected:** `linux-native` (kernel keyutils) — keys do not survive a reboot, so a stored Lichess
  token would have to be re-linked after every restart, which defeats the purpose of storing it;
  `linux-native-sync-persistent` — correct behaviour, but pulls in both dependency trees and two
  sets of failure modes for a single token.
* **Because:** the value being stored is a long-lived account token whose entire point is to survive
  restarts. Persistence is the requirement, so the backend that provides it is the one to use.
* **Decided by:** Felix, 2026-08-30, asked explicitly so the finding can run unattended · **Superseded-by:** -

### d-20260830-15 — How much of the fork-identity separation happens now?

* **Governs:** f-20260830-44
* **Chosen:** the identity half only — change the bundle identifier, sever the updater endpoint and
  public key so no upstream release can be offered to this build, and add the GPL-3 §5(a)
  modification notice. Leave `productName`, the fork's own signing keypair, the CI release
  workflow, self-hosted engine-manifest and download page for a later run.
* **Rejected:** doing everything at once — it requires a public product name that is not chosen yet
  and a private signing key stored in CI, neither of which is needed before the app is shipped;
  severing only the updater — that leaves the data-directory collision and a reverse-DNS identifier
  for a domain the fork does not own.
* **Because:** the two halves have different deadlines and only one is load-bearing. `identifier`
  determines the app-data directory and the keyring service namespace, so it must be final **before**
  real repertoire data exists; changing it afterwards means moving the data and re-registering roots,
  because `StoredEntry` persists an absolute `path` and the registry deliberately invalidates an
  entry whose recorded path no longer resolves. `productName` has no such consequence and can change
  at any time. This is a sequencing call driven by a real dependency, not a scope reduction.
* **Decided by:** Felix, 2026-08-30 · **Superseded-by:** -

### d-20260830-16 — What bundle identifier does the fork use?

* **Governs:** f-20260830-44
* **Chosen:** `com.chessriddle.encroissant` (and `com.chessriddle.encroissant.dev` for
  `tauri.dev.conf.json`, preserving the existing dev/prod split).
* **Rejected:** keeping `org.encroissant.app` — a reverse-DNS name for a domain this fork does not
  own, and identical to upstream, so both builds would share the app-data directory and keyring
  namespace; `dev.felixbeck.encroissant` and a name-neutral variant — both viable, neither better.
* **Because:** the requirement is a namespace Felix actually owns. The identifier is never
  user-visible — it appears only in a filesystem path and the keyring service name — so it neither
  brands the app nor commits it to a product name. It encodes the fork's lineage, which is a fact
  that will not change, rather than a marketing name that might; that is what makes it stable enough
  to pick before the name is chosen. **It is changeable later** at the cost of moving the data
  directory and re-registering roots, which was understood when this was decided.
* **Decided by:** Felix, 2026-08-30 · **Superseded-by:** -

### d-20260830-17 — Correction to d-20260830-16's rationale: the bundle identifier IS user-visible

* **Governs:** f-20260830-44
* **Chosen:** `d-20260830-16` stands unchanged — the identifier is `com.chessriddle.encroissant`
  (`.dev` for the development config), and every reason it gives for that value still holds. What is
  corrected here is one clause of its *reasoning*, not the decision: it states the identifier "is
  never user-visible — it appears only in a filesystem path and the keyring service name". That is
  incomplete. `src-tauri/src/oauth.rs` carried an independent second copy of the same string as the
  Lichess OAuth `ClientId`, and Lichess displays the client id verbatim on its authorization screen,
  so the identifier is the name under which this build asks a real third party for a real user's
  token.
* **Rejected:** editing `d-20260830-16` in place to fix the clause — rule 4c: a recorded decision is
  reversed or amended by Felix in the chat and by nothing else, and an agent rewriting the record to
  agree with the work in front of it is exactly the failure that rule exists to stop. Also rejected:
  leaving the clause uncorrected, because a later session reading "never user-visible" would
  reasonably conclude the identifier can be changed without any external consequence.
* **Because:** the clause was offered as an argument *for* the chosen value, not as a constraint on
  it, so its being wrong does not disturb the choice — it only removes one of the reasons. The
  practical consequence is recorded so it is not rediscovered: changing the identifier again also
  changes what Lichess shows the user at authorization time, on top of moving the app-data directory
  and the keyring namespace that `d-20260830-15` already sequenced around.
  Commit `6c2749ad` removes the duplication rather than rewriting the second literal, so
  `tauri.conf.json` is now the single place the fork's identity is written and the two can no longer
  drift apart.
* **Decided by:** Claude (autonomous, `full auto`), 2026-08-30 · **Superseded-by:** -

### d-20260830-18 — The real Tauri window is driven off-screen by `pnpm verify:app`; only native GTK chrome stays manual

* **Governs:** f-20260830-51
* **Chosen:** a WebDriver harness against the real product — `kwin_wayland --virtual` (an off-screen
  compositor) → `tauri-driver` → `WebKitWebDriver` → the release binary, with the real Rust backend,
  real IPC and real WebKitGTK. `scripts/app-driver.mjs` is the harness and `scripts/verify-app.mjs`
  the check, wired as `pnpm verify:app`. The WebDriver wire protocol is JSON over HTTP, so the
  client is ~60 lines and adds **no npm dependency**. The app runs under a throwaway `HOME`, because
  `tauri-plugin-window-state` persists geometry on exit and a headless 1400x900 run must not resize
  the window Felix actually uses.
* **Rejected:** continuing to treat the live product as unverifiable by an agent. Until this entry,
  `.claude/skills/verify-ui/SKILL.md` asserted "there is no documented remote-devtools path" and
  every session repeated it. Half of that was right and permanent — Chrome MCP cannot attach,
  because the window is WebKitGTK and speaks no Chrome DevTools Protocol, which is an engine
  difference and not a configuration gap. The other half was simply wrong: Tauri documents WebDriver
  testing and states that driving directly is supported on Linux and Windows. A repo-wide search
  found **zero** occurrences of `tauri-driver`, `WebKitWebDriver` or `xvfb` — it had never been
  attempted. Also rejected: a second Playwright suite against the real window, because its
  screenshots could never share a baseline with the Chromium ones; the two answer different
  questions and are kept apart deliberately.
* **Because:** every claim about lifecycle, IPC or process teardown previously terminated in "ask
  Felix to look". That is a permanent tax on him and, worse, an evidence gap: the shutdown fix in
  f-20260830-51 could be unit-tested but not shown to run in the product. It now is — clicking the
  app's own close control produces `Shutdown requested…` → `Shutdown cleanup finished` in the log
  and leaves neither the application process nor the WebKit service processes it fathered behind,
  which is exactly the property that was broken. That assertion is **pid-scoped**: the harness
  records the app's pid and the pids of the WebKit children whose parent it is, then proves those
  exact pids are gone. A blanket "no WebKitWebProcess anywhere" would be untrue on a desktop
  running other WebKitGTK applications — the first version of this check filtered them out
  entirely and therefore proved nothing, which the push review of 2026-08-30 caught.
* **What it deliberately does not cover:** native GTK chrome. The menu bar, window decorations and
  every file dialog are drawn by GTK, not by the page, and WebDriver only sees the page. In
  particular `issue_engine_binary` (`src-tauri/src/main.rs`) opens a native picker and takes no path
  argument, so **an engine cannot be registered from the harness** and any check needing a live
  engine child remains Felix's. That the engine-termination path itself reaps correctly rests on the
  unit tests over `terminate_all` and `shutdown_all`, plus the proof that the wiring runs.
* **Not a push gate:** it wants a release build and a compositor, and CI has neither. Prerequisites
  are one-off and named in the failure message: `sudo apt install webkit2gtk-driver` (matching the
  installed `libwebkit2gtk-4.1-0`, 2.52.3 here) and `cargo install tauri-driver --locked`.
* **Decided by:** Felix chose that the harness be built, and to build it in the running session
  ("can we do it right here to build the real AppHarness", 2026-08-30). Everything below that — WebDriver
  over an off-screen compositor rather than a second Playwright suite, the throwaway `HOME`,
  not-a-push-gate — is Claude's design, not his. Recorded separately per universal rule 4c: an
  attribution to Felix is evidence, and the parts he did not choose must not travel under his name.
  · **Superseded-by:** -

### d-20260830-19 — Which of `.claude` and `.agents` is the canonical skill tree?

* **Governs:** -
* **Chosen:** `.claude/skills/**` is canonical; `.agents/skills/**` holds short Codex bridges that restate no gate command. Enforced by `scripts/check-skill-bridges.mjs`, which also fails any file naming a bridge as the gate source.
* **Rejected:** keeping `push` canonical in `.agents` (the pre-existing state), and ChessRiddle's byte-identical generated mirror.
* **Because:** `~/.claude/skills/build/SKILL.md` step 0 reads `.claude/skills/push/SKILL.md` as its source for gate mapping, sensitive-path globs and the project Skip catalog, so every `build` run landed on a 10-line bridge. The repository also contradicted itself — `verify-ui` was already canonical in `.claude` — and Korrigio uses this same direction. A mirror was rejected because bridges carry real Codex-runtime deltas here (committer name, leaf-versus-orchestrator), which a byte-identical copy cannot express.
* **Decided by:** build run 2026-08-30 agent-tooling-parity · **Superseded-by:** -

### d-20260830-20 — Should a gate that cannot run its check report success?

* **Governs:** -
* **Chosen:** No. An unavailable `actionlint` fails `workflows:check`, and an absent sibling checkout fails `findings:parity:check`. Each is waivable only through an explicit named flag that neither `package.json` nor CI passes.
* **Rejected:** printing `SKIP` and exiting 0, which is what both originally did — in the actionlint case because this run's own phase instruction asked for it.
* **Because:** five review lenses independently reported the same shape: the condition that prevents the comparison is preserved and relabelled as success, so drift passes on any machine lacking the tool or the sibling path. A gate's exit code is read as "this was checked and was fine"; "could not check" must never be spelled the same way. The waiver flag keeps the genuinely toolless case usable without making silence the default.
* **Decided by:** build run 2026-08-30 agent-tooling-parity · **Superseded-by:** -

### d-20260830-21 — Repairing another repository's broken tooling in order to file a finding into it

* **Governs:** -
* **Chosen:** Repair it, leave the repair uncommitted in that repository's working tree, file a finding there describing both the breakage and the waiting repair, and report it to Felix. Applied to `correction-app/scripts/findings.py`, which had three Python 2 `except` clauses committed on 2026-08-28 and had not parsed since.
* **Rejected:** filing nothing there and reporting the breakage to Felix instead; and committing the repair in that repository.
* **Because:** Felix's instruction for this run was to file the `_atomic_write` port into both siblings, and filing requires a working CLI — the repair was instrumental to the instruction, not scope creep. Committing it there was rejected because that repository's own gates and push review have not seen it, and a drain was holding its ledger lock at the time. Leaving it uncommitted with a finding that names it keeps the repair discoverable without smuggling an unreviewed change into someone else's history.
* **Decided by:** build run 2026-08-30 agent-tooling-parity · **Superseded-by:** -

## 2026-08-31 — recorded through the decisions lock

### d-20260831-01 — Correction to d-20260830-05: the renderer error category is `applied-despite-error`, not `partially-applied`

* **Governs:** f-20260830-07, f-20260830-04
* **Chosen:** the category name is `applied-despite-error`, exactly as
  `src/platform/errors.ts` already implements it and `src/components/files/FilesPage.tsx` already
  filters on it. `d-20260830-05`'s prose says `partially-applied`; that name was never shipped and
  must not be introduced. The decision's substance is unchanged and was implemented faithfully: one
  category, matched on the two exact Rust literals `partially removed:` and
  `committed but durability uncertain:`, tested on both sides.
* **Rejected:** following `d-20260830-05`'s literal name. Implementing it would have created a
  category `FilesPage` does not filter on, so a destructive operation that partly succeeded would
  have stopped relisting — the exact failure that decision exists to prevent. Also rejected:
  editing `d-20260830-05` in place, per universal rule 4c.
* **Because:** `errors.ts` carries a comment explaining why the name was deliberately avoided — the
  `CommittedDurabilityUncertain` case removed everything it was asked to, so "partially applied" is
  false for half the cases the category covers. The implementation is the later and better-informed
  of the two, and the record is corrected beside the original rather than rewritten, following
  `d-20260830-17`'s precedent in this same ledger.
* **How it surfaced:** three review lenses independently refused to implement the `native-fs`
  cluster's phase 5 because the plan named a category that does not exist, at confidence 100 each.
  They were right to stop rather than guess.
* **Decided by:** Claude Code, autonomously under `full auto` while Felix was away · **Superseded-by:** -

### d-20260831-02 — Enable zip opening books, or delete the unreachable zip arm?

* **Governs:** f-20260829-11
* **Chosen:** enable. `.zip` is added to `opening_book_ext`, the `("book.zip", None)` assertion is
  corrected, and a test drives the outer dispatch with a real archive.
* **Rejected:** deleting the `Some("zip")` arm and `read_zip_inner_cancellable`.
* **Because:** the evidence says this was an accidental fork regression, not a decision. Upstream
  `455ba6be` is titled "add support for zipped opening books" and added both the arm and
  `opening_book_ext` — the latter to detect the format of the file *inside* the archive. Fork
  commit `97c29add` then reused that inner-only helper for the outer dispatch and wrote the
  assertion to match the resulting behaviour. The zip reader is complete working code with
  decompression-bomb limits and cancellation, and the live user-facing error still says
  "Use .pgn, .epd, .bin, or .zip". Deleting would have removed a working feature in order to
  preserve the regression.
* **Nesting is not a risk:** the inner member dispatch matches only epd/pgn/bin, so a zip inside a
  zip falls to its existing arm with the accurate "Zip must contain a .pgn, .epd, or .bin file".
* **Decided by:** Claude Code, autonomously under `full auto` while Felix was away · **Superseded-by:** -

### d-20260831-03 — How is the manifest-supplied engine `path` constrained in the client schema?

* **Governs:** f-20260830-27
* **Chosen:** reject NUL, backslash, a leading `/`, a Windows drive prefix, empty segments and any
  `.`/`..` segment — while keeping multiple `/`-separated segments legal — and document it as
  defence in depth in front of the backend, never as the boundary.
* **Rejected:** the finding's own suggestion of constraining `path` to a single normal component.
* **Because:** it would reject every real engine entry. `AddEngine.tsx` computes
  `engine.path.split("/").at(-1)`, and `register_installed_engine` folds *every* normal component
  onto the engine root, so real manifests use nested paths. This is worth recording precisely
  because the finding text recommends the wrong fix at first glance.
* **Also rejected:** deleting the refinement entirely, which a review lens proposed at confidence 90
  on the grounds that it duplicates native validation and can drift. It fails closed one layer
  earlier, before a download and an install start, and the finding explicitly asks for it; the
  drift risk is answered by the tests and by not claiming it is the boundary.
* **Decided by:** Claude Code, autonomously under `full auto` while Felix was away · **Superseded-by:** -

### d-20260831-04 — Does the read-only engine probe get its own `PathOperation`, or reuse `EngineExecute`?

* **Governs:** f-20260830-26
* **Chosen:** a new read-class `PathOperation::EngineBinaryInspect`, granted at
  `register_engine_file`, with a load-time backfill restricted to `PersistentFile` records whose
  operation vector is exactly the legacy engine-file triple.
* **Rejected:** reusing `EngineExecute`, which is already granted at the same mint site, is already
  read class, and needs no variant, no generated-binding change and no migration. Also rejected:
  bumping `SCHEMA_VERSION`, since the backfill is idempotent.
* **Because:** "may I spawn this process" is not "does this file exist", and a capability model is
  worth having only if the name means what it says. `EngineBinaryInspect` is deliberately not
  accepted by `read_bytes` or `into_read_file`, so it authorizes inspection rather than reading the
  executable — which is also why it is named *Inspect* and not *Read*, after a lens pointed out that
  the earlier name claimed an authority it never grants.
* **The migration is the real cost, and it is why the backfill is narrow.** `get_or_create_persistent_file`
  matches on exact operation-vector equality, so an unrestricted backfill would have caught engine
  *root* records too — they carry the same three operations — broken `get_or_create_engine_root`'s
  reuse, and minted a new durable root capability on every restart. Two review lenses found that at
  98 and 99 confidence before any code existed. A test now proves a reloaded root keeps its exact
  vector and id.
* **Decided by:** Claude Code, autonomously under `full auto` while Felix was away · **Superseded-by:** -

### d-20260831-05 — Are the durability error payloads redacted per site, or made safe by construction?

* **Governs:** f-20260830-39, f-20260830-07
* **Chosen:** by construction. `Error::CommittedDurabilityUncertain` and
  `CommitDurability::DurabilityUncertain` carry a `DurabilityStage` from a closed set instead of a
  free-form `String`; `PartialRemoval` renders its cause's category rather than the cause;
  `OperationAndCleanup` renders a stable message. Every producer logs the real OS cause through
  `log::`, which the crate already depends on and `main.rs` already uses.
* **Rejected:** redacting the three sites the finding named. Also rejected: giving `Error` a real
  `specta::Type` so the renderer receives a structured error.
* **Because:** eight producers filled that `String` with `io::Error::to_string()`, and
  `error.rs`'s `Serialize` sends the whole `Display` across IPC, so patching three call sites would
  have left the mechanism and the other five. A review lens made exactly that objection at
  confidence 99. The `specta::Type` answer is the general one and is out of scope by
  `d-20260830-05`, which weighed it and filed it separately; this closes two variant pairs without
  touching that decision.
* **Discarding the cause was never an option:** redaction that loses the diagnostic trades one
  defect for another. `log::` keeps it on the Rust side, and a capturing-logger test now proves the
  calls are actually made, because assertions on the serialized string alone would have stayed
  green if every log call were deleted.
* **Decided by:** Claude Code, autonomously under `full auto` while Felix was away · **Superseded-by:** -

### d-20260831-06 — What prunes authority records on a partial removal, and what happens if the registry save then fails?

* **Governs:** f-20260830-07
* **Chosen:** on a *completed* removal the whole subtree's records go. On a **partial** removal the
  top record stays — `d-20260830-04`, because the top directory still exists with an unchanged
  inode — while descendants are reconciled individually through the identity re-stat the authority
  already performs: what still resolves survives, what was actually deleted does not. If
  `save_entries` then fails, the prune is simply not adopted, and that residual is written down at
  the site rather than repaired.
* **Rejected:** keeping every descendant record on the partial path, which leaves exactly the
  dangling accumulation this finding exists to remove — a review lens caught that at confidence 100.
  Rejected: pruning by `PartialRemoval`'s `removed_entries` count, which names no paths. Rejected:
  a load-time sweep removing records whose object no longer resolves.
* **Because:** this extends `d-20260830-04` rather than reversing it — that decision ruled on the
  *top* record and said nothing about descendants, some of which a partial removal has genuinely
  deleted. The load-time sweep is the tempting repair and it is unsafe: a capability on an unmounted
  volume does not resolve either, which is exactly why `refresh_persistent` marks unavailable
  instead of removing. Adopting a prune in memory that was not persisted would make in-memory state
  diverge from disk, which is worse than the residual it fixes. The accumulation is therefore
  bounded by registry-save failures rather than by ordinary create-and-delete use, and it is filed
  as its own finding so it is tracked rather than only commented.
* **Scope of the claimed bound:** workspace records no longer outlive the objects they name. The
  registry as a whole is *not* bounded — it also holds engine binaries, engine resources, engine
  images, opening books and downloaded PGNs — and two lenses refuted an earlier, wider claim.
* **Decided by:** Claude Code, autonomously under `full auto` while Felix was away · **Superseded-by:** -

### d-20260831-07 — How do a deletion and a cfg-gating get a regression anchor at all?

* **Governs:** f-20260830-22, f-20260830-40
* **Chosen:** a narrow repo-local checker, `scripts/check-rust-release-surface.mjs`, with two
  line-oriented rules over `git ls-files` output — no file-level `#![allow(dead_code)]` under
  `src-tauri/src` outside a shrink-only allowlist, and no public fault-injection item or import
  outside a `#[cfg(test)]` region. It is wired into `package.json`, `test.yml` and the push skill's
  Rust/Tauri gate list, and its own tests assert all three wirings.
* **Rejected:** annotating the open `f-20260830-23` with the rules it owes and shipping the two
  phases unanchored. Rejected: building the general Rust boundary gate that finding describes
  (`src-tauri/clippy.toml`, filesystem-call containment). Rejected: a fifth directory walker.
* **Because:** deleting dead code and gating test scaffolding leave nothing a test can observe —
  reverting either left `cargo check`, `clippy -D warnings`, the unit tests and the coverage
  ratchet all green. Four lenses across two review rounds reported that at 99-100 confidence and
  explicitly refused the annotation, on the grounds that annotating a finding is not a test. They
  were right: that absence is how a dead second path authority survived in the tree behind a
  file-level suppression in the first place. The general gate stays `f-20260830-23`'s, which is now
  annotated so it absorbs these two rules rather than duplicating them.
* **It lands last, not first.** An earlier draft made it the first phase; its rules are violated by
  the pre-deletion and pre-gating tree by construction, so no ordering exists in which it lands
  first and green. The two phases it guards take their anchor from its fixture tests, which are
  revert-sensitive without depending on commit order.
* **Decided by:** Claude Code, autonomously under `full auto` while Felix was away · **Superseded-by:** -

### d-20260831-08 — Where do the two live helpers from the deleted `infra/path.rs` go?

* **Governs:** f-20260830-22
* **Chosen:** `safe_canonicalize` is folded into the `canonical_database_path` wrapper that already
  existed in `db/repository.rs` and did nothing but call it — one function under the existing name,
  its three call sites unchanged — and `to_utf8_str` is inlined at its single call site.
* **Rejected:** moving `safe_canonicalize` into `src-tauri/src/infra/fs.rs`. Rejected: moving it in
  under a new name beside the existing wrapper.
* **Because:** `infra/fs.rs` is the descriptor-based primitive layer beside `path_authority`, and a
  pathname-string canonicaliser there would invite new callers to canonicalise a path instead of
  resolving a capability — the exact confusion this whole deletion removes. Introducing a second
  `canonicalize_database_path` beside the existing `canonical_database_path` would have left two
  near-identical names with no stated difference, which a review lens caught at confidence 98.
* **The name mattered too:** "safe_canonicalize" reads as a security primitive, and the function is
  not one — it normalises for identity and tolerates a non-existent final component. It now carries
  a doc comment saying exactly that, so the false claim the deleted comment made
  ("AuthorizedPath already does this for command inputs") is not replaced by a quieter one.
* **Decided by:** Claude Code, autonomously under `full auto` while Felix was away · **Superseded-by:** -

### d-20260831-09 — Should sibling movement past the parity pin fail the gate, or warn?

* **Governs:** f-20260830-15
* **Chosen:** warn, and make the warning visible. `main()` prints the offending commits and the
  remedy itself; the exit code is unchanged.
* **Rejected:** making it blocking, which was this run's own first plan draft and survived one
  round of plan review before the precedent was found.
* **Rejected:** copying the peers' `warnings.warn`, which under a plain runner leaves exit 0 and
  one line that scrolls past — invisible inside an unattended drain, which is where this gate runs.
* **Because:** ChessRiddle already made exactly this check blocking (`d-20260826-10`) and measured
  the result on 2026-08-26 — the peer committed twice to `scripts/findings.py` while an unattended
  drain was running, its gate went red on `develop` for work that repository could neither cause
  nor fix, and eight sound commits were stranded unpushed. **Felix qualified the mechanism in chat
  on 2026-08-27:** the pin-touches-findings half stays blocking, this half warns, and an
  outstanding port belongs in the findings queue. That is a decision by Felix on precisely this
  question, so the severity was never open. What *was* wrong is the channel, and that is what
  changed. En Croissant's drain has the same unattended shape, so it would have imported the same
  cost.
* **What this does not settle:** an advisory line can be ignored indefinitely. That is accepted,
  and it is why the printed remedy names the findings queue.
* **Decided by:** Claude Code, autonomously under `full auto` while Felix was away · **Superseded-by:** -

### d-20260831-10 — Is a probe that cannot run allowed to report "the pin is current"?

* **Governs:** f-20260830-15
* **Chosen:** no. A `git` failure or `OSError` inside the staleness probe raises `ProbeFailure`
  and makes `findings:parity:check` exit 1 with a message saying the pin was NOT checked.
* **Rejected:** returning the empty list, which is how the probe spells "checked, and current".
* **Rejected:** letting it propagate, which reaches the operator as a raw traceback instead of a
  labelled gate failure.
* **Because:** `d-20260830-20` already settled the general form — "could not check" must never be
  spelled the same way as "checked and fine". This is the same shape one layer down. It does not
  conflict with the advisory decision recorded alongside it: sibling *movement* stays advisory,
  and only a broken *probe* is fatal. The probe is reached only after `_read_committed_sibling`
  has already proved git usable and the ref readable, so a failure there is anomalous rather than
  expected, and the existing "sibling present but unusable" path already exits 1.
* **Decided by:** Claude Code, autonomously under `full auto` while Felix was away · **Superseded-by:** -

### d-20260831-11 — Does `findings:parity:check` belong in CI, and should the upstream copy be vendored?

* **Governs:** f-20260830-15
* **Chosen:** neither. The gate stays local-only and mandatory in `$push`.
* **Rejected:** a CI step passing `--allow-missing-sibling`. No upstream checkout exists on a
  runner, so the step would print SKIP and prove nothing — the vacuous-gate shape this repository
  already hit when two `ui:boundary:check` rules were diff-scoped and were therefore dead on every
  clean checkout, CI included.
* **Rejected:** vendoring the upstream blob so CI can recompute the delta. It buys a real CI
  signal, at the price of a second ~4 400-line artefact in this repository whose staleness against
  the pin nothing checks except the local gate that already exists — a second thing to keep
  current, guarding the first.
* **Rejected:** publishing `findings.py` from one shared repository or released artefact and
  vendoring it everywhere. This is the only option that removes the divergence class outright
  rather than detecting it, and it is not rejected on merit — it is a three-repository change that
  a single-repository slice cannot make. It stays the better answer if the class recurs.
* **Because:** the gate's question is "does this copy still match the upstream's committed copy",
  and that question is only answerable where the upstream tree exists. `scripts/check-gate-routing.mjs`
  already forces every package script to be routed through the push skill or the test workflow, so
  a local-only gate cannot be quietly dropped.
* **Decided by:** Claude Code, autonomously under `full auto` while Felix was away · **Superseded-by:** -

### d-20260831-12 — Who performs the `_atomic_write` port into `chess-tactics-app`?

* **Governs:** f-20260830-14
* **Chosen:** that repository does, from its own ledger. En Croissant's obligation is discharged
  by the entry already filed there on 2026-08-30 (its `f-20260830-14`, area `dev-scripts`) plus an
  honest `sibling_told=True` in this repository's declaration.
* **Rejected:** editing `chess-tactics-app/scripts/findings.py` and leaving the change uncommitted,
  which is `d-20260830-21`'s shape. A drain holds that checkout — verified by `flock` on its lock
  file, not by the file's existence, since the file persists after release. An uncommitted edit
  would put a foreign dirty gate-input path in front of that repository's own `$push`, whose rule
  is to stop on exactly that, so the "harmless" option would have stopped its drain.
* **Rejected:** committing the port there. It bypasses that repository's review and gates, over an
  entry already sitting in its own queue.
* **Because:** `d-20260830-11` deferred the port because the trees were moving and delivered a
  handoff prompt; the entry now exists in the upstream's own queue, which is the durable form of
  the same answer. Porting from here would additionally require re-pinning `SIBLING_REF` and
  deleting the declaration in the same breath, since the parity test fails on a declaration that
  matches no hunk — three repositories' state changed from a run that can gate none of them.
* **Decided by:** Claude Code, autonomously under `full auto` while Felix was away · **Superseded-by:** -

### d-20260831-13 — A working-tree-only repair in a foreign repository is not a fix for a committed defect

* **Governs:** -
* **Chosen:** when a foreign repository's tooling is broken *in a commit*, repair the working tree
  only as far as the current task instrumentally needs, file a finding in that repository saying
  the defect is committed and the repair is waiting uncommitted, and report it to Felix in the
  chat. Do not treat the uncommitted repair as the resolution.
* **Rejected:** repeating `d-20260830-21` as if it had worked. That decision repaired
  `correction-app/scripts/findings.py` on 2026-08-30 and deliberately left the repair uncommitted
  so that repository's own review would see it.
* **Because:** measured 2026-08-31, the repair was gone and the defect was back — three Python 2
  `except` clauses committed in `4fc4803ac`, so `scripts/findings.py` had not parsed there and its
  entire findings CLI was dead. **An uncommitted repair does not survive; it is discarded by the
  next checkout and nothing records that it is owed.** `d-20260830-21`'s reasoning about not
  smuggling unreviewed changes into someone else's history is still right — what was wrong was
  treating the uncommitted repair as a resolution rather than as scaffolding, and filing the
  finding into En Croissant instead of into the repository that has to commit it.
* **Applied here:** the three clauses were repaired again in that working tree, purely so the CLI
  could run long enough to file, and two findings were filed into its own ledger — the parity-probe
  defect this run was reporting, and the breakage itself, which names the waiting repair and says
  to commit it there.
* **Decided by:** Claude Code, autonomously under `full auto` while Felix was away · **Superseded-by:** -

### d-20260831-14 — Does En Croissant need a fourth parity edge, directly to `correction-app`?

* **Governs:** f-20260830-15
* **Chosen:** no. This repository pins `chess-tactics-app` and that is its only edge.
* **Rejected:** a second declaration set pinned against `correction-app`.
* **Because:** the graph has three edges — En Croissant → `chess-tactics-app` (`4c83bf50c`),
  `correction-app` → `chess-tactics-app` (the same commit), and `chess-tactics-app` →
  `correction-app` (`3e80b0735`). En Croissant and `correction-app` pin the *same* upstream commit,
  so their mutual delta is exactly the union of their two declaration sets, and each already
  carries and gates its own. A fourth edge would add a pin to re-walk on every upstream move and
  could report nothing the existing edges do not.
* **What this does not settle:** a fourth edge would catch a peer that stops running its own gate.
  That failure is better fixed where it occurs.
* **Correction to the record:** an earlier draft of this run's plan asserted `chess-tactics-app`
  carries no parity test and the topology is a star. Both are false — it carries
  `backend/tests/test_findings_upstream_parity.py`, pinning `correction-app`. Recorded because the
  false version briefly survived a round of plan review.
* **Decided by:** Claude Code, autonomously under `full auto` while Felix was away · **Superseded-by:** -

### d-20260831-15 — Is the declared-divergence framework over-built for one declared divergence?

* **Governs:** f-20260830-55
* **Chosen:** the framework stays. `EXPECTED_CHANGED_LINES`, which is the genuinely redundant part,
  is left in place and its removal referred back to `f-20260830-55` as a three-repository question.
* **Rejected:** trimming `scripts/findings-parity-tests.py` to the pinned digest alone, as
  `review-minimalism` proposed at confidence 96.
* **Because:** `~/.claude/references/findings-ledger-contract.md:475-486` mandates a closed list of
  declared divergences carrying each one's reason and whether the other repository has been told, so
  a digest-only version would put this repository out of contract. The digest also reports only
  *that* something moved — no declaration to walk, no justification attached — which cannot express
  a second divergence and cannot stop the list rotting into a permanent amnesty, the two properties
  the mechanism exists for. `sibling_told` is no longer decorative either: an untold pending port
  now fails the gate.
* **On the redundant half, which the lens is right about:** the changed-line count adds no
  detection, since it is an input to the digest. It is not removed because all three copies of this
  harness pin it deliberately with a written rationale, and removing it here alone would make this
  the only implementation of three without it. That is a convergence question to settle where all
  three can change together — a rule-4b area boundary, not an effort argument.
* **Also rejected:** extracting a shared core across the three parity harnesses
  (`review-minimalism`, 90). There is no shared package to publish it into, and the contract makes
  `scripts/findings.py` the shared artefact while each project's harness is legitimately its own,
  pinning a different peer at a different ref with a different declaration set.
* **Decided by:** Claude Code, autonomously under `full auto` while Felix was away · **Superseded-by:** -

### d-20260831-16 — What does a "correct" layout mean at 320px viewport with the 200% app font scale?

* **Governs:** f-20260829-02
* **Chosen:** content must **reflow or become reachable by scrolling; it may never be silently
  clipped**. An element whose content exceeds it is acceptable when some ancestor between it and the
  clipping boundary provides `overflow-x: auto|scroll`, and is a defect when the nearest such
  ancestor clips (`hidden`/`clip`) or when the overflow leaves the viewport. Horizontal *document*
  scrolling remains disallowed, so `assertNoHorizontalOverflow` stays.
* **Rejected:** giving the app a minimum content width and letting the whole document scroll
  horizontally below it. That would make nothing clipped too, and it is less work, but it
  contradicts two things the repository has already chosen: the compact branch at
  `src/components/settings/SettingsPage.module.css:60` and `SettingsPage.tsx:127`, which is a reflow
  strategy, and `assertNoHorizontalOverflow`, which the three 320px specs already assert and which a
  scrolling document would have to be relaxed to accommodate. Also rejected: applying the font scale
  to typography tokens only, leaving layout rem unscaled — it would fix the arithmetic at a stroke,
  but scaling the whole UI is what browser zoom does and is usually what a user enlarging text wants,
  and reclassifying every rem in the codebase and in Mantine's spacing system is a far larger and
  more fragile change than reflowing four call sites.
* **Because:** at root font 32px a 320px viewport is ten root-em wide, so no layout "fits"; the only
  question a rule can usefully answer is whether unfitted content is *lost* or *reachable*. That
  distinction is measurable, which is what makes it enforceable — see the companion decision on the
  instrument. It is also what WCAG 1.4.10 asks for, and this combination is stricter than 1.4.10
  requires, so the standard is a floor here rather than the target.
* **Decided by:** build run 1ed74d8d (drain), 2026-08-31, on the `frontend-ui` cluster sliced to
  f-20260829-02 · **Superseded-by:** -

### d-20260831-17 — Can `assertNoHorizontalOverflow` be tightened to catch clipped content, or does it need a second assertion?

* **Governs:** f-20260829-02
* **Chosen:** it needs a **second, independent assertion** — `assertNoClippedContent()` in
  `e2e/fixtures.ts` — implementing the classification already run: walk every element and mark it
  `LOST-at-viewport` (its box overflows the viewport), `CLIPPED-by-ancestor` (an ancestor with
  `overflow: hidden|clip` clips its box or its overflowing content), or exempt when a scrollable
  ancestor (`overflow-x: auto|scroll`) appears before a clipping one. `scrollWidth > clientWidth` on
  the element itself is not sufficient: a box that fits its own content can still be clipped by an
  ancestor, and that is the failure this finding is about. The existing assertion is kept unchanged;
  the two check different properties and neither implies the other.
* **Rejected:** tightening the existing assertion's threshold or widening it from
  `Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)` (`e2e/fixtures.ts:221-223`)
  to a per-element sweep in place. Rejected because it would silently change what the three specs
  that already call it are asserting, and because the existing check is still correct for its own
  question.
* **Because:** measured on this tree at 320px/200%, that `Math.max` of document and body
  `scrollWidth` reports 320 while real content sits at `x = 353` and, on `/accounts`, at `x = 63`
  under the sidebar. Two independent mechanisms defeat it: left-side overflow never contributes to
  `scrollWidth` at all, and an ancestor with `overflow: hidden` absorbs the rest before it can
  propagate. A threshold cannot repair a measurement of the wrong quantity. The replacement
  classification was run against this tree and reports 83 clipped elements on `/settings`, 27 after
  the Appearance tab is opened, and 2 on `/accounts`, so it demonstrably goes red on the defect the
  suite was meant to catch.
* **Decided by:** build run 1ed74d8d (drain), 2026-08-31, on the `frontend-ui` cluster sliced to
  f-20260829-02 · **Superseded-by:** -

### d-20260831-18 — When Lichess account-registry durability is unconfirmed, what should the user see?

* **Governs:** f-20260831-14
* **Chosen:** keep the account linked and show a non-fatal durability warning. Carry it as `AuthenticationStatus::Succeeded { account, durability_uncertain: bool }` so the existing poller still upserts the session; `Accounts.tsx` shows `Home.Accounts.LinkDurabilityUncertain` instead of `AuthenticationFailed`. Removal gets `LichessAccountRemoval::RemovedDurabilityUncertain` with the same local-logout-is-true contract as `RemovedRevocationPending`.
* **Rejected:** silent success with next-start reconcile only (the user is not told); mapping the outcome to `Failed` / authentication-failed (the credential may already be stored, and a retry duplicates work). Also rejected: returning `Err(Error::CommittedDurabilityUncertain)` from the authenticate job, because that poller treats any non-`succeeded` state as failure — the option Felix rejected.
* **Because:** Felix chose keep-linked-and-warn on 2026-08-31. Native-fs already tells the user about the same `atomic_replace` outcome via `applied-despite-error`; account linking is constructive, so the warning rides on a successful status rather than an error that would hide the new session. Native error strings stay out of the renderer.
* **Decided by:** Felix, 2026-08-31, asked in this run before `full auto` · **Superseded-by:** -

### d-20260831-19 — Which keyring backends do the macOS and Windows builds use?

* **Governs:** f-20260830-34
* **Chosen:** `apple-native` (macOS Keychain) and `windows-native` (Windows Credential Manager), declared alongside the already-decided Linux `sync-secret-service` feature on the `keyring` crate. Unused backends are cfg-gated by keyring, so a Linux `cargo check` stays green.
* **Rejected:** leaving macOS/Windows on keyring's default mock (the same user-visible defect: `set` succeeds, a fresh `Entry` cannot read it); `linux-native` / kernel keyutils (already rejected by `d-20260830-14`: keys die on reboot).
* **Because:** `d-20260830-14`'s Because clause is the persistence requirement — a long-lived account token whose point is to survive restarts. That requirement is not Linux-specific. The mock backend is compiled in on every OS until a platform feature is set.
* **Decided by:** Grok, autonomously under `full auto`, citing `d-20260830-14` · **Superseded-by:** -

### d-20260831-20 — How is durability-uncertain local account removal represented on the IPC boundary?

* **Governs:** f-20260831-14
* **Chosen:** `LichessAccountRemoval` is a tagged enum `NotFound | Removed { revocation_pending: bool, durability_uncertain: bool }`. `AccountCards` treats any `removed` as local logout and shows the warning when the flag is set.
* **Rejected:** a fourth unit variant `RemovedDurabilityUncertain` (named in `d-20260831-18`) — provider revocation can fail in the same operation as an uncertain persist, and a unit variant can carry only one of those outcomes; also rejected: returning `Err(CommittedDurabilityUncertain)` from `remove_lichess_account`, which would make the renderer skip local logout.
* **Because:** two independent bits. This corrects the removal half of `d-20260831-18` without touching its linking half (`Succeeded { durability_uncertain }`), which still holds. Recorded beside rather than rewritten, per `d-20260831-01`.
* **Decided by:** Grok, autonomously under `full auto`, after review-plan / review-ipc-contract round 2 · **Superseded-by:** -

### d-20260831-21 — Does the Linux Secret Service backend encrypt the bearer token on the D-Bus?

* **Governs:** f-20260830-34
* **Chosen:** enable keyring's `crypto-rust` feature together with `sync-secret-service`.
* **Rejected:** `sync-secret-service` alone (keyring then uses `EncryptionType::Plain` and the token crosses the session bus in the clear); `crypto-openssl` (extra system library, no benefit over RustCrypto here).
* **Because:** `d-20260830-14` chose the persistent Secret Service backend and did not mention bus encryption; keyring's docs make encryption a separate feature. `review-tauri-security` round 1 measured Plain as the default without a crypto feature. Additive to `d-20260830-14`, not a reversal.
* **Decided by:** Grok, autonomously under `full auto`, citing keyring 3 docs and the security lens · **Superseded-by:** -
