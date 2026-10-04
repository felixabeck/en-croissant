import { tauri } from "@/platform/tauri";
import { IconFolder } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { IconAction } from "./IconAction";
import { runUnlessCancelled } from "@/components/files/notifyError";

/** Opens the native-owned engine workspace; renderer code never receives a path. */
function OpenFolderButton() {
  const { t } = useTranslation();

  async function openEngineWorkspace() {
    await runUnlessCancelled(
      t("Common.Error"),
      async () => {
        await tauri.openEngineWorkspace(await tauri.getEngineWorkspace());
      },
      "engine",
    );
  }
  return (
    <IconAction label={t("Common.OpenFolder")} onClick={() => openEngineWorkspace()}>
      <IconFolder size="1.5rem" />
    </IconAction>
  );
}

export default OpenFolderButton;
