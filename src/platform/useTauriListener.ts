import { useEffect, useRef } from "react";
import { normalizeError, type AppError } from "./errors";

type Unlisten = () => void;
type Subscribe<T> = (listener: (event: T) => void) => Promise<Unlisten>;
type ListenerErrorHandler = (error: AppError) => void;

export type TauriListenerOptions = {
    /** Called only while the owner is mounted; late cancellation is intentionally silent. */
    onError?: ListenerErrorHandler;
};

function reportRegistrationFailure(error: AppError) {
    console.error("Tauri listener registration failed", error);
}

/** Registers exactly one listener and safely disposes registrations which resolve after unmount. */
export function useTauriListener<T>(
    subscribe: Subscribe<T>,
    callback: (event: T) => void,
    options: TauriListenerOptions = {},
) {
    const callbackRef = useRef(callback);
    const onErrorRef = useRef(options.onError);
    callbackRef.current = callback;
    onErrorRef.current = options.onError;

    useEffect(() => {
        let disposed = false;
        let unlisten: Unlisten | undefined;
        void subscribe((event) => {
            if (!disposed) callbackRef.current(event);
        })
            .then((registered) => {
                if (disposed) registered();
                else unlisten = registered;
            })
            .catch((error: unknown) => {
                if (disposed) return;
                const normalized = normalizeError(error);
                const onError = onErrorRef.current;
                if (onError) onError(normalized);
                else reportRegistrationFailure(normalized);
            });
        return () => {
            disposed = true;
            unlisten?.();
        };
    }, [subscribe]);
}
