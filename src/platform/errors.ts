export type AppErrorCategory =
    | "cancelled"
    | "network"
    | "not-found"
    | "applied-despite-error"
    | "permission"
    | "validation"
    | "unexpected";

export type AppError = {
    category: AppErrorCategory;
    message: string;
    diagnostic?: string;
};

const APP_ERROR_CATEGORIES: readonly AppErrorCategory[] = [
    "cancelled",
    "network",
    "not-found",
    "applied-despite-error",
    "permission",
    "validation",
    "unexpected",
];

const FEN_BOARD_PATTERN = /[rnbqkpRNBQKP1-8]+(?:\/[rnbqkpRNBQKP1-8]+){1,7}/g;
const PGN_DRAW_PATTERN = /1\/2-1\/2/g;
const PREFIX_SECRET_PATTERN = /(bearer\s+|token[=:]\s*|password[=:]\s*)[^\s,;]+/gi;
const JSON_SECRET_PATTERN = /(["'](?:password|token)["']\s*:\s*["'])[^"']+/gi;
const PATH_PATTERN =
    /(?:[A-Za-z]:(?:\\|\/)+[^\s'"]+|\\\\[^\s'"]+|~\/[^\s'"]+|\/(?:[^\s'"\\]+\/)+[^\s'"]*|\/[^\s'"]+\.[A-Za-z0-9]{1,8}\b)/g;

function isAppError(value: unknown): value is AppError {
    if (typeof value !== "object" || value === null) return false;
    const candidate = value as { category?: unknown; message?: unknown };
    return (
        typeof candidate.message === "string" &&
        typeof candidate.category === "string" &&
        APP_ERROR_CATEGORIES.includes(candidate.category as AppErrorCategory)
    );
}

function errorSource(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    return safelyStringify(error) || "Unexpected error";
}

function redactSecrets(value: string): string {
    return value
        .replace(PREFIX_SECRET_PATTERN, (_match, prefix: string) => `${prefix}[redacted]`)
        .replace(JSON_SECRET_PATTERN, (_match, prefix: string) => `${prefix}[redacted]`);
}

function redact(value: string): string {
    const shields: string[] = [];
    const shield = (match: string) => {
        const token = `\u0001SHIELD${shields.length}\u0001`;
        shields.push(match);
        return token;
    };
    const shielded = value.replace(FEN_BOARD_PATTERN, shield).replace(PGN_DRAW_PATTERN, shield);
    let redacted = redactSecrets(shielded).replace(PATH_PATTERN, "[path]");
    for (const [index, original] of shields.entries()) {
        redacted = redacted.replace(`\u0001SHIELD${index}\u0001`, original);
    }
    return redacted;
}

function safelyStringify(value: unknown): string {
    const seen = new WeakSet<object>();
    try {
        return JSON.stringify(value, (_key, current: unknown) => {
            if (typeof current === "object" && current !== null) {
                if (seen.has(current)) return "[circular]";
                seen.add(current);
            }
            return typeof current === "bigint" ? current.toString() : current;
        });
    } catch {
        return String(value);
    }
}

function classify(source: string): AppErrorCategory {
    const lower = source.toLowerCase();
    // `applied-despite-error` means: the destructive change reached the filesystem even though
    // this is an error. It covers both a partial removal and a complete one whose durability
    // could not be confirmed -- which is why it is not called "partially-applied", since the
    // second case removed everything it was asked to.
    //
    // It is tested first, ahead of every other branch, because it is the only category keyed on
    // an exact literal this codebase owns -- the `#[error(...)]` text of `Error::PartialRemoval`
    // and `Error::CommittedDurabilityUncertain` -- while the branches below match generic English
    // words that can appear anywhere in a wrapped cause. A partial removal whose cause reads
    // "connection aborted" or "operation timeout" is still a partial removal, and reporting it as
    // `cancelled` would tell the user nothing happened at the one moment files were destroyed.
    //
    // Rewording either Rust variant silently breaks this. The backend asserts the literals it
    // emits; the table below asserts the literals this side matches. Both are needed -- neither
    // test alone sees the other end of the string. Finding f-20260830-04.
    if (
        lower.includes("partially removed:") ||
        lower.includes("committed but durability uncertain:")
    ) {
        return "applied-despite-error";
    }
    if (lower === "cancellation" || lower.includes("analysis cancelled")) return "cancelled";
    if (lower.includes("connection aborted") || lower.includes("network failure")) {
        return "network";
    }
    if (lower.includes("engine timeout:")) return "unexpected";
    if (
        lower.includes("game not found:") ||
        lower.includes("missing reference database") ||
        lower.includes("no moves found") ||
        lower.includes("no opening found") ||
        lower.includes("no puzzles")
    ) {
        return "not-found";
    }
    if (
        lower.includes("invalid input:") ||
        lower.includes("invalid color:") ||
        lower.includes("conflict:") ||
        lower.includes("resource limit:") ||
        lower.includes("game not in progress") ||
        lower.includes("not human's turn") ||
        lower.includes("not engine's turn") ||
        lower.includes("players aren't the same")
    ) {
        return "validation";
    }
    if (
        lower.includes("oauth failure:") ||
        lower.includes("credential operation failed") ||
        lower.includes("credential operation requires recovery")
    ) {
        return "permission";
    }
    if (lower.includes("cancel") || lower.includes("abort")) return "cancelled";
    if (lower.includes("network") || lower.includes("timeout") || lower.includes("fetch")) {
        return "network";
    }
    if (lower.includes("not found") || lower.includes("missing")) return "not-found";
    if (lower.includes("permission") || lower.includes("denied")) return "permission";
    if (lower.includes("invalid") || lower.includes("validation")) return "validation";
    return "unexpected";
}

export function normalizeError(error: unknown): AppError {
    if (isAppError(error)) return error;
    if (error instanceof Error) {
        const details = (error as { details?: unknown }).details;
        if (isAppError(details)) return details;
    }
    const source = errorSource(error) || "Unexpected error";
    return { category: classify(source), message: redact(source) };
}

export function errorUnlessCancelled(error: unknown): AppError | null {
    const normalized = normalizeError(error);
    // Pinned IPC Display of `Error::Cancellation` (`d-20260830-05`). Do not use
    // the substring taxonomy: "connection aborted" is a real failure
    // (`f-20260830-28`).
    return normalized.message === "Cancellation" ? null : normalized;
}

export async function runDestructiveWithRefresh<T>(
    run: () => Promise<T>,
    refresh: () => void | Promise<void>,
): Promise<T> {
    try {
        const result = await run();
        await refresh();
        return result;
    } catch (cause) {
        if (normalizeError(cause).category === "applied-despite-error") {
            try {
                await refresh();
            } catch {
                // A refresh failure must not replace the destructive outcome.
            }
            throw cause;
        }
        throw cause;
    }
}

export async function runAppliedMutationWithRefresh<T>(
    run: () => Promise<T>,
    refresh: () => unknown | Promise<unknown>,
): Promise<T | undefined> {
    try {
        const result = await run();
        await refresh();
        return result;
    } catch (cause) {
        if (normalizeError(cause).category !== "applied-despite-error") throw cause;
        try {
            await refresh();
        } catch {
            throw cause;
        }
        return undefined;
    }
}

export async function runWithAppliedRecovery<T>(
    run: () => Promise<T>,
    recover: () => Promise<T | undefined>,
): Promise<T> {
    try {
        return await run();
    } catch (cause) {
        if (normalizeError(cause).category !== "applied-despite-error") throw cause;
        try {
            const recovered = await recover();
            if (recovered !== undefined) return recovered;
        } catch {
            throw cause;
        }
        throw cause;
    }
}
