//! Guarantees a Tokio runtime context for construction steps that register with the reactor.

/// Runs `build` inside the application's Tokio runtime context.
///
/// `axum::Server::from_tcp` converts a `std::net::TcpListener` into a Tokio one, which panics with
/// "there is no reactor running" unless a runtime context is active on the calling thread. The two
/// loopback servers in this application reach that call from different places — the sound server
/// from the synchronous `setup()` hook, the OAuth callback server from inside an async command — so
/// the requirement cannot be satisfied by "call it from async code" alone.
///
/// It is stated once here rather than at each call site because losing it is silent at compile
/// time: hoisting the construction out of a spawned future to obtain a synchronous `Result` is
/// exactly what aborted startup on Linux until the panic was traced back to it.
///
/// `tauri::async_runtime::handle()` lazily creates the process-global runtime if it does not exist
/// yet, and that is the same runtime `tauri::async_runtime::spawn` later polls the server on, so
/// the listener is always registered with the reactor that drives it.
pub fn with_reactor<T>(build: impl FnOnce() -> T) -> T {
    let handle = tauri::async_runtime::handle();
    let _guard = handle.inner().enter();
    build()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The whole point is that this works off a runtime; `#[tokio::test]` would supply the reactor
    /// that the synchronous `setup()` path does not have and prove nothing.
    #[test]
    fn provides_a_reactor_outside_an_ambient_runtime() {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        // hyper's `AddrIncoming::from_std` does this before registering; Tokio refuses a blocking
        // socket outright, which would mask the reactor question this test is about.
        listener.set_nonblocking(true).unwrap();
        let bound = with_reactor(|| tokio::net::TcpListener::from_std(listener));
        assert!(bound.is_ok());
    }
}
