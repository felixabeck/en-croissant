import { describe, expect, test } from "vitest";
import {
    decodeCounter,
    encodeCounter,
    normalizeClockUpdateEvent,
    normalizeGameMoveEvent,
    normalizeGameOverEvent,
    normalizeGameState,
} from "./tauri";

const baseState = {
    gameId: "game",
    session: 0,
    revision: Number.MAX_SAFE_INTEGER,
    status: "playing" as const,
    initialFen: "start",
    moves: [],
    currentFen: "start",
    ply: 0,
    turn: "white",
    whiteTime: null,
    blackTime: null,
    whitePlayer: "White",
    blackPlayer: "Black",
};

describe("game counter transport", () => {
    test("accepts zero, max-safe wire numbers and valid bigint fixtures", () => {
        expect(decodeCounter(0, "session")).toBe(0n);
        expect(decodeCounter(Number.MAX_SAFE_INTEGER, "revision")).toBe(
            BigInt(Number.MAX_SAFE_INTEGER),
        );
        expect(decodeCounter(7n, "session")).toBe(7n);
        expect(encodeCounter(0n, "expectedSession")).toBe(0);
        expect(encodeCounter(BigInt(Number.MAX_SAFE_INTEGER), "expectedSession")).toBe(
            Number.MAX_SAFE_INTEGER,
        );
    });

    test.each([-1, -1n, 1.5, Number.MAX_SAFE_INTEGER + 1, "1", null])(
        "rejects malformed counter %s",
        (value) => {
            expect(() => decodeCounter(value, "session")).toThrow(/nonnegative safe integer/);
        },
    );

    test.each([-1n, BigInt(Number.MAX_SAFE_INTEGER) + 1n])("refuses outgoing counter %s", (value) =>
        expect(() => encodeCounter(value, "expectedSession")).toThrow(/nonnegative safe integer/),
    );

    test("normalizes command and all game event counter pairs", () => {
        expect(normalizeGameState(baseState)).toMatchObject({
            session: 0n,
            revision: 9007199254740991n,
        });
        expect(
            normalizeGameMoveEvent({
                gameId: "game",
                session: 1,
                revision: 2,
                moves: [],
                fen: "start",
                whiteTime: null,
                blackTime: null,
            }),
        ).toMatchObject({ session: 1n, revision: 2n });
        expect(
            normalizeClockUpdateEvent({
                gameId: "game",
                session: 3,
                revision: 4,
                whiteTime: null,
                blackTime: null,
            }),
        ).toMatchObject({ session: 3n, revision: 4n });
        expect(
            normalizeGameOverEvent({
                gameId: "game",
                session: 5,
                revision: 6,
                result: { type: "draw", reason: "stalemate" },
                moves: [],
            }),
        ).toMatchObject({ session: 5n, revision: 6n });
    });
});
