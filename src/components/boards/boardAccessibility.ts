import type { TFunction } from "i18next";
import { match } from "ts-pattern";
import type { Piece, SquareName } from "chessops";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;

/** Visual order must match both Chessground and the semantic grid. */
export function accessibleBoardGrid(orientation: "white" | "black"): SquareName[][] {
    const files = orientation === "white" ? FILES : [...FILES].reverse();
    const ranks = orientation === "white" ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
    return ranks.map((rank) => files.map((file) => `${file}${rank}` as SquareName));
}

export function boardColorLabel(t: TFunction, color: Piece["color"]): string {
    return match(color)
        .with("white", () => t("Board.Aria.Color.white"))
        .with("black", () => t("Board.Aria.Color.black"))
        .exhaustive();
}

function boardPieceTypeLabel(t: TFunction, role: Piece["role"]): string {
    return match(role)
        .with("pawn", () => t("Board.Aria.PieceType.pawn"))
        .with("knight", () => t("Board.Aria.PieceType.knight"))
        .with("bishop", () => t("Board.Aria.PieceType.bishop"))
        .with("rook", () => t("Board.Aria.PieceType.rook"))
        .with("queen", () => t("Board.Aria.PieceType.queen"))
        .with("king", () => t("Board.Aria.PieceType.king"))
        .exhaustive();
}

export function accessibleSquareLabel(
    t: TFunction,
    square: SquareName,
    piece: Piece | undefined,
    selected: boolean,
): string {
    const pieceLabel = piece
        ? t("Board.Aria.Piece", {
              color: boardColorLabel(t, piece.color),
              piece: boardPieceTypeLabel(t, piece.role),
          })
        : t("Board.Aria.EmptySquare");

    return t("Board.Aria.Square", {
        square,
        piece: pieceLabel,
        selected: selected ? t("Board.Aria.MoveSourceSelected") : "",
    });
}
