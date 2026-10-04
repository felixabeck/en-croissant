import { expect, test } from "./fixtures";
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
    async function play(from: string, to: string) {
        const box = (await board.boundingBox())!;
        for (const square of [from, to]) {
            const file = square.charCodeAt(0) - "a".charCodeAt(0);
            const rank = Number(square[1]) - 1;
            await page.mouse.click(
                box.x + ((file + 0.5) * box.width) / 8,
                box.y + ((7 - rank + 0.5) * box.height) / 8,
            );
        }
    }
    const previous = page.getByRole("button", { name: "Previous move", exact: true });
    // 1.e4 (1.d4) (1.c4): the first move played is the main line, the others become variations.
    for (const [from, to] of [
        ["e2", "e4"],
        ["d2", "d4"],
        ["c2", "c4"],
    ]) {
        await play(from, to);
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
    await assertNoHorizontalOverflow();
    await assertAccessible();
    await capture("variation-chooser");
    await expect(page).toHaveScreenshot("variation-chooser.png", { fullPage: true });

    await page.keyboard.press("ArrowDown");
    await expect(chooser.getByRole("option", { selected: true })).toHaveText("1. d4");
    await page.keyboard.press("ArrowRight");
    await expect(chooser).toBeHidden();
    await expect(page.getByRole("gridcell", { name: "d4, White Pawn" })).toHaveCount(1);
    await expect(page.getByRole("gridcell", { name: "e2, White Pawn" })).toHaveCount(1);
});
