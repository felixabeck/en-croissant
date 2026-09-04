import { afterEach, describe, expect, it, vi } from "vitest";
import type { DatabaseHandle } from "@/bindings";
import {
    conversionProgressId,
    databaseHandleFromKey,
    databaseHandleKey,
    defaultDatabaseProgressId,
    defaultPuzzleDatabaseProgressId,
    getDefaultDatabases,
    getDefaultPuzzleDatabases,
    manifestDatabaseInstallCard,
    manifestPuzzleDatabaseInstallCard,
    sameDatabaseHandle,
    type ManagedDatabaseInfo,
} from "./db";

afterEach(() => vi.unstubAllGlobals());

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
    downloadLink: "https://www.encroissant.org/puzzles/lichess.db3",
    sha256: "a".repeat(64),
    signature: "untrusted comment: test signature",
};

function mockPuzzleManifest(body: unknown) {
    vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 })),
    );
}

describe("default puzzle database manifest", () => {
    it("accepts a complete downloadable puzzle database", async () => {
        mockPuzzleManifest([puzzleManifestEntry]);

        await expect(getDefaultPuzzleDatabases()).resolves.toEqual([puzzleManifestEntry]);
    });

    it("rejects malformed artifact integrity metadata", async () => {
        mockPuzzleManifest([{ ...puzzleManifestEntry, sha256: "not-a-sha256" }]);

        await expect(getDefaultPuzzleDatabases()).rejects.toMatchObject({ kind: "schema" });
    });

    it("rejects a manifest entry without a signature", async () => {
        const { signature: _signature, ...entryWithoutSignature } = puzzleManifestEntry;
        mockPuzzleManifest([entryWithoutSignature]);

        await expect(getDefaultPuzzleDatabases()).rejects.toMatchObject({ kind: "schema" });
    });
});

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

describe("default game database manifest", () => {
    const entry = {
        title: "Example database",
        game_count: 42,
        player_count: 12,
        storage_size: 4_096,
        downloadLink: "https://db.encroissant.org/example.db3",
        sha256: "b".repeat(64),
        signature: "untrusted comment: test signature",
    };

    it("accepts the remote fields used by the installer and defaults the description", async () => {
        mockPuzzleManifest([entry]);

        await expect(getDefaultDatabases()).resolves.toEqual([{ ...entry, description: "" }]);
    });

    it("rejects an unsigned database entry", async () => {
        const { signature: _signature, ...unsigned } = entry;
        mockPuzzleManifest([unsigned]);

        await expect(getDefaultDatabases()).rejects.toMatchObject({ kind: "schema" });
    });
});
