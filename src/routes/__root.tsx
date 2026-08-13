import { AppShell } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { createRootRouteWithContext, Outlet, useNavigate } from "@tanstack/react-router";
import { ask, Menu, MenuItem, PredefinedMenuItem, Submenu } from "@/platform/native";
import { getCurrentWindow } from "@/platform/native";
import { platform } from "@/platform/native";
import { exit } from "@/platform/native";
import { tauri } from "@/platform/tauri";
import { checkForUpdates as checkForUpdatesService } from "@/platform/updater";
import { useAtom, useAtomValue } from "jotai";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useTranslation } from "react-i18next";
import useSWRImmutable from "swr/immutable";
import AboutModal from "@/components/About";
import { SideBar } from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import { activeTabAtom, nativeBarAtom, tabsAtom } from "@/state/atoms";
import { keyMapAtom } from "@/state/keybinds";
import { openFile, pickPgnFile } from "@/utils/files";
import { createTab } from "@/utils/tabs";

type MenuGroup = {
  label: string;
  options: MenuAction[];
};

type MenuItemAction = {
  id?: string;
  label: string;
  shortcut?: string;
  action?: () => void;
  item?: "Hide" | "Copy" | "Cut" | "Paste" | "SelectAll" | "Undo" | "Redo" | "Quit";
};

type MenuAction = MenuItemAction | { kind: "separator" };
const menuEllipsis = String.fromCodePoint(0x2026);

async function createMenu(menuActions: MenuGroup[]) {
  const items = await Promise.all(
    menuActions.map(async (group) => {
      const submenuItems = await Promise.all(
        group.options.map(async (option) => {
          if ("kind" in option) return PredefinedMenuItem.new({ item: "Separator" });
          if (option.item) return PredefinedMenuItem.new({ text: option.label, item: option.item });
          return MenuItem.new({
            id: option.id,
            text: option.label,
            accelerator: option.shortcut,
            action: option.action,
          });
        }),
      );

      return Submenu.new({
        text: group.label,
        items: submenuItems,
      });
    }),
  );

  return Menu.new({
    items: items,
  });
}

export const Route = createRootRouteWithContext<Record<string, never>>()({
  component: RootLayout,
});

function RootLayout() {
  const isNative = useAtomValue(nativeBarAtom);
  const navigate = useNavigate();

  const [, setTabs] = useAtom(tabsAtom);
  const [, setActiveTab] = useAtom(activeTabAtom);

  const { t } = useTranslation();

  const openNewFile = useCallback(async () => {
    const selected = await pickPgnFile();
    if (selected) {
      navigate({ to: "/" });
      openFile(selected, setTabs, setActiveTab);
    }
  }, [navigate, setActiveTab, setTabs]);

  const createNewTab = useCallback(() => {
    navigate({ to: "/" });
    createTab({
      tab: { name: t("Tab.NewTab"), type: "new" },
      setTabs,
      setActiveTab,
    });
  }, [navigate, setActiveTab, setTabs, t]);

  const checkForUpdates = useCallback(async () => {
    await checkForUpdatesService({
      interactive: true,
      onError: (error) =>
        notifications.show({
          color: "red",
          message: error.message,
        }),
    });
  }, []);

  const runNativeMenuAction = useCallback(
    async (command: () => Promise<unknown>, successMessage?: string) => {
      try {
        await command();
        if (successMessage) {
          notifications.show({ message: successMessage });
        }
      } catch (error) {
        notifications.show({
          color: "red",
          title: t("Common.Error"),
          message: error instanceof Error ? error.message : t("Common.Error"),
        });
      }
    },
    [t],
  );

  const openSettings = useCallback(async () => {
    navigate({ to: "/settings" });
  }, [navigate]);

  const toggleFullscreen = useCallback(async () => {
    const currentWindow = getCurrentWindow();
    const isFullscreen = await currentWindow.isFullscreen();
    await currentWindow.setFullscreen(!isFullscreen);
  }, []);

  const [keyMap] = useAtom(keyMapAtom);

  useHotkeys(keyMap.NEW_TAB.keys, createNewTab);
  useHotkeys(keyMap.OPEN_FILE.keys, openNewFile);
  const [opened, setOpened] = useState(false);

  const isMacOS = platform() === "macos";

  const aboutOption = useMemo(
    () => ({
      label: t("Menu.Help.About"),
      id: "about",
      action: () => setOpened(true),
    }),
    [t],
  );

  const checkForUpdatesOption = useMemo(
    () => ({
      label: t("Menu.Help.CheckUpdate"),
      id: "check_for_updates",
      action: checkForUpdates,
    }),
    [checkForUpdates, t],
  );

  const appMenu = useMemo<MenuGroup>(
    () => ({
      label: t("Menu.Application.Menu"),
      options: [
        {
          label: t("Menu.Application.About", {
            defaultValue: t("Menu.Help.About"),
          }),
          id: aboutOption.id,
          action: aboutOption.action,
        },
        checkForUpdatesOption,
        { kind: "separator" },
        {
          label: `${t("SideBar.Settings")}${menuEllipsis}`,
          id: "settings",
          shortcut: "cmd+,",
          action: openSettings,
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
    }),
    [aboutOption, checkForUpdatesOption, openSettings, t],
  );

  const macOSEditMenu = useMemo<MenuGroup>(
    () => ({
      label: t("Menu.Edit"),
      options: [
        {
          label: t("Menu.Edit.Undo"),
          item: "Undo",
        },
        {
          label: t("Menu.Edit.Redo"),
          item: "Redo",
        },
        { kind: "separator" },
        {
          label: t("Menu.Edit.Copy"),
          item: "Copy",
        },
        {
          label: t("Menu.Edit.Cut"),
          item: "Cut",
        },
        {
          label: t("Menu.Edit.Paste"),
          item: "Paste",
        },
        { kind: "separator" },
        {
          label: t("Menu.Edit.SelectAll"),
          item: "SelectAll",
        },
      ],
    }),
    [t],
  );

  const menuActions: MenuGroup[] = useMemo(
    () => [
      ...(isMacOS ? [appMenu] : []),
      {
        label: t("Menu.File"),
        options: [
          {
            label: t("Menu.File.NewTab"),
            id: "new_tab",
            shortcut: keyMap.NEW_TAB.keys,
            action: createNewTab,
          },
          {
            label: t("Menu.File.OpenFile"),
            id: "open_file",
            shortcut: keyMap.OPEN_FILE.keys,
            action: openNewFile,
          },
          ...(!isMacOS
            ? [
                {
                  label: t("Menu.File.Exit"),
                  id: "exit",
                  action: () => exit(0),
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
            action: () => location.reload(),
          },
          {
            label: t("Menu.View.Fullscreen"),
            id: "toggle_fullscreen",
            shortcut: isMacOS ? "Ctrl+Cmd+F" : "F11",
            action: toggleFullscreen,
          },
        ],
      },
      {
        label: t("Menu.Help"),
        options: [
          {
            label: t("Menu.Help.Documentation"),
            id: "documentation",
            action: () => void runNativeMenuAction(() => tauri.openDocumentation()),
          },
          {
            label: t("Menu.Help.ClearSavedData"),
            id: "clear_saved_data",
            action: () => {
              ask(t("Menu.Help.ClearSavedData.Confirm"), {
                title: t("Menu.Help.ClearSavedData.Title"),
              }).then((res) => {
                if (res) {
                  localStorage.clear();
                  sessionStorage.clear();
                  location.reload();
                }
              });
            },
          },
          {
            label: t("Menu.Help.OpenLogs"),
            id: "logs",
            action: () =>
              void runNativeMenuAction(() => tauri.openAppLog(), t("Menu.Help.OpenLogs")),
          },
          { kind: "separator" },
          ...(!isMacOS ? [checkForUpdatesOption, aboutOption] : []),
        ],
      },
    ],
    [
      aboutOption,
      appMenu,
      checkForUpdatesOption,
      createNewTab,
      isMacOS,
      keyMap,
      macOSEditMenu,
      openNewFile,
      runNativeMenuAction,
      t,
      toggleFullscreen,
    ],
  );

  const { data: menu } = useSWRImmutable(["menu", menuActions], () => createMenu(menuActions));

  useEffect(() => {
    if (!menu) return;
    if (
      isNative ||
      (import.meta.env.VITE_PLATFORM !== "win32" && import.meta.env.VITE_PLATFORM !== "linux")
    ) {
      menu.setAsAppMenu();
      getCurrentWindow().setDecorations(true);
    } else {
      Menu.new().then((m) => m.setAsAppMenu());
      getCurrentWindow().setDecorations(false);
    }
  }, [menu, isNative]);

  return (
    <AppShell
      navbar={{
        width: "3rem",
        breakpoint: 0,
      }}
      header={
        isNative ||
        (import.meta.env.VITE_PLATFORM !== "win32" && import.meta.env.VITE_PLATFORM !== "linux")
          ? undefined
          : {
              height: "2.25rem",
            }
      }
      styles={{
        main: {
          height: "100vh",
          userSelect: "none",
        },
      }}
    >
      <AboutModal opened={opened} setOpened={setOpened} />
      {!isNative &&
        (import.meta.env.VITE_PLATFORM === "win32" ||
          import.meta.env.VITE_PLATFORM === "linux") && (
          <AppShell.Header>
            <TopBar menuActions={menuActions} />
          </AppShell.Header>
        )}
      <AppShell.Navbar>
        <SideBar />
      </AppShell.Navbar>
      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
