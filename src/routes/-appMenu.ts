import { errorUnlessCancelled } from "@/platform/errors";

export type MenuTranslator = (key: string, options?: { defaultValue?: string }) => string;

export type MenuSeparator = { kind: "separator" };

export type MenuItemAction = {
    kind?: never;
    id?: string;
    label: string;
    shortcut?: string;
    action?: () => void;
    item?: "Hide" | "Copy" | "Cut" | "Paste" | "SelectAll" | "Undo" | "Redo" | "Quit";
};

export type MenuAction = MenuItemAction | MenuSeparator;

export type MenuGroup = {
    label: string;
    options: MenuAction[];
};

export type AppMenuCallbacks = {
    about: () => void;
    createNewTab: () => void;
    openNewFile: () => void;
    openSettings: () => void;
    exit: () => void;
    reload: () => void;
    toggleFullscreen: () => void;
    documentation: () => void;
    clearSavedData: () => void;
    openLogs: () => void;
};

export type WindowPlatform = "win32" | "linux" | "other";

const menuEllipsis = String.fromCodePoint(0x2026);

export function menuWindowPlatform(vitePlatform: string): WindowPlatform {
    if (vitePlatform === "win32" || vitePlatform === "linux") return vitePlatform;
    return "other";
}

export function wantNativeDecorations(isNative: boolean, windowPlatform: WindowPlatform): boolean {
    return isNative || windowPlatform === "other";
}

export function installRealAppMenu(isNative: boolean, windowPlatform: WindowPlatform): boolean {
    return wantNativeDecorations(isNative, windowPlatform);
}

export function renderTopBar(isNative: boolean, windowPlatform: WindowPlatform): boolean {
    if (windowPlatform === "linux") return !isNative;
    if (windowPlatform === "win32") return !isNative;
    return false;
}

export function buildAppMenuTree(args: {
    t: MenuTranslator;
    isMacOS: boolean;
    newTabShortcut: string;
    openFileShortcut: string;
    callbacks: AppMenuCallbacks;
}): MenuGroup[] {
    const { t, isMacOS, newTabShortcut, openFileShortcut, callbacks } = args;

    const aboutOption: MenuItemAction = {
        label: t("Menu.Help.About"),
        id: "about",
        action: callbacks.about,
    };

    const appMenu: MenuGroup = {
        label: t("Menu.Application.Menu"),
        options: [
            {
                label: t("Menu.Application.About", {
                    defaultValue: t("Menu.Help.About"),
                }),
                id: aboutOption.id,
                action: aboutOption.action,
            },
            { kind: "separator" },
            {
                label: `${t("SideBar.Settings")}${menuEllipsis}`,
                id: "settings",
                shortcut: "cmd+,",
                action: callbacks.openSettings,
            },
            {
                label: t("Menu.Application.Hide"),
                item: "Hide",
            },
            { kind: "separator" },
            {
                label: t("Menu.Application.Quit", {
                    defaultValue: t("Menu.File.Exit"),
                }),
                item: "Quit",
            },
        ],
    };

    const macOSEditMenu: MenuGroup = {
        label: t("Menu.Edit"),
        options: [
            { label: t("Menu.Edit.Undo"), item: "Undo" },
            { label: t("Menu.Edit.Redo"), item: "Redo" },
            { kind: "separator" },
            { label: t("Menu.Edit.Copy"), item: "Copy" },
            { label: t("Menu.Edit.Cut"), item: "Cut" },
            { label: t("Menu.Edit.Paste"), item: "Paste" },
            { kind: "separator" },
            { label: t("Menu.Edit.SelectAll"), item: "SelectAll" },
        ],
    };

    return [
        ...(isMacOS ? [appMenu] : []),
        {
            label: t("Menu.File"),
            options: [
                {
                    label: t("Menu.File.NewTab"),
                    id: "new_tab",
                    shortcut: newTabShortcut,
                    action: callbacks.createNewTab,
                },
                {
                    label: t("Menu.File.OpenFile"),
                    id: "open_file",
                    shortcut: openFileShortcut,
                    action: callbacks.openNewFile,
                },
                ...(!isMacOS
                    ? [
                          {
                              label: t("Menu.File.Exit"),
                              id: "exit",
                              action: callbacks.exit,
                          },
                      ]
                    : []),
            ],
        },
        ...(!isMacOS ? [] : [macOSEditMenu]),
        {
            label: t("Menu.View"),
            options: [
                {
                    label: t("Menu.View.Reload"),
                    id: "reload",
                    shortcut: "Ctrl+R",
                    action: callbacks.reload,
                },
                {
                    label: t("Menu.View.Fullscreen"),
                    id: "toggle_fullscreen",
                    shortcut: isMacOS ? "Ctrl+Cmd+F" : "F11",
                    action: callbacks.toggleFullscreen,
                },
            ],
        },
        {
            label: t("Menu.Help"),
            options: [
                {
                    label: t("Menu.Help.Documentation"),
                    id: "documentation",
                    action: callbacks.documentation,
                },
                {
                    label: t("Menu.Help.ClearSavedData"),
                    id: "clear_saved_data",
                    action: callbacks.clearSavedData,
                },
                {
                    label: t("Menu.Help.OpenLogs"),
                    id: "logs",
                    action: callbacks.openLogs,
                },
                { kind: "separator" },
                ...(!isMacOS ? [aboutOption] : []),
            ],
        },
    ];
}

export async function openPgnFromMenu<File>(deps: {
    pickPgnFile: () => Promise<File | null>;
    navigate: (opts: { to: string }) => void | Promise<unknown>;
    openFile: (file: File) => void | Promise<unknown>;
}): Promise<void> {
    const selected = await deps.pickPgnFile();
    if (!selected) return;
    await deps.navigate({ to: "/" });
    await deps.openFile(selected);
}

export async function createNewTabFromMenu(deps: {
    navigate: (opts: { to: string }) => void | Promise<unknown>;
    createTab: () => void | Promise<unknown>;
}): Promise<void> {
    await deps.navigate({ to: "/" });
    await deps.createTab();
}

export async function openSettingsFromMenu(deps: {
    navigate: (opts: { to: string }) => void | Promise<unknown>;
}): Promise<void> {
    await deps.navigate({ to: "/settings" });
}

export async function clearSavedDataFromMenu(deps: {
    ask: (message: string, options: { title: string }) => Promise<boolean>;
    confirmMessage: string;
    title: string;
    clear: () => void;
}): Promise<void> {
    const confirmed = await deps.ask(deps.confirmMessage, { title: deps.title });
    if (confirmed) deps.clear();
}

export async function runNativeMenuAction(
    command: () => Promise<unknown>,
    notify: (error: unknown) => void,
    successMessage?: string,
    showSuccess?: (message: string) => void,
): Promise<void> {
    try {
        await command();
        if (successMessage && showSuccess) showSuccess(successMessage);
    } catch (error) {
        const visible = errorUnlessCancelled(error);
        if (visible) notify(error);
    }
}

export async function runWindowAction(
    op: () => Promise<unknown>,
    notify: (error: unknown) => void,
): Promise<void> {
    try {
        await op();
    } catch (error) {
        const visible = errorUnlessCancelled(error);
        if (visible) notify(error);
    }
}

export type MenuHandle = {
    setAsAppMenu: () => Promise<MenuHandle | null>;
    close: () => Promise<void>;
};

export type InstallAppMenuSurfaceArgs = {
    groups: MenuGroup[];
    wantRealMenu: boolean;
    wantDecorations: boolean;
    previousDecorationsApplied: boolean;
    isCurrent: () => boolean;
    createMenu: (groups: MenuGroup[]) => Promise<MenuHandle>;
    setDecorations: (on: boolean) => Promise<void>;
    closeMenu: (menu: MenuHandle) => Promise<void>;
    notify: (error: unknown) => void;
};

export type InstallAppMenuSurfaceResult = {
    decorationsApplied: boolean;
};

let installChain: Promise<void> = Promise.resolve();

export function resetInstallChainForTests(): void {
    installChain = Promise.resolve();
}

async function closeQuietly(
    closeMenu: (menu: MenuHandle) => Promise<void>,
    menu: MenuHandle | null | undefined,
): Promise<void> {
    if (!menu) return;
    try {
        await closeMenu(menu);
    } catch {
        // Closing a replaced menu is best-effort; a close failure must not
        // surface as the user's install error.
    }
}

async function installOnce(args: InstallAppMenuSurfaceArgs): Promise<InstallAppMenuSurfaceResult> {
    const previous = args.previousDecorationsApplied;
    let created: MenuHandle | undefined;
    try {
        if (!args.isCurrent()) return { decorationsApplied: previous };

        created = await args.createMenu(args.wantRealMenu ? args.groups : []);
        if (!args.isCurrent()) {
            await closeQuietly(args.closeMenu, created);
            return { decorationsApplied: previous };
        }

        let previousMenu: MenuHandle | null = null;
        try {
            previousMenu = await created.setAsAppMenu();
        } catch (error) {
            await closeQuietly(args.closeMenu, created);
            if (args.isCurrent()) args.notify(error);
            return { decorationsApplied: previous };
        }
        await closeQuietly(args.closeMenu, previousMenu);
        if (!args.isCurrent()) return { decorationsApplied: previous };

        try {
            await args.setDecorations(args.wantDecorations);
        } catch (error) {
            if (args.isCurrent()) args.notify(error);
            return { decorationsApplied: previous };
        }
        if (!args.isCurrent()) return { decorationsApplied: previous };

        return { decorationsApplied: args.wantDecorations };
    } catch (error) {
        await closeQuietly(args.closeMenu, created);
        if (args.isCurrent()) args.notify(error);
        return { decorationsApplied: previous };
    }
}

export async function installAppMenuSurface(
    args: InstallAppMenuSurfaceArgs,
): Promise<InstallAppMenuSurfaceResult> {
    let result: InstallAppMenuSurfaceResult = {
        decorationsApplied: args.previousDecorationsApplied,
    };
    const run = async () => {
        result = await installOnce(args);
    };
    const next = installChain.then(run, run);
    installChain = next.then(
        () => undefined,
        () => undefined,
    );
    await next;
    return result;
}

export function watchMaximized(options: {
    isMaximized: () => Promise<boolean>;
    onResized: (handler: () => void) => Promise<() => void> | (() => void);
    setMaximized: (value: boolean) => void;
    notify: (error: unknown) => void;
}): () => void {
    let stopped = false;
    let notified = false;
    let unlisten: (() => void) | undefined;

    const fail = (error: unknown) => {
        if (stopped) return;
        if (!notified) {
            notified = true;
            const visible = errorUnlessCancelled(error);
            if (visible) options.notify(error);
        }
        stopped = true;
        unlisten?.();
        unlisten = undefined;
    };

    const check = async () => {
        if (stopped) return;
        try {
            const maximized = await options.isMaximized();
            if (stopped) return;
            options.setMaximized(maximized);
        } catch (error) {
            fail(error);
        }
    };

    void check();
    void Promise.resolve(
        options.onResized(() => {
            void check();
        }),
    )
        .then((fn) => {
            if (stopped) {
                fn();
                return;
            }
            unlisten = fn;
        })
        .catch((error: unknown) => {
            fail(error);
        });

    return () => {
        stopped = true;
        unlisten?.();
        unlisten = undefined;
    };
}
