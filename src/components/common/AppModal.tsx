import { Modal, type ModalProps } from "@mantine/core";
import { useTranslation } from "react-i18next";

type AppModalProps = Omit<
  ModalProps,
  "closeButtonProps" | "closeOnClickOutside" | "closeOnEscape"
> & {
  pending?: boolean;
};

/** Shared dialog contract: every close button is named and pending work cannot be dismissed. */
export function AppModal({ pending = false, ...props }: AppModalProps) {
  const { t } = useTranslation();
  return (
    <Modal
      {...props}
      withCloseButton={pending ? false : props.withCloseButton}
      closeButtonProps={{ "aria-label": t("Common.Close", { defaultValue: "Close dialog" }) }}
      closeOnClickOutside={!pending}
      closeOnEscape={!pending}
    />
  );
}

export default AppModal;
