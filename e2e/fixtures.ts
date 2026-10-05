import AxeBuilder from "@axe-core/playwright";
import { expect, test as base, type Locator, type Page } from "@playwright/test";
import type { ErrorPayload } from "../src/bindings/generated";

type MockCommand = {
    delay?: number;
    error?: string | ErrorPayload;
    result?: unknown;
    /** Sequential command results model polling and post-mutation refreshes. */
    results?: unknown[];
};

export type MockScenario = {
    commands?: Record<string, MockCommand>;
};

type MockEngineSearchState = {
    pending: unknown[];
    settled: { generation: unknown; outcome: "cancelled"; error: ErrorPayload }[];
    stops: { engine: unknown; tab: unknown; expectedGeneration: unknown; result: unknown }[];
};

export const filesWorkspaceFixture = {
    workspace: { id: { id: "files-workspace" }, kind: "fileWorkspace" },
    openingDirectory: {
        handle: { id: { id: "opening-directory" }, kind: "fileWorkspace" },
        kind: "directory",
        name: "Openings",
        children: [],
        metadata: null,
        gameCount: null,
        lastModified: 0,
    },
    pgnFile: {
        handle: { id: { id: "najdorf-file" }, kind: "fileWorkspace" },
        kind: "file",
        name: "Najdorf",
        children: [],
        metadata: { type: "game", tags: [] },
        gameCount: 1,
        lastModified: 0,
    },
    pgnGame: '[Event "E2E"]\n[White "Weiss"]\n[Black "Schwarz"]\n[Result "*"]\n\n1. e4 c5 *',
} as const;

const pgnGameStamp = "e".repeat(64);
const pgnGameRevision = "e2e-pgn-revision";
const stampedPgnGame = {
    pgn: filesWorkspaceFixture.pgnGame,
    stamp: pgnGameStamp,
    revision: pgnGameRevision,
    present: true,
};

// The document-width assertion cannot see content that a container absorbs or cuts away, nor
// anything pushed off the left edge — overflow to the left never adds to `scrollWidth` — so a page
// that clipped its content would pass it. This walks every box instead.
//
// `mode: "clipped"` (the default) is horizontal only and counts every box narrower than its
// content, scroll containers included: the Files columns must fit without their own scroll
// container absorbing content. `mode: "reachable"` is the whole-page rule of
// `d-20260831-16`, on both axes, where only lost content of a visible box counts:
// * a box that clips (`overflow: hidden|clip`) while a descendant box or text passes its edge;
// * a spill onto the page itself: sideways past the viewport, or downwards out of a fixed box, which
//   does not move while the page scrolls. A spill into a container is judged there — a scrolling
//   container keeps it reachable, a clipping one reports itself;
// * a fixed or positioned box past the viewport where nothing scrolls to it.
// Both modes count a box that starts before the content of the container holding it, or before the
// document's origin, because scrolling only ever reaches right and down.
export async function assertNothingClipped(
    target: Locator,
    { mode = "clipped" }: { mode?: "clipped" | "reachable" } = {},
) {
    const offenders = await target.evaluate((element, reachableMode) => {
        const axes = [
            {
                name: "x",
                scroll: "scrollWidth",
                client: "clientWidth",
                overflow: "overflowX",
                start: "left",
                end: "right",
                clientStart: "clientLeft",
                scrolled: "scrollLeft",
                page: "scrollX",
                viewport: "innerWidth",
            },
            {
                name: "y",
                scroll: "scrollHeight",
                client: "clientHeight",
                overflow: "overflowY",
                start: "top",
                end: "bottom",
                clientStart: "clientTop",
                scrolled: "scrollTop",
                page: "scrollY",
                viewport: "innerHeight",
            },
        ] as const;
        type Axis = (typeof axes)[number];
        const overflowOf = (node: Element, axis: Axis) => getComputedStyle(node)[axis.overflow];
        const scrolls = (overflow: string) => overflow === "auto" || overflow === "scroll";
        // Where a node's overflow ends up: its nearest ancestor that does not let it spill further,
        // or null for the page itself.
        const container = (node: Element, axis: Axis) => {
            for (let parent = node.parentElement; parent; parent = parent.parentElement) {
                if (parent === document.body || parent === document.documentElement) return null;
                if (overflowOf(parent, axis) !== "visible") return parent;
            }
            return null;
        };
        // A box nobody can see has no visible content to lose: Mantine keeps a finished Button
        // loader mounted at opacity 0, parked above the button, for its exit transition.
        const invisible = (node: Element) => {
            if (getComputedStyle(node).visibility === "hidden") return true;
            for (let box: Element | null = node; box; box = box.parentElement) {
                if (getComputedStyle(box).opacity === "0") return true;
            }
            return false;
        };
        const insideFixed = (node: Element) => {
            for (let box: Element | null = node; box; box = box.parentElement) {
                if (getComputedStyle(box).position === "fixed") return true;
            }
            return false;
        };
        // A box larger than its content on this axis, other than a deliberate, visible truncation:
        // an ellipsis (a game name in the list) truncates inline text, never a vertical cut.
        const overflowing = (node: Element, axis: Axis) =>
            node[axis.scroll] > node[axis.client] + 1 &&
            !(axis.name === "x" && getComputedStyle(node).textOverflow === "ellipsis");
        // `scrollWidth` also counts empty margin and padding (a Mantine Switch track label's 50px
        // margin), so a reported overflow only counts when visible text or a leaf box (an icon, the
        // switch thumb) really passes the edge. An input's value is not in the DOM, so its scroll size is all there is.
        // A text range's rect is the font's content area, which can overhang a tight line box by a
        // pixel or two (a Mantine Button label at 200%) without cutting a glyph; on y the extent is
        // the line boxes, so that half-leading overhang is taken off both ends.
        const textExtent = (text: Text, axis: Axis) => {
            const range = document.createRange();
            range.selectNode(text);
            const box = range.getBoundingClientRect();
            if (box.width === 0 || box.height === 0) return null;
            if (axis.name === "x") return { start: box.left, end: box.right };
            const lineHeight = parseFloat(getComputedStyle(text.parentElement!).lineHeight);
            const line = range.getClientRects()[0];
            const overhang =
                Number.isFinite(lineHeight) && line
                    ? Math.max(0, (line.height - lineHeight) / 2)
                    : 0;
            return { start: box.top + overhang, end: box.bottom - overhang };
        };
        const contentPasses = (node: Element, axis: Axis, edge: number): boolean => {
            if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement)
                return true;
            for (const child of node.childNodes) {
                if (child instanceof Text) {
                    const extent = textExtent(child, axis);
                    if (extent && extent.end > edge + 1) return true;
                    continue;
                }
                if (!(child instanceof Element) || invisible(child)) continue;
                // What paints is text and leaf boxes; a parent's padding is not content. A nested
                // container that does not let overflow spill is judged on its own, so only its own
                // box counts here, never what it scrolls or cuts.
                const nested = overflowOf(child, axis) !== "visible";
                if (child.childNodes.length > 0 && !nested) {
                    if (contentPasses(child, axis, edge)) return true;
                    continue;
                }
                const box = child.getBoundingClientRect();
                if (box.width > 0 && box.height > 0 && box[axis.end] > edge + 1) return true;
            }
            return false;
        };
        const contentLost = (node: Element, axis: Axis) => {
            if (!reachableMode) return axis.name === "x";
            const overflow = overflowOf(node, axis);
            // Scrolling reaches what a scroller holds only if it has room to show some of it: one
            // squeezed to nothing (a stacked panel's list) hides its content entirely.
            if (scrolls(overflow)) return node[axis.client] < 1;
            const ownEdge =
                node.getBoundingClientRect()[axis.start] +
                node[axis.clientStart] +
                node[axis.client];
            if (overflow !== "visible") return contentPasses(node, axis, ownEdge);
            // A visible spill into a container is judged by that container.
            if (container(node, axis)) return false;
            // Onto the page: sideways it is lost only past the viewport, since the page never scrolls
            // sideways; downwards it is lost out of a fixed box, which does not move while the page
            // scrolls and whose spill other fixed chrome paints over (the navbar over the title bar).
            if (axis.name === "x") return contentPasses(node, axis, window.innerWidth);
            return insideFixed(node) && contentPasses(node, axis, ownEdge);
        };
        // Where content held by `bound` starts, in viewport coordinates: scrolling reaches only right
        // and down from there. The page's origin is the document's, except inside a fixed box.
        const contentOrigin = (bound: Element | null, fixed: boolean, axis: Axis) =>
            bound
                ? bound.getBoundingClientRect()[axis.start] +
                  bound[axis.clientStart] -
                  bound[axis.scrolled]
                : fixed
                  ? 0
                  : -window[axis.page];
        const boxLost = (node: Element, box: DOMRect, axis: Axis) => {
            const bound = container(node, axis);
            const fixed = insideFixed(node);
            const origin = contentOrigin(bound, fixed, axis);
            if (box[axis.start] < origin - 1)
                return `starts at ${Math.round(box[axis.start])}, before ${Math.round(origin)}`;
            // Past the far edge: a container's own scroll size covers what it holds; the page scrolls
            // down but never sideways, and a fixed box never moves.
            if (!reachableMode || bound || (axis.name === "y" && !fixed)) return null;
            return box[axis.end] > window[axis.viewport] + 1
                ? `ends at ${Math.round(box[axis.end])}, past the viewport`
                : null;
        };
        // Text can start before its holder even when its element does not (a negative text-indent):
        // the holder is the element itself if it clips or scrolls, else its container.
        const textBeforeOrigin = (node: Element, axis: Axis) => {
            const holder = overflowOf(node, axis) !== "visible" ? node : container(node, axis);
            const origin = contentOrigin(holder, insideFixed(node), axis);
            for (const child of node.childNodes) {
                if (!(child instanceof Text)) continue;
                const extent = textExtent(child, axis);
                if (extent && extent.start < origin - 1)
                    return `text starts at ${Math.round(extent.start)}, before ${Math.round(origin)}`;
            }
            return null;
        };
        const describe = (node: Element, why: string) =>
            `${node.tagName.toLowerCase()}.${String(node.className)}: ${why}`;
        const found: string[] = [];
        const check = (node: Element, placed: boolean) => {
            if (reachableMode && invisible(node)) return;
            const box = node.getBoundingClientRect();
            const laidOut = box.width > 1 && box.height > 1;
            // The Files columns keep their horizontal-only check; the page-wide rule adds y.
            for (const axis of reachableMode ? axes : axes.slice(0, 1)) {
                // No layout-box guard: an element without one (an svg child, an inline span)
                // reports 0 for both sizes, while a scroller squeezed to zero width must count.
                if (overflowing(node, axis) && contentLost(node, axis)) {
                    const size = `${node[axis.scroll]}px > ${node[axis.client]}px`;
                    found.push(describe(node, `${axis.name} ${size}`));
                }
                const lost = placed && laidOut ? boxLost(node, box, axis) : null;
                if (lost) found.push(describe(node, `${axis.name} ${lost}`));
                if (placed) {
                    const text = textBeforeOrigin(node, axis);
                    if (text) found.push(describe(node, `${axis.name} ${text}`));
                }
            }
        };
        for (let node = element.parentElement; node; node = node.parentElement) check(node, false);
        for (const node of [element, ...element.querySelectorAll("*")]) check(node, true);
        return found;
    }, mode === "reachable");
    expect(offenders, `content clipped: ${offenders.join("; ")}`).toEqual([]);
}

// The whole rendered page under the reachable rule — the 320px / 200% layout contract
// (d-20260831-16), beside the document-width check that it does not replace.
export async function assertPageNotClipped(page: Page) {
    await assertNothingClipped(page.locator("body"), { mode: "reachable" });
}

// Both Files columns with everything in them: the controls and tree, the action row and the card.
export async function assertFilesColumnsNotClipped(page: Page) {
    for (const column of await page.locator(".mantine-SimpleGrid-root > *").all()) {
        await assertNothingClipped(column);
    }
}

/** Reloads once without the fixture's per-load storage reset, as a real reload would. */
export async function preserveStorageForReload(page: Page) {
    await page.evaluate(() => sessionStorage.setItem("__E2E_PRESERVE_STORAGE_ONCE__", "1"));
    await page.reload();
}

export async function assertChooserInsideBoard(board: Locator, chooser: Locator) {
    const boardBox = (await board.boundingBox())!;
    const card = chooser.locator("..");
    const cardBox = (await card.boundingBox())!;
    expect(cardBox.x).toBeGreaterThanOrEqual(boardBox.x);
    expect(cardBox.y).toBeGreaterThanOrEqual(boardBox.y);
    expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(boardBox.x + boardBox.width + 1);
    expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(boardBox.y + boardBox.height + 1);
    expect(cardBox.y - boardBox.y).toBeLessThanOrEqual(8);
    // The frame is centred exactly; Chessground rounds the board size down to a multiple of eight
    // device pixels, so its centre can differ by up to 4 px.
    expect(
        Math.abs(cardBox.x + cardBox.width / 2 - boardBox.x - boardBox.width / 2),
    ).toBeLessThanOrEqual(4);
}

export async function playBoardMove(page: Page, board: Locator, from: string, to: string) {
    const box = (await board.boundingBox())!;
    for (const square of [from, to]) {
        const file = square.charCodeAt(0) - "a".charCodeAt(0);
        const rank = Number(square[1]) - 1;
        await page.mouse.click(
            box.x + ((file + 0.5) * box.width) / 8,
            box.y + ((7 - rank + 0.5) * box.height) / 8,
        );
    }
}

// Selects a Files tree row by its name. Once a row wraps at a narrow width its centre can be one of
// its icon buttons, so a plain row click would not select; the name always does.
export async function selectFilesTreeRow(page: Page, name: string): Promise<Locator> {
    const row = page.getByRole("treeitem", { name, exact: true });
    await row.getByText(name, { exact: true }).click();
    await expect(row).toHaveAttribute("aria-selected", "true");
    return row;
}

/** Native answers for selecting `pgnFile`: the card and its game list read and lex the one game. */
export const pgnFileCommands: NonNullable<MockScenario["commands"]> = {
    read_games: { result: [stampedPgnGame] },
    read_game: { result: stampedPgnGame },
    file_revision: { result: pgnGameRevision },
    lex_pgn: {
        result: [
            { type: "Header", value: { tag: "Event", value: "E2E" } },
            { type: "Header", value: { tag: "White", value: "Weiss" } },
            { type: "Header", value: { tag: "Black", value: "Schwarz" } },
            { type: "Header", value: { tag: "Result", value: "*" } },
            { type: "San", value: "e4" },
            { type: "San", value: "c5" },
            { type: "Outcome", value: "*" },
        ],
    },
};

export function filesWorkspaceCommands(
    listResults: unknown[],
    overrides: NonNullable<MockScenario["commands"]> = {},
): NonNullable<MockScenario["commands"]> {
    return {
        issue_file_workspace: {
            result: {
                handle: filesWorkspaceFixture.workspace,
                displayName: "E2E collection",
                availability: "available",
            },
        },
        list_file_workspace: { results: listResults },
        ...overrides,
    };
}

type TauriEvent = { event: string; payload: unknown };

const fontScaleByProject: Record<string, number> = {
    "workspace-tabs": 100,
    "board-keyboard": 100,
    "database-files": 200,
    "accounts-puzzles-engines": 200,
    "settings-responsive": 200,
    "async-errors": 200,
    "security-consent": 200,
    "file-freshness": 100,
    "files-preview": 100,
    "tree-recovery": 100,
};

const localeByProject: Record<string, string> = {
    "async-errors": "de-DE",
};

const tauriBootstrap = () => {
    type Response = MockCommand;
    type Listener = { event: string; callback: number };
    const callbacks = new Map<number, (payload: unknown) => void>();
    const listeners: Listener[] = [];
    const pendingSearches = new Set<{
        id: unknown;
        tab: unknown;
        generation: unknown;
        reject: (error: ErrorPayload) => void;
    }>();
    let nextCallback = 1;
    let nextNativeTicket = 1;

    const defaultCommands: Record<string, Response> = {
        close_splashscreen: { result: null },
        revoke_legacy_lichess_token: { result: null },
        cancel_native_read: { result: null },
        reconcile_startup_path_owners: { result: null },
        reconcile_engine_attachments: { result: null },
        list_lichess_accounts: { result: [] },
        get_puzzle_workspace: {
            result: {
                root: { id: { id: "puzzle-root" }, kind: "puzzleRoot" },
                displayName: "E2E puzzles",
            },
        },
        load_practice_deck: { result: null },
        record_practice_review: { result: 1 },
        sync_practice_positions: { result: 1 },
        reset_practice_deck: { result: 1 },
        load_practice_reviews: { result: { entries: [], nextCursor: null } },
        migrate_practice_deck: {
            result: {
                status: "alreadyMigrated",
                entries: 0,
                positions: 0,
                positionsDigest: "",
                entriesDigest: "",
            },
        },
        acknowledge_practice_orphans: { result: null },
        repair_practice_deck: { result: null },
        list_practice_decks: { result: { decks: [], anomalies: [] } },
        get_database_workspace: { result: { id: { id: "database-root" }, kind: "databaseRoot" } },
        list_workspace_databases: { result: [] },
        get_opening_from_fens: { result: [] },
        list_puzzle_databases: { result: [] },
        kill_engines: { result: null },
        kill_engine: { result: null },
        get_engine_config: { result: { name: "E2E Stockfish", options: [] } },
        stop_engine: { result: false },
        release_engine_search: { result: null },
        abort_game: { result: null },
        "plugin:app|version": { result: "0.0.0-e2e" },
        "plugin:app|tauri_version": { result: "2.10.0" },
        "plugin:cli|cli_matches": { result: { args: { file: { occurrences: 0, value: null } } } },
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
        settledSearches: [] as MockEngineSearchState["settled"],
        stops: [] as MockEngineSearchState["stops"],
    };

    const emit = (event: string, payload: unknown) => {
        for (const listener of listeners.filter((entry) => entry.event === event)) {
            callbacks.get(listener.callback)?.({ event, id: 1, payload });
        }
    };

    const invoke = async (command: string, args: Record<string, unknown> = {}) => {
        state.invocations.push({ command, args });
        if (command === "prepare_native_read") return `e2e-native-read-${nextNativeTicket++}`;
        if (command === "prepare_engine_search") return `e2e-engine-search-${nextNativeTicket++}`;
        if (command === "plugin:event|listen") {
            const callback = args.handler;
            if (typeof callback === "number")
                listeners.push({ event: String(args.event), callback });
        }

        // Native searches stay pending for their lifetime; scenarios can still script a response.
        if (command === "get_best_moves" && !state.commands[command]) {
            return new Promise<null>((_resolve, reject) => {
                pendingSearches.add({
                    id: args.id,
                    tab: args.tab,
                    generation: args.generation,
                    reject,
                });
            }).catch((error: ErrorPayload) => {
                state.settledSearches.push({
                    generation: args.generation,
                    outcome: "cancelled",
                    error,
                });
                throw error;
            });
        }

        const response = state.commands[command] ?? defaultCommands[command];
        if (!response) {
            throw new Error(`Unexpected Tauri IPC command: ${command}`);
        }
        if (response.delay)
            await new Promise((resolve) => window.setTimeout(resolve, response.delay));
        if ("error" in response) {
            if (typeof response.error === "string") throw new Error(response.error);
            throw response.error;
        }
        let retainedSearch = false;
        if (
            command === "stop_engine" ||
            command === "release_engine_search" ||
            command === "kill_engines" ||
            command === "kill_engine"
        ) {
            for (const search of pendingSearches) {
                if (search.tab !== args.tab) continue;
                if (command !== "kill_engines" && search.id !== args.engine) continue;
                if (
                    command === "stop_engine" &&
                    args.expectedGeneration !== null &&
                    args.expectedGeneration !== search.generation
                )
                    continue;
                if (command === "release_engine_search" && args.generation !== search.generation)
                    continue;
                if (command === "stop_engine" && args.expectedGeneration !== null)
                    retainedSearch = true;
                pendingSearches.delete(search);
                search.reject({
                    tag: "backend-error",
                    category: "cancellation",
                    message: "Cancellation",
                });
            }
        }
        const result =
            command === "stop_engine" && !state.commands[command]
                ? retainedSearch
                : response.results?.length
                  ? response.results.shift()
                  : response.result;
        if (command === "stop_engine") {
            state.stops.push({
                engine: args.engine,
                tab: args.tab,
                expectedGeneration: args.expectedGeneration,
                result,
            });
        }
        return result;
    };

    Object.assign(window, {
        __E2E_TAURI__: {
            configure(scenario: MockScenario) {
                state.commands = scenario.commands ?? {};
            },
            emit,
            invocations: () => [...state.invocations],
            engineSearchState: (): MockEngineSearchState => ({
                pending: [...pendingSearches].map(({ generation }) => generation),
                settled: [...state.settledSearches],
                stops: [...state.stops],
            }),
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
        },
    });
};

export const test = base.extend<{
    appLocale: string | undefined;
    assertNoHorizontalOverflow: () => Promise<void>;
    assertAccessible: () => Promise<void>;
    capture: (name: string) => Promise<void>;
    emitTauriEvent: (event: TauriEvent) => Promise<void>;
    mockScenario: (scenario: MockScenario) => Promise<void>;
}>({
    appLocale: [undefined, { option: true }],
    page: async ({ page, appLocale }, use, testInfo) => {
        const failures: string[] = [];
        const allowedOrigin = new URL(
            (testInfo.project.use.baseURL as string | undefined) ?? "http://127.0.0.1:4173",
        ).origin;
        const fontScale = fontScaleByProject[testInfo.project.name] ?? 100;
        const colorScheme = testInfo.project.use.colorScheme ?? "light";
        const locale = appLocale ?? localeByProject[testInfo.project.name] ?? "en-US";

        await page.addInitScript(tauriBootstrap);
        await page.addInitScript(
            ({ scale, scheme, locale }) => {
                const preserveStorageOnce =
                    sessionStorage.getItem("__E2E_PRESERVE_STORAGE_ONCE__") === "1";
                sessionStorage.removeItem("__E2E_PRESERVE_STORAGE_ONCE__");
                if (!preserveStorageOnce) {
                    localStorage.clear();
                    sessionStorage.clear();
                    localStorage.setItem("i18nextLng", locale);
                    localStorage.setItem("font-size", JSON.stringify(scale));
                    localStorage.setItem("mantine-color-scheme", scheme);
                }
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
            engineSearchState(): MockEngineSearchState;
        };
    }
}
