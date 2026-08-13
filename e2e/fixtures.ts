import AxeBuilder from "@axe-core/playwright";
import { expect, test as base } from "@playwright/test";

type MockCommand = {
    delay?: number;
    error?: string;
    result?: unknown;
    /** Sequential command results model polling and post-mutation refreshes. */
    results?: unknown[];
};

type MockScenario = {
    commands?: Record<string, MockCommand>;
};

type TauriEvent = { event: string; payload: unknown };

const fontScaleByProject: Record<string, number> = {
    "workspace-tabs": 100,
    "board-keyboard": 100,
    "database-files": 200,
    "accounts-puzzles-engines": 200,
    "settings-responsive": 200,
    "async-errors": 200,
    "security-consent": 200,
};

const localeByProject: Record<string, string> = {
    "async-errors": "de-DE",
};

const tauriBootstrap = () => {
    type Response = { delay?: number; error?: string; result?: unknown; results?: unknown[] };
    type Listener = { event: string; callback: number };
    const callbacks = new Map<number, (payload: unknown) => void>();
    const listeners: Listener[] = [];
    let nextCallback = 1;

    const defaultCommands: Record<string, Response> = {
        close_splashscreen: { result: null },
        list_lichess_accounts: { result: [] },
        get_puzzle_workspace: {
            result: {
                root: { id: { id: "puzzle-root" }, kind: "puzzleRoot" },
                displayName: "E2E puzzles",
            },
        },
        get_database_workspace: { result: { id: { id: "database-root" }, kind: "databaseRoot" } },
        list_workspace_databases: { result: [] },
        get_opening_from_fens: { result: [] },
        list_puzzle_databases: { result: [] },
        kill_engines: { result: null },
        abort_game: { result: null },
        "plugin:app|version": { result: "0.0.0-e2e" },
        "plugin:app|tauri_version": { result: "2.10.0" },
        "plugin:cli|cli_matches": { result: { args: { file: { occurrences: 0, value: null } } } },
        "plugin:updater|check": { result: null },
        "plugin:path|resolve_directory": { result: "/e2e/documents" },
        "plugin:path|resolve": { result: "/e2e/documents" },
        "plugin:fs|exists": { result: true },
        "plugin:log|log": { result: null },
        "plugin:event|listen": { result: 1 },
        "plugin:event|unlisten": { result: null },
        "plugin:menu|new": { result: [1, "e2e-menu"] },
        "plugin:menu|set_as_app_menu": { result: null },
        "plugin:window|set_decorations": { result: null },
        "plugin:window|is_maximized": { result: false },
    };

    const state = {
        commands: {} as Record<string, Response>,
        invocations: [] as { command: string; args: unknown }[],
    };

    const emit = (event: string, payload: unknown) => {
        for (const listener of listeners.filter((entry) => entry.event === event)) {
            callbacks.get(listener.callback)?.({ event, id: 1, payload });
        }
    };

    const invoke = async (command: string, args: Record<string, unknown> = {}) => {
        state.invocations.push({ command, args });
        if (command === "plugin:event|listen") {
            const callback = args.handler;
            if (typeof callback === "number")
                listeners.push({ event: String(args.event), callback });
        }

        const response = state.commands[command] ?? defaultCommands[command];
        if (!response) {
            throw new Error(`Unexpected Tauri IPC command: ${command}`);
        }
        if (response.delay)
            await new Promise((resolve) => window.setTimeout(resolve, response.delay));
        if (response.error) throw new Error(response.error);
        return response.results?.length ? response.results.shift() : response.result;
    };

    Object.assign(window, {
        __E2E_TAURI__: {
            configure(scenario: { commands?: Record<string, Response> }) {
                state.commands = scenario.commands ?? {};
            },
            emit,
            invocations: () => [...state.invocations],
        },
        __TAURI_OS_PLUGIN_INTERNALS__: {
            arch: "x86_64",
            eol: "\n",
            exe_extension: "",
            family: "unix",
            os_type: "linux",
            platform: "linux",
            version: "e2e",
        },
        __TAURI_EVENT_PLUGIN_INTERNALS__: {
            unregisterListener(event: string, callback: number) {
                const index = listeners.findIndex(
                    (entry) => entry.event === event && entry.callback === callback,
                );
                if (index >= 0) listeners.splice(index, 1);
            },
        },
        __TAURI_INTERNALS__: {
            metadata: {
                currentWindow: { label: "main" },
                currentWebview: { windowLabel: "main", label: "main" },
            },
            invoke,
            transformCallback(callback: (payload: unknown) => void, once = false) {
                const id = nextCallback++;
                callbacks.set(id, (payload) => {
                    callback(payload);
                    if (once) callbacks.delete(id);
                });
                return id;
            },
            unregisterCallback(id: number) {
                callbacks.delete(id);
            },
            convertFileSrc(path: string, protocol = "asset") {
                return `${protocol}://localhost/${encodeURIComponent(path)}`;
            },
        },
    });
};

export const test = base.extend<{
    assertNoHorizontalOverflow: () => Promise<void>;
    assertAccessible: () => Promise<void>;
    capture: (name: string) => Promise<void>;
    emitTauriEvent: (event: TauriEvent) => Promise<void>;
    mockScenario: (scenario: MockScenario) => Promise<void>;
}>({
    page: async ({ page }, use, testInfo) => {
        const failures: string[] = [];
        const allowedOrigin = new URL(
            (testInfo.project.use.baseURL as string | undefined) ?? "http://127.0.0.1:4173",
        ).origin;
        const fontScale = fontScaleByProject[testInfo.project.name] ?? 100;
        const colorScheme = testInfo.project.use.colorScheme ?? "light";
        const locale = localeByProject[testInfo.project.name] ?? "en-US";

        await page.addInitScript(tauriBootstrap);
        await page.addInitScript(
            ({ scale, scheme, locale }) => {
                localStorage.clear();
                sessionStorage.clear();
                localStorage.setItem("i18nextLng", locale);
                localStorage.setItem("font-size", JSON.stringify(scale));
                localStorage.setItem("mantine-color-scheme", scheme);
            },
            { scale: fontScale, scheme: colorScheme, locale },
        );
        await page.context().route("**/*", async (route) => {
            const url = new URL(route.request().url());
            if (url.origin !== allowedOrigin) {
                failures.push(`Unexpected network request: ${url.href}`);
                await route.abort("blockedbyclient");
                return;
            }
            await route.continue();
        });
        page.on("console", (message) => {
            if (message.type() === "error") failures.push(`Console error: ${message.text()}`);
        });
        page.on("pageerror", (error) => failures.push(`Unhandled error: ${error.message}`));
        page.on("requestfailed", (request) => {
            if (new URL(request.url()).origin === allowedOrigin) {
                failures.push(`Failed local request: ${request.url()}`);
            }
        });

        await use(page);

        if (failures.length > 0) {
            throw new Error(`Browser failures:\n${failures.join("\n")}`);
        }
    },

    mockScenario: async ({ page }, use) => {
        await use(async (scenario) => {
            await page.addInitScript((nextScenario) => {
                window.__E2E_TAURI__.configure(nextScenario);
            }, scenario);
        });
    },

    emitTauriEvent: async ({ page }, use) => {
        await use(async ({ event, payload }) => {
            await page.evaluate(
                ({ event: eventName, payload: eventPayload }) => {
                    window.__E2E_TAURI__.emit(eventName, eventPayload);
                },
                { event, payload },
            );
        });
    },

    assertNoHorizontalOverflow: async ({ page }, use) => {
        await use(async () => {
            const dimensions = await page.evaluate(() => ({
                width: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
                viewport: window.innerWidth,
            }));
            expect(
                dimensions.width,
                `horizontal overflow: ${dimensions.width}px > ${dimensions.viewport}px`,
            ).toBeLessThanOrEqual(dimensions.viewport);
        });
    },

    assertAccessible: async ({ page }, use) => {
        await use(async () => {
            const results = await new AxeBuilder({ page })
                // The app owns these semantic/layout checks; no generic third-party exception is hidden.
                .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
                .analyze();
            expect(
                results.violations,
                results.violations
                    .map(
                        (violation) =>
                            `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`,
                    )
                    .join("\n"),
            ).toEqual([]);
        });
    },

    capture: async ({ page }, use, testInfo) => {
        await use(async (name) => {
            await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
        });
    },
});

export { expect };

declare global {
    interface Window {
        __E2E_TAURI__: {
            configure(scenario: MockScenario): void;
            emit(event: string, payload: unknown): void;
            invocations(): { command: string; args: unknown }[];
        };
    }
}
