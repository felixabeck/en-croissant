import {
    assertChooserInsideBoard,
    expect,
    playBoardMove,
    preserveStorageForReload,
    test,
} from "./fixtures";
import type { ErrorPayload } from "../src/bindings/generated";

test("board-keyboard: refuses an excess-material engine game with its localized position message", async ({
    page,
    mockScenario,
}) => {
    const fen = "4k3/8/8/8/8/8/PPPPPPPP/QQQ1K3 w - - 0 1";
    await page.addInitScript(() => {
        localStorage.setItem(
            "engines",
            JSON.stringify([
                {
                    type: "local",
                    id: "e2e-engine",
                    name: "Stockfish 19",
                    version: "19",
                    filename: "stockfish",
                    handle: { id: { id: "e2e-engine-handle" }, kind: "engine" },
                    settings: [],
                    go: { t: "Depth", c: 1 },
                },
            ]),
        );
    });
    await mockScenario({
        commands: {
            start_game: {
                error: {
                    tag: "backend-error",
                    category: "engine-position-rejected",
                    message: "Position cannot be played against an engine",
                } satisfies ErrorPayload,
            },
        },
    });
    await page.goto("/");
    await page.getByRole("button", { name: /^import$/i }).click();
    const modal = page.getByRole("dialog", { name: /import game/i });
    await modal.getByText("FEN", { exact: true }).click();
    await modal.getByRole("textbox", { name: "FEN" }).fill(fen);
    await modal.getByRole("button", { name: /^import$/i }).click();
    await page.getByRole("button", { name: "Play from here", exact: true }).click();
    await page.getByText("Engine", { exact: true }).last().click();
    await expect(page.locator("input[value='Stockfish 19']")).toBeVisible();
    const start = page.getByRole("button", { name: "Start game", exact: true });
    await start.click();
    await expect(page.getByRole("alert")).toHaveText(
        "This position cannot be played against an engine.",
    );
    await expect(page.getByRole("alert")).not.toContainText("Unable to start the game.");
    await expect(start).toBeEnabled();
    const invocations = await page.evaluate(() =>
        window.__E2E_TAURI__.invocations().filter(({ command }) => command === "start_game"),
    );
    expect(invocations).toHaveLength(1);
    expect(invocations[0].args).toMatchObject({
        config: { initialFen: fen, black: { type: "engine", engineId: "e2e-engine" } },
    });
});

test("board-keyboard: opens analysis and exposes a keyboard-operable board", async ({
    page,
    assertAccessible,
    assertNoHorizontalOverflow,
    capture,
}) => {
    await page.goto("/");

    await page.getByRole("button", { name: /^open$/i }).click();
    const whiteBoard = page.getByRole("grid", {
        name: "Chessboard, White orientation",
        exact: true,
    });
    const blackBoard = page.getByRole("grid", {
        name: "Chessboard, Black orientation",
        exact: true,
    });
    await expect(whiteBoard).toBeVisible();
    await expect(whiteBoard).toHaveAttribute("aria-activedescendant", "board-square-e2");
    for (const [square, piece] of [
        ["a1", "White Rook"],
        ["b1", "White Knight"],
        ["c1", "White Bishop"],
        ["d1", "White Queen"],
        ["e1", "White King"],
        ["f2", "White Pawn"],
        ["a8", "Black Rook"],
        ["b8", "Black Knight"],
        ["c8", "Black Bishop"],
        ["d8", "Black Queen"],
        ["e8", "Black King"],
        ["f7", "Black Pawn"],
    ] as const) {
        await expect(
            page.getByRole("gridcell", {
                name: `${square}, ${piece}`,
                exact: true,
            }),
        ).toHaveCount(1);
    }
    await expect(
        page.getByRole("gridcell", { name: "e2, White Pawn", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("gridcell", { name: "e4, empty", exact: true })).toHaveCount(1);
    await expect(page.getByLabel(/^result$/i)).toBeVisible();
    await whiteBoard.focus();
    await expect(whiteBoard).toBeFocused();

    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    await expect(
        page.getByRole("gridcell", {
            name: "f2, White Pawn, move source selected",
            exact: true,
        }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText(/selected|illegal move/i)).toBeVisible();
    await assertNoHorizontalOverflow();
    await assertAccessible();
    await capture("board-keyboard");
    await expect(page).toHaveScreenshot("board-keyboard.png", { fullPage: true });
    await page.keyboard.press("f");
    await expect(blackBoard).toBeVisible();
    await expect(blackBoard.getByRole("gridcell").first()).toHaveAttribute("id", "board-square-h1");
    await expect(blackBoard.getByRole("gridcell").last()).toHaveAttribute("id", "board-square-a8");
    await expect(
        page.getByRole("gridcell", {
            name: "f2, White Pawn, move source selected",
            exact: true,
        }),
    ).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("f");
    await expect(whiteBoard).toBeVisible();
});

test.describe("board-keyboard: German game command errors", () => {
    test.use({ appLocale: "de-DE" });

    test("localizes a rejected game start and keeps retry enabled", async ({
        page,
        mockScenario,
        capture,
    }) => {
        const diagnostic = "private native game-start diagnostic at /private/engine.bin";
        const rejection = {
            tag: "backend-error",
            category: "engine-timeout",
            message: diagnostic,
        } as const satisfies ErrorPayload;

        await mockScenario({ commands: { start_game: { error: rejection } } });
        await page.goto("/");

        await page.getByRole("button", { name: "Spielen", exact: true }).click();
        const startButton = page.getByRole("button", { name: "Beginne Partie", exact: true });
        await expect(startButton).toBeVisible();

        const alert = page.getByRole("alert");
        await startButton.click();
        await expect(alert).toContainText(/Partie konnte nicht gestartet werden/);
        await expect(alert).not.toContainText(diagnostic);
        await expect(page.locator("body")).not.toContainText("/private/engine.bin");
        await expect(page.locator("body")).not.toContainText("Unable to start the game.");
        await expect(startButton).toBeEnabled();

        await startButton.click();
        await expect(alert).toContainText(/Partie konnte nicht gestartet werden/);
        await expect(startButton).toBeEnabled();

        const startInvocations = await page.evaluate(() =>
            window.__E2E_TAURI__.invocations().filter(({ command }) => command === "start_game"),
        );
        expect(startInvocations).toHaveLength(2);

        const logs = await page.evaluate(() =>
            window.__E2E_TAURI__
                .invocations()
                .filter(({ command }) => command === "plugin:log|log"),
        );
        expect(JSON.stringify(logs)).toContain("private native game-start diagnostic at [path]");
        expect(JSON.stringify(logs)).not.toContain("/private/engine.bin");

        await capture("board-game-command-error");
    });
});

test("board-keyboard: next move at a branch asks which continuation to play", async ({
    page,
    assertAccessible,
    assertNoHorizontalOverflow,
    capture,
}) => {
    await page.goto("/");
    await page.getByRole("button", { name: /^open$/i }).click();
    const board = page.locator("cg-board").first();
    await expect(board).toBeVisible();

    // Chessground moves by click-click; squares are located from the board box (White at the bottom).
    const previous = page.getByRole("button", { name: "Previous move", exact: true });
    // 1.e4 (1.d4) (1.c4): the first move played is the main line, the others become variations.
    for (const [from, to] of [
        ["e2", "e4"],
        ["d2", "d4"],
        ["c2", "c4"],
    ]) {
        await playBoardMove(page, board, from, to);
        await expect(page.getByRole("gridcell", { name: `${to}, White Pawn` })).toHaveCount(1);
        await previous.click();
    }
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    // Off the controls, so no tooltip from the last click sits under the list in the screenshot.
    await page.mouse.move(250, 600);

    await page.keyboard.press("ArrowRight");
    const chooser = page.getByRole("listbox", { name: "Choose a continuation" });
    await expect(chooser).toBeVisible();
    await expect(chooser.getByRole("option")).toHaveText(["1. e4", "1. d4", "1. c4"]);
    await expect(chooser.getByRole("option", { selected: true })).toHaveText("1. e4");
    await expect(page.getByRole("gridcell", { name: "e2, White Pawn" })).toHaveCount(1);
    await assertChooserInsideBoard(board, chooser);
    await assertNoHorizontalOverflow();
    await assertAccessible();
    await capture("variation-chooser");
    await expect.soft(page).toHaveScreenshot("variation-chooser.png", { fullPage: true });

    await page.keyboard.press("ArrowDown");
    await expect(chooser.getByRole("option", { selected: true })).toHaveText("1. d4");
    await page.keyboard.press("ArrowRight");
    await expect(chooser).toBeHidden();
    await expect(page.getByRole("gridcell", { name: "d4, White Pawn" })).toHaveCount(1);
    await expect(page.getByRole("gridcell", { name: "e2, White Pawn" })).toHaveCount(1);

    const start = page.getByRole("button", { name: "Go to start", exact: true });
    await start.click();
    await page.getByRole("link", { name: "Settings", exact: true }).click();
    await page.getByRole("tab", { name: "Board", exact: true }).click();
    const chooseVariations = page.getByRole("switch", {
        name: "Choose Variations at Branches",
        exact: true,
    });
    await expect(chooseVariations).toBeChecked();
    await chooseVariations.uncheck();
    await expect(chooseVariations).not.toBeChecked();

    await preserveStorageForReload(page);
    await expect(chooseVariations).not.toBeChecked();
    await page.getByRole("link", { name: "Board", exact: true }).click();
    await expect(board).toBeVisible();
    await start.click();
    await expect(page.getByRole("gridcell", { name: "e2, White Pawn" })).toHaveCount(1);
    await expect(page.getByRole("gridcell", { name: "d2, White Pawn" })).toHaveCount(1);
    await expect(page.getByRole("gridcell", { name: "c2, White Pawn" })).toHaveCount(1);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.mouse.move(250, 600);
    await page.keyboard.press("ArrowRight");
    await expect(chooser).toHaveCount(0);
    await expect(page.getByRole("gridcell", { name: "e4, White Pawn" })).toHaveCount(1);
});

test("board-keyboard: overflowing chooser stays bounded and reaches lower continuations", async ({
    page,
    assertAccessible,
}) => {
    await page.goto("/");
    await page.getByRole("button", { name: /^open$/i }).click();
    const board = page.locator("cg-board").first();
    const previous = page.getByRole("button", { name: "Previous move", exact: true });
    const moves = [
        ["a2", "a3"],
        ["a2", "a4"],
        ["b2", "b3"],
        ["b2", "b4"],
        ["c2", "c3"],
        ["c2", "c4"],
        ["d2", "d3"],
        ["d2", "d4"],
        ["e2", "e3"],
        ["e2", "e4"],
        ["f2", "f3"],
        ["f2", "f4"],
        ["g2", "g3"],
        ["g2", "g4"],
        ["h2", "h3"],
        ["h2", "h4"],
        ["b1", "a3"],
        ["b1", "c3"],
        ["g1", "f3"],
        ["g1", "h3"],
    ];
    for (const [from, to] of moves) {
        await playBoardMove(page, board, from, to);
        await previous.click();
    }
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.mouse.move(250, 600);
    await page.keyboard.press("ArrowRight");
    const chooser = page.getByRole("listbox", { name: "Choose a continuation" });
    await expect(chooser.getByRole("option")).toHaveCount(moves.length);
    await assertChooserInsideBoard(board, chooser);
    expect(await chooser.evaluate((list) => list.scrollHeight > list.clientHeight)).toBe(true);
    await page.keyboard.press("ArrowUp");
    const last = chooser.getByRole("option", { selected: true });
    await expect(last).toHaveText("1. Nh3");
    await expect
        .poll(async () => {
            const listBox = (await chooser.boundingBox())!;
            const rowBox = (await last.boundingBox())!;
            return (
                rowBox.y >= listBox.y - 1 &&
                rowBox.y + rowBox.height <= listBox.y + listBox.height + 1
            );
        })
        .toBe(true);
    await assertChooserInsideBoard(board, chooser);
    await assertAccessible();
    await chooser.getByRole("option", { name: "1. Nf3", exact: true }).click();
    await expect(chooser).toBeHidden();
    await expect(page.getByRole("gridcell", { name: "f3, White Knight", exact: true })).toHaveCount(
        1,
    );
});
