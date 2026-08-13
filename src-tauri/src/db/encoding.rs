use crate::error::Error;
use shakmaty::{
    fen::Fen, san::SanPlus, CastlingMode, Chess, FromSetup, Move, Position, PositionError,
};
use std::io::{self, ErrorKind};

pub const VARIATION_START_MARKER: u8 = 255;
pub const VARIATION_END_MARKER: u8 = 254;
pub const COMMENT_MARKER: u8 = 253;
pub const NAG_MARKER: u8 = 252;

pub fn encode_move(m: &Move, chess: &Chess) -> Result<u8, Error> {
    let moves = chess.legal_moves();
    let index = moves
        .iter()
        .position(|candidate| candidate == m)
        .ok_or_else(|| invalid_data("Move is not legal in the given position"))?;
    let encoded =
        u8::try_from(index).map_err(|_| invalid_data("Legal move index overflowed u8"))?;
    if encoded >= NAG_MARKER {
        return Err(invalid_data(
            "Legal move index collides with an encoding marker",
        ));
    }
    Ok(encoded)
}

pub fn decode_move(byte: u8, chess: &Chess) -> Option<Move> {
    let legal_moves = chess.legal_moves();
    legal_moves.get(byte as usize).cloned()
}

pub fn encode_comment(comment: &str, output: &mut Vec<u8>) {
    for chunk in comment.as_bytes().chunks(u16::MAX as usize) {
        output.push(COMMENT_MARKER);
        output.extend_from_slice(&(chunk.len() as u16).to_le_bytes());
        output.extend_from_slice(chunk);
    }
}

pub fn encode_nag(nag: &str, output: &mut Vec<u8>) {
    for chunk in nag.as_bytes().chunks(u16::MAX as usize) {
        output.push(NAG_MARKER);
        output.extend_from_slice(&(chunk.len() as u16).to_le_bytes());
        output.extend_from_slice(chunk);
    }
}

pub struct MainlineMoveBytesIter<'a> {
    bytes: &'a [u8],
    cursor: usize,
    variation_depth: usize,
}

impl<'a> MainlineMoveBytesIter<'a> {
    fn new(bytes: &'a [u8]) -> Self {
        Self {
            bytes,
            cursor: 0,
            variation_depth: 0,
        }
    }

    fn skip_annotation(&mut self) -> Option<()> {
        let length_end = self.cursor.checked_add(2)?;
        let length_bytes = self.bytes.get(self.cursor..length_end)?;
        let length = u16::from_le_bytes([length_bytes[0], length_bytes[1]]) as usize;
        self.cursor = length_end.saturating_add(length).min(self.bytes.len());
        Some(())
    }
}

impl Iterator for MainlineMoveBytesIter<'_> {
    type Item = u8;

    fn next(&mut self) -> Option<Self::Item> {
        while self.cursor < self.bytes.len() {
            let byte = self.bytes[self.cursor];
            self.cursor += 1;

            match byte {
                VARIATION_START_MARKER => {
                    self.variation_depth = self.variation_depth.saturating_add(1);
                }
                VARIATION_END_MARKER => {
                    self.variation_depth = self.variation_depth.saturating_sub(1);
                }
                COMMENT_MARKER | NAG_MARKER => self.skip_annotation()?,
                _ if self.variation_depth == 0 => return Some(byte),
                _ => {}
            }
        }

        None
    }
}

pub fn iter_mainline_move_bytes(bytes: &[u8]) -> MainlineMoveBytesIter<'_> {
    MainlineMoveBytesIter::new(bytes)
}

/// Validates every structural marker before returning the mainline iterator.
/// Callers that process database-owned move streams must use this boundary so
/// truncated comments/NAGs and unbalanced variations cannot be treated as a
/// valid shorter game.
pub fn try_iter_mainline_move_bytes(bytes: &[u8]) -> Result<MainlineMoveBytesIter<'_>, Error> {
    let mut cursor = 0usize;
    let mut variation_depth = 0usize;
    while cursor < bytes.len() {
        let marker = bytes[cursor];
        cursor += 1;
        match marker {
            VARIATION_START_MARKER => {
                variation_depth = variation_depth
                    .checked_add(1)
                    .ok_or_else(|| invalid_data("variation nesting overflow"))?;
            }
            VARIATION_END_MARKER => {
                variation_depth = variation_depth
                    .checked_sub(1)
                    .ok_or_else(|| invalid_data("variation ended without a matching start"))?;
            }
            COMMENT_MARKER | NAG_MARKER => {
                let length_end = cursor
                    .checked_add(2)
                    .ok_or_else(|| invalid_data("annotation length overflow"))?;
                let length_bytes = bytes
                    .get(cursor..length_end)
                    .ok_or_else(|| invalid_data("truncated comment or NAG length"))?;
                let length = u16::from_le_bytes([length_bytes[0], length_bytes[1]]) as usize;
                cursor = cursor
                    .checked_add(2)
                    .and_then(|start| start.checked_add(length))
                    .filter(|end| *end <= bytes.len())
                    .ok_or_else(|| invalid_data("truncated comment or NAG payload"))?;
            }
            _ => {}
        }
    }
    if variation_depth != 0 {
        return Err(invalid_data("unclosed variation"));
    }
    Ok(MainlineMoveBytesIter::new(bytes))
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DecodedGameNode {
    Move(String),
    Nag(String),
    Comment(String),
    Variation(Vec<DecodedGameNode>),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DecodedGame {
    pub nodes: Vec<DecodedGameNode>,
}

struct DecodeFrame {
    nodes: Vec<DecodedGameNode>,
    chess: Chess,
    pre_move_positions: Vec<Chess>,
}

fn invalid_data(message: &str) -> Error {
    Error::from(io::Error::new(ErrorKind::InvalidData, message.to_string()))
}

pub fn decode_game(moves_bytes: &[u8], initial_fen: Fen) -> Result<DecodedGame, Error> {
    let setup = initial_fen.into_setup();
    let castling_mode = CastlingMode::detect(&setup);
    let root_position = Chess::from_setup(setup, castling_mode)
        .or_else(PositionError::ignore_too_much_material)
        .map_err(|error| invalid_data(&format!("Invalid initial FEN setup: {error}")))?;

    let mut stack = vec![DecodeFrame {
        nodes: Vec::new(),
        chess: root_position,
        pre_move_positions: Vec::new(),
    }];

    let mut cursor = 0usize;
    while cursor < moves_bytes.len() {
        let byte = moves_bytes[cursor];
        cursor += 1;

        match byte {
            VARIATION_START_MARKER => {
                let parent_position = stack
                    .last()
                    .map(|frame| {
                        frame
                            .pre_move_positions
                            .last()
                            .cloned()
                            .unwrap_or_else(|| frame.chess.clone())
                    })
                    .ok_or_else(|| invalid_data("Missing parent frame while opening variation"))?;
                stack.push(DecodeFrame {
                    nodes: Vec::new(),
                    chess: parent_position,
                    pre_move_positions: Vec::new(),
                });
            }
            VARIATION_END_MARKER => {
                if stack.len() == 1 {
                    return Err(invalid_data("Unbalanced variation end marker"));
                }
                let frame = stack.pop().ok_or_else(|| {
                    invalid_data("Missing variation frame while closing variation")
                })?;
                if let Some(parent) = stack.last_mut() {
                    parent.nodes.push(DecodedGameNode::Variation(frame.nodes));
                }
            }
            COMMENT_MARKER => {
                if cursor + 2 > moves_bytes.len() {
                    return Err(invalid_data("Truncated comment length marker"));
                }
                let len =
                    u16::from_le_bytes([moves_bytes[cursor], moves_bytes[cursor + 1]]) as usize;
                cursor += 2;
                if cursor + len > moves_bytes.len() {
                    return Err(invalid_data("Truncated comment payload"));
                }
                let payload = &moves_bytes[cursor..cursor + len];
                cursor += len;

                let comment = String::from_utf8_lossy(payload).to_string();
                if let Some(frame) = stack.last_mut() {
                    frame.nodes.push(DecodedGameNode::Comment(comment));
                }
            }
            NAG_MARKER => {
                if cursor + 2 > moves_bytes.len() {
                    return Err(invalid_data("Truncated NAG length marker"));
                }
                let len =
                    u16::from_le_bytes([moves_bytes[cursor], moves_bytes[cursor + 1]]) as usize;
                cursor += 2;
                if cursor + len > moves_bytes.len() {
                    return Err(invalid_data("Truncated NAG payload"));
                }
                let payload = &moves_bytes[cursor..cursor + len];
                cursor += len;

                let nag = String::from_utf8_lossy(payload).to_string();
                if let Some(frame) = stack.last_mut() {
                    frame.nodes.push(DecodedGameNode::Nag(nag));
                }
            }
            move_idx => {
                let frame = stack
                    .last_mut()
                    .ok_or_else(|| invalid_data("Missing frame while decoding move"))?;
                let pre_move_position = frame.chess.clone();
                let m = decode_move(move_idx, &frame.chess)
                    .ok_or_else(|| invalid_data("Invalid move index for current position"))?;
                let san = SanPlus::from_move_and_play_unchecked(&mut frame.chess, &m).to_string();
                frame.pre_move_positions.push(pre_move_position);
                frame.nodes.push(DecodedGameNode::Move(san));
            }
        }
    }

    if stack.len() != 1 {
        return Err(invalid_data("Unclosed variation markers in encoded game"));
    }

    let root = stack
        .pop()
        .ok_or_else(|| invalid_data("Missing root decode frame at end of parsing"))?;
    Ok(DecodedGame { nodes: root.nodes })
}

#[derive(Clone, Copy)]
struct RenderState {
    move_number: u32,
    white_to_move: bool,
}

fn parse_initial_render_state(initial_fen: &Fen) -> RenderState {
    let fen_string = initial_fen.to_string();
    let mut fields = fen_string.split_whitespace();

    let _board = fields.next();
    let side_to_move = fields.next().unwrap_or("w");
    let move_number = fields
        .nth(3)
        .and_then(|field| field.parse::<u32>().ok())
        .unwrap_or(1);

    RenderState {
        move_number,
        white_to_move: side_to_move == "w",
    }
}

fn render_nodes(nodes: &[DecodedGameNode], state: &mut RenderState) -> String {
    let mut out = String::new();
    let mut prev_was_move = false;
    let mut last_pre_move_state = None;
    let mut has_emitted_move = false;
    let mut force_black_prefix = false;
    for node in nodes {
        match node {
            DecodedGameNode::Move(san) => {
                if !out.is_empty() {
                    out.push(' ');
                }

                let pre_move_state = *state;

                if state.white_to_move {
                    out.push_str(&state.move_number.to_string());
                    out.push_str(". ");
                    out.push_str(san);
                    state.white_to_move = false;
                } else {
                    if !has_emitted_move || force_black_prefix {
                        out.push_str(&state.move_number.to_string());
                        out.push_str("... ");
                    }
                    out.push_str(san);
                    state.white_to_move = true;
                    state.move_number = state.move_number.saturating_add(1);
                }

                last_pre_move_state = Some(pre_move_state);
                has_emitted_move = true;
                force_black_prefix = false;
                prev_was_move = true;
            }
            DecodedGameNode::Nag(nag) => {
                let rendered_nag = match nag.as_str() {
                    "$1" => "!",
                    "$2" => "?",
                    "$3" => "!!",
                    "$4" => "??",
                    "$5" => "!?",
                    "$6" => "?!",
                    _ => nag,
                };

                if rendered_nag.starts_with('$') {
                    if !out.is_empty() {
                        out.push(' ');
                    }
                    out.push_str(rendered_nag);
                } else if prev_was_move {
                    out.push_str(rendered_nag);
                } else {
                    if !out.is_empty() {
                        out.push(' ');
                    }
                    out.push_str(rendered_nag);
                }
                prev_was_move = false;
            }
            DecodedGameNode::Comment(comment) => {
                if !out.is_empty() {
                    out.push(' ');
                }
                out.push('{');
                out.push_str(comment);
                out.push('}');
                prev_was_move = false;
            }
            DecodedGameNode::Variation(children) => {
                if !out.is_empty() {
                    out.push(' ');
                }
                out.push('(');
                let mut variation_state = last_pre_move_state.unwrap_or(*state);
                out.push_str(&render_nodes(children, &mut variation_state));
                out.push(')');
                force_black_prefix = true;
                prev_was_move = false;
            }
        }
    }
    out
}

pub fn decode_game_to_movetext(moves_bytes: &[u8], initial_fen: Fen) -> Result<String, Error> {
    let render_state = parse_initial_render_state(&initial_fen);
    let decoded = decode_game(moves_bytes, initial_fen)?;
    let mut state = render_state;
    Ok(render_nodes(&decoded.nodes, &mut state))
}

#[cfg(test)]
mod tests {
    use super::*;

    use shakmaty::{Role, Square};

    #[test]
    fn test_encoding() {
        let mut chess = Chess::default();
        let m = Move::Normal {
            role: Role::Pawn,
            from: Square::E2,
            to: Square::E4,
            capture: None,
            promotion: None,
        };

        let byte = encode_move(&m, &chess).unwrap();
        let m2 = decode_move(byte, &chess).unwrap();
        assert_eq!(m, m2);

        chess.play_unchecked(&m);

        let m = Move::Normal {
            role: Role::Pawn,
            from: Square::E7,
            to: Square::E5,
            capture: None,
            promotion: None,
        };
        let byte = encode_move(&m, &chess).unwrap();
        let m2 = decode_move(byte, &chess).unwrap();
        assert_eq!(m, m2);
    }

    #[test]
    fn test_encode_illegal_move_returns_contextual_error() {
        let chess = Chess::default();
        let illegal_move = Move::Normal {
            role: Role::Pawn,
            from: Square::E2,
            to: Square::E5,
            capture: None,
            promotion: None,
        };

        let error = encode_move(&illegal_move, &chess).unwrap_err();
        assert_eq!(error.to_string(), "Move is not legal in the given position");
    }

    #[test]
    fn test_encode_checked_conversion_roundtrips_legal_move() {
        let chess = Chess::default();
        let legal_move = Move::Normal {
            role: Role::Knight,
            from: Square::G1,
            to: Square::F3,
            capture: None,
            promotion: None,
        };

        let encoded = encode_move(&legal_move, &chess).unwrap();
        assert_eq!(decode_move(encoded, &chess), Some(legal_move));
    }

    #[test]
    fn test_decode_game_rejects_invalid_initial_setup() {
        let missing_black_king: Fen = "8/8/8/8/8/8/8/K7 w - - 0 1".parse().unwrap();

        let error = decode_game(&[], missing_black_king).unwrap_err();
        assert!(error.to_string().starts_with("Invalid initial FEN setup:"));
    }

    #[test]
    fn test_mainline_iterator_ignores_variations_and_comments() {
        let bytes = vec![
            1,
            NAG_MARKER,
            2,
            0,
            b'!',
            b'!',
            VARIATION_START_MARKER,
            2,
            VARIATION_START_MARKER,
            3,
            VARIATION_END_MARKER,
            COMMENT_MARKER,
            3,
            0,
            b'f',
            b'o',
            b'o',
            4,
            VARIATION_END_MARKER,
            COMMENT_MARKER,
            3,
            0,
            b'b',
            b'a',
            b'r',
            5,
        ];

        let result: Vec<u8> = iter_mainline_move_bytes(&bytes).collect();
        assert_eq!(result, vec![1, 5]);
    }

    #[test]
    fn mainline_iterator_handles_exact_and_truncated_annotation_boundaries() {
        let exact_empty = [1, COMMENT_MARKER, 0, 0, 2, NAG_MARKER, 0, 0, 3];
        assert_eq!(
            iter_mainline_move_bytes(&exact_empty).collect::<Vec<_>>(),
            vec![1, 2, 3]
        );

        for truncated in [
            vec![1, COMMENT_MARKER],
            vec![1, COMMENT_MARKER, 0],
            vec![1, NAG_MARKER],
            vec![1, NAG_MARKER, 0],
        ] {
            assert_eq!(
                iter_mainline_move_bytes(&truncated).collect::<Vec<_>>(),
                vec![1]
            );
        }
    }

    #[test]
    fn test_decode_game_with_nags() {
        let mut bytes = Vec::new();
        let mut chess = Chess::default();
        let m = decode_move(12, &chess).unwrap();
        bytes.push(encode_move(&m, &chess).unwrap());
        chess.play_unchecked(&m);

        encode_nag("!", &mut bytes);
        bytes.push(VARIATION_START_MARKER);

        let mut variation = Chess::default();
        let v = decode_move(12, &variation).unwrap();
        bytes.push(encode_move(&v, &variation).unwrap());
        variation.play_unchecked(&v);
        encode_nag("$2", &mut bytes);
        bytes.push(VARIATION_END_MARKER);

        let m2 = decode_move(12, &chess).unwrap();
        bytes.push(encode_move(&m2, &chess).unwrap());
        encode_nag("$1", &mut bytes);

        let movetext = decode_game_to_movetext(&bytes, Fen::default()).unwrap();
        assert_eq!(movetext, "1. e4! (1. e4?) 1... e5!");
    }

    #[test]
    fn render_nodes_preserves_every_symbolic_and_custom_nag_spacing() {
        let mut state = RenderState {
            move_number: 1,
            white_to_move: true,
        };
        let nodes = vec![
            DecodedGameNode::Move("e4".into()),
            DecodedGameNode::Nag("$1".into()),
            DecodedGameNode::Move("e5".into()),
            DecodedGameNode::Nag("$2".into()),
            DecodedGameNode::Move("Nf3".into()),
            DecodedGameNode::Nag("$3".into()),
            DecodedGameNode::Move("Nc6".into()),
            DecodedGameNode::Nag("$4".into()),
            DecodedGameNode::Move("Bb5".into()),
            DecodedGameNode::Nag("$5".into()),
            DecodedGameNode::Move("a6".into()),
            DecodedGameNode::Nag("$6".into()),
            DecodedGameNode::Nag("$99".into()),
            DecodedGameNode::Comment("note".into()),
            DecodedGameNode::Nag("!!".into()),
        ];

        assert_eq!(
            render_nodes(&nodes, &mut state),
            "1. e4! e5? 2. Nf3!! Nc6?? 3. Bb5!? a6?! $99 {note} !!"
        );
    }

    #[test]
    fn decode_game_checks_exact_annotation_length_and_payload_boundaries() {
        for marker in [COMMENT_MARKER, NAG_MARKER] {
            assert!(decode_game(&[marker], Fen::default()).is_err());
            assert!(decode_game(&[marker, 0], Fen::default()).is_err());
            assert!(decode_game(&[marker, 1, 0], Fen::default()).is_err());

            let empty = decode_game(&[marker, 0, 0], Fen::default()).unwrap();
            let expected = if marker == COMMENT_MARKER {
                DecodedGameNode::Comment(String::new())
            } else {
                DecodedGameNode::Nag(String::new())
            };
            assert_eq!(empty.nodes, vec![expected]);
        }

        let chess = Chess::default();
        let legal_move = Move::Normal {
            role: Role::Pawn,
            from: Square::E2,
            to: Square::E4,
            capture: None,
            promotion: None,
        };
        let encoded_move = encode_move(&legal_move, &chess).unwrap();
        let bytes = [COMMENT_MARKER, 1, 0, b'x', encoded_move];
        assert_eq!(
            decode_game(&bytes, Fen::default()).unwrap().nodes,
            vec![
                DecodedGameNode::Comment("x".into()),
                DecodedGameNode::Move("e4".into())
            ]
        );

        let bytes = [NAG_MARKER, 1, 0, b'!', encoded_move];
        assert_eq!(
            decode_game(&bytes, Fen::default()).unwrap().nodes,
            vec![
                DecodedGameNode::Nag("!".into()),
                DecodedGameNode::Move("e4".into())
            ]
        );
    }

    #[test]
    fn test_decode_game_plain_mainline() {
        let mut chess = Chess::default();
        let mut bytes = Vec::new();

        let first = Move::Normal {
            role: Role::Pawn,
            from: Square::E2,
            to: Square::E4,
            capture: None,
            promotion: None,
        };
        bytes.push(encode_move(&first, &chess).unwrap());
        chess.play_unchecked(&first);

        let second = Move::Normal {
            role: Role::Pawn,
            from: Square::E7,
            to: Square::E5,
            capture: None,
            promotion: None,
        };
        bytes.push(encode_move(&second, &chess).unwrap());
        chess.play_unchecked(&second);

        let third = Move::Normal {
            role: Role::Knight,
            from: Square::G1,
            to: Square::F3,
            capture: None,
            promotion: None,
        };
        bytes.push(encode_move(&third, &chess).unwrap());
        chess.play_unchecked(&third);

        let fourth = Move::Normal {
            role: Role::Knight,
            from: Square::B8,
            to: Square::C6,
            capture: None,
            promotion: None,
        };
        bytes.push(encode_move(&fourth, &chess).unwrap());

        let movetext = decode_game_to_movetext(&bytes, Fen::default()).unwrap();
        assert_eq!(movetext, "1. e4 e5 2. Nf3 Nc6");
    }

    #[test]
    fn test_decode_game_comment_does_not_force_black_ellipsis() {
        let mut chess = Chess::default();
        let mut bytes = Vec::new();

        let white_move = Move::Normal {
            role: Role::Pawn,
            from: Square::E2,
            to: Square::E4,
            capture: None,
            promotion: None,
        };
        bytes.push(encode_move(&white_move, &chess).unwrap());
        chess.play_unchecked(&white_move);

        encode_comment("mainline", &mut bytes);

        let black_move = Move::Normal {
            role: Role::Pawn,
            from: Square::E7,
            to: Square::E5,
            capture: None,
            promotion: None,
        };
        bytes.push(encode_move(&black_move, &chess).unwrap());

        let movetext = decode_game_to_movetext(&bytes, Fen::default()).unwrap();
        assert_eq!(movetext, "1. e4 {mainline} e5");
    }

    #[test]
    fn test_decode_game_starts_with_black_move_numbering() {
        let initial_fen: Fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1"
            .parse()
            .unwrap();
        let chess = Chess::from_setup(initial_fen.clone().into(), CastlingMode::Chess960)
            .or_else(PositionError::ignore_too_much_material)
            .unwrap();

        let black_pawn_push = Move::Normal {
            role: Role::Pawn,
            from: Square::E7,
            to: Square::E5,
            capture: None,
            promotion: None,
        };
        let bytes = vec![encode_move(&black_pawn_push, &chess).unwrap()];

        let movetext = decode_game_to_movetext(&bytes, initial_fen).unwrap();
        assert_eq!(movetext, "1... e5");
    }

    #[test]
    fn test_decode_game_nested_variations_and_comments() {
        let mut bytes = Vec::new();

        let mut root = Chess::default();
        let branch_root = root.clone();
        let m_e4 = decode_move(12, &root).unwrap();
        bytes.push(encode_move(&m_e4, &root).unwrap());
        root.play_unchecked(&m_e4);

        encode_comment("hello", &mut bytes);

        bytes.push(VARIATION_START_MARKER);
        let mut var = branch_root.clone();
        let var_branch_root = var.clone();
        let m_var_first = decode_move(12, &var).unwrap();
        bytes.push(encode_move(&m_var_first, &var).unwrap());
        var.play_unchecked(&m_var_first);

        bytes.push(VARIATION_START_MARKER);
        let m_var_nested = decode_move(0, &var_branch_root).unwrap();
        bytes.push(encode_move(&m_var_nested, &var_branch_root).unwrap());
        bytes.push(VARIATION_END_MARKER);

        encode_comment("nest", &mut bytes);
        bytes.push(VARIATION_END_MARKER);

        let m_mainline_second = decode_move(12, &root).unwrap();
        bytes.push(encode_move(&m_mainline_second, &root).unwrap());

        let decoded = decode_game(&bytes, Fen::default()).unwrap();

        let expected_first = SanPlus::from_move(Chess::default(), &m_e4).to_string();
        let expected_var_first = SanPlus::from_move(root.clone(), &m_var_first).to_string();
        let expected_nested = SanPlus::from_move(var_branch_root, &m_var_nested).to_string();
        let expected_mainline_second = SanPlus::from_move(root, &m_mainline_second).to_string();

        assert_eq!(
            decoded.nodes,
            vec![
                DecodedGameNode::Move(expected_first),
                DecodedGameNode::Comment("hello".to_string()),
                DecodedGameNode::Variation(vec![
                    DecodedGameNode::Move(expected_var_first),
                    DecodedGameNode::Variation(vec![DecodedGameNode::Move(expected_nested)]),
                    DecodedGameNode::Comment("nest".to_string()),
                ]),
                DecodedGameNode::Move(expected_mainline_second),
            ]
        );
    }

    #[test]
    fn fallible_mainline_iterator_rejects_truncated_and_unbalanced_streams() {
        assert!(try_iter_mainline_move_bytes(&[COMMENT_MARKER, 4, 0, b'x']).is_err());
        assert!(try_iter_mainline_move_bytes(&[NAG_MARKER, 1]).is_err());
        assert!(try_iter_mainline_move_bytes(&[VARIATION_END_MARKER]).is_err());
        assert!(try_iter_mainline_move_bytes(&[VARIATION_START_MARKER, 0]).is_err());
    }
}
