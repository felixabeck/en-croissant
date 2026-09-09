use std::{
    sync::{Mutex as StdMutex, MutexGuard as StdMutexGuard, TryLockError},
    time::Duration,
};

use parking_lot::{Mutex, MutexGuard};
use tokio_util::sync::CancellationToken;

use crate::error::Error;

const LOCK_POLL_INTERVAL: Duration = Duration::from_millis(25);

#[cfg(test)]
type StdLockWaitSender = std::sync::mpsc::SyncSender<()>;

#[cfg(test)]
type StdLockWaitHooks = std::collections::HashMap<usize, Vec<(u64, StdLockWaitSender)>>;

#[cfg(test)]
static STD_LOCK_WAIT_HOOK: std::sync::OnceLock<StdMutex<StdLockWaitHooks>> =
    std::sync::OnceLock::new();

#[cfg(test)]
static NEXT_STD_LOCK_OBSERVER: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(1);

#[cfg(test)]
pub(crate) struct StdLockWaitObserver {
    identity: usize,
    observer_id: u64,
    receiver: std::sync::mpsc::Receiver<()>,
}

#[cfg(test)]
impl StdLockWaitObserver {
    pub(crate) fn recv_timeout(
        &self,
        timeout: Duration,
    ) -> Result<(), std::sync::mpsc::RecvTimeoutError> {
        self.receiver.recv_timeout(timeout)
    }
}

#[cfg(test)]
impl Drop for StdLockWaitObserver {
    fn drop(&mut self) {
        let Some(hooks) = STD_LOCK_WAIT_HOOK.get() else {
            return;
        };
        if let Ok(mut hooks) = hooks.lock() {
            if let Some(observers) = hooks.get_mut(&self.identity) {
                observers.retain(|(observer_id, _)| *observer_id != self.observer_id);
                if observers.is_empty() {
                    hooks.remove(&self.identity);
                }
            }
        }
    }
}

#[cfg(test)]
pub(crate) fn observe_std_lock_wait<T>(lock: &StdMutex<T>) -> StdLockWaitObserver {
    let (entered_tx, entered_rx) = std::sync::mpsc::sync_channel(1);
    let identity = lock as *const StdMutex<T> as usize;
    let observer_id = NEXT_STD_LOCK_OBSERVER.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    STD_LOCK_WAIT_HOOK
        .get_or_init(|| StdMutex::new(std::collections::HashMap::new()))
        .lock()
        .unwrap()
        .entry(identity)
        .or_default()
        .push((observer_id, entered_tx));
    StdLockWaitObserver {
        identity,
        observer_id,
        receiver: entered_rx,
    }
}

#[cfg(test)]
fn notify_std_lock_wait<T>(lock: &StdMutex<T>) {
    let Some(hook) = STD_LOCK_WAIT_HOOK.get() else {
        return;
    };
    let identity = lock as *const StdMutex<T> as usize;
    if let Some(observers) = hook.lock().unwrap().remove(&identity) {
        for (_, entered_tx) in observers {
            let _ = entered_tx.send(());
        }
    }
}

/// Waits for a synchronous worker lock without busy-spinning, observing cancellation between
/// bounded waits. The returned guard has exactly the same lifetime as an ordinary lock guard.
pub fn lock_cancellable<'a, T>(
    lock: &'a Mutex<T>,
    cancellation: &CancellationToken,
) -> Result<MutexGuard<'a, T>, Error> {
    loop {
        if cancellation.is_cancelled() {
            return Err(Error::Cancellation);
        }
        if let Some(guard) = lock.try_lock_for(LOCK_POLL_INTERVAL) {
            return Ok(guard);
        }
    }
}

/// Waits for a standard-library mutex while retaining its poisoning contract.
///
/// `std::sync::Mutex` has no timed lock API, so the worker sleeps between bounded
/// `try_lock` attempts. Cancellation is checked before every attempt and after
/// acquisition, before the caller can begin a protected mutation.
pub fn lock_std_cancellable<'a, T>(
    lock: &'a StdMutex<T>,
    cancellation: &CancellationToken,
    poisoned_message: &'static str,
) -> Result<StdMutexGuard<'a, T>, Error> {
    loop {
        if cancellation.is_cancelled() {
            return Err(Error::Cancellation);
        }
        match lock.try_lock() {
            Ok(guard) => {
                if cancellation.is_cancelled() {
                    drop(guard);
                    return Err(Error::Cancellation);
                }
                return Ok(guard);
            }
            Err(TryLockError::WouldBlock) => {
                #[cfg(test)]
                notify_std_lock_wait(lock);
                std::thread::sleep(LOCK_POLL_INTERVAL);
            }
            Err(TryLockError::Poisoned(_)) => {
                return Err(Error::Conflict(poisoned_message.into()));
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;

    #[test]
    fn cancellation_ends_a_contended_wait() {
        let lock = Arc::new(Mutex::new(()));
        let held = lock.lock();
        let token = CancellationToken::new();
        let worker_lock = Arc::clone(&lock);
        let worker_token = token.clone();
        let (done_tx, done_rx) = std::sync::mpsc::channel();
        let worker = std::thread::spawn(move || {
            let cancelled = matches!(
                lock_cancellable(&worker_lock, &worker_token),
                Err(Error::Cancellation)
            );
            let _ = done_tx.send(cancelled);
        });
        token.cancel();
        let result = done_rx.recv_timeout(Duration::from_secs(5));
        drop(held);
        worker.join().unwrap();
        assert!(result.unwrap());
    }

    #[test]
    fn cancellation_ends_a_contended_standard_mutex_wait() {
        let lock = Arc::new(StdMutex::new(()));
        let held = lock.lock().unwrap();
        let token = CancellationToken::new();
        let worker_lock = Arc::clone(&lock);
        let worker_token = token.clone();
        let entered = observe_std_lock_wait(lock.as_ref());
        let (done_tx, done_rx) = std::sync::mpsc::channel();
        let worker = std::thread::spawn(move || {
            let cancelled = matches!(
                lock_std_cancellable(&worker_lock, &worker_token, "standard lock was poisoned"),
                Err(Error::Cancellation)
            );
            let _ = done_tx.send(cancelled);
        });
        entered
            .recv_timeout(Duration::from_secs(5))
            .expect("worker must contend on the held mutex");
        token.cancel();
        let result = done_rx.recv_timeout(Duration::from_secs(5));
        assert!(result.unwrap(), "cancellation must end the active wait");
        assert!(
            lock.try_lock().is_err(),
            "holder remains locked during cancellation"
        );
        drop(held);
        worker.join().unwrap();
    }

    #[test]
    fn standard_mutex_poisoning_is_preserved() {
        let lock = Arc::new(StdMutex::new(()));
        let poisoned = Arc::clone(&lock);
        assert!(std::thread::spawn(move || {
            let _guard = poisoned.lock().unwrap();
            panic!("poison lock");
        })
        .join()
        .is_err());

        let error = lock_std_cancellable(
            &lock,
            &CancellationToken::new(),
            "workspace mutation lock was poisoned",
        )
        .expect_err("poisoned mutex must fail");
        assert!(matches!(
            error,
            Error::Conflict(ref message) if message == "workspace mutation lock was poisoned"
        ));
    }
}
