import { useTabAtom } from "@/state/tabScope";
import { tauri } from "@/platform/tauri";
import {
  Accordion,
  Alert,
  Badge,
  Button,
  Divider,
  Group,
  Paper,
  Portal,
  RangeSlider,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useSessionStorage } from "@mantine/hooks";
import {
  IconAlertTriangle,
  IconFlame,
  IconPlus,
  IconSettings,
  IconTrash,
  IconX,
  IconZoomCheck,
} from "@tabler/icons-react";
import { makeSquare } from "chessops";
import { useAtom } from "jotai";
import { useContext, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { type PathRef, type PuzzleDatabaseInfo } from "@/bindings";
import { IconAction } from "@/components/common/IconAction";
import { notifyUnlessCancelled } from "@/components/files/notifyError";
import {
  currentPuzzleFamily,
  puzzleTimerFamily,
  hidePuzzleRatingAtom,
  jumpToNextPuzzleAtom,
  progressivePuzzlesAtom,
  puzzleRatingRangeAtom,
  puzzleThemeAtom,
  puzzleWorkspaceGenerationAtom,
  selectedPuzzleDbAtom,
  tabsAtom,
  trackPuzzleTimeAtom,
} from "@/state/atoms";
import { positionFromFen } from "@/utils/chessops";
import { validateMoveSequence } from "@/state/store/tree";
import { puzzleDatabaseExtension } from "@/utils/db";
import { formatThemeLabel, formatTime } from "@/utils/format";
import { capabilityKey } from "@/utils/pathCapabilities";
import { normalizeError, runDestructiveWithRefresh } from "@/platform/errors";
import {
  captureTreePositionOwner,
  getPuzzleProgress,
  type Completion,
  getPuzzleDatabases,
  type Puzzle,
} from "@/utils/puzzles";
import { createTab, runTabCreation } from "@/utils/tabs";
import {
  defaultTree,
  getBoardState,
  getNodeAtPath,
  getResolvedPathLength,
} from "@/utils/treeReducer";
import ChallengeHistory from "../common/ChallengeHistory";
import ConfirmModal from "../common/ConfirmModal";
import GameNotation from "../common/GameNotation";
import MoveControls from "../common/MoveControls";
import { TreeStateContext } from "../common/TreeStateContext";
import AddPuzzle from "./AddPuzzle";
import PuzzleBoard from "./PuzzleBoard";

const puzzleRatingMarks = [600, 1700, 2800] as const;
const unavailableValue = "-";
const addOptionLabel = (label: string) => `+ ${label}`;

function Puzzles({ id }: { id: string }) {
  const { t } = useTranslation();
  const commonErrorRef = useRef(t("Common.Error"));
  commonErrorRef.current = t("Common.Error");
  const store = useContext(TreeStateContext)!;
  const setFen = useStore(store, (s) => s.setFen);
  const goToStart = useStore(store, (s) => s.goToStart);
  const reset = useStore(store, (s) => s.reset);
  const makeMove = useStore(store, (s) => s.makeMove);
  const setShapes = useStore(store, (s) => s.setShapes);
  const root = useStore(store, (s) => s.root);
  const position = useStore(store, (s) => s.position);
  const [puzzles, setPuzzles] = useSessionStorage<Puzzle[]>({
    key: `${id}-puzzles`,
    defaultValue: [],
  });
  const [currentPuzzle, setCurrentPuzzle] = useAtom(useTabAtom(currentPuzzleFamily));
  const latestPuzzle = useRef({ puzzle: puzzles[currentPuzzle], index: currentPuzzle });
  latestPuzzle.current = { puzzle: puzzles[currentPuzzle], index: currentPuzzle };
  const mounted = useRef(true);

  const [puzzleDbs, setPuzzleDbs] = useState<PuzzleDatabaseInfo[]>([]);
  const [selectedDb, setSelectedDb] = useAtom(selectedPuzzleDbAtom);
  const [workspaceGeneration, setWorkspaceGeneration] = useAtom(puzzleWorkspaceGenerationAtom);
  const [listedWorkspaceGeneration, setListedWorkspaceGeneration] = useState<number | null>(null);

  const [settingsOpened, setSettingsOpened] = useState(false);
  const requestGeneration = useRef(0);
  const puzzleRequest = useRef<AbortController | null>(null);
  const solutionAbortRef = useRef<AbortController | null>(null);
  const listingController = useRef<AbortController | null>(null);
  const themeController = useRef<AbortController | null>(null);
  const completedThemeController = useRef<AbortController | null>(null);
  const resetWorkspaceRef = useRef<() => void>(() => {});
  const workspaceRef = useRef<string | null>(null);
  const workspaceRequest = useRef(0);
  const selectedDbRef = useRef(selectedDb);
  selectedDbRef.current = selectedDb;

  const effectiveSelectedDb =
    listedWorkspaceGeneration === workspaceGeneration &&
    selectedDb &&
    puzzleDbs.some((database) => capabilityKey(database.path) === capabilityKey(selectedDb))
      ? selectedDb
      : null;
  const effectiveSelectedDbRef = useRef(effectiveSelectedDb);
  effectiveSelectedDbRef.current = effectiveSelectedDb;
  const effectiveSelectedDbKey = effectiveSelectedDb ? capabilityKey(effectiveSelectedDb) : null;

  function ownsDatabaseRequest(database: PathRef, signal: AbortSignal): boolean {
    const currentDatabase = effectiveSelectedDbRef.current;
    return (
      !signal.aborted &&
      currentDatabase !== null &&
      capabilityKey(currentDatabase) === capabilityKey(database)
    );
  }

  useEffect(() => {
    requestGeneration.current++;
    puzzleRequest.current?.abort();
    solutionAbortRef.current?.abort();
    solutionAbortRef.current = null;
    setIsPlayingSolution(false);
    completedThemeController.current?.abort();
    completedThemeController.current = null;
  }, [effectiveSelectedDbKey]);

  useEffect(() => {
    completedThemeController.current?.abort();
    completedThemeController.current = null;
  }, [currentPuzzle]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      puzzleRequest.current?.abort();
      solutionAbortRef.current?.abort();
      solutionAbortRef.current = null;
      listingController.current?.abort();
      themeController.current?.abort();
      completedThemeController.current?.abort();
    };
  }, []);

  useEffect(() => {
    let active = true;
    const listingRequest = ++workspaceRequest.current;
    listingController.current?.abort();
    const controller = new AbortController();
    listingController.current = controller;
    requestGeneration.current++;
    puzzleRequest.current?.abort();
    void Promise.all([tauri.getPuzzleWorkspace(), getPuzzleDatabases(controller.signal)])
      .then(([workspace, databases]) => {
        if (!active || listingRequest !== workspaceRequest.current) return;
        const workspaceKey = capabilityKey(workspace.root);
        const workspaceChanged =
          workspaceRef.current !== null && workspaceRef.current !== workspaceKey;
        workspaceRef.current = workspaceKey;
        setPuzzleDbs(databases);
        setListedWorkspaceGeneration(workspaceGeneration);
        const currentSelection = selectedDbRef.current;
        if (
          workspaceChanged ||
          (currentSelection &&
            !databases.some(
              (database) => capabilityKey(database.path) === capabilityKey(currentSelection),
            ))
        ) {
          requestGeneration.current++;
          puzzleRequest.current?.abort();
          resetWorkspaceRef.current();
        }
      })
      .catch((error) => {
        if (active && listingRequest === workspaceRequest.current) {
          setPuzzleDbs([]);
          setListedWorkspaceGeneration(null);
          if (normalizeError(error).category !== "cancelled") {
            notifyUnlessCancelled(commonErrorRef.current, error, "puzzle");
          }
        }
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [workspaceGeneration]);

  const [ratingRange, setRatingRange] = useAtom(puzzleRatingRangeAtom);

  const [selectedTheme, setSelectedTheme] = useAtom(puzzleThemeAtom);
  const [availableThemes, setAvailableThemes] = useState<string[]>([]);
  const [themesTableMissing, setThemesTableMissing] = useState(false);
  const effectiveSelectedTheme =
    selectedTheme && availableThemes.includes(selectedTheme) ? selectedTheme : null;

  useEffect(() => {
    let cancelled = false;
    themeController.current?.abort();
    const controller = new AbortController();
    themeController.current = controller;
    setThemesTableMissing(false);

    if (!effectiveSelectedDb) {
      setAvailableThemes([]);
      return;
    }
    const database = effectiveSelectedDb;
    const isCurrent = () => !cancelled && ownsDatabaseRequest(database, controller.signal);

    void tauri
      .getPuzzleThemes(effectiveSelectedDb, { signal: controller.signal })
      .then((themes) => {
        if (!isCurrent()) return;
        setAvailableThemes(themes);
      })
      .catch((error: Error) => {
        if (!isCurrent()) return;
        const normalized = normalizeError(error);
        setAvailableThemes([]);
        const themesUnavailable = normalized.backendCategory === "puzzle-themes-unavailable";
        setThemesTableMissing(themesUnavailable);
        if (!themesUnavailable) {
          notifyUnlessCancelled(commonErrorRef.current, error);
        }
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [effectiveSelectedDb]);

  const [jumpToNextPuzzleImmediately, setJumpToNextPuzzleImmediately] =
    useAtom(jumpToNextPuzzleAtom);

  const wonPuzzles = puzzles.filter((p) => p.completion === "correct");
  const lostPuzzles = puzzles.filter((p) => p.completion === "incorrect");

  const totalCompleted = wonPuzzles.length + lostPuzzles.length;
  const accuracy =
    totalCompleted > 0 ? Math.round((wonPuzzles.length / totalCompleted) * 100) : null;

  let currentStreak = 0;
  for (let i = puzzles.length - 1; i >= 0; i--) {
    if (puzzles[i].completion === "correct") currentStreak++;
    else if (puzzles[i].completion === "incorrect") break;
  }

  const avgTimeSeconds =
    wonPuzzles.length > 0
      ? wonPuzzles.reduce((acc, p) => acc + (p.timeSpent || 0), 0) / wonPuzzles.length / 1000
      : 0;

  function admitPuzzle(
    puzzle: Puzzle,
    index: number,
    {
      append = false,
      resumeTimer = true,
      isCurrent = () => true,
    }: {
      append?: boolean;
      resumeTimer?: boolean;
      isCurrent?: () => boolean;
    } = {},
  ) {
    try {
      if (!isCurrent()) return;
      const result = validateMoveSequence(puzzle.fen, puzzle.moves);
      if (!result.success) throw result.error;
      if (!isCurrent()) return;
      if (!append) {
        requestGeneration.current++;
        puzzleRequest.current?.abort();
      }
      solutionAbortRef.current?.abort();
      setIsPlayingSolution(false);
      setFen(puzzle.fen);
      if (result.moves[0]) makeMove({ payload: result.moves[0] });
      if (append) setPuzzles((previous) => [...previous, puzzle]);
      setCurrentPuzzle(index);
      if (resumeTimer) {
        setTimerStart(
          puzzle.completion === "incomplete" ? Date.now() - (puzzle.timeSpent || 0) : null,
        );
      }
    } catch (error) {
      if (isCurrent()) notifyUnlessCancelled(commonErrorRef.current, error);
    }
  }

  async function generatePuzzle(
    db: PathRef,
    force: boolean = false,
    isOwned: () => boolean = () => true,
  ) {
    if (!isOwned()) return;
    let nextIndex = puzzles.findIndex((p, i) => i > currentPuzzle && p.completion === "incomplete");
    if (nextIndex === -1) {
      nextIndex = puzzles.findIndex((p, i) => i < currentPuzzle && p.completion === "incomplete");
    }

    if (nextIndex !== -1 && !force) {
      admitPuzzle(puzzles[nextIndex], nextIndex, { resumeTimer: trackTime, isCurrent: isOwned });
      return;
    }

    solutionAbortRef.current?.abort();
    setIsPlayingSolution(false);

    let range = ratingRange;
    if (progressive) {
      const rating = puzzles[currentPuzzle]?.rating;
      if (rating) {
        range = [rating + 50, rating + 100];
        setRatingRange([rating + 50, rating + 100]);
      }
    }
    const generation = ++requestGeneration.current;
    puzzleRequest.current?.abort();
    const request = new AbortController();
    puzzleRequest.current = request;
    const isCurrent = () =>
      isOwned() &&
      generation === requestGeneration.current &&
      ownsDatabaseRequest(db, request.signal);
    let result;
    try {
      result = await tauri.getPuzzle(db, range[0], range[1], effectiveSelectedTheme, {
        signal: request.signal,
      });
    } catch (error) {
      if (isCurrent()) {
        notifyUnlessCancelled(commonErrorRef.current, error);
      }
      return;
    }
    if (!isCurrent()) return;
    const puzzle = result;
    const newPuzzle: Puzzle = {
      ...puzzle,
      moves: puzzle.moves.split(" "),
      completion: "incomplete",
    };
    admitPuzzle(newPuzzle, puzzles.length, { append: true, resumeTimer: trackTime, isCurrent });
  }

  async function changeCompletion(completion: Completion, isCurrent: () => boolean = () => true) {
    if (!isCurrent()) return;
    const puzzle = puzzles[currentPuzzle];
    if (!puzzle || puzzle.completion !== "incomplete") return;
    // Claim the shared record synchronously before publishing or awaiting metadata.
    puzzle.completion = completion;
    puzzle.timeSpent = timerStart !== null ? Date.now() - timerStart : 0;
    setPuzzles([...puzzles]);
    setTimerStart(null);

    if (effectiveSelectedDb && puzzle?.id) {
      const database = effectiveSelectedDb;
      const generation = requestGeneration.current;
      completedThemeController.current?.abort();
      const controller = new AbortController();
      completedThemeController.current = controller;
      const ownsCompletion = () =>
        isCurrent() &&
        generation === requestGeneration.current &&
        ownsDatabaseRequest(database, controller.signal);
      try {
        const themes = await tauri.getThemesForPuzzle(database, puzzle.id, {
          signal: controller.signal,
        });
        if (!ownsCompletion()) return;
        setPuzzles((puzzles) => {
          if (!ownsCompletion() || puzzles[currentPuzzle] !== puzzle) return puzzles;
          puzzles[currentPuzzle].themes = themes;
          return [...puzzles];
        });
      } catch (error) {
        if (ownsCompletion() && normalizeError(error).category !== "cancelled") {
          notifications.show({
            title: t("Common.Error"),
            message: normalizeError(error).message,
            color: "red",
          });
        }
      }
    }
  }

  const [addOpened, setAddOpened] = useState(false);
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [isPlayingSolution, setIsPlayingSolution] = useState(false);

  const [progressive, setProgressive] = useAtom(progressivePuzzlesAtom);
  const [hideRating, setHideRating] = useAtom(hidePuzzleRatingAtom);
  const [trackTime, setTrackTime] = useAtom(trackPuzzleTimeAtom);

  const [timerStart, setTimerStart] = useAtom(useTabAtom(puzzleTimerFamily));
  const [, setTick] = useState(0);
  resetWorkspaceRef.current = () => {
    solutionAbortRef.current?.abort();
    setPuzzles([]);
    setCurrentPuzzle(0);
    setAvailableThemes([]);
    setThemesTableMissing(false);
    setSelectedTheme(null);
    setTimerStart(null);
    setIsPlayingSolution(false);
    reset();
  };
  const isPuzzleIncomplete = puzzles[currentPuzzle]?.completion === "incomplete";
  const elapsedTime =
    timerStart && isPuzzleIncomplete && trackTime
      ? Date.now() - timerStart
      : puzzles[currentPuzzle]?.timeSpent || 0;

  useEffect(() => {
    if (trackTime && isPuzzleIncomplete && timerStart === null) {
      setTimerStart(Date.now());
    }
  }, [trackTime, isPuzzleIncomplete, timerStart, setTimerStart]);

  useEffect(() => {
    if (!trackTime || !isPuzzleIncomplete || timerStart === null) return;

    const displayInterval = setInterval(() => {
      setTick((t) => t + 1);
    }, 100);

    return () => clearInterval(displayInterval);
  }, [trackTime, isPuzzleIncomplete, timerStart]);

  useEffect(() => {
    const puzzle =
      latestPuzzle.current.index === currentPuzzle ? latestPuzzle.current.puzzle : undefined;
    return () => {
      if (trackTime && timerStart !== null && puzzle?.completion === "incomplete") {
        const finalElapsed = Date.now() - timerStart;
        setPuzzles((prev) => {
          if (prev[currentPuzzle] !== puzzle || puzzle.completion !== "incomplete") return prev;
          const newPuzzles = [...prev];
          puzzle.timeSpent = finalElapsed;
          return newPuzzles;
        });
      }
    };
  }, [trackTime, timerStart, currentPuzzle, isPuzzleIncomplete, setPuzzles]);

  const [, setTabs] = useAtom(tabsAtom);

  const turnToMove =
    puzzles[currentPuzzle] !== undefined
      ? positionFromFen(puzzles[currentPuzzle]?.fen)[0]?.turn
      : null;

  const hintMove = getPuzzleProgress(puzzles[currentPuzzle], root, position).nextMove;

  return (
    <>
      <Portal target="#left" style={{ height: "100%" }}>
        <PuzzleBoard
          key={currentPuzzle}
          puzzles={puzzles}
          currentPuzzle={currentPuzzle}
          changeCompletion={changeCompletion}
          generatePuzzle={(database, isCurrent) => generatePuzzle(database, false, isCurrent)}
          db={effectiveSelectedDb}
        />
      </Portal>
      <Portal target="#topRight" style={{ height: "100%" }}>
        <Paper
          h="100%"
          withBorder
          p="md"
          style={{
            overflow: "hidden",
          }}
        >
          <AddPuzzle
            puzzleDbs={puzzleDbs}
            opened={addOpened}
            setOpened={setAddOpened}
            setPuzzleDbs={setPuzzleDbs}
            onWorkspaceChanged={() => setWorkspaceGeneration((generation) => generation + 1)}
          />
          <ConfirmModal
            title={t("Puzzle.DeleteDatabase")}
            description={t("Puzzle.DeleteDatabaseConfirm")}
            opened={deleteModalOpened}
            onClose={() => setDeleteModalOpened(false)}
            onConfirm={async () => {
              if (effectiveSelectedDb) {
                const deletedDb = effectiveSelectedDb;
                try {
                  await runDestructiveWithRefresh(
                    () => tauri.deletePuzzleDatabase(deletedDb),
                    () => {
                      setPuzzleDbs((dbs) =>
                        dbs.filter((db) => capabilityKey(db.path) !== capabilityKey(deletedDb)),
                      );
                      if (
                        selectedDbRef.current &&
                        capabilityKey(selectedDbRef.current) === capabilityKey(deletedDb)
                      ) {
                        requestGeneration.current++;
                        puzzleRequest.current?.abort();
                        setSelectedDb(null);
                        resetWorkspaceRef.current();
                      }
                      setDeleteModalOpened(false);
                    },
                  );
                } catch (error) {
                  notifications.show({
                    color: "red",
                    title: t("Common.Error"),
                    message: normalizeError(error).message,
                  });
                }
              }
            }}
          />
          <Group justify="space-between" pb="sm">
            <Select
              style={{ flex: 1 }}
              data={puzzleDbs
                .map((p) => ({
                  label: p.title.split(puzzleDatabaseExtension)[0],
                  value: capabilityKey(p.path),
                }))
                .concat({ label: addOptionLabel(t("Common.AddNew")), value: "add" })}
              value={effectiveSelectedDb ? capabilityKey(effectiveSelectedDb) : null}
              clearable={false}
              placeholder={t("Puzzle.SelectDatabase")}
              onChange={(v) => {
                if (v === "add") {
                  setAddOpened(true);
                } else {
                  requestGeneration.current++;
                  puzzleRequest.current?.abort();
                  setSelectedDb(
                    puzzleDbs.find((database) => capabilityKey(database.path) === v)?.path ?? null,
                  );
                }
              }}
            />
            <Group gap="xs">
              <IconAction
                label={t("Puzzle.DeleteDatabase")}
                color="red"
                disabled={!effectiveSelectedDb}
                onClick={() => setDeleteModalOpened(true)}
              >
                <IconTrash size={20} />
              </IconAction>
              <IconAction
                label={t("SideBar.Settings")}
                pressed={settingsOpened}
                onClick={() => setSettingsOpened((o) => !o)}
              >
                <IconSettings size={20} />
              </IconAction>
            </Group>
          </Group>
          <Accordion
            value={settingsOpened ? "settings" : null}
            onChange={(v) => setSettingsOpened(v === "settings")}
            mb="sm"
          >
            <Accordion.Item value="settings">
              <Accordion.Panel>
                <Stack gap="md">
                  {themesTableMissing && (
                    <Alert
                      icon={<IconAlertTriangle />}
                      title={t("Puzzle.DatabaseOutdated")}
                      color="yellow"
                    >
                      {t("Puzzle.DatabaseOutdatedDesc")}
                    </Alert>
                  )}
                  <div>
                    <Text size="sm" fw={500} mb={4}>
                      {t("Puzzle.RatingRange")}
                    </Text>
                    <RangeSlider
                      min={600}
                      my="md"
                      max={2800}
                      value={ratingRange}
                      onChange={setRatingRange}
                      disabled={progressive}
                      marks={puzzleRatingMarks.map((value) => ({ value, label: String(value) }))}
                    />
                  </div>
                  <Select
                    label={t("Puzzle.Theme")}
                    placeholder={t("Puzzle.AllThemes")}
                    data={availableThemes.map((theme) => ({
                      label: formatThemeLabel(theme),
                      value: theme,
                    }))}
                    value={effectiveSelectedTheme}
                    onChange={setSelectedTheme}
                    clearable
                    searchable
                  />
                  <SimpleGrid cols={2} spacing="sm">
                    <Switch
                      label={t("Puzzle.Progressive")}
                      description={t("Puzzle.Progressive.Desc")}
                      checked={progressive}
                      onChange={(event) => setProgressive(event.currentTarget.checked)}
                    />
                    <Switch
                      label={t("Puzzle.HideRating")}
                      description={t("Puzzle.HideRating.Desc")}
                      checked={hideRating}
                      onChange={(event) => setHideRating(event.currentTarget.checked)}
                    />
                    <Switch
                      label={t("Puzzle.JumpToNextPuzzleImmediately")}
                      description={t("Puzzle.JumpToNextPuzzleImmediately.Desc")}
                      checked={jumpToNextPuzzleImmediately}
                      onChange={(event) =>
                        setJumpToNextPuzzleImmediately(event.currentTarget.checked)
                      }
                    />
                    <Switch
                      label={t("Puzzle.TrackPuzzleTime")}
                      description={t("Puzzle.TrackPuzzleTime.Desc")}
                      checked={trackTime}
                      onChange={(event) => {
                        if (!event.currentTarget.checked) {
                          setTimerStart(null);
                          setTrackTime(false);
                        } else {
                          setTrackTime(true);
                        }
                      }}
                    />
                  </SimpleGrid>
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
          <Group grow>
            <Paper withBorder p="xs">
              <Text size="xs" c="dimmed">
                {t("Puzzle.Rating")}
              </Text>
              <Text fw={700} size="lg">
                {isPuzzleIncomplete && hideRating && puzzles[currentPuzzle]?.rating
                  ? "?"
                  : puzzles[currentPuzzle]?.rating || unavailableValue}
              </Text>
            </Paper>

            {trackTime && (
              <Paper withBorder p="xs">
                <Text size="xs" c="dimmed">
                  {t("Puzzle.Time")}
                </Text>
                <Text fw={700} size="lg" ff="monospace">
                  {formatTime(elapsedTime)}
                </Text>
              </Paper>
            )}

            <Paper withBorder p="xs">
              <Text size="xs" c="dimmed">
                {t("Puzzle.Accuracy")}
              </Text>
              <Text
                fw={700}
                size="lg"
                c={accuracy === null ? "dimmed" : accuracy >= 50 ? "teal" : "orange"}
              >
                {accuracy !== null ? `${accuracy}%` : unavailableValue}
              </Text>
            </Paper>

            <Paper withBorder p="xs">
              <Text size="xs" c="dimmed">
                {t("Puzzle.Streak")}
              </Text>
              <Group gap={2}>
                <Text fw={700} size="lg">
                  {currentStreak}
                </Text>
                <IconFlame size={20} color="orange" />
              </Group>
            </Paper>

            {trackTime && avgTimeSeconds > 0 && (
              <Paper withBorder p="xs">
                <Text size="xs" c="dimmed">
                  {t("Puzzle.AvgTime")}
                </Text>
                <Text fw={700} size="lg">
                  {t("Common.SecondsShort", { value: avgTimeSeconds.toFixed(1) })}
                </Text>
              </Paper>
            )}
          </Group>
          <Divider my="sm" />
          {!isPuzzleIncomplete && (puzzles[currentPuzzle]?.themes?.length ?? 0) > 0 && (
            <Group gap="xs" mb="sm">
              {puzzles[currentPuzzle]?.themes?.map((theme) => (
                <Badge key={theme} variant="light" size="sm">
                  {formatThemeLabel(theme)}
                </Badge>
              ))}
            </Group>
          )}
          <Group justify="space-between">
            <Text fz="1.75rem" fw={500}>
              {!turnToMove
                ? ""
                : turnToMove === "white"
                  ? t("Fen.BlackToMove")
                  : t("Fen.WhiteToMove")}
            </Text>
            <Group gap="xs">
              <IconAction
                label={t("Puzzle.NewPuzzle")}
                disabled={!effectiveSelectedDb}
                onClick={() => generatePuzzle(effectiveSelectedDb!, true)}
              >
                <IconPlus />
              </IconAction>
              <IconAction
                label={t("Puzzle.AnalyzePosition")}
                disabled={!effectiveSelectedDb || !turnToMove}
                onClick={() => {
                  void runTabCreation({
                    create: () =>
                      createTab({
                        tab: { name: t("Puzzle.AnalysisTitle"), type: "analysis" },
                        setTabs,
                        pgn: puzzles[currentPuzzle]?.moves.join(" "),
                        headers: {
                          ...defaultTree().headers,
                          fen: puzzles[currentPuzzle]?.fen,
                          orientation: turnToMove === "white" ? "black" : "white",
                        },
                      }),
                    onError: (error) => notifyUnlessCancelled(t("Common.Error"), error),
                  });
                }}
              >
                <IconZoomCheck />
              </IconAction>
              <IconAction
                label={t("Puzzle.ClearSession")}
                onClick={() => {
                  setPuzzles([]);
                  reset();
                  setTimerStart(null);
                  setIsPlayingSolution(false);
                }}
              >
                <IconX />
              </IconAction>
            </Group>
          </Group>
          <Group grow>
            <Button
              mt="sm"
              variant="light"
              fullWidth
              onClick={async () => {
                solutionAbortRef.current?.abort();
                setIsPlayingSolution(false);
                const abortController = new AbortController();
                solutionAbortRef.current = abortController;
                const curPuzzle = puzzles[currentPuzzle];
                const result = validateMoveSequence(curPuzzle.fen, curPuzzle.moves);
                if (!result.success) {
                  notifyUnlessCancelled(commonErrorRef.current, result.error);
                  return;
                }

                const state = store.getState();
                const nextMove = getPuzzleProgress(curPuzzle, state.root, state.position).nextMove;
                if (!nextMove) return;
                if (curPuzzle.completion === "incomplete") {
                  void changeCompletion("incorrect");
                }

                const from = makeSquare(nextMove.from);
                const to = makeSquare(nextMove.to);
                const currentShapes = store.getState().currentNode().shapes;

                // Progressive hints: circle > arrow > clear
                const hasCircle = currentShapes.some((s) => s.orig === from && !s.dest);
                const hasArrow = currentShapes.some((s) => s.orig === from && s.dest === to);

                if (hasArrow) {
                  // Third click: Remove all hint shapes for this move
                  setShapes(
                    currentShapes.filter((s) => !(s.orig === from && (!s.dest || s.dest === to))),
                  );
                } else if (hasCircle) {
                  // Second click: Replace circle with arrow
                  setShapes([
                    ...currentShapes.filter((s) => !(s.orig === from && !s.dest)),
                    { orig: from, dest: to, brush: "green" },
                  ]);
                } else {
                  // First click: Add circle
                  setShapes([...currentShapes, { orig: from, dest: undefined, brush: "green" }]);
                }
              }}
              disabled={puzzles.length === 0 || !hintMove || isPlayingSolution}
            >
              {t("Puzzle.GetAHint")}
            </Button>
            <Button
              mt="sm"
              variant="light"
              fullWidth
              onClick={async () => {
                solutionAbortRef.current?.abort();
                const abortController = new AbortController();
                solutionAbortRef.current = abortController;
                const curPuzzle = puzzles[currentPuzzle];
                const databaseKey = effectiveSelectedDbKey;
                const isOwner = () =>
                  mounted.current &&
                  solutionAbortRef.current === abortController &&
                  !abortController.signal.aborted &&
                  latestPuzzle.current.puzzle === curPuzzle &&
                  latestPuzzle.current.index === currentPuzzle &&
                  (effectiveSelectedDbRef.current
                    ? capabilityKey(effectiveSelectedDbRef.current)
                    : null) === databaseKey;
                let ownsPosition = captureTreePositionOwner(store);
                const isCurrent = () => isOwner() && ownsPosition();
                setIsPlayingSolution(true);
                try {
                  const result = validateMoveSequence(curPuzzle.fen, curPuzzle.moves);
                  if (!result.success) throw result.error;
                  if (!isCurrent()) return;
                  const state = store.getState();
                  const start = state.headers.start ?? [];
                  if (
                    getBoardState(state.root.fen) !== getBoardState(curPuzzle.fen) ||
                    getResolvedPathLength(state.root, start) !== start.length ||
                    getBoardState(getNodeAtPath(state.root, start).fen) !==
                      getBoardState(curPuzzle.fen)
                  )
                    return;
                  if (curPuzzle.completion === "incomplete") {
                    void changeCompletion("incorrect", isCurrent);
                  }
                  goToStart();
                  const started = store.getState();
                  if (
                    !isOwner() ||
                    started.root !== state.root ||
                    started.position.length !== start.length ||
                    !started.position.every((index, i) => index === start[i])
                  )
                    return;
                  ownsPosition = captureTreePositionOwner(store, started);
                  for (const move of result.moves) {
                    if (!isCurrent()) return;
                    try {
                      makeMove({ payload: move, mainline: true });
                    } finally {
                      if (isOwner()) ownsPosition = captureTreePositionOwner(store);
                    }
                    await new Promise((r) => setTimeout(r, 500));
                    if (!isCurrent()) return;
                  }
                } catch (error) {
                  if (isCurrent()) notifyUnlessCancelled(commonErrorRef.current, error);
                } finally {
                  if (solutionAbortRef.current === abortController) {
                    solutionAbortRef.current = null;
                    setIsPlayingSolution(false);
                  }
                }
              }}
              disabled={puzzles.length === 0}
            >
              {t("Puzzle.ViewSolution")}
            </Button>
          </Group>
        </Paper>
      </Portal>
      <Portal target="#bottomRight" style={{ height: "100%" }}>
        <Stack h="100%" gap="xs">
          <Paper withBorder p="md" mih="5rem">
            <ScrollArea h="100%" offsetScrollbars>
              <ChallengeHistory
                challenges={puzzles.map((p) => ({
                  ...p,
                  label: p.rating?.toString() ?? unavailableValue,
                }))}
                current={currentPuzzle}
                select={(i) => {
                  if (i === currentPuzzle) return;
                  admitPuzzle(puzzles[i], i);
                }}
              />
            </ScrollArea>
          </Paper>
          <Stack flex={1} gap="xs">
            <GameNotation />
            <MoveControls readOnly />
          </Stack>
        </Stack>
      </Portal>
    </>
  );
}

export default Puzzles;
