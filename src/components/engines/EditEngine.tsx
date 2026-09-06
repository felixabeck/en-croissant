import { useForm } from "@mantine/form";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { enginesAtom } from "@/state/atoms";
import { replaceEngineById } from "@/utils/engineAttachments";
import type { LocalEngine } from "@/utils/engines";
import EngineForm from "./EngineForm";

export default function EditEngine({ initialEngine }: { initialEngine: LocalEngine }) {
  const { t } = useTranslation();

  const [engines, setEngines] = useAtom(enginesAtom);
  const form = useForm<LocalEngine>({
    initialValues: initialEngine,

    validate: {
      name: (value) => {
        if (!value) return "Name is required";
        if ((engines ?? []).find((e) => e.name === value && e !== initialEngine))
          return "Name already used";
      },
      filename: (value) => {
        if (!value) return "Path is required";
      },
    },
  });

  return (
    <EngineForm
      submitLabel={t("Common.Save")}
      form={form}
      onSubmit={async (values) => {
        return setEngines((prev) => replaceEngineById(prev, initialEngine.id, values));
      }}
    />
  );
}
