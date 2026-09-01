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
  buildAppMenuTree,
  clearSavedDataFromMenu,
  createNewTabFromMenu,
  installAppMenuSurface,
  installRealAppMenu,
  menuWindowPlatform,
  openPgnFromMenu,
  openSettingsFromMenu,
  renderTopBar,
  runNativeMenuAction,
  wantNativeDecorations,
  type AppMenuCallbacks,
  type MenuGroup,
  type MenuHandle,
} from "./-appMenu";

type Closable = { close: () => Promise<void> };

async function createMenu(menuActions: MenuGroup[]): Promise<MenuHandle> {
  const created: Closable[] = [];
  try {
    const items = await Promise.all(
      menuActions.map(async (group) => {
        const submenuItems = await Promise.all(
          group.options.map(async (option) => {
            if ("kind" in option) {
              const separator = await PredefinedMenuItem.new({ item: "Separator" });
              created.push(separator);
              return separator;
            }
            if (option.item) {
              const predefined = await PredefinedMenuItem.new({
                text: option.label,
                item: option.item,
              });
              created.push(predefined);
              return predefined;
            }
            const item = await MenuItem.new({
              id: option.id,
              text: option.label,
              accelerator: option.shortcut,
              action: option.action,
            });
            created.push(item);
            return item;
          }),
        );

        const submenu = await Submenu.new({
          text: group.label,
          items: submenuItems,
        });
        created.push(submenu);
        return submenu;
      }),
    );

    return (await Menu.new({
      items: items,
    })) as unknown as MenuHandle;
  } catch (error) {
    for (const resource of created) {
      try {
        await resource.close();
      } catch {
        // Partial construction: close whatever already exists.
      }
    }
    throw error;
  }
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
      ({
        about: () => setOpened(true),
        createNewTab: () => {
          void runMenu(createNewTab);
        },
        openNewFile: () => {
          void runMenu(openNewFile);
        },
        openSettings: () => {
          void runMenu(openSettings);
        },
        exit: () => {
          void runMenu(async () => {
            await exit(0);
          });
        },
        reload: () => location.reload(),
        toggleFullscreen: () => {
          void runMenu(toggleFullscreen);
        },
        documentation: () => {
          void runMenu(() => tauri.openDocumentation());
        },
        clearSavedData: () => {
          void runMenu(() =>
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
          );
        },
        openLogs: () => {
          void runMenu(() => tauri.openAppLog(), t("Menu.Help.OpenLogs"));
        },
      }) satisfies AppMenuCallbacks,
    [createNewTab, openNewFile, openSettings, runMenu, t, toggleFullscreen],
  );

  useHotkeys(keyMap.NEW_TAB.keys, () => {
    void runMenu(createNewTab);
  });
  useHotkeys(keyMap.OPEN_FILE.keys, () => {
    void runMenu(openNewFile);
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
      wantRealMenu: installRealAppMenu(isNative, windowPlatform),
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
