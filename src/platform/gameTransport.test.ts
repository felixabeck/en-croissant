import { describe, expect, test } from "vitest";
import {
    decodeGameCounter,
    encodeGameCounter,
    normalizeClockUpdateEvent,
    normalizeGameMoveEvent,
    normalizeGameOverEvent,
    normalizeGameState,
} from "./gameTransport";

const baseState = {
    gameId: "game",
    session: 0 as unknown as bigint,
    revision: Number.MAX_SAFE_INTEGER as unknown as bigint,
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
        expect(decodeGameCounter(0, "session")).toBe(0n);
        expect(decodeGameCounter(Number.MAX_SAFE_INTEGER, "revision")).toBe(
            BigInt(Number.MAX_SAFE_INTEGER),
        );
        expect(decodeGameCounter(7n, "session")).toBe(7n);
        expect(encodeGameCounter(0n)).toBe(0);
        expect(encodeGameCounter(BigInt(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER);
    });

    test.each([-1, -1n, 1.5, Number.MAX_SAFE_INTEGER + 1, "1", null])(
        "rejects malformed counter %s",
        (value) => {
            expect(() => decodeGameCounter(value, "session")).toThrow(/nonnegative safe integer/);
        },
    );

    test.each([-1n, BigInt(Number.MAX_SAFE_INTEGER) + 1n])("refuses outgoing counter %s", (value) =>
        expect(() => encodeGameCounter(value)).toThrow(/nonnegative safe integer/),
    );

    test("normalizes command and all game event counter pairs", () => {
        expect(normalizeGameState(baseState)).toMatchObject({
            session: 0n,
            revision: 9007199254740991n,
        });
        expect(
            normalizeGameMoveEvent({
                gameId: "game",
                session: 1 as unknown as bigint,
                revision: 2 as unknown as bigint,
                moves: [],
                fen: "start",
                whiteTime: null,
                blackTime: null,
            }),
        ).toMatchObject({ session: 1n, revision: 2n });
        expect(
            normalizeClockUpdateEvent({
                gameId: "game",
                session: 3 as unknown as bigint,
                revision: 4 as unknown as bigint,
                whiteTime: null,
                blackTime: null,
            }),
        ).toMatchObject({ session: 3n, revision: 4n });
        expect(
            normalizeGameOverEvent({
                gameId: "game",
                session: 5 as unknown as bigint,
                revision: 6 as unknown as bigint,
                result: { type: "draw", reason: "stalemate" },
                moves: [],
            }),
        ).toMatchObject({ session: 5n, revision: 6n });
    });
});
