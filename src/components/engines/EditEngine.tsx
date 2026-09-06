import { useForm } from "@mantine/form";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { enginesAtom } from "@/state/atoms";
import { replaceEngineById } from "./engineAttachments";
import type { LocalEngine } from "@/utils/engines";
import EngineForm from "./EngineForm";
import { createEngineFormValidation } from "./engineFormValidation";

export default function EditEngine({ initialEngine }: { initialEngine: LocalEngine }) {
  const { t } = useTranslation();

  const [engines, setEngines] = useAtom(enginesAtom);
  const form = useForm<LocalEngine>({
    initialValues: initialEngine,

    validate: createEngineFormValidation(engines ?? [], t, initialEngine.id),
  });

  return (
    <EngineForm
      submitLabel={t("Common.Save")}
      form={form}
      onSubmit={async (values) => {
        let targetPresent = false;
        const receipt = await setEngines((prev) => {
          targetPresent = prev.some((engine) => engine.id === initialEngine.id);
          return targetPresent ? replaceEngineById(prev, initialEngine.id, values) : prev;
        });
        return targetPresent ? receipt : { ...receipt, saved: false, synchronized: false };
      }}
    />
  );
}
