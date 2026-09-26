use std::{hash::Hash, sync::Arc};

use dashmap::{mapref::entry::Entry, DashMap};
#[cfg(test)]
use tokio::sync::TryLockError;
use tokio::sync::{Mutex, MutexGuard};

/// Per-key exclusion whose registry retains only outstanding leases.
///
/// The number of entries is at most the number of distinct keys with a held,
/// waiting, or not-yet-locked lease, and returns to zero after quiescence. The
/// `DashMap` allocation itself may retain its peak capacity.
pub(crate) struct KeyedLocks<K: Eq + Hash, M = Mutex<()>> {
    locks: DashMap<K, Arc<M>>,
    #[cfg(test)]
    between_count_and_remove_hook: parking_lot::Mutex<Option<Box<dyn FnOnce() + Send>>>,
}

impl<K, M> Default for KeyedLocks<K, M>
where
    K: Eq + Hash,
    M: Default + Send + Sync + 'static,
{
    fn default() -> Self {
        Self {
            locks: DashMap::new(),
            #[cfg(test)]
            between_count_and_remove_hook: parking_lot::Mutex::new(None),
        }
    }
}

impl<K, M> KeyedLocks<K, M>
where
    K: Clone + Eq + Hash,
    M: Default + Send + Sync + 'static,
{
    pub(crate) fn lease(&self, key: K) -> KeyedLockLease<'_, K, M> {
        let lock = match self.locks.entry(key.clone()) {
            Entry::Occupied(entry) => entry.get().clone(),
            Entry::Vacant(entry) => {
                let lock = Arc::new(M::default());
                entry.insert(lock.clone());
                lock
            }
        };
        KeyedLockLease {
            registry: self,
            key,
            lock: Some(lock),
        }
    }

    #[cfg(test)]
    pub(crate) fn len(&self) -> usize {
        self.locks.len()
    }
}

/// A non-cloneable claim on one keyed mutex. Only borrowed guards can escape.
pub(crate) struct KeyedLockLease<'a, K: Clone + Eq + Hash, M = Mutex<()>> {
    registry: &'a KeyedLocks<K, M>,
    key: K,
    lock: Option<Arc<M>>,
}

impl<K> KeyedLockLease<'_, K, Mutex<()>>
where
    K: Clone + Eq + Hash,
{
    pub(crate) async fn lock(&self) -> MutexGuard<'_, ()> {
        // Construction always stores one Arc, and only Drop takes it.
        self.lock
            .as_ref()
            .expect("lease owns its lock")
            .lock()
            .await
    }

    #[cfg(test)]
    pub(crate) fn try_lock(&self) -> Result<MutexGuard<'_, ()>, TryLockError> {
        // Construction always stores one Arc, and only Drop takes it.
        self.lock.as_ref().expect("lease owns its lock").try_lock()
    }
}

impl<K> KeyedLockLease<'_, K, parking_lot::Mutex<()>>
where
    K: Clone + Eq + Hash,
{
    pub(crate) fn lock_cancellable(
        &self,
        cancellation: &tokio_util::sync::CancellationToken,
    ) -> Result<parking_lot::MutexGuard<'_, ()>, crate::error::Error> {
        // Construction always stores one Arc, and only Drop takes it.
        crate::infra::cancellable_lock::lock_cancellable(
            self.lock.as_ref().expect("lease owns its lock"),
            cancellation,
        )
    }

    #[cfg(test)]
    pub(crate) fn lock(&self) -> parking_lot::MutexGuard<'_, ()> {
        self.lock.as_ref().expect("lease owns its lock").lock()
    }

    #[cfg(test)]
    pub(crate) fn try_lock(&self) -> Option<parking_lot::MutexGuard<'_, ()>> {
        self.lock.as_ref().expect("lease owns its lock").try_lock()
    }

    // The only consumer is the unix-only search-lock test in `db::search`.
    #[cfg(all(test, unix))]
    pub(crate) fn observe_wait(&self) -> crate::infra::cancellable_lock::LockWaitObserver {
        crate::infra::cancellable_lock::observe_lock_wait(
            self.lock.as_ref().expect("lease owns its lock"),
        )
    }
}

impl<K, M> Drop for KeyedLockLease<'_, K, M>
where
    K: Clone + Eq + Hash,
{
    fn drop(&mut self) {
        let Some(lock) = self.lock.as_ref() else {
            return;
        };
        match self.registry.locks.entry(self.key.clone()) {
            Entry::Occupied(entry) if Arc::ptr_eq(entry.get(), lock) => {
                drop(self.lock.take());
                if Arc::strong_count(entry.get()) == 1 {
                    #[cfg(test)]
                    if let Some(hook) = self.registry.between_count_and_remove_hook.lock().take() {
                        hook();
                    }
                    entry.remove();
                }
            }
            _ => {
                drop(self.lock.take());
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use std::{
        hash::Hash,
        sync::{mpsc, Arc, Barrier},
        time::{Duration, Instant},
    };

    use parking_lot::{Condvar, Mutex as ParkingMutex};

    use super::{KeyedLockLease, KeyedLocks};

    trait LeaseTestMutex: Default + Send + Sync + 'static {
        type Guard<'a>
        where
            Self: 'a;

        fn lock<'a, K>(lease: &'a KeyedLockLease<'_, K, Self>) -> Self::Guard<'a>
        where
            K: Clone + Eq + Hash;

        fn assert_contended<K>(lease: &KeyedLockLease<'_, K, Self>)
        where
            K: Clone + Eq + Hash;
    }

    impl LeaseTestMutex for ParkingMutex<()> {
        type Guard<'a>
            = parking_lot::MutexGuard<'a, ()>
        where
            Self: 'a;

        fn lock<'a, K>(lease: &'a KeyedLockLease<'_, K, Self>) -> Self::Guard<'a>
        where
            K: Clone + Eq + Hash,
        {
            lease
                .try_lock()
                .expect("test lease mutex should be available")
        }

        fn assert_contended<K>(lease: &KeyedLockLease<'_, K, Self>)
        where
            K: Clone + Eq + Hash,
        {
            assert!(lease.try_lock().is_none());
        }
    }

    impl LeaseTestMutex for tokio::sync::Mutex<()> {
        type Guard<'a>
            = tokio::sync::MutexGuard<'a, ()>
        where
            Self: 'a;

        fn lock<'a, K>(lease: &'a KeyedLockLease<'_, K, Self>) -> Self::Guard<'a>
        where
            K: Clone + Eq + Hash,
        {
            lease
                .try_lock()
                .expect("test lease mutex should be available")
        }

        fn assert_contended<K>(lease: &KeyedLockLease<'_, K, Self>)
        where
            K: Clone + Eq + Hash,
        {
            assert!(lease.try_lock().is_err());
        }
    }

    #[derive(Clone)]
    struct ReusableLatch(Arc<(ParkingMutex<bool>, Condvar)>);

    impl ReusableLatch {
        fn new() -> Self {
            Self(Arc::new((ParkingMutex::new(false), Condvar::new())))
        }

        fn set(&self) {
            let (state, changed) = &*self.0;
            *state.lock() = true;
            changed.notify_all();
        }

        fn wait(&self, timeout: Option<Duration>) -> bool {
            let (state, changed) = &*self.0;
            let mut ready = state.lock();
            let deadline = timeout.map(|duration| Instant::now() + duration);
            while !*ready {
                if let Some(deadline) = deadline {
                    let remaining = deadline.saturating_duration_since(Instant::now());
                    if remaining.is_zero() || changed.wait_for(&mut ready, remaining).timed_out() {
                        return *ready;
                    }
                } else {
                    changed.wait(&mut ready);
                }
            }
            true
        }
    }

    fn assert_acquire_between_count_and_remove<M>()
    where
        M: LeaseTestMutex,
    {
        let locks = Arc::new(KeyedLocks::<String, M>::default());
        let first = locks.lease("key".to_owned());
        let latch = ReusableLatch::new();
        let (release_tx, release_rx) = mpsc::channel::<()>();
        let worker_slot = Arc::new(ParkingMutex::new(None));
        let hook_locks = Arc::clone(&locks);
        let hook_latch = latch.clone();
        let hook_worker_slot = Arc::clone(&worker_slot);
        // The competitor is spawned from inside the window, so it cannot lease
        // before the count is read: an implementation that samples the count
        // outside the entry lock loses the competitor's mutex every time.
        *locks.between_count_and_remove_hook.lock() = Some(Box::new(move || {
            let open_window = hook_locks.locks.try_entry("key".to_owned()).is_some();
            let worker_locks = Arc::clone(&hook_locks);
            let worker_latch = hook_latch.clone();
            *hook_worker_slot.lock() = Some(std::thread::spawn(move || {
                let second = worker_locks.lease("key".to_owned());
                let guard = M::lock(&second);
                worker_latch.set();
                release_rx
                    .recv()
                    .expect("test releases the second lease holder");
                drop(guard);
                drop(second);
            }));
            if open_window {
                assert!(hook_latch.wait(None));
            }
        }));

        drop(first);
        let worker = worker_slot
            .lock()
            .take()
            .expect("final lease drop must run the count-to-remove hook");
        assert!(latch.wait(Some(Duration::from_secs(5))));
        let third = locks.lease("key".to_owned());
        M::assert_contended(&third);
        release_tx
            .send(())
            .expect("second lease holder is waiting for release");
        worker.join().expect("second lease holder must finish");
        drop(third);
        assert_eq!(locks.len(), 0);
    }

    fn assert_concurrent_final_cleanup<M>()
    where
        M: LeaseTestMutex,
    {
        let locks = Arc::new(KeyedLocks::<&'static str, M>::default());
        for _ in 0..100 {
            let first = locks.lease("key");
            let second = locks.lease("key");
            let barrier = Arc::new(Barrier::new(4));
            let (third_locked_tx, third_locked_rx) = mpsc::sync_channel(1);
            let (release_third_tx, release_third_rx) = mpsc::channel::<()>();

            std::thread::scope(|scope| {
                let first_barrier = Arc::clone(&barrier);
                let first_thread = scope.spawn(move || {
                    first_barrier.wait();
                    drop(first);
                });
                let second_barrier = Arc::clone(&barrier);
                let second_thread = scope.spawn(move || {
                    second_barrier.wait();
                    drop(second);
                });
                let third_barrier = Arc::clone(&barrier);
                let third_locks = Arc::clone(&locks);
                let third_thread = scope.spawn(move || {
                    third_barrier.wait();
                    let third = third_locks.lease("key");
                    let guard = M::lock(&third);
                    let _ = third_locked_tx.send(());
                    release_third_rx
                        .recv()
                        .expect("test releases the third lease holder");
                    drop(guard);
                    drop(third);
                });

                barrier.wait();
                third_locked_rx
                    .recv_timeout(Duration::from_secs(5))
                    .expect("third lease must acquire the lock");
                first_thread
                    .join()
                    .expect("first final lease drop must finish");
                second_thread
                    .join()
                    .expect("second final lease drop must finish");

                let fresh = locks.lease("key");
                M::assert_contended(&fresh);
                release_third_tx
                    .send(())
                    .expect("third lease holder is waiting for release");
                third_thread.join().expect("third lease holder must finish");
                drop(fresh);
            });
            assert_eq!(locks.len(), 0);
        }
    }

    #[tokio::test]
    async fn lease_retains_exclusion_for_holders_waiters_and_later_acquisitions() {
        let locks = KeyedLocks::<_, tokio::sync::Mutex<()>>::default();
        let first = locks.lease("same");
        let held = first.lock().await;
        let waiter = locks.lease("same");
        let mut waiting = Box::pin(waiter.lock());
        assert!(futures_util::poll!(&mut waiting).is_pending());
        let third = locks.lease("same");
        assert!(third.try_lock().is_err());
        drop(held);
        let waiter_guard = waiting.as_mut().await;
        drop(first);
        let fresh = locks.lease("same");
        assert!(third.try_lock().is_err());
        assert!(fresh.try_lock().is_err());
        drop(waiter_guard);
        drop(waiting);
        drop(waiter);
        let third_guard = third.lock().await;
        drop(third_guard);
        drop(third);
        drop(fresh);
        assert_eq!(locks.len(), 0);
    }

    #[tokio::test]
    async fn cancelled_waiter_unused_lease_and_independent_keys_are_reclaimed() {
        let locks = KeyedLocks::<_, tokio::sync::Mutex<()>>::default();
        let held_lease = locks.lease("held");
        let held = held_lease.lock().await;
        let waiter = locks.lease("held");
        let mut waiting = Box::pin(waiter.lock());
        assert!(futures_util::poll!(&mut waiting).is_pending());
        drop(waiting);
        drop(waiter);

        let independent = locks.lease("independent");
        assert!(independent.try_lock().is_ok());
        drop(independent);
        let unused = locks.lease("unused");
        drop(unused);
        drop(held);
        drop(held_lease);
        assert_eq!(locks.len(), 0);
    }

    #[test]
    fn parking_lot_acquire_between_count_and_remove_never_splits_the_lock() {
        assert_acquire_between_count_and_remove::<ParkingMutex<()>>();
    }

    #[test]
    fn tokio_acquire_between_count_and_remove_never_splits_the_lock() {
        assert_acquire_between_count_and_remove::<tokio::sync::Mutex<()>>();
    }

    #[test]
    fn parking_lot_concurrent_final_drops_and_reacquisition_never_split_the_lock() {
        assert_concurrent_final_cleanup::<ParkingMutex<()>>();
    }

    #[test]
    fn tokio_concurrent_final_drops_and_reacquisition_never_split_the_lock() {
        assert_concurrent_final_cleanup::<tokio::sync::Mutex<()>>();
    }

    #[test]
    fn distinct_key_churn_returns_entry_count_to_zero() {
        let locks = KeyedLocks::<usize, ParkingMutex<()>>::default();
        for iteration in 0..1000 {
            let lease = locks.lease(iteration % 100);
            let _guard = lease.lock();
        }
        assert_eq!(locks.len(), 0);
    }
}
