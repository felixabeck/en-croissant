import { Box, Button, Group, Progress } from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import { memo, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useProgress } from "@/hooks/useProgress";
import IconAction from "./IconAction";
import classes from "./ProgressButton.module.css";

type Props = {
  id: string;
  initInstalled: boolean;
  onClick: (id: string) => void;
  onCancel?: () => void;
  leftIcon?: React.ReactNode;
  labels: {
    completed: string;
    action: string;
    inProgress: string;
    finalizing?: string;
  };
  disabled?: boolean;
  redoable?: boolean;
  /** When false, a succeeded progress job is not treated as the completed action. Default true. */
  completeOnProgressSuccess?: boolean;
  inProgress: boolean;
  setInProgress: (inProgress: boolean) => void;
};

function ProgressButton({
  id,
  initInstalled,
  onClick,
  onCancel,
  leftIcon,
  labels,
  disabled,
  redoable,
  completeOnProgressSuccess = true,
  inProgress,
  setInProgress,
}: Props) {
  const { t } = useTranslation();
  const { progress, finished, isActive, clear, item } = useProgress(id);
  const completed = initInstalled || (completeOnProgressSuccess && item?.state === "succeeded");

  const showProgress = isActive || inProgress;

  useEffect(() => {
    if (completeOnProgressSuccess && finished) {
      setInProgress(false);
    }
  }, [completeOnProgressSuccess, finished, setInProgress]);

  const handleCancel = useCallback(async () => {
    if (onCancel) {
      onCancel();
    }
    try {
      await clear();
      setInProgress(false);
    } catch {
      // Keep the running UI if native cancellation could not be acknowledged.
    }
  }, [onCancel, clear, setInProgress]);

  let label: string;
  if (completed) {
    label = labels.completed;
  } else if (!showProgress) {
    label = labels.action;
  } else if (progress === 100) {
    label = labels.finalizing ?? labels.inProgress;
  } else {
    label = labels.inProgress;
  }

  return (
    <Group gap="xs" wrap="nowrap">
      <Button
        fullWidth
        onClick={() => {
          onClick(id);
        }}
        disabled={showProgress || (completed && !redoable) || disabled}
        leftSection={<Box className={classes.label}>{leftIcon}</Box>}
        autoContrast
      >
        <span className={classes.label}>{label}</span>
        {!completed && progress !== 0 && (
          <Progress
            pos="absolute"
            h="100%"
            value={progress}
            className={classes.progress}
            radius="sm"
          />
        )}
      </Button>
      {showProgress && onCancel && (
        <IconAction
          label={t("Common.Cancel", { defaultValue: "Cancel" })}
          variant="default"
          size="lg"
          onClick={() => void handleCancel()}
        >
          <IconX size="1rem" />
        </IconAction>
      )}
    </Group>
  );
}

export default memo(ProgressButton);
