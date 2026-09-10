import { expect, test } from "./fixtures";

test("async-errors: localizes directory-trash failures in the confirmation dialog", async ({
    page,
    mockScenario,
    assertAccessible,
}) => {
    const workspace = { id: { id: "files-workspace" }, kind: "fileWorkspace" };
    await mockScenario({
        commands: {
            issue_file_workspace: {
                result: {
                    handle: workspace,
                    displayName: "E2E collection",
                    availability: "available",
                },
            },
            list_file_workspace: {
                result: [
                    {
                        handle: { id: { id: "opening-directory" }, kind: "fileWorkspace" },
                        kind: "directory",
                        name: "Openings",
                        children: [],
                        metadata: null,
                        gameCount: null,
                        lastModified: 0,
                    },
                ],
            },
            trash_workspace_entry: { error: "private native diagnostic at /private/file.pgn" },
        },
    });
    await page.goto("/files");
    await page.getByRole("button", { name: "Sammlung auswählen" }).click();
    await page
        .getByRole("treeitem", { name: "Openings", exact: true })
        .getByRole("button", { name: "Löschen" })
        .click();
    const dialog = page.getByRole("dialog", { name: "In den Papierkorb verschieben", exact: true });
    await dialog.getByRole("button", { name: "Löschen", exact: true }).click();
    await expect(dialog.getByRole("alert")).toHaveText(
        "Die Aktion konnte nicht abgeschlossen werden. Bitte versuche es erneut.",
    );
    await expect(dialog.getByRole("button", { name: "Löschen", exact: true })).toBeEnabled();
    await expect(page.locator("body")).not.toContainText("private native diagnostic");
    await expect(page.locator("body")).not.toContainText("/private/file.pgn");
    // The Files page behind this modal has a separately filed narrow-layout defect.
    // Check the changed dialog itself without claiming that background layout is fixed.
    const dimensions = await dialog.evaluate((element) => ({
        content: element.scrollWidth,
        width: element.clientWidth,
        left: element.getBoundingClientRect().left,
        right: element.getBoundingClientRect().right,
        viewport: window.innerWidth,
    }));
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.width);
    expect(dimensions.left).toBeGreaterThanOrEqual(0);
    expect(dimensions.right).toBeLessThanOrEqual(dimensions.viewport);
    await assertAccessible();
    await dialog.getByRole("button", { name: "Löschen", exact: true }).scrollIntoViewIfNeeded();
    await expect(page).toHaveScreenshot("confirmation-error.png", { fullPage: true });
});

test("async-errors: verifies German navigation and a delayed native rejection at 200% font scale", async ({
    page,
    mockScenario,
    assertAccessible,
    assertNoHorizontalOverflow,
    capture,
}) => {
    await mockScenario({
        commands: {
            get_database_workspace: { delay: 120, error: "database workspace unavailable" },
        },
    });
    await page.goto("/accounts");
    await page.getByRole("button", { name: "Hinzufügen" }).click();
    const accountDialog = page.getByRole("dialog", { name: "Hinzufügen" });
    await expect(accountDialog.getByLabel("Benutzername")).toBeVisible();
    await accountDialog.getByRole("button", { name: /Dialog schließen/i }).click();

    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Einstellungen" })).toBeVisible();
    await page.getByRole("link", { name: "Datenbanken" }).click();

    await expect(page.getByRole("alert")).toContainText(
        /database workspace unavailable|Datenbanken konnten nicht geladen werden/i,
    );
    await assertNoHorizontalOverflow();
    await assertAccessible();
    await capture("async-errors");
    await expect(page).toHaveScreenshot("async-errors.png", { fullPage: true });
});

/**
 * `Accounts` loads the shared database workspace on mount purely to offer an
 * import destination, and deliberately swallows a failure because the databases
 * page owns the visible retry and error state for that workspace
 * (`src/components/home/Accounts.tsx`). This pins what "swallowed" is allowed to
 * mean: the session still paints from renderer state, no unhandled rejection
 * escapes (the `page` fixture fails the test on one), the raw native diagnostic
 * never reaches the document, and the page stays accessible and free of
 * horizontal overflow at 320px with 200% font scale in German.
 *
 * The invocation assertion keeps the rest honest — it proves the failing
 * workspace path was actually exercised rather than never reached.
 */
test("async-errors: degrades to a usable account page when the database workspace fails", async ({
    page,
    mockScenario,
    assertAccessible,
    assertNoHorizontalOverflow,
    capture,
}) => {
    await page.addInitScript(() => {
        localStorage.setItem(
            "sessions",
            JSON.stringify([
                {
                    player: "E2E Spieler",
                    // Fixed, never `Date.now()`: the card renders this as a
                    // localised date, so a moving value would invalidate the
                    // committed screenshot every day.
                    updatedAt: Date.UTC(2026, 0, 15, 12),
                    lichess: { username: "e2e-player", account: {} },
                },
            ]),
        );
    });
    await mockScenario({
        commands: {
            get_database_workspace: { delay: 120, error: "database workspace unavailable" },
        },
    });

    await page.goto("/accounts");
    await expect(page.getByRole("button", { name: "Hinzufügen" })).toBeVisible();

    // The session and its Lichess card come from renderer state, not from native.
    await expect(page.getByText("E2E Spieler")).toBeVisible();
    await expect(page.getByRole("button", { name: "Erneuere Statistik" })).toBeVisible();

    const invokedWorkspace = await page.evaluate(() =>
        window.__E2E_TAURI__
            .invocations()
            .some(({ command }) => command === "get_database_workspace"),
    );
    expect(
        invokedWorkspace,
        "the failing workspace path was never exercised, so nothing below proves degradation",
    ).toBe(true);

    // A native diagnostic is backend-only; it must never reach the document.
    await expect(page.locator("body")).not.toContainText("database workspace unavailable");

    await assertNoHorizontalOverflow();
    await assertAccessible();
    await capture("async-errors-personal-database");
    await expect(page).toHaveScreenshot("async-errors-personal-database.png", { fullPage: true });
});
