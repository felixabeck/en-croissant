import { error as logError } from "@/platform/native";
import { normalizeError } from "@/platform/errors";

function cancellation(signal?: AbortSignal): never | void {
    if (!signal?.aborted) return;
    throw new DOMException("Cancellation", "AbortError");
}

function safeFailureContext(cause: unknown) {
    const normalized = normalizeError(cause);
    const redactedMessage = normalizeError(new Error(normalized.message)).message;
    return { category: normalized.category, message: redactedMessage };
}

/** Maps sequentially, retaining successful siblings while propagating owner cancellation. */
export async function collectSequential<T, R>(
    items: readonly T[],
    mapper: (item: T, index: number) => Promise<R>,
    options: { signal?: AbortSignal; operation: string },
): Promise<R[]> {
    const results: R[] = [];
    for (let index = 0; index < items.length; index += 1) {
        cancellation(options.signal);
        try {
            const result = await mapper(items[index], index);
            cancellation(options.signal);
            results.push(result);
        } catch (cause) {
            cancellation(options.signal);
            const primaryFailure = safeFailureContext(cause);
            if (primaryFailure.category === "cancelled") throw cause;
            const message = `${options.operation} item ${index} failed: ${primaryFailure.message}`;
            await Promise.resolve()
                .then(() => logError(message))
                .catch((loggingCause) => {
                    const loggerFailure = safeFailureContext(loggingCause);
                    console.error("Sequential collection logging failed", {
                        operation: options.operation,
                        itemIndex: index,
                        primaryFailure,
                        loggerFailure,
                    });
                });
        }
    }
    cancellation(options.signal);
    return results;
}
