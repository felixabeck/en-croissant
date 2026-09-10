import type { Piece } from "chessops";
import { expect, test } from "vitest";
import { supportedLocales } from "@/i18n";
import { catalogueI18n } from "@/tests/catalogues";
import { accessibleBoardGrid, accessibleSquareLabel, boardColorLabel } from "./boardAccessibility";

type BoardColor = "white" | "black";

type ComposedLabelExpectation = {
    colors: Record<BoardColor, string>;
    roles: Array<{
        role: Piece["role"];
        square: Record<BoardColor, string>;
    }>;
    orientations: Record<BoardColor, string>;
};

const composedLabelExpectations: Record<
    "be-BY" | "de-DE" | "es-ES" | "fr-FR" | "pl-PL" | "pt-PT" | "ru-RU" | "uk-UA",
    ComposedLabelExpectation
> = {
    "be-BY": {
        colors: { white: "белыя", black: "чорныя" },
        roles: [
            {
                role: "bishop",
                square: {
                    white: "поле e4: фігура: слон, бок: белыя",
                    black: "поле e4: фігура: слон, бок: чорныя",
                },
            },
            {
                role: "rook",
                square: {
                    white: "поле e4: фігура: ладдзя, бок: белыя",
                    black: "поле e4: фігура: ладдзя, бок: чорныя",
                },
            },
        ],
        orientations: {
            white: "Шахматная дошка, унізе: белыя",
            black: "Шахматная дошка, унізе: чорныя",
        },
    },
    "de-DE": {
        colors: { white: "Weiß", black: "Schwarz" },
        roles: [
            {
                role: "bishop",
                square: {
                    white: "Feld e4: Figur: Läufer, Farbe: Weiß",
                    black: "Feld e4: Figur: Läufer, Farbe: Schwarz",
                },
            },
            {
                role: "queen",
                square: {
                    white: "Feld e4: Figur: Dame, Farbe: Weiß",
                    black: "Feld e4: Figur: Dame, Farbe: Schwarz",
                },
            },
        ],
        orientations: {
            white: "Schachbrett, unten: Weiß",
            black: "Schachbrett, unten: Schwarz",
        },
    },
    "es-ES": {
        colors: { white: "blancas", black: "negras" },
        roles: [
            {
                role: "bishop",
                square: {
                    white: "casilla e4: pieza: alfil, bando: blancas",
                    black: "casilla e4: pieza: alfil, bando: negras",
                },
            },
            {
                role: "queen",
                square: {
                    white: "casilla e4: pieza: dama, bando: blancas",
                    black: "casilla e4: pieza: dama, bando: negras",
                },
            },
        ],
        orientations: {
            white: "Tablero de ajedrez, abajo: blancas",
            black: "Tablero de ajedrez, abajo: negras",
        },
    },
    "fr-FR": {
        colors: { white: "Blancs", black: "Noirs" },
        roles: [
            {
                role: "bishop",
                square: {
                    white: "case e4 : pièce : fou, camp : Blancs",
                    black: "case e4 : pièce : fou, camp : Noirs",
                },
            },
            {
                role: "queen",
                square: {
                    white: "case e4 : pièce : dame, camp : Blancs",
                    black: "case e4 : pièce : dame, camp : Noirs",
                },
            },
        ],
        orientations: {
            white: "Échiquier, camp en bas : Blancs",
            black: "Échiquier, camp en bas : Noirs",
        },
    },
    "pl-PL": {
        colors: { white: "białe", black: "czarne" },
        roles: [
            {
                role: "bishop",
                square: {
                    white: "pole e4: figura: goniec, strona: białe",
                    black: "pole e4: figura: goniec, strona: czarne",
                },
            },
            {
                role: "rook",
                square: {
                    white: "pole e4: figura: wieża, strona: białe",
                    black: "pole e4: figura: wieża, strona: czarne",
                },
            },
        ],
        orientations: {
            white: "Szachownica, na dole: białe",
            black: "Szachownica, na dole: czarne",
        },
    },
    "pt-PT": {
        colors: { white: "Brancas", black: "Pretas" },
        roles: [
            {
                role: "bishop",
                square: {
                    white: "casa e4: peça: bispo, lado: Brancas",
                    black: "casa e4: peça: bispo, lado: Pretas",
                },
            },
            {
                role: "queen",
                square: {
                    white: "casa e4: peça: dama, lado: Brancas",
                    black: "casa e4: peça: dama, lado: Pretas",
                },
            },
        ],
        orientations: {
            white: "Tabuleiro de xadrez, lado em baixo: Brancas",
            black: "Tabuleiro de xadrez, lado em baixo: Pretas",
        },
    },
    "ru-RU": {
        colors: { white: "Белые", black: "Чёрные" },
        roles: [
            {
                role: "bishop",
                square: {
                    white: "поле e4: фигура: слон, сторона: Белые",
                    black: "поле e4: фигура: слон, сторона: Чёрные",
                },
            },
            {
                role: "pawn",
                square: {
                    white: "поле e4: фигура: пешка, сторона: Белые",
                    black: "поле e4: фигура: пешка, сторона: Чёрные",
                },
            },
        ],
        orientations: {
            white: "Шахматная доска, снизу: Белые",
            black: "Шахматная доска, снизу: Чёрные",
        },
    },
    "uk-UA": {
        colors: { white: "Білі", black: "Чорні" },
        roles: [
            {
                role: "bishop",
                square: {
                    white: "поле e4: фігура: слон, сторона: Білі",
                    black: "поле e4: фігура: слон, сторона: Чорні",
                },
            },
            {
                role: "rook",
                square: {
                    white: "поле e4: фігура: тура, сторона: Білі",
                    black: "поле e4: фігура: тура, сторона: Чорні",
                },
            },
        ],
        orientations: {
            white: "Шахівниця, знизу: Білі",
            black: "Шахівниця, знизу: Чорні",
        },
    },
};

test("ARIA grid contains all 64 squares in white visual order", () => {
    const grid = accessibleBoardGrid("white");
    expect(grid).toHaveLength(8);
    expect(grid.flat()).toHaveLength(64);
    expect(grid[0][0]).toBe("a8");
    expect(grid[7][7]).toBe("h1");
});

test("ARIA grid reverses rows and files for black orientation", () => {
    const grid = accessibleBoardGrid("black");
    expect(grid[0][0]).toBe("h1");
    expect(grid[7][7]).toBe("a8");
});

test("ARIA square labels use every localized board colour and piece name", async () => {
    const colors = ["white", "black"] as const;
    const roles = ["pawn", "knight", "bishop", "rook", "queen", "king"] as const;
    const colorKeys = {
        white: "Board.Aria.Color.white",
        black: "Board.Aria.Color.black",
    } as const;
    const roleKeys = {
        pawn: "Board.Aria.PieceType.pawn",
        knight: "Board.Aria.PieceType.knight",
        bishop: "Board.Aria.PieceType.bishop",
        rook: "Board.Aria.PieceType.rook",
        queen: "Board.Aria.PieceType.queen",
        king: "Board.Aria.PieceType.king",
    } as const;

    for (const locale of supportedLocales) {
        const localeI18n = await catalogueI18n(locale);
        const t = localeI18n.t.bind(localeI18n);
        const colorLabels = {
            white: t(colorKeys.white),
            black: t(colorKeys.black),
        };
        const roleLabels = {
            pawn: t(roleKeys.pawn),
            knight: t(roleKeys.knight),
            bishop: t(roleKeys.bishop),
            rook: t(roleKeys.rook),
            queen: t(roleKeys.queen),
            king: t(roleKeys.king),
        };

        for (const label of [...Object.values(colorLabels), ...Object.values(roleLabels)]) {
            expect(label).not.toBe("");
            expect(label).not.toMatch(/^Board\.Aria\./);
        }

        for (const color of colors) {
            expect(boardColorLabel(t, color)).toBe(colorLabels[color]);
            for (const role of roles) {
                const piece = { color, role } satisfies Piece;
                const pieceLabel = t("Board.Aria.Piece", {
                    color: colorLabels[color],
                    piece: roleLabels[role],
                });
                const expected = t("Board.Aria.Square", {
                    square: "e4",
                    piece: pieceLabel,
                    selected: "",
                });
                expect(accessibleSquareLabel(t, "e4", piece, false)).toBe(expected);

                const selected = t("Board.Aria.MoveSourceSelected");
                expect(accessibleSquareLabel(t, "e4", piece, true)).toBe(
                    t("Board.Aria.Square", {
                        square: "e4",
                        piece: pieceLabel,
                        selected,
                    }),
                );
            }
        }

        const empty = t("Board.Aria.EmptySquare");
        expect(empty).not.toBe("");
        expect(empty).not.toMatch(/^Board\.Aria\./);
        expect(accessibleSquareLabel(t, "a1", undefined, false)).toBe(
            t("Board.Aria.Square", { square: "a1", piece: empty, selected: "" }),
        );
        expect(accessibleSquareLabel(t, "a1", undefined, true)).toBe(
            t("Board.Aria.Square", {
                square: "a1",
                piece: empty,
                selected: t("Board.Aria.MoveSourceSelected"),
            }),
        );
    }
});

test("ARIA composed labels keep side names independent from piece names", async () => {
    for (const [locale, expectation] of Object.entries(composedLabelExpectations)) {
        const localeI18n = await catalogueI18n(locale as keyof typeof composedLabelExpectations);
        const t = localeI18n.t.bind(localeI18n);

        for (const color of ["white", "black"] as const) {
            expect(boardColorLabel(t, color)).toBe(expectation.colors[color]);
            expect(t("Board.AccessibleName", { orientation: boardColorLabel(t, color) })).toBe(
                expectation.orientations[color],
            );

            for (const { role, square } of expectation.roles) {
                expect(accessibleSquareLabel(t, "e4", { color, role }, false)).toBe(square[color]);
            }
        }
    }
});
