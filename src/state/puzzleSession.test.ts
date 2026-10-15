import { INITIAL_FEN } from "chessops/fen";
import { createInstance } from "i18next";
import { afterEach, expect, test, vi } from "vitest";
import i18n from "@/i18n";
import enUSCatalogue from "@/translation/en-US.json";
import { catalogueI18n } from "@/tests/catalogues";
import {
    boundPuzzleSession,
    emptyPuzzleSession,
    MAX_PUZZLE_SESSION_BYTES,
    puzzleSchema,
    puzzleSessionBytes,
    puzzleSessionSchema,
    selectedPuzzleIndex,
    type PuzzleAttempt,
    type PuzzleSession,
} from "./puzzleSession";

afterEach(() => vi.restoreAllMocks());

function attempt(attemptId: string): PuzzleAttempt {
    return {
        attemptId,
        puzzle: {
            id: 1,
            fen: INITIAL_FEN,
            moves: ["e2e4", "e7e5"],
            rating: 1500,
            rating_deviation: 50,
            popularity: 90,
            nb_plays: 100,
            completion: "incomplete",
        },
    };
}

// Deterministic high-entropy text exercises the compressed limit rather than raw string length.
function themes(seed: number, count = 80): string[] {
    let value = seed;
    return Array.from({ length: count }, () =>
        Array.from({ length: 256 }, () => {
            value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
            return String.fromCharCode(32 + ((value >>> 16) % 90));
        }).join(""),
    );
}

test("shared puzzle schema rejects nonfinite data, unbounded fields and illegal sequences", () => {
    const row = attempt("a").puzzle;
    expect(puzzleSchema.safeParse(row).success).toBe(true);
    for (const patch of [
        { rating: Infinity },
        { timeSpent: NaN },
        { nb_plays: -1 },
        { moves: ["e2e5"] },
        { moves: ["e2e4", "e2e3"] },
        { fen: "invalid" },
        { themes: ["x".repeat(257)] },
        { moves: [] },
    ])
        expect(puzzleSchema.safeParse({ ...row, ...patch }).success).toBe(false);
});

test("count retention protects an old selected identity and keeps duplicate puzzle rows distinct", () => {
    const input: PuzzleSession = {
        version: 1,
        attempts: Array.from({ length: 101 }, (_, i) => attempt(`a-${i}`)),
        selectedAttemptId: "a-0",
    };
    const retained = boundPuzzleSession(input);
    expect(retained.attempts).toHaveLength(100);
    expect(retained.attempts[0].attemptId).toBe("a-0");
    expect(retained.attempts[1].attemptId).toBe("a-2");
    expect(selectedPuzzleIndex(retained)).toBe(0);
    expect(input.attempts).toHaveLength(101);
    expect(puzzleSessionSchema.safeParse(input).success).toBe(false);
});

test("compressed retention evicts oldest other attempts below the count boundary", () => {
    const attempts = Array.from({ length: 3 }, (_, i) => ({
        ...attempt(`large-${i}`),
        puzzle: { ...attempt("a").puzzle, themes: themes(i + 1) },
    }));
    const input: PuzzleSession = { version: 1, attempts, selectedAttemptId: "large-0" };
    expect(puzzleSessionBytes(input)).toBeGreaterThan(MAX_PUZZLE_SESSION_BYTES);
    const retained = boundPuzzleSession(input);
    expect(retained.attempts.length).toBeLessThan(3);
    expect(retained.attempts[0].attemptId).toBe("large-0");
    expect(puzzleSessionBytes(retained)).toBeLessThanOrEqual(MAX_PUZZLE_SESSION_BYTES);
});

function oversizedSession(): PuzzleSession {
    return {
        version: 1,
        attempts: [
            attempt("selected"),
            { ...attempt("incoming"), puzzle: { ...attempt("a").puzzle, themes: themes(42, 128) } },
        ],
        selectedAttemptId: "selected",
    };
}

test.each(["en-US", "de-DE"] as const)(
    "an individually oversized incoming attempt is refused in %s without mutating the selected owner",
    async (locale) => {
        const translator = await catalogueI18n(locale);
        vi.spyOn(i18n, "t").mockImplementation(translator.t);
        const input = oversizedSession();
        expect(
            puzzleSessionBytes({
                ...input,
                attempts: [input.attempts[1]],
                selectedAttemptId: "incoming",
            }),
        ).toBeGreaterThan(MAX_PUZZLE_SESSION_BYTES);
        expect(() => boundPuzzleSession(input)).toThrow(
            translator.t("Common.StorageQuotaExceeded"),
        );
        expect(input.attempts.map((row) => row.attemptId)).toEqual(["selected", "incoming"]);
        // An old unselected legacy row may be evicted, after ownership has been inferred.
        expect(boundPuzzleSession(input, []).attempts.map((row) => row.attemptId)).toEqual([
            "selected",
        ]);
        expect(() => boundPuzzleSession({ ...input, selectedAttemptId: "incoming" }, [])).toThrow(
            translator.t("Common.StorageQuotaExceeded"),
        );
    },
);

test("oversized admission before i18next initialization uses the deterministic English catalogue", () => {
    const uninitialized = createInstance();
    vi.spyOn(i18n, "t").mockImplementation(uninitialized.t);
    const input = oversizedSession();
    expect(uninitialized.isInitialized).not.toBe(true);
    expect(() => boundPuzzleSession(input)).toThrow(
        enUSCatalogue.translation["Common.StorageQuotaExceeded"],
    );
    expect(input.attempts.map(({ attemptId }) => attemptId)).toEqual(["selected", "incoming"]);
});

test("selection derives from stable identity and unresolved selection never guesses zero", () => {
    const session: PuzzleSession = {
        version: 1,
        attempts: [attempt("a"), attempt("b")],
        selectedAttemptId: "b",
    };
    expect(selectedPuzzleIndex(session)).toBe(1);
    expect(selectedPuzzleIndex({ ...session, selectedAttemptId: "missing" })).toBe(-1);
    expect(selectedPuzzleIndex(emptyPuzzleSession())).toBe(-1);
    expect(selectedPuzzleIndex(undefined)).toBe(-1);
    expect(puzzleSessionSchema.safeParse({ ...session, version: 2 }).success).toBe(false);
    expect(
        puzzleSessionSchema.safeParse({ ...session, attempts: [attempt("a"), attempt("a")] })
            .success,
    ).toBe(false);
});
