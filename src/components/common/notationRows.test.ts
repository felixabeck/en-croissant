import { parseUci } from "chessops";
import { describe, expect, test } from "vitest";
import {
    buildNotationRows,
    NOTATION_ROW_MAX_MOVES,
    pathForNotationNode,
    type NotationRow,
} from "./notationRows";
import { createNode, defaultTree, getNodeAtPath, type TreeNode } from "@/utils/treeReducer";

function node(san: string, halfMoves: number): TreeNode {
    return createNode({
        fen: `${san} w - - 0 1`,
        move: parseUci("e2e4")!,
        san,
        halfMoves,
    });
}

function variedTree() {
    const root = defaultTree().root;
    const e4 = node("e4", 1);
    const e5 = node("e5", 2);
    const d4 = node("d4", 1);
    const c5 = node("c5", 2);
    const nf3 = node("Nf3", 3);
    const nc6 = node("Nc6", 4);
    const bb5 = node("Bb5", 5);
    const a6 = node("a6", 6);
    root.children = [e4, d4];
    e4.children = [e5, c5];
    e5.children = [nf3];
    nf3.children = [nc6];
    nc6.children = [bb5];
    bb5.children = [a6];
    return { root, e4, e5, d4, c5, nf3, nc6, bb5, a6 };
}

function moveNames(rows: NotationRow[]) {
    return rows.flatMap((row) => {
        if (row.type === "moves") return row.moves.map((move) => move.node.san);
        if (row.type === "table") {
            return [row.white?.node.san, row.black?.node.san].filter(
                (san): san is string => san !== undefined,
            );
        }
        return [];
    });
}

describe("buildNotationRows", () => {
    test("renders mainline and nested variations in order", () => {
        const tree = variedTree();
        const result = buildNotationRows(tree.root, {
            showVariations: true,
            showComments: true,
            tableView: false,
        });

        expect(moveNames(result.rows)).toEqual(["e4", "d4", "e5", "c5", "Nf3", "Nc6", "Bb5", "a6"]);
        expect(result.rows.filter((row) => row.type === "variation")).toHaveLength(2);
        expect(
            result.rows.filter((row) => row.type === "variation").map((row) => row.parent),
        ).toEqual([tree.root, tree.e4]);
    });

    test("honours comment and variation visibility", () => {
        const tree = variedTree();
        tree.root.comment = "root";
        tree.e4.comment = "after e4";

        const hidden = buildNotationRows(tree.root, {
            showVariations: false,
            showComments: false,
            tableView: false,
        });
        expect(moveNames(hidden.rows)).toEqual(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6"]);
        expect(hidden.rows.some((row) => row.type === "comment")).toBe(false);

        const shown = buildNotationRows(tree.root, {
            showVariations: true,
            showComments: true,
            tableView: false,
        });
        expect(
            shown.rows.filter((row) => row.type === "comment").map((row) => row.comment),
        ).toEqual(["root"]);
        expect(moveNames(shown.rows)).toContain("e4");
        expect(tree.e4.comment).toBe("after e4");
        const collapsed = buildNotationRows(tree.root, {
            showVariations: true,
            showComments: true,
            tableView: false,
            collapsedVariations: new Set([tree.e4]),
        });
        expect(moveNames(collapsed.rows)).not.toContain("c5");
        expect(collapsed.rows.some((row) => row.type === "variation")).toBe(true);
    });

    test("splits long runs at the named boundary", () => {
        const root = defaultTree().root;
        let parent = root;
        for (let index = 1; index <= NOTATION_ROW_MAX_MOVES * 2 + 1; index += 1) {
            const child = node(`m${index}`, index);
            parent.children = [child];
            parent = child;
        }

        const rows = buildNotationRows(root, {
            showVariations: false,
            showComments: false,
            tableView: false,
        }).rows.filter((row) => row.type === "moves");
        expect(rows.map((row) => row.moves.length)).toEqual([
            NOTATION_ROW_MAX_MOVES,
            NOTATION_ROW_MAX_MOVES,
            1,
        ]);
    });

    test("table rows preserve split rows and ellipses around comments and variations", () => {
        const tree = variedTree();
        tree.e4.comment = "white comment";
        const result = buildNotationRows(tree.root, {
            showVariations: true,
            showComments: true,
            tableView: true,
        });
        const tableRows = result.rows.filter((row) => row.type === "table");
        expect(tableRows[0]).toMatchObject({ moveNumber: 1, splitRow: true });
        expect(tableRows[0].white?.node).toBe(tree.e4);
        expect(tableRows[0].black).toBeNull();
        expect(result.rows.some((row) => row.type === "variation")).toBe(true);
        expect(tableRows.some((row) => row.black?.node === tree.e5)).toBe(true);
    });

    test("anchors black-to-move numbering to halfMoves", () => {
        const root = defaultTree("8/8/8/8/8/8/8/K6k b - - 0 23").root;
        const blackMove = node("...Kh7", root.halfMoves + 1);
        root.children = [blackMove];
        const rows = buildNotationRows(root, {
            showVariations: false,
            showComments: false,
            tableView: false,
        }).rows;
        expect(rows[0]).toMatchObject({ type: "moves" });
        expect((rows[0] as Extract<NotationRow, { type: "moves" }>).moves[0].first).toBe(true);
        expect(blackMove.halfMoves).toBe(46);
    });

    test("reconstructs every varied-tree path without storing paths on tokens", () => {
        const tree = variedTree();
        const result = buildNotationRows(tree.root, {
            showVariations: true,
            showComments: true,
            tableView: false,
        });
        const expected = new Map<TreeNode, number[]>();
        const stack: { node: TreeNode; path: number[] }[] = [{ node: tree.root, path: [] }];
        while (stack.length > 0) {
            const item = stack.pop()!;
            expected.set(item.node, item.path);
            for (let index = item.node.children.length - 1; index >= 0; index -= 1) {
                stack.push({ node: item.node.children[index], path: [...item.path, index] });
            }
        }
        for (const [node, path] of expected) {
            expect(pathForNotationNode(result.index, node)).toEqual(path);
        }
        const tokens = result.rows.flatMap((row) => (row.type === "moves" ? row.moves : []));
        expect(tokens.every((move) => !Object.hasOwn(move, "path"))).toBe(true);
        expect(getNodeAtPath(tree.root, pathForNotationNode(result.index, tree.c5)!)).toBe(tree.c5);
    });

    test("builds a 25,000-ply line iteratively", () => {
        const root = defaultTree().root;
        let parent = root;
        for (let index = 1; index <= 25_000; index += 1) {
            const child = node(`ply-${index}`, index);
            parent.children = [child];
            parent = child;
        }
        const result = buildNotationRows(root, {
            showVariations: false,
            showComments: false,
            tableView: false,
        });
        expect(result.rows.filter((row) => row.type === "moves").length).toBeGreaterThan(700);
        expect(result.rows.some((row) => row.type === "moves" && "path" in row.moves[0])).toBe(
            false,
        );
    });
});
