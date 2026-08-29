// Runs cargo-mutants over eight narrowly scoped packages.
//
// `--in-place` below means this mutates the REAL working tree rather than a copy,
// to avoid duplicating the multi-gigabyte target directory. Two consequences that
// are not obvious from the flag:
//   * Nothing else may touch the tree while this runs - no other gate, no `git add`,
//     no parallel session. A commit taken mid-run can capture an injected mutation.
//   * An interrupted run leaves `/* ~ changed by cargo-mutants ~ */` markers in
//     tracked source. After any abort, check `git status -- src-tauri` and restore
//     before doing anything else.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";

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

const selectedPackage = process.env.BACKEND_MUTATION_PACKAGE;
const selectedPackages = selectedPackage
  ? mutationPackages.filter(({ id }) => id === selectedPackage)
  : mutationPackages;
if (selectedPackages.length === 0)
  throw new Error(`Unknown BACKEND_MUTATION_PACKAGE: ${selectedPackage}`);

mkdirSync("mutants.out/backend", { recursive: true });

for (const mutationPackage of selectedPackages) {
  console.log(`\nBackend mutation package: ${mutationPackage.id}`);
  const result = spawnSync(
    "cargo",
    [
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
      "30",
      "--output",
      `mutants.out/backend/${mutationPackage.id}`,
      "--",
      mutationPackage.test,
    ],
    { encoding: "utf8", stdio: "inherit" },
  );
  if (result.status === 0) continue;

  const missedPath = `mutants.out/backend/${mutationPackage.id}/mutants.out/missed.txt`;
  const missed = existsSync(missedPath) ? readFileSync(missedPath, "utf8").trim() : "";
  // cargo-mutants reports timeouts with exit 3. A timeout is a killed mutant,
  // but any actual survivor remains a hard failure.
  if (result.status === 3 && missed === "") continue;
  process.exit(result.status ?? 1);
}
