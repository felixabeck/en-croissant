import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { TauriCommandError } from "@/platform/tauri";
import { catalogueI18n, shippedCatalogues } from "@/tests/catalogues";
import { MissingLocalEngineError } from "./playerConfig";
import {
    createGameCommandError,
    recordGameCommandError,
    translateGameCommandError,
    type GameCommand,
} from "./gameCommandError";

const mocks = vi.hoisted(() => ({ logError: vi.fn() }));
vi.mock("@/platform/native", () => ({ error: mocks.logError }));

const operationKeys = {
    start: "Board.Opponent.Error.Start",
    move: "Board.Opponent.Error.Move",
    takeback: "Board.Opponent.Error.Takeback",
    abort: "Board.Opponent.Error.Abort",
    resign: "Board.Opponent.Error.Resign",
} as const satisfies Record<GameCommand, string>;

beforeEach(() => {
    mocks.logError.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
    vi.restoreAllMocks();
});

test("typed player validation keeps its semantic identity and sanitized diagnostic", () => {
    const result = createGameCommandError(
        "start",
        new MissingLocalEngineError("engine missing at /private/engine.bin"),
    );

    expect(result).toEqual({
        kind: "validation",
        code: "missing-local-engine",
        diagnostic: "engine missing at [path]",
    });
});

test.each(["start", "move", "takeback", "abort", "resign"] as const)(
    "backend errors use the %s operation fallback",
    (operation) => {
        const result = createGameCommandError(
            operation,
            new TauriCommandError({
                tag: "backend-error",
                category: "invalid-input",
                message: "private backend diagnostic /private/game.pgn",
            }),
        );

        expect(result).toEqual({
            kind: "operation",
            operation,
            diagnostic: "private backend diagnostic [path]",
        });
    },
);

test("non-Error failures use a generic operation fallback without exposing their value", () => {
    const result = createGameCommandError("move", { secret: "native detail /private/game.pgn" });

    expect(result.kind).toBe("operation");
    expect(result).toMatchObject({
        operation: "move",
        diagnostic: expect.not.stringContaining("/private"),
    });
});

test("logger rejection retains both sanitized diagnostics and does not escape", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.logError.mockRejectedValueOnce(new Error("logger failed at /private/logger.log"));

    const result = recordGameCommandError(
        "start",
        new Error("native failed at /private/game.pgn"),
        { tabId: "tab-a", generation: 3 },
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(result.diagnostic).toBe("native failed at [path]");
    expect(mocks.logError).toHaveBeenCalledWith(
        "game command start failed [tab=tab-a generation=3]: native failed at [path]",
    );
    expect(consoleError).toHaveBeenCalledWith("Game command error logging failed", {
        operation: "start",
        primaryFailure: { category: "unexpected", message: result.diagnostic },
        game: { tabId: "tab-a", generation: 3 },
        loggerFailure: { category: "unexpected", message: "logger failed at [path]" },
    });
});

test("command logging includes the captured game identity and string session", async () => {
    recordGameCommandError("move", new Error("native move failure /private/game.pgn"), {
        tabId: "tab-b",
        generation: 8,
        gameId: "tab-b-game-id",
        session: 12n,
    });
    await Promise.resolve();

    expect(mocks.logError).toHaveBeenCalledWith(
        "game command move failed [tab=tab-b generation=8 game=tab-b-game-id session=12]: native move failure [path]",
    );
});

test("all semantic errors translate through every shipped catalogue without fallback", async () => {
    const catalogues = shippedCatalogues();
    for (const { locale, translation } of catalogues) {
        const instance = await catalogueI18n(locale as Parameters<typeof catalogueI18n>[0]);
        const t = instance.t.bind(instance);
        const validation = translateGameCommandError(t, {
            kind: "validation",
            code: "missing-local-engine",
            diagnostic: "private",
        });
        expect(validation).toBe(translation["Board.Opponent.Error.MissingEngine"]);
        expect(validation).not.toContain("private");
        for (const operation of Object.keys(operationKeys) as GameCommand[]) {
            const message = translateGameCommandError(t, {
                kind: "operation",
                operation,
                diagnostic: "private",
            });
            expect(message).toBe(translation[operationKeys[operation]]);
            expect(message).not.toContain("private");
        }
    }
});
