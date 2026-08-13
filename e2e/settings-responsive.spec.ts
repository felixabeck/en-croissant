import { expect, test } from "./fixtures";

test("settings-responsive: preserves keyboard focus at narrow 200% font scale", async ({
    page,
    assertAccessible,
    assertNoHorizontalOverflow,
    capture,
}) => {
    await page.goto("/settings");

    await expect(page.getByRole("heading", { name: /settings/i })).toBeVisible();
    const appearance = page.getByRole("tab", { name: /appearance/i });
    await appearance.focus();
    await page.keyboard.press("Enter");
    await expect(appearance).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("slider", { name: /font size/i })).toBeVisible();
    await assertNoHorizontalOverflow();
    await assertAccessible();
    await capture("settings-responsive");
    await expect(page).toHaveScreenshot("settings-responsive.png", { fullPage: true });
});
