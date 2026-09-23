import { beforeEach, describe, expect, test, vi } from "vitest";
import { serializeStorageValue } from "./store/debouncedStorage";

const persistError = vi.hoisted(() => ({ report: vi.fn() }));
const mocks = vi.hoisted(() => ({
    list: vi.fn(),
    migrate: vi.fn(),
    reconcile: vi.fn(),
    reconcileAttachments: vi.fn(),
}));
vi.mock("@/platform/tauri", () => ({
    tauri: {
        listPracticeDecks: mocks.list,
        migratePracticeDeck: mocks.migrate,
        reconcileStartupPathOwners: mocks.reconcile,
        reconcileEngineAttachments: mocks.reconcileAttachments,
    },
}));
vi.mock("./persistError", () => ({ reportPersistError: persistError.report }));

import {
    collectOriginalPathOwners,
    initializePathOwners,
    resetPathOwnerInitializationForTests,
} from "./pathOwners";
import { resetEngineOwnerCoordinatorForTests, saveEngineOwnerValue } from "./engineOwnerStorage";
import { ensurePracticeMigration, resetPracticeMigrationForTests } from "./practiceStorage";

const path = (id: string) => ({ id });
const fileHandle = (id: string) => ({ id: path(id), kind: "fileWorkspace" as const });
const databaseHandle = (id: string) => ({ id: path(id), kind: "database" as const });
const engineHandle = (id: string) => ({ id: path(id), kind: "engine" as const });

function setJson(storage: Storage, key: string, value: unknown) {
    storage.setItem(key, JSON.stringify(value));
}

beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    mocks.list.mockReset().mockResolvedValue({ decks: [], anomalies: [] });
    mocks.migrate.mockReset().mockResolvedValue({
        status: "migrated",
        entries: 0,
        positions: 0,
        positionsDigest: "positions",
        entriesDigest: "entries",
    });
    mocks.reconcile.mockReset().mockResolvedValue(null);
    mocks.reconcileAttachments.mockReset().mockResolvedValue(null);
    resetPathOwnerInitializationForTests();
    resetEngineOwnerCoordinatorForTests();
    resetPracticeMigrationForTests();
    persistError.report.mockReset();
});

describe("collectOriginalPathOwners", () => {
    test("module snapshot captures raw owners before persisted atoms hydrate", async () => {
        vi.resetModules();
        const originalGetItem = Storage.prototype.getItem;
        let ownerReads = 0;
        const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (
            this: Storage,
            key: string,
        ) {
            if (this === localStorage && key === "download-destination-capability") {
                ownerReads += 1;
                return ownerReads === 1 ? JSON.stringify(path("raw-download")) : null;
            }
            return originalGetItem.call(this, key);
        });

        await import("./atoms");
        const { originalPathOwnersSnapshot } = await import("./pathOwners");
        getItem.mockRestore();

        expect(ownerReads).toBeGreaterThan(1);
        expect(originalPathOwnersSnapshot.retainedIds).toContainEqual(path("raw-download"));
    });

    test("captures each engine owner key once for both startup snapshots", async () => {
        vi.resetModules();
        const reads = new Map<string, number>();
        const originalGetItem = Storage.prototype.getItem;
        const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (
            this: Storage,
            key: string,
        ) {
            if (
                this === localStorage &&
                ["engines", "game-player1-settings", "game-player2-settings"].includes(key)
            ) {
                reads.set(key, (reads.get(key) ?? 0) + 1);
            }
            return originalGetItem.call(this, key);
        });

        await import("./pathOwners");
        getItem.mockRestore();

        expect(reads).toEqual(
            new Map([
                ["engines", 1],
                ["game-player1-settings", 1],
                ["game-player2-settings", 1],
            ]),
        );
    });

    test("collects every known owner location before storage repair", () => {
        const engine = {
            type: "local" as const,
            id: "engine-record",
            name: "Engine",
            version: "1",
            handle: engineHandle("engine-executable"),
            filename: "engine",
            imageHandle: { id: path("engine-image"), kind: "engineImage" as const },
            settings: [
                {
                    type: "resource" as const,
                    name: "SyzygyPath",
                    resources: [
                        {
                            id: path("engine-resource"),
                            kind: "directory" as const,
                            displayName: "tables",
                        },
                    ],
                },
            ],
        };
        setJson(localStorage, "download-destination-capability", path("download"));
        setJson(localStorage, "file-workspace", fileHandle("workspace"));
        setJson(localStorage, "recent-files", [{ handle: fileHandle("recent") }]);
        setJson(localStorage, "reference-database", databaseHandle("reference"));
        setJson(localStorage, "puzzle-db", path("puzzle"));
        setJson(localStorage, "game-opening-book-handle", {
            id: path("book"),
            kind: "openingBook",
        });
        localStorage.setItem("engines", serializeStorageValue([engine]));
        localStorage.setItem(
            "game-player1-settings",
            serializeStorageValue({
                type: "engine",
                engine,
                go: { t: "Depth", c: 24 },
                engineSettings: [
                    {
                        type: "resource",
                        name: "EvalFile",
                        resources: [
                            { id: path("player-resource"), kind: "file", displayName: "net" },
                        ],
                    },
                ],
            }),
        );
        setJson(localStorage, "game-player2-settings", { type: "human", name: "Player" });

        const file = {
            type: "file" as const,
            handle: fileHandle("tab-file"),
            name: "study.pgn",
            numGames: 1,
            metadata: { type: "game" as const, tags: [] },
            lastModified: 1,
        };
        sessionStorage.setItem(
            "workspace",
            serializeStorageValue({
                version: 1,
                tabs: [
                    {
                        name: "Current",
                        value: "current",
                        type: "analysis",
                        gameOrigin: { kind: "file", file, gameNumber: 1 },
                    },
                ],
                activeTab: "current",
            }),
        );
        sessionStorage.setItem(
            "tabs",
            serializeStorageValue([
                {
                    name: "Legacy",
                    value: "legacy",
                    type: "analysis",
                    gameOrigin: {
                        kind: "database",
                        database: databaseHandle("legacy-database"),
                        gameId: 2,
                    },
                },
            ]),
        );
        setJson(sessionStorage, "expanded-directories", ["expanded"]);
        setJson(sessionStorage, "database-view", {
            state: { database: { file: databaseHandle("database-view") } },
        });
        localStorage.setItem("deck-deck-file-42", "unreadable study value");

        const owners = collectOriginalPathOwners(localStorage, sessionStorage);

        expect(owners.trustedFamilies).toHaveLength(11);
        expect(owners.retainedIds.map(({ id }) => id)).toEqual(
            expect.arrayContaining([
                "download",
                "workspace",
                "recent",
                "reference",
                "puzzle",
                "book",
                "engine-executable",
                "engine-image",
                "engine-resource",
                "player-resource",
                "tab-file",
                "legacy-database",
                "expanded",
                "database-view",
                "deck-file",
            ]),
        );
    });

    test("distinguishes confirmed absence from malformed and throwing storage", () => {
        setJson(localStorage, "download-destination-capability", { id: "" });
        const owners = collectOriginalPathOwners(localStorage, sessionStorage);
        expect(owners.trustedFamilies).not.toContain("downloadDestination");
        expect(owners.trustedFamilies).toContain("fileWorkspace");

        const throwing = Object.create(localStorage) as Storage;
        Object.defineProperty(throwing, "getItem", {
            value: () => {
                throw new Error("denied");
            },
        });
        expect(collectOriginalPathOwners(throwing, sessionStorage).trustedFamilies).not.toContain(
            "engines",
        );
    });

    test("unions valid sibling evidence while failed shared-family records withhold trust", () => {
        const playerEngine = {
            type: "local" as const,
            id: "player-engine",
            name: "Player engine",
            version: "1",
            handle: engineHandle("player-executable"),
            filename: "engine",
            imageHandle: { id: path("player-image"), kind: "engineImage" as const },
            settings: [
                {
                    type: "resource" as const,
                    name: "EvalFile",
                    resources: [
                        { id: path("player-net"), kind: "file" as const, displayName: "net" },
                    ],
                },
            ],
        };
        localStorage.setItem(
            "game-player1-settings",
            serializeStorageValue({
                type: "engine",
                engine: playerEngine,
                go: { t: "Depth", c: 24 },
                engineSettings: [
                    {
                        type: "resource",
                        name: "Override",
                        resources: [
                            { id: path("override-net"), kind: "file", displayName: "override" },
                        ],
                    },
                ],
            }),
        );
        let owners = collectOriginalPathOwners(localStorage, sessionStorage);
        expect(owners.trustedFamilies).toContain("engines");
        expect(owners.retainedIds).toEqual(
            expect.arrayContaining([
                path("player-executable"),
                path("player-image"),
                path("player-net"),
                path("override-net"),
            ]),
        );

        localStorage.setItem("engines", "malformed");
        owners = collectOriginalPathOwners(localStorage, sessionStorage);
        expect(owners.trustedFamilies).not.toContain("engines");
        expect(owners.retainedIds).toContainEqual(path("player-executable"));
    });

    test("unions current and legacy workspace evidence but distrusts either failed source", () => {
        const tempFile = {
            type: "file" as const,
            handle: fileHandle("temp-file"),
            name: "temp.pgn",
            numGames: 1,
            metadata: { type: "game" as const, tags: [] },
            lastModified: 1,
        };
        sessionStorage.setItem("workspace", "malformed");
        sessionStorage.setItem(
            "tabs",
            serializeStorageValue([
                {
                    name: "Legacy temp",
                    value: "legacy-temp",
                    type: "analysis",
                    gameOrigin: { kind: "temp_file", file: tempFile, gameNumber: 1 },
                },
            ]),
        );
        const owners = collectOriginalPathOwners(localStorage, sessionStorage);
        expect(owners.trustedFamilies).not.toContain("sessionWorkspace");
        expect(owners.retainedIds).toContainEqual(path("temp-file"));
    });

    test("storage access and enumeration failures protect only affected families", () => {
        const throwingRead = Object.create(localStorage) as Storage;
        Object.defineProperty(throwingRead, "getItem", {
            value: (key: string) => {
                if (key === "engines") throw new Error("denied");
                return localStorage.getItem(key);
            },
        });
        Object.defineProperty(throwingRead, "length", {
            get: () => {
                throw new Error("enumeration denied");
            },
        });
        const owners = collectOriginalPathOwners(throwingRead, sessionStorage);
        expect(owners.trustedFamilies).not.toContain("engines");
        expect(owners.trustedFamilies).not.toContain("practiceDeck");
        expect(owners.trustedFamilies).toContain("downloadDestination");
    });

    test("throwing global storage getters return an all-untrusted startup snapshot", () => {
        const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
        Object.defineProperty(globalThis, "localStorage", {
            configurable: true,
            get: () => {
                throw new Error("storage disabled");
            },
        });
        try {
            expect(collectOriginalPathOwners()).toEqual({ retainedIds: [], trustedFamilies: [] });
        } finally {
            if (descriptor) Object.defineProperty(globalThis, "localStorage", descriptor);
        }
    });
});

test("initialization shares one native reconciliation promise", async () => {
    let resolve: () => void = () => {};
    mocks.reconcile.mockImplementation(
        () =>
            new Promise<null>((done) => {
                resolve = () => done(null);
            }),
    );
    const first = initializePathOwners();
    const second = initializePathOwners();
    expect(first).toBe(second);
    await vi.waitFor(() => expect(mocks.reconcile).toHaveBeenCalledOnce());
    expect(mocks.reconcile).toHaveBeenCalledOnce();
    resolve();
    await first;
    expect(mocks.reconcileAttachments).toHaveBeenCalledOnce();
});

test("builds the practice union after migration and keeps a key inserted during the pass", async () => {
    localStorage.setItem("deck-before-0", JSON.stringify({ positions: [], logs: [] }));
    mocks.list.mockResolvedValue({
        decks: [{ fileId: "native", game: 1 }],
        anomalies: [],
    });
    mocks.migrate.mockImplementation(async () => {
        localStorage.setItem("deck-during-2", JSON.stringify({ positions: [], logs: [] }));
        return {
            status: "migrated",
            entries: 0,
            positions: 0,
            positionsDigest: "positions",
            entriesDigest: "entries",
        };
    });

    await ensurePracticeMigration();
    await initializePathOwners();

    const owners = mocks.reconcile.mock.calls[0][0];
    expect(owners.retainedIds).toEqual(
        expect.arrayContaining([{ id: "before" }, { id: "during" }, { id: "native" }]),
    );
    expect(owners.trustedFamilies).toContain("practiceDeck");
});

test("retains an orphan identity, distrusts practice data, and reports the anomaly once", async () => {
    mocks.list.mockResolvedValue({
        decks: [],
        anomalies: [
            {
                kind: "OrphanShard",
                leaf: "orphan-shard",
                fileId: "orphan",
                game: 3,
            },
        ],
    });

    await ensurePracticeMigration();
    await initializePathOwners();

    const owners = mocks.reconcile.mock.calls[0][0];
    expect(owners.retainedIds).toContainEqual({ id: "orphan" });
    expect(owners.trustedFamilies).not.toContain("practiceDeck");
    expect(persistError.report).toHaveBeenCalledOnce();
});

test("retains a damaged deck identity while distrusting practice data", async () => {
    mocks.list.mockResolvedValue({
        decks: [{ fileId: "damaged", game: 4 }],
        anomalies: [
            {
                kind: "DamagedDeck",
                leaf: "damaged-positions.json",
                fileId: "damaged",
                game: 4,
            },
        ],
    });

    await ensurePracticeMigration();
    await initializePathOwners();

    const owners = mocks.reconcile.mock.calls[0][0];
    expect(owners.retainedIds).toContainEqual({ id: "damaged" });
    expect(owners.trustedFamilies).not.toContain("practiceDeck");
});

test("retains an unreadable deck identity while distrusting practice data", async () => {
    mocks.list.mockResolvedValue({
        decks: [{ fileId: "unreadable", game: 5 }],
        anomalies: [
            {
                kind: "Unreadable",
                leaf: "unreadable-positions.json",
                fileId: "unreadable",
                game: 5,
            },
        ],
    });

    await ensurePracticeMigration();
    await initializePathOwners();

    const owners = mocks.reconcile.mock.calls[0][0];
    expect(owners.retainedIds).toContainEqual({ id: "unreadable" });
    expect(owners.trustedFamilies).not.toContain("practiceDeck");
});

test("does not retain an identity from an IdentityMismatch anomaly", async () => {
    mocks.list.mockResolvedValue({
        decks: [],
        anomalies: [
            {
                kind: "IdentityMismatch",
                leaf: "mismatched",
                fileId: null,
                game: null,
            },
        ],
    });

    await ensurePracticeMigration();
    await initializePathOwners();

    const owners = mocks.reconcile.mock.calls[0][0];
    expect(owners.retainedIds).not.toContainEqual({ id: "mismatched" });
    expect(owners.trustedFamilies).not.toContain("practiceDeck");
});

test("retains a native identity on the second startup after the legacy key is removed", async () => {
    localStorage.setItem("deck-native-0", JSON.stringify({ positions: [], logs: [] }));
    mocks.list.mockResolvedValue({
        decks: [{ fileId: "native", game: 0 }],
        anomalies: [],
    });

    await ensurePracticeMigration();
    await initializePathOwners();
    localStorage.removeItem("deck-native-0");
    resetPathOwnerInitializationForTests();
    mocks.reconcile.mockClear();

    await initializePathOwners();

    expect(mocks.reconcile.mock.calls[0][0].retainedIds).toContainEqual({ id: "native" });
});

test("a failed first add leaves absent storage trusted for fresh startup reclamation", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
        throw new DOMException("Storage quota exceeded", "QuotaExceededError");
    });
    const receipt = await saveEngineOwnerValue("engines", serializeStorageValue([]));
    setItem.mockRestore();

    expect(receipt).toEqual(expect.objectContaining({ saved: false, synchronized: false }));
    expect(localStorage.getItem("engines")).toBeNull();

    vi.resetModules();
    const fresh = await import("./pathOwners");
    const snapshot = fresh.collectOriginalPathOwners(localStorage, sessionStorage);
    expect(snapshot.trustedFamilies).toContain("engines");

    await fresh.initializePathOwners();
    expect(mocks.reconcile).toHaveBeenCalledWith(
        expect.objectContaining({ trustedFamilies: expect.arrayContaining(["engines"]) }),
    );
    expect(mocks.reconcileAttachments).toHaveBeenLastCalledWith({
        action: "reconcile",
        retained_ids: [],
        abandoned_ids: [],
        startup: true,
    });
});
