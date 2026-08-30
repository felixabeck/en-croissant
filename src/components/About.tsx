import { Anchor, Text } from "@mantine/core";
import AppModal from "./common/AppModal";
import { getTauriVersion, getVersion } from "@/platform/native";
import { arch, osType, OSVersion } from "@/platform/native";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

function AboutModal({
  opened,
  setOpened,
}: {
  opened: boolean;
  setOpened: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const { t } = useTranslation();
  const [info, setInfo] = useState<{
    version: string;
    tauri: string;
    os: string;
    architecture: string;
    osVersion: string;
  } | null>(null);

  useEffect(() => {
    async function load() {
      const os = await osType();
      const version = await getVersion();
      const tauri = await getTauriVersion();
      const architecture = await arch();
      const osVersion = await OSVersion();
      setInfo({ version, tauri, os, architecture, osVersion });
    }
    load();
  }, []);
  return (
    <AppModal centered opened={opened} onClose={() => setOpened(false)} title="En Croissant">
      <Text>
        {t("Common.Version")}: {info?.version}
      </Text>
      <Text>
        {t("About.TauriVersion")}: {info?.tauri}
      </Text>
      <Text>
        {t("About.OperatingSystem")}: {info?.os} {info?.architecture} {info?.osVersion}
      </Text>

      <Text size="xs" c="dimmed">
        {t("About.ModificationNotice", { date: "2026-08-09" })}
      </Text>

      <br />

      <Anchor href="https://www.encroissant.org" target="_blank" rel="noreferrer">
        www.encroissant.org
      </Anchor>
    </AppModal>
  );
}

export default AboutModal;
