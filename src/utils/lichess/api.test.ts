import { beforeEach, describe, expect, test, vi } from "vitest";
import { cancellationError } from "@/platform/tauri";

const mocks = vi.hoisted(() => ({
    logError: vi.fn(),
    getPublicLichessJson: vi.fn(),
    lexPgn: vi.fn(),
}));

vi.mock("@/platform/native", () => ({
    error: mocks.logError,
}));

vi.mock("@/platform/tauri", async () => {
    const actual = await vi.importActual<typeof import("@/platform/tauri")>("@/platform/tauri");
    return {
        ...actual,
        tauri: {
            ...actual.tauri,
            getPublicLichessJson: mocks.getPublicLichessJson,
            lexPgn: mocks.lexPgn,
        },
    };
});

import { convertToNormalized } from "./api";

describe("convertToNormalized", () => {
    beforeEach(() => {
        mocks.logError.mockReset().mockResolvedValue(undefined);
        mocks.getPublicLichessJson.mockReset();
        mocks.lexPgn.mockReset();
    });

    const dummyGames = [
        {
            id: "game-0",
            uci: "e2e4",
            winner: null,
            speed: "blitz",
            mode: "rated",
            white: { name: "W0", rating: 1500 },
            black: { name: "B0", rating: 1500 },
            year: 2024,
            month: "01",
        },
        {
            id: "game-1",
            uci: "e2e4",
            winner: null,
            speed: "blitz",
            mode: "rated",
            white: { name: "W1", rating: 1600 },
            black: { name: "B1", rating: 1600 },
            year: 2024,
            month: "02",
        },
        {
            id: "game-2",
            uci: "e2e4",
            winner: null,
            speed: "blitz",
            mode: "rated",
            white: { name: "W2", rating: 1700 },
            black: { name: "B2", rating: 1700 },
            year: 2024,
            month: "03",
        },
        {
            id: "game-3",
            uci: "e2e4",
            winner: null,
            speed: "blitz",
            mode: "rated",
            white: { name: "W3", rating: 1800 },
            black: { name: "B3", rating: 1800 },
            year: 2024,
            month: "04",
        },
    ];

    test("retains successful siblings and logs diagnostic for ordinary failures", async () => {
        mocks.getPublicLichessJson.mockImplementation(async ({ game_id }: { game_id: string }) => {
            if (game_id === "game-1") throw new Error("Network timeout");
            return `[White "${game_id}"]\n[Black "Opponent"]\n\n1. e4 e5 *`;
        });

        mocks.lexPgn.mockImplementation(async (pgn: string) => {
            if (pgn.includes("game-2")) throw new Error("Invalid PGN syntax");
            return [];
        });

        const normalized = await convertToNormalized(dummyGames);
        expect(normalized).toHaveLength(2);
        expect(normalized[0].id).toBe(0);
        expect(normalized[1].id).toBe(3);
        expect(mocks.logError).toHaveBeenCalledTimes(2);
        expect(mocks.logError).toHaveBeenNthCalledWith(
            1,
            expect.stringContaining("Lichess game normalization item 1 failed"),
        );
        expect(mocks.logError).toHaveBeenNthCalledWith(
            2,
            expect.stringContaining("Lichess game normalization item 2 failed"),
        );
    });

    test("checkpoint 2: abort signal after getLichessGame PGN fetch before parsePGN rejects without diagnostic", async () => {
        const controller = new AbortController();

        mocks.getPublicLichessJson.mockImplementation(async () => {
            controller.abort();
            return `[White "Player"]\n[Black "Opponent"]\n\n1. e4 e5 *`;
        });

        const promise = convertToNormalized([dummyGames[0]], { signal: controller.signal });
        await expect(promise).rejects.toMatchObject({ name: "AbortError" });
        expect(mocks.lexPgn).not.toHaveBeenCalled();
        expect(mocks.logError).not.toHaveBeenCalled();
    });

    test("mixed completed/cancelled parses: rejection on cancellation without diagnostic or partial results", async () => {
        const controller = new AbortController();

        mocks.getPublicLichessJson.mockResolvedValue(`[White "P"]\n[Black "O"]\n\n1. e4 e5 *`);
        mocks.lexPgn.mockImplementation(
            async (_pgn: string, _options?: { signal?: AbortSignal }) => {
                if (mocks.lexPgn.mock.calls.length === 1) {
                    return []; // game 0 completes
                }
                // game 1 gets cancelled during lexing
                controller.abort();
                throw cancellationError();
            },
        );

        const promise = convertToNormalized(dummyGames, { signal: controller.signal });
        await expect(promise).rejects.toThrow("Cancellation");
        expect(mocks.logError).not.toHaveBeenCalled();
    });
});
