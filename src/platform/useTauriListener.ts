import { useEffect, useRef } from "react";
import { normalizeError, type AppError } from "./errors";

type Unlisten = () => void;
type Subscribe<T> = (listener: (event: T) => void) => Promise<Unlisten>;
type ListenerErrorHandler = (error: AppError) => void;

export type TauriListenerOptions = {
    /** Called only while the owner is mounted; late cancellation is intentionally silent. */
    onError: ListenerErrorHandler;
};

/** Registers exactly one listener and safely disposes registrations which resolve after unmount. */
export function useTauriListener<T>(
    subscribe: Subscribe<T>,
    callback: (event: T, signal: AbortSignal) => void | Promise<void>,
    options: TauriListenerOptions,
) {
    const callbackRef = useRef(callback);
    const onErrorRef = useRef(options.onError);
    callbackRef.current = callback;
    onErrorRef.current = options.onError;

    useEffect(() => {
        const controller = new AbortController();
        const { signal } = controller;
        let unlisten: Unlisten | undefined;
        void subscribe((event) => {
            if (signal.aborted) return;
            void (async () => {
                try {
                    await callbackRef.current(event, signal);
                } catch (error: unknown) {
                    if (!signal.aborted) onErrorRef.current(normalizeError(error));
                }
            })();
        })
            .then((registered) => {
                if (signal.aborted) registered();
                else unlisten = registered;
            })
            .catch((error: unknown) => {
                if (!signal.aborted) onErrorRef.current(normalizeError(error));
            });
        return () => {
            controller.abort();
            unlisten?.();
        };
    }, [subscribe]);
}
