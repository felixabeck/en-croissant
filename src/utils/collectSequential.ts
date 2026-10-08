import { logFailureSafely, safeFailureContext, type SafeFailureContext } from "@/platform/errors";

export type SequentialFailure<T> = {
    item: T;
    index: number;
    failure: SafeFailureContext;
};

function cancellation(signal?: AbortSignal): never | void {
    if (!signal?.aborted) return;
    throw new DOMException("Cancellation", "AbortError");
}

/** Maps sequentially, retaining successful siblings while propagating owner cancellation. */
export async function collectSequential<T, R>(
    items: readonly T[],
    mapper: (item: T, index: number) => Promise<R>,
    options: { signal?: AbortSignal; operation: string; describe?: (item: T) => string },
): Promise<{ values: R[]; failures: SequentialFailure<T>[] }> {
    const results: R[] = [];
    const failures: SequentialFailure<T>[] = [];
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
            failures.push({ item: items[index], index, failure: primaryFailure });
            const label = options.describe?.(items[index]);
            const itemLabel = label === undefined ? "" : ` (${label})`;
            const message = `${options.operation} item ${index}${itemLabel} failed: ${primaryFailure.message}`;
            await logFailureSafely(
                message,
                {
                    operation: options.operation,
                    itemIndex: index,
                    ...(label === undefined ? {} : { item: label }),
                    primaryFailure,
                },
                "Sequential collection logging failed",
            );
        }
    }
    cancellation(options.signal);
    return { values: results, failures };
}
