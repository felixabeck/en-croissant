import { INITIAL_FEN } from "chessops/fen";
import { createInstance } from "i18next";
import { afterEach, expect, test, vi } from "vitest";
import i18n from "@/i18n";
import enUSCatalogue from "@/translation/en-US.json";
import { catalogueI18n } from "@/tests/catalogues";
import { createTreeStore } from "./store/tree";
import { serializeStorageValue } from "./store/debouncedStorage";
import { defaultTree } from "@/utils/treeReducer";
import {
    boundPuzzleSession,
    emptyPuzzleSession,
    MAX_PUZZLE_SESSION_BYTES,
    puzzleSchema,
    puzzleSessionBytes,
    puzzleSessionSchema,
    selectedPuzzleIndex,
    legacyPuzzleKey,
    puzzleOwnsTree,
    restorePuzzleSession,
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

test.each(["KQkq e3", "HAha -"])(
    "%s-equivalent puzzle attempts retain their selected UUID and require the actual played path",
    (rights) => {
        const board = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b";
        const fen = `${board} ${rights} 0 1`;
        const puzzle = {
            ...attempt("unused").puzzle,
            fen: `${board} KQkq - 0 1`,
            moves: ["g8f6", "g1f3", "f6g8", "f3g1"],
        };
        const a = "11111111-1111-4111-8111-111111111111";
        const b = "22222222-2222-4222-8222-222222222222";
        const memory = createTreeStore(undefined, defaultTree(fen));
        expect(
            memory.getState().makeMoves({ payload: puzzle.moves.slice(0, 2), changeHeaders: false })
                .success,
        ).toBe(true);
        memory.getState().setComment("retained played annotation");
        const tree = {
            ...memory.getState(),
            puzzleSession: {
                version: 1 as const,
                attempts: [
                    { attemptId: a, puzzle: { ...puzzle, fen } },
                    { attemptId: b, puzzle },
                ],
                selectedAttemptId: b,
            },
        };
        expect(puzzleSessionSchema.safeParse(tree.puzzleSession).success).toBe(true);
        expect(puzzleOwnsTree(puzzle, tree)).toBe(true);
        const restored = restorePuzzleSession("ep-selected", tree);
        expect(restored).toBe(tree.puzzleSession);
        expect(restored.selectedAttemptId).toBe(b);
        expect(restored.attempts.map(({ attemptId }) => attemptId)).toEqual([a, b]);
        expect(tree.root.fen).toBe(fen);
        expect(tree.headers.fen).toBe(fen);
        expect(tree.position).toEqual([0, 0]);
        expect(memory.getState().currentNode().comment).toBe("retained played annotation");

        memory.getState().goToStart();
        memory.getState().makeMove({ payload: "d5", changeHeaders: false });
        const incompatible = {
            ...tree,
            root: memory.getState().root,
            position: memory.getState().position,
        };
        expect(puzzleOwnsTree(puzzle, incompatible)).toBe(false);
        expect(restorePuzzleSession("ep-selected", incompatible)).toEqual({
            ...restored,
            selectedAttemptId: null,
        });
        expect(tree.puzzleSession.selectedAttemptId).toBe(b);
    },
);

test.each(
    (["unique", "ambiguous"] as const).flatMap((ownership) =>
        ["KQkq e3", "HAha -"].map((rights) => ({ ownership, rights })),
    ),
)("legacy $rights ownership handles $ownership matches", ({ ownership, rights }) => {
    const board = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b";
    const fen = `${board} ${rights} 0 1`;
    const puzzle = {
        ...attempt("unused").puzzle,
        fen: `${board} KQkq - 0 1`,
        moves: ["g8f6", "g1f3"],
    };
    const memory = createTreeStore(undefined, defaultTree(fen));
    memory.getState().makeMove({ payload: "Nf6", changeHeaders: false });
    memory.getState().setComment("legacy played tree");
    const tree = memory.getState();
    const key = legacyPuzzleKey("ep-legacy");
    const rows = ownership === "unique" ? [puzzle] : [puzzle, { ...puzzle, fen }];
    const bytes = serializeStorageValue(rows);
    sessionStorage.setItem(key, bytes);
    try {
        const restored = restorePuzzleSession("ep-legacy", tree);
        expect(restored.attempts.map(({ puzzle }) => puzzle)).toEqual(rows);
        expect(new Set(restored.attempts.map(({ attemptId }) => attemptId)).size).toBe(rows.length);
        for (const { attemptId } of restored.attempts) expect(attemptId).toMatch(/^[0-9a-f-]{36}$/);
        expect(selectedPuzzleIndex(restored)).toBe(ownership === "unique" ? 0 : -1);
        expect(tree.root.fen).toBe(fen);
        expect(tree.position).toEqual([0]);
        expect(tree.currentNode().comment).toBe("legacy played tree");
        expect(sessionStorage.getItem(key)).toBe(bytes);
    } finally {
        sessionStorage.removeItem(key);
    }
});

test("puzzle restoration rejects a root with different legal EP capture rights", () => {
    const fen = "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2";
    const puzzle = { ...attempt("unused").puzzle, fen, moves: ["e5d6", "e8f7"] };
    expect(puzzleSchema.safeParse(puzzle).success).toBe(true);
    const tree = {
        ...defaultTree(fen.replace(" d6 ", " - ")),
        puzzleSession: {
            version: 1 as const,
            attempts: [{ attemptId: "11111111-1111-4111-8111-111111111111", puzzle }],
            selectedAttemptId: "11111111-1111-4111-8111-111111111111",
        },
    };
    expect(puzzleOwnsTree(puzzle, tree)).toBe(false);
    expect(restorePuzzleSession("ep-legal", tree).selectedAttemptId).toBeNull();
});
