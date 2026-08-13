import { expect, test } from "./fixtures";

test("workspace-tabs: creates, focuses, and cycles workspace tabs", async ({
    page,
    assertAccessible,
    assertNoHorizontalOverflow,
    capture,
}) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/en croissant/i);
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
