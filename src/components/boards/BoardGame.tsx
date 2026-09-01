import { tauri, tauriSubscriptions } from "@/platform/tauri";
import {
  Box,
  Button,
  Checkbox,
  Divider,
  Group,
  NumberInput,
  Paper,
  Portal,
  ScrollArea,
  SegmentedControl,
  Stack,
  Text,
} from "@mantine/core";
import { useToggle } from "@mantine/hooks";
import {
  IconArrowsExchange,
  IconFileText,
  IconPlus,
  IconX,
  IconZoomCheck,
} from "@tabler/icons-react";
import type { Piece } from "chessops";
import type { Key } from "@lichess-org/chessground/types";
import { makeUci, parseUci } from "chessops";
import { INITIAL_FEN } from "chessops/fen";
import { useAtom, useAtomValue } from "jotai";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";
import { useStore } from "zustand";
import type { Outcome } from "@/bindings";
import { type EngineLog, type GameConfig, type GameResult } from "@/bindings";
import type { ChessgroundRef } from "@/chessground/Chessground";
import { notifyListenerError, runUnlessCancelled } from "@/components/files/notifyError";
import {
  activeTabAtom,
  flipBoardAfterMoveAtom,
  currentGameIdAtom,
  currentGameSessionAtom,
  currentGameStateAtom,
  currentPlayersAtom,
  gameInputColorAtom,
  gameOpeningBookEnabledAtom,
  gameOpeningBookMaxPlyAtom,
  gameOpeningBookHandleAtom,
  gamePlayer1SettingsAtom,
  gamePlayer2SettingsAtom,
  gameSameTimeControlAtom,
  tabsAtom,
} from "@/state/atoms";
import { positionFromFen } from "@/utils/chessops";
import { useTauriListener } from "@/platform/useTauriListener";
import type { GameHeaders } from "@/utils/treeReducer";
import EngineLogsView from "../common/EngineLogsView";
import FileInput from "../common/FileInput";
import GameInfo from "../common/GameInfo";
import GameNotation from "../common/GameNotation";
import MoveControls from "../common/MoveControls";
import { TreeStateContext } from "../common/TreeStateContext";
import Board from "./Board";
import IconAction from "../common/IconAction";
import BoardControls from "./BoardControls";
import EditingCard from "./EditingCard";
import {
  isCurrentQueuedGameUpdate,
  isLiveGameSession,
  nextAcceptedGameRevision,
  SingleFlightGuard,
} from "./gameSession";
import { OpponentForm, type OpponentSettings } from "./OpponentForm";
import { toPlayerConfig } from "./playerConfig";

function gameResultToOutcome(result: GameResult): Outcome {
  if (result.type === "whiteWins") return "1-0";
  if (result.type === "blackWins") return "0-1";
  return "1/2-1/2";
}

type BackendMove = { uci: string; clock: number | null };

function mapBackendMoves(moves: { uci: string; clock: bigint | null }[]): BackendMove[] {
  return moves.map((m) => ({
    uci: m.uci,
    clock: m.clock !== null ? Number(m.clock) : null,
  }));
}

function BoardGame() {
  const { t } = useTranslation();
  const activeTab = useAtomValue(activeTabAtom);

  const [editingMode, toggleEditingMode] = useToggle();
  const [selectedPiece, setSelectedPiece] = useState<Piece | null>(null);

  const [inputColor, setInputColor] = useAtom(gameInputColorAtom);
  function cycleColor() {
    setInputColor((prev) =>
      match(prev)
        .with("white", () => "black" as const)
        .with("black", () => "random" as const)
        .with("random", () => "white" as const)
        .exhaustive(),
    );
  }

  const [player1Settings, setPlayer1Settings] = useAtom(gamePlayer1SettingsAtom);
  const [player2Settings, setPlayer2Settings] = useAtom(gamePlayer2SettingsAtom);

  function getPlayers() {
    let isPlayer1White = inputColor === "white";

    if (inputColor === "random") {
      isPlayer1White = Math.random() > 0.5;
    }

    return {
      white: isPlayer1White ? player1Settings : player2Settings,
      black: isPlayer1White ? player2Settings : player1Settings,
    };
  }

  const store = useContext(TreeStateContext)!;
  const root = useStore(store, (s) => s.root);
  const headers = useStore(store, (s) => s.headers);
  const setFen = useStore(store, (s) => s.setFen);
  const setHeaders = useStore(store, (s) => s.setHeaders);
  const setResult = useStore(store, (s) => s.setResult);
  const appendMove = useStore(store, (s) => s.appendMove);
  const resetTree = useStore(store, (s) => s.reset);

  const [, setTabs] = useAtom(tabsAtom);
  const autoFlipBoard = useAtomValue(flipBoardAfterMoveAtom);

  const boardRef = useRef(null);
  const cgRef = useRef<ChessgroundRef>(null);
  const [gameState, setGameState] = useAtom(currentGameStateAtom);
  const [players, setPlayers] = useAtom(currentPlayersAtom);

  const [whiteTime, setWhiteTime] = useState<number | null>(null);
  const [blackTime, setBlackTime] = useState<number | null>(null);
  const [gameId, setGameId] = useAtom(currentGameIdAtom);
  const [backendSession, setBackendSession] = useAtom(currentGameSessionAtom);
  const liveGameIdRef = useRef<string | null>(gameId);
  liveGameIdRef.current = gameId;
  const sessionGenerationRef = useRef(0);
  const backendSessionRef = useRef<bigint | null>(backendSession);
  backendSessionRef.current = backendSession;
  const latestRevisionRef = useRef(BigInt(-1));
  const pendingMovesRef = useRef<{ uci: string; clock: number | null }[] | null>(null);
  const pendingTimesRef = useRef<{
    white: number | null;
    black: number | null;
  } | null>(null);
  const queuedUpdateGenerationRef = useRef<number | null>(null);
  const queuedUpdateSessionRef = useRef<bigint | null>(null);
  const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const premoveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startInFlightRef = useRef<Promise<void> | null>(null);
  const moveInFlightRef = useRef(false);
  const takeBackGuardRef = useRef(new SingleFlightGuard());
  const [pendingCommand, setPendingCommand] = useState<
    "start" | "move" | "takeback" | "abort" | "resign" | null
  >(null);
  const [commandError, setCommandError] = useState<string | null>(null);
  const clearQueuedGameUpdates = useCallback(() => {
    if (throttleTimerRef.current) clearTimeout(throttleTimerRef.current);
    if (premoveTimerRef.current) clearTimeout(premoveTimerRef.current);
    throttleTimerRef.current = null;
    premoveTimerRef.current = null;
    pendingMovesRef.current = null;
    pendingTimesRef.current = null;
    queuedUpdateGenerationRef.current = null;
    queuedUpdateSessionRef.current = null;
  }, []);
  const invalidateSession = useCallback(() => {
    clearQueuedGameUpdates();
    sessionGenerationRef.current += 1;
    backendSessionRef.current = null;
    setBackendSession(null);
  }, [clearQueuedGameUpdates, setBackendSession]);
  const abortLiveSession = useCallback(() => {
    const liveGameId = liveGameIdRef.current;
    const expectedSession = backendSessionRef.current;
    invalidateSession();
    if (liveGameId && expectedSession !== null) void tauri.abortGame(liveGameId, expectedSession);
  }, [invalidateSession]);
  const acceptAuthoritativeRevision = useCallback(
    (payload: unknown, allowSessionAdoption = false): boolean => {
      const nextRevision = nextAcceptedGameRevision(
        latestRevisionRef.current,
        backendSessionRef.current,
        payload,
        allowSessionAdoption,
      );
      if (nextRevision === null) return false;
      if (
        backendSessionRef.current === null &&
        payload &&
        typeof payload === "object" &&
        "session" in payload
      ) {
        if (typeof payload.session === "bigint") {
          backendSessionRef.current = payload.session;
          setBackendSession(payload.session);
        }
      }
      latestRevisionRef.current = nextRevision;
      return true;
    },
    [setBackendSession],
  );

  const [logsOpened, toggleLogsOpened] = useToggle();
  const [logsColor, setLogsColor] = useState<"white" | "black">("white");
  const [engineLogs, setEngineLogs] = useState<EngineLog[]>([]);
  const [openingBookHandle, setOpeningBookHandle] = useAtom(gameOpeningBookHandleAtom);
  const [openingBookEnabled, setOpeningBookEnabled] = useAtom(gameOpeningBookEnabledAtom);
  const [openingBookMaxPly, setOpeningBookMaxPly] = useAtom(gameOpeningBookMaxPlyAtom);

  const hasEngine = players.white.type === "engine" || players.black.type === "engine";

  const isPlayerVsEngine =
    (players.white.type === "human" && players.black.type === "engine") ||
    (players.black.type === "human" && players.white.type === "engine");

  const orientation = headers.orientation || "white";
  const toggleOrientation = useCallback(() => {
    setHeaders({
      ...headers,
      fen: root.fen,
      orientation: orientation === "black" ? "white" : "black",
    });
  }, [headers, root.fen, orientation, setHeaders]);

  const fetchEngineLogs = useCallback(async () => {
    const expectedSession = backendSession;
    if (!gameId || expectedSession === null || !hasEngine) return;
    const generation = sessionGenerationRef.current;
    let color = logsColor;
    if (players.white.type === "human" && players.black.type === "engine") {
      color = "black";
    } else if (players.black.type === "human" && players.white.type === "engine") {
      color = "white";
    }
    const logs = await runUnlessCancelled(t("Common.Error"), () =>
      tauri.getGameEngineLogs(gameId, expectedSession, color),
    );
    if (!logs) return;
    if (
      generation === sessionGenerationRef.current &&
      liveGameIdRef.current === gameId &&
      backendSessionRef.current === expectedSession
    ) {
      setEngineLogs(logs);
    }
  }, [gameId, logsColor, hasEngine, players.white.type, players.black.type, backendSession, t]);

  useEffect(() => {
    if (logsOpened) {
      fetchEngineLogs();
    }
  }, [logsOpened, fetchEngineLogs]);

  const syncTreeWithMoves = useCallback(
    (backendMoves: BackendMove[]) => {
      const treeMoves: string[] = [];
      let node = root;
      while (node.children.length > 0) {
        node = node.children[0];
        if (node.move) {
          treeMoves.push(makeUci(node.move));
        }
      }

      let needsReset = false;
      for (let i = 0; i < treeMoves.length; i++) {
        if (i >= backendMoves.length || treeMoves[i] !== backendMoves[i].uci) {
          needsReset = true;
          break;
        }
      }

      if (needsReset) {
        setFen(root.fen);
        for (const move of backendMoves) {
          const parsed = parseUci(move.uci);
          if (parsed) {
            appendMove({
              payload: parsed,
              clock: move.clock !== null ? Number(move.clock) : undefined,
            });
          }
        }
        return true;
      }

      if (backendMoves.length > treeMoves.length) {
        for (let i = treeMoves.length; i < backendMoves.length; i++) {
          const move = backendMoves[i];
          const parsed = parseUci(move.uci);
          if (parsed) {
            appendMove({
              payload: parsed,
              clock: move.clock !== null ? Number(move.clock) : undefined,
            });
          }
        }
        return true;
      }

      return false;
    },
    [root, setFen, appendMove],
  );

  function changeToAnalysisMode() {
    setTabs((prev) =>
      prev.map((tab) => (tab.value === activeTab ? { ...tab, type: "analysis" } : tab)),
    );
  }

  const [pos, error] = useMemo(() => {
    let node = root;
    while (node.children.length > 0) {
      node = node.children[0];
    }
    return positionFromFen(node.fen);
  }, [root]);

  function getTreeMoves(): string[] {
    const moves: string[] = [];
    let node = root;
    while (node.children.length > 0) {
      node = node.children[0];
      if (node.move) {
        moves.push(makeUci(node.move));
      }
    }
    return moves;
  }

  async function startGame() {
    if (startInFlightRef.current) return startInFlightRef.current;
    // A replacement must atomically detach every buffered render update from the
    // old native session before the new game id becomes observable.
    invalidateSession();
    const generation = sessionGenerationRef.current;
    latestRevisionRef.current = BigInt(-1);
    const run = async () => {
      setPendingCommand("start");
      setCommandError(null);
      // The try opens before the config is built, not at the first await: toPlayerConfig throws
      // for an engine player with no local engine selected. Outside the try that throw escaped
      // run(), so the finally never cleared pendingCommand and the button stayed disabled with
      // no error shown.
      try {
        const playerSettings = getPlayers();
        setPlayers(playerSettings);

        const boardOrientation =
          playerSettings.black.type === "human" && playerSettings.white.type === "engine"
            ? "black"
            : "white";

        // The backend event payload carries only an id. A monotonically unique id per
        // start makes delayed events from a prior session unambiguously discardable.
        const newGameId = `${activeTab}-game-${generation}`;
        setGameId(newGameId);

        const initialMoves = getTreeMoves();

        const config: GameConfig = {
          white: toPlayerConfig(playerSettings.white),
          black: toPlayerConfig(playerSettings.black),
          whiteTimeControl: playerSettings.white.timeControl
            ? {
                initialTime: playerSettings.white.timeControl.seconds,
                increment: playerSettings.white.timeControl.increment ?? 0,
              }
            : null,
          blackTimeControl: playerSettings.black.timeControl
            ? {
                initialTime: playerSettings.black.timeControl.seconds,
                increment: playerSettings.black.timeControl.increment ?? 0,
              }
            : null,
          initialFen: root.fen === INITIAL_FEN ? null : root.fen,
          initialMoves,
          openingBook:
            openingBookEnabled && openingBookHandle
              ? { book: openingBookHandle, maxPly: Math.max(1, openingBookMaxPly) }
              : null,
        } as GameConfig;

        const state = await tauri.startGame(newGameId, config);
        if (
          sessionGenerationRef.current !== generation ||
          !acceptAuthoritativeRevision(state, true)
        ) {
          await tauri.abortGame(newGameId, state.session);
          return;
        }

        setWhiteTime(state.whiteTime !== null ? Number(state.whiteTime) : null);
        setBlackTime(state.blackTime !== null ? Number(state.blackTime) : null);

        setGameState("playing");

        setFen(state.initialFen);
        for (const move of mapBackendMoves(state.moves)) {
          const parsed = parseUci(move.uci);
          if (parsed) {
            appendMove({
              payload: parsed,
              clock: move.clock ?? undefined,
            });
          }
        }

        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, ".");
        const timeStr = now.toISOString().slice(11, 19);

        const whiteIsEngine = playerSettings.white.type === "engine";
        const blackIsEngine = playerSettings.black.type === "engine";
        let eventStr = "Casual Game";
        if (whiteIsEngine && blackIsEngine) {
          eventStr = "Engine Match";
        } else if (whiteIsEngine || blackIsEngine) {
          eventStr = "Player vs Engine";
        } else {
          eventStr = "Player Match";
        }

        const formatTimeControl = (settings: OpponentSettings): string => {
          if (!settings.timeControl) return "-";
          const seconds = settings.timeControl.seconds / 1000;
          const increment = (settings.timeControl.increment ?? 0) / 1000;
          return increment ? `${seconds}+${increment}` : `${seconds}`;
        };

        const whiteTimeControl = formatTimeControl(playerSettings.white);
        const blackTimeControl = formatTimeControl(playerSettings.black);
        const sameTimeControl = whiteTimeControl === blackTimeControl;

        const newHeaders: Partial<GameHeaders> = {
          white: state.whitePlayer,
          black: state.blackPlayer,
          event: eventStr,
          site: "En Croissant",
          date: dateStr,
          time: timeStr,
          time_control: undefined,
          orientation: boardOrientation,
        };

        if (sameTimeControl) {
          if (whiteTimeControl !== "-") {
            newHeaders.time_control = whiteTimeControl;
          }
        } else {
          newHeaders.white_time_control = whiteTimeControl;
          newHeaders.black_time_control = blackTimeControl;
        }

        setHeaders({
          ...headers,
          ...newHeaders,
          fen: state.initialFen,
        });

        setTabs((prev) =>
          prev.map((tab) =>
            tab.value === activeTab
              ? { ...tab, name: `${state.whitePlayer} vs. ${state.blackPlayer}` }
              : tab,
          ),
        );
      } catch (err) {
        console.error("Failed to start game:", err);
        if (sessionGenerationRef.current === generation) {
          setCommandError(err instanceof Error ? err.message : "Unable to start the game.");
        }
      } finally {
        if (sessionGenerationRef.current === generation) setPendingCommand(null);
      }
    };
    const promise = run();
    startInFlightRef.current = promise;
    try {
      await promise;
    } finally {
      if (startInFlightRef.current === promise) startInFlightRef.current = null;
    }
  }

  const handleHumanMove = useCallback(
    async (uci: string): Promise<boolean> => {
      if (!gameId || gameState !== "playing" || moveInFlightRef.current) return false;
      const generation = sessionGenerationRef.current;
      const expectedSession = backendSessionRef.current;
      if (expectedSession === null) return false;
      moveInFlightRef.current = true;
      setPendingCommand("move");
      setCommandError(null);
      try {
        const state = await tauri.makeGameMove(gameId, expectedSession, uci);
        if (
          generation !== sessionGenerationRef.current ||
          liveGameIdRef.current !== gameId ||
          state.gameId !== gameId ||
          !acceptAuthoritativeRevision(state)
        ) {
          return false;
        }
        syncTreeWithMovesRef.current(mapBackendMoves(state.moves));
        setWhiteTime(state.whiteTime !== null ? Number(state.whiteTime) : null);
        setBlackTime(state.blackTime !== null ? Number(state.blackTime) : null);
        if (!isPlayerVsEngine && autoFlipBoard) {
          toggleOrientation();
        }
        return true;
      } catch (err) {
        console.error("Failed to make move:", err);
        setCommandError(err instanceof Error ? err.message : "Move rejected. Please try again.");
        // The command response is authoritative; recover from a rejected/stale
        // submission instead of leaving a speculative UI line behind.
        void tauri.getGameState(gameId, expectedSession).then((state) => {
          if (
            generation === sessionGenerationRef.current &&
            liveGameIdRef.current === gameId &&
            state.gameId === gameId &&
            acceptAuthoritativeRevision(state)
          ) {
            syncTreeWithMovesRef.current(mapBackendMoves(state.moves));
          }
        });
        return false;
      } finally {
        moveInFlightRef.current = false;
        setPendingCommand(null);
      }
    },
    [
      gameId,
      gameState,
      toggleOrientation,
      isPlayerVsEngine,
      autoFlipBoard,
      acceptAuthoritativeRevision,
    ],
  );

  const queueKeyboardPremove = useCallback((from: Key, to: Key) => {
    return cgRef.current?.queuePremove(from, to) ?? false;
  }, []);

  const THROTTLE_MS = 150;

  const syncTreeWithMovesRef = useRef(syncTreeWithMoves);
  syncTreeWithMovesRef.current = syncTreeWithMoves;

  const applyPendingUpdates = useCallback(() => {
    const queuedGeneration = queuedUpdateGenerationRef.current;
    const queuedSession = queuedUpdateSessionRef.current;
    const isCurrent = isCurrentQueuedGameUpdate(
      queuedGeneration,
      sessionGenerationRef.current,
      queuedSession,
      backendSessionRef.current,
    );
    throttleTimerRef.current = null;
    if (!isCurrent) {
      clearQueuedGameUpdates();
      return;
    }
    if (pendingMovesRef.current) {
      syncTreeWithMovesRef.current(pendingMovesRef.current);
      pendingMovesRef.current = null;
    }
    if (pendingTimesRef.current) {
      setWhiteTime(pendingTimesRef.current.white);
      setBlackTime(pendingTimesRef.current.black);
      pendingTimesRef.current = null;
    }
    queuedUpdateGenerationRef.current = null;
    queuedUpdateSessionRef.current = null;

    premoveTimerRef.current = setTimeout(() => {
      if (
        isCurrentQueuedGameUpdate(
          queuedGeneration,
          sessionGenerationRef.current,
          queuedSession,
          backendSessionRef.current,
        )
      ) {
        cgRef.current?.playPremove();
      }
      premoveTimerRef.current = null;
    }, 0);
  }, [clearQueuedGameUpdates]);

  const scheduleUpdate = useCallback(() => {
    if (!throttleTimerRef.current) {
      throttleTimerRef.current = setTimeout(applyPendingUpdates, THROTTLE_MS);
    }
  }, [applyPendingUpdates]);

  const onTakeBack = useCallback(async () => {
    if (!gameId || gameState !== "playing" || !takeBackGuardRef.current.acquire()) return;
    const generation = sessionGenerationRef.current;
    const expectedSession = backendSessionRef.current;
    if (expectedSession === null) {
      takeBackGuardRef.current.release();
      return;
    }
    setPendingCommand("takeback");
    setCommandError(null);
    try {
      const state = await tauri.takeBackGameMove(gameId, expectedSession);
      if (
        generation === sessionGenerationRef.current &&
        liveGameIdRef.current === gameId &&
        state.gameId === gameId &&
        acceptAuthoritativeRevision(state)
      ) {
        syncTreeWithMovesRef.current(mapBackendMoves(state.moves));
        setWhiteTime(state.whiteTime !== null ? Number(state.whiteTime) : null);
        setBlackTime(state.blackTime !== null ? Number(state.blackTime) : null);
      }
    } catch (err) {
      setCommandError(err instanceof Error ? err.message : "Unable to take back the move.");
    } finally {
      takeBackGuardRef.current.release();
      setPendingCommand(null);
    }
  }, [gameId, gameState, acceptAuthoritativeRevision]);

  const subscribeGameMove = useCallback(
    (listener: Parameters<typeof tauriSubscriptions.gameMove>[0]) =>
      tauriSubscriptions.gameMove(listener),
    [],
  );
  useTauriListener(
    subscribeGameMove,
    ({ payload }) => {
      if (
        gameState !== "playing" ||
        payload.gameId !== gameId ||
        !acceptAuthoritativeRevision(payload)
      )
        return;

      pendingMovesRef.current = mapBackendMoves(payload.moves);
      pendingTimesRef.current = {
        white: payload.whiteTime !== null ? Number(payload.whiteTime) : null,
        black: payload.blackTime !== null ? Number(payload.blackTime) : null,
      };
      queuedUpdateGenerationRef.current = sessionGenerationRef.current;
      queuedUpdateSessionRef.current = payload.session;
      scheduleUpdate();
    },
    { onError: notifyListenerError },
  );

  const subscribeClockUpdate = useCallback(
    (listener: Parameters<typeof tauriSubscriptions.clockUpdate>[0]) =>
      tauriSubscriptions.clockUpdate(listener),
    [],
  );
  useTauriListener(
    subscribeClockUpdate,
    ({ payload }) => {
      if (
        gameState !== "playing" ||
        payload.gameId !== gameId ||
        !acceptAuthoritativeRevision(payload)
      )
        return;
      setWhiteTime(payload.whiteTime !== null ? Number(payload.whiteTime) : null);
      setBlackTime(payload.blackTime !== null ? Number(payload.blackTime) : null);
    },
    { onError: notifyListenerError },
  );

  const subscribeGameOver = useCallback(
    (listener: Parameters<typeof tauriSubscriptions.gameOver>[0]) =>
      tauriSubscriptions.gameOver(listener),
    [],
  );
  useTauriListener(
    subscribeGameOver,
    ({ payload }) => {
      if (
        gameState !== "playing" ||
        payload.gameId !== gameId ||
        !acceptAuthoritativeRevision(payload)
      )
        return;

      clearQueuedGameUpdates();

      syncTreeWithMovesRef.current(mapBackendMoves(payload.moves));

      setGameState("gameOver");
      setResult(gameResultToOutcome(payload.result));
    },
    { onError: notifyListenerError },
  );

  useEffect(() => {
    return () => {
      clearQueuedGameUpdates();
    };
  }, [clearQueuedGameUpdates]);

  useEffect(() => {
    let cancelled = false;
    if (gameState === "playing" && gameId) {
      const polledGameId = gameId;
      const expectedSession = backendSessionRef.current;
      if (expectedSession === null) return;
      tauri.getGameState(gameId, expectedSession).then((state) => {
        if (
          isLiveGameSession(liveGameIdRef.current, polledGameId, cancelled) &&
          state.gameId === polledGameId &&
          acceptAuthoritativeRevision(state)
        ) {
          syncTreeWithMovesRef.current(mapBackendMoves(state.moves));

          setWhiteTime(state.whiteTime !== null ? Number(state.whiteTime) : null);
          setBlackTime(state.blackTime !== null ? Number(state.blackTime) : null);

          if (state.status !== "playing") {
            setGameState("gameOver");
            if (typeof state.status === "object" && "finished" in state.status) {
              setResult(gameResultToOutcome(state.status.finished.result));
            }
          }
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [gameId, gameState, setGameState, setResult, acceptAuthoritativeRevision, backendSession]);

  const movable = useMemo(() => {
    if (players.white.type === "human" && players.black.type === "human") {
      return "turn";
    }
    if (players.white.type === "human") {
      return "white";
    }
    if (players.black.type === "human") {
      return "black";
    }
    return "none";
  }, [players]);

  const [sameTimeControl, setSameTimeControl] = useAtom(gameSameTimeControlAtom);

  const onePlayerIsEngine = players.white.type !== players.black.type;
  const isEngineVsEngine = players.white.type === "engine" && players.black.type === "engine";

  function getResignationLosingColor(): "white" | "black" {
    if (isPlayerVsEngine) {
      return players.white.type === "human" ? "white" : "black";
    }
    return pos?.turn === "white" ? "white" : "black";
  }

  async function handleAbort() {
    if (!gameId) return;
    const generation = sessionGenerationRef.current;
    const expectedSession = backendSessionRef.current;
    if (expectedSession === null) return;
    setPendingCommand("abort");
    setCommandError(null);
    try {
      await tauri.abortGame(gameId, expectedSession);
      if (generation !== sessionGenerationRef.current || liveGameIdRef.current !== gameId) return;
      setGameState("gameOver");
      setResult("*");
    } catch (err) {
      setCommandError(err instanceof Error ? err.message : "Unable to abort the game.");
    } finally {
      setPendingCommand(null);
    }
  }

  async function handleResign() {
    if (!gameId) return;
    const generation = sessionGenerationRef.current;
    const expectedSession = backendSessionRef.current;
    if (expectedSession === null) return;
    const losingColor = getResignationLosingColor();
    setPendingCommand("resign");
    setCommandError(null);
    try {
      const state = await tauri.resignGame(gameId, expectedSession, losingColor);
      if (
        generation === sessionGenerationRef.current &&
        liveGameIdRef.current === gameId &&
        state.gameId === gameId &&
        state.status !== "playing" &&
        acceptAuthoritativeRevision(state)
      ) {
        setGameState("gameOver");
        if (typeof state.status === "object" && "finished" in state.status) {
          setResult(gameResultToOutcome(state.status.finished.result));
        }
      }
    } catch (err) {
      setCommandError(err instanceof Error ? err.message : "Unable to resign the game.");
    } finally {
      setPendingCommand(null);
    }
  }

  async function handleNewGame() {
    abortLiveSession();
    setGameId(null);
    setGameState("settingUp");
    setWhiteTime(null);
    setBlackTime(null);
    resetTree();
  }

  useEffect(() => {
    return () => {
      abortLiveSession();
    };
  }, [abortLiveSession]);

  async function handleSelectOpeningBook() {
    const handle = await runUnlessCancelled(t("Common.Error"), () => tauri.issueOpeningBook());
    if (handle) setOpeningBookHandle(handle);
  }

  return (
    <>
      <Portal target="#left" style={{ height: "100%" }}>
        <Board
          editingMode={gameState === "settingUp" && editingMode}
          viewOnly={gameState !== "playing" && !editingMode}
          disableVariations
          boardRef={boardRef}
          movable={gameState === "settingUp" && editingMode ? "none" : movable}
          whiteTime={gameState === "playing" ? (whiteTime ?? undefined) : undefined}
          blackTime={gameState === "playing" ? (blackTime ?? undefined) : undefined}
          onMove={handleHumanMove}
          selectedPiece={selectedPiece}
          cgRef={cgRef}
          enablePremoves={isPlayerVsEngine && gameState === "playing"}
          onKeyboardPremove={queueKeyboardPremove}
        />
      </Portal>
      <Portal target="#topRight" style={{ height: "100%", overflow: "hidden" }}>
        <Paper withBorder shadow="sm" p="md" h="100%">
          {logsOpened ? (
            <EngineLogsView
              logs={engineLogs}
              onRefresh={fetchEngineLogs}
              additionalControls={
                <>
                  {players.white.type === "engine" && players.black.type === "engine" ? (
                    <SegmentedControl
                      value={logsColor}
                      onChange={(value) => setLogsColor(value as "white" | "black")}
                      data={[
                        { value: "white", label: t("Fen.White") },
                        { value: "black", label: t("Fen.Black") },
                      ]}
                    />
                  ) : (
                    <div />
                  )}
                  <IconAction
                    label={t("EngineLogs.Close", { defaultValue: "Close engine logs" })}
                    flex={0}
                    onClick={() => toggleLogsOpened()}
                  >
                    <IconX size="1.2rem" />
                  </IconAction>
                </>
              }
            />
          ) : (
            <>
              {gameState === "settingUp" && (
                <Stack h="100%" gap={0}>
                  <ScrollArea style={{ flex: 1 }} offsetScrollbars>
                    <Stack>
                      <Group>
                        <Text flex={1} ta="center" fz="lg" fw="bold">
                          {match(inputColor)
                            .with("white", () => t("Fen.White"))
                            .with("random", () => t("Board.Opponent.Random"))
                            .with("black", () => t("Fen.Black"))
                            .exhaustive()}
                        </Text>
                        <IconAction
                          label={t("Board.Action.SwapColors", { defaultValue: "Swap colors" })}
                          onClick={cycleColor}
                        >
                          <IconArrowsExchange />
                        </IconAction>
                        <Text flex={1} ta="center" fz="lg" fw="bold">
                          {match(inputColor)
                            .with("white", () => t("Fen.Black"))
                            .with("random", () => t("Board.Opponent.Random"))
                            .with("black", () => t("Fen.White"))
                            .exhaustive()}
                        </Text>
                      </Group>
                      <Box flex={1}>
                        <Group style={{ alignItems: "start" }}>
                          <OpponentForm
                            sameTimeControl={sameTimeControl}
                            opponent={player1Settings}
                            setOpponent={setPlayer1Settings}
                            setOtherOpponent={setPlayer2Settings}
                          />
                          <Divider orientation="vertical" />
                          <OpponentForm
                            sameTimeControl={sameTimeControl}
                            opponent={player2Settings}
                            setOpponent={setPlayer2Settings}
                            setOtherOpponent={setPlayer1Settings}
                          />
                        </Group>
                      </Box>

                      <Paper withBorder p="sm">
                        <Stack>
                          <Checkbox
                            label={t("Board.Opponent.SameTimeControl")}
                            checked={sameTimeControl}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setSameTimeControl(checked);
                              if (checked) {
                                setPlayer2Settings((prev) => ({
                                  ...prev,
                                  timeControl: player1Settings.timeControl,
                                  timeUnit: player1Settings.timeUnit,
                                  incrementUnit: player1Settings.incrementUnit,
                                }));
                              }
                            }}
                          />

                          <Divider variant="dashed" />

                          <Checkbox
                            label={t("Board.Opponent.EnableOpeningBook")}
                            checked={openingBookEnabled}
                            onChange={(e) => setOpeningBookEnabled(e.currentTarget.checked)}
                          />

                          {openingBookEnabled && (
                            <>
                              <FileInput
                                label={t("Board.Opponent.OpeningBookFile")}
                                description={t("Import.PGN.ClickToSelect")}
                                filename={
                                  openingBookHandle ? t("Board.Opponent.OpeningBookSelected") : null
                                }
                                onClick={handleSelectOpeningBook}
                              />
                              {openingBookHandle && (
                                <NumberInput
                                  label={t("Board.Opponent.OpeningBookMaxPlies")}
                                  description={t("Board.Opponent.OpeningBookMaxPlies.Desc")}
                                  min={1}
                                  value={openingBookMaxPly}
                                  onChange={(value) => {
                                    if (typeof value === "number" && Number.isFinite(value)) {
                                      setOpeningBookMaxPly(Math.max(1, Math.trunc(value)));
                                    }
                                  }}
                                />
                              )}
                            </>
                          )}
                        </Stack>
                      </Paper>
                    </Stack>
                  </ScrollArea>

                  <Divider pb="sm" />
                  {commandError && (
                    <Text c="red" role="alert">
                      {commandError}
                    </Text>
                  )}
                  <Button
                    onClick={startGame}
                    fullWidth
                    variant="light"
                    disabled={error !== null || pendingCommand === "start"}
                    loading={pendingCommand === "start"}
                  >
                    {t("Board.Opponent.StartGame")}
                  </Button>
                </Stack>
              )}
              {(gameState === "playing" || gameState === "gameOver") && (
                <Stack h="100%">
                  <Box flex={1}>
                    <GameInfo headers={headers} />
                  </Box>
                  <Group grow>
                    {gameState === "playing" && (
                      <Button
                        variant="default"
                        color="red"
                        onClick={isEngineVsEngine ? handleAbort : handleResign}
                        leftSection={<IconX />}
                        loading={pendingCommand === "abort" || pendingCommand === "resign"}
                        disabled={pendingCommand !== null}
                      >
                        {isEngineVsEngine ? t("Board.Opponent.Abort") : t("Board.Opponent.Resign")}
                      </Button>
                    )}
                    {gameState === "gameOver" && (
                      <Button variant="default" onClick={handleNewGame} leftSection={<IconPlus />}>
                        {t("Home.NewGame")}
                      </Button>
                    )}
                    <Button
                      variant="default"
                      onClick={() => changeToAnalysisMode()}
                      leftSection={<IconZoomCheck />}
                    >
                      {t("Board.Analysis.Analyze")}
                    </Button>

                    {hasEngine && (
                      <Button
                        variant="default"
                        onClick={() => toggleLogsOpened()}
                        leftSection={<IconFileText size="1rem" />}
                      >
                        {t("Board.Analysis.Logs")}
                      </Button>
                    )}
                  </Group>
                </Stack>
              )}
            </>
          )}
        </Paper>
      </Portal>
      <Portal target="#bottomRight" style={{ height: "100%" }}>
        {gameState === "settingUp" && editingMode ? (
          <EditingCard
            boardRef={boardRef}
            setEditingMode={toggleEditingMode}
            selectedPiece={selectedPiece}
            setSelectedPiece={setSelectedPiece}
          />
        ) : (
          <Stack h="100%" gap="xs">
            <GameNotation
              topBar
              controls={
                <BoardControls
                  editingMode={gameState === "settingUp" && editingMode}
                  toggleEditingMode={toggleEditingMode}
                  dirty={false}
                  canTakeBack={onePlayerIsEngine}
                  onTakeBack={onTakeBack}
                  takeBackPending={pendingCommand === "takeback"}
                  disableVariations
                  allowEditing={gameState === "settingUp"}
                />
              }
            />
            <MoveControls />
          </Stack>
        )}
      </Portal>
    </>
  );
}

export default BoardGame;
