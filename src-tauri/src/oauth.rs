use axum::{
    extract::Query,
    response::{Html, IntoResponse},
    routing::get,
    Extension, Router,
};
use log::{error, info, warn};
use oauth2::{
    basic::BasicClient, AuthUrl, AuthorizationCode, ClientId, CsrfToken, HttpRequest, HttpResponse,
    PkceCodeChallenge, PkceCodeVerifier, RedirectUrl, Scope, TokenResponse, TokenUrl,
};
use serde::Deserialize;
use std::{
    collections::HashMap,
    net::TcpListener,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
    time::Duration,
};
use tauri_plugin_opener::OpenerExt;
use tokio::{
    sync::{oneshot, Mutex},
    task::JoinHandle,
};

use crate::{
    credentials::{LichessAccountHandle, LichessAccountMetadata},
    error::Error,
    AppState,
};
use dashmap::DashMap;
use serde::Serialize;
use specta::Type;

const OAUTH_FAILURE: &str = "OAuth authentication failed";
const LISTENER_DRAIN_TIMEOUT: Duration = Duration::from_secs(1);
const JOB_TTL: Duration = Duration::from_secs(15 * 60);
const LICHESS_ACCOUNT_URL: &str = "https://lichess.org/api/account";
const LICHESS_TOKEN_URL: &str = "https://lichess.org/api/token";
const PROVIDER_CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
const PROVIDER_REQUEST_TIMEOUT: Duration = Duration::from_secs(30);
const MAX_VERIFY_RESPONSE_BYTES: usize = 64 * 1024;
const MAX_OAUTH_RESPONSE_BYTES: usize = 64 * 1024;

fn provider_http_client() -> Result<reqwest::Client, Error> {
    crate::infra::net::safe_http_client(
        PROVIDER_CONNECT_TIMEOUT,
        PROVIDER_REQUEST_TIMEOUT,
        PROVIDER_REQUEST_TIMEOUT,
    )
    .map_err(|source| Error::Reqwest(Box::new(source)))
}

async fn safe_oauth_http_client(
    request: HttpRequest,
) -> Result<HttpResponse, oauth2::reqwest::Error<reqwest::Error>> {
    let client =
        provider_http_client().map_err(|error| oauth2::reqwest::Error::Other(error.to_string()))?;
    let method = reqwest::Method::from_bytes(request.method.as_str().as_bytes())
        .map_err(|error| oauth2::reqwest::Error::Other(error.to_string()))?;
    let mut builder = client
        .request(method, request.url.as_str())
        .body(request.body);
    for (name, value) in &request.headers {
        builder = builder.header(name.as_str(), value.as_bytes());
    }
    let response = client
        .execute(builder.build().map_err(oauth2::reqwest::Error::Reqwest)?)
        .await
        .map_err(oauth2::reqwest::Error::Reqwest)?;
    if response
        .content_length()
        .is_some_and(|length| length > MAX_OAUTH_RESPONSE_BYTES as u64)
    {
        return Err(oauth2::reqwest::Error::Other(
            "OAuth response exceeded the native limit".into(),
        ));
    }
    let status = response.status();
    let headers = response.headers().clone();
    let body = response
        .bytes()
        .await
        .map_err(oauth2::reqwest::Error::Reqwest)?;
    oauth_response_from_reqwest(status, &headers, body)
}

fn oauth_response_from_reqwest(
    status: reqwest::StatusCode,
    response_headers: &reqwest::header::HeaderMap,
    body: bytes::Bytes,
) -> Result<HttpResponse, oauth2::reqwest::Error<reqwest::Error>> {
    if body.len() > MAX_OAUTH_RESPONSE_BYTES {
        return Err(oauth2::reqwest::Error::Other(
            "OAuth response exceeded the native limit".into(),
        ));
    }
    let status_code = axum::http::StatusCode::from_u16(status.as_u16())
        .map_err(|error| oauth2::reqwest::Error::Other(error.to_string()))?;
    let mut headers = axum::http::HeaderMap::new();
    for (name, value) in response_headers {
        let name = axum::http::header::HeaderName::from_bytes(name.as_str().as_bytes())
            .map_err(|error| oauth2::reqwest::Error::Other(error.to_string()))?;
        let value = axum::http::header::HeaderValue::from_bytes(value.as_bytes())
            .map_err(|error| oauth2::reqwest::Error::Other(error.to_string()))?;
        headers.insert(name, value);
    }
    Ok(HttpResponse {
        status_code,
        headers,
        body: body.to_vec(),
    })
}

pub struct AuthLifecycle {
    active: Mutex<HashMap<u64, AuthTransaction>>,
    next_generation: AtomicU64,
    jobs: DashMap<String, (AuthenticationStatus, tokio::time::Instant)>,
}

impl Default for AuthLifecycle {
    fn default() -> Self {
        Self {
            active: Mutex::new(HashMap::new()),
            next_generation: AtomicU64::new(0),
            jobs: DashMap::new(),
        }
    }
}

struct AuthTransaction {
    csrf_token: CsrfToken,
    callback_tx: Option<oneshot::Sender<CallbackSignal>>,
}

enum CallbackSignal {
    Code(AuthorizationCode),
    Rejected,
}

#[derive(Debug, PartialEq, Eq)]
enum CallbackResult {
    AcceptedCode,
    AcceptedRejection,
    Mismatch,
    Missing,
    Closed,
}

impl AuthLifecycle {
    async fn begin(
        &self,
        csrf_token: CsrfToken,
    ) -> Result<(u64, oneshot::Receiver<CallbackSignal>), Error> {
        let mut active = self.active.lock().await;
        let generation = self.next_generation.fetch_add(1, Ordering::Relaxed) + 1;
        let (callback_tx, callback_rx) = oneshot::channel();
        active.insert(
            generation,
            AuthTransaction {
                csrf_token,
                callback_tx: Some(callback_tx),
            },
        );
        Ok((generation, callback_rx))
    }

    async fn clear_generation(&self, generation: u64) {
        let mut active = self.active.lock().await;
        active.remove(&generation);
    }

    async fn accept_callback(&self, query: CallbackQuery) -> CallbackResult {
        let (callback_tx, signal) = {
            let mut active = self.active.lock().await;
            let Some(state) = query.state.as_ref() else {
                return CallbackResult::Mismatch;
            };
            let Some(transaction) = active
                .values_mut()
                .find(|attempt| state.secret() == attempt.csrf_token.secret())
            else {
                return if active.is_empty() {
                    CallbackResult::Missing
                } else {
                    CallbackResult::Mismatch
                };
            };
            let Some(callback_tx) = transaction.callback_tx.take() else {
                return CallbackResult::Closed;
            };
            if query.error.is_some() {
                warn!("OAuth provider callback rejected authentication");
            }
            let signal = match query.code {
                Some(code) if query.error.is_none() => CallbackSignal::Code(code),
                _ => CallbackSignal::Rejected,
            };
            (callback_tx, signal)
        };

        let accepted_result = match &signal {
            CallbackSignal::Code(_) => CallbackResult::AcceptedCode,
            CallbackSignal::Rejected => CallbackResult::AcceptedRejection,
        };
        match callback_tx.send(signal) {
            Ok(()) => accepted_result,
            Err(_) => CallbackResult::Closed,
        }
    }

    #[cfg(test)]
    async fn active_state(&self) -> Option<CsrfToken> {
        self.active
            .lock()
            .await
            .values()
            .next()
            .map(|attempt| attempt.csrf_token.clone())
    }

    #[cfg(test)]
    async fn is_idle(&self) -> bool {
        self.active.lock().await.is_empty()
    }

    fn create_job(&self) -> AuthenticationJob {
        let now = tokio::time::Instant::now();
        self.jobs
            .retain(|_, (_, created)| now.duration_since(*created) < JOB_TTL);
        let job = AuthenticationJob {
            id: uuid::Uuid::new_v4().to_string(),
        };
        self.jobs
            .insert(job.id.clone(), (AuthenticationStatus::Pending, now));
        job
    }
    fn complete_job(&self, id: &str, status: AuthenticationStatus) {
        self.jobs
            .insert(id.into(), (status, tokio::time::Instant::now()));
    }
    fn job(&self, id: &str) -> Option<AuthenticationStatus> {
        let status = self.jobs.get(id).and_then(|status| {
            (tokio::time::Instant::now().duration_since(status.1) < JOB_TTL)
                .then(|| status.0.clone())
        });
        if status.is_none() {
            self.jobs.remove(id);
        }
        status
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(transparent)]
pub struct AuthenticationJob {
    pub id: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(tag = "state", rename_all = "snake_case")]
pub enum AuthenticationStatus {
    Pending,
    Succeeded { account: LichessAccountMetadata },
    Failed,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum LichessAccountRemoval {
    NotFound,
    Removed,
    RemovedRevocationPending,
}

pub struct ListenerHandle {
    redirect_url: String,
    shutdown_tx: Option<oneshot::Sender<()>>,
    task: JoinHandle<Result<(), String>>,
    task_completed: bool,
}

pub trait OAuthServices: Send + Sync + 'static {
    async fn exchange_code(
        &self,
        client: &BasicClient,
        code: AuthorizationCode,
        verifier: PkceCodeVerifier,
    ) -> Result<String, Error>;

    async fn verify_identity(&self, access_token: &str) -> Result<String, Error>;

    async fn revoke_token(&self, access_token: &str) -> Result<(), Error>;

    fn start_listener_and_server(
        &self,
        lifecycle: Arc<AuthLifecycle>,
    ) -> Result<ListenerHandle, Error>;
}

pub struct ProdOAuthServices;

impl OAuthServices for ProdOAuthServices {
    async fn exchange_code(
        &self,
        client: &BasicClient,
        code: AuthorizationCode,
        verifier: PkceCodeVerifier,
    ) -> Result<String, Error> {
        let token_response = client
            .exchange_code(code)
            .set_pkce_verifier(verifier)
            .request_async(safe_oauth_http_client)
            .await
            .map_err(|source| {
                error!("OAuth token exchange failed: {source}");
                Error::OAuthFailure(OAUTH_FAILURE.into())
            })?;
        Ok(token_response.access_token().secret().clone())
    }

    async fn verify_identity(&self, access_token: &str) -> Result<String, Error> {
        #[derive(Deserialize)]
        struct Account {
            username: String,
        }
        let response = provider_http_client()?
            .get(LICHESS_ACCOUNT_URL)
            .bearer_auth(access_token)
            .send()
            .await
            .map_err(|_| Error::OAuthFailure(OAUTH_FAILURE.into()))?;
        if !response.status().is_success() {
            return Err(Error::OAuthFailure(OAUTH_FAILURE.into()));
        }
        if response
            .content_length()
            .is_some_and(|length| length > MAX_VERIFY_RESPONSE_BYTES as u64)
        {
            return Err(Error::OAuthFailure(OAUTH_FAILURE.into()));
        }
        let body = response
            .bytes()
            .await
            .map_err(|_| Error::OAuthFailure(OAUTH_FAILURE.into()))?;
        if body.len() > MAX_VERIFY_RESPONSE_BYTES {
            return Err(Error::OAuthFailure(OAUTH_FAILURE.into()));
        }
        let account = serde_json::from_slice::<Account>(&body)
            .map_err(|_| Error::OAuthFailure(OAUTH_FAILURE.into()))?;
        if account.username.trim().is_empty() {
            return Err(Error::OAuthFailure(OAUTH_FAILURE.into()));
        }
        Ok(account.username)
    }

    async fn revoke_token(&self, access_token: &str) -> Result<(), Error> {
        let response = provider_http_client()?
            .delete(LICHESS_TOKEN_URL)
            .bearer_auth(access_token)
            .send()
            .await
            .map_err(|_| Error::OAuthFailure(OAUTH_FAILURE.into()))?;
        if response.status().is_success() {
            Ok(())
        } else {
            Err(Error::OAuthFailure(OAUTH_FAILURE.into()))
        }
    }

    fn start_listener_and_server(
        &self,
        lifecycle: Arc<AuthLifecycle>,
    ) -> Result<ListenerHandle, Error> {
        let listener = TcpListener::bind("127.0.0.1:0").map_err(|source| {
            error!("OAuth callback listener bind failed: {source}");
            Error::OAuthFailure(OAUTH_FAILURE.into())
        })?;
        let addr = listener.local_addr().map_err(|source| {
            error!("OAuth callback listener address lookup failed: {source}");
            Error::OAuthFailure(OAUTH_FAILURE.into())
        })?;
        let redirect_url = format!("http://{addr}/callback");
        let (shutdown_tx, shutdown_rx) = oneshot::channel();
        let router = Router::new()
            .route("/callback", get(authorize))
            .layer(Extension(lifecycle));
        let server = crate::infra::runtime::with_reactor(|| axum::Server::from_tcp(listener))
            .map_err(|source| {
                error!("OAuth callback server construction failed: {source}");
                Error::OAuthFailure(OAUTH_FAILURE.into())
            })?
            .serve(router.into_make_service())
            .with_graceful_shutdown(async move {
                let _ = shutdown_rx.await;
            });
        let task = tokio::spawn(async move {
            server.await.map_err(|source| {
                error!("OAuth callback server failed: {source}");
                source.to_string()
            })
        });

        Ok(ListenerHandle {
            redirect_url,
            shutdown_tx: Some(shutdown_tx),
            task,
            task_completed: false,
        })
    }
}

pub struct AuthInternalConfig<'a> {
    pub token_url_override: &'a str,
    pub timeout_duration: Duration,
}

#[tauri::command]
#[specta::specta]
pub async fn authenticate(
    username: String,
    state: tauri::State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<AuthenticationJob, Error> {
    let lifecycle = state.auth.clone();
    let credentials = state.credentials.clone();
    let job = lifecycle.create_job();
    let job_id = job.id.clone();
    let opener = app.clone();
    let completed_account = Arc::new(std::sync::Mutex::new(None));
    let account_for_delivery = completed_account.clone();
    tauri::async_runtime::spawn(async move {
        let result = authenticate_internal(
            username.clone(),
            lifecycle.clone(),
            move |url| {
                opener
                    .opener()
                    .open_url(url, None::<&str>)
                    .map_err(|source| source.to_string())
            },
            move |access_token| {
                let account = credentials
                    .store_lichess_token(username, access_token)
                    .map_err(|_| "credential storage failed".to_string())?;
                *account_for_delivery
                    .lock()
                    .expect("OAuth account mutex poisoned") = Some(account);
                Ok(())
            },
            AuthInternalConfig {
                token_url_override: "https://lichess.org/api/token",
                timeout_duration: Duration::from_secs(300),
            },
            ProdOAuthServices,
        )
        .await;
        let status = match result {
            Ok(()) => completed_account
                .lock()
                .expect("OAuth account mutex poisoned")
                .clone()
                .map_or(AuthenticationStatus::Failed, |account| {
                    AuthenticationStatus::Succeeded { account }
                }),
            Err(_) => AuthenticationStatus::Failed,
        };
        lifecycle.complete_job(&job_id, status);
    });
    Ok(job)
}

#[tauri::command]
#[specta::specta]
pub fn get_authentication_status(
    job: AuthenticationJob,
    state: tauri::State<'_, AppState>,
) -> Result<AuthenticationStatus, Error> {
    state
        .auth
        .job(&job.id)
        .ok_or_else(|| Error::InvalidInput("authentication job not found".into()))
}

#[tauri::command]
#[specta::specta]
pub fn list_lichess_accounts(state: tauri::State<'_, AppState>) -> Vec<LichessAccountMetadata> {
    state.credentials.list()
}

#[tauri::command]
#[specta::specta]
pub async fn remove_lichess_account(
    handle: LichessAccountHandle,
    state: tauri::State<'_, AppState>,
) -> Result<LichessAccountRemoval, Error> {
    remove_lichess_account_internal(handle, state.credentials.clone(), &ProdOAuthServices).await
}

async fn remove_lichess_account_internal<S: OAuthServices>(
    handle: LichessAccountHandle,
    credentials: Arc<crate::credentials::CredentialManager>,
    services: &S,
) -> Result<LichessAccountRemoval, Error> {
    let Some(token) = credentials.remove(&handle)? else {
        return Ok(LichessAccountRemoval::NotFound);
    };
    // The local removal is already durable. A provider outage is represented honestly without
    // rolling local access back into existence.
    Ok(if services.revoke_token(&token).await.is_ok() {
        LichessAccountRemoval::Removed
    } else {
        LichessAccountRemoval::RemovedRevocationPending
    })
}

/// One-way bridge for pre-credential-store renderer records. The caller must erase the supplied
/// legacy token from Web Storage after this succeeds; this command never returns it.
#[tauri::command]
#[specta::specta]
pub async fn migrate_legacy_lichess_token(
    username: String,
    token: String,
    state: tauri::State<'_, AppState>,
) -> Result<LichessAccountMetadata, Error> {
    migrate_legacy_token_internal(
        username,
        token,
        state.credentials.clone(),
        &ProdOAuthServices,
    )
    .await
}

async fn migrate_legacy_token_internal<S: OAuthServices>(
    username: String,
    token: String,
    credentials: Arc<crate::credentials::CredentialManager>,
    services: &S,
) -> Result<LichessAccountMetadata, Error> {
    let verified_username = services.verify_identity(&token).await?;
    if !verified_username.eq_ignore_ascii_case(username.trim()) {
        return Err(Error::OAuthFailure(OAUTH_FAILURE.into()));
    }
    credentials.store_lichess_token(verified_username, token)
}

pub async fn authenticate_internal<O, E, S>(
    username: String,
    lifecycle: Arc<AuthLifecycle>,
    open_browser: O,
    emit_token: E,
    config: AuthInternalConfig<'_>,
    services: S,
) -> Result<(), Error>
where
    O: FnOnce(&str) -> Result<(), String>,
    E: FnOnce(String) -> Result<(), String>,
    S: OAuthServices,
{
    let csrf_token = CsrfToken::new_random();
    let deadline = tokio::time::Instant::now() + config.timeout_duration;
    let (generation, callback_rx) = lifecycle.begin(csrf_token.clone()).await?;
    let mut listener = match services.start_listener_and_server(lifecycle.clone()) {
        Ok(listener) => listener,
        Err(source) => {
            error!("OAuth callback listener setup failed: {source}");
            lifecycle.clear_generation(generation).await;
            return Err(Error::OAuthFailure(OAUTH_FAILURE.into()));
        }
    };

    let result = match tokio::time::timeout(
        deadline.saturating_duration_since(tokio::time::Instant::now()),
        authenticate_after_listener(
            username,
            csrf_token,
            callback_rx,
            &mut listener,
            open_browser,
            emit_token,
            config.token_url_override,
            &services,
        ),
    )
    .await
    {
        Ok(result) => result,
        Err(_) => {
            warn!("OAuth authentication timed out");
            Err(Error::OAuthFailure(OAUTH_FAILURE.into()))
        }
    };
    shutdown_listener(
        &mut listener,
        deadline.saturating_duration_since(tokio::time::Instant::now()),
    )
    .await;
    lifecycle.clear_generation(generation).await;
    result
}

#[allow(clippy::too_many_arguments)]
async fn authenticate_after_listener<O, E, S>(
    username: String,
    csrf_token: CsrfToken,
    callback_rx: oneshot::Receiver<CallbackSignal>,
    listener: &mut ListenerHandle,
    open_browser: O,
    emit_token: E,
    token_url_override: &str,
    services: &S,
) -> Result<(), Error>
where
    O: FnOnce(&str) -> Result<(), String>,
    E: FnOnce(String) -> Result<(), String>,
    S: OAuthServices,
{
    let client = match oauth_client(&listener.redirect_url, token_url_override) {
        Ok(client) => client,
        Err(source) => {
            error!("OAuth client setup failed: {source}");
            return Err(Error::OAuthFailure(OAUTH_FAILURE.into()));
        }
    };
    let (pkce_challenge, pkce_verifier) = PkceCodeChallenge::new_random_sha256();
    let (authorization_url, _) = client
        .authorize_url(|| csrf_token)
        .add_scope(Scope::new("preference:read".into()))
        .add_extra_param("username", username.clone())
        .set_pkce_challenge(pkce_challenge)
        .url();

    if let Err(source) = open_browser(authorization_url.as_str()) {
        error!("OAuth browser opener failed: {source}");
        return Err(Error::OAuthFailure(OAUTH_FAILURE.into()));
    }

    tokio::pin!(callback_rx);
    tokio::select! {
        server_result = &mut listener.task => {
            listener.task_completed = true;
            match server_result {
                Ok(Ok(())) => error!("OAuth callback server stopped before authentication completed"),
                Ok(Err(source)) => error!("OAuth callback server failed: {source}"),
                Err(source) => error!("OAuth callback server task failed: {source}"),
            }
            Err(Error::OAuthFailure(OAUTH_FAILURE.into()))
        }
        callback_result = &mut callback_rx => match callback_result {
            Ok(CallbackSignal::Code(code)) => match services.exchange_code(&client, code, pkce_verifier).await {
                Ok(access_token) => match services.verify_identity(&access_token).await {
                    Ok(verified_username) if verified_username.eq_ignore_ascii_case(&username) => if let Err(source) = emit_token(access_token) {
                        error!("OAuth native credential persistence failed: {source}");
                        Err(Error::OAuthFailure(OAUTH_FAILURE.into()))
                    } else {
                        info!("OAuth identity credential stored");
                        Ok(())
                    },
                    Ok(_) | Err(_) => Err(Error::OAuthFailure(OAUTH_FAILURE.into())),
                },
                Err(source) => {
                    error!("OAuth token exchange failed: {source}");
                    Err(Error::OAuthFailure(OAUTH_FAILURE.into()))
                }
            },
            Ok(CallbackSignal::Rejected) => {
                warn!("OAuth provider rejected or cancelled authentication");
                Err(Error::OAuthFailure(OAUTH_FAILURE.into()))
            },
            Err(source) => {
                error!("OAuth callback channel closed: {source}");
                Err(Error::OAuthFailure(OAUTH_FAILURE.into()))
            }
        },
    }
}

fn oauth_client(redirect_url: &str, token_url_override: &str) -> Result<BasicClient, String> {
    let auth_url =
        AuthUrl::new("https://lichess.org/oauth".into()).map_err(|source| source.to_string())?;
    let token_url =
        TokenUrl::new(token_url_override.into()).map_err(|source| source.to_string())?;
    let redirect_url =
        RedirectUrl::new(redirect_url.into()).map_err(|source| source.to_string())?;
    Ok(BasicClient::new(
        ClientId::new("org.encroissant.app".into()),
        None,
        auth_url,
        Some(token_url),
    )
    .set_redirect_uri(redirect_url))
}

async fn shutdown_listener(listener: &mut ListenerHandle, drain_timeout: Duration) {
    if let Some(shutdown_tx) = listener.shutdown_tx.take() {
        let _ = shutdown_tx.send(());
    }
    if listener.task_completed {
        return;
    }
    match tokio::time::timeout(
        drain_timeout.min(LISTENER_DRAIN_TIMEOUT),
        &mut listener.task,
    )
    .await
    {
        Ok(Ok(Ok(()))) => {}
        Ok(Ok(Err(source))) => error!("OAuth callback server cleanup failed: {source}"),
        Ok(Err(source)) => error!("OAuth callback server task cleanup failed: {source}"),
        Err(_) => {
            warn!(
                "OAuth callback server did not stop before the transaction deadline; aborting it"
            );
            listener.task.abort();
            if let Err(source) = (&mut listener.task).await {
                if !source.is_cancelled() {
                    error!("OAuth callback server abort join failed: {source}");
                }
            }
        }
    }
    listener.task_completed = true;
}

#[derive(Deserialize)]
pub struct CallbackQuery {
    pub code: Option<AuthorizationCode>,
    pub state: Option<CsrfToken>,
    pub error: Option<String>,
}

pub async fn authorize(
    Extension(lifecycle): Extension<Arc<AuthLifecycle>>,
    Query(query): Query<CallbackQuery>,
) -> impl IntoResponse {
    callback_page(lifecycle.accept_callback(query).await)
}

fn callback_page(result: CallbackResult) -> Html<&'static str> {
    match result {
        CallbackResult::AcceptedCode => {
            Html("Authentication successful! You can close this window.")
        }
        CallbackResult::AcceptedRejection => Html("Authentication was cancelled or denied."),
        CallbackResult::Mismatch => {
            warn!("OAuth callback rejected because its CSRF state did not match");
            Html("Authentication failed: state mismatch.")
        }
        CallbackResult::Missing => Html("Authentication failed: no active transaction."),
        CallbackResult::Closed => Html("Authentication failed: transaction closed."),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::Uri;
    use std::sync::atomic::{AtomicBool, AtomicUsize};

    #[test]
    fn oauth_http_response_conversion_preserves_http_02_status_headers_and_body() {
        let mut headers = reqwest::header::HeaderMap::new();
        headers.insert(
            reqwest::header::CONTENT_TYPE,
            reqwest::header::HeaderValue::from_static("application/json"),
        );
        headers.insert(
            "x-provider-request-id",
            reqwest::header::HeaderValue::from_static("request-123"),
        );

        let converted = oauth_response_from_reqwest(
            reqwest::StatusCode::OK,
            &headers,
            bytes::Bytes::from_static(br#"{\"access_token\":\"token\"}"#),
        )
        .unwrap();

        assert_eq!(converted.status_code, axum::http::StatusCode::OK);
        assert_eq!(
            converted.headers.get("content-type").unwrap(),
            "application/json"
        );
        assert_eq!(
            converted.headers.get("x-provider-request-id").unwrap(),
            "request-123"
        );
        assert_eq!(converted.body, br#"{\"access_token\":\"token\"}"#);
    }

    #[test]
    fn oauth_http_response_conversion_rejects_oversized_body_after_transfer() {
        let error = oauth_response_from_reqwest(
            reqwest::StatusCode::OK,
            &reqwest::header::HeaderMap::new(),
            bytes::Bytes::from(vec![0; MAX_OAUTH_RESPONSE_BYTES + 1]),
        )
        .unwrap_err();

        assert!(
            matches!(error, oauth2::reqwest::Error::Other(message) if message.contains("exceeded"))
        );
    }

    #[test]
    fn provider_client_uses_the_shared_native_transport_policy() {
        assert!(provider_http_client().is_ok());
    }

    #[derive(Clone)]
    struct MockServices {
        bind_error: Option<String>,
        exchange_error: Option<String>,
        exchange_pending: bool,
        revoke_error: bool,
        server_error: bool,
        listener_ignores_shutdown: bool,
        exchange_started: Arc<AtomicBool>,
        listener_stopped: Arc<AtomicBool>,
        listener_aborted: Arc<AtomicBool>,
        listener_starts: Arc<AtomicUsize>,
    }

    impl MockServices {
        fn new() -> Self {
            Self {
                bind_error: None,
                exchange_error: None,
                exchange_pending: false,
                revoke_error: false,
                server_error: false,
                listener_ignores_shutdown: false,
                exchange_started: Arc::new(AtomicBool::new(false)),
                listener_stopped: Arc::new(AtomicBool::new(false)),
                listener_aborted: Arc::new(AtomicBool::new(false)),
                listener_starts: Arc::new(AtomicUsize::new(0)),
            }
        }
    }

    impl OAuthServices for MockServices {
        async fn exchange_code(
            &self,
            _: &BasicClient,
            _: AuthorizationCode,
            _: PkceCodeVerifier,
        ) -> Result<String, Error> {
            self.exchange_started.store(true, Ordering::Relaxed);
            if self.exchange_pending {
                std::future::pending::<()>().await;
            }
            match self.exchange_error.clone() {
                Some(source) => Err(Error::OAuthFailure(source)),
                None => Ok("token".into()),
            }
        }

        async fn verify_identity(&self, _: &str) -> Result<String, Error> {
            Ok("user".into())
        }

        async fn revoke_token(&self, _: &str) -> Result<(), Error> {
            if self.revoke_error {
                Err(Error::OAuthFailure(OAUTH_FAILURE.into()))
            } else {
                Ok(())
            }
        }

        fn start_listener_and_server(
            &self,
            _: Arc<AuthLifecycle>,
        ) -> Result<ListenerHandle, Error> {
            self.listener_starts.fetch_add(1, Ordering::Relaxed);
            if let Some(source) = &self.bind_error {
                return Err(Error::OAuthFailure(source.clone()));
            }
            let (shutdown_tx, shutdown_rx) = oneshot::channel();
            let stopped = self.listener_stopped.clone();
            let aborted = self.listener_aborted.clone();
            let server_error = self.server_error;
            let ignores_shutdown = self.listener_ignores_shutdown;
            let task = tokio::spawn(async move {
                struct AbortMarker(Arc<AtomicBool>);
                impl Drop for AbortMarker {
                    fn drop(&mut self) {
                        self.0.store(true, Ordering::Relaxed);
                    }
                }
                if server_error {
                    return Err("mock server failure".into());
                }
                if ignores_shutdown {
                    let _aborted = AbortMarker(aborted);
                    std::future::pending::<()>().await;
                }
                let _ = shutdown_rx.await;
                stopped.store(true, Ordering::Relaxed);
                Ok(())
            });
            Ok(ListenerHandle {
                redirect_url: "http://mock/callback".into(),
                shutdown_tx: Some(shutdown_tx),
                task,
                task_completed: false,
            })
        }
    }

    fn config() -> AuthInternalConfig<'static> {
        AuthInternalConfig {
            token_url_override: "http://mock/token",
            timeout_duration: Duration::from_secs(1),
        }
    }

    fn short_config() -> AuthInternalConfig<'static> {
        AuthInternalConfig {
            token_url_override: "http://mock/token",
            timeout_duration: Duration::from_millis(20),
        }
    }

    fn deadline_config() -> AuthInternalConfig<'static> {
        AuthInternalConfig {
            token_url_override: "http://mock/token",
            timeout_duration: Duration::from_millis(100),
        }
    }

    fn start_attempt(
        lifecycle: Arc<AuthLifecycle>,
        services: MockServices,
        emit: impl FnOnce(String) -> Result<(), String> + Send + 'static,
    ) -> JoinHandle<Result<(), Error>> {
        start_attempt_with_config(lifecycle, services, emit, config())
    }

    fn start_attempt_with_config(
        lifecycle: Arc<AuthLifecycle>,
        services: MockServices,
        emit: impl FnOnce(String) -> Result<(), String> + Send + 'static,
        config: AuthInternalConfig<'static>,
    ) -> JoinHandle<Result<(), Error>> {
        tokio::spawn(authenticate_internal(
            "user".into(),
            lifecycle,
            |_| Ok(()),
            emit,
            config,
            services,
        ))
    }

    async fn send_valid(lifecycle: Arc<AuthLifecycle>) -> CallbackResult {
        let state = lifecycle
            .active_state()
            .await
            .expect("active test transaction");
        lifecycle
            .accept_callback(CallbackQuery {
                code: Some(AuthorizationCode::new("code".into())),
                state: Some(state),
                error: None,
            })
            .await
    }

    #[tokio::test]
    async fn opener_failure_cleans_state_and_listener() {
        let lifecycle = Arc::new(AuthLifecycle::default());
        let services = MockServices::new();
        let result = authenticate_internal(
            "user".into(),
            lifecycle.clone(),
            |_| Err("opener failed".into()),
            |_| Ok(()),
            config(),
            services.clone(),
        )
        .await;
        assert!(matches!(result, Err(Error::OAuthFailure(message)) if message == OAUTH_FAILURE));
        assert!(lifecycle.is_idle().await);
        assert!(services.listener_stopped.load(Ordering::Relaxed));
    }

    #[tokio::test]
    async fn bind_failure_clears_reserved_attempt() {
        let lifecycle = Arc::new(AuthLifecycle::default());
        let mut services = MockServices::new();
        services.bind_error = Some("occupied".into());
        let result = authenticate_internal(
            "user".into(),
            lifecycle.clone(),
            |_| Ok(()),
            |_| Ok(()),
            config(),
            services,
        )
        .await;
        assert!(matches!(result, Err(Error::OAuthFailure(message)) if message == OAUTH_FAILURE));
        assert!(lifecycle.is_idle().await);
    }

    #[tokio::test]
    async fn stale_generation_cleanup_does_not_clear_new_attempt() {
        let lifecycle = AuthLifecycle::default();
        let (first_generation, first_rx) = lifecycle
            .begin(CsrfToken::new_random())
            .await
            .expect("first attempt");
        lifecycle.clear_generation(first_generation).await;
        drop(first_rx);
        let (second_generation, second_rx) = lifecycle
            .begin(CsrfToken::new_random())
            .await
            .expect("second attempt");
        lifecycle.clear_generation(first_generation).await;
        assert!(lifecycle.active_state().await.is_some());
        lifecycle.clear_generation(second_generation).await;
        drop(second_rx);
        assert!(lifecycle.is_idle().await);
    }

    #[test]
    fn authentication_jobs_are_correlated_and_token_free() {
        let lifecycle = AuthLifecycle::default();
        let first = lifecycle.create_job();
        let second = lifecycle.create_job();
        assert_ne!(first.id, second.id);
        assert_eq!(
            lifecycle.job(&first.id),
            Some(AuthenticationStatus::Pending)
        );
        lifecycle.complete_job(&first.id, AuthenticationStatus::Failed);
        assert_eq!(lifecycle.job(&first.id), Some(AuthenticationStatus::Failed));
        assert_eq!(
            lifecycle.job(&second.id),
            Some(AuthenticationStatus::Pending)
        );
    }

    #[test]
    fn expired_authentication_job_is_evicted_on_lookup() {
        let lifecycle = AuthLifecycle::default();
        let job = AuthenticationJob {
            id: uuid::Uuid::new_v4().to_string(),
        };
        lifecycle.jobs.insert(
            job.id.clone(),
            (
                AuthenticationStatus::Pending,
                tokio::time::Instant::now() - JOB_TTL,
            ),
        );
        assert_eq!(lifecycle.job(&job.id), None);
        assert!(!lifecycle.jobs.contains_key(&job.id));
    }

    #[test]
    fn provider_endpoints_are_exactly_allowlisted() {
        for (endpoint, path) in [
            (LICHESS_ACCOUNT_URL, "/api/account"),
            (LICHESS_TOKEN_URL, "/api/token"),
        ] {
            let parsed = reqwest::Url::parse(endpoint).unwrap();
            assert_eq!(parsed.scheme(), "https");
            assert_eq!(parsed.host_str(), Some("lichess.org"));
            assert_eq!(parsed.path(), path);
            assert!(parsed.query().is_none());
        }
    }

    #[tokio::test]
    async fn legacy_migration_verifies_identity_before_storing_an_opaque_handle() {
        let temp = tempfile::tempdir().unwrap();
        let credentials = Arc::new(crate::credentials::CredentialManager::new(Arc::new(
            crate::credentials::MemoryCredentialStore::default(),
        )));
        credentials.initialize(temp.path()).unwrap();
        let account = migrate_legacy_token_internal(
            "user".into(),
            "legacy-token".into(),
            credentials.clone(),
            &MockServices::new(),
        )
        .await
        .unwrap();
        assert_eq!(account.username, "user");
        assert_eq!(credentials.list(), vec![account]);
        assert!(
            !std::fs::read_to_string(temp.path().join("lichess-accounts.json"))
                .unwrap()
                .contains("legacy-token")
        );
    }

    #[tokio::test]
    async fn migration_rejects_identity_mismatch_without_storing_the_token() {
        let temp = tempfile::tempdir().unwrap();
        let credentials = Arc::new(crate::credentials::CredentialManager::new(Arc::new(
            crate::credentials::MemoryCredentialStore::default(),
        )));
        credentials.initialize(temp.path()).unwrap();
        assert!(migrate_legacy_token_internal(
            "different".into(),
            "legacy-token".into(),
            credentials.clone(),
            &MockServices::new()
        )
        .await
        .is_err());
        assert!(credentials.list().is_empty());
    }

    #[tokio::test]
    async fn local_removal_stays_true_when_provider_revocation_fails() {
        let temp = tempfile::tempdir().unwrap();
        let credentials = Arc::new(crate::credentials::CredentialManager::new(Arc::new(
            crate::credentials::MemoryCredentialStore::default(),
        )));
        credentials.initialize(temp.path()).unwrap();
        let account = credentials
            .store_lichess_token("user".into(), "token".into())
            .unwrap();
        let mut services = MockServices::new();
        services.revoke_error = true;
        assert_eq!(
            remove_lichess_account_internal(account.handle, credentials.clone(), &services)
                .await
                .unwrap(),
            LichessAccountRemoval::RemovedRevocationPending
        );
        assert!(credentials.list().is_empty());
    }

    #[tokio::test]
    async fn concurrent_attempts_keep_independent_callback_transactions() {
        let lifecycle = Arc::new(AuthLifecycle::default());
        let first_state = CsrfToken::new_random();
        let second_state = CsrfToken::new_random();
        let (first_generation, first_rx) = lifecycle.begin(first_state.clone()).await.unwrap();
        let (second_generation, second_rx) = lifecycle.begin(second_state.clone()).await.unwrap();
        assert_eq!(
            lifecycle
                .accept_callback(CallbackQuery {
                    code: Some(AuthorizationCode::new("one".into())),
                    state: Some(second_state),
                    error: None
                })
                .await,
            CallbackResult::AcceptedCode
        );
        assert!(matches!(second_rx.await, Ok(CallbackSignal::Code(_))));
        assert_eq!(
            lifecycle
                .accept_callback(CallbackQuery {
                    code: Some(AuthorizationCode::new("two".into())),
                    state: Some(first_state),
                    error: None
                })
                .await,
            CallbackResult::AcceptedCode
        );
        assert!(matches!(first_rx.await, Ok(CallbackSignal::Code(_))));
        lifecycle.clear_generation(first_generation).await;
        lifecycle.clear_generation(second_generation).await;
        assert!(lifecycle.is_idle().await);
    }

    #[tokio::test]
    async fn mismatch_does_not_consume_then_valid_callback_succeeds() {
        let lifecycle = Arc::new(AuthLifecycle::default());
        let services = MockServices::new();
        let task = start_attempt(lifecycle.clone(), services, |_| Ok(()));
        tokio::task::yield_now().await;
        assert_eq!(
            lifecycle
                .accept_callback(CallbackQuery {
                    code: Some(AuthorizationCode::new("bad".into())),
                    state: Some(CsrfToken::new("wrong".into())),
                    error: None,
                })
                .await,
            CallbackResult::Mismatch
        );
        assert!(lifecycle.active_state().await.is_some());
        assert_eq!(
            send_valid(lifecycle.clone()).await,
            CallbackResult::AcceptedCode
        );
        assert!(task.await.expect("task join").is_ok());
    }

    #[tokio::test]
    async fn replay_fails_after_one_valid_callback() {
        let lifecycle = Arc::new(AuthLifecycle::default());
        let task = start_attempt(lifecycle.clone(), MockServices::new(), |_| Ok(()));
        tokio::task::yield_now().await;
        let state = lifecycle
            .active_state()
            .await
            .expect("active test transaction");
        assert_eq!(
            lifecycle
                .accept_callback(CallbackQuery {
                    code: Some(AuthorizationCode::new("code".into())),
                    state: Some(state.clone()),
                    error: None,
                })
                .await,
            CallbackResult::AcceptedCode
        );
        let (next_generation, next_rx) = lifecycle.begin(CsrfToken::new_random()).await.unwrap();
        assert_eq!(
            lifecycle
                .accept_callback(CallbackQuery {
                    code: Some(AuthorizationCode::new("replay".into())),
                    state: Some(state),
                    error: None,
                })
                .await,
            CallbackResult::Closed
        );
        assert!(task.await.expect("task join").is_ok());
        lifecycle.clear_generation(next_generation).await;
        drop(next_rx);
    }

    #[tokio::test]
    async fn timeout_returns_generic_error_and_cleans_up() {
        let lifecycle = Arc::new(AuthLifecycle::default());
        let services = MockServices::new();
        let task = start_attempt_with_config(
            lifecycle.clone(),
            services.clone(),
            |_| Ok(()),
            short_config(),
        );
        let result = task.await.expect("task join");
        assert!(matches!(result, Err(Error::OAuthFailure(message)) if message == OAUTH_FAILURE));
        assert!(lifecycle.is_idle().await);
        assert!(services.listener_stopped.load(Ordering::Relaxed));
    }

    #[tokio::test]
    async fn provider_denial_with_matching_state_is_terminal_and_cleans_up() {
        let lifecycle = Arc::new(AuthLifecycle::default());
        let services = MockServices::new();
        let task = start_attempt(lifecycle.clone(), services.clone(), |_| Ok(()));
        tokio::task::yield_now().await;
        let state = lifecycle
            .active_state()
            .await
            .expect("active test transaction");
        let uri: Uri = format!("/callback?error=access_denied&state={}", state.secret())
            .parse()
            .expect("valid callback URI");
        let Query(query) = Query::<CallbackQuery>::try_from_uri(&uri)
            .expect("provider denial query is accepted by Axum");
        assert_eq!(
            lifecycle.accept_callback(query).await,
            CallbackResult::AcceptedRejection
        );
        assert!(
            matches!(task.await.expect("task join"), Err(Error::OAuthFailure(message)) if message == OAUTH_FAILURE)
        );
        assert!(lifecycle.is_idle().await);
        assert!(services.listener_stopped.load(Ordering::Relaxed));
    }

    #[tokio::test]
    async fn empty_callback_with_matching_state_is_rendered_as_rejection() {
        let lifecycle = Arc::new(AuthLifecycle::default());
        let services = MockServices::new();
        let task = start_attempt(lifecycle.clone(), services.clone(), |_| Ok(()));
        tokio::task::yield_now().await;
        let state = lifecycle
            .active_state()
            .await
            .expect("active test transaction");
        let result = lifecycle
            .accept_callback(CallbackQuery {
                code: None,
                state: Some(state),
                error: None,
            })
            .await;
        assert_eq!(result, CallbackResult::AcceptedRejection);
        assert_eq!(
            callback_page(result).0,
            "Authentication was cancelled or denied."
        );
        assert!(
            matches!(task.await.expect("task join"), Err(Error::OAuthFailure(message)) if message == OAUTH_FAILURE)
        );
        assert!(lifecycle.is_idle().await);
        assert!(services.listener_stopped.load(Ordering::Relaxed));
    }

    #[tokio::test]
    async fn deadline_cancels_pending_exchange_and_cleans_up() {
        let lifecycle = Arc::new(AuthLifecycle::default());
        let mut services = MockServices::new();
        services.exchange_pending = true;
        let task = start_attempt_with_config(
            lifecycle.clone(),
            services.clone(),
            |_| Ok(()),
            deadline_config(),
        );
        tokio::task::yield_now().await;
        assert_eq!(
            send_valid(lifecycle.clone()).await,
            CallbackResult::AcceptedCode
        );
        assert!(tokio::time::timeout(Duration::from_millis(50), async {
            while !services.exchange_started.load(Ordering::Relaxed) {
                tokio::task::yield_now().await;
            }
        })
        .await
        .is_ok());
        let result = tokio::time::timeout(Duration::from_millis(200), task)
            .await
            .expect("transaction deadline");
        assert!(
            matches!(result.expect("task join"), Err(Error::OAuthFailure(message)) if message == OAUTH_FAILURE)
        );
        assert!(lifecycle.is_idle().await);
        assert!(services.listener_stopped.load(Ordering::Relaxed));
    }

    #[tokio::test]
    async fn deadline_aborts_listener_that_ignores_shutdown() {
        let lifecycle = Arc::new(AuthLifecycle::default());
        let mut services = MockServices::new();
        services.listener_ignores_shutdown = true;
        let task = start_attempt_with_config(
            lifecycle.clone(),
            services.clone(),
            |_| Ok(()),
            short_config(),
        );
        let result = tokio::time::timeout(Duration::from_millis(100), task)
            .await
            .expect("bounded listener shutdown");
        assert!(
            matches!(result.expect("task join"), Err(Error::OAuthFailure(message)) if message == OAUTH_FAILURE)
        );
        assert!(lifecycle.is_idle().await);
        assert!(services.listener_aborted.load(Ordering::Relaxed));
    }

    #[tokio::test]
    async fn token_endpoint_failure_cleans_up() {
        let lifecycle = Arc::new(AuthLifecycle::default());
        let mut services = MockServices::new();
        services.exchange_error = Some("token endpoint unavailable".into());
        let task = start_attempt(lifecycle.clone(), services.clone(), |_| Ok(()));
        tokio::task::yield_now().await;
        assert_eq!(
            send_valid(lifecycle.clone()).await,
            CallbackResult::AcceptedCode
        );
        assert!(
            matches!(task.await.expect("task join"), Err(Error::OAuthFailure(message)) if message == OAUTH_FAILURE)
        );
        assert!(lifecycle.is_idle().await);
        assert!(services.listener_stopped.load(Ordering::Relaxed));
    }

    #[tokio::test]
    async fn event_failure_cleans_up_without_broadcast() {
        let lifecycle = Arc::new(AuthLifecycle::default());
        let services = MockServices::new();
        let task = start_attempt(lifecycle.clone(), services.clone(), |_| {
            Err("event sink failed".into())
        });
        tokio::task::yield_now().await;
        assert_eq!(
            send_valid(lifecycle.clone()).await,
            CallbackResult::AcceptedCode
        );
        assert!(
            matches!(task.await.expect("task join"), Err(Error::OAuthFailure(message)) if message == OAUTH_FAILURE)
        );
        assert!(lifecycle.is_idle().await);
        assert!(services.listener_stopped.load(Ordering::Relaxed));
    }

    #[tokio::test]
    async fn success_delivers_token_once_and_cleans_up() {
        let lifecycle = Arc::new(AuthLifecycle::default());
        let deliveries = Arc::new(AtomicUsize::new(0));
        let delivered = deliveries.clone();
        let services = MockServices::new();
        let task = start_attempt(lifecycle.clone(), services.clone(), move |token| {
            assert_eq!(token, "token");
            delivered.fetch_add(1, Ordering::Relaxed);
            Ok(())
        });
        tokio::task::yield_now().await;
        assert_eq!(
            send_valid(lifecycle.clone()).await,
            CallbackResult::AcceptedCode
        );
        assert!(task.await.expect("task join").is_ok());
        assert_eq!(deliveries.load(Ordering::Relaxed), 1);
        assert!(lifecycle.is_idle().await);
        assert!(services.listener_stopped.load(Ordering::Relaxed));
    }

    #[tokio::test]
    async fn server_failure_cleans_state() {
        let lifecycle = Arc::new(AuthLifecycle::default());
        let mut services = MockServices::new();
        services.server_error = true;
        let result = authenticate_internal(
            "user".into(),
            lifecycle.clone(),
            |_| Ok(()),
            |_| Ok(()),
            config(),
            services,
        )
        .await;
        assert!(matches!(result, Err(Error::OAuthFailure(message)) if message == OAUTH_FAILURE));
        assert!(lifecycle.is_idle().await);
    }
}
