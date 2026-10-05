import { expect, test } from "./fixtures";

test("engine-gap: warm actor contract preserves ownership and isolates searches", async ({
    page,
}) => {
    await page.goto("/");
    const invoke = (command: string, args: Record<string, unknown>) =>
        page.evaluate(({ command, args }) => window.__TAURI_INTERNALS__.invoke(command, args), {
            command,
            args,
        });
    const start = (id: string, tab: string, generation: string) =>
        page.evaluate(
            (args) => {
                // Handle the command's rejection without awaiting the still-running search.
                void window.__TAURI_INTERNALS__.invoke("get_best_moves", args).catch(() => {});
            },
            { id, tab, generation },
        );
    const state = () => page.evaluate(() => window.__E2E_TAURI__.engineSearchState());
    const pending = async (...generations: string[]) =>
        expect((await state()).pending).toEqual(generations);
    const cancelled = async (generation: string) =>
        expect((await state()).settled.filter((entry) => entry.generation === generation)).toEqual([
            {
                generation,
                outcome: "cancelled",
                error: { tag: "backend-error", category: "cancellation", message: "Cancellation" },
            },
        ]);
    const stop = (engine: string, tab: string, expectedGeneration: string | null) =>
        invoke("stop_engine", { engine, tab, expectedGeneration });
    const release = (engine: string, tab: string, generation: string) =>
        invoke("release_engine_search", { engine, tab, generation });

    await test.step("(a) same-key supersession and stale generations", async () => {
        await start("contract-engine", "contract-tab", "contract-A");
        await start("contract-engine", "contract-tab", "contract-B");
        await cancelled("contract-A");
        await pending("contract-B");
        expect(await stop("contract-engine", "contract-tab", "contract-A")).toBe(false);
        await pending("contract-B");
        expect(await release("contract-engine", "contract-tab", "contract-A")).toBeNull();
        await pending("contract-B");
        await cancelled("contract-A");
    });

    await test.step("(b) repeated qualified stop retains owner", async () => {
        expect(await stop("contract-engine", "contract-tab", "contract-B")).toBe(true);
        await cancelled("contract-B");
        await pending();
        expect(await stop("contract-engine", "contract-tab", "contract-B")).toBe(true);
        await cancelled("contract-B");
        await pending();
        expect(await release("contract-engine", "contract-tab", "contract-B")).toBeNull();
        expect(await stop("contract-engine", "contract-tab", "contract-B")).toBe(false);
        await cancelled("contract-B");
    });

    await test.step("(c) engine and tab isolation across stop, release and kill", async () => {
        await start("engine-1", "tab-1", "isolation-1");
        await start("engine-1", "tab-2", "isolation-2");
        await start("engine-2", "tab-1", "isolation-3");
        await start("engine-2", "tab-2", "isolation-4");
        await pending("isolation-1", "isolation-2", "isolation-3", "isolation-4");

        expect(await stop("engine-1", "tab-1", "isolation-1")).toBe(true);
        await cancelled("isolation-1");
        await pending("isolation-2", "isolation-3", "isolation-4");

        expect(await release("engine-1", "tab-2", "isolation-2")).toBeNull();
        await cancelled("isolation-2");
        expect(await stop("engine-1", "tab-2", "isolation-2")).toBe(false);
        await pending("isolation-3", "isolation-4");

        expect(await invoke("kill_engine", { engine: "engine-2", tab: "tab-1" })).toBeNull();
        await cancelled("isolation-3");
        expect(await stop("engine-2", "tab-1", "isolation-3")).toBe(false);
        await pending("isolation-4");

        await start("engine-1", "tab-1", "isolation-5");
        await start("engine-2", "tab-1", "isolation-6");
        await start("engine-1", "tab-2", "isolation-7");
        expect(await invoke("kill_engines", { tab: "tab-1" })).toBeNull();
        await cancelled("isolation-5");
        await cancelled("isolation-6");
        expect(await stop("engine-1", "tab-1", "isolation-5")).toBe(false);
        expect(await stop("engine-2", "tab-1", "isolation-6")).toBe(false);
        await pending("isolation-4", "isolation-7");

        expect(await stop("engine-1", "tab-2", "isolation-7")).toBe(true);
        expect(await stop("engine-1", "tab-2", null)).toBe(false);
        await cancelled("isolation-7");
        expect(await stop("engine-1", "tab-2", "isolation-7")).toBe(false);
        await pending("isolation-4");

        expect(await stop("engine-2", "tab-2", "isolation-4")).toBe(true);
        expect(await stop("engine-2", "tab-2", null)).toBe(false);
        await cancelled("isolation-4");
        expect(await stop("engine-2", "tab-2", "isolation-4")).toBe(false);
        await pending();
        const finalState = await state();
        expect(finalState.settled).toHaveLength(9);
        expect(
            finalState.stops
                .filter(({ expectedGeneration }) => expectedGeneration === "contract-B")
                .map(({ result }) => result),
        ).toEqual([true, true, false]);
    });
});

test("engine-gap: A lines stay dimmed and inert at B until explicitly emitted B lines arrive", async ({
    page,
    emitTauriEvent,
}) => {
    await page.clock.install({ time: new Date("2026-10-05T12:00:00Z") });
    await page.clock.pauseAt(new Date("2026-10-05T12:01:00Z"));
    await page.addInitScript(() => {
        localStorage.setItem(
            "engines",
            JSON.stringify([
                {
                    type: "local",
                    id: "e2e-engine",
                    name: "E2E Stockfish",
                    version: "19",
                    filename: "stockfish",
                    handle: { id: { id: "e2e-engine-handle" }, kind: "engine" },
                    loaded: true,
                    settings: [],
                    go: { t: "Infinite" },
                },
            ]),
        );
    });
    await page.goto("/");
    await page.getByRole("button", { name: /^open$/i }).click();
    await page.getByRole("tab", { name: "Analysis", exact: true }).click();
    await page.getByRole("button", { name: "Enable engine", exact: true }).click();
    const searches = () =>
        page.evaluate(() =>
            window.__E2E_TAURI__
                .invocations()
                .filter(({ command }) => command === "get_best_moves"),
        );
    await expect.poll(async () => (await searches()).length).toBe(1);
    const panel = page.locator(".mantine-Accordion-item").filter({ hasText: "E2E Stockfish" });
    await expect(panel.locator(".mantine-Skeleton-root")).toHaveCount(0);
    await expect(panel).not.toContainText("Loading");
    const emitLines = async (
        index: number,
        sanMoves: string[],
        uciMoves: string[],
        score: number,
    ) => {
        const request = (await searches())[index].args as {
            id: string;
            tab: string;
            generation: string;
            options: { fen: string; moves: string[] };
        };
        await emitTauriEvent({
            event: "best-moves-payload",
            payload: {
                engine: request.id,
                tab: request.tab,
                generation: request.generation,
                fen: request.options.fen,
                moves: request.options.moves,
                progress: 50,
                bestLines: [
                    {
                        depth: 20,
                        multipv: 1,
                        nodes: 1234,
                        nps: 5678,
                        score: { value: { type: "cp", value: score }, wdl: null },
                        sanMoves,
                        uciMoves,
                    },
                ],
            },
        });
    };
    await emitLines(0, ["e4", "e5", "Nf3"], ["e2e4", "e7e5", "g1f3"], 34);
    await expect(panel.getByRole("button", { name: "e4", exact: true })).toBeVisible();
    await page.mouse.move(1400, 850);
    const before = await panel.boundingBox();
    const board = page.getByRole("grid", { name: "Chessboard, White orientation", exact: true });
    await board.focus();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("Enter");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Enter");
    await expect.poll(async () => (await searches()).length).toBe(2);
    const [searchA, searchB] = (await searches()).map(
        ({ args }) => args as { id: string; tab: string; generation: string },
    );
    const engineSearchState = await page.evaluate(() => window.__E2E_TAURI__.engineSearchState());
    expect(engineSearchState.settled).toEqual([
        {
            generation: searchA.generation,
            outcome: "cancelled",
            error: { tag: "backend-error", category: "cancellation", message: "Cancellation" },
        },
    ]);
    expect(engineSearchState.pending).toEqual([searchB.generation]);
    expect(
        engineSearchState.stops.filter(
            ({ engine, tab, expectedGeneration }) =>
                engine === searchA.id &&
                tab === searchA.tab &&
                expectedGeneration === searchA.generation,
        ),
    ).toEqual([
        {
            engine: searchA.id,
            tab: searchA.tab,
            expectedGeneration: searchA.generation,
            result: true,
        },
    ]);
    // Advance the board's animation frames under the controlled clock, below the loading deadline.
    await page.clock.runFor(250);
    await expect(page.getByRole("gridcell", { name: "d4, White Pawn", exact: true })).toHaveCount(
        1,
    );
    const oldRow = panel.locator("tr[inert]").filter({ hasText: "e4" });
    await expect(oldRow).toHaveCount(1);
    await expect(oldRow).toHaveCSS("opacity", "0.5");
    await expect(panel.locator(".mantine-Skeleton-root")).toHaveCount(0);
    await expect(panel).not.toContainText("Loading");
    expect((await panel.boundingBox())!.height).toBe(before!.height);
    const oldMove = oldRow.locator("button").first();
    await oldMove.dispatchEvent("click");
    await oldMove.dispatchEvent("mouseover");
    await oldMove.dispatchEvent("contextmenu");
    await expect.poll(async () => (await searches()).length).toBe(2);
    await expect(page.getByRole("grid")).toHaveCount(1);
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(page).toHaveScreenshot("engine-gap-dimmed.png", { fullPage: true });
    await emitLines(1, ["d5", "c4"], ["d7d5", "c2c4"], 55);
    await expect(panel.locator("tr[inert]")).toHaveCount(0);
    await expect(panel.getByRole("button", { name: "d5", exact: true })).toBeVisible();
    await expect(panel).toContainText("0.55");
    await expect(panel).not.toContainText("Loading");
});
