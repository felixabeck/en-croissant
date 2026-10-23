use super::operations::completions::{
    CompletionOutcome, EngineInstallIntent, EngineInstallRequest, InstalledEngineResult,
};
use super::operations::{run_native_operation, OperationRegistry, MAX_ACCEPTED_OPERATIONS};
use crate::error::Error;

#[tokio::test]
async fn reload_completion_command_returns_terminal_snapshot_after_event_consumer_acknowledges() {
    use super::operations::completions::CompletionChanged;
    use tauri::Listener as _;
    use tauri_specta::Event as _;

    let app = tauri::test::mock_app();
    tauri_specta::Builder::<tauri::test::MockRuntime>::new()
        .events(tauri_specta::collect_events!(
            crate::progress::ProgressEvent,
            CompletionChanged
        ))
        .mount_events(&app);
    let state = crate::AppState::default();
    let id = Uuid::new_v4().to_string();
    let ticket = state.operations.prepare_download("main").unwrap();
    let operations = state.operations.clone();
    let acknowledged_id = id.clone();
    let acknowledged = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
    let observed = acknowledged.clone();
    let listener = app.listen_any(CompletionChanged::NAME, move |_| {
        operations
            .acknowledge_engine_completion(&acknowledged_id, "main")
            .unwrap();
        observed.store(true, std::sync::atomic::Ordering::SeqCst);
    });
    // Missing authority deterministically produces a terminal failure without network or child IO.
    // Its event consumer removes that exact result synchronously, before emit_to returns.
    let response = crate::fs::install_engine_workflow_runtime(
        id.clone(),
        reload_completion_request(false),
        ticket,
        app.handle().clone(),
        "main".into(),
        state.clone(),
    )
    .await;
    app.unlisten(listener);
    assert!(acknowledged.load(std::sync::atomic::Ordering::SeqCst));
    assert!(state.operations.engine_completion(&id, "main").is_err());
    let terminal =
        response.expect("acknowledgement must not turn a terminal response into an IPC error");
    assert_eq!(terminal.id, id);
    assert!(matches!(terminal.outcome, CompletionOutcome::Failed(_)));
}

#[test]
fn reload_completion_retains_the_normal_renderer_safe_error_payload() {
    use crate::error::{RemoteHttpRejection, RootFailure};
    let snapshot = crate::engine::EngineTerminalSnapshot {
        kind: crate::engine::EngineFailureKind::ProtocolFailure,
        exit_status: None,
        reason: Some("command e2e4 rejected".into()),
        entries: vec![],
    };
    for error in [
        Error::Cancellation,
        Error::RemoteHttpRejection(RemoteHttpRejection {
            status: 401,
            authorization_sent: true,
        }),
        Error::Io(Box::new(std::io::Error::other("/private/password=secret")))
            .with_root_failure(RootFailure::Permission),
        Error::EngineFailure {
            snapshot: Some(Box::new(snapshot)),
            cause: Box::new(Error::Io(Box::new(std::io::Error::other(
                "/private/token=secret",
            )))),
            cleanup: None,
        },
    ] {
        let registry = OperationRegistry::default();
        let id = Uuid::new_v4().to_string();
        let ticket = registry.prepare_download("main").unwrap();
        let (_, lease) = registry
            .admit_engine_completion(&id, "main", &ticket, reload_completion_request(false), 32)
            .unwrap();
        let expected = serde_json::to_value(&error).unwrap();
        registry.finish_engine_completion(&id, &Err(error)).unwrap();
        drop(lease);
        let CompletionOutcome::Failed(payload) =
            registry.engine_completion(&id, "main").unwrap().outcome
        else {
            panic!("failure must be retained")
        };
        let actual = serde_json::to_value(payload).unwrap();
        assert_eq!(actual, expected);
        assert!(!actual.to_string().contains("private"));
        assert!(!actual.to_string().contains("secret"));
        if actual["category"] == "cancellation" {
            assert_eq!(actual["message"], "Cancellation");
        }
    }
}

#[tokio::test]
async fn reload_completion_acknowledgement_receiver_drop_joins_owned_release() {
    let dir = tempfile::tempdir().unwrap();
    let state = crate::AppState::default();
    state
        .pgn_path_authority
        .install(
            crate::infra::path_authority::PathAuthority::open(
                dir.path().join("authority.json"),
                vec![],
            )
            .unwrap(),
        )
        .unwrap();
    let id = Uuid::new_v4().to_string();
    let ticket = state.operations.prepare_download("main").unwrap();
    let (_, lease) = state
        .operations
        .admit_engine_completion(&id, "main", &ticket, reload_completion_request(false), 32)
        .unwrap();
    state
        .operations
        .finish_engine_completion(&id, &Err(Error::Cancellation))
        .unwrap();
    drop(lease);
    let (held_tx, held_rx) = tokio::sync::oneshot::channel();
    let (release_tx, release_rx) = std::sync::mpsc::channel();
    let authority = state.pgn_path_authority.clone();
    let holder = tokio::task::spawn_blocking(move || {
        authority
            .with_mut(|_| {
                let _ = held_tx.send(());
                let _ = release_rx.recv_timeout(Duration::from_secs(10));
            })
            .unwrap()
    });
    held_rx.await.unwrap();
    let app = tauri::test::mock_app();
    let mut original = Box::pin(crate::fs::acknowledge_engine_completion_runtime(
        id.clone(),
        app.handle().clone(),
        "main".into(),
        state.clone(),
    ));
    assert!(futures_util::poll!(&mut original).is_pending());
    drop(original);
    let mut replacement = Box::pin(crate::fs::acknowledge_engine_completion_runtime(
        id.clone(),
        app.handle().clone(),
        "main".into(),
        state.clone(),
    ));
    assert!(futures_util::poll!(&mut replacement).is_pending());
    assert_eq!(
        state.operations.engine_completions("main").unwrap().len(),
        1
    );
    release_tx.send(()).unwrap();
    holder.await.unwrap();
    tokio::time::timeout(Duration::from_secs(3), replacement)
        .await
        .unwrap()
        .unwrap();
    assert!(state
        .operations
        .engine_completions("main")
        .unwrap()
        .is_empty());
    assert!(state.operations.wait_for_drain(Duration::ZERO).unwrap());
    crate::fs::acknowledge_engine_completion_runtime(
        id,
        app.handle().clone(),
        "main".into(),
        state,
    )
    .await
    .unwrap();
}

#[tokio::test]
async fn reload_completion_retirement_command_receiver_drop_joins_original_attempt_and_preserves_new_a(
) {
    use crate::engine::{EngineActor, EngineKey};
    use crate::infra::path_authority::{EngineHandle, PathRef};
    use std::sync::atomic::Ordering;
    struct ReleaseGate(Box<dyn Fn()>);
    impl Drop for ReleaseGate {
        fn drop(&mut self) {
            (self.0)();
        }
    }
    for failed in [false, true] {
        let state = crate::AppState::default();
        let id = Uuid::new_v4().to_string();
        let request = reload_completion_request(true);
        let EngineInstallIntent::Upgrade {
            expected,
            engine_id,
        } = &request.intent
        else {
            unreachable!()
        };
        let a = expected.clone();
        let b = EngineHandle::new(PathRef {
            id: "installed-b".into(),
        });
        let ticket = state.operations.prepare_download("main").unwrap();
        let (_, lease) = state
            .operations
            .admit_engine_completion(&id, "main", &ticket, request.clone(), 32)
            .unwrap();
        state
            .operations
            .finish_engine_completion(
                &id,
                &Ok(InstalledEngineResult {
                    handle: b.clone(),
                    config: crate::chess::EngineConfig::default(),
                    filename: "engine".into(),
                }),
            )
            .unwrap();
        drop(lease);
        let original_key = EngineKey::new("original".into(), engine_id.clone()).unwrap();
        let (actor, gate, calls) =
            EngineActor::gated_pending_test_actor(failed.then_some("original cleanup failed"));
        let gate_cleanup = gate.clone();
        let _release_on_drop = ReleaseGate(Box::new(move || gate_cleanup.open()));
        state
            .engine_supervisor
            .replace_handle(original_key, actor, engine_id.clone(), a.id.clone())
            .await
            .unwrap();
        let mut original = Box::pin(crate::fs::retire_engine_completion_runtime(
            id.clone(),
            Some(b.clone()),
            "main".into(),
            state.clone(),
        ));
        assert!(futures_util::poll!(&mut original).is_pending());
        tokio::time::timeout(Duration::from_secs(3), async {
            while !gate.parked.load(Ordering::SeqCst) {
                tokio::task::yield_now().await;
            }
        })
        .await
        .unwrap();
        drop(original);
        let mut replacement = Box::pin(crate::fs::retire_engine_completion_runtime(
            id.clone(),
            Some(b.clone()),
            "main".into(),
            state.clone(),
        ));
        assert!(futures_util::poll!(&mut replacement).is_pending());
        gate.open();
        assert_eq!(
            tokio::time::timeout(Duration::from_secs(3), replacement)
                .await
                .unwrap()
                .is_err(),
            failed
        );
        assert_eq!(
            calls.load(Ordering::SeqCst),
            1,
            "reconnecting must join the original cleanup"
        );
        assert_eq!(
            state
                .operations
                .engine_completion(&id, "main")
                .unwrap()
                .retired,
            !failed
        );
        let reverse = state
            .engine_supervisor
            .capture_binary_retirement(engine_id.clone(), b.id.clone(), a.id.clone(), true)
            .await
            .unwrap();
        state
            .engine_supervisor
            .resume_binary_retirement(&reverse)
            .await
            .unwrap();
        let key = EngineKey::new("new-a".into(), engine_id.clone()).unwrap();
        let (actor, _) = EngineActor::recording_test_actor(&[]);
        let selected = state
            .engine_supervisor
            .replace_handle(key.clone(), actor.clone(), engine_id.clone(), a.id.clone())
            .await
            .unwrap();
        assert_eq!(
            crate::fs::retire_engine_completion_runtime(
                id.clone(),
                Some(a.clone()),
                "main".into(),
                state.clone()
            )
            .await
            .is_err(),
            failed
        );
        assert_eq!(
            state.engine_supervisor.get_exact(&key).unwrap().generation,
            selected.generation
        );
        assert!(actor.logs().await.is_ok());
        assert_eq!(calls.load(Ordering::SeqCst), 1);
        state
            .engine_supervisor
            .prepare_engine_search(
                EngineKey::new("further-search".into(), engine_id.clone()).unwrap(),
                engine_id.clone(),
                a.id,
            )
            .await
            .unwrap();
        state.engine_supervisor.terminate_all().await.unwrap();
    }
}
use std::time::Duration;
use uuid::Uuid;

fn reload_completion_request(upgrade: bool) -> EngineInstallRequest {
    use crate::infra::path_authority::{EngineHandle, EngineRootHandle, PathRef};
    EngineInstallRequest {
        intent: if upgrade {
            EngineInstallIntent::Upgrade {
                engine_id: "engine".into(),
                expected: EngineHandle::new(PathRef { id: "old".into() }),
            }
        } else {
            EngineInstallIntent::Add {
                engine_id: Uuid::new_v4().to_string(),
            }
        },
        root: EngineRootHandle::new(PathRef { id: "root".into() }),
        progress_id: Uuid::new_v4().to_string(),
        url: "https://example.com/engine.zip".into(),
        sha256: "a".repeat(64),
        signature: "signature".into(),
        relative_path: "engine".into(),
        name: "Engine".into(),
        version: "1".into(),
        elo: None,
        download_size: None,
    }
}

#[tokio::test]
async fn reload_completion_mailbox_survives_command_receiver_and_rejoins_exact_request() {
    let registry = OperationRegistry::default();
    let id = Uuid::new_v4().to_string();
    let ticket = registry.prepare_download("main").unwrap();
    let request = reload_completion_request(true);
    let (_, lease) = registry
        .admit_engine_completion(&id, "main", &ticket, request.clone(), 32)
        .unwrap();
    let (release, released) = tokio::sync::oneshot::channel();
    let retained = registry.clone();
    let completed_id = id.clone();
    let mut receiver = Box::pin(run_native_operation(
        lease.unwrap(),
        "completion-test",
        async move {
            released.await.unwrap();
            retained.finish_engine_completion(
                &completed_id,
                &Ok(InstalledEngineResult {
                    handle: crate::infra::path_authority::EngineHandle::new(
                        crate::infra::path_authority::PathRef {
                            id: "installed".into(),
                        },
                    ),
                    config: crate::chess::EngineConfig::default(),
                    filename: "engine".into(),
                }),
            )?;
            Ok(())
        },
    ));
    assert!(futures_util::poll!(&mut receiver).is_pending());
    drop(receiver);
    registry.cancel_owner_reservations("main").unwrap();
    assert!(matches!(
        registry.engine_completions("main").unwrap()[0].outcome,
        CompletionOutcome::Running
    ));
    release.send(()).unwrap();
    let drained = registry.clone();
    assert!(
        tokio::task::spawn_blocking(move || drained.wait_for_drain(Duration::from_secs(5)))
            .await
            .unwrap()
            .unwrap()
    );
    let snapshot = registry.engine_completion(&id, "main").unwrap();
    assert!(matches!(snapshot.outcome, CompletionOutcome::Succeeded(_)));
    let (joined, repeated) = registry
        .admit_engine_completion(&id, "main", "no-new-ticket", request.clone(), 32)
        .unwrap();
    assert!(repeated.is_none());
    assert!(matches!(joined.outcome, CompletionOutcome::Succeeded(_)));
    assert!(registry.engine_completions("other").unwrap().is_empty());
    assert!(registry.engine_completion(&id, "other").is_err());
    assert!(registry
        .admit_engine_completion(&id, "other", &ticket, request.clone(), 32)
        .is_err());
    let mut different = request.clone();
    different.version = "different".into();
    assert!(registry
        .admit_engine_completion(&id, "main", &ticket, different, 32)
        .is_err());
    let next_ticket = registry.prepare_download("main").unwrap();
    let mut next_request = request.clone();
    next_request.intent = EngineInstallIntent::Upgrade {
        engine_id: "engine".into(),
        expected: crate::infra::path_authority::EngineHandle::new(
            crate::infra::path_authority::PathRef {
                id: "installed".into(),
            },
        ),
    };
    next_request.version = "C".into();
    next_request.progress_id = Uuid::new_v4().to_string();
    assert!(
        registry
            .admit_engine_completion(
                &Uuid::new_v4().to_string(),
                "main",
                &next_ticket,
                next_request.clone(),
                32
            )
            .is_err(),
        "partial A to B must exclude B to C"
    );
    assert!(registry.acknowledge_engine_completion(&id, "main").is_err());
    registry.finish_engine_retirement(&id, "main").unwrap();
    registry.acknowledge_engine_completion(&id, "main").unwrap();
    assert!(registry.engine_completions("main").unwrap().is_empty());
    assert!(registry
        .admit_engine_completion(
            &Uuid::new_v4().to_string(),
            "main",
            &next_ticket,
            next_request,
            32
        )
        .is_ok());
}

#[test]
fn reload_completion_capacity_never_evicts_pending_application_and_tail_can_release_full_mailbox() {
    let registry = OperationRegistry::default();
    let mut ids = Vec::new();
    for _ in 0..MAX_ACCEPTED_OPERATIONS {
        let id = Uuid::new_v4().to_string();
        let ticket = registry.prepare_download("main").unwrap();
        let (_, lease) = registry
            .admit_engine_completion(&id, "main", &ticket, reload_completion_request(false), 32)
            .unwrap();
        registry
            .finish_engine_completion(&id, &Err(Error::Cancellation))
            .unwrap();
        drop(lease);
        ids.push(id);
    }
    let ticket = registry.prepare_download("main").unwrap();
    assert!(matches!(
        registry.admit_engine_completion(
            &Uuid::new_v4().to_string(),
            "main",
            &ticket,
            reload_completion_request(false),
            32
        ),
        Err(Error::ResourceLimit(_))
    ));
    assert_eq!(
        registry.engine_completions("main").unwrap().len(),
        MAX_ACCEPTED_OPERATIONS
    );
    let tail = registry.accept_completion_tail(&ids[0], "main").unwrap();
    assert!(registry
        .acknowledge_engine_completion(&ids[0], "other")
        .is_err());
    registry
        .acknowledge_engine_completion(&ids[0], "main")
        .unwrap();
    drop(tail);
    assert!(registry
        .admit_engine_completion(
            &Uuid::new_v4().to_string(),
            "main",
            &ticket,
            reload_completion_request(false),
            32
        )
        .is_ok());
}
