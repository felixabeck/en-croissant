import { Stack, Text, UnstyledButton } from "@mantine/core";
import cx from "clsx";
import type { ReactNode } from "react";
import classes from "./GenericCard.module.css";

type Props<T> = {
  id: T;
  isSelected: boolean;
  setSelected: (id: T) => void;
  error?: string;
  stats?: {
    label: string;
    value: string;
  }[];
  Header: ReactNode;
  onDoubleClick?: () => void;
  tabIndex?: number;
  footer?: ReactNode;
  /** Places the footer beside the selection instead of below it. */
  orientation?: "vertical" | "horizontal";
  className?: string;
};

export default function GenericCard<T>({
  id,
  isSelected,
  setSelected,
  error,
  stats,
  Header,
  onDoubleClick,
  tabIndex,
  footer,
  orientation = "vertical",
  className,
}: Props<T>) {
  const cardClasses = cx(classes.card, className, {
    [classes.horizontal]: orientation === "horizontal",
    [classes.selected]: isSelected,
    [classes.error]: !!error,
  });
  const selection = (
    <UnstyledButton
      type="button"
      tabIndex={tabIndex}
      aria-pressed={isSelected}
      className={footer ? classes.selection : cardClasses}
      onClick={() => setSelected(id)}
      onDoubleClick={onDoubleClick}
    >
      <Stack h="100%" justify="space-between">
        {Header}

        {stats && (
          <div className={classes.info}>
            {stats.map((stat) => (
              <div key={stat.label}>
                <Text c="dimmed" fw="bold" className={classes.label}>
                  {stat.label}
                </Text>
                <Text fw={700}>{stat.value}</Text>
              </div>
            ))}
          </div>
        )}
      </Stack>
    </UnstyledButton>
  );
  return footer ? (
    <div
      className={cardClasses}
      onClick={(event) => {
        if (event.target === event.currentTarget) setSelected(id);
      }}
      onDoubleClick={(event) => {
        if (event.target === event.currentTarget) onDoubleClick?.();
      }}
    >
      {selection}
      <div className={classes.footer}>{footer}</div>
    </div>
  ) : (
    selection
  );
}
