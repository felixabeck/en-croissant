import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import type { BestMoves } from "@/bindings";
import {
    activeTabAtom,
    currentThreatAtom,
    engineMovesFamily,
    tabEngineSettingsFamily,
} from "@/state/atoms";
import { positionFromFen } from "@/utils/chessops";
import type { Engine } from "@/utils/engines";
import { analysisSearch } from "./analysisSearch";
import { AnalysisLineMemory } from "./analysisLineMemory";
import { engineLineContext } from "./analysisLineContext";

export const ENGINE_LINES_LOADING_DELAY_MS = 1000;

type DisplayedLines = { lines: BestMoves[]; finalFen: string | null; halfMoves: number };

/** Retains one committed display per mode and reader, scoped to its owner and settings. */
export function useDisplayedEngineLines(
    engine: Engine,
    fen: string,
    moves: string[],
    halfMoves = 0,
) {
    const tab = useAtomValue(activeTabAtom)!;
    const threat = useAtomValue(currentThreatAtom);
    const settings = useAtomValue(
        tabEngineSettingsFamily({
            tab,
            engineId: engine.id,
            defaultSettings: engine.settings ?? undefined,
            defaultGo: engine.go ?? undefined,
        }),
    );
    const memory = useAtomValue(engineMovesFamily({ tab, engine: engine.id }));
    const search = analysisSearch(fen, moves, threat);
    const [, error] = positionFromFen(fen);
    const isGameOver = search.position?.isEnd() ?? false;
    const context = engineLineContext(settings, engine);
    const scope = JSON.stringify([tab, context]);
    const current =
        memory instanceof AnalysisLineMemory && memory.context !== context
            ? undefined
            : memory.get(search.key);
    const [previous, setPrevious] = useState<{
        scope: string;
        displays: Map<boolean, DisplayedLines>;
    } | null>(null);
    if (previous && previous.scope !== scope) setPrevious(null);
    useEffect(() => {
        if (current && !error && !isGameOver)
            setPrevious((previous) => {
                const displays = new Map(previous?.displays);
                displays.set(threat, { lines: current, finalFen: search.finalFen, halfMoves });
                return { scope, displays };
            });
    }, [current, scope, search.finalFen, halfMoves, error, isGameOver, threat]);

    const eligible = settings.enabled && !error && !isGameOver;
    const waiting = eligible && current === undefined;
    const request = JSON.stringify([scope, search.key, threat]);
    const [expired, setExpired] = useState<string | null>(null);
    useEffect(() => {
        setExpired(null);
        if (!waiting) return;
        const timer = window.setTimeout(() => setExpired(request), ENGINE_LINES_LOADING_DELAY_MS);
        return () => window.clearTimeout(timer);
    }, [request, waiting]);
    const loading = waiting && expired === request;
    const fallback = waiting && !loading ? previous?.displays.get(threat) : undefined;
    return {
        lines: error || isGameOver ? undefined : (current ?? fallback?.lines),
        dimmed: fallback !== undefined,
        loading,
        finalFen: fallback ? fallback.finalFen : search.finalFen,
        halfMoves: fallback ? fallback.halfMoves : halfMoves,
        error,
        isGameOver,
        threat,
        settings,
    };
}
