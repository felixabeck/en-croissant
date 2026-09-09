//! Native Chess.com archive export.
//!
//! Archive discovery, validation, parsing, staging and publication all stay native.  The
//! renderer supplies only an opaque download destination and receives an opaque PGN artifact.

use crate::{
    error::Error,
    infra::path_authority::{ArtifactPublication, PathRef},
    progress::{
        begin_progress, complete_preserving_result, update_progress_with_state, ProgressLease,
        ProgressState,
    },
    AppState,
};
use chrono::Datelike;
use futures_util::StreamExt;
use serde::Deserialize;
use serde::Serialize;
use specta::Type;
use std::{io::Write, time::Duration};
use tokio_util::sync::CancellationToken;

const API_ORIGIN: &str = "https://api.chess.com";
const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);
const EXPORT_TIMEOUT: Duration = Duration::from_secs(15 * 60);
const MAX_ARCHIVES: usize = 240;
const MAX_INDEX_BYTES: usize = 512 * 1024;
const MAX_ARCHIVE_BYTES: usize = 16 * 1024 * 1024;
const MAX_PGN_BYTES: usize = 100 * 1024 * 1024;
const MAX_PUBLIC_JSON_BYTES: usize = 1024 * 1024;

#[derive(Clone, Debug, Deserialize, Serialize, Type)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum PublicChessComRequest {
    Account { player: String },
    Game { game_type: String, game_id: String },
}

#[derive(Deserialize)]
struct ArchiveIndex {
    archives: Vec<String>,
}

#[derive(Deserialize)]
struct ArchiveGames {
    games: Vec<ArchiveGame>,
}

#[derive(Deserialize)]
struct ArchiveGame {
    pgn: Option<String>,
}

fn valid_player(player: &str) -> bool {
    !player.is_empty()
        && player.len() <= 50
        && player
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
}

fn archive_index_url(player: &str) -> Result<reqwest::Url, Error> {
    if !valid_player(player) {
        return Err(Error::InvalidInput("invalid Chess.com player name".into()));
    }
    let mut url = reqwest::Url::parse(API_ORIGIN)
        .map_err(|_| Error::InvalidInput("invalid Chess.com endpoint".into()))?;
    url.path_segments_mut()
        .map_err(|_| Error::InvalidInput("invalid Chess.com endpoint".into()))?
        .extend(["pub", "player", player, "games", "archives"]);
    Ok(url)
}

fn validate_archive_url(value: &str, player: &str) -> Result<(reqwest::Url, i32, u32), Error> {
    let url = reqwest::Url::parse(value)
        .map_err(|_| Error::InvalidInput("invalid Chess.com archive URL".into()))?;
    if url.scheme() != "https"
        || url.host_str() != Some("api.chess.com")
        || url.port_or_known_default() != Some(443)
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err(Error::InvalidInput(
            "untrusted Chess.com archive URL".into(),
        ));
    }
    let segments: Vec<_> = url
        .path_segments()
        .ok_or_else(|| Error::InvalidInput("invalid Chess.com archive URL".into()))?
        .collect();
    let ["pub", "player", archive_player, "games", year, month] = segments.as_slice() else {
        return Err(Error::InvalidInput(
            "untrusted Chess.com archive URL".into(),
        ));
    };
    if !archive_player.eq_ignore_ascii_case(player) {
        return Err(Error::InvalidInput(
            "Chess.com archive belongs to another player".into(),
        ));
    }
    let year = year
        .parse::<i32>()
        .map_err(|_| Error::InvalidInput("invalid Chess.com archive date".into()))?;
    let month = month
        .parse::<u32>()
        .map_err(|_| Error::InvalidInput("invalid Chess.com archive date".into()))?;
    if !(2007..=9999).contains(&year) || !(1..=12).contains(&month) {
        return Err(Error::InvalidInput("invalid Chess.com archive date".into()));
    }
    Ok((url, year, month))
}

async fn fetch_bounded(
    state: &AppState,
    url: reqwest::Url,
    max_bytes: usize,
    cancellation: &CancellationToken,
) -> Result<Vec<u8>, Error> {
    let response = tokio::select! {
        _ = cancellation.cancelled() => return Err(Error::Cancellation),
        response = tokio::time::timeout(REQUEST_TIMEOUT, state.http_transport.request(url.as_str(), reqwest::header::HeaderMap::new())) => {
            response.map_err(|_| Error::EngineTimeout("Chess.com request timed out".into()))??
        }
    };
    if !(200..300).contains(&response.status) {
        return Err(Error::InvalidInput("Chess.com request was rejected".into()));
    }
    if response
        .content_length
        .is_some_and(|length| length > max_bytes as u64)
    {
        return Err(Error::ResourceLimit(
            "Chess.com response is too large".into(),
        ));
    }
    let mut bytes = Vec::new();
    let mut stream = response.stream;
    while let Some(chunk) = tokio::select! {
        _ = cancellation.cancelled() => return Err(Error::Cancellation),
        chunk = stream.next() => chunk,
    } {
        let chunk = chunk?;
        if bytes.len().saturating_add(chunk.len()) > max_bytes {
            return Err(Error::ResourceLimit(
                "Chess.com response is too large".into(),
            ));
        }
        bytes.extend_from_slice(&chunk);
    }
    Ok(bytes)
}

fn first_archive_month(since_ms: Option<i64>) -> Result<Option<(i32, u32)>, Error> {
    let Some(since_ms) = since_ms else {
        return Ok(None);
    };
    if since_ms < 0 {
        return Err(Error::InvalidInput(
            "invalid Chess.com export timestamp".into(),
        ));
    }
    let date = chrono::DateTime::from_timestamp_millis(since_ms)
        .ok_or_else(|| Error::InvalidInput("invalid Chess.com export timestamp".into()))?;
    Ok(Some((date.year(), date.month())))
}

#[tauri::command]
#[specta::specta]
pub async fn get_public_chess_com_json(
    request: PublicChessComRequest,
    state: tauri::State<'_, AppState>,
) -> Result<String, Error> {
    let url = match request {
        PublicChessComRequest::Account { player } => {
            if !valid_player(&player) {
                return Err(Error::InvalidInput("invalid Chess.com player name".into()));
            }
            let mut url = reqwest::Url::parse(API_ORIGIN)
                .map_err(|_| Error::InvalidInput("invalid Chess.com endpoint".into()))?;
            url.path_segments_mut()
                .map_err(|_| Error::InvalidInput("invalid Chess.com endpoint".into()))?
                .extend(["pub", "player", &player, "stats"]);
            url
        }
        PublicChessComRequest::Game { game_type, game_id } => {
            if !matches!(game_type.as_str(), "live" | "daily")
                || game_id.is_empty()
                || game_id.len() > 32
                || !game_id.bytes().all(|byte| byte.is_ascii_digit())
            {
                return Err(Error::InvalidInput("invalid Chess.com game".into()));
            }
            let mut url = reqwest::Url::parse("https://www.chess.com")
                .map_err(|_| Error::InvalidInput("invalid Chess.com endpoint".into()))?;
            url.path_segments_mut()
                .map_err(|_| Error::InvalidInput("invalid Chess.com endpoint".into()))?
                .extend(["callback", &game_type, "game", &game_id]);
            url
        }
    };
    let bytes = fetch_bounded(
        state.inner(),
        url,
        MAX_PUBLIC_JSON_BYTES,
        &CancellationToken::new(),
    )
    .await?;
    serde_json::from_slice::<serde_json::Value>(&bytes)
        .map_err(|_| Error::InvalidInput("Chess.com returned invalid JSON".into()))?;
    String::from_utf8(bytes)
        .map_err(|_| Error::InvalidInput("Chess.com returned invalid UTF-8".into()))
}

#[tauri::command]
#[specta::specta]
pub async fn download_chess_com_games(
    destination: PathRef,
    filename: String,
    player: String,
    since_ms: Option<i64>,
    job_id: String,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<ArtifactPublication, Error> {
    uuid::Uuid::parse_str(&job_id)
        .map_err(|_| Error::InvalidInput("download job ID must be a UUID".into()))?;
    let lower_player = player.to_ascii_lowercase();
    let first_month = first_archive_month(since_ms)?;
    let lease = state.download_registry.begin(&state.operations, &job_id)?;
    let cancellation = lease.cancellation_token();
    let operation = lease.into_operation();
    let state = state.inner().clone();
    crate::infra::operations::run_native_operation(
        operation,
        "download_chess_com_games",
        download_chess_com_games_core(
            destination,
            filename,
            player,
            lower_player,
            first_month,
            app,
            state,
            cancellation,
            EXPORT_TIMEOUT,
        ),
    )
    .await
}

fn report_terminal_progress<R: tauri::Runtime>(
    state: &AppState,
    app: &tauri::AppHandle<R>,
    progress: &ProgressLease,
    terminal: ProgressState,
) {
    let value = if matches!(terminal, ProgressState::Succeeded) {
        100.0
    } else {
        0.0
    };
    if let Err(error) =
        update_progress_with_state(&state.progress_state, app, progress, value, terminal)
    {
        log::warn!(
            "Chess.com export terminal progress generation {} failed: {}",
            progress.generation,
            error.category()
        );
    }
}

// This core mirrors the accepted command boundary: destination authority, request identity,
// progress owner, cancellation owner and deadline are intentionally explicit and independently
// validated before publication.
#[allow(clippy::too_many_arguments)]
async fn download_chess_com_games_core<R: tauri::Runtime>(
    destination: PathRef,
    filename: String,
    player: String,
    lower_player: String,
    first_month: Option<(i32, u32)>,
    app: tauri::AppHandle<R>,
    state: AppState,
    cancellation: CancellationToken,
    export_timeout: Duration,
) -> Result<ArtifactPublication, Error> {
    let progress = begin_progress(&state.progress_state, &app, format!("chesscom_{player}"))?;

    let result = async {
        let staged = match tokio::time::timeout(export_timeout, async {
            let index_bytes = fetch_bounded(
                &state,
                archive_index_url(&lower_player)?,
                MAX_INDEX_BYTES,
                &cancellation,
            )
            .await?;
            let index: ArchiveIndex = serde_json::from_slice(&index_bytes).map_err(|_| {
                Error::InvalidInput("Chess.com returned an invalid archive index".into())
            })?;
            if index.archives.len() > MAX_ARCHIVES {
                return Err(Error::ResourceLimit("too many Chess.com archives".into()));
            }
            let mut archives = index
                .archives
                .iter()
                .map(|archive| validate_archive_url(archive, &lower_player))
                .collect::<Result<Vec<_>, _>>()?;
            archives.sort_by_key(|(_, year, month)| (*year, *month));
            archives.dedup_by_key(|(_, year, month)| (*year, *month));
            if let Some(first_month) = first_month {
                archives.retain(|(_, year, month)| (*year, *month) >= first_month);
            }
            if archives.is_empty() {
                return Err(Error::InvalidInput(
                    "Chess.com returned no requested archives".into(),
                ));
            }

            let mut staged =
                tempfile::NamedTempFile::new().map_err(|error| Error::Io(Box::new(error)))?;
            let mut total_pgn_bytes = 0usize;
            let total = archives.len().max(1);
            for (index, (archive, _, _)) in archives.into_iter().enumerate() {
                let bytes =
                    fetch_bounded(&state, archive, MAX_ARCHIVE_BYTES, &cancellation).await?;
                let games: ArchiveGames = serde_json::from_slice(&bytes).map_err(|_| {
                    Error::InvalidInput("Chess.com returned an invalid game archive".into())
                })?;
                if games.games.is_empty() {
                    return Err(Error::InvalidInput(
                        "Chess.com returned an empty requested game archive".into(),
                    ));
                }
                for game in games.games {
                    let pgn = game
                        .pgn
                        .filter(|pgn| !pgn.trim().is_empty())
                        .ok_or_else(|| {
                            Error::InvalidInput("Chess.com returned a game without PGN".into())
                        })?;
                    total_pgn_bytes = total_pgn_bytes.saturating_add(pgn.len()).saturating_add(1);
                    if total_pgn_bytes > MAX_PGN_BYTES {
                        return Err(Error::ResourceLimit(
                            "Chess.com PGN export is too large".into(),
                        ));
                    }
                    staged.write_all(pgn.as_bytes())?;
                    staged.write_all(b"\n")?;
                }
                update_progress_with_state(
                    &state.progress_state,
                    &app,
                    &progress,
                    ((index + 1) as f32 / total as f32) * 90.0,
                    ProgressState::Running,
                )?;
            }
            staged.flush()?;
            Ok::<_, Error>(staged)
        })
        .await
        {
            Ok(result) => result?,
            Err(_) => {
                return Err(Error::EngineTimeout(
                    "Chess.com export deadline exceeded".into(),
                ));
            }
        };

        // Publication and its durability/activation tail are deliberately outside the staging
        // timeout. Once installation starts, cancellation checkpoints decide whether publication
        // is still safe; after rename, the real durability and activation outcome always wins.
        crate::fs::install_staged_pgn_artifact(destination, filename, staged, &state, &cancellation)
            .await
    }
    .await;

    complete_preserving_result(result, |terminal| {
        report_terminal_progress(&state, &app, &progress, terminal)
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infra::net::{DownloadResponse, DownloadTransport};
    use async_trait::async_trait;
    use bytes::Bytes;
    use reqwest::header::HeaderMap;
    use std::{
        collections::VecDeque,
        path::PathBuf,
        sync::{
            atomic::{AtomicUsize, Ordering},
            Arc, Mutex,
        },
    };

    struct MockTransport {
        response: Mutex<Option<DownloadResponse>>,
        requests: Mutex<Vec<String>>,
    }

    #[async_trait]
    impl DownloadTransport for MockTransport {
        async fn request(&self, url: &str, _: HeaderMap) -> Result<DownloadResponse, Error> {
            self.requests.lock().unwrap().push(url.into());
            self.response
                .lock()
                .unwrap()
                .take()
                .ok_or_else(|| Error::InvalidInput("unexpected request".into()))
        }
    }

    fn response(body: &'static [u8]) -> DownloadResponse {
        DownloadResponse {
            status: 200,
            headers: HeaderMap::new(),
            content_length: Some(body.len() as u64),
            stream: Box::pin(futures_util::stream::iter(vec![Ok(Bytes::from_static(
                body,
            ))])),
        }
    }

    const INDEX: &[u8] =
        br#"{"archives":["https://api.chess.com/pub/player/felix/games/2026/09"]}"#;
    const ARCHIVE: &[u8] = br#"{"games":[{"pgn":"1. e4 e5"}]}"#;

    struct ExportTransport {
        responses: Mutex<VecDeque<DownloadResponse>>,
    }

    #[async_trait]
    impl DownloadTransport for ExportTransport {
        async fn request(&self, _: &str, _: HeaderMap) -> Result<DownloadResponse, Error> {
            self.responses
                .lock()
                .unwrap()
                .pop_front()
                .ok_or_else(|| Error::InvalidInput("unexpected request".into()))
        }
    }

    struct HeldArchiveTransport {
        requests: AtomicUsize,
        entered: Mutex<Option<tokio::sync::oneshot::Sender<()>>>,
        release: tokio::sync::Notify,
    }

    #[async_trait]
    impl DownloadTransport for HeldArchiveTransport {
        async fn request(&self, _: &str, _: HeaderMap) -> Result<DownloadResponse, Error> {
            if self.requests.fetch_add(1, Ordering::SeqCst) == 0 {
                return Ok(response(INDEX));
            }
            if let Some(entered) = self.entered.lock().unwrap().take() {
                let _ = entered.send(());
            }
            self.release.notified().await;
            Ok(response(ARCHIVE))
        }
    }

    struct ResetAtomicInjector;

    impl Drop for ResetAtomicInjector {
        fn drop(&mut self) {
            crate::infra::fs::set_test_atomic_file_injector(None);
        }
    }

    struct HoldAtomicPoint {
        point: crate::infra::fs::AtomicFileFaultPoint,
        occurrence: usize,
        seen: AtomicUsize,
        entered: Mutex<Option<tokio::sync::oneshot::Sender<()>>>,
        release: Mutex<std::sync::mpsc::Receiver<()>>,
        fail_after_release: bool,
    }

    impl crate::infra::fs::AtomicWriterInjector for HoldAtomicPoint {
        fn inject(&self, point: crate::infra::fs::AtomicFileFaultPoint) -> std::io::Result<()> {
            if point == self.point && self.seen.fetch_add(1, Ordering::SeqCst) == self.occurrence {
                if let Some(entered) = self.entered.lock().unwrap().take() {
                    let _ = entered.send(());
                }
                self.release
                    .lock()
                    .unwrap()
                    .recv_timeout(Duration::from_secs(5))
                    .map_err(|_| std::io::Error::other("test publication release timed out"))?;
                if self.fail_after_release {
                    return Err(std::io::Error::other("injected publication failure"));
                }
            }
            Ok(())
        }
    }

    fn export_transport() -> Arc<dyn DownloadTransport> {
        Arc::new(ExportTransport {
            responses: Mutex::new(VecDeque::from([response(INDEX), response(ARCHIVE)])),
        })
    }

    fn hold_atomic_point(
        point: crate::infra::fs::AtomicFileFaultPoint,
        occurrence: usize,
        fail_after_release: bool,
    ) -> (
        tokio::sync::oneshot::Receiver<()>,
        std::sync::mpsc::SyncSender<()>,
    ) {
        let (entered_tx, entered_rx) = tokio::sync::oneshot::channel();
        let (release_tx, release_rx) = std::sync::mpsc::sync_channel(1);
        crate::infra::fs::set_test_atomic_file_injector(Some(Arc::new(HoldAtomicPoint {
            point,
            occurrence,
            seen: AtomicUsize::new(0),
            entered: Mutex::new(Some(entered_tx)),
            release: Mutex::new(release_rx),
            fail_after_release,
        })));
        (entered_rx, release_tx)
    }

    fn export_fixture(
        transport: Arc<dyn DownloadTransport>,
    ) -> (
        tempfile::TempDir,
        AppState,
        PathRef,
        PathBuf,
        tauri::App<tauri::test::MockRuntime>,
    ) {
        let dir = tempfile::tempdir().unwrap();
        let download_root = dir.path().join("downloads");
        std::fs::create_dir(&download_root).unwrap();
        let app_root = crate::infra::path_authority::AppOwnedRoot::new(
            "downloads",
            download_root.clone(),
            vec![crate::infra::path_authority::PathOperation::DownloadFile],
        );
        let destination = app_root.id.clone();
        let authority = crate::infra::path_authority::PathAuthority::open(
            dir.path().join("path-authority.json"),
            vec![app_root],
        )
        .unwrap();
        let state = AppState {
            http_transport: transport,
            ..Default::default()
        };
        *state.pgn_path_authority.lock().unwrap() = Some(authority);
        let app = tauri::test::mock_app();
        tauri_specta::Builder::<tauri::test::MockRuntime>::new()
            .events(tauri_specta::collect_events!(
                crate::progress::ProgressEvent
            ))
            .mount_events(&app);
        (dir, state, destination, download_root, app)
    }

    async fn run_owned_export(
        destination: PathRef,
        filename: String,
        job_id: String,
        app: tauri::AppHandle<tauri::test::MockRuntime>,
        state: AppState,
        timeout: Duration,
    ) -> Result<ArtifactPublication, Error> {
        let lease = state.download_registry.begin(&state.operations, &job_id)?;
        let cancellation = lease.cancellation_token();
        crate::infra::operations::run_native_operation(
            lease.into_operation(),
            "download_chess_com_games",
            download_chess_com_games_core(
                destination,
                filename,
                "felix".into(),
                "felix".into(),
                None,
                app,
                state,
                cancellation,
                timeout,
            ),
        )
        .await
    }

    async fn wait_for_progress(state: &AppState, expected: ProgressState) {
        tokio::time::timeout(Duration::from_secs(5), async {
            loop {
                if state
                    .progress_state
                    .get("chesscom_felix")
                    .unwrap()
                    .is_some_and(|item| item.state == expected)
                {
                    return;
                }
                tokio::task::yield_now().await;
            }
        })
        .await
        .unwrap();
    }

    async fn wait_for_operation_drain(state: &AppState) {
        tokio::time::timeout(Duration::from_secs(5), async {
            loop {
                if state.operations.outstanding_labels().unwrap().is_empty() {
                    return;
                }
                tokio::task::yield_now().await;
            }
        })
        .await
        .unwrap();
    }

    #[test]
    fn archive_urls_are_exactly_constrained_to_the_requested_player_and_month() {
        let (url, year, month) = validate_archive_url(
            "https://api.chess.com/pub/player/Felix_Chess/games/2025/09",
            "felix_chess",
        )
        .unwrap();
        assert_eq!(url.host_str(), Some("api.chess.com"));
        assert_eq!((year, month), (2025, 9));
        for invalid in [
            "https://evil.example/pub/player/felix_chess/games/2025/09",
            "https://api.chess.com/pub/player/other/games/2025/09",
            "https://api.chess.com/pub/player/felix_chess/games/2025/09?token=x",
            "http://api.chess.com/pub/player/felix_chess/games/2025/09",
        ] {
            assert!(validate_archive_url(invalid, "felix_chess").is_err());
        }
    }

    #[test]
    fn export_timestamp_selects_the_first_inclusive_month() {
        assert_eq!(
            first_archive_month(Some(1_725_148_800_000)).unwrap(),
            Some((2024, 9))
        );
        assert!(first_archive_month(Some(-1)).is_err());
    }

    #[tokio::test]
    async fn native_transport_is_bounded_and_never_accepts_a_renderer_origin() {
        let transport = Arc::new(MockTransport {
            response: Mutex::new(Some(response(br#"{"archives":[]}"#))),
            requests: Mutex::new(Vec::new()),
        });
        let state = AppState {
            http_transport: transport.clone(),
            ..Default::default()
        };
        let cancellation = CancellationToken::new();
        let url = archive_index_url("felix_chess").unwrap();
        let body = fetch_bounded(&state, url, MAX_INDEX_BYTES, &cancellation)
            .await
            .unwrap();
        assert_eq!(body, br#"{"archives":[]}"#);
        assert_eq!(
            transport.requests.lock().unwrap().as_slice(),
            ["https://api.chess.com/pub/player/felix_chess/games/archives"]
        );
    }

    #[test]
    fn production_command_dispatches_the_runtime_core_under_native_ownership() {
        let source = include_str!("chesscom.rs");
        let command = source
            .split("pub async fn download_chess_com_games(")
            .nth(1)
            .unwrap()
            .split("fn report_terminal_progress")
            .next()
            .unwrap();
        assert_eq!(command.matches("run_native_operation(").count(), 1);
        assert_eq!(command.matches("download_chess_com_games_core(").count(), 1);
        assert!(command.contains("EXPORT_TIMEOUT"));
    }

    #[tokio::test]
    async fn dropped_callers_retain_success_and_publication_error_terminal_tails() {
        let _reset = ResetAtomicInjector;

        let (_dir, state, destination, root, app) = export_fixture(export_transport());
        let (entered, release) = hold_atomic_point(
            crate::infra::fs::AtomicFileFaultPoint::PreCommitRevalidate,
            1,
            false,
        );
        let job_id = uuid::Uuid::new_v4().to_string();
        let task = tokio::spawn(run_owned_export(
            destination,
            "success.pgn".into(),
            job_id,
            app.handle().clone(),
            state.clone(),
            Duration::from_secs(2),
        ));
        tokio::time::timeout(Duration::from_secs(2), entered)
            .await
            .unwrap()
            .unwrap();
        task.abort();
        let _ = task.await;
        release.send(()).unwrap();
        wait_for_progress(&state, ProgressState::Succeeded).await;
        wait_for_operation_drain(&state).await;
        assert_eq!(
            std::fs::read(root.join("success.pgn")).unwrap(),
            b"1. e4 e5\n"
        );

        crate::infra::fs::set_test_atomic_file_injector(None);
        let (_dir, state, destination, root, app) = export_fixture(export_transport());
        std::fs::write(root.join("failure.pgn"), b"previous").unwrap();
        let (entered, release) = hold_atomic_point(
            crate::infra::fs::AtomicFileFaultPoint::PreCommitRevalidate,
            1,
            true,
        );
        let job_id = uuid::Uuid::new_v4().to_string();
        let task = tokio::spawn(run_owned_export(
            destination,
            "failure.pgn".into(),
            job_id,
            app.handle().clone(),
            state.clone(),
            Duration::from_secs(2),
        ));
        tokio::time::timeout(Duration::from_secs(2), entered)
            .await
            .unwrap()
            .unwrap();
        task.abort();
        let _ = task.await;
        release.send(()).unwrap();
        wait_for_progress(&state, ProgressState::Failed).await;
        wait_for_operation_drain(&state).await;
        assert_eq!(
            std::fs::read(root.join("failure.pgn")).unwrap(),
            b"previous"
        );
    }

    #[tokio::test]
    async fn prepublication_error_and_cancellation_are_terminal_without_replacement() {
        let bad_transport: Arc<dyn DownloadTransport> = Arc::new(ExportTransport {
            responses: Mutex::new(VecDeque::from([response(br#"{"archives":[]}"#)])),
        });
        let (_dir, state, destination, root, app) = export_fixture(bad_transport);
        std::fs::write(root.join("error.pgn"), b"previous").unwrap();
        let error = run_owned_export(
            destination,
            "error.pgn".into(),
            uuid::Uuid::new_v4().to_string(),
            app.handle().clone(),
            state.clone(),
            Duration::from_secs(2),
        )
        .await
        .unwrap_err();
        assert!(matches!(error, Error::InvalidInput(_)));
        assert_eq!(
            state
                .progress_state
                .get("chesscom_felix")
                .unwrap()
                .unwrap()
                .state,
            ProgressState::Failed
        );
        assert_eq!(std::fs::read(root.join("error.pgn")).unwrap(), b"previous");

        let (entered_tx, entered) = tokio::sync::oneshot::channel();
        let held = Arc::new(HeldArchiveTransport {
            requests: AtomicUsize::new(0),
            entered: Mutex::new(Some(entered_tx)),
            release: tokio::sync::Notify::new(),
        });
        let (_dir, state, destination, root, app) = export_fixture(held.clone());
        std::fs::write(root.join("cancel.pgn"), b"previous").unwrap();
        let job_id = uuid::Uuid::new_v4().to_string();
        let task = tokio::spawn(run_owned_export(
            destination,
            "cancel.pgn".into(),
            job_id.clone(),
            app.handle().clone(),
            state.clone(),
            Duration::from_secs(2),
        ));
        tokio::time::timeout(Duration::from_secs(2), entered)
            .await
            .unwrap()
            .unwrap();
        assert!(state
            .download_registry
            .cancel(&state.operations, &job_id)
            .unwrap());
        held.release.notify_waiters();
        assert!(matches!(task.await.unwrap(), Err(Error::Cancellation)));
        assert_eq!(
            state
                .progress_state
                .get("chesscom_felix")
                .unwrap()
                .unwrap()
                .state,
            ProgressState::Cancelled
        );
        assert_eq!(std::fs::read(root.join("cancel.pgn")).unwrap(), b"previous");
    }

    #[tokio::test]
    async fn staging_deadline_fails_terminally_without_publication() {
        let (entered_tx, entered) = tokio::sync::oneshot::channel();
        let held = Arc::new(HeldArchiveTransport {
            requests: AtomicUsize::new(0),
            entered: Mutex::new(Some(entered_tx)),
            release: tokio::sync::Notify::new(),
        });
        let (_dir, state, destination, root, app) = export_fixture(held.clone());
        std::fs::write(root.join("deadline.pgn"), b"previous").unwrap();
        let task = tokio::spawn(run_owned_export(
            destination,
            "deadline.pgn".into(),
            uuid::Uuid::new_v4().to_string(),
            app.handle().clone(),
            state.clone(),
            Duration::from_millis(500),
        ));
        tokio::time::timeout(Duration::from_secs(2), entered)
            .await
            .unwrap()
            .unwrap();
        let error = tokio::time::timeout(Duration::from_secs(2), task)
            .await
            .unwrap()
            .unwrap()
            .unwrap_err();
        held.release.notify_waiters();
        assert!(matches!(error, Error::EngineTimeout(_)));
        assert_eq!(
            state
                .progress_state
                .get("chesscom_felix")
                .unwrap()
                .unwrap()
                .state,
            ProgressState::Failed
        );
        assert_eq!(
            std::fs::read(root.join("deadline.pgn")).unwrap(),
            b"previous"
        );
    }

    #[tokio::test]
    async fn publication_ignores_expired_staging_deadline_and_late_cancellation() {
        let _reset = ResetAtomicInjector;
        let (_dir, state, destination, root, app) = export_fixture(export_transport());
        let (entered, release) =
            hold_atomic_point(crate::infra::fs::AtomicFileFaultPoint::ParentSync, 1, false);
        let job_id = uuid::Uuid::new_v4().to_string();
        let task = tokio::spawn(run_owned_export(
            destination,
            "late.pgn".into(),
            job_id.clone(),
            app.handle().clone(),
            state.clone(),
            Duration::from_millis(500),
        ));
        tokio::time::timeout(Duration::from_secs(2), entered)
            .await
            .unwrap()
            .unwrap();
        tokio::time::sleep(Duration::from_millis(600)).await;
        assert!(state
            .download_registry
            .cancel(&state.operations, &job_id)
            .unwrap());
        release.send(()).unwrap();
        let artifact = task.await.unwrap().unwrap();
        assert_eq!(std::fs::read(root.join("late.pgn")).unwrap(), b"1. e4 e5\n");
        assert!(state
            .pgn_path_authority
            .lock()
            .unwrap()
            .as_ref()
            .unwrap()
            .has_persistent_id(&artifact.handle.id.id));
        assert_eq!(
            state
                .progress_state
                .get("chesscom_felix")
                .unwrap()
                .unwrap()
                .state,
            ProgressState::Succeeded
        );
    }

    #[tokio::test]
    async fn cleared_terminal_progress_cannot_replace_committed_success() {
        let _reset = ResetAtomicInjector;
        let (_dir, state, destination, root, app) = export_fixture(export_transport());
        let (entered, release) =
            hold_atomic_point(crate::infra::fs::AtomicFileFaultPoint::ParentSync, 1, false);
        let task = tokio::spawn(run_owned_export(
            destination,
            "cleared.pgn".into(),
            uuid::Uuid::new_v4().to_string(),
            app.handle().clone(),
            state.clone(),
            Duration::from_secs(2),
        ));
        tokio::time::timeout(Duration::from_secs(2), entered)
            .await
            .unwrap()
            .unwrap();
        state.progress_state.clear("chesscom_felix").unwrap();
        release.send(()).unwrap();
        let artifact = task.await.unwrap().unwrap();
        assert_eq!(
            std::fs::read(root.join("cleared.pgn")).unwrap(),
            b"1. e4 e5\n"
        );
        assert!(state
            .pgn_path_authority
            .lock()
            .unwrap()
            .as_ref()
            .unwrap()
            .has_persistent_id(&artifact.handle.id.id));
    }
}
