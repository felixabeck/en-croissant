import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeError, type AppError } from "./errors";

export type OperationState<T> =
    | { status: "idle" }
    | { status: "pending"; generation: number }
    | { status: "success"; generation: number; value: T }
    | { status: "error"; generation: number; error: AppError }
    | { status: "cancelled"; generation: number };

export function useOperation<T>() {
    const generation = useRef(0);
    const controller = useRef<AbortController | undefined>(undefined);
    const [state, setState] = useState<OperationState<T>>({ status: "idle" });

    const cancel = useCallback(() => {
        controller.current?.abort();
        controller.current = undefined;
        const current = generation.current;
        setState({ status: "cancelled", generation: current });
    }, []);

    const run = useCallback(async (operation: (signal: AbortSignal) => Promise<T>) => {
        controller.current?.abort();
        const activeController = new AbortController();
        controller.current = activeController;
        const current = ++generation.current;
        setState({ status: "pending", generation: current });
        try {
            const value = await operation(activeController.signal);
            if (generation.current === current && !activeController.signal.aborted) {
                setState({ status: "success", generation: current, value });
            }
            return value;
        } catch (error) {
            if (generation.current === current) {
                setState(
                    activeController.signal.aborted
                        ? { status: "cancelled", generation: current }
                        : { status: "error", generation: current, error: normalizeError(error) },
                );
            }
            throw error;
        } finally {
            if (generation.current === current) controller.current = undefined;
        }
    }, []);

    useEffect(() => cancel, [cancel]);
    return { state, run, cancel };
}
