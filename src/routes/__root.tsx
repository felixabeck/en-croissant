import { AppShell } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { createRootRouteWithContext, Outlet, useNavigate } from "@tanstack/react-router";
import { ask, Menu, MenuItem, PredefinedMenuItem, Submenu } from "@/platform/native";
import { getCurrentWindow } from "@/platform/native";
import { platform } from "@/platform/native";
import { exit } from "@/platform/native";
import { tauri } from "@/platform/tauri";
import { useAtom, useAtomValue } from "jotai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useTranslation } from "react-i18next";
import AboutModal from "@/components/About";
import { notifyUnlessCancelled } from "@/components/files/notifyError";
import { SideBar } from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import { activeTabAtom, nativeBarAtom, tabsAtom } from "@/state/atoms";
import { keyMapAtom } from "@/state/keybinds";
import { openFile, pickPgnFile } from "@/utils/files";
import { createTab } from "@/utils/tabs";
import {
  assembleNativeMenuResources,
  bindAppMenuCallbacks,
  buildAppMenuTree,
  clearSavedDataFromMenu,
  createNewTabFromMenu,
  installAppMenuSurface,
  menuWindowPlatform,
  openPgnFromMenu,
  openSettingsFromMenu,
  renderTopBar,
  runNativeMenuAction,
  wantNativeDecorations,
  type AppMenuCallbacks,
  type MenuGroup,
  type MenuHandle,
  type NativeMenuResource,
} from "./-appMenu";

async function createMenu(menuActions: MenuGroup[]): Promise<MenuHandle> {
  const menu = await assembleNativeMenuResources<NativeMenuResource>(menuActions, {
    separator: () => PredefinedMenuItem.new({ item: "Separator" }),
    predefined: (option) =>
      PredefinedMenuItem.new({
        text: option.label,
        item: option.item,
      }),
    submenu: (label, items) =>
      Submenu.new({
        text: label,
        items: items as never,
      }),
    item: (option) =>
      MenuItem.new({
        id: option.id,
        text: option.label,
        accelerator: option.shortcut,
        action: option.action,
      }),
    menu: (items) => Menu.new({ items: items as never }),
  });
  return menu as unknown as MenuHandle;
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
  const windowPlatform = menuWindowPlatform(String(import.meta.env.VITE_PLATFORM));
  const decorationsAppliedRef = useRef(false);
  const [decorationsApplied, setDecorationsApplied] = useState(false);
  const installGeneration = useRef(0);

  const notifyMenuError = useCallback(
    (error: unknown) => {
      notifyUnlessCancelled(t("Common.Error"), error);
    },
    [t],
  );

  const runMenu = useCallback(
    (command: () => Promise<unknown>, successMessage?: string) =>
      runNativeMenuAction(command, notifyMenuError, successMessage, (message) => {
        notifications.show({ message });
      }),
    [notifyMenuError],
  );

  const openNewFile = useCallback(
    () =>
      openPgnFromMenu({
        pickPgnFile,
        navigate,
        openFile: (file) => openFile(file, setTabs, setActiveTab),
      }),
    [navigate, setActiveTab, setTabs],
  );

  const createNewTab = useCallback(
    () =>
      createNewTabFromMenu({
        navigate,
        createTab: () =>
          createTab({
            tab: { name: t("Tab.NewTab"), type: "new" },
            setTabs,
            setActiveTab,
          }),
      }),
    [navigate, setActiveTab, setTabs, t],
  );

  const openSettings = useCallback(() => openSettingsFromMenu({ navigate }), [navigate]);

  const toggleFullscreen = useCallback(async () => {
    const currentWindow = getCurrentWindow();
    const isFullscreen = await currentWindow.isFullscreen();
    await currentWindow.setFullscreen(!isFullscreen);
  }, []);

  const [keyMap] = useAtom(keyMapAtom);
  const [opened, setOpened] = useState(false);
  const isMacOS = platform() === "macos";

  const menuCallbacks: AppMenuCallbacks = useMemo(
    () =>
      bindAppMenuCallbacks({
        runMenu,
        about: () => setOpened(true),
        createNewTab,
        openNewFile,
        openSettings,
        exit: () => exit(0),
        reload: () => location.reload(),
        toggleFullscreen,
        documentation: () => tauri.openDocumentation(),
        clearSavedData: () =>
          clearSavedDataFromMenu({
            ask,
            confirmMessage: t("Menu.Help.ClearSavedData.Confirm"),
            title: t("Menu.Help.ClearSavedData.Title"),
            clear: () => {
              localStorage.clear();
              sessionStorage.clear();
              location.reload();
            },
          }),
        openLogs: () => tauri.openAppLog(),
        openLogsSuccessMessage: t("Menu.Help.OpenLogs"),
      }),
    [createNewTab, openNewFile, openSettings, runMenu, t, toggleFullscreen],
  );

  useHotkeys(keyMap.NEW_TAB.keys, () => {
    void menuCallbacks.createNewTab();
  });
  useHotkeys(keyMap.OPEN_FILE.keys, () => {
    void menuCallbacks.openNewFile();
  });

  const menuActions = useMemo(
    () =>
      buildAppMenuTree({
        t,
        isMacOS,
        newTabShortcut: keyMap.NEW_TAB.keys,
        openFileShortcut: keyMap.OPEN_FILE.keys,
        callbacks: menuCallbacks,
      }),
    [isMacOS, keyMap.NEW_TAB.keys, keyMap.OPEN_FILE.keys, menuCallbacks, t],
  );

  const showTopBar = renderTopBar(isNative, windowPlatform);
  const showWindowControls = showTopBar && !decorationsApplied;

  useEffect(() => {
    const myGen = ++installGeneration.current;
    void installAppMenuSurface({
      groups: menuActions,
      wantRealMenu: wantNativeDecorations(isNative, windowPlatform),
      wantDecorations: wantNativeDecorations(isNative, windowPlatform),
      previousDecorationsApplied: decorationsAppliedRef.current,
      isCurrent: () => installGeneration.current === myGen,
      createMenu,
      setDecorations: (on) => getCurrentWindow().setDecorations(on),
      closeMenu: async (menu) => {
        if (typeof menu.close === "function") await menu.close();
      },
      notify: notifyMenuError,
    }).then((result) => {
      if (installGeneration.current !== myGen) return;
      decorationsAppliedRef.current = result.decorationsApplied;
      setDecorationsApplied(result.decorationsApplied);
    });
    return () => {
      installGeneration.current += 1;
    };
  }, [isNative, menuActions, notifyMenuError, windowPlatform]);

  return (
    <AppShell
      navbar={{
        width: "3rem",
        breakpoint: 0,
      }}
      header={
        showTopBar
          ? {
              height: "2.25rem",
            }
          : undefined
      }
      styles={{
        main: {
          height: "100vh",
          userSelect: "none",
        },
      }}
    >
      <AboutModal opened={opened} setOpened={setOpened} />
      {showTopBar && (
        <AppShell.Header>
          <TopBar menuActions={menuActions} showWindowControls={showWindowControls} />
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
