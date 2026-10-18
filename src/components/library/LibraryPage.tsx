import { libraryButtonProps } from "./presentation";
import {
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
  Title,
} from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import DirectoryTree, { type CollectionPeer } from "@/components/files/DirectoryTree";
import { FILE_TYPES, type Entry } from "@/components/files/file";
import { useFileWorkspace } from "@/components/files/useFileWorkspace";
import { useDatabaseLibrary } from "@/components/databases/useDatabaseLibrary";
import { databaseHandleKey } from "@/utils/db";
import { fileWorkspaceKey } from "@/utils/pathCapabilities";

type Selection =
  | { kind: "workspace"; workspaceKey: string; entry: Entry }
  | { kind: "database"; key: string };

export default function LibraryPage() {
  const { t } = useTranslation();
  const [selection, setSelection] = useState<Selection | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [visibleCount, setVisibleCount] = useState(0);
  const files = useFileWorkspace(
    selection?.kind === "workspace" ? selection.entry : null,
    (entry) => {
      setSelection((current) =>
        entry && files.workspace
          ? { kind: "workspace", workspaceKey: fileWorkspaceKey(files.workspace), entry }
          : current?.kind === "workspace"
            ? null
            : current,
      );
    },
    selection?.kind === "workspace" ? selection.workspaceKey : undefined,
  );
  const workspaceKey = files.workspace ? fileWorkspaceKey(files.workspace) : null;
  const fileSelection =
    selection?.kind === "workspace" && selection.workspaceKey === workspaceKey
      ? files.selected
      : null;
  const databases = useDatabaseLibrary(
    selection?.kind === "database" ? selection.key : null,
    (next) => {
      setSelection((current) => {
        const key =
          typeof next === "function"
            ? next(current?.kind === "database" ? current.key : null)
            : next;
        return key ? { kind: "database", key } : current?.kind === "database" ? null : current;
      });
    },
  );
  useEffect(() => {
    if (
      selection?.kind === "workspace" &&
      (selection.workspaceKey !== workspaceKey || (files.data && !files.selected))
    )
      setSelection(null);
    if (
      selection?.kind === "database" &&
      databases.databases &&
      !databases.convertingSelected &&
      !databases.databases.some((db) => databaseHandleKey(db.file) === selection.key)
    )
      setSelection(null);
  }, [
    selection,
    workspaceKey,
    files.data,
    files.selected,
    databases.databases,
    databases.convertingSelected,
  ]);
  const normalizedSearch = search.trim().toLowerCase();
  const peers: CollectionPeer[] = [
    ...databases.visibleDatabases
      .filter(
        (item) =>
          (!filter || filter === "database") &&
          (!normalizedSearch ||
            [
              item.filename,
              item.type === "success" ? item.title : item.error,
              item.type === "success" ? item.description : "",
            ].some((value) => value.toLowerCase().includes(normalizedSearch))),
      )
      .map((item) => ({
        type: "database" as const,
        key: databaseHandleKey(item.file),
        name: item.type === "success" ? item.title : item.filename,
        selected: selection?.kind === "database" && selection.key === databaseHandleKey(item.file),
        onSelect: () => setSelection({ kind: "database", key: databaseHandleKey(item.file) }),
        onOpen: () => databases.openDatabase(item),
        content: databases.renderRow(item),
      })),
    ...databases.unread
      .filter(
        (item) =>
          (!filter || filter === "database") &&
          (!normalizedSearch ||
            [item.filename, item.error].some((value) =>
              value.toLowerCase().includes(normalizedSearch),
            )),
      )
      .map((item) => ({
        type: "database" as const,
        key: item.key,
        name: item.filename,
        selected: false,
        content: databases.renderUnreadRow(item),
      })),
  ];
  const loadedEmpty =
    files.workspace &&
    files.data?.length === 0 &&
    databases.databases?.length === 0 &&
    databases.unread.length === 0 &&
    files.failure === "silent" &&
    databases.failure === "silent";
  const filteredEmpty = (normalizedSearch || filter) && visibleCount === 0;
  return (
    <Stack h="100%" p={{ base: "xs", sm: "md" }} style={{ overflow: "auto" }}>
      <Group justify="space-between" wrap="wrap">
        <Title miw={0} fz={{ base: "h3", sm: "h1" }} className="wrap-anywhere">
          {t("Library.Title", { defaultValue: "Library" })}
        </Title>
        {files.chooser}
      </Group>
      <Group role="group" aria-label={t("Common.AddNew")} gap="xs" wrap="wrap">
        {files.creation}
        <Button
          miw={0}
          disabled={databases.conversionInProgress}
          onClick={databases.add}
          {...libraryButtonProps}
        >
          {t("Library.AddDatabase", { defaultValue: "Import or download database" })}
        </Button>
      </Group>
      <SimpleGrid cols={{ base: 1, sm: 2 }} flex="1 0 auto" miw={0}>
        <Paper withBorder p={{ base: 6, sm: "sm" }} miw={0}>
          <Stack gap="xs" miw={0}>
            <Input
              size="sm"
              miw={0}
              leftSection={<IconSearch size="1rem" />}
              placeholder={t("Common.Search")}
              aria-label={t("Common.Search")}
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
            />
            <Select
              size="sm"
              miw={0}
              clearable
              styles={{ option: { overflowWrap: "anywhere", minWidth: 0 } }}
              clearButtonProps={{
                "aria-label": t("Library.ClearTypeFilter", { defaultValue: "Clear type filter" }),
                "aria-hidden": false,
                tabIndex: 0,
              }}
              label={t("Files.FileType")}
              value={filter || null}
              onChange={(value) => setFilter(value ?? "")}
              data={[
                ...FILE_TYPES.map(({ value, translationKey }) => ({
                  value,
                  label: t(translationKey),
                })),
                {
                  value: "database",
                  label: t("Library.GamesDatabase", { defaultValue: "Games database" }),
                },
              ]}
            />
            {files.trash}
            {files.status}
            {databases.status}
            <ScrollArea.Autosize mah="60vh" mih="8rem">
              {databases.progress}
              <DirectoryTree
                {...files.listProps}
                selectedFile={fileSelection}
                files={filter === "database" ? [] : files.listProps.files}
                search={search}
                filter={filter}
                peers={peers}
                label={t("Library.Title", { defaultValue: "Library" })}
                onVisibleCount={setVisibleCount}
              />
              {(loadedEmpty || filteredEmpty) && (
                <Text c="dimmed" ta="center">
                  {filteredEmpty
                    ? t("Common.NoResults")
                    : t("Library.Empty", {
                        defaultValue:
                          "Your library is empty. Create a file or add a database to get started.",
                      })}
                </Text>
              )}
            </ScrollArea.Autosize>
          </Stack>
        </Paper>
        <Paper withBorder p={{ base: 6, sm: "sm" }} miw={0}>
          {fileSelection ? (
            files.detail
          ) : databases.selectedDatabase ? (
            <Stack key={`database:${databaseHandleKey(databases.selectedDatabase.file)}`} miw={0}>
              {databases.detail}
            </Stack>
          ) : (
            <Center mih="12rem">
              <Text c="dimmed" ta="center">
                {databases.convertingSelected
                  ? t("Library.Converting", {
                      defaultValue:
                        "This database is being converted. Its actions will return when conversion finishes.",
                    })
                  : t("Library.NoSelection", { defaultValue: "Select a library item" })}
              </Text>
            </Center>
          )}
        </Paper>
      </SimpleGrid>
      {files.dialogs}
      {databases.dialogs}
    </Stack>
  );
}
