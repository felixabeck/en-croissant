import { tauriSubscriptions } from "@/platform/tauri";
import { parseUci } from "chessops";
import { INITIAL_FEN, makeFen } from "chessops/fen";
import equal from "fast-deep-equal";
import { getDefaultStore, useAtom, useAtomValue } from "jotai";
import {
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { type BestMovesPayload, type EngineOptions, type GoMode } from "@/bindings";
import { notifyListenerError, notifyUnlessCancelled } from "@/components/files/notifyError";
import {
  activeTabAtom,
  closingTabsAtom,
  currentThreatAtom,
  engineMovesFamily,
  engineProgressFamily,
  enginesAtom,
  firstEngineWithLinesFamily,
  tabEngineSettingsFamily,
  tabsAtom,
} from "@/state/atoms";
import { getVariationLine } from "@/utils/chess";
import { getBestMoves as chessdbGetBestMoves } from "@/utils/chessdb/api";
import { positionFromFen, swapMove } from "@/utils/chessops";
import { normalizeEngineOptions } from "@/utils/engineOptions";
import {
  type Engine,
  type LocalEngine,
  getBestMoves as localGetBestMoves,
  prepareEngineSearch,
  stopEngine,
} from "@/utils/engines";
import { getBestMoves as lichessGetBestMoves } from "@/utils/lichess/api";
import { useThrottledEffect } from "@/utils/misc";
import { useTauriListener } from "@/platform/useTauriListener";
import { TreeStateContext } from "../common/TreeStateContext";

type SearchAttempt = {
  fingerprint: string;
  tab: string;
  nativeOwner: NativeSearchOwner | null;
  predecessorOwner: NativeSearchOwner | null;
  cancelled: boolean;
};

type NativeSearchOwner = {
  engine: LocalEngine;
  tab: string;
  generation: string;
  stopPromise: Promise<void> | null;
};

function stopNativeOwner(owner: NativeSearchOwner): Promise<void> {
  owner.stopPromise ??= stopEngine(owner.engine, owner.tab, owner.generation);
  return owner.stopPromise;
}

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
  const { t } = useTranslation();
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
  const settingsFingerprint = JSON.stringify(settings);
  const activeAttempt = useRef<SearchAttempt | null>(null);
  const [closeRevision, advanceCloseRevision] = useReducer((revision: number) => revision + 1, 0);
  const mounted = useRef(false);
  const enabled = useRef(settings.enabled);
  const gameOver = useRef(isGameOver);
  enabled.current = settings.enabled;
  gameOver.current = isGameOver;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const attempt = activeAttempt.current;
      const owner = attempt?.nativeOwner ?? attempt?.predecessorOwner;
      if (owner) {
        void stopNativeOwner(owner).catch((error) =>
          notifyUnlessCancelled(t("Common.Error"), error),
        );
      }
    };
  }, [t]);
  useEffect(() => {
    const jotaiStore = getDefaultStore();
    const tab = activeTab!;
    let wasClosing = jotaiStore.get(closingTabsAtom).has(tab);
    return jotaiStore.sub(closingTabsAtom, () => {
      const isClosing = jotaiStore.get(closingTabsAtom).has(tab);
      if (isClosing && !wasClosing) {
        const attempt = activeAttempt.current;
        if (attempt?.tab === tab) attempt.cancelled = true;
        setEngineVariation(new Map());
        setProgress(0);
      } else if (!isClosing && wasClosing) {
        advanceCloseRevision();
      }
      wasClosing = isClosing;
    });
  }, [activeTab, setEngineVariation, setProgress]);
  const requestFingerprint = JSON.stringify({
    tab: activeTab,
    closeRevision,
    fen: searchingFen,
    moves: searchingMoves,
    settings: settingsFingerprint,
    engine:
      engine.type === "local"
        ? { type: engine.type, id: engine.id, handle: engine.handle }
        : { type: engine.type, id: engine.id, url: engine.url },
  });
  const currentFingerprint = useRef(requestFingerprint);
  currentFingerprint.current = requestFingerprint;
  const isCurrentAttempt = useCallback((attempt: SearchAttempt) => {
    const jotaiStore = getDefaultStore();
    return (
      mounted.current &&
      activeAttempt.current === attempt &&
      !attempt.cancelled &&
      currentFingerprint.current === attempt.fingerprint &&
      enabled.current &&
      !gameOver.current &&
      !jotaiStore.get(closingTabsAtom).has(attempt.tab) &&
      jotaiStore.get(tabsAtom).some((candidate) => candidate.value === attempt.tab)
    );
  }, []);
  const onBestMoves = useCallback(
    ({ payload }: { payload: BestMovesPayload }) => {
      const ev = payload.bestLines;
      if (
        payload.engine === engine.id &&
        payload.tab === activeTab &&
        payload.fen === searchingFen &&
        equal(payload.moves, searchingMoves) &&
        activeAttempt.current?.nativeOwner?.generation === payload.generation &&
        activeAttempt.current !== null &&
        isCurrentAttempt(activeAttempt.current) &&
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
      searchingFen,
      searchingMoves,
      engine.id,
      setEngineVariation,
      setProgress,
      firstEngineWithLines,
      threat,
      fen,
      moves,
      finalFen,
      isCurrentAttempt,
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
          () => (tab: string, goMode: GoMode, options: EngineOptions, generation: string) =>
            localGetBestMoves(engine as LocalEngine, tab, goMode, options, generation),
        )
        .with(
          "chessdb",
          () => (tab: string, goMode: GoMode, options: EngineOptions) =>
            chessdbGetBestMoves(tab, goMode, options),
        )
        .with(
          "lichess",
          () => (tab: string, goMode: GoMode, options: EngineOptions) =>
            lichessGetBestMoves(tab, goMode, options),
        )
        .exhaustive(),
    [engine],
  );

  useEffect(() => {
    const previous = activeAttempt.current;
    if (previous) previous.cancelled = true;
    const attempt: SearchAttempt = {
      fingerprint: requestFingerprint,
      tab: activeTab!,
      nativeOwner: null,
      predecessorOwner: previous?.nativeOwner ?? previous?.predecessorOwner ?? null,
      cancelled: false,
    };
    activeAttempt.current = attempt;
    setEngineVariation(new Map());
    setProgress(0);
    return () => {
      attempt.cancelled = true;
    };
  }, [activeTab, engine, requestFingerprint, setEngineVariation, setProgress]);

  useThrottledEffect(
    () => {
      const attempt = activeAttempt.current;
      if (!attempt || attempt.fingerprint !== requestFingerprint) return;
      const runSearch = async () => {
        // A local engine has one native search slot per tab.  Cancelling it on
        // every identity change gives FEN/settings/go-mode changes a real
        // cancellation boundary instead of merely hiding stale UI results.
        try {
          if (attempt.predecessorOwner) {
            await stopNativeOwner(attempt.predecessorOwner);
            attempt.predecessorOwner = null;
          }
        } catch (error) {
          if (isCurrentAttempt(attempt)) notifyUnlessCancelled(t("Common.Error"), error);
          return;
        }
        if (engine.type === "local") {
          if (!isCurrentAttempt(attempt)) return;
          let nativeGeneration: string;
          try {
            nativeGeneration = await prepareEngineSearch(engine, activeTab!);
          } catch (error) {
            if (isCurrentAttempt(attempt)) notifyUnlessCancelled(t("Common.Error"), error);
            return;
          }
          if (!isCurrentAttempt(attempt)) {
            try {
              await stopEngine(engine, activeTab!, nativeGeneration);
            } catch (error) {
              notifyUnlessCancelled(t("Common.Error"), error);
            }
            return;
          }
          attempt.nativeOwner = {
            engine,
            tab: activeTab!,
            generation: nativeGeneration,
            stopPromise: null,
          };
        }
        if (!isCurrentAttempt(attempt)) return;

        const options = normalizeEngineOptions(settings.settings ?? []);
        try {
          const result = await getBestMoves(
            activeTab!,
            settings.go,
            { moves: searchingMoves, fen: searchingFen, extraOptions: options },
            attempt.nativeOwner?.generation ?? "",
          );
          if (
            isCurrentAttempt(attempt) &&
            result &&
            result[1].length > 0 &&
            result[1].every((line) => line && line.score && Array.isArray(line.uciMoves))
          ) {
            const [progress, bestMoves] = result;
            setEngineVariation((prev) => {
              const newMap = new Map(prev);
              newMap.set(`${searchingFen}:${searchingMoves.join(",")}`, bestMoves);
              return newMap;
            });
            setProgress(progress);
          }
        } catch (error) {
          if (isCurrentAttempt(attempt)) {
            notifyUnlessCancelled(t("Common.Error"), error);
          }
        }
      };
      runSearch().catch((error) => notifyUnlessCancelled(t("Common.Error"), error));
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
      isCurrentAttempt,
      t,
    ],
  );
  return null;
}

export default EvalListener;
