import { INITIAL_FEN } from "chessops/fen";
import { expect, test } from "vitest";
import { analysisSearch } from "./analysisSearch";

test("normal keys preserve root FEN and move sequence while threat keys swap the final position", () => {
    const moves = ["e2e4", "e7e5"];
    const normal = analysisSearch(INITIAL_FEN, moves, false);
    expect(normal.searchingFen).toBe(INITIAL_FEN);
    expect(normal.searchingMoves).toEqual(moves);
    expect(normal.key).toBe(`${INITIAL_FEN}:e2e4,e7e5`);
    expect(normal.finalFen).toBe("rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2");
    const threat = analysisSearch(INITIAL_FEN, moves, true);
    expect(threat.key).toBe("rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2:");
    expect(threat.searchingMoves).toEqual([]);
    expect(threat.position?.turn).toBe("white");
});

test("black-root move numbering and en-passant survive searched-key derivation", () => {
    const fen = "rnbqkbnr/pppppppp/8/4P3/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 7";
    const normal = analysisSearch(fen, ["d7d5"], false);
    expect(normal.key).toBe(`${fen}:d7d5`);
    expect(normal.finalFen).toBe("rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 8");
    expect(analysisSearch(fen, ["d7d5"], true).key).toBe(
        "rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR b KQkq d6 0 8:",
    );
});

test("invalid FEN uses the existing threat fallback and an unparsable move stops derivation", () => {
    const invalid = analysisSearch("invalid", ["e2e4"], true);
    expect(invalid.position).toBeNull();
    expect(invalid.finalFen).toBeNull();
    expect(invalid.key).toBe("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1:");
    const stopped = analysisSearch(INITIAL_FEN, ["bad", "e2e4"], false);
    expect(stopped.finalFen).toBe(INITIAL_FEN);
    expect(stopped.key).toBe(`${INITIAL_FEN}:bad,e2e4`);
});
