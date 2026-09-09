use std::time::Duration;

use parking_lot::{Mutex, MutexGuard};
use tokio_util::sync::CancellationToken;

use crate::error::Error;

const LOCK_POLL_INTERVAL: Duration = Duration::from_millis(25);

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
}
