import {
    expect,
    filesWorkspaceCommands,
    filesWorkspaceFixture,
    pgnFileCommands,
    selectFilesTreeRow,
    test,
} from "./fixtures";
import type { Page } from "@playwright/test";
import type { MockScenario } from "./fixtures";

const { pgnFile } = filesWorkspaceFixture;

const openedGame = {
    pgn: filesWorkspaceFixture.pgnGame,
    stamp: "e".repeat(64),
    revision: "e2e-pgn-revision",
    present: true,
};

async function openFileTab(page: Page, mockScenario: (scenario: MockScenario) => Promise<void>) {
    await mockScenario({
        commands: filesWorkspaceCommands([[pgnFile]], pgnFileCommands),
    });
    await page.goto("/files");
    await page.getByRole("button", { name: /choose collection/i }).click();
    await selectFilesTreeRow(page, pgnFile.name);
    await page.getByRole("button", { name: /^open$/i }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("[data-file-freshness]")).toHaveAttribute(
        "data-file-freshness",
        /^verified:/,
    );
}

async function makeEditedMove(page: Page) {
    const board = page.getByRole("grid", { name: "Chessboard, White orientation" });
    await board.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("gridcell", { name: "f3, White Knight", exact: true })).toHaveCount(
        1,
    );
}

test("file-freshness: shows the conflict panel for an edited game changed on disk", async ({
    page,
    mockScenario,
    assertNoHorizontalOverflow,
    capture,
}) => {
    await openFileTab(page, mockScenario);
    await makeEditedMove(page);

    const changedGame = {
        ...openedGame,
        pgn: filesWorkspaceFixture.pgnGame.replace('[Result "*"]', '[Result "1-0"]'),
        stamp: "f".repeat(64),
        revision: "e2e-pgn-revision-changed",
    };
    await page.evaluate((readGame) => {
        window.__E2E_TAURI__.configure({
            commands: {
                read_game: { result: readGame },
                file_revision: { result: readGame.revision },
            },
        });
    }, changedGame);

    const gate = page.locator("[data-file-freshness]");
    await expect(gate).toHaveAttribute("data-file-freshness", /^conflict:/, { timeout: 8_000 });
    await expect(gate).toContainText("This game changed on disk while you were editing.");
    await expect(gate.getByRole("button", { name: "Reload from disk" })).toBeVisible();
    await expect(
        gate.getByRole("button", { name: "Save my version as a new game…" }),
    ).toBeVisible();
    await expect(page.getByRole("grid")).toHaveCount(0);
    await assertNoHorizontalOverflow();
    await capture("file-freshness-conflict");
    await expect(page).toHaveScreenshot("file-freshness-conflict.png", { fullPage: true });
});

test("file-freshness: shows the unavailable panel when the source file disappears", async ({
    page,
    mockScenario,
    assertNoHorizontalOverflow,
    capture,
}) => {
    await openFileTab(page, mockScenario);

    await page.evaluate(() => {
        window.__E2E_TAURI__.configure({
            commands: {
                file_revision: {
                    error: {
                        tag: "backend-error",
                        category: "missing-resource",
                        message: "The source PGN is no longer available.",
                    },
                },
            },
        });
    });

    const gate = page.locator("[data-file-freshness]");
    await expect(gate).toHaveAttribute("data-file-freshness", /^unavailable:/, {
        timeout: 8_000,
    });
    await expect(gate).toContainText("This game or its file is no longer available.");
    await expect(
        gate.getByRole("button", { name: "Save my version as a new game…" }),
    ).toBeVisible();
    await expect(gate.getByRole("button", { name: "Close tab" })).toBeVisible();
    await expect(page.getByRole("grid")).toHaveCount(0);
    await assertNoHorizontalOverflow();
    await capture("file-freshness-unavailable");
    await expect(page).toHaveScreenshot("file-freshness-unavailable.png", { fullPage: true });
});
