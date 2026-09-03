import { Button, SegmentedControl, Stack, Text, TextInput } from "@mantine/core";
import { useNavigate } from "@tanstack/react-router";
import { INITIAL_FEN } from "chessops/fen";
import { useAtom, useSetAtom, useStore } from "jotai";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { normalizeError } from "@/platform/errors";
import { activeTabAtom, addRecentFileAtom, tabFamily, tabsAtom } from "@/state/atoms";
import { headersToPGN } from "@/utils/chess";
import { createFile, ensureFileWorkspace } from "@/utils/files";
import { createTab } from "@/utils/tabs";
import AppModal from "../common/AppModal";

export default function CreateRepertoireModal({
  opened,
  setOpened,
}: {
  opened: boolean;
  setOpened: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [color, setColor] = useState<"white" | "black">("white");
  const [error, setError] = useState("");

  const [, setTabs] = useAtom(tabsAtom);
  const setActiveTab = useSetAtom(activeTabAtom);
  const store = useStore();
  const navigate = useNavigate();

  async function handleCreate() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(t("Common.RequireName"));
      return;
    }

    const pgn = headersToPGN({
      id: 0,
      fen: INITIAL_FEN,
      black: "",
      white: "",
      result: "*",
      event: trimmedName,
      site: "",
      orientation: color,
    });

    try {
      const workspace = await ensureFileWorkspace();
      if (!workspace) return;
      const result = await createFile({
        filename: trimmedName,
        filetype: "repertoire",
        pgn,
        workspace,
        parent: workspace,
      });

      if (result.isErr) {
        setError(result.error.message);
        return;
      }

      const fileInfo = result.value;
      const id = await createTab({
        tab: {
          name: trimmedName,
          type: "analysis",
        },
        setTabs,
        setActiveTab,
        pgn,
        gameOrigin: {
          kind: "file",
          file: fileInfo,
          gameNumber: 0,
        },
      });

      store.set(tabFamily(id), "practice");
      store.set(addRecentFileAtom, {
        name: trimmedName,
        handle: fileInfo.handle,
        type: "repertoire",
      });
      navigate({ to: "/" });

      setName("");
      setColor("white");
      setError("");
      setOpened(false);
    } catch (error) {
      setError(normalizeError(error).message);
    }
  }

  return (
    <AppModal
      opened={opened}
      onClose={() => setOpened(false)}
      title={t("Home.Card.NewRepertoire.Title")}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleCreate();
        }}
      >
        <Stack>
          <TextInput
            label={t("Common.Name")}
            placeholder={t("Home.Card.NewRepertoire.NamePlaceholder")}
            value={name}
            onChange={(e) => {
              setName(e.currentTarget.value);
              if (error) setError("");
            }}
            error={error}
            data-autofocus
          />

          <div>
            <Text size="sm" fw={500} mb={4}>
              {t("Home.Card.NewRepertoire.Color")}
            </Text>
            <SegmentedControl
              fullWidth
              value={color}
              onChange={(v) => setColor(v as "white" | "black")}
              data={[
                { label: t("Common.WHITE"), value: "white" },
                { label: t("Common.BLACK"), value: "black" },
              ]}
            />
          </div>

          <Button type="submit">{t("Common.Create")}</Button>
        </Stack>
      </form>
    </AppModal>
  );
}
