import { tauriSubscriptions } from "@/platform/tauri";
import { parseUci } from "chessops";
import { INITIAL_FEN, makeFen } from "chessops/fen";
import equal from "fast-deep-equal";
import { useAtom, useAtomValue } from "jotai";
import { startTransition, useCallback, useContext, useMemo, useRef } from "react";
import { match } from "ts-pattern";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { type BestMovesPayload, type EngineOptions, type GoMode } from "@/bindings";
import { notifyListenerError } from "@/components/files/notifyError";
import {
  activeTabAtom,
  currentThreatAtom,
  engineMovesFamily,
  engineProgressFamily,
  enginesAtom,
  firstEngineWithLinesFamily,
  tabEngineSettingsFamily,
} from "@/state/atoms";
import { getVariationLine } from "@/utils/chess";
import { getBestMoves as chessdbGetBestMoves } from "@/utils/chessdb/api";
import { positionFromFen, swapMove } from "@/utils/chessops";
import {
  type Engine,
  type LocalEngine,
  getBestMoves as localGetBestMoves,
  stopEngine,
} from "@/utils/engines";
import { getBestMoves as lichessGetBestMoves } from "@/utils/lichess/api";
import { useThrottledEffect } from "@/utils/misc";
import { useTauriListener } from "@/platform/useTauriListener";
import { TreeStateContext } from "../common/TreeStateContext";

function EvalListener() {
  const [engines] = useAtom(enginesAtom);
  const threat = useAtomValue(currentThreatAtom);
  const store = useContext(TreeStateContext)!;
  const fen = useStore(store, (s) => s.root.fen);

  const moves = useStore(
    store,
    useShallow((s) => getVariationLine(s.root, s.position)),
  );

  const [pos] = positionFromFen(fen);
  if (pos) {
    for (const uci of moves) {
      const move = parseUci(uci);
      if (!move) {
        console.log("Invalid move", uci);
        break;
      }
      pos.play(move);
    }
  }

  const isGameOver = pos?.isEnd() ?? false;
  const finalFen = useMemo(() => (pos ? makeFen(pos.toSetup()) : null), [pos]);

  const { searchingFen, searchingMoves } = useMemo(
    () =>
      match(threat as boolean)
        .with(true, () => ({
          searchingFen: swapMove(finalFen || INITIAL_FEN),
          searchingMoves: [],
        }))
        .with(false, () => ({
          searchingFen: fen,
          searchingMoves: moves,
        }))
        .exhaustive(),
    [fen, moves, threat, finalFen],
  );

  const firstEngineWithLines = useAtomValue(
    firstEngineWithLinesFamily({
      fen: searchingFen,
      gameMoves: searchingMoves,
    }),
  );

  return (engines ?? [])
    .filter((e) => e.loaded)
    .map((e) => (
      <EngineListener
        key={e.id}
        engine={e}
        firstEngineWithLines={firstEngineWithLines}
        isGameOver={isGameOver}
        finalFen={finalFen || ""}
        searchingFen={searchingFen}
        searchingMoves={searchingMoves}
        fen={fen}
        moves={moves}
        threat={threat}
      />
    ));
}

function EngineListener({
  engine,
  firstEngineWithLines,
  isGameOver,
  finalFen,
  searchingFen,
  searchingMoves,
  fen,
  moves,
  threat,
}: {
  engine: Engine;
  firstEngineWithLines: string | null;
  isGameOver: boolean;
  finalFen: string;
  searchingFen: string;
  searchingMoves: string[];
  fen: string;
  moves: string[];
  threat: boolean;
}) {
  const store = useContext(TreeStateContext)!;
  const setScore = useStore(store, (s) => s.setScore);
  const activeTab = useAtomValue(activeTabAtom);

  const [, setProgress] = useAtom(engineProgressFamily({ engine: engine.id, tab: activeTab! }));

  const [, setEngineVariation] = useAtom(engineMovesFamily({ engine: engine.id, tab: activeTab! }));
  const [settings] = useAtom(
    tabEngineSettingsFamily({
      engineId: engine.id,
      defaultSettings: engine.settings ?? undefined,
      defaultGo: engine.go ?? undefined,
      tab: activeTab!,
    }),
  );
  const settingsFingerprint = JSON.stringify({
    enabled: settings.enabled,
    go: settings.go,
    options: settings.settings,
    engine: engine.id,
  });
  const generation = useRef(0);
  const requestFingerprint = `${activeTab}\u0000${searchingFen}\u0000${searchingMoves.join("\u0000")}\u0000${settingsFingerprint}`;
  const currentFingerprint = useRef(requestFingerprint);
  currentFingerprint.current = requestFingerprint;
  const onBestMoves = useCallback(
    ({ payload }: { payload: BestMovesPayload }) => {
      const ev = payload.bestLines;
      if (
        payload.engine === engine.id &&
        payload.tab === activeTab &&
        payload.fen === searchingFen &&
        equal(payload.moves, searchingMoves) &&
        settings.enabled &&
        !isGameOver &&
        currentFingerprint.current === requestFingerprint &&
        ev.length > 0 &&
        ev.every(
          (line) =>
            line && line.score && Array.isArray(line.uciMoves) && Array.isArray(line.sanMoves),
        )
      ) {
        startTransition(() => {
          setEngineVariation((prev) => {
            const newMap = new Map(prev);
            newMap.set(`${searchingFen}:${searchingMoves.join(",")}`, ev);
            if (threat) {
              newMap.delete(`${fen}:${moves.join(",")}`);
            } else if (finalFen) {
              newMap.delete(`${swapMove(finalFen)}:`);
            }
            return newMap;
          });
          setProgress(payload.progress);
          const shouldSetScore =
            firstEngineWithLines === engine.id || firstEngineWithLines === null;
          if (shouldSetScore) {
            setScore(ev[0].score);
          }
        });
      }
    },
    [
      activeTab,
      setScore,
      settings.enabled,
      isGameOver,
      searchingFen,
      searchingMoves,
      engine.id,
      setEngineVariation,
      setProgress,
      firstEngineWithLines,
      requestFingerprint,
      threat,
      fen,
      moves,
      finalFen,
    ],
  );
  const subscribeBestMoves = useCallback(
    (listener: (event: { payload: BestMovesPayload }) => void) =>
      tauriSubscriptions.bestMoves(listener),
    [],
  );
  useTauriListener(subscribeBestMoves, onBestMoves, { onError: notifyListenerError });

  const getBestMoves = useMemo(
    () =>
      match(engine.type)
        .with(
          "local",
          () => (fen: string, goMode: GoMode, options: EngineOptions) =>
            localGetBestMoves(engine as LocalEngine, fen, goMode, options),
        )
        .with("chessdb", () => chessdbGetBestMoves)
        .with("lichess", () => lichessGetBestMoves)
        .exhaustive(),
    [engine],
  );

  useThrottledEffect(
    () => {
      const currentGeneration = ++generation.current;
      const stillCurrent = () =>
        generation.current === currentGeneration &&
        currentFingerprint.current === requestFingerprint;
      if (settings.enabled) {
        // A local engine has one native search slot per tab.  Cancelling it on
        // every identity change gives FEN/settings/go-mode changes a real
        // cancellation boundary instead of merely hiding stale UI results.
        if (engine.type === "local") void stopEngine(engine, activeTab!);
        if (isGameOver) {
          if (engine.type === "local") {
            stopEngine(engine, activeTab!);
          }
        } else {
          const options =
            settings.settings?.map((s) =>
              s.type === "resource" ? s : { ...s, value: s.value.toString() },
            ) ?? [];
          void getBestMoves(activeTab!, settings.go, {
            moves: searchingMoves,
            fen: searchingFen,
            extraOptions: options,
          })
            .then((moves) => {
              if (
                stillCurrent() &&
                moves &&
                moves[1].length > 0 &&
                moves[1].every((line) => line && line.score && Array.isArray(line.uciMoves))
              ) {
                const [progress, bestMoves] = moves;
                setEngineVariation((prev) => {
                  const newMap = new Map(prev);
                  newMap.set(`${searchingFen}:${searchingMoves.join(",")}`, bestMoves);
                  return newMap;
                });
                setProgress(progress);
              }
            })
            .catch(() => {
              // Engine errors are surfaced by their operation/UI path; stale
              // failures must never clear or overwrite newer analysis.
            });
        }
      } else {
        if (engine.type === "local") {
          stopEngine(engine, activeTab!);
        }
      }
    },
    50,
    [
      settings.enabled,
      settingsFingerprint,
      settings.go,
      searchingFen,
      searchingMoves,
      isGameOver,
      activeTab,
      getBestMoves,
      setEngineVariation,
      engine,
      requestFingerprint,
    ],
  );
  return null;
}

export default EvalListener;
