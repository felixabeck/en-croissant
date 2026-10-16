import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  CHILD_TERMINATION_TIMEOUT_MS,
  installMultiChildSignalForwarding,
  signalExitCode,
  superviseChild,
} from "./child-supervisor.mjs";
import { LOG_TAIL_BYTES } from "./gate-logs.mjs";

const TEST =
  "fs::tests::catalog_network::real_signed_catalog_engines_install_register_and_configure";
const root = fileURLToPath(new URL("../", import.meta.url));
const cargo = [
  "test",
  "--manifest-path",
  "src-tauri/Cargo.toml",
  "--locked",
  "--bin",
  "chessfable",
  "--features",
  "catalog-network-tests",
  TEST,
  "--",
  "--exact",
];
// Bound both captured and emitted command output. Continue draining on overflow so native
// ownership can finish, then fail. CI's finite job timeout is the external last resort.
const OUTPUT_LIMIT = 128 * LOG_TAIL_BYTES;
const forwarding = installMultiChildSignalForwarding({ label: "catalog verification" });

async function run(args, stage) {
  console.log(`CATALOG_COMMAND ${stage}: cargo ${args.join(" ")}`);
  const child = spawn("cargo", args, { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
  const supervisor = superviseChild(child, { terminationTimeoutMs: CHILD_TERMINATION_TIMEOUT_MS });
  forwarding.attach(supervisor, stage);
  let bytes = 0;
  let stdout = "";
  let overflow = false;
  const capture = (chunk, output, collect) => {
    const available = Math.max(0, OUTPUT_LIMIT - bytes);
    bytes += chunk.length;
    const bounded = chunk.subarray(0, available);
    output.write(bounded);
    if (collect) stdout += bounded.toString("utf8");
    if (bytes > OUTPUT_LIMIT) overflow = true;
  };
  child.stdout.on("data", (chunk) => capture(chunk, process.stdout, true));
  child.stderr.on("data", (chunk) => capture(chunk, process.stderr, false));
  const result = await supervisor.done;
  console.log(`CATALOG_STATUS ${stage}: code=${result.code} signal=${result.signal}`);
  if (result.error) throw new Error(`${stage}: cargo could not start: ${result.error.message}`);
  if (result.signal) throw new Error(`${stage}: cargo terminated by ${result.signal}`);
  if (result.code !== 0) throw new Error(`${stage}: cargo exited ${result.code}`);
  if (overflow) throw new Error(`${stage}: output exceeded ${OUTPUT_LIMIT} bytes`);
  return stdout;
}

try {
  const listing = await run([...cargo, "--list", "--format", "terse"], "discovery");
  const tests = listing.split(/\r?\n/u).filter((line) => /: (test|benchmark)$/u.test(line));
  if (tests.length !== 1 || tests[0] !== `${TEST}: test`) {
    throw new Error(`discovery: expected exactly one runnable test ${TEST}, found ${tests.length}`);
  }
  if (forwarding.requestedReason !== undefined) throw new Error("discovery: interrupted");
  const output = await run([...cargo, "--nocapture", "--test-threads=1"], "execution");
  if (
    !/^test result: ok\. 1 passed; 0 failed; 0 ignored; 0 measured; \d+ filtered out;/mu.test(
      output,
    )
  ) {
    throw new Error("execution: expected exactly one passed test with zero ignored tests");
  }
} catch (error) {
  console.error(`CATALOG_FAIL ${error.message}`);
  process.exitCode = 1;
} finally {
  await forwarding.termination;
  if (forwarding.requestedSignal) process.exitCode = signalExitCode(forwarding.requestedSignal);
  forwarding.uninstall();
}
