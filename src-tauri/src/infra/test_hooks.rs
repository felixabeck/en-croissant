//! One-shot test hooks, keyed by the identity of the operation that fires them.
//!
//! `cargo test` runs this crate's tests in parallel in one process, so a hook parked in a
//! single global slot is consumed by whichever operation reaches the fire site first — which
//! need not be the one the arming test is driving, and a second test arming the same slot
//! silently discards the first hook. `f-20260917-09` was that defect: the game engine's
//! after-spawn hook lived in one slot, four other tests spawn game engines through the same
//! path, and on the macOS runner one run in three replaced the resource of a foreign test
//! before its own authorization snapshot was taken.
//!
//! A hook is therefore held against the identity — engine key, resource value — that the fire
//! site knows, and every other test's hook stays armed.

use std::{
    collections::HashMap,
    hash::Hash,
    sync::{Mutex, OnceLock},
};

pub(crate) type TestHook = Box<dyn FnOnce() + Send>;

/// A test value — a hook, an injected failure, a flag — held against the identity of the
/// operation that will consume it, and taken at most once.
pub(crate) struct KeyedTestValues<K: 'static, V: 'static> {
    entries: OnceLock<Mutex<HashMap<K, V>>>,
}

/// The common case: the value is a one-shot hook the fire site runs.
pub(crate) type KeyedTestHooks<K> = KeyedTestValues<K, TestHook>;

impl<K: Eq + Hash + Send + 'static, V: Send + 'static> KeyedTestValues<K, V> {
    pub(crate) const fn new() -> Self {
        Self {
            entries: OnceLock::new(),
        }
    }

    fn registry(&self) -> &Mutex<HashMap<K, V>> {
        self.entries.get_or_init(|| Mutex::new(HashMap::new()))
    }

    /// Arms `value` for exactly `key`; values armed for other identities are untouched.
    pub(crate) fn arm(&self, key: K, value: V) {
        if let Ok(mut entries) = self.registry().lock() {
            entries.insert(key, value);
        }
    }

    /// Drops a value that was armed but never taken, so a test leaves nothing behind.
    pub(crate) fn clear(&self, key: &K) {
        if let Ok(mut entries) = self.registry().lock() {
            entries.remove(key);
        }
    }

    /// Takes the value armed for exactly this identity, at most once.
    pub(crate) fn take(&self, key: &K) -> Option<V> {
        match self.registry().lock() {
            Ok(mut entries) => entries.remove(key),
            Err(_) => None,
        }
    }
}

impl<K: Eq + Hash + Send + 'static> KeyedTestValues<K, TestHook> {
    /// Runs the hook armed for exactly this identity, at most once. The registry lock is
    /// released before the hook runs, so a hook may arm another.
    pub(crate) fn run(&self, key: &K) {
        if let Some(hook) = self.take(key) {
            hook();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    };

    static HOOKS: KeyedTestHooks<String> = KeyedTestHooks::new();

    fn flagging_hook() -> (TestHook, Arc<AtomicBool>) {
        let flag = Arc::new(AtomicBool::new(false));
        let armed = flag.clone();
        (Box::new(move || armed.store(true, Ordering::SeqCst)), flag)
    }

    /// `f-20260917-09`: the guarantee the whole type exists for.
    #[test]
    fn a_hook_runs_once_for_its_own_identity_and_never_for_another() {
        let (first_hook, first_ran) = flagging_hook();
        let (second_hook, second_ran) = flagging_hook();
        HOOKS.arm("first".into(), first_hook);
        HOOKS.arm("second".into(), second_hook);

        HOOKS.run(&"unrelated".to_string());
        assert!(
            !first_ran.load(Ordering::SeqCst) && !second_ran.load(Ordering::SeqCst),
            "an operation with a different identity consumed an armed hook"
        );

        HOOKS.run(&"first".to_string());
        assert!(
            first_ran.load(Ordering::SeqCst),
            "the hook armed for this identity did not run"
        );
        assert!(
            !second_ran.load(Ordering::SeqCst),
            "arming a second hook must not disturb the first, and vice versa"
        );

        first_ran.store(false, Ordering::SeqCst);
        HOOKS.run(&"first".to_string());
        assert!(
            !first_ran.load(Ordering::SeqCst),
            "a hook must fire at most once"
        );

        HOOKS.clear(&"second".to_string());
        HOOKS.run(&"second".to_string());
        assert!(
            !second_ran.load(Ordering::SeqCst),
            "a cleared hook must not run"
        );
    }

    /// Arming the same identity twice replaces the first value rather than queueing it. The
    /// fire site takes one value, so a queue would leave the second armer's hook to be run by
    /// an unrelated later operation; every caller arms one identity at a time.
    #[test]
    fn arming_the_same_identity_twice_keeps_the_later_value() {
        static REARMED: KeyedTestHooks<String> = KeyedTestHooks::new();
        let (first_hook, first_ran) = flagging_hook();
        let (second_hook, second_ran) = flagging_hook();
        REARMED.arm("same".into(), first_hook);
        REARMED.arm("same".into(), second_hook);

        REARMED.run(&"same".to_string());
        assert!(
            second_ran.load(Ordering::SeqCst) && !first_ran.load(Ordering::SeqCst),
            "arming twice must leave exactly the later value armed"
        );

        REARMED.run(&"same".to_string());
        assert!(
            !first_ran.load(Ordering::SeqCst),
            "the replaced value must be dropped, never queued behind the later one"
        );
    }
}
