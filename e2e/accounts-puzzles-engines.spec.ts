import { expect, test } from "./fixtures";

test("accounts-puzzles-engines: local settings and catalog upgrade modal", async ({
    page,
    mockScenario,
    capture,
}) => {
    await page.addInitScript(() => {
        localStorage.setItem(
            "engines",
            JSON.stringify([
                {
                    type: "local",
                    id: "stockfish-entry",
                    name: "Stockfish 18",
                    version: "18",
                    handle: { id: { id: "stockfish-18" }, kind: "engine" },
                    filename: "Stockfish 18",
                    elo: 3650,
                    loaded: true,
                    go: { t: "Infinite" },
                    settings: [
                        { type: "string", name: "Threads", value: "20" },
                        { type: "string", name: "Hash", value: "8192" },
                        { type: "string", name: "MultiPV", value: "4" },
                    ],
                },
            ]),
        );
        // This new settings proof uses the normal product font scale so all actions fit.
        localStorage.setItem("font-size", "100");
    });
    await mockScenario({
        commands: {
            is_bmi2_compatible: { result: false },
            file_exists: { result: true },
            verify_signed_bytes: { result: null },
            get_engine_config: {
                result: {
                    name: "Stockfish 18",
                    options: [
                        { type: "spin", value: { name: "Threads", default: 1, min: 1, max: 1024 } },
                        {
                            type: "spin",
                            value: { name: "Hash", default: 16, min: 1, max: 33554432 },
                        },
                        { type: "spin", value: { name: "MultiPV", default: 1, min: 1, max: 256 } },
                    ],
                },
            },
        },
    });
    await page.goto("/engines?selected=0");
    const upgrade = page.getByRole("button", { name: "Upgrade from catalog", exact: true });
    await expect(upgrade).toBeVisible();
    await upgrade.scrollIntoViewIfNeeded();
    await capture("engine-settings-upgrade");
    await expect(page).toHaveScreenshot("engine-settings-upgrade.png", { fullPage: true });
    await upgrade.click();
    const dialog = page.getByRole("dialog", { name: "Upgrade from catalog", exact: true });
    await expect(
        dialog.getByRole("button", { name: "Install", exact: true }).first(),
    ).toBeVisible();
    await capture("engine-upgrade-modal");
    await expect(dialog).toHaveScreenshot("engine-upgrade-modal.png");
});

test("accounts-puzzles-engines: add engine download catalog", async ({ page, mockScenario }) => {
    await page.addInitScript(() => {
        localStorage.setItem("font-size", "100");
    });
    // The engine catalog is bundled; mock its native signature check, the CPU-capability query and idle progress.
    await mockScenario({
        commands: {
            is_bmi2_compatible: { result: false },
            verify_signed_bytes: { result: null },
            get_progress: { result: null },
        },
    });
    await page.goto("/engines");
    await page.getByRole("button", { name: "Add New", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Add Engine", exact: true });
    await expect(dialog.getByRole("tab", { name: "Download", exact: true })).toHaveAttribute(
        "aria-selected",
        "true",
    );
    await expect(
        dialog.getByRole("button", { name: "Install", exact: true }).first(),
    ).toBeVisible();
    await expect(dialog).toHaveScreenshot("engine-add-catalog.png");
});

test("accounts-puzzles-engines: local engine validation is visible before any native issuance", async ({
    page,
    mockScenario,
    capture,
}) => {
    // The engine catalog is bundled; only its native signature check is mocked.
    await mockScenario({
        commands: {
            is_bmi2_compatible: { result: false },
            verify_signed_bytes: { result: null },
        },
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
    mockScenario,
    assertAccessible,
    assertNoHorizontalOverflow,
    capture,
}) => {
    // The puzzle catalog is bundled; only its native signature check is mocked.
    await mockScenario({ commands: { verify_signed_bytes: { result: null } } });
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

test("accounts-puzzles-engines: moves the active sidebar marker with navigation", async ({
    page,
    mockScenario,
}) => {
    await mockScenario({ commands: {} });
    await page.goto("/");

    const navbar = page.locator("nav.mantine-AppShell-navbar");
    const linkNames = ["User", "Files", "Databases", "Engines", "Settings", "Board"];
    const transparent = "rgba(0, 0, 0, 0)";
    await expect(navbar.getByRole("link")).toHaveCount(linkNames.length);

    for (const name of linkNames) {
        const clickedLink = navbar.getByRole("link", { name, exact: true });
        await clickedLink.click();
        await expect(clickedLink).toHaveAttribute("aria-current", "page");
        await expect(navbar.locator('a[aria-current="page"]')).toHaveCount(1);
        await expect
            .poll(() => clickedLink.evaluate((link) => getComputedStyle(link).borderLeftColor))
            .not.toBe(transparent);

        for (const otherName of linkNames) {
            if (otherName === name) continue;

            const otherLink = navbar.getByRole("link", { name: otherName, exact: true });
            await expect(otherLink).not.toHaveAttribute("aria-current", "page");
            await expect
                .poll(() => otherLink.evaluate((link) => getComputedStyle(link).borderLeftColor))
                .toBe(transparent);
        }
    }
});
