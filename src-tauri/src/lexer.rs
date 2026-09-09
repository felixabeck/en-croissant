use pgn_reader::{BufferedReader, Nag, RawHeader, SanPlus, Skip, Visitor};
use serde::Serialize;
use specta::Type;
use std::io::Read;
use tokio_util::sync::CancellationToken;

use crate::{error::Error, AppState};

struct CancellableReader<R> {
    inner: R,
    cancellation: Option<CancellationToken>,
}

impl<R: Read> Read for CancellableReader<R> {
    fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        if let Some(cancellation) = &self.cancellation {
            if cancellation.is_cancelled() {
                return Err(std::io::Error::new(
                    std::io::ErrorKind::Interrupted,
                    "PGN lexing cancelled",
                ));
            }
        }
        self.inner.read(buf)
    }
}

struct Lexer {
    tokens: Vec<Token>,
    cancellation: Option<CancellationToken>,
    cancelled: bool,
}

impl Lexer {
    fn check_cancellation(&mut self) -> bool {
        if self.cancelled {
            return true;
        }
        if let Some(cancellation) = &self.cancellation {
            if cancellation.is_cancelled() {
                self.cancelled = true;
                return true;
            }
        }
        false
    }
}

#[derive(Serialize, Clone, Type, Debug, PartialEq)]
#[serde(tag = "type", content = "value")]
pub enum Token {
    ParenOpen,
    ParenClose,
    Comment(String),
    San(String),
    Header { tag: String, value: String },
    Nag(String),
    Outcome(String),
}

#[cfg(test)]
pub(crate) struct LexerTestHook {
    pub entered: std::sync::mpsc::SyncSender<()>,
    pub release: std::sync::mpsc::Receiver<()>,
}

#[cfg(test)]
std::thread_local! {
    static TEST_LEXER_HOOK: std::cell::RefCell<Option<LexerTestHook>> = const {
        std::cell::RefCell::new(None)
    };
}

#[cfg(test)]
pub(crate) fn set_test_lexer_hook(hook: Option<LexerTestHook>) {
    TEST_LEXER_HOOK.with(|current| *current.borrow_mut() = hook);
}

#[cfg(test)]
fn trigger_test_lexer_hook() {
    let hook = TEST_LEXER_HOOK.with(|current| current.borrow_mut().take());
    if let Some(hook) = hook {
        let _ = hook.entered.send(());
        let _ = hook.release.recv_timeout(std::time::Duration::from_secs(5));
    }
}

impl Visitor for Lexer {
    type Result = Result<Vec<Token>, Error>;

    fn san(&mut self, san: SanPlus) {
        #[cfg(test)]
        trigger_test_lexer_hook();
        if self.check_cancellation() {
            return;
        }
        self.tokens.push(Token::San(san.to_string()));
    }

    fn header(&mut self, key: &[u8], value: RawHeader<'_>) {
        if self.check_cancellation() {
            return;
        }
        self.tokens.push(Token::Header {
            tag: String::from_utf8_lossy(key).to_string(),
            value: String::from_utf8_lossy(value.as_bytes()).to_string(),
        });
    }

    fn nag(&mut self, nag: Nag) {
        if self.check_cancellation() {
            return;
        }
        self.tokens.push(Token::Nag(nag.to_string()));
    }

    fn begin_variation(&mut self) -> Skip {
        if self.check_cancellation() {
            return Skip(true);
        }
        self.tokens.push(Token::ParenOpen);
        Skip(false)
    }

    fn end_variation(&mut self) {
        if self.check_cancellation() {
            return;
        }
        self.tokens.push(Token::ParenClose);
    }

    fn comment(&mut self, comment: pgn_reader::RawComment<'_>) {
        if self.check_cancellation() {
            return;
        }
        self.tokens.push(Token::Comment(
            String::from_utf8_lossy(comment.as_bytes()).to_string(),
        ));
    }

    fn end_headers(&mut self) -> Skip {
        if self.check_cancellation() {
            Skip(true)
        } else {
            Skip(false)
        }
    }

    fn end_game(&mut self) -> Self::Result {
        if self.check_cancellation() {
            return Err(Error::Cancellation);
        }
        Ok(self.tokens.clone())
    }

    fn outcome(&mut self, outcome: Option<shakmaty::Outcome>) {
        if self.check_cancellation() {
            return;
        }
        self.tokens.push(Token::Outcome(
            outcome.map(|o| o.to_string()).unwrap_or("*".to_string()),
        ));
    }
}

pub fn lex_pgn_cancellable(
    pgn: &str,
    cancellation: Option<&CancellationToken>,
) -> Result<Vec<Token>, Error> {
    if let Some(token) = cancellation {
        if token.is_cancelled() {
            return Err(Error::Cancellation);
        }
    }
    let reader = CancellableReader {
        inner: pgn.as_bytes(),
        cancellation: cancellation.cloned(),
    };
    let mut buffered = BufferedReader::new(reader);
    let mut lexer = Lexer {
        tokens: Vec::new(),
        cancellation: cancellation.cloned(),
        cancelled: false,
    };
    match buffered.read_game(&mut lexer) {
        Ok(Some(result)) => result,
        Ok(None) => {
            if cancellation.is_some_and(|c| c.is_cancelled()) || lexer.cancelled {
                Err(Error::Cancellation)
            } else {
                Ok(Vec::new())
            }
        }
        Err(e) => {
            if cancellation.is_some_and(|c| c.is_cancelled()) || lexer.cancelled {
                Err(Error::Cancellation)
            } else {
                Err(Error::InvalidInput(format!("PGN parse error: {e:?}")))
            }
        }
    }
}

#[allow(dead_code)]
pub fn lex_pgn_sync(pgn: &str) -> Result<Vec<Token>, String> {
    lex_pgn_cancellable(pgn, None).map_err(|e| e.to_string())
}

pub fn validate_pgn_len(pgn: &str) -> Result<(), Error> {
    if pgn.len() > 10 * 1024 * 1024 {
        return Err(Error::InvalidInput("PGN string too large".into()));
    }
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn lex_pgn(
    pgn: String,
    ticket: Option<String>,
    window: tauri::WebviewWindow,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Token>, Error> {
    validate_pgn_len(&pgn)?;

    let operation = crate::native_read_operation(ticket, &window, &state, "lex_pgn")?;
    let cancellation = operation.token();
    crate::infra::operations::run_native_operation(operation, "lex_pgn", async move {
        crate::infra::blocking::BLOCKING_GATEWAY
            .spawn_cancellable(cancellation, move |token| {
                lex_pgn_cancellable(&pgn, Some(token))
            })
            .await
    })
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_lex_pgn_sync_representative() {
        let pgn = "[Event \"Test\"]\n\n1. e4 {Best by test} (1. d4) 1... e5 $1 1-0";
        let tokens = lex_pgn_sync(pgn).unwrap();
        assert_eq!(
            tokens,
            vec![
                Token::Header {
                    tag: "Event".to_string(),
                    value: "Test".to_string()
                },
                Token::San("e4".to_string()),
                Token::Comment("Best by test".to_string()),
                Token::ParenOpen,
                Token::San("d4".to_string()),
                Token::ParenClose,
                Token::San("e5".to_string()),
                Token::Nag("$1".to_string()),
                Token::Outcome("1-0".to_string()),
            ]
        );
    }

    #[test]
    fn test_lex_pgn_sync_empty() {
        let tokens = lex_pgn_sync("").unwrap();
        assert_eq!(tokens, vec![]);
    }

    #[test]
    fn test_lex_pgn_sync_malformed() {
        // pgn-reader tolerates malformed movetext and parses it deterministically
        let tokens = lex_pgn_sync("1. e4e5").unwrap();
        assert_eq!(tokens, vec![Token::San("e4e5".to_string())]);
    }

    #[test]
    fn test_lex_pgn_limit() {
        let pgn = " ".repeat(10 * 1024 * 1024 + 1);
        let result = validate_pgn_len(&pgn);
        assert!(
            matches!(result, Err(Error::InvalidInput(ref msg)) if msg == "PGN string too large")
        );
    }

    #[test]
    fn test_lex_pgn_cancels_with_checkpoints() {
        let pgn = "[Event \"Test\"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 1-0";
        let token = CancellationToken::new();
        token.cancel();
        let result = lex_pgn_cancellable(pgn, Some(&token));
        assert!(matches!(result, Err(Error::Cancellation)));
    }

    #[test]
    fn test_lex_pgn_cancels_while_running_mid_parse() {
        let pgn = "[Event \"Test\"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 1-0";
        let token = CancellationToken::new();
        let (entered_tx, entered_rx) = std::sync::mpsc::sync_channel(1);
        let (release_tx, release_rx) = std::sync::mpsc::sync_channel(1);

        let thread_token = token.clone();
        let pgn_str = pgn.to_string();
        let worker = std::thread::spawn(move || {
            // Install the ONE-SHOT thread-local hook INSIDE the actual worker thread
            set_test_lexer_hook(Some(LexerTestHook {
                entered: entered_tx,
                release: release_rx,
            }));
            struct Cleanup;
            impl Drop for Cleanup {
                fn drop(&mut self) {
                    set_test_lexer_hook(None);
                }
            }
            let _cleanup = Cleanup;
            lex_pgn_cancellable(&pgn_str, Some(&thread_token))
        });

        // 1. Await entered hook: bounded by recv_timeout
        entered_rx
            .recv_timeout(std::time::Duration::from_secs(5))
            .expect("worker must enter parser and reach SAN callback");

        // 2. Cancel the token while lexer is actively running
        token.cancel();

        // 3. Release the worker
        let _ = release_tx.send(());

        let result = worker.join().expect("worker thread must complete");
        assert!(matches!(result, Err(Error::Cancellation)));
    }
}
