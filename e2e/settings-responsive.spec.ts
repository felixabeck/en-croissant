import { test as plain } from "@playwright/test";
import { assertNothingClipped, assertPageNotClipped, expect, test } from "./fixtures";

test("settings-responsive: preserves keyboard focus at narrow 200% font scale", async ({
    page,
    assertAccessible,
    assertNoHorizontalOverflow,
    capture,
}) => {
    await page.goto("/settings");

    await expect(page.getByRole("heading", { name: /settings/i })).toBeVisible();
    // The Board tab is open first, so it has to be there to be measured.
    await expect(page.getByRole("tabpanel", { name: /board/i })).toBeVisible();
    await assertNoHorizontalOverflow();
    await assertPageNotClipped(page);
    const appearance = page.getByRole("tab", { name: /appearance/i });
    await appearance.focus();
    await page.keyboard.press("Enter");
    await expect(appearance).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("slider", { name: /font size/i })).toBeVisible();
    await assertNoHorizontalOverflow();
    await assertPageNotClipped(page);
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

// The page-wide clipping check proves the 320px layout, so each of its rules is pinned here on a
// synthetic page: one case per rule, so dropping any rule turns exactly its case red.
const text = "<span style='white-space: nowrap'>An unbreakable line of text</span>";
const clippingCases: { name: string; html: string; lost: boolean; scrollY?: number }[] = [
    {
        name: "hidden box narrower than its text",
        lost: true,
        html: `<div style="width: 50px; overflow: hidden">${text}</div>`,
    },
    {
        name: "clip box narrower than its text",
        lost: true,
        html: `<div style="width: 50px; overflow: clip">${text}</div>`,
    },
    {
        name: "visible spill past the viewport",
        lost: true,
        html: `<div style="width: 50px"><span style="white-space: nowrap">${"text ".repeat(30)}</span></div>`,
    },
    {
        name: "fixed box whose content overflows it vertically",
        lost: true,
        html: `<div style="position: fixed; top: 0; width: 200px; height: 20px"><div style="padding-top: 60px">tall</div></div>`,
    },
    {
        name: "fixed box past the right edge",
        lost: true,
        html: `<div style="position: fixed; left: 300px; width: 100px">x</div>`,
    },
    {
        name: "fixed box below the bottom edge",
        lost: true,
        html: `<div style="position: fixed; top: 700px; height: 100px">x</div>`,
    },
    { name: "box left of the page", lost: true, html: `<div style="margin-left: -60px">x</div>` },
    {
        name: "absolute box above the document",
        lost: true,
        html: `<div style="position: absolute; top: -50px; height: 20px">x</div>`,
    },
    {
        name: "box left of its scrolling container",
        lost: true,
        html: `<div style="width: 100px; margin-left: 100px; overflow: auto"><div style="margin-left: -60px">x</div></div>`,
    },
    {
        name: "box above its clipping container",
        lost: true,
        html: `<div style="position: relative; overflow: hidden; height: 50px; margin-top: 100px"><div style="position: absolute; top: -30px; height: 20px">x</div></div>`,
    },
    {
        name: "ellipsis box cut vertically",
        lost: true,
        html: `<div style="height: 20px; overflow: hidden; text-overflow: ellipsis"><div style="padding-top: 60px">tall</div></div>`,
    },
    {
        name: "scroller squeezed to no height",
        lost: true,
        html: `<div style="display: flex; flex-direction: column; height: 40px"><div style="height: 40px">x</div><div style="flex: 1 1 0%; min-height: 0; overflow: auto"><div style="height: 80px">hidden list</div></div></div>`,
    },
    {
        name: "hidden box cutting a padded parent's text",
        lost: true,
        html: `<div style="width: 50px; overflow: hidden"><span style="display: inline-block; padding: 0 4px; white-space: nowrap">An unbreakable line</span></div>`,
    },
    {
        name: "hidden box around a scroller, overflowing only by padding",
        lost: false,
        html: `<div style="width: 100px; overflow: hidden"><div style="overflow-x: auto">${text}</div><span style="display: inline-block; padding-right: 150px">x</span></div>`,
    },
    {
        name: "hidden box cutting only a parent's padding",
        lost: false,
        html: `<div style="width: 50px; overflow: hidden"><span style="display: inline-block; padding-right: 60px">x</span></div>`,
    },
    {
        name: "hidden box overflowing only by an empty margin",
        lost: false,
        html: `<div style="width: 50px; overflow: hidden"><span style="display: inline-block; width: 40px; margin-right: 50px">x</span></div>`,
    },
    {
        name: "visible spill within the viewport",
        lost: false,
        html: `<div style="width: 50px">${text}</div>`,
    },
    {
        name: "auto box",
        lost: false,
        html: `<div style="width: 50px; overflow-x: auto">${text}</div>`,
    },
    {
        name: "scroll box",
        lost: false,
        html: `<div style="width: 50px; overflow-x: scroll">${text}</div>`,
    },
    {
        name: "spill into an auto parent",
        lost: false,
        html: `<div style="overflow: auto"><div style="width: 50px">${text}</div></div>`,
    },
    {
        name: "spill into a scroll parent",
        lost: false,
        html: `<div style="overflow: scroll"><div style="width: 50px">${text}</div></div>`,
    },
    {
        name: "single-line ellipsis",
        lost: false,
        html: `<div style="width: 50px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis">An unbreakable line of text</div>`,
    },
    {
        name: "invisible box above its clipping container",
        lost: false,
        html: `<div style="position: relative; overflow: hidden; height: 50px; margin-top: 100px"><div style="position: absolute; top: -30px; height: 20px; opacity: 0">x</div></div>`,
    },
    {
        name: "absolute box below the fold",
        lost: false,
        html: `<div style="position: absolute; top: 2000px">x</div>`,
    },
    {
        name: "content above the viewport after scrolling down",
        lost: false,
        scrollY: 500,
        html: `<div style="height: 3000px">x</div>`,
    },
];

for (const { name, html, lost, scrollY } of clippingCases) {
    plain(`clipping instrument: ${lost ? "rejects" : "accepts"} ${name}`, async ({ page }) => {
        await page.setContent(`<body style="margin: 0">${html}</body>`);
        if (scrollY) await page.evaluate((y) => window.scrollTo(0, y), scrollY);
        const check = assertNothingClipped(page.locator("body"), { scrollable: "reachable" });
        if (lost) await expect(check).rejects.toThrow(/content clipped/);
        else await check;
    });
}

// The default mode is the Files columns' horizontal-only check, and must stay that.
const defaultModeCases: { name: string; html: string; lost: boolean }[] = [
    {
        name: "a scroll container",
        lost: true,
        html: `<div style="width: 50px; overflow-x: auto">${text}</div>`,
    },
    {
        name: "an invisible box narrower than its text",
        lost: true,
        html: `<div style="width: 50px; overflow: hidden; opacity: 0">${text}</div>`,
    },
    {
        name: "a box above its clipping container",
        lost: false,
        html: `<div style="position: relative; overflow: hidden; height: 50px; margin-top: 100px"><div style="position: absolute; top: -30px; height: 20px">x</div></div>`,
    },
];

for (const { name, html, lost } of defaultModeCases) {
    plain(
        `clipping instrument: the default mode ${lost ? "counts" : "ignores"} ${name}`,
        async ({ page }) => {
            await page.setContent(`<body style="margin: 0">${html}</body>`);
            const check = assertNothingClipped(page.locator("body"));
            if (lost) await expect(check).rejects.toThrow(/content clipped/);
            else await check;
        },
    );
}
