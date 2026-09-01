import { useCallback } from "react";
import { useSetAtom } from "jotai";
import { type ConvertProgress } from "@/bindings";
import { notifyListenerError } from "@/components/files/notifyError";
import { tauriSubscriptions } from "@/platform/tauri";
import { useTauriListener } from "@/platform/useTauriListener";
import { databaseConversionStateAtom } from "@/state/atoms";

/**
 * Keeps the live import counters on the databases page fed while a PGN
 * conversion runs.
 *
 * This is mounted application-wide rather than on the databases route: an import
 * keeps running while the user navigates away, and the counters have to be
 * correct when they come back. It only writes the fields the native event owns,
 * so it cannot clobber the target database, title, or the `inProgress` flag that
 * the route itself sets around the conversion call.
 */
export function useConversionProgress() {
    const setConversionState = useSetAtom(databaseConversionStateAtom);

    const subscribe = useCallback(
        (listener: (event: { payload: ConvertProgress }) => void) =>
            tauriSubscriptions.convertProgress(listener),
        [],
    );

    useTauriListener(
        subscribe,
        ({ payload }) => {
            setConversionState((previous) => ({
                ...previous,
                inProgress: true,
                totalGames: payload.imported_games,
                elapsedSeconds: payload.elapsed_ms / 1000,
                sourceFileName: payload.source_file_name ?? previous.sourceFileName,
            }));
        },
        { onError: notifyListenerError },
    );
}
