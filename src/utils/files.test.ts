import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    createWorkspaceFile: vi.fn(),
    listFileWorkspace: vi.fn(),
    issuePgnWorkspace: vi.fn(),
    countPgnGames: vi.fn(),
    issueFileWorkspace: vi.fn(),
    storeGet: vi.fn(),
    storeSet: vi.fn(),
}));

vi.mock("@/platform/tauri", async () => {
    const actual = await vi.importActual<typeof import("@/platform/tauri")>("@/platform/tauri");
    return { ...actual, tauri: mocks };
});

vi.mock("jotai", async (importOriginal) => {
    const actual = await importOriginal<typeof import("jotai")>();
    return {
        ...actual,
        getDefaultStore: () => ({
            get: mocks.storeGet,
            set: mocks.storeSet,
        }),
    };
});

import { TauriCommandError } from "@/platform/tauri";
import { fileWorkspaceAtom, fileWorkspaceDisplayNameAtom } from "@/state/atoms";
import { createFile, ensureFileWorkspace, pickPgnFile } from "./files";

afterEach(() => {
    vi.clearAllMocks();
});

test.each([
    {
        path: "structured backend-error",
        listedName: "game",
        rejection: new TauriCommandError({
            tag: "backend-error",
            category: "durability",
            message: "Committed but durability uncertain: registry replacement",
        }),
    },
    {
        path: "structured backend-error",
        listedName: "game.pgn",
        rejection: new TauriCommandError({
            tag: "backend-error",
            category: "durability",
            message: "Committed but durability uncertain: registry replacement",
        }),
    },
    {
        path: "string fallback",
        listedName: "game.pgn",
        // Fallback-path coverage: classify() still matches this owned Display literal.
        rejection: new Error("Committed but durability uncertain: registry replacement"),
    },
])(
    "recovers a created PGN listed as $listedName after an uncertain commit via the $path",
    async ({ listedName, rejection }) => {
        const workspace = { id: { id: "workspace" }, kind: "fileWorkspace" } as const;
        const parent = { id: { id: "parent" }, kind: "fileWorkspace" } as const;
        const handle = { id: { id: "created" }, kind: "fileWorkspace" };
        mocks.createWorkspaceFile.mockRejectedValueOnce(rejection);
        mocks.listFileWorkspace.mockResolvedValueOnce([
            {
                handle,
                kind: "file",
                name: listedName,
                children: [],
                metadata: { type: "game", tags: [] },
                gameCount: 1,
                lastModified: 42,
            },
        ]);

        const result = await createFile({
            filename: "game.pgn",
            filetype: "game",
            workspace,
            parent,
        });

        expect(result.isOk).toBe(true);
        expect(result.unwrap()).toMatchObject({ handle, name: listedName, numGames: 1 });
        expect(mocks.listFileWorkspace).toHaveBeenCalledWith(parent);
    },
);

describe("pickPgnFile", () => {
    const handle = { id: { id: "pgn" }, kind: "fileWorkspace" } as const;

    test("returns null on Cancellation without counting games", async () => {
        mocks.issuePgnWorkspace.mockRejectedValueOnce(new Error("Cancellation"));
        await expect(pickPgnFile()).resolves.toBeNull();
        expect(mocks.countPgnGames).not.toHaveBeenCalled();
    });

    test("rejects a permission-denied picker failure without counting games", async () => {
        const error = new Error("permission denied");
        mocks.issuePgnWorkspace.mockRejectedValueOnce(error);
        await expect(pickPgnFile()).rejects.toBe(error);
        expect(mocks.countPgnGames).not.toHaveBeenCalled();
    });

    test("does not treat connection aborted as cancel", async () => {
        const error = new Error("connection aborted");
        mocks.issuePgnWorkspace.mockRejectedValueOnce(error);
        await expect(pickPgnFile()).rejects.toBe(error);
        expect(mocks.countPgnGames).not.toHaveBeenCalled();
    });

    test("returns metadata and counts games on success", async () => {
        mocks.issuePgnWorkspace.mockResolvedValueOnce({
            handle,
            displayName: "games.pgn",
        });
        mocks.countPgnGames.mockResolvedValueOnce(3);
        await expect(pickPgnFile()).resolves.toMatchObject({
            type: "file",
            handle,
            name: "games",
            numGames: 3,
            metadata: { type: "game", tags: [] },
        });
        expect(mocks.countPgnGames).toHaveBeenCalledWith(handle);
    });
});

describe("ensureFileWorkspace", () => {
    const handle = { id: { id: "workspace" }, kind: "fileWorkspace" } as const;

    beforeEach(() => {
        mocks.storeGet.mockReturnValue(null);
    });

    test("returns null on Cancellation without storing a handle", async () => {
        mocks.issueFileWorkspace.mockRejectedValueOnce(new Error("Cancellation"));
        await expect(ensureFileWorkspace()).resolves.toBeNull();
        expect(mocks.storeSet).not.toHaveBeenCalled();
    });

    test("rejects a permission-denied picker failure", async () => {
        const error = new Error("permission denied");
        mocks.issueFileWorkspace.mockRejectedValueOnce(error);
        await expect(ensureFileWorkspace()).rejects.toBe(error);
        expect(mocks.storeSet).not.toHaveBeenCalled();
    });

    test("stores the issued handle on success", async () => {
        mocks.issueFileWorkspace.mockResolvedValueOnce({
            handle,
            displayName: "My Files",
        });
        await expect(ensureFileWorkspace()).resolves.toBe(handle);
        expect(mocks.storeSet).toHaveBeenCalledWith(fileWorkspaceAtom, handle);
        expect(mocks.storeSet).toHaveBeenCalledWith(fileWorkspaceDisplayNameAtom, "My Files");
    });
});
