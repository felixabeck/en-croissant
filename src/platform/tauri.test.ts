import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    closeSplashscreen: vi.fn(),
    startGame: vi.fn(),
    getGameState: vi.fn(),
    makeGameMove: vi.fn(),
    takeBackGameMove: vi.fn(),
    resignGame: vi.fn(),
    abortGame: vi.fn(),
    getGameEngineLogs: vi.fn(),
    prepareNativeRead: vi.fn(),
    cancelNativeRead: vi.fn(),
    getGames: vi.fn(),
    logError: vi.fn(),
    listeners: new Map<string, (event: any) => void>(),
}));

vi.mock("./native", () => ({ error: mocks.logError }));

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
        prepareNativeRead: mocks.prepareNativeRead,
        cancelNativeRead: mocks.cancelNativeRead,
        getGames: mocks.getGames,
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
    beforeEach(() => {
        mocks.prepareNativeRead.mockReset();
        mocks.cancelNativeRead.mockReset();
        mocks.getGames.mockReset();
        mocks.logError.mockReset().mockResolvedValue(undefined);
    });
    test("a signal reserves a ticket and passes it outside positional arguments", async () => {
        mocks.prepareNativeRead.mockResolvedValue({ status: "ok", data: "ticket-1" });
        mocks.getGames.mockResolvedValue({ status: "ok", data: { data: [], count: 0 } });
        const signal = new AbortController().signal;
        await tauri.getGames({ id: { id: "db" }, kind: "database" }, {} as never, { signal });
        expect(mocks.getGames).toHaveBeenCalledWith(
            { id: { id: "db" }, kind: "database" },
            {},
            "ticket-1",
        );
    });

    test("abort before preparation rejects without native dispatch", async () => {
        const controller = new AbortController();
        controller.abort();
        await expect(
            tauri.getGames({ id: { id: "db" }, kind: "database" }, {} as never, {
                signal: controller.signal,
            }),
        ).rejects.toMatchObject({ details: { category: "cancelled" } });
        expect(mocks.prepareNativeRead).not.toHaveBeenCalled();
        expect(mocks.getGames).not.toHaveBeenCalled();
    });

    test("abort during preparation cancels the eventual reservation without dispatch", async () => {
        const controller = new AbortController();
        let finishPreparation!: (value: unknown) => void;
        mocks.prepareNativeRead.mockReturnValue(
            new Promise((resolve) => {
                finishPreparation = resolve;
            }),
        );
        mocks.cancelNativeRead.mockResolvedValue({ status: "ok", data: null });
        const result = tauri.getGames({ id: { id: "db" }, kind: "database" }, {} as never, {
            signal: controller.signal,
        });
        controller.abort();
        finishPreparation({ status: "ok", data: "late-ticket" });
        await expect(result).rejects.toMatchObject({ details: { category: "cancelled" } });
        expect(mocks.cancelNativeRead).toHaveBeenCalledWith("late-ticket");
        expect(mocks.getGames).not.toHaveBeenCalled();
    });

    test("failed preparation removes its abort listener without issuing cleanup", async () => {
        const controller = new AbortController();
        const remove = vi.spyOn(controller.signal, "removeEventListener");
        mocks.prepareNativeRead.mockRejectedValue(new Error("prepare failed"));
        await expect(
            tauri.getGames({ id: { id: "db" }, kind: "database" }, {} as never, {
                signal: controller.signal,
            }),
        ).rejects.toThrow("prepare failed");
        expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
        expect(mocks.cancelNativeRead).not.toHaveBeenCalled();
        expect(mocks.getGames).not.toHaveBeenCalled();
    });

    test("active abort cancels exactly its ticket and cannot return buffered success", async () => {
        const controller = new AbortController();
        mocks.prepareNativeRead.mockResolvedValue({ status: "ok", data: "active-ticket" });
        mocks.cancelNativeRead.mockResolvedValue({ status: "ok", data: null });
        let finishCommand!: (value: unknown) => void;
        mocks.getGames.mockReturnValue(new Promise((resolve) => (finishCommand = resolve)));
        const result = tauri.getGames({ id: { id: "db" }, kind: "database" }, {} as never, {
            signal: controller.signal,
        });
        await Promise.resolve();
        controller.abort();
        finishCommand({ status: "ok", data: { data: [], count: 0 } });
        await expect(result).rejects.toMatchObject({ details: { category: "cancelled" } });
        expect(mocks.cancelNativeRead).toHaveBeenCalledOnce();
        expect(mocks.cancelNativeRead).toHaveBeenCalledWith("active-ticket");
    });

    test("simultaneous owners cancel independently", async () => {
        const first = new AbortController();
        const second = new AbortController();
        mocks.prepareNativeRead
            .mockResolvedValueOnce({ status: "ok", data: "ticket-first" })
            .mockResolvedValueOnce({ status: "ok", data: "ticket-second" });
        mocks.cancelNativeRead.mockResolvedValue({ status: "ok", data: null });
        const completions = new Map<string, (value: unknown) => void>();
        mocks.getGames.mockImplementation(
            (_file: unknown, _query: unknown, ticket: string) =>
                new Promise((resolve) => completions.set(ticket, resolve)),
        );
        const firstResult = tauri.getGames({ id: { id: "first" }, kind: "database" }, {} as never, {
            signal: first.signal,
        });
        const secondResult = tauri.getGames(
            { id: { id: "second" }, kind: "database" },
            {} as never,
            { signal: second.signal },
        );
        await vi.waitFor(() => expect(completions.size).toBe(2));
        first.abort();
        completions.get("ticket-first")!({ status: "ok", data: { data: [], count: 0 } });
        completions.get("ticket-second")!({ status: "ok", data: { data: [], count: 0 } });
        await expect(firstResult).rejects.toMatchObject({ details: { category: "cancelled" } });
        await expect(secondResult).resolves.toEqual({ data: [], count: 0 });
        expect(mocks.cancelNativeRead).toHaveBeenCalledOnce();
        expect(mocks.cancelNativeRead).toHaveBeenCalledWith("ticket-first");
    });

    test("completion before abort retires the listener without native cancellation", async () => {
        const controller = new AbortController();
        mocks.prepareNativeRead.mockResolvedValue({ status: "ok", data: "completed-ticket" });
        mocks.getGames.mockResolvedValue({ status: "ok", data: { data: [], count: 0 } });
        await expect(
            tauri.getGames({ id: { id: "db" }, kind: "database" }, {} as never, {
                signal: controller.signal,
            }),
        ).resolves.toEqual({ data: [], count: 0 });
        controller.abort();
        await Promise.resolve();
        expect(mocks.cancelNativeRead).not.toHaveBeenCalled();
    });

    test("generated command errors clean up their claimed reservation", async () => {
        mocks.prepareNativeRead.mockResolvedValue({ status: "ok", data: "failed-ticket" });
        mocks.cancelNativeRead.mockResolvedValue({ status: "ok", data: null });
        mocks.getGames.mockResolvedValue({
            status: "error",
            error: { tag: "backend-error", category: "conflict", message: "claim failed" },
        });
        await expect(
            tauri.getGames({ id: { id: "db" }, kind: "database" }, {} as never, {
                signal: new AbortController().signal,
            }),
        ).rejects.toMatchObject({ details: { category: "validation" } });
        expect(mocks.cancelNativeRead).toHaveBeenCalledWith("failed-ticket");
    });

    test("cleanup rejection preserves the primary error and logs the secondary", async () => {
        mocks.prepareNativeRead.mockResolvedValue({ status: "ok", data: "cleanup-ticket" });
        mocks.cancelNativeRead.mockResolvedValue({ status: "error", error: "cleanup failed" });
        mocks.getGames.mockResolvedValue({ status: "error", error: "primary failed" });
        await expect(
            tauri.getGames({ id: { id: "db" }, kind: "database" }, {} as never, {
                signal: new AbortController().signal,
            }),
        ).rejects.toThrow("primary failed");
        expect(mocks.logError).toHaveBeenCalledOnce();
        expect(mocks.logError.mock.calls[0][0]).toContain("cleanup-ticket");
    });
    test("rejected cleanup logger uses safe fallback without changing the primary error", async () => {
        const fallback = vi.spyOn(console, "error").mockImplementation(() => undefined);
        mocks.prepareNativeRead.mockResolvedValue({ status: "ok", data: "fallback-ticket" });
        mocks.cancelNativeRead.mockResolvedValue({ status: "error", error: "cleanup failed" });
        mocks.logError.mockRejectedValue(new Error("logger failed"));
        mocks.getGames.mockResolvedValue({ status: "error", error: "primary failed" });
        await expect(
            tauri.getGames({ id: { id: "db" }, kind: "database" }, {} as never, {
                signal: new AbortController().signal,
            }),
        ).rejects.toThrow("primary failed");
        expect(fallback).toHaveBeenCalledWith(
            "Native read cleanup logging failed",
            expect.objectContaining({ message: "logger failed" }),
        );
        fallback.mockRestore();
    });
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
        await expect(tauri.makeGameMove("game", 2n, "e2e4")).resolves.toMatchObject({
            session: 1n,
            revision: 2n,
        });
        await expect(tauri.takeBackGameMove("game", 3n)).resolves.toMatchObject({
            session: 1n,
            revision: 2n,
        });
        await expect(tauri.resignGame("game", 4n, "white")).resolves.toMatchObject({
            session: 1n,
            revision: 2n,
        });
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
        await expect(tauri.startGame("game", config)).resolves.toMatchObject({
            session: 1n,
            revision: 2n,
        });
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
