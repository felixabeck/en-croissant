import type { DrawShape } from "@lichess-org/chessground/draw";
import type { Move } from "chessops";
import { INITIAL_FEN } from "chessops/fen";
import type { Outcome, Score } from "@/bindings";
import type { Annotation } from "./annotation";
import { positionFromFen } from "./chessops";

export interface TreeState {
    root: TreeNode;
    headers: GameHeaders;
    position: number[];
    dirty: boolean;
    report: ReportState;
    boardStateMap: Record<string, { node: TreeNode; path: number[] }[]>;
}

export interface TreeNode {
    fen: string;
    move: Move | null;
    san: string | null;
    children: TreeNode[];
    score: Score | null;
    depth: number | null;
    halfMoves: number;
    shapes: DrawShape[];
    annotations: Annotation[];
    comment: string;
    clock?: number;
}

export type ListNode = {
    position: number[];
    node: TreeNode;
};

export function* treeIterator(node: TreeNode): Generator<ListNode> {
    const stack: ListNode[] = [{ position: [], node }];
    while (stack.length > 0) {
        const { position, node } = stack.pop()!;
        yield { position, node };
        for (let i = node.children.length - 1; i >= 0; i--) {
            stack.push({ position: [...position, i], node: node.children[i] });
        }
    }
}

/**
 * Resolves a position in a repertoire tree. `[]` is deliberately reserved for
 * the root node; callers must treat `undefined` as a removed or unknown card.
 */
export function findFen(fen: string, node: TreeNode): number[] | undefined {
    const iterator = treeIterator(node);
    for (const item of iterator) {
        if (item.node.fen === fen) {
            return item.position;
        }
    }
    return undefined;
}

export function* treeIteratorMainLine(node: TreeNode): Generator<ListNode> {
    let currentNode: TreeNode | undefined = node;
    let position: number[] = [];
    while (currentNode) {
        yield { position, node: currentNode };
        currentNode = currentNode.children[0];
        position = [...position, 0];
    }
}

export function countMainPly(node: TreeNode): number {
    let count = 0;
    let cur = node;
    while (cur.children.length > 0) {
        count++;
        cur = cur.children[0];
    }
    return count;
}

export function defaultTree(fen?: string): TreeState {
    const normalizedFen = fen?.trim() || INITIAL_FEN;
    const [pos] = positionFromFen(normalizedFen);

    return {
        dirty: false,
        position: [],
        root: {
            fen: normalizedFen,
            move: null,
            san: null,
            children: [],
            score: null,
            depth: null,
            halfMoves: pos?.turn === "black" ? 1 : 0,
            shapes: [],
            annotations: [],
            comment: "",
        },
        headers: {
            id: 0,
            fen: normalizedFen,
            black: "",
            white: "",
            result: "*",
            event: "",
            site: "",
        },
        report: {
            inProgress: false,
            operationId: null,
        },
        boardStateMap: {},
    };
}

export function createNode({
    fen,
    move,
    san,
    halfMoves,
    clock,
}: {
    move: Move;
    san: string;
    fen: string;
    halfMoves: number;
    clock?: number;
}): TreeNode {
    return {
        fen,
        move,
        san,
        clock: clock === undefined ? undefined : clock / 1000,
        children: [],
        score: null,
        depth: null,
        halfMoves,
        shapes: [],
        annotations: [],
        comment: "",
    };
}

export type GameHeaders = {
    id: number;
    fen: string;
    event: string;
    site: string;
    date?: string | null;
    time?: string | null;
    round?: string | null;
    white: string;
    white_elo?: number | null;
    black: string;
    black_elo?: number | null;
    result: Outcome;
    time_control?: string | null;
    white_time_control?: string | null;
    black_time_control?: string | null;
    eco?: string | null;
    variant?: string | null;
    other?: Record<string, string>;
    // Repertoire headers
    start?: number[];
    orientation?: "white" | "black";
};

export function getGameName(headers: GameHeaders) {
    if ((headers.white && headers.white !== "?") || (headers.black && headers.black !== "?")) {
        return `${headers.white} - ${headers.black}`;
    }
    if (headers.event) {
        return headers.event;
    }
    return "Unknown";
}

export const getNodeAtPath = (node: TreeNode, path: number[]): TreeNode => {
    let currentNode = node;
    for (const index of path) {
        if (!currentNode.children || index >= currentNode.children.length) {
            return currentNode;
        }
        currentNode = currentNode.children[index];
    }
    return currentNode;
};

export function buildTranspositionMaps(
    root: TreeNode,
    startPath: number[] = [],
): Record<string, { node: TreeNode; path: number[] }[]> {
    const map: Record<string, { node: TreeNode; path: number[] }[]> = {};
    const startNode = getNodeAtPath(root, startPath);

    function traverse(node: TreeNode, path: number[]) {
        const boardFen = getBoardState(node.fen);
        if (!map[boardFen]) map[boardFen] = [];
        map[boardFen].push({ node, path: [...path] });
        for (let i = 0; i < node.children.length; i++) {
            traverse(node.children[i], [...path, i]);
        }
    }
    traverse(startNode, [...startPath]);
    return map;
}

export interface ReportState {
    inProgress: boolean;
    operationId: string | null;
}

export function getBoardState(fen: string): string {
    return fen.split(" ").slice(0, 4).join(" ");
}
