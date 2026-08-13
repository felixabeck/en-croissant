import type { SquareName } from "chessops";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;

/** Visual order must match both Chessground and the semantic grid. */
export function accessibleBoardGrid(orientation: "white" | "black"): SquareName[][] {
    const files = orientation === "white" ? FILES : [...FILES].reverse();
    const ranks = orientation === "white" ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
    return ranks.map((rank) => files.map((file) => `${file}${rank}` as SquareName));
}
