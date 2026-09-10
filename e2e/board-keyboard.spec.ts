import { expect, test } from "./fixtures";

test("board-keyboard: opens analysis and exposes a keyboard-operable board", async ({
    page,
    assertAccessible,
    assertNoHorizontalOverflow,
    capture,
}) => {
    await page.goto("/");

    await page.getByRole("button", { name: /^open$/i }).click();
    const whiteBoard = page.getByRole("grid", {
        name: "Chessboard, White orientation",
        exact: true,
    });
    const blackBoard = page.getByRole("grid", {
        name: "Chessboard, Black orientation",
        exact: true,
    });
    await expect(whiteBoard).toBeVisible();
    await expect(whiteBoard).toHaveAttribute("aria-activedescendant", "board-square-e2");
    for (const [square, piece] of [
        ["a1", "White Rook"],
        ["b1", "White Knight"],
        ["c1", "White Bishop"],
        ["d1", "White Queen"],
        ["e1", "White King"],
        ["f2", "White Pawn"],
        ["a8", "Black Rook"],
        ["b8", "Black Knight"],
        ["c8", "Black Bishop"],
        ["d8", "Black Queen"],
        ["e8", "Black King"],
        ["f7", "Black Pawn"],
    ] as const) {
        await expect(
            page.getByRole("gridcell", {
                name: `${square}, ${piece}`,
                exact: true,
            }),
        ).toHaveCount(1);
    }
    await expect(
        page.getByRole("gridcell", { name: "e2, White Pawn", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("gridcell", { name: "e4, empty", exact: true })).toHaveCount(1);
    await expect(page.getByLabel(/^result$/i)).toBeVisible();
    await whiteBoard.focus();
    await expect(whiteBoard).toBeFocused();

    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    await expect(
        page.getByRole("gridcell", {
            name: "f2, White Pawn, move source selected",
            exact: true,
        }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText(/selected|illegal move/i)).toBeVisible();
    await assertNoHorizontalOverflow();
    await assertAccessible();
    await capture("board-keyboard");
    await expect(page).toHaveScreenshot("board-keyboard.png", { fullPage: true });
    await page.keyboard.press("f");
    await expect(blackBoard).toBeVisible();
    await expect(blackBoard.getByRole("gridcell").first()).toHaveAttribute("id", "board-square-h1");
    await expect(blackBoard.getByRole("gridcell").last()).toHaveAttribute("id", "board-square-a8");
    await expect(
        page.getByRole("gridcell", {
            name: "f2, White Pawn, move source selected",
            exact: true,
        }),
    ).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("f");
    await expect(whiteBoard).toBeVisible();
});
