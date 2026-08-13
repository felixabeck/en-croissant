import { afterEach, describe, expect, it } from "vitest";
import { activeDatabaseViewStore } from "./database";

afterEach(() => activeDatabaseViewStore.getState().clearDatabase());

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
