import { tauri } from "@/platform/tauri";
import { type PuzzleDatabaseInfo, type PuzzleRootDescriptor } from "@/bindings";

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

/** Native code enumerates and grants puzzle capabilities; renderer code never
 * reconstructs a database path from a directory and filename. */
export async function getPuzzleDatabases(): Promise<PuzzleDatabaseInfo[]> {
    return await tauri.listPuzzleDatabases();
}

export async function choosePuzzleDatabase(): Promise<PuzzleRootDescriptor> {
    return await tauri.issuePuzzleWorkspace();
}
