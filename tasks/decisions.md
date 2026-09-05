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

Decision ids are per repository. The kit's 2026-09-02 overhaul decisions are cited as
`kit d-20260902-NN` and bind here too; they live in
`/home/felixb/Projekte/agent-kit/tasks/decisions.md`. This file does not copy them.

## Format

```
### d-YYYYMMDD-nn — <the question, as a question>

* **Question:** <the question again, as the clause-1 field `record-decision` validates>
* **Governs:** f-20260829-01
* **Chosen:** <what was decided>
* **Rejected:** <the alternative, and it must be a real one>
* **Reason:** <the reason, in terms a later session can check against evidence>
* **Decided by:** <session/run> · **Superseded-by:** -
```

Older entries keep their `**Because:**` form as records. New recordings use this clause-1
shape (`**Question:**` / `**Reason:**`); `record-decision` validates it.

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
* **Decided by:** Claude Code, autonomously under `full auto` while Felix was away · **Superseded-by:** d-20260903-01

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

### d-20260831-22 — How are renderer-supplied database pagination fields validated?

* **Governs:** f-20260830-20
* **Chosen:** one helper next to `QueryOptions` that rejects `page < 1`, `page_size < 1`, and `page_size > 1000` as `Error::InvalidInput`, then computes LIMIT/OFFSET in `i64`. All three of `get_games`, `get_players`, `get_tournaments` call it. Specta types stay `Option<i32>`.
* **Rejected:** silent clamp of oversized `page_size`; changing the Specta type to `u32`; renderer-side checks.
* **Because:** the backend is the trust boundary; a clamp hides a renderer bug; JSON can still deliver negatives through a `u32` field. 1000 is twenty times the UI's largest `recordsPerPageOptions` entry (50).
* **Decided by:** Grok, autonomously under `full auto` · **Superseded-by:** -

### d-20260831-23 — How may a search command write or unlink a search-index sidecar?

* **Governs:** f-20260830-33
* **Chosen:** `DatabaseRead` may open an already-valid preferred sidecar. Promotion and generation re-resolve `DatabaseMutate` (or fail with `InvalidInput`). Sidecar mutation goes through `PathAuthority::database_file_target` (retained parent fd + leaf) and the existing `atomic_replace_at` / `remove_optional_regular_at`. Uncertain durability does not unlink the legacy sidecar and returns `CommittedDurabilityUncertain(SearchIndexReplacement)`, which requires regenerating Specta bindings. `f-20260830-21` stays open except for this overlapping promotion site.
* **Rejected:** always requiring Mutate to search; returning a verified `PathBuf` for callers to reopen; adding `#[must_use]` on `AtomicFileOutcome` in this cluster.
* **Because:** a read-only grant must not change disk; `atomic_replace_at` already exists and plan review refused a PathBuf reopen as TOCTOU; `#[must_use]` plus the other nine callers is `f-20260830-21`.
* **Decided by:** Grok, autonomously under `full auto` · **Superseded-by:** -

### d-20260831-24 — How does database deletion report a partial outcome, and when does the renderer relist?

* **Governs:** f-20260831-08
* **Chosen:** unlink preferred sidecar, then legacy sidecar (only if provenance matches this database), then primary, all via the retained parent fd. `PartialRemoval` only when the primary file is gone; sidecar-only failures stay `Io`/`InvalidInput` and are retryable. `CommittedDurabilityUncertain` from registry replacement is unchanged. Both `FilesPage` and `deleteDatabaseAndInvalidate` go through one `runDestructiveWithRefresh` helper that refreshes on `applied-despite-error` then rethrows. No new error category (`d-20260830-05`, `d-20260831-01`).
* **Rejected:** a new renderer category; `PartialRemoval` when only sidecars were removed (that would clear a still-live database from the UI); pathname `remove_file` after resolve; unlinking a colliding `foo.ecsi` that belongs to another database named `foo`.
* **Because:** `applied-despite-error` already matches the two Rust literals; a sidecar is regenerable while the primary exists; fd-relative unlink is the existing puzzle/workspace pattern; promotion already refuses to unlink a colliding legacy name.
* **Decided by:** Grok, autonomously under `full auto` · **Superseded-by:** -

### d-20260831-25 — Adopt unused useOperation as FilesPage's first consumer, or delete it?

* **Governs:** f-20260830-18, f-20260830-12
* **Chosen:** delete `src/platform/operation.ts` and its tests. Native folder dialogs do not
  honour `AbortSignal`, and `run()` rethrows, so adopting the hook would still leave an
  unhandled rejection. The skip-cancelled-then-notify copies become `errorUnlessCancelled`.
* **Rejected:** adopting `useOperation` on `chooseWorkspace`. It cannot cancel
  `blocking_pick_folder` and rethrows into React's ignored click promise.
* **Rejected:** keeping the unused hook to hold the `tauri-ipc-platform` 70% line floor.
  The floor is recovered by covering live `FileInfo` / `NewTabHome` catch paths;
  `coverage-areas.json` is left unchanged so `scopeSignature` does not move.
* **Because:** two review-minimalism lenses (plan round 1) independently refused a hook
  with zero production imports. `d-20260829-03` already rejected keeping dead code for a
  ratchet. The Display string `"Cancellation"` is pinned on both sides like
  `d-20260830-05`.
* **Decided by:** Grok, autonomously under `full auto` while Felix was away · **Superseded-by:** -

### d-20260831-26 — Where does a cancelled or failed workspace folder picker surface?

* **Governs:** f-20260830-12
* **Chosen:** silent on `cancelled` (`Error::Cancellation` Display `"Cancellation"`);
  Mantine `notifications.show` with the redacted `errorUnlessCancelled` message otherwise.
  Duplicate in-flight picks are ignored via `pendingRef` plus `picking` state so the button
  disables.
* **Rejected:** inline `actionError` on FilesPage. That node renders only inside
  `{workspace && (`, so a first-time choose failure would be invisible.
* **Rejected:** swallowing real errors. `d-20260830-05` made destructive failures visible;
  a picker failure is the same visibility question with a different answer only for cancel.
* **Because:** SettingsPage and AddPuzzle already skip cancelled then notify. FilesPage is
  the third copy, extracted to `errorUnlessCancelled`.
* **Decided by:** Grok, autonomously under `full auto` while Felix was away · **Superseded-by:** -

### d-20260831-27 — After deleting a coverage-area file, is the path removed from coverage-areas.json?

* **Governs:** f-20260830-18
* **Chosen:** leave the stale path in `coverage-areas.json`. The deleted file disappears
  from LCOV; `d-20260830-08` shrink handles the ratchet; the area floor is recovered by
  covering remaining live code.
* **Rejected:** dropping the path from the area list. That changes `scopeSignature` and
  `assertBaseline` refuses unless the baseline is rewritten, which is denied.
* **Because:** plan-review (confidence 100) showed `scripts/coverage-report.mjs:193-205`
  compares the path list byte-for-byte. A missing LCOV record is a shrink, not a scope
  change.
* **Decided by:** Grok, autonomously under `full auto` while Felix was away · **Superseded-by:** -

### d-20260831-28 — Should the Tauri boundary checker skip native.ts, hold it to an exact allowlist, or only denylist known-bad re-exports?

* **Governs:** f-20260830-17
* **Chosen:** no skip. Exact `{ specifier, exported, local }` allowlist of today's native.ts re-exports, plus an independent denylist (`@tauri-apps/api`, `api/event`, `plugin-fs`, `plugin-http`, `plugin-shell`, `plugin-updater`, and `api/core` `invoke`) that still fires when a test injects the denylisted name into the allowlist. `export *` / `export * as` are forbidden. `native.ts` is the only `@tauri-apps` door; `tauri.ts` may not import those specifiers.
* **Rejected:** keeping the blanket skip (the one-line listen/plugin-fs re-export would stay invisible). Rejected denylist-only (`review-minimalism` 91): `export { relaunch } from "@tauri-apps/plugin-process"` would then be green and native.ts could grow into a general barrel of any non-denylisted plugin.
* **Because:** the finding's dissolve-the-boundary case is a re-export in the one file the checker refused to look at. Equality on exported names (not locals) is what makes `export { invoke as convertFileSrc }` red. The `relaunch` extra-export fixture is the proof that dropping equality goes green.
* **Decided by:** Grok, drain session 8f16b1dd, full auto, 2026-08-31 · **Superseded-by:** -

### d-20260831-29 — Regex on syntactic import forms, or a TypeScript module-graph parser, for the Tauri boundary checker?

* **Governs:** f-20260830-17
* **Chosen:** regex on `from`, `export {…} from`, `export * from`, side-effect `import "…"`, `import()`, `require()`, and `vi.mock()`. Specifier prefix `@tauri-apps/(?:api|plugin-)`, including the root `@tauri-apps/api`.
* **Rejected:** a TypeScript/module-graph parser (every sibling checker is regex; the tree has no dynamic `import("@tauri-apps/…")` or `require("@tauri-apps/…")`). Rejected a specifier-substring match (false-positive on `no-updater.test.ts:59`). Rejected `jest.mock()` (Vitest-only tree). Residual `const p = "@tauri-apps/…"; import(p)` stays invisible and is tested as an allowed fixture.
* **Because:** the live leak was `vi.mock("@tauri-apps/plugin-os")` in keybinds.test.ts, which a `from`-only detector cannot see. Widening the existing detector to every syntactic form closes that class without a new parser dependency.
* **Decided by:** Grok, drain session 8f16b1dd, full auto, 2026-08-31 · **Superseded-by:** -

### d-20260831-30 — Does WebviewWindow.onResized count as a raw Tauri listener the boundary checker must reject?

* **Governs:** f-20260830-17
* **Chosen:** no. `TopBar.tsx` calling `onResized` on the object from `getCurrentWebviewWindow()` is host-window API obtained through the native facade, not a Specta event. `.listen(` on a non-facade file remains a violation.
* **Rejected:** treating any `on[A-Z]` call as a listener (would force a wrapper per WebviewWindow method and would not have caught the dissolve-the-boundary re-export).
* **Because:** `.claude/rules/ipc-events.md` is about registry events vs bare-string emits. Window resize is not in `collect_events!`.
* **Decided by:** Grok, drain session 8f16b1dd, full auto, 2026-08-31 · **Superseded-by:** -

### d-20260831-31 — Extract the git working-tree enumerator now, or leave it to f-20260830-54?

* **Governs:** f-20260830-17 f-20260830-54
* **Chosen:** extract `listWorkingTreeFiles` in `scripts/working-tree-files.mjs` now and route `check-ui-boundaries.mjs` plus `check-tauri-command-boundary.mjs` through it. Git argv stays `ls-files --others --exclude-standard -- src` and `ls-files -- src`. Fail closed. f-20260830-54 keeps routing the skill-bridge, tool-parity, and gate-routing walkers onto this helper.
* **Rejected:** copying the fifteen-line walker into the Tauri checker (rule 11: extract at the second similar implementation; ui-boundaries is already the first). Rejected keeping `readdir` (cannot fail closed on broken git).
* **Because:** both checkers enumerate `src/` the same way. A second copy would drift in skip/symlink/untracked handling, which is the class f-20260830-54 filed.
* **Decided by:** Grok, drain session 8f16b1dd, full auto, 2026-08-31 · **Superseded-by:** -

### d-20260831-32 — Should vi.mock of @/bindings/generated be a Tauri boundary violation?

* **Governs:** f-20260830-17
* **Chosen:** no. Production `from` / `import()` / `export from` / `require()` of `bindings/generated` stay illegal outside `tauri.ts` and `generated.ts`. `vi.mock("@/bindings/generated")` stays legal. `vi.mock("@tauri-apps/…")` is illegal and keybinds.test.ts was retargeted onto `@/platform/native`.
* **Rejected:** retargeting the six generated mocks in this slice (tauri.test.ts is the facade's own test; the other five mock the facade's inner module so unwrap still runs). Rejected ignoring `vi.mock("@tauri-apps/…")`.
* **Because:** a generated mock substitutes the module the facade imports; an `@tauri-apps` mock reaches around the facade. Mixed `import { commands, type events } from "@/bindings"` is still a value-import violation.
* **Decided by:** Grok, drain session 8f16b1dd, full auto, 2026-08-31 · **Superseded-by:** -

### d-20260831-33 — Work the whole engine-uci cluster pinned at f-20260830-53, or slice 53 alone?

* **Governs:** f-20260830-53
* **Chosen:** slice to f-20260830-53 at its filed `lens` tier. The stderr drain lives on `EngineRuntime::spawn` in `src-tauri/src/engine/process.rs`. Left open at their filed tiers: f-20260831-10 (`inline`, `chess.rs` bound scores), f-20260831-11 (`build`, engine removal without terminate), f-20260831-12 (`inline`, name lookup + duplicate MultiPV), f-20260831-19 (`inline`, stop/kill rejections discarded).
* **Rejected:** taking the whole `engine-uci` Root-`-` cluster through `build` because `next` grouped them. Also rejected: folding f-20260831-11 into this slice because both mention `process.rs` — 11 is a design question about who terminates when an engine identity disappears (including workspace delete), which is what 53's filing said not to bolt a spawn-path ownership fix onto.
* **Because:** a ledger area is a vocabulary bucket, not a cohesive file set (`d-20260827-07`, `d-20260827-11`, `d-20260828-19`, `d-20260831-01`). Highest tier among slice members is `lens`. The cluster's `entry=build` came from 11, which this run deliberately did not work.
* **Decided by:** Grok, autonomously under `full auto` while Felix was away, drain session a7210a8e-2889-4891-b97a-3ee4e544af8f · **Superseded-by:** -

### d-20260831-34 — Work the whole engine-uci cluster pinned at f-20260831-10, or slice the aggregation loops?

* **Governs:** f-20260831-10, f-20260830-43
* **Chosen:** slice to the two UCI info-line loops in `src-tauri/src/chess.rs`. Work f-20260831-10 at its filed `inline` tier, and f-20260830-43 with it because the report-path `assert_eq!` sits in the same loop. Left open at their filed tiers: f-20260831-11 (`build`, engine removal without terminate), f-20260831-12 (`inline`, name lookup + duplicate MultiPV), f-20260831-19 (`inline`, stop/kill rejections discarded), f-20260831-20 (`build`, unbounded `child.wait()`).
* **Rejected:** taking the whole `engine-uci` Root-`-` cluster through `build` because `next` grouped them. Also rejected: folding f-20260831-12 into this slice because last-wins MultiPV and name lookup live in `set_options` / `EngineSettingsForm.tsx`, not in the info-line loops.
* **Because:** `d-20260831-33` already sliced this cluster the same way. A ledger area is a vocabulary bucket, not a cohesive file set (`d-20260827-07`). Highest tier among slice members is `inline`. 43 is same-loop under rule 4b, not a pull of a foreign area.
* **Decided by:** Grok, autonomously under `full auto`, drain session dea73382-8d47-4db7-8ae2-0d084b872bf8 · **Superseded-by:** -

### d-20260831-35 — Is the report-path assert_eq! a real invariant to return as Error, or dead panic code?

* **Governs:** f-20260830-43
* **Chosen:** remove the assert. The sequence guard (`multipv == len + 1`, then `multipv == real_multipv`) already makes `collected.len() == real_multipv`; the interactive loop never asserted. Both loops now share `ingest_info_line`.
* **Rejected:** converting the assert to an `Error` return in both loops. That path cannot fire given the surrounding conditions, so it would be an untestable error, and a panic on engine stdout is the defect even if the arithmetic is tautological.
* **Because:** a misbehaving engine is already dropped by the sequence guard before the complete-set branch. Matching the interactive loop is the consistent collector, not a second enforcement mechanism.
* **Decided by:** Grok, autonomously under `full auto`, drain session dea73382-8d47-4db7-8ae2-0d084b872bf8 · **Superseded-by:** -

## 2026-09-01 — recorded through the decisions lock

### d-20260901-01 — Work the whole gate-scripts cluster pinned at f-20260830-23, or slice 23 alone?

* **Governs:** f-20260830-23
* **Chosen:** slice to f-20260830-23 at its filed `build` tier. Left open at their filed tiers: f-20260830-46 (inline, coverage-script duplication), f-20260830-54 (inline, remaining checker walkers onto listWorkingTreeFiles), f-20260830-55 (inline, gate-receipt and skill-bridge assertion strength).
* **Rejected:** taking the whole `gate-scripts` Root-`-` cluster through `build` because `next` grouped them.
* **Because:** a ledger area is a vocabulary bucket, not a cohesive file set (`d-20260831-33`). 23 is the native FS source-level gate (`src-tauri/clippy.toml` / `check-rust-release-surface.mjs`). 46 is coverage exporters. 54 is skill-bridge/tool-parity/gate-routing walkers. 55 is test-assertion strength. Highest tier among slice members is `build`.
* **Decided by:** Grok, drain session d0b4541b-aea3-4824-a006-c685dc72673c, full auto, 2026-08-31 · **Superseded-by:** -

### d-20260901-02 — How is the Rust filesystem convention enforced: clippy.toml, a new checker, or R3/R4 on the existing release-surface gate?

* **Governs:** f-20260830-23
* **Chosen:** add R3 (filesystem-call containment) and R4 (pathname-primitive containment) to `scripts/check-rust-release-surface.mjs`. Enumerate via `listWorkingTreeFiles` with pathspec `src-tauri/src`. Do not add `src-tauri/clippy.toml`.
* **Rejected:** `clippy.toml` `disallowed-methods` as the gate. Clippy cannot path-scope; `#[allow(clippy::disallowed_methods)]` is a hole; a crate-wide rule is red today on 48 production sites. Rejected: checker plus clippy.toml (two mechanisms, one weaker). Rejected: a fifth directory walker (`d-20260831-07`, `d-20260831-31`).
* **Because:** the renderer analogue is a line-oriented checker, and this repository already has `check-rust-release-surface.mjs` for source-level Rust rules (R1/R2), wired into `package.json`, `test.yml` and the push skill. `d-20260831-07` assigned the general FS gate to this finding rather than annotating it.
* **Decided by:** Grok, drain session d0b4541b-aea3-4824-a006-c685dc72673c, full auto, 2026-08-31 · **Superseded-by:** -

### d-20260901-03 — Migrate remaining production std::fs sites through PathAuthority now, or land a shrink-only allowlist?

* **Governs:** f-20260830-23
* **Chosen:** a shrink-only file allowlist plus per-file production match counts for the nine files that currently reach the filesystem outside `infra/` (credentials, db/mod, db/repository, db/search_index, file_workspace, fs, main, puzzle, sound). Pathname `&Path` on `infra/fs.rs` stays. `AuthorizedPath` / `PathRef` on those primitives is a follow-on.
* **Rejected:** routing every remaining production `std::fs` / pathname `atomic_replace` call through `PathAuthority` in this run. Rejected: requiring `AuthorizedPath` on `atomic_replace` now (`PathRef` cannot represent the authority registry file, backend temp dirs, or native save-dialog destinations). Rejected: file-level allowlist without counts (a new `std::fs::write` in `main.rs` would stay green).
* **Because:** this finding is the missing *gate*, which the native-fs cluster already left here (`d-20260831-07`). Emptying the allowlist is native-fs, different files, filed as a follow-on. Residual: same-line same-count substitution in an allowlisted file; `path.canonicalize()` without a `std::fs` import (Path methods dropped after `AccountRecord::metadata` false positives).
* **Decided by:** Grok, drain session d0b4541b-aea3-4824-a006-c685dc72673c, full auto, 2026-08-31 · **Superseded-by:** -

### d-20260901-04 — Work the whole native-fs cluster pinned at f-20260831-01, or slice by file set?

* **Governs:** f-20260831-01, f-20260831-02, f-20260831-03, f-20260831-04, f-20260901-01
* **Chosen:** slice to f-20260831-01, f-20260831-02, and f-20260831-03 at their filed `build` tier. Left open at its filed `build` tier: f-20260901-01 (empty the R3/R4 allowlist). Sequence f-20260831-04 behind d-20260830-15 with `Blocked: sequenced-d-20260830-15`.
* **Rejected:** taking the whole `native-fs` Root-`-` cluster through `build` because `next` grouped them. Also rejected: folding f-20260901-01 into this slice (nine files, 37 production matches, the follow-on d-20260901-03 deferred). Also rejected: implementing a document signature for f-20260831-04 against `www.encroissant.org`.
* **Because:** a ledger area is a vocabulary bucket, not a cohesive file set (d-20260827-07, d-20260901-01). 01/02/03 are the 2026-08-31 native-fs review residuals in `fs.rs` and `path_authority.rs`. 04 is sequenced by Felix in d-20260830-15. 05 is the PathAuthority migration of the allowlist. Highest tier among slice members is `build`.
* **Decided by:** Grok, autonomously under `full auto`, drain session 1ad979b3-8a54-471f-a0ca-2357dc00a286 · **Superseded-by:** -

### d-20260901-05 — Does the download security class come from the renderer id prefix, or from the destination grant?

* **Governs:** f-20260831-01
* **Chosen:** derive `OpClass` from the destination PathRef's stored `PathOperation` vector (`from_operations`). Dedicated commands may pin class by identity (`download_lichess_games` → Lichess). Keep `id: String` as the progress label; do not change the Specta `download_file` signature.
* **Rejected:** keep trusting `OpClass::from_id` prefixes (the defect). Rejected: adding a Specta enum so the renderer still names the class. Rejected: dropping `id` and regenerating bindings (progress keys and `ProgressButton` still need a string).
* **Because:** renderer state is not authoritative for downloads. Database roots grant Database*+DownloadFile, puzzle roots Puzzle*+DownloadFile, engine roots DownloadArchive+EngineInstall, and the generic Lichess/Chess.com folder grants only DownloadFile — so the persistent grant vector distinguishes the four classes. The filed spoof is `lichess_` plus a database destination plus `integrity: None`.
* **Decided by:** Grok, autonomously under `full auto`, drain session 1ad979b3-8a54-471f-a0ca-2357dc00a286 · **Superseded-by:** -

### d-20260901-06 — What should persist_workspace_child do when the registry commit is DurabilityUncertain?

* **Governs:** f-20260831-02
* **Chosen:** after `commit_candidate` adopts, return `Error::CommittedDurabilityUncertain` without rolling back the created object. Create callers (`create_database_child`, `create_workspace_directory`) skip rollback on that variant only. Same helper at the other five `?;` discard sites in `path_authority.rs`. No new Specta type.
* **Rejected:** silent `Ok(handle)` (the defect). Rejected: fail-and-rollback (deletes a completed file/directory because parent sync failed). Rejected: a `(Handle, CommitDurability)` Specta result (`d-20260830-05` parked structured errors).
* **Because:** `DurabilityUncertain` means the replacement happened (`commit_state` already adopts). That is the `ad03e196` / `remove_workspace_entry` shape and the existing renderer category `applied-despite-error` (`d-20260830-05`, `d-20260831-01`). A later list dedups on path+inode+dir flag, so the handle is recoverable. Rollback on this error is the strictly worse option locate measured.
* **Decided by:** Grok, autonomously under `full auto`, drain session 1ad979b3-8a54-471f-a0ca-2357dc00a286 · **Superseded-by:** -

### d-20260901-07 — How should a failed registry save adopt the pruned candidate?

* **Governs:** f-20260831-03
* **Chosen:** retry `replace` once inside `save_entries_with` when it returns `Err`. If the retry succeeds, `commit_state` adopts as today. If both fail, do not adopt (the residual after the bound). Do not retry `Ok(DurabilityUncertain)`.
* **Rejected:** a next-commit reconcile (the next save serializes stale `self.persistent`). Rejected: load-time drop of unresolved records (`d-20260830-04`: an unmounted volume is also unresolved). Rejected: a user-visible repair action. Rejected: retrying `DurabilityUncertain` (the replacement already happened).
* **Because:** the prune exists only in the in-memory candidate; the `Err` path is the only window that can persist it. One retry is a bound, uses the existing atomic-replace injector, and leaves the always-fail test (`registry_failure_after_unlink_is_applied_despite_error_and_keeps_persisted_state`) as the exhausted-bound residual.
* **Decided by:** Grok, autonomously under `full auto`, drain session 1ad979b3-8a54-471f-a0ca-2357dc00a286 · **Superseded-by:** -

### d-20260901-08 — Is f-20260831-04 actionable before the fork serves its own signed engine manifest?

* **Governs:** f-20260831-04
* **Chosen:** no. Set `Blocked: sequenced-d-20260830-15`. The finding stays open. Do not implement a document signature in this run.
* **Rejected:** treating it as `felix-decision` (Felix already answered in `d-20260830-15`). Rejected: signing against `www.encroissant.org` (this fork does not control that origin). Rejected: marking the finding handled.
* **Because:** `d-20260830-15` (Felix, 2026-08-30) defers the fork's own signing keypair, CI release workflow, self-hosted engine-manifest and download page. Per-entry signatures authenticate only `${downloadLink}\n${sha256}`; the extra fields cannot be authenticated without a signed document this fork does not yet serve. Blocking with the sequencer slug removes it from the native-fs pick until that work starts.
* **Decided by:** Grok, autonomously under `full auto`, drain session 1ad979b3-8a54-471f-a0ca-2357dc00a286 · **Superseded-by:** -

### d-20260901-09 — After a failed prune save, how do later commits avoid reserializing deleted records?

* **Governs:** f-20260831-03
* **Chosen:** keep the one Io retry from d-20260901-07, and add an in-memory `pending_unpersisted_removals` set applied by the single `commit_registry` writer (entries, pending artifacts, active roots). Reservation does not adopt on DurabilityUncertain.
* **Rejected:** rewriting d-20260901-07 in place. Rejected: load-time drop of unresolved records (d-20260830-04). Rejected: a durable pre-unlink tombstone (new persistence protocol; crash residual stays documented). Rejected: retrying OperationAndCleanup (it can wrap Conflict).
* **Because:** plan-review root-cause showed retry-only still lets later save_entries callers reserialize stale self.persistent. Stripping at the one writer removes that mechanism without reversing the load-time rule. Recorded beside d-20260901-07, not rewritten, per d-20260831-01.
* **Decided by:** Grok, autonomously under `full auto`, drain session 1ad979b3-8a54-471f-a0ca-2357dc00a286 · **Superseded-by:** -

### d-20260901-10 — Slice the frontend-ui cluster to the __root.tsx menu pair?

* **Governs:** f-20260830-47, f-20260830-49
* **Chosen:** work f-20260830-47 and f-20260830-49 together; leave f-20260831-13, f-20260831-15, and f-20260901-02 open.
* **Rejected:** working the whole frontend-ui cluster in one run (AddEngine identity, picker rejection, and engine durability recovery do not share this file set).
* **Because:** a ledger area is a vocabulary bucket, not a cohesive file set (d-20260827-07). Highest tier among slice members is build. The previous workspace-picker plan already named this pair as the next __root.tsx slice.
* **Decided by:** Grok, autonomously under `full auto` while Felix was away · **Superseded-by:** -

### d-20260901-11 — Where does the extracted app-menu builder live?

* **Governs:** f-20260830-47
* **Chosen:** `src/routes/-appMenu.ts` (dash prefix so TanStack Router does not treat it as a route). It stays under `src/routes/**` and therefore inside the `tabs-routing` coverage area.
* **Rejected:** `src/utils/appMenu.ts` or `src/components/appMenu.ts`, which sit in no coverage area and would force a `coverage-areas.json` edit. Rejected: `src/routes/appMenu.ts` without the dash — the router warned it is a route file that does not export `Route`.
* **Because:** d-20260830-08 forbids editing coverage-areas.json just to place a new file. The dash prefix is the project's `routeFileIgnorePrefix`.
* **Decided by:** Grok, autonomously under `full auto` while Felix was away · **Superseded-by:** -

### d-20260901-12 — Does Title Bar = Native on Linux remove the application menus?

* **Governs:** f-20260830-49
* **Chosen:** it does not. `setAsAppMenu` installs a GTK menu bar with File, View, Help, and About. The finding is rejected as invalid. The existing coupling (native decorations + native menu, no TopBar) stays.
* **Rejected:** keeping TopBar on Linux whenever decorations are native; hiding the Title Bar setting on Linux; switching to `setAsWindowMenu` as a first fix.
* **Because:** measured 2026-09-01 on tuxedo-atlas against the release binary in `kwin_wayland --virtual`. After `native-bar=true` the page lost in-page File/View/Help and window controls, and AT-SPI showed `application:en-croissant` → `menu bar` → File (New Tab, Open File, Exit), View, Help (…, About) plus native Minimize/Maximize/Close. About is reachable. The 2026-08-30 correction already forbade acting on the fix shape before this check.
* **Decided by:** Grok, autonomously under `full auto` while Felix was away · **Superseded-by:** -

### d-20260901-13 — How should a failed Tauri listener registration reach the user?

* **Governs:** f-20260830-30
* **Chosen:** required `onError` at every `useTauriListener` site, implemented by `notifyListenerError` (`notifyUnlessCancelled(i18n.t("Common.Error"), error)`). Callbacks are `(event, AbortSignal) => void | Promise<void>`; AccountCard guards `setDatabases` with the signal.
* **Rejected:** a console.error fallback (invisible in a packaged build); importing Mantine into `src/platform/`; a post-await disposed check in the hook as the only stale-write guard.
* **Because:** the facade must stay UI-agnostic, TypeScript catches a missed site, and only the callback can skip its own parent setState after `await`.
* **Decided by:** drain 9158e343-6014-4227-9376-7ed251b78003 · **Superseded-by:** -

### d-20260901-14 — How should a full sessionStorage quota on tree flush reach the user?

* **Governs:** f-20260831-16
* **Chosen:** live debounce calls `reportPersistError` with the same Error `seed()` throws; quit (`beforeunload`/`pagehide`) flushes best-effort, never throws, never notifies; per-key try continues after a failure.
* **Rejected:** throwing from unload (not user-visible; `pagehide` cannot prompt); a browser "are you sure" dialog; a next-startup durable failure marker (quota may refuse even a tiny key).
* **Because:** the 300 ms debounce is the in-session surface, and one full tab must not block flushing the others.
* **Decided by:** drain 9158e343-6014-4227-9376-7ed251b78003 · **Superseded-by:** -

### d-20260901-15 — When may workspace ID migration delete legacy tree keys?

* **Governs:** f-20260831-17
* **Chosen:** clone and flush new ids, then persist a compressed envelope; only then delete legacy keys. On clone-flush or envelope failure, roll clones back, keep old keys, notify, return the unrepaired workspace. Live `setItem` schema-validates and does not remap ids.
* **Rejected:** deleting old keys inside `repairWorkspace` before the envelope write; remapping ids on every `setItem` (that wrote empty UUID tabs after a failed getItem).
* **Because:** the envelope is the source of truth; a live write that invents ids without cloning orphans the recoverable tree.
* **Decided by:** drain 9158e343-6014-4227-9376-7ed251b78003 · **Superseded-by:** -

### d-20260901-16 — How should the engine list be persisted against quota?

* **Governs:** f-20260831-18
* **Chosen:** `serializeStorageValue` / `decodeCompressedOrJson` with pretty-JSON fallback; await `setItem`; catch quota and `reportPersistError` with `Engines.SaveError`; do not rethrow into Jotai. No max-engines cap.
* **Rejected:** a third engines-specific encoding; compressing every `createZodStorage` preference atom; a hydration max that would wipe a large engine list.
* **Because:** enginesStorage is the only `createAsyncZodStorage` caller, the tree serializer already exists, and a numeric cap without a product number is more destructive than notify-on-quota.
* **Decided by:** drain 9158e343-6014-4227-9376-7ed251b78003 · **Superseded-by:** -

### d-20260901-17 — Who owns termination when an engine identity disappears?

* **Governs:** f-20260831-11
* **Chosen:** `EngineSupervisor.retire_engine` tombstones the application id (bounded at 4096), takes the registration publication barrier, and drains every actor whose key or `engine_id` matches, including report analysis. The Specta command is `retire_engine`. The renderer always drops `enginesAtom` after the command returns.
* **Rejected:** renderer looping `killEngine` over known tabs (not authoritative; misses report keys). One-shot key snapshot (concurrent `replace_handle` republishes). Un-retiring on command failure (reopens the publish race). Keeping the atom on failure (split-brain: UI engine that can never spawn).
* **Because:** `.claude/rules/async-resource-invariants.md` makes native state authoritative. `analyze_game` keys by operation id, so owner identity has to be stored on the actor. Plan review rounds 1-2 independently found the snapshot and split-brain holes.
* **Decided by:** Grok, autonomously under `full auto`, drain session b57daa5c-9e45-4894-90f9-6e341db32080 · **Superseded-by:** -

### d-20260901-18 — Bound the post-kill child wait, or stall the supervisor?

* **Governs:** f-20260831-20
* **Chosen:** `EngineDeadlines.kill_reap` default 2s. Production path is `terminate_child` over `ChildControl`. After a wait timeout, drop the `Child` so `kill_on_drop` can fire. No detached unbounded waiter. D-state residual is a zombie until app exit, stated next to `kill_reap`.
* **Rejected:** unbounded `child.wait()` (stalls tab close and the 15s shutdown, which cannot cancel the actor). Detached background wait (relocates the stall and keeps `Child` alive so `kill_on_drop` cannot fire). Keeping the actor on `start_kill` failure (contradicts Terminate-always-exits at process.rs:1063,1147).
* **Because:** `EngineDeadlines` already says every protocol wait is bounded. Round-2 lenses showed the keep-actor and detached-wait designs were internally contradictory with the existing actor loop.
* **Decided by:** Grok, autonomously under `full auto`, drain session b57daa5c-9e45-4894-90f9-6e341db32080 · **Superseded-by:** -

### d-20260901-19 — Duplicate MultiPV: last-wins collapse, or reject?

* **Governs:** f-20260831-12
* **Chosen:** collapse by name, last value wins, first-seen order, into one `to_send` list. `real_multipv` is parsed from that list. `analyze_game` forces `REPORT_MULTIPV` (2) on extras and `inherited_values`. Persisted settings collapse the same way.
* **Rejected:** reject-as-error (UI `.map` can duplicate; a hard error turns a slider glitch into a dead engine). First-wins (disagrees with the engine after both `setoption`s). Collapsing extras and resolved independently (analysis restored last original value only onto resolved).
* **Because:** `.claude/rules/engine-lifecycle.md` requires the expected count to match the value actually sent. `analyze_game` was the production path that made independent collapse diverge.
* **Decided by:** Grok, autonomously under `full auto`, drain session b57daa5c-9e45-4894-90f9-6e341db32080 · **Superseded-by:** -

### d-20260901-20 — Do game-manager engines terminate when a local engine is removed?

* **Governs:** f-20260831-11
* **Chosen:** out of this cluster. `PlayerConfig::Engine` stores display name + handle, not the application id. Filed separately.
* **Rejected:** matching live games by `EngineHandle` (duplicate configs share a handle, so removing one copy would kill the other copy's game). Adding an id to `PlayerConfig` in this cluster (game-start Specta contract, different file set).
* **Because:** `d-20260827-07` — a ledger area is a vocabulary bucket. `game.rs` is a different owner (`GameManager`) with no id to match on. Related handled `f-20260830-51` already recorded that game engines outlive app exit.
* **Decided by:** Grok, autonomously under `full auto`, drain session b57daa5c-9e45-4894-90f9-6e341db32080 · **Superseded-by:** -

### d-20260901-21 — Work the whole frontend-ui cluster pinned at f-20260831-13, or slice by file set?

* **Governs:** f-20260831-13, f-20260901-02
* **Chosen:** slice to f-20260831-13 and f-20260901-02 at the slice's highest filed tier (`lens`). They share `AddEngine.tsx`. Left open at their filed tiers: f-20260831-15 (`inline`, native pickers in AddDatabase/DatabasesPage/AccountCard), f-20260901-03 (`inline`, RootLayout/TopBar wiring tests).
* **Rejected:** taking the whole `frontend-ui` Root-`-` cluster through `lens` because `next` grouped them. Also rejected: working 13 alone and leaving 02, because 02's callers include the same AddEngine registration path this run had to read.
* **Because:** a ledger area is a vocabulary bucket, not a cohesive file set (`d-20260827-07`, `d-20260831-33`). Highest tier among slice members is `lens` from f-20260901-02 (`review-error-handling`).
* **Decided by:** Grok, autonomously under `full auto`, drain session 6c414848-1af4-4189-8ab2-a58fee3fcea5 · **Superseded-by:** -

### d-20260901-22 — How does engine registration recover an adopted handle after CommittedDurabilityUncertain?

* **Governs:** f-20260901-02
* **Chosen:** `register_engine_file`, `register_engine_image`, `register_opening_book`, and `promote_engine_resource` return the adopted handle as `Ok` after an uncertain parent sync (`keep_adopted_handle`), logging the stage and the handle. `registerInstalledEngineHandle` still uses `runWithAppliedRecovery` with a second register as lookup. Picker clicks go through `runUnlessCancelled`.
* **Rejected:** keeping `require_durable` and recovering via a renderer list (picker paths never cross IPC; copied images are UUID-named). Rejected: a new Specta `{ handle, durability_uncertain }` result type (`f-20260831-02` already rejected that for persist-workspace-child, and file-create recovered UX is silent continue). Rejected: re-invoking picker commands as recover (opens a second dialog).
* **Because:** `set_active_engine_root` already returns `Ok` on uncertain parent sync and keeps the handle usable. File/database create can list by a renderer-chosen filename; engine pickers cannot. New evidence relative to f-20260831-02: there is no engine list command, so returning `Err` drops the only copy of the handle.
* **Decided by:** Grok, autonomously under `full auto`, drain session 6c414848-1af4-4189-8ab2-a58fee3fcea5 · **Superseded-by:** -

### d-20260901-23 — What identifies an already-installed default engine in the download list?

* **Governs:** f-20260831-13
* **Chosen:** the manifest `downloadLink`. `isManifestEngineInstalled` is true only when an installed local engine stores that same URL.
* **Rejected:** comparing display `name` (mutable and non-unique; the filed defect). Rejected: comparing `path` / `filename` last component (two archives can extract a binary named `stockfish`; persisted local engines store only the last path component).
* **Because:** `downloadLink` is in `localEngineSchema` and is written by the install spread, so it survives reload. A renamed engine stays marked installed; a same-named distinct download stays installable. A locally picked binary with no URL does not block the download.
* **Decided by:** Grok, autonomously under `full auto`, drain session 6c414848-1af4-4189-8ab2-a58fee3fcea5 · **Superseded-by:** -

### d-20260901-24 — Does ProgressButton treat any terminal progress as installed?

* **Governs:** f-20260901-02
* **Chosen:** `completed` is `initInstalled || item.state === "succeeded"`. Failed or cancelled progress shows the action label again. AddEngine also `clearProgress` after a failed install so a succeeded download followed by a failed register does not stick.
* **Rejected:** treating `finished` as completed (Failed and Cancelled are finished; the button then read "Installed" and stayed disabled). Rejected: using only `initInstalled` (ReportPanel has `initInstalled={false}` and relies on succeeded to show "Report generated").
* **Because:** `DatabaseLoader` already distinguishes `finished && state !== "succeeded"`. Native download failures emit terminal `finished: true` before the renderer decides whether the engine was added.
* **Decided by:** Grok, autonomously under `full auto`, drain session 6c414848-1af4-4189-8ab2-a58fee3fcea5 · **Superseded-by:** -

### d-20260901-25 — Does a succeeded engine download mark the card Installed before registration finishes?

* **Governs:** f-20260901-02
* **Chosen:** engine download cards pass `completeOnProgressSuccess={false}`. Completed is `initInstalled` from `downloadLink` (plus a same-session flag after `setEngines`). Native download `succeeded` is not the install terminal state. ReportPanel and other single-job callers keep the default (succeeded completes).
* **Rejected:** treating download `succeeded` as Installed and clearing progress on a later register failure (`d-20260901-24` as applied to AddEngine). That leaves a disabled Installed card when `clearProgress` also fails, and a transient Installed state between extract and register.
* **Because:** new evidence from the `$push` review of `8952f592`: `downloadEngineArchive` publishes Succeeded before `registerInstalledEngineHandle` / `getEngineConfig`. `d-20260901-24` remains correct for failed/cancelled vs succeeded on a job that IS the whole action.
* **Decided by:** Grok, `$push` review of drain session 90d643ce-20af-4485-8f40-159145362c48 · **Superseded-by:** -

### d-20260901-26 — Work the whole gate-scripts cluster pinned at f-20260830-46, or slice 11 off?

* **Governs:** f-20260830-46 f-20260830-54 f-20260830-55 f-20260901-11
* **Chosen:** slice to f-20260830-46, f-20260830-54, and f-20260830-55 at their filed `inline` tiers. Left open at its filed `inline` tier: f-20260901-11 (decision toasts in `scripts/findings.py`).
* **Rejected:** taking the whole `gate-scripts` Root-`-` cluster because `next` grouped them. Also rejected: adopting ChessRiddle `6f83b80d8` `scripts/findings.py` in this run.
* **Because:** a ledger area is a vocabulary bucket, not a cohesive file set (`d-20260901-01`). 46 is coverage exporters. 54/55 are Node checker walkers and assertion strength. 11 is `scripts/findings.py`. Re-pinning 11 to `6f83b80d8` would also pull the product-impact gate (`2136dc449`/`0b40e648b`), which would fail `findings.py check` on three existing `felix-decision` parks that lack `**Product impact:**`, one of which (`f-20260829-04`) cannot grow that bullet honestly. Highest tier among slice members is `inline`.
* **Decided by:** Grok, drain session 79e0e1f8-beb4-491f-b1dd-604951fa0de2, full auto, 2026-09-01 · **Superseded-by:** -

### d-20260901-27 — Assert the REQUIRED_TOOLS registry, or drive every gate's probe for real?

* **Governs:** f-20260830-55
* **Chosen:** export `REQUIRED_TOOLS` and `TOOL_PROBES`, pin the exact per-gate tool lists, assert every listed tool has a probe, and drive the real `toolchainFingerprint` once for `frontend-build` (node + pnpm).
* **Rejected:** invoking rustc, cargo, nightly, cargo-llvm-cov, and playwright-image on every receipt-test run.
* **Because:** deleting a probe or dropping `playwright-image` from `e2e-container` now fails the pinned mapping; the real frontend-build path proves the default fingerprint is not a dead export. The heavier probes are the invocations the suite currently avoids, and they are machine-dependent.
* **Decided by:** Grok, drain session 79e0e1f8-beb4-491f-b1dd-604951fa0de2, full auto, 2026-09-01 · **Superseded-by:** -

### d-20260901-28 — How does a Codex bridge point at its canonical skill?

* **Governs:** f-20260830-55
* **Chosen:** a positive pointer: a line that names the canonical path and either `read`/`follow` or `first`/`canonical`, skipping lines with `do not`/`don't`/`never`. Keep the line cap as a second independent check.
* **Rejected:** substring `includes(pointer)` (the defect). Also rejected: trying to detect "delegation" semantically beyond the pointer, reverse-bridge, and line cap.
* **Because:** `Do not read \`.claude/skills/push/SKILL.md\`` plus extra instructions under the cap is the filed false-green. A positive-pointer rule fails that fixture and still accepts `Read \`.claude/skills/push/SKILL.md\` first.`
* **Decided by:** Grok, drain session 79e0e1f8-beb4-491f-b1dd-604951fa0de2, full auto, 2026-09-01 · **Superseded-by:** -

### d-20260901-29 — Who maps a permanently-deleted workspace tree to running engines?

* **Governs:** f-20260901-06
* **Chosen:** Native PathAuthority reports dropped engine PathRefs (EngineExecute/Configure) even on registry-save Err. `SupervisedEngine.executable` is a required PathRef. `EngineSupervisor` tombstones those PathRefs (bounded 4096, registration barrier) and `terminate_matching` by PathRef. It does not `retire_engine` the application id. Unlink success stays Ok; terminate failure is logged. Trash does not retire.
* **Rejected:** renderer FilesPage scanning enginesAtom (no descendant PathRefs; misses native-only unlink). Retire on trash (rename+rebind). Physical-path reverse map. `retire_engine(E)` on unlink (keeps the engine card but tombstones E, so a UI engine can never spawn, and would kill E on a replacement PathRef). `Option<PathRef>` so tests can pass None. `OperationAndCleanup` with successful unlink as primary.
* **Because:** d-20260901-17 owns identity disappearance; a file unlink is not EnginesPage removal. Decision 6 of this cluster keeps enginesAtom. Round-2 `review-engine-protocol` showed retiring E when P1 is deleted kills E's actor on P2.
* **Decided by:** Grok, autonomously under `full auto`, drain session d58d92d7-caf1-4775-a0cb-e060044b636e · **Superseded-by:** -

### d-20260901-30 — Who owns game-manager engine processes after PlayerConfig gains an id?

* **Governs:** f-20260901-07
* **Chosen:** `EngineSupervisor` as `Arc<EngineSupervisor>` on AppState. `start_game` registers each side after spawn and before init, key `("game:{game_id}:{session}", white|black)`, `engine_id` from required `PlayerConfig::Engine.engine_id`. One `RegisteredGameEngine { actor, key, generation }` per side. Cleanup is `terminate_exact` only. LiveSession clones the Arc so the static game loop can terminate.
* **Rejected:** a second kill path on GameManager (one facade). Matching live games by EngineHandle (d-20260901-20). Key without session (replacement would replace_handle over the old side). Optional engine_id. Parallel actor + key fields.
* **Because:** engine-lifecycle requires an immutable id and one owner. d-20260901-20 left this out of the previous cluster because the id did not exist; this cluster adds it. Round-1 plan review showed AppState owned the supervisor by value so the static loop could not terminate_exact.
* **Decided by:** Grok, autonomously under `full auto`, drain session d58d92d7-caf1-4775-a0cb-e060044b636e · **Superseded-by:** -

### d-20260901-31 — When is an EngineActor registered relative to uciok?

* **Governs:** f-20260901-14
* **Chosen:** `EngineActor::spawn`, then `replace_handle`, then init/uciok/setoption/readyok. Shared helper with a Drop guard that `tokio::spawn`s `terminate_exact` and logs a failed reap. Applies to config probes (`engine-config` / probe UUID), `EngineProcess::new` / get_best_moves / analyze_game, and game engines. Probe UUIDs are not `retire_engine`d.
* **Rejected:** leave interactive init unregistered because it was pre-existing. Key probes by binary path (two probes of the same path collapse). Register only after spawn_initialized returns.
* **Because:** shutdown_backend only sees EngineSupervisor.actors. spawn_initialized awaiting uciok before replace_handle is the same unowned-during-uciok gap as get_engine_config. Same-area as files this run reads (rule 4b).
* **Decided by:** Grok, autonomously under `full auto`, drain session d58d92d7-caf1-4775-a0cb-e060044b636e · **Superseded-by:** -

### d-20260901-32 — What does get_engine_logs return when the actor channel fails?

* **Governs:** f-20260901-10
* **Chosen:** `logs()` returns `Result<Vec<EngineLog>, Error>` without unwrap_or_default. Absent process is still Ok([]). Channel failure is Err(EngineDisconnected) through both chess and game commands. LogsPanel and BoardGame fetchEngineLogs notifyUnlessCancelled once (SWR errorRetryCount 0).
* **Rejected:** keep empty success. Notify on every SWR retry.
* **Because:** a failed log query is not "the engine said nothing". f-20260831-19 already required stop/kill rejections to surface; this is the same class for logs.
* **Decided by:** Grok, autonomously under `full auto`, drain session d58d92d7-caf1-4775-a0cb-e060044b636e · **Superseded-by:** -

### d-20260901-33 — How should renderer error redaction treat secrets, filesystem paths, and chess notation?

* **Governs:** f-20260830-16
* **Chosen:** classify from the unredacted source (plain strings as-is, because generated IPC errors are `string`); then shield FEN boards and `1/2-1/2`; then replace secrets with a callback that preserves the prefix and never uses a `$1` replacement string; then redact Windows/UNC/`~/`/multi-component Unix paths and Unix root files with an extension. `I/O` and chess notation survive.
* **Rejected:** deleting `PATH_PATTERN` (re-admits home directories into user-facing text); classifying after redaction (a path containing `missing` or `timeout` would be miscategorised); putting the unredacted source in `diagnostic` (ipc-events.md forbids a raw backend diagnostic in the renderer).
* **Because:** evaluating the shipped regexes destroyed start-position FENs, PGN draws, and the PartialRemoval cause `I/O failure`, and emitted a literal `$1` for every secret. Those are the load-bearing cases of f-20260830-16.
* **Decided by:** build run 2026-09-01 platform-error-redaction · **Superseded-by:** -

### d-20260901-34 — How does the renderer classify backend errors without a Specta Error type or new AppErrorCategory values?

* **Governs:** f-20260830-28
* **Chosen:** keep substring matching (`d-20260830-05`). Match owned `#[error]` prefixes from `error.rs` before generic English words. Map `Engine timeout:` to `unexpected`, `connection aborted` / `network failure` to `network`, Conflict/ResourceLimit/turn-state strings to `validation`, credential/OAuth failures to `permission`, missing-resource strings to `not-found`. Category name stays `applied-despite-error` (`d-20260831-01`).
* **Rejected:** giving `Error` a Specta type (that is f-20260830-08 / already rejected by d-20260830-05); adding categories such as `conflict` or `engine` (ConfirmModal interpolates `Common.ConfirmationError.${category}` and those keys exist in no locale — f-20260830-11).
* **Because:** the harmful live mis-routes were a hung local engine shown as connectivity and `connection aborted` shown as cancellation. Owned prefixes on the existing seven categories fix those without expanding the i18n surface.
* **Decided by:** build run 2026-09-01 platform-error-redaction · **Superseded-by:** -

### d-20260901-35 — Where is a normalised AppError stored, and what does diagnostic contain?

* **Governs:** f-20260830-29
* **Chosen:** `normalizeError` is idempotent: return an `AppError` unchanged, and return `error.details` when the value is a `TauriCommandError`. The proxy catch rethrows an already-wrapped `TauriCommandError`. `diagnostic` is omitted unless a caller supplies extra safe context that differs from `message`. ErrorComponent hides the Code/copy control when diagnostic is absent or equal to message.
* **Rejected:** rewriting the seven `normalizeError` call sites to read `.details` (the eighth would re-normalise); copying `message` into `diagnostic` (ErrorComponent presented it as a stack trace); stuffing the unredacted cause into `diagnostic`.
* **Because:** no production reader of `.details` existed, and `applied-despite-error` survived a second pass only because the two Rust literals contain no `/`. Idempotence at the facade is the one change that keeps every current and future consumer correct.
* **Decided by:** build run 2026-09-01 platform-error-redaction · **Superseded-by:** -

### d-20260901-36 — How is the BoardGame test timeout that reddened master CI fixed?

* **Governs:** the CI failure on `94c17b9`, `04287eb`, `4668b45` (runs 33517593225, 33522388348, 33522556421)
* **Chosen:** extract `toPlayerConfig` out of the 1127-line `BoardGame.tsx` into `playerConfig.ts` and test it directly with a static top-level import. Measured effect: the tested unit's cost falls from 2262 ms (one test, on a 5000 ms budget) to 5 ms for seven tests, whole file 422 ms including collection.
* **Also chosen, from the push review:** `fetchGameEngineLogs` was *not* extracted. The review found it to be a verbatim duplicate of `runUnlessCancelled` in `src/components/files/notifyError.ts:15-25`, which is already the idiom at eight call sites — including `BoardGame.tsx` itself, twelve lines from the other one — and is already tested in `notifyError.test.ts:53-70`. The log fetch now calls that helper directly, so the second new module and its test were deleted rather than shipped. A wrapper whose body is an existing helper is a pass-through layer, not an extraction.
* **Rejected:** (a) raising `testTimeout` in `vite.config.ts` — the repository has no per-test timeout anywhere, and a global bump hides every future slow test rather than the one work item that does not belong in a timed region; (b) hoisting the dynamic import to a static top-level import of `BoardGame` without touching production code. (b) does provably remove the failure — vitest applies `testTimeout` only to the test handler (`@vitest/runner` `index.js:1137-1143`) and never to collection (`:1781-1834`) — but it keeps ~4.8 s of CI transform per run and keeps two pure helpers testable only by loading a whole UI graph.
* **Because:** the defect is not the timeout number. Both functions are pure or near-pure and have no reason to drag Mantine, chessground, jotai and i18next into a unit test; `boardAccessibility.ts` is the same extraction already done in this directory. The flake was structural — 4791 ms passing against a 5000 ms limit, with the failing and passing commits differing by one line of documentation.
* **Note on the coverage objection:** two independent reviewers (a Claude plan lens and `codex exec` on gpt-5.6-sol) both called this a blocker, projecting `boards-game-analysis` from 249 to 242 covered lines. Their per-module accounting was right — deleting `BoardGame.test.tsx` costs 10 lines and 1 function of incidental module-evaluation coverage in `Board.tsx`, `AnnotationHint.tsx`, `GameNotation.tsx`, `CompleteMoveCell.tsx`, `GameInfo.tsx` and `BestMoves.tsx` — but both compared against the *baseline file* on the assumption that it equals the current measurement. It does not. A full `pnpm test:coverage` measures the area at 484/4080 lines before and 474/4080 after, against a baseline of 249. Branches rose 358 → 365. The ratchet passed untouched. **Verify a ratchet claim by running the measurement, not by reading `coverage-baselines.json`.** Filed separately as the finding that the baselines have drifted far enough to stop constraining most areas.
* **Repair carried in the same change:** the review also proved that `toPlayerConfig`'s throw could never reach the user. `startGame` built its `GameConfig` *above* the `try`, so selecting an engine player with no local engine escaped `run()` entirely: no error was displayed and the `finally` never ran, leaving `pendingCommand` at `"start"` and the button disabled until the tab was reopened. The `try` now opens before the config is built. This is why `f-20260901-21` describes that message as reaching the alert — before this repair it reached nothing.
* **Decided by:** session 2026-09-01 boardgame-test-timeout · **Superseded-by:** -

## 2026-09-02 — recorded through the decisions lock

### d-20260902-01 — May a session re-record the four committed 320px/200% e2e snapshots inside the pinned Playwright container, once, as the closing step of a reviewed layout fix?

* **Question:** May a session re-record the four committed 320px/200% e2e snapshots inside the pinned Playwright container, once, as the closing step of a reviewed layout fix?
* **Governs:** f-20260829-02
* **Chosen:** (a) — lift the snapshot-update deny for one run. A session may re-record the four images inside the pinned Playwright container as the closing step of a reviewed layout fix.
* **Rejected:** (b) — Felix runs `pnpm test:e2e:update` himself after the code lands. That keeps the guard intact but makes every future visible change an interactive session, because CI would be red between the two steps.
* **Reason:** The layout contract is already settled by `d-20260831-16` and `d-20260831-17` (reflow or scroll, never silent clipping; a second assertion, not a tightened `scrollWidth` check). The parked question is who may refresh test evidence, not what a user sees. The guard's recorded reason is host rendering; the project Skip catalog forbids re-recording natively; neither reaches the container path, which `.claude/skills/verify-ui/SKILL.md` already names as the sanctioned route. Rule 4 picks (a): a reviewed layout fix must be able to land complete, including the evidence that proves it.
* **Decided by:** Grok, phase 1b of the 2026-09-02 agent-setup overhaul, under rule 22e (the Product-impact sentence cannot be written honestly) · **Superseded-by:** -

### d-20260902-02 — Should the backend coverage exporter stop measuring `#[cfg(test)]` code, accepting that the honest numbers are ~15 points lower and that 14 of 18 permanent floors must be re-derived onto the new scale?

* **Question:** Should the backend coverage exporter stop measuring `#[cfg(test)]` code, accepting that the honest numbers are ~15 points lower and that 14 of 18 permanent floors must be re-derived onto the new scale?
* **Governs:** f-20260829-04
* **Chosen:** (a) — exclude test code and re-derive. `scripts/rust-branch-coverage.mjs` gets the masking scanner, `backend-coverage-areas.json` gets the exclusion field and 18 recomputed floors, `scopeSignature` gets the field, and `backend-coverage-baselines.json` is re-recorded once, per the mechanism already specified in the finding.
* **Rejected:** (b) — keep measuring test code. That leaves the gate reporting ~66 % line coverage for a backend that is at ~50 %, with floors certifying a number that includes the tests certifying it.
* **Reason:** A coverage instrument is not what a user of En Croissant sees, gets, or is promised. Rule 4 picks the honest measurement: a gate that counts `#[cfg(test)]` modules is measuring the wrong thing, and adding a test can lower an area's ratio. `d-20260829-02` already names this finding and prescribes the re-record procedure; `d-20260829-03` already requires `scopeSignature` to carry the new field. `d-20260830-09` parked the work for that run because the baseline-writing commands sit on the deny list — that is a landing constraint for the implementing session, not a product question, and it is not reversed here.
* **Decided by:** Grok, phase 1b of the 2026-09-02 agent-setup overhaul, under rule 22e (the Product-impact sentence cannot be written honestly) · **Superseded-by:** -

## 2026-09-03 — recorded through the decisions lock

### d-20260903-01 — Does `findings.py` stay a per-repo copy behind a local-only parity gate, or is it vendored from the kit?

* **Question:** Does `findings.py` stay a per-repo copy behind a local-only parity gate, or is it vendored from the kit with `kit sync --check`?
* **Governs:** f-20260830-15
* **Chosen:** the kit vendoring with `kit sync --check`. `scripts/findings.py` is the kit's stamped copy; identity is proven byte-exact against `~/Projekte/agent-kit` by `pnpm findings:kit:check` (local-only; CI has no kit). The three-way ChessRiddle/correction-app/en-croissant parity mesh is gone.
* **Rejected:** `d-20260831-11`'s "neither" — gate stays local-only, upstream copy is not vendored. Also rejected: putting `kit sync --check` in CI (no kit on a runner, vacuous SKIP) and keeping the parity-test mesh as a second identity proof.
* **Reason:** New evidence `d-20260831-11` did not have: the shared repository it named as "the better answer if the class recurs" now exists (`~/Projekte/agent-kit`), and the three-way parity mesh was exactly the recurring class it predicted. Vendoring plus `kit sync --check` removes the divergence class instead of detecting it.
* **Decided by:** Grok, 2026-09-02 en-croissant push-review fix leaf · **Superseded-by:** -

### d-20260903-02 — How are database and puzzle install-card progress ids keyed?

* **Question:** How are database and puzzle install-card progress ids keyed, given installed local databases have no download URL?
* **Governs:** f-20260901-15
* **Chosen:** key ProgressButton and downloadFile by `db:${downloadLink}` / `puzzle_db:${downloadLink}` (same shape as `defaultEngineProgressId`). `initInstalled` stays title-based because `DatabaseInfo` / `PuzzleDatabaseInfo` have no `downloadLink` after install.
* **Rejected:** keeping the manifest array index (`db_0`). A refetch or reorder attaches another card's running or succeeded job, which is the defect. Also rejected: persisting `downloadLink` onto installed databases so installed-state can match by URL — that is a Specta/schema change and is not required to stop stale progress attachment.
* **Reason:** f-20260831-13 already moved engine cards onto `downloadLink`. Native `DatabaseInfo` has no download URL; the renderer success variant's optional `downloadLink` is not populated by `getDatabase`, so title remains the only installed-identity available without a backend change.
* **Decided by:** Grok, drain session 9faf2f9e-4311-4b1e-aa15-de0c3b7d7f79, full auto · **Superseded-by:** -

### d-20260903-03 — Where does the DatabasesPage PGN-export catch live so a test can go red if it is removed?

* **Question:** Where does the DatabasesPage PGN-export catch live so a test can go red if it is removed, without mounting the page?
* **Governs:** f-20260831-15
* **Chosen:** extract `runPgnExport` next to the other database operations in `databaseMutation.ts`, wrap `issuePgnExportDestination` + `exportToPgn` in `runUnlessCancelled`, and always clear `exportLoading` in `finally`. The page click calls that helper.
* **Rejected:** jsdom-mounting `DatabasesPage` (TanStack router, SWR, jotai, AddDatabase). Rejected: an inline try/finally with no catch, which is the filed defect. Rejected: testing a catch-free helper while the click site could still omit `runUnlessCancelled`.
* **Reason:** `d-20260831-26` already chose silent cancel plus notify on real failure via `errorUnlessCancelled`. DirectorySetting-sized coverage is the helper the click invokes, not a second copy of the catch in the JSX.
* **Decided by:** Grok, drain session 9faf2f9e-4311-4b1e-aa15-de0c3b7d7f79, full auto · **Superseded-by:** -

### d-20260903-04 — Does the blocking gateway get a re-entrancy guard, or a stated non-nesting invariant?

* **Question:** Does `BLOCKING_GATEWAY` get a thread-local re-entrancy guard that runs a nested acquisition inline, or does the codebase carry a stated invariant that no closure may acquire a second permit?
* **Governs:** f-20260830-36
* **Chosen:** No guard. The invariant is written on `BlockingGateway` itself and as a `## DO` bullet in `.claude/rules/async-resource-invariants.md`: no closure passed to the gateway may, directly or transitively, call it again; acquiring several permits in sequence from an async body is fine. Every conversion in this cluster is shaped so a source scan can prove it — the command holds the spawn, a `<name>_blocking` function holds the body, and the scan asserts no `*_blocking` function contains `BLOCKING_GATEWAY`, `block_on`, `Handle::current` or `.await`.
* **Rejected:** a thread-local depth guard that detects a nested acquisition and runs the closure inline. It would make the deadlock impossible rather than merely absent, which is genuinely the stronger property.
* **Reason:** the guard converts a design error from a hang into a silent loss of the concurrency bound, and the bound is the only thing a four-permit semaphore is for. It also had no caller: the first draft of the invariant claimed callees never touch the gateway, which is already false in this tree — `count_pgn_games_core` awaits `scan_current`, which takes a permit, and `create_workspace_file` awaits that. The real rule is about nesting, not layering, and it is mechanically checkable. Reversal path: if a call site ever genuinely needs a nested acquisition, add the guard then, with that call site as its test.
* **Decided by:** Claude Code, autonomously under `full auto`, drain session ce8785e6-944d-4f5b-b618-fe99567ea302 · **Superseded-by:** -

### d-20260903-05 — How does a command body reach `AppState` from inside a `spawn_blocking` closure?

* **Question:** How does a Tauri command body reach the parts of `AppState` it needs from inside a `'static` `spawn_blocking` closure, given that `tauri::State` is a borrow and `AppState` is not `Clone`?
* **Governs:** f-20260830-36
* **Chosen:** `AppState.pgn_path_authority` and `search_cache` become `Arc<...>`, and each closure clones only the handles it uses — the in-tree pattern already at `puzzle.rs:183-200` and `credentials.rs:324-333`. Helpers that read a single field are retyped onto that field rather than onto `AppState`: `get_db_or_create` takes `&DatabaseRepository`, `resolve_database` and `database_file_target` take `&Mutex<Option<PathAuthority>>`, and the `file_workspace.rs` `&AppState` chain follows the same rule. `Arc` derefs, so all 58 existing lock sites and every `search_cache` call compiled untouched — none was edited, which is the check that the change was done the right way round. `invalidate_search_cache` was a one-line pass-through and was deleted, inlined at its nine call sites.
* **Rejected:** a `BackendContext` bundle carrying authority, repository and search cache together. Rejected on two independent grounds found in plan review: it is an abstraction with no caller that most converted bodies do not need (one to three handles is the norm), and introducing it in its own phase makes that phase red on its own `clippy -D warnings` proof through `dead_code`. Also rejected: `block_on` inside the worker to reach `State`, which re-enters the runtime from a blocking thread and does not compile for `State<'_, _>` anyway.
* **Reason:** the bundle would have had to be threaded through helpers that read one field, which collided with the separate requirement that the 101 synchronous `db/` tests keep compiling. Cloning the individual `Arc`s is both the smaller diff and the shape the codebase already uses.
* **Decided by:** Claude Code, autonomously under `full auto`, drain session ce8785e6-944d-4f5b-b618-fe99567ea302 · **Superseded-by:** -

### d-20260903-06 — What shape does a command take when its body moves onto the blocking pool?

* **Question:** When a Tauri command's body moves onto `BLOCKING_GATEWAY`, does the gateway call go in an inline closure in the command, or in a thin wrapper over a separately named blocking function?
* **Governs:** f-20260830-37
* **Chosen:** a thin `async fn` command that clones its handles and awaits one `BLOCKING_GATEWAY.spawn` over a `<name>_blocking` function holding the old body verbatim. Where a command already forwards to a *synchronous* helper, that helper **is** the `*_blocking` function, no new symbol is created, and the command holds the spawn — `create_workspace_directory_inner`, `trash_entry`, `restore_entry`. Where the helper is `async` and must hold both the spawn and a nested await, the helper is the scanned symbol instead: `save_native_export` (the dialog must precede the permit) and `permanently_delete_entry` (`retire_executables` must follow the worker).
* **Rejected:** an inline closure in the command body, which is the existing in-tree shape at `puzzle.rs:199-214`, `pgn.rs:336-338` and `credentials.rs:330-332`, and which needs no retarget of the two `include_str!` scans that split on command names.
* **Reason:** three separate proof obligations require a scan to distinguish "inside the closure" from "outside it" — that the worker never decides a progress lease's terminal state, that a semaphore permit is moved in rather than held across the await, and that no closure acquires a second gateway permit. With an inline closure the command's body covers both sides and none of those three assertions can be written at all. The cost `review-minimalism` correctly identified — two existing scans need a named retarget — is paid once. The `*_blocking` function is not a pass-through layer: it holds the entire original body and the wrapper is the thin part.
* **Decided by:** Claude Code, autonomously under `full auto`, drain session ce8785e6-944d-4f5b-b618-fe99567ea302 · **Superseded-by:** -

### d-20260903-07 — How do the thread-local test failure injectors survive a hop onto a blocking worker?

* **Question:** The two test failure injectors are `thread_local!`; once a path runs inside `BLOCKING_GATEWAY.spawn` it executes on another OS thread and the injector stops firing. How is that fixed?
* **Governs:** f-20260830-38
* **Chosen:** keep both slots thread-local, change their payload from `Box<dyn Injector>` to `Arc<dyn Injector + Send + Sync>`, and add a `#[cfg(test)]`-only hook in `BlockingGateway::spawn` and `spawn_cancellable` that clones the calling thread's pair before `spawn_blocking` and installs it at the top of the worker, clearing it through a `Drop` guard so a panicking closure cannot leave a pooled thread armed. 40 construction sites converted mechanically. One test drives the production reader through a real `spawn` and proves the hop, because an unverified propagation is worth nothing to the phase that depends on it.
* **Rejected:** a process-wide `static Mutex<Option<Box<dyn ...>>>` behind an RAII serialisation guard. Killed by three independent facts: `static Mutex<T>` requires `T: Send`, which neither injector trait is; one shared serialisation lock deadlocks `partial_removal_wins_over_registry_reconciliation_failure`, which installs the atomic-file injector and then reaches `delete_entry_with_fault` for the removal one on a non-reentrant lock; and `inject_atomic_file` / `inject_removal` run on every atomic write and every `remove_tree_at`, so a global slot would fire inside the ~420 tests that never take the lock — `cargo test` is one process for this binary crate. Also rejected: retargeting the affected tests onto the synchronous `*_blocking` symbol, which destroys the assertion that matters — `registry_failure_after_unlink_still_retires_engine_executable` asserts `engine_supervisor.get_exact(&key).is_none()`, and retirement happens only in the async wrapper.
* **Reason:** that test is the only behavioural proof of `d-20260901-29` on the error path — a live engine holding an unlinked inode. Trading it for an invocation check on `retire_executables` would swap a behaviour test for a mock. The `#[cfg(test)]` block is the one piece of test-only plumbing accepted in production concurrency code, and it is accepted because every alternative was measured against a concrete test and found worse; it cannot affect a release build.
* **Decided by:** Claude Code, autonomously under `full auto`, drain session ce8785e6-944d-4f5b-b618-fe99567ea302 · **Superseded-by:** -

### d-20260903-08 — How is it proved that the engine image is read from the no-follow descriptor after the authority guard drops?

* **Question:** After splitting `PathAuthority::read_engine_image` so the process-wide mutex is not held across a 10 MiB read, how is it proved that the bytes still come from `resolve`'s no-follow descriptor rather than a pathname reopen?
* **Governs:** f-20260830-36
* **Chosen:** a type, not a scan. `VerifiedFile` is a newtype over `std::fs::File` in a private inner module of `path_authority.rs` with a private field and one constructor that takes the descriptor out of a `ResolvedPath`, re-exported so `pub(crate)` signatures may name it. `open_engine_image` is module-private, resolves and applies the metadata bound and cannot read; `engine_image_reader_for` owns the only lock scope and returns; `read_engine_image_bytes` consumes the newtype and reads with the guard already dropped, carrying the post-read bound. Two `const` function-pointer assertions pin arity and every type at compile time, a source scan bans this module's eight read primitives from the opener and the lock wrapper, and four behavioural tests cover exact bytes, an oversized file rejected with no descriptor produced, growth past the cap rejected and growth under the cap accepted.
* **Rejected:** eight successive versions of a pure source scan. Each was defeated by a concrete port: token bans that named primitives this module does not use while missing `.read(&mut …)`, `sha256_file` and `fs::read`; a whole-signature pin that rustfmt breaks past 100 columns; a return-type argument that a local `Vec` and a discarded read satisfy; and a privacy ban whose symbol was a string prefix of the wrapper's own name.
* **Reason:** provenance is not expressible as a substring. What remains unproved is stated rather than claimed away: inside `path_authority.rs` itself `ResolvedPath.file` is module-private, so code in that file can still substitute a descriptor before constructing a `VerifiedFile`. Closing that means relocating `ResolvedPath` and the opener into separate modules — a different change in a different area, filed rather than dropped. The hole is pre-existing and this split narrows its reach from "any caller" to "an edit inside one file".
* **Decided by:** Claude Code, autonomously under `full auto`, drain session ce8785e6-944d-4f5b-b618-fe99567ea302 · **Superseded-by:** -

### d-20260903-09 — What is this project's name, and what still stays En Croissant?

* **Question:** After the local checkout was renamed from `en-croissant` to `chessfable`, what is the project name going forward, and which En Croissant strings must stay?
* **Governs:** -
* **Chosen:** The project and brand name is ChessFable (one word). En Croissant remains only as the upstream original (`franciscoBSalgueiro/en-croissant`) and as the current GitHub remote (`felixabeck/en-croissant`). The Tauri binary, `productName`, bundle identifier `com.chessriddle.encroissant`, log and trash names, drag MIME type, `$push` remote-identity check, and GitHub repo stay unchanged until a dedicated published-app rebrand. The en-passant settings keys `ForcedEnCroissant` stay: they are a chess joke, not the product name.
* **Rejected:** Treating the folder rename as also a binary/identifier/GitHub rename in the same step. That would split Lichess credentials and the app-data directory (`d-20260830-15`, `d-20260830-16`, `d-20260830-17`), break Plasma matching (`StartupWMClass=en-croissant`), and mix a remote rename into a checkout-path fix. Also rejected: keeping En Croissant as the agent-facing project name now that the brand is chosen.
* **Reason:** Felix named the brand ChessFable and renamed the folder. Drain lock, `kit.toml` consumers, and the desktop Exec path are derived from or hardcoded to the checkout path, so they had to follow the folder. `productName` can change independently (`d-20260830-15`) but is coupled to `mainBinaryName` and the Plasma app id; that is a later cluster, now unblocked because the public name exists. Dated findings and decisions are records and are not rewritten.
* **Decided by:** Grok, from Felix in the chat, 2026-09-03 · **Superseded-by:** -

## 2026-09-04 — recorded through the decisions lock

### d-20260904-01 — Is the retirement wait a module constant, or a property of the repository?

* **Question:** `retire_and_wait` gained a 60-second bound (D-F). Its expiry test has to observe that bound. Does the test wait out the production constant, or does the wait become injectable?
* **Governs:** f-20260830-37
* **Chosen:** `DatabaseRepository` carries a `retire_wait: Duration` field, defaulting to `RETIRE_WAIT_TIMEOUT` through a hand-written `Default`, and `DatabaseEntry::retire_and_wait` takes it as a parameter from the three call sites. A `#[cfg(test)] with_retire_wait` constructor lets T-2 use 200 ms while every other test keeps the production value.
* **Rejected:** T-2 waiting out the real 60 seconds, which is what the phase originally shipped. Also rejected: a `#[cfg(test)]` override of the module constant itself.
* **Reason:** the constant-override was correctly ruled out by the implementing leaf, because a global shorter timeout reddens `active_connection_blocks_delete_until_its_lease_is_released`, which legitimately holds a lease across a delete. But that is an argument against a *global* override, not against injection. Measured: waiting out the production value took the backend suite from 12.4 s to 60.5 s — a five-fold slowdown of a gate that runs on every push and in every CI job, for one assertion. The bound is deliberately above `PRAGMA busy_timeout = 30000` and stays there in production. Reversal path: if a second test ever needs a different wait, it takes the same constructor; if the field ever drifts from the constant in production, that is a bug the `Default` impl makes visible in one place.
* **Decided by:** Claude Code, autonomously under `full auto`, drain session 0a2310ce-f1c5-4667-86ff-228aef15145c · **Superseded-by:** -

### d-20260904-02 — Does the novelty worker look up every position, or stop at the first unseen one?

* **Question:** The novelty pass moved into a blocking worker that returns a `Vec<bool>` so the order-dependent first-unseen tagging can stay on the async side. Does the worker query every fen, or stop at the first position that is absent from the reference database?
* **Governs:** f-20260830-37
* **Chosen:** the worker stops at the first absent position and returns a **prefix** of the queries. The async side indexes it with `get(i)`, so a missing index means the lookup already found a novelty and nothing after it is consulted — identical to the original loop, which queried only while `!novelty_found`. A source scan pins the `break`.
* **Rejected:** querying every fen, which is what the phase first shipped, on the reading that a `Vec<bool>` "in fens order" means one entry per fen.
* **Reason:** each `is_position_in_db` call is a full rayon scan over the whole game index, and `f-20260830-37` was filed precisely because `analyze_game` triggers one per analysed position. A novelty is typically found within the first ten to twenty plies, so looking up every fen multiplies the heaviest operation on this path several-fold — the offload would have bounded the thread while inflating the work. The plan asks for the vector so the tagging can stay async; it does not ask for every fen to be looked up. Reversal path: if the tagging ever needs to know about positions after the first novelty, the worker returns the full vector and the scan's `break` assertion goes with it.
* **Decided by:** Claude Code, autonomously under `full auto`, drain session 0a2310ce-f1c5-4667-86ff-228aef15145c · **Superseded-by:** -

### d-20260904-03 — Is the remaining `activate_download_artifact` hash fixed in this range or filed?

* **Question:** After the staged hash left `reserve_download_artifact`, `activate_download_artifact` still SHA-256s the published inode while the process-wide authority mutex is held, on a Tokio worker. Fix it in the same range, or file it?
* **Governs:** f-20260830-36
* **Chosen:** filed as a new `native-fs` finding at `build` tier under the same `blocking-work-not-offloaded` root, naming the in-tree fix shape.
* **Rejected:** splitting activate in this range the way `b345ea01` split the engine image.
* **Reason:** universal rule 4b sends a same-area finding to the current run, with one exception — a same-area *design* question goes to the handoff. This is that exception. Activate's hash is a verification of the published inode against the journalled digest, and its ordering relative to the post-rename identity marker is what closes the swap window; deciding where the guard may be dropped without opening a TOCTOU gap is the same question that took thirteen rounds of plan review for the engine image, and `S-5` currently pins activate's `sha256_open_file` in place, so that assertion has to move with the split. Note what is *not* the reason: the plan rules activate out of scope (approach point 5) only for the caller-supplied-digest question, which three lenses rejected as tautological. The offload question was never asked, and this record is what stops the next session reading "activate is out of scope" as covering both. Reversal path: the finding carries the fix shape, so a later `build` run starts from it rather than re-deriving.
* **Decided by:** Claude Code, autonomously under `full auto`, drain session 0a2310ce-f1c5-4667-86ff-228aef15145c · **Superseded-by:** -

### d-20260904-04 — Does `list_puzzle_databases` resolve its workspace inside the worker or outside?

* **Question:** The phase-3b split puts `list_puzzle_children` in a gateway closure and keeps the per-file `puzzle_database_info_for_file` loop async, because that callee takes a permit of its own. Where does `active_or_default_puzzle_workspace` go?
* **Governs:** f-20260830-37
* **Chosen:** inside the worker, together with `list_puzzle_children`, under one permit and one `*_blocking` function.
* **Rejected:** the literal reading of the plan, which names only `list_puzzle_children` for the closure.
* **Reason:** `active_or_default_puzzle_workspace` does a `create_dir_all` and takes the authority lock. Left on the async side it would keep exactly the work this phase removes on a Tokio worker. It is synchronous and runs sequentially before `list_puzzle_children`, so the two share one permit rather than nesting — legal under the non-nesting invariant (`d-20260903-04`) — and D-H asks for one spawn over one `*_blocking` body rather than two sequential gateway calls. The nested await that would actually deadlock, `puzzle_database_info_for_file`, stays async and is what S-9 pins. Reversal path: none needed; if that helper ever gains a gateway acquisition of its own it must leave the closure, which S-8 would force.
* **Decided by:** Claude Code, autonomously under `full auto`, drain session 0a2310ce-f1c5-4667-86ff-228aef15145c · **Superseded-by:** -

### d-20260904-05 — What shape does the typed IPC error payload take on the wire?

* **Question:** What shape does the typed IPC error payload take on the wire?
* **Governs:** f-20260830-08
* **Chosen:** `ErrorPayload { tag, category, message }`. `category` is a 19-value `ErrorCategory`
  enum promoted from the private `Error::category()` that already classified every variant
  exhaustively; `message` is the variant's `Display`.
* **Rejected:** category alone — `Game not found: {0}`, `Invalid input: {0}`, `Conflict: {0}` and
  `Resource limit: {0}` carry the only actionable detail the user gets, and ~30 `notifyError` call
  sites render `message`. Also rejected: a tagged union mirroring all 40 variants — nothing in the
  renderer consumes `PartialRemoval.removed_entries` or `OperationAndCleanup`'s two strings, the
  latter deliberately omits both from `Display` and is tested doing so, and a 40-arm union makes
  every renderer `switch` a maintenance surface for distinctions the UI never draws.
* **Reason:** category is the axis the renderer actually branches on, and it was the one thing
  the substring table was trying to reconstruct.
* **Decided by:** Claude Code, autonomously under `full auto` while Felix was away · **Superseded-by:** -


### d-20260904-06 — Does the backend emit the renderer's seven categories, or its own richer set?

* **Question:** Does the backend emit the renderer's seven categories, or its own richer set?
* **Governs:** f-20260830-08
* **Chosen:** its own 19; `src/platform/errors.ts` holds one exhaustive
  `Record<ErrorCategory, AppErrorCategory>` mapping them onto the existing seven.
* **Rejected:** emitting the seven renderer categories from `error.rs` directly.
* **Reason:** that puts a UI taxonomy in the backend and discards the distinction the mapping is
  the only record of. The two-level shape closes the loop at compile time in both languages: a new
  `Error` variant fails `cargo check` on the exhaustive match, a new `ErrorCategory` fails
  `tsgo --noEmit` on a missing `Record` key. `AppErrorCategory` deliberately stays at seven values
  because `ConfirmModal.tsx:16` interpolates each into `Common.ConfirmationError.${category}`, so
  an eighth is a missing locale key (`f-20260830-11`).
* **Decided by:** Claude Code, autonomously under `full auto` while Felix was away · **Superseded-by:** -


### d-20260904-07 — How is an `ErrorPayload` told apart from the renderer's own `AppError`?

* **Question:** How is an `ErrorPayload` told apart from the renderer's own `AppError`?
* **Governs:** f-20260830-08
* **Chosen:** a constant `tag: "backend-error"` field on the wire. `isErrorPayload` tests it, runs
  before `isAppError`, and cannot match an `AppError`.
* **Rejected:** a membership test on the mapping table's keys, which was the first design.
  `AppError` and `ErrorPayload` are the same JSON shape and the vocabularies overlap on `network`
  and `permission`, so **no ordering of a structural guard is correct**: first, it swallows a
  genuine already-normalised `AppError` carrying those two and breaks `normalizeError`'s
  return-by-identity contract; second, a live command payload skips both the mapping and
  `redact()` and is only accidentally right while those mappings are the identity. Also rejected:
  renaming the backend categories so they never collide — it works today and breaks silently the
  first time either vocabulary grows.
* **Reason:** an exact discriminant costs one constant string per payload and removes the whole
  class. The earlier rejection of a discriminant rested on that cost alone, which universal rule 4
  does not admit as grounds against a known-better design.
* **Decided by:** Claude Code, autonomously under `full auto` while Felix was away · **Superseded-by:** -


### d-20260904-08 — Is the dropped native diagnostic logged when a variant stops being transparent?

* **Question:** Is the dropped native diagnostic logged when a variant stops being transparent?
* **Governs:** f-20260830-08
* **Chosen:** no. The six newly-opaque variants (`Io`, `Zip`, `Tauri`, `TauriOpener`, `Diesel`,
  `R2d2`) keep their cause on `#[source]`, and `impl Serialize for Error` has no side effects.
* **Rejected:** a `log::warn!` of the `source()` chain from `Serialize`, which was the first
  design and looked right because `Serialize` is exactly the IPC boundary. It would have delivered
  the absolute path, SQL fragment or connection string to the renderer anyway:
  `src-tauri/src/main.rs:1615` configures `tauri-plugin-log` with
  `[TargetKind::Stdout, TargetKind::Webview]` in debug builds at `LevelFilter::Info`, and
  `src/App.tsx:89` calls `attachConsole()`. Also rejected: `log::debug!`, which the global
  `Info` filter drops entirely — not a safer log, no log. Also rejected: changing `main.rs`'s log
  targets, which is a different file set and a decision about the whole logging configuration.
* **Reason:** the leak this closes must not be reopened through a second channel. The cost is
  stated rather than hidden: the native cause of an `Io`/`Diesel`/`Zip`/`Tauri`/`R2d2` failure is
  now reachable from Rust but written to no log by default, where it used to be visible (redacted)
  in the renderer notification. The webview log target is filed as its own finding.
* **Decided by:** Claude Code, autonomously under `full auto` while Felix was away · **Superseded-by:** -


### d-20260904-09 — Does the renderer's substring table survive?

* **Question:** Does the renderer's substring table survive?
* **Governs:** f-20260830-08
* **Chosen:** yes, unchanged, with its comment rewritten to say what it now is: the fallback for
  errors that are not backend command errors — a thrown JS `Error`, a `useTauriListener` callback
  failure, `close_splashscreen`'s genuine `Result<(), String>`, and any non-command rejection. No
  branch deleted, including the two owned literals `partially removed:` and
  `committed but durability uncertain:` that `d-20260830-05` and `d-20260831-01` pinned.
  `errorUnlessCancelled` still keys on the exact message `Cancellation` rather than on the
  category, because `Analysis cancelled` shares that category and must stay visible
  (`f-20260830-28`).
* **Rejected:** deleting it once commands were typed.
* **Reason:** it still has four live inputs, and the two literal branches are what the fallback
  path needs to keep classifying a durability failure correctly.
* **Decided by:** Claude Code, autonomously under `full auto` while Felix was away · **Superseded-by:** -


### d-20260904-10 — How does the puzzle-themes check survive `Error::Diesel` becoming opaque?

* **Question:** How does the puzzle-themes check survive `Error::Diesel` becoming opaque?
* **Governs:** f-20260830-08
* **Chosen:** a typed `Error::PuzzleThemesUnavailable` with its own `ErrorCategory`, produced by an
  extracted `load_puzzle_themes` that matches the raw `diesel::result::Error` **before** `?`
  converts it and is scoped to the `themes` query alone. `AppError` gains an optional
  `backendCategory`, and `Puzzles.tsx` branches on that.
* **Rejected:** leaving `Diesel` transparent so `error.message.includes("no such table")` keeps
  working — it is the single largest leak in the set, carrying table names, column names,
  constraints and SQL fragments. Also rejected: mapping the new variant onto the existing
  `Database` category, which would show "your puzzle database is outdated" for every database
  failure. Also rejected: branching on `AppError.category`, which is `not-found` and shared with
  `missing-resource`, so `NoPuzzles` or a missing file would trigger the alert. Also rejected:
  putting the substring match in `From<diesel::result::Error>`, which would relabel every missing
  table in the application.
* **Reason:** this diff would otherwise have silently deleted a localised user-facing warning
  with every gate green, since nothing covered `themesTableMissing`. That is the red gate, not a
  finding to defer. Four tests now redden for the four distinct wrong implementations.
* **Decided by:** Claude Code, autonomously under `full auto` while Felix was away · **Superseded-by:** -


### d-20260904-11 — Where does `errors.ts` import the generated error types from?

* **Question:** Where does `errors.ts` import the generated error types from?
* **Governs:** f-20260830-08
* **Chosen:** `@/bindings`, the type barrel, whose own comment says renderer callers may import
  generated types there and never command or event values.
* **Rejected:** a `export type { ErrorCategory, ErrorPayload }` re-export added to
  `src/platform/tauri.ts`. That was the first fix when `tauri:boundary:check` rejected a direct
  `@/bindings/generated` import — correct about the constraint (`d-20260831-32` keeps that module
  illegal outside the facade, and the checker does not exempt type-only imports) and wrong about
  the seam, since the barrel already existed and every other consumer uses it.
* **Reason:** a pass-through with one caller is an abstraction without a second consumer.
* **Decided by:** Claude Code, autonomously under `full auto` while Felix was away · **Superseded-by:** -


### d-20260904-12 — Does `Error::Io` categorise on `ErrorKind`?

* **Question:** Does `Error::Io` categorise on `ErrorKind`?
* **Governs:** f-20260830-08
* **Chosen:** yes, narrowly: `NotFound` → `MissingResource`, `PermissionDenied` → `Permission`,
  everything else → `Io`.
* **Rejected:** one flat `Io` category; and a wider `ErrorKind` map.
* **Reason:** this is the concrete payoff of typing. An `ENOENT` used to reach the renderer as
  `"No such file or directory (os error 2)"`, which matches no branch of the substring table and
  landed in `unexpected`. Only these two kinds, because they are the two the renderer already has
  categories for — a wider map would invent distinctions no consumer makes.
* **Decided by:** Claude Code, autonomously under `full auto` while Felix was away · **Superseded-by:** -


### d-20260904-13 — Was the `bindings-ipc` cluster worked whole or sliced?

* **Question:** Was the `bindings-ipc` cluster worked whole or sliced?
* **Governs:** f-20260830-08, f-20260901-04, f-20260901-08, f-20260904-02
* **Chosen:** sliced. This run worked the pinned `f-20260830-08` alone, through `build`.
* **Rejected:** one `build` over all four cluster members.
* **Reason:** all four carry `Root: -`, so no evidenced common cause binds them, and the file sets
  are disjoint: `f-20260830-08` is `error.rs` plus the wholesale regeneration of
  `generated.ts`, while the other three are the progress-broadcast discriminator
  (`useProgress.ts`, `ReportModal`/`ReportPanel`, `Databases.tsx`, `useConversionProgress.ts`).
  Rule 4a cuts by area cohesion; one plan carrying two independent design questions would have
  made the review arbitrate both at once over an unreviewable diff. Precedent: `d-20260827-07`
  (an area is a vocabulary bucket, not a file set), `d-20260827-11`, `d-20260828-19`,
  `d-20260831-01`. The other three remain open at their filed tiers.
* **Decided by:** Claude Code, autonomously under `full auto` while Felix was away · **Superseded-by:** -

### d-20260904-14 — Is `DatabaseProgress` deleted, or kept and given an id the renderer filters on?

* **Question:** Is `DatabaseProgress` deleted, or kept and given an id the renderer filters on?
* **Governs:** f-20260901-04
* **Chosen:** deleted. `get_players_game_info` takes a renderer-minted `progress_id` and reports
  through the one `ProgressEvent` registry, mirroring `search_position`'s guard-on-the-async-frame
  shape.
* **Rejected:** keeping the event and passing it a better id.
* **Reason:** `DatabaseProgress` was a bare `{ id, progress }` percentage — exactly what
  `ProgressEvent` already is, minus the generation lease, the terminal state, the bounded retention
  and the stale-producer rejection. `.claude/rules/ipc-events.md` forbids a second progress channel
  in as many words ("There is one ProgressEvent"), and keeping it would have preserved a percentage
  channel with none of those guarantees. Deleting it also gave the command a terminal state for the
  first time: `p` counts only kept rows, so the last frame was at most `((n-1)/n)*100`, and an
  empty or fully filtered result emitted nothing at all.
* **Decided by:** Claude Code, autonomously under `full auto` while Felix was away · **Superseded-by:** -

### d-20260904-15 — Is `ConvertProgress` also folded into `ProgressEvent`, or kept as its own event?

* **Question:** Is `ConvertProgress` also folded into `ProgressEvent`, or kept as its own event?
* **Governs:** f-20260901-04
* **Chosen:** kept as its own event, given an `id`, and deliberately NOT given a progress lease.
* **Rejected:** (a) adding optional counter fields to `ProgressEvent`; (b) taking a
  `begin_progress` lease around `convert_pgn` in addition to the counters.
* **Reason:** a PGN conversion has no total to divide by, so it reports counters
  (`imported_games`, `elapsed_ms`, `source_file_name`) and not a percentage — it is a domain detail
  channel, not a competing progress mechanism, which is what `ipc-events.md` actually forbids.
  Folding the counters into the shared event would put two nullable fields on every one of its
  consumers to serve one producer. A second lease has no consumer either: the terminal state of a
  conversion is already owned by the routes' own teardown paths. What the rule does require of a
  global broadcast — an id the receiver filters on — is what was added.
* **Decided by:** Claude Code, autonomously under `full auto` while Felix was away · **Superseded-by:** -

### d-20260904-16 — How is each progress id minted: deterministically from the resource, or per call?

* **Question:** How is each progress id minted: deterministically from the resource, or per call?
* **Governs:** f-20260901-04
* **Chosen:** both, and the split is deliberate. `get_players_game_info` uses a per-call
  `crypto.randomUUID()` held in a module-scoped map keyed like the SWR fetch; `convert_pgn` uses a
  deterministic `conversionProgressId(handle)` projecting through `databaseHandleKey`.
* **Rejected:** one scheme for both — a deterministic id everywhere, or a UUID everywhere.
* **Reason:** the constraint differs. For the home card the id must be known to the component that
  filters, and the player-row id only exists after `query_players` resolves *inside* the SWR
  fetcher, so a component computing its owned set in render would have an empty set for exactly as
  long as the bar is visible; a database-handle-only id would instead re-admit a concurrently
  mounted `PlayerCard`'s frames, which is the original defect. For conversions the identity is
  known before the call — all three routes write the target handle into the atom first — so a
  deterministic id needs no plumbing and a UUID would need a second field carrying an identity the
  atom already holds. Note `conversionProgressId` must project through `databaseHandleKey`:
  `DatabaseHandle` is an object, and interpolating it yields `conversion:[object Object]` for every
  import.
* **Decided by:** Claude Code, autonomously under `full auto` while Felix was away · **Superseded-by:** -

### d-20260904-17 — Where does the analysis report's operation id live?

* **Question:** Where does the analysis report's operation id live?
* **Governs:** f-20260901-08, f-20260904-02
* **Chosen:** on the per-tab zustand tree's `report` slice, persisted through `tabStorage`
  alongside `report.inProgress`, with `isCurrentOperation` reading the LIVE store.
* **Rejected:** (a) `useState` or the existing `useRef` in `ReportPanel`; (b) making the backend
  emit the per-tab id `report_${activeTab}` instead.
* **Reason:** `BoardsPage` and `AnalysisPanel` are both `keepMounted={false}`, so `ReportPanel`
  unmounts whenever the user leaves the board tab or the Report sub-tab — a ref or local state
  dies with it, which is exactly the pre-existing defect where a returning panel has
  `inProgress: true` rehydrated from sessionStorage and a null id, so Cancel silently does
  nothing. Emitting the per-tab id instead would lose the ability to distinguish two reports on
  one tab. Two consequences are load-bearing and were nearly missed: the persisted Zod schema
  (`tabStorage.ts`) strips unknown keys, so without schema plus `migrateTreeForStorage` coercion
  the whole change is a no-op after the first tab switch — while making the field *required*
  instead makes `parseTree` return null and discards every open game; and `isCurrentOperation`
  must read `store.getState()` rather than a render snapshot, because `ReportModal.analyze()`
  captures the callback at submit time and zustand `set` does not update a closed-over value, so
  the naive translation leaves the guard permanently false and `addAnalysis` never fires.
* **Decided by:** Claude Code, autonomously under `full auto` while Felix was away · **Superseded-by:** -

### d-20260904-18 — Which teardowns may clear `databaseConversionStateAtom`?

* **Question:** Which teardowns may clear `databaseConversionStateAtom`?
* **Governs:** f-20260901-04
* **Chosen:** only a teardown that owns a `DatabaseHandle`, comparing with `sameDatabaseHandle`.
  The two that cannot — `DatabasesPage`'s `setLoading` bridge and `AccountCard`'s `onClick`
  `finally` — stop writing that atom entirely, and `AccountCard`'s compare-and-clear moves inside
  `convert()`.
* **Rejected:** (a) leaving all four teardowns unconditional; (b) making all four
  compare-and-clear.
* **Reason:** the filter added for `ConvertProgress` keys on `targetDatabase`, so any route that
  nulls that field while another import is running kills the survivor's discriminator and the live
  counter dies silently — the `convert_progress` incident in `ipc-events.md` again. (b) is not
  implementable: the `setLoading` bridge is a `Dispatch<SetStateAction<boolean>>` with no handle in
  scope and runs *before* the handle-owning `finally`, so comparing `previous.targetDatabase` with
  itself is a tautology that always clears; and `AccountCard`'s `onClick` never receives the handle
  because `convert()` rethrows on a `convertPgn` failure, so a `finally` there would leave a failed
  first-time download showing a perpetual converting loader with the Add control disabled.
  Removing the `setLoading` bridge also required `AddDatabase` to raise `inProgress` itself before
  converting, because that bridge was what set the flag synchronously on submit; without it a
  double-submit window opens until `onCreated` fires.
* **Decided by:** Claude Code, autonomously under `full auto` while Felix was away · **Superseded-by:** -

### d-20260904-19 — Is `SearchProgress` extracted for the second caller, and with what surface?

* **Question:** Is `SearchProgress` extracted for the second caller, and with what surface?
* **Governs:** f-20260901-04
* **Chosen:** extracted to `src-tauri/src/progress.rs` as a public runtime-generic `JobProgress`
  (`new`, `lease`, `complete`, private `transition`, `Drop`), with `search.rs` routed through it in
  the same change, and both blocking helpers made generic over `R: tauri::Runtime`.
* **Rejected:** (a) a second hand-written guard in `db/mod.rs`; (b) a bare rename, keeping the
  struct and its `lease` field private; (c) keeping a `report(processed, total)` convenience method
  and a second percent helper.
* **Reason:** the guard gets three things right that a copy would not — `app.state::<AppState>()`
  because the blocking frame has no `tauri::State`, `let _ =` on every transition so a superseded
  lease can neither abort the job nor mask the real error with a `Conflict`, and `Drop` →
  `Cancelled` so an early return cannot strand an entry `Running` for the full hour TTL. (b) does
  not compile: `search_position` reads the private `lease` field directly. (c) leaves dead code —
  this is a binary crate, so `pub` does not suppress `dead_code`, and the only callers were tests;
  those now report the way production does. Two traps are worth recording: `JobProgress` must never
  be constructed inside the blocking closure, because its `Drop` would write `Cancelled` before the
  wrapper's `complete(Succeeded)` and terminal state is sticky; and the generic signatures break
  four `body_at_indent` needles in `main.rs`, which panics on a missing needle rather than missing
  softly.
* **Decided by:** Claude Code, autonomously under `full auto` while Felix was away · **Superseded-by:** -

### d-20260904-20 — How does the report button avoid claiming a completed report whose result was dropped?

* **Question:** How does the report button avoid claiming a completed report whose result was dropped?
* **Governs:** f-20260901-08, f-20260904-02
* **Chosen:** `completeOnProgressSuccess={false}` on the report's `ProgressButton`, and
  `ReportPanel` subscribes with `useProgress` itself to clear `inProgress` (keeping the id) when
  the item is finished.
* **Rejected:** (a) leaving `completeOnProgressSuccess` at its default `true`; (b) splitting the
  prop into two inside `ProgressButton`.
* **Reason:** `analyzeGame`'s `Vec<MoveAnalysis>` is delivered only to the `ReportModal` instance
  that started it, and `keepMounted={false}` destroys that instance, so a report finishing while
  the panel is closed is silently discarded. Making the bar work without (a) would newly render
  "Report generated" for a game the tree never received — a *worse* lie than the broken bar. But
  that one prop couples two behaviours in `ProgressButton`: the completed label, and the effect
  that clears `inProgress` when the item is finished. Switching it off alone would leave a
  remounted panel stuck on "Generating Report" at 100% for a process that has already exited, so
  the panel takes over the clearing. (b) was rejected because it would add an option to a shared
  component for one of four callers. The underlying result-drop is filed separately; when it is
  fixed, this prop should be reconsidered.
* **Decided by:** Claude Code, autonomously under `full auto` while Felix was away · **Superseded-by:** -

### d-20260904-21 — Does the renderer take a progress lease up front to close `analyze_game`'s pre-lease window?

* **Question:** Does the renderer take a progress lease up front to close `analyze_game`'s pre-lease window?
* **Governs:** f-20260901-08, f-20260904-02
* **Chosen:** no. `ReportModal` calls no `startProgress`, and the mount reconcile in `ReportPanel`
  clears only on a *finished* item — an absent entry and a rejected lookup both leave state alone.
  The arm that does clear is `inProgress: true` with no `operationId`.
* **Rejected:** calling `tauri.startProgress(operationId)` after `registerOperation` and before
  `analyzeGame`, so the registry entry would exist from registration and "absent" could safely
  mean "not running". This was specified in an intermediate draft of the plan and removed.
* **Reason:** `start_progress` *is* `begin_progress`, and `ProgressStore::start` deliberately
  invalidates the former producer (`progress.rs`, "Starting the same ID deliberately invalidates
  its former producer"). `ReportModal.analyze()` is a synchronous function, so the call is
  fire-and-forget: whenever it settles *after* `analyze_game` has taken its own lease, the
  backend's producer is the one invalidated and every subsequent frame is refused — the bar dies
  permanently, which is worse than the defect being fixed. It would also strand a `Running` entry
  for the full one-hour TTL whenever `analyzeGame` rejects before taking its lease. The stale-state
  case the absent-arm was meant to catch is narrower than it looks: the tree persists to
  sessionStorage, which a genuine application restart clears along with the backend's progress
  store, so "in progress with a live backend and no entry" is essentially only the pre-lease race.
* **Decided by:** Claude Code, autonomously under `full auto` while Felix was away · **Superseded-by:** -

### d-20260904-22 — Was the `bindings-ipc` cluster sliced again on 2026-09-04?

* **Question:** Was the `bindings-ipc` cluster sliced again on 2026-09-04?
* **Governs:** f-20260901-04, f-20260901-08, f-20260904-02, f-20260904-07, f-20260904-08
* **Chosen:** sliced. This run worked `{f-20260901-04, f-20260901-08, f-20260904-02}` together
  through `build`, and left `f-20260904-07` (`lens`) and `f-20260904-08` (`inline`) open at their
  filed tiers.
* **Rejected:** one `build` over all five remaining members.
* **Reason:** the three worked together are one design question — what a progress id identifies and
  how the renderer filters on it — over one file set (`db/mod.rs`, `progress.rs`, the progress
  hooks, `Databases.tsx`, the analysis panel). `f-20260901-08` and `f-20260904-02` turned out to be
  the *same* defect filed twice by two lens runs four days apart, and both are closed by the same
  change. The other two are disjoint: `f-20260904-07` is the debug-build webview log target in
  `main.rs` bootstrap and `f-20260904-08` is `close_splashscreen`'s signature, neither of which
  shares a design question with progress discriminators. This follows `d-20260904-13`, which
  settled that this cluster is worked sliced rather than whole, and rule 4a's cut by area cohesion.
* **Decided by:** Claude Code, autonomously under `full auto` while Felix was away · **Superseded-by:** -

### d-20260904-23 — Work the whole pinned native-fs Root-`-` cluster, or slice by file set?

* **Question:** `next --pin f-20260901-01` grouped four Root-`-` `native-fs` findings (f-20260901-01, f-20260903-02, f-20260903-03, f-20260904-06). Does one `build` take all four, or does the run slice by cohesive file set?
* **Governs:** f-20260901-01, f-20260903-02, f-20260903-03, f-20260904-06
* **Chosen:** slice to **f-20260901-01 + f-20260903-03** at `build` tier. Left open at their filed `build` tier: f-20260903-02 and f-20260904-06, which are the `infra/path_authority.rs`-internal module split.
* **Rejected:** taking all four through one `build` because `next` grouped them — a ledger area is a vocabulary bucket, not a cohesive file set (`d-20260827-07`, `d-20260901-01`, `d-20260901-04`). Also rejected: slicing f-20260901-01 alone and leaving f-20260903-03 for a later run.
* **Reason:** f-20260901-01's `puzzle.rs` production reach is `std::fs::create_dir_all` at `puzzle.rs:271`, which sits **inside `active_or_default_puzzle_workspace`** — the exact function f-20260903-03 needs generic over `R: tauri::Runtime` in order to be unit-testable at all. Migrating that call through `PathAuthority` and genericising the function that contains it are one edit to one function; splitting them would mean touching the same lines twice and re-running the same lens. They are one slice by file set, not two.
  f-20260903-02 and f-20260904-06 are a different file set entirely: relocating `ResolvedPath` and the engine-image opener into separate modules **inside** `path_authority.rs`, so the module that mints a `VerifiedFile` cannot mutate a `ResolvedPath`. That is a module-boundary change to a 6000-line security-critical file with its own open question (`d-20260903-08` states what it leaves unproved). f-20260901-01 *adds* callers to `PathAuthority`'s public surface; it does not depend on how that file's private modules are arranged, and neither ordering blocks the other.
  f-20260903-03's filed sequencing dependency — "do it together with phase 3b of `tasks/plans/2026-09-03-blocking-work-not-offloaded.md`" — is **already cleared**: phase 3b landed in `c5362e0d`, so the puzzle-workspace commands are converted and this run is not racing that plan.
* **Decided by:** Claude Code, autonomously under `full auto`, drain session 1b627d32-2f37-4a08-81cc-cc8756b994c6 · **Superseded-by:** -

## 2026-09-05 — recorded through the decisions lock

### d-20260905-01 — Does `f-20260901-01` get emptied in this run, or shrunk with the residue filed?

* **Question:** `f-20260901-01` asks to empty `INITIAL_FS_SURFACE_ALLOWLIST`. Does this run empty it, or shrink it and file the residue?
* **Governs:** f-20260901-01, f-20260905-02, f-20260905-03, f-20260905-04, f-20260905-05, f-20260905-06, f-20260905-07
* **Chosen:** shrink — 37 counted sites to 30, nine allowlisted files to seven — and file the remaining 30 as **six** design questions across three areas, each build-tier in its own right (`f-20260905-02` credentials bootstrap, `f-20260905-03` repository re-keying, `f-20260905-04` `.ecsi` provenance, `f-20260905-05` directory enumeration, `f-20260905-06` temp-to-temp install, `f-20260905-07` the backend-chosen-destination token). `f-20260901-01` closes as `handled` naming all six, so its closure cannot read as "the convention is now true".
* **Rejected:** emptying the allowlist in this run. Also rejected: closing `f-20260901-01` with a single "the rest is future work" note instead of six filed entries.
* **Reason:** the 37 sites are three classes, and only one is workable without opening a new design question. Five are app-owned default root directories (four taken here, one — `credentials` — deferred because it runs before `PathAuthority::open`); three are production-dead surface in `db/search_index.rs`; the other 30 each need a decision this run is not the place to take. Emptying would have meant taking six unrelated design questions inside one run, against rule 4a's cut by area cohesion. Filing them as six entries rather than one impossible one is what makes the queue carry tractable units — the same reason `f-20260901-01` itself is being closed rather than left open at 30 sites, since an entry nobody can pick is not a queue item.
* **Decided by:** Claude Code, autonomously under `full auto`, resumed drain session 7a8afddc-2492-4bf6-bd58-751b8e5f28ee · **Superseded-by:** -

### d-20260905-02 — What shape owns the app-owned default root directories?

* **Question:** Four call sites take `app_data_dir()`, join a compile-time leaf and `create_dir_all` it. What shape replaces them without turning `infra/`'s gate blind spot into a loophole?
* **Governs:** f-20260901-01, f-20260905-07
* **Chosen:** one free function `ensure_app_owned_default_dir(app_data_dir: &Path, root: AppOwnedDefaultRoot) -> Result<PathBuf, Error>` over a **closed** enum whose four variants carry fixed leaves (`db`, `engines`, `engine-images`, `puzzles`), refusing a symlinked or non-directory leaf, with the refusal built as `io::Error` so it reaches the renderer as `Error::Io`.
* **Rejected:** (a) three `get_or_create_default_*_root(&mut self, path: &Path)` methods on `PathAuthority` — the first draft, which gave create-if-missing semantics to an arbitrary caller-supplied path inside the gate's blind spot, and grew a near-identical per-root family from three to six; (b) a pure relocation, `pub fn make_dir(path: &Path)` in `infra/`, called from `main.rs`; (c) `Error::InvalidInput` for the refusal, to match the surrounding file's idiom.
* **Reason:** `isInfraPath` makes `src-tauri/src/infra/**` invisible to `check-rust-release-surface.mjs`, so any of these empties four allowlist slots. Only the closed enum makes that honest: **the signature carries the app-owned property, and the callers do not.** A function that cannot express an arbitrary path cannot be the vehicle by which a user-picked path acquires create-if-missing semantics, so the gate losing sight of it costs nothing it was actually guarding. (b) fails exactly that test. (c) fails a different one: `Error::InvalidInput` renders its `String` **verbatim** (`error.rs:210-211`) and would put a native app-data path on the IPC wire, where `Error::Io` renders fixed text and still carries the MissingResource / Permission / Io discrimination (`error.rs:250-253`).
* **Decided by:** Claude Code, autonomously under `full auto`, resumed drain session 7a8afddc-2492-4bf6-bd58-751b8e5f28ee · **Superseded-by:** -

### d-20260905-03 — Are the three `get_or_create_*_root` methods made create-if-missing?

* **Question:** The default call sites need their directory to exist. Is that satisfied by making `get_or_create_database_root` / `_puzzle_root` / `_engine_root` create it, rather than by a separate materialiser?
* **Governs:** f-20260901-01, f-20260905-01
* **Chosen:** no. The three methods keep refusing an absent directory, and each now has a regression test asserting **both** that the call errors and that the directory is still absent afterwards.
* **Rejected:** create-if-missing on the three methods, which would have removed the need for `ensure_app_owned_default_dir` entirely.
* **Reason:** those three methods serve the **dialog** callers, where the path came from the user. An absent user-picked folder means the disk changed under the user, and the correct answer is an error, not a silently recreated empty root that then registers as their database library. The default and dialog paths look alike and are not, so the separation is the point of the change rather than an artefact of it. One test per method, because with only one covered the other two could be quietly converted later. The cost of keeping the separation is recorded honestly as `f-20260905-01`: a deleted **default** root is now a permanent dead end, and that is a real defect this run chose to carry forward rather than fix by weakening the dialog contract.
* **Decided by:** Claude Code, autonomously under `full auto`, resumed drain session 7a8afddc-2492-4bf6-bd58-751b8e5f28ee · **Superseded-by:** -

### d-20260905-04 — Does `f-20260903-03`'s filed fix shape survive contact with the code?

* **Question:** `f-20260903-03` filed a fix shape: genericise **four** symbols over `R: tauri::Runtime` and unit-test against `mock_app()` and a temp-dir `PathAuthority` using "the fixtures already exist in that file's test module". Is that what was implemented?
* **Governs:** f-20260903-03
* **Chosen:** two deviations, both taken deliberately. (1) **Three** symbols are genericised, not four: `active_or_default_puzzle_workspace`, `issue_puzzle_download_destination_blocking` and `list_puzzle_databases_blocking`. `resolve_puzzle` is not, because nothing on the tested path reaches it and genericising it would have been an unused type parameter. (2) The test module had **no** such fixtures — no `mock_app()`, no `AppState`, no authority `Mutex` — so all of it is new, built on `PathAuthority::open(dir/registry.json, vec![])`, the pattern that file's test module already uses three times.
* **Rejected:** genericising `resolve_puzzle` for symmetry with the filed shape. Also rejected: reusing the `authority(…)` helper at `path_authority.rs`'s test module — it is a private `fn` inside a private `#[cfg(test)] mod tests` whose `Arc<TestClock>` parameter type is module-private too, so `puzzle.rs` can name neither.
* **Reason:** a filed fix shape is a hypothesis from the run that found the defect, not a specification; deviating is fine, deviating silently is not. Recorded because a later reader comparing the finding to the diff would otherwise count two discrepancies and have to re-derive both.
* **Decided by:** Claude Code, autonomously under `full auto`, resumed drain session 7a8afddc-2492-4bf6-bd58-751b8e5f28ee · **Superseded-by:** -

### d-20260905-05 — Does the run stop at `ensure_app_owned_default_dir`, or also unify the outermost triplicated workspace bodies?

* **Question:** After the sub-layers are consolidated, the shape "lock the authority, early-return on `active_*_root()`, materialise, `get_or_create_*_root`, `set_active_*_root`" still exists three times. Does this run dissolve that too?
* **Governs:** f-20260901-01
* **Chosen:** no. Two layers underneath it are consolidated — `get_or_create_root` (phase 2a) and `ensure_app_owned_default_dir` (phase 2) — and the run stops there.
* **Rejected:** a trait or generic over `DatabaseRootHandle` / `EngineRootHandle` / `PuzzleRootDescriptor` unifying the outermost bodies, which universal rule 11 would otherwise reach for at the third copy.
* **Reason:** the three handle types are genuinely different types with different downstream contracts, so unifying the outer layer means introducing an abstraction over them — a design move, not an extraction, and one this run has no finding for. Rule 11 extracts a second copy of the same concept; it does not mandate inventing a trait to make three different concepts look alike. Recorded so the remaining triplication reads as a stated boundary rather than an oversight.
* **Decided by:** Claude Code, autonomously under `full auto`, resumed drain session 7a8afddc-2492-4bf6-bd58-751b8e5f28ee · **Superseded-by:** -

### d-20260905-06 — Work the whole six-member native-fs `build` cluster, or slice by file set?

* **Question:** `findings.py next` grouped six Root-`-` `native-fs` findings (f-20260903-02, f-20260904-06, f-20260905-01, f-20260905-05, f-20260905-06, f-20260905-07) into one `entry=build` cluster. Does one `build` take all six, or does this run slice by cohesive file set?
* **Governs:** f-20260903-02, f-20260904-06, f-20260905-01, f-20260905-05, f-20260905-06, f-20260905-07
* **Chosen:** slice to **f-20260905-07** at its filed `build` tier — the ten backend-chosen-destination reaches plus the live engine-image symlink window. Left open at their filed `build` tier: f-20260903-02 + f-20260904-06 (one defect, two entries — the `path_authority.rs`-internal module split), f-20260905-01 (deleted default root is a dead end), f-20260905-05 (directory-enumeration capability), f-20260905-06 (temp-to-temp `atomic_install_dir`).
* **Rejected:** taking all six through one `build` because `next` grouped them — a ledger area is a vocabulary bucket, not a cohesive file set (`d-20260827-07`, `d-20260901-04`, `d-20260904-23`). Also rejected: starting with f-20260903-02 + f-20260904-06 because it is the smaller and better-specified unit; size is never the ordering criterion under rule 4a. Also rejected: pairing f-20260905-06 with f-20260905-07 because both touch `fs.rs` — 06 is a question about what the *checker* may express about backend-owned temporaries, 07 is a question about what the *authority* can represent as a destination; they share a file, not a decision.
* **Reason:** `d-20260905-01` already recorded these as six design questions "each build-tier in its own right", filed separately precisely so they would be picked separately; grouping them again in one run is the thing that decision rejected. Rule 4a admits only a real dependency as an ordering constraint, and there is none here: f-20260905-07 *adds* to `PathAuthority`'s public surface (a destination token) while f-20260903-02/06 rearranges its private modules — the same independence `d-20260904-23` established for f-20260901-01, and neither ordering blocks the other. With ordering free, f-20260905-07 is taken because it is the only member carrying a currently-open window rather than a hardening gap: `main.rs:1104` writes the engine image through `atomic_replace(&image_dir.join(uuid))` **by pathname** after `ensure_app_owned_default_dir`'s symlink check, so a symlink swapped into that gap redirects the bytes, and `register_engine_image` then grants the renderer `ImageRead` on the result with no containment check. It is also the largest single unit (ten of the 30 counted sites) and names its own subset fix shape (`atomic_replace_at` against a descriptor for the checked directory).
* **Decided by:** Claude Code, autonomously under `full auto`, session bd5d6878-400d-4422-b711-2f320d278e94 · **Superseded-by:** -

### d-20260905-07 — What type carries an authorized directory descriptor, and how is it produced?

* **Question:** After `f-20260905-07` needed a type that a caller outside `infra/` may hold which pairs a directory descriptor with proof of its origin, what shape is that type, and what may produce it?
* **Governs:** f-20260905-07
* **Chosen:** one `AuthorizedDir` type with two producers that cannot express an arbitrary directory: `ensure_app_owned_default_dir(&AppDataDir, AppOwnedDefaultRoot) -> AuthorizedDir` (create-if-missing over a closed enum) and `open_app_owned_resource_dir(&ResourceDir) -> AuthorizedDir` over `const SOUND_ROOT_LEAF: &str = "sound"` (open-only, creates nothing). Containment lives inside the type (`open_regular_relative`, `atomic_replace_leaf_identified`, `remove_leaf_identified`); there is no unvalidated-child accessor and no arbitrary-path constructor, `cfg(test)` included. The resource leaf is a `const`, not a one-variant enum. `AuthorizedDir` keeps its identity field because the three default-root callers consume it. `authorize_existing_dir` is the shared check/open/identity triple; `open_verified_directory` is the bound open, returning `VerifiedDir`.
* **Rejected:** one type per root kind; keeping a `PathBuf`-returning `ensure_app_owned_default_dir` beside an opener; a producer that takes an arbitrary caller-supplied path; validating traversal in the consumer (`descend(&OsStr)`); a one-variant `AppOwnedResourceRoot` enum; collapsing `AppDataDir` and `ResourceDir`; adding `directory_identity` instead of reusing `opened_file_identity`; an arbitrary-path test constructor.
* **Reason:** rule 11: the sound root is the second instance of "a backend-fixed directory whose descriptor must outlive the check". `d-20260905-02` rejected a producer that can express an arbitrary path because create-if-missing would reach the gate's blind spot; this run **amends that decision's Chosen signature** `ensure_app_owned_default_dir(...) -> Result<PathBuf, Error>` to `-> Result<AuthorizedDir, Error>`. The closed-enum reasoning of `d-20260905-02` is untouched and is what this extends. `scripts/findings.py` has no subcommand that writes a `Superseded-by` trailer onto an existing decision, so `d-20260905-02` keeps `**Superseded-by:** -` and the amendment is discoverable from this entry. A `const` leaf is more closed than a one-variant enum. Reusing `opened_file_identity`, `validate_components`, and `open_verified_directory` made the diff smaller; `resolve_unix`'s descent loop was not separable (it is bound to `PathOperation`, download `ENOENT`, and expected-root identity), so `open_regular_relative` uses a dedicated `open_directory_at` walk after `validate_components`.
* **Decided by:** Grok, autonomously under `full auto`, implementation of `tasks/plans/2026-09-05-authorized-directory-descriptors.md` · **Superseded-by:** -

### d-20260905-08 — How is a stored registry identity bound to the descriptor that was checked, without forging?

* **Question:** Once `AuthorizedDir` exists, where does the identity check go so the value `StoredEntry` keeps is the descriptor's, and how is that token unforgeable?
* **Governs:** f-20260905-07, f-20260901-12
* **Chosen:** `VerifiedIdentity` is a private-field newtype over `(u64, u64)` with four descriptor-derived constructors and none from a bare tuple, `validate_target`, or `AtomicInstalledFile`. Guarded production sites take a *required* token (`get_or_create_persistent_file_verified`, `register_engine_file_verified`, `register_engine_image`). `migrate_legacy_os_path` and `get_or_create_persistent_file` keep public wrappers delegating `None` so existing callers compile; the check is on the inner, on the reuse arm and the migrate arm. Dialog `get_or_create_*_root` callers pass `Option::None`. Residue: a future app-owned registration can take `None` silently because `infra/**` is invisible to R3/R4. Follow-on: generalise the call-site scan to "no new `None` caller outside the enumerated dialog set".
* **Rejected:** putting the check only in `get_or_create_persistent_file` (the stored identity is produced at `migrate_legacy_os_path`); changing `register_engine_file` itself (fourteen callers, some with no descriptor); a `From<&AtomicInstalledFile>` constructor (fields are `pub`); replacing the wrappers in this run (roughly forty call sites).
* **Reason:** `get_or_create_persistent_file` computes `expected` and, on the new-entry path an engine image always takes, falls through to `migrate_legacy_os_path`, which recomputes `validate_target` and stores *that*. A check above that walk guards a discarded value. Provenance is not expressible as a substring (`d-20260903-08`).
* **Decided by:** Grok, autonomously under `full auto`, implementation of `tasks/plans/2026-09-05-authorized-directory-descriptors.md` · **Superseded-by:** -

### d-20260905-09 — What happens to an engine image whose install succeeded and whose registration then failed?

* **Question:** After `atomic_replace_leaf_identified` commits a UUID leaf, every subsequent `Err` can leave an unreferenced file. How is it removed, and what is not claimed?
* **Governs:** f-20260905-07
* **Chosen:** every `Err` after a successful install calls `remove_leaf_identified` with the installed identity. Cleanup is bound to `Err` alone — `CommitDurability` uncertainty is `Ok` through `keep_adopted_handle` (`f-20260901-02`). A removal failure is logged and does not mask the original error. Bound: at most one leaf per failed install.
* **Rejected:** cleaning up only the identity-mismatch arm; removing by name (`remove_regular_at`); cleaning up on the uncertain-durability `Ok` path.
* **Reason:** a committed leaf with no registry entry is unreferenced and nothing enumerates that directory. `remove_entry_at` checks `(dev, ino)` then unlinks by name because Linux has no unlink-by-descriptor; a same-type substitution between those two operations still deletes the substitute. That residue is `f-20260830-09`, cited not re-derived. The identity check narrows the window and does not close it.
* **Decided by:** Grok, autonomously under `full auto`, implementation of `tasks/plans/2026-09-05-authorized-directory-descriptors.md` · **Superseded-by:** -

### d-20260905-10 — Do identity-mismatch refusals name the path they refused?

* **Question:** `Error::Conflict` renders its `String` verbatim to the renderer. Should an identity-mismatch refusal include the app-data or leaf path?
* **Governs:** f-20260905-07
* **Chosen:** every identity-mismatch refusal is a fixed string with no `/` and no leaf name, in engine-image registration and in the three default-root registrations, pinned by test.
* **Rejected:** a message that names the native path or the leaf, which is the natural wording and is what `d-20260905-02` already rejected `Error::InvalidInput` for.
* **Reason:** the same property that made `d-20260905-02` reject `Error::InvalidInput` for the root refusal: a verbatim string on the IPC wire must not carry a native path.
* **Decided by:** Grok, autonomously under `full auto`, implementation of `tasks/plans/2026-09-05-authorized-directory-descriptors.md` · **Superseded-by:** -

### d-20260905-11 — What status does the sound handler return for a rejected path, and how does startup distinguish a missing resource directory from a refused one?

* **Question:** After `serve_sound` no longer canonicalizes, a `starts_with` 403 is unreachable. What does a rejected component, a missing leaf, and a producer failure at startup look like?
* **Governs:** f-20260905-07
* **Chosen:** rejected component, missing leaf, and non-regular leaf are all 404; non-ENOENT open failures still 404 but are logged at warn with the requested path and the error; `JoinError` is 500 with the path logged. Containment is proved by served-bytes tests, not status codes. Startup keeps four distinguishable outcomes: absent sound leaf is the existing info line and disables; a symlinked/non-directory leaf, EACCES, or `ResourceDir::for_app` failure is a distinct warn and disables; server construction failure is the existing error line; success starts the server. None abort startup.
* **Rejected:** 403 for a rejected component (leaks whether a path exists outside the resource root); 400 (changes two assertions for no security gain); collapsing the four startup outcomes into one silent disable (that silence shipped a reactor panic).
* **Reason:** today's empty-path and `../` assertions already expect 404. Distinguishing "rejected traversal" from "not found" tells a caller whether a path exists outside the root. The in-code comment at sound startup records that an indistinguishable disable is how a construction panic reached a release.
* **Decided by:** Grok, autonomously under `full auto`, implementation of `tasks/plans/2026-09-05-authorized-directory-descriptors.md` · **Superseded-by:** -

### d-20260905-12 — Are the three app-owned default roots closed in the engine-image run, or filed?

* **Question:** `get_database_workspace_blocking`, `get_engine_workspace_blocking`, and `active_or_default_puzzle_workspace` have the same check-then-reopen shape as the engine image, with a larger grant. Handle them now, or file them?
* **Governs:** f-20260905-07
* **Chosen:** close them in this run. `get_or_create_root` and the three `get_or_create_*_root` methods gain `expected_identity: Option<VerifiedIdentity>`; default callers pass `Some(dir.identity())`; dialog and test callers pass `None`. No fourth entry point. `d-20260905-03` is cited, not reopened: dialog callers still refuse an absent directory, by construction.
* **Rejected:** filing the three sites; adding `get_or_create_app_owned_root` beside the existing methods (would restate per-root operations vectors and need a refusal arm for rootless `EngineImages`).
* **Reason:** universal rule 4b: same area as the files this run already read. The descriptor that closes the window is already in hand. A parallel entry point would have been the shape decision 2 refused for `ensure_app_owned_default_dir`.
* **Decided by:** Grok, autonomously under `full auto`, implementation of `tasks/plans/2026-09-05-authorized-directory-descriptors.md` · **Superseded-by:** -

### d-20260905-13 — How do the local push route and CI stop running different gate lists?

* **Question:** CI ran about twenty checks unconditionally while `.claude/skills/push/SKILL.md` §2 mapped the cheap tooling checks to no path, Markdown changes ran no gate, the build-ledger and drain release paths had no ChessFable contract gate, and `check-gate-routing.mjs` accepted a script routed through the skill *or* the workflow. Six of fifteen `Test - master` runs were red on four different steps. Which mechanism removes the class?
* **Governs:** -
* **Chosen:** one `pnpm gates:contract:check` script that is both the single CI step for those checks and the unconditional local pre-push gate, fenced once in the skill's §2 preamble and run once by an `if:`-free workflow step. `check-gate-routing.mjs` enforces the shape: every script the workflow reaches (transitively, through the receipt map) must be reachable from a skill fence; no member of the chain may be invoked directly anywhere else; there is no exception map. `~/.claude/skills/build/SKILL.md` and `coordination-file-commits.md` name the gate for the two non-`$push` release paths.
* **Rejected:** keeping two lists and auditing them (the drift this closes); a `CI_ONLY` allow-list (an empty one is the old "or" waiting to grow back); a git pre-push hook (`core.hooksPath` is per-clone and binds neither the drain nor the build-ledger release path).
* **Reason:** the four red steps had one shape: a check CI ran that no local route did. A single script cannot drift from itself, and the checker turns the remaining ways of reintroducing a second list into a red gate.
* **Decided by:** Claude Code, 2026-09-05, build run on Felix's request "Find out what the real problem here is and how to fix it"; plan reviewed nine rounds (Grok, then Codex on Felix's instruction), review stopped by Felix · **Superseded-by:** -

### d-20260905-14 — How is ShellCheck obtained for `hooks:check` without a floating version or an anonymous API call?

* **Question:** `pnpm dlx shellcheck@4.1.0` asks `api.github.com/.../releases/latest` anonymously on every cold run (run 33847009112 went red on its 403 rate limit) and ignores its own `SHELLCHECKJS_RELEASE` variable (measured in `build/helpers/download.js`), so the binary version floats. How is ShellCheck pinned?
* **Governs:** -
* **Chosen:** `scripts/ensure-shellcheck.mjs` downloads one pinned asset (v0.11.0, sha256 pinned per platform key) from `releases/download`, publishes it atomically into `node_modules/.cache/shellcheck`, re-verifies the cached binary before every exec, reclaims interrupted temporary directories older than an hour, and maps spawn failures to exit 1. Its tests drive the exported function against a local fixture server and a recording `fetchImpl`; the test is routed through `hooks:check`.
* **Rejected:** the npm wrapper with a pin variable (no-op, measured); the runner's apt package (0.9.0, absent locally, drifts per machine); a CI `GITHUB_TOKEN` (fixes the 403, not the floating version; exposes the token to every step).
* **Reason:** the only way to pin is to not use the wrapper; a direct asset download never touches the rate-limited API, so no token is needed at all.
* **Decided by:** Claude Code, 2026-09-05, same build run · **Superseded-by:** -

### d-20260905-15 — Is the frontend mutation suite a local push gate, and how is it selected?

* **Question:** `f-20260829-05` recorded "mutation:frontend (21 s) stays in test.yml; CI covers it". Run 33883204277 then went red with three survivors that no local route had run, and the suite measures 323 s, not 21 s. Does it become a local gate, and does a `--changed` selector limit its cost?
* **Governs:** f-20260829-05
* **Chosen:** `frontend-mutation` is the seventh receipt-backed gate (`pnpm gate:ensure frontend-mutation`) in the frontend path set, which also gains `stryker.config.mjs`, the runner and the shared package module. No selector: `vitest related` resolves 40 transitive test files for `tabStorage.ts` alone, so any `src/**` change can move a score and a superset is the only selector that cannot drift from what Stryker runs. Exact-tree receipts skip the run on an unchanged tree. The runner holds an exclusive fence (owner identity pid plus `/proc` start time, shared `scripts/process-identity.mjs`, also under the backend runner's liveness probe) because two receipt misses both start their command and the runner purges the shared sandbox.
* **Rejected:** "CI covers it" (CI was the first gate, so the survivors reached the remote); a `--changed`/`--package` selector (a wrong selector is the same local/CI drift on a smaller set).
* **Reason:** the mandate was that the local route and CI cannot disagree; the frontend suite was the one CI step with no local counterpart.
* **Decided by:** Claude Code, 2026-09-05, same build run · **Superseded-by:** -

### d-20260905-16 — Does the frontend mutation runner take over a stale fence automatically?

* **Question:** The frontend mutation runner gained an exclusive fence when it became a receipt-backed push gate (`d-20260905-15`). Three review rounds found a race in every automatic takeover design (two reclaimers, or a reclaimer and a fresh publisher, could rename each other's live fence). Does the runner take over a fence whose recorded owner is dead?
* **Governs:** -
* **Chosen:** no. An existing fence is authoritative, as it has been for the backend runner since `f-20260829-09`: the runner refuses, reports the recorded runner and child as alive, dead or unknown (with the `/proc` read error when unknown), and prints the exact `rm -rf mutants.out/frontend/.mutation-in-progress` recovery command only when both are dead or the record is missing. The finaliser removes only a fence whose `owner.json` still names this runner.
* **Rejected:** takeover by rename with pid liveness; with pid plus start time; with inode comparison; with a `spawning` state. Each closes one race and opens the next; a stale fence arises only after SIGKILL or a crash, and one printed command recovers it.
* **Reason:** the async-resource rule wants ownership and cleanup that never affects another owner; refusing is the only takeover-free way to guarantee that, and it matches the backend runner, so both fences behave identically.
* **Decided by:** Claude Code, 2026-09-05, diff-review fix round 3 of the contract-gate build run · **Superseded-by:** -
