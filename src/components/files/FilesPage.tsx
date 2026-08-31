import { tauri } from "@/platform/tauri";
import { runDestructiveWithRefresh } from "@/platform/errors";
import { notifyUnlessCancelled } from "@/components/files/notifyError";
import { Button, Center, Group, Paper, Select, Stack, Text, TextInput, Title } from "@mantine/core";
import { useAtom } from "jotai";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import useSWR from "swr";
import { fileWorkspaceAtom, fileWorkspaceDisplayNameAtom } from "@/state/atoms";
import { fileWorkspaceKey } from "@/utils/pathCapabilities";
import DirectoryTree from "./DirectoryTree";
import ConfirmModal from "../common/ConfirmModal";
import AppModal from "../common/AppModal";
import type { Entry } from "./file";
import { workspaceEntryToEntry } from "./file";

const fileAction = { file: "file", folder: "folder", rename: "rename" } as const;
type FileAction = (typeof fileAction)[keyof typeof fileAction];

export default function FilesPage() {
  const { t } = useTranslation();
  const [workspace, setWorkspace] = useAtom(fileWorkspaceAtom);
  const [, setWorkspaceDisplayName] = useAtom(fileWorkspaceDisplayNameAtom);
  const [selected, setSelected] = useState<Entry | null>(null);
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
  const { data, error, mutate } = useSWR(
    workspace ? ["file-workspace", workspace] : null,
    async () => (await tauri.listFileWorkspace(workspace!)).map(workspaceEntryToEntry),
  );
  useEffect(() => {
    setSelected(null);
  }, [workspace]);
  async function chooseWorkspace() {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPicking(true);
    try {
      const result = await tauri.issueFileWorkspace();
      setWorkspace(result.handle);
      setWorkspaceDisplayName(result.displayName);
    } catch (cause) {
      notifyUnlessCancelled(t("Common.Error"), cause);
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
      await tauri.moveWorkspaceEntry(workspace!, entry.handle, destination);
      setMoveTarget(null);
      await mutate();
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
      if (action === fileAction.file)
        await tauri.createWorkspaceFile(workspace, parent, name, { type: "game", tags: [] }, "*");
      if (action === fileAction.folder)
        await tauri.createWorkspaceDirectory(workspace, parent, name);
      if (action === fileAction.rename && selected?.type === "file")
        await tauri.renameWorkspaceFile(workspace, selected.handle, name, {
          type: selected.metadata.type,
          tags: selected.metadata.tags,
        });
      setAction(null);
      setName("");
      await mutate();
    } catch {
      setActionError(operationFailed);
    }
  }
  return (
    <Stack h="100%" p="md">
      <Group justify="space-between">
        <Title>{t("Files.Title")}</Title>
        <Group>
          <Button disabled={picking} onClick={() => void chooseWorkspace()}>
            {workspace
              ? t("Files.ChangeCollection", { defaultValue: "Change collection" })
              : t("Files.ChooseCollection", { defaultValue: "Choose collection" })}
          </Button>
          {workspace && (
            <Button onClick={() => setAction(fileAction.file)}>
              {t("Files.CreateFile", { defaultValue: "Create file" })}
            </Button>
          )}
          {workspace && (
            <Button onClick={() => setAction(fileAction.folder)}>
              {t("Files.CreateFolder", { defaultValue: "Create folder" })}
            </Button>
          )}
        </Group>
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
        <Paper withBorder p="sm" h="100%">
          {selected?.type === "file" && (
            <Group>
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
          )}
          {trashed && (
            <Group>
              <Text size="sm">
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
                search=""
                filter=""
              />
            </>
          )}
        </Paper>
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
            await tauri.trashWorkspaceEntry(workspace!, deleteTarget.handle);
            setTrashed(deleteTarget);
            setSelected(null);
            setDeleteTarget(null);
            await mutate();
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
            await tauri.restoreWorkspaceEntry(workspace!, restoreTarget.handle);
            setTrashed(null);
            await mutate();
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
            // A relist failure must never become the reported outcome of a delete. Reporting a
            // completed destructive delete as "could not be completed" is worse than a stale
            // list, and after a partial delete it hides the one message the user needs.
            const relist = async () => {
              setTrashed(null);
              await mutate().catch(() => {});
            };
            await runDestructiveWithRefresh(
              () => tauri.permanentlyDeleteWorkspaceEntry(workspace!, purgeTarget.handle),
              relist,
            );
          }}
        />
      )}
    </Stack>
  );
}
