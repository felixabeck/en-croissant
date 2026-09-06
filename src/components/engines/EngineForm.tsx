import { tauri } from "@/platform/tauri";
import { Button, Input, NumberInput, Text, TextInput } from "@mantine/core";
import type { UseFormReturnType } from "@mantine/form";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { notifyUnlessCancelled, runUnlessCancelled } from "@/components/files/notifyError";
import { type LocalEngine, requiredEngineSettings } from "@/utils/engines";
import { EngineAttachmentDraft } from "./engineAttachments";
import type { EngineOwnerSaveReceipt } from "@/state/engineOwnerStorage";
import FileInput from "../common/FileInput";

export default function EngineForm({
  onSubmit,
  onSaved,
  form,
  submitLabel,
}: {
  onSubmit: (
    values: LocalEngine,
  ) => EngineOwnerSaveReceipt | void | Promise<EngineOwnerSaveReceipt | void>;
  onSaved?: (receipt: EngineOwnerSaveReceipt) => void | Promise<void>;
  form: UseFormReturnType<LocalEngine>;
  submitLabel: string;
}) {
  const { t } = useTranslation();
  const errorTitle = t("Common.Error");

  const pickerGeneration = useRef({ value: 0 });
  const attachmentDraft = useRef(new EngineAttachmentDraft());
  useEffect(() => {
    const draft = new EngineAttachmentDraft();
    const pickerState = pickerGeneration.current;
    attachmentDraft.current = draft;
    return () => {
      pickerState.value++;
      void draft.close().catch((error) => notifyUnlessCancelled(errorTitle, error));
    };
  }, [errorTitle]);

  return (
    <form
      onSubmit={form.onSubmit(async (values) => {
        const submittedAttachments = attachmentDraft.current.submission();
        const receipt = await onSubmit({ ...values, loaded: true });
        if (receipt) {
          await attachmentDraft.current.adopt(receipt, submittedAttachments);
          if (receipt.saved) await onSaved?.(receipt);
        }
      })}
    >
      <FileInput
        label={t("Engines.Add.BinaryFile")}
        description={t("Engines.Add.BinaryFile.Desc")}
        filename={form.values.filename}
        error={form.errors?.filename}
        withAsterisk
        onClick={() => {
          const generation = ++pickerGeneration.current.value;
          void runUnlessCancelled(errorTitle, async () => {
            const handle = await tauri.issueEngineBinary();
            if (generation !== pickerGeneration.current.value) return handle;
            form.setFieldValue("handle", handle);
            const config = await tauri.getEngineConfig(handle);
            if (generation !== pickerGeneration.current.value) return handle;
            const settings = config.options
              .filter((option) => requiredEngineSettings.includes(option.value.name))
              .filter((option) => option.type !== "button")
              .map((option) => ({
                type: "string" as const,
                name: option.value.name,
                value: String(option.value.default ?? ""),
              }));
            form.setFieldValue("filename", config.name || "Engine");
            form.setFieldValue("name", config.name);
            form.setFieldValue("settings", settings);
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
            void runUnlessCancelled(errorTitle, async () => {
              return attachmentDraft.current.issue(
                "image",
                () => tauri.issueEngineImage(),
                (imageHandle) => form.setFieldValue("imageHandle", imageHandle),
              );
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
