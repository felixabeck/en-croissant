import { z } from "zod";
import { validateMoveSequence } from "@/utils/puzzles";
import { serializeStorageValue } from "./store/debouncedStorage";

export const MAX_PUZZLE_ATTEMPTS = 100;
export const MAX_PUZZLE_SESSION_BYTES = 32_768;

/** Shared by native row admission, legacy migration and the persisted session. */
export const puzzleSchema = z
    .object({
        id: z.number().int().nonnegative().safe(),
        fen: z.string().min(1).max(256),
        moves: z
            .array(z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/))
            .min(1)
            .max(512),
        rating: z.number().finite(),
        rating_deviation: z.number().finite(),
        popularity: z.number().finite(),
        nb_plays: z.number().int().nonnegative().safe(),
        completion: z.enum(["correct", "incorrect", "incomplete"]),
        timeSpent: z.number().finite().nonnegative().optional(),
        themes: z.array(z.string().max(256)).max(128).optional(),
    })
    .superRefine((puzzle, context) => {
        if (!validateMoveSequence(puzzle.fen, puzzle.moves).success) {
            context.addIssue({ code: "custom", message: "Invalid puzzle move sequence" });
        }
    });

export type Puzzle = z.infer<typeof puzzleSchema>;
export type Completion = Puzzle["completion"];
const attemptIdSchema = z.string().min(1).max(128);
export const puzzleAttemptSchema = z.object({
    attemptId: attemptIdSchema,
    puzzle: puzzleSchema,
});
export type PuzzleAttempt = z.infer<typeof puzzleAttemptSchema>;

const sessionShape = z
    .object({
        version: z.literal(1),
        attempts: z.array(puzzleAttemptSchema),
        selectedAttemptId: attemptIdSchema.nullable(),
    })
    .superRefine((session, context) => {
        if (
            new Set(session.attempts.map((attempt) => attempt.attemptId)).size !==
            session.attempts.length
        ) {
            context.addIssue({ code: "custom", message: "Duplicate puzzle attempt identity" });
        }
    });
export type PuzzleSession = z.infer<typeof sessionShape>;

export function puzzleSessionBytes(session: PuzzleSession): number {
    return serializeStorageValue(session).length * 2;
}

/** A present invalid session gates the entire tree instead of silently losing its owner. */
export const puzzleSessionSchema = sessionShape.refine(
    (session) =>
        session.attempts.length <= MAX_PUZZLE_ATTEMPTS &&
        puzzleSessionBytes(session) <= MAX_PUZZLE_SESSION_BYTES,
    "Puzzle session exceeds its retention budget",
);

export function emptyPuzzleSession(): PuzzleSession {
    return { version: 1, attempts: [], selectedAttemptId: null };
}

/** A dangling identity stays unresolved and never implies selection of index zero. */
export function selectedPuzzleIndex(session: PuzzleSession | undefined): number {
    return (
        session?.attempts.findIndex((attempt) => attempt.attemptId === session.selectedAttemptId) ??
        -1
    );
}

/** Infer legacy ownership first. Migration passes [] because its rows are not new admissions. */
export function boundPuzzleSession(
    value: PuzzleSession,
    incomingAttemptIds: readonly string[] = value.attempts.map((attempt) => attempt.attemptId),
): PuzzleSession {
    const session = sessionShape.parse(value);
    const incoming = new Set(incomingAttemptIds);
    for (const attempt of session.attempts) {
        if (
            (incoming.has(attempt.attemptId) || attempt.attemptId === session.selectedAttemptId) &&
            puzzleSessionBytes({
                version: 1,
                attempts: [attempt],
                selectedAttemptId: attempt.attemptId,
            }) > MAX_PUZZLE_SESSION_BYTES
        ) {
            throw new Error("Puzzle attempt exceeds its retention budget");
        }
    }
    while (
        session.attempts.length > MAX_PUZZLE_ATTEMPTS ||
        puzzleSessionBytes(session) > MAX_PUZZLE_SESSION_BYTES
    ) {
        const index = session.attempts.findIndex(
            (attempt) => attempt.attemptId !== session.selectedAttemptId,
        );
        if (index === -1) throw new Error("Puzzle session exceeds its retention budget");
        session.attempts.splice(index, 1);
    }
    return session;
}
