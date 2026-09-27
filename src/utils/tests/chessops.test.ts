import { IllegalSetup, PositionError, parseSquare } from "chessops";
import { FenError, InvalidFen, parseFen } from "chessops/fen";
import { expect, test } from "vitest";
import type { SupportedLocale } from "@/i18n";
import { catalogueI18n, shippedCatalogues } from "@/tests/catalogues";
import { chessopsError, getCastlingSquare, normalizeEditedFen } from "../chessops";

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

test("every chessops error key resolves in every shipped catalogue", async () => {
    const errors = [
        ...Object.values(IllegalSetup).map((message) => new PositionError(message)),
        ...Object.values(InvalidFen).map((message) => new FenError(message)),
        new FenError("not a chessops message"),
    ];
    const missing: string[] = [];
    for (const { locale } of shippedCatalogues()) {
        const i18n = await catalogueI18n(locale as SupportedLocale);
        for (const error of errors) {
            const key = chessopsError(error);
            if (!i18n.exists(key)) missing.push(`${locale} ${key}`);
        }
    }
    expect(missing).toEqual([]);
});

test("an invalid halfmove field reports the localized halfmove error", async () => {
    const result = parseFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - x 1");
    expect(result.isErr).toBe(true);
    const key = chessopsError(
        result.unwrap(
            () => undefined as never,
            (error) => error,
        ),
    );
    expect(key).toBe("Errors.InvalidHalfmoves");
    expect((await catalogueI18n("en-US")).t(key)).toBe("Invalid halfmove number");
    expect((await catalogueI18n("de-DE")).t(key)).toBe("Ungültige Halbzugzahl");
});
