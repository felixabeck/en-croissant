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
  rounds of six plan-review lenses · **Superseded-by:** d-20260922-08

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
* **Decided by:** Claude Code, autonomously under `full auto` while Felix was away · **Superseded-by:** d-20260927-24

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
* **Decided by:** Grok, autonomously under `full auto` · **Superseded-by:** d-20261002-08

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
* **Decided by:** Grok, phase 1b of the 2026-09-02 agent-setup overhaul, under rule 22e (the Product-impact sentence cannot be written honestly) · **Superseded-by:** d-20260928-01

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
* **Decided by:** Claude Code, autonomously under `full auto` while Felix was away · **Superseded-by:** d-20261004-06

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
* **Decided by:** Claude Code, autonomously under `full auto` while Felix was away · **Superseded-by:** d-20261004-07

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
* **Decided by:** Claude Code, autonomously under `full auto` while Felix was away · **Superseded-by:** d-20260920-06
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"410de95631c233c42efe918b2760217f4974df4087d97e529a7698f8aa4dceb2","input_sha256":"3fb6fd0df2e2a14fcaa7699e3947fe489549e7ce8bb301e0f45a9a0a2363d540","kind":"mutation-receipt","operation":"b068b6e2ec957b8a0302841c8a7a09e360e3f8587bebd6a2b36d648c08da77bd","options":{"section":null},"request_id_sha256":null,"results":["d-20260906-06"],"target":"decisions-ledger","v":1} -->

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
* **Decided by:** Claude Code, autonomously under `full auto` in a drain session · **Superseded-by:** d-20260930-02
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"290e9f5266f7e5b93ecbb90af22dcc26365630ab77ec86bae83db7eddb579b8c","input_sha256":"d58148f35999452f6df4a7425ff0c3c5da765525a77bd374508e6737993bf799","kind":"mutation-receipt","operation":"0eb88efbbe83ab2d977eb7c13521dfdeb0ee775625ea4ace274add9faf13f7c3","options":{"section":null},"request_id_sha256":"e3a166d7d06446eaba4cbd50ace71d1da4a157c3510c7b8f6ff7cf117b761dd6","results":["d-20260914-08"],"target":"decisions-ledger","v":1} -->

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

## 2026-09-20 — recorded through the decisions lock

### d-20260920-01 — What identifies a download natively, so a Cancel pressed before the command registered it is not lost?

* **Question:** What identifies a download natively, so a Cancel pressed before the command registered it is not lost?
* **Governs:** f-20260906-07
* **Chosen:** A native-minted, owner-bound reservation, exactly like native reads and analysis: `prepare_download(window)` mints a ticket into the same bounded, TTL'd reservation pool; every download command claims it as its **first fallible step** with `window.label()` as owner; `cancel_download` marks a still-reserved ticket cancelled so the later claim fails with `Cancellation`, and `release_download` returns an unclaimed one. The renderer never invents a job id.
* **Rejected:** keeping renderer-chosen `crypto.randomUUID()` ids plus a native "tombstone" set that pre-cancels an id that has not arrived yet — it needs its own bound and TTL for ids that never arrive, and leaves the identity renderer-controlled. Also rejected: a renderer-only cancelled flag checked before invoking, which leaves the IPC-in-flight window open.
* **Reason:** the reservation protocol already exists for the two other classes of native work, is bounded (`MAX_NATIVE_READS`), owner-checked and TTL-purged, and claim-first makes every command's ownership reachable in a test. The pre-registration window that the finding describes closes by construction rather than by timing.
* **Decided by:** drain 13b31f81 (`/next-finding --pin f-20260906-07 full auto`), 2026-09-20 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"992d87022d14f316a3e1f968bc1f546f8c94b16c468b840ad5e34c31f8deb02d","input_sha256":"8d2ad4110f7af924dcacb600dc0ab127304a7e619e65009d8ee7cda694be4b56","kind":"mutation-receipt","operation":"5b655124fd94eae3605137a69ab714ad91add566522da4f908a4845e59af5775","options":{"section":null},"request_id_sha256":null,"results":["d-20260920-01"],"target":"decisions-ledger","v":1} -->

### d-20260920-02 — What does an acknowledged download cancellation promise, when the cancel races publication?

* **Question:** What does an acknowledged download cancellation promise, when the cancel races publication?
* **Governs:** f-20260906-07
* **Chosen:** A commit gate in the operation registry linearizes the two. The last fallible check before an artifact becomes visible calls `begin_commit()`, which fails with `Cancellation` if the token is already cancelled and otherwise marks the operation `committing`; `cancel_download` on a committing operation answers `false` and does not cancel. So `cancel_download -> true` means no artifact of that download will be published, `false` means it was not cancelled and the download's own result stands — including a typed post-commit outcome such as `CommittedDurabilityUncertain`. The renderer treats only a `Cancellation` settlement (or a cancel before the job invoked its ticket) as a cancel that took effect.
* **Rejected:** treating the job's terminal result alone as the acknowledgement, with no native barrier — the r2/r3 design. It cannot distinguish "cancelled, nothing published" from "cancelled after the rename", so `cancel_download` could report success while the artifact was published. Also rejected: rewriting every failure that surfaces after a cancelled token into `Cancellation`, which would swallow the deadline path's `EngineTimeout` (`await_staging_deadline` cancels the same token).
* **Reason:** the mandate is "no artifact is published" after a cancel the user was told succeeded; without a barrier that is unprovable, and three lenses traced the precommit-to-rename window over two rounds. The gate makes the boolean exact and keeps real failures visible.
* **Decided by:** drain 13b31f81, 2026-09-20 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"6c846aa2f7d9c469b6f99871e1ea86313c7ed14ae384345f73e72ec82a8a9ed9","input_sha256":"c45e522cc9b5bb5fc1c144a150f206b2103ea7c377886c5adce423272d651cf5","kind":"mutation-receipt","operation":"a62518370a4713a3b4375b4e147c0fbd1094dd9853549995ac10d10997dc1712","options":{"section":null},"request_id_sha256":null,"results":["d-20260920-02"],"target":"decisions-ledger","v":1} -->

### d-20260920-03 — Who clears a cancelled download's progress bar, and how is a retry's bar protected from that clear?

* **Question:** Who clears a cancelled download's progress bar, and how is a retry's bar protected from that clear?
* **Governs:** f-20260906-07
* **Chosen:** The renderer download-job registry does it: when a job settles as cancelled it awaits `clearProgress(progressId)` **before** releasing its registry entry, and a start for a registered progress id is refused — so a retry cannot begin, let alone reach `begin_progress`, until that clear has completed natively. `ProgressButton` gets `clearOnCancel={false}` for the download cards and applies the returned generation as a local fence instead. `useProgress` additionally subscribes before it snapshots, prefers a terminal item over a running one of the same generation, and keeps its generation floor monotonic; a cancelled item renders no bar.
* **Rejected:** the generation-bound `clear_progress` family developed over rounds 3-13 — `expected_generation`, a `ClearOutcome` enum, and a module-level per-id floor store. Each variant closed one race and opened another (unbounded floor retention for per-report analysis ids, `Kept` yielding no floor, clear-emit failure modes), and all of it was state added to protect a clear that the job can simply own. Also rejected: relying on IPC dispatch order, and a local-only `discard()` (it cannot fence when nothing is displayed).
* **Reason:** ordering the clear inside the entry that refuses retries removes the race by construction rather than by comparing generations, and subscribe-then-snapshot removes the stale-snapshot class at its cause (the snapshot was requested in parallel with an asynchronous listener registration).
* **Decided by:** drain 13b31f81, 2026-09-20 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"f0f6199827a6c01b13d36db750262d6a93e8abe3be4c7062b99c49078dc8c6f5","input_sha256":"df07fd948ec077db5047f56eafbc315fe4a1815f9a36740d2193ce3199fa7208","kind":"mutation-receipt","operation":"7fb8ae4b1bc64995597371ed915cc95c6b8f14c04e9d624a1e13d3366b918bfd","options":{"section":null},"request_id_sha256":null,"results":["d-20260920-03"],"target":"decisions-ledger","v":1} -->

### d-20260920-04 — How is the download command wiring proven, given the commands cannot be registered on `MockRuntime`?

* **Question:** How is the download command wiring proven, given the commands cannot be registered on `MockRuntime`?
* **Governs:** f-20260906-07
* **Chosen:** Three layers, none of them a registered-command IPC test: registration is proven by `pnpm bindings:check` plus `tsc` (the renderer facade calls the generated `prepareDownload` / `releaseDownload` / `cancelDownload`, and the binding is exported from the production builder); owner threading by source-scan tests in the existing `main.rs` style, pinning that each command body passes `window.label()` to its core exactly once; behaviour by tests against the runtime-generic cores, including externally cancelled in-flight downloads and both sides of the commit gate.
* **Rejected:** a `tauri::test::MockRuntime` test invoking the real download commands through the registered handler — the production commands take the concrete Wry `AppHandle`/`WebviewWindow`, so registering them on `MockRuntime` would require genericizing the whole command surface. Also rejected: adding a download scenario to `pnpm verify:app`, which would mean new app-driver tooling (rule 6d) driving live signed remote artifacts over the network.
* **Reason:** the alternatives buy the same evidence at the cost of either a large refactor of the command surface or a network-dependent verifier; the three layers together already fail if a command is unregistered, mis-owned, or claims twice.
* **Decided by:** drain 13b31f81, 2026-09-20 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"a12e4b7051c1cf9c93c2d4e4874d15758bb7a47a65c9fb35803ac90577182161","input_sha256":"d89b89ca1c4ae7ead4eda6f4d87c0dbfc33e1c64de8440a04fa4ab07101ce66d","kind":"mutation-receipt","operation":"7a6d7710e9c43213993ed54c1345e8ca7899bdc2e61dbed69deeaf2700100d1d","options":{"section":null},"request_id_sha256":null,"results":["d-20260920-04"],"target":"decisions-ledger","v":1} -->

### d-20260920-05 — Does the board route's lazy-chunk budget get headroom by deferring the flag pack, by deferring the evaluation chart, or by re-recording the cap?

* **Question:** `pnpm bundle:check` was red by 33 bytes on `largestLazy` and blocked the push. Which of the three candidates buys the headroom?
* **Governs:** f-20260920-03
* **Chosen:** defer `mantine-flagpack` and `countries.json` to a dynamic import inside `FideInfo`, and tighten the `largestLazy` ceiling 750,000 → 550,000 in the same change. Felix chose this in chat on 2026-09-20 after being shown all three measured; the tightening is the technical half and is mine.
* **Rejected:** (a) lazy `EvalChart`, which the previous session recommended — **measured red**: it splits shared code and moves `total` to 1,550,268 against a 1,550,000 cap, so it replaces one red metric with another while also costing a visible Suspense gap in the analysis panel. (b) re-recording the `largestLazy` limit upward — permitted by `docs/bundle-budgets.md` with a rationale, but it accepts ~1.7 MB of raw JS on every board route forever, half of it flags. Also rejected inside (c): deep-importing one flag (the package's `exports` map exposes only `"."`), tree-shaking the namespace import (`Object.entries(Flags)` is a runtime iteration), and keeping `countries.json` static (measured: `largestLazy` 520,038 against 508,162, so the JSON is worth 11,876 gzip bytes).
* **Reason:** five `pnpm build-vite` runs. Today 750,033 red; (a) 642,166 but `total` 1,550,268 red; (c) 508,291 with `total` 1,546,205, all three caps green. (c) is the only candidate that lowers both the route and the total, and the flag pack was 46% of the route for a modal that is rarely opened and already waits on a network lookup. The ceiling is tightened because 750,000 over a 508,291-byte route would not notice the pack returning — the exact accident being repaired.
* **Decided by:** session 3caae197-7640-447c-b4be-62fa5a867728 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"bf947900d979f0a4fbbd80dffad6d29de9427dafaf943563d76c1c43765b5991","input_sha256":"527923e1e65c6d9c369cf311199d29b56e5c69a9c3ca812c694f7c530676d277","kind":"mutation-receipt","operation":"d86d464e3b8bfea5f2ab212195589dadc32db8d893b12d4b036743176974ae7f","options":{"section":null},"request_id_sha256":null,"results":["d-20260920-05"],"target":"decisions-ledger","v":1} -->

### d-20260920-06 — Where the execute bit is restored for an archive-installed engine, and what becomes of the command that used to do it

* **Question:** `f-20260906-08` — archive extraction creates every entry `0600` and the install preserves it, so a default engine cannot be exec'd on unix. Is the bit restored by a renderer call to `tauri.setFileAsExecutable(handle.id)` inside `installDefaultEngine` (the command took a `PathRef`), or by the authority itself during registration, deleting the now-dead command?
* **Governs:** f-20260906-08
* **Chosen:** the authority. `PathAuthority::register_installed_engine` already resolves the exact target under `PathOperation::EngineInstall` and proves it is a regular file, so it now calls `resolved.mark_engine_executable()?` on that same `ResolvedPath`, before `register_engine_file_from_resolved` persists anything: a failed chmod fails the registration and leaves the registry unchanged. On Windows `mark_engine_executable` is a checked no-op (`d-20260918-09`), so no `cfg` is needed at the call site. `set_file_as_executable` and `set_file_as_executable_blocking` are deleted with their `use`, their `collect_commands!` entry and the two `main.rs` source-scan tuples; `src/bindings/generated.ts` is regenerated and loses `setFileAsExecutable`. The guard the command carried moves to `register_installed_engine_marks_executable_without_off_unix_refusal`, which pins four things with assertion-unique messages: `.mark_engine_executable()?` is present *with* the `?`, it precedes `register_engine_file_from_resolved(`, the body has no `off_unix_refusal`, and neither `fs.rs` nor `main.rs` still names the deleted command.
* **Rejected:** calling `tauri.setFileAsExecutable(handle.id)` from `installDefaultEngine` between `registerInstalledEngineHandle` and `getEngineConfig` — it restores the behaviour but keeps it as a renderer-ordered obligation that no gate can check, which is precisely how the defect arose: the call existed, `3afed031` deleted it with the old path-based install flow, and nothing noticed for over a year. Also rejected: a second, narrower registration-only test beside the chain test (it asserts a strict subset); asserting only the mode bit rather than executing the installed payload (it infers launchability instead of observing it); and staging the `fchmod` failure branch, which on a file the test process owns in a writable tempdir is reachable only through root or a second uid — it is recorded as argued, not staged.
* **Reason:** "a registered installed engine is launchable" is an invariant of the object's owner, not an ordering rule for its caller, and moving it there also removes one IPC round trip and one renderer-reachable command. Proof is one `#[cfg(unix)]` chain test under a zeroed umask that drives the real extraction path, pins the `0o600` premise, registers, and then actually execs the installed file; it collects a message per check and fails once, so a staged break shows every affected assertion rather than only the first. Measured beforehand: exec of a `0600` inode through `/proc/self/fd/N` fails `EACCES`, the same inode at `0700` runs.
* **Supersedes d-20260906-06**, which kept two unwired commands registered so that "the wiring run does not first have to restore them". Both halves have now reached that terminus: `set_file_as_executable` here, and `cancel_download` independently, with `f-20260906-07` handled on 2026-09-20 and the command claimed by `src/hooks/downloadJobs.ts`. The three superseded commands that decision filed as one `inline` finding are untouched and stay with `f-20260906-11`. This is that decision's own condition being met, not a different opinion on the same evidence.
* **Decided by:** Claude Code, autonomously under `full auto` while Felix was away · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":9,"effect_sha256":"85a16417691d80f7ac988df2e6f4a2c1162842d662bce4a339fe9313ddfc1784","input_sha256":"1310ad7f744421012f68bbd8484724fc3cc0cf70692577c019d4efd9b8b62d12","kind":"mutation-receipt","operation":"61f62cc3fc1b84468a62e6132d424696e35c3dfaa8c29e793c62e419c072d271","options":{"section":null},"request_id_sha256":null,"results":["d-20260920-06"],"target":"decisions-ledger","v":1} -->

### d-20260920-07 — Does `LocalImage` build a `data:` URL, or does `img-src` gain `blob:`?

* **Question:** `f-20260906-09` — an `<img>` whose `src` is an object URL is blocked by the application CSP (`img-src 'self' data: …`, no `blob:`), so every portrait behind a registered `imageHandle` is invisible. The finding names two fixes: (a) build `data:${mimeType};base64,…` from the bytes, which the policy already permits, or (b) add `blob:` to `img-src`.
* **Governs:** f-20260906-09
* **Chosen:** (a), and `src-tauri/tauri.conf.json` is not touched. `LocalImage` accumulates a binary string over 8192-byte chunks and calls `btoa` **once**, dropping `URL.createObjectURL`/`revokeObjectURL` and with them the object-URL lifecycle; the failure branch reports the normalized error through `warn` from `@/platform/native` in the promise-safe `void warn(...).catch(() => undefined)` form (`src/hooks/downloadJobs.ts:47`), keeping `setSrc(undefined)` so a failed re-read clears a stale image. Three measured facts pin the encoder: the spread into `String.fromCharCode` has an unstable stack limit (100,000 arguments ok, 125,154 throws `RangeError: Maximum call stack size exceeded`; a binary search in the same runtime and a review lens each put the boundary one step elsewhere, so only "200,000 throws" is claimed); per-chunk `btoa` is wrong because each call pads its own tail (`01..0a` split after 4 bytes gives `AQIDBA==BQYHCAkK`, not `AQIDBAUGBwgJCg==`); and the chunk is 8192 **because it is not a multiple of 3**, so that regression stays visible to an output-based test.
* **Rejected:** (b) adding `blob:` to `img-src` — the token is unscoped, so it would permit any blob any script in the page can mint, widening the policy for the whole renderer to fix one component. The repository's recorded posture is the opposite, in three places: `src/utils/engines.ts:186-187` rejects remote catalogue portraits explicitly so "CSP img-src does not need widening", the `f-20260830-24` closure note records "The CSP is untouched" and hands this defect forward by id, and the repo-root `CLAUDE.md` states that widening a declared scope "is a security decision, not a build fix". Also rejected: `FileReader.readAsDataURL`, which would add a second asynchronous hop with its own `onload`/`onerror` and reintroduce the `Blob` this change removes; a bounded per-key failure latch (the `sound.ts` question of `f-20260906-10`, which does not arise for an effect that runs once per mount); logging the image id behind a UUID-shape guard — `engineImageHandleSchema` accepts `z.string().min(1)` (`src/utils/engines.ts:86-89`), so a UUID-shaped secret passes it, and the id is therefore not logged at all; chunk size 8190, which is correct under per-chunk `btoa` and for exactly that reason makes the regression byte-identical and unprovable; and deleting the probe's `blob:` negative control, which is what stops the positive check from being satisfiable by a widened CSP.
* **Reason:** option (a) needs no security decision, because `data:` is already in the policy; option (b) needs one, and rule 33 keeps money and law with Felix but leaves this with the code. The memory argument does not decide it either way: `EngineImageData.bytes` is `number[]`, so a 10 MiB image already crosses IPC as ten million JSON integers before either option runs, and the ~13.3 MB base64 string is a fraction of what the transport already spent. Plan review converged in four rounds on Codex, 27 lens runs, 28 issues, round 4 returning six of six `APPROVED` with zero findings; every round independently re-verified the three cited records above. Full history: `tasks/handoffs/2026-09-20-f-20260906-09-review.md`.
* **Decided by:** Claude Code, autonomously under `full auto` while Felix was away · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"fe3ff7d468fd9b84065c8b2631f28642d913634ec5eb143a2a8abe25ba0a502a","input_sha256":"dd725ae7e1e31789ce862eb836c84acdaa4ea38bda05ec2c5b651d0b55f8ff0e","kind":"mutation-receipt","operation":"d3ccb5abfcf4922617534725d699c37e0955ebe09b5600fdb22a02581ec68e75","options":{"section":null},"request_id_sha256":null,"results":["d-20260920-07"],"target":"decisions-ledger","v":1} -->

### d-20260920-08 — How tightly must a failed `getSoundServerPort` lookup be bounded, and at what price?

* **Question:** How tightly must a failed `getSoundServerPort` lookup be bounded, and at what price?
* **Governs:** f-20260906-10
* **Chosen:** A failure latch alone — a module-level flag set in the rejection handler and tested at the top of `playSound`. It stops every lookup that *begins* after the first rejection is observed. Lookups already in flight when the rejection arrives complete normally, and the test asserts that allowance explicitly rather than leaving it implicit. The success path is byte-for-byte unchanged.
* **Rejected:** (a) Memoizing the lookup promise (`portRequest ??= tauri.getSoundServerPort()`). It bounds the in-flight window too, giving exactly one IPC per process, and its only cost is invisible — every overlapping caller awaits the same promise and still plays its sound, so no test and no user can tell. But it also deduplicates concurrent *successful* lookups, which today's value cache does not and which the finding asks nothing about. (b) An attempt latch set before the IPC: same bound, no success dedupe, but a `playSound` arriving while the first lookup is pending becomes a no-op, so a move played inside the first round trip is silent.
* **Reason:** (b) is ruled out by measurement — it trades an invisible cost for a user-visible one, a lost sound. Between the latch and the memo the case is closer: the memo's extra behaviour is genuinely unobservable, and this run argued for it across three plan revisions, first as "inseparable" from the required bound (refuted: the attempt latch separates them) and then as "harmless". Both review lenses, asked the question as a contested invariant with the three options named, chose the latch independently, and the argument that settles it is not about harm: an unmandated behaviour change is not the implementing session's to grant, however small, and the latch is exactly what the finding asks for and nothing more. The price is that the bound must be *stated* with an in-flight qualifier instead of as a flat "one" — which is honest, and is asserted by a test. Reversal path: if the in-flight window ever needs closing, the memo is the mechanism and it needs a mandate that asks for it.
* **Decided by:** Claude Code (Opus 5), 2026-09-20, plan review rounds 2-5 on Codex; record `tasks/handoffs/2026-09-20-f-20260906-10-review.md` · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"cb762d940358879b382c04ee6e8e983fa74668af94de680433cd064bd408a4b6","input_sha256":"c394fa2e4f159b375066f99dea288e4134d414036d79ba0f0b5f25413dbfff3a","kind":"mutation-receipt","operation":"78771592f3577dbd11df7851156e351841e60202ab324671b99901c0a3dd46f1","options":{"section":null},"request_id_sha256":null,"results":["d-20260920-08"],"target":"decisions-ledger","v":1} -->

### d-20260920-09 — How does `FideInfo.test.tsx` declare the `mantine-flagpack` mock state for a case?

* **Question:** How does `FideInfo.test.tsx` declare the `mantine-flagpack` mock state for a case?
* **Governs:** f-20260920-13
* **Chosen:** Exactly one mock action is queued per case, in `importFideInfo` — the case says
  `vi.doMock` or `vi.doUnmock` and nothing else queues an action for that specifier. The
  `vi.doUnmock("mantine-flagpack")` in `afterEach` is gone.
* **Rejected:** (a) Keeping the `afterEach` unmock as a safety net. Vitest 4.1.0 resolves queued
  mock actions concurrently and applies them in resolution order rather than queue order
  (`BareModuleMocker.resolveMocks` maps them through one `Promise.all`), so the hook's unmock and
  the case's mock land in an arbitrary order — measured, 1 of 50 iterations on this tree, and 11
  of 80 whole-file runs under 8-way concurrency. (b) Proving the registration took effect by
  eagerly `await import("mantine-flagpack")` inside `importFideInfo` before importing
  `./flagpack`: measured, it perturbs the module graph and makes the last case fail
  deterministically (3 of 3 runs, with and without the `afterEach` unmock). (c) Narrowing the
  DOM query again, which is what the three earlier attempts on this file did.
* **Reason:** The race needs two pending actions for one specifier; one action cannot be
  reordered against anything. The hook's unmock was redundant to begin with, because every case
  goes through `importFideInfo` and declares the registration it wants. Post-repair: 0 failures
  in 260 whole-file runs at 8- and 12-way concurrency, against 11 of 80 before; full frontend
  suite 1254 tests green. Reversal path: put `vi.doUnmock("mantine-flagpack")` back in
  `afterEach` — and the flake returns until Vitest applies queued actions in queue order.
* **Decided by:** Claude Code, next-finding f-20260920-13, 2026-09-20 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":23,"effect_sha256":"60c1cf198c678ab8b47ccfd93077c020d3415c443f1a457c53ac0abc90ad89d0","input_sha256":"e5f25ae15e37b371ca615f55f8906b7c7a4ddfba080ec7d3c647166a345d2d32","kind":"mutation-receipt","operation":"0041377be824ee16ffd8acbe65ae9430c4b175ff5aaa22462bfa177317cd3579","options":{"section":null},"request_id_sha256":null,"results":["d-20260920-09"],"target":"decisions-ledger","v":1} -->

## 2026-09-21 — recorded through the decisions lock

### d-20260921-01 — How are the coverage gains unmasked by the instrument repair made binding?

* **Question:** How are the coverage gains unmasked by the instrument repair made binding?
* **Governs:** f-20260920-06
* **Chosen:** refresh `coverage-baselines.json` from the `frontend-coverage` LCOV of successful fork CI run 35535051738 (artifact 10612620560, commit `d017475f`), all 30 metrics taken together, under the procedure in `docs/coverage.md`. No floor, no scope signature and no ratchet logic is touched: the diff is 46 covered/total pairs and nothing else, and the recorded `scope` is byte-identical.
* **Rejected:** keeping the 2026-09-11 baseline (it leaves the gains unprotected — 23 of 30 metrics measure above it, including 176 covered lines and 272 covered branches in `databases-files` alone, none of which any gate would defend); refreshing from local measurement alone (CI is the reference, `f-20260829-06`); refreshing before the instrument repair landed, which is the trap `docs/coverage.md` names — a baseline written from the blanked measurement makes the repair itself look like the regression, with the cheapest green being to keep the instrument broken.
* **Reason:** the instrument was repaired first, and the repair is what makes this refresh safe rather than the reverse. The CI measurement is the repaired one: 232 `SF` records, 3 files at `LF:0` (`src/bindings/index.ts`, `src/platform/native.ts`, `src/state/persistError.ts`, all genuinely statement-free), against 91 blanked files while `aee810b7`'s eager `?raw` glob was in the tree. It passes the pre-existing baseline and both floors with zero shrink allowances. Measurement inputs are unchanged between the CI commit and pickup HEAD `5129405a`: the intervening diff is `.claude/skills/push/SKILL.md`, `.gitattributes`, `scripts/check-gate-routing.mjs`, the two ledgers, and one `package.json` line rewriting `findings:kit:check` — no dependency, no test or coverage configuration. A fresh local `pnpm test:coverage` on this tree agrees with CI on **all 30 metrics exactly**, covered and total alike. No prior refresh sits between the defect and this one: `98fe9ffc` and `69ce3d9e` (both 2026-09-19, after `aee810b7`) changed zero covered/total values — the first touched `coverage-areas.json` only, the second only the recorded scope signature — so the last numeric baseline is `bf0d9b78` of 2026-09-11, written from a healthy instrument. This is the reasoned upward-only exception under `d-20260829-02`, not a rewrite to clear a red gate; the gate was green before it and is green after it. The deny entries in `.claude/settings.json` were honored: the write was refused to the agent and executed by Felix, and the proof was then taken against the restored *local* LCOV rather than the artifact the baseline was written from, since checking a baseline against its own source measurement proves nothing.
* **Reversal path:** revert this commit to restore the 2026-09-11 baseline. Investigate any future red ratchet against these numbers as a finding about the diff; never lower them. If the CI artifact is ever needed again it is `gh run download 35535051738 -n frontend-coverage`, valid until 2026-12-19.
* **Decided by:** Claude Code (Opus 5), 2026-09-21; the denied `coverage:baseline:frontend` write was run by Felix at his keyboard · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":9,"effect_sha256":"cd2ff82519da4b579e7efd09f1826956fd6faa30a3c81c95b671292dcdeffb75","input_sha256":"ee554d430f4e08974fbb2579ba9e1351346049617ff462711a490341ff8c96ea","kind":"mutation-receipt","operation":"debe25f8fdef7b8c05bf9b9bee3f72b97bb9927f31394095dc194794670c3787","options":{"section":null},"request_id_sha256":null,"results":["d-20260921-01"],"target":"decisions-ledger","v":1} -->

### d-20260921-02 — Which mechanism classifies a facade member reach in the consumer gate?

* **Question:** Which mechanism classifies a facade member reach in the consumer gate?
* **Governs:** f-20260906-12
* **Chosen:** the AST `MemberExpression`/`OptionalMemberExpression` visitor, which resolves the member object through the shared `resolveChain`, is the **only** mechanism that classifies a member reach. The reference walk over each accepted import binding answers the other B1 classes — destructuring, aliasing, namespace and re-export forms, and the C5 catch-all — and explicitly returns when a reference is a member object instead of resolving it a second time.
* **Rejected:** both mechanisms resolving the member independently, which is what the first implementation did — `review-minimalism` measured (confidence 95) that a member reach was resolved twice, counted twice as a consumer, and held apart only by a `seenMembers` set that hid the duplicate reporting rather than the duplicate work; and the opposite collapse, deleting the AST visitors and keeping only the reference walk, which is what I tried first — it fails the plan's test 22 scenario 1 (`const unrelated = 1; unrelated.getGames()` under a stubbed resolver must report no C1), because a file with no facade import is never visited by a reference walk at all, so nothing routes that member through the resolver seam.
* **Reason:** one question, one mechanism (universal rule 11), and the seam that proves it stays testable. With the visitor owning member reaches, stubbing `resolveChain` demonstrably changes the checker's verdict, which is what makes a second private walk detectable; with the reference walk owning them, the same stub is unobservable on that path. The suite is the evidence either way: 124 tests pass under the chosen split, one fails under the collapse, and the real tree measures identically before and after the change — 119 enumerated commands, the same three unconsumed (`getFileMetadata`, `getOpeningFromFen`, `getPuzzleDbInfo`), `pnpm ipc:consumers:check` green.
* **Reversal path:** re-add `classifyMember(parentPath)` to the member branch of `visitReference` in `scripts/check-ipc-command-consumers.mjs` and restore the `seenMembers` set; the duplicate work returns with it, and `review-minimalism`'s finding with that.
* **Decided by:** Claude Code (Opus 5), build run for f-20260906-12, 2026-09-21 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":9,"effect_sha256":"eb993df0824ad48b74deda31189aa71155a209d15590143db920ad69891bf996","input_sha256":"305bde9a4c1775c914446e9cbca9121abe3adb225e1e4152f953512aa91cd7d4","kind":"mutation-receipt","operation":"d36a3a2e400bfc34b12a98aeb31e68dfce697d3bfed9b36d3e8604d859fb49a0","options":{"section":null},"request_id_sha256":null,"results":["d-20260921-02"],"target":"decisions-ledger","v":1} -->

### d-20260921-03 — What becomes of the two redaction tests when `get_file_metadata_with_authority` is deleted

* **Question:** `f-20260906-11` deletes `get_file_metadata_with_authority`, the only call site of two tests in `src-tauri/src/fs.rs` that pin error redaction (no pathname, no `os error`, no OS message in the serialized `Error`). Are both retargeted onto a surviving function, are both deleted, or is the disposition per test?
* **Governs:** f-20260906-11
* **Chosen:** per test. `get_file_metadata_rejects_a_capability_without_engine_inspection_authority` is retargeted onto `file_exists_with_authority` and renamed `engine_binary_inspection_rejects_a_capability_without_inspection_authority`: the `InvalidInput` it asserts is raised inside `resolve_engine_binary_for_inspection`, which the deleted wrapper merely propagated, so the test keeps asserting the same code under a name that still exists. `get_file_metadata_redacts_a_deleted_engine_path_and_os_error` is deleted: the `Conflict` it pinned came from the wrapper's own `ok_or_else` over `Ok(None)`, and no surviving caller turns a missing file into an error — `file_exists_with_authority` returns `false`, which the test immediately above it already asserts.
* **Rejected:** retargeting the second test as well, by re-pointing it at whatever `Conflict` another function raises. The assertions would survive the compiler while measuring a different contract under a name describing the deleted one — the failure mode where a test stays green because it stopped testing what it claims. Also rejected: deleting both, which would have dropped the live redaction guard over `resolve_engine_binary_for_inspection`'s `InvalidInput` branch, the branch that actually faces a renderer-supplied `PathRef` through `file_exists`.
* **Reason:** a test belongs to the code that produces the behaviour it asserts, not to the function that happened to call it. Splitting on that criterion keeps every assertion that still has a producer and removes exactly the one whose producer is gone. Reversal path: if a future caller reintroduces "resolved capability is absent" as an error rather than a `false`, restore the deleted test against that caller — its body is in `5cd679d2`'s parent.
* **Decided by:** Claude Code, autonomously in a drain session under `full auto` · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"60c0e65be622d7c1409a6bfd317bb561adc5ec26575ea6d2a5518e498753dc36","input_sha256":"2cbfe0fdfef9199cbe7b6ec6101b203e7295f7da4edd95176182ea148af025f6","kind":"mutation-receipt","operation":"9cd3adc105068ea3eea1ef3cf0016cade1c114645842361e3f40c97c3ba98f18","options":{"section":null},"request_id_sha256":null,"results":["d-20260921-03"],"target":"decisions-ledger","v":1} -->

### d-20260921-04 — Where is a game-player engine selection proven to name a live engine?

* **Question:** Where is a game-player engine selection proven to name a live engine — in the picker, or at the submission boundary?
* **Governs:** f-20260906-15
* **Chosen:** both in the picker and at the submission boundary. `EnginesSelect` reconciles the selection against `enginesAtom` (absent id → first remaining local engine, or `null` when none remain, which reaches the existing `missing-local-engine` command error), and `toPlayerConfig` takes the live engine list as a required argument and throws `MissingLocalEngineError` when the selected id is not in it. An unhydrated list (`undefined`) is a refusal, not a pass.
* **Rejected:** picker-only reconciliation (holds only while the form is mounted; `enginesAtom` and the player-settings atoms hydrate from independent promises, and only the latter unwraps with a fallback, so a start between the two resolutions still forwarded a retired id — `review-engine-protocol` round 1). Un-retiring a removed id (reopens the publish race d-20260901-17 closed). Treating `undefined` as empty in the picker (drops a valid selection on every mount). A new error code plus 16 locale strings (`Board.Opponent.Error.MissingEngine`, "Select a local engine for the engine player", is the correct instruction in both cases).
* **Reason:** removal permanently tombstones the application id, so the renderer must not offer a configuration the supervisor will refuse; `.claude/rules/async-resource-invariants.md` makes native state authoritative and forbids unvalidated renderer state reaching a native call. Reversal path: give `toPlayerConfig` back its single-argument signature and delete the liveness check — the four tests named in the closing note go red first.
* **Decided by:** Claude, autonomously under `full auto`, drain session 82af36b3-c9cd-410d-9d70-c43db09b8b79 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"a0da6097aff25325a8bffff5dde6b4ceac89f83a570db29321352b933bfed7e9","input_sha256":"77ba70f1ecc135f93563abd578322fd332b484a42887a77005013c08b3a66425","kind":"mutation-receipt","operation":"787826a91a33438217038c79035122417a57ed8092781b441805ff8a6b19c35f","options":{"section":null},"request_id_sha256":null,"results":["d-20260921-04"],"target":"decisions-ledger","v":1} -->

### d-20260921-05 — Which record supplies an engine player's name, handle and default settings?

* **Question:** once the selected engine id is proven live, do the engine-owned fields sent to the backend come from the persisted selection or from the live engine record — and what happens to the player's per-game settings when that record changes?
* **Governs:** f-20260906-15
* **Chosen:** the live record. `toPlayerConfig` resolves the matched `LocalEngine` out of the engine list and reads `name`, `handle` and default `settings` from it; the persisted selection contributes only the id it was validated by and the player's own `engineSettings`, which still win over the engine's defaults. `OpponentForm` keeps those per-game settings when the picker re-reads a changed record for the same id, and replaces them only when a different engine is chosen or the selection is cleared.
* **Rejected:** forwarding the persisted snapshot's handle — an engine can be re-registered under the same application id with a new handle, so the snapshot launches the executable the user replaced (`review-persisted-state`, confidence 90). Resetting `engineSettings` on every `setEngine` — the picker's own refresh then silently discards a player's Threads/Hash overrides (confidence 94). Dropping the picker's refresh instead, which would leave a renamed engine displayed under its old name.
* **Reason:** the engine list is the authority for what an engine *is*, exactly as it is the authority for whether it still exists (d-20260921-04); the saved opponent settings are the authority for what this player asked for. Splitting the two that way is the only assignment under which neither a re-registration nor a settings edit loses information. Reversal path: read the fields from `settings.engine` again in `toPlayerConfig` and restore the unconditional `engineSettings` reset in `OpponentForm` — the tests added in `18e5021c` go red first.
* **Extends:** d-20260921-04, which settled *where* liveness is proven; this settles *which record* is then read. The wording of that entry's fourth rejected alternative is terse: a new error code plus 16 locale strings was rejected as unnecessary, because the existing `Board.Opponent.Error.MissingEngine` ("Select a local engine for the engine player") is already the correct instruction for both the empty and the stale selection.
* **Decided by:** Claude Code, autonomously under `full auto`, drain session 82af36b3-c9cd-410d-9d70-c43db09b8b79 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":9,"effect_sha256":"436eed81b601171b152fc0f3516387a7c48e8eb1b89e8999cbed490e8a60a9d1","input_sha256":"195ce18f6f68f4e6ad009e42fdb1ecde2fba0745258341418aaf3dc9dbb3db64","kind":"mutation-receipt","operation":"ea04669861cbcd9a3e7904d555bca61ecf0aba95a35058c456da5bb635984d50","options":{"section":null},"request_id_sha256":null,"results":["d-20260921-05"],"target":"decisions-ledger","v":1} -->

## 2026-09-22 — recorded through the decisions lock

### d-20260922-01 — What does the download button do when the saved destination is registered but currently unavailable?

* **Question:** when the saved download destination still has a native authority record but that folder is currently unavailable (drive unplugged, network share offline), does the download refuse with a message, fall back to the folder picker, or download to a default location?
* **Governs:** f-20260906-16
* **Chosen:** refuse the download with a translated "folder unavailable" message and **keep** the saved destination, so the same folder works again once it is reachable. This is what `tasks/plans/2026-09-22-download-destination-recovery.md` obligation C1 already specifies; the decision confirms it rather than changing it. Missing authority (no record at all) remains the picker case — that distinction is the finding.
* **Rejected:** opening the picker instead, which silently invites the user to re-pick while the real folder is only briefly offline and thereby loses the saved destination; and downloading to a default folder, which puts the file somewhere the user did not choose and may not find.
* **Reason:** this is a product question — it changes what the user sees and where their file lands — so it was Felix's to make, not the run's (universal rule 33). `review-plan` raised it in round 2 of this finding's plan review (confidence 97) precisely because the plan had made it autonomously. Reversal path: change C1 to fall through to `ensureDownloadDestination`'s picker branch on `"unavailable"`; the round-2 blocker returns with it.
* **Decided by:** Felix, in the chat, 2026-09-22, asked directly after the drain was stopped · **Superseded-by:** d-20260922-02
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"be541d4a1f3b1f7c6e1912e1258480bf080fadeeab806ea0569e8320e082d05c","input_sha256":"655a13fc5546cacfcba6bed93b5ef68c66574ea568e00cf2f9e9707705c63813","kind":"mutation-receipt","operation":"b24832cb741e4672ec965d79bca429ad9532cfcc630d9dd53ad2112b6f962fec","options":{"section":null},"request_id_sha256":null,"results":["d-20260922-01"],"target":"decisions-ledger","v":1} -->

### d-20260922-02 — Where does the error come from when the saved download destination is unreachable?

* **Question:** Felix decided that an unreachable saved download destination must produce an error and keep the folder rather than re-open the picker. Does that error come from a pre-flight availability check, or from the download attempt itself?
* **Governs:** f-20260906-16
* **Chosen:** from the download attempt itself. The native query answers one question — is this id a known download destination — and `true` means the persisted ref is returned unchanged. The download then runs and, if the folder is genuinely gone, fails with its own error, which `notifyUnlessCancelled` already surfaces; the saved destination is untouched and works again when the volume returns. No new user-facing message and no new i18next key. Felix's decision is satisfied in full: the user sees an error and the folder is kept; only the *source* of the message is the download, not a new pre-check.
* **Rejected:** the pre-flight refusal drafted in plan revision r2, which returned `Option<PathAvailability>` and refused on `Unavailable` with a new translated message. Round 2's `review-correctness` lens measured it wrong (confidence 96): `refresh_entry` marks an entry `Unavailable` when `classify_canonical_binding` returns `NeedsRebinding` (`mod.rs:7983-7992`), while `resolve_unix` follows an ancestor symlink, re-verifies the same root identity and completes the write (`resolved.rs:741-759`) — so a renamed-and-symlinked ancestor is `Unavailable` and downloadable at the same time, and the pre-check would have refused downloads that succeed.
* **Reason:** the mandate asks to distinguish *missing authority* from every other failure, and that distinction is exactly "no record" versus "a record". Unavailability is not a reliable second signal, so making the user-facing behaviour depend on it would refuse working downloads. Reversal path: if a consumer must one day explain *why* a known destination is unusable, the command's return becomes `Option<PathAvailability>` and the pre-flight message returns with it — that consumer is the evidence this decision lacks today.
* **Supersedes:** d-20260922-01, which recorded Felix's decision correctly but described the mechanism wrongly — it asserted that plan obligation C1 already specified a pre-flight refusal with a translated message. That was true of revision r2 and had already been withdrawn in r3 when the record was written. The decision itself is unchanged and was not re-asked.
* **Decided by:** Claude Code, interactively, after Felix's chat decision of 2026-09-22 · **Superseded-by:** d-20260922-03
<!-- ledger-meta {"command":"record-decision","effect_lines":9,"effect_sha256":"89b8d25bad2aea8fefd6b20570d534f247d812555a544f3e5a28d3677689f1c2","input_sha256":"b00188e38ff9dcd0bf3b80b0de1c7bd33b98e5b7aaad10e49a1fd718cfc8ada3","kind":"mutation-receipt","operation":"89bd6adf45aa1382b2c98f07e1d4836c10cac5940b5e05740be9a83126049f5a","options":{"section":null},"request_id_sha256":null,"results":["d-20260922-02"],"target":"decisions-ledger","v":1} -->

### d-20260922-03 — Which records does `download_destination_is_known` answer `false` for?

* **Question:** the recovery contract distinguishes "missing authority" from every other download failure — which registry states does the predicate actually refuse, and is "no record versus a record" an accurate statement of it?
* **Governs:** f-20260906-16
* **Chosen:** **three** states answer `false`, and the shipped predicate tests all three (`src-tauri/src/infra/path_authority/mod.rs`, `download_destination_is_known`): no entry for the id at all; an entry whose removal is already decided but not yet persisted (`pending_unpersisted_removals`, the same refusal `resolve` applies); and an entry whose `stored.purpose` is anything other than `EntryPurpose::DownloadDestination`. Everything else answers `true`, availability explicitly included: an entry marked `Unavailable` is a record, answers `true`, and is preserved.
* **Rejected:** the shorthand "no record versus a record", as written in d-20260922-02's `Reason` clause. It is not wrong about the outcome but it is wrong about the predicate, and a later session implementing from that sentence alone would accept a database root, a puzzle root or a pending-removal id — the database and puzzle roots carry `DownloadFile` in their operation sets, so the wrong predicate reports a foreign capability usable and sends an account's PGN into it.
* **Reason:** `review-code-quality` caught the mismatch over the cumulative diff at confidence 95, and the same imprecision had already produced a blocker in plan-review round 3 (R3-04). A decision entry is read by later sessions instead of the code, so a clause that misdescribes the mechanism is a trap rather than a nicety. Reversal path: none needed — this narrows a description to what the committed code does; if the predicate itself changes, the entry that changes it supersedes this one.
* **Supersedes:** d-20260922-02, as to its `Reason` clause only. That entry's `Chosen` — the error comes from the download attempt rather than a pre-flight availability check — stands unchanged, as does Felix's own decision in d-20260922-01.
* **Decided by:** Claude Code, interactively, during the `$push` review of f-20260906-16 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":9,"effect_sha256":"af8427ed53103ebd209fda0a11f1111ece4979cd5c90982e40ab9afb9e9fa5d3","input_sha256":"a03227863cf375abc8a84a6c42f4110f7e330825c7dcb944dfbb16a2070e7ab1","kind":"mutation-receipt","operation":"06db33dc46b3972f36b2c777f6aebed9b94e14466975c1c940243ddb4388625d","options":{"section":null},"request_id_sha256":null,"results":["d-20260922-03"],"target":"decisions-ledger","v":1} -->

### d-20260922-04 — Should the three genuinely statement-free frontend files be declared, or simply excluded?

* **Question:** `f-20260920-19` needs the measured files that legitimately contribute no coverage records to be named somewhere. Should they be declared in a new `statementFree` list beside `exclude`, or added to `exclude`, which already exists and already solves the same problem for the backend?
* **Governs:** f-20260920-19
* **Chosen:** a new per-source `statementFree` list of exact literal paths with reasons, reaching `scopeSignature`, and carrying three failure conditions — an undeclared blank file, a declared path outside the measured production set, and a declared path that is in the set and is no longer blank. `src/bindings/index.ts`, `src/platform/native.ts` and `src/state/persistError.ts` are declared under it.
* **Rejected:** three more `exclude` entries. The backend config already answers the same question that way — `src-tauri/src/engine/mod.rs`, `src-tauri/src/infra/mod.rs` and `src-tauri/src/db/schema.rs` are excluded with the reason "Module declarations only; no executable statements exist to instrument." It needs no new field, no `scopeSignature` change, and — measured 2026-09-21 — would leave every area number identical. It is genuinely cheaper.
* **Reason:** it answers "the measured set silently shrank" by shrinking the measured set. An excluded file is gone for good: if `src/platform/native.ts` later gains a real statement, the exclusion keeps it out of the denominator forever and nothing says so. The third condition turns that event into a red gate instead, in every case but the one named below. The cost is accepted and named: a second mechanism next to `exclude` for a neighbouring concept, and every future statement-free module inside the measured production set reddens `coverage:frontend:check` until it is declared and the baseline's `scope` re-recorded by hand. That friction is the design working — the declaration is the only thing between this gate and a silent narrowing, so it is deliberately not cheap to grow. Reversal path: move the three paths into `exclude`, drop the list from `scopeSignature`, and re-record the `scope` subtree; the measured numbers do not move either way, which is precisely why the numeric gates cannot referee this choice.
* **Decided by:** Claude Code, interactively, implementing the nineteen-round reviewed plan for f-20260920-19 on 2026-09-22 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"de470039868bd7e8d0d1094d47e6eb01016e0b9b0900594bec72592abf04ed93","input_sha256":"7a476645267d1cb26fe9f37f5354b3716123a4474b34db3c5a1fe6e9b6acac09","kind":"mutation-receipt","operation":"fd604991b8b589668ba2c2ede8af719c4449269f87f1429c31f504eee97b9fb8","options":{"section":null},"request_id_sha256":null,"results":["d-20260922-04"],"target":"decisions-ledger","v":1} -->

### d-20260922-05 — Is a blank-measurement guard with a named residual hole acceptable, or must the hole be closed first?

* **Question:** the third condition of `d-20260922-04`'s declaration list cannot tell a declared file that gained statements from one that is genuinely statement-free, if that same file is also raw-imported: its record stays all-zero either way. Does the guard ship with that hole stated and pinned, or must it be closed before the guard is worth having?
* **Governs:** f-20260920-19
* **Chosen:** ship it, with the claim narrowed to what is true and the limit written where a later reader finds it. Condition 3 catches a declared file that gains statements **unless that same file is also raw-imported**. The residual blind spot is therefore exactly the declared set — three named files — instead of the whole measured set of 232. The limit is recorded in `docs/coverage.md`, pinned by the test that accepts a declared blank, and carried in the comment beside it.
* **Rejected:** two mechanisms that would close it exactly. A parser-backed statement-free check, which decides the question from the source rather than from the LCOV — it is out of scope for this mandate and is the same open design question already filed as `f-20260920-20`. And pinning a content hash of each declared file in the config, which closes the hole without a parser but reddens the gate on every ordinary edit to `src/platform/native.ts`.
* **Reason:** nothing in an LCOV can distinguish "genuinely statement-free" from "blanked" for a file that is permitted to be blank — only something outside the LCOV could. An allowlist whose entries may not be blank is not an allowlist, so the residual is a property of the mechanism the finding itself prescribes, not an omission in the implementation. `review-tests` dissented at confidence 99 in round 2 of the plan review, holding that the stated residual does not satisfy the "every production file" mandate; six lenses closed it, the arbiter recorded the `Skip` with this reasoning, and `review-tests` returned APPROVED over the next revision without re-raising it. The raw `REVISE` was preserved rather than converted. This repository already uses that discipline elsewhere — `scripts/check-tauri-command-boundary.test.mjs` states its residual row rather than implying completeness. Reversal path: `f-20260920-20`'s parser, if it lands, makes the hash alternative and this whole trade-off moot.
* **Decided by:** Claude Code, interactively, implementing the nineteen-round reviewed plan for f-20260920-19 on 2026-09-22; the arbitration itself was recorded in round 2 of that review · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"8b321a2c3a69b5bfc8164a736426a94644042bbd7785579d220eac07f86956c5","input_sha256":"4d5076f7eabb70e0e7f8b44c2eb6b8ed6778224da03d13a5e754313b5b09f87e","kind":"mutation-receipt","operation":"25bbe2737b89783979949a79936f3a666f40dd361b4a082f0a89bd1284bd6f6e","options":{"section":null},"request_id_sha256":null,"results":["d-20260922-05"],"target":"decisions-ledger","v":1} -->

### d-20260922-06 — Under whose authority were f-20260921-01 and f-20260921-02 worked in the f-20260920-19 run?

* **Question:** both findings are pre-existing defects in `scripts/coverage-report.mjs`, the file the blank-measurement mandate changes, and no obligation of that mandate fails without either. Rule 12a's adoption gate forbids scope a mandate does not require; rule 4b requires same-area work now. Were they in the run or not, and on what authority?
* **Governs:** f-20260921-01, f-20260921-02
* **Chosen:** in the run, under **rule 4b**, and explicitly **not** as mandate obligations. Phases 2a, 2b and 3 are their own commits, close their own findings, and no `O1`–`O6` obligation and no mandate acceptance criterion of `f-20260920-19` depends on them. The two rule sets are kept apart in the plan and in this ledger: mandate acceptance is one list, rule-4b completion another.
* **Rejected:** splitting them out to a later run, which is what plan revision r10 actually did. The split was rejected 6 lenses to 1 in the following round, and the objection was correct: the adoption gate governs what the **mandate** obliges, not **when** a finding is worked. Rule 4b decides that, and it excludes "pre-existing", "not part of the diff", effort and size as grounds.
* **Reason:** what was wrong two revisions earlier was the framing, not the adoption — the work had been justified *through* the mandate, which is what the gate correctly failed; naming rule 4b as the authority was the repair, not removal. Both rules then bind and are compatible, in `review-minimalism`'s formulation: rule 4b requires same-area work now, while rule 12a only forbids pretending that work is mandated by `f-20260920-19`. The filing was not wasted either way — the two findings stayed on disk, carried the enumeration and the measured corrections that later rounds produced, and are closed by these phases. Reversal path: none is needed; if a future run faces the same pair of rules, the full reasoning, including both reversals of the arbiter's own decision, is in `tasks/handoffs/2026-09-21-coverage-blank-file-guard-review.md`.
* **Decided by:** Claude Code, interactively, implementing the nineteen-round reviewed plan for f-20260920-19 on 2026-09-22 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"00ea47c03fd9ad95db10b6f4dff0e7c77f12a35741522cb92e03006559e102ab","input_sha256":"78d82f27f897413d392321264167499a1a909aaa01d572fd3932f61d5168ae2e","kind":"mutation-receipt","operation":"9fce326216cfe0d4fde517e880a48b268630328644fb097fd8389eecdf50b4be","options":{"section":null},"request_id_sha256":null,"results":["d-20260922-06"],"target":"decisions-ledger","v":1} -->

### d-20260922-07 — Does the blank-measurement guard actually catch f-20260920-18, and how wide is that defect class?

* **Question:** the guard was designed against an LCOV signature that had already been observed, but the negative control — reintroduce the defect, watch the gate fail, remove it, watch the gate recover — had never been run, because the planning worktree had no `node_modules` and no LCOV. Does the guard fire on the real instrument, and is `docs/coverage.md` right that any file inside the include set can be blanked this way?
* **Governs:** f-20260920-19
* **Chosen:** both were measured on 2026-09-22, in the main checkout on `master`, and the results are recorded here because `tasks/plans/` is gitignored and nothing else would survive the run. **Three runs, the exact exit statuses and stderr:** (1) **green before** — `pnpm test:coverage` exit 0, `pnpm coverage:frontend:check` exit **0**, stdout `Coverage ratchet and area floors passed`, no allowance line, stderr empty. (2) **failing after** — a throwaway `src/negative-control.test.ts` eagerly `?raw`-importing `src/components/boards/EditingCard.tsx`, whose record went from `LF:19 FNF:0 BRF:0` to `LF:0 LH:0 FNF:0 FNH:0 BRF:0 BRH:0`; `pnpm test:coverage` still exit 0, `pnpm coverage:frontend:check` exit **1**, stderr exactly `Coverage measurement is blank for production files: src/components/boards/EditingCard.tsx. A file present in the LCOV with no line, function or branch records has left the denominator without changing any percentage. If the file genuinely has no statements, declare it under statementFree in coverage-areas.json; otherwise something removed it from the measurement (see docs/coverage.md).` Raw-importing a second never-imported file beside it, `src/components/boards/AnnotationHint.tsx`, produced **one** message naming both, sorted: `... production files: src/components/boards/AnnotationHint.tsx, src/components/boards/EditingCard.tsx.`, exit **1**. (3) **green restored** — throwaway deleted, `pnpm test:coverage` exit 0, `pnpm coverage:frontend:check` exit **0**, `Coverage ratchet and area floors passed`. **And the class is narrower than the documentation claimed:** raw-importing `src/utils/format.ts`, which other tests import as a module, left it at `LF:56 LH:19 FNF:18 FNH:6 BRF:35 BRH:7` — its ordinary measurement — and the gate stayed green, exit 0. Only a file that no test imports as a module can be blanked, because only such a file is absent from the v8 map and so depends on the counts Vitest generates for it. `docs/coverage.md` was corrected in the same commit.
* **Rejected:** running the control against a *declared* file, or against a file with covered records. A declared file passes by design and proves nothing; `src/utils/format.ts` was the plan's own target for eight revisions until `review-tests` objected at confidence 95 that its covered records might mean a raw import could not blank it. That objection was right, and the measurement above is what settles it — the control would have stayed green while proving nothing.
* **Reason:** the plan's central claim was that this gate detects the reintroduction of `f-20260920-18`, and every other proof in the run is a fixture. A fixture shows the checker rejects a hand-written all-zero record; only this shows the real instrument still produces that record and the real gate still rejects it. The second measurement was kept over a `review-minimalism` objection at confidence 93 that it was unnecessary scope, because `docs/coverage.md` describes the class and would have documented something untrue. Reversal path: none — these are measurements, and a later instrument change invalidates them rather than reverses them. Re-running is one throwaway test and two commands, both named above.
* **Decided by:** Claude Code, interactively, implementing the nineteen-round reviewed plan for f-20260920-19 on 2026-09-22 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"6601e22245933b691f8dea4388c4bb0054051a7d9afea3f140e920c7d3c58108","input_sha256":"9d5658e53b19ba01dfcab6e4dcc02331ea976a8b7f6ac5d93fe7132780cc2938","kind":"mutation-receipt","operation":"ebd418e9bf470a45ce811a6048346e2d364c98fe6ed1d79509724c386241fc3f","options":{"section":null},"request_id_sha256":null,"results":["d-20260922-07"],"target":"decisions-ledger","v":1} -->

### d-20260922-08 — Is `scopeSignature` still the only guard against narrowing the measured set?

* **Question:** `d-20260830-08` records, as a consequence that constrains later work, that `scopeSignature` is the only guard against narrowing the measured set, because a narrowing looks exactly like a deletion to the numeric ratchets. `f-20260920-19` adds a second guard. Does that reverse the earlier decision, or narrow it?
* **Governs:** f-20260920-19
* **Chosen:** it narrows it, and the supersession is **partial and says which clause**. Only `d-20260830-08`'s "Consequence that constrains later work" is superseded, and only in its "only guard" claim: there are now two guards, `scopeSignature` and the blank-measurement check, and the route that clause said neither could see — a narrowing arriving through the test suite — is exactly what the new one catches. Everything else in that decision stands and still governs: the shrink allowance bounded by the observed total shrink, its announcement on every use that changes a verdict, and the absence of a third ratchet on `total`. The obligation that any future change to *what gets measured* be expressed through the config so it reaches the signature is unchanged and is reinforced, since the declaration list reaches it too.
* **Rejected:** leaving `d-20260830-08` with `Superseded-by: -`. A later session reading it would find a stated, dated consequence that is now false in its central claim, with nothing pointing at what replaced it — and it is the kind of sentence that gets quoted rather than rechecked. The same sentence had propagated into `docs/coverage.md` and into the repository's `CLAUDE.md`, and both were corrected in the same commit for the same reason.
* **Reason:** under the ledger's clause 2 this is a supersession on new evidence with the prior decision named, not a reversal of its subject. The prior decision was right about the mechanism it was recording — the numeric ratchets genuinely cannot see a narrowing — and wrong only in asserting that nothing else could be built. Reversal path: if the blank-measurement check is ever removed, `d-20260830-08`'s consequence becomes true again in full, and the entry that removes it should say so.
* **Decided by:** Claude Code, interactively, implementing the nineteen-round reviewed plan for f-20260920-19 on 2026-09-22 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"742725cd0deb9060be86e0ff00cae14d95a7b2c4ba11bde9fb7d3d23efe007ed","input_sha256":"df6f3d967995e8a91031502ef4339b328a6c64124e6d18f920cd1bf8dff930ea","kind":"mutation-receipt","operation":"87a95b521ff81b278756303a5284a0def90fcf6d9eacdcb6641aa6be2a1b2b45","options":{"section":null},"request_id_sha256":null,"results":["d-20260922-08"],"target":"decisions-ledger","v":1} -->

## 2026-09-23 — recorded through the decisions lock

### d-20260923-01 — How is the renderer runaway that stopped f-20260906-23's verify:app scenario removed?

* **Question:** The new `pnpm verify:app` practice scenario was OOM-killed twice at the session's 8 GiB cap while the real app opened its 12,000-position repertoire. Is that a memory budget, a fixture or a renderer defect, and what removes it at the root?
* **Governs:** f-20260906-23
* **Chosen:** a renderer defect, fixed where it originates, as a fifth phase of the f-20260906-23 build (Felix, 2026-09-23: fix the root cause of the runaway, do not cap it). Measured under a 3 GiB systemd scope with the release binary and a throwaway driver: opening a shallow repertoire tree (depth 11-13) as an analysis tab cost +690 MiB at 2,305 nodes (+1,020 MiB with the practice panel) and was killed at 3 GiB at 8,046 nodes; the Files preview of a single deep line grew quadratically (399 / 563 / 2,194 MiB at 2,000 / 6,000 / 12,000 plies). A jsdom heap probe attributed it to `GameNotation`: ~150 KB retained per tree node, because every move of the whole tree is mounted (no virtualization), `RenderVariationTree` recurses once per ply with a path copy per level, every `CompleteMoveCell` mounts its own Mantine menu and about seven store subscriptions, and the tree store rebuilds a per-node-path `boardStateMap` on every root-changing set for a single consumer. Phase 5 replaces this with an O(n) iterative row model, @tanstack/react-virtual rendering, identity-based current/start flags, lazily mounted context menus, lazily reconstructed paths, an on-demand memoized `boardStateMap`, and a single-pass `getTreeStats`.
* **Rejected:** raising the memory cap or lengthening the scenario's timeout (hides the defect; a real 12,000-position repertoire would still exhaust the renderer); shrinking the fixture (removes the large-deck proof the finding requires); collapsing or hiding variations by default (a user-visible product change nobody asked for); refusing to preview deep games (the preview is only one of the paths, and the analysis tab blew up on a shallow tree).
* **Reason:** the cost has to scale with what is on screen, not with the tree, or no repertoire of the size the finding must prove can be opened at all. The fixture's 25,000-ply single line was additionally never openable as a tab — `tabStorage` refuses trees deeper than `MAX_TREE_DEPTH = 512` — so the scenario's large repertoire is regenerated as a branching tree of the same 12,000 positions within that depth: same size, a shape the product accepts. Reversal path: none needed for the performance work; the row constant `NOTATION_ROW_MAX_MOVES` can be tuned without changing the design.
* **Decided by:** Claude Code (orchestrator), f-20260906-23 build, on Felix's chat instruction of 2026-09-23 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"6c7e527557feb749db6499ed061dca8e2cfbad86b027b7774486907e9d855814","input_sha256":"411a4feccb9060748f670040957f1d3c67850b8cd3f4801e167daab95a553701","kind":"mutation-receipt","operation":"70d561a69dfb5321edfa0682dba929377365493bf7477bf1732e81611174162e","options":{"section":null},"request_id_sha256":null,"results":["d-20260923-01"],"target":"decisions-ledger","v":1} -->

### d-20260923-02 — What does practice repair do with a migration-state leaf it cannot trust?

* **Question:** `repair_practice_deck` removes a damaged native deck. When the deck's migration-state leaf is malformed, identity-invalid, or still says `migrating`, should repair keep a `reset` marker (so the retained browser copy is never imported again) or remove the marker (so that copy migrates again)?
* **Governs:** f-20260906-23
* **Chosen:** remove the marker. A valid `migrated` or `reset` marker becomes `reset` as the plan's B.9 says, so history the user reset is not resurrected. A `migrating` marker means the migration never finalized, and a malformed or identity-invalid marker proves nothing; in both cases the deck returns to never-here and the retained legacy value migrates again on the next pass.
* **Rejected:** keeping a `reset` marker for an untrustworthy leaf. When the marker really said `migrating`, that permanently shadows legacy history that was never imported, and nothing the user did asked for it to go.
* **Reason:** the two failure outcomes are asymmetric. Removing the marker can, only after a state leaf was corrupted *after* a user Reset, re-import pre-Reset history the user can reset again. Keeping it can destroy history that exists nowhere else in native form. Review round 4 (correctness lens) raised the resurrection case; it is accepted as the lesser loss. Reversal path: treat `invalid_state` like a valid `reset` in `repair_practice_deck_in` (`src-tauri/src/practice.rs`, the comment there cites this record).
* **Decided by:** Claude Code (orchestrator), f-20260906-23 build, cumulative review rounds 1 and 4 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"917e8dc7da17f3b5db7d57692e5828213763930a2467063cd0208a494a16389f","input_sha256":"899f547b1ec4cf71e9769fa1a27badc95d629fd9aec378bb9a5a5a50a0de2c46","kind":"mutation-receipt","operation":"2c1e8d1f295157989bbf705757ecbdf0bcacb35f8a2b5d6549f72e99025deaee","options":{"section":null},"request_id_sha256":null,"results":["d-20260923-02"],"target":"decisions-ledger","v":1} -->

### d-20260923-03 — Does durable practice storage's bundle growth raise the total budget, or must it be cut?

* **Question:** The f-20260906-23 push exceeded `bundle-budgets.json`'s total ceiling: 1,563,393 B gzip against 1,550,000 B. Is that a regression to remove or feature growth to record?
* **Governs:** f-20260906-23
* **Chosen:** record it as feature growth. The total ceiling rises to 1,567,000 B, keeping the prior ~0.25 % headroom above the new measurement (519,061 / 511,414 / 1,563,393 B, entry / largest lazy / total, 2026-09-23). Entry and largest-lazy ceilings are unchanged. Measured against the push base e5bc10ca (1,546,371 B), the diff adds 17,022 B. About 9.5 KB is the 25 new user-facing strings in each of the 16 locale catalogues: loading, read failure, retry, repair, migration and inventory messages. The rest is the renderer's practice-storage client and the virtualized notation that replaced O(tree) rendering (d-20260923-01). No new key is unused (the two apparent orphans are `_one`/`_other` plural forms) and no chunk is dead.
* **Rejected:** dropping locale strings or leaving the new states untranslated (a visible regression for 15 languages); reverting the virtualization (it removed the OOM that blocked this finding); treating the growth as a regression to hide by moving code into a lazy chunk (the total budget counts every emitted asset exactly once, so relocation changes nothing it measures).
* **Reason:** the total ceiling exists to make growth a conscious decision (docs/bundle-budgets.md: raising a limit needs an updated measurement and rationale). This growth is the feature itself, measured per asset. Reversal path: restore `"total": 1550000` in `bundle-budgets.json` once the catalogues or the client shrink below it.
* **Decided by:** Claude Code (orchestrator), f-20260906-23 build, final gates · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"2ac8198a62f535e03707ce39939b05f9cae8efab7692181745172f84e6fcaa12","input_sha256":"21161701f4f682c14d29af499f48ae82dbf499af4aa2d5b8afcaf5f73e78a75c","kind":"mutation-receipt","operation":"1a85e360e6111916bc3548c5e10fa7da525c833b8f464042267c2abe8a1e2b1b","options":{"section":null},"request_id_sha256":null,"results":["d-20260923-03"],"target":"decisions-ledger","v":1} -->

### d-20260923-04 — Where does a practicePath go when deleteMove removes its node?

* **Question:** `deleteMove` can delete the node the practice path addresses. Should `practicePath` clamp to the deleted node's parent or become `null`?
* **Governs:** f-20260922-04
* **Chosen:** clamp to the deleted node's parent, as the cursor already does. Surviving paths are rebased through one step shared by `position`, `headers.start` and `practicePath` (`rebaseTrackedPaths` in `src/state/store/tree.ts`), with a per-path fallback.
* **Rejected:** `null`, matching `headers.start`'s `undefined`.
* **Reason:** `practicePath` is the only thing stopping `goToNext` from revealing the answer while the practice UI is still on screen. `null` would widen the guard to unrestricted navigation and let `goToNext` follow the surviving sibling as the deleted card's continuation, which is f-20260914-26's reported sequence. A clamp leaves cursor and path at the same depth, so the guard refuses to advance. Plan D1, reviewed over ten rounds; record `tasks/handoffs/2026-09-22-practice-path-rebasing-review.md`.
* **Decided by:** Claude Code (orchestrator), tree-path-rebasing build, plan review 2026-09-22 · **Superseded-by:** -

### d-20260923-05 — With an active practice path, what may goToNext do?

* **Question:** With `practicePath` set, should `goToNext` still take the transposition fallback, and may it advance from a cursor that left the drill line?
* **Governs:** f-20260922-04
* **Chosen:** it advances only when `position` is a proper prefix of `practicePath`, and only by `practicePath[position.length]`. It never takes the transposition fallback. Otherwise it does nothing. With no practice path, behaviour is unchanged.
* **Rejected:** redirecting the transposition jump onto the path; a length-only guard.
* **Reason:** the jump's target is on another branch, so no index of a root-anchored path survives it, and a redirect cannot be expressed. A length-only guard applies the path's next index to whatever branch the cursor is on. Accepted consequence: after clicking a move off the drill line, the forward arrow does nothing until the cursor is back on the path. Plan D2.
* **Decided by:** Claude Code (orchestrator), tree-path-rebasing build, plan review 2026-09-22 · **Superseded-by:** -

### d-20260923-06 — What does installing a new root from a FEN leave behind?

* **Question:** `setFen` and `setHeaders`' rebuild branch replace the tree. Which header and path values must they write, and from where?
* **Governs:** f-20260922-04
* **Chosen:** one shared installer (`installRoot`) writes `headers.fen` from the installed `root.fen`, drops `headers.start`, sets `practicePath` to `null` and `position` to `[]`, on a fresh headers object. `setState` and `reset` set only `practicePath = null`, since they install a whole state object.
* **Rejected:** copying the raw FEN argument into `headers.fen`; clearing only the paths.
* **Reason:** `setHeaders` rebuilds whenever `headers.fen !== root.fen`, so that equality is load-bearing. Deriving one side from the other makes it structural instead of dependent on every caller pre-normalizing (`defaultTree` trims). Plan D3.
* **Decided by:** Claude Code (orchestrator), tree-path-rebasing build, plan review 2026-09-22 · **Superseded-by:** -

### d-20260923-07 — How does a mainline prepend keep tracked paths on their nodes?

* **Question:** `makeMove` with `mainline` unshifts the new child and renumbers every sibling. Is the shift expressed through the existing promotion rebase, and does its helper take the inserted index?
* **Governs:** f-20260922-08
* **Chosen:** its own rule, `rebasePathAfterPrepend(target, parent)`, run through the shared `rebaseTrackedPaths` step in the inserting branch, after the `unshift` and before the `changePosition` block. It has no index parameter. An unchanged path keeps its array identity.
* **Rejected:** "push, then promote the last index" through `rebasePathAfterPromotion` (the same arithmetic under the wrong operation's name); an inserted-index parameter.
* **Reason:** the only insertion that shifts siblings inserts at 0, since `push` shifts nothing, so an index parameter would be a speculative extension point. The `changePosition` block picks `push(0)` by comparing `state.position === position`, so replacing an unchanged cursor would select the last child instead of the new first one. Plan D8, D9 and M16; record `tasks/handoffs/2026-09-22-tree-path-insert-rehydrate-review.md`.
* **Decided by:** Claude Code (orchestrator), tree-path-rebasing build, plan review 2026-09-22 · **Superseded-by:** -

### d-20260923-08 — Where and how is a persisted path that no longer resolves repaired?

* **Question:** A stored `position`, `headers.start` or `practicePath` can fail to resolve in the root stored with it. Where is it checked, what repair does each path get, and is the stored value corrected or kept with a derived effective value?
* **Governs:** f-20260922-10
* **Chosen:** in `parseTree` (`src/state/store/tabStorage.ts`), after the Zod parse. `position` and `practicePath` clamp to their longest resolving prefix, `headers.start` is dropped, and `null` or absent stays as it is. The stored value is corrected, and `read` writes the repair back once. The walk is `getResolvedPathLength` in `treeReducer.ts`, which `parseStartHeader` also uses.
* **Rejected:** checking in `onRehydrateStorage` (repairs memory only, so storage stays stale); one uniform rule (clamping a start silently moves the repertoire start, and clearing a practice path widens the drill guard); rejecting the tab (loses a valid game over a stale index); keeping the stale value and deriving an effective one.
* **Reason:** `parseTree` is the one validator shared by `read`, `seed` and both clones. The path and its tree live in the same record, so no external context can make a stale path valid again. A kept stale start starts resolving again once the tree grows, and then addresses an unrelated move. Plan D6, D7 and D11. The finding was deliberately not closed as latent once f-20260922-08 shipped (D10): the boundary check also covers unknown future mutations and legacy envelopes.
* **Decided by:** Claude Code (orchestrator), tree-path-rebasing build, plan review 2026-09-22 · **Superseded-by:** -

### d-20260923-09 — Does the tree store's setState validate the paths it is given?

* **Question:** Cumulative review (chess-semantics lens) proposed that `setState` resolve incoming `position` and `headers.start` against the supplied root. Validate there, or at the producer?
* **Governs:** f-20260922-10
* **Chosen:** at the producer. `parsePGN` now stores only the validated `Start` path in `headers.start` (it used to keep the raw tag after rejecting it) and sets `position` from it. `setState` keeps the fields it is given, as plan O3 says.
* **Rejected:** a second validation in `setState`.
* **Reason:** both production callers, `PgnInput.tsx` and `InfoPanel.tsx`, build their tree with `parsePGN`, the boundary where untrusted PGN text enters. `setState` takes a typed `TreeState` from those callers only. Reversal path: if a caller that bypasses `parsePGN` appears, run `getResolvedPathLength` in `setState`.
* **Decided by:** Claude Code (orchestrator), tree-path-rebasing build, cumulative review 2026-09-23 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":53,"effect_sha256":"d9d5ca9c139b067425cd5ac52e0e9a54803b519b5305ecaa8cd11849a8816624","input_sha256":"bd87952c6eac2694251be5825885bafbb859de3e687d7511217931aaac6787d9","kind":"mutation-receipt","operation":"898643922d6b19d23e7746016be0cdf50d00f01044eb2e301e8eabc6b06adf18","options":{"section":null},"request_id_sha256":null,"results":["d-20260923-04","d-20260923-05","d-20260923-06","d-20260923-07","d-20260923-08","d-20260923-09"],"target":"decisions-ledger","v":1} -->

## 2026-09-24 — recorded through the decisions lock

### d-20260924-01 — When a file-backed tab's game changed on disk, what is authoritative?

* **Question:** f-20260923-01 asked whether a tab whose PGN changed on disk reloads from disk (discarding unsaved edits), keeps its tree and warns, or detects the change and offers both — and whether the same applies when the Files page reopens the file.
* **Governs:** f-20260923-01
* **Chosen:** detect and decide by the tab's state. A clean tab whose game stamp differs from disk reloads silently; a dirty tab (or any tab whose tree cannot prove it came from disk) is withheld behind a conflict panel offering "Reload from disk" or "Save my version as a new game…"; a missing game or replaced file shows an unavailable panel. Every write is a compare-and-swap, so a stale tree is never written over a newer game. The Files page always reads fresh (the FileCard preview is no longer reused).
* **Rejected:** always reload (silently discards unsaved edits); keep and warn (shows stale text for a clean tab for no reason); "keep my version and stay file-backed" and "overwrite with my version" (both put text based on an older disk version over a newer one — plan review rounds 3-5); a detached origin-less copy (closes without the unsaved-changes prompt, round 6).
* **Reason:** the only policy that neither shows a stale game nor loses an edit. Reversal path: the reconcile outcome switch in `src/components/tabs/FileFreshnessGate.tsx` and the panel actions beside it.
* **Decided by:** Claude Code (orchestrator), f-20260923-01 build (drain, full auto), plan review r1-r14 in `tasks/handoffs/2026-09-24-stale-file-tab-review.md` · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"9a86c70148faf5a0640dea0011308967399f7a325ba9a5604f3ba87a9b43e511","input_sha256":"8858253251118712bb678030dab8f276824545c0f7f0b4219beabaabe3baa6c3","kind":"mutation-receipt","operation":"e9ad7f5d00f25ddcace333e2ec8f0433f21f42c8fc6a488d273ac04df6dc504a","options":{"section":null},"request_id_sha256":null,"results":["d-20260924-01"],"target":"decisions-ledger","v":1} -->

### d-20260924-02 — How does a tab know its game is stale, and how quickly?

* **Question:** f-20260923-01 needs a staleness signal for a file-backed tab and a bound on how long a stale game can stay on screen after another program edits the file.
* **Governs:** f-20260923-01
* **Chosen:** a native per-game stamp — SHA-256 of the exact bytes of the game's scanned range, returned by `read_game` and checked by `write_game` under the file's edit lock — persisted inside the tab's tree state (one write with the tree), plus one app-level poll of `file_revision` (a stat, no scan) for every open file every 2 s and on window focus, with at most one native call outstanding per file. The MANDATE's "never show stale" is implemented as "withheld or reloaded within one poll interval plus one read" (focused architecture judgment, plan round 2: BOUNDED-POLL-OK).
* **Rejected:** a renderer-side hash with read-before-write (a race between the read and the write); whole-file size/mtime as the stamp (false conflicts when another game in the same file changes; listings are second-resolution); an OS file watcher (`notify` is not a dependency, it is asynchronous too so it does not remove the window, and a rename-replace breaks the handle either way); the stamp in `gameOrigin` (a crash between the workspace and tree writes could pair a new stamp with an old tree).
* **Reason:** per-game, exact, checkable atomically where the write happens, and cheap to poll. Residual stated in the plan: the native check and the atomic rename are not atomic against another process (no cross-process lock exists). Reversal path: `FILE_REVISION_INTERVAL_MS` in `src/state/fileFreshness.ts` for the bound; the stamp definition lives in `src-tauri/src/pgn.rs`.
* **Decided by:** Claude Code (orchestrator), f-20260923-01 build (drain, full auto) · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"630c57aa38723c7397525666feb8db370d4b45f3d812e81233b3853c8cfb8f7e","input_sha256":"218b63ee6ea6236bacc180ce7c9a049d840d848199a63a4858d4f9b0f19b89e4","kind":"mutation-receipt","operation":"5d9bec092ea4120a26dac7dbe071e8400fa0154f7975a0f3161d970fd457fa6d","options":{"section":null},"request_id_sha256":null,"results":["d-20260924-02"],"target":"decisions-ledger","v":1} -->

### d-20260924-03 — Where does "Save my version" put the user's text, and what does ordinary Save-As overwrite?

* **Question:** with every native write a compare-and-swap, how are the conflict panel's "keep my edits" and the ordinary Save-As expressed?
* **Governs:** f-20260923-01
* **Chosen:** the conflict and unavailable panels offer "Save my version as a new game…": the tree is appended to a picked file (append CAS at its current count), never overwriting any game, even when the original file is picked; an uncertain outcome disables the action, persistently, so it cannot append twice. Ordinary Save-As keeps its existing target slot, now as read-then-CAS.
* **Rejected:** an unconditional `replace` write kind (reachable with any WritePgn handle, so a stale tree could overwrite its own changed source — plan round 5); changing every Save-As to append (a user-visible change outside the finding — plan round 6).
* **Reason:** the user's edits stay file-backed without destroying the newer disk version, and ordinary Save-As behaves as before. Reversal path: the append action in `FileFreshnessGate.tsx`; the Save-As branch of `saveToFile` in `src/utils/tabs.ts`.
* **Decided by:** Claude Code (orchestrator), f-20260923-01 build (drain, full auto) · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"3cfeb4b596a47a2f2fc70be7899af2639f2ffe95dd7645ce8f99ea7406bf22c9","input_sha256":"fde5d182af99d757e11b7840e2bfdbbfc0c9abdb847e18b17bf043e3a8da23f9","kind":"mutation-receipt","operation":"d01957cb867bb753ed95499be58374cacfc7fc4e0ce4a09ea1301ef23c0d5b2d","options":{"section":null},"request_id_sha256":null,"results":["d-20260924-03"],"target":"decisions-ledger","v":1} -->

### d-20260924-04 — Does a PGN picked through the native dialog stay usable after the app saves it?

* **Question:** a picked PGN is a PersistentFile capability bound to the file's (dev, inode); `write_game`/`delete_game` commit by atomic rename, which installs a new inode (measured: `mv` onto a file changes `stat %i`, an in-place write does not). Is the resulting "path authority is unavailable because its object changed" the intended outcome after the app's own save?
* **Governs:** f-20260923-01
* **Chosen:** no — after its own commit, under the same edit lock, the writer rebinds that capability to the installed identity reported by the identified atomic primitive, only when the stored identity is the one its pre-commit check proved it replaced, and persists the registry. A replacement by another program still resolves as Conflict.
* **Rejected:** in-place writes (lose atomic durability); re-resolving by pathname (a substitution race); leaving it (a picked file could be saved exactly once, and the freshness poll would mark its tab unavailable after every save).
* **Reason:** the pre-commit check already proves continuity of the authorized object; the primitive reports the new identity without touching the pathname. Reversal path: `rebind_pgn_file_after_replace` in `src-tauri/src/infra/path_authority/mod.rs`.
* **Decided by:** Claude Code (orchestrator), f-20260923-01 build (drain, full auto), plan round 3 (lens review-plan) · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"ea8ca4fee12add4bea7f3f1b6e20d21b14241a628c840687b85cb01727f01084","input_sha256":"5b06653c366322ae254cd9e04138b27ff55ca88d8dab96dd6d17cb36bbf5b363","kind":"mutation-receipt","operation":"78a4d2dbe306540848702af2941efbd5fdbe87b659f973fa0a4820f75a505c3a","options":{"section":null},"request_id_sha256":null,"results":["d-20260924-04"],"target":"decisions-ledger","v":1} -->

### d-20260924-05 — Does f-20260923-01's bundle growth cut code or raise the total ceiling?

* **Question:** `pnpm bundle:check` was red on `total` (1,576,064 B gzip against 1,567,000 B) after the stale-file build; entry and largest-lazy stayed within their caps.
* **Governs:** f-20260923-01
* **Chosen:** raise the total ceiling to 1,580,000 B with the measurement recorded in `bundle-budgets.json` and the rationale in `docs/bundle-budgets.md`. Measured with `vite build` on the base 225a9814 (1,563,701 B) and the head (1,576,064 B): +12,363 B, ~8.0 KB of it 18 new strings × 16 locales, the rest the gate, panels, registry and poll. One duplicate string was folded into `Tab.Close` first; every other new key is used.
* **Rejected:** lazy-loading the freshness gate or panels (moves bytes between chunks, `total` counts every asset once, so it cannot lower `total` — the same finding as `d-20260920-05`'s rejected lazy EvalChart); dropping or shortening user-facing messages to fit a byte cap (the conflict and unavailable states need their explanations in every locale).
* **Reason:** the growth is feature code and required strings with nothing dead to cut, which is exactly the case `docs/bundle-budgets.md` and `d-20260923-03` allow a measured raise for. Reversal path: lower `limits.total` in `bundle-budgets.json` once something is cut.
* **Decided by:** Claude Code (orchestrator), f-20260923-01 build (drain, full auto), final gates · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"a2875c4016e38e3c954a14170e938bb0f0cc55f7c36a2e535cdf7d7c738d9cd0","input_sha256":"3c1ecf03021926e5731a7c798eebefda33dbd539858a21ddf50d9db3576b8e6f","kind":"mutation-receipt","operation":"3d1e1f9756fdf9047aff9a4f2604f5a2dba142ae21ef32deb2bb224e70e22238","options":{"section":null},"request_id_sha256":null,"results":["d-20260924-05"],"target":"decisions-ledger","v":1} -->

### d-20260924-06 — How long do file-workspace expansion preferences remain applicable?

* **Question:** How long do file-workspace expansion preferences remain applicable?
* **Governs:** f-20260906-24
* **Chosen:** Bind the compressed, bounded expansion record to the active opaque file-workspace ID. A workspace change makes the prior record inactive and its in-memory IDs cannot enter the new record. Legacy arrays are read for compatibility and migrated after the startup owner snapshot; unscoped legacy data remains untrusted to that snapshot.
* **Rejected:** Carry expansion IDs across workspaces or key them by display name or path spelling; those IDs are native capabilities in another workspace context and names can change.
* **Reason:** `DirectoryTree` stores native capability IDs in a global array while `fileWorkspaceAtom` can change. The startup owner snapshot reads the array before atom hydration. Scoping and migration on those two paths prevents cross-workspace retention while preserving existing preferences.
* **Decided by:** Codex drain df96e5f3-0928-4d01-8c96-356e430dceb7 · **Superseded-by:** d-20260925-01
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"6831721b0026d8114e2418c9e73818ead063b24a63821e39769dc0164b7133ab","input_sha256":"8d482f7caf6191ac10e306e77d6c1f146626d35c65f678b7a01cf985a2c9999b","kind":"mutation-receipt","operation":"97e6fee4e014676464b5ae7b83d88e742e097f0f026dafef8d40f7c372a0178d","options":{"section":null},"request_id_sha256":null,"results":["d-20260924-06"],"target":"decisions-ledger","v":1} -->

### d-20260924-07 — What storage budget and failure policy applies to directory expansion?

* **Question:** What storage budget and failure policy applies to directory expansion?
* **Governs:** f-20260906-24
* **Chosen:** Keep at most 1,000 recent IDs and 64 KiB of UTF-8 JSON before compression. Repair valid oversized legacy data on hydration. Leave malformed bytes intact and report read failure; reject a single oversized incoming ID before eviction, keep its UI state in memory, preserve the last good persisted record, and report save failure. Never delete tab trees or practice history for expansion state.
* **Rejected:** Persist an unlimited raw array or free capacity by deleting tab trees or practice history; those consume the same quota and the latter two carry user work.
* **Reason:** The old expansion writer has no budget and shares the roughly 5 MB session-storage quota with tab trees. The fixed caps bound disposable state, compression reduces its physical size, and truthful failure reporting avoids implying that unsaved expansion was durable.
* **Decided by:** Codex drain df96e5f3-0928-4d01-8c96-356e430dceb7 · **Superseded-by:** d-20260925-02
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"dc834a690fc4718cf6b42a1f3a981f57a6de53bc81a5ebf34e4fe71f274ab3b7","input_sha256":"df792b7d7fa26ed370909d9b0440259ab054891e954b83aba5ea9e7051a84789","kind":"mutation-receipt","operation":"5f5e3ab8deeb6ef4a2223cd6d9b31047856e0b06c0ebcd3b9873649622b517b4","options":{"section":null},"request_id_sha256":null,"results":["d-20260924-07"],"target":"decisions-ledger","v":1} -->

## 2026-09-25 — recorded through the decisions lock

### d-20260925-01 — How should unscoped legacy expansion IDs be handled after a workspace changes?

* **Question:** How should unscoped legacy expansion IDs be handled after a workspace changes?
* **Governs:** f-20260906-24
* **Chosen:** Parse the legacy array for compatibility, but discard its disposable IDs at startup after the original owner snapshot. A standalone atom hydration also replaces a legacy array with an empty record for the active workspace. Only versioned records whose opaque workspace ID matches the active workspace can retain expansion capability IDs.
* **Rejected:** Tag the old array with whichever workspace happens to be active at hydration; the old array has no provenance and a later restart would trust those IDs as native capability owners.
* **Reason:** Cumulative persisted-state review showed that d-20260924-06's migration could turn unknown legacy IDs into trusted owners of a different workspace. Source tracing also showed that Files may never mount, so startup must physically reclaim a valid legacy array without waiting for atom hydration. Reversal path: a provenance-bearing legacy format or an explicit backend validation that can safely attribute each ID.
* **Decided by:** Codex drain df96e5f3-0928-4d01-8c96-356e430dceb7, cumulative review · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"f36d677657d813fd25bb57d504dd01ff5cc6b21414ecadee165783beec662606","input_sha256":"d37f9d5b405f2c98c24e899a7ca508fe617c713ec209a4377f738a6086e0bbd1","kind":"mutation-receipt","operation":"d81c8402c4746619dd930f62e3c99c72e8a191f8698b89bd226978201a070b07","options":{"section":null},"request_id_sha256":null,"results":["d-20260925-01"],"target":"decisions-ledger","v":1} -->

### d-20260925-02 — When must expansion storage be repaired, and how are oversized UI IDs saved?

* **Question:** When must expansion storage be repaired, and how are oversized UI IDs saved?
* **Governs:** f-20260906-24
* **Chosen:** Repair a valid over-budget versioned record at startup after the original owner snapshot, even when its workspace is inactive, and again on atom hydration if needed. Keep an individual oversized ID in transient UI state and report it once, but exclude it from the persisted bounded record so later valid additions can save.
* **Rejected:** Wait for Files to mount before reclaiming storage, or let one oversized transient ID block all later valid saves; either leaves shared session quota or future preference durability hostage to a disposable entry.
* **Reason:** The Files tree is not guaranteed to mount on startup, and cumulative correctness and error-handling review found that mismatched workspaces and one oversized ID could defeat the physical quota or later saves. Reversal path: a new storage architecture with independent quota and capability provenance.
* **Decided by:** Codex drain df96e5f3-0928-4d01-8c96-356e430dceb7, cumulative review · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"882b14a2171ac6e6476d11d158c95a2b7babbe04655a42922fffd238796369bd","input_sha256":"24f179780491eb75e4842e74250877661e812661f4b5f8ab0b8e1f85ef8b510c","kind":"mutation-receipt","operation":"d3176488f026a9f146f0d9b484451d3f0443fd074498a0c5b30bba2b86146fe8","options":{"section":null},"request_id_sha256":null,"results":["d-20260925-02"],"target":"decisions-ledger","v":1} -->

### d-20260925-03 — When can startup delete an unreferenced tab-tree key?

* **Question:** When can startup delete a tree-shaped session key whose tab is absent from the loaded workspace?
* **Governs:** f-20260924-02
* **Chosen:** Only after loading a valid persisted workspace envelope, remove unreferenced UUID keys that decode as persisted trees. Report removal failures and retry on later loads.
* **Rejected:** Delete all unreferenced UUID keys, because other session values could use UUIDs; sweep when the workspace record is missing or damaged, because it cannot establish which trees still contain recoverable edits.
* **Reason:** A refused tab admission can leave a durable tree when rollback removal throws. A valid workspace gives an authoritative retained-id set, and checking the value shape bounds deletion to the tree repository's own records. `src/state/workspace.ts` and `src/state/store/tabStorage.ts` own the reversal path.
* **Decided by:** Codex drain df992edd-eb21-4f56-ae9e-982da76bfbbc · **Superseded-by:** d-20260925-04
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"ba0519c47dc01f00ddbc5330259c4287dfd22c206de67cc6cff2734204130a14","input_sha256":"40ea768848f09f9aed4ad3dbcad7613d3a3b20033da8c66dfabe0ec9cc199d91","kind":"mutation-receipt","operation":"5cc22fb0867a97dd3e509b0677ac9a5ab5f6b757690cee4048545ad1986e34dd","options":{"section":null},"request_id_sha256":null,"results":["d-20260925-03"],"target":"decisions-ledger","v":1} -->

### d-20260925-04 — When may startup reclaim an unreferenced persisted tree after workspace repair?

* **Question:** When may startup reclaim a decodable tree whose key is absent from the loaded workspace?
* **Governs:** f-20260924-02
* **Chosen:** Reclaim any decodable persisted tree absent from a sound workspace after its envelope write succeeds, including legacy non-UUID keys. Persist `treeOwnershipUncertain` when a stored workspace is unreadable or invalid; carry it through later loads and saves and withhold sweeping while it is set. Report individual removal failures and retry on later loads.
* **Rejected:** The UUID-only, initially-valid-v1-only sweep in d-20260925-03. It misses valid legacy migrations and leaves old non-UUID tree keys after a failed removal. Also rejected treating a newly written default as proof of ownership after a corrupt workspace: the second load would delete recoverable edits.
* **Reason:** Push review of commit `9d6efe5d` found a concrete two-load data-loss case and a legacy migration retry gap that the prior decision did not consider. `workspace.ts` owns the durable uncertainty marker and migration gate; `tabStorage.ts` validates tree payloads before deletion. Reversal path: change those boundaries with a recovery mechanism that can establish ownership after corruption.
* **Decided by:** Codex drain df992edd-eb21-4f56-ae9e-982da76bfbbc, push review repair · **Superseded-by:** d-20260925-06
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"64d7267a8613b959d217a6a127d4c778a1e60248631e827e1c27b5008deab522","input_sha256":"e875da0eabfe42c7f51e8ce0b5aa35fb108ecc11ffe31cd835f6c03be33bd70f","kind":"mutation-receipt","operation":"108579e2a3e72e08be71215966e922c335aa6258b144da2a67cd0d9f6043ccc1","options":{"section":null},"request_id_sha256":null,"results":["d-20260925-04"],"target":"decisions-ledger","v":1} -->

### d-20260925-05 — What happens to a stored tree when workspace metadata is absent?

* **Question:** How does startup handle valid persisted trees when no workspace key or valid legacy workspace exists?
* **Governs:** f-20260924-02
* **Chosen:** Probe for any decodable tree through the same bounded scan used by orphan cleanup; if one exists, persist `treeOwnershipUncertain` with the generated workspace before any later sweep. A genuinely empty first launch remains unmarked.
* **Rejected:** Treating absence as a fresh install unconditionally. A failed rollback or interrupted workspace write can leave a recoverable tree without workspace metadata, and a second load would otherwise delete it.
* **Reason:** The second push review found a missing-key two-load counterexample to the narrower corruption rule in d-20260925-04. This adds the absent-metadata case without reversing that rule. Reversal path: `loadWorkspace` in `src/state/workspace.ts` and `storedTreeKeys` in `src/state/store/tabStorage.ts`.
* **Decided by:** Codex drain df992edd-eb21-4f56-ae9e-982da76bfbbc, second push review repair · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"aff8e50e1ba799d104e97be384a103155de512017d19c0309fa0faee828d9d73","input_sha256":"98666e09d02c79473a4abd4de83e85bb1d8282d831fc28c68f6ec337b89254c7","kind":"mutation-receipt","operation":"ac0076e1cbad79f4d29fb1de5c268c0a77f7c7aa82834ed9854bd54ee122f94d","options":{"section":null},"request_id_sha256":null,"results":["d-20260925-05"],"target":"decisions-ledger","v":1} -->

### d-20260925-06 — How can startup reclaim new orphans while prior tree ownership is uncertain?

* **Question:** How can startup retry known tree deletion and reclaim later orphans without deleting recoverable trees that predate damaged or missing workspace metadata?
* **Governs:** f-20260924-02
* **Chosen:** Capture at most 1,024 decodable tree keys of at most 128 characters each before repair and persist them as protected prior ownership. On later loads, sweep only unretained keys outside that snapshot. When the snapshot cannot be represented or scanned, keep the uncertainty marker and skip the general sweep. Persist known migrated source IDs as retry intents until their keys disappear; prune a closed tab from protection in the same durable workspace update that removes its metadata. Treat legacy-key removal as best-effort startup cleanup.
* **Rejected:** Withholding every sweep forever while uncertainty is marked, as d-20260925-04 specified: a later failed rollback then leaves a new orphan forever. Also rejected sweeping all keys after a default workspace is saved: it can erase prior recoverable edits.
* **Reason:** Third and fourth push reviews found the permanent-orphan counterexample, an overflowed-snapshot source-removal retry gap, and a failed-close protected-key gap. The bounded snapshot separates prior unknown ownership from keys created afterward; the persisted retry intent covers known migrated sources even when a general snapshot is impossible. Reversal path: `loadWorkspace` and the workspace atom in `src/state/`, with a replacement ownership proof that preserves earlier dirty trees and retries known deletions.
* **Decided by:** Codex drain df992edd-eb21-4f56-ae9e-982da76bfbbc, push review repair · **Superseded-by:** d-20260925-07
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"a6e9a57e554cbc137003df745dfca2571e18030fade4fb02f5551f104e53480f","input_sha256":"b08dc8cbbf6f56ee9a5bedd041bad03b609f39a885d7a8cb234f0848b91e325f","kind":"mutation-receipt","operation":"3125f1d62a8badb755bf272a2611b8e8ada1c75c8119d30c3ce6397a882b7397","options":{"section":null},"request_id_sha256":null,"results":["d-20260925-06"],"target":"decisions-ledger","v":1} -->

### d-20260925-07 — Which known tree removal intents must survive a failed cleanup?

* **Question:** Which known tree removal intents must survive failed cleanup when a general orphan sweep cannot establish ownership?
* **Governs:** f-20260924-02
* **Chosen:** Persist retry IDs for both durably migrated sources and tabs removed from durable workspace metadata. Remove a closed tab from the protected ownership snapshot in that same workspace write. Replay a persisted retry only while its key still decodes as a tree; a missing or non-tree value ends that authorization. Prune completed intents on later workspace writes or loads. A bounded snapshot protects unknown earlier trees; if it cannot be represented, skip the general sweep while still replaying known removals.
* **Rejected:** Keeping failed tab-close deletion solely in memory, which leaves a known orphan forever when ownership snapshot overflow suppresses sweeping; and treating an arbitrary persisted retry string as authority to delete a non-tree session value.
* **Reason:** Fifth push review found failed-close overflow despite d-20260925-06's migrated-source retry, and inspection found its retry field could target unrelated session keys. Commits `d15546bb` and `175db231` add tree-shape validation and durable close intent. Reversal path: workspace commit and load in `src/state/atoms.ts` and `src/state/workspace.ts`, plus tree validation in `src/state/store/tabStorage.ts`.
* **Decided by:** Codex drain df992edd-eb21-4f56-ae9e-982da76bfbbc, fifth push review repair · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"d35549772df7643e3616adc5dac0854f6772ac6c704c2f2b5f3ac2e456c77654","input_sha256":"04fddb9c43e8d2b6c9f77e01b88ca0586899bc318122d2ecf6508f807407317b","kind":"mutation-receipt","operation":"aecd757c2362ca084b1494143b2533946cd8d534f531e5048ffc855334f85121","options":{"section":null},"request_id_sha256":null,"results":["d-20260925-07"],"target":"decisions-ledger","v":1} -->

### d-20260925-08 — How is a refused seeded tab reclaimed when ownership snapshots overflow?

* **Question:** How does startup retry the exact tree from a refused seeded tab when rollback removal fails and a general ownership snapshot cannot be represented?
* **Governs:** f-20260924-02
* **Chosen:** After admission is explicitly refused and tree removal fails, write a session marker for that generated UUID. On workspace loading, replay marked deletions before taking an ownership snapshot, and preserve any ID retained by the repaired workspace. A failed marker write is reported; with both storage removal and storage writing denied, no durable retry can be promised. Do not mark the ambiguous path where tab admission throws after possibly committing.
* **Rejected:** Sweeping all unretained trees after an overflowing snapshot, because old recoverable trees have unknown owners; and reserving a deletion marker before admission, because marker cleanup failure followed by damaged workspace metadata could delete a genuinely admitted tree.
* **Reason:** Three independent fifth-round lenses found a refused seed plus failed removal that remained orphaned through every overflowing load. Commit `8100c095` adds an explicit post-refusal intent and replays it before uncertain ownership is snapshotted. Reversal path: `commitNewTab` in `src/utils/tabs.ts`, the tree repository marker methods, and `loadWorkspace` in `src/state/workspace.ts`.
* **Decided by:** Codex drain df992edd-eb21-4f56-ae9e-982da76bfbbc, cumulative push review repair · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"ca72b73519f76fe9227e46cb70219f68e8cb2ec48b101097cf3bca91d72ffea8","input_sha256":"5d34f6747aa6ca2a958397ba405864c64654885ee33505435e3703bf4dbc0032","kind":"mutation-receipt","operation":"23bef88055a058a1d5f708268eaec6bcef1185c159544d16aeb2e99563cd887f","options":{"section":null},"request_id_sha256":null,"results":["d-20260925-08"],"target":"decisions-ledger","v":1} -->

### d-20260925-09 — Where should an unreadable persisted tab tree be kept until recovery?

* **Question:** Where should an unreadable persisted tab tree be kept until recovery?
* **Governs:** f-20260924-03
* **Chosen:** Keep the original bytes in the existing tab-tree session key, mark the tab unreadable, block edits and close, and require explicit discard before a clean default can replace the value. A transient storage read failure remains unavailable until an in-app retry succeeds. Workspace ID repair retains ownership or durably carries the raw bytes before publishing a remapped tab.
* **Rejected:** Duplicate the value into a quarantine key and hydrate a clean default. Duplication consumes the same shared quota and creates a second ownership and cleanup path, while the default can still be mistaken for the saved game.
* **Reason:** The original key is the only durable copy of unsaved edits. Preserving it in place avoids quota amplification and lets the workspace keep an exact recovery owner. Reversal path: a proven backup store with independent capacity and migration semantics, plus a tested user recovery flow.
* **Decided by:** Codex drain 2049a568-6411-42a1-b116-cb0ad1230e55 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"f1690bf0db3c17ff165e1f4224ba2c1f38896f8a02131c2d07fcfaabfd5533a8","input_sha256":"292c0c08754bf8bc6f81a1aa8ab83a6e383396a9faa875960164ae90486d608b","kind":"mutation-receipt","operation":"f83f5e5330bad27c3e59ae25b51ceb43550217b93b80cdbc0f48a6805f7b1a79","options":{"section":null},"request_id_sha256":null,"results":["d-20260925-09"],"target":"decisions-ledger","v":1} -->

### d-20260925-10 — How should PGN deletion identify the selected game after the file changes?

* **Question:** How should PGN deletion identify the selected game after the file changes?
* **Governs:** f-20260924-05
* **Chosen:** Require the exact game-byte stamp and the scanned file revision captured with the visible row, then reject a changed revision or selected stamp as `StaleGame` before deletion.
* **Rejected:** A game stamp alone, which cannot distinguish equal-text duplicate rows after insertion or reordering; and a separate stamp-fetch command, which can observe a different file snapshot from the displayed game text.
* **Reason:** One page read binds the displayed text, stamp, and file revision to the same scan. The revision prevents a shifted equal-text duplicate from being deleted. An unrelated edit can cause a safe refusal and refresh, which is preferable to deleting the wrong game.
* **Decided by:** Codex, autonomously in the 2026-09-25 full-auto run · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"ab86202f26a970eafe5dd732563ae454d92dd499d4ea0774d2363785c141a0db","input_sha256":"2c63f12cc35021c1099e6e7757bbf44440d84cb9f95f680bcaafccc9d8baa78c","kind":"mutation-receipt","operation":"8d1089e8373451713affc5eb27f24b95147c625199697b779943c13ad568cc5e","options":{"section":null},"request_id_sha256":null,"results":["d-20260925-10"],"target":"decisions-ledger","v":1} -->

### d-20260925-11 — What makes verify:app stop answering during the stale-file rewrite?

* **Question:** `pnpm verify:app` dies while waiting for an open repertoire to notice an in-place PGN rewrite. Is the cause a foreign compositor, a short WebDriver timeout, or the reload itself?
* **Governs:** f-20260924-06
* **Chosen:** remove the quadratic card scan in `buildFromTree`. It dedups with a `Set` of `getBoardState` keys. The harness times `read_game` through a platform hook, because WebKit seals `__TAURI_INTERNALS__.invoke`, and requires the main-thread apply after that read to finish within 1,000 ms.
* **Rejected:** raising `FETCH_TIMEOUT_MS` or the 10 s wait. The reload was taking about 36 s, so a longer wait would still miss the one-poll budget. Also rejected: treating the foreign virtual Plasma session as the cause. It was not running, and the stall reproduced without it. Also rejected: a full-FEN dedup key, which would keep two cards for one position.
* **Reason:** On the release binary the native read was 9 ms and `parsePGN` 160 ms, while `syncDeck` took 36.5 s. The same `cards.find` loop takes 6.0 s in Node for 12,500 FENs and 3 ms with a `Set`. After the change, `pnpm verify:app` passed: 2,268 ms from the rewrite, read 9.0 ms, apply 486 ms. Reversal: put the `cards.find` scan back and drop the 1,000 ms ceiling.
* **Decided by:** Grok, autonomously under full auto · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"323d994560993b0108876e125ca81e3a24173d527dfcf1d0905e66340655c65d","input_sha256":"777caecec592d005bd469cfd658cc58525dfed169c7e8bad1923b64fd3d775ea","kind":"mutation-receipt","operation":"b44618b5605784845e6599be1a0803a91508c5688b5de2a061183d063f4dce82","options":{"section":null},"request_id_sha256":null,"results":["d-20260925-11"],"target":"decisions-ledger","v":1} -->

## 2026-09-26 — recorded through the decisions lock

### d-20260926-01 — What form does the Windows compile gate take, and what does it do on a machine without the toolchain?

* **Question:** `f-20260924-07` asks how to add a Windows compile gate that stays honest without the toolchain. Should it fail with a setup instruction, or record the gate as unavailable and refuse? Should it be a `gate:ensure` receipt gate, a contract-gate member, or a line in push skill §2? And how is the MinGW toolchain found without silently assuming `~/.local/opt/mingw`?
* **Governs:** f-20260924-07
* **Chosen:** a §2 "Rust/Tauri backend" command, `pnpm rust:windows:check` (`scripts/rust-windows-check.mjs`). It runs `cargo clippy --target x86_64-pc-windows-gnu --all-targets --locked -- -D warnings`. The cross compiler is resolved from `CHESSFABLE_MINGW_PREFIX` first, with no fallback when it is set, then from `PATH`, then from the default prefix `$HOME/.local/opt/mingw`, and the resolved path is printed. A missing compiler or rustup target fails the gate. The failure prints the exact setup commands: a fail-closed `set -e` apt subshell, a line for non-apt hosts, and `rustup target add`. The gate never skips and never installs anything. Its unit tests run in the contract gate.
* **Rejected:** a contract-gate member, because the contract gate is also CI's only tooling step, the Linux runner has no MinGW, and CI already builds and tests real Windows. A receipt gate, because the measured incremental cost is about 7 s and cargo's fingerprinting already reuses unchanged work. Recording the gate as unavailable, because under `d-20260830-20` "could not check" must never read as success, and a failing gate blocks the push in the same way with one state fewer. A provisioning script run before the check: plan review found that it failed on a host that already had a compiler on `PATH` but no apt, before the check could fall back, and installing anything was outside the mandate. A hard-coded path, and a mandatory env variable.
* **Reason:** The gate's staged matrix shows it goes red on the `490831c7` class (E0425, exit 101) and on a Windows-only `dead_code` that Linux clippy passes (exit 101 against exit 0). It fails with a distinct message for every missing prerequisite. The printed recipe, run verbatim into an empty prefix, installed a toolchain that built all 260 crates from scratch, including zstd-sys's C code, in 38 s. This partly supersedes `d-20260916-07`: "no gate invokes it" no longer holds. Its reversal becomes: deleting `~/.local/opt/mingw` while `CHESSFABLE_MINGW_PREFIX` is unset and no other MinGW is on `PATH` makes the gate red and prints the reinstall commands. Retiring the gate means reverting its §2 fence line, its two package scripts, its contract-chain member and the `CONTRACT_CHAIN` pin in `scripts/check-gate-routing-tests.mjs`. The MSVC target and all Windows tests stay CI-only.
* **Decided by:** Claude Code (Opus 5.5), autonomously under `full auto`, build run 2026-09-26; plan reviewed six rounds on Codex · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"ac4a07efb88eb6b0af06713132f3286757d3b818f08f7536cddb5b09c6827fba","input_sha256":"3dc61fcbe664c42ddd991b0d3e9bf9ed69b6286507db6e06f52ce5587a1cf247","kind":"mutation-receipt","operation":"e0ab9d0b9a33a343aac9aec9761d4fe6aba38d6a1cc20bebf10fecce9b7886a0","options":{"section":null},"request_id_sha256":null,"results":["d-20260926-01"],"target":"decisions-ledger","v":1} -->

### d-20260926-02 — What does player statistics return instead of one record per game?

* **Question:** f-20260907-05 needs the player-statistics result to stay bounded. Should it keep per-game `StatsData`, cap the game count, or return aggregates?
* **Governs:** f-20260907-05
* **Chosen:** Return bounded aggregates per (site, player), as flat records with `u32` counts. `daily` holds one record per (time_control, date) with won, drawn, lost and the maximum selected-player rating. `openings` holds one record per (time_control, colour, opening) with won, drawn, lost. Maps are used only while accumulating.
* **Rejected:** Keeping per-game `StatsData`, because the result, the IPC JSON and the renderer copy would still grow with the game count. A game cap, because users would see different statistics. Composite-keyed maps on the wire, because serde_json and Specta cannot carry them. `u64` counts, because of the bigint mismatch in f-20260925-02.
* **Reason:** Every consumer (Overview, Ratings, Openings, the `Databases.tsx` merge) only filters by site, account, time control and date, then counts or takes a maximum, so the aggregate loses nothing they use. Its size is bounded by the calendar span and the opening table. Reversal path: restore per-game records in the Specta type and in the four consumers.
* **Decided by:** Claude Code (Opus 5.5), autonomously under full auto, build run 2026-09-26; plan reviewed in four Gemini rounds · **Superseded-by:** -

### d-20260926-03 — How does player statistics stream rows and handle the move prefix?

* **Question:** How should `get_players_game_info_blocking` avoid holding every matching row and move blob, and should it read only a mainline prefix of each blob?
* **Governs:** f-20260907-05
* **Chosen:** Stream with `load_iter` into batches bounded by a move-blob byte budget and a row ceiling. A row larger than the budget forms a batch alone. Rayon evaluates each batch, which is folded into the aggregate before the next read. Every blob is still read and validated in full. Row errors propagate.
* **Rejected:** SQL `substr` truncation to a prefix. Annotations and variations make the byte offset of ply 55 unbounded, and truncation would bypass the full-stream validation that decides eligibility under d-20260907-05. Also rejected: skipping failed rows, because of d-20260905-21.
* **Reason:** This follows the d-20260905-20 streaming precedent. The memory held for blobs is bounded by one batch rather than by the corpus. Reversal path: return to `load(db)`, which the large-row memory test forbids.
* **Decided by:** Claude Code (Opus 5.5), autonomously under full auto, build run 2026-09-26 · **Superseded-by:** -

### d-20260926-04 — Where does the statistics progress denominator come from?

* **Question:** Once the rows are streamed, how does progress get its total, and should the count and the SELECT share one read transaction?
* **Governs:** f-20260907-05
* **Chosen:** A separate `COUNT(*)` over the same join and filters, with no transaction and the fraction clamped to 0..=1. The existing `* 100_f64` scale stays in the blocking body. A final running frame is emitted after the stream whenever at least one row was kept.
* **Rejected:** One read transaction around both statements. While cancellation is armed, the SQLite progress handler would also interrupt Diesel's `ROLLBACK` and leave a pooled connection inside a transaction. Also rejected: the old `p == len - 1` last-frame rule, which never fires once any row is filtered out.
* **Reason:** Clamping covers the only effect of skew between the two statements. Reversal path: derive progress without a denominator.
* **Decided by:** Claude Code (Opus 5.5), autonomously under full auto, build run 2026-09-26 · **Superseded-by:** -

### d-20260926-05 — How is the player-statistics memory bound proven?

* **Question:** How can a test prove the bound when Rayon workers do part of the work?
* **Governs:** f-20260907-05
* **Chosen:** Run `allocation_probe::measure` inside a dedicated one-thread Rayon pool (`pool.install`), so every allocation, worker work included, lands on the measured thread. Use two fixtures: a large-row corpus that detects input materialisation, and a many-row corpus that detects per-game result accumulation. Each must go red under its own reversion.
* **Rejected:** Measuring on the calling thread with the global pool, which misses worker allocations and can undercount. Also rejected: a single 512-row fixture, which cannot see per-game accumulation.
* **Reason:** This extends d-20260905-22. Reversal path: replace the probe with an equally direct production-path allocation instrument.
* **Decided by:** Claude Code (Opus 5.5), autonomously under full auto, build run 2026-09-26 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":35,"effect_sha256":"74fb296d617f591924c8b6fd1a20546e5c53c7ab504f7bd20441631c0be14ff5","input_sha256":"dad4393836049d603e4bdada20a2641e61b5defb2bd80f945d8dc01842c0717a","kind":"mutation-receipt","operation":"f5b3144b8d550ef491e9a5a666ae1cb2f82e323d80eead62d276a0451fc3a757","options":{"section":null},"request_id_sha256":null,"results":["d-20260926-02","d-20260926-03","d-20260926-04","d-20260926-05"],"target":"decisions-ledger","v":1} -->

### d-20260926-06 — What exactly bounds the player-statistics aggregate, and what does count skew cost?

* **Question:** The cumulative review of f-20260907-05 showed that d-20260926-02 overstates the bound ("bounded by the calendar span and the opening table") and d-20260926-04 understates the skew ("clamping covers the only effect"). Should `site` and `time_control` be normalised to force a hard bound, and should the progress skew be removed?
* **Governs:** f-20260907-05
* **Chosen:** Keep `site` (only the existing Lichess normalisation) and `time_control` verbatim. The result holds one record per distinct (site, player, time_control, date) and one per distinct (site, player, time_control, colour, opening). With per-game Site or TimeControl strings, that is one small metadata record per game, but a move blob is never retained, and batches are bounded by all owned row bytes, not only move bytes. Keep the separate COUNT. Under a concurrent import between the COUNT and the SELECT, the running bar can reach 100% before the stream ends. That is accepted.
* **Rejected:** Normalising Site to a host name or TimeControl to a category on the backend. Users would see different site groups, and the renderer's `getTimeControl` mapping depends on the selected website, so a backend category would change the panels' filters. Also rejected: capping running progress below 100%, or a read transaction (rejected in d-20260926-04 for its cancellation-rollback hazard).
* **Reason:** New evidence from the review lenses: the importer stores `[Site]` and `[TimeControl]` verbatim, so the "calendar and opening table" bound holds only when those strings repeat, as they do for real server and OTB exports. This refines the Reason of d-20260926-02 and d-20260926-04 without changing what was chosen. Reversal path: normalise the key fields on the backend together with the renderer filters.
* **Decided by:** Claude Code (Opus 5.5), autonomously under full auto, build run 2026-09-26, after the Codex cumulative review · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"8c379b49488066bfdc64ce402a7e94c0cb61b2d95d748c650b8283a77932e61f","input_sha256":"dcd4a846c63f761e97afa843b9ad7571e7eceb33cef58cc2fb75880dcc93beb3","kind":"mutation-receipt","operation":"b2d929fbbb82d869c7e7955a482f386ce9a8156882e2557d9bd6582d55637bd2","options":{"section":null},"request_id_sha256":null,"results":["d-20260926-06"],"target":"decisions-ledger","v":1} -->

### d-20260926-07 — Should the synchronous search locks share the async keyed-lease mechanism or get their own?

* **Question:** f-20260908-01 needs an atomic acquire/release lifetime for the parking_lot generation and collision locks on `SearchCache`; `infra/keyed_locks.rs` already has one for Tokio mutexes. Share it or write a synchronous twin?
* **Governs:** f-20260908-01
* **Chosen:** Make `KeyedLocks<K, M = tokio::sync::Mutex<()>>` and `KeyedLockLease<'a, K, M = …>` generic over the mutex type. Registry, `lease()` and the entry-locked `Drop` are written once; acquisition is an inherent impl per mutex type (Tokio `lock().await`; parking_lot `lock_cancellable` delegating to `cancellable_lock::lock_cancellable`). The Tokio default keeps the engine/game spellings unchanged.
* **Rejected:** A parallel `SyncKeyedLocks` (a second copy of the atomic Drop, rule 11); a trait abstraction over locking (two closed types, no third caller).
* **Reason:** One registry contract and one atomicity proof: the ownership count is read only through the occupied entry guard, so no `lease()` can interleave between the count and `entry.remove()`. Reversal path: split the generic back into two registries if a mutex type ever needs a different reclamation rule.
* **Decided by:** Claude Code (Opus 5.5), autonomously under full auto, plan-reviewed build run 2026-09-26 · **Superseded-by:** -

### d-20260926-08 — What does `SearchCache::clear` do with the lock registries?

* **Question:** `SearchCache::clear` cleared `collisions` and `generation_locks` unconditionally, orphaning live owners. Retain by owner count, or stop clearing them?
* **Governs:** f-20260908-01
* **Chosen:** `clear()` evicts only the result and index caches (and keeps retaining live mapping gates as before); it never touches the lock registries. Lease `Drop` owns retention, so the registries are empty at quiescence by construction.
* **Rejected:** An owner-counted `retain` (a third removal path racing the lease `Drop` for the same entry); keeping the unconditional clear (the defect itself).
* **Reason:** A lease registry holds only outstanding leases; clearing it can only split a live lock. Reversal path: none needed unless registries start holding non-lease state.
* **Decided by:** Claude Code (Opus 5.5), autonomously under full auto, plan-reviewed build run 2026-09-26 · **Superseded-by:** -

### d-20260926-09 — Is the preferred-mapping gate converted to leases in the same change?

* **Question:** `SearchCache.mapping_gates` is a third keyed registry on the same struct. Convert it too?
* **Governs:** f-20260908-01
* **Chosen:** No. The mapping gate stays as it is.
* **Rejected:** Converting it now.
* **Reason:** Outside the f-20260908-01 mandate; its necessity is owned by `f-20260919-06`, and `remove_idle_mapping_gate` already reads the owner count inside `remove_if` under the shard lock (d-20260918-17), so it does not carry this defect. Reversal path: `f-20260919-06` decides its fate.
* **Decided by:** Claude Code (Opus 5.5), autonomously under full auto, plan-reviewed build run 2026-09-26 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":26,"effect_sha256":"ea72795150d95a587be261f38f1233e13a5f999aa6187c6b679e0970dfed2758","input_sha256":"200605ecb974fae7204e1c9398e55c3e8bcb037ce13a1b0e51a8816ffcf07225","kind":"mutation-receipt","operation":"4829315150a2d3d582c5719cd1154eb4c7a8345edfb41abf608836080a675179","options":{"section":null},"request_id_sha256":null,"results":["d-20260926-07","d-20260926-08","d-20260926-09"],"target":"decisions-ledger","v":1} -->

## 2026-09-27 — recorded through the decisions lock

### d-20260927-01 — How does a file import reach the workspace without a corpus-sized IPC payload?

* **Question:** f-20260908-04 needs a native streaming copy of a selected PGN into the workspace. Add a new command, or extend `create_workspace_file`?
* **Governs:** f-20260908-04
* **Chosen:** `create_workspace_file` takes `content: WorkspaceFileContent` — `{ kind: "text", pgn }` or `{ kind: "copy", source, revision }` — instead of `pgn: String`. One command, one destination core (`create_workspace_file_blocking`): sidecar, registration, rollback and durability reporting are shared; only the content-writing step branches. The copy streams the authority-resolved source descriptor in 64 KiB chunks through the existing atomic replace.
* **Rejected:** A separate `import_workspace_file` command (a second copy of the destination core and of every source-scan inventory entry, rule 11); paging `readGames` and joining in the renderer (keeps the memory defect, as the finding states).
* **Reason:** The destination semantics the finding requires preserved are exactly those of the existing core; routing both content kinds through it keeps one contract. Reversal path: split the `Copy` arm into its own command calling the same core.
* **Decided by:** Claude Code (Opus 5.5), autonomously under full auto, plan-reviewed build run 2026-09-26 · **Superseded-by:** -

### d-20260927-02 — Is a saved import a verbatim byte copy of the source, bound to the revision the user opened?

* **Question:** Should the saved file be the source bytes verbatim, or the scanned games re-serialised and joined by blank lines (the previous behaviour), and what if the source changes between opening and saving?
* **Governs:** f-20260908-04
* **Chosen:** Verbatim byte copy. The `Copy` request carries the `revision` returned by the preflight `loadFileGame(source, 0)`; the native side refuses with `Conflict` before writing if the source snapshot's revision differs, and its precommit refuses publication if the source changed or the operation was cancelled during the copy. A post-install count failure keeps the installed file and returns the error, unchanged from the `Text` path.
* **Rejected:** Re-serialising scanned game ranges (reads every game, alters user bytes); rolling back on a post-install count failure (changes the shared destination contract beyond the mandate); copying without a revision binding (a source edited between preview and save could publish a file whose game 0 fails the per-game limit).
* **Reason:** The copy is what the user selected, the game count is identical because scanning is deterministic over the same bytes, and the revision binding keeps the pre-publication validation that the old load-then-create order provided. Reversal path: drop the revision field and the precommit comparison.
* **Decided by:** Claude Code (Opus 5.5), autonomously under full auto, plan-reviewed build run 2026-09-26 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":17,"effect_sha256":"33843959eb9c06f9ffe2c96fc6c912ce100c65ea114b40d51767e024257b7589","input_sha256":"485708f178ff1d90f9c712e57ea2ad73edd992f99682aa0aaf61388cb626fcec","kind":"mutation-receipt","operation":"09ffe5dab73756194e3e2da9fe4139002ee5494b40f2248a36002982c9be142c","options":{"section":null},"request_id_sha256":null,"results":["d-20260927-01","d-20260927-02"],"target":"decisions-ledger","v":1} -->

### d-20260927-03 — Who owns a published game engine generation between initialization and the LiveSession?

* **Question:** After `spawn_registered` disarms its initialization guard, `start_game` holds the actor across further awaits with no owner that terminates it if the construction future is dropped.
* **Governs:** f-20260908-02
* **Chosen:** A construction-local list of `RegistrationGuard`s (d-20260901-31's guard, made crate-visible with a synchronous `terminate_now`), disarmed when `publish_live` returns `Ok`.
* **Rejected:** `Drop` on `RegisteredGameEngine` (shared clones would double-kill); a `GameManager`-side kill path (d-20260901-30 forbids a second one); an `OperationLease` wrapper (different design, f-20260915-06 class).
* **Reason:** One owner per generation, one drop-terminator implementation, handoff at the point the session becomes reachable. Reversal path: replace the guard list with another owner type; the handoff point stays `publish_live`.
* **Decided by:** Claude Code (Opus 5.5), autonomously under full auto, plan-reviewed build run 2026-09-27 · **Superseded-by:** -

### d-20260927-04 — What happens to a LiveSession whose loop never receives its start signal?

* **Question:** `start_game` can be dropped after `publish_live` returned `Ok` but before `start_loop.send(())`.
* **Governs:** f-20260908-02
* **Chosen:** The installed task (`run_published_loop`) terminates both engines and tombstones the session through `retire_live_locked`.
* **Rejected:** Treating it as completed (would record a snapshot of a game that never started); leaving it in `games` (leaks until exit, the measured gap).
* **Reason:** Ownership has transferred at publication, so the session must clean itself up. Reversal path: change the `Err` branch of `run_published_loop`.
* **Decided by:** Claude Code (Opus 5.5), autonomously under full auto, plan-reviewed build run 2026-09-27 · **Superseded-by:** -

### d-20260927-05 — When is a replaced predecessor session owned, and by what?

* **Question:** `retire_replaced_session` removes the old session from `games` before awaiting its shutdown; a cancellation there orphans it.
* **Governs:** f-20260908-02
* **Chosen:** A local guard inside `retire_replaced_session`, from removal until `shutdown_and_join` and an unconditional direct exact termination (`finish_retired`) both completed; an armed drop spawns the same steps. `shutdown_and_join` restores its taken join handle when dropped mid-wait. An `Ok` with an empty join slot is never taken as termination.
* **Rejected:** Owning it from the start of `retire_replaced_session` (would shut down a still-published session on a cancelled replacement); ending ownership when `shutdown_and_join` returns (another caller may hold the join and be cancelled); a field on the construction (no gain over the local guard).
* **Reason:** The replacement commits at removal, and removal must imply termination regardless of who holds the join. Reversal path: move the guard boundary.
* **Decided by:** Claude Code (Opus 5.5), autonomously under full auto, plan-reviewed build run 2026-09-27 · **Superseded-by:** -

### d-20260927-06 — How does a test reach GameManager::start_game?

* **Question:** `game.rs` is fixed to `AppHandle<Wry>`, so no test can call `start_game`.
* **Governs:** f-20260908-02
* **Chosen:** Make the `start_game` call path generic over `tauri::Runtime` and use `tauri::test::mock_app()`; commands, `make_move`, `take_back_move`, `resign` stay concrete.
* **Rejected:** An app-free construction core with an injected loop installer.
* **Reason:** Zero behaviour change, the crate's existing test pattern (`chesscom.rs`, `puzzle.rs`), and the ownership logic under review is not reshaped for testability. Reversal path: re-concretise the signatures; the tests then need another harness.
* **Decided by:** Claude Code (Opus 5.5), autonomously under full auto, plan-reviewed build run 2026-09-27 · **Superseded-by:** -

### d-20260927-07 — Is the construction-cancellation gap implemented although no production path drops start_game today?

* **Question:** The `#[tauri::command]` wrapper spawns `start_game` onto Tauri's runtime and nothing cancels it before process exit.
* **Governs:** f-20260908-02
* **Chosen:** Implement anyway under `async-resource-invariants.md`, with deterministic drop tests as the proof; add no cancellation wrapper.
* **Rejected:** Leaving the latent gap until an owner-scoped wrapper exists.
* **Reason:** Cleanup on every exit path is the rule; the next cancellation wrapper around a game command would turn the latent gap into a leak. Reversal path: none needed; a later wrapper relies on this.
* **Decided by:** Claude Code (Opus 5.5), autonomously under full auto, plan-reviewed build run 2026-09-27 · **Superseded-by:** -

### d-20260927-08 — How is an engine termination failure reported when the requester that asked for it is cancelled?

* **Question:** A failed `runtime.terminate()` is only returned through the reply channel; a cancelled requester loses it and the entry is already removed.
* **Governs:** f-20260908-02
* **Chosen:** The actor logs it through the keyed, generation-exact `log_registration_cleanup_error` before replying (one helper for all three `Terminate` arms), bound to its key and generation inside `publish_admitted` before the registry insert; requesters still report what they receive.
* **Rejected:** A keyless actor-level line (loses identity); recording the failure and replaying it to a later `terminate` (a same-key replacement consumes it and fails g+1's publication).
* **Reason:** The only reporter no requester cancellation can bypass is the actor itself. Reversal path: drop the actor-side log and restore requester-only reporting if the duplicate lines prove unacceptable in the field.
* **Decided by:** Claude Code (Opus 5.5), autonomously under full auto, plan-reviewed build run 2026-09-27 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":53,"effect_sha256":"63a650924f7400dd0adaf4b311c96bcd9e8092d97465cc0b0469d4f4f8840510","input_sha256":"3a9469533821594fed5d00a09b7455972e91d9989c5018f9661710dd0ed8ad2b","kind":"mutation-receipt","operation":"bb05839f224ad0f7cc71f153fec65af7d726896eead3b112eaf893a94e442133","options":{"section":null},"request_id_sha256":null,"results":["d-20260927-03","d-20260927-04","d-20260927-05","d-20260927-06","d-20260927-07","d-20260927-08"],"target":"decisions-ledger","v":1} -->

### d-20260927-09 — Does the game-engine termination aggregate carry diagnostic text?

* **Question:** The f-20260908-02 plan (O2(a)) rendered each per-generation failure inside the aggregate `Error::Conflict("failed to terminate game engines: …")` with `Error::diagnostic()`. Keep that?
* **Governs:** f-20260908-02
* **Chosen:** No. The aggregate renders each failure with `to_string()` (the renderer-safe label, the behaviour before this finding). The OS cause is logged Rust-side per generation, with key and generation, at the moment each termination completes (`terminate_game_engines`, `RegistrationGuard::terminate_now`, the actor's own terminate log).
* **Rejected:** Diagnostic text in the aggregate (the plan's O2(a) wording). `Error::Conflict` displays its message and `impl Serialize for Error` sends `to_string()` to the renderer, so the aggregate returned bare by `abort_game`, `shutdown_all` or a replacement's retirement branch would carry raw OS causes across IPC — against `d-20260831-05` and the "never move a raw backend diagnostic into the renderer" rule. Plan review had checked only `OperationAndCleanup`, whose Display is fixed.
* **Reason:** New evidence from the cumulative error-handling lens (confidence 95), confirmed against `error.rs` Serialize. The log-side property the plan wanted is already met by the per-generation logs. Reversal path: return diagnostics in the aggregate only if the renderer payload stops using Display.
* **Decided by:** Claude Code (Opus 5.5), autonomously under full auto, plan-reviewed build run 2026-09-27 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"769bc990cdfc177f41458882aada6aafa9fd9000ab8119d8cf0671e59826329f","input_sha256":"9c380e9f09fa6604de2f5625258d037d93779d494ec832ac8563f47878e93325","kind":"mutation-receipt","operation":"28dc3839d396546911669a14ed974a20231744898ec7599b846e60d9a755db07","options":{"section":null},"request_id_sha256":null,"results":["d-20260927-09"],"target":"decisions-ledger","v":1} -->

### d-20260927-10 — How does an ImportModal import replace its owning New Tab without writing the existing tab id before the metadata commit?

* **Question:** Should an import into the current New Tab replace the tree stored under the existing tab id in place, or admit the imported game under a fresh id that takes the owner's slot in one workspace write?
* **Governs:** f-20260910-09
* **Chosen:** A fresh tab id is seeded and put in the owner's slot in the tab list through the `d-20260910-10` staged-admission protocol (shared with `commitNewTab`). The owner id's durable tree, pending tree, cached store and atoms are never written before the commit; they are reclaimed with the tab-close cleanup only after the envelope write succeeds.
* **Rejected:** An existing-id transaction that snapshots the owner's durable tree, pending entry and cached store and restores all three on failure. It needs restore-on-failure across three stores and still has a window where the durable tree is already overwritten, which is the defect class itself.
* **Reason:** The owner is always a `"new"` tab and the tab id is internal; users see the same tab position, name and content. The fresh-id protocol is already proven under `d-20260910-10`. Reversal path: replace `replaceNewTab` in `src/utils/tabs.ts` with an in-place transaction if a future owner type needs its id preserved.
* **Decided by:** Claude Code (Opus 5.5), autonomously under full auto, plan-reviewed build run 2026-09-27 (plan planned ahead, 9 review rounds) · **Superseded-by:** -

### d-20260927-11 — What happens to an import whose requesting New Tab was closed, is closing, or was already replaced before the import finished?

* **Question:** When an async import resolves after its owning tab left the workspace (closed, in `closingTabsAtom`, or no longer of type `"new"`), is it discarded or opened somewhere else?
* **Governs:** f-20260910-09
* **Chosen:** It is discarded silently (`superseded`): nothing is written and no error is shown. Closing the requesting tab counts as the user's cancel.
* **Rejected:** Completing the import into a newly created tab, which would bring back a tab the user closed.
* **Reason:** The owner binding is the import's identity (`async-resource-invariants.md`: use a discriminator, never timing). While the owner is still open the modal cannot be dismissed with the import pending, so only the owner's own close or replacement can supersede it. Reversal path: open a new tab on `superseded` in `ImportModal`'s transaction helper.
* **Decided by:** Claude Code (Opus 5.5), autonomously under full auto, plan-reviewed build run 2026-09-27 (plan planned ahead, 9 review rounds) · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":17,"effect_sha256":"70f331bc6199b5801e4be3610bdf431dcdb70d916a836d7c455adc451df90937","input_sha256":"9f986b19ac8f434df6e6d1dd9c0485d25885172674eaf051c45bdc9604b611b1","kind":"mutation-receipt","operation":"19d9b1cea3eb88d592e12132ea80d73fe1dd50bf9636ade552d5e6caf0b185f4","options":{"section":null},"request_id_sha256":null,"results":["d-20260927-10","d-20260927-11"],"target":"decisions-ledger","v":1} -->

### d-20260927-12 — Does the f-20260910-09 import change raise the total bundle ceiling or cut its growth?

* **Question:** `pnpm bundle:check` measured 1,591,128 B total gzip against a 1,590,000 B ceiling after the owner-bound import change; is the ceiling raised or is the growth cut?
* **Governs:** f-20260910-09
* **Chosen:** Raise the total ceiling by 10,000 B to 1,600,000 B and record the 2026-09-27 measurement (entry 532,246 B, largest lazy 512,040 B, total 1,591,128 B) with its rationale in `docs/bundle-budgets.md`, as `f-20260923-01`, `f-20260906-23` and `f-20260924-03` did.
* **Rejected:** Dropping the `Import.UnsupportedGameUrl` message or the hostname check to fit. That would bring back the blank-board replacement of the New Tab on an unsupported or lookalike link.
* **Reason:** The base 6e686217 already measured 1,589,401 B (599 B headroom). This change adds 1,727 B: one message in 16 locale catalogues, the replacement transaction and the host check. It has no unused key and no dead chunk. Entry and largest-lazy stay under their unchanged caps. Reversal path: lower the total ceiling toward a later measurement (the ratchet direction, no rationale needed).
* **Decided by:** Claude Code (Opus 5.5), autonomously under full auto, build run 2026-09-27 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"4cc3ff5ac12be188db2ea52e649044ffac9005274904403e874616d5c54f3cbb","input_sha256":"7b943303325e4442210bfe86f51211898b0532d16278e92087bcafdcbae8bfe1","kind":"mutation-receipt","operation":"04b0f8799dee32ff208e18ffec88764ff50e208730063a224f6066c030cab06f","options":{"section":null},"request_id_sha256":null,"results":["d-20260927-12"],"target":"decisions-ledger","v":1} -->

### d-20260927-13 — Do the e2e launchers accept a pnpm `--` separator, or is only the separator-free form supported?

* **Question:** pnpm 10.34.5 keeps a caller's `--` and Playwright reads everything after it as file filters, so `pnpm test:e2e:update -- --project=x` ran the whole suite. Should the launchers strip that separator, refuse it, or only the docs change?
* **Governs:** f-20260910-07
* **Chosen:** Both package scripts (`test:e2e`, `test:e2e:container`/`test:e2e:update`) go through a launcher that drops the first `--` via the shared `playwrightArguments` in `scripts/run-e2e-container.mjs`; `test:e2e` now runs `scripts/run-e2e-native.mjs`, which starts Playwright's CLI module through Node. The docs name the separator-free form as canonical. `scripts/run-e2e-launchers-tests.mjs` drives both package scripts through pnpm in the contract gate.
* **Rejected:** Docs-only — the failure is silent, so a habitual `--` would widen a scoped snapshot update again. Refusing a `--` with an error — both spellings are ordinary pnpm usage and neither is ambiguous once the pnpm artefact is known. Leaving the native `test:e2e` on bare `playwright test` — measured to ignore even `--list` and run the suite.
* **Reason:** Commits 68707a9d, 503e6b2c, 2245cef7, 47ac0b10. Reversal path: make `playwrightArguments` refuse a `--` instead of dropping it; the launcher tests then need their pnpm invocations without the separator.
* **Decided by:** Claude Code (Opus 5.5), autonomously under full auto, drain lens-tier run 2026-09-27 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"4e22381fd2628405db7740ce7bdb90e8c3aef5389dc00db92fd622495a6fcc03","input_sha256":"6f27fbf6ccad5d8be9918e609b8611d5069067c512ba6a4512aa5ef0fdc5aa42","kind":"mutation-receipt","operation":"c11924a44c9c0b5a451558b243aa4d4e5c1b7e0b31d861e25532cc5d34cecf9b","options":{"section":null},"request_id_sha256":null,"results":["d-20260927-13"],"target":"decisions-ledger","v":1} -->

### d-20260927-14 — Unscoped engine Stop targets current work for the key

* **Question:** When a Stop has no expected generation and a live actor G1 plus a pending admission G2 share an engine key, which generations does it stop?
* **Governs:** f-20260911-02
* **Chosen:** Capture both generations at the unscoped Stop boundary, cancel the captured admission, and stop plus terminate a published actor only when its generation is captured. An explicit generation remains exact. A generation created after the capture survives the older Stop.
* **Rejected:** Pending-first selection leaves G1 running. Actor-only selection lets G2 restart an engine the user unloaded. Requiring every caller to send a generation leaves the EngineSelection unload action without a search owner and does not express its key-wide intent. Scanning all generations after awaits could stop a later, unrelated replacement.
* **Reason:** EngineSelection unloads by calling `stopEngine(engine, tab)` without a generation, while EvalListener passes its exact search owner. `stop_generation` previously selected G2 and returned `Ok` before stopping G1. The new supervisor tests cover both identities and exact stops; the capture boundary preserves later replacements. Reversal path: change the EngineSelection user contract and the supervisor stop target together, then replace the two-identity and replacement regression tests.
* **Decided by:** Codex, autonomously under full auto, 2026-09-27 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"21e174955dc077af183f4653679a99eaee6b7cd0237cb6f80a25ab17e6ed59ca","input_sha256":"c7e3bff9b4adeabc9c341fa4d099e015a3a9c008ecfdcff6f999dfe01e335f3d","kind":"mutation-receipt","operation":"9935ba8b714c81feb4238e8c22a977656246c3b8900924bfb2597f64ac9c4ffb","options":{"section":null},"request_id_sha256":null,"results":["d-20260927-14"],"target":"decisions-ledger","v":1} -->

### d-20260927-15 — Is `EngineDeadlines::stop` a wall-clock budget or a per-line stall detector?
* **Question:** `f-20260911-03`'s open question: is `deadlines.stop` a wall-clock budget from the stop, or a per-line stall detector that may run indefinitely while `info` keeps arriving? The same for `readyok`/`uciok` in `wait_for`.
* **Governs:** f-20260911-03
* **Chosen:** Wall-clock budget per exchange for `stop`, `readyok` and `uciok` inside `EngineRuntime`, one absolute deadline computed once and never reset by output; `deadlines.search` stays a per-line stall bound because an infinite `go` legitimately streams `info` forever.
* **Rejected:** A per-line stall detector plus a separate wall-clock cap (a second knob the wall clock subsumes); poisoning after N `info` lines without `bestmove` (not a time bound; depends on engine verbosity).
* **Reason:** UCI requires `bestmove` after `stop` and `readyok` after `isready` as soon as possible; no conforming engine needs output to extend the exchange, and the per-line form let a chatty engine hold `stop_current` and shutdown forever. Reversal path: restore per-line `timeout` in the shared read helper.
* **Decided by:** Claude Code (Opus 5.5), autonomously under full auto, drain plan-only run e436b468-2608-4d55-b3dc-7c04e10fde26, 2026-09-27 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":7,"effect_sha256":"b5bdc223abdd60ca70b4f52f51c273b787a92056676d709923ed74dffe94c7d7","input_sha256":"2f0e80c4631e7b6f8ec87d2c7ad1f6fe8184760f54811028e8747000ec948ad8","kind":"mutation-receipt","operation":"7d34090efad8a9bc24d26333a7ec5daea36298316b4ba4cd0c3462e0ade30e1f","options":{"section":null},"request_id_sha256":null,"results":["d-20260927-15"],"target":"decisions-ledger","v":1} -->

### d-20260927-16 — Does a UCI exchange deadline include its command write?
* **Question:** Does the wall-clock deadline of `stop_current`, `ensure_ready` and each `init_uci_cancellable` drain start before the command write (write and drain share it), or when the drain starts, with the write keeping `send`'s separate `deadlines.readyok` bound?
* **Governs:** f-20260911-03
* **Chosen:** `stop_current`: before the `stop` write, shared by write and drain (`send` gains a deadline form; plain `send` is that form with `now + deadlines.readyok`). `ensure_ready` and both `init_uci_cancellable` drains: deadline starts when the drain starts; the write keeps `send`'s bound.
* **Rejected:** Stop deadline after the write — a `Terminate` queued behind a stop then waits up to 20.2 s against `SHUTDOWN_BUDGET` 15 s instead of 10.2 s (plan Decisions has the trace). Write inclusion for readiness/init — it only shrinks the deferred silent-engine residual and newly fails an engine whose write takes 9 s and whose `readyok` arrives at 11 s.
* **Reason:** Removes the mandate's stated harm for stop without changing readiness behaviour beyond the per-line fix. Plan review rounds 1, 5 (focused judgment, stop), 9–10 (readiness). Reversal path: move the deadline computation relative to `send` at the call site.
* **Decided by:** Claude Code (Opus 5.5), autonomously under full auto, drain plan-only run e436b468-2608-4d55-b3dc-7c04e10fde26, 2026-09-27 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":7,"effect_sha256":"90306099688b6f58a7595e48d3d54956ba255ff47fd96ca305f545991ab8f4c5","input_sha256":"c2bca36fd2efebc94e83d1c744b8689d3460598393eb9326cc758b6a50da801b","kind":"mutation-receipt","operation":"66874ea6a52f3013cc508deeb0e8747ce47f59d2dd5dc3a9573d17ad9e38c9ee","options":{"section":null},"request_id_sha256":null,"results":["d-20260927-16"],"target":"decisions-ledger","v":1} -->

### d-20260927-17 — Where does the stop budget start when `stop_current` re-enters an already `Stopping` state?
* **Question:** When `stop_current` finds `EngineState::Stopping` (no second `stop` written), does it get a fresh budget or the remainder of the original one?
* **Governs:** f-20260911-03
* **Chosen:** A fresh full budget from entry.
* **Rejected:** Storing the original instant in `EngineState::Stopping`, which is `Copy + Eq` and compared by value in `service_search_read`.
* **Reason:** Re-entry is reachable only if a previous `stop_current` future was dropped mid-drain; every production caller awaits it inside the actor, so the worst case is one extra bounded budget. Reversal path: carry an `Instant` in the state and compare by `request_id` only.
* **Decided by:** Claude Code (Opus 5.5), autonomously under full auto, drain plan-only run e436b468-2608-4d55-b3dc-7c04e10fde26, 2026-09-27 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":7,"effect_sha256":"c43ff78d5cfa5282de0934dfe166c8cc57667c7e224c3c4422330dafbc70010e","input_sha256":"b09b1bb8d92a08830e1530e390818db6f93c9b130d64a2c38a4ffab57f3f4d0c","kind":"mutation-receipt","operation":"449e425b4728bf8f16abe5cf0cdd74fb7c17e81a3367f20186d20cc31a3b8e3c","options":{"section":null},"request_id_sha256":null,"results":["d-20260927-17"],"target":"decisions-ledger","v":1} -->

### d-20260927-18 — Is `collect_engine_configuration` brought under the write-inclusive exchange deadline?
* **Question:** The configuration probe writes `uci` under `send`'s bound and then wall-clocks the whole drain caller-side; is its write moved inside that timeout in `f-20260911-03`?
* **Governs:** f-20260911-03
* **Chosen:** No; the probe is unchanged. Its caller-side wall-clock timeout bounds the whole drain, so per-line resets in `next_configuration_line_cancellable` cannot extend it.
* **Rejected:** Moving `start_uci_configuration()` inside the timeout (plan-r3 O-5), judged a behaviour change the mandate does not require by five lenses.
* **Reason:** Not the mandate's defect; bounded by the sum of two budgets. Reversal path: wrap `start_uci_configuration()` in the existing timeout.
* **Decided by:** Claude Code (Opus 5.5), autonomously under full auto, drain plan-only run e436b468-2608-4d55-b3dc-7c04e10fde26, 2026-09-27 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":7,"effect_sha256":"c734deeae461b25cd04717caf8ca131aad27d11a1bfb107dba2f521d99236f7a","input_sha256":"b79bd1d4f9754ba459892109e202c7ab17aa59df52649e7ed1125244ab318779","kind":"mutation-receipt","operation":"9900457ed7b0de372955a4c8ed83b42b16979452e20ed0471faac34c027096b6","options":{"section":null},"request_id_sha256":null,"results":["d-20260927-18"],"target":"decisions-ledger","v":1} -->

### d-20260927-19 — How are the exchange-deadline tests made deterministic?
* **Question:** Real-time tests with slack, or paused Tokio time (needs the `test-util` feature `full` does not include)?
* **Governs:** f-20260911-03
* **Chosen:** Paused time; `tokio = { version = "1.33", features = ["test-util"] }` under `[dev-dependencies]` in `src-tauri/Cargo.toml`.
* **Rejected:** Real-time bounds with slack: cannot assert exact upper and lower bounds (deadline reuse, early firing, write inclusion) without flake margins.
* **Reason:** Measured 2026-09-27: `cargo metadata --locked --offline` on a copy of the manifest and lock exits 0 with `Cargo.lock` byte-identical and `tokio@1.50.0` gaining `test-util`. Reversal path: drop the dev-dependency line and rewrite the tests with real-time slack.
* **Decided by:** Claude Code (Opus 5.5), autonomously under full auto, drain plan-only run e436b468-2608-4d55-b3dc-7c04e10fde26, 2026-09-27 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":7,"effect_sha256":"b23da674d891e87eaba8c23aaf33e74700722ed2b106f776100a9b989a886702","input_sha256":"bc78afd372b766d8d660c51483aa00b1810459e380bbe4490ac1f21a11f71182","kind":"mutation-receipt","operation":"c4a897d2e2367d56721ae23de97b609c35773b08a4d55f95832ba3f50e82d5c5","options":{"section":null},"request_id_sha256":null,"results":["d-20260927-19"],"target":"decisions-ledger","v":1} -->

### d-20260927-20 — Does `f-20260911-03` also make termination preempt an in-flight engine exchange?
* **Question:** Should every exchange the actor loop services observe the actor's `interrupt` token so a queued `Terminate` preempts it?
* **Governs:** f-20260911-03
* **Chosen:** No; deferred to its own `build` finding (filed through the drain inbox 2026-09-27).
* **Rejected:** Folding it in (plan-r8 O-6): beyond the mandate for stop, and it raises its own design questions (StartSearch vs EnsureReady failure paths, `terminate` reporting success over an unconfirmed reap, preemption test ordering).
* **Reason:** The remaining readiness overrun (10 s + 5.2 s) exists at BASE for a silent engine, independent of the per-line reset. Reversal path: the deferred finding's own run.
* **Decided by:** Claude Code (Opus 5.5), autonomously under full auto, drain plan-only run e436b468-2608-4d55-b3dc-7c04e10fde26, 2026-09-27 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":7,"effect_sha256":"72086ae90227c40b7debf67360711745e4c18d5d37cc1e96b3337f2c7e273a8f","input_sha256":"37f6adb3c7d2e3502d6b2ac949eb37b09bc58cf499de6b28193ac3b00ff1c678","kind":"mutation-receipt","operation":"5efef2e321149fa9afa4f8968bfd7808387dca603a01862b6e38ff08a824755d","options":{"section":null},"request_id_sha256":null,"results":["d-20260927-20"],"target":"decisions-ledger","v":1} -->

### d-20260927-21 — How does the f-20260829-02 fix detect clipped content at 320px / 200%: a new `assertNoClippedContent` or the existing `assertNothingClipped`?

* **Question:** The 2026-08-31 fix specification for `f-20260829-02` calls for a new `assertNoClippedContent()` in `e2e/fixtures.ts`. Since then, `060654fc` added `assertNothingClipped(target)` (`e2e/fixtures.ts:54`) for the Files page, which checks the same `scrollWidth > clientWidth` class on ancestors and descendants. Should the fix add a second helper or extend that one?
* **Governs:** f-20260829-02
* **Chosen:** extend `assertNothingClipped` and route every caller through it (rule 11). Add the two capabilities the 2026-08-31 classification needs and it lacks: (1) flag content whose box starts left of the viewport or under the sidebar (`getBoundingClientRect().left < 0`), and (2) exempt an element that has an `overflow-x: auto|scroll` ancestor between itself and the clip, because a scrollable container is an accepted outcome under `d-20260831-16`/`-17`. Apply it to the whole page in the three 320px/200% specs (`settings-responsive`, `async-errors`, `security-consent`), next to the unchanged `assertNoHorizontalOverflow`. Keep the Files callers (`assertFilesColumnsNotClipped`) on the same helper. Then land the four layout causes in the finding's order. Re-record the moved 320px snapshots in the container under the `verify-ui` rule (`d-20260919-13`): container suite first, read each diff image, predict the moved set, and name every moved snapshot in the commit.
* **Rejected:** a second, separate `assertNoClippedContent` beside `assertNothingClipped`. That makes two near-identical instruments with diverging exemptions, which is the duplication rule 11 forbids.
* **Reason:** one instrument, one exemption set. The Files helper already carries the ellipsis exemption, and the layout findings keep meeting in the same 320px matrix (`f-20260910-06` → Files, `f-20260829-02` → Settings/Accounts/TopBar).
* **Decided by:** Claude Code (Opus 5.5), `/decide` session, 2026-09-27, confirmed by Felix in the chat · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"39779ded433e05a4f22c21d1092f3d3ec1f000b6491272eadc8ca8b5b61597f4","input_sha256":"a8ed2083704cdc664211fa3bd2f0624ecf0e4349ee5ea56283bc5e796fd9cc7c","kind":"mutation-receipt","operation":"47cd56c3a19d35716ddfd7cf0fad4ebcc2973f9d458e7dd457c6443797f474b7","options":{"section":null},"request_id_sha256":null,"results":["d-20260927-21"],"target":"decisions-ledger","v":1} -->

### d-20260927-22 — How is `mantine-flagpack` kept out of every route's static import closure: a manifest-graph assertion in `check-bundle-budget.mjs`, a lint rule, or nothing?

* **Question:** `4d025de9` moved `mantine-flagpack` (~242,000 gzip bytes) behind the dynamic edge in `src/components/databases/flagpack.ts`. Only the byte caps guard that placement, and they catch a regression only on the board route (512,040 of 550,000) and the entry (532,246 of 550,000). A lazy route under ~308,000 bytes could import the pack statically without the gate noticing. The finding proposed a new assertion over the Vite manifest graph, which put it under rule 6d (`felix-tooling-nod`).
* **Governs:** f-20260920-05
* **Chosen:** fix it with configuration, not code. Add `no-restricted-imports` to `.oxlintrc.json` with a `paths` entry for `mantine-flagpack`, `allowTypeImports: true`, and a message pointing to `src/components/databases/flagpack.ts`. The existing `pnpm lint` / `lint:ci` gate enforces it. Measured with oxlint 1.55.0 on 2026-09-27 in a scratch probe: `import { flags } from "mantine-flagpack"` and `export * from "mantine-flagpack"` are errors, while `import type { … }` and `() => import("mantine-flagpack")` pass. The sanctioned dynamic import therefore needs no override. The fix must prove the rule bites on the live tree: temporarily add a static import, show `pnpm lint` red, and revert. Afterwards, update `docs/bundle-budgets.md` to say which guard owns placement and which owns bytes.
* **Rejected:** (1) A manifest-graph assertion in `scripts/check-bundle-budget.mjs`. It is new executable checking code (rule 6d) where configuration suffices. It is also unsound as specified: the package has its own manifest record (`node_modules/.pnpm/mantine-flagpack@…/dist/esm/index.mjs`) only because it is a dynamic entry. A static import from a single route lets Rollup inline the pack into that route's chunk, so no manifest record names the package any more. Sound detection would need Rollup's per-chunk module list, not the manifest. (2) Not fixing. The byte cap protects only the board route and the entry. The same accident on any smaller route would go unseen.
* **Reason:** the lint rule states the invariant itself ("this package is reached only through a dynamic edge") at the source, before a build. The byte cap only happens to hold. The one remaining gap, a third-party dependency re-exporting the pack, is not realistic.
* **Decided by:** Claude Code (Opus 5.5), `/decide` session, 2026-09-27, recommendation chosen by Felix in the chat (option "Fix via lint rule") · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"86528c598ef7a6d96f60d53ea7e410430cf1262e4f9e29479e5779b80b1944a1","input_sha256":"bef56f38e756726be10f980ec10657300bd9ee9af768353bb8a70f24a991e564","kind":"mutation-receipt","operation":"9369d7b5cfbd3bdf69eceb96272da9c57739ea82672a1c65dc53900638b8e75a","options":{"section":null},"request_id_sha256":null,"results":["d-20260927-22"],"target":"decisions-ledger","v":1} -->

### d-20260927-23 — How is the coverage-baseline write authorized, so f-20260829-04 can land without Felix in the loop?

* **Question:** f-20260829-04 is blocked on `felix-baseline-deny-lifted`: its landing re-records `backend-coverage-baselines.json`, and the five `coverage:baseline:*` / `--write-baseline` entries in `.claude/settings.json` refuse that write. Keep the deny and lift it once for this finding, have Felix type the command, or replace the deny with a guard?
* **Governs:** f-20260829-04
* **Chosen:** move the guard into the writer and drop the deny. `scripts/coverage-report.mjs --write-baseline` refuses any per-area decrease of a covered count or a ratio against the committed baseline unless `--instrument-change <d-id>` names a recorded decision in `tasks/decisions.md` whose `Governs:` line names the finding being landed. It prints every per-area delta, and the commit message carries them. Upward refreshes still follow the `docs/coverage.md` procedure (green check first, CI artifact matched to the tree, no shrink allowance used). The five baseline deny entries are removed in the same commit that lands the guard, and `docs/coverage.md` and the repository `CLAUDE.md` are updated to match. The f-20260829-04 session then lands the exclusion and re-records the backend baseline with `--instrument-change d-20260902-02`.
* **Rejected:** a one-run lift for f-20260829-04 only, in the manner of `d-20260902-01`: the next baseline refresh in either direction needs Felix again. Felix typing the command at landing: the drain would sit in the shared checkout until he does, as it did in `f-20260920-06`, where the keystroke reviewed no number. Keeping the deny as it is: it binds only Claude Code (Codex and Grok never carried it), it blocks the safe upward direction as well as the dangerous downward one, and it has left the backend baseline unrefreshed since `57b7ec27` (2026-08-13). Measured 2026-09-27, the instrument reports app-infrastructure at 24595/27179 lines against a recorded 4137/6208, so today the backend ratchet binds nothing.
* **Reason:** the risk the deny existed for is an agent lowering a baseline to clear a red gate. A writer that refuses to lower without a named decision closes that risk for every agent and every spelling of the command, while the deny only stopped one spelling for one agent. Measured 2026-09-27 in a live Claude Code session: adding and removing a `permissions.deny` entry in `.claude/settings.json` takes effect in that same session (the removal after a few seconds), so the landing session can drop the deny and run the writer without a restart. Reversal path: restore the five deny entries.
* **Decided by:** Felix, in the chat, 2026-09-27, choosing "Guard in writer, drop deny" on Claude Code's recommendation · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"cef9db643ee528613c7433af70a04fe74bb2b5c3b3102b2b1f5d27b4c4a4e0a1","input_sha256":"39b08f5f3e2f683254ad66d85807f03714c6a89b3091384e176e65e43f11fb67","kind":"mutation-receipt","operation":"ea5bb7661bc8af9e93345e97f44c1819a09d267473146583986b9f0e41110153","options":{"section":null},"request_id_sha256":null,"results":["d-20260927-23"],"target":"decisions-ledger","v":1} -->

### d-20260927-24 — Which items does the `#[cfg(test)]` coverage exclusion remove: literal `#[cfg(test)]` only, or every item that is compiled only under `test`?

* **Question:** `d-20260830-12` chose to exclude every item carrying `#[cfg(test)]`. Is that literal attribute the right predicate?
* **Governs:** f-20260829-04
* **Chosen:** exclude every item whose `cfg` predicate is false whenever `test` is false, with all other configuration atoms left free. Concretely: evaluate the predicate three-valued, with `test` false and everything else unknown, and exclude only on a definite false. So `cfg(test)` and `cfg(all(test, …))` are excluded, while `cfg(any(test, X))`, `cfg(not(test))` and platform-only predicates are kept. The masking pass, the extension to non-`mod` items, and extending `scopeSignature` all stand as `d-20260830-12` recorded them.
* **Rejected:** the literal `#[cfg(test)]` rule alone. On 2026-09-27, `src-tauri/src` carries 466 `#[cfg(test)]` plus 222 `#[cfg(all(test, …))]` sites (195 of them `all(test, unix)`, which every `db/mod.rs` test module uses), all test-only. A rough scanner on the current LCOV measured database-search lines at 94.2 % under the literal rule and 86.8 % under this one. Rejected in the other direction: excluding `any(test, X)` items, which are production code on platform X.
* **Reason:** new evidence under the ledger's clause 2. `all(test, …)` guards grew after `d-20260830-12` was written, and the literal rule would leave most of one area's test code measured. Reversal path: none needed; the predicate strictly contains the prior one.
* **Decided by:** Claude Code (Opus 5.5), interactive `/decide`-style session, 2026-09-27 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"07a77ae380300a27a01141fe12ffe84d0cb48b3c7cb0a99f32b339299e55c9d5","input_sha256":"131c479c96ab67c3267a475dc5659b431f8cd5f93c5934076c4a8118eb85bad4","kind":"mutation-receipt","operation":"65d754339382b1775300e60fa992158fc7f72555df92ce03e55473cd04f7146f","options":{"section":null},"request_id_sha256":null,"results":["d-20260927-24"],"target":"decisions-ledger","v":1} -->

### d-20260927-25 — How does the credential store refuse a credential directory replaced while the application runs?

* **Question:** `f-20260912-01` — the retained `AuthorizedDir` keeps journalling into a detached credential directory, orphaning a keyring secret. Does `AuthorizedDir` gain an app-data parent descriptor plus an identity comparison, what does the add transaction do when a refusal lands between the `PendingAdd` journal and the keyring store, or is the orphan declared unsupported?
* **Governs:** f-20260912-01
* **Chosen:** compare the retained directory's identity with the **pathname a fresh startup resolves** (`AppDataDir` keeps its requested spelling solely to name it; `DefaultRootLocation` + `AuthorizedDir::resides_at`; `DefaultRootLocation::reacquire` repeats startup's resolution through `AppDataDir` acquisition and `ensure_app_owned_default_dir`). `CredentialManager` brackets every keyring write in one helper shared by add and re-authentication: a pre-check before the call's first write (refuse, nothing to compensate), and a final check after its last registry write on every exit once `set` was attempted (success, write-then-error, failed `Active` journal). A detached outcome — or a check error, fail closed — deletes the secret; if the delete fails, a `PendingDelete` tombstone is written at the startup location and verified there after the write, so the next `initialize` finishes it; any tombstone failure or an uncertain tombstone commit returns `CredentialRecoveryRequired`.
* **Rejected:** a retained app-data parent descriptor with `entry_identity_at` — misses a replaced app-data directory and a retargeted ancestor, because startup resolves by pathname. Declaring the replacement unsupported — the guard is writable (rule 4). A keyring-side handle index — a second source of truth for which accounts exist with no transaction across the two stores, and Windows Credential Manager's 2560-byte blob cap would impose a user-visible account limit. Rebinding the manager to the replacement directory — the in-memory registry would describe a directory it was not loaded from; restart reloads it. The check inside `persist_locked` — misses the re-authentication branch and does not bracket the keyring write. A pre-check only — a Secret Service `set` can block on an unlock prompt for an unbounded time.
* **Reason:** four of the finding's five measured obstacles dissolve once the pathname is taken as the ground truth: no parent descriptor is needed, the comparison lives in the module that owns `VerifiedIdentity`, `identity(path)` is cross-platform (and `entry_identity_at` has had a Windows implementation since), and bracketing plus compensation replaces atomicity. The fifth (check-then-write is not atomic) is closed by the final check after the last write. Six plan-review rounds converged on this; the review history is `tasks/handoffs/2026-09-27-f-20260912-01-review.md`.
* **Residual:** (1) the keyring `delete` and the verified tombstone write both failing inside one call — irreducible, because after `set` only a keyring delete or a startup-location write can track or remove the secret; reported as `CredentialRecoveryRequired`. (2) A directory copied and swapped in (same records, new inode) counts as detached, so the call deletes the secret it wrote — a lost login, never an orphan. (3) A rename after the final check carries the record with it, like moving the directory while the app is closed.
* **Decided by:** Claude Code, autonomously under `full auto`, drain session 62f4e00e-4f04-4250-974c-cf879f3e3768 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":9,"effect_sha256":"421b6cb1897d64d83b9ca8976d19d40cdfc2f396ae28914f5cb8e9684a4b17da","input_sha256":"0d02fa453ab5c0d6332c8736227ba428985481108c59e6b0f96513614cab9885","kind":"mutation-receipt","operation":"84bd01d434a0593dcc350a0c875a579838771c52bb79ff534fb14b5fbc921f80","options":{"section":null},"request_id_sha256":null,"results":["d-20260927-25"],"target":"decisions-ledger","v":1} -->

### d-20260927-26 — What does the page-wide clipping check count as lost content at 320px / 200%?

* **Question:** What does `assertNothingClipped(..., { scrollable: "reachable" })` (`assertPageNotClipped`) count as lost content, given that `d-20260831-16` accepts scrollable overflow and rejects silent clipping?
* **Governs:** f-20260829-02
* **Chosen:** on both axes, for visible boxes only (not `visibility: hidden`, no `opacity: 0` on the path — Mantine keeps an exiting Button loader at opacity 0 above its button): a clipping box (`hidden`/`clip`) counts only when visible content — text or a leaf box, never a parent's padding or margin, never what a nested non-visible container holds — passes its edge; a visible spill onto the page counts sideways only past the viewport and downwards only out of a fixed box; a box that starts before its container's content origin (or the document origin) counts, because scrolling reaches only right and down; a scroll container counts when it has under 1px of room on the overflowing axis (a list squeezed to 0px); the ellipsis exemption applies on x only. The default mode stays the Files columns' horizontal-only `scrollWidth` rule plus the left-edge check.
* **Rejected:** counting every `scrollWidth > clientWidth` box (what the helper did for Files): measured on this tree it reported Mantine internals that lose nothing — a Switch track label's 50px empty margin, a Button's exiting loader, a toggle's labels inside their own scroller — so a green page would have needed class allowlists. Also rejected: judging only scroll sizes, which misses left overflow and boxes positioned outside the viewport.
* **Reason:** every rule is pinned by a synthetic-page case in `e2e/settings-responsive.spec.ts`, and a per-rule mutation turned exactly its own cases red; on the pre-fix tree the check reported every clipped state the finding describes, and after the fix every 320px / 200% state is clean. Plan review (9 rounds, `tasks/handoffs/2026-09-27-f-20260829-02-review.md`) settled the rules; three were added during implementation with evidence (nested containers `558a12cd`, squeezed scrollers `64f220fd`, content = text and leaf boxes `1ae1f935`). Reversal path: narrow a rule in `e2e/fixtures.ts` and its case together.
* **Decided by:** build run 67d730aa (drain), 2026-09-27, f-20260829-02 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"2fa56014a0f3253203f81b178b996f5e1be96a9917fb764f61469b667a9d04a1","input_sha256":"bf5187d2b439b8e769744720a6ac8ed98fd5c0b7cba717bb967e31ee9ddf3fff","kind":"mutation-receipt","operation":"824acb13d77e8dc91fd9b8291db90f94a345dbbaa051865c979175d45a63c927","options":{"section":null},"request_id_sha256":null,"results":["d-20260927-26"],"target":"decisions-ledger","v":1} -->

### d-20260927-27 — How far may the f-20260829-02 layout fix change layouts outside 320px / 200%?

* **Question:** The 320px / 200% fix can only hook into what the page observes (the existing 50rem compact media query, rem sizes, container width). How far may it change layouts at other widths and scales?
* **Governs:** f-20260829-02
* **Chosen:** at 100% font scale, nothing that fits today may move: compact Settings padding is written as unscaled px equal to the 100% tokens (16/20px) in the CSS module (Mantine turns a "16px" style prop into scaled rem); controls get caps (`maxWidth: 100%`), wrapping (`wrap-anywhere`, `wrap-button`), ellipsis, or their own scroller, which act only on content that does not fit. Verified by byte-identical native screenshots of Settings (1280/700px) and Accounts (1440/700px) at 100%. Where content is cut today (e.g. the theme toggle at 320px / 100%) it becomes reachable instead. At font scales above 100% inside the compact branch, padding stays at the 100% values — root cause 1 applies there identically. Breakpoints stay as they are; the navbar rail stays 3rem.
* **Rejected:** a scale-aware Settings breakpoint and scale-aware `SimpleGrid` breakpoints (behaviour changes at other widths, outside the mandate — filed as their own finding); a narrower navbar rail (its icons are rem-sized; scaling the whole UI is what `d-20260831-16` chose); a vertical theme toggle (changes the 100% compact layout); `overflow: auto` on every compact control column (it clips 3px focus outlines).
* **Reason:** plan-review issue I28 recurred three times on this question and was closed by a focused review-plan judgment in round 7: the finding's own fix specification (2) names the compact branch, and the side-effect contract keeps 100% layouts intact. The one intended 100% change is the Databases error alert becoming visible (its list was a 0px scroll area at every width — a pre-existing defect in the same file). Reversal path: the CSS-module values and the two global classes in `src/styles/global.css`.
* **Decided by:** build run 67d730aa (drain), 2026-09-27, f-20260829-02 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"ce917f15db334ee0e2f4157e8c3aabdb564d1aca823aa05d9a9957c548a3c72c","input_sha256":"9a413e9b1316358d5356efe5684111d1bca0005fcddac92ebd976c0e60dadcb6","kind":"mutation-receipt","operation":"d4227ef1a76b42c5437b31eaf0423b7a048a6b382fe4970b88118730b9a1b0f9","options":{"section":null},"request_id_sha256":null,"results":["d-20260927-27"],"target":"decisions-ledger","v":1} -->

### d-20260927-28 — At 320px / 200%, is breaking a word mid-way an acceptable reflow for headings and button labels?

* **Question:** At 320px / 200% several single words are wider than their column ("Einstellungen", "Deine Datenbanken", "Hinzufügen" in a ~150px column). Is `overflow-wrap: anywhere` — breaking them mid-word ("Setting / s", "Hinz / ufüg / en") — an acceptable outcome?
* **Governs:** f-20260829-02
* **Chosen:** yes, through two shared global classes: `wrap-anywhere` for text and `wrap-button` for Mantine Buttons (label wraps; the button keeps its size while the label fits; side padding gives way below about six em of room; the root keeps Mantine's loader clip). The title-bar menu is the exception: it is a horizontal scroll strip, as the reviewed plan specifies, and its narrow-width discoverability is filed as its own finding.
* **Rejected:** ellipsis for headings and primary buttons (hides the words entirely instead of showing them broken); CSS hyphenation (`hyphens: auto` needs a hyphenation dictionary WebKitGTK and headless Chromium do not reliably ship); letting a short heading spill into padding while a long one breaks (no CSS expresses it — `overflow-wrap: break-word` keeps the full word as the minimum width, so "Einstellungen" would still push the document to 416px).
* **Reason:** `d-20260831-16` requires reflow or scroll, never a silent cut; at 10 root-em of width no layout fits, and a broken word is fully readable where a cut one is not. The English heading used to spill 12px into its padding and now breaks — recorded in `b6ee9941`. Reversal path: remove the class from a site, or add a narrow-width typography scale.
* **Decided by:** build run 67d730aa (drain), 2026-09-27, f-20260829-02 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"0c7f4d44da1aa7e2d942ec873ece814af5047ff6c3bad24d87cbcb0e786f030e","input_sha256":"9f3ff1854c9a4670c1cb19c9c4b1d7c6663bdaba1cc24361c626974277cf9e65","kind":"mutation-receipt","operation":"eab584d179a23ae6e2413bf090a128ab12829a624c7c0cf3f729baf7612d92f2","options":{"section":null},"request_id_sha256":null,"results":["d-20260927-28"],"target":"decisions-ledger","v":1} -->

## 2026-09-28 — recorded through the decisions lock

### d-20260928-01 — Where does the f-20260829-04 test-only exclusion run: in the exporter or in the coverage gate?

* **Question:** `d-20260902-02` chose to exclude test-only code and named `scripts/rust-branch-coverage.mjs` (the exporter) as the place the masking scanner lives. Does the filter run in the exporter, or in the gate (`scripts/coverage-report.mjs`) that reads the LCOV?
* **Governs:** f-20260829-04
* **Chosen:** the gate. A new `scripts/rust-test-only.mjs` computes the test-only line ranges and module files; `coverage-report.mjs` drops the records on those lines and removes the test-only files from the production-file set for a source carrying `excludeTestOnlyItems`. Everything else `d-20260902-02` chose stands unchanged: exclude test-only code, a masking scanner, the exclusion field in `backend-coverage-areas.json`, recomputed floors, the field in `scopeSignature`, one re-record. The re-record keeps passing `--instrument-change d-20260902-02`, as `d-20260927-23` names it; this decision carries that authority forward unchanged.
* **Rejected:** the exporter, as `d-20260902-02` and the finding named it.
* **Reason:** new evidence `d-20260902-02` did not consider. Three whole files are test-only modules (`db/allocation_probe.rs`, `db/test_support.rs` behind `#[cfg(all(test, unix))] mod …;`, `infra/test_hooks.rs` behind `#[cfg(test)] mod …;`, the last declared from `infra/mod.rs`, which the config excludes), so the gate's production-file set has to know the scan result anyway or its missing-data and blank-measurement checks fail. With the filter in the gate the exporter's LCOV stays the raw compiler output, so CI's existing green `backend-coverage` artifact on an identical `src-tauri` tree is valid input for the `d-20260829-02` re-record without pushing unreviewed code to a remote branch, and the raw artifact keeps its diagnostic value. Reversal path: call the filter from the exporter and share the whole-file set with the gate.
* **Decided by:** Claude Code (Opus 5.5), drain `full auto` build run for f-20260829-04, 2026-09-28 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"8a88935da1a2855d046cc8eaae365d2fbe003ecb640461e7a00140bfcd6ad29d","input_sha256":"c604c629c8c186c66391ebba470a547b663ec47184408466fdcd3135239599d4","kind":"mutation-receipt","operation":"4f95f3e72f43ddac87d1fe52dfbb6e45513225084bb466d32b30247594aac352","options":{"section":null},"request_id_sha256":null,"results":["d-20260928-01"],"target":"decisions-ledger","v":1} -->

### d-20260928-02 — How does the guarded baseline writer know "the finding being landed"?

* **Question:** `d-20260927-23` lets `--write-baseline` accept a decrease when `--instrument-change <d-id>` names a decision whose `Governs:` line names the finding being landed. How does the writer know which finding that is?
* **Governs:** f-20260829-04
* **Chosen:** a required `--finding <f-id>` next to `--instrument-change`; the writer checks that the decision's `Governs:` line names that id as a whole token (so `f-20260829-040` does not match `f-20260829-04`). Either flag alone, or either without `--write-baseline`, is a usage error. No further conditions (superseded status, finding existence) — `d-20260927-23` names exactly this one.
* **Rejected:** accepting any decision whose `Governs:` line is non-empty — it would let a decision about one finding authorize lowering a baseline for another.
* **Reason:** the recorded condition is about a specific finding, and the writer cannot infer it. Reversal path: drop `--finding` and accept any governed finding.
* **Decided by:** Claude Code (Opus 5.5), drain `full auto` build run for f-20260829-04, 2026-09-28 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"45723392f748fdbc13c393e162aedf650a616d8ffcd3a1d893c50ad22c7534c5","input_sha256":"40eb0ab086e28ce5b914f25135b6beea354e8714ccf27abdd6b0aea2b474f385","kind":"mutation-receipt","operation":"2310b945855a791713733d9e64453527bf829f275ca0b06216356d865dabe8f7","options":{"section":null},"request_id_sha256":null,"results":["d-20260928-02"],"target":"decisions-ledger","v":1} -->

### d-20260928-03 — How are the backend coverage floors re-derived after the test-only exclusion?

* **Question:** `d-20260902-02` requires the 18 backend floors to be recomputed on the corrected measurement. To which values?
* **Governs:** f-20260829-04
* **Chosen:** `minimumCoverage = floor(covered / total × 100)` per area and metric, computed from the gate's filtered report of the CI `backend-coverage` artifact used for the re-record — the calibration the previous floors already followed (4137/6208 = 66.6 % → 66). Raises and lowerings both land, each listed in the commit message.
* **Rejected:** leaving the unbroken floors where they were (the decision says "recomputed", and floors far below the measurement re-create the non-binding state the finding reports); floors several points below the measurement for headroom (the exact-count baseline and its shrink allowance already absorb record churn).
* **Reason:** one rule, the existing one, applied to the new scale. Reversal path: set floors by hand in `backend-coverage-areas.json`.
* **Decided by:** Claude Code (Opus 5.5), drain `full auto` build run for f-20260829-04, 2026-09-28 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"f396f4237730ef45f4990cf0211e6063ff374d0e313a5d571b732d8dfe212432","input_sha256":"7610fb4db3d79a8a1d1ac37f2438a00643e19a6be85b6c9c05974ba82f5bf66d","kind":"mutation-receipt","operation":"bbc357cbbacb9c2d94847692f02f94698a80d0a20396dc67ed9187c996baa948","options":{"section":null},"request_id_sha256":null,"results":["d-20260928-03"],"target":"decisions-ledger","v":1} -->

### d-20260928-04 — Which mechanism carries the `Path`-method pathname-reach convention the release-surface checker cannot type?

* **Question:** `f-20260912-03` — `Path::canonicalize`/`metadata`/`exists`/… are inherent methods a token checker cannot tell from descriptor receivers (`File::metadata`, `Metadata::is_file`). Name-based matching with a receiver marker, a typed lint, or a documented gap?
* **Governs:** f-20260912-03
* **Chosen:** `clippy::disallowed_methods` in a new `src-tauri/clippy.toml` over the ten `std::path::Path` pathname methods (`canonicalize`, `metadata`, `symlink_metadata`, `read_dir`, `read_link`, `exists`, `try_exists`, `is_file`, `is_dir`, `is_symlink`), enforced by the existing `cargo clippy --all-targets -- -D warnings` gate. `infra/` is exempt via an inner `allow` on `infra/mod.rs`, test builds via a crate-root `cfg_attr(test, allow)`, and the six existing `main.rs` reaches are pinned by statement-level `#[expect]` (owned by `f-20260927-07`). A new rule R5 on `check-rust-release-surface.mjs` keeps the lint from being switched off unseen: suppression containment over the measured suppressing lint names, a byte-exact `clippy.toml` pin, and the in-checkout routes enumerated in the plan's O4 (contract boundary: the repository checkout; machine state excluded). **Partially supersedes `d-20260901-02`** in its "Do not add `src-tauri/clippy.toml`" clause only; R3/R4 stay as that decision chose.
* **Rejected:** (a) name-based matching with a receiver marker — measured (typed probe, 2026-09-27) that `File::metadata`, `Metadata::is_file`/`is_dir` and `Path::is_dir` are identical tokens, and the `AccountRecord::metadata` false positive is why `d-20260901-03` dropped Path methods; (c) a documented gap — six live reaches were already uncounted, which is the mandate's failure mode; `dylint` — a custom lint crate and driver for a check clippy types natively.
* **Reason:** new evidence `d-20260901-02` did not have. Its "red crate-wide on 48 sites" is now 7 production sites, one inside `infra/` (typed probe on Linux GNU and Windows GNU). "Clippy cannot path-scope" is answered by the module-level `infra` allow plus R5 pinning where suppressions may live, and "`#[allow]` is a hole" by R5's suppression containment (measured suppressing set: `clippy::disallowed_methods`, `clippy::style`, `clippy::all`, `warnings`). Plan and 24-round review history: `tasks/handoffs/2026-09-28-f-20260912-03-review.md`. First reversal of this question. Reversal path: delete `src-tauri/clippy.toml`, the three attribute sites, and R5.
* **Decided by:** Claude Code (Opus 5.5), drain `full auto` build run for f-20260912-03 (session 9d43cbbb-75f9-492b-bd5b-9ce355c0c8fa), 2026-09-28 · **Superseded-by:** -

### d-20260928-05 — Migrate or pin the six uncounted `main.rs` `Path` reaches?

* **Question:** `SearchIndexIdentity::for_database` (five reaches) and `SearchCache::invalidate_entries` (one) canonicalise and stat by pathname outside `infra/`. Migrate them in the `f-20260912-03` run, or pin them?
* **Governs:** f-20260912-03, f-20260927-07
* **Chosen:** pin, each with its own statement-level `#[expect(clippy::disallowed_methods, reason = "f-20260927-07: …")]` on a `let` holding exactly that one reach, counted in R5's shrink-only per-function baseline. Migration is `f-20260927-07`.
* **Rejected:** migrating now (a db-search design question — descriptor-retained database target vs. a counted `infra` primitive — with its own TOCTOU neighbour `f-20260912-07`; different area, rule 4b); wrapping the calls in `infra` helpers (moves the reach without removing it and would be an uncounted R4-class primitive); one function-level `expect` (review showed a further reach inside the function would then be uncounted).
* **Reason:** `d-20260901-03` precedent (counted shrink-only baseline, emptying filed separately); `expect` self-shrinks (an unfulfilled expectation fails the gate). Reversal path: land `f-20260927-07` and delete the attributes and baseline entries.
* **Decided by:** Claude Code (Opus 5.5), drain `full auto` build run for f-20260912-03 (session 9d43cbbb-75f9-492b-bd5b-9ce355c0c8fa), 2026-09-28 · **Superseded-by:** -

### d-20260928-06 — Which classifier decides test-only (and gate-invisible) regions for the release-surface checker?

* **Question:** `check-rust-release-surface.mjs` has its own `isTestCfgAttribute` and line-shaped region tracker; since `7753f56e` the coverage gate has `scripts/rust-test-only.mjs`. Keep two, or one?
* **Governs:** f-20260912-03
* **Chosen:** one. `rust-test-only.mjs` gains a synchronous in-memory entry point whose evaluator takes an atom valuation; `scanRustTestOnly` routes through it; the checker's R2/R3/R4/R5 read their test-only flag from it, and R5's gate-invisibility (O3.12) runs it once per gate-configuration valuation. Scanner errors fail closed as `R5: unclassifiable cfg`.
* **Rejected:** keeping `walkGatedLines`' tracker plus a new brute-force evaluator (second copy; measured misclassification of production at `infra/path_authority/mod.rs:3325`); an async checker calling `scanRustTestOnly` unchanged (filesystem-only module resolution cannot serve the checker's in-memory fixtures).
* **Reason:** rule 11. Measured at `5ae54607` over 47 files: the scanner is exact on 731 lines where the old walker differs and raises no error. Reversal path: restore `isTestCfgAttribute` in the checker.
* **Decided by:** Claude Code (Opus 5.5), drain `full auto` build run for f-20260912-03 (session 9d43cbbb-75f9-492b-bd5b-9ce355c0c8fa), 2026-09-28 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":26,"effect_sha256":"1b25f8547ba7fdf059facebea35e482a0af34361c08289bc7294050866fcfec2","input_sha256":"0f001bc9ebc7054b6e040bc6edebad79d1199f12f7cb2ca3aebf0cb809c75ad1","kind":"mutation-receipt","operation":"8fb1e85fe4d383c1f2b03bb4646839473a34864b24f2c19ac1238ef9513949c5","options":{"section":null},"request_id_sha256":null,"results":["d-20260928-04","d-20260928-05","d-20260928-06"],"target":"decisions-ledger","v":1} -->

## 2026-09-29 — recorded through the decisions lock

### d-20260929-01 — How is a persisted file entry bound to the directory it was authorized in, and what happens when that directory's identity changes?

* **Question:** `f-20260912-05` asked whether `StoredEntry` should carry the parent directory's identity and what that does to registrations whose parent legitimately changes identity (a moved or restored directory) — refuse, re-register through the dialog, or accept with a warning.
* **Governs:** f-20260912-05
* **Chosen:** `StoredEntry.parent_identity: Option<Identity>` (serde default, skipped when `None`; schema stays 1), recorded for file entries only, always from the descriptor that observed or created the leaf — never from a pathname reopen. Every registry resolution of a stored file entry (`resolve()` over `persistent` and `retired_attachments`, `database_file_target`, `retained_workspace_target`, `workspace_entry_path`) refuses a different parent with the leaf-mismatch `Conflict`, and refuses `None` (fail closed). Legacy entries are upgraded once at startup (trust on first use) in the pass that already rebinds legacy spellings, including canonical entries. A changed parent is **refused**; recovery depends on the door: passive listings (workspace children, database and puzzle children) mint a fresh id and leave the old id refused; explicit user picks (`promote_dialog`, `get_or_create_persistent_file*`: native engine picker, opening book, engine install, engine image) rebind the existing id to the newly verified parent. Children sitting directly in a registered root get no new recovery: their parent is the root, whose own identity check already refuses a replacement by design.
* **Rejected:** accept with a warning (the legitimate and the attack state are indistinguishable from inside the process); a new re-register dialog (the existing doors already cover it, and a copied or restored directory changes the leaf inode too, so the leaf check refuses it today); keeping legacy entries non-authorizing until explicit re-registration (a dialog re-pick selects by pathname and authorizes whatever parent is present then — no stronger guarantee than the startup upgrade, while every existing registration would become unavailable); upgrade-on-resolution (a registry write inside the read path `resolve()`); `Conflict` at explicit doors on a parent mismatch (the stale entry would block every re-pick, since those doors dedupe by path); binding directory entries too (a directory cannot be hard-linked; outside the finding).
* **Reason:** parent identity is treated as part of the object binding exactly like the leaf identity, so the existing refusal and recovery behaviour extends without new UX. Residual: an entry whose parent was already swapped before the first startup with this change is adopted by the upgrade; a failed upgrade commit repeats the trust-on-first-use at the next startup (same precedent as the spelling rebinding). Reversal path: drop the field (old registries ignore it) and remove the checks.
* **Decided by:** Claude Code (Opus 5.5), drain `full auto` build run for f-20260912-05 (session 6f9c4b3e-8255-48b2-82b2-497c962dd7df), 2026-09-28; plan review record `tasks/handoffs/2026-09-28-registry-parent-identity-review.md` · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"f08b23435491b425ee3183f59aa03af8c31fb19f6461dbd7cc24222ac683aeaf","input_sha256":"f122edd11c02ff446d47368a4afa2b9b1cddb443eacaff2a80253fb102736006","kind":"mutation-receipt","operation":"53f7db818c1b46eb0b512f93b17da61fe2c647cc1a2a0a0bfe4bbce4405206e5","options":{"section":null},"request_id_sha256":null,"results":["d-20260929-01"],"target":"decisions-ledger","v":1} -->

### d-20260929-02 — Must the search-index loader re-validate the database after it opens the sidecar?

* **Question:** `f-20260912-07` asked whether `load_search_index_cancellable` should re-probe the database after opening the sidecar, bind the sidecar's acceptance to a retained database descriptor, or accept and document the window between the identity probe and the sidecar open.
* **Governs:** f-20260912-07
* **Chosen:** no re-validation; the invariant is stated at the loader and pinned. The identity probe is the loader's linearization point: `probe_schema` opens the database through `DatabaseFileTarget::open_current` and refuses every inode but the authority-bound one, the sidecar is opened relative to the retained parent, it is accepted only when its archived `IndexSource` equals the identity probed by the same call, and every caller probes again before any cached index or result is reused. An accepted index therefore always describes a state the authorized database had during the call; a replacement or in-place change after the probe is concurrent with that call and is seen by the next one. Test `a_loaded_index_is_not_served_after_the_database_changes_in_place` pins the cross-call half (it goes red when the source comparison is dropped).
* **Rejected:** (a) a re-probe after the sidecar open — it only moves the linearization instant and still cannot stop a multi-second scan answering for the pre-change state, while suggesting a guarantee it does not give; (b) retaining a database descriptor for acceptance — the probe already reads identity from the descriptor it opens, so nothing new would be bound; filing it as a residual — it is not a defect, since no object reached by pathname contributes index data.
* **Reason:** a read that returns the state of the authorized object at one instant inside the call is correct; the TOCTOU class this was compared with (the repository's pathname open) is about *which* object is opened, and here the object is fixed by the probe's identity check. The remaining pathname hop inside the probe (`read_revision` opens SQLite by pathname between descriptor probes) is the repository-wide SQLite pathname hop: `review-pgn-index` showed an A-B-A leaf swap during each revision read can mix A's stat with B's revision, and `f-20260929-01` (scope extended 2026-09-29) owns closing it for the probe and the pool with one mechanism. Reversal path: add a post-open `database_identity_expected` comparison in `open_valid_preferred`'s callers if a future consumer needs the result to be current at return rather than at probe.
* **Decided by:** Claude Code (Opus 5.5), drain `full auto` next-finding run for f-20260912-07 (session 5d187aed-1901-4267-acdd-3c717d2f3c2a), 2026-09-29 · **Superseded-by:** d-20260929-03
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"0a24f72767edc6b67a7e8e623dd13d0f49fd85a5b9fda9bed556217f7a06d550","input_sha256":"c9d1fdeda27e4fa4cff07823e1fa57f06d18f70c394cecedfdb0aeacba6070c4","kind":"mutation-receipt","operation":"e6829ef1a56467a810b7e3673663d6b16b602ffa741fcbb371dfae1a2e7c227a","options":{"section":null},"request_id_sha256":null,"results":["d-20260929-02"],"target":"decisions-ledger","v":1} -->

### d-20260929-03 — Must the search-index loader re-validate the database after it opens the sidecar? (corrected)

* **Question:** `f-20260912-07` asked whether `load_search_index_cancellable` should re-probe the database after opening the sidecar, bind the sidecar's acceptance to a retained database descriptor, or accept and document the window. `d-20260929-02` answered "no re-validation, not a loader defect"; the push review of that change (six Codex lenses, confidence 95–97, all REVISE) showed its premise — that the probe observes one object — is false today.
* **Governs:** f-20260912-07
* **Chosen:** no post-open re-probe in the loader, and `f-20260912-07` stays **open** under the shared root `sqlite-pathname-open` with `f-20260929-01`. The loader's design (sidecar opened fd-relative, accepted only against this call's probe, every call re-probing before cache reuse) is kept and documented at the loader, and `a_loaded_index_is_not_served_after_the_database_changes_in_place` pins the cross-call half. The remaining defect is upstream of the loader: `identity_from_probe` takes object/length/mtime from the authority-bound descriptor (`probe_schema` → `open_current`) but the revision from `read_revision`'s SQLite pathname open, and generation reads its rows through the pathname-opened pool, so an A→B→A leaf swap can archive B's rows under a mixed identity that a later probe of A matches. The fix is to make SQLite read the authorized leaf, which is `f-20260929-01`'s open question; both findings close together.
* **Rejected:** a post-open re-probe (it reads the revision through the same pathname hop, so it neither closes the A-B-A case nor adds a guarantee for a single object); closing `f-20260912-07` as "not a defect" (`d-20260929-02`'s claim, refuted by the lens evidence above); fixing the SQLite hop inside this run (it is the same-area open design question — `/proc/self/fd` naming breaks WAL sidecar derivation, the Windows analogue is unmeasured, and `f-20260905-03` already rejected a pathname adapter — so it belongs to a `build` run with plan review, not to a lens-tier slice).
* **Reason:** new evidence (the push-review lenses) that `d-20260929-02` did not consider — it named the pathname revision read only as a neighbour's residual and missed that generation archives pathname-read rows under the probed identity. Reversal path: if the SQLite binding lands and the probe reads one object, the loader needs no further change and `f-20260912-07` closes with it.
* **Decided by:** Claude Code (Opus 5.5), drain `full auto` next-finding run for f-20260912-07 (session 5d187aed-1901-4267-acdd-3c717d2f3c2a), 2026-09-29; push-review lens reports `/tmp/f07-push/lens-*.txt` · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"f1a39c429941ebf98891fa63962cef76b3e93204dadd2beeaf277d02e5e00306","input_sha256":"013a24771640fc12f71fe88ab5665981b6ed2a2343473f856315bbfb1f0e5c44","kind":"mutation-receipt","operation":"10b7261637d32d57ee28ab37334b4bd0b8dbf7265c6f2aa26b9a7bc88dce8469","options":{"section":null},"request_id_sha256":null,"results":["d-20260929-03"],"target":"decisions-ledger","v":1} -->

### d-20260929-04 — How does every SQLite open of an authorized database read the authorized leaf in its authorized parent?

* **Question:** `f-20260929-01` and `f-20260912-07` asked how the repository pool and the identity probe's revision read make SQLite inherit the authority-bound object — its retained parent directory for `-wal`/`-shm`/`-journal`, and the authority-bound leaf inode — instead of whatever the pathname names at open time.
* **Governs:** f-20260929-01, f-20260912-07
* **Chosen:** a bound SQLite VFS per database binding plus hooks in SQLite's syscall tables (`src-tauri/src/db/bound_sqlite.rs`). SQLite is opened by a reserved name `/<chessfable-bound>/<token>/<leaf>` (root-owned on unix, illegal characters on Windows, so no real file can live there); load-time (`ctor`) hooks on the unix table (`open`, `stat`, `access`, `unlink`) and the win32 table (`CreateFileW`, `DeleteFileW`, `GetFileAttributes[Ex]W`) resolve that name relative to a dup of the retained parent descriptor, never follow links, and refuse a leaf whose identity is not the authority-bound one (checked before and after the open, and on `stat`, so SQLite's `findReusableFd` cannot reuse a descriptor of another inode). Each binding registers its own VFS whose `xOpen`/`xAccess`/`xDelete` accept only its own names, answer `xAccess` for them itself (an identity mismatch is an I/O error, never "absent"), and refuse super-journal opens; one binding per (leaf identity, parent identity, leaf name), shared by the pool and concurrent revision reads so Windows sees one `-shm` name; the binding lives until its last connection closes. Pool and revision-read open failures are classified `Conflict` through the binding's refusal counter or the authority probe.
* **Rejected:** `/proc/self/fd/<parent>/<leaf>` naming (measured: SQLite 3.39.2's `unixFullPathname` resolves the magic link back to the directory's pathname; Linux-only); `/proc/self/fd/<leaf>` (breaks WAL name derivation); an `xOpen`-only shim (SQLite opens `-shm` through `osOpen`, not `xOpen`); a post-open re-probe (`d-20260929-03`); a private snapshot (the pool is read-write on large databases); one shared VFS (cannot tell a connection's own sidecars from another binding's, so a hostile hot journal naming another binding's absent `-wal` as super-journal would skip rollback); identity checks that open and close the leaf (closing any descriptor on the file drops the process's POSIX locks).
* **Reason:** the syscall table is SQLite's only public seam that reaches every sidecar open, and checking the identity on the descriptor SQLite will use is what the earlier pathname adapter (`f-20260905-03`) could not do. Measured in a disposable probe on Linux (sidecars stay in the held directory across two parent renames, a swapped leaf is refused, unprefixed paths untouched); witnesses in `repository::bound_sqlite_witnesses` go red with the pathname open restored. Plan review record: `tasks/handoffs/2026-09-29-sqlite-pathname-open-review.md`. Reversal path: return the pool and `read_revision` to a pathname URI and remove `db::bound_sqlite` and the `ctor` dependency.
* **Decided by:** Claude Code (Opus 5.5), drain `full auto` build run for the `sqlite-pathname-open` cluster (session 1af0f1fc-ab06-4981-9a3d-47a89d71c541), 2026-09-29 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"625a2a19fd6811cf55fd318deef2cf96fc55a892ade17c6aefe4d91222947e78","input_sha256":"6a3140cb26dafaa2199c1891f41f16511c3cf137a45997e4df029b6577a05cb4","kind":"mutation-receipt","operation":"774f6f22a529b5db2eb4f4bc6a582b4a5c2b7691ccade3c0b15eed6f8ca7e802","options":{"section":null},"request_id_sha256":null,"results":["d-20260929-04"],"target":"decisions-ledger","v":1} -->

### d-20260929-05 — What happens when one database inode is authorized under two directories and both are opened at once?

* **Question:** with SQLite bound to the authorized parent (`d-20260929-04`), two authorized targets naming one inode from different directories (hard links) would each get a binding, while SQLite's unix VFS shares the per-inode record and `-shm` node by (dev, ino).
* **Governs:** f-20260929-01
* **Chosen:** acquiring a binding for an inode that already has a live binding under a different parent identity fails with `Conflict("database is open through another directory")` until the first binding's holders are gone. Two hard-link names in the same directory keep separate bindings; Windows case variants of one directory entry share one.
* **Rejected:** separate bindings across directories (the second connection would read the first directory's `-shm` from outside its own parent); sharing the first binding across directories (the second target would use another directory's sidecars and ignore a `-wal` left in its own); one binding for same-directory hard-link names (deleting the binding's name would break the surviving alias).
* **Reason:** SQLite documents multiple links to one database file as a corruption hazard; refusing the concurrent cross-directory case is fail-closed and only reachable when a user registered one file through two hard-linked folders. The same-directory hazard is pre-existing SQLite behaviour and filed separately (inbox `20260929-111342-2397783-1790673222462378910-3`). Reversal path: key bindings by (parent identity, leaf identity, leaf name) only and accept the shared-`-shm` hazard.
* **Decided by:** Claude Code (Opus 5.5), drain `full auto` build run for the `sqlite-pathname-open` cluster (session 1af0f1fc-ab06-4981-9a3d-47a89d71c541), 2026-09-29 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"fc2b2640e47cce58e60f8eac609e1ce8681b5ab5aa0de985b65265382a2062c6","input_sha256":"8ea907929d49eb99e5bd015330c1aa3807161e79cb45de6484dedd1dcd786026","kind":"mutation-receipt","operation":"c3f8225cfc8cfb8c9afd89cb114c9853404065e466d58297262358720554ce9a","options":{"section":null},"request_id_sha256":null,"results":["d-20260929-05"],"target":"decisions-ledger","v":1} -->

## 2026-09-30 — recorded through the decisions lock

### d-20260930-01 — Should the push gate run the Rust tests once, with coverage, instead of twice?

* **Question:** Should the push gate run the Rust tests once, with coverage, instead of twice?
* **Governs:** -
* **Chosen:** keep both runs — `pnpm gate:ensure backend-test` (stable toolchain, the one that ships) and `pnpm gate:ensure backend-coverage` (pinned `nightly-2025-06-01`, only for branch coverage) — as two concurrent lanes (`rust-test`, `rust-coverage`) of `pnpm gates:push`. They use different toolchains and target directories (`llvm-cov-target`), so running them side by side costs no wall time.
* **Rejected:** dropping the stable run (the AgentKit audit's suggestion). CI's Linux job runs only the nightly coverage run (`.github/workflows/test.yml`), and stable tests run in CI only on macOS and Windows, so the local stable run is the only Linux stable-toolchain test execution anywhere.
* **Reason:** measured 2026-09-29 on atlas: backend-test 32.8 s, backend-coverage 38.5 s serially; concurrent in P2 the pair costs the longer of the two. Plan-review issue PG-43 (Skip, upheld). Reversal path: if CI gains a Linux stable test job, the local stable lane can go.
* **Review:** `tasks/handoffs/2026-09-30-push-gate-parallelism-review.md`
* **Decided by:** Claude Code (Opus 5.5), build run for the push-gate parallelism plan (session a3a230ef-7b5b-4be0-82ec-2e5fb8953292), 2026-09-30 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":9,"effect_sha256":"a18f19266af92692856a2d7c88e60f5119c47144af440be0f2885f71bdadb4a2","input_sha256":"70691212437c90c0acb66da637cec1e02ae902ce4e4c444b9833d9ecc71dd48b","kind":"mutation-receipt","operation":"030d137179e2b2d0239624029687dae3e6ecd23e5198b73408ab48cde8db4387","options":{"section":null},"request_id_sha256":null,"results":["d-20260930-01"],"target":"decisions-ledger","v":1} -->

### d-20260930-02 — Which Rust type-check steps do the push skill and CI run, now that clippy covers cargo check?

* **Question:** Which Rust type-check steps do the push skill and CI run, now that clippy covers cargo check?
* **Governs:** f-20260830-06
* **Chosen:** no `cargo check` step anywhere: the push skill's Rust block runs `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --locked -- -D warnings`, and `.github/workflows/test.yml` keeps only the clippy step in the `rust-platform` matrix and in the Linux job. `scripts/check-tool-version-parity.mjs` rule `(5a)` is inverted: `rust-platform` and the Linux job must not contain a `cargo check` (any shell segment, including `cd … && cargo check` and `cargo +toolchain check`), `(5b)` still requires the exact clippy step. Everything else `d-20260914-08` chose stands unchanged: `rust-platform` on real runners for `aarch64-apple-darwin`, `x86_64-apple-darwin` and `x86_64-pc-windows-msvc`, `rust-macos-test` running the whole routed Rust suite, no `if:`/`continue-on-error`, and the parity checker's target-coverage contract.
* **Rejected:** keeping `cargo check` beside clippy (a strict subset of clippy `--all-targets`, paid twice per platform); dropping the step without inverting `(5a)` (nothing would stop it from returning).
* **Supersedes:** d-20260914-08, as to its `cargo check` step only. New evidence: a rule-12b probe on 2026-09-30 — in a throwaway worktree with `mkdir -p dist`, a type error inside the `#[cfg(test)]` fn `set_test_lexer_hook` (`src-tauri/src/lexer.rs`) made the clippy command exit 101 with `E0308`, and exit 0 without it.
* **Reason:** the mandate removes unjustified gate work; clippy `--all-targets` type-checks every target, so the separate check proves nothing clippy does not.
* **Review:** `tasks/handoffs/2026-09-30-push-gate-parallelism-review.md`
* **Decided by:** Claude Code (Opus 5.5), build run for the push-gate parallelism plan (session a3a230ef-7b5b-4be0-82ec-2e5fb8953292), 2026-09-30 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":10,"effect_sha256":"95d4e065fcb8caf04064e5f8c8b7d8726c3f3d7c4e55c394415fb556357d7a30","input_sha256":"9c3941ad2107575b008a9976649b74437f95937cfb0ffa6be8256d58538a83b5","kind":"mutation-receipt","operation":"3a0259226a21054b7c1fab87d1b10ac72ababe217c39c4edcf0102045cbbb2c7","options":{"section":null},"request_id_sha256":null,"results":["d-20260930-02"],"target":"decisions-ledger","v":1} -->

### d-20260930-03 — How do gate tools choose their worker counts inside an 8 GiB agent scope?

* **Question:** How do gate tools choose their worker counts inside an 8 GiB agent scope?
* **Governs:** -
* **Chosen:** from the memory budget, never from the core count alone. `scripts/gate-parallelism.mjs` reads the smallest cgroup-v2 `memory.max` on the process's path (bounded by physical memory; a detection failure on Linux is an error that names `GATE_MEMORY_BYTES`, never a silent fall-back to physical RAM), subtracts `AGENT_RESERVE_BYTES` (1 GiB), and caps workers at `GATE_CPU_SHARE` of the CPUs. Vitest: `VITEST_WORKER_BYTES` 256 MiB and `VITEST_BASE_BYTES` 1.5 GiB (measured ~173 MiB per worker, ~1.20 GiB base; 22 workers at 7 GiB). Stryker: `STRYKER_RUNNER_BYTES` 1.2 GiB and `STRYKER_PARENT_BYTES` 640 MiB; the frontend mutation runner admits the number of concurrent packages (1..3) that maximises total runners, ties to more packages — one package of five runners at the 7 GiB agent budget, three packages of eight on an unconfined 24-core host. Playwright: 6 workers, `fullyParallel: true` (the container runs outside the agent scope).
* **Rejected:** worker counts from the core count (the audit's "about 18 Stryker workers": at 12, 18 and 23 runners the kernel OOM-killed Stryker's children 275 times in the 8 GiB scope on 2026-09-29); the plan's per-slot formula `min(3, cpu, floor(budget / (parent + runner)))`, which with the measured runner size admits three one-runner packages at 7 GiB, fewer runners than one package with five; bounding runner growth with `maxTestRunnerReuse` (40 still reached 6.53 GiB at eight runners).
* **Reason:** measured 2026-09-30 in the 8 GiB scope by per-process RSS sampling: a Stryker runner peaks at 0.80-1.13 GiB and grows during a run (tree-path 4.98 GiB above idle at four runners, workspace-storage 7.04 GiB at eight, game-practice 5.44 GiB at eight); the parent 0.34-0.39 GiB plus a 0.11 GiB helper. After the change `pnpm mutation:frontend` ran with 0 OOM kills and a 5.10 GiB peak. The earlier 640 MiB figure came from runners killed before they had grown. Reversal path: re-measure and change the named constants; the slot rule reads them.
* **Review:** `tasks/handoffs/2026-09-30-push-gate-parallelism-review.md`
* **Decided by:** Claude Code (Opus 5.5), build run for the push-gate parallelism plan (session a3a230ef-7b5b-4be0-82ec-2e5fb8953292), 2026-09-30 · **Superseded-by:** d-20261001-01
<!-- ledger-meta {"command":"record-decision","effect_lines":9,"effect_sha256":"161ce65c00d523e7f1834758c29631a45a111390734c0a3f41544fd61441eb73","input_sha256":"7b0c07844af26a0efa32ad6a3dd1907f08e95650c2fb7468d4898ae8a95f0001","kind":"mutation-receipt","operation":"59c69724f0856a3751e78910ac2c7b717954840836328ef32e3a4673efaa51c0","options":{"section":null},"request_id_sha256":null,"results":["d-20260930-03"],"target":"decisions-ledger","v":1} -->

### d-20260930-04 — In what order and with what concurrency does the push gate run?

* **Question:** In what order and with what concurrency does the push gate run?
* **Governs:** -
* **Chosen:** `pnpm gates:push -- [--rust] [--frontend] [--bindings]` (`scripts/run-push-gates.mjs`), with the push skill's path map choosing the flags and no flags meaning the contract-only run. P0 serial: the mutation guard (its failure stops everything), then `bash scripts/setup-rust.sh` for Rust or bindings (its failure skips only its Rust consumers). P1 serial: `pnpm gate:run frontend-build` for every `dist/` consumer (including Rust-only and bindings-only runs), then `pnpm bindings:check`. P2 concurrent lanes: contract (plus `findings:kit:check`), rust-lint, rust-test, rust-coverage, frontend-coverage, bundle. `e2e` starts after bundle and every cargo lane; `frontend-mutation` joins P2 only on a budget of at least `ONE_WAVE_BYTES` (40 GiB) and two CPUs, and otherwise runs last with the whole budget. `after` orders without skipping, every lane runs to completion, and the exit code is the P0/P1 failure's, else the first failed lane's in table order. Memory shares: frontend-coverage gets `P2_VITEST_SHARE` (0.5) whenever cargo lanes or a concurrent mutation run beside it, mutation `P2_MUTATION_SHARE` (0.35) when concurrent.
* **Rejected:** keeping the serial chain (the 2026-09-19 fix made receipt gates safe side by side, measured 2026-09-29: four receipt gates concurrently, all receipts recorded, 6.06 GB peak); running `vite build` or e2e beside a cargo lane (`dist/` is a compile input through `frontendDist`, measured: a no-op `cargo check` re-checked the crate after `pnpm build-vite`); `gate:ensure frontend-build` (the receipt fingerprints tracked files, while `dist/` is ignored); `bindings:check` beside receipt gates (a conditional rewriter of `src/bindings/generated.ts`, f-20260906-06); prose instructing agents to start shells concurrently (the budget must be divided between lanes, and every agent must behave identically).
* **Reason:** the mandate asks for independent gate steps concurrently within the 8 GiB agent scope, and the two ordering constraints above are measured, not assumed. `lint:ci`'s `i18next-cli extract --ci` is a conditional rewriter measured read-only on a green tree (2026-09-30), so the contract lane may run beside receipts; a stale tree makes the run red regardless. Reversal path: the schedule is one exported table that the routing checker pins against the skill in both directions.
* **Review:** `tasks/handoffs/2026-09-30-push-gate-parallelism-review.md`
* **Decided by:** Claude Code (Opus 5.5), build run for the push-gate parallelism plan (session a3a230ef-7b5b-4be0-82ec-2e5fb8953292), 2026-09-30 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":9,"effect_sha256":"bb3dd914362c9da1842149b864e35635c041fb63e6a34d9451668748151f420d","input_sha256":"6b4c4b24739b6e4861d724c74ce12f636635858c79f8a3114e456f917ece90ce","kind":"mutation-receipt","operation":"f4eae0fa524803b8b0ef43e4a3440ed7e55253b3263efd258425c036e3c369ad","options":{"section":null},"request_id_sha256":null,"results":["d-20260930-04"],"target":"decisions-ledger","v":1} -->

### d-20260930-05 — How is splitting a Vitest suite across files proven to be a pure move?

* **Question:** How is splitting a Vitest suite across files proven to be a pure move?
* **Governs:** -
* **Chosen:** a one-off proof (not a committed script) that parses the old file at its base commit and the new files plus the shared fixture with the repository's @babel/core parser and compares (describe title path, normalised source) pairs, where each path segment carries the describe callee and non-body arguments: top-level statements and every test registration with its nested statements as MULTISETS (imports excluded, `export` modifiers of moved helpers normalised away), and describe-scope non-test statements (declarations, hooks) as a SET per title path, because every file of a suite split across files must repeat the suite's describe-level declarations it uses. The split itself is generated from AST byte slices, never re-typed. Applied to `scripts/check-rust-release-surface.test.mjs` (b3dd9659): identical, 286 tests before and after.
* **Rejected:** a multiset for describe-scope declarations too (the plan's first wording; it cannot pass for a suite split over several files); equal test counts alone (PG-13: a count cannot see a changed assertion); a hand-made split (the first leaf misplaced tests twice; the proof caught both).
* **Reason:** a set per path still fails for any changed, dropped or added declaration while allowing the one repetition splitting requires; tests keep the stricter multiset. Plan-review issues PG-13, PG-100, PG-127, PG-130, PG-131.
* **Review:** `tasks/handoffs/2026-09-30-push-gate-parallelism-review.md`
* **Decided by:** Claude Code (Opus 5.5), build run for the push-gate parallelism plan (session a3a230ef-7b5b-4be0-82ec-2e5fb8953292), 2026-09-30 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":9,"effect_sha256":"d22f3d0dad2fdb0f9f7e4cff2cfdf55271bd169c45f75a36308f389a5cefa3fc","input_sha256":"80fb174beb42e6cfc2d6df299e7747810e944bb5b68ead9f0a605c726417c944","kind":"mutation-receipt","operation":"c2c4eeaa7cfedbb1f8f0f2fce1a81c992f2219a65c5695b262c31c2cf2033bf4","options":{"section":null},"request_id_sha256":null,"results":["d-20260930-05"],"target":"decisions-ledger","v":1} -->

### d-20260930-06 — How are the two slow O3.12 release-surface tests fixed?

* **Question:** How are the two slow O3.12 release-surface tests fixed?
* **Governs:** f-20260929-02
* **Chosen:** one timed test per checker evaluation: "O3.12 rejects unknown and never-built target cfg atoms" becomes a `test.each` over its four attribute rows, and "O3.12 rejects added and edited gate-invisible regions and catches stale pins" becomes five tests (added, edited, stale, macro twin, macro input replacement), each with its fixture, guard and assertion unchanged (315d8205).
* **Rejected:** raising `testTimeout` (d-20260901-36); caching the per-valuation scan across fixtures inside one test (it would keep five evaluations in one timed region and add a cache whose invalidation is itself untested).
* **Reason:** each body ran four or five full `r5Violations` evaluations, about 1.5 s each on the CI runner (7.2 s against the 5 s default, run 36667569789, job 109735447852); one evaluation per test puts each under ~1.5 s there and under 1 s locally, so the unit of timeout matches the unit of work.
* **Decided by:** Claude Code (Opus 5.5), build run for the push-gate parallelism plan (session a3a230ef-7b5b-4be0-82ec-2e5fb8953292), 2026-09-30 · **Superseded-by:** d-20260930-08
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"50ce0000a017f55f200a90b90ed44aec77f6c44197eaa89b3de6a01d43553fc2","input_sha256":"64f547162a29b92304f3c4d9238ea318999f291b051bf65272feb650a4c21731","kind":"mutation-receipt","operation":"488f123a7a1b7af7994ec54a753b735b3a2277b4ebdaf523618a3409b96dc210","options":{"section":null},"request_id_sha256":null,"results":["d-20260930-06"],"target":"decisions-ledger","v":1} -->

### d-20260930-07 — How is Vitest's cold-transform cost kept out of timed tests once the suite runs on many workers?

* **Question:** How is Vitest's cold-transform cost kept out of timed tests once the suite runs on many workers?
* **Governs:** f-20260930-02
* **Chosen:** `vite.config.ts` enables Vitest 4.1's `experimental.fsModuleCache` (persistent transformed modules under `node_modules/.experimental-vitest-cache`) everywhere except under Stryker (`STRYKER_MEMORY_BYTES` set), pinned by `scripts/vite-worker-budget.test.mjs`. Test files keep their dynamic imports and `vi.resetModules()`; static warm-up imports stay limited to modules without import-time side effects (`src/utils/sound.test.ts`).
* **Rejected:** raising `testTimeout` (d-20260901-36); static warm-up imports in the seven files whose imported graph snapshots or repairs storage, mounts the app or is `vi.doMock`ed at import time (unsafe: they would run before each test's fixture); disabling the React-compiler Babel plugin in tests (tests would stop exercising the code that ships); fewer Vitest workers (gives back the S2 speed-up and still fails under outside load).
* **Reason:** measured 2026-09-30: warm cache, summed transform time 112 s -> 2.45 s, coverage wall 32.7 s -> 17.3 s, the at-risk first tests 2.3 s -> 0.26 s, LCOV byte-identical to a run without the cache; the key covers module id and content, Vitest version, NODE_ENV, config-file and dependency contents, plugin names, environment and coverage mode, and a lockfile change clears it (Vitest `cli-api` `generateCachePath`, `ensureCacheIntegrity`). Bound: ~20 MB for the full suite, one entry per transformed module version, cleared on every lockfile change. CI starts cold every run and is unaffected. Reversal path: if a Vitest upgrade drops the option or a stale transform is ever observed, remove the line and fix the side-effectful module boundaries f-20260930-02 names.
* **Decided by:** Claude Code (Opus 5.5), build run for the push-gate parallelism plan (session a3a230ef-7b5b-4be0-82ec-2e5fb8953292), 2026-09-30 · **Superseded-by:** d-20260930-09
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"0c2830ac615d973416387703471a739acd649ab5b2dca803398c685864eaf754","input_sha256":"fa4fe47f6836db45c021c5f52df23411ce4586b76f89c37f6d2058d48a4af689","kind":"mutation-receipt","operation":"9e29223037cbae1f963c3834dabc92003e7b702e24a83049cb6a1b768aa536e6","options":{"section":null},"request_id_sha256":null,"results":["d-20260930-07"],"target":"decisions-ledger","v":1} -->

### d-20260930-08 — How are the slow O3.12 release-surface tests fixed? (corrected)

* **Question:** How are the slow O3.12 release-surface tests fixed?
* **Governs:** f-20260929-02
* **Chosen:** two parts. (1) One timed test per checker evaluation (315d8205, 44fa3c3f): the attribute table is a `test.each`, the region test five tests, and "accepts a test-only block and the real fail-analysis macro shape" two tests, assertions unchanged. (2) The evaluation itself is cheaper: the release-surface checker builds each source's valuation-independent structure once per invocation and reuses it for the default classification and the five gate valuations, which still evaluate separately (da68a05b, 98e0a6c0; one `r5Violations` call on `main.rs` 279 → 57 ms locally, output byte-identical, a test pins one build and five reuses).
* **Rejected:** raising `testTimeout` (d-20260901-36); relying on part (1) alone.
* **Supersedes:** d-20260930-06, whose reason predicted each split test would stay under ~1.5 s on the CI runner. New evidence disproves it: after the suite split the ten release-surface files run concurrently on the four-vCPU runner and one evaluation took ~2.9 s there, so a two-evaluation test failed at 5884 ms (run 36714838743, `test` job). Part (2) is the repair of that cost.
* **Reason:** the timeout was the symptom; the per-evaluation cost, multiplied by six structure rebuilds per call and by CPU contention on the runner, was the cause.
* **Decided by:** Claude Code (Opus 5.5), build run for the push-gate parallelism plan (session a3a230ef-7b5b-4be0-82ec-2e5fb8953292), 2026-09-30 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":9,"effect_sha256":"e3fba7d978344669b25eaa076298146595dbed2ddc15c65d57d99ded56e38c2a","input_sha256":"ced7e1d44df367ed9f64df5d07e02f3e9dc201f4258835daaa5c2226c12fc3b3","kind":"mutation-receipt","operation":"2c7ceb0ba0fe023d0f54d1b17d18699c93b81aa85adc3692fb3832dba6162c27","options":{"section":null},"request_id_sha256":null,"results":["d-20260930-08"],"target":"decisions-ledger","v":1} -->

### d-20260930-09 — How is Vitest's cold-transform cost kept out of timed tests once the suite runs on many workers? (corrected)

* **Question:** How is Vitest's cold-transform cost kept out of timed tests once the suite runs on many workers?
* **Governs:** f-20260930-02
* **Chosen:** as d-20260930-07: Vitest 4.1's `experimental.fsModuleCache` everywhere except under Stryker, with its key extended by a plugin to `tsconfig.json`'s text and the platform constant the `define` uses (f2085cb9); static warm-up imports only where the module has no import-time side effects (`src/utils/sound.test.ts`). This protects warm runs only; a cold cache — the first local run after a lockfile change, and every CI job, which starts without the cache and then writes it for its own run — still transforms inside the first timed tests, and that residual belongs to f-20260930-02's design question.
* **Rejected:** raising `testTimeout` (d-20260901-36); static warm-up imports in files whose imported modules have import-time side effects; disabling the React-compiler Babel plugin in tests. Fewer Vitest workers were not measured under comparable outside load and are rejected only because they give back the S2 speed-up for every run to protect the cold, loaded case.
* **Supersedes:** d-20260930-07, which claimed fewer workers "still fail under outside load" (never measured) and that CI "is unaffected" (CI does use and write the cache; it only starts cold). The cache-key gap (`tsconfig.json`, define values) was found by review and is closed by f2085cb9.
* **Reason:** measured 2026-09-30: warm cache, summed transform time 112 s → 2.45 s, coverage run 32.7 s → 17.3 s, the at-risk first tests ≈ 2.3 s → 0.26 s, LCOV byte-identical to a run without the cache; a cold `pnpm gates:push -- --frontend` at load 3-9 was green. Bound: one cache entry per transformed module version (~20 MB per full set), cleared by Vitest on every lockfile change.
* **Decided by:** Claude Code (Opus 5.5), build run for the push-gate parallelism plan (session a3a230ef-7b5b-4be0-82ec-2e5fb8953292), 2026-09-30 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":9,"effect_sha256":"be20d0507c374cb70fc589af1809702ffc4d12f9803e01e8803836e93e616bd1","input_sha256":"0cc606926b5459de8f6d83efd7c6372373b6eab1f6ab3b4ae4d443b9e883dce9","kind":"mutation-receipt","operation":"75730d979b5e2cf8852f93947e3ab8297874b99b8fb671af1978d0cdd8160b6d","options":{"section":null},"request_id_sha256":null,"results":["d-20260930-09"],"target":"decisions-ledger","v":1} -->

### d-20260930-10 — How does a refused bound SQLite leaf open avoid closing a lockable descriptor of a locked inode, per platform?

* **Question:** `f-20260929-06` asked how the unix `open` hook refuses a swapped or unverifiable leaf without closing a descriptor whose close releases this process's POSIX locks on another bound database, and without an unbounded quarantine — on Linux via `O_PATH` + `/proc/self/fd` reopen, and what the macOS equivalent or accepted residual is.
* **Governs:** f-20260929-06
* **Chosen:** Linux opens the leaf `O_PATH | O_NOFOLLOW` relative to the retained parent, verifies its identity with `fstat`, records the opened name, and reopens `/proc/self/fd/<n>` with SQLite's flags minus `O_NOFOLLOW`; every refusal or failure closes only the `O_PATH` descriptor, and no lockable leaf descriptor is ever closed. Measured on atlas (kernel 7.0): closing an `O_PATH` descriptor leaves the process's POSIX locks intact while closing a plain one releases them; the reopen yields the verified inode after the name is swapped. `/proc` unavailable fails the open closed. Non-Linux unix (no `O_PATH`, no descriptor reopen) keeps the pre-open check and post-open identity check, never closes a mismatched descriptor of an inode with a live binding nor an unclassified (`fstat`-failed) one — the latter retained until no registration is live — and bounds retention by refusing every leaf open with `EMFILE` (refusal counter unchanged) while a retained set holds `QUARANTINE_ADMISSION_LIMIT` (8) descriptors; opens admitted before the set filled may push it past the limit, and nothing is ever closed because of it. Windows unchanged: `LockFileEx` locks belong to the handle that took them.
* **Rejected:** closing beyond a per-inode cap (the defect); an uncapped quarantine (descriptor exhaustion); keeping the Linux pre-open `fstatat` (the `O_PATH` `fstat` is the check on the object then opened); a post-reopen identity check (only a kernel bug could fail it, and it would reintroduce a lockable descriptor to close); `open_by_handle_at` (needs `CAP_DAC_READ_SEARCH`); `openat2` (no reopen-by-descriptor); `O_EVTONLY` probing on macOS (unmeasurable here and no reopen, so the window stays); an install-time `/proc` probe (does not remove the per-open failure path); counting the admission refusal as an identity refusal (would report `Conflict` for an unchanged database).
* **Reason:** the hazard is the close of a lockable descriptor, so the Linux fix removes the lockable descriptor from every refusal path, and the macOS fix removes the close and moves the bound to admission. Residual on macOS: under an active race, leaf opens of every binding fail until the attacked inode's last binding drops (fail closed). The repository's own authority probes still open and close the leaf lockably (`f-20260929-11`). Plan review record: `tasks/handoffs/2026-09-29-sqlite-leaf-open-review.md`. Reversal path: restore the pre-open check + post-open quarantine with the close-at-cap branch in `bound_sqlite.rs`.
* **Decided by:** Claude Code (Opus 5.5), interactive `full auto` build run for f-20260929-06 (plan and review: session d4edd5c8-b834-46cd-aec7-058afcc03b66; implementation: session 68d0cce0-18f9-4c4b-8eb8-cf5d43283c6d, commits `0e2d799b`, `83ec7fd6`), 2026-09-30 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"9708cf60a00c649db7e1f7d2b04b95dfdfd4db2793f9442e6a16b3cf9b31becd","input_sha256":"2557a74358f08e5db106155224ce09f6ed02a097016b1cdc401b1387675279b0","kind":"mutation-receipt","operation":"92c072c85f44afa2e15b0819916d29b66feec3df09630599d0b9809fea301ea0","options":{"section":null},"request_id_sha256":null,"results":["d-20260930-10"],"target":"decisions-ledger","v":1} -->

## 2026-10-01 — recorded through the decisions lock

### d-20261001-01 — How does the push gate size and place its heavy work now that gates from several sessions share one machine?

* **Question:** How does the push gate size and place its heavy work now that gates from several sessions share one machine?
* **Governs:** -
* **Chosen:** `pnpm gates:push` runs through `scripts/heavy-gate.sh`, which takes the machine-wide `flock` on `$HOME/.cache/agent-kit/heavy-gate.lock` (canonical snippet of `~/.claude/references/gate-performance.md`, holder line written, a waiting gate prints the holder, every open/acquire/write failure exits non-zero) and runs the whole gate in its own `chessfable-gate-<pid>.scope` under `agents.slice` from every caller, bound to the invoking session scope when there is one; a scope that cannot be created or confirmed runs nothing. `scripts/gate-parallelism.mjs` reads `memory.high` and `memory.max` on that scope and every ancestor and uses the smallest finite value; an unreadable ancestor or an all-`max` chain uses the recorded conservative worker counts (the configuration the 8 GiB budget yields) with a printed reason, never physical memory and never an error. The e2e container starts with `--memory 4g`, a unique name, a fail-closed `docker info` memory-limit check and explicit stop/remove on failure, signal or abort; its 4 GiB is reserved from frontend coverage and, only in the concurrent schedule, from frontend mutation.
* **Rejected:** keeping the gate inside the session's 8 GiB scope and sizing to it (d-20260930-03's basis: it cannot see the other sessions' gates that overlapped on 2026-09-30, load 89 on 24 cores, and it OOM-killed 275 workers on 2026-09-29 inside one session scope); skipping the scope outside `agents.slice` as Korrigio's `gate_scope.sh` does (gate-performance rule (c) has no exception, and a caller in `app.slice` was measured to create the scope); a detection failure as an error naming `GATE_MEMORY_BYTES` (rule (b) requires the recorded conservative fallback).
* **Reason:** gate-performance rules (a)–(d), decided in the 2026-09-30 drain review (K1, agent-kit `references/gate-performance.md`) from the 2026-09-29/30 machine measurements recorded there; measured in this run: a scope created by `systemd-run --user --scope --slice=agents.slice` from the session and from an `app.slice` caller lands under `agents.slice` (MemoryHigh 40 GiB, MemoryMax 48 GiB), and `docker info` reports `MemoryLimit true`. Supersedes the budget-source and detection-failure parts of d-20260930-03; its per-worker constants and slot rule stand. Reversal path: `scripts/heavy-gate.sh` and the named constants.
* **Review:** `tasks/handoffs/2026-09-30-k5-chessfable-gates-and-review-review.md`
* **Decided by:** Claude Code (Opus 5.5), K5 ChessFable build run of the 2026-09-30 drain review (session e5e98ba9-1fe9-44b9-97ee-d14fb9375a46), 2026-09-30 · **Superseded-by:** d-20261002-01
<!-- ledger-meta {"command":"record-decision","effect_lines":9,"effect_sha256":"477eb662d30bf1a18b657bf5bd434e52e077e15f9ca44407d087dce1da60085e","input_sha256":"eed431a9b35fa6996791e692adf72e5bfb24c1a6111f5f14e74f6630303eb011","kind":"mutation-receipt","operation":"f23971ac1ea9976e0496cee9412df66c0d7366dc06e13031df07c14431f747a6","options":{"section":null},"request_id_sha256":null,"results":["d-20261001-01"],"target":"decisions-ledger","v":1} -->

### d-20261001-02 — Which checks run before code review, and how?

* **Question:** Which checks run before code review, and how?
* **Governs:** -
* **Chosen:** `pnpm checks:pre-review`, a `--pre-review` mode of `scripts/run-push-gates.mjs` behind the same `scripts/heavy-gate.sh`, run after the last implementation phase and after every repair batch, before code review and before a closure round over a diff (push skill §2a). It selects lanes from `merge-base(HEAD, @{u})..` the working tree including untracked files: oxfmt/oxlint on the changed files, `tsgo --noEmit` and `cargo fmt --check` when their inputs changed, the LCOV-free coverage-area mapping check (`coverage-report.mjs --mapping-only`, both configs), Stryker narrowed to the changed in-scope production files (`run-frontend-mutation.mjs --files`; a changed test adds the production files it imports), `rust:windows:check` and `bundle:check` after the frontend build. It never replaces the final gates.
* **Rejected:** leaving "the project's per-commit checks" undefined (the push skill and the kit build skill referred to them; gate restarts in 17 of 57 ChessFable drain clusters came from cheap classes caught only at the final gates, drain review R3 B2); a separate pre-review script (a second scheduler with its own supervision and exit semantics, rule 11); narrowing Stryker by package (the mandate says changed files, and a package mutates both of its files).
* **Reason:** the drain review measured 7.4 h between first and last pre-push gate start in ChessFable (September), caused by lint/format, coverage mapping, mutation and Windows clippy failures found after review; running the cheap classes on the last phase and every repair lets the review see the final tests. Reversal path: `PRE_REVIEW_GATE_SCHEDULE` in `scripts/run-push-gates.mjs` and push skill §2a, pinned both ways by `gates:routing:check`.
* **Review:** `tasks/handoffs/2026-09-30-k5-chessfable-gates-and-review-review.md`
* **Decided by:** Claude Code (Opus 5.5), K5 ChessFable build run of the 2026-09-30 drain review (session e5e98ba9-1fe9-44b9-97ee-d14fb9375a46), 2026-09-30 · **Superseded-by:** d-20261002-01
<!-- ledger-meta {"command":"record-decision","effect_lines":9,"effect_sha256":"811ad93fd6fc1e000acffcc32444c66fb3e8df6eeb73de5a4bcc333cc2da6b23","input_sha256":"3374ef08c8b36602b318eaeb404110eab6a1d6701087b450a125178675c323ed","kind":"mutation-receipt","operation":"b7fef9b755f08635f784c16b9b951090485808d3474b2a291a02a82aaa8f2716","options":{"section":null},"request_id_sha256":null,"results":["d-20261001-02"],"target":"decisions-ledger","v":1} -->

### d-20261001-03 — How does `$push` decide that the remote CI state refuses a push?

* **Question:** How does `$push` decide that the remote CI state refuses a push?
* **Governs:** -
* **Chosen:** the push skill runs `pnpm ci:remote:check` (`scripts/check-remote-ci.mjs`) before every push. It reads the `Test` workflow's recent runs on the upstream branch through `gh`, takes each job's newest completed result across those runs, and exits non-zero on any job whose newest completed result is not success; a failed or unparsable `gh` call, an empty run or job list, or a job with no completed result in the window also refuses. The named platform jobs only decide what to wait for after the push.
* **Rejected:** keeping the check as prose with example `gh` commands, reading only the named platform jobs (the 2026-09-28 unnamed `test` job was red for every later push, f-20260929-02), and reading only the newest run (its jobs may still be running).
* **Reason:** the drain review's R3 A4 and the kit's policy §8 now refuse on any red job; the "newest completed result per job across runs" reading was done by hand and missed red jobs twice (2026-09-19: seventeen pushes over a red Windows job; 2026-09-28: the unnamed `test` job), and a script's refusal cases are testable where prose is not. Reversal path: delete the script and fall back to policy §8's prose.
* **Review:** `tasks/handoffs/2026-09-30-k5-chessfable-gates-and-review-review.md`
* **Decided by:** Claude Code (Opus 5.5), K5 ChessFable build run of the 2026-09-30 drain review (session e5e98ba9-1fe9-44b9-97ee-d14fb9375a46), 2026-09-30 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":9,"effect_sha256":"f7b07c4ec2b9478a467715f8bf0cb52f517398416e403b9acaddd0e84fe6c608","input_sha256":"44166c6df86690e3e73dd0f7eef8ffe213eda666fd4f70a753fd57cbb5992d01","kind":"mutation-receipt","operation":"501a71239e00494752629475671d44ce43c848c9d5075e75afdec25ce13bf6cb","options":{"section":null},"request_id_sha256":null,"results":["d-20261001-03"],"target":"decisions-ledger","v":1} -->

### d-20261001-04 — Which ChessFable review lenses are diff-only (`plan-review: false`)?

* **Question:** Which ChessFable review lenses are diff-only (`plan-review: false`)?
* **Governs:** -
* **Chosen:** none. `review-chess-semantics`, `review-engine-protocol`, `review-ipc-contract`, `review-persisted-state`, `review-pgn-index`, `review-tauri-security` and the new `review-platform-semantics` stay plan-capable; the lens contract's `NOT APPLICABLE` exit covers plans outside a lens's class.
* **Rejected:** marking lenses whose findings are usually line-level (for example `review-ipc-contract` or `review-persisted-state`) as diff-only.
* **Reason:** each lens owns a design contract that a plan can already get wrong before code exists — tree and position semantics, engine lifecycle and result binding, the command/event and capability contract, persisted-state shape and hydration, the PGN index and encoding, native security boundaries, and platform assumptions of a planned filesystem or process mechanism. The 2026-09-30 drain review's K1 audit reached the same result ("chessfable: none"); its diff-only candidates were raw-color, German-copy and i18n-catalog lenses, whose classes exist only in a diff. Reversal path: set `plan-review: false` on a lens with evidence that it never finds a plan-level defect.
* **Review:** `tasks/handoffs/2026-09-30-k5-chessfable-gates-and-review-review.md`
* **Decided by:** Claude Code (Opus 5.5), K5 ChessFable build run of the 2026-09-30 drain review (session e5e98ba9-1fe9-44b9-97ee-d14fb9375a46), 2026-09-30 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":9,"effect_sha256":"7349c1ac2b912513a91b1c88561e13735c05e2549f72e2c0d42b185017967f07","input_sha256":"adf268840976f1a7b90b48d5e54c3778eab44346313853c813cb351da7388353","kind":"mutation-receipt","operation":"d4ebdba7b5ce03be94b17cf9f36457610900ad42b449d3a6bce8aef1e7b537aa","options":{"section":null},"request_id_sha256":null,"results":["d-20261001-04"],"target":"decisions-ledger","v":1} -->

### d-20261001-05 — How does a repository authority probe identify a pooled database without a lockable leaf descriptor?

* **Question:** `f-20260929-11` asked which `DatabaseFileTarget::open_current` consumers need a readable descriptor rather than identity only, and what identity-only primitive (`O_PATH` descriptor vs `fstatat` on the verified parent) keeps parent verification and reparse/wrong-kind classification on every platform, given that closing any ordinary descriptor of an inode releases this process's SQLite POSIX locks on it.
* **Governs:** f-20260929-11
* **Chosen:** no consumer reads bytes (every one used `Ok`/`Err` or `fstat` metadata), so `open_current` is replaced by `probe_current`, which returns identity, length and full-precision mtime (`RegularFileMetadata`) and keeps the verified-parent re-walk, parent-identity check and error mapping unchanged. On every unix (Linux and macOS alike) `infra::fs::probe_regular_file_at` creates no leaf descriptor: `statat(AT_SYMLINK_NOFOLLOW)` (regular kind + identity) → `faccessat(R_OK, AT_EACCESS)` so an unreadable leaf still yields `PermissionDenied` as the `O_RDONLY` open did (exactly `AT_EACCESS`: rustix 1.1.4 on Linux < 5.8 has a plain-`faccessat` fallback only for that flag set and returns `ENOSYS` for any other, pinned by a `platform_support` source row) → `statat` again, whose identity and kind must match the first (else `Conflict`). Windows keeps opening a read handle (handle-scoped `LockFileEx` locks). Measured on atlas (kernel 7.0, uid 1000): mode `000` → `statat` ok, `openat(O_RDONLY)` `EACCES`, `faccessat` denied; `0600` allowed. Known limit (confirmed by a focused fresh-context `review-plan` judgment): a writer of the authorized directory who swaps the leaf to a symlink exactly for the access check and restores it before the second stat changes only which error a probe reports — an unreadable leaf's `PermissionDenied` surfaces at the SQLite open instead, or a readable leaf is reported `PermissionDenied` for that one probe; identity, parent and kind guarantees are unaffected and every path fails closed.
* **Rejected:** `O_PATH | O_NOFOLLOW` + `fstat` on Linux with `fstatat` on macOS (two mechanisms for one property; the `O_PATH` descriptor pins an inode nothing uses afterwards; macOS has no `O_PATH`); keeping a readable `open_current` for future readers (no reader exists, and it would be the next lockable regression); `AT_EACCESS | AT_SYMLINK_NOFOLLOW` (needs `faccessat2`: `ENOSYS` and a dead database on Linux < 5.8); an `O_PATH` + `faccessat2(AT_EMPTY_PATH)` route (also Linux ≥ 5.8 only, no macOS equivalent); readability derived from mode bits (ignores ACLs); a `statat`-only probe (loses the `PermissionDenied` the pinned test `bound_refusal_keeps_an_unchanged_permission_failure_non_conflict` requires, turning an unreadable database into an r2d2 timeout); whole-second mtime (would miss same-second external modifications in the schema cache).
* **Reason:** the hazard is the close of a lockable descriptor, so the probe stops creating one; `open_verified_parent` already relied on the same `statat` for its identity check. Witness `database_probe_current_keeps_pooled_sqlite_shared_read_lock_held` (a pooled read transaction's lock survives a second connection, `database_identity` and the classifier) goes red when the probe opens the leaf again. Plan and review record: `tasks/handoffs/2026-10-01-sqlite-pathname-open-review.md`. Reversal path: restore `open_current` returning the `open_regular_at` file and `DatabaseSchemaIdentity::from_file`.
* **Decided by:** Claude Code (Opus 5.5), drain `full auto` build run for f-20260929-11 (session 91758424-781d-4333-940b-009a6dbfb9d0), 2026-10-01 · **Superseded-by:** d-20261001-06
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"f53e8c3101b598793ce62f8601f3c25e9b1cf8a6bba8205c67d35fcb46b1c43b","input_sha256":"05f64c6b8105cfda7af64e8faf363ad83bb91fa57f389bc33ad28a017da6107e","kind":"mutation-receipt","operation":"83b27096d8f218c9658208fd3c501550289b8e208f501122da7ae3038cb379ca","options":{"section":null},"request_id_sha256":null,"results":["d-20261001-05"],"target":"decisions-ledger","v":1} -->

### d-20261001-06 — How does a repository authority probe identify a pooled database without a lockable leaf descriptor? (corrected)

* **Question:** `f-20260929-11` asked which `DatabaseFileTarget::open_current` consumers need a readable descriptor rather than identity only, and what identity-only primitive (`O_PATH` descriptor vs `fstatat` on the verified parent) keeps parent verification and reparse/wrong-kind classification on every platform, given that closing any ordinary descriptor of an inode releases this process's SQLite POSIX locks on it.
* **Governs:** f-20260929-11
* **Chosen:** no consumer reads bytes (every one used `Ok`/`Err` or `fstat` metadata), so `open_current` is replaced by `probe_current`, which returns identity, length and full-precision mtime (`RegularFileMetadata`) and keeps the verified-parent re-walk, parent-identity check and error mapping unchanged. On every unix (Linux and macOS alike) `infra::fs::probe_regular_file_at` creates no leaf descriptor: `statat(AT_SYMLINK_NOFOLLOW)` (regular kind + identity) → `faccessat(R_OK, AT_EACCESS)` so an unreadable leaf still yields `PermissionDenied` as the `O_RDONLY` open did (exactly `AT_EACCESS`: rustix 1.1.4 on Linux < 5.8 falls back to plain `faccessat` only for that flag set and only when the real and effective uid and gid match, and returns `ENOSYS` otherwise; the app is never installed setuid or setgid, so on such kernels the precondition holds — a setuid/setgid launch there would fail every probe with `ENOSYS`, closed; the flags are pinned by a `platform_support` source row) → `statat` again, whose identity and kind must match the first (else `Conflict`). Windows keeps opening a read handle (handle-scoped `LockFileEx` locks). Measured on atlas (kernel 7.0, uid 1000): mode `000` → `statat` ok, `openat(O_RDONLY)` `EACCES`, `faccessat` denied; `0600` allowed. Known limit (confirmed by a focused fresh-context `review-plan` judgment): a writer of the authorized directory who swaps the leaf to a symlink exactly for the access check and restores it before the second stat changes only which error a probe reports — an unreadable leaf's `PermissionDenied` surfaces at the SQLite open instead, or a readable leaf is reported `PermissionDenied` for that one probe; identity, parent and kind guarantees are unaffected and every path fails closed.
* **Rejected:** `O_PATH | O_NOFOLLOW` + `fstat` on Linux with `fstatat` on macOS (two mechanisms for one property; the `O_PATH` descriptor pins an inode nothing uses afterwards; macOS has no `O_PATH`); keeping a readable `open_current` for future readers (no reader exists, and it would be the next lockable regression); `AT_EACCESS | AT_SYMLINK_NOFOLLOW` (needs `faccessat2`: `ENOSYS` and a dead database on Linux < 5.8); an `O_PATH` + `faccessat2(AT_EMPTY_PATH)` route (also Linux ≥ 5.8 only, no macOS equivalent); readability derived from mode bits (ignores ACLs); a `statat`-only probe (loses the `PermissionDenied` the pinned test `bound_refusal_keeps_an_unchanged_permission_failure_non_conflict` requires, turning an unreadable database into an r2d2 timeout); whole-second mtime (would miss same-second external modifications in the schema cache).
* **Supersedes:** d-20261001-05, as to the `AT_EACCESS` fallback clause only, which omitted the uid/gid precondition (records review of the same run, rustix 1.1.4 `src/backend/linux_raw/fs/syscalls.rs:1441-1451`). Everything else is unchanged.
* **Reason:** the hazard is the close of a lockable descriptor, so the probe stops creating one; `open_verified_parent` already relied on the same `statat` for its identity check. Witness `database_probe_current_keeps_pooled_sqlite_shared_read_lock_held` (a pooled read transaction's lock survives a second connection, `database_identity` and the classifier) goes red when the probe opens the leaf again. Plan and review record: `tasks/handoffs/2026-10-01-sqlite-pathname-open-review.md`. Reversal path: restore `open_current` returning the `open_regular_at` file and `DatabaseSchemaIdentity::from_file`.
* **Decided by:** Claude Code (Opus 5.5), drain `full auto` build run for f-20260929-11 (session 91758424-781d-4333-940b-009a6dbfb9d0), 2026-10-01 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":9,"effect_sha256":"438089e3d7fe3598833465c504ec173793b30af287d6d99cdf6927a87f71545b","input_sha256":"428e2d493f7a8a0f9483fa3db4d58de2d387e6404fb64bce1e56ad47c5757443","kind":"mutation-receipt","operation":"0b28dc3bc04595b8e539c12860e8ece07d4646ee4780f8dc2d3dd2cd0a66be6e","options":{"section":null},"request_id_sha256":null,"results":["d-20261001-06"],"target":"decisions-ledger","v":1} -->

### d-20261001-07 — How does the sidebar decide which link carries the active marker under the React Compiler?

* **Question:** The sidebar's blue active marker froze on the first page shown because `NavbarLink` derived its `.active` class from `useMatchRoute()`, whose returned function is identity-stable (`useCallback(..., [router])` in `@tanstack/react-router` 1.161.1), so the React Compiler memoized the class on `[match, url]`; how should the active link be determined?
* **Governs:** -
* **Chosen:** TanStack `Link`'s own active state: `className={classes.link}` plus `activeProps={{ className: classes.active }}`; `useMatchRoute`, the hand-set `aria-current` and `clsx` are removed, and `Link` emits `aria-current="page"` and `data-status="active"` from the same `isActive` that applies the class. Default `activeOptions` (non-exact, segment-boundary path match, partial search match) — measured: `/databases/abc` marks Databases, `/engines?selected=2` marks Engines, `/` is marked only on `/`.
* **Rejected:** restoring upstream's `"use no memo";` directive (`abe54ab8`, deleted by the fork's audit commit `3afed031`) — it opts the file out of the compiler and keeps two independent computations of "is this link active", which is exactly how the class and `aria-current` diverged; deriving the class from `useRouterState` by hand (a second copy of the logic `Link` already owns).
* **Reason:** one source of truth for the active state, subscribed inside `Link`, cannot be frozen by memoization in the caller. Witnesses: `src/components/Sidebar.test.tsx` (real router, compiler active under Vitest) and the screenshot-free sidebar walk in `e2e/accounts-puzzles-engines.spec.ts` (production bundle, computed `border-left-color`) both go red on the previous `Sidebar.tsx`. Plan and review record: `tasks/handoffs/2026-10-01-sidebar-active-marker-review.md`. Reversal path: restore `useMatchRoute` with `"use no memo";`.
* **Decided by:** Claude Code (Opus 5.5), interactive build run, 2026-10-01 · **Superseded-by:** d-20261001-08
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"8c51711976d2484d80d7b339c2e199798a781ffaf9c868525854cf294037c1d2","input_sha256":"979bd01870804461ec148d1621c3b90168d8a9cc469ec0ab5a60e1c620e9e257","kind":"mutation-receipt","operation":"701d24c1dd9b5ca82ae52af4fcaed2a68526ec628e380de6cc140c777cc0cd6e","options":{"section":null},"request_id_sha256":null,"results":["d-20261001-07"],"target":"decisions-ledger","v":1} -->

### d-20261001-08 — How does a sidebar entry stay marked active when its destination is not its route prefix?

* **Question:** The database Back fix (`tasks/handoffs/2026-10-01-database-back-button-review.md`) makes the sidebar Databases entry navigate to the active database's view (`/databases/<key>`) when one is set, while it must stay marked on every `/databases*` route, including `/databases` and another database's view `/databases/<B>`. `d-20261001-07` takes the marker from TanStack `Link`'s own active state, which in `@tanstack/react-router` 1.161.1 is computed only against the link's own destination (`dist/esm/link.js:315-356`; `activeOptions` offers `exact`, `includeSearch`, `includeHash`, `explicitUndefined` only). How is the active state decided?
* **Governs:** -
* **Chosen:** `NavbarLink` takes a destination (navigation options) and a separate match path, and computes its active state once per link for every entry with `useRouterState({ select })` returning a boolean: a segment-boundary prefix test of `location.pathname` against the match path (`/` matches only `/`; trailing slash ignored). That boolean drives both the `.active` class and `aria-current`. The Databases entry's match path is the literal `/databases`, never derived from its target. `Link` still emits its own `aria-current`/`data-status` when its destination matches; that set is always a subset of the computed one, because every destination lies under its match path.
* **Rejected:** keeping `Link`-native state with `to="/databases"` and redirecting in `onClick` (the `href` would lie about the destination); a `?resume` search flag read by a `/databases/` route guard (reintroduces the store-reading route guard the reviewed plan removed); `useMatchRoute` (identity-stable callback, frozen by the React Compiler — the original sidebar defect); a second mechanism for the Databases entry only (two definitions of "active" in one component).
* **Reason:** the destination and the active scope differ for the Databases entry, and `Link` cannot express that. A `useRouterState` selector returns a primitive that changes on navigation, so compiler memoization in the caller cannot freeze it, which was the property `d-20261001-07` needed. One computation per link still drives class and `aria-current` together. Witnesses: `src/components/Sidebar.test.tsx` (route walk plus the store-A, URL-`/databases/<B>` case) and the sidebar walk in `e2e/accounts-puzzles-engines.spec.ts`. Reversal path: return to `activeProps` and give up the Databases entry's resume.
* **Decided by:** Claude Code (Opus 5.5), interactive implementation run, 2026-10-01 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"0f76f76e2f970e9f0fc3e1526bc0560116e470a5b7febd62cb2a83ba5fd5217e","input_sha256":"09dfea8ad51695e4d633d3baa67acf9b092b49b4edec6727183df3c3a987e159","kind":"mutation-receipt","operation":"fc850e473d7baf0304480057e1625dda3e7fc4218bd051d4d3ebffcba9966b94","options":{"section":null},"request_id_sha256":null,"results":["d-20261001-08"],"target":"decisions-ledger","v":1} -->

## 2026-10-02 — recorded through the decisions lock

### d-20261002-01 — How do ChessFable's heavy gate entry points reach the strict machine-wide gate launcher?

* **Question:** How do ChessFable's heavy gate entry points reach the strict machine-wide gate launcher now that tuxedo-config's `agent-gate` takes the canonical heavy-gate lock, creates and confirms its own `agents.slice/agent-gate-*.scope` from every caller, and fails closed (tuxedo-config `f-20261001-04`)?
* **Governs:** f-20260930-03
* **Chosen:** the package scripts `gates:push`, `checks:pre-review`, `gate:ensure` and `gate:run` are `agent-gate node scripts/…` with no `command -v` fallback; `gate:check` stays plain because it only reads the receipt cache and never starts a gate. The scheduler's lanes call `pnpm gate:ensure|gate:run` from inside the gate scope, where `agent-gate` execs in place without relocking, so one lock and one budget cover the whole run. `scripts/heavy-gate.sh` and `scripts/heavy-gate-tests.mjs` are deleted with the `gates:heavy:test` contract member, and `gates:routing:check` pins all four package-script strings. A missing `agent-gate` or a launcher refusal (exit 125) fails the command before any gate work starts. The sizing parts of `d-20261001-01` stand: smallest finite `memory.high`/`memory.max` on the chain, the recorded conservative fallback on an unreadable chain, and the e2e container's `--memory 4g` reservation. The measurement of record for the gate scope is the Phase 2 measurement named in the f-20260930-03 closing note.
* **Rejected:** a `command -v agent-gate` fallback that runs in place when the launcher is missing (agent-kit `d-20261001-05`, gate-performance rule (c): an unplaced gate is the 2026-09-29 OOM class); wrapping only `gates:push`/`checks:pre-review` and writing `agent-gate pnpm gate:ensure …` into the push skill's prose (missed by every agent that types the package script); wrapping `gate:check` (never starts a gate, so it would only queue behind the lock); keeping `scripts/heavy-gate.sh` beside `agent-gate` (a second `flock` on `heavy-gate.lock` around a gate that takes the same lock deadlocks, measured 2026-10-01, gate-performance (a)).
* **Reason:** new evidence `d-20261001-01` did not have: the strict launcher it explicitly waited for landed (tuxedo-config `f-20261001-04`, commits 2d80082, 37746d1, 3c880ef). Measured 2026-10-02: `agent-gate bash -c …` from this session ran in `agents.slice/agent-gate-<pid>-<t>.scope` with `memory.max=30064771072`, propagated exit 7 and printed the holder while another session's gate held the lock; `agent-gate agent-gate bash -c …` ran the inner call in place in the outer scope. Supersedes the placement and lock parts of `d-20261001-01` and the launcher clause (`behind the same scripts/heavy-gate.sh`) of `d-20261001-02`; that decision's lane selection stands. Plan and review record: `tasks/handoffs/2026-10-02-agent-gate-convergence-review.md`. Reversal path: the four package scripts in `package.json` and `GATE_RUNNER_SCRIPTS` in `scripts/check-gate-routing.mjs`.
* **Decided by:** Claude Code (Opus 5.5), drain build run for f-20260930-03 (session 021d2888-c904-44b0-af74-a8f4604318bd), 2026-10-02 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"eddc1d7f812e77e2f1ef1a7e6c50d574617d4cb47a7b5d198f98d7f6a7233bbb","input_sha256":"856eac1cba896ed10edb9a3500b3b8cb2b89bccc8f3f79fc0491f5b5500fed30","kind":"mutation-receipt","operation":"fce239a1e8f6175448cc11ab1884206176931492a44f86bc0122f898199fd054","options":{"section":null},"request_id_sha256":null,"results":["d-20261002-01"],"target":"decisions-ledger","v":1} -->

### d-20261002-02 — What does the gate's 1 GiB worker-sizing reserve cover once the gate runs in its own capped scope?

* **Question:** What does the gate's 1 GiB worker-sizing reserve (`AGENT_RESERVE_BYTES` in `scripts/gate-parallelism.mjs`) cover once the heavy gate runs in its own `agent-gate` scope instead of the agent's 8 GiB session scope?
* **Governs:** f-20260930-03
* **Chosen:** the constant is renamed `UNSIZED_PROCESS_RESERVE_BYTES` and keeps 1 GiB. Its comment names both places it applies: in a session scope (plain `vitest`), the agent process that shares the cgroup (0.32 GB measured 2026-09-29); in the gate scope, the scheduler, the per-lane `pnpm` and `gate-receipt` parents and the launcher's Node processes, which no worker count sizes. The gate-scope reason is validated by the whole-gate Phase 2 measurement recorded in the f-20260930-03 closing note (scope `memory.peak` below `memory.max`, zero OOM kills).
* **Rejected:** dropping the reserve inside the gate scope (the unsized processes share the scope's `MemoryMax` with the workers); keeping the name `AGENT_RESERVE_BYTES` (no agent runs inside the gate scope, so the name and its comment would be false there); an isolated per-process RSS profile of the unsized processes to resize the reserve (gate-performance (b) accepts a named shared-resource reason, and the focused review judgment of 2026-10-02 round 4 withdrew the sampler).
* **Reason:** gate-performance rule (b) and its intro ("a cap or ordering without a written reason is a defect"): after the move the old reason no longer describes the scope the reserve is subtracted from. Plan and review record: `tasks/handoffs/2026-10-02-agent-gate-convergence-review.md`. Reversal path: the constant and its comment in `scripts/gate-parallelism.mjs`.
* **Decided by:** Claude Code (Opus 5.5), drain build run for f-20260930-03 (session 021d2888-c904-44b0-af74-a8f4604318bd), 2026-10-02 · **Superseded-by:** d-20261002-03
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"4f8e43ee9a6d587396024fd488e0395bed8945b88bce6a998543d84470d8eef9","input_sha256":"8643f9b8efaef0ef4bf1223efa8f75af2cc71e384231dedc8825f74e77560e76","kind":"mutation-receipt","operation":"f2f5a73c664e2b9672a1f81f073854792296d7e1be3175ae18aaec28b15a13de","options":{"section":null},"request_id_sha256":null,"results":["d-20261002-02"],"target":"decisions-ledger","v":1} -->

### d-20261002-03 — What does the gate's 1 GiB worker-sizing reserve cover inside the agent-gate scope, and which evidence checks it?

* **Question:** What does the gate's 1 GiB worker-sizing reserve (`UNSIZED_PROCESS_RESERVE_BYTES` in `scripts/gate-parallelism.mjs`) cover once the heavy gate runs in its own `agent-gate` scope, and which cgroup evidence checks it?
* **Governs:** f-20260930-03
* **Chosen:** as `d-20261002-02`: the constant keeps 1 GiB under the name `UNSIZED_PROCESS_RESERVE_BYTES`, covering the agent process in a session scope (plain `vitest`, 0.32 GB RSS measured 2026-09-29) and, inside the gate scope, the scheduler, per-lane `pnpm`/`gate-receipt` parents and the launcher's Node processes that no worker count sizes. The gate-scope check is the whole all-blocks gate run completing in the scope without observed `oom`/`oom_kill` events or swap use (`memory.swap.peak` 0). That is a whole-run outcome for this workload, not an independent bound on the reserve or on any per-worker constant. `memory.peak` is recorded beside it and is not a criterion.
* **Rejected:** `memory.peak` below `memory.max` as the criterion (`d-20261002-02`'s parenthetical and the reviewed plan through r10): cgroup-v2 `memory.peak` includes page cache, and two green all-blocks runs reached `memory.max` exactly while reclaiming file pages; claiming the run proves "no memory pressure" or that the constants are sufficient (the plan-review lenses in r11 showed neither OOM counters nor swap use establish that, and a post-exit anon/file split says nothing about composition at peak); reinstating a per-process RSS sampler to bound each constant (withdrawn in the 2026-10-02 plan review, round 4, and not required by gate-performance (b)).
* **Reason:** new evidence `d-20261002-02` did not have, measured 2026-10-02 inside real `agent-gate` scopes (`memory.max` 30064771072, 24 CPUs) on `c49a852c`: run M2 green, 481 s, `memory.peak` 30064771072, `oom 0 oom_kill 0`; run M3 green, 444 s, `memory.peak` 30064771072, `memory.events` `max 401 oom 0 oom_kill 0`, `memory.swap.peak` 0, post-exit `anon` 753664 / `file` 8477736960. Plan and review record (rounds r11-r12): `tasks/handoffs/2026-10-02-agent-gate-convergence-review.md`. Supersedes `d-20261002-02` (its chosen value and coverage stand; its validation clause is replaced). Reversal path: the constant and its comment in `scripts/gate-parallelism.mjs`.
* **Decided by:** Claude Code (Opus 5.5), drain build run for f-20260930-03 (session 021d2888-c904-44b0-af74-a8f4604318bd), 2026-10-02 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"b4f00e92bf9bfb860336bc4a3b8deab0054b970d7f4bc07324cb1778b8fef426","input_sha256":"1cf19470b65231753837eedaa3901b9fdaf3954c458b042138ef1ee3c753521c","kind":"mutation-receipt","operation":"e8d23ad0e9efc9ecaf6a50e7a24048f3ca2e3d75b4aa695a1c0c43246db4b7c9","options":{"section":null},"request_id_sha256":null,"results":["d-20261002-03"],"target":"decisions-ledger","v":1} -->

### d-20261002-04 — Should the database list wait for the content scan?

* **Question:** Should the database list wait for the content scan?
* **Governs:** -
* **Chosen:** No. Ordinary open keeps the cheap schema checks, including rejection of an uninitialized file. `PRAGMA integrity_check` and `PRAGMA foreign_key_check` stay on create and migration. A missing or stale stamp schedules one background read-only scan that does not block `get_db_info`.
* **Rejected:** Keep both pragmas on ordinary open and cache the pass only in memory.
* **Reason:** The in-memory `DatabaseSchemaIdentity` dies with the process, so a relaunch of Mega Database 2025 waits about two minutes again. The stored Info row already supplies the card counts.
* **Decided by:** Grok build 2026-10-02 database-list-integrity · **Superseded-by:** -

### d-20261002-05 — Should a failed content scan use a new error sentence?

* **Question:** Should a failed content scan use a new error sentence?
* **Governs:** -
* **Chosen:** No. Reuse `SQLite integrity_check failed` and `SQLite foreign_key_check failed`, and the existing database error card. Home keeps its `type === "success"` filter and gets no error card.
* **Rejected:** A new explanation of the background scan.
* **Reason:** The existing card already says the database could not be loaded. The accepted window is that a corrupt file may show its stored title until the scan fails.
* **Decided by:** Grok build 2026-10-02 database-list-integrity · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":17,"effect_sha256":"28db97e75b34aee28c1a43b27c666be33810ef5635779f74c4cdc372bfde8c06","input_sha256":"66efe29497453e1f8bf471df1a40a5183be62744047c40240b8b58b991f502a2","kind":"mutation-receipt","operation":"54d7579e61b85c45ac6c599fbeb473efe795cf38099a0b65b0155d5ca86c00b4","options":{"section":null},"request_id_sha256":null,"results":["d-20261002-04","d-20261002-05"],"target":"decisions-ledger","v":1} -->

### d-20261002-06 — What closes the preferred-sidecar deletion window: reorder, or a provenance check?

* **Question:** What closes `f-20260912-09`'s window: removing sidecars after the primary, or a provenance check immediately before each sidecar unlink?
* **Governs:** f-20260912-09
* **Chosen:** A provenance check. The preferred sidecar's recorded `IndexSource.object` is read through the retained parent with a header-only reader, and the removal is bound to the identity of the file that was read. The file is kept when it records another database's object, and removed when it records this database or is not a decodable current-version archive. The `d-20260831-24` order (preferred, then legacy, then primary, then SQLite sidecars) is kept, and the legacy check moves onto the same reader with its predicate unchanged. A preferred file this process may not read is kept and the deletion continues, because its provenance cannot be judged.
* **Rejected:** Removing sidecars after the primary, because a swap after the primary unlink still deletes the replacement's index and the reorder reverses `d-20260831-24` without new evidence. Also rejected: full `IndexSource` equality for the preferred sidecar, which would orphan every stale index of a deleted database; and reusing the full-validation `probe_legacy_index_sidecar_at`, whose cost grows with index size and which maps a file that is about to be deleted.
* **Reason:** `IndexSource.object` is the provenance field that names the database, it is recorded in every archive, and it is available before any chunk is read. The recorded order stays because the provenance check closes the probe-to-unlink window in either order.
* **Decided by:** Grok, drain session 1f678668-c21e-4c25-8200-a7808f5d4209, adopting the reviewed plan for f-20260912-09 · **Superseded-by:** d-20261002-08

### d-20261002-07 — Does the integrity stamp beside the preferred sidecar get the same provenance check as the index?

* **Question:** Does the integrity stamp that NEW-BASE removes beside the preferred sidecar get the same provenance check as the index?
* **Governs:** f-20260912-09
* **Chosen:** No. The stamp keeps today's identity-only removal in the position the current `unlink_database_files` shows, and the header-only reader applies only to the preferred `.ecsi` leaf. The hook does not run for the stamp.
* **Rejected:** A second reader that keeps a stamp whose `Stamp.identity.object` is foreign, and moving the stamp to after the primary unlink. The finding's collateral clause names an index, not this JSON scan record, and a post-primary unlink leaves the same swap window the plan already refused for the index.
* **Reason:** The stamp is regenerable content-validation metadata (`content_validation.rs` `Stamp { version, identity, verdict }`), and folding it into the archive reader would parse a non-archive as `IndexSource`.
* **Decided by:** Grok, drain session 1f678668-c21e-4c25-8200-a7808f5d4209, adopting the reviewed plan for f-20260912-09 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":17,"effect_sha256":"be1b747d584c7b9fc9c0ca90be13c5894587ab792ebf15b2bddd6d281ea4e4dd","input_sha256":"e91efdb62500f5106cd73f63c0b2a13a8939a34be94a28673095299a1db1b73e","kind":"mutation-receipt","operation":"06547740b799881557a505e32775ac54a9d5104a83bf77fd06ddc945f3c0c7df","options":{"section":null},"request_id_sha256":null,"results":["d-20261002-06","d-20261002-07"],"target":"decisions-ledger","v":1} -->

### d-20261002-08 — What of the deletion order still binds, and what does the preferred-sidecar check actually close?

* **Question:** What of `d-20260831-24` still binds once a preferred sidecar is removed only after a provenance check, and which errors and unlink instants does that check cover?
* **Governs:** f-20260831-08, f-20260912-09
* **Chosen:** Keep the `d-20260831-24` order: preferred index sidecar, then legacy index sidecar, then the primary, then the SQLite `-wal` and `-shm` leaves, all through the retained parent. `PartialRemoval` only when the primary file is gone; sidecar-only failures stay `Io` or `InvalidInput` and are retryable. `CommittedDurabilityUncertain` from registry replacement is unchanged. Both `FilesPage` and `deleteDatabaseAndInvalidate` go through one `runDestructiveWithRefresh` helper that refreshes on `applied-despite-error` and then rethrows. No new error category. The legacy sidecar is removed only when its full `IndexSource` matches this database. The preferred sidecar is removed when its recorded `IndexSource.object` is this database, or when its header and source are not a decodable current-version archive. It is kept when that object names another database. `PermissionDenied` at any probe stage keeps either index name and deletion continues. Other I/O errors propagate and can stop deletion before the primary is touched. `NotFound` leaves the absent name in place. The provenance check binds the removal to the identity of the file that was read, which closes the window from the caller's probe through the archive read. It does not close the `statat` to `unlinkat` instant inside `remove_entry_at`: POSIX has no pathname compare-and-unlink, Windows deletes the checked handle, and the primary leaf and the legacy sidecar already carry that same residual.
* **Rejected:** Treating "a preferred file this process may not read is kept" as every unreadable or undecodable file. Only `PermissionDenied` keeps a sidecar; an undecodable preferred archive is removed, and the same defect on the legacy name keeps that file. Treating "the provenance check closes the probe-to-unlink window" as covering the `statat` to `unlinkat` instant inside `remove_entry_at`. Reordering sidecars to after the primary. Unlinking a colliding preferred sidecar that records another database's object.
* **Reason:** Cumulative review of `d-20261002-06` found two sentences broader than the code. `classify_probe_error` keeps a sidecar only for `PermissionDenied`. `InvalidData` on the preferred name removes it and on the legacy name keeps it. Other I/O errors return before the primary is removed. The identity compare closes the window through the archive read. `remove_entry_at` on Unix still stats the leaf and then unlinks it by name, which the frozen plan threat model and the function comment already leave out of scope. Superseding `d-20260831-24` requires restating every clause that still binds, because its first clause still says the preferred sidecar is unlinked unconditionally.
* **Decided by:** Grok, drain session 1f678668-c21e-4c25-8200-a7808f5d4209, correcting the review of f-20260912-09 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"1438871a2710057fa18416db32893fe131ca9e66a79f3bfe02ece759b5d491a8","input_sha256":"7a9a46bd5f10bc70f73aaf8e576c977c16cb7c046dbb0da5b03c86a8230357bb","kind":"mutation-receipt","operation":"af0a2d5fef000876262011a30b6b278e057238c1f0357fdbfcd8c55fdc9f052c","options":{"section":null},"request_id_sha256":null,"results":["d-20261002-08"],"target":"decisions-ledger","v":1} -->

## 2026-10-03 — recorded through the decisions lock

### d-20261003-01 — Which profiles count as this run?

* **Question:** Clear `.profraw` files under `coverageTarget` before the run and fail if any survive, or merge only the profiles whose binary signature matches the binary just built?
* **Governs:** f-20261002-09
* **Chosen:** Clear every regular-file `.profraw` that `filesBelow(coverageTarget)` would return, then throw `Rust coverage left stale raw profiles:` if any remain, before `cargo llvm-cov`. A missing directory is success. Symlinks are not followed. `ENOENT` is success only when the coverage root itself is missing; a descendant `ENOENT` or any other walk error propagates and does not start Cargo.
* **Rejected:** A `%m` filter. `cargo llvm-cov clean --profraw-only` as the only clear. Dropping `--no-report`. A new lock around the coverage target.
* **Reason:** cargo-llvm-cov 0.8.7 sets `no_clean` when `--no-report` is passed, and its own profraw clean is a non-recursive glob while this script merges recursively. A binary-id filter drops a fresh build-script profile from the same invocation and keeps a stale file whose `%m` still matches the current test binary. `d-20260930-01` already separates `rust-test` onto another target directory. Reversal path: replace the clear with a filter that keeps every profile written by this invocation, including a different `%m`, and still drops a stale file with the current `%m`.
* **Decided by:** Grok, drain session e1db7603-3919-4fe0-898a-de9d5f32da44, adopting the reviewed plan for f-20261002-09 · **Superseded-by:** -

### d-20261003-02 — What does the failure matrix of the Rust coverage script cover?

* **Question:** Stage only the new survivor refusal, or every failure path of `scripts/rust-branch-coverage.mjs`?
* **Governs:** f-20261002-09
* **Chosen:** The whole matrix. The survivor refusal, the new removal and walk failures, and every other path in the edited file are staged through the exports against scratch inputs. One pre-clear entrypoint spawn, the `rustup` failure, is staged after planting one `.profraw` and asserting that path set is unchanged. A `finally` path deletes only that planted file, including when the spawn or an assertion fails. A spawn that reaches the clear or Cargo stays argued because it binds the live coverage tree.
* **Rejected:** Listing pre-existing throws as inherited and not staging them.
* **Reason:** `pnpm coverage:backend:check` reads this script's result as evidence. Push-review-policy §2 says the run that changes an evidence artefact owns its matrix. A header that names unstaged paths does not make those paths evidence. Reversal path: a later decision that the gate stops treating this script's exit as evidence.
* **Decided by:** Grok, drain session e1db7603-3919-4fe0-898a-de9d5f32da44, adopting the reviewed plan for f-20261002-09 · **Superseded-by:** -

### d-20261003-03 — Does the adopting session run the backend coverage gate when path selection would skip it?

* **Question:** Is `pnpm coverage:report:test` enough proof, given `gates:push` will not select `backend-coverage` from a scripts-only diff?
* **Governs:** f-20261002-09
* **Chosen:** The phase proof is `pnpm coverage:report:test` and then `pnpm gate:ensure backend-coverage`.
* **Rejected:** Relying on path selection or on `pnpm gates:push` without `--rust`.
* **Reason:** The artefact is the gate. The unit test does not execute `main` or Cargo. Reversal path: teach lane selection to notice this script, which is a different change and is not this mandate.
* **Decided by:** Grok, drain session e1db7603-3919-4fe0-898a-de9d5f32da44, adopting the reviewed plan for f-20261002-09 · **Superseded-by:** d-20261003-04
<!-- ledger-meta {"command":"record-decision","effect_lines":26,"effect_sha256":"4da2eedfbb4a0ce3004450972527f71f4175a42c9e937da86b0a309c7e9778cc","input_sha256":"4c80fde878f8a5ae997e9b6435e694174ca7a2a300539318445ae87274eae981","kind":"mutation-receipt","operation":"ee670fff8e9024dff9f369dd4d6f9e829f39a6b65e178d0a0405687a8a8e7a2b","options":{"section":null},"request_id_sha256":null,"results":["d-20261003-01","d-20261003-02","d-20261003-03"],"target":"decisions-ledger","v":1} -->

### d-20261003-04 — Is the coverage unit test enough proof of the profraw clear?

* **Question:** Is `pnpm coverage:report:test` enough proof, given `gates:push` will not select `backend-coverage` from a scripts-only diff?
* **Governs:** f-20261002-09
* **Chosen:** The phase proof is `pnpm coverage:report:test` and then `pnpm gate:ensure backend-coverage`. The choice in d-20261003-03 stands.
* **Rejected:** Relying on path selection or on `pnpm gates:push` without `--rust`.
* **Reason:** The suite's entrypoint spawn does call `main()` and stops in `coverageTools` when `rustup` cannot be spawned. It does not start Cargo and does not merge profiles. The artefact that measures coverage is `pnpm gate:ensure backend-coverage`. d-20261003-03's reason said the unit test does not execute `main`; that clause is false (`scripts/coverage-report-tests.mjs` entrypoint test, `scripts/rust-branch-coverage.mjs` `main`). This supersession corrects that clause and does not change the choice. What the prior did not consider: the staged tool-resolution test spawns the script.
* **Decided by:** Grok, drain session e1db7603-3919-4fe0-898a-de9d5f32da44, correcting the records-lens finding on d-20261003-03 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"5100d7639f6904671bbaea364075c4fcb13aafaea17879ce5d1104214154c23e","input_sha256":"4caf56a327e8384bc8dd136f41b55ae6aa3fbaff85fc3918fcf9f3421357f708","kind":"mutation-receipt","operation":"dae963c571f735778b3324cff10ac0112ee9a30dd752ca8e78eff3f5e894a959","options":{"section":null},"request_id_sha256":null,"results":["d-20261003-04"],"target":"decisions-ledger","v":1} -->

### d-20261003-05 — Which error does a path-authority object swapped between validation and open return?

* **Question:** Which error does a path-authority object swapped between validation and open return?
* **Governs:** f-20260913-04
* **Chosen:** The root `openat` in `resolve_unix`, and both `open_windows_nofollow` calls that open the directory root or the file-authority parent in `resolve_windows`, map `ELOOP` / `ENOTDIR` / `ENOENT` and the Windows set `ERROR_FILE_NOT_FOUND`, `ERROR_PATH_NOT_FOUND`, `ERROR_DIRECTORY`, plus `InvalidInput("reparse points cannot be authorized")` from that open only, to `Conflict("path authority is unavailable because its object changed")`. A child `openat` that fails with those three Unix errnos after `statat` already saw a directory maps to `Conflict("directory changed while resolving")`. `register_database_child_verified` maps `Io(NotFound)`, `InvalidInput("file authority must be a regular file")`, and `InvalidInput("symbolic links cannot be authorized")` from the post-resolve `validate_target` to `VERIFIED_REGISTRATION_CONFLICT` only when `resolved.file()` is `Some`. The shared classifier is one function used by `child_open_swap` and these resolve opens; `child_open_swap` keeps the message `workspace directory changed concurrently`.
* **Rejected:** Leaving the open failures as `Error::Io`; mapping them to `InvalidInput` (the enumeration plan's earlier wording; this finding's fix shape is `Conflict`); unifying the post-open same-type message `"root changed concurrently"` with the pre-open message; changing `open_windows_nofollow` for every caller; mapping every `validate_target` failure, including a `.db3` path that was already a directory when `resolve` returned; mapping a Windows child-walk `NotFound` that has no prior successful stat, because that is also a path that never existed; parking the message choice as `felix-decision` (no product-impact sentence — the listing copy is `f-20260913-05`).
* **Reason:** Refusal is already correct. Callers can offer re-selection only when the category is `Conflict`, which is the category the same-type identity mismatch already uses. The pre-open identity check in `resolve` already returns `path authority is unavailable because its object changed`, so an open that fails because that object was replaced in the next statement returns the same category and the same message. A same-type replacement that still opens is a different observation and keeps `root changed concurrently`. A stable symlink or special file that `statat` itself sees keeps `InvalidInput("path contains a symlink or special file")`. `EACCES` and every other errno stay `Error::Io`.
* **Decided by:** Grok drain session 8ac33c07-9caa-4264-b044-dfd5a73d10d5 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"4fb6e343ebd174b8163644c66a713acf2020ab717f4f4231b338bee51bc6320e","input_sha256":"9597c458e3858b5abadbdf2aaf21ec1aa9bb4e21e1a1a7e0d8df9bd5c7e7243f","kind":"mutation-receipt","operation":"3eaeadffaf63b7aa1043fdedaf1ca6920318f21de4b89877e3d85d092b8bf034","options":{"section":null},"request_id_sha256":null,"results":["d-20261003-05"],"target":"decisions-ledger","v":1} -->

### d-20261003-06 — Where does the workspace create path take lastModified without a pathname reach?

* **Question:** Where do `create_workspace_file` and `create_workspace_directory` take `WorkspaceEntry.lastModified` without a pathname reach and without turning a post-commit observation failure into an error after the entry is durable and registered?
* **Governs:** f-20260913-02
* **Chosen:** Files take signed Unix seconds from the post-rename `fstat` already performed on the retained temporary descriptor, returned on `AtomicInstalledFile.modified_seconds`, including the pre-rename fallback seconds on `CommittedDurabilityUncertain`. Directories take those seconds from the single pre-registration observation that already supplies identity through the retained parent (`statat` on Unix, the retained handle's `LastWriteTime` on Windows). `timestamp` is deleted. A pre-1970 time is a negative `i64`.
* **Rejected:** An identity-checked `statat` of the installed name after registration, which can fail or observe a replacement after the PGN and sidecar are durable. Also rejected: moving today's pathname `timestamp` to before registration, which keeps the R3 pathname reach and can still observe a replacement.
* **Reason:** The file helper already `fstat`s the installed inode before any pathname lookup. The directory helper never retained a descriptor; its existing pre-registration identity observation is the last look before the registry write. `d-20261001-06` full-precision `SystemTime` governs the schema-cache probe, not `WorkspaceEntry.lastModified`, which matches `DirectoryEntry.modified_seconds`.
* **Decided by:** drain 12e7ce13-be17-4664-9d3a-1b5f120c3ba5 · Grok · **Superseded-by:** -

### d-20261003-07 — Are create-path modification times whole seconds or SystemTime?

* **Question:** Does the workspace create response report the enumerator's signed Unix seconds or the schema cache's full-precision SystemTime?
* **Governs:** f-20260913-02
* **Chosen:** The enumerator's signed Unix seconds, discarding subseconds, with a pre-1970 time as a negative `i64`.
* **Rejected:** Nanosecond `SystemTime` from `d-20261001-06`.
* **Reason:** `d-20261001-06` governs `probe_regular_file_at` and the schema cache. `WorkspaceEntry.lastModified` is the field `DirectoryEntry.modified_seconds` already fills, so a create response and a later listing of an untouched object report the same integer.
* **Decided by:** drain 12e7ce13-be17-4664-9d3a-1b5f120c3ba5 · Grok · **Superseded-by:** -

### d-20261003-08 — Is the create-path mtime change one phase or split across infra/fs.rs and file_workspace.rs?

* **Question:** Should the `modified_seconds` field ship separately from the create-path consumer and the allowlist shrink?
* **Governs:** f-20260913-02
* **Chosen:** One phase. The field, both create paths, deletion of `timestamp`, and the allowlist shrink land together.
* **Rejected:** Shipping the struct field alone.
* **Reason:** The new field is unused until the create path consumes it, and the allowlist shrink is false until `timestamp` is gone. `d-20260901-03` makes the allowlist shrink-only, so the count change belongs in the same commit as the reach it removes.
* **Decided by:** drain 12e7ce13-be17-4664-9d3a-1b5f120c3ba5 · Grok · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":26,"effect_sha256":"dd783b3b5b52f00c907f71d737ce37a3b084cfafc04a08d5627e339b7b0a0b9c","input_sha256":"33620c2d90c3940577e4c90b9b4639ab8fca6e196ad30c79f1529ee82ca12d96","kind":"mutation-receipt","operation":"4c9d2ddb24967da005d4dc553445b271492d6001fc84ff75068866aeeea9d4a1","options":{"section":null},"request_id_sha256":null,"results":["d-20261003-06","d-20261003-07","d-20261003-08"],"target":"decisions-ledger","v":1} -->

### d-20261003-09 — What does the directory listing bound measure?

* **Question:** Where does the bound on a user-chosen directory listing sit, and what does it measure?
* **Governs:** f-20260913-06
* **Chosen:** One constant, `MAX_DIRECTORY_LISTING_ENTRIES = 4_096`, equal to `MAX_AUTHORITY_IDS`. It counts non-dot directory names, including names a later `keep` drops, and it counts staged workspace nodes across one `collect_tree_entries` call. The 4097th name or staged node returns `Error::ResourceLimit` and no partial success. The check runs only when the caller passed `Some`. Database and puzzle listings are one directory, so the directory cap already bounds them.
* **Rejected:** A byte budget. A cap on kept names only. A separate time budget. Capping `walk_directory`, `sync_tree`, or `remove_tree_at`.
* **Reason:** The finding's memory failure is the materialised vec, and the registry cap it names is a count of identities. Depth 64 already exists under d-20260914-02 and d-20260830-02. Reversal path: a later decision that names a different unit and shows the count misses the accumulation the finding describes.
* **Decided by:** Grok, drain session b52c3a69-4f9f-48f1-820e-e09578b059d0, full auto, plan review of f-20260913-06 · **Superseded-by:** -

### d-20261003-10 — What does a failed listing keep in the path registry?

* **Question:** Does a listing that fails after it has prepared registry writes leave fresh identities behind?
* **Governs:** f-20260913-06
* **Chosen:** Fresh identities are not committed during the walk. One snapshot `commit_candidate`, after the net comparison at the existing registry growth check and after the reuse loop, admits every fresh identity and retires the unchanged pre-walk unobserved set together. The comparison runs before any per-entry canonicalization commit, so a refusal writes nothing. A workspace or database lookup that misses and mints is a one-for-one replacement in that candidate. A puzzle same-path identity change returns the existing `Conflict` and the snapshot commit does not run. A game-count failure or a cancellation after the workspace snapshot returns `Err` and leaves the registry matching the snapshot. `DurabilityUncertain` adopts that candidate and is not retried. A hard save error leaves the previous registry.
* **Rejected:** A registry transaction that rolls back a prefix already committed. Delaying retirement until the command returns `Ok`. A new puzzle identity-replacement path. Registering fresh ids one by one during the walk and then deleting them on failure.
* **Reason:** d-20260914-02 rejected a transaction that undoes a committed prefix and left this churn question to f-20260913-06. Game counts need the handles that the snapshot commit publishes, and the growth check refuses a candidate that grows past `MAX_AUTHORITY_IDS`. Puzzle identity mismatch is already `Conflict`. Reversal path: evidence that game counts can run on unpublished handles, which would let the snapshot wait until the command returns `Ok`.
* **Decided by:** Grok, drain session b52c3a69-4f9f-48f1-820e-e09578b059d0, full auto, plan review of f-20260913-06 · **Superseded-by:** -

### d-20261003-11 — Which identities does a successful listing release?

* **Question:** Which path-authority identities does a completed listing retire?
* **Governs:** f-20260913-06
* **Chosen:** Only ids recorded before the walk, under the authority lock, whose stored path, identity, and purpose are unchanged and which this listing did not reuse. The set is workspace `PgnFile` and `PgnWorkspace` strictly under the root and not the trash directory, database `DatabaseFile` direct children, and puzzle `PuzzleFile` direct children. An id created during the unlocked walk stays. A trash rebind changes the stored path and stays. The commit clones `persistent` under the lock at commit time. It does not call `remove_workspace_entry`.
* **Rejected:** Retiring every id the snapshot did not observe. Retiring by path prefix across every purpose. Holding the authority lock across the walk. A new mutex.
* **Reason:** The listing does not hold the authority lock across the walk, so a create that registers during the walk is a live handle. The finding's changing-tree churn is otherwise permanent once the cap is full. Reversal path: evidence that the listing holds the authority lock for the whole walk, which would make the pre-walk set unnecessary.
* **Decided by:** Grok, drain session b52c3a69-4f9f-48f1-820e-e09578b059d0, full auto, plan review of f-20260913-06 · **Superseded-by:** -

### d-20261003-12 — What does the renderer show when a listing exceeds the bound?

* **Question:** What does the user see when a workspace, database, or puzzle listing exceeds the entry bound?
* **Governs:** f-20260913-06
* **Chosen:** The existing listing error. `Error::ResourceLimit` already serializes as category `resource-limit`. No new page copy, command, event, or capability in this change. f-20260913-05 owns the Files and Databases sentence.
* **Rejected:** New renderer copy in this change. A new IPC event.
* **Reason:** The finding asks where the bound sits. The typed category the renderer already maps is enough for this change. Reversal path: Felix asking this change to own the page sentence, which moves the work into f-20260913-05's area.
* **Decided by:** Grok, drain session b52c3a69-4f9f-48f1-820e-e09578b059d0, full auto, plan review of f-20260913-06 · **Superseded-by:** -

### d-20261003-13 — Does the directory reader cap the engine-launch sweep and practice reads?

* **Question:** Does the shared directory reader cap the macOS engine-launch sweep and `AuthorizedDir::entries`?
* **Governs:** f-20260913-06
* **Chosen:** No. Both `cfg` bodies of `read_directory_entries_at` take `Option<usize>`. Windows `read_directory_entries` forwards that option into `enumerate_directory` and does not supply `Some` itself. The windows body of `read_directory_entries_at` forwards the same option. Only `CapabilityDirectory::entries` passes `Some(MAX_DIRECTORY_LISTING_ENTRIES)`. The sweep and `AuthorizedDir::entries` pass `None`, and that `None` survives the windows wrapper. Windows removal and install sync also pass `None`. No sweep cleanup protocol.
* **Rejected:** An unconditional cap inside `read_directory_entries_at` or inside `read_directory_entries`. A cleanup that deletes the lock file and instance directory a failed engine-launch init just created.
* **Reason:** The finding names `collect_tree_entries` and `map_db3_children_cancellable`. The sweep creates its lock and instance before it reads, and that error fails process startup, so a cap there cannot recover. Practice shard reads are not this finding's callers. A `Some` hidden in the windows wrapper would cap them anyway, because `AuthorizedDir::entries` reaches that wrapper. Reversal path: a decision that practice shard directories and the engine-launch root are user-chosen listings under this finding.
* **Decided by:** Grok, drain session b52c3a69-4f9f-48f1-820e-e09578b059d0, full auto, plan review of f-20260913-06 · **Superseded-by:** -

### d-20261003-14 — Is the file-wide FreeBSD cfg flip a gate for the listing bound?

* **Question:** Does the listing-bound change have to make a file-wide `target_os = "linux"` to `target_os = "freebsd"` flip compile?
* **Governs:** f-20260913-06
* **Chosen:** No. The flip is a recorded limitation. On HEAD `b13f3b52`, a guard-preserving flip of `infra/fs.rs` and `path_authority/mod.rs` in a throwaway worktree, checked with that worktree's manifest, exited 101. Missing `dist` is not the only error: macOS `StatFs` and `libc::MNT_UNION` branches compile on Linux after the flip, and linux-only engine methods drop out while their callers remain. Host tests of the `cfg(unix)` cap, a source pin that the optional cap applies only for `Some`, `pnpm rust:windows:check`, and the existing `rust-windows-test`, `rust-macos-test`, and `rust-platform` jobs are the proof. The guard at `path_authority/mod.rs` stays. If the phase adds a new linux cfg line, only that new line is flipped, in a worktree, with checkout `dist` symlinked. This phase adds no such line. Do not rewrite the macOS branches or the linux-only engine methods to make the file-wide flip pass.
* **Rejected:** Pointing the probe at the checkout manifest. Replacing `target_os = "linux"` inside the unsupported-unix `compile_error` guard. Adding an apple-darwin or freebsd rustup target. Rewriting pre-existing macOS filesystem branches so the file-wide flip is green.
* **Reason:** A focused review-plan judgment approved this limit after the guard-exempt probe. The flip's purpose is to compile non-linux bodies on a Linux host. On these two files that compile fails for reasons that predate the listing bound. Reversal path: a measurement that the same guard-preserving flip, with `dist` supplied, exits 0 without edits outside the new cfg lines.
* **Decided by:** Grok, drain session b52c3a69-4f9f-48f1-820e-e09578b059d0, full auto, plan review of f-20260913-06 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":53,"effect_sha256":"ff78acf08bfbe400f2127f2e1262b6030e702fdc4533b02a2820f3e6c66b50f2","input_sha256":"3d30ab95b419f9bf087c3a077192bc594f96747b473590c6cd437b349290cb47","kind":"mutation-receipt","operation":"f566f69c8d94f73216153c72e3ed357960227d813063b4c410b60b4fd91c32fc","options":{"section":"2026-10-03 \u2014 recorded through the decisions lock"},"request_id_sha256":null,"results":["d-20261003-09","d-20261003-10","d-20261003-11","d-20261003-12","d-20261003-13","d-20261003-14"],"target":"decisions-ledger","v":1} -->

### d-20261003-15 — What does the renderer's game tree store as a move's NAG identity?

* **Question:** How does the in-memory tree hold a move's annotations so that no NAG is lost between parse, display, edit and save?
* **Governs:** f-20261001-12
* **Chosen:** Raw NAG codes. `TreeNode.annotations: Annotation[]` becomes `TreeNode.nags: number[]` — integers 0..=255 in insertion order, duplicates kept. The parser appends every `$n` token whose `n` parses as an integer in 0..=255; a token that does not parse is ignored and never stored as a placeholder. The glyph type `Annotation` stays only as the display vocabulary, and `""` is never stored.
* **Rejected:** Adding `$8` → □ and `$11` → = to `NAG_INFO` while keeping glyphs as identity: the badge would be fixed, but the writer emits one canonical code per glyph, so every `$8` would be saved as `$7` and every `$11` as `$10`, and every other unmapped NAG would still be deleted. Also rejected: keeping glyphs plus a parallel raw-code field, which gives one fact two sources of truth.
* **Reason:** The database already stores NAGs losslessly as raw `$n` strings (`src-tauri/src/db/encoding.rs`); the loss was entirely in the renderer's glyph model, and only a code-keyed model preserves both the alias numbers and NAGs without a glyph. Reversal path: a later decision has to show another representation that round-trips `1. e4 $8 $8 c6 $11 … $220 … $0 … $255` through `getPGN` unchanged (plan test 1 in `src/utils/tests/chess.test.ts`).
* **Decided by:** Claude Code, build run of f-20261001-12 (plan reviewed 2026-10-01, implemented 2026-10-03), full auto · **Superseded-by:** -

### d-20261003-16 — Which code does the Annotate panel write for □ and =, and what happens to existing aliases?

* **Question:** □ is both `$7` and `$8`, and = is both `$10` and `$11`. Which code does setting the glyph write, and how do the toggles treat an alias that is already present?
* **Governs:** f-20261001-12
* **Chosen:** The canonical code stays `$7` for □ and `$10` for = (`ANNOTATION_INFO[glyph].nag`). A glyph button is active when any stored code has that glyph, so □ is active for `$7` or `$8` and = for `$10` or `$11`. Clicking an active button removes every code with that glyph. Clicking an inactive button removes the codes of its group (`basic` or `advantage`) and appends the canonical code. An existing `$8` or `$11` is therefore kept, because the toggle adds the canonical code only when the glyph is absent. `goToAnnotation` matches any code with the requested glyph.
* **Rejected:** Writing `$8`/`$11` as canonical, which would change today's output for every user who sets □ or =. Also rejected: matching toggles on exact codes, which would leave the □ button inactive on a ChessBase `$8` and let a click add a second □ code.
* **Reason:** `$7` and `$10` match today's output and the standard NAG table Lichess uses. Glyph-class toggling is what the user sees: one □ symbol, one □ button. Reversal path: change `ANNOTATION_INFO`'s canonical `nag` and the alias toggle tests in `src/components/common/NagDisplay.test.tsx` and the alias `goToAnnotation` tests in `src/state/store/tree.test.ts` go red.
* **Decided by:** Claude Code, build run of f-20261001-12 (plan reviewed 2026-10-01, implemented 2026-10-03), full auto · **Superseded-by:** -

### d-20261003-17 — What does a NAG without a glyph do in the renderer?

* **Question:** A PGN can carry any NAG `$0`–`$255`, and most have no agreed glyph. How are those shown and saved?
* **Governs:** f-20261001-12
* **Chosen:** They are kept in `nags` and written back on save with their original number, but not drawn. The display projection `nagGlyphs(nags)` returns only codes that have a glyph, ordered by ascending code, so a code without a glyph never draws an empty grey badge and never displaces a real symbol from the primary-glyph position.
* **Rejected:** Drawing the numeric code (`$220`) as a badge or label, which adds a new visual vocabulary no finding asked for. Also rejected: adding symbols or translation keys for further NAGs, since Felix's files show no NAG beyond `$8`/`$11` that lacks a glyph.
* **Reason:** M2 (nothing lost) and M3 (no empty badge, no displaced symbol) of f-20261001-12 both hold with a hidden but preserved code; the standard NAG table has about 140 entries, most of them with no agreed glyph. Reversal path: add an entry to the code→glyph catalogue in `src/utils/annotation.ts`; the projection tests in `src/utils/tests/chess.test.ts` and the rendered-consumer tests in `src/components/common/NagDisplay.test.tsx` pin which codes currently draw nothing.
* **Decided by:** Claude Code, build run of f-20261001-12 (plan reviewed 2026-10-01, implemented 2026-10-03), full auto · **Superseded-by:** -

### d-20261003-18 — In what order and multiplicity are a move's NAGs written to PGN?

* **Question:** Does the PGN writer preserve the read order and duplicates of a move's NAGs?
* **Governs:** f-20261001-12
* **Chosen:** Order is normalised to ascending code. Multiplicity is kept (`$8 $8` is written twice). Only the first code written after a move may use the attached suffix glyph, and only when it is 1–6. Every other code is written ` $n` with its original number, so `[1, 2]` is written `e4! $2`, never `e4!?`.
* **Rejected:** Preserving the read order, which carries no information in PGN and would leave a quality code behind a positional one, so no suffix glyph could be used (`e4 $14 $1` instead of `e4! $14`). Also rejected: deduplicating, which loses a repeated NAG on save. Also rejected: two adjacent suffix glyphs, because pgn-reader reads `!?` as the single code 5 (`pgn-reader-0.26.0/src/reader.rs:343-353`).
* **Reason:** Sorting puts the move-quality code first so the one suffix glyph lands on it, and output stays readable. The round trip keeps the same multiset of codes on every node. Reversal path: plan test 1 asserts `d4! $2`, `dxe4?! $146` and `e4 $8 $8` and goes red on another order or on deduplication.
* **Decided by:** Claude Code, build run of f-20261001-12 (plan reviewed 2026-10-01, implemented 2026-10-03), full auto · **Superseded-by:** -

### d-20261003-19 — How do tabs persisted in the old 26-glyph shape migrate?

* **Question:** Open tabs persist their tree in `sessionStorage` with `annotations: Annotation[]`. How do they load once the schema stores `nags: number[]`?
* **Governs:** f-20261001-12
* **Chosen:** A coercion migration without a storage version bump. `TREE_STORAGE_VERSION` stays 1. The existing node walk in `migrateTreeForStorage` converts a node that has an `annotations` array and no `nags` array, and only if every element is a value the old 26-member enum accepted. Each glyph becomes its canonical code in stored order, so `["□", "□"]` becomes `[7, 7]`. `""` is dropped. `annotations` is removed. A node with a non-enum element is left unchanged, so the required `nags` field fails validation and the tab takes the existing unreadable path, with its raw bytes kept and recovery offered. A node that already carries `nags` is unchanged, so the migration is idempotent. A failed write-back keeps today's `readTree` behaviour: the session uses the migrated tree and the migration runs again on the next read.
* **Rejected:** Bumping `TREE_STORAGE_VERSION` with a versioned migrator, which the existing coercion migrations (`migrateLegacyNodeComments`) deliberately avoid. Also rejected: silently dropping unknown legacy strings, which would turn a gated unreadable tab into a rewritten readable one.
* **Reason:** This follows the existing coercion precedent in `src/state/store/tabStorage.ts` and the persisted-state rule, which keeps undecodable tab trees gated. Known limit: a tab opened before the fix holds only what the old parser kept. A lost `$8`/`$11` is `""` there, and an alias is collapsed (`$23` came in as ⨀ and migrates to `$22`). Such tabs must be reopened from their file before saving. Reversal path: the migration tests in `src/state/store/tabStorage.test.ts`.
* **Decided by:** Claude Code, build run of f-20261001-12 (plan reviewed 2026-10-01, implemented 2026-10-03), full auto · **Superseded-by:** d-20261003-20
<!-- ledger-meta {"command":"record-decision","effect_lines":44,"effect_sha256":"c357093dfdeead6658943d4887a3aca4f0436d52a481fc48bc3a06b205882cb1","input_sha256":"686eecc72dbb6476db20c02094895b7f747af4c9929f2116f29630473e9c804f","kind":"mutation-receipt","operation":"62026b1ac069d36c2ec40c0aff7db92c06e895d855a1aeb0a2c14b9cd5310b56","options":{"section":null},"request_id_sha256":null,"results":["d-20261003-15","d-20261003-16","d-20261003-17","d-20261003-18","d-20261003-19"],"target":"decisions-ledger","v":1} -->

### d-20261003-20 — Which legacy tab nodes does the NAG migration convert, and how long may their arrays be?

* **Question:** d-20261003-19 states the migration converts a node with "an `annotations` array and no `nags` array". The cumulative diff review showed that this guard and an uncapped legacy parse both turn trees the old schema kept unreadable into readable ones. Which nodes convert?
* **Governs:** f-20261001-12
* **Chosen:** Everything in d-20261003-19 stands, with two refinements. (1) The node must have no own `nags` key at all. A node whose `nags` is present but corrupt (`"x"`, `null`) is left unchanged and stays on the unreadable path with its raw bytes. (2) The legacy `annotations` array must also satisfy the old schema's length cap. One named constant, `MAX_NODE_NAGS = 1_024`, bounds both the legacy parse and the persisted `nags` array, so a 1,025-glyph legacy node stays unreadable even after its `""` entries would have been dropped.
* **Rejected:** Converting whenever `nags` is not an array, which overwrote a corrupt value into a readable tree (diff review r1, D1). Also rejected: parsing the legacy array without the old cap, which let a 1,025-glyph node with `""` entries migrate into a tree the old schema rejected (diff review r3, R3-1).
* **Reason:** d-20261003-19 promised to convert "only if every element is a value the old schema accepted". Its own premise requires the old schema's array bound, and requires that a present-but-corrupt field never be repaired. New evidence: review findings D1 and R3-1 in `tasks/handoffs/2026-10-01-lossless-nags-review.md`, fixed in `2f4dc8c4` and `fb69f852`. Reversal path: the tests "legacy annotations never repair corrupt own nags", "legacy NAG migration refuses oversized annotations…" and "…accepts the annotations length boundary" in `src/state/store/tabStorage.test.ts`.
* **Decided by:** Claude Code, build run of f-20261001-12, cumulative diff review 2026-10-03, full auto · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"f0067744b3060450e0518cdacb274365cd392fbbf51d3ca531dddb14441b0262","input_sha256":"40fae4f25790b5d0fe14e22a826ba4d86e044a54de619b32e3224cb6b5f63633","kind":"mutation-receipt","operation":"0151ef922d40a90b85969be1bc6be78aec5cdddd1c5c4d6cbf8be7cacb622132","options":{"section":null},"request_id_sha256":null,"results":["d-20261003-20"],"target":"decisions-ledger","v":1} -->

### d-20261003-21 — How does the renderer know that a listing failure is a failure of the chosen root?

* **Question:** Which signal tells the Files and Databases pages that a listing failed because the chosen root itself is unusable, as opposed to a child entry or a transient race?
* **Governs:** f-20260913-05
* **Chosen:** An optional, additive `rootFailure` field on `ErrorPayload` (`changed`, `missing`, `unusable`, `permission`, `too-large`), set only by the backend: `too-large` where the listing bound and depth refusals are raised; otherwise a read-only post-failure root probe in `list_file_workspace` and `list_workspace_databases` (lock and initialization failures end it with no label; then `capability_directory`; then the root's own entry stream under the same bound, keeping no entry), whose error variant gives the label attached to the original error; `get_database_workspace` default-root acquisition errors by variant; and the two picker same-path refusals as `changed`. Category and message never change. The renderer reads only the field, never message text.
* **Rejected:** Matching category plus exact backend message literals in the renderer (the rejected planner draft) — the same payload arises from child entries, so a vanished PGN would read as a lost collection. Labelling by variant at root call sites — root enumeration propagates child `statat` failures. New backend `ErrorCategory` values — they would replace the category other consumers read. Renderer-only hedged copy. An eighth `AppErrorCategory` (`d-20260901-34`, `d-20260904-06`).
* **Reason:** Plan review of f-20260913-05 (rounds 1-4, locate probe `probe-1-r1`, focused judgment `judge-n9-r3`) measured that only the producer can tell root from child. It also dissolves the copied-literal coupling the draft deferred (inbox `20261003-184054-586846-1791045654702385479-4.md`). Reversal path: a backend that types root failures as their own error variants, at which point the field can be derived from them.
* **Decided by:** Claude Code, drain session 53d740d4-5be5-4005-a744-b433a462eb1b, full auto, plan review of f-20260913-05 · **Superseded-by:** -

### d-20261003-22 — Which root errors map to which label, and which never get one?

* **Question:** How is a root-site error turned into a `rootFailure` value?
* **Governs:** f-20260913-05
* **Chosen:** `Io(NotFound)` missing; `Io(PermissionDenied)` permission; `InvalidInput` and `Io(InvalidInput)` unusable; `Conflict` changed; a listing-bound `ResourceLimit` too-large; anything else unlabelled. Authority lock poisoning and initialization, operation admission and ticket claims, registry capacity, persistence and durability are never labelled and keep the retry sentence.
* **Rejected:** Labelling poison or an uninitialized authority (choosing another root cannot recover them; only a restart does). Labelling every `resource-limit` (a full path registry is not a property of the root). A Windows ACL-deny test fixture (the label comes from `io::ErrorKind`; the standard library maps `ERROR_ACCESS_DENIED` to `PermissionDenied`).
* **Reason:** The label means "retrying cannot succeed until the root is re-selected" (f-20260913-05 MANDATE). Reversal path: an error the mapping labels whose recovery is not re-selection.
* **Decided by:** Claude Code, drain session 53d740d4-5be5-4005-a744-b433a462eb1b, full auto, plan review of f-20260913-05 · **Superseded-by:** -

### d-20261003-23 — What do the Files and Databases pages say for each listing failure, and what does re-selection do?

* **Question:** Which sentence and recovery action does each presentation get?
* **Governs:** f-20260913-05
* **Chosen:** Retry keeps "… could not be loaded. Please try again." Each `rootFailure` value gets its own sentence ending "Choose another." (changed, no longer available, cannot be opened, not allowed to read, too large to list); the too-large sentence names no number. Files re-selects through its existing header button; Databases shows one "Choose database folder" button inside the alert for the five re-select presentations only. A picker's own same-path refusal notifies the page's changed sentence. No removal action. Databases shows its empty-success state only after a successful empty listing.
* **Rejected:** "Choose it again" — both pickers refuse the same replaced path and mint nothing. A link to Settings. A button on the retry alert. A shared React alert component (Files already has a header button). Removing a stale entry from a whole-list failure (there is no selected entry and no command removes a root).
* **Reason:** The MANDATE's wrong instruction was "try again" for a root that retrying cannot fix; `d-20261003-12` gives the over-bound sentence to this finding. Reversal path: a supported same-path re-registration command.
* **Decided by:** Claude Code, drain session 53d740d4-5be5-4005-a744-b433a462eb1b, full auto, plan review of f-20260913-05 · **Superseded-by:** -

### d-20261003-24 — How does the Databases page relist after a re-selection without old-root results winning?

* **Question:** After `issueDatabaseWorkspace` returns a handle, how is the shared `"databases"` request refreshed so that no request started before the switch changes what the page shows?
* **Governs:** f-20260913-05
* **Chosen:** Supersede: abort every running `"databases"` generation and reject every subscriber's promise for it with a cancellation at that moment (raced against the abort signal, later outcomes of the underlying work dropped), then revalidate only after those cancellations have been delivered to SWR.
* **Rejected:** A bare `mutate()` (`useNativeRequestOwner.run` returns the running generation that already read the old root). Waiting for running generations (a stalled old listing blocks recovery forever). Abort and detach alone (SWR 2.4.0 stores a late rejection without a staleness check). Cancellation settled when the work ends (a late cancellation can overwrite the fresh failure).
* **Reason:** Plan review rounds 1-6 of f-20260913-05, SWR source `dist/index/index.mjs:416` versus `:463-497`, and the round-6 focused judgment. `async-resource-invariants.md`: use a discriminator, never timing. Reversal path: a per-root SWR key, which makes the old and new requests different identities.
* **Decided by:** Claude Code, drain session 53d740d4-5be5-4005-a744-b433a462eb1b, full auto, plan review of f-20260913-05 · **Superseded-by:** -

### d-20261003-25 — Which native pickers share the in-flight guard?

* **Question:** Does the Databases picker get its own copy of the Files in-flight guard, and does Settings' `DirectorySetting` join a shared one?
* **Governs:** f-20260913-05
* **Chosen:** One shared guard for Files, Databases and `DirectorySetting`: a second activation while one is pending does nothing, and pending clears on success, cancellation and rejection. Each caller keeps its own command and outcome handling; Settings' visible behaviour is unchanged.
* **Rejected:** A third inline copy on Databases. Leaving `DirectorySetting` on its own copy (the rejected draft's "no Settings change" non-goal).
* **Reason:** Universal rule 11 (extract at the second copy, route every copy through it); `review-minimalism` r1. Reversal path: a picker whose guard must differ, passed as a parameter.
* **Decided by:** Claude Code, drain session 53d740d4-5be5-4005-a744-b433a462eb1b, full auto, plan review of f-20260913-05 · **Superseded-by:** -

### d-20261003-26 — How is the real IPC path of `rootFailure` proven?

* **Question:** Which check shows that the field survives the real Tauri command path to the rendered page?
* **Governs:** f-20260913-05
* **Chosen:** One committed assertion in `scripts/verify-app.mjs` (`pnpm verify:app`): an isolated profile whose app-owned default database root is a regular file renders the `unusable` sentence and the Databases chooser, with a staged-failure row. Run after `pnpm build` in the browser-verification stage; not a push gate.
* **Rejected:** A one-off scratch script (not re-runnable). Container e2e alone (mocked IPC). Making `verify:app` a push gate (it needs a compositor CI lacks).
* **Reason:** `review-tests` r2-r3 of f-20260913-05. Reversal path: a CI-capable real-IPC harness.
* **Decided by:** Claude Code, drain session 53d740d4-5be5-4005-a744-b433a462eb1b, full auto, plan review of f-20260913-05 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":53,"effect_sha256":"9d16069f7a102c44e3580dea5e65fcda54f2d76d6b993d9a53b75f33f44d4edb","input_sha256":"3272cb01da74b4c88106fce33d279da4b4a75bcaad4cd744e6ae9309a73879c5","kind":"mutation-receipt","operation":"e5cf016449a2c8d70d9ffe0b0a154fbdcd5f0ee9b499615a076835c0777e584e","options":{"section":null},"request_id_sha256":null,"results":["d-20261003-21","d-20261003-22","d-20261003-23","d-20261003-24","d-20261003-25","d-20261003-26"],"target":"decisions-ledger","v":1} -->

## 2026-10-04 — recorded through the decisions lock

### d-20261004-01 — What is the PGN page contract: a byte budget with continuation, or a streaming reader?

* **Question:** How does `read_games` bound one call's materialised PGN text, and how does a consumer get the rest?
* **Governs:** f-20260914-05
* **Chosen:** `read_games(file, start, end)` returns a non-empty prefix of the requested inclusive range, selected on the cached index before any read while the running sum of scanned game byte lengths stays within the page byte budget (a game landing exactly on the budget is included; the first requested game is always selected, so a game over `MAX_PGN_BYTES` still fails with `ResourceLimit`). The renderer (`GameSelector.loadPage`) continues from `start + rows received` until the range is covered or a page is empty.
* **Rejected:** A Tauri channel or event stream (a new IPC event surface with listener lifetimes, for a ≤1 000-row virtual list); refusing an over-budget page with an error (files of large games become unbrowsable); an explicit `next`/`truncated` response field (a bindings change carrying what the result length already says).
* **Reason:** The cached index knows every game's size before reading, so the bound is enforced before allocation with no new IPC surface. Reversal path: a consumer that needs to distinguish a short page from end-of-range without a follow-up call.
* **Decided by:** Claude Code, drain session 648a7fac-1f9b-4bc0-8e9a-df298dc5f16d, full auto, adopted reviewed plan of f-20260914-05 (planned ahead, 8 review rounds) · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"5e79090b510de6e9610f5cece89ae77ab1bf50cd7388683949fa2e3185fe54df","input_sha256":"e2e2fadcf3b0a71a9ca5a3d9b9078dc292ffe16ba961fe9cf3847a0406b19632","kind":"mutation-receipt","operation":"88754a87a9dbc3c810761af98b24413452b2ef0edd2d5198555f268bd4b499f9","options":{"section":null},"request_id_sha256":null,"results":["d-20261004-01"],"target":"decisions-ledger","v":1} -->

### d-20261004-02 — What is the byte budget of one PGN page?

* **Question:** Which value does `MAX_PAGE_BYTES` take?
* **Governs:** f-20260914-05
* **Chosen:** `MAX_PAGE_BYTES = MAX_PGN_BYTES` (10 MiB); with the first-game rule no page exceeds 10 MiB, the ceiling one `read_game` call already has.
* **Rejected:** A smaller budget such as 1 MiB (more round trips for ordinary pages while one `read_game` may already carry 10 MiB).
* **Reason:** Keeps the existing largest single IPC response as the only ceiling. Reversal path: a measured memory or latency problem at a 10 MiB page.
* **Decided by:** Claude Code, drain session 648a7fac-1f9b-4bc0-8e9a-df298dc5f16d, full auto, adopted reviewed plan of f-20260914-05 (planned ahead, 8 review rounds) · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"21a0d92d193cec57a0065d2541c49dd4bd575b06bfd75d7017c0f930fca56041","input_sha256":"608b7dc18a15c9f9e8f4e57d9f21f3898181bc0aa49cd4da1d34c85011da5d36","kind":"mutation-receipt","operation":"d6a32164f38ecf0f4e5930c2db88663f1e6a80b5c127f47cdc1d5d3975daed7a","options":{"section":null},"request_id_sha256":null,"results":["d-20261004-02"],"target":"decisions-ledger","v":1} -->

### d-20261004-03 — Which layer owns continuation over short PGN pages?

* **Question:** Where does the renderer loop over short `readGames` pages?
* **Governs:** f-20260914-05
* **Chosen:** `GameSelector.loadPage`, the sole multi-row consumer; each page is reduced to header rows before the next call, a rejected page rejects the whole load (no partial merge), and a non-cancellation failure is surfaced once per load through `notifyUnlessCancelled`.
* **Rejected:** `useVirtualPageLoader` (generic range-keyed dedupe; the short-page rule is a `readGames` property); the platform facade (would hide a multi-call loop behind one command name).
* **Reason:** The short-page contract belongs to the one command and its one multi-row caller. Reversal path: a second multi-row `readGames` consumer, which would extract the loop (rule 11).
* **Decided by:** Claude Code, drain session 648a7fac-1f9b-4bc0-8e9a-df298dc5f16d, full auto, adopted reviewed plan of f-20260914-05 (planned ahead, 8 review rounds) · **Superseded-by:** d-20261004-05
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"91249f3c913a96bba789f5857182891e2a3c3c529ceed3517aff07c23a0436ae","input_sha256":"197bf84312ca6a594a10b02b8c7bdd42695b74cfcec353144ce30d9c41955be4","kind":"mutation-receipt","operation":"171a04031eb14f232c8a01e709913f70cd555bf3205277153e2d41a8296432ed","options":{"section":null},"request_id_sha256":null,"results":["d-20261004-03"],"target":"decisions-ledger","v":1} -->

### d-20261004-04 — Does f-20260914-05 still change ImportModal's whole-corpus probe?

* **Question:** The finding names ImportModal requesting the whole corpus through `readGames` and rejecting a 1 001-game file; does this change need to touch it?
* **Governs:** f-20260914-05
* **Chosen:** No change: `fefd7a5f` (`d-20260927-01`) already streams a saved PGN natively and `ImportModal.tsx` no longer calls `readGames`.
* **Rejected:** Re-adding a paged probe to ImportModal (nothing calls it).
* **Reason:** The clause is already resolved in the tree. Reversal path: ImportModal regaining a `readGames` call.
* **Decided by:** Claude Code, drain session 648a7fac-1f9b-4bc0-8e9a-df298dc5f16d, full auto, adopted reviewed plan of f-20260914-05 (planned ahead, 8 review rounds) · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"4f4d4de012c333582fa86e165fc8befaa81dd2da585cad7265ae150ab10b2640","input_sha256":"fd8b0c20e7552b29da4ba9be6f11913abcf9b48d29de3cb98ca7da5ac77f4ba5","kind":"mutation-receipt","operation":"56f9f45c2c265f51b11f892c8a478921484c3b911e4a0067e03c14a29ef3ebd1","options":{"section":null},"request_id_sha256":null,"results":["d-20261004-04"],"target":"decisions-ledger","v":1} -->

### d-20261004-05 — Which layer owns continuation over short PGN pages, and what does a failed load return?

* **Question:** Where does the renderer loop over short `readGames` pages, and how does a failed page end the load?
* **Governs:** f-20260914-05
* **Supersedes:** d-20261004-03, as to its wording of the failure outcome only. That entry said a rejected page "rejects the whole load", which reads as a rejected load promise; the implementation (`9b859a90`) and the plan's own failure rule (no rejection may reach a `loadMoreRows` call site unhandled) resolve the load with no rows instead. The owner decision is unchanged and was not re-asked.
* **Chosen:** `GameSelector.loadPage`, the sole multi-row consumer, owns the loop; each page is reduced to header rows before the next call. A failed page discards every row of that load (nothing is merged) and the load resolves with no rows, so no rejection reaches either call site; an ordinary failure is surfaced once per load through `notifyUnlessCancelled`, a cancellation or any failure after the load's signal aborted stays silent.
* **Rejected:** `useVirtualPageLoader` (generic range-keyed dedupe; the short-page rule is a `readGames` property); the platform facade (would hide a multi-call loop behind one command name); rejecting the load promise (both call sites drop it with `void`, so it becomes an unhandled rejection).
* **Reason:** The short-page contract belongs to the one command and its one multi-row caller. Reversal path: a second multi-row `readGames` consumer, which would extract the loop (rule 11).
* **Decided by:** Claude Code, drain session 648a7fac-1f9b-4bc0-8e9a-df298dc5f16d, full auto, cumulative diff review (records lens) of f-20260914-05 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":9,"effect_sha256":"fae5472a4512aa5de562c2721510af91f1c2b0cc3ec6a266a4ecef27ee5e07cb","input_sha256":"c24a8e07328d3a907874f3520fd16b7d7d10321657ae994ef9bcb0afb3df14b9","kind":"mutation-receipt","operation":"77bde610dd74e0d14595e4692852633c6b1e424fee76b6f76114484cc2e7926c","options":{"section":null},"request_id_sha256":null,"results":["d-20261004-05"],"target":"decisions-ledger","v":1} -->

### d-20261004-06 — Are concurrent conversions into one database refused, or tracked per operation?

* **Question:** Are concurrent PGN conversions into one database refused (one conversion per target), or tracked separately per operation?
* **Governs:** f-20260914-06
* **Supersedes:** d-20260904-16, as to its conversion half only. Its premise was that a conversion's identity is known before the call because the target database identifies it; new evidence: the backend queues a second conversion into the same target behind `with_write_lock_cancellable` instead of refusing it, so the target is not unique per operation. The `get_players_game_info` per-call UUID half stands.
* **Chosen:** Track per operation: each conversion start mints `conversion:` plus `crypto.randomUUID()`, passes it as `convertPgn`'s `progressId`, and keys its own entry in an in-memory ordered registry of active conversions; `conversionProgressId(handle)` is removed.
* **Rejected:** Refusing a second conversion into the same target, in the renderer (not authoritative for native jobs) or natively (a new per-target registry and error surface); a single slot with a per-operation id (the earlier of two concurrent operations is overwritten and runs unseen).
* **Reason:** The backend already serializes same-target writes safely, so refusing removes a working capability; refusing also leaves the different-target single-slot loss unfixed. No Rust or binding change is needed. Reversal path: a product decision that one database accepts only one import at a time.
* **Decided by:** Claude Code, drain session 0fa004d0-93e4-4004-86d2-6652e891bd6e, full auto, adopted reviewed plan of f-20260914-06 (planned ahead, 3 review rounds) · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":9,"effect_sha256":"1317af54034f083d6b6895f22b206812d3a70b203b48ed00f3194627d57808b3","input_sha256":"f995247eec5603f74296486d4bca2c5eed5acc2e53324f8a086538055c57ba0e","kind":"mutation-receipt","operation":"798e2b527dd42f81ff4c70f7769347e728b97d01fa4e549842fc006cd29a7d9a","options":{"section":null},"request_id_sha256":null,"results":["d-20261004-06"],"target":"decisions-ledger","v":1} -->

### d-20261004-07 — Which teardown may remove a conversion's renderer state?

* **Question:** Which teardown may remove an entry from the conversion progress state?
* **Governs:** f-20260914-06
* **Supersedes:** d-20260904-18. Handle compare-and-clear cannot tell two operations on one target apart, because same-target operations share a handle. Its constraints still hold by construction: the `setLoading` bridge and AccountCard's `onClick` `finally` still write no conversion state, AddDatabase still registers its entry before the handle exists, and AccountCard's removal still sits inside `convert()`.
* **Chosen:** Only the route that minted the operation id, removing by that id on every exit path (success, `convertPgn` rejection, a throw before `convertPgn`), through one shared lifecycle primitive used by all three routes; `clearOwnedConversion` is removed.
* **Rejected:** Handle compare-and-clear (d-20260904-18).
* **Reason:** A handle cannot carry ownership when two operations share a target. Reversal path: none expected while concurrent same-target conversions exist.
* **Decided by:** Claude Code, drain session 0fa004d0-93e4-4004-86d2-6652e891bd6e, full auto, adopted reviewed plan of f-20260914-06 (planned ahead, 3 review rounds) · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":9,"effect_sha256":"b0d1aa5535bfe3864fb9d1b66fa1e28a6fb035bf033b040bc7b2e5fb57eeff2c","input_sha256":"43cbd4e623774e070e13a530fadc7987b22ad3e2cff573f26af4ed68c9a1dca9","kind":"mutation-receipt","operation":"7095fc69f6777f08707766c393b21fa1f69ba0315b120d3617cdd7b7ae30e758","options":{"section":null},"request_id_sha256":null,"results":["d-20261004-07"],"target":"decisions-ledger","v":1} -->

### d-20261004-08 — Where does the AccountCard post-import refresh lineage stop in the f-20260914-06 diff review?

* **Question:** The diff review of f-20260914-06 found five successive defects in AccountCard's post-import database refresh (EH1, C1, C3/EH5, C4, C5, C6, then C7), each a rarer interleaving of SWR mutation ordering and `useNativeRequestOwner` generations; keep patching in this run, or stop and hand the remaining timing contract to a dedicated build?
* **Governs:** f-20260914-06
* **Chosen:** Stop after round 7. Ship the current mechanism (action-owned per-account pending atom; one refresh in a `finally` around conversion and cleanup; Accounts on the shared SWR "databases" key; `supersede()` then a data-bearing `mutate` whose read runs through the owner), and file C7 (remount during the owned refresh) as a build finding to be decided with the native-owner rejoin finding.
* **Rejected:** A further repair round on C7 in this run (each of the last five rounds moved the defect to a rarer interleaving of the same shared contract, after two focused judgments — the non-convergence trigger); reverting to the pre-review AccountCard (strictly staler in every traced interleaving).
* **Reason:** push-review-policy §4a.3 and build §4 escalation: a lineage that reopens after a focused judgment is a model problem, not a patch problem, and the model here is the shared owner/SWR contract, which spans five consumers and three producers this run did not own. C7 is not a regression against BASE: before this change a remounted Accounts always kept its mount-time list until the next navigation. Reversal path: the build that settles the owner/SWR contract replaces this refresh with whatever that contract prescribes.
* **Decided by:** Claude Code, drain session 0fa004d0-93e4-4004-86d2-6652e891bd6e, full auto, cumulative diff review of f-20260914-06 · **Superseded-by:** d-20261004-09
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"9009352ddcae3ac89f2041af62f658b340f48e5870c98502bcfe53740db4d5f1","input_sha256":"83fb58db1f4bb2be7c324bdfa71e48abf0379ccd13472cae4eda1bb722b27ad7","kind":"mutation-receipt","operation":"74ef3c1afad5697c5ab6d0c7a7395cdc407c8e2a641ff4ff73b3b2cf7da6bad3","options":{"section":null},"request_id_sha256":null,"results":["d-20261004-08"],"target":"decisions-ledger","v":1} -->

### d-20261004-09 — Is the AccountCard remount-during-refresh gap (C7) deferred or fixed in the f-20260914-06 run?

* **Question:** Closure round 7 of the f-20260914-06 diff review found C7 (a remount during AccountCard's owned post-import refresh leaves pre-import counts); `d-20261004-08` deferred it as not a regression against BASE. Does it stay deferred?
* **Governs:** f-20260914-06
* **Supersedes:** d-20261004-08. New evidence: the records lens showed the premise false — at BASE every `Accounts` mount issued its own `getDatabases()` into local state, so a remount after an import listed fresh counts; C7 was a regression of this change, and a regression is never deferred (push-review-policy §4). Its lineage description was also overstated: EH1 and C1 were progress-event refresh defects; the SWR/request-owner interleavings start with C4/`30139f45`.
* **Chosen:** Fixed in the run (`e4d560b7`): the post-import mutation no longer passes `revalidate: false`, so SWR 2.4's `internalMutate` revalidates the mounted consumers after the mutation settles (resolved or rejected); that listing starts after the mutation's end and is accepted, and because the refresh supersedes older generations first it can only start or join a post-cleanup listing. Closure round 8 (correctness, tests) closed C7 with no new finding. The C7 inbox entry filed in round 7 is resolved by `e4d560b7` and is to be closed as handled when it is merged.
* **Rejected:** Keeping the deferral (ships a regression); `revalidate: false` plus a manual retry after a cancellation the producer did not request (a second refresh owner).
* **Reason:** The deferral rested on a false premise; the fix is one option on the existing mechanism, measured in the installed SWR source and proven by a real-tree remount test that fails with the option restored. Reversal path: the build that settles the native-owner/SWR contract for the other producers may replace this refresh.
* **Decided by:** Claude Code, drain session 0fa004d0-93e4-4004-86d2-6652e891bd6e, full auto, cumulative diff review of f-20260914-06 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":9,"effect_sha256":"68e99a65399a4785fa98864ddcce08e1a8c5f170c3eecc87688cd870b0f6e924","input_sha256":"5fe9c16786fe18eb228c902ae1bf23e98ca2b8dbfdf248e92392eb9d035a9bbc","kind":"mutation-receipt","operation":"fdc3045dc1eef98f16b0e1371c98df579e8a8dd92a54d2913555b49fe674ed27","options":{"section":null},"request_id_sha256":null,"results":["d-20261004-09"],"target":"decisions-ledger","v":1} -->

### d-20261004-10 — Does the f-20260914-06 concurrent-conversions e2e case keep a full-page screenshot?

* **Question:** The plan's Phase 1 required test 6 added one container snapshot of two concurrent conversion rows; CI run 37185985628 failed it on a Mantine scrollbar thumb whose visibility depends on timers. Stabilise the capture or drop it?
* **Governs:** f-20260914-06
* **Chosen:** Drop the screenshot (`78ef7db9`) and keep the case's behavioural assertions: both rows' text with their own counters after `convert-progress` frames (CR-1), the second row reachable by scrolling (`toBeInViewport`), Add new disabled. The snapshot file is deleted.
* **Rejected:** Taking the capture before scrolling (measured: the thumb also shows on content resize); a `toHaveScreenshot` `style` hiding `[data-mantine-scrollbar]` (measured in the pinned container: the thumbs stayed in the capture); waiting for zero mounted scrollbars (measured: seven stay mounted, only `data-state` toggles); changing the app's ScrollArea type for a test (product code bent to a harness).
* **Reason:** A pixel pin that depends on a fade timer reports red at random, which is worse than no pin; the obligation the test carries (O4: one row per operation with its own counters) is fully asserted by text and viewport checks, and every existing snapshot is unchanged. Reversal path: a deterministic way to settle Mantine scrollbars in the e2e harness, after which the screenshot can return.
* **Decided by:** Claude Code, drain session 0fa004d0-93e4-4004-86d2-6652e891bd6e, full auto, red-remote repair of f-20260914-06 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"2f1f49cb9955b805ea8c22c727f2bccc5a17efc4eb57f7090a47d532b96e14da","input_sha256":"1de3eb423e180fbab7e02a51a94b156abd001dbd82c64727d55529b8add9d1ab","kind":"mutation-receipt","operation":"1aec4e2af7c64eb6032cd34fd7949cb1ed967aa12836322a6a4c3fb788c0ad96","options":{"section":null},"request_id_sha256":null,"results":["d-20261004-10"],"target":"decisions-ledger","v":1} -->

### d-20261004-11 — When Web Storage refuses both the sanitised write and the removal of a legacy session record, what ends the launch?

* **Question:** `f-20260914-16`: storage throws on the sanitised `setItem` and on the fallback `removeItem` of the `sessions` key, so a legacy Lichess bearer token stays at rest. Clear the whole storage area, write a persistent "must erase" marker, or refuse to continue with a user-visible reset?
* **Governs:** f-20260914-16
* **Chosen:** Fail closed visibly (a standalone startup view instead of `<App />`), revoke at Lichess every token the launch read and could not erase through a new handle-free native command `revoke_legacy_lichess_token` that reuses `OAuthServices::revoke_token`, and retry automatically on every launch with the legacy record as its own marker, plus an in-session "Try again" that reloads the window. No token is migrated, listed, logged or shown on that path.
* **Rejected:** (a) automatic `localStorage.clear()` — wipes un-migrated practice progress and review logs, engine registrations, keybinds and player settings nothing can rebuild, and bypasses the user-confirmed migration guard of Help → Clear saved data; (b) a persistent marker key — needs a successful write to the storage that just failed, and the record already marks itself; (c) a native wipe of the webview's browsing data — same loss as (a); (d) a storage-reset button on the failure view — same loss and guard bypass as (a); (e) revoking only after the user confirms — leaves a working token at rest while the user retries; (f) invalidating via `migrate_legacy_lichess_token` then `remove_lichess_account` — the migration door refuses off unix, so Windows would keep a working token, and it writes the token into the keyring only to delete it.
* **Reason:** No working legacy token outlives a launch that could not erase it, and none is used, migrated or shown, without trading irreplaceable user data for an erase through the storage that has just failed. Cost to the user: after such a launch they sign in to Lichess again. Known limit: a token stays working at rest only while both erases and the revocation fail (for example offline); the view says so and every retry repeats both. Reversal path: drop the revocation call in `src/utils/session.ts` and the command in `src-tauri/src/oauth.rs`.
* **Decided by:** Claude Code, drain session ec250af8-bbc8-43ef-9dfd-1c6294646b82 (plan-only session 4d37a1f3-c56b-44b0-82ce-6bbb4ede1a0a, refresh 44aef857-c043-401b-ae48-18af45302c94), full auto, adopted plan of f-20260914-16 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"62348fe4f2a1cbd02548ccfe856d9377164f158040bb89077205829e2b32d789","input_sha256":"eeb0d911775bfd73c70dc5ac93181154b890860a8628aaf76500363d965de6cc","kind":"mutation-receipt","operation":"39f2161b72bbec5df29a6b634a06231a7acc413d71415e040506aa077b312b19","options":{"section":null},"request_id_sha256":null,"results":["d-20261004-11"],"target":"decisions-ledger","v":1} -->

### d-20261004-12 — Does the fail-closed launch after a failed legacy-session scrub show a view or a blank window?

* **Question:** `f-20260914-16`: when `SessionSanitizationError` aborts startup, `<App />` never mounts, and the main window starts hidden (`tauri.conf.json` `visible: false`) and is revealed only from `<App />`. What does the user see?
* **Governs:** f-20260914-16
* **Chosen:** A standalone view under `src/components/home/` inside a `MantineProvider` built from the app theme and an `I18nextProvider`: a title, one explanation in three states (no legacy sign-in found; found and revoked; found and not revoked) and one "Try again" action that reloads the window. `src/index.tsx` reveals the window through the existing `closeSplashscreen` command and logs one sanitised diagnostic; no storage-reset action.
* **Rejected:** Leaving today's hidden, blank window (the user never learns why the app did not start); rendering `<App />` or the router error component (needs the router and the Jotai-backed features the fail-closed path must not mount).
* **Reason:** Technical under global rule 33: it changes only what a broken-storage launch shows — an explanation instead of nothing; nothing is charged or promised, and the one user-facing consequence (signing in to Lichess again) follows from the security property `CLAUDE.md` Conventions already fix. Reversal path: revert the sanitisation-failure render branch in `src/index.tsx`.
* **Decided by:** Claude Code, drain session ec250af8-bbc8-43ef-9dfd-1c6294646b82 (plan-only session 4d37a1f3-c56b-44b0-82ce-6bbb4ede1a0a), full auto, adopted plan of f-20260914-16 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"999349c1e752f4115042ff2bc938f89e0cbb791e0f4eb5cf92a07a88c6c8019c","input_sha256":"2119bfebee8e1c76538e1dd563cd87c9dadd5960adde1013284a61bb5843ba9f","kind":"mutation-receipt","operation":"f8a1d0bc2ebb4e1339c7bef41c874f8876710b16f4ba4b746ea8dfba2df24f42","options":{"section":null},"request_id_sha256":null,"results":["d-20261004-12"],"target":"decisions-ledger","v":1} -->

### d-20261004-13 — Does the f-20260914-16 startup failure view fit the total bundle ceiling, or does the ceiling rise?

* **Question:** The fail-closed startup view of `f-20260914-16` (d-20261004-12) pushed the total gzip bundle from 1,606,038 B at its base 2a3a54de to 1,610,235 B, over the 1,610,000 B total ceiling in `bundle-budgets.json`. Cut bytes or raise the ceiling?
* **Governs:** f-20260914-16
* **Chosen:** Raise the total ceiling by 10,000 B to 1,620,000 B and record the 2026-10-04 measurement (537,310 B Entry, 511,701 B largest lazy `src/routes/index.lazy.tsx`, 1,610,235 B total) with its rationale in `docs/bundle-budgets.md`, as the four earlier raises for user-facing copy did (`f-20260913-05`, `f-20260910-09`, `f-20260924-03`, `f-20260923-01`). Entry and largest-lazy ceilings are unchanged.
* **Rejected:** Dropping translations or the explanation states — the five strings per catalogue (title, three explanations, "Try again") are the only thing the user sees when the app refuses to start, and each state says something different about their Lichess sign-in; lazy-loading the view — it renders only when the entry has already failed closed, and moving it out of the entry saves no total bytes.
* **Reason:** 4,197 B of necessary user-facing copy and a standalone view; the total ceiling exists to make growth a conscious, documented step, which this is. Reversal path: lower `limits.total` back toward the next measurement once bytes are cut elsewhere (tightening needs no rationale).
* **Decided by:** Claude Code, drain session ec250af8-bbc8-43ef-9dfd-1c6294646b82, full auto, f-20260914-16 phase 2 · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"60aeb885eb7286e489a5872790e0d2bd3f5ed8886220732a8c061f3ddf082339","input_sha256":"dc88f686669ae37c6d89f4c3de46fa5e5c6a6a54f5775727b2d9879af6e49cab","kind":"mutation-receipt","operation":"bda5090885924e72bd24a6f053ca16a50338f81a208c55236723168fe820fdb3","options":{"section":null},"request_id_sha256":null,"results":["d-20261004-13"],"target":"decisions-ledger","v":1} -->

### d-20261004-14 — Can required-index DDL be interrupted safely, or must cancellation be refused once DDL starts?

* **Question:** `f-20260914-19`: `create_indexes` / `delete_indexes` check cancellation only at worker admission; the index-lock wait and the SQLite DDL are uncancellable, so shutdown waits for a whole index build and a late cancel still commits and reports success. Interrupt the DDL (SQLite progress handler) with a defined rollback, or refuse cancellation once DDL starts?
* **Governs:** f-20260914-19
* **Chosen:** Interrupt through the existing progress callback, scoped to the DDL body inside one top-level Diesel transaction, with `BEGIN`/`COMMIT`/`ROLLBACK` unarmed, a pre-commit token check, and outcome mapping to `Error::Cancellation` only when nothing committed (rollback succeeded, or SQLite already auto-rolled back: "cannot rollback - no transaction is active"); any other rollback failure is returned as itself. The index-lock wait uses `with_index_lock_cancellable` and the commands pass the gateway worker token into their blocking bodies. The import path's index creation inside its outer transaction stays uncancellable.
* **Rejected:** Refusing cancellation after DDL start — keeps shutdown blocked behind a full index build on a large database; arming the whole transaction — `COMMIT`/`ROLLBACK` become interruptible and can strand a pooled connection inside a transaction (`d-20260926-04`); raw `BEGIN`/`COMMIT` outside Diesel's transaction manager — bypasses the manager the repository relies on.
* **Reason:** Measured (Python `sqlite3`, SQLite 3.45.1, 2026-10-04; re-measured by the phase tests on the bundled 3.39.2): an interrupted write/DDL statement inside an explicit transaction makes SQLite roll the whole transaction back itself, while armed `COMMIT`/`ROLLBACK` are interruptible. Diesel 2.1.4 replaces the callback error with a failed `ROLLBACK`'s error and marks the manager in error, which `has_broken` turns into a discarded pooled connection. Extends `d-20260908-14` (read scope) with a separately contracted write use; does not reverse it. Reversal path: drop the helper in `src-tauri/src/db/sqlite_cancellation.rs` and return the index commands to admission-only cancellation.
* **Decided by:** Claude Code, drain session 42548d18-1af4-46bd-a37c-20f82f9ba6c8, full auto, adopted plan of f-20260914-19 (`tasks/plans/2026-10-04-index-ddl-cancellation.md`) · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"44def0b9b6a181ac0de67421287218cdd7cb3c762c5db436440bd4e9f59e15fe","input_sha256":"0f686cede9076496092867ff3a040e630344f014263e8787ada050e8ccdf93bb","kind":"mutation-receipt","operation":"e52ddda7bae204e0504c40bf33be6d88012af0dc2ead79136a55ac407aa491e1","options":{"section":null},"request_id_sha256":null,"results":["d-20261004-14"],"target":"decisions-ledger","v":1} -->

### d-20261004-15 — How is the closed-world assertion over the Windows refusals staged when its assertions live in the file it scans?

* **Question:** `f-20260916-01`: the refusal verifier is the inline test module of `src-tauri/src/infra/platform_support.rs`, so every helper, visibility and own-file pin could only be staged by editing the verifier's own source, which push-review-policy §2 forbids (R15-01). Move the scan to a separate checker with fixtures, pin the helpers from a different module, prove completeness through a compile-time registry, or accept argued assertions?
* **Governs:** f-20260916-01
* **Chosen:** Move the test module of `infra/platform_support.rs`, behaviour unchanged, to `src-tauri/src/infra/platform_support/tests.rs` (declared `#[cfg(test)] mod tests;`). The subject file then holds only the four helpers and is an input the verifier reads through `include_str!`, so its cases stage by editing it in a disposable worktree; the verifier pins the subject file whole.
* **Rejected:** (a) a separate `scripts/` checker with fixtures — a second lexer beside `infra/blocking.rs::source_scan`, whose header forbids one, and a check that no longer runs in the Windows `cargo test` job; (b) pinning the helpers from another module while the verifier stays in the subject file — the whole-file pin would need a carve-out for a 2,900-line test module, and the subject would still contain verifier logic; (c) a compile-time registry (an enum of refused operations) — changes `d-20260914-05`'s helper API across every site and still misses an alias, a bare literal or the wording; (d) argued assertions — the split makes them stageable at zero production change.
* **Reason:** push-review-policy §2 permits editing what an artefact reads, never its logic; splitting verifier from subject makes the forbidden route disappear instead of being argued around. Reversal path: move `infra/platform_support/tests.rs` back inline and restore the four per-helper pins.
* **Decided by:** Claude Code, drain session 976d61fb-0d8c-46e2-9d06-a9567a9c2cb1 (drain run 42548d18-1af4-46bd-a37c-20f82f9ba6c8), full auto, adopted plan of f-20260916-01 (`tasks/plans/2026-10-04-refusal-closed-world.md`) · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"eff34e6f45fa14470a377cbcfd25146758af310aa20a49ff474bcd605a3d9f30","input_sha256":"710766ff662a528ecd02baea8ad2c1405180d2bb711834bc68f8ca4785d28db4","kind":"mutation-receipt","operation":"a459cdf8a2949e01b9f15364ba37f4e11428c18ffb3556e4241ae0cb5bbcccc6","options":{"section":null},"request_id_sha256":null,"results":["d-20261004-15"],"target":"decisions-ledger","v":1} -->

### d-20261004-16 — What counts as a Windows refusal for the closed-world assertion, and what is knowingly not detected?

* **Question:** `f-20260916-01`: the closed-world assertion must tie the guard-row tables to every refusal in the tree, including a new `#[cfg(not(unix))]` site, `use … as`, a bare `Error::Conflict` literal and a `concat!`-split message. Which source occurrences define "a refusal", and where is the detection boundary?
* **Governs:** f-20260916-01
* **Chosen:** Over the exact production region of every `.rs` file under `src-tauri/src` (inline `#[cfg(test)]` / `#[cfg(all(test, …))]` module bodies blanked, everything else production), excluding exactly the keys `infra/platform_support.rs` and `infra/platform_support/tests.rs`: (1) every `platform_support` identifier must be the `infra/mod.rs` declaration or a fully qualified `crate::infra::platform_support::<helper>("<literal>"` call, and the multiset of `(file, enclosing fn, helper, label)` tuples must equal the guard rows plus the routed-row table; (2) no folded string-literal content (escapes and whitespace dropped, lower-cased) contains `unsupportedonthis` or `onthisplatform`, and the file's joined literal stream does not contain `unsupportedonthisplatform`. Named limits: L1 differently worded Windows errors, L2 run-time or escape-encoded wording and a `format!` split with another literal between the parts, L3 literals spanning a physical line break (shared lexer), L4 a `cfg` edit compiling the verifier out (same as before; observed by the post-push Linux/Windows test-line comparison of `d-20260916-01`).
* **Rejected:** an allowlist of Windows-gated `Error::Conflict` sites — no refusal semantics, about 470 production conflicts; stems over whitespace-stripped normalised text alone — a `concat!` split at "on " / "this platform" escapes both stems because the delimiters stay between the parts; a joined literal stream alone — a `format!` that moves "platform" into a later argument escapes it; separate count and uniqueness assertions — one multiset equality makes every count path stageable from production (closes R14-03).
* **Reason:** `d-20260914-05` defines a refusal by its builder and its wording; the threat model is accidental drift, not an adversary. Reversal path: replace the inventory and wording tests in `infra/platform_support/tests.rs` with the previous count-based checks.
* **Decided by:** Claude Code, drain session 976d61fb-0d8c-46e2-9d06-a9567a9c2cb1 (drain run 42548d18-1af4-46bd-a37c-20f82f9ba6c8), full auto, adopted plan of f-20260916-01 (`tasks/plans/2026-10-04-refusal-closed-world.md`) · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"6b7b1ced12a89e33f94c79ed2a033d9785189b159a70786c592f7aff80ef2607","input_sha256":"c5b933840edc4b3ea4f8c3396996e2fd0061e9425a8195c3fa4d6e1841eaf2f5","kind":"mutation-receipt","operation":"3fe8709d634399bc941c75da00e152369d9062a6fcd49b28779a8f92644f4c5e","options":{"section":null},"request_id_sha256":null,"results":["d-20261004-16"],"target":"decisions-ledger","v":1} -->

### d-20261004-17 — Does the dormant body-row refusal verifier stay in the refusal verifier once the closed-world inventory exists?

* **Question:** `f-20260916-01`: the reviewed plan (D-6 in `tasks/plans/2026-10-04-refusal-closed-world.md`) kept `BodyRow`/`ExpectedBody`/`check_source_pin` in `infra/platform_support/tests.rs` as "the documented home of a future body-form refusal pin". The cumulative diff review showed every item of it is `#[allow(dead_code)]`, `body_rows()` is empty, and its comment "the next refusal row revives it wholesale" is false because `remaining_refusal_body_rows_are_none` fails as soon as a row is added and the per-row loop was already deleted. Keep it, or delete it?
* **Governs:** f-20260916-01
* **Chosen:** Delete the body-row verifier, `body_rows()` and `remaining_refusal_body_rows_are_none`, and reduce the removed-row accounting to the guard-row count. A future body-form refusal now fails `production_refusal_inventory_matches_rows` first and is pinned there; the deleted machinery stays retrievable from history (commit e3c6b225 and earlier).
* **Rejected:** Keeping it with a corrected comment that names the restoration steps — about 200 lines of dead, `allow(dead_code)`-suppressed test code whose only purpose the closed-world inventory now serves; plan D-6 was decided without the evidence that the machinery cannot be revived by adding a row.
* **Reason:** New evidence D-6 did not consider (review-minimalism 98, review-code-quality 98, confirmed at `tests.rs:2359`, `:2541`, `:2778`). Reversal path: restore the items from e3c6b225 and re-add the per-row loop.
* **Decided by:** Claude Code, drain session 976d61fb-0d8c-46e2-9d06-a9567a9c2cb1 (drain run 42548d18-1af4-46bd-a37c-20f82f9ba6c8), full auto, cumulative diff review of f-20260916-01 · **Superseded-by:** d-20261004-18
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"1ef041a9e5d5bea0893a9e63b9cecfc06188ff8b59a8b754dcc1cf5493314256","input_sha256":"cdb002c511dd0a1ce7c86e9fa7d54b9568ca34b1324e3d0e68d3bcaa6c6a3d1c","kind":"mutation-receipt","operation":"36e4f62dc46538ae8d3e4efff097526485642e6abf6d69adf17c82599aaae6fa","options":{"section":null},"request_id_sha256":null,"results":["d-20261004-17"],"target":"decisions-ledger","v":1} -->

### d-20261004-18 — What does the closed-world inventory pin for a future body-form refusal once the body-row verifier is gone?

* **Question:** `d-20261004-17` deleted the dormant body-row verifier on the grounds that a future body-form refusal "fails `production_refusal_inventory_matches_rows` first and is pinned there". The closure review of `f-20260916-01` showed that overclaims: the inventory pins only the site's `(file, function, helper, label)` tuple, while the deleted `check_source_pin` pinned the site's exact effective body and its cfg and scope placement. Does the deletion stand, and what is the accurate contract?
* **Governs:** f-20260916-01
* **Chosen:** The deletion stands; the contract is corrected. A new or re-added body-form refusal fails the inventory first, which pins its tuple; pinning its body (no effect before the refusal, cfg and scope placement) then requires restoring the body-row verifier from commit e3c6b225, or an equivalent row check, together with the new row. The verifier header says the same.
* **Rejected:** Restoring the dormant verifier now — it pins nothing while `body_rows()` is empty, could not be revived by adding a row (its per-row loop was already gone and `remaining_refusal_body_rows_are_none` rejected any row), and the routed-row path through the inventory was already the way a refusal could be added without a body pin before this finding; keeping `d-20261004-17`'s wording — it states a guarantee no test provides.
* **Reason:** Supersedes `d-20261004-17` on new evidence it did not consider (records lens, closure round 2, confidence 97; `git show a81a2b24` shows `check_source_pin` compared exact effective bodies). Reversal path: restore the body-row verifier from e3c6b225.
* **Decided by:** Claude Code, drain session 976d61fb-0d8c-46e2-9d06-a9567a9c2cb1 (drain run 42548d18-1af4-46bd-a37c-20f82f9ba6c8), full auto, closure round 2 of the f-20260916-01 diff review · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"9c5cebd5277246219fa1594a124548cda47d5a092775599a863dc2d34643655c","input_sha256":"d9ef3904768b44668854090210291f376bf2bd9f5beb15cb4333477ed55b5908","kind":"mutation-receipt","operation":"679f53e500a3dcb5565faa698724826af23e1217a958ccb785b018d7f5afe8ff","options":{"section":null},"request_id_sha256":null,"results":["d-20261004-18"],"target":"decisions-ledger","v":1} -->

### d-20261004-19 — Which layer owns surfacing an uncertain download durability, and what is its typed contract?

* **Question:** Lichess and Chess.com downloads return `ArtifactPublication` with a `durability` field that both renderer adapters drop. Which layer surfaces an uncertain durability, and through which typed contract?
* **Governs:** f-20260916-07
* **Chosen:** The adapters `downloadLichess` and `downloadChessCom` return the generated `ArtifactPublication` unchanged; the single caller (`AccountCard`'s download handler) shows one orange "Do not retry" notification when `durability !== "Durable"` and then continues the import with the same handle, as `Accounts.tsx` and `AccountCards.tsx` already do for account link and removal.
* **Rejected:** A platform-facade event (a second channel and a new listener lifetime for data the command result already carries); an adapter-level notifying helper (new single-caller module, diverges from the durability precedents); a new renderer-side wrapper type (the generated union already discriminates).
* **Reason:** Least new mechanism, consistent with every existing renderer durability warning; the remaining TypeScript limit (no `#[must_use]`) is pinned by component tests and one e2e snapshot. Reversal path: move the notification into a facade event if a second consumer of the adapters appears.
* **Decided by:** Claude Code, drain session 0bcbe3ad-da8e-43bf-9f91-5e53009238c8 (drain run 42548d18-1af4-46bd-a37c-20f82f9ba6c8), full auto, reviewed plan tasks/plans/2026-10-04-f-20260916-07-download-durability.md · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"301cec4a1ecfc57b63d357520439d3dd0db822e27471064325a74ccf22d412a3","input_sha256":"340eb668b50284ac382d9ca9c272c4df3a9f5a88aec74cc66a202c8a1bf193d6","kind":"mutation-receipt","operation":"e4782e0cebb363c4ab627a425e56f536f0868df7b8366eed44b61ea43d299d0d","options":{"section":null},"request_id_sha256":null,"results":["d-20261004-19"],"target":"decisions-ledger","v":1} -->

### d-20261004-20 — Do the two download combine sites need the uncertain-stage treatment, and how without changing precedence?

* **Question:** `download_to_destination_inner` and `install_staged_pgn_artifact` drop the target install's `CommittedDurabilityUncertain` stage without recording it when activation then fails. Do these *combine* sites need the same treatment as workspace create/rename, and how, given `d-20260906-03` (3) and `9d450dc5` pin that a later hard error outranks the uncertainty?
* **Governs:** f-20260916-07
* **Chosen:** Both sites map the target outcome through the existing `download_target_durability` (which logs the warning) immediately after the install and before `activate_download_artifact_runtime` is awaited, as workspace create/rename do; the activation error still outranks and its payload is unchanged.
* **Rejected:** Carrying both stages in the error (reverses `9d450dc5`); a new error variant (IPC and classifier change for an observability gap); mapping inside the error arm only (two mappings, and impossible at the `?` site without the same restructuring).
* **Reason:** Observability without changing precedence or any contract; one mapping per path, the P9 shape in `file_workspace.rs`. Reversal path: move the mapping back into the `Ok` arm (loses the log on the error path).
* **Decided by:** Claude Code, drain session 0bcbe3ad-da8e-43bf-9f91-5e53009238c8 (drain run 42548d18-1af4-46bd-a37c-20f82f9ba6c8), full auto, reviewed plan tasks/plans/2026-10-04-f-20260916-07-download-durability.md · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"0ad467499403fa9163ae31749bdbb7d50318fddbd2b1493600169ca8520b4e2b","input_sha256":"f7f3c6791aaa17ee1af2deb60bb1cbc7a019e0995e0cc552ea8dbd865b78167c","kind":"mutation-receipt","operation":"c5d6d164891b5e585b69b00407c606be420ccf9280774451d36fb1decffc0375","options":{"section":null},"request_id_sha256":null,"results":["d-20261004-20"],"target":"decisions-ledger","v":1} -->

### d-20261004-21 — Does the record durability contract need renderer surfacing?

* **Question:** `f-20260916-07` asks whether the *record* contract of `d-20260906-03` needs the same renderer surfacing as the *report* contract of the download path.
* **Governs:** f-20260916-07
* **Chosen:** No. Every record site already logs natively (`credentials.rs`, `keep_adopted_handle`), user-initiated record results are already surfaced (`Home.Accounts.LinkDurabilityUncertain`, `Home.Accounts.RemoveDurabilityUncertain`), and the startup legacy-token migration (`src/utils/session.ts`) is background reconciliation whose uncertainty is already logged natively.
* **Rejected:** A startup notification for migration durability — there is no user action to qualify, and the native log satisfies `d-20260906-03` (2).
* **Reason:** The record contract is "log, keep going, carry the uncertainty in the result", and all record sites meet it. Reversal path: a finding showing a user acting on a migrated account's uncertain persistence.
* **Decided by:** Claude Code, drain session 0bcbe3ad-da8e-43bf-9f91-5e53009238c8 (drain run 42548d18-1af4-46bd-a37c-20f82f9ba6c8), full auto, reviewed plan tasks/plans/2026-10-04-f-20260916-07-download-durability.md · **Superseded-by:** -
<!-- ledger-meta {"command":"record-decision","effect_lines":8,"effect_sha256":"c2418775f053398820597a92c4cebf7f3a9ba195a09f0a514816e4fa202494f6","input_sha256":"36b03842fa62e0227f67ae7460d9b293a59e9e87a03d3f22b64e7988aafe13a5","kind":"mutation-receipt","operation":"1652ecab752c67f6151f6e727df083dec48a09ce516630af52241ab6d481d8a7","options":{"section":null},"request_id_sha256":null,"results":["d-20261004-21"],"target":"decisions-ledger","v":1} -->
