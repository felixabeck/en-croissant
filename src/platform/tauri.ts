import { commands, events, type Result as GeneratedResult } from "@/bindings/generated";
import { normalizeError } from "./errors";
import {
    encodeGameCounter,
    type GameConfigInput,
    normalizeClockUpdateEvent,
    normalizeGameMoveEvent,
    normalizeGameOverEvent,
    normalizeGameState,
} from "./gameTransport";

type CommandResult<T> = GeneratedResult<T, unknown>;

type SuccessResult<T> = Extract<T, { status: "ok" }>;
type UnwrapResult<T> = [SuccessResult<T>] extends [never]
    ? T
    : SuccessResult<T> extends { data: infer Value }
      ? Awaited<Value>
      : T;
type FacadeCommand<T> = T extends (...args: any[]) => Promise<any>
    ? (...args: Parameters<T>) => Promise<UnwrapResult<Awaited<ReturnType<T>>>>
    : never;
type GeneratedCommands = {
    [Name in keyof typeof commands]: FacadeCommand<(typeof commands)[Name]>;
};
type TauriCommands = Omit<GeneratedCommands, "startGame"> & {
    startGame: (
        gameId: string,
        config: GameConfigInput,
    ) => ReturnType<GeneratedCommands["startGame"]>;
};

const EXPECTED_SESSION_COMMANDS = new Set<PropertyKey>([
    "getGameState",
    "makeGameMove",
    "takeBackGameMove",
    "resignGame",
    "abortGame",
    "getGameEngineLogs",
]);
const GAME_STATE_COMMANDS = new Set<PropertyKey>([
    "startGame",
    "getGameState",
    "makeGameMove",
    "takeBackGameMove",
    "resignGame",
]);

type EventEnvelope<T> = { payload: T };
type EventAdapterError<T> = (error: unknown, event: EventEnvelope<T>) => void;

function gameEventSubscription<T>(
    subscribe: (callback: (event: EventEnvelope<T>) => void) => Promise<() => void>,
    normalize: (payload: T) => T,
) {
    return (callback: (event: EventEnvelope<T>) => void, onError?: EventAdapterError<T>) =>
        subscribe((event) => {
            try {
                callback({ ...event, payload: normalize(event.payload) });
            } catch (error) {
                onError?.(normalizeError(error), event);
            }
        });
}

export class TauriCommandError extends Error {
    readonly details;

    constructor(error: unknown) {
        const details = normalizeError(error);
        super(details.message);
        this.name = "TauriCommandError";
        this.details = details;
    }
}

export function unwrapCommand<T>(result: CommandResult<T>): T {
    if (result.status === "ok") return result.data;
    throw new TauriCommandError(result.error);
}

function isCommandResult(value: unknown): value is CommandResult<unknown> {
    return (
        typeof value === "object" &&
        value !== null &&
        "status" in value &&
        ((value as { status?: unknown }).status === "ok" ||
            (value as { status?: unknown }).status === "error")
    );
}

/**
 * The only renderer boundary that imports generated Tauri commands and events.
 * Commands always either resolve with their successful payload or reject with a
 * normalized, redacted `TauriCommandError`.
 */
export const tauri: TauriCommands = new Proxy(commands, {
    get(target, property, receiver) {
        const command = Reflect.get(target, property, receiver);
        if (typeof command !== "function") return command;
        return async (...args: unknown[]) => {
            try {
                if (EXPECTED_SESSION_COMMANDS.has(property)) {
                    args[1] = encodeGameCounter(args[1] as bigint);
                }
                const result = await command(...args);
                const value = isCommandResult(result) ? unwrapCommand(result) : result;
                return GAME_STATE_COMMANDS.has(property) ? normalizeGameState(value) : value;
            } catch (error) {
                if (error instanceof TauriCommandError) throw error;
                throw new TauriCommandError(error);
            }
        };
    },
}) as unknown as TauriCommands;

/** Typed event subscriptions owned by the same generated-binding boundary. */
export const tauriSubscriptions = {
    bestMoves: (callback: Parameters<typeof events.bestMovesPayload.listen>[0]) =>
        events.bestMovesPayload.listen(callback),
    clockUpdate: gameEventSubscription(
        (callback) => events.clockUpdateEvent.listen(callback),
        normalizeClockUpdateEvent,
    ),
    convertProgress: (callback: Parameters<typeof events.convertProgress.listen>[0]) =>
        events.convertProgress.listen(callback),
    gameMove: gameEventSubscription(
        (callback) => events.gameMoveEvent.listen(callback),
        normalizeGameMoveEvent,
    ),
    gameOver: gameEventSubscription(
        (callback) => events.gameOverEvent.listen(callback),
        normalizeGameOverEvent,
    ),
    progress: (callback: Parameters<typeof events.progressEvent.listen>[0]) =>
        events.progressEvent.listen(callback),
};
