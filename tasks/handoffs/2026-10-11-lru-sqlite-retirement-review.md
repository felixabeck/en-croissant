# Review handoff: f-20260930-01

PLAN-REFRESH completed from BASE ca0ab68689e0f4de8ca0b84df2be29963bcfc66c to NEW-BASE 0ee13ca0f0cf7ed2ce1c5313e6adf8f39780a7b3. Initial planning and reviews r1-r4 are preserved, followed by the first refresh's drift round r5 and correction closure r6 (BASE 8ebc643e to ca0ab686), then this refresh's drift round r7 and correction closure r8. The finding remains open. Selected executor is codex. Plan authorship and arbitration shared one context. Detection ran on the same model family selected for code execution.

The adopter must load this complete handoff and the reviewed plan before implementation and review. Promote this record to tracked tasks/handoffs/2026-10-09-f-20260930-01-review.md, record the autonomous choices through the decision writer, and commit those records before final gates. Source ownership remains repository.rs only. I1-I7 belong to this mandate; S1 is a recorded Skip. Preserve d-20261009-14's codec/runtime decision and d-20261011-01's same-parent alias admission refusal. The readiness prerequisite does not claim Node 20 compatibility or waive any runtime/platform/CI proof. The newly filed f-20261011-01 (rename retention of an idle cached entry) is a separate open finding outside this mandate. No successor split or deferred finding exists.

## Reviewed mandate, decisions and obligations

# Plan: retain and drain LRU-evicted SQLite connections

## Goal

Resolve f-20260930-01 so an LRU-evicted pool cannot close SQLite handles after a later deletion or successor open of the same database. This is a PLAN-ONLY run at BASE 8ebc643ef5569b29f269415a7b2f958c1e4e78c2. Implementation belongs to the adopting session.

## MANDATE

### LRU eviction drops a database entry without draining its SQLite connections, so one can close after a later delete of the same file

* **ID:** f-20260930-01 · **Status:** open · **Area:** db-search · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/db/repository.rs` `evict_idle_entries` (~line 973, called under the repository state lock from `entry()` ~915); `close_retired_entry` (~952) and `DrainGate` (~109) are the drain every other retirement path uses since `3ed94336`.
* **Defect:** eviction removes an idle entry (`Arc::strong_count == 1`, no lease, not retiring) from `RepositoryState.entries` and drops it without closing its connection gate or waiting for outstanding connection tickets. An r2d2 `add_connection` job started by an earlier `get` can still hold an upgraded pool reference and a live or in-flight SQLite handle (the f-20260929-07 mechanism). A later `delete_exclusive_cancellable` of the same file then finds no entry, drains nothing, and unlinks while that handle is still open. The window is small (a replenishment job outliving the `get` that spawned it), reported by the repair leaf of the 2026-09-30 push review.
* **Why it matters:** it is the last retirement path that can close an SQLite handle (and unlink WAL/SHM) after the file was deleted or replaced, which every other path now excludes.
* **Proposed fix:** close the evicted entry's connection gate and drop its pool at eviction without blocking under the state lock, and keep the evicted gates reachable (for example a per-key list of draining gates in `RepositoryState`) so `delete_exclusive_inner` and `entry()` rebuild wait on them through `DrainGate::wait_drained` before unlinking or opening a fresh pool.
* **Open question:** where do evicted-but-draining gates live and who prunes them — a per-key list in `RepositoryState` pruned on drain, or eviction deferred to a path that may block — without holding the state lock across a wait?
* **Found by:** Codex write leaf (repair of the `8b97e423` push review), out-of-scope report; confirmed by the orchestrator from source, 2026-09-30. Related: `f-20260929-07`.

## Threat model and non-goals

Ordinary concurrent native database operations, r2d2 replenishment workers, cancellation, drain timeout, authority-valid same-path replacement and aliases on Linux, macOS and Windows. Preserve existing authority checks and bound VFS behavior. No new protection against malicious pathname churn, new cross-capability lifetime protocol, pool-key merger, hard-link WAL redesign, background service, watcher, shutdown redesign, or new renderer behavior.

## Traced premises

Frozen source trace at BASE, confirmed by the root and locate probe-1-r1:

* `repository.rs:1091` selects idle sole-owner LRU entries and removes them under the state mutex.
* `repository.rs:135`, `:252` and `:223` give each pooled SQLite open a ticket from before establishment until after SQLite and its binding close.
* r2d2 0.8.10 `src/lib.rs:230` upgrades a weak pool on its worker before connect and retains it through publication.
* `repository.rs:1664` closes connection admission and drops the pool before draining.
* `repository.rs:1070` removes a retired entry even if its drain returns an error, losing future lookup of that gate.
* `repository.rs:868` deletion reserves the canonical path but drains only the exact current entry.
* `repository.rs:929` owns pool construction through the building set and BuildGuard.
* `repository.rs:684` also opens a transient bound revision connection without constructing a pool.
* `repository.rs:372` keys pools by object, parent and path. `bound_sqlite.rs:188` reuses bindings, it does not drain predecessor connections.
* `db/mod.rs:2870` and `puzzle.rs:646` execute descriptor-bound unlink inside the repository deletion barrier.
* `repository.rs:2603`, `:2762`, `:2789`, `:2809`, and `:4855` contain cancellation, timeout, LRU and VFS/sidecar lifetime witnesses.
* `path_authority/mod.rs:962` supplies platform-neutral test targets. Most existing repository lifecycle tests are Unix-only at `repository.rs:1799`. The bound SQLite witness module at `:3293` is platform-neutral.

## Approach

### O1 — publish and bound predecessor ownership

Derived from MANDATE “keep the evicted gates reachable” and “without blocking under the state lock”. RepositoryState owns a bounded set of retirement records identified by predecessor object and retained parent identity. Limit records, including capacity reservations, to MAX_OPEN_DATABASES (16). Publish ownership and close new connection admission atomically with removing the eligible LRU entry. Keep its teardown visibly outstanding until pool and entry disposal have completed outside the repository state mutex. A zero count must prove that no evictor still owns a pool awaiting disposal, as well as that SQLite has closed every admitted handle. It must also prove that no other holder of the predecessor's pool or connection manager survives, including an r2d2 replenishment worker that upgraded the pool but was never admitted a connection ticket: the manager retains the predecessor's bound-SQLite binding, and d-20261011-01's admission refuses a same-inode alias while any binding holder survives. A completed predecessor record therefore means the predecessor's pool, manager and evicted entry no longer hold its binding. Holders outside predecessor teardown, such as a caller still holding the entry, keep d-20261011-01's refusal unchanged.

Only closed, fully drained records may be pruned. Prune completed records opportunistically at retirement/admission boundaries, including when a different database is accessed, so churn through never-revisited names cannot accumulate records. Capacity exhaustion applies bounded cancellable backpressure outside the state mutex, returning Cancellation or Conflict on failure before losing a resource or publishing a cache entry whose required eviction cannot be owned. Preserve the existing active-lease LRU exception. No unrestricted per-key history and no background cleanup.

Verification level: deterministic Rust concurrency witnesses through real LRU selection. Assert the entry is eligible without an entry Arc or caller lease artificially pinning it, that connection admission closes, and that retirement ownership remains visible while an actual SQLite handle is held. An unrelated database operation in a different retained parent must still finish while predecessor teardown waits. Churn and saturation witnesses assert the record bound and recovery after tickets close.

### O2 — enforce the predecessor barrier at reopen and deletion

Derived from MANDATE “before unlinking or opening a fresh pool” and “same file”. Match retired predecessors by the same object identity OR the same retained parent identity, retaining the existing pool key and authority checks. Parent matching conservatively fences all retired predecessors in that directory. It catches replacements whose authority-valid leaf spelling changes on case-insensitive or Unicode-normalizing filesystems without inventing a string equivalence rule. It deliberately delays otherwise unrelated opens in that parent until its retired predecessors drain, never live pools in that parent.

Pool construction, connection acquisition from already cached pools, transient revision opens and the delete reservation must drain every matching predecessor before any corresponding SQLite establishment or unlink callback. Cover actual connection-manager establishment, including delayed r2d2 replenishment from a previously cached pool, so fencing synchronous acquisition alone cannot leave a worker bypass. Reuse one retirement matching/wait/pruning contract at those boundaries. An already admitted worker belonging to the retiring predecessor must not wait on its own connection ticket. Preserve its existing close ordering and count it in that predecessor's drain, or refuse its open safely after admission closes. No repository ownership cycle may be introduced through pool managers.

Waits release the repository state mutex. Coordinate their publication and recheck with the existing construction and deletion reservations so a newly published matching retirement cannot slip between the wait and protected operation. Keep active-lease conflicts and avoid waiting on a lease held by the same caller. Use one absolute deadline for each predecessor-barrier operation, not a fresh full timeout per predecessor or loop. Cancellation remains effective before destructive work begins. BoundDatabase lifetime and close ordering remain intact.

At every boundary, predecessor timeout returns the existing Error::Conflict and caller cancellation returns Error::Cancellation. Preserve that typed, operation-scoped result through cached acquisition even when r2d2 transports and retries manager errors as text. Do not infer the category by parsing those strings or let one caller's cancellation poison another caller or a later retry. A pool acquisition must not consume a second timeout after the predecessor deadline expires. No new public error category is required.

Verification level: synchronized Rust witnesses assert that same-key reopen, same-path replacement, same-object alias and deletion cannot establish a successor handle or run the unlink callback until the predecessor closes. Include a replacement cached by a lock-only caller before the predecessor is LRU-evicted, then acquired afterward, and a delayed successor-pool replenishment worker crossing that retirement boundary. Include the transient revision boundary. On filesystems accepting spelling aliases, replace GameCase.db3 and authorize gamecase.db3, then witness cached acquisition, revision and deletion barriers. Assert conservative same-parent blocking and different-parent progress. A real WAL fixture proves the predecessor's final close occurs before the successor's WAL/SHM can exist, and the successor remains queryable with its sidecars intact.

Also pause a real predecessor replenishment worker after its connection ticket is admitted but before SQLite establishment, make its entry genuinely LRU-eligible, publish retirement, and resume it. Synchronize at those lifecycle boundaries. Assert the worker completes or safely refuses establishment without waiting for its own ticket or the retirement deadline, releases the ticket, and allows the predecessor drain and successor barrier to finish. Keeping the regression while restoring self-waiting manager behavior must fail its completion/order assertion.

Also pause a real predecessor replenishment worker after it upgraded the pool and before its connection ticket is admitted, make its entry genuinely LRU-eligible and publish retirement. Then start a same-parent hard-link alias reopen through the barrier. Assert the alias waits while that worker holds the pool, never returns d-20261011-01's "database is open through another name" conflict, and opens successfully after the worker resumes, is refused admission and releases the pool. Counting only connection tickets for completion must fail this assertion.

### O3 — retain barriers after incomplete drains

Derived from MANDATE “where evicted-but-draining gates live and who prunes them”. Timeout or cancellation must never discard or reopen a retired predecessor's connection gate. Release the waiting operation's temporary reservations, preserve predecessor ownership, and refuse its SQLite open or unlink. A retry after closure succeeds and removes completed bookkeeping.

Route LRU and the existing close_retired_entry removal through shared predecessor ownership. This also closes the same mechanism exposed when close_retired_entry currently removes an undrained gate on timeout or cancellation. Caller-lease cancellation before connection retirement keeps today's admission restoration. After connection retirement begins, reopening the caller lease must not make a retired pool reusable or remove its predecessor barrier.

Verification level: deterministically cancel during the connection-drain phase, and inject the shorter per-repository timeout. Assert no protected operation ran, an undrained predecessor remains discoverable, subsequent reopen/delete still waits or fails closed, and retry succeeds once the held connection is released.

Exercise cancellation and timeout after cached-pool worker establishment reaches a predecessor barrier, with the target remaining authority-valid. Assert the caller receives Cancellation/cancellation or Conflict/conflict (Rust variant and existing ErrorCategory), never R2d2/database. Assert a separately waiting healthy caller and a later retry remain independent and succeed after the predecessor closes. These witnesses must fail if the typed boundary result is replaced by the generic pool error.

For those actual cached/worker failure witnesses, also assert bounded completion for timeout and cancellation. Capture the elapsed-time origin before spawning the acquisition or release/cancellation child, then synchronize actual predecessor-barrier entry. Keep the predecessor held until the outcome assertion. Use the injected short predecessor deadline and an explicit scheduling allowance whose completion bound is strictly below the additional configured pool timeout. Assert timeout completion uses the original operation budget and cancellation returns promptly after its synchronized signal. Include multiple matching predecessors or a reservation recheck to reject refreshed budgets. Restoring a second full pool timeout or deferring cancellation through that timeout must fail the elapsed-time/completion assertion even if the eventual error category is correct. Preserve d-20261008-29's pre-spawn timing origin.

## Decisions and trade-offs

Entry remains build. The recorded decisions settle keying, authority, timeout and test synchronization, but none settles evicted-gate ownership and bounded retention.

Preserve d-20260904-01's injectable 60-second production timeout, d-20260913-02's pool key, d-20260913-03's lease-safe retirement, d-20260929-04's VFS authority, d-20260929-05's cross-directory refusal, d-20261011-01's same-parent alias admission refusal, and d-20261008-29/-30's synchronized test timing. O3 extends failed-drain safety, it does not reverse those decisions.

## Decided autonomously

* Question: Who owns evicted-but-draining gates and when are they pruned? Chosen: bounded repository retirement records using existing connection tickets, synchronous disposal outside the state mutex and opportunistic completed-record pruning. Rejected: evictor-local ownership alone (concurrent delete/reopen loses the barrier), an unbounded per-key list, or a background reaper. Reason: MANDATE requires future lookups and bounded retention, and no new process is needed. Reversal path: replace the registry only with a protocol proving the same lookup, capacity, failure and teardown-order invariants.
* Question: Does a fresh revision read count as a reopen? Chosen: yes, apply the same retired-predecessor barrier at read_revision without creating a pool. Rejected: fencing pool construction alone. Reason: a revision read is another SQLite establishment against the same authority-bound file. Reversal path: remove that barrier only if transient revision establishment can no longer overlap an evicted predecessor.
* Question: May close_retired_entry forget a gate after timeout or cancellation? Chosen: no, retain its undrained predecessor through the shared ownership contract. Rejected: removing the entry and forgetting its gate. Reason: a later delete can otherwise reproduce the same post-unlink close that MANDATE forbids. Reversal path: demonstrate another authoritative owner consulted by every future reopen/delete before removing this retention.
* Question: How are replacement names matched across filesystems? Chosen: same object OR retained parent identity, using authority identities already in EntryKey. Rejected: canonical path bytes or a new case-folding approximation. Reason: canonical_binding preserves the leaf's spelling and byte comparison can miss a replacement alias. Conservatively waiting for retired predecessors in the same parent gives a portable guarantee with bounded state. Reversal path: narrow parent matching only with authority-backed filesystem name equivalence and replacement witnesses on every supported platform.
* Question: Is construction the only pooled establishment boundary? Chosen: no, cached acquisition and actual manager establishment also use the predecessor barrier. Rejected: assuming every get creates a fresh pool. Reason: lock-only callers can cache a pool before its first SQLite connection and replenishment runs asynchronously. Reversal path: remove a boundary only if that path can no longer establish SQLite after predecessor retirement.

* Question: Which runtime executes the changed integration verifier? Chosen: preserve d-20261009-14's Node 24 native-codec route and explicitly validate its runtime and codec round-trip prerequisites before adoption proof. Rejected: treating the package's Node 20 minimum as verifier compatibility evidence, adding another serializer or changing the project's engine range within this task. Reason: the required integration proof must actually start with the changed import, and the existing current runtime already supports that route. Reversal path: a separately reviewed verifier-runtime compatibility change that preserves the canonical covered codec and demonstrates the same real-app proof.

## Risks / open questions

No product decision is needed. The code executor owns private helper names and test placement within the reviewed obligations. f-20260929-05's same-directory hard-link hazard is handled at NEW-BASE 0ee13ca0 by d-20261011-01's admission refusal, which this plan preserves and must not weaken. The cross-capability hazard stays separate as f-20261001-02. A renamed database refused while its old name's idle entry stays cached is the separate finding f-20261011-01, outside this mandate. This plan covers retired predecessor barriers, not concurrent live alias pools or all transient-reader lifetimes.

Locate confirmed Codex CLI 0.162.0 and the cargo, pnpm, agent-gate, WebKitWebDriver, tauri-driver and kwin_wayland binaries. The planner worktree has no node_modules and runs no install or runtime proofs. Adoption must run pnpm install --frozen-lockfile, recheck the exact released-kit parity and runtime prerequisites, and use the shared gate wrappers. Existing verify:app comments record unrelated failure history. Current runtime status is unmeasured, not green evidence.

At NEW-BASE ca0ab68689e0f4de8ca0b84df2be29963bcfc66c, the verifier imports the production TypeScript codec directly. Its execution prerequisite is the Node 24 runtime chosen by d-20261009-14, observed here as v24.21.0. Check node --version before adoption and use that existing runtime for the prescribed commands. After dependency installation, prove native import and compressed round-trip of the actual serializeStorageValue/deserializeStorageValue module before the full app verifier. Package.json's broader Node engine range is not proof that this verifier runs on Node 20. A missing prerequisite fails adoption readiness, it never waives the real-app proof. No project engine-range change, codec duplication or new transpilation helper belongs to this retirement mandate.

## Not part of this task

Other db-search siblings remain open at their recorded tiers. No frontend, Specta signature, binding, schema, dependency, capability, VFS implementation or deletion-outcome change is planned. No claim of implemented or runtime-verified behavior is made by this planner.

## Phases

One cohesive sensitive phase owns `src-tauri/src/db/repository.rs`, production ownership plus its regression witnesses. Concurrency, resource lifetime and cancellation are touched. API signatures and persisted schemas are unchanged. Selected executor: codex, write role sensitive resolved through leaf-launch.sh and the model registry. No history fork is needed. The root integrates, arbitrates, verifies and commits in the adopting run.

Implement O1–O3 together so every retirement path and every barrier ships with its witnesses. Prefer the existing platform-neutral test module for common lifetime behavior. OS-specific WAL fixtures may stay platform-gated, but the central ownership and error/retry witnesses must run on Linux, macOS and Windows. Read async-resource-invariants.md, pgn-scanning.md and ipc-events.md before writing. No other source files are assigned.

Exact phase proof: `cargo test --manifest-path src-tauri/Cargo.toml db::repository:: -- --test-threads=1 && pnpm checks:pre-review`. Keep new regressions present while reverting only the task-owned production fix from its Git diff, record the expected assertion failures, restore, and rerun green. The adopter owns that proof, not the read-only planner.

After implementation and cumulative diff review, run `pnpm build && pnpm verify:app --screenshot /tmp/drain-plan-chessfable-0a459a4f-slot1/build/verify-ui/retirement-app.png` for real app startup/IPC/shutdown integration. It complements the deterministic Rust SQLite retirement witnesses, it does not directly prove the LRU race. No new standalone verifier is planned.

Final affected push gates: `pnpm gates:push -- --rust`, through the canonical detached push-gate route on the final clean HEAD. It includes backend tests/coverage, fmt/clippy, Windows compile checks, contract and kit parity. No ratchet changes. The release also requires `pnpm ci:remote:check` and successful rust-windows-test, rust-macos-test and rust-platform jobs on the pushed SHA. Run the project push skill, then verify HEAD equals upstream and applicable installation. Record the autonomous decisions and complete review handoff before final gates. Close f-20260930-01 only through findings.py after verified implementation.

## Carried to diff review

None.


## Issue metadata

```json
{
  "ids": [
    "f-20260930-01"
  ],
  "issues": [
    {
      "claim": "Canonical path spelling can miss a same-file replacement on a case-insensitive filesystem.",
      "closed_round": 2,
      "correction": "O1/O2 retain and match object OR retained parent identity, explicitly requiring spelling-alias witnesses and conservative same-parent backpressure.",
      "dependencies": [],
      "disposition": "Fix",
      "id": "I1",
      "witnesses": [
        {
          "index": 1,
          "lens": "platform-semantics",
          "round": 1
        }
      ]
    },
    {
      "claim": "Cached replacement pools bypass construction fencing, and predecessor-worker self-ticket handling needs an executable witness.",
      "closed_round": 3,
      "correction": "O2 fences cached acquisition and actual manager establishment, prevents predecessor self-wait and requires synchronized cached-successor, delayed-successor and admitted-predecessor worker lifecycle witnesses.",
      "dependencies": [],
      "disposition": "Fix",
      "id": "I2",
      "witnesses": [
        {
          "index": 1,
          "lens": "plan",
          "round": 1
        },
        {
          "index": 1,
          "lens": "plan",
          "round": 2
        }
      ]
    },
    {
      "claim": "A new worker predecessor barrier failure can lose Conflict/Cancellation classification or add another timeout through r2d2 transport, without the initial proof rejecting either defect.",
      "closed_round": 4,
      "correction": "O2/O3 preserve typed operation-scoped Conflict/Cancellation with one deadline, no string parsing or cross-caller poisoning. Actual cached/worker failure and retry witnesses also assert synchronized bounded completion below an additional pool timeout, measured from a pre-spawn origin.",
      "dependencies": [
        "I2"
      ],
      "disposition": "Fix",
      "id": "I3",
      "lineage": "I2",
      "witnesses": [
        {
          "index": 1,
          "lens": "error-handling",
          "round": 2
        },
        {
          "index": 1,
          "lens": "plan",
          "round": 3
        },
        {
          "index": 1,
          "lens": "tests",
          "round": 3
        }
      ]
    },
    {
      "claim": "The r1 I1/I2 adoption rows omit explicit frozen-mandate Authority fields.",
      "closed_round": 3,
      "correction": "Additive r2 Authority supplement cites the unchanged MANDATE/threat model and opened source confirming spelling and asynchronous-establishment gaps.",
      "dependencies": [
        "I1",
        "I2"
      ],
      "disposition": "Fix",
      "id": "I4",
      "witnesses": [
        {
          "index": 2,
          "lens": "plan",
          "round": 2
        }
      ]
    },
    {
      "claim": "The changed native TypeScript codec import requires an explicit verifier runtime prerequisite for the existing integration proof.",
      "closed_round": 6,
      "correction": "Require the existing Node 24 execution route chosen by d-20261009-14, validate node version and actual native codec import/round-trip after installation, then run the unchanged full real-app proof. Missing readiness never waives verification.",
      "dependencies": [],
      "disposition": "Fix",
      "id": "I5",
      "witnesses": [
        {
          "index": 1,
          "lens": "platform-semantics",
          "round": 5
        }
      ]
    },
    {
      "id": "I6",
      "claim": "After the drift's same-parent binding admission (d-20261011-01), an r2d2 worker that upgraded the predecessor pool but was not yet admitted a connection ticket keeps the manager's BoundDatabase alive after the ticket drain reaches zero, so an alias successor that passed the barrier is refused with an immediate Conflict instead of waiting and succeeding.",
      "witnesses": [
        {
          "lens": "plan",
          "round": 7,
          "index": 1
        }
      ],
      "dependencies": [
        "I2",
        "I3"
      ],
      "disposition": "Fix",
      "correction": "O1 completion also requires that no other holder of the predecessor's pool or connection manager survives, including an upgraded-but-unadmitted r2d2 worker, so a completed record means predecessor teardown no longer holds the binding; holders outside teardown keep d-20261011-01's refusal. O2 adds a synchronized witness: worker paused after upgrade and before ticket admission, real LRU retirement, same-parent hard-link alias reopen waits, never returns the alias conflict, and opens after the worker is refused and releases the pool; ticket-only completion must fail it.",
      "closed_round": 8
    },
    {
      "id": "I7",
      "claim": "Risks still described f-20260929-05 as a separate unresolved hard-link hazard after the drift handled it through d-20261011-01.",
      "witnesses": [
        {
          "lens": "plan",
          "round": 7,
          "index": 2
        }
      ],
      "dependencies": [],
      "disposition": "Fix",
      "correction": "Risks names d-20261011-01 as preserved policy, keeps f-20261001-02 separate and names f-20261011-01 as outside the mandate; Decisions and trade-offs adds d-20261011-01 to the preserved decisions.",
      "closed_round": 8
    },
    {
      "id": "S1",
      "claim": "The r7 drift-round packet lacked the generated ROUND/DELTA/REVISED/SETTLED block.",
      "witnesses": [
        {
          "lens": "plan",
          "round": 7,
          "index": 3
        }
      ],
      "dependencies": [],
      "disposition": "Skip",
      "reason": "plan-review-delta.py on plan-r6.md versus the r7 plan printed UNCHANGED and exited 3 (plan body byte-identical); build section 4 forbids fabricating a revision round on exit 3, and the plan-refresh contract makes the process-generated drift diff the drift round's correction evidence. The r8 closure round carried the generated block."
    }
  ],
  "paths": [
    "src-tauri/src/db/repository.rs"
  ],
  "plan_file": "2026-10-09-lru-sqlite-retirement.md",
  "review": {
    "adopted_per_round": [
      2,
      2,
      1,
      0,
      1,
      0,
      2,
      0
    ],
    "per_round_seconds": [
      598.5444819927216,
      360.3882908821106,
      275.8762981891632,
      157.4865882396698,
      427.70794105529785,
      147.8915240764618,
      312.0,
      231.0
    ]
  }
}
```

## Reviews

### Round 1

Elapsed 598.5 seconds, adopted substantive issues 2. Active arbitration time and quota waits were not separately measured. No dependency wait was required. All 12 plan-capable lenses ran. The class-absent exits for chess-semantics, engine-protocol, ipc-contract, persisted-state and pgn-index are accepted against this backend resource-lifetime mandate.

I1 — platform-semantics r1 finding 1, should-fix, confidence 94. Fix adopted, awaiting closure. canonical_binding at path_authority/mod.rs:2073 preserves the leaf spelling. O1/O2 now retain and match parent identity instead of trusting path bytes. Same-parent retirement backpressure is an explicit technical trade-off. Dependencies: none.

I2 — plan r1 finding 1, blocker, confidence 90. Fix adopted, awaiting closure. repository.rs:753 and :986 allow lock-only caching with min_idle 0, :950 returns that cached entry and :1175 reaches establishment through get_connection. O2 now covers cached acquisition and actual worker establishment, with lifecycle witnesses. Dependencies: none.

Plan authorship and arbitration shared one context. Detection ran on the same model family selected for code execution. Codex role routing used review-plan for the plan lens and sensitive for the remaining applicable lenses. No source edits or runtime verification occurred.

#### Raw lens-correctness-r1

```text
No correctness defects found in O1–O3’s stated contracts.

Limitation: this is plan-only review. Reservation rechecks, capacity handling and teardown ordering require verification against the implementation (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-error-handling-r1

```text
VERDICT: APPROVED
```

#### Raw lens-minimalism-r1

```text
VERDICT: APPROVED
```

#### Raw lens-plan-r1

```text
[blocker] tasks/plans/2026-10-09-lru-sqlite-retirement.md:52 — O2 omits connection acquisition from an already cached replacement pool. Lock-only callers can cache a pool without opening SQLite (`src-tauri/src/db/repository.rs:753`, `:986`). Different identities at the same path have different keys (`:372`), so that replacement can remain cached when the old entry is later LRU-evicted. A subsequent acquisition returns the cached entry (`:950`) and calls `get_connection` (`:1175`), which can establish SQLite (`:263`) without passing through pool construction. The proposed boundaries therefore leave the same-path successor-open guarantee at plan line 56 unenforced. Cover cached acquisitions and require a lifecycle witness where the replacement is cached before predecessor eviction. (confidence: 90)

VERDICT: REVISE
```

#### Raw lens-tests-r1

```text
No findings. O1–O3 specify Rust lifecycle assertions that would fail on revert, including real LRU eviction, blocked successor opens/unlink, and retained barriers after cancellation or timeout. The repository selector and platform CI jobs include the proposed tests.

Limitation: this approves the planned proof. Implementation assertions and actual revert failures remain unverified (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-chess-semantics-r1

```text
NOT APPLICABLE: The assigned repository file and O1–O3 obligations concern SQLite connection retirement and drain ownership. They do not involve in-memory chess trees, positions, or move paths.
VERDICT: APPROVED
```

#### Raw lens-engine-protocol-r1

```text
NOT APPLICABLE: The sole file and O1–O3 obligations concern SQLite connection retirement, reopen, and deletion barriers. They do not involve engine process supervision, UCI protocol state, or asynchronous engine result routing.
VERDICT: APPROVED
```

#### Raw lens-ipc-contract-r1

```text
NOT APPLICABLE: O1–O3 cover internal SQLite retirement ownership and drain barriers in `src-tauri/src/db/repository.rs`. The plan changes no Rust↔renderer event, command, payload, subscription, capability scope, or shutdown contract.

VERDICT: APPROVED
```

#### Raw lens-persisted-state-r1

```text
NOT APPLICABLE: The assigned file is a Rust database repository. O1–O3 concern SQLite connection retirement and drain barriers, with no renderer storage keys, persisted atoms, hydration, or tab lifecycle changes.
VERDICT: APPROVED
```

#### Raw lens-pgn-index-r1

```text
NOT APPLICABLE: O1–O3 in `src-tauri/src/db/repository.rs` concern SQLite connection retirement and reopen/delete barriers. They do not change PGN byte scanning, offsets, move encoding, stored indexes, or search predicates.

VERDICT: APPROVED
```

#### Raw lens-platform-semantics-r1

```text
[should-fix] tasks/plans/2026-10-09-lru-sqlite-retirement.md:52 — On case-insensitive Windows filesystems, replacing `GameCase.db3` and authorizing its successor as `gamecase.db3` changes the object identity while preserving unequal canonical path spellings. `canonical_binding` preserves leaf casing (`src-tauri/src/infra/path_authority/mod.rs:2073`), so the proposed matching rule can miss the draining predecessor. Require filesystem-compatible name equivalence and a replacement witness using different casing at reopen, revision-read and deletion boundaries. (confidence: 94)

Limitation: This was a source-only plan review. No Windows compile check, non-Linux Unix source probe or runtime tests ran. Native runtime proof remains `rust-windows-test` and `rust-macos-test`. The `rust-platform` matrix supplies clippy/compile proof.

VERDICT: REVISE
```

#### Raw lens-tauri-security-r1

```text
No security-boundary defects found in O1–O3. The obligations retain predecessor ownership through SQLite close, fence reopen and unlink, and preserve barriers after cancellation or timeout.

Limitation: this is plan review only. Implementation and lifecycle witnesses remain unverified. Credential, session and signed-download flows are absent from the assigned change.

VERDICT: APPROVED
```


### Round 2

Elapsed 360.4 seconds, adopted substantive corrections 2 (I2 residual verification and I3 typed failure). I4 changes the review record only and is excluded from substantive adoption counts. Active arbitration time and quota waits were not separately measured. No dependency wait was required. Plan, platform-semantics, correctness, minimalism, tests and error-handling ran.

I1 — Fix closed at r2 by its platform witness and review-plan. Authority: frozen threat model includes authority-valid same-path replacement and aliases on Linux, macOS and Windows. Object OR retained-parent matching corrects the authority-spelling gap without changing pool keys. Source confirmation: repository.rs:1286 derives parent identity from its retained parent handle, path_authority/mod.rs:3706 supplies Unix device/inode or Windows handle identity.

I2 — Fix remains open at r2. review-plan r2 finding 1 is a residual blocker at confidence 90 and becomes a second witness of I2. Correctness and tests approved the establishment boundary, but review-plan found the predecessor self-ticket exception lacked its own executable witness. Confirmed repository.rs:257 admits its ticket before :263 establishes SQLite, and :197 can wait on that ticket until deadline if its own retired gate is included. Add the synchronized admitted-predecessor worker witness in O2. Authority: MANDATE names outstanding connection tickets and r2d2 replenishment as the concrete retirement trigger. Dependencies: none. First failed closure check for this lineage, no mechanism rewrite.

I3 — error-handling r2 finding 1, should-fix, confidence 90. Fix adopted, awaiting closure. Lineage: I2, correction-introduced establishment boundary. Dependencies: I2. Source confirmation: repository.rs:1656 maps pool.get through Error::from, :1297 preserves the original error when the target is valid. r2d2 0.8.10 src/lib.rs:273 stores a manager failure as text and retries. error.rs:447 maps R2d2 to Database. Authority: the frozen threat model includes cancellation and drain timeout, O3 preserves their existing safe failure behavior. Correct O2/O3 so worker barrier failure remains typed Conflict or Cancellation for the waiting operation, with no string-based classification or cross-caller contamination. No new IPC category or Error variant is required.

I4 — plan r2 finding 2, should-fix, confidence 100. Fix adopted, awaiting review-plan closure. Dependencies: I1, I2. The r1 rows omitted explicit Authority fields for the new matching and establishment mechanisms. The following additive supplement preserves the original history and records those authorities. No behavior change and no substantive adoption count.

| R1 issue | Authority | Evidence | Necessary correction |
| --- | --- | --- | --- |
| I1 | Frozen threat model: authority-valid same-path replacement and aliases on Linux, macOS and Windows. MANDATE: "same file". | path_authority/mod.rs:2078 appends the unchanged leaf spelling. repository.rs:1286 retains parent identity. | Match object OR parent identity so alias-spelled replacement cannot miss its predecessor. |
| I2 | MANDATE: r2d2 add_connection can retain a live or in-flight SQLite handle, and later deletion must drain it. Frozen threat model includes r2d2 replenishment workers. | repository.rs:753 and :986 cache an unopened pool, :950 returns it, :1175 and :263 establish later. | Fence cached and actual asynchronous establishment as well as construction. |

Plan authorship and arbitration shared one context. Detection ran on the same model family selected for code execution. No source edits or runtime verification occurred.

#### Raw lens-plan-r2

```text
CLOSED: I1 — Candidate O2 matches retained parent identity (`tasks/plans/2026-10-09-lru-sqlite-retirement.md:52`, `src-tauri/src/db/repository.rs:1286`), covering spelling differences preserved by `src-tauri/src/infra/path_authority/mod.rs:2078`.

STILL OPEN: I2 — The corrected boundaries include cached acquisition and manager establishment, but verification omits the added predecessor-worker self-ticket exception.

[blocker] tasks/plans/2026-10-09-lru-sqlite-retirement.md:58 — I2’s witnesses delay a successor worker and hold an established predecessor handle. Neither exercises a predecessor worker paused after ticket admission but before establishment (`src-tauri/src/db/repository.rs:257–263`). If retirement publishes that worker’s gate before it resumes, a barrier that waits on its own ticket stalls until timeout (`src-tauri/src/db/repository.rs:197`). Require a synchronized witness proving this worker completes or safely refuses establishment without waiting for its own ticket. The currently specified witnesses would not reject that implementation. (confidence: 90)

[should-fix] tasks/plans/2026-10-09-lru-sqlite-retirement.md:114 — The I1 and I2 adoption rows lack the required `Authority` entries. Classify the directory-wide matching and manager-establishment fencing as necessary correctness work against MANDATE, citing the spelling preservation and asynchronous establishment paths (`src-tauri/src/infra/path_authority/mod.rs:2078`, `src-tauri/src/db/repository.rs:256`). (confidence: 100)

Limitation: Source-only review. Implementation, runtime behavior and revert failures remain unverified (confidence: 100).

VERDICT: REVISE
```

#### Raw lens-platform-semantics-r2

```text
CLOSED: I1 — O1/O2 match object identity OR retained parent identity, covering differently spelled replacements on Windows and macOS. `repository.rs:1286` obtains parent identity from the retained handle. `path_authority/mod.rs:3706` uses Unix device/inode or Windows volume/file index. O2 requires casing-alias witnesses across acquisition, revision and deletion boundaries.

NOT MY CLASS: I2 — closure belongs to review-plan.

No new platform findings.

Limitation: source-only plan review. No tests, `pnpm rust:windows:check`, or non-Linux Unix source probe ran. Planned native runtime proof is `rust-windows-test` and `rust-macos-test`. The `rust-platform` matrix provides compile/clippy proof, including `-D warnings`.

VERDICT: APPROVED
```

#### Raw lens-correctness-r2

```text
CLOSED: I1 — O1/O2 match object OR retained parent identity, covering replacement spelling aliases with explicit same-parent blocking.

CLOSED: I2 — O2 fences cached acquisition and actual replenishment establishment, including self-ticket safety and reservation rechecks.

No correctness defects found in the revised contracts.

Limitation: plan-only review. Atomic publication, worker admission ordering, bounded capacity and timeout recovery remain implementation proof obligations (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-minimalism-r2

```text
NOT MY CLASS: I1 — platform-semantics owns alias-matching closure.
NOT MY CLASS: I2 — review-plan owns cached-acquisition and worker-establishment closure.

No bloat or duplication findings. The revised boundaries address concrete retirement bypasses. Shared ownership and matching have multiple required callers, and parent-identity matching avoids introducing filesystem-specific name equivalence machinery.

Limitation: implementation size and helper duplication remain unassessable until a source diff exists (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-tests-r2

```text
CLOSED: I1 — verification coverage now requires spelling-alias replacement witnesses at cached acquisition, revision and deletion boundaries, plus same-parent blocking and different-parent progress.

CLOSED: I2 — verification coverage now includes a replacement cached before eviction and delayed successor replenishment. The required assertion forbids actual successor SQLite establishment before predecessor close, so restoring either bypass would fail.

No verification findings. O1–O3 name Rust lifecycle assertions for real LRU retirement, bounded retention, protected-open/unlink ordering, and cancellation/timeout retry safety. The repository selector and platform CI test commands include the proposed witnesses. The plan explicitly requires keeping regression tests while reverting production changes and recording assertion failures.

Limitation: this closes the planned verification contracts only. Test implementations and actual revert failures remain unverified (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-error-handling-r2

```text
NOT MY CLASS: I1 — filesystem matching closure belongs to platform-semantics.
NOT MY CLASS: I2 — establishment-boundary closure belongs to plan.

[should-fix] tasks/plans/.plan-2026-10-09-lru-sqlite-retirement.md-r2.body.md:54 — O2 adds connection-manager barrier failures without specifying their typed caller outcome. When a delayed worker times out behind a predecessor while the target remains valid, r2d2 stringifies and retries its error. The existing `get_connection` path returns `Error::R2d2`, classification preserves it, and IPC surfaces category `database` with “database failure”. Require predecessor timeout/cancellation classification to survive this boundary, with a failure witness. O1’s explicit Cancellation/Conflict requirement covers capacity exhaustion only. (confidence: 90)

VERDICT: APPROVED
```


### Round 3

Elapsed 275.9 seconds, adopted substantive corrections 1 (I3 residual completion verification). Active arbitration time and quota waits were not separately measured. No dependency wait was required. Plan, error-handling, correctness and tests ran.

I2 — Fix closed at r3 by review-plan. O2 requires the admitted-predecessor worker completion/order witness. Its complete r1/r2 witnesses remain recorded.

I4 — Fix closed at r3 by review-plan. The additive Authority supplement records the frozen mandate/threat model and opened source supporting I1/I2.

I3 — Fix remains open at r3. Error-handling and correctness approved typed outcomes, but plan r3 finding 1 (blocker, confidence 90) and tests r3 finding 1 (should-fix, confidence 95) independently found the same missing bounded-completion witness. Deduplicate both into I3, no new issue ID. The current proof could pass after correctly classified failure plus an extra pool timeout. Confirmed repository.rs:1661 calls pool.get, :74 configures 2 seconds in tests and 30 seconds in production. The reviewed O2 forbids the second budget. Authority: frozen threat model includes cancellation and drain timeout. Add O3 completion/duration assertions with a pre-spawn origin, synchronized barrier and cancellation, a bound below the extra pool timeout and predecessor retention through the outcome assertion. Dependencies: I2. Lineage: I2. First failed closure check for I3.

Plan authorship and arbitration shared one context. Detection ran on the same model family selected for code execution. No source edits or runtime verification occurred.

#### Raw lens-plan-r3

```text
I2 CLOSED — PLAN `tasks/plans/.plan-2026-10-09-lru-sqlite-retirement.md-r3.body.md:62` now requires an admitted predecessor-worker witness that rejects self-waiting. It covers ticket admission before establishment at `src-tauri/src/db/repository.rs:257` and `:263`.

[blocker] I3 NOT CLOSED — PLAN `tasks/plans/.plan-2026-10-09-lru-sqlite-retirement.md-r3.body.md:58` forbids a second pool timeout, but its verification at `:72` asserts categories and retry independence without bounded completion. An implementation could retain `pool.get()` (`src-tauri/src/db/repository.rs:1661`), spend its additional configured timeout (`:74`), then return typed `Conflict` or `Cancellation` and satisfy those assertions. Require a synchronized completion bound that fails when acquisition adds another timeout or delays cancellation. (confidence: 90)

I4 CLOSED — The additive Authority supplement at `tasks/plans/2026-10-09-lru-sqlite-retirement.md:236` supplies both missing authorities, supported by spelling preservation at `src-tauri/src/infra/path_authority/mod.rs:2078` and delayed cached establishment at `src-tauri/src/db/repository.rs:986` and `:1175`.

VERDICT: REVISE
```

#### Raw lens-error-handling-r3

```text
I3 CLOSED — PLAN:57 requires operation-scoped Conflict/Cancellation through r2d2 transport, one shared deadline, and caller independence. PLAN:72 requires authority-valid cached-worker witnesses asserting Rust variants and IPC categories, retry success, and failure when generic pool errors replace typed results. Implementation proof remains pending.

VERDICT: APPROVED
```

#### Raw lens-tests-r3

```text
I2 CLOSED — O2 now requires a real predecessor worker paused after ticket admission, resumed after retirement publication. Its completion-before-deadline and ticket-release assertions would reject self-waiting.

I3 CLOSED — O3 requires actual cached-worker failures with an authority-valid target, asserts both Rust variant and ErrorCategory, and checks healthy-caller independence and retry success. Generic R2d2/database classification would fail.

[should-fix] tasks/plans/.plan-2026-10-09-lru-sqlite-retirement.md-r3.body.md:72 — The new prohibition on a second pool timeout has no corresponding duration assertion. Cached acquisition could exhaust the predecessor deadline, wait another pool timeout, then return correctly typed Conflict and pass every stated outcome/retry assertion. Require a synchronized deadline-bound assertion that fails when acquisition starts a second timeout budget. (confidence: 95)

Limitation: This checks planned proof contracts. Implemented assertions and measured revert failures remain unverified (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-correctness-r3

```text
I2 CLOSED — O2:54,62 requires cached and worker establishment fencing, plus a synchronized admitted-predecessor witness proving ticket release without self-wait or deadline expiry.

I3 CLOSED — O2:58 and O3:72 require operation-scoped Conflict/Cancellation through r2d2 transport, one shared deadline, and independent healthy callers and retries.

Limitation: plan-only review. Publication ordering, typed-result transport and actual lifecycle/revert assertions remain unverified until implementation (confidence: 100).

VERDICT: APPROVED
```


### Round 4

Elapsed 157.5 seconds, adopted substantive corrections 0. Active arbitration time and quota waits were not separately measured. No dependency wait was required. Plan, error-handling and tests ran, covering every I3 witness.

I3 — Fix closed at r4 by error-handling, tests and review-plan. O2/O3 require operation-scoped typed timeout/cancellation through worker transport, shared deadlines, healthy caller independence and actual failure/retry witnesses. The residual completion proof now rejects an added pool timeout or delayed cancellation using a synchronized bound measured from a pre-spawn origin. I1 remained closed at r2, I2 and I4 at r3.

Final disposition: four distinct issues, all Fix and closed. Seven raw prefixed findings are represented by metadata witnesses. I2 has two witnesses across r1/r2, I3 has three across r2/r3. No Skip, Defer, withdrawn mechanism, successor finding, or carried CR item. Dependencies: I3 depends on I2, I4 depends on I1/I2. Completed-round substantive adoption counts: r1=2 r2=2 r3=1 r4=0. No non-convergence trigger fired. Neither lineage failed two closure checks.

The authoritative phase obligations are O1–O3 and their verification levels. Same-parent conservative backpressure is explicit. Implementer helper structure remains unfrozen. Runtime, implementation size, atomic publication and platform execution remain unverified adoption work. The finding remains open and no ledger claim or closure was made.

Plan authorship and arbitration shared one context. Detection ran on the same model family selected for code execution. No source edits, installation, runtime tests, commit or push occurred.

#### Raw lens-plan-r4

```text
I3 CLOSED — `tasks/plans/.plan-2026-10-09-lru-sqlite-retirement.md-r4.body.md:74` requires synchronized completion assertions below the pool timeout, predecessor retention through outcome assertion, and failure when extra budgets or delayed cancellation return. This rejects the `pool.get()` delay at `src-tauri/src/db/repository.rs:1661`, configured as two seconds in tests at `:76`, while preserving O2’s typed-result and caller-independence requirements. Closure covers the planned proof. Implementation and measured revert failures remain unverified (confidence: 95).

VERDICT: APPROVED
```

#### Raw lens-tests-r4

```text
I3 CLOSED — PLAN:74 requires synchronized cached/worker timeout and cancellation completion assertions, measured from a pre-spawn origin while the predecessor remains held. The bound must fall below the additional pool timeout and fail when a second budget or delayed cancellation is restored. Multiple predecessors or a reservation recheck must also reject refreshed budgets. This closes the planned proof gap. Implemented assertions and measured revert failures remain unverified (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-error-handling-r4

```text
I3 CLOSED — PLAN:58,72,74 requires typed, operation-scoped Conflict/Cancellation and synchronized completion bounds below the additional pool timeout, with predecessors held through outcome assertions. Witnesses must reject refreshed budgets and delayed cancellation while preserving healthy-caller and retry independence. Implementation and measured revert failures remain pending.

VERDICT: APPROVED
```


### Round 5 — refresh drift

PLAN-REFRESH from BASE 8ebc643ef5569b29f269415a7b2f958c1e4e78c2 to NEW-BASE ca0ab68689e0f4de8ca0b84df2be29963bcfc66c. Elapsed 427.7 seconds, adopted substantive corrections 1. All 12 specified REFRESH-LENSES ran. Earlier r1-r4 history and issue dispositions are preserved. Active arbitration and quota waits were not separately measured. No dependency wait was required.

I5 — platform-semantics r5 finding 1, should-fix, confidence 98. Fix adopted, awaiting closure. Changed path: scripts/verify-app.mjs:508 now imports src/state/store/debouncedStorage.ts directly. Invalidated obligation: the plan Phases real-app startup/IPC/shutdown proof lacked its Node runtime prerequisite. Confirmed package.json:78 runs plain node and :174 permits Node >=20.19.0. Current node --version reports v24.21.0. Decision d-20261009-14 already chooses that native-codec execution route. Dependencies: none.

Authority: the existing Phases real-app integration proof must execute successfully and cannot be waived. Correction revision r6 explicitly requires the already chosen Node 24 runtime, version readiness and a native codec compressed round-trip before that unchanged full-app command. This is a proof-environment prerequisite, no source mechanism, engine-range change or reversal of d-20261009-14. Rejected expanding the SQLite mandate into generic verifier-runtime support. Reversal remains a separately reviewed compatibility change preserving the shared codec and full integration proof.

Source inference, not a Node 20 runtime measurement: [Node 20.19 ESM loader documentation](https://nodejs.org/download/release/v20.19.0/docs/api/esm.html#features) excludes the .ts extension, while [Node 24.21 TypeScript documentation](https://nodejs.org/download/release/v24.21.0/docs/api/typescript.html#type-stripping) describes native type stripping. No Node 20 executable, package installation or runtime verifier was run by this planner.

All other raw verdicts are APPROVED, with source-only limitations retained. The reviewer plan limitation about absent ROUND/DELTA refers to the first refresh drift round, which uses the exact process-generated source drift instead of inventing a plan revision. It does not withdraw r1-r4 closure evidence. The planned repository.rs source is byte-unchanged across the two bases. Existing unavailable remote CI is recorded by f-20261009-04 and remains an adoption precondition, no required gate is removed.

Plan authorship and arbitration shared one context. Detection ran on the same model family selected for code execution. No source edits, ledger mutation, install, runtime proof, commit or push occurred.

#### Raw lens-chess-semantics-r5

```text
No chess-semantics drift invalidation found. The tree schema refactor preserves FENs, metadata, child ordering and stored-path repair. The verifier’s new workspace fixture preserves the existing startup, IPC and shutdown checks required by the plan.

Limitation: runtime proofs were not rerun in this read-only review.

VERDICT: APPROVED
```

#### Raw lens-correctness-r5

```text
No correctness drift invalidation found. The workspace reload checks preserve the plan’s startup, IPC and shutdown proof.

Named limitation: the new direct `.ts` import in `scripts/verify-app.mjs:508` was not exercised on older Node versions allowed by `package.json`. Runtime compatibility remains unverified under this review’s no-test constraint (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-engine-protocol-r5

```text
No drift invalidation within this lens. Workspace initialization changes preserve tab identities without changing engine process keys or result routing. The added `scripts/verify-app.mjs` reload checks retain the existing startup/IPC/shutdown proof required by the plan.

Limitation: read-only source review. No runtime proofs rerun.

VERDICT: APPROVED
```

#### Raw lens-error-handling-r5

```text
No drift invalidation found. The changed reload verifier uses bounded polling, records failures with assertion context, and exits 1 on check or cleanup failure. The plan’s startup/IPC/shutdown integration proof remains applicable. O1–O3’s failure contracts are unchanged.

Limitation: runtime behavior was not rerun in this read-only review (confidence: 95 in the traced failure routing).

VERDICT: APPROVED
```

#### Raw lens-ipc-contract-r5

```text
No IPC drift invalidation found. The changes to `src/index.tsx` and `scripts/verify-app.mjs` preserve the registered `release_previous_document_operations` and `prepare_native_read` contracts, including exact-ticket checks for reload cancellation and window destruction. The added workspace assertions retain the plan’s startup, IPC and shutdown integration proof.

No event, command signature, generated binding or capability scope changed.

Limitation: runtime proof was not rerun in this read-only review. The adopting executor must run the plan’s prescribed integration command.

VERDICT: APPROVED
```

#### Raw lens-minimalism-r5

```text
No drift invalidation found in this lens. `scripts/verify-app.mjs` reuses the existing reload sequence and storage serializer without requiring another verifier or expanding the retirement implementation. O1–O3 and the existing startup/IPC/shutdown proof remain applicable.

Limitation: runtime status remains unmeasured in this read-only review.

VERDICT: APPROVED
```

#### Raw lens-persisted-state-r5

```text
No drift invalidation found. Workspace and tree writers/readers retain matching encoding, and unload flushing remains intact. The added reload assertions preserve the plan’s real startup/IPC/shutdown integration proof.

Limitation: read-only source review. No runtime tests rerun.

VERDICT: APPROVED
```

#### Raw lens-pgn-index-r5

```text
No drift invalidation. PGN scanning, indexing, database encoding, and repository source are unchanged. The verifier additions use the canonical serializer for workspace seeding and preserve existing PGN checks and the planned startup/IPC/shutdown proof.

Limitation: runtime proof was not rerun during this read-only review.

VERDICT: APPROVED
```

#### Raw lens-plan-r5

```text
No drift invalidation found. The changed workspace initialization and verifier preserve the integration proof at tasks/plans/.plan-2026-10-09-lru-sqlite-retirement.md-r5.body.md:108. scripts/verify-app.mjs:3399 adds workspace assertions while retaining titlebar shutdown checks at :3460 and failure propagation at :3651. The Rust repository source is unchanged.

Named limitations: runtime proofs were not rerun. No process-generated ROUND/DELTA/REVISED/SETTLED block was supplied, so this result covers the supplied source drift without re-establishing prior issue closure (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-platform-semantics-r5

```text
[should-fix] scripts/verify-app.mjs:509 — The drift adds a direct `.ts` import to the plain Node verifier. On Linux with supported Node 20.19 (`package.json:174`), loading fails with `ERR_UNKNOWN_FILE_EXTENSION` before app startup. This invalidates the plan’s required `pnpm verify:app` integration proof on that supported runtime. Recorded Node 24 success does not cover Node 20 (confidence: 98).

No Rust platform premise changed. No tests, Windows compile check or non-Linux Unix source probe ran. Windows and macOS runtime proof remains required through `rust-windows-test` and `rust-macos-test`, with `rust-platform` providing compile/clippy coverage.

VERDICT: REVISE
```

#### Raw lens-tauri-security-r5

```text
No security drift invalidation found. The workspace changes preserve the original path-owner snapshot and do not change credential storage. `scripts/verify-app.mjs` retains real IPC, reservation-sweep and shutdown assertions, preserving the plan’s integration-proof obligation.

Limitation: runtime proofs were not rerun during this read-only review.

VERDICT: APPROVED
```

#### Raw lens-tests-r5

```text
No drift invalidation found. `scripts/verify-app.mjs` preserves real startup, IPC, reservation-sweep and shutdown checks. Added reload assertions compare rendered tab IDs and selection against the seeded values, and failures produce exit code 1.

Limitation: runtime status remains unmeasured in this review. The planned Rust witnesses and revert proof remain required for O1–O3.

VERDICT: APPROVED
```


### Round 6 — refresh correction closure

Elapsed 147.9 seconds, adopted substantive corrections 0. Plan, platform-semantics, tests and minimalism checked the runtime-prerequisite correction. Active arbitration and quota waits were not separately measured. No dependency wait was required.

I5 — Fix closed at r6 by platform-semantics and review-plan. The required full app proof now has d-20261009-14's explicit Node 24 prerequisite plus native codec import/round-trip readiness. No verifier implementation, engine range, source ownership or SQLite contract changed. I1-I4 retain their original closure rounds and metadata verbatim. Five distinct issues are closed with eight total raw prefixed findings. No Skip, Defer, carried item or withdrawn mechanism exists.

Refresh result: plan valid at NEW-BASE ca0ab68689e0f4de8ca0b84df2be29963bcfc66c. Frozen original BASE and trace remain historical evidence. Source drift did not change repository.rs or O1-O3. The only plan-body correction is verifier runtime readiness and its recorded technical choice. Earlier source-only limitations still apply. Runtime proof and the existing remote CI prerequisite f-20261009-04 remain adoption work, with no gate waived. The finding remains open.

Plan authorship and arbitration shared one context. Detection ran on the same model family selected for code execution. This planner performed no source edit, ledger mutation, installation, runtime proof, commit or push.

#### Raw lens-plan-r6

```text
I5 CLOSED — tasks/plans/.plan-2026-10-09-lru-sqlite-retirement.md-r6.body.md:98 requires Node 24, version readiness and native codec import/round-trip after installation, before the unchanged full-app proof at :112. This addresses scripts/verify-app.mjs:508 while preserving d-20261009-14 and the implementation scope (confidence: 98).

No DELTA or dependent-obligation defect found. Shutdown checks at scripts/verify-app.mjs:3460 and failure propagation at :3651 remain intact. The repository source is unchanged across the supplied bases.

Named limitation: runtime proofs were not rerun in this read-only review. Adoption readiness and the full-app result remain unverified (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-platform-semantics-r6

```text
I5 CLOSED — r6 plan:90,98 requires the existing Node 24 runtime, version verification, dependency installation and actual native codec import/compressed round-trip before the unchanged full-app proof. This preserves d-20261009-14 without claiming Node 20 compatibility or expanding implementation scope.

No DELTA defect, drift invalidation or plan blocker found.

Limitation: read-only review ran no runtime proofs, Windows compile check or non-Linux Unix source probe. Adoption still requires those applicable checks and native `rust-windows-test`, `rust-macos-test` and `rust-platform` CI evidence.

VERDICT: APPROVED
```

#### Raw lens-tests-r6

```text
I5 CLOSED — r6 requires Node 24 version readiness and actual native codec import/compressed round-trip after installation, before the unchanged full-app proof. Import failure cannot waive that proof.

No drift invalidation found. The changed verifier retains startup, IPC and shutdown assertions. O1–O3 retain deterministic Rust witnesses and explicit revert-to-red proof.

Named limitation: runtime proofs were not rerun in this read-only review. Closure confirms the planned verification obligation, not runtime success (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-minimalism-r6

```text
I5 CLOSED — r6 requires the existing Node 24 runtime, version readiness, and native codec import/compressed round-trip after installation before the unchanged full-app proof. It preserves d-20261009-14 without expanding source scope.

No minimalism drift invalidation found. The verifier shares the production codec, and the delta adds necessary proof prerequisites without another serializer, helper, or configuration surface.

VERDICT: APPROVED
```


### Round 7 — second refresh drift

PLAN-REFRESH from BASE ca0ab68689e0f4de8ca0b84df2be29963bcfc66c to NEW-BASE 0ee13ca0f0cf7ed2ce1c5313e6adf8f39780a7b3, drift file `drift-ca0ab686…-0ee13ca0….diff` (exactly `git diff` of the two bases, 126 files). Elapsed 312 seconds wall for the parallel lens round, adopted substantive corrections 2 (I6, I7). All 12 specified REFRESH-LENSES ran at r7, `--role sensitive` (src-tauri/src/db/** is a Sensitive-Path glob), review-plan at `--role review-plan`. Earlier r1-r6 history and issue dispositions are preserved verbatim. Active arbitration and quota waits were not separately measured. No dependency wait was required.

Unlike the first refresh, the planned source changed: `src-tauri/src/db/repository.rs` (struct doc, alias-refusal tests) and its traced dependency `src-tauri/src/db/bound_sqlite.rs`, where f-20260929-05 / d-20261011-01 made `BoundDatabase::acquire` refuse a distinct binding key for an inode with a live binding or creation reservation under the same parent (`Conflict("database is open through another name")`).

I6 — plan r7 finding 1, blocker, confidence 90. Fix adopted, awaiting closure. Claim: O1's completion condition counts connection tickets and the evictor's own pool disposal, but an r2d2 replenishment worker can retain the predecessor's binding without a ticket, so after the drift an alias successor that passed the barrier can receive an immediate admission Conflict instead of waiting and succeeding. Source confirmation: r2d2 0.8.10 `src/lib.rs:236-241` upgrades the weak pool on the worker and only then calls `shared.manager.connect()`; `repository.rs:247-252` enters the connection ticket inside `BoundConnectionManager::connect`, and the manager struct at `:240-244` owns `database: BoundDatabase`; `close_connections` at `:1665-1677` closes admission, drops the entry's pool and waits only on that ticket gate. The drift's `bound_sqlite.rs` admission predicate refuses a different same-parent key while any registration holder survives, and d-20261011-01 names the pool manager among those holders. Changed path: `src-tauri/src/db/bound_sqlite.rs` `BoundDatabase::acquire`. Invalidated obligations: O1 completion ("A zero count must prove …") and O2's alias reopen / O3's retry-after-closure guarantee. Dependencies: I2 (worker lifecycle witness), I3 (typed Conflict/Cancellation).

Authority: MANDATE "keep the evicted gates reachable so `delete_exclusive_inner` and `entry()` rebuild wait on them through `DrainGate::wait_drained` before unlinking or opening a fresh pool" — a rebuild that waits and is then refused does not open the fresh pool; frozen threat model "r2d2 replenishment workers … aliases". Correction revision r8: O1 completion now also requires that no other holder of the predecessor's pool or manager survives, including an upgraded-but-unadmitted worker, so a completed record means predecessor teardown no longer holds the binding; holders outside teardown (a caller holding the entry) keep d-20261011-01 unchanged. O2 adds a synchronized witness: worker paused after upgrade and before ticket admission, real LRU retirement, same-parent hard-link alias reopen waits, never returns the alias conflict, and opens after the worker is refused and releases the pool; ticket-only completion must fail it. This extends the existing completion contract, it does not add a component, process, watcher or public error; the mechanism stays the executor's. "Not worse than today" was considered and rejected as the disposition: at NEW-BASE the hazard exists too, but the plan's own O2/O3 promise (wait, then succeed) becomes false for aliases without the correction, so it is a plan defect, not a pre-existing limit.

I7 — plan r7 finding 2, should-fix, confidence 100. Fix adopted, awaiting closure. Claim: Risks still described f-20260929-05 as a separate unresolved hazard although the drift handled it (`tasks/findings.md:12452` header `Status: handled`). Correction revision r8: Risks names d-20261011-01 as preserved policy, keeps f-20261001-02 separate and names the newly filed rename-retention finding f-20261011-01 as outside this mandate; Decisions and trade-offs adds d-20261011-01 to the preserved decisions. Frozen `## Traced premises` (incl. `bound_sqlite.rs:188`) stays as historical evidence of the original base, as in r5. Reference-level, but the arbiter keeps it on the r8 closure because the review-plan lens reruns anyway.

S1 — plan r7 finding 3, should-fix, confidence 100. Skip. Claim: the r7 packet lacked the `ROUND`/`DELTA`/`REVISED`/`SETTLED` block. Evidence: `python3 ~/.claude/scripts/plan-review-delta.py plan-r6.md <plan> --round 7` printed `UNCHANGED` and exited 3, because the plan body was byte-identical to r6; build §4 forbids fabricating a revision round on exit 3, and the build skill's plan-refresh section defines the process-generated drift diff, not a plan delta, as the drift round's correction evidence. The r8 closure round carries the generated block because r8 revises the plan.

All other raw verdicts are APPROVED with source-only limitations retained. Correctness, platform-semantics, tests, error-handling, minimalism, pgn-index and tauri-security each examined the new alias refusal and found it compatible with O1-O3's drain-before-successor ordering; none examined the upgraded-but-unadmitted worker interval, which is why their approval does not contradict I6. The newly filed f-20261011-01 (rename retention of an idle cached entry) is a separate open finding and is not added to this mandate. No out-of-scope defect was reported, so nothing was filed.

Plan authorship and arbitration shared one context. Detection ran on Codex (OpenAI high tier), the same model family selected for code execution. No source edits, ledger mutation, install, runtime proof, commit or push occurred.

#### Raw lens-chess-semantics-r7

```text
No chess-semantics drift invalidation found. Reviewed tree replacement, PGN parsing, move legality, path handling and the expanded real-app verifier against the Phases integration proof. No changed premise invalidates O1–O3 within this lens.

Limitation: read-only source review. Runtime proofs remain the adopter’s responsibility.

VERDICT: APPROVED
```

#### Raw lens-correctness-r7

```text
No correctness drift invalidation found. The new same-inode admission refusal remains compatible with O1’s disposal ordering and O2–O3’s predecessor barriers. Different-inode cached replacements remain reachable.

Limitation: runtime and platform proofs were not executed in this read-only review. Static contract assessment confidence: 90.

VERDICT: APPROVED
```

#### Raw lens-engine-protocol-r7

```text
No drift invalidation found within the UCI lens. The board/tab changes, shared progress changes and expanded verifier do not invalidate O1–O3 or the Phases integration proof through engine supervision, protocol ordering or result routing.

Limitation: read-only source review. No runtime verification performed.

VERDICT: APPROVED
```

#### Raw lens-error-handling-r7

```text
No error-handling drift invalidation found.

The new `BoundDatabase::acquire` alias refusal propagates typed `Error::Conflict` before SQLite opens. O1’s disposal requirement and O2’s barriers before pooled and transient establishment remain compatible with it. O3 still requires retained barriers, independent cancellation, typed outcomes and bounded retries.

The expanded `verify-app.mjs` records caught assertion failures and exits nonzero. Its catches do not turn failed integration checks into passing proof.

Limitation: implementation witnesses and native/platform proofs were not executed in this read-only review. Their results remain adoption requirements (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-ipc-contract-r7

```text
No IPC drift invalidation found. Changed progress paths retain registered `ProgressEvent`, matching ids, generations and percentage units. New verifier calls match registered commands and generated invoke keys. Capability scopes and bindings are unchanged.

O1–O3 and the integration-proof obligation remain intact within this lens. Static review only, with no runtime proof performed.

VERDICT: APPROVED
```

#### Raw lens-minimalism-r7

```text
No bloat or duplication in the inspected drift invalidates O1–O3 or the Phases proof obligations. Binding admission refusal does not replace predecessor drain ordering. The plan still requires one shared retirement contract and reuses the existing verifier and production codec without expanding the mandate.

VERDICT: APPROVED
```

#### Raw lens-persisted-state-r7

```text
No drift invalidation found within this lens. The changed workspace and tree writers/readers use the same compressed codec and physical `treeKey`. Creation, replacement, hydration, duplication, close cleanup and verifier snapshots consistently resolve that key. The unload flush remains intact.

These changes do not invalidate O1–O3 or the Phases integration proof. Runtime readiness and `pnpm build && pnpm verify:app` remain adoption obligations, unverified by this read-only review.

VERDICT: APPROVED
```

#### Raw lens-pgn-index-r7

```text
No drift invalidation found within this lens. Import, decode and search share FEN reconstruction and detected castling mode. The archived index format remains unchanged.

The new alias refusal remains compatible with O1–O3’s required binding release and predecessor drain before successor opens, including revision reads. Runtime proof remains the adopter’s obligation. This review was read-only.

VERDICT: APPROVED
```

#### Raw lens-plan-r7

```text
[blocker] tasks/plans/.plan-2026-10-09-lru-sqlite-retirement.md-r7.body.md:44 — O1’s completion condition misses a predecessor binding retained without a connection ticket. Changed premise: `BoundDatabase::acquire` now refuses same-parent aliases while any binding holder survives (`src-tauri/src/db/bound_sqlite.rs:217`). An r2d2 worker upgrades the pool before calling `connect` (`r2d2-0.8.10/src/lib.rs:236`), retaining `BoundConnectionManager.database` before ticket admission (`src-tauri/src/db/repository.rs:247`, `:257`). If paused there across eviction, the evictor can finish disposal and the connection count reach zero while the binding remains alive. O2’s alias reopen and O3’s successful retry (`PLAN:60`, `:66`) can then return immediate admission `Conflict`. The planned admitted-worker witness at `PLAN:62` does not exercise this interval. Require retirement completion to account for predecessor-owned binding holders and a synchronized witness proving alias reopen waits and succeeds after that worker releases ownership. (confidence: 90)

[should-fix] tasks/plans/.plan-2026-10-09-lru-sqlite-retirement.md-r7.body.md:94 — Risks still describes f-20260929-05 as a separate unresolved hard-link hazard. Changed premise: the new admission predicate prevents concurrent distinct same-parent bindings (`src-tauri/src/db/bound_sqlite.rs:217`), and the drift marks that finding handled (`tasks/findings.md:12452`). Update the current risk statement to preserve d-20261011-01’s refusal policy and distinguish the separately filed rename-retention defect, f-20261011-01. Leave the historical trace intact. (confidence: 100)

[should-fix] tasks/plans/2026-10-09-lru-sqlite-retirement.md:120 — The history establishes earlier rounds, but this r7 packet omits the required process-generated `ROUND`, `DELTA`, `REVISED`, `SETTLED` block. The supplied source drift does not replace that input under `/home/felixb/.claude/references/review-lens-contract.md:246`, `:262`. Supply the block or explicitly resolve the refresh-specific contract exception. (confidence: 100)

Named limitation: these conclusions are source-traced. No runtime proofs or platform CI were run, and prior issue closure was not re-established.

VERDICT: REVISE
```

#### Raw lens-platform-semantics-r7

```text
No platform drift invalidates O1–O3 or the Phases proof obligations. The new alias refusal makes draining and releasing predecessor bindings before successor acquisition essential. O1’s completed-disposal requirement and O2’s establishment barriers already require that ordering. Windows name folding remains unchanged, and parent-identity matching still covers replacement spellings.

The adjusted replacement fixture releases its setup binding before reopening the renamed inode. New alias tests do not replace the plan’s required platform-neutral ownership and error/retry witnesses.

Limitation: source-only review. No tests, `pnpm rust:windows:check`, or non-Linux Unix source probe ran. Adoption still requires Windows/macOS runtime evidence from `rust-windows-test` and `rust-macos-test`, plus compile/clippy evidence from `rust-platform`. The changed integration verifier remains covered by the existing Node 24 readiness and full real-app proof requirements.

VERDICT: APPROVED
```

#### Raw lens-tauri-security-r7

```text
No security drift invalidation found. The new hard-link admission refusal preserves native authority and binding lifetime. O1–O3 still require drain completion before successor opens or deletion. Changed diagnostics remain native.

Limitation: runtime and platform proofs were not executed. Credential and signed-download flows are unchanged.

VERDICT: APPROVED
```

#### Raw lens-tests-r7

```text
No drift invalidation found. O1–O3 retain assertions for real LRU ownership, blocked successor opens/unlink, WAL close ordering, failed-drain retention, typed errors and bounded completion. Immediate alias refusal alone cannot satisfy O2’s blocking and completion obligations.

The repository selector and platform CI still reach the planned witnesses. The expanded app verifier preserves IPC and shutdown assertions.

Limitation: this read-only review supplies no runtime or revert-to-red evidence. Those remain required adoption proofs (confidence: 100).

VERDICT: APPROVED
```


### Round 8 — refresh correction closure

Elapsed 231 seconds wall for the parallel lens round, adopted substantive corrections 0. Lenses: review-plan (witness of I6 and I7, `--role review-plan`), plus tests, correctness, platform-semantics and error-handling as newly affected domain lenses for the corrected O1 completion contract and O2 witness (`--role sensitive`). Each prompt carried the generated re-review block (`plan-review-delta.py plan-r7.md <plan> --round 8`, exit 0, REVISED: O1, O2, Decisions and trade-offs, Risks / open questions). Active arbitration and quota waits were not separately measured. No dependency wait was required.

I6 — Fix closed at r8 by review-plan (`I6 CLOSED`), with tests, correctness, platform-semantics and error-handling reporting the corrected O1/O2 sound in their class. O1 now requires every holder of the predecessor's pool or manager, including an upgraded-but-unadmitted r2d2 worker, to be gone before a predecessor record completes; O2 adds the synchronized alias-reopen witness that fails under ticket-only completion.

I7 — Fix closed at r8 by review-plan (`I7 CLOSED`). Risks and Decisions now preserve d-20261011-01 and separate handled f-20260929-05, f-20261001-02 and the out-of-mandate f-20261011-01.

Refresh result: plan valid at NEW-BASE 0ee13ca0f0cf7ed2ce1c5313e6adf8f39780a7b3. Totals across the lineage: 8 completed rounds, 7 distinct Fix issues (I1-I7) all closed, 1 Skip (S1), 11 raw prefixed findings. No Defer, carried item or withdrawn mechanism exists; nothing was filed. Frozen original BASE and `## Traced premises` remain historical evidence. Runtime proof, the revert-to-red proof, Node 24 readiness, full real-app proof and the remote platform CI prerequisite f-20261009-04 remain adoption work, with no gate waived. The finding remains open.

Plan authorship and arbitration shared one context. Detection ran on Codex (OpenAI high tier), the same model family selected for code execution. This planner performed no source edit, ledger mutation, installation, runtime proof, commit or push.

#### Raw lens-plan-r8

```text
I6 CLOSED — r8 PLAN:44 requires predecessor pool and manager ownership to end before completion. PLAN:64 adds the synchronized pre-admission worker witness and rejects ticket-only completion. This covers r2d2’s upgrade-before-connect interval (`r2d2-0.8.10/src/lib.rs:236`), the manager’s binding ownership (`src-tauri/src/db/repository.rs:247`), and alias refusal (`src-tauri/src/db/bound_sqlite.rs:217`). Existing lifecycle, typed-error and bounded-completion obligations remain intact.

I7 CLOSED — r8 PLAN:82 and PLAN:96 preserve d-20261011-01 and correctly distinguish handled f-20260929-05 (`tasks/findings.md:12452`) from the separate rename-retention finding (`tasks/findings.md:15154`).

Named limitation: source-only review. Implementation, revert-to-red, real-app and platform proofs remain unexecuted adoption requirements (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-tests-r8

```text
No verification defect introduced by r8. O2’s new witness at PLAN:64 pauses a real worker before ticket admission and asserts alias reopening waits, avoids immediate Conflict, and succeeds after pool release. Ticket-only retirement completion would fail those assertions. Existing admitted-worker, typed-error, bounded-completion and retry obligations remain intact.

The repository selector and platform CI reach the planned witnesses. Real-app integration remains complementary proof.

Limitation: source-only review. Implemented assertions, revert-to-red results and runtime/platform evidence remain adoption requirements (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-correctness-r8

```text
No correctness drift invalidation found. O1 now requires predecessor pool and manager holders to release their binding before completion. O2’s added witness covers the upgraded-but-unadmitted worker interval. External entry holders retain the existing alias refusal.

Limitation: static contract review only. Implementation and runtime witnesses remain adoption requirements (confidence: 90).

VERDICT: APPROVED
```

#### Raw lens-platform-semantics-r8

```text
No platform defect introduced by the r8 delta. O1 now covers upgraded-but-unadmitted workers retaining the predecessor manager. O2’s synchronized hard-link witness tests that interval, while Phase proof requires central ownership and error/retry witnesses on Linux, macOS and Windows. Parent-identity matching and Windows binding-name folding remain intact. The revised Risks text preserves d-20261011-01’s admission policy.

Limitation: source-only review. No tests, `pnpm rust:windows:check`, or non-Linux Unix source probe ran. Windows/macOS runtime proof remains required from `rust-windows-test` and `rust-macos-test`. `rust-platform` supplies target compile/clippy evidence. Node 24 readiness and full real-app integration proof remain adoption obligations.

VERDICT: APPROVED
```

#### Raw lens-error-handling-r8

```text
No error-handling defect introduced by the r8 delta found. Corrected O1/O2 require retaining the barrier until upgraded-but-unadmitted workers release predecessor ownership. O2/O3 preserve fail-closed behavior, typed Conflict/Cancellation outcomes, one absolute deadline, and independent retries.

Limitation: source-only plan review. Implementation, bounded-completion witnesses and platform proofs remain adoption requirements (confidence: 95).

VERDICT: APPROVED
```


## Evidence

### Manifest

[
  {
    "artefact": "lens-chess-semantics-r1.jsonl",
    "findings": [],
    "lens": "chess-semantics",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-chess-semantics-r1.prompt",
    "report": "lens-chess-semantics-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-correctness-r1.jsonl",
    "findings": [],
    "lens": "correctness",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-correctness-r1.prompt",
    "report": "lens-correctness-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-correctness-r2.jsonl",
    "findings": [],
    "lens": "correctness",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-correctness-r2.prompt",
    "report": "lens-correctness-r2.txt",
    "round": 2,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-correctness-r3.jsonl",
    "findings": [],
    "lens": "correctness",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-correctness-r3.prompt",
    "report": "lens-correctness-r3.txt",
    "round": 3,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-engine-protocol-r1.jsonl",
    "findings": [],
    "lens": "engine-protocol",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-engine-protocol-r1.prompt",
    "report": "lens-engine-protocol-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-error-handling-r1.jsonl",
    "findings": [],
    "lens": "error-handling",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-error-handling-r1.prompt",
    "report": "lens-error-handling-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-error-handling-r2.jsonl",
    "findings": [
      {
        "kind": "should-fix",
        "text": "tasks/plans/.plan-2026-10-09-lru-sqlite-retirement.md-r2.body.md:54 — O2 adds connection-manager barrier failures without specifying their typed caller outcome. When a delayed worker times out behind a predecessor while the target remains valid, r2d2 stringifies and retries its error. The existing `get_connection` path returns `Error::R2d2`, classification preserves it, and IPC surfaces category `database` with “database failure”. Require predecessor timeout/cancellation classification to survive this boundary, with a failure witness. O1’s explicit Cancellation/Conflict requirement covers capacity exhaustion only. (confidence: 90)"
      }
    ],
    "lens": "error-handling",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-error-handling-r2.prompt",
    "report": "lens-error-handling-r2.txt",
    "round": 2,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-error-handling-r3.jsonl",
    "findings": [],
    "lens": "error-handling",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-error-handling-r3.prompt",
    "report": "lens-error-handling-r3.txt",
    "round": 3,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-error-handling-r4.jsonl",
    "findings": [],
    "lens": "error-handling",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-error-handling-r4.prompt",
    "report": "lens-error-handling-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-ipc-contract-r1.jsonl",
    "findings": [],
    "lens": "ipc-contract",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-ipc-contract-r1.prompt",
    "report": "lens-ipc-contract-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-minimalism-r1.jsonl",
    "findings": [],
    "lens": "minimalism",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-minimalism-r1.prompt",
    "report": "lens-minimalism-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-minimalism-r2.jsonl",
    "findings": [],
    "lens": "minimalism",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-minimalism-r2.prompt",
    "report": "lens-minimalism-r2.txt",
    "round": 2,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-persisted-state-r1.jsonl",
    "findings": [],
    "lens": "persisted-state",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-persisted-state-r1.prompt",
    "report": "lens-persisted-state-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-pgn-index-r1.jsonl",
    "findings": [],
    "lens": "pgn-index",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-pgn-index-r1.prompt",
    "report": "lens-pgn-index-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-plan-r1.jsonl",
    "findings": [
      {
        "kind": "blocker",
        "text": "tasks/plans/2026-10-09-lru-sqlite-retirement.md:52 — O2 omits connection acquisition from an already cached replacement pool. Lock-only callers can cache a pool without opening SQLite (`src-tauri/src/db/repository.rs:753`, `:986`). Different identities at the same path have different keys (`:372`), so that replacement can remain cached when the old entry is later LRU-evicted. A subsequent acquisition returns the cached entry (`:950`) and calls `get_connection` (`:1175`), which can establish SQLite (`:263`) without passing through pool construction. The proposed boundaries therefore leave the same-path successor-open guarantee at plan line 56 unenforced. Cover cached acquisitions and require a lifecycle witness where the replacement is cached before predecessor eviction. (confidence: 90)"
      }
    ],
    "lens": "plan",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-plan-r1.prompt",
    "report": "lens-plan-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "REVISE"
  },
  {
    "artefact": "lens-plan-r2.jsonl",
    "findings": [
      {
        "kind": "blocker",
        "text": "tasks/plans/2026-10-09-lru-sqlite-retirement.md:58 — I2’s witnesses delay a successor worker and hold an established predecessor handle. Neither exercises a predecessor worker paused after ticket admission but before establishment (`src-tauri/src/db/repository.rs:257–263`). If retirement publishes that worker’s gate before it resumes, a barrier that waits on its own ticket stalls until timeout (`src-tauri/src/db/repository.rs:197`). Require a synchronized witness proving this worker completes or safely refuses establishment without waiting for its own ticket. The currently specified witnesses would not reject that implementation. (confidence: 90)"
      },
      {
        "kind": "should-fix",
        "text": "tasks/plans/2026-10-09-lru-sqlite-retirement.md:114 — The I1 and I2 adoption rows lack the required `Authority` entries. Classify the directory-wide matching and manager-establishment fencing as necessary correctness work against MANDATE, citing the spelling preservation and asynchronous establishment paths (`src-tauri/src/infra/path_authority/mod.rs:2078`, `src-tauri/src/db/repository.rs:256`). (confidence: 100)"
      }
    ],
    "lens": "plan",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-plan-r2.prompt",
    "report": "lens-plan-r2.txt",
    "round": 2,
    "terminal": "completed",
    "verdict": "REVISE"
  },
  {
    "artefact": "lens-plan-r3.jsonl",
    "findings": [
      {
        "kind": "blocker",
        "text": "I3 NOT CLOSED — PLAN `tasks/plans/.plan-2026-10-09-lru-sqlite-retirement.md-r3.body.md:58` forbids a second pool timeout, but its verification at `:72` asserts categories and retry independence without bounded completion. An implementation could retain `pool.get()` (`src-tauri/src/db/repository.rs:1661`), spend its additional configured timeout (`:74`), then return typed `Conflict` or `Cancellation` and satisfy those assertions. Require a synchronized completion bound that fails when acquisition adds another timeout or delays cancellation. (confidence: 90)"
      }
    ],
    "lens": "plan",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-plan-r3.prompt",
    "report": "lens-plan-r3.txt",
    "round": 3,
    "terminal": "completed",
    "verdict": "REVISE"
  },
  {
    "artefact": "lens-plan-r4.jsonl",
    "findings": [],
    "lens": "plan",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-plan-r4.prompt",
    "report": "lens-plan-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-platform-semantics-r1.jsonl",
    "findings": [
      {
        "kind": "should-fix",
        "text": "tasks/plans/2026-10-09-lru-sqlite-retirement.md:52 — On case-insensitive Windows filesystems, replacing `GameCase.db3` and authorizing its successor as `gamecase.db3` changes the object identity while preserving unequal canonical path spellings. `canonical_binding` preserves leaf casing (`src-tauri/src/infra/path_authority/mod.rs:2073`), so the proposed matching rule can miss the draining predecessor. Require filesystem-compatible name equivalence and a replacement witness using different casing at reopen, revision-read and deletion boundaries. (confidence: 94)"
      }
    ],
    "lens": "platform-semantics",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-platform-semantics-r1.prompt",
    "report": "lens-platform-semantics-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "REVISE"
  },
  {
    "artefact": "lens-platform-semantics-r2.jsonl",
    "findings": [],
    "lens": "platform-semantics",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-platform-semantics-r2.prompt",
    "report": "lens-platform-semantics-r2.txt",
    "round": 2,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-tauri-security-r1.jsonl",
    "findings": [],
    "lens": "tauri-security",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tauri-security-r1.prompt",
    "report": "lens-tauri-security-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-tests-r1.jsonl",
    "findings": [],
    "lens": "tests",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tests-r1.prompt",
    "report": "lens-tests-r1.txt",
    "round": 1,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-tests-r2.jsonl",
    "findings": [],
    "lens": "tests",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tests-r2.prompt",
    "report": "lens-tests-r2.txt",
    "round": 2,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-tests-r3.jsonl",
    "findings": [
      {
        "kind": "should-fix",
        "text": "tasks/plans/.plan-2026-10-09-lru-sqlite-retirement.md-r3.body.md:72 — The new prohibition on a second pool timeout has no corresponding duration assertion. Cached acquisition could exhaust the predecessor deadline, wait another pool timeout, then return correctly typed Conflict and pass every stated outcome/retry assertion. Require a synchronized deadline-bound assertion that fails when acquisition starts a second timeout budget. (confidence: 95)"
      }
    ],
    "lens": "tests",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tests-r3.prompt",
    "report": "lens-tests-r3.txt",
    "round": 3,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-tests-r4.jsonl",
    "findings": [],
    "lens": "tests",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tests-r4.prompt",
    "report": "lens-tests-r4.txt",
    "round": 4,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-chess-semantics-r5.jsonl",
    "findings": [],
    "lens": "chess-semantics",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-chess-semantics-r5.prompt",
    "report": "lens-chess-semantics-r5.txt",
    "round": 5,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-correctness-r5.jsonl",
    "findings": [],
    "lens": "correctness",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-correctness-r5.prompt",
    "report": "lens-correctness-r5.txt",
    "round": 5,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-engine-protocol-r5.jsonl",
    "findings": [],
    "lens": "engine-protocol",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-engine-protocol-r5.prompt",
    "report": "lens-engine-protocol-r5.txt",
    "round": 5,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-error-handling-r5.jsonl",
    "findings": [],
    "lens": "error-handling",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-error-handling-r5.prompt",
    "report": "lens-error-handling-r5.txt",
    "round": 5,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-ipc-contract-r5.jsonl",
    "findings": [],
    "lens": "ipc-contract",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-ipc-contract-r5.prompt",
    "report": "lens-ipc-contract-r5.txt",
    "round": 5,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-minimalism-r5.jsonl",
    "findings": [],
    "lens": "minimalism",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-minimalism-r5.prompt",
    "report": "lens-minimalism-r5.txt",
    "round": 5,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-minimalism-r6.jsonl",
    "findings": [],
    "lens": "minimalism",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-minimalism-r6.prompt",
    "report": "lens-minimalism-r6.txt",
    "round": 6,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-persisted-state-r5.jsonl",
    "findings": [],
    "lens": "persisted-state",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-persisted-state-r5.prompt",
    "report": "lens-persisted-state-r5.txt",
    "round": 5,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-pgn-index-r5.jsonl",
    "findings": [],
    "lens": "pgn-index",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-pgn-index-r5.prompt",
    "report": "lens-pgn-index-r5.txt",
    "round": 5,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-plan-r5.jsonl",
    "findings": [],
    "lens": "plan",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-plan-r5.prompt",
    "report": "lens-plan-r5.txt",
    "round": 5,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-plan-r6.jsonl",
    "findings": [],
    "lens": "plan",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-plan-r6.prompt",
    "report": "lens-plan-r6.txt",
    "round": 6,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-platform-semantics-r5.jsonl",
    "findings": [
      {
        "kind": "should-fix",
        "text": "scripts/verify-app.mjs:509 — The drift adds a direct `.ts` import to the plain Node verifier. On Linux with supported Node 20.19 (`package.json:174`), loading fails with `ERR_UNKNOWN_FILE_EXTENSION` before app startup. This invalidates the plan’s required `pnpm verify:app` integration proof on that supported runtime. Recorded Node 24 success does not cover Node 20 (confidence: 98)."
      }
    ],
    "lens": "platform-semantics",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-platform-semantics-r5.prompt",
    "report": "lens-platform-semantics-r5.txt",
    "round": 5,
    "terminal": "completed",
    "verdict": "REVISE"
  },
  {
    "artefact": "lens-platform-semantics-r6.jsonl",
    "findings": [],
    "lens": "platform-semantics",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-platform-semantics-r6.prompt",
    "report": "lens-platform-semantics-r6.txt",
    "round": 6,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-tauri-security-r5.jsonl",
    "findings": [],
    "lens": "tauri-security",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tauri-security-r5.prompt",
    "report": "lens-tauri-security-r5.txt",
    "round": 5,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-tests-r5.jsonl",
    "findings": [],
    "lens": "tests",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tests-r5.prompt",
    "report": "lens-tests-r5.txt",
    "round": 5,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-tests-r6.jsonl",
    "findings": [],
    "lens": "tests",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tests-r6.prompt",
    "report": "lens-tests-r6.txt",
    "round": 6,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-chess-semantics-r7.jsonl",
    "findings": [],
    "lens": "chess-semantics",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-chess-semantics-r7.prompt",
    "report": "lens-chess-semantics-r7.txt",
    "round": 7,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-correctness-r7.jsonl",
    "findings": [],
    "lens": "correctness",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-correctness-r7.prompt",
    "report": "lens-correctness-r7.txt",
    "round": 7,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-correctness-r8.jsonl",
    "findings": [],
    "lens": "correctness",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-correctness-r8.prompt",
    "report": "lens-correctness-r8.txt",
    "round": 8,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-engine-protocol-r7.jsonl",
    "findings": [],
    "lens": "engine-protocol",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-engine-protocol-r7.prompt",
    "report": "lens-engine-protocol-r7.txt",
    "round": 7,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-error-handling-r7.jsonl",
    "findings": [],
    "lens": "error-handling",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-error-handling-r7.prompt",
    "report": "lens-error-handling-r7.txt",
    "round": 7,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-error-handling-r8.jsonl",
    "findings": [],
    "lens": "error-handling",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-error-handling-r8.prompt",
    "report": "lens-error-handling-r8.txt",
    "round": 8,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-ipc-contract-r7.jsonl",
    "findings": [],
    "lens": "ipc-contract",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-ipc-contract-r7.prompt",
    "report": "lens-ipc-contract-r7.txt",
    "round": 7,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-minimalism-r7.jsonl",
    "findings": [],
    "lens": "minimalism",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-minimalism-r7.prompt",
    "report": "lens-minimalism-r7.txt",
    "round": 7,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-persisted-state-r7.jsonl",
    "findings": [],
    "lens": "persisted-state",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-persisted-state-r7.prompt",
    "report": "lens-persisted-state-r7.txt",
    "round": 7,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-pgn-index-r7.jsonl",
    "findings": [],
    "lens": "pgn-index",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-pgn-index-r7.prompt",
    "report": "lens-pgn-index-r7.txt",
    "round": 7,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-plan-r7.jsonl",
    "findings": [
      {
        "kind": "blocker",
        "text": "tasks/plans/.plan-2026-10-09-lru-sqlite-retirement.md-r7.body.md:44 — O1’s completion condition misses a predecessor binding retained without a connection ticket. Changed premise: `BoundDatabase::acquire` now refuses same-parent aliases while any binding holder survives (`src-tauri/src/db/bound_sqlite.rs:217`). An r2d2 worker upgrades the pool before calling `connect` (`r2d2-0.8.10/src/lib.rs:236`), retaining `BoundConnectionManager.database` before ticket admission (`src-tauri/src/db/repository.rs:247`, `:257`). If paused there across eviction, the evictor can finish disposal and the connection count reach zero while the binding remains alive. O2’s alias reopen and O3’s successful retry (`PLAN:60`, `:66`) can then return immediate admission `Conflict`. The planned admitted-worker witness at `PLAN:62` does not exercise this interval. Require retirement completion to account for predecessor-owned binding holders and a synchronized witness proving alias reopen waits and succeeds after that worker releases ownership. (confidence: 90)"
      },
      {
        "kind": "should-fix",
        "text": "tasks/plans/.plan-2026-10-09-lru-sqlite-retirement.md-r7.body.md:94 — Risks still describes f-20260929-05 as a separate unresolved hard-link hazard. Changed premise: the new admission predicate prevents concurrent distinct same-parent bindings (`src-tauri/src/db/bound_sqlite.rs:217`), and the drift marks that finding handled (`tasks/findings.md:12452`). Update the current risk statement to preserve d-20261011-01’s refusal policy and distinguish the separately filed rename-retention defect, f-20261011-01. Leave the historical trace intact. (confidence: 100)"
      },
      {
        "kind": "should-fix",
        "text": "tasks/plans/2026-10-09-lru-sqlite-retirement.md:120 — The history establishes earlier rounds, but this r7 packet omits the required process-generated `ROUND`, `DELTA`, `REVISED`, `SETTLED` block. The supplied source drift does not replace that input under `/home/felixb/.claude/references/review-lens-contract.md:246`, `:262`. Supply the block or explicitly resolve the refresh-specific contract exception. (confidence: 100)"
      }
    ],
    "lens": "plan",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-plan-r7.prompt",
    "report": "lens-plan-r7.txt",
    "round": 7,
    "terminal": "completed",
    "verdict": "REVISE"
  },
  {
    "artefact": "lens-plan-r8.jsonl",
    "findings": [],
    "lens": "plan",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-plan-r8.prompt",
    "report": "lens-plan-r8.txt",
    "round": 8,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-platform-semantics-r7.jsonl",
    "findings": [],
    "lens": "platform-semantics",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-platform-semantics-r7.prompt",
    "report": "lens-platform-semantics-r7.txt",
    "round": 7,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-platform-semantics-r8.jsonl",
    "findings": [],
    "lens": "platform-semantics",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-platform-semantics-r8.prompt",
    "report": "lens-platform-semantics-r8.txt",
    "round": 8,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-tauri-security-r7.jsonl",
    "findings": [],
    "lens": "tauri-security",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tauri-security-r7.prompt",
    "report": "lens-tauri-security-r7.txt",
    "round": 7,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-tests-r7.jsonl",
    "findings": [],
    "lens": "tests",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tests-r7.prompt",
    "report": "lens-tests-r7.txt",
    "round": 7,
    "terminal": "completed",
    "verdict": "APPROVED"
  },
  {
    "artefact": "lens-tests-r8.jsonl",
    "findings": [],
    "lens": "tests",
    "profile_clean": null,
    "profile_detail": "",
    "prompt": "lens-tests-r8.prompt",
    "report": "lens-tests-r8.txt",
    "round": 8,
    "terminal": "completed",
    "verdict": "APPROVED"
  }
]

### Issues

[
  {
    "claim": "Canonical path spelling can miss a same-file replacement on a case-insensitive filesystem.",
    "closed_round": 2,
    "correction": "O1/O2 retain and match object OR retained parent identity, explicitly requiring spelling-alias witnesses and conservative same-parent backpressure.",
    "dependencies": [],
    "disposition": "Fix",
    "id": "I1",
    "witnesses": [
      {
        "index": 1,
        "lens": "platform-semantics",
        "round": 1
      }
    ]
  },
  {
    "claim": "Cached replacement pools bypass construction fencing, and predecessor-worker self-ticket handling needs an executable witness.",
    "closed_round": 3,
    "correction": "O2 fences cached acquisition and actual manager establishment, prevents predecessor self-wait and requires synchronized cached-successor, delayed-successor and admitted-predecessor worker lifecycle witnesses.",
    "dependencies": [],
    "disposition": "Fix",
    "id": "I2",
    "witnesses": [
      {
        "index": 1,
        "lens": "plan",
        "round": 1
      },
      {
        "index": 1,
        "lens": "plan",
        "round": 2
      }
    ]
  },
  {
    "claim": "A new worker predecessor barrier failure can lose Conflict/Cancellation classification or add another timeout through r2d2 transport, without the initial proof rejecting either defect.",
    "closed_round": 4,
    "correction": "O2/O3 preserve typed operation-scoped Conflict/Cancellation with one deadline, no string parsing or cross-caller poisoning. Actual cached/worker failure and retry witnesses also assert synchronized bounded completion below an additional pool timeout, measured from a pre-spawn origin.",
    "dependencies": [
      "I2"
    ],
    "disposition": "Fix",
    "id": "I3",
    "lineage": "I2",
    "witnesses": [
      {
        "index": 1,
        "lens": "error-handling",
        "round": 2
      },
      {
        "index": 1,
        "lens": "plan",
        "round": 3
      },
      {
        "index": 1,
        "lens": "tests",
        "round": 3
      }
    ]
  },
  {
    "claim": "The r1 I1/I2 adoption rows omit explicit frozen-mandate Authority fields.",
    "closed_round": 3,
    "correction": "Additive r2 Authority supplement cites the unchanged MANDATE/threat model and opened source confirming spelling and asynchronous-establishment gaps.",
    "dependencies": [
      "I1",
      "I2"
    ],
    "disposition": "Fix",
    "id": "I4",
    "witnesses": [
      {
        "index": 2,
        "lens": "plan",
        "round": 2
      }
    ]
  },
  {
    "claim": "The changed native TypeScript codec import requires an explicit verifier runtime prerequisite for the existing integration proof.",
    "closed_round": 6,
    "correction": "Require the existing Node 24 execution route chosen by d-20261009-14, validate node version and actual native codec import/round-trip after installation, then run the unchanged full real-app proof. Missing readiness never waives verification.",
    "dependencies": [],
    "disposition": "Fix",
    "id": "I5",
    "witnesses": [
      {
        "index": 1,
        "lens": "platform-semantics",
        "round": 5
      }
    ]
  },
  {
    "claim": "After the drift's same-parent binding admission (d-20261011-01), an r2d2 worker that upgraded the predecessor pool but was not yet admitted a connection ticket keeps the manager's BoundDatabase alive after the ticket drain reaches zero, so an alias successor that passed the barrier is refused with an immediate Conflict instead of waiting and succeeding.",
    "closed_round": 8,
    "correction": "O1 completion also requires that no other holder of the predecessor's pool or connection manager survives, including an upgraded-but-unadmitted r2d2 worker, so a completed record means predecessor teardown no longer holds the binding; holders outside teardown keep d-20261011-01's refusal. O2 adds a synchronized witness: worker paused after upgrade and before ticket admission, real LRU retirement, same-parent hard-link alias reopen waits, never returns the alias conflict, and opens after the worker is refused and releases the pool; ticket-only completion must fail it.",
    "dependencies": [
      "I2",
      "I3"
    ],
    "disposition": "Fix",
    "id": "I6",
    "witnesses": [
      {
        "index": 1,
        "lens": "plan",
        "round": 7
      }
    ]
  },
  {
    "claim": "Risks still described f-20260929-05 as a separate unresolved hard-link hazard after the drift handled it through d-20261011-01.",
    "closed_round": 8,
    "correction": "Risks names d-20261011-01 as preserved policy, keeps f-20261001-02 separate and names f-20261011-01 as outside the mandate; Decisions and trade-offs adds d-20261011-01 to the preserved decisions.",
    "dependencies": [],
    "disposition": "Fix",
    "id": "I7",
    "witnesses": [
      {
        "index": 2,
        "lens": "plan",
        "round": 7
      }
    ]
  },
  {
    "claim": "The r7 drift-round packet lacked the generated ROUND/DELTA/REVISED/SETTLED block.",
    "dependencies": [],
    "disposition": "Skip",
    "id": "S1",
    "reason": "plan-review-delta.py on plan-r6.md versus the r7 plan printed UNCHANGED and exited 3 (plan body byte-identical); build section 4 forbids fabricating a revision round on exit 3, and the plan-refresh contract makes the process-generated drift diff the drift round's correction evidence. The r8 closure round carried the generated block.",
    "witnesses": [
      {
        "index": 3,
        "lens": "plan",
        "round": 7
      }
    ]
  }
]

### delta-r2-stdout.txt

ROUND: 2
DELTA: /home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-1/wt/tasks/plans/.plan-delta-2026-10-09-lru-sqlite-retirement.md-r2.diff
REVISED:
## Approach > ### O1 — publish and bound predecessor ownership
## Approach > ### O2 — enforce the predecessor barrier at reopen and deletion
## Decided autonomously
SETTLED:
# Plan: retain and drain LRU-evicted SQLite connections
## Goal
## MANDATE
## MANDATE > ### LRU eviction drops a database entry without draining its SQLite connections, so one can close after a later delete of the same file
## Threat model and non-goals
## Traced premises
## Approach
## Approach > ### O3 — retain barriers after incomplete drains
## Decisions and trade-offs
## Risks / open questions
## Not part of this task
## Phases
## Carried to diff review

### delta-r3-stdout.txt

ROUND: 3
DELTA: /home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-1/wt/tasks/plans/.plan-delta-2026-10-09-lru-sqlite-retirement.md-r3.diff
REVISED:
## Approach > ### O2 — enforce the predecessor barrier at reopen and deletion
## Approach > ### O3 — retain barriers after incomplete drains
SETTLED:
# Plan: retain and drain LRU-evicted SQLite connections
## Goal
## MANDATE
## MANDATE > ### LRU eviction drops a database entry without draining its SQLite connections, so one can close after a later delete of the same file
## Threat model and non-goals
## Traced premises
## Approach
## Approach > ### O1 — publish and bound predecessor ownership
## Decisions and trade-offs
## Decided autonomously
## Risks / open questions
## Not part of this task
## Phases
## Carried to diff review

### delta-r4-stdout.txt

ROUND: 4
DELTA: /home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-1/wt/tasks/plans/.plan-delta-2026-10-09-lru-sqlite-retirement.md-r4.diff
REVISED:
## Approach > ### O3 — retain barriers after incomplete drains
SETTLED:
# Plan: retain and drain LRU-evicted SQLite connections
## Goal
## MANDATE
## MANDATE > ### LRU eviction drops a database entry without draining its SQLite connections, so one can close after a later delete of the same file
## Threat model and non-goals
## Traced premises
## Approach
## Approach > ### O1 — publish and bound predecessor ownership
## Approach > ### O2 — enforce the predecessor barrier at reopen and deletion
## Decisions and trade-offs
## Decided autonomously
## Risks / open questions
## Not part of this task
## Phases
## Carried to diff review

### delta-r6-stdout.txt

ROUND: 6
DELTA: /home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-1/wt/tasks/plans/.plan-delta-2026-10-09-lru-sqlite-retirement.md-r6.diff
REVISED:
## Decided autonomously
## Risks / open questions
SETTLED:
# Plan: retain and drain LRU-evicted SQLite connections
## Goal
## MANDATE
## MANDATE > ### LRU eviction drops a database entry without draining its SQLite connections, so one can close after a later delete of the same file
## Threat model and non-goals
## Traced premises
## Approach
## Approach > ### O1 — publish and bound predecessor ownership
## Approach > ### O2 — enforce the predecessor barrier at reopen and deletion
## Approach > ### O3 — retain barriers after incomplete drains
## Decisions and trade-offs
## Not part of this task
## Phases
## Carried to diff review

### delta-r8-stdout.txt

ROUND: 8
DELTA: /home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-2/wt/tasks/plans/.plan-delta-2026-10-09-lru-sqlite-retirement.md-r8.diff
REVISED:
## Approach > ### O1 — publish and bound predecessor ownership
## Approach > ### O2 — enforce the predecessor barrier at reopen and deletion
## Decisions and trade-offs
## Risks / open questions
SETTLED:
# Plan: retain and drain LRU-evicted SQLite connections
## Goal
## MANDATE
## MANDATE > ### LRU eviction drops a database entry without draining its SQLite connections, so one can close after a later delete of the same file
## Threat model and non-goals
## Traced premises
## Approach
## Approach > ### O3 — retain barriers after incomplete drains
## Decided autonomously
## Not part of this task
## Phases
## Carried to diff review

### lens-chess-semantics-r1.txt

NOT APPLICABLE: The assigned repository file and O1–O3 obligations concern SQLite connection retirement and drain ownership. They do not involve in-memory chess trees, positions, or move paths.
VERDICT: APPROVED
### lens-chess-semantics-r5.txt

No chess-semantics drift invalidation found. The tree schema refactor preserves FENs, metadata, child ordering and stored-path repair. The verifier’s new workspace fixture preserves the existing startup, IPC and shutdown checks required by the plan.

Limitation: runtime proofs were not rerun in this read-only review.

VERDICT: APPROVED
### lens-chess-semantics-r7.txt

No chess-semantics drift invalidation found. Reviewed tree replacement, PGN parsing, move legality, path handling and the expanded real-app verifier against the Phases integration proof. No changed premise invalidates O1–O3 within this lens.

Limitation: read-only source review. Runtime proofs remain the adopter’s responsibility.

VERDICT: APPROVED
### lens-correctness-r1.txt

No correctness defects found in O1–O3’s stated contracts.

Limitation: this is plan-only review. Reservation rechecks, capacity handling and teardown ordering require verification against the implementation (confidence: 100).

VERDICT: APPROVED
### lens-correctness-r2.txt

CLOSED: I1 — O1/O2 match object OR retained parent identity, covering replacement spelling aliases with explicit same-parent blocking.

CLOSED: I2 — O2 fences cached acquisition and actual replenishment establishment, including self-ticket safety and reservation rechecks.

No correctness defects found in the revised contracts.

Limitation: plan-only review. Atomic publication, worker admission ordering, bounded capacity and timeout recovery remain implementation proof obligations (confidence: 100).

VERDICT: APPROVED
### lens-correctness-r3.txt

I2 CLOSED — O2:54,62 requires cached and worker establishment fencing, plus a synchronized admitted-predecessor witness proving ticket release without self-wait or deadline expiry.

I3 CLOSED — O2:58 and O3:72 require operation-scoped Conflict/Cancellation through r2d2 transport, one shared deadline, and independent healthy callers and retries.

Limitation: plan-only review. Publication ordering, typed-result transport and actual lifecycle/revert assertions remain unverified until implementation (confidence: 100).

VERDICT: APPROVED
### lens-correctness-r5.txt

No correctness drift invalidation found. The workspace reload checks preserve the plan’s startup, IPC and shutdown proof.

Named limitation: the new direct `.ts` import in `scripts/verify-app.mjs:508` was not exercised on older Node versions allowed by `package.json`. Runtime compatibility remains unverified under this review’s no-test constraint (confidence: 100).

VERDICT: APPROVED
### lens-correctness-r7.txt

No correctness drift invalidation found. The new same-inode admission refusal remains compatible with O1’s disposal ordering and O2–O3’s predecessor barriers. Different-inode cached replacements remain reachable.

Limitation: runtime and platform proofs were not executed in this read-only review. Static contract assessment confidence: 90.

VERDICT: APPROVED
### lens-correctness-r8.txt

No correctness drift invalidation found. O1 now requires predecessor pool and manager holders to release their binding before completion. O2’s added witness covers the upgraded-but-unadmitted worker interval. External entry holders retain the existing alias refusal.

Limitation: static contract review only. Implementation and runtime witnesses remain adoption requirements (confidence: 90).

VERDICT: APPROVED
### lens-engine-protocol-r1.txt

NOT APPLICABLE: The sole file and O1–O3 obligations concern SQLite connection retirement, reopen, and deletion barriers. They do not involve engine process supervision, UCI protocol state, or asynchronous engine result routing.
VERDICT: APPROVED
### lens-engine-protocol-r5.txt

No drift invalidation within this lens. Workspace initialization changes preserve tab identities without changing engine process keys or result routing. The added `scripts/verify-app.mjs` reload checks retain the existing startup/IPC/shutdown proof required by the plan.

Limitation: read-only source review. No runtime proofs rerun.

VERDICT: APPROVED
### lens-engine-protocol-r7.txt

No drift invalidation found within the UCI lens. The board/tab changes, shared progress changes and expanded verifier do not invalidate O1–O3 or the Phases integration proof through engine supervision, protocol ordering or result routing.

Limitation: read-only source review. No runtime verification performed.

VERDICT: APPROVED
### lens-error-handling-r1.txt

VERDICT: APPROVED
### lens-error-handling-r2.txt

NOT MY CLASS: I1 — filesystem matching closure belongs to platform-semantics.
NOT MY CLASS: I2 — establishment-boundary closure belongs to plan.

[should-fix] tasks/plans/.plan-2026-10-09-lru-sqlite-retirement.md-r2.body.md:54 — O2 adds connection-manager barrier failures without specifying their typed caller outcome. When a delayed worker times out behind a predecessor while the target remains valid, r2d2 stringifies and retries its error. The existing `get_connection` path returns `Error::R2d2`, classification preserves it, and IPC surfaces category `database` with “database failure”. Require predecessor timeout/cancellation classification to survive this boundary, with a failure witness. O1’s explicit Cancellation/Conflict requirement covers capacity exhaustion only. (confidence: 90)

VERDICT: APPROVED
### lens-error-handling-r3.txt

I3 CLOSED — PLAN:57 requires operation-scoped Conflict/Cancellation through r2d2 transport, one shared deadline, and caller independence. PLAN:72 requires authority-valid cached-worker witnesses asserting Rust variants and IPC categories, retry success, and failure when generic pool errors replace typed results. Implementation proof remains pending.

VERDICT: APPROVED
### lens-error-handling-r4.txt

I3 CLOSED — PLAN:58,72,74 requires typed, operation-scoped Conflict/Cancellation and synchronized completion bounds below the additional pool timeout, with predecessors held through outcome assertions. Witnesses must reject refreshed budgets and delayed cancellation while preserving healthy-caller and retry independence. Implementation and measured revert failures remain pending.

VERDICT: APPROVED
### lens-error-handling-r5.txt

No drift invalidation found. The changed reload verifier uses bounded polling, records failures with assertion context, and exits 1 on check or cleanup failure. The plan’s startup/IPC/shutdown integration proof remains applicable. O1–O3’s failure contracts are unchanged.

Limitation: runtime behavior was not rerun in this read-only review (confidence: 95 in the traced failure routing).

VERDICT: APPROVED
### lens-error-handling-r7.txt

No error-handling drift invalidation found.

The new `BoundDatabase::acquire` alias refusal propagates typed `Error::Conflict` before SQLite opens. O1’s disposal requirement and O2’s barriers before pooled and transient establishment remain compatible with it. O3 still requires retained barriers, independent cancellation, typed outcomes and bounded retries.

The expanded `verify-app.mjs` records caught assertion failures and exits nonzero. Its catches do not turn failed integration checks into passing proof.

Limitation: implementation witnesses and native/platform proofs were not executed in this read-only review. Their results remain adoption requirements (confidence: 100).

VERDICT: APPROVED
### lens-error-handling-r8.txt

No error-handling defect introduced by the r8 delta found. Corrected O1/O2 require retaining the barrier until upgraded-but-unadmitted workers release predecessor ownership. O2/O3 preserve fail-closed behavior, typed Conflict/Cancellation outcomes, one absolute deadline, and independent retries.

Limitation: source-only plan review. Implementation, bounded-completion witnesses and platform proofs remain adoption requirements (confidence: 95).

VERDICT: APPROVED
### lens-ipc-contract-r1.txt

NOT APPLICABLE: O1–O3 cover internal SQLite retirement ownership and drain barriers in `src-tauri/src/db/repository.rs`. The plan changes no Rust↔renderer event, command, payload, subscription, capability scope, or shutdown contract.

VERDICT: APPROVED
### lens-ipc-contract-r5.txt

No IPC drift invalidation found. The changes to `src/index.tsx` and `scripts/verify-app.mjs` preserve the registered `release_previous_document_operations` and `prepare_native_read` contracts, including exact-ticket checks for reload cancellation and window destruction. The added workspace assertions retain the plan’s startup, IPC and shutdown integration proof.

No event, command signature, generated binding or capability scope changed.

Limitation: runtime proof was not rerun in this read-only review. The adopting executor must run the plan’s prescribed integration command.

VERDICT: APPROVED
### lens-ipc-contract-r7.txt

No IPC drift invalidation found. Changed progress paths retain registered `ProgressEvent`, matching ids, generations and percentage units. New verifier calls match registered commands and generated invoke keys. Capability scopes and bindings are unchanged.

O1–O3 and the integration-proof obligation remain intact within this lens. Static review only, with no runtime proof performed.

VERDICT: APPROVED
### lens-minimalism-r1.txt

VERDICT: APPROVED
### lens-minimalism-r2.txt

NOT MY CLASS: I1 — platform-semantics owns alias-matching closure.
NOT MY CLASS: I2 — review-plan owns cached-acquisition and worker-establishment closure.

No bloat or duplication findings. The revised boundaries address concrete retirement bypasses. Shared ownership and matching have multiple required callers, and parent-identity matching avoids introducing filesystem-specific name equivalence machinery.

Limitation: implementation size and helper duplication remain unassessable until a source diff exists (confidence: 100).

VERDICT: APPROVED
### lens-minimalism-r5.txt

No drift invalidation found in this lens. `scripts/verify-app.mjs` reuses the existing reload sequence and storage serializer without requiring another verifier or expanding the retirement implementation. O1–O3 and the existing startup/IPC/shutdown proof remain applicable.

Limitation: runtime status remains unmeasured in this read-only review.

VERDICT: APPROVED
### lens-minimalism-r6.txt

I5 CLOSED — r6 requires the existing Node 24 runtime, version readiness, and native codec import/compressed round-trip after installation before the unchanged full-app proof. It preserves d-20261009-14 without expanding source scope.

No minimalism drift invalidation found. The verifier shares the production codec, and the delta adds necessary proof prerequisites without another serializer, helper, or configuration surface.

VERDICT: APPROVED
### lens-minimalism-r7.txt

No bloat or duplication in the inspected drift invalidates O1–O3 or the Phases proof obligations. Binding admission refusal does not replace predecessor drain ordering. The plan still requires one shared retirement contract and reuses the existing verifier and production codec without expanding the mandate.

VERDICT: APPROVED
### lens-persisted-state-r1.txt

NOT APPLICABLE: The assigned file is a Rust database repository. O1–O3 concern SQLite connection retirement and drain barriers, with no renderer storage keys, persisted atoms, hydration, or tab lifecycle changes.
VERDICT: APPROVED
### lens-persisted-state-r5.txt

No drift invalidation found. Workspace and tree writers/readers retain matching encoding, and unload flushing remains intact. The added reload assertions preserve the plan’s real startup/IPC/shutdown integration proof.

Limitation: read-only source review. No runtime tests rerun.

VERDICT: APPROVED
### lens-persisted-state-r7.txt

No drift invalidation found within this lens. The changed workspace and tree writers/readers use the same compressed codec and physical `treeKey`. Creation, replacement, hydration, duplication, close cleanup and verifier snapshots consistently resolve that key. The unload flush remains intact.

These changes do not invalidate O1–O3 or the Phases integration proof. Runtime readiness and `pnpm build && pnpm verify:app` remain adoption obligations, unverified by this read-only review.

VERDICT: APPROVED
### lens-pgn-index-r1.txt

NOT APPLICABLE: O1–O3 in `src-tauri/src/db/repository.rs` concern SQLite connection retirement and reopen/delete barriers. They do not change PGN byte scanning, offsets, move encoding, stored indexes, or search predicates.

VERDICT: APPROVED
### lens-pgn-index-r5.txt

No drift invalidation. PGN scanning, indexing, database encoding, and repository source are unchanged. The verifier additions use the canonical serializer for workspace seeding and preserve existing PGN checks and the planned startup/IPC/shutdown proof.

Limitation: runtime proof was not rerun during this read-only review.

VERDICT: APPROVED
### lens-pgn-index-r7.txt

No drift invalidation found within this lens. Import, decode and search share FEN reconstruction and detected castling mode. The archived index format remains unchanged.

The new alias refusal remains compatible with O1–O3’s required binding release and predecessor drain before successor opens, including revision reads. Runtime proof remains the adopter’s obligation. This review was read-only.

VERDICT: APPROVED
### lens-plan-r1.txt

[blocker] tasks/plans/2026-10-09-lru-sqlite-retirement.md:52 — O2 omits connection acquisition from an already cached replacement pool. Lock-only callers can cache a pool without opening SQLite (`src-tauri/src/db/repository.rs:753`, `:986`). Different identities at the same path have different keys (`:372`), so that replacement can remain cached when the old entry is later LRU-evicted. A subsequent acquisition returns the cached entry (`:950`) and calls `get_connection` (`:1175`), which can establish SQLite (`:263`) without passing through pool construction. The proposed boundaries therefore leave the same-path successor-open guarantee at plan line 56 unenforced. Cover cached acquisitions and require a lifecycle witness where the replacement is cached before predecessor eviction. (confidence: 90)

VERDICT: REVISE
### lens-plan-r2.txt

CLOSED: I1 — Candidate O2 matches retained parent identity (`tasks/plans/2026-10-09-lru-sqlite-retirement.md:52`, `src-tauri/src/db/repository.rs:1286`), covering spelling differences preserved by `src-tauri/src/infra/path_authority/mod.rs:2078`.

STILL OPEN: I2 — The corrected boundaries include cached acquisition and manager establishment, but verification omits the added predecessor-worker self-ticket exception.

[blocker] tasks/plans/2026-10-09-lru-sqlite-retirement.md:58 — I2’s witnesses delay a successor worker and hold an established predecessor handle. Neither exercises a predecessor worker paused after ticket admission but before establishment (`src-tauri/src/db/repository.rs:257–263`). If retirement publishes that worker’s gate before it resumes, a barrier that waits on its own ticket stalls until timeout (`src-tauri/src/db/repository.rs:197`). Require a synchronized witness proving this worker completes or safely refuses establishment without waiting for its own ticket. The currently specified witnesses would not reject that implementation. (confidence: 90)

[should-fix] tasks/plans/2026-10-09-lru-sqlite-retirement.md:114 — The I1 and I2 adoption rows lack the required `Authority` entries. Classify the directory-wide matching and manager-establishment fencing as necessary correctness work against MANDATE, citing the spelling preservation and asynchronous establishment paths (`src-tauri/src/infra/path_authority/mod.rs:2078`, `src-tauri/src/db/repository.rs:256`). (confidence: 100)

Limitation: Source-only review. Implementation, runtime behavior and revert failures remain unverified (confidence: 100).

VERDICT: REVISE
### lens-plan-r3.txt

I2 CLOSED — PLAN `tasks/plans/.plan-2026-10-09-lru-sqlite-retirement.md-r3.body.md:62` now requires an admitted predecessor-worker witness that rejects self-waiting. It covers ticket admission before establishment at `src-tauri/src/db/repository.rs:257` and `:263`.

[blocker] I3 NOT CLOSED — PLAN `tasks/plans/.plan-2026-10-09-lru-sqlite-retirement.md-r3.body.md:58` forbids a second pool timeout, but its verification at `:72` asserts categories and retry independence without bounded completion. An implementation could retain `pool.get()` (`src-tauri/src/db/repository.rs:1661`), spend its additional configured timeout (`:74`), then return typed `Conflict` or `Cancellation` and satisfy those assertions. Require a synchronized completion bound that fails when acquisition adds another timeout or delays cancellation. (confidence: 90)

I4 CLOSED — The additive Authority supplement at `tasks/plans/2026-10-09-lru-sqlite-retirement.md:236` supplies both missing authorities, supported by spelling preservation at `src-tauri/src/infra/path_authority/mod.rs:2078` and delayed cached establishment at `src-tauri/src/db/repository.rs:986` and `:1175`.

VERDICT: REVISE
### lens-plan-r4.txt

I3 CLOSED — `tasks/plans/.plan-2026-10-09-lru-sqlite-retirement.md-r4.body.md:74` requires synchronized completion assertions below the pool timeout, predecessor retention through outcome assertion, and failure when extra budgets or delayed cancellation return. This rejects the `pool.get()` delay at `src-tauri/src/db/repository.rs:1661`, configured as two seconds in tests at `:76`, while preserving O2’s typed-result and caller-independence requirements. Closure covers the planned proof. Implementation and measured revert failures remain unverified (confidence: 95).

VERDICT: APPROVED
### lens-plan-r5.txt

No drift invalidation found. The changed workspace initialization and verifier preserve the integration proof at tasks/plans/.plan-2026-10-09-lru-sqlite-retirement.md-r5.body.md:108. scripts/verify-app.mjs:3399 adds workspace assertions while retaining titlebar shutdown checks at :3460 and failure propagation at :3651. The Rust repository source is unchanged.

Named limitations: runtime proofs were not rerun. No process-generated ROUND/DELTA/REVISED/SETTLED block was supplied, so this result covers the supplied source drift without re-establishing prior issue closure (confidence: 100).

VERDICT: APPROVED
### lens-plan-r6.txt

I5 CLOSED — tasks/plans/.plan-2026-10-09-lru-sqlite-retirement.md-r6.body.md:98 requires Node 24, version readiness and native codec import/round-trip after installation, before the unchanged full-app proof at :112. This addresses scripts/verify-app.mjs:508 while preserving d-20261009-14 and the implementation scope (confidence: 98).

No DELTA or dependent-obligation defect found. Shutdown checks at scripts/verify-app.mjs:3460 and failure propagation at :3651 remain intact. The repository source is unchanged across the supplied bases.

Named limitation: runtime proofs were not rerun in this read-only review. Adoption readiness and the full-app result remain unverified (confidence: 100).

VERDICT: APPROVED
### lens-plan-r7.txt

[blocker] tasks/plans/.plan-2026-10-09-lru-sqlite-retirement.md-r7.body.md:44 — O1’s completion condition misses a predecessor binding retained without a connection ticket. Changed premise: `BoundDatabase::acquire` now refuses same-parent aliases while any binding holder survives (`src-tauri/src/db/bound_sqlite.rs:217`). An r2d2 worker upgrades the pool before calling `connect` (`r2d2-0.8.10/src/lib.rs:236`), retaining `BoundConnectionManager.database` before ticket admission (`src-tauri/src/db/repository.rs:247`, `:257`). If paused there across eviction, the evictor can finish disposal and the connection count reach zero while the binding remains alive. O2’s alias reopen and O3’s successful retry (`PLAN:60`, `:66`) can then return immediate admission `Conflict`. The planned admitted-worker witness at `PLAN:62` does not exercise this interval. Require retirement completion to account for predecessor-owned binding holders and a synchronized witness proving alias reopen waits and succeeds after that worker releases ownership. (confidence: 90)

[should-fix] tasks/plans/.plan-2026-10-09-lru-sqlite-retirement.md-r7.body.md:94 — Risks still describes f-20260929-05 as a separate unresolved hard-link hazard. Changed premise: the new admission predicate prevents concurrent distinct same-parent bindings (`src-tauri/src/db/bound_sqlite.rs:217`), and the drift marks that finding handled (`tasks/findings.md:12452`). Update the current risk statement to preserve d-20261011-01’s refusal policy and distinguish the separately filed rename-retention defect, f-20261011-01. Leave the historical trace intact. (confidence: 100)

[should-fix] tasks/plans/2026-10-09-lru-sqlite-retirement.md:120 — The history establishes earlier rounds, but this r7 packet omits the required process-generated `ROUND`, `DELTA`, `REVISED`, `SETTLED` block. The supplied source drift does not replace that input under `/home/felixb/.claude/references/review-lens-contract.md:246`, `:262`. Supply the block or explicitly resolve the refresh-specific contract exception. (confidence: 100)

Named limitation: these conclusions are source-traced. No runtime proofs or platform CI were run, and prior issue closure was not re-established.

VERDICT: REVISE
### lens-plan-r8.txt

I6 CLOSED — r8 PLAN:44 requires predecessor pool and manager ownership to end before completion. PLAN:64 adds the synchronized pre-admission worker witness and rejects ticket-only completion. This covers r2d2’s upgrade-before-connect interval (`r2d2-0.8.10/src/lib.rs:236`), the manager’s binding ownership (`src-tauri/src/db/repository.rs:247`), and alias refusal (`src-tauri/src/db/bound_sqlite.rs:217`). Existing lifecycle, typed-error and bounded-completion obligations remain intact.

I7 CLOSED — r8 PLAN:82 and PLAN:96 preserve d-20261011-01 and correctly distinguish handled f-20260929-05 (`tasks/findings.md:12452`) from the separate rename-retention finding (`tasks/findings.md:15154`).

Named limitation: source-only review. Implementation, revert-to-red, real-app and platform proofs remain unexecuted adoption requirements (confidence: 100).

VERDICT: APPROVED
### lens-platform-semantics-r1.txt

[should-fix] tasks/plans/2026-10-09-lru-sqlite-retirement.md:52 — On case-insensitive Windows filesystems, replacing `GameCase.db3` and authorizing its successor as `gamecase.db3` changes the object identity while preserving unequal canonical path spellings. `canonical_binding` preserves leaf casing (`src-tauri/src/infra/path_authority/mod.rs:2073`), so the proposed matching rule can miss the draining predecessor. Require filesystem-compatible name equivalence and a replacement witness using different casing at reopen, revision-read and deletion boundaries. (confidence: 94)

Limitation: This was a source-only plan review. No Windows compile check, non-Linux Unix source probe or runtime tests ran. Native runtime proof remains `rust-windows-test` and `rust-macos-test`. The `rust-platform` matrix supplies clippy/compile proof.

VERDICT: REVISE
### lens-platform-semantics-r2.txt

CLOSED: I1 — O1/O2 match object identity OR retained parent identity, covering differently spelled replacements on Windows and macOS. `repository.rs:1286` obtains parent identity from the retained handle. `path_authority/mod.rs:3706` uses Unix device/inode or Windows volume/file index. O2 requires casing-alias witnesses across acquisition, revision and deletion boundaries.

NOT MY CLASS: I2 — closure belongs to review-plan.

No new platform findings.

Limitation: source-only plan review. No tests, `pnpm rust:windows:check`, or non-Linux Unix source probe ran. Planned native runtime proof is `rust-windows-test` and `rust-macos-test`. The `rust-platform` matrix provides compile/clippy proof, including `-D warnings`.

VERDICT: APPROVED
### lens-platform-semantics-r5.txt

[should-fix] scripts/verify-app.mjs:509 — The drift adds a direct `.ts` import to the plain Node verifier. On Linux with supported Node 20.19 (`package.json:174`), loading fails with `ERR_UNKNOWN_FILE_EXTENSION` before app startup. This invalidates the plan’s required `pnpm verify:app` integration proof on that supported runtime. Recorded Node 24 success does not cover Node 20 (confidence: 98).

No Rust platform premise changed. No tests, Windows compile check or non-Linux Unix source probe ran. Windows and macOS runtime proof remains required through `rust-windows-test` and `rust-macos-test`, with `rust-platform` providing compile/clippy coverage.

VERDICT: REVISE
### lens-platform-semantics-r6.txt

I5 CLOSED — r6 plan:90,98 requires the existing Node 24 runtime, version verification, dependency installation and actual native codec import/compressed round-trip before the unchanged full-app proof. This preserves d-20261009-14 without claiming Node 20 compatibility or expanding implementation scope.

No DELTA defect, drift invalidation or plan blocker found.

Limitation: read-only review ran no runtime proofs, Windows compile check or non-Linux Unix source probe. Adoption still requires those applicable checks and native `rust-windows-test`, `rust-macos-test` and `rust-platform` CI evidence.

VERDICT: APPROVED
### lens-platform-semantics-r7.txt

No platform drift invalidates O1–O3 or the Phases proof obligations. The new alias refusal makes draining and releasing predecessor bindings before successor acquisition essential. O1’s completed-disposal requirement and O2’s establishment barriers already require that ordering. Windows name folding remains unchanged, and parent-identity matching still covers replacement spellings.

The adjusted replacement fixture releases its setup binding before reopening the renamed inode. New alias tests do not replace the plan’s required platform-neutral ownership and error/retry witnesses.

Limitation: source-only review. No tests, `pnpm rust:windows:check`, or non-Linux Unix source probe ran. Adoption still requires Windows/macOS runtime evidence from `rust-windows-test` and `rust-macos-test`, plus compile/clippy evidence from `rust-platform`. The changed integration verifier remains covered by the existing Node 24 readiness and full real-app proof requirements.

VERDICT: APPROVED
### lens-platform-semantics-r8.txt

No platform defect introduced by the r8 delta. O1 now covers upgraded-but-unadmitted workers retaining the predecessor manager. O2’s synchronized hard-link witness tests that interval, while Phase proof requires central ownership and error/retry witnesses on Linux, macOS and Windows. Parent-identity matching and Windows binding-name folding remain intact. The revised Risks text preserves d-20261011-01’s admission policy.

Limitation: source-only review. No tests, `pnpm rust:windows:check`, or non-Linux Unix source probe ran. Windows/macOS runtime proof remains required from `rust-windows-test` and `rust-macos-test`. `rust-platform` supplies target compile/clippy evidence. Node 24 readiness and full real-app integration proof remain adoption obligations.

VERDICT: APPROVED
### lens-tauri-security-r1.txt

No security-boundary defects found in O1–O3. The obligations retain predecessor ownership through SQLite close, fence reopen and unlink, and preserve barriers after cancellation or timeout.

Limitation: this is plan review only. Implementation and lifecycle witnesses remain unverified. Credential, session and signed-download flows are absent from the assigned change.

VERDICT: APPROVED
### lens-tauri-security-r5.txt

No security drift invalidation found. The workspace changes preserve the original path-owner snapshot and do not change credential storage. `scripts/verify-app.mjs` retains real IPC, reservation-sweep and shutdown assertions, preserving the plan’s integration-proof obligation.

Limitation: runtime proofs were not rerun during this read-only review.

VERDICT: APPROVED
### lens-tauri-security-r7.txt

No security drift invalidation found. The new hard-link admission refusal preserves native authority and binding lifetime. O1–O3 still require drain completion before successor opens or deletion. Changed diagnostics remain native.

Limitation: runtime and platform proofs were not executed. Credential and signed-download flows are unchanged.

VERDICT: APPROVED
### lens-tests-r1.txt

No findings. O1–O3 specify Rust lifecycle assertions that would fail on revert, including real LRU eviction, blocked successor opens/unlink, and retained barriers after cancellation or timeout. The repository selector and platform CI jobs include the proposed tests.

Limitation: this approves the planned proof. Implementation assertions and actual revert failures remain unverified (confidence: 100).

VERDICT: APPROVED
### lens-tests-r2.txt

CLOSED: I1 — verification coverage now requires spelling-alias replacement witnesses at cached acquisition, revision and deletion boundaries, plus same-parent blocking and different-parent progress.

CLOSED: I2 — verification coverage now includes a replacement cached before eviction and delayed successor replenishment. The required assertion forbids actual successor SQLite establishment before predecessor close, so restoring either bypass would fail.

No verification findings. O1–O3 name Rust lifecycle assertions for real LRU retirement, bounded retention, protected-open/unlink ordering, and cancellation/timeout retry safety. The repository selector and platform CI test commands include the proposed witnesses. The plan explicitly requires keeping regression tests while reverting production changes and recording assertion failures.

Limitation: this closes the planned verification contracts only. Test implementations and actual revert failures remain unverified (confidence: 100).

VERDICT: APPROVED
### lens-tests-r3.txt

I2 CLOSED — O2 now requires a real predecessor worker paused after ticket admission, resumed after retirement publication. Its completion-before-deadline and ticket-release assertions would reject self-waiting.

I3 CLOSED — O3 requires actual cached-worker failures with an authority-valid target, asserts both Rust variant and ErrorCategory, and checks healthy-caller independence and retry success. Generic R2d2/database classification would fail.

[should-fix] tasks/plans/.plan-2026-10-09-lru-sqlite-retirement.md-r3.body.md:72 — The new prohibition on a second pool timeout has no corresponding duration assertion. Cached acquisition could exhaust the predecessor deadline, wait another pool timeout, then return correctly typed Conflict and pass every stated outcome/retry assertion. Require a synchronized deadline-bound assertion that fails when acquisition starts a second timeout budget. (confidence: 95)

Limitation: This checks planned proof contracts. Implemented assertions and measured revert failures remain unverified (confidence: 100).

VERDICT: APPROVED
### lens-tests-r4.txt

I3 CLOSED — PLAN:74 requires synchronized cached/worker timeout and cancellation completion assertions, measured from a pre-spawn origin while the predecessor remains held. The bound must fall below the additional pool timeout and fail when a second budget or delayed cancellation is restored. Multiple predecessors or a reservation recheck must also reject refreshed budgets. This closes the planned proof gap. Implemented assertions and measured revert failures remain unverified (confidence: 100).

VERDICT: APPROVED
### lens-tests-r5.txt

No drift invalidation found. `scripts/verify-app.mjs` preserves real startup, IPC, reservation-sweep and shutdown checks. Added reload assertions compare rendered tab IDs and selection against the seeded values, and failures produce exit code 1.

Limitation: runtime status remains unmeasured in this review. The planned Rust witnesses and revert proof remain required for O1–O3.

VERDICT: APPROVED
### lens-tests-r6.txt

I5 CLOSED — r6 requires Node 24 version readiness and actual native codec import/compressed round-trip after installation, before the unchanged full-app proof. Import failure cannot waive that proof.

No drift invalidation found. The changed verifier retains startup, IPC and shutdown assertions. O1–O3 retain deterministic Rust witnesses and explicit revert-to-red proof.

Named limitation: runtime proofs were not rerun in this read-only review. Closure confirms the planned verification obligation, not runtime success (confidence: 100).

VERDICT: APPROVED
### lens-tests-r7.txt

No drift invalidation found. O1–O3 retain assertions for real LRU ownership, blocked successor opens/unlink, WAL close ordering, failed-drain retention, typed errors and bounded completion. Immediate alias refusal alone cannot satisfy O2’s blocking and completion obligations.

The repository selector and platform CI still reach the planned witnesses. The expanded app verifier preserves IPC and shutdown assertions.

Limitation: this read-only review supplies no runtime or revert-to-red evidence. Those remain required adoption proofs (confidence: 100).

VERDICT: APPROVED
### lens-tests-r8.txt

No verification defect introduced by r8. O2’s new witness at PLAN:64 pauses a real worker before ticket admission and asserts alias reopening waits, avoids immediate Conflict, and succeeds after pool release. Ticket-only retirement completion would fail those assertions. Existing admitted-worker, typed-error, bounded-completion and retry obligations remain intact.

The repository selector and platform CI reach the planned witnesses. Real-app integration remains complementary proof.

Limitation: source-only review. Implemented assertions, revert-to-red results and runtime/platform evidence remain adoption requirements (confidence: 100).

VERDICT: APPROVED
### plan-r1.md

# Plan: retain and drain LRU-evicted SQLite connections

## Goal

Resolve f-20260930-01 so an LRU-evicted pool cannot close SQLite handles after a later deletion or successor open of the same database. This is a PLAN-ONLY run at BASE 8ebc643ef5569b29f269415a7b2f958c1e4e78c2. Implementation belongs to the adopting session.

## MANDATE

### LRU eviction drops a database entry without draining its SQLite connections, so one can close after a later delete of the same file

* **ID:** f-20260930-01 · **Status:** open · **Area:** db-search · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/db/repository.rs` `evict_idle_entries` (~line 973, called under the repository state lock from `entry()` ~915); `close_retired_entry` (~952) and `DrainGate` (~109) are the drain every other retirement path uses since `3ed94336`.
* **Defect:** eviction removes an idle entry (`Arc::strong_count == 1`, no lease, not retiring) from `RepositoryState.entries` and drops it without closing its connection gate or waiting for outstanding connection tickets. An r2d2 `add_connection` job started by an earlier `get` can still hold an upgraded pool reference and a live or in-flight SQLite handle (the f-20260929-07 mechanism). A later `delete_exclusive_cancellable` of the same file then finds no entry, drains nothing, and unlinks while that handle is still open. The window is small (a replenishment job outliving the `get` that spawned it), reported by the repair leaf of the 2026-09-30 push review.
* **Why it matters:** it is the last retirement path that can close an SQLite handle (and unlink WAL/SHM) after the file was deleted or replaced, which every other path now excludes.
* **Proposed fix:** close the evicted entry's connection gate and drop its pool at eviction without blocking under the state lock, and keep the evicted gates reachable (for example a per-key list of draining gates in `RepositoryState`) so `delete_exclusive_inner` and `entry()` rebuild wait on them through `DrainGate::wait_drained` before unlinking or opening a fresh pool.
* **Open question:** where do evicted-but-draining gates live and who prunes them — a per-key list in `RepositoryState` pruned on drain, or eviction deferred to a path that may block — without holding the state lock across a wait?
* **Found by:** Codex write leaf (repair of the `8b97e423` push review), out-of-scope report; confirmed by the orchestrator from source, 2026-09-30. Related: `f-20260929-07`.

## Threat model and non-goals

Ordinary concurrent native database operations, r2d2 replenishment workers, cancellation, drain timeout, authority-valid same-path replacement and aliases on Linux, macOS and Windows. Preserve existing authority checks and bound VFS behavior. No new protection against malicious pathname churn, new cross-capability lifetime protocol, pool-key merger, hard-link WAL redesign, background service, watcher, shutdown redesign, or new renderer behavior.

## Traced premises

Frozen source trace at BASE, confirmed by the root and locate probe-1-r1:

* `repository.rs:1091` selects idle sole-owner LRU entries and removes them under the state mutex.
* `repository.rs:135`, `:252` and `:223` give each pooled SQLite open a ticket from before establishment until after SQLite and its binding close.
* r2d2 0.8.10 `src/lib.rs:230` upgrades a weak pool on its worker before connect and retains it through publication.
* `repository.rs:1664` closes connection admission and drops the pool before draining.
* `repository.rs:1070` removes a retired entry even if its drain returns an error, losing future lookup of that gate.
* `repository.rs:868` deletion reserves the canonical path but drains only the exact current entry.
* `repository.rs:929` owns pool construction through the building set and BuildGuard.
* `repository.rs:684` also opens a transient bound revision connection without constructing a pool.
* `repository.rs:372` keys pools by object, parent and path. `bound_sqlite.rs:188` reuses bindings, it does not drain predecessor connections.
* `db/mod.rs:2870` and `puzzle.rs:646` execute descriptor-bound unlink inside the repository deletion barrier.
* `repository.rs:2603`, `:2762`, `:2789`, `:2809`, and `:4855` contain cancellation, timeout, LRU and VFS/sidecar lifetime witnesses.
* `path_authority/mod.rs:962` supplies platform-neutral test targets. Most existing repository lifecycle tests are Unix-only at `repository.rs:1799`. The bound SQLite witness module at `:3293` is platform-neutral.

## Approach

### O1 — publish and bound predecessor ownership

Derived from MANDATE “keep the evicted gates reachable” and “without blocking under the state lock”. RepositoryState owns a bounded set of retirement records identified by predecessor object and canonical path. Limit records, including capacity reservations, to MAX_OPEN_DATABASES (16). Publish ownership and close new connection admission atomically with removing the eligible LRU entry. Keep its teardown visibly outstanding until pool and entry disposal have completed outside the repository state mutex. A zero count must prove that no evictor still owns a pool awaiting disposal, as well as that SQLite has closed every admitted handle.

Only closed, fully drained records may be pruned. Prune completed records opportunistically at retirement/admission boundaries, including when a different database is accessed, so churn through never-revisited names cannot accumulate records. Capacity exhaustion applies bounded cancellable backpressure outside the state mutex, returning Cancellation or Conflict on failure before losing a resource or publishing a cache entry whose required eviction cannot be owned. Preserve the existing active-lease LRU exception. No unrestricted per-key history and no background cleanup.

Verification level: deterministic Rust concurrency witnesses through real LRU selection. Assert the entry is eligible without an entry Arc or caller lease artificially pinning it, that connection admission closes, and that retirement ownership remains visible while an actual SQLite handle is held. An unrelated existing database operation must still finish while predecessor teardown waits. Churn and saturation witnesses assert the record bound and recovery after tickets close.

### O2 — enforce the predecessor barrier at reopen and deletion

Derived from MANDATE “before unlinking or opening a fresh pool” and “same file”. Match retired predecessors by the same object identity OR the same canonical path, retaining the existing pool key and authority checks. Pool construction, transient revision opens and the delete reservation must drain every matching predecessor before any corresponding SQLite establishment or unlink callback. Reuse one retirement matching/wait/pruning contract at those boundaries.

Waits release the repository state mutex. Coordinate their publication and recheck with the existing construction and deletion reservations so a newly published matching retirement cannot slip between the wait and protected operation. Keep active-lease conflicts and avoid waiting on a lease held by the same caller. Use one absolute deadline for each predecessor-barrier operation, not a fresh full timeout per predecessor or loop. Cancellation remains effective before destructive work begins. BoundDatabase lifetime and close ordering remain intact.

Verification level: synchronized Rust witnesses assert that same-key reopen, same-path replacement, same-object alias and deletion cannot establish a successor handle or run the unlink callback until the predecessor closes. Include the transient revision boundary. A real WAL fixture proves the predecessor's final close occurs before the successor's WAL/SHM can exist, and the successor remains queryable with its sidecars intact.

### O3 — retain barriers after incomplete drains

Derived from MANDATE “where evicted-but-draining gates live and who prunes them”. Timeout or cancellation must never discard or reopen a retired predecessor's connection gate. Release the waiting operation's temporary reservations, preserve predecessor ownership, and refuse its SQLite open or unlink. A retry after closure succeeds and removes completed bookkeeping.

Route LRU and the existing close_retired_entry removal through shared predecessor ownership. This also closes the same mechanism exposed when close_retired_entry currently removes an undrained gate on timeout or cancellation. Caller-lease cancellation before connection retirement keeps today's admission restoration. After connection retirement begins, reopening the caller lease must not make a retired pool reusable or remove its predecessor barrier.

Verification level: deterministically cancel during the connection-drain phase, and inject the shorter per-repository timeout. Assert no protected operation ran, an undrained predecessor remains discoverable, subsequent reopen/delete still waits or fails closed, and retry succeeds once the held connection is released.

## Decisions and trade-offs

Entry remains build. The recorded decisions settle keying, authority, timeout and test synchronization, but none settles evicted-gate ownership and bounded retention.

Preserve d-20260904-01's injectable 60-second production timeout, d-20260913-02's pool key, d-20260913-03's lease-safe retirement, d-20260929-04's VFS authority, d-20260929-05's cross-directory refusal, and d-20261008-29/-30's synchronized test timing. O3 extends failed-drain safety, it does not reverse those decisions.

## Decided autonomously

* Question: Who owns evicted-but-draining gates and when are they pruned? Chosen: bounded repository retirement records using existing connection tickets, synchronous disposal outside the state mutex and opportunistic completed-record pruning. Rejected: evictor-local ownership alone (concurrent delete/reopen loses the barrier), an unbounded per-key list, or a background reaper. Reason: MANDATE requires future lookups and bounded retention, and no new process is needed. Reversal path: replace the registry only with a protocol proving the same lookup, capacity, failure and teardown-order invariants.
* Question: Does a fresh revision read count as a reopen? Chosen: yes, apply the same retired-predecessor barrier at read_revision without creating a pool. Rejected: fencing pool construction alone. Reason: a revision read is another SQLite establishment against the same authority-bound file. Reversal path: remove that barrier only if transient revision establishment can no longer overlap an evicted predecessor.
* Question: May close_retired_entry forget a gate after timeout or cancellation? Chosen: no, retain its undrained predecessor through the shared ownership contract. Rejected: removing the entry and forgetting its gate. Reason: a later delete can otherwise reproduce the same post-unlink close that MANDATE forbids. Reversal path: demonstrate another authoritative owner consulted by every future reopen/delete before removing this retention.

## Risks / open questions

No product decision is needed. The code executor owns private helper names and test placement within the reviewed obligations. Preserve the known hard-link WAL and cross-capability hazards as separate findings f-20260929-05 and f-20261001-02. This plan covers retired predecessor barriers, not concurrent live alias pools or all transient-reader lifetimes.

Locate confirmed Codex CLI 0.162.0 and the cargo, pnpm, agent-gate, WebKitWebDriver, tauri-driver and kwin_wayland binaries. The planner worktree has no node_modules and runs no install or runtime proofs. Adoption must run pnpm install --frozen-lockfile, recheck the exact released-kit parity and runtime prerequisites, and use the shared gate wrappers. Existing verify:app comments record unrelated failure history. Current runtime status is unmeasured, not green evidence.

## Not part of this task

Other db-search siblings remain open at their recorded tiers. No frontend, Specta signature, binding, schema, dependency, capability, VFS implementation or deletion-outcome change is planned. No claim of implemented or runtime-verified behavior is made by this planner.

## Phases

One cohesive sensitive phase owns `src-tauri/src/db/repository.rs`, production ownership plus its regression witnesses. Concurrency, resource lifetime and cancellation are touched. API signatures and persisted schemas are unchanged. Selected executor: codex, write role sensitive resolved through leaf-launch.sh and the model registry. No history fork is needed. The root integrates, arbitrates, verifies and commits in the adopting run.

Implement O1–O3 together so every retirement path and every barrier ships with its witnesses. Prefer the existing platform-neutral test module for common lifetime behavior. OS-specific WAL fixtures may stay platform-gated, but the central ownership and error/retry witnesses must run on Linux, macOS and Windows. Read async-resource-invariants.md, pgn-scanning.md and ipc-events.md before writing. No other source files are assigned.

Exact phase proof: `cargo test --manifest-path src-tauri/Cargo.toml db::repository:: -- --test-threads=1 && pnpm checks:pre-review`. Keep new regressions present while reverting only the task-owned production fix from its Git diff, record the expected assertion failures, restore, and rerun green. The adopter owns that proof, not the read-only planner.

After implementation and cumulative diff review, run `pnpm build && pnpm verify:app --screenshot /tmp/drain-plan-chessfable-0a459a4f-slot1/build/verify-ui/retirement-app.png` for real app startup/IPC/shutdown integration. It complements the deterministic Rust SQLite retirement witnesses, it does not directly prove the LRU race. No new standalone verifier is planned.

Final affected push gates: `pnpm gates:push -- --rust`, through the canonical detached push-gate route on the final clean HEAD. It includes backend tests/coverage, fmt/clippy, Windows compile checks, contract and kit parity. No ratchet changes. The release also requires `pnpm ci:remote:check` and successful rust-windows-test, rust-macos-test and rust-platform jobs on the pushed SHA. Run the project push skill, then verify HEAD equals upstream and applicable installation. Record the autonomous decisions and complete review handoff before final gates. Close f-20260930-01 only through findings.py after verified implementation.

## Carried to diff review

None.

### plan-r2.md

# Plan: retain and drain LRU-evicted SQLite connections

## Goal

Resolve f-20260930-01 so an LRU-evicted pool cannot close SQLite handles after a later deletion or successor open of the same database. This is a PLAN-ONLY run at BASE 8ebc643ef5569b29f269415a7b2f958c1e4e78c2. Implementation belongs to the adopting session.

## MANDATE

### LRU eviction drops a database entry without draining its SQLite connections, so one can close after a later delete of the same file

* **ID:** f-20260930-01 · **Status:** open · **Area:** db-search · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/db/repository.rs` `evict_idle_entries` (~line 973, called under the repository state lock from `entry()` ~915); `close_retired_entry` (~952) and `DrainGate` (~109) are the drain every other retirement path uses since `3ed94336`.
* **Defect:** eviction removes an idle entry (`Arc::strong_count == 1`, no lease, not retiring) from `RepositoryState.entries` and drops it without closing its connection gate or waiting for outstanding connection tickets. An r2d2 `add_connection` job started by an earlier `get` can still hold an upgraded pool reference and a live or in-flight SQLite handle (the f-20260929-07 mechanism). A later `delete_exclusive_cancellable` of the same file then finds no entry, drains nothing, and unlinks while that handle is still open. The window is small (a replenishment job outliving the `get` that spawned it), reported by the repair leaf of the 2026-09-30 push review.
* **Why it matters:** it is the last retirement path that can close an SQLite handle (and unlink WAL/SHM) after the file was deleted or replaced, which every other path now excludes.
* **Proposed fix:** close the evicted entry's connection gate and drop its pool at eviction without blocking under the state lock, and keep the evicted gates reachable (for example a per-key list of draining gates in `RepositoryState`) so `delete_exclusive_inner` and `entry()` rebuild wait on them through `DrainGate::wait_drained` before unlinking or opening a fresh pool.
* **Open question:** where do evicted-but-draining gates live and who prunes them — a per-key list in `RepositoryState` pruned on drain, or eviction deferred to a path that may block — without holding the state lock across a wait?
* **Found by:** Codex write leaf (repair of the `8b97e423` push review), out-of-scope report; confirmed by the orchestrator from source, 2026-09-30. Related: `f-20260929-07`.

## Threat model and non-goals

Ordinary concurrent native database operations, r2d2 replenishment workers, cancellation, drain timeout, authority-valid same-path replacement and aliases on Linux, macOS and Windows. Preserve existing authority checks and bound VFS behavior. No new protection against malicious pathname churn, new cross-capability lifetime protocol, pool-key merger, hard-link WAL redesign, background service, watcher, shutdown redesign, or new renderer behavior.

## Traced premises

Frozen source trace at BASE, confirmed by the root and locate probe-1-r1:

* `repository.rs:1091` selects idle sole-owner LRU entries and removes them under the state mutex.
* `repository.rs:135`, `:252` and `:223` give each pooled SQLite open a ticket from before establishment until after SQLite and its binding close.
* r2d2 0.8.10 `src/lib.rs:230` upgrades a weak pool on its worker before connect and retains it through publication.
* `repository.rs:1664` closes connection admission and drops the pool before draining.
* `repository.rs:1070` removes a retired entry even if its drain returns an error, losing future lookup of that gate.
* `repository.rs:868` deletion reserves the canonical path but drains only the exact current entry.
* `repository.rs:929` owns pool construction through the building set and BuildGuard.
* `repository.rs:684` also opens a transient bound revision connection without constructing a pool.
* `repository.rs:372` keys pools by object, parent and path. `bound_sqlite.rs:188` reuses bindings, it does not drain predecessor connections.
* `db/mod.rs:2870` and `puzzle.rs:646` execute descriptor-bound unlink inside the repository deletion barrier.
* `repository.rs:2603`, `:2762`, `:2789`, `:2809`, and `:4855` contain cancellation, timeout, LRU and VFS/sidecar lifetime witnesses.
* `path_authority/mod.rs:962` supplies platform-neutral test targets. Most existing repository lifecycle tests are Unix-only at `repository.rs:1799`. The bound SQLite witness module at `:3293` is platform-neutral.

## Approach

### O1 — publish and bound predecessor ownership

Derived from MANDATE “keep the evicted gates reachable” and “without blocking under the state lock”. RepositoryState owns a bounded set of retirement records identified by predecessor object and retained parent identity. Limit records, including capacity reservations, to MAX_OPEN_DATABASES (16). Publish ownership and close new connection admission atomically with removing the eligible LRU entry. Keep its teardown visibly outstanding until pool and entry disposal have completed outside the repository state mutex. A zero count must prove that no evictor still owns a pool awaiting disposal, as well as that SQLite has closed every admitted handle.

Only closed, fully drained records may be pruned. Prune completed records opportunistically at retirement/admission boundaries, including when a different database is accessed, so churn through never-revisited names cannot accumulate records. Capacity exhaustion applies bounded cancellable backpressure outside the state mutex, returning Cancellation or Conflict on failure before losing a resource or publishing a cache entry whose required eviction cannot be owned. Preserve the existing active-lease LRU exception. No unrestricted per-key history and no background cleanup.

Verification level: deterministic Rust concurrency witnesses through real LRU selection. Assert the entry is eligible without an entry Arc or caller lease artificially pinning it, that connection admission closes, and that retirement ownership remains visible while an actual SQLite handle is held. An unrelated database operation in a different retained parent must still finish while predecessor teardown waits. Churn and saturation witnesses assert the record bound and recovery after tickets close.

### O2 — enforce the predecessor barrier at reopen and deletion

Derived from MANDATE “before unlinking or opening a fresh pool” and “same file”. Match retired predecessors by the same object identity OR the same retained parent identity, retaining the existing pool key and authority checks. Parent matching conservatively fences all retired predecessors in that directory. It catches replacements whose authority-valid leaf spelling changes on case-insensitive or Unicode-normalizing filesystems without inventing a string equivalence rule. It deliberately delays otherwise unrelated opens in that parent until its retired predecessors drain, never live pools in that parent.

Pool construction, connection acquisition from already cached pools, transient revision opens and the delete reservation must drain every matching predecessor before any corresponding SQLite establishment or unlink callback. Cover actual connection-manager establishment, including delayed r2d2 replenishment from a previously cached pool, so fencing synchronous acquisition alone cannot leave a worker bypass. Reuse one retirement matching/wait/pruning contract at those boundaries. An already admitted worker belonging to the retiring predecessor must not wait on its own connection ticket. Preserve its existing close ordering and count it in that predecessor's drain, or refuse its open safely after admission closes. No repository ownership cycle may be introduced through pool managers.

Waits release the repository state mutex. Coordinate their publication and recheck with the existing construction and deletion reservations so a newly published matching retirement cannot slip between the wait and protected operation. Keep active-lease conflicts and avoid waiting on a lease held by the same caller. Use one absolute deadline for each predecessor-barrier operation, not a fresh full timeout per predecessor or loop. Cancellation remains effective before destructive work begins. BoundDatabase lifetime and close ordering remain intact.

Verification level: synchronized Rust witnesses assert that same-key reopen, same-path replacement, same-object alias and deletion cannot establish a successor handle or run the unlink callback until the predecessor closes. Include a replacement cached by a lock-only caller before the predecessor is LRU-evicted, then acquired afterward, and a delayed successor-pool replenishment worker crossing that retirement boundary. Include the transient revision boundary. On filesystems accepting spelling aliases, replace GameCase.db3 and authorize gamecase.db3, then witness cached acquisition, revision and deletion barriers. Assert conservative same-parent blocking and different-parent progress. A real WAL fixture proves the predecessor's final close occurs before the successor's WAL/SHM can exist, and the successor remains queryable with its sidecars intact.

### O3 — retain barriers after incomplete drains

Derived from MANDATE “where evicted-but-draining gates live and who prunes them”. Timeout or cancellation must never discard or reopen a retired predecessor's connection gate. Release the waiting operation's temporary reservations, preserve predecessor ownership, and refuse its SQLite open or unlink. A retry after closure succeeds and removes completed bookkeeping.

Route LRU and the existing close_retired_entry removal through shared predecessor ownership. This also closes the same mechanism exposed when close_retired_entry currently removes an undrained gate on timeout or cancellation. Caller-lease cancellation before connection retirement keeps today's admission restoration. After connection retirement begins, reopening the caller lease must not make a retired pool reusable or remove its predecessor barrier.

Verification level: deterministically cancel during the connection-drain phase, and inject the shorter per-repository timeout. Assert no protected operation ran, an undrained predecessor remains discoverable, subsequent reopen/delete still waits or fails closed, and retry succeeds once the held connection is released.

## Decisions and trade-offs

Entry remains build. The recorded decisions settle keying, authority, timeout and test synchronization, but none settles evicted-gate ownership and bounded retention.

Preserve d-20260904-01's injectable 60-second production timeout, d-20260913-02's pool key, d-20260913-03's lease-safe retirement, d-20260929-04's VFS authority, d-20260929-05's cross-directory refusal, and d-20261008-29/-30's synchronized test timing. O3 extends failed-drain safety, it does not reverse those decisions.

## Decided autonomously

* Question: Who owns evicted-but-draining gates and when are they pruned? Chosen: bounded repository retirement records using existing connection tickets, synchronous disposal outside the state mutex and opportunistic completed-record pruning. Rejected: evictor-local ownership alone (concurrent delete/reopen loses the barrier), an unbounded per-key list, or a background reaper. Reason: MANDATE requires future lookups and bounded retention, and no new process is needed. Reversal path: replace the registry only with a protocol proving the same lookup, capacity, failure and teardown-order invariants.
* Question: Does a fresh revision read count as a reopen? Chosen: yes, apply the same retired-predecessor barrier at read_revision without creating a pool. Rejected: fencing pool construction alone. Reason: a revision read is another SQLite establishment against the same authority-bound file. Reversal path: remove that barrier only if transient revision establishment can no longer overlap an evicted predecessor.
* Question: May close_retired_entry forget a gate after timeout or cancellation? Chosen: no, retain its undrained predecessor through the shared ownership contract. Rejected: removing the entry and forgetting its gate. Reason: a later delete can otherwise reproduce the same post-unlink close that MANDATE forbids. Reversal path: demonstrate another authoritative owner consulted by every future reopen/delete before removing this retention.
* Question: How are replacement names matched across filesystems? Chosen: same object OR retained parent identity, using authority identities already in EntryKey. Rejected: canonical path bytes or a new case-folding approximation. Reason: canonical_binding preserves the leaf's spelling and byte comparison can miss a replacement alias. Conservatively waiting for retired predecessors in the same parent gives a portable guarantee with bounded state. Reversal path: narrow parent matching only with authority-backed filesystem name equivalence and replacement witnesses on every supported platform.
* Question: Is construction the only pooled establishment boundary? Chosen: no, cached acquisition and actual manager establishment also use the predecessor barrier. Rejected: assuming every get creates a fresh pool. Reason: lock-only callers can cache a pool before its first SQLite connection and replenishment runs asynchronously. Reversal path: remove a boundary only if that path can no longer establish SQLite after predecessor retirement.

## Risks / open questions

No product decision is needed. The code executor owns private helper names and test placement within the reviewed obligations. Preserve the known hard-link WAL and cross-capability hazards as separate findings f-20260929-05 and f-20261001-02. This plan covers retired predecessor barriers, not concurrent live alias pools or all transient-reader lifetimes.

Locate confirmed Codex CLI 0.162.0 and the cargo, pnpm, agent-gate, WebKitWebDriver, tauri-driver and kwin_wayland binaries. The planner worktree has no node_modules and runs no install or runtime proofs. Adoption must run pnpm install --frozen-lockfile, recheck the exact released-kit parity and runtime prerequisites, and use the shared gate wrappers. Existing verify:app comments record unrelated failure history. Current runtime status is unmeasured, not green evidence.

## Not part of this task

Other db-search siblings remain open at their recorded tiers. No frontend, Specta signature, binding, schema, dependency, capability, VFS implementation or deletion-outcome change is planned. No claim of implemented or runtime-verified behavior is made by this planner.

## Phases

One cohesive sensitive phase owns `src-tauri/src/db/repository.rs`, production ownership plus its regression witnesses. Concurrency, resource lifetime and cancellation are touched. API signatures and persisted schemas are unchanged. Selected executor: codex, write role sensitive resolved through leaf-launch.sh and the model registry. No history fork is needed. The root integrates, arbitrates, verifies and commits in the adopting run.

Implement O1–O3 together so every retirement path and every barrier ships with its witnesses. Prefer the existing platform-neutral test module for common lifetime behavior. OS-specific WAL fixtures may stay platform-gated, but the central ownership and error/retry witnesses must run on Linux, macOS and Windows. Read async-resource-invariants.md, pgn-scanning.md and ipc-events.md before writing. No other source files are assigned.

Exact phase proof: `cargo test --manifest-path src-tauri/Cargo.toml db::repository:: -- --test-threads=1 && pnpm checks:pre-review`. Keep new regressions present while reverting only the task-owned production fix from its Git diff, record the expected assertion failures, restore, and rerun green. The adopter owns that proof, not the read-only planner.

After implementation and cumulative diff review, run `pnpm build && pnpm verify:app --screenshot /tmp/drain-plan-chessfable-0a459a4f-slot1/build/verify-ui/retirement-app.png` for real app startup/IPC/shutdown integration. It complements the deterministic Rust SQLite retirement witnesses, it does not directly prove the LRU race. No new standalone verifier is planned.

Final affected push gates: `pnpm gates:push -- --rust`, through the canonical detached push-gate route on the final clean HEAD. It includes backend tests/coverage, fmt/clippy, Windows compile checks, contract and kit parity. No ratchet changes. The release also requires `pnpm ci:remote:check` and successful rust-windows-test, rust-macos-test and rust-platform jobs on the pushed SHA. Run the project push skill, then verify HEAD equals upstream and applicable installation. Record the autonomous decisions and complete review handoff before final gates. Close f-20260930-01 only through findings.py after verified implementation.

## Carried to diff review

None.

## Reviews

### Round 1

Elapsed 598.5 seconds, adopted substantive issues 2. Active arbitration time and quota waits were not separately measured. No dependency wait was required. All 12 plan-capable lenses ran. The class-absent exits for chess-semantics, engine-protocol, ipc-contract, persisted-state and pgn-index are accepted against this backend resource-lifetime mandate.

I1 — platform-semantics r1 finding 1, should-fix, confidence 94. Fix adopted, awaiting closure. canonical_binding at path_authority/mod.rs:2073 preserves the leaf spelling. O1/O2 now retain and match parent identity instead of trusting path bytes. Same-parent retirement backpressure is an explicit technical trade-off. Dependencies: none.

I2 — plan r1 finding 1, blocker, confidence 90. Fix adopted, awaiting closure. repository.rs:753 and :986 allow lock-only caching with min_idle 0, :950 returns that cached entry and :1175 reaches establishment through get_connection. O2 now covers cached acquisition and actual worker establishment, with lifecycle witnesses. Dependencies: none.

Plan authorship and arbitration shared one context. Detection ran on the same model family selected for code execution. Codex role routing used review-plan for the plan lens and sensitive for the remaining applicable lenses. No source edits or runtime verification occurred.

#### Raw lens-correctness-r1

```text
No correctness defects found in O1–O3’s stated contracts.

Limitation: this is plan-only review. Reservation rechecks, capacity handling and teardown ordering require verification against the implementation (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-error-handling-r1

```text
VERDICT: APPROVED
```

#### Raw lens-minimalism-r1

```text
VERDICT: APPROVED
```

#### Raw lens-plan-r1

```text
[blocker] tasks/plans/2026-10-09-lru-sqlite-retirement.md:52 — O2 omits connection acquisition from an already cached replacement pool. Lock-only callers can cache a pool without opening SQLite (`src-tauri/src/db/repository.rs:753`, `:986`). Different identities at the same path have different keys (`:372`), so that replacement can remain cached when the old entry is later LRU-evicted. A subsequent acquisition returns the cached entry (`:950`) and calls `get_connection` (`:1175`), which can establish SQLite (`:263`) without passing through pool construction. The proposed boundaries therefore leave the same-path successor-open guarantee at plan line 56 unenforced. Cover cached acquisitions and require a lifecycle witness where the replacement is cached before predecessor eviction. (confidence: 90)

VERDICT: REVISE
```

#### Raw lens-tests-r1

```text
No findings. O1–O3 specify Rust lifecycle assertions that would fail on revert, including real LRU eviction, blocked successor opens/unlink, and retained barriers after cancellation or timeout. The repository selector and platform CI jobs include the proposed tests.

Limitation: this approves the planned proof. Implementation assertions and actual revert failures remain unverified (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-chess-semantics-r1

```text
NOT APPLICABLE: The assigned repository file and O1–O3 obligations concern SQLite connection retirement and drain ownership. They do not involve in-memory chess trees, positions, or move paths.
VERDICT: APPROVED
```

#### Raw lens-engine-protocol-r1

```text
NOT APPLICABLE: The sole file and O1–O3 obligations concern SQLite connection retirement, reopen, and deletion barriers. They do not involve engine process supervision, UCI protocol state, or asynchronous engine result routing.
VERDICT: APPROVED
```

#### Raw lens-ipc-contract-r1

```text
NOT APPLICABLE: O1–O3 cover internal SQLite retirement ownership and drain barriers in `src-tauri/src/db/repository.rs`. The plan changes no Rust↔renderer event, command, payload, subscription, capability scope, or shutdown contract.

VERDICT: APPROVED
```

#### Raw lens-persisted-state-r1

```text
NOT APPLICABLE: The assigned file is a Rust database repository. O1–O3 concern SQLite connection retirement and drain barriers, with no renderer storage keys, persisted atoms, hydration, or tab lifecycle changes.
VERDICT: APPROVED
```

#### Raw lens-pgn-index-r1

```text
NOT APPLICABLE: O1–O3 in `src-tauri/src/db/repository.rs` concern SQLite connection retirement and reopen/delete barriers. They do not change PGN byte scanning, offsets, move encoding, stored indexes, or search predicates.

VERDICT: APPROVED
```

#### Raw lens-platform-semantics-r1

```text
[should-fix] tasks/plans/2026-10-09-lru-sqlite-retirement.md:52 — On case-insensitive Windows filesystems, replacing `GameCase.db3` and authorizing its successor as `gamecase.db3` changes the object identity while preserving unequal canonical path spellings. `canonical_binding` preserves leaf casing (`src-tauri/src/infra/path_authority/mod.rs:2073`), so the proposed matching rule can miss the draining predecessor. Require filesystem-compatible name equivalence and a replacement witness using different casing at reopen, revision-read and deletion boundaries. (confidence: 94)

Limitation: This was a source-only plan review. No Windows compile check, non-Linux Unix source probe or runtime tests ran. Native runtime proof remains `rust-windows-test` and `rust-macos-test`. The `rust-platform` matrix supplies clippy/compile proof.

VERDICT: REVISE
```

#### Raw lens-tauri-security-r1

```text
No security-boundary defects found in O1–O3. The obligations retain predecessor ownership through SQLite close, fence reopen and unlink, and preserve barriers after cancellation or timeout.

Limitation: this is plan review only. Implementation and lifecycle witnesses remain unverified. Credential, session and signed-download flows are absent from the assigned change.

VERDICT: APPROVED
```


### plan-r3.md

# Plan: retain and drain LRU-evicted SQLite connections

## Goal

Resolve f-20260930-01 so an LRU-evicted pool cannot close SQLite handles after a later deletion or successor open of the same database. This is a PLAN-ONLY run at BASE 8ebc643ef5569b29f269415a7b2f958c1e4e78c2. Implementation belongs to the adopting session.

## MANDATE

### LRU eviction drops a database entry without draining its SQLite connections, so one can close after a later delete of the same file

* **ID:** f-20260930-01 · **Status:** open · **Area:** db-search · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/db/repository.rs` `evict_idle_entries` (~line 973, called under the repository state lock from `entry()` ~915); `close_retired_entry` (~952) and `DrainGate` (~109) are the drain every other retirement path uses since `3ed94336`.
* **Defect:** eviction removes an idle entry (`Arc::strong_count == 1`, no lease, not retiring) from `RepositoryState.entries` and drops it without closing its connection gate or waiting for outstanding connection tickets. An r2d2 `add_connection` job started by an earlier `get` can still hold an upgraded pool reference and a live or in-flight SQLite handle (the f-20260929-07 mechanism). A later `delete_exclusive_cancellable` of the same file then finds no entry, drains nothing, and unlinks while that handle is still open. The window is small (a replenishment job outliving the `get` that spawned it), reported by the repair leaf of the 2026-09-30 push review.
* **Why it matters:** it is the last retirement path that can close an SQLite handle (and unlink WAL/SHM) after the file was deleted or replaced, which every other path now excludes.
* **Proposed fix:** close the evicted entry's connection gate and drop its pool at eviction without blocking under the state lock, and keep the evicted gates reachable (for example a per-key list of draining gates in `RepositoryState`) so `delete_exclusive_inner` and `entry()` rebuild wait on them through `DrainGate::wait_drained` before unlinking or opening a fresh pool.
* **Open question:** where do evicted-but-draining gates live and who prunes them — a per-key list in `RepositoryState` pruned on drain, or eviction deferred to a path that may block — without holding the state lock across a wait?
* **Found by:** Codex write leaf (repair of the `8b97e423` push review), out-of-scope report; confirmed by the orchestrator from source, 2026-09-30. Related: `f-20260929-07`.

## Threat model and non-goals

Ordinary concurrent native database operations, r2d2 replenishment workers, cancellation, drain timeout, authority-valid same-path replacement and aliases on Linux, macOS and Windows. Preserve existing authority checks and bound VFS behavior. No new protection against malicious pathname churn, new cross-capability lifetime protocol, pool-key merger, hard-link WAL redesign, background service, watcher, shutdown redesign, or new renderer behavior.

## Traced premises

Frozen source trace at BASE, confirmed by the root and locate probe-1-r1:

* `repository.rs:1091` selects idle sole-owner LRU entries and removes them under the state mutex.
* `repository.rs:135`, `:252` and `:223` give each pooled SQLite open a ticket from before establishment until after SQLite and its binding close.
* r2d2 0.8.10 `src/lib.rs:230` upgrades a weak pool on its worker before connect and retains it through publication.
* `repository.rs:1664` closes connection admission and drops the pool before draining.
* `repository.rs:1070` removes a retired entry even if its drain returns an error, losing future lookup of that gate.
* `repository.rs:868` deletion reserves the canonical path but drains only the exact current entry.
* `repository.rs:929` owns pool construction through the building set and BuildGuard.
* `repository.rs:684` also opens a transient bound revision connection without constructing a pool.
* `repository.rs:372` keys pools by object, parent and path. `bound_sqlite.rs:188` reuses bindings, it does not drain predecessor connections.
* `db/mod.rs:2870` and `puzzle.rs:646` execute descriptor-bound unlink inside the repository deletion barrier.
* `repository.rs:2603`, `:2762`, `:2789`, `:2809`, and `:4855` contain cancellation, timeout, LRU and VFS/sidecar lifetime witnesses.
* `path_authority/mod.rs:962` supplies platform-neutral test targets. Most existing repository lifecycle tests are Unix-only at `repository.rs:1799`. The bound SQLite witness module at `:3293` is platform-neutral.

## Approach

### O1 — publish and bound predecessor ownership

Derived from MANDATE “keep the evicted gates reachable” and “without blocking under the state lock”. RepositoryState owns a bounded set of retirement records identified by predecessor object and retained parent identity. Limit records, including capacity reservations, to MAX_OPEN_DATABASES (16). Publish ownership and close new connection admission atomically with removing the eligible LRU entry. Keep its teardown visibly outstanding until pool and entry disposal have completed outside the repository state mutex. A zero count must prove that no evictor still owns a pool awaiting disposal, as well as that SQLite has closed every admitted handle.

Only closed, fully drained records may be pruned. Prune completed records opportunistically at retirement/admission boundaries, including when a different database is accessed, so churn through never-revisited names cannot accumulate records. Capacity exhaustion applies bounded cancellable backpressure outside the state mutex, returning Cancellation or Conflict on failure before losing a resource or publishing a cache entry whose required eviction cannot be owned. Preserve the existing active-lease LRU exception. No unrestricted per-key history and no background cleanup.

Verification level: deterministic Rust concurrency witnesses through real LRU selection. Assert the entry is eligible without an entry Arc or caller lease artificially pinning it, that connection admission closes, and that retirement ownership remains visible while an actual SQLite handle is held. An unrelated database operation in a different retained parent must still finish while predecessor teardown waits. Churn and saturation witnesses assert the record bound and recovery after tickets close.

### O2 — enforce the predecessor barrier at reopen and deletion

Derived from MANDATE “before unlinking or opening a fresh pool” and “same file”. Match retired predecessors by the same object identity OR the same retained parent identity, retaining the existing pool key and authority checks. Parent matching conservatively fences all retired predecessors in that directory. It catches replacements whose authority-valid leaf spelling changes on case-insensitive or Unicode-normalizing filesystems without inventing a string equivalence rule. It deliberately delays otherwise unrelated opens in that parent until its retired predecessors drain, never live pools in that parent.

Pool construction, connection acquisition from already cached pools, transient revision opens and the delete reservation must drain every matching predecessor before any corresponding SQLite establishment or unlink callback. Cover actual connection-manager establishment, including delayed r2d2 replenishment from a previously cached pool, so fencing synchronous acquisition alone cannot leave a worker bypass. Reuse one retirement matching/wait/pruning contract at those boundaries. An already admitted worker belonging to the retiring predecessor must not wait on its own connection ticket. Preserve its existing close ordering and count it in that predecessor's drain, or refuse its open safely after admission closes. No repository ownership cycle may be introduced through pool managers.

Waits release the repository state mutex. Coordinate their publication and recheck with the existing construction and deletion reservations so a newly published matching retirement cannot slip between the wait and protected operation. Keep active-lease conflicts and avoid waiting on a lease held by the same caller. Use one absolute deadline for each predecessor-barrier operation, not a fresh full timeout per predecessor or loop. Cancellation remains effective before destructive work begins. BoundDatabase lifetime and close ordering remain intact.

At every boundary, predecessor timeout returns the existing Error::Conflict and caller cancellation returns Error::Cancellation. Preserve that typed, operation-scoped result through cached acquisition even when r2d2 transports and retries manager errors as text. Do not infer the category by parsing those strings or let one caller's cancellation poison another caller or a later retry. A pool acquisition must not consume a second timeout after the predecessor deadline expires. No new public error category is required.

Verification level: synchronized Rust witnesses assert that same-key reopen, same-path replacement, same-object alias and deletion cannot establish a successor handle or run the unlink callback until the predecessor closes. Include a replacement cached by a lock-only caller before the predecessor is LRU-evicted, then acquired afterward, and a delayed successor-pool replenishment worker crossing that retirement boundary. Include the transient revision boundary. On filesystems accepting spelling aliases, replace GameCase.db3 and authorize gamecase.db3, then witness cached acquisition, revision and deletion barriers. Assert conservative same-parent blocking and different-parent progress. A real WAL fixture proves the predecessor's final close occurs before the successor's WAL/SHM can exist, and the successor remains queryable with its sidecars intact.

Also pause a real predecessor replenishment worker after its connection ticket is admitted but before SQLite establishment, make its entry genuinely LRU-eligible, publish retirement, and resume it. Synchronize at those lifecycle boundaries. Assert the worker completes or safely refuses establishment without waiting for its own ticket or the retirement deadline, releases the ticket, and allows the predecessor drain and successor barrier to finish. Keeping the regression while restoring self-waiting manager behavior must fail its completion/order assertion.

### O3 — retain barriers after incomplete drains

Derived from MANDATE “where evicted-but-draining gates live and who prunes them”. Timeout or cancellation must never discard or reopen a retired predecessor's connection gate. Release the waiting operation's temporary reservations, preserve predecessor ownership, and refuse its SQLite open or unlink. A retry after closure succeeds and removes completed bookkeeping.

Route LRU and the existing close_retired_entry removal through shared predecessor ownership. This also closes the same mechanism exposed when close_retired_entry currently removes an undrained gate on timeout or cancellation. Caller-lease cancellation before connection retirement keeps today's admission restoration. After connection retirement begins, reopening the caller lease must not make a retired pool reusable or remove its predecessor barrier.

Verification level: deterministically cancel during the connection-drain phase, and inject the shorter per-repository timeout. Assert no protected operation ran, an undrained predecessor remains discoverable, subsequent reopen/delete still waits or fails closed, and retry succeeds once the held connection is released.

Exercise cancellation and timeout after cached-pool worker establishment reaches a predecessor barrier, with the target remaining authority-valid. Assert the caller receives Cancellation/cancellation or Conflict/conflict (Rust variant and existing ErrorCategory), never R2d2/database. Assert a separately waiting healthy caller and a later retry remain independent and succeed after the predecessor closes. These witnesses must fail if the typed boundary result is replaced by the generic pool error.

## Decisions and trade-offs

Entry remains build. The recorded decisions settle keying, authority, timeout and test synchronization, but none settles evicted-gate ownership and bounded retention.

Preserve d-20260904-01's injectable 60-second production timeout, d-20260913-02's pool key, d-20260913-03's lease-safe retirement, d-20260929-04's VFS authority, d-20260929-05's cross-directory refusal, and d-20261008-29/-30's synchronized test timing. O3 extends failed-drain safety, it does not reverse those decisions.

## Decided autonomously

* Question: Who owns evicted-but-draining gates and when are they pruned? Chosen: bounded repository retirement records using existing connection tickets, synchronous disposal outside the state mutex and opportunistic completed-record pruning. Rejected: evictor-local ownership alone (concurrent delete/reopen loses the barrier), an unbounded per-key list, or a background reaper. Reason: MANDATE requires future lookups and bounded retention, and no new process is needed. Reversal path: replace the registry only with a protocol proving the same lookup, capacity, failure and teardown-order invariants.
* Question: Does a fresh revision read count as a reopen? Chosen: yes, apply the same retired-predecessor barrier at read_revision without creating a pool. Rejected: fencing pool construction alone. Reason: a revision read is another SQLite establishment against the same authority-bound file. Reversal path: remove that barrier only if transient revision establishment can no longer overlap an evicted predecessor.
* Question: May close_retired_entry forget a gate after timeout or cancellation? Chosen: no, retain its undrained predecessor through the shared ownership contract. Rejected: removing the entry and forgetting its gate. Reason: a later delete can otherwise reproduce the same post-unlink close that MANDATE forbids. Reversal path: demonstrate another authoritative owner consulted by every future reopen/delete before removing this retention.
* Question: How are replacement names matched across filesystems? Chosen: same object OR retained parent identity, using authority identities already in EntryKey. Rejected: canonical path bytes or a new case-folding approximation. Reason: canonical_binding preserves the leaf's spelling and byte comparison can miss a replacement alias. Conservatively waiting for retired predecessors in the same parent gives a portable guarantee with bounded state. Reversal path: narrow parent matching only with authority-backed filesystem name equivalence and replacement witnesses on every supported platform.
* Question: Is construction the only pooled establishment boundary? Chosen: no, cached acquisition and actual manager establishment also use the predecessor barrier. Rejected: assuming every get creates a fresh pool. Reason: lock-only callers can cache a pool before its first SQLite connection and replenishment runs asynchronously. Reversal path: remove a boundary only if that path can no longer establish SQLite after predecessor retirement.

## Risks / open questions

No product decision is needed. The code executor owns private helper names and test placement within the reviewed obligations. Preserve the known hard-link WAL and cross-capability hazards as separate findings f-20260929-05 and f-20261001-02. This plan covers retired predecessor barriers, not concurrent live alias pools or all transient-reader lifetimes.

Locate confirmed Codex CLI 0.162.0 and the cargo, pnpm, agent-gate, WebKitWebDriver, tauri-driver and kwin_wayland binaries. The planner worktree has no node_modules and runs no install or runtime proofs. Adoption must run pnpm install --frozen-lockfile, recheck the exact released-kit parity and runtime prerequisites, and use the shared gate wrappers. Existing verify:app comments record unrelated failure history. Current runtime status is unmeasured, not green evidence.

## Not part of this task

Other db-search siblings remain open at their recorded tiers. No frontend, Specta signature, binding, schema, dependency, capability, VFS implementation or deletion-outcome change is planned. No claim of implemented or runtime-verified behavior is made by this planner.

## Phases

One cohesive sensitive phase owns `src-tauri/src/db/repository.rs`, production ownership plus its regression witnesses. Concurrency, resource lifetime and cancellation are touched. API signatures and persisted schemas are unchanged. Selected executor: codex, write role sensitive resolved through leaf-launch.sh and the model registry. No history fork is needed. The root integrates, arbitrates, verifies and commits in the adopting run.

Implement O1–O3 together so every retirement path and every barrier ships with its witnesses. Prefer the existing platform-neutral test module for common lifetime behavior. OS-specific WAL fixtures may stay platform-gated, but the central ownership and error/retry witnesses must run on Linux, macOS and Windows. Read async-resource-invariants.md, pgn-scanning.md and ipc-events.md before writing. No other source files are assigned.

Exact phase proof: `cargo test --manifest-path src-tauri/Cargo.toml db::repository:: -- --test-threads=1 && pnpm checks:pre-review`. Keep new regressions present while reverting only the task-owned production fix from its Git diff, record the expected assertion failures, restore, and rerun green. The adopter owns that proof, not the read-only planner.

After implementation and cumulative diff review, run `pnpm build && pnpm verify:app --screenshot /tmp/drain-plan-chessfable-0a459a4f-slot1/build/verify-ui/retirement-app.png` for real app startup/IPC/shutdown integration. It complements the deterministic Rust SQLite retirement witnesses, it does not directly prove the LRU race. No new standalone verifier is planned.

Final affected push gates: `pnpm gates:push -- --rust`, through the canonical detached push-gate route on the final clean HEAD. It includes backend tests/coverage, fmt/clippy, Windows compile checks, contract and kit parity. No ratchet changes. The release also requires `pnpm ci:remote:check` and successful rust-windows-test, rust-macos-test and rust-platform jobs on the pushed SHA. Run the project push skill, then verify HEAD equals upstream and applicable installation. Record the autonomous decisions and complete review handoff before final gates. Close f-20260930-01 only through findings.py after verified implementation.

## Carried to diff review

None.

## Reviews

### Round 1

Elapsed 598.5 seconds, adopted substantive issues 2. Active arbitration time and quota waits were not separately measured. No dependency wait was required. All 12 plan-capable lenses ran. The class-absent exits for chess-semantics, engine-protocol, ipc-contract, persisted-state and pgn-index are accepted against this backend resource-lifetime mandate.

I1 — platform-semantics r1 finding 1, should-fix, confidence 94. Fix adopted, awaiting closure. canonical_binding at path_authority/mod.rs:2073 preserves the leaf spelling. O1/O2 now retain and match parent identity instead of trusting path bytes. Same-parent retirement backpressure is an explicit technical trade-off. Dependencies: none.

I2 — plan r1 finding 1, blocker, confidence 90. Fix adopted, awaiting closure. repository.rs:753 and :986 allow lock-only caching with min_idle 0, :950 returns that cached entry and :1175 reaches establishment through get_connection. O2 now covers cached acquisition and actual worker establishment, with lifecycle witnesses. Dependencies: none.

Plan authorship and arbitration shared one context. Detection ran on the same model family selected for code execution. Codex role routing used review-plan for the plan lens and sensitive for the remaining applicable lenses. No source edits or runtime verification occurred.

#### Raw lens-correctness-r1

```text
No correctness defects found in O1–O3’s stated contracts.

Limitation: this is plan-only review. Reservation rechecks, capacity handling and teardown ordering require verification against the implementation (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-error-handling-r1

```text
VERDICT: APPROVED
```

#### Raw lens-minimalism-r1

```text
VERDICT: APPROVED
```

#### Raw lens-plan-r1

```text
[blocker] tasks/plans/2026-10-09-lru-sqlite-retirement.md:52 — O2 omits connection acquisition from an already cached replacement pool. Lock-only callers can cache a pool without opening SQLite (`src-tauri/src/db/repository.rs:753`, `:986`). Different identities at the same path have different keys (`:372`), so that replacement can remain cached when the old entry is later LRU-evicted. A subsequent acquisition returns the cached entry (`:950`) and calls `get_connection` (`:1175`), which can establish SQLite (`:263`) without passing through pool construction. The proposed boundaries therefore leave the same-path successor-open guarantee at plan line 56 unenforced. Cover cached acquisitions and require a lifecycle witness where the replacement is cached before predecessor eviction. (confidence: 90)

VERDICT: REVISE
```

#### Raw lens-tests-r1

```text
No findings. O1–O3 specify Rust lifecycle assertions that would fail on revert, including real LRU eviction, blocked successor opens/unlink, and retained barriers after cancellation or timeout. The repository selector and platform CI jobs include the proposed tests.

Limitation: this approves the planned proof. Implementation assertions and actual revert failures remain unverified (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-chess-semantics-r1

```text
NOT APPLICABLE: The assigned repository file and O1–O3 obligations concern SQLite connection retirement and drain ownership. They do not involve in-memory chess trees, positions, or move paths.
VERDICT: APPROVED
```

#### Raw lens-engine-protocol-r1

```text
NOT APPLICABLE: The sole file and O1–O3 obligations concern SQLite connection retirement, reopen, and deletion barriers. They do not involve engine process supervision, UCI protocol state, or asynchronous engine result routing.
VERDICT: APPROVED
```

#### Raw lens-ipc-contract-r1

```text
NOT APPLICABLE: O1–O3 cover internal SQLite retirement ownership and drain barriers in `src-tauri/src/db/repository.rs`. The plan changes no Rust↔renderer event, command, payload, subscription, capability scope, or shutdown contract.

VERDICT: APPROVED
```

#### Raw lens-persisted-state-r1

```text
NOT APPLICABLE: The assigned file is a Rust database repository. O1–O3 concern SQLite connection retirement and drain barriers, with no renderer storage keys, persisted atoms, hydration, or tab lifecycle changes.
VERDICT: APPROVED
```

#### Raw lens-pgn-index-r1

```text
NOT APPLICABLE: O1–O3 in `src-tauri/src/db/repository.rs` concern SQLite connection retirement and reopen/delete barriers. They do not change PGN byte scanning, offsets, move encoding, stored indexes, or search predicates.

VERDICT: APPROVED
```

#### Raw lens-platform-semantics-r1

```text
[should-fix] tasks/plans/2026-10-09-lru-sqlite-retirement.md:52 — On case-insensitive Windows filesystems, replacing `GameCase.db3` and authorizing its successor as `gamecase.db3` changes the object identity while preserving unequal canonical path spellings. `canonical_binding` preserves leaf casing (`src-tauri/src/infra/path_authority/mod.rs:2073`), so the proposed matching rule can miss the draining predecessor. Require filesystem-compatible name equivalence and a replacement witness using different casing at reopen, revision-read and deletion boundaries. (confidence: 94)

Limitation: This was a source-only plan review. No Windows compile check, non-Linux Unix source probe or runtime tests ran. Native runtime proof remains `rust-windows-test` and `rust-macos-test`. The `rust-platform` matrix supplies clippy/compile proof.

VERDICT: REVISE
```

#### Raw lens-tauri-security-r1

```text
No security-boundary defects found in O1–O3. The obligations retain predecessor ownership through SQLite close, fence reopen and unlink, and preserve barriers after cancellation or timeout.

Limitation: this is plan review only. Implementation and lifecycle witnesses remain unverified. Credential, session and signed-download flows are absent from the assigned change.

VERDICT: APPROVED
```


### Round 2

Elapsed 360.4 seconds, adopted substantive corrections 2 (I2 residual verification and I3 typed failure). I4 changes the review record only and is excluded from substantive adoption counts. Active arbitration time and quota waits were not separately measured. No dependency wait was required. Plan, platform-semantics, correctness, minimalism, tests and error-handling ran.

I1 — Fix closed at r2 by its platform witness and review-plan. Authority: frozen threat model includes authority-valid same-path replacement and aliases on Linux, macOS and Windows. Object OR retained-parent matching corrects the authority-spelling gap without changing pool keys. Source confirmation: repository.rs:1286 derives parent identity from its retained parent handle, path_authority/mod.rs:3706 supplies Unix device/inode or Windows handle identity.

I2 — Fix remains open at r2. review-plan r2 finding 1 is a residual blocker at confidence 90 and becomes a second witness of I2. Correctness and tests approved the establishment boundary, but review-plan found the predecessor self-ticket exception lacked its own executable witness. Confirmed repository.rs:257 admits its ticket before :263 establishes SQLite, and :197 can wait on that ticket until deadline if its own retired gate is included. Add the synchronized admitted-predecessor worker witness in O2. Authority: MANDATE names outstanding connection tickets and r2d2 replenishment as the concrete retirement trigger. Dependencies: none. First failed closure check for this lineage, no mechanism rewrite.

I3 — error-handling r2 finding 1, should-fix, confidence 90. Fix adopted, awaiting closure. Lineage: I2, correction-introduced establishment boundary. Dependencies: I2. Source confirmation: repository.rs:1656 maps pool.get through Error::from, :1297 preserves the original error when the target is valid. r2d2 0.8.10 src/lib.rs:273 stores a manager failure as text and retries. error.rs:447 maps R2d2 to Database. Authority: the frozen threat model includes cancellation and drain timeout, O3 preserves their existing safe failure behavior. Correct O2/O3 so worker barrier failure remains typed Conflict or Cancellation for the waiting operation, with no string-based classification or cross-caller contamination. No new IPC category or Error variant is required.

I4 — plan r2 finding 2, should-fix, confidence 100. Fix adopted, awaiting review-plan closure. Dependencies: I1, I2. The r1 rows omitted explicit Authority fields for the new matching and establishment mechanisms. The following additive supplement preserves the original history and records those authorities. No behavior change and no substantive adoption count.

| R1 issue | Authority | Evidence | Necessary correction |
| --- | --- | --- | --- |
| I1 | Frozen threat model: authority-valid same-path replacement and aliases on Linux, macOS and Windows. MANDATE: "same file". | path_authority/mod.rs:2078 appends the unchanged leaf spelling. repository.rs:1286 retains parent identity. | Match object OR parent identity so alias-spelled replacement cannot miss its predecessor. |
| I2 | MANDATE: r2d2 add_connection can retain a live or in-flight SQLite handle, and later deletion must drain it. Frozen threat model includes r2d2 replenishment workers. | repository.rs:753 and :986 cache an unopened pool, :950 returns it, :1175 and :263 establish later. | Fence cached and actual asynchronous establishment as well as construction. |

Plan authorship and arbitration shared one context. Detection ran on the same model family selected for code execution. No source edits or runtime verification occurred.

#### Raw lens-plan-r2

```text
CLOSED: I1 — Candidate O2 matches retained parent identity (`tasks/plans/2026-10-09-lru-sqlite-retirement.md:52`, `src-tauri/src/db/repository.rs:1286`), covering spelling differences preserved by `src-tauri/src/infra/path_authority/mod.rs:2078`.

STILL OPEN: I2 — The corrected boundaries include cached acquisition and manager establishment, but verification omits the added predecessor-worker self-ticket exception.

[blocker] tasks/plans/2026-10-09-lru-sqlite-retirement.md:58 — I2’s witnesses delay a successor worker and hold an established predecessor handle. Neither exercises a predecessor worker paused after ticket admission but before establishment (`src-tauri/src/db/repository.rs:257–263`). If retirement publishes that worker’s gate before it resumes, a barrier that waits on its own ticket stalls until timeout (`src-tauri/src/db/repository.rs:197`). Require a synchronized witness proving this worker completes or safely refuses establishment without waiting for its own ticket. The currently specified witnesses would not reject that implementation. (confidence: 90)

[should-fix] tasks/plans/2026-10-09-lru-sqlite-retirement.md:114 — The I1 and I2 adoption rows lack the required `Authority` entries. Classify the directory-wide matching and manager-establishment fencing as necessary correctness work against MANDATE, citing the spelling preservation and asynchronous establishment paths (`src-tauri/src/infra/path_authority/mod.rs:2078`, `src-tauri/src/db/repository.rs:256`). (confidence: 100)

Limitation: Source-only review. Implementation, runtime behavior and revert failures remain unverified (confidence: 100).

VERDICT: REVISE
```

#### Raw lens-platform-semantics-r2

```text
CLOSED: I1 — O1/O2 match object identity OR retained parent identity, covering differently spelled replacements on Windows and macOS. `repository.rs:1286` obtains parent identity from the retained handle. `path_authority/mod.rs:3706` uses Unix device/inode or Windows volume/file index. O2 requires casing-alias witnesses across acquisition, revision and deletion boundaries.

NOT MY CLASS: I2 — closure belongs to review-plan.

No new platform findings.

Limitation: source-only plan review. No tests, `pnpm rust:windows:check`, or non-Linux Unix source probe ran. Planned native runtime proof is `rust-windows-test` and `rust-macos-test`. The `rust-platform` matrix provides compile/clippy proof, including `-D warnings`.

VERDICT: APPROVED
```

#### Raw lens-correctness-r2

```text
CLOSED: I1 — O1/O2 match object OR retained parent identity, covering replacement spelling aliases with explicit same-parent blocking.

CLOSED: I2 — O2 fences cached acquisition and actual replenishment establishment, including self-ticket safety and reservation rechecks.

No correctness defects found in the revised contracts.

Limitation: plan-only review. Atomic publication, worker admission ordering, bounded capacity and timeout recovery remain implementation proof obligations (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-minimalism-r2

```text
NOT MY CLASS: I1 — platform-semantics owns alias-matching closure.
NOT MY CLASS: I2 — review-plan owns cached-acquisition and worker-establishment closure.

No bloat or duplication findings. The revised boundaries address concrete retirement bypasses. Shared ownership and matching have multiple required callers, and parent-identity matching avoids introducing filesystem-specific name equivalence machinery.

Limitation: implementation size and helper duplication remain unassessable until a source diff exists (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-tests-r2

```text
CLOSED: I1 — verification coverage now requires spelling-alias replacement witnesses at cached acquisition, revision and deletion boundaries, plus same-parent blocking and different-parent progress.

CLOSED: I2 — verification coverage now includes a replacement cached before eviction and delayed successor replenishment. The required assertion forbids actual successor SQLite establishment before predecessor close, so restoring either bypass would fail.

No verification findings. O1–O3 name Rust lifecycle assertions for real LRU retirement, bounded retention, protected-open/unlink ordering, and cancellation/timeout retry safety. The repository selector and platform CI test commands include the proposed witnesses. The plan explicitly requires keeping regression tests while reverting production changes and recording assertion failures.

Limitation: this closes the planned verification contracts only. Test implementations and actual revert failures remain unverified (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-error-handling-r2

```text
NOT MY CLASS: I1 — filesystem matching closure belongs to platform-semantics.
NOT MY CLASS: I2 — establishment-boundary closure belongs to plan.

[should-fix] tasks/plans/.plan-2026-10-09-lru-sqlite-retirement.md-r2.body.md:54 — O2 adds connection-manager barrier failures without specifying their typed caller outcome. When a delayed worker times out behind a predecessor while the target remains valid, r2d2 stringifies and retries its error. The existing `get_connection` path returns `Error::R2d2`, classification preserves it, and IPC surfaces category `database` with “database failure”. Require predecessor timeout/cancellation classification to survive this boundary, with a failure witness. O1’s explicit Cancellation/Conflict requirement covers capacity exhaustion only. (confidence: 90)

VERDICT: APPROVED
```


### plan-r4.md

# Plan: retain and drain LRU-evicted SQLite connections

## Goal

Resolve f-20260930-01 so an LRU-evicted pool cannot close SQLite handles after a later deletion or successor open of the same database. This is a PLAN-ONLY run at BASE 8ebc643ef5569b29f269415a7b2f958c1e4e78c2. Implementation belongs to the adopting session.

## MANDATE

### LRU eviction drops a database entry without draining its SQLite connections, so one can close after a later delete of the same file

* **ID:** f-20260930-01 · **Status:** open · **Area:** db-search · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/db/repository.rs` `evict_idle_entries` (~line 973, called under the repository state lock from `entry()` ~915); `close_retired_entry` (~952) and `DrainGate` (~109) are the drain every other retirement path uses since `3ed94336`.
* **Defect:** eviction removes an idle entry (`Arc::strong_count == 1`, no lease, not retiring) from `RepositoryState.entries` and drops it without closing its connection gate or waiting for outstanding connection tickets. An r2d2 `add_connection` job started by an earlier `get` can still hold an upgraded pool reference and a live or in-flight SQLite handle (the f-20260929-07 mechanism). A later `delete_exclusive_cancellable` of the same file then finds no entry, drains nothing, and unlinks while that handle is still open. The window is small (a replenishment job outliving the `get` that spawned it), reported by the repair leaf of the 2026-09-30 push review.
* **Why it matters:** it is the last retirement path that can close an SQLite handle (and unlink WAL/SHM) after the file was deleted or replaced, which every other path now excludes.
* **Proposed fix:** close the evicted entry's connection gate and drop its pool at eviction without blocking under the state lock, and keep the evicted gates reachable (for example a per-key list of draining gates in `RepositoryState`) so `delete_exclusive_inner` and `entry()` rebuild wait on them through `DrainGate::wait_drained` before unlinking or opening a fresh pool.
* **Open question:** where do evicted-but-draining gates live and who prunes them — a per-key list in `RepositoryState` pruned on drain, or eviction deferred to a path that may block — without holding the state lock across a wait?
* **Found by:** Codex write leaf (repair of the `8b97e423` push review), out-of-scope report; confirmed by the orchestrator from source, 2026-09-30. Related: `f-20260929-07`.

## Threat model and non-goals

Ordinary concurrent native database operations, r2d2 replenishment workers, cancellation, drain timeout, authority-valid same-path replacement and aliases on Linux, macOS and Windows. Preserve existing authority checks and bound VFS behavior. No new protection against malicious pathname churn, new cross-capability lifetime protocol, pool-key merger, hard-link WAL redesign, background service, watcher, shutdown redesign, or new renderer behavior.

## Traced premises

Frozen source trace at BASE, confirmed by the root and locate probe-1-r1:

* `repository.rs:1091` selects idle sole-owner LRU entries and removes them under the state mutex.
* `repository.rs:135`, `:252` and `:223` give each pooled SQLite open a ticket from before establishment until after SQLite and its binding close.
* r2d2 0.8.10 `src/lib.rs:230` upgrades a weak pool on its worker before connect and retains it through publication.
* `repository.rs:1664` closes connection admission and drops the pool before draining.
* `repository.rs:1070` removes a retired entry even if its drain returns an error, losing future lookup of that gate.
* `repository.rs:868` deletion reserves the canonical path but drains only the exact current entry.
* `repository.rs:929` owns pool construction through the building set and BuildGuard.
* `repository.rs:684` also opens a transient bound revision connection without constructing a pool.
* `repository.rs:372` keys pools by object, parent and path. `bound_sqlite.rs:188` reuses bindings, it does not drain predecessor connections.
* `db/mod.rs:2870` and `puzzle.rs:646` execute descriptor-bound unlink inside the repository deletion barrier.
* `repository.rs:2603`, `:2762`, `:2789`, `:2809`, and `:4855` contain cancellation, timeout, LRU and VFS/sidecar lifetime witnesses.
* `path_authority/mod.rs:962` supplies platform-neutral test targets. Most existing repository lifecycle tests are Unix-only at `repository.rs:1799`. The bound SQLite witness module at `:3293` is platform-neutral.

## Approach

### O1 — publish and bound predecessor ownership

Derived from MANDATE “keep the evicted gates reachable” and “without blocking under the state lock”. RepositoryState owns a bounded set of retirement records identified by predecessor object and retained parent identity. Limit records, including capacity reservations, to MAX_OPEN_DATABASES (16). Publish ownership and close new connection admission atomically with removing the eligible LRU entry. Keep its teardown visibly outstanding until pool and entry disposal have completed outside the repository state mutex. A zero count must prove that no evictor still owns a pool awaiting disposal, as well as that SQLite has closed every admitted handle.

Only closed, fully drained records may be pruned. Prune completed records opportunistically at retirement/admission boundaries, including when a different database is accessed, so churn through never-revisited names cannot accumulate records. Capacity exhaustion applies bounded cancellable backpressure outside the state mutex, returning Cancellation or Conflict on failure before losing a resource or publishing a cache entry whose required eviction cannot be owned. Preserve the existing active-lease LRU exception. No unrestricted per-key history and no background cleanup.

Verification level: deterministic Rust concurrency witnesses through real LRU selection. Assert the entry is eligible without an entry Arc or caller lease artificially pinning it, that connection admission closes, and that retirement ownership remains visible while an actual SQLite handle is held. An unrelated database operation in a different retained parent must still finish while predecessor teardown waits. Churn and saturation witnesses assert the record bound and recovery after tickets close.

### O2 — enforce the predecessor barrier at reopen and deletion

Derived from MANDATE “before unlinking or opening a fresh pool” and “same file”. Match retired predecessors by the same object identity OR the same retained parent identity, retaining the existing pool key and authority checks. Parent matching conservatively fences all retired predecessors in that directory. It catches replacements whose authority-valid leaf spelling changes on case-insensitive or Unicode-normalizing filesystems without inventing a string equivalence rule. It deliberately delays otherwise unrelated opens in that parent until its retired predecessors drain, never live pools in that parent.

Pool construction, connection acquisition from already cached pools, transient revision opens and the delete reservation must drain every matching predecessor before any corresponding SQLite establishment or unlink callback. Cover actual connection-manager establishment, including delayed r2d2 replenishment from a previously cached pool, so fencing synchronous acquisition alone cannot leave a worker bypass. Reuse one retirement matching/wait/pruning contract at those boundaries. An already admitted worker belonging to the retiring predecessor must not wait on its own connection ticket. Preserve its existing close ordering and count it in that predecessor's drain, or refuse its open safely after admission closes. No repository ownership cycle may be introduced through pool managers.

Waits release the repository state mutex. Coordinate their publication and recheck with the existing construction and deletion reservations so a newly published matching retirement cannot slip between the wait and protected operation. Keep active-lease conflicts and avoid waiting on a lease held by the same caller. Use one absolute deadline for each predecessor-barrier operation, not a fresh full timeout per predecessor or loop. Cancellation remains effective before destructive work begins. BoundDatabase lifetime and close ordering remain intact.

At every boundary, predecessor timeout returns the existing Error::Conflict and caller cancellation returns Error::Cancellation. Preserve that typed, operation-scoped result through cached acquisition even when r2d2 transports and retries manager errors as text. Do not infer the category by parsing those strings or let one caller's cancellation poison another caller or a later retry. A pool acquisition must not consume a second timeout after the predecessor deadline expires. No new public error category is required.

Verification level: synchronized Rust witnesses assert that same-key reopen, same-path replacement, same-object alias and deletion cannot establish a successor handle or run the unlink callback until the predecessor closes. Include a replacement cached by a lock-only caller before the predecessor is LRU-evicted, then acquired afterward, and a delayed successor-pool replenishment worker crossing that retirement boundary. Include the transient revision boundary. On filesystems accepting spelling aliases, replace GameCase.db3 and authorize gamecase.db3, then witness cached acquisition, revision and deletion barriers. Assert conservative same-parent blocking and different-parent progress. A real WAL fixture proves the predecessor's final close occurs before the successor's WAL/SHM can exist, and the successor remains queryable with its sidecars intact.

Also pause a real predecessor replenishment worker after its connection ticket is admitted but before SQLite establishment, make its entry genuinely LRU-eligible, publish retirement, and resume it. Synchronize at those lifecycle boundaries. Assert the worker completes or safely refuses establishment without waiting for its own ticket or the retirement deadline, releases the ticket, and allows the predecessor drain and successor barrier to finish. Keeping the regression while restoring self-waiting manager behavior must fail its completion/order assertion.

### O3 — retain barriers after incomplete drains

Derived from MANDATE “where evicted-but-draining gates live and who prunes them”. Timeout or cancellation must never discard or reopen a retired predecessor's connection gate. Release the waiting operation's temporary reservations, preserve predecessor ownership, and refuse its SQLite open or unlink. A retry after closure succeeds and removes completed bookkeeping.

Route LRU and the existing close_retired_entry removal through shared predecessor ownership. This also closes the same mechanism exposed when close_retired_entry currently removes an undrained gate on timeout or cancellation. Caller-lease cancellation before connection retirement keeps today's admission restoration. After connection retirement begins, reopening the caller lease must not make a retired pool reusable or remove its predecessor barrier.

Verification level: deterministically cancel during the connection-drain phase, and inject the shorter per-repository timeout. Assert no protected operation ran, an undrained predecessor remains discoverable, subsequent reopen/delete still waits or fails closed, and retry succeeds once the held connection is released.

Exercise cancellation and timeout after cached-pool worker establishment reaches a predecessor barrier, with the target remaining authority-valid. Assert the caller receives Cancellation/cancellation or Conflict/conflict (Rust variant and existing ErrorCategory), never R2d2/database. Assert a separately waiting healthy caller and a later retry remain independent and succeed after the predecessor closes. These witnesses must fail if the typed boundary result is replaced by the generic pool error.

For those actual cached/worker failure witnesses, also assert bounded completion for timeout and cancellation. Capture the elapsed-time origin before spawning the acquisition or release/cancellation child, then synchronize actual predecessor-barrier entry. Keep the predecessor held until the outcome assertion. Use the injected short predecessor deadline and an explicit scheduling allowance whose completion bound is strictly below the additional configured pool timeout. Assert timeout completion uses the original operation budget and cancellation returns promptly after its synchronized signal. Include multiple matching predecessors or a reservation recheck to reject refreshed budgets. Restoring a second full pool timeout or deferring cancellation through that timeout must fail the elapsed-time/completion assertion even if the eventual error category is correct. Preserve d-20261008-29's pre-spawn timing origin.

## Decisions and trade-offs

Entry remains build. The recorded decisions settle keying, authority, timeout and test synchronization, but none settles evicted-gate ownership and bounded retention.

Preserve d-20260904-01's injectable 60-second production timeout, d-20260913-02's pool key, d-20260913-03's lease-safe retirement, d-20260929-04's VFS authority, d-20260929-05's cross-directory refusal, and d-20261008-29/-30's synchronized test timing. O3 extends failed-drain safety, it does not reverse those decisions.

## Decided autonomously

* Question: Who owns evicted-but-draining gates and when are they pruned? Chosen: bounded repository retirement records using existing connection tickets, synchronous disposal outside the state mutex and opportunistic completed-record pruning. Rejected: evictor-local ownership alone (concurrent delete/reopen loses the barrier), an unbounded per-key list, or a background reaper. Reason: MANDATE requires future lookups and bounded retention, and no new process is needed. Reversal path: replace the registry only with a protocol proving the same lookup, capacity, failure and teardown-order invariants.
* Question: Does a fresh revision read count as a reopen? Chosen: yes, apply the same retired-predecessor barrier at read_revision without creating a pool. Rejected: fencing pool construction alone. Reason: a revision read is another SQLite establishment against the same authority-bound file. Reversal path: remove that barrier only if transient revision establishment can no longer overlap an evicted predecessor.
* Question: May close_retired_entry forget a gate after timeout or cancellation? Chosen: no, retain its undrained predecessor through the shared ownership contract. Rejected: removing the entry and forgetting its gate. Reason: a later delete can otherwise reproduce the same post-unlink close that MANDATE forbids. Reversal path: demonstrate another authoritative owner consulted by every future reopen/delete before removing this retention.
* Question: How are replacement names matched across filesystems? Chosen: same object OR retained parent identity, using authority identities already in EntryKey. Rejected: canonical path bytes or a new case-folding approximation. Reason: canonical_binding preserves the leaf's spelling and byte comparison can miss a replacement alias. Conservatively waiting for retired predecessors in the same parent gives a portable guarantee with bounded state. Reversal path: narrow parent matching only with authority-backed filesystem name equivalence and replacement witnesses on every supported platform.
* Question: Is construction the only pooled establishment boundary? Chosen: no, cached acquisition and actual manager establishment also use the predecessor barrier. Rejected: assuming every get creates a fresh pool. Reason: lock-only callers can cache a pool before its first SQLite connection and replenishment runs asynchronously. Reversal path: remove a boundary only if that path can no longer establish SQLite after predecessor retirement.

## Risks / open questions

No product decision is needed. The code executor owns private helper names and test placement within the reviewed obligations. Preserve the known hard-link WAL and cross-capability hazards as separate findings f-20260929-05 and f-20261001-02. This plan covers retired predecessor barriers, not concurrent live alias pools or all transient-reader lifetimes.

Locate confirmed Codex CLI 0.162.0 and the cargo, pnpm, agent-gate, WebKitWebDriver, tauri-driver and kwin_wayland binaries. The planner worktree has no node_modules and runs no install or runtime proofs. Adoption must run pnpm install --frozen-lockfile, recheck the exact released-kit parity and runtime prerequisites, and use the shared gate wrappers. Existing verify:app comments record unrelated failure history. Current runtime status is unmeasured, not green evidence.

## Not part of this task

Other db-search siblings remain open at their recorded tiers. No frontend, Specta signature, binding, schema, dependency, capability, VFS implementation or deletion-outcome change is planned. No claim of implemented or runtime-verified behavior is made by this planner.

## Phases

One cohesive sensitive phase owns `src-tauri/src/db/repository.rs`, production ownership plus its regression witnesses. Concurrency, resource lifetime and cancellation are touched. API signatures and persisted schemas are unchanged. Selected executor: codex, write role sensitive resolved through leaf-launch.sh and the model registry. No history fork is needed. The root integrates, arbitrates, verifies and commits in the adopting run.

Implement O1–O3 together so every retirement path and every barrier ships with its witnesses. Prefer the existing platform-neutral test module for common lifetime behavior. OS-specific WAL fixtures may stay platform-gated, but the central ownership and error/retry witnesses must run on Linux, macOS and Windows. Read async-resource-invariants.md, pgn-scanning.md and ipc-events.md before writing. No other source files are assigned.

Exact phase proof: `cargo test --manifest-path src-tauri/Cargo.toml db::repository:: -- --test-threads=1 && pnpm checks:pre-review`. Keep new regressions present while reverting only the task-owned production fix from its Git diff, record the expected assertion failures, restore, and rerun green. The adopter owns that proof, not the read-only planner.

After implementation and cumulative diff review, run `pnpm build && pnpm verify:app --screenshot /tmp/drain-plan-chessfable-0a459a4f-slot1/build/verify-ui/retirement-app.png` for real app startup/IPC/shutdown integration. It complements the deterministic Rust SQLite retirement witnesses, it does not directly prove the LRU race. No new standalone verifier is planned.

Final affected push gates: `pnpm gates:push -- --rust`, through the canonical detached push-gate route on the final clean HEAD. It includes backend tests/coverage, fmt/clippy, Windows compile checks, contract and kit parity. No ratchet changes. The release also requires `pnpm ci:remote:check` and successful rust-windows-test, rust-macos-test and rust-platform jobs on the pushed SHA. Run the project push skill, then verify HEAD equals upstream and applicable installation. Record the autonomous decisions and complete review handoff before final gates. Close f-20260930-01 only through findings.py after verified implementation.

## Carried to diff review

None.

## Reviews

### Round 1

Elapsed 598.5 seconds, adopted substantive issues 2. Active arbitration time and quota waits were not separately measured. No dependency wait was required. All 12 plan-capable lenses ran. The class-absent exits for chess-semantics, engine-protocol, ipc-contract, persisted-state and pgn-index are accepted against this backend resource-lifetime mandate.

I1 — platform-semantics r1 finding 1, should-fix, confidence 94. Fix adopted, awaiting closure. canonical_binding at path_authority/mod.rs:2073 preserves the leaf spelling. O1/O2 now retain and match parent identity instead of trusting path bytes. Same-parent retirement backpressure is an explicit technical trade-off. Dependencies: none.

I2 — plan r1 finding 1, blocker, confidence 90. Fix adopted, awaiting closure. repository.rs:753 and :986 allow lock-only caching with min_idle 0, :950 returns that cached entry and :1175 reaches establishment through get_connection. O2 now covers cached acquisition and actual worker establishment, with lifecycle witnesses. Dependencies: none.

Plan authorship and arbitration shared one context. Detection ran on the same model family selected for code execution. Codex role routing used review-plan for the plan lens and sensitive for the remaining applicable lenses. No source edits or runtime verification occurred.

#### Raw lens-correctness-r1

```text
No correctness defects found in O1–O3’s stated contracts.

Limitation: this is plan-only review. Reservation rechecks, capacity handling and teardown ordering require verification against the implementation (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-error-handling-r1

```text
VERDICT: APPROVED
```

#### Raw lens-minimalism-r1

```text
VERDICT: APPROVED
```

#### Raw lens-plan-r1

```text
[blocker] tasks/plans/2026-10-09-lru-sqlite-retirement.md:52 — O2 omits connection acquisition from an already cached replacement pool. Lock-only callers can cache a pool without opening SQLite (`src-tauri/src/db/repository.rs:753`, `:986`). Different identities at the same path have different keys (`:372`), so that replacement can remain cached when the old entry is later LRU-evicted. A subsequent acquisition returns the cached entry (`:950`) and calls `get_connection` (`:1175`), which can establish SQLite (`:263`) without passing through pool construction. The proposed boundaries therefore leave the same-path successor-open guarantee at plan line 56 unenforced. Cover cached acquisitions and require a lifecycle witness where the replacement is cached before predecessor eviction. (confidence: 90)

VERDICT: REVISE
```

#### Raw lens-tests-r1

```text
No findings. O1–O3 specify Rust lifecycle assertions that would fail on revert, including real LRU eviction, blocked successor opens/unlink, and retained barriers after cancellation or timeout. The repository selector and platform CI jobs include the proposed tests.

Limitation: this approves the planned proof. Implementation assertions and actual revert failures remain unverified (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-chess-semantics-r1

```text
NOT APPLICABLE: The assigned repository file and O1–O3 obligations concern SQLite connection retirement and drain ownership. They do not involve in-memory chess trees, positions, or move paths.
VERDICT: APPROVED
```

#### Raw lens-engine-protocol-r1

```text
NOT APPLICABLE: The sole file and O1–O3 obligations concern SQLite connection retirement, reopen, and deletion barriers. They do not involve engine process supervision, UCI protocol state, or asynchronous engine result routing.
VERDICT: APPROVED
```

#### Raw lens-ipc-contract-r1

```text
NOT APPLICABLE: O1–O3 cover internal SQLite retirement ownership and drain barriers in `src-tauri/src/db/repository.rs`. The plan changes no Rust↔renderer event, command, payload, subscription, capability scope, or shutdown contract.

VERDICT: APPROVED
```

#### Raw lens-persisted-state-r1

```text
NOT APPLICABLE: The assigned file is a Rust database repository. O1–O3 concern SQLite connection retirement and drain barriers, with no renderer storage keys, persisted atoms, hydration, or tab lifecycle changes.
VERDICT: APPROVED
```

#### Raw lens-pgn-index-r1

```text
NOT APPLICABLE: O1–O3 in `src-tauri/src/db/repository.rs` concern SQLite connection retirement and reopen/delete barriers. They do not change PGN byte scanning, offsets, move encoding, stored indexes, or search predicates.

VERDICT: APPROVED
```

#### Raw lens-platform-semantics-r1

```text
[should-fix] tasks/plans/2026-10-09-lru-sqlite-retirement.md:52 — On case-insensitive Windows filesystems, replacing `GameCase.db3` and authorizing its successor as `gamecase.db3` changes the object identity while preserving unequal canonical path spellings. `canonical_binding` preserves leaf casing (`src-tauri/src/infra/path_authority/mod.rs:2073`), so the proposed matching rule can miss the draining predecessor. Require filesystem-compatible name equivalence and a replacement witness using different casing at reopen, revision-read and deletion boundaries. (confidence: 94)

Limitation: This was a source-only plan review. No Windows compile check, non-Linux Unix source probe or runtime tests ran. Native runtime proof remains `rust-windows-test` and `rust-macos-test`. The `rust-platform` matrix supplies clippy/compile proof.

VERDICT: REVISE
```

#### Raw lens-tauri-security-r1

```text
No security-boundary defects found in O1–O3. The obligations retain predecessor ownership through SQLite close, fence reopen and unlink, and preserve barriers after cancellation or timeout.

Limitation: this is plan review only. Implementation and lifecycle witnesses remain unverified. Credential, session and signed-download flows are absent from the assigned change.

VERDICT: APPROVED
```


### Round 2

Elapsed 360.4 seconds, adopted substantive corrections 2 (I2 residual verification and I3 typed failure). I4 changes the review record only and is excluded from substantive adoption counts. Active arbitration time and quota waits were not separately measured. No dependency wait was required. Plan, platform-semantics, correctness, minimalism, tests and error-handling ran.

I1 — Fix closed at r2 by its platform witness and review-plan. Authority: frozen threat model includes authority-valid same-path replacement and aliases on Linux, macOS and Windows. Object OR retained-parent matching corrects the authority-spelling gap without changing pool keys. Source confirmation: repository.rs:1286 derives parent identity from its retained parent handle, path_authority/mod.rs:3706 supplies Unix device/inode or Windows handle identity.

I2 — Fix remains open at r2. review-plan r2 finding 1 is a residual blocker at confidence 90 and becomes a second witness of I2. Correctness and tests approved the establishment boundary, but review-plan found the predecessor self-ticket exception lacked its own executable witness. Confirmed repository.rs:257 admits its ticket before :263 establishes SQLite, and :197 can wait on that ticket until deadline if its own retired gate is included. Add the synchronized admitted-predecessor worker witness in O2. Authority: MANDATE names outstanding connection tickets and r2d2 replenishment as the concrete retirement trigger. Dependencies: none. First failed closure check for this lineage, no mechanism rewrite.

I3 — error-handling r2 finding 1, should-fix, confidence 90. Fix adopted, awaiting closure. Lineage: I2, correction-introduced establishment boundary. Dependencies: I2. Source confirmation: repository.rs:1656 maps pool.get through Error::from, :1297 preserves the original error when the target is valid. r2d2 0.8.10 src/lib.rs:273 stores a manager failure as text and retries. error.rs:447 maps R2d2 to Database. Authority: the frozen threat model includes cancellation and drain timeout, O3 preserves their existing safe failure behavior. Correct O2/O3 so worker barrier failure remains typed Conflict or Cancellation for the waiting operation, with no string-based classification or cross-caller contamination. No new IPC category or Error variant is required.

I4 — plan r2 finding 2, should-fix, confidence 100. Fix adopted, awaiting review-plan closure. Dependencies: I1, I2. The r1 rows omitted explicit Authority fields for the new matching and establishment mechanisms. The following additive supplement preserves the original history and records those authorities. No behavior change and no substantive adoption count.

| R1 issue | Authority | Evidence | Necessary correction |
| --- | --- | --- | --- |
| I1 | Frozen threat model: authority-valid same-path replacement and aliases on Linux, macOS and Windows. MANDATE: "same file". | path_authority/mod.rs:2078 appends the unchanged leaf spelling. repository.rs:1286 retains parent identity. | Match object OR parent identity so alias-spelled replacement cannot miss its predecessor. |
| I2 | MANDATE: r2d2 add_connection can retain a live or in-flight SQLite handle, and later deletion must drain it. Frozen threat model includes r2d2 replenishment workers. | repository.rs:753 and :986 cache an unopened pool, :950 returns it, :1175 and :263 establish later. | Fence cached and actual asynchronous establishment as well as construction. |

Plan authorship and arbitration shared one context. Detection ran on the same model family selected for code execution. No source edits or runtime verification occurred.

#### Raw lens-plan-r2

```text
CLOSED: I1 — Candidate O2 matches retained parent identity (`tasks/plans/2026-10-09-lru-sqlite-retirement.md:52`, `src-tauri/src/db/repository.rs:1286`), covering spelling differences preserved by `src-tauri/src/infra/path_authority/mod.rs:2078`.

STILL OPEN: I2 — The corrected boundaries include cached acquisition and manager establishment, but verification omits the added predecessor-worker self-ticket exception.

[blocker] tasks/plans/2026-10-09-lru-sqlite-retirement.md:58 — I2’s witnesses delay a successor worker and hold an established predecessor handle. Neither exercises a predecessor worker paused after ticket admission but before establishment (`src-tauri/src/db/repository.rs:257–263`). If retirement publishes that worker’s gate before it resumes, a barrier that waits on its own ticket stalls until timeout (`src-tauri/src/db/repository.rs:197`). Require a synchronized witness proving this worker completes or safely refuses establishment without waiting for its own ticket. The currently specified witnesses would not reject that implementation. (confidence: 90)

[should-fix] tasks/plans/2026-10-09-lru-sqlite-retirement.md:114 — The I1 and I2 adoption rows lack the required `Authority` entries. Classify the directory-wide matching and manager-establishment fencing as necessary correctness work against MANDATE, citing the spelling preservation and asynchronous establishment paths (`src-tauri/src/infra/path_authority/mod.rs:2078`, `src-tauri/src/db/repository.rs:256`). (confidence: 100)

Limitation: Source-only review. Implementation, runtime behavior and revert failures remain unverified (confidence: 100).

VERDICT: REVISE
```

#### Raw lens-platform-semantics-r2

```text
CLOSED: I1 — O1/O2 match object identity OR retained parent identity, covering differently spelled replacements on Windows and macOS. `repository.rs:1286` obtains parent identity from the retained handle. `path_authority/mod.rs:3706` uses Unix device/inode or Windows volume/file index. O2 requires casing-alias witnesses across acquisition, revision and deletion boundaries.

NOT MY CLASS: I2 — closure belongs to review-plan.

No new platform findings.

Limitation: source-only plan review. No tests, `pnpm rust:windows:check`, or non-Linux Unix source probe ran. Planned native runtime proof is `rust-windows-test` and `rust-macos-test`. The `rust-platform` matrix provides compile/clippy proof, including `-D warnings`.

VERDICT: APPROVED
```

#### Raw lens-correctness-r2

```text
CLOSED: I1 — O1/O2 match object OR retained parent identity, covering replacement spelling aliases with explicit same-parent blocking.

CLOSED: I2 — O2 fences cached acquisition and actual replenishment establishment, including self-ticket safety and reservation rechecks.

No correctness defects found in the revised contracts.

Limitation: plan-only review. Atomic publication, worker admission ordering, bounded capacity and timeout recovery remain implementation proof obligations (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-minimalism-r2

```text
NOT MY CLASS: I1 — platform-semantics owns alias-matching closure.
NOT MY CLASS: I2 — review-plan owns cached-acquisition and worker-establishment closure.

No bloat or duplication findings. The revised boundaries address concrete retirement bypasses. Shared ownership and matching have multiple required callers, and parent-identity matching avoids introducing filesystem-specific name equivalence machinery.

Limitation: implementation size and helper duplication remain unassessable until a source diff exists (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-tests-r2

```text
CLOSED: I1 — verification coverage now requires spelling-alias replacement witnesses at cached acquisition, revision and deletion boundaries, plus same-parent blocking and different-parent progress.

CLOSED: I2 — verification coverage now includes a replacement cached before eviction and delayed successor replenishment. The required assertion forbids actual successor SQLite establishment before predecessor close, so restoring either bypass would fail.

No verification findings. O1–O3 name Rust lifecycle assertions for real LRU retirement, bounded retention, protected-open/unlink ordering, and cancellation/timeout retry safety. The repository selector and platform CI test commands include the proposed witnesses. The plan explicitly requires keeping regression tests while reverting production changes and recording assertion failures.

Limitation: this closes the planned verification contracts only. Test implementations and actual revert failures remain unverified (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-error-handling-r2

```text
NOT MY CLASS: I1 — filesystem matching closure belongs to platform-semantics.
NOT MY CLASS: I2 — establishment-boundary closure belongs to plan.

[should-fix] tasks/plans/.plan-2026-10-09-lru-sqlite-retirement.md-r2.body.md:54 — O2 adds connection-manager barrier failures without specifying their typed caller outcome. When a delayed worker times out behind a predecessor while the target remains valid, r2d2 stringifies and retries its error. The existing `get_connection` path returns `Error::R2d2`, classification preserves it, and IPC surfaces category `database` with “database failure”. Require predecessor timeout/cancellation classification to survive this boundary, with a failure witness. O1’s explicit Cancellation/Conflict requirement covers capacity exhaustion only. (confidence: 90)

VERDICT: APPROVED
```


### Round 3

Elapsed 275.9 seconds, adopted substantive corrections 1 (I3 residual completion verification). Active arbitration time and quota waits were not separately measured. No dependency wait was required. Plan, error-handling, correctness and tests ran.

I2 — Fix closed at r3 by review-plan. O2 requires the admitted-predecessor worker completion/order witness. Its complete r1/r2 witnesses remain recorded.

I4 — Fix closed at r3 by review-plan. The additive Authority supplement records the frozen mandate/threat model and opened source supporting I1/I2.

I3 — Fix remains open at r3. Error-handling and correctness approved typed outcomes, but plan r3 finding 1 (blocker, confidence 90) and tests r3 finding 1 (should-fix, confidence 95) independently found the same missing bounded-completion witness. Deduplicate both into I3, no new issue ID. The current proof could pass after correctly classified failure plus an extra pool timeout. Confirmed repository.rs:1661 calls pool.get, :74 configures 2 seconds in tests and 30 seconds in production. The reviewed O2 forbids the second budget. Authority: frozen threat model includes cancellation and drain timeout. Add O3 completion/duration assertions with a pre-spawn origin, synchronized barrier and cancellation, a bound below the extra pool timeout and predecessor retention through the outcome assertion. Dependencies: I2. Lineage: I2. First failed closure check for I3.

Plan authorship and arbitration shared one context. Detection ran on the same model family selected for code execution. No source edits or runtime verification occurred.

#### Raw lens-plan-r3

```text
I2 CLOSED — PLAN `tasks/plans/.plan-2026-10-09-lru-sqlite-retirement.md-r3.body.md:62` now requires an admitted predecessor-worker witness that rejects self-waiting. It covers ticket admission before establishment at `src-tauri/src/db/repository.rs:257` and `:263`.

[blocker] I3 NOT CLOSED — PLAN `tasks/plans/.plan-2026-10-09-lru-sqlite-retirement.md-r3.body.md:58` forbids a second pool timeout, but its verification at `:72` asserts categories and retry independence without bounded completion. An implementation could retain `pool.get()` (`src-tauri/src/db/repository.rs:1661`), spend its additional configured timeout (`:74`), then return typed `Conflict` or `Cancellation` and satisfy those assertions. Require a synchronized completion bound that fails when acquisition adds another timeout or delays cancellation. (confidence: 90)

I4 CLOSED — The additive Authority supplement at `tasks/plans/2026-10-09-lru-sqlite-retirement.md:236` supplies both missing authorities, supported by spelling preservation at `src-tauri/src/infra/path_authority/mod.rs:2078` and delayed cached establishment at `src-tauri/src/db/repository.rs:986` and `:1175`.

VERDICT: REVISE
```

#### Raw lens-error-handling-r3

```text
I3 CLOSED — PLAN:57 requires operation-scoped Conflict/Cancellation through r2d2 transport, one shared deadline, and caller independence. PLAN:72 requires authority-valid cached-worker witnesses asserting Rust variants and IPC categories, retry success, and failure when generic pool errors replace typed results. Implementation proof remains pending.

VERDICT: APPROVED
```

#### Raw lens-tests-r3

```text
I2 CLOSED — O2 now requires a real predecessor worker paused after ticket admission, resumed after retirement publication. Its completion-before-deadline and ticket-release assertions would reject self-waiting.

I3 CLOSED — O3 requires actual cached-worker failures with an authority-valid target, asserts both Rust variant and ErrorCategory, and checks healthy-caller independence and retry success. Generic R2d2/database classification would fail.

[should-fix] tasks/plans/.plan-2026-10-09-lru-sqlite-retirement.md-r3.body.md:72 — The new prohibition on a second pool timeout has no corresponding duration assertion. Cached acquisition could exhaust the predecessor deadline, wait another pool timeout, then return correctly typed Conflict and pass every stated outcome/retry assertion. Require a synchronized deadline-bound assertion that fails when acquisition starts a second timeout budget. (confidence: 95)

Limitation: This checks planned proof contracts. Implemented assertions and measured revert failures remain unverified (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-correctness-r3

```text
I2 CLOSED — O2:54,62 requires cached and worker establishment fencing, plus a synchronized admitted-predecessor witness proving ticket release without self-wait or deadline expiry.

I3 CLOSED — O2:58 and O3:72 require operation-scoped Conflict/Cancellation through r2d2 transport, one shared deadline, and independent healthy callers and retries.

Limitation: plan-only review. Publication ordering, typed-result transport and actual lifecycle/revert assertions remain unverified until implementation (confidence: 100).

VERDICT: APPROVED
```


### plan-r5.md

# Plan: retain and drain LRU-evicted SQLite connections

## Goal

Resolve f-20260930-01 so an LRU-evicted pool cannot close SQLite handles after a later deletion or successor open of the same database. This is a PLAN-ONLY run at BASE 8ebc643ef5569b29f269415a7b2f958c1e4e78c2. Implementation belongs to the adopting session.

## MANDATE

### LRU eviction drops a database entry without draining its SQLite connections, so one can close after a later delete of the same file

* **ID:** f-20260930-01 · **Status:** open · **Area:** db-search · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/db/repository.rs` `evict_idle_entries` (~line 973, called under the repository state lock from `entry()` ~915); `close_retired_entry` (~952) and `DrainGate` (~109) are the drain every other retirement path uses since `3ed94336`.
* **Defect:** eviction removes an idle entry (`Arc::strong_count == 1`, no lease, not retiring) from `RepositoryState.entries` and drops it without closing its connection gate or waiting for outstanding connection tickets. An r2d2 `add_connection` job started by an earlier `get` can still hold an upgraded pool reference and a live or in-flight SQLite handle (the f-20260929-07 mechanism). A later `delete_exclusive_cancellable` of the same file then finds no entry, drains nothing, and unlinks while that handle is still open. The window is small (a replenishment job outliving the `get` that spawned it), reported by the repair leaf of the 2026-09-30 push review.
* **Why it matters:** it is the last retirement path that can close an SQLite handle (and unlink WAL/SHM) after the file was deleted or replaced, which every other path now excludes.
* **Proposed fix:** close the evicted entry's connection gate and drop its pool at eviction without blocking under the state lock, and keep the evicted gates reachable (for example a per-key list of draining gates in `RepositoryState`) so `delete_exclusive_inner` and `entry()` rebuild wait on them through `DrainGate::wait_drained` before unlinking or opening a fresh pool.
* **Open question:** where do evicted-but-draining gates live and who prunes them — a per-key list in `RepositoryState` pruned on drain, or eviction deferred to a path that may block — without holding the state lock across a wait?
* **Found by:** Codex write leaf (repair of the `8b97e423` push review), out-of-scope report; confirmed by the orchestrator from source, 2026-09-30. Related: `f-20260929-07`.

## Threat model and non-goals

Ordinary concurrent native database operations, r2d2 replenishment workers, cancellation, drain timeout, authority-valid same-path replacement and aliases on Linux, macOS and Windows. Preserve existing authority checks and bound VFS behavior. No new protection against malicious pathname churn, new cross-capability lifetime protocol, pool-key merger, hard-link WAL redesign, background service, watcher, shutdown redesign, or new renderer behavior.

## Traced premises

Frozen source trace at BASE, confirmed by the root and locate probe-1-r1:

* `repository.rs:1091` selects idle sole-owner LRU entries and removes them under the state mutex.
* `repository.rs:135`, `:252` and `:223` give each pooled SQLite open a ticket from before establishment until after SQLite and its binding close.
* r2d2 0.8.10 `src/lib.rs:230` upgrades a weak pool on its worker before connect and retains it through publication.
* `repository.rs:1664` closes connection admission and drops the pool before draining.
* `repository.rs:1070` removes a retired entry even if its drain returns an error, losing future lookup of that gate.
* `repository.rs:868` deletion reserves the canonical path but drains only the exact current entry.
* `repository.rs:929` owns pool construction through the building set and BuildGuard.
* `repository.rs:684` also opens a transient bound revision connection without constructing a pool.
* `repository.rs:372` keys pools by object, parent and path. `bound_sqlite.rs:188` reuses bindings, it does not drain predecessor connections.
* `db/mod.rs:2870` and `puzzle.rs:646` execute descriptor-bound unlink inside the repository deletion barrier.
* `repository.rs:2603`, `:2762`, `:2789`, `:2809`, and `:4855` contain cancellation, timeout, LRU and VFS/sidecar lifetime witnesses.
* `path_authority/mod.rs:962` supplies platform-neutral test targets. Most existing repository lifecycle tests are Unix-only at `repository.rs:1799`. The bound SQLite witness module at `:3293` is platform-neutral.

## Approach

### O1 — publish and bound predecessor ownership

Derived from MANDATE “keep the evicted gates reachable” and “without blocking under the state lock”. RepositoryState owns a bounded set of retirement records identified by predecessor object and retained parent identity. Limit records, including capacity reservations, to MAX_OPEN_DATABASES (16). Publish ownership and close new connection admission atomically with removing the eligible LRU entry. Keep its teardown visibly outstanding until pool and entry disposal have completed outside the repository state mutex. A zero count must prove that no evictor still owns a pool awaiting disposal, as well as that SQLite has closed every admitted handle.

Only closed, fully drained records may be pruned. Prune completed records opportunistically at retirement/admission boundaries, including when a different database is accessed, so churn through never-revisited names cannot accumulate records. Capacity exhaustion applies bounded cancellable backpressure outside the state mutex, returning Cancellation or Conflict on failure before losing a resource or publishing a cache entry whose required eviction cannot be owned. Preserve the existing active-lease LRU exception. No unrestricted per-key history and no background cleanup.

Verification level: deterministic Rust concurrency witnesses through real LRU selection. Assert the entry is eligible without an entry Arc or caller lease artificially pinning it, that connection admission closes, and that retirement ownership remains visible while an actual SQLite handle is held. An unrelated database operation in a different retained parent must still finish while predecessor teardown waits. Churn and saturation witnesses assert the record bound and recovery after tickets close.

### O2 — enforce the predecessor barrier at reopen and deletion

Derived from MANDATE “before unlinking or opening a fresh pool” and “same file”. Match retired predecessors by the same object identity OR the same retained parent identity, retaining the existing pool key and authority checks. Parent matching conservatively fences all retired predecessors in that directory. It catches replacements whose authority-valid leaf spelling changes on case-insensitive or Unicode-normalizing filesystems without inventing a string equivalence rule. It deliberately delays otherwise unrelated opens in that parent until its retired predecessors drain, never live pools in that parent.

Pool construction, connection acquisition from already cached pools, transient revision opens and the delete reservation must drain every matching predecessor before any corresponding SQLite establishment or unlink callback. Cover actual connection-manager establishment, including delayed r2d2 replenishment from a previously cached pool, so fencing synchronous acquisition alone cannot leave a worker bypass. Reuse one retirement matching/wait/pruning contract at those boundaries. An already admitted worker belonging to the retiring predecessor must not wait on its own connection ticket. Preserve its existing close ordering and count it in that predecessor's drain, or refuse its open safely after admission closes. No repository ownership cycle may be introduced through pool managers.

Waits release the repository state mutex. Coordinate their publication and recheck with the existing construction and deletion reservations so a newly published matching retirement cannot slip between the wait and protected operation. Keep active-lease conflicts and avoid waiting on a lease held by the same caller. Use one absolute deadline for each predecessor-barrier operation, not a fresh full timeout per predecessor or loop. Cancellation remains effective before destructive work begins. BoundDatabase lifetime and close ordering remain intact.

At every boundary, predecessor timeout returns the existing Error::Conflict and caller cancellation returns Error::Cancellation. Preserve that typed, operation-scoped result through cached acquisition even when r2d2 transports and retries manager errors as text. Do not infer the category by parsing those strings or let one caller's cancellation poison another caller or a later retry. A pool acquisition must not consume a second timeout after the predecessor deadline expires. No new public error category is required.

Verification level: synchronized Rust witnesses assert that same-key reopen, same-path replacement, same-object alias and deletion cannot establish a successor handle or run the unlink callback until the predecessor closes. Include a replacement cached by a lock-only caller before the predecessor is LRU-evicted, then acquired afterward, and a delayed successor-pool replenishment worker crossing that retirement boundary. Include the transient revision boundary. On filesystems accepting spelling aliases, replace GameCase.db3 and authorize gamecase.db3, then witness cached acquisition, revision and deletion barriers. Assert conservative same-parent blocking and different-parent progress. A real WAL fixture proves the predecessor's final close occurs before the successor's WAL/SHM can exist, and the successor remains queryable with its sidecars intact.

Also pause a real predecessor replenishment worker after its connection ticket is admitted but before SQLite establishment, make its entry genuinely LRU-eligible, publish retirement, and resume it. Synchronize at those lifecycle boundaries. Assert the worker completes or safely refuses establishment without waiting for its own ticket or the retirement deadline, releases the ticket, and allows the predecessor drain and successor barrier to finish. Keeping the regression while restoring self-waiting manager behavior must fail its completion/order assertion.

### O3 — retain barriers after incomplete drains

Derived from MANDATE “where evicted-but-draining gates live and who prunes them”. Timeout or cancellation must never discard or reopen a retired predecessor's connection gate. Release the waiting operation's temporary reservations, preserve predecessor ownership, and refuse its SQLite open or unlink. A retry after closure succeeds and removes completed bookkeeping.

Route LRU and the existing close_retired_entry removal through shared predecessor ownership. This also closes the same mechanism exposed when close_retired_entry currently removes an undrained gate on timeout or cancellation. Caller-lease cancellation before connection retirement keeps today's admission restoration. After connection retirement begins, reopening the caller lease must not make a retired pool reusable or remove its predecessor barrier.

Verification level: deterministically cancel during the connection-drain phase, and inject the shorter per-repository timeout. Assert no protected operation ran, an undrained predecessor remains discoverable, subsequent reopen/delete still waits or fails closed, and retry succeeds once the held connection is released.

Exercise cancellation and timeout after cached-pool worker establishment reaches a predecessor barrier, with the target remaining authority-valid. Assert the caller receives Cancellation/cancellation or Conflict/conflict (Rust variant and existing ErrorCategory), never R2d2/database. Assert a separately waiting healthy caller and a later retry remain independent and succeed after the predecessor closes. These witnesses must fail if the typed boundary result is replaced by the generic pool error.

For those actual cached/worker failure witnesses, also assert bounded completion for timeout and cancellation. Capture the elapsed-time origin before spawning the acquisition or release/cancellation child, then synchronize actual predecessor-barrier entry. Keep the predecessor held until the outcome assertion. Use the injected short predecessor deadline and an explicit scheduling allowance whose completion bound is strictly below the additional configured pool timeout. Assert timeout completion uses the original operation budget and cancellation returns promptly after its synchronized signal. Include multiple matching predecessors or a reservation recheck to reject refreshed budgets. Restoring a second full pool timeout or deferring cancellation through that timeout must fail the elapsed-time/completion assertion even if the eventual error category is correct. Preserve d-20261008-29's pre-spawn timing origin.

## Decisions and trade-offs

Entry remains build. The recorded decisions settle keying, authority, timeout and test synchronization, but none settles evicted-gate ownership and bounded retention.

Preserve d-20260904-01's injectable 60-second production timeout, d-20260913-02's pool key, d-20260913-03's lease-safe retirement, d-20260929-04's VFS authority, d-20260929-05's cross-directory refusal, and d-20261008-29/-30's synchronized test timing. O3 extends failed-drain safety, it does not reverse those decisions.

## Decided autonomously

* Question: Who owns evicted-but-draining gates and when are they pruned? Chosen: bounded repository retirement records using existing connection tickets, synchronous disposal outside the state mutex and opportunistic completed-record pruning. Rejected: evictor-local ownership alone (concurrent delete/reopen loses the barrier), an unbounded per-key list, or a background reaper. Reason: MANDATE requires future lookups and bounded retention, and no new process is needed. Reversal path: replace the registry only with a protocol proving the same lookup, capacity, failure and teardown-order invariants.
* Question: Does a fresh revision read count as a reopen? Chosen: yes, apply the same retired-predecessor barrier at read_revision without creating a pool. Rejected: fencing pool construction alone. Reason: a revision read is another SQLite establishment against the same authority-bound file. Reversal path: remove that barrier only if transient revision establishment can no longer overlap an evicted predecessor.
* Question: May close_retired_entry forget a gate after timeout or cancellation? Chosen: no, retain its undrained predecessor through the shared ownership contract. Rejected: removing the entry and forgetting its gate. Reason: a later delete can otherwise reproduce the same post-unlink close that MANDATE forbids. Reversal path: demonstrate another authoritative owner consulted by every future reopen/delete before removing this retention.
* Question: How are replacement names matched across filesystems? Chosen: same object OR retained parent identity, using authority identities already in EntryKey. Rejected: canonical path bytes or a new case-folding approximation. Reason: canonical_binding preserves the leaf's spelling and byte comparison can miss a replacement alias. Conservatively waiting for retired predecessors in the same parent gives a portable guarantee with bounded state. Reversal path: narrow parent matching only with authority-backed filesystem name equivalence and replacement witnesses on every supported platform.
* Question: Is construction the only pooled establishment boundary? Chosen: no, cached acquisition and actual manager establishment also use the predecessor barrier. Rejected: assuming every get creates a fresh pool. Reason: lock-only callers can cache a pool before its first SQLite connection and replenishment runs asynchronously. Reversal path: remove a boundary only if that path can no longer establish SQLite after predecessor retirement.

## Risks / open questions

No product decision is needed. The code executor owns private helper names and test placement within the reviewed obligations. Preserve the known hard-link WAL and cross-capability hazards as separate findings f-20260929-05 and f-20261001-02. This plan covers retired predecessor barriers, not concurrent live alias pools or all transient-reader lifetimes.

Locate confirmed Codex CLI 0.162.0 and the cargo, pnpm, agent-gate, WebKitWebDriver, tauri-driver and kwin_wayland binaries. The planner worktree has no node_modules and runs no install or runtime proofs. Adoption must run pnpm install --frozen-lockfile, recheck the exact released-kit parity and runtime prerequisites, and use the shared gate wrappers. Existing verify:app comments record unrelated failure history. Current runtime status is unmeasured, not green evidence.

## Not part of this task

Other db-search siblings remain open at their recorded tiers. No frontend, Specta signature, binding, schema, dependency, capability, VFS implementation or deletion-outcome change is planned. No claim of implemented or runtime-verified behavior is made by this planner.

## Phases

One cohesive sensitive phase owns `src-tauri/src/db/repository.rs`, production ownership plus its regression witnesses. Concurrency, resource lifetime and cancellation are touched. API signatures and persisted schemas are unchanged. Selected executor: codex, write role sensitive resolved through leaf-launch.sh and the model registry. No history fork is needed. The root integrates, arbitrates, verifies and commits in the adopting run.

Implement O1–O3 together so every retirement path and every barrier ships with its witnesses. Prefer the existing platform-neutral test module for common lifetime behavior. OS-specific WAL fixtures may stay platform-gated, but the central ownership and error/retry witnesses must run on Linux, macOS and Windows. Read async-resource-invariants.md, pgn-scanning.md and ipc-events.md before writing. No other source files are assigned.

Exact phase proof: `cargo test --manifest-path src-tauri/Cargo.toml db::repository:: -- --test-threads=1 && pnpm checks:pre-review`. Keep new regressions present while reverting only the task-owned production fix from its Git diff, record the expected assertion failures, restore, and rerun green. The adopter owns that proof, not the read-only planner.

After implementation and cumulative diff review, run `pnpm build && pnpm verify:app --screenshot /tmp/drain-plan-chessfable-0a459a4f-slot1/build/verify-ui/retirement-app.png` for real app startup/IPC/shutdown integration. It complements the deterministic Rust SQLite retirement witnesses, it does not directly prove the LRU race. No new standalone verifier is planned.

Final affected push gates: `pnpm gates:push -- --rust`, through the canonical detached push-gate route on the final clean HEAD. It includes backend tests/coverage, fmt/clippy, Windows compile checks, contract and kit parity. No ratchet changes. The release also requires `pnpm ci:remote:check` and successful rust-windows-test, rust-macos-test and rust-platform jobs on the pushed SHA. Run the project push skill, then verify HEAD equals upstream and applicable installation. Record the autonomous decisions and complete review handoff before final gates. Close f-20260930-01 only through findings.py after verified implementation.

## Carried to diff review

None.

## Reviews

### Round 1

Elapsed 598.5 seconds, adopted substantive issues 2. Active arbitration time and quota waits were not separately measured. No dependency wait was required. All 12 plan-capable lenses ran. The class-absent exits for chess-semantics, engine-protocol, ipc-contract, persisted-state and pgn-index are accepted against this backend resource-lifetime mandate.

I1 — platform-semantics r1 finding 1, should-fix, confidence 94. Fix adopted, awaiting closure. canonical_binding at path_authority/mod.rs:2073 preserves the leaf spelling. O1/O2 now retain and match parent identity instead of trusting path bytes. Same-parent retirement backpressure is an explicit technical trade-off. Dependencies: none.

I2 — plan r1 finding 1, blocker, confidence 90. Fix adopted, awaiting closure. repository.rs:753 and :986 allow lock-only caching with min_idle 0, :950 returns that cached entry and :1175 reaches establishment through get_connection. O2 now covers cached acquisition and actual worker establishment, with lifecycle witnesses. Dependencies: none.

Plan authorship and arbitration shared one context. Detection ran on the same model family selected for code execution. Codex role routing used review-plan for the plan lens and sensitive for the remaining applicable lenses. No source edits or runtime verification occurred.

#### Raw lens-correctness-r1

```text
No correctness defects found in O1–O3’s stated contracts.

Limitation: this is plan-only review. Reservation rechecks, capacity handling and teardown ordering require verification against the implementation (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-error-handling-r1

```text
VERDICT: APPROVED
```

#### Raw lens-minimalism-r1

```text
VERDICT: APPROVED
```

#### Raw lens-plan-r1

```text
[blocker] tasks/plans/2026-10-09-lru-sqlite-retirement.md:52 — O2 omits connection acquisition from an already cached replacement pool. Lock-only callers can cache a pool without opening SQLite (`src-tauri/src/db/repository.rs:753`, `:986`). Different identities at the same path have different keys (`:372`), so that replacement can remain cached when the old entry is later LRU-evicted. A subsequent acquisition returns the cached entry (`:950`) and calls `get_connection` (`:1175`), which can establish SQLite (`:263`) without passing through pool construction. The proposed boundaries therefore leave the same-path successor-open guarantee at plan line 56 unenforced. Cover cached acquisitions and require a lifecycle witness where the replacement is cached before predecessor eviction. (confidence: 90)

VERDICT: REVISE
```

#### Raw lens-tests-r1

```text
No findings. O1–O3 specify Rust lifecycle assertions that would fail on revert, including real LRU eviction, blocked successor opens/unlink, and retained barriers after cancellation or timeout. The repository selector and platform CI jobs include the proposed tests.

Limitation: this approves the planned proof. Implementation assertions and actual revert failures remain unverified (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-chess-semantics-r1

```text
NOT APPLICABLE: The assigned repository file and O1–O3 obligations concern SQLite connection retirement and drain ownership. They do not involve in-memory chess trees, positions, or move paths.
VERDICT: APPROVED
```

#### Raw lens-engine-protocol-r1

```text
NOT APPLICABLE: The sole file and O1–O3 obligations concern SQLite connection retirement, reopen, and deletion barriers. They do not involve engine process supervision, UCI protocol state, or asynchronous engine result routing.
VERDICT: APPROVED
```

#### Raw lens-ipc-contract-r1

```text
NOT APPLICABLE: O1–O3 cover internal SQLite retirement ownership and drain barriers in `src-tauri/src/db/repository.rs`. The plan changes no Rust↔renderer event, command, payload, subscription, capability scope, or shutdown contract.

VERDICT: APPROVED
```

#### Raw lens-persisted-state-r1

```text
NOT APPLICABLE: The assigned file is a Rust database repository. O1–O3 concern SQLite connection retirement and drain barriers, with no renderer storage keys, persisted atoms, hydration, or tab lifecycle changes.
VERDICT: APPROVED
```

#### Raw lens-pgn-index-r1

```text
NOT APPLICABLE: O1–O3 in `src-tauri/src/db/repository.rs` concern SQLite connection retirement and reopen/delete barriers. They do not change PGN byte scanning, offsets, move encoding, stored indexes, or search predicates.

VERDICT: APPROVED
```

#### Raw lens-platform-semantics-r1

```text
[should-fix] tasks/plans/2026-10-09-lru-sqlite-retirement.md:52 — On case-insensitive Windows filesystems, replacing `GameCase.db3` and authorizing its successor as `gamecase.db3` changes the object identity while preserving unequal canonical path spellings. `canonical_binding` preserves leaf casing (`src-tauri/src/infra/path_authority/mod.rs:2073`), so the proposed matching rule can miss the draining predecessor. Require filesystem-compatible name equivalence and a replacement witness using different casing at reopen, revision-read and deletion boundaries. (confidence: 94)

Limitation: This was a source-only plan review. No Windows compile check, non-Linux Unix source probe or runtime tests ran. Native runtime proof remains `rust-windows-test` and `rust-macos-test`. The `rust-platform` matrix supplies clippy/compile proof.

VERDICT: REVISE
```

#### Raw lens-tauri-security-r1

```text
No security-boundary defects found in O1–O3. The obligations retain predecessor ownership through SQLite close, fence reopen and unlink, and preserve barriers after cancellation or timeout.

Limitation: this is plan review only. Implementation and lifecycle witnesses remain unverified. Credential, session and signed-download flows are absent from the assigned change.

VERDICT: APPROVED
```


### Round 2

Elapsed 360.4 seconds, adopted substantive corrections 2 (I2 residual verification and I3 typed failure). I4 changes the review record only and is excluded from substantive adoption counts. Active arbitration time and quota waits were not separately measured. No dependency wait was required. Plan, platform-semantics, correctness, minimalism, tests and error-handling ran.

I1 — Fix closed at r2 by its platform witness and review-plan. Authority: frozen threat model includes authority-valid same-path replacement and aliases on Linux, macOS and Windows. Object OR retained-parent matching corrects the authority-spelling gap without changing pool keys. Source confirmation: repository.rs:1286 derives parent identity from its retained parent handle, path_authority/mod.rs:3706 supplies Unix device/inode or Windows handle identity.

I2 — Fix remains open at r2. review-plan r2 finding 1 is a residual blocker at confidence 90 and becomes a second witness of I2. Correctness and tests approved the establishment boundary, but review-plan found the predecessor self-ticket exception lacked its own executable witness. Confirmed repository.rs:257 admits its ticket before :263 establishes SQLite, and :197 can wait on that ticket until deadline if its own retired gate is included. Add the synchronized admitted-predecessor worker witness in O2. Authority: MANDATE names outstanding connection tickets and r2d2 replenishment as the concrete retirement trigger. Dependencies: none. First failed closure check for this lineage, no mechanism rewrite.

I3 — error-handling r2 finding 1, should-fix, confidence 90. Fix adopted, awaiting closure. Lineage: I2, correction-introduced establishment boundary. Dependencies: I2. Source confirmation: repository.rs:1656 maps pool.get through Error::from, :1297 preserves the original error when the target is valid. r2d2 0.8.10 src/lib.rs:273 stores a manager failure as text and retries. error.rs:447 maps R2d2 to Database. Authority: the frozen threat model includes cancellation and drain timeout, O3 preserves their existing safe failure behavior. Correct O2/O3 so worker barrier failure remains typed Conflict or Cancellation for the waiting operation, with no string-based classification or cross-caller contamination. No new IPC category or Error variant is required.

I4 — plan r2 finding 2, should-fix, confidence 100. Fix adopted, awaiting review-plan closure. Dependencies: I1, I2. The r1 rows omitted explicit Authority fields for the new matching and establishment mechanisms. The following additive supplement preserves the original history and records those authorities. No behavior change and no substantive adoption count.

| R1 issue | Authority | Evidence | Necessary correction |
| --- | --- | --- | --- |
| I1 | Frozen threat model: authority-valid same-path replacement and aliases on Linux, macOS and Windows. MANDATE: "same file". | path_authority/mod.rs:2078 appends the unchanged leaf spelling. repository.rs:1286 retains parent identity. | Match object OR parent identity so alias-spelled replacement cannot miss its predecessor. |
| I2 | MANDATE: r2d2 add_connection can retain a live or in-flight SQLite handle, and later deletion must drain it. Frozen threat model includes r2d2 replenishment workers. | repository.rs:753 and :986 cache an unopened pool, :950 returns it, :1175 and :263 establish later. | Fence cached and actual asynchronous establishment as well as construction. |

Plan authorship and arbitration shared one context. Detection ran on the same model family selected for code execution. No source edits or runtime verification occurred.

#### Raw lens-plan-r2

```text
CLOSED: I1 — Candidate O2 matches retained parent identity (`tasks/plans/2026-10-09-lru-sqlite-retirement.md:52`, `src-tauri/src/db/repository.rs:1286`), covering spelling differences preserved by `src-tauri/src/infra/path_authority/mod.rs:2078`.

STILL OPEN: I2 — The corrected boundaries include cached acquisition and manager establishment, but verification omits the added predecessor-worker self-ticket exception.

[blocker] tasks/plans/2026-10-09-lru-sqlite-retirement.md:58 — I2’s witnesses delay a successor worker and hold an established predecessor handle. Neither exercises a predecessor worker paused after ticket admission but before establishment (`src-tauri/src/db/repository.rs:257–263`). If retirement publishes that worker’s gate before it resumes, a barrier that waits on its own ticket stalls until timeout (`src-tauri/src/db/repository.rs:197`). Require a synchronized witness proving this worker completes or safely refuses establishment without waiting for its own ticket. The currently specified witnesses would not reject that implementation. (confidence: 90)

[should-fix] tasks/plans/2026-10-09-lru-sqlite-retirement.md:114 — The I1 and I2 adoption rows lack the required `Authority` entries. Classify the directory-wide matching and manager-establishment fencing as necessary correctness work against MANDATE, citing the spelling preservation and asynchronous establishment paths (`src-tauri/src/infra/path_authority/mod.rs:2078`, `src-tauri/src/db/repository.rs:256`). (confidence: 100)

Limitation: Source-only review. Implementation, runtime behavior and revert failures remain unverified (confidence: 100).

VERDICT: REVISE
```

#### Raw lens-platform-semantics-r2

```text
CLOSED: I1 — O1/O2 match object identity OR retained parent identity, covering differently spelled replacements on Windows and macOS. `repository.rs:1286` obtains parent identity from the retained handle. `path_authority/mod.rs:3706` uses Unix device/inode or Windows volume/file index. O2 requires casing-alias witnesses across acquisition, revision and deletion boundaries.

NOT MY CLASS: I2 — closure belongs to review-plan.

No new platform findings.

Limitation: source-only plan review. No tests, `pnpm rust:windows:check`, or non-Linux Unix source probe ran. Planned native runtime proof is `rust-windows-test` and `rust-macos-test`. The `rust-platform` matrix provides compile/clippy proof, including `-D warnings`.

VERDICT: APPROVED
```

#### Raw lens-correctness-r2

```text
CLOSED: I1 — O1/O2 match object OR retained parent identity, covering replacement spelling aliases with explicit same-parent blocking.

CLOSED: I2 — O2 fences cached acquisition and actual replenishment establishment, including self-ticket safety and reservation rechecks.

No correctness defects found in the revised contracts.

Limitation: plan-only review. Atomic publication, worker admission ordering, bounded capacity and timeout recovery remain implementation proof obligations (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-minimalism-r2

```text
NOT MY CLASS: I1 — platform-semantics owns alias-matching closure.
NOT MY CLASS: I2 — review-plan owns cached-acquisition and worker-establishment closure.

No bloat or duplication findings. The revised boundaries address concrete retirement bypasses. Shared ownership and matching have multiple required callers, and parent-identity matching avoids introducing filesystem-specific name equivalence machinery.

Limitation: implementation size and helper duplication remain unassessable until a source diff exists (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-tests-r2

```text
CLOSED: I1 — verification coverage now requires spelling-alias replacement witnesses at cached acquisition, revision and deletion boundaries, plus same-parent blocking and different-parent progress.

CLOSED: I2 — verification coverage now includes a replacement cached before eviction and delayed successor replenishment. The required assertion forbids actual successor SQLite establishment before predecessor close, so restoring either bypass would fail.

No verification findings. O1–O3 name Rust lifecycle assertions for real LRU retirement, bounded retention, protected-open/unlink ordering, and cancellation/timeout retry safety. The repository selector and platform CI test commands include the proposed witnesses. The plan explicitly requires keeping regression tests while reverting production changes and recording assertion failures.

Limitation: this closes the planned verification contracts only. Test implementations and actual revert failures remain unverified (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-error-handling-r2

```text
NOT MY CLASS: I1 — filesystem matching closure belongs to platform-semantics.
NOT MY CLASS: I2 — establishment-boundary closure belongs to plan.

[should-fix] tasks/plans/.plan-2026-10-09-lru-sqlite-retirement.md-r2.body.md:54 — O2 adds connection-manager barrier failures without specifying their typed caller outcome. When a delayed worker times out behind a predecessor while the target remains valid, r2d2 stringifies and retries its error. The existing `get_connection` path returns `Error::R2d2`, classification preserves it, and IPC surfaces category `database` with “database failure”. Require predecessor timeout/cancellation classification to survive this boundary, with a failure witness. O1’s explicit Cancellation/Conflict requirement covers capacity exhaustion only. (confidence: 90)

VERDICT: APPROVED
```


### Round 3

Elapsed 275.9 seconds, adopted substantive corrections 1 (I3 residual completion verification). Active arbitration time and quota waits were not separately measured. No dependency wait was required. Plan, error-handling, correctness and tests ran.

I2 — Fix closed at r3 by review-plan. O2 requires the admitted-predecessor worker completion/order witness. Its complete r1/r2 witnesses remain recorded.

I4 — Fix closed at r3 by review-plan. The additive Authority supplement records the frozen mandate/threat model and opened source supporting I1/I2.

I3 — Fix remains open at r3. Error-handling and correctness approved typed outcomes, but plan r3 finding 1 (blocker, confidence 90) and tests r3 finding 1 (should-fix, confidence 95) independently found the same missing bounded-completion witness. Deduplicate both into I3, no new issue ID. The current proof could pass after correctly classified failure plus an extra pool timeout. Confirmed repository.rs:1661 calls pool.get, :74 configures 2 seconds in tests and 30 seconds in production. The reviewed O2 forbids the second budget. Authority: frozen threat model includes cancellation and drain timeout. Add O3 completion/duration assertions with a pre-spawn origin, synchronized barrier and cancellation, a bound below the extra pool timeout and predecessor retention through the outcome assertion. Dependencies: I2. Lineage: I2. First failed closure check for I3.

Plan authorship and arbitration shared one context. Detection ran on the same model family selected for code execution. No source edits or runtime verification occurred.

#### Raw lens-plan-r3

```text
I2 CLOSED — PLAN `tasks/plans/.plan-2026-10-09-lru-sqlite-retirement.md-r3.body.md:62` now requires an admitted predecessor-worker witness that rejects self-waiting. It covers ticket admission before establishment at `src-tauri/src/db/repository.rs:257` and `:263`.

[blocker] I3 NOT CLOSED — PLAN `tasks/plans/.plan-2026-10-09-lru-sqlite-retirement.md-r3.body.md:58` forbids a second pool timeout, but its verification at `:72` asserts categories and retry independence without bounded completion. An implementation could retain `pool.get()` (`src-tauri/src/db/repository.rs:1661`), spend its additional configured timeout (`:74`), then return typed `Conflict` or `Cancellation` and satisfy those assertions. Require a synchronized completion bound that fails when acquisition adds another timeout or delays cancellation. (confidence: 90)

I4 CLOSED — The additive Authority supplement at `tasks/plans/2026-10-09-lru-sqlite-retirement.md:236` supplies both missing authorities, supported by spelling preservation at `src-tauri/src/infra/path_authority/mod.rs:2078` and delayed cached establishment at `src-tauri/src/db/repository.rs:986` and `:1175`.

VERDICT: REVISE
```

#### Raw lens-error-handling-r3

```text
I3 CLOSED — PLAN:57 requires operation-scoped Conflict/Cancellation through r2d2 transport, one shared deadline, and caller independence. PLAN:72 requires authority-valid cached-worker witnesses asserting Rust variants and IPC categories, retry success, and failure when generic pool errors replace typed results. Implementation proof remains pending.

VERDICT: APPROVED
```

#### Raw lens-tests-r3

```text
I2 CLOSED — O2 now requires a real predecessor worker paused after ticket admission, resumed after retirement publication. Its completion-before-deadline and ticket-release assertions would reject self-waiting.

I3 CLOSED — O3 requires actual cached-worker failures with an authority-valid target, asserts both Rust variant and ErrorCategory, and checks healthy-caller independence and retry success. Generic R2d2/database classification would fail.

[should-fix] tasks/plans/.plan-2026-10-09-lru-sqlite-retirement.md-r3.body.md:72 — The new prohibition on a second pool timeout has no corresponding duration assertion. Cached acquisition could exhaust the predecessor deadline, wait another pool timeout, then return correctly typed Conflict and pass every stated outcome/retry assertion. Require a synchronized deadline-bound assertion that fails when acquisition starts a second timeout budget. (confidence: 95)

Limitation: This checks planned proof contracts. Implemented assertions and measured revert failures remain unverified (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-correctness-r3

```text
I2 CLOSED — O2:54,62 requires cached and worker establishment fencing, plus a synchronized admitted-predecessor witness proving ticket release without self-wait or deadline expiry.

I3 CLOSED — O2:58 and O3:72 require operation-scoped Conflict/Cancellation through r2d2 transport, one shared deadline, and independent healthy callers and retries.

Limitation: plan-only review. Publication ordering, typed-result transport and actual lifecycle/revert assertions remain unverified until implementation (confidence: 100).

VERDICT: APPROVED
```


### Round 4

Elapsed 157.5 seconds, adopted substantive corrections 0. Active arbitration time and quota waits were not separately measured. No dependency wait was required. Plan, error-handling and tests ran, covering every I3 witness.

I3 — Fix closed at r4 by error-handling, tests and review-plan. O2/O3 require operation-scoped typed timeout/cancellation through worker transport, shared deadlines, healthy caller independence and actual failure/retry witnesses. The residual completion proof now rejects an added pool timeout or delayed cancellation using a synchronized bound measured from a pre-spawn origin. I1 remained closed at r2, I2 and I4 at r3.

Final disposition: four distinct issues, all Fix and closed. Seven raw prefixed findings are represented by metadata witnesses. I2 has two witnesses across r1/r2, I3 has three across r2/r3. No Skip, Defer, withdrawn mechanism, successor finding, or carried CR item. Dependencies: I3 depends on I2, I4 depends on I1/I2. Completed-round substantive adoption counts: r1=2 r2=2 r3=1 r4=0. No non-convergence trigger fired. Neither lineage failed two closure checks.

The authoritative phase obligations are O1–O3 and their verification levels. Same-parent conservative backpressure is explicit. Implementer helper structure remains unfrozen. Runtime, implementation size, atomic publication and platform execution remain unverified adoption work. The finding remains open and no ledger claim or closure was made.

Plan authorship and arbitration shared one context. Detection ran on the same model family selected for code execution. No source edits, installation, runtime tests, commit or push occurred.

#### Raw lens-plan-r4

```text
I3 CLOSED — `tasks/plans/.plan-2026-10-09-lru-sqlite-retirement.md-r4.body.md:74` requires synchronized completion assertions below the pool timeout, predecessor retention through outcome assertion, and failure when extra budgets or delayed cancellation return. This rejects the `pool.get()` delay at `src-tauri/src/db/repository.rs:1661`, configured as two seconds in tests at `:76`, while preserving O2’s typed-result and caller-independence requirements. Closure covers the planned proof. Implementation and measured revert failures remain unverified (confidence: 95).

VERDICT: APPROVED
```

#### Raw lens-tests-r4

```text
I3 CLOSED — PLAN:74 requires synchronized cached/worker timeout and cancellation completion assertions, measured from a pre-spawn origin while the predecessor remains held. The bound must fall below the additional pool timeout and fail when a second budget or delayed cancellation is restored. Multiple predecessors or a reservation recheck must also reject refreshed budgets. This closes the planned proof gap. Implemented assertions and measured revert failures remain unverified (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-error-handling-r4

```text
I3 CLOSED — PLAN:58,72,74 requires typed, operation-scoped Conflict/Cancellation and synchronized completion bounds below the additional pool timeout, with predecessors held through outcome assertions. Witnesses must reject refreshed budgets and delayed cancellation while preserving healthy-caller and retry independence. Implementation and measured revert failures remain pending.

VERDICT: APPROVED
```


### plan-r6.md

# Plan: retain and drain LRU-evicted SQLite connections

## Goal

Resolve f-20260930-01 so an LRU-evicted pool cannot close SQLite handles after a later deletion or successor open of the same database. This is a PLAN-ONLY run at BASE 8ebc643ef5569b29f269415a7b2f958c1e4e78c2. Implementation belongs to the adopting session.

## MANDATE

### LRU eviction drops a database entry without draining its SQLite connections, so one can close after a later delete of the same file

* **ID:** f-20260930-01 · **Status:** open · **Area:** db-search · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/db/repository.rs` `evict_idle_entries` (~line 973, called under the repository state lock from `entry()` ~915); `close_retired_entry` (~952) and `DrainGate` (~109) are the drain every other retirement path uses since `3ed94336`.
* **Defect:** eviction removes an idle entry (`Arc::strong_count == 1`, no lease, not retiring) from `RepositoryState.entries` and drops it without closing its connection gate or waiting for outstanding connection tickets. An r2d2 `add_connection` job started by an earlier `get` can still hold an upgraded pool reference and a live or in-flight SQLite handle (the f-20260929-07 mechanism). A later `delete_exclusive_cancellable` of the same file then finds no entry, drains nothing, and unlinks while that handle is still open. The window is small (a replenishment job outliving the `get` that spawned it), reported by the repair leaf of the 2026-09-30 push review.
* **Why it matters:** it is the last retirement path that can close an SQLite handle (and unlink WAL/SHM) after the file was deleted or replaced, which every other path now excludes.
* **Proposed fix:** close the evicted entry's connection gate and drop its pool at eviction without blocking under the state lock, and keep the evicted gates reachable (for example a per-key list of draining gates in `RepositoryState`) so `delete_exclusive_inner` and `entry()` rebuild wait on them through `DrainGate::wait_drained` before unlinking or opening a fresh pool.
* **Open question:** where do evicted-but-draining gates live and who prunes them — a per-key list in `RepositoryState` pruned on drain, or eviction deferred to a path that may block — without holding the state lock across a wait?
* **Found by:** Codex write leaf (repair of the `8b97e423` push review), out-of-scope report; confirmed by the orchestrator from source, 2026-09-30. Related: `f-20260929-07`.

## Threat model and non-goals

Ordinary concurrent native database operations, r2d2 replenishment workers, cancellation, drain timeout, authority-valid same-path replacement and aliases on Linux, macOS and Windows. Preserve existing authority checks and bound VFS behavior. No new protection against malicious pathname churn, new cross-capability lifetime protocol, pool-key merger, hard-link WAL redesign, background service, watcher, shutdown redesign, or new renderer behavior.

## Traced premises

Frozen source trace at BASE, confirmed by the root and locate probe-1-r1:

* `repository.rs:1091` selects idle sole-owner LRU entries and removes them under the state mutex.
* `repository.rs:135`, `:252` and `:223` give each pooled SQLite open a ticket from before establishment until after SQLite and its binding close.
* r2d2 0.8.10 `src/lib.rs:230` upgrades a weak pool on its worker before connect and retains it through publication.
* `repository.rs:1664` closes connection admission and drops the pool before draining.
* `repository.rs:1070` removes a retired entry even if its drain returns an error, losing future lookup of that gate.
* `repository.rs:868` deletion reserves the canonical path but drains only the exact current entry.
* `repository.rs:929` owns pool construction through the building set and BuildGuard.
* `repository.rs:684` also opens a transient bound revision connection without constructing a pool.
* `repository.rs:372` keys pools by object, parent and path. `bound_sqlite.rs:188` reuses bindings, it does not drain predecessor connections.
* `db/mod.rs:2870` and `puzzle.rs:646` execute descriptor-bound unlink inside the repository deletion barrier.
* `repository.rs:2603`, `:2762`, `:2789`, `:2809`, and `:4855` contain cancellation, timeout, LRU and VFS/sidecar lifetime witnesses.
* `path_authority/mod.rs:962` supplies platform-neutral test targets. Most existing repository lifecycle tests are Unix-only at `repository.rs:1799`. The bound SQLite witness module at `:3293` is platform-neutral.

## Approach

### O1 — publish and bound predecessor ownership

Derived from MANDATE “keep the evicted gates reachable” and “without blocking under the state lock”. RepositoryState owns a bounded set of retirement records identified by predecessor object and retained parent identity. Limit records, including capacity reservations, to MAX_OPEN_DATABASES (16). Publish ownership and close new connection admission atomically with removing the eligible LRU entry. Keep its teardown visibly outstanding until pool and entry disposal have completed outside the repository state mutex. A zero count must prove that no evictor still owns a pool awaiting disposal, as well as that SQLite has closed every admitted handle.

Only closed, fully drained records may be pruned. Prune completed records opportunistically at retirement/admission boundaries, including when a different database is accessed, so churn through never-revisited names cannot accumulate records. Capacity exhaustion applies bounded cancellable backpressure outside the state mutex, returning Cancellation or Conflict on failure before losing a resource or publishing a cache entry whose required eviction cannot be owned. Preserve the existing active-lease LRU exception. No unrestricted per-key history and no background cleanup.

Verification level: deterministic Rust concurrency witnesses through real LRU selection. Assert the entry is eligible without an entry Arc or caller lease artificially pinning it, that connection admission closes, and that retirement ownership remains visible while an actual SQLite handle is held. An unrelated database operation in a different retained parent must still finish while predecessor teardown waits. Churn and saturation witnesses assert the record bound and recovery after tickets close.

### O2 — enforce the predecessor barrier at reopen and deletion

Derived from MANDATE “before unlinking or opening a fresh pool” and “same file”. Match retired predecessors by the same object identity OR the same retained parent identity, retaining the existing pool key and authority checks. Parent matching conservatively fences all retired predecessors in that directory. It catches replacements whose authority-valid leaf spelling changes on case-insensitive or Unicode-normalizing filesystems without inventing a string equivalence rule. It deliberately delays otherwise unrelated opens in that parent until its retired predecessors drain, never live pools in that parent.

Pool construction, connection acquisition from already cached pools, transient revision opens and the delete reservation must drain every matching predecessor before any corresponding SQLite establishment or unlink callback. Cover actual connection-manager establishment, including delayed r2d2 replenishment from a previously cached pool, so fencing synchronous acquisition alone cannot leave a worker bypass. Reuse one retirement matching/wait/pruning contract at those boundaries. An already admitted worker belonging to the retiring predecessor must not wait on its own connection ticket. Preserve its existing close ordering and count it in that predecessor's drain, or refuse its open safely after admission closes. No repository ownership cycle may be introduced through pool managers.

Waits release the repository state mutex. Coordinate their publication and recheck with the existing construction and deletion reservations so a newly published matching retirement cannot slip between the wait and protected operation. Keep active-lease conflicts and avoid waiting on a lease held by the same caller. Use one absolute deadline for each predecessor-barrier operation, not a fresh full timeout per predecessor or loop. Cancellation remains effective before destructive work begins. BoundDatabase lifetime and close ordering remain intact.

At every boundary, predecessor timeout returns the existing Error::Conflict and caller cancellation returns Error::Cancellation. Preserve that typed, operation-scoped result through cached acquisition even when r2d2 transports and retries manager errors as text. Do not infer the category by parsing those strings or let one caller's cancellation poison another caller or a later retry. A pool acquisition must not consume a second timeout after the predecessor deadline expires. No new public error category is required.

Verification level: synchronized Rust witnesses assert that same-key reopen, same-path replacement, same-object alias and deletion cannot establish a successor handle or run the unlink callback until the predecessor closes. Include a replacement cached by a lock-only caller before the predecessor is LRU-evicted, then acquired afterward, and a delayed successor-pool replenishment worker crossing that retirement boundary. Include the transient revision boundary. On filesystems accepting spelling aliases, replace GameCase.db3 and authorize gamecase.db3, then witness cached acquisition, revision and deletion barriers. Assert conservative same-parent blocking and different-parent progress. A real WAL fixture proves the predecessor's final close occurs before the successor's WAL/SHM can exist, and the successor remains queryable with its sidecars intact.

Also pause a real predecessor replenishment worker after its connection ticket is admitted but before SQLite establishment, make its entry genuinely LRU-eligible, publish retirement, and resume it. Synchronize at those lifecycle boundaries. Assert the worker completes or safely refuses establishment without waiting for its own ticket or the retirement deadline, releases the ticket, and allows the predecessor drain and successor barrier to finish. Keeping the regression while restoring self-waiting manager behavior must fail its completion/order assertion.

### O3 — retain barriers after incomplete drains

Derived from MANDATE “where evicted-but-draining gates live and who prunes them”. Timeout or cancellation must never discard or reopen a retired predecessor's connection gate. Release the waiting operation's temporary reservations, preserve predecessor ownership, and refuse its SQLite open or unlink. A retry after closure succeeds and removes completed bookkeeping.

Route LRU and the existing close_retired_entry removal through shared predecessor ownership. This also closes the same mechanism exposed when close_retired_entry currently removes an undrained gate on timeout or cancellation. Caller-lease cancellation before connection retirement keeps today's admission restoration. After connection retirement begins, reopening the caller lease must not make a retired pool reusable or remove its predecessor barrier.

Verification level: deterministically cancel during the connection-drain phase, and inject the shorter per-repository timeout. Assert no protected operation ran, an undrained predecessor remains discoverable, subsequent reopen/delete still waits or fails closed, and retry succeeds once the held connection is released.

Exercise cancellation and timeout after cached-pool worker establishment reaches a predecessor barrier, with the target remaining authority-valid. Assert the caller receives Cancellation/cancellation or Conflict/conflict (Rust variant and existing ErrorCategory), never R2d2/database. Assert a separately waiting healthy caller and a later retry remain independent and succeed after the predecessor closes. These witnesses must fail if the typed boundary result is replaced by the generic pool error.

For those actual cached/worker failure witnesses, also assert bounded completion for timeout and cancellation. Capture the elapsed-time origin before spawning the acquisition or release/cancellation child, then synchronize actual predecessor-barrier entry. Keep the predecessor held until the outcome assertion. Use the injected short predecessor deadline and an explicit scheduling allowance whose completion bound is strictly below the additional configured pool timeout. Assert timeout completion uses the original operation budget and cancellation returns promptly after its synchronized signal. Include multiple matching predecessors or a reservation recheck to reject refreshed budgets. Restoring a second full pool timeout or deferring cancellation through that timeout must fail the elapsed-time/completion assertion even if the eventual error category is correct. Preserve d-20261008-29's pre-spawn timing origin.

## Decisions and trade-offs

Entry remains build. The recorded decisions settle keying, authority, timeout and test synchronization, but none settles evicted-gate ownership and bounded retention.

Preserve d-20260904-01's injectable 60-second production timeout, d-20260913-02's pool key, d-20260913-03's lease-safe retirement, d-20260929-04's VFS authority, d-20260929-05's cross-directory refusal, and d-20261008-29/-30's synchronized test timing. O3 extends failed-drain safety, it does not reverse those decisions.

## Decided autonomously

* Question: Who owns evicted-but-draining gates and when are they pruned? Chosen: bounded repository retirement records using existing connection tickets, synchronous disposal outside the state mutex and opportunistic completed-record pruning. Rejected: evictor-local ownership alone (concurrent delete/reopen loses the barrier), an unbounded per-key list, or a background reaper. Reason: MANDATE requires future lookups and bounded retention, and no new process is needed. Reversal path: replace the registry only with a protocol proving the same lookup, capacity, failure and teardown-order invariants.
* Question: Does a fresh revision read count as a reopen? Chosen: yes, apply the same retired-predecessor barrier at read_revision without creating a pool. Rejected: fencing pool construction alone. Reason: a revision read is another SQLite establishment against the same authority-bound file. Reversal path: remove that barrier only if transient revision establishment can no longer overlap an evicted predecessor.
* Question: May close_retired_entry forget a gate after timeout or cancellation? Chosen: no, retain its undrained predecessor through the shared ownership contract. Rejected: removing the entry and forgetting its gate. Reason: a later delete can otherwise reproduce the same post-unlink close that MANDATE forbids. Reversal path: demonstrate another authoritative owner consulted by every future reopen/delete before removing this retention.
* Question: How are replacement names matched across filesystems? Chosen: same object OR retained parent identity, using authority identities already in EntryKey. Rejected: canonical path bytes or a new case-folding approximation. Reason: canonical_binding preserves the leaf's spelling and byte comparison can miss a replacement alias. Conservatively waiting for retired predecessors in the same parent gives a portable guarantee with bounded state. Reversal path: narrow parent matching only with authority-backed filesystem name equivalence and replacement witnesses on every supported platform.
* Question: Is construction the only pooled establishment boundary? Chosen: no, cached acquisition and actual manager establishment also use the predecessor barrier. Rejected: assuming every get creates a fresh pool. Reason: lock-only callers can cache a pool before its first SQLite connection and replenishment runs asynchronously. Reversal path: remove a boundary only if that path can no longer establish SQLite after predecessor retirement.

* Question: Which runtime executes the changed integration verifier? Chosen: preserve d-20261009-14's Node 24 native-codec route and explicitly validate its runtime and codec round-trip prerequisites before adoption proof. Rejected: treating the package's Node 20 minimum as verifier compatibility evidence, adding another serializer or changing the project's engine range within this task. Reason: the required integration proof must actually start with the changed import, and the existing current runtime already supports that route. Reversal path: a separately reviewed verifier-runtime compatibility change that preserves the canonical covered codec and demonstrates the same real-app proof.

## Risks / open questions

No product decision is needed. The code executor owns private helper names and test placement within the reviewed obligations. Preserve the known hard-link WAL and cross-capability hazards as separate findings f-20260929-05 and f-20261001-02. This plan covers retired predecessor barriers, not concurrent live alias pools or all transient-reader lifetimes.

Locate confirmed Codex CLI 0.162.0 and the cargo, pnpm, agent-gate, WebKitWebDriver, tauri-driver and kwin_wayland binaries. The planner worktree has no node_modules and runs no install or runtime proofs. Adoption must run pnpm install --frozen-lockfile, recheck the exact released-kit parity and runtime prerequisites, and use the shared gate wrappers. Existing verify:app comments record unrelated failure history. Current runtime status is unmeasured, not green evidence.

At NEW-BASE ca0ab68689e0f4de8ca0b84df2be29963bcfc66c, the verifier imports the production TypeScript codec directly. Its execution prerequisite is the Node 24 runtime chosen by d-20261009-14, observed here as v24.21.0. Check node --version before adoption and use that existing runtime for the prescribed commands. After dependency installation, prove native import and compressed round-trip of the actual serializeStorageValue/deserializeStorageValue module before the full app verifier. Package.json's broader Node engine range is not proof that this verifier runs on Node 20. A missing prerequisite fails adoption readiness, it never waives the real-app proof. No project engine-range change, codec duplication or new transpilation helper belongs to this retirement mandate.

## Not part of this task

Other db-search siblings remain open at their recorded tiers. No frontend, Specta signature, binding, schema, dependency, capability, VFS implementation or deletion-outcome change is planned. No claim of implemented or runtime-verified behavior is made by this planner.

## Phases

One cohesive sensitive phase owns `src-tauri/src/db/repository.rs`, production ownership plus its regression witnesses. Concurrency, resource lifetime and cancellation are touched. API signatures and persisted schemas are unchanged. Selected executor: codex, write role sensitive resolved through leaf-launch.sh and the model registry. No history fork is needed. The root integrates, arbitrates, verifies and commits in the adopting run.

Implement O1–O3 together so every retirement path and every barrier ships with its witnesses. Prefer the existing platform-neutral test module for common lifetime behavior. OS-specific WAL fixtures may stay platform-gated, but the central ownership and error/retry witnesses must run on Linux, macOS and Windows. Read async-resource-invariants.md, pgn-scanning.md and ipc-events.md before writing. No other source files are assigned.

Exact phase proof: `cargo test --manifest-path src-tauri/Cargo.toml db::repository:: -- --test-threads=1 && pnpm checks:pre-review`. Keep new regressions present while reverting only the task-owned production fix from its Git diff, record the expected assertion failures, restore, and rerun green. The adopter owns that proof, not the read-only planner.

After implementation and cumulative diff review, run `pnpm build && pnpm verify:app --screenshot /tmp/drain-plan-chessfable-0a459a4f-slot1/build/verify-ui/retirement-app.png` for real app startup/IPC/shutdown integration. It complements the deterministic Rust SQLite retirement witnesses, it does not directly prove the LRU race. No new standalone verifier is planned.

Final affected push gates: `pnpm gates:push -- --rust`, through the canonical detached push-gate route on the final clean HEAD. It includes backend tests/coverage, fmt/clippy, Windows compile checks, contract and kit parity. No ratchet changes. The release also requires `pnpm ci:remote:check` and successful rust-windows-test, rust-macos-test and rust-platform jobs on the pushed SHA. Run the project push skill, then verify HEAD equals upstream and applicable installation. Record the autonomous decisions and complete review handoff before final gates. Close f-20260930-01 only through findings.py after verified implementation.

## Carried to diff review

None.

## Reviews

### Round 1

Elapsed 598.5 seconds, adopted substantive issues 2. Active arbitration time and quota waits were not separately measured. No dependency wait was required. All 12 plan-capable lenses ran. The class-absent exits for chess-semantics, engine-protocol, ipc-contract, persisted-state and pgn-index are accepted against this backend resource-lifetime mandate.

I1 — platform-semantics r1 finding 1, should-fix, confidence 94. Fix adopted, awaiting closure. canonical_binding at path_authority/mod.rs:2073 preserves the leaf spelling. O1/O2 now retain and match parent identity instead of trusting path bytes. Same-parent retirement backpressure is an explicit technical trade-off. Dependencies: none.

I2 — plan r1 finding 1, blocker, confidence 90. Fix adopted, awaiting closure. repository.rs:753 and :986 allow lock-only caching with min_idle 0, :950 returns that cached entry and :1175 reaches establishment through get_connection. O2 now covers cached acquisition and actual worker establishment, with lifecycle witnesses. Dependencies: none.

Plan authorship and arbitration shared one context. Detection ran on the same model family selected for code execution. Codex role routing used review-plan for the plan lens and sensitive for the remaining applicable lenses. No source edits or runtime verification occurred.

#### Raw lens-correctness-r1

```text
No correctness defects found in O1–O3’s stated contracts.

Limitation: this is plan-only review. Reservation rechecks, capacity handling and teardown ordering require verification against the implementation (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-error-handling-r1

```text
VERDICT: APPROVED
```

#### Raw lens-minimalism-r1

```text
VERDICT: APPROVED
```

#### Raw lens-plan-r1

```text
[blocker] tasks/plans/2026-10-09-lru-sqlite-retirement.md:52 — O2 omits connection acquisition from an already cached replacement pool. Lock-only callers can cache a pool without opening SQLite (`src-tauri/src/db/repository.rs:753`, `:986`). Different identities at the same path have different keys (`:372`), so that replacement can remain cached when the old entry is later LRU-evicted. A subsequent acquisition returns the cached entry (`:950`) and calls `get_connection` (`:1175`), which can establish SQLite (`:263`) without passing through pool construction. The proposed boundaries therefore leave the same-path successor-open guarantee at plan line 56 unenforced. Cover cached acquisitions and require a lifecycle witness where the replacement is cached before predecessor eviction. (confidence: 90)

VERDICT: REVISE
```

#### Raw lens-tests-r1

```text
No findings. O1–O3 specify Rust lifecycle assertions that would fail on revert, including real LRU eviction, blocked successor opens/unlink, and retained barriers after cancellation or timeout. The repository selector and platform CI jobs include the proposed tests.

Limitation: this approves the planned proof. Implementation assertions and actual revert failures remain unverified (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-chess-semantics-r1

```text
NOT APPLICABLE: The assigned repository file and O1–O3 obligations concern SQLite connection retirement and drain ownership. They do not involve in-memory chess trees, positions, or move paths.
VERDICT: APPROVED
```

#### Raw lens-engine-protocol-r1

```text
NOT APPLICABLE: The sole file and O1–O3 obligations concern SQLite connection retirement, reopen, and deletion barriers. They do not involve engine process supervision, UCI protocol state, or asynchronous engine result routing.
VERDICT: APPROVED
```

#### Raw lens-ipc-contract-r1

```text
NOT APPLICABLE: O1–O3 cover internal SQLite retirement ownership and drain barriers in `src-tauri/src/db/repository.rs`. The plan changes no Rust↔renderer event, command, payload, subscription, capability scope, or shutdown contract.

VERDICT: APPROVED
```

#### Raw lens-persisted-state-r1

```text
NOT APPLICABLE: The assigned file is a Rust database repository. O1–O3 concern SQLite connection retirement and drain barriers, with no renderer storage keys, persisted atoms, hydration, or tab lifecycle changes.
VERDICT: APPROVED
```

#### Raw lens-pgn-index-r1

```text
NOT APPLICABLE: O1–O3 in `src-tauri/src/db/repository.rs` concern SQLite connection retirement and reopen/delete barriers. They do not change PGN byte scanning, offsets, move encoding, stored indexes, or search predicates.

VERDICT: APPROVED
```

#### Raw lens-platform-semantics-r1

```text
[should-fix] tasks/plans/2026-10-09-lru-sqlite-retirement.md:52 — On case-insensitive Windows filesystems, replacing `GameCase.db3` and authorizing its successor as `gamecase.db3` changes the object identity while preserving unequal canonical path spellings. `canonical_binding` preserves leaf casing (`src-tauri/src/infra/path_authority/mod.rs:2073`), so the proposed matching rule can miss the draining predecessor. Require filesystem-compatible name equivalence and a replacement witness using different casing at reopen, revision-read and deletion boundaries. (confidence: 94)

Limitation: This was a source-only plan review. No Windows compile check, non-Linux Unix source probe or runtime tests ran. Native runtime proof remains `rust-windows-test` and `rust-macos-test`. The `rust-platform` matrix supplies clippy/compile proof.

VERDICT: REVISE
```

#### Raw lens-tauri-security-r1

```text
No security-boundary defects found in O1–O3. The obligations retain predecessor ownership through SQLite close, fence reopen and unlink, and preserve barriers after cancellation or timeout.

Limitation: this is plan review only. Implementation and lifecycle witnesses remain unverified. Credential, session and signed-download flows are absent from the assigned change.

VERDICT: APPROVED
```


### Round 2

Elapsed 360.4 seconds, adopted substantive corrections 2 (I2 residual verification and I3 typed failure). I4 changes the review record only and is excluded from substantive adoption counts. Active arbitration time and quota waits were not separately measured. No dependency wait was required. Plan, platform-semantics, correctness, minimalism, tests and error-handling ran.

I1 — Fix closed at r2 by its platform witness and review-plan. Authority: frozen threat model includes authority-valid same-path replacement and aliases on Linux, macOS and Windows. Object OR retained-parent matching corrects the authority-spelling gap without changing pool keys. Source confirmation: repository.rs:1286 derives parent identity from its retained parent handle, path_authority/mod.rs:3706 supplies Unix device/inode or Windows handle identity.

I2 — Fix remains open at r2. review-plan r2 finding 1 is a residual blocker at confidence 90 and becomes a second witness of I2. Correctness and tests approved the establishment boundary, but review-plan found the predecessor self-ticket exception lacked its own executable witness. Confirmed repository.rs:257 admits its ticket before :263 establishes SQLite, and :197 can wait on that ticket until deadline if its own retired gate is included. Add the synchronized admitted-predecessor worker witness in O2. Authority: MANDATE names outstanding connection tickets and r2d2 replenishment as the concrete retirement trigger. Dependencies: none. First failed closure check for this lineage, no mechanism rewrite.

I3 — error-handling r2 finding 1, should-fix, confidence 90. Fix adopted, awaiting closure. Lineage: I2, correction-introduced establishment boundary. Dependencies: I2. Source confirmation: repository.rs:1656 maps pool.get through Error::from, :1297 preserves the original error when the target is valid. r2d2 0.8.10 src/lib.rs:273 stores a manager failure as text and retries. error.rs:447 maps R2d2 to Database. Authority: the frozen threat model includes cancellation and drain timeout, O3 preserves their existing safe failure behavior. Correct O2/O3 so worker barrier failure remains typed Conflict or Cancellation for the waiting operation, with no string-based classification or cross-caller contamination. No new IPC category or Error variant is required.

I4 — plan r2 finding 2, should-fix, confidence 100. Fix adopted, awaiting review-plan closure. Dependencies: I1, I2. The r1 rows omitted explicit Authority fields for the new matching and establishment mechanisms. The following additive supplement preserves the original history and records those authorities. No behavior change and no substantive adoption count.

| R1 issue | Authority | Evidence | Necessary correction |
| --- | --- | --- | --- |
| I1 | Frozen threat model: authority-valid same-path replacement and aliases on Linux, macOS and Windows. MANDATE: "same file". | path_authority/mod.rs:2078 appends the unchanged leaf spelling. repository.rs:1286 retains parent identity. | Match object OR parent identity so alias-spelled replacement cannot miss its predecessor. |
| I2 | MANDATE: r2d2 add_connection can retain a live or in-flight SQLite handle, and later deletion must drain it. Frozen threat model includes r2d2 replenishment workers. | repository.rs:753 and :986 cache an unopened pool, :950 returns it, :1175 and :263 establish later. | Fence cached and actual asynchronous establishment as well as construction. |

Plan authorship and arbitration shared one context. Detection ran on the same model family selected for code execution. No source edits or runtime verification occurred.

#### Raw lens-plan-r2

```text
CLOSED: I1 — Candidate O2 matches retained parent identity (`tasks/plans/2026-10-09-lru-sqlite-retirement.md:52`, `src-tauri/src/db/repository.rs:1286`), covering spelling differences preserved by `src-tauri/src/infra/path_authority/mod.rs:2078`.

STILL OPEN: I2 — The corrected boundaries include cached acquisition and manager establishment, but verification omits the added predecessor-worker self-ticket exception.

[blocker] tasks/plans/2026-10-09-lru-sqlite-retirement.md:58 — I2’s witnesses delay a successor worker and hold an established predecessor handle. Neither exercises a predecessor worker paused after ticket admission but before establishment (`src-tauri/src/db/repository.rs:257–263`). If retirement publishes that worker’s gate before it resumes, a barrier that waits on its own ticket stalls until timeout (`src-tauri/src/db/repository.rs:197`). Require a synchronized witness proving this worker completes or safely refuses establishment without waiting for its own ticket. The currently specified witnesses would not reject that implementation. (confidence: 90)

[should-fix] tasks/plans/2026-10-09-lru-sqlite-retirement.md:114 — The I1 and I2 adoption rows lack the required `Authority` entries. Classify the directory-wide matching and manager-establishment fencing as necessary correctness work against MANDATE, citing the spelling preservation and asynchronous establishment paths (`src-tauri/src/infra/path_authority/mod.rs:2078`, `src-tauri/src/db/repository.rs:256`). (confidence: 100)

Limitation: Source-only review. Implementation, runtime behavior and revert failures remain unverified (confidence: 100).

VERDICT: REVISE
```

#### Raw lens-platform-semantics-r2

```text
CLOSED: I1 — O1/O2 match object identity OR retained parent identity, covering differently spelled replacements on Windows and macOS. `repository.rs:1286` obtains parent identity from the retained handle. `path_authority/mod.rs:3706` uses Unix device/inode or Windows volume/file index. O2 requires casing-alias witnesses across acquisition, revision and deletion boundaries.

NOT MY CLASS: I2 — closure belongs to review-plan.

No new platform findings.

Limitation: source-only plan review. No tests, `pnpm rust:windows:check`, or non-Linux Unix source probe ran. Planned native runtime proof is `rust-windows-test` and `rust-macos-test`. The `rust-platform` matrix provides compile/clippy proof, including `-D warnings`.

VERDICT: APPROVED
```

#### Raw lens-correctness-r2

```text
CLOSED: I1 — O1/O2 match object OR retained parent identity, covering replacement spelling aliases with explicit same-parent blocking.

CLOSED: I2 — O2 fences cached acquisition and actual replenishment establishment, including self-ticket safety and reservation rechecks.

No correctness defects found in the revised contracts.

Limitation: plan-only review. Atomic publication, worker admission ordering, bounded capacity and timeout recovery remain implementation proof obligations (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-minimalism-r2

```text
NOT MY CLASS: I1 — platform-semantics owns alias-matching closure.
NOT MY CLASS: I2 — review-plan owns cached-acquisition and worker-establishment closure.

No bloat or duplication findings. The revised boundaries address concrete retirement bypasses. Shared ownership and matching have multiple required callers, and parent-identity matching avoids introducing filesystem-specific name equivalence machinery.

Limitation: implementation size and helper duplication remain unassessable until a source diff exists (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-tests-r2

```text
CLOSED: I1 — verification coverage now requires spelling-alias replacement witnesses at cached acquisition, revision and deletion boundaries, plus same-parent blocking and different-parent progress.

CLOSED: I2 — verification coverage now includes a replacement cached before eviction and delayed successor replenishment. The required assertion forbids actual successor SQLite establishment before predecessor close, so restoring either bypass would fail.

No verification findings. O1–O3 name Rust lifecycle assertions for real LRU retirement, bounded retention, protected-open/unlink ordering, and cancellation/timeout retry safety. The repository selector and platform CI test commands include the proposed witnesses. The plan explicitly requires keeping regression tests while reverting production changes and recording assertion failures.

Limitation: this closes the planned verification contracts only. Test implementations and actual revert failures remain unverified (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-error-handling-r2

```text
NOT MY CLASS: I1 — filesystem matching closure belongs to platform-semantics.
NOT MY CLASS: I2 — establishment-boundary closure belongs to plan.

[should-fix] tasks/plans/.plan-2026-10-09-lru-sqlite-retirement.md-r2.body.md:54 — O2 adds connection-manager barrier failures without specifying their typed caller outcome. When a delayed worker times out behind a predecessor while the target remains valid, r2d2 stringifies and retries its error. The existing `get_connection` path returns `Error::R2d2`, classification preserves it, and IPC surfaces category `database` with “database failure”. Require predecessor timeout/cancellation classification to survive this boundary, with a failure witness. O1’s explicit Cancellation/Conflict requirement covers capacity exhaustion only. (confidence: 90)

VERDICT: APPROVED
```


### Round 3

Elapsed 275.9 seconds, adopted substantive corrections 1 (I3 residual completion verification). Active arbitration time and quota waits were not separately measured. No dependency wait was required. Plan, error-handling, correctness and tests ran.

I2 — Fix closed at r3 by review-plan. O2 requires the admitted-predecessor worker completion/order witness. Its complete r1/r2 witnesses remain recorded.

I4 — Fix closed at r3 by review-plan. The additive Authority supplement records the frozen mandate/threat model and opened source supporting I1/I2.

I3 — Fix remains open at r3. Error-handling and correctness approved typed outcomes, but plan r3 finding 1 (blocker, confidence 90) and tests r3 finding 1 (should-fix, confidence 95) independently found the same missing bounded-completion witness. Deduplicate both into I3, no new issue ID. The current proof could pass after correctly classified failure plus an extra pool timeout. Confirmed repository.rs:1661 calls pool.get, :74 configures 2 seconds in tests and 30 seconds in production. The reviewed O2 forbids the second budget. Authority: frozen threat model includes cancellation and drain timeout. Add O3 completion/duration assertions with a pre-spawn origin, synchronized barrier and cancellation, a bound below the extra pool timeout and predecessor retention through the outcome assertion. Dependencies: I2. Lineage: I2. First failed closure check for I3.

Plan authorship and arbitration shared one context. Detection ran on the same model family selected for code execution. No source edits or runtime verification occurred.

#### Raw lens-plan-r3

```text
I2 CLOSED — PLAN `tasks/plans/.plan-2026-10-09-lru-sqlite-retirement.md-r3.body.md:62` now requires an admitted predecessor-worker witness that rejects self-waiting. It covers ticket admission before establishment at `src-tauri/src/db/repository.rs:257` and `:263`.

[blocker] I3 NOT CLOSED — PLAN `tasks/plans/.plan-2026-10-09-lru-sqlite-retirement.md-r3.body.md:58` forbids a second pool timeout, but its verification at `:72` asserts categories and retry independence without bounded completion. An implementation could retain `pool.get()` (`src-tauri/src/db/repository.rs:1661`), spend its additional configured timeout (`:74`), then return typed `Conflict` or `Cancellation` and satisfy those assertions. Require a synchronized completion bound that fails when acquisition adds another timeout or delays cancellation. (confidence: 90)

I4 CLOSED — The additive Authority supplement at `tasks/plans/2026-10-09-lru-sqlite-retirement.md:236` supplies both missing authorities, supported by spelling preservation at `src-tauri/src/infra/path_authority/mod.rs:2078` and delayed cached establishment at `src-tauri/src/db/repository.rs:986` and `:1175`.

VERDICT: REVISE
```

#### Raw lens-error-handling-r3

```text
I3 CLOSED — PLAN:57 requires operation-scoped Conflict/Cancellation through r2d2 transport, one shared deadline, and caller independence. PLAN:72 requires authority-valid cached-worker witnesses asserting Rust variants and IPC categories, retry success, and failure when generic pool errors replace typed results. Implementation proof remains pending.

VERDICT: APPROVED
```

#### Raw lens-tests-r3

```text
I2 CLOSED — O2 now requires a real predecessor worker paused after ticket admission, resumed after retirement publication. Its completion-before-deadline and ticket-release assertions would reject self-waiting.

I3 CLOSED — O3 requires actual cached-worker failures with an authority-valid target, asserts both Rust variant and ErrorCategory, and checks healthy-caller independence and retry success. Generic R2d2/database classification would fail.

[should-fix] tasks/plans/.plan-2026-10-09-lru-sqlite-retirement.md-r3.body.md:72 — The new prohibition on a second pool timeout has no corresponding duration assertion. Cached acquisition could exhaust the predecessor deadline, wait another pool timeout, then return correctly typed Conflict and pass every stated outcome/retry assertion. Require a synchronized deadline-bound assertion that fails when acquisition starts a second timeout budget. (confidence: 95)

Limitation: This checks planned proof contracts. Implemented assertions and measured revert failures remain unverified (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-correctness-r3

```text
I2 CLOSED — O2:54,62 requires cached and worker establishment fencing, plus a synchronized admitted-predecessor witness proving ticket release without self-wait or deadline expiry.

I3 CLOSED — O2:58 and O3:72 require operation-scoped Conflict/Cancellation through r2d2 transport, one shared deadline, and independent healthy callers and retries.

Limitation: plan-only review. Publication ordering, typed-result transport and actual lifecycle/revert assertions remain unverified until implementation (confidence: 100).

VERDICT: APPROVED
```


### Round 4

Elapsed 157.5 seconds, adopted substantive corrections 0. Active arbitration time and quota waits were not separately measured. No dependency wait was required. Plan, error-handling and tests ran, covering every I3 witness.

I3 — Fix closed at r4 by error-handling, tests and review-plan. O2/O3 require operation-scoped typed timeout/cancellation through worker transport, shared deadlines, healthy caller independence and actual failure/retry witnesses. The residual completion proof now rejects an added pool timeout or delayed cancellation using a synchronized bound measured from a pre-spawn origin. I1 remained closed at r2, I2 and I4 at r3.

Final disposition: four distinct issues, all Fix and closed. Seven raw prefixed findings are represented by metadata witnesses. I2 has two witnesses across r1/r2, I3 has three across r2/r3. No Skip, Defer, withdrawn mechanism, successor finding, or carried CR item. Dependencies: I3 depends on I2, I4 depends on I1/I2. Completed-round substantive adoption counts: r1=2 r2=2 r3=1 r4=0. No non-convergence trigger fired. Neither lineage failed two closure checks.

The authoritative phase obligations are O1–O3 and their verification levels. Same-parent conservative backpressure is explicit. Implementer helper structure remains unfrozen. Runtime, implementation size, atomic publication and platform execution remain unverified adoption work. The finding remains open and no ledger claim or closure was made.

Plan authorship and arbitration shared one context. Detection ran on the same model family selected for code execution. No source edits, installation, runtime tests, commit or push occurred.

#### Raw lens-plan-r4

```text
I3 CLOSED — `tasks/plans/.plan-2026-10-09-lru-sqlite-retirement.md-r4.body.md:74` requires synchronized completion assertions below the pool timeout, predecessor retention through outcome assertion, and failure when extra budgets or delayed cancellation return. This rejects the `pool.get()` delay at `src-tauri/src/db/repository.rs:1661`, configured as two seconds in tests at `:76`, while preserving O2’s typed-result and caller-independence requirements. Closure covers the planned proof. Implementation and measured revert failures remain unverified (confidence: 95).

VERDICT: APPROVED
```

#### Raw lens-tests-r4

```text
I3 CLOSED — PLAN:74 requires synchronized cached/worker timeout and cancellation completion assertions, measured from a pre-spawn origin while the predecessor remains held. The bound must fall below the additional pool timeout and fail when a second budget or delayed cancellation is restored. Multiple predecessors or a reservation recheck must also reject refreshed budgets. This closes the planned proof gap. Implemented assertions and measured revert failures remain unverified (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-error-handling-r4

```text
I3 CLOSED — PLAN:58,72,74 requires typed, operation-scoped Conflict/Cancellation and synchronized completion bounds below the additional pool timeout, with predecessors held through outcome assertions. Witnesses must reject refreshed budgets and delayed cancellation while preserving healthy-caller and retry independence. Implementation and measured revert failures remain pending.

VERDICT: APPROVED
```


### Round 5 — refresh drift

PLAN-REFRESH from BASE 8ebc643ef5569b29f269415a7b2f958c1e4e78c2 to NEW-BASE ca0ab68689e0f4de8ca0b84df2be29963bcfc66c. Elapsed 427.7 seconds, adopted substantive corrections 1. All 12 specified REFRESH-LENSES ran. Earlier r1-r4 history and issue dispositions are preserved. Active arbitration and quota waits were not separately measured. No dependency wait was required.

I5 — platform-semantics r5 finding 1, should-fix, confidence 98. Fix adopted, awaiting closure. Changed path: scripts/verify-app.mjs:508 now imports src/state/store/debouncedStorage.ts directly. Invalidated obligation: the plan Phases real-app startup/IPC/shutdown proof lacked its Node runtime prerequisite. Confirmed package.json:78 runs plain node and :174 permits Node >=20.19.0. Current node --version reports v24.21.0. Decision d-20261009-14 already chooses that native-codec execution route. Dependencies: none.

Authority: the existing Phases real-app integration proof must execute successfully and cannot be waived. Correction revision r6 explicitly requires the already chosen Node 24 runtime, version readiness and a native codec compressed round-trip before that unchanged full-app command. This is a proof-environment prerequisite, no source mechanism, engine-range change or reversal of d-20261009-14. Rejected expanding the SQLite mandate into generic verifier-runtime support. Reversal remains a separately reviewed compatibility change preserving the shared codec and full integration proof.

Source inference, not a Node 20 runtime measurement: [Node 20.19 ESM loader documentation](https://nodejs.org/download/release/v20.19.0/docs/api/esm.html#features) excludes the .ts extension, while [Node 24.21 TypeScript documentation](https://nodejs.org/download/release/v24.21.0/docs/api/typescript.html#type-stripping) describes native type stripping. No Node 20 executable, package installation or runtime verifier was run by this planner.

All other raw verdicts are APPROVED, with source-only limitations retained. The reviewer plan limitation about absent ROUND/DELTA refers to the first refresh drift round, which uses the exact process-generated source drift instead of inventing a plan revision. It does not withdraw r1-r4 closure evidence. The planned repository.rs source is byte-unchanged across the two bases. Existing unavailable remote CI is recorded by f-20261009-04 and remains an adoption precondition, no required gate is removed.

Plan authorship and arbitration shared one context. Detection ran on the same model family selected for code execution. No source edits, ledger mutation, install, runtime proof, commit or push occurred.

#### Raw lens-chess-semantics-r5

```text
No chess-semantics drift invalidation found. The tree schema refactor preserves FENs, metadata, child ordering and stored-path repair. The verifier’s new workspace fixture preserves the existing startup, IPC and shutdown checks required by the plan.

Limitation: runtime proofs were not rerun in this read-only review.

VERDICT: APPROVED
```

#### Raw lens-correctness-r5

```text
No correctness drift invalidation found. The workspace reload checks preserve the plan’s startup, IPC and shutdown proof.

Named limitation: the new direct `.ts` import in `scripts/verify-app.mjs:508` was not exercised on older Node versions allowed by `package.json`. Runtime compatibility remains unverified under this review’s no-test constraint (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-engine-protocol-r5

```text
No drift invalidation within this lens. Workspace initialization changes preserve tab identities without changing engine process keys or result routing. The added `scripts/verify-app.mjs` reload checks retain the existing startup/IPC/shutdown proof required by the plan.

Limitation: read-only source review. No runtime proofs rerun.

VERDICT: APPROVED
```

#### Raw lens-error-handling-r5

```text
No drift invalidation found. The changed reload verifier uses bounded polling, records failures with assertion context, and exits 1 on check or cleanup failure. The plan’s startup/IPC/shutdown integration proof remains applicable. O1–O3’s failure contracts are unchanged.

Limitation: runtime behavior was not rerun in this read-only review (confidence: 95 in the traced failure routing).

VERDICT: APPROVED
```

#### Raw lens-ipc-contract-r5

```text
No IPC drift invalidation found. The changes to `src/index.tsx` and `scripts/verify-app.mjs` preserve the registered `release_previous_document_operations` and `prepare_native_read` contracts, including exact-ticket checks for reload cancellation and window destruction. The added workspace assertions retain the plan’s startup, IPC and shutdown integration proof.

No event, command signature, generated binding or capability scope changed.

Limitation: runtime proof was not rerun in this read-only review. The adopting executor must run the plan’s prescribed integration command.

VERDICT: APPROVED
```

#### Raw lens-minimalism-r5

```text
No drift invalidation found in this lens. `scripts/verify-app.mjs` reuses the existing reload sequence and storage serializer without requiring another verifier or expanding the retirement implementation. O1–O3 and the existing startup/IPC/shutdown proof remain applicable.

Limitation: runtime status remains unmeasured in this read-only review.

VERDICT: APPROVED
```

#### Raw lens-persisted-state-r5

```text
No drift invalidation found. Workspace and tree writers/readers retain matching encoding, and unload flushing remains intact. The added reload assertions preserve the plan’s real startup/IPC/shutdown integration proof.

Limitation: read-only source review. No runtime tests rerun.

VERDICT: APPROVED
```

#### Raw lens-pgn-index-r5

```text
No drift invalidation. PGN scanning, indexing, database encoding, and repository source are unchanged. The verifier additions use the canonical serializer for workspace seeding and preserve existing PGN checks and the planned startup/IPC/shutdown proof.

Limitation: runtime proof was not rerun during this read-only review.

VERDICT: APPROVED
```

#### Raw lens-plan-r5

```text
No drift invalidation found. The changed workspace initialization and verifier preserve the integration proof at tasks/plans/.plan-2026-10-09-lru-sqlite-retirement.md-r5.body.md:108. scripts/verify-app.mjs:3399 adds workspace assertions while retaining titlebar shutdown checks at :3460 and failure propagation at :3651. The Rust repository source is unchanged.

Named limitations: runtime proofs were not rerun. No process-generated ROUND/DELTA/REVISED/SETTLED block was supplied, so this result covers the supplied source drift without re-establishing prior issue closure (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-platform-semantics-r5

```text
[should-fix] scripts/verify-app.mjs:509 — The drift adds a direct `.ts` import to the plain Node verifier. On Linux with supported Node 20.19 (`package.json:174`), loading fails with `ERR_UNKNOWN_FILE_EXTENSION` before app startup. This invalidates the plan’s required `pnpm verify:app` integration proof on that supported runtime. Recorded Node 24 success does not cover Node 20 (confidence: 98).

No Rust platform premise changed. No tests, Windows compile check or non-Linux Unix source probe ran. Windows and macOS runtime proof remains required through `rust-windows-test` and `rust-macos-test`, with `rust-platform` providing compile/clippy coverage.

VERDICT: REVISE
```

#### Raw lens-tauri-security-r5

```text
No security drift invalidation found. The workspace changes preserve the original path-owner snapshot and do not change credential storage. `scripts/verify-app.mjs` retains real IPC, reservation-sweep and shutdown assertions, preserving the plan’s integration-proof obligation.

Limitation: runtime proofs were not rerun during this read-only review.

VERDICT: APPROVED
```

#### Raw lens-tests-r5

```text
No drift invalidation found. `scripts/verify-app.mjs` preserves real startup, IPC, reservation-sweep and shutdown checks. Added reload assertions compare rendered tab IDs and selection against the seeded values, and failures produce exit code 1.

Limitation: runtime status remains unmeasured in this review. The planned Rust witnesses and revert proof remain required for O1–O3.

VERDICT: APPROVED
```


### plan-r7.md

# Plan: retain and drain LRU-evicted SQLite connections

## Goal

Resolve f-20260930-01 so an LRU-evicted pool cannot close SQLite handles after a later deletion or successor open of the same database. This is a PLAN-ONLY run at BASE 8ebc643ef5569b29f269415a7b2f958c1e4e78c2. Implementation belongs to the adopting session.

## MANDATE

### LRU eviction drops a database entry without draining its SQLite connections, so one can close after a later delete of the same file

* **ID:** f-20260930-01 · **Status:** open · **Area:** db-search · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/db/repository.rs` `evict_idle_entries` (~line 973, called under the repository state lock from `entry()` ~915); `close_retired_entry` (~952) and `DrainGate` (~109) are the drain every other retirement path uses since `3ed94336`.
* **Defect:** eviction removes an idle entry (`Arc::strong_count == 1`, no lease, not retiring) from `RepositoryState.entries` and drops it without closing its connection gate or waiting for outstanding connection tickets. An r2d2 `add_connection` job started by an earlier `get` can still hold an upgraded pool reference and a live or in-flight SQLite handle (the f-20260929-07 mechanism). A later `delete_exclusive_cancellable` of the same file then finds no entry, drains nothing, and unlinks while that handle is still open. The window is small (a replenishment job outliving the `get` that spawned it), reported by the repair leaf of the 2026-09-30 push review.
* **Why it matters:** it is the last retirement path that can close an SQLite handle (and unlink WAL/SHM) after the file was deleted or replaced, which every other path now excludes.
* **Proposed fix:** close the evicted entry's connection gate and drop its pool at eviction without blocking under the state lock, and keep the evicted gates reachable (for example a per-key list of draining gates in `RepositoryState`) so `delete_exclusive_inner` and `entry()` rebuild wait on them through `DrainGate::wait_drained` before unlinking or opening a fresh pool.
* **Open question:** where do evicted-but-draining gates live and who prunes them — a per-key list in `RepositoryState` pruned on drain, or eviction deferred to a path that may block — without holding the state lock across a wait?
* **Found by:** Codex write leaf (repair of the `8b97e423` push review), out-of-scope report; confirmed by the orchestrator from source, 2026-09-30. Related: `f-20260929-07`.

## Threat model and non-goals

Ordinary concurrent native database operations, r2d2 replenishment workers, cancellation, drain timeout, authority-valid same-path replacement and aliases on Linux, macOS and Windows. Preserve existing authority checks and bound VFS behavior. No new protection against malicious pathname churn, new cross-capability lifetime protocol, pool-key merger, hard-link WAL redesign, background service, watcher, shutdown redesign, or new renderer behavior.

## Traced premises

Frozen source trace at BASE, confirmed by the root and locate probe-1-r1:

* `repository.rs:1091` selects idle sole-owner LRU entries and removes them under the state mutex.
* `repository.rs:135`, `:252` and `:223` give each pooled SQLite open a ticket from before establishment until after SQLite and its binding close.
* r2d2 0.8.10 `src/lib.rs:230` upgrades a weak pool on its worker before connect and retains it through publication.
* `repository.rs:1664` closes connection admission and drops the pool before draining.
* `repository.rs:1070` removes a retired entry even if its drain returns an error, losing future lookup of that gate.
* `repository.rs:868` deletion reserves the canonical path but drains only the exact current entry.
* `repository.rs:929` owns pool construction through the building set and BuildGuard.
* `repository.rs:684` also opens a transient bound revision connection without constructing a pool.
* `repository.rs:372` keys pools by object, parent and path. `bound_sqlite.rs:188` reuses bindings, it does not drain predecessor connections.
* `db/mod.rs:2870` and `puzzle.rs:646` execute descriptor-bound unlink inside the repository deletion barrier.
* `repository.rs:2603`, `:2762`, `:2789`, `:2809`, and `:4855` contain cancellation, timeout, LRU and VFS/sidecar lifetime witnesses.
* `path_authority/mod.rs:962` supplies platform-neutral test targets. Most existing repository lifecycle tests are Unix-only at `repository.rs:1799`. The bound SQLite witness module at `:3293` is platform-neutral.

## Approach

### O1 — publish and bound predecessor ownership

Derived from MANDATE “keep the evicted gates reachable” and “without blocking under the state lock”. RepositoryState owns a bounded set of retirement records identified by predecessor object and retained parent identity. Limit records, including capacity reservations, to MAX_OPEN_DATABASES (16). Publish ownership and close new connection admission atomically with removing the eligible LRU entry. Keep its teardown visibly outstanding until pool and entry disposal have completed outside the repository state mutex. A zero count must prove that no evictor still owns a pool awaiting disposal, as well as that SQLite has closed every admitted handle.

Only closed, fully drained records may be pruned. Prune completed records opportunistically at retirement/admission boundaries, including when a different database is accessed, so churn through never-revisited names cannot accumulate records. Capacity exhaustion applies bounded cancellable backpressure outside the state mutex, returning Cancellation or Conflict on failure before losing a resource or publishing a cache entry whose required eviction cannot be owned. Preserve the existing active-lease LRU exception. No unrestricted per-key history and no background cleanup.

Verification level: deterministic Rust concurrency witnesses through real LRU selection. Assert the entry is eligible without an entry Arc or caller lease artificially pinning it, that connection admission closes, and that retirement ownership remains visible while an actual SQLite handle is held. An unrelated database operation in a different retained parent must still finish while predecessor teardown waits. Churn and saturation witnesses assert the record bound and recovery after tickets close.

### O2 — enforce the predecessor barrier at reopen and deletion

Derived from MANDATE “before unlinking or opening a fresh pool” and “same file”. Match retired predecessors by the same object identity OR the same retained parent identity, retaining the existing pool key and authority checks. Parent matching conservatively fences all retired predecessors in that directory. It catches replacements whose authority-valid leaf spelling changes on case-insensitive or Unicode-normalizing filesystems without inventing a string equivalence rule. It deliberately delays otherwise unrelated opens in that parent until its retired predecessors drain, never live pools in that parent.

Pool construction, connection acquisition from already cached pools, transient revision opens and the delete reservation must drain every matching predecessor before any corresponding SQLite establishment or unlink callback. Cover actual connection-manager establishment, including delayed r2d2 replenishment from a previously cached pool, so fencing synchronous acquisition alone cannot leave a worker bypass. Reuse one retirement matching/wait/pruning contract at those boundaries. An already admitted worker belonging to the retiring predecessor must not wait on its own connection ticket. Preserve its existing close ordering and count it in that predecessor's drain, or refuse its open safely after admission closes. No repository ownership cycle may be introduced through pool managers.

Waits release the repository state mutex. Coordinate their publication and recheck with the existing construction and deletion reservations so a newly published matching retirement cannot slip between the wait and protected operation. Keep active-lease conflicts and avoid waiting on a lease held by the same caller. Use one absolute deadline for each predecessor-barrier operation, not a fresh full timeout per predecessor or loop. Cancellation remains effective before destructive work begins. BoundDatabase lifetime and close ordering remain intact.

At every boundary, predecessor timeout returns the existing Error::Conflict and caller cancellation returns Error::Cancellation. Preserve that typed, operation-scoped result through cached acquisition even when r2d2 transports and retries manager errors as text. Do not infer the category by parsing those strings or let one caller's cancellation poison another caller or a later retry. A pool acquisition must not consume a second timeout after the predecessor deadline expires. No new public error category is required.

Verification level: synchronized Rust witnesses assert that same-key reopen, same-path replacement, same-object alias and deletion cannot establish a successor handle or run the unlink callback until the predecessor closes. Include a replacement cached by a lock-only caller before the predecessor is LRU-evicted, then acquired afterward, and a delayed successor-pool replenishment worker crossing that retirement boundary. Include the transient revision boundary. On filesystems accepting spelling aliases, replace GameCase.db3 and authorize gamecase.db3, then witness cached acquisition, revision and deletion barriers. Assert conservative same-parent blocking and different-parent progress. A real WAL fixture proves the predecessor's final close occurs before the successor's WAL/SHM can exist, and the successor remains queryable with its sidecars intact.

Also pause a real predecessor replenishment worker after its connection ticket is admitted but before SQLite establishment, make its entry genuinely LRU-eligible, publish retirement, and resume it. Synchronize at those lifecycle boundaries. Assert the worker completes or safely refuses establishment without waiting for its own ticket or the retirement deadline, releases the ticket, and allows the predecessor drain and successor barrier to finish. Keeping the regression while restoring self-waiting manager behavior must fail its completion/order assertion.

### O3 — retain barriers after incomplete drains

Derived from MANDATE “where evicted-but-draining gates live and who prunes them”. Timeout or cancellation must never discard or reopen a retired predecessor's connection gate. Release the waiting operation's temporary reservations, preserve predecessor ownership, and refuse its SQLite open or unlink. A retry after closure succeeds and removes completed bookkeeping.

Route LRU and the existing close_retired_entry removal through shared predecessor ownership. This also closes the same mechanism exposed when close_retired_entry currently removes an undrained gate on timeout or cancellation. Caller-lease cancellation before connection retirement keeps today's admission restoration. After connection retirement begins, reopening the caller lease must not make a retired pool reusable or remove its predecessor barrier.

Verification level: deterministically cancel during the connection-drain phase, and inject the shorter per-repository timeout. Assert no protected operation ran, an undrained predecessor remains discoverable, subsequent reopen/delete still waits or fails closed, and retry succeeds once the held connection is released.

Exercise cancellation and timeout after cached-pool worker establishment reaches a predecessor barrier, with the target remaining authority-valid. Assert the caller receives Cancellation/cancellation or Conflict/conflict (Rust variant and existing ErrorCategory), never R2d2/database. Assert a separately waiting healthy caller and a later retry remain independent and succeed after the predecessor closes. These witnesses must fail if the typed boundary result is replaced by the generic pool error.

For those actual cached/worker failure witnesses, also assert bounded completion for timeout and cancellation. Capture the elapsed-time origin before spawning the acquisition or release/cancellation child, then synchronize actual predecessor-barrier entry. Keep the predecessor held until the outcome assertion. Use the injected short predecessor deadline and an explicit scheduling allowance whose completion bound is strictly below the additional configured pool timeout. Assert timeout completion uses the original operation budget and cancellation returns promptly after its synchronized signal. Include multiple matching predecessors or a reservation recheck to reject refreshed budgets. Restoring a second full pool timeout or deferring cancellation through that timeout must fail the elapsed-time/completion assertion even if the eventual error category is correct. Preserve d-20261008-29's pre-spawn timing origin.

## Decisions and trade-offs

Entry remains build. The recorded decisions settle keying, authority, timeout and test synchronization, but none settles evicted-gate ownership and bounded retention.

Preserve d-20260904-01's injectable 60-second production timeout, d-20260913-02's pool key, d-20260913-03's lease-safe retirement, d-20260929-04's VFS authority, d-20260929-05's cross-directory refusal, and d-20261008-29/-30's synchronized test timing. O3 extends failed-drain safety, it does not reverse those decisions.

## Decided autonomously

* Question: Who owns evicted-but-draining gates and when are they pruned? Chosen: bounded repository retirement records using existing connection tickets, synchronous disposal outside the state mutex and opportunistic completed-record pruning. Rejected: evictor-local ownership alone (concurrent delete/reopen loses the barrier), an unbounded per-key list, or a background reaper. Reason: MANDATE requires future lookups and bounded retention, and no new process is needed. Reversal path: replace the registry only with a protocol proving the same lookup, capacity, failure and teardown-order invariants.
* Question: Does a fresh revision read count as a reopen? Chosen: yes, apply the same retired-predecessor barrier at read_revision without creating a pool. Rejected: fencing pool construction alone. Reason: a revision read is another SQLite establishment against the same authority-bound file. Reversal path: remove that barrier only if transient revision establishment can no longer overlap an evicted predecessor.
* Question: May close_retired_entry forget a gate after timeout or cancellation? Chosen: no, retain its undrained predecessor through the shared ownership contract. Rejected: removing the entry and forgetting its gate. Reason: a later delete can otherwise reproduce the same post-unlink close that MANDATE forbids. Reversal path: demonstrate another authoritative owner consulted by every future reopen/delete before removing this retention.
* Question: How are replacement names matched across filesystems? Chosen: same object OR retained parent identity, using authority identities already in EntryKey. Rejected: canonical path bytes or a new case-folding approximation. Reason: canonical_binding preserves the leaf's spelling and byte comparison can miss a replacement alias. Conservatively waiting for retired predecessors in the same parent gives a portable guarantee with bounded state. Reversal path: narrow parent matching only with authority-backed filesystem name equivalence and replacement witnesses on every supported platform.
* Question: Is construction the only pooled establishment boundary? Chosen: no, cached acquisition and actual manager establishment also use the predecessor barrier. Rejected: assuming every get creates a fresh pool. Reason: lock-only callers can cache a pool before its first SQLite connection and replenishment runs asynchronously. Reversal path: remove a boundary only if that path can no longer establish SQLite after predecessor retirement.

* Question: Which runtime executes the changed integration verifier? Chosen: preserve d-20261009-14's Node 24 native-codec route and explicitly validate its runtime and codec round-trip prerequisites before adoption proof. Rejected: treating the package's Node 20 minimum as verifier compatibility evidence, adding another serializer or changing the project's engine range within this task. Reason: the required integration proof must actually start with the changed import, and the existing current runtime already supports that route. Reversal path: a separately reviewed verifier-runtime compatibility change that preserves the canonical covered codec and demonstrates the same real-app proof.

## Risks / open questions

No product decision is needed. The code executor owns private helper names and test placement within the reviewed obligations. Preserve the known hard-link WAL and cross-capability hazards as separate findings f-20260929-05 and f-20261001-02. This plan covers retired predecessor barriers, not concurrent live alias pools or all transient-reader lifetimes.

Locate confirmed Codex CLI 0.162.0 and the cargo, pnpm, agent-gate, WebKitWebDriver, tauri-driver and kwin_wayland binaries. The planner worktree has no node_modules and runs no install or runtime proofs. Adoption must run pnpm install --frozen-lockfile, recheck the exact released-kit parity and runtime prerequisites, and use the shared gate wrappers. Existing verify:app comments record unrelated failure history. Current runtime status is unmeasured, not green evidence.

At NEW-BASE ca0ab68689e0f4de8ca0b84df2be29963bcfc66c, the verifier imports the production TypeScript codec directly. Its execution prerequisite is the Node 24 runtime chosen by d-20261009-14, observed here as v24.21.0. Check node --version before adoption and use that existing runtime for the prescribed commands. After dependency installation, prove native import and compressed round-trip of the actual serializeStorageValue/deserializeStorageValue module before the full app verifier. Package.json's broader Node engine range is not proof that this verifier runs on Node 20. A missing prerequisite fails adoption readiness, it never waives the real-app proof. No project engine-range change, codec duplication or new transpilation helper belongs to this retirement mandate.

## Not part of this task

Other db-search siblings remain open at their recorded tiers. No frontend, Specta signature, binding, schema, dependency, capability, VFS implementation or deletion-outcome change is planned. No claim of implemented or runtime-verified behavior is made by this planner.

## Phases

One cohesive sensitive phase owns `src-tauri/src/db/repository.rs`, production ownership plus its regression witnesses. Concurrency, resource lifetime and cancellation are touched. API signatures and persisted schemas are unchanged. Selected executor: codex, write role sensitive resolved through leaf-launch.sh and the model registry. No history fork is needed. The root integrates, arbitrates, verifies and commits in the adopting run.

Implement O1–O3 together so every retirement path and every barrier ships with its witnesses. Prefer the existing platform-neutral test module for common lifetime behavior. OS-specific WAL fixtures may stay platform-gated, but the central ownership and error/retry witnesses must run on Linux, macOS and Windows. Read async-resource-invariants.md, pgn-scanning.md and ipc-events.md before writing. No other source files are assigned.

Exact phase proof: `cargo test --manifest-path src-tauri/Cargo.toml db::repository:: -- --test-threads=1 && pnpm checks:pre-review`. Keep new regressions present while reverting only the task-owned production fix from its Git diff, record the expected assertion failures, restore, and rerun green. The adopter owns that proof, not the read-only planner.

After implementation and cumulative diff review, run `pnpm build && pnpm verify:app --screenshot /tmp/drain-plan-chessfable-0a459a4f-slot1/build/verify-ui/retirement-app.png` for real app startup/IPC/shutdown integration. It complements the deterministic Rust SQLite retirement witnesses, it does not directly prove the LRU race. No new standalone verifier is planned.

Final affected push gates: `pnpm gates:push -- --rust`, through the canonical detached push-gate route on the final clean HEAD. It includes backend tests/coverage, fmt/clippy, Windows compile checks, contract and kit parity. No ratchet changes. The release also requires `pnpm ci:remote:check` and successful rust-windows-test, rust-macos-test and rust-platform jobs on the pushed SHA. Run the project push skill, then verify HEAD equals upstream and applicable installation. Record the autonomous decisions and complete review handoff before final gates. Close f-20260930-01 only through findings.py after verified implementation.

## Carried to diff review

None.

## Reviews

### Round 1

Elapsed 598.5 seconds, adopted substantive issues 2. Active arbitration time and quota waits were not separately measured. No dependency wait was required. All 12 plan-capable lenses ran. The class-absent exits for chess-semantics, engine-protocol, ipc-contract, persisted-state and pgn-index are accepted against this backend resource-lifetime mandate.

I1 — platform-semantics r1 finding 1, should-fix, confidence 94. Fix adopted, awaiting closure. canonical_binding at path_authority/mod.rs:2073 preserves the leaf spelling. O1/O2 now retain and match parent identity instead of trusting path bytes. Same-parent retirement backpressure is an explicit technical trade-off. Dependencies: none.

I2 — plan r1 finding 1, blocker, confidence 90. Fix adopted, awaiting closure. repository.rs:753 and :986 allow lock-only caching with min_idle 0, :950 returns that cached entry and :1175 reaches establishment through get_connection. O2 now covers cached acquisition and actual worker establishment, with lifecycle witnesses. Dependencies: none.

Plan authorship and arbitration shared one context. Detection ran on the same model family selected for code execution. Codex role routing used review-plan for the plan lens and sensitive for the remaining applicable lenses. No source edits or runtime verification occurred.

#### Raw lens-correctness-r1

```text
No correctness defects found in O1–O3’s stated contracts.

Limitation: this is plan-only review. Reservation rechecks, capacity handling and teardown ordering require verification against the implementation (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-error-handling-r1

```text
VERDICT: APPROVED
```

#### Raw lens-minimalism-r1

```text
VERDICT: APPROVED
```

#### Raw lens-plan-r1

```text
[blocker] tasks/plans/2026-10-09-lru-sqlite-retirement.md:52 — O2 omits connection acquisition from an already cached replacement pool. Lock-only callers can cache a pool without opening SQLite (`src-tauri/src/db/repository.rs:753`, `:986`). Different identities at the same path have different keys (`:372`), so that replacement can remain cached when the old entry is later LRU-evicted. A subsequent acquisition returns the cached entry (`:950`) and calls `get_connection` (`:1175`), which can establish SQLite (`:263`) without passing through pool construction. The proposed boundaries therefore leave the same-path successor-open guarantee at plan line 56 unenforced. Cover cached acquisitions and require a lifecycle witness where the replacement is cached before predecessor eviction. (confidence: 90)

VERDICT: REVISE
```

#### Raw lens-tests-r1

```text
No findings. O1–O3 specify Rust lifecycle assertions that would fail on revert, including real LRU eviction, blocked successor opens/unlink, and retained barriers after cancellation or timeout. The repository selector and platform CI jobs include the proposed tests.

Limitation: this approves the planned proof. Implementation assertions and actual revert failures remain unverified (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-chess-semantics-r1

```text
NOT APPLICABLE: The assigned repository file and O1–O3 obligations concern SQLite connection retirement and drain ownership. They do not involve in-memory chess trees, positions, or move paths.
VERDICT: APPROVED
```

#### Raw lens-engine-protocol-r1

```text
NOT APPLICABLE: The sole file and O1–O3 obligations concern SQLite connection retirement, reopen, and deletion barriers. They do not involve engine process supervision, UCI protocol state, or asynchronous engine result routing.
VERDICT: APPROVED
```

#### Raw lens-ipc-contract-r1

```text
NOT APPLICABLE: O1–O3 cover internal SQLite retirement ownership and drain barriers in `src-tauri/src/db/repository.rs`. The plan changes no Rust↔renderer event, command, payload, subscription, capability scope, or shutdown contract.

VERDICT: APPROVED
```

#### Raw lens-persisted-state-r1

```text
NOT APPLICABLE: The assigned file is a Rust database repository. O1–O3 concern SQLite connection retirement and drain barriers, with no renderer storage keys, persisted atoms, hydration, or tab lifecycle changes.
VERDICT: APPROVED
```

#### Raw lens-pgn-index-r1

```text
NOT APPLICABLE: O1–O3 in `src-tauri/src/db/repository.rs` concern SQLite connection retirement and reopen/delete barriers. They do not change PGN byte scanning, offsets, move encoding, stored indexes, or search predicates.

VERDICT: APPROVED
```

#### Raw lens-platform-semantics-r1

```text
[should-fix] tasks/plans/2026-10-09-lru-sqlite-retirement.md:52 — On case-insensitive Windows filesystems, replacing `GameCase.db3` and authorizing its successor as `gamecase.db3` changes the object identity while preserving unequal canonical path spellings. `canonical_binding` preserves leaf casing (`src-tauri/src/infra/path_authority/mod.rs:2073`), so the proposed matching rule can miss the draining predecessor. Require filesystem-compatible name equivalence and a replacement witness using different casing at reopen, revision-read and deletion boundaries. (confidence: 94)

Limitation: This was a source-only plan review. No Windows compile check, non-Linux Unix source probe or runtime tests ran. Native runtime proof remains `rust-windows-test` and `rust-macos-test`. The `rust-platform` matrix supplies clippy/compile proof.

VERDICT: REVISE
```

#### Raw lens-tauri-security-r1

```text
No security-boundary defects found in O1–O3. The obligations retain predecessor ownership through SQLite close, fence reopen and unlink, and preserve barriers after cancellation or timeout.

Limitation: this is plan review only. Implementation and lifecycle witnesses remain unverified. Credential, session and signed-download flows are absent from the assigned change.

VERDICT: APPROVED
```


### Round 2

Elapsed 360.4 seconds, adopted substantive corrections 2 (I2 residual verification and I3 typed failure). I4 changes the review record only and is excluded from substantive adoption counts. Active arbitration time and quota waits were not separately measured. No dependency wait was required. Plan, platform-semantics, correctness, minimalism, tests and error-handling ran.

I1 — Fix closed at r2 by its platform witness and review-plan. Authority: frozen threat model includes authority-valid same-path replacement and aliases on Linux, macOS and Windows. Object OR retained-parent matching corrects the authority-spelling gap without changing pool keys. Source confirmation: repository.rs:1286 derives parent identity from its retained parent handle, path_authority/mod.rs:3706 supplies Unix device/inode or Windows handle identity.

I2 — Fix remains open at r2. review-plan r2 finding 1 is a residual blocker at confidence 90 and becomes a second witness of I2. Correctness and tests approved the establishment boundary, but review-plan found the predecessor self-ticket exception lacked its own executable witness. Confirmed repository.rs:257 admits its ticket before :263 establishes SQLite, and :197 can wait on that ticket until deadline if its own retired gate is included. Add the synchronized admitted-predecessor worker witness in O2. Authority: MANDATE names outstanding connection tickets and r2d2 replenishment as the concrete retirement trigger. Dependencies: none. First failed closure check for this lineage, no mechanism rewrite.

I3 — error-handling r2 finding 1, should-fix, confidence 90. Fix adopted, awaiting closure. Lineage: I2, correction-introduced establishment boundary. Dependencies: I2. Source confirmation: repository.rs:1656 maps pool.get through Error::from, :1297 preserves the original error when the target is valid. r2d2 0.8.10 src/lib.rs:273 stores a manager failure as text and retries. error.rs:447 maps R2d2 to Database. Authority: the frozen threat model includes cancellation and drain timeout, O3 preserves their existing safe failure behavior. Correct O2/O3 so worker barrier failure remains typed Conflict or Cancellation for the waiting operation, with no string-based classification or cross-caller contamination. No new IPC category or Error variant is required.

I4 — plan r2 finding 2, should-fix, confidence 100. Fix adopted, awaiting review-plan closure. Dependencies: I1, I2. The r1 rows omitted explicit Authority fields for the new matching and establishment mechanisms. The following additive supplement preserves the original history and records those authorities. No behavior change and no substantive adoption count.

| R1 issue | Authority | Evidence | Necessary correction |
| --- | --- | --- | --- |
| I1 | Frozen threat model: authority-valid same-path replacement and aliases on Linux, macOS and Windows. MANDATE: "same file". | path_authority/mod.rs:2078 appends the unchanged leaf spelling. repository.rs:1286 retains parent identity. | Match object OR parent identity so alias-spelled replacement cannot miss its predecessor. |
| I2 | MANDATE: r2d2 add_connection can retain a live or in-flight SQLite handle, and later deletion must drain it. Frozen threat model includes r2d2 replenishment workers. | repository.rs:753 and :986 cache an unopened pool, :950 returns it, :1175 and :263 establish later. | Fence cached and actual asynchronous establishment as well as construction. |

Plan authorship and arbitration shared one context. Detection ran on the same model family selected for code execution. No source edits or runtime verification occurred.

#### Raw lens-plan-r2

```text
CLOSED: I1 — Candidate O2 matches retained parent identity (`tasks/plans/2026-10-09-lru-sqlite-retirement.md:52`, `src-tauri/src/db/repository.rs:1286`), covering spelling differences preserved by `src-tauri/src/infra/path_authority/mod.rs:2078`.

STILL OPEN: I2 — The corrected boundaries include cached acquisition and manager establishment, but verification omits the added predecessor-worker self-ticket exception.

[blocker] tasks/plans/2026-10-09-lru-sqlite-retirement.md:58 — I2’s witnesses delay a successor worker and hold an established predecessor handle. Neither exercises a predecessor worker paused after ticket admission but before establishment (`src-tauri/src/db/repository.rs:257–263`). If retirement publishes that worker’s gate before it resumes, a barrier that waits on its own ticket stalls until timeout (`src-tauri/src/db/repository.rs:197`). Require a synchronized witness proving this worker completes or safely refuses establishment without waiting for its own ticket. The currently specified witnesses would not reject that implementation. (confidence: 90)

[should-fix] tasks/plans/2026-10-09-lru-sqlite-retirement.md:114 — The I1 and I2 adoption rows lack the required `Authority` entries. Classify the directory-wide matching and manager-establishment fencing as necessary correctness work against MANDATE, citing the spelling preservation and asynchronous establishment paths (`src-tauri/src/infra/path_authority/mod.rs:2078`, `src-tauri/src/db/repository.rs:256`). (confidence: 100)

Limitation: Source-only review. Implementation, runtime behavior and revert failures remain unverified (confidence: 100).

VERDICT: REVISE
```

#### Raw lens-platform-semantics-r2

```text
CLOSED: I1 — O1/O2 match object identity OR retained parent identity, covering differently spelled replacements on Windows and macOS. `repository.rs:1286` obtains parent identity from the retained handle. `path_authority/mod.rs:3706` uses Unix device/inode or Windows volume/file index. O2 requires casing-alias witnesses across acquisition, revision and deletion boundaries.

NOT MY CLASS: I2 — closure belongs to review-plan.

No new platform findings.

Limitation: source-only plan review. No tests, `pnpm rust:windows:check`, or non-Linux Unix source probe ran. Planned native runtime proof is `rust-windows-test` and `rust-macos-test`. The `rust-platform` matrix provides compile/clippy proof, including `-D warnings`.

VERDICT: APPROVED
```

#### Raw lens-correctness-r2

```text
CLOSED: I1 — O1/O2 match object OR retained parent identity, covering replacement spelling aliases with explicit same-parent blocking.

CLOSED: I2 — O2 fences cached acquisition and actual replenishment establishment, including self-ticket safety and reservation rechecks.

No correctness defects found in the revised contracts.

Limitation: plan-only review. Atomic publication, worker admission ordering, bounded capacity and timeout recovery remain implementation proof obligations (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-minimalism-r2

```text
NOT MY CLASS: I1 — platform-semantics owns alias-matching closure.
NOT MY CLASS: I2 — review-plan owns cached-acquisition and worker-establishment closure.

No bloat or duplication findings. The revised boundaries address concrete retirement bypasses. Shared ownership and matching have multiple required callers, and parent-identity matching avoids introducing filesystem-specific name equivalence machinery.

Limitation: implementation size and helper duplication remain unassessable until a source diff exists (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-tests-r2

```text
CLOSED: I1 — verification coverage now requires spelling-alias replacement witnesses at cached acquisition, revision and deletion boundaries, plus same-parent blocking and different-parent progress.

CLOSED: I2 — verification coverage now includes a replacement cached before eviction and delayed successor replenishment. The required assertion forbids actual successor SQLite establishment before predecessor close, so restoring either bypass would fail.

No verification findings. O1–O3 name Rust lifecycle assertions for real LRU retirement, bounded retention, protected-open/unlink ordering, and cancellation/timeout retry safety. The repository selector and platform CI test commands include the proposed witnesses. The plan explicitly requires keeping regression tests while reverting production changes and recording assertion failures.

Limitation: this closes the planned verification contracts only. Test implementations and actual revert failures remain unverified (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-error-handling-r2

```text
NOT MY CLASS: I1 — filesystem matching closure belongs to platform-semantics.
NOT MY CLASS: I2 — establishment-boundary closure belongs to plan.

[should-fix] tasks/plans/.plan-2026-10-09-lru-sqlite-retirement.md-r2.body.md:54 — O2 adds connection-manager barrier failures without specifying their typed caller outcome. When a delayed worker times out behind a predecessor while the target remains valid, r2d2 stringifies and retries its error. The existing `get_connection` path returns `Error::R2d2`, classification preserves it, and IPC surfaces category `database` with “database failure”. Require predecessor timeout/cancellation classification to survive this boundary, with a failure witness. O1’s explicit Cancellation/Conflict requirement covers capacity exhaustion only. (confidence: 90)

VERDICT: APPROVED
```


### Round 3

Elapsed 275.9 seconds, adopted substantive corrections 1 (I3 residual completion verification). Active arbitration time and quota waits were not separately measured. No dependency wait was required. Plan, error-handling, correctness and tests ran.

I2 — Fix closed at r3 by review-plan. O2 requires the admitted-predecessor worker completion/order witness. Its complete r1/r2 witnesses remain recorded.

I4 — Fix closed at r3 by review-plan. The additive Authority supplement records the frozen mandate/threat model and opened source supporting I1/I2.

I3 — Fix remains open at r3. Error-handling and correctness approved typed outcomes, but plan r3 finding 1 (blocker, confidence 90) and tests r3 finding 1 (should-fix, confidence 95) independently found the same missing bounded-completion witness. Deduplicate both into I3, no new issue ID. The current proof could pass after correctly classified failure plus an extra pool timeout. Confirmed repository.rs:1661 calls pool.get, :74 configures 2 seconds in tests and 30 seconds in production. The reviewed O2 forbids the second budget. Authority: frozen threat model includes cancellation and drain timeout. Add O3 completion/duration assertions with a pre-spawn origin, synchronized barrier and cancellation, a bound below the extra pool timeout and predecessor retention through the outcome assertion. Dependencies: I2. Lineage: I2. First failed closure check for I3.

Plan authorship and arbitration shared one context. Detection ran on the same model family selected for code execution. No source edits or runtime verification occurred.

#### Raw lens-plan-r3

```text
I2 CLOSED — PLAN `tasks/plans/.plan-2026-10-09-lru-sqlite-retirement.md-r3.body.md:62` now requires an admitted predecessor-worker witness that rejects self-waiting. It covers ticket admission before establishment at `src-tauri/src/db/repository.rs:257` and `:263`.

[blocker] I3 NOT CLOSED — PLAN `tasks/plans/.plan-2026-10-09-lru-sqlite-retirement.md-r3.body.md:58` forbids a second pool timeout, but its verification at `:72` asserts categories and retry independence without bounded completion. An implementation could retain `pool.get()` (`src-tauri/src/db/repository.rs:1661`), spend its additional configured timeout (`:74`), then return typed `Conflict` or `Cancellation` and satisfy those assertions. Require a synchronized completion bound that fails when acquisition adds another timeout or delays cancellation. (confidence: 90)

I4 CLOSED — The additive Authority supplement at `tasks/plans/2026-10-09-lru-sqlite-retirement.md:236` supplies both missing authorities, supported by spelling preservation at `src-tauri/src/infra/path_authority/mod.rs:2078` and delayed cached establishment at `src-tauri/src/db/repository.rs:986` and `:1175`.

VERDICT: REVISE
```

#### Raw lens-error-handling-r3

```text
I3 CLOSED — PLAN:57 requires operation-scoped Conflict/Cancellation through r2d2 transport, one shared deadline, and caller independence. PLAN:72 requires authority-valid cached-worker witnesses asserting Rust variants and IPC categories, retry success, and failure when generic pool errors replace typed results. Implementation proof remains pending.

VERDICT: APPROVED
```

#### Raw lens-tests-r3

```text
I2 CLOSED — O2 now requires a real predecessor worker paused after ticket admission, resumed after retirement publication. Its completion-before-deadline and ticket-release assertions would reject self-waiting.

I3 CLOSED — O3 requires actual cached-worker failures with an authority-valid target, asserts both Rust variant and ErrorCategory, and checks healthy-caller independence and retry success. Generic R2d2/database classification would fail.

[should-fix] tasks/plans/.plan-2026-10-09-lru-sqlite-retirement.md-r3.body.md:72 — The new prohibition on a second pool timeout has no corresponding duration assertion. Cached acquisition could exhaust the predecessor deadline, wait another pool timeout, then return correctly typed Conflict and pass every stated outcome/retry assertion. Require a synchronized deadline-bound assertion that fails when acquisition starts a second timeout budget. (confidence: 95)

Limitation: This checks planned proof contracts. Implemented assertions and measured revert failures remain unverified (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-correctness-r3

```text
I2 CLOSED — O2:54,62 requires cached and worker establishment fencing, plus a synchronized admitted-predecessor witness proving ticket release without self-wait or deadline expiry.

I3 CLOSED — O2:58 and O3:72 require operation-scoped Conflict/Cancellation through r2d2 transport, one shared deadline, and independent healthy callers and retries.

Limitation: plan-only review. Publication ordering, typed-result transport and actual lifecycle/revert assertions remain unverified until implementation (confidence: 100).

VERDICT: APPROVED
```


### Round 4

Elapsed 157.5 seconds, adopted substantive corrections 0. Active arbitration time and quota waits were not separately measured. No dependency wait was required. Plan, error-handling and tests ran, covering every I3 witness.

I3 — Fix closed at r4 by error-handling, tests and review-plan. O2/O3 require operation-scoped typed timeout/cancellation through worker transport, shared deadlines, healthy caller independence and actual failure/retry witnesses. The residual completion proof now rejects an added pool timeout or delayed cancellation using a synchronized bound measured from a pre-spawn origin. I1 remained closed at r2, I2 and I4 at r3.

Final disposition: four distinct issues, all Fix and closed. Seven raw prefixed findings are represented by metadata witnesses. I2 has two witnesses across r1/r2, I3 has three across r2/r3. No Skip, Defer, withdrawn mechanism, successor finding, or carried CR item. Dependencies: I3 depends on I2, I4 depends on I1/I2. Completed-round substantive adoption counts: r1=2 r2=2 r3=1 r4=0. No non-convergence trigger fired. Neither lineage failed two closure checks.

The authoritative phase obligations are O1–O3 and their verification levels. Same-parent conservative backpressure is explicit. Implementer helper structure remains unfrozen. Runtime, implementation size, atomic publication and platform execution remain unverified adoption work. The finding remains open and no ledger claim or closure was made.

Plan authorship and arbitration shared one context. Detection ran on the same model family selected for code execution. No source edits, installation, runtime tests, commit or push occurred.

#### Raw lens-plan-r4

```text
I3 CLOSED — `tasks/plans/.plan-2026-10-09-lru-sqlite-retirement.md-r4.body.md:74` requires synchronized completion assertions below the pool timeout, predecessor retention through outcome assertion, and failure when extra budgets or delayed cancellation return. This rejects the `pool.get()` delay at `src-tauri/src/db/repository.rs:1661`, configured as two seconds in tests at `:76`, while preserving O2’s typed-result and caller-independence requirements. Closure covers the planned proof. Implementation and measured revert failures remain unverified (confidence: 95).

VERDICT: APPROVED
```

#### Raw lens-tests-r4

```text
I3 CLOSED — PLAN:74 requires synchronized cached/worker timeout and cancellation completion assertions, measured from a pre-spawn origin while the predecessor remains held. The bound must fall below the additional pool timeout and fail when a second budget or delayed cancellation is restored. Multiple predecessors or a reservation recheck must also reject refreshed budgets. This closes the planned proof gap. Implemented assertions and measured revert failures remain unverified (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-error-handling-r4

```text
I3 CLOSED — PLAN:58,72,74 requires typed, operation-scoped Conflict/Cancellation and synchronized completion bounds below the additional pool timeout, with predecessors held through outcome assertions. Witnesses must reject refreshed budgets and delayed cancellation while preserving healthy-caller and retry independence. Implementation and measured revert failures remain pending.

VERDICT: APPROVED
```


### Round 5 — refresh drift

PLAN-REFRESH from BASE 8ebc643ef5569b29f269415a7b2f958c1e4e78c2 to NEW-BASE ca0ab68689e0f4de8ca0b84df2be29963bcfc66c. Elapsed 427.7 seconds, adopted substantive corrections 1. All 12 specified REFRESH-LENSES ran. Earlier r1-r4 history and issue dispositions are preserved. Active arbitration and quota waits were not separately measured. No dependency wait was required.

I5 — platform-semantics r5 finding 1, should-fix, confidence 98. Fix adopted, awaiting closure. Changed path: scripts/verify-app.mjs:508 now imports src/state/store/debouncedStorage.ts directly. Invalidated obligation: the plan Phases real-app startup/IPC/shutdown proof lacked its Node runtime prerequisite. Confirmed package.json:78 runs plain node and :174 permits Node >=20.19.0. Current node --version reports v24.21.0. Decision d-20261009-14 already chooses that native-codec execution route. Dependencies: none.

Authority: the existing Phases real-app integration proof must execute successfully and cannot be waived. Correction revision r6 explicitly requires the already chosen Node 24 runtime, version readiness and a native codec compressed round-trip before that unchanged full-app command. This is a proof-environment prerequisite, no source mechanism, engine-range change or reversal of d-20261009-14. Rejected expanding the SQLite mandate into generic verifier-runtime support. Reversal remains a separately reviewed compatibility change preserving the shared codec and full integration proof.

Source inference, not a Node 20 runtime measurement: [Node 20.19 ESM loader documentation](https://nodejs.org/download/release/v20.19.0/docs/api/esm.html#features) excludes the .ts extension, while [Node 24.21 TypeScript documentation](https://nodejs.org/download/release/v24.21.0/docs/api/typescript.html#type-stripping) describes native type stripping. No Node 20 executable, package installation or runtime verifier was run by this planner.

All other raw verdicts are APPROVED, with source-only limitations retained. The reviewer plan limitation about absent ROUND/DELTA refers to the first refresh drift round, which uses the exact process-generated source drift instead of inventing a plan revision. It does not withdraw r1-r4 closure evidence. The planned repository.rs source is byte-unchanged across the two bases. Existing unavailable remote CI is recorded by f-20261009-04 and remains an adoption precondition, no required gate is removed.

Plan authorship and arbitration shared one context. Detection ran on the same model family selected for code execution. No source edits, ledger mutation, install, runtime proof, commit or push occurred.

#### Raw lens-chess-semantics-r5

```text
No chess-semantics drift invalidation found. The tree schema refactor preserves FENs, metadata, child ordering and stored-path repair. The verifier’s new workspace fixture preserves the existing startup, IPC and shutdown checks required by the plan.

Limitation: runtime proofs were not rerun in this read-only review.

VERDICT: APPROVED
```

#### Raw lens-correctness-r5

```text
No correctness drift invalidation found. The workspace reload checks preserve the plan’s startup, IPC and shutdown proof.

Named limitation: the new direct `.ts` import in `scripts/verify-app.mjs:508` was not exercised on older Node versions allowed by `package.json`. Runtime compatibility remains unverified under this review’s no-test constraint (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-engine-protocol-r5

```text
No drift invalidation within this lens. Workspace initialization changes preserve tab identities without changing engine process keys or result routing. The added `scripts/verify-app.mjs` reload checks retain the existing startup/IPC/shutdown proof required by the plan.

Limitation: read-only source review. No runtime proofs rerun.

VERDICT: APPROVED
```

#### Raw lens-error-handling-r5

```text
No drift invalidation found. The changed reload verifier uses bounded polling, records failures with assertion context, and exits 1 on check or cleanup failure. The plan’s startup/IPC/shutdown integration proof remains applicable. O1–O3’s failure contracts are unchanged.

Limitation: runtime behavior was not rerun in this read-only review (confidence: 95 in the traced failure routing).

VERDICT: APPROVED
```

#### Raw lens-ipc-contract-r5

```text
No IPC drift invalidation found. The changes to `src/index.tsx` and `scripts/verify-app.mjs` preserve the registered `release_previous_document_operations` and `prepare_native_read` contracts, including exact-ticket checks for reload cancellation and window destruction. The added workspace assertions retain the plan’s startup, IPC and shutdown integration proof.

No event, command signature, generated binding or capability scope changed.

Limitation: runtime proof was not rerun in this read-only review. The adopting executor must run the plan’s prescribed integration command.

VERDICT: APPROVED
```

#### Raw lens-minimalism-r5

```text
No drift invalidation found in this lens. `scripts/verify-app.mjs` reuses the existing reload sequence and storage serializer without requiring another verifier or expanding the retirement implementation. O1–O3 and the existing startup/IPC/shutdown proof remain applicable.

Limitation: runtime status remains unmeasured in this read-only review.

VERDICT: APPROVED
```

#### Raw lens-persisted-state-r5

```text
No drift invalidation found. Workspace and tree writers/readers retain matching encoding, and unload flushing remains intact. The added reload assertions preserve the plan’s real startup/IPC/shutdown integration proof.

Limitation: read-only source review. No runtime tests rerun.

VERDICT: APPROVED
```

#### Raw lens-pgn-index-r5

```text
No drift invalidation. PGN scanning, indexing, database encoding, and repository source are unchanged. The verifier additions use the canonical serializer for workspace seeding and preserve existing PGN checks and the planned startup/IPC/shutdown proof.

Limitation: runtime proof was not rerun during this read-only review.

VERDICT: APPROVED
```

#### Raw lens-plan-r5

```text
No drift invalidation found. The changed workspace initialization and verifier preserve the integration proof at tasks/plans/.plan-2026-10-09-lru-sqlite-retirement.md-r5.body.md:108. scripts/verify-app.mjs:3399 adds workspace assertions while retaining titlebar shutdown checks at :3460 and failure propagation at :3651. The Rust repository source is unchanged.

Named limitations: runtime proofs were not rerun. No process-generated ROUND/DELTA/REVISED/SETTLED block was supplied, so this result covers the supplied source drift without re-establishing prior issue closure (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-platform-semantics-r5

```text
[should-fix] scripts/verify-app.mjs:509 — The drift adds a direct `.ts` import to the plain Node verifier. On Linux with supported Node 20.19 (`package.json:174`), loading fails with `ERR_UNKNOWN_FILE_EXTENSION` before app startup. This invalidates the plan’s required `pnpm verify:app` integration proof on that supported runtime. Recorded Node 24 success does not cover Node 20 (confidence: 98).

No Rust platform premise changed. No tests, Windows compile check or non-Linux Unix source probe ran. Windows and macOS runtime proof remains required through `rust-windows-test` and `rust-macos-test`, with `rust-platform` providing compile/clippy coverage.

VERDICT: REVISE
```

#### Raw lens-tauri-security-r5

```text
No security drift invalidation found. The workspace changes preserve the original path-owner snapshot and do not change credential storage. `scripts/verify-app.mjs` retains real IPC, reservation-sweep and shutdown assertions, preserving the plan’s integration-proof obligation.

Limitation: runtime proofs were not rerun during this read-only review.

VERDICT: APPROVED
```

#### Raw lens-tests-r5

```text
No drift invalidation found. `scripts/verify-app.mjs` preserves real startup, IPC, reservation-sweep and shutdown checks. Added reload assertions compare rendered tab IDs and selection against the seeded values, and failures produce exit code 1.

Limitation: runtime status remains unmeasured in this review. The planned Rust witnesses and revert proof remain required for O1–O3.

VERDICT: APPROVED
```


### Round 6 — refresh correction closure

Elapsed 147.9 seconds, adopted substantive corrections 0. Plan, platform-semantics, tests and minimalism checked the runtime-prerequisite correction. Active arbitration and quota waits were not separately measured. No dependency wait was required.

I5 — Fix closed at r6 by platform-semantics and review-plan. The required full app proof now has d-20261009-14's explicit Node 24 prerequisite plus native codec import/round-trip readiness. No verifier implementation, engine range, source ownership or SQLite contract changed. I1-I4 retain their original closure rounds and metadata verbatim. Five distinct issues are closed with eight total raw prefixed findings. No Skip, Defer, carried item or withdrawn mechanism exists.

Refresh result: plan valid at NEW-BASE ca0ab68689e0f4de8ca0b84df2be29963bcfc66c. Frozen original BASE and trace remain historical evidence. Source drift did not change repository.rs or O1-O3. The only plan-body correction is verifier runtime readiness and its recorded technical choice. Earlier source-only limitations still apply. Runtime proof and the existing remote CI prerequisite f-20261009-04 remain adoption work, with no gate waived. The finding remains open.

Plan authorship and arbitration shared one context. Detection ran on the same model family selected for code execution. This planner performed no source edit, ledger mutation, installation, runtime proof, commit or push.

#### Raw lens-plan-r6

```text
I5 CLOSED — tasks/plans/.plan-2026-10-09-lru-sqlite-retirement.md-r6.body.md:98 requires Node 24, version readiness and native codec import/round-trip after installation, before the unchanged full-app proof at :112. This addresses scripts/verify-app.mjs:508 while preserving d-20261009-14 and the implementation scope (confidence: 98).

No DELTA or dependent-obligation defect found. Shutdown checks at scripts/verify-app.mjs:3460 and failure propagation at :3651 remain intact. The repository source is unchanged across the supplied bases.

Named limitation: runtime proofs were not rerun in this read-only review. Adoption readiness and the full-app result remain unverified (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-platform-semantics-r6

```text
I5 CLOSED — r6 plan:90,98 requires the existing Node 24 runtime, version verification, dependency installation and actual native codec import/compressed round-trip before the unchanged full-app proof. This preserves d-20261009-14 without claiming Node 20 compatibility or expanding implementation scope.

No DELTA defect, drift invalidation or plan blocker found.

Limitation: read-only review ran no runtime proofs, Windows compile check or non-Linux Unix source probe. Adoption still requires those applicable checks and native `rust-windows-test`, `rust-macos-test` and `rust-platform` CI evidence.

VERDICT: APPROVED
```

#### Raw lens-tests-r6

```text
I5 CLOSED — r6 requires Node 24 version readiness and actual native codec import/compressed round-trip after installation, before the unchanged full-app proof. Import failure cannot waive that proof.

No drift invalidation found. The changed verifier retains startup, IPC and shutdown assertions. O1–O3 retain deterministic Rust witnesses and explicit revert-to-red proof.

Named limitation: runtime proofs were not rerun in this read-only review. Closure confirms the planned verification obligation, not runtime success (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-minimalism-r6

```text
I5 CLOSED — r6 requires the existing Node 24 runtime, version readiness, and native codec import/compressed round-trip after installation before the unchanged full-app proof. It preserves d-20261009-14 without expanding source scope.

No minimalism drift invalidation found. The verifier shares the production codec, and the delta adds necessary proof prerequisites without another serializer, helper, or configuration surface.

VERDICT: APPROVED
```


### plan-r8.md

# Plan: retain and drain LRU-evicted SQLite connections

## Goal

Resolve f-20260930-01 so an LRU-evicted pool cannot close SQLite handles after a later deletion or successor open of the same database. This is a PLAN-ONLY run at BASE 8ebc643ef5569b29f269415a7b2f958c1e4e78c2. Implementation belongs to the adopting session.

## MANDATE

### LRU eviction drops a database entry without draining its SQLite connections, so one can close after a later delete of the same file

* **ID:** f-20260930-01 · **Status:** open · **Area:** db-search · **Root:** - · **Entry:** build · **Blocked:** none
* **Where:** `src-tauri/src/db/repository.rs` `evict_idle_entries` (~line 973, called under the repository state lock from `entry()` ~915); `close_retired_entry` (~952) and `DrainGate` (~109) are the drain every other retirement path uses since `3ed94336`.
* **Defect:** eviction removes an idle entry (`Arc::strong_count == 1`, no lease, not retiring) from `RepositoryState.entries` and drops it without closing its connection gate or waiting for outstanding connection tickets. An r2d2 `add_connection` job started by an earlier `get` can still hold an upgraded pool reference and a live or in-flight SQLite handle (the f-20260929-07 mechanism). A later `delete_exclusive_cancellable` of the same file then finds no entry, drains nothing, and unlinks while that handle is still open. The window is small (a replenishment job outliving the `get` that spawned it), reported by the repair leaf of the 2026-09-30 push review.
* **Why it matters:** it is the last retirement path that can close an SQLite handle (and unlink WAL/SHM) after the file was deleted or replaced, which every other path now excludes.
* **Proposed fix:** close the evicted entry's connection gate and drop its pool at eviction without blocking under the state lock, and keep the evicted gates reachable (for example a per-key list of draining gates in `RepositoryState`) so `delete_exclusive_inner` and `entry()` rebuild wait on them through `DrainGate::wait_drained` before unlinking or opening a fresh pool.
* **Open question:** where do evicted-but-draining gates live and who prunes them — a per-key list in `RepositoryState` pruned on drain, or eviction deferred to a path that may block — without holding the state lock across a wait?
* **Found by:** Codex write leaf (repair of the `8b97e423` push review), out-of-scope report; confirmed by the orchestrator from source, 2026-09-30. Related: `f-20260929-07`.

## Threat model and non-goals

Ordinary concurrent native database operations, r2d2 replenishment workers, cancellation, drain timeout, authority-valid same-path replacement and aliases on Linux, macOS and Windows. Preserve existing authority checks and bound VFS behavior. No new protection against malicious pathname churn, new cross-capability lifetime protocol, pool-key merger, hard-link WAL redesign, background service, watcher, shutdown redesign, or new renderer behavior.

## Traced premises

Frozen source trace at BASE, confirmed by the root and locate probe-1-r1:

* `repository.rs:1091` selects idle sole-owner LRU entries and removes them under the state mutex.
* `repository.rs:135`, `:252` and `:223` give each pooled SQLite open a ticket from before establishment until after SQLite and its binding close.
* r2d2 0.8.10 `src/lib.rs:230` upgrades a weak pool on its worker before connect and retains it through publication.
* `repository.rs:1664` closes connection admission and drops the pool before draining.
* `repository.rs:1070` removes a retired entry even if its drain returns an error, losing future lookup of that gate.
* `repository.rs:868` deletion reserves the canonical path but drains only the exact current entry.
* `repository.rs:929` owns pool construction through the building set and BuildGuard.
* `repository.rs:684` also opens a transient bound revision connection without constructing a pool.
* `repository.rs:372` keys pools by object, parent and path. `bound_sqlite.rs:188` reuses bindings, it does not drain predecessor connections.
* `db/mod.rs:2870` and `puzzle.rs:646` execute descriptor-bound unlink inside the repository deletion barrier.
* `repository.rs:2603`, `:2762`, `:2789`, `:2809`, and `:4855` contain cancellation, timeout, LRU and VFS/sidecar lifetime witnesses.
* `path_authority/mod.rs:962` supplies platform-neutral test targets. Most existing repository lifecycle tests are Unix-only at `repository.rs:1799`. The bound SQLite witness module at `:3293` is platform-neutral.

## Approach

### O1 — publish and bound predecessor ownership

Derived from MANDATE “keep the evicted gates reachable” and “without blocking under the state lock”. RepositoryState owns a bounded set of retirement records identified by predecessor object and retained parent identity. Limit records, including capacity reservations, to MAX_OPEN_DATABASES (16). Publish ownership and close new connection admission atomically with removing the eligible LRU entry. Keep its teardown visibly outstanding until pool and entry disposal have completed outside the repository state mutex. A zero count must prove that no evictor still owns a pool awaiting disposal, as well as that SQLite has closed every admitted handle. It must also prove that no other holder of the predecessor's pool or connection manager survives, including an r2d2 replenishment worker that upgraded the pool but was never admitted a connection ticket: the manager retains the predecessor's bound-SQLite binding, and d-20261011-01's admission refuses a same-inode alias while any binding holder survives. A completed predecessor record therefore means the predecessor's pool, manager and evicted entry no longer hold its binding. Holders outside predecessor teardown, such as a caller still holding the entry, keep d-20261011-01's refusal unchanged.

Only closed, fully drained records may be pruned. Prune completed records opportunistically at retirement/admission boundaries, including when a different database is accessed, so churn through never-revisited names cannot accumulate records. Capacity exhaustion applies bounded cancellable backpressure outside the state mutex, returning Cancellation or Conflict on failure before losing a resource or publishing a cache entry whose required eviction cannot be owned. Preserve the existing active-lease LRU exception. No unrestricted per-key history and no background cleanup.

Verification level: deterministic Rust concurrency witnesses through real LRU selection. Assert the entry is eligible without an entry Arc or caller lease artificially pinning it, that connection admission closes, and that retirement ownership remains visible while an actual SQLite handle is held. An unrelated database operation in a different retained parent must still finish while predecessor teardown waits. Churn and saturation witnesses assert the record bound and recovery after tickets close.

### O2 — enforce the predecessor barrier at reopen and deletion

Derived from MANDATE “before unlinking or opening a fresh pool” and “same file”. Match retired predecessors by the same object identity OR the same retained parent identity, retaining the existing pool key and authority checks. Parent matching conservatively fences all retired predecessors in that directory. It catches replacements whose authority-valid leaf spelling changes on case-insensitive or Unicode-normalizing filesystems without inventing a string equivalence rule. It deliberately delays otherwise unrelated opens in that parent until its retired predecessors drain, never live pools in that parent.

Pool construction, connection acquisition from already cached pools, transient revision opens and the delete reservation must drain every matching predecessor before any corresponding SQLite establishment or unlink callback. Cover actual connection-manager establishment, including delayed r2d2 replenishment from a previously cached pool, so fencing synchronous acquisition alone cannot leave a worker bypass. Reuse one retirement matching/wait/pruning contract at those boundaries. An already admitted worker belonging to the retiring predecessor must not wait on its own connection ticket. Preserve its existing close ordering and count it in that predecessor's drain, or refuse its open safely after admission closes. No repository ownership cycle may be introduced through pool managers.

Waits release the repository state mutex. Coordinate their publication and recheck with the existing construction and deletion reservations so a newly published matching retirement cannot slip between the wait and protected operation. Keep active-lease conflicts and avoid waiting on a lease held by the same caller. Use one absolute deadline for each predecessor-barrier operation, not a fresh full timeout per predecessor or loop. Cancellation remains effective before destructive work begins. BoundDatabase lifetime and close ordering remain intact.

At every boundary, predecessor timeout returns the existing Error::Conflict and caller cancellation returns Error::Cancellation. Preserve that typed, operation-scoped result through cached acquisition even when r2d2 transports and retries manager errors as text. Do not infer the category by parsing those strings or let one caller's cancellation poison another caller or a later retry. A pool acquisition must not consume a second timeout after the predecessor deadline expires. No new public error category is required.

Verification level: synchronized Rust witnesses assert that same-key reopen, same-path replacement, same-object alias and deletion cannot establish a successor handle or run the unlink callback until the predecessor closes. Include a replacement cached by a lock-only caller before the predecessor is LRU-evicted, then acquired afterward, and a delayed successor-pool replenishment worker crossing that retirement boundary. Include the transient revision boundary. On filesystems accepting spelling aliases, replace GameCase.db3 and authorize gamecase.db3, then witness cached acquisition, revision and deletion barriers. Assert conservative same-parent blocking and different-parent progress. A real WAL fixture proves the predecessor's final close occurs before the successor's WAL/SHM can exist, and the successor remains queryable with its sidecars intact.

Also pause a real predecessor replenishment worker after its connection ticket is admitted but before SQLite establishment, make its entry genuinely LRU-eligible, publish retirement, and resume it. Synchronize at those lifecycle boundaries. Assert the worker completes or safely refuses establishment without waiting for its own ticket or the retirement deadline, releases the ticket, and allows the predecessor drain and successor barrier to finish. Keeping the regression while restoring self-waiting manager behavior must fail its completion/order assertion.

Also pause a real predecessor replenishment worker after it upgraded the pool and before its connection ticket is admitted, make its entry genuinely LRU-eligible and publish retirement. Then start a same-parent hard-link alias reopen through the barrier. Assert the alias waits while that worker holds the pool, never returns d-20261011-01's "database is open through another name" conflict, and opens successfully after the worker resumes, is refused admission and releases the pool. Counting only connection tickets for completion must fail this assertion.

### O3 — retain barriers after incomplete drains

Derived from MANDATE “where evicted-but-draining gates live and who prunes them”. Timeout or cancellation must never discard or reopen a retired predecessor's connection gate. Release the waiting operation's temporary reservations, preserve predecessor ownership, and refuse its SQLite open or unlink. A retry after closure succeeds and removes completed bookkeeping.

Route LRU and the existing close_retired_entry removal through shared predecessor ownership. This also closes the same mechanism exposed when close_retired_entry currently removes an undrained gate on timeout or cancellation. Caller-lease cancellation before connection retirement keeps today's admission restoration. After connection retirement begins, reopening the caller lease must not make a retired pool reusable or remove its predecessor barrier.

Verification level: deterministically cancel during the connection-drain phase, and inject the shorter per-repository timeout. Assert no protected operation ran, an undrained predecessor remains discoverable, subsequent reopen/delete still waits or fails closed, and retry succeeds once the held connection is released.

Exercise cancellation and timeout after cached-pool worker establishment reaches a predecessor barrier, with the target remaining authority-valid. Assert the caller receives Cancellation/cancellation or Conflict/conflict (Rust variant and existing ErrorCategory), never R2d2/database. Assert a separately waiting healthy caller and a later retry remain independent and succeed after the predecessor closes. These witnesses must fail if the typed boundary result is replaced by the generic pool error.

For those actual cached/worker failure witnesses, also assert bounded completion for timeout and cancellation. Capture the elapsed-time origin before spawning the acquisition or release/cancellation child, then synchronize actual predecessor-barrier entry. Keep the predecessor held until the outcome assertion. Use the injected short predecessor deadline and an explicit scheduling allowance whose completion bound is strictly below the additional configured pool timeout. Assert timeout completion uses the original operation budget and cancellation returns promptly after its synchronized signal. Include multiple matching predecessors or a reservation recheck to reject refreshed budgets. Restoring a second full pool timeout or deferring cancellation through that timeout must fail the elapsed-time/completion assertion even if the eventual error category is correct. Preserve d-20261008-29's pre-spawn timing origin.

## Decisions and trade-offs

Entry remains build. The recorded decisions settle keying, authority, timeout and test synchronization, but none settles evicted-gate ownership and bounded retention.

Preserve d-20260904-01's injectable 60-second production timeout, d-20260913-02's pool key, d-20260913-03's lease-safe retirement, d-20260929-04's VFS authority, d-20260929-05's cross-directory refusal, d-20261011-01's same-parent alias admission refusal, and d-20261008-29/-30's synchronized test timing. O3 extends failed-drain safety, it does not reverse those decisions.

## Decided autonomously

* Question: Who owns evicted-but-draining gates and when are they pruned? Chosen: bounded repository retirement records using existing connection tickets, synchronous disposal outside the state mutex and opportunistic completed-record pruning. Rejected: evictor-local ownership alone (concurrent delete/reopen loses the barrier), an unbounded per-key list, or a background reaper. Reason: MANDATE requires future lookups and bounded retention, and no new process is needed. Reversal path: replace the registry only with a protocol proving the same lookup, capacity, failure and teardown-order invariants.
* Question: Does a fresh revision read count as a reopen? Chosen: yes, apply the same retired-predecessor barrier at read_revision without creating a pool. Rejected: fencing pool construction alone. Reason: a revision read is another SQLite establishment against the same authority-bound file. Reversal path: remove that barrier only if transient revision establishment can no longer overlap an evicted predecessor.
* Question: May close_retired_entry forget a gate after timeout or cancellation? Chosen: no, retain its undrained predecessor through the shared ownership contract. Rejected: removing the entry and forgetting its gate. Reason: a later delete can otherwise reproduce the same post-unlink close that MANDATE forbids. Reversal path: demonstrate another authoritative owner consulted by every future reopen/delete before removing this retention.
* Question: How are replacement names matched across filesystems? Chosen: same object OR retained parent identity, using authority identities already in EntryKey. Rejected: canonical path bytes or a new case-folding approximation. Reason: canonical_binding preserves the leaf's spelling and byte comparison can miss a replacement alias. Conservatively waiting for retired predecessors in the same parent gives a portable guarantee with bounded state. Reversal path: narrow parent matching only with authority-backed filesystem name equivalence and replacement witnesses on every supported platform.
* Question: Is construction the only pooled establishment boundary? Chosen: no, cached acquisition and actual manager establishment also use the predecessor barrier. Rejected: assuming every get creates a fresh pool. Reason: lock-only callers can cache a pool before its first SQLite connection and replenishment runs asynchronously. Reversal path: remove a boundary only if that path can no longer establish SQLite after predecessor retirement.

* Question: Which runtime executes the changed integration verifier? Chosen: preserve d-20261009-14's Node 24 native-codec route and explicitly validate its runtime and codec round-trip prerequisites before adoption proof. Rejected: treating the package's Node 20 minimum as verifier compatibility evidence, adding another serializer or changing the project's engine range within this task. Reason: the required integration proof must actually start with the changed import, and the existing current runtime already supports that route. Reversal path: a separately reviewed verifier-runtime compatibility change that preserves the canonical covered codec and demonstrates the same real-app proof.

## Risks / open questions

No product decision is needed. The code executor owns private helper names and test placement within the reviewed obligations. f-20260929-05's same-directory hard-link hazard is handled at NEW-BASE 0ee13ca0 by d-20261011-01's admission refusal, which this plan preserves and must not weaken. The cross-capability hazard stays separate as f-20261001-02. A renamed database refused while its old name's idle entry stays cached is the separate finding f-20261011-01, outside this mandate. This plan covers retired predecessor barriers, not concurrent live alias pools or all transient-reader lifetimes.

Locate confirmed Codex CLI 0.162.0 and the cargo, pnpm, agent-gate, WebKitWebDriver, tauri-driver and kwin_wayland binaries. The planner worktree has no node_modules and runs no install or runtime proofs. Adoption must run pnpm install --frozen-lockfile, recheck the exact released-kit parity and runtime prerequisites, and use the shared gate wrappers. Existing verify:app comments record unrelated failure history. Current runtime status is unmeasured, not green evidence.

At NEW-BASE ca0ab68689e0f4de8ca0b84df2be29963bcfc66c, the verifier imports the production TypeScript codec directly. Its execution prerequisite is the Node 24 runtime chosen by d-20261009-14, observed here as v24.21.0. Check node --version before adoption and use that existing runtime for the prescribed commands. After dependency installation, prove native import and compressed round-trip of the actual serializeStorageValue/deserializeStorageValue module before the full app verifier. Package.json's broader Node engine range is not proof that this verifier runs on Node 20. A missing prerequisite fails adoption readiness, it never waives the real-app proof. No project engine-range change, codec duplication or new transpilation helper belongs to this retirement mandate.

## Not part of this task

Other db-search siblings remain open at their recorded tiers. No frontend, Specta signature, binding, schema, dependency, capability, VFS implementation or deletion-outcome change is planned. No claim of implemented or runtime-verified behavior is made by this planner.

## Phases

One cohesive sensitive phase owns `src-tauri/src/db/repository.rs`, production ownership plus its regression witnesses. Concurrency, resource lifetime and cancellation are touched. API signatures and persisted schemas are unchanged. Selected executor: codex, write role sensitive resolved through leaf-launch.sh and the model registry. No history fork is needed. The root integrates, arbitrates, verifies and commits in the adopting run.

Implement O1–O3 together so every retirement path and every barrier ships with its witnesses. Prefer the existing platform-neutral test module for common lifetime behavior. OS-specific WAL fixtures may stay platform-gated, but the central ownership and error/retry witnesses must run on Linux, macOS and Windows. Read async-resource-invariants.md, pgn-scanning.md and ipc-events.md before writing. No other source files are assigned.

Exact phase proof: `cargo test --manifest-path src-tauri/Cargo.toml db::repository:: -- --test-threads=1 && pnpm checks:pre-review`. Keep new regressions present while reverting only the task-owned production fix from its Git diff, record the expected assertion failures, restore, and rerun green. The adopter owns that proof, not the read-only planner.

After implementation and cumulative diff review, run `pnpm build && pnpm verify:app --screenshot /tmp/drain-plan-chessfable-0a459a4f-slot1/build/verify-ui/retirement-app.png` for real app startup/IPC/shutdown integration. It complements the deterministic Rust SQLite retirement witnesses, it does not directly prove the LRU race. No new standalone verifier is planned.

Final affected push gates: `pnpm gates:push -- --rust`, through the canonical detached push-gate route on the final clean HEAD. It includes backend tests/coverage, fmt/clippy, Windows compile checks, contract and kit parity. No ratchet changes. The release also requires `pnpm ci:remote:check` and successful rust-windows-test, rust-macos-test and rust-platform jobs on the pushed SHA. Run the project push skill, then verify HEAD equals upstream and applicable installation. Record the autonomous decisions and complete review handoff before final gates. Close f-20260930-01 only through findings.py after verified implementation.

## Carried to diff review

None.

## Reviews

### Round 1

Elapsed 598.5 seconds, adopted substantive issues 2. Active arbitration time and quota waits were not separately measured. No dependency wait was required. All 12 plan-capable lenses ran. The class-absent exits for chess-semantics, engine-protocol, ipc-contract, persisted-state and pgn-index are accepted against this backend resource-lifetime mandate.

I1 — platform-semantics r1 finding 1, should-fix, confidence 94. Fix adopted, awaiting closure. canonical_binding at path_authority/mod.rs:2073 preserves the leaf spelling. O1/O2 now retain and match parent identity instead of trusting path bytes. Same-parent retirement backpressure is an explicit technical trade-off. Dependencies: none.

I2 — plan r1 finding 1, blocker, confidence 90. Fix adopted, awaiting closure. repository.rs:753 and :986 allow lock-only caching with min_idle 0, :950 returns that cached entry and :1175 reaches establishment through get_connection. O2 now covers cached acquisition and actual worker establishment, with lifecycle witnesses. Dependencies: none.

Plan authorship and arbitration shared one context. Detection ran on the same model family selected for code execution. Codex role routing used review-plan for the plan lens and sensitive for the remaining applicable lenses. No source edits or runtime verification occurred.

#### Raw lens-correctness-r1

```text
No correctness defects found in O1–O3’s stated contracts.

Limitation: this is plan-only review. Reservation rechecks, capacity handling and teardown ordering require verification against the implementation (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-error-handling-r1

```text
VERDICT: APPROVED
```

#### Raw lens-minimalism-r1

```text
VERDICT: APPROVED
```

#### Raw lens-plan-r1

```text
[blocker] tasks/plans/2026-10-09-lru-sqlite-retirement.md:52 — O2 omits connection acquisition from an already cached replacement pool. Lock-only callers can cache a pool without opening SQLite (`src-tauri/src/db/repository.rs:753`, `:986`). Different identities at the same path have different keys (`:372`), so that replacement can remain cached when the old entry is later LRU-evicted. A subsequent acquisition returns the cached entry (`:950`) and calls `get_connection` (`:1175`), which can establish SQLite (`:263`) without passing through pool construction. The proposed boundaries therefore leave the same-path successor-open guarantee at plan line 56 unenforced. Cover cached acquisitions and require a lifecycle witness where the replacement is cached before predecessor eviction. (confidence: 90)

VERDICT: REVISE
```

#### Raw lens-tests-r1

```text
No findings. O1–O3 specify Rust lifecycle assertions that would fail on revert, including real LRU eviction, blocked successor opens/unlink, and retained barriers after cancellation or timeout. The repository selector and platform CI jobs include the proposed tests.

Limitation: this approves the planned proof. Implementation assertions and actual revert failures remain unverified (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-chess-semantics-r1

```text
NOT APPLICABLE: The assigned repository file and O1–O3 obligations concern SQLite connection retirement and drain ownership. They do not involve in-memory chess trees, positions, or move paths.
VERDICT: APPROVED
```

#### Raw lens-engine-protocol-r1

```text
NOT APPLICABLE: The sole file and O1–O3 obligations concern SQLite connection retirement, reopen, and deletion barriers. They do not involve engine process supervision, UCI protocol state, or asynchronous engine result routing.
VERDICT: APPROVED
```

#### Raw lens-ipc-contract-r1

```text
NOT APPLICABLE: O1–O3 cover internal SQLite retirement ownership and drain barriers in `src-tauri/src/db/repository.rs`. The plan changes no Rust↔renderer event, command, payload, subscription, capability scope, or shutdown contract.

VERDICT: APPROVED
```

#### Raw lens-persisted-state-r1

```text
NOT APPLICABLE: The assigned file is a Rust database repository. O1–O3 concern SQLite connection retirement and drain barriers, with no renderer storage keys, persisted atoms, hydration, or tab lifecycle changes.
VERDICT: APPROVED
```

#### Raw lens-pgn-index-r1

```text
NOT APPLICABLE: O1–O3 in `src-tauri/src/db/repository.rs` concern SQLite connection retirement and reopen/delete barriers. They do not change PGN byte scanning, offsets, move encoding, stored indexes, or search predicates.

VERDICT: APPROVED
```

#### Raw lens-platform-semantics-r1

```text
[should-fix] tasks/plans/2026-10-09-lru-sqlite-retirement.md:52 — On case-insensitive Windows filesystems, replacing `GameCase.db3` and authorizing its successor as `gamecase.db3` changes the object identity while preserving unequal canonical path spellings. `canonical_binding` preserves leaf casing (`src-tauri/src/infra/path_authority/mod.rs:2073`), so the proposed matching rule can miss the draining predecessor. Require filesystem-compatible name equivalence and a replacement witness using different casing at reopen, revision-read and deletion boundaries. (confidence: 94)

Limitation: This was a source-only plan review. No Windows compile check, non-Linux Unix source probe or runtime tests ran. Native runtime proof remains `rust-windows-test` and `rust-macos-test`. The `rust-platform` matrix supplies clippy/compile proof.

VERDICT: REVISE
```

#### Raw lens-tauri-security-r1

```text
No security-boundary defects found in O1–O3. The obligations retain predecessor ownership through SQLite close, fence reopen and unlink, and preserve barriers after cancellation or timeout.

Limitation: this is plan review only. Implementation and lifecycle witnesses remain unverified. Credential, session and signed-download flows are absent from the assigned change.

VERDICT: APPROVED
```


### Round 2

Elapsed 360.4 seconds, adopted substantive corrections 2 (I2 residual verification and I3 typed failure). I4 changes the review record only and is excluded from substantive adoption counts. Active arbitration time and quota waits were not separately measured. No dependency wait was required. Plan, platform-semantics, correctness, minimalism, tests and error-handling ran.

I1 — Fix closed at r2 by its platform witness and review-plan. Authority: frozen threat model includes authority-valid same-path replacement and aliases on Linux, macOS and Windows. Object OR retained-parent matching corrects the authority-spelling gap without changing pool keys. Source confirmation: repository.rs:1286 derives parent identity from its retained parent handle, path_authority/mod.rs:3706 supplies Unix device/inode or Windows handle identity.

I2 — Fix remains open at r2. review-plan r2 finding 1 is a residual blocker at confidence 90 and becomes a second witness of I2. Correctness and tests approved the establishment boundary, but review-plan found the predecessor self-ticket exception lacked its own executable witness. Confirmed repository.rs:257 admits its ticket before :263 establishes SQLite, and :197 can wait on that ticket until deadline if its own retired gate is included. Add the synchronized admitted-predecessor worker witness in O2. Authority: MANDATE names outstanding connection tickets and r2d2 replenishment as the concrete retirement trigger. Dependencies: none. First failed closure check for this lineage, no mechanism rewrite.

I3 — error-handling r2 finding 1, should-fix, confidence 90. Fix adopted, awaiting closure. Lineage: I2, correction-introduced establishment boundary. Dependencies: I2. Source confirmation: repository.rs:1656 maps pool.get through Error::from, :1297 preserves the original error when the target is valid. r2d2 0.8.10 src/lib.rs:273 stores a manager failure as text and retries. error.rs:447 maps R2d2 to Database. Authority: the frozen threat model includes cancellation and drain timeout, O3 preserves their existing safe failure behavior. Correct O2/O3 so worker barrier failure remains typed Conflict or Cancellation for the waiting operation, with no string-based classification or cross-caller contamination. No new IPC category or Error variant is required.

I4 — plan r2 finding 2, should-fix, confidence 100. Fix adopted, awaiting review-plan closure. Dependencies: I1, I2. The r1 rows omitted explicit Authority fields for the new matching and establishment mechanisms. The following additive supplement preserves the original history and records those authorities. No behavior change and no substantive adoption count.

| R1 issue | Authority | Evidence | Necessary correction |
| --- | --- | --- | --- |
| I1 | Frozen threat model: authority-valid same-path replacement and aliases on Linux, macOS and Windows. MANDATE: "same file". | path_authority/mod.rs:2078 appends the unchanged leaf spelling. repository.rs:1286 retains parent identity. | Match object OR parent identity so alias-spelled replacement cannot miss its predecessor. |
| I2 | MANDATE: r2d2 add_connection can retain a live or in-flight SQLite handle, and later deletion must drain it. Frozen threat model includes r2d2 replenishment workers. | repository.rs:753 and :986 cache an unopened pool, :950 returns it, :1175 and :263 establish later. | Fence cached and actual asynchronous establishment as well as construction. |

Plan authorship and arbitration shared one context. Detection ran on the same model family selected for code execution. No source edits or runtime verification occurred.

#### Raw lens-plan-r2

```text
CLOSED: I1 — Candidate O2 matches retained parent identity (`tasks/plans/2026-10-09-lru-sqlite-retirement.md:52`, `src-tauri/src/db/repository.rs:1286`), covering spelling differences preserved by `src-tauri/src/infra/path_authority/mod.rs:2078`.

STILL OPEN: I2 — The corrected boundaries include cached acquisition and manager establishment, but verification omits the added predecessor-worker self-ticket exception.

[blocker] tasks/plans/2026-10-09-lru-sqlite-retirement.md:58 — I2’s witnesses delay a successor worker and hold an established predecessor handle. Neither exercises a predecessor worker paused after ticket admission but before establishment (`src-tauri/src/db/repository.rs:257–263`). If retirement publishes that worker’s gate before it resumes, a barrier that waits on its own ticket stalls until timeout (`src-tauri/src/db/repository.rs:197`). Require a synchronized witness proving this worker completes or safely refuses establishment without waiting for its own ticket. The currently specified witnesses would not reject that implementation. (confidence: 90)

[should-fix] tasks/plans/2026-10-09-lru-sqlite-retirement.md:114 — The I1 and I2 adoption rows lack the required `Authority` entries. Classify the directory-wide matching and manager-establishment fencing as necessary correctness work against MANDATE, citing the spelling preservation and asynchronous establishment paths (`src-tauri/src/infra/path_authority/mod.rs:2078`, `src-tauri/src/db/repository.rs:256`). (confidence: 100)

Limitation: Source-only review. Implementation, runtime behavior and revert failures remain unverified (confidence: 100).

VERDICT: REVISE
```

#### Raw lens-platform-semantics-r2

```text
CLOSED: I1 — O1/O2 match object identity OR retained parent identity, covering differently spelled replacements on Windows and macOS. `repository.rs:1286` obtains parent identity from the retained handle. `path_authority/mod.rs:3706` uses Unix device/inode or Windows volume/file index. O2 requires casing-alias witnesses across acquisition, revision and deletion boundaries.

NOT MY CLASS: I2 — closure belongs to review-plan.

No new platform findings.

Limitation: source-only plan review. No tests, `pnpm rust:windows:check`, or non-Linux Unix source probe ran. Planned native runtime proof is `rust-windows-test` and `rust-macos-test`. The `rust-platform` matrix provides compile/clippy proof, including `-D warnings`.

VERDICT: APPROVED
```

#### Raw lens-correctness-r2

```text
CLOSED: I1 — O1/O2 match object OR retained parent identity, covering replacement spelling aliases with explicit same-parent blocking.

CLOSED: I2 — O2 fences cached acquisition and actual replenishment establishment, including self-ticket safety and reservation rechecks.

No correctness defects found in the revised contracts.

Limitation: plan-only review. Atomic publication, worker admission ordering, bounded capacity and timeout recovery remain implementation proof obligations (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-minimalism-r2

```text
NOT MY CLASS: I1 — platform-semantics owns alias-matching closure.
NOT MY CLASS: I2 — review-plan owns cached-acquisition and worker-establishment closure.

No bloat or duplication findings. The revised boundaries address concrete retirement bypasses. Shared ownership and matching have multiple required callers, and parent-identity matching avoids introducing filesystem-specific name equivalence machinery.

Limitation: implementation size and helper duplication remain unassessable until a source diff exists (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-tests-r2

```text
CLOSED: I1 — verification coverage now requires spelling-alias replacement witnesses at cached acquisition, revision and deletion boundaries, plus same-parent blocking and different-parent progress.

CLOSED: I2 — verification coverage now includes a replacement cached before eviction and delayed successor replenishment. The required assertion forbids actual successor SQLite establishment before predecessor close, so restoring either bypass would fail.

No verification findings. O1–O3 name Rust lifecycle assertions for real LRU retirement, bounded retention, protected-open/unlink ordering, and cancellation/timeout retry safety. The repository selector and platform CI test commands include the proposed witnesses. The plan explicitly requires keeping regression tests while reverting production changes and recording assertion failures.

Limitation: this closes the planned verification contracts only. Test implementations and actual revert failures remain unverified (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-error-handling-r2

```text
NOT MY CLASS: I1 — filesystem matching closure belongs to platform-semantics.
NOT MY CLASS: I2 — establishment-boundary closure belongs to plan.

[should-fix] tasks/plans/.plan-2026-10-09-lru-sqlite-retirement.md-r2.body.md:54 — O2 adds connection-manager barrier failures without specifying their typed caller outcome. When a delayed worker times out behind a predecessor while the target remains valid, r2d2 stringifies and retries its error. The existing `get_connection` path returns `Error::R2d2`, classification preserves it, and IPC surfaces category `database` with “database failure”. Require predecessor timeout/cancellation classification to survive this boundary, with a failure witness. O1’s explicit Cancellation/Conflict requirement covers capacity exhaustion only. (confidence: 90)

VERDICT: APPROVED
```


### Round 3

Elapsed 275.9 seconds, adopted substantive corrections 1 (I3 residual completion verification). Active arbitration time and quota waits were not separately measured. No dependency wait was required. Plan, error-handling, correctness and tests ran.

I2 — Fix closed at r3 by review-plan. O2 requires the admitted-predecessor worker completion/order witness. Its complete r1/r2 witnesses remain recorded.

I4 — Fix closed at r3 by review-plan. The additive Authority supplement records the frozen mandate/threat model and opened source supporting I1/I2.

I3 — Fix remains open at r3. Error-handling and correctness approved typed outcomes, but plan r3 finding 1 (blocker, confidence 90) and tests r3 finding 1 (should-fix, confidence 95) independently found the same missing bounded-completion witness. Deduplicate both into I3, no new issue ID. The current proof could pass after correctly classified failure plus an extra pool timeout. Confirmed repository.rs:1661 calls pool.get, :74 configures 2 seconds in tests and 30 seconds in production. The reviewed O2 forbids the second budget. Authority: frozen threat model includes cancellation and drain timeout. Add O3 completion/duration assertions with a pre-spawn origin, synchronized barrier and cancellation, a bound below the extra pool timeout and predecessor retention through the outcome assertion. Dependencies: I2. Lineage: I2. First failed closure check for I3.

Plan authorship and arbitration shared one context. Detection ran on the same model family selected for code execution. No source edits or runtime verification occurred.

#### Raw lens-plan-r3

```text
I2 CLOSED — PLAN `tasks/plans/.plan-2026-10-09-lru-sqlite-retirement.md-r3.body.md:62` now requires an admitted predecessor-worker witness that rejects self-waiting. It covers ticket admission before establishment at `src-tauri/src/db/repository.rs:257` and `:263`.

[blocker] I3 NOT CLOSED — PLAN `tasks/plans/.plan-2026-10-09-lru-sqlite-retirement.md-r3.body.md:58` forbids a second pool timeout, but its verification at `:72` asserts categories and retry independence without bounded completion. An implementation could retain `pool.get()` (`src-tauri/src/db/repository.rs:1661`), spend its additional configured timeout (`:74`), then return typed `Conflict` or `Cancellation` and satisfy those assertions. Require a synchronized completion bound that fails when acquisition adds another timeout or delays cancellation. (confidence: 90)

I4 CLOSED — The additive Authority supplement at `tasks/plans/2026-10-09-lru-sqlite-retirement.md:236` supplies both missing authorities, supported by spelling preservation at `src-tauri/src/infra/path_authority/mod.rs:2078` and delayed cached establishment at `src-tauri/src/db/repository.rs:986` and `:1175`.

VERDICT: REVISE
```

#### Raw lens-error-handling-r3

```text
I3 CLOSED — PLAN:57 requires operation-scoped Conflict/Cancellation through r2d2 transport, one shared deadline, and caller independence. PLAN:72 requires authority-valid cached-worker witnesses asserting Rust variants and IPC categories, retry success, and failure when generic pool errors replace typed results. Implementation proof remains pending.

VERDICT: APPROVED
```

#### Raw lens-tests-r3

```text
I2 CLOSED — O2 now requires a real predecessor worker paused after ticket admission, resumed after retirement publication. Its completion-before-deadline and ticket-release assertions would reject self-waiting.

I3 CLOSED — O3 requires actual cached-worker failures with an authority-valid target, asserts both Rust variant and ErrorCategory, and checks healthy-caller independence and retry success. Generic R2d2/database classification would fail.

[should-fix] tasks/plans/.plan-2026-10-09-lru-sqlite-retirement.md-r3.body.md:72 — The new prohibition on a second pool timeout has no corresponding duration assertion. Cached acquisition could exhaust the predecessor deadline, wait another pool timeout, then return correctly typed Conflict and pass every stated outcome/retry assertion. Require a synchronized deadline-bound assertion that fails when acquisition starts a second timeout budget. (confidence: 95)

Limitation: This checks planned proof contracts. Implemented assertions and measured revert failures remain unverified (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-correctness-r3

```text
I2 CLOSED — O2:54,62 requires cached and worker establishment fencing, plus a synchronized admitted-predecessor witness proving ticket release without self-wait or deadline expiry.

I3 CLOSED — O2:58 and O3:72 require operation-scoped Conflict/Cancellation through r2d2 transport, one shared deadline, and independent healthy callers and retries.

Limitation: plan-only review. Publication ordering, typed-result transport and actual lifecycle/revert assertions remain unverified until implementation (confidence: 100).

VERDICT: APPROVED
```


### Round 4

Elapsed 157.5 seconds, adopted substantive corrections 0. Active arbitration time and quota waits were not separately measured. No dependency wait was required. Plan, error-handling and tests ran, covering every I3 witness.

I3 — Fix closed at r4 by error-handling, tests and review-plan. O2/O3 require operation-scoped typed timeout/cancellation through worker transport, shared deadlines, healthy caller independence and actual failure/retry witnesses. The residual completion proof now rejects an added pool timeout or delayed cancellation using a synchronized bound measured from a pre-spawn origin. I1 remained closed at r2, I2 and I4 at r3.

Final disposition: four distinct issues, all Fix and closed. Seven raw prefixed findings are represented by metadata witnesses. I2 has two witnesses across r1/r2, I3 has three across r2/r3. No Skip, Defer, withdrawn mechanism, successor finding, or carried CR item. Dependencies: I3 depends on I2, I4 depends on I1/I2. Completed-round substantive adoption counts: r1=2 r2=2 r3=1 r4=0. No non-convergence trigger fired. Neither lineage failed two closure checks.

The authoritative phase obligations are O1–O3 and their verification levels. Same-parent conservative backpressure is explicit. Implementer helper structure remains unfrozen. Runtime, implementation size, atomic publication and platform execution remain unverified adoption work. The finding remains open and no ledger claim or closure was made.

Plan authorship and arbitration shared one context. Detection ran on the same model family selected for code execution. No source edits, installation, runtime tests, commit or push occurred.

#### Raw lens-plan-r4

```text
I3 CLOSED — `tasks/plans/.plan-2026-10-09-lru-sqlite-retirement.md-r4.body.md:74` requires synchronized completion assertions below the pool timeout, predecessor retention through outcome assertion, and failure when extra budgets or delayed cancellation return. This rejects the `pool.get()` delay at `src-tauri/src/db/repository.rs:1661`, configured as two seconds in tests at `:76`, while preserving O2’s typed-result and caller-independence requirements. Closure covers the planned proof. Implementation and measured revert failures remain unverified (confidence: 95).

VERDICT: APPROVED
```

#### Raw lens-tests-r4

```text
I3 CLOSED — PLAN:74 requires synchronized cached/worker timeout and cancellation completion assertions, measured from a pre-spawn origin while the predecessor remains held. The bound must fall below the additional pool timeout and fail when a second budget or delayed cancellation is restored. Multiple predecessors or a reservation recheck must also reject refreshed budgets. This closes the planned proof gap. Implemented assertions and measured revert failures remain unverified (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-error-handling-r4

```text
I3 CLOSED — PLAN:58,72,74 requires typed, operation-scoped Conflict/Cancellation and synchronized completion bounds below the additional pool timeout, with predecessors held through outcome assertions. Witnesses must reject refreshed budgets and delayed cancellation while preserving healthy-caller and retry independence. Implementation and measured revert failures remain pending.

VERDICT: APPROVED
```


### Round 5 — refresh drift

PLAN-REFRESH from BASE 8ebc643ef5569b29f269415a7b2f958c1e4e78c2 to NEW-BASE ca0ab68689e0f4de8ca0b84df2be29963bcfc66c. Elapsed 427.7 seconds, adopted substantive corrections 1. All 12 specified REFRESH-LENSES ran. Earlier r1-r4 history and issue dispositions are preserved. Active arbitration and quota waits were not separately measured. No dependency wait was required.

I5 — platform-semantics r5 finding 1, should-fix, confidence 98. Fix adopted, awaiting closure. Changed path: scripts/verify-app.mjs:508 now imports src/state/store/debouncedStorage.ts directly. Invalidated obligation: the plan Phases real-app startup/IPC/shutdown proof lacked its Node runtime prerequisite. Confirmed package.json:78 runs plain node and :174 permits Node >=20.19.0. Current node --version reports v24.21.0. Decision d-20261009-14 already chooses that native-codec execution route. Dependencies: none.

Authority: the existing Phases real-app integration proof must execute successfully and cannot be waived. Correction revision r6 explicitly requires the already chosen Node 24 runtime, version readiness and a native codec compressed round-trip before that unchanged full-app command. This is a proof-environment prerequisite, no source mechanism, engine-range change or reversal of d-20261009-14. Rejected expanding the SQLite mandate into generic verifier-runtime support. Reversal remains a separately reviewed compatibility change preserving the shared codec and full integration proof.

Source inference, not a Node 20 runtime measurement: [Node 20.19 ESM loader documentation](https://nodejs.org/download/release/v20.19.0/docs/api/esm.html#features) excludes the .ts extension, while [Node 24.21 TypeScript documentation](https://nodejs.org/download/release/v24.21.0/docs/api/typescript.html#type-stripping) describes native type stripping. No Node 20 executable, package installation or runtime verifier was run by this planner.

All other raw verdicts are APPROVED, with source-only limitations retained. The reviewer plan limitation about absent ROUND/DELTA refers to the first refresh drift round, which uses the exact process-generated source drift instead of inventing a plan revision. It does not withdraw r1-r4 closure evidence. The planned repository.rs source is byte-unchanged across the two bases. Existing unavailable remote CI is recorded by f-20261009-04 and remains an adoption precondition, no required gate is removed.

Plan authorship and arbitration shared one context. Detection ran on the same model family selected for code execution. No source edits, ledger mutation, install, runtime proof, commit or push occurred.

#### Raw lens-chess-semantics-r5

```text
No chess-semantics drift invalidation found. The tree schema refactor preserves FENs, metadata, child ordering and stored-path repair. The verifier’s new workspace fixture preserves the existing startup, IPC and shutdown checks required by the plan.

Limitation: runtime proofs were not rerun in this read-only review.

VERDICT: APPROVED
```

#### Raw lens-correctness-r5

```text
No correctness drift invalidation found. The workspace reload checks preserve the plan’s startup, IPC and shutdown proof.

Named limitation: the new direct `.ts` import in `scripts/verify-app.mjs:508` was not exercised on older Node versions allowed by `package.json`. Runtime compatibility remains unverified under this review’s no-test constraint (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-engine-protocol-r5

```text
No drift invalidation within this lens. Workspace initialization changes preserve tab identities without changing engine process keys or result routing. The added `scripts/verify-app.mjs` reload checks retain the existing startup/IPC/shutdown proof required by the plan.

Limitation: read-only source review. No runtime proofs rerun.

VERDICT: APPROVED
```

#### Raw lens-error-handling-r5

```text
No drift invalidation found. The changed reload verifier uses bounded polling, records failures with assertion context, and exits 1 on check or cleanup failure. The plan’s startup/IPC/shutdown integration proof remains applicable. O1–O3’s failure contracts are unchanged.

Limitation: runtime behavior was not rerun in this read-only review (confidence: 95 in the traced failure routing).

VERDICT: APPROVED
```

#### Raw lens-ipc-contract-r5

```text
No IPC drift invalidation found. The changes to `src/index.tsx` and `scripts/verify-app.mjs` preserve the registered `release_previous_document_operations` and `prepare_native_read` contracts, including exact-ticket checks for reload cancellation and window destruction. The added workspace assertions retain the plan’s startup, IPC and shutdown integration proof.

No event, command signature, generated binding or capability scope changed.

Limitation: runtime proof was not rerun in this read-only review. The adopting executor must run the plan’s prescribed integration command.

VERDICT: APPROVED
```

#### Raw lens-minimalism-r5

```text
No drift invalidation found in this lens. `scripts/verify-app.mjs` reuses the existing reload sequence and storage serializer without requiring another verifier or expanding the retirement implementation. O1–O3 and the existing startup/IPC/shutdown proof remain applicable.

Limitation: runtime status remains unmeasured in this read-only review.

VERDICT: APPROVED
```

#### Raw lens-persisted-state-r5

```text
No drift invalidation found. Workspace and tree writers/readers retain matching encoding, and unload flushing remains intact. The added reload assertions preserve the plan’s real startup/IPC/shutdown integration proof.

Limitation: read-only source review. No runtime tests rerun.

VERDICT: APPROVED
```

#### Raw lens-pgn-index-r5

```text
No drift invalidation. PGN scanning, indexing, database encoding, and repository source are unchanged. The verifier additions use the canonical serializer for workspace seeding and preserve existing PGN checks and the planned startup/IPC/shutdown proof.

Limitation: runtime proof was not rerun during this read-only review.

VERDICT: APPROVED
```

#### Raw lens-plan-r5

```text
No drift invalidation found. The changed workspace initialization and verifier preserve the integration proof at tasks/plans/.plan-2026-10-09-lru-sqlite-retirement.md-r5.body.md:108. scripts/verify-app.mjs:3399 adds workspace assertions while retaining titlebar shutdown checks at :3460 and failure propagation at :3651. The Rust repository source is unchanged.

Named limitations: runtime proofs were not rerun. No process-generated ROUND/DELTA/REVISED/SETTLED block was supplied, so this result covers the supplied source drift without re-establishing prior issue closure (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-platform-semantics-r5

```text
[should-fix] scripts/verify-app.mjs:509 — The drift adds a direct `.ts` import to the plain Node verifier. On Linux with supported Node 20.19 (`package.json:174`), loading fails with `ERR_UNKNOWN_FILE_EXTENSION` before app startup. This invalidates the plan’s required `pnpm verify:app` integration proof on that supported runtime. Recorded Node 24 success does not cover Node 20 (confidence: 98).

No Rust platform premise changed. No tests, Windows compile check or non-Linux Unix source probe ran. Windows and macOS runtime proof remains required through `rust-windows-test` and `rust-macos-test`, with `rust-platform` providing compile/clippy coverage.

VERDICT: REVISE
```

#### Raw lens-tauri-security-r5

```text
No security drift invalidation found. The workspace changes preserve the original path-owner snapshot and do not change credential storage. `scripts/verify-app.mjs` retains real IPC, reservation-sweep and shutdown assertions, preserving the plan’s integration-proof obligation.

Limitation: runtime proofs were not rerun during this read-only review.

VERDICT: APPROVED
```

#### Raw lens-tests-r5

```text
No drift invalidation found. `scripts/verify-app.mjs` preserves real startup, IPC, reservation-sweep and shutdown checks. Added reload assertions compare rendered tab IDs and selection against the seeded values, and failures produce exit code 1.

Limitation: runtime status remains unmeasured in this review. The planned Rust witnesses and revert proof remain required for O1–O3.

VERDICT: APPROVED
```


### Round 6 — refresh correction closure

Elapsed 147.9 seconds, adopted substantive corrections 0. Plan, platform-semantics, tests and minimalism checked the runtime-prerequisite correction. Active arbitration and quota waits were not separately measured. No dependency wait was required.

I5 — Fix closed at r6 by platform-semantics and review-plan. The required full app proof now has d-20261009-14's explicit Node 24 prerequisite plus native codec import/round-trip readiness. No verifier implementation, engine range, source ownership or SQLite contract changed. I1-I4 retain their original closure rounds and metadata verbatim. Five distinct issues are closed with eight total raw prefixed findings. No Skip, Defer, carried item or withdrawn mechanism exists.

Refresh result: plan valid at NEW-BASE ca0ab68689e0f4de8ca0b84df2be29963bcfc66c. Frozen original BASE and trace remain historical evidence. Source drift did not change repository.rs or O1-O3. The only plan-body correction is verifier runtime readiness and its recorded technical choice. Earlier source-only limitations still apply. Runtime proof and the existing remote CI prerequisite f-20261009-04 remain adoption work, with no gate waived. The finding remains open.

Plan authorship and arbitration shared one context. Detection ran on the same model family selected for code execution. This planner performed no source edit, ledger mutation, installation, runtime proof, commit or push.

#### Raw lens-plan-r6

```text
I5 CLOSED — tasks/plans/.plan-2026-10-09-lru-sqlite-retirement.md-r6.body.md:98 requires Node 24, version readiness and native codec import/round-trip after installation, before the unchanged full-app proof at :112. This addresses scripts/verify-app.mjs:508 while preserving d-20261009-14 and the implementation scope (confidence: 98).

No DELTA or dependent-obligation defect found. Shutdown checks at scripts/verify-app.mjs:3460 and failure propagation at :3651 remain intact. The repository source is unchanged across the supplied bases.

Named limitation: runtime proofs were not rerun in this read-only review. Adoption readiness and the full-app result remain unverified (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-platform-semantics-r6

```text
I5 CLOSED — r6 plan:90,98 requires the existing Node 24 runtime, version verification, dependency installation and actual native codec import/compressed round-trip before the unchanged full-app proof. This preserves d-20261009-14 without claiming Node 20 compatibility or expanding implementation scope.

No DELTA defect, drift invalidation or plan blocker found.

Limitation: read-only review ran no runtime proofs, Windows compile check or non-Linux Unix source probe. Adoption still requires those applicable checks and native `rust-windows-test`, `rust-macos-test` and `rust-platform` CI evidence.

VERDICT: APPROVED
```

#### Raw lens-tests-r6

```text
I5 CLOSED — r6 requires Node 24 version readiness and actual native codec import/compressed round-trip after installation, before the unchanged full-app proof. Import failure cannot waive that proof.

No drift invalidation found. The changed verifier retains startup, IPC and shutdown assertions. O1–O3 retain deterministic Rust witnesses and explicit revert-to-red proof.

Named limitation: runtime proofs were not rerun in this read-only review. Closure confirms the planned verification obligation, not runtime success (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-minimalism-r6

```text
I5 CLOSED — r6 requires the existing Node 24 runtime, version readiness, and native codec import/compressed round-trip after installation before the unchanged full-app proof. It preserves d-20261009-14 without expanding source scope.

No minimalism drift invalidation found. The verifier shares the production codec, and the delta adds necessary proof prerequisites without another serializer, helper, or configuration surface.

VERDICT: APPROVED
```


### Round 7 — second refresh drift

PLAN-REFRESH from BASE ca0ab68689e0f4de8ca0b84df2be29963bcfc66c to NEW-BASE 0ee13ca0f0cf7ed2ce1c5313e6adf8f39780a7b3, drift file `drift-ca0ab686…-0ee13ca0….diff` (exactly `git diff` of the two bases, 126 files). Elapsed 312 seconds wall for the parallel lens round, adopted substantive corrections 2 (I6, I7). All 12 specified REFRESH-LENSES ran at r7, `--role sensitive` (src-tauri/src/db/** is a Sensitive-Path glob), review-plan at `--role review-plan`. Earlier r1-r6 history and issue dispositions are preserved verbatim. Active arbitration and quota waits were not separately measured. No dependency wait was required.

Unlike the first refresh, the planned source changed: `src-tauri/src/db/repository.rs` (struct doc, alias-refusal tests) and its traced dependency `src-tauri/src/db/bound_sqlite.rs`, where f-20260929-05 / d-20261011-01 made `BoundDatabase::acquire` refuse a distinct binding key for an inode with a live binding or creation reservation under the same parent (`Conflict("database is open through another name")`).

I6 — plan r7 finding 1, blocker, confidence 90. Fix adopted, awaiting closure. Claim: O1's completion condition counts connection tickets and the evictor's own pool disposal, but an r2d2 replenishment worker can retain the predecessor's binding without a ticket, so after the drift an alias successor that passed the barrier can receive an immediate admission Conflict instead of waiting and succeeding. Source confirmation: r2d2 0.8.10 `src/lib.rs:236-241` upgrades the weak pool on the worker and only then calls `shared.manager.connect()`; `repository.rs:247-252` enters the connection ticket inside `BoundConnectionManager::connect`, and the manager struct at `:240-244` owns `database: BoundDatabase`; `close_connections` at `:1665-1677` closes admission, drops the entry's pool and waits only on that ticket gate. The drift's `bound_sqlite.rs` admission predicate refuses a different same-parent key while any registration holder survives, and d-20261011-01 names the pool manager among those holders. Changed path: `src-tauri/src/db/bound_sqlite.rs` `BoundDatabase::acquire`. Invalidated obligations: O1 completion ("A zero count must prove …") and O2's alias reopen / O3's retry-after-closure guarantee. Dependencies: I2 (worker lifecycle witness), I3 (typed Conflict/Cancellation).

Authority: MANDATE "keep the evicted gates reachable so `delete_exclusive_inner` and `entry()` rebuild wait on them through `DrainGate::wait_drained` before unlinking or opening a fresh pool" — a rebuild that waits and is then refused does not open the fresh pool; frozen threat model "r2d2 replenishment workers … aliases". Correction revision r8: O1 completion now also requires that no other holder of the predecessor's pool or manager survives, including an upgraded-but-unadmitted worker, so a completed record means predecessor teardown no longer holds the binding; holders outside teardown (a caller holding the entry) keep d-20261011-01 unchanged. O2 adds a synchronized witness: worker paused after upgrade and before ticket admission, real LRU retirement, same-parent hard-link alias reopen waits, never returns the alias conflict, and opens after the worker is refused and releases the pool; ticket-only completion must fail it. This extends the existing completion contract, it does not add a component, process, watcher or public error; the mechanism stays the executor's. "Not worse than today" was considered and rejected as the disposition: at NEW-BASE the hazard exists too, but the plan's own O2/O3 promise (wait, then succeed) becomes false for aliases without the correction, so it is a plan defect, not a pre-existing limit.

I7 — plan r7 finding 2, should-fix, confidence 100. Fix adopted, awaiting closure. Claim: Risks still described f-20260929-05 as a separate unresolved hazard although the drift handled it (`tasks/findings.md:12452` header `Status: handled`). Correction revision r8: Risks names d-20261011-01 as preserved policy, keeps f-20261001-02 separate and names the newly filed rename-retention finding f-20261011-01 as outside this mandate; Decisions and trade-offs adds d-20261011-01 to the preserved decisions. Frozen `## Traced premises` (incl. `bound_sqlite.rs:188`) stays as historical evidence of the original base, as in r5. Reference-level, but the arbiter keeps it on the r8 closure because the review-plan lens reruns anyway.

S1 — plan r7 finding 3, should-fix, confidence 100. Skip. Claim: the r7 packet lacked the `ROUND`/`DELTA`/`REVISED`/`SETTLED` block. Evidence: `python3 ~/.claude/scripts/plan-review-delta.py plan-r6.md <plan> --round 7` printed `UNCHANGED` and exited 3, because the plan body was byte-identical to r6; build §4 forbids fabricating a revision round on exit 3, and the build skill's plan-refresh section defines the process-generated drift diff, not a plan delta, as the drift round's correction evidence. The r8 closure round carries the generated block because r8 revises the plan.

All other raw verdicts are APPROVED with source-only limitations retained. Correctness, platform-semantics, tests, error-handling, minimalism, pgn-index and tauri-security each examined the new alias refusal and found it compatible with O1-O3's drain-before-successor ordering; none examined the upgraded-but-unadmitted worker interval, which is why their approval does not contradict I6. The newly filed f-20261011-01 (rename retention of an idle cached entry) is a separate open finding and is not added to this mandate. No out-of-scope defect was reported, so nothing was filed.

Plan authorship and arbitration shared one context. Detection ran on Codex (OpenAI high tier), the same model family selected for code execution. No source edits, ledger mutation, install, runtime proof, commit or push occurred.

#### Raw lens-chess-semantics-r7

```text
No chess-semantics drift invalidation found. Reviewed tree replacement, PGN parsing, move legality, path handling and the expanded real-app verifier against the Phases integration proof. No changed premise invalidates O1–O3 within this lens.

Limitation: read-only source review. Runtime proofs remain the adopter’s responsibility.

VERDICT: APPROVED
```

#### Raw lens-correctness-r7

```text
No correctness drift invalidation found. The new same-inode admission refusal remains compatible with O1’s disposal ordering and O2–O3’s predecessor barriers. Different-inode cached replacements remain reachable.

Limitation: runtime and platform proofs were not executed in this read-only review. Static contract assessment confidence: 90.

VERDICT: APPROVED
```

#### Raw lens-engine-protocol-r7

```text
No drift invalidation found within the UCI lens. The board/tab changes, shared progress changes and expanded verifier do not invalidate O1–O3 or the Phases integration proof through engine supervision, protocol ordering or result routing.

Limitation: read-only source review. No runtime verification performed.

VERDICT: APPROVED
```

#### Raw lens-error-handling-r7

```text
No error-handling drift invalidation found.

The new `BoundDatabase::acquire` alias refusal propagates typed `Error::Conflict` before SQLite opens. O1’s disposal requirement and O2’s barriers before pooled and transient establishment remain compatible with it. O3 still requires retained barriers, independent cancellation, typed outcomes and bounded retries.

The expanded `verify-app.mjs` records caught assertion failures and exits nonzero. Its catches do not turn failed integration checks into passing proof.

Limitation: implementation witnesses and native/platform proofs were not executed in this read-only review. Their results remain adoption requirements (confidence: 100).

VERDICT: APPROVED
```

#### Raw lens-ipc-contract-r7

```text
No IPC drift invalidation found. Changed progress paths retain registered `ProgressEvent`, matching ids, generations and percentage units. New verifier calls match registered commands and generated invoke keys. Capability scopes and bindings are unchanged.

O1–O3 and the integration-proof obligation remain intact within this lens. Static review only, with no runtime proof performed.

VERDICT: APPROVED
```

#### Raw lens-minimalism-r7

```text
No bloat or duplication in the inspected drift invalidates O1–O3 or the Phases proof obligations. Binding admission refusal does not replace predecessor drain ordering. The plan still requires one shared retirement contract and reuses the existing verifier and production codec without expanding the mandate.

VERDICT: APPROVED
```

#### Raw lens-persisted-state-r7

```text
No drift invalidation found within this lens. The changed workspace and tree writers/readers use the same compressed codec and physical `treeKey`. Creation, replacement, hydration, duplication, close cleanup and verifier snapshots consistently resolve that key. The unload flush remains intact.

These changes do not invalidate O1–O3 or the Phases integration proof. Runtime readiness and `pnpm build && pnpm verify:app` remain adoption obligations, unverified by this read-only review.

VERDICT: APPROVED
```

#### Raw lens-pgn-index-r7

```text
No drift invalidation found within this lens. Import, decode and search share FEN reconstruction and detected castling mode. The archived index format remains unchanged.

The new alias refusal remains compatible with O1–O3’s required binding release and predecessor drain before successor opens, including revision reads. Runtime proof remains the adopter’s obligation. This review was read-only.

VERDICT: APPROVED
```

#### Raw lens-plan-r7

```text
[blocker] tasks/plans/.plan-2026-10-09-lru-sqlite-retirement.md-r7.body.md:44 — O1’s completion condition misses a predecessor binding retained without a connection ticket. Changed premise: `BoundDatabase::acquire` now refuses same-parent aliases while any binding holder survives (`src-tauri/src/db/bound_sqlite.rs:217`). An r2d2 worker upgrades the pool before calling `connect` (`r2d2-0.8.10/src/lib.rs:236`), retaining `BoundConnectionManager.database` before ticket admission (`src-tauri/src/db/repository.rs:247`, `:257`). If paused there across eviction, the evictor can finish disposal and the connection count reach zero while the binding remains alive. O2’s alias reopen and O3’s successful retry (`PLAN:60`, `:66`) can then return immediate admission `Conflict`. The planned admitted-worker witness at `PLAN:62` does not exercise this interval. Require retirement completion to account for predecessor-owned binding holders and a synchronized witness proving alias reopen waits and succeeds after that worker releases ownership. (confidence: 90)

[should-fix] tasks/plans/.plan-2026-10-09-lru-sqlite-retirement.md-r7.body.md:94 — Risks still describes f-20260929-05 as a separate unresolved hard-link hazard. Changed premise: the new admission predicate prevents concurrent distinct same-parent bindings (`src-tauri/src/db/bound_sqlite.rs:217`), and the drift marks that finding handled (`tasks/findings.md:12452`). Update the current risk statement to preserve d-20261011-01’s refusal policy and distinguish the separately filed rename-retention defect, f-20261011-01. Leave the historical trace intact. (confidence: 100)

[should-fix] tasks/plans/2026-10-09-lru-sqlite-retirement.md:120 — The history establishes earlier rounds, but this r7 packet omits the required process-generated `ROUND`, `DELTA`, `REVISED`, `SETTLED` block. The supplied source drift does not replace that input under `/home/felixb/.claude/references/review-lens-contract.md:246`, `:262`. Supply the block or explicitly resolve the refresh-specific contract exception. (confidence: 100)

Named limitation: these conclusions are source-traced. No runtime proofs or platform CI were run, and prior issue closure was not re-established.

VERDICT: REVISE
```

#### Raw lens-platform-semantics-r7

```text
No platform drift invalidates O1–O3 or the Phases proof obligations. The new alias refusal makes draining and releasing predecessor bindings before successor acquisition essential. O1’s completed-disposal requirement and O2’s establishment barriers already require that ordering. Windows name folding remains unchanged, and parent-identity matching still covers replacement spellings.

The adjusted replacement fixture releases its setup binding before reopening the renamed inode. New alias tests do not replace the plan’s required platform-neutral ownership and error/retry witnesses.

Limitation: source-only review. No tests, `pnpm rust:windows:check`, or non-Linux Unix source probe ran. Adoption still requires Windows/macOS runtime evidence from `rust-windows-test` and `rust-macos-test`, plus compile/clippy evidence from `rust-platform`. The changed integration verifier remains covered by the existing Node 24 readiness and full real-app proof requirements.

VERDICT: APPROVED
```

#### Raw lens-tauri-security-r7

```text
No security drift invalidation found. The new hard-link admission refusal preserves native authority and binding lifetime. O1–O3 still require drain completion before successor opens or deletion. Changed diagnostics remain native.

Limitation: runtime and platform proofs were not executed. Credential and signed-download flows are unchanged.

VERDICT: APPROVED
```

#### Raw lens-tests-r7

```text
No drift invalidation found. O1–O3 retain assertions for real LRU ownership, blocked successor opens/unlink, WAL close ordering, failed-drain retention, typed errors and bounded completion. Immediate alias refusal alone cannot satisfy O2’s blocking and completion obligations.

The repository selector and platform CI still reach the planned witnesses. The expanded app verifier preserves IPC and shutdown assertions.

Limitation: this read-only review supplies no runtime or revert-to-red evidence. Those remain required adoption proofs (confidence: 100).

VERDICT: APPROVED
```

### delta-r2-stdout.txt

ROUND: 2
DELTA: /home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-1/wt/tasks/plans/.plan-delta-2026-10-09-lru-sqlite-retirement.md-r2.diff
REVISED:
## Approach > ### O1 — publish and bound predecessor ownership
## Approach > ### O2 — enforce the predecessor barrier at reopen and deletion
## Decided autonomously
SETTLED:
# Plan: retain and drain LRU-evicted SQLite connections
## Goal
## MANDATE
## MANDATE > ### LRU eviction drops a database entry without draining its SQLite connections, so one can close after a later delete of the same file
## Threat model and non-goals
## Traced premises
## Approach
## Approach > ### O3 — retain barriers after incomplete drains
## Decisions and trade-offs
## Risks / open questions
## Not part of this task
## Phases
## Carried to diff review

### delta-r3-stdout.txt

ROUND: 3
DELTA: /home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-1/wt/tasks/plans/.plan-delta-2026-10-09-lru-sqlite-retirement.md-r3.diff
REVISED:
## Approach > ### O2 — enforce the predecessor barrier at reopen and deletion
## Approach > ### O3 — retain barriers after incomplete drains
SETTLED:
# Plan: retain and drain LRU-evicted SQLite connections
## Goal
## MANDATE
## MANDATE > ### LRU eviction drops a database entry without draining its SQLite connections, so one can close after a later delete of the same file
## Threat model and non-goals
## Traced premises
## Approach
## Approach > ### O1 — publish and bound predecessor ownership
## Decisions and trade-offs
## Decided autonomously
## Risks / open questions
## Not part of this task
## Phases
## Carried to diff review

### delta-r4-stdout.txt

ROUND: 4
DELTA: /home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-1/wt/tasks/plans/.plan-delta-2026-10-09-lru-sqlite-retirement.md-r4.diff
REVISED:
## Approach > ### O3 — retain barriers after incomplete drains
SETTLED:
# Plan: retain and drain LRU-evicted SQLite connections
## Goal
## MANDATE
## MANDATE > ### LRU eviction drops a database entry without draining its SQLite connections, so one can close after a later delete of the same file
## Threat model and non-goals
## Traced premises
## Approach
## Approach > ### O1 — publish and bound predecessor ownership
## Approach > ### O2 — enforce the predecessor barrier at reopen and deletion
## Decisions and trade-offs
## Decided autonomously
## Risks / open questions
## Not part of this task
## Phases
## Carried to diff review

### delta-r6-stdout.txt

ROUND: 6
DELTA: /home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-1/wt/tasks/plans/.plan-delta-2026-10-09-lru-sqlite-retirement.md-r6.diff
REVISED:
## Decided autonomously
## Risks / open questions
SETTLED:
# Plan: retain and drain LRU-evicted SQLite connections
## Goal
## MANDATE
## MANDATE > ### LRU eviction drops a database entry without draining its SQLite connections, so one can close after a later delete of the same file
## Threat model and non-goals
## Traced premises
## Approach
## Approach > ### O1 — publish and bound predecessor ownership
## Approach > ### O2 — enforce the predecessor barrier at reopen and deletion
## Approach > ### O3 — retain barriers after incomplete drains
## Decisions and trade-offs
## Not part of this task
## Phases
## Carried to diff review

### delta-r8-stdout.txt

ROUND: 8
DELTA: /home/felixb/.claude/drain-plans/chessfable-0a459a4f/slot-2/wt/tasks/plans/.plan-delta-2026-10-09-lru-sqlite-retirement.md-r8.diff
REVISED:
## Approach > ### O1 — publish and bound predecessor ownership
## Approach > ### O2 — enforce the predecessor barrier at reopen and deletion
## Decisions and trade-offs
## Risks / open questions
SETTLED:
# Plan: retain and drain LRU-evicted SQLite connections
## Goal
## MANDATE
## MANDATE > ### LRU eviction drops a database entry without draining its SQLite connections, so one can close after a later delete of the same file
## Threat model and non-goals
## Traced premises
## Approach
## Approach > ### O3 — retain barriers after incomplete drains
## Decided autonomously
## Not part of this task
## Phases
## Carried to diff review

## Adopting session — implementation and cumulative diff review (2026-10-11)

Adopted by drain session ef7373e4-a4fe-4625-a7cf-069cad2e98fe (Claude Code orchestrator, Codex executor) at BASE 0ee13ca0 after `drain_supervisor_plans.py gate` printed `clear`. The planner's note above names `tasks/handoffs/2026-10-09-f-20260930-01-review.md` as the promotion path; this record is that promotion, filed under the adopting run's date and slug so it matches the decision entries that cite it. Autonomous decisions recorded as d-20261011-07 .. d-20261011-12; the review below added d-20261011-13.

Implementation: one sensitive phase on a Codex write leaf (OpenAI high tier), commit 6f631aac, then one repair round on the same resumed thread, commit db366326. Phase proof rerun by the orchestrator on 6f631aac: `cargo test db::repository:: -- --test-threads=1` 96 passed; `pnpm checks:pre-review` green.

### Diff review r1 (REVIEWED_THROUGH 6f631aac)

Lenses on Codex (OpenAI high tier, `--role sensitive`): correctness, root-cause, tests, error-handling, minimalism, code-quality, pgn-index, platform-semantics over the code diff (excluding tasks/decisions.md); one records lens (`--role mechanical`) over tasks/decisions.md. Detection ran on the same model family that wrote the code (same-model review); this context wrote no plan but arbitrates triage of a plan it adopted.

| ID | Lens, rank, confidence | Claim | Disposition | Evidence / closure |
| --- | --- | --- | --- | --- |
| D1 | correctness, blocker, 95 | Two retired same-parent pools' admitted workers each wait on the other's retirement until the 60 s worker deadline. | Fix (db366326) | Confirmed from source: predecessor_admission_inner never rechecked its own closed gate. Worker now refuses under the mutex when its own gate is closed and own closure interrupts an in-progress wait; two witnesses fail with the fix removed. |
| D2 | root-cause, blocker, 92 | content_validation.rs scan_worker opens the bound file mode=rw outside the predecessor barrier. | Fix (db366326), d-20261011-13 | Confirmed: content_validation.rs:556-560 was the remaining production fresh-open path. Shared `predecessor_admission_for` now also serves read_revision; same-file witness fails without the scan admission. |
| D3 | tests, should-fix, 95 | No witness for admission blocking retirement publication. | Fix (db366326) | Witness fails with retirement_reserved forced to false. |
| D4 | error-handling, should-fix, 96 | Pool error log lacks the database identity. | Fix (db366326) | Log names the database leaf. |
| D5 | minimalism, should-fix, 98 | Duplicate active-lease LRU test. | Fix (db366326) | One platform-neutral test kept. |
| D6 | code-quality, should-fix, 96 | DrainGate doc omits the owners gate. | Fix (db366326) | Doc updated. |
| D7 | code-quality, nit, 93 | Bare test timing literals. | Fix (db366326) | Named constants. |
| D8 | orchestrator (fix-round red proof) | Pool budget capped at retire_wait made short-retire tests' setup acquisitions time out under load. | Fix (db366326) | Pool wait keeps its own POOL_CONNECTION_TIMEOUT; predecessor waits keep the retire deadline; deterministic witness fails with the cap restored. |

pgn-index: NOT APPLICABLE. platform-semantics: no findings (Windows/macOS runtime proof remains CI's rust-windows-test, rust-macos-test, rust-platform). records: no findings.

### Diff review r2 — closure round (REVIEWED_THROUGH db366326 plus this record)

Lenses: correctness, root-cause, tests, error-handling, minimalism, code-quality over `6f631aac..db366326` (code), records over d-20261011-13 and this handoff. D1-D8 all CLOSED by their witnessing lenses (correctness D1, D8; root-cause D2; tests D3; error-handling D4; minimalism D5; code-quality D6, D7).

| ID | Lens, rank, confidence | Claim | Disposition |
| --- | --- | --- | --- |
| D9 | tests, should-fix, 96 | The scan witness does not assert the admission lifetime: a retirement attempted while the scan admission is held, or after it is released during validation. | Fix (round-3 repair) |
| D10 | code-quality, should-fix, 90 | `predecessor_admission_for` returns an opaque guard without documenting what it blocks and when to release it. | Fix (round-3 repair) |
| D11 | records, should-fix, 100 | This handoff claimed the closure results were already in tasks/build-ledger.md, which holds no row for this run yet. | Fix: this subsection replaces that claim; the build-ledger row is appended after the push. |

Later rounds are recorded below; the final gate and CI results will be recorded in the tasks/build-ledger.md row, which is written after the push and does not exist before it.

### Diff review r3 — closure round (REVIEWED_THROUGH 604051a4)

Lenses tests, code-quality, correctness, records over `db366326..604051a4`: D9 CLOSED (tests), D10 CLOSED (code-quality), D11 CLOSED (records); correctness found nothing. All APPROVED. Final gates (`pnpm gates:push -- --rust`) green on 604051a4, which was pushed.

### Required CI on 604051a4 and diff review r4

`rust-windows-test` (run 38135146487) failed the two scan witnesses with `CommittedDurabilityUncertain(WorkspaceSidecarReplacement)`: they built the scanned target with `DatabaseFileTarget::for_test_path`, whose retained parent is read-only, and Windows cannot sync a read-only directory handle when scan_worker writes its durable stamp (the reason `for_test_deletion` exists). Repaired in 3d9c6498 by using the writable parent production's `DatabaseMutate` retains. `rust-platform` (all three targets) and `test` were green; `rust-macos-test` was still running when the repair started.

While proving that repair, `delayed_cached_successor_worker_establishment_waits_at_retirement_boundary` failed once inside the serial `db::` suite under load average ~10-20 with r2d2 `Error(Some("database is locked"))` at its final `pool.get_timeout`. It did not reproduce in isolation (0/60 serial, 0/160 at 16-way parallel). Same-area latent defect found while diagnosing it and repaired in aad87640: `ConnectionOptions::on_acquire` switched `journal_mode = WAL` before installing `busy_timeout`, so a pooled connection meeting a reader's lock on a rollback-mode file failed at once (measured on SQLite 3.45.1: ~20 us) instead of waiting. **The flake's cause remains unconfirmed** (review-root-cause r4, should-fix, confidence 95, adopted): the reorder fixes a demonstrated mechanism, but the original lock state was never reproduced, and a held writer lock fails with either order. If the witness flakes again, capture the competing connection's lock state before changing anything.

r4 lenses correctness, root-cause, tests, platform-semantics over `604051a4..aad87640`: all APPROVED; the only finding is the attribution caveat above.

### Required CI on 533e19de: macOS thread exhaustion, and diff review r5

`rust-windows-test` and all three `rust-platform` targets passed on 533e19de (run 38138896410); `test` passed on 604051a4. `rust-macos-test` stalled on both 604051a4 and 533e19de with the same signature: the 29 retirement witnesses all passed (including the spelling-alias ones, which run on case-insensitive APFS), then 88 `db::tests` and `engine::process::tests` failed in a burst within one second, then the log was silent for 90 minutes — not even libtest's 60-second notice — until both runs were cancelled for their logs. Linux could not reproduce it, including the recorded `target_os = "linux"` → `"freebsd"` source probe (2152 passed in parallel).

Measured on Linux with `--test-threads=3`, sampling `/proc` every 20 ms: `db::` peak threads 718 at 3ceaa714 and 2048 at 533e19de; the retirement witnesses alone 1432; peak FDs about 100 throughout. Source: r2d2 0.8.10 gives every pool its own 3-thread scheduled-thread-pool, whose default `CompletePendingScheduled` keeps a dropped pool's threads alive until the pending 30 s reaper tick, and the witnesses churn about 17 pools each. Repaired in 302a55a6 (each pool's executor uses `DiscardPendingScheduled`; `scheduled-thread-pool` 0.2.7, already locked, becomes a direct dependency; d-20261011-14, rationale corrected by d-20261011-15): `db::` 2048 → 710, witnesses 1432 → 197.

r5 lenses correctness, root-cause, tests, platform-semantics, minimalism, records over `533e19de..302a55a6`:

| ID | Lens, rank, confidence | Claim | Disposition |
| --- | --- | --- | --- |
| D13 | tests, blocker, 98 | The witness built the scheduler directly; removing `.thread_pool(pool_worker_threads())` from the production builder passed every test. | Fix (48c41cea): the witness goes through `repository.entry()` and `close_and_invalidate`; fails with the builder line removed and with `CompletePendingScheduled`. |
| D14 | records, should-fix, 98 | d-20261011-14 said one blocked worker in a shared executor would starve every other database; starvation needs all shared workers blocked. | Fix: d-20261011-15 supersedes it with the corrected rationale (choice unchanged). |
| D15 | root-cause, should-fix, 95 | The macOS cause is inferred, not observed: no macOS panic text or thread-creation error exists. | Fix (this record): **the attribution stays provisional until `rust-macos-test` passes on the repaired revision**; if the stall recurs, capture panic text or thread counts on macOS before changing anything. |

Correctness, platform-semantics and minimalism found nothing in their class (correctness rates the attribution at 75 confidence).
