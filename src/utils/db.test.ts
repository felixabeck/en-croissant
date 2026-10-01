import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DatabaseHandle, GameQuery } from "@/bindings";
import type { LocalOptions } from "@/components/panels/database/DatabasePanel";
import i18n from "i18next";
import { supportedLocales } from "@/i18n";

const mocks = vi.hoisted(() => ({
    getDatabaseWorkspace: vi.fn(),
    listWorkspaceDatabases: vi.fn(),
    getDbInfo: vi.fn(),
    logError: vi.fn(),
    logWarn: vi.fn(),
    verifySignedBytes: vi.fn(),
    remoteGet: vi.fn(),
    searchPosition: vi.fn(),
}));
vi.mock("@/platform/tauri", () => ({
    tauri: {
        getDatabaseWorkspace: mocks.getDatabaseWorkspace,
        listWorkspaceDatabases: mocks.listWorkspaceDatabases,
        getDbInfo: mocks.getDbInfo,
        verifySignedBytes: mocks.verifySignedBytes,
        searchPosition: mocks.searchPosition,
    },
}));
vi.mock("@/platform/native", () => ({ error: mocks.logError, warn: mocks.logWarn }));
vi.mock("@/platform/http", () => ({ remoteHttp: { get: mocks.remoteGet } }));
import databaseCatalogDocument from "@/catalogs/databases.json?raw";
import databaseCatalogSignature from "@/catalogs/databases.json.minisig?raw";
import puzzleCatalogDocument from "@/catalogs/puzzles.json?raw";
import puzzleCatalogSignature from "@/catalogs/puzzles.json.minisig?raw";
import { CatalogVerificationError } from "@/utils/signedCatalog";
import {
    DATABASE_NOT_INITIALIZED,
    conversionProgressId,
    databaseHandleFromKey,
    databaseHandleKey,
    defaultDatabaseProgressId,
    defaultPuzzleDatabaseProgressId,
    getDefaultDatabases,
    getDefaultPuzzleDatabases,
    getDatabases,
    manifestDatabaseInstallCard,
    manifestPuzzleDatabaseInstallCard,
    sameDatabaseHandle,
    searchPosition,
    type ManagedDatabaseInfo,
} from "./db";

afterEach(() => vi.unstubAllGlobals());
beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDatabaseWorkspace.mockResolvedValue({ id: { id: "root" }, kind: "databaseRoot" });
    mocks.logError.mockResolvedValue(undefined);
});

const handle = (id: string): DatabaseHandle => ({ id: { id }, kind: "database" });

const database = (id: string, filename = `${id}.db3`): ManagedDatabaseInfo => ({
    type: "success",
    file: handle(id),
    filename,
    title: filename,
    description: "",
    player_count: 0,
    event_count: 0,
    game_count: 0,
    storage_size: BigInt(0),
    indexed: false,
});

describe("database capability UI mapping", () => {
    it("projects a handle to a stable widget key without treating it as a path", () => {
        expect(databaseHandleKey(handle("database-opaque-id"))).toBe("database-opaque-id");
    });

    it("restores a select key only from the current native database descriptors", () => {
        const databases = [database("first"), database("second")];
        expect(databaseHandleFromKey(databases, "second")).toEqual(handle("second"));
        expect(databaseHandleFromKey(databases, "revoked")).toBeNull();
    });

    it("compares separately deserialized handles by opaque identity", () => {
        expect(sameDatabaseHandle(handle("same"), handle("same"))).toBe(true);
        expect(sameDatabaseHandle(handle("first"), handle("second"))).toBe(false);
        expect(sameDatabaseHandle(handle("first"), null)).toBe(false);
    });
});

describe("production database metadata pipeline", () => {
    it("hydrates more than 128 entries sequentially as successful managed databases", async () => {
        const descriptors = Array.from({ length: 130 }, (_, index) => ({
            handle: handle(`db-${index}`),
            filename: `db-${index}.db3`,
            availability: "available" as const,
        }));
        mocks.listWorkspaceDatabases.mockResolvedValue(descriptors);
        let active = 0;
        let maximumActive = 0;
        mocks.getDbInfo.mockImplementation(async (file: DatabaseHandle) => {
            active += 1;
            maximumActive = Math.max(maximumActive, active);
            await Promise.resolve();
            active -= 1;
            const id = file.id.id;
            return {
                title: id,
                description: "",
                player_count: 0,
                event_count: 0,
                game_count: 0,
                storage_size: 0n,
                indexed: false,
            };
        });

        const result = await getDatabases();
        expect(result).toHaveLength(130);
        expect(result.every((item) => item.type === "success")).toBe(true);
        expect(result.map((item) => item.file.id.id)).toEqual(
            descriptors.map((item) => item.handle.id.id),
        );
        expect(maximumActive).toBe(1);
    });

    it("returns a renderer-safe error entry while retaining successful siblings", async () => {
        const descriptors = ["one", "failed", "three"].map((id) => ({
            handle: handle(id),
            filename: `${id}.db3`,
            availability: "available" as const,
        }));
        mocks.listWorkspaceDatabases.mockResolvedValue(descriptors);
        mocks.getDbInfo.mockImplementation(async (file: DatabaseHandle) => {
            if (file.id.id === "failed")
                throw new Error("metadata unavailable at /private/database.db3");
            return {
                title: file.id.id,
                description: "",
                player_count: 0,
                event_count: 0,
                game_count: 0,
                storage_size: 0n,
                indexed: false,
            };
        });

        const result = await getDatabases();
        expect(result.map((item) => item.file.id.id)).toEqual(["one", "failed", "three"]);
        expect(result.map((item) => item.type)).toEqual(["success", "error", "success"]);
        expect(result[1]).toEqual({
            type: "error",
            file: handle("failed"),
            filename: "failed.db3",
            indexed: false,
            error: i18n.t("Databases.LoadError.Title"),
        });
        expect(mocks.logError).toHaveBeenCalledExactlyOnceWith(
            "getDatabases metadata item 1 (failed.db3) failed: metadata unavailable at [path]",
        );
    });

    it.each(
        supportedLocales.flatMap((locale) =>
            [
                {
                    category: "invalid-input",
                    message:
                        "Invalid input: could not open SQLite database: unable to open database file",
                    key: "Databases.LoadError.Title",
                },
                {
                    category: "permission",
                    message: "Permission denied: cannot read /private/database.db3",
                    key: "Databases.LoadError.Permission",
                },
                {
                    category: "missing-resource",
                    message: "Missing resource: /private/database.db3 no longer exists",
                    key: "Databases.LoadError.Missing",
                },
            ].map((failure) => ({ locale, ...failure })),
        ),
    )(
        "uses fixed safe text for $category in the shipped $locale catalogue without fallback",
        async ({ locale, category, message, key }) => {
            const { default: catalogue } = await import(`../translation/${locale}.json`);
            const translator = i18n.createInstance();
            await translator.init({
                lng: locale,
                fallbackLng: false,
                resources: { [locale]: catalogue },
            });
            const t = vi.spyOn(i18n, "t").mockImplementation(translator.t);
            mocks.listWorkspaceDatabases.mockResolvedValue([
                {
                    handle: handle("unreadable"),
                    filename: "unreadable.db3",
                    availability: "available",
                },
            ]);
            mocks.getDbInfo.mockRejectedValueOnce({
                tag: "backend-error",
                category,
                message,
            });

            const result = await getDatabases();
            expect(result).toEqual([
                {
                    type: "error",
                    file: handle("unreadable"),
                    filename: "unreadable.db3",
                    indexed: false,
                    error: catalogue.translation[key],
                },
            ]);
            expect(JSON.stringify(result)).not.toContain(message);
            expect(JSON.stringify(result)).not.toContain("/private/database.db3");
            expect(result[0].type === "error" && result[0].error).not.toBe(key);
            expect(catalogue.translation[key]).toBeTruthy();
            expect(mocks.logError).toHaveBeenCalledExactlyOnceWith(
                `getDatabases metadata item 0 (unreadable.db3) failed: ${message.replace("/private/database.db3", "[path]")}`,
            );
            t.mockRestore();
        },
    );

    it.each(supportedLocales)(
        "localizes an unfinished import in the shipped %s catalogue without fallback",
        async (locale) => {
            expect(DATABASE_NOT_INITIALIZED).toBe(
                "Invalid input: Database has not been initialized yet",
            );
            const { default: catalogue } = await import(`../translation/${locale}.json`);
            const translator = i18n.createInstance();
            await translator.init({
                lng: locale,
                fallbackLng: false,
                resources: { [locale]: catalogue },
            });
            const t = vi.spyOn(i18n, "t").mockImplementation(translator.t);
            mocks.listWorkspaceDatabases.mockResolvedValue([
                {
                    handle: handle("unfinished"),
                    filename: "unfinished.db3",
                    availability: "available",
                },
            ]);
            mocks.getDbInfo.mockRejectedValueOnce({
                tag: "backend-error",
                category: "invalid-input",
                message: "Invalid input: Database has not been initialized yet",
            });
            const result = await getDatabases();
            expect(result).toEqual([
                {
                    type: "error",
                    file: handle("unfinished"),
                    filename: "unfinished.db3",
                    indexed: false,
                    error: catalogue.translation["Databases.ImportUnfinished"],
                },
            ]);
            expect(result[0].type === "error" && result[0].error).not.toBe(
                "Databases.ImportUnfinished",
            );
            expect(catalogue.translation["Databases.ImportUnfinished"]).toBeTruthy();
            expect(JSON.stringify(result)).not.toContain(
                "Invalid input: Database has not been initialized yet",
            );
            t.mockRestore();
        },
    );

    it("propagates a metadata cancellation without returning an error card or logging", async () => {
        mocks.listWorkspaceDatabases.mockResolvedValue(
            ["one", "two"].map((id) => ({
                handle: handle(id),
                filename: `${id}.db3`,
                availability: "available",
            })),
        );
        const cancellation = {
            tag: "backend-error",
            category: "cancellation",
            message: "Cancellation",
        };
        mocks.getDbInfo.mockRejectedValueOnce(cancellation);
        await expect(getDatabases()).rejects.toBe(cancellation);
        expect(mocks.getDbInfo).toHaveBeenCalledOnce();
        expect(mocks.logError).not.toHaveBeenCalled();
    });

    it("keeps an error entry when diagnostic logging rejects and sanitizes its fallback", async () => {
        mocks.listWorkspaceDatabases.mockResolvedValue([
            { handle: handle("broken"), filename: "broken.db3", availability: "available" },
        ]);
        mocks.getDbInfo.mockRejectedValueOnce(new Error("unreadable /private/database.db3"));
        mocks.logError.mockRejectedValueOnce(new Error("logger failed /private/log.txt"));
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
        expect(await getDatabases()).toEqual([
            {
                type: "error",
                file: handle("broken"),
                filename: "broken.db3",
                indexed: false,
                error: i18n.t("Databases.LoadError.Title"),
            },
        ]);
        expect(consoleError).toHaveBeenCalledExactlyOnceWith("Database metadata logging failed", {
            operation: "getDatabases metadata",
            itemIndex: 0,
            filename: "broken.db3",
            primaryFailure: { category: "unexpected", message: "unreadable [path]" },
            loggerFailure: { category: "unexpected", message: "logger failed [path]" },
        });
        consoleError.mockRestore();
    });

    it("owner cancellation during rejected metadata propagates without diagnostics", async () => {
        const controller = new AbortController();
        mocks.listWorkspaceDatabases.mockResolvedValue([
            { handle: handle("one"), filename: "one.db3", availability: "available" },
        ]);
        mocks.getDbInfo.mockImplementationOnce(async () => {
            controller.abort();
            throw new Error("metadata unavailable");
        });
        await expect(getDatabases({ signal: controller.signal })).rejects.toMatchObject({
            name: "AbortError",
        });
        expect(mocks.logError).not.toHaveBeenCalled();
    });

    it("owner cancellation between metadata entries rejects without partial publication", async () => {
        const controller = new AbortController();
        const descriptors = ["one", "two", "three"].map((id) => ({
            handle: handle(id),
            filename: `${id}.db3`,
            availability: "available" as const,
        }));
        mocks.listWorkspaceDatabases.mockResolvedValue(descriptors);
        let resolveFirst!: (value: object) => void;
        mocks.getDbInfo.mockReturnValueOnce(
            new Promise((resolve) => {
                resolveFirst = resolve;
            }),
        );
        const result = getDatabases({ signal: controller.signal });
        await vi.waitFor(() => expect(mocks.getDbInfo).toHaveBeenCalledOnce());
        resolveFirst({
            title: "one",
            description: "",
            player_count: 0,
            event_count: 0,
            game_count: 0,
            storage_size: 0n,
            indexed: false,
        });
        controller.abort();
        await expect(result).rejects.toMatchObject({ name: "AbortError" });
        expect(mocks.getDbInfo).toHaveBeenCalledOnce();
        expect(mocks.logError).not.toHaveBeenCalled();
    });

    it("cancellation immediately after final metadata resolution rejects without diagnostics", async () => {
        const controller = new AbortController();
        mocks.listWorkspaceDatabases.mockResolvedValue([
            { handle: handle("only"), filename: "only.db3", availability: "available" },
        ]);
        let resolveMetadata!: (value: object) => void;
        mocks.getDbInfo.mockReturnValue(
            new Promise((resolve) => {
                resolveMetadata = resolve;
            }),
        );
        const result = getDatabases({ signal: controller.signal });
        await vi.waitFor(() => expect(mocks.getDbInfo).toHaveBeenCalledOnce());
        resolveMetadata({
            title: "only",
            description: "",
            player_count: 0,
            event_count: 0,
            game_count: 0,
            storage_size: 0n,
            indexed: false,
        });
        controller.abort();
        await expect(result).rejects.toMatchObject({ name: "AbortError" });
        expect(mocks.logError).not.toHaveBeenCalled();
    });
});

describe("conversionProgressId", () => {
    it("projects different handles to different ids", () => {
        expect(conversionProgressId(handle("first"))).not.toBe(
            conversionProgressId(handle("second")),
        );
        expect(conversionProgressId(handle("first"))).toBe(
            `conversion:${databaseHandleKey(handle("first"))}`,
        );
    });

    it("is stable for the same handle", () => {
        expect(conversionProgressId(handle("same"))).toBe(conversionProgressId(handle("same")));
    });
});

const puzzleManifestEntry = {
    title: "Lichess puzzles",
    description: "A curated puzzle database",
    puzzleCount: 1_000,
    storageSize: 2_048,
    downloadLink: "https://db.encroissant.org/puzzles/lichess.db3",
    sha256: "a".repeat(64),
    signature: "untrusted comment: test signature",
};

describe("manifest install-card identity", () => {
    const link = "https://db.encroissant.org/example.db3";
    const otherLink = "https://db.encroissant.org/other.db3";

    it("keys game-database progress by download URL, not array index or title", () => {
        const installed = [{ type: "success", title: "Lichess" }];
        const card = manifestDatabaseInstallCard(installed, {
            downloadLink: link,
            title: "Lichess",
        });
        expect(card).toEqual({
            progressId: defaultDatabaseProgressId(link),
            initInstalled: true,
        });
        expect(card.progressId).not.toBe("db_0");
        expect(card.progressId).toBe(`db:${link}`);
        expect(
            manifestDatabaseInstallCard(installed, { downloadLink: otherLink, title: "Other" })
                .initInstalled,
        ).toBe(false);
    });

    it("keys puzzle-database progress by download URL, not array index", () => {
        const card = manifestPuzzleDatabaseInstallCard([{ title: "Lichess.db3" }], {
            downloadLink: puzzleManifestEntry.downloadLink,
            title: "Lichess puzzles",
        });
        expect(card.progressId).toBe(
            defaultPuzzleDatabaseProgressId(puzzleManifestEntry.downloadLink),
        );
        expect(card.progressId).not.toBe("puzzle_db_0");
        expect(card.initInstalled).toBe(false);
        expect(
            manifestPuzzleDatabaseInstallCard([{ title: "Lichess puzzles.db3" }], {
                downloadLink: puzzleManifestEntry.downloadLink,
                title: "Lichess puzzles",
            }).initInstalled,
        ).toBe(true);
    });
});

describe("bundled default catalogs", () => {
    beforeEach(() => {
        mocks.verifySignedBytes.mockReset();
        mocks.remoteGet.mockReset();
        vi.stubGlobal("fetch", vi.fn());
    });
    afterEach(() => vi.unstubAllGlobals());

    it("verifies the exact bundled database catalog bytes without any HTTP request", async () => {
        mocks.verifySignedBytes.mockResolvedValue(null);

        const databases = await getDefaultDatabases();

        expect(mocks.verifySignedBytes).toHaveBeenCalledWith(
            databaseCatalogDocument,
            databaseCatalogSignature,
        );
        expect(databases.map((db) => db.title)).toContain("Lumbra's Gigabase");
        expect(
            databases.every((db) => db.downloadLink.startsWith("https://db.encroissant.org/")),
        ).toBe(true);
        expect(fetch).not.toHaveBeenCalled();
        expect(mocks.remoteGet).not.toHaveBeenCalled();
    });

    it("verifies the exact bundled puzzle catalog bytes without any HTTP request", async () => {
        mocks.verifySignedBytes.mockResolvedValue(null);

        const puzzles = await getDefaultPuzzleDatabases();

        expect(mocks.verifySignedBytes).toHaveBeenCalledWith(
            puzzleCatalogDocument,
            puzzleCatalogSignature,
        );
        expect(puzzles.map((db) => db.downloadLink)).toEqual([
            "https://db.encroissant.org/Lichess%20Puzzles%202026.db3",
        ]);
        expect(fetch).not.toHaveBeenCalled();
        expect(mocks.remoteGet).not.toHaveBeenCalled();
    });

    it("rejects with CatalogVerificationError instead of an empty list when verification fails", async () => {
        mocks.verifySignedBytes.mockRejectedValue(new Error("bad signature"));

        await expect(getDefaultDatabases()).rejects.toBeInstanceOf(CatalogVerificationError);
        await expect(getDefaultPuzzleDatabases()).rejects.toBeInstanceOf(CatalogVerificationError);
        expect(fetch).not.toHaveBeenCalled();
        expect(mocks.remoteGet).not.toHaveBeenCalled();
    });
});

describe("searchPosition query mapping", () => {
    const localOptions = (overrides: Partial<LocalOptions> = {}): LocalOptions => ({
        path: handle("local"),
        fen: "8/8/8/8/8/8/8/8 w - - 0 1",
        type: "exact",
        player: null,
        color: "white",
        result: "any",
        ...overrides,
    });
    const sentQuery = async (options: LocalOptions): Promise<GameQuery> => {
        mocks.searchPosition.mockResolvedValue([[], []]);
        await searchPosition(options, "tab-1");
        return mocks.searchPosition.mock.calls[0][1] as GameQuery;
    };

    it("sends the Elo band as both range1 and range2", async () => {
        const query = await sentQuery(localOptions({ elo: [1850, 2350] }));

        expect(query.range1).toEqual([1850, 2350]);
        expect(query.range2).toEqual([1850, 2350]);
    });

    it("omits both ranges when the slider is untouched or at [0, 3000]", async () => {
        for (const elo of [undefined, [0, 3000] as [number, number]]) {
            mocks.searchPosition.mockClear();
            const query = await sentQuery(localOptions({ elo }));

            expect(query).not.toHaveProperty("range1");
            expect(query).not.toHaveProperty("range2");
        }
    });

    it("omits wanted_result when the explorer result is any", async () => {
        const query = await sentQuery(localOptions({ result: "any" }));
        expect(query).not.toHaveProperty("wanted_result");
    });

    it("omits exclude_fast_events when off and sends true when on", async () => {
        for (const off of [undefined, false]) {
            mocks.searchPosition.mockClear();
            const query = await sentQuery(localOptions({ exclude_fast_events: off }));
            expect(query).not.toHaveProperty("exclude_fast_events");
        }

        mocks.searchPosition.mockClear();
        const query = await sentQuery(localOptions({ exclude_fast_events: true }));
        expect(query.exclude_fast_events).toBe(true);
    });
});
