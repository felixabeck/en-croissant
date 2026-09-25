import { Button, Group } from "@mantine/core";
import { useCallback, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { tabStorage } from "@/state/store/tabStorage";
import { discardTreeStoreStorage, retryTreeStoreStorage } from "@/state/store/tree";
import classes from "./TreeRecoveryGate.module.css";

type Props = {
  tabId: string;
  children: React.ReactNode;
};

export default function TreeRecoveryGate({ tabId, children }: Props) {
  const { t } = useTranslation();
  const subscribe = useCallback(
    (listener: () => void) => tabStorage.subscribeStatus(tabId, listener),
    [tabId],
  );
  const getSnapshot = useCallback(() => tabStorage.getStatus(tabId), [tabId]);
  const status = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const [pending, setPending] = useState<"copy" | "discard" | "retry" | null>(null);
  const [actionError, setActionError] = useState<"copy" | "storage" | "retry" | null>(null);
  const [copied, setCopied] = useState(false);

  const copySavedValue = async () => {
    setPending("copy");
    setActionError(null);
    setCopied(false);
    try {
      const rawValue = tabStorage.readRawValueForRecovery(tabId);
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard access is unavailable.");
      await navigator.clipboard.writeText(rawValue);
      setCopied(true);
    } catch {
      setActionError("copy");
    } finally {
      setPending(null);
    }
  };

  const discardSavedValue = () => {
    setPending("discard");
    setActionError(null);
    try {
      if (!discardTreeStoreStorage(tabId)) throw new Error("The saved value was not discarded.");
      setCopied(false);
    } catch {
      setActionError("storage");
    } finally {
      setPending(null);
    }
  };

  const retryRead = async () => {
    setPending("retry");
    setActionError(null);
    try {
      const recovered = await retryTreeStoreStorage(tabId);
      if (!recovered || recovered.kind === "not-read" || recovered.kind === "unavailable") {
        setActionError("retry");
      }
    } catch {
      setActionError("retry");
    } finally {
      setPending(null);
    }
  };

  if ((status.kind === "available" || status.kind === "absent") && pending !== "retry")
    return <>{children}</>;

  const unreadable = status.kind === "unreadable";
  const errorMessage =
    actionError === "copy"
      ? t("TreeRecovery.CopyFailed")
      : actionError === "storage"
        ? t("TreeRecovery.DiscardFailed")
        : actionError === "retry"
          ? t("TreeRecovery.RetryFailed")
          : null;

  return (
    <section
      className={classes.panel}
      data-tree-recovery={unreadable ? "unreadable" : "unavailable"}
      aria-labelledby="tree-recovery-title"
      aria-live="polite"
      role="alert"
    >
      <h2 id="tree-recovery-title">
        {unreadable ? t("TreeRecovery.UnreadableTitle") : t("TreeRecovery.UnavailableTitle")}
      </h2>
      <p>
        {unreadable ? t("TreeRecovery.UnreadableMessage") : t("TreeRecovery.UnavailableMessage")}
      </p>
      {errorMessage && <p className={classes.error}>{errorMessage}</p>}
      {copied && <p>{t("TreeRecovery.Copied")}</p>}
      <Group justify="center" gap="sm">
        {unreadable ? (
          <>
            <Button
              variant="default"
              onClick={() => void copySavedValue()}
              disabled={pending !== null}
            >
              {t("TreeRecovery.CopyValue")}
            </Button>
            <Button
              className={classes.discardButton}
              variant="default"
              onClick={discardSavedValue}
              disabled={pending !== null}
            >
              {t("TreeRecovery.DiscardValue")}
            </Button>
          </>
        ) : (
          <Button onClick={() => void retryRead()} disabled={pending !== null}>
            {pending === "retry" ? t("TreeRecovery.Retrying") : t("TreeRecovery.Retry")}
          </Button>
        )}
      </Group>
    </section>
  );
}
