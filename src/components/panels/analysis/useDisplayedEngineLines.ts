import { useTabAtom, useOwnerTabId } from "@/state/tabScope";
import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import type { BestMoves, EngineLog, EngineTerminalEntry, EngineTerminalSnapshot } from "@/bindings";
import type { TFunction } from "i18next";
import { normalizeError } from "@/platform/errors";
import {
    threatFamily,
    engineMovesFamily,
    engineTerminalFamily,
    engineRetryFamily,
    tabEngineSettingsFamily,
    type AnalysisTerminal,
} from "@/state/atoms";
import { positionFromFen } from "@/utils/chessops";
import type { Engine } from "@/utils/engines";
import { analysisSearch } from "./analysisSearch";
import { AnalysisLineMemory } from "./analysisLineMemory";
import { engineIdentity, engineLineContext } from "./analysisLineContext";

export const ENGINE_LINES_LOADING_DELAY_MS = 1000;

type DisplayedLines = { lines: BestMoves[]; finalFen: string | null; halfMoves: number };

/** The native snapshot is already safe. Render its text without interpreting markup. */
export function engineFailureMessage(
    t: TFunction,
    snapshot?: EngineTerminalSnapshot,
    message = "",
    cleanupFailed = false,
): string {
    if (cleanupFailed)
        return `${engineFailureMessage(t, snapshot, message)} ${t("Board.Analysis.EngineCleanupFailed")}`;
    if (!snapshot) return message.trim() ? message : t("Board.Analysis.EngineDisconnected");
    if (snapshot?.reason) return snapshot.reason;
    if (snapshot?.exitStatus?.signal != null)
        return t("Board.Analysis.EngineExitSignal", { signal: snapshot.exitStatus.signal });
    if (snapshot?.exitStatus?.code != null)
        return t("Board.Analysis.EngineExitCode", { code: snapshot.exitStatus.code });
    if (snapshot?.kind === "protocol-failure") return t("Board.Analysis.EngineProtocolFailure");
    if (snapshot?.kind === "process-exit") return t("Board.Analysis.EngineExited");
    return t("Board.Analysis.EngineDisconnected");
}

export function engineTerminalLogs(t: TFunction, entries: EngineTerminalEntry[]): EngineLog[] {
    return entries.map((entry) => ({
        type: "engine",
        value: entry.type === "truncated" ? t("Engines.Logs.TerminalTruncated") : entry.value,
    }));
}

export function reportEngineFailure(t: TFunction, cause: unknown): unknown {
    const failure = normalizeError(cause);
    return failure.engineFailure || failure.backendCategory === "engine-failure"
        ? {
              ...failure,
              message: engineFailureMessage(
                  t,
                  failure.engineFailure,
                  failure.message,
                  failure.backendCategory === "operation-and-cleanup",
              ),
          }
        : cause;
}

export function matchingEngineTerminal(
    terminal: AnalysisTerminal | null,
    engine: Engine,
    context: string,
    retry: number,
    searchedKey?: string,
): AnalysisTerminal | null {
    return engine.type === "local" &&
        engine.loaded &&
        terminal?.context === context &&
        terminal.engineIdentity === engineIdentity(engine) &&
        terminal.retry === retry &&
        (searchedKey === undefined || terminal.searchedKey === searchedKey)
        ? terminal
        : null;
}

/** Retains one committed display per mode and reader, scoped to its owner and settings. */
export function useDisplayedEngineLines(
    engine: Engine,
    fen: string,
    moves: string[],
    halfMoves = 0,
) {
    const tab = useOwnerTabId();
    const threat = useAtomValue(useTabAtom(threatFamily));
    const settings = useAtomValue(
        tabEngineSettingsFamily({
            tab,
            engineId: engine.id,
            defaultSettings: engine.settings ?? undefined,
            defaultGo: engine.go ?? undefined,
        }),
    );
    const memory = useAtomValue(engineMovesFamily({ tab, engine: engine.id }));
    const terminal = useAtomValue(engineTerminalFamily({ tab, engine: engine.id }));
    const retry = useAtomValue(engineRetryFamily({ tab, engine: engine.id }));
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
    const currentTerminal = eligible
        ? matchingEngineTerminal(terminal, engine, context, retry, search.key)
        : null;
    const failure = currentTerminal?.type === "failed" ? currentTerminal : null;
    const waiting = eligible && current === undefined && !currentTerminal;
    const request = JSON.stringify([scope, search.key, threat, retry]);
    const [expired, setExpired] = useState<string | null>(null);
    useEffect(() => {
        setExpired(null);
        if (!waiting) return;
        const timer = window.setTimeout(() => setExpired(request), ENGINE_LINES_LOADING_DELAY_MS);
        return () => window.clearTimeout(timer);
    }, [request, waiting]);
    const loading = waiting && expired === request;
    const fallback =
        ((waiting && !loading) || failure) && current === undefined
            ? previous?.displays.get(threat)
            : undefined;
    return {
        lines: error || isGameOver ? undefined : (current ?? fallback?.lines),
        dimmed: fallback !== undefined || (failure !== null && current !== undefined),
        failure,
        loading,
        finalFen: fallback ? fallback.finalFen : search.finalFen,
        halfMoves: fallback ? fallback.halfMoves : halfMoves,
        error,
        isGameOver,
        threat,
        settings,
    };
}
