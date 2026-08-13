use crate::error::Error;

pub struct SoundServerPort(pub u16);
pub struct SoundShutdownTx(pub std::sync::Mutex<Option<tokio::sync::oneshot::Sender<()>>>);

#[cfg(target_os = "linux")]
mod server {
    use axum::{
        body::StreamBody,
        extract::Path as AxumPath,
        http::{header, HeaderMap, StatusCode},
        response::IntoResponse,
        routing::get,
        Extension, Router,
    };
    use std::net::TcpListener;
    use std::path::PathBuf;
    use tokio::io::{AsyncReadExt, AsyncSeekExt};
    use tokio_util::io::ReaderStream;

    #[derive(Debug, PartialEq)]
    pub enum RangeParseResult {
        Valid(usize, usize),
        InvalidSyntax,
        NotSatisfiable,
    }

    pub fn parse_range(range_header: &str, total_len: usize) -> RangeParseResult {
        let range_str = match range_header.strip_prefix("bytes=") {
            Some(s) => s,
            None => return RangeParseResult::InvalidSyntax,
        };
        if range_str.contains(',') {
            return RangeParseResult::InvalidSyntax;
        }
        let mut parts = range_str.splitn(2, '-');
        let start_str = match parts.next() {
            Some(s) => s.trim(),
            None => return RangeParseResult::InvalidSyntax,
        };
        let end_str = match parts.next() {
            Some(s) => s.trim(),
            None => return RangeParseResult::InvalidSyntax,
        };

        if start_str.is_empty() {
            match end_str.parse::<usize>() {
                Ok(suffix) if suffix > 0 => {
                    if total_len == 0 {
                        RangeParseResult::NotSatisfiable
                    } else {
                        let start = total_len.saturating_sub(suffix);
                        let end = total_len - 1;
                        RangeParseResult::Valid(start, end)
                    }
                }
                _ => RangeParseResult::InvalidSyntax,
            }
        } else {
            match start_str.parse::<usize>() {
                Ok(start) => {
                    if start >= total_len {
                        return RangeParseResult::NotSatisfiable;
                    }
                    let end = if end_str.is_empty() {
                        total_len - 1
                    } else {
                        match end_str.parse::<usize>() {
                            Ok(e) => e.min(total_len - 1),
                            Err(_) => return RangeParseResult::InvalidSyntax,
                        }
                    };
                    if start <= end {
                        RangeParseResult::Valid(start, end)
                    } else {
                        RangeParseResult::InvalidSyntax
                    }
                }
                Err(_) => RangeParseResult::InvalidSyntax,
            }
        }
    }

    fn content_type_for(path: &std::path::Path) -> &'static str {
        match path.extension().and_then(|e| e.to_str()) {
            Some("mp3") => "audio/mpeg",
            Some("ogg") => "audio/ogg",
            Some("wav") => "audio/wav",
            Some("flac") => "audio/flac",
            _ => "application/octet-stream",
        }
    }

    pub(crate) async fn serve_sound(
        AxumPath(path): AxumPath<String>,
        headers: HeaderMap,
        Extension(sound_dir): Extension<PathBuf>,
    ) -> impl IntoResponse {
        let file_path = sound_dir.join(&path);

        let canonical = match file_path.canonicalize() {
            Ok(p) => p,
            Err(_) => return StatusCode::NOT_FOUND.into_response(),
        };
        let dir_canonical = match sound_dir.canonicalize() {
            Ok(p) => p,
            Err(_) => return StatusCode::INTERNAL_SERVER_ERROR.into_response(),
        };
        if !canonical.starts_with(&dir_canonical) {
            return StatusCode::FORBIDDEN.into_response();
        }

        let mut file = match tokio::fs::File::open(&canonical).await {
            Ok(f) => f,
            Err(_) => return StatusCode::NOT_FOUND.into_response(),
        };

        let metadata = match file.metadata().await {
            Ok(m) => m,
            Err(_) => return StatusCode::INTERNAL_SERVER_ERROR.into_response(),
        };
        if !metadata.is_file() {
            return StatusCode::NOT_FOUND.into_response();
        }

        let total_len = metadata.len() as usize;
        let content_type = content_type_for(&canonical);

        if let Some(range_val) = headers.get(header::RANGE) {
            if let Ok(range_str) = range_val.to_str() {
                match parse_range(range_str, total_len) {
                    RangeParseResult::Valid(start, end) => {
                        let length = end - start + 1;
                        if file
                            .seek(std::io::SeekFrom::Start(start as u64))
                            .await
                            .is_err()
                        {
                            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
                        }

                        let stream = ReaderStream::with_capacity(file.take(length as u64), 65536);
                        let body = StreamBody::new(stream);

                        return (
                            StatusCode::PARTIAL_CONTENT,
                            [
                                (header::CONTENT_TYPE, content_type.to_string()),
                                (header::ACCEPT_RANGES, "bytes".to_string()),
                                (header::CONTENT_LENGTH, length.to_string()),
                                (
                                    header::CONTENT_RANGE,
                                    format!("bytes {start}-{end}/{total_len}"),
                                ),
                            ],
                            body,
                        )
                            .into_response();
                    }
                    RangeParseResult::NotSatisfiable => {
                        return (
                            StatusCode::RANGE_NOT_SATISFIABLE,
                            [(header::CONTENT_RANGE, format!("bytes */{total_len}"))],
                            (),
                        )
                            .into_response();
                    }
                    RangeParseResult::InvalidSyntax => {}
                }
            }
        }

        let stream = ReaderStream::with_capacity(file, 65536);
        let body = StreamBody::new(stream);

        (
            StatusCode::OK,
            [
                (header::CONTENT_TYPE, content_type.to_string()),
                (header::ACCEPT_RANGES, "bytes".to_string()),
                (header::CONTENT_LENGTH, total_len.to_string()),
            ],
            body,
        )
            .into_response()
    }

    pub fn create_sound_server_with_seam<L, B, S, Fut>(
        bind_fn: B,
        server_fn: S,
        sound_dir: PathBuf,
        shutdown_rx: tokio::sync::oneshot::Receiver<()>,
    ) -> Result<(u16, impl std::future::Future<Output = ()>), std::io::Error>
    where
        B: FnOnce() -> std::io::Result<(u16, L)>,
        S: FnOnce(L, Router, tokio::sync::oneshot::Receiver<()>) -> std::io::Result<Fut>,
        Fut: std::future::Future<Output = ()> + Send + 'static,
    {
        let (port, listener) = bind_fn()?;

        let app = Router::new()
            .route("/*path", get(serve_sound))
            .layer(Extension(sound_dir));

        let server_future = server_fn(listener, app, shutdown_rx)?;

        log::info!("Sound server prepared on port {port}");
        Ok((port, server_future))
    }

    pub fn create_sound_server(
        sound_dir: PathBuf,
        shutdown_rx: tokio::sync::oneshot::Receiver<()>,
    ) -> Result<(u16, impl std::future::Future<Output = ()>), std::io::Error> {
        create_sound_server_with_seam(
            || {
                let listener = TcpListener::bind("127.0.0.1:0")?;
                let port = listener.local_addr()?.port();
                Ok((port, listener))
            },
            |listener, app, rx| {
                let server = axum::Server::from_tcp(listener)
                    .map_err(|e| std::io::Error::other(e.to_string()))?;
                Ok(async move {
                    if let Err(e) = server
                        .serve(app.into_make_service())
                        .with_graceful_shutdown(async {
                            let _ = rx.await;
                        })
                        .await
                    {
                        log::error!("Sound server error: {}", e);
                    }
                })
            },
            sound_dir,
            shutdown_rx,
        )
    }
}

#[cfg(target_os = "linux")]
pub use server::create_sound_server;

#[tauri::command]
#[specta::specta]
pub fn get_sound_server_port(state: tauri::State<'_, SoundServerPort>) -> Result<u16, Error> {
    Ok(state.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(target_os = "linux")]
    #[test]
    fn test_sound_range_matrix() {
        use server::RangeParseResult::*;
        assert_eq!(server::parse_range("bytes=0-499", 1000), Valid(0, 499));
        assert_eq!(server::parse_range("bytes=500-999", 1000), Valid(500, 999));
        assert_eq!(server::parse_range("bytes=-500", 1000), Valid(500, 999));
        assert_eq!(server::parse_range("bytes=9500-", 10000), Valid(9500, 9999));
        assert_eq!(server::parse_range("bytes=0-0", 1000), Valid(0, 0));
        assert_eq!(server::parse_range("bytes=-0", 1000), InvalidSyntax);
        assert_eq!(server::parse_range("bytes=1000-", 1000), NotSatisfiable);
        assert_eq!(
            server::parse_range("bytes=0-499,500-999", 1000),
            InvalidSyntax
        );
        assert_eq!(server::parse_range("0-499", 1000), InvalidSyntax);
        assert_eq!(server::parse_range("bytes=500-2000", 1000), Valid(500, 999));
        assert_eq!(server::parse_range("bytes=1000-2000", 1000), NotSatisfiable);
        assert_eq!(server::parse_range("bytes=0-", 0), NotSatisfiable);
        assert_eq!(server::parse_range("bytes=500-200", 1000), InvalidSyntax);
    }

    #[cfg(target_os = "linux")]
    #[tokio::test]
    async fn test_sound_server_ephemeral_startup() {
        let (tx, rx) = tokio::sync::oneshot::channel();
        let (port, server_future) = server::create_sound_server_with_seam(
            || Ok((42, ())),
            |(), _, rx| {
                Ok(async move {
                    let _ = rx.await;
                })
            },
            std::path::PathBuf::from("/nonexistent"),
            rx,
        )
        .unwrap();
        assert_eq!(port, 42);
        tx.send(()).unwrap();
        // Server future should exit cleanly when shutdown signal is received
        server_future.await;
    }

    #[cfg(target_os = "linux")]
    #[tokio::test]
    async fn test_sound_server_bind_failure() {
        let (_tx, rx) = tokio::sync::oneshot::channel();
        let result = server::create_sound_server_with_seam(
            || {
                Err(std::io::Error::new(
                    std::io::ErrorKind::AddrInUse,
                    "bind failed",
                ))
            },
            |_: (), _, _| -> Result<std::future::Ready<()>, std::io::Error> { unreachable!() },
            std::path::PathBuf::from("/nonexistent"),
            rx,
        );
        let err = match result {
            Err(e) => e,
            Ok(_) => panic!("expected error"),
        };
        assert_eq!(err.kind(), std::io::ErrorKind::AddrInUse);
    }

    #[cfg(target_os = "linux")]
    #[tokio::test]
    async fn test_sound_server_construction_failure() {
        let (_tx, rx) = tokio::sync::oneshot::channel();
        let result = server::create_sound_server_with_seam(
            || Ok((42, ())),
            |(), _, _| -> Result<std::future::Ready<()>, std::io::Error> {
                Err(std::io::Error::other("from_tcp failed"))
            },
            std::path::PathBuf::from("/nonexistent"),
            rx,
        );
        let err = match result {
            Err(e) => e,
            Ok(_) => panic!("expected error"),
        };
        assert_eq!(err.kind(), std::io::ErrorKind::Other);
    }

    #[cfg(target_os = "linux")]
    #[tokio::test]
    async fn test_serve_sound_handler() {
        use axum::body::HttpBody;
        use axum::extract::Path as AxumPath;
        use axum::http::{header, HeaderMap, StatusCode};
        use axum::response::IntoResponse;
        use axum::Extension;

        async fn read_body(mut body: axum::body::BoxBody) -> Vec<u8> {
            let mut bytes = Vec::new();
            while let Some(chunk) = body.data().await {
                bytes.extend_from_slice(&chunk.unwrap());
            }
            bytes
        }

        let dir = tempfile::tempdir().unwrap();
        let file_path = dir.path().join("test.mp3");
        tokio::fs::write(&file_path, b"1234567890").await.unwrap();

        let empty_path = dir.path().join("empty.mp3");
        tokio::fs::write(&empty_path, b"").await.unwrap();

        // Valid full response
        let headers = HeaderMap::new();
        let res = server::serve_sound(
            AxumPath("test.mp3".to_string()),
            headers,
            Extension(dir.path().to_path_buf()),
        )
        .await
        .into_response();
        assert_eq!(res.status(), StatusCode::OK);
        let body_bytes = read_body(res.into_body()).await;
        assert_eq!(body_bytes, b"1234567890");

        // Valid partial range
        let mut headers = HeaderMap::new();
        headers.insert(header::RANGE, "bytes=2-4".parse().unwrap());
        let res = server::serve_sound(
            AxumPath("test.mp3".to_string()),
            headers,
            Extension(dir.path().to_path_buf()),
        )
        .await
        .into_response();
        assert_eq!(res.status(), StatusCode::PARTIAL_CONTENT);
        let body_bytes = read_body(res.into_body()).await;
        assert_eq!(body_bytes, b"345");

        // Invalid range semantics (ignored, falls back to full content)
        let mut headers = HeaderMap::new();
        headers.insert(header::RANGE, "invalid".parse().unwrap());
        let res = server::serve_sound(
            AxumPath("test.mp3".to_string()),
            headers,
            Extension(dir.path().to_path_buf()),
        )
        .await
        .into_response();
        assert_eq!(res.status(), StatusCode::OK);
        let body_bytes = read_body(res.into_body()).await;
        assert_eq!(body_bytes, b"1234567890");

        // Unsatisfiable range semantics (returns 416)
        let mut headers = HeaderMap::new();
        headers.insert(header::RANGE, "bytes=100-200".parse().unwrap());
        let res = server::serve_sound(
            AxumPath("test.mp3".to_string()),
            headers,
            Extension(dir.path().to_path_buf()),
        )
        .await
        .into_response();
        assert_eq!(res.status(), StatusCode::RANGE_NOT_SATISFIABLE);
        assert_eq!(
            res.headers().get(header::CONTENT_RANGE).unwrap(),
            "bytes */10"
        );
        let body_bytes = read_body(res.into_body()).await;
        assert!(body_bytes.is_empty());

        // Zero-length file unsatisfiable range
        let mut headers = HeaderMap::new();
        headers.insert(header::RANGE, "bytes=0-100".parse().unwrap());
        let res = server::serve_sound(
            AxumPath("empty.mp3".to_string()),
            headers,
            Extension(dir.path().to_path_buf()),
        )
        .await
        .into_response();
        assert_eq!(res.status(), StatusCode::RANGE_NOT_SATISFIABLE);
        assert_eq!(
            res.headers().get(header::CONTENT_RANGE).unwrap(),
            "bytes */0"
        );
        let body_bytes = read_body(res.into_body()).await;
        assert!(body_bytes.is_empty());

        // Directory rejection
        let headers = HeaderMap::new();
        let res = server::serve_sound(
            AxumPath("".to_string()),
            headers,
            Extension(dir.path().to_path_buf()),
        )
        .await
        .into_response();
        assert_eq!(res.status(), StatusCode::NOT_FOUND);

        // Traversal rejection
        let headers = HeaderMap::new();
        let res = server::serve_sound(
            AxumPath("../test.mp3".to_string()),
            headers,
            Extension(dir.path().to_path_buf()),
        )
        .await
        .into_response();
        assert_eq!(res.status(), StatusCode::NOT_FOUND);

        // Missing file without loading full audio
        let headers = HeaderMap::new();
        let res = server::serve_sound(
            AxumPath("missing.mp3".to_string()),
            headers,
            Extension(dir.path().to_path_buf()),
        )
        .await
        .into_response();
        assert_eq!(res.status(), StatusCode::NOT_FOUND);

        // Empty file
        let headers = HeaderMap::new();
        let res = server::serve_sound(
            AxumPath("empty.mp3".to_string()),
            headers,
            Extension(dir.path().to_path_buf()),
        )
        .await
        .into_response();
        assert_eq!(res.status(), StatusCode::OK);
        let body_bytes = read_body(res.into_body()).await;
        assert!(body_bytes.is_empty());
    }
}
