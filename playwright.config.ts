import { defineConfig, devices } from "@playwright/test";

const chromium = devices["Desktop Chrome"];

/**
 * Each project owns one high-value journey.  Together they cover the required
 * viewport, colour-scheme, and app-font-scale matrix without multiplying every
 * interaction by all twelve combinations.
 */
export default defineConfig({
    testDir: "./e2e",
    timeout: 45_000,
    expect: { timeout: 8_000 },
    fullyParallel: false,
    forbidOnly: true,
    retries: 0,
    workers: 1,
    reporter: [
        ["list"],
        ["html", { outputFolder: "artifacts/frontend-audit/html", open: "never" }],
    ],
    outputDir: "artifacts/frontend-audit/test-results",
    use: {
        baseURL: "http://127.0.0.1:4173",
        trace: "on",
        screenshot: "on",
        video: "off",
    },
    snapshotPathTemplate: "{testDir}/{testFilePath}-snapshots/{arg}-{projectName}{ext}",
    projects: [
        {
            name: "workspace-tabs",
            testMatch: /workspace-tabs\.spec\.ts/,
            use: { ...chromium, viewport: { width: 1440, height: 900 }, colorScheme: "light" },
        },
        {
            name: "board-keyboard",
            testMatch: /board-keyboard\.spec\.ts/,
            use: { ...chromium, viewport: { width: 800, height: 720 }, colorScheme: "dark" },
        },
        {
            name: "database-files",
            testMatch: /database-files\.spec\.ts/,
            use: { ...chromium, viewport: { width: 800, height: 720 }, colorScheme: "light" },
        },
        {
            name: "accounts-puzzles-engines",
            testMatch: /accounts-puzzles-engines\.spec\.ts/,
            use: { ...chromium, viewport: { width: 1440, height: 900 }, colorScheme: "dark" },
        },
        {
            name: "settings-responsive",
            testMatch: /settings-responsive\.spec\.ts/,
            use: { ...chromium, viewport: { width: 320, height: 720 }, colorScheme: "light" },
        },
        {
            name: "async-errors",
            testMatch: /async-errors\.spec\.ts/,
            use: { ...chromium, viewport: { width: 320, height: 720 }, colorScheme: "dark" },
        },
        {
            name: "security-consent",
            testMatch: /security-consent\.spec\.ts/,
            use: { ...chromium, viewport: { width: 320, height: 720 }, colorScheme: "dark" },
        },
    ],
    webServer: {
        command:
            "pnpm exec vite build && pnpm exec vite preview --host 127.0.0.1 --port 4173 --strictPort",
        url: "http://127.0.0.1:4173",
        reuseExistingServer: false,
        timeout: 120_000,
    },
});
