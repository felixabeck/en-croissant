import { expect, test } from "./fixtures";

test("board-keyboard: opens analysis and exposes a keyboard-operable board", async ({
    page,
    assertAccessible,
    assertNoHorizontalOverflow,
    capture,
}) => {
    await page.goto("/");

    await page.getByRole("button", { name: /^open$/i }).click();
    const board = page.getByRole("grid", { name: /chessboard/i });
    await expect(board).toBeVisible();
    await expect(board).toHaveAttribute("aria-activedescendant", "board-square-e2");
    await expect(page.getByLabel(/^result$/i)).toBeVisible();
    await board.focus();
    await expect(board).toBeFocused();

    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    await expect(page.getByText(/selected|illegal move/i)).toBeVisible();
    await assertNoHorizontalOverflow();
    await assertAccessible();
    await capture("board-keyboard");
    await expect(page).toHaveScreenshot("board-keyboard.png", { fullPage: true });
});
