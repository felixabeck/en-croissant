use std::sync::{Arc, Mutex};

use tokio_util::sync::CancellationToken;

use super::PathAuthority;
use crate::error::Error;

/// Sole owner of the authority mutex. Its private mutex prevents direct locking and
/// hand-written unavailability mappings outside this module (f-20260922-01).
#[derive(Clone)]
pub struct SharedPathAuthority {
    inner: Arc<Mutex<Option<PathAuthority>>>,
}

/// Typed authority access failures, mapped here to the two renderer-visible texts.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AuthorityUnavailable {
    Poisoned,
    Uninitialized,
}

/// Centralizes the renderer-visible conflict texts for authority access failures.
impl From<AuthorityUnavailable> for Error {
    fn from(unavailable: AuthorityUnavailable) -> Self {
        Self::Conflict(unavailable.message().into())
    }
}

impl AuthorityUnavailable {
    fn message(self) -> &'static str {
        match self {
            Self::Poisoned => "path authority lock was poisoned",
            Self::Uninitialized => "path authority is not initialized",
        }
    }
}

impl SharedPathAuthority {
    pub fn uninitialized() -> Self {
        Self {
            inner: Arc::new(Mutex::new(None)),
        }
    }

    pub fn install(&self, authority: PathAuthority) -> Result<(), AuthorityUnavailable> {
        let mut guard = self
            .inner
            .lock()
            .map_err(|_| AuthorityUnavailable::Poisoned)?;
        *guard = Some(authority);
        Ok(())
    }

    /// Returns typed unavailability without invoking the closure on failure.
    /// Holds the authority guard exactly for the closure's execution.
    pub fn with_mut<T>(
        &self,
        access: impl FnOnce(&mut PathAuthority) -> T,
    ) -> Result<T, AuthorityUnavailable> {
        let mut guard = self
            .inner
            .lock()
            .map_err(|_| AuthorityUnavailable::Poisoned)?;
        let authority = guard.as_mut().ok_or(AuthorityUnavailable::Uninitialized)?;
        Ok(access(authority))
    }

    /// Returns outer `Err(Error::Cancellation)` when cancellation is observed while waiting.
    /// Otherwise returns inner typed unavailability or the closure's result.
    pub fn with_mut_cancellable<T>(
        &self,
        cancellation: &CancellationToken,
        access: impl FnOnce(&mut PathAuthority) -> T,
    ) -> Result<Result<T, AuthorityUnavailable>, Error> {
        let mut guard = match crate::infra::cancellable_lock::lock_std_cancellable(
            &self.inner,
            cancellation,
            AuthorityUnavailable::Poisoned.message(),
        ) {
            Ok(guard) => guard,
            Err(Error::Cancellation) => return Err(Error::Cancellation),
            Err(_) => return Ok(Err(AuthorityUnavailable::Poisoned)),
        };
        let Some(authority) = guard.as_mut() else {
            return Ok(Err(AuthorityUnavailable::Uninitialized));
        };
        Ok(Ok(access(authority)))
    }

    /// Creates an owner with an installed authority for tests.
    #[cfg(test)]
    pub(crate) fn installed(authority: PathAuthority) -> Self {
        Self {
            inner: Arc::new(Mutex::new(Some(authority))),
        }
    }

    /// Really poisons the mutex by panicking inside a held guard on a scoped thread.
    #[cfg(test)]
    pub(crate) fn poison(&self) {
        std::thread::scope(|scope| {
            assert!(scope
                .spawn(|| {
                    let _guard = self.inner.lock().unwrap();
                    panic!("poison path authority");
                })
                .join()
                .is_err());
        });
    }

    /// Removes the installed authority for tests of uninitialized access.
    #[cfg(test)]
    pub(crate) fn uninstall(&self) {
        *self.inner.lock().unwrap() = None;
    }

    /// Exposes the mutex only for tests that prove locking behavior.
    #[cfg(test)]
    pub(crate) fn raw_for_test(&self) -> &Mutex<Option<PathAuthority>> {
        &self.inner
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::ErrorCategory;
    use std::cell::Cell;
    use std::time::Duration;

    fn authority(directory: &tempfile::TempDir) -> PathAuthority {
        PathAuthority::open(directory.path().join("paths.json"), vec![]).unwrap()
    }

    #[test]
    fn unavailable_access_never_invokes_the_closure() {
        for unavailable in [
            AuthorityUnavailable::Poisoned,
            AuthorityUnavailable::Uninitialized,
        ] {
            let directory = tempfile::tempdir().unwrap();
            let owner = SharedPathAuthority::installed(authority(&directory));
            if unavailable == AuthorityUnavailable::Poisoned {
                owner.poison();
            } else {
                owner.uninstall();
            }
            let called = Cell::new(false);
            assert_eq!(owner.with_mut(|_| called.set(true)), Err(unavailable));
            assert!(!called.get());
        }
    }

    #[test]
    fn closure_error_is_returned_untouched() {
        let directory = tempfile::tempdir().unwrap();
        let owner = SharedPathAuthority::installed(authority(&directory));
        let original = Error::InvalidInput("closure error".into());
        let returned = owner
            .with_mut(|_| Err::<(), _>(&original))
            .unwrap()
            .unwrap_err();
        assert!(std::ptr::eq(returned, &original));
    }

    #[test]
    fn unavailable_renderer_contract_is_exact() {
        for (unavailable, expected) in [
            (
                AuthorityUnavailable::Poisoned,
                "Conflict: path authority lock was poisoned",
            ),
            (
                AuthorityUnavailable::Uninitialized,
                "Conflict: path authority is not initialized",
            ),
        ] {
            let error = Error::from(unavailable);
            assert_eq!(error.to_string(), expected);
            assert_eq!(error.category(), ErrorCategory::Conflict);
            assert_eq!(error.root_failure(), None);
        }
    }

    #[test]
    fn cancellable_access_retains_typed_unavailability_without_calling_the_closure() {
        for unavailable in [
            AuthorityUnavailable::Poisoned,
            AuthorityUnavailable::Uninitialized,
        ] {
            let owner = SharedPathAuthority::uninitialized();
            if unavailable == AuthorityUnavailable::Poisoned {
                owner.poison();
            }
            let called = Cell::new(false);
            let result =
                owner.with_mut_cancellable(&CancellationToken::new(), |_| called.set(true));
            assert_eq!(result.unwrap(), Err(unavailable));
            assert!(!called.get());
        }
    }

    #[test]
    fn cancellation_ends_a_contended_authority_wait() {
        let directory = tempfile::tempdir().unwrap();
        let owner = SharedPathAuthority::installed(authority(&directory));
        let held = owner.raw_for_test().lock().unwrap();
        let waiting = crate::infra::cancellable_lock::observe_std_lock_wait(owner.raw_for_test());
        let token = CancellationToken::new();
        std::thread::scope(|scope| {
            let worker =
                scope.spawn(|| owner.with_mut_cancellable(&token, |_| panic!("cancelled access")));
            waiting.recv_timeout(Duration::from_secs(5)).unwrap();
            token.cancel();
            assert!(matches!(worker.join().unwrap(), Err(Error::Cancellation)));
            assert!(owner.raw_for_test().try_lock().is_err());
        });
        drop(held);
    }

    #[test]
    fn install_on_a_poisoned_owner_fails_without_installing() {
        let directory = tempfile::tempdir().unwrap();
        let owner = SharedPathAuthority::uninitialized();
        owner.poison();
        assert_eq!(
            owner.install(authority(&directory)),
            Err(AuthorityUnavailable::Poisoned)
        );
        let guard = owner.raw_for_test().lock().err().unwrap().into_inner();
        assert!(guard.is_none());
    }
}
