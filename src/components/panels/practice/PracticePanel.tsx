import {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Paper,
  Progress,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  ThemeIcon,
  Tooltip,
} from "@mantine/core";
import { useToggle } from "@mantine/hooks";
import AppModal from "../../common/AppModal";
import {
  IconArrowBack,
  IconArrowRight,
  IconBook,
  IconCheck,
  IconFlame,
  IconInfoCircle,
  IconTarget,
  IconX,
} from "@tabler/icons-react";
import dayjs from "dayjs";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useTranslation } from "react-i18next";
import { formatDate, type ReviewLog } from "ts-fsrs";
import { normalizeError, type AppError } from "@/platform/errors";
import { formatNumber } from "@/utils/format";
import { useStore } from "zustand";
import ConfirmModal from "@/components/common/ConfirmModal";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import { IconAction } from "@/components/common/IconAction";
import {
  buildFromTree,
  formatReviewInterval,
  getCardForReview,
  getNextReviewTimes,
  getStats,
  syncDeck,
  updateCardPerformance,
} from "@/components/files/opening";
import {
  currentEvalOpenAtom,
  currentInvisibleAtom,
  currentPracticeTabAtom,
  currentShowCommentsAtom,
  currentTabAtom,
  deckAtomFamily,
  type PracticeSessionStats,
  practiceCardStartTimeAtom,
  practiceCompletedSummaryAtom,
  practiceMoveControllerAtom,
  practiceSessionStatsAtom,
  practiceStateAtom,
  practiceAutoDifficultyAtom,
} from "@/state/atoms";
import {
  loadPracticeReviews,
  PRACTICE_LOG_PAGE_SIZE,
  type PracticeDeckValue,
  type PracticeDeckKey,
} from "@/state/practiceStorage";
import { getTabFile, getTabGameNumber } from "@/utils/tabs";
import { fileWorkspaceKey } from "@/utils/pathCapabilities";
import { findFen, getBoardState, getNodeAtPath } from "@/utils/treeReducer";
import RepertoireInfo from "./RepertoireInfo";
import {
  canSubmitPracticeMove,
  emptyPracticeStats,
  idlePracticeSession,
  practiceSessionReducer,
  type PracticeSession,
} from "./session";

const PRACTICE_ADVANCE_DELAY_MS = 300;
const PRACTICE_INCORRECT_DELAY_MS = 500;

function PracticePanel() {
  const { t } = useTranslation();

  const store = useContext(TreeStateContext)!;
  const root = useStore(store, (s) => s.root);
  const headers = useStore(store, (s) => s.headers);
  const goToMove = useStore(store, (s) => s.goToMove);
  const goToNext = useStore(store, (s) => s.goToNext);
  const makeMove = useStore(store, (s) => s.makeMove);
  const setPracticePath = useStore(store, (s) => s.setPracticePath);
  const currentFen = useStore(store, (s) => s.currentNode().fen);

  const currentTab = useAtomValue(currentTabAtom);
  const tabFile = getTabFile(currentTab);
  const [resetModal, toggleResetModal] = useToggle();
  const [repairModal, toggleRepairModal] = useToggle();
  const deckIdentity = {
    file: tabFile ? fileWorkspaceKey(tabFile.handle) : "",
    game: getTabGameNumber(currentTab),
  };

  const [deck, setDeck] = useAtom(deckAtomFamily(deckIdentity));

  const [syncMessage, setSyncMessage] = useState<{
    added: number;
    removed: number;
  } | null>(null);
  const deckPositionsRef = useRef(deck.positions);
  deckPositionsRef.current = deck.positions;
  // The tree and deck scope (orientation, start) last diffed into the deck. A remount renders
  // the atom's previous "ready" snapshot before hydration starts, and a sync diffed from it is
  // dropped while the deck loads, so a new hydration (loading or read-failed) forgets it and the
  // hydrated deck is diffed again. Ratings do not reset it: re-diffing the whole tree after every
  // rating would cost O(tree).
  const lastSyncedRef = useRef<{ root: typeof root; scope: string } | null>(null);
  const syncMessageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const deckCanWrite = deck.status === "ready";

  useEffect(() => {
    if (deck.status === "loading" || deck.status === "read-failed") {
      lastSyncedRef.current = null;
      return;
    }
    if (deck.status !== "ready" || deckIdentity.file === "") return;

    const orientation = headers.orientation || "white";
    const start = headers.start || [];
    const scope = `${orientation}:${start.join(",")}`;
    const lastSynced = lastSyncedRef.current;
    if (lastSynced?.root === root && lastSynced.scope === scope) return;

    if (deckPositionsRef.current.length === 0) {
      const newDeck = buildFromTree(root, orientation, start);
      if (newDeck.length > 0) setDeck({ type: "sync", positions: newDeck });
    } else {
      // Sync existing deck with tree changes
      const { positions, added, removed } = syncDeck(
        deckPositionsRef.current,
        root,
        orientation,
        start,
      );
      if (added > 0 || removed > 0) {
        setDeck((prev) => ({ ...prev, positions }));
        setSyncMessage({ added, removed });
        if (syncMessageTimerRef.current) clearTimeout(syncMessageTimerRef.current);
        syncMessageTimerRef.current = setTimeout(() => setSyncMessage(null), 5000);
      }
    }
    lastSyncedRef.current = { root, scope };
  }, [root, headers, setDeck, deck.status, deckIdentity.file]);

  const stats = getStats(deck.positions);

  const setInvisible = useSetAtom(currentInvisibleAtom);
  const setShowComments = useSetAtom(currentShowCommentsAtom);
  const setEvalOpen = useSetAtom(currentEvalOpenAtom);
  const [practiceState, setPracticeState] = useAtom(practiceStateAtom);
  const [, setPracticeMoveController] = useAtom(practiceMoveControllerAtom);
  const [sessionStats, setSessionStats] = useAtom(practiceSessionStatsAtom);
  const [completedSummary, setCompletedSummary] = useAtom(practiceCompletedSummaryAtom);
  const setCardStartTime = useSetAtom(practiceCardStartTimeAtom);
  const cardStartTime = useAtomValue(practiceCardStartTimeAtom);
  const practiceAutoDifficulty = useAtomValue(practiceAutoDifficultyAtom);
  const sessionRef = useRef<PracticeSession>(idlePracticeSession());
  const endPracticeSessionRef = useRef<() => void>(() => undefined);
  const navigationTimersRef = useRef(new Set<ReturnType<typeof setTimeout>>());
  const scheduledAdvanceTokensRef = useRef(new Set<number>());
  const deckRef = useRef(deck);
  deckRef.current = deck;
  const rootRef = useRef(root);
  rootRef.current = root;
  const sessionStatsRef = useRef(sessionStats);
  sessionStatsRef.current = sessionStats;
  const autoDifficultyRef = useRef(practiceAutoDifficulty);
  autoDifficultyRef.current = practiceAutoDifficulty;
  const goToNextRef = useRef(goToNext);
  goToNextRef.current = goToNext;
  const goToMoveRef = useRef(goToMove);
  goToMoveRef.current = goToMove;
  const makeMoveRef = useRef(makeMove);
  makeMoveRef.current = makeMove;

  const rateCard = useCallback(
    (positionKey: string, grade: 1 | 2 | 3 | 4) => {
      const positionIndex = deckRef.current.positions.findIndex(
        (position) => getBoardState(position.fen) === positionKey,
      );
      const sourcePosition =
        positionIndex === -1 ? undefined : deckRef.current.positions[positionIndex];
      if (!sourcePosition) return;
      const update = updateCardPerformance(
        deckRef.current.positions,
        positionIndex,
        sourcePosition.card,
        grade,
      );
      if (!update) return;
      deckRef.current = {
        ...deckRef.current,
        positions: update.positions,
        status: "write-pending",
        error: undefined,
      };
      setDeck({ type: "rating", ...update, sourcePosition });
      return true;
    },
    [setDeck],
  );

  const clearPracticeTimers = useCallback(() => {
    for (const timer of navigationTimersRef.current) clearTimeout(timer);
    navigationTimersRef.current.clear();
    scheduledAdvanceTokensRef.current.clear();
    if (syncMessageTimerRef.current) clearTimeout(syncMessageTimerRef.current);
    syncMessageTimerRef.current = null;
  }, []);

  const setSession = useCallback(
    (next: PracticeSession) => {
      sessionRef.current = next;
      const { token: _token, ...visible } = next;
      setPracticeState(visible);
    },
    [setPracticeState],
  );

  const endPracticeSession = useCallback(() => {
    clearPracticeTimers();
    const ended = practiceSessionReducer(sessionRef.current, {
      type: "end",
      token: sessionRef.current.token,
    });
    setSession(ended);
    setPracticePath(null);
    setInvisible(false);
    setShowComments(true);
    setEvalOpen(true);
    setCardStartTime(0);
    setSessionStats(emptyPracticeStats());
    setCompletedSummary(null);
  }, [
    clearPracticeTimers,
    setCardStartTime,
    setEvalOpen,
    setInvisible,
    setPracticePath,
    setSession,
    setSessionStats,
    setCompletedSummary,
    setShowComments,
  ]);
  endPracticeSessionRef.current = endPracticeSession;

  const completePracticeSession = useCallback(
    (summary: PracticeSessionStats = sessionStatsRef.current) => {
      endPracticeSession();
      setCompletedSummary(summary);
    },
    [endPracticeSession, setCompletedSummary],
  );

  const scheduleForSession = useCallback((token: number, callback: () => void, delay: number) => {
    if (scheduledAdvanceTokensRef.current.has(token)) return;
    scheduledAdvanceTokensRef.current.add(token);
    const timer = setTimeout(() => {
      navigationTimersRef.current.delete(timer);
      scheduledAdvanceTokensRef.current.delete(token);
      if (sessionRef.current.token === token) callback();
    }, delay);
    navigationTimersRef.current.add(timer);
  }, []);

  const newPractice = useCallback(
    (stats?: Partial<PracticeSessionStats>) => {
      const currentDeck = deckRef.current;
      const currentStats = { ...sessionStatsRef.current, ...stats };
      if (currentDeck.positions.length === 0) {
        completePracticeSession(currentStats);
        return;
      }

      const currentMode = currentStats.mode;
      let remaining = currentStats.remainingPositionKeys;

      let card: (typeof currentDeck.positions)[0] | null | undefined;

      if (currentMode === "full") {
        while (remaining.length > 0) {
          card = currentDeck.positions.find(
            (position) => getBoardState(position.fen) === remaining[0],
          );
          if (card) break;
          remaining = remaining.slice(1);
        }
        if (remaining.length !== currentStats.remainingPositionKeys.length) {
          const nextStats = { ...currentStats, remainingPositionKeys: remaining };
          sessionStatsRef.current = nextStats;
          setSessionStats(nextStats);
          Object.assign(currentStats, nextStats);
        }
      } else {
        card = getCardForReview(currentDeck.positions);
      }

      if (!card) {
        completePracticeSession(currentStats);
        return;
      }
      const path = findFen(card.fen, rootRef.current);
      if (!path) {
        setDeck({
          type: "sync",
          positions: currentDeck.positions.filter(
            (position) => getBoardState(position.fen) !== getBoardState(card!.fen),
          ),
        });
        const nextStats =
          currentMode === "full"
            ? { ...currentStats, remainingPositionKeys: remaining.slice(1) }
            : currentStats;
        sessionStatsRef.current = nextStats;
        setSessionStats(nextStats);
        setSession(
          practiceSessionReducer(sessionRef.current, {
            type: "advance",
            token: sessionRef.current.token,
          }),
        );
        scheduleForSession(
          sessionRef.current.token,
          () => newPractice(nextStats),
          PRACTICE_ADVANCE_DELAY_MS,
        );
        return;
      }
      goToMoveRef.current(path);
      setPracticePath(path);
      setInvisible(true);
      setShowComments(false);
      setEvalOpen(false);
      setCardStartTime(Date.now());
      setSession(
        practiceSessionReducer(sessionRef.current, {
          type: "start",
          token: sessionRef.current.token + 1,
          fen: card.fen,
          positionKey: getBoardState(card.fen),
        }),
      );
    },
    [
      setPracticePath,
      setInvisible,
      setShowComments,
      setEvalOpen,
      setCardStartTime,
      setDeck,
      completePracticeSession,
      setSession,
      setSessionStats,
      scheduleForSession,
    ],
  );

  const rateCurrentCard = useCallback(
    (grade: 1 | 2 | 3 | 4) => {
      const session = sessionRef.current;
      const positionKey = session.positionKey;
      if (session.phase !== "correct" || !positionKey || !rateCard(positionKey, grade)) {
        return false;
      }
      const latestStats = sessionStatsRef.current;
      const nextStats = {
        ...latestStats,
        remainingPositionKeys:
          latestStats.mode === "full"
            ? latestStats.remainingPositionKeys.slice(1)
            : latestStats.remainingPositionKeys,
        correct: latestStats.correct + 1,
        streak: latestStats.streak + 1,
        bestStreak: Math.max(latestStats.bestStreak, latestStats.streak + 1),
      };
      sessionStatsRef.current = nextStats;
      setSessionStats(nextStats);
      setSession(
        practiceSessionReducer(session, {
          type: "advance",
          token: session.token,
        }),
      );
      return true;
    },
    [rateCard, setSession, setSessionStats],
  );

  useEffect(() => {
    if (practiceState.phase !== "correct") return;
    const token = sessionRef.current.token;
    if (sessionStatsRef.current.mode !== "full" && practiceAutoDifficulty === "none") return;
    scheduleForSession(
      token,
      () => {
        if (sessionRef.current.phase === "correct") {
          if (sessionStatsRef.current.mode === "full") {
            const latestStats = sessionStatsRef.current;
            const nextStats = {
              ...latestStats,
              remainingPositionKeys: latestStats.remainingPositionKeys.slice(1),
              correct: latestStats.correct + 1,
              streak: latestStats.streak + 1,
              bestStreak: Math.max(latestStats.bestStreak, latestStats.streak + 1),
            };
            sessionStatsRef.current = nextStats;
            setSessionStats(nextStats);
            setSession(
              practiceSessionReducer(sessionRef.current, {
                type: "advance",
                token,
              }),
            );
          } else {
            const grade = Number(autoDifficultyRef.current) as 1 | 2 | 3 | 4;
            if (!rateCurrentCard(grade)) {
              setSession(
                practiceSessionReducer(sessionRef.current, {
                  type: "advance",
                  token,
                }),
              );
            }
          }
        }
        newPractice(sessionStatsRef.current);
      },
      PRACTICE_ADVANCE_DELAY_MS,
    );
  }, [
    practiceState.phase,
    newPractice,
    practiceAutoDifficulty,
    rateCurrentCard,
    scheduleForSession,
    setSession,
    setSessionStats,
  ]);

  const submitMove = useCallback(
    (san: string) => {
      const session = sessionRef.current;
      if (!canSubmitPracticeMove(session, currentFen)) return;
      const positionKey = session.positionKey;
      const cardIndex = deckRef.current.positions.findIndex(
        (position) => getBoardState(position.fen) === positionKey,
      );
      const card = cardIndex === -1 ? undefined : deckRef.current.positions[cardIndex];
      if (!positionKey || !card || card.fen !== session.currentFen) {
        const nextStats =
          sessionStatsRef.current.mode === "full"
            ? {
                ...sessionStatsRef.current,
                remainingPositionKeys: sessionStatsRef.current.remainingPositionKeys.filter(
                  (key) => key !== positionKey,
                ),
              }
            : sessionStatsRef.current;
        sessionStatsRef.current = nextStats;
        setSessionStats(nextStats);
        setSession(
          practiceSessionReducer(session, {
            type: "advance",
            token: session.token,
          }),
        );
        scheduleForSession(session.token, () => newPractice(nextStats), PRACTICE_ADVANCE_DELAY_MS);
        return;
      }
      const timeTaken = Date.now() - cardStartTime;
      if (san === card.answer) {
        makeMoveRef.current({ payload: san });
        setSession(
          practiceSessionReducer(session, {
            type: "correct",
            token: session.token,
            answer: card.answer,
            timeTaken,
          }),
        );
        return;
      }
      if (sessionStatsRef.current.mode !== "full") rateCard(positionKey, 1);
      setSession(
        practiceSessionReducer(session, {
          type: "incorrect",
          token: session.token,
          answer: card.answer,
          playedMove: san,
          timeTaken,
        }),
      );
      const nextStats = {
        ...sessionStatsRef.current,
        incorrect: sessionStatsRef.current.incorrect + 1,
        streak: 0,
      };
      sessionStatsRef.current = nextStats;
      setSessionStats(nextStats);
      scheduleForSession(session.token, () => goToNextRef.current(), PRACTICE_INCORRECT_DELAY_MS);
    },
    [
      cardStartTime,
      currentFen,
      newPractice,
      scheduleForSession,
      rateCard,
      setSession,
      setSessionStats,
    ],
  );

  useEffect(() => {
    setPracticeMoveController({
      canMove: canSubmitPracticeMove(sessionRef.current, currentFen),
      submitMove,
    });
    return () => setPracticeMoveController(null);
  }, [currentFen, practiceState.phase, setPracticeMoveController, submitMove]);

  useEffect(() => () => endPracticeSessionRef.current(), []);

  function handleQualityRating(grade: 1 | 2 | 3 | 4) {
    if (practiceState.phase !== "correct") return;
    if (!rateCurrentCard(grade)) {
      setSession(
        practiceSessionReducer(sessionRef.current, {
          type: "advance",
          token: sessionRef.current.token,
        }),
      );
    }
    if (sessionStatsRef.current.mode !== "full") {
      scheduleForSession(
        sessionRef.current.token,
        () => newPractice(sessionStatsRef.current),
        PRACTICE_ADVANCE_DELAY_MS,
      );
    }
  }

  function startPractice() {
    setCompletedSummary(null);
    const stats: Partial<PracticeSessionStats> = {
      mode: "anki",
      remainingPositionKeys: [],
      correct: 0,
      incorrect: 0,
      streak: 0,
      bestStreak: 0,
    };
    setSessionStats((prev) => ({ ...prev, ...stats }));
    newPractice(stats);
  }

  function startFullPractice() {
    setCompletedSummary(null);
    const positionKeys = deckRef.current.positions.map((position) => getBoardState(position.fen));
    const stats: Partial<PracticeSessionStats> = {
      mode: "full",
      remainingPositionKeys: positionKeys,
      correct: 0,
      incorrect: 0,
      streak: 0,
      bestStreak: 0,
    };
    setSessionStats((prev) => ({ ...prev, ...stats }));
    newPractice(stats);
  }

  function skipCard() {
    const latestStats = sessionStatsRef.current;
    if (latestStats.mode === "full" && latestStats.remainingPositionKeys.length > 0) {
      const remainingPositionKeys = latestStats.remainingPositionKeys.slice(1);
      const nextStats = { ...latestStats, remainingPositionKeys };
      sessionStatsRef.current = nextStats;
      setSessionStats(nextStats);
      newPractice(nextStats);
    } else {
      newPractice();
    }
  }

  useHotkeys("1", () => handleQualityRating(1), {
    enabled: practiceState.phase === "correct",
  });
  useHotkeys("2", () => handleQualityRating(2), {
    enabled: practiceState.phase === "correct",
  });
  useHotkeys("3", () => handleQualityRating(3), {
    enabled: practiceState.phase === "correct",
  });
  useHotkeys("4", () => handleQualityRating(4), {
    enabled: practiceState.phase === "correct",
  });
  useHotkeys("space", () => skipCard(), {
    enabled: practiceState.phase === "incorrect",
  });

  const [positionsOpen, setPositionsOpen] = useToggle();
  const [logsOpen, setLogsOpen] = useToggle();
  const [tab, setTab] = useAtom(currentPracticeTabAtom);
  const displayedSessionStats = completedSummary ?? sessionStats;
  const showPracticeContent =
    deck.status === "ready" || deck.status === "write-pending" || deck.status === "write-blocked";

  useEffect(() => {
    if (tab !== "train" && practiceState.phase !== "idle") endPracticeSession();
  }, [endPracticeSession, practiceState.phase, tab]);

  useEffect(() => {
    const fen = sessionRef.current.currentFen;
    if (fen && !findFen(fen, root)) completePracticeSession();
  }, [completePracticeSession, deck.positions, root]);

  return (
    <>
      <Tabs
        h="100%"
        orientation="vertical"
        placement="right"
        value={tab}
        onChange={(v) => setTab(v!)}
        style={{
          display: "flex",
        }}
      >
        <Tabs.List>
          <Tabs.Tab value="train">{t("Board.Practice.Train")}</Tabs.Tab>
          <Tabs.Tab value="build">{t("Board.Practice.Build")}</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="train" style={{ overflow: "hidden" }}>
          <Stack p="sm" gap="md">
            {deck.status === "loading" && (
              <Alert icon={<IconInfoCircle />}>{t("Board.Practice.Loading")}</Alert>
            )}
            {deck.status === "read-failed" && (
              <Alert
                icon={<IconInfoCircle />}
                color="red"
                title={t("Board.Practice.ReadFailed", { cause: deck.error?.message })}
              >
                <Stack gap="xs">
                  <Group gap="xs">
                    <Button
                      variant="light"
                      color="red"
                      size="xs"
                      onClick={() => setDeck({ type: "retry" })}
                    >
                      {t("Board.Practice.Retry")}
                    </Button>
                    {deck.repairable !== false && (
                      <Button
                        variant="light"
                        color="red"
                        size="xs"
                        onClick={() => toggleRepairModal()}
                      >
                        {t("Board.Practice.Repair")}
                      </Button>
                    )}
                  </Group>
                </Stack>
              </Alert>
            )}
            {deck.status === "write-blocked" && (
              <Alert
                icon={<IconInfoCircle />}
                color="red"
                title={t("Board.Practice.WriteBlocked", { cause: deck.error?.message })}
              />
            )}
            {showPracticeContent && (
              <>
                {stats.total === 0 && (
                  <Alert icon={<IconInfoCircle />}>
                    <Stack gap="xs">
                      <Text fz="sm">{t("Board.Practice.NoPositionForTrain1")}</Text>
                      <Button variant="light" size="xs" onClick={() => setTab("build")}>
                        {t("Board.Practice.GoToBuild")}
                      </Button>
                    </Stack>
                  </Alert>
                )}
                {syncMessage && (
                  <Alert
                    title={t("Board.Practice.DeckSynced")}
                    withCloseButton
                    onClose={() => setSyncMessage(null)}
                  >
                    {syncMessage.added > 0 &&
                      t("Board.Practice.SyncAdded", {
                        count: syncMessage.added ?? 0,
                        number: formatNumber(syncMessage.added ?? 0),
                      })}
                    {syncMessage.added > 0 && syncMessage.removed > 0 && " · "}
                    {syncMessage.removed > 0 &&
                      t("Board.Practice.SyncRemoved", {
                        count: syncMessage.removed ?? 0,
                        number: formatNumber(syncMessage.removed ?? 0),
                      })}
                  </Alert>
                )}
                {deck.unappliedReviews > 0 && !deck.orphansAcknowledged && (
                  <Alert color="orange">
                    <Group justify="space-between" wrap="nowrap">
                      <Text fz="sm">
                        {t("Board.Practice.UnappliedReviews", {
                          count: deck.unappliedReviews,
                        })}
                      </Text>
                      <Button
                        variant="subtle"
                        size="compact-xs"
                        onClick={() => setDeck({ type: "acknowledge" })}
                      >
                        {t("Board.Practice.DismissUnappliedReviews")}
                      </Button>
                    </Group>
                  </Alert>
                )}
                {stats.total > 0 && (
                  <>
                    <Stack gap={4}>
                      <Group justify="space-between">
                        <Text fz="xs" fw={500}>
                          {t("Board.Practice.Progress")}
                        </Text>
                        <Text fz="xs" c="dimmed">
                          {Math.round((stats.practiced / stats.total) * 100)}%
                        </Text>
                      </Group>
                      <Progress.Root size="sm">
                        <Tooltip
                          label={t("Board.Practice.Statistic", {
                            label: t("Board.Practice.Practiced"),
                            count: stats.practiced,
                          })}
                        >
                          <Progress.Section
                            value={(stats.practiced / stats.total) * 100}
                            color="blue"
                          />
                        </Tooltip>
                        <Tooltip
                          label={t("Board.Practice.Statistic", {
                            label: t("Board.Practice.Due"),
                            count: stats.due,
                          })}
                        >
                          <Progress.Section
                            value={(stats.due / stats.total) * 100}
                            color="yellow"
                          />
                        </Tooltip>
                        <Tooltip
                          label={t("Board.Practice.Statistic", {
                            label: t("Board.Practice.Unseen"),
                            count: stats.unseen,
                          })}
                        >
                          <Progress.Section
                            value={(stats.unseen / stats.total) * 100}
                            color="gray"
                          />
                        </Tooltip>
                      </Progress.Root>
                    </Stack>

                    <SimpleGrid cols={3} spacing="xs">
                      <Paper p="xs" withBorder radius="sm">
                        <Text fz={10} tt="uppercase" c="dimmed" fw={600}>
                          {t("Board.Practice.Practiced")}
                        </Text>
                        <Text fz="lg" fw={700} c="blue">
                          {stats.practiced}
                        </Text>
                      </Paper>
                      <Paper p="xs" withBorder radius="sm">
                        <Text fz={10} tt="uppercase" c="dimmed" fw={600}>
                          {t("Board.Practice.Due")}
                        </Text>
                        <Text fz="lg" fw={700} c="yellow">
                          {stats.due}
                        </Text>
                      </Paper>
                      <Paper p="xs" withBorder radius="sm">
                        <Text fz={10} tt="uppercase" c="dimmed" fw={600}>
                          {t("Board.Practice.Unseen")}
                        </Text>
                        <Text fz="lg" fw={700} c="dimmed">
                          {stats.unseen}
                        </Text>
                      </Paper>
                    </SimpleGrid>
                    {(practiceState.phase !== "idle" ||
                      displayedSessionStats.correct > 0 ||
                      displayedSessionStats.incorrect > 0) && (
                      <SimpleGrid cols={3} spacing="xs">
                        <Paper p="xs" withBorder radius="sm">
                          <Group gap={4} wrap="nowrap">
                            <ThemeIcon size="xs" color="green" variant="transparent">
                              <IconCheck size={12} />
                            </ThemeIcon>
                            <Text fz={10} tt="uppercase" c="dimmed" fw={600}>
                              {t("Board.Practice.SessionCorrect")}
                            </Text>
                          </Group>
                          <Text fz="lg" fw={700} c="green">
                            {displayedSessionStats.correct}
                          </Text>
                        </Paper>
                        <Paper p="xs" withBorder radius="sm">
                          <Group gap={4} wrap="nowrap">
                            <ThemeIcon size="xs" color="red" variant="transparent">
                              <IconX size={12} />
                            </ThemeIcon>
                            <Text fz={10} tt="uppercase" c="dimmed" fw={600}>
                              {t("Board.Practice.SessionIncorrect")}
                            </Text>
                          </Group>
                          <Text fz="lg" fw={700} c="red">
                            {displayedSessionStats.incorrect}
                          </Text>
                        </Paper>
                        <Paper p="xs" withBorder radius="sm">
                          <Group gap={4} wrap="nowrap">
                            {displayedSessionStats.correct + displayedSessionStats.incorrect > 0 ? (
                              <ThemeIcon size="xs" color="teal" variant="transparent">
                                <IconTarget size={12} />
                              </ThemeIcon>
                            ) : (
                              <ThemeIcon size="xs" color="orange" variant="transparent">
                                <IconFlame size={12} />
                              </ThemeIcon>
                            )}
                            <Text fz={10} tt="uppercase" c="dimmed" fw={600}>
                              {displayedSessionStats.correct + displayedSessionStats.incorrect > 0
                                ? t("Board.Practice.Accuracy")
                                : t("Board.Practice.Streak")}
                            </Text>
                          </Group>
                          <Text
                            fz="lg"
                            fw={700}
                            c={
                              displayedSessionStats.correct + displayedSessionStats.incorrect > 0
                                ? "teal"
                                : "orange"
                            }
                          >
                            {displayedSessionStats.correct + displayedSessionStats.incorrect > 0
                              ? `${Math.round(
                                  (displayedSessionStats.correct /
                                    (displayedSessionStats.correct +
                                      displayedSessionStats.incorrect)) *
                                    100,
                                )}%`
                              : displayedSessionStats.streak}
                          </Text>
                        </Paper>
                      </SimpleGrid>
                    )}

                    {practiceState.phase === "idle" && (
                      <Stack gap="sm">
                        {stats.due === 0 && stats.unseen === 0 ? (
                          <Paper p="sm" withBorder>
                            <Stack gap="xs" align="center">
                              <ThemeIcon size="xl" radius="xl" color="green" variant="light">
                                <IconCheck size={24} />
                              </ThemeIcon>
                              <Text ta="center" fw={500}>
                                {t("Board.Practice.PracticedAll1")}
                              </Text>
                              <Text ta="center" fz="sm" c="dimmed">
                                {t("Board.Practice.PracticedAll2")}{" "}
                                {dayjs(stats.nextDue).format("MMM D, HH:mm")}
                              </Text>
                            </Stack>
                          </Paper>
                        ) : (
                          <Button
                            size="md"
                            variant="light"
                            fullWidth
                            onClick={startPractice}
                            disabled={!deckCanWrite}
                            leftSection={<IconTarget size={20} />}
                            justify="space-between"
                            rightSection={
                              <Badge size="sm" variant="white" color="blue">
                                {stats.due + stats.unseen}
                              </Badge>
                            }
                          >
                            {t("Board.Practice.StartPractice")}
                          </Button>
                        )}
                        <Button
                          size="md"
                          variant="light"
                          color="gray"
                          fullWidth
                          onClick={startFullPractice}
                          disabled={!deckCanWrite}
                          leftSection={<IconBook size={20} />}
                          justify="space-between"
                          rightSection={
                            <Badge size="sm" variant="white" color="gray">
                              {deck.positions.length}
                            </Badge>
                          }
                        >
                          {t("Board.Practice.PracticeFullRepertoire")}
                        </Button>
                      </Stack>
                    )}

                    {practiceState.phase === "waiting" && (
                      <Paper p="sm" withBorder>
                        {practiceState.currentFen && currentFen !== practiceState.currentFen ? (
                          <Stack gap="xs" align="center">
                            <Text ta="center" fz="sm" c="dimmed">
                              {t("Board.Practice.NotOnPosition")}
                            </Text>
                            <Button
                              variant="light"
                              size="xs"
                              leftSection={<IconArrowBack size={14} />}
                              onClick={() => {
                                const path = findFen(practiceState.currentFen!, root);
                                if (!path) {
                                  completePracticeSession();
                                  return;
                                }
                                goToMove(path);
                                setInvisible(true);
                              }}
                            >
                              {t("Board.Practice.GoBackToPosition")}
                            </Button>
                          </Stack>
                        ) : (
                          <Group gap="xs" justify="center">
                            <Text ta="center" fz="sm" c="dimmed">
                              {t("Board.Practice.MakeYourMove")}
                            </Text>
                            <Button
                              variant="light"
                              size="compact-xs"
                              color="red"
                              onClick={() => {
                                endPracticeSession();
                              }}
                            >
                              {t("Common.Stop")}
                            </Button>
                          </Group>
                        )}
                      </Paper>
                    )}

                    {practiceState.phase === "correct" && sessionStats.mode !== "full" && (
                      <QualityRatingPanel
                        onRate={handleQualityRating}
                        card={
                          practiceState.positionKey
                            ? deck.positions.find(
                                (position) =>
                                  getBoardState(position.fen) === practiceState.positionKey,
                              )?.card
                            : undefined
                        }
                        timeTaken={practiceState.timeTaken}
                      />
                    )}

                    {practiceState.phase === "incorrect" && (
                      <Paper p="sm" withBorder>
                        <Stack gap="xs" align="center">
                          <Group gap="xs">
                            <ThemeIcon size="md" color="red" variant="light" radius="xl">
                              <IconX size={16} />
                            </ThemeIcon>
                            <Text fw={500} c="red">
                              {t("Common.Incorrect")}
                            </Text>
                          </Group>
                          <Text fz="sm" c="dimmed">
                            {t("Board.Practice.CorrectMoveWas", {
                              move: practiceState.answer,
                            })}
                          </Text>
                          <Button variant="light" size="sm" onClick={skipCard}>
                            {t("Board.Practice.NextPosition")}
                          </Button>
                        </Stack>
                      </Paper>
                    )}

                    <Divider />

                    <Group gap="xs">
                      <Button variant="subtle" size="xs" onClick={() => setPositionsOpen(true)}>
                        {t("Board.Practice.ShowAll")}
                      </Button>
                      <Button variant="subtle" size="xs" onClick={() => setLogsOpen(true)}>
                        {t("Board.Practice.ShowLogs")}
                      </Button>
                      <Button
                        variant="subtle"
                        size="xs"
                        color="red"
                        disabled={!deckCanWrite}
                        onClick={() => toggleResetModal()}
                      >
                        {t("Common.Reset")}
                      </Button>
                    </Group>
                  </>
                )}
              </>
            )}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="build" style={{ overflow: "hidden" }}>
          <RepertoireInfo />
        </Tabs.Panel>
      </Tabs>

      <ConfirmModal
        title={t("Board.Practice.Reset.Title")}
        description={t("Board.Practice.Reset.Description", {
          name: tabFile?.name,
        })}
        opened={resetModal}
        onClose={toggleResetModal}
        onConfirm={async () => {
          const cards = buildFromTree(root, headers.orientation || "white", headers.start || []);
          await setDeck({ type: "reset", positions: cards });
          endPracticeSession();
        }}
        confirmLabel={t("Common.Reset")}
      />
      <ConfirmModal
        title={t("Board.Practice.Repair.Title")}
        description={t("Board.Practice.Repair.Description", { name: tabFile?.name })}
        opened={repairModal}
        onClose={toggleRepairModal}
        onConfirm={async () => {
          await setDeck({ type: "repair" });
        }}
        confirmLabel={t("Board.Practice.Repair")}
      />
      {positionsOpen && (
        <PositionsModal open={positionsOpen} setOpen={setPositionsOpen} deck={deck} />
      )}
      <LogsModal
        open={logsOpen}
        setOpen={setLogsOpen}
        identity={deckIdentity}
        generation={deck.generation}
      />
    </>
  );
}

function QualityRatingPanel({
  onRate,
  card,
  timeTaken,
}: {
  onRate: (grade: 1 | 2 | 3 | 4) => void;
  card?: import("ts-fsrs").Card;
  timeTaken?: number;
}) {
  const { t } = useTranslation();
  const reviewTimes = card ? getNextReviewTimes(card) : null;

  return (
    <Paper p="sm" withBorder>
      <Stack gap="sm" align="center">
        <Group gap="xs">
          <ThemeIcon size="md" color="green" variant="light" radius="xl">
            <IconCheck size={16} />
          </ThemeIcon>
          <Text fw={500} c="green">
            {t("Board.Practice.Correct")}
          </Text>
          {timeTaken !== undefined && (
            <Text fz="xs" c="dimmed">
              ({t("Common.SecondsShort", { value: (timeTaken / 1000).toFixed(1) })})
            </Text>
          )}
        </Group>
        <Text fz="sm" c="dimmed">
          {t("Board.Practice.HowDifficult")}
        </Text>
        <SimpleGrid cols={4} spacing="xs" style={{ width: "100%" }}>
          <Tooltip label={t("Board.Practice.AgainHint")}>
            <Button
              color="red"
              variant="light"
              size="compact-md"
              onClick={() => onRate(1)}
              style={{ height: "auto", padding: "4px 0" }}
            >
              <Stack gap={0} align="center">
                <Text fz="xs" fw={600}>
                  {t("Board.Practice.Again")}
                </Text>
                <Text fz={10} c="dimmed">
                  {reviewTimes ? formatReviewInterval(reviewTimes[1]) : ""}
                </Text>
              </Stack>
            </Button>
          </Tooltip>
          <Tooltip label={t("Board.Practice.HardHint")}>
            <Button
              color="orange"
              variant="light"
              size="compact-md"
              onClick={() => onRate(2)}
              style={{ height: "auto", padding: "4px 0" }}
            >
              <Stack gap={0} align="center">
                <Text fz="xs" fw={600}>
                  {t("Board.Practice.Hard")}
                </Text>
                <Text fz={10} c="dimmed">
                  {reviewTimes ? formatReviewInterval(reviewTimes[2]) : ""}
                </Text>
              </Stack>
            </Button>
          </Tooltip>
          <Tooltip label={t("Board.Practice.GoodHint")}>
            <Button
              color="blue"
              variant="light"
              size="compact-md"
              onClick={() => onRate(3)}
              style={{ height: "auto", padding: "4px 0" }}
            >
              <Stack gap={0} align="center">
                <Text fz="xs" fw={600}>
                  {t("Board.Practice.Good")}
                </Text>
                <Text fz={10} c="dimmed">
                  {reviewTimes ? formatReviewInterval(reviewTimes[3]) : ""}
                </Text>
              </Stack>
            </Button>
          </Tooltip>
          <Tooltip label={t("Board.Practice.EasyHint")}>
            <Button
              color="green"
              variant="light"
              size="compact-md"
              onClick={() => onRate(4)}
              style={{ height: "auto", padding: "4px 0" }}
            >
              <Stack gap={0} align="center">
                <Text fz="xs" fw={600}>
                  {t("Board.Practice.Easy")}
                </Text>
                <Text fz={10} c="dimmed">
                  {reviewTimes ? formatReviewInterval(reviewTimes[4]) : ""}
                </Text>
              </Stack>
            </Button>
          </Tooltip>
        </SimpleGrid>
        <Text fz={10} c="dimmed">
          {t("Board.Practice.KeyboardHint")}
        </Text>
      </Stack>
    </Paper>
  );
}

function PositionsModal({
  open,
  setOpen,
  deck,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  deck: PracticeDeckValue;
}) {
  const { t } = useTranslation();

  const store = useContext(TreeStateContext)!;
  const root = useStore(store, (s) => s.root);
  const goToMove = useStore(store, (s) => s.goToMove);
  return (
    <AppModal
      opened={open}
      onClose={() => setOpen(false)}
      size="xl"
      title={<b>{t("Board.Practice.Positions")}</b>}
    >
      {deck.positions.length === 0 && <Text>{t("Board.Practice.NoPositionsYet")}</Text>}
      <SimpleGrid cols={2}>
        {deck.positions.map((c) => {
          const position = findFen(c.fen, root);
          if (!position) return null;
          const node = getNodeAtPath(root, position);
          return (
            <Card key={c.fen}>
              <Text>
                {Math.floor(node.halfMoves / 2) + 1}
                {node.halfMoves % 2 === 0 ? ". " : "... "}
                {c.answer}
              </Text>
              <Divider my="xs" />
              <Group justify="space-between">
                <Stack>
                  <Text tt="uppercase" fw="bold" fz="sm">
                    {t("Board.Practice.Status")}
                  </Text>
                  <Badge
                    color={c.card.reps === 0 ? "gray" : c.card.due < new Date() ? "yellow" : "blue"}
                  >
                    {c.card.reps === 0
                      ? t("Board.Practice.Unseen")
                      : c.card.due < new Date()
                        ? t("Board.Practice.Due")
                        : t("Board.Practice.Practiced")}
                  </Badge>
                </Stack>
                <Stack>
                  <Text tt="uppercase" fw="bold" fz="sm">
                    {t("Board.Practice.Due")}
                  </Text>
                  <Text>{formatDate(c.card.due)}</Text>
                </Stack>
                <IconAction
                  label={t("Board.Practice.GoBackToPosition")}
                  variant="subtle"
                  onClick={() => {
                    goToMove(position);
                    setOpen(false);
                  }}
                >
                  <IconArrowRight />
                </IconAction>
              </Group>
            </Card>
          );
        })}
      </SimpleGrid>
    </AppModal>
  );
}

function LogsModal({
  open,
  setOpen,
  identity,
  generation,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  identity: PracticeDeckKey;
  generation: number;
}) {
  const { t } = useTranslation();
  const store = useContext(TreeStateContext)!;
  const root = useStore(store, (s) => s.root);
  const goToMove = useStore(store, (s) => s.goToMove);
  const [logs, setLogs] = useState<Array<ReviewLog & { fen: string; id: string }>>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState<AppError | null>(null);
  const requestSequence = useRef(0);

  const loadPage = useCallback(
    async (cursor: string | null, replace: boolean) => {
      if (identity.file === "") return;
      const sequence = ++requestSequence.current;
      setLoading(true);
      setPageError(null);
      try {
        const page = await loadPracticeReviews(
          identity.file,
          identity.game,
          cursor,
          PRACTICE_LOG_PAGE_SIZE,
        );
        if (sequence !== requestSequence.current) return;
        const parsed = page.entries.map((entry) => ({
          ...(JSON.parse(entry.entry) as ReviewLog & { fen: string }),
          id: entry.id,
        }));
        setLogs((previous) => (replace ? parsed : [...previous, ...parsed]));
        setNextCursor(page.nextCursor);
      } catch (cause) {
        if (sequence === requestSequence.current) setPageError(normalizeError(cause));
      } finally {
        if (sequence === requestSequence.current) setLoading(false);
      }
    },
    [identity.file, identity.game],
  );

  useEffect(() => {
    if (!open) {
      requestSequence.current += 1;
      return;
    }
    setLogs([]);
    setNextCursor(null);
    setPageError(null);
    void loadPage(null, true);
    return () => {
      requestSequence.current += 1;
    };
  }, [generation, loadPage, open]);

  return (
    <AppModal
      opened={open}
      onClose={() => setOpen(false)}
      size="xl"
      title={<b>{t("Board.Practice.Logs")}</b>}
    >
      <SimpleGrid cols={2}>
        {logs.length === 0 && !loading && !pageError && (
          <Text>{t("Board.Practice.NoLogsYet")}</Text>
        )}
        {logs.map((log) => {
          const position = findFen(log.fen, root);
          const node = position ? getNodeAtPath(root, position) : null;

          return (
            <Card key={log.id} data-practice-entry-id={log.id}>
              <Text>
                {node
                  ? `${Math.floor(node.halfMoves / 2) + 1}${node.halfMoves % 2 === 0 ? ". " : "... "}${node.san}`
                  : log.fen}
              </Text>

              <Divider my="xs" />
              <Group justify="space-between">
                <Stack>
                  <Text tt="uppercase" fw="bold" fz="sm">
                    {t("Board.Practice.Rating")}
                  </Text>
                  <Badge
                    color={
                      log.rating === 1
                        ? "red"
                        : log.rating === 2
                          ? "orange"
                          : log.rating === 3
                            ? "blue"
                            : "green"
                    }
                  >
                    {log.rating === 1
                      ? t("Board.Practice.Again")
                      : log.rating === 2
                        ? t("Board.Practice.Hard")
                        : log.rating === 3
                          ? t("Board.Practice.Good")
                          : t("Board.Practice.Easy")}
                  </Badge>
                </Stack>
                <Stack>
                  <Text tt="uppercase" fw="bold" fz="sm">
                    {t("Common.Date")}
                  </Text>
                  <Text>{formatDate(log.due)}</Text>
                </Stack>
                {position && (
                  <IconAction
                    label={t("Board.Practice.GoBackToPosition")}
                    variant="subtle"
                    onClick={() => {
                      goToMove(position);
                      setOpen(false);
                    }}
                  >
                    <IconArrowRight />
                  </IconAction>
                )}
              </Group>
            </Card>
          );
        })}
      </SimpleGrid>
      {pageError && (
        <Alert color="red" mt="sm">
          {t("Board.Practice.LogsLoadFailed", { cause: pageError.message })}
        </Alert>
      )}
      {nextCursor && (
        <Button
          mt="sm"
          variant="light"
          loading={loading}
          onClick={() => void loadPage(nextCursor, false)}
        >
          {t("Board.Practice.LoadMore")}
        </Button>
      )}
    </AppModal>
  );
}

export default PracticePanel;
