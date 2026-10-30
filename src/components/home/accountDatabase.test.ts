import { expect, test } from "vitest";
import type { CollectionDescriptor } from "@/bindings";
import type { ManagedDatabaseInfo } from "@/utils/db";
import { accountDatabaseFilename, findAccountDatabase } from "./accountDatabase";

test.each(["lichess", "chesscom"] as const)("identifies the %s account database", (type) => {
    expect(accountDatabaseFilename("Magnus", type)).toBe(`Magnus_${type}.db3`);
});

function linkedAccount(provider: "lichess" | "chesscom", account: string): CollectionDescriptor {
    return {
        id: "collection",
        name: "History",
        file: { id: { id: "source" }, kind: "fileWorkspace" },
        database: { id: { id: "index" }, kind: "database" },
        account: { provider, account },
        status: "unavailable",
        generation: "current",
        omitted: 0,
        retiredDatabase: null,
        fetchSinceMs: null,
    };
}

function legacy(filename: string, id = filename): ManagedDatabaseInfo {
    return {
        type: "error",
        filename,
        file: { id: { id }, kind: "database" },
        indexed: false,
        error: "Unreadable metadata",
    };
}

test.each(["lichess", "chesscom"] as const)(
    "%s retains the canonical linked error ahead of the legacy filename in either order",
    (provider) => {
        const old = legacy(accountDatabaseFilename("Felix", provider));
        const linked: ManagedDatabaseInfo = {
            type: "error",
            file: { id: { id: "index" }, kind: "database" },
            filename: "My accumulated games",
            indexed: false,
            error: "Source unavailable",
            collection: linkedAccount(provider, "fELIX"),
        };
        const unread = [
            { filename: accountDatabaseFilename("felix", provider), error: "Unreadable" },
        ];
        expect(findAccountDatabase({ databases: [old, linked], unread }, provider, "Felix")).toBe(
            linked,
        );
        expect(findAccountDatabase({ databases: [linked, old], unread }, provider, "Felix")).toBe(
            linked,
        );
    },
);

test("a linked account never falls back to its filename for another provider or player", () => {
    const filename = accountDatabaseFilename("Felix", "chesscom");
    const wrongProvider = {
        ...legacy(filename, "provider"),
        collection: linkedAccount("lichess", "felix"),
    };
    const wrongPlayer = {
        ...legacy(filename, "player"),
        collection: linkedAccount("chesscom", "coach"),
    };
    expect(
        findAccountDatabase(
            { databases: [wrongProvider, wrongPlayer], unread: [] },
            "chesscom",
            "Felix",
        ),
    ).toBeNull();
    const old = legacy(filename);
    expect(
        findAccountDatabase(
            { databases: [wrongProvider, wrongPlayer, old], unread: [] },
            "chesscom",
            "Felix",
        ),
    ).toBe(old);
});

test("legacy matching retains one case variant and refuses unread association evidence", () => {
    const unread = { filename: "Felix_lichess.db3", error: "Unreadable" };
    const old = legacy(unread.filename);
    expect(findAccountDatabase({ databases: [old], unread: [] }, "lichess", "felix")).toBe(old);
    expect(findAccountDatabase({ databases: [], unread: [unread] }, "lichess", "felix")).toEqual({
        type: "unavailable",
        filenames: [unread.filename],
        error: "Unreadable",
    });
    expect(
        findAccountDatabase({ databases: [], unread: [unread] }, "chesscom", "Felix"),
    ).toBeNull();
});

test.each(["readable", "unread"])(
    "distinct %s case variants refuse arbitrary selection in either order",
    (kind) => {
        const first = legacy("Felix_lichess.db3");
        const second = legacy("felix_lichess.db3");
        const unread =
            kind === "unread" ? [{ filename: second.filename, error: "Unreadable" }] : [];
        const databases = kind === "unread" ? [first] : [first, second];
        for (const entries of [databases, [...databases].reverse()]) {
            expect(
                findAccountDatabase({ databases: entries, unread }, "lichess", "felix"),
            ).toMatchObject({
                type: "unavailable",
                filenames: expect.arrayContaining([first.filename, second.filename]),
            });
        }
    },
);

test("only the account spelling is compatible, with exact provider suffix and one native identity", () => {
    const old = legacy("Felix_lichess.db3");
    expect(
        findAccountDatabase({ databases: [old, { ...old }], unread: [] }, "lichess", "felix"),
    ).toBeTruthy();
    expect(
        findAccountDatabase(
            {
                databases: [
                    legacy("OtherFelix_lichess.db3"),
                    legacy("Felix_LICHESS.db3"),
                    legacy("Felix_chesscom.db3"),
                ],
                unread: [],
            },
            "lichess",
            "felix",
        ),
    ).toBeNull();
    expect(findAccountDatabase(undefined, "lichess", "felix")).toEqual({
        type: "unavailable",
        filenames: [],
    });
    expect(
        findAccountDatabase({ databases: [old], unread: [] }, "lichess", "felix", false),
    ).toEqual({ type: "unavailable", filenames: [] });
});

test("a registered canonical collection without a listed index cannot fall back to legacy history", () => {
    const registered = { ...linkedAccount("lichess", "felix"), database: null };
    expect(
        findAccountDatabase(
            { databases: [legacy("Felix_lichess.db3")], unread: [], collections: [registered] },
            "lichess",
            "felix",
        ),
    ).toEqual({ type: "unavailable", filenames: [registered.name] });
});

test.each(["lichess", "chesscom"] as const)(
    "trashed %s account retains its canonical error or unavailable result",
    (provider) => {
        const collection = { ...linkedAccount(provider, "felix"), status: "trashed" as const };
        const linked = { ...legacy(collection.name, "index"), collection };
        const listing = { databases: [linked], unread: [], collections: [collection] };
        expect(findAccountDatabase(listing, provider, "Felix")).toBe(linked);
        expect(
            findAccountDatabase(
                { ...listing, databases: [], collections: [{ ...collection, database: null }] },
                provider,
                "Felix",
            ),
        ).toEqual({ type: "unavailable", filenames: [collection.name] });
    },
);
