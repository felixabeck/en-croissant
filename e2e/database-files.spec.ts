import {
    databaseCommands,
    expect,
    filesWorkspaceCommands,
    filesWorkspaceFixture,
    pgnFileCommands,
    assertFilesColumnsNotClipped,
    assertNothingClipped,
    selectFilesTreeRow,
    test,
    type MockScenario,
    gameOpeningFixture,
    gameOpeningCommands,
    activeWorkspaceTab,
    databaseLayoutCommands,
    preserveStorageForReload,
    whitePawnSquares,
    waitForScrollAreaScrollbarsHidden,
    dragMosaicDivider,
} from "./fixtures";

for (const oldRoute of ["/files", "/databases"] as const) {
    test(`database-files: ${oldRoute} redirects to Library`, async ({ page }) => {
        await page.goto(oldRoute);
        await expect(page).toHaveURL("/library");
        await expect(page.getByRole("heading", { name: "Library", exact: true })).toBeVisible();
        const nav = page.locator("nav");
        await expect(nav.getByRole("link", { name: "Library", exact: true })).toHaveCount(1);
        await expect(nav.getByRole("link", { name: /^(Files|Databases)$/ })).toHaveCount(0);
    });
}

test("database-files: mixed Library retains hierarchy, selection, type filters and cross-kind keyboard opening", async ({
    page,
    mockScenario,
    assertAccessible,
    assertNoHorizontalOverflow,
    capture,
}) => {
    await page.addInitScript(() => localStorage.setItem("font-size", "100"));
    await page.setViewportSize({ width: 1440, height: 1000 });
    const sameName = gameOpeningFixture.file.name;
    const needle = {
        ...filesWorkspaceFixture.pgnFile,
        handle: { ...filesWorkspaceFixture.pgnFile.handle, id: { id: "needle-file" } },
        name: "Needle repertoire",
        metadata: { type: "repertoire", tags: [] },
    };
    const hidden = {
        ...needle,
        handle: { ...needle.handle, id: { id: "hidden" } },
        name: "Unmatched sibling",
    };
    const folder = { ...filesWorkspaceFixture.openingDirectory, children: [needle, hidden] };
    await mockScenario({
        commands: {
            ...filesWorkspaceCommands([[folder, gameOpeningFixture.file]], gameOpeningCommands),
            ...databaseCommands(gameOpeningFixture.databaseId, "opening.db3", {
                title: sameName,
                description: "Searchable database description",
                player_count: 2,
                event_count: 2,
                game_count: 2,
                storage_size: 1024,
                indexed: false,
            }),
        },
    });
    await page.goto("/library");
    await page.getByRole("button", { name: "Choose collection", exact: true }).click();
    const tree = page.getByRole("tree", { name: "Library", exact: true });
    await expect(tree).toHaveCount(1);
    const collision = tree.getByRole("treeitem", { name: sameName, exact: true });
    await expect(collision).toHaveCount(2);
    await collision.first().getByText(sameName, { exact: true }).click();
    const openGame = page.getByRole("button", { name: "Open game", exact: true });
    await expect(openGame).toBeVisible();
    await page.getByRole("textbox", { name: "Search", exact: true }).fill("Searchable database");
    await expect(collision).toHaveCount(1);
    await expect(openGame).toBeVisible();
    await page.getByRole("textbox", { name: "Search", exact: true }).fill("");
    await collision.last().getByText(sameName, { exact: true }).click();
    await expect(openGame).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Explore", exact: true })).toBeVisible();
    await page.getByRole("textbox", { name: "File type", exact: true }).click();
    await page.getByRole("option", { name: "Repertoire", exact: true }).click();
    await expect(collision).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Explore", exact: true })).toBeVisible();
    await page.getByRole("textbox", { name: "Search", exact: true }).fill("Needle");
    const folderRow = tree.getByRole("treeitem", { name: folder.name, exact: true });
    await folderRow.getByText(folder.name, { exact: true }).click();
    await expect(tree.getByRole("treeitem", { name: needle.name, exact: true })).toBeVisible();
    await expect(tree.getByRole("treeitem", { name: hidden.name, exact: true })).toHaveCount(0);
    await page.getByRole("textbox", { name: "Search", exact: true }).fill("");
    await page.getByRole("textbox", { name: "File type", exact: true }).click();
    await page.getByRole("option", { name: "Games database", exact: true }).click();
    await expect(tree.getByRole("treeitem")).toHaveCount(1);
    await tree.getByRole("treeitem").getByText(sameName, { exact: true }).click();
    await assertAccessible();
    await assertNoHorizontalOverflow();
    const explore = page.getByRole("link", { name: "Explore", exact: true });
    const buttonBox = (await explore.boundingBox())!;
    const labelBox = (await explore.locator(".mantine-Button-label").boundingBox())!;
    const centreOffset = Math.abs(
        labelBox.y + labelBox.height / 2 - (buttonBox.y + buttonBox.height / 2),
    );
    expect(centreOffset, "Explore label must be vertically centred").toBeLessThanOrEqual(2);
    await capture("library-database-selected");
    await expect(page).toHaveScreenshot("library-database-selected.png", { fullPage: true });
    // Clear the type filter and navigate across the final file row and database peer.
    await page.getByRole("button", { name: "Clear type filter", exact: true }).click();
    await expect(collision).toHaveCount(2);
    await collision.first().focus();
    await collision.first().press("ArrowDown");
    await expect(collision.last()).toBeFocused();
    await collision.last().press("Enter");
    await expect(page).toHaveURL(`/databases/${gameOpeningFixture.databaseId}`);
});

test("database-files: database view load failure stays reachable at 320px and 200% and Retry recovers", async ({
    page,
    mockScenario,
    assertNoHorizontalOverflow,
    capture,
}) => {
    const clockStart = new Date("2026-10-12T00:00:00Z");
    await page.clock.install({ time: clockStart });
    // Installation alone keeps ticking. Pause before app timers can schedule SWR's retry.
    await page.clock.pauseAt(clockStart.getTime() + 1000);
    await page.addInitScript(() => localStorage.setItem("font-size", "200"));
    await page.setViewportSize({ width: 320, height: 900 });
    await mockScenario({
        commands: {
            ...gameOpeningCommands,
            list_workspace_databases: {
                ...gameOpeningCommands.list_workspace_databases,
                outcomes: [
                    {
                        error: {
                            tag: "backend-error",
                            category: "database",
                            message: "Database listing unavailable",
                        },
                    },
                ],
            },
        },
    });
    await page.goto(`/databases/${gameOpeningFixture.databaseId}`);
    await expect(page.locator("html")).toHaveCSS("font-size", "32px");
    const alert = page.getByRole("alert");
    await expect(alert).toBeVisible();
    const failedAt = await page.evaluate(() => Date.now());
    const message = alert.getByText("Could not load databases. Please try again.", {
        exact: true,
    });
    const retry = alert.getByRole("button", { name: "Retry", exact: true });
    const overview = alert.getByRole("link", { name: "Library", exact: true });
    for (const element of [message, retry, overview]) {
        await expect(element).toBeInViewport({ ratio: 1 });
    }
    await expect(overview).toHaveAttribute("href", "/library");
    await assertNothingClipped(alert, { mode: "reachable" });
    await assertNoHorizontalOverflow();
    const listingAttempts = () =>
        page.evaluate(
            () =>
                window.__E2E_TAURI__
                    .invocations()
                    .filter((call) => call.command === "list_workspace_databases").length,
        );
    expect(await listingAttempts()).toBe(1);
    await page.clock.runFor(2000);
    expect(await page.evaluate(() => Date.now())).toBe(failedAt + 2000);
    expect(await listingAttempts()).toBe(1);
    await expect(alert).toBeVisible();
    await capture("database-view-load-failure-320-200");
    await retry.click();
    await expect.poll(listingAttempts).toBe(2);
    await expect(alert).toHaveCount(0);
    const games = page.getByRole("tabpanel", { name: "Games", exact: true }).first();
    await expect(games).toBeVisible();
    await expect(games.getByRole("row").filter({ hasText: "Second White" })).toBeVisible();
    expect(await listingAttempts()).toBe(2);
    expect(await page.evaluate(() => Date.now())).toBe(failedAt + 2000);
});

test("database-files: bounded drag and keyboard steps share a preference across tabs, compact reflow and reload", async ({
    page,
    mockScenario,
    assertNoHorizontalOverflow,
    capture,
}) => {
    await page.addInitScript(() => localStorage.setItem("font-size", "100"));
    await page.setViewportSize({ width: 2000, height: 1200 });
    await mockScenario({ commands: databaseLayoutCommands });
    await page.goto(`/databases/${gameOpeningFixture.databaseId}`);
    await expect
        .poll(() => page.evaluate(() => getComputedStyle(document.documentElement).fontSize))
        .toBe("16px");
    const gamesPanel = page.getByRole("tabpanel", { name: "Games", exact: true }).first();
    const layout = gamesPanel.locator("[data-database-layout]");
    const split = layout.locator(".mosaic-split");
    const root = layout.locator(".mosaic-root");
    const saved = () => page.evaluate(() => localStorage.getItem("database-table-percentage"));
    await expect(split).toHaveCount(1);
    expect(await saved()).toBeNull();
    await page.getByRole("row").filter({ hasText: "Second White" }).click();
    const board = page.locator(".cg-wrap");
    const assertPreview = async () => {
        const square = (await board.boundingBox())!;
        expect(Math.abs(square.width - square.height)).toBeLessThanOrEqual(1);
        const frame = (await page.locator("[data-preview-arrangement]").boundingBox())!;
        const metadata = (await gamesPanel
            .locator(".mantine-Paper-root:has([data-preview-arrangement])")
            .first()
            .locator(".mantine-SimpleGrid-root")
            .boundingBox())!;
        expect(frame.y).toBeGreaterThan(metadata.y + metadata.height);
        expect(square.y + square.height).toBeLessThanOrEqual(frame.y + frame.height + 1);
        for (const name of ["d4", "d5", "Go to start", "Previous move", "Next move", "Go to end"]) {
            await expect(page.getByRole("button", { name, exact: true })).toBeInViewport({
                ratio: 1,
            });
        }
        await assertNothingClipped(gamesPanel, { mode: "reachable" });
    };
    const initial = (await board.boundingBox())!.width;
    await dragMosaicDivider(page, {
        root,
        split,
        percentage: 5,
        direction: "row",
        release: false,
    });
    expect(await saved()).toBeNull();
    await page.mouse.up();
    await expect(layout).toHaveAttribute("data-percentage", "20");
    expect(Number(await saved())).toBe(20);
    await expect(page.getByRole("button", { name: "Enlarge preview", exact: true })).toBeDisabled();
    await expect.poll(async () => (await board.boundingBox())!.width).toBeGreaterThan(500);
    expect((await board.boundingBox())!.width).toBeGreaterThan(initial);
    await expect(page.locator("[data-preview-arrangement]")).toHaveAttribute(
        "data-preview-arrangement",
        "beside",
    );
    await page.getByRole("button", { name: "Next move", exact: true }).click();
    const selected = ["a2", "b2", "c2", "d4", "e2", "f2", "g2", "h2"];
    await expect.poll(() => whitePawnSquares(board)).toEqual(selected);
    for (const name of ["Go to start", "Previous move", "Next move", "Go to end"]) {
        await expect(page.getByRole("button", { name, exact: true })).toBeInViewport({ ratio: 1 });
    }
    await assertPreview();
    await page.mouse.move(1999, 1199);
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    await waitForScrollAreaScrollbarsHidden(page);
    await capture("database-adaptive-wide");
    await expect(page).toHaveScreenshot("database-adaptive-wide.png");
    await dragMosaicDivider(page, { root, split, percentage: 95, direction: "row" });
    await expect(layout).toHaveAttribute("data-percentage", "80");
    await expect(page.getByRole("button", { name: "Enlarge table", exact: true })).toBeDisabled();
    const enlargePreview = page.getByRole("button", { name: "Enlarge preview", exact: true });
    await page.getByRole("tab", { name: "Games", exact: true }).first().focus();
    await page.keyboard.press("Tab");
    await expect(enlargePreview).toBeFocused();
    await enlargePreview.press("Enter");
    await expect(layout).toHaveAttribute("data-percentage", "75");
    expect(await saved()).toBe("75");
    await expect(page.locator("[data-preview-arrangement]")).toHaveAttribute(
        "data-preview-arrangement",
        "below",
    );
    await expect.poll(() => whitePawnSquares(board)).toEqual(selected);
    await assertPreview();
    await page.mouse.move(1999, 1199);
    await waitForScrollAreaScrollbarsHidden(page);
    await capture("database-adaptive-tall");
    await expect(page).toHaveScreenshot("database-adaptive-tall.png");
    for (const name of ["Players", "Events", "Games"]) {
        await page.getByRole("tab", { name, exact: true }).first().click();
        await expect(page.locator("[data-database-layout]:visible")).toHaveAttribute(
            "data-percentage",
            "75",
        );
    }
    await page.setViewportSize({ width: 900, height: 900 });
    await expect
        .poll(async () => Number(await layout.getAttribute("data-percentage")))
        .toBeLessThan(75);
    expect(await saved()).toBe("75");
    expect(
        (await gamesPanel.locator('[data-database-pane="preview"]').boundingBox())!.width,
    ).toBeGreaterThanOrEqual(320);
    await page.setViewportSize({ width: 320, height: 900 });
    await expect(split).toHaveCount(0);
    expect(await saved()).toBe("75");
    await expect.poll(() => whitePawnSquares(board)).toEqual(selected);
    await page.setViewportSize({ width: 2000, height: 1200 });
    await expect(layout).toHaveAttribute("data-percentage", "75");
    await expect.poll(() => whitePawnSquares(board)).toEqual(selected);
    await preserveStorageForReload(page);
    await expect(layout).toHaveAttribute("data-percentage", "75");
    expect(await saved()).toBe("75");
    await assertNoHorizontalOverflow();
});

for (const width of [320, 1250]) {
    test(`database-files: populated compact tabs remain reachable at ${width}px and 200%`, async ({
        page,
        mockScenario,
        assertNoHorizontalOverflow,
    }) => {
        await page.addInitScript(() => localStorage.setItem("font-size", "200"));
        await page.setViewportSize({ width, height: 900 });
        await mockScenario({ commands: databaseLayoutCommands });
        await page.goto(`/databases/${gameOpeningFixture.databaseId}`);
        const view = page.locator("[data-database-view]");
        await expect(view).toHaveAttribute("data-compact", "true");
        await expect(view).toHaveCSS("overflow-y", "auto");
        await expect(view.locator(".mosaic-split")).toHaveCount(0);
        if (width === 1250) {
            expect(await page.evaluate(() => matchMedia("(min-width: 72em)").matches)).toBe(true);
            expect(await view.evaluate((element) => element.clientWidth)).toBeLessThan(1286);
        }
        for (const name of ["Games", "Players", "Events"]) {
            const tab = page.getByRole("tab", { name, exact: true }).first();
            await tab.scrollIntoViewIfNeeded();
            await tab.click();
            const panel = page.getByRole("tabpanel", { name, exact: true }).first();
            const row = panel.locator('[data-database-pane="table"] tbody tr').filter({
                hasText:
                    name === "Games"
                        ? "Second White"
                        : name === "Players"
                          ? "First White"
                          : "First event",
            });
            await row.scrollIntoViewIfNeeded();
            await row.click();
            const preview = panel.locator('[data-database-pane="preview"]');
            await expect(preview).toContainText(
                name === "Games"
                    ? "Second event"
                    : name === "Players"
                      ? "First White"
                      : "First event",
            );
            if (name === "Games") {
                for (const element of [
                    preview.locator(".cg-wrap"),
                    preview.getByRole("button", { name: "d4", exact: true }),
                    ...["Go to start", "Previous move", "Next move", "Go to end", "Open game"].map(
                        (label) => preview.getByRole("button", { name: label, exact: true }),
                    ),
                ]) {
                    await element.evaluate((node) => node.scrollIntoView({ block: "center" }));
                    if (
                        width === 1250 &&
                        (await element.evaluate((node) => node.classList.contains("cg-wrap")))
                    ) {
                        for (const edge of ["start", "end"] as const) {
                            await element.evaluate(
                                (node, block) => node.scrollIntoView({ block }),
                                edge,
                            );
                            await expect
                                .poll(() =>
                                    element.evaluate((node, block) => {
                                        const view = node
                                            .closest("[data-database-view]")!
                                            .getBoundingClientRect();
                                        const board = node.getBoundingClientRect();
                                        return block === "start"
                                            ? board.top >= view.top - 1
                                            : board.bottom <= view.bottom + 1;
                                    }, edge),
                                )
                                .toBe(true);
                        }
                    } else await expect(element).toBeInViewport({ ratio: 1 });
                    await assertNothingClipped(element, { mode: "reachable" });
                }
                expect(await view.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
            } else {
                await preview.scrollIntoViewIfNeeded();
                if (name === "Players")
                    await expect(preview.locator(".recharts-surface")).not.toHaveCount(0);
                else
                    await expect(
                        preview.getByRole("row").filter({ hasText: "Second White" }),
                    ).toBeVisible();
            }
            await assertNothingClipped(panel, { mode: "reachable" });
            await assertNoHorizontalOverflow();
        }
    });
}

const { openingDirectory, pgnFile } = filesWorkspaceFixture;

test("database-files: long player metadata leaves nested preview tabs and charts reachable", async ({
    page,
    mockScenario,
    assertNoHorizontalOverflow,
}) => {
    const longName = `First White ${"Long ".repeat(100)}`;
    await page.addInitScript(() => localStorage.setItem("font-size", "200"));
    await page.setViewportSize({ width: 320, height: 900 });
    await mockScenario({
        commands: {
            ...databaseLayoutCommands,
            get_players: { result: { data: [{ id: 1, name: longName, elo: 1500 }], count: 1 } },
        },
    });
    await page.goto(`/databases/${gameOpeningFixture.databaseId}`);
    await page.getByRole("tab", { name: "Players", exact: true }).click();
    const panel = page.getByRole("tabpanel", { name: "Players", exact: true });
    await panel.locator('[data-database-pane="table"] tbody tr').click();
    const preview = panel.locator('[data-database-pane="preview"]');
    await expect(preview.getByText(longName, { exact: true })).toBeVisible();
    const overview = preview.getByRole("tab", { name: "Overview", exact: true });
    const label = overview.locator(".mantine-Tabs-tabLabel");
    await label.evaluate((node) => node.scrollIntoView({ block: "center" }));
    await expect(label).toBeInViewport({ ratio: 1 });
    await overview.click();
    await assertNothingClipped(overview, { mode: "reachable" });
    await expect(preview.locator(".recharts-surface")).not.toHaveCount(0);
    await assertNothingClipped(preview, { mode: "reachable" });
    await assertNoHorizontalOverflow();
});

test("database-files: short split panes retain table rows, board, notation and controls at 200%", async ({
    page,
    mockScenario,
    assertNoHorizontalOverflow,
}) => {
    await page.addInitScript(() => localStorage.setItem("font-size", "200"));
    await page.setViewportSize({ width: 2000, height: 720 });
    await mockScenario({ commands: databaseLayoutCommands });
    await page.goto(`/databases/${gameOpeningFixture.databaseId}`);
    const panel = page.getByRole("tabpanel", { name: "Games", exact: true }).first();
    await expect(panel.locator(".mosaic-split")).toHaveCount(1);
    await page.keyboard.press("ArrowDown");
    const preview = panel.locator('[data-database-pane="preview"]');
    const board = preview.locator(".cg-wrap");
    await expect.poll(async () => (await board.boundingBox())?.width ?? 0).toBeGreaterThan(0);
    const row = panel
        .locator('[data-database-pane="table"] tbody tr')
        .filter({ hasText: "First White" });
    const playerName = row.getByText("First White", { exact: true });
    await playerName.scrollIntoViewIfNeeded();
    await expect(playerName).toBeInViewport({ ratio: 1 });
    await assertNothingClipped(row, { mode: "reachable" });
    for (const edge of ["start", "end"] as const) {
        await board.evaluate((node, block) => node.scrollIntoView({ block }), edge);
        await expect(board).toBeInViewport();
        await assertNothingClipped(board, { mode: "reachable" });
    }
    for (const name of [
        "e4",
        "e5",
        "Go to start",
        "Previous move",
        "Next move",
        "Go to end",
        "Open game",
    ]) {
        const control = preview.getByRole("button", { name, exact: true });
        await control.evaluate((node) => node.scrollIntoView({ block: "center" }));
        await expect(control).toBeInViewport({ ratio: 1 });
        await assertNothingClipped(control, { mode: "reachable" });
    }
    await assertNoHorizontalOverflow();
});

for (const gesture of ["button", "double-click", "Enter"] as const) {
    test(`database-files: visible database opener and explicit game ${gesture}`, async ({
        page,
        mockScenario,
        capture,
    }) => {
        await page.setViewportSize({ width: 1400, height: 900 });
        await mockScenario({ commands: gameOpeningCommands });
        await page.goto("/library");
        const opener = page.getByRole("button", { name: "Open database", exact: true });
        await expect(opener).toHaveText("Open database");
        await expect(opener.locator("../..")).toContainText(gameOpeningFixture.databaseTitle);
        await expect(opener.locator("button")).toHaveCount(0);
        await capture("database-labelled-opener");
        await expect(page).toHaveScreenshot("database-labelled-opener.png", { fullPage: true });
        await opener.click();
        await expect(page).toHaveURL(`/databases/${gameOpeningFixture.databaseId}`);
        const rows = page.locator("tbody tr");
        const second = rows.filter({ hasText: "Second White" });
        const openGame = page.getByRole("button", { name: "Open game", exact: true });
        await expect(openGame).toBeDisabled();
        if (gesture === "button") {
            await second.click();
            await expect(page).toHaveURL(`/databases/${gameOpeningFixture.databaseId}`);
            await expect(second).toHaveAttribute("aria-selected", "true");
            await expect(openGame).toBeEnabled();
            await expect(openGame).toHaveText("Open game");
            await page.mouse.move(1399, 899);
            await waitForScrollAreaScrollbarsHidden(page);
            await capture("database-labelled-game");
            await expect(page).toHaveScreenshot("database-labelled-game.png", { fullPage: true });
            await openGame.click();
        } else if (gesture === "double-click") await second.dblclick();
        else {
            await second.focus();
            await second.press("Enter");
        }
        await expect(page).toHaveURL(/\/$/);
        await expect(page.getByRole("tab", { name: /Second White - Second Black/ })).toBeVisible();
        expect((await activeWorkspaceTab(page))?.gameOrigin).toEqual({
            kind: "database",
            database: { id: { id: gameOpeningFixture.databaseId }, kind: "database" },
            gameId: 202,
        });
        await expect(page.getByRole("button", { name: "d4", exact: true })).toBeVisible();
    });
}

test("database-files: metadata-only editing fits 320px and relists the chosen type", async ({
    page,
    mockScenario,
    assertNoHorizontalOverflow,
    assertAccessible,
}) => {
    await page.setViewportSize({ width: 320, height: 900 });
    const initial = { ...pgnFile, metadata: { type: "other", tags: ["keep"] } };
    const edited = { ...initial, metadata: { type: "repertoire", tags: ["keep"] } };
    await mockScenario({
        commands: filesWorkspaceCommands([[initial], [edited]], {
            ...pgnFileCommands,
            write_workspace_file_metadata: { result: null },
        }),
    });
    await page.goto("/library");
    await page.getByRole("button", { name: /choose collection/i }).click();
    await selectFilesTreeRow(page, initial.name);
    await page.getByRole("button", { name: "Edit metadata", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Edit metadata", exact: true });
    const name = dialog.getByRole("textbox", { name: "Name", exact: true });
    await expect(name).toBeFocused();
    await expect(name).toHaveValue(initial.name);
    await dialog.getByRole("textbox", { name: /file type/i }).click();
    await page.getByRole("option", { name: "Repertoire", exact: true }).click();
    await assertNoHorizontalOverflow();
    await assertNothingClipped(dialog);
    await assertAccessible();
    await dialog.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(
        page.getByRole("treeitem").locator(".mantine-Badge-root").filter({ hasText: "Repertoire" }),
    ).toBeVisible();
    const mutations = await page.evaluate(() =>
        window.__E2E_TAURI__
            .invocations()
            .filter((call) =>
                ["write_workspace_file_metadata", "rename_workspace_file"].includes(call.command),
            ),
    );
    expect(mutations).toHaveLength(1);
    expect(mutations[0]).toEqual({
        command: "write_workspace_file_metadata",
        args: {
            workspace: filesWorkspaceFixture.workspace,
            entry: initial.handle,
            metadata: edited.metadata,
        },
    });
});

test("database-files: grants a workspace and creates a folder through typed IPC", async ({
    page,
    mockScenario,
    assertAccessible,
    assertNoHorizontalOverflow,
    capture,
}) => {
    await mockScenario({
        commands: filesWorkspaceCommands([[pgnFile], [openingDirectory, pgnFile]], {
            ...pgnFileCommands,
            create_workspace_directory: { result: openingDirectory },
        }),
    });
    await page.goto("/library");

    await page.getByRole("button", { name: /choose collection/i }).click();
    await expect(page.getByRole("button", { name: /create folder/i })).toBeVisible();
    await expect(page.getByText("Openings")).toHaveCount(0);
    await page.getByRole("button", { name: /create folder/i }).click();
    const dialog = page.getByRole("dialog", { name: /create folder/i });
    await expect(dialog.getByLabel(/name/i)).toBeFocused();
    await dialog.getByLabel(/name/i).fill("Openings");
    await dialog.getByRole("button", { name: /confirm/i }).click();
    await expect(page.locator('[data-modal-content="true"]')).toHaveCount(0);

    await expect(page.getByText("Openings")).toBeVisible();
    await selectFilesTreeRow(page, pgnFile.name);
    await expect(page.getByRole("button", { name: "Open game", exact: true })).toBeVisible();
    await expect(page.getByText("Weiss - Schwarz")).toBeVisible();
    await assertNoHorizontalOverflow();
    await assertFilesColumnsNotClipped(page);
    await assertAccessible();
    await capture("database-files");
    await expect(page).toHaveScreenshot("database-files.png", { fullPage: true });
});

const databaseKey = "navigation-db";
const databaseTitle = "Navigation database";
const databaseScenario: MockScenario = {
    commands: {
        ...databaseCommands(databaseKey, "navigation.db3", {
            title: databaseTitle,
            description: "",
            player_count: 0,
            event_count: 0,
            game_count: 0,
            storage_size: 0,
            indexed: false,
        }),
        get_games: { result: { data: [], count: 0 } },
        get_players: { result: { data: [], count: 0 } },
        get_tournaments: { result: { data: [], count: 0 } },
    },
};

test("database-files: concurrent conversions render their own live progress counters", async ({
    page,
    mockScenario,
    emitTauriEvent,
    capture,
    assertAccessible,
    assertNoHorizontalOverflow,
}) => {
    await mockScenario({
        commands: {
            ...databaseScenario.commands,
            issue_pgn_workspace: {
                results: [
                    {
                        handle: { id: { id: "first-pgn" }, kind: "fileWorkspace" },
                        displayName: "first.pgn",
                        availability: "available",
                    },
                    {
                        handle: { id: { id: "second-pgn" }, kind: "fileWorkspace" },
                        displayName: "second.pgn",
                        availability: "available",
                    },
                ],
            },
            count_pgn_games: { result: 100 },
            convert_pgn: { delay: 60_000, result: null },
            cancel_conversion: { delay: 60_000, result: true },
        },
    });
    await page.goto("/library");
    await page.getByRole("button").filter({ hasText: databaseTitle }).click();
    const addGames = page.getByRole("button", { name: /^add games$/i });
    // Admit both native pickers before conversion makes the selected target unavailable.
    await addGames.evaluate((button: HTMLButtonElement) => {
        button.click();
        button.click();
    });
    await expect(page.getByText("Convert: first", { exact: true })).toBeVisible();
    await expect(addGames).toHaveCount(0);
    await expect(page.getByText("Convert: second", { exact: true })).toBeVisible();

    const ids = await page.evaluate(() =>
        window.__E2E_TAURI__
            .invocations()
            .filter((call) => call.command === "convert_pgn")
            .map((call) => (call.args as { progressId: string }).progressId),
    );
    expect(ids).toHaveLength(2);
    expect(ids[0]).toMatch(/^conversion:[0-9a-f-]{36}$/);
    expect(ids[1]).toMatch(/^conversion:[0-9a-f-]{36}$/);
    expect(ids[0]).not.toBe(ids[1]);
    await emitTauriEvent({
        event: "convert-progress",
        payload: {
            id: ids[0],
            imported_games: 120,
            elapsed_ms: 2000,
            source_file_name: "first.pgn",
        },
    });
    await emitTauriEvent({
        event: "convert-progress",
        payload: {
            id: ids[1],
            imported_games: 42,
            elapsed_ms: 3000,
            source_file_name: "second.pgn",
        },
    });
    const firstRow = page.getByText("Convert: first.pgn", { exact: true }).locator("../..");
    const secondRow = page.getByText("Convert: second.pgn", { exact: true }).locator("../..");
    await expect(firstRow).toHaveText("Convert: first.pgn120 games • 60.0 games/sCancel");
    await expect(secondRow).toHaveText("Convert: second.pgn42 games • 14.0 games/sCancel");
    await secondRow.scrollIntoViewIfNeeded();
    await expect(secondRow).toBeInViewport();
    // Client navigation preserves the fixture session and the app-owned conversion registry.
    await page.getByRole("link", { name: "Board", exact: true }).click();
    await page.getByRole("link", { name: "Library", exact: true }).click();
    await expect(firstRow).toHaveText("Convert: first.pgn120 games • 60.0 games/sCancel");
    await expect(secondRow).toHaveText("Convert: second.pgn42 games • 14.0 games/sCancel");
    await assertNoHorizontalOverflow();
    await assertAccessible();
    await capture("conversion-active");
    await expect(page).toHaveScreenshot("conversion-active.png", { fullPage: true });
    const cancel = firstRow.getByRole("button", { name: "Cancel: first.pgn", exact: true });
    await cancel.click();
    await expect(cancel).toBeDisabled();
    await expect(
        secondRow.getByRole("button", { name: "Cancel: second.pgn", exact: true }),
    ).toBeEnabled();
    const calls = await page.evaluate(() => window.__E2E_TAURI__.invocations());
    const converted = calls.filter((call) => call.command === "convert_pgn");
    expect(
        (calls.find((call) => call.command === "cancel_conversion")!.args as { ticket: string })
            .ticket,
    ).toBe((converted[0].args as { ticket: string }).ticket);
    expect((converted[0].args as { ticket: string }).ticket).not.toBe(
        (converted[1].args as { ticket: string }).ticket,
    );
    await capture("conversion-cancel-pending");
    await expect(page).toHaveScreenshot("conversion-cancel-pending.png", { fullPage: true });
    await expect(
        page.getByRole("button", { name: "Import or download database", exact: true }),
    ).toBeDisabled();
});

test("database-files: an unfinished import stays visible with Delete and no reference star", async ({
    page,
    mockScenario,
    assertAccessible,
    assertNoHorizontalOverflow,
    capture,
}) => {
    await mockScenario({
        commands: {
            ...databaseScenario.commands,
            get_db_info: {
                error: {
                    tag: "backend-error",
                    category: "invalid-input",
                    message: "Invalid input: Database has not been initialized yet",
                },
            },
        },
    });
    await page.goto("/library");
    const card = page
        .getByRole("button")
        .filter({ hasText: "Import did not finish — delete it and import again" });
    await expect(card).toBeVisible();
    await expect(card).toContainText("navigation.db3");
    await expect(card.locator(".mantine-Rating-root")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Open database", exact: true })).toHaveCount(0);
    await card.dblclick();
    await expect(page).toHaveURL("/library");
    await expect(page.getByRole("button", { name: "Delete", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Explore", exact: true })).toHaveCount(0);
    await assertNoHorizontalOverflow();
    await assertAccessible();
    await capture("database-unfinished-import");
    await expect(page).toHaveScreenshot("database-unfinished-import.png", { fullPage: true });
});

test("database-files: Back opens the overview and ends the active database session", async ({
    page,
    mockScenario,
}) => {
    await mockScenario(databaseScenario);
    await page.goto("/library");
    await page.getByRole("button").filter({ hasText: databaseTitle }).dblclick();
    await expect(page).toHaveURL(`/databases/${databaseKey}`);
    await expect(page.getByRole("heading", { name: databaseTitle, exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page).toHaveURL("/library");
    await expect(page.getByRole("heading", { name: "Library", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: databaseTitle, exact: true })).toBeHidden();

    const navbar = page.locator("nav.mantine-AppShell-navbar");
    await navbar.getByRole("link", { name: "Board", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await navbar.getByRole("link", { name: "Library", exact: true }).click();
    await expect(page).toHaveURL("/library");
    await expect(page.getByRole("heading", { name: "Library", exact: true })).toBeVisible();
});

test("database-files: the sidebar resumes the active database view", async ({
    page,
    mockScenario,
}) => {
    await mockScenario(databaseScenario);
    await page.goto("/library");
    await page.getByRole("button").filter({ hasText: databaseTitle }).click();
    await page.getByRole("link", { name: "Explore", exact: true }).click();
    await expect(page).toHaveURL(`/databases/${databaseKey}`);
    await expect(page.getByRole("heading", { name: databaseTitle, exact: true })).toBeVisible();

    const navbar = page.locator("nav.mantine-AppShell-navbar");
    await navbar.getByRole("link", { name: "Board", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    const databasesLink = navbar.getByRole("link", { name: "Library", exact: true });
    await expect(databasesLink).not.toHaveAttribute("aria-current", "page");
    await databasesLink.click();
    await expect(page).toHaveURL(`/databases/${databaseKey}`);
    await expect(page.getByRole("heading", { name: databaseTitle, exact: true })).toBeVisible();
    await expect(databasesLink).toHaveAttribute("aria-current", "page");
});
