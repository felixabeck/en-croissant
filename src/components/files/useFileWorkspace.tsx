import { libraryButtonProps } from "@/components/library/presentation";
import { tauri } from "@/platform/tauri";
import { listingFailure, rootFailureMessage } from "@/components/files/listingFailure";
import { useNativePicker } from "@/hooks/useNativePicker";
import { runAppliedMutationWithRefresh, runDestructiveWithRefresh } from "@/platform/errors";
import { runUnlessCancelled } from "@/components/files/notifyError";
import { Box, Button, Center, Group, Select, Stack, Text, TextInput } from "@mantine/core";
import { useAtom } from "jotai";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import useSWR, { useSWRConfig } from "swr";
import { useNativeRequestOwner } from "@/hooks/useNativeRequestOwner";
import { useScaledMaxWidth } from "@/hooks/useScaledMaxWidth";
import { fileWorkspaceAtom, fileWorkspaceDisplayNameAtom } from "@/state/atoms";
import { formatNumber } from "@/utils/format";
import { fileWorkspaceKey } from "@/utils/pathCapabilities";
import FileCard from "./FileCard";
import ConfirmModal from "../common/ConfirmModal";
import AppModal from "../common/AppModal";
import type { Entry, FileType } from "./file";
import { FILE_TYPES, workspaceEntryToEntry } from "./file";
import { workspaceErrorMessage } from "./workspaceError";
import { reconcileWorkspaceListing, workspaceListingKey } from "./workspaceListing";

const fileAction = { file: "file", folder: "folder", rename: "rename", edit: "edit" } as const;
type FileAction = (typeof fileAction)[keyof typeof fileAction];
const FILE_CARD_MIN_HEIGHT = "32rem";
const EMPTY_PANE_MIN_HEIGHT = "12rem";
// At 320px/200% the default modal clipped the type Select's "Repertoire";
// below this width the shared create/rename/edit dialog goes full-screen.
// The threshold follows the app font scale, measured in scaled root-em.
const COMPACT_DIALOG_WIDTH_EM = 30;

function findEntry(entries: Entry[], key: string, kind: Entry["type"]): Entry | null {
  for (const entry of entries) {
    if (entry.type === kind && fileWorkspaceKey(entry.handle) === key) return entry;
    if (entry.type === "directory") {
      const child = findEntry(entry.children, key, kind);
      if (child) return child;
    }
  }
  return null;
}

export function useFileWorkspace(
  selectedEntry: Entry | null,
  setSelectedEntry: (entry: Entry | null) => void,
  selectedWorkspaceKey?: string,
) {
  const { t } = useTranslation();
  const listingCache = useSWRConfig();
  const compactDialog = useScaledMaxWidth(COMPACT_DIALOG_WIDTH_EM);
  const fileTypeOptions = FILE_TYPES.map(({ value, translationKey }) => ({
    value,
    label: t(translationKey),
  }));
  const picker = useNativePicker();
  const [workspace, setWorkspace] = useAtom(fileWorkspaceAtom);
  const [, setWorkspaceDisplayName] = useAtom(fileWorkspaceDisplayNameAtom);
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
  const workspaceKey = workspace ? workspaceListingKey(workspace) : null;
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
  const ownedEntry =
    !selectedWorkspaceKey || (workspace && selectedWorkspaceKey === fileWorkspaceKey(workspace))
      ? selectedEntry
      : null;
  const selected =
    ownedEntry && data
      ? findEntry(data, fileWorkspaceKey(ownedEntry.handle), ownedEntry.type)
      : ownedEntry;
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
    if (!workspace) return;
    const submittingWorkspace = workspace;
    const submittingKey = workspaceListingKey(submittingWorkspace);
    const submittingCache = listingCache;
    moveInFlight.current = true;
    setMoving(true);
    setActionError("");
    setSelectedEntry(entry);
    try {
      await runAppliedMutationWithRefresh(
        () => tauri.moveWorkspaceEntry(submittingWorkspace, entry.handle, destination),
        (cleanupFailure) =>
          cleanupFailure
            ? reconcileWorkspaceListing(submittingWorkspace, submittingCache)
            : submittingCache.mutate(submittingKey),
      );
      setMoveTarget(null);
    } catch (cause) {
      setActionError(workspaceErrorMessage(cause, operationFailed, t));
    } finally {
      moveInFlight.current = false;
      setMoving(false);
    }
  }
  async function submitAction() {
    const nameUnchanged = selected?.type === "file" && name === selected.name;
    if (!workspace || !parent) return;
    const submittingWorkspace = workspace;
    const submittingKey = workspaceListingKey(submittingWorkspace);
    const submittingCache = listingCache;
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
      await runAppliedMutationWithRefresh(
        async () => {
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
        },
        (cleanupFailure) =>
          cleanupFailure
            ? reconcileWorkspaceListing(submittingWorkspace, submittingCache)
            : submittingCache.mutate(submittingKey),
      );
      setAction(null);
      setName("");
    } catch (cause) {
      setActionError(workspaceErrorMessage(cause, operationFailed, t));
    }
  }
  async function clearTrashAndRelist() {
    setTrashed(null);
    // SWR reports list failures separately; they must not replace the native mutation outcome
    // with a false generic failure or hide its applied-despite-error warning.
    await mutate().catch(() => {});
  }
  return {
    workspace,
    data,
    selected,
    failure,
    mutate,
    chooser: (
      <>
        <Button
          miw={0}
          {...libraryButtonProps}
          disabled={picker.pending}
          onClick={() => void chooseWorkspace()}
        >
          {workspace
            ? t("Files.ChangeCollection", { defaultValue: "Change collection" })
            : t("Files.ChooseCollection", { defaultValue: "Choose collection" })}
        </Button>
      </>
    ),
    creation: (
      <>
        <Button
          miw={0}
          {...libraryButtonProps}
          disabled={!workspace}
          onClick={() => setAction(fileAction.file)}
        >
          {t("Files.CreateFile", { defaultValue: "Create file" })}
        </Button>
        <Button
          miw={0}
          {...libraryButtonProps}
          disabled={!workspace}
          onClick={() => setAction(fileAction.folder)}
        >
          {t("Files.CreateFolder", { defaultValue: "Create folder" })}
        </Button>
      </>
    ),
    trash: (
      <>
        {trashed && (
          <Group wrap="wrap" miw={0}>
            <Text size="sm" miw={0}>
              {t("Files.MovedToTrash", {
                defaultValue: "Moved {{name}} to trash.",
                name: trashed.name,
              })}
            </Text>
            <Button size="xs" {...libraryButtonProps} onClick={() => setRestoreTarget(trashed)}>
              {t("Common.Undo", { defaultValue: "Undo" })}
            </Button>
            <Button
              size="xs"
              {...libraryButtonProps}
              color="red.8"
              onClick={() => setPurgeTarget(trashed)}
            >
              {t("Files.DeletePermanently", { defaultValue: "Delete permanently" })}
            </Button>
          </Group>
        )}
      </>
    ),
    status: (
      <Stack
        gap="xs"
        className="wrap-anywhere"
        role="region"
        aria-label={t("Files.Title")}
        data-library-source="files"
      >
        {!workspace ? (
          <Text c="dimmed">{t("Files.EmptyWorkspace")}</Text>
        ) : failure !== "silent" ? (
          <Text c="red" role="alert" className="wrap-anywhere">
            {loadFailureMessage}
          </Text>
        ) : !data ? (
          <Text role="status">
            {t("Library.FilesLoading", { defaultValue: "Loading PGN files…" })}
          </Text>
        ) : null}
        {actionError && !moveTarget && (
          <Text c="red" role="alert">
            {actionError}
          </Text>
        )}
      </Stack>
    ),
    listProps: {
      files: failure === "silent" ? (data ?? []) : [],
      selectedFile: selected,
      setSelectedFile: setSelectedEntry,
      onRequestDelete: (entry: Entry) => setDeleteTarget(entry),
      onRequestMove: (entry: Entry) => {
        setActionError("");
        setSelectedEntry(entry);
        setMoveTarget(fileWorkspaceKey(workspace!));
      },
      onMove: (entry: Entry, destination: Entry) => moveEntry(entry, destination.handle),
    },
    detail: (
      <>
        {selected?.type === "file" ? (
          <Stack gap="xs" h="100%" miw={0}>
            <Group gap="xs" wrap="wrap" miw={0}>
              <Button
                size="xs"
                {...libraryButtonProps}
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
                {...libraryButtonProps}
                onClick={() => {
                  if (workspace) setMoveTarget(fileWorkspaceKey(workspace));
                }}
              >
                {t("Files.Move", { defaultValue: "Move" })}
              </Button>
              <Button
                size="xs"
                {...libraryButtonProps}
                color="red.8"
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
                key={`file:${fileWorkspaceKey(selected.handle)}`}
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
      </>
    ),
    dialogs: (
      <>
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
            <Button miw={0} {...libraryButtonProps} onClick={submitAction}>
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
      </>
    ),
  };
}
