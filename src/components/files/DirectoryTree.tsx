import { Badge, Box, Group, Text } from "@mantine/core";
import { IconFileDescription, IconFolder, IconFolderOpen, IconTrash } from "@tabler/icons-react";
import { useAtom, useSetAtom } from "jotai";
import { type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { IconAction } from "@/components/common/IconAction";
import { activeTabAtom, expandedDirectoriesAtom, tabsAtom } from "@/state/atoms";
import { openFile } from "@/utils/files";
import { fileWorkspaceKey } from "@/utils/pathCapabilities";
import type { Entry, FileMetadata } from "./file";

export const DragContext = null as never;

type VisibleEntry = { entry: Entry; depth: number };

function filteredTree(files: Entry[], search: string, filter: string): Entry[] {
  const normalizedSearch = search.trim().toLowerCase();
  const visit = (nodes: Entry[]): Entry[] =>
    nodes.reduce<Entry[]>((result, node) => {
      if (node.type === "file") {
        const matchesType = !filter || node.metadata.type === filter;
        const matchesSearch =
          !normalizedSearch || node.name.toLowerCase().includes(normalizedSearch);
        if (matchesType && matchesSearch) result.push(node);
        return result;
      }
      const children = visit(node.children);
      const matchesSearch = !normalizedSearch || node.name.toLowerCase().includes(normalizedSearch);
      if (matchesSearch || children.length) result.push({ ...node, children });
      return result;
    }, []);
  return visit(files);
}
export default function DirectoryTree({
  files,
  selectedFile,
  setSelectedFile,
  onRequestDelete,
  onMove,
  onRequestMove,
  search,
  filter,
}: {
  files: Entry[];
  refreshDirectory: () => Promise<unknown>;
  selectedFile: Entry | null;
  setSelectedFile: (file: Entry | null) => void;
  onRequestDelete: (file: Entry) => void | Promise<void>;
  onMove?: (entry: Entry, destination: Entry) => void | Promise<void>;
  onRequestMove?: (entry: Entry) => void;
  search: string;
  filter: string;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useAtom(expandedDirectoriesAtom);
  const [, setTabs] = useAtom(tabsAtom);
  const setActive = useSetAtom(activeTabAtom);
  const navigate = useNavigate();
  const refs = useRef(new Map<string, HTMLDivElement>());
  const [focusedHandle, setFocusedHandle] = useState<string | null>(null);
  const filtered = useMemo(() => filteredTree(files, search, filter), [files, filter, search]);
  const visible = useMemo(() => {
    const result: VisibleEntry[] = [];
    const visit = (nodes: Entry[], depth: number) =>
      nodes.forEach((node) => {
        result.push({ entry: node, depth });
        if (node.type === "directory" && expanded.includes(fileWorkspaceKey(node.handle)))
          visit(node.children, depth + 1);
      });
    visit(filtered, 0);
    return result;
  }, [expanded, filtered]);
  useEffect(() => {
    if (!focusedHandle) return;
    if (!visible.some((item) => fileWorkspaceKey(item.entry.handle) === focusedHandle)) {
      setFocusedHandle(null);
      return;
    }
    refs.current.get(focusedHandle)?.focus();
  }, [focusedHandle, visible]);
  const focusEntry = (entry: VisibleEntry) => {
    const handle = fileWorkspaceKey(entry.entry.handle);
    setFocusedHandle(handle);
    refs.current.get(handle)?.focus();
  };
  const openEntry = (entry: FileMetadata) => {
    void openFile(entry, setTabs, setActive).then(() => navigate({ to: "/" }));
  };
  const render = ({ entry: node, depth }: VisibleEntry): React.ReactNode => {
    const isDirectory = node.type === "directory";
    const handleKey = fileWorkspaceKey(node.handle);
    const open = expanded.includes(handleKey);
    return (
      <Box
        key={handleKey}
        role="treeitem"
        aria-label={node.name}
        aria-level={depth + 1}
        aria-selected={selectedFile ? fileWorkspaceKey(selectedFile.handle) === handleKey : false}
        aria-expanded={isDirectory ? open : undefined}
        tabIndex={
          focusedHandle === null
            ? visible[0] && fileWorkspaceKey(visible[0].entry.handle) === handleKey
              ? 0
              : -1
            : focusedHandle === handleKey
              ? 0
              : -1
        }
        ref={(element) => {
          if (element) refs.current.set(handleKey, element);
          else refs.current.delete(handleKey);
        }}
        pl={depth * 16}
        onFocus={(event) => {
          if (event.currentTarget === event.target) setFocusedHandle(handleKey);
        }}
        onKeyDown={(event) => {
          if (event.currentTarget !== event.target) return;
          event.stopPropagation();
          const index = visible.findIndex(
            (item) => fileWorkspaceKey(item.entry.handle) === handleKey,
          );
          const target =
            event.key === "ArrowDown"
              ? visible[index + 1]
              : event.key === "ArrowUp"
                ? visible[index - 1]
                : event.key === "Home"
                  ? visible[0]
                  : event.key === "End"
                    ? visible.at(-1)
                    : event.key === "ArrowRight" && isDirectory && open
                      ? visible[index + 1]?.depth === depth + 1
                        ? visible[index + 1]
                        : undefined
                      : event.key === "ArrowLeft" && !open
                        ? [...visible.slice(0, index)].reverse().find((item) => item.depth < depth)
                        : undefined;
          if (target) {
            event.preventDefault();
            focusEntry(target);
          }
          if (event.key === "ArrowRight" && isDirectory && !open) {
            event.preventDefault();
            setExpanded((old) => [...old, handleKey]);
          }
          if (event.key === "ArrowLeft" && isDirectory && open) {
            event.preventDefault();
            setExpanded((old) => old.filter((id) => id !== handleKey));
          }
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setSelectedFile(node);
            if (isDirectory)
              setExpanded((old) =>
                open ? old.filter((id) => id !== handleKey) : [...old, handleKey],
              );
            else if (event.key === "Enter") openEntry(node);
          }
          if (event.key.toLowerCase() === "m") {
            event.preventDefault();
            onRequestMove?.(node);
          }
        }}
        onClick={() => {
          setSelectedFile(node);
          if (isDirectory)
            setExpanded((old) =>
              open ? old.filter((id) => id !== handleKey) : [...old, handleKey],
            );
        }}
        onDoubleClick={() => {
          if (!isDirectory) openEntry(node);
        }}
        draggable
        onDragStart={(event) =>
          event.dataTransfer.setData("application/x-en-croissant-handle", handleKey)
        }
        onDragOver={(event) => {
          if (isDirectory) event.preventDefault();
        }}
        onDrop={(event) => {
          event.preventDefault();
          if (!isDirectory || !onMove) return;
          const source = visible.find(
            (item) =>
              fileWorkspaceKey(item.entry.handle) ===
              event.dataTransfer.getData("application/x-en-croissant-handle"),
          )?.entry;
          if (source && source.handle !== node.handle) void onMove(source, node);
        }}
      >
        <Group gap="xs" py={4} style={{ cursor: "pointer" }}>
          <>
            {isDirectory ? (
              open ? (
                <IconFolderOpen size={16} />
              ) : (
                <IconFolder size={16} />
              )
            ) : (
              <IconFileDescription size={16} />
            )}
          </>
          <Text size="sm">{node.name}</Text>
          {!isDirectory && <Badge size="xs">{node.numGames}</Badge>}
          <IconAction
            label={t("Common.Delete")}
            color="red"
            variant="subtle"
            size="sm"
            onClick={(event: MouseEvent<HTMLButtonElement>) => {
              event.stopPropagation();
              void onRequestDelete(node);
            }}
          >
            <IconTrash size={16} aria-hidden />
          </IconAction>
          <IconAction
            label={t("Files.Move")}
            variant="subtle"
            size="sm"
            onClick={(event: MouseEvent<HTMLButtonElement>) => {
              event.stopPropagation();
              onRequestMove?.(node);
            }}
          >
            {t("Files.Move")}
          </IconAction>
        </Group>
      </Box>
    );
  };
  return (
    <Box role="tree" aria-label={t("Files.Title")}>
      {visible.map(render)}
    </Box>
  );
}
