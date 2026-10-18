import { type Draft, produce } from "immer";
import { z } from "zod";
import { createStore, useStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { GameQuery, PlayerQuery, TournamentQuery } from "@/bindings";
import { ELO_FILTER_MAX, type SuccessDatabaseInfo } from "@/utils/db";
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
        activeTab: "overview" | "ratings" | "openings";
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
        range1: [0, ELO_FILTER_MAX],
        player2: undefined,
        range2: [0, ELO_FILTER_MAX],
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

// Match Rust's i32 DTOs and pagination_limit_offset in db/mod.rs. Filter ranges
// have no backend ordering/ELO bound, and nullable pagination uses consumer defaults.
const queryIntegerSchema = z.number().int().min(-2_147_483_648).max(2_147_483_647);
const queryRangeSchema = z.tuple([queryIntegerSchema, queryIntegerSchema]).nullish();
// Matches MAX_PAGE_SIZE in src-tauri/src/db/mod.rs.
const MAX_PAGE_SIZE = 1000;

function createQueryOptionsSchema<Sort extends string>(sorts: [Sort, ...Sort[]]) {
    return z.object({
        skipCount: z.boolean(),
        page: queryIntegerSchema.min(1).nullish(),
        pageSize: queryIntegerSchema.min(1).max(MAX_PAGE_SIZE).nullish(),
        sort: z.enum(sorts),
        direction: z.enum(["asc", "desc"]),
    });
}

const activeTabSchema = z.enum(["games", "players", "tournaments"]);
// GameQuery's optional/null options and sides are an API convenience. Persisted UI
// panels need complete options for table edits and a side value for SideInput.
const persistedGamesSchema: z.ZodType<DatabaseViewStore["games"], z.ZodTypeDef, unknown> = z.object(
    {
        isFilterExpanded: z.boolean(),
        selectedGame: queryIntegerSchema
            .min(0)
            .nullish()
            .transform((value) => value ?? undefined),
        query: z.object({
            options: createQueryOptionsSchema(["id", "date", "whiteElo", "blackElo", "ply_count"]),
            player1: queryIntegerSchema.nullish(),
            player2: queryIntegerSchema.nullish(),
            tournament_id: queryIntegerSchema.nullish(),
            start_date: z.string().nullish(),
            end_date: z.string().nullish(),
            range1: queryRangeSchema,
            range2: queryRangeSchema,
            sides: z.enum(["BlackWhite", "WhiteBlack", "Any"]),
            outcome: z.string().nullish(),
            position: z.object({ fen: z.string(), type_: z.enum(["exact", "partial"]) }).nullish(),
            wanted_result: z.string().nullish(),
            exclude_fast_events: z.boolean().nullish(),
        }),
    },
);

const persistedPlayersSchema: z.ZodType<DatabaseViewStore["players"], z.ZodTypeDef, unknown> =
    z.object({
        activeTab: z.enum(["overview", "ratings", "openings"]),
        selectedPlayer: queryIntegerSchema.nullish().transform((value) => value ?? undefined),
        query: z.object({
            options: createQueryOptionsSchema(["id", "name", "elo"]),
            name: z.string().nullish(),
            range: queryRangeSchema,
        }),
    });

const persistedTournamentsSchema: z.ZodType<
    DatabaseViewStore["tournaments"],
    z.ZodTypeDef,
    unknown
> = z.object({
    activeTab: z.enum(["games", "leaderboard"]),
    selectedTournament: queryIntegerSchema.nullish().transform((value) => value ?? undefined),
    query: z.object({
        options: createQueryOptionsSchema(["id", "name"]),
        name: z.string().nullable(),
    }),
});

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
                const activeTab = activeTabSchema.safeParse(stored.activeTab);
                const games = persistedGamesSchema.safeParse(stored.games);
                const players = persistedPlayersSchema.safeParse(stored.players);
                const tournaments = persistedTournamentsSchema.safeParse(stored.tournaments);
                return {
                    ...currentState,
                    database: parsed.success ? (parsed.data as SuccessDatabaseInfo) : undefined,
                    activeTab: activeTab.success ? activeTab.data : currentState.activeTab,
                    games: games.success ? games.data : currentState.games,
                    players: players.success ? players.data : currentState.players,
                    tournaments: tournaments.success ? tournaments.data : currentState.tournaments,
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
