import { tauri } from "@/platform/tauri";
import { IconFolder } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { IconAction } from "./IconAction";

/** Opens the native-owned engine workspace; renderer code never receives a path. */
function OpenFolderButton() {
  const { t } = useTranslation();

  async function openEngineWorkspace() {
    await tauri.openEngineWorkspace(await tauri.getEngineWorkspace());
  }
  return (
    <IconAction label={t("Common.OpenFolder")} onClick={() => openEngineWorkspace()}>
      <IconFolder size="1.5rem" />
    </IconAction>
  );
}

export default OpenFolderButton;
