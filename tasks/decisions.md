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
