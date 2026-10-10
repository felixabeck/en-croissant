import { IllegalSetup, PositionError, parseSquare, parseUci } from "chessops";
import { FenError, INITIAL_FEN, InvalidFen, makeFen, parseFen } from "chessops/fen";
import type { TFunction } from "i18next";
import { expect, test } from "vitest";
import type { SupportedLocale } from "@/i18n";
import { catalogueI18n, shippedCatalogues } from "@/tests/catalogues";
import { parseKeyboardMove } from "../chess";
import {
    getCastlingSquare,
    normalizeEditedFen,
    parseSanOrUci,
    positionFromFen,
    translateChessopsError,
} from "../chessops";

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

const illegalUciCases = [
    { name: "three-square pawn advance", fen: INITIAL_FEN, uci: "e2e5" },
    { name: "wrong side to move", fen: INITIAL_FEN, uci: "e7e5" },
    {
        name: "exposing the king to check",
        fen: "k3r3/8/8/8/8/8/4R3/4K3 w - - 0 1",
        uci: "e2f2",
    },
];

test.each(illegalUciCases)("shared parser rejects $name", ({ fen, uci }) => {
    const [pos, error] = positionFromFen(fen);
    expect(error).toBeNull();
    if (!pos) throw new Error("Invalid legality fixture");
    expect(parseUci(uci)).toBeDefined();

    expect(parseSanOrUci(pos, uci)).toBeNull();
    expect(makeFen(pos.toSetup())).toBe(fen);
});

test.each(illegalUciCases)("keyboard parser rejects $name", ({ fen, uci }) => {
    expect(parseKeyboardMove(uci, fen)).toBeNull();
});

const legalParserCases = [
    { name: "legal UCI", fen: INITIAL_FEN, shared: "e2e4", keyboard: "e2e4", uci: "e2e4" },
    { name: "normalized piece SAN", fen: INITIAL_FEN, shared: "Nf3", keyboard: "nf3", uci: "g1f3" },
    {
        name: "Black-to-move custom position",
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 23",
        shared: "e7e5",
        keyboard: "e5",
        uci: "e7e5",
    },
    {
        name: "normalized kingside castling SAN",
        fen: "4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1",
        shared: "O-O",
        keyboard: "0-0",
        uci: "e1h1",
    },
    {
        name: "king-destination castling UCI",
        fen: "4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1",
        shared: "e1g1",
        keyboard: "e1g1",
        uci: "e1g1",
    },
    {
        name: "normalized queenside castling SAN",
        fen: "4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1",
        shared: "O-O-O",
        keyboard: "ooo",
        uci: "e1a1",
    },
    {
        name: "Chess960 kingside castling UCI",
        fen: "4k3/8/8/8/8/8/8/1R1K1R2 w KQ - 0 1",
        shared: "d1f1",
        keyboard: "oo",
        uci: "d1f1",
    },
    {
        name: "Chess960 queenside castling UCI",
        fen: "4k3/8/8/8/8/8/8/1R1K1R2 w KQ - 0 1",
        shared: "d1b1",
        keyboard: "d1b1",
        uci: "d1b1",
    },
    {
        name: "promotion UCI",
        fen: "7k/P7/8/8/8/8/8/4K3 w - - 0 1",
        shared: "a7a8q",
        keyboard: "a7a8q",
        uci: "a7a8q",
    },
    {
        name: "underpromotion SAN",
        fen: "7k/P7/8/8/8/8/8/4K3 w - - 0 1",
        shared: "a8=N",
        keyboard: "a8=N",
        uci: "a7a8n",
    },
];

test.each(legalParserCases)("position parsers preserve $name", ({ fen, shared, keyboard, uci }) => {
    const [pos, error] = positionFromFen(fen);
    expect(error).toBeNull();
    if (!pos) throw new Error("Invalid legality fixture");
    const expected = parseUci(uci);

    expect(parseSanOrUci(pos, shared)).toEqual(expected);
    expect(parseKeyboardMove(keyboard, fen)).toEqual(expected);
    expect(makeFen(pos.toSetup())).toBe(fen);
});
