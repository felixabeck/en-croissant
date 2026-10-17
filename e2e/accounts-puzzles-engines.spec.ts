import {
    activeWorkspaceTab,
    playBoardMove,
    preserveStorageForReload,
    expect,
    test,
    type MockScenario,
} from "./fixtures";
import { deserializeStorageValue } from "../src/state/store/debouncedStorage";
import type { TreeState } from "../src/utils/treeReducer";
import type { Page } from "@playwright/test";

async function refusePuzzleStorage(page: Page, target: string) {
    await page.evaluate((target) => {
        const original = Storage.prototype.setItem;
        Object.assign(window, {
            __restorePuzzleStorage: () => {
                Storage.prototype.setItem = original;
            },
        });
        Storage.prototype.setItem = function (key, value) {
            if (key === target)
                throw new DOMException("Puzzle storage refused", "QuotaExceededError");
            original.call(this, key, value);
        };
    }, target);
}

async function restorePuzzleStorage(page: Page) {
    await page.evaluate(() =>
        (window as typeof window & { __restorePuzzleStorage: () => void }).__restorePuzzleStorage(),
    );
}

test("accounts-puzzles-engines: default-true check stays disabled after save and reload and refusal restores true", async ({
    page,
    mockScenario,
    capture,
}) => {
    await page.addInitScript(() => {
        localStorage.setItem("font-size", "100");
        if (localStorage.getItem("engines") === null)
            localStorage.setItem(
                "engines",
                JSON.stringify([
                    {
                        type: "local",
                        id: "check-entry",
                        name: "Check engine",
                        version: "18",
                        filename: "stockfish",
                        handle: { id: { id: "check-binary" }, kind: "engine" },
                        settings: [],
                    },
                ]),
            );
    });
    await mockScenario({
        commands: {
            file_exists: { result: true },
            get_engine_config: {
                result: {
                    name: "Check engine",
                    options: [{ type: "check", value: { name: "Ponder", default: true } }],
                },
            },
            reconcile_engine_attachments: { result: null, delay: 700 },
        },
    });
    await page.goto("/engines?selected=0");
    const ponder = page.getByRole("checkbox", { name: "Ponder", exact: true });
    await expect(ponder).toBeChecked();
    const bytes = await page.evaluate(() => localStorage.getItem("engines"));
    await ponder.uncheck();
    await expect(ponder).not.toBeChecked();
    expect(await page.evaluate(() => localStorage.getItem("engines"))).toBe(bytes);
    await expect(ponder.locator("..").locator("svg")).toHaveCSS("opacity", "0");
    await expect(ponder).not.toBeChecked();
    expect(await page.evaluate(() => localStorage.getItem("engines"))).toBe(bytes);
    await capture("engine-check-false-pending");
    await expect.poll(() => page.evaluate(() => localStorage.getItem("engines"))).not.toBe(bytes);
    await expect(ponder).not.toBeChecked();
    await page.evaluate(() => sessionStorage.setItem("__E2E_PRESERVE_STORAGE_ONCE__", "1"));
    await page.reload();
    await expect(ponder).not.toBeChecked();
    await capture("engine-check-false-rehydrated");
    const falseBytes = await page.evaluate(() => localStorage.getItem("engines"));
    await ponder.check();
    await expect
        .poll(() => page.evaluate(() => localStorage.getItem("engines")))
        .not.toBe(falseBytes);
    await page.evaluate(() => {
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key, value) {
            if (key === "engines")
                throw new DOMException("Engine storage refused", "QuotaExceededError");
            original.call(this, key, value);
        };
    });
    const trueBytes = await page.evaluate(() => localStorage.getItem("engines"));
    await ponder.uncheck();
    await expect(ponder).not.toBeChecked();
    await expect(page.getByText(/The engine list could not be saved/).first()).toBeVisible();
    await expect(ponder).toBeChecked();
    expect(await page.evaluate(() => localStorage.getItem("engines"))).toBe(trueBytes);
    await capture("engine-check-refused-restores-true");
});

test("accounts-puzzles-engines: current engine configuration failure keeps saved metadata usable", async ({
    page,
    mockScenario,
    capture,
}) => {
    await page.addInitScript(() => {
        localStorage.setItem("font-size", "100");
        localStorage.setItem(
            "engines",
            JSON.stringify([
                {
                    type: "local",
                    id: "config-failure-desktop",
                    name: "Saved engine",
                    version: "18",
                    filename: "stockfish",
                    handle: { id: { id: "config-failure-binary" }, kind: "engine" },
                    settings: [],
                },
            ]),
        );
    });
    await mockScenario({
        commands: {
            file_exists: { result: true },
            get_engine_config: {
                error: {
                    tag: "backend-error",
                    category: "engine-timeout",
                    message: "Engine configuration timed out.",
                },
            },
        },
    });
    await page.goto("/engines?selected=0");
    const failure = page.getByRole("alert");
    await expect(failure).toContainText("Error");
    await expect(failure).toContainText("Engine configuration timed out.");
    await expect(page.getByRole("textbox", { name: "Name", exact: true })).toHaveValue(
        "Saved engine",
    );
    await expect(page.getByRole("textbox", { name: "Name", exact: true })).toBeEditable();
    await failure.scrollIntoViewIfNeeded();
    await capture("engine-config-error-desktop");
    await expect(page).toHaveScreenshot("engine-config-error-desktop.png", { fullPage: true });
});

const summaryLichessDatabase = {
    handle: { id: { id: "summary-lichess" }, kind: "database" },
    filename: "alex_lichess.db3",
    availability: "available",
};
const summaryChessComDatabase = {
    handle: { id: { id: "summary-chesscom" }, kind: "database" },
    filename: "alex_chesscom.db3",
    availability: "available",
};
const summaryDatabaseInfo = {
    description: "",
    player_count: 1,
    event_count: 1,
    game_count: 8,
    storage_size: "1024",
    indexed: true,
};
const summaryLichessInfo = {
    ...summaryDatabaseInfo,
    title: "Alex Lichess",
    filename: summaryLichessDatabase.filename,
};
const summaryChessComInfo = {
    ...summaryDatabaseInfo,
    title: "Alex Chess.com",
    filename: summaryChessComDatabase.filename,
};
const summaryStatistics = {
    site_stats_data: [
        {
            site: "Lichess",
            player: "alex",
            daily: [
                {
                    date: "2026.10.04",
                    time_control: "600+0",
                    won: 5,
                    drawn: 2,
                    lost: 1,
                    max_player_elo: 1500,
                },
            ],
            openings: [],
        },
    ],
};

for (const state of ["partial", "failed"] as const) {
    test(`accounts-puzzles-engines: home summary ${state} statistics`, async ({
        page,
        mockScenario,
        capture,
    }) => {
        await page.addInitScript(() => {
            localStorage.setItem(
                "sessions",
                JSON.stringify([
                    {
                        player: "Alex",
                        updatedAt: Date.UTC(2026, 9, 4),
                        lichess: {
                            username: "alex",
                            account: {
                                id: "alex",
                                username: "alex",
                                perfs: { rapid: { rating: 1500, games: 8, prog: 0 } },
                            },
                        },
                    },
                    {
                        player: "Alex",
                        updatedAt: Date.UTC(2026, 9, 4),
                        chessCom: {
                            username: "alex",
                            stats: {
                                chess_rapid: {
                                    last: { rating: 1500, date: 1791072000, rd: 50 },
                                    record: { win: 5, loss: 1, draw: 2 },
                                },
                            },
                        },
                    },
                ]),
            );
        });
        const statisticsRead: NonNullable<MockScenario["commands"]>[string] = {
            outcomes: [
                state === "partial"
                    ? { result: summaryStatistics }
                    : { error: "Lichess statistics unreadable" },
                { error: "Chess.com statistics unreadable" },
            ],
            error: "Statistics unreadable",
        };
        await mockScenario({
            commands: {
                list_workspace_databases: {
                    result: [summaryLichessDatabase, summaryChessComDatabase],
                },
                get_db_info: {
                    // Accounts and the summary read metadata concurrently, each in database order.
                    // A different interleaving fails the failed-state test loudly because the notice
                    // would name the same database twice.
                    results: [
                        summaryLichessInfo,
                        summaryLichessInfo,
                        summaryChessComInfo,
                        summaryChessComInfo,
                    ],
                    result: summaryChessComInfo,
                },
                get_players: { result: { data: [{ id: 7, name: "alex", elo: 1500 }], count: 1 } },
                get_players_game_info: statisticsRead,
            },
        });
        await page.goto("/accounts");

        const title =
            state === "partial" ? "Statistics are incomplete" : "Could not load statistics";
        const failedDatabases =
            state === "partial" ? "Alex Chess.com" : "Alex Lichess, Alex Chess.com";
        await expect(page.getByText(title, { exact: true })).toBeVisible();
        await expect(
            page.getByText(`These databases could not be read: ${failedDatabases}`, {
                exact: true,
            }),
        ).toBeVisible();
        if (state === "partial") {
            await expect(page.getByRole("tab", { name: "Overview", exact: true })).toBeVisible();
            const total = page.getByText("8 Games", { exact: true });
            const overview = page.getByRole("tabpanel", { name: "Overview", exact: true });
            await overview.hover({ position: { x: 10, y: 10 } });
            await expect(async () => {
                await page.mouse.wheel(0, 100);
                await expect(total).toBeInViewport({ timeout: 250 });
            }).toPass({ timeout: 8000 });
            await page.mouse.move(0, 0);
            await overview.evaluate((panel) => panel.scrollTo(0, 0));
        } else {
            await expect(page.getByText("No games found", { exact: true })).toHaveCount(0);
        }
        const statisticsFiles = await page.evaluate(() =>
            window.__E2E_TAURI__
                .invocations()
                .filter(({ command }) => command === "get_players_game_info")
                .map(({ args }) => (args as { file: unknown }).file),
        );
        expect(statisticsFiles).toEqual([
            summaryLichessDatabase.handle,
            summaryChessComDatabase.handle,
        ]);
        await capture(`home-summary-${state}-statistics`);
        await expect(page).toHaveScreenshot(`home-summary-${state}-statistics.png`, {
            fullPage: true,
        });
    });
}

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
            start_progress: { result: { id: "chesscom_download-player", generation: "1" } },
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
                ticket: null,
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
            get_progress: { result: null },
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
    await dialog.getByRole("button", { name: "Close dialog", exact: true }).click();
    await expect(dialog).not.toBeVisible();

    await page.evaluate(() =>
        window.__E2E_TAURI__.configure({
            commands: {
                file_exists: { result: true },
                get_progress: { result: null },
                reconcile_engine_attachments: { result: null, delay: 700 },
                retire_engine: { result: null },
            },
        }),
    );
    const name = page.getByRole("textbox", { name: "Name", exact: true });
    const card = page.locator('button[aria-pressed="true"]').locator("p").first();
    const before = await page.evaluate(() => localStorage.getItem("engines"));
    await name.fill("Saved publication");
    await expect(name).toHaveValue("Saved publication");
    await expect(card).toBeVisible();
    await expect(card).toHaveText("Stockfish 18");
    expect(await page.evaluate(() => localStorage.getItem("engines"))).toBe(before);
    await expect(page.getByText(/Unexpected Tauri IPC command/)).toHaveCount(0);
    await capture("engine-publication-pending-draft");
    await expect(card).toHaveText("Saved publication");
    await expect.poll(() => page.evaluate(() => localStorage.getItem("engines"))).not.toBe(before);

    await page.evaluate(() => {
        const original = Storage.prototype.setItem;
        Object.assign(window, {
            __engineStorageRefusals: 0,
            __restoreEngineStorage: () => {
                Storage.prototype.setItem = original;
            },
        });
        Storage.prototype.setItem = function (key, value) {
            if (key === "engines") {
                const state = window as typeof window & { __engineStorageRefusals: number };
                state.__engineStorageRefusals++;
                throw new DOMException("Engine storage refused", "QuotaExceededError");
            }
            original.call(this, key, value);
        };
    });
    const savedBytes = await page.evaluate(() => localStorage.getItem("engines"));
    await name.fill("Refused publication");
    await expect(name).toHaveValue("Refused publication");
    await expect(name).toHaveValue("Saved publication");
    await expect(card).toHaveText("Saved publication");
    await expect(page.getByText(/The engine list could not be saved/).first()).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("engines"))).toBe(savedBytes);
    await page.getByRole("button", { name: "Duplicate", exact: true }).click();
    await expect
        .poll(() =>
            page.evaluate(
                () =>
                    (window as typeof window & { __engineStorageRefusals: number })
                        .__engineStorageRefusals,
            ),
        )
        .toBe(2);
    await expect(page.getByRole("textbox", { name: "Name", exact: true })).toHaveValue(
        "Saved publication",
    );
    await expect(page.getByText("Saved publication (Copy)", { exact: true })).toHaveCount(0);
    await expect(card).toHaveText("Saved publication");
    await capture("engine-publication-refused-edit-duplicate");
    await page.getByRole("button", { name: "Remove", exact: true }).click();
    const removal = page.getByRole("dialog");
    await removal.getByRole("button", { name: "Remove", exact: true }).click();
    await expect(page.getByText("Saved publication", { exact: true })).toHaveCount(0);
    await expect
        .poll(() =>
            page.evaluate(
                () =>
                    window.__E2E_TAURI__
                        .invocations()
                        .filter((call) => call.command === "retire_engine").length,
            ),
        )
        .toBe(1);
    expect(await page.evaluate(() => localStorage.getItem("engines"))).toBe(savedBytes);
    await capture("engine-publication-refused-removal");
    await page.evaluate(() => {
        (window as typeof window & { __restoreEngineStorage: () => void }).__restoreEngineStorage();
    });
});

test("accounts-puzzles-engines: add engine download catalog", async ({
    page,
    mockScenario,
    capture,
}) => {
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

    const transferCommands = {
        is_bmi2_compatible: { result: false },
        verify_signed_bytes: { result: null },
        get_progress: { result: null },
        prepare_download: { result: "engine-download-ticket" },
        release_download: { result: null },
        get_engine_workspace: { result: { id: { id: "engine-root" }, kind: "engineRoot" } },
        engine_archive_destination: { result: { id: "engine-destination" } },
        download_engine_archive: { result: null },
        register_installed_engine: {
            result: { id: { id: "engine-binary" }, kind: "engine" },
        },
        get_engine_config: {
            delay: 5000,
            error: {
                tag: "backend-error",
                category: "io",
                message: "Engine configuration failed after transfer",
            },
        },
        clear_progress: {
            error: {
                tag: "backend-error",
                category: "io",
                message: "Progress clear refused",
            },
        },
    } satisfies NonNullable<MockScenario["commands"]>;
    await page.evaluate(
        (commands) => window.__E2E_TAURI__.configure({ commands }),
        transferCommands,
    );
    await dialog.getByRole("button", { name: "Install", exact: true }).first().click();
    await expect
        .poll(() =>
            page.evaluate(() =>
                window.__E2E_TAURI__
                    .invocations()
                    .some(({ command }) => command === "get_engine_config"),
            ),
        )
        .toBe(true);
    const progressId = await page.evaluate((commands) => {
        const call = window.__E2E_TAURI__
            .invocations()
            .find(({ command }) => command === "download_engine_archive")!;
        const { id } = call.args as { id: string };
        const succeeded = {
            id,
            generation: "7",
            progress: 100,
            finished: true,
            state: "succeeded",
        };
        window.__E2E_TAURI__.configure({
            commands: { ...commands, get_progress: { result: succeeded } },
        });
        window.__E2E_TAURI__.emit("progress-event", { ...succeeded, cleared: false });
        return id;
    }, transferCommands);
    const finalizing = dialog.getByRole("button", { name: /Extracting/ });
    await expect(finalizing).toBeDisabled();
    await expect(finalizing.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    await capture("engine-add-active-finalization");
    await expect(
        page.getByText("Engine configuration failed after transfer", { exact: true }),
    ).toBeVisible();
    await expect
        .poll(() =>
            page.evaluate(
                () =>
                    window.__E2E_TAURI__
                        .invocations()
                        .filter(({ command }) => command === "clear_progress").length,
            ),
        )
        .toBe(1);
    const install = dialog.getByRole("button", { name: "Install", exact: true }).first();
    await expect(install).toBeEnabled();
    await expect(install.getByRole("progressbar")).toHaveCount(0);
    await expect(dialog.getByRole("progressbar")).toHaveCount(0);
    await capture("engine-add-failed-cleanup-idle");
    const readsBeforeReopen = await page.evaluate(
        (id) =>
            window.__E2E_TAURI__
                .invocations()
                .filter(
                    (call) =>
                        call.command === "get_progress" && (call.args as { id: string }).id === id,
                ).length,
        progressId,
    );
    await dialog.getByRole("button", { name: "Close dialog", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await page.getByRole("button", { name: "Add New", exact: true }).click();
    await expect
        .poll(() =>
            page.evaluate(
                (id) =>
                    window.__E2E_TAURI__
                        .invocations()
                        .filter(
                            (call) =>
                                call.command === "get_progress" &&
                                (call.args as { id: string }).id === id,
                        ).length,
                progressId,
            ),
        )
        .toBeGreaterThan(readsBeforeReopen);
    await expect(dialog).toHaveCSS("opacity", "1");
    await expect(install).toBeEnabled();
    await expect(install.getByRole("progressbar")).toHaveCount(0);
    await expect(dialog.getByRole("progressbar")).toHaveCount(0);
    await capture("engine-add-reopened-idle");
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
    // The Add click scrolls the modal content to reveal the button, and where that scroll
    // settles varies between runs (f-20261011-07). Capture the validation state from the top.
    const content = page.locator(".mantine-Modal-content");
    await content.evaluate((element) => element.scrollTo({ top: 0 }));
    await expect.poll(() => content.evaluate((element) => element.scrollTop)).toBe(0);
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
    await page.mouse.move(0, 0);
    await capture("accounts-puzzles-engines");
    await expect(page).toHaveScreenshot("accounts-puzzles-engines.png", { fullPage: true });
});

test("accounts-puzzles-engines: selected puzzle B survives reload, refused admission retries and close reclaims its keys", async ({
    page,
    mockScenario,
    capture,
}) => {
    const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1";
    const row = { id: 7, fen, rating: 1200, rating_deviation: 50, popularity: 1, nb_plays: 1 };
    const a = { ...row, moves: "e7e6 d2d4" };
    const b = { ...row, moves: "e7e5 g1f3 b8c6 b1c3" };
    await page.addInitScript(() => {
        localStorage.setItem("font-size", "100");
        localStorage.setItem("puzzle-db", JSON.stringify({ id: "session-puzzles" }));
        localStorage.setItem("track-puzzle-time", "false");
        localStorage.setItem("puzzle-jump-immediately", "false");
    });
    await mockScenario({
        commands: {
            list_puzzle_databases: {
                result: [
                    {
                        title: "Session.db3",
                        description: "Session",
                        puzzleCount: 2,
                        storageSize: "1024",
                        path: { id: "session-puzzles" },
                    },
                ],
            },
            get_puzzle_themes: { result: [] },
            get_themes_for_puzzle: { result: [] },
            get_puzzle: { results: [a, b], result: b },
        },
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Train", exact: true }).click();
    const next = page.getByRole("button", { name: "New Puzzle", exact: true });
    await expect(next).toBeEnabled();
    await next.click();
    await expect(
        page.getByRole("button", { name: "Challenge 1: incomplete", exact: true }),
    ).toBeVisible();
    await next.click();
    await expect(
        page.getByRole("button", { name: "Challenge 2: incomplete", exact: true }),
    ).toBeVisible();
    const tab = (await activeWorkspaceTab(page))!;
    const key = tab.treeKey ?? tab.value;
    const read = async () =>
        deserializeStorageValue<{ state: TreeState }>(
            (await page.evaluate((key) => sessionStorage.getItem(key), key))!,
        )!.state;
    const savedSession = (await read()).puzzleSession;
    expect(savedSession).toMatchObject({
        version: 1,
        attempts: [
            { puzzle: { moves: a.moves.split(" ") } },
            { puzzle: { moves: b.moves.split(" ") } },
        ],
        selectedAttemptId: expect.any(String),
    });
    const selectedB = savedSession!.selectedAttemptId;
    await playBoardMove(page, page.locator("cg-board"), "g1", "f3");
    await expect.poll(async () => (await read()).position.length).toBe(3);
    const progress = await read();
    await capture("puzzle-session-b-progress");
    await preserveStorageForReload(page);
    await expect(next).toBeEnabled();
    await expect(
        page.getByRole("button", { name: "Challenge 2: incomplete", exact: true }),
    ).toBeVisible();
    expect((await read()).puzzleSession!.selectedAttemptId).toBe(selectedB);
    expect((await read()).position).toEqual(progress.position);
    expect((await read()).root).toEqual(progress.root);
    await capture("puzzle-session-b-reloaded");
    const sourceBytes = await page.evaluate((key) => sessionStorage.getItem(key), key);
    await page.getByRole("button", { name: "Tab actions", exact: true }).click();
    await page.getByRole("menuitem", { name: "Duplicate tab", exact: true }).click();
    const copy = (await activeWorkspaceTab(page))!;
    expect(copy.value).not.toBe(tab.value);
    const copyKey = copy.treeKey ?? copy.value;
    const readCopy = async () =>
        deserializeStorageValue<{ state: TreeState }>(
            (await page.evaluate((key) => sessionStorage.getItem(key), copyKey))!,
        )!.state;
    const copiedSession = (await readCopy()).puzzleSession;
    expect(copiedSession).toMatchObject({ version: 1, selectedAttemptId: selectedB });
    expect(copiedSession).toEqual(progress.puzzleSession);
    expect((await readCopy()).puzzleSession!.selectedAttemptId).toBe(selectedB);
    expect((await readCopy()).root).toEqual(progress.root);
    expect((await readCopy()).position).toEqual(progress.position);
    await capture("puzzle-session-independent-copy");
    const copyBytes = await page.evaluate((key) => sessionStorage.getItem(key), copyKey);
    await refusePuzzleStorage(page, copyKey);
    await playBoardMove(page, page.locator("cg-board"), "b1", "c3");
    const retry = page.getByRole("button", { name: "Retry", exact: true });
    await expect(retry).toBeVisible();
    expect(await page.evaluate((key) => sessionStorage.getItem(key), copyKey)).toBe(copyBytes);
    expect((await readCopy()).puzzleSession!.attempts[1].puzzle.completion).toBe("incomplete");
    expect(await page.evaluate((key) => sessionStorage.getItem(key), key)).toBe(sourceBytes);
    await capture("puzzle-session-completion-refused-retry");
    await restorePuzzleStorage(page);
    await retry.click();
    await expect(retry).not.toBeVisible();
    await expect
        .poll(async () => (await readCopy()).puzzleSession!.attempts[1].puzzle.completion)
        .toBe("correct");
    expect((await readCopy()).puzzleSession!.selectedAttemptId).toBe(selectedB);
    expect((await readCopy()).position.length).toBe(4);
    expect((await read()).puzzleSession!.attempts[1].puzzle.completion).toBe("incomplete");
    expect((await read()).position).toEqual(progress.position);
    expect(await page.evaluate((key) => sessionStorage.getItem(key), key)).toBe(sourceBytes);
    await capture("puzzle-session-completion-retried");
    await page.getByRole("button", { name: "Close tab", exact: true }).click();
    await expect
        .poll(() => page.evaluate((key) => sessionStorage.getItem(key), copyKey))
        .toBeNull();
    expect((await activeWorkspaceTab(page))!.value).toBe(tab.value);
    expect((await read()).root).toEqual(progress.root);
    expect((await read()).puzzleSession!.selectedAttemptId).toBe(selectedB);
    const before = await page.evaluate((key) => sessionStorage.getItem(key), key);
    await refusePuzzleStorage(page, key);
    await next.click();
    await expect(page.getByText(/storage|quota/i).last()).toBeVisible();
    expect(await page.evaluate((key) => sessionStorage.getItem(key), key)).toBe(before);
    expect((await read()).puzzleSession!.selectedAttemptId).toBe(selectedB);
    await capture("puzzle-session-save-refused");
    await restorePuzzleStorage(page);
    await next.click();
    await expect(
        page.getByRole("button", { name: "Challenge 3: incomplete", exact: true }),
    ).toBeVisible();
    expect((await read()).puzzleSession!.selectedAttemptId).not.toBe(selectedB);
    await capture("puzzle-session-save-retried");
    await page.evaluate((logical) => sessionStorage.setItem(`${logical}-puzzles`, "[]"), tab.value);
    await page.getByRole("button", { name: "Close tab", exact: true }).click();
    await expect.poll(() => page.evaluate((key) => sessionStorage.getItem(key), key)).toBeNull();
    expect(
        await page.evaluate((logical) => sessionStorage.getItem(`${logical}-puzzles`), tab.value),
    ).toBeNull();
    await capture("puzzle-session-closed-keys-reclaimed");
});

test("accounts-puzzles-engines: moves the active sidebar marker with navigation", async ({
    page,
    mockScenario,
}) => {
    await mockScenario({ commands: {} });
    await page.goto("/");

    const navbar = page.locator("nav.mantine-AppShell-navbar");
    const linkNames = ["User", "Library", "Engines", "Settings", "Board"];
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
