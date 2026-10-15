import { tauri } from "@/platform/tauri";
import { Button, Input, NumberInput, Text, TextInput } from "@mantine/core";
import type { UseFormReturnType } from "@mantine/form";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { notifyUnlessCancelled } from "@/components/files/notifyError";
import { type LocalEngine, requiredEngineSettingsDefaults } from "@/utils/engines";
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

  const operation = useRef({ active: true, busy: false });
  const [busy, setBusy] = useState(false);
  const attachmentDraft = useRef(new EngineAttachmentDraft());
  useEffect(() => {
    const draft = new EngineAttachmentDraft();
    const owner = { active: true, busy: false };
    operation.current = owner;
    setBusy(false);
    attachmentDraft.current = draft;
    return () => {
      owner.active = false;
      void draft.close().catch((error) => notifyUnlessCancelled(errorTitle, error));
    };
  }, [errorTitle]);

  async function runOwned(
    run: (owner: { active: boolean; busy: boolean }, draft: EngineAttachmentDraft) => Promise<void>,
    reportAfterClose = false,
  ) {
    const owner = operation.current;
    if (!owner.active || owner.busy) return;
    owner.busy = true;
    setBusy(true);
    try {
      await run(owner, attachmentDraft.current);
    } catch (error) {
      if (owner.active || reportAfterClose) notifyUnlessCancelled(errorTitle, error);
    } finally {
      owner.busy = false;
      if (owner.active) setBusy(false);
    }
  }

  return (
    <form
      onSubmit={form.onSubmit((values) =>
        runOwned(async (owner, draft) => {
          const submittedAttachments = draft.submission();
          const receipt = await onSubmit({ ...values, loaded: true });
          if (receipt) {
            await draft.adopt(receipt, submittedAttachments);
            if (receipt.saved && owner.active) await onSaved?.(receipt);
          }
        }, true),
      )}
    >
      <FileInput
        label={t("Engines.Add.BinaryFile")}
        description={t("Engines.Add.BinaryFile.Desc")}
        filename={form.values.filename}
        error={form.errors?.filename}
        withAsterisk
        disabled={busy}
        onClick={() => {
          void runOwned(async (owner) => {
            const handle = await tauri.issueEngineBinary();
            if (!owner.active) return;
            const config = await tauri.getEngineConfig(handle);
            if (!owner.active) return;
            const settings = requiredEngineSettingsDefaults(config);
            form.setValues({
              handle,
              filename: config.name || "Engine",
              name: config.name,
              settings,
            });
          });
        }}
      />

      <TextInput
        label={t("Engines.Add.Name")}
        placeholder={t("Engines.Add.Name.Autodetect")}
        withAsterisk
        {...form.getInputProps("name")}
        disabled={busy}
      />

      <NumberInput
        label={t("Engines.Add.Elo")}
        placeholder={t("Engines.Add.Elo.Desc")}
        {...form.getInputProps("elo")}
        disabled={busy}
      />

      <Input.Wrapper
        label={t("Engines.Add.ImageFile")}
        description={t("Engines.Add.ImageFile.Desc")}
      >
        <Input
          component="button"
          type="button"
          disabled={busy}
          onClick={() => {
            void runOwned(async (owner, draft) => {
              await draft.issue(
                "image",
                () => tauri.issueEngineImage(),
                (imageHandle, isCurrent) => {
                  if (owner.active && isCurrent()) form.setFieldValue("imageHandle", imageHandle);
                },
              );
            });
          }}
        >
          <Text lineClamp={1} c={form.values.imageHandle ? undefined : "dimmed"}>
            {form.values.imageHandle ? t("Engines.Add.ImageFile") : t("Common.Select")}
          </Text>
        </Input>
      </Input.Wrapper>

      <Button fullWidth mt="xl" type="submit" disabled={busy}>
        {submitLabel}
      </Button>
    </form>
  );
}
