import { expect, test } from "./fixtures";

test("accounts-puzzles-engines: warns when a downloaded game file's save is not confirmed", async ({
    page,
    mockScenario,
    capture,
}) => {
    const publicationHandle = { id: { id: "uncertain-chesscom-download" }, kind: "fileWorkspace" };
    const databaseHandle = { id: { id: "chesscom-import" }, kind: "database" };
    await page.addInitScript(() => {
        localStorage.setItem(
            "sessions",
            JSON.stringify([
                {
                    player: "download-player",
                    updatedAt: Date.UTC(2026, 9, 4),
                    chessCom: {
                        username: "download-player",
                        stats: {
                            chess_rapid: {
                                last: { rating: 1500, date: 1791072000, rd: 50 },
                                record: { win: 1, loss: 0, draw: 0 },
                            },
                        },
                    },
                },
            ]),
        );
    });
    await mockScenario({
        commands: {
            issue_download_destination: { result: { id: "download-destination" } },
            prepare_download: { result: "chesscom-download-ticket" },
            download_chess_com_games: {
                result: {
                    handle: publicationHandle,
                    durability: { DurabilityUncertain: "DownloadTargetReplacement" },
                },
            },
            create_workspace_database: { result: databaseHandle },
            start_progress: { result: { id: "chesscom_download-player", generation: 1 } },
            convert_pgn: { result: null },
            set_progress_state: { result: null },
            delete_empty_games: { result: null },
        },
    });
    await page.goto("/accounts");
    const download = page.getByRole("button", { name: "Download games", exact: true });
    await download.click();

    const warning = page.getByText(
        "The games were downloaded, but the save could not be fully confirmed. Do not retry.",
        { exact: true },
    );
    await expect(warning).toBeVisible();
    await expect(download).toBeEnabled();
    const notification = page.locator(".mantine-Notification-root");
    await expect(notification).toHaveCount(1);
    await expect(notification).toHaveCSS("opacity", "1");

    const invocations = await page.evaluate(() => window.__E2E_TAURI__.invocations());
    expect(invocations.filter(({ command }) => command === "convert_pgn")).toEqual([
        {
            command: "convert_pgn",
            args: {
                progressId: expect.any(String),
                files: [publicationHandle],
                database: databaseHandle,
                timestamp: null,
                title: "download-player Chess.com",
                description: null,
            },
        },
    ]);
    expect(invocations.filter(({ command }) => command === "delete_empty_games")).toEqual([
        { command: "delete_empty_games", args: { file: databaseHandle } },
    ]);
    await capture("account-download-durability-uncertain");
    await expect(page).toHaveScreenshot("account-download-durability-uncertain.png", {
        fullPage: true,
    });
});

test("accounts-puzzles-engines: refuses startup when legacy sign-in storage cannot be erased", async ({
    page,
    mockScenario,
    capture,
}) => {
    const token = "lip_e2e-legacy-token";
    const storedSessions = JSON.stringify([
        {
            updatedAt: 1,
            player: "legacy-player",
            lichess: {
                username: "legacy-player",
                account: { id: "legacy-player", username: "legacy-player" },
                accessToken: token,
            },
        },
    ]);
    await page.addInitScript((sessions) => {
        const originalSetItem = Storage.prototype.setItem;
        const originalRemoveItem = Storage.prototype.removeItem;
        originalSetItem.call(localStorage, "sessions", sessions);
        // Refuse both erase paths without blocking the fixture's keys or i18next caching.
        Storage.prototype.setItem = function (key, value) {
            if (key === "sessions") throw new DOMException("refused", "QuotaExceededError");
            return originalSetItem.call(this, key, value);
        };
        Storage.prototype.removeItem = function (key) {
            if (key === "sessions") throw new DOMException("refused", "QuotaExceededError");
            return originalRemoveItem.call(this, key);
        };
    }, storedSessions);
    await mockScenario({ commands: {} });
    await page.goto("/");

    await expect(
        page.getByRole("heading", { name: "ChessFable could not start", level: 1, exact: true }),
    ).toBeVisible();
    await expect(
        page.getByText(
            "A saved Lichess sign-in could not be removed from local storage, so ChessFable signed it out at Lichess. You can sign in again once ChessFable starts. Try again to retry removing the saved sign-in and signing it out at Lichess.",
            { exact: true },
        ),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again", exact: true })).toBeVisible();
    await expect(page.getByRole("navigation")).toHaveCount(0);
    await expect(page.getByRole("link")).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem("sessions"))).toBe(storedSessions);

    const invocations = await page.evaluate(() => window.__E2E_TAURI__.invocations());
    expect(invocations.some(({ command }) => command === "close_splashscreen")).toBe(true);
    expect(invocations.filter(({ command }) => command === "revoke_legacy_lichess_token")).toEqual([
        { command: "revoke_legacy_lichess_token", args: { token } },
    ]);
    expect(
        invocations.filter(({ command }) =>
            ["migrate_legacy_lichess_token", "list_lichess_accounts"].includes(command),
        ),
    ).toEqual([]);
    await capture("startup-storage-failure-revoked");
    await expect(page).toHaveScreenshot("startup-storage-failure-revoked.png", { fullPage: true });
});

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
    // The engine catalog is bundled; mock its native signature check and CPU-capability query.
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
