import { tauriSubscriptions } from "@/platform/tauri";
import { errorUnlessCancelled } from "@/platform/errors";
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
  engineNoLinesFamily,
  engineProgressFamily,
  enginesAtom,
  firstEngineWithLinesFamily,
  tabEngineSettingsFamily,
  tabsAtom,
} from "@/state/atoms";
import { getVariationLine } from "@/utils/chess";
import { getBestMoves as chessdbGetBestMoves } from "@/utils/chessdb/api";
import { analysisSearch } from "@/components/panels/analysis/analysisSearch";
import { AnalysisLineMemory } from "@/components/panels/analysis/analysisLineMemory";
import {
  engineIdentity,
  engineLineContext,
} from "@/components/panels/analysis/analysisLineContext";
import { normalizeEngineOptions } from "@/components/engines/engineOptions";
import {
  type Engine,
  type LocalEngine,
  getBestMoves as localGetBestMoves,
  prepareEngineSearch,
  releaseEngineSearch,
  stopEngine,
} from "@/utils/engines";
import { getBestMoves as lichessGetBestMoves } from "@/utils/lichess/api";
import { useTauriListener } from "@/platform/useTauriListener";
import { TreeStateContext } from "../common/TreeStateContext";

type SearchAttempt = {
  fingerprint: string;
  engineIdentity: string;
  tab: string;
  nativeOwner: NativeSearchOwner | null;
  predecessorOwner: NativeSearchOwner | null;
  cancelled: boolean;
  hasLines: boolean;
};

type NativeSearchOwner = {
  engine: LocalEngine;
  tab: string;
  generation: string;
  stopPromise: Promise<boolean> | null;
  releasePromise: Promise<void> | null;
};

function stopNativeOwner(
  owner: NativeSearchOwner,
  onError: (error: unknown) => void,
): Promise<boolean> {
  owner.stopPromise ??= stopEngine(owner.engine, owner.tab, owner.generation).catch((error) => {
    // O1 guarantees the failed stop left no actor serving this generation.
    // Memoize a terminal non-retained outcome so it cannot poison successors.
    onError(error);
    return false;
  });
  return owner.stopPromise;
}

function releaseNativeOwner(
  owner: NativeSearchOwner,
  onError: (error: unknown) => void,
): Promise<void> {
  owner.releasePromise ??= releaseEngineSearch(owner.engine, owner.tab, owner.generation).catch(
    (error) => {
      onError(error);
    },
  );
  return owner.releasePromise;
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

  const { position, searchingFen, searchingMoves, key } = useMemo(
    () => analysisSearch(fen, moves, threat),
    [fen, moves, threat],
  );
  const isGameOver = position?.isEnd() ?? false;

  const firstEngineWithLines = useAtomValue(
    firstEngineWithLinesFamily({
      fen,
      gameMoves: moves,
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
        searchingFen={searchingFen}
        searchingMoves={searchingMoves}
        searchedKey={key}
        threat={threat}
      />
    ));
}

function EngineListener({
  engine,
  firstEngineWithLines,
  isGameOver,
  searchingFen,
  searchingMoves,
  searchedKey,
  threat,
}: {
  engine: Engine;
  firstEngineWithLines: string | null;
  isGameOver: boolean;
  searchingFen: string;
  searchingMoves: string[];
  searchedKey: string;
  threat: boolean;
}) {
  const { t } = useTranslation();
  const store = useContext(TreeStateContext)!;
  const setScore = useStore(store, (s) => s.setScore);
  const activeTab = useAtomValue(activeTabAtom);

  const [, setProgress] = useAtom(engineProgressFamily({ engine: engine.id, tab: activeTab! }));

  const [, setEngineVariation] = useAtom(engineMovesFamily({ engine: engine.id, tab: activeTab! }));
  const [, setNoLinesKey] = useAtom(engineNoLinesFamily({ engine: engine.id, tab: activeTab! }));
  const [settings] = useAtom(
    tabEngineSettingsFamily({
      engineId: engine.id,
      defaultSettings: engine.settings ?? undefined,
      defaultGo: engine.go ?? undefined,
      tab: activeTab!,
    }),
  );
  const settingsFingerprint = JSON.stringify(settings);
  const lineContext = engineLineContext(settings, engine);
  const activeAttempt = useRef<SearchAttempt | null>(null);
  // A preparation does not yet own the previous warm actor. Retain its exact
  // owner until a later stop confirms which search the actor actually served.
  const retainedOwner = useRef<NativeSearchOwner | null>(null);
  const transitionRunning = useRef(false);
  const pendingTransition = useRef<(() => Promise<void>) | null>(null);
  const notifyFailure = useCallback(
    (error: unknown) => notifyUnlessCancelled(t("Common.Error"), error),
    [t],
  );
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
      for (const owner of new Set([
        attempt?.nativeOwner,
        attempt?.predecessorOwner,
        retainedOwner.current,
      ])) {
        if (!owner) continue;
        void releaseNativeOwner(owner, notifyFailure);
      }
    };
  }, [notifyFailure]);
  useEffect(() => {
    const jotaiStore = getDefaultStore();
    const tab = activeTab!;
    let wasClosing = jotaiStore.get(closingTabsAtom).has(tab);
    return jotaiStore.sub(closingTabsAtom, () => {
      const isClosing = jotaiStore.get(closingTabsAtom).has(tab);
      if (isClosing && !wasClosing) {
        const attempt = activeAttempt.current;
        if (attempt?.tab === tab) attempt.cancelled = true;
        setProgress(0);
      } else if (!isClosing && wasClosing) {
        advanceCloseRevision();
      }
      wasClosing = isClosing;
    });
  }, [activeTab, setProgress]);
  const requestFingerprint = JSON.stringify({
    tab: activeTab,
    closeRevision,
    fen: searchingFen,
    moves: searchingMoves,
    settings: settingsFingerprint,
    engine: engineIdentity(engine),
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
      jotaiStore.get(tabsAtom).some((candidate) => candidate.value === attempt.tab) &&
      // Read the engine list itself rather than trusting this component's
      // mount: an engine unloaded while its search was pending is committed
      // to the store before the passive unmount cleanup clears `mounted`.
      (jotaiStore.get(enginesAtom) ?? []).some(
        (candidate) => candidate.loaded && engineIdentity(candidate) === attempt.engineIdentity,
      )
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
        const attempt = activeAttempt.current;
        attempt.hasLines = true;
        setNoLinesKey(null);
        startTransition(() => {
          setEngineVariation((prev) => {
            const newMap = new AnalysisLineMemory(prev);
            const replaced = newMap.remember(searchedKey, ev, attempt);
            const shouldSetScore =
              firstEngineWithLines === engine.id || firstEngineWithLines === null;
            if (replaced && !threat && shouldSetScore) setScore(ev[0].score);
            return newMap;
          });
          setProgress(payload.progress);
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
      setNoLinesKey,
      setProgress,
      firstEngineWithLines,
      threat,
      searchedKey,
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
      engineIdentity: engineIdentity(engine),
      tab: activeTab!,
      nativeOwner: null,
      predecessorOwner: previous?.nativeOwner ?? previous?.predecessorOwner ?? null,
      cancelled: false,
      hasLines: false,
    };
    activeAttempt.current = attempt;
    setNoLinesKey(null);
    if (
      !settings.enabled ||
      previous?.tab !== activeTab ||
      previous?.engineIdentity !== attempt.engineIdentity
    ) {
      for (const owner of new Set([attempt.predecessorOwner, retainedOwner.current])) {
        if (!owner) continue;
        void releaseNativeOwner(owner, notifyFailure);
      }
    }
    setEngineVariation((prev) => {
      const memory = new AnalysisLineMemory(prev);
      if (memory.context !== lineContext) {
        const empty = new AnalysisLineMemory();
        empty.context = lineContext;
        return empty;
      }
      return memory;
    });
    setProgress(0);
    return () => {
      attempt.cancelled = true;
    };
  }, [
    activeTab,
    engine,
    requestFingerprint,
    setEngineVariation,
    setNoLinesKey,
    setProgress,
    settings.enabled,
    settingsFingerprint,
    lineContext,
    notifyFailure,
  ]);

  useEffect(() => {
    const attempt = activeAttempt.current;
    if (!attempt || attempt.fingerprint !== requestFingerprint) return;
    const finishWithoutLines = (error?: unknown) => {
      if (
        engine.type === "local" &&
        isCurrentAttempt(attempt) &&
        !attempt.hasLines &&
        (error === undefined || errorUnlessCancelled(error))
      ) {
        setNoLinesKey(searchedKey);
      }
    };
    const failAttempt = (error: unknown) => {
      if (!isCurrentAttempt(attempt)) return;
      notifyUnlessCancelled(t("Common.Error"), error);
      finishWithoutLines(error);
    };
    const runSearch = async () => {
      // A local engine has one native search slot per tab.  Cancelling it on
      // every identity change gives FEN/settings/go-mode changes a real
      // cancellation boundary instead of merely hiding stale UI results.
      if (attempt.predecessorOwner) {
        if (attempt.predecessorOwner.releasePromise) {
          await attempt.predecessorOwner.releasePromise;
        } else if (await stopNativeOwner(attempt.predecessorOwner, notifyFailure)) {
          retainedOwner.current = attempt.predecessorOwner;
        }
        attempt.predecessorOwner = null;
      }
      if (engine.type === "local") {
        if (!isCurrentAttempt(attempt)) return;
        let nativeGeneration: string;
        try {
          nativeGeneration = await prepareEngineSearch(engine, activeTab!);
        } catch (error) {
          failAttempt(error);
          return;
        }
        if (!isCurrentAttempt(attempt)) {
          try {
            const jotaiStore = getDefaultStore();
            const ownerDisappeared =
              !mounted.current ||
              !enabled.current ||
              jotaiStore.get(activeTabAtom) !== activeTab ||
              !(jotaiStore.get(enginesAtom) ?? []).some(
                (candidate) =>
                  candidate.loaded && engineIdentity(candidate) === attempt.engineIdentity,
              );
            if (ownerDisappeared) await releaseEngineSearch(engine, activeTab!, nativeGeneration);
            else await stopEngine(engine, activeTab!, nativeGeneration);
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
          releasePromise: null,
        };
      }
      if (!isCurrentAttempt(attempt)) return;

      const options = normalizeEngineOptions(settings.settings ?? []);
      // The command lives for the whole search. Only stop and preparation
      // occupy the transition slot; new navigation must be able to stop it.
      void getBestMoves(
        activeTab!,
        settings.go,
        { moves: searchingMoves, fen: searchingFen, extraOptions: options },
        attempt.nativeOwner?.generation ?? "",
      )
        .then((result) => {
          if (
            isCurrentAttempt(attempt) &&
            result &&
            result[1].length > 0 &&
            result[1].every((line) => line && line.score && Array.isArray(line.uciMoves))
          ) {
            const [progress, bestMoves] = result;
            attempt.hasLines = true;
            setNoLinesKey(null);
            setEngineVariation((prev) => {
              const newMap = new AnalysisLineMemory(prev);
              newMap.remember(searchedKey, bestMoves, attempt);
              return newMap;
            });
            setProgress(progress);
          }
          finishWithoutLines();
        })
        .catch(failAttempt);
    };
    // Each queued transition handles terminal failures for its own captured attempt.
    pendingTransition.current = () => runSearch().catch(failAttempt);
    if (transitionRunning.current) return;
    transitionRunning.current = true;
    const drain = async () => {
      try {
        while (pendingTransition.current) {
          const next = pendingTransition.current;
          pendingTransition.current = null;
          await next();
        }
      } finally {
        transitionRunning.current = false;
      }
    };
    void drain();
  }, [
    settings.enabled,
    settingsFingerprint,
    settings.go,
    settings.settings,
    searchingFen,
    searchingMoves,
    isGameOver,
    activeTab,
    getBestMoves,
    setEngineVariation,
    setNoLinesKey,
    setProgress,
    engine,
    requestFingerprint,
    isCurrentAttempt,
    t,
    notifyFailure,
    searchedKey,
  ]);
  return null;
}

export default EvalListener;
