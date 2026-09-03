import { tauri } from "@/platform/tauri";
import {
  Button,
  Checkbox,
  Divider,
  FileInput,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { makeFen, parseFen } from "chessops/fen";
import { useAtom, useStore } from "jotai";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";
import { runUnlessCancelled } from "@/components/files/notifyError";
import { addRecentFileAtom, currentTabAtom } from "@/state/atoms";
import { tabStorage } from "@/state/store/tabStorage";
import { parsePGN } from "@/utils/chess";
import { getChesscomGame } from "@/utils/chess.com/api";
import { chessopsError } from "@/utils/chessops";
import { createFile, ensureFileWorkspace, openFile, pickPgnFile } from "@/utils/files";
import { getLichessGame } from "@/utils/lichess/api";
import { type Tab } from "@/utils/tabs";
import { defaultTree, getGameName } from "@/utils/treeReducer";
import AppModal from "../common/AppModal";
import GenericCard from "../common/GenericCard";
import type { FileMetadata, FileType } from "../files/file";

type ImportType = "PGN" | "Link" | "FEN";

const FILE_TYPES = [
  { translationKey: "Files.FileType.Game", value: "game" },
  { translationKey: "Files.FileType.Repertoire", value: "repertoire" },
  { translationKey: "Files.FileType.Tournament", value: "tournament" },
  { translationKey: "Files.FileType.Puzzle", value: "puzzle" },
  { translationKey: "Files.FileType.Other", value: "other" },
] as const;

export default function ImportModal({
  openModal,
  setOpenModal,
  setTabs,
  setActiveTab,
}: {
  openModal: boolean;
  setOpenModal: React.Dispatch<React.SetStateAction<boolean>>;
  setTabs: React.Dispatch<React.SetStateAction<Tab[]>>;
  setActiveTab: React.Dispatch<React.SetStateAction<string | null>>;
}) {
  const { t } = useTranslation();
  const [pgn, setPgn] = useState("");
  const [fen, setFen] = useState("");
  const [file, setFile] = useState<FileMetadata | null>(null);
  const [link, setLink] = useState("");
  const [importType, setImportType] = useState<ImportType>("PGN");
  const [filetype, setFiletype] = useState<FileType>("game");
  const [loading, setLoading] = useState(false);
  const [, setCurrentTab] = useAtom(currentTabAtom);
  const [fenError, setFenError] = useState("");

  const [save, setSave] = useState(false);
  const [filename, setFilename] = useState("");
  const [error, setError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const store = useStore();

  async function handleSubmit() {
    setLoading(true);
    setSubmitError("");
    try {
      if (importType === "PGN") {
        if (file || pgn) {
          if (file) {
            let fileInfo: FileMetadata | undefined;
            const count = file.numGames;
            const fileContent = (
              await tauri.readGames(file.handle, 0, Math.max(0, count - 1))
            ).join("\n\n");
            const input = (await tauri.readGames(file.handle, 0, 0))[0];
            if (save) {
              const workspace = await ensureFileWorkspace();
              if (!workspace) return;
              const newFile = await createFile({
                filename,
                filetype,
                pgn: fileContent,
                workspace,
                parent: workspace,
              });
              if (newFile.isErr) {
                setError(newFile.error.message);
                setLoading(false);
                return;
              }
              fileInfo = newFile.value;
            } else {
              fileInfo = {
                type: "file",
                handle: file.handle,
                numGames: count,
                name: filename,
                lastModified: Date.now(),
                metadata: {
                  type: "game",
                  tags: [],
                },
              };
            }
            const tree = await parsePGN(input);
            const originKind = "file";
            setCurrentTab((prev) => {
              tabStorage.seed(prev.value, tree);
              return {
                ...prev,
                name: getGameName(tree.headers),
                gameOrigin: {
                  kind: originKind,
                  file: fileInfo,
                  gameNumber: 0,
                },
                type: "analysis",
              };
            });

            if (fileInfo) {
              store.set(addRecentFileAtom, {
                name: fileInfo.name,
                handle: fileInfo.handle,
                type: fileInfo.metadata.type,
              });
            }
          } else {
            const workspace = await ensureFileWorkspace();
            if (!workspace) return;
            const created = await createFile({
              filename: `import-${Date.now()}`,
              filetype: "game",
              pgn,
              workspace,
              parent: workspace,
            });
            if (created.isErr) throw created.error;
            await openFile(created.value, setTabs, setActiveTab);
          }
        }
      } else if (importType === "Link") {
        if (!link) {
          setLoading(false);
          return;
        }
        let pgn = "";
        if (link.includes("chess.com")) {
          const res = await getChesscomGame(link);
          if (res === null) {
            setLoading(false);
            return;
          }
          pgn = res;
        } else if (link.includes("lichess")) {
          const excludedPathParts = ["game", "export", "white", "black"];
          const gameId = new URL(link).pathname
            .split("/")
            .find((x) => x && !excludedPathParts.includes(x));
          if (!gameId) {
            setLoading(false);
            return;
          }
          pgn = await getLichessGame(gameId);
        }

        const tree = await parsePGN(pgn);
        setCurrentTab((prev) => {
          tabStorage.seed(prev.value, tree);
          return {
            ...prev,
            name: getGameName(tree.headers),
            gameOrigin: {
              kind: "none",
            },
            type: "analysis",
          };
        });
      } else if (importType === "FEN") {
        const res = parseFen(fen.trim());
        if (res.isErr) {
          setFenError(chessopsError(res.error));
          setLoading(false);
          return;
        }
        setFenError("");
        const parsedFen = makeFen(res.value);
        setCurrentTab((prev) => {
          const tree = defaultTree(parsedFen);
          tree.headers.fen = parsedFen;
          tabStorage.seed(prev.value, tree);
          return {
            ...prev,
            name: t("Home.Card.AnalysisBoard.Title"),
            gameOrigin: {
              kind: "none",
            },
            type: "analysis",
          };
        });
      }
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const Input = match(importType)
    .with("PGN", () => (
      <Stack>
        <div>
          <FileInput
            label={t("Common.PGNFile")}
            description={t("Import.PGN.ClickToSelect")}
            onClick={() => {
              void runUnlessCancelled(t("Common.Error"), async () => {
                const selected = await pickPgnFile();
                setFile(selected);
                setFilename(selected?.name || "");
              });
            }}
            value={file ? new File([new Blob()], file.name) : null}
            onChange={(e) => {
              if (e === null) {
                setFile(null);
                setFilename("");
              }
            }}
            disabled={pgn !== ""}
          />
          <Divider pt="xs" label={t("Import.Or")} labelPosition="center" />
          <Textarea
            value={pgn}
            disabled={file !== null}
            onChange={(event) => setPgn(event.currentTarget.value)}
            label={t("Common.PGNGame")}
            data-autofocus
            rows={8}
          />
        </div>

        <Checkbox
          label={t("Import.SaveToCollection")}
          checked={save}
          onChange={(e) => setSave(e.currentTarget.checked)}
        />

        {save && (
          <>
            <TextInput
              label={t("Common.Name")}
              placeholder={t("Common.EnterFileName")}
              required
              value={filename}
              onChange={(e) => setFilename(e.currentTarget.value)}
              error={error}
            />

            <Text fz="sm" fw="bold">
              {t("Files.FileType")}
            </Text>

            <SimpleGrid cols={3}>
              {FILE_TYPES.map((v) => (
                <GenericCard
                  key={v.value}
                  id={v.value}
                  isSelected={filetype === v.value}
                  setSelected={setFiletype}
                  Header={<Text ta="center">{t(v.translationKey)}</Text>}
                />
              ))}
            </SimpleGrid>
          </>
        )}
      </Stack>
    ))
    .with("Link", () => (
      <TextInput
        value={link}
        onChange={(event) => setLink(event.currentTarget.value)}
        label={t("Import.GameURL")}
        data-autofocus
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit();
        }}
      />
    ))
    .with("FEN", () => (
      <TextInput
        value={fen}
        onChange={(event) => setFen(event.currentTarget.value)}
        error={fenError}
        label="FEN"
        data-autofocus
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit();
        }}
      />
    ))
    .exhaustive();

  const disabled = match(importType)
    .with("PGN", () => !pgn && !file)
    .with("Link", () => !link)
    .with("FEN", () => !fen)
    .exhaustive();

  return (
    <AppModal
      opened={openModal}
      onClose={() => setOpenModal(false)}
      title={t("Home.Card.ImportGame.Title")}
    >
      <Group grow mb="sm">
        <GenericCard
          id={"PGN"}
          isSelected={importType === "PGN"}
          setSelected={setImportType}
          Header={<Text ta="center">PGN</Text>}
        />

        <GenericCard
          id={"Link"}
          isSelected={importType === "Link"}
          setSelected={setImportType}
          Header={<Text ta="center">{t("Import.Online")}</Text>}
        />

        <GenericCard
          id={"FEN"}
          isSelected={importType === "FEN"}
          setSelected={setImportType}
          Header={<Text ta="center">FEN</Text>}
        />
      </Group>

      {Input}

      <Button
        fullWidth
        mt="md"
        radius="md"
        loading={loading}
        disabled={disabled}
        onClick={handleSubmit}
      >
        {loading ? t("Import.Importing") : t("Home.Card.ImportGame.Button")}
      </Button>

      {submitError && (
        <Text c="red" size="sm" mt="xs">
          {submitError}
        </Text>
      )}
    </AppModal>
  );
}
