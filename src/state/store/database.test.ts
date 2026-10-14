import { afterEach, describe, expect, it, vi } from "vitest";
import { databaseRouteTarget, resolveDatabaseRoute } from "@/components/databases/databaseRoute";
import { activeDatabaseViewStore, type DatabaseViewStore } from "./database";

afterEach(() => {
    activeDatabaseViewStore.getState().clearDatabase();
    sessionStorage.clear();
});

const selectedDatabase = {
    type: "success",
    file: { id: { id: "selected" }, kind: "database" },
    title: "Selected database",
    filename: "selected.db3",
    description: "Stored metadata",
    player_count: 1,
    event_count: 2,
    game_count: 3,
    storage_size: 0,
    indexed: true,
};

async function hydrate(state?: unknown) {
    sessionStorage.clear();
    if (state !== undefined) {
        // database-view deliberately retains its existing plain JSON persistence format.
        sessionStorage.setItem("database-view", JSON.stringify({ state, version: 0 }));
    }
    vi.resetModules();
    return (await import("./database")).activeDatabaseViewStore;
}

describe("database-view sessionStorage hydration", () => {
    it.each([
        null,
        {},
        { file: {} },
        { ...selectedDatabase, type: "error" },
        { ...selectedDatabase, file: "legacy.db3" },
        { ...selectedDatabase, file: { id: "legacy", kind: "database" } },
        { ...selectedDatabase, file: { id: {}, kind: "database" } },
        { ...selectedDatabase, file: { id: { id: "" }, kind: "database" } },
        { ...selectedDatabase, file: { id: { id: 7 }, kind: "database" } },
        { ...selectedDatabase, file: { id: { id: "selected" }, kind: "fileWorkspace" } },
    ])("drops the malformed selection %j at hydration", async (database) => {
        const store = await hydrate({ database, setDatabase: "persisted action" });
        expect(store.persist.hasHydrated()).toBe(true);
        expect(store.getState().database).toBeUndefined();
        expect(databaseRouteTarget(store.getState().database)).toEqual({ to: "/library" });
        expect(() => resolveDatabaseRoute([], "selected", store.getState().database)).not.toThrow();
        store.getState().setGamesSelectedGame(42);
        store.getState().clearDatabase();
        expect(store.getState().games.selectedGame).toBeUndefined();
    });

    it.each([undefined, null, {}, { database: { file: "old.db3" } }])(
        "preserves live defaults and actions for absent or older state %j",
        async (state) => {
            const store = await hydrate(state);
            expect(store.getState()).toMatchObject({
                activeTab: "games",
                games: { isFilterExpanded: false, query: { options: { page: 1 } } },
                players: { activeTab: "overview" },
                tournaments: { activeTab: "games" },
            });
            expect(store.getState().database).toBeUndefined();
            const actions = Object.entries(store.getInitialState()).filter(
                ([, value]) => typeof value === "function",
            );
            for (const [key, action] of actions) {
                expect(store.getState()[key as keyof DatabaseViewStore]).toBe(action);
            }
        },
    );

    it("preserves a valid selection, result selections and live actions", async () => {
        const initial = activeDatabaseViewStore.getInitialState();
        const store = await hydrate({
            database: selectedDatabase,
            activeTab: "players",
            games: { ...initial.games, selectedGame: 42 },
            players: { ...initial.players, selectedPlayer: 7 },
            tournaments: { ...initial.tournaments, selectedTournament: 9 },
            clearDatabase: null,
            setGamesQuery: "stored action",
        });
        expect(store.getState().database).toEqual(selectedDatabase);
        expect(store.getState()).toMatchObject({
            activeTab: "players",
            games: { selectedGame: 42 },
            players: { selectedPlayer: 7 },
            tournaments: { selectedTournament: 9 },
        });
        expect(databaseRouteTarget(store.getState().database)).toEqual({
            to: "/databases/$databaseId",
            params: { databaseId: "selected" },
        });
        store.getState().setGamesQuery(initial.games.query);
        expect(store.getState().games.selectedGame).toBeUndefined();
        store.getState().clearDatabase();
        expect(store.getState().database).toBeUndefined();
    });
});

describe("database result-set state", () => {
    it("clears a games selection when the query is replaced", () => {
        activeDatabaseViewStore.getState().setGamesSelectedGame(42);
        activeDatabaseViewStore.getState().setGamesQuery({
            ...activeDatabaseViewStore.getState().games.query,
            player1: 7,
        });
        expect(activeDatabaseViewStore.getState().games.selectedGame).toBeUndefined();
    });

    it("clears player and tournament selections with their result set", () => {
        activeDatabaseViewStore.getState().setPlayersSelectedPlayer(12);
        activeDatabaseViewStore.getState().setTournamentsSelectedTournament(5);
        activeDatabaseViewStore.getState().setPlayersQuery({
            ...activeDatabaseViewStore.getState().players.query,
            name: "Carlsen",
        });
        activeDatabaseViewStore.getState().setTournamentsQuery({
            ...activeDatabaseViewStore.getState().tournaments.query,
            name: "Candidates",
        });
        expect(activeDatabaseViewStore.getState().players.selectedPlayer).toBeUndefined();
        expect(activeDatabaseViewStore.getState().tournaments.selectedTournament).toBeUndefined();
    });
});
