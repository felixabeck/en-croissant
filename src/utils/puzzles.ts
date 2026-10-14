import { tauri } from "@/platform/tauri";
import { type PuzzleDatabaseInfo, type PuzzleRootDescriptor } from "@/bindings";
import { isNormal, parseUci, type Move, type NormalMove } from "chessops";
import type { Chess } from "chessops/chess";
import type { TreeStore } from "@/state/store/tree";
import { uciNormalize } from "@/utils/chess";
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

export function puzzleMoveMatches(
    pos: Chess,
    move: Move,
    expectedUci: string | undefined,
): boolean {
    const expected = parseUci(expectedUci ?? "");
    return (
        !!expected &&
        pos.isLegal(move) &&
        pos.isLegal(expected) &&
        uciNormalize(pos, move) === uciNormalize(pos, expected)
    );
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
    for (let step = 0; step < position.length; step++) {
        const child = node.children[position[step]];
        const [parent] = positionFromFen(node.fen);
        if (!child?.move || !parent || !puzzleMoveMatches(parent, child.move, puzzle.moves[step])) {
            return { step: null, atFrontier: false, nextMove: null };
        }
        node = child;
    }
    const step = position.length;
    const [pos] = positionFromFen(node.fen);
    const child = node.children[0];
    const atFrontier = !(
        pos &&
        child?.move &&
        puzzleMoveMatches(pos, child.move, puzzle.moves[step])
    );
    const move = step > 0 ? parseUci(puzzle.moves[step] ?? "") : undefined;
    const nextMove =
        pos && !pos.isEnd() && move && isNormal(move) && pos.isLegal(move) ? move : null;
    return { step, atFrontier, nextMove };
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
