# Drain push recovery, 2026-10-23

## Ownership and delivery boundary

Felix requested autonomous Codex recovery until the drain push lands. The original drain stopped at startup bundle 555155 gzip bytes against 555000. A schema replacement worsened it to 555195 and was reverted. The branch retained two unpushed records commits and 37 uncommitted engine-phase paths. Kit parity, destination identity and current remote CI were verified and were not the original blocker.

This recovery owns that interrupted engine phase and its required repairs, proof and delivery. The reviewed plan expressly makes Phase 1 independently green and committable. Account Phase 2 is not implemented by this recovery, and f-20261005-05 remains open. No broader finding closure is claimed.

Plan authorship and arbitration shared one context. Detection ran on the same OpenAI model family as the code. Sensitive writes resolve to Codex gpt-6.1-sol/high, diff lenses to gpt-6.1-sol/medium. Fresh launcher sessions provide context separation, with no model-family separation. Root owns integration, gates, commits and push.

## Inherited plan history

The full original plan-review history, raw rounds 1 and 2, is preserved in 2026-10-23-f-20261005-05-plan-review.md beside this file. Round 1 adopted two issues, I1 successive upgrade ordering and I2 exact retirement replay. Round 2 closed both. Round 3 refreshed the unchanged obligations from published base 879f1b47 to 53730fc2. All twelve refresh lenses approved or correctly stopped as not applicable. No obligation was invalidated, and no new finding was adopted. Plan adoptions are r1=2 r2=0 r3=0. Measured round wall times were 381.095, 205.999 and 94.846 seconds. Supported active model wall is unknown. Raw round-3 reports follow below.

## Engine phase and bundle repair

Commit 111d212d contains the interrupted phase plus demand-loading of signed catalog document and signature assets. Signature verification and strict persisted-owner validation remain intact. No budget or floor was lowered. The inherited coverage metadata adds the extracted engineInstall.ts source to the existing area without changing numeric baselines or floors.

The phase production build measured entry 552845, largest lazy 480023, total 1639477 gzip bytes against 555000, 550000 and 1640000. Exact related Vitest passed 148 files and 3827 tests. Six native reload_completion tests passed. Pre-review passed all selected lanes, including GNU Windows clippy and both mutation packages at 100 percent. Storage killed 1233 mutants. Tree-path killed 169 and timed out seven, with no surviving or uncovered mutants.

Root independently reran the related renderer tests and six native tests, with canonical phase-root-proof completion 0 at launch b97dc019 plus the identical owned source. Removing only the production owner-envelope hydration hunk, keeping tests unchanged, failed three replacement-document upgrade cases at exit 1. Exact source restoration passed all four boundary cases at exit 0. An earlier offset-bearing extraction was excluded from proof. Evidence is indexed by /tmp/reload-phase1-proof/handoff.md and hydration.patch, replay-reverted.log/.exit and restored.log/.exit.

A release build at clean 111d212d passed. It is preparatory browser evidence, not final gates. Browser, real running-download reload, integrated repair proof, final gates, push, hosted confirmation and installation remain pending at this checkpoint.

## Native runtime proof on ff4d7a14

This supersedes the runtime-pending checkpoint below for the engine reload boundary. Root used the real WebKitGTK driver, genuine signed 81,388,977-byte Stockfish 19 artifact and ordinary native workflow. Each case observed the identical operation running before and after document replacement with the same native process identity. The probe did not apply, retry, rejoin or acknowledge completions. Production alone recovered the result. Candidate and both exact restorations passed all five semantic assertions at actual exit 0. Event-disabled production failed all five at actual exit 1. Startup-coordinator-disabled production received the actual event but failed registration, visible card, acknowledgement and handle assertions at exit 1. Both negatives retained a successful native artifact, with runtime=false and unavailable=false. Root inspected the result screenshots.

Both Git controls applied and restored without offsets. Every candidate test and the probe remained unchanged during each control, and exact source, status and diff restoration were independently checked. Restored binaries were forcibly rebuilt with pnpm gate:run tauri-build, avoiding reuse of a receipt after a deliberately broken binary. No control change is committed. The expanded scratch probe was never run. This compact runtime proof covers only the running-event boundary, with five staged semantic assertions. Setup, timing-unavailable, malformed-data, invalid-handle, screenshot and cleanup diagnostic branches were not separately staged and are not claimed as validated. Native and renderer suites own the other engine obligations.

The following source and receipt archive preserves this one-off probe without installing a tool or adding a gate. Absolute scratch paths identify original observations. Plan authorship and arbitration shared one context. Detection ran on the same model family as code.

### Compact runtime probe

````javascript
// Prepared only. Root runs this once per fresh Node process after reviewing/building production.
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  APP_BINARY, Session, appProcesses, requirePrerequisites,
  startCompositor, startDriver, shutdown, waitFor,
} from '/home/felixb/Projekte/chessfable.worktrees/drain/scripts/app-driver.mjs'
import { decodeCompressedOrJson } from '/home/felixb/Projekte/chessfable.worktrees/drain/src/state/store/debouncedStorage.ts'
import { decodeEngineOwnerValue } from '/home/felixb/Projekte/chessfable.worktrees/drain/src/state/engineOwnerEnvelope.ts'

const ROOT = '/home/felixb/Projekte/chessfable.worktrees/drain'
const OUTPUT = '/tmp/chessfable-drain-recovery-20261023/native-proof'

// Existing Session wire transport. Long native work never blocks execute/sync's HTTP timeout.
async function begin(session, command, args = {}) {
  const key = `__compactIPC_${randomUUID().replaceAll('-', '')}`
  await session.execute(`
    const key = arguments[0];
    window[key] = null;
    window.__TAURI_INTERNALS__.invoke(arguments[1], arguments[2]).then(
      value => { window[key] = { ok: true, value }; },
      error => { window[key] = { ok: false, category: error?.category ?? 'unexpected' }; });
    return true;
  `, [key, command, args])
  return async () => {
    const result = await session.execute('return window[arguments[0]]', [key])
    if (result) await session.execute('delete window[arguments[0]]; return true', [key])
    return result
  }
}
async function ipc(session, command, args = {}, timeoutMs = 15_000) {
  const poll = await begin(session, command, args)
  const result = await waitFor(command, poll, { timeoutMs })
  if (!result.ok) throw new Error('native IPC rejected')
  return result.value
}
async function identity(pid) {
  const stat = await readFile(`/proc/${pid}/stat`, 'utf8')
  return `${pid}:${stat.slice(stat.lastIndexOf(')') + 2).split(' ')[19]}`
}

export async function run() {
  let session, directory, handler, eventId, installedResult
  let stage = 'preflight', runtime = false, unavailable = false, interrupted = false
  const assertions = []
  const observations = {}
  const active = () => { if (interrupted) throw new Error('interrupted') }
  const missing = reason => { const error = new Error(reason); error.unavailable = true; throw error }
  const fault = label => { runtime = true; console.error(`RUNTIME FAIL ${label}: owned setup, transport, capture or cleanup failed`) }
  const signal = () => { interrupted = true; fault('signal') }
  for (const name of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(name, signal)
  try {
    await mkdir(OUTPUT, { recursive: true })
    directory = await mkdtemp(join(OUTPUT, 'compact-'))
    console.log(`OBSERVE artifacts=${directory}`)
    if (process.platform !== 'linux' || process.arch !== 'x64') missing('Linux x86_64 required')
    requirePrerequisites()
    const catalog = JSON.parse(await readFile(join(ROOT, 'src/catalogs/engines.json'), 'utf8'))
    const entry = catalog.find(item => item.name === 'Stockfish' && item.os === 'linux' &&
      item.bmi2 === false && item.path === 'stockfish/stockfish-linux-x86-64-universal')
    if (!entry?.signature || !entry.sha256 || !entry.downloadLink.startsWith('https://')) missing('signed universal entry unavailable')
    const oldPids = new Set(appProcesses().map(item => item.pid))
    stage = 'compositor'
    active()
    const compositor = await startCompositor()
    stage = 'driver'
    active()
    await startDriver({ waylandDisplay: compositor.socket })
    stage = 'session'
    active()
    session = await Session.open(APP_BINARY)
    const page = () => waitFor('engines route', () => {
      active()
      return session.execute(`
        const link = document.querySelector('a[href="/engines"]');
        if (!link) return false;
        if (location.pathname !== '/engines') link.click();
        return location.pathname === '/engines';
      `)
    }, { timeoutMs: 25_000 })
    const documentId = () => session.execute('return window.__compactDocument ||= crypto.randomUUID()')
    const screenshot = async name => writeFile(join(directory, `${name}.png`), Buffer.from(await session.screenshot(), 'base64'))
    stage = 'original-renderer'
    await page()
    const owned = appProcesses().filter(item => !oldPids.has(item.pid) && item.cmd.startsWith(APP_BINARY))
    if (owned.length !== 1) missing('owned native process identity ambiguous')
    const pid = owned[0].pid
    observations.nativeBefore = await identity(pid)
    observations.documentBefore = await documentId()
    const operationId = randomUUID(), engineId = randomUUID()
    Object.assign(observations, { operationId, engineId, catalog: entry.name, version: entry.version, bytes: entry.downloadSize })
    const pending = async () => {
      active()
      const entries = await ipc(session, 'pending_engine_completions')
      const current = entries.find(item => item.id === operationId)
      // Retain success independently of all later snapshots and renderer application failures.
      if (current?.outcome.state === 'succeeded') installedResult = current.outcome.result
      return { entries, current }
    }
    stage = 'install'
    const root = await ipc(session, 'get_engine_workspace')
    const jobId = await ipc(session, 'prepare_download')
    active()
    const result = await begin(session, 'install_engine_workflow', {
      id: operationId, jobId, request: {
        intent: { kind: 'add', engine_id: engineId }, root, progressId: `compact:${operationId}`,
        url: entry.downloadLink, sha256: entry.sha256, signature: entry.signature,
        relativePath: entry.path, name: entry.name, version: entry.version,
        elo: entry.elo ?? null, downloadSize: entry.downloadSize ?? null,
      },
    })
    stage = 'running-before'
    const before = await waitFor('native admission', async () => (await pending()).current ?? await result(), { timeoutMs: 15_000 }).catch(error => {
      if (error.message === 'timed out waiting for native admission') missing('matching running admission not established within deadline')
      throw error
    })
    if (before.outcome?.state !== 'running' || before.request.intent.engine_id !== engineId) missing('matching operation not running before replacement')
    observations.runningBefore = { id: before.id, engineId: before.request.intent.engine_id, state: before.outcome.state }
    console.log(`OBSERVE before=${JSON.stringify(observations)}`)
    stage = 'before-screenshot'
    await screenshot('before-running')
    stage = 'replacement-startup'
    await session.call('POST', '/refresh', {})
    await page()
    observations.documentAfter = await documentId()
    observations.nativeAfter = await identity(pid)
    if (observations.documentBefore === observations.documentAfter || observations.nativeBefore !== observations.nativeAfter) missing('document replacement in same native process not established')
    stage = 'event-listener'
    handler = await session.execute(`
      const id = arguments[0];
      window.__compactEvent = false;
      return window.__TAURI_INTERNALS__.transformCallback(event => {
        if (event.payload?.id === id) window.__compactEvent = true;
      });
    `, [operationId])
    eventId = await ipc(session, 'plugin:event|listen', { event: 'completion-changed', target: { kind: 'Any' }, handler })
    stage = 'running-after'
    const after = (await pending()).current
    if (after?.outcome.state !== 'running' || after.request.intent.engine_id !== engineId) missing('matching operation not running after replacement startup')
    observations.runningAfter = { id: after.id, engineId: after.request.intent.engine_id, state: after.outcome.state }
    console.log(`OBSERVE after=${JSON.stringify(observations)}`)
    stage = 'after-screenshot'
    await screenshot('after-running')
    const snapshot = async () => {
      const native = await pending()
      const visible = await session.execute(`
        const cards = [...document.querySelectorAll('button[aria-pressed]')].filter(node => {
          const box = node.getBoundingClientRect(), style = getComputedStyle(node);
          const texts = [...node.querySelectorAll('p')].map(p => p.textContent.trim());
          return box.width > 0 && box.height > 0 && style.visibility !== 'hidden' &&
            style.display !== 'none' && texts.includes(arguments[0]) && texts.includes(arguments[1]);
        });
        return { raw: localStorage.getItem('engines'), event: window.__compactEvent, cards: cards.length };
      `, [entry.name, entry.path.split('/').at(-1)])
      const owner = decodeEngineOwnerValue(decodeCompressedOrJson(visible.raw))
      const targets = Array.isArray(owner?.value) ? owner.value.filter(item => item.id === engineId) : []
      return { ...native, ...visible, targets }
    }
    stage = 'native-success'
    let final = await waitFor('native terminal result', async () => {
      const value = await snapshot()
      return value.current?.outcome.state === 'running' ? false : value
    }, { timeoutMs: 8 * 60_000 }).catch(error => {
      if (error.message === 'timed out waiting for native terminal result') missing('native success not established within deadline')
      throw error
    })
    if (final.current?.outcome.state === 'failed') {
      console.log(`OBSERVE nativeFailureCategory=${final.current.outcome.result.category}`)
      missing('native success not established')
    }
    if (!installedResult && !final.targets.length) missing('native success not established')
    observations.nativeSuccess = installedResult ? 'retained succeeded result observed' : 'result persisted and acknowledged before mailbox poll'
    stage = 'automatic-recovery'
    try {
      await waitFor('automatic recovery', async () => {
        final = await snapshot()
        return final.event && final.targets.length === 1 && final.cards === 1 && !final.current
      }, { timeoutMs: 25_000 })
    } catch (error) {
      if (error.message !== 'timed out waiting for automatic recovery') throw error
    }
    final = await snapshot()
    const check = (id, passed, message) => {
      assertions.push({ id, passed: Boolean(passed), message })
      console.log(`ASSERT ${passed ? 'PASS' : 'FAIL'} ${id}: ${message}`)
    }
    check('A-event', final.event, 'replacement document received the real matching CompletionChanged event')
    check('A-uuid', final.targets.length === 1, 'event recovery persisted exactly one intended engine UUID')
    check('A-card', final.cards === 1, 'event recovery shows exactly one visible engine card')
    check('A-ack', !final.current, 'event recovery acknowledged the native mailbox entry')
    let usable = false
    const engine = final.targets[0]
    if (engine?.handle?.id?.id && (!installedResult || engine.handle.id.id === installedResult.handle.id.id)) {
      try {
        const config = await ipc(session, 'get_engine_config', { engine: engine.handle }, 35_000)
        usable = Boolean(config.name) && Array.isArray(config.options)
      } catch { /* A-handle records unusable persisted authority independently. */ }
    }
    check('A-handle', usable, 'persisted completion handle answers real native UCI configuration IPC')
    console.log(`OBSERVE success=${JSON.stringify(observations)}`)
    stage = 'result-screenshot'
    await screenshot('result')
  } catch (error) {
    if (error.unavailable) { unavailable = true; console.error(`PROOF UNAVAILABLE ${stage}: ${error.message}`) }
    else fault(stage)
  } finally {
    if (session) {
      try { if (eventId !== undefined) await ipc(session, 'plugin:event|unlisten', { event: 'completion-changed', eventId }) } catch { fault('unlisten') }
      try { if (handler !== undefined) await session.execute('window.__TAURI_INTERNALS__.unregisterCallback(arguments[0]); return true', [handler]) } catch { fault('callback-cleanup') }
      try { if (!(await session.quit()).released) fault('session-quit') } catch { fault('session-quit') }
    }
    try { await shutdown() } catch { fault('owned-resource-cleanup') }
    for (const name of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.removeListener(name, signal)
  }
  const exit = runtime || unavailable || assertions.length !== 5 || assertions.some(item => !item.passed) ? 1 : 0
  if (directory) await writeFile(join(directory, 'receipt.json'), JSON.stringify({ exit, runtime, unavailable, observations, assertions }, null, 2) + '\n')
  console.log(`RESULT exit=${exit} semanticFailures=${assertions.filter(item => !item.passed).length} runtime=${runtime} unavailable=${unavailable}`)
  return exit
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = await run() }
  catch { console.error('RUNTIME FAIL artifact-write: no complete receipt'); process.exitCode = 1 }
}
````

### Probe scope, assertions and staging matrix

````markdown
# Compact running-completion runtime proof

Runtime checkpoint at ff4d7a14. Root ran the genuine signed download through real WebKitGTK.
Candidate native-candidate.Ks4zfO completed 0 with all five semantic assertions. Event-off
native-event-off.WKtVCy completed 1 with native success and all five exact FAIL messages below.
Exact restoration and a forced native rebuild passed native-event-restored.5V4HE9 at 0.
Startup-off native-startup-off.Tt0r7F completed 1 with A-event PASS and the other four exact FAIL
messages. Exact source restoration and a forced build then passed
native-startup-restored.h6SOTi at exit 0 with all five PASS messages.
All five runs established the matching operation running in both documents, a different document
and the same native PID/start identity. Both intentional negatives had runtime=false and
unavailable=false. Root inspected the candidate and control result screenshots. Raw logs and
actual completion records are in /tmp/chessfable-drain-recovery-20261023/gate-<case>.<suffix>/.
No cleanup/setup diagnostic failure matrix is claimed. This
scratch probe covers T1's missing real native event-driven recovery across document replacement.
It adds exactly five semantic assertions. Remove this directory after evidence is archived.
No persistent tool, rule, alternate codec, driver, mock, transport or production hook is added.

The original expanded script and README are preserved byte-identically as
`prepared-expanded-proof.mjs` and `prepared-expanded-README.md`. Their unexecuted matrix is
prepared-only history, not observed evidence. The compact probe replaces that runtime scope
before any run. Both EP storage staging files are unchanged and retain their separate scope.

## Command and evidence

After root reviews and builds the candidate, use a fresh Node process for each invocation:

```sh
node /tmp/chessfable-drain-recovery-20261023/native-proof/compact-proof.mjs
```

For a detached run with raw output and its actual exit, use a unique case label:

```sh
proof_label=candidate-1
proof_base=/tmp/chessfable-drain-recovery-20261023/native-proof
setsid nohup bash -s "$proof_label" > "$proof_base/$proof_label.log" 2>&1 <<'SH' & disown
proof_label=$1
node /tmp/chessfable-drain-recovery-20261023/native-proof/compact-proof.mjs
proof_status=$?
printf '%s\n' "$proof_status" > "/tmp/chessfable-drain-recovery-20261023/native-proof/$proof_label.actual-exit"
exit "$proof_status"
SH
```

Wait on that actual-exit artifact before another run/build. Never reuse an old exit artifact or
match process names to infer completion. Each invocation prints its `compact-*/` directory with
`before-running.png`, `after-running.png`, `result.png` and `receipt.json`. Root inspects the
screenshots and retains log/actual-exit alongside the receipt. Screenshots are real WebKitGTK
page observations, not canonical pixels or GTK chrome evidence.

Exit **0** requires all five assertions, qualifying running/native-success observations and
successful cleanup. Exit **1** distinguishes `ASSERT FAIL`, `PROOF UNAVAILABLE`, and
`RUNTIME FAIL` in log/receipt. Setup failure or unavailable timing is not a semantic red.
Importing the module exports `run()` without launch. A fresh process is required because the
existing harness shutdown owner is one-shot. Every invocation gets a new disposable profile.

## What this actually observes

The existing `Session`, `startCompositor`, `startDriver`, `shutdown`, `waitFor`, prerequisites and
process helpers own all runtime machinery. No custom port probe or second session is added.
The script navigates the real `/engines` route and submits normal registered installation IPC
with the genuine Linux x86_64 universal Stockfish catalog fields unchanged. The current archive
is 81,388,977 bytes. Production signature, HTTPS and DNS validation remain intact.

The same matching operation must be native `running` in the original document and again after
real WebDriver refresh, replacement startup/route mounting and independent read-only event-listener
registration. Document UUID sentinels and native PID/start-time values are observed before/after
and logged safely, with screenshots. They are availability conditions, not extra assertion counts.
If running cannot be established in both documents, retry a fresh unchanged invocation. A terminal
startup replay cannot substitute for this boundary.

The proof listener records only whether the real matching `CompletionChanged` arrived. Mailbox,
storage and DOM polling are read-only. There is no explicit apply, retry, rejoin or acknowledgement
call, and no further refresh. Only production startup and event consumers can apply the result.
Any observed succeeded native artifact is retained in probe memory through subsequent snapshots.
Thus a control's retained native success reaches all five semantic messages even when persistence
never appears. If native acknowledgement beats polling, an intended engine already persisted by
the production coordinator is distinguished as indirect success evidence in the observations.
Absent either native success or its persisted result, proof is unavailable rather than green.

The current owner is decoded using the existing production `decodeCompressedOrJson` and
`decodeEngineOwnerValue`. No storage writes or seed fixtures are introduced. Raw owner bytes,
completion requests, native diagnostics, credentials and process environments are not logged.

## Five semantic failure messages

```text
ASSERT FAIL A-event: replacement document received the real matching CompletionChanged event
ASSERT FAIL A-uuid: event recovery persisted exactly one intended engine UUID
ASSERT FAIL A-card: event recovery shows exactly one visible engine card
ASSERT FAIL A-ack: event recovery acknowledged the native mailbox entry
ASSERT FAIL A-handle: persisted completion handle answers real native UCI configuration IPC
```

Card observation uses the catalog's expected name and filename independently of persisted UUID
lookup. Handle observation uses the actual persisted target handle and a real native UCI
configuration request, comparing to the native result handle when that result was observed.
All five messages are evaluated after the bounded application wait. A missing target fails the
handle check without suppressing its message. No upgrade or repeat-reload checks are included.

## Root's unchanged-script control sequence

All control patches were generated by Git diffing scratch copies of the **current** production
sources. `control-generation.json` records the exact source and patch hashes. Neither was
applied to this checkout. The event hunk uses current `report_download_error(..., id, error)`
and current renderer-safe error comment as context. Its sole change wraps the actual native
`CompletionChanged` emit/log block in `if false`. The startup hunk removes only the coordinator
import and startup call, preserving `initializePathOwners` and native work.

Root coordinates an exclusive source/build window, retains candidate source/test/script/binary
hashes and exact source copies, and runs this sequence. Tests and this script stay byte-identical:

| Build/run | Required result |
| --- | --- |
| Candidate | Actual exit 0, qualifying observations, five PASS lines and inspected captures |
| `completion-event-control.patch` | Actual exit 1, qualifying running observations and native succeeded artifact, all five exact FAIL lines above |
| Exact event-hunk restoration | Rebuild, actual exit 0 |
| `startup-recovery-control.patch` | Actual exit 1, qualifying running observations and native success, A-event PASS plus A-uuid/A-card/A-ack/A-handle FAIL |
| Exact startup-hunk restoration | Rebuild, actual exit 0 |

For each control separately, use its filename in these commands only after the previous run's
cleanup and root's source review. Never apply both controls together:

```sh
git apply --check --verbose /tmp/chessfable-drain-recovery-20261023/native-proof/completion-event-control.patch
git apply --verbose /tmp/chessfable-drain-recovery-20261023/native-proof/completion-event-control.patch
```

Inspect the exact candidate-to-control source delta before rebuilding. Any offset, extra edit or
refusal invalidates this prepared hunk. Re-cut from current Git source under root review rather
than forcing it. After the control run, reverse precisely that same hunk:

```sh
git apply -R --check --verbose /tmp/chessfable-drain-recovery-20261023/native-proof/completion-event-control.patch
git apply -R --verbose /tmp/chessfable-drain-recovery-20261023/native-proof/completion-event-control.patch
```

Compare exact source bytes to the saved candidate and verify script/test hashes, including
untracked tests. Never copy a saved whole file over concurrent work. Rebuild the restored app
and rerun. Preserve patch output showing no offsets. A runtime/setup failure, unavailable running
window or native failure alone does not establish either control's red. If genuine transfers are
too fast on repeated fresh profiles, report this runtime boundary unavailable.

## Nonzero paths and staging status

The five semantic assertions are staged by the actual event-off run at exit 1. Its output printed
each of the five exact FAIL messages listed above, with native success retained. The actual
startup-off run at exit 1 printed A-event PASS and the other four exact FAIL messages. Both used
unchanged probe/tests and exact no-offset Git controls. The restored event run passed all five at
exit 0 after byte-identical restoration and a forced fresh native build. All other diagnostic
paths below remain **not staged**. No diagnostic path is claimed unstageable. Their coverage
remains explicitly unexecuted and must be disclosed alongside any green result.

| Source path / stage | Nonzero behavior |
| --- | --- |
| Module import, output-directory creation or final receipt write | Node setup error, or `RUNTIME FAIL artifact-write`, exit 1. Cleanup precedes final receipt writing. |
| `preflight` | Missing prerequisite, unreadable/malformed catalog, process listing or filesystem failure is runtime failure. Unsupported platform or unavailable signed universal entry is proof unavailable. |
| `compositor`, `driver`, `session`, `original-renderer` | Existing startup/route/identity calls fail or time out. Runtime failure, except an ambiguous owned native PID is proof unavailable. Existing harness also owns occupied-driver refusal. |
| `install` | Workspace/reservation/IPC start failure is runtime failure. No substitute download input or widened transport is used. |
| `running-before`, `running-after` | Missing/mismatched/non-running operation or admission deadline is proof unavailable. IPC rejection/transport failure is runtime failure. Too-fast transfer is not semantic evidence. |
| `replacement-startup` | WebDriver/route/process inspection failure is runtime failure. Failure to establish a different document with the same native PID/start time is proof unavailable. |
| `event-listener` | Native callback/listener registration failure is runtime failure. This cannot replace the A-event semantic red from a successfully registered observer. |
| `before-screenshot`, `after-screenshot`, `result-screenshot` | Capture/output failure is runtime failure. Result capture occurs after all five semantic checks. |
| `native-success` | Observed failed outcome, terminal deadline or no observed/persisted successful result is proof unavailable. Safe failure category is logged when observed. Transport/decoder failure is runtime failure. |
| `automatic-recovery` | Application deadline is consumed and all five semantic checks run. Other read/transport errors are runtime failure. |
| Five `check(...)` calls | Each false result prints its exact independent message and causes exit 1. Handle IPC/configuration rejection is caught and fails A-handle. |
| Signal, `unlisten`, `callback-cleanup`, `session-quit`, `owned-resource-cleanup` | Runtime failure and exit 1, even if all five assertions passed. The existing harness remains cleanup owner. |
| Final result guard | Any count other than five, any false assertion, runtime flag or unavailable flag gives exit 1. |

Uncovered diagnostics include every setup, timeout, unavailable-window, screenshot, signal,
callback/session/group cleanup and artifact-write failure above. Central controls exercise absent
event/effect behavior, not every predicate branch. They do not independently stage wrong-event-ID
filtering, duplicate UUIDs/cards, hidden-card detection, malformed owner decoding, invalid persisted
handle authority, bad UCI payload/rejection or cleanup failure. In particular A-handle's source
controls fail its missing-target guard, not an actual invalid-handle probe. No additional disposable
staging framework is added for those diagnostics. No failure receipt is claimed until executed.

## Scope and ownership

The existing driver supplies a disposable HOME and removes XDG overrides for the app. It owns the
compositor/driver/app groups and cleanup. The probe never signals an existing PID or shared group.
Its signal handler only marks its own run interrupted, then unwinds through existing cleanup after
the current bounded call. IPC waits are 15 seconds, real transfer eight minutes, application/route
waits 25 seconds, configuration 35 seconds, and startup/HTTP/cleanup retain existing driver bounds.
No signing key, real profile, credentials, service configuration or repository file is touched.

This probe does not exercise Upgrade, repeated reloads, partial owner replay, retirement actors,
admission ordering, native publication timing, deterministic subscription-gap timing, collectible
resource retention, accounts or cross-platform runtime. Those obligations remain with the real
renderer/native suites and source-hunk counterfactuals, including `engineCompletions.test.ts`,
`engineOwnerStorage.test.ts`, and `reload_completion` native tests. This simplification does not
withdraw their product coverage or claim those suites were run here. Root still owns ordinary
`pnpm verify:app`, full `pnpm test:e2e:container`, and the remaining plan/gate obligations.
````

### Event-only control

Exact patch bytes are encoded as a JSON string to preserve blank context markers.

````json
"diff --git a/src-tauri/src/fs.rs b/src-tauri/src/fs.rs\nindex 2f838f98..cb3beed8 100644\n--- a/src-tauri/src/fs.rs\n+++ b/src-tauri/src/fs.rs\n@@ -1691,11 +1691,13 @@ async fn run_engine_install_completion<R: tauri::Runtime>(\n         if let (Err(error), Ok(progress)) = (&result, &progress) {\n             report_download_error(&state, &app, progress, id, error);\n         }\n-        if let Err(error) =\n-            (crate::infra::operations::completions::CompletionChanged { id: id.clone() })\n-                .emit_to(&app, owner)\n-        {\n-            log::warn!(\"completion {id} notification failed: {error}\");\n+        if false {\n+            if let Err(error) =\n+                (crate::infra::operations::completions::CompletionChanged { id: id.clone() })\n+                    .emit_to(&app, owner)\n+            {\n+                log::warn!(\"completion {id} notification failed: {error}\");\n+            }\n         }\n         // Errors retain the renderer-safe payload for recovery, and are fully logged natively.\n         if let Err(error) = result {\n"
````

### Startup-only control

Exact patch bytes are encoded as a JSON string to preserve blank context markers.

````json
"diff --git a/src/index.tsx b/src/index.tsx\nindex 3938e07a..9195efb9 100644\n--- a/src/index.tsx\n+++ b/src/index.tsx\n@@ -12,7 +12,6 @@ import { logFailureSafely, safeFailureContext } from \"./platform/errors\";\n import { tauri } from \"./platform/tauri\";\n import { initializeWorkspace } from \"./state/atoms\";\n import { initializePathOwners } from \"./state/pathOwners\";\n-import { initializeEngineCompletions } from \"./state/engineCompletions\";\n \n initializeWorkspace();\n \n@@ -101,7 +100,6 @@ export const applicationStartup = (async () => {\n \n   try {\n     await initializePathOwners();\n-    await initializeEngineCompletions();\n   } catch (error) {\n     await logFailureSafely(\n       \"StartupEngineCompletionError\",\n"
````

### gate-native-candidate.Ks4zfO

````text
0 native-candidate ff4d7a1414627f1a48f97a813e376962c0e8d24e
OBSERVE artifacts=/tmp/chessfable-drain-recovery-20261023/native-proof/compact-ZT9tcr
OBSERVE before={"nativeBefore":"3953600:19916639","documentBefore":"8c1c81c6-9c48-49bf-bbdf-748f7d6580ac","operationId":"04e5aeff-1b45-4878-b1e3-0ab5ee8e9a5d","engineId":"bcd51bc8-0d3e-46fd-b68a-800229977435","catalog":"Stockfish","version":"19","bytes":81388977,"runningBefore":{"id":"04e5aeff-1b45-4878-b1e3-0ab5ee8e9a5d","engineId":"bcd51bc8-0d3e-46fd-b68a-800229977435","state":"running"}}
OBSERVE after={"nativeBefore":"3953600:19916639","documentBefore":"8c1c81c6-9c48-49bf-bbdf-748f7d6580ac","operationId":"04e5aeff-1b45-4878-b1e3-0ab5ee8e9a5d","engineId":"bcd51bc8-0d3e-46fd-b68a-800229977435","catalog":"Stockfish","version":"19","bytes":81388977,"runningBefore":{"id":"04e5aeff-1b45-4878-b1e3-0ab5ee8e9a5d","engineId":"bcd51bc8-0d3e-46fd-b68a-800229977435","state":"running"},"documentAfter":"dd62e062-b009-460c-8549-ebfa7b8f409b","nativeAfter":"3953600:19916639","runningAfter":{"id":"04e5aeff-1b45-4878-b1e3-0ab5ee8e9a5d","engineId":"bcd51bc8-0d3e-46fd-b68a-800229977435","state":"running"}}
ASSERT PASS A-event: replacement document received the real matching CompletionChanged event
ASSERT PASS A-uuid: event recovery persisted exactly one intended engine UUID
ASSERT PASS A-card: event recovery shows exactly one visible engine card
ASSERT PASS A-ack: event recovery acknowledged the native mailbox entry
ASSERT PASS A-handle: persisted completion handle answers real native UCI configuration IPC
OBSERVE success={"nativeBefore":"3953600:19916639","documentBefore":"8c1c81c6-9c48-49bf-bbdf-748f7d6580ac","operationId":"04e5aeff-1b45-4878-b1e3-0ab5ee8e9a5d","engineId":"bcd51bc8-0d3e-46fd-b68a-800229977435","catalog":"Stockfish","version":"19","bytes":81388977,"runningBefore":{"id":"04e5aeff-1b45-4878-b1e3-0ab5ee8e9a5d","engineId":"bcd51bc8-0d3e-46fd-b68a-800229977435","state":"running"},"documentAfter":"dd62e062-b009-460c-8549-ebfa7b8f409b","nativeAfter":"3953600:19916639","runningAfter":{"id":"04e5aeff-1b45-4878-b1e3-0ab5ee8e9a5d","engineId":"bcd51bc8-0d3e-46fd-b68a-800229977435","state":"running"},"nativeSuccess":"result persisted and acknowledged before mailbox poll"}
RESULT exit=0 semanticFailures=0 runtime=false unavailable=false
````

### gate-native-event-off.WKtVCy

````text
1 native-event-off ff4d7a1414627f1a48f97a813e376962c0e8d24e
OBSERVE artifacts=/tmp/chessfable-drain-recovery-20261023/native-proof/compact-BnB1Qs
OBSERVE before={"nativeBefore":"3955833:19933040","documentBefore":"1a034b31-2d4a-4658-a7dd-625b25550071","operationId":"adfb5ad7-7364-40a8-9a6e-cfe9313ae542","engineId":"233826fb-19fa-4f6f-8984-f61ea790aa74","catalog":"Stockfish","version":"19","bytes":81388977,"runningBefore":{"id":"adfb5ad7-7364-40a8-9a6e-cfe9313ae542","engineId":"233826fb-19fa-4f6f-8984-f61ea790aa74","state":"running"}}
OBSERVE after={"nativeBefore":"3955833:19933040","documentBefore":"1a034b31-2d4a-4658-a7dd-625b25550071","operationId":"adfb5ad7-7364-40a8-9a6e-cfe9313ae542","engineId":"233826fb-19fa-4f6f-8984-f61ea790aa74","catalog":"Stockfish","version":"19","bytes":81388977,"runningBefore":{"id":"adfb5ad7-7364-40a8-9a6e-cfe9313ae542","engineId":"233826fb-19fa-4f6f-8984-f61ea790aa74","state":"running"},"documentAfter":"7b770009-c0b0-4896-9858-7a966cc657a3","nativeAfter":"3955833:19933040","runningAfter":{"id":"adfb5ad7-7364-40a8-9a6e-cfe9313ae542","engineId":"233826fb-19fa-4f6f-8984-f61ea790aa74","state":"running"}}
ASSERT FAIL A-event: replacement document received the real matching CompletionChanged event
ASSERT FAIL A-uuid: event recovery persisted exactly one intended engine UUID
ASSERT FAIL A-card: event recovery shows exactly one visible engine card
ASSERT FAIL A-ack: event recovery acknowledged the native mailbox entry
ASSERT FAIL A-handle: persisted completion handle answers real native UCI configuration IPC
OBSERVE success={"nativeBefore":"3955833:19933040","documentBefore":"1a034b31-2d4a-4658-a7dd-625b25550071","operationId":"adfb5ad7-7364-40a8-9a6e-cfe9313ae542","engineId":"233826fb-19fa-4f6f-8984-f61ea790aa74","catalog":"Stockfish","version":"19","bytes":81388977,"runningBefore":{"id":"adfb5ad7-7364-40a8-9a6e-cfe9313ae542","engineId":"233826fb-19fa-4f6f-8984-f61ea790aa74","state":"running"},"documentAfter":"7b770009-c0b0-4896-9858-7a966cc657a3","nativeAfter":"3955833:19933040","runningAfter":{"id":"adfb5ad7-7364-40a8-9a6e-cfe9313ae542","engineId":"233826fb-19fa-4f6f-8984-f61ea790aa74","state":"running"},"nativeSuccess":"retained succeeded result observed"}
RESULT exit=1 semanticFailures=5 runtime=false unavailable=false
````

### gate-native-event-restored.5V4HE9

````text
0 native-event-restored ff4d7a1414627f1a48f97a813e376962c0e8d24e
OBSERVE artifacts=/tmp/chessfable-drain-recovery-20261023/native-proof/compact-Y8e4RS
OBSERVE before={"nativeBefore":"3958036:19948107","documentBefore":"26d8947f-2908-4c82-aa55-564594c569b9","operationId":"602ae185-8c2a-4744-aa77-61f9992d128a","engineId":"4fbb20e3-06c0-416b-b4f7-84d01aec22a5","catalog":"Stockfish","version":"19","bytes":81388977,"runningBefore":{"id":"602ae185-8c2a-4744-aa77-61f9992d128a","engineId":"4fbb20e3-06c0-416b-b4f7-84d01aec22a5","state":"running"}}
OBSERVE after={"nativeBefore":"3958036:19948107","documentBefore":"26d8947f-2908-4c82-aa55-564594c569b9","operationId":"602ae185-8c2a-4744-aa77-61f9992d128a","engineId":"4fbb20e3-06c0-416b-b4f7-84d01aec22a5","catalog":"Stockfish","version":"19","bytes":81388977,"runningBefore":{"id":"602ae185-8c2a-4744-aa77-61f9992d128a","engineId":"4fbb20e3-06c0-416b-b4f7-84d01aec22a5","state":"running"},"documentAfter":"7e3f6c17-679b-4965-8b9e-ec0158da8dba","nativeAfter":"3958036:19948107","runningAfter":{"id":"602ae185-8c2a-4744-aa77-61f9992d128a","engineId":"4fbb20e3-06c0-416b-b4f7-84d01aec22a5","state":"running"}}
ASSERT PASS A-event: replacement document received the real matching CompletionChanged event
ASSERT PASS A-uuid: event recovery persisted exactly one intended engine UUID
ASSERT PASS A-card: event recovery shows exactly one visible engine card
ASSERT PASS A-ack: event recovery acknowledged the native mailbox entry
ASSERT PASS A-handle: persisted completion handle answers real native UCI configuration IPC
OBSERVE success={"nativeBefore":"3958036:19948107","documentBefore":"26d8947f-2908-4c82-aa55-564594c569b9","operationId":"602ae185-8c2a-4744-aa77-61f9992d128a","engineId":"4fbb20e3-06c0-416b-b4f7-84d01aec22a5","catalog":"Stockfish","version":"19","bytes":81388977,"runningBefore":{"id":"602ae185-8c2a-4744-aa77-61f9992d128a","engineId":"4fbb20e3-06c0-416b-b4f7-84d01aec22a5","state":"running"},"documentAfter":"7e3f6c17-679b-4965-8b9e-ec0158da8dba","nativeAfter":"3958036:19948107","runningAfter":{"id":"602ae185-8c2a-4744-aa77-61f9992d128a","engineId":"4fbb20e3-06c0-416b-b4f7-84d01aec22a5","state":"running"},"nativeSuccess":"result persisted and acknowledged before mailbox poll"}
RESULT exit=0 semanticFailures=0 runtime=false unavailable=false
````

### gate-native-startup-off.Tt0r7F

````text
1 native-startup-off ff4d7a1414627f1a48f97a813e376962c0e8d24e
OBSERVE artifacts=/tmp/chessfable-drain-recovery-20261023/native-proof/compact-R4RUgB
OBSERVE before={"nativeBefore":"3960066:19962467","documentBefore":"61243f2d-9bae-4d72-9814-5741563c0421","operationId":"c2cd6f5f-88f6-4eaa-8c7b-7733c106cce0","engineId":"8ac8d232-bf96-46c7-a456-ef6191436d3b","catalog":"Stockfish","version":"19","bytes":81388977,"runningBefore":{"id":"c2cd6f5f-88f6-4eaa-8c7b-7733c106cce0","engineId":"8ac8d232-bf96-46c7-a456-ef6191436d3b","state":"running"}}
OBSERVE after={"nativeBefore":"3960066:19962467","documentBefore":"61243f2d-9bae-4d72-9814-5741563c0421","operationId":"c2cd6f5f-88f6-4eaa-8c7b-7733c106cce0","engineId":"8ac8d232-bf96-46c7-a456-ef6191436d3b","catalog":"Stockfish","version":"19","bytes":81388977,"runningBefore":{"id":"c2cd6f5f-88f6-4eaa-8c7b-7733c106cce0","engineId":"8ac8d232-bf96-46c7-a456-ef6191436d3b","state":"running"},"documentAfter":"7b435614-615c-445e-9b63-3780b73c1b76","nativeAfter":"3960066:19962467","runningAfter":{"id":"c2cd6f5f-88f6-4eaa-8c7b-7733c106cce0","engineId":"8ac8d232-bf96-46c7-a456-ef6191436d3b","state":"running"}}
ASSERT PASS A-event: replacement document received the real matching CompletionChanged event
ASSERT FAIL A-uuid: event recovery persisted exactly one intended engine UUID
ASSERT FAIL A-card: event recovery shows exactly one visible engine card
ASSERT FAIL A-ack: event recovery acknowledged the native mailbox entry
ASSERT FAIL A-handle: persisted completion handle answers real native UCI configuration IPC
OBSERVE success={"nativeBefore":"3960066:19962467","documentBefore":"61243f2d-9bae-4d72-9814-5741563c0421","operationId":"c2cd6f5f-88f6-4eaa-8c7b-7733c106cce0","engineId":"8ac8d232-bf96-46c7-a456-ef6191436d3b","catalog":"Stockfish","version":"19","bytes":81388977,"runningBefore":{"id":"c2cd6f5f-88f6-4eaa-8c7b-7733c106cce0","engineId":"8ac8d232-bf96-46c7-a456-ef6191436d3b","state":"running"},"documentAfter":"7b435614-615c-445e-9b63-3780b73c1b76","nativeAfter":"3960066:19962467","runningAfter":{"id":"c2cd6f5f-88f6-4eaa-8c7b-7733c106cce0","engineId":"8ac8d232-bf96-46c7-a456-ef6191436d3b","state":"running"},"nativeSuccess":"retained succeeded result observed"}
RESULT exit=1 semanticFailures=4 runtime=false unavailable=false
````

### gate-native-startup-restored.h6SOTi

````text
0 native-startup-restored ff4d7a1414627f1a48f97a813e376962c0e8d24e
OBSERVE artifacts=/tmp/chessfable-drain-recovery-20261023/native-proof/compact-8a3d5r
OBSERVE before={"nativeBefore":"3962244:19978200","documentBefore":"80a0a424-6e0a-4e9e-84bf-54d04f1be859","operationId":"d40fc21a-dd52-4a59-8943-22c7bfa6b67d","engineId":"e8bc4163-8406-4b67-85e6-fe803df6a17b","catalog":"Stockfish","version":"19","bytes":81388977,"runningBefore":{"id":"d40fc21a-dd52-4a59-8943-22c7bfa6b67d","engineId":"e8bc4163-8406-4b67-85e6-fe803df6a17b","state":"running"}}
OBSERVE after={"nativeBefore":"3962244:19978200","documentBefore":"80a0a424-6e0a-4e9e-84bf-54d04f1be859","operationId":"d40fc21a-dd52-4a59-8943-22c7bfa6b67d","engineId":"e8bc4163-8406-4b67-85e6-fe803df6a17b","catalog":"Stockfish","version":"19","bytes":81388977,"runningBefore":{"id":"d40fc21a-dd52-4a59-8943-22c7bfa6b67d","engineId":"e8bc4163-8406-4b67-85e6-fe803df6a17b","state":"running"},"documentAfter":"f88607aa-660f-4029-8e52-9e70fad80abb","nativeAfter":"3962244:19978200","runningAfter":{"id":"d40fc21a-dd52-4a59-8943-22c7bfa6b67d","engineId":"e8bc4163-8406-4b67-85e6-fe803df6a17b","state":"running"}}
ASSERT PASS A-event: replacement document received the real matching CompletionChanged event
ASSERT PASS A-uuid: event recovery persisted exactly one intended engine UUID
ASSERT PASS A-card: event recovery shows exactly one visible engine card
ASSERT PASS A-ack: event recovery acknowledged the native mailbox entry
ASSERT PASS A-handle: persisted completion handle answers real native UCI configuration IPC
OBSERVE success={"nativeBefore":"3962244:19978200","documentBefore":"80a0a424-6e0a-4e9e-84bf-54d04f1be859","operationId":"d40fc21a-dd52-4a59-8943-22c7bfa6b67d","engineId":"e8bc4163-8406-4b67-85e6-fe803df6a17b","catalog":"Stockfish","version":"19","bytes":81388977,"runningBefore":{"id":"d40fc21a-dd52-4a59-8943-22c7bfa6b67d","engineId":"e8bc4163-8406-4b67-85e6-fe803df6a17b","state":"running"},"documentAfter":"f88607aa-660f-4029-8e52-9e70fad80abb","nativeAfter":"3962244:19978200","runningAfter":{"id":"d40fc21a-dd52-4a59-8943-22c7bfa6b67d","engineId":"e8bc4163-8406-4b67-85e6-fe803df6a17b","state":"running"},"nativeSuccess":"result persisted and acknowledged before mailbox poll"}
RESULT exit=0 semanticFailures=0 runtime=false unavailable=false
````

### Independent verifier-consumer failure

The subsequent unchanged verifier child in native-proof/ep-storage-sqZpX4 printed both intended EP1-storage and EP2-storage failures after a valid persisted-name fault, and exited 1. UI card/input/save-error checks stayed green. The same run also failed RF0 with Command engine_archive_destination not found, making that negative receipt non-isolated. Source tracing identified stale calls to register_installed_engine as well. This was immediately filed as f-20261023-02, linked to Phase 1. Repair and a fresh normal positive verifier remain pending at this checkpoint. Decisions d-20261023-06 and d-20261023-07 record reporting ownership and the public-workflow/native-helper proof mapping with reversal paths.

## Public permission verifier repair checkpoint

Finding f-20261023-02 is repaired in source and awaits real-input staging and the ordinary positive verifier. RF0 and RF8 now submit a real public install workflow with valid native reservation and UUIDs, current catalog fields and a deliberately non-hex 64-character digest. An accessible selected root must reach the retained InvalidInput result at the later integrity boundary, before adoption, network transfer or execution. Root read and search loss must instead retain Permission, I/O failure and the permission root label. No private renderer command was restored, and no IPC outcome is fabricated.

RF3 now honestly names public workflow root search denial. Later private adoption, publication and registration remain covered by the unchanged native test root_failure_engine_later_adoption_publication_and_registration. The former browser RF4 child case is preserved by root_failure_engine_healthy_root_child_permission_denial_is_unlabelled, which ran under UID 1000 and verified real PermissionDenied beneath a healthy 0700 root, the unchanged safe category/message, no rootFailure field, non-executable bytes and exact byte preservation. All seven root_failure_engine tests passed at exit 0. This is native Linux proof and does not claim Windows runtime coverage.

Each real workflow probe now waits for production acknowledgement, releases its prepared reservation and closes the actual notification through DOM controls before continuing. The direct RF2 notification cannot make the later actual Add/Install guidance assertion pass. RF6's own notification is cleared before RF3. RF5 and RF7 continue checking real puzzle guidance, saved engine bytes and unrelated file bytes. Every root/child mode is restored through the existing cleanup owner. Both EP storage assertions and the shared decoder are unchanged.

Scoped formatter, lint, Node syntax and import-only checks passed. Canonical permission-pre-review.aBAflV completed 0, including all selected lanes and the 1253.8-second mutation run. The source repair adds no product command, signature exception, new checker, gate, hook or persistent tool. The disposable staging preparation reuses the existing owned Node-inspector choreography. New runtime and cleanup diagnostic limits will be reported with actual receipts, not inferred from syntax checks. The earlier EP negative remains non-isolated because its old RF0 failure was independent. Fresh ordinary positive verification is still required.

## Integrated repair checkpoint

Source repair c7032f5a captures the terminal response before emission and reuses Error.renderer_payload for retained failures. Cancellation and safe HTTP/engine guidance survive unchanged. The completion owner reports and weak-marks the same error before acknowledgement. Storage reports and returns its own marked object, preserving ordinary-save and hydration reporting without duplicate completion/component notifications. A dependent AddPuzzle fixture preserves actual error-helper exports. The real-app verifier shares the canonical pure owner-envelope decoder, with both EP storage assertions and messages unchanged.

Root independently passed 168 renderer files with 4121 tests, ten native reload_completion tests and the exact retirement race in integrated-final.euMPiQ. That aggregate attempt was stopped at exit 143 after Windows clippy rejected two explicit Arc dereferences in archive fixtures. Both expressions were corrected without changing assertions or production behavior, and standalone Windows clippy passed. The separate earlier integrated-repair.YhQQwn attempt also remains 143, after test type/lint failures that were subsequently repaired. Neither interrupted aggregate is green evidence.

Canonical pre-review-retry.l7D0X0 completed 0 on the final repair tree. All selected lanes passed, including the Windows target, types, lint, formatting, both coverage mappings and bundle. Mutation took 1001.9 seconds and both selected packages passed. Current bundle measures entry 552932, largest lazy 479993 and total 1639516 gzip bytes, with all original ceilings unchanged. This supersedes the earlier phase-only sizes for the repaired candidate.

Six renderer Git-hunk controls failed at exit 1 and restored green at exit 0, with unchanged tests and exact no-offset restoration. They cover report-before-acknowledgement, duplicate notifications, persistence reporting ownership, payload preservation, missing-record failure and the subscription gap. Evidence prefixes are renderer-observation-order-* under /tmp/chessfable-drain-recovery-20261023. The event-first component measured two notifications before and one after. Three native controls failed at exit 101 and restored green at 0, covering acknowledgement-before-command-response, otherwise collectible capability retention and catalog retention. Their exact restoration and patches are indexed in native-counterfactual-evidence.json.

The retirement fixture defect was filed immediately as f-20261023-01 and is now closed with its 101-before, 0-after witness. It queues retirement before replacement admission while retaining the registration barrier and every original refusal/termination/admission assertion. Broader f-20261005-05 stays open for account Phase 2. Root integration observations also repaired the verifier's old array-only consumer, test type/lint failures and duplicate/error-observation ownership within C2/E1. These are disclosed dependencies, not additional lens adoptions or original plan credit.

Real running-download proof, closure review, final browser verification, clean final gates, push, hosted confirmation and installation remain pending at this checkpoint. The expanded scratch runtime probe was never executed and is not evidence. A compact five-assertion probe uses the existing real driver to cover only the missing running-event boundary. Upgrade/repeat correctness remains with the actual renderer/native suites and their source-hunk controls. Setup/cleanup diagnostic staging gaps will be named with runtime results.

Plan authorship and arbitration shared one context. Detection ran on the same model family as the code. Root owns final verification and delivery.

## Round 1 arbitration

Reviewed through 111d212d against c4da644f. All thirteen required sessions completed. Raw reports are preserved below. Fifteen prefixed findings were adopted as Fix. No Skip or Defer was used.

- C1 cancellation becomes a save failure. Fix through the existing safe failure payload and cancellation contract.
- C2 an acknowledged failed result becomes false success for another caller. Fix by preserving the supplied terminal failure when its mailbox record is absent.
- I1 completion event acknowledgement can remove the result before command response construction. Fix by capturing the terminal response before emission.
- E1 retained failures discard safe HTTP and engine failure information and report an engine-list save problem. Fix by sharing normal IPC safe payload construction with retained errors.
- T1 real running engine reload and completion-event proof is absent. Fix with actual WebKitGTK and signed native work using the existing driver, plus behavior assertions that fail when the production completion path is removed. Mocked browser evidence is not native proof.
- T2 fresh handles and catalog_protected make the retention assertion non-discriminating. Fix with otherwise collectible native resources and production-guard reversal proof.
- T3 the subscription-gap test emits only after initialization. Fix by completing during subscription setup and proving ordering reversal fails.
- M1 pending termination observation is duplicated. Extract the shared observation while preserving capture and retry policy.
- M2 optional archive progress retains behavior with no production caller. Require the production workflow lease and adapt native tests.
- Q1 name the retained configuration budget.
- Q2 name the renderer receipt bound and document its native relationship.
- Q3 remove the newly introduced unexplained helper suppressions through concrete domain inputs, preserving ownership visibility.
- L1 close already-repaired f-20261022-08. Root reran both witnesses successfully and closed it through the ledger writer in e5ec74f7.
- L2 supersede the removed-profile and outstanding-rerun assumption in f-20261022-07. Annotated in c7f9534e while retaining the intermittent failure and open status.
- L3 add explicit Proof commands for both merged entries. The f-20261022-07 unchanged failure/replay pair is not presented as a source-fix regression.

Native, renderer and engine-process source repairs have disjoint owners. A separate worker prepares scratch real-app choreography only. Root performs the actual browser verification. The three source packages run focused proofs, then root regenerates bindings and runs one integrated pre-review check before closure review. Root never commits another worker's unrelated files.


## Inherited plan refresh round 3: lens-chess-semantics-r3

```text
NOT APPLICABLE: The plan and overlapping drift concern download ownership and recovery, with no in-memory chess tree, position identity, move path, or rule changes.

Inspected `src-tauri/src/fs.rs` changes in `archive_staging_authority_four_stalled_streams_leave_gateway_available` and `production_download_core_matrix_keeps_success_and_error_tails_after_caller_drop`. The timeout and `OperationRegistry::wait_for_drain` changes do not affect chess semantics. O1–O4 and phase proofs: no obligation invalidated within this lens.

VERDICT: APPROVED
```

## Inherited plan refresh round 3: lens-correctness-r3

```text
No correctness findings.

Inspected `src-tauri/src/fs.rs`:
- `archive_staging_authority_four_stalled_streams_leave_gateway_available` preserves correct-byte completion before stream release.
- `production_download_core_matrix_keeps_success_and_error_tails_after_caller_drop` uses `OperationRegistry::wait_for_drain`, which observes lease release after workflow cleanup. Success/failure and disk assertions remain intact.

No obligation invalidated. O1’s drain contract and O4’s receiver-drop proof remain consistent. O2/O3 production paths are unchanged.

Limitation: static review only, no tests executed. Confidence: 95. No files changed.

VERDICT: APPROVED
```

## Inherited plan refresh round 3: lens-engine-protocol-r3

```text
NOT APPLICABLE: Compared O1–O4 and the planned files with the drift. Inspected `src-tauri/src/fs.rs` symbols `archive_staging_authority_four_stalled_streams_leave_gateway_available` and `production_download_core_matrix_keeps_success_and_error_tails_after_caller_drop`. Their test synchronization changes affect no engine process, UCI ordering or asynchronous engine-result routing. No obligation invalidated, including O1’s accepted-tail ownership and O4’s receiver-drop proof. O2 and O3 production paths are unchanged.

VERDICT: APPROVED
```

## Inherited plan refresh round 3: lens-error-handling-r3

```text
No error-handling defects found.

Inspected changes in `src-tauri/src/fs.rs`:

- `archive_staging_authority_four_stalled_streams_leave_gateway_available` still rejects timeout, gateway errors and incorrect bytes before stream release. Cleanup precedes assertion.
- `production_download_core_matrix_keeps_success_and_error_tails_after_caller_drop` propagates worker/registry errors, rejects drain timeout and retains terminal-state and disk assertions.

Traced `OperationRegistry::wait_for_drain` and native completion ownership. No obligation invalidated. O1 and O4 remain valid, and O2/O3 production paths are unchanged.

Read-only review. No tests run or files changed.

VERDICT: APPROVED
```

## Inherited plan refresh round 3: lens-ipc-contract-r3

```text
NOT APPLICABLE: The plan-overlapping drift changes only test synchronization in `src-tauri/src/fs.rs`: the gateway `probe` timeout and caller-drop test’s `OperationRegistry::wait_for_drain` call. Neither changes an IPC event, payload, command, listener lifetime or capability.

No obligation invalidated: O1’s accepted-tail ownership and O4’s receiver-drop proof remain intact. O2 and O3 production paths are unchanged.

VERDICT: APPROVED
```

## Inherited plan refresh round 3: lens-minimalism-r3

```text
No bloat or duplication findings.

Inspected `src-tauri/src/fs.rs` changes to `archive_staging_authority_four_stalled_streams_leave_gateway_available` and `production_download_core_matrix_keeps_success_and_error_tails_after_caller_drop`, plus existing `OperationRegistry::wait_for_drain` in `src-tauri/src/infra/operations.rs`. The drift reuses native drain notification without adding files or abstractions. Ordering, terminal-state and disk assertions remain.

No obligation invalidated. O1’s accepted-tail drain and O4’s receiver-drop proof remain required. O2, O3 and phase proofs are unaffected.

Read-only review. No tests run or files changed. Review and code authorship share the OpenAI model family.

VERDICT: APPROVED
```

## Inherited plan refresh round 3: lens-persisted-state-r3

```text
NOT APPLICABLE: Plan-overlapping drift in `src-tauri/src/fs.rs` changes only test calls to `BLOCKING_GATEWAY.spawn` and `OperationRegistry::wait_for_drain`. No renderer storage encoding, keys, hydration, atom families or tab lifecycle changed. O1–O4 and phase proofs: no obligation invalidated within this lens.

VERDICT: APPROVED
```

## Inherited plan refresh round 3: lens-pgn-index-r3

```text
NOT APPLICABLE: The plan includes account PGN imports, but this drift changes only test synchronization within the overlapping scope.

Inspected `src-tauri/src/fs.rs` symbols `archive_staging_authority_four_stalled_streams_leave_gateway_available` and `production_download_core_matrix_keeps_success_and_error_tails_after_caller_drop`. Neither changes PGN scanning, indexing, encoding, storage or search. No obligation invalidated, including O1’s accepted-tail drain and O4’s receiver-drop proof. O2 and O3 remain unchanged.

VERDICT: APPROVED
```

## Inherited plan refresh round 3: lens-plan-r3

```text
No findings. No obligation invalidated.

Inspected both changed symbols in `src-tauri/src/fs.rs`:

- `archive_staging_authority_four_stalled_streams_leave_gateway_available` at line 6045 retains the correct-byte assertion before stream release at line 6104.
- `production_download_core_matrix_keeps_success_and_error_tails_after_caller_drop` at line 9296 retains caller abort, both terminal outcomes and disk assertions at line 9372. Its new wait uses `OperationRegistry::wait_for_drain` at `src-tauri/src/infra/operations.rs:774`. Lease release still follows workflow completion at line 979.

O1’s ownership premise, O4’s receiver-drop proof and phase proofs remain valid. O2/O3 production paths are unchanged. No changed premise reopens I1 or I2. Confidence: 97.

Limitation: source review only, no runtime tests or fault staging performed. No files changed. Review used the same OpenAI model family as the recorded plan reviews.

VERDICT: APPROVED
```

## Inherited plan refresh round 3: lens-platform-semantics-r3

```text
No platform-semantics findings. No obligation invalidated.

Inspected the changed symbols in `src-tauri/src/fs.rs`:

- `archive_staging_authority_four_stalled_streams_leave_gateway_available:6091` retains correct-byte completion before stream release.
- `production_download_core_matrix_keeps_success_and_error_tails_after_caller_drop:9361` uses `OperationRegistry::wait_for_drain` on a blocking worker. Its mutex/condition-variable synchronization has no platform-specific branches, and terminal-state and disk assertions remain.

O1’s accepted-tail ownership and O4’s receiver-drop proof remain valid. O2 and O3 are unaffected. No phase proof is invalidated.

Read-only review. No tests, `pnpm rust:windows:check`, or non-Linux Unix source probe ran here. Windows/macOS runtime proof remains required from `rust-windows-test` and `rust-macos-test`, with compilation and linting covered by the `rust-platform` matrix. Approval concerns the plan refresh, not completed runtime verification.

VERDICT: APPROVED
```

## Inherited plan refresh round 3: lens-tauri-security-r3

```text
NOT APPLICABLE: Plan-overlapping drift changes only test synchronization in `src-tauri/src/fs.rs`, in `archive_staging_authority_four_stalled_streams_leave_gateway_available` and `production_download_core_matrix_keeps_success_and_error_tails_after_caller_drop`. No credential, filesystem-authority, artifact-verification or renderer-data boundary changes.

O1’s drain obligation and O4’s receiver-drop proof remain intact. O2 and O3 production paths are unchanged. Within this lens, no obligation invalidated.

VERDICT: APPROVED
```

## Inherited plan refresh round 3: lens-tests-r3

```text
Inspected `src-tauri/src/fs.rs` symbols `archive_staging_authority_four_stalled_streams_leave_gateway_available` and `production_download_core_matrix_keeps_success_and_error_tails_after_caller_drop`, plus `OperationRegistry::wait_for_drain`.

No obligation invalidated. O1/O4 retain concrete failure assertions: correct probe bytes must arrive before stream release, and caller-drop completion must produce the expected terminal state and disk outcome. Removing native ownership would fail those terminal assertions even if drain returned successfully. Both tests remain reachable through the unfiltered native gate. O2/O3 are unaffected.

Read-only inspection only. No tests rerun or files changed.

VERDICT: APPROVED
```

## Recovery cumulative diff round 1: lens-chess-semantics-r1

```text
NOT APPLICABLE: The cumulative diff changes engine installation, upgrade completion, owner persistence and process retirement. It changes no in-memory chess tree, position identity, move path, parity, variation selection or tree metadata handling.

VERDICT: APPROVED
```

## Recovery cumulative diff round 1: lens-code-quality-r1

```text
[blocker] src-tauri/src/fs.rs:1824 — The new `256 * 1024` configuration limit controls whether installation succeeds but has no named constant. Neighboring limits use names such as `MAX_ARCHIVE_PATH_BYTES`. Name this retained-configuration budget so its purpose is visible without tracing the workflow. (confidence: 99)

[blocker] src/state/engineOwnerStorage.ts:28 — The bare `128` controls receipt validation and persistence refusal. Its relationship to native `MAX_ACCEPTED_OPERATIONS` in `src-tauri/src/infra/operations.rs:25` is undocumented. Give the renderer limit a name and explain that relationship. (confidence: 98)

[blocker] src-tauri/src/fs.rs:1744 — The new workflow core suppresses `clippy::too_many_arguments` without documenting a library-boundary reason. Another unexplained suppression appears at `src-tauri/src/infra/operations.rs:766`. These are internal helpers whose argument structure remains under project control. (confidence: 99)

Review was read-only. Detection and implementation share the OpenAI model family, with no family separation.

VERDICT: REVISE
```

## Recovery cumulative diff round 1: lens-correctness-r1

```text
[blocker] src/state/engineCompletions.ts:88 — A successfully cancelled transfer produces a retained failure with category `"cancellation"`, but this branch replaces its message with `Engines.SaveError`. Both `errorUnlessCancelled` and `cancelDownloadJob` recognize cancellation by the exact message `"Cancellation"`. Consequently, a successful Cancel is reported as a save failure and the cancellation promise rejects instead of returning its cancellation outcome. Preserve the existing cancellation contract when reconstructing retained failures. (confidence: 99)

[blocker] src/state/engineCompletions.ts:74 — An absent native record is treated as successful application even when the supplied completion failed. For example, the completion event can process and acknowledge a network failure before the original install command’s already-captured response reaches its caller. When that caller subsequently invokes `applyEngineCompletion`, this branch resolves successfully. `AddEngine` then sets `installedThisSession` despite no engine being registered. Acknowledged failure must retain its failure result for concurrent callers. (confidence: 91)

Limitation: source-only review. Native scheduling and browser behavior were not executed, so runtime confirmation of the second interleaving remains outstanding. Review and implementation share the OpenAI model family.

VERDICT: REVISE
```

## Recovery cumulative diff round 1: lens-engine-protocol-r1

```text
No in-scope defects found in retirement replay, process ownership, UCI sequencing or result routing.

Read-only source review. No files changed or runtime checks run. Reviewer and implementation share the OpenAI model family, with no family separation.

VERDICT: APPROVED
```

## Recovery cumulative diff round 1: lens-error-handling-r1

```text
[should-fix] src/state/engineCompletions.ts:88 — Every retained native failure without a root label becomes “The engine list could not be saved.” A network failure or UCI timeout therefore reports a storage problem before any owner write occurs. `CompletionFailure` also drops the existing safe HTTP rejection details and engine failure snapshot, preventing the notification surface from presenting their guidance. Preserve the safe typed failure payload through completion retention and replay (confidence: 99).

Limitations: Read-only source review, no runtime probes or gates executed. Author and reviewer share the OpenAI model family, and plan authorship and arbitration share the root context.

VERDICT: APPROVED
```

## Recovery cumulative diff round 1: lens-ipc-contract-r1

```text
[should-fix] src-tauri/src/fs.rs:1679 — Rust emits `CompletionChanged` before constructing the install command response. The renderer listener in `src/state/engineCompletions.ts:208` can apply and acknowledge that completion, removing the record this lookup needs. If acknowledgement wins, `installEngineWorkflow` rejects with “completion is unavailable” after installation succeeded, so Add/Upgrade displays a false failure. Return a captured terminal snapshot instead of rereading the removable mailbox entry. (confidence: 92)

Review was read-only and used the implementation’s model family. No gates were run.

VERDICT: APPROVED
```

## Recovery cumulative diff round 1: lens-minimalism-r1

```text
[should-fix] src-tauri/src/engine/process.rs:2886 — `resume_binary_retirement` adds a second copy of the pending-termination observation in `drain_matching` at line 3032. Both await `PendingTermination`, attach the same actor key/generation and collect `ActorShutdownFailure`. Extract that observation into one shared unit while retaining the distinct capture, retry and drain policies. This removes roughly 10–15 duplicated lines without changing retirement semantics. (confidence: 95)

[should-fix] src-tauri/src/fs.rs:1497 — The optional progress contract has no production caller exercising `None`. The sole production caller supplies `Some(progress)`, while the new 30-line test wrapper preserves the removed archive command’s standalone progress behavior. Require a progress lease, remove the fallback and standalone-success branches, and adapt archive tests to the current workflow contract. Approximately 45–55 lines of compatibility scaffolding are removable. (confidence: 91)

Added-file minimum-diff counterfactuals:

- `infra/completions.rs`: retain the concrete request, result and retained application types.
- `infra/reload_completion_tests.rs`: retain the mailbox, receiver-loss and retirement boundary tests.
- `state/catalogEngineCompletion.ts`: retain the shared Add/Upgrade adapter and pending-state hook.
- `state/engineCompletions.ts`: retain the single replay/application coordinator.
- `state/engineCompletions.test.ts`: retain the owner-boundary and replacement-document cases.
- `utils/engineInstall.ts`: retain the native request construction used by the catalog adapter.

No additional substantive deletion is established for those six files. Findings concern implementation commit `111d212d`. Review was read-only, with no gates run or files changed. Detection shares the implementation’s model family.

VERDICT: REVISE
```

## Recovery cumulative diff round 1: lens-persisted-state-r1

```text
No in-scope defects found. Traced envelope encoding, legacy hydration, receipt retention/pruning and replay guards across all three owner keys.

Read-only source review. No files changed or gates run. Reviewer and implementation share the same model family.

VERDICT: APPROVED
```

## Recovery cumulative diff round 1: lens-platform-semantics-r1

```text
No concrete platform-semantics defects found in `c4da644f..111d212d`. Reviewed native completion ownership, registration, retirement, connected platform branches and test helpers. No files changed or gates run.

Evidence limits:

- Supplied logs show `pnpm rust:windows:check` passed. This proves compilation and linting only.
- No non-Linux Unix source-probe result was supplied.
- Runtime proof remains with CI’s `rust-windows-test` and `rust-macos-test`. `rust-platform` covers target compilation.
- The actual install-to-UCI regression is Unix-only, so it provides no Windows workflow runtime coverage.

Review used the same model family as implementation and arbitration, without family separation.

VERDICT: APPROVED
```

## Recovery cumulative diff round 1: lens-records-r1

```text
[should-fix] tasks/findings.md:17975 — f-20261022-08 remains open although commit `31f9132a` repaired both test witnesses before this range. Existing entries at lines 14606 and 16351 record the repair and regression proof. Close this finding with that evidence and supersede its release-blocking claim. (confidence: 100)

[should-fix] tasks/findings.md:17969 — The next step assumes a retained profile and outstanding rerun. The harness deleted the profile, and canonical `gate-real-app-retry.AdWjYi` completed successfully. The handoff records all 145 real-app assertions passing unchanged. Preserve the timeout observation but update the investigation state. (confidence: 100)

[should-fix] tasks/findings.md:17963 — Both newly merged findings lack the `**Proof:**` command required by the supplied findings-ledger contract’s minimum body. Historical failure logs do not specify the required before/after verification command. (confidence: 99)

VERDICT: REVISE
```

## Recovery cumulative diff round 1: lens-root-cause-r1

```text
No root-cause or prior-fix regression findings.

The original failure was a native download surviving its renderer continuation. This diff retains native outcomes, commits owner values with atomic replay receipts, excludes overlapping upgrades by UUID, and retains original retirement generations. Both Add and Upgrade use that mechanism. History checks found no reintroduction of the durable-save publication or typed-retirement defects.

Examined fix-revert evidence shows three replacement-document cases failing with hydration recovery removed, then all four passing after restoration.

Named limitation (confidence: 100): actual WebKitGTK engine-workflow reload proof remains pending. The inspected native tests and mocked browser fixtures do not establish that complete product boundary.

Review shares the implementation’s model family. No files changed or gates run.

VERDICT: APPROVED
```

## Recovery cumulative diff round 1: lens-tauri-security-r1

```text
No in-scope security defects found in the cumulative range. Reviewed signed-download enforcement, extraction/publication containment, completion payloads and retirement errors.

Limitations: static review only. Credential/session persistence is unchanged, and no refresh flow was introduced. No files changed or gates run.

Detection shares the implementation’s OpenAI model family. Plan authorship and arbitration share the root context.

VERDICT: APPROVED
```

## Recovery cumulative diff round 1: lens-tests-r1

```text
[blocker] scripts/verify-app.mjs:5034 — The required real-app engine reload anchor is absent. This checks reservation cleanup and workspace tabs only. Browser recovery uses canned native completions, while native tests poll the mailbox. Breaking actual `CompletionChanged` delivery could strand a running install after reload while these assertions remain green. The handoff explicitly acknowledges this missing proof. (confidence: 100)

[should-fix] src-tauri/src/fs.rs:9900 — Archive existence does not prove completion-resource retention. This fixture creates fresh handles, which startup pruning already preserves, and publication sets `catalog_protected`, which independently prevents collection. Removing the new completion retention guards would leave this assertion green. Exercise otherwise collectible resources and assert their usability before acknowledgement and cleanup afterward. (confidence: 97)

[should-fix] src/state/engineCompletions.test.ts:346 — “Snapshots after subscribing” never exercises the subscription gap. Completion occurs only after initialization returns. Moving the initial snapshot before listener registration would still pass, despite potentially losing a completion between those steps. Inject completion during subscription setup and assert eventual application and acknowledgement. (confidence: 98)

Same-family review. Plan authorship and arbitration share the root context.

VERDICT: REVISE
```

