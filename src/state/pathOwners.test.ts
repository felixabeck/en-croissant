import { beforeEach, describe, expect, test, vi } from "vitest";
import { serializeStorageValue } from "./store/debouncedStorage";

const mocks = vi.hoisted(() => ({ reconcile: vi.fn() }));
vi.mock("@/platform/tauri", () => ({
    tauri: { reconcileStartupPathOwners: mocks.reconcile },
}));

import {
    collectOriginalPathOwners,
    initializePathOwners,
    resetPathOwnerInitializationForTests,
} from "./pathOwners";

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
    mocks.reconcile.mockReset().mockResolvedValue(null);
    resetPathOwnerInitializationForTests();
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
    expect(mocks.reconcile).toHaveBeenCalledOnce();
    resolve();
    await first;
});
