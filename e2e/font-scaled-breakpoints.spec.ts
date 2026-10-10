import type { Locator, Page } from "@playwright/test";
import {
    assertNothingClipped,
    assertPageNotClipped,
    databaseCommands,
    expect,
    filesWorkspaceCommands,
    test,
    type MockScenario,
    gameOpeningFixture,
    gameOpeningCommands,
    selectFilesTreeRow,
} from "./fixtures";

const databaseTitle = "Breakpoint database";

test("font-scaled-breakpoints: visible library open controls wrap at 320px and 200%", async ({
    page,
    mockScenario,
    capture,
    assertNoHorizontalOverflow,
}) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await mockScenario({
        commands: filesWorkspaceCommands([[gameOpeningFixture.file]], gameOpeningCommands),
    });
    await page.goto("/databases");
    const databaseOpen = page.getByRole("button", { name: "Open database", exact: true });
    await expect(databaseOpen).toBeEnabled();
    await databaseOpen.scrollIntoViewIfNeeded();
    await assertNothingClipped(databaseOpen);
    await capture("database-open-320-200");
    await expect(page).toHaveScreenshot("database-open-320-200.png", { fullPage: true });
    await databaseOpen.click();
    const secondGame = page.getByRole("row").filter({ hasText: "Second White" });
    await expect(secondGame).toBeVisible();
    await secondGame.click();
    await expect(secondGame).toHaveAttribute("aria-selected", "true");
    const databaseGameOpen = page.getByRole("button", { name: "Open game", exact: true });
    await expect(databaseGameOpen).toBeVisible();
    await expect(databaseGameOpen).toBeEnabled();
    await databaseGameOpen.scrollIntoViewIfNeeded();
    await assertNothingClipped(databaseGameOpen, { mode: "reachable" });
    await capture("database-game-open-320-200");
    await expect(page).toHaveScreenshot("database-game-open-320-200.png", { fullPage: true });
    await page.goto("/files");
    await page.getByRole("button", { name: "Choose collection", exact: true }).click();
    await selectFilesTreeRow(page, gameOpeningFixture.file.name);
    const gameOpen = page.getByRole("button", { name: "Open game", exact: true });
    await expect(gameOpen).toBeEnabled();
    await gameOpen.scrollIntoViewIfNeeded();
    await assertNothingClipped(gameOpen);
    await assertNoHorizontalOverflow();
    await capture("files-open-320-200");
    await expect(page).toHaveScreenshot("files-open-320-200.png", { fullPage: true });
});
const databaseScenario: MockScenario = {
    commands: databaseCommands("breakpoint-db", "breakpoint.db3", {
        title: databaseTitle,
        description: "Font scale layout proof",
        player_count: 1,
        event_count: 1,
        game_count: 0,
        storage_size: 0,
        indexed: false,
    }),
};

async function seedFontScale(page: Page, scale: 50 | 100) {
    await page.addInitScript((fontScale) => {
        localStorage.setItem("font-size", String(fontScale));
    }, scale);
}

function settingsRoot(page: Page) {
    // The heading's Group belongs directly to the outer Stack, shared by both branches.
    return page.getByRole("heading", { name: "Settings", exact: true }).locator("../..");
}

function labelledSliderControl(scope: Locator | Page, title: "Font Size" | "Volume") {
    return scope.locator(`div[aria-label="${title}"]:not([role="slider"])`);
}

async function assertSettingsLayout(page: Page, compact: boolean) {
    await expect(page.getByRole("tablist")).toHaveAttribute(
        "aria-orientation",
        compact ? "horizontal" : "vertical",
    );
    if (compact) {
        await expect(settingsRoot(page)).toHaveAttribute("data-compact", "true");
    } else {
        await expect(settingsRoot(page)).not.toHaveAttribute("data-compact");
    }
}

async function assertSettingRow(control: Locator, compact: boolean) {
    const row = control.locator("..");
    await expect(control).toBeVisible();
    // Wrapping alone can imitate stacking without the compact CSS, so assert computed direction.
    await expect(row).toHaveCSS("flex-direction", compact ? "column" : "row");
    if (compact) {
        await expect
            .poll(() =>
                control.evaluate((element) => {
                    const rowElement = element.parentElement!;
                    const style = getComputedStyle(rowElement);
                    const contentWidth =
                        rowElement.getBoundingClientRect().width -
                        parseFloat(style.borderLeftWidth) -
                        parseFloat(style.borderRightWidth) -
                        parseFloat(style.paddingLeft) -
                        parseFloat(style.paddingRight);
                    return Math.abs(element.getBoundingClientRect().width - contentWidth);
                }),
            )
            .toBeLessThanOrEqual(1);
    }
}

async function selectDatabase(page: Page) {
    await expect(page.getByRole("heading", { name: "Databases", exact: true })).toBeVisible();
    await page.getByRole("button").filter({ hasText: databaseTitle }).click();
    await expect(page.getByRole("textbox", { name: "Name", exact: true })).toHaveValue(
        databaseTitle,
    );
}

async function assertDatabasePanes(page: Page, stacked: boolean) {
    const grid = page.locator(".mantine-SimpleGrid-root:has(> .mantine-Paper-root)");
    await expect(grid).toHaveCount(1);
    const panes = grid.locator(":scope > .mantine-Paper-root");
    await expect(panes).toHaveCount(2);
    await expect
        .poll(() =>
            panes.evaluateAll((elements) => {
                const [first, second] = elements.map((pane) => pane.getBoundingClientRect());
                return {
                    below: second.top >= first.bottom - 1,
                    beside: second.left >= first.right - 1,
                    sameLeft: Math.abs(second.left - first.left) <= 1,
                    sameTop: Math.abs(second.top - first.top) <= 1,
                    visiblePanes: [first, second].every(
                        (pane) => pane.width > 0 && pane.height > 0,
                    ),
                };
            }),
        )
        .toMatchObject(
            stacked
                ? { below: true, sameLeft: true, visiblePanes: true }
                : { beside: true, sameTop: true, visiblePanes: true },
        );
}

for (const scale of [200, 100] as const) {
    const compact = scale === 200;

    test(`font-scaled-breakpoints: Files create folder dialog at 800px and ${scale}%`, async ({
        page,
        mockScenario,
        capture,
    }) => {
        if (scale === 100) await seedFontScale(page, scale);
        await page.setViewportSize({ width: 800, height: 720 });
        await mockScenario({ commands: filesWorkspaceCommands([[]]) });
        await page.goto("/files");
        await page.getByRole("button", { name: "Choose collection", exact: true }).click();
        await page.getByRole("button", { name: "Create folder", exact: true }).click();
        const dialog = page.getByRole("dialog", { name: "Create folder", exact: true });
        await expect(dialog.getByRole("textbox", { name: "Name", exact: true })).toBeFocused();
        // At this width only the scaled Files threshold makes the rendered dialog full-screen.
        if (compact) {
            await expect
                .poll(() =>
                    dialog.evaluate((element) => {
                        const box = element.getBoundingClientRect();
                        return Math.max(
                            Math.abs(box.left),
                            Math.abs(box.top),
                            Math.abs(window.innerWidth - box.right),
                            Math.abs(window.innerHeight - box.bottom),
                        );
                    }),
                )
                .toBeLessThanOrEqual(1);
        } else {
            await expect
                .poll(() =>
                    dialog.evaluate((element) => {
                        const box = element.getBoundingClientRect();
                        return Math.min(
                            box.left,
                            box.top,
                            window.innerWidth - box.right,
                            window.innerHeight - box.bottom,
                        );
                    }),
                )
                .toBeGreaterThan(1);
        }
        await assertNothingClipped(dialog);
        await capture(`files-create-folder-800px-${scale}`);
    });

    test(`font-scaled-breakpoints: open tab setting rows at ${scale}%`, async ({
        page,
        capture,
    }) => {
        if (scale === 100) await seedFontScale(page, scale);
        await page.goto("/settings");
        await assertSettingsLayout(page, compact);
        await page.getByRole("tab", { name: "Appearance", exact: true }).click();
        const panel = page.getByRole("tabpanel", { name: "Appearance", exact: true });
        await expect(panel).toBeVisible();
        const control = labelledSliderControl(panel, "Font Size");
        await assertSettingRow(control, compact);
        await control.scrollIntoViewIfNeeded();
        await assertPageNotClipped(page);
        await capture(`settings-tab-row-${scale}`);
    });

    test(`font-scaled-breakpoints: search-result setting rows at ${scale}%`, async ({
        page,
        capture,
    }) => {
        if (scale === 100) await seedFontScale(page, scale);
        await page.goto("/settings");
        await page.getByPlaceholder("Search", { exact: true }).fill("font-size");
        await expect(page.getByRole("tablist")).toHaveCount(0);
        const control = labelledSliderControl(page, "Font Size");
        // This branch runs independently, so removing shared compact rules reports its own failure.
        await assertSettingRow(control, compact);
        if (compact) await expect(settingsRoot(page)).toHaveAttribute("data-compact", "true");
        await assertPageNotClipped(page);
        await capture(`settings-search-row-${scale}`);
    });

    test(`font-scaled-breakpoints: database panes at ${scale}%`, async ({
        page,
        mockScenario,
        capture,
    }) => {
        if (scale === 100) await seedFontScale(page, scale);
        await mockScenario(databaseScenario);
        await page.goto("/databases");
        await selectDatabase(page);
        await assertDatabasePanes(page, compact);
        await assertPageNotClipped(page);
        await capture(`database-panes-${scale}`);
    });
}

test("font-scaled-breakpoints: volume search card is unclipped at 200%", async ({
    page,
    capture,
}) => {
    await page.goto("/settings");
    await page.getByPlaceholder("Search", { exact: true }).fill("volume");
    await expect(page.getByRole("tablist")).toHaveCount(0);
    const control = labelledSliderControl(page, "Volume");
    await assertSettingRow(control, true);
    await expect(control.getByRole("slider", { name: "Volume", exact: true })).toBeVisible();
    await expect(control.locator(".mantine-Slider-markLabel")).toHaveText(["20%", "50%", "80%"]);
    await expect(settingsRoot(page)).toHaveAttribute("data-compact", "true");
    await assertPageNotClipped(page);
    await capture("settings-volume-search-200");
});

test("font-scaled-breakpoints: Settings stays vertical at 50% and 700px", async ({
    page,
    capture,
}) => {
    await seedFontScale(page, 50);
    await page.setViewportSize({ width: 700, height: 720 });
    await page.goto("/settings");
    await assertSettingsLayout(page, false);
    await assertPageNotClipped(page);
    await capture("settings-50-700px");
});

test("font-scaled-breakpoints: live slider change stacks Settings and database panes", async ({
    page,
    mockScenario,
    capture,
}) => {
    await seedFontScale(page, 100);
    await mockScenario(databaseScenario);
    await page.goto("/settings");
    const documentStartedAt = await page.evaluate(() => performance.timeOrigin);
    await assertSettingsLayout(page, false);
    await page.getByRole("tab", { name: "Appearance", exact: true }).click();
    const slider = page.getByRole("slider", { name: "Font Size", exact: true });
    await expect(slider).toHaveAttribute("aria-valuenow", "100");
    await slider.scrollIntoViewIfNeeded();
    await capture("live-settings-100");
    // Mantine's End key commits max through onChangeEnd, the same atom update as a mouse release.
    await slider.press("End");
    await expect(slider).toHaveAttribute("aria-valuenow", "200");
    await assertSettingsLayout(page, true);
    await assertSettingRow(labelledSliderControl(page, "Font Size"), true);
    await assertPageNotClipped(page);
    await capture("live-settings-200");

    await page
        .locator("nav.mantine-AppShell-navbar")
        .getByRole("link", { name: "Databases", exact: true })
        .click();
    await expect(page).toHaveURL("/databases");
    await selectDatabase(page);
    await assertDatabasePanes(page, true);
    await assertPageNotClipped(page);
    expect(await page.evaluate(() => performance.timeOrigin)).toBe(documentStartedAt);
    await capture("live-database-panes-200");
});
