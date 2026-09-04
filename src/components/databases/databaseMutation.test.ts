import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DatabaseHandle } from "@/bindings";
import { TauriCommandError } from "@/platform/tauri";
import {
    deleteDatabaseAndInvalidate,
    invalidateDeletedDatabase,
    runAddGamesToDatabase,
    runPgnExport,
    type DatabaseRemovalState,
} from "./databaseMutation";

const notify = vi.hoisted(() => vi.fn());
vi.mock("@mantine/notifications", () => ({ notifications: { show: notify } }));

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

    it.each([
        {
            path: "structured backend-error",
            error: new TauriCommandError({
                tag: "backend-error",
                category: "partial-removal",
                message: "Partially removed: 1 entries were deleted before failing: conflict",
            }),
        },
        {
            path: "string fallback",
            // Fallback-path coverage: classify() still matches this owned Display literal.
            error: new Error("Partially removed: 1 entries were deleted before failing: conflict"),
        },
    ])(
        "invalidates after partial removal and preserves the rejection via the $path",
        async ({ error }) => {
            const deleted = database("delete-me");
            const invalidate = vi.fn();

            await expect(
                deleteDatabaseAndInvalidate(deleted, vi.fn().mockRejectedValue(error), invalidate),
            ).rejects.toBe(error);
            expect(invalidate).toHaveBeenCalledWith(deleted);
        },
    );

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

describe("PGN export picker", () => {
    const file = database("export-me");
    const destination = { handle: { id: { id: "pgn-out" }, kind: "fileWorkspace" as const } };

    beforeEach(() => {
        notify.mockClear();
    });

    it("exports to the issued destination and always clears loading", async () => {
        const setLoading = vi.fn();
        const exportToPgn = vi.fn().mockResolvedValue(undefined);
        await runPgnExport({
            issueDestination: async () => destination,
            exportToPgn,
            file,
            notifyTitle: "Common.Error",
            setLoading,
        });
        expect(exportToPgn).toHaveBeenCalledWith(file, destination.handle);
        expect(setLoading.mock.calls.map((call) => call[0])).toEqual([true, false]);
        expect(notify).not.toHaveBeenCalled();
    });

    it("stays silent on Cancellation and re-enables the button", async () => {
        const setLoading = vi.fn();
        const exportToPgn = vi.fn();
        await runPgnExport({
            issueDestination: async () => {
                throw new Error("Cancellation");
            },
            exportToPgn,
            file,
            notifyTitle: "Common.Error",
            setLoading,
        });
        expect(exportToPgn).not.toHaveBeenCalled();
        expect(notify).not.toHaveBeenCalled();
        expect(setLoading.mock.calls.map((call) => call[0])).toEqual([true, false]);
    });

    it("notifies a real picker failure and re-enables the button", async () => {
        const setLoading = vi.fn();
        await runPgnExport({
            issueDestination: async () => {
                throw new Error("permission denied");
            },
            exportToPgn: vi.fn(),
            file,
            notifyTitle: "Common.Error",
            setLoading,
        });
        expect(notify).toHaveBeenCalledWith({
            color: "red",
            title: "Common.Error",
            message: "permission denied",
        });
        expect(setLoading.mock.calls.map((call) => call[0])).toEqual([true, false]);
    });
});

describe("Add Games picker", () => {
    const dest = database("add-games");
    const handle = { id: { id: "pgn-in" }, kind: "fileWorkspace" as const };
    const selected = { handle, name: "games.pgn" };

    beforeEach(() => {
        notify.mockClear();
    });

    it("converts the picked file and always finishes", async () => {
        const order: string[] = [];
        const convertPgn = vi.fn().mockResolvedValue(undefined);
        await runAddGamesToDatabase({
            pickPgnFile: async () => selected,
            convertPgn,
            dest,
            notifyTitle: "Common.Error",
            begin: (sourceFileName) => {
                order.push(`begin:${sourceFileName}`);
            },
            finish: () => {
                order.push("finish");
            },
        });
        expect(convertPgn).toHaveBeenCalledWith([handle], dest);
        expect(order).toEqual(["begin:games.pgn", "finish"]);
        expect(notify).not.toHaveBeenCalled();
    });

    it("stays silent on a cancelled pick", async () => {
        const begin = vi.fn();
        const finish = vi.fn();
        const convertPgn = vi.fn();
        await runAddGamesToDatabase({
            pickPgnFile: async () => null,
            convertPgn,
            dest,
            notifyTitle: "Common.Error",
            begin,
            finish,
        });
        expect(convertPgn).not.toHaveBeenCalled();
        expect(begin).not.toHaveBeenCalled();
        expect(finish).not.toHaveBeenCalled();
        expect(notify).not.toHaveBeenCalled();
    });

    it("notifies a real picker failure", async () => {
        const begin = vi.fn();
        const finish = vi.fn();
        const convertPgn = vi.fn();
        await runAddGamesToDatabase({
            pickPgnFile: async () => {
                throw new Error("permission denied");
            },
            convertPgn,
            dest,
            notifyTitle: "Common.Error",
            begin,
            finish,
        });
        expect(notify).toHaveBeenCalledWith({
            color: "red",
            title: "Common.Error",
            message: "permission denied",
        });
        expect(convertPgn).not.toHaveBeenCalled();
        expect(begin).not.toHaveBeenCalled();
        expect(finish).not.toHaveBeenCalled();
    });

    it("notifies convert failure and still finishes", async () => {
        const order: string[] = [];
        await runAddGamesToDatabase({
            pickPgnFile: async () => selected,
            convertPgn: vi.fn().mockRejectedValue(new Error("convert failed")),
            dest,
            notifyTitle: "Common.Error",
            begin: (sourceFileName) => {
                order.push(`begin:${sourceFileName}`);
            },
            finish: () => {
                order.push("finish");
            },
        });
        expect(order).toEqual(["begin:games.pgn", "finish"]);
        expect(notify).toHaveBeenCalledWith({
            color: "red",
            title: "Common.Error",
            message: "convert failed",
        });
    });
});
