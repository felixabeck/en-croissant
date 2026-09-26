import {
    expect,
    filesWorkspaceCommands,
    filesWorkspaceFixture,
    pgnFileCommands,
    selectFilesTreeRow,
    test,
} from "./fixtures";

// A wide, short window at 100% font with a file of many games: the shape in which the card's old
// fixed height left the game list two rows high and cut off the lower ranks and the move controls.
const repertoireFile = { ...filesWorkspaceFixture.pgnFile, gameCount: 21 };
const MIN_VISIBLE_GAME_ROWS = 4;
const GAME_ROW_HEIGHT_PX = 30;

test("files-preview: the card fills the window and shows the whole board and its controls", async ({
    page,
    mockScenario,
    assertNoHorizontalOverflow,
    capture,
}) => {
    // A ChessBase evaluation profile ahead of the first move: machine data, never comment prose.
    const lexPgn = pgnFileCommands.lex_pgn.result as unknown[];
    const firstMove = lexPgn.findIndex((token) => (token as { type: string }).type === "San");
    const withCommand = [
        ...lexPgn.slice(0, firstMove),
        { type: "Comment", value: "[%evp 0,34,61,53] sofort vertreiben" },
        ...lexPgn.slice(firstMove),
    ];
    await mockScenario({
        commands: filesWorkspaceCommands([[repertoireFile]], {
            ...pgnFileCommands,
            lex_pgn: { result: withCommand },
        }),
    });
    await page.goto("/files");
    await page.getByRole("button", { name: /choose collection/i }).click();
    await selectFilesTreeRow(page, repertoireFile.name);
    await expect(page.getByText("Weiss - Schwarz")).toBeVisible();
    await expect(page.getByText("sofort vertreiben")).toBeVisible();
    await expect(page.getByText(/%evp/)).toHaveCount(0);

    const listViewport = page
        .locator(".mantine-ScrollArea-viewport")
        .filter({ has: page.getByText("Weiss - Schwarz") });
    const listHeight = await listViewport.evaluate((element) => element.clientHeight);
    expect(listHeight).toBeGreaterThanOrEqual(MIN_VISIBLE_GAME_ROWS * GAME_ROW_HEIGHT_PX);

    const board = page.locator(".cg-wrap");
    await expect(board).toBeInViewport({ ratio: 1 });
    const boardBox = await board.boundingBox();
    expect(boardBox).not.toBeNull();
    expect(Math.abs(boardBox!.width - boardBox!.height)).toBeLessThanOrEqual(1);
    // The board's own box can be square while an ancestor with `overflow: hidden` cuts it off.
    const clippedBy = await board.evaluate((element) => {
        const bottom = element.getBoundingClientRect().bottom;
        for (let node = element.parentElement; node; node = node.parentElement) {
            if (getComputedStyle(node).overflow === "visible") continue;
            if (node.getBoundingClientRect().bottom + 1 < bottom) return node.className;
        }
        return null;
    });
    expect(clippedBy).toBeNull();

    for (const name of ["Go to start", "Previous move", "Next move", "Go to end"]) {
        await expect(page.getByRole("button", { name, exact: true })).toBeInViewport({ ratio: 1 });
    }

    await assertNoHorizontalOverflow();
    await capture("files-preview");
    await expect(page).toHaveScreenshot("files-preview.png");
});
