//! Process-lifetime completion mailbox for workflows whose application belongs to a document.
//! Records are bounded by the operation registry and are never evicted before acknowledgement.

use serde::{Deserialize, Serialize};
use specta::Type;

use crate::{
    chess::EngineConfig,
    error::{Error, ErrorPayload},
    infra::path_authority::{EngineHandle, EngineRootHandle},
};

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum EngineInstallIntent {
    Add {
        engine_id: String,
    },
    Upgrade {
        engine_id: String,
        expected: EngineHandle,
    },
}

impl EngineInstallIntent {
    pub(crate) fn engine_id(&self) -> &str {
        match self {
            Self::Add { engine_id } | Self::Upgrade { engine_id, .. } => engine_id,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct EngineInstallRequest {
    pub intent: EngineInstallIntent,
    pub root: EngineRootHandle,
    pub progress_id: String,
    pub url: String,
    pub sha256: String,
    pub signature: String,
    pub relative_path: String,
    pub name: String,
    pub version: String,
    pub elo: Option<f64>,
    pub download_size: Option<f64>,
}

// These three budgets are admission limits for an engine completion request, with shared limits intentional.
const MAX_COMPLETION_IDENTITY_BYTES: usize = 256;
const MAX_COMPLETION_TEXT_BYTES: usize = 4096;
const MAX_COMPLETION_NAME_BYTES: usize = 1024;

impl EngineInstallRequest {
    pub(crate) fn validate(&self, id: &str) -> Result<(), Error> {
        if uuid::Uuid::parse_str(id).is_err()
            || matches!(&self.intent, EngineInstallIntent::Add { engine_id } if uuid::Uuid::parse_str(engine_id).is_err())
            || self.intent.engine_id().is_empty()
            || self.intent.engine_id().len() > MAX_COMPLETION_IDENTITY_BYTES
            || self.progress_id.is_empty()
            || self.progress_id.len() > MAX_COMPLETION_TEXT_BYTES
            || self.url.len() > MAX_COMPLETION_TEXT_BYTES
            || self.signature.len() > MAX_COMPLETION_TEXT_BYTES
            || self.sha256.len() != 64
            || self.relative_path.is_empty()
            || self.relative_path.len() > MAX_COMPLETION_TEXT_BYTES
            || self.name.len() > MAX_COMPLETION_NAME_BYTES
            || self.version.len() > MAX_COMPLETION_IDENTITY_BYTES
            || self.root.id.id.len() > MAX_COMPLETION_IDENTITY_BYTES
            || matches!(&self.intent, EngineInstallIntent::Upgrade { expected, .. } if expected.id.id.len() > MAX_COMPLETION_IDENTITY_BYTES)
            || self.elo.is_some_and(|value| !value.is_finite())
            || self.download_size.is_some_and(|value| !value.is_finite())
        {
            return Err(Error::InvalidInput(
                "invalid engine completion request".into(),
            ));
        }
        // The authority still validates each relative component before registering an executable.
        Ok(())
    }
}

#[derive(Clone, Debug, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct InstalledEngineResult {
    pub handle: EngineHandle,
    pub config: EngineConfig,
    pub filename: String,
}

/// Shared outcome shape, also usable by the account workflow without another mailbox contract.
#[derive(Clone, Debug, Serialize, Type)]
#[serde(tag = "state", content = "result", rename_all = "camelCase")]
pub enum CompletionOutcome<T> {
    Running,
    Succeeded(T),
    Failed(ErrorPayload),
}

#[derive(Clone, Debug, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct EngineCompletion {
    pub id: String,
    pub request: EngineInstallRequest,
    pub outcome: CompletionOutcome<InstalledEngineResult>,
    pub retired: bool,
}

#[derive(Clone, Debug, Serialize, Type, tauri_specta::Event)]
pub struct CompletionChanged {
    pub id: String,
}

pub(crate) struct EngineCompletionEntry {
    pub owner: String,
    pub operation_id: String,
    pub snapshot: EngineCompletion,
    pub progress: Option<crate::progress::ProgressLease>,
    pub retirement: std::sync::Arc<tokio::sync::OnceCell<crate::engine::EngineBinaryRetirement>>,
    pub retirement_job: Option<CompletionApplication>,
    pub acknowledgement_job: Option<CompletionApplication>,
}

pub(crate) type CompletionApplication = futures_util::future::Shared<
    futures_util::future::BoxFuture<'static, Result<(), std::sync::Arc<Error>>>,
>;

#[derive(Clone, Copy)]
pub(crate) enum EngineApplicationStep {
    Retirement,
    Acknowledgement,
}

pub(crate) type CompletionAdmission = (CompletionApplication, Option<CompletionApplicationStart>);

pub(crate) struct CompletionApplicationStart {
    pub snapshot: EngineCompletion,
    pub retirement: std::sync::Arc<tokio::sync::OnceCell<crate::engine::EngineBinaryRetirement>>,
    pub lease: super::OperationLease,
    pub result: tokio::sync::oneshot::Sender<Result<(), std::sync::Arc<Error>>>,
}
