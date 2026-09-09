import { parseUci } from "chessops";
import { afterEach, expect, test } from "vitest";
import { createNode, defaultTree } from "@/utils/treeReducer";
import { serializeStorageValue } from "./debouncedStorage";
import { tabStorage, TREE_STORAGE_VERSION } from "./tabStorage";
import { closeTreeStore, createTreeStore } from "./tree";

const ids: string[] = [];

afterEach(() => {
    for (const id of ids.splice(0)) {
        closeTreeStore(id);
        tabStorage.remove(id);
    }
});

test.each([0, TREE_STORAGE_VERSION])(
    "restores saved moves and metadata from a version %i tree envelope",
    (version) => {
        const id = `tree-hydration-version-${version}`;
        ids.push(id);
        const saved = defaultTree();
        saved.headers.event = "Saved game";
        saved.position = [0];
        const child = createNode({
            fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
            move: parseUci("e2e4")!,
            san: "e4",
            halfMoves: 1,
        });
        child.comment = "Saved annotation";
        saved.root.children.push(child);
        sessionStorage.setItem(id, serializeStorageValue({ version, state: saved }));

        const restored = createTreeStore(id).getState();

        expect(restored.headers.event).toBe("Saved game");
        expect(restored.position).toEqual([0]);
        expect(restored.root.children).toHaveLength(1);
        expect(restored.root.children[0]).toMatchObject({
            san: "e4",
            comment: "Saved annotation",
            halfMoves: 1,
        });
    },
);
