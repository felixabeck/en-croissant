import { tauri } from "@/platform/tauri";
import { runAppliedMutationWithRefresh, runDestructiveWithRefresh } from "@/platform/errors";
import { runUnlessCancelled } from "@/components/files/notifyError";
import {
  Button,
  Center,
  Chip,
  Group,
  Input,
  Paper,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import { useAtom } from "jotai";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import useSWR from "swr";
import { useNativeRequestOwner } from "@/hooks/useNativeRequestOwner";
import { fileWorkspaceAtom, fileWorkspaceDisplayNameAtom } from "@/state/atoms";
import { fileWorkspaceKey } from "@/utils/pathCapabilities";
import DirectoryTree from "./DirectoryTree";
import FileCard from "./FileCard";
import ConfirmModal from "../common/ConfirmModal";
import AppModal from "../common/AppModal";
import type { Entry, FileType } from "./file";
import { workspaceEntryToEntry } from "./file";

const fileAction = { file: "file", folder: "folder", rename: "rename" } as const;
type FileAction = (typeof fileAction)[keyof typeof fileAction];
const fileTypes: FileType[] = ["game", "repertoire", "tournament", "puzzle", "other"];

function findEntry(entries: Entry[], key: string): Entry | null {
  for (const entry of entries) {
    if (fileWorkspaceKey(entry.handle) === key) return entry;
    if (entry.type === "directory") {
      const child = findEntry(entry.children, key);
      if (child) return child;
    }
  }
  return null;
}

export default function FilesPage() {
  const { t } = useTranslation();
  const [workspace, setWorkspace] = useAtom(fileWorkspaceAtom);
  const [, setWorkspaceDisplayName] = useAtom(fileWorkspaceDisplayNameAtom);
  const [selectedEntry, setSelected] = useState<Entry | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FileType | "">("");
  const [action, setAction] = useState<FileAction | null>(null);
  const [name, setName] = useState("");
  const [actionError, setActionError] = useState("");
  const [trashed, setTrashed] = useState<Entry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Entry | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<Entry | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<Entry | null>(null);
  const [moveTarget, setMoveTarget] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [picking, setPicking] = useState(false);
  const operationFailed = t("Files.OperationFailed", {
    defaultValue: "The file operation could not be completed. Please try again.",
  });
  const moveInFlight = useRef(false);
  const pendingRef = useRef(false);
  const actionInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (action) actionInputRef.current?.focus();
  }, [action]);
  const workspaceKey = workspace ? ["file-workspace", workspace] : null;
  const workspaceOwner = useNativeRequestOwner(workspaceKey);
  const { data, error, mutate } = useSWR(workspaceKey, async () =>
    workspaceOwner!.run(async (signal) =>
      (await tauri.listFileWorkspace(workspace!, { signal })).map(workspaceEntryToEntry),
    ),
  );
  // Handle ids survive relisting and rename, so every fresh listing re-derives the selection;
  // an entry that is gone clears it. Before the first listing the chosen entry stands.
  const selected =
    selectedEntry && data ? findEntry(data, fileWorkspaceKey(selectedEntry.handle)) : selectedEntry;
  const fileTypeLabels: Record<FileType, string> = {
    game: t("Files.FileType.Game"),
    repertoire: t("Files.FileType.Repertoire"),
    tournament: t("Files.FileType.Tournament"),
    puzzle: t("Files.FileType.Puzzle"),
    other: t("Files.FileType.Other"),
  };
  useEffect(() => {
    setSelected(null);
  }, [workspace]);
  async function chooseWorkspace() {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPicking(true);
    try {
      const result = await runUnlessCancelled(t("Common.Error"), () => tauri.issueFileWorkspace());
      if (!result) return;
      setWorkspace(result.handle);
      setWorkspaceDisplayName(result.displayName);
    } finally {
      pendingRef.current = false;
      setPicking(false);
    }
  }
  const parent = selected?.type === "directory" ? selected.handle : workspace;
  const directories = (
    entries: Entry[],
  ): { handle: NonNullable<typeof workspace>; label: string }[] =>
    entries.flatMap((entry) =>
      entry.type === "directory"
        ? [{ handle: entry.handle, label: entry.name }, ...directories(entry.children)]
        : [],
    );
  const destinationDirectories = data ? directories(data) : [];
  const moveTargetHandle = [
    ...(workspace
      ? [
          {
            handle: workspace,
            label: t("Files.CollectionRoot", { defaultValue: "Collection root" }),
          },
        ]
      : []),
    ...destinationDirectories,
  ].find((entry) => fileWorkspaceKey(entry.handle) === moveTarget)?.handle;
  async function moveEntry(entry: Entry, destination: Entry["handle"]) {
    if (moveInFlight.current) return;
    moveInFlight.current = true;
    setMoving(true);
    setActionError("");
    setSelected(entry);
    try {
      await runAppliedMutationWithRefresh(
        () => tauri.moveWorkspaceEntry(workspace!, entry.handle, destination),
        mutate,
      );
      setMoveTarget(null);
    } catch {
      setActionError(operationFailed);
    } finally {
      moveInFlight.current = false;
      setMoving(false);
    }
  }
  async function submitAction() {
    if (!workspace || !parent || !name.trim()) return;
    setActionError("");
    try {
      await runAppliedMutationWithRefresh(async () => {
        if (action === fileAction.file)
          await tauri.createWorkspaceFile(workspace, parent, name, { type: "game", tags: [] }, "*");
        if (action === fileAction.folder)
          await tauri.createWorkspaceDirectory(workspace, parent, name);
        if (action === fileAction.rename && selected?.type === "file")
          await tauri.renameWorkspaceFile(workspace, selected.handle, name, {
            type: selected.metadata.type,
            tags: selected.metadata.tags,
          });
      }, mutate);
      setAction(null);
      setName("");
    } catch {
      setActionError(operationFailed);
    }
  }
  async function clearTrashAndRelist() {
    setTrashed(null);
    // SWR reports list failures separately; they must not replace the native mutation outcome
    // with a false generic failure or hide its applied-despite-error warning.
    await mutate().catch(() => {});
  }
  return (
    <Stack h="100%" p="md">
      <Group justify="space-between" wrap="wrap">
        <Title miw={0}>{t("Files.Title")}</Title>
        <Button miw={0} disabled={picking} onClick={() => void chooseWorkspace()}>
          {workspace
            ? t("Files.ChangeCollection", { defaultValue: "Change collection" })
            : t("Files.ChooseCollection", { defaultValue: "Choose collection" })}
        </Button>
      </Group>
      {!workspace && (
        <Center h="100%">
          <Text c="dimmed">
            {t("Files.EmptyWorkspace", {
              defaultValue: "Choose a PGN collection to manage it with native file permissions.",
            })}
          </Text>
        </Center>
      )}
      {workspace && (
        <SimpleGrid cols={{ base: 1, sm: 2 }} flex={1} mih={0} miw={0}>
          <Paper withBorder p="sm" miw={0} mih={{ base: "20rem", sm: 0 }} h={{ sm: "100%" }}>
            <Stack gap="xs" h="100%" miw={0}>
              <Group gap="xs" wrap="wrap" miw={0}>
                <Input
                  size="sm"
                  miw={0}
                  style={{ flexGrow: 1 }}
                  leftSection={<IconSearch size="1rem" />}
                  placeholder={t("Common.Search")}
                  aria-label={t("Common.Search")}
                  value={search}
                  onChange={(event) => setSearch(event.currentTarget.value)}
                />
                <Button miw={0} onClick={() => setAction(fileAction.file)}>
                  {t("Files.CreateFile", { defaultValue: "Create file" })}
                </Button>
                <Button miw={0} onClick={() => setAction(fileAction.folder)}>
                  {t("Files.CreateFolder", { defaultValue: "Create folder" })}
                </Button>
              </Group>
              <Group gap={4} wrap="wrap" miw={0} role="group" aria-label={t("Files.FileType")}>
                {fileTypes.map((type) => (
                  <Chip
                    key={type}
                    variant="outline"
                    size="sm"
                    checked={filter === type}
                    // Choosing the active type again returns to all types.
                    onChange={() => setFilter(filter === type ? "" : type)}
                  >
                    {fileTypeLabels[type]}
                  </Chip>
                ))}
              </Group>
              {trashed && (
                <Group wrap="wrap" miw={0}>
                  <Text size="sm" miw={0}>
                    {t("Files.MovedToTrash", {
                      defaultValue: "Moved {{name}} to trash.",
                      name: trashed.name,
                    })}
                  </Text>
                  <Button size="xs" onClick={() => setRestoreTarget(trashed)}>
                    {t("Common.Undo", { defaultValue: "Undo" })}
                  </Button>
                  <Button size="xs" color="red" onClick={() => setPurgeTarget(trashed)}>
                    {t("Files.DeletePermanently", { defaultValue: "Delete permanently" })}
                  </Button>
                </Group>
              )}
              {error ? (
                <Text c="red" role="alert">
                  {t("Files.LoadFailed", {
                    defaultValue: "Files could not be loaded. Please try again.",
                  })}
                </Text>
              ) : !data ? (
                <Text>{t("Common.Loading")}</Text>
              ) : (
                <>
                  {actionError && !moveTarget && (
                    <Text c="red" role="alert">
                      {actionError}
                    </Text>
                  )}
                  <ScrollArea flex={1} mih={0}>
                    <DirectoryTree
                      files={data}
                      refreshDirectory={async () => mutate()}
                      selectedFile={selected}
                      setSelectedFile={setSelected}
                      onRequestDelete={async (entry) => setDeleteTarget(entry)}
                      onRequestMove={(entry) => {
                        setActionError("");
                        setSelected(entry);
                        setMoveTarget(fileWorkspaceKey(workspace));
                      }}
                      onMove={(entry, destination) => moveEntry(entry, destination.handle)}
                      search={search}
                      filter={filter}
                    />
                  </ScrollArea>
                </>
              )}
            </Stack>
          </Paper>
          <Paper withBorder p="sm" miw={0} mih={{ base: "20rem", sm: 0 }} h={{ sm: "100%" }}>
            {selected?.type === "file" ? (
              <Stack gap="xs" h="100%" miw={0}>
                <Group gap="xs" wrap="wrap" miw={0}>
                  <Button
                    size="xs"
                    onClick={() => {
                      setName(selected.name);
                      setAction(fileAction.rename);
                    }}
                  >
                    {t("Files.Rename", { defaultValue: "Rename" })}
                  </Button>
                  <Button size="xs" onClick={() => setMoveTarget(fileWorkspaceKey(workspace))}>
                    {t("Files.Move", { defaultValue: "Move" })}
                  </Button>
                  <Button size="xs" color="red" onClick={() => setDeleteTarget(selected)}>
                    {t("Files.Trash", { defaultValue: "Trash" })}
                  </Button>
                </Group>
                <FileCard key={fileWorkspaceKey(selected.handle)} selected={selected} />
              </Stack>
            ) : selected?.type === "directory" ? (
              <Center h="100%">
                <Stack align="center" gap="xs" miw={0}>
                  <Text fw={600} size="lg" miw={0}>
                    {selected.name}
                  </Text>
                  <Text c="dimmed" size="sm">
                    {t("Files.FolderEntryCount", {
                      defaultValue: "Entries: {{number}}",
                      number: selected.children.length,
                    })}
                  </Text>
                </Stack>
              </Center>
            ) : (
              <Center h="100%">
                <Text c="dimmed" ta="center">
                  {t("Files.NoSelection", { defaultValue: "No file selected" })}
                </Text>
              </Center>
            )}
          </Paper>
        </SimpleGrid>
      )}
      <AppModal
        opened={action !== null}
        onClose={() => setAction(null)}
        title={
          action === fileAction.rename
            ? t("Files.RenameFile", { defaultValue: "Rename file" })
            : action === fileAction.folder
              ? t("Files.CreateFolder", { defaultValue: "Create folder" })
              : t("Files.CreateFile", { defaultValue: "Create file" })
        }
      >
        <Stack>
          <TextInput
            ref={actionInputRef}
            autoFocus
            data-autofocus
            label={t("Common.Name", { defaultValue: "Name" })}
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            error={actionError}
          />
          <Button onClick={submitAction}>{t("Common.Confirm", { defaultValue: "Confirm" })}</Button>
        </Stack>
      </AppModal>
      <AppModal
        opened={moveTarget !== null}
        onClose={() => setMoveTarget(null)}
        title={t("Files.MoveFile", { defaultValue: "Move file" })}
      >
        <Stack>
          <Select
            label={t("Files.DestinationFolder", { defaultValue: "Destination folder" })}
            value={moveTarget}
            onChange={setMoveTarget}
            data={[
              ...(workspace
                ? [
                    {
                      value: fileWorkspaceKey(workspace),
                      label: t("Files.CollectionRoot", { defaultValue: "Collection root" }),
                    },
                  ]
                : []),
              ...destinationDirectories.map((entry) => ({
                value: fileWorkspaceKey(entry.handle),
                label: entry.label,
              })),
            ]}
          />
          <Button
            disabled={!moveTarget || !selected || moving}
            onClick={async () => {
              if (!workspace || !selected || !moveTargetHandle) return;
              await moveEntry(selected, moveTargetHandle);
            }}
          >
            {t("Files.Move", { defaultValue: "Move" })}
          </Button>
          {actionError && (
            <Text c="red" role="alert">
              {actionError}
            </Text>
          )}
        </Stack>
      </AppModal>
      {deleteTarget && (
        <ConfirmModal
          title={t("Files.MoveToTrash", { defaultValue: "Move to trash" })}
          description={t("Files.MoveToTrashConfirm", {
            defaultValue: "Move {{name}} to trash?",
            name: deleteTarget.name,
          })}
          opened
          onClose={() => setDeleteTarget(null)}
          onConfirm={async () => {
            await runDestructiveWithRefresh(
              () => tauri.trashWorkspaceEntry(workspace!, deleteTarget.handle),
              async () => {
                setTrashed(deleteTarget);
                setSelected(null);
                setDeleteTarget(null);
                await mutate();
              },
            );
          }}
        />
      )}
      {restoreTarget && (
        <ConfirmModal
          title={t("Files.RestoreFile", { defaultValue: "Restore file" })}
          description={t("Files.RestoreConfirm", {
            defaultValue: "Restore {{name}}?",
            name: restoreTarget.name,
          })}
          confirmLabel={t("Files.Restore", { defaultValue: "Restore" })}
          opened
          onClose={() => setRestoreTarget(null)}
          onConfirm={async () => {
            await runDestructiveWithRefresh(
              () => tauri.restoreWorkspaceEntry(workspace!, restoreTarget.handle),
              clearTrashAndRelist,
            );
          }}
        />
      )}
      {purgeTarget && (
        <ConfirmModal
          title={t("Files.DeletePermanently", { defaultValue: "Delete permanently" })}
          description={t("Files.DeletePermanentlyConfirm", {
            defaultValue: "Permanently delete {{name}}?",
            name: purgeTarget.name,
          })}
          opened
          onClose={() => setPurgeTarget(null)}
          onConfirm={async () => {
            await runDestructiveWithRefresh(
              () => tauri.permanentlyDeleteWorkspaceEntry(workspace!, purgeTarget.handle),
              clearTrashAndRelist,
            );
          }}
        />
      )}
    </Stack>
  );
}
