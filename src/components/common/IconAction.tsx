import {
  ActionIcon,
  Loader,
  Tooltip,
  type ActionIconProps,
  type ElementProps,
} from "@mantine/core";
import { forwardRef, type ReactElement } from "react";

type IconActionProps = Omit<
  ActionIconProps & ElementProps<"button", keyof ActionIconProps>,
  "aria-label" | "children" | "loading"
> & {
  /** Localized accessible name and tooltip text. */
  label: string;
  /** The icon. An element, never text: the button is icon-sized and clips a word. */
  children: ReactElement;
  pending?: boolean;
  pressed?: boolean;
};

/**
 * The only icon-only action primitive. It keeps the accessible name, keyboard
 * behaviour, pressed state, pending state, and visible tooltip in sync.
 */
export const IconAction = forwardRef<HTMLButtonElement, IconActionProps>(function IconAction(
  { label, children, pending = false, pressed, disabled, ...props },
  ref,
) {
  const unavailable = disabled || pending;
  const action = (
    <ActionIcon
      {...props}
      ref={ref}
      aria-label={label}
      aria-busy={pending || undefined}
      aria-pressed={pressed}
      disabled={unavailable}
    >
      {pending ? <Loader size="1em" aria-hidden /> : children}
    </ActionIcon>
  );

  return (
    <Tooltip label={label} withinPortal>
      {unavailable ? <span>{action}</span> : action}
    </Tooltip>
  );
});

export default IconAction;
