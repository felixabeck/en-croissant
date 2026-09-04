import type { MantineColor } from "@mantine/core";
import { parseUci } from "chessops";
import { INITIAL_FEN, makeFen } from "chessops/fen";
import equal from "fast-deep-equal";
import { atom, type PrimitiveAtom } from "jotai";
import { atomFamily, atomWithStorage, unwrap } from "jotai/utils";
import type { AtomFamily } from "jotai/vanilla/utils/atomFamily";
import type {
    AsyncStorage,
    AsyncStringStorage,
    SyncStorage,
} from "jotai/vanilla/utils/atomWithStorage";
import type { ReviewLog } from "ts-fsrs";
import { z } from "zod";
import i18n from "@/i18n";
import type {
    BestMoves,
    DatabaseHandle,
    FileWorkspaceHandle,
    GoMode,
    OpeningBookHandle,
    PathRef,
} from "@/bindings";
import { DEFAULT_TIME_CONTROL, type OpponentSettings } from "@/components/boards/OpponentForm";
import { type Position, positionSchema } from "@/components/files/opening";
import type { LocalOptions } from "@/components/panels/database/DatabasePanel";
import { positionFromFen, swapMove } from "@/utils/chessops";
import { sameDatabaseHandle, type SuccessDatabaseInfo } from "@/utils/db";
import { type Engine, type EngineSettings, engineSchema } from "@/utils/engines";
import {
    type LichessGamesOptions,
    lichessGamesOptionsSchema,
    type MasterGamesOptions,
    masterOptionsSchema,
} from "@/utils/lichess/explorer";
import { getWinChance, normalizeScore } from "@/utils/score";
import { type Tab } from "./workspaceTypes";
import {
    fileWorkspaceHandleSchema,
    databaseHandleSchema,
    fileWorkspaceKey,
    pathRefSchema,
} from "../utils/pathCapabilities";
import { sessionsSchema, type Session } from "../utils/session";
import { createAsyncZodStorage, createPreferenceStorage, createZodStorage } from "./utils";
import { createWorkspaceStorage, defaultWorkspace, type Workspace } from "./workspace";
import { tabStorage } from "./store/tabStorage";
import { reportPersistError } from "./persistError";

const zodArray = <Input, Output>(itemSchema: z.ZodType<Output, z.ZodTypeDef, Input>) => {
    const catchValue = {} as never;

    const res = z
        .array(itemSchema.catch(catchValue))
        .transform((a) => a.filter((o): o is Output => o !== catchValue))
        .catch([]);

    return res as z.ZodType<Output[], z.ZodTypeDef, Input[]>;
};

// Tabs

const workspaceAtom = atomWithStorage<Workspace>(
    "workspace",
    defaultWorkspace(),
    createWorkspaceStorage(sessionStorage),
    { getOnInit: true },
);

export const tabsAtom = atom(
    (get) => get(workspaceAtom).tabs,
    (get, set, update: Tab[] | ((tabs: Tab[]) => Tab[])) => {
        const workspace = get(workspaceAtom);
        const tabs = typeof update === "function" ? update(workspace.tabs) : update;
        const activeTab = tabs.some((tab) => tab.value === workspace.activeTab)
            ? workspace.activeTab
            : (tabs[0]?.value ?? null);
        set(workspaceAtom, { ...workspace, tabs, activeTab });
    },
);

export const activeTabAtom = atom(
    (get) => get(workspaceAtom).activeTab,
    (get, set, update: string | null | ((activeTab: string | null) => string | null)) => {
        const workspace = get(workspaceAtom);
        const activeTab = typeof update === "function" ? update(workspace.activeTab) : update;
        set(workspaceAtom, {
            ...workspace,
            activeTab: workspace.tabs.some((tab) => tab.value === activeTab) ? activeTab : null,
        });
    },
);

/** Removes tab metadata and all tab-local persistence as one synchronous lifecycle operation. */
export const closeWorkspaceTabAtom = atom(null, (get, set, tabId: string) => {
    const workspace = get(workspaceAtom);
    const index = workspace.tabs.findIndex((tab) => tab.value === tabId);
    if (index === -1) return;
    const tabs = workspace.tabs.filter((tab) => tab.value !== tabId);
    const activeTab =
        workspace.activeTab !== tabId
            ? workspace.activeTab
            : (tabs[index]?.value ?? tabs[index - 1]?.value ?? null);
    tabStorage.remove(tabId);
    disposeTabAtoms(tabId);
    set(workspaceAtom, { ...workspace, tabs, activeTab });
});

export const expandedDirectoriesAtom = atomWithStorage<string[]>(
    "expanded-directories",
    [],
    createZodStorage(z.array(z.string()), sessionStorage),
);

export const currentTabAtom = atom(
    (get) => {
        const tabs = get(tabsAtom);
        const activeTab = get(activeTabAtom);
        return tabs.find((tab) => tab.value === activeTab);
    },
    (get, set, newValue: Tab | ((currentTab: Tab) => Tab)) => {
        const tabs = get(tabsAtom);
        const activeTab = get(activeTabAtom);
        const nextValue =
            typeof newValue === "function" ? newValue(get(currentTabAtom)!) : newValue;
        const newTabs = tabs.map((tab) => {
            if (tab.value === activeTab) {
                return nextValue;
            }
            return tab;
        });
        set(tabsAtom, newTabs);
    },
);

// Directories
// Legacy builds stored a renderer-visible document directory. It is deliberately
// scrubbed instead of migrated: only the native-issued opaque workspace survives.
if (typeof localStorage !== "undefined") localStorage.removeItem("document-dir");
// A native-issued, DownloadFile-only path capability.  Unlike the legacy directory settings it
// is opaque and never serializes a physical filesystem location into renderer storage.
export const downloadDestinationAtom = atomWithStorage<PathRef | null>(
    "download-destination-capability",
    null,
    createZodStorage(pathRefSchema.nullable(), localStorage),
    { getOnInit: true },
);
export const fileWorkspaceAtom = atomWithStorage<FileWorkspaceHandle | null>(
    "file-workspace",
    null,
    createZodStorage(fileWorkspaceHandleSchema.nullable(), localStorage),
);
/** Display metadata only; authority remains exclusively in fileWorkspaceAtom. */
export const fileWorkspaceDisplayNameAtom = atomWithStorage<string>(
    "file-workspace-display-name",
    "",
    createZodStorage(z.string().max(256), localStorage),
);

const enginesSchema = zodArray(engineSchema).transform((engines) => {
    const ids = new Set<string>();

    return engines.map((engine) => {
        if (ids.has(engine.id)) {
            return { ...engine, id: crypto.randomUUID() };
        }
        ids.add(engine.id);
        return engine;
    });
});

// Engine metadata contains only opaque native handles and display data. Keeping the async
// adapter preserves the existing atom update contract without granting a renderer directory.
export const enginesStorage: AsyncStringStorage = {
    async getItem(key) {
        return localStorage.getItem(key);
    },
    async setItem(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (cause) {
            reportPersistError(new Error(i18n.t("Engines.SaveError"), { cause }));
        }
    },
    async removeItem(key) {
        localStorage.removeItem(key);
    },
};

export const enginesAtom = unwrap(
    atomWithStorage<Engine[]>(
        "engines",
        [],
        createAsyncZodStorage(enginesSchema, enginesStorage) as AsyncStorage<Engine[]>,
    ),
);

// Settings

export const tableViewAtom = atomWithStorage<boolean>(
    "table-view",
    false,
    createPreferenceStorage(false),
);

export const fontSizeAtom = atomWithStorage(
    "font-size",
    Number.parseInt(document.documentElement.style.fontSize) || 100,
    createPreferenceStorage(Number.parseInt(document.documentElement.style.fontSize) || 100),
);

export const moveNotationTypeAtom = atomWithStorage<"letters" | "symbols">(
    "letters",
    "symbols",
    createZodStorage(z.enum(["letters", "symbols"]), localStorage),
);
export const moveMethodAtom = atomWithStorage<"drag" | "select" | "both">(
    "move-method",
    "both",
    createZodStorage(z.enum(["drag", "select", "both"]), localStorage),
);
export const spellCheckAtom = atomWithStorage<boolean>(
    "spell-check",
    false,
    createPreferenceStorage(false),
);
export const moveInputAtom = atomWithStorage<boolean>(
    "move-input",
    false,
    createPreferenceStorage(false),
);
export const showDestsAtom = atomWithStorage<boolean>(
    "show-dests",
    true,
    createPreferenceStorage(true),
);
export const moveHighlightAtom = atomWithStorage<boolean>(
    "move-highlight",
    true,
    createPreferenceStorage(true),
);
export const snapArrowsAtom = atomWithStorage<boolean>(
    "snap-dests",
    true,
    createPreferenceStorage(true),
);
export const showArrowsAtom = atomWithStorage<boolean>(
    "show-arrows",
    true,
    createPreferenceStorage(true),
);
export const showConsecutiveArrowsAtom = atomWithStorage<boolean>(
    "show-consecutive-arrows",
    false,
    createPreferenceStorage(false),
);
export const showVariationArrowsAtom = atomWithStorage<boolean>(
    "show-variation-arrows",
    false,
    createPreferenceStorage(false),
);
export const eraseDrawablesOnClickAtom = atomWithStorage<boolean>(
    "erase-drawables-on-click",
    false,
    createPreferenceStorage(false),
);
export const autoPromoteAtom = atomWithStorage<boolean>(
    "auto-promote",
    true,
    createPreferenceStorage(true),
);
export const autoSaveAtom = atomWithStorage<boolean>(
    "auto-save",
    true,
    createPreferenceStorage(true),
);
export const previewBoardOnHoverAtom = atomWithStorage<boolean>(
    "preview-board-on-hover",
    true,
    createPreferenceStorage(true),
);
export const flipBoardAfterMoveAtom = atomWithStorage<boolean>(
    "flip-board-after-move",
    true,
    createPreferenceStorage(true),
);
export const enableBoardScrollAtom = atomWithStorage<boolean>(
    "board-scroll",
    true,
    createPreferenceStorage(true),
);
export const materialDisplayAtom = atomWithStorage<"diff" | "all">(
    "material-display",
    "diff",
    createZodStorage(z.enum(["diff", "all"]), localStorage),
);
export const forcedEnPassantAtom = atomWithStorage<boolean>(
    "forced-ep",
    false,
    createPreferenceStorage(false),
);
export const showCoordinatesAtom = atomWithStorage<"no" | "edge" | "all">(
    "show-coordinates-v2",
    "no",
    createZodStorage(z.enum(["no", "edge", "all"]), localStorage),
    { getOnInit: true },
);
export const soundCollectionAtom = atomWithStorage<string>(
    "sound-collection",
    "standard",
    createPreferenceStorage("standard"),
    {
        getOnInit: true,
    },
);

export const soundVolumeAtom = atomWithStorage<number>(
    "sound-volume",
    0.8,
    createPreferenceStorage(0.8),
    {
        getOnInit: true,
    },
);

export const pieceSetAtom = atomWithStorage<string>(
    "piece-set",
    "staunty",
    createPreferenceStorage("staunty"),
);
export const boardImageAtom = atomWithStorage<string>(
    "board-image",
    "gray.svg",
    createPreferenceStorage("gray.svg"),
);
export const primaryColorAtom = atomWithStorage<MantineColor>(
    "mantine-primary-color",
    "blue",
    createPreferenceStorage<MantineColor>("blue"),
);
export const sessionsAtom = atomWithStorage<Session[]>(
    "sessions",
    [],
    createZodStorage(sessionsSchema, localStorage),
);
export const nativeBarAtom = atomWithStorage<boolean>(
    "native-bar",
    false,
    createPreferenceStorage(false),
);
export const telemetryEnabledAtom = atomWithStorage<boolean>(
    "telemetry-enabled",
    false,
    createPreferenceStorage(false),
    {
        getOnInit: true,
    },
);

// Recent Files

export type RecentFile = {
    name: string;
    handle: FileWorkspaceHandle;
    type: "game" | "repertoire" | "tournament" | "puzzle" | "other";
    lastOpened: number;
};

const MAX_RECENT_FILES = 10;

const recentFileSchema = z.object({
    name: z.string(),
    handle: fileWorkspaceHandleSchema,
    type: z.enum(["game", "repertoire", "tournament", "puzzle", "other"]),
    lastOpened: z.number(),
});

export const recentFilesAtom = atomWithStorage<RecentFile[]>(
    "recent-files",
    [],
    createZodStorage(z.array(recentFileSchema), localStorage),
);

export const addRecentFileAtom = atom(null, (get, set, file: Omit<RecentFile, "lastOpened">) => {
    const current = get(recentFilesAtom);
    const filtered = current.filter(
        (f) => fileWorkspaceKey(f.handle) !== fileWorkspaceKey(file.handle),
    );
    const updated = [{ ...file, lastOpened: Date.now() }, ...filtered].slice(0, MAX_RECENT_FILES);
    set(recentFilesAtom, updated);
});

// Database

export const referenceDbAtom = atomWithStorage<DatabaseHandle | null>(
    "reference-database",
    null,
    createZodStorage(databaseHandleSchema.nullable(), localStorage),
);

export const selectedPuzzleDbAtom = atomWithStorage<PathRef | null>(
    "puzzle-db",
    null,
    createZodStorage(pathRefSchema.nullable(), localStorage),
);
/** In-memory invalidation signal shared by Settings, the local picker, and Puzzle tabs. */
export const puzzleWorkspaceGenerationAtom = atom(0);

export type DatabaseConversionState = {
    inProgress: boolean;
    totalGames: number;
    elapsedSeconds: number;
    targetDatabase: DatabaseHandle | null;
    targetDatabaseTitle: string | null;
    sourceFileName: string | null;
};

export const idleDatabaseConversionState: DatabaseConversionState = {
    inProgress: false,
    totalGames: 0,
    elapsedSeconds: 0,
    targetDatabase: null,
    targetDatabaseTitle: null,
    sourceFileName: null,
};

/** Backend jobs are reconciled by their native IDs at startup; never restore a stale snapshot. */
export const databaseConversionStateAtom = atom<DatabaseConversionState>(
    idleDatabaseConversionState,
);

/** Restore the idle snapshot only when `previous.targetDatabase` is `handle`. */
export function clearOwnedConversion(handle: DatabaseHandle | null) {
    return (previous: DatabaseConversionState): DatabaseConversionState =>
        sameDatabaseHandle(previous.targetDatabase, handle)
            ? idleDatabaseConversionState
            : previous;
}

/** Database metadata is authoritative in native storage, not in renderer persistence. */
export const selectedDatabaseAtom = atom<SuccessDatabaseInfo | null>(null);

// Game Settings

export type GameInputColor = "white" | "random" | "black";

export const gameInputColorAtom = atomWithStorage<GameInputColor>(
    "game-input-color",
    "white",
    createZodStorage(z.enum(["white", "random", "black"]), localStorage),
);

const defaultPlayerSettings: OpponentSettings = {
    type: "human",
    name: "Player",
    timeControl: DEFAULT_TIME_CONTROL,
    timeUnit: "m",
    incrementUnit: "s",
};
export const gamePlayer1SettingsAtom = atomWithStorage<OpponentSettings>(
    "game-player1-settings",
    defaultPlayerSettings,
    createPreferenceStorage<OpponentSettings>(defaultPlayerSettings),
);

export const gamePlayer2SettingsAtom = atomWithStorage<OpponentSettings>(
    "game-player2-settings",
    defaultPlayerSettings,
    createPreferenceStorage<OpponentSettings>(defaultPlayerSettings),
);

export const gameSameTimeControlAtom = atomWithStorage<boolean>(
    "game-same-time-control",
    true,
    createPreferenceStorage(true),
);

export const gameOpeningBookHandleAtom = atomWithStorage<OpeningBookHandle | null>(
    "game-opening-book-handle",
    null,
    createZodStorage(
        z.object({ id: pathRefSchema, kind: z.literal("openingBook") }).nullable(),
        localStorage,
    ),
);

export const gameOpeningBookEnabledAtom = atomWithStorage<boolean>(
    "game-opening-book-enabled",
    false,
    createPreferenceStorage(false),
);

export const gameOpeningBookMaxPlyAtom = atomWithStorage<number>(
    "game-opening-book-max-ply",
    40,
    createPreferenceStorage(40),
);

function tabValue<T extends object | string | boolean | number | bigint | null | undefined>(
    family: AtomFamily<string, PrimitiveAtom<T>>,
) {
    return atom(
        (get) => {
            const tab = get(currentTabAtom);
            if (!tab) throw new Error("No tab selected");
            const atom = family(tab.value);
            return get(atom);
        },
        (get, set, newValue: T | ((currentValue: T) => T)) => {
            const tab = get(currentTabAtom);
            if (!tab) throw new Error("No tab selected");
            const nextValue =
                typeof newValue === "function" ? newValue(get(tabValue(family))) : newValue;
            const atom = family(tab.value);
            set(atom, nextValue);
        },
    );
}

// Puzzles
export const hidePuzzleRatingAtom = atomWithStorage<boolean>(
    "hide-puzzle-rating",
    false,
    createPreferenceStorage(false),
);
export const progressivePuzzlesAtom = atomWithStorage<boolean>(
    "progressive-puzzles",
    false,
    createPreferenceStorage(false),
);
export const jumpToNextPuzzleAtom = atomWithStorage<boolean>(
    "puzzle-jump-immediately",
    true,
    createPreferenceStorage(true),
);
export const trackPuzzleTimeAtom = atomWithStorage<boolean>(
    "track-puzzle-time",
    true,
    createPreferenceStorage(true),
);
export const puzzleRatingRangeAtom = atomWithStorage<[number, number]>(
    "puzzle-ratings",
    [1000, 1500],
    createPreferenceStorage([1000, 1500]),
);

export const puzzleThemeAtom = atomWithStorage<string | null>(
    "puzzle-theme",
    null,
    createZodStorage(z.string().nullable(), localStorage),
);

export const coverageMinGamesAtom = atomWithStorage<number>(
    "coverage-min-games",
    50,
    createPreferenceStorage(50),
);

export const puzzleTimerFamily = atomFamily((_tab: string) => atom<number | null>(null));
export const currentPuzzleTimerAtom = tabValue(puzzleTimerFamily);

// CP / WDL

export const reportTypeAtom = atom<"CP" | "WDL">("CP");

export const scoreTypeFamily = atomFamily((_engine: string) => atom<"cp" | "wdl">("cp"));

// Per tab settings

const threatFamily = atomFamily((_tab: string) => atom(false));
export const currentThreatAtom = tabValue(threatFamily);

const evalOpenFamily = atomFamily((_tab: string) => atom(true));
export const currentEvalOpenAtom = tabValue(evalOpenFamily);

const evalBarDisplayFamily = atomFamily((_tab: string) => atom<"cp" | "wdl">("cp"));
export const currentEvalBarDisplayAtom = tabValue(evalBarDisplayFamily);

const invisibleFamily = atomFamily((_tab: string) => atom(false));
export const currentInvisibleAtom = tabValue(invisibleFamily);

const showCommentsFamily = atomFamily((_tab: string) => atom(true));
export const currentShowCommentsAtom = tabValue(showCommentsFamily);

const showVariationsFamily = atomFamily((_tab: string) => atom(true));
export const currentShowVariationsAtom = tabValue(showVariationsFamily);

export const tabFamily = atomFamily((_tab: string) => atom("info"));
export const currentTabSelectedAtom = tabValue(tabFamily);

const reportModalOpenFamily = atomFamily((_tab: string) => atom(false));
export const currentReportModalOpenAtom = tabValue(reportModalOpenFamily);

const localOptionsFamily = atomFamily((_tab: string) =>
    atom<LocalOptions>({
        path: null,
        type: "exact",
        fen: "",
        player: null,
        color: "white",
        result: "any",
    }),
);
export const currentLocalOptionsAtom = tabValue(localOptionsFamily);

export const lichessOptionsAtom = atomWithStorage<LichessGamesOptions>(
    "lichess-all-options",
    {
        ratings: [1000, 1200, 1400, 1600, 1800, 2000, 2200, 2500],
        speeds: ["bullet", "blitz", "rapid", "classical", "correspondence"],
        color: "white",
    },
    createZodStorage(lichessGamesOptionsSchema, localStorage),
    {
        getOnInit: true,
    },
);

export const masterOptionsAtom = atomWithStorage<MasterGamesOptions>(
    "lichess-master-options",
    {},
    createZodStorage(masterOptionsSchema, localStorage),
    {
        getOnInit: true,
    },
);

const dbTypeFamily = atomFamily((_tab: string) =>
    atom<"local" | "lch_all" | "lch_master">("local"),
);
export const currentDbTypeAtom = tabValue(dbTypeFamily);

const dbTabFamily = atomFamily((_tab: string) => atom("stats"));
export const currentDbTabAtom = tabValue(dbTabFamily);

const analysisTabFamily = atomFamily((_tab: string) => atom("engines"));
export const currentAnalysisTabAtom = tabValue(analysisTabFamily);

const practiceTabFamily = atomFamily((_tab: string) => atom("train"));
export const currentPracticeTabAtom = tabValue(practiceTabFamily);

const expandedEnginesFamily = atomFamily((_tab: string) => atom<string[] | undefined>(undefined));
export const currentExpandedEnginesAtom = tabValue(expandedEnginesFamily);

export const currentDetachedEngineAtom = atomWithStorage<string | null>(
    "detached-engine",
    null,
    createZodStorage(z.string().nullable(), localStorage),
);

const pgnOptionsFamily = atomFamily((_tab: string) =>
    atom({
        comments: true,
        glyphs: true,
        variations: true,
        extraMarkups: true,
    }),
);
export const currentPgnOptionsAtom = tabValue(pgnOptionsFamily);

const currentPuzzleFamily = atomFamily((_tab: string) => atom(0));
export const currentPuzzleAtom = tabValue(currentPuzzleFamily);

// Game

type GameState = "settingUp" | "playing" | "gameOver";
const gameStateFamily = atomFamily((_tab: string) => atom<GameState>("settingUp"));
export const currentGameStateAtom = tabValue(gameStateFamily);

const playersFamily = atomFamily((_tab: string) =>
    atom<{
        white: OpponentSettings;
        black: OpponentSettings;
    }>({ white: {} as OpponentSettings, black: {} as OpponentSettings }),
);
export const currentPlayersAtom = tabValue(playersFamily);

export const gameIdFamily = atomFamily((_tab: string) => atom<string | null>(null));
export const currentGameIdAtom = tabValue(gameIdFamily);
export const gameSessionFamily = atomFamily((_tab: string) => atom<bigint | null>(null));
export const currentGameSessionAtom = tabValue(gameSessionFamily);

// Practice

const reviewLogSchema = z
    .object({
        fen: z.string(),
    })
    .passthrough();

const practiceDataSchema = z.object({
    positions: positionSchema.array(),
    logs: reviewLogSchema.array(),
});

export type PracticeData = {
    positions: Position[];
    logs: (ReviewLog & { fen: string })[];
};

export const deckAtomFamily = atomFamily(
    ({ file, game }: { file: string; game: number }) =>
        atomWithStorage<PracticeData>(
            `deck-${file}-${game}`,
            {
                positions: [],
                logs: [],
            },
            createZodStorage(practiceDataSchema, localStorage) as any as SyncStorage<PracticeData>, // TODO: fix types
        ),

    (a, b) => a.file === b.file && a.game === b.game,
);

export type PracticePhase =
    | "idle" // Not practicing
    | "waiting" // Waiting for user to make a move
    | "correct" // Move was correct, waiting for quality rating
    | "incorrect"; // Move was incorrect, showing feedback

export type PracticeState = {
    phase: PracticePhase;
    currentFen?: string;
    answer?: string;
    playedMove?: string;
    timeTaken?: number;
    positionIndex?: number;
};

export const practiceStateFamily = atomFamily((_tab: string) =>
    atom<PracticeState>({ phase: "idle" }),
);
export const practiceStateAtom = tabValue(practiceStateFamily);

/** Runtime-only bridge between the practice controller and the board. */
export type PracticeMoveController = {
    canMove: boolean;
    submitMove: (san: string) => void;
};

const practiceMoveControllerFamily = atomFamily((_tab: string) =>
    atom<PracticeMoveController | null>(null),
);
export const practiceMoveControllerAtom = tabValue(practiceMoveControllerFamily);

export type PracticeSessionStats = {
    mode: "anki" | "full";
    remainingPositions: number[];
    correct: number;
    incorrect: number;
    streak: number;
    bestStreak: number;
};

const practiceSessionStatsFamily = atomFamily((_tab: string) =>
    atom<PracticeSessionStats>({
        mode: "anki",
        remainingPositions: [],
        correct: 0,
        incorrect: 0,
        streak: 0,
        bestStreak: 0,
    }),
);
export const practiceSessionStatsAtom = tabValue(practiceSessionStatsFamily);

/** Completed runs remain visible without keeping an inactive session alive. */
const practiceCompletedSummaryFamily = atomFamily((_tab: string) =>
    atom<PracticeSessionStats | null>(null),
);
export const practiceCompletedSummaryAtom = tabValue(practiceCompletedSummaryFamily);

export const practiceAutoDifficultyAtom = atomWithStorage<"none" | "1" | "2" | "3" | "4">(
    "practice-auto-difficulty",
    "none",
    createZodStorage(z.enum(["none", "1", "2", "3", "4"]), localStorage),
);

const practiceCardStartTimeFamily = atomFamily((_tab: string) => atom<number>(0));
export const practiceCardStartTimeAtom = tabValue(practiceCardStartTimeFamily);

export const engineMovesFamily = atomFamily(
    ({ tab: _tab, engine: _engine }: { tab: string; engine: string }) =>
        atom<Map<string, BestMoves[]>>(new Map()),
    (a, b) => a.tab === b.tab && a.engine === b.engine,
);

export const engineProgressFamily = atomFamily(
    ({ tab: _tab, engine: _engine }: { tab: string; engine: string }) => atom<number>(0),
    (a, b) => a.tab === b.tab && a.engine === b.engine,
);

// returns the best moves of each engine for the current position
export const bestMovesFamily = atomFamily(
    ({ fen, gameMoves }: { fen: string; gameMoves: string[] }) =>
        atom<Map<number, { pv: string[]; winChance: number }[]>>((get) => {
            const tab = get(activeTabAtom);
            if (!tab) return new Map();
            const engines = get(enginesAtom);
            if (!engines) return new Map();
            const bestMoves = new Map<number, { pv: string[]; winChance: number }[]>();
            let n = 0;
            for (const engine of engines.filter((e) => e.loaded)) {
                const engineMoves = get(engineMovesFamily({ tab, engine: engine.id }));
                const [pos] = positionFromFen(fen);
                let finalFen = INITIAL_FEN;
                if (pos) {
                    for (const move of gameMoves) {
                        const m = parseUci(move);
                        pos.play(m!);
                    }
                    finalFen = makeFen(pos.toSetup());
                }
                const moves =
                    engineMoves.get(`${swapMove(finalFen)}:`) ||
                    engineMoves.get(`${fen}:${gameMoves.join(",")}`);
                if (moves && moves.length > 0) {
                    const bestWinChange = getWinChance(
                        normalizeScore(moves[0].score.value, pos?.turn || "white"),
                    );
                    bestMoves.set(
                        n,
                        moves.reduce<{ pv: string[]; winChance: number }[]>((acc, m) => {
                            const winChance = getWinChance(
                                normalizeScore(m.score.value, pos?.turn || "white"),
                            );
                            if (bestWinChange - winChance < 10) {
                                acc.push({ pv: m.uciMoves, winChance });
                            }
                            return acc;
                        }, []),
                    );
                }
                n++;
            }
            return bestMoves;
        }),
    (a, b) => a.fen === b.fen && equal(a.gameMoves, b.gameMoves),
);

export const firstEngineWithLinesFamily = atomFamily(
    ({ fen, gameMoves }: { fen: string; gameMoves: string[] }) =>
        atom<string | null>((get) => {
            const tab = get(activeTabAtom);
            if (!tab) return null;
            const engines = get(enginesAtom);
            if (!engines) return null;

            const [pos] = positionFromFen(fen);
            let finalFen = INITIAL_FEN;
            if (pos) {
                for (const move of gameMoves) {
                    const m = parseUci(move);
                    if (m) pos.play(m);
                }
                finalFen = makeFen(pos.toSetup());
            }

            for (const engine of engines.filter((e) => e.loaded)) {
                const engineMoves = get(engineMovesFamily({ tab, engine: engine.id }));
                const moves =
                    engineMoves.get(`${swapMove(finalFen)}:`) ||
                    engineMoves.get(`${fen}:${gameMoves.join(",")}`);

                if (moves && moves.length > 0) {
                    return engine.id;
                }
            }
            return null;
        }),
    (a, b) => a.fen === b.fen && equal(a.gameMoves, b.gameMoves),
);

export const tabEngineSettingsFamily = atomFamily(
    ({
        tab: _tab,
        engineId: _engineId,
        defaultSettings,
        defaultGo,
    }: {
        tab: string;
        engineId: string;
        defaultSettings?: EngineSettings;
        defaultGo?: GoMode;
    }) => {
        return atom<{
            enabled: boolean;
            settings: EngineSettings;
            go: GoMode;
            synced: boolean;
        }>({
            enabled: false,
            settings: defaultSettings || [],
            go: defaultGo || { t: "Infinite" },
            synced: true,
        });
    },
    (a, b) => a.tab === b.tab && a.engineId === b.engineId,
);

export const allEnabledAtom = atom((get) => {
    const engines = get(enginesAtom);
    if (!engines) return false;

    const v = engines
        .filter((e) => e.loaded)
        .every((engine) => {
            const atom = tabEngineSettingsFamily({
                tab: get(activeTabAtom)!,
                engineId: engine.id,
                defaultSettings: engine.type === "local" ? engine.settings || [] : undefined,
                defaultGo: engine.go ?? undefined,
            });
            return get(atom).enabled;
        });

    return v;
});

export const enableAllAtom = atom(null, (get, set, value: boolean) => {
    const engines = get(enginesAtom);
    if (!engines) return;

    for (const engine of engines.filter((e) => e.loaded)) {
        const atom = tabEngineSettingsFamily({
            tab: get(activeTabAtom)!,
            engineId: engine.id,
            defaultSettings: engine.type === "local" ? engine.settings || [] : undefined,
            defaultGo: engine.go ?? undefined,
        });
        set(atom, { ...get(atom), enabled: value });
    }
});

/** Remove every runtime atom whose identity is a closed tab, including per-engine entries. */
export function disposeTabAtoms(tabId: string) {
    for (const family of [
        puzzleTimerFamily,
        threatFamily,
        evalOpenFamily,
        evalBarDisplayFamily,
        invisibleFamily,
        showCommentsFamily,
        showVariationsFamily,
        tabFamily,
        reportModalOpenFamily,
        localOptionsFamily,
        dbTypeFamily,
        dbTabFamily,
        analysisTabFamily,
        practiceTabFamily,
        expandedEnginesFamily,
        pgnOptionsFamily,
        currentPuzzleFamily,
        gameStateFamily,
        playersFamily,
        gameIdFamily,
        gameSessionFamily,
        practiceStateFamily,
        practiceMoveControllerFamily,
        practiceSessionStatsFamily,
        practiceCompletedSummaryFamily,
        practiceCardStartTimeFamily,
    ]) {
        family.remove(tabId);
    }

    for (const family of [engineMovesFamily, engineProgressFamily]) {
        for (const param of Array.from(family.getParams())) {
            if (param.tab === tabId) family.remove(param);
        }
    }
    for (const param of Array.from(tabEngineSettingsFamily.getParams())) {
        if (param.tab === tabId) tabEngineSettingsFamily.remove(param);
    }
}
