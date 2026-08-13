use pgn_reader::{BufferedReader, Nag, RawHeader, SanPlus, Skip, Visitor};
use serde::Serialize;
use specta::Type;

use crate::error::Error;

struct Lexer {
    tokens: Vec<Token>,
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

impl Visitor for Lexer {
    type Result = Result<Vec<Token>, String>;

    fn san(&mut self, san: SanPlus) {
        self.tokens.push(Token::San(san.to_string()));
    }

    fn header(&mut self, key: &[u8], value: RawHeader<'_>) {
        self.tokens.push(Token::Header {
            tag: String::from_utf8_lossy(key).to_string(),
            value: String::from_utf8_lossy(value.as_bytes()).to_string(),
        });
    }
    fn nag(&mut self, nag: Nag) {
        self.tokens.push(Token::Nag(nag.to_string()));
    }

    fn begin_variation(&mut self) -> Skip {
        self.tokens.push(Token::ParenOpen);
        Skip(false)
    }

    fn end_variation(&mut self) {
        self.tokens.push(Token::ParenClose);
    }

    fn comment(&mut self, comment: pgn_reader::RawComment<'_>) {
        self.tokens.push(Token::Comment(
            String::from_utf8_lossy(comment.as_bytes()).to_string(),
        ));
    }

    fn end_game(&mut self) -> Self::Result {
        Ok(self.tokens.clone())
    }

    fn outcome(&mut self, outcome: Option<shakmaty::Outcome>) {
        self.tokens.push(Token::Outcome(
            outcome.map(|o| o.to_string()).unwrap_or("*".to_string()),
        ));
    }
}

pub fn lex_pgn_sync(pgn: &str) -> Result<Vec<Token>, String> {
    let mut reader = BufferedReader::new(pgn.as_bytes());
    let mut lexer = Lexer { tokens: Vec::new() };
    match reader
        .read_game(&mut lexer)
        .map_err(|e| format!("PGN parse error: {e:?}"))?
    {
        Some(tokens) => tokens,
        None => Ok(Vec::new()),
    }
}

#[tauri::command]
#[specta::specta]
pub async fn lex_pgn(pgn: String) -> Result<Vec<Token>, Error> {
    if pgn.len() > 10 * 1024 * 1024 {
        return Err(Error::InvalidInput("PGN string too large".into()));
    }

    crate::infra::blocking::BLOCKING_GATEWAY
        .spawn(move || lex_pgn_sync(&pgn).map_err(Error::InvalidInput))
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

    #[tokio::test]
    async fn test_lex_pgn_limit() {
        let pgn = " ".repeat(10 * 1024 * 1024 + 1);
        let result = lex_pgn(pgn).await;
        assert!(
            matches!(result, Err(Error::InvalidInput(ref msg)) if msg == "PGN string too large")
        );
    }
}
