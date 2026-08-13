import { tauri } from "@/platform/tauri";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import { Button, Group, Menu, ScrollArea, Tabs, TextInput } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { IconCopy, IconDots, IconEdit, IconPlus, IconX } from "@tabler/icons-react";
import { getDefaultStore, useAtom, useAtomValue, useSetAtom } from "jotai";
import { type ReactNode, startTransition, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Mosaic, type MosaicNode } from "react-mosaic-component";
import { match } from "ts-pattern";
import {
  activeTabAtom,
  closeWorkspaceTabAtom,
  gameIdFamily,
  gameSessionFamily,
  tabsAtom,
} from "@/state/atoms";
import { keyMapAtom } from "@/state/keybinds";
import { createTreeStore, type TreeStore } from "@/state/store/tree";
import { tabStorage } from "@/state/store/tabStorage";
import { createTab, genID, isPersistentGameOrigin, type Tab } from "@/utils/tabs";
import BoardAnalysis from "../boards/BoardAnalysis";
import BoardGame from "../boards/BoardGame";
import { abortExactTabGame } from "../boards/gameSession";
import { TreeStateProvider } from "../common/TreeStateContext";
import Puzzles from "../puzzles/Puzzles";
import { BoardTab } from "./BoardTab";
import { IconAction } from "../common/IconAction";
import AppModal from "../common/AppModal";
import ConfirmChangesModal from "./ConfirmChangesModal";
import NewTabHome from "./NewTabHome";

import "react-mosaic-component/react-mosaic-component.css";

import "@/styles/react-mosaic.css";
import { platform } from "@/platform/native";
import { atomWithStorage } from "jotai/utils";
import classes from "./BoardsPage.module.css";

export default function BoardsPage() {
  const { t } = useTranslation();

  const [tabs, setTabs] = useAtom(tabsAtom);
  const [activeTab, setActiveTab] = useAtom(activeTabAtom);
  const closeWorkspaceTab = useSetAtom(closeWorkspaceTabAtom);
  const [pendingClose, setPendingClose] = useState<{ tabId: string; store: TreeStore } | null>(
    null,
  );
  const [renameOpened, setRenameOpened] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const tabListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tabs.length === 0) {
      createTab({
        tab: { name: t("Tab.NewTab"), type: "new" },
        setTabs,
        setActiveTab,
      });
    }
  }, [tabs, setActiveTab, setTabs, t]);

  useEffect(() => {
    if (document.activeElement !== document.body || !activeTab) return;
    tabListRef.current
      ?.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')
      ?.focus();
  }, [activeTab, tabs.length]);

  const closeTab = useCallback(
    async (value: string | null, discard = false) => {
      if (value !== null) {
        const closedTab = tabs.find((tab) => tab.value === value);
        if (!closedTab) return;
        const store = createTreeStore(value);
        if (isPersistentGameOrigin(closedTab) && store.getState().dirty && !discard) {
          setPendingClose({ tabId: value, store });
          return;
        }
        store.dispose();
        await tauri.killEngines(value);
        await abortExactTabGame(
          value,
          (tabId) => getDefaultStore().get(gameIdFamily(tabId)),
          (tabId) => getDefaultStore().get(gameSessionFamily(tabId)),
          (gameId, expectedSession) => tauri.abortGame(gameId, expectedSession),
        );
        closeWorkspaceTab(value);
      }
    },
    [closeWorkspaceTab, tabs],
  );

  function selectTab(index: number) {
    setActiveTab(tabs[Math.min(index, tabs.length - 1)].value);
  }

  function cycleTabs(reverse = false) {
    const index = tabs.findIndex((tab) => tab.value === activeTab);
    if (reverse) {
      if (index === 0) {
        setActiveTab(tabs[tabs.length - 1].value);
      } else {
        setActiveTab(tabs[index - 1].value);
      }
    } else {
      if (index === tabs.length - 1) {
        setActiveTab(tabs[0].value);
      } else {
        setActiveTab(tabs[index + 1].value);
      }
    }
  }

  const duplicateTab = useCallback(
    (value: string) => {
      const tab = tabs.find((candidate) => candidate.value === value);
      if (!tab) return;
      const id = genID(tabs.map((candidate) => candidate.value));
      tabStorage.clone(value, id);
      setTabs((previous) => [...previous, { ...tab, value: id }]);
      startTransition(() => setActiveTab(id));
    },
    [setActiveTab, setTabs, tabs],
  );

  const openRename = () => {
    const tab = tabs.find((candidate) => candidate.value === activeTab);
    if (!tab) return;
    setRenameValue(t(tab.name, { defaultValue: tab.name }));
    setRenameOpened(true);
  };

  const saveRename = () => {
    if (!activeTab || !renameValue.trim()) return;
    setTabs((previous) =>
      previous.map((tab) => (tab.value === activeTab ? { ...tab, name: renameValue.trim() } : tab)),
    );
    setRenameOpened(false);
  };

  useEffect(() => {
    if (platform() !== "macos") return;

    const handler = (e: KeyboardEvent) => {
      if (e.metaKey && e.key.toLowerCase() === "w") {
        e.preventDefault();
        e.stopPropagation();
        closeTab(activeTab);
      }
    };

    window.addEventListener("keydown", handler, { capture: true });

    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [closeTab, activeTab]);

  const keyMap = useAtomValue(keyMapAtom);

  const handleSetActiveTab = useCallback(
    (v: string) => {
      startTransition(() => setActiveTab(v));
    },
    [setActiveTab],
  );
  useHotkeys([
    [keyMap.CLOSE_TAB.keys, () => closeTab(activeTab)],
    [keyMap.CYCLE_TABS.keys, () => cycleTabs()],
    [keyMap.REVERSE_CYCLE_TABS.keys, () => cycleTabs(true)],
    ["alt+1", () => selectTab(0)],
    ["ctrl+1", () => selectTab(0)],
    ["alt+2", () => selectTab(1)],
    ["ctrl+2", () => selectTab(1)],
    ["alt+3", () => selectTab(2)],
    ["ctrl+3", () => selectTab(2)],
    ["alt+4", () => selectTab(3)],
    ["ctrl+4", () => selectTab(3)],
    ["alt+5", () => selectTab(4)],
    ["ctrl+5", () => selectTab(4)],
    ["alt+6", () => selectTab(5)],
    ["ctrl+6", () => selectTab(5)],
    ["alt+7", () => selectTab(6)],
    ["ctrl+7", () => selectTab(6)],
    ["alt+8", () => selectTab(7)],
    ["ctrl+8", () => selectTab(7)],
    ["alt+9", () => selectTab(tabs.length - 1)],
    ["ctrl+9", () => selectTab(tabs.length - 1)],
  ]);

  return (
    <Tabs
      value={activeTab}
      onChange={(v) => setActiveTab(v)}
      keepMounted={false}
      className={classes.tabsContainer}
    >
      <div className={classes.tabsHeaderRow}>
        <ScrollArea scrollbarSize={6} className={classes.tabsHeader}>
          <DragDropContext
            onDragEnd={({ destination, source }) =>
              destination?.index !== undefined &&
              setTabs((prev) => {
                const result = Array.from(prev);
                const [removed] = result.splice(source.index, 1);
                result.splice(destination.index, 0, removed);
                return result;
              })
            }
          >
            <Droppable droppableId="droppable" direction="horizontal">
              {(provided) => (
                <Tabs.List
                  ref={(node) => {
                    provided.innerRef(node);
                    tabListRef.current = node;
                  }}
                  {...provided.droppableProps}
                  className={classes.tabList}
                >
                  {tabs.map((tab, i) => (
                    <Draggable key={tab.value} draggableId={tab.value} index={i}>
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          role="presentation"
                        >
                          <BoardTab
                            tab={tab}
                            tabType={tab.type}
                            setActiveTab={handleSetActiveTab}
                            selected={activeTab === tab.value}
                            dragHandleProps={provided.dragHandleProps}
                          />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                  <div className={classes.tabsFiller} role="presentation" />
                </Tabs.List>
              )}
            </Droppable>
          </DragDropContext>
        </ScrollArea>
        <Menu shadow="md" width={200}>
          <Menu.Target>
            <IconAction
              label={t("Tab.Actions", { defaultValue: "Tab actions" })}
              variant="default"
              radius={0}
              disabled={!activeTab}
              classNames={{ root: classes.newTab }}
            >
              <IconDots />
            </IconAction>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              leftSection={<IconCopy size="0.875rem" />}
              onClick={() => activeTab && duplicateTab(activeTab)}
            >
              {t("Tab.Duplicate", { defaultValue: "Duplicate tab" })}
            </Menu.Item>
            <Menu.Item leftSection={<IconEdit size="0.875rem" />} onClick={openRename}>
              {t("Tab.Rename", { defaultValue: "Rename tab" })}
            </Menu.Item>
            <Menu.Item
              color="red"
              leftSection={<IconX size="0.875rem" />}
              onClick={() => void closeTab(activeTab)}
            >
              {t("Tab.Close", { defaultValue: "Close tab" })}
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
        <IconAction
          label={t("Tab.NewTab", { defaultValue: "New tab" })}
          variant="default"
          radius={0}
          onClick={() =>
            createTab({
              tab: { name: t("Tab.NewTab"), type: "new" },
              setTabs,
              setActiveTab,
            })
          }
          classNames={{ root: classes.newTab }}
        >
          <IconPlus />
        </IconAction>
        <IconAction
          label={t("Tab.Close", { defaultValue: "Close tab" })}
          variant="default"
          radius={0}
          disabled={!activeTab}
          onClick={() => void closeTab(activeTab)}
          classNames={{ root: classes.newTab }}
        >
          <IconX />
        </IconAction>
      </div>
      <AppModal
        opened={renameOpened}
        onClose={() => setRenameOpened(false)}
        title={t("Tab.Rename", { defaultValue: "Rename tab" })}
      >
        <TextInput
          autoFocus
          label={t("Tab.Rename", { defaultValue: "Rename tab" })}
          value={renameValue}
          onChange={(event) => setRenameValue(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") saveRename();
          }}
        />
        <Group justify="end" mt="md">
          <Button variant="default" onClick={() => setRenameOpened(false)}>
            {t("Common.Cancel")}
          </Button>
          <Button onClick={saveRename}>{t("Common.Save")}</Button>
        </Group>
      </AppModal>
      {tabs.map((tab) => (
        <Tabs.Panel key={tab.value} value={tab.value} h="100%" w="100%" pb="sm" px="xs">
          <TabSwitch tab={tab} />
        </Tabs.Panel>
      ))}
      <ConfirmChangesModal
        pendingClose={pendingClose}
        tab={tabs.find((tab) => tab.value === pendingClose?.tabId)}
        updateTab={(tabId, update) =>
          setTabs((previous) =>
            previous.map((tab) =>
              tab.value === tabId ? (typeof update === "function" ? update(tab) : update) : tab,
            ),
          )
        }
        onCancel={() => {
          pendingClose?.store.dispose();
          setPendingClose(null);
        }}
        onDiscard={() => {
          const tabId = pendingClose?.tabId;
          pendingClose?.store.dispose();
          setPendingClose(null);
          if (tabId) void closeTab(tabId, true);
        }}
        onSaved={() => {
          const tabId = pendingClose?.tabId;
          pendingClose?.store.dispose();
          setPendingClose(null);
          if (tabId) void closeTab(tabId, true);
        }}
      />
    </Tabs>
  );
}

type ViewId = "left" | "topRight" | "bottomRight";

const fullLayout: { [viewId: string]: ReactNode } = {
  left: <div id="left" />,
  topRight: <div id="topRight" />,
  bottomRight: <div id="bottomRight" />,
};

interface WindowsState {
  currentNode: MosaicNode<ViewId> | null;
}

const windowsStateAtom = atomWithStorage<WindowsState>("windowsState", {
  currentNode: {
    direction: "row",
    first: "left",
    second: {
      direction: "column",
      first: "topRight",
      second: "bottomRight",
    },
  },
});

function TabSwitch({ tab }: { tab: Tab }) {
  const [windowsState, setWindowsState] = useAtom(windowsStateAtom);

  return match(tab.type)
    .with("new", () => <NewTabHome id={tab.value} />)
    .with("play", () => (
      <TreeStateProvider id={tab.value}>
        <Mosaic<ViewId>
          renderTile={(id) => fullLayout[id]}
          value={windowsState.currentNode}
          onChange={(currentNode) => setWindowsState({ currentNode })}
          resize={{ minimumPaneSizePercentage: 0 }}
        />
        <BoardGame />
      </TreeStateProvider>
    ))
    .with("analysis", () => (
      <TreeStateProvider id={tab.value}>
        <Mosaic<ViewId>
          renderTile={(id) => fullLayout[id]}
          value={windowsState.currentNode}
          onChange={(currentNode) => setWindowsState({ currentNode })}
          resize={{ minimumPaneSizePercentage: 0 }}
        />
        <BoardAnalysis />
      </TreeStateProvider>
    ))
    .with("puzzles", () => (
      <TreeStateProvider id={tab.value}>
        <Mosaic<ViewId>
          renderTile={(id) => fullLayout[id]}
          value={windowsState.currentNode}
          onChange={(currentNode) => setWindowsState({ currentNode })}
          resize={{ minimumPaneSizePercentage: 0 }}
        />
        <Puzzles id={tab.value} />
      </TreeStateProvider>
    ))
    .exhaustive();
}
