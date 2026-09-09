use std::{
    collections::HashMap,
    future::Future,
    sync::{Arc, Condvar, Mutex, MutexGuard},
    time::{Duration, Instant},
};

use tokio_util::sync::CancellationToken;
use uuid::Uuid;

use futures_util::FutureExt;

use crate::error::Error;

pub const READ_RESERVATION_TTL: Duration = Duration::from_secs(60);
pub const MAX_NATIVE_READS: usize = 128;
pub const MAX_ACCEPTED_OPERATIONS: usize = 128;

enum ReadState {
    Reserved {
        created_at: Instant,
    },
    Active {
        cancellation: CancellationToken,
        label: String,
    },
}

struct ReadEntry {
    owner: String,
    tab: Option<String>,
    state: ReadState,
}

#[derive(Clone, Copy)]
enum ReservationKind<'a> {
    Read,
    Analysis { tab: &'a str },
}

impl<'a> ReservationKind<'a> {
    fn tab(self) -> Option<&'a str> {
        match self {
            Self::Read => None,
            Self::Analysis { tab } => Some(tab),
        }
    }

    fn lease_kind(self) -> LeaseKind {
        match self {
            Self::Read => LeaseKind::Read,
            Self::Analysis { .. } => LeaseKind::Analysis,
        }
    }

    fn capacity_error(self) -> &'static str {
        match self {
            Self::Read => "too many native read operations",
            Self::Analysis { .. } => "too many prepared analysis operations",
        }
    }

    fn unknown_error(self) -> &'static str {
        match self {
            Self::Read => "native read reservation is unknown or expired",
            Self::Analysis { .. } => "analysis reservation is unknown or expired",
        }
    }

    fn owner_error(self) -> &'static str {
        match self {
            Self::Read => "native read reservation belongs to another webview",
            Self::Analysis { .. } => "analysis reservation belongs to another webview or tab",
        }
    }

    fn wrong_kind_error(self, cancelling: bool) -> &'static str {
        match (self, cancelling) {
            (Self::Read, false) => "analysis reservation cannot be claimed as a native read",
            (Self::Read, true) => "analysis reservation cannot be cancelled as a native read",
            (Self::Analysis { .. }, _) => {
                "native read reservation cannot be cancelled as an analysis"
            }
        }
    }

    fn claimed_error(self) -> &'static str {
        match self {
            Self::Read => "native read reservation was already claimed",
            Self::Analysis { .. } => "analysis reservation was already claimed",
        }
    }
}

#[derive(Default)]
struct RegistryState {
    reads: HashMap<String, ReadEntry>,
    accepted: HashMap<String, AcceptedEntry>,
    sealed: bool,
}

struct AcceptedEntry {
    label: String,
    cancellation: CancellationToken,
    download: bool,
}

struct RegistryInner {
    state: Mutex<RegistryState>,
    changed: Condvar,
}

/// Native authority for transient renderer requests and application-owned accepted operations.
/// Reservations are bounded and expire lazily; active leases are never evicted or reused.
#[derive(Clone)]
pub struct OperationRegistry {
    inner: Arc<RegistryInner>,
    reservation_ttl: Duration,
}

impl Default for OperationRegistry {
    fn default() -> Self {
        Self {
            inner: Arc::new(RegistryInner {
                state: Mutex::new(RegistryState::default()),
                changed: Condvar::new(),
            }),
            reservation_ttl: READ_RESERVATION_TTL,
        }
    }
}

impl OperationRegistry {
    #[cfg(test)]
    pub(crate) fn with_reservation_ttl(reservation_ttl: Duration) -> Self {
        Self {
            reservation_ttl,
            ..Self::default()
        }
    }

    fn state(&self) -> Result<MutexGuard<'_, RegistryState>, Error> {
        self.inner
            .state
            .lock()
            .map_err(|_| Error::Conflict("native operation registry poisoned".into()))
    }

    fn purge_expired(state: &mut RegistryState, now: Instant, ttl: Duration) {
        state.reads.retain(|_, entry| {
            !matches!(entry.state, ReadState::Reserved { created_at } if now.saturating_duration_since(created_at) >= ttl)
        });
    }

    fn prepare_reservation(&self, owner: &str, kind: ReservationKind<'_>) -> Result<String, Error> {
        let mut state = self.state()?;
        Self::purge_expired(&mut state, Instant::now(), self.reservation_ttl);
        if state.sealed {
            return Err(Error::Conflict(
                "native operation admission is sealed".into(),
            ));
        }
        if state.reads.len() >= MAX_NATIVE_READS {
            return Err(Error::ResourceLimit(kind.capacity_error().into()));
        }
        let ticket = Uuid::new_v4().to_string();
        state.reads.insert(
            ticket.clone(),
            ReadEntry {
                owner: owner.to_owned(),
                tab: kind.tab().map(str::to_owned),
                state: ReadState::Reserved {
                    created_at: Instant::now(),
                },
            },
        );
        Ok(ticket)
    }

    fn claim_reservation(
        &self,
        ticket: &str,
        owner: &str,
        kind: ReservationKind<'_>,
        label: &str,
    ) -> Result<OperationLease, Error> {
        let mut state = self.state()?;
        Self::purge_expired(&mut state, Instant::now(), self.reservation_ttl);
        if state.sealed {
            return Err(Error::Conflict(
                "native operation admission is sealed".into(),
            ));
        }
        let entry = state
            .reads
            .get_mut(ticket)
            .ok_or_else(|| Error::Conflict(kind.unknown_error().into()))?;
        match kind {
            ReservationKind::Read if entry.owner != owner => {
                return Err(Error::Conflict(kind.owner_error().into()));
            }
            ReservationKind::Read if entry.tab.is_some() => {
                return Err(Error::Conflict(kind.wrong_kind_error(false).into()));
            }
            ReservationKind::Analysis { tab }
                if entry.owner != owner || entry.tab.as_deref() != Some(tab) =>
            {
                return Err(Error::Conflict(kind.owner_error().into()));
            }
            _ => {}
        }
        if !matches!(entry.state, ReadState::Reserved { .. }) {
            return Err(Error::Conflict(kind.claimed_error().into()));
        }
        let cancellation = CancellationToken::new();
        entry.state = ReadState::Active {
            cancellation: cancellation.clone(),
            label: label.to_owned(),
        };
        Ok(OperationLease {
            inner: Arc::new(LeaseHandle {
                registry: Arc::clone(&self.inner),
                id: ticket.to_owned(),
                cancellation,
                kind: kind.lease_kind(),
            }),
        })
    }

    fn cancel_reservation(
        &self,
        ticket: &str,
        owner: &str,
        requested_analysis: bool,
    ) -> Result<(), Error> {
        let mut state = self.state()?;
        Self::purge_expired(&mut state, Instant::now(), self.reservation_ttl);
        let Some(entry) = state.reads.get(ticket) else {
            return Ok(());
        };
        if entry.owner != owner {
            let message = if requested_analysis {
                "analysis reservation belongs to another webview"
            } else {
                "native read reservation belongs to another webview"
            };
            return Err(Error::Conflict(message.into()));
        }
        if entry.tab.is_some() != requested_analysis {
            let kind = if requested_analysis {
                ReservationKind::Analysis { tab: "" }
            } else {
                ReservationKind::Read
            };
            return Err(Error::Conflict(kind.wrong_kind_error(true).into()));
        }
        Self::cancel_entry(&mut state, ticket);
        Ok(())
    }

    fn cancel_entry(state: &mut RegistryState, ticket: &str) {
        if let Some(entry) = state.reads.get(ticket) {
            match &entry.state {
                ReadState::Reserved { .. } => {
                    state.reads.remove(ticket);
                }
                ReadState::Active { cancellation, .. } => cancellation.cancel(),
            }
        }
    }

    pub fn prepare_read(&self, owner: &str) -> Result<String, Error> {
        self.prepare_reservation(owner, ReservationKind::Read)
    }

    pub fn claim_read(
        &self,
        ticket: &str,
        owner: &str,
        label: &str,
    ) -> Result<OperationLease, Error> {
        self.claim_reservation(ticket, owner, ReservationKind::Read, label)
    }

    pub fn accept(&self, label: &str) -> Result<OperationLease, Error> {
        self.accept_with_id(&Uuid::new_v4().to_string(), label)
    }

    /// Admits an application-owned operation under an externally stable identity. This is used
    /// by downloads, whose public cancellation IDs predate the shared registry.
    pub fn accept_with_id(&self, id: &str, label: &str) -> Result<OperationLease, Error> {
        self.accept_bounded_with_id(id, label, false, MAX_ACCEPTED_OPERATIONS)
    }

    pub fn accept_download(
        &self,
        id: &str,
        label: &str,
        download_cap: usize,
    ) -> Result<OperationLease, Error> {
        self.accept_bounded_with_id(id, label, true, download_cap)
    }

    fn accept_bounded_with_id(
        &self,
        id: &str,
        label: &str,
        download: bool,
        class_cap: usize,
    ) -> Result<OperationLease, Error> {
        let mut state = self.state()?;
        if state.sealed {
            return Err(Error::Conflict(
                "native operation admission is sealed".into(),
            ));
        }
        if state.accepted.len() >= MAX_ACCEPTED_OPERATIONS {
            return Err(Error::ResourceLimit(
                "too many accepted native operations".into(),
            ));
        }
        if download
            && state
                .accepted
                .values()
                .filter(|entry| entry.download)
                .count()
                >= class_cap
        {
            return Err(Error::ResourceLimit("too many active downloads".into()));
        }
        if state.accepted.contains_key(id) {
            return Err(Error::Conflict("native operation is already active".into()));
        }
        let cancellation = CancellationToken::new();
        state.accepted.insert(
            id.to_owned(),
            AcceptedEntry {
                label: label.to_owned(),
                cancellation: cancellation.clone(),
                download,
            },
        );
        Ok(OperationLease {
            inner: Arc::new(LeaseHandle {
                registry: Arc::clone(&self.inner),
                id: id.to_owned(),
                cancellation,
                kind: LeaseKind::Accepted,
            }),
        })
    }

    pub fn cancel_accepted(&self, id: &str) -> Result<bool, Error> {
        let state = self.state()?;
        let Some(entry) = state.accepted.get(id) else {
            return Ok(false);
        };
        entry.cancellation.cancel();
        Ok(true)
    }

    pub fn prepare_analysis(&self, owner: &str, tab: &str) -> Result<String, Error> {
        self.prepare_reservation(owner, ReservationKind::Analysis { tab })
    }

    pub fn claim_analysis(
        &self,
        ticket: &str,
        owner: &str,
        tab: &str,
        label: &str,
    ) -> Result<OperationLease, Error> {
        self.claim_reservation(ticket, owner, ReservationKind::Analysis { tab }, label)
    }

    pub fn cancel_analysis(&self, ticket: &str, owner: &str) -> Result<(), Error> {
        self.cancel_reservation(ticket, owner, true)
    }

    pub fn cancel_analyses_for_tab(&self, owner: &str, tab: &str) -> Result<Vec<String>, Error> {
        let mut state = self.state()?;
        let tickets: Vec<_> = state
            .reads
            .iter()
            .filter(|(_, entry)| entry.owner == owner && entry.tab.as_deref() == Some(tab))
            .map(|(ticket, _)| ticket.clone())
            .collect();
        for ticket in &tickets {
            Self::cancel_entry(&mut state, ticket);
        }
        Ok(tickets)
    }

    pub fn cancel_read(&self, ticket: &str, owner: &str) -> Result<(), Error> {
        self.cancel_reservation(ticket, owner, false)
    }

    pub fn cancel_owner(&self, owner: &str) -> Result<Vec<String>, Error> {
        let mut state = self.state()?;
        let tickets: Vec<_> = state
            .reads
            .iter()
            .filter(|(_, entry)| entry.owner == owner)
            .map(|(ticket, _)| ticket.clone())
            .collect();
        for ticket in &tickets {
            Self::cancel_entry(&mut state, ticket);
        }
        Ok(tickets)
    }

    #[allow(dead_code)] // Phase 4 connects the accepted phase-2 primitive to shutdown.
    pub fn seal_and_cancel_reads(&self) -> Result<(), Error> {
        let mut state = self.state()?;
        state.sealed = true;
        state.reads.retain(|_, entry| match &entry.state {
            ReadState::Reserved { .. } => false,
            ReadState::Active { cancellation, .. } => {
                cancellation.cancel();
                true
            }
        });
        for entry in state.accepted.values() {
            entry.cancellation.cancel();
        }
        Ok(())
    }

    /// Waits until every claimed read and accepted operation has released its native lease.
    /// Prepared reads are not work and are removed by sealing before a shutdown drain begins.
    #[allow(dead_code)] // Phase 4 connects the accepted phase-2 drain primitive to shutdown.
    pub fn wait_for_drain(&self, timeout: Duration) -> Result<bool, Error> {
        let deadline = Instant::now() + timeout;
        let mut state = self.state()?;
        while state
            .reads
            .values()
            .any(|entry| matches!(entry.state, ReadState::Active { .. }))
            || !state.accepted.is_empty()
        {
            let remaining = deadline.saturating_duration_since(Instant::now());
            if remaining.is_zero() {
                return Ok(false);
            }
            let (next, wait) = self
                .inner
                .changed
                .wait_timeout(state, remaining)
                .map_err(|_| Error::Conflict("native operation registry poisoned".into()))?;
            state = next;
            if wait.timed_out() {
                return Ok(false);
            }
        }
        Ok(true)
    }

    #[allow(dead_code)] // Phase 4 consumes these labels in shutdown diagnostics.
    pub fn outstanding_labels(&self) -> Result<Vec<String>, Error> {
        let state = self.state()?;
        let mut labels: Vec<_> = state
            .reads
            .values()
            .filter_map(|entry| match &entry.state {
                ReadState::Active { label, .. } => Some(label.clone()),
                ReadState::Reserved { .. } => None,
            })
            .chain(state.accepted.values().map(|entry| entry.label.clone()))
            .collect();
        labels.sort();
        Ok(labels)
    }

    pub fn outstanding_diagnostics(&self) -> Result<Vec<String>, Error> {
        let state = self.state()?;
        let mut diagnostics: Vec<_> = state
            .reads
            .iter()
            .filter_map(|(id, entry)| match &entry.state {
                ReadState::Active { label, .. } => Some(format!(
                    "{id} [{}] {label}",
                    if entry.tab.is_some() {
                        "analysis-active"
                    } else {
                        "read-active"
                    }
                )),
                ReadState::Reserved { .. } => None,
            })
            .chain(state.accepted.iter().map(|(id, entry)| {
                format!(
                    "{id} [{}] {}",
                    if entry.download {
                        "download-accepted"
                    } else {
                        "accepted-active"
                    },
                    entry.label
                )
            }))
            .collect();
        diagnostics.sort();
        Ok(diagnostics)
    }

    #[cfg(test)]
    pub(crate) fn poison_for_test(&self) {
        let inner = Arc::clone(&self.inner);
        let _ = std::panic::catch_unwind(move || {
            let _guard = inner.state.lock().unwrap();
            panic!("poison operation registry");
        });
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum LeaseKind {
    Read,
    Accepted,
    Analysis,
}

#[derive(Clone)]
pub struct OperationLease {
    inner: Arc<LeaseHandle>,
}

struct LeaseHandle {
    registry: Arc<RegistryInner>,
    id: String,
    cancellation: CancellationToken,
    kind: LeaseKind,
}

impl OperationLease {
    pub fn token(&self) -> CancellationToken {
        self.inner.cancellation.clone()
    }

    #[allow(dead_code)] // Phase 4 uses accepted-operation identities for diagnostics.
    pub fn id(&self) -> &str {
        &self.inner.id
    }

    fn kind(&self) -> LeaseKind {
        self.inner.kind
    }
}

/// Runs a complete operation workflow under native ownership. The command future only receives
/// the terminal value; dropping it cannot drop the workflow, its worker await, or an async tail.
/// Dropping a transient read's command future cancels that exact request, while accepted work
/// remains completion-owned. Terminal failures are observed before result delivery and lease
/// release, so a dropped or buffered receiver cannot detach an unobserved error.
pub async fn run_native_operation<T, F>(
    lease: OperationLease,
    label: &'static str,
    workflow: F,
) -> Result<T, Error>
where
    T: Send + 'static,
    F: Future<Output = Result<T, Error>> + Send + 'static,
{
    let (result_tx, result_rx) = tokio::sync::oneshot::channel();
    let awaiter_guard = (lease.kind() == LeaseKind::Read).then(|| lease.token().drop_guard());
    tokio::spawn(async move {
        let result = match std::panic::AssertUnwindSafe(workflow).catch_unwind().await {
            Ok(result) => result,
            Err(_) => Err(Error::Conflict(format!(
                "native operation panicked ({label})"
            ))),
        };
        if let Err(error) = &result {
            log::error!("native operation failed ({label}): {error}");
        }
        // The workflow, including all async cleanup, is complete before its lease is released.
        drop(lease);
        let _ = result_tx.send(result);
    });

    let result = result_rx
        .await
        .map_err(|_| Error::Conflict("native operation result channel closed".into()))?;
    if let Some(awaiter_guard) = awaiter_guard {
        let _ = awaiter_guard.disarm();
    }
    result
}

/// Completion-owns one admitted blocking workflow. Call this only at an outer command boundary;
/// the closure must not acquire the blocking gateway again.
pub async fn run_accepted_blocking<T, F>(
    registry: &OperationRegistry,
    label: &'static str,
    workflow: F,
) -> Result<T, Error>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, Error> + Send + 'static,
{
    let lease = registry.accept(label)?;
    run_native_operation(lease, label, async move {
        crate::infra::blocking::BLOCKING_GATEWAY
            .spawn(workflow)
            .await
    })
    .await
}

impl Drop for LeaseHandle {
    fn drop(&mut self) {
        let mut state = match self.registry.state.lock() {
            Ok(state) => state,
            Err(poisoned) => poisoned.into_inner(),
        };
        match self.kind {
            LeaseKind::Read => {
                state.reads.remove(&self.id);
            }
            LeaseKind::Accepted => {
                state.accepted.remove(&self.id);
            }
            LeaseKind::Analysis => {
                state.reads.remove(&self.id);
            }
        }
        self.registry.changed.notify_all();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reservations_are_owner_bound_single_use_and_late_cancel_is_safe() {
        let registry = OperationRegistry::default();
        let ticket = registry.prepare_read("first").unwrap();
        assert!(registry.claim_read(&ticket, "second", "read").is_err());
        let lease = registry.claim_read(&ticket, "first", "read").unwrap();
        assert!(registry.claim_read(&ticket, "first", "read").is_err());
        drop(lease);
        registry.cancel_read(&ticket, "first").unwrap();
    }

    #[test]
    fn cancelling_an_active_read_reaches_its_token() {
        let registry = OperationRegistry::default();
        let ticket = registry.prepare_read("main").unwrap();
        let lease = registry.claim_read(&ticket, "main", "query").unwrap();
        registry.cancel_read(&ticket, "main").unwrap();
        assert!(lease.token().is_cancelled());
    }

    #[test]
    fn analysis_reservations_bind_owner_and_tab_and_cancel_before_claim() {
        let registry = OperationRegistry::default();
        let wrong_owner = registry.prepare_analysis("first", "tab-a").unwrap();
        assert!(registry
            .claim_analysis(&wrong_owner, "second", "tab-a", "analysis")
            .is_err());
        assert!(registry
            .claim_analysis(&wrong_owner, "first", "tab-b", "analysis")
            .is_err());

        registry.cancel_analysis(&wrong_owner, "first").unwrap();
        assert!(registry
            .claim_analysis(&wrong_owner, "first", "tab-a", "analysis")
            .is_err());

        let active_id = registry.prepare_analysis("first", "tab-a").unwrap();
        let active = registry
            .claim_analysis(&active_id, "first", "tab-a", "analysis")
            .unwrap();
        assert!(registry
            .outstanding_diagnostics()
            .unwrap()
            .contains(&format!("{active_id} [analysis-active] analysis")));
        assert!(registry
            .claim_analysis(&active_id, "first", "tab-a", "analysis")
            .is_err());
        let other_id = registry.prepare_analysis("first", "tab-b").unwrap();
        let other = registry
            .claim_analysis(&other_id, "first", "tab-b", "analysis")
            .unwrap();
        let other_owner_id = registry.prepare_analysis("second", "tab-a").unwrap();
        let other_owner = registry
            .claim_analysis(&other_owner_id, "second", "tab-a", "analysis")
            .unwrap();

        assert_eq!(
            registry.cancel_analyses_for_tab("first", "tab-a").unwrap(),
            vec![active_id]
        );
        assert!(active.token().is_cancelled());
        assert!(!other.token().is_cancelled());
        assert!(!other_owner.token().is_cancelled());
    }

    #[test]
    fn downloads_share_accepted_capacity_and_keep_their_narrower_cap() {
        let registry = OperationRegistry::default();
        let downloads: Vec<_> = (0..32)
            .map(|index| {
                registry
                    .accept_download(&format!("download-{index}"), "download", 32)
                    .unwrap()
            })
            .collect();
        assert!(matches!(
            registry.accept_download("download-excess", "download", 32),
            Err(Error::ResourceLimit(_))
        ));
        let accepted: Vec<_> = (downloads.len()..MAX_ACCEPTED_OPERATIONS)
            .map(|_| registry.accept("accepted").unwrap())
            .collect();
        assert!(matches!(
            registry.accept("excess"),
            Err(Error::ResourceLimit(_))
        ));

        assert!(registry.cancel_accepted("download-0").unwrap());
        assert!(downloads[0].token().is_cancelled());
        assert!(registry
            .outstanding_diagnostics()
            .unwrap()
            .contains(&"download-0 [download-accepted] download".to_owned()));
        assert!(!downloads[1].token().is_cancelled());
        drop(downloads);
        drop(accepted);
        assert!(registry
            .accept_download("download-recovered", "download", 32)
            .is_ok());
    }

    #[test]
    fn owner_destruction_does_not_cancel_another_owner_or_accepted_work() {
        let registry = OperationRegistry::default();
        let first = registry.prepare_read("first").unwrap();
        let second = registry.prepare_read("second").unwrap();
        let first_lease = registry.claim_read(&first, "first", "first read").unwrap();
        let second_lease = registry
            .claim_read(&second, "second", "second read")
            .unwrap();
        let accepted = registry.accept("accepted").unwrap();
        assert_eq!(registry.cancel_owner("first").unwrap(), vec![first]);
        assert!(first_lease.token().is_cancelled());
        assert!(!second_lease.token().is_cancelled());
        assert!(!accepted.token().is_cancelled());
    }

    #[test]
    fn capacity_returns_when_leases_drop() {
        let registry = OperationRegistry::default();
        let leases: Vec<_> = (0..MAX_ACCEPTED_OPERATIONS)
            .map(|_| registry.accept("held").unwrap())
            .collect();
        assert!(matches!(
            registry.accept("excess"),
            Err(Error::ResourceLimit(_))
        ));
        drop(leases);
        assert!(registry.accept("recovered").is_ok());
    }

    #[test]
    fn expired_reservations_release_read_capacity() {
        let registry = OperationRegistry::with_reservation_ttl(Duration::ZERO);
        for _ in 0..MAX_NATIVE_READS + 1 {
            registry.prepare_read("main").unwrap();
        }
        let ticket = registry.prepare_read("main").unwrap();
        assert!(registry.claim_read(&ticket, "main", "expired").is_err());
    }

    #[test]
    fn sealing_rejects_new_work_and_cancels_active_reads() {
        let registry = OperationRegistry::default();
        let ticket = registry.prepare_read("main").unwrap();
        let lease = registry.claim_read(&ticket, "main", "held").unwrap();
        registry.seal_and_cancel_reads().unwrap();
        assert!(lease.token().is_cancelled());
        assert!(registry.prepare_read("main").is_err());
        assert!(registry.accept("accepted").is_err());
    }

    #[test]
    fn lease_drop_recovers_poison_and_restores_capacity() {
        let registry = OperationRegistry::default();
        let lease = registry.accept("held").unwrap();
        let inner = Arc::clone(&registry.inner);
        let panicked = std::panic::catch_unwind(move || {
            let _guard = inner.state.lock().unwrap();
            panic!("poison registry");
        });
        assert!(panicked.is_err());
        drop(lease);
        assert!(matches!(
            registry.accept("after cleanup"),
            Err(Error::Conflict(_))
        ));
        match registry.inner.state.lock() {
            Err(poisoned) => assert!(poisoned.into_inner().accepted.is_empty()),
            Ok(_) => panic!("registry poison must remain visible"),
        };
    }

    #[test]
    fn active_and_prepared_reads_share_the_capacity_bound() {
        let registry = OperationRegistry::default();
        let active_ticket = registry.prepare_read("main").unwrap();
        let active = registry
            .claim_read(&active_ticket, "main", "active")
            .unwrap();
        let prepared: Vec<_> = (1..MAX_NATIVE_READS)
            .map(|_| registry.prepare_read("main").unwrap())
            .collect();
        assert!(matches!(
            registry.prepare_read("main"),
            Err(Error::ResourceLimit(_))
        ));
        drop(active);
        assert!(registry.prepare_read("main").is_ok());
        assert_eq!(prepared.len(), MAX_NATIVE_READS - 1);
    }

    #[test]
    fn drain_waits_for_claimed_and_accepted_leases() {
        let registry = OperationRegistry::default();
        let ticket = registry.prepare_read("main").unwrap();
        let read = registry.claim_read(&ticket, "main", "read").unwrap();
        let accepted = registry.accept("accepted").unwrap();
        registry.seal_and_cancel_reads().unwrap();
        assert!(!registry.wait_for_drain(Duration::from_millis(1)).unwrap());
        drop(read);
        assert!(!registry.wait_for_drain(Duration::from_millis(1)).unwrap());
        drop(accepted);
        assert!(registry.wait_for_drain(Duration::from_millis(20)).unwrap());
    }

    #[tokio::test]
    async fn accepted_workflow_survives_awaiting_caller_drop_and_async_tail() {
        let registry = OperationRegistry::default();
        let lease = registry.accept("held workflow").unwrap();
        let token = lease.token();
        let (release_tx, release_rx) = tokio::sync::oneshot::channel();
        let task = tokio::spawn(run_native_operation(lease, "held workflow", async move {
            let _ = release_rx.await;
            Ok::<_, Error>(())
        }));
        tokio::task::yield_now().await;
        task.abort();
        assert!(!token.is_cancelled());
        assert_eq!(
            registry.outstanding_labels().unwrap(),
            vec!["held workflow"]
        );
        release_tx.send(()).unwrap();
        assert!(tokio::time::timeout(Duration::from_secs(1), async {
            while !registry.outstanding_labels().unwrap().is_empty() {
                tokio::task::yield_now().await;
            }
        })
        .await
        .is_ok());
    }

    #[tokio::test]
    async fn transient_caller_drop_cancels_worker_but_keeps_lease_through_async_tail() {
        let registry = OperationRegistry::default();
        let ticket = registry.prepare_read("main").unwrap();
        let lease = registry.claim_read(&ticket, "main", "held read").unwrap();
        let token = lease.token();
        let worker_token = token.clone();
        let (worker_exited_tx, worker_exited_rx) = tokio::sync::oneshot::channel();
        let (tail_release_tx, tail_release_rx) = tokio::sync::oneshot::channel();
        let task = tokio::spawn(run_native_operation(lease, "held read", async move {
            worker_token.cancelled().await;
            let _ = worker_exited_tx.send(());
            let _ = tail_release_rx.await;
            Err::<(), _>(Error::Cancellation)
        }));
        tokio::task::yield_now().await;
        task.abort();
        tokio::time::timeout(Duration::from_secs(1), worker_exited_rx)
            .await
            .unwrap()
            .unwrap();
        assert!(token.is_cancelled());
        assert_eq!(registry.outstanding_labels().unwrap(), vec!["held read"]);
        tail_release_tx.send(()).unwrap();
        assert!(tokio::time::timeout(Duration::from_secs(1), async {
            while !registry.outstanding_labels().unwrap().is_empty() {
                tokio::task::yield_now().await;
            }
        })
        .await
        .is_ok());
    }

    #[tokio::test]
    async fn dropping_receiver_before_delivery_does_not_detach_failure_or_lease() {
        let registry = OperationRegistry::default();
        let lease = registry.accept("failure before delivery").unwrap();
        let (release_tx, release_rx) = tokio::sync::oneshot::channel();
        let task = tokio::spawn(run_native_operation(
            lease,
            "failure before delivery",
            async move {
                let _ = release_rx.await;
                Err::<(), _>(Error::Conflict("expected failure".into()))
            },
        ));
        tokio::task::yield_now().await;
        task.abort();
        release_tx.send(()).unwrap();
        assert!(tokio::time::timeout(Duration::from_secs(1), async {
            while !registry.outstanding_labels().unwrap().is_empty() {
                tokio::task::yield_now().await;
            }
        })
        .await
        .is_ok());
    }

    #[tokio::test]
    async fn dropping_receiver_after_result_is_buffered_leaves_no_observer_or_lease() {
        let registry = OperationRegistry::default();
        let lease = registry.accept("buffered failure").unwrap();
        let (release_tx, release_rx) = tokio::sync::oneshot::channel();
        let mut operation = Box::pin(run_native_operation(
            lease,
            "buffered failure",
            async move {
                let _ = release_rx.await;
                Err::<(), _>(Error::Conflict("expected buffered failure".into()))
            },
        ));
        assert!(futures_util::poll!(&mut operation).is_pending());
        release_tx.send(()).unwrap();
        tokio::time::timeout(Duration::from_secs(1), async {
            while !registry.outstanding_labels().unwrap().is_empty() {
                tokio::task::yield_now().await;
            }
        })
        .await
        .unwrap();
        drop(operation);
        assert!(registry.wait_for_drain(Duration::ZERO).unwrap());
    }
}
