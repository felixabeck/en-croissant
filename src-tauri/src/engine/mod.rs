mod process;
mod types;
mod uci;

#[cfg(test)]
pub(crate) use process::REGISTRATION_CLEANUP_ERRORS;
#[cfg(all(test, unix))]
pub(crate) use process::REGISTRATION_GUARD_DROPS;
pub(crate) use process::{
    log_registration_cleanup_error, resolve_launch, resolve_option_leases, spawn_registered,
    verify_option_resources, AdmissionLease, RegistrationGuard,
};
pub use process::{EngineActor, EngineLog, EngineSupervisor, SupervisedEngine};
pub use types::*;
pub use uci::*;
