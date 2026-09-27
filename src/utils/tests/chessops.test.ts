import { IllegalSetup, PositionError, parseSquare } from "chessops";
import { FenError, InvalidFen, parseFen } from "chessops/fen";
import type { TFunction } from "i18next";
import { expect, test } from "vitest";
import type { SupportedLocale } from "@/i18n";
import { catalogueI18n, shippedCatalogues } from "@/tests/catalogues";
import { getCastlingSquare, normalizeEditedFen, translateChessopsError } from "../chessops";

// `satisfies Record<…>` makes a new chessops enum value a type error here.
const expectedSetupKeys = {
    [IllegalSetup.Empty]: "Errors.EmptyBoard",
    [IllegalSetup.Kings]: "Errors.InvalidKings",
    [IllegalSetup.OppositeCheck]: "Errors.OppositeCheck",
    [IllegalSetup.PawnsOnBackrank]: "Errors.PawnsOnBackrank",
    [IllegalSetup.Variant]: "Errors.Unknown",
} satisfies Record<IllegalSetup, string>;

const expectedFenKeys = {
    [InvalidFen.Board]: "Errors.InvalidBoard",
    [InvalidFen.Castling]: "Errors.InvalidCastlingRights",
    [InvalidFen.EpSquare]: "Errors.InvalidEpSquare",
    [InvalidFen.Fen]: "Errors.InvalidFen",
    [InvalidFen.Fullmoves]: "Errors.InvalidFullmoves",
    [InvalidFen.Halfmoves]: "Errors.InvalidHalfmoves",
    [InvalidFen.Pockets]: "Errors.InvalidPockets",
    [InvalidFen.RemainingChecks]: "Errors.InvalidRemainingChecks",
    [InvalidFen.Turn]: "Errors.InvalidTurn",
} satisfies Record<InvalidFen, string>;

const expectedChessopsErrors: { error: PositionError | FenError; key: string }[] = [
    ...Object.entries(expectedSetupKeys).map(([message, key]) => ({
        error: new PositionError(message),
        key,
    })),
    ...Object.entries(expectedFenKeys).map(([message, key]) => ({
        error: new FenError(message),
        key,
    })),
    { error: new FenError("not a chessops message"), key: "Errors.Unknown" },
    { error: new FenError("constructor"), key: "Errors.Unknown" },
];

const keyOf = (error: PositionError | FenError) =>
    translateChessopsError(((key: string) => key) as unknown as TFunction, error);

test("should get the correct castling square in the starting position", () => {
    const setup = parseFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1").unwrap();
    expect(getCastlingSquare(setup, "w", "k")).toBe(parseSquare("h1"));
    expect(getCastlingSquare(setup, "w", "q")).toBe(parseSquare("a1"));
    expect(getCastlingSquare(setup, "b", "k")).toBe(parseSquare("h8"));
    expect(getCastlingSquare(setup, "b", "q")).toBe(parseSquare("a8"));
});

test("should get the correct castling square in FRC 1", () => {
    const setup = parseFen("bbqnnrkr/pppppppp/8/8/8/8/PPPPPPPP/BBQNNRKR w KQkq - 0 1").unwrap();
    expect(getCastlingSquare(setup, "w", "k")).toBe(parseSquare("h1"));
    expect(getCastlingSquare(setup, "w", "q")).toBe(parseSquare("f1"));
    expect(getCastlingSquare(setup, "b", "k")).toBe(parseSquare("h8"));
    expect(getCastlingSquare(setup, "b", "q")).toBe(parseSquare("f8"));
});

test("should get the correct castling square in FRC 500", () => {
    const setup = parseFen("brqnknrb/pppppppp/8/8/8/8/PPPPPPPP/BRQNKNRB w KQkq - 0 1").unwrap();
    expect(getCastlingSquare(setup, "w", "k")).toBe(parseSquare("g1"));
    expect(getCastlingSquare(setup, "w", "q")).toBe(parseSquare("b1"));
    expect(getCastlingSquare(setup, "b", "k")).toBe(parseSquare("g8"));
    expect(getCastlingSquare(setup, "b", "q")).toBe(parseSquare("b8"));
});

test("should get the correct castling square in FRC 600", () => {
    const setup = parseFen("rqbnkrnb/pppppppp/8/8/8/8/PPPPPPPP/RQBNKRNB w KQkq - 0 1").unwrap();
    expect(getCastlingSquare(setup, "w", "k")).toBe(parseSquare("f1"));
    expect(getCastlingSquare(setup, "w", "q")).toBe(parseSquare("a1"));
    expect(getCastlingSquare(setup, "b", "k")).toBe(parseSquare("f8"));
    expect(getCastlingSquare(setup, "b", "q")).toBe(parseSquare("a8"));
});

test("should get the correct castling square in FRC 608", () => {
    const setup = parseFen("rqnkrnbb/pppppppp/8/8/8/8/PPPPPPPP/RQNKRNBB w EAea - 0 1").unwrap();
    expect(getCastlingSquare(setup, "w", "k")).toBe(parseSquare("e1"));
    expect(getCastlingSquare(setup, "w", "q")).toBe(parseSquare("a1"));
    expect(getCastlingSquare(setup, "b", "k")).toBe(parseSquare("e8"));
    expect(getCastlingSquare(setup, "b", "q")).toBe(parseSquare("a8"));
});

test("normalizes transient editor state while preserving valid Chess960 castling rooks", () => {
    expect(normalizeEditedFen("rqnkrnbb/pppppppp/8/8/8/8/PPPPPPPP/RQNKRNBB w EAea e3 12 3")).toBe(
        "rqnkrnbb/pppppppp/8/8/8/8/PPPPPPPP/RQNKRNBB w KQkq - 12 3",
    );
});

test("editor normalization removes rights when the referenced rook was removed", () => {
    expect(normalizeEditedFen("4k3/8/8/8/8/8/8/4K3 w KQkq e3 0 1")).toBe(
        "4k3/8/8/8/8/8/8/4K3 w - - 0 1",
    );
});

test("maps every chessops error to its exact catalogue key", () => {
    for (const { error, key } of expectedChessopsErrors) {
        expect(keyOf(error)).toBe(key);
    }
});

test("every chessops error key resolves in every shipped catalogue", async () => {
    const errors = expectedChessopsErrors.map(({ error }) => error);
    const missing: string[] = [];
    for (const { locale } of shippedCatalogues()) {
        const i18n = await catalogueI18n(locale as SupportedLocale);
        for (const error of errors) {
            const key = keyOf(error);
            if (!i18n.exists(key)) missing.push(`${locale} ${key}`);
        }
    }
    expect(missing).toEqual([]);
});

test("an invalid halfmove field reports the localized halfmove error", async () => {
    const result = parseFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - x 1");
    expect(result.isErr).toBe(true);
    const error = result.unwrap(
        () => undefined as never,
        (error) => error,
    );
    expect(translateChessopsError((await catalogueI18n("en-US")).t, error)).toBe(
        "Invalid halfmove number",
    );
    expect(translateChessopsError((await catalogueI18n("de-DE")).t, error)).toBe(
        "Ungültige Halbzugzahl",
    );
});
