import { parseUci } from "chessops";
import { INITIAL_FEN, makeFen } from "chessops/fen";
import { makeSan } from "chessops/san";
import { expect, test } from "vitest";
import {
    createNode,
    defaultTree,
    getMemoizedBoardStateMap,
    getNodeAtPath,
    type TreeNode,
} from "@/utils/treeReducer";
import { positionFromFen } from "@/utils/chessops";
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

function nestedPracticePathStore() {
    const grandchildren = (prefix: string) =>
        Array.from({ length: 4 }, (_, index) => {
            const grandchild = node(`${prefix}-${index}`);
            const childCount = prefix === "a" && index === 2 ? 2 : 1;
            grandchild.children = Array.from({ length: childCount }, (_, childIndex) =>
                node(`${prefix}-${index}-${childIndex}`),
            );
            return grandchild;
        });

    const tree = defaultTree();
    tree.root.children = [node("a", grandchildren("a")), node("b", grandchildren("b"))];
    return createTreeStore(undefined, tree);
}

function addMove(parent: TreeNode, uci: string): TreeNode {
    const move = parseUci(uci);
    const [position] = positionFromFen(parent.fen);
    if (!move || !position) throw new Error(`Invalid fixture move: ${uci}`);
    const san = makeSan(position, move);
    if (san === "--") throw new Error(`Illegal fixture move: ${uci}`);
    position.play(move);
    const child = createNode({
        fen: makeFen(position.toSetup()),
        move,
        san,
        halfMoves: parent.halfMoves + 1,
    });
    parent.children.push(child);
    return child;
}

function mainlinePrependStore() {
    const tree = defaultTree();
    const e4 = addMove(tree.root, "e2e4");
    const d4 = addMove(tree.root, "d2d4");

    for (const uci of ["e7e5", "c7c5", "e7e6", "c7c6"]) {
        const reply = addMove(e4, uci);
        const continuations = uci === "e7e5" ? ["g1f3", "f1c4", "b1c3"] : ["g1f3"];
        for (const continuation of continuations) {
            addMove(addMove(reply, continuation), "b8c6");
        }
    }

    for (const uci of ["d7d5", "g8f6", "e7e6", "f7f5"]) {
        addMove(addMove(d4, uci), "c2c4");
    }

    return createTreeStore(undefined, tree);
}

type PracticePathRebasingCase = {
    name: string;
    practicePath: number[];
    mutation: "delete" | "promote";
    mutationPath: number[];
    expectedPath: number[];
} & (
    | { sameNode: true }
    // The clamp and contract-anchor rows resolve to an ancestor on the mutated chain, which Immer
    // clones, so they are checked by the resolved node's san instead of identity.
    | { sameNode: false; expectedSan: string }
);

const practicePathRebasingCases: PracticePathRebasingCase[] = [
    {
        name: "deleting a later sibling leaves the earlier practice path unchanged",
        practicePath: [0, 1, 0],
        mutation: "delete",
        mutationPath: [0, 2],
        expectedPath: [0, 1, 0],
        sameNode: true,
    },
    {
        name: "deleting an earlier sibling shifts the practice path",
        practicePath: [0, 3, 0],
        mutation: "delete",
        mutationPath: [0, 2],
        expectedPath: [0, 2, 0],
        sameNode: true,
    },
    {
        name: "deleting the practiced subtree clamps the practice path to its parent",
        practicePath: [0, 2, 0],
        mutation: "delete",
        mutationPath: [0, 2],
        expectedPath: [0],
        expectedSan: "a",
        sameNode: false,
    },
    {
        name: "promoting the practiced sibling moves its path to the mainline",
        practicePath: [0, 2, 0],
        mutation: "promote",
        mutationPath: [0, 2],
        expectedPath: [0, 0, 0],
        sameNode: true,
    },
    {
        name: "promoting a later sibling shifts the practice path right",
        practicePath: [0, 1, 0],
        mutation: "promote",
        mutationPath: [0, 2],
        expectedPath: [0, 2, 0],
        sameNode: true,
    },
    {
        name: "promoting an earlier sibling leaves the later practice path unchanged",
        practicePath: [0, 3, 0],
        mutation: "promote",
        mutationPath: [0, 1],
        expectedPath: [0, 3, 0],
        sameNode: true,
    },
    {
        name: "deleting under another branch leaves the practice path unchanged",
        practicePath: [1, 3, 0],
        mutation: "delete",
        mutationPath: [0, 2],
        expectedPath: [1, 3, 0],
        sameNode: true,
    },
    {
        name: "promoting under another branch leaves the practice path unchanged",
        practicePath: [1, 2, 0],
        mutation: "promote",
        mutationPath: [0, 2],
        expectedPath: [1, 2, 0],
        sameNode: true,
    },
    {
        name: "deleting a descendant keeps the practice path at its parent (contract anchor)",
        practicePath: [0],
        mutation: "delete",
        mutationPath: [0, 2],
        expectedPath: [0],
        expectedSan: "a",
        sameNode: false,
    },
    {
        name: "promoting a descendant keeps the practice path at its parent (contract anchor)",
        practicePath: [0],
        mutation: "promote",
        mutationPath: [0, 2],
        expectedPath: [0],
        expectedSan: "a",
        sameNode: false,
    },
];

function applyPracticePathCase(testCase: PracticePathRebasingCase) {
    const store = nestedPracticePathStore();
    store.getState().setPracticePath(testCase.practicePath);
    const nodeBeforeMutation = getNodeAtPath(store.getState().root, testCase.practicePath);

    if (testCase.mutation === "delete") store.getState().deleteMove(testCase.mutationPath);
    else store.getState().promoteVariation(testCase.mutationPath);

    const state = store.getState();
    return {
        practicePath: state.practicePath,
        nodeBeforeMutation,
        rebasedNode: getNodeAtPath(state.root, testCase.expectedPath),
    };
}

test.each(practicePathRebasingCases.filter((testCase) => testCase.sameNode))(
    "$name",
    (testCase) => {
        const result = applyPracticePathCase(testCase);
        expect(result.practicePath).toEqual(testCase.expectedPath);
        expect(result.rebasedNode).toBe(result.nodeBeforeMutation);
    },
);

test.each(
    practicePathRebasingCases.filter(
        (testCase): testCase is Extract<PracticePathRebasingCase, { sameNode: false }> =>
            !testCase.sameNode,
    ),
)("$name", (testCase) => {
    const result = applyPracticePathCase(testCase);
    expect(result.practicePath).toEqual(testCase.expectedPath);
    expect(result.rebasedNode.san).toBe(testCase.expectedSan);
});

test("promoteToMainline rebases all tracked paths through multiple promotions", () => {
    const store = nestedPracticePathStore();
    const path = [0, 2, 1];
    store.getState().goToMove(path);
    store.getState().setStart(path);
    store.getState().setPracticePath(path);
    const nodeBeforePromotion = getNodeAtPath(store.getState().root, path);

    store.getState().promoteToMainline(path);

    const state = store.getState();
    expect(state.position).toEqual([0, 0, 0]);
    expect(state.headers.start).toEqual([0, 0, 0]);
    expect(state.practicePath).toEqual([0, 0, 0]);
    expect(getNodeAtPath(state.root, state.position)).toBe(nodeBeforePromotion);
    expect(getNodeAtPath(state.root, state.headers.start!)).toBe(nodeBeforePromotion);
    expect(getNodeAtPath(state.root, state.practicePath!)).toBe(nodeBeforePromotion);
});

test("deleting the practiced node clamps the path and prevents advancing", () => {
    const store = nestedPracticePathStore();
    store.getState().goToMove([0, 2, 0]);
    store.getState().setPracticePath([0, 2, 0]);

    store.getState().deleteMove([0, 2]);

    expect(store.getState().practicePath).toEqual([0]);
    expect(store.getState().position).toEqual([0]);
    expect(getNodeAtPath(store.getState().root, [0]).san).toBe("a");
    expect(getNodeAtPath(store.getState().root, [0]).children.length).toBeGreaterThan(0);

    store.getState().goToNext();

    expect(store.getState().position).toEqual([0]);
});

test.each(["delete", "promote"] as const)("a null practicePath stays null after %s", (mutation) => {
    const store = nestedPracticePathStore();
    store.getState().setPracticePath(null);

    if (mutation === "delete") store.getState().deleteMove([0, 2]);
    else store.getState().promoteVariation([0, 2]);

    expect(store.getState().practicePath).toBeNull();
});

test("a root mainline prepend rebases the repertoire start and practice path", () => {
    const store = mainlinePrependStore();
    store.getState().setStart([0]);
    store.getState().setPracticePath([1, 0]);
    const startNode = getNodeAtPath(store.getState().root, [0]);
    const practiceNode = getNodeAtPath(store.getState().root, [1, 0]);

    store.getState().makeMove({ payload: "c4", mainline: true, changePosition: false });

    const state = store.getState();
    expect(state.headers.start).toEqual([1]);
    expect(getNodeAtPath(state.root, state.headers.start!)).toBe(startNode);
    expect(state.practicePath).toEqual([2, 0]);
    expect(getNodeAtPath(state.root, state.practicePath!)).toBe(practiceNode);
    expect(state.position).toEqual([]);
});

test("a mainline prepend at depth one shifts a repertoire start at child index zero", () => {
    const store = mainlinePrependStore();
    store.getState().goToMove([0]);
    store.getState().setStart([0, 0, 0]);
    const startNode = getNodeAtPath(store.getState().root, [0, 0, 0]);

    store.getState().makeMove({ payload: "d5", mainline: true, changePosition: false });

    const state = store.getState();
    expect(state.headers.start).toEqual([0, 1, 0]);
    expect(getNodeAtPath(state.root, state.headers.start!)).toBe(startNode);
});

test("a mainline prepend rebases a practice path through a later child", () => {
    const store = mainlinePrependStore();
    store.getState().goToMove([0]);
    store.getState().setPracticePath([0, 2, 0]);
    const practiceNode = getNodeAtPath(store.getState().root, [0, 2, 0]);

    store.getState().makeMove({ payload: "d5", mainline: true, changePosition: false });

    const state = store.getState();
    expect(state.practicePath).toEqual([0, 3, 0]);
    expect(getNodeAtPath(state.root, state.practicePath!)).toBe(practiceNode);
});

test("a mainline prepend leaves a tracked path on another root branch unchanged", () => {
    const store = mainlinePrependStore();
    store.getState().goToMove([0]);
    store.getState().setStart([1, 1, 0]);
    const startNode = getNodeAtPath(store.getState().root, [1, 1, 0]);

    store.getState().makeMove({ payload: "d5", mainline: true, changePosition: false });

    const state = store.getState();
    expect(state.headers.start).toEqual([1, 1, 0]);
    expect(getNodeAtPath(state.root, state.headers.start!)).toBe(startNode);
});

test("a mainline prepend leaves a practice path on the insertion parent unchanged", () => {
    const store = mainlinePrependStore();
    store.getState().goToMove([0]);
    store.getState().setPracticePath([0]);
    const practiceSan = getNodeAtPath(store.getState().root, [0]).san;

    store.getState().makeMove({ payload: "d5", mainline: true, changePosition: false });

    const state = store.getState();
    expect(state.practicePath).toEqual([0]);
    // The insertion parent is on the mutated chain, which Immer clones, so identity cannot hold.
    expect(getNodeAtPath(state.root, state.practicePath!).san).toBe(practiceSan);
});

test("a mainline prepend leaves absent start and null practice paths absent", () => {
    const store = mainlinePrependStore();
    store.getState().goToMove([0]);
    store.getState().setPracticePath(null);

    store.getState().makeMove({ payload: "d5", mainline: true, changePosition: false });

    expect(store.getState().headers.start).toBeUndefined();
    expect(store.getState().practicePath).toBeNull();
});

test("a mainline move already present among the children does not rebase tracked paths", () => {
    const store = mainlinePrependStore();
    store.getState().goToMove([0]);
    store.getState().setStart([0, 0, 0]);
    const startNode = getNodeAtPath(store.getState().root, [0, 0, 0]);

    store.getState().makeMove({ payload: "e5", mainline: true, changePosition: false });

    const state = store.getState();
    expect(state.headers.start).toEqual([0, 0, 0]);
    expect(getNodeAtPath(state.root, state.headers.start!)).toBe(startNode);
});

test("a mainline prepend shifts tracked paths at a deeper insertion depth", () => {
    const store = mainlinePrependStore();
    store.getState().goToMove([0, 0]);
    store.getState().setPracticePath([0, 0, 2, 0]);
    const practiceNode = getNodeAtPath(store.getState().root, [0, 0, 2, 0]);

    store.getState().makeMove({ payload: "d4", mainline: true, changePosition: false });

    const state = store.getState();
    expect(state.practicePath).toEqual([0, 0, 3, 0]);
    expect(getNodeAtPath(state.root, state.practicePath!)).toBe(practiceNode);
});

test("a non-mainline append leaves tracked paths unchanged", () => {
    const store = mainlinePrependStore();
    store.getState().goToMove([0]);
    store.getState().setStart([0, 0, 0]);
    store.getState().setPracticePath([0, 2, 0]);
    const startNode = getNodeAtPath(store.getState().root, [0, 0, 0]);
    const practiceNode = getNodeAtPath(store.getState().root, [0, 2, 0]);

    store.getState().makeMove({ payload: "d5", changePosition: false });

    const state = store.getState();
    expect(state.headers.start).toEqual([0, 0, 0]);
    expect(getNodeAtPath(state.root, state.headers.start!)).toBe(startNode);
    expect(state.practicePath).toEqual([0, 2, 0]);
    expect(getNodeAtPath(state.root, state.practicePath!)).toBe(practiceNode);
});

test("a mainline prepend with changePosition selects the new first child", () => {
    const store = mainlinePrependStore();
    store.getState().goToMove([0]);

    store.getState().makeMove({ payload: "d5", mainline: true });

    const state = store.getState();
    expect(state.position).toEqual([0, 0]);
    expect(getNodeAtPath(state.root, state.position).san).toBe("d5");
});

test("a root mainline prepend selects the new move and rebases the old start", () => {
    const store = mainlinePrependStore();
    store.getState().setStart([0]);
    const startNode = getNodeAtPath(store.getState().root, [0]);

    store.getState().makeMove({ payload: "c4", mainline: true });

    const state = store.getState();
    expect(state.position).toEqual([0]);
    expect(getNodeAtPath(state.root, state.position).san).toBe("c4");
    expect(state.headers.start).toEqual([1]);
    expect(getNodeAtPath(state.root, state.headers.start!)).toBe(startNode);
});

test("makeMoves rebases once for the first prepend and selects the final move", () => {
    const store = mainlinePrependStore();
    store.getState().goToMove([0]);
    store.getState().setStart([0, 0, 0]);
    const startNode = getNodeAtPath(store.getState().root, [0, 0, 0]);

    store.getState().makeMoves({ payload: ["d5", "Nf3"], mainline: true });

    const state = store.getState();
    expect(state.headers.start).toEqual([0, 1, 0]);
    expect(getNodeAtPath(state.root, state.headers.start!)).toBe(startNode);
    expect(state.position).toEqual([0, 0, 0]);
    expect(getNodeAtPath(state.root, state.position).san).toBe("Nf3");
});

test("deleteMove rebases the cursor through a later sibling by identity", () => {
    const store = nestedPracticePathStore();
    store.getState().goToMove([0, 3, 0]);
    const nodeBefore = getNodeAtPath(store.getState().root, [0, 3, 0]);

    store.getState().deleteMove([0, 2]);

    const state = store.getState();
    expect(state.position).toEqual([0, 2, 0]);
    expect(getNodeAtPath(state.root, state.position)).toBe(nodeBefore);
});

test("deleteMove rebases the repertoire start through a later sibling by identity", () => {
    const store = nestedPracticePathStore();
    store.getState().setStart([0, 3, 0]);
    const nodeBefore = getNodeAtPath(store.getState().root, [0, 3, 0]);

    store.getState().deleteMove([0, 2]);

    const state = store.getState();
    expect(state.headers.start).toEqual([0, 2, 0]);
    expect(getNodeAtPath(state.root, state.headers.start!)).toBe(nodeBefore);
});

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
    // Both paths resolve in the supplied tree, as parsePGN (every production caller's source)
    // guarantees.
    tree.root.children = [node("a", [node("a-0")]), node("b", [node("b-0"), node("b-1")])];
    tree.headers.start = [1, 1];
    tree.position = [0, 0];
    tree.dirty = true;
    store.getState().setPracticePath([0]);

    store.getState().setState(tree);

    const state = store.getState();
    expect(state.practicePath).toBeNull();
    expect(state.headers.start).toEqual([1, 1]);
    expect(getNodeAtPath(state.root, state.headers.start!).san).toBe("b-1");
    expect(getNodeAtPath(state.root, state.position).san).toBe("a-0");
    expect(state.root).toBe(tree.root);
    expect(state.headers).toBe(tree.headers);
    expect(state.position).toEqual(tree.position);
    expect(state.dirty).toBe(tree.dirty);
    expect(state.report).toBe(tree.report);
});

test("reset clears practicePath and the start path", () => {
    const tree = defaultTree();
    tree.root.children = [node("old-root-child", [node("old-grandchild")])];
    tree.headers.start = [0, 0];
    const store = createTreeStore(undefined, tree);
    store.getState().setPracticePath([0, 0]);

    store.getState().reset();

    expect(store.getState().practicePath).toBeNull();
    expect(store.getState().headers.start).toBeUndefined();
});
