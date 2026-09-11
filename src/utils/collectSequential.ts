import { logFailureSafely, safeFailureContext } from "@/platform/errors";

function cancellation(signal?: AbortSignal): never | void {
    if (!signal?.aborted) return;
    throw new DOMException("Cancellation", "AbortError");
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
            await logFailureSafely(
                message,
                { operation: options.operation, itemIndex: index, primaryFailure },
                "Sequential collection logging failed",
            );
        }
    }
    cancellation(options.signal);
    return results;
}
