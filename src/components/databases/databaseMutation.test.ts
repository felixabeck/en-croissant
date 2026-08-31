import { describe, expect, it, vi } from "vitest";
import type { DatabaseHandle } from "@/bindings";
import {
    deleteDatabaseAndInvalidate,
    invalidateDeletedDatabase,
    type DatabaseRemovalState,
} from "./databaseMutation";

const database = (id: string): DatabaseHandle => ({ id: { id }, kind: "database" });

describe("database deletion transaction", () => {
    it("keeps every renderer target intact when native deletion rejects", async () => {
        const deleted = database("delete-me");
        const invalidate = vi.fn();

        await expect(
            deleteDatabaseAndInvalidate(
                deleted,
                vi.fn().mockRejectedValue(new Error("native failed")),
                invalidate,
            ),
        ).rejects.toThrow("native failed");

        expect(invalidate).not.toHaveBeenCalled();
    });

    it("invalidates only after native deletion succeeds", async () => {
        const deleted = database("delete-me");
        const order: string[] = [];
        await deleteDatabaseAndInvalidate(
            deleted,
            async () => {
                order.push("native");
            },
            () => order.push("invalidate"),
        );
        expect(order).toEqual(["native", "invalidate"]);
    });

    it("invalidates after partial removal and preserves the rejection", async () => {
        const deleted = database("delete-me");
        const invalidate = vi.fn();
        const error = new Error(
            "Partially removed: 1 entries were deleted before failing: conflict",
        );

        await expect(
            deleteDatabaseAndInvalidate(deleted, vi.fn().mockRejectedValue(error), invalidate),
        ).rejects.toBe(error);
        expect(invalidate).toHaveBeenCalledWith(deleted);
    });

    it("clears stale selection, reference and opened view for the deleted handle only", () => {
        const deleted = database("delete-me");
        const retained = database("keep-me");
        const state: DatabaseRemovalState = {
            selected: "delete-me",
            reference: deleted,
            active: {
                type: "success",
                file: deleted,
                filename: "delete-me.db3",
                title: "Delete me",
                description: "",
                player_count: 0,
                event_count: 0,
                game_count: 0,
                storage_size: BigInt(0),
                indexed: false,
            },
        };
        expect(invalidateDeletedDatabase(deleted, state)).toEqual({
            selected: null,
            reference: null,
            active: undefined,
        });
        expect(
            invalidateDeletedDatabase(deleted, {
                ...state,
                selected: "keep-me",
                reference: retained,
                active: { ...state.active!, file: retained },
            }),
        ).toMatchObject({ selected: "keep-me", reference: retained });
    });
});
