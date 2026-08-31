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

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error(transparent)]
    Io(Box<std::io::Error>),

    #[error(transparent)]
    Zip(Box<zip::result::ZipError>),

    #[error(transparent)]
    ParseInt(Box<std::num::ParseIntError>),

    #[error(transparent)]
    Tauri(Box<tauri::Error>),

    #[error(transparent)]
    TauriOpener(Box<tauri_plugin_opener::Error>),

    #[error(transparent)]
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

    #[error(transparent)]
    Diesel(Box<diesel::result::Error>),

    #[error(transparent)]
    R2d2(Box<diesel::r2d2::PoolError>),

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
    fn category(&self) -> &'static str {
        match self {
            Self::Io(_) => "I/O failure",
            Self::Zip(_) | Self::ParseInt(_) | Self::Fen(_) | Self::ParseUciMove(_) => {
                "parsing failure"
            }
            Self::Tauri(_) | Self::TauriOpener(_) => "platform failure",
            Self::Reqwest(_) => "network failure",
            Self::ChessPosition(_)
            | Self::IllegalUciMove(_)
            | Self::ParseSan(_)
            | Self::IllegalSan(_) => "chess data failure",
            Self::Diesel(_) | Self::R2d2(_) => "database failure",
            Self::SystemTime(_) | Self::InvalidInput(_) | Self::InvalidColor(_) => "invalid input",
            Self::NoStdin
            | Self::NoStdout
            | Self::NoMovesFound
            | Self::MissingReferenceDatabase
            | Self::NoOpeningFound
            | Self::NoPuzzles
            | Self::GameNotFound(_)
            | Self::EngineNotInitialized
            | Self::EngineDisconnected => "missing resource",
            Self::NotDistinctPlayers
            | Self::GameNotInProgress
            | Self::NotHumanTurn
            | Self::NotEngineTurn
            | Self::EngineTimeout(_)
            | Self::AnalysisCancelled
            | Self::Conflict(_) => "conflict",
            Self::ResourceLimit(_) => "resource limit",
            Self::OAuthFailure(_) => "authentication failure",
            Self::CredentialFailure(_) | Self::CredentialRecoveryRequired => "credential failure",
            Self::Cancellation => "cancellation",
            Self::CommittedDurabilityUncertain(_) => "durability failure",
            Self::PartialRemoval { .. } => "partial removal",
            Self::OperationAndCleanup { .. } => "operation and cleanup failure",
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
        serializer.serialize_str(self.to_string().as_ref())
    }
}

impl Type for Error {
    fn inline(
        _type_map: &mut specta::TypeMap,
        _generics: specta::Generics,
    ) -> specta::datatype::DataType {
        specta::datatype::DataType::Primitive(specta::datatype::PrimitiveType::String)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Mutex, Once};

    struct CapturingLogger;

    static CAPTURED_LOGS: Mutex<Vec<String>> = Mutex::new(Vec::new());
    static CAPTURING_LOGGER: CapturingLogger = CapturingLogger;
    static LOGGER_INIT: Once = Once::new();

    impl log::Log for CapturingLogger {
        fn enabled(&self, metadata: &log::Metadata<'_>) -> bool {
            metadata.level() <= log::Level::Warn
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
            log::set_max_level(log::LevelFilter::Warn);
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
            assert!(serialized.starts_with("\"Committed but durability uncertain: "));
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
        assert_eq!(
            serde_json::to_string(&error).expect("serialize cleanup error"),
            "\"Operation failed; temporary cleanup also failed\""
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
        crate::infra::fs::set_test_atomic_file_injector(Some(Box::new(ParentSyncFailure)));
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
        assert_eq!(
            serde_json::to_string(&err).expect("serialize error"),
            "\"Partially removed: 2 entries were deleted before failing: I/O failure\""
        );
    }
}
