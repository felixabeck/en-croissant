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
    await page.getByRole("button").filter({ hasText: databaseTitle }).dblclick();
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
