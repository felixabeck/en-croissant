use crate::error::Error;
use once_cell::sync::Lazy;
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::sync::Arc;
use tokio::sync::Semaphore;
use tokio_util::sync::CancellationToken;

pub static BLOCKING_GATEWAY: Lazy<BlockingGateway> = Lazy::new(|| BlockingGateway::new(4));

pub struct BlockingGateway {
    semaphore: Arc<tokio::sync::Semaphore>,
}

impl BlockingGateway {
    pub fn new(max_concurrent: usize) -> Self {
        Self {
            semaphore: Arc::new(Semaphore::new(max_concurrent)),
        }
    }

    pub async fn spawn<F, R>(&self, f: F) -> Result<R, Error>
    where
        F: FnOnce() -> Result<R, Error> + Send + 'static,
        R: Send + 'static,
    {
        let _permit = self
            .semaphore
            .acquire()
            .await
            .map_err(|_| Error::Cancellation)?;

        let handle = tokio::task::spawn_blocking(move || catch_unwind(AssertUnwindSafe(f)));

        match handle.await {
            Ok(Ok(Ok(result))) => Ok(result),
            Ok(Ok(Err(e))) => Err(e),
            Ok(Err(_panic_err)) => Err(Error::Conflict("Blocking task panicked".into())),
            Err(e) if e.is_cancelled() => Err(Error::Cancellation),
            Err(_) => Err(Error::Conflict("Blocking task panicked".into())),
        }
    }

    /// Keeps its permit inside the blocking worker, including when the awaiting command is
    /// abandoned. Callers supply cooperative checkpoints through `CancellationToken`.
    pub async fn spawn_cancellable<F, R>(
        &self,
        cancellation: CancellationToken,
        f: F,
    ) -> Result<R, Error>
    where
        F: FnOnce(&CancellationToken) -> Result<R, Error> + Send + 'static,
        R: Send + 'static,
    {
        let permit = self
            .semaphore
            .clone()
            .acquire_owned()
            .await
            .map_err(|_| Error::Cancellation)?;
        if cancellation.is_cancelled() {
            return Err(Error::Cancellation);
        }
        let worker_cancellation = cancellation.clone();
        let handle = tokio::task::spawn_blocking(move || {
            let _permit = permit;
            catch_unwind(AssertUnwindSafe(|| f(&worker_cancellation)))
        });
        match handle.await {
            Ok(Ok(Ok(result))) => Ok(result),
            Ok(Ok(Err(e))) => Err(e),
            Ok(Err(_)) => Err(Error::Conflict("Blocking task panicked".into())),
            Err(e) if e.is_cancelled() => Err(Error::Cancellation),
            Err(_) => Err(Error::Conflict("Blocking task panicked".into())),
        }
    }
}
