// Runs cargo-mutants over eight narrowly scoped packages.
//
// `--in-place` mutates the real working tree. The runner therefore refuses a dirty
// backend, holds a durable fence while cargo-mutants owns the tree, and clears that
// fence only after proving that no tracked backend file still carries its marker.
// If a run is interrupted before it can finalise, rerun this command (or use
// `--check-guard`) for an ordered, path-specific recovery procedure.
import { spawn, spawnSync } from "node:child_process";
import {
  closeSync,
  existsSync,
  ftruncateSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import { dirname } from "node:path";
import { installSignalForwarding, superviseChild } from "./child-supervisor.mjs";
import { fsyncDirectory } from "./fsync-directory.mjs";
import { identityForPid, identityIsLive } from "./process-identity.mjs";

const fencePath = "mutants.out/backend/.mutation-in-progress";
const mutationMarker = "~ changed by cargo-mutants ~";
const terminationTimeoutMs = 2_000;
// Give each cargo-mutants test at least this many seconds before timing it out.
const minimumTestTimeoutSeconds = 30;

const mutationPackages = [
  {
    id: "database-encoding",
    file: "src/db/encoding.rs",
    functions:
      "encode_move|decode_move|encode_comment|encode_nag|MainlineMoveBytesIter|try_iter_mainline_move_bytes|decode_game|render_nodes",
    test: "db::encoding::tests",
  },
  {
    id: "database-search",
    file: "src/db/search.rs",
    functions:
      "PositionQuery::matches|MaterialQuery::is_reachable_by|MaterialQuery::can_reach|is_end_reachable|is_material_reachable|is_contained|matches_date|parse_wanted_result",
    test: "db::search::tests",
  },
  {
    id: "engine-protocol",
    file: "src/engine/types.rs",
    functions: "validate_uci_text",
    test: "engine::types::tests",
  },
  {
    id: "download-policy",
    file: "src/fs.rs",
    functions:
      "DownloadOperation::from_id|DownloadOperation::max_size|DownloadOperation::payload_format|DownloadOperation::limits|validate_download_url|is_bearer_origin|validate_archive_path",
    test: "fs::tests",
  },
  {
    id: "game-rules",
    file: "src/game.rs",
    functions:
      "validate_time_controls|GameController::apply_move|GameController::check_game_end|GameController::settle_active_clock|GameController::get_current_times|GameController::end_game|split_epd_position_and_operations|validate_epd_operations|normalize_polyglot_uci|choose_weighted_index|choose_weighted_target|opening_book_ext",
    test: "game::tests",
  },
  {
    id: "path-authority",
    file: "src/infra/path_authority.rs",
    functions:
      "class_is_root|is_write_operation|validate_persisted_shape|PathAuthority::validate_components",
    test: "infra::path_authority::tests",
  },
  { id: "lexer", file: "src/lexer.rs", functions: "Lexer|lex_pgn_sync", test: "lexer::tests" },
  {
    id: "pgn-parser",
    file: "src/pgn.rs",
    functions:
      "is_tag_header|update_brace_comment|read_bounded_line|validate_game_count|scan_games|checked_index|checked_range",
    test: "pgn::tests",
  },
];

// `--list-packages` must remain side-effect free: the workflow uses it before a
// checkout has installed cargo-mutants or created the output directory.
if (process.argv.includes("--list-packages")) {
  console.log(JSON.stringify(mutationPackages.map(({ id }) => id)));
  process.exit(0);
}

function runGit(args) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.error) throw result.error;
  return result;
}

function trackedMutationFiles() {
  const result = runGit(["grep", "-l", "-F", mutationMarker, "--", "src-tauri"]);
  if (result.status === 1) return [];
  if (result.status !== 0) {
    throw new Error(
      `git grep failed while checking for cargo-mutants markers (exit ${result.status}): ${result.stderr.trim()}`,
    );
  }
  return result.stdout.trim().split("\n").filter(Boolean);
}

function shellQuote(path) {
  return `'${path.replaceAll("'", `'\\''`)}'`;
}

function recordedIdentity() {
  try {
    const record = readFileSync(fencePath, "utf8");
    const pidMatch = record.match(/^pid=(\d+)$/m);
    if (!pidMatch) return undefined;
    const startTimeMatch = record.match(/^pidStartTime=(\S+)$/m);
    return {
      pid: Number(pidMatch[1]),
      ...(startTimeMatch ? { startTime: startTimeMatch[1] } : {}),
    };
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    return undefined;
  }
}

function printRecovery() {
  let identity;
  let identityError;
  try {
    identity = recordedIdentity();
  } catch (error) {
    identityError = error;
  }
  let markedFiles = [];
  let scanError;
  try {
    markedFiles = trackedMutationFiles();
  } catch (error) {
    scanError = error;
  }

  console.error(`Backend mutation fence exists: ${fencePath}`);
  console.error("Recovery procedure:");
  console.error("1. Confirm no `cargo mutants` process is running, and terminate it if one is.");
  if (identity !== undefined) {
    try {
      console.error(
        `   Recorded cargo pid: ${identity.pid}; currently alive: ${identityIsLive(identity) ? "yes" : "no"}.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        `   Recorded cargo pid: ${identity.pid}; currently alive: unknown (${message}).`,
      );
    }
  } else {
    console.error("   No cargo child pid was recorded; inspect the process list by command name.");
    if (identityError) {
      console.error(
        `   Fence owner record is unreadable: ${identityError instanceof Error ? identityError.message : String(identityError)}.`,
      );
    }
  }
  console.error(
    "2. Restore only tracked files that contain the literal `~ changed by cargo-mutants ~` marker.",
  );
  if (scanError) {
    console.error(`   Marker scan failed: ${scanError.message}`);
  } else if (markedFiles.length === 0) {
    console.error("   No tracked src-tauri files currently contain the marker.");
  } else {
    for (const path of markedFiles) console.error(`   ${path}`);
    console.error(`   git checkout -- ${markedFiles.map(shellQuote).join(" ")}`);
  }
  console.error(`3. Remove the fence: rm -- ${shellQuote(fencePath)}`);
}

if (process.argv.includes("--check-guard")) {
  if (!existsSync(fencePath)) process.exit(0);
  printRecovery();
  process.exit(1);
}

const selectedPackage = process.env.BACKEND_MUTATION_PACKAGE;
const selectedPackages = selectedPackage
  ? mutationPackages.filter(({ id }) => id === selectedPackage)
  : mutationPackages;
if (selectedPackages.length === 0)
  throw new Error(`Unknown BACKEND_MUTATION_PACKAGE: ${selectedPackage}`);

function assertCleanBackend() {
  let result;
  try {
    result = runGit(["status", "--porcelain", "--", "src-tauri"]);
  } catch (error) {
    throw new Error(`Refusing backend mutation: git status failed: ${error.message}`, {
      cause: error,
    });
  }
  if (result.status !== 0) {
    throw new Error(
      `Refusing backend mutation: git status failed with exit ${result.status}: ${result.stderr.trim()}`,
    );
  }
  if (result.stdout !== "") {
    const paths = result.stdout
      .trimEnd()
      .split("\n")
      .map((line) => line.slice(3));
    throw new Error(`Refusing backend mutation: src-tauri is dirty:\n${paths.join("\n")}`);
  }
}

function discardUnspawnedFence(fd) {
  if (fd !== undefined) closeSync(fd);
  unlinkSync(fencePath);
  fsyncDirectory(dirname(fencePath));
}

function acquireFence() {
  mkdirSync(dirname(fencePath), { recursive: true });
  try {
    // Assign the module-level handle immediately: from the moment this succeeds the
    // fence exists on disk, and every failure below has to be able to find it again.
    fenceFd = openSync(fencePath, "wx");
  } catch (error) {
    if (error?.code === "EEXIST") {
      printRecovery();
      return false;
    }
    throw error;
  }
  writeSync(fenceFd, `started=${new Date().toISOString()}\n`);
  fsyncSync(fenceFd);
  fsyncDirectory(dirname(fencePath));
  return true;
}

function cargoArguments(mutationPackage) {
  return [
    "mutants",
    "--manifest-path",
    "src-tauri/Cargo.toml",
    "--in-place",
    "--cargo-arg=--locked",
    "--no-config",
    "--file",
    mutationPackage.file,
    "--re",
    mutationPackage.functions,
    "--minimum-test-timeout",
    String(minimumTestTimeoutSeconds),
    "--output",
    `mutants.out/backend/${mutationPackage.id}`,
    "--",
    mutationPackage.test,
  ];
}

function clearFence() {
  unlinkSync(fencePath);
  fsyncDirectory(dirname(fencePath));
}

let fenceFd;
let fenceStarted;

async function finalise() {
  if (fenceFd !== undefined) {
    closeSync(fenceFd);
    fenceFd = undefined;
  }

  let markedFiles;
  try {
    markedFiles = trackedMutationFiles();
  } catch (error) {
    console.error(`Backend mutation finaliser could not verify the tree: ${error.message}`);
    return false;
  }
  if (markedFiles.length > 0) {
    console.error("Backend mutation left cargo-mutants markers in tracked files:");
    for (const path of markedFiles) console.error(path);
    console.error(`The fence remains at ${fencePath}.`);
    return false;
  }
  clearFence();
  return true;
}

function recordSpawnedChild(child) {
  if (child.pid === undefined) return;
  const childIdentity = identityForPid(child.pid);
  ftruncateSync(fenceFd, 0);
  writeSync(
    fenceFd,
    `${fenceStarted}pid=${child.pid}\n${childIdentity ? `pidStartTime=${childIdentity.startTime}\n` : ""}`,
    0,
    "utf8",
  );
  fsyncSync(fenceFd);
}

export async function runBackendMutation({ recordChild = recordSpawnedChild } = {}) {
  if (existsSync(fencePath)) {
    printRecovery();
    return 1;
  }
  assertCleanBackend();
  try {
    if (!acquireFence()) return 1;
    fenceStarted = readFileSync(fencePath, "utf8");
  } catch (error) {
    // Nothing has been spawned yet, so a fence created and then abandoned protects
    // nothing and would refuse every later run and every `$push` preflight. This is
    // the only place a fence is removed without verifying the tree, and it is only
    // reachable before the first spawn.
    if (fenceFd !== undefined) {
      const unspawnedFenceFd = fenceFd;
      fenceFd = undefined;
      try {
        discardUnspawnedFence(unspawnedFenceFd);
      } catch (cleanupError) {
        throw new AggregateError(
          [error, cleanupError],
          "Fence setup failed and the unspawned fence could not be removed",
        );
      }
    }
    throw error;
  }

  let supervisor;
  const signalForwarding = installSignalForwarding(() => supervisor);
  let exitCode = 0;
  try {
    for (const mutationPackage of selectedPackages) {
      if (signalForwarding.requestedSignal) break;
      console.log(`\nBackend mutation package: ${mutationPackage.id}`);
      const child = spawn("cargo", cargoArguments(mutationPackage), { stdio: "inherit" });
      supervisor = superviseChild(child, { terminationTimeoutMs });
      signalForwarding.attach(supervisor);
      try {
        recordChild(child);
      } catch (error) {
        await supervisor.terminate();
        throw error;
      }
      const result = await supervisor.done;
      supervisor = undefined;
      if (signalForwarding.requestedSignal) break;
      if (result.error) throw result.error;
      if (result.code === 0) continue;

      const missedPath = `mutants.out/backend/${mutationPackage.id}/mutants.out/missed.txt`;
      const missed = existsSync(missedPath) ? readFileSync(missedPath, "utf8").trim() : "";
      // cargo-mutants reports timeouts with exit 3. A timeout is a killed mutant,
      // but any actual survivor remains a hard failure.
      if (result.code === 3 && missed === "") continue;
      exitCode = result.code ?? 1;
      break;
    }
  } catch (error) {
    console.error(error);
    exitCode = 1;
  } finally {
    if (supervisor) await supervisor.terminate();
    await signalForwarding.termination;
    const finalised = await finalise();
    if (!finalised) exitCode = 1;
    signalForwarding.uninstall();
  }

  if (signalForwarding.requestedSignal) {
    return signalForwarding.requestedSignal === "SIGINT" ? 130 : 143;
  }
  return exitCode;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    process.exitCode = await runBackendMutation();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
