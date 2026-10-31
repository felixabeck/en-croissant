import {
    expect,
    filesWorkspaceCommands,
    filesWorkspaceFixture,
    pgnFileCommands,
    preserveStorageForReload,
    selectFilesTreeRow,
    test,
} from "./fixtures";
import type { Page } from "@playwright/test";

const TEXTURE_URL = /^url\("[^"]*\/board\/wood4-square\.png"\)/;
const BOARD_IMAGE_URL = /url\("[^"]*\/board\/chessriddle\.svg"\)$/;

async function openBoard(page: Page) {
    await page.goto("/");
    await page.getByRole("button", { name: /^open$/i }).click();
    const board = page.locator("cg-board").first();
    await expect(board).toBeVisible();
    return board;
}

async function openAppearanceTab(page: Page) {
    await page.getByRole("link", { name: "Settings", exact: true }).click();
    await page.getByRole("tab", { name: "Appearance", exact: true }).click();
    const woodTexture = page.getByRole("switch", { name: "Wood texture", exact: true });
    await expect(woodTexture).toBeVisible();
    return woodTexture;
}

/** The switch thumb and track colours animate; axe has to read the settled label colours. */
async function waitForTransitionsSettled(page: Page) {
    await page.evaluate(() =>
        Promise.all(document.getAnimations().map((animation) => animation.finished)),
    );
}

test("board-wood-texture: the real stylesheet layers the tile over the board image, and the switch turns it off", async ({
    page,
}) => {
    const board = await openBoard(page);
    // The atom hydrates on mount, so every read of the computed style retries.
    await expect(board).toHaveCSS("background-image", new RegExp(`${TEXTURE_URL.source}, .*`));
    await expect(board).toHaveCSS("background-image", new RegExp(`, ${BOARD_IMAGE_URL.source}`));
    await expect(board).toHaveCSS("background-size", "12.5% 12.5%, cover");
    await expect(board).toHaveCSS("background-blend-mode", "soft-light, normal");

    const woodTexture = await openAppearanceTab(page);
    await expect(woodTexture).toBeChecked();
    await woodTexture.uncheck();
    await expect(woodTexture).not.toBeChecked();
    await expect
        .poll(() => page.evaluate(() => localStorage.getItem("board-wood-texture")))
        .toBe("false");

    // A navigation by URL clears storage, so the stored value is read back by reloading the board
    // page itself; the preserve flag is consumed by that one load.
    await page.getByRole("link", { name: "Board", exact: true }).click();
    await expect(board).toBeVisible();
    await preserveStorageForReload(page);
    await expect(board).toBeVisible();
    await expect(board).toHaveCSS("background-image", /^none, url\(/);
    await expect(board).toHaveCSS("background-image", new RegExp(`, ${BOARD_IMAGE_URL.source}`));
    await expect(board).toHaveCSS("background-size", /, cover$/);
    await expect(board).toHaveCSS("background-size", "12.5% 12.5%, cover");
    await expect(board).toHaveCSS("background-blend-mode", "soft-light, normal");
    expect(await page.evaluate(() => localStorage.getItem("board-wood-texture"))).toBe("false");
});

test("board-wood-texture: Appearance switch track labels pass the accessibility scan on and off", async ({
    page,
    assertAccessible,
}) => {
    await page.goto("/settings");
    const woodTexture = await openAppearanceTab(page);
    await expect(woodTexture).toBeChecked();
    await waitForTransitionsSettled(page);
    await assertAccessible();

    await woodTexture.uncheck();
    await expect(woodTexture).not.toBeChecked();
    await waitForTransitionsSettled(page);
    await assertAccessible();
});

test("board-wood-texture: wood4-square.png is the top-left 128x128 of wood4.jpg", async ({
    page,
}) => {
    await page.goto("/");
    const result = await page.evaluate(async () => {
        const load = (src: string) =>
            new Promise<HTMLImageElement>((resolve, reject) => {
                const image = new Image();
                image.onload = () => resolve(image);
                image.onerror = () => reject(new Error(`could not load ${src}`));
                image.src = src;
            });
        const [tile, source] = await Promise.all([
            load("/board/wood4-square.png"),
            load("/board/wood4.jpg"),
        ]);
        const topLeft = (image: HTMLImageElement) => {
            const canvas = document.createElement("canvas");
            canvas.width = 128;
            canvas.height = 128;
            const context = canvas.getContext("2d")!;
            context.drawImage(image, 0, 0, 128, 128, 0, 0, 128, 128);
            return context.getImageData(0, 0, 128, 128).data;
        };
        const tilePixels = topLeft(tile);
        const sourcePixels = topLeft(source);
        let maxDifference = 0;
        let lowest = 255;
        let highest = 0;
        for (let index = 0; index < tilePixels.length; index += 1) {
            maxDifference = Math.max(
                maxDifference,
                Math.abs(tilePixels[index] - sourcePixels[index]),
            );
            // The crop must carry grain, or "no difference" would prove nothing.
            if (index % 4 === 0) {
                lowest = Math.min(lowest, sourcePixels[index]);
                highest = Math.max(highest, sourcePixels[index]);
            }
        }
        return {
            tile: [tile.naturalWidth, tile.naturalHeight],
            source: [source.naturalWidth, source.naturalHeight],
            maxDifference,
            spread: highest - lowest,
        };
    });
    expect(result.tile).toEqual([128, 128]);
    expect(result.source).toEqual([1024, 1024]);
    expect(result.spread).toBeGreaterThan(10);
    // JPEG decoder rounding between ImageMagick and Chromium; the crop itself is lossless.
    expect(result.maxDifference).toBeLessThanOrEqual(2);
});

test("board-wood-texture: arrows from PGN drawings keep finite coordinates when the stored preference is off", async ({
    page,
    mockScenario,
}) => {
    // A stored value that differs from the atom default hydrates on mount and re-renders the board.
    // Chessground must not apply shapes against the 0x0 bounds it measured at creation.
    await page.addInitScript(() => localStorage.setItem("board-wood-texture", "false"));
    const drawings = "[%cal Ra2a4,Gb2b4,Yc2c4,Bd2d4,Oe2e4,Cf2f4] [%csl Ra5,Gb5,Yc5,Bd5,Oe5,Cf5]";
    const pgn = `[Event "Six colors"]\n[Result "*"]\n\n{${drawings}} 1. e4 *`;
    await mockScenario({
        commands: filesWorkspaceCommands([[filesWorkspaceFixture.pgnFile]], {
            ...pgnFileCommands,
            read_games: {
                result: [
                    { pgn, stamp: "e".repeat(64), revision: "e2e-pgn-revision", present: true },
                ],
            },
            read_game: {
                result: { pgn, stamp: "e".repeat(64), revision: "e2e-pgn-revision", present: true },
            },
            // Mock only native lexing. The real parsePGN and Chessground render the imported data.
            lex_pgn: {
                result: [
                    { type: "Header", value: { tag: "Event", value: "Six colors" } },
                    { type: "Header", value: { tag: "Result", value: "*" } },
                    { type: "Comment", value: drawings },
                    { type: "San", value: "e4" },
                    { type: "Outcome", value: "*" },
                ],
            },
        }),
    });
    await page.goto("/library");
    await page.getByRole("button", { name: /choose collection/i }).click();
    await selectFilesTreeRow(page, filesWorkspaceFixture.pgnFile.name);
    await page.getByRole("button", { name: "Open game", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.getByRole("button", { name: "Go to start", exact: true }).click();
    const board = page.locator(".cg-wrap");
    await expect(board).toBeVisible();
    // The seed took effect: the texture layer is none.
    await expect(board.locator("cg-board")).toHaveCSS("background-image", /^none, url\(/);

    const arrows = board.locator("svg.cg-shapes g[cgHash] line");
    await expect(arrows).toHaveCount(6);
    await expect(board.locator("svg.cg-shapes g[cgHash] circle")).toHaveCount(6);
    const coordinates = await arrows.evaluateAll((lines) =>
        lines.flatMap((line) =>
            ["x1", "y1", "x2", "y2"].map((name) => Number(line.getAttribute(name))),
        ),
    );
    expect(coordinates).toHaveLength(24);
    expect(coordinates.every(Number.isFinite)).toBe(true);
});

test("board-wood-texture: the default board shows the wood grain", async ({ page }) => {
    const board = await openBoard(page);
    await expect(board).toHaveCSS("background-image", TEXTURE_URL);
    await page.mouse.move(0, 0);
    // The project-wide threshold (0.2) lets a colour distance of up to 1409 pass; the grain peaks at
    // 213, so no pixel of a texture-off board would fail against this baseline. Measured in the
    // container on this board: 0.08 and above flags no pixel, 0.06 flags 30094 and 0.05 flags
    // 77716 of 313040.
    await expect(page.locator(".cg-wrap")).toHaveScreenshot("board-wood-texture-on.png", {
        threshold: 0.05,
    });
});
