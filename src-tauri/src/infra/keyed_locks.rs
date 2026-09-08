use std::{hash::Hash, sync::Arc};

use dashmap::{mapref::entry::Entry, DashMap};
#[cfg(test)]
use tokio::sync::TryLockError;
use tokio::sync::{Mutex, MutexGuard};

/// Per-key asynchronous exclusion whose registry retains only outstanding leases.
///
/// The number of entries is at most the number of distinct keys with a held,
/// waiting, or not-yet-locked lease, and returns to zero after quiescence. The
/// `DashMap` allocation itself may retain its peak capacity.
pub(crate) struct KeyedLocks<K: Eq + Hash> {
    locks: DashMap<K, Arc<Mutex<()>>>,
}

impl<K: Eq + Hash> Default for KeyedLocks<K> {
    fn default() -> Self {
        Self {
            locks: DashMap::new(),
        }
    }
}

impl<K> KeyedLocks<K>
where
    K: Clone + Eq + Hash,
{
    pub(crate) fn lease(&self, key: K) -> KeyedLockLease<'_, K> {
        let lock = match self.locks.entry(key.clone()) {
            Entry::Occupied(entry) => entry.get().clone(),
            Entry::Vacant(entry) => {
                let lock = Arc::new(Mutex::new(()));
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
pub(crate) struct KeyedLockLease<'a, K: Clone + Eq + Hash> {
    registry: &'a KeyedLocks<K>,
    key: K,
    lock: Option<Arc<Mutex<()>>>,
}

impl<K> KeyedLockLease<'_, K>
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

impl<K> Drop for KeyedLockLease<'_, K>
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
    use std::sync::{Arc, Barrier};

    use super::KeyedLocks;

    #[tokio::test]
    async fn lease_retains_exclusion_for_holders_waiters_and_later_acquisitions() {
        let locks = KeyedLocks::default();
        let first = locks.lease("same");
        let held = first.lock().await;
        let waiter = locks.lease("same");
        let mut waiting = Box::pin(waiter.lock());
        assert!(futures_util::poll!(&mut waiting).is_pending());
        let third = locks.lease("same");
        assert!(third.try_lock().is_err());
        drop(held);
        drop(first);
        let waiter_guard = waiting.as_mut().await;
        assert!(third.try_lock().is_err());
        drop(waiter_guard);
        drop(waiting);
        drop(waiter);
        let third_guard = third.lock().await;
        drop(third_guard);
        drop(third);
        assert_eq!(locks.len(), 0);
    }

    #[tokio::test]
    async fn cancelled_waiter_unused_lease_and_independent_keys_are_reclaimed() {
        let locks = KeyedLocks::default();
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

    #[tokio::test]
    async fn concurrent_final_drops_and_reacquisition_never_split_the_lock() {
        let locks = Arc::new(KeyedLocks::default());
        for _ in 0..100 {
            let first = locks.lease("key");
            let second = locks.lease("key");
            let barrier = Arc::new(Barrier::new(3));
            std::thread::scope(|scope| {
                let first_barrier = barrier.clone();
                scope.spawn(move || {
                    first_barrier.wait();
                    drop(first);
                });
                let second_barrier = barrier.clone();
                scope.spawn(move || {
                    second_barrier.wait();
                    drop(second);
                });
                barrier.wait();
                let next = locks.lease("key");
                let peer = locks.lease("key");
                let guard = next.try_lock().unwrap();
                assert!(peer.try_lock().is_err());
                drop(guard);
                drop(peer);
                drop(next);
            });
        }
        assert_eq!(locks.len(), 0);
    }
}
