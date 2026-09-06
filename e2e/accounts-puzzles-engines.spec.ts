import { expect, test } from "./fixtures";

test("accounts-puzzles-engines: local engine validation is visible before any native issuance", async ({
    page,
    mockScenario,
    capture,
}) => {
    await mockScenario({ commands: { is_bmi2_compatible: { result: false } } });
    await page.route("https://www.encroissant.org/engines?*", async (route) => {
        await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    });
    await page.goto("/engines");
    await page.getByRole("button", { name: "Add New", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Add Engine", exact: true });
    await dialog.getByRole("tab", { name: "Local", exact: true }).click();
    await dialog.getByRole("button", { name: "Add", exact: true }).click();
    await expect(dialog.getByText("Name is required", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Path is required", { exact: true })).toBeVisible();
    const issuance = await page.evaluate(() =>
        window.__E2E_TAURI__
            .invocations()
            .filter(({ command }) =>
                ["issue_engine_binary", "issue_engine_image", "issue_engine_resource"].includes(
                    command,
                ),
            ),
    );
    expect(issuance).toEqual([]);
    await capture("engine-local-validation");
    await expect(dialog).toHaveScreenshot("engine-local-validation.png");
});

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
