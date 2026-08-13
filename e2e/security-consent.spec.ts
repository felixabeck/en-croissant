import { expect, test } from "./fixtures";

test("security-consent: keeps telemetry opt-in and storage free of credential fields", async ({
    page,
    assertAccessible,
    assertNoHorizontalOverflow,
    capture,
}) => {
    let telemetryRequests = 0;
    await page.route(/https:\/\/(?:app|us\.i|us-assets\.i)\.posthog\.com\/.*/, async (route) => {
        telemetryRequests += 1;
        const isScript = new URL(route.request().url()).pathname.endsWith(".js");
        await route.fulfill({
            status: 200,
            contentType: isScript ? "application/javascript" : "application/json",
            body: isScript ? "" : "{}",
        });
    });
    await page.goto("/settings");

    await page.getByRole("tab", { name: /privacy/i }).click();
    const telemetry = page.getByRole("switch", { name: /telemetry|analytics/i });
    await expect(telemetry).not.toBeChecked();
    await expect
        .poll(() => page.evaluate(() => JSON.stringify({ localStorage, sessionStorage })))
        .not.toContain("accessToken");
    expect(telemetryRequests).toBe(0);

    await telemetry.click();
    await expect(telemetry).toBeChecked();
    await expect.poll(() => telemetryRequests).toBeGreaterThan(0);
    await assertNoHorizontalOverflow();
    await assertAccessible();
    await capture("security-consent");
    await expect(page).toHaveScreenshot("security-consent.png", { fullPage: true });
});
