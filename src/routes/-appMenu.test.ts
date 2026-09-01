import { afterEach, expect, test } from "vitest";
import {
    buildAppMenuTree,
    clearSavedDataFromMenu,
    createNewTabFromMenu,
    installAppMenuSurface,
    installRealAppMenu,
    menuWindowPlatform,
    openPgnFromMenu,
    openSettingsFromMenu,
    renderTopBar,
    resetInstallChainForTests,
    runNativeMenuAction,
    wantNativeDecorations,
    type AppMenuCallbacks,
    type MenuGroup,
    type MenuHandle,
} from "./-appMenu";

afterEach(() => {
    resetInstallChainForTests();
});

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

function idsOf(groups: MenuGroup[], label: string): string[] {
    const group = groups.find((item) => item.label === label);
    if (!group) return [];
    return group.options.flatMap((option) =>
        "kind" in option && option.kind === "separator" ? [] : option.id ? [option.id] : [],
    );
}

function option(groups: MenuGroup[], groupLabel: string, id: string) {
    const group = groups.find((item) => item.label === groupLabel);
    const found = group?.options.find(
        (item) => !("kind" in item && item.kind === "separator") && item.id === id,
    );
    if (!found || "kind" in found) throw new Error(`missing ${groupLabel}/${id}`);
    return found;
}

function callbacks(overrides: Partial<AppMenuCallbacks> = {}): AppMenuCallbacks {
    return {
        about: () => undefined,
        createNewTab: () => undefined,
        openNewFile: () => undefined,
        openSettings: () => undefined,
        exit: () => undefined,
        reload: () => undefined,
        toggleFullscreen: () => undefined,
        documentation: () => undefined,
        clearSavedData: () => undefined,
        openLogs: () => undefined,
        ...overrides,
    };
}

const t = (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key;

test("non-macOS tree has File/View/Help with Exit and About", () => {
    const actions = callbacks();
    const groups = buildAppMenuTree({
        t,
        isMacOS: false,
        newTabShortcut: "Ctrl+T",
        openFileShortcut: "Ctrl+O",
        callbacks: actions,
    });
    expect(groups.map((group) => group.label)).toEqual(["Menu.File", "Menu.View", "Menu.Help"]);
    expect(idsOf(groups, "Menu.File")).toEqual(["new_tab", "open_file", "exit"]);
    expect(idsOf(groups, "Menu.View")).toEqual(["reload", "toggle_fullscreen"]);
    expect(idsOf(groups, "Menu.Help")).toEqual([
        "documentation",
        "clear_saved_data",
        "logs",
        "about",
    ]);
    expect(option(groups, "Menu.File", "new_tab").shortcut).toBe("Ctrl+T");
    expect(option(groups, "Menu.File", "open_file").shortcut).toBe("Ctrl+O");
    expect(option(groups, "Menu.View", "toggle_fullscreen").shortcut).toBe("F11");
    expect(option(groups, "Menu.File", "exit").action).toBe(actions.exit);
    expect(option(groups, "Menu.Help", "about").action).toBe(actions.about);
    expect(groups.some((group) => group.options.some((item) => "item" in item && item.item))).toBe(
        false,
    );
});

test("macOS tree has Application/Edit, no File Exit, no Help About", () => {
    const actions = callbacks();
    const groups = buildAppMenuTree({
        t,
        isMacOS: true,
        newTabShortcut: "Cmd+T",
        openFileShortcut: "Cmd+O",
        callbacks: actions,
    });
    expect(groups.map((group) => group.label)).toEqual([
        "Menu.Application.Menu",
        "Menu.File",
        "Menu.Edit",
        "Menu.View",
        "Menu.Help",
    ]);
    expect(idsOf(groups, "Menu.File")).toEqual(["new_tab", "open_file"]);
    expect(idsOf(groups, "Menu.Help")).toEqual(["documentation", "clear_saved_data", "logs"]);
    expect(option(groups, "Menu.Application.Menu", "about").action).toBe(actions.about);
    const hide = groups[0].options.find((item) => "item" in item && item.item === "Hide");
    const quit = groups[0].options.find((item) => "item" in item && item.item === "Quit");
    expect(hide).toBeDefined();
    expect(quit).toBeDefined();
    expect(option(groups, "Menu.View", "toggle_fullscreen").shortcut).toBe("Ctrl+Cmd+F");
});

test("changing t changes labels", () => {
    const groups = buildAppMenuTree({
        t: (key) => `${key}.fr`,
        isMacOS: false,
        newTabShortcut: "Ctrl+T",
        openFileShortcut: "Ctrl+O",
        callbacks: callbacks(),
    });
    expect(groups[0].label).toBe("Menu.File.fr");
    expect(option(groups, "Menu.File.fr", "exit").label).toBe("Menu.File.Exit.fr");
});

test("openPgnFromMenu stays pending until openFile settles and skips navigate on cancel", async () => {
    const opened = deferred<void>();
    let navigated = false;
    const pending = openPgnFromMenu({
        pickPgnFile: async () => ({ name: "a.pgn" }),
        navigate: async () => {
            navigated = true;
        },
        openFile: () => opened.promise,
    });
    await Promise.resolve();
    expect(navigated).toBe(true);
    let settled = false;
    void pending.then(() => {
        settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    opened.resolve();
    await pending;
    expect(settled).toBe(true);

    let navigatedAfterCancel = false;
    await openPgnFromMenu({
        pickPgnFile: async () => null,
        navigate: async () => {
            navigatedAfterCancel = true;
        },
        openFile: async () => {
            throw new Error("should not open");
        },
    });
    expect(navigatedAfterCancel).toBe(false);
});

test("openPgnFromMenu rejects when openFile rejects", async () => {
    await expect(
        openPgnFromMenu({
            pickPgnFile: async () => ({ name: "a.pgn" }),
            navigate: async () => undefined,
            openFile: async () => {
                throw new Error("read failed");
            },
        }),
    ).rejects.toThrow("read failed");
});

test("createNewTabFromMenu awaits createTab after navigate", async () => {
    const created = deferred<void>();
    let navigated = false;
    const pending = createNewTabFromMenu({
        navigate: async () => {
            navigated = true;
        },
        createTab: () => created.promise,
    });
    await Promise.resolve();
    expect(navigated).toBe(true);
    let settled = false;
    void pending.then(() => {
        settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    created.resolve();
    await pending;
});

test("openSettingsFromMenu awaits navigate", async () => {
    const nav = deferred<void>();
    const pending = openSettingsFromMenu({ navigate: () => nav.promise });
    let settled = false;
    void pending.then(() => {
        settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    nav.resolve();
    await pending;
});

test("clearSavedDataFromMenu does not clear when ask is false", async () => {
    let cleared = false;
    await clearSavedDataFromMenu({
        ask: async () => false,
        confirmMessage: "sure?",
        title: "clear",
        clear: () => {
            cleared = true;
        },
    });
    expect(cleared).toBe(false);
});

test("runNativeMenuAction notifies string rejections and skips Cancellation", async () => {
    const seen: unknown[] = [];
    await runNativeMenuAction(
        async () => {
            throw "permission denied";
        },
        (error) => {
            seen.push(error);
        },
    );
    expect(seen).toEqual(["permission denied"]);

    await runNativeMenuAction(
        async () => {
            throw new Error("Cancellation");
        },
        (error) => {
            seen.push(error);
        },
    );
    expect(seen).toEqual(["permission denied"]);
});

function fakeMenu(label: string, setAs?: () => Promise<MenuHandle | null>): MenuHandle {
    return {
        setAsAppMenu: setAs ?? (async () => null),
        close: async () => undefined,
        label,
    } as MenuHandle & { label: string };
}

test("installAppMenuSurface createMenu reject notifies and skips later mutations", async () => {
    const calls: string[] = [];
    const notified: unknown[] = [];
    const result = await installAppMenuSurface({
        groups: [],
        wantRealMenu: true,
        wantDecorations: true,
        previousDecorationsApplied: false,
        isCurrent: () => true,
        createMenu: async () => {
            throw new Error("create failed");
        },
        setDecorations: async () => {
            calls.push("decorations");
        },
        closeMenu: async () => {
            calls.push("close");
        },
        notify: (error) => {
            notified.push(error);
        },
    });
    expect(result.decorationsApplied).toBe(false);
    expect(calls).toEqual([]);
    expect(notified).toHaveLength(1);
});

test("stale after createMenu closes the new menu and does not install", async () => {
    const closed: string[] = [];
    let current = true;
    const created = fakeMenu("new", async () => {
        throw new Error("should not install");
    });
    const result = await installAppMenuSurface({
        groups: [],
        wantRealMenu: true,
        wantDecorations: true,
        previousDecorationsApplied: true,
        isCurrent: () => current,
        createMenu: async () => {
            current = false;
            return created;
        },
        setDecorations: async () => {
            throw new Error("should not decorate");
        },
        closeMenu: async (menu) => {
            closed.push((menu as MenuHandle & { label?: string }).label ?? "menu");
        },
        notify: () => {
            throw new Error("should not notify");
        },
    });
    expect(result.decorationsApplied).toBe(true);
    expect(closed).toEqual(["new"]);
});

test("wantRealMenu false creates an empty group list", async () => {
    let received: MenuGroup[] | undefined;
    await installAppMenuSurface({
        groups: [{ label: "File", options: [] }],
        wantRealMenu: false,
        wantDecorations: false,
        previousDecorationsApplied: false,
        isCurrent: () => true,
        createMenu: async (groups) => {
            received = groups;
            return fakeMenu("empty");
        },
        setDecorations: async () => undefined,
        closeMenu: async () => undefined,
        notify: () => undefined,
    });
    expect(received).toEqual([]);
});

test("setAsAppMenu reject closes created menu and keeps previous decorations", async () => {
    const closed: string[] = [];
    const created = fakeMenu("new", async () => {
        throw new Error("install failed");
    });
    const result = await installAppMenuSurface({
        groups: [],
        wantRealMenu: true,
        wantDecorations: true,
        previousDecorationsApplied: true,
        isCurrent: () => true,
        createMenu: async () => created,
        setDecorations: async () => {
            throw new Error("should not decorate");
        },
        closeMenu: async (menu) => {
            closed.push((menu as MenuHandle & { label?: string }).label ?? "menu");
        },
        notify: () => undefined,
    });
    expect(result.decorationsApplied).toBe(true);
    expect(closed).toEqual(["new"]);
});

test("setDecorations reject keeps previous decorationsApplied", async () => {
    const result = await installAppMenuSurface({
        groups: [],
        wantRealMenu: true,
        wantDecorations: false,
        previousDecorationsApplied: true,
        isCurrent: () => true,
        createMenu: async () => fakeMenu("new"),
        setDecorations: async () => {
            throw new Error("deco failed");
        },
        closeMenu: async () => undefined,
        notify: () => undefined,
    });
    expect(result.decorationsApplied).toBe(true);
});

test("stale after setDecorations does not report the new decorations as applied", async () => {
    let current = true;
    const result = await installAppMenuSurface({
        groups: [],
        wantRealMenu: true,
        wantDecorations: true,
        previousDecorationsApplied: false,
        isCurrent: () => current,
        createMenu: async () => fakeMenu("new"),
        setDecorations: async () => {
            current = false;
        },
        closeMenu: async () => undefined,
        notify: () => undefined,
    });
    expect(result.decorationsApplied).toBe(false);
});

test("overlapping installs are serialized: second createMenu waits for the first chain item", async () => {
    const firstSet = deferred<MenuHandle | null>();
    const order: string[] = [];
    const first = installAppMenuSurface({
        groups: [],
        wantRealMenu: true,
        wantDecorations: true,
        previousDecorationsApplied: false,
        isCurrent: () => true,
        createMenu: async () => {
            order.push("create-1");
            return fakeMenu("one", () => {
                order.push("set-1");
                return firstSet.promise;
            });
        },
        setDecorations: async () => {
            order.push("deco-1");
        },
        closeMenu: async () => undefined,
        notify: () => undefined,
    });
    await Promise.resolve();
    const second = installAppMenuSurface({
        groups: [],
        wantRealMenu: true,
        wantDecorations: true,
        previousDecorationsApplied: false,
        isCurrent: () => true,
        createMenu: async () => {
            order.push("create-2");
            return fakeMenu("two");
        },
        setDecorations: async () => {
            order.push("deco-2");
        },
        closeMenu: async () => undefined,
        notify: () => undefined,
    });
    await Promise.resolve();
    expect(order).toEqual(["create-1", "set-1"]);
    firstSet.resolve(null);
    await first;
    await second;
    expect(order[0]).toBe("create-1");
    expect(order.indexOf("create-2")).toBeGreaterThan(order.indexOf("set-1"));
});

test("stale setAsAppMenu rejection does not notify", async () => {
    const notified: unknown[] = [];
    let current = true;
    const setAs = deferred<MenuHandle | null>();
    const pending = installAppMenuSurface({
        groups: [],
        wantRealMenu: true,
        wantDecorations: true,
        previousDecorationsApplied: false,
        isCurrent: () => current,
        createMenu: async () =>
            fakeMenu("new", () => {
                current = false;
                return setAs.promise;
            }),
        setDecorations: async () => undefined,
        closeMenu: async () => undefined,
        notify: (error) => {
            notified.push(error);
        },
    });
    setAs.reject(new Error("late fail"));
    await pending;
    expect(notified).toEqual([]);
});

test("surface helpers match the current linux/win32/macos coupling", () => {
    expect(menuWindowPlatform("linux")).toBe("linux");
    expect(menuWindowPlatform("darwin")).toBe("other");
    expect(wantNativeDecorations(true, "linux")).toBe(true);
    expect(installRealAppMenu(true, "linux")).toBe(true);
    expect(renderTopBar(true, "linux")).toBe(false);
    expect(renderTopBar(false, "linux")).toBe(true);
    expect(renderTopBar(true, "win32")).toBe(false);
    expect(renderTopBar(false, "other")).toBe(false);
    expect(wantNativeDecorations(false, "other")).toBe(true);
});
