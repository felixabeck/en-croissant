import { tauri } from "@/platform/tauri";
import { Button, Input, NumberInput, Text, TextInput } from "@mantine/core";
import type { UseFormReturnType } from "@mantine/form";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { type UciOptionConfig } from "@/bindings";
import { runUnlessCancelled } from "@/components/files/notifyError";
import { type LocalEngine, requiredEngineSettings } from "@/utils/engines";
import FileInput from "../common/FileInput";

export default function EngineForm({
  onSubmit,
  form,
  submitLabel,
}: {
  onSubmit: (values: LocalEngine) => void;
  form: UseFormReturnType<LocalEngine>;
  submitLabel: string;
}) {
  const { t } = useTranslation();

  const config = useRef<{ name: string; options: UciOptionConfig[] } | null>(null);
  const pickerGeneration = useRef(0);
  const settings = config.current?.options
    .filter((o) => requiredEngineSettings.includes(o.value.name))
    .filter((o) => o.type !== "button")
    .map((o) => ({
      type: "string" as const,
      name: o.value.name,
      value: String(o.value.default ?? ""),
    }));

  return (
    <form
      onSubmit={form.onSubmit(async (values) =>
        onSubmit({ ...values, loaded: true, settings: settings || [] }),
      )}
    >
      <FileInput
        label={t("Engines.Add.BinaryFile")}
        description={t("Engines.Add.BinaryFile.Desc")}
        filename={form.values.filename}
        withAsterisk
        onClick={() => {
          const generation = ++pickerGeneration.current;
          void runUnlessCancelled(t("Common.Error"), async () => {
            const handle = await tauri.issueEngineBinary();
            if (generation !== pickerGeneration.current) return handle;
            form.setFieldValue("handle", handle);
            config.current = await tauri.getEngineConfig(handle);
            if (generation !== pickerGeneration.current) return handle;
            form.setFieldValue("filename", config.current.name || "Engine");
            form.setFieldValue("name", config.current.name);
            return handle;
          });
        }}
      />

      <TextInput
        label={t("Engines.Add.Name")}
        placeholder={t("Engines.Add.Name.Autodetect")}
        withAsterisk
        {...form.getInputProps("name")}
      />

      <NumberInput
        label={t("Engines.Add.Elo")}
        placeholder={t("Engines.Add.Elo.Desc")}
        {...form.getInputProps("elo")}
      />

      <Input.Wrapper
        label={t("Engines.Add.ImageFile")}
        description={t("Engines.Add.ImageFile.Desc")}
      >
        <Input
          component="button"
          type="button"
          onClick={() => {
            const generation = ++pickerGeneration.current;
            void runUnlessCancelled(t("Common.Error"), async () => {
              const imageHandle = await tauri.issueEngineImage();
              if (generation !== pickerGeneration.current) return imageHandle;
              form.setFieldValue("imageHandle", imageHandle);
              return imageHandle;
            });
          }}
        >
          <Text lineClamp={1} c={form.values.imageHandle ? undefined : "dimmed"}>
            {form.values.imageHandle ? t("Engines.Add.ImageFile") : t("Common.Select")}
          </Text>
        </Input>
      </Input.Wrapper>

      <Button fullWidth mt="xl" type="submit">
        {submitLabel}
      </Button>
    </form>
  );
}
