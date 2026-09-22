import { createStore } from "jotai";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ReviewLog } from "ts-fsrs";
import type { PracticeMigrationOutcome } from "@/bindings";
import type { Position } from "@/components/files/opening";
import { createZodStorage } from "./utils";

const native = vi.hoisted(() => ({
    acknowledge: vi.fn(),
    load: vi.fn(),
    loadReviews: vi.fn(),
    migrate: vi.fn(),
    record: vi.fn(),
    repair: vi.fn(),
    reset: vi.fn(),
    sync: vi.fn(),
    list: vi.fn(),
}));
const persistError = vi.hoisted(() => ({ report: vi.fn() }));

vi.mock("@/platform/tauri", () => ({
    tauri: {
        acknowledgePracticeOrphans: native.acknowledge,
        listPracticeDecks: native.list,
        loadPracticeDeck: native.load,
        loadPracticeReviews: native.loadReviews,
        migratePracticeDeck: native.migrate,
        recordPracticeReview: native.record,
        repairPracticeDeck: native.repair,
        resetPracticeDeck: native.reset,
        syncPracticePositions: native.sync,
    },
}));
vi.mock("./persistError", () => ({ reportPersistError: persistError.report }));
vi.mock("@/i18n", () => ({
    default: {
        t: (key: string) =>
            key === "Board.Practice.QueuedWriteNotSaved" ? "practice change not saved" : key,
    },
}));

import {
    createPracticeDeckAtom,
    ensurePracticeMigration,
    practiceDataSchema,
    PRACTICE_MAX_CONFLICT_RETRIES,
    PRACTICE_SYNC_DEBOUNCE_MS,
    resetPracticeMigrationForTests,
    runPracticeMigrationPass,
    type PracticeDeckValue,
    type PracticeRatingMutation,
} from "./practiceStorage";

const firstFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const sameBoardDifferentFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 7 42";

function position(fen = firstFen, card = { due: "2026-09-22T00:00:00.000Z", reps: 0 }): Position {
    return { fen, answer: "e4", card: card as unknown as Position["card"] };
}

function snapshot(positions: Position[], overrides: Partial<PracticeDeckValue> = {}) {
    return {
        positionsDocument: JSON.stringify({ positions }),
        revision: overrides.revision ?? 4,
        generation: overrides.generation ?? 2,
        migrated: true,
        unappliedReviews: overrides.unappliedReviews ?? 0,
        orphansAcknowledged: overrides.orphansAcknowledged ?? true,
    };
}

async function waitForReady(
    store: ReturnType<typeof createStore>,
    atom: ReturnType<typeof createPracticeDeckAtom>,
) {
    await vi.waitFor(() => expect(store.get(atom).status).toBe("ready"));
}

function mountDeck(file = "file-a", game = 0) {
    const atom = createPracticeDeckAtom({ file, game });
    const store = createStore();
    const unsubscribe = store.sub(atom, () => undefined);
    return { atom, store, unsubscribe };
}

function ratingMutation(
    positions: Position[],
    sourcePosition = positions[0],
): PracticeRatingMutation {
    return {
        type: "rating",
        positions,
        entry: { fen: sourcePosition.fen, rating: 3 } as ReviewLog & { fen: string },
        entryId: "entry-fixed",
        sourcePosition,
    };
}

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, reject, resolve };
}

function legacyData() {
    return { positions: [position()], logs: [{ fen: firstFen, rating: 3 }] };
}

function migrationOutcome(
    overrides: Partial<PracticeMigrationOutcome> = {},
): PracticeMigrationOutcome {
    return {
        status: "migrated",
        entries: 1,
        positions: 1,
        positionsDigest: "positions-digest",
        entriesDigest: "entries-digest",
        ...overrides,
    };
}

beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    native.acknowledge.mockReset().mockResolvedValue(null);
    native.load.mockReset();
    native.loadReviews.mockReset();
    native.migrate.mockReset().mockResolvedValue({});
    native.record.mockReset().mockResolvedValue(5);
    native.repair.mockReset().mockResolvedValue(null);
    native.reset.mockReset().mockResolvedValue(5);
    native.sync.mockReset().mockResolvedValue(5);
    native.list.mockReset().mockResolvedValue({ decks: [], anomalies: [] });
    persistError.report.mockReset();
    resetPracticeMigrationForTests();
});

afterEach(() => {
    vi.useRealTimers();
});

describe("the real practice deck atom", () => {
    test("a deck hydration starts and waits for the startup migration pass", async () => {
        const migration = deferred<{ decks: never[]; anomalies: never[] }>();
        native.list.mockReturnValueOnce(migration.promise);
        const first = position();
        native.load.mockResolvedValue(snapshot([first]));

        const mounted = mountDeck();
        expect(mounted.store.get(mounted.atom).status).toBe("loading");
        await vi.waitFor(() => expect(native.list).toHaveBeenCalledOnce());
        expect(native.load).not.toHaveBeenCalled();

        migration.resolve({ decks: [], anomalies: [] });
        await waitForReady(mounted.store, mounted.atom);
        expect(mounted.store.get(mounted.atom).positions).toEqual([first]);
        mounted.unsubscribe();

        native.load.mockResolvedValue(snapshot([position(sameBoardDifferentFen)], { revision: 9 }));
        const reloaded = mountDeck();
        await waitForReady(reloaded.store, reloaded.atom);
        expect(native.load).toHaveBeenCalledTimes(2);
        expect(reloaded.store.get(reloaded.atom).revision).toBe(9);
        reloaded.unsubscribe();
        expect(await ensurePracticeMigration()).toEqual({
            outcomes: [],
            inventory: { decks: [], anomalies: [] },
            scanTrusted: true,
            inventoryTrusted: true,
        });
    });

    test("does not call native storage for an empty tab identity", async () => {
        const { atom, store, unsubscribe } = mountDeck("");
        expect(store.get(atom).status).toBe("ready");
        await store.set(atom, { type: "sync", positions: [position()] });
        expect(native.load).not.toHaveBeenCalled();
        expect(native.sync).not.toHaveBeenCalled();
        unsubscribe();
    });

    test("creates a missing deck through sync at revision and generation zero", async () => {
        native.load.mockResolvedValue(null);
        const { atom, store, unsubscribe } = mountDeck();
        await waitForReady(store, atom);
        vi.useFakeTimers();

        const write = store.set(atom, { type: "sync", positions: [position()] });
        await vi.advanceTimersByTimeAsync(PRACTICE_SYNC_DEBOUNCE_MS);
        await write;

        expect(native.sync).toHaveBeenCalledWith(
            "file-a",
            0,
            0,
            0,
            expect.stringContaining('"positions"'),
        );
        expect(Object.keys(JSON.parse(native.sync.mock.calls[0][4]))).toEqual(["positions"]);
        unsubscribe();
    });

    test("reports a write failure, retains the pending value, and blocks later writes", async () => {
        const initial = position();
        native.load.mockResolvedValue(snapshot([initial]));
        const { atom, store, unsubscribe } = mountDeck();
        await waitForReady(store, atom);
        native.sync.mockRejectedValueOnce({
            tag: "backend-error",
            category: "io",
            message: "disk unavailable",
        });

        const next = position(sameBoardDifferentFen);
        vi.useFakeTimers();
        const write = store.set(atom, { type: "sync", positions: [next] });
        await vi.advanceTimersByTimeAsync(PRACTICE_SYNC_DEBOUNCE_MS);
        await write;

        expect(store.get(atom).status).toBe("write-blocked");
        expect(store.get(atom).positions).toEqual([next]);
        expect(persistError.report).toHaveBeenCalledOnce();
        await store.set(atom, { type: "sync", positions: [initial] });
        await vi.advanceTimersByTimeAsync(PRACTICE_SYNC_DEBOUNCE_MS);
        expect(native.sync).toHaveBeenCalledOnce();
        unsubscribe();
    });

    test("keeps a read failure distinct from an empty deck and blocks initialization", async () => {
        native.load.mockRejectedValueOnce({
            tag: "backend-error",
            category: "io",
            message: "practice read failed",
        });
        const { atom, store, unsubscribe } = mountDeck();
        await vi.waitFor(() => expect(store.get(atom).status).toBe("read-failed"));

        expect(store.get(atom).positions).toEqual([]);
        await store.set(atom, { type: "sync", positions: [position()] });
        await vi.waitFor(() => expect(native.load).toHaveBeenCalledOnce());
        expect(native.sync).not.toHaveBeenCalled();
        expect(persistError.report).not.toHaveBeenCalled();
        unsubscribe();
    });

    test("merges a committed rating into a later debounced sync", async () => {
        const source = position();
        const syncPosition = position(sameBoardDifferentFen);
        const rated = position(sameBoardDifferentFen, {
            due: "2026-10-01T00:00:00.000Z",
            reps: 1,
        });
        native.load.mockResolvedValue(snapshot([source], { revision: 4, generation: 2 }));
        native.record.mockResolvedValueOnce(5);
        native.sync.mockResolvedValueOnce(6);
        const { atom, store, unsubscribe } = mountDeck();
        await waitForReady(store, atom);
        vi.useFakeTimers();

        const syncWrite = store.set(atom, { type: "sync", positions: [syncPosition] });
        const ratingWrite = store.set(atom, {
            ...ratingMutation([rated], source),
            entryId: "before-sync",
        });
        await ratingWrite;
        await vi.advanceTimersByTimeAsync(PRACTICE_SYNC_DEBOUNCE_MS);
        await syncWrite;

        expect(native.sync).toHaveBeenCalledOnce();
        expect(native.sync.mock.calls[0][3]).toBe(5);
        expect(JSON.parse(native.sync.mock.calls[0][4]).positions).toEqual([rated]);
        unsubscribe();
    });

    test("drops a debounced sync computed before a reset", async () => {
        const initial = position();
        const staleSync = position(sameBoardDifferentFen);
        const resetPosition = position("8/8/8/8/8/8/8/8 w - - 0 1");
        native.load.mockResolvedValue(snapshot([initial], { revision: 4, generation: 2 }));
        native.reset.mockResolvedValueOnce(6);
        const { atom, store, unsubscribe } = mountDeck();
        await waitForReady(store, atom);
        vi.useFakeTimers();

        const syncWrite = store.set(atom, { type: "sync", positions: [staleSync] });
        const resetWrite = store.set(atom, { type: "reset", positions: [resetPosition] });
        await resetWrite;
        await vi.advanceTimersByTimeAsync(PRACTICE_SYNC_DEBOUNCE_MS);
        await syncWrite;

        expect(native.reset).toHaveBeenCalledOnce();
        expect(native.sync).not.toHaveBeenCalled();
        expect(store.get(atom).generation).toBe(3);
        unsubscribe();
    });

    test("chains a rating behind an in-flight sync using the post-sync revision", async () => {
        const source = position();
        const synced = position(sameBoardDifferentFen);
        const rated = position(sameBoardDifferentFen, {
            due: "2026-10-01T00:00:00.000Z",
            reps: 1,
        });
        native.load.mockResolvedValue(snapshot([source], { revision: 4, generation: 2 }));
        const syncResult = deferred<number>();
        native.sync.mockImplementationOnce(() => syncResult.promise);
        native.record.mockResolvedValueOnce(6);
        const { atom, store, unsubscribe } = mountDeck();
        await waitForReady(store, atom);
        vi.useFakeTimers();

        const syncWrite = store.set(atom, { type: "sync", positions: [synced] });
        await vi.advanceTimersByTimeAsync(PRACTICE_SYNC_DEBOUNCE_MS);
        await vi.waitFor(() => expect(native.sync).toHaveBeenCalledOnce());
        const ratingWrite = store.set(atom, {
            ...ratingMutation([rated], synced),
            entryId: "after-sync",
        });

        syncResult.resolve(5);
        await Promise.all([syncWrite, ratingWrite]);

        expect(native.record).toHaveBeenCalledOnce();
        expect(native.record.mock.calls[0][3]).toBe(5);
        expect(native.record.mock.calls[0][4]).toBe(5);
        expect(native.record.mock.calls[0][7]).toBe("after-sync");
        unsubscribe();
    });

    test("chains back-to-back ratings in order with the returned revision", async () => {
        const source = position();
        const first = position(firstFen, { due: "2026-10-01T00:00:00.000Z", reps: 1 });
        const second = position(firstFen, { due: "2026-11-01T00:00:00.000Z", reps: 2 });
        native.load.mockResolvedValue(snapshot([source], { revision: 4, generation: 2 }));
        const firstResult = deferred<number>();
        const secondResult = deferred<number>();
        native.record
            .mockImplementationOnce(() => firstResult.promise)
            .mockImplementationOnce(() => secondResult.promise);
        const { atom, store, unsubscribe } = mountDeck();
        await waitForReady(store, atom);

        const firstWrite = store.set(atom, {
            ...ratingMutation([first], source),
            entryId: "first-rating",
        });
        const secondWrite = store.set(atom, {
            ...ratingMutation([second], first),
            entryId: "second-rating",
        });
        await vi.waitFor(() => expect(native.record).toHaveBeenCalledOnce());
        firstResult.resolve(5);
        await vi.waitFor(() => expect(native.record).toHaveBeenCalledTimes(2));
        expect(native.record.mock.calls[1][3]).toBe(5);
        expect(native.record.mock.calls[1][7]).toBe("second-rating");
        secondResult.resolve(6);
        await Promise.all([firstWrite, secondWrite]);
        unsubscribe();
    });

    test("reports and adopts a rating whose conflicted card already changed", async () => {
        const source = position();
        const rated = position(firstFen, { due: "2026-10-01T00:00:00.000Z", reps: 1 });
        const reloaded = position(firstFen, { due: "2026-10-02T00:00:00.000Z", reps: 2 });
        native.load
            .mockResolvedValueOnce(snapshot([source], { revision: 4, generation: 2 }))
            .mockResolvedValueOnce(snapshot([reloaded], { revision: 5, generation: 2 }));
        native.record.mockRejectedValueOnce({
            tag: "backend-error",
            category: "conflict",
            message: "revision conflict",
        });
        const { atom, store, unsubscribe } = mountDeck();
        await waitForReady(store, atom);

        await store.set(atom, {
            ...ratingMutation([rated], source),
            entryId: "dropped-rating",
        });

        expect(persistError.report).toHaveBeenCalledOnce();
        expect(store.get(atom).status).toBe("ready");
        expect(store.get(atom).positions).toEqual([reloaded]);

        native.record.mockResolvedValueOnce(6);
        await store.set(atom, {
            ...ratingMutation(
                [position(firstFen, { due: "2026-12-01T00:00:00.000Z", reps: 3 })],
                reloaded,
            ),
            entryId: "after-drop",
        });
        expect(native.record).toHaveBeenCalledTimes(2);
        expect(persistError.report).toHaveBeenCalledOnce();
        unsubscribe();
    });

    test("reports an already-queued rating as not saved after an earlier write fails", async () => {
        const source = position();
        const first = position(firstFen, { due: "2026-10-01T00:00:00.000Z", reps: 1 });
        const second = position(firstFen, { due: "2026-11-01T00:00:00.000Z", reps: 2 });
        native.load.mockResolvedValue(snapshot([source], { revision: 4, generation: 2 }));
        native.record.mockRejectedValueOnce({
            tag: "backend-error",
            category: "io",
            message: "write failed",
        });
        const { atom, store, unsubscribe } = mountDeck();
        await waitForReady(store, atom);

        const firstWrite = store.set(atom, {
            ...ratingMutation([first], source),
            entryId: "failed-rating",
        });
        const secondWrite = store.set(atom, {
            ...ratingMutation([second], first),
            entryId: "queued-rating",
        });
        await Promise.all([firstWrite, secondWrite]);

        expect(native.record).toHaveBeenCalledOnce();
        expect(persistError.report).toHaveBeenCalledTimes(2);
        expect(persistError.report.mock.calls[1][0].message).toContain("not saved");
        expect(store.get(atom).status).toBe("write-blocked");
        expect(store.get(atom).positions).toEqual([second]);
        unsubscribe();
    });

    test("retries a conflict by canonical board identity with the same entry and base revision", async () => {
        const source = position(firstFen);
        const changed = position(firstFen, { due: "2026-10-01T00:00:00.000Z", reps: 1 });
        native.load
            .mockResolvedValueOnce(snapshot([source], { revision: 4, generation: 2 }))
            .mockResolvedValueOnce(
                snapshot([position(sameBoardDifferentFen)], { revision: 5, generation: 2 }),
            );
        native.record.mockRejectedValueOnce({
            tag: "backend-error",
            category: "conflict",
            message: "revision conflict",
        });
        native.record.mockResolvedValueOnce(6);
        const { atom, store, unsubscribe } = mountDeck();
        await waitForReady(store, atom);

        await store.set(atom, {
            ...ratingMutation([changed], source),
            positions: [changed],
        });

        expect(native.record).toHaveBeenCalledTimes(2);
        expect(native.record.mock.calls[0][4]).toBe(4);
        expect(native.record.mock.calls[1][4]).toBe(4);
        expect(native.record.mock.calls[0][7]).toBe("entry-fixed");
        expect(native.record.mock.calls[1][7]).toBe("entry-fixed");
        expect(JSON.parse(native.record.mock.calls[1][5]).positions[0].fen).toBe(
            sameBoardDifferentFen,
        );
        expect(store.get(atom).status).toBe("ready");
        unsubscribe();
    });

    test("branches on backendCategory rather than the renderer validation category", async () => {
        const source = position();
        const changed = position(firstFen, { due: "2026-10-01T00:00:00.000Z", reps: 1 });
        native.load
            .mockResolvedValueOnce(snapshot([source]))
            .mockResolvedValueOnce(snapshot([source], { revision: 5 }));
        native.record.mockRejectedValueOnce(
            Object.assign(new Error("conflict"), {
                category: "validation",
                backendCategory: "conflict",
            }),
        );
        native.record.mockResolvedValueOnce(6);
        const { atom, store, unsubscribe } = mountDeck();
        await waitForReady(store, atom);

        await store.set(atom, { ...ratingMutation([changed], source), positions: [changed] });

        expect(native.record).toHaveBeenCalledTimes(2);
        expect(persistError.report).not.toHaveBeenCalled();
        unsubscribe();
    });

    test("stops after the maximum conflict retries and blocks the deck", async () => {
        const source = position();
        const changed = position(firstFen, { due: "2026-10-01T00:00:00.000Z", reps: 1 });
        native.load.mockResolvedValue(snapshot([source]));
        native.record.mockRejectedValue({
            tag: "backend-error",
            category: "conflict",
            message: "revision conflict",
        });
        native.load.mockResolvedValue(snapshot([source], { revision: 5 }));
        const { atom, store, unsubscribe } = mountDeck();
        await waitForReady(store, atom);

        await store.set(atom, { ...ratingMutation([changed], source), positions: [changed] });

        expect(native.record).toHaveBeenCalledTimes(PRACTICE_MAX_CONFLICT_RETRIES + 1);
        expect(native.load).toHaveBeenCalledTimes(PRACTICE_MAX_CONFLICT_RETRIES + 1);
        expect(store.get(atom).status).toBe("write-blocked");
        expect(persistError.report).toHaveBeenCalledOnce();
        unsubscribe();
    });

    test("drops a hydration result that belongs to an unmounted request", async () => {
        let releaseFirst!: (value: ReturnType<typeof snapshot>) => void;
        native.load.mockImplementationOnce(
            () => new Promise((resolve) => (releaseFirst = resolve)),
        );
        native.load.mockResolvedValueOnce(snapshot([position(sameBoardDifferentFen)]));
        const first = mountDeck();
        await vi.waitFor(() => expect(native.load).toHaveBeenCalledOnce());
        first.unsubscribe();

        const second = mountDeck();
        await waitForReady(second.store, second.atom);
        releaseFirst(snapshot([position()]));
        await Promise.resolve();
        expect(second.store.get(second.atom).positions[0]?.fen).toBe(sameBoardDifferentFen);
        second.unsubscribe();
    });
});

describe("the eager legacy migration pass", () => {
    test("isolates a failed first deck and still migrates later decks", async () => {
        localStorage.setItem("deck-first-0", JSON.stringify(legacyData()));
        localStorage.setItem("deck-later-1", JSON.stringify(legacyData()));
        native.list.mockResolvedValue({ decks: [], anomalies: [] });
        native.migrate
            .mockRejectedValueOnce(new Error("first deck failed"))
            .mockResolvedValueOnce(migrationOutcome());

        const result = await runPracticeMigrationPass();

        expect(native.migrate).toHaveBeenCalledTimes(2);
        expect(result.outcomes.map(({ status }) => status)).toEqual(["failed", "migrated"]);
        expect(persistError.report).toHaveBeenCalledOnce();
        const blocked = mountDeck("first", 0);
        await vi.waitFor(() => expect(blocked.store.get(blocked.atom).status).toBe("read-failed"));
        await blocked.store.set(blocked.atom, { type: "sync", positions: [position()] });
        expect(native.sync).not.toHaveBeenCalled();
        blocked.unsubscribe();
    });

    test("parses the real createZodStorage JSON.stringify representation", async () => {
        createZodStorage(practiceDataSchema, localStorage).setItem(
            "deck-real-0",
            legacyData() as never,
        );
        native.list.mockResolvedValue({ decks: [], anomalies: [] });
        native.migrate.mockResolvedValue(migrationOutcome());

        await runPracticeMigrationPass();

        expect(native.migrate).toHaveBeenCalledWith("real", 0, JSON.stringify(legacyData()));
    });

    test("continues past malformed keys while retaining valid keys and distrusting the family", async () => {
        localStorage.setItem("deck-before-0", JSON.stringify(legacyData()));
        localStorage.setItem("deck-malformed", JSON.stringify(legacyData()));
        localStorage.setItem("deck-held-1", JSON.stringify(legacyData()));
        native.list.mockResolvedValue({
            decks: [{ fileId: "held", game: 1 }],
            anomalies: [],
        });
        native.migrate.mockResolvedValue(migrationOutcome());

        const result = await runPracticeMigrationPass();

        expect(native.migrate).toHaveBeenCalledWith("before", 0, JSON.stringify(legacyData()));
        expect(native.migrate).toHaveBeenCalledTimes(1);
        expect(result.outcomes).toEqual([
            expect.objectContaining({ identity: { file: "before", game: 0 }, status: "migrated" }),
            expect.objectContaining({
                identity: { file: "held", game: 1 },
                status: "alreadyMigrated",
            }),
        ]);
        expect(result.scanTrusted).toBe(false);
        expect(persistError.report).toHaveBeenCalledOnce();
    });

    test("fails closed when whole-storage enumeration throws", async () => {
        const originalLength = Object.getOwnPropertyDescriptor(Storage.prototype, "length");
        Object.defineProperty(Storage.prototype, "length", {
            configurable: true,
            get: () => {
                throw new Error("enumeration denied");
            },
        });
        native.list.mockResolvedValue({ decks: [], anomalies: [] });
        try {
            const result = await runPracticeMigrationPass();
            expect(result.scanTrusted).toBe(false);
            const mounted = mountDeck("unseen", 0);
            await vi.waitFor(() =>
                expect(mounted.store.get(mounted.atom).status).toBe("read-failed"),
            );
            await mounted.store.set(mounted.atom, { type: "sync", positions: [position()] });
            expect(native.sync).not.toHaveBeenCalled();
            mounted.unsubscribe();
        } finally {
            if (originalLength) Object.defineProperty(Storage.prototype, "length", originalLength);
        }
    });

    test("treats a migrated count mismatch as a failed, write-blocked deck", async () => {
        localStorage.setItem("deck-count-0", JSON.stringify(legacyData()));
        native.list.mockResolvedValue({ decks: [], anomalies: [] });
        native.migrate.mockResolvedValue(migrationOutcome({ entries: 2 }));

        const result = await runPracticeMigrationPass();

        expect(result.outcomes[0]?.status).toBe("failed");
        const mounted = mountDeck("count", 0);
        await vi.waitFor(() => expect(mounted.store.get(mounted.atom).status).toBe("read-failed"));
        mounted.unsubscribe();
    });

    test("does not count-compare an AlreadyMigrated outcome", async () => {
        localStorage.setItem("deck-already-0", JSON.stringify(legacyData()));
        native.list.mockResolvedValue({ decks: [], anomalies: [] });
        native.migrate.mockResolvedValue(
            migrationOutcome({ status: "alreadyMigrated", entries: 99, positions: 77 }),
        );

        const result = await runPracticeMigrationPass();

        expect(result.outcomes[0]).toEqual(
            expect.objectContaining({ status: "alreadyMigrated", entries: 99, positions: 77 }),
        );
        expect(persistError.report).not.toHaveBeenCalled();
    });

    test("rechecks and migrates a legacy key immediately before native creation", async () => {
        native.load.mockResolvedValue(null);
        native.list.mockResolvedValue({ decks: [], anomalies: [] });
        native.migrate.mockResolvedValue(migrationOutcome());
        const mounted = mountDeck("appeared", 0);
        await waitForReady(mounted.store, mounted.atom);
        localStorage.setItem("deck-appeared-0", JSON.stringify(legacyData()));
        vi.useFakeTimers();

        const write = mounted.store.set(mounted.atom, { type: "sync", positions: [position()] });
        await vi.advanceTimersByTimeAsync(PRACTICE_SYNC_DEBOUNCE_MS);
        await write;

        expect(native.migrate).toHaveBeenCalledWith("appeared", 0, JSON.stringify(legacyData()));
        expect(native.sync).toHaveBeenCalledOnce();
        mounted.unsubscribe();
    });
});
