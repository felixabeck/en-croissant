import { parseUci } from "chessops";
import { INITIAL_FEN } from "chessops/fen";
import { expect, test } from "vitest";
import {
    createNode,
    defaultTree,
    getMemoizedBoardStateMap,
    getNodeAtPath,
    type TreeNode,
} from "@/utils/treeReducer";
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
    const boardStateMap = getMemoizedBoardStateMap(state.root, state.headers.start ?? []);
    expect(boardStateMap["deep-b w - -"][0].path).toEqual([0, 0]);
    expect(boardStateMap["deep-c w - -"]).toBeUndefined();
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
    const boardStateMap = getMemoizedBoardStateMap(state.root, state.headers.start ?? []);
    expect(boardStateMap["deep-b w - -"][0].path).toEqual([2, 0]);
    expect(boardStateMap["deep-a w - -"]).toBeUndefined();
});

test("setFen stores the normalized FEN from the installed root", () => {
    const store = createTreeStore();
    // The padded input pins the normalization contract; validating callers do not reach this case.
    store.getState().setFen(` ${INITIAL_FEN} `);

    const state = store.getState();
    expect(state.root.fen).toBe(INITIAL_FEN);
    expect(state.headers.fen).toBe(state.root.fen);
});

test("setFen with an empty FEN installs the default root and clears old paths", () => {
    const tree = defaultTree();
    tree.root.children = [node("old-root-child")];
    tree.position = [0];
    tree.headers.start = [0];
    const store = createTreeStore(undefined, tree);
    store.getState().setPracticePath([0]);

    store.getState().setFen("");

    const state = store.getState();
    expect(state.root.fen).toBe(INITIAL_FEN);
    expect(state.headers.fen).toBe(state.root.fen);
    expect(state.headers.start).toBeUndefined();
    expect(state.practicePath).toBeNull();
    expect(state.position).toEqual([]);
});

test("setFen clears paths into the replaced root", () => {
    const tree = defaultTree();
    tree.root.children = [node("old-root-child")];
    tree.position = [0];
    tree.headers.start = [0];
    const store = createTreeStore(undefined, tree);
    store.getState().setPracticePath([0]);

    const fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
    store.getState().setFen(fen);

    const state = store.getState();
    expect(state.headers.fen).toBe(state.root.fen);
    expect(state.headers.start).toBeUndefined();
    expect(state.practicePath).toBeNull();
    expect(state.position).toEqual([]);
});

test("editing headers after setFen keeps the installed position", () => {
    const store = createTreeStore();
    const fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";

    store.getState().setFen(fen);
    const installedRoot = store.getState().root;
    store.getState().setHeaders({ ...store.getState().headers, event: "x" });

    expect(store.getState().root).toBe(installedRoot);
    expect(store.getState().root.fen).toBe(fen);
});

test("setHeaders installing a new FEN clears paths into the replaced root", () => {
    const tree = defaultTree();
    tree.root.children = [node("old-root-child")];
    tree.position = [0];
    tree.headers.start = [0];
    const store = createTreeStore(undefined, tree);
    store.getState().setPracticePath([0]);
    const fen = "rnbqkbnr/ppppkppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2";

    store.getState().setHeaders({ ...store.getState().headers, fen });

    const state = store.getState();
    expect(state.headers.fen).toBe(state.root.fen);
    expect(state.headers.fen).toBe(fen);
    expect(state.headers.start).toBeUndefined();
    expect(state.practicePath).toBeNull();
    expect(state.position).toEqual([]);
});

test("editing headers after a padded setHeaders FEN keeps the moved tree", () => {
    const store = createTreeStore();
    // The padded input pins the normalization contract; validating callers do not reach this case.
    store.getState().setHeaders({
        ...store.getState().headers,
        fen: ` ${INITIAL_FEN} `,
    });
    store.getState().makeMove({ payload: parseUci("e2e4")! });
    const rootAfterMove = store.getState().root;
    const e4Node = rootAfterMove.children[0];

    store.getState().setHeaders({ ...store.getState().headers, event: "x" });

    expect(store.getState().root).toBe(rootAfterMove);
    expect(store.getState().root.children[0]).toBe(e4Node);
});

test("setHeaders with an unchanged FEN preserves tracked paths", () => {
    const tree = defaultTree();
    tree.headers.start = [0];
    const store = createTreeStore(undefined, tree);
    store.getState().setPracticePath([1, 0]);

    store.getState().setHeaders({ ...store.getState().headers, orientation: "black" });

    expect(store.getState().headers.start).toEqual([0]);
    expect(store.getState().practicePath).toEqual([1, 0]);
});

test("setState clears practicePath and keeps the supplied start path", () => {
    const store = createTreeStore();
    const tree = defaultTree();
    tree.headers.start = [1, 2];
    tree.position = [0, 1];
    tree.dirty = true;
    store.getState().setPracticePath([0]);

    store.getState().setState(tree);

    const state = store.getState();
    expect(state.practicePath).toBeNull();
    expect(state.headers.start).toEqual([1, 2]);
    expect(state.root).toBe(tree.root);
    expect(state.headers).toBe(tree.headers);
    expect(state.position).toEqual(tree.position);
    expect(state.dirty).toBe(tree.dirty);
    expect(state.report).toBe(tree.report);
});

test("reset clears practicePath", () => {
    const store = createTreeStore();
    store.getState().setPracticePath([0, 1]);

    store.getState().reset();

    expect(store.getState().practicePath).toBeNull();
});
