use crate::error::Error;
use once_cell::sync::Lazy;
use std::any::Any;
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::sync::Arc;
use tokio::sync::Semaphore;
use tokio_util::sync::CancellationToken;

pub static BLOCKING_GATEWAY: Lazy<BlockingGateway> = Lazy::new(|| BlockingGateway::new(4));

/// No closure passed to BLOCKING_GATEWAY may, directly or transitively, call BLOCKING_GATEWAY
/// again. Acquiring several permits in sequence from an async body is fine; acquiring one inside
/// another is the deadlock.
///
/// `create_workspace_file` awaits `count_pgn_games_core`, which awaits `scan_current`
/// (`pgn.rs:336`), which takes a permit — that is a legal sequential acquisition and must not
/// become a nested one. The semaphore has 4 permits, so four nested acquisitions hang the
/// process with no error.
pub struct BlockingGateway {
    semaphore: Arc<tokio::sync::Semaphore>,
}

fn panic_payload(payload: &(dyn Any + Send)) -> String {
    if let Some(message) = payload.downcast_ref::<&str>() {
        (*message).to_owned()
    } else if let Some(message) = payload.downcast_ref::<String>() {
        message.clone()
    } else {
        "unknown panic payload".to_owned()
    }
}

#[cfg(test)]
struct TestInjectorGuard;

#[cfg(test)]
impl Drop for TestInjectorGuard {
    fn drop(&mut self) {
        crate::infra::fs::set_test_atomic_file_injector(None);
        #[cfg(unix)]
        crate::infra::fs::set_test_removal_injector(None);
    }
}

fn map_join<R>(
    join: Result<std::thread::Result<Result<R, Error>>, tokio::task::JoinError>,
) -> Result<R, Error> {
    match join {
        Ok(Ok(Ok(result))) => Ok(result),
        Ok(Ok(Err(error))) => Err(error),
        Ok(Err(payload)) => {
            log::error!("Blocking task panicked: {}", panic_payload(&*payload));
            Err(Error::Conflict("Blocking task panicked".into()))
        }
        Err(error) if error.is_cancelled() => Err(Error::Cancellation),
        Err(error) => {
            let message = match error.try_into_panic() {
                Ok(payload) => panic_payload(&*payload),
                Err(error) => error.to_string(),
            };
            log::error!("Blocking task panicked: {message}");
            Err(Error::Conflict("Blocking task panicked".into()))
        }
    }
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

        // Test injectors are thread-local; spawn_blocking hops to another OS thread.
        #[cfg(test)]
        let atomic_injector = crate::infra::fs::current_test_atomic_file_injector();
        #[cfg(all(test, unix))]
        let removal_injector = crate::infra::fs::current_test_removal_injector();

        let handle = tokio::task::spawn_blocking(move || {
            #[cfg(test)]
            {
                crate::infra::fs::set_test_atomic_file_injector(atomic_injector);
                #[cfg(unix)]
                crate::infra::fs::set_test_removal_injector(removal_injector);
            }
            #[cfg(test)]
            let _injector_guard = TestInjectorGuard;
            catch_unwind(AssertUnwindSafe(f))
        });

        map_join(handle.await)
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
        // Test injectors are thread-local; spawn_blocking hops to another OS thread.
        #[cfg(test)]
        let atomic_injector = crate::infra::fs::current_test_atomic_file_injector();
        #[cfg(all(test, unix))]
        let removal_injector = crate::infra::fs::current_test_removal_injector();
        let handle = tokio::task::spawn_blocking(move || {
            let _permit = permit;
            #[cfg(test)]
            {
                crate::infra::fs::set_test_atomic_file_injector(atomic_injector);
                #[cfg(unix)]
                crate::infra::fs::set_test_removal_injector(removal_injector);
            }
            #[cfg(test)]
            let _injector_guard = TestInjectorGuard;
            catch_unwind(AssertUnwindSafe(|| f(&worker_cancellation)))
        });
        map_join(handle.await)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
    use std::sync::{Arc, Barrier, Condvar, Mutex};
    use std::time::Duration;

    #[tokio::test]
    async fn panicking_closure_surfaces_conflict_and_does_not_abort() {
        let gateway = BlockingGateway::new(1);
        let result = gateway
            .spawn(|| -> Result<(), Error> { panic!("gateway test panic") })
            .await;
        assert!(
            matches!(result, Err(Error::Conflict(ref message)) if message == "Blocking task panicked")
        );
    }

    #[tokio::test]
    async fn err_from_closure_is_returned_unchanged() {
        let gateway = BlockingGateway::new(1);
        let result = gateway
            .spawn(|| -> Result<(), Error> { Err(Error::InvalidInput("from the closure".into())) })
            .await;
        assert!(
            matches!(result, Err(Error::InvalidInput(ref message)) if message == "from the closure")
        );
    }

    #[tokio::test]
    async fn spawn_cancellable_skips_closure_when_already_cancelled() {
        let gateway = BlockingGateway::new(1);
        let cancellation = CancellationToken::new();
        cancellation.cancel();
        let ran = Arc::new(AtomicBool::new(false));
        let ran_in_closure = ran.clone();
        let result = gateway
            .spawn_cancellable(cancellation, move |_| {
                ran_in_closure.store(true, Ordering::SeqCst);
                Ok(())
            })
            .await;
        assert!(matches!(result, Err(Error::Cancellation)));
        assert!(
            !ran.load(Ordering::SeqCst),
            "already-cancelled spawn_cancellable must not run the closure"
        );
    }

    #[tokio::test]
    async fn spawn_never_runs_more_than_max_concurrent() {
        let gateway = Arc::new(BlockingGateway::new(2));
        let inflight = Arc::new(AtomicUsize::new(0));
        let high_water = Arc::new(AtomicUsize::new(0));
        let pair_entered = Arc::new(Barrier::new(3));
        let hold = Arc::new((Mutex::new(true), Condvar::new()));

        let start_holder = |gateway: Arc<BlockingGateway>| {
            let inflight = inflight.clone();
            let high_water = high_water.clone();
            let pair_entered = pair_entered.clone();
            let hold = hold.clone();
            tokio::spawn(async move {
                gateway
                    .spawn(move || {
                        let now = inflight.fetch_add(1, Ordering::SeqCst) + 1;
                        high_water.fetch_max(now, Ordering::SeqCst);
                        pair_entered.wait();
                        let (lock, cvar) = &*hold;
                        let mut holding = lock.lock().unwrap();
                        while *holding {
                            holding = cvar.wait(holding).unwrap();
                        }
                        inflight.fetch_sub(1, Ordering::SeqCst);
                        Ok(())
                    })
                    .await
            })
        };

        let first = start_holder(gateway.clone());
        let second = start_holder(gateway.clone());

        // Barrier wait is blocking; run it on the blocking pool or the current-thread
        // test runtime never polls the holders.
        let pair_entered_for_test = pair_entered.clone();
        tokio::task::spawn_blocking(move || {
            pair_entered_for_test.wait();
        })
        .await
        .unwrap();

        assert_eq!(high_water.load(Ordering::SeqCst), 2);
        assert_eq!(inflight.load(Ordering::SeqCst), 2);

        let third_ran = Arc::new(AtomicBool::new(false));
        let third_inflight = inflight.clone();
        let third_high_water = high_water.clone();
        let third_hold = hold.clone();
        let third_flag = third_ran.clone();
        let third_gateway = gateway.clone();
        let third = tokio::spawn(async move {
            third_gateway
                .spawn(move || {
                    let now = third_inflight.fetch_add(1, Ordering::SeqCst) + 1;
                    third_high_water.fetch_max(now, Ordering::SeqCst);
                    third_flag.store(true, Ordering::SeqCst);
                    let (lock, cvar) = &*third_hold;
                    let mut holding = lock.lock().unwrap();
                    while *holding {
                        holding = cvar.wait(holding).unwrap();
                    }
                    third_inflight.fetch_sub(1, Ordering::SeqCst);
                    Ok(())
                })
                .await
        });

        tokio::time::sleep(Duration::from_millis(100)).await;
        assert!(
            !third_ran.load(Ordering::SeqCst),
            "third closure ran while both permits were held"
        );
        assert!(high_water.load(Ordering::SeqCst) <= 2);

        {
            let (lock, cvar) = &*hold;
            *lock.lock().unwrap() = false;
            cvar.notify_all();
        }

        first.await.unwrap().unwrap();
        second.await.unwrap().unwrap();
        third.await.unwrap().unwrap();
        assert!(third_ran.load(Ordering::SeqCst));
        assert!(high_water.load(Ordering::SeqCst) <= 2);
    }

    struct FlagInjector(Arc<AtomicBool>);

    impl crate::infra::fs::AtomicWriterInjector for FlagInjector {
        fn inject(&self, _: crate::infra::fs::AtomicFileFaultPoint) -> std::io::Result<()> {
            self.0.store(true, Ordering::SeqCst);
            Ok(())
        }
    }

    #[tokio::test]
    async fn atomic_file_injector_fires_inside_spawn_blocking_worker() {
        struct ResetInjector;
        impl Drop for ResetInjector {
            fn drop(&mut self) {
                crate::infra::fs::set_test_atomic_file_injector(None);
            }
        }

        let fired = Arc::new(AtomicBool::new(false));
        crate::infra::fs::set_test_atomic_file_injector(Some(Arc::new(FlagInjector(
            fired.clone(),
        ))));
        let _reset = ResetInjector;
        BLOCKING_GATEWAY
            .spawn(|| {
                crate::infra::fs::inject_atomic_file(crate::infra::fs::AtomicFileFaultPoint::Write)
            })
            .await
            .expect("spawn");
        assert!(
            fired.load(Ordering::SeqCst),
            "injector installed on the test thread must fire inside BLOCKING_GATEWAY.spawn"
        );
    }
}
