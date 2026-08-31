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

const SECRET_PATTERN = /(?:bearer\s+|token[=:]\s*|password[=:]\s*)[^\s,;]+/gi;
const PATH_PATTERN = /(?:[a-z]:\\|\/)(?:[^\s'"\\]+[\\/])*[^\s'"\\]*/gi;

function redact(value: string): string {
    return value.replace(SECRET_PATTERN, "$1[redacted]").replace(PATH_PATTERN, "[path]");
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

export function normalizeError(error: unknown): AppError {
    const source = error instanceof Error ? error.message : safelyStringify(error);
    const message = redact(source || "Unexpected error");
    const lower = message.toLowerCase();
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
    const category: AppErrorCategory =
        lower.includes("partially removed:") ||
        lower.includes("committed but durability uncertain:")
            ? "applied-despite-error"
            : lower.includes("cancel") || lower.includes("abort")
              ? "cancelled"
              : lower.includes("network") || lower.includes("timeout") || lower.includes("fetch")
                ? "network"
                : lower.includes("not found") || lower.includes("missing")
                  ? "not-found"
                  : lower.includes("permission") || lower.includes("denied")
                    ? "permission"
                    : lower.includes("invalid") || lower.includes("validation")
                      ? "validation"
                      : "unexpected";

    return { category, message, diagnostic: message };
}

export function errorUnlessCancelled(error: unknown): AppError | null {
    const normalized = normalizeError(error);
    return normalized.category === "cancelled" ? null : normalized;
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
