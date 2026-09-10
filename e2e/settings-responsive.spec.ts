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

test("settings-responsive: labels every accent colour at a wide viewport", async ({
    page,
    capture,
}) => {
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto("/settings");

    const appearance = page.getByRole("tab", { name: /appearance/i });
    await appearance.click();
    await expect(appearance).toHaveAttribute("aria-selected", "true");

    const radioGroup = page.getByRole("radiogroup", { name: "Accent Color" });
    const swatches = radioGroup.getByRole("radio");
    const expectedNames = [
        "Dark accent color",
        "Gray accent color",
        "Red accent color",
        "Pink accent color",
        "Grape accent color",
        "Violet accent color",
        "Indigo accent color",
        "Blue accent color",
        "Cyan accent color",
        "Teal accent color",
        "Green accent color",
        "Lime accent color",
        "Yellow accent color",
        "Orange accent color",
    ];
    await expect(swatches).toHaveCount(expectedNames.length);
    for (const [index, name] of expectedNames.entries()) {
        await expect(swatches.nth(index)).toHaveAccessibleName(name);
    }

    const redSwatch = radioGroup.getByRole("radio", { name: "Red accent color" });
    await redSwatch.click();
    await expect(redSwatch).toHaveAttribute("aria-checked", "true");
    await expect(radioGroup.locator('[role="radio"][aria-checked="true"]')).toHaveCount(1);

    await radioGroup.scrollIntoViewIfNeeded();
    await capture("settings-accent-colours");
});
