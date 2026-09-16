/*!
Phase 1 refusal-pin proof record (2026-09-16).

The 35 refusal sites are pinned by the G and B rows below. The O4d exclusion is
`opened_file_change_stamp`: its unconditional non-unix tail is not a refusal
site and is intentionally not a row. Future closed-world completeness is not
claimed here; that work is split to `f-20260916-01` (R15-01).

The four shared-helper pins (`refusal`, `unsupported`, `unsupported_plural`,
`off_unix_refusal`) are ARGUED, not staged. Reaching them by mutation would
require editing this verifier file itself, which push-review-policy section 2
forbids as a staging route. Every green result below therefore means “green
with those four helper pins argued, not staged”.

G rows (each staged message names the listed file and signature):
`infra/path_authority/mod.rs::ensure_app_owned_default_dir`,
`fs.rs::download_engine_archive`,
`oauth.rs::authenticate`, `oauth.rs::migrate_legacy_lichess_token`,
`infra/path_authority/mod.rs::engine_resource`,
`fs.rs::set_file_as_executable_blocking`,
`puzzle.rs::delete_puzzle_database`, `puzzle.rs::get_puzzle`.

B rows (each staged message names the listed file and signature):
`file_workspace.rs::mutation_target`, `file_workspace.rs::register_created_entry`,
`file_workspace.rs::collect_tree_entries`, `file_workspace.rs::paired_rename`,
`infra/fs.rs::entry_identity_at`, `infra/fs.rs::create_dir_at`,
`infra/fs.rs::open_directory_at`, `infra/fs.rs::rename_entry_at`,
`infra/fs.rs::remove_entry_at`, `infra/fs.rs::remove_optional_regular_at`,
`infra/fs.rs::atomic_install_dir`, `infra/path_authority/mod.rs::entries`,
`infra/path_authority/mod.rs::open_current`,
`infra/path_authority/mod.rs::remove_leaf_identified`,
`infra/path_authority/mod.rs::open_regular_relative`,
`infra/path_authority/mod.rs::authorize_existing_dir`,
`infra/path_authority/mod.rs::capability_directory`,
`infra/path_authority/mod.rs::create_database_child`,
`infra/path_authority/mod.rs::database_file_target`,
`infra/path_authority/resolved.rs::atomic_install_download_dir`,
`infra/path_authority/resolved.rs::puzzle_database_target`,
`infra/path_authority/resolved.rs::delete_puzzle_database`,
`infra/path_authority/resolved.rs::mark_engine_executable`,
`db/mod.rs::unlink_database_files`, `db/repository.rs::identity_from_probe`,
`db/search.rs::open_valid_preferred`.

Staged failure matrix. Every run used a detached disposable worktree copied
from this phase, mutated production files only, and ran exactly:
`cargo test --manifest-path src-tauri/Cargo.toml platform_support`.
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
    use std::ops::Range;

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
    fn windows_read_only_directory_walk_does_not_demand_write() {
        // DIRECTORY_ACCESS carries GENERIC_WRITE. open_directory_path honours `writable` on its
        // base open but once hardcoded DIRECTORY_ACCESS for every child, so a read-only walk
        // (fs.rs calls it with `false`) demanded write on every ancestor. Nothing on Linux
        // compiles this module, and a type-check cannot catch an access mask, so this source pin
        // is the only check that the split survives.
        let source = source_for("infra/fs.rs");
        let body = braced_body(source, "fn open_directory_path(");
        let body = compact(&source[body]);
        assert!(
            body.contains(
                "letchild_access=ifwritable{DIRECTORY_ACCESS}else{DIRECTORY_READ_ACCESS};"
            ),
            "{body}"
        );
        assert!(body.contains(".write(writable)"), "{body}");
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
                "constDIRECTORY_READ_ACCESS:u32=SYNCHRONIZE|windows_sys::Win32::Foundation::GENERIC_READ|READ_CONTROL;"
            ),
            "DIRECTORY_READ_ACCESS must not acquire GENERIC_WRITE"
        );
        assert!(
            whole.contains(
                "constDIRECTORY_ACCESS:u32=DIRECTORY_READ_ACCESS|windows_sys::Win32::Foundation::GENERIC_WRITE;"
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
            directory.contains("ifwritable{DIRECTORY_ACCESS}else{DIRECTORY_READ_ACCESS}"),
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
            tree.contains("EnumeratedKind::Other"),
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
            read.contains("EnumeratedKind::Other=>DirectoryEntryKind::Other"),
            "a reparse entry must stay `Other` in the listing: {read}"
        );
        assert!(
            read.contains("EnumeratedKind::Directory=>DirectoryEntryKind::Directory")
                && read.contains("EnumeratedKind::RegularFile=>DirectoryEntryKind::RegularFile"),
            "{read}"
        );
        assert_eq!(
            read.matches("ifcancellation.is_cancelled(){returnErr(Error::Cancellation);}")
                .count(),
            3,
            "the single-directory read is cancellable before, during and after the walk: {read}"
        );
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
        assert!(missing.contains("raw_os_error()==Some(2)"), "{missing}");
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

        let descriptor = compact(&source[braced_body(source, "fn new(access: u32)")]);
        assert!(
            descriptor.contains(
                "SetSecurityDescriptorControl(descriptor_ptr,SE_DACL_PROTECTED,SE_DACL_PROTECTED)"
            ),
            "{descriptor}"
        );
    }

    #[test]
    fn post_rename_identity_uses_the_retained_handle() {
        let source = source_for("infra/fs.rs");
        let body = braced_body(source, "fn metadata(temp: &File)");
        let body = compact(&source[body]);
        assert!(body.contains("opened_file_identity(temp)"));
        assert!(!body.contains("Path::new"));
    }

    fn source_for(file: &str) -> &'static str {
        match file {
            "infra/path_authority/mod.rs" => include_str!("path_authority/mod.rs"),
            "infra/path_authority/resolved.rs" => include_str!("path_authority/resolved.rs"),
            "infra/fs.rs" => include_str!("fs.rs"),
            "fs.rs" => include_str!("../fs.rs"),
            "chesscom.rs" => include_str!("../chesscom.rs"),
            "oauth.rs" => include_str!("../oauth.rs"),
            "puzzle.rs" => include_str!("../puzzle.rs"),
            "db/repository.rs" => include_str!("../db/repository.rs"),
            "db/search.rs" => include_str!("../db/search.rs"),
            "db/mod.rs" => include_str!("../db/mod.rs"),
            "file_workspace.rs" => include_str!("../file_workspace.rs"),
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

    struct CfgBlock {
        attribute_start: usize,
        block: Range<usize>,
        is_not_unix: bool,
    }

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

    enum ExpectedBody {
        Refusal(&'static str),
        Exact(&'static str),
    }

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

    #[derive(Clone, Copy)]
    enum BodyForm {
        Counterpart,
        Block,
    }

    struct BodyRow {
        file: &'static str,
        signature: &'static str,
        form: BodyForm,
        expected: ExpectedBody,
    }

    fn body_rows() -> &'static [BodyRow] {
        &[
            BodyRow {
                file: "file_workspace.rs",
                signature: "fn mutation_target(",
                form: BodyForm::Counterpart,
                expected: ExpectedBody::Refusal("workspace mutations"),
            },
            BodyRow {
                file: "file_workspace.rs",
                signature: "fn register_created_entry(",
                form: BodyForm::Counterpart,
                expected: ExpectedBody::Refusal("workspace mutations"),
            },
            BodyRow {
                file: "file_workspace.rs",
                signature: "fn collect_tree_entries(",
                form: BodyForm::Counterpart,
                expected: ExpectedBody::Refusal("workspace listing"),
            },
            BodyRow {
                file: "file_workspace.rs",
                signature: "fn paired_rename(",
                form: BodyForm::Counterpart,
                expected: ExpectedBody::Refusal("workspace mutations"),
            },
            BodyRow {
                file: "infra/fs.rs",
                signature: "pub fn atomic_install_dir(",
                form: BodyForm::Block,
                expected: ExpectedBody::Exact(
                    r#"{let_=(temp_path,target_path);Err(Error::Conflict("atomic directory installation is unsupported on this platform: fd-relative no-follow and durable parent sync cannot be proven".into()))}"#,
                ),
            },
            BodyRow {
                file: "infra/path_authority/mod.rs",
                signature: "pub(crate) fn open_current(",
                form: BodyForm::Counterpart,
                expected: ExpectedBody::Refusal("database file reopening"),
            },
            BodyRow {
                file: "infra/path_authority/mod.rs",
                signature: "pub(crate) fn remove_leaf_identified(",
                form: BodyForm::Block,
                expected: ExpectedBody::Exact(
                    r#"{let_=(leaf,identity);Err(crate::infra::platform_support::unsupported("fd-relative removal",))}"#,
                ),
            },
            BodyRow {
                file: "infra/path_authority/mod.rs",
                signature: "pub(crate) fn open_regular_relative(",
                form: BodyForm::Block,
                expected: ExpectedBody::Exact(
                    r#"{let_=relative;Err(crate::infra::platform_support::unsupported("fd-relative regular-file opening",))}"#,
                ),
            },
            BodyRow {
                file: "infra/path_authority/mod.rs",
                signature: "fn authorize_existing_dir(",
                form: BodyForm::Counterpart,
                expected: ExpectedBody::Exact(
                    r#"{let_=path;Err(crate::infra::platform_support::unsupported_plural("authorized directories",))}"#,
                ),
            },
            // Off unix this one is a partial refusal, not a whole-body one: `ReadPgn` is served
            // and every other operation is refused, because `list_database_children_cancellable`
            // is still `f-20260914-09`. The pinned effective body therefore contains the served
            // arm as well, so narrowing or widening the served set reddens the pin.
            BodyRow {
                file: "infra/path_authority/mod.rs",
                signature: "pub(crate) fn capability_directory(",
                form: BodyForm::Block,
                expected: ExpectedBody::Exact(
                    r#"{ifoperation!=PathOperation::ReadPgn{returnErr(crate::infra::platform_support::unsupported(UNSUPPORTED_DIRECTORY_ENUMERATION,));}letmutresolved=self.resolve(id,operation,&[])?;letdirectory=resolved.take_directory().ok_or_else(||Error::InvalidInput("path capability is not a directory".into()))?;Ok(CapabilityDirectory{directory})}"#,
                ),
            },
            BodyRow {
                file: "infra/path_authority/mod.rs",
                signature: "pub(crate) fn create_database_child(",
                form: BodyForm::Block,
                expected: ExpectedBody::Exact(
                    r#"{validate_components(&[filename.to_os_string()])?;ifstd::path::Path::new(filename).extension()!=Some(OsStr::new("db3")){returnErr(Error::InvalidInput("database filename must end in .db3".into(),));}let_=root;Err(crate::infra::platform_support::unsupported("descriptor-relative database creation",))}"#,
                ),
            },
            BodyRow {
                file: "infra/path_authority/mod.rs",
                signature: "pub(crate) fn database_file_target(",
                form: BodyForm::Counterpart,
                expected: ExpectedBody::Refusal("database file targets"),
            },
            BodyRow {
                file: "infra/path_authority/resolved.rs",
                signature: "pub(crate) fn atomic_install_download_dir(",
                form: BodyForm::Block,
                expected: ExpectedBody::Exact(
                    r#"{ifself.operation!=PathOperation::DownloadArchive{returnErr(Error::InvalidInput("resolved capability is not an archive destination".into(),));}lettarget=self.target.as_deref().ok_or_else(||{Error::InvalidInput("archive destination is a directory capability".into())})?;let_=(target,temporary_directory);Err(crate::infra::platform_support::unsupported("atomic archive installation",))}"#,
                ),
            },
            BodyRow {
                file: "infra/path_authority/resolved.rs",
                signature: "pub(crate) fn puzzle_database_target(",
                form: BodyForm::Counterpart,
                expected: ExpectedBody::Refusal("puzzle database targets"),
            },
            BodyRow {
                file: "infra/path_authority/resolved.rs",
                signature: "pub(crate) fn delete_puzzle_database(",
                form: BodyForm::Counterpart,
                expected: ExpectedBody::Refusal("puzzle database deletion"),
            },
            BodyRow {
                file: "infra/path_authority/resolved.rs",
                signature: "pub(crate) fn mark_engine_executable(",
                form: BodyForm::Counterpart,
                expected: ExpectedBody::Refusal("engine executable mode"),
            },
            BodyRow {
                file: "db/mod.rs",
                signature: "fn unlink_database_files(",
                form: BodyForm::Counterpart,
                expected: ExpectedBody::Refusal("database file deletion"),
            },
            BodyRow {
                file: "db/repository.rs",
                signature: "pub(crate) fn identity_from_probe(",
                form: BodyForm::Counterpart,
                expected: ExpectedBody::Refusal("database identity probing"),
            },
            BodyRow {
                file: "db/search.rs",
                signature: "fn open_valid_preferred(",
                form: BodyForm::Counterpart,
                expected: ExpectedBody::Refusal("fd-relative search index loading"),
            },
        ]
    }

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
                file: "infra/path_authority/mod.rs",
                signature: "pub(crate) fn ensure_app_owned_default_dir(",
                operation: "app-owned default directories",
                effects: &["fs::create_dir_all("],
                nested: false,
            },
            GuardRow {
                file: "fs.rs",
                signature: "pub async fn download_engine_archive(",
                operation: "engine archive downloads",
                effects: &["download_registry.begin("],
                nested: false,
            },
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
                file: "infra/path_authority/mod.rs",
                signature: "pub(crate) fn engine_resource(",
                operation: "engine directory resources",
                effects: &["self.resolve("],
                nested: true,
            },
            GuardRow {
                file: "fs.rs",
                signature: "fn set_file_as_executable_blocking(",
                operation: "engine executable mode",
                effects: &[".lock("],
                nested: false,
            },
            GuardRow {
                file: "puzzle.rs",
                signature: "pub async fn delete_puzzle_database(",
                operation: "puzzle database deletion",
                effects: &["state.operations.accept("],
                nested: false,
            },
            GuardRow {
                file: "puzzle.rs",
                signature: "pub async fn get_puzzle(",
                operation: "puzzle loading",
                effects: &["resolve_puzzle("],
                nested: false,
            },
            GuardRow {
                file: "infra/path_authority/resolved.rs",
                signature: "pub(crate) fn replace_pgn_atomic<F>(",
                operation: "PGN atomic replacement",
                effects: &["atomic_replace_at_with_precommit("],
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

    #[test]
    fn non_unix_counterparts_have_only_typed_refusal_bodies() {
        let mut errors = Vec::new();
        for row in body_rows() {
            check_source_pin(row, source_for(row.file), &mut errors);
        }
        assert!(
            errors.is_empty(),
            "effective non-unix body pins failed:\n{}",
            errors.join("\n")
        );
    }

    fn check_helper(
        file: &str,
        source: &str,
        signature: &str,
        declaration: &str,
        expected_body: &str,
        errors: &mut Vec<String>,
    ) {
        let starts = function_starts(source, signature);
        if starts.len() != 1 {
            errors.push(format!(
                "{file}: {signature}: expected one declaration, found {}",
                starts.len()
            ));
            return;
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
        let actual_body = compact(&source[body]);
        if actual_body != expected_body {
            errors.push(format!("{file}: {signature}: body changed: {actual_body}"));
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
        let constant =
            "#[cfg(not(unix))]\nconst UNSUPPORTED_DIRECTORY_ENUMERATION: &str = \"fd-relative directory enumeration\";";
        let normalised = normalise(authority, Literals::Keep);
        if normalised.matches(constant).count() != 1 {
            errors.push(
                "infra/path_authority/mod.rs: UNSUPPORTED_DIRECTORY_ENUMERATION declaration changed"
                    .into(),
            );
        }
        check_helper(
            "infra/fs.rs",
            source_for("infra/fs.rs"),
            "pub(crate) fn single_leaf(",
            "pub(crate)fnsingle_leaf(leaf:&OsStr)->Result<(),Error>",
            r#"{ifleaf.is_empty()||Path::new(leaf).file_name()!=Some(leaf){returnErr(Error::InvalidInput("leaf name must be one component".into(),));}Ok(())}"#,
            &mut errors,
        );
        check_helper(
            "infra/path_authority/mod.rs",
            authority,
            "fn validate_components(",
            "fnvalidate_components(components:&[OsString])->Result<(),Error>",
            r#"{fornameincomponents{letcomponent=name.as_os_str();ifcomponent.is_empty()||component==OsStr::new(".")||component==OsStr::new("..")||Path::new(component).components().count()!=1{returnErr(Error::InvalidInput("invalid relative path component".into(),));}#[cfg(unix)]{usestd::os::unix::ffi::OsStrExt;ifcomponent.as_bytes().contains(&b'/')||component.as_bytes().contains(&0){returnErr(Error::InvalidInput("path component contains a separator or NUL".into(),));}}}Ok(())}"#,
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
                    let allowed = path.ends_with("infra/fs.rs")
                        && normalised[..offset].ends_with("atomic directory installation is ")
                        && normalised[offset + needle.len()..].starts_with(':');
                    if !allowed {
                        occurrences.push(format!(
                            "{}:{}",
                            path.display(),
                            source[..offset].matches('\n').count() + 1
                        ));
                    }
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
        let expected = [
            (
                "infra/path_authority/mod.rs",
                "database file reopening",
                "unsupported",
            ),
            (
                "infra/path_authority/mod.rs",
                "fd-relative removal",
                "unsupported",
            ),
            (
                "infra/path_authority/mod.rs",
                "fd-relative regular-file opening",
                "unsupported",
            ),
            (
                "infra/path_authority/mod.rs",
                "authorized directories",
                "unsupported_plural",
            ),
            (
                "infra/path_authority/mod.rs",
                "post-rename marker timestamps",
                "unsupported_plural",
            ),
            (
                "infra/path_authority/mod.rs",
                "fd-relative directory enumeration",
                "unsupported",
            ),
            (
                "infra/path_authority/mod.rs",
                "descriptor-relative database creation",
                "unsupported",
            ),
            (
                "infra/path_authority/mod.rs",
                "database file targets",
                "unsupported",
            ),
            (
                "infra/path_authority/resolved.rs",
                "atomic archive installation",
                "unsupported",
            ),
            (
                "infra/path_authority/resolved.rs",
                "puzzle database targets",
                "unsupported",
            ),
            (
                "infra/path_authority/resolved.rs",
                "puzzle database deletion",
                "unsupported",
            ),
            (
                "infra/path_authority/resolved.rs",
                "engine executable mode",
                "unsupported",
            ),
            (
                "db/repository.rs",
                "database identity probing",
                "unsupported",
            ),
            ("db/mod.rs", "database file deletion", "unsupported"),
            (
                "db/search.rs",
                "fd-relative search index loading",
                "unsupported",
            ),
            ("file_workspace.rs", "workspace mutations", "unsupported"),
            ("file_workspace.rs", "workspace mutations", "unsupported"),
            ("file_workspace.rs", "workspace listing", "unsupported"),
            ("file_workspace.rs", "workspace mutations", "unsupported"),
        ];
        let mut errors = Vec::new();
        for (file, operation, function) in expected {
            let source = source_for(file);
            let normalised = compact(&normalise(source, Literals::Keep));
            let needle = if operation == "fd-relative directory enumeration" {
                "crate::infra::platform_support::unsupported(UNSUPPORTED_DIRECTORY_ENUMERATION)"
                    .to_owned()
            } else {
                format!("crate::infra::platform_support::{function}(\"{operation}\")")
            };
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
}
