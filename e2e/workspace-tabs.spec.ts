import { expect, test } from "./fixtures";

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
