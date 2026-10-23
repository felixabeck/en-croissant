# Drain push recovery, 2026-10-23

## Delivery checkpoint after source closure

The engine source and verifier corrections passed their actual native/renderer proofs, real running-download controls, four real permission-result controls and the unchanged ordinary verifier. Source closure is approved through 135b9d65. R2 adopted three naming/comment corrections, and all six R3 lenses closed them without new findings after pre-review vhNjoK completed 0. The raw source reports and execution corrections below supersede the older runtime-pending and review-pending checkpoints. Final browser verification, full clean push gates, ordinary master push, required hosted native jobs and local installation remain pending. No final release receipt, remote publication or installation is claimed here. Overall f-20261005-05 remains open for the unstarted account phase. The repaired verifier finding f-20261023-02 is handled in bd822d6c after source closure and actual proof.

The first remote CI preflight could not read a job conclusion because gh run view timed out. Its second invocation completed 0 and reported all newest completed Test jobs succeeded on master. A fresh check remains required before push. The overlapping resumed Grok controller is stopped, and this Codex root retains its original build lock and sole release ownership. Plan authorship and arbitration shared one context. Detection ran on the same model family as the code.

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

## Verified public-workflow permission controls

The corrected verifier passed actual ordinary permission-positive.Rco7vI at exit 0 after both real permission-fault children. This closes the observed runtime gap for the current public workflow. Four semantic assertions have actual bad-input failure receipts, with all modes restored between faults. Setup, identity/malformed-response, release, acknowledgement, notification and cleanup diagnostic branches were not separately staged. No complete defensive-guard matrix is claimed. Private registration and child-denial coverage remains the existing and added native tests, seven passed under Linux UID 1000. Overall f-20261005-05 remains open for account Phase 2. Final review, browser stage, full gates, push, hosted confirmation and installation are still required at this checkpoint.

The first baseline pZ3bJY failed only because root specified a generic message. The existing native Display correctly returned Invalid input: invalid artifact SHA-256. The precise expectation was corrected without relaxing tag, category, identity, failed-state or root-label guards. That failed baseline remains red evidence. The subsequent runtime cases used the corrected working verifier before its comment-only receipt update. The update preserved every byte from imports to EOF, so it changes no assertion, helper, fixture or execution.

The following source snapshots are data, not installed tools or executable workflow instructions. JSON strings preserve their exact bytes, including any whitespace. Original preparatory comments remain historical. The first EP negative was non-isolated due the independent old command-not-found RF0. Current EP assertions and codec are unchanged, and all six EP checks passed in both new permission negatives and the ordinary positive.

### Shared disposable EP and permission staging source

````json
{
  "file": "stage-ep-storage.mjs",
  "sha256": "0c24389a319dd2b3cf1cd8e15d29166d3d29af7dc5366e426170bfa77434831d",
  "source": "// RF modes are prepared only. Importing this file does not launch anything.\n// Parent exit 0 means a trusted negative receipt, never a product-green result.\nimport { spawn } from 'node:child_process'\nimport { createWriteStream, constants, openSync, closeSync, lstatSync, fstatSync, fchmodSync, realpathSync } from 'node:fs'\nimport { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'\nimport { createHash, randomUUID } from 'node:crypto'\nimport { join, resolve } from 'node:path'\nimport { fileURLToPath, pathToFileURL } from 'node:url'\nimport { serializeStorageValue, deserializeStorageValue } from '/home/felixb/Projekte/chessfable.worktrees/drain/src/state/store/debouncedStorage.ts'\nimport { decodeEngineOwnerValue } from '/home/felixb/Projekte/chessfable.worktrees/drain/src/state/engineOwnerEnvelope.ts'\nimport { Session } from '/home/felixb/Projekte/chessfable.worktrees/drain/scripts/app-driver.mjs'\n\nconst ROOT = '/home/felixb/Projekte/chessfable.worktrees/drain'\nconst OUTPUT = '/tmp/chessfable-drain-recovery-20261023/native-proof'\nconst VERIFY = join(ROOT, 'scripts/verify-app.mjs')\nconst SOURCES = [VERIFY, join(ROOT, 'src/state/store/debouncedStorage.ts'), join(ROOT, 'src/state/engineOwnerEnvelope.ts'),\n  join(ROOT, 'scripts/app-driver.mjs'), join(ROOT, 'src-tauri/src/fs.rs'), join(ROOT, 'src-tauri/target/release/chessfable'), fileURLToPath(import.meta.url)]\nconst EXPECTED = 'Fixture saved publication'\nconst WRONG = 'Scratch EP storage staging altered publication'\nconst MARKERS = [\n  'FAIL  EP1-storage successful Name edit persists the decoded engine name',\n  'FAIL  EP2-storage refused Name edit retains the decoded saved engine name',\n]\nconst INTACT = [\n  '  ok  EP1-card successful Name edit publishes the saved engine card',\n  '  ok  EP2-error refused engines storage write reports the save error',\n  '  ok  EP2-card refused Name edit retains the saved engine card',\n  '  ok  EP2-input refused Name draft settles to the saved name',\n]\nconst RF = {\n  RF0: 'RF0 selected puzzle and engine roots accept real IPC before access loss',\n  RF1: 'RF1 puzzle read denial preserves Permission and I/O failure with a permission root label',\n  RF2: 'RF2 engine destination read denial preserves Permission and I/O failure with a permission root label',\n  RF3: 'RF3 public engine workflow root search denial preserves Permission and I/O failure with a permission root label',\n  RF5: 'RF5 puzzle permission guidance is visible through the actual renderer',\n  RF6: 'RF6 Add permission guidance is visible through the actual renderer',\n  RF7: 'RF7 permission failures retain saved engines and unrelated filesystem bytes',\n  RF8: 'RF8 restoring access recovers the same selected roots',\n}\nconst PLANS = {\n  rf0: [{ stage: 'RF0', from: 0o700, fault: 0o300 }],\n  'rf-matrix': [{ stage: 'RF2', from: 0o300, fault: 0o700 },\n    { stage: 'RF3', from: 0o400, fault: 0o700 }, { stage: 'RF8', from: 0o700, fault: 0o300 }],\n}\nconst delay = ms => new Promise(resolveDelay => setTimeout(resolveDelay, ms))\nconst sha = text => createHash('sha256').update(text).digest('hex')\n\nasync function bounded(promise, ms, label) {\n  let timer\n  try {\n    return await Promise.race([promise, new Promise((_, reject) => {\n      timer = setTimeout(() => reject(new Error(label)), ms)\n    })])\n  } finally { clearTimeout(timer) }\n}\n\n// Only debugger addressing, not a product source checker. Refuse ambiguous/missing addresses.\nfunction addresses(source, mode) {\n  const first = '  async function enginePublicationSnapshot() {\\n    return session.execute('\n  const second = '  } finally {\\n    await session.execute(\\n      \"window.__verifyRestoreEngineStorage(); delete window.__verifyRestoreEngineStorage; return true;\",\\n    );\\n  }'\n  const locate = text => {\n    const index = source.indexOf(text)\n    if (index < 0 || source.indexOf(text, index + 1) >= 0) throw new Error('breakpoint-address-unavailable')\n    return index\n  }\n  const line = index => source.slice(0, index).split('\\n').length\n  if (mode !== 'ep') {\n    const entry = locate('async function verifySelectedRootPermissions(session, puzzleRoot, engineRoot) {\\n  const puzzle =')\n    const workflow = locate('  const workflowProbe = async (stage, catalog) => {\\n    const ticket =')\n    const response = locate('    const error = workflowFailure(response);\\n    if (error)')\n    return { entry: line(entry) + 1, before: line(workflow) + 1, response: line(response) }\n  }\n  const firstIndex = locate(first)\n  const secondIndex = locate(second)\n  return {\n    snapshot: line(firstIndex + first.indexOf('    return')),\n    restore: line(secondIndex + second.indexOf('    await')),\n    finallyEnd: line(secondIndex + second.lastIndexOf('  }')),\n  }\n}\n\n// A single owned Node-inspector connection. Never attach to a configured or discovered service.\nclass Inspector {\n  constructor(socket) {\n    this.socket = socket\n    this.sequence = 0\n    this.requests = new Map()\n    this.pauses = []\n    this.waiter = undefined\n    socket.addEventListener('message', event => {\n      let message\n      try { message = JSON.parse(String(event.data)) } catch { socket.close(); return }\n      if (message.id) {\n        const request = this.requests.get(message.id)\n        this.requests.delete(message.id)\n        if (message.error) request?.reject(new Error('inspector-command-failed'))\n        else request?.resolve(message.result)\n      } else if (message.method === 'Debugger.paused') {\n        if (this.waiter) { const waiter = this.waiter; this.waiter = undefined; waiter.resolve(message.params) }\n        else this.pauses.push(message.params)\n      }\n    })\n    socket.addEventListener('close', () => {\n      for (const request of this.requests.values()) request.reject(new Error('inspector-disconnected'))\n      this.requests.clear()\n      this.waiter?.reject(new Error('inspector-disconnected'))\n      this.waiter = undefined\n    })\n  }\n  async call(method, params = {}) {\n    if (this.socket.readyState !== WebSocket.OPEN) throw new Error('inspector-not-open')\n    const id = ++this.sequence\n    try {\n      return await bounded(new Promise((resolveCall, reject) => {\n        this.requests.set(id, { resolve: resolveCall, reject })\n        this.socket.send(JSON.stringify({ id, method, params }))\n      }), 10_000, 'inspector-command-timeout')\n    } finally { this.requests.delete(id) }\n  }\n  async paused(ms) {\n    if (this.pauses.length) return this.pauses.shift()\n    try {\n      return await bounded(new Promise((resolvePause, reject) => { this.waiter = { resolve: resolvePause, reject } }), ms, 'debugger-stop-unavailable')\n    } finally { this.waiter = undefined }\n  }\n}\n\n// Constructor wraps the exact owned session. Never open or quit another native session.\nfunction sessionFor(base) {\n  const owned = new URL(base)\n  if (owned.origin !== 'http://127.0.0.1:4444' || !/^\\/session\\/[A-Za-z0-9%._-]+$/.test(owned.pathname) ||\n    owned.search || owned.hash || owned.username || owned.password) throw new Error('owned-session-refused')\n  const session = new Session(decodeURIComponent(owned.pathname.slice('/session/'.length)))\n  if (session.base !== base) throw new Error('owned-session-refused')\n  return session\n}\nasync function execute(base, script, args = []) {\n  return sessionFor(base).execute(script, args)\n}\nasync function readString(inspector, frame, expression) {\n  if (!['session.base', 'engineRoot', 'stage'].includes(expression)) throw new Error('frame-read-refused')\n  const evaluated = await inspector.call('Debugger.evaluateOnCallFrame', {\n    callFrameId: frame.callFrameId, expression, returnByValue: true, silent: true,\n  })\n  if (evaluated.exceptionDetails || evaluated.result?.type !== 'string') throw new Error('owned-frame-value-unavailable')\n  return evaluated.result.value\n}\n\nconst modeText = mode => mode.toString(8).padStart(4, '0')\nfunction openPermissionRoot(state, root) {\n  const match = /^\\/tmp\\/(chessfable-verify-[A-Za-z0-9]+)\\/path-owner-fixture\\/permission-engines$/.exec(root)\n  if (!match || typeof process.getuid !== 'function' || process.getuid() === 0 || realpathSync(root) !== root) throw new Error('permission-root-unavailable')\n  for (const path of [join('/tmp', match[1]), join('/tmp', match[1], 'path-owner-fixture'), root]) {\n    const stat = lstatSync(path)\n    if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== process.getuid()) throw new Error('permission-root-unavailable')\n  }\n  state.fd = openSync(root, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW)\n  state.root = root\n  const stat = fstatSync(state.fd), pathStat = lstatSync(root)\n  if (stat.dev !== pathStat.dev || stat.ino !== pathStat.ino || (stat.mode & 0o7777) !== 0o700) throw new Error('permission-root-unavailable')\n  state.dev = stat.dev\n  state.ino = stat.ino\n  state.originalMode = modeText(stat.mode & 0o7777)\n}\nfunction recordMode(state, event) {\n  state.transitions.push(event)\n  console.log(`MODE ${JSON.stringify(event)}`)\n}\nfunction restoreMode(state, point) {\n  if (!state.pending) return\n  const pending = state.pending\n  fchmodSync(state.fd, pending.original)\n  const actual = fstatSync(state.fd).mode & 0o7777\n  if (actual !== pending.original) throw new Error('permission-restoration-failed')\n  recordMode(state, { stage: pending.stage, point, restored: modeText(actual) })\n  state.pending = undefined\n  if (point === 'after-native-response') state.completed.push(pending.stage)\n}\nfunction changeMode(state, fault) {\n  if (state.pending || state.completed.includes(fault.stage)) throw new Error('permission-stage-order-unavailable')\n  const stat = fstatSync(state.fd), pathStat = lstatSync(state.root)\n  if (pathStat.isSymbolicLink() || !pathStat.isDirectory() || pathStat.dev !== state.dev || pathStat.ino !== state.ino ||\n    stat.dev !== state.dev || stat.ino !== state.ino || (stat.mode & 0o7777) !== fault.from) throw new Error('permission-mode-boundary-unavailable')\n  state.pending = { stage: fault.stage, original: stat.mode & 0o7777 }\n  fchmodSync(state.fd, fault.fault)\n  if ((fstatSync(state.fd).mode & 0o7777) !== fault.fault) throw new Error('permission-change-failed')\n  recordMode(state, { stage: fault.stage, point: 'before-native-call', original: modeText(state.pending.original), fault: modeText(fault.fault) })\n}\n\nconst restoreScript = `\n  const state = window[arguments[0]];\n  if (!state) return { restored: false };\n  state.active = false;\n  Object.defineProperty(Storage.prototype, 'setItem', state.descriptor);\n  state.descriptor.value.call(localStorage, 'engines', state.raw);\n  const actual = Object.getOwnPropertyDescriptor(Storage.prototype, 'setItem');\n  const restored = localStorage.getItem('engines') === state.raw &&\n    ['value', 'get', 'set', 'writable', 'enumerable', 'configurable'].every(key =>\n      actual[key] === state.descriptor[key]);\n  if (arguments[1] && restored) delete window[arguments[0]];\n  return { restored };\n`\n\nexport async function run(mode = 'ep') {\n  if (!['ep', 'rf0', 'rf-matrix'].includes(mode)) throw new Error('unsupported staging mode')\n  const wanted = mode === 'ep' ? MARKERS : PLANS[mode].map(fault => `FAIL  ${RF[fault.stage]}`)\n  const required = mode === 'ep' ? INTACT : [...INTACT, ...MARKERS.map(marker => marker.replace('FAIL  ', '  ok  ')),\n    ...(mode === 'rf-matrix' ? ['RF0', 'RF1', 'RF5', 'RF6', 'RF7'].map(key => `  ok  ${RF[key]}`) : [])]\n  await mkdir(OUTPUT, { recursive: true })\n  const directory = await mkdtemp(join(OUTPUT, mode === 'ep' ? 'ep-storage-' : `${mode}-`))\n  console.log(`${mode} staging artifacts: ${directory}`)\n  let child, inspector, socket, base, stdout, stderr\n  let childDone, sourceBefore, stops\n  let childFinished = false\n  let interrupted = false\n  let injected = false\n  let restoredBeforeFinally = false\n  let restoredAfterFinally = false\n  let choreographyComplete = false\n  let childReleased = false\n  let stage = 'prepare'\n  let unavailable\n  let runtimeFailureStage\n  const observedLines = {}\n  const permission = { fd: undefined, pending: undefined, transitions: [], completed: [], restorationFailure: false }\n  const token = `__epStorageStage_${randomUUID().replaceAll('-', '')}`\n  const hashes = async () => Object.fromEntries(await Promise.all(SOURCES.map(async path => [path, sha(await readFile(path))])))\n  const signal = () => {\n    interrupted = true\n    try { restoreMode(permission, 'signal-finally') } catch { permission.restorationFailure = true }\n    if (socket?.readyState === WebSocket.OPEN) socket.close()\n    // Only the exact child handle owned by this invocation. Its handler owns app cleanup.\n    if (child && !childFinished) child.kill('SIGTERM')\n  }\n  for (const name of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(name, signal)\n  try {\n    if (typeof WebSocket !== 'function') throw new Error('node24-websocket-required')\n    const source = await readFile(VERIFY, 'utf8')\n    stops = addresses(source, mode)\n    sourceBefore = await hashes()\n    await writeFile(join(directory, 'preparation.json'), JSON.stringify({ mode, sources: sourceBefore, requestedLines: stops }, null, 2) + '\\n', { mode: 0o600 })\n    stdout = createWriteStream(join(directory, 'stdout.log'), { mode: 0o600 })\n    stderr = createWriteStream(join(directory, 'stderr.log'), { mode: 0o600 })\n    stdout.on('error', signal)\n    stderr.on('error', signal)\n    stage = 'launch-owned-verifier'\n    let endpointResolve, endpointReject\n    const endpoint = new Promise((resolveEndpoint, reject) => { endpointResolve = resolveEndpoint; endpointReject = reject })\n    child = spawn(process.execPath, ['--inspect-brk=127.0.0.1:0', VERIFY], {\n      cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'],\n    })\n    child.stdout.pipe(stdout)\n    child.stderr.pipe(stderr)\n    let inspectorPreamble = ''\n    child.stderr.on('data', chunk => {\n      if (String(chunk).includes('Waiting for the debugger to disconnect')) socket?.close()\n      if (inspectorPreamble.length >= 16_384) return\n      inspectorPreamble += String(chunk)\n      const match = inspectorPreamble.match(/Debugger listening on (ws:\\/\\/127\\.0\\.0\\.1:\\d+\\/[a-f0-9-]+)/)\n      if (match) endpointResolve(match[1])\n    })\n    child.once('error', () => endpointReject(new Error('owned-verifier-spawn-failed')))\n    childDone = new Promise(resolveExit => child.once('close', (code, signalName) => {\n      childFinished = true\n      endpointReject(new Error('owned-verifier-exited'))\n      resolveExit({ code, signal: signalName })\n    }))\n    stage = 'attach-owned-inspector'\n    const endpointURL = new URL(await bounded(endpoint, 15_000, 'inspector-endpoint-unavailable'))\n    if (endpointURL.hostname !== '127.0.0.1' || endpointURL.protocol !== 'ws:' ||\n      endpointURL.username || endpointURL.password || endpointURL.search || endpointURL.hash) throw new Error('unowned-inspector-refused')\n    socket = new WebSocket(endpointURL)\n    await bounded(new Promise((resolveOpen, reject) => {\n      socket.addEventListener('open', resolveOpen, { once: true })\n      socket.addEventListener('error', () => reject(new Error('owned-inspector-connect-failed')), { once: true })\n    }), 10_000, 'inspector-connect-timeout')\n    inspector = new Inspector(socket)\n    await inspector.call('Debugger.enable')\n    const breakpoint = async line => (await inspector.call('Debugger.setBreakpointByUrl', {\n      url: pathToFileURL(VERIFY).href, lineNumber: line - 1,\n    })).breakpointId\n    const first = await breakpoint(mode === 'ep' ? stops.snapshot : stops.entry)\n    const second = mode === 'ep' ? await breakpoint(stops.restore) : undefined\n    const workflowBefore = mode !== 'ep' ? await breakpoint(stops.before) : undefined\n    const workflowAfter = mode !== 'ep' ? await breakpoint(stops.response) : undefined\n    await inspector.call('Runtime.runIfWaitingForDebugger')\n    childReleased = true\n    stage = mode === 'ep' ? 'first-publication-stop' : 'permission-root-entry'\n    let paused = await inspector.paused(20 * 60_000)\n    if (!paused.hitBreakpoints?.includes(first)) {\n      // The single initial --inspect-brk stop, before the verifier starts its own harness.\n      await inspector.call('Debugger.resume')\n      paused = await inspector.paused(20 * 60_000)\n    }\n    const frame = paused.callFrames[0]\n    if (mode !== 'ep') {\n      if (!paused.hitBreakpoints?.includes(first) || frame.functionName !== 'verifySelectedRootPermissions') throw new Error('permission-entry-unavailable')\n      await inspector.call('Debugger.removeBreakpoint', { breakpointId: first })\n      observedLines.entry = frame.location.lineNumber + 1\n      // Only these two argument-frame strings. Never inspect a probe, ticket or descriptor.\n      const engineRoot = await readString(inspector, frame, 'engineRoot')\n      base = await readString(inspector, frame, 'session.base')\n      sessionFor(base)\n      openPermissionRoot(permission, engineRoot)\n      console.log(`ROOT owned=${permission.root} initialMode=${permission.originalMode}`)\n      observedLines.workflow = []\n      const calls = mode === 'rf0' ? ['RF0'] : ['RF0', 'RF2', 'RF3', 'RF8']\n      let callIndex = 0, inFlight\n      for (let stop = 0; stop < calls.length * 2; stop++) {\n        stage = 'permission-workflow-stop'\n        await inspector.call('Debugger.resume')\n        paused = await inspector.paused(90_000)\n        const actual = paused.callFrames[0]\n        if (actual.functionName !== 'workflowProbe') throw new Error('permission-workflow-unavailable')\n        // Read only the actual stage argument at either workflow stop.\n        const label = await readString(inspector, actual, 'stage')\n        if (!calls.includes(label)) throw new Error('permission-stage-order-unavailable')\n        const before = paused.hitBreakpoints?.includes(workflowBefore)\n        const after = paused.hitBreakpoints?.includes(workflowAfter)\n        if (!before && !after) throw new Error('permission-workflow-unavailable')\n        observedLines.workflow.push({ stage: label, point: before ? 'entry' : 'response', line: actual.location.lineNumber + 1 })\n        if (before) {\n          if (inFlight || label !== calls[callIndex]) throw new Error('permission-stage-order-unavailable')\n          inFlight = label\n          const fault = PLANS[mode].find(item => item.stage === label)\n          if (fault) { changeMode(permission, fault); injected = true }\n        } else {\n          // Restore before the real verifier classifies the result or starts any UI action.\n          restoreMode(permission, 'after-native-response')\n          if (label !== inFlight) throw new Error('permission-stage-order-unavailable')\n          inFlight = undefined\n          callIndex++\n        }\n      }\n      if (permission.pending || callIndex !== calls.length || permission.completed.length !== PLANS[mode].length) throw new Error('permission-staging-incomplete')\n      await inspector.call('Debugger.removeBreakpoint', { breakpointId: workflowBefore })\n      await inspector.call('Debugger.removeBreakpoint', { breakpointId: workflowAfter })\n      choreographyComplete = true\n      console.log(`STAGE ${mode} exact input modes restored after every native response`)\n    } else {\n    if (!paused.hitBreakpoints?.includes(first) || frame.functionName !== 'enginePublicationSnapshot') throw new Error('publication-stop-unavailable')\n    await inspector.call('Debugger.removeBreakpoint', { breakpointId: first })\n    observedLines.snapshot = frame.location.lineNumber + 1\n    base = await readString(inspector, frame, 'session.base')\n    sessionFor(base)\n    stage = 'valid-envelope-boundary'\n    const deadline = Date.now() + 10_000\n    let originalRaw, corruptRaw\n    while (Date.now() < deadline && !interrupted) {\n      const input = await execute(base, `\n        const label = [...document.querySelectorAll('label')].find(node => node.textContent === 'Name');\n        const card = document.querySelector('button[aria-pressed=\"true\"]');\n        return { raw: localStorage.getItem('engines'),\n          input: label && document.getElementById(label.htmlFor)?.value,\n          card: card?.querySelector('p')?.firstChild?.textContent.trim() };\n      `)\n      const decoded = input.raw && deserializeStorageValue(input.raw)\n      const owner = decoded && decodeEngineOwnerValue(decoded)\n      const retained = Array.isArray(owner?.value) && owner.value.filter(engine => engine.id === 'retained')\n      if (decoded?.version === 1 && owner && retained?.length === 1 && retained[0].name === EXPECTED &&\n        input.input === EXPECTED && input.card === EXPECTED) {\n        originalRaw = input.raw\n        corruptRaw = serializeStorageValue({ ...decoded,\n          value: owner.value.map(engine => engine.id === 'retained' ? { ...engine, name: WRONG } : engine),\n        })\n        const corrupted = decodeEngineOwnerValue(deserializeStorageValue(corruptRaw))\n        if (!corrupted || corrupted.value.find(engine => engine.id === 'retained')?.name !== WRONG) throw new Error('valid-corruption-unavailable')\n        const result = await execute(base, `\n          if (localStorage.getItem('engines') !== arguments[1]) return { changed: false };\n          const descriptor = Object.getOwnPropertyDescriptor(Storage.prototype, 'setItem');\n          if (!descriptor?.configurable || typeof descriptor.value !== 'function') return { changed: false };\n          const state = { raw: arguments[1], corrupted: arguments[2], descriptor, active: true };\n          window[arguments[0]] = state;\n          Object.defineProperty(Storage.prototype, 'setItem', { ...descriptor, value: function(key, value) {\n            return descriptor.value.call(this, key,\n              state.active && this === localStorage && key === 'engines' ? state.corrupted : value);\n          } });\n          descriptor.value.call(localStorage, 'engines', state.corrupted);\n          return { changed: localStorage.getItem('engines') === state.corrupted };\n        `, [token, originalRaw, corruptRaw])\n        if (result.changed) { injected = true; break }\n      }\n      await delay(100)\n    }\n    if (!injected) throw new Error('valid-envelope-boundary-unavailable')\n    await writeFile(join(directory, 'storage-hashes.json'), JSON.stringify({ original: sha(originalRaw), corrupted: sha(corruptRaw) }, null, 2) + '\\n', { mode: 0o600 })\n    console.log('STAGE valid envelope persisted with only retained engine name changed')\n    stage = 'post-EP2-storage-stop'\n    await inspector.call('Debugger.resume')\n    paused = await inspector.paused(90_000)\n    if (!paused.hitBreakpoints?.includes(second)) throw new Error('post-EP2-stop-unavailable')\n    observedLines.restore = paused.callFrames[0].location.lineNumber + 1\n    await inspector.call('Debugger.removeBreakpoint', { breakpointId: second })\n    restoredBeforeFinally = (await execute(base, restoreScript, [token, false])).restored\n    if (!restoredBeforeFinally) throw new Error('pre-finally-restoration-failed')\n    // EP2's unchanged finally captured our writer. Step over it with the fault inactive, then\n    // restore the descriptor again so its ordinary assignment cannot leave our writer installed.\n    const scriptId = paused.callFrames[0].location.scriptId\n    stage = 'unchanged-EP2-finally'\n    let pastFinally = false\n    for (let step = 0; step < 8; step++) {\n      await inspector.call('Debugger.stepOver')\n      paused = await inspector.paused(15_000)\n      if (paused.callFrames[0].location.scriptId === scriptId &&\n        paused.callFrames[0].location.lineNumber >= stops.finallyEnd) { pastFinally = true; break }\n    }\n    if (!pastFinally) throw new Error('finally-step-unavailable')\n    restoredAfterFinally = (await execute(base, restoreScript, [token, true])).restored\n    if (!restoredAfterFinally) throw new Error('post-finally-restoration-failed')\n    choreographyComplete = true\n    console.log('STAGE exact storage bytes and descriptor restored before and after unchanged EP2 cleanup')\n    }\n  } catch (error) {\n    const availability = ['breakpoint-address-unavailable', 'publication-stop-unavailable',\n      'owned-session-unavailable', 'valid-envelope-boundary-unavailable', 'valid-corruption-unavailable',\n      'post-EP2-stop-unavailable', 'finally-step-unavailable', 'debugger-stop-unavailable',\n      'owned-frame-value-unavailable', 'permission-root-unavailable', 'permission-entry-unavailable',\n      'permission-workflow-unavailable', 'permission-mode-boundary-unavailable', 'permission-stage-order-unavailable']\n    if (availability.includes(error?.message)) unavailable = stage\n    else runtimeFailureStage = stage\n    console.error(`${unavailable ? 'STAGING UNAVAILABLE' : 'RUNTIME FAIL'} ${stage}: no trusted semantic receipt from this attempt`)\n  } finally {\n    if (mode === 'ep' && !restoredAfterFinally && base && !childFinished) {\n      try { await execute(base, restoreScript, [token, true]) } catch { /* Disposable verifier still owns final cleanup. */ }\n    }\n    try {\n      restoreMode(permission, 'cleanup-finally')\n      if (permission.fd !== undefined) permission.finalMode = modeText(fstatSync(permission.fd).mode & 0o7777)\n    } catch {\n      permission.restorationFailure = true\n      runtimeFailureStage = 'permission-finally-restoration'\n      console.error('RUNTIME FAIL permission-finally-restoration: negative receipt untrusted')\n    } finally {\n      if (permission.fd !== undefined) {\n        try { closeSync(permission.fd); permission.closed = true } catch {\n          permission.restorationFailure = true\n          runtimeFailureStage = 'permission-descriptor-close'\n          console.error('RUNTIME FAIL permission-descriptor-close: negative receipt untrusted')\n        }\n        permission.fd = undefined\n      }\n    }\n    // No debugger may hold the verifier at exit or prevent its own finally/shutdown.\n    if (inspector) {\n      try { await inspector.call('Runtime.runIfWaitingForDebugger'); childReleased = true } catch { /* May already be detached. */ }\n      try { await inspector.call('Debugger.resume') } catch { /* Already running or disconnected. */ }\n      try { await inspector.call('Debugger.disable') } catch { /* Connection may have closed. */ }\n    }\n    if (socket && socket.readyState !== WebSocket.CLOSED) socket.close()\n    if (child && !childFinished && !childReleased) child.kill('SIGTERM')\n  }\n\n  let actual = { code: null, signal: null }\n  let deadlineFailure = false\n  if (childDone) {\n    try { actual = await bounded(childDone, 45 * 60_000, 'owned-verifier-exit-timeout') }\n    catch {\n      deadlineFailure = true\n      console.error('RUNTIME FAIL owned-verifier-exit: cleanup deadline exceeded, negative receipt untrusted')\n      if (!childFinished) child.kill('SIGTERM')\n      try { actual = await bounded(childDone, 30_000, 'owned-verifier-cleanup-timeout') } catch { /* Report unresolved, never SIGKILL. */ }\n    }\n  }\n  for (const name of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.removeListener(name, signal)\n  await writeFile(join(directory, 'child.actual-exit'), actual.signal ? `signal:${actual.signal}\\n` : `${actual.code ?? 'unresolved'}\\n`, { mode: 0o600 })\n  if (stdout) await bounded(new Promise(resolveFinish => stdout.closed ? resolveFinish() : stdout.once('close', resolveFinish)), 5000, 'stdout-close-timeout')\n  if (stderr) await bounded(new Promise(resolveFinish => stderr.closed ? resolveFinish() : stderr.once('close', resolveFinish)), 5000, 'stderr-close-timeout')\n  const output = stdout ? await readFile(join(directory, 'stdout.log'), 'utf8') : ''\n  const errors = stderr ? await readFile(join(directory, 'stderr.log'), 'utf8') : ''\n  const failed = output.split(/\\r?\\n/).filter(line => line.startsWith('FAIL  '))\n  const lines = output.split(/\\r?\\n/)\n  const uiAndRefusalPassed = INTACT.every(marker => lines.includes(marker))\n  const requiredPasses = Object.fromEntries(required.map(marker => [marker, lines.includes(marker)]))\n  const markers = Object.fromEntries(wanted.map(marker => [marker, failed.includes(marker)]))\n  const unrelatedFailures = failed.filter(line => !wanted.includes(line))\n  const unexecutedRFChecks = mode === 'rf0' ? Object.keys(RF).filter(key => key !== 'RF0') : []\n  const expectedEarlyReturn = mode !== 'rf0' || unexecutedRFChecks.every(key =>\n    !lines.some(line => line.startsWith(`FAIL  ${key} `) || line.startsWith(`  ok  ${key} `)))\n  const verifierRuntimeFailure = /verify:app (?:could not run|cleanup failed|[^\\n]*permission cleanup failed)/.test(errors)\n  let sourceUnchanged = false\n  let sourceAfter\n  try { sourceAfter = await hashes(); sourceUnchanged = JSON.stringify(sourceBefore) === JSON.stringify(sourceAfter) } catch { /* Receipt stays untrusted. */ }\n  const restored = mode === 'ep' ? restoredBeforeFinally && restoredAfterFinally :\n    permission.closed && !permission.pending && !permission.restorationFailure && permission.finalMode === permission.originalMode &&\n    permission.completed.length === PLANS[mode].length\n  const trustedNegative = choreographyComplete && restored && sourceUnchanged && expectedEarlyReturn &&\n    actual.code === 1 && !actual.signal && wanted.every(marker => markers[marker]) && Object.values(requiredPasses).every(Boolean) &&\n    (mode === 'ep' || !verifierRuntimeFailure) && !runtimeFailureStage && !unavailable && !interrupted && !deadlineFailure\n  const receipt = {\n    purpose: `Negative ${mode} staging`, mode, trustedNegative, isolated: trustedNegative && !unrelatedFailures.length && !verifierRuntimeFailure,\n    actual, requestedLines: stops, observedLines, sourcesUnchanged: sourceUnchanged, injected, restoredBeforeFinally, restoredAfterFinally,\n    sourceHashesAfter: sourceAfter ?? null, markers, requiredPasses, uiAndRefusalPassed,\n    unexecutedRFChecks, expectedEarlyReturn, unrelatedFailures, verifierRuntimeFailure, interrupted, deadlineFailure,\n    permission: mode === 'ep' ? null : { root: permission.root, initialMode: permission.originalMode, finalMode: permission.finalMode,\n      transitions: permission.transitions, responseStagesRestored: permission.completed, closed: permission.closed ?? false,\n      restorationFailure: permission.restorationFailure, pendingFault: permission.pending?.stage ?? null },\n    unavailable: unavailable ?? null, runtimeFailureStage: runtimeFailureStage ?? null,\n    limitation: 'Negative evidence only. Root must run the unchanged verifier green against the restored same candidate.',\n  }\n  if (mode !== 'ep') await writeFile(join(directory, 'mode-transitions.json'), JSON.stringify(receipt.permission, null, 2) + '\\n', { mode: 0o600 })\n  await writeFile(join(directory, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\\n', { mode: 0o600 })\n  console.log(`NEGATIVE RECEIPT trusted=${trustedNegative} isolated=${receipt.isolated} childExit=${actual.code ?? 'unresolved'} otherFailures=${unrelatedFailures.length} runtimeFailure=${verifierRuntimeFailure}`)\n  for (const failure of unrelatedFailures) console.log(`UNRELATED ${failure}`)\n  return trustedNegative ? 0 : 1\n}\n\nif (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {\n  try { process.exitCode = await run(process.argv[2] ?? 'ep') }\n  catch { console.error('RUNTIME FAIL staging-receipt-or-output: no trusted negative receipt'); process.exitCode = 1 }\n}\n"
}
````

### Observed original EP staging source

````json
{
  "file": "observed-ep-storage-script.mjs",
  "sha256": "f3622d6332675ff2413efa52d62be8b46c372379a76b7d217c6d209a94842f76",
  "source": "// PREPARED ONLY. Importing this file does not launch anything.\n// Parent exit 0 means a trusted negative receipt, never a product-green result.\nimport { spawn } from 'node:child_process'\nimport { createWriteStream } from 'node:fs'\nimport { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'\nimport { createHash, randomUUID } from 'node:crypto'\nimport { join, resolve } from 'node:path'\nimport { fileURLToPath, pathToFileURL } from 'node:url'\nimport { serializeStorageValue, deserializeStorageValue } from '/home/felixb/Projekte/chessfable.worktrees/drain/src/state/store/debouncedStorage.ts'\nimport { decodeEngineOwnerValue } from '/home/felixb/Projekte/chessfable.worktrees/drain/src/state/engineOwnerEnvelope.ts'\n\nconst ROOT = '/home/felixb/Projekte/chessfable.worktrees/drain'\nconst OUTPUT = '/tmp/chessfable-drain-recovery-20261023/native-proof'\nconst VERIFY = join(ROOT, 'scripts/verify-app.mjs')\nconst SOURCES = [VERIFY, join(ROOT, 'src/state/store/debouncedStorage.ts'), join(ROOT, 'src/state/engineOwnerEnvelope.ts')]\nconst EXPECTED = 'Fixture saved publication'\nconst WRONG = 'Scratch EP storage staging altered publication'\nconst MARKERS = [\n  'FAIL  EP1-storage successful Name edit persists the decoded engine name',\n  'FAIL  EP2-storage refused Name edit retains the decoded saved engine name',\n]\nconst INTACT = [\n  '  ok  EP1-card successful Name edit publishes the saved engine card',\n  '  ok  EP2-error refused engines storage write reports the save error',\n  '  ok  EP2-card refused Name edit retains the saved engine card',\n  '  ok  EP2-input refused Name draft settles to the saved name',\n]\nconst delay = ms => new Promise(resolveDelay => setTimeout(resolveDelay, ms))\nconst sha = text => createHash('sha256').update(text).digest('hex')\n\nasync function bounded(promise, ms, label) {\n  let timer\n  try {\n    return await Promise.race([promise, new Promise((_, reject) => {\n      timer = setTimeout(() => reject(new Error(label)), ms)\n    })])\n  } finally { clearTimeout(timer) }\n}\n\n// Only debugger addressing, not a product source checker. Refuse ambiguous/missing addresses.\nfunction addresses(source) {\n  const first = '  async function enginePublicationSnapshot() {\\n    return session.execute('\n  const second = '  } finally {\\n    await session.execute(\\n      \"window.__verifyRestoreEngineStorage(); delete window.__verifyRestoreEngineStorage; return true;\",\\n    );\\n  }'\n  const locate = text => {\n    const index = source.indexOf(text)\n    if (index < 0 || source.indexOf(text, index + 1) >= 0) throw new Error('breakpoint-address-unavailable')\n    return index\n  }\n  const line = index => source.slice(0, index).split('\\n').length\n  const firstIndex = locate(first)\n  const secondIndex = locate(second)\n  return {\n    snapshot: line(firstIndex + first.indexOf('    return')),\n    restore: line(secondIndex + second.indexOf('    await')),\n    finallyEnd: line(secondIndex + second.lastIndexOf('  }')),\n  }\n}\n\n// A single owned Node-inspector connection. Never attach to a configured or discovered service.\nclass Inspector {\n  constructor(socket) {\n    this.socket = socket\n    this.sequence = 0\n    this.requests = new Map()\n    this.pauses = []\n    this.waiter = undefined\n    socket.addEventListener('message', event => {\n      let message\n      try { message = JSON.parse(String(event.data)) } catch { socket.close(); return }\n      if (message.id) {\n        const request = this.requests.get(message.id)\n        this.requests.delete(message.id)\n        if (message.error) request?.reject(new Error('inspector-command-failed'))\n        else request?.resolve(message.result)\n      } else if (message.method === 'Debugger.paused') {\n        if (this.waiter) { const waiter = this.waiter; this.waiter = undefined; waiter.resolve(message.params) }\n        else this.pauses.push(message.params)\n      }\n    })\n    socket.addEventListener('close', () => {\n      for (const request of this.requests.values()) request.reject(new Error('inspector-disconnected'))\n      this.requests.clear()\n      this.waiter?.reject(new Error('inspector-disconnected'))\n      this.waiter = undefined\n    })\n  }\n  async call(method, params = {}) {\n    if (this.socket.readyState !== WebSocket.OPEN) throw new Error('inspector-not-open')\n    const id = ++this.sequence\n    try {\n      return await bounded(new Promise((resolveCall, reject) => {\n        this.requests.set(id, { resolve: resolveCall, reject })\n        this.socket.send(JSON.stringify({ id, method, params }))\n      }), 10_000, 'inspector-command-timeout')\n    } finally { this.requests.delete(id) }\n  }\n  async paused(ms) {\n    if (this.pauses.length) return this.pauses.shift()\n    try {\n      return await bounded(new Promise((resolvePause, reject) => { this.waiter = { resolve: resolvePause, reject } }), ms, 'debugger-stop-unavailable')\n    } finally { this.waiter = undefined }\n  }\n}\n\n// Exact existing WebDriver session from the owned stopped frame, no new driver or session.\nasync function execute(base, script, args = []) {\n  const response = await fetch(base + '/execute/sync', {\n    method: 'POST', headers: { 'content-type': 'application/json' },\n    body: JSON.stringify({ script, args }), signal: AbortSignal.timeout(5000),\n  })\n  const body = await response.json()\n  if (!response.ok || !Object.hasOwn(body, 'value')) throw new Error('owned-webdriver-call-failed')\n  return body.value\n}\n\nconst restoreScript = `\n  const state = window[arguments[0]];\n  if (!state) return { restored: false };\n  state.active = false;\n  Object.defineProperty(Storage.prototype, 'setItem', state.descriptor);\n  state.descriptor.value.call(localStorage, 'engines', state.raw);\n  const actual = Object.getOwnPropertyDescriptor(Storage.prototype, 'setItem');\n  const restored = localStorage.getItem('engines') === state.raw &&\n    ['value', 'get', 'set', 'writable', 'enumerable', 'configurable'].every(key =>\n      actual[key] === state.descriptor[key]);\n  if (arguments[1] && restored) delete window[arguments[0]];\n  return { restored };\n`\n\nexport async function run() {\n  await mkdir(OUTPUT, { recursive: true })\n  const directory = await mkdtemp(join(OUTPUT, 'ep-storage-'))\n  console.log(`EP storage staging artifacts: ${directory}`)\n  let child, inspector, socket, base, stdout, stderr\n  let childDone, sourceBefore, stops\n  let childFinished = false\n  let interrupted = false\n  let injected = false\n  let restoredBeforeFinally = false\n  let restoredAfterFinally = false\n  let choreographyComplete = false\n  let childReleased = false\n  let stage = 'prepare'\n  let unavailable\n  let runtimeFailureStage\n  const observedLines = {}\n  const token = `__epStorageStage_${randomUUID().replaceAll('-', '')}`\n  const hashes = async () => Object.fromEntries(await Promise.all(SOURCES.map(async path => [path, sha(await readFile(path))])))\n  const signal = () => {\n    interrupted = true\n    if (socket?.readyState === WebSocket.OPEN) socket.close()\n    // Only the exact child handle owned by this invocation. Its handler owns app cleanup.\n    if (child && !childFinished) child.kill('SIGTERM')\n  }\n  for (const name of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(name, signal)\n  try {\n    if (typeof WebSocket !== 'function') throw new Error('node24-websocket-required')\n    const source = await readFile(VERIFY, 'utf8')\n    stops = addresses(source)\n    sourceBefore = await hashes()\n    await writeFile(join(directory, 'preparation.json'), JSON.stringify({ sources: sourceBefore, requestedLines: stops }, null, 2) + '\\n', { mode: 0o600 })\n    stdout = createWriteStream(join(directory, 'stdout.log'), { mode: 0o600 })\n    stderr = createWriteStream(join(directory, 'stderr.log'), { mode: 0o600 })\n    stdout.on('error', signal)\n    stderr.on('error', signal)\n    stage = 'launch-owned-verifier'\n    let endpointResolve, endpointReject\n    const endpoint = new Promise((resolveEndpoint, reject) => { endpointResolve = resolveEndpoint; endpointReject = reject })\n    child = spawn(process.execPath, ['--inspect-brk=127.0.0.1:0', VERIFY], {\n      cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'],\n    })\n    child.stdout.pipe(stdout)\n    child.stderr.pipe(stderr)\n    let inspectorPreamble = ''\n    child.stderr.on('data', chunk => {\n      if (String(chunk).includes('Waiting for the debugger to disconnect')) socket?.close()\n      if (inspectorPreamble.length >= 16_384) return\n      inspectorPreamble += String(chunk)\n      const match = inspectorPreamble.match(/Debugger listening on (ws:\\/\\/127\\.0\\.0\\.1:\\d+\\/[a-f0-9-]+)/)\n      if (match) endpointResolve(match[1])\n    })\n    child.once('error', () => endpointReject(new Error('owned-verifier-spawn-failed')))\n    childDone = new Promise(resolveExit => child.once('close', (code, signalName) => {\n      childFinished = true\n      endpointReject(new Error('owned-verifier-exited'))\n      resolveExit({ code, signal: signalName })\n    }))\n    stage = 'attach-owned-inspector'\n    const endpointURL = new URL(await bounded(endpoint, 15_000, 'inspector-endpoint-unavailable'))\n    if (endpointURL.hostname !== '127.0.0.1' || endpointURL.protocol !== 'ws:' ||\n      endpointURL.username || endpointURL.password || endpointURL.search || endpointURL.hash) throw new Error('unowned-inspector-refused')\n    socket = new WebSocket(endpointURL)\n    await bounded(new Promise((resolveOpen, reject) => {\n      socket.addEventListener('open', resolveOpen, { once: true })\n      socket.addEventListener('error', () => reject(new Error('owned-inspector-connect-failed')), { once: true })\n    }), 10_000, 'inspector-connect-timeout')\n    inspector = new Inspector(socket)\n    await inspector.call('Debugger.enable')\n    const breakpoint = async line => (await inspector.call('Debugger.setBreakpointByUrl', {\n      url: pathToFileURL(VERIFY).href, lineNumber: line - 1,\n    })).breakpointId\n    const first = await breakpoint(stops.snapshot)\n    const second = await breakpoint(stops.restore)\n    await inspector.call('Runtime.runIfWaitingForDebugger')\n    childReleased = true\n    stage = 'first-publication-stop'\n    let paused = await inspector.paused(20 * 60_000)\n    if (!paused.hitBreakpoints?.includes(first)) {\n      // The single initial --inspect-brk stop, before the verifier starts its own harness.\n      await inspector.call('Debugger.resume')\n      paused = await inspector.paused(20 * 60_000)\n    }\n    const frame = paused.callFrames[0]\n    if (!paused.hitBreakpoints?.includes(first) || frame.functionName !== 'enginePublicationSnapshot') throw new Error('publication-stop-unavailable')\n    await inspector.call('Debugger.removeBreakpoint', { breakpointId: first })\n    observedLines.snapshot = frame.location.lineNumber + 1\n    // This is the ONLY evaluateOnCallFrame expression. Do not inspect scopes or other locals.\n    const evaluated = await inspector.call('Debugger.evaluateOnCallFrame', {\n      callFrameId: frame.callFrameId, expression: 'session.base', returnByValue: true, silent: true,\n    })\n    if (evaluated.exceptionDetails || evaluated.result?.type !== 'string') throw new Error('owned-session-unavailable')\n    base = evaluated.result.value\n    const owned = new URL(base)\n    if (owned.origin !== 'http://127.0.0.1:4444' || !/^\\/session\\/[A-Za-z0-9%._-]+$/.test(owned.pathname) ||\n      owned.search || owned.hash || owned.username || owned.password) throw new Error('owned-session-refused')\n    stage = 'valid-envelope-boundary'\n    const deadline = Date.now() + 10_000\n    let originalRaw, corruptRaw\n    while (Date.now() < deadline && !interrupted) {\n      const input = await execute(base, `\n        const label = [...document.querySelectorAll('label')].find(node => node.textContent === 'Name');\n        const card = document.querySelector('button[aria-pressed=\"true\"]');\n        return { raw: localStorage.getItem('engines'),\n          input: label && document.getElementById(label.htmlFor)?.value,\n          card: card?.querySelector('p')?.firstChild?.textContent.trim() };\n      `)\n      const decoded = input.raw && deserializeStorageValue(input.raw)\n      const owner = decoded && decodeEngineOwnerValue(decoded)\n      const retained = Array.isArray(owner?.value) && owner.value.filter(engine => engine.id === 'retained')\n      if (decoded?.version === 1 && owner && retained?.length === 1 && retained[0].name === EXPECTED &&\n        input.input === EXPECTED && input.card === EXPECTED) {\n        originalRaw = input.raw\n        corruptRaw = serializeStorageValue({ ...decoded,\n          value: owner.value.map(engine => engine.id === 'retained' ? { ...engine, name: WRONG } : engine),\n        })\n        const corrupted = decodeEngineOwnerValue(deserializeStorageValue(corruptRaw))\n        if (!corrupted || corrupted.value.find(engine => engine.id === 'retained')?.name !== WRONG) throw new Error('valid-corruption-unavailable')\n        const result = await execute(base, `\n          if (localStorage.getItem('engines') !== arguments[1]) return { changed: false };\n          const descriptor = Object.getOwnPropertyDescriptor(Storage.prototype, 'setItem');\n          if (!descriptor?.configurable || typeof descriptor.value !== 'function') return { changed: false };\n          const state = { raw: arguments[1], corrupted: arguments[2], descriptor, active: true };\n          window[arguments[0]] = state;\n          Object.defineProperty(Storage.prototype, 'setItem', { ...descriptor, value: function(key, value) {\n            return descriptor.value.call(this, key,\n              state.active && this === localStorage && key === 'engines' ? state.corrupted : value);\n          } });\n          descriptor.value.call(localStorage, 'engines', state.corrupted);\n          return { changed: localStorage.getItem('engines') === state.corrupted };\n        `, [token, originalRaw, corruptRaw])\n        if (result.changed) { injected = true; break }\n      }\n      await delay(100)\n    }\n    if (!injected) throw new Error('valid-envelope-boundary-unavailable')\n    await writeFile(join(directory, 'storage-hashes.json'), JSON.stringify({ original: sha(originalRaw), corrupted: sha(corruptRaw) }, null, 2) + '\\n', { mode: 0o600 })\n    console.log('STAGE valid envelope persisted with only retained engine name changed')\n    stage = 'post-EP2-storage-stop'\n    await inspector.call('Debugger.resume')\n    paused = await inspector.paused(90_000)\n    if (!paused.hitBreakpoints?.includes(second)) throw new Error('post-EP2-stop-unavailable')\n    observedLines.restore = paused.callFrames[0].location.lineNumber + 1\n    await inspector.call('Debugger.removeBreakpoint', { breakpointId: second })\n    restoredBeforeFinally = (await execute(base, restoreScript, [token, false])).restored\n    if (!restoredBeforeFinally) throw new Error('pre-finally-restoration-failed')\n    // EP2's unchanged finally captured our writer. Step over it with the fault inactive, then\n    // restore the descriptor again so its ordinary assignment cannot leave our writer installed.\n    const scriptId = paused.callFrames[0].location.scriptId\n    stage = 'unchanged-EP2-finally'\n    let pastFinally = false\n    for (let step = 0; step < 8; step++) {\n      await inspector.call('Debugger.stepOver')\n      paused = await inspector.paused(15_000)\n      if (paused.callFrames[0].location.scriptId === scriptId &&\n        paused.callFrames[0].location.lineNumber >= stops.finallyEnd) { pastFinally = true; break }\n    }\n    if (!pastFinally) throw new Error('finally-step-unavailable')\n    restoredAfterFinally = (await execute(base, restoreScript, [token, true])).restored\n    if (!restoredAfterFinally) throw new Error('post-finally-restoration-failed')\n    choreographyComplete = true\n    console.log('STAGE exact storage bytes and descriptor restored before and after unchanged EP2 cleanup')\n  } catch (error) {\n    const availability = ['breakpoint-address-unavailable', 'publication-stop-unavailable',\n      'owned-session-unavailable', 'valid-envelope-boundary-unavailable', 'valid-corruption-unavailable',\n      'post-EP2-stop-unavailable', 'finally-step-unavailable', 'debugger-stop-unavailable']\n    if (availability.includes(error?.message)) unavailable = stage\n    else runtimeFailureStage = stage\n    console.error(`${unavailable ? 'STAGING UNAVAILABLE' : 'RUNTIME FAIL'} ${stage}: no trusted semantic receipt from this attempt`)\n  } finally {\n    if (!restoredAfterFinally && base && !childFinished) {\n      try { await execute(base, restoreScript, [token, true]) } catch { /* Disposable verifier still owns final cleanup. */ }\n    }\n    // No debugger may hold the verifier at exit or prevent its own finally/shutdown.\n    if (inspector) {\n      try { await inspector.call('Runtime.runIfWaitingForDebugger'); childReleased = true } catch { /* May already be detached. */ }\n      try { await inspector.call('Debugger.resume') } catch { /* Already running or disconnected. */ }\n      try { await inspector.call('Debugger.disable') } catch { /* Connection may have closed. */ }\n    }\n    if (socket && socket.readyState !== WebSocket.CLOSED) socket.close()\n    if (child && !childFinished && !childReleased) child.kill('SIGTERM')\n  }\n\n  let actual = { code: null, signal: null }\n  let deadlineFailure = false\n  if (childDone) {\n    try { actual = await bounded(childDone, 45 * 60_000, 'owned-verifier-exit-timeout') }\n    catch {\n      deadlineFailure = true\n      console.error('RUNTIME FAIL owned-verifier-exit: cleanup deadline exceeded, negative receipt untrusted')\n      if (!childFinished) child.kill('SIGTERM')\n      try { actual = await bounded(childDone, 30_000, 'owned-verifier-cleanup-timeout') } catch { /* Report unresolved, never SIGKILL. */ }\n    }\n  }\n  for (const name of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.removeListener(name, signal)\n  await writeFile(join(directory, 'child.actual-exit'), actual.signal ? `signal:${actual.signal}\\n` : `${actual.code ?? 'unresolved'}\\n`, { mode: 0o600 })\n  if (stdout) await bounded(new Promise(resolveFinish => stdout.closed ? resolveFinish() : stdout.once('close', resolveFinish)), 5000, 'stdout-close-timeout')\n  if (stderr) await bounded(new Promise(resolveFinish => stderr.closed ? resolveFinish() : stderr.once('close', resolveFinish)), 5000, 'stderr-close-timeout')\n  const output = stdout ? await readFile(join(directory, 'stdout.log'), 'utf8') : ''\n  const errors = stderr ? await readFile(join(directory, 'stderr.log'), 'utf8') : ''\n  const failed = output.split(/\\r?\\n/).filter(line => line.startsWith('FAIL  '))\n  const uiAndRefusalPassed = INTACT.every(marker => output.split(/\\r?\\n/).includes(marker))\n  const markers = Object.fromEntries(MARKERS.map(marker => [marker, failed.includes(marker)]))\n  const unrelatedFailures = failed.filter(line => !MARKERS.includes(line))\n  const verifierRuntimeFailure = /verify:app (?:could not run|cleanup failed|[^\\n]*permission cleanup failed)/.test(errors)\n  let sourceUnchanged = false\n  try { sourceUnchanged = JSON.stringify(sourceBefore) === JSON.stringify(await hashes()) } catch { /* Receipt stays untrusted. */ }\n  const trustedNegative = choreographyComplete && restoredBeforeFinally && restoredAfterFinally && sourceUnchanged &&\n    actual.code === 1 && !actual.signal && MARKERS.every(marker => markers[marker]) && uiAndRefusalPassed && !interrupted && !deadlineFailure\n  const receipt = {\n    purpose: 'Negative EP storage staging', trustedNegative, isolated: trustedNegative && !unrelatedFailures.length && !verifierRuntimeFailure,\n    actual, requestedLines: stops, observedLines, sourcesUnchanged: sourceUnchanged, injected, restoredBeforeFinally, restoredAfterFinally,\n    markers, uiAndRefusalPassed, unrelatedFailures, verifierRuntimeFailure, interrupted, deadlineFailure,\n    unavailable: unavailable ?? null, runtimeFailureStage: runtimeFailureStage ?? null,\n    limitation: 'Negative evidence only. Root must run the unchanged verifier green against the restored same candidate.',\n  }\n  await writeFile(join(directory, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\\n', { mode: 0o600 })\n  console.log(`NEGATIVE RECEIPT trusted=${trustedNegative} isolated=${receipt.isolated} childExit=${actual.code ?? 'unresolved'} otherFailures=${unrelatedFailures.length} runtimeFailure=${verifierRuntimeFailure}`)\n  for (const failure of unrelatedFailures) console.log(`UNRELATED ${failure}`)\n  return trustedNegative ? 0 : 1\n}\n\nif (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {\n  try { process.exitCode = await run() }\n  catch { console.error('RUNTIME FAIL staging-receipt-or-output: no trusted negative receipt'); process.exitCode = 1 }\n}\n"
}
````

### Permission staging scope and limits

````markdown
# Prepared public-workflow root-permission stages

Root executed both RF cases and the ordinary positive on 2026-10-23. The original preparation
leaf ran only syntax/import checks. Actual rf0-64TR8D child exit 1 printed exactly RF0 FAIL,
with all six EP checks green and the later RF checks intentionally unexecuted. Actual
rf-matrix-WIWkG6 child exit 1 printed exactly RF2, updated RF3 and RF8 FAIL, with RF0, RF1,
RF5, RF6, RF7 and all six EP checks green. Both parent canonical attempts completed 0,
all modes were restored after their actual native responses, source/binary hashes matched,
and both receipts have isolated=true, otherFailures=0 and runtimeFailure=false.
The ordinary unchanged verifier then completed permission-positive.Rco7vI at exit 0 with
all checks passed. These cover the four semantic result assertions only, not the diagnostic
matrix listed below. Removal path: delete disposable choreography after raw receipts
are archived. Failure costs one isolated unchanged real-app verifier run per case.

The observed old EP producer and README were preserved byte-exact before editing, under
`observed-ep-storage-script.mjs` and `observed-EP-STORAGE-STAGING.md`. See
[EP-STORAGE-STAGING.md](EP-STORAGE-STAGING.md) for hashes and root's reported valid but
non-isolated `ep-storage-sqZpX4` negative. No claim is made that its independent RF0 failure
was green. Current RF mapping is d-20261023-07 and the removed-API repair is f-20261023-02.

## Two commands for root

Use the reviewed current source and matching existing release binary, with no other real-app
verifier running. The script reuses one inspector implementation, subprocess lifecycle and
receipt path. The modes are fixed to these two settled cases, not a configurable fault framework.

```sh
node /tmp/chessfable-drain-recovery-20261023/native-proof/stage-ep-storage.mjs rf0
node /tmp/chessfable-drain-recovery-20261023/native-proof/stage-ep-storage.mjs rf-matrix
```

Run sequentially, waiting for the prior child and its original cleanup to finish. For a detached
run with a separate actual parent status, use a unique label, changing only the fixed mode:

```sh
rf_stage_mode=rf0
rf_stage_label=rf0-1
rf_stage_base=/tmp/chessfable-drain-recovery-20261023/native-proof
setsid nohup bash -s "$rf_stage_mode" "$rf_stage_label" > "$rf_stage_base/$rf_stage_label.parent.log" 2>&1 <<'SH' & disown
node /tmp/chessfable-drain-recovery-20261023/native-proof/stage-ep-storage.mjs "$1"
rf_parent_status=$?
printf '%s\n' "$rf_parent_status" > "/tmp/chessfable-drain-recovery-20261023/native-proof/$2.parent.actual-exit"
exit "$rf_parent_status"
SH
```

Wait on named output artifacts, never process-name matching. The ordinary child command is
the same in every mode: existing Node 24 with `--inspect-brk=127.0.0.1:0`, executing unchanged
`scripts/verify-app.mjs` without extra arguments or source flags. The parent attaches only to
the random loopback inspector URL printed by its own spawned child. There is no shared-inspector
discovery, second browser, driver, compositor or native session. It wraps the exact stopped
session with the existing app-driver `Session` constructor and never opens/quits another one.

## Input boundary and source stops

Current `verifySelectedRootPermissions` submits real `install_engine_workflow`, retaining its
genuine selected workspace identities. Its deliberately nonhex 64-character SHA causes the
healthy-root InvalidInput result before networking. Root mode 0300 or 0400 yields the real
Permission result earlier. Parent code never changes this request, digest, ticket, probe state,
fixture constant, typed response, expected message, library or verifier local.

At the observed runs, requested source addresses were line 801 at `verifySelectedRootPermissions`
entry, line 838 at `workflowProbe` entry and line 858 just after its real awaited native
response. The script resolves these unique source anchors for each run and logs requested
and actual paused line addresses. Missing/ambiguous addresses or unexpected frames are
unavailable proof, not a semantic red.

At the function's argument frame, the only reads are `engineRoot` and `session.base`. At either
workflow stop, the only read is the actual `stage` argument. No scopes, `ownedProbe`, ticket,
response object or other local descriptor is inspected or mutated. Native categories remain
visible through the unchanged verifier's original output, never a rewritten inspector return.

The argument must identify `/tmp/chessfable-verify-*/path-owner-fixture/permission-engines`.
The frozen source constructs this argument under the exact newly spawned verifier's disposable
profile. The parent also requires an exact canonical path, same-user nonsymlink directories
for the profile/fixture/root, non-root UID and original root mode 0700. It opens the exact
directory with `O_DIRECTORY | O_NOFOLLOW`, checks inode/device identity and holds that owned
descriptor. Every change checks the current path still names that inode and the expected mode.
There are no environment, credential, native authority-file or real-profile reads.

Only the directory's permission bits change. Each fault records its exact current mode before
changing it and restores that exact mode immediately after the matching native response,
before the verifier classifies its result or starts a separate UI action. A pending restoration
is attempted synchronously in the parent signal handler and again in `finally` before inspector
detach. The descriptor is closed on every path. No page timer, DOM hiding or canned IPC is used.
Workflow pauses contain only local inspector string reads and small filesystem operations.
Source/binary hashing happens outside those notification-sensitive response pauses.

## Fixed faults and required negatives

| Mode | Real input change around only this native workflow | Restore before continuing |
| --- | --- | --- |
| `rf0` | RF0: 0700 → 0300 | 0700 |
| `rf-matrix` | RF2: 0300 → 0700 | 0300, before subsequent Add/Install |
| `rf-matrix` | RF3: 0400 → 0700 | 0400 |
| `rf-matrix` | RF8: 0700 → 0300 | 0700 |

RF0 remains untouched in `rf-matrix`. Its healthy typed InvalidInput must stay green. RF2 and
RF3 are temporarily healthy for their direct workflow calls, so their real InvalidInput results
cross the wrong expected Permission boundary. Their denied modes are restored before all
separate UI work. RF8 receives the actual Permission result instead of its expected healthy
InvalidInput. No real artifact is downloaded or executed by these nonhex-SHA workflow probes.
Later private registration and exact child denial remain native-test obligations, not invented
public API coverage. Browser RF4 was removed under the settled mapping.

`rf0` requires this exact unchanged stdout line and actual child exit **1**:

```text
FAIL  RF0 selected puzzle and engine roots accept real IPC before access loss
```

RF0 intentionally returns early after settling its real completion. RF1, RF2, RF3, RF5, RF6,
RF7 and RF8 are unexecuted in that run and receive no staged credit. The receipt verifies their
check lines are absent. All six unchanged EP checks must be green and no child runtime failure
may occur.

`rf-matrix` requires all three exact lines in the same unchanged child, with actual exit **1**:

```text
FAIL  RF2 engine destination read denial preserves Permission and I/O failure with a permission root label
FAIL  RF3 public engine workflow root search denial preserves Permission and I/O failure with a permission root label
FAIL  RF8 restoring access recovers the same selected roots
```

RF0, RF1, RF5, RF6 and RF7 must print their existing green checks, as must all six EP checks.
There must be no child runtime failure. Restoration must be verified after each fault. The
selected root IDs, real renderer notifications and unrelated child bytes remain genuine.

## Status contract and receipts

Parent exit 0 means the expected negative receipt was validated, never product green. It
requires the correct child's actual exit 1, every desired FAIL, required unchanged green checks,
completed mode restoration, unchanged source/binary hashes and no interruption/deadline/runtime
failure. Parent exit 1 or `STAGING UNAVAILABLE`/`RUNTIME FAIL` cannot replace the semantic child
negative. A signal or killed/unresolved child does not satisfy actual exit 1.

The parent prints a new `rf0-*/` or `rf-matrix-*/` directory under `native-proof/`, containing:

- `stdout.log`, `stderr.log`: unchanged complete child output, mode 0600.
- `child.actual-exit`: numeric child exit or explicit signal/unresolved outcome, separate from
  the parent's status.
- `preparation.json`: requested source addresses and hashes of the verifier, production codecs,
  app-driver, native fs source, actual release binary and this choreography.
- `mode-transitions.json`: owned directory, initial/final parent-observed mode, every fault and
  restoration with stage label, descriptor closure and restoration status.
- `receipt.json`: actual paused addresses, before/after hash equality, desired marker presence,
  required green checks, unrelated FAIL lines, runtime flags and unexecuted RF0 checks.

Actual receipts are in rf0-64TR8D and rf-matrix-WIWkG6 under this directory. Every extra `FAIL  `
line is preserved and listed as unrelated. Such a run has `isolated: false` and cannot attribute
exit solely to these controls. Fatal/cleanup diagnostics are separately flagged and disqualify
RF receipt trust. Inspector protocol data and arbitrary frame state are not dumped.

The final parent-observed mode is 0700 on complete cases. On an interrupted mid-RF2 or mid-RF3
case, restoration first returns to the exact local prior 0300/0400 so unchanged later UI work
cannot accidentally gain access. The verifier already saved the original 0700 before any fault
and owns its full-function/exit restoration plus profile deletion. The parent never substitutes
an arbitrary 0700 cleanup over a still-active denial scenario.

## Source-derived nonzero and uncovered diagnostics

No RF runtime or guard path was staged by the preparation leaf. Root's actual semantic credit
is the four messages above, with actual marker/status/restoration receipts now captured. Native real
permission tests and root's fresh ordinary positive supplement those controls. They do not
establish a complete cleanup-failure or defensive-guard matrix.

Current verifier nonzero/guard paths, all unchanged by the parent:

- RF0 readiness also depends on genuine puzzle listing/selected root identities and a matching
  failed workflow id with the exact InvalidInput payload. Its failed check intentionally returns
  after settlement. The `rf0` control changes only the real root permission result.
- RF1/RF2/RF3 test exact typed Permission/category/message/root label. RF5/RF6 can fail on actual
  missing visible guidance. RF7 can fail on changed saved owner bytes or unrelated child bytes.
  RF8 checks recovered roots/listing plus the healthy workflow payload. Only RF2/RF3/RF8's actual
  mode-result boundaries are targeted by `rf-matrix`.
- Catalog reading, workspace/listing/invocation failure, reservation preparation and malformed or
  mismatched response identity are not independently staged. No ticket/descriptor mutation is used.
- `settleProbe` can time out waiting for actual native acknowledgement, reject a non-null release
  result, or fail to close/disappear a real native-result notification. These are runtime failures,
  not desired negatives. Existing notification auto-close remains active, so pauses stay short.
- Train, Add New, Install and Close dialog readiness waits can fail. RF6's capture can fail when
  a screenshot path is supplied. No button, UI state or screenshot path is changed by these modes.
- Original function, signal and process-exit cleanup can fail while restoring puzzle/engine/child
  modes or settling a retained completion. Those existing cleanup retries remain owned by the
  verifier. No direct cleanup-failure stage is supplied or claimed.

New parent setup/guard failures remain unexecuted: invalid mode, missing unique source anchors,
runtime/import/binary/hash access, owned child launch/inspector attachment, missing/unexpected
stops or stage order, refused frame-read expression, invalid session URL, root path/UID/symlink/
directory/inode/0700 validation, unexpected per-fault starting mode, chmod/stat/restoration or
descriptor close failure, output/receipt failure, source drift, wrong/missing desired or green
check lines, signal and unresolved child cleanup. They are unavailable/runtime evidence, not
semantic proof. None is described as unstageable. No hypothetical diagnostic branch receives
staged credit and no extra producer-fault framework is added.

Existing bounds are reused: twenty minutes to the first source stop, ninety seconds per workflow
stop, ten seconds per inspector command, forty-five minutes for the remaining unchanged child,
then thirty seconds after SIGTERM for cleanup. Only the exact spawned Node child handle may be
signalled. No shared process/group or existing inspector/browser is touched, and no SIGKILL is
used. The parent resumes/disables/detaches so the original verifier owns all application,
compositor and disposable profile cleanup.

## Required ordinary positive

After both negative children and their cleanup fully finish, root checks source/binary identity
and runs the ordinary unchanged positive against that same repaired candidate:

```sh
pnpm verify:app
```

Archive its raw output and actual exit 0 with the negative receipts. Neither pending RF staging
nor the earlier non-isolated EP negative establishes this positive, product release readiness
or any additional browser/private-registration/cleanup behavior.
````

### rf0-64TR8D

Child output excerpt retains every FAIL and every EP/RF check. Complete original output remained in this disposable case directory.

````text
0 rf0-negative 70da94b30a0466586475930436c796dc004ccbcf
actual child exit: 1
rf0 staging artifacts: /tmp/chessfable-drain-recovery-20261023/native-proof/rf0-64TR8D
ROOT owned=/tmp/chessfable-verify-rtqr2m/path-owner-fixture/permission-engines initialMode=0700
MODE {"stage":"RF0","point":"before-native-call","original":"0700","fault":"0300"}
MODE {"stage":"RF0","point":"after-native-response","restored":"0700"}
STAGE rf0 exact input modes restored after every native response
NEGATIVE RECEIPT trusted=true isolated=true childExit=1 otherFailures=0 runtimeFailure=false
  ok  EP1-card successful Name edit publishes the saved engine card
  ok  EP1-storage successful Name edit persists the decoded engine name
  ok  EP2-error refused engines storage write reports the save error
  ok  EP2-card refused Name edit retains the saved engine card
  ok  EP2-input refused Name draft settles to the saved name
  ok  EP2-storage refused Name edit retains the decoded saved engine name
FAIL  RF0 selected puzzle and engine roots accept real IPC before access loss
````

````json
{
  "purpose": "Negative rf0 staging",
  "mode": "rf0",
  "trustedNegative": true,
  "isolated": true,
  "actual": {
    "code": 1,
    "signal": null
  },
  "requestedLines": {
    "entry": 801,
    "before": 838,
    "response": 858
  },
  "observedLines": {
    "entry": 801,
    "workflow": [
      {
        "stage": "RF0",
        "point": "entry",
        "line": 838
      },
      {
        "stage": "RF0",
        "point": "response",
        "line": 858
      }
    ]
  },
  "sourcesUnchanged": true,
  "injected": true,
  "restoredBeforeFinally": false,
  "restoredAfterFinally": false,
  "sourceHashesAfter": {
    "/home/felixb/Projekte/chessfable.worktrees/drain/scripts/verify-app.mjs": "7278896d110f5df4e1b0267d19ee66e5272bee52268f2c0b7548f0e8379c0765",
    "/home/felixb/Projekte/chessfable.worktrees/drain/src/state/store/debouncedStorage.ts": "6ae2f52b661eb5a2d3a520fdbe8469a38326e387cb91b87aea014a9c87de7fe0",
    "/home/felixb/Projekte/chessfable.worktrees/drain/src/state/engineOwnerEnvelope.ts": "5c1de1ddd8993f7b95b7d85f049f3c7cbb88a934a43d6a7b4a1d30adb0e3415b",
    "/home/felixb/Projekte/chessfable.worktrees/drain/scripts/app-driver.mjs": "0537b7208ed9add4b2825b85343d4d9dcf24425e8b97d87129037e1aef882437",
    "/home/felixb/Projekte/chessfable.worktrees/drain/src-tauri/src/fs.rs": "b2b69c5ac6ac87e92f81bb3464a5a12eb63a50276e46fb95f98249f29802465c",
    "/home/felixb/Projekte/chessfable.worktrees/drain/src-tauri/target/release/chessfable": "1a94956eb13061c28eab17a963388387c51394c1ce93afcb033034c6be75bf60",
    "/tmp/chessfable-drain-recovery-20261023/native-proof/stage-ep-storage.mjs": "0c24389a319dd2b3cf1cd8e15d29166d3d29af7dc5366e426170bfa77434831d"
  },
  "markers": {
    "FAIL  RF0 selected puzzle and engine roots accept real IPC before access loss": true
  },
  "requiredPasses": {
    "  ok  EP1-card successful Name edit publishes the saved engine card": true,
    "  ok  EP2-error refused engines storage write reports the save error": true,
    "  ok  EP2-card refused Name edit retains the saved engine card": true,
    "  ok  EP2-input refused Name draft settles to the saved name": true,
    "  ok  EP1-storage successful Name edit persists the decoded engine name": true,
    "  ok  EP2-storage refused Name edit retains the decoded saved engine name": true
  },
  "uiAndRefusalPassed": true,
  "unexecutedRFChecks": [
    "RF1",
    "RF2",
    "RF3",
    "RF5",
    "RF6",
    "RF7",
    "RF8"
  ],
  "expectedEarlyReturn": true,
  "unrelatedFailures": [],
  "verifierRuntimeFailure": false,
  "interrupted": false,
  "deadlineFailure": false,
  "permission": {
    "root": "/tmp/chessfable-verify-rtqr2m/path-owner-fixture/permission-engines",
    "initialMode": "0700",
    "finalMode": "0700",
    "transitions": [
      {
        "stage": "RF0",
        "point": "before-native-call",
        "original": "0700",
        "fault": "0300"
      },
      {
        "stage": "RF0",
        "point": "after-native-response",
        "restored": "0700"
      }
    ],
    "responseStagesRestored": [
      "RF0"
    ],
    "closed": true,
    "restorationFailure": false,
    "pendingFault": null
  },
  "unavailable": null,
  "runtimeFailureStage": null,
  "limitation": "Negative evidence only. Root must run the unchanged verifier green against the restored same candidate."
}
````

### rf-matrix-WIWkG6

Child output excerpt retains every FAIL and every EP/RF check. Complete original output remained in this disposable case directory.

````text
0 rf-matrix-negative 70da94b30a0466586475930436c796dc004ccbcf
actual child exit: 1
rf-matrix staging artifacts: /tmp/chessfable-drain-recovery-20261023/native-proof/rf-matrix-WIWkG6
ROOT owned=/tmp/chessfable-verify-3sMKMv/path-owner-fixture/permission-engines initialMode=0700
MODE {"stage":"RF2","point":"before-native-call","original":"0300","fault":"0700"}
MODE {"stage":"RF2","point":"after-native-response","restored":"0300"}
MODE {"stage":"RF3","point":"before-native-call","original":"0400","fault":"0700"}
MODE {"stage":"RF3","point":"after-native-response","restored":"0400"}
MODE {"stage":"RF8","point":"before-native-call","original":"0700","fault":"0300"}
MODE {"stage":"RF8","point":"after-native-response","restored":"0700"}
STAGE rf-matrix exact input modes restored after every native response
NEGATIVE RECEIPT trusted=true isolated=true childExit=1 otherFailures=0 runtimeFailure=false
  ok  EP1-card successful Name edit publishes the saved engine card
  ok  EP1-storage successful Name edit persists the decoded engine name
  ok  EP2-error refused engines storage write reports the save error
  ok  EP2-card refused Name edit retains the saved engine card
  ok  EP2-input refused Name draft settles to the saved name
  ok  EP2-storage refused Name edit retains the decoded saved engine name
  ok  RF0 selected puzzle and engine roots accept real IPC before access loss
  ok  RF1 puzzle read denial preserves Permission and I/O failure with a permission root label
  ok  RF5 puzzle permission guidance is visible through the actual renderer
FAIL  RF2 engine destination read denial preserves Permission and I/O failure with a permission root label
  ok  RF6 Add permission guidance is visible through the actual renderer
FAIL  RF3 public engine workflow root search denial preserves Permission and I/O failure with a permission root label
  ok  RF7 permission failures retain saved engines and unrelated filesystem bytes
FAIL  RF8 restoring access recovers the same selected roots
````

````json
{
  "purpose": "Negative rf-matrix staging",
  "mode": "rf-matrix",
  "trustedNegative": true,
  "isolated": true,
  "actual": {
    "code": 1,
    "signal": null
  },
  "requestedLines": {
    "entry": 801,
    "before": 838,
    "response": 858
  },
  "observedLines": {
    "entry": 801,
    "workflow": [
      {
        "stage": "RF0",
        "point": "entry",
        "line": 838
      },
      {
        "stage": "RF0",
        "point": "response",
        "line": 858
      },
      {
        "stage": "RF2",
        "point": "entry",
        "line": 838
      },
      {
        "stage": "RF2",
        "point": "response",
        "line": 858
      },
      {
        "stage": "RF3",
        "point": "entry",
        "line": 838
      },
      {
        "stage": "RF3",
        "point": "response",
        "line": 858
      },
      {
        "stage": "RF8",
        "point": "entry",
        "line": 838
      },
      {
        "stage": "RF8",
        "point": "response",
        "line": 858
      }
    ]
  },
  "sourcesUnchanged": true,
  "injected": true,
  "restoredBeforeFinally": false,
  "restoredAfterFinally": false,
  "sourceHashesAfter": {
    "/home/felixb/Projekte/chessfable.worktrees/drain/scripts/verify-app.mjs": "7278896d110f5df4e1b0267d19ee66e5272bee52268f2c0b7548f0e8379c0765",
    "/home/felixb/Projekte/chessfable.worktrees/drain/src/state/store/debouncedStorage.ts": "6ae2f52b661eb5a2d3a520fdbe8469a38326e387cb91b87aea014a9c87de7fe0",
    "/home/felixb/Projekte/chessfable.worktrees/drain/src/state/engineOwnerEnvelope.ts": "5c1de1ddd8993f7b95b7d85f049f3c7cbb88a934a43d6a7b4a1d30adb0e3415b",
    "/home/felixb/Projekte/chessfable.worktrees/drain/scripts/app-driver.mjs": "0537b7208ed9add4b2825b85343d4d9dcf24425e8b97d87129037e1aef882437",
    "/home/felixb/Projekte/chessfable.worktrees/drain/src-tauri/src/fs.rs": "b2b69c5ac6ac87e92f81bb3464a5a12eb63a50276e46fb95f98249f29802465c",
    "/home/felixb/Projekte/chessfable.worktrees/drain/src-tauri/target/release/chessfable": "1a94956eb13061c28eab17a963388387c51394c1ce93afcb033034c6be75bf60",
    "/tmp/chessfable-drain-recovery-20261023/native-proof/stage-ep-storage.mjs": "0c24389a319dd2b3cf1cd8e15d29166d3d29af7dc5366e426170bfa77434831d"
  },
  "markers": {
    "FAIL  RF2 engine destination read denial preserves Permission and I/O failure with a permission root label": true,
    "FAIL  RF3 public engine workflow root search denial preserves Permission and I/O failure with a permission root label": true,
    "FAIL  RF8 restoring access recovers the same selected roots": true
  },
  "requiredPasses": {
    "  ok  EP1-card successful Name edit publishes the saved engine card": true,
    "  ok  EP2-error refused engines storage write reports the save error": true,
    "  ok  EP2-card refused Name edit retains the saved engine card": true,
    "  ok  EP2-input refused Name draft settles to the saved name": true,
    "  ok  EP1-storage successful Name edit persists the decoded engine name": true,
    "  ok  EP2-storage refused Name edit retains the decoded saved engine name": true,
    "  ok  RF0 selected puzzle and engine roots accept real IPC before access loss": true,
    "  ok  RF1 puzzle read denial preserves Permission and I/O failure with a permission root label": true,
    "  ok  RF5 puzzle permission guidance is visible through the actual renderer": true,
    "  ok  RF6 Add permission guidance is visible through the actual renderer": true,
    "  ok  RF7 permission failures retain saved engines and unrelated filesystem bytes": true
  },
  "uiAndRefusalPassed": true,
  "unexecutedRFChecks": [],
  "expectedEarlyReturn": true,
  "unrelatedFailures": [],
  "verifierRuntimeFailure": false,
  "interrupted": false,
  "deadlineFailure": false,
  "permission": {
    "root": "/tmp/chessfable-verify-3sMKMv/path-owner-fixture/permission-engines",
    "initialMode": "0700",
    "finalMode": "0700",
    "transitions": [
      {
        "stage": "RF2",
        "point": "before-native-call",
        "original": "0300",
        "fault": "0700"
      },
      {
        "stage": "RF2",
        "point": "after-native-response",
        "restored": "0300"
      },
      {
        "stage": "RF3",
        "point": "before-native-call",
        "original": "0400",
        "fault": "0700"
      },
      {
        "stage": "RF3",
        "point": "after-native-response",
        "restored": "0400"
      },
      {
        "stage": "RF8",
        "point": "before-native-call",
        "original": "0700",
        "fault": "0300"
      },
      {
        "stage": "RF8",
        "point": "after-native-response",
        "restored": "0700"
      }
    ],
    "responseStagesRestored": [
      "RF2",
      "RF3",
      "RF8"
    ],
    "closed": true,
    "restorationFailure": false,
    "pendingFault": null
  },
  "unavailable": null,
  "runtimeFailureStage": null,
  "limitation": "Negative evidence only. Root must run the unchanged verifier green against the restored same candidate."
}
````

### ep-storage-sqZpX4

Child output excerpt retains every FAIL and every EP/RF check. Complete original output remained in this disposable case directory.

````text
0 ep-storage-stage ff4d7a1414627f1a48f97a813e376962c0e8d24e
actual child exit: 1
EP storage staging artifacts: /tmp/chessfable-drain-recovery-20261023/native-proof/ep-storage-sqZpX4
STAGE valid envelope persisted with only retained engine name changed
STAGE exact storage bytes and descriptor restored before and after unchanged EP2 cleanup
NEGATIVE RECEIPT trusted=true isolated=false childExit=1 otherFailures=1 runtimeFailure=false
UNRELATED FAIL  RF0 selected puzzle and engine roots accept real IPC before access loss
  ok  EP1-card successful Name edit publishes the saved engine card
FAIL  EP1-storage successful Name edit persists the decoded engine name
  ok  EP2-error refused engines storage write reports the save error
  ok  EP2-card refused Name edit retains the saved engine card
  ok  EP2-input refused Name draft settles to the saved name
FAIL  EP2-storage refused Name edit retains the decoded saved engine name
FAIL  RF0 selected puzzle and engine roots accept real IPC before access loss
````

````json
{
  "purpose": "Negative EP storage staging",
  "trustedNegative": true,
  "isolated": false,
  "actual": {
    "code": 1,
    "signal": null
  },
  "requestedLines": {
    "snapshot": 4159,
    "restore": 4252,
    "finallyEnd": 4255
  },
  "observedLines": {
    "snapshot": 4159,
    "restore": 4252
  },
  "sourcesUnchanged": true,
  "injected": true,
  "restoredBeforeFinally": true,
  "restoredAfterFinally": true,
  "markers": {
    "FAIL  EP1-storage successful Name edit persists the decoded engine name": true,
    "FAIL  EP2-storage refused Name edit retains the decoded saved engine name": true
  },
  "uiAndRefusalPassed": true,
  "unrelatedFailures": [
    "FAIL  RF0 selected puzzle and engine roots accept real IPC before access loss"
  ],
  "verifierRuntimeFailure": false,
  "interrupted": false,
  "deadlineFailure": false,
  "unavailable": null,
  "runtimeFailureStage": null,
  "limitation": "Negative evidence only. Root must run the unchanged verifier green against the restored same candidate."
}
````

### Unchanged ordinary positive

````text
0 permission-positive 70da94b30a0466586475930436c796dc004ccbcf

> chessfable@0.15.0 verify:app /home/felixb/Projekte/chessfable.worktrees/drain
> node scripts/verify-app.mjs

  .. opening seed WebDriver session
  .. seed app and WebKit processes are gone; reusing WebDriver after session quit
  .. conversion disposable inputs: /tmp/chessfable-verify-Ol2lsM/path-owner-fixture/files-workspace/verify-conversion-cancellation.pgn, /tmp/chessfable-verify-Ol2lsM/path-owner-fixture/files-workspace/verify-conversion-seed.pgn
  .. game-opening disposable PGN input: /tmp/chessfable-verify-Ol2lsM/path-owner-fixture/files-workspace/verify-game-opening.pgn
  .. opening assertion WebDriver session with the preserved profile
  ok  production startup reclaims unowned authority and preserves native-owned authority
  ok  startup authority reconciliation deletes no user files
  ok  trusted production startup preserves owned images and cleans only the orphan
  ok  the real Tauri IPC bridge is present (not a test mock)
  ok  the real renderer exposes the ChessFable document title
  ok  progress native event listener registers
  ok  progress start lease has exact canonical string generation
  ..  progress start wire: {"id":"verify-progress:8d4533da-2e93-4f72-b18d-a675b3b87dc0","generation":"1"}
  ok  progress running event has exact canonical string generation
  ok  progress state-update string lease reaches native with exact identity
  ok  progress snapshot has exact canonical string generation
  ok  progress terminal state update accepts the string lease
  ok  progress terminal event has exact canonical string generation
  ok  progress malformed lease rejects without changing the snapshot
  ok  progress invalid clear rejects as a native IPC operation
  ok  progress clear return has exact canonical string generation
  ok  progress cleared event has exact canonical string generation
  ok  progress clear removes the native snapshot
  ok  progress native event listener is released
  ok  the native practice read returns all 12,000 seeded positions
  ok  native practice review paging returns every seeded entry and reaches the oldest review
  ok  the legacy practice deck is migrated into the native store through real IPC
  ok  migration retains the legacy deck capability in path-authority.json
  ok  migration leaves the legacy practice localStorage key untouched
  ok  fifty renderer ratings land in the native practice review store
  ok  renderer ratings do not alter the large deck's 12,000 native positions
  ok  the 50 new native reviews record the panel's Good rating
  ok  renderer ratings create no new legacy key and do not grow the existing key
  ok  list_practice_decks retains the legacy capability after its browser key is removed and fresh startup reconciliation
  ok  the stale-file scenario rewrites the PGN in place
  ok  the open file-backed tab reloads or withholds the changed PGN
  ok  the file freshness transition includes a measured native read_game call
  ok  the freshness transition applies within 1000 ms of the measured read
  info  open file freshness: 2486.6 ms after rewrite (limit 2000 ms + read_game 29.0 ms + apply 636.0 ms; verified)
  ok  the open file-backed tab refreshes within one poll interval plus measured read and apply
  ok  the real sync path stores 500 further repertoire positions
  ok  final restart preserves exact native position and review counts for both decks
  ok  final practice inventory contains no additional native deck
  ok  final migrated-deck counts still equal the legacy value's counts
  ok  real IPC preserves the persisted offline download destination
  ok  real IPC rejects a fresh download destination id
  ok  real IPC rejects a database-root id
  ok  the retained engine LocalImage rendered on the Engines page
  ok  the retained engine LocalImage uses an image/png data URL
  ok  the retained engine LocalImage data URL decodes in WebKitGTK
  ok  EP1-card successful Name edit publishes the saved engine card
  ok  EP1-storage successful Name edit persists the decoded engine name
  ok  EP2-error refused engines storage write reports the save error
  ok  EP2-card refused Name edit retains the saved engine card
  ok  EP2-input refused Name draft settles to the saved name
  ok  EP2-storage refused Name edit retains the decoded saved engine name
  ok  the production CSP rejects a detached blob image URL with an img-src violation
  ok  the renderer cannot resolve a base directory (core:path grants are gone)
  ok  the renderer reaches a live loopback sound-server port
  ok  the loopback sound server serves the bundled standard move sound
  ok  real attachment IPC prepares the exact next durable owner set
  ok  real attachment IPC retires the selected managed image
  ok  retirement preserves image bytes for the live session and records cleanup intent
  ok  the custom title bar rendered its window controls
  ok  the native backend mints an opaque read reservation
  ok  the native backend acknowledges reservation cancellation
  ok  a cancelled reservation cannot be claimed by a later native read
  .. deletion disposable inputs: /tmp/chessfable-verify-Ol2lsM/path-owner-fixture/files-workspace/verify-deletion-outcome.pgn, /tmp/chessfable-verify-Ol2lsM/path-owner-fixture/files-workspace/verify-deletion-outcome.info, /tmp/chessfable-verify-Ol2lsM/path-owner-fixture/files-workspace/verify-sample.pgn
  ok  WD0 deletion fixture acquires a real registered handle before sidecar refusal
  ok  WD1 completed deletion rejects with a structured backend error
  ok  WD2 ordinary post-commit sidecar failure reports partial-removal
  ok  WD3 completed deletion reports exactly one removed primary target
  ok  WD4 post-commit rejection leaves the primary file deleted
  ok  WD5 post-commit deletion preserves the unrelated Files fixture
  ok  WD6 subsequent native listing excludes the deleted handle
  ok  WD7 serialized deletion rejection contains no private fixture path
  ok  the seeded workspace file row renders on the Files page
  ok  a real double-click on the unselected Files row navigates to /
  ok  a real double-click on the unselected Files row shows its game
  ok  GO1 game-opening fixtures contain two distinct native database and PGN games
  ok  DS1 native database storage_size is the exact decimal string of its file length
  ok  LU1 Library has one sidebar destination and one tree containing both native source kinds
  ok  LU2 Library selection switches from file preview to database Explore and actions
  .. game-opening source screenshot: /tmp/chessfable-game-opening-4022015.png.database-card.png
  ok  GO2 the database card has a visible sibling Open database control before selection
  ok  GO3 the labelled database control opens its handle route and synchronizes the database
  ok  DS2 database explorer persists the successful selection with its exact decimal storage_size in plain JSON
  ok  GO4 database single-click selects a preview without admitting a tab
  .. game-opening source screenshot: /tmp/chessfable-game-opening-4022015.png.database-game.png
  ok  GO5 the labelled database game button opens the selected content and origin
  ok  GO6 a fixed-coordinate double-click opens an initially unselected database game
  ok  GO7 row-focused Enter opens the requested database game content and origin
  .. game-opening source screenshot: /tmp/chessfable-game-opening-4022015.png.file-game.png
  ok  GO8 the Files preview has a visible enabled Open game control
  .. GO9 native geometry: {"originalRect":{"x":0,"y":0,"width":800,"height":647},"resizedRect":{"x":0,"y":0,"width":1300,"height":850}}
  .. GO9 restored native geometry: {"x":0,"y":0,"width":800,"height":647}
  ok  GO9 PGN single-click selects without opening and keeps row coordinates stationary
  ok  GO10 the labelled Files game button opens the selected fresh game and explicit index
  ok  GO11 a fixed-coordinate double-click opens an initially unselected non-first PGN game
  ok  GO12 row-focused Enter opens the requested PGN game content and explicit index
  ok  GO13 an empty PGN exposes no working Open game action
  .. game-opening source screenshot: /tmp/chessfable-game-opening-4022015.png.info-panel-discard.png
  .. GO14 owner 185ac66b-3cf9-4008-97e0-b59014c0bc1a, admitted IDs ["63415c09-a77c-4bb4-a846-6fb5b4386d50","5b01552e-a891-4415-87e0-22f53366a887","3f715584-46ba-4f7f-bc98-24b2da28fdcf","f1b2b609-7215-4322-9413-ff826e8b0ea5","8d6678fb-48fa-4715-8358-43d55215e59f","79fa6856-fb33-4206-8f5b-5c0c9d4f34de","185ac66b-3cf9-4008-97e0-b59014c0bc1a"], Event verify:opening-1 -> verify:GO14-unsaved-owner-discard -> verify:opening-0, dirty false -> true -> false, file gameNumber 1 -> 0, confirmation gone
  ok  GO14 confirmed discard replaces the owning current game without admitting a tab
  ok  LC1 accumulated source preserves custom headers, variations, NAGs and provider occurrences
  ok  LC2 linked export is byte-identical to its authoritative PGN
  ok  LC3 restoring the migration archive recovers the independent database version
  ok  LC4 the current search cache indexes exactly the authoritative source generation
  ok  LC5 Database-choice migration preserves the prior PGN bytes
  ok  LC6 Database-choice migration exposes one active chosen version and an inactive preserved original
  ok  LC7 Database-choice migration preserves the original metadata meaning
  ok  LC8 Database-choice migration preserves the complete database version in source and archive
  ok  LC9 Database-choice position search resolves the chosen source generation
  ok  LC10 the preserved original index refuses the previous reference search
  .. linked collection disposable artifacts: {"source":"/tmp/chessfable-verify-Ol2lsM/path-owner-fixture/files-workspace/verify-linked-dcfcda8c-6faf-41ea-80c0-9baa1ec5f535-source.pgn","exported":"/tmp/chessfable-verify-Ol2lsM/path-owner-fixture/files-workspace/verify-linked-dcfcda8c-6faf-41ea-80c0-9baa1ec5f535-exported.pgn","archived":"/tmp/chessfable-verify-Ol2lsM/path-owner-fixture/files-workspace/verify-linked-dcfcda8c-6faf-41ea-80c0-9baa1ec5f535-restored-export.pgn","cache":"/tmp/chessfable-verify-Ol2lsM/.local/share/com.chessriddle.encroissant/collections/f5e8ab9a-9c6f-49b0-8dc6-b840a7e06ea2.db3","search":"/tmp/chessfable-verify-Ol2lsM/path-owner-fixture/files-workspace/verify-linked-dcfcda8c-6faf-41ea-80c0-9baa1ec5f535-search.json","migrationOriginal":"/tmp/chessfable-verify-Ol2lsM/path-owner-fixture/files-workspace/verify-linked-dcfcda8c-6faf-41ea-80c0-9baa1ec5f535-prior-original.pgn","migrationOriginalBefore":"/tmp/chessfable-verify-Ol2lsM/path-owner-fixture/files-workspace/verify-linked-dcfcda8c-6faf-41ea-80c0-9baa1ec5f535-prior-before.pgn","migrationChosen":"/tmp/chessfable-verify-Ol2lsM/path-owner-fixture/files-workspace/verify-linked-dcfcda8c-6faf-41ea-80c0-9baa1ec5f535-database-chosen.pgn","migrationExpectedDatabase":"/tmp/chessfable-verify-Ol2lsM/path-owner-fixture/files-workspace/verify-linked-dcfcda8c-6faf-41ea-80c0-9baa1ec5f535-database-choice-expected.pgn","migrationArchiveExport":"/tmp/chessfable-verify-Ol2lsM/path-owner-fixture/files-workspace/verify-linked-dcfcda8c-6faf-41ea-80c0-9baa1ec5f535-database-choice-archive.pgn","migrationDisposition":"/tmp/chessfable-verify-Ol2lsM/path-owner-fixture/files-workspace/verify-linked-dcfcda8c-6faf-41ea-80c0-9baa1ec5f535-database-choice-disposition.json","migrationSearch":"/tmp/chessfable-verify-Ol2lsM/path-owner-fixture/files-workspace/verify-linked-dcfcda8c-6faf-41ea-80c0-9baa1ec5f535-database-choice-search.json"}
  ok  CC0 conversion fixture seeds exactly one native game
  ok  CC1 prepared conversion cancellation returns typed Cancellation before claim
  ok  CC2 native progress triggers running and same-target queued ticket cancellation
  ok  CC3 cancelled native imports preserve existing content and DataRevision
  ok  CC4 a fresh conversion ticket retries successfully after cancellation
  ok  CC5 settled native conversion tickets are retired
  ok  the $8 board hint is rendered with a glyph path
  ok  the $8 board hint SVG title is □
  ok  the $8 board hint has a visible box and positive opacity through its board ancestors
  ok  the unknown $220 renders no board annotation hint
  ok  SAVE_FILE writes Nc3?! to the seeded NAG file
  ok  the saved NAG game preserves $8
  ok  the saved NAG game preserves $11
  ok  the saved NAG game preserves d4! $2
  ok  the saved NAG game preserves $220
  ok  the Files metadata edit submits without a dialog error
  ok  the Repertoire filter lists the metadata-edited workspace file
  ok  the metadata-edited workspace sidecar records repertoire on disk
  ok  the Files metadata edit preserves the PGN filename
  ok  a second process on the same app-data directory is refused before initialization
  ok  the refused launch leaves authority and credential registry bytes unchanged
  ok  the primary still answers WebDriver after the refused launch
  ok  a second process sharing only the configuration directory is refused
  ok  a process on a different app-data directory initializes while the primary runs
  ok  a real document reload cancels the previous document's retained reservation
  ok  a real document reload preserves both exact seeded workspace tab identities
  ok  a real document reload selects the second seeded workspace tab
  .. root-permission disposable inputs: /tmp/chessfable-verify-Ol2lsM/path-owner-fixture/permission-puzzles, /tmp/chessfable-verify-Ol2lsM/path-owner-fixture/permission-engines, /tmp/chessfable-verify-Ol2lsM/path-owner-fixture/permission-engines/blocked-child
  ok  RF0 selected puzzle and engine roots accept real IPC before access loss
  ok  RF1 puzzle read denial preserves Permission and I/O failure with a permission root label
  ok  RF5 puzzle permission guidance is visible through the actual renderer
  ok  RF2 engine destination read denial preserves Permission and I/O failure with a permission root label
  ok  RF6 Add permission guidance is visible through the actual renderer
  ok  RF3 public engine workflow root search denial preserves Permission and I/O failure with a permission root label
  ok  RF7 permission failures retain saved engines and unrelated filesystem bytes
  ok  RF8 restoring access recovers the same selected roots
  ok  a native read reservation is retained until titlebar close
  ok  the application process is running before the close
  ok  application pid 4024556 and recorded WebKit service pids [4024603, 4024636] do not exist after the close
  ok  the real destroyed-window event cancels the exact retained main-webview reservation
  ok  the shutdown sequence started
  ok  the shutdown cleanup ran to completion inside its budget
  ok  the sound server shutdown was signalled
  ok  titlebar shutdown removes retired image bytes and intent while retaining the owner

shutdown log:
  [2026-10-23][14:20:39][chessfable::sound::server][INFO] Sound server prepared on port 33107
  [2026-10-23][14:23:33][chessfable][INFO] Shutdown requested: terminating engines and live games
  [2026-10-23][14:23:33][chessfable][INFO] Sound server shutdown signalled
  [2026-10-23][14:23:33][chessfable][INFO] Shutdown cleanup finished
  [2026-10-23][14:23:34][chessfable::sound::server][INFO] Sound server prepared on port 46045
  [2026-10-23][14:23:35][chessfable][INFO] Shutdown requested: terminating engines and live games
  [2026-10-23][14:23:35][chessfable][INFO] Sound server shutdown signalled
  [2026-10-23][14:23:35][chessfable][INFO] Shutdown cleanup finished
  [2026-10-23][14:23:35][chessfable::sound::server][INFO] Sound server prepared on port 45667
  [2026-10-23][14:23:44][chessfable][INFO] Shutdown requested: terminating engines and live games
  [2026-10-23][14:23:44][chessfable][INFO] Sound server shutdown signalled
  [2026-10-23][14:23:44][chessfable][INFO] Shutdown cleanup finished
  [2026-10-23][14:23:45][chessfable::sound::server][INFO] Sound server prepared on port 46247
  [2026-10-23][14:25:23][chessfable][INFO] Shutdown requested: terminating engines and live games
  [2026-10-23][14:25:23][chessfable][INFO] Sound server shutdown signalled
  [2026-10-23][14:25:23][chessfable][INFO] Shutdown cleanup finished
  ok  default-root-unusable: the Databases alert offers a visible folder chooser
  ok  selected-root-missing: the Databases alert offers a visible folder chooser without recreating db

all checks passed
````

Plan authorship and arbitration shared one context. Detection ran on the same model family as code. Source-only comment provenance does not claim additional product behavior or new diagnostic failure coverage.

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

## Source closure round 2 arbitration

Reviewed through c799f1ed8baff466028b417496b0e3933a94da12, delta 111d212d..c799f1ed with full c4da644f..c799f1ed context. All eleven source sessions completed and every report was read. Ten approved, code-quality requested revision. All prior source adoptions closed. Three further code-quality findings from original commit 111d212d were adopted as Fix, with no Skip or Defer. R2 stage wall was 569 seconds including arbitration, active wall is unknown. The preserved source reports below are the actual raw results.

- Q4, src-tauri/src/infra/completions.rs:54, blocker. Fix by naming existing admission byte limits 256, 4096 and 1024, preserving their field grouping and the SHA-256 length.
- Q5, src-tauri/src/fs.rs:1550, blocker. Fix by naming existing progress values 0.9 and 95.0 and explaining their allocation.
- Q6, src/state/engineCompletions.ts:93, nit. Fix the process-lifetime mailbox comment from durable to retained.

The bounded Codex source worker changed only those three paths. Rust formatting and cargo check --locked --tests passed. The diff preserves every value, comparison, caller, assertion and runtime branch. The root owns source closure and final gates. Plan authorship and arbitration shared one context. Detection ran on the same model family as code, with fresh-context separation only.

### Source round 2: correctness

````text
C1 CLOSED — Retained failures preserve the ordinary safe payload, including exact `"Cancellation"` handling.

C2 CLOSED — A captured failed response still rejects when another observer has already acknowledged its native record.

I1 CLOSED — Native code captures the terminal snapshot before emission and returns it directly, eliminating the removable-mailbox lookup race.

No further correctness defects found in the repair delta or traced caller paths. The shared decoder and termination observer preserve their preceding behavior.

Limitations (confidence: 100): read-only source and recorded-evidence review. No runtime, browser or gates executed here. Windows/macOS runtime branches remain unverified locally. Pre-review Axp415 records completion `0`. No files changed.

Implementation: Codex gpt-6.1-sol/high. Detection: fresh-context Codex gpt-6.1-sol/medium, the same model family. Plan authorship and arbitration shared one context.

VERDICT: APPROVED
````

### Source round 2: root-cause

````text
No root-cause or prior-fix regression findings.

- C1/E1 CLOSED — retained failures use the ordinary renderer-safe payload, preserving `Cancellation`, HTTP guidance and engine failure details.
- C2/I1 CLOSED — native code captures the terminal response before event emission. Renderer application preserves its rejection after acknowledgement removes the mailbox entry. Counterfactuals fail before restoration and pass afterward.
- Prior root-cause proof limitation CLOSED for the measured real Add workflow — WebKitGTK replacement preserves native operation identity and automatically registers, persists and acknowledges the result. Event-off and startup-off controls fail distinctly, then restored runs pass.

The original cause was a renderer-owned continuation disappearing while accepted native work survived. Native completion ownership, atomic owner receipts and shared replay application address that mechanism across Add and Upgrade. History inspection found no reintroduction of typed-retirement, safe-error or persistence defects.

Confirmed clean worktree and Axp415 completion 0. Read-only inspection covered native workflow, renderer coordinator, owner storage, callers, tests, verifier evidence and relevant history. No files changed or gates run.

Limitations (confidence: 100): the compact runtime proof covers Add’s five semantic assertions. Final browser/pixel/full gates and hosted platform runtime checks remain delivery obligations. Account Phase2 remains untouched and the overall finding stays open.

Implementation used Codex gpt-6.1-sol/high. Fresh detection used Codex gpt-6.1-sol/medium, within the same OpenAI family. This review provides no independent-family assurance. Plan authorship and arbitration shared one context.

VERDICT: APPROVED
````

### Source round 2: tests

````text
T1 CLOSED — The real WebKitGTK probe observes the same running operation across document replacement and asserts matching event delivery, one persisted UUID, one visible card, acknowledgement and usable native handle. Event-disabled and startup-disabled controls produce distinct semantic failures at exit 1. Exact restorations pass at exit 0.

T2 CLOSED — The replacement tests remove independent publication/session protection, assert retained capability usability and catalog bytes, then assert collection after exact release. Reversing each production retention guard produces its corresponding assertion failure at exit 101, restored at 0.

T3 CLOSED — The new test completes native work during asynchronous subscription setup and asserts application and acknowledgement. Reversing subscription/snapshot ordering fails the persisted-engine assertion at exit 1, restored at 0.

The repair assertions also distinguish lost caller rejections, altered cancellation/payload guidance, duplicate notifications and acknowledgement-before-report ordering. Test selectors include these tests in the normal frontend/backend gates. Axp415 records actual completion 0.

Limitations (confidence: 100): I inspected source and recorded evidence without executing tests. The compact probe and permission stages establish their stated semantic checks, not complete defensive failure matrices. Final browser/pixel/full gates and hosted Windows/macOS runtime proof remain outstanding delivery obligations.

Implementation used Codex gpt-6.1-sol/high. Detection used fresh read-only Codex gpt-6.1-sol/medium, providing session separation within the same model family. Plan authorship and arbitration shared one context.

VERDICT: APPROVED
````

### Source round 2: error-handling

````text
E1 CLOSED — Retained failures reuse `Error.renderer_payload`, preserving cancellation, HTTP guidance, root labels and engine diagnostics through notification and caller rejection.

Related error-path repairs CLOSED:
- C1: Cancellation retains its exact existing contract.
- C2: An acknowledged failure still rejects later callers.
- IPC I1: The native command returns its captured terminal snapshot without rereading the acknowledged mailbox.

Inspected native completion production, retention, retirement and acknowledgement, renderer application, owner storage, notification handling, and their regression assertions. No new error-handling defects found.

Confirmed clean worktree and `gate-permission-final-pre-review.Axp415/completion.record` exit 0. No files changed, gates run or runtime probes executed.

Limitation (confidence: 100): this closure does not establish final browser, full-gate or Windows/macOS runtime completion. Account Phase2 and the overall finding remain open.

Implementation used Codex gpt-6.1-sol/high. Detection used a fresh Codex gpt-6.1-sol/medium context from the same model family, without family separation. Plan authorship and arbitration shared one context.

VERDICT: APPROVED
````

### Source round 2: ipc-contract

````text
I1 CLOSED — `fs.rs:1690` captures the terminal snapshot before emitting `CompletionChanged` and returns it directly. Renderer acknowledgement in `engineCompletions.ts` can remove the mailbox entry without breaking the command response. The regression test at `fs.rs:9911` exercises that ordering.

No further IPC defects found. Both ends agree on command keys, retained error payloads and progress units. The new event and commands are Specta-registered, subscriptions have cleanup, and capability scopes are unchanged.

Read-only review. No files changed or gates run. Axp415 records completion code 0. Final delivery gates remain outside this review.

Implementation: Codex gpt-6.1-sol/high. Detection: fresh Codex gpt-6.1-sol/medium, the same model family. Plan authorship and arbitration shared one context.

VERDICT: APPROVED
````

### Source round 2: persisted-state

````text
No in-scope defects found. R1 had no persistence adoptions requiring closure.

Traced all three owner keys through writes, legacy hydration, startup inspection and replay. Values and receipts remain atomic, compressed and bounded. Replay guards preserve later deletions and player choices. The shared decoder also serves the real verifier.

Confirmed `gate-permission-final-pre-review.Axp415/completion.record` reports exit 0. Read-only source review only. No files changed, gates run or runtime verification performed.

Implementation and detection use the same model family, providing fresh-context separation only. Plan authorship and arbitration shared one context.

VERDICT: APPROVED
````

### Source round 2: minimalism

````text
M1 CLOSED — `src-tauri/src/engine/process.rs:3161` now owns pending-termination observation for both retirement recovery and drain. Capture and retry policies remain with their callers.

M2 CLOSED — `src-tauri/src/fs.rs:1453` requires `ProgressLease`. The unused optional-progress fallback and standalone-success branches are removed, and archive tests use the workflow contract.

No new bloat or duplication findings meet the reporting threshold.

Added-file minimum-diff counterfactuals:

- `engineOwnerEnvelope.ts`: retain one pure decoder shared by storage, hydration and the real verifier.
- `infra/completions.rs`: retain the concrete request, result and application types.
- `infra/reload_completion_tests.rs`: retain receiver-loss, mailbox and retirement boundary coverage.
- `catalogEngineCompletion.ts`: retain the shared Add/Upgrade adapter.
- `engineCompletions.ts`: retain the shared replay/application coordinator.
- `engineCompletions.test.ts`: retain the distinct persistence and observation-order cases.
- `engineInstall.ts`: retain native request construction.

No further substantive deletion is established for those files. The new reservation-claim type has two callers, and ordinary and retained native failures share `Error.renderer_payload`.

Axp415’s completion record reports exit 0. The current worktree is clean. This review changed nothing and ran no gates. Final browser, full-gate and hosted native delivery obligations remain outside this approval.

Implementation used Codex gpt-6.1-sol/high. Fresh detection used Codex gpt-6.1-sol/medium, providing session separation without model-family separation. Plan authorship and arbitration shared one context.

VERDICT: APPROVED
````

### Source round 2: code-quality

````text
Q1 CLOSED — Configuration retention uses `MAX_RETAINED_ENGINE_CONFIGURATION_BYTES`.

Q2 CLOSED — `MAX_ENGINE_COMPLETION_RECEIPTS` names the renderer bound and documents its relationship to native capacity.

Q3 CLOSED — Both newly introduced helper suppressions were removed through concrete inputs. The archive-core suppression predates this implementation.

Additional cumulative-context findings from `111d212d`:

[blocker] src-tauri/src/infra/completions.rs:54 — Request admission uses unnamed byte budgets `256`, `4096` and `1024` across identity and metadata fields. These determine whether installation is accepted. Name the budgets and make intentional sharing explicit, following `MAX_ACCEPTED_OPERATIONS` in sibling `operations.rs` and `MAX_ARCHIVE_PATH_BYTES` in `fs.rs`. (confidence: 99)

[blocker] src-tauri/src/fs.rs:1550 — `0.9` allocates download progress, while `95.0` at line 1800 marks configuration completion. Neither milestone is named or explains the remaining application allocation. Name these workflow progress milestones so their relationship is clear. (confidence: 95)

[nit] src/state/engineCompletions.ts:93 — “last durable copy” describes a process-lifetime native mailbox. That contradicts `infra/completions.rs` and d-20261023-03, which provide no persistence across process exit. Use “last retained copy.” (confidence: 99)

Reviewed repair source, cumulative caller paths and neighboring implementations. No files changed or gates run. `Axp415/completion.record` reports exit 0.

Implementation used Codex gpt-6.1-sol/high. This fresh read-only detection used Codex gpt-6.1-sol/medium, the same model family, without independent-family assurance. Plan authorship and arbitration shared one context.

VERDICT: REVISE
````

### Source round 2: engine-protocol

````text
No in-scope defects found.

- I2 remains closed. Retirement captures original generations once under the publication barrier. Recovery observes those targets without recapturing newer actors or replaying tombstone transitions.
- M1’s shared termination observer preserves actor key, generation and cleanup failures for both callers.
- Traced analysis, game, report and configuration-probe paths retain process ownership and result guards. No new ownership gap or stale-result attribution found.

The original engine-protocol R1 report adopted no findings. Inspected the supervisor, native completion/application callers, renderer coordinator and evaluation listener. Worktree remained clean. Axp415 records completion status 0. No files changed, processes launched or gates run. Final delivery verification remains outstanding.

Implementation provenance: Codex gpt-6.1-sol/high. Detection: fresh Codex gpt-6.1-sol/medium, the same model family, with no independent-family assurance. Plan authorship and arbitration shared one context.

VERDICT: APPROVED
````

### Source round 2: tauri-security

````text
No in-scope security defects found in `111d212d..HEAD`, reviewed against cumulative `c4da644f..HEAD` context.

R1 adopted security findings: none. Inspected install callers, retained completion/error payloads, authority registration and retention, archive extraction/publication, recursive cleanup, and signature/digest enforcement. No bearer-token return, raw diagnostic exposure, authority escape or unsigned-install bypass was identified.

Confirmed `gate-permission-final-pre-review.Axp415/completion.record` records exit 0. This was static, read-only review. No files changed, gates run or applications launched. Credential/session persistence is unchanged, and no refresh flow was introduced. Account Phase2 and hosted platform runtime verification remain outside this review’s completion claim.

Implementation used Codex gpt-6.1-sol/high and detection used Codex gpt-6.1-sol/medium. They share the OpenAI model family, so independent-family assurance is absent. Plan authorship and arbitration also shared one context.

VERDICT: APPROVED
````

### Source round 2: platform-semantics

````text
No concrete platform-semantics defects found in `111d212d..HEAD`, with cumulative context from `c4da644f..HEAD`. R1 adopted no findings in this class, so no platform adoption remains open.

Inspected native completion, retirement, authority retention, filesystem fixtures, renderer recovery and verifier changes. New permission-test guards match their Unix-only dependencies. Retention tests use authority-issued handles and canonical fixture paths.

Evidence limits:

- Axp415’s completion record reports exit 0, including `windows-clippy`.
- Recorded `pnpm rust:windows:check` passed. This establishes GNU compilation and linting only.
- No non-Linux Unix source-probe result was found in the supplied evidence. None ran here.
- Windows/macOS runtime proof remains required from `rust-windows-test` and `rust-macos-test`. The `rust-platform` matrix supplies compilation and linting.
- The actual install-to-UCI native regression remains Unix-only.

Read-only review. No files changed, gates run or applications launched. Final delivery verification remains outstanding.

Implementation used Codex gpt-6.1-sol/high. Detection used a fresh Codex gpt-6.1-sol/medium context, providing session separation without independent-family assurance. Plan authorship and arbitration shared one context.

VERDICT: APPROVED
````

## Recovery execution corrections

The original Grok controller was resumed at 15:02:57 UTC during this interactive Codex recovery. The existing build lock still belonged to Codex PID 3807526, acquired at 10:57:45 UTC. The resumed supervisor PID 4049451 and Grok PID 4050122 proceeded through the second source review and the bounded Codex naming repair. They also replaced five prepared third-round prompt files while this root was preparing its own closure packet. No third-round lens had launched, and the three source changes matched the authorized naming repair.

Root detected the overlap by comparing source status, prompt modification times, the build-lock owner and exact process identities. It requested the official checkout-specific stop and then used the documented first interrupt on the identified original supervisor. Both the supervisor and Grok process exited. The build lock remained with this Codex session, all source and reports were preserved, and the separately running side-lane drain was untouched. The unexecuted Grok prompt drafts were preserved in the run scratch directory before this root rebuilt the closure packet. The old controller's stage history is preserved. Subsequent root stages use the separate codex-steps file under the recovery scratch directory. There was no new Grok resume.

Canonical named-bounds-pre-review.Tkg5VA is a stopped red attempt, with synthetic death status 125. The ordinary dry run passed all 3167 tests, but the kernel killed two Stryker workers inside the exact 11596410880-byte gate scope. This recurrence was annotated onto existing open f-20261022-05 in c0ddc6b6. The owned wrapper group, runner and child were proven gone, its scope became inactive and its mutation fence was cleaned up before retry. Raw worker and kernel evidence remain in that attempt directory.

The retry uses the existing GATE_MEMORY_BYTES=6442450944 shell setting. The unchanged sizing functions resolve that budget to one mutation package and four test runners. It does not change the actual cgroup limit, test selection, mutation thresholds or timeouts. It is a recovery-only scheduling setting, removed when this run ends, with the general accounting investigation still open. The retry's final result is recorded separately after completion, never inferred from interim progress.

The first remote-CI preflight returned exit 2 because gh run view timed out. Its second invocation completed exit 0 and reported that all newest completed Test jobs succeeded on master. That successful retry supersedes the earlier unread-precondition checkpoint. A fresh preflight remains required immediately before push.

Plan authorship and arbitration shared one context. Detection ran on the same model family as code. The original planning and resumed overlapping controller were Grok, with Codex source workers and lenses. This interactive Codex root retained build ownership, inspected all returned changes and reports, and owns the remaining verification and release. No independent-family detection is claimed.

## Source closure round 3 arbitration

Reviewed through 135b9d65048f994ee0613c5ffcfbd082a930b0bf, delta c799f1ed..135b9d65 with cumulative c4da644f..135b9d65 context. All six canonical read-only sessions completed and every report was read. Correctness, root-cause, tests, code-quality, IPC and Tauri security approved. Q4, Q5 and Q6 are closed with their original values, types, field groupings and behavior preserved. No new finding, Skip or Defer was adopted. The cumulative adoption counts are r1=15 r2=3 r3=0. R3 stage wall was 209 seconds including arbitration, active wall is unknown. Prior R1 source issues remain closed by R2 and R3. Records are reviewed separately.

Canonical named-bounds-budget-pre-review.vhNjoK completed 0 before the source commit. All selected lanes passed. Mutation took 1168.2 seconds. Workspace-storage scored 100% with 1233 killed, zero timeouts and zero survivors. Tree-path also scored 100% with zero survivors. This bounded retry is distinct from the stopped Tkg5VA attempt. Interim cgroup counters were all zero, and the kernel journal had no OOM kill for the exact retry scope during its run.

Final browser verification, full clean gates, push, required hosted jobs and installation remain pending at this review checkpoint. Overall f-20261005-05 remains open for account Phase2. Plan authorship and arbitration shared one context. Detection ran on the same model family as code.

### Source round 3: correctness

````text
Q4 CLOSED — All admission limits retain their original byte values, field grouping and inclusive boundaries. SHA length remains 64.

Q5 CLOSED — Both constants are `f32`, preserving download scaling to 90 and configuration progress at 95.

Q6 CLOSED — “Retained copy” matches the process-lifetime mailbox contract.

C1/C2/I1 remain CLOSED. No correctness regressions found in the three changed source files or traced dependencies. Actual `vhNjoK/completion.record` reports exit 0.

Limitations (confidence: 100): read-only source review. No tests, gates or apps run. Final browser and Windows/macOS runtime verification remain pending. No files changed.

Implementation: Codex gpt-6.1-sol/high. Detection: fresh-context Codex gpt-6.1-sol/medium, the same model family. Plan authorship and arbitration shared one context.

VERDICT: APPROVED
````

### Source round 3: root-cause

````text
Q4 CLOSED — Admission budgets remain 256/4096/1024 bytes with identical field grouping. SHA-256 length remains 64.

Q5 CLOSED — Both progress milestones are named `f32` constants retaining 0.9/95.0. The comment explains the allocation through renderer application.

Q6 CLOSED — “Last retained copy” accurately describes the process-lifetime mailbox.

Prior C1/E1 and C2/I1 closures remain intact. The original failure chain was native work surviving document loss while its renderer continuation disappeared. Native completion ownership and replay application address that cause. This delta preserves terminal capture before event emission, safe failure payloads and reporting before acknowledgement.

No symptom-patching or prior-fix regression found. Enclosing paths, sibling uses, blame and line history show unchanged admission predicates, progress arithmetic and completion behavior.

Verified `gate-named-bounds-budget-pre-review.vhNjoK/completion.record` reports exit 0. Inspected the three source files, operation-registry dependencies, named rules, prior reports and evidence records. No files changed or gates run.

Limitation (confidence: 100): historical runtime controls cover five compact semantic assertions and four RF assertions, not complete diagnostic matrices. Final browser verification, full gates, hosted platform jobs, push and install remain pending. Account Phase2 remains untouched.

Implementation used Codex gpt-6.1-sol/high. Fresh read-only detection used Codex gpt-6.1-sol/medium, the same model family, without independent-family assurance. Plan authorship and arbitration shared one context.

VERDICT: APPROVED
````

### Source round 3: tests

````text
Q4 CLOSED — Named admission budgets preserve every field grouping, threshold and SHA length check.

Q5 CLOSED — Both f32 progress constants preserve existing values and explain the allocation.

Q6 CLOSED — “Retained” accurately describes the process-lifetime mailbox.

T1/T2/T3 remain CLOSED. The inspected assertions distinguish missing native recovery, premature resource collection and subscription-gap loss. Their recorded production reversals fail. Normal test selectors include the regression tests.

No new verification defect found. Reverting this naming/comment-only delta preserves behavior, so no additional behavioral assertion is warranted.

Limitations (confidence: 100): No tests executed during this review. Pre-review completion records exit 0. Historical probes establish bounded semantic assertions, not complete diagnostic matrices. Final browser verification, full gates and hosted platform proof remain pending.

Implementation: Codex gpt-6.1-sol/high. Detection: fresh read-only Codex gpt-6.1-sol/medium, same model family with session separation only. Plan authorship and arbitration shared one context.

VERDICT: APPROVED
````

### Source round 3: code-quality

````text
Q4 CLOSED — Admission limits 256/4096/1024 now have named byte constants and explicitly intentional sharing. Field grouping and SHA-256 length remain unchanged.

Q5 CLOSED — Both progress values have `f32` constants. The comment explains download allocation, configuration readiness and the remaining renderer application slice.

Q6 CLOSED — “Last retained copy” matches the process-lifetime mailbox and d-20261023-03.

No new readability or local-consistency defects found in the repair and affected paths. The actual `vhNjoK/completion.record` reports exit 0. No files changed or gates run.

Implementation: Codex gpt-6.1-sol/high. Fresh read-only detection: Codex gpt-6.1-sol/medium, the same model family, without family-level independence. Plan authorship and arbitration shared one context.

VERDICT: APPROVED
````

### Source round 3: ipc-contract

````text
I1 CLOSED — Rust captures the terminal response before emitting `CompletionChanged`. Renderer acknowledgement cannot invalidate that response.

Q4 CLOSED — Named admission limits preserve field grouping and the 64-byte SHA requirement.
Q5 CLOSED — Named `f32` milestones preserve percentage units and explain the renderer allocation.
Q6 CLOSED — “Retained” correctly describes the process-lifetime mailbox.

No IPC defects found. Commands and events remain Specta-registered, caller keys and payloads agree, listener cleanup remains intact, and capability scopes are unchanged.

Pre-review `vhNjoK/completion.record` reports exit 0. Read-only review, no files changed or gates run. Final delivery verification remains pending.

Implementation: Codex gpt-6.1-sol/high. Detection: fresh Codex gpt-6.1-sol/medium, same model family with session-level separation only. Plan authorship and arbitration shared one context.

VERDICT: APPROVED
````

### Source round 3: tauri-security

````text
No in-scope security defects found in `c799f1ed..HEAD`, with cumulative context inspected.

Q4 CLOSED — Admission budgets retain values 256/4096/1024, identical field grouping and SHA length 64.
Q5 CLOSED — Named `f32` progress constants preserve 0.9/95.0 and explain the remaining allocation.
Q6 CLOSED — “Retained” accurately describes the process-lifetime mailbox.

No security adoptions remained from R2. Signature verification, digest-gated extraction, authority-checked registration and safe retained-error conversion remain enforced. Credential/session persistence is unchanged. No refresh flow was introduced.

Confirmed `gate-named-bounds-budget-pre-review.vhNjoK/completion.record` records exit 0. Review was read-only. No files changed or gates run. Final runtime/platform verification remains pending.

Implementation: Codex gpt-6.1-sol/high. Detection: fresh read-only Codex gpt-6.1-sol/medium, the same model family, without independent-family assurance. Plan authorship and arbitration shared one context.

VERDICT: APPROVED
````
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

