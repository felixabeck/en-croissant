import { Tabs } from "@mantine/core";
import type { DraggableProvidedDragHandleProps } from "@hello-pangea/dnd";
import { IconChess, IconDatabase, IconPuzzle, IconZoomCheck } from "@tabler/icons-react";
import cx from "clsx";
import type { Tab } from "@/utils/tabs";
import classes from "./BoardTab.module.css";
import { FileIcon } from "../files/FileIcon";
import { useTranslation } from "react-i18next";

export function BoardTab({
  tab,
  tabType,
  setActiveTab,
  selected,
  dragHandleProps,
}: {
  tab: Tab;
  tabType: string;
  setActiveTab: (v: string) => void;
  selected: boolean;
  dragHandleProps: DraggableProvidedDragHandleProps | null | undefined;
}) {
  const { t } = useTranslation();
  const { role: _dragRole, tabIndex: _dragTabIndex, ...tabDragHandleProps } = dragHandleProps ?? {};

  return (
    <div className={classes.tabItem} role="presentation">
      <Tabs.Tab
        {...tabDragHandleProps}
        value={tab.value}
        className={cx(classes.tab, { [classes.selected]: selected })}
        leftSection={<TabIcon tab={tab} tabType={tabType} />}
        onClick={() => setActiveTab(tab.value)}
      >
        <span className={classes.tabLabel}>{t(tab.name, { defaultValue: tab.name })}</span>
      </Tabs.Tab>
    </div>
  );
}

function TabIcon({ tab, tabType }: { tab: Tab; tabType: string }) {
  if (tabType === "puzzles") {
    return <IconPuzzle size="0.875rem" />;
  }
  if (tabType === "play") {
    return <IconChess size="0.875rem" />;
  }
  if (tab.gameOrigin.kind === "database") {
    return <IconDatabase size="0.875rem" />;
  }
  if (tab.gameOrigin.kind === "file" || tab.gameOrigin.kind === "temp_file") {
    return <FileIcon type={tab.gameOrigin.file.metadata.type} size="0.875rem" />;
  }
  if (tabType === "analysis") {
    return <IconZoomCheck size="0.875rem" />;
  }
  return null;
}
