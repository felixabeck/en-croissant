import { expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    createWorkspaceFile: vi.fn(),
    listFileWorkspace: vi.fn(),
}));

vi.mock("@/platform/tauri", () => ({ tauri: mocks }));

import { createFile } from "./files";

test.each(["game", "game.pgn"])(
    "recovers a created PGN listed as %s after an uncertain commit",
    async (listedName) => {
        const workspace = { id: { id: "workspace" }, kind: "fileWorkspace" } as const;
        const parent = { id: { id: "parent" }, kind: "fileWorkspace" } as const;
        const handle = { id: { id: "created" }, kind: "fileWorkspace" };
        mocks.createWorkspaceFile.mockRejectedValueOnce(
            new Error("Committed but durability uncertain: registry replacement"),
        );
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
