import { parseUci } from "chessops";
import { afterEach, expect, test } from "vitest";
import {
    createNode,
    defaultTree,
    getBoardState,
    getMemoizedBoardStateMap,
} from "@/utils/treeReducer";
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

test("rehydration repairs stale paths before deriving the whole-tree board map", () => {
    const id = "tree-hydration-stale-paths";
    ids.push(id);
    const saved = defaultTree();
    saved.position = [0, 0, 5];
    saved.headers.start = [0, 5];

    const e4 = createNode({
        fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
        move: parseUci("e2e4")!,
        san: "e4",
        halfMoves: 1,
    });
    const e5 = createNode({
        fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
        move: parseUci("e7e5")!,
        san: "e5",
        halfMoves: 2,
    });
    e4.children.push(e5);
    const d4 = createNode({
        fen: "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1",
        move: parseUci("d2d4")!,
        san: "d4",
        halfMoves: 1,
    });
    saved.root.children.push(e4, d4);
    sessionStorage.setItem(
        id,
        serializeStorageValue({ version: TREE_STORAGE_VERSION, state: saved }),
    );

    const restored = createTreeStore(id).getState();

    expect(restored.headers.start).toBeUndefined();
    expect(restored.position).toEqual([0, 0]);
    const map = getMemoizedBoardStateMap(restored.root, restored.headers.start ?? []);
    expect(map[getBoardState(d4.fen)]?.map(({ path }) => path)).toEqual([[1]]);
    expect(Object.values(map).flat()).toHaveLength(4);
});
