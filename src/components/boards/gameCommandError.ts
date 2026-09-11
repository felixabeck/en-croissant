import type { TFunction } from "i18next";
import { logFailureSafely, safeFailureContext, type GameFailureContext } from "@/platform/errors";
import { MissingLocalEngineError } from "./playerConfig";

export type GameCommand = "start" | "move" | "takeback" | "abort" | "resign";

export type GameCommandLogContext =
    | {
          tabId: string;
          generation: number;
      }
    | {
          tabId: string;
          generation: number;
          gameId: string;
          session: bigint;
      };

export type GameCommandError =
    | {
          kind: "validation";
          code: "missing-local-engine";
          diagnostic: string;
      }
    | {
          kind: "operation";
          operation: GameCommand;
          diagnostic: string;
      };

/**
 * Retains only the semantic identity needed by the UI while preserving a redacted diagnostic
 * for native logging. Unknown and backend failures deliberately use the operation fallback.
 */
export function createGameCommandError(operation: GameCommand, cause: unknown): GameCommandError {
    const diagnostic = safeFailureContext(cause).message;
    if (cause instanceof MissingLocalEngineError) {
        return { kind: "validation", code: cause.code, diagnostic };
    }
    return { kind: "operation", operation, diagnostic };
}

/**
 * Logs the redacted cause without allowing a native logger rejection to become an unhandled
 * promise. The returned semantic error is safe to retain in renderer state.
 */
export function recordGameCommandError(
    operation: GameCommand,
    cause: unknown,
    context: GameCommandLogContext,
): GameCommandError {
    const error = createGameCommandError(operation, cause);
    const gameContext: GameFailureContext = {
        tabId: context.tabId,
        generation: context.generation,
        ...("gameId" in context
            ? { gameId: context.gameId, session: context.session.toString() }
            : {}),
    };
    const identity = [
        `tab=${gameContext.tabId}`,
        `generation=${gameContext.generation}`,
        ...(gameContext.gameId !== undefined
            ? [`game=${gameContext.gameId}`, `session=${gameContext.session}`]
            : []),
    ].join(" ");
    const message = `game command ${operation} failed [${identity}]: ${error.diagnostic}`;
    void logFailureSafely(
        message,
        { operation, primaryFailure: safeFailureContext(cause), game: gameContext },
        "Game command error logging failed",
    );
    return error;
}

/** Translate semantic command errors at render time so a locale change updates the alert. */
export function translateGameCommandError(t: TFunction, error: GameCommandError): string {
    if (error.kind === "validation") {
        return t("Board.Opponent.Error.MissingEngine");
    }
    switch (error.operation) {
        case "start":
            return t("Board.Opponent.Error.Start");
        case "move":
            return t("Board.Opponent.Error.Move");
        case "takeback":
            return t("Board.Opponent.Error.Takeback");
        case "abort":
            return t("Board.Opponent.Error.Abort");
        case "resign":
            return t("Board.Opponent.Error.Resign");
    }
}
