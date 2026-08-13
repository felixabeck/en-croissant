//! Native Chess.com archive export.
//!
//! Archive discovery, validation, parsing, staging and publication all stay native.  The
//! renderer supplies only an opaque download destination and receives an opaque PGN artifact.

use crate::{
    error::Error,
    infra::path_authority::{ArtifactPublication, PathRef},
    progress::{begin_progress, update_progress_with_state, ProgressState},
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
    let lease = state.download_registry.begin(&job_id)?;
    let cancellation = lease.cancellation_token();
    let progress = begin_progress(&state.progress_state, &app, format!("chesscom_{player}"))?;

    let result = match tokio::time::timeout(EXPORT_TIMEOUT, async {
        let index_bytes = fetch_bounded(
            state.inner(),
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
                fetch_bounded(state.inner(), archive, MAX_ARCHIVE_BYTES, &cancellation).await?;
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
        let artifact =
            crate::fs::install_staged_pgn_artifact(destination, filename, staged, state.inner())
                .await?;
        update_progress_with_state(
            &state.progress_state,
            &app,
            &progress,
            100.0,
            ProgressState::Succeeded,
        )?;
        Ok(artifact)
    })
    .await
    {
        Ok(result) => result,
        Err(_) => Err(Error::EngineTimeout(
            "Chess.com export deadline exceeded".into(),
        )),
    };

    if let Err(error) = &result {
        let terminal = if matches!(error, Error::Cancellation) {
            ProgressState::Cancelled
        } else {
            ProgressState::Failed
        };
        let _ = update_progress_with_state(&state.progress_state, &app, &progress, 0.0, terminal);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infra::net::{DownloadResponse, DownloadTransport};
    use async_trait::async_trait;
    use bytes::Bytes;
    use reqwest::header::HeaderMap;
    use std::sync::{Arc, Mutex};

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
}
