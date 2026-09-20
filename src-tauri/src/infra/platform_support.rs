/*!
Phase A through Phase E refusal-pin proof records (2026-09-17).

The refusal sites are pinned by the G and B rows below: 20 of the original 35,
after `f-20260914-08` retired eleven by giving them real Windows bodies (the
four `file_workspace.rs` rows and the seven named under "B rows"). The O4d exclusion is
`opened_file_change_stamp`: its unconditional non-unix tail is not a refusal
site and is intentionally not a row. Future closed-world completeness is not
claimed here; that work is split to `f-20260916-01` (R15-01).

The four shared-helper pins (`refusal`, `unsupported`, `unsupported_plural`,
`off_unix_refusal`) are ARGUED, not staged. Reaching them by mutation would
require editing this verifier file itself, which push-review-policy section 2
forbids as a staging route. Every green result below therefore means “green
with those four helper pins argued, not staged”.

Phase A G rows (each staged message names the listed file and signature):
`infra/path_authority/mod.rs::ensure_app_owned_default_dir`,
`fs.rs::download_engine_archive`,
`oauth.rs::authenticate`, `oauth.rs::migrate_legacy_lichess_token`,
`infra/path_authority/mod.rs::engine_resource`,
`fs.rs::set_file_as_executable_blocking` (retired 2026-09-20 with the command
itself, `f-20260906-08`; the guard moved to
`infra/path_authority/mod.rs::register_installed_engine`, which is where the
executable mark now happens),
`puzzle.rs::delete_puzzle_database`, `puzzle.rs::get_puzzle`.

Phase A B rows (each staged message names the listed file and signature).
`file_workspace.rs`'s four rows — `mutation_target`, `register_created_entry`,
`collect_tree_entries` and `paired_rename` — were retired when `f-20260914-08`
ported them; `workspace_bodies_are_single_ungated_delegations` replaced them,
because a deleted row can no longer notice its refusal coming back. The same
port removed seven further rows whose counterparts no longer exist at all —
`infra/fs.rs::{entry_identity_at, create_dir_at, open_directory_at,
rename_entry_at, remove_entry_at, remove_optional_regular_at}` and
`infra/path_authority/mod.rs::entries`, all of which now have real Windows
bodies. The rows that remain are:
`infra/fs.rs::atomic_install_dir`,
`infra/path_authority/mod.rs::remove_leaf_identified`,
`infra/path_authority/mod.rs::open_regular_relative`,
`infra/path_authority/mod.rs::authorize_existing_dir`,
`infra/path_authority/resolved.rs::atomic_install_download_dir`,
`infra/path_authority/resolved.rs::puzzle_database_target`,
`infra/path_authority/resolved.rs::delete_puzzle_database`,
`infra/path_authority/resolved.rs::mark_engine_executable`,
`db/mod.rs::unlink_database_files`, `db/repository.rs::identity_from_probe`.

Phase A removes four B rows — `open_current`, `capability_directory`,
`create_database_child` and `database_file_target` — leaving **11 body rows
and 9 guard rows**, counted from `body_rows()` and `guard_rows()` below. The
guard rows are unchanged; the counts are recorded at this phase boundary
rather than copied from the plan's final arithmetic.

Phase B removes the two puzzle rows — `puzzle_database_target` and
`delete_puzzle_database` — and the two puzzle guard rows, leaving **9 body rows
and 7 guard rows**, counted from the arrays below. The positive row-absence
assertion and its staged break are recorded below.

Phase C removes the `unlink_database_files` and `identity_from_probe` rows,
leaving **7 body rows and 7 guard rows**, counted from the arrays below. The
positive row-absence assertion and its staged break are recorded below.

Phase D removes the `open_valid_preferred` row, leaving **6 body rows and 7
guard rows**, counted from the arrays below. The positive row-absence assertion
and its staged break are recorded below.

Phase E removes the `ensure_app_owned_default_dir` guard row and the
`remove_leaf_identified`, `open_regular_relative` and `authorize_existing_dir`
body rows, leaving **3 body rows and 6 guard rows**, counted from the arrays
below. Those four retired functions are held to one ungated definition each by
`phase_e_removed_rows_have_one_ungated_definition_without_refusals`, which is
also the Linux-red pin against re-inserting the `ensure_app_owned_default_dir`
guard.

Phase 1 of the Windows engine-directory slice (`f-20260914-12`, d-20260918-08)
removes the `engine_resource` guard row: the Windows Directory arm now consumes
`take_directory()` plus the `target` the no-follow walk already computed, so a
directory resource resolves to a lease whose `uci_value` is that retained path.
That leaves **3 body rows and 5 guard rows**, counted from the arrays below.
`engine_resource` keeps `#[cfg(windows)]` arms, so it is pinned by the
Directory-arm source assertion
(`engine_resource_directory_arm_takes_a_directory_and_target_without_refusals`)
rather than by `assert_removed_rows_are_ungated`.

Phase 2 of that slice (d-20260918-09) makes Windows executable mode a checked
no-op: the `#[cfg(not(unix))]` counterpart keeps the EngineInstall and
file-present checks and returns `Ok(())`, so its refusal body row is deleted and
the `set_file_as_executable_blocking` guard row and its `"engine executable
mode"` routed label go with it. That leaves **2 body rows and 4 guard rows**,
counted from the arrays below, and the Ok counterpart is pinned by
`mark_engine_executable_windows_is_a_checked_noop` rather than by a refusal row.

On 2026-09-20 (`f-20260906-08`) `set_file_as_executable` itself was deleted: it
had had no renderer caller since `3afed031`, and the executable mark moved into
`infra/path_authority/mod.rs::register_installed_engine`, which already resolves
the target under `EngineInstall`. Its test guard moved with it and is now
`register_installed_engine_marks_executable_without_off_unix_refusal`, which
additionally pins `?`-propagation, mark-before-persist ordering, and the absence
of the deleted command from `fs.rs` and `main.rs`. No row count changes: the
guard row had already gone in the paragraph above.

Phase 3 of that slice (`f-20260909-01`, d-20260918-10, d-20260918-11) ports the
last two refusal bodies: `infra/fs.rs::atomic_install_dir` now dispatches to the
shared `install_dir_driver` on both platforms and
`infra/path_authority/resolved.rs::atomic_install_download_dir` delegates to it
on both, so both body rows are deleted. The `fs.rs::download_engine_archive`
guard row and its `"engine archive downloads"` routed refusal go with them,
because production staging moved beside the destination
(`private_tempdir_in`) and the command no longer refuses off unix. That leaves
**0 body rows and 3 guard rows**, counted from the arrays below; with the body
list empty the per-row counterpart loop is replaced by
`remaining_refusal_body_rows_are_none`, and the last `refusal_text_has_one_source`
carve-out (`"atomic directory installation is "`) is deleted.

The `f-20260914-15` command-entry phase (d-20260918-13) adds a first-statement
`off_unix_refusal("PGN atomic replacement", cfg!(unix))?;` to `delete_game`, `write_game`
and `export_to_pgn`: each reached the refusing `replace_pgn_atomic` helper only after
`operations.accept`, path-authority resolution, PGN scan or database open. The helper guard
itself stays as the last line of defence for the cores. That leaves **0 body rows and 6
guard rows**, counted from the arrays below. Completeness is the helper call graph, pinned
by `production_replace_pgn_atomic_calls_are_only_edit_existing_and_export_to_pgn_blocking`
and `production_calls_of_every_pgn_atomic_path_node_are_only_from_allowed_callers`, whose
staged breaks are recorded in the matrix below.

Staged failure matrix. Every run used a detached disposable worktree copied
from this phase, mutated production files only, and ran the named
`platform_support` test or filter with
`cargo test --manifest-path src-tauri/Cargo.toml`.
The worktree was removed afterwards. “G all” means every G row above; “B all”
means every B row above, so the named row messages are recorded without
repeating the 35 names six times.

1. S-insert — inserted
   `std::fs::create_dir_all("staged").ok();` as the first effective B
   statement and immediately before every G guard. Failing tests:
   `refusal_guards_are_first_statements_and_precede_their_effects` and
   `non_unix_counterparts_have_only_typed_refusal_bodies`. Messages observed:
   Every G row except `infra/path_authority/mod.rs::engine_resource` reported
   `guard is not first statement`; that engine row reported `directory guard
   block changed`. B all reported `effective non-unix body changed`. Exit
   status: 101.
2. S-variant — changed every effective-path refusal to
   `Error::InvalidInput(` while preserving its message text (including the
   inline Conflict refusals and routed refusal calls). Failing tests:
   `refusal_constant_and_callees_are_exact`,
   `refusal_guards_are_first_statements_and_precede_their_effects`,
   `routed_refusal_labels_are_unchanged`, and
   `non_unix_counterparts_have_only_typed_refusal_bodies`. Messages observed:
   the constant row named `UNSUPPORTED_DIRECTORY_ENUMERATION`; G all named
   `guard changed`; routed rows named their changed labels/counts; B all named
   `effective non-unix body changed`. Exit status: 101.
3. S-message — appended one `x` to every effective-path G operation label, B
   refusal label/literal, and the `UNSUPPORTED_DIRECTORY_ENUMERATION` literal.
   Failing tests:
   `refusal_constant_and_callees_are_exact`,
   `refusal_guards_are_first_statements_and_precede_their_effects`,
   `routed_refusal_labels_are_unchanged`, and
   `non_unix_counterparts_have_only_typed_refusal_bodies`. Messages observed:
   the constant row named `UNSUPPORTED_DIRECTORY_ENUMERATION`; G all named
   `guard changed`; routed rows named their changed labels/counts; B all named
   `effective non-unix body changed`. Exit status: 101.
4. S-cfg — changed counterpart/non-unix refusal cfgs to `#[cfg(windows)]`,
   wrapped B refusal statements in `#[cfg(unix)]`, flattened Block refusal
   attrs/braces while making unix arms return, changed every G `cfg!(unix)` to
   `cfg!(windows)`, added `#[cfg(unix)]` to every G function, and added it to
   the `PathAuthority` impl containing `capability_directory` and `mod
   resolved;`. Failing tests:
   `refusal_constant_and_callees_are_exact`,
   `refusal_guards_are_first_statements_and_precede_their_effects`, and
   `non_unix_counterparts_have_only_typed_refusal_bodies`. Messages observed:
   the constant row named `UNSUPPORTED_DIRECTORY_ENUMERATION`; G all named
   their forbidden cfg, enclosing scope where applicable, and changed guard;
   B all named their form/body change, forbidden cfg, enclosing scope or
   module declaration where applicable. Exit status: 101.
5. S-constant — changed the literal
   `fd-relative directory enumeration` to
   `fd-relative directory enumerationx` in
   `UNSUPPORTED_DIRECTORY_ENUMERATION`. Failing test:
   `refusal_constant_and_callees_are_exact`. Message observed:
   `infra/path_authority/mod.rs: UNSUPPORTED_DIRECTORY_ENUMERATION declaration
   changed`. Exit status: 101.
6. S-callee — inserted
   `std::fs::create_dir_all("staged").ok();` as the first statement of both
   `single_leaf` and `validate_components`. Failing test:
   `refusal_constant_and_callees_are_exact`. Messages observed:
   `infra/fs.rs: pub(crate) fn single_leaf(: body changed` and
   `infra/path_authority/mod.rs: fn validate_components(: body changed` — each
   naming the file the pinned body actually lives in, which is what
   `check_helper`'s `file` parameter exists for. Both rows were reported in the
   same run, which is the observation behind the row-collecting requirement: a
   fail-fast loop would have hidden the second. Exit status: 101.
7. S-component — changed the reserved-device predicate arm for `COM1` to
   `COM1_STAGED`. Failing test:
   `windows_component_gate_covers_namespace_shapes_and_both_gates`. Message
   observed: `Windows component gate checks failed: COM1.db3, COM1, device
   extension`. Exit status: 101.
8. S-parent-access — changed the first `db/search_index.rs` parent access from
   `Readable` to `Writable`. Failing test:
   `phase_a_parent_access_predicate_and_call_sites_are_explicit`. Message
   observed: `parent access pins failed: search-index access call sites`.
   Exit status: 101.
9. S-database-leaf — removed the `validate_windows_database_leaf(filename)?;`
   call from `create_database_child`, replacing it with a no-op validation in
   the disposable copy. Failing test:
   `database_leaf_bound_is_checked_at_creation_and_registration`. Message
   observed: `database leaf bound must guard both entry points and both derived
   sidecars` (the diagnostic included the changed create body). Exit status:
   101.
10. S-unicode-length — changed the `open_windows_child` call to pass
    `wide.len().saturating_sub(1)` to the checked helper. Failing test:
    `unicode_string_length_guard_is_checked_and_called`. Message observed:
    `UNICODE_STRING length guard is missing or not used` (the diagnostic
    included the changed opener body). Exit status: 101.
11. S-row-absence — inserted a Windows-only staged refusal into
    `capability_directory`. Failing test:
    `phase_a_removed_rows_have_one_ungated_definition_without_refusals`.
    Message observed: `Phase A refusal rows or definitions are wrong: 11 body
    rows, 9 guard rows, ["infra/path_authority/mod.rs: pub(crate) fn
    capability_directory("]`. Exit status: 101.
12. S-phase-b-row-absence — inserted
    `let _staged = crate::infra::platform_support::unsupported("puzzle database targets");`
    as the first statement of `puzzle_database_target` in the disposable copy.
    Failing test: `phase_b_removed_rows_have_one_ungated_definition_without_refusals`.
    Message observed: `Phase B refusal rows or definitions are wrong: 9 body
    rows, 7 guard rows, ["infra/path_authority/resolved.rs: pub(crate) fn
    puzzle_database_target("]`. Exit status: 101.
13. S-phase-c-row-absence — inserted
    `let _staged = crate::infra::platform_support::unsupported("database identity probing");`
    as the first statement of `identity_from_probe` in the disposable copy.
    Failing test: `phase_c_removed_rows_have_one_ungated_definition_without_refusals`.
    Message observed: `Phase C refusal rows or definitions are wrong: 7 body
    rows, 7 guard rows, ["db/repository.rs: pub(crate) fn identity_from_probe("]`.
    Exit status: 101. The same assertion collects the database-deletion row if
    the staged refusal is inserted into `unlink_database_files` instead.
14. S-phase-d-row-absence — inserted
    `let _staged = crate::infra::platform_support::unsupported("fd-relative search index loading");`
    as the first statement of `open_valid_preferred` in the disposable copy.
    Failing test:
    `phase_d_removed_rows_have_one_ungated_definition_without_refusals`.
    Message observed: `Phase D refusal rows or definitions are wrong: 6 body
    rows, 7 guard rows, ["db/search.rs: fn open_valid_preferred("]`. Exit
    status: 101.
15. S-phase-d-classifier-raw — changed the Windows reparse raw-code arm from
    `ProbeErrorClass::Reparse` to `WrongKind` in the disposable classifier.
    Failing assertion: `raw code 1920`; observed message:
    `assertion left == right failed: raw code 1920; left: WrongKind; right:
    Reparse`. Exit status: 101.
16. S-phase-d-classifier-reparse-message — changed the exact reparse
    `InvalidInput` arm to `WrongKind`. Failing assertion:
    `InvalidInput reparse message must classify as Reparse`; observed message:
    `left: WrongKind; right: Reparse`. Exit status: 101.
17. S-phase-d-classifier-wrong-kind-message — changed the exact regular-file
    `InvalidInput` arm to `Other`. Failing assertion:
    `InvalidInput regular-file message must classify as WrongKind`; observed
    message: `left: Other; right: WrongKind`. Exit status: 101.
18. S-phase-d-classifier-malformed — changed the `InvalidData` arm to `Other`.
    Failing assertion: `InvalidData must classify as Malformed`; observed
    message: `left: Other; right: Malformed`. Exit status: 101.
19. S-phase-d-classifier-directory — changed the ambiguous-directory return to
    `Other`. Failing assertion: `ambiguous directory failure must classify as
    WrongKind`; observed message: `left: Other; right: WrongKind`. Exit status:
    101.
20. S-phase-d-classifier-permission — changed the classifier fallback to
    `WrongKind`. Failing assertion: `permission failure must remain Other`;
    observed message: `left: WrongKind; right: Other`. Exit status: 101.
21. S-phase-d-open-current-row — reordered the `open_current` class arm in the
    disposable source. Failing assertion: `open_current must map Reparse with
    absence and wrong-kind to Conflict`. Exit status: 101.
22. S-phase-d-loader-row — reordered the loader's NotFound/Reparse arm.
    Failing assertion: `loader must swallow NotFound and Reparse`. Exit status:
    101.
23. S-phase-d-promotion-row — reordered the preferred promotion Reparse and
    WrongKind arm. Failing assertion: `promotion must map preferred Reparse,
    WrongKind and Malformed to Ok(false)`. Exit status: 101.
24. S-phase-d-deletion-row — reordered the deletion Reparse and WrongKind arm.
    Failing assertion: `deletion must map Reparse and WrongKind to InvalidInput`.
    Exit status: 101.
25. S-sidecar-preferred-race — reverted the preferred-sidecar removal to a
    name-based `remove_optional_regular_at`. Failing test:
    `unlink_database_files_rechecks_preferred_sidecar_identity_and_ignores_vanishing_sidecars`.
    Message observed: "called `Result::unwrap_err()` on an `Ok` value: (2, None)".
    Exit status: 101.
26. S-sidecar-legacy-race — reverted the legacy-sidecar removal to ignore the
    identity returned by `legacy_sidecar_matches`. Failing test:
    `legacy_sidecar_removal_uses_the_verified_identity_and_skips_corrupt_archives`.
    Message observed: "called `Result::unwrap_err()` on an `Ok` value: (2, None)".
    Exit status: 101.
27. S-legacy-mapped-removal — removed `drop(archive)` from
    `promote_legacy_index_sidecar_at`. Failing test:
    `legacy_index_mapping_is_dropped_before_removal`.
    Message observed: "Windows refuses a still-mapped legacy index (ERROR_USER_MAPPED_FILE): drop(archive) must precede remove_entry_at".
    Exit status: 101.
28. S-f15-pin-one — inserted a staged production
    `F15StagedPinOne.replace_pgn_atomic();` above `mod tests` in
    `infra/path_authority/mod.rs`. Failing test:
    `production_replace_pgn_atomic_calls_are_only_edit_existing_and_export_to_pgn_blocking`.
    Message observed: `production replace_pgn_atomic call pin failed:
    infra/path_authority/mod.rs: 1 production .replace_pgn_atomic( call(s) outside
    edit_existing and export_to_pgn_blocking`. Exit status: 101.
29. S-f15-pin-two — added a staged `#[tauri::command]` `f15_staged_pin_two` in `fs.rs`
    whose closure calls `crate::pgn::delete_game_core`. Failing test:
    `production_calls_of_every_pgn_atomic_path_node_are_only_from_allowed_callers`.
    Message observed: `production PGN atomic-path caller pin failed: fs.rs:
    delete_game_core called from f15_staged_pin_two, allowed ["delete_game"]`.
    Exit status: 101.

No production whole-function rewrite was needed; all refusal messages remain
byte-identical.
*/
use crate::error::Error;

fn refusal(subject: &str, verb: &str) -> Error {
    Error::Conflict(format!("{subject} {verb} unsupported on this platform"))
}

pub(crate) fn unsupported(operation: &str) -> Error {
    refusal(operation, "is")
}

pub(crate) fn unsupported_plural(operations: &str) -> Error {
    refusal(operations, "are")
}

pub(crate) fn off_unix_refusal(operation: &str, unix: bool) -> Result<(), Error> {
    if unix {
        Ok(())
    } else {
        Err(unsupported(operation))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infra::blocking::source_scan::{braced_body, normalise, Literals};
    use std::{
        ffi::{OsStr, OsString},
        io,
        ops::Range,
    };

    #[test]
    fn probe_error_classifier_table_and_directory_split_are_explicit() {
        use crate::infra::path_authority::{
            classify_probe_error, classify_probe_error_kind, ProbeErrorClass,
        };

        // Only the unix arm extends this table, so the binding is not mutated on Windows.
        #[cfg_attr(not(unix), allow(unused_mut))]
        let mut rows = vec![
            (2, ProbeErrorClass::NotFound),
            (3, ProbeErrorClass::NotFound),
            (267, ProbeErrorClass::WrongKind),
            (1920, ProbeErrorClass::Reparse),
            (4393, ProbeErrorClass::Reparse),
            (1224, ProbeErrorClass::MappedFile),
        ];
        #[cfg(unix)]
        rows.extend([
            (
                rustix::io::Errno::LOOP.raw_os_error(),
                ProbeErrorClass::Reparse,
            ),
            (
                rustix::io::Errno::NOTDIR.raw_os_error(),
                ProbeErrorClass::WrongKind,
            ),
        ]);
        for (raw, expected) in rows {
            let error = Error::Io(Box::new(io::Error::from_raw_os_error(raw)));
            assert_eq!(
                classify_probe_error_kind(&error),
                expected,
                "raw code {raw}"
            );
        }
        assert_eq!(
            classify_probe_error_kind(&Error::InvalidInput(
                "reparse points cannot be authorized".into(),
            )),
            ProbeErrorClass::Reparse,
            "InvalidInput reparse message must classify as Reparse"
        );
        assert_eq!(
            classify_probe_error_kind(&Error::InvalidInput("target must be a regular file".into())),
            ProbeErrorClass::WrongKind,
            "InvalidInput regular-file message must classify as WrongKind"
        );
        assert_eq!(
            classify_probe_error_kind(&Error::Io(Box::new(io::Error::new(
                io::ErrorKind::InvalidData,
                "malformed archive",
            )))),
            ProbeErrorClass::Malformed,
            "InvalidData must classify as Malformed"
        );

        let directory = tempfile::tempdir().unwrap();
        let leaf = OsStr::new("sidecar");
        std::fs::create_dir(directory.path().join(leaf)).unwrap();
        #[cfg(windows)]
        let parent = crate::infra::fs::windows_test_parent(directory.path());
        #[cfg(not(windows))]
        let parent = std::fs::File::open(directory.path()).unwrap();
        assert_eq!(
            classify_probe_error(
                &Error::Io(Box::new(io::Error::from_raw_os_error(5))),
                &parent,
                leaf,
            ),
            ProbeErrorClass::WrongKind,
            "ambiguous directory failure must classify as WrongKind"
        );
        assert_eq!(
            classify_probe_error(
                &Error::Io(Box::new(io::Error::new(
                    io::ErrorKind::PermissionDenied,
                    "injected permission failure",
                ))),
                &parent,
                leaf,
            ),
            ProbeErrorClass::Other,
            "permission failure must remain Other"
        );
    }

    #[test]
    fn probe_error_caller_rows_keep_the_split_explicit() {
        let authority = compact(
            &source_for("infra/path_authority/mod.rs")[braced_body(
                source_for("infra/path_authority/mod.rs"),
                "pub(crate) fn open_current(",
            )],
        );
        assert!(
            authority.contains(
                "ProbeErrorClass::NotFound|ProbeErrorClass::Reparse|ProbeErrorClass::WrongKind"
            ),
            "open_current must map Reparse with absence and wrong-kind to Conflict"
        );

        let search_source = source_for("db/search.rs");
        let loader =
            compact(&search_source[braced_body(search_source, "fn open_valid_preferred(")]);
        assert!(
            loader.contains("ProbeErrorClass::NotFound|ProbeErrorClass::Reparse"),
            "loader must swallow NotFound and Reparse"
        );
        assert!(
            loader.contains("ProbeErrorClass::WrongKind|ProbeErrorClass::MappedFile"),
            "loader must propagate WrongKind and MappedFile"
        );
        assert!(
            loader.contains("ProbeErrorClass::Malformed"),
            "loader must swallow Malformed"
        );
        assert!(
            loader
                .contains("ProbeErrorClass::MappedFile|ProbeErrorClass::Other=>{returnErr(error)"),
            "loader must propagate MappedFile and Other"
        );

        let promotion_source = source_for("db/search_index.rs");
        let promotion = compact(
            &promotion_source[braced_body(
                promotion_source,
                "pub(crate) fn promote_legacy_index_sidecar_at(",
            )],
        );
        assert!(
            promotion.contains("entry_identity_at"),
            "promotion preferred probe must ask whether anything exists"
        );
        assert!(
            promotion.contains("ProbeErrorClass::Reparse"),
            "promotion must classify Reparse"
        );
        let preferred_probe = promotion
            .split("classify_probe_error(&error,parent,preferred_leaf)")
            .nth(1)
            .unwrap()
            .split("letmutsource")
            .next()
            .unwrap();
        assert!(
            preferred_probe.contains(
                "crate::infra::path_authority::ProbeErrorClass::Reparse|crate::infra::path_authority::ProbeErrorClass::WrongKind|crate::infra::path_authority::ProbeErrorClass::Malformed=>returnOk(false)"
            ),
            "promotion must map preferred Reparse, WrongKind and Malformed to Ok(false)"
        );
        assert!(
            promotion.contains("ProbeErrorClass::WrongKind"),
            "promotion must classify WrongKind"
        );
        assert!(
            promotion.contains("ProbeErrorClass::Malformed"),
            "promotion must classify Malformed"
        );
        assert!(
            promotion.contains("ProbeErrorClass::MappedFile"),
            "promotion must propagate MappedFile"
        );
        assert!(
            promotion.contains("ProbeErrorClass::Other"),
            "promotion must propagate Other"
        );
        assert!(
            promotion.contains("returnErr(error)"),
            "promotion must return probe errors"
        );

        let deletion_source = source_for("db/mod.rs");
        let deletion =
            compact(&deletion_source[braced_body(deletion_source, "fn remember_sidecar_error(")]);
        assert!(
            deletion.contains("ProbeErrorClass::Reparse"),
            "deletion must classify Reparse as retryable sidecar input"
        );
        assert!(
            deletion.contains("crate::infra::path_authority::ProbeErrorClass::Reparse|crate::infra::path_authority::ProbeErrorClass::WrongKind=>{"),
            "deletion must map Reparse and WrongKind to InvalidInput"
        );
        assert!(
            deletion.contains("ProbeErrorClass::WrongKind"),
            "deletion must classify WrongKind as retryable sidecar input"
        );
        assert!(
            deletion.contains("Error::InvalidInput"),
            "deletion must return InvalidInput for retryable sidecar input"
        );
        assert!(
            deletion.contains("ProbeErrorClass::MappedFile"),
            "deletion must propagate MappedFile"
        );
        assert!(
            deletion.contains("ProbeErrorClass::Other"),
            "deletion must propagate Other"
        );
    }

    fn compact(text: &str) -> String {
        let mut out = String::with_capacity(text.len());
        let mut string = false;
        let mut escaped = false;
        for ch in text.chars() {
            if string {
                out.push(ch);
                if escaped {
                    escaped = false;
                } else if ch == '\\' {
                    escaped = true;
                } else if ch == '"' {
                    string = false;
                }
            } else if ch == '"' {
                string = true;
                out.push(ch);
            } else if !ch.is_whitespace() {
                out.push(ch);
            }
        }
        out
    }

    fn singular_message(operation: &str) -> String {
        [operation, " is unsupported on this ", "platform"].concat()
    }

    fn plural_message(operations: &str) -> String {
        [operations, " are unsupported on this ", "platform"].concat()
    }

    fn error_message(error: Error) -> String {
        match error {
            Error::Conflict(message) => message,
            other => panic!("expected a conflict refusal, got {other:?}"),
        }
    }

    #[test]
    fn refusals_have_typed_messages() {
        let operation = "test operation";
        assert!(off_unix_refusal(operation, true).is_ok());
        assert_eq!(
            error_message(unsupported(operation)),
            singular_message(operation)
        );
        assert_eq!(
            error_message(off_unix_refusal(operation, false).unwrap_err()),
            singular_message(operation)
        );
        let operations = "test operations";
        assert_eq!(
            error_message(unsupported_plural(operations)),
            plural_message(operations)
        );
    }

    #[test]
    fn routed_plural_refusals_are_byte_identical() {
        assert_eq!(
            error_message(unsupported_plural("authorized directories")),
            [
                "authorized directories",
                " are unsupported on this ",
                "platform"
            ]
            .concat()
        );
        assert_eq!(
            error_message(unsupported_plural("post-rename marker timestamps")),
            [
                "post-rename marker timestamps",
                " are unsupported on this ",
                "platform"
            ]
            .concat()
        );
    }

    #[test]
    fn windows_temporary_creation_descriptor_and_share_mask_are_restrictive() {
        let source = source_for("infra/fs.rs");
        let body = braced_body(source, "fn open_temp_child(");
        let body = compact(&source[body]);
        assert!(body.contains("SecurityDescriptor:security_descriptor.as_ptr()"));
        assert!(body.contains("FILE_CREATE"));
        assert!(body.contains("FILE_SHARE_PRIVATE_TEMP"));
        assert!(!body.contains("FILE_SHARE_READ"));
        assert!(source.contains("const FILE_SHARE_PRIVATE_TEMP: u32 = FILE_SHARE_WRITE"));
        assert!(source.contains("const TEMP_ACCESS: u32 = DELETE"));
        assert!(source.contains("GENERIC_READ"));
        assert!(source.contains("GENERIC_WRITE"));
        assert!(source.contains("READ_CONTROL"));
        assert!(source.contains("WRITE_DAC"));
    }

    #[test]
    fn real_durability_calls_and_their_receivers_are_pinned() {
        let source = compact(&normalise(source_for("infra/fs.rs"), Literals::Keep));
        for call in [
            "temp.flush()",
            "temp.sync_all()",
            "dir.sync_all()",
            "record_durability(\"temp.flush\")",
            "record_durability(\"temp.sync_all:content\")",
            "record_durability(\"dir.sync_all\")",
        ] {
            assert!(source.contains(call), "missing durability call pin: {call}");
        }
    }

    #[test]
    fn windows_replacing_parent_descriptor_is_acquired_writable() {
        // R1-03/E2: FlushFileBuffers fails with os error 5 on a read-only directory handle, and
        // the retained parent also serves FILE_CREATE and the RootDirectory rename. R2-02: the
        // child's access must NOT follow the same predicate. Nothing on Linux compiles
        // resolve_windows, so this source pin is the only check that both predicates survive.
        let source = source_for("infra/path_authority/resolved.rs");
        let body = braced_body(source, "pub(super) fn resolve_windows(");
        let body = compact(&source[body]);
        assert!(
            body.contains("letchild_writable=is_write_operation(operation);"),
            "{body}"
        );
        assert!(
            body.contains("letparent_writable=child_writable||allows_missing_leaf(operation);"),
            "{body}"
        );
        assert!(
            body.contains("super::open_windows_nofollow(root,parent_writable)"),
            "{body}"
        );
        assert!(body.contains("iflast{access}else{parent_access}"), "{body}");
        // The collapsed single-predicate form must not come back.
        assert!(
            !body.contains("super::open_windows_nofollow(root,writable)"),
            "{body}"
        );
    }

    #[test]
    fn post_rename_identity_comes_from_the_retained_handle() {
        // `f-20260916-12`: the injector that used to prove this at runtime renamed the held
        // private temporary, and the temporary's `FILE_SHARE_PRIVATE_TEMP` mask — deliberately
        // without FILE_SHARE_DELETE — refuses that second opener, so the race could never be
        // staged in-process. Measured on the runner as os error 32, a sharing violation. Widening
        // the mask to make the injector work would delete the property the private temporary
        // exists for, so the invariant is pinned against the source instead.
        //
        // What it protects: the post-rename metadata query reads the RETAINED handle. If it were
        // rewritten to reopen the target pathname, a pathname-substitution race would be observed
        // as the installed object — which is exactly the attack the retained handle prevents.
        let source = source_for("infra/fs.rs");
        let body = braced_body(source, "fn replace_at_driver<A, F, P>(");
        let body = compact(&source[body]);
        assert!(
            body.contains("Ok(())=>adapter.metadata(&temp),"),
            "post-rename identity query must read the retained temporary handle; {body}"
        );
        assert!(
            body.contains("#[cfg(not(test))]letmetadata=adapter.metadata(&temp);"),
            "the non-test path must read the retained temporary handle too; {body}"
        );
        // Re-opening by pathname must not come back in either arm.
        assert!(
            !body.contains("adapter.metadata(&File::open("),
            "post-rename identity must never be re-read from a pathname; {body}"
        );
        // Staged-failure matrix (push-review-policy section 2), 2026-09-17. Each row was produced
        // by editing what this test READS — the `replace_at_driver` body in `fs.rs` — never this
        // test's own logic, and `fs.rs` was restored and re-run green afterwards.
        //   1. `Ok(()) => adapter.metadata(&File::open("x").unwrap())` (the test arm)
        //      -> "post-rename identity query must read the retained temporary handle",
        //         exit status 101.
        //   2. `#[cfg(not(test))] let metadata = adapter.metadata(&File::open("x").unwrap())`
        //      -> "the non-test path must read the retained temporary handle too", exit 101.
        // Both edits also trip the negative assertion above, which is why each positive assertion
        // carries a message of its own: a shared "FAIL" would identify nothing.
    }

    #[test]
    fn windows_read_only_directory_walk_does_not_demand_write() {
        // DIRECTORY_ACCESS carries GENERIC_WRITE. Only the final parent needs it for staging;
        // intermediate ancestors are traversal-only and must remain readable. Nothing on Linux
        // compiles this module, and a type-check cannot catch an access mask, so this source pin
        // is the only check that the split survives.
        let source = source_for("infra/fs.rs");
        let body = braced_body(source, "fn open_directory_path(");
        let body = compact(&source[body]);
        // The decision must be INSIDE the walk: computing it once before the loop denied write to
        // every component as soon as the path had any, which is measured -- run 35230257907 turned
        // 7 Windows failures into 50, all of them the final parent's `sync_all` returning
        // ERROR_ACCESS_DENIED. So the pin requires the per-component form, and refuses the
        // hoisted one below.
        assert!(
            body.contains("letlast=components.peek().is_none();"),
            "{body}"
        );
        assert!(
            body.contains(
                "letchild_access=ifwritable&&last{DIRECTORY_ACCESS}else{READ_ONLY_ACCESS};"
            ),
            "{body}"
        );
        assert!(
            !body.contains("letchild_access=ifwritable&&components.peek().is_none()"),
            "the access decision must not be hoisted out of the walk; {body}"
        );
        assert!(
            body.contains("letbase_is_final=components.peek().is_none();"),
            "the base write decision must depend on whether components remain; {body}"
        );
        assert!(
            body.contains(".write(writable&&base_is_final)"),
            "the base must be writable only when it is the final directory; {body}"
        );
        assert!(
            !body.contains(".write(writable)"),
            "the base must not demand write access before the component walk; {body}"
        );
        assert!(
            body.contains("open_windows_child(&dir,name,FILE_OPEN,child_access,null(),true,true)"),
            "{body}"
        );
        // The collapsed form that demanded write on every component must not come back.
        assert!(
            !body.contains("open_windows_child(&dir,name,FILE_OPEN,DIRECTORY_ACCESS,"),
            "{body}"
        );
        // A vacuous split is the other way to lose this: the read mask must stay write-free.
        let whole = compact(source);
        assert!(
            whole.contains(
                "constREAD_ONLY_ACCESS:u32=SYNCHRONIZE|windows_sys::Win32::Foundation::GENERIC_READ|READ_CONTROL;"
            ),
            "READ_ONLY_ACCESS must not acquire GENERIC_WRITE"
        );
        assert!(
            whole.contains(
                "constDIRECTORY_ACCESS:u32=READ_ONLY_ACCESS|windows_sys::Win32::Foundation::GENERIC_WRITE;"
            ),
            "DIRECTORY_ACCESS must stay the read mask plus GENERIC_WRITE"
        );
    }

    #[test]
    fn windows_mutation_directory_handles_are_acquired_writable() {
        let source = source_for("infra/fs.rs");
        let ancestor = compact(&source[braced_body(source, "pub(super) fn open_writable_parent(")]);
        assert!(
            ancestor.contains(
                "open_directory_path(path.parent().unwrap_or_else(||Path::new(\".\")),true)"
            ),
            "{ancestor}"
        );
        let leaf =
            compact(&source[braced_body(source, "pub(super) fn open_writable_leaf_directory(")]);
        assert!(
            leaf.contains(
                "open_windows_child(parent,name,FILE_OPEN,DIRECTORY_ACCESS,null(),true,true,)"
            ),
            "{leaf}"
        );
        let directory = compact(&source[braced_body(source, "fn directory_open_access(")]);
        assert!(
            directory.contains("ifwritable{DIRECTORY_ACCESS}else{READ_ONLY_ACCESS}"),
            "{directory}"
        );
    }

    /// Two review rounds rejected a draft that routed this through `atomic_replace_at_identified`.
    /// It must not: every PGN export test writes its fixture first, and replacing here would hand
    /// `scan_file` an empty file. Nothing executable on Linux can observe the Windows arm, so the
    /// split — adopt an existing regular file, exclusively create only a missing one — is pinned
    /// in source, together with the two flushes and the canonical-binding identity check that
    /// `std::fs::canonicalize` on its own does not provide.
    #[test]
    fn windows_pgn_export_adopts_an_existing_file_and_creates_only_a_missing_one() {
        let source = source_for("infra/path_authority/mod.rs");
        let signature = "pub(crate) fn create_pgn_export_destination(";
        let start = function_starts(source, signature)
            .into_iter()
            .find(|start| direct_attribute(source, *start, "#[cfg(windows)]"))
            .expect("a Windows create_pgn_export_destination arm");
        let body = compact(&source[body_at(source, start)]);
        for forbidden in ["atomic_replace", "replace_pgn_atomic", "fs::canonicalize"] {
            assert!(!body.contains(forbidden), "{forbidden}: {body}");
        }
        assert!(
            body.contains("crate::infra::fs::entry_identity_at(&parent,&leaf,false)"),
            "{body}"
        );
        assert!(
            body.contains("crate::infra::fs::create_regular_at(&parent,&leaf)?"),
            "{body}"
        );
        assert!(
            body.contains("file.sync_all()?;parent.sync_all()?;"),
            "{body}"
        );
        assert!(
            body.contains("letcanonical=canonical_binding(path)?;"),
            "{body}"
        );
        assert!(
            body.contains("crate::infra::fs::open_parent_no_follow(&canonical)?"),
            "{body}"
        );
        assert!(
            body.contains("ifopened_file_identity(&parent)?!=parent_identity"),
            "{body}"
        );
        assert!(
            body.contains("open_windows_nofollow(parent_of(path),false)?"),
            "{body}"
        );
    }

    #[test]
    fn windows_rename_and_remove_children_carry_delete() {
        let source = source_for("infra/fs.rs");
        let access = compact(&source[braced_body(source, "fn child_delete_access(")]);
        assert!(access.contains("DIRECTORY_ACCESS|DELETE"), "{access}");
        assert!(access.contains("TARGET_ACCESS"), "{access}");
        let whole = compact(source);
        assert!(
            whole.contains("pub(super)constTARGET_ACCESS:u32=DELETE|"),
            "TARGET_ACCESS must keep DELETE"
        );
        let rename = compact(&source[braced_body(source, "pub(super) fn rename_entry_at(")]);
        assert!(
            rename.contains("child_delete_access(source_is_dir)"),
            "{rename}"
        );
        let remove = compact(&source[braced_body(source, "pub(super) fn remove_entry_at(")]);
        assert!(
            remove.contains("child_delete_access(false)")
                || remove.contains("child_delete_access(true)"),
            "{remove}"
        );
    }

    #[test]
    fn windows_nt_name_interpreters_guard_a_single_leaf() {
        let authority = source_for("infra/path_authority/mod.rs");
        let opener =
            compact(&authority[braced_body(authority, "pub(crate) fn open_windows_child(")]);
        assert!(
            opener.contains("crate::infra::fs::single_leaf(name)?"),
            "{opener}"
        );
        let source = source_for("infra/fs.rs");
        let rename = compact(&source[braced_body(source, "pub(super) fn rename_child(")]);
        assert!(rename.contains("super::single_leaf(target)?"), "{rename}");
    }

    #[test]
    fn windows_create_collision_is_already_exists() {
        let source = source_for("infra/fs.rs");
        let body = compact(&source[braced_body(source, "fn map_create_collision(")]);
        assert!(body.contains("\"Windows object name collision\""), "{body}");
        assert!(body.contains("AlreadyExists"), "{body}");
        assert!(
            !body.contains("windows_open_status_error"),
            "collision translation must not edit the shared mapper: {body}"
        );
        let create_dir = compact(&source[braced_body(source, "pub(super) fn create_dir_at(")]);
        assert!(create_dir.contains("map_create_collision"), "{create_dir}");
        let create_regular =
            compact(&source[braced_body(source, "pub(super) fn create_regular_at(")]);
        assert!(
            create_regular.contains("map_create_collision"),
            "{create_regular}"
        );
    }

    #[test]
    fn windows_identity_is_read_from_the_retained_handle() {
        let source = source_for("infra/fs.rs");
        for signature in [
            "pub(super) fn entry_identity_at(",
            "pub(super) fn assert_entry_identity(",
            "pub(super) fn open_verified_parent(",
            "fn remove_regular_child(",
            "fn remove_windows_tree_at(",
        ] {
            let body = compact(&source[braced_body(source, signature)]);
            assert!(
                body.contains("opened_file_identity"),
                "{signature} lost the handle identity check: {body}"
            );
        }
    }

    #[test]
    fn windows_workspace_renames_do_not_replace() {
        let source = source_for("infra/fs.rs");
        let rename_entry = compact(&source[braced_body(source, "pub(super) fn rename_entry_at(")]);
        assert!(
            rename_entry.contains("rename_child(target_parent,&mutopened,source,target,false)"),
            "{rename_entry}"
        );
        let rename_optional =
            compact(&source[braced_body(source, "pub(super) fn rename_optional_regular_at(")]);
        assert!(
            rename_optional.contains("rename_child(target_parent,&mutopened,source,target,false)"),
            "{rename_optional}"
        );
    }

    #[test]
    fn windows_unlink_uses_posix_disposition_ex() {
        let source = source_for("infra/fs.rs");
        let unlink = compact(&source[braced_body(source, "fn unlink_posix(")]);
        assert!(unlink.contains("FileDispositionInformationEx"), "{unlink}");
        assert!(unlink.contains("FILE_DISPOSITION_DELETE"), "{unlink}");
        assert!(
            unlink.contains("FILE_DISPOSITION_POSIX_SEMANTICS"),
            "{unlink}"
        );
        assert!(
            unlink.contains("FILE_DISPOSITION_IGNORE_READONLY_ATTRIBUTE"),
            "{unlink}"
        );
        assert!(
            !unlink.contains("FileDispositionInformation)"),
            "new unlink must not silently use the legacy class: {unlink}"
        );
        let delete_temp = compact(&source[braced_body(source, "fn delete_temp(")]);
        assert!(
            delete_temp.contains("FileDispositionInformation"),
            "{delete_temp}"
        );
        assert!(
            !delete_temp.contains("FileDispositionInformationEx"),
            "delete_temp keeps the legacy form: {delete_temp}"
        );
    }

    #[test]
    fn windows_recursive_removal_keeps_unix_containment() {
        let source = source_for("infra/fs.rs");
        let tree = compact(&source[braced_body(source, "fn remove_windows_tree_at(")]);
        assert!(tree.contains("MAX_REMOVE_TREE_DEPTH"), "{tree}");
        assert!(
            tree.contains("directory cleanup refuses to cross a mount"),
            "{tree}"
        );
        assert!(
            tree.contains("directory cleanup rejects links and special files"),
            "{tree}"
        );
        assert!(
            tree.contains("DirectoryEntryKind::Other=>{returnErr(Error::InvalidInput("),
            "reparse entries must be refused, not unlinked: {tree}"
        );
        let remove = compact(&source[braced_body(source, "pub(super) fn remove_entry_at(")]);
        assert!(remove.contains("Error::PartialRemoval"), "{remove}");
        assert!(
            remove.contains("DurabilityStage::WorkspaceRemoval"),
            "{remove}"
        );
        let enumerator = compact(&source[braced_body(source, "fn enumerated_kind(")]);
        assert!(
            enumerator.contains("FILE_ATTRIBUTE_REPARSE_POINT")
                && enumerator.find("FILE_ATTRIBUTE_REPARSE_POINT")
                    < enumerator.find("FILE_ATTRIBUTE_DIRECTORY"),
            "reparse must be classified before the directory bit: {enumerator}"
        );
    }

    #[test]
    fn windows_listing_identity_is_composed_not_a_raw_file_id() {
        // `FILE_ID_BOTH_DIR_INFORMATION.FileId` carries no volume serial, while
        // `opened_file_identity` is `(dwVolumeSerialNumber, nFileIndex)`. A raw `FileId` here
        // type-checks and then fails every listing with `workspace entry changed concurrently`,
        // because the listing confirms each kept entry against a freshly opened handle.
        let source = source_for("infra/fs.rs");
        let enumerate = compact(&source[braced_body(source, "pub(super) fn enumerate_directory(")]);
        assert!(
            enumerate.contains("letvolume=opened_file_identity(dir)?.0"),
            "the volume serial must come from the retained directory handle: {enumerate}"
        );
        let page = compact(&source[braced_body(source, "fn parse_directory_page(")]);
        assert!(
            page.contains("identity:(volume,header.FileIdasu64)"),
            "enumeration identity must be composed with the volume serial: {page}"
        );
        let read = compact(&source[braced_body(source, "pub(super) fn read_directory_entries(")]);
        assert!(
            read.contains("identity:entry.identity"),
            "the listing must hand on the composed identity unchanged: {read}"
        );
    }

    #[test]
    fn windows_listing_classifies_reparse_entries_as_other_and_stays_cancellable() {
        // A junction is `FILE_ATTRIBUTE_DIRECTORY | FILE_ATTRIBUTE_REPARSE_POINT`. If the listing
        // mapped it to `Directory` the walk would descend it, `open_child_directory` would refuse,
        // and the whole listing would fail where unix returns the tree minus the link. The
        // reparse-before-directory order inside the enumerator is pinned separately; this pins
        // that the listing keeps the `Other` classification instead of collapsing it.
        let source = source_for("infra/fs.rs");
        let read = compact(&source[braced_body(source, "pub(super) fn read_directory_entries(")]);
        assert!(
            read.contains("kind:entry.kind,"),
            "the listing must hand on the enumerated kind unchanged, `Other` included: {read}"
        );
        // The enumerator and `DirectoryEntry` share one kind enum, so there is no remapping arm
        // left that could collapse `Other`; a reintroduced translation is the regression.
        assert!(
            !read.contains("=>DirectoryEntryKind::"),
            "a second kind enum must not come back: {read}"
        );
        let entry_kind = compact(&source[braced_body(source, "pub(super) struct EnumeratedEntry")]);
        assert!(
            entry_kind.contains("kind:DirectoryEntryKind,"),
            "the enumerator must carry the one kind enum: {entry_kind}"
        );
        assert_eq!(
            read.matches("ifcancellation.is_cancelled(){returnErr(Error::Cancellation);}")
                .count(),
            3,
            "the single-directory read is cancellable before, during and after the walk: {read}"
        );
        // F3: the page loop itself has to observe cancellation, or a large directory is
        // uninterruptible for the whole of its enumeration.
        let whole = compact(&normalise(source, Literals::Keep));
        assert!(
            whole.contains(
                "pub(super)fnenumerate_directory(dir:&File,cancellation:&CancellationToken,)"
            ),
            "the enumerator must take the caller's cancellation token"
        );
        let enumerate = compact(&source[braced_body(source, "pub(super) fn enumerate_directory(")]);
        let loop_start = enumerate.find("loop{").expect("the page loop must exist");
        assert!(
            enumerate[loop_start..]
                .starts_with("loop{ifcancellation.is_cancelled(){returnErr(Error::Cancellation);}"),
            "cancellation must be observed once per NtQueryDirectoryFile page: {enumerate}"
        );
    }

    /// F1. `NtCreateFile` returns an ASYNCHRONOUS file object unless `CreateOptions` carries
    /// `FILE_SYNCHRONOUS_IO_NONALERT`: the I/O manager then keeps no `CurrentByteOffset`, so
    /// `ReadFile`/`WriteFile` with a NULL `lpOverlapped` — which is exactly what `File::read`
    /// and `File::write` always issue — fail with `STATUS_INVALID_PARAMETER`, and
    /// `NtQueryDirectoryFile` may return `STATUS_PENDING` while still writing into a buffer this
    /// code would drop. `SYNCHRONIZE` in the access mask does not imply it. No Linux test can
    /// observe it, and no Windows test can either: the Windows listing tests enumerate
    /// `windows_test_parent`, a `CreateFile` handle that is synchronous by construction, so they
    /// exercise a handle kind production never produces.
    #[test]
    fn windows_nt_create_sites_open_synchronous_file_objects() {
        // The flag has to appear in the `CreateOptions` argument, not merely somewhere in the
        // body: both sites also name it in a `use` or a `const`, so a bare `contains` would stay
        // green with the option dropped from the create call.
        for (file, signature, create_options) in [
            (
                "infra/fs.rs",
                "fn open_temp_child(",
                "FILE_NON_DIRECTORY_FILE|FILE_OPEN_REPARSE_POINT|FILE_SYNCHRONOUS_IO_NONALERT,",
            ),
            (
                "infra/path_authority/mod.rs",
                "pub(crate) fn open_windows_child(",
                "letoptions=FILE_OPEN_REPARSE_POINT|FILE_SYNCHRONOUS_IO_NONALERT|ifdirectory{FILE_DIRECTORY_FILE}else{FILE_NON_DIRECTORY_FILE};",
            ),
        ] {
            let source = source_for(file);
            let body = compact(&source[braced_body(source, signature)]);
            assert!(
                body.contains(create_options),
                "{file}: {signature} must pass {create_options} as its CreateOptions: {body}"
            );
            assert!(
                body.contains("NtCreateFile("),
                "{file}: {signature} must still be the NT create site: {body}"
            );
        }
        // `open_windows_child` declares the constant itself; a wrong value is invisible to a
        // type-check and would silently leave the handle asynchronous.
        assert!(
            compact(source_for("infra/path_authority/mod.rs"))
                .contains("constFILE_SYNCHRONOUS_IO_NONALERT:u32=0x20;"),
            "FILE_SYNCHRONOUS_IO_NONALERT is 0x20"
        );
        // The flag requires `SYNCHRONIZE`, so every mask handed to `open_windows_child` must
        // carry it. All of them are composed from these named constants.
        let fs_source = compact(source_for("infra/fs.rs"));
        for constant in [
            "constREAD_ONLY_ACCESS:u32=SYNCHRONIZE|",
            "constDIRECTORY_ACCESS:u32=READ_ONLY_ACCESS|",
            "pub(super)constTARGET_ACCESS:u32=DELETE|SYNCHRONIZE|",
            "constTEMP_ACCESS:u32=DELETE|SYNCHRONIZE|",
        ] {
            assert!(
                fs_source.contains(constant),
                "every NT access mask must carry SYNCHRONIZE: missing {constant}"
            );
        }
        for (file, mask) in [
            (
                "infra/path_authority/mod.rs",
                "letread_access=SYNCHRONIZE|GENERIC_READ;",
            ),
            (
                "infra/path_authority/resolved.rs",
                "letaccess=SYNCHRONIZE|GENERIC_READ|ifwritable{GENERIC_WRITE}else{0};",
            ),
            (
                "infra/path_authority/resolved.rs",
                "letaccess=SYNCHRONIZE|GENERIC_READ|ifchild_writable{GENERIC_WRITE}else{0};",
            ),
            (
                "infra/path_authority/resolved.rs",
                "SYNCHRONIZE|GENERIC_READ|ifparent_writable{GENERIC_WRITE}else{0};",
            ),
        ] {
            assert!(
                compact(source_for(file)).contains(mask),
                "{file}: every NT access mask must carry SYNCHRONIZE: missing {mask}"
            );
        }
    }

    #[test]
    fn windows_enumeration_restart_terminal_and_exhaustion_are_handled() {
        // `STATUS_NO_MORE_FILES` is informational and has no arm in `windows_open_status_error`,
        // so falling through would turn the end of every directory into `Error::Io`. `RestartScan`
        // is TRUE on the first call only, and must stay as it was across a `STATUS_BUFFER_OVERFLOW`
        // retry. Returning `Ok` with a prefix when the retry bound is hit would be a truncated
        // listing reported as a complete tree, so the bound fails closed.
        let source = source_for("infra/fs.rs");
        let body = compact(&source[braced_body(source, "pub(super) fn enumerate_directory(")]);
        assert!(
            body.contains("ifstatus==STATUS_NO_MORE_FILES{break;}"),
            "end of stream must be success, not an error: {body}"
        );
        assert!(
            body.contains("letmutrestart_scan=true;"),
            "the first call must restart the scan: {body}"
        );
        assert!(
            body.contains("restart_scan=false;"),
            "later calls must not restart the scan: {body}"
        );
        let overflow_start = body
            .find("ifstatus==STATUS_BUFFER_OVERFLOW")
            .expect("buffer-overflow retry must exist");
        let overflow_end = body[overflow_start..]
            .find("continue;")
            .map(|offset| overflow_start + offset)
            .expect("the retry must continue the loop");
        assert!(
            !body[overflow_start..overflow_end].contains("restart_scan"),
            "a buffer-overflow retry must preserve RestartScan as it was: {body}"
        );
        assert!(
            body[overflow_start..overflow_end].contains(
                "returnErr(Error::Io(Box::new(std::io::Error::other(\"directory enumeration buffer was exhausted\",))));"
            ),
            "the retry bound must fail closed, never return a prefix: {body}"
        );
        assert!(
            body.contains("overflow_retries>DIRECTORY_ENUMERATION_OVERFLOW_RETRIES")
                && body.contains("buffer_len>=DIRECTORY_ENUMERATION_MAX_BYTES"),
            "the retry must be bounded: {body}"
        );
    }

    #[test]
    fn windows_listing_timestamps_are_converted_from_the_filetime_epoch() {
        // `LastWriteTime` is a FILETIME: 100-nanosecond ticks since 1601-01-01. The renderer reads
        // `WorkspaceEntry.lastModified` as Unix seconds, so a raw tick count type-checks, passes a
        // names-only listing assertion, and renders dates centuries out.
        let source = source_for("infra/fs.rs");
        let conversion =
            compact(&source[braced_body(source, "pub(super) fn filetime_to_unix_seconds(")]);
        assert!(
            conversion.contains("div_euclid(FILETIME_TICKS_PER_SECOND)")
                && conversion.contains("saturating_sub(FILETIME_EPOCH_OFFSET_SECONDS)"),
            "{conversion}"
        );
        let whole = compact(source);
        assert!(
            whole.contains("constFILETIME_EPOCH_OFFSET_SECONDS:i64=11_644_473_600;"),
            "the 1601-to-1970 offset must stay exact"
        );
        assert!(
            whole.contains("constFILETIME_TICKS_PER_SECOND:i64=10_000_000;"),
            "a FILETIME tick is 100 nanoseconds"
        );
        let read = compact(&source[braced_body(source, "pub(super) fn read_directory_entries(")]);
        assert!(
            read.contains("modified_seconds:filetime_to_unix_seconds(entry.last_write_time)"),
            "the listing must convert, never hand on raw ticks: {read}"
        );
    }

    #[test]
    fn windows_reparse_swap_is_a_conflict_in_listing_and_on_the_mutation_open() {
        // An entry that was a directory when it was enumerated or when the capability was issued
        // and is a junction by the time it is opened is a concurrent swap, which the renderer
        // retries, not an `InvalidInput` about a bad argument, which it reports as a caller bug.
        let authority = source_for("infra/path_authority/mod.rs");
        let swap = compact(&authority[braced_body(authority, "fn child_open_swap(")]);
        assert!(
            swap.contains("\"reparse points cannot be authorized\""),
            "the listing must remap the reparse refusal: {swap}"
        );
        assert_eq!(
            swap.matches("Error::Conflict(\"workspace directory changed concurrently\".into())")
                .count(),
            3,
            "both platforms map their swap statuses to the one retryable conflict: {swap}"
        );
        assert!(
            swap.contains("ERROR_FILE_NOT_FOUNDasi32")
                && swap.contains("ERROR_PATH_NOT_FOUNDasi32")
                && swap.contains("ERROR_DIRECTORYasi32"),
            "the NT counterparts of LOOP/NOTDIR/NOENT must be remapped too: {swap}"
        );
        let source = source_for("infra/fs.rs");
        let expected = compact(&source[braced_body(source, "fn open_expected_child(")]);
        assert!(
            expected.contains("Err(error)ifis_reparse_refusal(&error)=>{ifconflict{Err(type_mismatch(true))}else{Err(error)}}"),
            "the mutation open must surface a junction swap as a conflict: {expected}"
        );
    }

    #[test]
    fn windows_optional_regular_missing_leaf_is_success() {
        let source = source_for("infra/fs.rs");
        let missing = compact(&source[braced_body(source, "fn missing_leaf(")]);
        // Named constants, not the bare literal 2: `ERROR_FILE_NOT_FOUND` is what
        // `RtlNtStatusToDosError` gives for `STATUS_OBJECT_NAME_NOT_FOUND`.
        assert!(
            missing.contains("raw_os_error()==Some(ERROR_FILE_NOT_FOUNDasi32)")
                && missing.contains("raw_os_error()==Some(ERROR_PATH_NOT_FOUNDasi32)"),
            "{missing}"
        );
        assert!(
            !missing.contains("Some(2)") && !missing.contains("Some(3)"),
            "the missing-leaf codes must stay named: {missing}"
        );
        let rename =
            compact(&source[braced_body(source, "pub(super) fn rename_optional_regular_at(")]);
        assert!(rename.contains("missing_leaf(&error)"), "{rename}");
        assert!(rename.contains("returnOk(false)"), "{rename}");
        let remove =
            compact(&source[braced_body(source, "pub(super) fn remove_optional_regular_at(")]);
        assert!(remove.contains("missing_leaf(&error)"), "{remove}");
        assert!(remove.contains("returnOk(())"), "{remove}");
    }

    #[test]
    fn windows_target_regularity_and_private_temp_dacl_are_enforced() {
        // Two properties a type-check can never hold, because the broken form compiles perfectly.
        // `fn target_regular(_: &Target) -> bool { true }` was the bug: FILE_NON_DIRECTORY_FILE
        // excludes directories but admits devices, volumes and pipes, so the driver's regular-file
        // guard was vacuous on Windows. And a supplied DACL does not keep a parent's inheritable
        // ACEs out of a new object unless the descriptor is marked protected, so the
        // "creator-only" temporary was not necessarily creator-only.
        let source = source_for("infra/fs.rs");

        let regular = compact(&source[braced_body(source, "fn target_regular(")]);
        assert!(
            regular.contains("GetFileType(target.handle.as_raw_handle()asHANDLE)==FILE_TYPE_DISK"),
            "{regular}"
        );
        assert!(
            !regular.contains("fntarget_regular(_:&Target)->bool{true}"),
            "{regular}"
        );

        let production = compact(&source[braced_body(source, "fn new(access: u32)")]);
        assert!(
            production.contains("Self::new_with_options(access,0,true)"),
            "the production constructor must retain protected, non-inheriting defaults: {production}"
        );
        let descriptor = compact(&source[braced_body(source, "fn new_with_options(")]);
        assert!(
            descriptor.contains(
                "SetSecurityDescriptorControl(descriptor_ptr,SE_DACL_PROTECTED,SE_DACL_PROTECTED,)"
            ),
            "{descriptor}"
        );
    }

    /// D1a/D6. The colon rejection is `#[cfg(windows)]`, so its only runtime assertion is a
    /// `#[cfg(windows)]` case inside `workspace_names_reject_paths_reserved_sidecars_and_empty_values`
    /// and nothing on Linux would notice it being dropped. On NTFS `existing.pgn:secret` names an
    /// alternate data stream on `existing.pgn`, and `pgn_name` only appends `.pgn` to whatever
    /// `validate_name` returned.
    #[test]
    fn windows_workspace_basenames_reject_the_alternate_data_stream_colon() {
        let source = source_for("file_workspace.rs");
        let body = compact(&source[braced_body(source, "fn validate_name(")]);
        assert!(
            body.contains(
                r#"#[cfg(windows)]ifname.contains(':'){returnErr(Error::InvalidInput("invalid workspace basename".into()));}"#
            ),
            "{body}"
        );
        // The unconditional form would change the Linux invoke contract, where a colon is a
        // legal filename byte; `validate_components` sets the same precedent the other way.
        assert!(
            !body.contains(r#"name.contains(['/','\\','\0',':'])"#),
            "the colon rejection must stay Windows-only: {body}"
        );
        let pgn_name = compact(&source[braced_body(source, "fn pgn_name(")]);
        assert!(
            pgn_name.contains("letname=validate_name(name)?;"),
            "pgn_name must keep routing through validate_name: {pgn_name}"
        );
    }

    #[test]
    fn windows_component_gate_covers_namespace_shapes_and_both_gates() {
        let mut failures = Vec::new();
        let mut check = |condition: bool, message: &str| {
            if !condition {
                failures.push(message.to_owned());
            }
        };

        for name in [
            "a:stream.db3",
            r"a/b",
            r"a\b",
            "a\0b",
            "foo.db3.",
            "foo.db3 ",
            "NUL",
            "nul.db3",
            "COM1.db3",
            "lpt9",
            "COM¹",
            "lpt².db3",
        ] {
            check(
                crate::infra::path_authority::windows_component_refusal(OsStr::new(name)).is_some(),
                name,
            );
        }
        for stem in [
            "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7",
            "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
            "COM¹", "COM²", "COM³", "LPT¹", "LPT²", "LPT³",
        ] {
            check(
                crate::infra::path_authority::windows_component_refusal(OsStr::new(stem)).is_some(),
                stem,
            );
            check(
                crate::infra::path_authority::windows_component_refusal(OsStr::new(&format!(
                    "{stem}.db3"
                )))
                .is_some(),
                "device extension",
            );
        }

        let database_250 = OsString::from(format!("{}{}.db3", "a".repeat(246), ""));
        let database_251 = OsString::from(format!("{}{}.db3", "a".repeat(247), ""));
        let mut preferred = database_250.clone();
        preferred.push(".ecsi");
        let legacy = std::path::Path::new(&database_250)
            .with_extension("ecsi")
            .into_os_string();
        check(
            crate::infra::path_authority::windows_database_leaf_refusal(&database_250).is_none(),
            "250-unit database leaf",
        );
        check(
            crate::infra::path_authority::windows_database_leaf_refusal(&database_251).is_some(),
            "251-unit database leaf",
        );
        check(
            crate::infra::path_authority::windows_component_refusal(&preferred).is_none(),
            "250-unit preferred sidecar",
        );
        check(
            crate::infra::path_authority::windows_component_refusal(&legacy).is_none(),
            "250-unit legacy sidecar",
        );

        let authority = source_for("infra/path_authority/mod.rs");
        let validate = compact(&authority[braced_body(authority, "fn validate_components(")]);
        let fs_source = source_for("infra/fs.rs");
        let single = compact(&fs_source[braced_body(fs_source, "pub(crate) fn single_leaf(")]);
        check(
            validate.contains("windows_component_refusal(component)"),
            "validate_components route",
        );
        check(
            single.contains("windows_component_refusal(leaf)"),
            "single_leaf route",
        );
        assert!(
            failures.is_empty(),
            "Windows component gate checks failed: {}",
            failures.join(", ")
        );
    }

    #[test]
    fn phase_a_parent_access_predicate_and_call_sites_are_explicit() {
        use crate::infra::{
            fs::ParentAccess,
            path_authority::{parent_access_for_operations, PathOperation},
        };

        let operations = [
            (PathOperation::ReadPgn, ParentAccess::Readable),
            (PathOperation::WritePgn, ParentAccess::Writable),
            (PathOperation::DatabaseRead, ParentAccess::Readable),
            (PathOperation::DatabaseMutate, ParentAccess::Writable),
            (PathOperation::DatabaseCreate, ParentAccess::Writable),
            (PathOperation::DatabaseExport, ParentAccess::Writable),
            (PathOperation::PuzzleRead, ParentAccess::Readable),
            (PathOperation::PuzzleDelete, ParentAccess::Writable),
            (PathOperation::EngineExecute, ParentAccess::Readable),
            (PathOperation::EngineConfigure, ParentAccess::Readable),
            (PathOperation::EngineBinaryInspect, ParentAccess::Readable),
            (PathOperation::EngineResourceRead, ParentAccess::Readable),
            (PathOperation::OpeningBookRead, ParentAccess::Readable),
            (PathOperation::ImageRead, ParentAccess::Readable),
            (PathOperation::DownloadFile, ParentAccess::Writable),
            (PathOperation::DownloadArchive, ParentAccess::Writable),
            (PathOperation::EngineInstall, ParentAccess::Writable),
            (PathOperation::SnapshotWrite, ParentAccess::Writable),
            (PathOperation::LogWrite, ParentAccess::Writable),
            (PathOperation::OpenShell, ParentAccess::Readable),
        ];
        let mut failures = Vec::new();
        for (operation, expected) in operations {
            if parent_access_for_operations(&[operation]) != expected {
                failures.push(format!("wrong access for {operation:?}"));
            }
        }

        let authority = source_for("infra/path_authority/mod.rs");
        let fs_source = source_for("infra/fs.rs");
        let search_index = source_for("db/search_index.rs");
        let database =
            compact(&authority[braced_body(authority, "pub(crate) fn database_file_target(")]);
        let dialog = compact(&authority[braced_body(authority, "pub fn grant_dialog_operations(")]);
        let promote = compact(&authority[braced_body(authority, "pub fn promote_dialog(")]);
        let registration = compact(&authority[braced_body(authority, "fn registration_target(")]);
        let current = compact(&authority[braced_body(authority, "pub(crate) fn open_current(")]);
        let retained = compact(&authority[braced_body(authority, "fn retained_workspace_target(")]);
        let fs_open_directory =
            compact(&fs_source[braced_body(fs_source, "pub(crate) fn open_verified_directory(")]);
        let acquire = compact(&authority[braced_body(authority, "fn acquire_target(")]);
        let shape = compact(&authority[braced_body(authority, "enum AcquireShape {")]);
        let checks = [
            (
                database.contains("AcquireShape::File{parent_access:parent_access_for_operations(&[operation])"),
                "database_file_target",
            ),
            (
                dialog.contains("AcquireShape::Dialog{parent_access:parent_access_for_operations(&operations)"),
                "dialog acquisition",
            ),
            (
                promote.contains(
                    "for_persistent_class(persistent_class,parent_access_for_operations(&operations)",
                ),
                "dialog promotion",
            ),
            (
                registration.contains("parent_access_for_operations(operations)"),
                "registration acquisition",
            ),
            (current.contains("ParentAccess::Readable"), "open_current access"),
            (retained.contains("ParentAccess::Writable"), "retained workspace access"),
            (
                fs_open_directory.contains("ParentAccess::Writable"),
                "verified directory access",
            ),
            (
                search_index.matches("ParentAccess::Readable").count() == 2,
                "search-index access call sites",
            ),
            (acquire.contains("letparent_access=shape.parent_access();"), "acquire access extraction"),
            (acquire.contains("#[cfg(windows)]"), "Windows acquire branch"),
            (acquire.contains("letcanonical=canonical_binding(path)?"), "Windows canonical binding"),
            (
                acquire.contains(
                    "open_verified_parent(&canonical,(identity.a,identity.b),target_is_dir,parent_access",
                ),
                "Windows acquire parent access",
            ),
            (shape.contains("Dialog{parent_access:ParentAccess}"), "dialog shape"),
            (shape.contains("File{parent_access:ParentAccess}"), "file shape"),
            (shape.contains("Root{parent_access:ParentAccess}"), "root shape"),
        ];
        for (condition, label) in checks {
            if !condition {
                failures.push(label.to_owned());
            }
        }
        assert!(
            failures.is_empty(),
            "parent access pins failed: {}",
            failures.join(", ")
        );
    }

    #[test]
    fn database_leaf_bound_is_checked_at_creation_and_registration() {
        let authority = source_for("infra/path_authority/mod.rs");
        let create =
            compact(&authority[braced_body(authority, "pub(crate) fn create_database_child(")]);
        let register =
            compact(&authority[braced_body(authority, "pub(crate) fn register_database_child(")]);
        let validator =
            compact(&authority[braced_body(authority, "fn validate_windows_database_leaf(")]);
        let conditions = [
            create.contains("validate_windows_database_leaf(filename)?;")
                && register.contains("validate_windows_database_leaf(filename)?;"),
            validator.contains("windows_database_leaf_refusal(name)")
                && validator.contains("preferred.push(\".ecsi\")")
                && validator.contains("letlegacy=Path::new(name).with_extension(\"ecsi\")")
                && validator.contains("windows_component_refusal(&sidecar)"),
            crate::infra::path_authority::windows_database_leaf_refusal(OsStr::new(&format!(
                "{}{}.db3",
                "a".repeat(247),
                ""
            )))
            .is_some(),
            crate::infra::path_authority::windows_database_leaf_refusal(OsStr::new(&format!(
                "{}{}.db3",
                "a".repeat(246),
                ""
            )))
            .is_none(),
        ];
        assert!(
            conditions.into_iter().all(|condition| condition),
            "database leaf bound must guard both entry points and both derived sidecars: create={create} register={register} validator={validator}"
        );
    }

    #[test]
    fn unicode_string_length_guard_is_checked_and_called() {
        let values = [
            (255, Some((510, 510))),
            (256, Some((512, 512))),
            (32_768, None),
        ];
        let mut results = values.into_iter().map(|(units, expected)| {
            crate::infra::path_authority::unicode_string_lengths(units) == expected
        });
        let source = source_for("infra/path_authority/mod.rs");
        let opener = compact(&source[braced_body(source, "pub(crate) fn open_windows_child(")]);
        assert!(
            results.all(|result| result) && opener.contains("unicode_string_lengths(wide.len())"),
            "UNICODE_STRING length guard is missing or not used: {opener}"
        );
    }

    #[test]
    fn legacy_index_mapping_is_dropped_before_removal() {
        let source = source_for("db/search_index.rs");
        let probe =
            compact(&source[braced_body(source, "pub(crate) fn probe_legacy_index_sidecar_at(")]);
        let promotion =
            compact(&source[braced_body(source, "pub(crate) fn promote_legacy_index_sidecar_at(")]);
        assert!(
            probe.contains("drop(archive)")
                && promotion
                    .find("probe_legacy_index_sidecar_at(")
                    .zip(promotion.find("remove_entry_at(parent,legacy_leaf,legacy_object,false)"))
                    .is_some_and(|(probe, remove)| probe < remove),
            "Windows refuses a still-mapped legacy index (ERROR_USER_MAPPED_FILE): the provenance probe must drop the archive before promotion removes the legacy sidecar"
        );
    }

    /// The live `(body_rows, guard_rows)` counts at the current phase boundary. Every
    /// `phase_*_removed_rows...` test reads this, so a phase that removes a row edits the live
    /// count in exactly one place instead of five copies.
    const LIVE_REFUSAL_ROW_COUNTS: (usize, usize) = (0, 6);

    fn assert_removed_rows_are_ungated(phase: &str, rows: &[(&str, &str)]) {
        let (expected_body_rows, expected_guard_rows) = LIVE_REFUSAL_ROW_COUNTS;
        let mut failures = Vec::new();
        for (file, signature) in rows {
            let source = source_for(file);
            let starts = function_starts(source, signature);
            let ungated = starts.len() == 1
                && attribute_lines_before(source, starts[0])
                    .iter()
                    .all(|attribute| {
                        !attribute.contains("#[cfg") && !attribute.contains("cfg_attr")
                    });
            let body = starts
                .first()
                .map(|start| compact(&source[body_at(source, *start)]))
                .unwrap_or_default();
            let body_has_no_refusal = !body.contains("unsupported")
                && !body.contains("off_unix_refusal")
                && !body.contains("platform_support")
                && !body.contains("#[cfg(windows)]")
                && !body.contains("#[cfg(not(unix))]")
                && !body.contains("cfg!(windows)")
                && !body.contains("cfg_attr");
            if !ungated || !body_has_no_refusal {
                failures.push(format!("{file}: {signature}"));
            }
        }
        assert!(
            failures.is_empty()
                && body_rows().len() == expected_body_rows
                && guard_rows().len() == expected_guard_rows,
            "{phase} refusal rows or definitions are wrong: {} body rows, {} guard rows, {:?}",
            body_rows().len(),
            guard_rows().len(),
            failures
        );
    }

    #[test]
    fn phase_a_removed_rows_have_one_ungated_definition_without_refusals() {
        assert_removed_rows_are_ungated(
            "Phase A",
            &[
                ("infra/path_authority/mod.rs", "pub(crate) fn open_current("),
                (
                    "infra/path_authority/mod.rs",
                    "pub(crate) fn capability_directory(",
                ),
                (
                    "infra/path_authority/mod.rs",
                    "pub(crate) fn create_database_child(",
                ),
                (
                    "infra/path_authority/mod.rs",
                    "pub(crate) fn database_file_target(",
                ),
            ],
        );
    }

    #[test]
    fn phase_b_removed_rows_have_one_ungated_definition_without_refusals() {
        assert_removed_rows_are_ungated(
            "Phase B",
            &[
                (
                    "infra/path_authority/resolved.rs",
                    "pub(crate) fn puzzle_database_target(",
                ),
                (
                    "infra/path_authority/resolved.rs",
                    "pub(crate) fn delete_puzzle_database(",
                ),
            ],
        );
    }

    #[test]
    fn phase_c_removed_rows_have_one_ungated_definition_without_refusals() {
        assert_removed_rows_are_ungated(
            "Phase C",
            &[
                ("db/mod.rs", "fn unlink_database_files("),
                ("db/repository.rs", "pub(crate) fn identity_from_probe("),
            ],
        );
    }

    #[test]
    fn phase_d_removed_rows_have_one_ungated_definition_without_refusals() {
        assert_removed_rows_are_ungated("Phase D", &[("db/search.rs", "fn open_valid_preferred(")]);
    }

    #[test]
    fn phase_e_removed_rows_have_one_ungated_definition_without_refusals() {
        assert_removed_rows_are_ungated(
            "Phase E",
            &[
                ("infra/path_authority/mod.rs", "fn authorize_existing_dir("),
                (
                    "infra/path_authority/mod.rs",
                    "pub(crate) fn open_regular_relative(",
                ),
                (
                    "infra/path_authority/mod.rs",
                    "pub(crate) fn remove_leaf_identified(",
                ),
                (
                    "infra/path_authority/mod.rs",
                    "pub(crate) fn ensure_app_owned_default_dir(",
                ),
            ],
        );
    }

    /// `engine_resource` keeps `#[cfg(windows)]` arms, so it cannot be pinned by
    /// `assert_removed_rows_are_ungated` (R1-03). This is the Directory arm's replacement pin:
    /// the arm must take the verified directory handle and its computed target, and must not
    /// regress to `take_file()` or a platform refusal (R3-04).
    #[test]
    fn engine_resource_directory_arm_takes_a_directory_and_target_without_refusals() {
        let source = source_for("infra/path_authority/mod.rs");
        let arm = braced_body(source, "EngineResourceHandleKind::Directory => {");
        let arm = compact(&source[arm]);
        assert!(arm.contains("resolved.take_directory()"), "{arm}");
        assert!(arm.contains("resolved.take_target()"), "{arm}");
        assert!(!arm.contains("resolved.take_file()"), "{arm}");
        assert!(!arm.contains("off_unix_refusal"), "{arm}");
    }

    #[test]
    fn post_rename_identity_uses_the_retained_handle() {
        let source = source_for("infra/fs.rs");
        let body = braced_body(source, "fn metadata(temp: &File)");
        let body = compact(&source[body]);
        assert!(body.contains("opened_file_identity(temp)"));
        assert!(!body.contains("Path::new"));
    }

    /// Phase 2 (d-20260918-09). Windows executable mode is a checked no-op, so it is no longer a
    /// remaining-refusal `body_rows` row (R2-01) and this source pin holds the counterpart that
    /// replaced it: the Windows arm must still check EngineInstall and that a file is present, then
    /// return `Ok(())`. Dropping either check, or restoring a platform refusal, reddens this test
    /// on Linux. The `#[cfg(windows)]` runtime half lives in `resolved.rs`, where a `ResolvedPath`
    /// can be constructed.
    #[test]
    fn mark_engine_executable_windows_is_a_checked_noop() {
        let source = source_for("infra/path_authority/resolved.rs");
        let starts = function_starts(source, "pub(crate) fn mark_engine_executable(");
        let counterparts = starts
            .iter()
            .copied()
            .filter(|start| direct_attribute(source, *start, "#[cfg(not(unix))]"))
            .collect::<Vec<_>>();
        assert_eq!(
            counterparts.len(),
            1,
            "expected exactly one non-unix mark_engine_executable"
        );
        let body = compact(&source[body_at(source, counterparts[0])]);
        assert!(
            body.contains("self.operation!=PathOperation::EngineInstall"),
            "the Windows no-op must still check the operation: {body}"
        );
        assert!(
            body.contains(
                r#"self.file.as_ref().ok_or_else(||Error::InvalidInput("engine target is a directory".into()))?"#
            ),
            "the Windows no-op must still check that a file is present: {body}"
        );
        assert!(body.contains("Ok(())"), "{body}");
        assert!(!body.contains("unsupported"), "{body}");
        assert!(!body.contains("off_unix_refusal"), "{body}");
    }

    /// R2-03. Installed-engine registration must propagate executable-mark failures, perform the
    /// mark before persistence, and must not re-acquire the off-unix refusal. The deleted command
    /// must not return in either source file.
    ///
    /// Staged-failure matrix (2026-09-20; each break changed the real source read by `source_for`
    /// and was restored before the next run; the verifier assertions were never edited):
    /// - Dropped `?` from `resolved.mark_engine_executable()?` (with `let _ =`): assertion (a)
    ///   printed `register_installed_engine must propagate executable-mark errors with ?`; exit
    ///   status 101.
    /// - Moved the executable-mark call after `register_engine_file_from_resolved(`: assertion
    ///   (b) printed `register_installed_engine must mark executable before persistence`; exit
    ///   status 101.
    /// - Inserted an `off_unix_refusal` mention into the registration body: assertion (c) printed
    ///   `register_installed_engine must not contain an off-unix refusal`; exit status 101.
    /// - Reintroduced `set_file_as_executable` into `fs.rs`: assertion (d) printed
    ///   `deleted executable command must be absent from fs.rs and main.rs`; exit status 101.
    #[test]
    fn register_installed_engine_marks_executable_without_off_unix_refusal() {
        let source = source_for("infra/path_authority/mod.rs");
        let body =
            compact(&source[braced_body(source, "pub(crate) fn register_installed_engine(")]);
        assert!(
            body.contains(".mark_engine_executable()?"),
            "register_installed_engine must propagate executable-mark errors with ?"
        );
        let mark = body
            .find(".mark_engine_executable()?")
            .expect("the executable-mark call was asserted above");
        let register = body
            .find("register_engine_file_from_resolved(")
            .expect("the registration call must be present");
        assert!(
            mark < register,
            "register_installed_engine must mark executable before persistence"
        );
        assert!(
            !body.contains("off_unix_refusal"),
            "register_installed_engine must not contain an off-unix refusal"
        );
        let fs = source_for("fs.rs");
        let main = source_for("main.rs");
        assert!(
            !fs.contains("set_file_as_executable") && !main.contains("set_file_as_executable"),
            "deleted executable command must be absent from fs.rs and main.rs"
        );
    }

    fn source_for(file: &str) -> &'static str {
        match file {
            "infra/path_authority/mod.rs" => include_str!("path_authority/mod.rs"),
            "infra/path_authority/resolved.rs" => include_str!("path_authority/resolved.rs"),
            "infra/fs.rs" => include_str!("fs.rs"),
            "fs.rs" => include_str!("../fs.rs"),
            "chesscom.rs" => include_str!("../chesscom.rs"),
            "credentials.rs" => include_str!("../credentials.rs"),
            "main.rs" => include_str!("../main.rs"),
            "oauth.rs" => include_str!("../oauth.rs"),
            "puzzle.rs" => include_str!("../puzzle.rs"),
            "db/repository.rs" => include_str!("../db/repository.rs"),
            "db/search.rs" => include_str!("../db/search.rs"),
            "db/search_index.rs" => include_str!("../db/search_index.rs"),
            "db/mod.rs" => include_str!("../db/mod.rs"),
            "file_workspace.rs" => include_str!("../file_workspace.rs"),
            "pgn.rs" => include_str!("../pgn.rs"),
            other => panic!("unknown source-test file {other}"),
        }
    }

    fn module_source(file: &str) -> &'static str {
        match file {
            "main.rs" => include_str!("../main.rs"),
            "infra/mod.rs" => include_str!("mod.rs"),
            "infra/path_authority/mod.rs" => include_str!("path_authority/mod.rs"),
            "db/mod.rs" => include_str!("../db/mod.rs"),
            other => panic!("unknown module source {other}"),
        }
    }

    fn module_declarations(file: &str) -> &'static [(&'static str, &'static str)] {
        match file {
            "fs.rs" => &[("main.rs", "mod fs;")],
            "chesscom.rs" => &[("main.rs", "mod chesscom;")],
            "oauth.rs" => &[("main.rs", "mod oauth;")],
            "puzzle.rs" => &[("main.rs", "mod puzzle;")],
            "infra/fs.rs" => &[("main.rs", "mod infra;"), ("infra/mod.rs", "pub mod fs;")],
            "infra/path_authority/mod.rs" => &[
                ("main.rs", "mod infra;"),
                ("infra/mod.rs", "pub mod path_authority;"),
            ],
            "infra/path_authority/resolved.rs" => &[
                ("main.rs", "mod infra;"),
                ("infra/mod.rs", "pub mod path_authority;"),
                ("infra/path_authority/mod.rs", "mod resolved;"),
            ],
            "file_workspace.rs" => &[("main.rs", "mod file_workspace;")],
            "pgn.rs" => &[("main.rs", "mod pgn;")],
            "db/mod.rs" => &[("main.rs", "mod db;")],
            "db/repository.rs" => &[("main.rs", "mod db;"), ("db/mod.rs", "mod repository;")],
            "db/search.rs" => &[("main.rs", "mod db;"), ("db/mod.rs", "mod search;")],
            other => panic!("unknown module declaration chain for {other}"),
        }
    }

    fn rust_source_paths() -> Vec<std::path::PathBuf> {
        let root = concat!(env!("CARGO_MANIFEST_DIR"), "/src");
        let mut paths = Vec::new();
        let mut stack = vec![std::path::PathBuf::from(root)];
        while let Some(path) = stack.pop() {
            let metadata = std::fs::metadata(&path).unwrap();
            if metadata.is_dir() {
                for entry in std::fs::read_dir(path).unwrap() {
                    stack.push(entry.unwrap().path());
                }
            } else if path.extension().and_then(|extension| extension.to_str()) == Some("rs") {
                paths.push(path);
            }
        }
        paths
    }

    fn body_from_opening(normalised: &str, opening: usize) -> Range<usize> {
        let mut depth = 0;
        for (offset, byte) in normalised.as_bytes()[opening..].iter().enumerate() {
            match byte {
                b'{' => depth += 1,
                b'}' => {
                    depth -= 1;
                    if depth == 0 {
                        return opening..opening + offset + 1;
                    }
                }
                _ => {}
            }
        }
        panic!("unterminated source body")
    }

    fn body_at(source: &str, start: usize) -> Range<usize> {
        let normalised = normalise(source, Literals::Blank);
        let opening = normalised[start..]
            .find('{')
            .map(|offset| start + offset)
            .unwrap_or_else(|| panic!("source item has no body"));
        body_from_opening(&normalised, opening)
    }

    fn function_starts(source: &str, signature: &str) -> Vec<usize> {
        normalise(source, Literals::Blank)
            .match_indices(signature)
            .map(|(start, _)| start)
            .collect()
    }

    fn attribute_lines_before(source: &str, start: usize) -> Vec<&str> {
        let mut cursor = source[..start].rfind('\n').map_or(0, |offset| offset + 1);
        let mut attributes = Vec::new();
        while cursor > 0 {
            let previous_end = cursor - 1;
            let previous_start = source[..previous_end]
                .rfind('\n')
                .map_or(0, |offset| offset + 1);
            let trimmed = source[previous_start..previous_end]
                .trim_end_matches('\r')
                .trim();
            if trimmed.is_empty() || trimmed.starts_with("//") {
                // A comment or doc comment between an attribute and its item does not
                // detach the attribute, so skipping it is what the compiler does. Breaking
                // here instead would hide a `#[cfg(unix)]` sitting above a doc comment and
                // let a refusal site be compiled out off-Unix without tripping any pin.
                cursor = previous_start;
            } else if trimmed.starts_with("#[") || trimmed.starts_with("#![") {
                attributes.push(trimmed);
                cursor = previous_start;
            } else {
                break;
            }
        }
        attributes
    }

    fn direct_attribute(source: &str, start: usize, expected: &str) -> bool {
        attribute_lines_before(source, start)
            .first()
            .is_some_and(|attribute| *attribute == expected)
    }

    /// Phase 3 emptied `body_rows()`, so the per-row verifier below has no rows to walk. It is
    /// retained rather than deleted: the next refusal row revives it wholesale, and the row list
    /// — not the verifier — is what the phase boundary emptied.
    #[allow(dead_code)]
    struct CfgBlock {
        attribute_start: usize,
        block: Range<usize>,
        is_not_unix: bool,
    }

    #[allow(dead_code)]
    fn top_level_cfg_blocks(source: &str, body: &Range<usize>) -> Vec<CfgBlock> {
        let normalised = normalise(source, Literals::Blank);
        let mut blocks = Vec::new();
        let mut depth = 1;
        let mut cursor = body.start + 1;
        while cursor < body.end - 1 {
            if depth == 1 && normalised[cursor..].starts_with("#[cfg(") {
                let attribute_end = normalised[cursor..]
                    .find(']')
                    .map(|offset| cursor + offset + 1)
                    .unwrap_or(cursor);
                let attribute = compact(&source[cursor..attribute_end]);
                let is_unix = attribute == "#[cfg(unix)]";
                let is_not_unix = attribute == "#[cfg(not(unix))]";
                if is_unix || is_not_unix {
                    let mut opening = attribute_end;
                    while opening < body.end && normalised.as_bytes()[opening].is_ascii_whitespace()
                    {
                        opening += 1;
                    }
                    if normalised.as_bytes().get(opening) == Some(&b'{') {
                        let block = body_from_opening(&normalised, opening);
                        blocks.push(CfgBlock {
                            attribute_start: cursor,
                            block: block.clone(),
                            is_not_unix,
                        });
                        cursor = block.end;
                        continue;
                    }
                }
            }
            match normalised.as_bytes()[cursor] {
                b'{' => depth += 1,
                b'}' => depth -= 1,
                _ => {}
            }
            cursor += 1;
        }
        blocks
    }

    #[allow(dead_code)]
    fn effective_non_unix_body(source: &str, body: &Range<usize>, blocks: &[CfgBlock]) -> String {
        let mut effective = String::new();
        let mut cursor = body.start;
        for block in blocks {
            effective.push_str(&source[cursor..block.attribute_start]);
            if block.is_not_unix {
                effective.push_str(&source[block.block.start + 1..block.block.end - 1]);
            }
            cursor = block.block.end;
        }
        effective.push_str(&source[cursor..body.end]);
        effective
    }

    /// Every enclosing `impl`/`mod` scope, with the offset of its *declaration* — not of its
    /// opening brace. A multi-line header (`impl Foo\n{`, a `where` clause, a long generic list)
    /// would otherwise make the caller scan for attributes above the `{` line, find the tail of
    /// the declaration, and conclude the scope carries no cfg.
    /// `impl<` is listed because `impl<T>` has no space; `unsafe impl` still matches `impl `.
    fn scope_blocks(source: &str) -> Vec<(String, usize, Range<usize>)> {
        let normalised = normalise(source, Literals::Blank);
        let mut scopes = Vec::new();
        for keyword in ["impl ", "impl<", "mod "] {
            for (start, _) in normalised.match_indices(keyword) {
                let Some(opening_offset) = normalised[start..].find('{') else {
                    continue;
                };
                let opening = start + opening_offset;
                if normalised[start..opening].contains(';') {
                    continue;
                }
                let body = body_from_opening(&normalised, opening);
                scopes.push((compact(&source[start..opening]), start, body));
            }
        }
        scopes
    }

    fn check_scope_and_modules(
        file: &str,
        source: &str,
        item_start: usize,
        errors: &mut Vec<String>,
    ) {
        for (scope, declaration_start, body) in scope_blocks(source) {
            if body.start < item_start
                && item_start < body.end
                && attribute_lines_before(source, declaration_start)
                    .iter()
                    .any(|attribute| attribute.contains("#[cfg") || attribute.contains("cfg_attr"))
            {
                errors.push(format!("{file}: enclosing scope {scope} carries cfg"));
            }
        }
        for (module_file, declaration) in module_declarations(file) {
            let module = module_source(module_file);
            let normalised = normalise(module, Literals::Blank);
            if normalised.matches(declaration).count() != 1 {
                errors.push(format!(
                    "{file}: module declaration {module_file}:{declaration} is not unique"
                ));
                continue;
            }
            let start = normalised
                .find(declaration)
                .expect("module declaration was found");
            if attribute_lines_before(module, start)
                .iter()
                .any(|attribute| attribute.contains("#[cfg") || attribute.contains("cfg_attr"))
            {
                errors.push(format!(
                    "{file}: module declaration {module_file}:{declaration} carries cfg"
                ));
            }
        }
    }

    fn check_function_attributes(
        file: &str,
        source: &str,
        signature: &str,
        start: usize,
        allow_direct_non_unix: bool,
        errors: &mut Vec<String>,
    ) {
        for attribute in attribute_lines_before(source, start) {
            if attribute.contains("#[cfg") || attribute.contains("cfg_attr") {
                let allowed = allow_direct_non_unix && attribute == "#[cfg(not(unix))]";
                if !allowed {
                    errors.push(format!("{file}: {signature} carries forbidden {attribute}"));
                }
            }
        }
    }

    #[allow(dead_code)]
    enum ExpectedBody {
        /// No remaining refusal row is a bare counterpart after Phase 2 ported
        /// `mark_engine_executable` (d-20260918-09, R2-01). The variant stays so the verifier
        /// keeps matching the plan's row forms, and is revived by any future refusal row.
        #[allow(dead_code)]
        Refusal(&'static str),
        Exact(&'static str),
    }

    #[allow(dead_code)]
    impl ExpectedBody {
        fn compact(&self) -> String {
            match self {
                Self::Refusal(operation) => format!(
                    "{{Err(crate::infra::platform_support::unsupported(\"{operation}\",))}}"
                ),
                Self::Exact(body) => (*body).to_owned(),
            }
        }
    }

    #[allow(dead_code)]
    #[derive(Clone, Copy)]
    enum BodyForm {
        /// See `ExpectedBody::Refusal`: the last counterpart row was deleted in Phase 2.
        #[allow(dead_code)]
        Counterpart,
        Block,
    }

    #[allow(dead_code)]
    struct BodyRow {
        file: &'static str,
        signature: &'static str,
        form: BodyForm,
        expected: ExpectedBody,
    }

    fn body_rows() -> &'static [BodyRow] {
        &[]
    }

    #[allow(dead_code)]
    fn check_source_pin(row: &BodyRow, source: &str, errors: &mut Vec<String>) {
        let label = format!("{}: {}", row.file, row.signature);
        let starts = function_starts(source, row.signature);
        let candidates = starts
            .iter()
            .copied()
            .filter(|start| match row.form {
                BodyForm::Counterpart => direct_attribute(source, *start, "#[cfg(not(unix))]"),
                BodyForm::Block => {
                    let body = body_at(source, *start);
                    top_level_cfg_blocks(source, &body)
                        .iter()
                        .any(|block| block.is_not_unix)
                        && !direct_attribute(source, *start, "#[cfg(not(unix))]")
                }
            })
            .collect::<Vec<_>>();
        if candidates.len() != 1 {
            errors.push(format!(
                "{label}: expected exactly one {} form, found {}",
                match row.form {
                    BodyForm::Counterpart => "Counterpart",
                    BodyForm::Block => "Block",
                },
                candidates.len()
            ));
        }
        let Some(start) = candidates
            .first()
            .copied()
            .or_else(|| starts.first().copied())
        else {
            errors.push(format!("{label}: function signature missing"));
            return;
        };
        check_function_attributes(
            row.file,
            source,
            row.signature,
            start,
            matches!(row.form, BodyForm::Counterpart),
            errors,
        );
        check_scope_and_modules(row.file, source, start, errors);
        let body = body_at(source, start);
        let blocks = top_level_cfg_blocks(source, &body);
        let effective = match row.form {
            BodyForm::Counterpart => source[body.clone()].to_owned(),
            BodyForm::Block => effective_non_unix_body(source, &body, &blocks),
        };
        let actual = compact(&effective);
        if actual != row.expected.compact() {
            errors.push(format!(
                "{label}: effective non-unix body changed: {actual}"
            ));
        }
        let normalised = normalise(&effective, Literals::Blank);
        if normalised.contains("#[cfg")
            || normalised.contains("cfg!(")
            || normalised.contains("cfg_attr")
        {
            errors.push(format!(
                "{label}: effective body contains an unpermitted cfg"
            ));
        }
        for crate_start in actual.match_indices("crate::").map(|(offset, _)| offset) {
            let Some(open) = actual[crate_start..].find('(') else {
                continue;
            };
            let path = &actual[crate_start..crate_start + open];
            let allowed = [
                "crate::infra::platform_support::unsupported",
                "crate::infra::platform_support::unsupported_plural",
                "crate::infra::platform_support::off_unix_refusal",
            ];
            if !allowed.contains(&path) {
                errors.push(format!(
                    "{label}: effective body calls unpinned crate function {path}"
                ));
            }
        }
    }

    struct GuardRow {
        file: &'static str,
        signature: &'static str,
        operation: &'static str,
        effects: &'static [&'static str],
        nested: bool,
    }

    fn guard_rows() -> &'static [GuardRow] {
        &[
            GuardRow {
                file: "oauth.rs",
                signature: "pub async fn authenticate(",
                operation: "Lichess authentication",
                effects: &["create_job("],
                nested: false,
            },
            GuardRow {
                file: "oauth.rs",
                signature: "pub async fn migrate_legacy_lichess_token(",
                operation: "legacy Lichess token migration",
                effects: &["ProdOAuthServices::new("],
                nested: false,
            },
            GuardRow {
                file: "infra/path_authority/resolved.rs",
                signature: "pub(crate) fn replace_pgn_atomic<F>(",
                operation: "PGN atomic replacement",
                effects: &["atomic_replace_at_with_precommit("],
                nested: false,
            },
            GuardRow {
                file: "pgn.rs",
                signature: "pub async fn delete_game(",
                operation: "PGN atomic replacement",
                effects: &["operations.accept("],
                nested: false,
            },
            GuardRow {
                file: "pgn.rs",
                signature: "pub async fn write_game(",
                operation: "PGN atomic replacement",
                effects: &["operations.accept("],
                nested: false,
            },
            GuardRow {
                file: "db/mod.rs",
                signature: "pub async fn export_to_pgn(",
                operation: "PGN atomic replacement",
                effects: &["operations.accept("],
                nested: false,
            },
        ]
    }

    #[test]
    fn refusal_guards_are_first_statements_and_precede_their_effects() {
        let mut errors = Vec::new();
        for row in guard_rows() {
            let source = source_for(row.file);
            let starts = function_starts(source, row.signature);
            if starts.len() != 1 {
                errors.push(format!(
                    "{}: {}: expected one function, found {}",
                    row.file,
                    row.signature,
                    starts.len()
                ));
                continue;
            }
            let start = starts[0];
            check_function_attributes(row.file, source, row.signature, start, false, &mut errors);
            check_scope_and_modules(row.file, source, start, &mut errors);
            let body = body_at(source, start);
            let normalised = normalise(source, Literals::Blank);
            let guard = "crate::infra::platform_support::off_unix_refusal(";
            let guard_starts = normalised[body.start..body.end]
                .match_indices(guard)
                .map(|(offset, _)| body.start + offset)
                .collect::<Vec<_>>();
            if guard_starts.len() != 1 {
                errors.push(format!(
                    "{}: {}: expected one refusal guard, found {}",
                    row.file,
                    row.signature,
                    guard_starts.len()
                ));
                continue;
            }
            let guard_start = guard_starts[0];
            let Some(statement_end) = normalised[guard_start..body.end]
                .find(';')
                .map(|offset| guard_start + offset + 1)
            else {
                errors.push(format!(
                    "{}: {}: guard statement is unterminated",
                    row.file, row.signature
                ));
                continue;
            };
            let raw_statement = compact(&source[guard_start..statement_end]);
            let expected = if row.operation == "engine directory resources" {
                format!(
                    "crate::infra::platform_support::off_unix_refusal(\"{}\",cfg!(unix),)?;",
                    row.operation
                )
            } else {
                format!(
                    "crate::infra::platform_support::off_unix_refusal(\"{}\",cfg!(unix))?;",
                    row.operation
                )
            };
            if raw_statement != expected {
                errors.push(format!(
                    "{}: {}: guard changed: {raw_statement}",
                    row.file, row.signature
                ));
            }
            let before = &normalised[body.start + 1..guard_start];
            let depth = before.bytes().fold(1_i32, |depth, byte| match byte {
                b'{' => depth + 1,
                b'}' => depth - 1,
                _ => depth,
            });
            if row.nested {
                let if_signature = "if resource.kind == EngineResourceHandleKind::Directory";
                let if_body = braced_body(source, if_signature);
                let if_start = normalised[..if_body.start].rfind(if_signature);
                if let Some(if_start) = if_start {
                    if !normalised[body.start + 1..if_start]
                        .chars()
                        .all(char::is_whitespace)
                        || !normalised[if_body.start + 1..guard_start]
                            .chars()
                            .all(char::is_whitespace)
                        || !normalised[statement_end..if_body.end - 1]
                            .chars()
                            .all(char::is_whitespace)
                    {
                        errors.push(format!(
                            "{}: {}: directory guard block changed",
                            row.file, row.signature
                        ));
                    }
                } else {
                    errors.push(format!(
                        "{}: {}: directory guard scope missing",
                        row.file, row.signature
                    ));
                }
                if depth != 2 {
                    errors.push(format!(
                        "{}: {}: guard depth changed",
                        row.file, row.signature
                    ));
                }
            } else {
                if !before.chars().all(char::is_whitespace) {
                    errors.push(format!(
                        "{}: {}: guard is not first statement",
                        row.file, row.signature
                    ));
                }
                if depth != 1 {
                    errors.push(format!(
                        "{}: {}: guard depth changed",
                        row.file, row.signature
                    ));
                }
            }
            if normalised[body.start..guard_start].contains("#[") {
                errors.push(format!(
                    "{}: {}: guard has an attached attribute",
                    row.file, row.signature
                ));
            }
            for effect in row.effects {
                if !normalised[statement_end..body.end].contains(effect) {
                    errors.push(format!(
                        "{}: {}: effect {effect} no longer follows guard",
                        row.file, row.signature
                    ));
                }
            }
        }
        assert!(
            errors.is_empty(),
            "refusal guard pins failed:\n{}",
            errors.join("\n")
        );
    }

    /// Phase 3 ported the last two refusal bodies (`atomic_install_dir`,
    /// `atomic_install_download_dir`), so `body_rows()` is now the empty remaining-refusal list.
    /// The per-row loop above is gone rather than left vacuous; what is left to pin is the count
    /// itself, so a re-added refusal row fails here and in `assert_removed_rows_are_ungated`.
    #[test]
    fn remaining_refusal_body_rows_are_none() {
        assert!(
            body_rows().is_empty(),
            "refusal body rows remain: {}",
            body_rows().len()
        );
    }

    /// Pin (1) of the `f-20260914-15` completeness unit (d-20260918-13). In production regions
    /// the helper token `.replace_pgn_atomic(` may occur exactly once, in `edit_existing`, and
    /// exactly once, in `export_to_pgn_blocking`; every other file's production region holds none.
    /// The definition is `fn replace_pgn_atomic<F>(`, which this token cannot match, so a third
    /// production call site — including a test helper above `mod tests` — is the regression.
    /// Scanning is `Literals::Blank`, so a comment or a string literal cannot hide or fake a call.
    #[test]
    fn production_replace_pgn_atomic_calls_are_only_edit_existing_and_export_to_pgn_blocking() {
        let expected = [
            ("pgn.rs", "edit_existing"),
            ("db/mod.rs", "export_to_pgn_blocking"),
        ];
        let mut errors = Vec::new();
        for_each_production_region(|key, source, normalised| {
            let count = normalised.matches(".replace_pgn_atomic(").count();
            match expected.iter().find(|(file, _)| *file == key) {
                Some((_, function)) => {
                    if count != 1 {
                        errors.push(format!(
                            "{key}: expected one production .replace_pgn_atomic( call, found {count}"
                        ));
                        return;
                    }
                    let call = normalised
                        .find(".replace_pgn_atomic(")
                        .expect("the counted call exists");
                    match enclosing_function_name(source, call) {
                        Some(name) if name == *function => {}
                        other => errors.push(format!(
                            "{key}: .replace_pgn_atomic( must be in {function}, enclosing {other:?}"
                        )),
                    }
                }
                None => {
                    if count != 0 {
                        errors.push(format!(
                            "{key}: {count} production .replace_pgn_atomic( call(s) outside edit_existing and export_to_pgn_blocking"
                        ));
                    }
                }
            }
        });
        assert!(
            errors.is_empty(),
            "production replace_pgn_atomic call pin failed:\n{}",
            errors.join("\n")
        );
    }

    /// Pin (2) of the `f-20260914-15` completeness unit (d-20260918-13). Every node on the
    /// `replace_pgn_atomic` path may be called from production code only by the functions that
    /// lead to the three guarded commands; a callee's own definition sits outside any body and is
    /// allowed. This is what catches a new `#[tauri::command]` in any file that calls a `pub`
    /// core, or a new private wrapper around `commit_pgn_mutation`. Enclosing identity is the
    /// nearest preceding `fn <name>` whose brace region still contains the call offset.
    #[test]
    fn production_calls_of_every_pgn_atomic_path_node_are_only_from_allowed_callers() {
        let rows: &[(&str, &[&str])] = &[
            (
                "replace_pgn_atomic",
                &["edit_existing", "export_to_pgn_blocking"],
            ),
            ("edit_existing", &["commit_pgn_mutation"]),
            (
                "commit_pgn_mutation",
                &["delete_game_core", "write_game_core"],
            ),
            ("delete_game_core", &["delete_game"]),
            ("write_game_core", &["write_game"]),
            ("export_to_pgn_blocking", &["export_to_pgn"]),
        ];
        let mut errors = Vec::new();
        for_each_production_region(|key, source, normalised| {
            for (callee, allowed) in rows {
                let token = format!("{callee}(");
                for (call, _) in normalised.match_indices(&token) {
                    let Some(enclosing) = enclosing_function_name(source, call) else {
                        // A callee's own declaration: the signature is outside every body.
                        continue;
                    };
                    if !allowed.contains(&enclosing.as_str()) {
                        errors.push(format!(
                            "{key}: {callee} called from {enclosing}, allowed {allowed:?}"
                        ));
                    }
                }
            }
        });
        assert!(
            errors.is_empty(),
            "production PGN atomic-path caller pin failed:\n{}",
            errors.join("\n")
        );
    }

    /// Every production `off_unix_refusal(` call goes through `crate::infra::platform_support::`
    /// and is a `guard_rows` site. A new first-statement (or late) refusal that is not a row
    /// would leave the PGN call-graph pins green.
    #[test]
    fn production_off_unix_refusal_calls_match_guard_rows() {
        let mut count = 0;
        for_each_production_region(|_, _, normalised| {
            count += normalised
                .matches("crate::infra::platform_support::off_unix_refusal(")
                .count();
        });
        assert_eq!(
            count,
            guard_rows().len(),
            "production off_unix_refusal calls {count} != guard_rows {}",
            guard_rows().len()
        );
    }

    fn for_each_production_region(mut visit: impl FnMut(&str, &str, &str)) {
        for path in rust_source_paths() {
            let source = std::fs::read_to_string(&path).unwrap();
            let key = file_key(&path);
            let production = production_region(&source);
            let normalised = normalise(production, Literals::Blank);
            visit(&key, &source, &normalised);
        }
    }

    /// The production region of one scanned file: everything before the first `mod tests` whose
    /// preceding attributes mention `test` (`#[cfg(test)]`, `#[cfg(all(test, unix))]`,
    /// `#[cfg(all(test, windows))]`). A file with no such module is scanned whole. Splitting on
    /// the attribute substring is what keeps `db/mod.rs`'s `#[cfg(all(test, unix))]` test body
    /// out of production (R2-01); the token-boundary check keeps `mod tests_support` from
    /// ending the region.
    fn production_region(source: &str) -> &str {
        let normalised = normalise(source, Literals::Blank);
        for (start, _) in normalised.match_indices("mod tests") {
            let end = start + "mod tests".len();
            if normalised
                .as_bytes()
                .get(end)
                .is_some_and(|byte| byte.is_ascii_alphanumeric() || *byte == b'_')
            {
                continue;
            }
            if attribute_lines_before(source, start)
                .iter()
                .any(|attribute| attribute.contains("test"))
            {
                return &source[..start];
            }
        }
        source
    }

    /// The `src`-relative slash-joined key of a scanned path, so the two expected files can be
    /// named the same way `source_for` names them on every host.
    fn file_key(path: &std::path::Path) -> String {
        let root = std::path::Path::new(concat!(env!("CARGO_MANIFEST_DIR"), "/src"));
        path.strip_prefix(root)
            .unwrap_or(path)
            .components()
            .map(|component| component.as_os_str().to_string_lossy().into_owned())
            .collect::<Vec<_>>()
            .join("/")
    }

    /// The nearest preceding `fn <name>` whose brace region contains `call`, or `None` when
    /// `call` is a function's own declaration. A `fn` whose opening brace follows the call cannot
    /// enclose it; a `fn` that closed before the call is skipped in favour of the next outer one,
    /// so a call is never attributed to an unrelated earlier function.
    fn enclosing_function_name(source: &str, call: usize) -> Option<String> {
        let normalised = normalise(source, Literals::Blank);
        let mut search_end = call;
        while let Some(start) = normalised[..search_end].rfind("fn ") {
            let name = normalised[start + "fn ".len()..]
                .chars()
                .take_while(|character| character.is_ascii_alphanumeric() || *character == '_')
                .collect::<String>();
            if !name.is_empty() {
                if let Some(opening) = normalised[start..].find('{').map(|offset| start + offset) {
                    if call > opening && brace_depth_at(&normalised, opening, call) > 0 {
                        return Some(name);
                    }
                }
            }
            search_end = start;
        }
        None
    }

    /// The brace depth at `call` measured from an opening `{` at `opening`; zero or less means the
    /// block closed before `call`.
    fn brace_depth_at(normalised: &str, opening: usize, call: usize) -> i32 {
        let mut depth = 0_i32;
        for byte in normalised.as_bytes()[opening..call].iter() {
            match byte {
                b'{' => depth += 1,
                b'}' => depth -= 1,
                _ => {}
            }
        }
        depth
    }

    /// The half of `check_helper` that pins the *shape* of a helper: exactly one declaration of
    /// this signature in the file, carrying no `cfg` of its own, spelled exactly as recorded.
    /// Returns the body range so a caller can pin the body as well. Extracted because
    /// `workspace_bodies_are_single_ungated_delegations` needs precisely these three checks —
    /// a reappearing `#[cfg(not(unix))]` counterpart is a second declaration, and gating the
    /// survivor is a `cfg` on the one that is left — for bodies far too large to pin verbatim.
    fn check_declaration(
        file: &str,
        source: &str,
        signature: &str,
        declaration: &str,
        errors: &mut Vec<String>,
    ) -> Option<Range<usize>> {
        let starts = function_starts(source, signature);
        if starts.len() != 1 {
            errors.push(format!(
                "{file}: {signature}: expected one declaration, found {}",
                starts.len()
            ));
            return None;
        }
        let start = starts[0];
        if attribute_lines_before(source, start)
            .iter()
            .any(|attribute| attribute.contains("#[cfg") || attribute.contains("cfg_attr"))
        {
            errors.push(format!("{file}: {signature}: declaration carries cfg"));
        }
        let body = body_at(source, start);
        let actual_declaration = compact(&source[start..body.start]);
        if actual_declaration != declaration {
            errors.push(format!(
                "{file}: {signature}: declaration changed: {actual_declaration}"
            ));
        }
        Some(body)
    }

    fn check_helper(
        file: &str,
        source: &str,
        signature: &str,
        declaration: &str,
        expected_body: &str,
        errors: &mut Vec<String>,
    ) {
        let Some(body) = check_declaration(file, source, signature, declaration, errors) else {
            return;
        };
        let actual_body = compact(&source[body]);
        if actual_body != expected_body {
            errors.push(format!("{file}: {signature}: body changed: {actual_body}"));
        }
    }

    /// D5a. Once `f-20260914-08` deleted the four `file_workspace.rs` rows from `body_rows()`,
    /// `non_unix_counterparts_have_only_typed_refusal_bodies` stopped being able to notice their
    /// return: it checks listed rows and explicitly disclaims closed-world completeness
    /// (`f-20260916-01`). This is the replacement, and it executes on Linux: each of the four
    /// workspace entry points must be ONE declaration, un-gated, delegating to the
    /// path-authority or descriptor-relative call that does the work. Restoring a
    /// `#[cfg(not(unix))]` counterpart makes it two declarations and gates the survivor, so this
    /// reddens the Linux run rather than only `rust-windows-test`.
    #[test]
    fn workspace_bodies_are_single_ungated_delegations() {
        // `collect_tree_entries` and `paired_rename` have bodies of 180 and 45 lines, so the
        // pinned property is the delegation call each one may not lose, not the whole body.
        let rows: &[(&str, &str, &[&str])] = &[
            (
                "fn mutation_target(",
                "fnmutation_target(pgn_path_authority:&Mutex<Option<PathAuthority>>,entry:&FileWorkspaceHandle,)->Result<WorkspaceMutationTarget,Error>",
                &[".workspace_mutation_target(entry)"],
            ),
            (
                "fn register_created_entry(",
                "fnregister_created_entry(pgn_path_authority:&Mutex<Option<PathAuthority>>,workspace:&FileWorkspaceHandle,path:&Path,display_name:String,identity:(u64,u64),is_dir:bool,)->Result<FileWorkspaceHandle,Error>",
                &[".register_workspace_child_observed("],
            ),
            (
                "fn collect_tree_entries(",
                "fncollect_tree_entries(pgn_path_authority:&Mutex<Option<PathAuthority>>,workspace:&FileWorkspaceHandle,token:&CancellationToken,)->Result<(Vec<WorkspaceEntry>,Vec<FileWorkspaceHandle>),Error>",
                &[
                    ".capability_directory(workspace.path_ref(),PathOperation::ReadPgn)?",
                    "dir.entries(token,&mut|name|",
                    "dir.open_child_directory(&entry)?",
                    "dir.confirm_entry(entry)",
                ],
            ),
            (
                "fn paired_rename(",
                "fnpaired_rename(source:&WorkspaceMutationTarget,target_parent:&fs::File,target_leaf:&std::ffi::OsStr,)->Result<(),Error>",
                &["rename_entry_at(", "rename_optional_regular_at("],
            ),
        ];
        let source = source_for("file_workspace.rs");
        let mut errors = Vec::new();
        for (signature, declaration, delegations) in rows {
            let Some(body) = check_declaration(
                "file_workspace.rs",
                source,
                signature,
                declaration,
                &mut errors,
            ) else {
                continue;
            };
            let compacted = compact(&source[body]);
            for delegation in *delegations {
                if !compacted.contains(delegation) {
                    errors.push(format!(
                        "file_workspace.rs: {signature}: lost delegation {delegation}"
                    ));
                }
            }
            if compacted.contains("platform_support::") {
                errors.push(format!(
                    "file_workspace.rs: {signature}: a platform refusal came back"
                ));
            }
            if compacted.contains("#[cfg(not(unix))]") || compacted.contains("#[cfg(unix)]") {
                errors.push(format!(
                    "file_workspace.rs: {signature}: body split by a platform cfg"
                ));
            }
        }
        assert!(
            errors.is_empty(),
            "workspace delegation pins failed:\n{}",
            errors.join("\n")
        );
    }

    fn unported_marker(finding: &str) -> String {
        format!(
            "#[cfg_attr(not(unix), ignore = \"unported on this {}: {finding}\")]",
            "platform"
        )
    }

    /// D5b. `#[cfg_attr(not(unix), ignore)]` makes `rust-windows-test` print `ignored` and still
    /// exit 0, and the Linux run executes the test either way, so nothing goes red if a marker
    /// stays. This is the assertion that the eleven `f-20260914-08` markers are gone — and that
    /// the four `f-20260914-10` ones, whose tests still reach the refusing `replace_pgn_atomic`,
    /// were not removed with them.
    #[test]
    fn pgn_tests_carry_no_unported_marker_for_this_finding() {
        let source = source_for("pgn.rs");
        assert_eq!(
            source.matches(&unported_marker("f-20260914-08")).count(),
            0,
            "the workspace-mutation port removes every f-20260914-08 marker in pgn.rs"
        );
        assert_eq!(
            source.matches(&unported_marker("f-20260914-10")).count(),
            4,
            "replace_pgn_atomic still refuses, so its four markers stay"
        );
    }

    /// The eighteen `f-20260914-11` markers are what kept the credential and startup tests from
    /// running on Windows. An ignore left behind prints `ignored` under `rust-windows-test` and
    /// still exits 0, so this pin is what makes a re-added marker fail on Linux.
    #[test]
    fn startup_registry_files_carry_no_unported_marker_for_this_finding() {
        for file in ["credentials.rs", "oauth.rs", "main.rs"] {
            assert_eq!(
                source_for(file)
                    .matches(&unported_marker("f-20260914-11"))
                    .count(),
                0,
                "{file} still carries an f-20260914-11 unported marker"
            );
        }
    }

    #[test]
    fn refusal_format_has_one_body() {
        let source = include_str!("platform_support.rs");
        let kept = normalise(source, Literals::Keep);
        let needle = ["unsupported on this ", "platform"].concat();
        let production = &kept[..kept.find("#[cfg(test)]").unwrap()];
        assert_eq!(production.matches(&needle).count(), 1);
        let mut errors = Vec::new();
        check_helper(
            "infra/platform_support.rs",
            source,
            "fn refusal(",
            "fnrefusal(subject:&str,verb:&str)->Error",
            r#"{Error::Conflict(format!("{subject} {verb} unsupported on this platform"))}"#,
            &mut errors,
        );
        check_helper(
            "infra/platform_support.rs",
            source,
            "pub(crate) fn unsupported(",
            "pub(crate)fnunsupported(operation:&str)->Error",
            r#"{refusal(operation,"is")}"#,
            &mut errors,
        );
        check_helper(
            "infra/platform_support.rs",
            source,
            "pub(crate) fn unsupported_plural(",
            "pub(crate)fnunsupported_plural(operations:&str)->Error",
            r#"{refusal(operations,"are")}"#,
            &mut errors,
        );
        check_helper(
            "infra/platform_support.rs",
            source,
            "pub(crate) fn off_unix_refusal(",
            "pub(crate)fnoff_unix_refusal(operation:&str,unix:bool)->Result<(),Error>",
            r#"{ifunix{Ok(())}else{Err(unsupported(operation))}}"#,
            &mut errors,
        );
        assert!(
            errors.is_empty(),
            "refusal helper pins failed:\n{}",
            errors.join("\n")
        );
    }

    #[test]
    fn refusal_constant_and_callees_are_exact() {
        let mut errors = Vec::new();
        let authority = source_for("infra/path_authority/mod.rs");
        let constant = "UNSUPPORTED_DIRECTORY_ENUMERATION";
        let normalised = normalise(authority, Literals::Keep);
        if normalised.matches(constant).count() != 0 {
            errors.push(
                "infra/path_authority/mod.rs: UNSUPPORTED_DIRECTORY_ENUMERATION was not removed"
                    .into(),
            );
        }
        check_helper(
            "infra/fs.rs",
            source_for("infra/fs.rs"),
            "pub(crate) fn single_leaf(",
            "pub(crate)fnsingle_leaf(leaf:&OsStr)->Result<(),Error>",
            r#"{ifcfg!(windows){ifletSome(reason)=crate::infra::path_authority::windows_component_refusal(leaf){returnErr(Error::InvalidInput(reason.into()));}}ifleaf.is_empty()||Path::new(leaf).file_name()!=Some(leaf){returnErr(Error::InvalidInput("leaf name must be one component".into(),));}Ok(())}"#,
            &mut errors,
        );
        check_helper(
            "infra/path_authority/mod.rs",
            authority,
            "fn validate_components(",
            "fnvalidate_components(components:&[OsString])->Result<(),Error>",
            r#"{fornameincomponents{letcomponent=name.as_os_str();ifcfg!(windows){ifletSome(reason)=windows_component_refusal(component){returnErr(Error::InvalidInput(reason.into()));}}ifcomponent.is_empty()||component==OsStr::new(".")||component==OsStr::new("..")||Path::new(component).components().count()!=1{returnErr(Error::InvalidInput("invalid relative path component".into(),));}#[cfg(unix)]{usestd::os::unix::ffi::OsStrExt;ifcomponent.as_bytes().contains(&b'/')||component.as_bytes().contains(&0){returnErr(Error::InvalidInput("path component contains a separator or NUL".into(),));}}}Ok(())}"#,
            &mut errors,
        );
        if let Some(start) = function_starts(authority, "fn validate_components(").first() {
            check_scope_and_modules(
                "infra/path_authority/mod.rs",
                authority,
                *start,
                &mut errors,
            );
        }
        if let Some(start) =
            function_starts(source_for("infra/fs.rs"), "pub(crate) fn single_leaf(").first()
        {
            check_scope_and_modules(
                "infra/fs.rs",
                source_for("infra/fs.rs"),
                *start,
                &mut errors,
            );
        }
        assert!(
            errors.is_empty(),
            "refusal constant and callee pins failed:\n{}",
            errors.join("\n")
        );
    }

    #[test]
    fn refusal_text_has_one_source() {
        let needle = ["unsupported on this ", "platform"].concat();
        let mut occurrences = Vec::new();
        for path in rust_source_paths() {
            let source = std::fs::read_to_string(&path).unwrap();
            let normalised = normalise(&source, Literals::Keep);
            for offset in normalised.match_indices(&needle).map(|(offset, _)| offset) {
                if path.file_name().and_then(|name| name.to_str()) != Some("platform_support.rs") {
                    occurrences.push(format!(
                        "{}:{}",
                        path.display(),
                        source[..offset].matches('\n').count() + 1
                    ));
                }
            }
        }
        assert!(
            occurrences.is_empty(),
            "unexpected refusal text: {occurrences:?}"
        );
    }

    #[test]
    fn routed_refusal_labels_are_unchanged() {
        let expected = [(
            "infra/path_authority/mod.rs",
            "post-rename marker timestamps",
            "unsupported_plural",
        )];
        let mut errors = Vec::new();
        for (file, operation, function) in expected {
            let source = source_for(file);
            let normalised = compact(&normalise(source, Literals::Keep));
            let needle = format!("crate::infra::platform_support::{function}(\"{operation}\")");
            let comma_needle = needle
                .strip_suffix(')')
                .map(|prefix| format!("{prefix},)"))
                .unwrap_or_default();
            if normalised.matches(&needle).count() == 0
                && normalised.matches(&comma_needle).count() == 0
            {
                errors.push(format!("{file}: missing routed refusal {operation}"));
            }
        }
        for file in [
            "infra/fs.rs",
            "infra/path_authority/mod.rs",
            "infra/path_authority/resolved.rs",
            "db/repository.rs",
            "db/mod.rs",
            "db/search.rs",
            "file_workspace.rs",
        ] {
            let source = source_for(file);
            let compacted = compact(&normalise(source, Literals::Keep));
            let call_count = compacted
                .matches("crate::infra::platform_support::unsupported(")
                .count()
                + compacted
                    .matches("crate::infra::platform_support::unsupported_plural(")
                    .count();
            let expected_count = expected.iter().filter(|row| row.0 == file).count();
            if call_count != expected_count {
                errors.push(format!(
                    "{file}: expected {expected_count} routed refusals, found {call_count}"
                ));
            }
        }
        let mut tree_count = 0;
        for path in rust_source_paths() {
            if path.file_name().and_then(|name| name.to_str()) != Some("platform_support.rs") {
                let source = std::fs::read_to_string(path).unwrap();
                let compacted = compact(&normalise(&source, Literals::Keep));
                tree_count += compacted
                    .matches("crate::infra::platform_support::unsupported(")
                    .count()
                    + compacted
                        .matches("crate::infra::platform_support::unsupported_plural(")
                        .count();
            }
        }
        if tree_count != expected.len() {
            errors.push(format!(
                "tree-wide routed refusal count: expected {}, found {tree_count}",
                expected.len()
            ));
        }
        assert!(
            errors.is_empty(),
            "routed refusal labels changed:\n{}",
            errors.join("\n")
        );
    }

    fn assert_in_order(body: &str, needles: &[&str]) {
        let mut cursor = 0;
        for needle in needles {
            let offset = body[cursor..]
                .find(needle)
                .unwrap_or_else(|| panic!("{needle:?} missing or out of order in {body}"));
            cursor += offset + needle.len();
        }
    }

    fn assert_no_retry_loop(body: &str) {
        for forbidden in ["loop{", "while", "for", "retry", "1224"] {
            assert!(!body.contains(forbidden), "{forbidden:?} in {body}");
        }
    }

    /// f-20260917-04. Generation takes the preferred-sidecar write-guard, mutates exactly once,
    /// then drops the guard. It does not take `generation_lock`: the loader already holds it.
    #[test]
    fn search_index_generation_mutates_once_under_begin_preferred_replace() {
        let source = source_for("db/mod.rs");
        let body = compact(&source[braced_body(source, "fn generate_search_index_locked(")]);
        assert_in_order(
            &body,
            &[
                "letreplace_guard=search_cache.begin_preferred_replace(target.path(),cancellation)?;",
                "search_index::write_entries_to_at(",
                "drop(replace_guard);",
            ],
        );
        assert_eq!(
            body.matches("begin_preferred_replace(").count(),
            1,
            "{body}"
        );
        assert_eq!(body.matches("write_entries_to_at(").count(), 1, "{body}");
        assert!(!body.contains("generation_lock"), "{body}");
        let guarded = &body[body.find("begin_preferred_replace(").unwrap()
            ..body.find("drop(replace_guard);").unwrap()];
        assert_no_retry_loop(guarded);
    }

    /// f-20260917-04. Deletion takes the write-guard inside the exclusive closure, after
    /// retirement, and unlinks exactly once; `unlink_database_files` keeps its signature.
    #[test]
    fn search_index_deletion_unlinks_once_under_begin_preferred_replace() {
        let source = source_for("db/mod.rs");
        let body = compact(&source[braced_body(source, "fn delete_database_blocking(")]);
        let before_exclusive = &body[..body.find("delete_exclusive_cancellable(").unwrap()];
        assert!(
            !before_exclusive.contains("begin_preferred_replace"),
            "{body}"
        );
        let closure = &body[body.find("delete_exclusive_cancellable(").unwrap()
            ..body.find("ifletErr(error)=unlink_result").unwrap()];
        assert_in_order(
            closure,
            &[
                "letreplace_guard=search_cache.begin_preferred_replace(target.path(),cancellation)?;",
                "unlink_database_files(&target,&expected_source);",
                "drop(replace_guard);",
            ],
        );
        assert_eq!(
            closure.matches("unlink_database_files(").count(),
            1,
            "{closure}"
        );
        assert_eq!(
            body.matches("begin_preferred_replace(").count(),
            1,
            "{body}"
        );
        let guarded = &closure[closure.find("begin_preferred_replace(").unwrap()
            ..closure.find("drop(replace_guard);").unwrap()];
        assert_no_retry_loop(guarded);
        assert!(compact(source).contains(
            "fnunlink_database_files(target:&DatabaseFileTarget,expected_source:&IndexSource,)->"
        ));
    }

    /// f-20260917-04. Only the two writers call the write-guard; promotion never waits because
    /// it only creates a preferred leaf that nothing in-process can have mapped.
    #[test]
    fn search_index_write_guard_callers_exclude_promotion() {
        let mut callers = 0;
        for file in ["db/mod.rs", "db/search.rs", "db/search_index.rs"] {
            let source = source_for(file);
            let normalised = normalise(source, Literals::Blank);
            let test_start = normalised.find("mod tests {").unwrap_or(normalised.len());
            callers += normalised[..test_start]
                .matches(".begin_preferred_replace(")
                .count();
        }
        assert_eq!(callers, 2);
        let source = source_for("db/search_index.rs");
        let promote =
            compact(&source[braced_body(source, "pub(crate) fn promote_legacy_index_sidecar_at(")]);
        assert!(!promote.contains("begin_preferred_replace"), "{promote}");
        assert!(!promote.contains("lease_preferred_mapping"), "{promote}");
    }

    /// f-20260917-04. The loader leases the preferred leaf before opening or mapping it, and
    /// `cache_loaded_index` publishes only through `insert_index`.
    #[test]
    fn search_index_reader_leases_before_opening_the_preferred_leaf() {
        let source = source_for("db/search.rs");
        let open = compact(&source[braced_body(source, "fn open_valid_preferred(")]);
        assert_in_order(
            &open,
            &[
                "search_cache.lease_preferred_mapping(target.path(),cancellation)?;",
                "open_regular_at(",
                "MmapSearchIndex::open_file_leased(file,lease,cancellation)",
            ],
        );
        let cache = compact(&source[braced_body(source, "fn cache_loaded_index(")]);
        assert_eq!(cache.matches("search_cache.").count(), 1, "{cache}");
        assert!(cache.contains("search_cache.insert_index("), "{cache}");
    }

    /// f-20260917-04. `insert_index` reads draining inside the same `indexes` critical section
    /// as the insert, and drops displaced indexes only after that section ends.
    #[test]
    fn search_index_insert_reads_draining_under_the_indexes_mutex() {
        let source = source_for("main.rs");
        let body = compact(&source[braced_body(source, "pub(crate) fn insert_index(")]);
        let section_start = body.find("letmutcache=self.indexes.lock()").unwrap();
        let section = &body[section_start..body.find("drop(discarded);").unwrap()];
        assert_in_order(
            section,
            &[
                "cache.get(&identity)",
                ".is_draining()",
                "cache.insert(identity,",
            ],
        );
        let clear = compact(&source[braced_body(source, "pub(crate) fn clear(")]);
        assert!(!clear.contains("mapping_gates.clear()"), "{clear}");
        assert!(clear.contains("Arc::strong_count(gate)!=1"), "{clear}");
        let guard = compact(&source[braced_body(source, "pub(crate) fn begin_preferred_replace(")]);
        assert_in_order(
            &guard,
            &[
                "|state|state.draining=true",
                "self.invalidate_entries(database,Some(&gate));",
                "|state|state.leases>0",
            ],
        );
    }
}
