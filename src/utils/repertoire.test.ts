import { describe, beforeEach, expect, test, vi } from "vitest";
import type { DatabaseHandle } from "@/bindings";
import { parseUci } from "chessops";
import { createNode, defaultTree, normalizeTreeHalfMoves, type TreeNode } from "./treeReducer";

const mocks = vi.hoisted(() => ({ searchPosition: vi.fn() }));
vi.mock("./db", () => ({ searchPosition: mocks.searchPosition }));

import { fetchPositionMoves, findBiggestGap } from "./repertoire";

const database: DatabaseHandle = { id: { id: "db" }, kind: "database" };

beforeEach(() => vi.clearAllMocks());

test("native cancellation propagates even when the renderer signal itself was not aborted", async () => {
    mocks.searchPosition.mockRejectedValue({
        tag: "backend-error",
        category: "cancellation",
        message: "native owner cancelled",
    });
    const signal = new AbortController().signal;
    await expect(fetchPositionMoves(database, "fen", signal)).rejects.toMatchObject({
        category: "cancellation",
    });
    expect(signal.aborted).toBe(false);
});

test("renderer cancellation never becomes empty repertoire success", async () => {
    const controller = new AbortController();
    const failure = new DOMException("Cancellation", "AbortError");
    mocks.searchPosition.mockImplementation(async () => {
        controller.abort();
        throw failure;
    });
    await expect(fetchPositionMoves(database, "fen", controller.signal)).rejects.toBe(failure);
});

test("ordinary search failure rejects instead of publishing empty full coverage", async () => {
    const failure = new Error("database unavailable");
    mocks.searchPosition.mockRejectedValue(failure);
    await expect(fetchPositionMoves(database, "fen")).rejects.toBe(failure);
});

describe("findBiggestGap", () => {
    const TEST_MOVES = {
        e4: {
            san: "e4",
            uci: "e2e4",
            fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
        },
        e5: {
            san: "e5",
            uci: "e7e5",
            fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
        },
        c5: {
            san: "c5",
            uci: "c7c5",
            fen: "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
        },
        Nf3: {
            san: "Nf3",
            uci: "g1f3",
            fen: "rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2",
        },
        d6: {
            san: "d6",
            uci: "d7d6",
            fen: "rnbqkbnr/pp2pppp/3p4/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3",
        },
        d4: {
            san: "d4",
            uci: "d2d4",
            fen: "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1",
        },
    } as const;

    type TestMoveKey = keyof typeof TEST_MOVES;

    function createTestNode(key: TestMoveKey): TreeNode {
        const { san, uci, fen } = TEST_MOVES[key];
        return createNode({
            fen,
            move: parseUci(uci)!,
            san,
            halfMoves: 0,
        });
    }

    function buildStandardLineTree(): { root: TreeNode; nodeE4: TreeNode; nodeE5: TreeNode } {
        const root = defaultTree().root;
        const nodeE4 = createTestNode("e4");
        const nodeE5 = createTestNode("e5");
        nodeE4.children.push(nodeE5);
        root.children.push(nodeE4);
        normalizeTreeHalfMoves(root);
        return { root, nodeE4, nodeE5 };
    }

    function toPathMap(entries: Record<string, number>): Map<string, number> {
        return new Map(Object.entries(entries));
    }

    function createPathMaps(maps: {
        coverage?: Record<string, number>;
        games?: Record<string, number>;
        missing?: Record<string, number>;
    }) {
        return {
            coverageMap: toPathMap(maps.coverage ?? {}),
            gamesMap: toPathMap(maps.games ?? {}),
            missingGamesMap: toPathMap(maps.missing ?? {}),
        };
    }

    test("larger opponent missing count beats smaller descendant", () => {
        const { root } = buildStandardLineTree();
        const { coverageMap, gamesMap, missingGamesMap } = createPathMaps({
            coverage: { "": 0.5, "0": 0.5, "0,0": 0 },
            games: { "": 100, "0": 100, "0,0": 20 },
            missing: { "": 0, "0": 80, "0,0": 20 },
        });

        const result = findBiggestGap(root, "white", coverageMap, gamesMap, missingGamesMap, 10);
        expect(result).toEqual([0]);
    });

    test("larger descendant wins conversely", () => {
        const { root } = buildStandardLineTree();
        const { coverageMap, gamesMap, missingGamesMap } = createPathMaps({
            coverage: { "": 0.5, "0": 0.5, "0,0": 0 },
            games: { "": 100, "0": 100, "0,0": 80 },
            missing: { "": 0, "0": 20, "0,0": 80 },
        });

        const result = findBiggestGap(root, "white", coverageMap, gamesMap, missingGamesMap, 10);
        expect(result).toEqual([0, 0]);
    });

    test("shorter path wins equal counts and traversal order breaks equal-length ties", () => {
        const root = defaultTree().root;
        const nodeE4 = createTestNode("e4");
        const nodeE5 = createTestNode("e5");
        const nodeC5 = createTestNode("c5");
        nodeE4.children.push(nodeE5, nodeC5);
        root.children.push(nodeE4);
        normalizeTreeHalfMoves(root);

        // 1. Shorter path wins between opponent parent [0] and child [0, 0] when counts are equal
        const coverageMap = toPathMap({
            "": 0.5,
            "0": 0.5,
            "0,0": 0,
            "0,1": 0,
        });
        const gamesMap = toPathMap({
            "": 100,
            "0": 100,
            "0,0": 50,
            "0,1": 50,
        });
        const missingEqualParent = toPathMap({
            "": 0,
            "0": 50,
            "0,0": 50,
            "0,1": 30,
        });
        expect(
            findBiggestGap(root, "white", coverageMap, gamesMap, missingEqualParent, 10),
        ).toEqual([0]);

        // 2. Traversal order breaks equal-length ties between siblings [0, 0] and [0, 1]
        const missingEqualSiblings = toPathMap({
            "": 0,
            "0": 10,
            "0,0": 50,
            "0,1": 50,
        });
        expect(
            findBiggestGap(root, "white", coverageMap, gamesMap, missingEqualSiblings, 10),
        ).toEqual([0, 0]);
    });

    test("scoped startPath remains strictly excluded", () => {
        const { root } = buildStandardLineTree();
        const { coverageMap, gamesMap, missingGamesMap } = createPathMaps({
            coverage: { "": 0.5, "0": 0.5, "0,0": 0 },
            games: { "": 200, "0": 200, "0,0": 30 },
            missing: { "": 0, "0": 200, "0,0": 30 },
        });

        // When startPath is [0], node [0] is the start node and must be strictly excluded
        const result = findBiggestGap(
            root,
            "white",
            coverageMap,
            gamesMap,
            missingGamesMap,
            10,
            [0],
        );
        expect(result).toEqual([0, 0]);

        // If the descendant has full coverage, result is null (start node still excluded)
        const coveredDescendantMap = toPathMap({
            "": 0.5,
            "0": 0.5,
            "0,0": 1,
        });
        expect(
            findBiggestGap(root, "white", coveredDescendantMap, gamesMap, missingGamesMap, 10, [0]),
        ).toBeNull();
    });

    test("supports black orientation where white moves are opponent turns", () => {
        // Standard start FEN (halfMoves: 0, White turn). User is black.
        const root = defaultTree().root;
        // [0]: 1. e4 (halfMoves: 1, Black turn = user turn)
        const nodeE4 = createTestNode("e4");
        // [0, 0]: 1... c5 (halfMoves: 2, White turn = opponent turn)
        const nodeC5 = createTestNode("c5");
        // [0, 0, 0]: 2. Nf3 (halfMoves: 3, Black turn = user leaf)
        const nodeNf3 = createTestNode("Nf3");

        nodeC5.children.push(nodeNf3);
        nodeE4.children.push(nodeC5);
        root.children.push(nodeE4);
        normalizeTreeHalfMoves(root);

        const coverageMap = toPathMap({
            "": 0.5,
            "0": 0.5,
            "0,0": 0.5,
            "0,0,0": 0,
        });
        const gamesMap = toPathMap({
            "": 100,
            "0": 100,
            "0,0": 100,
            "0,0,0": 40,
        });

        // Case 1: Larger opponent missing count beats descendant
        const missingOpponentWins = toPathMap({
            "": 0,
            "0": 0,
            "0,0": 90,
            "0,0,0": 40,
        });
        expect(
            findBiggestGap(root, "black", coverageMap, gamesMap, missingOpponentWins, 10),
        ).toEqual([0, 0]);

        // Case 2: Larger descendant missing count wins conversely
        const missingDescendantWins = toPathMap({
            "": 0,
            "0": 0,
            "0,0": 20,
            "0,0,0": 80,
        });
        expect(
            findBiggestGap(root, "black", coverageMap, gamesMap, missingDescendantWins, 10),
        ).toEqual([0, 0, 0]);
    });

    test("anchors halfMoves correctly on black-to-move custom start FEN with black orientation", () => {
        // Custom start: 1. e4 played, Black to move (root halfMoves = 1)
        const btmFen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
        const root = defaultTree(btmFen).root;
        expect(root.halfMoves).toBe(1);

        // Orientation is black (user turn at root: Black)
        // [0]: 1... c5 (halfMoves: 2, White turn = opponent turn)
        // [0, 0]: 2. Nf3 (halfMoves: 3, Black turn = user leaf)
        const nodeC5 = createTestNode("c5");
        const nodeNf3 = createTestNode("Nf3");
        nodeC5.children.push(nodeNf3);
        root.children.push(nodeC5);
        normalizeTreeHalfMoves(root);

        const { coverageMap, gamesMap, missingGamesMap } = createPathMaps({
            coverage: { "": 0.5, "0": 0.5, "0,0": 0 },
            games: { "": 100, "0": 100, "0,0": 25 },
            missing: { "": 0, "0": 70, "0,0": 25 },
        });

        expect(findBiggestGap(root, "black", coverageMap, gamesMap, missingGamesMap, 10)).toEqual([
            0,
        ]);
    });

    test("anchors halfMoves correctly on black-to-move custom start FEN with white orientation", () => {
        // Custom start: 1. e4 played, Black to move (root halfMoves = 1)
        // Fresh tree for white orientation
        const btmFen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
        const root = defaultTree(btmFen).root;
        expect(root.halfMoves).toBe(1);

        // Orientation is white (opponent turn at root: Black)
        // [0]: 1... c5 (halfMoves: 2, White turn = user turn)
        // [0, 0]: 2. Nf3 (halfMoves: 3, Black turn = opponent turn)
        // [0, 0, 0]: 2... d6 (halfMoves: 4, White turn = user leaf)
        const nodeC5 = createTestNode("c5");
        const nodeNf3 = createTestNode("Nf3");
        const nodeD6 = createTestNode("d6");
        nodeNf3.children.push(nodeD6);
        nodeC5.children.push(nodeNf3);
        root.children.push(nodeC5);
        normalizeTreeHalfMoves(root);

        const { coverageMap, gamesMap, missingGamesMap } = createPathMaps({
            coverage: { "": 0.5, "0": 0.5, "0,0": 0.5, "0,0,0": 0 },
            games: { "": 100, "0": 100, "0,0": 100, "0,0,0": 30 },
            missing: { "": 0, "0": 0, "0,0": 85, "0,0,0": 30 },
        });

        expect(findBiggestGap(root, "white", coverageMap, gamesMap, missingGamesMap, 10)).toEqual([
            0, 0,
        ]);
    });

    test("prunes subtrees when games < minGames even with high missing count underneath and selects eligible sibling", () => {
        const root = defaultTree().root;
        const nodeE4 = createTestNode("e4");
        const nodeE5 = createTestNode("e5");
        const nodeD4 = createTestNode("d4");

        nodeE4.children.push(nodeE5);
        root.children.push(nodeE4, nodeD4);
        normalizeTreeHalfMoves(root);

        const { coverageMap, gamesMap, missingGamesMap } = createPathMaps({
            coverage: { "": 0.5, "0": 0.5, "0,0": 0, "1": 0.5 },
            games: { "": 100, "0": 5, "0,0": 100, "1": 50 },
            missing: { "": 0, "0": 200, "0,0": 500, "1": 30 },
        });

        // node [0] has 5 games < minGames 10; neither it nor child [0,0] (missing 500)
        // should be visited or selected. Sibling [1] is eligible and must be chosen.
        const result = findBiggestGap(root, "white", coverageMap, gamesMap, missingGamesMap, 10);
        expect(result).toEqual([1]);
    });

    test("treats games === minGames as eligible at the boundary", () => {
        const root = defaultTree().root;
        const nodeE4 = createTestNode("e4");
        const nodeD4 = createTestNode("d4");
        root.children.push(nodeE4, nodeD4);
        normalizeTreeHalfMoves(root);

        const { coverageMap, gamesMap, missingGamesMap } = createPathMaps({
            coverage: { "": 0.5, "0": 0.5, "1": 0.5 },
            games: { "": 100, "0": 10, "1": 50 },
            missing: { "": 0, "0": 60, "1": 20 },
        });

        // node [0] has exactly games === minGames (10), so it must not be pruned.
        // With higher missing count (60 > 20), [0] must win over [1].
        const result = findBiggestGap(root, "white", coverageMap, gamesMap, missingGamesMap, 10);
        expect(result).toEqual([0]);
    });

    test("prunes fully covered intermediate subtrees even when descendants have missing games, selecting eligible sibling", () => {
        const root = defaultTree().root;
        const nodeE4 = createTestNode("e4");
        const nodeE5 = createTestNode("e5");
        const nodeD4 = createTestNode("d4");

        nodeE4.children.push(nodeE5);
        root.children.push(nodeE4, nodeD4);
        normalizeTreeHalfMoves(root);

        const { coverageMap, gamesMap, missingGamesMap } = createPathMaps({
            coverage: { "": 0.5, "0": 1.0, "0,0": 0, "1": 0.5 },
            games: { "": 100, "0": 100, "0,0": 50, "1": 50 },
            missing: { "": 0, "0": 0, "0,0": 500, "1": 25 },
        });

        // node [0] is fully covered (coverage === 1.0); intermediate pruning must prevent
        // traversal into [0,0] despite missing count 500. Sibling [1] must be selected.
        const result = findBiggestGap(root, "white", coverageMap, gamesMap, missingGamesMap, 10);
        expect(result).toEqual([1]);
    });

    test("structurally excludes prepared non-leaf user nodes even when map supplies a large missing count", () => {
        // Production normally assigns missing count zero to prepared/non-leaf user nodes;
        // this test verifies selector-contract coverage that non-leaf user nodes are structurally
        // ineligible as gaps even if a supplied map carries an artificial missing count (not a claimed production defect).
        const root = defaultTree().root;
        const nodeE4 = createTestNode("e4");
        const nodeC5 = createTestNode("c5");
        const nodeNf3 = createTestNode("Nf3");

        nodeC5.children.push(nodeNf3);
        nodeE4.children.push(nodeC5);
        root.children.push(nodeE4);
        normalizeTreeHalfMoves(root);

        // In white orientation:
        // [0] (1. e4, halfMoves 1): opponent turn -> gap eligible
        // [0, 0] (1... c5, halfMoves 2): user turn with children -> prepared non-leaf user node, structurally NOT a gap
        // [0, 0, 0] (2. Nf3, halfMoves 3): opponent turn -> gap eligible
        const { coverageMap, gamesMap, missingGamesMap } = createPathMaps({
            coverage: { "": 0.5, "0": 0.5, "0,0": 0.5, "0,0,0": 0 },
            games: { "": 100, "0": 100, "0,0": 100, "0,0,0": 50 },
            missing: { "": 0, "0": 5, "0,0": 999, "0,0,0": 15 },
        });

        const result = findBiggestGap(root, "white", coverageMap, gamesMap, missingGamesMap, 10);
        expect(result).toEqual([0, 0, 0]);
    });
});
