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

    await page.getByRole("button", { name: /^help$/i }).focus();
    await page.keyboard.press("Enter");
    await page.getByRole("menuitem", { name: /^about$/i }).press("Enter");
    const about = page.getByRole("dialog", { name: "ChessFable" });
    await expect(about).toBeVisible();
    await expect(about).toHaveCSS("opacity", "1");
    await capture("settings-about-modal");
    const support = about.getByRole("link", {
        name: "https://github.com/felixabeck/en-croissant",
    });
    await support.scrollIntoViewIfNeeded();
    await expect(support).toHaveAttribute("href", "https://github.com/felixabeck/en-croissant");
    await capture("settings-about-support");
});
