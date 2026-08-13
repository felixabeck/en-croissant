import { Button, Group, Stack, Text } from "@mantine/core";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { normalizeError } from "@/platform/errors";
import AppModal from "./AppModal";

export function confirmationErrorMessage(
  cause: unknown,
  t: (key: string, options?: { defaultValue: string }) => string,
) {
  const { category } = normalizeError(cause);
  return t(`Common.ConfirmationError.${category}`, {
    defaultValue: "The action could not be completed. Please try again.",
  });
}

function ConfirmModal({
  title,
  description,
  opened,
  onClose,
  onConfirm,
  confirmLabel,
}: {
  title: string;
  description: string;
  opened: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  confirmLabel?: string;
}) {
  const { t } = useTranslation();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const confirmInFlight = useRef(false);
  async function confirm() {
    if (confirmInFlight.current) return;
    confirmInFlight.current = true;
    setPending(true);
    setError("");
    try {
      await onConfirm();
      onClose();
    } catch (cause) {
      setError(confirmationErrorMessage(cause, t));
    } finally {
      confirmInFlight.current = false;
      setPending(false);
    }
  }

  return (
    <AppModal
      withCloseButton={false}
      opened={opened}
      onClose={onClose}
      title={title}
      pending={pending}
    >
      <Stack>
        <div>
          <Text>{description}</Text>
          <Text>{t("Common.CannotUndo")}</Text>
          {error && (
            <Text c="red" role="alert">
              {error}
            </Text>
          )}
        </div>

        <Group justify="right">
          <Button variant="default" disabled={pending} onClick={() => onClose()}>
            {t("Common.Cancel")}
          </Button>
          <Button color="red" loading={pending} onClick={confirm}>
            {confirmLabel || t("Common.Delete")}
          </Button>
        </Group>
      </Stack>
    </AppModal>
  );
}

export default ConfirmModal;
