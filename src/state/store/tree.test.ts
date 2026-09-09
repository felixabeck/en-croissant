import { parseUci } from "chessops";
import { expect, test } from "vitest";
import { createNode, defaultTree, getNodeAtPath, type TreeNode } from "@/utils/treeReducer";
import { createTreeStore } from "./tree";

function node(name: string, children: TreeNode[] = []): TreeNode {
    const result = createNode({
        fen: `${name} w - - 0 1`,
        move: parseUci("e2e4")!,
        san: name,
        halfMoves: 1,
    });
    result.children = children;
    return result;
}

function threeBranchStore() {
    const tree = defaultTree();
    const deepA = node("deep-a");
    const deepB = node("deep-b");
    const deepC = node("deep-c");
    tree.root.children = [node("a", [deepA]), node("b", [deepB]), node("c", [deepC])];
    tree.boardStateMap = {};
    return { store: createTreeStore(undefined, tree), deepA, deepB, deepC };
}

test("deleting a sibling rebases deep cursor and repertoire start to the same nodes", () => {
    const { store, deepB, deepC } = threeBranchStore();
    store.getState().goToMove([2, 0]);
    store.getState().setStart([1, 0]);

    store.getState().deleteMove([0]);

    const state = store.getState();
    expect(state.position).toEqual([1, 0]);
    expect(state.headers.start).toEqual([0, 0]);
    expect(getNodeAtPath(state.root, state.position)).toBe(deepC);
    expect(getNodeAtPath(state.root, state.headers.start!)).toBe(deepB);
    expect(state.boardStateMap["deep-b w - -"][0].path).toEqual([0, 0]);
    expect(state.boardStateMap["deep-c w - -"]).toBeUndefined();
});

test("deleting a target subtree clears only targets inside it", () => {
    const { store, deepA } = threeBranchStore();
    store.getState().goToMove([1, 0]);
    store.getState().setStart([1, 0]);

    store.getState().deleteMove([1]);

    const state = store.getState();
    expect(state.position).toEqual([]);
    expect(state.headers.start).toBeUndefined();
    expect(getNodeAtPath(state.root, [0, 0])).toBe(deepA);
});

test("promoting a sibling rebases unrelated deep cursor and repertoire start by identity", () => {
    const { store, deepA, deepB, deepC } = threeBranchStore();
    store.getState().goToMove([0, 0]);
    store.getState().setStart([1, 0]);

    store.getState().promoteVariation([2]);

    const state = store.getState();
    expect(state.root.children.map((child) => child.fen)).toEqual([
        "c w - - 0 1",
        "a w - - 0 1",
        "b w - - 0 1",
    ]);
    expect(state.position).toEqual([1, 0]);
    expect(state.headers.start).toEqual([2, 0]);
    expect(getNodeAtPath(state.root, state.position)).toBe(deepA);
    expect(getNodeAtPath(state.root, state.headers.start!)).toBe(deepB);
    expect(getNodeAtPath(state.root, [0, 0])).toBe(deepC);
    expect(state.boardStateMap["deep-b w - -"][0].path).toEqual([2, 0]);
    expect(state.boardStateMap["deep-a w - -"]).toBeUndefined();
});
