import {
    expect,
    filesWorkspaceCommands,
    filesWorkspaceFixture,
    pgnFileCommands,
    assertFilesColumnsNotClipped,
    selectFilesTreeRow,
    test,
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
