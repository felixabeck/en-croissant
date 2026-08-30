export type AppErrorCategory =
    | "cancelled"
    | "network"
    | "not-found"
    | "partially-applied"
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
    // `partially-applied` is tested first, ahead of every other branch. It is the only category
    // keyed on an exact literal this codebase owns -- the `#[error(...)]` text of
    // `Error::PartialRemoval` and `Error::CommittedDurabilityUncertain` -- while the branches
    // below match generic English words that can appear anywhere in a wrapped cause. A partial
    // removal whose cause happens to read "connection aborted" or "operation timed out" is still
    // a partial removal, and misreading it as `cancelled` would tell the user nothing happened at
    // the one moment files were destroyed. Rewording either Rust variant breaks this contract, so
    // it is pinned by a test on each side of the IPC boundary -- see finding f-20260830-04.
    const category: AppErrorCategory =
        lower.includes("partially removed:") ||
        lower.includes("committed but durability uncertain:")
            ? "partially-applied"
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
