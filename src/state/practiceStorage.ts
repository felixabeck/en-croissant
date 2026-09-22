import type {
    PracticeDeckInventory,
    PracticeDeckSnapshot,
    PracticeMigrationOutcome,
    PracticeReviewPage,
} from "@/bindings";
import { normalizeError } from "@/platform/errors";
import { tauri } from "@/platform/tauri";
import type { ReviewLog } from "ts-fsrs";
import { z } from "zod";
import { type Position, positionSchema } from "@/components/files/opening";

const invokePractice = async <T>(call: () => Promise<T>): Promise<T> => {
    try {
        return await call();
    } catch (error) {
        throw normalizeError(error);
    }
};

export async function loadPracticeDeck(
    fileId: string,
    game: number,
): Promise<PracticeDeckSnapshot | null> {
    return invokePractice(() => tauri.loadPracticeDeck(fileId, game));
}

export async function recordPracticeReview(
    fileId: string,
    game: number,
    generation: number,
    revision: number,
    baseRevision: number,
    positionsDocument: string,
    entry: string,
    entryId: string,
): Promise<number> {
    return invokePractice(() =>
        tauri.recordPracticeReview(
            fileId,
            game,
            generation,
            revision,
            baseRevision,
            positionsDocument,
            entry,
            entryId,
        ),
    );
}

export async function syncPracticePositions(
    fileId: string,
    game: number,
    generation: number,
    revision: number,
    positionsDocument: string,
): Promise<number> {
    return invokePractice(() =>
        tauri.syncPracticePositions(fileId, game, generation, revision, positionsDocument),
    );
}

export async function resetPracticeDeck(
    fileId: string,
    game: number,
    generation: number,
    revision: number,
    positionsDocument: string,
): Promise<number> {
    return invokePractice(() =>
        tauri.resetPracticeDeck(fileId, game, generation, revision, positionsDocument),
    );
}

export async function loadPracticeReviews(
    fileId: string,
    game: number,
    cursor: string | null,
    limit: number,
): Promise<PracticeReviewPage> {
    return invokePractice(() => tauri.loadPracticeReviews(fileId, game, cursor, limit));
}

export async function migratePracticeDeck(
    fileId: string,
    game: number,
    legacyDocument: string,
): Promise<PracticeMigrationOutcome> {
    return invokePractice(() => tauri.migratePracticeDeck(fileId, game, legacyDocument));
}

export async function acknowledgePracticeOrphans(
    fileId: string,
    game: number,
    generation: number,
    acknowledgedCount: number,
): Promise<null> {
    return invokePractice(() =>
        tauri.acknowledgePracticeOrphans(fileId, game, generation, acknowledgedCount),
    );
}

export async function repairPracticeDeck(fileId: string, game: number): Promise<null> {
    return invokePractice(() => tauri.repairPracticeDeck(fileId, game));
}

export async function listPracticeDecks(): Promise<PracticeDeckInventory> {
    return invokePractice(() => tauri.listPracticeDecks());
}

export const reviewLogSchema = z
    .object({
        fen: z.string(),
    })
    .passthrough();

export const practiceDataSchema = z.object({
    positions: positionSchema.array(),
    logs: reviewLogSchema.array(),
});

export type PracticeData = {
    positions: Position[];
    logs: (ReviewLog & { fen: string })[];
};
