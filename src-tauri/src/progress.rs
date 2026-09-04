use std::{
    collections::HashMap,
    sync::Mutex,
    time::{Duration, Instant},
};

use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::Manager;
use tauri_specta::Event;

use crate::{error::Error, AppState};

const PROGRESS_CAPACITY: usize = 1_000;
const RUNNING_TTL: Duration = Duration::from_secs(60 * 60);
const TERMINAL_TTL: Duration = Duration::from_secs(5 * 60);

#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum ProgressState {
    Running,
    Succeeded,
    Failed,
    Cancelled,
}

impl ProgressState {
    fn is_terminal(self) -> bool {
        !matches!(self, Self::Running)
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Deserialize, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ProgressLease {
    pub id: String,
    pub generation: u64,
}

#[derive(Clone, Debug, PartialEq, Serialize, Type)]
pub struct ProgressItem {
    pub id: String,
    pub generation: u64,
    pub progress: f32,
    pub finished: bool,
    pub state: ProgressState,
}

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, Type, Event)]
pub struct ProgressEvent {
    pub id: String,
    pub generation: u64,
    pub progress: f32,
    pub finished: bool,
    pub state: ProgressState,
    pub cleared: bool,
}

#[derive(Clone)]
struct StoredProgress {
    item: ProgressItem,
    updated_at: Instant,
    last_access: u64,
}

#[derive(Default)]
struct ProgressStoreState {
    entries: HashMap<String, StoredProgress>,
    access_clock: u64,
    generation_clock: u64,
}

/// Every update is authenticated by a generation-bound lease. A caller can
/// report only a job it explicitly started; no stale or arbitrary ID can
/// recreate an entry after completion, restart, eviction, or clear.
#[derive(Default)]
pub struct ProgressStore {
    state: Mutex<ProgressStoreState>,
}

impl ProgressStore {
    fn ttl(item: &ProgressItem) -> Duration {
        if item.state.is_terminal() {
            TERMINAL_TTL
        } else {
            RUNNING_TTL
        }
    }

    fn tick_access(state: &mut ProgressStoreState) -> u64 {
        state.access_clock = state.access_clock.saturating_add(1);
        state.access_clock
    }

    fn next_generation(state: &mut ProgressStoreState) -> u64 {
        state.generation_clock = state.generation_clock.saturating_add(1);
        state.generation_clock
    }

    fn purge_expired_at(state: &mut ProgressStoreState, now: Instant) {
        state.entries.retain(|_, stored| {
            now.saturating_duration_since(stored.updated_at) < Self::ttl(&stored.item)
        });
    }

    fn evict_to_capacity(state: &mut ProgressStoreState) {
        while state.entries.len() >= PROGRESS_CAPACITY {
            let eviction = state
                .entries
                .iter()
                .min_by(|(left_id, left), (right_id, right)| {
                    left.last_access
                        .cmp(&right.last_access)
                        .then_with(|| left_id.cmp(right_id))
                })
                .map(|(id, _)| id.clone());
            if let Some(id) = eviction {
                state.entries.remove(&id);
            } else {
                break;
            }
        }
    }

    fn sanitize(progress: f32) -> f32 {
        if progress.is_finite() {
            progress.clamp(0.0, 100.0)
        } else {
            0.0
        }
    }

    fn start_at(&self, id: String, now: Instant) -> ProgressLease {
        let mut state = self.state.lock().expect("progress store poisoned");
        Self::purge_expired_at(&mut state, now);
        // Starting the same ID deliberately invalidates its former producer.
        state.entries.remove(&id);
        Self::evict_to_capacity(&mut state);
        let generation = Self::next_generation(&mut state);
        let last_access = Self::tick_access(&mut state);
        state.entries.insert(
            id.clone(),
            StoredProgress {
                item: ProgressItem {
                    id: id.clone(),
                    generation,
                    progress: 0.0,
                    finished: false,
                    state: ProgressState::Running,
                },
                updated_at: now,
                last_access,
            },
        );
        ProgressLease { id, generation }
    }

    pub fn start(&self, id: String) -> ProgressLease {
        self.start_at(id, Instant::now())
    }

    fn transition_at(
        &self,
        lease: &ProgressLease,
        progress: f32,
        requested_state: ProgressState,
        now: Instant,
    ) -> Result<(ProgressItem, bool), Error> {
        let mut state = self.state.lock().expect("progress store poisoned");
        Self::purge_expired_at(&mut state, now);
        let last_access = Self::tick_access(&mut state);
        let stored = state.entries.get_mut(&lease.id).ok_or_else(|| {
            Error::Conflict("progress lease is stale, cleared, or expired".into())
        })?;
        if stored.item.generation != lease.generation {
            return Err(Error::Conflict("progress lease generation is stale".into()));
        }
        let existing = &stored.item;
        let progress = Self::sanitize(progress);
        let item = if existing.state.is_terminal() {
            existing.clone()
        } else {
            let state = if requested_state.is_terminal() {
                requested_state
            } else {
                ProgressState::Running
            };
            ProgressItem {
                id: lease.id.clone(),
                generation: lease.generation,
                progress: progress.max(existing.progress),
                finished: state.is_terminal(),
                state,
            }
        };
        let changed = item.progress != existing.progress || item.state != existing.state;
        if changed {
            stored.item = item.clone();
            stored.updated_at = now;
        }
        stored.last_access = last_access;
        Ok((item, changed))
    }

    pub fn transition(
        &self,
        lease: &ProgressLease,
        progress: f32,
        requested_state: ProgressState,
    ) -> Result<(ProgressItem, bool), Error> {
        self.transition_at(lease, progress, requested_state, Instant::now())
    }

    fn get_at(&self, id: &str, now: Instant) -> Option<ProgressItem> {
        let mut state = self.state.lock().expect("progress store poisoned");
        Self::purge_expired_at(&mut state, now);
        let access = Self::tick_access(&mut state);
        state.entries.get_mut(id).map(|stored| {
            stored.last_access = access;
            stored.item.clone()
        })
    }

    pub fn get(&self, id: &str) -> Option<ProgressItem> {
        self.get_at(id, Instant::now())
    }

    /// Clearing removes visible state and advances the global generation clock,
    /// preventing an old producer from recreating the cleared ID.
    pub fn clear(&self, id: &str) -> u64 {
        let mut state = self.state.lock().expect("progress store poisoned");
        state.entries.remove(id);
        Self::next_generation(&mut state)
    }
}

/// Generic over the runtime so the emitting paths can be exercised against
/// `tauri::test::MockRuntime`; the `#[tauri::command]` entry points below stay
/// on the concrete runtime, as commands must.
fn emit<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    item: ProgressItem,
    cleared: bool,
) -> Result<(), Error> {
    ProgressEvent {
        id: item.id,
        generation: item.generation,
        progress: item.progress,
        finished: item.finished,
        state: item.state,
        cleared,
    }
    .emit(app)?;
    Ok(())
}

pub fn begin_progress<R: tauri::Runtime>(
    store: &ProgressStore,
    app: &tauri::AppHandle<R>,
    id: String,
) -> Result<ProgressLease, Error> {
    let lease = store.start(id);
    let item = store
        .get(&lease.id)
        .ok_or_else(|| Error::Conflict("new progress entry disappeared".into()))?;
    emit(app, item, false)?;
    Ok(lease)
}

pub fn update_progress_with_state<R: tauri::Runtime>(
    store: &ProgressStore,
    app: &tauri::AppHandle<R>,
    lease: &ProgressLease,
    progress: f32,
    state: ProgressState,
) -> Result<(), Error> {
    let (item, changed) = store.transition(lease, progress, state)?;
    if changed {
        emit(app, item, false)?;
    }
    Ok(())
}

/// Job progress goes through the one shared progress store instead of a
/// bespoke event, so the renderer's `useProgress` subscription, the generation
/// leases and the bounded retention policy apply to a long-running job exactly
/// as they do to every other.
pub struct JobProgress<R: tauri::Runtime = tauri::Wry> {
    app: tauri::AppHandle<R>,
    lease: ProgressLease,
}

impl<R: tauri::Runtime> JobProgress<R> {
    pub fn new(app: tauri::AppHandle<R>, id: String) -> Result<Self, Error> {
        let lease = {
            let state = app.state::<AppState>();
            begin_progress(&state.progress_state, &app, id)?
        };
        Ok(Self { app, lease })
    }

    pub fn lease(&self) -> ProgressLease {
        self.lease.clone()
    }

    pub fn complete(&self, state: ProgressState) {
        let progress = if matches!(state, ProgressState::Succeeded) {
            100.0
        } else {
            0.0
        };
        self.transition(progress, state);
    }

    /// A lease superseded by a newer job on the same id, or cleared by the
    /// user, makes the transition fail. That is the intended outcome — the older
    /// producer must not drive the newer bar — and it must not abort the job
    /// that is still running.
    fn transition(&self, progress: f32, state: ProgressState) {
        let app_state = self.app.state::<AppState>();
        let _ = update_progress_with_state(
            &app_state.progress_state,
            &self.app,
            &self.lease,
            progress,
            state,
        );
    }
}

impl<R: tauri::Runtime> Drop for JobProgress<R> {
    /// A job dropped without a terminal transition was cancelled. The store
    /// keeps the first terminal state it is given, so this is a no-op after
    /// `complete` and only fires on a genuinely abandoned job.
    fn drop(&mut self) {
        self.transition(0.0, ProgressState::Cancelled);
    }
}

#[tauri::command]
#[specta::specta]
pub fn start_progress(
    id: String,
    state: tauri::State<'_, crate::AppState>,
    app: tauri::AppHandle,
) -> Result<ProgressLease, Error> {
    begin_progress(&state.progress_state, &app, id)
}

#[tauri::command]
#[specta::specta]
pub fn get_progress(id: String, state: tauri::State<'_, crate::AppState>) -> Option<ProgressItem> {
    state.progress_state.get(&id)
}

#[tauri::command]
#[specta::specta]
pub fn set_progress_state(
    lease: ProgressLease,
    progress: f32,
    progress_state: ProgressState,
    state: tauri::State<'_, crate::AppState>,
    app: tauri::AppHandle,
) -> Result<(), Error> {
    update_progress_with_state(
        &state.progress_state,
        &app,
        &lease,
        progress,
        progress_state,
    )
}

#[tauri::command]
#[specta::specta]
pub fn clear_progress(
    id: String,
    state: tauri::State<'_, crate::AppState>,
    app: tauri::AppHandle,
) -> Result<u64, Error> {
    let generation = state.progress_state.clear(&id);
    emit(
        &app,
        ProgressItem {
            id,
            generation,
            progress: 0.0,
            finished: true,
            state: ProgressState::Cancelled,
        },
        true,
    )?;
    Ok(generation)
}

#[cfg(test)]
mod tests {
    use std::{sync::Arc, thread, time::Duration};

    use super::*;
    use tauri::Manager;

    #[test]
    fn stale_reporter_is_rejected_after_restart_and_clear() {
        let store = ProgressStore::default();
        let first = store.start("job".into());
        let second = store.start("job".into());
        assert!(store
            .transition(&first, 50.0, ProgressState::Running)
            .is_err());
        store.clear("job");
        assert!(store
            .transition(&second, 50.0, ProgressState::Running)
            .is_err());
        let third = store.start("job".into());
        assert!(third.generation > second.generation);
    }

    #[test]
    fn terminal_transition_is_immutable_and_all_terminal_states_are_explicit() {
        let store = ProgressStore::default();
        let success = store.start("success".into());
        let (done, _) = store
            .transition(&success, 100.0, ProgressState::Succeeded)
            .unwrap();
        let (unchanged, changed) = store
            .transition(&success, 0.0, ProgressState::Failed)
            .unwrap();
        assert!(!changed);
        assert_eq!(unchanged, done);

        for terminal in [ProgressState::Failed, ProgressState::Cancelled] {
            let lease = store.start(format!("{terminal:?}"));
            assert_eq!(
                store.transition(&lease, 10.0, terminal).unwrap().0.state,
                terminal
            );
        }
    }

    #[test]
    fn concurrent_reporters_cannot_regress_or_replace_terminal_state() {
        let store = Arc::new(ProgressStore::default());
        let lease = store.start("job".into());
        let mut workers = Vec::new();
        for progress in [10.0, 90.0, 25.0, 75.0, f32::NAN, 101.0] {
            let store = store.clone();
            let lease = lease.clone();
            workers.push(thread::spawn(move || {
                store
                    .transition(&lease, progress, ProgressState::Running)
                    .unwrap();
            }));
        }
        for worker in workers {
            worker.join().unwrap();
        }
        assert_eq!(store.get("job").unwrap().progress, 100.0);
        store
            .transition(&lease, 100.0, ProgressState::Succeeded)
            .unwrap();
        assert_eq!(
            store
                .transition(&lease, 5.0, ProgressState::Running)
                .unwrap()
                .0
                .state,
            ProgressState::Succeeded
        );
    }

    #[test]
    fn reads_expire_terminal_entries_earlier_than_running_entries() {
        let store = ProgressStore::default();
        let now = Instant::now();
        let done = store.start_at("done".into(), now);
        let running = store.start_at("running".into(), now);
        store
            .transition_at(&done, 100.0, ProgressState::Succeeded, now)
            .unwrap();
        store
            .transition_at(&running, 50.0, ProgressState::Running, now)
            .unwrap();
        let after_terminal_ttl = now + TERMINAL_TTL + Duration::from_millis(1);
        assert!(store.get_at("done", after_terminal_ttl).is_none());
        assert!(store.get_at("running", after_terminal_ttl).is_some());
        assert!(store
            .get_at("running", now + RUNNING_TTL + Duration::from_millis(1))
            .is_none());
    }

    #[test]
    fn capacity_uses_deterministic_lru_and_evicted_producer_cannot_recreate() {
        let store = ProgressStore::default();
        let now = Instant::now();
        let mut first = None;
        let mut second = None;
        for index in 0..PROGRESS_CAPACITY {
            let lease = store.start_at(format!("{index:04}"), now);
            if index == 0 {
                first = Some(lease);
            } else if index == 1 {
                second = Some(lease);
            }
        }
        assert!(store.get_at("0000", now).is_some());
        store.start_at("overflow".into(), now);
        assert!(store.get_at("0000", now).is_some());
        assert!(store.get_at("0001", now).is_none());
        assert!(store
            .transition(first.as_ref().unwrap(), 50.0, ProgressState::Running)
            .is_ok());
        assert!(store
            .transition(second.as_ref().unwrap(), 50.0, ProgressState::Running)
            .is_err());
    }

    fn job_progress_test_app() -> tauri::AppHandle<tauri::test::MockRuntime> {
        let app = tauri::test::mock_app();
        tauri_specta::Builder::<tauri::test::MockRuntime>::new()
            .events(tauri_specta::collect_events!(ProgressEvent))
            .mount_events(&app);
        app.manage(crate::AppState::default());
        app.handle().clone()
    }

    #[test]
    fn job_progress_complete_succeeded_stores_100() {
        let app = job_progress_test_app();
        let progress = JobProgress::new(app.clone(), "job".into()).unwrap();
        progress.complete(ProgressState::Succeeded);
        let item = app
            .state::<crate::AppState>()
            .progress_state
            .get("job")
            .unwrap();
        assert_eq!(item.state, ProgressState::Succeeded);
        assert_eq!(item.progress, 100.0);
    }

    #[test]
    fn job_progress_dropped_without_complete_stores_cancelled() {
        let app = job_progress_test_app();
        let progress = JobProgress::new(app.clone(), "job".into()).unwrap();
        drop(progress);
        let item = app
            .state::<crate::AppState>()
            .progress_state
            .get("job")
            .unwrap();
        assert_eq!(item.state, ProgressState::Cancelled);
        assert!(item.finished);
    }

    #[test]
    fn job_progress_complete_does_not_overwrite_the_first_terminal_state() {
        let app = job_progress_test_app();
        let progress = JobProgress::new(app.clone(), "job".into()).unwrap();
        progress.complete(ProgressState::Succeeded);
        progress.complete(ProgressState::Failed);
        let item = app
            .state::<crate::AppState>()
            .progress_state
            .get("job")
            .unwrap();
        assert_eq!(item.state, ProgressState::Succeeded);
        assert_eq!(item.progress, 100.0);
    }
}
