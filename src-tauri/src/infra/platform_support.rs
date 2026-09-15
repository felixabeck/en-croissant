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

    fn compact(text: &str) -> String {
        let mut compacted = String::with_capacity(text.len());
        let mut in_string = false;
        let mut escaped = false;
        for character in text.chars() {
            if in_string {
                compacted.push(character);
                if escaped {
                    escaped = false;
                } else if character == '\\' {
                    escaped = true;
                } else if character == '"' {
                    in_string = false;
                }
            } else if character == '"' {
                in_string = true;
                compacted.push(character);
            } else if !character.is_whitespace() {
                compacted.push(character);
            }
        }
        compacted
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
    fn refusal_format_has_one_body() {
        let source = include_str!("platform_support.rs");
        let kept = normalise(source, Literals::Keep);
        let needle = ["unsupported on this ", "platform"].concat();
        assert_eq!(kept.matches(&needle).count(), 1);
        assert_eq!(
            compact(&source[braced_body(source, "pub(crate) fn unsupported(")]),
            "{refusal(operation,\"is\")}"
        );
        assert_eq!(
            compact(&source[braced_body(source, "pub(crate) fn unsupported_plural(")]),
            "{refusal(operations,\"are\")}"
        );
    }

    struct GuardRow {
        file: &'static str,
        signature: &'static str,
        operation: &'static str,
        effects: &'static [&'static str],
        nested: bool,
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

    fn guard_statement(
        source: &str,
        signature: &str,
    ) -> (std::ops::Range<usize>, std::ops::Range<usize>) {
        let body = braced_body(source, signature);
        let normalised = normalise(source, Literals::Blank);
        let guard = "crate::infra::platform_support::off_unix_refusal(";
        let start = normalised[body.start..body.end]
            .find(guard)
            .map(|offset| body.start + offset)
            .unwrap_or_else(|| panic!("guard missing for {signature}"));
        let end = normalised[start..body.end]
            .find(';')
            .map(|offset| start + offset + 1)
            .unwrap_or_else(|| panic!("guard statement is unterminated for {signature}"));
        (body, start..end)
    }

    #[test]
    fn refusal_guards_are_first_statements_and_precede_their_effects() {
        let rows = [
            GuardRow {
                file: "infra/path_authority/mod.rs",
                signature: "pub(crate) fn ensure_app_owned_default_dir(",
                operation: "app-owned default directories",
                effects: &["fs::create_dir_all("],
                nested: false,
            },
            GuardRow {
                file: "fs.rs",
                signature: "pub async fn download_file(",
                operation: "file downloads",
                effects: &["download_to_destination("],
                nested: false,
            },
            GuardRow {
                file: "fs.rs",
                signature: "pub async fn download_lichess_games(",
                operation: "Lichess game downloads",
                effects: &["download_lichess_games_runtime("],
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
                file: "chesscom.rs",
                signature: "pub async fn download_chess_com_games(",
                operation: "Chess.com game downloads",
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
        ];
        for row in rows {
            let source = source_for(row.file);
            let (body, statement) = guard_statement(source, row.signature);
            let normalised = normalise(source, Literals::Blank);
            let before = &normalised[body.start + 1..statement.start];
            let depth =
                normalised[body.start + 1..statement.start]
                    .bytes()
                    .fold(1_i32, |depth, byte| match byte {
                        b'{' => depth + 1,
                        b'}' => depth - 1,
                        _ => depth,
                    });
            let raw_statement = compact(&source[statement.clone()]);
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
            assert_eq!(raw_statement, expected, "guard row {}", row.signature);
            if row.nested {
                let if_signature = "if resource.kind == EngineResourceHandleKind::Directory";
                let if_body = braced_body(source, if_signature);
                let if_start = normalised[..if_body.start]
                    .rfind(if_signature)
                    .unwrap_or_else(|| panic!("enclosing if missing for {}", row.signature));
                assert!(
                    normalised[body.start + 1..if_start]
                        .chars()
                        .all(char::is_whitespace),
                    "guard is not first statement for {}",
                    row.signature
                );
                assert!(
                    normalised[if_body.start + 1..statement.start]
                        .chars()
                        .all(char::is_whitespace),
                    "guard is not first statement in the enclosing if for {}",
                    row.signature
                );
                assert!(
                    normalised[statement.end..if_body.end - 1]
                        .chars()
                        .all(char::is_whitespace),
                    "enclosing if has another statement for {}",
                    row.signature
                );
                assert_eq!(
                    compact(&source[if_start..if_body.end]),
                    format!(
                        "ifresource.kind==EngineResourceHandleKind::Directory{{{raw_statement}}}"
                    ),
                    "enclosing if changed for {}",
                    row.signature
                );
            } else {
                assert!(
                    before.chars().all(char::is_whitespace),
                    "guard is not first statement for {}",
                    row.signature
                );
            }
            assert_eq!(
                depth,
                if row.nested { 2 } else { 1 },
                "guard depth for {}",
                row.signature
            );
            let preceding = &normalised[body.start..statement.start];
            assert!(
                !preceding.contains("#["),
                "guard has an attached attribute for {}",
                row.signature
            );
            for effect in row.effects {
                assert!(
                    normalised[statement.end..body.end].contains(effect),
                    "effect {effect} follows no guard in {}",
                    row.signature
                );
            }
        }
    }

    struct CounterpartRow {
        file: &'static str,
        signature: &'static str,
        operation: &'static str,
    }

    #[test]
    fn non_unix_counterparts_have_only_typed_refusal_bodies() {
        let rows = [
            CounterpartRow {
                file: "file_workspace.rs",
                signature: "fn mutation_target(",
                operation: "workspace mutations",
            },
            CounterpartRow {
                file: "file_workspace.rs",
                signature: "fn register_created_entry(",
                operation: "workspace mutations",
            },
            CounterpartRow {
                file: "file_workspace.rs",
                signature: "fn paired_rename(",
                operation: "workspace mutations",
            },
            CounterpartRow {
                file: "infra/fs.rs",
                signature: "pub(crate) fn create_dir_at(",
                operation: "fd-relative directory creation",
            },
            CounterpartRow {
                file: "infra/fs.rs",
                signature: "pub(crate) fn rename_entry_at(",
                operation: "fd-relative renames",
            },
            CounterpartRow {
                file: "infra/fs.rs",
                signature: "pub(crate) fn remove_entry_at(",
                operation: "fd-relative removals",
            },
            CounterpartRow {
                file: "infra/fs.rs",
                signature: "pub(crate) fn open_directory_at(",
                operation: "fd-relative directory opening",
            },
            CounterpartRow {
                file: "infra/fs.rs",
                signature: "pub(crate) fn entry_identity_at(",
                operation: "fd-relative entry identity",
            },
            CounterpartRow {
                file: "infra/fs.rs",
                signature: "pub(crate) fn remove_optional_regular_at(",
                operation: "fd-relative optional-file removal",
            },
            CounterpartRow {
                file: "infra/path_authority/mod.rs",
                signature: "pub(crate) fn database_file_target(",
                operation: "database file targets",
            },
            CounterpartRow {
                file: "infra/path_authority/mod.rs",
                signature: "pub(crate) fn create_pgn_export_destination(",
                operation: "PGN export destinations",
            },
            CounterpartRow {
                file: "infra/path_authority/mod.rs",
                signature: "pub(crate) fn open_current(",
                operation: "database file reopening",
            },
            CounterpartRow {
                file: "infra/path_authority/resolved.rs",
                signature: "pub(crate) fn puzzle_database_target(",
                operation: "puzzle database targets",
            },
            CounterpartRow {
                file: "db/mod.rs",
                signature: "fn unlink_database_files(",
                operation: "database file deletion",
            },
            CounterpartRow {
                file: "infra/path_authority/resolved.rs",
                signature: "pub(crate) fn delete_puzzle_database(",
                operation: "puzzle database deletion",
            },
            CounterpartRow {
                file: "infra/path_authority/resolved.rs",
                signature: "pub(crate) fn mark_engine_executable(",
                operation: "engine executable mode",
            },
            CounterpartRow {
                file: "db/repository.rs",
                signature: "pub(crate) fn identity_from_probe(",
                operation: "database identity probing",
            },
            CounterpartRow {
                file: "db/search.rs",
                signature: "fn open_valid_preferred(",
                operation: "fd-relative search index loading",
            },
        ];
        for row in rows {
            let source = source_for(row.file);
            let attribute = "#[cfg(not(unix))]";
            let normalised = normalise(source, Literals::Blank);
            let attribute_start = source
                .match_indices(attribute)
                .find_map(|(attribute_start, _)| {
                    let signature_start = source[attribute_start + attribute.len()..]
                        .find(row.signature)
                        .map(|offset| attribute_start + attribute.len() + offset)?;
                    let between = &normalised[attribute_start + attribute.len()..signature_start];
                    (!between.contains('{') && !between.contains('}') && !between.contains("fn "))
                        .then_some(attribute_start)
                })
                .unwrap_or_else(|| panic!("missing non-unix cfg for {}", row.signature));
            let suffix = &source[attribute_start..];
            let body = braced_body(suffix, row.signature);
            let expected = format!(
                "{{Err(crate::infra::platform_support::unsupported(\"{}\"))}}",
                row.operation
            );
            let expected_with_trailing_argument_comma = format!(
                "{{Err(crate::infra::platform_support::unsupported(\"{}\",))}}",
                row.operation
            );
            let actual = compact(&suffix[body]);
            assert!(
                actual == expected || actual == expected_with_trailing_argument_comma,
                "counterpart {}",
                row.signature
            );
        }
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
            ("infra/fs.rs", "fd-relative entry identity", "unsupported"),
            (
                "infra/fs.rs",
                "fd-relative directory creation",
                "unsupported",
            ),
            (
                "infra/fs.rs",
                "fd-relative directory opening",
                "unsupported",
            ),
            ("infra/fs.rs", "fd-relative renames", "unsupported"),
            ("infra/fs.rs", "fd-relative removals", "unsupported"),
            (
                "infra/fs.rs",
                "fd-relative optional-file removal",
                "unsupported",
            ),
            (
                "infra/fs.rs",
                "fd-relative atomic replacement",
                "unsupported",
            ),
            (
                "infra/path_authority/mod.rs",
                "fd-relative directory enumeration",
                "unsupported",
            ),
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
                "PGN export destinations",
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
        let mut actual = Vec::new();
        let mut current_file = "";
        let mut cursor = 0;
        for (file, operation, function) in expected {
            if file != current_file {
                current_file = file;
                cursor = 0;
            }
            let source = source_for(file);
            let normalised = compact(&normalise(source, Literals::Keep));
            let needle = if operation == "fd-relative directory enumeration" {
                "crate::infra::platform_support::unsupported(UNSUPPORTED_DIRECTORY_ENUMERATION)"
                    .into()
            } else {
                format!("crate::infra::platform_support::{function}(\"{operation}\")")
            };
            let comma_needle = format!("{},)", needle.strip_suffix(')').unwrap());
            let mut search = cursor;
            let offset = loop {
                let Some(relative) = normalised[search..].find(&needle) else {
                    break normalised[search..]
                        .find(&comma_needle)
                        .map(|relative| search + relative)
                        .unwrap_or_else(|| {
                            panic!("missing routed refusal for {file}: {operation}")
                        });
                };
                let offset = search + relative;
                if !normalised[offset + needle.len()..].starts_with(',') {
                    break offset;
                }
                search = offset + 1;
            };
            let matched_len = if normalised[offset..].starts_with(&comma_needle) {
                comma_needle.len()
            } else {
                needle.len()
            };
            cursor = offset + matched_len;
            actual.push((file, offset));
        }
        assert_eq!(
            actual.len(),
            expected.len(),
            "routed refusal labels changed: {actual:?}"
        );
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
            assert_eq!(
                call_count, expected_count,
                "routed refusal count changed in {file}"
            );
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
        assert_eq!(
            tree_count,
            expected.len(),
            "tree-wide routed refusal count changed"
        );
    }
}
