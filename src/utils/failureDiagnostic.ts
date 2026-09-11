import { normalizeError, type AppErrorCategory } from "@/platform/errors";
import { error as logError } from "@/platform/native";

export type SafeFailureContext = {
    category: AppErrorCategory;
    message: string;
};

/** Normalizes and re-redacts a failure before it can reach logs or fallback context. */
export function safeFailureContext(cause: unknown): SafeFailureContext {
    const normalized = normalizeError(cause);
    return {
        category: normalized.category,
        message: normalizeError(new Error(normalized.message)).message,
    };
}

type FailureLogContext = {
    operation: string;
    primaryFailure: SafeFailureContext;
    itemIndex?: number;
    game?: GameFailureContext;
};

export type GameFailureContext = {
    tabId: string;
    generation: number;
    gameId?: string;
    session?: string;
};

/** Logs a sanitized failure and handles native logger rejection with a sanitized console fallback. */
export async function logFailureSafely(
    message: string,
    context: FailureLogContext,
    fallbackLabel: string,
): Promise<void> {
    try {
        await logError(message);
    } catch (loggingCause) {
        console.error(fallbackLabel, {
            ...context,
            loggerFailure: safeFailureContext(loggingCause),
        });
    }
}
