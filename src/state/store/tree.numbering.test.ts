import { afterEach, expect, test } from "vitest";
import { serializeStorageValue } from "./debouncedStorage";
import { TREE_STORAGE_VERSION } from "./tabStorage";
import { closeTreeStore, createTreeStore } from "./tree";
import { createNode, defaultTree } from "@/utils/treeReducer";
import { parseUci } from "chessops";

const id = "custom-numbering-hydration";

afterEach(() => {
    closeTreeStore(id);
    sessionStorage.removeItem(id);
});

test("hydration repairs legacy relative ply values throughout a custom-start tree", () => {
    const tree = defaultTree("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 23");
    const child = createNode({
        fen: "rnbqkbnr/pppp1ppp/8/4p3/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 24",
        move: parseUci("e7e5")!,
        san: "e5",
        halfMoves: 2,
    });
    child.children.push(
        createNode({
            fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 24",
            move: parseUci("e2e4")!,
            san: "e4",
            halfMoves: 3,
        }),
    );
    tree.root.halfMoves = 1;
    tree.root.children.push(child);
    sessionStorage.setItem(
        id,
        serializeStorageValue({ version: TREE_STORAGE_VERSION, state: tree }),
    );

    const hydrated = createTreeStore(id).getState();

    expect(hydrated.root.halfMoves).toBe(45);
    expect(hydrated.root.children[0].halfMoves).toBe(46);
    expect(hydrated.root.children[0].children[0].halfMoves).toBe(47);
});
