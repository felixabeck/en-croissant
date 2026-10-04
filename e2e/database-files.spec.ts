import {
    expect,
    filesWorkspaceCommands,
    filesWorkspaceFixture,
    pgnFileCommands,
    assertFilesColumnsNotClipped,
    selectFilesTreeRow,
    test,
    type MockScenario,
} from "./fixtures";

const { openingDirectory, pgnFile } = filesWorkspaceFixture;

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
    await page.goto("/files");

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
    await expect(page.getByRole("button", { name: /^open$/i })).toBeVisible();
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
        list_workspace_databases: {
            result: [
                {
                    handle: { id: { id: databaseKey }, kind: "database" },
                    filename: "navigation.db3",
                    availability: "available",
                },
            ],
        },
        get_db_info: {
            result: {
                title: databaseTitle,
                description: "",
                player_count: 0,
                event_count: 0,
                game_count: 0,
                storage_size: 0,
                indexed: false,
            },
        },
        get_games: { result: { data: [], count: 0 } },
        get_players: { result: { data: [], count: 0 } },
        get_tournaments: { result: { data: [], count: 0 } },
    },
};

test("database-files: concurrent conversions render their own live progress counters", async ({
    page,
    mockScenario,
    emitTauriEvent,
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
        },
    });
    await page.goto("/databases");
    await page.getByRole("button").filter({ hasText: databaseTitle }).click();
    const addGames = page.getByRole("button", { name: /^add games$/i });
    await addGames.click();
    await expect(page.getByText("Convert: first", { exact: true })).toBeVisible();
    await expect(addGames).toBeEnabled();
    await addGames.click();
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
    await expect(firstRow).toHaveText("Convert: first.pgn120 games • 60.0 games/s");
    await expect(secondRow).toHaveText("Convert: second.pgn42 games • 14.0 games/s");
    await secondRow.scrollIntoViewIfNeeded();
    await expect(secondRow).toBeInViewport();
    await expect(page.getByRole("button", { name: /^add new$/i })).toBeDisabled();
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
    await page.goto("/databases");
    const card = page
        .getByRole("button")
        .filter({ hasText: "Import did not finish — delete it and import again" });
    await expect(card).toBeVisible();
    await expect(card).toContainText("navigation.db3");
    await expect(card.locator(".mantine-Rating-root")).toHaveCount(0);
    await card.dblclick();
    await expect(page).toHaveURL("/databases");
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
    await page.goto("/databases");
    await page.getByRole("button").filter({ hasText: databaseTitle }).dblclick();
    await expect(page).toHaveURL(`/databases/${databaseKey}`);
    await expect(page.getByRole("heading", { name: databaseTitle, exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page).toHaveURL("/databases");
    await expect(page.getByRole("heading", { name: "Databases", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: databaseTitle, exact: true })).toBeHidden();

    const navbar = page.locator("nav.mantine-AppShell-navbar");
    await navbar.getByRole("link", { name: "Files", exact: true }).click();
    await expect(page).toHaveURL("/files");
    await navbar.getByRole("link", { name: "Databases", exact: true }).click();
    await expect(page).toHaveURL("/databases");
    await expect(page.getByRole("heading", { name: "Databases", exact: true })).toBeVisible();
});

test("database-files: the sidebar resumes the active database view", async ({
    page,
    mockScenario,
}) => {
    await mockScenario(databaseScenario);
    await page.goto("/databases");
    await page.getByRole("button").filter({ hasText: databaseTitle }).click();
    await page.getByRole("link", { name: "Explore", exact: true }).click();
    await expect(page).toHaveURL(`/databases/${databaseKey}`);
    await expect(page.getByRole("heading", { name: databaseTitle, exact: true })).toBeVisible();

    const navbar = page.locator("nav.mantine-AppShell-navbar");
    await navbar.getByRole("link", { name: "Files", exact: true }).click();
    await expect(page).toHaveURL("/files");
    const databasesLink = navbar.getByRole("link", { name: "Databases", exact: true });
    await expect(databasesLink).not.toHaveAttribute("aria-current", "page");
    await databasesLink.click();
    await expect(page).toHaveURL(`/databases/${databaseKey}`);
    await expect(page.getByRole("heading", { name: databaseTitle, exact: true })).toBeVisible();
    await expect(databasesLink).toHaveAttribute("aria-current", "page");
});
