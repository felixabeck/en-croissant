import { type Draft, produce } from "immer";
import { z } from "zod";
import { createStore, useStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { GameQuery, PlayerQuery, TournamentQuery } from "@/bindings";
import type { SuccessDatabaseInfo } from "@/utils/db";
import { databaseHandleSchema } from "@/utils/pathCapabilities";

// Hydrated selections supply identity only. DatabaseView gets display metadata from the
// fresh listing before rendering its children, so retain the stored metadata unchanged.
const persistedDatabaseSchema = z
    .object({
        type: z.literal("success"),
        file: databaseHandleSchema,
    })
    .passthrough();

export interface DatabaseViewStore {
    database?: SuccessDatabaseInfo;
    activeTab: "games" | "players" | "tournaments";
    games: {
        isFilterExpanded: boolean;
        query: GameQuery;
        selectedGame?: number;
    };
    players: {
        query: PlayerQuery;
        selectedPlayer?: number;
        activeTab: "overview" | "openings";
    };
    tournaments: {
        query: TournamentQuery;
        selectedTournament?: number;
        activeTab: "games" | "leaderboard";
    };

    setDatabase: (database: SuccessDatabaseInfo) => void;
    clearDatabase: () => void;
    setActiveTab: (mode: DatabaseViewStore["activeTab"]) => void;

    setGamesQuery: (filter: GameQuery) => void;
    setGamesSelectedGame: (game?: number) => void;
    toggleGamesOpenedSettings: () => void;

    setPlayersQuery: (filter: PlayerQuery) => void;
    setPlayersSelectedPlayer: (player?: number) => void;
    setPlayersActiveTab: (value: DatabaseViewStore["players"]["activeTab"]) => void;

    setTournamentsQuery: (query: TournamentQuery) => void;
    setTournamentsSelectedTournament: (tournament?: number) => void;
    setTournamentsActiveTab: (value: DatabaseViewStore["tournaments"]["activeTab"]) => void;
}

const defaultGamesState: DatabaseViewStore["games"] = {
    isFilterExpanded: false,
    selectedGame: undefined,
    query: {
        player1: undefined,
        range1: [0, 3000],
        player2: undefined,
        range2: [0, 3000],
        sides: "WhiteBlack",
        outcome: undefined,
        options: {
            sort: "date",
            direction: "desc",
            pageSize: 25,
            page: 1,
            skipCount: false,
        },
    },
};

const defaultPlayersState: DatabaseViewStore["players"] = {
    activeTab: "overview",
    query: {
        name: undefined,
        range: undefined,
        options: {
            page: 1,
            pageSize: 25,
            sort: "name",
            direction: "desc",
            skipCount: false,
        },
    },
};

const defaultTournamentState: DatabaseViewStore["tournaments"] = {
    activeTab: "games",
    query: {
        name: "",
        options: {
            page: 1,
            pageSize: 25,
            sort: "name",
            direction: "desc",
            skipCount: false,
        },
    },
};

export const activeDatabaseViewStore = createStore<DatabaseViewStore>()(
    persist(
        (set) => ({
            activeTab: "games",
            games: defaultGamesState,
            players: defaultPlayersState,
            tournaments: defaultTournamentState,

            setDatabase: (database: SuccessDatabaseInfo) => {
                set(
                    produce((state: Draft<DatabaseViewStore>) => {
                        state.database = database;
                        state.games = defaultGamesState;
                        state.players = defaultPlayersState;
                        state.tournaments = defaultTournamentState;
                    }),
                );
            },
            clearDatabase: () => {
                set(
                    produce((state: Draft<DatabaseViewStore>) => {
                        state.database = undefined;
                        state.games = defaultGamesState;
                        state.players = defaultPlayersState;
                        state.tournaments = defaultTournamentState;
                        state.activeTab = "games";
                    }),
                );
            },

            setActiveTab: (mode: DatabaseViewStore["activeTab"]) => {
                set(
                    produce((state: Draft<DatabaseViewStore>) => {
                        state.activeTab = mode;
                    }),
                );
            },
            setGamesQuery: (query) => {
                set(
                    produce((state: Draft<DatabaseViewStore>) => {
                        state.games.query = query;
                        // A filter/sort change can make the old row either absent or refer to
                        // a different page. Selection belongs to the result set, never to a
                        // bare game ID surviving an unrelated query.
                        state.games.selectedGame = undefined;
                    }),
                );
            },
            setGamesSelectedGame: (game) => {
                set(
                    produce((state: Draft<DatabaseViewStore>) => {
                        state.games.selectedGame = game;
                    }),
                );
            },
            toggleGamesOpenedSettings: () => {
                set(
                    produce((state: Draft<DatabaseViewStore>) => {
                        state.games.isFilterExpanded = !state.games.isFilterExpanded;
                    }),
                );
            },

            setPlayersQuery: (query: PlayerQuery) => {
                set(
                    produce((state: Draft<DatabaseViewStore>) => {
                        state.players.query = query;
                        state.players.selectedPlayer = undefined;
                    }),
                );
            },
            setPlayersActiveTab: (value: DatabaseViewStore["players"]["activeTab"]) => {
                set(
                    produce((state: Draft<DatabaseViewStore>) => {
                        state.players.activeTab = value;
                    }),
                );
            },
            setPlayersSelectedPlayer: (player?: number) => {
                set(
                    produce((state: Draft<DatabaseViewStore>) => {
                        state.players.selectedPlayer = player;
                    }),
                );
            },

            setTournamentsQuery: (query: TournamentQuery) => {
                set(
                    produce((state: Draft<DatabaseViewStore>) => {
                        state.tournaments.query = query;
                        state.tournaments.selectedTournament = undefined;
                    }),
                );
            },
            setTournamentsSelectedTournament: (tournament?: number) => {
                set(
                    produce((state: Draft<DatabaseViewStore>) => {
                        state.tournaments.selectedTournament = tournament;
                    }),
                );
            },
            setTournamentsActiveTab: (value: DatabaseViewStore["tournaments"]["activeTab"]) => {
                set(
                    produce((state: Draft<DatabaseViewStore>) => {
                        state.tournaments.activeTab = value;
                    }),
                );
            },
        }),
        {
            name: "database-view",
            storage: createJSONStorage(() => sessionStorage),
            merge: (persistedState, currentState) => {
                const stored =
                    persistedState && typeof persistedState === "object"
                        ? (persistedState as Partial<DatabaseViewStore>)
                        : {};
                const parsed = persistedDatabaseSchema.safeParse(stored.database);
                return {
                    ...currentState,
                    database: parsed.success ? (parsed.data as SuccessDatabaseInfo) : undefined,
                    activeTab: stored.activeTab ?? currentState.activeTab,
                    games: stored.games ?? currentState.games,
                    players: stored.players ?? currentState.players,
                    tournaments: stored.tournaments ?? currentState.tournaments,
                };
            },
        },
    ),
);

export function useActiveDatabaseViewStore(): DatabaseViewStore;
export function useActiveDatabaseViewStore<T>(selector: (state: DatabaseViewStore) => T): T;
export function useActiveDatabaseViewStore<T>(selector?: (state: DatabaseViewStore) => T) {
    return useStore(activeDatabaseViewStore, selector!);
}
