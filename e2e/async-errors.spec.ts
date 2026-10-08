import type { Locator, Page } from "@playwright/test";
import type { ErrorPayload } from "../src/bindings/generated";
import germanCatalogue from "../src/translation/de-DE.json" with { type: "json" };
import {
    databaseCommands,
    expect,
    filesWorkspaceCommands,
    filesWorkspaceFixture,
    pgnFileCommands,
    assertFilesColumnsNotClipped,
    assertNothingClipped,
    assertPageNotClipped,
    selectFilesTreeRow,
    test,
    type MockScenario,
} from "./fixtures";

const { workspace, openingDirectory, pgnFile } = filesWorkspaceFixture;
const germanListingCopy = germanCatalogue.translation;

const listingReasons = [
    ["changed", "Files.LoadFailed.Changed", "Databases.LoadError.Changed"],
    ["missing", "Files.LoadFailed.Missing", "Databases.LoadError.RootMissing"],
    ["unusable", "Files.LoadFailed.Unusable", "Databases.LoadError.Unusable"],
    ["permission", "Files.LoadFailed.Permission", "Databases.LoadError.RootPermission"],
    ["too-large", "Files.LoadFailed.TooLarge", "Databases.LoadError.TooLarge"],
    [undefined, "Files.LoadFailed", "Databases.LoadError"],
] as const;

for (const [rootFailure, filesKey, databasesKey] of listingReasons) {
    const error = {
        tag: "backend-error",
        category: "io",
        message: "native listing diagnostic",
        ...(rootFailure ? { rootFailure } : {}),
    } as const satisfies ErrorPayload;
    test(`async-errors: Files listing ${rootFailure ?? "retry"} stays visible at 320px`, async ({
        page,
        mockScenario,
        assertNoHorizontalOverflow,
        capture,
    }) => {
        await mockScenario({
            commands: filesWorkspaceCommands([], {
                list_file_workspace: { error },
            }),
        });
        await page.goto("/files");
        await page.getByRole("button", { name: "Sammlung auswählen", exact: true }).click();
        const alert = page.getByRole("alert");
        await expect(alert).toBeVisible();
        await expect(alert).toHaveText(germanListingCopy[filesKey]);
        await alert.scrollIntoViewIfNeeded();
        await expect(
            page.getByRole("button", {
                name: germanListingCopy["Files.ChangeCollection"],
                exact: true,
            }),
        ).toBeVisible();
        await assertNoHorizontalOverflow();
        await assertFilesColumnsNotClipped(page);
        await assertPageNotClipped(page);
        await capture(`files-listing-${rootFailure ?? "retry"}`);
    });
    test(`async-errors: Databases listing ${rootFailure ?? "retry"} stays visible at 320px`, async ({
        page,
        mockScenario,
        assertNoHorizontalOverflow,
        capture,
    }) => {
        await mockScenario({ commands: { list_workspace_databases: { error } } });
        await page.goto("/databases");
        const alert = page.getByRole("alert");
        await expect(alert).toBeVisible();
        await expect(alert).toContainText(germanListingCopy[databasesKey]);
        await alert.scrollIntoViewIfNeeded();
        const choose = page.getByRole("button", {
            name: germanListingCopy["Databases.ChooseFolder"],
            exact: true,
        });
        if (rootFailure) {
            await expect(choose).toBeVisible();
            await choose.scrollIntoViewIfNeeded();
            await assertNothingClipped(alert, { mode: "reachable" });
        } else await expect(choose).toHaveCount(0);
        await expect(
            page.getByText(germanListingCopy["Databases.Empty.NoInstalled"], { exact: true }),
        ).toHaveCount(0);
        await expect(
            page.getByText(germanListingCopy["Databases.Empty.AddHint"], { exact: true }),
        ).toHaveCount(0);
        await assertNoHorizontalOverflow();
        await assertPageNotClipped(page);
        await capture(`databases-listing-${rootFailure ?? "retry"}`);
    });
}

const refreshedDirectory = {
    ...openingDirectory,
    handle: { id: { id: "refreshed-directory" }, kind: "fileWorkspace" },
    name: "Refreshed",
};

async function assertDialogWithinViewport(dialog: Locator) {
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
}

async function submitPurgeAndOpenFailureDialog(
    page: Page,
    mockScenario: (scenario: MockScenario) => Promise<void>,
    purgeError: string | ErrorPayload,
) {
    await mockScenario({
        commands: filesWorkspaceCommands([[openingDirectory], [], [refreshedDirectory]], {
            trash_workspace_entry: { result: null },
            permanently_delete_workspace_entry: { error: purgeError },
        }),
    });
    await page.goto("/files");
    await page.getByRole("button", { name: "Sammlung auswählen" }).click();
    const deleteEntry = page
        .getByRole("treeitem", { name: "Openings", exact: true })
        .getByRole("button", { name: "Löschen" });
    await deleteEntry.click();

    const trashDialog = page.getByRole("dialog", {
        name: "In den Papierkorb verschieben",
        exact: true,
    });
    await trashDialog.getByRole("button", { name: "Löschen", exact: true }).click();
    await expect(page.getByText("Openings wurde in den Papierkorb verschoben.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Rückgängig", exact: true })).toBeVisible();
    await expect(
        page.getByRole("treeitem", { name: refreshedDirectory.name, exact: true }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Dauerhaft löschen", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Dauerhaft löschen", exact: true });
    await dialog.getByRole("button", { name: "Löschen", exact: true }).click();
    return dialog;
}

async function assertPurgeInvocationAndRefresh(page: Page) {
    const fileInvocations = await page.evaluate(() =>
        window.__E2E_TAURI__
            .invocations()
            .filter(({ command }) =>
                [
                    "issue_file_workspace",
                    "list_file_workspace",
                    "trash_workspace_entry",
                    "permanently_delete_workspace_entry",
                ].includes(command),
            ),
    );
    expect(fileInvocations.map(({ command }) => command)).toEqual([
        "issue_file_workspace",
        "list_file_workspace",
        "trash_workspace_entry",
        "list_file_workspace",
        "permanently_delete_workspace_entry",
        "list_file_workspace",
    ]);
    expect(fileInvocations[2]).toEqual({
        command: "trash_workspace_entry",
        args: { workspace, entry: openingDirectory.handle },
    });
    expect(fileInvocations[4]).toEqual({
        command: "permanently_delete_workspace_entry",
        args: { workspace, entry: openingDirectory.handle },
    });
    expect(fileInvocations.filter(({ command }) => command === "list_file_workspace")).toHaveLength(
        3,
    );
}

test("async-errors: localizes directory-trash failures in the confirmation dialog", async ({
    page,
    mockScenario,
    assertAccessible,
    assertNoHorizontalOverflow,
}) => {
    await mockScenario({
        commands: filesWorkspaceCommands([[openingDirectory]], {
            trash_workspace_entry: { error: "private native diagnostic at /private/file.pgn" },
        }),
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
    await assertNoHorizontalOverflow();
    await assertPageNotClipped(page);
    await assertAccessible();
    await dialog.getByRole("button", { name: "Löschen", exact: true }).scrollIntoViewIfNeeded();
    await expect(page).toHaveScreenshot("confirmation-error.png", { fullPage: true });
});

test("async-errors: fits a selected PGN file and its card at 320px", async ({
    page,
    mockScenario,
    assertAccessible,
    assertNoHorizontalOverflow,
}) => {
    await mockScenario({
        commands: filesWorkspaceCommands([[openingDirectory, pgnFile]], pgnFileCommands),
    });
    await page.goto("/files");
    await page.getByRole("button", { name: "Sammlung auswählen" }).click();
    const fileRow = await selectFilesTreeRow(page, pgnFile.name);
    // Nothing before this line depends on the card, so an overflowing page fails here.
    await assertNoHorizontalOverflow();
    await assertPageNotClipped(page);
    await assertNothingClipped(fileRow);

    // By text: each tree row also carries an icon-only "Verschieben" button.
    for (const name of ["Umbenennen", "Verschieben", "Papierkorb"]) {
        await expect(page.locator("button", { hasText: new RegExp(`^${name}$`) })).toBeVisible();
    }
    await expect(page.getByRole("button", { name: "Öffnen", exact: true })).toBeVisible();
    await expect(page.getByText("Weiss - Schwarz")).toBeVisible();
    // Both columns with everything in them: the controls and tree, the action row and the card.
    await assertFilesColumnsNotClipped(page);
    await assertAccessible();
    // The page scrolls inside its own container, so a full-page capture is one screen. A window
    // tall enough for both stacked columns puts the whole card into the picture.
    await page.setViewportSize({ width: 320, height: 3200 });
    await assertFilesColumnsNotClipped(page);
    await expect(page).toHaveScreenshot("files-file-selected.png");
});

const partialRemovalPayload = {
    tag: "backend-error",
    category: "partial-removal",
    message: "typed native diagnostic at /private/purge-secret.pgn",
} as const satisfies ErrorPayload;

const durabilityUncertainPayload = {
    tag: "backend-error",
    category: "durability",
    message: "typed durability diagnostic at /private/durability-secret.pgn",
} as const satisfies ErrorPayload;

async function assertPurgeWarning(
    page: Page,
    dialog: Locator,
    diagnostic: string,
    assertAccessible: () => Promise<void>,
    assertNoHorizontalOverflow: () => Promise<void>,
) {
    const warning =
        "Ein Teil des Vorgangs wurde abgeschlossen. Die Anzeige entspricht möglicherweise nicht mehr dem aktuellen Stand.";
    await expect(dialog).toBeVisible();
    const alert = dialog.getByRole("alert");
    await expect(alert).toBeVisible();
    await expect(alert).toHaveText(warning);
    await expect(alert).not.toHaveText(
        "Die Aktion konnte nicht abgeschlossen werden. Bitte versuche es erneut.",
    );
    await alert.scrollIntoViewIfNeeded();
    const alertBounds = await alert.evaluate((element) => {
        const dialog = element.closest('[role="dialog"]');
        if (!(dialog instanceof HTMLElement)) return null;
        let viewport = dialog;
        for (
            let candidate = element.parentElement;
            candidate && candidate !== dialog;
            candidate = candidate.parentElement
        ) {
            const style = window.getComputedStyle(candidate);
            if (
                candidate.scrollHeight > candidate.clientHeight &&
                (style.overflowY === "auto" || style.overflowY === "scroll")
            ) {
                viewport = candidate;
                break;
            }
        }
        const alertRect = element.getBoundingClientRect();
        const viewportRect = viewport.getBoundingClientRect();
        return {
            alertTop: alertRect.top,
            alertBottom: alertRect.bottom,
            viewportTop: viewportRect.top,
            viewportBottom: viewportRect.bottom,
        };
    });
    if (!alertBounds) throw new Error("Permanent-delete warning is outside its modal dialog");
    expect(alertBounds.alertTop).toBeGreaterThanOrEqual(alertBounds.viewportTop);
    expect(alertBounds.alertBottom).toBeLessThanOrEqual(alertBounds.viewportBottom);
    await expect(page.locator("body")).not.toContainText(diagnostic);
    await expect(page.getByText("Openings wurde in den Papierkorb verschoben.")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Rückgängig", exact: true })).toHaveCount(0);
    await expect(
        page.getByRole("treeitem", {
            name: refreshedDirectory.name,
            exact: true,
            includeHidden: true,
        }),
    ).toHaveCount(1);
    await expect(dialog.getByRole("button", { name: "Löschen", exact: true })).toBeEnabled();
    await assertDialogWithinViewport(dialog);
    await assertNoHorizontalOverflow();
    await assertPageNotClipped(page);
    await assertAccessible();
}

test("async-errors: keeps the partial-removal warning after permanent delete", async ({
    page,
    mockScenario,
    assertAccessible,
    assertNoHorizontalOverflow,
}) => {
    const dialog = await submitPurgeAndOpenFailureDialog(page, mockScenario, partialRemovalPayload);
    await assertPurgeWarning(
        page,
        dialog,
        "typed native diagnostic",
        assertAccessible,
        assertNoHorizontalOverflow,
    );
    await assertPurgeInvocationAndRefresh(page);
    await expect(page).toHaveScreenshot("purge-partial-removal.png", { fullPage: true });
});

test("async-errors: keeps the durability warning after permanent delete", async ({
    page,
    mockScenario,
    assertAccessible,
    assertNoHorizontalOverflow,
}) => {
    const dialog = await submitPurgeAndOpenFailureDialog(
        page,
        mockScenario,
        durabilityUncertainPayload,
    );
    await assertPurgeWarning(
        page,
        dialog,
        "typed durability diagnostic",
        assertAccessible,
        assertNoHorizontalOverflow,
    );
    await assertPurgeInvocationAndRefresh(page);
    await expect(page).toHaveScreenshot("purge-durability-uncertain.png", { fullPage: true });
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
    // The dialog itself, open: its submit button used to cut its German label.
    await expect(accountDialog.getByRole("button", { name: "Hinzufügen" })).toBeVisible();
    await assertNoHorizontalOverflow();
    await assertPageNotClipped(page);
    await accountDialog.getByRole("button", { name: /Dialog schließen/i }).click();
    // The empty state's heading has to be there before "nothing clipped" means anything.
    await expect(page.getByRole("heading", { name: "Keine Konten verbunden" })).toBeVisible();
    await assertNoHorizontalOverflow();
    await assertPageNotClipped(page);

    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Einstellungen" })).toBeVisible();
    await expect(page.getByRole("tabpanel", { name: "Brett" })).toBeVisible();
    await assertNoHorizontalOverflow();
    await assertPageNotClipped(page);
    for (const tab of ["Erscheinungsbild", "Privatsphäre"]) {
        await page.getByRole("tab", { name: tab }).click();
        await expect(page.getByRole("tabpanel", { name: tab })).toBeVisible();
        await assertNoHorizontalOverflow();
        await assertPageNotClipped(page);
    }
    await page.getByRole("link", { name: "Datenbanken" }).click();

    await expect(page.getByRole("alert")).toContainText(
        /database workspace unavailable|Datenbanken konnten nicht geladen werden/i,
    );
    // Visible, not only present: the list holding it used to be squeezed to 0px.
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Deine Datenbanken" })).toBeVisible();
    await assertNoHorizontalOverflow();
    await assertPageNotClipped(page);
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
    // Wait until the failed listing has rendered, so the next assertion is not vacuous.
    await expect(page.locator("body")).toContainText("Statistiken konnten nicht geladen werden");
    await expect(page.locator("body")).not.toContainText("database workspace unavailable");

    await assertNoHorizontalOverflow();
    await assertPageNotClipped(page);
    await assertAccessible();
    await capture("async-errors-personal-database");
    await expect(page).toHaveScreenshot("async-errors-personal-database.png", { fullPage: true });
});

test("async-errors: wraps a long database title in the list at 320px", async ({
    page,
    mockScenario,
    assertNoHorizontalOverflow,
}) => {
    const title = "Eröffnungsdatenbankzusammenstellung";
    await mockScenario({
        commands: databaseCommands("long-title", "long-title.db3", {
            title,
            description: "",
            player_count: 0,
            event_count: 0,
            game_count: 0,
            storage_size: 0,
            indexed: false,
        }),
    });
    await page.goto("/databases");
    // One unbroken word, wider than the stacked panel at 200%: it has to wrap, not be cut.
    await expect(page.getByText(title)).toBeVisible();
    await assertNoHorizontalOverflow();
    await assertPageNotClipped(page);
});
