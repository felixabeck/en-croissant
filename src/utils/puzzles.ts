import { tauri } from "@/platform/tauri";
import { type PuzzleDatabaseInfo, type PuzzleRootDescriptor } from "@/bindings";
import { isNormal, makeUci, parseUci, type NormalMove } from "chessops";
import type { TreeStore } from "@/state/store/tree";
import { positionFromFen } from "@/utils/chessops";
import { getBoardState, type TreeNode, type TreeState } from "@/utils/treeReducer";

export type Completion = "correct" | "incorrect" | "incomplete";

export interface Puzzle {
    id: number;
    fen: string;
    moves: string[];
    rating: number;
    rating_deviation: number;
    popularity: number;
    nb_plays: number;
    completion: Completion;
    timeSpent?: number;
    themes?: string[];
}

export function getPuzzleProgress(
    puzzle: Pick<Puzzle, "fen" | "moves"> | null | undefined,
    root: TreeNode,
    position: readonly number[],
): { step: number | null; atFrontier: boolean; nextMove: NormalMove | null } {
    if (!puzzle || getBoardState(root.fen) !== getBoardState(puzzle.fen)) {
        return { step: null, atFrontier: false, nextMove: null };
    }
    let node = root;
    let frontier = 0;
    let cursor = position.length === 0 ? root : null;
    while (frontier < puzzle.moves.length) {
        const child = node.children[0];
        if (!child?.move || makeUci(child.move) !== puzzle.moves[frontier]) break;
        node = child;
        frontier++;
        if (frontier === position.length) cursor = node;
    }
    const matches = position.every((index) => index === 0) && position.length <= frontier;
    const step = matches ? position.length : null;
    const [pos] = cursor ? positionFromFen(cursor.fen) : [null];
    const move = step !== null && step > 0 ? parseUci(puzzle.moves[step] ?? "") : undefined;
    const nextMove =
        matches && pos && !pos.isEnd() && move && isNormal(move) && pos.isLegal(move) ? move : null;
    return { step, atFrontier: matches && step === frontier, nextMove };
}

export function captureTreePositionOwner(
    store: Pick<TreeStore, "getState">,
    snapshot: Pick<TreeState, "root" | "position"> = store.getState(),
): () => boolean {
    const { root, position } = snapshot;
    return () => {
        const current = store.getState();
        return current.root === root && current.position === position;
    };
}

/** Native code enumerates and grants puzzle capabilities; renderer code never
 * reconstructs a database path from a directory and filename. */
export async function getPuzzleDatabases(signal?: AbortSignal): Promise<PuzzleDatabaseInfo[]> {
    return await tauri.listPuzzleDatabases({ signal });
}

export async function choosePuzzleDatabase(): Promise<PuzzleRootDescriptor> {
    return await tauri.issuePuzzleWorkspace();
}
