import { describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    closeSplashscreen: vi.fn(),
    startGame: vi.fn(),
    getGameState: vi.fn(),
    makeGameMove: vi.fn(),
    takeBackGameMove: vi.fn(),
    resignGame: vi.fn(),
    abortGame: vi.fn(),
    getGameEngineLogs: vi.fn(),
    listeners: new Map<string, (event: any) => void>(),
}));

vi.mock("@/bindings/generated", () => ({
    commands: {
        closeSplashscreen: mocks.closeSplashscreen,
        startGame: mocks.startGame,
        getGameState: mocks.getGameState,
        makeGameMove: mocks.makeGameMove,
        takeBackGameMove: mocks.takeBackGameMove,
        resignGame: mocks.resignGame,
        abortGame: mocks.abortGame,
        getGameEngineLogs: mocks.getGameEngineLogs,
    },
    events: Object.fromEntries(
        ["clockUpdateEvent", "gameMoveEvent", "gameOverEvent"].map((name) => [
            name,
            {
                listen: vi.fn(async (callback) => {
                    mocks.listeners.set(name, callback);
                    return vi.fn();
                }),
            },
        ]),
    ),
}));

import { normalizeError } from "./errors";
import { TauriCommandError, tauri, tauriSubscriptions, unwrapCommand } from "./tauri";

const wireState = {
    gameId: "game",
    session: 1,
    revision: 2,
    status: "playing",
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

describe("tauri command facade", () => {
    test("returns command payloads instead of generated Result wrappers", async () => {
        mocks.closeSplashscreen.mockResolvedValue({ status: "ok", data: null });
        await expect(tauri.closeSplashscreen()).resolves.toBeNull();
    });

    test("normalizes and redacts generated errors", async () => {
        mocks.closeSplashscreen.mockResolvedValue({
            status: "error",
            error: "Bearer secret-value at /home/user/private.pgn",
        });
        let caught: unknown;
        try {
            await tauri.closeSplashscreen();
        } catch (error) {
            caught = error;
        }
        expect(caught).toBeInstanceOf(TauriCommandError);
        const error = caught as TauriCommandError;
        expect(error.message).not.toContain("secret-value");
        expect(error.message).not.toContain("/home/user");
        expect(error.message).not.toContain("$1");
        expect(error.details).toBe(normalizeError(error));
    });

    test("maps a generated ErrorPayload through unwrapCommand", () => {
        const result = {
            status: "error" as const,
            error: {
                tag: "backend-error" as const,
                category: "permission" as const,
                message: "denied at /private/secret",
            },
        };
        let caught: unknown;
        try {
            unwrapCommand(result);
        } catch (error) {
            caught = error;
        }
        expect(caught).toBeInstanceOf(TauriCommandError);
        const commandError = caught as TauriCommandError;
        expect(commandError.details).toEqual({
            category: "permission",
            backendCategory: "permission",
            message: "denied at [path]",
        });
        expect(commandError.message).toBe("denied at [path]");
        expect(commandError.message).not.toContain("/private/secret");
    });

    test("rethrows an already-normalised TauriCommandError", async () => {
        const inner = new TauriCommandError("Bearer secret-value at /home/user/private.pgn");
        mocks.closeSplashscreen.mockRejectedValue(inner);
        let caught: unknown;
        try {
            await tauri.closeSplashscreen();
        } catch (error) {
            caught = error;
        }
        expect(caught).toBe(inner);
    });

    test("normalizes game replies and encodes all six expected sessions as safe numbers", async () => {
        for (const command of [
            mocks.getGameState,
            mocks.makeGameMove,
            mocks.takeBackGameMove,
            mocks.resignGame,
        ]) {
            command.mockResolvedValue({ status: "ok", data: wireState });
        }
        mocks.abortGame.mockResolvedValue({ status: "ok", data: null });
        mocks.getGameEngineLogs.mockResolvedValue({ status: "ok", data: [] });

        await expect(tauri.getGameState("game", 1n)).resolves.toMatchObject({
            session: 1n,
            revision: 2n,
        });
        await tauri.makeGameMove("game", 2n, "e2e4");
        await tauri.takeBackGameMove("game", 3n);
        await tauri.resignGame("game", 4n, "white");
        await tauri.abortGame("game", 5n);
        await tauri.getGameEngineLogs("game", 6n, "black");
        expect(mocks.getGameState).toHaveBeenCalledWith("game", 1);
        expect(mocks.makeGameMove).toHaveBeenCalledWith("game", 2, "e2e4");
        expect(mocks.takeBackGameMove).toHaveBeenCalledWith("game", 3);
        expect(mocks.resignGame).toHaveBeenCalledWith("game", 4, "white");
        expect(mocks.abortGame).toHaveBeenCalledWith("game", 5);
        expect(mocks.getGameEngineLogs).toHaveBeenCalledWith("game", 6, "black");
        expect(() => JSON.stringify(mocks.abortGame.mock.calls.at(-1))).not.toThrow();
    });

    test("start uses numeric config unchanged and unrelated commands remain untouched", async () => {
        mocks.startGame.mockResolvedValue({ status: "ok", data: wireState });
        mocks.closeSplashscreen.mockResolvedValue({ status: "ok", data: null });
        const config = {
            white: { type: "human" as const, name: "White" },
            black: { type: "human" as const, name: "Black" },
            whiteTimeControl: { initialTime: 60_000, increment: 1_000 },
            blackTimeControl: { initialTime: 60_000, increment: 1_000 },
            initialFen: null,
            initialMoves: [],
            openingBook: { book: { id: { id: "book" }, kind: "openingBook" as const }, maxPly: 24 },
        };
        await expect(tauri.startGame("game", config)).resolves.toMatchObject({ session: 1n });
        expect(mocks.startGame).toHaveBeenCalledWith("game", config);
        expect(() => JSON.stringify(mocks.startGame.mock.calls[0])).not.toThrow();
        await tauri.closeSplashscreen();
        expect(mocks.closeSplashscreen).toHaveBeenCalledWith();
    });

    test("drops malformed game events and reports the original envelope once", async () => {
        const cases = [
            ["clockUpdate", "clockUpdateEvent", { ...wireState, session: -1 }],
            ["gameMove", "gameMoveEvent", { ...wireState, session: Number.MAX_SAFE_INTEGER + 1 }],
            ["gameOver", "gameOverEvent", { ...wireState, revision: "bad" }],
        ] as const;
        for (const [subscription, eventName, payload] of cases) {
            const callback = vi.fn();
            const onError = vi.fn();
            await tauriSubscriptions[subscription](callback, onError);
            const envelope = { payload, id: 9 };
            mocks.listeners.get(eventName)?.(envelope);
            expect(callback).not.toHaveBeenCalled();
            expect(onError).toHaveBeenCalledOnce();
            expect(onError.mock.calls[0][1]).toBe(envelope);
        }
    });
});
