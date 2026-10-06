use serde::Serialize;
use shakmaty::Chess;
use specta::Type;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Type)]
pub enum DurabilityStage {
    ArchiveCommitMarker,
    ArchiveReservationJournal,
    DatabasePgnReplacement,
    DirectoryInstall,
    DownloadTargetReplacement,
    NativeExport,
    OldDirectoryCleanup,
    OldDirectoryCleanupSync,
    PgnEdit,
    PgnCacheInvalidation,
    PgnCapabilityRebind,
    RegistryReplacement,
    SearchIndexReplacement,
    WorkspaceDirectoryCreation,
    WorkspacePgnCreation,
    WorkspaceRemoval,
    WorkspaceSidecarCreation,
    WorkspaceSidecarReplacement,
    PracticePositions,
    PracticeReviewShard,
    PracticeState,
}

impl std::fmt::Display for DurabilityStage {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(match self {
            Self::ArchiveCommitMarker => {
                "artifact commit marker, which may have committed; do not retry"
            }
            Self::ArchiveReservationJournal => {
                "artifact reservation journal, which may have committed; do not install or retry"
            }
            Self::DatabasePgnReplacement => "database PGN replacement",
            Self::DirectoryInstall => "directory installation",
            Self::DownloadTargetReplacement => "download target replacement",
            Self::NativeExport => "native export",
            Self::OldDirectoryCleanup => "old directory cleanup",
            Self::OldDirectoryCleanupSync => "old directory cleanup sync",
            Self::PgnEdit => "PGN edit",
            Self::PgnCacheInvalidation => "PGN cache invalidation after a committed edit",
            Self::PgnCapabilityRebind => "PGN file capability rebind after a committed edit",
            Self::RegistryReplacement => "registry replacement",
            Self::SearchIndexReplacement => "search index replacement",
            Self::WorkspaceDirectoryCreation => "workspace directory creation",
            Self::WorkspacePgnCreation => "workspace PGN creation",
            Self::WorkspaceRemoval => "workspace removal",
            Self::WorkspaceSidecarCreation => "workspace sidecar creation",
            Self::WorkspaceSidecarReplacement => "workspace sidecar replacement",
            Self::PracticePositions => "practice positions replacement",
            Self::PracticeReviewShard => "practice review-shard replacement",
            Self::PracticeState => "practice migration-state replacement",
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
    StaleGame,
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
    EnginePositionRejected,
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
            Self::StaleGame => "stale game",
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
            Self::EnginePositionRejected => "engine position rejected",
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
#[serde(rename_all = "camelCase")]
pub struct ErrorPayload {
    pub tag: ErrorPayloadTag,
    pub category: ErrorCategory,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[specta(optional)]
    pub root_failure: Option<RootFailure>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "kebab-case")]
pub enum RootFailure {
    Changed,
    Missing,
    Unusable,
    Permission,
    TooLarge,
}

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("{error}")]
    RootFailure {
        error: Box<Error>,
        reason: RootFailure,
    },
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

    #[error("Position cannot be played against an engine")]
    EnginePositionRejected(#[source] Box<Error>),

    #[error("Analysis cancelled")]
    AnalysisCancelled,
    #[error("Invalid input: {0}")]
    InvalidInput(String),

    #[error("The game changed on disk")]
    StaleGame,

    #[error("Conflict: {0}")]
    Conflict(String),

    #[error("Progress lease is stale, cleared, or expired")]
    StaleProgressLease,

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

/// Whether the OS reported that the named filesystem entry does not exist.
/// Raw OS codes are authoritative: unix accepts only `ENOENT`, and Windows accepts only
/// `ERROR_FILE_NOT_FOUND` / `ERROR_PATH_NOT_FOUND`. Without a raw code, synthetic
/// `ErrorKind::NotFound` means absence. This is narrower than Windows' `ErrorKind::NotFound`,
/// which also includes `ERROR_INVALID_DRIVE` (15), `ERROR_BAD_NETPATH` (53), and
/// `ERROR_BAD_NET_NAME` (67). Producer-layer rustix `Errno::NOENT` and SQLite VFS comparisons
/// use the same platform sets before an I/O error exists.
pub fn is_missing_entry_io(error: &std::io::Error) -> bool {
    match error.raw_os_error() {
        Some(code) => {
            #[cfg(unix)]
            {
                code == libc::ENOENT
            }
            #[cfg(windows)]
            {
                use windows_sys::Win32::Foundation::{ERROR_FILE_NOT_FOUND, ERROR_PATH_NOT_FOUND};
                code == ERROR_FILE_NOT_FOUND as i32 || code == ERROR_PATH_NOT_FOUND as i32
            }
        }
        None => error.kind() == std::io::ErrorKind::NotFound,
    }
}

/// Replaces native error text while preserving missing-entry classification and other kinds.
/// A raw-coded `NotFound` that is not absence becomes generic I/O, rather than a synthetic
/// missing entry after its raw code is removed.
pub fn sanitized_io_error(error: &std::io::Error, message: String) -> std::io::Error {
    let kind = if is_missing_entry_io(error) {
        std::io::ErrorKind::NotFound
    } else if error.kind() == std::io::ErrorKind::NotFound {
        std::io::ErrorKind::Other
    } else {
        error.kind()
    };
    std::io::Error::new(kind, message)
}

impl Error {
    /// True only for an I/O error reporting absence as defined by [`is_missing_entry_io`].
    pub fn is_missing_entry(&self) -> bool {
        matches!(self, Self::Io(error) if is_missing_entry_io(error))
    }

    pub(crate) fn with_root_failure(self, reason: RootFailure) -> Self {
        if self.root_failure().is_some() {
            return self;
        }
        Self::RootFailure {
            error: Box::new(self),
            reason,
        }
    }

    pub(crate) fn root_failure(&self) -> Option<RootFailure> {
        match self {
            Self::RootFailure { reason, .. } => Some(*reason),
            _ => None,
        }
    }

    /// Only use for failures from resolving, enumerating or acquiring the chosen root.
    pub(crate) fn root_failure_reason(&self) -> Option<RootFailure> {
        match self {
            Self::RootFailure { reason, .. } => Some(*reason),
            Self::Io(_) if self.is_missing_entry() => Some(RootFailure::Missing),
            Self::Io(error) => match error.kind() {
                std::io::ErrorKind::NotFound => Some(RootFailure::Missing),
                std::io::ErrorKind::PermissionDenied => Some(RootFailure::Permission),
                std::io::ErrorKind::InvalidInput => Some(RootFailure::Unusable),
                _ => None,
            },
            Self::InvalidInput(_) => Some(RootFailure::Unusable),
            Self::Conflict(_) => Some(RootFailure::Changed),
            _ => None,
        }
    }

    pub(crate) fn label_root_failure(self) -> Self {
        match self.root_failure_reason() {
            Some(reason) => self.with_root_failure(reason),
            None => self,
        }
    }

    pub(crate) fn unlabelled(&self) -> &Self {
        match self {
            Self::RootFailure { error, .. } => error.unlabelled(),
            _ => self,
        }
    }

    /// Returns the local diagnostic without changing the message exposed on the wire.
    pub(crate) fn diagnostic(&self) -> String {
        if let Self::RootFailure { error, .. } = self {
            return error.diagnostic();
        }
        if let Self::OperationAndCleanup { primary, cleanup } = self {
            return format!("primary={primary}; cleanup={cleanup}");
        }

        let mut diagnostic = self.to_string();
        let mut source = std::error::Error::source(self);
        while let Some(cause) = source {
            let cause_text = cause.to_string();
            if !diagnostic.ends_with(&cause_text) {
                diagnostic.push_str(": ");
                diagnostic.push_str(&cause_text);
            }
            source = cause.source();
        }
        diagnostic
    }

    /// Preserves the operation error and appends a cleanup failure when one exists.
    pub(crate) fn with_cleanup(primary: Error, cleanup: Result<(), Error>) -> Error {
        match cleanup {
            Ok(()) => primary,
            Err(cleanup) => Self::OperationAndCleanup {
                primary: primary.diagnostic(),
                cleanup: cleanup.diagnostic(),
            },
        }
    }

    pub fn category(&self) -> ErrorCategory {
        match self {
            Self::RootFailure { error, .. } => error.category(),
            Self::Io(_) if self.is_missing_entry() => ErrorCategory::MissingResource,
            Self::Io(error) => match error.kind() {
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
            Self::StaleGame => ErrorCategory::StaleGame,
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
            | Self::Conflict(_)
            | Self::StaleProgressLease => ErrorCategory::Conflict,
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
            Self::EnginePositionRejected(_) => ErrorCategory::EnginePositionRejected,
            Self::PuzzleThemesUnavailable => ErrorCategory::PuzzleThemesUnavailable,
        }
    }
}

const SQLITE_NOTADB: i32 = 26;

#[cfg(test)]
mod missing_entry_tests {
    use super::*;
    use std::io::{self, ErrorKind};

    fn assert_missing_entry_class(source: io::Error, missing: bool, category: ErrorCategory) {
        assert_eq!(is_missing_entry_io(&source), missing, "{source:?}");
        let rebuilt = sanitized_io_error(&source, "sanitised failure".into());
        assert_eq!(is_missing_entry_io(&rebuilt), missing);
        let expected_kind = if missing {
            ErrorKind::NotFound
        } else if source.kind() == ErrorKind::NotFound {
            ErrorKind::Other
        } else {
            source.kind()
        };
        assert_eq!(rebuilt.kind(), expected_kind);
        assert_eq!(rebuilt.raw_os_error(), None);
        assert_eq!(rebuilt.to_string(), "sanitised failure");
        let original = Error::from(source);
        let rebuilt = Error::from(rebuilt);
        for error in [original, rebuilt] {
            assert_eq!(error.is_missing_entry(), missing, "{error:?}");
            assert_eq!(error.category(), category, "{error:?}");
            if missing
                || matches!(&error, Error::Io(source) if source.kind() == ErrorKind::NotFound)
            {
                assert_eq!(error.root_failure_reason(), Some(RootFailure::Missing));
            } else {
                assert_ne!(error.root_failure_reason(), Some(RootFailure::Missing));
                if category == ErrorCategory::Permission {
                    assert_eq!(error.root_failure_reason(), Some(RootFailure::Permission));
                }
            }
        }
    }

    #[test]
    fn missing_entry_synthetic_errors_and_sanitising_helper() {
        assert_missing_entry_class(
            io::Error::from(ErrorKind::NotFound),
            true,
            ErrorCategory::MissingResource,
        );
        assert_missing_entry_class(
            io::Error::new(ErrorKind::NotFound, "absent"),
            true,
            ErrorCategory::MissingResource,
        );
        assert_missing_entry_class(io::Error::other("failure"), false, ErrorCategory::Io);
        assert!(!Error::Conflict("changed".into()).is_missing_entry());
        assert!(!Error::InvalidInput("invalid".into()).is_missing_entry());
    }

    #[cfg(unix)]
    #[test]
    fn missing_entry_unix_raw_errors_and_consumers() {
        for (raw, missing, category) in [
            (libc::ENOENT, true, ErrorCategory::MissingResource),
            (libc::ESRCH, false, ErrorCategory::Io),
            (libc::EACCES, false, ErrorCategory::Permission),
        ] {
            assert_missing_entry_class(io::Error::from_raw_os_error(raw), missing, category);
        }
    }

    #[cfg(windows)]
    #[test]
    fn missing_entry_windows_raw_errors_and_consumers() {
        use windows_sys::Win32::Foundation::{
            ERROR_ACCESS_DENIED, ERROR_BAD_NETPATH, ERROR_BAD_NET_NAME, ERROR_FILE_NOT_FOUND,
            ERROR_INVALID_DRIVE, ERROR_PATH_NOT_FOUND,
        };
        for (raw, missing, category) in [
            (ERROR_FILE_NOT_FOUND, true, ErrorCategory::MissingResource),
            (ERROR_PATH_NOT_FOUND, true, ErrorCategory::MissingResource),
            (ERROR_INVALID_DRIVE, false, ErrorCategory::Io),
            (ERROR_BAD_NETPATH, false, ErrorCategory::Io),
            (ERROR_BAD_NET_NAME, false, ErrorCategory::Io),
            (ERROR_ACCESS_DENIED, false, ErrorCategory::Permission),
        ] {
            assert_missing_entry_class(io::Error::from_raw_os_error(raw as i32), missing, category);
        }
    }
}

#[cfg(test)]
mod root_failure_tests {
    use super::*;

    #[cfg(windows)]
    #[test]
    fn root_failure_missing_drive_and_network_preserves_narrow_missing_entry_class() {
        use windows_sys::Win32::Foundation::{
            ERROR_BAD_NETPATH, ERROR_BAD_NET_NAME, ERROR_INVALID_DRIVE,
        };
        for raw in [ERROR_INVALID_DRIVE, ERROR_BAD_NETPATH, ERROR_BAD_NET_NAME] {
            let error = Error::from(std::io::Error::from_raw_os_error(raw as i32));
            assert_eq!(error.root_failure_reason(), Some(RootFailure::Missing));
            assert_eq!(
                error.label_root_failure().root_failure(),
                Some(RootFailure::Missing)
            );
        }
    }

    #[test]
    fn root_failure_serialization_and_diagnostics_are_additive() {
        let errors = [
            (
                Error::from(std::io::Error::new(
                    std::io::ErrorKind::NotFound,
                    "native missing",
                )),
                RootFailure::Missing,
            ),
            (
                Error::from(std::io::Error::new(
                    std::io::ErrorKind::PermissionDenied,
                    "native permission",
                )),
                RootFailure::Permission,
            ),
            (
                Error::InvalidInput("root shape".into()),
                RootFailure::Unusable,
            ),
            (
                Error::Conflict("root identity".into()),
                RootFailure::Changed,
            ),
            (
                Error::ResourceLimit("listing bound".into()),
                RootFailure::TooLarge,
            ),
            (
                Error::OperationAndCleanup {
                    primary: "primary".into(),
                    cleanup: "cleanup".into(),
                },
                RootFailure::Changed,
            ),
        ];
        for (error, reason) in errors {
            let before = serde_json::to_value(&error).unwrap();
            assert!(before.get("rootFailure").is_none());
            let diagnostic = error.diagnostic();
            let labelled = error.with_root_failure(reason);
            let after = serde_json::to_value(&labelled).unwrap();
            assert_eq!(after["category"], before["category"]);
            assert_eq!(after["message"], before["message"]);
            assert_eq!(labelled.diagnostic(), diagnostic);
            assert_eq!(after["rootFailure"], serde_json::to_value(reason).unwrap());
            assert_eq!(
                labelled
                    .with_root_failure(RootFailure::Permission)
                    .root_failure(),
                Some(reason)
            );
        }
    }

    #[test]
    fn root_failure_mapping_excludes_non_listing_resource_limits_and_other_errors() {
        for error in [
            Error::Cancellation,
            Error::ResourceLimit("registry capacity".into()),
            Error::CommittedDurabilityUncertain(DurabilityStage::RegistryReplacement),
            Error::from(std::io::Error::other("native failure")),
        ] {
            assert_eq!(error.root_failure_reason(), None);
            assert_eq!(error.label_root_failure().root_failure(), None);
        }
        let error = Error::from(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "root shape",
        ));
        assert_eq!(error.root_failure_reason(), Some(RootFailure::Unusable));
    }
}

fn sqlite_notadb_message(message: &str) -> bool {
    let message = message.to_ascii_lowercase();
    let code = SQLITE_NOTADB.to_string();
    message.contains("not a database")
        || message.contains("notadb")
        || message.contains(&format!("code {code}"))
        || message.contains(&format!("code: {code}"))
        || message.contains(&format!("({code})"))
        || message.trim() == code
        || message.ends_with(&format!(" {code}"))
}

pub(crate) fn is_sqlite_notadb(error: &Error) -> bool {
    match error.unlabelled() {
        Error::InvalidInput(message) => message == "SQLite file is not a database",
        Error::Diesel(error) => match error.as_ref() {
            diesel::result::Error::DatabaseError(_, information) => {
                sqlite_notadb_message(information.message())
            }
            _ => false,
        },
        _ => false,
    }
}

pub(crate) fn map_sqlite_establish(error: diesel::ConnectionError) -> Error {
    let notadb = match &error {
        diesel::ConnectionError::BadConnection(message) => sqlite_notadb_message(message),
        diesel::ConnectionError::CouldntSetupConfiguration(
            diesel::result::Error::DatabaseError(_, information),
        ) => sqlite_notadb_message(information.message()),
        _ => false,
    };
    if notadb {
        Error::InvalidInput("SQLite file is not a database".into())
    } else {
        log::warn!("could not open SQLite database: {error}");
        Error::InvalidInput("could not open SQLite database".into())
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
        // Backend log records do not reach the renderer; the payload stays on the fixed Display.
        ErrorPayload {
            tag: ErrorPayloadTag::BackendError,
            category: self.category(),
            message: self.to_string(),
            root_failure: self.root_failure(),
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
#[derive(Clone, Debug)]
pub(crate) struct CapturedLogRecord {
    pub level: log::Level,
    pub message: String,
}

#[cfg(test)]
pub(crate) struct LogCaptureScope {
    prev: Option<Vec<CapturedLogRecord>>,
}

#[cfg(test)]
struct CapturingLogger;

#[cfg(test)]
static CAPTURING_LOGGER: CapturingLogger = CapturingLogger;
#[cfg(test)]
static LOGGER_INIT: std::sync::Once = std::sync::Once::new();

#[cfg(test)]
thread_local! {
    static LOCAL_CAPTURE: std::cell::RefCell<Option<Vec<CapturedLogRecord>>> = const { std::cell::RefCell::new(None) };
}

#[cfg(test)]
impl log::Log for CapturingLogger {
    fn enabled(&self, metadata: &log::Metadata<'_>) -> bool {
        metadata.level() <= log::Level::Info
    }

    fn log(&self, record: &log::Record<'_>) {
        if self.enabled(record.metadata()) {
            let captured = CapturedLogRecord {
                level: record.level(),
                message: record.args().to_string(),
            };
            LOCAL_CAPTURE.with(|cell| {
                if let Some(logs) = cell.borrow_mut().as_mut() {
                    logs.push(captured);
                }
            });
        }
    }

    fn flush(&self) {}
}

#[cfg(test)]
fn install_capturing_logger() {
    LOGGER_INIT.call_once(|| {
        log::set_logger(&CAPTURING_LOGGER)
            .expect("capturing logger could not be installed in this test binary");
        log::set_max_level(log::LevelFilter::Info);
    });
}

#[cfg(test)]
impl LogCaptureScope {
    pub(crate) fn start() -> Self {
        install_capturing_logger();
        let prev = LOCAL_CAPTURE.with(|cell| cell.borrow_mut().replace(Vec::new()));
        Self { prev }
    }

    pub(crate) fn records(&self) -> Vec<CapturedLogRecord> {
        LOCAL_CAPTURE.with(|cell| {
            cell.borrow()
                .as_ref()
                .map(|logs| logs.clone())
                .unwrap_or_default()
        })
    }

    pub(crate) fn messages(&self) -> Vec<String> {
        self.records().into_iter().map(|r| r.message).collect()
    }
}

#[cfg(test)]
impl Drop for LogCaptureScope {
    fn drop(&mut self) {
        LOCAL_CAPTURE.with(|cell| {
            *cell.borrow_mut() = self.prev.take();
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn is_sqlite_notadb_diesel_code_26() {
        let error = Error::Diesel(Box::new(diesel::result::Error::DatabaseError(
            diesel::result::DatabaseErrorKind::Unknown,
            Box::new("26".to_string()),
        )));
        assert!(is_sqlite_notadb(&error));
    }

    #[test]
    fn is_sqlite_notadb_diesel_message() {
        let error = Error::Diesel(Box::new(diesel::result::Error::DatabaseError(
            diesel::result::DatabaseErrorKind::Unknown,
            Box::new("file is not a database".to_string()),
        )));
        assert!(is_sqlite_notadb(&error));
        assert!(!is_sqlite_notadb(&Error::Conflict("not a database".into())));
        assert!(!is_sqlite_notadb(&Error::InvalidInput(
            "DataRevision is not a non-negative i64".into(),
        )));
        assert!(!is_sqlite_notadb(&Error::InvalidInput(
            "DataRevision overflow".into(),
        )));
        assert!(!is_sqlite_notadb(&Error::Cancellation));
        assert!(!is_sqlite_notadb(&Error::Io(Box::new(
            std::io::Error::other("I/O failure",)
        ))));
        let busy = Error::Diesel(Box::new(diesel::result::Error::DatabaseError(
            diesel::result::DatabaseErrorKind::Unknown,
            Box::new("database is locked".to_string()),
        )));
        assert!(!is_sqlite_notadb(&busy));
    }

    fn parsed_payload(serialized: &str) -> serde_json::Value {
        let payload: serde_json::Value =
            serde_json::from_str(serialized).expect("serialized error must be a JSON object");
        // The discriminant is what lets the renderer tell an ErrorPayload from its own AppError,
        // which is the same JSON shape and shares the values `network` and `permission`
        // (`d-PENDING`, D-I). Asserting it here rather than in one test covers every serialize
        // test at once: without it, dropping `tag` from the wire leaves the whole suite green
        // while `isErrorPayload` never matches in production.
        assert_eq!(
            payload["tag"], "backend-error",
            "every serialized Error must carry the wire discriminant"
        );
        payload
    }

    #[test]
    fn sqlite_establish_serializes_fixed_message_and_logs_native_cause() {
        const NATIVE_CAUSE: &str = "/private/sqlite-database: native OS diagnostic";
        let capture = LogCaptureScope::start();
        let error =
            map_sqlite_establish(diesel::ConnectionError::BadConnection(NATIVE_CAUSE.into()));
        assert!(matches!(
            &error,
            Error::InvalidInput(message) if message == "could not open SQLite database"
        ));
        let serialized = serde_json::to_string(&error).unwrap();
        let payload = parsed_payload(&serialized);
        assert_eq!(payload["category"], "invalid-input");
        assert_eq!(
            payload["message"],
            "Invalid input: could not open SQLite database"
        );
        for native_fragment in NATIVE_CAUSE.split_whitespace() {
            assert!(!serialized.contains(native_fragment));
        }
        assert!(capture.records().iter().any(|record| {
            record.level == log::Level::Warn && record.message.contains(NATIVE_CAUSE)
        }));
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

    #[test]
    fn test_committed_durability_uncertain_mapping() {
        let err = Error::CommittedDurabilityUncertain(DurabilityStage::RegistryReplacement);
        assert_eq!(
            err.to_string(),
            "Committed but durability uncertain: registry replacement"
        );
        let directory =
            Error::CommittedDurabilityUncertain(DurabilityStage::WorkspaceDirectoryCreation);
        assert_eq!(
            directory.to_string(),
            "Committed but durability uncertain: workspace directory creation"
        );
    }

    #[test]
    fn test_cancellation_display() {
        assert_eq!(Error::Cancellation.to_string(), "Cancellation");
    }

    #[test]
    fn every_durability_label_serializes_without_native_diagnostics() {
        let stages = [
            DurabilityStage::ArchiveCommitMarker,
            DurabilityStage::ArchiveReservationJournal,
            DurabilityStage::DatabasePgnReplacement,
            DurabilityStage::DirectoryInstall,
            DurabilityStage::DownloadTargetReplacement,
            DurabilityStage::NativeExport,
            DurabilityStage::OldDirectoryCleanup,
            DurabilityStage::OldDirectoryCleanupSync,
            DurabilityStage::PgnEdit,
            DurabilityStage::PgnCacheInvalidation,
            DurabilityStage::PgnCapabilityRebind,
            DurabilityStage::RegistryReplacement,
            DurabilityStage::SearchIndexReplacement,
            DurabilityStage::WorkspaceDirectoryCreation,
            DurabilityStage::WorkspacePgnCreation,
            DurabilityStage::WorkspaceRemoval,
            DurabilityStage::WorkspaceSidecarCreation,
            DurabilityStage::WorkspaceSidecarReplacement,
            DurabilityStage::PracticePositions,
            DurabilityStage::PracticeReviewShard,
            DurabilityStage::PracticeState,
        ];
        // A new stage must be added to both the array and this exhaustive match.
        let _exhaustive = |stage: DurabilityStage| match stage {
            DurabilityStage::ArchiveCommitMarker
            | DurabilityStage::ArchiveReservationJournal
            | DurabilityStage::DatabasePgnReplacement
            | DurabilityStage::DirectoryInstall
            | DurabilityStage::DownloadTargetReplacement
            | DurabilityStage::NativeExport
            | DurabilityStage::OldDirectoryCleanup
            | DurabilityStage::OldDirectoryCleanupSync
            | DurabilityStage::PgnEdit
            | DurabilityStage::PgnCacheInvalidation
            | DurabilityStage::PgnCapabilityRebind
            | DurabilityStage::RegistryReplacement
            | DurabilityStage::SearchIndexReplacement
            | DurabilityStage::WorkspaceDirectoryCreation
            | DurabilityStage::WorkspacePgnCreation
            | DurabilityStage::WorkspaceRemoval
            | DurabilityStage::WorkspaceSidecarCreation
            | DurabilityStage::WorkspaceSidecarReplacement
            | DurabilityStage::PracticePositions
            | DurabilityStage::PracticeReviewShard
            | DurabilityStage::PracticeState => (),
        };
        for stage in stages {
            let error = Error::CommittedDurabilityUncertain(stage);
            let serialized = serde_json::to_string(&error).expect("serialize durability error");
            let payload = parsed_payload(&serialized);
            assert_eq!(payload["category"], "durability");
            assert_eq!(payload["message"], error.to_string());
            if stage == DurabilityStage::WorkspaceDirectoryCreation {
                assert_eq!(
                    payload["message"],
                    "Committed but durability uncertain: workspace directory creation"
                );
            }
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

    #[test]
    fn diagnostic_with_cleanup_preserves_both_io_causes() {
        const PRIMARY: &str = "diagnostic-primary-io-cause";
        const CLEANUP: &str = "diagnostic-cleanup-io-cause";
        let primary = Error::from(std::io::Error::other(PRIMARY));
        let cleanup = Error::from(std::io::Error::other(CLEANUP));
        let primary_diagnostic = primary.diagnostic();
        let cleanup_diagnostic = cleanup.diagnostic();

        let error = Error::with_cleanup(primary, Err(cleanup));
        match &error {
            Error::OperationAndCleanup { primary, cleanup } => {
                assert_eq!(primary, &primary_diagnostic);
                assert_eq!(cleanup, &cleanup_diagnostic);
                assert!(primary.contains(PRIMARY));
                assert!(cleanup.contains(CLEANUP));
            }
            other => panic!("expected combined cleanup error, got {other:?}"),
        }
        assert_eq!(
            error.diagnostic(),
            format!("primary={primary_diagnostic}; cleanup={cleanup_diagnostic}")
        );

        let unchanged = Error::with_cleanup(Error::Cancellation, Ok(()));
        assert!(matches!(unchanged, Error::Cancellation));
    }

    #[test]
    fn diagnostic_transparent_parse_text_appears_once() {
        let error: Error = "not-an-integer".parse::<u64>().unwrap_err().into();
        let display = error.to_string();

        assert_eq!(error.diagnostic(), display);
        assert_eq!(error.diagnostic().matches(&display).count(), 1);
    }

    #[test]
    fn diagnostic_skips_a_source_already_in_the_outer_source_text() {
        const INNER: &str = "diagnostic-source-chain-unique-inner";

        #[derive(Debug)]
        struct Inner;

        impl std::fmt::Display for Inner {
            fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                formatter.write_str(INNER)
            }
        }

        impl std::error::Error for Inner {}

        #[derive(Debug)]
        struct Outer(Inner);

        impl std::fmt::Display for Outer {
            fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                write!(formatter, "outer-context: {}", self.0)
            }
        }

        impl std::error::Error for Outer {
            fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
                Some(&self.0)
            }
        }

        let error = Error::from(std::io::Error::other(Outer(Inner)));
        assert_eq!(
            error.diagnostic(),
            format!("I/O failure: outer-context: {INNER}")
        );
    }

    #[cfg(unix)]
    #[test]
    fn durability_producer_logs_native_cause() {
        let capture = LogCaptureScope::start();
        const CAUSE: &str = "/private/durability-log-test: native cause";

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
            crate::infra::fs::ParentSyncFault(CAUSE),
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
        assert!(capture
            .messages()
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
    fn invalid_input_serializes_the_owned_message() {
        let serialized = serde_json::to_string(&Error::InvalidInput(
            "no window labeled 'main' found".into(),
        ))
        .unwrap();
        let payload = parsed_payload(&serialized);
        assert_eq!(payload["category"], "invalid-input");
        assert_eq!(
            payload["message"],
            "Invalid input: no window labeled 'main' found"
        );
    }

    #[test]
    fn stale_game_serializes_as_stale_game_category() {
        let serialized = serde_json::to_string(&Error::StaleGame).expect("serialize stale game");
        let payload = parsed_payload(&serialized);
        assert_eq!(payload["category"], "stale-game");
    }

    #[test]
    fn opaque_foreign_variants_omit_the_cause_from_the_payload_and_keep_it_on_source() {
        let r2d2_error = r2d2_timeout_error();
        assert!(r2d2_error
            .to_string()
            .contains("timed out waiting for connection"));
        let cases: [(&str, Error, &str, &str, &str); 6] = [
            (
                "io",
                Error::from(std::io::Error::other("unique-io-marker")),
                "unique-io-marker",
                "I/O failure",
                "io",
            ),
            (
                "zip",
                Error::from(zip::result::ZipError::InvalidArchive("unique-zip-marker")),
                "unique-zip-marker",
                "parsing failure",
                "parsing",
            ),
            (
                "tauri",
                Error::from(tauri::Error::AssetNotFound(
                    "/private/secret-tauri-asset".into(),
                )),
                "/private/secret-tauri-asset",
                "platform failure",
                "platform",
            ),
            (
                "tauri-opener",
                Error::from(tauri_plugin_opener::Error::UnknownProgramName(
                    "secret-opener-program".into(),
                )),
                "secret-opener-program",
                "platform failure",
                "platform",
            ),
            (
                "diesel",
                Error::from(diesel::result::Error::DatabaseError(
                    diesel::result::DatabaseErrorKind::Unknown,
                    Box::new("SELECT * FROM secret_diesel_table".to_string()),
                )),
                "SELECT * FROM secret_diesel_table",
                "database failure",
                "database",
            ),
            (
                "r2d2",
                Error::from(r2d2_error),
                "timed out waiting for connection",
                "database failure",
                "database",
            ),
        ];
        for (label, error, marker, message, category) in cases {
            let serialized = serde_json::to_string(&error).expect("serialize opaque variant");
            let payload = parsed_payload(&serialized);
            assert_eq!(payload["message"], message, "{label} message");
            // Pin the category per variant, not only the Display. Without this, regrouping a
            // variant into another `category()` arm leaves this test and every renderer
            // BACKEND_CATEGORY row green -- those rows feed hand-built categories, never a
            // serialized Zip or Diesel -- and ConfirmModal then interpolates the wrong key.
            assert_eq!(payload["category"], category, "{label} category");
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
        let capture = LogCaptureScope::start();
        const MARKER: &str = "/private/serialize-no-log-marker-f20260830";
        let error = Error::from(std::io::Error::other(MARKER));
        let _serialized = serde_json::to_string(&error).expect("serialize error");
        assert!(
            capture
                .messages()
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
