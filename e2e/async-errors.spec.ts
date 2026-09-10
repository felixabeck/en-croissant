import type { Locator, Page } from "@playwright/test";
import type { ErrorPayload } from "../src/bindings/generated";
import {
    expect,
    filesWorkspaceCommands,
    filesWorkspaceFixture,
    test,
    type MockScenario,
} from "./fixtures";

const { workspace, openingDirectory } = filesWorkspaceFixture;
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
    // The Files page behind this modal has a separately filed narrow-layout defect.
    // Check the changed dialog itself without claiming that background layout is fixed.
    await assertDialogWithinViewport(dialog);
    await assertAccessible();
    await dialog.getByRole("button", { name: "Löschen", exact: true }).scrollIntoViewIfNeeded();
    await expect(page).toHaveScreenshot("confirmation-error.png", { fullPage: true });
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
    await assertAccessible();
}

test("async-errors: keeps the partial-removal warning after permanent delete", async ({
    page,
    mockScenario,
    assertAccessible,
}) => {
    const dialog = await submitPurgeAndOpenFailureDialog(page, mockScenario, partialRemovalPayload);
    await assertPurgeWarning(page, dialog, "typed native diagnostic", assertAccessible);
    await assertPurgeInvocationAndRefresh(page);
    await expect(page).toHaveScreenshot("purge-partial-removal.png", { fullPage: true });
});

test("async-errors: keeps the durability warning after permanent delete", async ({
    page,
    mockScenario,
    assertAccessible,
}) => {
    const dialog = await submitPurgeAndOpenFailureDialog(
        page,
        mockScenario,
        durabilityUncertainPayload,
    );
    await assertPurgeWarning(page, dialog, "typed durability diagnostic", assertAccessible);
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
