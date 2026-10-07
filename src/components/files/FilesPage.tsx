import { tauri } from "@/platform/tauri";
import { listingFailure, rootFailureMessage } from "@/components/files/listingFailure";
import { useNativePicker } from "@/hooks/useNativePicker";
import { runAppliedMutationWithRefresh, runDestructiveWithRefresh } from "@/platform/errors";
import { runUnlessCancelled } from "@/components/files/notifyError";
import {
  Box,
  Button,
  Center,
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
import { useMediaQuery } from "@mantine/hooks";
import { IconSearch } from "@tabler/icons-react";
import { useAtom } from "jotai";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import useSWR from "swr";
import { useNativeRequestOwner } from "@/hooks/useNativeRequestOwner";
import { fileWorkspaceAtom, fileWorkspaceDisplayNameAtom } from "@/state/atoms";
import { formatNumber } from "@/utils/format";
import { fileWorkspaceKey } from "@/utils/pathCapabilities";
import DirectoryTree from "./DirectoryTree";
import FileCard from "./FileCard";
import ConfirmModal from "../common/ConfirmModal";
import AppModal from "../common/AppModal";
import type { Entry, FileType } from "./file";
import { FILE_TYPES, workspaceEntryToEntry } from "./file";

const fileAction = { file: "file", folder: "folder", rename: "rename", edit: "edit" } as const;
type FileAction = (typeof fileAction)[keyof typeof fileAction];
const FILE_CARD_MIN_HEIGHT = "32rem";
const TREE_MAX_HEIGHT = "60vh";
const TREE_MIN_HEIGHT = "8rem";
const EMPTY_PANE_MIN_HEIGHT = "12rem";
// At 320px/200% the default modal clipped the type Select's "Repertoire";
// below this width the shared create/rename/edit dialog goes full-screen.
// Media-query em uses the initial font size: 30em = 480px regardless of the app font scale.
const COMPACT_DIALOG_QUERY = "(max-width: 30em)";
// At 320px and a 200% font scale a label is wider than its column: let it wrap instead of clipping.
const wrappingButton = {
  root: { height: "auto", minHeight: "var(--button-height)" },
  label: { whiteSpace: "normal", overflowWrap: "anywhere" },
} as const;

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
  const compactDialog = useMediaQuery(COMPACT_DIALOG_QUERY);
  const fileTypeOptions = FILE_TYPES.map(({ value, translationKey }) => ({
    value,
    label: t(translationKey),
  }));
  const picker = useNativePicker();
  const [workspace, setWorkspace] = useAtom(fileWorkspaceAtom);
  const [, setWorkspaceDisplayName] = useAtom(fileWorkspaceDisplayNameAtom);
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FileType | "">("");
  const [action, setAction] = useState<FileAction | null>(null);
  const [name, setName] = useState("");
  const [fileType, setFileType] = useState<FileType>("other");
  const [actionError, setActionError] = useState("");
  const [trashed, setTrashed] = useState<Entry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Entry | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<Entry | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<Entry | null>(null);
  const [moveTarget, setMoveTarget] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const operationFailed = t("Files.OperationFailed", {
    defaultValue: "The file operation could not be completed. Please try again.",
  });
  const moveInFlight = useRef(false);
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
  const failure = listingFailure(error);
  const loadFailureMessage =
    rootFailureMessage("files", error, t) ??
    t("Files.LoadFailed", {
      defaultValue: "Files could not be loaded. Please try again.",
    });
  // Handle ids survive relisting and rename, so every fresh listing re-derives the selection;
  // an entry that is gone clears it. Before the first listing the chosen entry stands.
  const selected =
    selectedEntry && data ? findEntry(data, fileWorkspaceKey(selectedEntry.handle)) : selectedEntry;
  useEffect(() => {
    setSelectedEntry(null);
  }, [workspace]);
  function chooseWorkspace() {
    return picker.run(async () => {
      const result = await runUnlessCancelled(
        t("Common.Error"),
        () => tauri.issueFileWorkspace(),
        "files",
      );
      if (!result) return;
      setWorkspace(result.handle);
      setWorkspaceDisplayName(result.displayName);
    });
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
    setSelectedEntry(entry);
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
    const nameUnchanged = selected?.type === "file" && name === selected.name;
    if (!workspace || !parent) return;
    const editing = action === fileAction.edit || action === fileAction.rename;
    if (
      !name.trim() &&
      (action === fileAction.file || action === fileAction.folder || (editing && !nameUnchanged))
    )
      return;
    setActionError("");
    const chosenType =
      action === fileAction.edit
        ? fileType
        : selected?.type === "file"
          ? selected.metadata.type
          : "other";
    if (
      editing &&
      selected?.type === "file" &&
      nameUnchanged &&
      chosenType === selected.metadata.type
    ) {
      setAction(null);
      setName("");
      return;
    }
    try {
      await runAppliedMutationWithRefresh(async () => {
        if (action === fileAction.file)
          await tauri.createWorkspaceFile(
            workspace,
            parent,
            name,
            { type: "game", tags: [] },
            {
              kind: "text",
              pgn: "*",
            },
          );
        if (action === fileAction.folder)
          await tauri.createWorkspaceDirectory(workspace, parent, name);
        if (editing && selected?.type === "file") {
          const metadata = {
            type: chosenType,
            tags: selected.metadata.tags,
          };
          if (nameUnchanged)
            await tauri.writeWorkspaceFileMetadata(workspace, selected.handle, metadata);
          else await tauri.renameWorkspaceFile(workspace, selected.handle, name, metadata);
        }
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
    // The page scrolls as a whole and the columns take their content's height: at a 200% font
    // scale they are taller than the window and must never be squeezed over each other.
    <Stack h="100%" p={{ base: "xs", sm: "md" }} style={{ overflow: "auto" }}>
      <Group justify="space-between" wrap="wrap">
        <Title miw={0} fz={{ base: "h3", sm: "h1" }} style={{ overflowWrap: "anywhere" }}>
          {t("Files.Title")}
        </Title>
        <Button
          miw={0}
          styles={wrappingButton}
          disabled={picker.pending}
          onClick={() => void chooseWorkspace()}
        >
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
        <SimpleGrid cols={{ base: 1, sm: 2 }} flex="1 0 auto" miw={0}>
          <Paper withBorder p={{ base: 6, sm: "sm" }} miw={0}>
            <Stack gap="xs" miw={0}>
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
                <Button miw={0} styles={wrappingButton} onClick={() => setAction(fileAction.file)}>
                  {t("Files.CreateFile", { defaultValue: "Create file" })}
                </Button>
                <Button
                  miw={0}
                  styles={wrappingButton}
                  onClick={() => setAction(fileAction.folder)}
                >
                  {t("Files.CreateFolder", { defaultValue: "Create folder" })}
                </Button>
              </Group>
              {/* A select, not five chips: at 320px and a 200% font scale one chip is wider than the column. */}
              <Select
                size="sm"
                miw={0}
                clearable
                // A label, not a placeholder: a label wraps, a placeholder is cut off at 320px.
                label={t("Files.FileType")}
                value={filter || null}
                // Choosing the active type again, or clearing, returns to all types.
                onChange={(value) => setFilter((value as FileType | null) ?? "")}
                data={fileTypeOptions}
              />
              {trashed && (
                <Group wrap="wrap" miw={0}>
                  <Text size="sm" miw={0}>
                    {t("Files.MovedToTrash", {
                      defaultValue: "Moved {{name}} to trash.",
                      name: trashed.name,
                    })}
                  </Text>
                  <Button
                    size="xs"
                    styles={wrappingButton}
                    onClick={() => setRestoreTarget(trashed)}
                  >
                    {t("Common.Undo", { defaultValue: "Undo" })}
                  </Button>
                  <Button
                    size="xs"
                    styles={wrappingButton}
                    color="red"
                    onClick={() => setPurgeTarget(trashed)}
                  >
                    {t("Files.DeletePermanently", { defaultValue: "Delete permanently" })}
                  </Button>
                </Group>
              )}
              {failure !== "silent" ? (
                <Text c="red" role="alert" className="wrap-anywhere">
                  {loadFailureMessage}
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
                  <ScrollArea.Autosize mah={TREE_MAX_HEIGHT} mih={TREE_MIN_HEIGHT}>
                    <DirectoryTree
                      files={data}
                      selectedFile={selected}
                      setSelectedFile={setSelectedEntry}
                      onRequestDelete={async (entry) => setDeleteTarget(entry)}
                      onRequestMove={(entry) => {
                        setActionError("");
                        setSelectedEntry(entry);
                        setMoveTarget(fileWorkspaceKey(workspace));
                      }}
                      onMove={(entry, destination) => moveEntry(entry, destination.handle)}
                      search={search}
                      filter={filter}
                    />
                  </ScrollArea.Autosize>
                </>
              )}
            </Stack>
          </Paper>
          <Paper withBorder p={{ base: 6, sm: "sm" }} miw={0}>
            {selected?.type === "file" ? (
              <Stack gap="xs" h="100%" miw={0}>
                <Group gap="xs" wrap="wrap" miw={0}>
                  <Button
                    size="xs"
                    styles={wrappingButton}
                    onClick={() => {
                      setName(selected.name);
                      setActionError("");
                      setAction(fileAction.rename);
                    }}
                  >
                    {t("Files.Rename", { defaultValue: "Rename" })}
                  </Button>
                  <Button
                    size="xs"
                    styles={wrappingButton}
                    onClick={() => setMoveTarget(fileWorkspaceKey(workspace))}
                  >
                    {t("Files.Move", { defaultValue: "Move" })}
                  </Button>
                  <Button
                    size="xs"
                    styles={wrappingButton}
                    color="red"
                    onClick={() => setDeleteTarget(selected)}
                  >
                    {t("Files.Trash", { defaultValue: "Trash" })}
                  </Button>
                </Group>
                {/* The card fills the column down to the window's bottom edge and splits that height
                    between its game list and preview. A fixed height left a wide, short window's list
                    two rows high; the floor keeps a 200% font scale usable, where the page scrolls. */}
                <Box flex={1} mih={FILE_CARD_MIN_HEIGHT}>
                  <FileCard
                    key={fileWorkspaceKey(selected.handle)}
                    selected={selected}
                    onEditMetadata={() => {
                      setName(selected.name);
                      setFileType(selected.metadata.type);
                      setActionError("");
                      setAction(fileAction.edit);
                    }}
                  />
                </Box>
              </Stack>
            ) : selected?.type === "directory" ? (
              <Center mih={EMPTY_PANE_MIN_HEIGHT}>
                <Stack align="center" gap="xs" miw={0}>
                  <Text fw={600} size="lg" miw={0}>
                    {selected.name}
                  </Text>
                  <Text c="dimmed" size="sm">
                    {t("Files.FolderEntryCount", {
                      defaultValue: "Entries: {{number}}",
                      number: formatNumber(selected.children.length),
                    })}
                  </Text>
                </Stack>
              </Center>
            ) : (
              <Center mih={EMPTY_PANE_MIN_HEIGHT}>
                <Text c="dimmed" ta="center" miw={0} className="wrap-anywhere">
                  {t("Files.NoSelection", { defaultValue: "No file selected" })}
                </Text>
              </Center>
            )}
          </Paper>
        </SimpleGrid>
      )}
      <AppModal
        opened={action !== null}
        fullScreen={compactDialog}
        onClose={() => setAction(null)}
        title={
          action === fileAction.edit
            ? t("Files.EditMetadata")
            : action === fileAction.rename
              ? t("Files.RenameFile", { defaultValue: "Rename file" })
              : action === fileAction.folder
                ? t("Files.CreateFolder", { defaultValue: "Create folder" })
                : t("Files.CreateFile", { defaultValue: "Create file" })
        }
      >
        <Stack miw={0}>
          <TextInput
            miw={0}
            ref={actionInputRef}
            autoFocus
            data-autofocus
            label={t("Common.Name", { defaultValue: "Name" })}
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            error={actionError}
          />
          {action === fileAction.edit && (
            <Select
              miw={0}
              required
              allowDeselect={false}
              label={t("Files.FileType")}
              value={fileType}
              onChange={(value) => {
                if (value) setFileType(value as FileType);
              }}
              data={fileTypeOptions}
            />
          )}
          <Button miw={0} styles={wrappingButton} onClick={submitAction}>
            {t("Common.Confirm", { defaultValue: "Confirm" })}
          </Button>
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
                setSelectedEntry(null);
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
