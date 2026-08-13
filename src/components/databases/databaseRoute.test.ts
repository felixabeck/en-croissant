import { describe, expect, it } from "vitest";
import type { DatabaseHandle } from "@/bindings";
import type { ManagedDatabaseInfo, SuccessDatabaseInfo } from "@/utils/db";
import { resolveDatabaseRoute } from "./databaseRoute";

const handle = (id: string): DatabaseHandle => ({ id: { id }, kind: "database" });
const database = (id: string, title = "Same title"): SuccessDatabaseInfo => ({
    type: "success",
    file: handle(id),
    filename: `${id}.db3`,
    title,
    description: "",
    player_count: 0,
    event_count: 0,
    game_count: 0,
    storage_size: BigInt(0),
    indexed: false,
});

describe("database route resolution", () => {
    it("never renders persisted database B for a deep-link to database A, even with the same title", () => {
        const routeDatabase = database("A");
        const persistedDatabase = database("B");
        const result = resolveDatabaseRoute(
            [routeDatabase, persistedDatabase],
            "A",
            persistedDatabase,
        );
        expect(result).toEqual({ status: "synchronizing", database: routeDatabase });
    });

    it("becomes renderable only after the active cache contains the exact route handle", () => {
        const routeDatabase = database("A");
        expect(resolveDatabaseRoute([routeDatabase], "A", routeDatabase)).toEqual({
            status: "ready",
            database: routeDatabase,
        });
    });

    it("requires a fresh synchronization when navigating back to a different opaque database", () => {
        const first = database("first", "Same title");
        const second = database("second", "Same title");
        expect(resolveDatabaseRoute([first, second], "second", first)).toMatchObject({
            status: "synchronizing",
            database: second,
        });
        expect(resolveDatabaseRoute([first, second], "first", second)).toMatchObject({
            status: "synchronizing",
            database: first,
        });
    });

    it("does not reuse a deleted route from persisted state", () => {
        const staleDatabase = database("deleted");
        const result = resolveDatabaseRoute([] as ManagedDatabaseInfo[], "deleted", staleDatabase);
        expect(result).toEqual({ status: "not_found" });
    });
});
