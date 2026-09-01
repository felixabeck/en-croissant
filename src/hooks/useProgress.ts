import { useCallback, useEffect, useRef, useState } from "react";
import { type ProgressEvent, type ProgressItem } from "@/bindings";
import { notifyListenerError } from "@/components/files/notifyError";
import { tauri, tauriSubscriptions } from "@/platform/tauri";
import { useTauriListener } from "@/platform/useTauriListener";

function newestProgress(
    current: ProgressItem | null,
    incoming: ProgressItem,
    minimumGeneration: bigint,
): ProgressItem | null {
    if (incoming.generation < minimumGeneration) {
        return current;
    }
    if (!current || incoming.generation > current.generation) {
        return incoming;
    }
    if (incoming.generation < current.generation) {
        return current;
    }
    if (current.finished && !incoming.finished) {
        return current;
    }
    return incoming.progress >= current.progress ? incoming : current;
}

export function useProgress(id: string) {
    const [item, setItem] = useState<ProgressItem | null>(null);
    const minimumGeneration = useRef<bigint>(BigInt(0));

    useEffect(() => {
        let active = true;
        minimumGeneration.current = BigInt(0);
        setItem(null);
        tauri
            .getProgress(id)
            .then((result) => {
                if (active && result) {
                    setItem((current) =>
                        newestProgress(current, result, minimumGeneration.current),
                    );
                }
            })
            .catch(() => {
                // A transient native lookup error must not turn an already-running
                // subscription into an unhandled renderer rejection.
            });
        return () => {
            active = false;
        };
    }, [id]);

    const subscribeProgress = useCallback(
        (listener: (event: { payload: ProgressEvent }) => void) =>
            tauriSubscriptions.progress(listener),
        [],
    );

    useTauriListener(
        subscribeProgress,
        ({ payload }) => {
            if (payload.id === id) {
                if (payload.cleared) {
                    minimumGeneration.current = payload.generation;
                    setItem(null);
                    return;
                }
                setItem((current) => newestProgress(current, payload, minimumGeneration.current));
            }
        },
        { onError: notifyListenerError },
    );

    const clear = useCallback(async () => {
        const generation = await tauri.clearProgress(id);
        minimumGeneration.current = generation;
        setItem(null);
    }, [id]);

    return {
        progress: item?.progress ?? 0,
        finished: item?.finished ?? false,
        isActive: item !== null && !item.finished,
        clear,
        item,
    };
}
