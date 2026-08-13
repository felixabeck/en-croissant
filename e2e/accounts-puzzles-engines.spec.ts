import { expect, test } from "./fixtures";

test("accounts-puzzles-engines: navigates empty account, puzzle, and engine states", async ({
    page,
    assertAccessible,
    assertNoHorizontalOverflow,
    capture,
}) => {
    await page.route("https://www.encroissant.org/puzzle_databases", async (route) => {
        await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    });
    await page.goto("/accounts");
    await expect(page.getByRole("button", { name: /add account/i })).toBeVisible();
    await page.getByRole("button", { name: /add account/i }).click();
    const accountDialog = page.getByRole("dialog", { name: /add account/i });
    await expect(accountDialog.getByLabel(/username/i)).toBeVisible();
    await accountDialog.getByRole("button", { name: /close/i }).click();

    await page.getByRole("link", { name: /engines/i }).click();
    await expect(page.getByRole("heading", { name: /engines/i })).toBeVisible();
    await expect(page.getByText(/no engines installed/i)).toBeVisible();

    await page.getByRole("link", { name: /board/i }).click();
    await page.getByRole("button", { name: /^train$/i }).click();
    await expect(page.getByText(/puzzle training/i)).toBeVisible();
    await assertNoHorizontalOverflow();
    await assertAccessible();
    await capture("accounts-puzzles-engines");
    await expect(page).toHaveScreenshot("accounts-puzzles-engines.png", { fullPage: true });
});
