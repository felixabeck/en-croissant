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
    assertNothingClipped,
} from "./fixtures";
import { deserializeStorageValue } from "../src/state/store/debouncedStorage";
import { createEmptyCard } from "ts-fsrs";

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

for (const surface of [
    { name: "desktop", width: 1440, scale: "100" },
    { name: "320-200", width: 320, scale: "200" },
]) {
    test(`workspace-tabs: repertoire coverage failure stays unknown and explicit Retry recovers at ${surface.name}`, async ({
        page,
        mockScenario,
        assertNoHorizontalOverflow,
    }, testInfo) => {
        const clockStart = new Date("2026-10-21T00:00:00Z");
        await page.clock.install({ time: clockStart });
        await page.clock.pauseAt(clockStart.getTime() + 1000);
        await page.setViewportSize({ width: surface.width, height: 1000 });
        const database = { id: { id: "coverage-reference" }, kind: "database" } as const;
        await page.addInitScript(
            ({ scale, database }) => {
                localStorage.setItem("font-size", scale);
                localStorage.setItem("reference-database", JSON.stringify(database));
                localStorage.setItem("auto-save", "false");
                if (scale === "200") {
                    // Use the supported focused practice pane at the compact font-scaled size.
                    localStorage.setItem(
                        "windowsState",
                        JSON.stringify({ currentNode: "topRight" }),
                    );
                }
            },
            { scale: surface.scale, database },
        );
        const repertoireFile = {
            ...filesWorkspaceFixture.pgnFile,
            metadata: { type: "repertoire" as const, tags: [] },
        };
        const stats = (move: string) => [[{ move, white: 100, draw: 0, black: 0 }], []];
        await mockScenario({
            commands: filesWorkspaceCommands([[repertoireFile]], {
                ...pgnFileCommands,
                collection_for_database: {
                    result: {
                        id: "22222222-2222-4222-8222-222222222222",
                        name: "Coverage reference",
                        file: { id: { id: "coverage-source" }, kind: "fileWorkspace" },
                        database,
                        status: "ready",
                        generation: "ready-coverage-generation",
                        omitted: 0,
                        account: null,
                        retiredDatabase: null,
                        fetchSinceMs: null,
                    },
                },
                search_position: {
                    outcomes: [
                        // Ready-reference cache reset cancels the first position read before IPC.
                        // Coverage's root read and the replacement position read both succeed.
                        { result: stats("e4") },
                        { result: stats("e4") },
                        { result: stats("c5") },
                        { result: [[], []] },
                        // A stable annotation edit then fails coverage's new root read.
                        {
                            error: {
                                tag: "backend-error",
                                category: "database",
                                message: "Repertoire coverage query failed",
                            },
                        },
                        // Retry covers the actual root, e4 and c5 nodes from pgnFileCommands.
                        { result: stats("e4") },
                        { result: stats("c5") },
                        { result: [[], []] },
                    ],
                    result: [[], []],
                },
            }),
        });
        await page.goto("/library");
        await expect(page.locator("html")).toHaveCSS(
            "font-size",
            surface.scale === "200" ? "32px" : "16px",
        );
        await page.getByRole("button", { name: "Choose collection", exact: true }).click();
        await selectFilesTreeRow(page, repertoireFile.name);
        await page.getByRole("button", { name: "Open game", exact: true }).click();
        await page.getByRole("tab", { name: "Build", exact: true }).click();
        const build = page.getByRole("tabpanel", { name: "Build", exact: true });
        const completeness = build.getByText("No gaps found — your repertoire is complete!", {
            exact: true,
        });
        const prepared = build.getByRole("button", { name: /1\. e4/ });
        const queries = () =>
            page.evaluate(() =>
                window.__E2E_TAURI__
                    .invocations()
                    .filter(({ command }) => command === "search_position"),
            );
        await expect(completeness).toBeVisible();
        await expect(prepared.getByRole("progressbar").last()).toHaveAttribute(
            "aria-valuenow",
            "100",
        );
        expect(await queries()).toHaveLength(4);
        const tab = (await activeWorkspaceTab(page))!;
        // BoardAnalysis's existing good-move hotkey edits the current tree without changing FEN,
        // reference metadata, position-cache ownership or the mounted Practice/Build panel.
        await page.keyboard.press("2");
        await page.clock.runFor(300);
        const raw = await page.evaluate(
            (key) => sessionStorage.getItem(key),
            tab.treeKey ?? tab.value,
        );
        expect(raw).not.toBeNull();
        expect(deserializeStorageValue(raw!)).toMatchObject({
            state: { dirty: true, root: { nags: [1] } },
        });
        const error = build.getByRole("alert");
        const retry = error.getByRole("button", { name: "Retry", exact: true });
        await retry.scrollIntoViewIfNeeded();
        await testInfo.attach(`repertoire-retry-geometry-${surface.name}.json`, {
            body: JSON.stringify(
                await retry.evaluate((element) => {
                    const ancestors = [];
                    for (let node: HTMLElement | null = element; node; node = node.parentElement) {
                        const style = getComputedStyle(node);
                        ancestors.push({
                            tag: node.tagName,
                            className: node.className,
                            rect: node.getBoundingClientRect().toJSON(),
                            clientWidth: node.clientWidth,
                            clientHeight: node.clientHeight,
                            scrollWidth: node.scrollWidth,
                            scrollHeight: node.scrollHeight,
                            scrollLeft: node.scrollLeft,
                            scrollTop: node.scrollTop,
                            overflowX: style.overflowX,
                            overflowY: style.overflowY,
                            padding: style.padding,
                            border: style.borderWidth,
                        });
                    }
                    return { viewport: { width: innerWidth, height: innerHeight }, ancestors };
                }),
                null,
                2,
            ),
            contentType: "application/json",
        });
        await expect(retry).toBeInViewport({ ratio: 1 });
        await expect(error).toContainText("Error");
        await expect(completeness).toHaveCount(0);
        await expect(build.getByRole("button", { name: /Next gap|Biggest gap/i })).toHaveCount(0);
        await expect(prepared).toBeVisible();
        await expect(prepared).toContainText("100");
        await expect(prepared.getByRole("progressbar")).toHaveCount(3);
        await assertNothingClipped(error, { mode: "reachable" });
        await assertNoHorizontalOverflow();
        expect(await queries()).toHaveLength(5);
        const failedAt = await page.evaluate(() => Date.now());
        await page.clock.runFor(2000);
        expect(await page.evaluate(() => Date.now())).toBe(failedAt + 2000);
        expect(await queries()).toHaveLength(5);
        await expect(retry).toBeVisible();
        const coverageNotification = page
            .locator(".mantine-Notification-root")
            .filter({ hasText: "Repertoire coverage query failed" });
        await expect(coverageNotification).toHaveCount(1);
        await expect(coverageNotification).toBeVisible();
        await coverageNotification.locator(".mantine-Notification-closeButton").click();
        await page.clock.resume();
        await expect(coverageNotification).toHaveCount(0);
        await retry.scrollIntoViewIfNeeded();
        await expect(retry).toBeInViewport({ ratio: 1 });
        await testInfo.attach(`repertoire-coverage-error-${surface.name}.png`, {
            body: await page.screenshot({ fullPage: true }),
            contentType: "image/png",
        });

        await retry.click();
        await expect(completeness).toBeVisible();
        await expect(error).toHaveCount(0);
        await expect(build.getByText("Loading position data...", { exact: true })).toHaveCount(0);
        await expect(prepared.getByRole("progressbar")).toHaveCount(4);
        await expect(prepared.getByRole("progressbar").last()).toHaveAttribute(
            "aria-valuenow",
            "100",
        );
        const calls = await queries();
        expect(calls).toHaveLength(8);
        expect(
            calls.map(
                ({ args }) => (args as { query: { position: { fen: string } } }).query.position.fen,
            ),
        ).toEqual([
            "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
            "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
            "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -",
            "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -",
            "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
            "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
            "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -",
            "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -",
        ]);
        await completeness.scrollIntoViewIfNeeded();
        await expect(completeness).toBeInViewport({ ratio: 1 });
        await assertNothingClipped(completeness, { mode: "reachable" });
        await assertNoHorizontalOverflow();
        await testInfo.attach(`repertoire-coverage-recovered-${surface.name}.png`, {
            body: await page.screenshot({ fullPage: true }),
            contentType: "image/png",
        });
    });
}

test("workspace-tabs: incorrect practice reveals the existing answer and its review log names the completed move", async ({
    page,
    mockScenario,
    assertNoHorizontalOverflow,
}, testInfo) => {
    const now = new Date("2026-10-21T12:00:00Z");
    await page.clock.install({ time: now });
    await page.clock.pauseAt(now.getTime() + 1000);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.addInitScript(() => localStorage.setItem("auto-save", "false"));
    const repertoireFile = {
        ...filesWorkspaceFixture.pgnFile,
        metadata: { type: "repertoire" as const, tags: [] },
    };
    const pgn =
        '[Event "Practice feedback"]\n[White "Weiss"]\n[Black "Schwarz"]\n[Result "*"]\n\n1. e4 e5 2. Nf3 *';
    const game = {
        pgn,
        stamp: "c".repeat(64),
        revision: "practice-feedback-revision",
        present: true,
    };
    const cardFen = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2";
    const commands = filesWorkspaceCommands([[repertoireFile]], {
        ...pgnFileCommands,
        read_games: { result: [game] },
        read_game: { result: game },
        file_revision: { result: game.revision },
        lex_pgn: {
            result: [
                { type: "Header", value: { tag: "Event", value: "Practice feedback" } },
                { type: "Header", value: { tag: "White", value: "Weiss" } },
                { type: "Header", value: { tag: "Black", value: "Schwarz" } },
                { type: "Header", value: { tag: "Result", value: "*" } },
                { type: "San", value: "e4" },
                { type: "San", value: "e5" },
                { type: "San", value: "Nf3" },
                { type: "Outcome", value: "*" },
            ],
        },
        load_practice_deck: {
            result: {
                positionsDocument: JSON.stringify({
                    positions: [{ fen: cardFen, answer: "Nf3", card: createEmptyCard(now) }],
                }),
                revision: 1,
                generation: 0,
                migrated: false,
                unappliedReviews: 0,
                orphansAcknowledged: true,
            },
        },
        record_practice_review: { result: 2 },
    });
    await mockScenario({ commands });
    await page.goto("/library");
    await page.getByRole("button", { name: "Choose collection", exact: true }).click();
    await selectFilesTreeRow(page, repertoireFile.name);
    await page.getByRole("button", { name: "Open game", exact: true }).click();
    const start = page.getByRole("button", { name: /Start Practice/ });
    await expect(start).toBeEnabled();
    await start.click();
    const board = page.getByRole("grid", { name: "Chessboard, White orientation", exact: true });
    await expect(board).toBeVisible();
    await expect(board.getByRole("gridcell", { name: "e5, Black Pawn", exact: true })).toHaveCount(
        1,
    );
    const tab = (await activeWorkspaceTab(page))!;
    const storedTree = async () => {
        const raw = await page.evaluate(
            (key) => sessionStorage.getItem(key),
            tab.treeKey ?? tab.value,
        );
        expect(raw).not.toBeNull();
        return deserializeStorageValue<{
            state: {
                root: unknown;
                headers: unknown;
                position: number[];
                practicePath: number[];
                dirty: boolean;
                sourceStamp: string;
            };
        }>(raw!)!.state;
    };
    // Ordinary forward navigation remains bounded at the active card, before its answer.
    await page.keyboard.press("ArrowRight");
    await page.clock.runFor(300);
    const before = await storedTree();
    expect(before).toMatchObject({
        position: [0, 0],
        practicePath: [0, 0],
        dirty: false,
        sourceStamp: game.stamp,
    });
    await playBoardMove(page, page.locator("cg-board").first(), "b1", "c3");
    await page.clock.runFor(1);
    await expect(page.getByText("The correct move was Nf3", { exact: true })).toBeVisible();
    await page.clock.runFor(499);
    expect((await storedTree()).position).toEqual([0, 0]);
    await expect(
        board.getByRole("gridcell", { name: "f3, White Knight", exact: true }),
    ).toHaveCount(0);
    await page.clock.runFor(1);
    await expect(
        board.getByRole("gridcell", { name: "f3, White Knight", exact: true }),
    ).toHaveCount(1);
    await page.clock.runFor(300);
    const after = await storedTree();
    expect(after).toMatchObject({
        position: [0, 0, 0],
        practicePath: [0, 0],
        dirty: false,
        sourceStamp: game.stamp,
    });
    expect(after.root).toEqual(before.root);
    expect(after.headers).toEqual(before.headers);
    const calls = await page.evaluate(() => window.__E2E_TAURI__.invocations());
    expect(calls.filter(({ command }) => command === "sync_practice_positions")).toHaveLength(0);
    expect(calls.filter(({ command }) => command === "write_game")).toHaveLength(0);
    const writes = calls.filter(({ command }) => command === "record_practice_review");
    expect(writes).toHaveLength(1);
    const review = writes[0].args as {
        fileId: string;
        game: number;
        generation: number;
        revision: number;
        baseRevision: number;
        entry: string;
        entryId: string;
        positionsDocument: string;
    };
    expect(review).toMatchObject({
        fileId: repertoireFile.handle.id.id,
        game: 0,
        generation: 0,
        revision: 1,
        baseRevision: 1,
    });
    expect(JSON.parse(review.entry)).toMatchObject({ fen: cardFen, rating: 1 });
    expect(JSON.parse(review.positionsDocument).positions).toHaveLength(1);
    expect(JSON.parse(review.positionsDocument).positions[0]).toMatchObject({
        fen: cardFen,
        answer: "Nf3",
    });
    await testInfo.attach("practice-existing-answer-revealed.png", {
        body: await page.screenshot({ fullPage: true }),
        contentType: "image/png",
    });
    // Let the measured practice flow finish before the history modal's ordinary transition.
    await page.clock.resume();
    // The native history response returns the actual entry and ID produced by the rating path.
    await page.evaluate(
        ({ commands, entry }) =>
            window.__E2E_TAURI__.configure({
                commands: {
                    ...commands,
                    load_practice_reviews: { result: { entries: [entry], nextCursor: null } },
                },
            }),
        { commands, entry: { id: review.entryId, entry: review.entry } },
    );
    await page.getByRole("button", { name: "Show logs", exact: true }).click();
    const log = page.locator(`[data-practice-entry-id="${review.entryId}"]`);
    await expect(log.getByText("1... e5", { exact: true })).toBeVisible();
    await expect(log.getByText("2. e5", { exact: true })).toHaveCount(0);
    await assertNothingClipped(log, { mode: "reachable" });
    await assertNoHorizontalOverflow();
    await testInfo.attach("practice-completed-move-review-log.png", {
        body: await page.screenshot({ fullPage: true }),
        contentType: "image/png",
    });
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
