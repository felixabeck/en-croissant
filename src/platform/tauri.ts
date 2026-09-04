import { commands, events, type Result as GeneratedResult } from "@/bindings/generated";
import { normalizeError } from "./errors";

// The facade is the only module allowed to reach `@/bindings/generated` (`d-20260831-32`),
// so the typed error contract is re-exported from here rather than imported directly by
// every consumer. `errors.ts` takes these as type-only imports, which erase at compile time
// and so do not create a runtime cycle with the `normalizeError` import above.
export type { ErrorCategory, ErrorPayload } from "@/bindings/generated";

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
type TauriCommands = { [Name in keyof typeof commands]: FacadeCommand<(typeof commands)[Name]> };

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
                const result = await command(...args);
                return isCommandResult(result) ? unwrapCommand(result) : result;
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
    clockUpdate: (callback: Parameters<typeof events.clockUpdateEvent.listen>[0]) =>
        events.clockUpdateEvent.listen(callback),
    convertProgress: (callback: Parameters<typeof events.convertProgress.listen>[0]) =>
        events.convertProgress.listen(callback),
    databaseProgress: (callback: Parameters<typeof events.databaseProgress.listen>[0]) =>
        events.databaseProgress.listen(callback),
    gameMove: (callback: Parameters<typeof events.gameMoveEvent.listen>[0]) =>
        events.gameMoveEvent.listen(callback),
    gameOver: (callback: Parameters<typeof events.gameOverEvent.listen>[0]) =>
        events.gameOverEvent.listen(callback),
    progress: (callback: Parameters<typeof events.progressEvent.listen>[0]) =>
        events.progressEvent.listen(callback),
};
