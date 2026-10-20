import {
    expect,
    filesWorkspaceCommands,
    filesWorkspaceFixture,
    pgnFileCommands,
    preserveStorageForReload,
    selectFilesTreeRow,
    test,
    gameOpeningCommands,
    gameOpeningFixture,
    dragMosaicDivider,
    activeWorkspaceTab,
    playBoardMove,
} from "./fixtures";
import { deserializeStorageValue } from "../src/state/store/debouncedStorage";

for (const { count, linked } of [
    { count: 0, linked: false },
    { count: 3, linked: false },
    { count: 3, linked: true },
]) {
    test(`workspace-tabs: fresh first save appends at destination count ${count}${linked ? " in a linked collection" : ""}`, async ({
        page,
        mockScenario,
        capture,
    }) => {
        if (linked) {
            await page.addInitScript(() =>
                localStorage.setItem("auto-save", JSON.stringify(false)),
            );
        }
        const handle = { id: { id: "first-save-destination" }, kind: "fileWorkspace" } as const;
        const revision = "first-save-revision";
        const locator = {
            collection: "22222222-2222-4222-8222-222222222222",
            generation: revision,
            ordinal: count,
            stamp: "a".repeat(64),
        };
        await mockScenario({
            commands: {
                issue_pgn_export_destination: {
                    result: { handle, displayName: "First save.pgn", availability: "available" },
                },
                count_pgn_games: { result: count },
                write_game: {
                    result: {
                        stamp: "a".repeat(64),
                        revision,
                        ...(linked ? { linked: locator } : {}),
                    },
                },
                file_revision: { result: revision },
            },
        });
        await page.goto("/");
        await page.getByRole("button", { name: /^open$/i }).click();
        const before = (await activeWorkspaceTab(page))!;
        expect(before.gameOrigin).toEqual({ kind: "none" });
        const board = page.getByRole("grid", {
            name: "Chessboard, White orientation",
            exact: true,
        });
        await expect(board).toBeVisible();
        await playBoardMove(page, page.locator("cg-board").first(), "e2", "e4");
        await playBoardMove(page, page.locator("cg-board").first(), "e7", "e5");
        await page.getByRole("tab", { name: "Annotate", exact: true }).click();
        const comment = "First saved analysis comment";
        await page.locator('[contenteditable="true"]').fill(comment);
        await page.getByRole("button", { name: /^save pgn/i }).click();
        await expect(page.locator("[data-file-freshness]")).toHaveAttribute(
            "data-file-freshness",
            /^verified:/,
        );
        const after = (await activeWorkspaceTab(page))!;
        expect(after.value).toBe(before.value);
        expect(after.treeKey).toBe(before.treeKey);
        expect(after.gameOrigin).toMatchObject({
            kind: "file",
            gameNumber: count,
            file: { handle, numGames: count + 1, name: "First save" },
        });
        const calls = await page.evaluate(() => window.__E2E_TAURI__.invocations());
        expect(
            calls.filter(({ command }) => command === "issue_pgn_export_destination"),
        ).toHaveLength(1);
        expect(calls.filter(({ command }) => command === "issue_pgn_workspace")).toHaveLength(0);
        expect(calls.filter(({ command }) => command === "count_pgn_games")).toMatchObject([
            { command: "count_pgn_games", args: { file: handle } },
        ]);
        const writes = calls.filter(({ command }) => command === "write_game");
        expect(writes).toHaveLength(1);
        expect(writes[0].args).toMatchObject({
            file: handle,
            n: count,
            expected: { kind: "append" },
            pgn: expect.stringContaining("1. e4 e5"),
        });
        expect(writes[0].args).toMatchObject({ pgn: expect.stringContaining(comment) });
        expect(calls.filter(({ command }) => command === "read_game")).toHaveLength(0);
        await expect(board).toBeVisible();
        await expect(
            page.getByRole("gridcell", { name: "e4, White Pawn", exact: true }),
        ).toHaveCount(1);
        await expect(
            page.getByRole("gridcell", { name: "e5, Black Pawn", exact: true }),
        ).toHaveCount(1);
        await expect(page.locator('[contenteditable="true"]')).toHaveText(comment);
        if (linked) {
            await expect
                .poll(async () => {
                    const raw = await page.evaluate(
                        (key) => sessionStorage.getItem(key),
                        after.treeKey ?? after.value,
                    );
                    return raw
                        ? deserializeStorageValue<{ state: { linkedSource: unknown } }>(raw)?.state
                              .linkedSource
                        : undefined;
                })
                .toEqual(locator);
            await page.locator('[contenteditable="true"]').fill("A later linked edit");
            await page.getByRole("button", { name: /^save pgn/i }).click();
            await expect
                .poll(() =>
                    page.evaluate(
                        () =>
                            window.__E2E_TAURI__
                                .invocations()
                                .filter(({ command }) => command === "write_game").length,
                    ),
                )
                .toBe(2);
            const later = await page.evaluate(() =>
                window.__E2E_TAURI__
                    .invocations()
                    .filter(({ command }) => command === "write_game")
                    .at(-1),
            );
            expect(later?.args).toMatchObject({
                expected: { kind: "linkedGame", stamp: locator.stamp, revision },
            });
        }
        await capture(`workspace-tabs-first-save-${count}${linked ? "-linked" : ""}`);
    });
}

test("workspace-tabs: analysis row and nested column drags resize panes and restore committed percentages", async ({
    page,
    mockScenario,
}) => {
    await mockScenario({
        commands: filesWorkspaceCommands([[gameOpeningFixture.file]], gameOpeningCommands),
    });
    await page.goto("/library");
    await page.getByRole("button", { name: "Choose collection", exact: true }).click();
    await selectFilesTreeRow(page, gameOpeningFixture.file.name);
    await page.getByRole("button", { name: "Open game", exact: true }).click();
    const mosaic = page.locator(".mosaic-root");
    const left = page.locator(".mosaic-tile:has(> #left)");
    const top = page.locator(".mosaic-tile:has(> #topRight)");
    const bottom = page.locator(".mosaic-tile:has(> #bottomRight)");
    const beforeLeft = (await left.boundingBox())!.width;
    const beforeTop = (await top.boundingBox())!.height;
    const beforeBottom = (await bottom.boundingBox())!.height;
    for (const [direction, ratio] of [
        ["row", 60],
        ["column", 65],
    ] as const) {
        await dragMosaicDivider(page, {
            root: mosaic,
            split: mosaic.locator(`.mosaic-split.-${direction}`),
            percentage: ratio,
            direction,
            crossAxisRatio: direction === "row" ? 0.25 : 0.75,
        });
    }
    const percentages = () =>
        page.evaluate(() => {
            const node = JSON.parse(localStorage.getItem("windowsState")!).currentNode;
            return { row: node.splitPercentage, column: node.second.splitPercentage };
        });
    await expect.poll(async () => Math.abs((await percentages()).row - 60)).toBeLessThan(0.5);
    await expect.poll(async () => Math.abs((await percentages()).column - 65)).toBeLessThan(0.5);
    const committed = await percentages();
    expect((await left.boundingBox())!.width).toBeGreaterThan(beforeLeft);
    expect((await top.boundingBox())!.height).toBeGreaterThan(beforeTop);
    expect((await bottom.boundingBox())!.height).toBeLessThan(beforeBottom);
    const dimensions = [
        await left.boundingBox(),
        await top.boundingBox(),
        await bottom.boundingBox(),
    ];
    await preserveStorageForReload(page);
    await expect.poll(percentages).toEqual(committed);
    await expect
        .poll(async () => [
            await left.boundingBox(),
            await top.boundingBox(),
            await bottom.boundingBox(),
        ])
        .toEqual(dimensions);
});

test("workspace-tabs: closing the last tab of an opened repertoire file leaves a New Tab", async ({
    page,
    mockScenario,
}) => {
    const repertoireFile = {
        ...filesWorkspaceFixture.pgnFile,
        metadata: { type: "repertoire" as const, tags: [] },
    };
    await mockScenario({
        commands: filesWorkspaceCommands([[repertoireFile]], { ...pgnFileCommands }),
    });
    await page.goto("/library");
    await page.getByRole("button", { name: /choose collection/i }).click();
    await selectFilesTreeRow(page, repertoireFile.name);
    await page.getByRole("button", { name: "Open game", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    // Train is an inner tab rendered by PracticePanel, proving its cleanup has mounted.
    await expect(page.getByRole("tab", { name: "Train", exact: true })).toBeVisible();
    await page.getByRole("button", { name: /close tab/i }).click();
    await expect(page.getByText(/an error occurred/i)).toHaveCount(0);
    const workspaceTabs = page.getByRole("tablist").first().getByRole("tab");
    await expect(workspaceTabs).toHaveCount(1);
    await expect(workspaceTabs).toHaveText("New Tab");
    await expect(workspaceTabs).toHaveAttribute("aria-selected", "true");
});

async function rejectWorkspaceWrites(page: import("@playwright/test").Page) {
    await page.evaluate(() => {
        const target = window as typeof window & {
            __workspaceSetItem?: typeof Storage.prototype.setItem;
        };
        target.__workspaceSetItem ??= Storage.prototype.setItem;
        const original = target.__workspaceSetItem;
        Storage.prototype.setItem = function (key, value) {
            if (key === "workspace") throw new DOMException("quota", "QuotaExceededError");
            return original.call(this, key, value);
        };
    });
}

async function restoreWorkspaceWrites(page: import("@playwright/test").Page) {
    await page.evaluate(() => {
        const target = window as typeof window & {
            __workspaceSetItem?: typeof Storage.prototype.setItem;
        };
        if (target.__workspaceSetItem) Storage.prototype.setItem = target.__workspaceSetItem;
    });
}

test("workspace-tabs: creates, focuses, and cycles workspace tabs", async ({
    page,
    assertAccessible,
    assertNoHorizontalOverflow,
    capture,
}) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/ChessFable/i);
    const tabs = page.getByRole("tab");
    await expect(tabs).toHaveCount(1);
    await expect(tabs.first()).toBeFocused();

    await page.getByRole("button", { name: /new tab/i }).click();
    await expect(tabs).toHaveCount(2);
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");

    await page.keyboard.press("Control+1");
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
    await assertNoHorizontalOverflow();
    await assertAccessible();
    await capture("workspace-tabs");
    await expect(page).toHaveScreenshot("workspace-tabs.png", { fullPage: true });
});

test("workspace-tabs: refuses failed creation and close until durable retry", async ({
    page,
    capture,
}) => {
    await page.goto("/");
    const tabs = page.getByRole("tab");
    const newTab = page.getByRole("button", { name: /new tab/i });
    const closeTab = page.getByRole("button", { name: /close tab/i });

    await rejectWorkspaceWrites(page);
    await newTab.click();
    await expect(tabs).toHaveCount(1);
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText(/session storage is full/i)).toBeVisible();

    await restoreWorkspaceWrites(page);
    await newTab.click();
    await expect(tabs).toHaveCount(2);
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");

    await rejectWorkspaceWrites(page);
    await closeTab.click();
    await expect(tabs).toHaveCount(2);
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await capture("workspace-tabs-write-refusal");

    await restoreWorkspaceWrites(page);
    await closeTab.click();
    await expect(tabs).toHaveCount(1);
    await page.reload();
    await expect(tabs).toHaveCount(1);
});

test("workspace-tabs: FEN import keeps its New Tab on a refused write and replaces it on retry", async ({
    page,
    capture,
}) => {
    const fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
    await page.addInitScript(() => localStorage.setItem("erase-drawables-on-click", "false"));
    await page.goto("/");
    // The analysis board renders its own panel tablist after the workspace one.
    const tabs = page.getByRole("tablist").first().getByRole("tab");
    await expect(tabs).toHaveCount(1);
    await expect(tabs.first()).toHaveText(/new tab/i);

    await page.getByRole("button", { name: /^import$/i }).click();
    const modal = page.getByRole("dialog", { name: /import game/i });
    await modal.getByText("FEN", { exact: true }).click();
    const fenInput = modal.getByRole("textbox", { name: "FEN" });
    await fenInput.fill(fen);

    await rejectWorkspaceWrites(page);
    await modal.getByRole("button", { name: /^import$/i }).click();
    await expect(page.getByText(/session storage is full/i)).toBeVisible();
    await expect(modal).toBeVisible();
    await expect(fenInput).toHaveValue(fen);
    await expect(tabs).toHaveCount(1);
    await expect(tabs.first()).toHaveText(/new tab/i);
    await capture("workspace-tabs-import-refused");
    await expect(page).toHaveScreenshot("workspace-tabs-import-refused.png", { fullPage: true });

    // Dismiss the refusal before retrying so its auto-close timer cannot race the next snapshot.
    await page.locator(".mantine-Notification-closeButton").click();
    await expect(page.getByText(/session storage is full/i)).toBeHidden();
    await restoreWorkspaceWrites(page);
    await modal.getByRole("button", { name: /^import$/i }).click();
    const board = page.getByRole("grid", { name: "Chessboard, White orientation", exact: true });
    await expect(board).toBeVisible();
    await expect(tabs).toHaveCount(1);
    await expect(tabs.first()).toHaveText(/analysis board/i);
    await expect(page.getByRole("gridcell", { name: "e4, White Pawn", exact: true })).toHaveCount(
        1,
    );
    await expect(page.getByRole("gridcell", { name: "e2, empty", exact: true })).toHaveCount(1);
    await capture("workspace-tabs-import-committed");
    await expect(page).toHaveScreenshot("workspace-tabs-import-committed.png", { fullPage: true });

    await preserveStorageForReload(page);
    await expect(tabs).toHaveCount(1);
    await expect(tabs.first()).toHaveText(/analysis board/i);
    await expect(board).toBeVisible();
    await expect(page.getByRole("gridcell", { name: "e4, White Pawn", exact: true })).toHaveCount(
        1,
    );
});
