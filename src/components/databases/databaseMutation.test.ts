import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DatabaseHandle } from "@/bindings";
import { createStore } from "jotai";
import { databaseConversionStateAtom, runDatabaseConversion } from "@/state/atoms";
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
    let store: ReturnType<typeof createStore>;
    type RunConversion = Parameters<typeof runAddGamesToDatabase>[0]["runConversion"];
    let runConversion: ReturnType<typeof vi.fn<RunConversion>>;

    beforeEach(() => {
        notify.mockClear();
        store = createStore();
        runConversion = vi.fn<RunConversion>((sourceFileName, convert) =>
            runDatabaseConversion(
                (update) => store.set(databaseConversionStateAtom, update),
                { targetDatabase: dest, targetDatabaseTitle: "Existing", sourceFileName },
                ({ id }) => convert(id),
            ),
        );
    });

    it("converts the picked file and always finishes", async () => {
        const convertPgn = vi.fn(async (id: string) => {
            expect(id).toMatch(/^conversion:[0-9a-f-]{36}$/);
            expect(store.get(databaseConversionStateAtom)).toEqual([
                {
                    id,
                    targetDatabase: dest,
                    targetDatabaseTitle: "Existing",
                    sourceFileName: selected.name,
                    totalGames: 0,
                    elapsedSeconds: 0,
                },
            ]);
        });
        await runAddGamesToDatabase({
            pickPgnFile: async () => selected,
            convertPgn,
            dest,
            notifyTitle: "Common.Error",
            runConversion,
        });
        expect(convertPgn).toHaveBeenCalledWith(
            expect.stringMatching(/^conversion:[0-9a-f-]{36}$/),
            [handle],
            dest,
        );
        expect(runConversion).toHaveBeenCalledWith(selected.name, expect.any(Function));
        expect(store.get(databaseConversionStateAtom)).toEqual([]);
        expect(notify).not.toHaveBeenCalled();
    });

    it("stays silent on a cancelled pick", async () => {
        const convertPgn = vi.fn();
        await runAddGamesToDatabase({
            pickPgnFile: async () => null,
            convertPgn,
            dest,
            notifyTitle: "Common.Error",
            runConversion,
        });
        expect(convertPgn).not.toHaveBeenCalled();
        expect(runConversion).not.toHaveBeenCalled();
        expect(store.get(databaseConversionStateAtom)).toEqual([]);
        expect(notify).not.toHaveBeenCalled();
    });

    it("notifies a real picker failure", async () => {
        const convertPgn = vi.fn();
        await runAddGamesToDatabase({
            pickPgnFile: async () => {
                throw new Error("permission denied");
            },
            convertPgn,
            dest,
            notifyTitle: "Common.Error",
            runConversion,
        });
        expect(notify).toHaveBeenCalledWith({
            color: "red",
            title: "Common.Error",
            message: "permission denied",
        });
        expect(convertPgn).not.toHaveBeenCalled();
        expect(runConversion).not.toHaveBeenCalled();
    });

    it("notifies convert failure and still finishes", async () => {
        await runAddGamesToDatabase({
            pickPgnFile: async () => selected,
            convertPgn: vi.fn().mockRejectedValue(new Error("convert failed")),
            dest,
            notifyTitle: "Common.Error",
            runConversion,
        });
        expect(runConversion).toHaveBeenCalledOnce();
        expect(store.get(databaseConversionStateAtom)).toEqual([]);
        expect(notify).toHaveBeenCalledWith({
            color: "red",
            title: "Common.Error",
            message: "convert failed",
        });
    });

    it("a cancelled conversion removes its entry and stays silent", async () => {
        await runAddGamesToDatabase({
            pickPgnFile: async () => selected,
            convertPgn: vi.fn().mockRejectedValue(new Error("Cancellation")),
            dest,
            notifyTitle: "Common.Error",
            runConversion,
        });
        expect(runConversion).toHaveBeenCalledOnce();
        expect(store.get(databaseConversionStateAtom)).toEqual([]);
        expect(notify).not.toHaveBeenCalled();
    });

    it("removing an already absent operation preserves the registry object", async () => {
        let resolveConversion: (() => void) | undefined;
        const pending = runConversion(
            selected.name,
            () =>
                new Promise<void>((resolve) => {
                    resolveConversion = resolve;
                }),
        );
        expect(store.get(databaseConversionStateAtom)).toHaveLength(1);
        store.set(databaseConversionStateAtom, []);
        const previous = store.get(databaseConversionStateAtom);
        if (!resolveConversion) throw new Error("Conversion did not start");
        resolveConversion();
        await pending;
        expect(store.get(databaseConversionStateAtom)).toBe(previous);
    });
});
