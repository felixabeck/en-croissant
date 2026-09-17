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

pub(crate) struct KeyedTestHooks<K: 'static> {
    hooks: OnceLock<Mutex<HashMap<K, TestHook>>>,
}

impl<K: Eq + Hash + Send + 'static> KeyedTestHooks<K> {
    pub(crate) const fn new() -> Self {
        Self {
            hooks: OnceLock::new(),
        }
    }

    fn slot(&self) -> &Mutex<HashMap<K, TestHook>> {
        self.hooks.get_or_init(|| Mutex::new(HashMap::new()))
    }

    /// Arms `hook` for exactly `key`; hooks armed for other identities are untouched.
    pub(crate) fn arm(&self, key: K, hook: TestHook) {
        if let Ok(mut hooks) = self.slot().lock() {
            hooks.insert(key, hook);
        }
    }

    /// Drops a hook that was armed but never fired, so a test leaves nothing behind.
    pub(crate) fn clear(&self, key: &K) {
        if let Ok(mut hooks) = self.slot().lock() {
            hooks.remove(key);
        }
    }

    /// Runs the hook armed for exactly this identity, at most once. The lock is released
    /// before the hook runs, so a hook may arm another.
    pub(crate) fn run(&self, key: &K) {
        let hook = match self.slot().lock() {
            Ok(mut hooks) => hooks.remove(key),
            Err(_) => None,
        };
        if let Some(hook) = hook {
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
}
