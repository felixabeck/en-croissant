import {
    type ClockUpdateEvent,
    commands,
    events,
    type GameConfig,
    type GameMoveEvent,
    type GameOverEvent,
    type GameState,
    type OpeningBookConfig,
    type Result as GeneratedResult,
    type TimeControl,
} from "@/bindings/generated";
import { normalizeError } from "./errors";
import { error as logError } from "./native";

const MAX_SAFE_COUNTER = BigInt(Number.MAX_SAFE_INTEGER);

type GameCounterFields = Pick<GameState, "session" | "revision">;
type GameCounterWireInput<T extends GameCounterFields> = Omit<T, keyof GameCounterFields> & {
    [Field in keyof GameCounterFields]: number | GameCounterFields[Field];
};

export type GameConfigInput = Omit<
    GameConfig,
    "whiteTimeControl" | "blackTimeControl" | "openingBook"
> & {
    whiteTimeControl: NumericTimeControl | null;
    blackTimeControl: NumericTimeControl | null;
    openingBook: NumericOpeningBookConfig | null;
};

type NumericTimeControl = Omit<TimeControl, "initialTime" | "increment"> & {
    initialTime: number;
    increment: number;
};

type NumericOpeningBookConfig = Omit<OpeningBookConfig, "maxPly"> & {
    maxPly?: number;
};

export function decodeGameCounter(value: unknown, field: string): bigint {
    if (typeof value === "bigint") {
        if (value >= 0 && value <= MAX_SAFE_COUNTER) return value;
    } else if (typeof value === "number") {
        if (Number.isSafeInteger(value) && value >= 0) return BigInt(value);
    }
    throw new TypeError(`${field} must be a nonnegative safe integer`);
}

export function encodeGameCounter(value: bigint, field = "expectedSession"): number {
    if (typeof value !== "bigint" || value < 0 || value > MAX_SAFE_COUNTER) {
        throw new TypeError(`${field} must be a nonnegative safe integer`);
    }
    return Number(value);
}

export function normalizeGameState(value: GameCounterWireInput<GameState>): GameState {
    return normalizeCounterPair(value);
}

export function normalizeGameMoveEvent(value: GameCounterWireInput<GameMoveEvent>): GameMoveEvent {
    return normalizeCounterPair(value);
}

export function normalizeClockUpdateEvent(
    value: GameCounterWireInput<ClockUpdateEvent>,
): ClockUpdateEvent {
    return normalizeCounterPair(value);
}

export function normalizeGameOverEvent(value: GameCounterWireInput<GameOverEvent>): GameOverEvent {
    return normalizeCounterPair(value);
}

function normalizeCounterPair<T extends GameCounterFields>(
    value: GameCounterWireInput<T>,
): Omit<T, keyof GameCounterFields> & GameCounterFields {
    return {
        ...value,
        session: decodeGameCounter(value.session, "session"),
        revision: decodeGameCounter(value.revision, "revision"),
    };
}

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
export type NativeReadOptions = { signal?: AbortSignal };
type NativeReadCommandName =
    | "searchPosition"
    | "getPlayersGameInfo"
    | "preloadReferenceDb"
    | "getGames"
    | "getPlayers"
    | "getTournaments"
    | "listWorkspaceDatabases"
    | "getPuzzle"
    | "listPuzzleDatabases"
    | "getPuzzleDbInfo"
    | "getPuzzleThemes"
    | "getThemesForPuzzle"
    | "countPgnGames"
    | "readGames"
    | "lexPgn"
    | "listFileWorkspace";
type NativeReadFacade<T> = T extends (
    ...args: [...infer Args, string | null]
) => Promise<infer Result>
    ? (...args: [...Args, NativeReadOptions?]) => Promise<Result>
    : never;
type TauriCommands = Omit<GeneratedCommands, "startGame" | NativeReadCommandName> & {
    startGame: (
        gameId: string,
        config: GameConfigInput,
    ) => ReturnType<GeneratedCommands["startGame"]>;
} & {
    [Name in NativeReadCommandName]: NativeReadFacade<GeneratedCommands[Name]>;
} & {
    prepareAnalysis: (tab: string, options?: NativeReadOptions) => Promise<string>;
};

const NATIVE_READ_ARITY: Readonly<Record<NativeReadCommandName, number>> = {
    searchPosition: 3,
    getPlayersGameInfo: 3,
    preloadReferenceDb: 1,
    getGames: 2,
    getPlayers: 2,
    getTournaments: 2,
    listWorkspaceDatabases: 1,
    getPuzzle: 4,
    listPuzzleDatabases: 0,
    getPuzzleDbInfo: 1,
    getPuzzleThemes: 1,
    getThemesForPuzzle: 2,
    countPgnGames: 1,
    readGames: 3,
    lexPgn: 1,
    listFileWorkspace: 1,
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

export function cancellationError(): TauriCommandError {
    return new TauriCommandError({
        tag: "backend-error",
        category: "cancellation",
        message: "Cancellation",
    });
}

async function logCleanupFailure(command: PropertyKey, ticket: string, cause: unknown) {
    const message = `native read cleanup failed (${String(command)}, ${ticket}): ${normalizeError(cause).message}`;
    try {
        await logError(message);
    } catch (loggingError) {
        console.error("Native read cleanup logging failed", normalizeError(loggingError));
    }
}

async function withPreparedTicket<T>({
    signal,
    operation,
    prepare,
    cancel,
    continuation,
}: {
    signal?: AbortSignal;
    operation: PropertyKey;
    prepare: () => Promise<CommandResult<string>>;
    cancel: (ticket: string) => Promise<CommandResult<unknown>>;
    continuation: (ticket: string) => Promise<T>;
}): Promise<T> {
    if (signal?.aborted) throw cancellationError();

    let ticket: string | undefined;
    let aborted = false;
    let cleanupPromise: Promise<void> | undefined;
    const cleanup = () => {
        const cleanupTicket = ticket;
        if (!cleanupTicket) return Promise.resolve();
        cleanupPromise ??= (async () => {
            try {
                unwrapCommand(await cancel(cleanupTicket));
            } catch (error) {
                await logCleanupFailure(operation, cleanupTicket, error);
            }
        })();
        return cleanupPromise;
    };
    const onAbort = () => {
        aborted = true;
        void cleanup();
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    try {
        ticket = unwrapCommand(await prepare());
        if (aborted || signal?.aborted) {
            await cleanup();
            throw cancellationError();
        }
        let result: T;
        try {
            result = await continuation(ticket);
        } catch (error) {
            await cleanup();
            throw error;
        }
        if (aborted || signal?.aborted) {
            await cleanup();
            throw cancellationError();
        }
        return result;
    } finally {
        signal?.removeEventListener("abort", onAbort);
    }
}

async function invokeNativeRead(
    commandName: PropertyKey,
    command: (...args: unknown[]) => Promise<unknown>,
    args: unknown[],
    options: NativeReadOptions | undefined,
): Promise<unknown> {
    const signal = options?.signal;
    if (!signal) return command(...args, null);
    return withPreparedTicket({
        signal,
        operation: commandName,
        prepare: () => commands.prepareNativeRead(),
        cancel: (ticket) => commands.cancelNativeRead(ticket),
        continuation: async (ticket) => {
            const result = await command(...args, ticket);
            return isCommandResult(result) ? unwrapCommand(result) : result;
        },
    });
}

async function prepareAnalysis(
    tab: string,
    options: NativeReadOptions | undefined,
): Promise<string> {
    return withPreparedTicket({
        signal: options?.signal,
        operation: "prepareAnalysis",
        prepare: () => commands.prepareAnalysis(tab),
        cancel: (ticket) => commands.cancelAnalysis(ticket),
        continuation: async (ticket) => ticket,
    });
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
                if (property === "prepareAnalysis") {
                    return await prepareAnalysis(
                        args[0] as string,
                        args[1] as NativeReadOptions | undefined,
                    );
                }
                if (property in NATIVE_READ_ARITY) {
                    const name = property as NativeReadCommandName;
                    const arity = NATIVE_READ_ARITY[name];
                    const options =
                        args.length > arity ? (args.pop() as NativeReadOptions) : undefined;
                    const result = await invokeNativeRead(property, command, args, options);
                    return isCommandResult(result) ? unwrapCommand(result) : result;
                }
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
