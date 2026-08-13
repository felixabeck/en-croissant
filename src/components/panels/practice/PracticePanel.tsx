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
import { formatDate } from "ts-fsrs";
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
  type PracticeData,
  type PracticeSessionStats,
  practiceCardStartTimeAtom,
  practiceCompletedSummaryAtom,
  practiceMoveControllerAtom,
  practiceSessionStatsAtom,
  practiceStateAtom,
  practiceAutoDifficultyAtom,
} from "@/state/atoms";
import { getTabFile, getTabGameNumber } from "@/utils/tabs";
import { fileWorkspaceKey } from "@/utils/pathCapabilities";
import { findFen, getNodeAtPath } from "@/utils/treeReducer";
import RepertoireInfo from "./RepertoireInfo";
import {
  canSubmitPracticeMove,
  emptyPracticeStats,
  idlePracticeSession,
  practiceSessionReducer,
  type PracticeSession,
} from "./session";

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

  const [deck, setDeck] = useAtom(
    deckAtomFamily({
      file: tabFile ? fileWorkspaceKey(tabFile.handle) : "",
      game: getTabGameNumber(currentTab),
    }),
  );

  const [syncMessage, setSyncMessage] = useState<{
    added: number;
    removed: number;
  } | null>(null);
  const deckPositionsRef = useRef(deck.positions);
  deckPositionsRef.current = deck.positions;
  const lastSyncedRootRef = useRef<typeof root | null>(null);
  const syncMessageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (lastSyncedRootRef.current === root) return;

    const orientation = headers.orientation || "white";
    const start = headers.start || [];

    if (deckPositionsRef.current.length === 0) {
      const newDeck = buildFromTree(root, orientation, start);
      if (newDeck.length > 0) {
        setDeck({ positions: newDeck, logs: [] });
      }
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
    lastSyncedRootRef.current = root;
  }, [root, headers, setDeck]);

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
  const deckRef = useRef(deck);
  deckRef.current = deck;
  const rootRef = useRef(root);
  rootRef.current = root;

  const clearPracticeTimers = useCallback(() => {
    for (const timer of navigationTimersRef.current) clearTimeout(timer);
    navigationTimersRef.current.clear();
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
    (summary: PracticeSessionStats = sessionStats) => {
      endPracticeSession();
      setCompletedSummary(summary);
    },
    [endPracticeSession, sessionStats, setCompletedSummary],
  );

  const scheduleForSession = useCallback((token: number, callback: () => void, delay: number) => {
    const timer = setTimeout(() => {
      navigationTimersRef.current.delete(timer);
      if (sessionRef.current.token === token) callback();
    }, delay);
    navigationTimersRef.current.add(timer);
  }, []);

  const newPractice = useCallback(
    (stats?: Partial<PracticeSessionStats>) => {
      if (deck.positions.length === 0) return;

      const currentMode = stats?.mode ?? sessionStats.mode;
      const remaining = stats?.remainingPositions ?? sessionStats.remainingPositions;

      let c: (typeof deck.positions)[0] | null | undefined;

      if (currentMode === "full") {
        if (remaining.length > 0) {
          c = deck.positions[remaining[0]];
        } else {
          c = null;
        }
      } else {
        c = getCardForReview(deck.positions);
      }

      if (!c) {
        completePracticeSession({ ...sessionStats, ...stats });
        return;
      }
      const path = findFen(c.fen, root);
      if (!path) {
        setDeck((previous) => ({
          ...previous,
          positions: previous.positions.filter((position) => position.fen !== c!.fen),
        }));
        completePracticeSession({ ...sessionStats, ...stats });
        return;
      }
      goToMove(path);
      setPracticePath(path);
      setInvisible(true);
      setShowComments(false);
      setEvalOpen(false);
      setCardStartTime(Date.now());
      const positionIndex = deck.positions.indexOf(c);
      setSession(
        practiceSessionReducer(sessionRef.current, {
          type: "start",
          token: sessionRef.current.token + 1,
          fen: c.fen,
          positionIndex,
        }),
      );
    },
    [
      deck.positions,
      sessionStats,
      root,
      goToMove,
      setPracticePath,
      setInvisible,
      setShowComments,
      setEvalOpen,
      setCardStartTime,
      setDeck,
      completePracticeSession,
      setSession,
    ],
  );

  useEffect(() => {
    if (practiceState.phase === "correct") {
      const token = sessionRef.current.token;
      if (sessionStats.mode === "full") {
        scheduleForSession(
          token,
          () => {
            const remainingPositions = sessionStats.remainingPositions.slice(1);
            const nextStats = {
              ...sessionStats,
              remainingPositions,
              correct: sessionStats.correct + 1,
              streak: sessionStats.streak + 1,
              bestStreak: Math.max(sessionStats.bestStreak, sessionStats.streak + 1),
            };
            setSessionStats(nextStats);
            newPractice(nextStats);
          },
          300,
        );
      } else if (practiceAutoDifficulty !== "none" && practiceState.positionIndex !== undefined) {
        const positionIndex = practiceState.positionIndex;
        scheduleForSession(
          token,
          () => {
            const card = deckRef.current.positions[positionIndex]?.card;
            if (!card) {
              completePracticeSession();
              return;
            }
            const grade = Number(practiceAutoDifficulty) as 1 | 2 | 3 | 4;

            updateCardPerformance(setDeck, positionIndex, card, grade);
            const nextStats = {
              ...sessionStats,
              correct: sessionStats.correct + 1,
              streak: sessionStats.streak + 1,
              bestStreak: Math.max(sessionStats.bestStreak, sessionStats.streak + 1),
            };
            setSessionStats(nextStats);
            newPractice(nextStats);
          },
          300,
        );
      }
    }
  }, [
    practiceState.phase,
    practiceState.positionIndex,
    sessionStats,
    newPractice,
    setSessionStats,
    practiceAutoDifficulty,
    deck.positions,
    setDeck,
    scheduleForSession,
    completePracticeSession,
  ]);

  const submitMove = useCallback(
    (san: string) => {
      const session = sessionRef.current;
      if (!canSubmitPracticeMove(session, currentFen)) return;
      const positionIndex = session.positionIndex;
      const card =
        positionIndex === undefined ? undefined : deckRef.current.positions[positionIndex];
      if (positionIndex === undefined || !card || card.fen !== session.currentFen) {
        completePracticeSession();
        return;
      }
      const timeTaken = Date.now() - cardStartTime;
      if (san === card.answer) {
        makeMove({ payload: san });
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
      if (sessionStats.mode !== "full") updateCardPerformance(setDeck, positionIndex, card.card, 1);
      setSession(
        practiceSessionReducer(session, {
          type: "incorrect",
          token: session.token,
          answer: card.answer,
          playedMove: san,
          timeTaken,
        }),
      );
      setSessionStats((previous) => ({
        ...previous,
        incorrect: previous.incorrect + 1,
        streak: 0,
      }));
      scheduleForSession(session.token, goToNext, 500);
    },
    [
      cardStartTime,
      currentFen,
      completePracticeSession,
      goToNext,
      makeMove,
      scheduleForSession,
      sessionStats.mode,
      setDeck,
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
    if (practiceState.phase !== "correct" || practiceState.positionIndex === undefined) return;

    const { positionIndex } = practiceState;
    const card = deck.positions[positionIndex].card;

    updateCardPerformance(setDeck, positionIndex, card, grade);
    setSessionStats((prev) => ({
      ...prev,
      correct: prev.correct + 1,
      streak: prev.streak + 1,
      bestStreak: Math.max(prev.bestStreak, prev.streak + 1),
    }));
    newPractice();
  }

  function startPractice() {
    setCompletedSummary(null);
    const stats: Partial<PracticeSessionStats> = {
      mode: "anki",
      remainingPositions: [],
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
    const indices = deck.positions.map((_, i) => i);
    const stats: Partial<PracticeSessionStats> = {
      mode: "full",
      remainingPositions: indices,
      correct: 0,
      incorrect: 0,
      streak: 0,
      bestStreak: 0,
    };
    setSessionStats((prev) => ({ ...prev, ...stats }));
    newPractice(stats);
  }

  function skipCard() {
    if (sessionStats.mode === "full" && sessionStats.remainingPositions.length > 0) {
      const remainingPositions = sessionStats.remainingPositions.slice(1);
      setSessionStats((prev) => ({ ...prev, remainingPositions }));
      newPractice({ remainingPositions });
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
                      <Progress.Section value={(stats.due / stats.total) * 100} color="yellow" />
                    </Tooltip>
                    <Tooltip
                      label={t("Board.Practice.Statistic", {
                        label: t("Board.Practice.Unseen"),
                        count: stats.unseen,
                      })}
                    >
                      <Progress.Section value={(stats.unseen / stats.total) * 100} color="gray" />
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
                                (displayedSessionStats.correct + displayedSessionStats.incorrect)) *
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
                      practiceState.positionIndex !== undefined
                        ? deck.positions[practiceState.positionIndex].card
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
                  <Button variant="subtle" size="xs" color="red" onClick={() => toggleResetModal()}>
                    {t("Common.Reset")}
                  </Button>
                </Group>
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
        onConfirm={() => {
          const cards = buildFromTree(root, headers.orientation || "white", headers.start || []);
          setDeck({ positions: cards, logs: [] });
          endPracticeSession();
          toggleResetModal();
        }}
        confirmLabel={t("Common.Reset")}
      />
      {positionsOpen && (
        <PositionsModal open={positionsOpen} setOpen={setPositionsOpen} deck={deck} />
      )}
      <LogsModal open={logsOpen} setOpen={setLogsOpen} logs={deck.logs} />
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
  deck: PracticeData;
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
  logs,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  logs: PracticeData["logs"];
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
      title={<b>{t("Board.Practice.Logs")}</b>}
    >
      <SimpleGrid cols={2}>
        {logs.length === 0 && <Text>{t("Board.Practice.NoLogsYet")}</Text>}
        {logs.map((log) => {
          const position = findFen(log.fen, root);
          if (!position) return null;
          const node = getNodeAtPath(root, position);

          return (
            <Card key={log.fen}>
              <Text>
                {Math.floor(node.halfMoves / 2) + 1}
                {node.halfMoves % 2 === 0 ? ". " : "... "}
                {node.san}
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

export default PracticePanel;
