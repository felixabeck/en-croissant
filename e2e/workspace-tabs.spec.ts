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
} from "./fixtures";

test("workspace-tabs: analysis row and nested column drags resize panes and restore committed percentages", async ({
    page,
    mockScenario,
}) => {
    await mockScenario({
        commands: filesWorkspaceCommands([[gameOpeningFixture.file]], gameOpeningCommands),
    });
    await page.goto("/files");
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
    const box = (await mosaic.boundingBox())!;
    for (const [direction, ratio] of [
        ["row", 60],
        ["column", 65],
    ] as const) {
        const divider = (await mosaic.locator(`.mosaic-split.-${direction}`).boundingBox())!;
        const x =
            direction === "row"
                ? box.x + (box.width * ratio) / 100
                : divider.x + divider.width * 0.75;
        const y =
            direction === "column"
                ? box.y + (box.height * ratio) / 100
                : divider.y + divider.height * 0.25;
        await page.mouse.move(
            direction === "row" ? divider.x + divider.width / 2 : x,
            direction === "column" ? divider.y + divider.height / 2 : y,
        );
        await page.mouse.down();
        await page.mouse.move(x, y, { steps: 5 });
        await page.mouse.up();
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
    await page.goto("/files");
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
