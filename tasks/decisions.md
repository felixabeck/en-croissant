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
* **Decided by:** Claude Code, autonomously under `full auto` while Felix was away · **Superseded-by:** d-20260906-02
* **Scope of supersession:** only the device-only older-kernel fallback; the primary MOUNT_ROOT check and device backstop remain. The newer decision records descriptor-mount evidence absent from this decision.

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
* **Decided by:** Claude Code, autonomously under `full auto`, resumed drain session 7a8afddc-2492-4bf6-bd58-751b8e5f28ee · **Superseded-by:** d-20260912-02

### d-20260905-02 — What shape owns the app-owned default root directories?

* **Question:** Four call sites take `app_data_dir()`, join a compile-time leaf and `create_dir_all` it. What shape replaces them without turning `infra/`'s gate blind spot into a loophole?
* **Governs:** f-20260901-01, f-20260905-07
* **Chosen:** one free function `ensure_app_owned_default_dir(app_data_dir: &Path, root: AppOwnedDefaultRoot) -> Result<PathBuf, Error>` over a **closed** enum whose four variants carry fixed leaves (`db`, `engines`, `engine-images`, `puzzles`), refusing a symlinked or non-directory leaf, with the refusal built as `io::Error` so it reaches the renderer as `Error::Io`.
* **Rejected:** (a) three `get_or_create_default_*_root(&mut self, path: &Path)` methods on `PathAuthority` — the first draft, which gave create-if-missing semantics to an arbitrary caller-supplied path inside the gate's blind spot, and grew a near-identical per-root family from three to six; (b) a pure relocation, `pub fn make_dir(path: &Path)` in `infra/`, called from `main.rs`; (c) `Error::InvalidInput` for the refusal, to match the surrounding file's idiom.
* **Reason:** `isInfraPath` makes `src-tauri/src/infra/**` invisible to `check-rust-release-surface.mjs`, so any of these empties four allowlist slots. Only the closed enum makes that honest: **the signature carries the app-owned property, and the callers do not.** A function that cannot express an arbitrary path cannot be the vehicle by which a user-picked path acquires create-if-missing semantics, so the gate losing sight of it costs nothing it was actually guarding. (b) fails exactly that test. (c) fails a different one: `Error::InvalidInput` renders its `String` **verbatim** (`error.rs:210-211`) and would put a native app-data path on the IPC wire, where `Error::Io` renders fixed text and still carries the MissingResource / Permission / Io discrimination (`error.rs:250-253`).
* **Decided by:** Claude Code, autonomously under `full auto`, resumed drain session 7a8afddc-2492-4bf6-bd58-751b8e5f28ee · **Superseded-by:** d-20260912-02

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

### d-20260905-17 — Which compiler determines the backend coverage tool paths?

* **Question:** Which compiler determines the backend coverage tool paths?
* **Governs:** f-20260829-12
* **Chosen:** Query sysroot and verbose host metadata through `rustup run` with the pinned coverage toolchain. Resolve LLVM tools below that host directory, including Windows executable suffixes. Keep native coverage-executable selection and entrypoint path comparison portable in the same script.
* **Rejected:** Node architecture/platform mappings, the default compiler, and retaining a literal Linux triple.
* **Reason:** LLVM tools belong to the pinned compiler's host installation, which can differ from Node or the default compiler. The same source trace found Unix-only executable matching and URL construction that would still prevent Windows execution after fixing the triple. Regression fixtures cover host shapes and invalid metadata; the real backend coverage command proves the local path.
* **Reversal path:** Replace discovery only with evidence that the pinned compiler's installation layout changed; preserve the host fixtures and real coverage proof.
* **Decided by:** Codex, interactive full-auto next-finding run · **Superseded-by:** -

### d-20260905-18 — Which repository owns the unqualified citations of four ChessRiddle decisions?

* **Question:** Which repository owns the unqualified citations of `chess-tactics-app:d-20260826-10`, `chess-tactics-app:d-20260827-07`, `chess-tactics-app:d-20260827-11` and `chess-tactics-app:d-20260828-19` in this ledger?
* **Governs:** -
* **Chosen:** Declare every occurrence external with owner `chess-tactics-app` (the ChessRiddle checkout) through citation-context directives; the historical prose stays byte-for-byte intact. The owner slug is the repository directory name, matching the `correction-app` and `agent-kit` owners already used across Felix's ledgers.
* **Rejected:** Rewriting the prose to `chess-tactics-app:d-…` (the contract keeps historical prose intact); marking them `historical-error` (the ids exist in ChessRiddle's `tasks/decisions.md` with the cited content, so no local correction decision applies); leaving `check` red after the 2026-09-05 re-sync of `scripts/findings.py` from agent-kit.
* **Reason:** agent-kit `b1a2d34` made `check` validate every unqualified decision citation against the local ledger. None of the four ids is a ChessFable decision; all four are ChessRiddle decisions cited as precedent ("ChessRiddle made it blocking", "a ledger area is a vocabulary bucket"). The directive route is the contract's mechanism for exactly this case. Verified by `python3 scripts/findings.py check` going from 15 problems to green.
* **Reversal path:** Delete this entry's directives and qualify the prose instead, if the contract ever drops the historical-prose clause.
* **Decided by:** Claude Code, 2026-09-05, `$push` red-gate repair · **Superseded-by:** -

<!-- ledger-meta {"cited":"d-20260826-10","entry":"f-20260830-15","kind":"citation-context","line_sha256":"c351e5e2218355f6d227026b11ee134d914bc64f61a5905866a411914873fedf","occurrence":1,"owner":"chess-tactics-app","source":"findings","status":"external","v":1} -->
<!-- ledger-meta {"cited":"d-20260826-10","entry":"d-20260831-09","kind":"citation-context","line_sha256":"fb8f21d65bb02fb82f8f84c4c5c68e2a4e662b2e3bfa43ff78ded3e727b77b91","occurrence":1,"owner":"chess-tactics-app","source":"decisions","status":"external","v":1} -->
<!-- ledger-meta {"cited":"d-20260827-07","entry":"d-20260831-33","kind":"citation-context","line_sha256":"fb0cff7905751cd25eb5a26e2a272a5924ce55f5d37ffbb351f1ffdcaa8532c4","occurrence":1,"owner":"chess-tactics-app","source":"decisions","status":"external","v":1} -->
<!-- ledger-meta {"cited":"d-20260827-11","entry":"d-20260831-33","kind":"citation-context","line_sha256":"fb0cff7905751cd25eb5a26e2a272a5924ce55f5d37ffbb351f1ffdcaa8532c4","occurrence":1,"owner":"chess-tactics-app","source":"decisions","status":"external","v":1} -->
<!-- ledger-meta {"cited":"d-20260828-19","entry":"d-20260831-33","kind":"citation-context","line_sha256":"fb0cff7905751cd25eb5a26e2a272a5924ce55f5d37ffbb351f1ffdcaa8532c4","occurrence":1,"owner":"chess-tactics-app","source":"decisions","status":"external","v":1} -->
<!-- ledger-meta {"cited":"d-20260827-07","entry":"d-20260831-34","kind":"citation-context","line_sha256":"03ee4af8568487baa329deeb7666dc6ce11c6f80459f4e53fd7cb3948d80a866","occurrence":1,"owner":"chess-tactics-app","source":"decisions","status":"external","v":1} -->
<!-- ledger-meta {"cited":"d-20260827-07","entry":"d-20260901-04","kind":"citation-context","line_sha256":"611a681dabeec640b1b2ec817c4ffa35519b4b16fd5faf9d7351f82fc5c473d8","occurrence":1,"owner":"chess-tactics-app","source":"decisions","status":"external","v":1} -->
<!-- ledger-meta {"cited":"d-20260827-07","entry":"d-20260901-10","kind":"citation-context","line_sha256":"a10a03b9e27a9ecba390ea7abd6a925d9fbc649ddb22a106efef57b656b1557e","occurrence":1,"owner":"chess-tactics-app","source":"decisions","status":"external","v":1} -->
<!-- ledger-meta {"cited":"d-20260827-07","entry":"d-20260901-20","kind":"citation-context","line_sha256":"79b5b3582005847e42ca17a7eb1f6abd3c2ca83809e6b3b9ba0aa82754809432","occurrence":1,"owner":"chess-tactics-app","source":"decisions","status":"external","v":1} -->
<!-- ledger-meta {"cited":"d-20260827-07","entry":"d-20260901-21","kind":"citation-context","line_sha256":"2ec79585a378e5818f4410cb95cffa222945a40a8a3ffc4a268e6ac424648529","occurrence":1,"owner":"chess-tactics-app","source":"decisions","status":"external","v":1} -->
<!-- ledger-meta {"cited":"d-20260827-07","entry":"d-20260904-13","kind":"citation-context","line_sha256":"7bf46e52d0e1e4904a56a087bce4dfdcac2cdee9a5991b0365535f70864f9a69","occurrence":1,"owner":"chess-tactics-app","source":"decisions","status":"external","v":1} -->
<!-- ledger-meta {"cited":"d-20260827-11","entry":"d-20260904-13","kind":"citation-context","line_sha256":"0d4ed33f02eec95ac9c1848a1ba2964120aead5f3067ed4df05029a1fc10e746","occurrence":1,"owner":"chess-tactics-app","source":"decisions","status":"external","v":1} -->
<!-- ledger-meta {"cited":"d-20260828-19","entry":"d-20260904-13","kind":"citation-context","line_sha256":"0d4ed33f02eec95ac9c1848a1ba2964120aead5f3067ed4df05029a1fc10e746","occurrence":1,"owner":"chess-tactics-app","source":"decisions","status":"external","v":1} -->
<!-- ledger-meta {"cited":"d-20260827-07","entry":"d-20260904-23","kind":"citation-context","line_sha256":"08a3051e997eaa328b654ec8c29be33786c052375a29fc382943abd69d22b761","occurrence":1,"owner":"chess-tactics-app","source":"decisions","status":"external","v":1} -->
<!-- ledger-meta {"cited":"d-20260827-07","entry":"d-20260905-06","kind":"citation-context","line_sha256":"0a05e47d6210aa1e0761044c70fff6490e56005b9b7a3bce10e8506b42fd395b","occurrence":1,"owner":"chess-tactics-app","source":"decisions","status":"external","v":1} -->
<!-- ledger-meta {"command":"record-decision","effect_lines":25,"effect_sha256":"804f256027d875080d7dc6a599661f73b29683fc2353ec2208e756b1b1a53903","input_sha256":"2d5a349bf05dbbc7e50b7f7ae9ee3fe777c93c9d58a3edc59da2430f2fbbea22","kind":"mutation-receipt","operation":"3acee064dce963cec72d9d9991d9beac0c20c24b78638f7269c1af116a9c7da5","options":{"section":null},"request_id_sha256":null,"results":["d-20260905-18"],"target":"decisions-ledger","v":1} -->

### d-20260905-19 — Is the URL-constructor entrypoint guard portable, and which guard shape do gate scripts use?

* **Question:** Is `import.meta.url === new URL(`file://${process.argv[1]}`).href` broken on Windows or on paths with spaces, and which entrypoint guard shape do the gate scripts use?
* **Governs:** -
* **Chosen:** One helper, `isEntrypoint(import.meta.url)` in `scripts/entrypoint.mjs`, comparing `fileURLToPath(import.meta.url)` with `resolve(process.argv[1])`; all twelve gate scripts call it; `entrypoint:test` is a contract-gate member and runs the guard through a real Node process on a path containing a space.
* **Rejected:** Treating the URL-constructor form as a Windows defect (the `$push` root-cause lens claimed it at confidence 98). Measured 2026-09-05 with Node: `new URL("file://C:\\Users\\x y\\s.mjs").href` yields `file:///C:/Users/x%20y/s.mjs`, identical to `pathToFileURL` on win32, and a Linux path with a space compared equal as well. Also rejected: leaving three guard shapes in twelve files.
* **Reason:** the real defect was the bare template `import.meta.url === `file://${process.argv[1]}`` in eight scripts: no percent-encoding, so on a checkout path with a space the guard is false and the gate exits green without running (measured: `bare-guard-runs-main: false`). Extracting at the second copy (rule 11) removes both the defect and the drift.
* **Reversal path:** none needed; a future guard shape goes into the helper and its test, never back into a script.
* **Decided by:** Claude Code, 2026-09-05, `$push` review fix round · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":9,"effect_sha256":"7d3cbe78d4cd0198f072a49611e827c79710b0b04cd3bb5498b0b8839011fa1b","input_sha256":"e4358a8bb161f24f49e6697d8ca242d83baec1eeb0b64aec6fc7639e94ac6b40","kind":"mutation-receipt","operation":"7e2909ecd803b9dcc9e24c80b1d9c1ca16f80002afc9da4d18c7346066f4d047","options":{"section":null},"request_id_sha256":null,"results":["d-20260905-19"],"target":"decisions-ledger","v":1} -->

### d-20260905-20 — How should large PGN corpora be scanned, indexed and exported without materialising them?

* **Question:** How should large PGN corpora be scanned, indexed and exported without materialising them?
* **Governs:** f-20260831-06
* **Chosen:** Keep compact scanner offsets in shared Arc storage with byte-budgeted cache retention, removing corpus file-size/game-count caps while retaining individual-line/page/game protections. Stream Diesel rows into a versioned chunked rkyv sidecar through the existing fd-relative atomic writer. Mmap open validates chunks and deserializes only provenance; parallel search borrows entries. Stream export into the existing atomic temporary file with explicit final flush.
* **Rejected:** Raising the 64 MiB cap alone; retaining full game/move vectors or serializing an entire index; introducing another database/dependency; changing the source database format.
* **Reason:** All four f-20260831-06 sites hold or refuse corpora despite a domain contract for hundreds-of-megabytes PGNs. Existing load_iter, atomic_replace_at and replace_pgn_atomic supply the streaming seams. The sidecar is a regenerable cache; incompatible versions follow authorized regeneration, while operational I/O errors propagate. One oversized record may exceed the chunk rollover target and occupies a chunk alone. Reversal path: version the cache format again and regenerate, without rewriting source databases.
* **Decided by:** Codex autonomously under full auto, after two Codex plan-review rounds · **Superseded-by:** -

### d-20260905-21 — What happens when a streaming database export cannot encode every selected row?

* **Question:** What happens when a streaming database export cannot encode every selected row?
* **Governs:** f-20260831-06, f-20260904-04
* **Chosen:** Propagate row, malformed FEN, movetext, write and terminal-flush errors before atomic publication, preserving the existing destination. Keep the existing Result<(), Error> and committed-durability-uncertain outcome.
* **Rejected:** Silently skipping rows or moves; publishing a partial file as successful; adding a partial-recovery export UI and a new result type within the streaming change.
* **Reason:** The current command promises completion through Result and an atomic replacement, and the renderer already handles typed export failures. Streaming must not turn a delayed write or row error into published incomplete data. A deliberately partial recovery/export feature is a separate product design. Reversal path: add an explicitly requested partial-export mode with a typed report and matching UI; do not silently weaken complete export.
* **Decided by:** Codex autonomously under full auto, after two Codex plan-review rounds · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":17,"effect_sha256":"7beaba254c92011d915f66e905506c8895c9f4cb46dad1f1a25b44cfca29b98b","input_sha256":"cf918d505d04532139249cc2954bbb80c54b26b5718d4da8b878dc9eccba41aa","kind":"mutation-receipt","operation":"a89172eb518437ad462e735f2f53a852f2d40f2b1c47d857b24011002f0e3512","options":{"section":null},"request_id_sha256":null,"results":["d-20260905-20","d-20260905-21"],"target":"decisions-ledger","v":1} -->

### d-20260905-22 — How should regressions in complete database-pipeline memory use be detected?

* **Question:** How should regressions in complete database-pipeline memory use be detected?
* **Governs:** f-20260831-06
* **Chosen:** Measure scoped peak Rust heap allocation on the synchronous test thread around real index generation, mmap open and PGN export. Use one test-only System allocator wrapper with disabled-by-default allocation-free counters and generated large on-disk fixtures; retain chunk/writer behavior tests as complementary evidence.
* **Rejected:** RSS or timing thresholds, source-string checks alone, or synthetic-iterator tests as the only proof for outer production commands.
* **Reason:** The final tests/root-cause lenses demonstrated that collecting all rows before invoking the tested writer, or transiently deserializing all mapped entries, would preserve existing test success. Thread-local Rust heap peaks catch that class deterministically while avoiding unrelated concurrent tests, native SQLite allocations and mapped-page residency. Production allocation behavior remains unchanged. Reversal path: replace the shared test probe with an equally direct production-path allocation instrument; keep the large-corpus regression assertions.
* **Decided by:** Codex autonomously during final review, 2026-09-05 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"97118146829ff8787fed1b96142acdf8a0e987fd262edf1c2292384dff81cefc","input_sha256":"dd206939ea51e686be5bf89e3238f78ebd58de1339aba201bf2eafed69df1e2a","kind":"mutation-receipt","operation":"3aa35800d9df0e086537c09ecb6ca20d82cdd45c0dae7e13e61f827dcc109767","options":{"section":null},"request_id_sha256":null,"results":["d-20260905-22"],"target":"decisions-ledger","v":1} -->

## 2026-09-06 — recorded through the decisions lock

### d-20260906-01 — Can private rename staging close the final inode-to-name unlink race?

* **Question:** Can private rename staging close the final inode-to-name unlink race?
* **Governs:** f-20260830-09
* **Chosen:** retain the existing identity and descriptor guards, document the final name-resolution residual, and keep the defect open with `Blocked: inode-conditional-unlink-unavailable`. Revisit when Linux offers inode-conditional removal or evidence establishes genuinely exclusive writer authority over the whole tree.
* **Rejected:** moving a directory into a private staging parent as if that revoked existing writer access; calling the real race rejected or handled merely because that repair is inadequate; advisory application locks as protection against external writers.
* **Reason:** a local probe opened a directory before moving it under a 0700 private parent and then successfully created a file through the retained descriptor. The same writer can keep handles at every level, so staging does not reduce this adversarial case to one window. Linux rename explicitly preserves open descriptors (https://www.man7.org/linux/man-pages/man2/rename.2.html). The current inode checks narrow the race but no current primitive atomically unlinks only the inode they checked. This is a technical precondition, not a question for Felix, and no false claim of repair is recorded.
* **Decided by:** Codex, drain e7cf229e-c8c7-4977-b54f-e2fe3a77f1fb, full auto · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"43de18177de600ceed9c1d8d94cc968936a1c5ca879e60f55a84570e5e3e425d","input_sha256":"e9a0acb3106f6f55a8f5af060c93e1ff6d373d77fe876b0e64766717e23fa2e1","kind":"mutation-receipt","operation":"c99b4b33fdf481bfa6eff3be729b93e59afdad0f77d170f8e3c5558e6a9b070b","options":{"section":null},"request_id_sha256":null,"results":["d-20260906-01"],"target":"decisions-ledger","v":1} -->

### d-20260906-02 — How can recursive deletion detect bind mounts without statx MOUNT_ROOT?

* **Question:** How can recursive deletion detect bind mounts without statx MOUNT_ROOT?
* **Governs:** f-20260830-10
* **Chosen:** preserve the device backstop and supported statx MOUNT_ROOT check; on NOSYS or missing attribute support, compare mount IDs from bounded `/proc/self/fdinfo/<fd>` records for the held parent and child descriptors before enumeration. Unavailable or malformed mount evidence refuses descent. No kernel version check or platform declaration is introduced.
* **Rejected:** device-only acceptance, a Linux 5.8 minimum, and the pathname `/proc/self/mountinfo` scan rejected by d-20260830-03. Also rejected: treating unavailable descriptor evidence as proof of no mount.
* **Reason:** this refines the older-kernel clause of d-20260830-03 using new evidence it did not consider: fdinfo exposes mount IDs for held descriptors since Linux 3.15 (https://www.man7.org/linux/man-pages/man5/proc_pid_fdinfo.5.html). A real bind mount in a fresh user/mount namespace measured equal st_dev values and different descriptor mount IDs. The held descriptors retain the compared mount references, avoiding a pathname mount-table snapshot race. Unlike blanket refusal below 5.8, the fallback permits ordinary deletion with usable fdinfo. Systems lacking both mechanisms now refuse this destructive operation. The prior primary/backstop decision remains; only its device-only fallback is superseded. Reversal requires new compatibility or security evidence.
* **Decided by:** Codex, drain e7cf229e-c8c7-4977-b54f-e2fe3a77f1fb, full auto · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"d4947e8abb2d1ca19bd8ca4ce625522e0b0ec57df08e79669d03154c426118af","input_sha256":"039287c152011b4415300d81a4f2d681a4ad997a6c779dd2c4f5a4524373fd58","kind":"mutation-receipt","operation":"c509c3a6f6d9d8bfd0af6f262fc51626d366150831e0f7b0606c8f059d9e4e82","options":{"section":null},"request_id_sha256":null,"results":["d-20260906-02"],"target":"decisions-ledger","v":1} -->

### d-20260906-03 — What does `CommittedDurabilityUncertain` mean at each `atomic_replace` call site?

* **Question:** What does `CommittedDurabilityUncertain` mean at each `atomic_replace` call site?
* **Governs:** f-20260830-21
* **Chosen:** the enum is `#[must_use]`, so every site decides explicitly. Three contracts exist and each site is assigned one: (1) *report* — the replacement is the operation's last step, the file is kept, and `Error::CommittedDurabilityUncertain(stage)` is returned through `infra::fs::require_durable` (PGN edit, search-index generation and copy, native export, download target, workspace file/directory creation and rename, database deletion); (2) *record* — the write is one step of a larger operation whose in-memory state must stay truthful, so the site logs, keeps going and carries the uncertainty in its result (credential registry `RegistryCommit`, path-authority registry `CommitDurability`, engine-image install); (3) *combine* — when two replacements landed in one operation the first uncertain stage is reported and a later non-uncertainty error outranks it (workspace create and rename). Tests assert `DurableCommit` through `expect_durable` rather than discarding.
* **Rejected:** treating uncertainty as success anywhere a user is promised a saved file; compensating (unlinking the new copy) after an uncertain parent sync, which can delete the only committed copy; a `Result`-returning `atomic_replace` that errors on uncertainty, which would hide that the rename landed from every caller that must keep state.
* **Reason:** the finding's verified failure was a compensation after a discarded outcome; `#[must_use]` is the only mechanism that makes a new discard fail at compile time; the three contracts already existed at the sites that handled the outcome, so the decision names them rather than inventing a fourth.
* **Decided by:** Claude (Fable 5.1), autonomously under `full auto` · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"de2935563ed3a1d504864998c7f80569d2f41b86e86066e6f3112a410ae21476","input_sha256":"b529949a6f1e07ded1beed64674a8e221a849c472babae8ed1aaa04b58432a40","kind":"mutation-receipt","operation":"0c3bf187f719101459a00e9e45eb1d6405ee4b60379d81146b5b1c673c3bb7b6","options":{"section":null},"request_id_sha256":null,"results":["d-20260906-03"],"target":"decisions-ledger","v":1} -->

### d-20260906-04 — Narrow the non-Linux sound route's grants; do not replace the route while `f-20260830-06` is parked

* **Question:** Given that `f-20260830-06` (does the fork support macOS and Windows?) is parked on Felix, how are the asset-protocol scope and the two unscoped `core:path` grants that exist only for the non-Linux sound route narrowed?
* **Governs:** f-20260830-24
* **Chosen:** `assetProtocol.scope` becomes `["$RESOURCE/**"]`; both `core:path` grants are deleted and `resolveResource` is replaced by a Specta command `sound_resource_path(collection, kind)` that validates `collection` against the eight bundled directory names and `kind` against a three-variant enum and returns the one bundled file's location under the resource directory; the `path_authority.rs` header names that single exception; `check-tauri-command-boundary.mjs` refuses `core:path:allow-resolve*` and any `assetProtocol` other than enabled with exactly `["$RESOURCE/**"]`; the CSP is untouched.
* **Rejected:** one loopback sound server on every platform (asset protocol, `core:path` and the renderer's non-Linux branch deleted) — measured: `authorize_existing_dir` is `#[cfg(not(unix))] → Err(Conflict)` (`path_authority.rs:914-918`), so a Windows build would go silent, and whether the fork supports Windows/macOS at all is `f-20260830-06`, parked on Felix; four review lenses at 98–100 held that this decides his question by side effect. Bytes over IPC with `blob:` audio — WebKitGTK media through custom schemes is measured broken (`asset://` sound → `MEDIA_ERR_SRC_NOT_SUPPORTED` in the real window, 2026-09-06) and it would reverse `d-20260905-11` without evidence. Keeping `core:path:allow-resolve-directory` with an honest header — the grant is unscoped (`resolve_directory` accepts any `BaseDirectory`), which is the defect. A `PathRef`-returning command — the consumer needs a URL for `<audio>` and `convertFileSrc` needs the path, so it would need a second command to reach the same place.
* **Reason:** both answers to `f-20260830-06` stay open: Linux-only makes the non-Linux branch dead code to delete then; a port brings a Windows `AuthorizedDir` and the moment to unify on the server. Reversal path: the answer to `f-20260830-06`.
* **Decided by:** Claude Code, autonomously under `full auto` while Felix was away · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"221ad70e38db2abc266b003cd83e96a68dd4193ceb49da767e55d5da903cbc5c","input_sha256":"c7ef80cf727baec999c7c02f545ec47c129ab670e1b57eacc690d3908a2ad7be","kind":"mutation-receipt","operation":"953a5497b5bfa038cc49541811e4af598a4e28527c3aa7d4c1f8611b67df9f19","options":{"section":null},"request_id_sha256":null,"results":["d-20260906-04"],"target":"decisions-ledger","v":1} -->

### d-20260906-05 — Which of `path_authority.rs`'s dead entry points are deleted, gated, or kept behind an attribute

* **Question:** When the file-level `#![allow(dead_code)]` leaves `path_authority.rs`, which of the entry points it hid are deleted, which become `#[cfg(test)]`, and which keep an attribute?
* **Governs:** f-20260830-25
* **Chosen:** the file-level `#![allow(dead_code)]` goes, and with it the entry in the shrink-only `INITIAL_DEAD_CODE_ALLOWLIST` of `check-rust-release-surface.mjs` (now empty; any new entry is an R1 violation). Deleted: `register_downloaded_pgn`, `register_download_artifact`, `read_bounded_bytes`, `write_bytes`, `revoke_dialog`, and the three capability-management commands with their bindings. `#[cfg(test)]`: `save`, `read_bytes`, `descriptors`, its producer `descriptor`, and `PathDescriptor` (all three or production fails to compile). `allows_delete_sharing_for_operation` keeps a `#[cfg_attr(not(windows), allow(dead_code))]` naming its Windows caller and keeps its test on every platform. `READ_TOKENS` keeps the `"read_bounded_bytes"` needle: it is a substring denylist over the engine-image opener and still guards the live `read_bounded_bytes_cancellable`. The `DownloadFile` refusal on a registered artifact moves from the deleted `register_downloaded_pgn` test onto the `reserve_download_artifact` recovery test.
* **Rejected:** a narrower file-level allow with a better comment (it is what hid the surface for three weeks); gating the Windows sealing test to Windows (no Windows runner exists, the function is pure); deleting the `READ_TOKENS` needle with the symbol (it would silently narrow a guard over a live symbol); relying on `cargo clippy -D warnings` as the dead-code oracle for `pub` methods (measured: `read_bytes`, `read_bounded_bytes`, `write_bytes` never warn).
* **Reason:** the compiler is the oracle only for non-`pub` items in this crate, so every `pub` disposition is written down and pinned by an acceptance grep; the proof pins exactly one `--force-warn dead_code` warning (the Windows helper) under `pipefail`.
* **Decided by:** Claude Code, autonomously under `full auto` while Felix was away · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"6292beb1554f23691fe1bddda1585b142530d11570104dae7982c88b3555fdf5","input_sha256":"c1f7ba27d76a2b5f212928be524c93e1e9802684516b8f89686bd66968218661","kind":"mutation-receipt","operation":"f7981968632f2e933a7f9d9471a5f3958409f650fac34dac60c3d1ab2a9e4fdf","options":{"section":null},"request_id_sha256":null,"results":["d-20260906-05"],"target":"decisions-ledger","v":1} -->

### d-20260906-06 — The five other unreferenced IPC commands are filed, not deleted, in the capability-surface run

* **Question:** Does the run that deletes the three capability-management commands also dispose of the five other unreferenced commands `f-20260830-25` counts?
* **Governs:** f-20260830-25
* **Chosen:** `f-20260830-25` Defect 2 names the three capability-management commands, which are deleted; the five others it counts are sorted by a probe and filed: `cancel_download` (`f-20260906-07`, the only real download abort, never wired) and `set_file_as_executable` (`f-20260906-08`, the only thing that restores the execute bit on an archive-installed engine, never wired) stay registered because deleting them would cement the missing behaviour; `get_file_metadata`, `get_opening_from_fen` and `get_puzzle_db_info` are superseded and are filed as one `inline` finding for their own run.
* **Rejected:** deleting the three superseded commands in this run — two Codex review rounds classed it as beyond the mandate; a repository-wide command-consumer checker with a finding-keyed allowlist — six lenses showed that lexical whole-word counting cannot prove a call (a comment, mock or string satisfies it), so the guard is its own design question and is filed.
* **Reason:** the finding's authority is the three commands it names; the wider count is context. Keeping the two unwired commands registered means the wiring run does not first have to restore them.
* **Decided by:** Claude Code, autonomously under `full auto` while Felix was away · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"6a0ff98bf42d9ab2c28ab5694eb33be7023a9a80405551705394d7a2d56d40f8","input_sha256":"3fb6fd0df2e2a14fcaa7699e3947fe489549e7ce8bb301e0f45a9a0a2363d540","kind":"mutation-receipt","operation":"b068b6e2ec957b8a0302841c8a7a09e360e3f8587bebd6a2b36d648c08da77bd","options":{"section":null},"request_id_sha256":null,"results":["d-20260906-06"],"target":"decisions-ledger","v":1} -->

### d-20260906-07 — How are workspace metadata and engine-image reads bounded without reopening paths?

* **Question:** Which read limit and acquisition contract close f-20260830-32 while keeping valid metadata, image growth and opening-book cancellation working?
* **Governs:** f-20260830-32
* **Chosen:** One bounded reader for metadata, engine images and opening books, consuming at most the configured cap plus one detection byte. Metadata has a named 1 MiB serialized-byte cap, also checked by create/rename before filesystem mutation. Sidecars open relative to the parent retained by an authorized PGN resolution; only an absent sidecar defaults. Regular no-follow opens are nonblocking until file-type validation, including the PGN acquisition that precedes metadata. Reads and JSON parsing occur after the authority guard drops. Preserve d-20260903-08 and VerifiedFile provenance.
* **Rejected:** Post-read length validation (allocates the attack first), independent bounded loops (the original consistency failure), pathname exists/read or sidecar symlink prechecks (a replacement can redirect the later open), silent metadata truncation/default (loses data), and a limit only on reads (the app could write metadata it cannot list).
* **Reason:** The selected finding identifies unbounded sidecar and image reads; current image growth tests assert eventual ResourceLimit and still pass the unbounded implementation. Production-path consumed-byte tests distinguish the correction. The metadata byte budget is technical resource control over a small typed sidecar, not a PGN corpus-size limit. Reversal path: change the single metadata limit and its paired reader/writer boundary tests if measured legitimate metadata requires a different budget; retain hard bounded consumption and no-follow acquisition.
* **Decided by:** Codex, autonomously under full auto, 2026-09-06. **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"0b9915ff7f8f353b28fb94a0c9f357899d0fb76ae63a1556429a26723b6110b2","input_sha256":"f5d4ec0a5d339e5ecc9ab89c515ff7cde79a3dd1634aea691f32230bf7ff7b36","kind":"mutation-receipt","operation":"044529245d3ee88190f9a7ed7b1dec3e7122f69f88fe71f364cfb94f726a152e","options":{"section":null},"request_id_sha256":null,"results":["d-20260906-07"],"target":"decisions-ledger","v":1} -->

### d-20260906-08 — How does installed-engine registration preserve its retained descriptor through persistence?

* **Question:** After d-20260905-08 bound the stored identity, how does f-20260901-12 eliminate redundant pathname acquisition without changing restart identity or native-selection callers?
* **Governs:** f-20260901-12
* **Chosen:** Installed registration retains a required ResolvedPath/VerifiedIdentity boundary and passes the descriptor identity plus ResolvedPath::target as the restart locator to shared private persistent-file reuse/insertion logic. Native-path acquisition callers validate before reaching that same storage logic. No pathname acquisition occurs after installed-engine resolution. If the locator is replaced after resolution, registration may store the original descriptor identity successfully; every later use and reload continues to reject the replacement. Existing IDs, operation sets and durability-uncertain adoption remain.
* **Rejected:** Rewalking with an expected identity (already prevents replacement adoption but discards the retained acquisition), persisting the replacement identity, changing the registry schema to persist process-local file descriptors, and broad module-wide provenance sealing in this cluster (separately recorded and not required to retain the existing guarded entry-point contract).
* **Reason:** d-20260905-08 already closes the original replacement-adoption defect. The remaining finding explicitly asks to remove descriptor discard and pathname reconstruction. The stronger regression must assert successful registration of the original identity after a deterministic post-resolve pathname swap, then refusal on use/reload; a non-adoption assertion alone already passes the old implementation. This extends rather than reverses d-20260905-08. Reversal path: if immediate locator freshness becomes a required behavior, design an explicit descriptor-relative validation boundary while keeping descriptor identity authoritative; do not reintroduce pathname identity acquisition.
* **Decided by:** Codex, autonomously under full auto, 2026-09-06. **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"ca0e76051f8b5e3fd715e4d04db6750a36ee25a138943721e335d3d69f896930","input_sha256":"28ed5fc47f9a21a5c16e9287216ee2f12e924666618b81dd521794f9af2d47cb","kind":"mutation-receipt","operation":"1ba00401002bc56a3f5ed1d1c0fde03a5709697ec7bc590ac9cdde1011bab115","options":{"section":null},"request_id_sha256":null,"results":["d-20260906-08"],"target":"decisions-ledger","v":1} -->

### d-20260906-09 — How are persistent path grants bounded and reclaimed without breaking active owners?

* **Question:** How are persistent path grants bounded and reclaimed without breaking active owners?
* **Governs:** f-20260830-35, f-20260901-13
* **Chosen:** Keep schema-1 atomic JSON with additive semantic purpose metadata. Bound unique authority/session/cleanup IDs at 4096, artifact intents at 256, serialized state at 16 MiB and legacy input consumption at 64 MiB plus one detection byte. Over-limit legacy dimensions may not grow. A typed original-storage owner collector drives startup authority-only reclamation; active roots, pending work, explicit durable owners and grants issued/reissued/used in the session remain protected. Unknown legacy semantics and untrusted owner families remain conservative; raw confirmed absence is trusted empty evidence.
* **Rejected:** Hard caps without reclamation; filesystem absence as ownership evidence; immediate per-consumer revocation; a new storage engine or background collector.
* **Reason:** Production issuers span workspace PGNs, downloads, books, databases, puzzles and engines. A cap alone eventually exhausts on stale grants. Synchronous preference writers and runtime captures need future handle resolution, so session retention plus next-startup reachability avoids invasive async wrapping without making stale grants permanent. Semantic purpose prevents operation-vector order from multiplying IDs or broadening unrelated grants. This preserves d-20260831-06 and existing VerifiedIdentity/durability contracts. Reversal path: measured capacity/throughput evidence may change numeric bounds or storage engine; any ownership replacement must prove equivalent durable and runtime retention without using offline status as deletion evidence.
* **Decided by:** Codex, next-finding/build full-auto session, 2026-09-06. **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"34f4dc23bc0fdf256f2d9f0cc7188d72d5c2516d575eae1565ca9fe3729f23ef","input_sha256":"d0a6f9ade69aa974e04954826a9943dff1f74b866c2214ca1b5ba8e653bb4672","kind":"mutation-receipt","operation":"29ab79e4105191d3946fad56dc37312d39337adbbf546f82c5a0a9ab0d25f9c3","options":{"section":null},"request_id_sha256":null,"results":["d-20260906-09"],"target":"decisions-ledger","v":1} -->

### d-20260906-10 — How can engine attachment ownership cross renderer storage and the native registry safely?

* **Question:** How can engine attachment ownership cross renderer storage and the native registry safely?
* **Governs:** f-20260901-13, f-20260830-35
* **Chosen:** Serialize engine-list and both player-owner updates through one coordinator: durable native prepare-retain, then compressed renderer persistence, then native reconcile. Prepare restores retired authority and cancels managed-image cleanup before a saved reference can become durable. Retirement removes restart authority while retaining bounded session resolution; identity-checked managed image cleanup runs after trusted restart reconciliation or sealed shutdown. Resource source bytes are never deleted. Correlated non-throwing save receipts preserve report-and-resolve persistence behavior.
* **Rejected:** Synchronize only after renderer writes; immediate unlink/revoke on replacement; relying on open file descriptors or Drop for runtime and process-exit safety; using a global last-save-success flag.
* **Reason:** A crash after renderer persistence but before native re-adoption could otherwise leave a durable owner naming only a cleanup intent. Runtime tabs and captured snapshots may resolve old refs later, and tao exits without Rust Drop teardown. Prepare-before-save and session retirement cover those distinct windows. Missing/substituted cleanup leaves complete idempotently without deleting substitutions. This preserves d-20260901-16 error handling and d-20260901-17 permanent executable retirement. Reversal path: a replacement transaction protocol must prove every prepare/storage/reconcile crash boundary and runtime future-resolution invariant before changing the ordering.
* **Decided by:** Codex, next-finding/build full-auto session, 2026-09-06. **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"9ab1b874838cc581b5fb8ded71a8838fa93f7d4348ec7c59fa11c5483e1f9966","input_sha256":"b807d2bfaee4ce12142f5570c1e528682fda539de3624c766c1975336436d2d7","kind":"mutation-receipt","operation":"2c37c64dff7365a13aa4a6f3f7544477af5f255594939dbe2bca4a3c445a6d46","options":{"section":null},"request_id_sha256":null,"results":["d-20260906-10"],"target":"decisions-ledger","v":1} -->

### d-20260906-11 — Which schema and codec preserve durable engine-player attachment owners?

* **Question:** Which schema and codec preserve durable engine-player attachment owners?
* **Governs:** f-20260906-14, f-20260901-13
* **Chosen:** Use a shared human/engine OpponentSettings union reusing existing engine, go-mode and resource schemas. Both player keys use the existing compressed serializer and legacy compressed-or-JSON reader, as engines does. Capture original hydration evidence before repair; malformed, lossy or failed reads preserve their raw source and withhold destructive reconciliation, while confirmed absence is trusted empty and other owner keys still contribute. Deliberate subsequent saves can repair a key.
* **Rejected:** Inferring engine-player records from human defaults; silently accepting filtered/fallback data as complete ownership; a second compression codec; compressing every unrelated preference.
* **Reason:** createPreferenceStorage currently derives the player schema from human defaults, stripping or rejecting saved engine-specific fields. Those snapshots are real durable owners and may preserve resources after the engine-list copy changes. The two potentially unbounded snapshots need the same established codec, not a general preference migration; this extends rather than reverses d-20260901-16. Reversal path: a new player representation must migrate legacy snapshots losslessly and prove resource/image/go-mode round trips plus conservative ownership on hydration failure.
* **Decided by:** Codex, next-finding/build full-auto session, 2026-09-06. **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"869c93a7687abd5c793f27b170ed280ad62d456080a707638d65b357715e9b3b","input_sha256":"6890ad58e62fa1a8c0e412a13f87ae893fcfd137063244f4b0b7a7819c463e0c","kind":"mutation-receipt","operation":"acb4a1ad4d362add0f18992dfc6536b3315f456eb0ed151f14ee17cc7dfd90d4","options":{"section":null},"request_id_sha256":null,"results":["d-20260906-11"],"target":"decisions-ledger","v":1} -->

### d-20260906-12 — How are legacy engine identities repaired without treating lossy hydration as ownership?

* **Question:** How can valid legacy engine records missing an immutable ID, or containing duplicate list IDs, remain usable under strict owner validation?
* **Governs:** f-20260906-14, f-20260901-13
* **Chosen:** Permit identity-only repair through the existing engine schemas. Preserve every non-identity field exactly; retain distinct existing IDs and repair only missing IDs or later duplicate list IDs. Use the normal native prepare / renderer write / native reconcile coordinator, with an expected-original-raw comparison immediately before the write. A conflict reloads the latest raw value once without another migration attempt. Failed persistence preserves original bytes and returns display hydration with a reported unsuccessful receipt; original untrusted startup evidence still protects the owner family.
* **Rejected:** Returning an empty engine list for a valid pre-ID record; persisting arbitrary schema normalization as trusted ownership; overwriting newer raw storage after an asynchronous prepare; an unbounded migration retry loop.
* **Reason:** Published schemas already generated missing IDs and repaired duplicates. Strict ownership inspection must not erase that compatibility, but cleanup authority cannot be inferred from lossy data. This extends d-20260906-11 with the narrow identity-only exception. Reversal path: a future versioned owner format can replace this migration only with equivalent legacy, conflict, failed-write and restart proofs.
* **Decided by:** Codex, next-finding/build full-auto session, 2026-09-06. **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"d1293dbfb154dce40f69e9d2079becdc69cd3f9cff9e51ec5c1b444133933849","input_sha256":"3429c9e873ee4912900b5b1247a742a86adc63783cf0ed812a9a28d86bff55fe","kind":"mutation-receipt","operation":"aeb30b2b8e7dabfab1ca66aa6f88ff98b5dc28ec356588e5e9bf0b8f3babbd99","options":{"section":null},"request_id_sha256":null,"results":["d-20260906-12"],"target":"decisions-ledger","v":1} -->

### d-20260906-13 — What happens when ordinary preference hydration or persistence fails?

* **Question:** Should an ordinary preference storage failure crash hydration or prevent an otherwise valid report from starting?
* **Governs:** f-20260906-20, f-20260901-09
* **Chosen:** Catch read, normalization-repair, write and removal failures in the existing synchronous validated preference adapter. Return schema defaults after failed reads or invalid data, or normalized display data after a failed repair; preserve original bytes when the write fails. Report a redacted, translated persistence error without pretending the change survived restart. Report settings use an explicit domain schema with existing defaults and finite Depth/Time/Nodes go modes; failure to save those preferences does not prevent analysis using valid in-memory settings. Keep existing raw JSON encoding for these ordinary preferences.
* **Rejected:** Letting storage access or failed repair throw through render; silently discarding the failure; treating the preferences adapter as a durable transaction receipt for workspace close; migrating unrelated preferences to compression in this run.
* **Reason:** These are optional settings, not the durable workspace/tree ownership protocol. Continuing with valid in-memory settings preserves the established report behavior while telling the truth about persistence. Workspace close/creation durability remains a separate recorded lifecycle design (f-20260906-22 and f-20260901-05). Reversal path: a future settings transaction API may offer explicit saved receipts, but must retain safe hydration, failure visibility and legacy encoding compatibility or migrate it explicitly.
* **Decided by:** Codex, next-finding/build full-auto session, 2026-09-06. **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"a9e3db038eb4b8c3bef4bc675c39fa7f19047a5488b8a5d864d8b1fbd800d752","input_sha256":"2726168fc5ccd4a4ef7c4ac57f1948f1fbce6a22ee7fbb969ae8449d1956e610","kind":"mutation-receipt","operation":"1406ecbed8c58d56c6f817ded28ab6bb52cb1aeadc1f6bfe20361d277ffc20ff","options":{"section":null},"request_id_sha256":null,"results":["d-20260906-13"],"target":"decisions-ledger","v":1} -->

### d-20260906-14 — Where do the new attachment draft and persisted opponent schema belong?

* **Question:** How should the new engine attachment draft and opponent owner schema fit the existing domain and coverage boundaries?
* **Governs:** f-20260901-13, f-20260906-14
* **Chosen:** Keep EngineAttachmentDraft and replaceEngineById in src/components/engines/engineAttachments.ts beside their only production consumers, with the draft test alongside. Keep OpponentSettings, its schema/defaults and exact-branch construction in src/state/opponentSettings.ts beside the durable owner coordinator. Update imports without behavior changes or compatibility aliases.
* **Rejected:** Leaving new production utilities unmeasured; changing coverage floors or numeric baselines to pass; adding broad utility globs that reassign unrelated modules; moving either helper into an unrelated already-covered utility solely to hide it from the mapping check.
* **Reason:** The final coverage gate exposed the missing domain assignment. The draft is an engine-form lifecycle controller; the opponent schema is a persisted-owner domain used by state and UI. These placements match existing coherent area globs and keep every new line subject to unchanged measurement scope and ratchets. Reversal path: if either module gains a genuinely different domain owner, define and review that ownership and its coverage assignment explicitly before moving it.
* **Decided by:** Codex, next-finding/build full-auto session, 2026-09-06. **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"cbf49989422dfa7cffbaef77e01320b6024cd83b7f06d37e0468c2e281f0abab","input_sha256":"2e3edb9d0a84992f5b43369421e7f41f1dd2d229f4a3f4a70830068a14fcf1b1","kind":"mutation-receipt","operation":"e69e2ebb0327f6db31b2af0a17d438538451954ff5d79a29008b62c7eb26f5c5","options":{"section":null},"request_id_sha256":null,"results":["d-20260906-14"],"target":"decisions-ledger","v":1} -->

### d-20260906-15 — How does selected-root database creation preserve its authorized filesystem boundary?

* **Question:** How should database creation and registration-failure cleanup survive root or leaf pathname substitution?
* **Governs:** f-20260906-19
* **Chosen:** On Unix, resolve the DatabaseCreate capability to a retained parent descriptor, create one exclusive no-follow private regular leaf, and mint its identity inside the sealed ResolvedPath implementation. Share the existing identity-validating registrar with discovery. Sync file and parent before registration; ordinary failures clean only the identified leaf through the retained parent and report combined cleanup failure. Preserve created files after committed-but-durability-uncertain registry outcomes. Non-Unix creation fails closed; existing discovery registration remains unchanged.
* **Rejected:** Pathname create_new or remove_file after root validation; adopting a substituted inode; an arbitrary-file identity constructor; deleting a possibly committed database; expanding this correction into the separately parked non-Linux directory-capability port.
* **Reason:** The selected-root authority must control the actual namespace mutation, not just an earlier check. Existing exclusive descriptor and identity-safe cleanup semantics supply that boundary without changing database handles or broadening capabilities. Reversal path: replace the platform refusal only with a reviewed equivalent retained-handle implementation and the same substitution, exclusivity, cleanup and uncertain-commit proofs.
* **Decided by:** Codex, next-finding/build full-auto session, 2026-09-06. **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"47a31bb5c23b4e9724e2ef492119e5219ac1909571791a5b31e72b70fbaeb9d8","input_sha256":"9724c9fbb683d5a77c1cf1ea08c6c4a13ff68bebab8f0df8d16704f3e5917e73","kind":"mutation-receipt","operation":"e76ed89698028701a8d70651ef002b9c2d25e40ba7ba8c1c841bb4521e01ed35","options":{"section":null},"request_id_sha256":null,"results":["d-20260906-15"],"target":"decisions-ledger","v":1} -->

## 2026-09-07 — recorded through the decisions lock

### d-20260907-01 — How should allocating encoding mutants be contained without limiting Cargo builds?

* **Question:** How should allocating encoding mutants be contained without limiting Cargo builds?
* **Governs:** f-20260907-01, f-20260907-02
* **Chosen:** Follow the approved repair specification: assert bounded expected iterator sequences, and use existing Linux prlimit as Cargo's native-target test runner with 2147483648-byte address-space and zero core limits only for database-encoding mutation tests. Force the native target and exact runner in Cargo command-line arguments. Extract the existing Rust host parser for mutation and pinned coverage callers. Fail closed if host/tool/runner setup or the unmodified baseline fails.
* **Rejected:** Limiting Cargo/compiler address space; environment-only runner configuration that ambient target settings can bypass; uncapped fallback; changing mutation filters or timeout policy; a monitoring service.
* **Reason:** Three current test collections are unbounded. The user supplied measured ordinary-suite success at 2 GiB and an allocating decoder mutant. Existing Cargo runner configuration applies the bound at the executable boundary without limiting compilation. The historical runner-shutdown cause remains unproven. Prior CI artifact 34020549919 independently confirms the six PGN survivors.
* **Reversal path:** Replace this test-executable mechanism only after equivalent real Cargo fixture proof and full encoding mutant accounting; production formats and parser behavior remain outside this decision.
* **Decided by:** Codex backend-mutation repair run, 2026-09-07, implementing Felix's supplied specification · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":9,"effect_sha256":"f7d1167a0d142ba1447b17e10a9a64a381b440c4e2b39eac5602697d760c34f1","input_sha256":"3bd2b61d17f35a4c822ba073875b6948c56c4b88f3430bc94a8e2cd6a0228674","kind":"mutation-receipt","operation":"2610fec97919f84bf43a3bb948f55a70a17881b32883d162919afe8bfe49bfba","options":{"section":null},"request_id_sha256":null,"results":["d-20260907-01"],"target":"decisions-ledger","v":1} -->

### d-20260907-02 — How should encoding mutation aborts avoid desktop crash collection?

* **Question:** How should encoding mutation aborts avoid desktop crash collection?
* **Governs:** f-20260907-02, f-20260907-03
* **Chosen:** Extend d-20260907-01 with checked Linux PR_SET_DUMPABLE suppression inside the encoding test executable after exec, explicitly selected only for encoding mutation runs. Retain the exact native Cargo runner, 2 GiB address-space limit and zero core limit. Ordinary tests and production application crash reporting remain unchanged.
* **Rejected:** Global collector suppression, a background service, a pre-exec wrapper whose dumpability is reset by exec, and treating RLIMIT_CORE alone as proof against a piped collector.
* **Reason:** The completed candidate caught allocating mutants but generated two systemd SIGABRT records despite core=0. Root independently matched the allocation-failure logs and journal records for PIDs 1989588 and 2047128. This is new evidence about core suppression, not evidence establishing the historical CI shutdown cause. Interactive workflow rule 18d requires in-executable suppression for intentional abort probes.
* **Reversal path:** Replace the test-only suppression only with equivalent after-exec proof, retained failure diagnostics and demonstrated absence of core events. This extends d-20260907-01 without reversing its memory-bound or test-only scope.
* **Decided by:** Codex backend-mutation repair run, 2026-09-07 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":9,"effect_sha256":"1cdb8d801d0b8e603b38016bb5a2dac0a67905666458b21836fcab8e2d412aae","input_sha256":"49b62fdc510648d0bc155b42fba315d534b76852fa853778ea14ce779ffab69b","kind":"mutation-receipt","operation":"1429010bbdf91322d59b9dd23c6cb45f18280cf50e448b5232a76ed0d1a16c79","options":{"section":null},"request_id_sha256":null,"results":["d-20260907-02"],"target":"decisions-ledger","v":1} -->

### d-20260907-03 — How should poisoned native registries behave?

* **Question:** Should poisoned credential and download registries recover their state or refuse new operations?
* **Governs:** f-20260830-41
* **Chosen:** Credential registry and path locks return CredentialRecoveryRequired and preserve journal serialization. Account listing propagates Result through IPC. Download begin and cancel return Conflict through one lock helper; Drop alone recovers the guard for token-matched removal without clearing poison.
* **Rejected:** Empty successful account lists, blanket poison recovery, shortening credential journal lock spans, and skipping cleanup from a poisoned download registry.
* **Reason:** Credential journal state may be partial after an unwind, while a download lease must still remove only its own registration during unwind. Fresh credential-manager startup already reconciles durable intents. Reversal path: replace fail-closed operation handling only with a proven transactional recovery protocol and poison/fault tests.
* **Decided by:** Codex, autonomously under Full Auto, 2026-09-07 · **Superseded-by:** -

### d-20260907-04 — Where should HTTP client construction failures be handled?

* **Question:** Should native HTTP client creation fail at startup or defer an error to requests?
* **Governs:** f-20260830-41
* **Chosen:** Fallible constructors for both download and JSON clients, propagated by AppState::try_new to main. Existing test setup may retain cfg(test) Default. Preserve strict DNS/redirect policy and separate timeouts.
* **Rejected:** Production Default with unwrap or expect, unrestricted fallback clients, and storing deferred construction errors in every request path.
* **Reason:** Reqwest ClientBuilder::build explicitly permits TLS/resolver initialization failure despite fixed configuration. Startup already returns Result, so this gives failures one owner before publishing usable app state. Reversal path: a future explicit offline startup requirement can introduce a typed unavailable-network state with request-level tests.
* **Decided by:** Codex, autonomously under Full Auto, 2026-09-07 · **Superseded-by:** -

### d-20260907-05 — How should database statistics enforce required values?

* **Question:** Should player statistics keep distant checked unwraps or bind required values at validation?
* **Governs:** f-20260830-42
* **Chosen:** Bind required metadata, parsed result and the selected player rating through Option propagation before move replay; missing opponent rating remains allowed.
* **Rejected:** Comments linking distant guards to unwraps or requiring both player ratings.
* **Reason:** Compiler-enforced values eliminate the maintenance panic trap while preserving the existing filter semantics. Reversal path: any future statistics eligibility change must explicitly revise row filters and both-color SQLite regression cases.
* **Decided by:** Codex, autonomously under Full Auto, 2026-09-07 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":26,"effect_sha256":"a9debdc014a4d5859bbefdb55c30099c7b0afac0c2a4a875fca6dd70d6de0558","input_sha256":"b2c7af80b1eb80af4d3f4bd3771a2a9610f80f88d63695409b61649ba5314e2b","kind":"mutation-receipt","operation":"50cc9b7e607e7d9310bf7acbd880fa15d45bb059575133285797f7e2f945adae","options":{"section":null},"request_id_sha256":null,"results":["d-20260907-03","d-20260907-04","d-20260907-05"],"target":"decisions-ledger","v":1} -->

### d-20260907-06 — How does ChessFable branding preserve installed data and launch compatibility?

* **Governs:** f-20260830-48
* **Question:** Which names change in the dedicated app rebrand, and which remain compatibility identities?
* **Chosen:** ChessFable for the product/window/UI name, chessfable for Cargo/npm and the executable, and Felix Beck for bundle publisher. Preserve com.chessriddle.encroissant and its development variant, upstream authorship and modification notices, existing log/trash/MIME names, and a bin/en-croissant executable symlink in local installations. Install resources under lib/ChessFable to match Tauri PackageInfo.name. Derive installer names from the Tauri config.
* **Rejected:** changing the application identifier again; leaving mismatched build and public package names; breaking existing launchers when the executable moves; retaining scattered renderer identity literals.
* **Reason:** d-20260903-09 already settles the public name and permits the dedicated rebrand. d-20260830-16 and d-20260830-17 settle persisted and OAuth identity. The local Tauri source resolves resources using PackageInfo.name exactly, and CLAUDE.md documents the daily launcher at current/bin/en-croissant. A compatibility symlink preserves that existing consumer and rollback to older installations without a new running helper.
* **Reversal path:** a future brand change updates the config and shared renderer identity with their consumers; remove the compatibility symlink only after the old launcher/install path is no longer used. Any identifier migration requires a separate data/credential migration decision.
* **Decided by:** Codex, autonomously under full auto, 2026-09-07 · **Superseded-by:** -

### d-20260907-07 — Where do ChessFable support and source links lead before a dedicated site exists?

* **Governs:** f-20260830-48
* **Question:** Does the fork need a new website to stop sending its support traffic to upstream?
* **Chosen:** use the existing felixabeck/en-croissant GitHub repository for About, error reporting, issue search, contributions, package source metadata and native documentation. Preserve explicit upstream attribution and label any retained upstream documentation as such. Use one shared renderer identity module for the live consumers; delete src/utils/http.ts and its startup initialization because apiHeaders has no caller, updating the direct App.test.tsx consumer too.
* **Rejected:** introducing a website or background service; presenting upstream issues or Discord as fork support; rebranding an unused HTTP header API whose output reaches no request or retaining its pointless startup call.
* **Reason:** the existing fork repository is already the reviewed push destination and provides those public surfaces without new infrastructure. Source tracing found a native documentation command and a bug-form issue-search link in addition to the renderer links named by the finding.
* **Reversal path:** point the shared links and native fixed destination at an explicitly established project site when one exists; retain fork-specific support routing and attribution.
* **Decided by:** Codex, autonomously under full auto, 2026-09-07 · **Superseded-by:** -

### d-20260907-08 — Can the identity package ship before the existing platform decision?

* **Governs:** f-20260830-48
* **Question:** How can this run progress while the release-platform decision f-20260830-06 remains unanswered?
* **Chosen:** implement and verify the independently committable product-identity package, preserving all current platform configuration. Leave the distribution portion and full finding closure pending the existing platform decision and a separately authorized release publication. No updater or manifest-trust surface changes until its complete replacement can be verified.
* **Rejected:** declaring Linux-only by changing the release matrix; silently ignoring the known non-Linux release failures; marking f-20260830-48 handled after branding alone; replacing a live manifest endpoint with an unavailable fork endpoint.
* **Reason:** d-20260830-15 sequenced this work and d-20260903-09 resolves its former name prerequisite. f-20260830-06 still records an actual product choice over supported platforms; the code cannot answer it. Branding and preserving native data identity do not choose a platform policy.
* **Reversal path:** when Felix answers f-20260830-06, resume the distribution package under that answer and verify signing, manifest hosting and the supported release targets before closing f-20260830-48.
* **Decided by:** Codex, autonomously under full auto, 2026-09-07 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":29,"effect_sha256":"75d9482e1bbb0eef9fabe56fb00c64d425cf5d385f367429f6f69fe81a1688b2","input_sha256":"ca9a9ad53abcc71b154c488fd2c10bb803e947fadb8d82d0c2790ef61c975188","kind":"mutation-receipt","operation":"d091d37102bcaa331b0e764a4f8b6a51702459f5c6321899405bd693b3e8d5a1","options":{"section":null},"request_id_sha256":null,"results":["d-20260907-06","d-20260907-07","d-20260907-08"],"target":"decisions-ledger","v":1} -->

### d-20260907-09 — How do local installs stay serialized and bounded without deleting foreign releases?

* **Governs:** f-20260830-48
* **Question:** How should the installer protect current/previous publication and retire old releases?
* **Chosen:** hold a kernel flock for the install root throughout build, pointer snapshots, publication and cleanup. Retire only recognized managed releases after successful publication, keeping current and previous; preserve unrelated directories and arbitrary pointer destinations. Derive all desktop identity fields from the parsed product name.
* **Rejected:** unsynchronized snapshot restoration; broad deletion of every unreferenced directory; unbounded retention of each new installation; a persistent watcher or service.
* **Reason:** cumulative review established a concrete two-process stale-rollback race and the lost bounded-retention behavior. A one-off flock closes the race without a background tool, while explicit managed ownership separates safe retirement from foreign files.
* **Reversal path:** replace flock only with an equally verified ownership-aware transaction; change retention only with explicit cleanup and rollback regression proof. No product behavior or platform support policy changes.
* **Decided by:** Codex, autonomously under full auto, 2026-09-07 · **Superseded-by:** -

### d-20260907-10 — What constitutes success in the real-app verification harness?

* **Governs:** f-20260907-06
* **Question:** Can missing protocol, process-monitoring or cleanup evidence count as successful verification?
* **Chosen:** require valid WebDriver response envelopes, propagate process inspection failures, and reject shutdown when owned process groups survive or cleanup fails. Preserve best-effort cleanup of remaining resources and idempotent shutdown. Route harness failure tests through the unconditional contract gate.
* **Rejected:** malformed JSON as undefined success; failed process inspection as an empty process set; log-only surviving process groups.
* **Reason:** these loaded verifier dependencies determine whether this run can prove actual native startup and teardown. Missing evidence cannot establish process absence or completed cleanup. This is a technical verification contract, not a change to supported platforms.
* **Reversal path:** alternate monitoring/protocol transports must preserve explicit failure outcomes and the same executable regression proof.
* **Decided by:** Codex, autonomously under full auto, 2026-09-07 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":19,"effect_sha256":"2a816c6a06b8d705daf2f34336541198b3292098268d2d20ee8920a4632768e1","input_sha256":"4e161eab9edc714e6617ea4af2944c01d97345114c3a0169577b0f2e4d0ebd40","kind":"mutation-receipt","operation":"6e7a101a6424a6dcbc0c27644ac563fc6dd2fe3afc6a950b287bd105a0e5456d","options":{"section":null},"request_id_sha256":null,"results":["d-20260907-09","d-20260907-10"],"target":"decisions-ledger","v":1} -->

### d-20260907-11 — How is static renderer product identity represented?

* **Question:** How should static product values be shared without changing the executable-code coverage contract?
* **Governs:** f-20260830-48
* **Chosen:** Keep the renderer product name and repository URL in a shared JSON metadata file; derive the issue-form URL at its sole consumer. Retain consistency and rendered-link tests. This refines d-20260907-07 without changing its support destination.
* **Rejected:** Rewriting the coverage baseline signature or relocating constants into an unrelated covered code domain to clear the new-module mapping failure.
* **Reason:** These two values are static product metadata, with no executable behavior to instrument. JSON is already a supported data input in this renderer. Existing source coverage scope, numeric baselines and floors remain byte-identical. Reversal path: if product identity gains executable behavior, introduce a properly assigned production module with explicitly reviewed measurement ownership.
* **Decided by:** Codex, next-finding/build full-auto session, 2026-09-07. **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"2d3e77d1aa4075ca1eebb43f6547f69b461acc5aa621b2584ead36433a8f5bb8","input_sha256":"b7e8b6c4e494209a2ad3ef49b158a5cf701ce9101d59a8c8ea540463cde9ed1e","kind":"mutation-receipt","operation":"41ea7bc0d6cbd992fe6e6748dbd7dcf9e4ebd37cef704d7e6b79cfe2c2e9bb8c","options":{"section":null},"request_id_sha256":null,"results":["d-20260907-11"],"target":"decisions-ledger","v":1} -->

## 2026-09-08 — recorded through the decisions lock

### d-20260908-01 — How are engine and game lifecycle locks reclaimed without splitting exclusion?

* **Question:** How are engine and game lifecycle locks reclaimed without splitting exclusion?
* **Governs:** f-20260830-52
* **Chosen:** Share a crate-private Tokio keyed-lock lease in `src-tauri/src/infra/keyed_locks.rs`. Acquisition and final release use the same map-entry guard. The non-cloneable lease exposes borrowed mutex guards only; it releases its own Arc while the entry guard is held and removes a sole map reference. Both engine and game transitions use this lease.
* **Rejected:** unconditional deletion (concurrent owners split their lock), weak values without key removal (historical keys still leak), periodic sweeps (unnecessary deferred cleanup), and fixed stripes (unrelated keys block each other).
* **Reason:** retained entry count tracks outstanding leases, including holders and waiters, and reaches zero after quiescence without a background helper. Reversal path: replace only with a design proving same-key exclusion, independent-key progress, waiter cancellation and zero historical retention under concurrent final release/reacquisition.
* **Decided by:** Codex, autonomously under full auto, 2026-09-08 · **Superseded-by:** -

### d-20260908-02 — What keeps completed-game latest-session metadata alive?

* **Question:** What keeps completed-game latest-session metadata alive?
* **Governs:** f-20260830-52
* **Chosen:** Retain latest metadata only for live session keys or retained completed snapshot keys; keep the existing 128-snapshot cap. Tombstones need retention only while an older snapshot for that key remains. Publish/remove live and latest entries atomically under the completed mutex, recheck exact session at completion, and prune on completion, abort, replacement and shutdown fallback.
* **Rejected:** an independent TTL/FIFO for latest metadata (a second policy and possible active eviction), unconditional tombstone deletion (can expose older snapshots), and retaining Active records before awaiting registration (cancelled publication leaks metadata).
* **Reason:** metadata lifetime follows the state it protects. Missing metadata fails with GameNotFound; a retained newer identity rejects stale sessions. Reversal path: preserve exact stale-session rejection and the key-set bound by live keys plus retained snapshot keys, including cancellation and failed replacement, before changing retention policy.
* **Decided by:** Codex, autonomously under full auto, 2026-09-08 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":17,"effect_sha256":"c25e937e6811885af0a40454a046aa0d1414cc1b3202955d1014ef7a8d233ed8","input_sha256":"21b14a42a9b0e8819c1cd07a22b5a5ee211890fee2788e4a524a9cdfa9a47860","kind":"mutation-receipt","operation":"11ed2365c8bc06a8d296140c59743d61314c815a1950a548102f1e56c40293a7","options":{"section":null},"request_id_sha256":null,"results":["d-20260908-01","d-20260908-02"],"target":"decisions-ledger","v":1} -->

### d-20260908-03 — How should interactive engine searches identify their producer before events arrive?

* **Question:** How should interactive engine searches identify their producer before events arrive?
* **Governs:** f-20260831-09, f-20260903-01
* **Chosen:** Reserve an opaque native generation before starting the fresh actor; carry it on results and generation-qualified automatic stops. Missing terminal reservations share an invalid-or-expired error, with stale renderer attempt suppression.
* **Rejected:** Renderer-only epochs, first-observed event identity, or historical terminal records solely for distinguishing expired tokens.
* **Reason:** Events may arrive before the start promise returns, and a delayed start must not resurrect a stopped reservation. Each interactive request already creates a fresh actor, so one generation covers both producer and search. Reverse only with equivalent ordering and rejection proof.
* **Decided by:** Codex drain 52f8d250-54f7-410c-a395-5187c124ada0 · **Superseded-by:** -

### d-20260908-04 — How should tab closure prevent engine work that has not yet published?

* **Question:** How should tab closure prevent engine work that has not yet published?
* **Governs:** f-20260831-09, f-20260903-01
* **Chosen:** Transient native admission cancellation under the publication barrier plus synchronous renderer close intent in the live tab store. Keep prepared reservations bounded and remove all operation-owned state on its terminal path.
* **Rejected:** Permanent closed-tab tombstones or moving preparation ahead of stop without a renderer close boundary.
* **Reason:** Native admissions cover spawned actors waiting for publication; close intent also reaches the debounce interval before native admission exists. A suspended React transition cannot re-enable a removed tab. Reverse only with bounded retention and proof across both intervals.
* **Decided by:** Codex drain 52f8d250-54f7-410c-a395-5187c124ada0 · **Superseded-by:** -

### d-20260908-05 — What acceptance evidence covers search ownership in this drain?

* **Question:** What acceptance evidence covers search ownership in this drain?
* **Governs:** f-20260831-09, f-20260903-01
* **Chosen:** Agent-owned deterministic supervisor and renderer race tests, pinned Playwright screenshots, and the real off-screen Tauri lifecycle harness.
* **Rejected:** Requiring Felix to repeat deterministic races manually or treating typechecking as UI proof.
* **Reason:** Full auto assigns acceptance to the agent. The existing harness proves real startup/IPC/shutdown but cannot register an engine through native GTK; controlled actor tests prove the engine interleavings. Revisit when the harness gains live-engine registration.
* **Decided by:** Codex drain 52f8d250-54f7-410c-a395-5187c124ada0 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":26,"effect_sha256":"10851d30b7e71fd518271c02151543327780f45fe9d58a9f298d57aa0d0ff3c6","input_sha256":"f1f2553b1804133a7011ee229f76a70ff859ec3bed69f8aa95a1b6945baf59c4","kind":"mutation-receipt","operation":"03a52cca57587ef53c1c2cf9d4194cb70928ba68a4f4cad6a8e71fe5102185f3","options":{"section":null},"request_id_sha256":null,"results":["d-20260908-03","d-20260908-04","d-20260908-05"],"target":"decisions-ledger","v":1} -->

### d-20260908-06 — How should the renderer represent a terminated native game?

* **Question:** How should the renderer represent a terminated native game?
* **Governs:** f-20260901-22, f-20260901-23
* **Chosen:** Keep the existing gameOver UI state and relinquish abortable native session ownership at authoritative termination, preserving the final board and result.
* **Rejected:** Retaining the completed native identity as though it remained abortable, or adding a persisted terminal-session schema.
* **Reason:** GameManager removes completed games from its live map and retains snapshots separately; native abort targets only live exact sessions. The existing UI already represents completion. Reversal: introduce a distinct retained terminal identity only if a consumer requires it, with completion/reset/close regression proof.
* **Decided by:** Codex drain 0b810ced-b5af-451c-aaaf-d41acd0fc87d, autonomously · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"3544c5cea4530c821008961f3007286d0f11b49d4b7217e9a03fa88d129cbfcd","input_sha256":"f7bcacd8b34884505620f7e1d3610150b3b03b4244a44cb0d4e6015b7a20e118","kind":"mutation-receipt","operation":"a50d1c62b78b7936f1e23c5341af326bb94cc2de045bd6f1dcc3fb227ab82752","options":{"section":null},"request_id_sha256":null,"results":["d-20260908-06"],"target":"decisions-ledger","v":1} -->

### d-20260908-07 — Which exact-session abort failures count as successful absence?

* **Question:** Which exact-session abort failures count as successful absence?
* **Governs:** f-20260901-22, f-20260901-23
* **Chosen:** Treat only normalized backendCategory missing-resource as successful absence. Preserve and surface every other cleanup failure, retaining the exact owner for retry.
* **Rejected:** Matching error-message text, accepting the broader normalized not-found category, or making native abort globally idempotent.
* **Reason:** Completed native sessions are absent from the live map, while a session mismatch is a distinct conflict. The transport preserves structured backend categories. Reversal: move exact absence semantics into native abort only with native identity/refusal tests.
* **Decided by:** Codex drain 0b810ced-b5af-451c-aaaf-d41acd0fc87d, autonomously · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"a11db9cc1934696b5c7aed37f987f9c6f83b236ce12eb0492f5fb1a0b6fb1015","input_sha256":"2fcca7ad201db51bfcc8a0a12df946954aba0149062a8594f3575924e07399f5","kind":"mutation-receipt","operation":"5ef0f3db5a2368ad628694df7009b2b9377424f0a890bb8e0a12b30155bbe943","options":{"section":null},"request_id_sha256":null,"results":["d-20260908-07"],"target":"decisions-ledger","v":1} -->

### d-20260908-08 — How should tab close own a game start whose native identity has not returned?

* **Question:** How should tab close own a game start whose native identity has not returned?
* **Governs:** f-20260901-22, f-20260901-23
* **Chosen:** Bind game state to immutable owner-tab primitive atoms and share a runtime per-tab pending-start promise. Closing intent blocks new admission synchronously; close waits for existing admission before exact cleanup and atom disposal. Failed cleanup retains its exact native identity.
* **Rejected:** Component-only pending refs that disappear on unmount, or delayed writes through currentTabAtom that can target a replacement tab.
* **Reason:** BoardsPage unmounts inactive panels, and the current tabValue setter resolves its owner at write time. Native start can finish after unmount. Reversal: replace the shared runtime owner only if pending-start/close, failure/retry, remount and cross-tab isolation tests remain valid.
* **Decided by:** Codex drain 0b810ced-b5af-451c-aaaf-d41acd0fc87d, autonomously · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"476daaddb3122ce9ea3b878b170b41725296269dd5202981caf3ab27c4cccc57","input_sha256":"931cb1947d780620373c292ced9995d594727057d3e77ef561e821822d0533ce","kind":"mutation-receipt","operation":"b12bc741b9d16ce3aac2028d41c28e9fcd6be749358dcba88c1ebb855b2f4e46","options":{"section":null},"request_id_sha256":null,"results":["d-20260908-08"],"target":"decisions-ledger","v":1} -->

### d-20260908-09 — Where should native game session and revision counters be normalized?

* **Question:** Where should native game session and revision counters be normalized?
* **Governs:** f-20260901-22, f-20260901-23
* **Chosen:** Normalize game-specific command and event counters at the platform boundary: validated safe nonnegative wire numbers become internal bigint, and outgoing expectedSession becomes a validated safe number. Type start configuration integer fields as their existing numeric wire values through an explicit facade input type. Reject unsafe or malformed values through guarded command/listener error paths; event failures retain raw identity context for stale filtering. Bound native session allocation before admission so refusal cannot hide a newly created session.
* **Rejected:** Trusting generated bigint declarations to transform JSON, recursively converting all IPC bigint fields, or accepting rounded counters beyond Number.MAX_SAFE_INTEGER.
* **Reason:** A real WebKitGTK probe of the installed native binary returned numeric session/revision and rejected a bigint expectedSession with JSON.stringify cannot serialize BigInt. Generated bindings provide types, not conversion. Reversal: adopt a lossless native string-counter contract if the valid range must exceed JavaScript safe integers.
* **Decided by:** Codex drain 0b810ced-b5af-451c-aaaf-d41acd0fc87d, autonomously · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"f27514ef01861380cd9e3ca117cc1d8af02fdc2b12994f1a72c19c54f99a1303","input_sha256":"202ff3fd045212d19b1eccc3552ce4bc7111ac3249d3d1408845a17553d6a32c","kind":"mutation-receipt","operation":"726874f9f88b5b2eba6a395757ecd2bf1bf0b65a636bc000ae4064f1103dd28e","options":{"section":null},"request_id_sha256":null,"results":["d-20260908-09"],"target":"decisions-ledger","v":1} -->

### d-20260908-10 — Where should the game wire helpers live under the measured platform boundary?

* **Question:** Where should the game wire helpers live under the measured platform boundary?
* **Governs:** f-20260901-22, f-20260901-23
* **Chosen:** Keep the shared game counter normalizers and GameConfigInput in src/platform/tauri.ts, alongside their command/event consumers; retain focused gameTransport.test.ts coverage of the exported pure helpers. Remove the extra production module after moving its implementation unchanged.
* **Rejected:** Placing platform logic in an unrelated already-globbed directory, excluding the new helper from coverage, weakening the gate, or re-recording baseline measurements to pass.
* **Reason:** The coverage area enumerates existing platform modules and its exact scope is pinned. The facade already owns every game wire conversion, so keeping the shared implementation there is a cohesive boundary without a second production module. This preserves d-20260908-09 and all measured counters/floors. Reversal: extract a dedicated module when a deliberate coverage-scope expansion contract and a separate production consumer justify it.
* **Decided by:** Codex drain 0b810ced-b5af-451c-aaaf-d41acd0fc87d, autonomously · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"a18b3e79f27882ef90c3490362dab4e284e09e9021814e404f5a0f543a43e87b","input_sha256":"63cbd703f7199ac07d33621b3e664684207167159062fc88ed495f12c8f65771","kind":"mutation-receipt","operation":"4d6cb06378c669a2ba74edc39a4307f9ef52dd3c23a067b6f828b54b55a5bd9a","options":{"section":null},"request_id_sha256":null,"results":["d-20260908-10"],"target":"decisions-ledger","v":1} -->

### d-20260908-11 — Does the blocking-work-not-offloaded pickup share one implementation contract?

* **Question:** Should the two current findings under blocking-work-not-offloaded be implemented in one build, or sliced by their independent source contracts?
* **Governs:** f-20260904-01, f-20260904-05
* **Chosen:** Execute the oldest finding f-20260904-01 as a build-tier activation slice across infra/path_authority.rs, fs.rs and the structural tests in main.rs. Keep f-20260904-05 open at build tier for its native job-lifecycle contract. The pickup annotation on f-20260904-05 records valid gateway evidence; its statement that this run includes that repair is superseded by this scope decision.
* **Rejected:** Combining every offloaded command, the progress store, engine cancellation, tab teardown and shutdown with artifact activation merely because both carry the historical offload root. Also rejected: weakening activation to compare a caller digest with its own reservation, or treating gateway permit ownership as sufficient to close cancellation.
* **Reason:** Source tracing and two Gemini probes show independent invariants: activation verifies a journal-bound published descriptor and commits a capability; cancellation determines which native owner may stop a worker and where mutation may safely stop. Neither fix requires the other: activation can run prepare/hash/commit on the existing blocking gateway while releasing the authority mutex around hashing. The gateway design changes no artifact reservation semantics. Following the file-set slicing rule in next-finding and the precedent d-20260904-23, take the oldest independent slice; no severity or effort ordering is used. Reversal path: combine them only if implementation evidence shows the activation split depends on a new cancellation-owner contract.
* **Decided by:** Codex, autonomously for this full-auto request · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"f4eb5b4d26ff0c3dfad5907672a3cb90ca7c7802ca40e3312c3169b221a209ca","input_sha256":"73f84b548ecf8e45e81de3e39301a3d05d2280057d3b45d1ffac7b4510c64869","kind":"mutation-receipt","operation":"7963a6b298ca93c28aba93675af553e9ac7beda78ba256ff3f7c1ce97c0a1557","options":{"section":null},"request_id_sha256":null,"results":["d-20260908-11"],"target":"decisions-ledger","v":1} -->

### d-20260908-12 — How is published artifact verification moved outside the authority lock?

* **Question:** How can runtime activation release the authority mutex during the published-file hash without weakening the journal-bound capability grant?
* **Governs:** f-20260904-01
* **Chosen:** One shared blocking worker performs prepare and marker persistence under the authority lock, hashes a retained no-follow descriptor outside the lock, and reacquires the lock to compare the complete pending-intent snapshot, root and current/retained inode change stamps before committing. Prepared descriptor evidence and content-verified activation evidence are distinct private types. Both runtime callers use the same helper. Startup recovery reuses the primitives synchronously before the authority is shared. Failed verification retains quarantine. Recovery logs only an opaque reservation ID and error category; failed progress reporting cannot replace the primary activation error.
* **Rejected:** Comparing caller-supplied digests; holding the mutex while hashing on the blocking pool; dropping the mutex without revalidating the current basename and pending intent; separate per-caller implementations; three separate gateway hops; abandoning already-published intent on verification error; introducing asynchronous startup readiness solely for this synchronous, exclusively owned recovery phase.
* **Reason:** The reservation digest is evidence of staged bytes, while activation must independently verify the published inode. A retained descriptor prevents inode reuse but does not establish that the basename still names that inode when the registry is committed, so commit revalidates both authorities. This preserves d-20260903-08 descriptor provenance and d-20260903-04 non-nesting. Reversal path: any replacement must prove descriptor provenance, stale-intent and basename rejection, off-lock hashing and recovery/durability semantics with the same adversarial cases. The external filesystem can still change after final validation; no filesystem/registry atomicity is claimed.
* **Decided by:** Codex, autonomously for this full-auto request · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"b67d65ae55ab1410c74da68b52f7415ee55725853652b99d4f029358ec445554","input_sha256":"a8aadb1c5b7b3e96586a1d6e9b1ad678b6360e54e7d7ffc379ed0d8fade50082","kind":"mutation-receipt","operation":"b112150e950d2f8e9ad87a8ca9fa8cabe41227a3b41cb36d1d2f3e40f8f88c03","options":{"section":null},"request_id_sha256":null,"results":["d-20260908-12"],"target":"decisions-ledger","v":1} -->

### d-20260908-13 — Which owner controls cancellation of native blocking operations?

* **Question:** Which owner controls cancellation of native blocking operations?
* **Governs:** f-20260904-05
* **Chosen:** Native single-use reservations bound to a webview identify transient read invocations; renderer AbortSignals cancel only the caller's reservation or claimed operation. Accepted mutations and explicit accepted read actions retain native completion ownership through worker and cleanup. Bounded shared leases track queued/running operations; progress IDs, eviction and clear remain display-only. The gateway derives child cancellation tokens and keeps its permit in the worker until it exits. Commit tails report their actual outcome even after late cancellation.
* **Rejected:** Tab/progress IDs as cancellation identity (reused or evicted), blanket renderer-unmount cancellation of accepted writes, unbounded tombstones/background reapers, and dropping worker join handles as evidence of cancellation.
* **Reason:** The current spawn permit is dropped with its awaiting future although the worker remains alive. Tauri promise abandonment does not itself communicate native cancellation. Existing import ownership is application-wide and workspace deletion requires post-worker engine retirement. The reviewed plan tests pre-start cancellation, stale IDs, parent/sibling isolation, abandoned results, bounded admission and shutdown drain. Reversal requires equivalent identity/lifetime and commit-outcome proof; existing d-20260903-04 non-nesting and d-20260908-12 activation durability remain binding.
* **Decided by:** Codex interactive f-20260904-05 build run, 2026-09-08; plan authorship and arbitration shared one context · **Superseded-by:** -
### d-20260908-14 — How can transient SQLite reads be interrupted through supported APIs?

* **Question:** How can transient SQLite reads be interrupted through supported APIs?
* **Governs:** f-20260904-05
* **Chosen:** Install SQLite's public static auto-extension/progress callback through existing rusqlite::ffi before the two DatabaseRepository connection factories open connections. Activate cancellation only in a synchronous thread-local read scope, restored by RAII after every exit; map only that scope's actual interruption to Cancellation. Preserve existing Diesel queries, pool/pinned ownership and schema/mutation behavior.
* **Rejected:** Diesel private-pointer/layout access, pinning unreleased Diesel solely for its new progress API, a second SQL read adapter/pool, an interrupt watcher per query, and incidental live-WAL snapshot/repository redesign.
* **Reason:** Installed Diesel 2.1.4 lacks a public wrapper, but its shared SQLite exposes documented auto-extension and progress APIs. Root's compiled probe against installed Diesel/libsqlite3 interrupted a real recursive query after two VM callbacks and then successfully reused that connection outside the cancelled scope. Codex probe-6 confirmed API/ABI and factory coverage. A separate pathname adapter would introduce the A-B-A opening flaw flagged by security; full snapshotting would require the separate f-20260905-03 repository design. Reversal is supported when Diesel exposes an equivalent supported callback wrapper, preserving scope isolation, actual query interruption and cleanup proof.
* **Decided by:** Codex interactive f-20260904-05 build run, 2026-09-08; supported API probe by Codex under the selected Gemini routing · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":16,"effect_sha256":"7899639fe2f25e038b38560a608652d4cd1da06432479fea10faba028ad9ea5e","input_sha256":"3d3f80b25f347b763c0ba6236d7193a5ef4e32046888172cf2750e6246e7fde8","kind":"mutation-receipt","operation":"8727530cfc0620fe4664b383ffeaf148e7ca420b04c1244331fc0f851a9dabb4","options":{"section":null},"request_id_sha256":null,"results":["d-20260908-13","d-20260908-14"],"target":"decisions-ledger","v":1} -->

## 2026-09-09 — recorded through the decisions lock

### d-20260909-01 — How should biggest-gap traversal compare opponent positions with descendants?

* **Question:** How should biggest-gap traversal compare opponent positions with descendants?
* **Governs:** f-20260906-03
* **Chosen:** Compare every eligible opponent position using its existing missing-games count, independently of descendant eligibility. Keep coverage/game pruning, strict start-path exclusion and the existing tie-break order.
* **Rejected:** Keep descendant-based suppression, or change the coverage producer to compensate for the selector.
* **Reason:** The coverage producer already assigns an opponent position the largest missing immediate reply count. Suppressing that position before the maximum comparison loses a valid larger candidate; changing the producer would conflate independent quantities. The regression tests demonstrate the wrong descendant selection before the repair. Reverse by changing the candidate contract and its tests together if the meaning of biggest gap changes.
* **Decided by:** Codex interactive next-finding run, 2026-09-09, Gemini executor · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"fb94fe130615a5afd1132b690b9b7fcd47acf7423793f0c643ed39296f0507d5","input_sha256":"05d412ea034f60eaa9227a1efc970778abfee48e365529d6f5722cb79abec53b","kind":"mutation-receipt","operation":"70dfe1f89442df6a76a6af71b0878954520b79404b740bd5248e4f834bd7a792","options":{"section":null},"request_id_sha256":null,"results":["d-20260909-01"],"target":"decisions-ledger","v":1} -->

### d-20260909-02 — How does an active game recover a lost native event?

* **Question:** How does an active game recover a lost native move, clock or terminal event without retaining a native retry owner after completion?
* **Governs:** f-20260908-03
* **Chosen:** Reuse the existing exact-session GameState query and mounted BoardGame owner. Query immediately, then one second after settlement, with one outstanding periodic query, owner/generation/close guards, capped outage backoff and one notification per outage. Native events remain best-effort low-latency attempts with a shared, bounded per-kind/session diagnostic path and safe Tauri error labels. Recovered premoves require a strict forward move-list extension and the authoritative next human turn. Terminal receipt or a finished snapshot preserves existing gameOver behavior and relinquishes abortable identity.
* **Rejected:** Manual refresh as the recovery mechanism, logging alone, native retry/ACK queues, retry tasks surviving the game loop, indefinite completed-snapshot retention, and premoves on takebacks or rewritten lines.
* **Reason:** The existing native manager already supplies exact live/completed snapshots and owns engine teardown. Reusing it recovers event loss even when no later event arrives, without another resource lifecycle. The timer is removed by its component/session cleanup. Preserve d-20260908-02 and d-20260908-06 through d-20260908-10. Recovery requires a responsive command channel and a retained exact snapshot; renderer suspension, permanent IPC failure and snapshot eviction remain explicit limits. Reversal path: replace the query loop only with an acknowledged replay/snapshot protocol proving dropped move/clock/terminal recovery, bounded retention, exact-session isolation, and teardown, while preserving existing product behavior.
* **Decided by:** Codex, autonomously under full auto with Gemini executor, 2026-09-09 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"3c191b3b2ed5968b6f712d9aac9ab1c6a4412d901e2865cf4e71cbc88227fb46","input_sha256":"4c34078ed365d34afd89613d055cf55a5d6370f4561ccee4941c188bbc779613","kind":"mutation-receipt","operation":"877bf43096999fe26b2a6a5a02b91430ea3120cc62447f78e552f21ca2821a93","options":{"section":null},"request_id_sha256":null,"results":["d-20260909-02"],"target":"decisions-ledger","v":1} -->

### d-20260909-03 — How does native game reconciliation preserve annotations while replacing its mainline?

* **Question:** How does native game reconciliation preserve annotations while replacing its mainline after a takeback or rewritten continuation?
* **Governs:** f-20260908-03
* **Chosen:** Reconcile through existing tree actions from the longest retained UCI prefix. Preserve headers and metadata on retained nodes, plus side variations branching before the authoritative endpoint. Remove obsolete continuations beyond that endpoint so the resulting mainline equals the exact native move list immediately, including when deleting the old main move would promote a sibling or a reused alternative has a longer tail.
* **Rejected:** Resetting the entire tree from its initial FEN; deleting only the former main child and allowing an old variation to become an extra live move; adding a second native/game-tree representation solely for reconciliation.
* **Reason:** The cumulative chess-semantics review showed that resetting erased retained comments, NAGs, shapes and scores. Root inspection of deleteMove showed sibling promotion could instead leave a stale continuation. Existing tree actions preserve earlier metadata while pruning the obsolete tail. Children beyond the native endpoint are outside the authoritative played prefix. This refines the implementation of d-20260909-02 without reversing its delivery contract. Reversal path: any replacement must prove exact native mainline, retained-prefix metadata and earlier side-variation preservation against the real tree store, including takeback with endpoint siblings and reuse of an alternative with a longer tail.
* **Decided by:** Codex, autonomously during cumulative repair, 2026-09-09 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"4a4a194c37bb0e8fa5673bd54dcb355a89abd8119152f80b95a1d63b387fcd4a","input_sha256":"8a885ce81c35b63ae8204e742efee2b3d0cb68866cf994d2911871448c1531c4","kind":"mutation-receipt","operation":"3c9c50774afdf113354d6893ff6357950e22f5e67cf723a0d9fcd95b31ffd5ec","options":{"section":null},"request_id_sha256":null,"results":["d-20260909-03"],"target":"decisions-ledger","v":1} -->

## 2026-09-10 — recorded through the decisions lock

### d-20260910-01 — Which string is the local launcher identity built from?

* **Question:** Should the installer's desktop entry keep launching the bin/en-croissant compatibility symlink and be named after productName, or launch the real binary and be named after mainBinaryName?
* **Governs:** f-20260910-01
* **Chosen:** Derive the entry basename and StartupWMClass from mainBinaryName and point Exec at bin/chessfable, so the Wayland app id, the desktop file name, the StartupWMClass and the launched binary are one string. Keep creating bin/en-croissant as a compatibility symlink for older references and rollback, and stop treating it as the launch path. Retire any other regular-file desktop entry whose Exec points into the install root, leaving symlinked entries to whoever installed them.
* **Rejected:** Keeping Exec on the compatibility symlink and setting StartupWMClass to en-croissant, which also fixes the duplicate but freezes the retired upstream name into the launcher identity that the 2026-09-07 rename existed to shed.
* **Reason:** A GTK window takes its Wayland app id from argv[0]. Measured on 2026-09-10 through a KWin script over workspace.windowList(): before the change the window reported resourceClass en-croissant, resourceName chessfable, desktopFileName en-croissant; after it, all three read chessfable. Plasma resolves a window to a launcher by that id first and by StartupWMClass second, so both matching steps now agree. The rejected option's only advantage was rollback to a pre-rename release layout, and no such release exists on disk: both installed releases carry bin/chessfable, and the installer prunes legacy ones. Reversal path: set DESKTOP and StartupWMClass back to product_name and Exec back to the compatibility symlink, then repoint the Plasma pin, which is the only state outside the installer's control.
* **Decided by:** Claude Code interactive session, 2026-09-10 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"e004067ff5aca707b20b8ed7772d14ab8b1d4f4493037ee2812a74812af994cf","input_sha256":"d1c052bc5f7d9f6c2de5485e2949843adfe1516c88313be9581ac2f85dc2b8fc","kind":"mutation-receipt","operation":"8b4179aa1f513c4644ca3ce8dad180c6a85514cd5c1eed043ec597f0a5372447","options":{"section":null},"request_id_sha256":null,"results":["d-20260910-01"],"target":"decisions-ledger","v":1} -->

### d-20260910-02 — Which en passant condition supplies the Polyglot lookup FEN?

* **Question:** Should the private Polyglot lookup FEN include only legal en passant captures, every double-push target, or targets attacked by a pawn regardless of king safety?
* **Governs:** f-20260829-10
* **Chosen:** Use Shakmaty's `EnPassantMode::PseudoLegal` only in `try_polyglot_book_move`. Retain the existing legal-move filter and `Legal` state/repetition serialization. Execute at lens tier with chess-semantics review after source-based Entry revalidation.
* **Rejected:** `Legal` loses the ep hash component when an attacking pawn is pinned; `Always` hashes targets with no attacking pawn because polyglot-book-rs does not check the condition itself. Replacing the hasher or changing every FEN site adds unrelated behavior changes.
* **Reason:** The installed polyglot-book-rs 0.1.0 FEN parser stores the provided ep file and its hash function XORs it unconditionally. Shakmaty 0.27.1 supplies the required pawn-attack condition under `PseudoLegal`. The lookup FEN is local to one caller, and its state-reporting siblings have separate purpose-specific FENs. Fixed independent book keys and regression tests through the real loader and selector prove the boundary. Reversal path: change this adapter only if the hash dependency's contract changes, preserving the pinned-pawn, legal-capture and absent-capturer regression cases.
* **Decided by:** Codex drain 704e13a8-b0c8-4548-affd-bf628517bbdb, autonomously; plan authorship and arbitration share one context · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"a4c2bcc40614fc03fe8555b285bb679769c3e6d9880fd66c85757149dec37c59","input_sha256":"30ccc32aa86952e2488c72159c3e0928b1c14e211dace8806e83ffaa1c991786","kind":"mutation-receipt","operation":"b05d13482afac425a9f13f9caa63a7a29532047ec090238efcce7d6a1eea1c5f","options":{"section":null},"request_id_sha256":null,"results":["d-20260910-02"],"target":"decisions-ledger","v":1} -->

### d-20260910-03 — How should stable Rust be selected and updated?

* **Question:** Should required Rust gates follow stable automatically or select an exact compiler from one repository declaration?
* **Governs:** f-20260829-13
* **Chosen:** Pin 1.98.0 in rust-toolchain.toml, route local and all three Rust workflow setups through the file, and keep the existing nightly coverage pin separate. A shared strict setup script requires the file with a diagnostic, explicitly installs its toolchain with rustup toolchain install --no-self-update, then reports rustup show active-toolchain. Extend the existing tool-version parity gate rather than adding a second checker. At toolchain/dependency maintenance, check the current stable release, update the one stable pin, fix promoted lints and run the Rust, bindings and release-build proof together.
* **Rejected:** Floating required gates, independent CI version literals, plain rustup show as installation proof, and adding a dedicated unattended updater or scheduled canary solely for this finding.
* **Reason:** Floating stable let a promoted clippy lint fail an unchanged checkout. Exact 1.98.0 installed successfully with the required components and matches the current measured compiler. Plain rustup show returned 0 for a nonexistent pin; active-toolchain returned 1, including an isolated offline probe. One shared setup removes three copies of that failure contract. Pinning intentionally does not exercise future compilers until a maintenance bump. Reversal path: change the selection policy and its contract tests together when new evidence justifies a different reproducibility/update contract; a future setup primitive can replace the shared script and all callers together if it provides the same missing-file and unavailable-pin refusal.
* **Decided by:** Codex drain 704e13a8-b0c8-4548-affd-bf628517bbdb, full auto; plan authorship and arbitration share one context · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"837734ad54759ca12f7af0911abea05eb7696af59e8d9549f6a677cdaa69de7e","input_sha256":"05270a4b17713cfd1a72ff00c91832f2097392d26ba999306b11f5da96e4c231","kind":"mutation-receipt","operation":"52680f032ccb98f68eb24d9d7d4c46c5ce85c2d01e81f036b8d4c4069623d7bc","options":{"section":null},"request_id_sha256":null,"results":["d-20260910-03"],"target":"decisions-ledger","v":1} -->

### d-20260910-04 — How are confirmation failure messages retained and localized?

* **Question:** Should the confirmation modal preserve dynamically constructed category keys or translate its existing two displayed outcomes through literal calls?
* **Governs:** f-20260830-11, f-20260830-19
* **Chosen:** two literal `t` calls in `ConfirmModal.tsx`, for `Common.ConfirmationError.applied-despite-error` and `Common.ConfirmationError.unexpected`, translated in all 16 shipped catalogues. Preserve the current applied-warning/generic-failure distinction and the seven-category model from d-20260831-01 and d-20260904-06. Catalogue regression tests run after extraction with language fallback disabled.
* **Rejected:** a new dynamic-prefix preservation rule, which couples this finite branch to extractor configuration; seven identical generic catalogue entries, which create redundant copy for outcomes the current component does not distinguish; introducing category-specific UX in a localization repair.
* **Reason:** f-20260830-19 explicitly identifies the two actual outcomes and permits keeping that branch. Literal calls keep the messages at the point of use and make the extractor retain them without a parallel key registry. A two-branch locale matrix proves both message selection and catalogue availability; testing only before extraction would miss the original deletion mechanism.
* **Reversal path:** if confirmation outcomes change, revise their literal calls and catalogue matrix together, preserving post-extraction regression proof. No backend or renderer error taxonomy change is needed for this decision.
* **Decided by:** Codex, autonomously under full auto on 2026-09-10 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":9,"effect_sha256":"89a0ddbc56a00e66d968b956fedcb02670c2421713fe5870533cf49261e47a0b","input_sha256":"3d019c5da8096d5c11de30ea0fd78a422cab0a63b31c3b3139b4d62b72d72305","kind":"mutation-receipt","operation":"f1bf6c6abd0abc6b8097cdb7452dfebae7b130e8cb4fc3f14c225af8e546ae7f","options":{"section":null},"request_id_sha256":null,"results":["d-20260910-04"],"target":"decisions-ledger","v":1} -->

### d-20260910-05 — How are accent colour names retained by translation extraction?

* **Question:** How are accent colour names retained by translation extraction?
* **Governs:** f-20260910-03
* **Chosen:** literal translation calls for the current theme's finite colour set in `src/components/settings/ColorControl.tsx`, with translated values in every shipped catalogue and real-catalogue accessible-label tests after extraction. Execute this settings slice at lens tier; f-20260910-04 remains open at lens tier in the separate board file set.
* **Rejected:** adding an extractor preservation prefix or relying on English fallback; both leave the producer and extraction inventory disconnected. Rejected widening this slice to board accessibility solely because both findings share a ledger root.
* **Reason:** `docs/localization.md` already settles finite message extraction; the same approach was recorded for confirmation messages in d-20260910-04. The surfaced d-20260901-36 governs BoardGame test loading, not this colour control.
* **Reversal path:** if the theme introduces runtime-defined colours, revise the name contract and catalogue tests alongside that feature.
* **Decided by:** Codex next-finding run 2026-09-10 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":9,"effect_sha256":"e0b4f832e13e33b107de1b44ecfa5ff06c6efeb6043a5a1da8f68fe01a2cf94f","input_sha256":"29fce901c97aead99bd09905baa512a1743c8bc5bf02324d2b33c877db57f857","kind":"mutation-receipt","operation":"fc51e1f010fe3218b8c39464e9bebe018575559df608bc14ce1351ad83b9fec0","options":{"section":null},"request_id_sha256":null,"results":["d-20260910-05"],"target":"decisions-ledger","v":1} -->

### d-20260910-06 — How are board piece and colour names retained by extraction?

* **Question:** How should board accessibility retain and localize the finite chess colour and piece-role names?
* **Governs:** f-20260910-04
* **Chosen:** Literal translation calls for both colours and all six roles, translated across all shipped catalogues and tested after extraction with language fallback disabled. Reuse the colour translation for board orientation. Compose non-English labels with separate piece/side fields and a bottom-side orientation description so standalone side names do not need adjective agreement with every piece. Keep the existing board accessibility module as the production labelling seam and verify its wiring through the board-keyboard container scenario. Execute at lens tier.
* **Rejected:** Dynamic-key preservation prefixes and English default values as the remedy; both retain an unnecessary disconnect between finite producers and extraction. No change to chess move or keyboard semantics.
* **Reason:** docs/localization.md and d-20260910-04/05 already settle finite-message extraction. The surfaced d-20260901-36 governs BoardGame test loading, not this localization choice; its existing boardAccessibility extraction precedent supports a focused test without the full component graph.
* **Reversal path:** If chess roles or orientation semantics change, update the literal calls and real-catalogue matrix together, preserving the post-extraction regression proof.
* **Decided by:** Codex next-finding drain, 2026-09-10; plan authorship and arbitration share one context · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":9,"effect_sha256":"d5aba0636f99e2b9a984efec322f6ef927acd3b9c03556fdc2926a89b2a3f285","input_sha256":"5cea216f3cebd872d9ed7b70693b718d107e4f26c329778f231197f29c952170","kind":"mutation-receipt","operation":"5f10c17a8e6c982ea933e8e7887d3ea77a41128954402778711560eea4fdce9e","options":{"section":null},"request_id_sha256":null,"results":["d-20260910-06"],"target":"decisions-ledger","v":1} -->

### d-20260910-07 — How should permanent-delete warning coverage reach the real modal?

* **Governs:** f-20260830-13
* **Question:** How should permanent-delete warning coverage reach the real modal?
* **Chosen:** Extend the existing German async-errors Playwright journey and native-command fixture to cover structured partial-removal and durability failures after trashing an entry. Keep the real FilesPage, command facade and Mantine modal in the browser; record new warning screenshots in the pinned container under d-20260829-01.
* **Rejected:** A new workspace harness or product refactor, because the current suite already reaches Files confirmations with sequential workspace responses; more jsdom-only tests, because they cannot prove the modal warning is rendered and accessible.
* **Reason:** The finding's original missing infrastructure now exists. A bounded lens-tier test extension can pin the warning and refreshed trash state at 320px / 200% fonts without changing product behavior. Reversal path: move this coverage only to a harness that proves the same real modal, structured-error routing, accessibility and container-rendered pixels.
* **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"6d4c401776a75f1465d9e0029b1bc7bc54aa71297aff8e481d0dddebc8590194","input_sha256":"95be926bbc5032eb1e7b03039cd0e92f23f64232e6c15182db21008877f438bb","kind":"mutation-receipt","operation":"10137e8c95e91d993aaf3b7f038314e9624bd60c1ff8a7bd0166e76730611aa9","options":{"section":null},"request_id_sha256":null,"results":["d-20260910-07"],"target":"decisions-ledger","v":1} -->

### d-20260910-08 — How should one multi-file PGN import commit and report reader failures?

* **Question:** How should one multi-file PGN import commit and report reader failures without retaining the whole corpus or introducing partial-outcome IPC?
* **Governs:** f-20260831-07, f-20260903-04, f-20260904-03
* **Chosen:** One streamed Diesel transaction contains schema preparation, all input files, game inserts, required indexes for a new database, and metadata counts. Propagate reader/decompressor errors and retain the existing per-game Importer skip policy. Publish the in-process revision and invalidate search caches at the end of the transaction closure under the existing write lock, before commit; commit failure may conservatively invalidate. Let the repository validate/cache committed schema lazily. Single-game replacement reads the first physical game, never a later game after skipping the first.
* **Rejected:** Per-file commits with a new partial-outcome renderer contract; collecting games before insertion; keeping schema initialization outside the logical transaction (a failed first import then retried could omit required indexes); eagerly caching uncommitted schema; silently flattening reader errors. Existing explicitly deleted database indexes stay deleted. No generic IPC error redesign or malformed-game policy change.
* **Reason:** The PGN rule already mandates one transaction per logical import. The existing function already holds its write lease across all files, and BufferedReader yields one game at a time. Diesel supports nested savepoints for schema/index helpers. Reader errors and post-commit revision errors currently misrepresent committed state to the renderer. The chosen placement gives rollback on failure without a new response shape, preserving d-20260830-05's scope. Reversal requires evidence that streamed transactional import is unsuitable plus a reviewed explicit partial-outcome/retry contract; do not restore silent partial commits.
* **Decided by:** Codex, autonomously under full auto; plan authorship and arbitration shared one context, and detection ran on the same Codex family as the code. · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"f5d2bcecc70fb247e1996dcfad6ccf0e4d6c355985a12cec91f53ed8ed11e162","input_sha256":"952a34c24dcb1d6b7bf8083a30feec975cd3838393ea3238b87ffbeb1e0e1aae","kind":"mutation-receipt","operation":"3ee0fa53c077ce3f0b9ce00210d739cf9f3688350ae3ed94554e58efa016d91e","options":{"section":null},"request_id_sha256":null,"results":["d-20260910-08"],"target":"decisions-ledger","v":1} -->

### d-20260910-09 — What should getAnnotation do when the previous evaluation is absent?

* **Question:** what should `getAnnotation` do when the previous or previous-previous
  evaluation is `null`, now that a ply can legitimately publish no lines at all?
* **Governs:** f-20260831-21
* **Chosen:** `null` means "not derivable". No mistake annotation (`??` / `?` / `?!`) is
  produced without the previous evaluation, and no `!` without the previous-previous one.
  `!!` and `!?` rest on `is_sacrifice` and the current evaluation and are unchanged.
* **Rejected:** keeping the existing `prev || { type: "cp", value: 0 }` coercion and guarding
  only the array reads in `addAnalysis` — the fix shape the finding itself named. It stops the
  crash but leaves an invented 0.00 baseline, so after a lineless predecessor a strong move in
  a won position is annotated `??`. Also rejected: skipping the whole ply, which discards the
  ply's own evaluation although it is present and correct.
* **Reason:** a wrong annotation shown to the user is worse than no annotation, and it is
  silent where the crash was loud. Two consequences outside the empty-`best` case are accepted:
  the root node no longer receives a mistake annotation, and the first move of a game no longer
  receives `!` — both were derived against the invented 0.00 and were never meaningful.
  Reversal: restore the two coercions in `src/utils/score.ts`; the three tests named in
  f-20260831-21's closing note go red and say which behaviour was reverted.
* **Decided by:** Claude Code, interactive next-finding run 2026-09-10 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":20,"effect_sha256":"e0b976ba470fa9d03eccf37301de78bc52a25a5fb780e7b738a9eec509463f70","input_sha256":"f9d2f355fb43f5d6b262009c0e5a8f53b6f0456717e5fd4d17adf272649c2a9b","kind":"mutation-receipt","operation":"a9b318be9482ed2333cb88bbbb0bfc7cd00885ef97004e2d4f5f7b35c5bb7557","options":{"section":null},"request_id_sha256":null,"results":["d-20260910-09"],"target":"decisions-ledger","v":1} -->

### d-20260910-10 — How do live workspace creation and close acknowledge persistence?

* **Governs:** f-20260901-05, f-20260906-22
* **Question:** How should live workspace writes acknowledge durability across tab creation, activation and close without changing the storage backend?
* **Chosen:** one synchronous compressed workspace save receipt, publishing canonical Jotai state only after success. New-id creation and duplication share staged-tree rollback and commit tabs plus activation in one envelope write. Close saves removal before local tree/family reclamation. Keep the existing live replacement-New-Tab behavior. Propagate refused saves through save-before-close and gate producer navigation on a committed id; use a shared tested page completion wrapper. Automated container and real-app verification belongs to Codex.
* **Rejected:** a second activation save with partial success; casting a receipt through atomWithStorage's void result; a new IndexedDB backend, whole-tree envelope, transaction journal, or background helper; deleting a tree before metadata commit; mutating the previously acknowledged tab objects in updater callbacks; changing last-tab product behavior.
* **Reason:** workspace setItem currently swallows quota errors while Jotai has already published state. A synchronous receipt removes that mechanism across live writers. Existing compressed tree storage supplies validation and quota reporting; rollback of a new id cannot destroy a prior game. d-20260901-15 continues to govern startup cloning/migration and is not reversed. Existing-id import replacement needs a different owner-preserving transaction, recorded separately as f-20260910-09.
* **Limits and reversal path:** this handles synchronous storage failure, not cross-key process-crash atomicity or browser fsync. Storage revocation can also reject cleanup and must be reported without claiming rollback. Revisit the storage backend only with evidence that stronger crash atomicity is required, retaining equivalent migration/reload and live failure proof. No new user workflow or manual step is introduced.
* **Decided by:** Codex, autonomously under Felix's full-auto request, 2026-09-10 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":9,"effect_sha256":"01702b38e91e3802860506fed00d7c7190df61cdcc29e4aaf062380a32d80812","input_sha256":"a9a5877cdf6ccd3b433247733ddd359ce282d02617bcae160b7ac48226784a16","kind":"mutation-receipt","operation":"beaf19d39cbe886ac313c414867bcb30cfd59c2dc56b0a683f7654be7c9e8af4","options":{"section":null},"request_id_sha256":null,"results":["d-20260910-10"],"target":"decisions-ledger","v":1} -->

### d-20260910-11 — How does native game deletion consume the refusing workspace receipt?

* **Governs:** f-20260901-05, f-20260906-22; dependent currentTabAtom consumers under d-20260910-10.
* **Question:** How should the existing native game-delete action avoid deleting a game when its predicted workspace metadata cannot be saved?
* **Chosen:** persist the predicted file-count metadata before invoking native deletion, return without deleting or clearing the cache when that write is refused, and compensate a native rejection by restoring the captured tab owner's original origin fields. Preserve unrelated concurrent tab fields and do not recreate a closed tab or update a different selected tab. Report compensation refusal through the existing persistence notification path.
* **Rejected:** native deletion followed by an ignored workspace save result; changing currentTabAtom back to publishing refused metadata; introducing a cross-system transaction journal for this receipt-consumer correction.
* **Reason:** cumulative correctness review found that the new refusing currentTabAtom leaves this consumer inconsistent if native deletion happens first. The metadata prerequisite can be enforced synchronously; native rejection then has an explicit, owner-scoped compensation path. This follows d-20260910-10 rather than reversing it.
* **Limits and reversal path:** this is exception ordering and compensation, not atomicity across a native file and browser storage. Revisit the transaction mechanism if evidence requires crash recovery or concurrent native file mutation coordination; retain refusal, native rejection, ownership and successful-delete regressions.
* **Decided by:** Codex, autonomously under Felix's full-auto request, 2026-09-10 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":9,"effect_sha256":"5201d3cf03ecd280f5e9a513c6f90ae8235b96a4c0f4584dcbdd4dec985f05d7","input_sha256":"1db84f2b551652f7a4413816d6ba7a29bd4a768c5b2100bc30d7d83cf918fd41","kind":"mutation-receipt","operation":"f6ac483d82eaf47230ab6b4fdcc105107dd93c358e87cfce36e0ed11e4b6ef86","options":{"section":null},"request_id_sha256":null,"results":["d-20260910-11"],"target":"decisions-ledger","v":1} -->

### d-20260910-12 — How should the skill-bridge checker discover a skill that is shipped as a symlinked directory?

* **Question:** How should `scripts/check-skill-bridges.mjs` enumerate skill names once discovery goes through `listWorkingTreeFiles`, given that a skill may be shipped as a symlinked directory?
* **Governs:** f-20260901-16
* **Chosen:** Treat a path of one segment below `<side>/skills` as a candidate name alongside the two-segment `<name>/SKILL.md` shape, and keep the existing `readFile` probe as the decider. The probe now also tolerates `ENOTDIR`, which is what reading through a loose file beside the skill directories reports, and the content scan skips `EISDIR`, because the link entry itself carries no text.
* **Rejected:** Resolving the link with `stat` before enumerating, which reintroduces a per-checker filesystem walk beside the shared walker and is exactly the drift `f-20260901-16` exists to remove. Also rejected: leaving the `readdir` walk in place because no skill is a symlink today — latent is not absent, and rule 4b puts a same-area finding in this run.
* **Reason:** Measured, not assumed: `git ls-files` does not descend a symlinked directory. In a probe repository containing `.claude/skills/real/SKILL.md` and `.claude/skills/linked -> ../../shared/linked`, both the untracked query and the tracked query print `.claude/skills/linked` and `.claude/skills/real/SKILL.md`, never `.claude/skills/linked/SKILL.md`. Routing the checker onto the shared walker therefore does not by itself make a symlinked skill visible. Reversal path: revert `directorySkillNames`; the covering test is "discovers a skill shipped as a symlinked directory" in `scripts/check-skill-bridges-tests.mjs`.
* **Decided by:** next-finding f-20260901-16, 2026-09-10 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"d48569196f744035447769d6d080ee5731d4a4198e515631c1e4662c136ae55d","input_sha256":"b31a3f9edc2994bd585585371f5c8c5635854572746da7da1fed6cb0e505baa1","kind":"mutation-receipt","operation":"8eb61ac17f1e232b836bfb006a63dbdab3235b13ab673186615d8a63a984c2b2","options":{"section":null},"request_id_sha256":null,"results":["d-20260910-12"],"target":"decisions-ledger","v":1} -->

## 2026-09-11 — recorded through the decisions lock

### d-20260911-01 — How are native UCI resource values kept out of engine transcripts?

* **Question:** How can shared engine transcripts hide resolved resource values without changing the UCI protocol or ordinary option diagnostics?
* **Governs:** f-20260901-18
* **Chosen:** Carry explicit resource provenance from option resolution into the shared engine runtime. Redact individual resolved values in both transcript directions before retention; preserve raw UCI transport and parsing. Retain bounded redaction knowledge for the runtime lifetime and refuse a new resource command before sending it if that bound is exhausted.
* **Rejected:** Path-shaped string guessing, outgoing-only masking, renderer-side filtering, or forgetting old values when options change.
* **Reason:** Analysis and game engines share the actor log API, and delayed engine echoes can contain an earlier resource value. Provenance avoids changing ordinary option diagnostics. This preserves the log-query failure behavior of d-20260901-32. Reversal requires equivalent proof for both callers, delayed echoes, unchanged wire bytes, and bounded retention.
* **Decided by:** Codex, autonomously under full auto · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"e8942c41078930452d02eaf3c48d947bfb59ff9dfa18e83741230483e45cee4e","input_sha256":"5e79a9d7f56e93fa03a5e48638634a31ea42747a46b6721b6431ec15577bc693","kind":"mutation-receipt","operation":"d6b6c3d60e5fd92b77a97f6cafe7a04ac963000ad9211d519e294722541ea625","options":{"section":null},"request_id_sha256":null,"results":["d-20260911-01"],"target":"decisions-ledger","v":1} -->

### d-20260911-02 — How are accumulated frontend coverage gains made binding again?

* **Question:** How are accumulated frontend coverage gains made binding again?
* **Governs:** f-20260901-20
* **Chosen:** refresh `coverage-baselines.json` from the frontend LCOV artifact of successful fork CI run 34514750394 (artifact 10167466769, commit a106d664d6db47c03028ea150e77207a08d274d7), with all 30 metrics taken together. Document a deliberate upward-refresh procedure after coverage gains, using the existing reporter rather than adding a service or automatic baseline writer.
* **Rejected:** retaining the stale baseline (it leaves 1,509 covered board/game/analysis lines unprotected); refreshing from local measurement alone (CI is the reference); automatic baseline rewriting on every test or failed gate (it could normalize regressions).
* **Reason:** the CI artifact passes the old ratchet and floors with zero shrink allowances. Every covered count and ratio increases. The frontend inputs are unchanged between that CI commit and pickup HEAD 9f8a3946389da4f4530961dd52c4a74ba745c76e; the intervening diff contains only Rust and ledger files. A fresh full `pnpm test:coverage` on pickup HEAD exits 0 and matches all CI area metrics exactly. No measurement scope, floor or ratchet logic changes. This is the reasoned upward-only exception requested by the finding, under the evidence requirement of d-20260829-02, not a rewrite to clear a red gate. The deny entries in `.claude/settings.json` remain intact; any actual runtime refusal must be honored without a differently phrased retry.
* **Reversal path:** retain the old baseline through a reviewed revert of the refresh if this measurement is disproven; investigate any red gate rather than lowering the new baseline.
* **Decided by:** Codex, autonomously in drain session 43916f56-0a80-46c1-8a59-e33fe7588681 under the pinned full-auto request · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":9,"effect_sha256":"5ae1f47c5afe9e3e3990ec41bed678463fb5e60bf0d74e12a875474e33514b90","input_sha256":"c5c1be701a1a9cfe5634bd9a53419b2817df01b91bc0392c992acc522742d35a","kind":"mutation-receipt","operation":"a59e7071afb08867be7001d95f8d83b05853dabeebd77140d8c3cccecad20dd4","options":{"section":null},"request_id_sha256":null,"results":["d-20260911-02"],"target":"decisions-ledger","v":1} -->

### d-20260911-03 — How are game-command failures localized without losing diagnostics?

* **Governs:** f-20260901-21
* **Question:** How should BoardGame present local validation and native command failures in the selected locale?
* **Chosen:** A typed missing-local-engine error and a finite operation/error identity mapped through literal translation calls at render time. Both start and the adjacent move/takeback/abort/resign command catches use that shared contract. Sanitized causes go to the existing native logger, with a handled logging-failure path.
* **Rejected:** Parsing English error messages to choose translations; rendering backend diagnostic text; translating only the local engine guard; leaving the adjacent command catch with the identical raw-message mechanism.
* **Reason:** docs/localization.md requires literal extracted keys in every shipped locale. The native facade already normalizes errors, but its message is diagnostic text rather than localized copy. d-20260901-36 settled playerConfig extraction and pending-start cleanup, which remain intact. The finding retains Entry lens with review-error-handling; no unresolved architecture question requires build.
* **Proof:** Focused BoardGame/playerConfig/error-mapping tests, fallback-disabled catalogue checks after extraction, and a German game-start rejection journey in the pinned Playwright container, followed by affected push gates.
* **Reversal path:** Change the finite mapping if a future typed native contract provides actionable game-specific identities; preserve sanitized logging and current-language rendering.
* **Decided by:** Codex drain session 43916f56-0a80-46c1-8a59-e33fe7588681 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":10,"effect_sha256":"a71ee66660c2a14908c6a6eede210773d1c3aebc6d8081c739f938cc8ec88791","input_sha256":"3b86cb50c32e0007eca254f7647371355a46cf6130b02d8381c2fe567f5480f3","kind":"mutation-receipt","operation":"7571308a33b430169440ad8d03df0c76925f016e95cd87379d6b9f6db91d39eb","options":{"section":null},"request_id_sha256":null,"results":["d-20260911-03"],"target":"decisions-ledger","v":1} -->

### d-20260911-04 — Where does shared engine-option normalization live?

* **Governs:** f-20260901-24
* **Question:** How should the three engine-option mappings share their implementation while preserving lightweight player-configuration tests?
* **Chosen:** A pure `src/utils/engineOptions.ts` helper with a type-only bindings import, used by player configuration, interactive evaluation and report generation. Keep fallback selection and the game-only MultiPV filter at the callers. Retain inline tier with the finding's named engine-protocol lens included in push review.
* **Rejected:** Importing the runtime-heavy `src/utils/engines.ts` into player configuration, or retaining duplicate maps. No new normalization policy or optional filtering API is introduced.
* **Reason:** The three mappings have the same contract; d-20260901-36 already establishes that the pure player configuration should not load the UI/native module graph for its tests.
* **Reversal path:** Revisit the helper's input contract if the generated EngineOption representation changes; preserve all three caller behaviors together.
* **Decided by:** Codex next-finding run 2026-09-11 · **Superseded-by:** d-20260911-05
<!-- ledger-meta {"command":"record-decision","effect_lines":9,"effect_sha256":"d9c9be8ce0b6b06f324ff1f5a6d4b478ecc001b5cdfe4be39aea67804e21ddc5","input_sha256":"4ea7011615b4398fa6f5ab0054744792d41b13efaafbb9ad2baa8f4828bc5361","kind":"mutation-receipt","operation":"04ab1f1f7236d70f5cc47e4df7015369045d5441644152b425a6326d11ec87cb","options":{"section":null},"request_id_sha256":null,"results":["d-20260911-04"],"target":"decisions-ledger","v":1} -->

### d-20260911-05 — Which engine-module location preserves the coverage contract?

* **Governs:** f-20260901-24
* **Question:** Where should the pure shared engine-option helper live within the existing measured engine area?
* **Chosen:** `src/components/engines/engineOptions.ts`, alongside the existing pure `engineAttachments.ts` and `engineFormValidation.ts` helpers. Keep its type-only import and all three callers unchanged except their import paths.
* **Rejected:** The `src/utils/engineOptions.ts` placement chosen in d-20260911-04, which is not mapped by the existing coverage configuration. Also rejected changing the coverage path map or refreshing its baseline as part of this refactor.
* **Reason:** New evidence from the final gate: the helper measured 100% coverage but failed as an unmapped production file. A trial explicit mapping was refused because it changes the recorded scope signature. The engine module's existing glob already owns this domain and accommodates pure helpers, so this location preserves both the lightweight dependency boundary and the established measurement contract. The trial mapping was reverted without changing any baseline or floor.
* **Reversal path:** Reconsider module placement as part of a deliberate engine-module or coverage-scope reorganization, preserving the type-only helper and its coverage.
* **Decided by:** Codex next-finding run 2026-09-11 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":9,"effect_sha256":"08a0dd7ff9efa5274129d928b0701fa8188ceff1a0cca86ccfd4faa6c9d57a80","input_sha256":"b86828018e99d57b934d5a88f3497bdd7d58c521388a5bccb57dbc6a06eda59f","kind":"mutation-receipt","operation":"1ae7bc60ee908e9dcbabb70a6eb304fbe1b32574c3c7693d64e1a95506cd4030","options":{"section":null},"request_id_sha256":null,"results":["d-20260911-05"],"target":"decisions-ledger","v":1} -->

### d-20260911-06 — How is engine-image VerifiedFile provenance sealed inside path_authority?

* **Question:** After `d-20260903-08` left `ResolvedPath.file` module-private in the same file as `VerifiedFile::from_resolved`, how is a pathname-opened descriptor prevented from being minted as `VerifiedFile` by code inside path-authority?
* **Governs:** f-20260903-02, f-20260904-06
* **Chosen:** directory module `path_authority/{mod,resolved,verified}.rs`. `ResolvedPath` owns the no-follow `file` field. Nested `mint` is the only `VerifiedFile` constructor (`from_resolved` → `take_file()`), visible only inside `verified.rs`. Mint call sites `open_engine_image` and `prepare_download_artifact` are `pub(super)` methods there.
* **Rejected:** token scans of read primitives (`d-20260903-08`); `pub(crate) fn from_resolved` (crate-wide mint from any `&mut ResolvedPath`); lifting `ResolvedPath` to `infra::resolved_path` (no extra privacy over child-module fields); `from_resolved` as `pub(super)` on a `VerifiedFile` defined in `verified.rs` itself (`resolved.rs` could then assign `file` and mint).
* **Reason:** Rust has no parent-only-not-sibling visibility. Sibling child modules plus a nested mint module are the compiler proof that the module that can mutate `file` cannot construct `VerifiedFile`, and the module that can construct it cannot assign `file`.
* **Decided by:** Grok, autonomously under `full auto`, drain session 67283a2f-9560-485d-9821-e4df18ffb96b · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"006a6228cf682e0f0874c303a9b224190e62bd0604a43a2ba5c25a0635f8ff9d","input_sha256":"55d465aaef9363ca704430e48724c374751ca471d48347eafcc86be8e4b9e868","kind":"mutation-receipt","operation":"70119a837e37d04d731635ee8f4a69189ea1c0a4f07ab97e7bbbbebe3d7333c1","options":{"section":null},"request_id_sha256":null,"results":["d-20260911-06"],"target":"decisions-ledger","v":1} -->

### d-20260911-07 — Is the debug webview log target kept with a filter, or removed?

* **Question:** Should debug builds keep `TargetKind::Webview` with a `WEBVIEW_TARGET` filter, or drop the webview sink and `attachConsole` entirely?
* **Governs:** f-20260904-07
* **Chosen:** drop the webview sink and `attachConsole`. Native logs go to stdout (debug) and stdout plus the log directory (release). Renderer `info`/`warn` still reach native stdout through the plugin-log command.
* **Rejected:** keep `TargetKind::Webview` filtered to `WEBVIEW_TARGET` so JS logs echo back to DevTools. Also rejected: raise the webview level to Error — `log::error!` still carries paths (credential init).
* **Reason:** `.claude/rules/async-resource-invariants.md` forbids moving a raw backend diagnostic into the renderer. A filter leaves the channel in place for the next author to omit. Error-only still leaks. `d-20260904-08` rejected logging native causes because this exact channel would re-open them.
* **Decided by:** Grok, autonomously under `full auto`, drain session 8964a886-093f-4b1d-a4ba-f1a7a40ff3ce · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"ddbfac5ba135261345b739c7a299549022aec4ccc16c84a47c448482cb1712de","input_sha256":"0bbc694eb0f2bc5eaa3228a151a3be6a42765e60a97e6e18988517fcb7994511","kind":"mutation-receipt","operation":"9505861de23ee90e2256b5a6e278c88539399b292a904266b446a1ca9a1d6bfb","options":{"section":null},"request_id_sha256":null,"results":["d-20260911-07"],"target":"decisions-ledger","v":1} -->

### d-20260911-08 — Does cancel_analysis return Err for an unknown ticket, and where is pre-publish cancel observed?

* **Question:** Does cancel_analysis return Err for an unknown ticket, and where is pre-publish cancel observed?
* **Governs:** f-20260904-11
* **Chosen:** Keep `OperationRegistry::cancel_analysis` returning `Ok(())` when the ticket is already gone. Observe the existing claim-time `CancellationToken` throughout `analyze_game_core`'s pre-admit window (`collect_report_positions` per ply and after `naive_eval`, then again immediately before `admit_for_operation`) and before `Succeeded`. Do not add a second cancelled-ids set.
* **Rejected:** Returning `Conflict`/`NotFound` for an unknown ticket (breaks late cancel after lease drop, double cancel, and tab-close plus button races; contradicts `reservations_are_owner_bound_single_use_and_late_cancel_is_safe`). A parallel cancelled-ids registry beside the reservation token (second identity for one operation). Checking cancellation only at `admit_for_operation` (lets the mainline replay and `begin_progress` run after the user cancelled).
* **Reason:** f-20260904-10 already made the reservation the intent record, so unknown-ticket `Ok` now means the work is gone, not that cancel was forgotten. The remaining gap was observation during the named pre-spawn replay. Reversal path: a typed unknown-ticket error must keep late-cancel and double-cancel silent at the ReportPanel button, and any second cancel registry must prove it cannot disagree with the reservation token.
* **Decided by:** Grok, drain session d2b69c67-1aae-4e59-848e-d5b3040917dc, full auto, 2026-09-11 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"8a86e56f9ad7e2a2183c814021ee63904fb0e5885e056cfecf477c9705eccf33","input_sha256":"6e34f62ff6f388130f5a9334b4647fc53b0c6eb4def6d122e23feb5154821df5","kind":"mutation-receipt","operation":"ed391b88ad3ba97527af791ccc82c7799917ba9bc3285aac3a2996fe39cd8ea6","options":{"section":null},"request_id_sha256":null,"results":["d-20260911-08"],"target":"decisions-ledger","v":1} -->

### d-20260911-09 — Slice f-20260911-01 from f-20260911-02?

* **Question:** Work f-20260911-01 together with f-20260911-02, or slice to the emit-after-cancel path only?
* **Governs:** f-20260911-01
* **Chosen:** work only f-20260911-01 at `lens`. Leave f-20260911-02 open at `build`.
* **Rejected:** taking both because they were filed together from the same engine-protocol pass. Rejected: lowering 02 to lens and fixing unscoped stop generation selection in this slice.
* **Reason:** they do not share a cohesive file set for one interview. 01 is interactive emit-after-cancel in `chess.rs` `process_interactive_search_output`. 02 is unscoped `stop_generation` preferring a pending admission, with an open question: which generation to stop. A ledger area is a vocabulary bucket, not a cohesive file set (`d-20260901-21`, `d-20260831-33`). Lens r4 restated 02 as should-fix; it is already filed.
* **Decided by:** Grok, autonomously under `full auto`, drain session 833400da-2c52-444a-8880-2c4cbe8b0353 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"86ce857208bd8793a6c11fc4aa0f62012995edb674bfa01420a13a23da00e484","input_sha256":"1ee1e13011371393bf03bec0c2ec36176290109690ba1cc8e55c225114cd10b4","kind":"mutation-receipt","operation":"219842b65fb553fd502b6b28b97862b1c3dd116b6879fae06ce2244136e78f58","options":{"section":null},"request_id_sha256":null,"results":["d-20260911-09"],"target":"decisions-ledger","v":1} -->

## 2026-09-12 — recorded through the decisions lock

### d-20260912-01 — How does a deleted app-owned default root recover without weakening dialog callers?

* **Question:** If a user deletes `db` / `engines` / `puzzles` under app-data, how does the next default-workspace call get a usable root, given `d-20260905-03` (dialog `get_or_create_*_root` must still refuse an absent directory)?
* **Governs:** f-20260905-01
* **Chosen:** In `get_or_create_root`, when reuse finds a persistent custom root at this path, `expected_identity` is `Some` and matches the live directory, and the stored identity differs, stage a Complete prune of that root (persistent descendants, pending whose root was removed, provisional ids no longer in the candidate, then drop ids in `pending_unpersisted_removals`) and commit one new entry. Dialog callers pass `None` and still Conflict / refuse-absent.
* **Rejected:** skip `Unavailable` in the reuse lookup (dialog shares it); a picker for default roots; `get_or_create_app_owned_root`; wiring the helper into `remove_workspace_entry`; recovering on identity equality (that is the same directory).
* **Reason:** `d-20260905-12` already put `Some(identity)` on default callers. The wedge is stored-identity mismatch after recreate. One candidate commit avoids `f-20260831-03`. Reversal path: restore the unconditional Conflict at the stored-identity comparison and delete the recovery tests.
* **Decided by:** Grok, autonomously under `full auto`, drain session 57010de9-7bf7-461c-8861-1eff043d4d7a · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"5847e60e518d91f27a5f203055b6767f74aaac2232521fa52f25fb5534598c72","input_sha256":"9a6ff1caa97bed6edac49e785e74bd328b1a1116665e75bbbda88bc22490facc","kind":"mutation-receipt","operation":"45548dd6d7a55a92dfa0c795b0b7eef975764e9da7b534790627849c4f5f0f75","options":{"section":null},"request_id_sha256":null,"results":["d-20260912-01"],"target":"decisions-ledger","v":1} -->

### d-20260912-02 — Is `credentials` routed through the app-owned-default-root helper, or does it need a pre-authority bootstrap of its own?

* **Question:** `f-20260905-02` filed the credential store's five filesystem reaches as a startup-ordering design question: either a new pre-authority bootstrap primitive with its own gate exemption, or moving credential initialisation after `PathAuthority::open`. Which?
* **Governs:** f-20260905-02, f-20260912-01
* **Chosen:** neither. `credentials` becomes a fifth `AppOwnedDefaultRoot` variant with leaf `credentials`, and all five sites route through `ensure_app_owned_default_dir` plus the `AuthorizedDir` descriptor family that already exists in `infra/`. Startup ordering is untouched. `AppOwnedDefaultRoot` gains a private `private_mode()` accessor beside `leaf()`, `Some(0o700)` for `Credentials` and `None` for the other four, applied by `ensure_app_owned_default_dir` on the descriptor it already holds. `CredentialManager` holds `Mutex<Option<Arc<AuthorizedDir>>>`. `initialize` narrows to `pub(crate)` and takes `&AppDataDir`. The `credentials` leaf moves out of `main.rs` into the enum. `credentials.rs` leaves `INITIAL_FS_SURFACE_ALLOWLIST` and `INITIAL_FS_SURFACE_COUNTS`.
* **Rejected:** a pre-authority bootstrap primitive with a stated gate exemption — a second implementation of a domain concept the repository already has, and a second exemption concept for a gate that already exempts `infra/` structurally. Rejected: moving credential initialisation after `PathAuthority::open`, which changes startup ordering and the failure mode when the authority registry is unreadable, for no property the free function does not already give. Rejected: a separate `AuthorizedDir::set_private_mode()` the caller must invoke — a second seam with one caller that fails **open** when forgotten. Rejected: exposing `AuthorizedDir`'s inner `&File`. Rejected: holding the `AuthorizedDir` by value behind the mutex, which deadlocks against `reconcile`. Rejected: a pre-write identity comparison against the live pathname, which cannot be written against the current API (see `f-20260912-01`).
* **Reason:** the filed dichotomy rests on a premise that no longer holds. `ensure_app_owned_default_dir` accepts no `PathAuthority` and its whole call path consults none, so being materialised before the authority is no obstacle. The new evidence against `d-20260905-01`'s deferral is not that — the helper never took an authority, and that decision deferred knowing it. It is the **return type**: `d-20260905-02` records `-> Result<PathBuf, Error>`, and today the helper returns `AuthorizedDir`, a verified directory descriptor carrying `open_regular_relative` and `atomic_replace_leaf_identified`. A helper returning a pathname would have left `credentials.rs` reopening pathnames for the registry, so routing it would have moved the counted sites rather than removed them; the deferral was correct when it was made and is obsolete now, for a reason its authors could not have applied. Routing through the closed enum also carries `d-20260905-02`'s own security property verbatim: the signature fixes the leaf and `AppDataDir` fixes the parent, so no caller can name the credential directory, and the gate losing sight of `infra/` costs nothing it was guarding. The `0700` belongs on the enum for the same reason the leaf does. `open_regular_at`'s regular-file `fstat` check subsumes the `O_NOFOLLOW`-alone weakness the finding names, so the asymmetry is resolved by deleting the weaker open rather than by adding a flag to it.
* **Scope of supersession:** of `d-20260905-01`, only its `credentials` deferral clause — its shrink-versus-empty answer and its other six governed findings (`f-20260905-03` through `f-20260905-07`, `f-20260901-01`) are unaffected. Of `d-20260905-02`, only the four-variant enumeration — its closed-enum principle, its `AppDataDir` parent and its `Error::Io` refusal reasoning are adopted here unchanged and stay in force.
* **Residual:** a credential directory replaced while the application runs is no longer followed, which can orphan a keyring entry. Filed as `f-20260912-01` with the four measured reasons the guard cannot be written today. Non-Unix is unchanged: `initialize` returned `Error::CredentialFailure` on Windows before this change, because it reaches `atomic_replace` unconditionally, and returns the same after.
* **Decided by:** Claude Code, autonomously under `full auto`, session a9714201-d999-45ed-ba03-5d6c3ed40aec · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":10,"effect_sha256":"285b1aeae54de095cdcae8c92e322f497511af4e60debf0be1faad1ffe805c53","input_sha256":"76fd730cbb68f2828d245d42a96b2d8d92d0f9c34c8a687a483ffe2f32ea6106","kind":"mutation-receipt","operation":"3ff6f38371760961b09a0d4e0fcc46889cee76921af7063f3a0cba8d2a65bb3a","options":{"section":null},"request_id_sha256":null,"results":["d-20260912-02"],"target":"decisions-ledger","v":1} -->

### d-20260912-03 — Does this run implement Mandate B while Mandate A is still open, or sequence A1 then A2 then B?

* **Question:** Does this run implement `f-20260905-03` (Mandate B, repository identity re-key) while Mandate A is still open, or sequence A1 (`f-20260912-11`) then A2 (`f-20260912-12`) then B?
* **Governs:** f-20260905-03, f-20260912-11, f-20260912-12
* **Chosen:** sequence. Block B on A2 (`sequenced-f-20260912-12`), block A2 on A1 (`sequenced-f-20260912-11`), and execute A1 in this run at its filed `build` tier.
* **Rejected:** implementing B against today's `DatabaseFileTarget { parent, leaf, identity }` with no `path` field — that recreates the ten-round non-convergence the 2026-09-12 split recorded. Also rejected: taking A1+A2+B in one plan (the same split). Also rejected: leaving B pickable so the drain loops on an unchanged `f-20260905-03`.
* **Reason:** `DatabaseFileTarget` at `src-tauri/src/infra/path_authority/mod.rs:132-136` still has no `path`. The finding's 2026-09-12 re-scope made Mandate A a prerequisite of B; A was then split into A1 (carrier + the three commands that already hold a target) and A2 (`resolve_database` + operation matrix). B's key is `EntryKey { identity, parent_identity, path }` supplied by that carrier. A sequenced blocker is the queue form of that prerequisite; `f-20260830-48` is the in-repo precedent (`sequenced-f-20260830-06`).
* **Decided by:** Grok, autonomously under `full auto` · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"16ba3b4fec58af83b608ba63f19cf9c287d2e09e0a81d778f53beb939ad6f5fb","input_sha256":"af201cbb47f0fade9b0a6bccd0939eb5bd433ea998539fdcc17c341e333bccb9","kind":"mutation-receipt","operation":"6308175a6d1f53fe42a3fe7eab2c5117c3b25db02dc9da89b1282ca9cf66989d","options":{"section":null},"request_id_sha256":null,"results":["d-20260912-03"],"target":"decisions-ledger","v":1} -->

### d-20260912-04 — Does canonical_binding canonicalize the whole stored path, or only the parent?

* **Question:** Does `canonical_binding` canonicalize the whole stored path, or only the parent, appending the leaf unchanged?
* **Governs:** f-20260912-11
* **Chosen:** canonicalize only the parent and append the leaf `OsStr` unchanged. Empty parent maps to `"."`.
* **Rejected:** `canonicalize(stored)` of the whole path, which follows a leaf symlink introduced before or between the checks.
* **Reason:** a leaf replaced by a symlink to the moved original must be refused; following it would mint a target for the moved file. Measured in plan review of the parent Mandate A plan (D1).
* **Decided by:** Grok, autonomously under `full auto`, A1 of f-20260912-11 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"2b9da1425f7b4faad2fa630fb1145863f5b8b99689c836914e76d6f4d33cd685","input_sha256":"5f7e59e1c1896da986a87d8c5bfe618ce827adc0e5ed685281795ad1c7e2449c","kind":"mutation-receipt","operation":"1a5e7c82fbc777fafc4809c9d5efbdca07795e126cc3df285d3656a78b1cfac6","options":{"section":null},"request_id_sha256":null,"results":["d-20260912-04"],"target":"decisions-ledger","v":1} -->

### d-20260912-05 — Does database_file_target validate the stored path before canonical binding?

* **Question:** Does `database_file_target` validate the stored path with today's leaf no-follow check before `canonical_binding`, or rely on the canonical walk alone?
* **Governs:** f-20260912-11
* **Chosen:** validate the stored path first (`validate_target` == stored identity), then the hook, then `canonical_binding`.
* **Rejected:** relying on the canonical walk alone.
* **Reason:** a leaf replaced by a symlink to the moved original is refused even though the symlink target has the stored identity. Parent plan D2.
* **Decided by:** Grok, autonomously under `full auto`, A1 of f-20260912-11 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"f548b11ec5693a63898ac835599f0b863b76960ef513f3ee2c45bce2de29e05e","input_sha256":"a916c117b99bb2805f5df9e82d56eb2de5b957a8b56aa049f4462b6fa6fd64d5","kind":"mutation-receipt","operation":"c99b63e69a7d6512bba5f1b52f1b888efb205b3088ef744b194b388be1847630","options":{"section":null},"request_id_sha256":null,"results":["d-20260912-05"],"target":"decisions-ledger","v":1} -->

### d-20260912-06 — How is DatabaseFileTarget assembled so a caller cannot forge one?

* **Question:** How is `DatabaseFileTarget` assembled so crate code cannot pass off an arbitrary `(parent, leaf, identity, path)` as a minted target?
* **Governs:** f-20260912-11
* **Chosen:** private fields, `pub(crate)` accessors, one module-private `assemble`, one `#[cfg(test)] for_test_path` door.
* **Rejected:** `pub(crate)` fields; three separate assemblies; a `for_test_parts` constructor from arbitrary parts. `d-20260905-07`'s refusal of a test constructor was about `AuthorizedDir` containment and does not apply.
* **Reason:** outside `infra/path_authority` the type cannot be assembled. Negative tests mint a live target then replace the leaf. Parent plan D3/D4.
* **Decided by:** Grok, autonomously under `full auto`, A1 of f-20260912-11 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"97e45710f97af7ed172903420e69a65aa4934b65acd04f8744eed7ba3a406820","input_sha256":"4370022eda246f734df391d58cf15acbe4d7ef5a8084be563669b5ee4bac80f3","kind":"mutation-receipt","operation":"dea2f0aea962c6abb6ba6f8c57fa54708b708d6046eb14b2a4851e2741c25e59","options":{"section":null},"request_id_sha256":null,"results":["d-20260912-06"],"target":"decisions-ledger","v":1} -->

### d-20260912-07 — Does A1 change get_db_or_create or the repository Path API?

* **Question:** Does A1 change `get_db_or_create`'s `&Path` parameter or the repository's pathname API?
* **Governs:** f-20260912-11, f-20260905-03
* **Chosen:** both stay. `get_db_or_create` receives `target.path()`. `canonical_database_path` stays until Mandate B, so A1 does not shrink the allowlist.
* **Rejected:** inlining `get_db_or_create`; changing its signature; re-keying the repository in this run.
* **Reason:** parent plan D5/D6. Re-keying is Mandate B (`f-20260905-03`).
* **Decided by:** Grok, autonomously under `full auto`, A1 of f-20260912-11 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"242ecf58ca79134508bc23adb025ca65d9362a5ed83e774cb5fd975a23804280","input_sha256":"c0d51f368a606ac3458485cad7eb515e9e03697c2610072cd67fe695512fb6a3","kind":"mutation-receipt","operation":"d3c2cf038a035a1b95aff36cc7c50a406dd9e3624b4592d8817614e80bd98e78","options":{"section":null},"request_id_sha256":null,"results":["d-20260912-07"],"target":"decisions-ledger","v":1} -->

### d-20260912-08 — Does A1 add open_current or puzzle_database_target?

* **Question:** Does A1 add `DatabaseFileTarget::open_current` or `ResolvedPath::puzzle_database_target`?
* **Governs:** f-20260912-11, f-20260905-03
* **Chosen:** no. Both would be unused without the repository re-key (`-D warnings`).
* **Rejected:** landing them as dead `pub(crate)` surface in A1.
* **Reason:** parent plan D7. They belong to Mandate B.
* **Decided by:** Grok, autonomously under `full auto`, A1 of f-20260912-11 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"5b6efcb235149145aa5e6dfde0f2124b573a079f438329130df38ff06b287aa7","input_sha256":"b2efd67f7aab9257100ba0a2960d02dd510080f1c8e4bdf0131834c856a03271","kind":"mutation-receipt","operation":"7d357955fd67e1c29cc385542d69867928c1c676fc0b24a3093d811984d1a45d","options":{"section":null},"request_id_sha256":null,"results":["d-20260912-08"],"target":"decisions-ledger","v":1} -->

### d-20260912-09 — Which search-layer canonicalize calls become target.path() in A1?

* **Question:** Parent D8 said all three search-layer `canonicalize()` sites become `target.path()`. Which of those does A1 actually change?
* **Governs:** f-20260912-11, f-20260912-12
* **Chosen:** only `load_search_index_cancellable`'s `resolve_database(...)?.canonicalize()`. `search.rs:614` and `:840` stay until A2, because those callers still go through unchanged `resolve_database` and still receive a `PathBuf`.
* **Rejected:** implementing parent D8 over all three sites in A1, which pulls A2 into this cut.
* **Reason:** the A1 scope amendment and round-1 plan/root-cause review. Parent D8 over the three sites remains A2's.
* **Decided by:** Grok, autonomously under `full auto`, A1 of f-20260912-11 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"e44b84e57756e2457d2be845f8915e0a1ff1eb6cb12cca8da02bb140eef01ef2","input_sha256":"7f60205aef5afcacbbbede2318f9b39e5426213d545cb73765408b5e0b94a660","kind":"mutation-receipt","operation":"fcb76c01ab95aa68aec9ba7b7d9e74a38f67143216230f9cc61d56c9499b6418","options":{"section":null},"request_id_sha256":null,"results":["d-20260912-09"],"target":"decisions-ledger","v":1} -->

## 2026-09-13 — recorded through the decisions lock

### d-20260913-01 — How does the A2 operation matrix tell the three non-read operations apart, and which callers does it cover?

* **Question:** For `f-20260912-12`, which database command callers does `commands_resolve_with_their_own_operation` cover, and how does it distinguish DatabaseCreate, DatabaseExport, and DatabaseMutate without conflating them with Read-first loaders?
* **Governs:** f-20260912-12
* **Chosen:** Four one-operation promotions of a schema-initialized fixture. Each family's callers pass the authority on their own grant (Create: empty `convert_pgn`; Export: `export_to_pgn` with a granted destination; Mutate: every mutate command, `delete_database` last; Read-complete: the seven SQL readers). Other families refuse with the exact string `workspace entry does not permit this operation`. Read-first search/loader commands are proven by a `#[cfg(test)]` recorder on `resolve_database` whose first recorded operation is `DatabaseRead`, plus a two-operation fixture that records `[Read, Read, Mutate, Mutate, Read]`. `search.rs` and `db/mod.rs` tests share `schema_database_case`.
* **Rejected:** Requiring `search_position` / `is_position_in_db` / `load_search_index` to `Ok` on a Read-only handle (false without a sidecar, because the loader later mints Mutate). Calling `resolve_database` from the test instead of the command. One representative mutate caller instead of every mutate caller (the mandate requires exactly their own callers). A syscall hook for directory refusal (removed parent yielding `Io` vs the regular-file string is the in-memory prefix).
* **Reason:** Parent plan review could not settle the read-caller half in five rounds. Permit-fail on Mutate-only does not prove a first mint of Read, because a first mint of Mutate would then fail at the loader's Read. The recorder at `resolve_database` entry is the existing thread-local checkpoint pattern. Reversal: if a later session can complete those three on Read-only without a Mutate grant, they may move into the Read-complete `Ok` set.
* **Decided by:** Grok, A2 of f-20260912-12 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"fd70b5a2c7900c4b9bbea3fffdb5787012d82b494a86f1b781d1d1b1b6be308f","input_sha256":"a11bc71c5b973dd9c3faf5025575a976cb382ccfad2e4d1222d75f3ad0d34d64","kind":"mutation-receipt","operation":"5af71eaf1903a741e310839adec5fe8cbccbe5cd3f4da5300021a81bbcb6e789","options":{"section":null},"request_id_sha256":null,"results":["d-20260913-01"],"target":"decisions-ledger","v":1} -->

### d-20260913-02 — What is the repository map key after Mandate B?

* **Question:** After A1/A2 landed, what does DatabaseRepository key entries on?
* **Governs:** f-20260905-03
* **Chosen:** EntryKey { identity, parent_identity, path } from DatabaseFileTarget (identity(), fstat of parent(), path()).
* **Rejected:** identity alone (ten-round shared-entry races); pathname alone (the filed defect).
* **Reason:** two hard links must stay two pools; a parent swap with a hard link must miss the old entry; spelling aliases share a canonical path.
* **Decided by:** Grok, f-20260905-03 Mandate B · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"4ef4b1707558229d0e72ff8d07eed32ee97b3a2cb5a9b87faa661b06618b51ed","input_sha256":"7ade9f4bb0be51e4c7b970077cb7c0e9bbd06b0a36f7293196580a72accc0f5d","kind":"mutation-receipt","operation":"8abc7f6b08b5f378c231cc2db10a00640c0537f98e58a8163981e67b9bffe8d7","options":{"section":null},"request_id_sha256":null,"results":["d-20260913-02"],"target":"decisions-ledger","v":1} -->

### d-20260913-03 — What retirement semantics does Mandate B keep?

* **Question:** Does the repository re-key wait for leases before removing a stale entry, or park/un-park without waiting?
* **Governs:** f-20260905-03
* **Chosen:** wait-then-remove on an idle stale entry (active == 0). A Conflict while active > 0 returns immediately; the next lease-free entry() waits.
* **Rejected:** parking / un-park / identity tombstones / multi-entry unwind (did not converge). Also rejected: waiting while the same call holds a lease.
* **Reason:** the finding's 2026-09-12 re-scope; nested write-lock plus get_db_or_create would self-timeout.
* **Decided by:** Grok, f-20260905-03 Mandate B · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"c962d2503bc2bfb4a468468a0aae8dc1109e75bf9fcbf6639d66b9586f4b1edb","input_sha256":"69aa158d8d3e4c91a1cbbd16bb8be8e09c71161ac69ff77c1bde791489578e8e","kind":"mutation-receipt","operation":"01af2527c55755c4f5eb92980cd7af7cb4c76aea2ac114d21830d8c452e19a69","options":{"section":null},"request_id_sha256":null,"results":["d-20260913-03"],"target":"decisions-ledger","v":1} -->

### d-20260913-04 — How does the repository open SQLite so a racing deletion cannot recreate the leaf?

* **Question:** What connection string does DatabaseRepository pass to r2d2 after the re-key?
* **Governs:** f-20260905-03
* **Chosen:** file://<percent-encoded canonical>?mode=rw, refuse non-UTF-8 and non-absolute paths; min_idle(Some(0)) so Pool::build does not eagerly open 16 connections.
* **Rejected:** the raw pathname (Diesel adds SQLITE_OPEN_CREATE); file: without //; shrinking connection_timeout for get() (would fail 30s busy writers).
* **Reason:** measured sqlite3 mode=rw does not create an absent file; file:// yields an empty authority.
* **Decided by:** Grok, f-20260905-03 Mandate B · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"ea5ac5d648689c1b192fd32822d24e4cf4151ca4f81a8c4fb926d6cdf2421d8e","input_sha256":"04ec9e62716406ef73035a63a1ac44b2d3bf82ae74192fd31a715387d38fd114","kind":"mutation-receipt","operation":"190683324abc6ba4b7d090e82bdb8511af9c65fa2f698574cf25292d63d48741","options":{"section":null},"request_id_sha256":null,"results":["d-20260913-04"],"target":"decisions-ledger","v":1} -->

## 2026-09-14 — recorded through the decisions lock

### d-20260914-01 — How does PathAuthority enumerate a directory without re-resolving children by pathname?

* **Question:** Which primitive and capability type carry workspace and `.db3` listings below an authorized root?
* **Governs:** f-20260905-05
* **Chosen:** `infra::fs::read_directory_entries_at` over rustix `Dir`, read from a fresh `openat(dir, ".")` descriptor, with a no-follow `statat` per name kept by a caller predicate. It returns pathless `DirectoryEntry{name, kind, identity, modified_seconds}`. A `CapabilityDirectory` wraps the fd from `resolve(id, op, &[])` and exposes `entries`, `open_child_directory` (`VerifiedDir` identity check; `ELOOP`/`ENOTDIR`/`ENOENT` map to Conflict), `confirm_entry` and `open_metadata_sidecar`, which reads the sidecar from the enumerated directory and confirms the PGN after the open. `.db3` registration refuses a resolved identity that differs from the enumerated one.
* **Rejected:** rustix `RawDir` (`cfg(linux_kernel)` only, which would break macOS, see f-20260830-06); reusing `AuthorizedDir` (its producer set is pinned by `authorized_dir_has_no_arbitrary_path_constructor`); `open_verified_directory` for the root (refuses symlinked ancestors a registered workspace may legitimately sit under); trusting dirent `d_type`/`d_ino` (at a bind mount `d_ino` names the covered inode, measured).
* **Reason:** measured that a removed directory read through its fd lists `[]` with `st_nlink == 0` while `openat(".")` still succeeds, so `st_nlink == 0` after the loop is the removal signal. Every reach below the root stays descriptor-relative, and the release-surface allowlist for `file_workspace.rs` drops from 4 to 1.
* **Decided by:** Claude Code, f-20260905-05 build run (plan review r1-r12 plus two focused judgments) · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"3e88b4533240d86e9a3d22c5ab25046a13e8e7355c4fcce525eb42c0b014e131","input_sha256":"5a47d9f8250e1beb6cf83353536a29eaa61d20c9f83de02f4e50acba142854b2","kind":"mutation-receipt","operation":"bd0267ad0d98f92372591b6d38b1b78640658bb8d798e312f8db24cf1cf5907a","options":{"section":null},"request_id_sha256":null,"results":["d-20260914-01"],"target":"decisions-ledger","v":1} -->

### d-20260914-02 — When does a workspace listing register entries, and what does a handle promise about later replacement?

* **Question:** Does `collect_tree_entries` register entries while walking, and how does it treat an entry replaced after it was checked?
* **Governs:** f-20260905-05
* **Chosen:** Two passes. Pass 1 walks the tree: enumerate, `listed_mtime` before descent, read sidecar metadata, `confirm_entry` after the subtree. It registers nothing, so any pass-1 refusal leaves the registry untouched. Pass 2 registers in tree order, checking cancellation before each entry; a failure in pass 2 keeps what was already registered (plus the failing entry when its commit was durability-uncertain). Snapshot semantics: an entry replaced after its pass-1 confirmation is returned with a handle bound to the observed identity, and `resolve` refuses every use of that handle. Walk depth is bounded at 64 (root = 0), and deeper trees fail with `ResourceLimit`.
* **Rejected:** registering during the walk (a refused ancestor left descendant handles, W81); re-confirming every entry inside pass 2 under the authority lock (a replacement can still land right after, so this adds lock hold time without closing the window, per focused judgment W85); a registry transaction to roll back pass 2 (no such mechanism exists; registry churn is filed as f-20260913-06); an unbounded walk (a user-chosen tree is untrusted input).
* **Reason:** the handle carries the observed identity, so refusal on use already guarantees that no descriptor to a replacement reaches a caller. Pass-1 atomicity is testable and covers every refusal that happens before registration.
* **Decided by:** Claude Code, f-20260905-05 build run (focused judgments on W85 and W47) · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"a2926206aff387cfda6a9379e91a7c4c18d18a65584f43230680af98bb6d5a9b","input_sha256":"ca8b0da3e83aa6c9a9e82192c3322f7ff9f483dac32664e83c22f9186dd1f4cb","kind":"mutation-receipt","operation":"422accd66d9d36b89a23fce6f9e5bcad6cabeb83267d2a0c50d44aea221c2603","options":{"section":null},"request_id_sha256":null,"results":["d-20260914-02"],"target":"decisions-ledger","v":1} -->

### d-20260914-03 — What do descriptor-based listings do on non-unix platforms?

* **Question:** How do `CapabilityDirectory`, `capability_directory` and `collect_tree_entries` behave where no fd-relative directory API is ported?
* **Governs:** f-20260905-05, f-20260912-10
* **Chosen:** Refuse with `Error::Conflict`, using one message constant: "fd-relative directory enumeration is unsupported on this platform" (for the workspace listing, "workspace listing is unsupported on this platform"). Tests that route through the capability are `#[cfg(unix)]`, and test hooks are `cfg(all(test, unix))`.
* **Rejected:** keeping the old pathname walk as a Windows fallback (it reintroduces the exact re-resolution gap this finding closes); a partial Windows port inside this run (a separate area, filed as f-20260912-10).
* **Reason:** a silent pathname fallback would make the security property platform-dependent without any signal. An explicit refusal is visible and is reversed by the port.
* **Decided by:** Claude Code, f-20260905-05 build run · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"4834f7e05738f2640801ee9c4aea568cb695d3f17c5cfabf9ee363628e5889d3","input_sha256":"00935430e44f12e98280343dfeb5dd5a7f0a0f4473a13c05b70061084274c496","kind":"mutation-receipt","operation":"422702c6693a69c4a008337e8664bcecc96853bac8a635d55574555fdbc6a534","options":{"section":null},"request_id_sha256":null,"results":["d-20260914-03"],"target":"decisions-ledger","v":1} -->

### d-20260914-04 — How are db::repository test hooks isolated between concurrently running tests?

* **Question:** How do repository test hooks, which fire on worker threads, stay confined to the test that installed them?
* **Governs:** f-20260914-01
* **Chosen:** Scope by database path plus a configuration generation. `configure_test_hooks(scope, ..)` and `run_test_hook(hook, path)` normalise both paths like `DatabaseFileTarget::for_test_path` (canonical parent plus leaf); a hook fires, or counts, only when the path lies under the scope. A callback is written back only if the generation it was taken under is still current. Take, install and configure run under one hook-mutex hold, with the restoring guard created first. Both mutexes recover from poisoning.
* **Rejected:** thread-local hooks (hooked code runs on BLOCKING_GATEWAY and spawned workers); making every repository-opening test take `TEST_HOOK_SERIAL` (fragile, since any new test that forgets it reintroduces the race); a test-only seam proving configuration atomicity (that window no longer exists, so a seam at the old point would test the seam; the review-tests closure item was triaged Skip with that evidence).
* **Reason:** each test already owns a unique tempdir database, so the path is a natural owner key that survives thread hops. Before this fix, three of roughly five full `cargo test` runs reddened 15 tests.
* **Decided by:** Claude Code, f-20260905-05 build run (red gate) · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"bc4bbb77e5657694b5dd3c0e5cea1255b8f686666745631775bfb3b15069038d","input_sha256":"0da2e3634582e5b07e9c249a64ea41375a180ac473d47482cbcae6bb0ee37a6d","kind":"mutation-receipt","operation":"d2b1f840816048a952927fa93e95e6b8feed2bdeab287809e43e878552d3a8ca","options":{"section":null},"request_id_sha256":null,"results":["d-20260914-04"],"target":"decisions-ledger","v":1} -->

### d-20260914-05 — How does the Windows build refuse operations that are not yet ported, and in what order relative to their effects?

* **Question:** How does the Windows build refuse operations that are not yet ported, and in what order relative to their effects?
* **Governs:** f-20260830-06
* **Chosen:** every unported Windows operation ends in `Error::Conflict("<operation> is unsupported on this platform")` built by one module, `src-tauri/src/platform_support.rs` (`unsupported`, `unsupported_plural`, `off_unix_refusal`, one private format), with every existing suffix-free inline refusal routed through it byte-identically. Commands whose Windows path would perform an external effect (network, credential egress, creating/writing/renaming/deleting a filesystem entry) before refusing get the guard `crate::platform_support::off_unix_refusal("<op>", cfg!(unix))?;` as their first statement (S1-S8), as do four typed-first sites (T1-T4); ungated callers of Unix-only helpers get whole-function or two-block counterparts whose non-Unix body is only the refusal. Source tests on byte-offset-preserving normalised text pin guard placement, labels and counterpart bodies. Credential persistence keeps its redacted `CredentialFailure` categorisation.
* **Rejected:** a guard before every in-process effect in every command body (three plan-review rounds kept finding more bodies); one refusal table in the Tauri invoke handler (focused review-plan judgment UNSOUND: a name-only gate cannot express conditionally supported commands such as `analyze_game`, no completeness proof over 117 commands); pathname fallbacks; removing commands from the Windows build; carrying the refusal text through `CredentialFailure`; singular relabelling of the three plural refusals.
* **Reason:** a typed refusal is the crate's existing non-Unix convention and answers the Windows user honestly, while external effects before a refusal would send bearer tokens or leave files behind for an operation that cannot complete. In-process ordering and conditional capability gating are follow-up (h). Full review history: `tasks/handoffs/2026-09-14-f-20260830-06-slice-1-review.md`.
* **Decided by:** Claude Code, autonomously under `full auto` in a drain session · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"7546161621fd13be225b11835031390ae761fadc3aef318f8a69aaa7a6046cb5","input_sha256":"ac11f773668d13ac9ffbd24a926af18a1a306826bc17afff2bc0abbfd9061ed0","kind":"mutation-receipt","operation":"dbb4aadf6a9b32e4584f0abd99ead59df9f808072f3916d97d9de9c00fa36ee4","options":{"section":null},"request_id_sha256":"1b6bef526401d51eb892e7ae28b2ff16410ec30e896e1cde094721d9a2a007be","results":["d-20260914-05"],"target":"decisions-ledger","v":1} -->

### d-20260914-06 — How does the macOS port detect mount crossings and canonicalise raw-stat identity without the Linux-only statx/fdinfo primitives?

* **Question:** How does the macOS port detect mount crossings and canonicalise raw-stat identity without the Linux-only statx/fdinfo primitives?
* **Governs:** f-20260830-06
* **Chosen:** Linux keeps statx `MOUNT_ROOT` plus the fdinfo fallback unchanged (d-20260830-01, d-20260906-02). Other Unix compares the `f_mntonname` of the parent's and child's held descriptors via `fstatfs`, failing closed on an unavailable, unterminated or empty mount path, with the existing `st_dev` backstop kept. Raw-stat identity goes through one `raw_stat_identity` helper that casts the device with `as u64`, exactly as std's Apple `MetadataExt::dev()` does, and a source test proves the device field is read in exactly one place.
* **Rejected:** `st_dev` alone (an equal-device mount would pass); `f_fsid` (private field on Apple, needs `unsafe`, no added detection power); refusing every macOS recursive delete (disables a supported feature without a security reason); `u64::from(dev as u32)` (differs from std for negative `dev_t`, so raw-stat and metadata identities could disagree).
* **Reason:** `f_mntonname` is the mount point of the filesystem holding the descriptor, so a child that is a mount root always differs from its parent; it is available from portable rustix without `unsafe`.
* **Decided by:** Claude Code, autonomously under `full auto` in a drain session · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"98196c994638de620956cd98c443f607dd0b401cd5cb56a2efedb6e7b61e6e38","input_sha256":"ca8d1538f4859c464bae8a7c5a9405b4027cf0d9d170da4d5907f1a8836abf0c","kind":"mutation-receipt","operation":"f384e282687b85cd4f869c9a5bea29944bd1b01ea3d439c36e68b82db982d9a4","options":{"section":null},"request_id_sha256":"810b6d9e4747491e819085ffb14f2e113466d5cfb72af63c4044eb8137609bd5","results":["d-20260914-06"],"target":"decisions-ledger","v":1} -->

### d-20260914-07 — How are recursive directory walks enumerated and bounded once `RawDir` (Linux-only) is replaced for macOS?

* **Question:** How are recursive directory walks enumerated and bounded once `RawDir` (Linux-only) is replaced for macOS?
* **Governs:** f-20260830-06
* **Chosen:** one private `rustix::fs::Dir` walker on every Unix, shared by `read_directory_entries_at`, `sync_tree` and `remove_tree_at`. The depth cap of d-20260830-02 (`MAX_REMOVE_TREE_DEPTH = 64`) is kept and now also bounds `sync_tree`, which recursed without a limit. Its resource accounting is restated: no per-level stack buffer; on Linux a heap buffer per open level whose growth rustix caps (`rustix-1.1.4/src/backend/linux_raw/fs/dir.rs:251-254`, under 100 KiB); on macOS libc's `DIR` buffer, 2048 bytes growing once to 8 KiB (Apple Libc `gen/FreeBSD/opendir.c`, `readdir.c`, `telldir.h`), with union mounts — where libc reads the whole directory into memory — refused before the stream is opened; two descriptors per open level (at most 129 for one walk).
* **Rejected:** keeping `RawDir` on Linux beside a `Dir` walker for macOS (two walkers for one enumeration); an explicit-stack walk (already rejected by d-20260830-02 on descriptor grounds); leaving `sync_tree` unbounded.
* **Reason:** this does not reverse d-20260830-02 — its chosen depth cap stays — it only replaces the stack-buffer product the decision named with the bound the new primitive actually has. The macOS figures come from reading Apple's Libc source, not from a runtime measurement on macOS.
* **Decided by:** Claude Code, autonomously under `full auto` in a drain session · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"a1f90b6008834a6c4d3ed8afeb3a84885e1b52753b1f86e1f7418ee1ccebb1b3","input_sha256":"2e7b6e1f17839809352506cfaede5b3119369bf1d35f1c66f0c65f7e6504fb9e","kind":"mutation-receipt","operation":"8cb2e697a028471dae826bcfa203e61048246dd9cb0b0c044ec5c2fe4ee4a278","options":{"section":null},"request_id_sha256":"aa8d6ff0ec0dbd4973af7c0ec91d4dc7231e302a1f30e4626b59fdeda1440cb0","results":["d-20260914-07"],"target":"decisions-ledger","v":1} -->

### d-20260914-08 — Which CI jobs prove the non-Linux targets, and how is their coverage enforced?

* **Question:** Which CI jobs prove the non-Linux targets, and how is their coverage enforced?
* **Governs:** f-20260830-06
* **Chosen:** `test.yml` job `rust-platform` runs `cargo check` and `cargo clippy -D warnings` (`--all-targets --locked`) on real runners for `aarch64-apple-darwin`, `x86_64-apple-darwin` and `x86_64-pc-windows-msvc`; job `rust-macos-test` runs the whole routed Rust test suite (`cargo test --manifest-path src-tauri/Cargo.toml --all-targets`) on `macos-latest`. Neither job has `if:` or `continue-on-error`. `scripts/check-tool-version-parity.mjs` registers both jobs for the setup-toolchain contract and enforces a target-coverage contract against `REQUIRED_NON_LINUX_TARGETS`, the release matrix and the job matrix; every failure path has its own message and a CLI fixture test asserting that message and exit status 1. After push the `rust-macos-test` log is read to confirm the named macOS port tests ran.
* **Rejected:** a Windows `cargo test` job now (follow-up (a); review-plan judgment DEFER-ACCEPTABLE); a filtered macOS test run (a libtest filter that matches nothing exits 0, so it could silently run zero tests); a new script asserting named tests ran (reading the CI log suffices); duplicating `check-gate-routing.mjs`'s `if:`/failure-tolerance checks in the parity checker; making the local zig GNU cross-check a blocking proof (it is an advisory iteration aid; the MSVC CI leg is the Windows proof).
* **Reason:** f-20260830-06 names the missing gate as the real defect, and d-20260830-20 forbids a gate that reports success without checking. A red job is truthful; a job that skips is not.
* **Decided by:** Claude Code, autonomously under `full auto` in a drain session · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"de3b8b553847e1b40ade7922ef947381a154148a31e069b24d4c551a0c3d47a9","input_sha256":"d58148f35999452f6df4a7425ff0c3c5da765525a77bd374508e6737993bf799","kind":"mutation-receipt","operation":"0eb88efbbe83ab2d977eb7c13521dfdeb0ee775625ea4ace274add9faf13f7c3","options":{"section":null},"request_id_sha256":"e3a166d7d06446eaba4cbd50ace71d1da4a157c3510c7b8f6ff7cf117b761dd6","results":["d-20260914-08"],"target":"decisions-ledger","v":1} -->

## 2026-09-15 — recorded through the decisions lock

### d-20260915-01 — Which signal proves on APFS that a held directory was removed, and which walks enforce it?

* **Question:** Which signal proves on APFS that a held directory was removed, and which walks enforce it?
* **Governs:** f-20260914-32
* **Chosen:** one shared check, `ensure_directory_not_removed`, runs after the walk of each held directory in `read_directory_entries_at`, `sync_tree` and `remove_tree_at`: every non-Apple Unix target keeps `fstat(dir).st_nlink == 0`; Apple takes `rustix::fs::getpath(dir)` and compares `lstat` of that path with `fstat(dir)` by device and inode (`held_matches_path`), treating `ENOENT`, `ENOTDIR` or a mismatch as removed. In the listing walk the existing post-walk cancellation check runs first, so a cancelled listing never reports removal; `sync_tree` and `remove_tree_at` have no cancellation check. Install therefore refuses a source removed mid-walk instead of installing a partial tree, and recursive delete reports the removal (wrapped as `PartialRemoval` when entries were already removed).
* **Rejected:** `st_nlink` on APFS (measured: stays 2 after `rmdir`); `openat(dir, ".")` (measured: succeeds after `rmdir`); creating a probe child with `O_CREAT|O_EXCL` (measured `ENOENT` after removal, but it writes into user directories).
* **Reason:** measured on the macOS runner (run 34872901465): the path of a removed directory no longer resolves, or resolves to a different object after same-name recreation, while a directory renamed away keeps its identity at its new path and is correctly still live.
* **Decided by:** Claude Code, autonomously under `full auto` · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"0f5b5d5d2dc63ec2db25ce26ce45c1b9ec2e259a0242a12b67688af7f30208f7","input_sha256":"183a74a614df90787335876b6531f4365733ebc2620a8bd5d03650f934294da9","kind":"mutation-receipt","operation":"d12bc3950f59cf68268d6e873f440e3e52c0c9aa1ce34fd7f505e4e8754111d4","options":{"section":null},"request_id_sha256":null,"results":["d-20260915-01"],"target":"decisions-ledger","v":1} -->

### d-20260915-02 — What replaces `/proc/self/fd/N` for engine launch and UCI resources on macOS while keeping descriptor pinning?

* **Question:** What replaces `/proc/self/fd/N` for engine launch and UCI resources on macOS while keeping descriptor pinning?
* **Governs:** f-20260914-31
* **Chosen:** on `target_os = "macos"` every launch flow (interactive analysis, report analysis, `get_engine_config`, game engines) goes through one helper, `resolve_launch`: the engine is admitted first; executable and resource leases are resolved under the path-authority lock on the blocking gateway; last-wins duplicate options collapse to the effective set; then the executable and every effective file resource are pinned from the held, authorised descriptor into an app-private per-instance directory `engine-launch/<uuid>` (mode `0o700`, owned through an `flock` held for the process lifetime; a startup sweep removes only siblings whose lock is free). Pinning uses `fclonefileat` and falls back to a `pread` copy through the same descriptor on `EXDEV` or `ENOTSUP`; the file lease's UCI value is its pinned leaf path. Directory resources cannot be pinned: they are sent as `getpath(held)`, and before any option is sent the calling flow verifies every resource value against the actor's held leases on the gateway, raced against the actor interrupt, the report operation token and a 2 s deadline; the actor re-checks the operation token immediately before each `setoption` write. Leaves live in one registry capped at `MAX_ENGINE_LAUNCH_LEAVES = 64` slots reserved before creation; a guard's `Drop` only releases its slot, and released leaves are reclaimed at the next pinning job, after engine teardown at exit, and by the next start's sweep. Linux keeps procfs values and inherited descriptors; Windows is unchanged; other Unix targets fail with `compile_error!`.
* **Rejected:** `/dev/fd/N` (opening it on macOS duplicates the descriptor and shares its offset, and an interpreter script re-opening the path after `exec` loses a close-on-exec descriptor); `posix_spawn` of the original path with an identity re-check (leaves a substitution window between check and exec); passing resources as inherited descriptors (no UCI value an engine could open).
* **Reason:** a clone or copy made from the held descriptor is the same bytes that were authorised, at a path only this instance owns, so replacing the original after authorisation cannot change what the engine executes or reads (L2-class substitution resistance). Same-UID mutation of app-private state is outside the boundary the Linux arm defends (focused judgment in the review record, APPROVED). The residual for directory resources — a rename window between verification and the engine's open — is accepted and recorded here, as the judgment chose a pre-send identity check over refusing directory resources. Measured: `fclonefileat` from a descriptor on the macOS runner (run 34875031951).
* **Review:** `tasks/handoffs/2026-09-14-macos-engine-launch-review.md`
* **Decided by:** Claude Code, autonomously under `full auto` · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":9,"effect_sha256":"42db8ae96a377819ec35ec7d0494a20d28ff27e971283274f0d8363847521ad7","input_sha256":"06b4028717a9571247be08cf5fd54938cdda034b455cadf2a8e27fc9ba7abce4","kind":"mutation-receipt","operation":"7ed7647b3ace5d26d4ffb248f74ef529724e1890564421d619730dfa432ee9e3","options":{"section":null},"request_id_sha256":null,"results":["d-20260915-02"],"target":"decisions-ledger","v":1} -->

### d-20260915-03 — How does the path authority bind a user-selected pathname whose ancestor is a symlink?

* **Question:** How does the path authority bind a user-selected pathname whose ancestor is a symlink (macOS `/tmp`, `/var`, a symlinked home), so the stored spelling is usable by every later no-follow descriptor walk without giving up the ancestor-swap guarantee?
* **Governs:** f-20260914-33
* **Chosen:** (1) canonicalise user-selected pathnames once at acquisition, through one private `acquire_target(path, Dialog|File|Root)` in `infra/path_authority/mod.rs` that `database_file_target` shares: validate the caller's spelling as before, `canonical_binding`, then prove the canonical spelling by the no-follow descriptor walk `open_verified_parent` ending in the validated identity; the stored `(path, identity)` is the proven canonical pair. (2) Only doors called without a descriptor-verified expected identity acquire (dialog grants, legacy migration, the three folder pickers through `get_or_create_root`, the opening-book picker through `get_or_create_persistent_file`); doors with `expected_identity = Some` keep their `AuthorizedDir` spelling and today's validation. (3) One validation per registration, carried into persistence (`get_or_create_root`'s fallback persists the acquired pair through `persist_entry`); `promote_dialog` re-proves and refuses a changed path or identity with `Conflict("dialog target changed before promotion")`. (4) `create_pgn_export_destination` creates descriptor-relative (`create_regular_at`) under the canonical parent opened no-follow, whose identity must equal the identity of the directory the caller's spelling named; cleanup of a created file is `remove_entry_at` through that descriptor, and a failed export also removes its dialog grant. (5) No guarantee about a same-inode relocation raced before canonicalisation. (6) Leafless selections (`/`, trailing `..`) are stored unchanged; entries persisted earlier under a symlinked spelling are not rebound here (`f-20260914-36`); ancestor-swap refusals keep the existing `Error::Io` variant.
* **Rejected:** use-time canonicalisation (follows an ancestor swapped after selection); pathname identity after canonicalisation instead of the descriptor proof; acquiring descriptor-verified `AuthorizedDir` spellings (breaks `cleanup_engine_images`' lexical parent match and default-root reuse after a swap); covering only dialog, migration and PGN doors (the folder and opening-book pickers would keep storing refused spellings); a second canonicalisation inside the root fallback; ancestor-following promotion; pathname `create_new` for PGN export, or creating under the canonical parent without the parent-identity check (a swap before canonicalisation would create in an attacker-chosen directory); recording every ancestor's identity to rule out same-inode relocation.
* **Reason:** the database door already bound legacy paths to their canonical parent, so the same user selection was accepted through one door and unusable through the others; one shared primitive makes every caller-supplied acquisition store a spelling the no-follow walk accepts while any symlink or different inode met by the proof still refuses. Seven plan-review rounds (65 issues) and the cumulative diff review: `tasks/handoffs/2026-09-14-f-20260914-33-review.md`.
* **Decided by:** Claude Code, autonomously under `full auto` · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"24e541f385639ff5648f97dfe261ee59eacf3003c5fee347c652908e346d0e12","input_sha256":"d5bfdad29f4d30b4bd2dcc3dbffce6ed9b2922bbde14c18ddbf440469510fe6c","kind":"mutation-receipt","operation":"98be499f0f406297df3174c5ffe99214c54e7a587c1a5dbabf8c20c18dec542e","options":{"section":null},"request_id_sha256":null,"results":["d-20260915-03"],"target":"decisions-ledger","v":1} -->

### d-20260915-04 — What happens to a dialog grant whose promotion fails?

* **Question:** When `PathAuthority::promote_dialog` fails after it has looked up a live dialog grant (target changed, operation escalation, unique-ID limit, registry write failure), does the one-use grant stay in the bounded dialog table or is it consumed?
* **Governs:** f-20260914-33
* **Chosen:** the grant is consumed: `promote_dialog` removes it from `self.dialogs` immediately after the lookup, so every later error path leaves no grant behind; success and `CommittedDurabilityUncertain` are unchanged (the commit already consumed it). `create_pgn_export_destination` no longer tracks and removes its own grant. Tests that pinned preservation (`failed_persistence_keeps_memory_and_dialog_grant_intact`, `unique_id_limit_counts_the_union_and_failed_promotion_preserves_its_dialog`, the two engine-resource `ResourceLimit` cases) now assert consumption, and `promotion_conflict_removes_the_replaced_target_grant` covers the conflict path.
* **Rejected:** keeping the grant on failure (the behaviour pinned in `4494070f`, not backed by a recorded decision): no production caller retries a promotion with the same grant id — `issue_file_workspace_blocking`, `issue_pgn_workspace_blocking`, `issue_download_destination_blocking`, the engine resource promotion and the PGN export door all grant and promote in one call and drop the id on error — so a kept grant is unreachable until its TTL and can evict live grants when the bounded table fills; removing the grant only in each caller (five copies of the same cleanup).
* **Reason:** `.claude/rules/async-resource-invariants.md` requires cleanup on every exit path and bounded registries; the promotion is the one owner that sees every failure. The f-20260914-33 promotion re-proof made the conflict path reachable by an ordinary ancestor swap, which surfaced the leak (Codex `review-error-handling` diff lens, confidence 86). Review record: `tasks/handoffs/2026-09-14-f-20260914-33-review.md`.
* **Decided by:** Claude Code, autonomously under `full auto` · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"c86e6b72a3954256ddfc356f3474eeb60be6b6e901ba214388f71978a95d7f94","input_sha256":"dfafd4c17574399327004ed023f69f747f92d44842b278c4578d1ddbb71b5632","kind":"mutation-receipt","operation":"44c50117b54668ae38d03a6fdf641ebc3bd846784ac1b6dbab0641f9308169ac","options":{"section":null},"request_id_sha256":null,"results":["d-20260915-04"],"target":"decisions-ledger","v":1} -->

## 2026-09-16 — recorded through the decisions lock

### d-20260916-01 — How is the Windows Rust job green before the Windows port, and how does every Windows refusal get an assertion that executes there?

* **Question:** How is a `rust-windows-test` job green before any test is ported to Windows, without becoming a gate that checks nothing — and how does every Windows refusal get an assertion that actually executes on Windows, given that a runtime test cannot observe a refusal for an arbitrary pathname?
* **Governs:** f-20260914-07
* **Chosen:** five obligations, all landed in `aadc4dd5` and `56e4600b`. (O1) a repository-root `.gitattributes` of exactly `* text=auto eol=lf`, so a Windows checkout cannot hand CRLF to scans that pin exact bytes. (O2) the four leaf-validation tests in `infra/fs.rs` build their parent from a regular file instead of a Unix-only fixture, so they run on Windows rather than being skipped. (O3) the 81 tests that genuinely assume Unix semantics carry `#[cfg_attr(not(unix), ignore = "unported on this platform: <owner>")]`, owner being the finding that will port them (63 `f-20260914-10`, 18 `f-20260914-11`); libtest prints the reason, so the Windows log names the owner of every skip instead of hiding it. (O4) all 40 Windows refusal sites are pinned by exact source assertions in `infra/platform_support.rs` — 29 body rows and 11 guard rows pinning the effective non-unix body, its cfg form and its enclosing scope and module declarations, plus the `UNSUPPORTED_DIRECTORY_ENUMERATION` declaration and the two callees on the effective path — which execute on every platform and report by row rather than fail-fast. (O5) the `rust-windows-test` job itself (`windows-latest`, no matrix, no `if:`, no `continue-on-error`, the same receipt command as the other Rust jobs, and a `mkdir -p dist` step because `tauri::generate_context!()` reads `frontendDist` at compile time), enforced by `check-tool-version-parity.mjs` through one `RUST_TEST_JOBS` table that drives clauses (7a), (7b), (7c) and derives the job registrations, so a third Rust test job cannot be added unenforced.
* **Rejected:** runtime Windows refusal tests (a runtime test cannot observe a refusal for an arbitrary pathname, so it could not cover the sites that matter — the r3 focused architecture judgment); skipping the whole suite on Windows behind a step-level `if:` (a gate that checks nothing, and `check-gate-routing.mjs` rejects it — staged and measured: `Gate routing check: FAIL`, exit 1); leaving the 81 unported tests failing on Windows (a permanently red job nobody owns); a bare `ignore` without a reason (the skip becomes anonymous and no finding owns the port); `git add --renormalize` as the O1 proof (a whole-tree add, refused, and replaced by three independently messaged non-staging assertions).
* **Reason:** `d-20260914-08` (a) chose the Windows job; `d-20260914-05` fixed the refusal architecture this pins (every unported Windows op ends in a typed `Error::Conflict` built by `platform_support.rs`, with the guard placed first where an external effect would otherwise precede it); and the r3 focused judgment settled that the only assertion that can cover an arbitrary-pathname refusal is an exact source pin that executes everywhere. Proven on a real runner: run 35049284019, job `rust-windows-test` — `462 passed; 0 failed; 81 ignored`, all 81 ignores naming their owner, the four O2 tests `ok`, and eight `infra::platform_support::tests::` lines `ok`, equal to the Linux count, so no pin is compiled out on Windows. Every pinned class was staged and seen to fail with its own message. Two limitations are explicitly not closed here and became the successor `f-20260916-01` under rule 12a after fifteen rounds without convergence: the four shared-helper pins are argued rather than staged (staging them would mean editing the verifier's own source, which push-review-policy section 2 forbids), and nothing yet ties the row tables to the set of refusals that actually exist.
* **Review:** `tasks/handoffs/2026-09-16-f-20260914-07-review.md`
* **Decided by:** Claude Code, autonomously under `full auto` · **Superseded-by:** d-20260916-06
<!-- ledger-meta {"command":"record-decision","effect_lines":9,"effect_sha256":"8e040e7207913448baa99353d2563455912a1562aee18062ce808a35cae8a844","input_sha256":"6bffb380a9390eb25ed5c9dd6c51bc161bd0e5223f56994726f645f77974eee8","kind":"mutation-receipt","operation":"e3b6fdfa37a69cf74b408293dde71a61419932298b4692686fb08aecda8ee9a0","options":{"section":null},"request_id_sha256":null,"results":["d-20260916-01"],"target":"decisions-ledger","v":1} -->

### d-20260916-02 — How does the refusal-pin count stay self-consistent while four phases add and remove rows?

* **Question:** O5 states the end state as 36 refusal sites (40 - 5 + 1), but the removals are split across Phases B and C while the addition lands in Phase A. What count does each phase's commit document, given the pins execute on every platform and every phase must end green?
* **Governs:** f-20260914-10
* **Chosen:** each phase documents the count that is true at its own commit, verified by counting the actual rows rather than copying a number from prose. Phase A 40 -> 41 (adds the replace_pgn_atomic guard row), Phase B 41 -> 39 (removes two atomic_replace body rows), Phase C 39 -> 36 (removes three download guard rows). Final state 36 = 27 body + 9 guard.
* **Rejected:** writing 36 in Phase A as O5's text literally says. The pins are executable assertions, not documentation: a documented 36 against 41 actual rows is either a red gate or a lie, and Phase A would not have ended green.
* **Reason:** rule 4a requires every section to end green and individually pushable. O5's "36" is the end state after all phases, which its own arithmetic (40 - 5 + 1) makes explicit.
* **Decided by:** Claude Code, autonomously under `full auto` · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"04483a089b73b0b582a66bd539335777bf935c79b3a833d7263e3b2d3bc341c6","input_sha256":"38878efd1aa3d2c9f449711d195485011779c2c34355e8c55c96c78d83954a15","kind":"mutation-receipt","operation":"543b80631ef4ef2e8ff020dd128d56a04c953e1bfa7c6eb67564002e3fb763ba","options":{"section":null},"request_id_sha256":null,"results":["d-20260916-02"],"target":"decisions-ledger","v":1} -->

### d-20260916-03 — Which phase owns the routed row and the refusal-text carve-out?

* **Question:** O5 lists the routed-row deletion and the refusal_text_has_one_source carve-out narrowing "in the same commits" as the refusal removals. Phase A owns the replace_pgn_atomic refusal plus its guard row (R11-06). Do the routed row and carve-out go with Phase A as well?
* **Governs:** f-20260914-10
* **Chosen:** no. Both belong to Phase B, whose manifest names them explicitly ("two body rows, routed row, carve-out, counts"). They depend on infra/fs.rs refusals that only Phase B removes.
* **Rejected:** doing them in Phase A, which was attempted and measured: `refusal_text_has_one_source` failed on fs.rs:1524 and `routed_refusal_labels_are_unchanged` failed 6-versus-7, because the fs.rs sites those rows pin were still present.
* **Reason:** the orchestrator's Phase A assignment misread O5's "same commits" as attaching all of it to Phase A. The leaf reported it as a scope contradiction and stopped rather than improvising, which was correct. Reverted in Phase A, landed in Phase B.
* **Decided by:** Claude Code, autonomously under `full auto` · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"b940c441aaf865a1360b358493258ace8e909c387282a0649a66735721673919","input_sha256":"b83eb8fd57899270a15ae44f9882a732f42ad964b5f42c9016472549f400cd64","kind":"mutation-receipt","operation":"421cc600b6240328498f2c6df456708fcf96068729e49ff54fdcf83b6a382167","options":{"section":null},"request_id_sha256":null,"results":["d-20260916-03"],"target":"decisions-ledger","v":1} -->

### d-20260916-04 — Does the Windows parent descriptor follow is_write_operation, or its own predicate?

* **Question:** resolve_windows derived both the parent open and the child access from is_write_operation, which does not contain DownloadFile. R1-03 requires a writable parent for replacing operations; R2-02 requires the child's access to keep is_write_operation's membership. Which predicate governs the parent?
* **Governs:** f-20260914-10
* **Chosen:** two predicates. parent_writable = is_write_operation(op) || allows_missing_leaf(op), used for the root open and every intermediate component, because the parent handle is whatever the walk last produced. The child's access keeps is_write_operation unchanged.
* **Rejected:** extending is_write_operation with DownloadFile (R2-02: it would force an existing target open writable and fail for a target whose DACL permits delete/replace but denies write); and leaving one predicate (measured consequence: E2 recorded FlushFileBuffers returning os error 5 on a GENERIC_READ directory handle, and the retained parent also serves FILE_CREATE, so Windows downloads would fail at temp creation).
* **Reason:** found by the Phase C leaf, which reported it rather than working around it. resolve_windows is cfg(windows) and nothing on Linux compiles it, so the two predicates are pinned by an exact source assertion that also rejects the collapsed form.
* **Decided by:** Claude Code, autonomously under `full auto` · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"463719c7c2959c99fb95e25ad195875d1b2bf07e7132660a6c98546fd5de2aa4","input_sha256":"57e6a12e5b90b2c7cd53b609bac494643abe64a23f27b12e3a5579cab435b75c","kind":"mutation-receipt","operation":"810dac841ed2eddb48ffe5c3243c425989c0347eaadbf6da8e39387c9629bc7d","options":{"section":null},"request_id_sha256":null,"results":["d-20260916-04"],"target":"decisions-ledger","v":1} -->

### d-20260916-05 — Do platform-independent source-scan tests carry the non-unix ignore attribute?

* **Question:** Phase C's three new command-entry tests are include_str! source scans asserting the download commands no longer refuse. R6-02/R7-04 say new tests carry the ignore attribute at the test-first commit. Do these?
* **Governs:** f-20260914-10
* **Chosen:** no. They are platform-independent and must execute on Windows, which is the platform whose refusal removal they assert. The markers were removed.
* **Rejected:** keeping the markers, which would mean the Windows runner never verifies the commands stopped refusing, and would make the phase's "15 executed" Windows assertion unreachable (only 12 would run).
* **Reason:** same precedent as R8-03, where Phase A's relocated test is non-ignored because its proof is that it runs on Windows at all. The ignore attribute exists for tests that cannot pass on Windows yet, not for tests whose whole purpose is to pass there.
* **Decided by:** Claude Code, autonomously under `full auto` · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"7a50935c1d6a48dc3cfb4ff3e0edb95c3e51a70284b2675ae6dfbc9e21ea15f2","input_sha256":"59d58ac83dc666f67b5c6e97aaf1e5d342a3ce8ad87370c49881922204db75ae","kind":"mutation-receipt","operation":"f5b395c20e8d8cca9820c8c3a71b699231efd3bc331707f9cb4339552c286ffa","options":{"section":null},"request_id_sha256":null,"results":["d-20260916-05"],"target":"decisions-ledger","v":1} -->

### d-20260916-06 — What are the Windows marker and refusal-site counts after the atomic-replacement port?

* **Question:** `d-20260916-01` recorded 81 gated tests (63 `f-20260914-10`, 18 `f-20260914-11`) and 40 Windows refusal sites. The `f-20260914-10` port removes refusals, removes and authors markers, and re-attributes others. What do those two records say now, and does the pin mechanism itself still hold?
* **Governs:** f-20260914-07, f-20260914-10
* **Chosen:** both numbers move; the mechanism is reaffirmed. **Markers: 48 remain — 19 `f-20260914-10` + 18 `f-20260914-11` + 11 `f-20260914-08`**, down from 81. Derived per marker: 63 f10 → Phase B (−36 removed, +15 new Windows tests) = 42 → Phase C (−11) = 31 → Phase D (−1 search-index, −11 re-owned to `f-20260914-08`) = 19; `f-20260914-11`'s 18 untouched. The 11 re-owned `pgn.rs` tests never reach `replace_pgn_atomic` — they are blocked at fixture construction by `create_pgn_export_destination`, which is `f-20260914-08`'s surface; the 4 that do reach a write path through `writable_for` keep `f-20260914-10`, because once f08 lands they are blocked next by the refusal this port added. **Refusal sites: 36**, counted as 27 body rows + 9 guard rows (40 − 2 `infra/fs.rs` body rows − 3 download guard rows + 1 `replace_pgn_atomic` guard row). Commits `772d4558`, `68f1f065`, `e32d8f46`, `97e8db57`, `400b7f7b`.
* **Rejected:** treating `d-20260916-01` as wholly superseded. Its choice — that an arbitrary-pathname Windows refusal can only be covered by an exact source assertion executing on every platform — is not overturned but relied upon: the port added four more such pins (the temporary's creation descriptor and share mask, the real durability calls with their receivers, post-rename identity from the retained handle, the writable-parent predicate), each carrying a Windows property no runtime test on any platform can observe. Also rejected: recording the leaf's claim that "the logical accounting remains 81 tests, including module-level cfg-gated tests without literal markers" — `d-20260916-01` states all 81 carried literal markers, and the arithmetic above accounts for the drop without that category.
* **Reason:** clause 2 supersession — new evidence (the port itself), prior decision named, trailer set. The numbers were derived by counting markers per file and per owner in source, not by copying the plan's prose; an earlier revision of that plan recorded a sweep total that reconciled while both of its parts were wrong (`f-20260914-10` review, R18-01), which is why this record states the derivation.
* **Decided by:** Claude Code, autonomously under `full auto` · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"25c90dcd92068e72fe6e1ab57356e1d93806a9275f9dbd76249d5ec29e505111","input_sha256":"c469e9bafecea19270f6d0e2eb3ede6edf565cffe46d65051035ae9d053101c9","kind":"mutation-receipt","operation":"24e10c0056bbfda816ea2c386e250f632431e60388a7ba5df436b91ae9052580","options":{"section":null},"request_id_sha256":null,"results":["d-20260916-06"],"target":"decisions-ledger","v":1} -->

### d-20260916-07 — How can the Windows arm be verified on a machine with no Windows toolchain and an unanswerable sudo prompt?

* **Question:** The cfg(windows) code added by f-20260914-10 had never been compiled anywhere, and its Windows claims rested entirely on source pins in infra/platform_support.rs. The local `apt-get install mingw-w64` route needs a graphical sudo dialog that went unanswered twice. Do the claims stay pinned-only, or is there a way to actually type-check the Windows target here?
* **Governs:** f-20260914-10
* **Chosen:** install the MinGW cross toolchain unprivileged into ~/.local/opt/mingw and run `cargo check --target x86_64-pc-windows-gnu --all-targets`. `apt-get download` and `dpkg-deb -x` both work without root (10 packages, 115 MB). `dpkg-deb -x` unpacks but never configures, so the update-alternatives symlinks are absent: the prefix ships x86_64-w64-mingw32-gcc-posix and -win32 but no unsuffixed driver, and creating that symlink is what makes cc-rs find it. Measured: `x86_64-w64-mingw32-gcc (GCC) 13-posix`, and a trivial C file compiles to an object with exit 0.
* **Rejected:** waiting for the sudo dialog (it had been pending over seven minutes with nobody at the machine; a blocked sudo never completes, so the run would have stalled rather than waited — the dialog was left alive deliberately, so answering it later still completes the original job); and continuing to rely only on source pins, which remain valuable for semantic regressions a type-check cannot see, such as an access mask losing GENERIC_WRITE, but cannot catch a wrong winapi signature, and did not.
* **Reason:** `cargo check` does not link, but it does run build scripts, so zstd-sys needs a working C cross-compiler regardless — that is why the first attempt died with `error occurred in cc-rs: failed to find tool "x86_64-w64-mingw32-gcc"` before reaching this crate at all. The first run of the check then found nine compile errors in code that four review lenses and a full plan review had passed over: five were the security-descriptor pointer casts two lenses did find, and four (SECURITY_DESCRIPTOR_REVISION imported from the wrong module, the NT FILE_OPEN_REPARSE_POINT constant missing, std::io::Write wrongly cfg(unix)-gated, expect_durable called on the wrong type) were found by nothing but the compiler. A later Windows `clippy -D warnings` run caught a redundant pointer cast that the Linux gate cannot see. This directly advances f-20260830-06. Reversal: delete ~/.local/opt/mingw; nothing in the repository depends on it, it is a local verification instrument and no gate invokes it.
* **Decided by:** Claude Code, autonomously under `full auto` · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"88a25e094b48fd425833392564fb4f20d4d1c1843cc560e7b5215a8edf6365b0","input_sha256":"6a73551b5c246a34e62e8f2e8db967a6b39a8f37a84d3a32ac33b68197a0d793","kind":"mutation-receipt","operation":"6b7c8454fa62e2c44bbe1594fb86223634c1b9173f631105ee32a65d3ba655c3","options":{"section":null},"request_id_sha256":null,"results":["d-20260916-07"],"target":"decisions-ledger","v":1} -->

### d-20260916-08 — How is the mandatory push review completed when every Gemini lens dies on quota?

* **Question:** Nine review lenses were launched on agy/Gemini under executor `gemini` for the f-20260914-10 push. All nine failed. review-correctness and review-root-cause are always-on mandatory lenses, and push-review-policy states that missing, failed or unavailable required reviews are never approval or coverage. How is the review completed?
* **Governs:** f-20260914-10
* **Chosen:** re-launch every failed lens as an ordinary Codex leaf through ~/.claude/scripts/leaf-quota-retry.py, the documented §1d agy quota-recovery path in ~/.claude/references/executor-profiles.md, at the same `--role sensitive`. The helper classified all seven of the second wave as `quota-check=identified`. This also matches what Felix asked for during the run: "All lenses with codecs from now on because Gemini is out of quota."
* **Rejected:** waiting roughly four hours and twenty minutes for the Gemini quota to reset; using orchestrator-native subagents, which §1d forbids explicitly in this branch; and treating the missing lenses as coverage, which the push policy forbids outright. The push was held until the mandatory lenses returned.
* **Reason:** the two failure waves were different and only one was recoverable. Two lenses (minimalism, ipc-contract) died on Gemini 503 "No capacity available" after producing complete reports; agy-leaf-report.py fail-closes on a non-SUCCESS result so it wrote no report file, and both were recovered from the JSONL delta stream and used. The other seven died with `status: ERROR` and the provider error "Individual quota reached ... Resets in 4h23m", each after 31 to 33 minutes and 2.4 to 3.0M input tokens, with num_turns 1 and no message or delta events at all — there was nothing to recover, because they were cut off mid-investigation before emitting any report. That exact provider string on the final top-level `event: result` with nonzero real-turn usage is precisely the evidence §1d defines as an identified quota failure. Operational note for the next run: the first retry attempt failed with "Argument list too long" because the `prompt` positional of both leaf-quota-retry.py and leaf-launch.sh is a path to a prompt file, not prompt text; measured on this machine, a 131000-byte argument succeeds and 131073 fails, so the per-argument ceiling is exactly 128 KiB regardless of the 2 MB ARG_MAX.
* **Decided by:** Claude Code, autonomously under `full auto` · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"549b20f80dfd20cb73a25b3ac33f4d747f2297eb8c8372403ab47ea5b1117e96","input_sha256":"a51c71f5724f76433f5447bdf2d59eb5d93ebf023d0e867c687855e3c7fac67e","kind":"mutation-receipt","operation":"e13b4b454f6b33ff3b3054a94a5ea9a4db0f1b5245e5afc40d776a22f387c701","options":{"section":null},"request_id_sha256":null,"results":["d-20260916-08"],"target":"decisions-ledger","v":1} -->

### d-20260916-09 — Which findings of the f-20260914-10 push review were adopted, and on what evidence were the rest refused?

* **Question:** Nine review lenses returned eight REVISE verdicts and one APPROVED against the f-20260914-10 Windows atomic-replacement port. Which findings were fixed in the push, which were filed, and what evidence refused the remainder?
* **Governs:** f-20260914-10
* **Chosen:** fix every compile-level and security-level defect in the push, since a Windows cross toolchain now proves them (d-20260916-07); file the design questions and the cosmetic ones as ledger findings f-20260916-08 through f-20260916-12. Fixed: nine Windows compile errors, of which five were the security-descriptor pointer types reported by four lenses (PSECURITY_DESCRIPTOR is *mut c_void and accepts neither &mut SECURITY_DESCRIPTOR nor *mut SECURITY_DESCRIPTOR, and apply_security_descriptor received a &PrivateSecurityDescriptor where a &[u8] was required) and four were found by no lens and no gate, only by the compiler (SECURITY_DESCRIPTOR_REVISION imported from Win32::Security instead of Win32::System::SystemServices; the NT FILE_OPEN_REPARSE_POINT create-option never imported; use std::io::Write gated cfg(unix) while temp.flush() is platform-neutral; expect_durable called on AtomicInstalledFile where it is defined on AtomicFileOutcome). Then two visibility errors behind those (E0446 on win::Target, and path_authority::Identity more private than windows_file_identity), and a Windows-only clippy lint behind them again. Also fixed: the read-only ancestor walk (open_directory_path honoured `writable` on its base open but demanded DIRECTORY_ACCESS, which carries GENERIC_WRITE, for every child, so pre-commit revalidation failed on any path with a non-writable ancestor — reported independently by minimalism, tests, code-quality and error-handling); a missing reparse-point refusal (open_windows_nofollow opens with FILE_FLAG_OPEN_REPARSE_POINT and then refuses the handle, open_directory_path opened the same way and walked on); the duplicated NTSTATUS classifier; the hand-rolled FILE_DISPOSITION_INFORMATION constant and bare [1_u8] disposition byte; the magic 8/16/20 rename-header offsets, now derived by std::mem::offset_of! from the crate's own FILE_RENAME_INFORMATION; the broken windows_test_parent fixture; a vacuous regular-file guard (target_regular returned a bare true, and FILE_NON_DIRECTORY_FILE admits devices, volumes and pipes, so the driver's "target must be a regular file" check did nothing on Windows); and an unprotected private-temp DACL (a supplied DACL does not keep a parent's inheritable ACEs out of a new object without SE_DACL_PROTECTED, so the creator-only temporary was not necessarily creator-only).
* **Rejected:** minimalism's claim that InitializeSecurityDescriptor builds an absolute descriptor while OBJECT_ATTRIBUTES.SecurityDescriptor requires a self-relative one and would fail with STATUS_BAD_DESCRIPTOR_FORMAT (confidence 96) — OBJECT_ATTRIBUTES accepts an absolute descriptor, and self-relative is required for persisted or serialized descriptors, not for object creation. minimalism's reading that open_directory_path ignores `writable` entirely — it honours it on the base open, and only the child components were wrong. minimalism's recommendation to inline cleanup_with_adapter as a zero-value pass-through — target_identity has two call sites but cleanup_with_adapter has 22, all the same error-cleanup step on the failure path of replace_at_driver, so inlining replaces a named seam with 22 identical calls in a sensitive path; filed as f-20260916-08 instead. code-quality's ctime_nanos finding as a correctness bug — opened_file_change_stamp documents the per-platform convention and every comparison is like-for-like on one platform, so it is a naming defect, filed as f-20260916-10.
* **Reason:** the near-miss is the instructive part and is recorded deliberately. review-code-quality reported at confidence 100 that every new Windows test combined #[cfg(windows)] with #[cfg_attr(not(unix), ignore)], so none could execute anywhere. The first grep for that attribute matched `ignore)` against the real text `ignore = "unported on this platform: f-20260914-10"`, returned zero hits, and nearly rejected a true blocker as a hallucination. It is real: 15 of 15 such tests carried it, so on Windows not(unix) holds and the test is skipped, while on unix the cfg deletes it. This is the same wrong-spelling grep that the f-20260914-10 handoff already records round 6 making, against the same attribute, reaching the same false conclusion — the second time in one finding's life. The markers are removed from infra/fs.rs; the 15 legitimate ones in pgn.rs, which gate genuinely unported unix-only tests, are untouched. Consequence, stated plainly: those 15 tests now execute on the Windows runner for the first time, and this machine has a cross-compiler but no Windows runtime, so whether they pass is not yet known — and f-20260916-12 records one that is expected to fail. Semantic properties that no type-check can hold (the access-mask split, the regular-file guard, the protected DACL) are pinned by source assertions in infra/platform_support.rs that execute on every platform.
* **Decided by:** Claude Code, autonomously under `full auto` · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"44bad3a93c550d274422946065a5b7d26f613fbf2c4686ed842064816738d865","input_sha256":"d917f97e592982d74192b609e8324fa2d256a5b209b2dfb3db2beccb9459d390","kind":"mutation-receipt","operation":"aef5cd51e7779710a9d2c780fdb7a013ce36a2b132c7d1404df810b0df36ec12","options":{"section":null},"request_id_sha256":null,"results":["d-20260916-09"],"target":"decisions-ledger","v":1} -->

### d-20260916-10 — Codex is logged out; which executor runs this build's leaves?

* **Question:** Codex is the drain's selected executor for this run, but it has no `~/.codex/auth.json` and `codex login status` prints `Not logged in`, so every leaf dies with HTTP 401 before reading a byte. `codex login` needs an interactive browser flow that a headless drain session cannot complete. Does the run stop on the precondition, or switch executor?
* **Governs:** f-20260914-08
* **Chosen:** switch this run's executor to `grok` and keep it for every leaf of the run. Measured before committing to it: `~/.grok/auth.json` was written the same day, and a real locate probe (`probe-4b`) ran to `end_turn` with `profile-check` exit 0, returning a correct report that also corrected the orchestrator's own PATH assumption for the MinGW prefix (`usr/bin`, not `bin`). Four Codex leaves had already failed at 401 with 2983-byte JSONLs containing nothing but the connection errors.
* **Rejected:** (a) stopping and reporting the precondition — the drain would resume this cluster only when Codex is logged in, which needs Felix at the machine, and nothing about this finding depends on Codex specifically; the executor axis exists precisely so a down CLI is not a stopped queue. (b) switching to `claude` — it is authenticated and would work, but the orchestrator is Claude, so every lens would then share the author's model family and `push-review-policy` §3's cross-family separation would collapse into a disclosure rather than a fact. Grok keeps the separation real. (c) `gemini`/agy — it is a mixture that routes every `write` and `resume` leaf back to Codex, which is the CLI that is down, so it cannot deliver the implementation phases.
* **Reason:** executor selection is a technical question (rule 33: no user sees, gets, is charged or is promised anything different), and rule 6a says repair what is not running rather than report it. The switch changes who writes the leaves, not what is built, and the model ladder has a full Grok column in `~/.claude/references/executor-profiles.md` §4. Reversal: log Codex back in (`codex login`) and the next run picks up `DRAIN_EXECUTOR=codex` again with no repository change; nothing in the tree records the choice.
* **Decided by:** Claude Code, autonomously under `full auto` · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"3b1fee1311f9422b976b6f94b9ba308711c81de861687c8918d3fda66fee9f17","input_sha256":"92203c921746f4824c57a3ffbaf972c0dcf151cc0d1245e240af066cb915bb8c","kind":"mutation-receipt","operation":"1be48e86b32eb91b24e6f1a25093f4d355f5207f67614b266716b63027c3ab50","options":{"section":null},"request_id_sha256":null,"results":["d-20260916-10"],"target":"decisions-ledger","v":1} -->

## 2026-09-17 — recorded through the decisions lock

### d-20260917-01 — Grok's balance is exhausted mid-run and Codex is logged out; how do the remaining phases get written?

* **Question:** Phase B of the `f-20260914-08` port died with `API error (status 402 Payment Required): Grok Build usage balance exhausted` after 36 model calls. Codex was already logged out at the start of this run (`d-20260916-10`). Two of the four executors on the `executor-profiles.md` axis are therefore unavailable, and `leaf-quota-retry.py` does not cover this case: it classifies a failed leaf as either agy (§1d) or Codex-Spark (§1e-§1f), and a Grok 402 on the selected executor is neither. Does the run stop with phase A delivered, or continue on another executor?
* **Governs:** f-20260914-08
* **Chosen:** switch the remaining write leaves to `--executor claude` and continue. `claude` is a first-class executor on that axis with its own measured model column (`executor-profiles.md` §4), not a degraded substitute, and it is the only authenticated CLI left that can write: agy takes read-only leaves but routes every `write`, `resume` and `verify-ui` back to Codex, which is down. The dead leaf's 376 partially-applied lines were reset rather than kept — an edit set from a leaf that died mid-flight has no report, no proof and unknown completeness, which is exactly the state that hides a defect.
* **Rejected:** (a) stopping with phase A pushed and phases B-D open. This was close, and it is what the phase structure was designed to allow — every phase is independently committable and ends green (rule 4a). It was rejected because both remaining preconditions need *Felix* (a `codex login` at his browser, a Grok top-up), so the drain that "resumes when preconditions change" would resume into the same two dead executors and make no progress; and because the work would be resumed later by a session without this one's loaded context. (b) `leaf-quota-retry.py` — it would misclassify the failed stream. (c) implementing phases B-D inline in the orchestrator: the build skill's implementation downgrade is for a single phase against a named file set with no sensitive-path hit, and this is three phases across `infra/**` and `pgn.rs`, both Sensitive-Path globs; it would also consume the context needed to review the cumulative diff and arbitrate the gates.
* **Reason:** executor selection is technical (rule 33) and rule 6a prefers repairing a stalled run over reporting it. **The real cost is disclosed rather than hidden:** with Grok exhausted and Codex logged out, the step-6 cumulative review lenses must also run on Claude, so `push-review-policy` §3's preference for a reviewer from a different model family than the author does not hold for phases B-D. Phase A does not share that weakness — it was written by Grok and is reviewed here by Claude. Reversal: once either CLI is healthy, nothing in the tree records the choice and the next run picks up its own `DRAIN_EXECUTOR`.
* **Decided by:** Claude Code, autonomously under `full auto` · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"40164cc076e6ecfaa9e3ffbb7dd2d45c3308f9ca3377ec365ed043e279b2e62b","input_sha256":"5e603469044dca26eb1a9b4ffdbff3ba2fd78ad91df564856cb947a50919c6b1","kind":"mutation-receipt","operation":"a27aa4d88ad743cfad27e90254b6fef9ec4c1804d88ce14124b22d405e85347c","options":{"section":null},"request_id_sha256":null,"results":["d-20260917-01"],"target":"decisions-ledger","v":1} -->

### d-20260917-02 — What does "durably committed" mean for a directory on NTFS, and which handle must carry GENERIC_WRITE?

* **Question:** `f-20260914-08` asked how "durably committed" is defined on NTFS "where there is no directory fsync". The first plan revision asserted that `FlushFileBuffers` fails on a directory handle even with `GENERIC_WRITE` and built an uncertainty-mapping obligation on top of that. Is that true, and if not, what is the real obligation?
* **Governs:** f-20260914-08
* **Chosen:** it is false, and the answer is an access mask rather than a new durability contract. The tree already records the measurement at `infra/path_authority/resolved.rs:894-897`: `FlushFileBuffers` fails with os error 5 on a **read-only** directory handle, and succeeds on one carrying `GENERIC_WRITE`. So "durably committed" on NTFS means exactly what it means on unix, and the port's obligation is to open every directory handle that will later be flushed with `GENERIC_WRITE`. There are two such handles on the workspace-mutation path, not one: the ancestor parent from `open_parent_no_follow`/`open_verified_parent`, **and** the leaf directory that `open_verified_directory` opens with a second `openat` and passes on through `VerifiedDir::into_file` to `WorkspaceMutationTarget::directory()` — the latter is the handle `create_dir_at`'s `parent.sync_all()?` actually flushes. No call site's durability contract changed and no `DurabilityStage` variant was added.
* **Rejected:** mapping a directory-flush failure to `CommittedDurabilityUncertain` for `create_dir_at`/`rename_entry_at`. The renderer's `runDestructiveWithRefresh` treats the `durability` category as *applied*, so a create that never landed would have been reported to the user as done; a new `DurabilityStage` variant would also have rewritten the Specta-exported bindings. Also rejected: copying the unix arm onto a read-only Windows parent, which is the same bug with the opposite symptom — every mutation failing with `Error::Io` *after* the namespace change had landed.
* **Reason:** rule 12b — the original claim was asserted, never measured, and four independent review lenses refuted it against the in-tree measurement. Two further plan revisions then attached the corrected requirement to the wrong function before it landed on the right pair. Reversal: the masks are pinned by `windows_mutation_directory_handles_are_acquired_writable` in `infra/platform_support.rs`; changing the answer means rewriting that pin and saying why.
* **Decided by:** Claude Code, autonomously under `full auto` · **Superseded-by:** -

### d-20260917-03 — How is a Windows-only property proven on a machine with no Windows runtime, and what did that turn out not to cover?

* **Question:** `d-20260916-01` established source pins in `infra/platform_support.rs` — which execute on Linux by comparing source text — as the way a Windows-only property gets an assertion. This port added roughly fifteen of them. Is that sufficient, and what is it actually worth?
* **Governs:** f-20260914-08
* **Chosen:** keep the pins, but treat them as necessary and *not* sufficient, and prefer an un-gated runtime test wherever one can exist. The port's governing rule became: a test with no `cfg` at all beats a `#[cfg(windows)]` one, because reverting a Windows arm then reddens the Linux run locally instead of only `rust-windows-test`. `#[cfg(windows)]` is reserved for assertions that cannot exist on Linux (the composed `FileId` identity, the junction listing, the colon rejection). The claim was then falsified rather than asserted: reintroducing a `#[cfg(not(unix))]` counterpart for `mutation_target` turned two Linux-executing tests red, and the probe was reverted.
* **Rejected:** relying on pins alone, which four rounds of `review-tests` showed would not distinguish a real port from a stub returning `Ok(vec![])`. Also rejected: writing a parallel `#[cfg(windows)]` test corpus — `every_workspace_command_finishes_its_tail_after_caller_abort` already asserted filesystem outcomes for seven of the nine commands and was gated only by a helper that read `MetadataExt::dev`/`ino`; routing that helper through `entry_identity_at`, as its directory sibling already did, un-gated it.
* **Reason:** the measure of what a text pin is worth is that the nine-lens review of this port still found `open_windows_child` opening asynchronous NT file objects — a defect that breaks `File::read` on Windows and that no pin could see, because the pinned text was correct. Reversal: if the first `rust-windows-test` run contradicts a pinned property, the pin is wrong and both it and the code change together.
* **Decided by:** Claude Code, autonomously under `full auto` · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":17,"effect_sha256":"cbdce9b360fc6ad79124fe73337d648b01d82b79a9b9aae02387f8225c68e1f9","input_sha256":"3fe7fd0d5d0968fb7757c50a65d143805f3e805f5f7d81ba864185c519f0b7a4","kind":"mutation-receipt","operation":"0e943d7f659dd8408558656112edde88d8e2698efe67ea9562900f4eeab3fd57","options":{"section":null},"request_id_sha256":null,"results":["d-20260917-02","d-20260917-03"],"target":"decisions-ledger","v":1} -->

### d-20260917-04 — How does the Windows port classify a probe failure, given that a symlink, a directory and a corrupt archive mean different things to different callers?

* **Question:** `f-20260914-09`'s plan gave every caller of the shared probe-error classifier one rule — "a wrong object kind means no index / absent". Implementation showed that rule contradicts two existing tests. What are the real classes and the real per-caller mappings?
* **Governs:** f-20260914-09, f-20260916-02, f-20260916-03
* **Chosen:** `ProbeErrorClass` carries **six** variants — `NotFound`, `Reparse`, `WrongKind`, `Malformed`, `MappedFile`, `Other` — and each caller has its own row, because the callers genuinely differ. `Reparse` is a symlink or reparse point refused *before* it was opened (`Errno::LOOP` on unix, the `InvalidInput("reparse points cannot be authorized")` value on Windows); `WrongKind` is an entry that exists, is openable and is not a regular file. The rows: `open_current`'s probe maps `NotFound`, `Reparse` and `WrongKind` to its `Conflict` text; the **index loader** maps `NotFound`, `Reparse` and `Malformed` to "no index" but **propagates `WrongKind`**; promotion's preferred probe stops on anything that exists in any form; the **legacy sidecar's provenance** answers "not ours" for all four and propagates only `MappedFile`/`Other`; the **preferred sidecar's deletion** treats `NotFound` as absent and both `Reparse` and `WrongKind` as `InvalidInput`, which stops the deletion.
* **Rejected:** the plan's single rule, which review rounds 3 and 4 adopted from four lenses and which would have (a) turned the loader's propagated error into a silent "no index" for a directory, and (b) made a colliding legacy sidecar belonging to *another* database stop a deletion that `d-20260831-24` deliberately lets proceed. Also rejected: a Windows-only arm for the loader so unix could keep `openat` — the duplication the plan's own sharing rule exists to prevent.
* **Reason:** rule 12b — the plan's rule was reasoned, not measured, and two existing tests measure the opposite. `operational_search_index_open_error_propagates` (`src-tauri/src/db/search.rs:1181`) shows that on Linux a directory opens under `RDONLY|NOFOLLOW` and fails later in the mmap, so the loader propagates; a symlink fails the open with `LOOP` and means "no index". `unlink_database_files_skips_a_legacy_directory` (`src-tauri/src/db/mod.rs:3341`) shows a legacy directory is skipped and the primary still deleted, which is `d-20260831-24`'s rejected-alternatives list in code. Both were found by phase leaves that stopped and reported the contradiction instead of editing the test. Reversal: the rows are asserted as a cfg-free table plus a real directory fixture in `infra/platform_support.rs`; changing an answer means rewriting that table and saying why.
* **Decided by:** Claude Code, autonomously under `full auto` · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"adad5ef3f131b3ebf6ec31b4e04cf3f9f367eaa4cb7ae27731f851fd11bc5ff4","input_sha256":"d2984e308fc870f2ff0f0429497e9fa201109d224eef07b51ca11b078708b5a4","kind":"mutation-receipt","operation":"36d6aa6bbefbfbd585080fa880e6f6eb15597bd3bbd9ff45049f29719a71e298","options":{"section":null},"request_id_sha256":null,"results":["d-20260917-04"],"target":"decisions-ledger","v":1} -->

### d-20260917-05 — What error does the search-index loader return for a preferred sidecar that exists and is not a regular file?

* **Question:** Porting `open_valid_preferred` to the shared `infra::fs::open_regular_at` changes when the refusal happens: the helper refuses a non-regular entry at the open, where the old unix arm opened a directory and failed later in the mmap. The propagation survives, but the variant changes from `Error::Io` to `Error::InvalidInput("target must be a regular file")`, and `operational_search_index_open_error_propagates` asserted the variant. Keep the old variant, or accept the new one?
* **Governs:** f-20260914-09
* **Chosen:** accept `Error::InvalidInput`. The test's name and purpose — an open failure *propagates* rather than being swallowed as "no index" — are unchanged and still asserted; only the variant in its `matches!` moves. `InvalidInput("target must be a regular file")` is the typed answer the rest of this codebase already gives for that condition, including the deletion path's sidecar rule under `d-20260831-24`, and it is more precise than an `Io` that only arises because the code opened something it should have refused.
* **Rejected:** keeping the unix `openat` and adding a parallel Windows arm so the variant would not move. That is the duplication the plan's sharing rule and round 2 of its review rejected, and it would leave a Windows arm no test on this machine executes. Also rejected: leaving the test asserting `Io` and making `open_regular_at` open directories, which would weaken a primitive used by the whole path authority to preserve one error variant.
* **Reason:** the renderer maps `Io` and `InvalidInput` to different categories, so this is a visible contract change and was taken by the orchestrator rather than the phase leaf, which correctly stopped and reported it. What a user sees does not change in kind: a directory sitting where a search index belongs was an error before and is an error now. Reversal: change the `matches!` in `operational_search_index_open_error_propagates` back and give the loader its own non-shared open, accepting the duplicate arm.
* **Decided by:** Claude Code, autonomously under `full auto` · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"ea5c4e0917ff258430b4c0f4c1a5448558186465c57ea47bf92910320ea361d9","input_sha256":"3c7bb5a8f8df877748075188dfbec90bb74f132802254c3c95763469ce68d387","kind":"mutation-receipt","operation":"97d2f4ab7692f6e156842b393b48b6106f678e1e6962da584c3a414cb1df4749","options":{"section":null},"request_id_sha256":null,"results":["d-20260917-05"],"target":"decisions-ledger","v":1} -->

### d-20260917-06 — What are the Windows refusal-site and marker counts after the database port?

* **Question:** `d-20260916-06` recorded 36 refusal sites (27 body + 9 guard) and 48 ignore markers after the atomic-replacement port. `f-20260914-08` then retired eleven rows before this run started, and `f-20260914-09` removes nine more. What do those records say now?
* **Governs:** f-20260914-07, f-20260914-10, f-20260914-09
* **Chosen:** **13 refusal rows — 6 body + 7 guard — and 22 ignore markers, of which 4 are owned by `f-20260914-10` and 18 by `f-20260914-11`.** Derived by counting the actual arrays in `infra/platform_support.rs` and grepping the tree, never by copying prose. The arc across this run's four phases, each documented at its own commit per `d-20260916-02`: 15 body + 9 guard at the start (already down from `d-20260916-06`'s 36, because `f-20260914-08` retired eleven before this run) → Phase A 11 + 9 → Phase B 9 + 7 → Phase C 7 + 7 → Phase D 6 + 7. `f-20260914-09` owned **zero** markers, so this port removes none; it removes rows and the `UNSUPPORTED_DIRECTORY_ENUMERATION` constant with the refusal it described.
* **Rejected:** treating `d-20260916-06` as still current — it predates `f-20260914-08`, whose own commits (`e649179a` and its siblings) retired eleven rows without a decision record of their own, which is how the number went stale unnoticed. Also rejected: deleting a row without replacing its regression protection; each removed row is replaced by a positive, cfg-free assertion that the function has exactly one ungated definition, no `unsupported` and no `off_unix_refusal` call in either spelling, and no platform block in its body.
* **Reason:** clause 2 supersession — new evidence (two ports), the prior decision named, the trailer set. The count is a live assertion rather than documentation, so a documented number that disagrees with the arrays is either a red gate or a lie. Reversal: recount the arrays and say what moved.
* **Decided by:** Claude Code, autonomously under `full auto` · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"8f45c931e5e5a2f51b8b39b53d48c05ba87577b7942e1b6712047b4915440d29","input_sha256":"542c24533a7869d8449892e27414d50cadc79f9ff8bd2436c037e16e62b4affc","kind":"mutation-receipt","operation":"6cc65be475f63446809387d4f4c48751f0f2663716cef4781c3b8b1a015a01bc","options":{"section":null},"request_id_sha256":null,"results":["d-20260917-06"],"target":"decisions-ledger","v":1} -->

### d-20260917-07 — Which principal does the Windows private temporary's DACL grant to?

* **Question:** Which principal does the Windows private temporary's DACL grant to?
* **Governs:** f-20260917-02
* **Chosen:** the calling process token's user SID, obtained through `OpenProcessToken` +
  `GetTokenInformation(TokenUser)` + `GetLengthSid`/`CopySid` and memoised per process in a
  `OnceLock`, with the DACL still marked `SE_DACL_PROTECTED`.
* **Rejected:** (a) the well-known CREATOR OWNER SID, which is what the code did — Windows
  substitutes that placeholder only in *inheritable* ACEs, so as an effective ACE on the object it
  matches no token and the file grants nobody anything; (b) supplying no DACL at all and letting
  the file inherit the parent's, which drops the single property the descriptor exists for.
* **Reason:** measured, not argued. On the runner the CREATOR OWNER form failed every later open
  with ERROR_ACCESS_DENIED across six modules; swapping the subject to the token user SID turned
  file_workspace 10/10, fs 43/43, db::search_index 21/21, chesscom 10/10 and engine::types 9/9
  green in run 35210674941. "Creator only" on a concrete object is expressible only as the
  creator's actual SID.
* **Decided by:** build run f-20260917-02, session d3c37561, 2026-09-17 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":17,"effect_sha256":"8be225287df87db5c44889d25f627d2ef5bb30bac6292dbccc4c8199864c27ca","input_sha256":"825b6d21b127cbbce10bc74bdc6ac63b9e5221c5fb78d2b48de7bb55874b547b","kind":"mutation-receipt","operation":"3c22fea8860b82b2db0556ab8bddd9d1219d13f8e6256bbd9c3c72f94b95480b","options":{"section":null},"request_id_sha256":null,"results":["d-20260917-07"],"target":"decisions-ledger","v":1} -->

### d-20260917-08 — How is the Windows buffer-alignment repair held in place against a later revert?

* **Question:** How is the Windows buffer-alignment repair held in place against a later revert?
* **Governs:** f-20260917-02
* **Chosen:** an opaque `AlignedBuffer` type whose backing element type carries the alignment and
  whose constructor takes the consumer's `align_of::<T>()` as a `const` parameter. Every Win32
  call that touches such a buffer goes through a wrapper taking `AlignedBuffer`, so no `unsafe`
  block in these paths accepts a `*mut u8` from a caller.
* **Rejected:** (a) a runtime assertion over an observed address — Windows allocators commonly
  return over-aligned addresses, so it stays green against the wrong implementation; (b) a `const`
  assertion inside a helper, which constrains nothing once a consumer stops calling the helper.
* **Reason:** the anchor has to be the type, so that substituting a `Vec<u8>` at any consumer
  fails to compile rather than depending on what the allocator happened to return. The concrete
  hazard is `TOKEN_USER`, which holds a `PSID` and therefore needs 8-byte alignment on x86_64,
  not the 4 an earlier draft assumed. Nothing on Linux compiles this module and a type-check
  cannot see an access mask, so a compile-time boundary is the only local guard that exists.
* **Decided by:** build run f-20260917-02, session d3c37561, 2026-09-17 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":17,"effect_sha256":"5fd2729d066715c076c5047dcddf8c6d5deffcb6aa5b7f12c529ec66d4691d5f","input_sha256":"297241f17416510327c8376fbb29cfac2934a1997525224170fd82d8e39d9912","kind":"mutation-receipt","operation":"e5c00425fcd455a0f5ced061fbe199c4566bcac02ec5a3cb6a17532ca7054e87","options":{"section":null},"request_id_sha256":null,"results":["d-20260917-08"],"target":"decisions-ledger","v":1} -->

### d-20260917-09 — How are the two Windows fault-injection races repaired when the race cannot be staged in-process?

* **Question:** How are the two Windows fault-injection races repaired when the race cannot be staged in-process?
* **Governs:** f-20260917-02, f-20260916-12
* **Chosen:** restage the test, never widen the production sharing mask. The parent-replacement
  case injects a distinct parent identity through a `#[cfg(test)]` seam, so the production
  comparison still decides; the post-rename case keeps its invariant as a source pin in
  `platform_support.rs`, beside this repository's other source pins, with a recorded
  staged-failure matrix proving both of its assertions were seen to fail.
* **Rejected:** (a) adding `FILE_SHARE_DELETE` to `FILE_SHARE_PRIVATE_TEMP` so the injectors'
  renames succeed — that deletes the property the private temporary exists for, which is that
  nothing else can open, replace or delete it before commit; (b) deleting or weakening the
  assertions, which would buy a green job by removing the only proof a security-relevant path has.
* **Reason:** measured on the runner. The parent rename returns ERROR_ACCESS_DENIED and the
  post-rename swap returns os error 32, a sharing violation, both because the held temporary is
  opened without delete sharing — which is `f-20260916-12`'s prediction, confirmed. The invariants
  each test exists to prove are named and still proven: a replaced parent directory is refused,
  and the post-rename identity is read from the retained handle rather than by re-opening the
  pathname.
* **Decided by:** build run f-20260917-02, session d3c37561, 2026-09-17 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":20,"effect_sha256":"850cd40539606558cf35e5c507ae420c969dbcdd7dd7325f564a698841f11a26","input_sha256":"4a1222cd861ba13f729ed46a0df860c443e1e7cf44641dddbeaca47914002b91","kind":"mutation-receipt","operation":"6262cd85f7791a084df3c88487c2501c40c5fecdddfa03daee18ee04f79b0e74","options":{"section":null},"request_id_sha256":null,"results":["d-20260917-09"],"target":"decisions-ledger","v":1} -->

### d-20260917-10 — What proves a Windows repair, given there is no Windows runtime on this machine?

* **Question:** What proves a Windows repair, given there is no Windows runtime on this machine?
* **Governs:** f-20260917-02
* **Chosen:** the unmodified `Test` workflow's `rust-windows-test` job, read fail-closed in two
  steps. *Readable* = remote ref SHA == run `headSha` == local `HEAD` and `status: completed`;
  *green* = readable and the job's `conclusion: success`. The repair is committed on `master` and
  a slash-free ref `probe-windows-failures` is pushed **from** master, so the runner measures the
  exact content that will be published and nothing is ever merged out of a branch.
* **Rejected:** (a) a dedicated diagnostic workflow with `continue-on-error` steps — its green is
  meaningless by construction, and keeping it forced a contradiction between "the probe ref is
  exactly master" and "the probe ref carries a workflow master lacks"; (b) developing on the probe
  branch and merging back, which proves a branch and can leave master red; (c) adding `probe/**`
  to master's `test.yml` triggers, which puts scaffolding in a production workflow.
* **Reason:** the diagnostic workflow existed only because the access violation truncated libtest
  before it printed its `failures:` section. Removing the crash removes the reason. The two-step
  read matters because the enumeration phase deliberately consumes a *failing* run — a failing job
  on a readable run is a measurement, a failing job on an unreadable run is nothing, and requiring
  `success` before reading anything would have made that phase unreachable.
* **Decided by:** build run f-20260917-02, session d3c37561, 2026-09-17 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":20,"effect_sha256":"6e26534b6983d654d7cd93c320f6f6209326e8aeb309933fd2527485a285b2de","input_sha256":"675cf9ee04c8cd5b838f5f27cd49b2031fb862af0ebbeb0dadce7a5862e98a89","kind":"mutation-receipt","operation":"93e3711adc1c6f2c78d7252a136d0cb0431523b4edc15934c5a9383b6e4718de","options":{"section":null},"request_id_sha256":null,"results":["d-20260917-10"],"target":"decisions-ledger","v":1} -->

### d-20260917-11 — Should the DACL invariant test compare against production's own SID provider?

* **Question:** Should the DACL invariant test compare against production's own SID provider?
* **Governs:** f-20260917-02
* **Chosen:** no. The test derives the SID through `process_user_sid_uncached`, deliberately going
  around production's `OnceLock`, and additionally refuses four well-known wide SIDs by name —
  CREATOR OWNER, World, Authenticated Users, Builtin Administrators — checks the
  `SE_DACL_PROTECTED` control bit under a parent carrying an inheritable ACE, and applies the same
  check to the installed target rather than only to the pre-install temporary.
* **Rejected:** (a) comparing against production's cached provider, which proves only
  self-consistency; (b) "not CREATOR OWNER plus a successful reopen", which an ACE for `Everyone`
  or `Administrators` satisfies; (c) deleting the by-name refusals as unreachable after the
  equality check, which a later review lens proposed at confidence 88.
* **Reason:** (c) is wrong and that is the point of the design: the expected SID comes from the
  same derivation production uses, so a derivation that itself returned a wide SID would satisfy
  `EqualSid` and only the by-name loop would fire. The residual gap — a derivation returning some
  *other* wrong SID that is not one of the four — is stated as a named limitation rather than
  claimed closed, because no in-process oracle can catch a defect inside the shared sequence.
* **Decided by:** build run f-20260917-02, session d3c37561, 2026-09-17 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":19,"effect_sha256":"64ee2f9d785c7f44d0b93b85158edd809740a4a6190e23bd87b6e21edc5e69ab","input_sha256":"691e99988a9d6cf4edcc59bccb7dfd5662002a44d8f61e61f99a6de811d0a137","kind":"mutation-receipt","operation":"ca2416e3f55b4bfdba62ebdfe7a20ebf24f26096db9a3f8bd82553696f9a16b2","options":{"section":null},"request_id_sha256":null,"results":["d-20260917-11"],"target":"decisions-ledger","v":1} -->

### d-20260917-12 — How does a one-shot test hook survive parallel tests, and what proves the macOS fixture without a macOS runtime?

* **Question:** How does a one-shot test hook survive `cargo test`'s parallel harness, and what
  proves the macOS fixture is no longer timing-dependent when there is no macOS runtime here?
* **Governs:** f-20260917-09
* **Chosen:** hold every one-shot test hook in `infra::test_hooks::KeyedTestHooks<K>`, keyed by an
  identity the fire site already knows — the admitted `EngineKey` for the game-engine after-spawn
  hook and for both `resolve_launch` hooks, the resource value for `RESOURCE_VERIFY_HOOKS`. A hook
  fires only for its own operation, at most once, and arming a second hook cannot discard the
  first. The proof that executes everywhere is the registry's own test, which stages all four
  reverts (key match, single-slot storage, one-shot removal, clear); the macOS-only fixture is
  then confirmed by `rust-macos-test` on the unmodified `Test` workflow, read the way
  `d-20260917-10` reads the Windows job.
* **Rejected:** (a) only replacing the blind `assert!(matches!(...))` with a diagnostic `match`,
  which the finding names as the first step — it makes the next failure legible but leaves the
  race in place, and the cause was derivable from source without spending another red CI run;
  (b) serialising the macOS engine tests behind a test mutex, which hides the shared-slot defect
  instead of removing it and slows every run; (c) a thread-local hook slot, which the fire site
  cannot rely on because the initialization future is not guaranteed to run on the arming thread;
  (d) keying only the game-engine hook and filing the two `resolve_launch` slots as a new finding
  — same mechanism, same files this run had loaded, and `ENGINE_LAUNCH_RESOLUTION_HOOK` is
  `cfg(unix)`, so its exposure is wider than the one that actually failed.
* **Reason:** the intermittency is the fixture, not the engine-resource lease: the replacement
  landing before the authorization snapshot (rather than after it) is precisely what a stolen
  hook produces, and it explains every measured detail — Linux green because the hook was
  compiled out, `replaced` true while only the `matches!` assertion failed, and a failure on a
  commit that touches nothing on the unix path. Keying is the only option that removes the class
  rather than narrowing it. A macOS toolchain is not available on this machine
  (`cargo check --target aarch64-apple-darwin` fails in `ring`'s C build for lack of a darwin
  `cc`), so the macOS-gated bodies were typechecked by source probe on Linux and the platform
  proof is the runner.
* **Decided by:** Claude Code, autonomously under `full auto`, next-finding run f-20260917-09 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":32,"effect_sha256":"3a4da86f91dde789960e1af04b994c7dc5e51e821c5172e2f308bb4f65666856","input_sha256":"b81d4bf73c326d2b20b4f8866d1f6d25a1027ef27f5e4a84fef7d75d8feea691","kind":"mutation-receipt","operation":"8bff492e3a26d1c5faa8572c7fd44553f2905e0915ff121520eb0987ebde59f6","options":{"section":null},"request_id_sha256":null,"results":["d-20260917-12"],"target":"decisions-ledger","v":1} -->

## 2026-09-18 — recorded through the decisions lock

### d-20260918-01 — How are path-authority entries persisted under a symlinked-ancestor spelling made usable again?

* **Question:** An entry persisted before `f-20260914-33` stores a pathname whose ancestor is a symlink; `refresh_entry` calls it `Available` while every descriptor-relative mutation refuses it. Is it rebound at registry load, migrated once behind a `SCHEMA_VERSION` bump, or left for the user to re-select?
* **Governs:** f-20260914-36
* **Chosen:** rebind at load. `refresh_entry` additionally requires the stored spelling to be the one `canonical_binding` produces, so a legacy entry is reported `Unavailable` rather than available-and-unwritable. A post-construction pass, `rebind_legacy_spellings`, runs before `recover_pending_artifacts`, re-proves each non-exempt entry through the existing `acquire_target` primitive, adopts the canonical spelling directly in `self.persistent` and commits once. It is idempotent: a canonical registry triggers no acquisition and no write.
* **Rejected:** a one-shot migration behind a `SCHEMA_VERSION` bump — its failure mode is a registry the running binary refuses to read at all, while the pass degrades per entry and needs no version gate; leaving the entries and telling the user to re-select — the symptom is precisely an entry the UI reports as available, so the user has no reason to re-select, and `f-20260830-06` makes symlinked system directories an ordinary selection on all three platforms; in-memory-only rebinding — it keeps disk and memory permanently divergent and repeats the proof on every start.
* **Reason:** `acquire_target` already is the proof the finding asks for (validate, canonicalise the parent per `d-20260912-04`, then prove the canonical spelling with a no-follow descriptor walk), so reusing it makes load-time rebinding identical to acquisition-time binding. `PathAuthority::open` may already commit through `recover_pending_artifacts`, so persisting at load introduces no new class of startup write. 13 plan-review rounds, all seven lenses APPROVED; record `tasks/handoffs/2026-09-17-f-20260914-36-review.md`.
* **Decided by:** Claude Code, autonomously under `full auto` · **Superseded-by:** -

### d-20260918-02 — How is a rebinding failure surfaced, and what is exempt from the canonical-spelling requirement?

* **Question:** When the load-time rebinding cannot prove an entry, what happens to it; and which entries must keep a deliberately raw spelling?
* **Governs:** f-20260914-36
* **Chosen:** a failure leaves the entry `Unavailable` with its stored spelling untouched and emits one `log::warn!` naming the entry and either the error category or the fixed reason `identity changed`; `open` still succeeds. A hard commit failure keeps the in-memory rebinding and is logged with the affected entry ids; the next ordinary commit flushes it. Exempt from the canonical requirement, in `refresh_entry` and in the pass alike: entries of class `PathClass::AppOwnedRoot`, and entries whose stored path lies inside one of the six `AppOwnedDefaultRoot` directories under the `AppDataDir`. A path containing a `ParentDir` component is never exempt. The `AppDataDir` reaches the authority through a new `open_for_app` constructor, because the load loop refreshes every entry before `open` returns.
* **Rejected:** failing `open` on one bad entry (`.claude/rules/async-resource-invariants.md`: fail the one item, not the process); keeping a refused entry `Available` and only logging (that is the defect); a stored `#[serde(default)] descriptor_bound` flag — `StoredEntry` is built at three sites and `register_database_child` builds one directly at `mod.rs:5513`, and no stored flag can classify entries written before it existed; containment in a `PathClass::AppOwnedRoot` **entry** — measured vacuous in production, since `main.rs` passes `vec![]` and `AppOwnedRoot::new` is `#[cfg(test)]`; `starts_with(AppDataDir)` alone — the folder and file pickers accept arbitrary paths inside that tree, so it exempts by spelling rather than by ownership; a builder step applied after `open` — it arrives after the load loop has already refreshed every entry.
* **Reason:** `get_or_create_root` (`mod.rs:4790-4806`) and `cleanup_engine_images` (`:6060`) compare the stored spelling lexically against a pathname the caller supplies again, so rebinding an application-owned entry creates a duplicate root on the next start or orphans an engine image (`d-20260915-03` clause 2). The exemption question returned in three consecutive plan-review rounds and was settled by a focused fresh-context architecture judgment under universal rule 12a. **Known residual, owned by `f-20260905-10`:** a user may pick a folder or file inside one of those six directories and is then exempted with the application's own entries; it is not distinguishable by pathname without giving up the lexical reuse above.
* **Decided by:** Claude Code, autonomously under `full auto` · **Superseded-by:** -

### d-20260918-03 — Are the two identity-only use-time doors closed in the same slice as the load-time rebinding?

* **Question:** `f-20260914-36` annotates `database_file_target` (R3-05) and `workspace_root` (R3-06), which compare only the re-acquired identity. Does the rebinding slice also enforce path equality there?
* **Governs:** f-20260914-36, f-20260917-13
* **Chosen:** no. Both were carried as approaches B and C through three plan-review rounds and split out as `f-20260917-13`, blocked on `f-20260905-10`.
* **Rejected:** enforcing equality unconditionally — `register_database_child` joins a filename onto whatever spelling `workspace_root` returns (`mod.rs:5486-5487`), and an app-owned root's spelling is deliberately raw, so a database child registered in the same session is refused; exempting the app-owned subtree at those doors instead — `database_file_target` only ever sees `EntryPurpose::DatabaseFile` entries, so the exemption would stop it enforcing equality for exactly the entries R3-05 is about.
* **Reason:** the only exit that survives both arms is making the app-owned tree canonical at its source, which is `f-20260905-10`'s subject (`ensure_app_owned_default_dir` still creates by pathname) and not this slice's to own. Measured in rounds 2 and 3 of the plan review by review-correctness (97, 98, 96), review-root-cause (96) and review-tauri-security (96).
* **Decided by:** Claude Code, autonomously under `full auto` · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":26,"effect_sha256":"77363fd784c3afb1196ac9b7265c53ca1735d89aa32284962b6cf548d86eb604","input_sha256":"ee12b237586d480899695f015a83467f8ece1162435dbe14a44c4bc66e989b7c","kind":"mutation-receipt","operation":"fce51b8ed810fb86ea49bff4db596d6840bdf31e5155ca2c4fd8bffbf29bbfc0","options":{"section":null},"request_id_sha256":null,"results":["d-20260918-01","d-20260918-02","d-20260918-03"],"target":"decisions-ledger","v":1} -->

### d-20260918-04 — Is Windows startup degraded-mode, or do the registries get a Windows persistence path?

* **Question:** Is Windows startup degraded-mode (skip unported registries) or do the registries get a Windows persistence path?
* **Governs:** f-20260914-11
* **Chosen:** persistence path. After f-20260914-10, atomic replacement is already ported; remaining work is directory authorization, fd-relative open, and fd-relative removal needed to un-ignore the 18th test.
* **Rejected:** degraded mode in which the app starts without a credential store or path-authority registry.
* **Reason:** Felix, 2026-09-12: Windows is a supported platform (f-20260830-06). Locate on 2026-09-18 showed the filed atomic-replace clause is stale. Reversal: Felix says the Windows build may boot without native credentials.
* **Decided by:** Grok, autonomously under `full auto`, next-finding f-20260914-11 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"4efce83bcfde8dbd149ec0be0e8178f68a8abd304a54a80faa5621063e8718b9","input_sha256":"3832130c4a87482f139ff6226a2d46ee4fb61e65428dbfeda0ec287c772395ac","kind":"mutation-receipt","operation":"352065b87e0306b37efbbc33e3efff1ea4b065db01535c966d9fb785a3a68c76","options":{"section":null},"request_id_sha256":null,"results":["d-20260918-04"],"target":"decisions-ledger","v":1} -->

### d-20260918-05 — Does the Windows startup-registry port also close f-20260905-10?

* **Question:** Does closing f-20260914-11 also close f-20260905-10 (descriptor-backed AppDataDir plus mkdirat), or does create_dir_all stay?
* **Governs:** f-20260914-11, f-20260905-10
* **Chosen:** keep create_dir_all; f-20260905-10 stays open. The Windows port of ensure_app_owned_default_dir deletes only the off_unix_refusal guard.
* **Rejected:** pulling f-20260905-10 into this slice so f-20260917-13 can ride along.
* **Reason:** d-20260905-02 and d-20260905-07 already accepted that producer shape; d-20260918-02 and d-20260918-03 name the residual as owned by f-20260905-10. Locate confirmed they are independent doors. Reversal: new evidence that Windows create_dir_all is not the same ancestor-symlink window as unix.
* **Decided by:** Grok, autonomously under `full auto`, next-finding f-20260914-11 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"de835de5173bc9f3938b87f2e2cf718f8768d606c14a6bcbbc6ea0a0686db7ae","input_sha256":"ec4c1ed89cf4c4bc399a8111af66f4a4527b348a48cb43119eae2e3ade58e810","kind":"mutation-receipt","operation":"07f5f30b42d3b1106827b41a09db9b2edb2797bf4a7b26be42b1ec4c20a9b573","options":{"section":null},"request_id_sha256":null,"results":["d-20260918-05"],"target":"decisions-ledger","v":1} -->

### d-20260918-06 — Is AuthorizedDir::remove_leaf_identified ported in the f-20260914-11 slice?

* **Question:** Is AuthorizedDir::remove_leaf_identified ported in the same slice as Windows startup registries, or does shutdown_drains_real_image_issue_before_seal_rejection_cleanup stay ignored?
* **Governs:** f-20260914-11
* **Chosen:** port it. Use the existing Windows remove_entry_at dispatcher with the current unix body (single_leaf plus remove_entry_at(..., identity.pair(), false)). Un-ignore the main.rs test.
* **Rejected:** keep that one f-20260914-11 ignore; pull f-20260914-12 (engine directory resources, archive install, executable mode).
* **Reason:** the finding's annotation says the port removes the 18 ignore attributes. The test installs a UUID leaf through already-ported atomic_replace_leaf_identified and cleans up only via remove_leaf_identified. Windows remove_entry_at already exists. Reversal: drop the port without restoring the ignore, which reddens rust-windows-test.
* **Decided by:** Grok, autonomously under `full auto`, next-finding f-20260914-11 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"73eb13f10c3114b8941d8ff25a57163048760d713103cf963a919f0a7b9f0c18","input_sha256":"17c176993b173d2360c758f1b3a7d6614c3065000ceaabd480cd46a3e64238b8","kind":"mutation-receipt","operation":"8707be6dd487fa567a8650f72eea78cd6779e5b37cd30c041df6d612f8e69e05","options":{"section":null},"request_id_sha256":null,"results":["d-20260918-06"],"target":"decisions-ledger","v":1} -->

### d-20260918-07 — What are the Windows refusal-site and marker counts after the startup-registry port?

* **Question:** d-20260917-06 recorded 13 refusal rows (6 body + 7 guard) and 22 ignore markers (4 owned by f-20260914-10 and 18 by f-20260914-11). After porting ensure_app_owned_default_dir, authorize_existing_dir, open_regular_relative and remove_leaf_identified, what do those records say?
* **Governs:** f-20260914-11, f-20260914-07
* **Chosen:** 9 refusal rows — 3 body + 6 guard — and 4 ignore markers, all owned by f-20260914-10. Derived by counting body_rows() and guard_rows() in infra/platform_support.rs and grepping src-tauri/src for unported-on-this-platform attributes. The 18 f-20260914-11 markers are gone. Remaining body rows: atomic_install_dir, atomic_install_download_dir, mark_engine_executable. Remaining guard rows: download_engine_archive, authenticate, migrate_legacy_lichess_token, engine_resource, set_file_as_executable_blocking, replace_pgn_atomic.
* **Rejected:** treating d-20260917-06 as still current; leaving any f-20260914-11 ignore in place.
* **Reason:** clause-2 supersession — new evidence (this port), prior decision named. The count is a live assertion in phase_e_removed_rows_have_one_ungated_definition_without_refusals and startup_registry_files_carry_no_unported_marker_for_this_finding. Reversal: recount the arrays.
* **Decided by:** Grok, autonomously under `full auto`, next-finding f-20260914-11 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"66fc08ecb3c8284f9c423f06db0060e1a59ae8245f34ea0773d39fa4aab93e19","input_sha256":"cfeae432b2f298d7c7b58954141009f3dff593fe391d81dfc78db32409f3dea5","kind":"mutation-receipt","operation":"f9a8aef7540a4c7dcb33a4d0f985450b0bc89d0208dc9d931c413278e41077b2","options":{"section":null},"request_id_sha256":null,"results":["d-20260918-07"],"target":"decisions-ledger","v":1} -->

### d-20260918-08 — How is a Windows engine directory lease carried without reintroducing pathname trust?

* **Question:** How is a Windows engine directory lease carried without reintroducing pathname trust?
* **Governs:** f-20260914-12
* **Chosen:** the existing Windows file-lease shape: retain the no-follow opened directory handle for the lease lifetime and a `PathBuf` target computed during `resolve_windows`. `uci_value` returns that retained target. `resolve_windows` already opens and verifies the directory handle (`directory: Some(handle)`) and already computes `target`; it currently discards the path (`target: None`). The Directory arm of `engine_resource` consumes `take_directory()` plus `take_target()`, mirroring the working File arm. Identity and no-follow/reparse refusal stay on the open walk; the path is only the UCI/CreateProcess string, the same trust model as file resources.
* **Rejected:** a new lease kind; calling `GetFinalPathNameByHandle` at `uci_value` time (TOCTOU after the walk); Linux `/proc/self/fd` (does not exist on Windows); dropping the handle and trusting the stored path alone; keeping `take_file()` on the Directory arm.
* **Reason:** locate measured that the handle and the target are both already produced, and that the only Windows directory failure after dropping the `off_unix_refusal` would be `take_file()` against a `directory` slot plus the discarded target. Wiring those two existing fields is the file-lease pattern already shipped for Windows files. Reversing this needs evidence that a retained path plus a held no-follow handle is weaker than the file lease, which this crate already treats as the Windows engine-resource contract.
* **Decided by:** Grok, autonomously under full auto · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"5c96fc74bf88212505844b232c88096369b44dfef5d30541e128f4ea59a1230a","input_sha256":"ce9dae77378a21b86f571846991e9d93da606c2a9d66481aa8384e396767be7e","kind":"mutation-receipt","operation":"9f4c1da7809f3bcb611c9a3572f003c38bf50778954184d5d4c9d876db7f87d5","options":{"section":null},"request_id_sha256":null,"results":["d-20260918-08"],"target":"decisions-ledger","v":1} -->

### d-20260918-09 — Should Windows engine executable mode be a successful no-op rather than a refusal?

* **Question:** Should Windows engine executable mode be a successful no-op rather than a refusal?
* **Governs:** f-20260914-12
* **Chosen:** a successful no-op after the same capability checks the unix path performs (`PathOperation::EngineInstall` and a retained regular file). `mark_engine_executable` returns `Ok(())` without changing ACLs. `set_file_as_executable_blocking` drops its `off_unix_refusal` so it reaches that function. CreateProcess launches by path and does not consult a POSIX execute bit; the unix path's only action is `fchmod` of `mode | 0o111`.
* **Rejected:** keep refusing (Windows then cannot complete an explicit executable-mode command, and the comment already says POSIX bits have no truthful equivalent); write a Windows ACE granting `FILE_GENERIC_EXECUTE` (a new permission model this crate does not use on any path, and not equivalent to OR-ing `0o111`).
* **Reason:** `resolved.rs` already documents that POSIX executable bits have no truthful equivalent on Windows. Locate found no Windows permission step that launch requires, no renderer caller of `setFileAsExecutable`, and no install path that calls `mark_engine_executable`. A refusal therefore blocks a command whose unix effect cannot be expressed, rather than protecting a real Windows access check. Reversing this needs evidence that CreateProcess or this crate's spawn path requires a mode bit or ACE this no-op would skip.
* **Decided by:** Grok, autonomously under full auto · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"c42015942f3e333d33819a6d50da15e9e5e8fa082c9ad0d11832bda8c3a603fc","input_sha256":"0acb394035440639703055cff06c776ec693c59e30f07b7e65896a2437d2d714","kind":"mutation-receipt","operation":"768142cd746bac96e9c1daf08bc5061f0305d6c11042a74fb8d029c6ceded0fb","options":{"section":null},"request_id_sha256":null,"results":["d-20260918-09"],"target":"decisions-ledger","v":1} -->

### d-20260918-10 — How does Windows atomically install an engine archive directory without `renameat` EXCHANGE?

* **Question:** How does Windows atomically install an engine archive directory without `renameat` EXCHANGE?
* **Governs:** f-20260914-12
* **Chosen:** a Windows `install_dir` that preserves the unix parent/source/target identity checks, no-follow/reparse refusal, source-must-be-a-real-directory, target-must-be-a-real-directory-or-absent, pre-commit revalidation, durable parent `sync_all`, and identity-bound old-tree cleanup, using the existing `win::` primitives (`open_verified_parent`, `assert_entry_identity`, `rename_child`, `remove_windows_tree_at`, enumerator). Absent target: one `rename_child(..., replace=false)`. Existing target: rename the live target to a unique sibling backup name in the same parent, then `rename_child` the source onto the target name with `replace=false`, then identity-bound `remove_windows_tree_at` of the backup; if the second rename fails, rename the backup back onto the target name. `renameat` `EXCHANGE` is dropped because Windows has no directory-exchange primitive (`ReplaceFileW` is files; `FILE_RENAME_REPLACE_IF_EXISTS` is replace-not-exchange and cannot swap two live trees). The name-absent window between the two renames is accepted and tested. `atomic_install_download_dir` delegates to that function; `download_engine_archive` drops its `off_unix_refusal` only after the install path works.
* **Rejected:** keep `atomic_install_dir` refused and close only the lease (leaves archive install, the finding's named defect, unported); `FILE_RENAME_REPLACE_IF_EXISTS` onto a non-empty directory (not an exchange, and fails for a live tree); a two-step with no rollback of the backup rename.
* **Reason:** engine archive extraction installs a staged directory into an authority destination and, on unix, replaces an existing destination via EXCHANGE (`extract_zip` does this twice in tests). Windows already has every supporting primitive except the swap. A backup-rename plus no-replace plus rollback is the truthful substitute; pretending EXCHANGE exists would pin a lie. Reversing this needs a Windows directory-exchange API this crate can call without `unsafe` beyond the existing `NtSetInformationFile` rename, or a product decision that engine archives may never replace an existing directory.
* **Decided by:** Grok, autonomously under full auto · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"c7a573e469702058d36e58d1fdc366d545c901ff0d3dbeabbedb9b7c159aeb51","input_sha256":"5d0fc2121275723a7eedfc3070546efc43ee04d07280b392ec6228c98087ad50","kind":"mutation-receipt","operation":"1501e9a274764423c349f52863e4013054e8f1edfecd4f0095769bf2b15ad607","options":{"section":null},"request_id_sha256":null,"results":["d-20260918-10"],"target":"decisions-ledger","v":1} -->

### d-20260918-11 — Where does download_engine_archive stage the extracted tree so install_dir can publish it?

* **Question:** Where does download_engine_archive stage the extracted tree so install_dir can publish it?
* **Governs:** f-20260909-01, f-20260914-12
* **Chosen:** stage as a sibling of the destination, the same way `extract_zip_cancellable` already does: `private_tempdir_in` in the resolved destination's parent, then `atomic_install_download_dir` of that staging directory. Keep the installer's same-parent identity check. Close f-20260909-01 in the same slice as the Windows install body, because dropping the Windows archive-download guard without this change turns `Error::Conflict` into `Error::InvalidInput("directory staging source must be in the target's real parent directory")` and the archive half of f-20260914-12 still does not work.
* **Rejected:** remove the same-parent check (cross-volume rename is not atomic on Windows either, and unix install_dir would keep refusing); keep `private_tempdir()` in `env::temp_dir()` and leave f-20260909-01 open (the Windows port would then claim archive install works while the only production caller still cannot publish); resolve the staging path through a second authority grant (the destination parent is already authorized).
* **Reason:** locate and plan-review traced the production caller: extract into a system-temp child, install into the engine workspace. That mismatch is f-20260909-01 and is why unix archive publication already cannot succeed. The zip/tar extractors in the same file already use sibling staging. Reversing this needs a same-volume rename that is not parent-relative, which this crate does not have.
* **Decided by:** Grok, autonomously under full auto · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"7a20a638dba7977ae3c4d8655e7b97291828578d37a395462d21be38cf640ace","input_sha256":"35e90a9c93a8613ec7aace1525f04cc9b1cfaed6557d7373781646216888bd7d","kind":"mutation-receipt","operation":"d765ef14f2f1ebaa16187eafd28c4f3b05f889cce12ec5b1c7c7ff84d44c5892","options":{"section":null},"request_id_sha256":null,"results":["d-20260918-11"],"target":"decisions-ledger","v":1} -->

### d-20260918-12 — Unify bundled sound playback on the loopback server on every platform

* **Question:** After Felix answered `f-20260830-06` (ship macOS and Windows) and `authorize_existing_dir` / `open_regular_relative` were ported, does the non-Linux sound route stay as `sound_resource_path` plus `asset://`, or does every platform use the existing `127.0.0.1` axum server?
* **Governs:** f-20260914-13
* **Chosen:** one loopback HTTP server on every platform. Delete `sound_resource_path`, the renderer `isLinux` / `convertFileSrc` branch, and the `assetProtocol` grant. CSP keeps `media-src http://127.0.0.1:*` and drops `asset:`. `d-20260905-11` startup outcomes and 404-for-rejected-path stay.
* **Rejected:** keep and verify both routes — that is the defect `f-20260914-13` names, it leaves a native pathname on the renderer boundary, and `asset://` audio is already measured broken on WebKitGTK (`MEDIA_ERR_SRC_NOT_SUPPORTED`, 2026-09-06), which is also the macOS webview family. Bytes over IPC with `blob:` remains rejected as in `d-20260906-04`.
* **Reason:** `d-20260906-04` kept the second route only while `authorize_existing_dir` refused on non-unix and the platform question was parked. Both are gone (`d-20260918-07`; Felix 2026-09-12). Its reversal path was exactly this unification. Reversal path: new evidence that WKWebView or WebView2 cannot play `http://127.0.0.1` audio from this process, in which case a different playback URL is designed without reintroducing a native path in the renderer.
* **Decided by:** Grok, autonomously under `full auto`, next-finding slice f-20260914-13 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"041a248578d5805d42c3ca149190dfdc591f38684500d91d0cd7740e678c2d2b","input_sha256":"98fa935c11afebd3bd9ad9363109fc6bb727ec610dbb3e8ad335501a239f8624","kind":"mutation-receipt","operation":"013882f52d64198f3d2476f75cd4f1632653f52f40c3d699816f08a94696c6eb","options":{"section":null},"request_id_sha256":null,"results":["d-20260918-12"],"target":"decisions-ledger","v":1} -->

### d-20260918-13 — How do remaining unported commands refuse before in-process work?

* **Question:** After the Windows ports emptied `body_rows()`, how do the remaining unported production commands refuse before operation admission, and how is completeness proven?
* **Governs:** f-20260914-15
* **Chosen:** first-statement `off_unix_refusal("PGN atomic replacement", cfg!(unix))?;` on `delete_game`, `write_game`, and `export_to_pgn`, same label as the helper they protect. Keep the helper guard. Completeness is two source pins: (1) production-region `.replace_pgn_atomic(` only in `edit_existing` and `export_to_pgn_blocking`, splitting at `mod tests` whose cfg mentions `test`; (2) crate-wide production-caller allowlist of every node on the path (`replace_pgn_atomic` ← `edit_existing`/`export_to_pgn_blocking` ← `commit_pgn_mutation` ← cores ← the three commands). `LIVE_REFUSAL_ROW_COUNTS` becomes `(0, 6)` with three new `guard_rows`.
* **Rejected:** an invoke-handler name table (`d-20260914-05`; completeness universe is the helper call graph, not 117 names); a renderer capability query (the defect is a late/wrong error, not a missing hide); guarding the cores instead of the commands (admission is in the command); porting `replace_pgn_atomic` in this slice (four `f-20260914-10` ignores); splitting production only on `#[cfg(test)]` (`db/mod.rs` is `#[cfg(all(test, unix))]`); scanning only two files' Specta bodies (the cores are `pub`); a rustc import-resolver for `use … as` aliases (no such alias exists; named limitation).
* **Reason:** locate measured that the filed examples are ported except PGN atomic replacement, and that `analyze_game` is no longer conditionally refused. Command-entry guards are the existing oauth shape. The caller table is the call graph the finding asked to prove. Reversal: new evidence that a remaining command still does in-process work before a platform refusal, or that PGN atomic replacement is ported and the guards must go.
* **Decided by:** Grok, autonomously under `full auto`, next-finding slice f-20260914-15 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"2d56b95ce7118f00c22e5cd32eb0e8b52b113ab915ff6276c4b6cdc879889d9d","input_sha256":"59d3b1e53b3f732fbbe43075b746513ff4d420c729fdd84bfdea1db8fb9ee3c7","kind":"mutation-receipt","operation":"efc7f9fda0b22cf7b0634d9b986dd26b07c30747015d698906a6b0dfb611e2c6","options":{"section":null},"request_id_sha256":null,"results":["d-20260918-13"],"target":"decisions-ledger","v":1} -->

### d-20260918-14 — Which Windows stamp fills PGN cache revision ctime_nanos?

* **Question:** Which Windows change signal fills `PgnSnapshotRevision.ctime_nanos` so a same-length in-place rewrite that restores last-write time cannot keep stale game offsets trusted?
* **Governs:** f-20260914-29
* **Chosen:** `FILE_BASIC_INFO.ChangeTime` from `GetFileInformationByHandleEx(FileBasicInfo)` on the already-open PGN snapshot handle. Unix keeps inode `ctime`. `opened_file_change_stamp` stays on last-write.
* **Rejected:** substituting `last_write_time()` (already stored as `mtime_nanos`; restoring it is the filed attack); USN journal (volume-wide, extra privilege, not a per-handle stamp); hashing PGN bytes (no hash on this path; 10 MiB games; Unix does not hash).
* **Reason:** Locate showed the cache key is identity plus size, mtime and ctime, in-process only, with `creation_time()` as the Windows ctime producer and no test that restores last-write. ChangeTime is the NT analog of inode ctime, already available in the enabled `Win32_Storage_FileSystem` feature, queried on the same handle class as `windows_file_identity`. FAT has no independent change time and is out of scope; product data is NTFS.
* **Decided by:** Grok, autonomously under `full auto`, next-finding f-20260914-29 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"e60f86e29b6b699c577e7ba8657e245f6924136aada42de6e2d3f639d0724baf","input_sha256":"3c3fc8f44bb911b18e68f24a7d7337a20dd5023d362a6452b4165c652b9a2ad9","kind":"mutation-receipt","operation":"75cf0683d701b5bc2e5699477f4de2a94cccb7163b1b6f7088a9c6b78b02aa94","options":{"section":null},"request_id_sha256":null,"results":["d-20260918-14"],"target":"decisions-ledger","v":1} -->

### d-20260918-15 — Is the Windows flake a terminate bypass defect or a 20 ms search-deadline race?

* **Question:** Did `terminate` fail to bypass a flooded normal command queue on Windows, or did `service_search_read`'s 20 ms search deadline beat two `sleep(5 ms)` so the waiter saw a non-`EngineDisconnected` error?
* **Governs:** f-20260918-01
* **Chosen:** the fixture race. The red run's failed assertion was the waiter `matches!`, not `expect("terminate must bypass normal queue")`, so `terminate()` completed inside 50 ms. `actor_with` sets `search` to 20 ms; Windows timer resolution is classically ~15.6 ms, so two `sleep(5 ms)` can overshoot that deadline and `service_search_read` sends `EngineTimeout`. Repair: `delayed_search_actor` + `read_started` handshake (500 ms search deadline), `try_enqueue_set_option` so the flood fills the capacity-32 normal queue without yielding, a `bestmove e2e4` line so a second-read path cannot satisfy `EngineDisconnected`, and a waiter `match` that panics with `{other:?}`. Platform proof remains `rust-windows-test` on the unmodified Test workflow (`d-20260917-10`).
* **Rejected:** (a) only replacing the blind `matches!` with a diagnostic `match` — same rejection as `d-20260917-12`; it makes the next failure legible but leaves the sleep/deadline race; (b) treating it as a production terminate-path defect — the 50 ms bypass expect did not fire; (c) spawning 32 `set_option` tasks and sleeping so they "queue" — `service_search_read` polls `rx`, so the first `set_option` drops the delayed read and an empty `lines` fixture then sends `EngineDisconnected` from EOF before `terminate` runs; (d) widening the 50 ms terminate budget or the 5 ms sleeps — still timing-dependent on the Windows quantum.
* **Reason:** a discriminator, never timing (`async-resource-invariants.md`). The handshake proves the search read is parked; `try_send` fills the normal queue without scheduling the actor; biased `control_rx` then takes `Terminate`. The sibling 5 ms + `actor_with` tests in the same file (`termination_preempts_a_silent_search_read`, `logs_preempt_a_silent_search_read_without_cancelling_the_search`) got the same handshake because they share the 20 ms deadline.
* **Decided by:** Grok, autonomously under `full auto`, next-finding run f-20260918-01 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"28d91707238495e0ad2e41a616768e937e255ed843cb2296f6a86fefeefcdc18","input_sha256":"0bdfcd0af1018b02febe4bda6629c0be6ea670797f31e8edd2fefbe3fb4b8d69","kind":"mutation-receipt","operation":"27e1550dbab13c451b1401d1e5ae0d99ade12de5af63150322121d99396e4213","options":{"section":null},"request_id_sha256":null,"results":["d-20260918-15"],"target":"decisions-ledger","v":1} -->

### d-20260918-16 — Where does a finished search's trailing output get separated from the next search?

* **Question:** UCI output carries no request id; how is a line a finished search emits after its `bestmove` kept from being read as the next search's result?
* **Governs:** f-20260915-01
* **Chosen:** an `isready`/`readyok` barrier owned by `EngineRuntime::start_search`, the single place `go` is written. Every started search sets `search_output_unsynchronized`; `start_search` runs `ensure_ready` (which drops every line before `readyok`) before `go` while it is set; only a `readyok` read while the state is `Idle` clears it. An explicit caller barrier (`chess.rs` after `setoption`/`position`) therefore costs no second round trip.
* **Rejected:** (a) a barrier in `game.rs` only — every caller would have to remember it, the class stays open; (b) comparing request ids per line on read — UCI lines carry no id, so there is nothing to compare; (c) always sending `isready` before `go` — a redundant round trip after the chess.rs barrier; (d) clearing the mark on any `readyok` — one read during a live search is followed by more output of that search (pinned by `a_ready_barrier_during_a_search_does_not_close_its_output`).
* **Reason:** `isready` is UCI's only synchronisation point and the engine answers it after all output of the finished search. Putting it at the `go` choke point makes the invariant structural. Reversal: evidence of an engine that emits search output after `readyok` for a search already ended by `bestmove`, which would need a different discriminator.
* **Decided by:** Claude (Opus 5), autonomously under `full auto`, next-finding cluster result-not-bound-to-its-process · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"e872f486950fa74aace79054b303a590f743c7889d7dd252dbb14b108af5b0e6","input_sha256":"d1232f308befc67e19ba9cc29746933bd53621b8a5381533faea17c2f4e63f3f","kind":"mutation-receipt","operation":"8507632e0ae3c00d0c6c242c472692ebe8b5b17a35e305b36ab5ef95c8ed1fd3","options":{"section":null},"request_id_sha256":null,"results":["d-20260918-16"],"target":"decisions-ledger","v":1} -->

### d-20260918-17 — How does Windows preferred-sidecar replacement wait out in-process mappings?

* **Question:** On Windows, `atomic_replace_at` / `remove_entry_at` of the preferred search-index sidecar fails with ERROR_USER_MAPPED_FILE while another in-process search holds an `MmapSearchIndex` clone. What is the reader/writer protocol?
* **Governs:** f-20260917-04
* **Chosen:** a path-keyed mapping gate on `SearchCache` (`begin_preferred_replace`): draining flag plus lease count, parking_lot mutex, cancellable wait. Readers take a lease before opening/mapping the preferred leaf. Writers set draining, invalidate the index cache, wait until leases == 0, then one existing mutate, then drop the guard. `insert_index` refuses inserts while draining under the `indexes` mutex. Sidecar naming and `IndexSource` stay.
* **Rejected:** generation filenames (still rename onto the mapped preferred leaf, or else a pointer-plus-archive layout that changes the two-name contract in d-20260831-23/24); bounded 1224 retry (user-visible search failures); using `generation_lock` as the mapping barrier (f-20260908-01 split); waiting inside promotion (preferred does not exist yet); waiting inside `unlink_database_files` (no cache/token; wait at `delete_database_blocking` after retire).
* **Reason:** the filed concurrent reader is an in-process clone. The gate removes that class without changing sidecar names. External mappers still surface as MappedFile/Io after the wait.
* **Decided by:** Grok, autonomously under `full auto` · **Superseded-by:** d-20260919-10
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"15337084cda66ec4fc9836b8a1bfc34646327f38626c3293b1c9e0a1270b793a","input_sha256":"a98ea14b82951050cfd567c216560d64cbfd630fd6beac4a61aa03a80ed782e5","kind":"mutation-receipt","operation":"aed34afcbbfa829049d59e12df5b809fb7642c0a74f5c7097d2e1d147b3c8995","options":{"section":null},"request_id_sha256":null,"results":["d-20260918-17"],"target":"decisions-ledger","v":1} -->

### d-20260918-18 — How does the app-owned tree become canonical so use-time doors can enforce path equality?

* **Question:** How does the app-owned tree become canonical at its source, so `database_file_target` and `workspace_root` can require pathname equality without refusing a same-session database child or exempting DatabaseFile entries?
* **Governs:** f-20260917-13, f-20260905-10
* **Chosen:** descriptor-backed `AppDataDir` (longest existing prefix, canonicalize + `open_verified_directory`, `ensure_directory_at` for missing components and each closed-enum leaf). Callers of `get_or_create_root` with `Some(expected)` then pass a canonical `AuthorizedDir.path()`. Lift the `spelling_is_application_owned` skip at `rebind_legacy_spellings`. Require `acquired.path == stored.path` at both use-time doors.
* **Rejected:** use-time canonicalisation at the two doors (follows a swapped ancestor, `d-20260915-03`); keeping `create_dir_all`; keeping the path exemption (duplicate roots once callers are canonical); a stored `descriptor_bound` flag (withdrawn in the `f-20260914-36` review); exempting the app-owned subtree at the two doors (`d-20260918-03`).
* **Reason:** three plan-review rounds of `f-20260914-36` measured that neither equality-without-canonical-roots nor an exemption at DatabaseFile works. Four rounds on this plan (r4 all APPROVED) settled the producer. Reversal: new evidence that `mkdirat` from a held prefix fd still follows an ancestor.
* **Decided by:** Grok, autonomously under `full auto`, next-finding f-20260917-13 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"eb63e450ba23c61fc5022ec501ac470c4afad1a4f90ae56e588c3f958bdee634","input_sha256":"865a2d94a7414209fc81a19bfdc39d5afa1d1349eb41d4eb2fec5d0ec5a76f95","kind":"mutation-receipt","operation":"4b9bf38bec57afb03d8c3770cb0d6c6b109d11bba2e22d6e7dfeac9765d03304","options":{"section":null},"request_id_sha256":null,"results":["d-20260918-18"],"target":"decisions-ledger","v":1} -->

### d-20260918-19 — When is f-20260830-06 closed: when the non-Linux compile gates are green, or only after every Windows and macOS feature is complete?

* **Question:** When is f-20260830-06 closed: when the non-Linux compile gates are green, or only after every Windows and macOS feature is complete?
* **Governs:** f-20260830-06
* **Chosen:** close it once the original defect is gone: every configured non-Linux release target type-checks under `rust-platform`, the macOS and Windows Rust suites have jobs, and those jobs have been green on a real runner. Remaining first-statement Windows refusals stay as their own findings or as the standing `d-20260914-05` / `d-20260918-13` contract.
* **Rejected:** keeping the parent open as an umbrella until every Windows/macOS operation is feature-complete. That restates the drained `non-linux-platform-port` cluster (19 of 19 handled) and conflates "the crate cannot compile and nothing says so" with later ports. Also rejected: closing it without naming the CI proof; a local Linux-only green is exactly the failure the finding described.
* **Reason:** the finding's own weight sentence is the missing gate, not any one `cfg`. Slice 1 plus the child cluster installed that gate; run 35385943877 (`f0b203d5`) measured it green for `aarch64-apple-darwin`, `x86_64-apple-darwin`, `x86_64-pc-windows-msvc`, `rust-macos-test` and `rust-windows-test`. Reversal: a later `rust-platform` red on a configured release target, or evidence that `release.yml` still names a target the crate cannot type-check.
* **Decided by:** Grok, autonomously under `full auto` in a drain session · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"f979fe393adfdb9cb1d1543e4dd3ddbaaf4bafe54be8f380c63416d67ee81c78","input_sha256":"710d1c9b402e703343c24bc8af4a2eaeaf458398fc2098b7b411dba41eebbc8c","kind":"mutation-receipt","operation":"66ba8de0aed7209ea3fab4d6f959ca9275a8113251c13eba78e311eafcc98048","options":{"section":null},"request_id_sha256":null,"results":["d-20260918-19"],"target":"decisions-ledger","v":1} -->

## 2026-09-19 — recorded through the decisions lock

### d-20260919-01 — How does the fork host the engine catalog and updater?

* **Question:** How does ChessFable replace the unsigned www.encroissant.org engine catalog and the removed updater without a new website?
* **Governs:** f-20260830-48, f-20260831-04
* **Chosen:** One fork minisign key (updater encoding = base64 of the whole .pub file; artifact encoding = RW line). Engine catalog is bundled JSON plus detached .minisig, verified in Rust. Updater endpoint is this GitHub repo's latest.json. Release undrafts only after a complete tag matrix. Private key lives at ~/.local/share/chessfable/release.minisign.key mode 0600 and in GitHub secrets.
* **Rejected:** Runtime fetch from raw.githubusercontent.com; a new website; two keys; updater:default; shredding the only re-sign copy; publishing drafts from workflow_dispatch.
* **Reason:** d-20260907-07 forbids a site; d-20260907-08 forbids an unavailable origin; the live catalog already lacked signatures. Measured: tauri signer generate writes base64-wrapped keys; minisign_verify needs the RW line; gh secret list was empty and is now set.
* **Decided by:** Grok, full auto drain 5269c4d2-338c-4169-a9e9-dbc6c3c1ab0a · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"7d41980fbf391cad9d3895fa94684802f2b9f9b77b053245efd9ed4480aaa3f5","input_sha256":"c529546b8ea257d0f41f5afd020bf6ac1af9fb278d3815b93266ca367b4dbd34","kind":"mutation-receipt","operation":"ce3c90a4e03aa2123f82a843a91eb1c1a2da69be559c2998f9b40eb2398f66cb","options":{"section":null},"request_id_sha256":null,"results":["d-20260919-01"],"target":"decisions-ledger","v":1} -->

### d-20260919-02 — How does ChessFable ship default database and puzzle catalogs without www.encroissant.org?

* **Question:** Should default databases and puzzles be bundled signed metadata pointing at third-party HTTPS hosts the fork hashes and signs, dropped from the product until a hosted catalog exists, or left failing closed on the unowned origin?
* **Governs:** f-20260919-01
* **Chosen:** Bundled JSON plus detached minisig in `src/catalogs/databases.json` and `src/catalogs/puzzles.json`, verified before parse, with per-entry integrity over `{downloadLink}\n{sha256}` using the fork release key. Artifact bytes stay on `db.encroissant.org`.
* **Rejected:** Dropping the Add Database / Add Puzzle web lists until a fork-hosted catalog exists. Leaving the getters on `www.encroissant.org` (unsigned live JSON, schema-reject, fail closed). A new website (`d-20260907-07`). Signing against an origin this fork does not control (`d-20260919-01` already rejected that for engines).
* **Reason:** Same contract as the engine catalog (`d-20260919-01`). Live artifacts were reachable (measured Content-Length and SHA-256). `d-20260907-08` forbids replacing a live origin with an unavailable fork origin. Leela already uses `db.encroissant.org`.
* **Decided by:** Grok, autonomously under `full auto`, drain a4f49c70-507e-46c1-86a9-5b59c95ce0b6 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"16cea16ca6aa6114db0e1ca8907b764c73829c32854bfc3aba6599ae50ff71ef","input_sha256":"6338d0f8759e1f1717cbb59d415d007704a874a00fba445e297811bcec94fc3e","kind":"mutation-receipt","operation":"cb34ee0eb51ac43b29fa31c2c9c65d19c413f4d23a74557b4d18167275ddecf6","options":{"section":null},"request_id_sha256":null,"results":["d-20260919-02"],"target":"decisions-ledger","v":1} -->

### d-20260919-03 — Checker exemption vs OwnedStagingDir for temp-to-temp atomic_install_dir

* **Question:** Do the two production `atomic_install_dir` sites in `extract_zip_cancellable` / `extract_tar_cancellable` leave the release-surface count via a named checker exemption, or via a staging type whose constructors cannot express an arbitrary `Path`?
* **Governs:** f-20260905-06, f-20260905-08
* **Chosen:** `OwnedStagingDir` in `infra/fs.rs`, adopted from a process-owned `TempDir`. Install and Drop are relative to one held parent descriptor. `PATHNAME_FNS` is unchanged. `f-20260905-08` stays open at `entry=build` and cites this decision rather than re-deriving the exemption question.
* **Rejected:** a named checker exemption for backend-owned temporaries (weakens a deliberately blunt bare-name gate; `d-20260901-03`). Rejected: a `PathAuthority` registry entry for staging (`d-20260905-07` closed producers stay closed). Rejected: converting outer `.archive` staging off `private_tempdir_in` (would reopen `f-20260909-01` / `d-20260918-11`). Rejected: wrapping `atomic_install_dir` in an infra helper that still takes `&Path` (`d-20260905-02` loophole).
* **Reason:** the two sites are counted because they name a pathname primitive, not because extraction is uncontained. A type that cannot express an arbitrary path removes the names without teaching the gate a new exemption. 08's pathname writes inside the inner tree are a different obligation and stay out of this slice (`d-20260905-06` already refused pairing 06 with 07 for the same reason: shared file, not shared remaining decision).
* **Decided by:** Grok, autonomously under `full auto`, drain session e47a5848-5a8d-45ac-96e7-50d862f12e16 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"dc7d77bdb3c115385e7f102731aaafb001e8c3c83e02e800a84df3cff8af2bb8","input_sha256":"2e296939597785d57c2fb6e890ddd312c9e452e646cd5fd873b0e76cbc3f9c1e","kind":"mutation-receipt","operation":"e14eedc92b27e8284e31e856f3776d74a9d6cd332ec08ef47f5cfc6e8b62d456","options":{"section":null},"request_id_sha256":null,"results":["d-20260919-03"],"target":"decisions-ledger","v":1} -->

### d-20260919-04 — Does f-20260905-07 stay open until its filed residues close, or close now that AuthorizedDir landed?

* **Question:** After the AuthorizedDir conversions landed and the remaining sites were filed as f-20260905-08 and f-20260905-09, does f-20260905-07 stay open until those residues close, or close now?
* **Governs:** f-20260905-07
* **Chosen:** close f-20260905-07 now. Staging writes remain f-20260905-08 at entry=build under d-20260919-03; the native save-dialog export remains f-20260905-09 at entry=build.
* **Rejected:** keep f-20260905-07 open as a parent tracker until 08 and 09 are handled or rejected, as the 2026-09-05 progress note asked.
* **Reason:** an unchanged Status is a drain-loop. 08 and 09 are independently pickable Root-`-` entries; d-20260905-06 sliced 07 to the token plus the engine-image window, and d-20260919-03 refused folding 08 back into a sibling slice. 07's own questions are settled (d-20260905-07 through d-20260905-12) and present in the tree (`atomic_replace_leaf_identified`, `register_engine_image(&AuthorizedDir, …)`, `serve_sound` on a retained descriptor). Parent-tracking would re-run this id forever without touching 08 or 09.
* **Decided by:** Grok, autonomously under `full auto`, drain session 78169956-b117-452b-a8df-1231a84a355e · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"465201efc563b5c0208961e75bfa6cdab053a3abfadb944aeea81040c818c01e","input_sha256":"5bdf367e70fb589402b044ed8776c3f598cbf185196f6b2cb5a77018bb3ecd5d","kind":"mutation-receipt","operation":"018229e5497ee13ebe7128ea31b3f1903f50b008235166eaf75131d8be99660e","options":{"section":null},"request_id_sha256":null,"results":["d-20260919-04"],"target":"decisions-ledger","v":1} -->

### d-20260919-05 — Zip/tar inner writes only for f-20260905-08, or also download staging File::open?

* **Question:** After d-20260919-03 chose OwnedStagingDir, does this f-20260905-08 run convert zip/tar inner member writes only, or also the download staging payload File::open?
* **Governs:** f-20260905-08
* **Chosen:** zip/tar inner member writes only. Download staging create/open and dest-parent mkdir stay follow-ons.
* **Rejected:** converting File::open at fs.rs:999 without converting payload creation in download_file_core (would claim the payload closed while bytes are still made by pathname). Rejected: converting the shared download core in this run (also names engine-archive dest parents). Rejected: leaving 08 open as a parent tracker (d-20260919-04).
* **Reason:** locate showed the original seven sites mixed tempfile interiors with destination parents. Inner zip/tar members are the obligation d-20260919-03 named. Download File::open is a last read of a payload still written by pathname.
* **Decided by:** Grok, autonomously under full auto, drain 830f0512-6047-4ef0-b8b7-c3c353baa63c · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"86da79af24a6df3026788fc7986bfde7252d46d59f71c544c689f060478620fa","input_sha256":"38699e6098860d19c9e014a13b964e8682e2a13a432281dfaf80ca8b089a5b2c","kind":"mutation-receipt","operation":"165424b140ea39255acec6407ed89d7cd0f975dbc6c995f056d052259daa6faf","options":{"section":null},"request_id_sha256":null,"results":["d-20260919-05"],"target":"decisions-ledger","v":1} -->

### d-20260919-06 — What type carries a native save-dialog export destination?

* **Question:** What type carries a native save-dialog destination so the one-shot PNG/CSV export writes without a counted pathname `atomic_replace` in `main.rs`?
* **Governs:** f-20260905-09
* **Chosen:** A one-shot `NativeExportDest` in `infra/fs.rs` holding a parent `File` and a single-component leaf. Production constructor `from_save_path(PathBuf, expected_extension)` opens the parent with `open_parent_no_follow` and drops the pathname. Write is `atomic_replace_at`. Then remove `main.rs` from the filesystem-surface allowlist. `save_board_snapshot` / `save_engine_logs` signatures stay.
* **Rejected:** Reusing `create_pgn_export_destination` / persisting a `FileWorkspaceHandle` (PGN is a later renderer write through a persistent identity; PNG/CSV bytes are already in hand). Rejected: opening `AuthorizedDir` to a user-picked path (`d-20260905-07`). Rejected: an infra helper that still takes `&Path` and calls pathname `atomic_replace` (`d-20260905-02` loophole; `d-20260919-03` rejected the same shape). Rejected: a named checker exemption (`d-20260901-03`). Rejected: folding `f-20260914-24` into this slice (PGN cleanup, different file set).
* **Reason:** `d-20260901-03` already recorded that `PathRef` cannot represent a save-dialog destination. The counted defect is the pathname name in `main.rs`, not missing persistence. Descriptor-relative replace is the same shape `d-20260919-03` used for staging: a type whose write path cannot express an arbitrary pathname. Locate: the only production `atomic_replace(` in `main.rs` is `save_native_export_blocking`; PGN already has a different door.
* **Decided by:** Grok, autonomously under `full auto`, drain session d2bacd57-101c-4c1b-982f-5055c39dc8b2 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"df241742df4d669f9971e3e06d1e672d95f8ca9296a1620f6a55f7e3e09f485c","input_sha256":"3cac927e3b4ce5e8da2f9c6b1ba7f13c0e4b181a14bf0b8388ffc868c8fbec41","kind":"mutation-receipt","operation":"45b16a973cc42007f9269c3415f8cf90e5d2f22962bab5966d8d7482062d4718","options":{"section":null},"request_id_sha256":null,"results":["d-20260919-06"],"target":"decisions-ledger","v":1} -->

### d-20260919-07 — How does install-local.sh bind provenance `reviewed` to the bytes it publishes?

* **Question:** How does `scripts/install-local.sh` bind provenance `reviewed` to the installed binary rather than to a pre-build tree snapshot?
* **Governs:** f-20260905-11
* **Chosen:** `reviewed` only when this invocation ran `pnpm build` and `evaluate_tree` passed as clean-and-on-`@{upstream}` both before and after the build with the same HEAD. `--no-build` requires `--force` and writes `UNREVIEWED (prebuilt binary, --force)`. Untracked non-ignored files are dirty. The install lock is taken before the first tree check. `@{upstream}` stays the fork tracking ref.
* **Rejected:** Embed a git SHA in the Tauri binary (no identity exists today; different area; `$push` already rebuilds). Allow `--no-build` as `reviewed` on a clean tree (bytes unbound). Switch the ancestry check to the git remote named `upstream` (would refuse every fork-ahead install). Join multiple `--force` reasons (not required; last UNREVIEWED wins).
* **Reason:** The three filed holes were `--no-build` copying `target/release`, `--untracked-files=no`, and no post-build recheck. Binding in the installer closes them without a compile-time SHA. `$push` already calls the script with no flags, so the daily path still rebuilds and can still write `reviewed`.
* **Decided by:** Grok drain 2b746a66-8148-4ad1-8f23-b1e420cf6bb7, full auto · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"8655b41d08669ed249dbb6ed644157bd1f84bc3d5679b8db0f2e0c60e4d13d1f","input_sha256":"69525e480acc1a26dfe44e5a221476711abd87dbdb1b993098f0bac72b08673f","kind":"mutation-receipt","operation":"6654082d6cff882552d94b071bb0978d8d747c870d54c3426284c125aa835aed","options":{"section":null},"request_id_sha256":null,"results":["d-20260919-07"],"target":"decisions-ledger","v":1} -->

### d-20260919-08 — How does the local explorer Elo band apply to the two players?

* **Question:** Does the local opening-explorer Elo band filter the mover, the average rating, or both players?
* **Governs:** f-20260905-12
* **Chosen:** Both players must lie in the band (AND). The panel caption is "Both players". The explorer sends the same (min, max) as GameQuery.range1 and range2; position search applies range1 to White Elo and range2 to Black Elo. Unrated (indexed 0) is excluded when the band minimum is greater than 0. An untouched 0–3000 slider is no filter.
* **Rejected:** Mover-only (a 2800 vs 1400 game would enter an 1850–2350 slice). Average of the two ratings (the same pairing would enter if the mean did). A third GameQuery Elo field. Defaulting the band to 1850–2350.
* **Reason:** Felix named ChessBase Mega25_Elo_1850_2350 as the model — a game-level rating slice, not a mover filter. Position search already stores both Elos on the index entry. The games-table ranges already exist as range1/range2; reusing them avoids a duplicate field. The panel must say which rule it uses; "Both players" is that statement.
* **Decided by:** drain-92e2f30a-0a07-4c9a-993d-ff62aeaf68be · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"3772b3eb1d24d529efd8b7fa20493bf0af6daa327a93d73ba7346cb1a8b2a45b","input_sha256":"abd29166735ad02eae7d3eeaa82c913c81a1edaae9384472badb8fdc4f0b8769","kind":"mutation-receipt","operation":"90fc86e4c98581485a55326c1db84bcd455713ddb97a58a0c6986b7efa11c844","options":{"section":null},"request_id_sha256":null,"results":["d-20260919-08"],"target":"decisions-ledger","v":1} -->

### d-20260919-09 — Which event-name tokens does the local explorer exclude-fast toggle match?

* **Question:** Which event-name substrings should the local explorer "exclude fast events" toggle drop, and is the default on?
* **Governs:** f-20260905-12
* **Chosen:** Case-insensitive substring match on Events.Name for blitz, bullet, and armageddon. Rapid and Schnell are kept. Default off. Implemented as optional GameQuery.exclude_fast_events, not a TimeControl tag, and not an index-format change.
* **Rejected:** Matching rapid or Schnell (contradicts "rapid tolerated"). Filtering Games.TimeControl (empty on Mega/YottaBase). Default on (would change today's explorer counts without an explicit act). Adding event_id to SearchGameEntry.
* **Reason:** Felix's addendum listed those names as how official rapid/blitz events are recognised, and the target set is classical plus tolerated rapid, nothing faster. Mega/YottaBase carry no TimeControl tag. The search index has no event column, so a SQL subquery on Events.Name is the filter that leaves the index unchanged.
* **Decided by:** drain-92e2f30a-0a07-4c9a-993d-ff62aeaf68be · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"7fa8f11e51ad12bf1d4f430badb4ea3a6dd0972e12fe554bd8d88aa82bd62417","input_sha256":"6f74c10a6d4de16823602dd5300d8a958aaa37f173fb0f8fea2a86cff435c3e5","kind":"mutation-receipt","operation":"d4eb80f350d1017f84c466d6a7f46cf3ebf5861d32244dc99c7e47875dfdea02","options":{"section":null},"request_id_sha256":null,"results":["d-20260919-09"],"target":"decisions-ledger","v":1} -->

### d-20260919-10 — Does a live mapping make Windows refuse to replace or delete the search-index sidecar?

* **Question:** `d-20260918-17` built the in-process mapping gate on the premise that `atomic_replace_at` and `remove_entry_at` of the preferred sidecar fail with `ERROR_USER_MAPPED_FILE` (1224) while a mapping lives, and `f-20260917-04` pinned that with a Windows-only test of an unleased external mapper. The test was red on every `rust-windows-test` run from 35391848926 onwards with `Ok(DurableCommit)` (f-20260918-03). Is the premise true, and what should the test pin?
* **Governs:** f-20260918-03
* **Chosen:** the premise is false for both operations, by measurement. The replace is a `FILE_RENAME_POSIX_SEMANTICS | FILE_RENAME_REPLACE_IF_EXISTS` rename and the delete a `FILE_DISPOSITION_POSIX_SEMANTICS` unlink; on `windows-latest` (run 35424078540, `5284874d`) both commit in one attempt under an unleased mapping, the mapper keeps the bytes it mapped, and the leaf is the new generation or absent. The tests `search_index_mapping_gate_external_mapper_keeps_its_generation_across_one_replace` and `..._across_unlink` pin exactly that on every platform. No production code changes: the gate is correct, only its stated reason is not.
* **Rejected:** keeping a 1224 expectation behind a changed share mode or a non-POSIX disposition (it would reintroduce the user-visible search failure the gate was built to remove, to satisfy a test); deleting the test (the external mapper is the one reader no lease can see, so its isolation is the property worth pinning); removing the mapping gate here (a design question with its own trade-off — how long a superseded generation may stay pinned — filed as f-20260919-06).
* **Reason:** new evidence under clause 2: two runner measurements replace an assertion nobody had run (rule 12b). This supersedes the premise and the sentence "External mappers still surface as MappedFile/Io after the wait" in `d-20260918-17`; its chosen mechanism stands until f-20260919-06 is worked.
* **Decided by:** Claude Code, autonomously under `full auto` · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"8605dc7b099f590c662301dafb6553664612c8cb76f3690d8da9f081771b9301","input_sha256":"c34aff784ccfeb53929268795466e3cf69356ba57335e7c10a11f14a23cc719f","kind":"mutation-receipt","operation":"d133ffbd38d22d7dbb646c87de2818d284441928efbf97b13fb54d9a9458de74","options":{"section":null},"request_id_sha256":null,"results":["d-20260919-10"],"target":"decisions-ledger","v":1} -->

### d-20260919-11 — What fixes "double-click on a Files row opens nothing" — the gesture, `draggable`, or the layout?

* **Question:** What fixes "double-click on a Files row opens nothing" in the real window — the gesture handling, the row's `draggable` attribute, or the page layout?
* **Governs:** f-20260905-14
* **Chosen:** The layout. Nothing whose presence depends on the selection is rendered before the tree; Rename/Move/Trash live in the card column. `draggable` stays. `pnpm verify:app` item 10 (a real W3C pointer double-click on a not yet selected row) is the standing proof.
* **Rejected:** Removing `draggable` (the finding's prime suspect); debouncing clicks, counting `mousedown`, or deferring the selection render — each keeps a tree that moves under the pointer.
* **Reason:** Measured 2026-09-19 in the release binary: on an unselected row the first click selected it, the page inserted its action bar above the tree, the row moved from y=140 to y=170, and the second click landed on the bar (`dblclick` fired on another element, the Rename modal opened, no `dragstart` at all). On a pre-selected row the identical gesture opened the game. The finding's second suspect, a discarded `openEntry` rejection, was already fixed by `813563b7`/`db8a07c5`.
* **Decided by:** Claude Code (Fable), `full auto` build run 2026-09-19 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"409db94564a4fbe7b6658087f77e95e82e50944ba39b1b24aa975d6c92b3af75","input_sha256":"65313d2707e224a5daec88680c4169d0e293c1072e7b7144075099482a9527cf","kind":"mutation-receipt","operation":"2d677047e9250c7f10aa94c42c46e5f6ba41b87bca4624378dd3d9ccb0bed117","options":{"section":null},"request_id_sha256":null,"results":["d-20260919-11"],"target":"decisions-ledger","v":1} -->

### d-20260919-12 — What does the restored Files page show, and what is left out?

* **Question:** Restoring the Files page's file card: which of upstream's controls come back, in what form, and what stays out?
* **Governs:** f-20260905-14, f-20260910-06, f-20260919-07
* **Chosen:** Two content-sized columns that stack below `sm`, the page scrolling as a whole. Left: search box, create buttons, a clearable file-type `Select`, the tree in a bounded scroll region. Right: labelled Rename/Move/Trash plus `FileCard` for a file, name and entry count for a folder, a placeholder otherwise. Search and type filter are local state, not persisted. The card is keyed by the file's handle key and owns its game-name cache. The card loses its "Edit metadata" icon.
* **Rejected:** Upstream's five type chips (one chip is wider than the column at 320px / 200%, measured: content 213px in a 108px column); window-height columns with inner scrolling only (at a 200% font scale the controls alone exceed the height and the columns overlapped, found by the container e2e run); `overflow: hidden` on any column (the finding forbids it); keeping "Edit metadata" as a relabelled rename; upstream's `mod+f`/Delete hotkeys; persisting search/filter (would join the session-storage budget question of f-20260906-24).
* **Reason:** Type-only editing is impossible today — `rename_workspace_file` with an unchanged name rejects with an I/O error (measured), so it is filed as f-20260919-07 and the icon returns with that command. The document-width assertion alone could be satisfied by a scroll container absorbing the overflow, so the 320px scenario also asserts that no ancestor of the row, the card's game list and the action row is narrower than its content. Reversal path: the Select-vs-chips and labelled-buttons choices are single JSX blocks in `FilesPage.tsx`.
* **Decided by:** Claude Code (Fable), `full auto` build run 2026-09-19 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"615251b2390668ced5b72dac260e6f2ddd00753c4c9d3d09d5d9a1d5ac4910c5","input_sha256":"c01095c7fd22c42cf8d6d7e387bc042271db0bb2389dcf44588149d81578a448","kind":"mutation-receipt","operation":"c35b30a2a14bf89f46a8991a6bc80fcefa35d06331cb6974bc06b09cec7eab89","options":{"section":null},"request_id_sha256":null,"results":["d-20260919-12"],"target":"decisions-ledger","v":1} -->

### d-20260919-13 — May a Claude session re-record e2e snapshots inside the pinned Playwright container, permanently rather than by a one-run lift?

* **Question:** `.claude/settings.json` denied every snapshot-update form, the container one included, so each Claude-run visible change stopped and asked Felix to type `! pnpm test:e2e:update`. May the container form be opened for good?
* **Governs:** f-20260905-13, f-20260905-14
* **Chosen:** remove the three container-form deny entries (`pnpm test:e2e:update*`, `pnpm run test:e2e:update*`, `*run-e2e-container.mjs*--update-snapshots*`) and keep the deny on a direct host `playwright … --update-snapshots`. In the same change `.claude/skills/verify-ui/SKILL.md` gains the rule that actually guards the evidence, binding every agent: run the container suite first and read each diff image, re-record only when every moved snapshot differs solely where the change was meant to show, predict the moved set and stop if another snapshot moves, and name the moved snapshots in the commit and the report.
* **Rejected:** keeping the deny and having Felix type the command (on 2026-09-19 it stalled two sessions, one of them for six hours with ten unpushed commits, and the keystroke reviewed nothing because he does not look at the images); another one-run lift in the manner of `d-20260902-01` (the class returns with every visible change); a hook or script that inspects image diffs (a new program where a written rule suffices, rule 6d).
* **Reason:** the container deny was never intended. `432a8128` (2026-08-29) repointed `test:e2e:update` at the container and said "only a direct `playwright ... --update-snapshots` stays denied"; one day later `acca6ec9` repaired a "dead" rule described as "meant to stop native snapshot re-recording" by making it match the command that was by then the container updater. `d-20260902-01` already read the guard the same way ("the guard's recorded reason is host rendering … neither reaches the container path"). It also bound one agent of three: Codex sessions re-recorded snapshots four times between 2026-09-06 and 2026-09-10. The strongest case against — a session could re-record to absorb a regression it did not intend — is answered by the verify-ui rule, not by a deny that one agent family never saw. Reversal path: restore the three entries.
* **Decided by:** Felix, in the chat, 2026-09-19 ("So my reply is yes"), on Claude Code's recommendation after he asked for it to be examined critically · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"ec9c75a0fa1c5eb2fafe7f98af23b5270af4a8d8beee0faaf627ef8c64c5fe68","input_sha256":"91bd922cd61277538485e25b55f2c92bb17da5535b860e790608cb6a3806f850","kind":"mutation-receipt","operation":"420c9b693457ff72ecc24fb3cfe98625d4b1bc38cef888a593ef28a8ece5dfa5","options":{"section":null},"request_id_sha256":null,"results":["d-20260919-13"],"target":"decisions-ledger","v":1} -->

### d-20260919-14 — Where does the binding export stop rewriting an unchanged `generated.ts`: in `check-bindings.mjs` or in the Rust exporter?

* **Question:** `pnpm bindings:check` gave `src/bindings/generated.ts` a new mtime on every run, refusing receipts of gates running beside it. The finding proposed exporting to a temporary path inside the check script; should the fix sit there or in the export itself?
* **Governs:** f-20260906-06
* **Chosen:** the Rust export renders with tauri-specta's `export_str` and writes through `infra::fs::write_if_changed` (skip identical bytes, else `atomic_replace`); `check-bindings.mjs` is unchanged. The target path is the manifest directory's `parent()` joined with `src/bindings/generated.ts`, because `atomic_replace` refuses a `..` component (measured on the first attempt).
* **Rejected:** a temporary-path export in `check-bindings.mjs` (needs a new exporter flag, and still leaves `bindings:generate` and every debug start rewriting the tracked file); keeping `Builder::export` (its `File::create` truncates and rewrites unconditionally).
* **Reason:** one writer serves all three callers, so the property holds for every path that runs the exporter, not only the check. `export_str` equals what `export` wrote because no formatter is configured on `Typescript::default()`. Reversal path: restore `specta_builder.export(...)` in `main.rs`.
* **Decided by:** Claude Code (Opus 5), drain run 2026-09-19 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"960dbe599eecfe1f3a24a72194fb3631227799046263e0a00c25ccb2e9137051","input_sha256":"92feda617f4866ef3649599595b9c868d8cb7ef8fa6e1a5b152fc874518e0e5b","kind":"mutation-receipt","operation":"2f2033c7a7f892fb446d0b9a8579dbb7691be9b1d9ee29011d5bcfe12e350199","options":{"section":null},"request_id_sha256":null,"results":["d-20260919-14"],"target":"decisions-ledger","v":1} -->
