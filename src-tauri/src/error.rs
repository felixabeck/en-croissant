use serde::Serialize;
use shakmaty::Chess;
use specta::Type;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Type)]
pub enum DurabilityStage {
    ArchiveCommitMarker,
    ArchiveFileReplacement,
    ArchiveReservationJournal,
    DatabasePgnReplacement,
    DirectoryInstall,
    DownloadTargetReplacement,
    GzipFileReplacement,
    OldDirectoryCleanup,
    OldDirectoryCleanupSync,
    PgnEdit,
    RegistryReplacement,
    SearchIndexReplacement,
    WorkspacePgnCreation,
    WorkspaceRemoval,
    WorkspaceSidecarCreation,
}

impl std::fmt::Display for DurabilityStage {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(match self {
            Self::ArchiveCommitMarker => {
                "artifact commit marker, which may have committed; do not retry"
            }
            Self::ArchiveFileReplacement => "archive file replacement",
            Self::ArchiveReservationJournal => {
                "artifact reservation journal, which may have committed; do not install or retry"
            }
            Self::DatabasePgnReplacement => "database PGN replacement",
            Self::DirectoryInstall => "directory installation",
            Self::DownloadTargetReplacement => "download target replacement",
            Self::GzipFileReplacement => "gzip file replacement",
            Self::OldDirectoryCleanup => "old directory cleanup",
            Self::OldDirectoryCleanupSync => "old directory cleanup sync",
            Self::PgnEdit => "PGN edit",
            Self::RegistryReplacement => "registry replacement",
            Self::SearchIndexReplacement => "search index replacement",
            Self::WorkspacePgnCreation => "workspace PGN creation",
            Self::WorkspaceRemoval => "workspace removal",
            Self::WorkspaceSidecarCreation => "workspace sidecar creation",
        })
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "kebab-case")]
pub enum ErrorCategory {
    Io,
    Parsing,
    Platform,
    Network,
    ChessData,
    Database,
    InvalidInput,
    MissingResource,
    Conflict,
    ResourceLimit,
    Authentication,
    Credential,
    Cancellation,
    Durability,
    PartialRemoval,
    OperationAndCleanup,
    EngineTimeout,
    Permission,
    PuzzleThemesUnavailable,
}

impl std::fmt::Display for ErrorCategory {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(match self {
            Self::Io => "I/O failure",
            Self::Parsing => "parsing failure",
            Self::Platform => "platform failure",
            Self::Network => "network failure",
            Self::ChessData => "chess data failure",
            Self::Database => "database failure",
            Self::InvalidInput => "invalid input",
            Self::MissingResource => "missing resource",
            Self::Conflict => "conflict",
            Self::ResourceLimit => "resource limit",
            Self::Authentication => "authentication failure",
            Self::Credential => "credential failure",
            Self::Cancellation => "cancellation",
            Self::Durability => "durability failure",
            Self::PartialRemoval => "partial removal",
            Self::OperationAndCleanup => "operation and cleanup failure",
            Self::EngineTimeout => "engine timeout",
            Self::Permission => "permission denied",
            Self::PuzzleThemesUnavailable => "puzzle themes unavailable",
        })
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "kebab-case")]
pub enum ErrorPayloadTag {
    BackendError,
}

#[derive(Serialize, Type)]
pub struct ErrorPayload {
    pub tag: ErrorPayloadTag,
    pub category: ErrorCategory,
    pub message: String,
}

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("I/O failure")]
    Io(#[source] Box<std::io::Error>),

    #[error("parsing failure")]
    Zip(#[source] Box<zip::result::ZipError>),

    #[error(transparent)]
    ParseInt(Box<std::num::ParseIntError>),

    #[error("platform failure")]
    Tauri(#[source] Box<tauri::Error>),

    #[error("platform failure")]
    TauriOpener(#[source] Box<tauri_plugin_opener::Error>),

    #[error("network failure")]
    Reqwest(Box<reqwest::Error>),

    #[error(transparent)]
    ChessPosition(Box<shakmaty::PositionError<Chess>>),

    #[error(transparent)]
    IllegalUciMove(Box<shakmaty::uci::IllegalUciMoveError>),

    #[error(transparent)]
    ParseUciMove(Box<shakmaty::uci::ParseUciMoveError>),

    #[error(transparent)]
    Fen(Box<shakmaty::fen::ParseFenError>),

    #[error(transparent)]
    ParseSan(Box<shakmaty::san::ParseSanError>),

    #[error(transparent)]
    IllegalSan(Box<shakmaty::san::SanError>),

    #[error("database failure")]
    Diesel(#[source] Box<diesel::result::Error>),

    #[error("database failure")]
    R2d2(#[source] Box<diesel::r2d2::PoolError>),

    #[error(transparent)]
    SystemTime(Box<std::time::SystemTimeError>),

    #[error("No stdin")]
    NoStdin,

    #[error("No stdout")]
    NoStdout,

    #[error("No moves found")]
    NoMovesFound,

    #[error("Missing reference database")]
    MissingReferenceDatabase,

    #[error("No opening found")]
    NoOpeningFound,

    #[error("No puzzles")]
    NoPuzzles,

    #[error("Puzzle themes unavailable")]
    PuzzleThemesUnavailable,

    #[error("Players aren't the same. They have played against each other")]
    NotDistinctPlayers,

    #[error("Game not found: {0}")]
    GameNotFound(String),

    #[error("Game not in progress")]
    GameNotInProgress,

    #[error("Not human's turn")]
    NotHumanTurn,

    #[error("Not engine's turn")]
    NotEngineTurn,

    #[error("Invalid color: {0}")]
    InvalidColor(String),

    #[error("Engine not initialized")]
    EngineNotInitialized,

    #[error("Engine disconnected")]
    EngineDisconnected,

    #[error("Engine timeout: {0}")]
    EngineTimeout(String),

    #[error("Analysis cancelled")]
    AnalysisCancelled,
    #[error("Invalid input: {0}")]
    InvalidInput(String),

    #[error("Conflict: {0}")]
    Conflict(String),

    #[error("Resource limit: {0}")]
    ResourceLimit(String),

    #[error("OAuth failure: {0}")]
    OAuthFailure(String),

    #[error("Credential operation failed")]
    CredentialFailure(String),

    #[error("Credential operation requires recovery")]
    CredentialRecoveryRequired,

    #[error("Cancellation")]
    Cancellation,

    #[error("Committed but durability uncertain: {0}")]
    CommittedDurabilityUncertain(DurabilityStage),

    #[error(
        "Partially removed: {removed_entries} entries were deleted before failing: {}",
        .cause.category()
    )]
    PartialRemoval {
        removed_entries: usize,
        cause: Box<Error>,
    },

    #[error("Operation failed; temporary cleanup also failed")]
    OperationAndCleanup { primary: String, cleanup: String },
}

impl Error {
    pub fn category(&self) -> ErrorCategory {
        match self {
            Self::Io(error) => match error.kind() {
                std::io::ErrorKind::NotFound => ErrorCategory::MissingResource,
                std::io::ErrorKind::PermissionDenied => ErrorCategory::Permission,
                _ => ErrorCategory::Io,
            },
            Self::Zip(_) | Self::ParseInt(_) | Self::Fen(_) | Self::ParseUciMove(_) => {
                ErrorCategory::Parsing
            }
            Self::Tauri(_) | Self::TauriOpener(_) => ErrorCategory::Platform,
            Self::Reqwest(_) => ErrorCategory::Network,
            Self::ChessPosition(_)
            | Self::IllegalUciMove(_)
            | Self::ParseSan(_)
            | Self::IllegalSan(_) => ErrorCategory::ChessData,
            Self::Diesel(_) | Self::R2d2(_) => ErrorCategory::Database,
            Self::SystemTime(_) | Self::InvalidInput(_) | Self::InvalidColor(_) => {
                ErrorCategory::InvalidInput
            }
            Self::NoStdin
            | Self::NoStdout
            | Self::NoMovesFound
            | Self::MissingReferenceDatabase
            | Self::NoOpeningFound
            | Self::NoPuzzles
            | Self::GameNotFound(_)
            | Self::EngineNotInitialized
            | Self::EngineDisconnected => ErrorCategory::MissingResource,
            Self::NotDistinctPlayers
            | Self::GameNotInProgress
            | Self::NotHumanTurn
            | Self::NotEngineTurn
            | Self::Conflict(_) => ErrorCategory::Conflict,
            Self::ResourceLimit(_) => ErrorCategory::ResourceLimit,
            Self::OAuthFailure(_) => ErrorCategory::Authentication,
            Self::CredentialFailure(_) | Self::CredentialRecoveryRequired => {
                ErrorCategory::Credential
            }
            Self::Cancellation | Self::AnalysisCancelled => ErrorCategory::Cancellation,
            Self::CommittedDurabilityUncertain(_) => ErrorCategory::Durability,
            Self::PartialRemoval { .. } => ErrorCategory::PartialRemoval,
            Self::OperationAndCleanup { .. } => ErrorCategory::OperationAndCleanup,
            Self::EngineTimeout(_) => ErrorCategory::EngineTimeout,
            Self::PuzzleThemesUnavailable => ErrorCategory::PuzzleThemesUnavailable,
        }
    }
}

impl From<std::io::Error> for Error {
    fn from(value: std::io::Error) -> Self {
        Self::Io(Box::new(value))
    }
}

impl From<zip::result::ZipError> for Error {
    fn from(value: zip::result::ZipError) -> Self {
        Self::Zip(Box::new(value))
    }
}

impl From<std::num::ParseIntError> for Error {
    fn from(value: std::num::ParseIntError) -> Self {
        Self::ParseInt(Box::new(value))
    }
}

impl From<tauri::Error> for Error {
    fn from(value: tauri::Error) -> Self {
        Self::Tauri(Box::new(value))
    }
}

impl From<tauri_plugin_opener::Error> for Error {
    fn from(value: tauri_plugin_opener::Error) -> Self {
        Self::TauriOpener(Box::new(value))
    }
}

impl From<reqwest::Error> for Error {
    fn from(value: reqwest::Error) -> Self {
        Self::Reqwest(Box::new(value))
    }
}

impl From<shakmaty::PositionError<Chess>> for Error {
    fn from(value: shakmaty::PositionError<Chess>) -> Self {
        Self::ChessPosition(Box::new(value))
    }
}

impl From<shakmaty::uci::IllegalUciMoveError> for Error {
    fn from(value: shakmaty::uci::IllegalUciMoveError) -> Self {
        Self::IllegalUciMove(Box::new(value))
    }
}

impl From<shakmaty::uci::ParseUciMoveError> for Error {
    fn from(value: shakmaty::uci::ParseUciMoveError) -> Self {
        Self::ParseUciMove(Box::new(value))
    }
}

impl From<shakmaty::fen::ParseFenError> for Error {
    fn from(value: shakmaty::fen::ParseFenError) -> Self {
        Self::Fen(Box::new(value))
    }
}

impl From<shakmaty::san::ParseSanError> for Error {
    fn from(value: shakmaty::san::ParseSanError) -> Self {
        Self::ParseSan(Box::new(value))
    }
}

impl From<shakmaty::san::SanError> for Error {
    fn from(value: shakmaty::san::SanError) -> Self {
        Self::IllegalSan(Box::new(value))
    }
}

impl From<diesel::result::Error> for Error {
    fn from(value: diesel::result::Error) -> Self {
        Self::Diesel(Box::new(value))
    }
}

impl From<diesel::r2d2::PoolError> for Error {
    fn from(value: diesel::r2d2::PoolError) -> Self {
        Self::R2d2(Box::new(value))
    }
}

impl From<std::time::SystemTimeError> for Error {
    fn from(value: std::time::SystemTimeError) -> Self {
        Self::SystemTime(Box::new(value))
    }
}

impl serde::Serialize for Error {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        // No logging: debug builds send Info-and-above records to the webview.
        ErrorPayload {
            tag: ErrorPayloadTag::BackendError,
            category: self.category(),
            message: self.to_string(),
        }
        .serialize(serializer)
    }
}

impl Type for Error {
    fn inline(
        type_map: &mut specta::TypeMap,
        generics: specta::Generics,
    ) -> specta::datatype::DataType {
        ErrorPayload::inline(type_map, generics)
    }

    fn reference(
        type_map: &mut specta::TypeMap,
        generics: &[specta::datatype::DataType],
    ) -> specta::datatype::reference::Reference {
        // Result uses E::reference; specta's default inlines and would omit a named type.
        ErrorPayload::reference(type_map, generics)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Mutex, Once};

    fn parsed_payload(serialized: &str) -> serde_json::Value {
        serde_json::from_str(serialized).expect("serialized error must be a JSON object")
    }

    #[test]
    fn reqwest_serializes_as_network_failure() {
        let reqwest_error = reqwest::Client::new()
            .get("http://[")
            .build()
            .expect_err("invalid URL must fail request construction");
        let serialized = serde_json::to_string(&Error::from(reqwest_error)).unwrap();
        let payload = parsed_payload(&serialized);
        assert_eq!(payload["category"], "network");
        assert_eq!(payload["message"], "network failure");
        assert!(!serialized.contains("http"));
    }

    struct CapturingLogger;

    static CAPTURED_LOGS: Mutex<Vec<String>> = Mutex::new(Vec::new());
    static CAPTURING_LOGGER: CapturingLogger = CapturingLogger;
    static LOGGER_INIT: Once = Once::new();

    impl log::Log for CapturingLogger {
        fn enabled(&self, metadata: &log::Metadata<'_>) -> bool {
            metadata.level() <= log::Level::Info
        }

        fn log(&self, record: &log::Record<'_>) {
            if self.enabled(record.metadata()) {
                CAPTURED_LOGS
                    .lock()
                    .expect("captured log mutex poisoned")
                    .push(record.args().to_string());
            }
        }

        fn flush(&self) {}
    }

    fn install_capturing_logger() {
        LOGGER_INIT.call_once(|| {
            log::set_logger(&CAPTURING_LOGGER)
                .expect("capturing logger could not be installed in this test binary");
            log::set_max_level(log::LevelFilter::Info);
        });
    }

    #[test]
    fn test_committed_durability_uncertain_mapping() {
        let err = Error::CommittedDurabilityUncertain(DurabilityStage::RegistryReplacement);
        assert_eq!(
            err.to_string(),
            "Committed but durability uncertain: registry replacement"
        );
    }

    #[test]
    fn test_cancellation_display() {
        assert_eq!(Error::Cancellation.to_string(), "Cancellation");
    }

    #[test]
    fn every_durability_label_serializes_without_native_diagnostics() {
        let stages = [
            DurabilityStage::ArchiveFileReplacement,
            DurabilityStage::DatabasePgnReplacement,
            DurabilityStage::DirectoryInstall,
            DurabilityStage::DownloadTargetReplacement,
            DurabilityStage::GzipFileReplacement,
            DurabilityStage::OldDirectoryCleanup,
            DurabilityStage::OldDirectoryCleanupSync,
            DurabilityStage::PgnEdit,
            DurabilityStage::RegistryReplacement,
            DurabilityStage::SearchIndexReplacement,
            DurabilityStage::WorkspacePgnCreation,
            DurabilityStage::WorkspaceRemoval,
            DurabilityStage::WorkspaceSidecarCreation,
        ];
        for stage in stages {
            let serialized = serde_json::to_string(&Error::CommittedDurabilityUncertain(stage))
                .expect("serialize durability error");
            let payload = parsed_payload(&serialized);
            assert_eq!(payload["category"], "durability");
            assert!(payload["message"]
                .as_str()
                .expect("message")
                .starts_with("Committed but durability uncertain: "));
            assert!(!serialized.contains("/private/producer"));
            assert!(!serialized.contains(r"C:\producer"));
            assert!(!serialized.contains("raw operating system failure"));
        }
    }

    #[test]
    fn operation_and_cleanup_serialization_omits_both_diagnostics() {
        let error = Error::OperationAndCleanup {
            primary: "/private/producer: raw operating system failure".into(),
            cleanup: r"C:\producer: access denied".into(),
        };
        let serialized = serde_json::to_string(&error).expect("serialize cleanup error");
        let payload = parsed_payload(&serialized);
        assert_eq!(payload["category"], "operation-and-cleanup");
        assert_eq!(
            payload["message"],
            "Operation failed; temporary cleanup also failed"
        );
    }

    #[cfg(unix)]
    #[test]
    fn durability_producer_logs_native_cause() {
        install_capturing_logger();
        const CAUSE: &str = "/private/durability-log-test: native cause";
        CAPTURED_LOGS
            .lock()
            .expect("captured log mutex poisoned")
            .clear();

        struct ParentSyncFailure;
        impl crate::infra::fs::AtomicWriterInjector for ParentSyncFailure {
            fn inject(&self, point: crate::infra::fs::AtomicFileFaultPoint) -> std::io::Result<()> {
                if point == crate::infra::fs::AtomicFileFaultPoint::ParentSync {
                    Err(std::io::Error::other(CAUSE))
                } else {
                    Ok(())
                }
            }
        }

        struct ResetAtomicInjector;
        impl Drop for ResetAtomicInjector {
            fn drop(&mut self) {
                crate::infra::fs::set_test_atomic_file_injector(None);
            }
        }

        let directory = tempfile::tempdir().expect("durability log directory");
        let root = directory.path().join("root");
        std::fs::create_dir(&root).expect("durability log root");
        let mut authority = crate::infra::path_authority::PathAuthority::open(
            directory.path().join("registry.json"),
            vec![],
        )
        .expect("path authority");
        crate::infra::fs::set_test_atomic_file_injector(Some(std::sync::Arc::new(
            ParentSyncFailure,
        )));
        let _reset = ResetAtomicInjector;
        let commit = authority
            .migrate_legacy_os_path(
                root.into_os_string(),
                "durability log root",
                crate::infra::path_authority::PathClass::PersistentCustomRoot,
                vec![crate::infra::path_authority::PathOperation::DownloadFile],
            )
            .expect("registry commit");

        assert!(matches!(
            commit.durability,
            crate::infra::path_authority::CommitDurability::DurabilityUncertain(
                DurabilityStage::RegistryReplacement
            )
        ));
        assert!(CAPTURED_LOGS
            .lock()
            .expect("captured log mutex poisoned")
            .iter()
            .any(|message| message.contains(CAUSE)));
    }

    #[test]
    fn partial_removal_serialization_retains_only_the_typed_cause_category() {
        let err = Error::PartialRemoval {
            removed_entries: 2,
            cause: Box::new(Error::from(std::io::Error::other(
                "/private/root: raw operating system failure",
            ))),
        };
        assert!(matches!(
            err,
            Error::PartialRemoval {
                cause,
                ..
            } if matches!(*cause, Error::Io(_))
        ));

        let err = Error::PartialRemoval {
            removed_entries: 2,
            cause: Box::new(Error::from(std::io::Error::other(
                "/private/root: raw operating system failure",
            ))),
        };
        let serialized = serde_json::to_string(&err).expect("serialize error");
        let payload = parsed_payload(&serialized);
        assert_eq!(payload["category"], "partial-removal");
        assert_eq!(
            payload["message"],
            "Partially removed: 2 entries were deleted before failing: I/O failure"
        );
    }

    #[test]
    fn engine_timeout_serializes_as_engine_timeout_category() {
        let serialized =
            serde_json::to_string(&Error::EngineTimeout("waiting for readyok".into())).unwrap();
        let payload = parsed_payload(&serialized);
        assert_eq!(payload["category"], "engine-timeout");
    }

    #[test]
    fn analysis_cancelled_serializes_as_cancellation_category() {
        let serialized = serde_json::to_string(&Error::AnalysisCancelled).unwrap();
        let payload = parsed_payload(&serialized);
        assert_eq!(payload["category"], "cancellation");
    }

    #[test]
    fn io_not_found_serializes_as_missing_resource_without_path() {
        let serialized = serde_json::to_string(&Error::from(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            "/private/secret",
        )))
        .unwrap();
        let payload = parsed_payload(&serialized);
        assert_eq!(payload["category"], "missing-resource");
        assert_eq!(payload["message"], "I/O failure");
        assert!(!serialized.contains("/private/secret"));
    }

    #[test]
    fn io_permission_denied_serializes_as_permission_without_path() {
        let serialized = serde_json::to_string(&Error::from(std::io::Error::new(
            std::io::ErrorKind::PermissionDenied,
            "/private/secret",
        )))
        .unwrap();
        let payload = parsed_payload(&serialized);
        assert_eq!(payload["category"], "permission");
        assert!(!serialized.contains("/private/secret"));
    }

    #[test]
    fn io_other_serializes_as_io_category() {
        let serialized =
            serde_json::to_string(&Error::from(std::io::Error::other("unclassified"))).unwrap();
        let payload = parsed_payload(&serialized);
        assert_eq!(payload["category"], "io");
    }

    #[test]
    fn opaque_foreign_variants_omit_the_cause_from_the_payload_and_keep_it_on_source() {
        let r2d2_error = r2d2_timeout_error();
        assert!(r2d2_error
            .to_string()
            .contains("timed out waiting for connection"));
        let cases: [(&str, Error, &str, &str); 6] = [
            (
                "io",
                Error::from(std::io::Error::other("unique-io-marker")),
                "unique-io-marker",
                "I/O failure",
            ),
            (
                "zip",
                Error::from(zip::result::ZipError::InvalidArchive("unique-zip-marker")),
                "unique-zip-marker",
                "parsing failure",
            ),
            (
                "tauri",
                Error::from(tauri::Error::AssetNotFound(
                    "/private/secret-tauri-asset".into(),
                )),
                "/private/secret-tauri-asset",
                "platform failure",
            ),
            (
                "tauri-opener",
                Error::from(tauri_plugin_opener::Error::UnknownProgramName(
                    "secret-opener-program".into(),
                )),
                "secret-opener-program",
                "platform failure",
            ),
            (
                "diesel",
                Error::from(diesel::result::Error::DatabaseError(
                    diesel::result::DatabaseErrorKind::Unknown,
                    Box::new("SELECT * FROM secret_diesel_table".to_string()),
                )),
                "SELECT * FROM secret_diesel_table",
                "database failure",
            ),
            (
                "r2d2",
                Error::from(r2d2_error),
                "timed out waiting for connection",
                "database failure",
            ),
        ];
        for (label, error, marker, message) in cases {
            let serialized = serde_json::to_string(&error).expect("serialize opaque variant");
            let payload = parsed_payload(&serialized);
            assert_eq!(payload["message"], message, "{label} message");
            assert!(
                !serialized.contains(marker),
                "{label} leaked foreign display {marker:?} in {serialized}"
            );
            let source = std::error::Error::source(&error)
                .unwrap_or_else(|| panic!("{label} must keep its cause on source()"));
            let source_text = source.to_string();
            assert!(
                source_text.contains(marker),
                "{label} source {source_text} did not contain {marker}"
            );
        }
    }

    fn r2d2_timeout_error() -> diesel::r2d2::PoolError {
        let directory = tempfile::tempdir().expect("r2d2 leak tempdir");
        let path = directory.path().join("r2d2-leak.db");
        let manager = diesel::r2d2::ConnectionManager::<diesel::SqliteConnection>::new(
            path.to_string_lossy().into_owned(),
        );
        let pool = diesel::r2d2::Pool::builder()
            .max_size(1)
            .connection_timeout(std::time::Duration::from_millis(50))
            .build(manager)
            .expect("r2d2 pool");
        let _held = pool.get().expect("hold the only connection");
        match pool.get() {
            Err(error) => error,
            Ok(_) => panic!("exhausted pool times out"),
        }
    }

    #[test]
    fn serialize_emits_no_log_record_of_the_native_cause() {
        install_capturing_logger();
        const MARKER: &str = "/private/serialize-no-log-marker-f20260830";
        let error = Error::from(std::io::Error::other(MARKER));
        let _serialized = serde_json::to_string(&error).expect("serialize error");
        assert!(
            CAPTURED_LOGS
                .lock()
                .expect("captured log mutex poisoned")
                .iter()
                .all(|message| !message.contains(MARKER)),
            "serializing Error must not log the native cause"
        );
    }

    #[test]
    fn credential_failure_serialization_omits_the_keyring_string() {
        let error = Error::CredentialFailure("/private/keyring-secret-token".into());
        let serialized = serde_json::to_string(&error).expect("serialize credential error");
        let payload = parsed_payload(&serialized);
        assert_eq!(payload["category"], "credential");
        assert_eq!(payload["message"], "Credential operation failed");
        assert!(!serialized.contains("/private/keyring-secret-token"));
        assert!(!serialized.contains("keyring-secret-token"));
    }
}
