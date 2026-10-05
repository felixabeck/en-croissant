import { act, type ComponentProps } from "react";
import { expect, vi } from "vitest";
import type { ProgressEvent } from "@/bindings";
import type ProgressButton from "@/components/common/ProgressButton";

type ProgressButtonProps = ComponentProps<typeof ProgressButton>;
type CapturedProps = Omit<ProgressButtonProps, "onClick"> & { onClick: () => void };

export function createProgressButtonTestHarness() {
  const harness = {
    clearProgress: vi.fn(),
    cancelDownload: vi.fn(),
    cancelDownloadForProgress: vi.fn(),
    getProgress: vi.fn(),
    realProgressButton: false,
    progressButtonProps: null as CapturedProps | null,
    progressListener: undefined as ((event: { payload: ProgressEvent }) => void) | undefined,
    subscribeProgress: async (listener: (event: { payload: ProgressEvent }) => void) => {
      harness.progressListener = listener;
      return () => {
        harness.progressListener = undefined;
      };
    },
  };
  return harness;
}

type Harness = ReturnType<typeof createProgressButtonTestHarness>;

export function mockProgressButton(
  harness: Harness,
  actual: { default: typeof ProgressButton },
  label?: string,
) {
  return {
    default: (props: ProgressButtonProps) => {
      harness.progressButtonProps = { ...props, onClick: () => props.onClick(props.id) };
      if (harness.realProgressButton) return <actual.default {...props} />;
      return (
        <button type="button" onClick={() => props.onClick(props.id)}>
          {label ?? props.labels.action}
        </button>
      );
    },
  };
}

export function resetProgressButtonTestHarness(harness: Harness) {
  harness.progressButtonProps = null;
  harness.realProgressButton = false;
  harness.progressListener = undefined;
  harness.getProgress.mockReset().mockResolvedValue(null);
  harness.cancelDownloadForProgress.mockReset().mockResolvedValue(true);
  harness.clearProgress.mockResolvedValue(1n);
  harness.cancelDownload.mockResolvedValue(true);
}

export async function reportRunningProgress(harness: Harness, id: string, progress = 45) {
  await act(async () =>
    harness.progressListener!({
      payload: {
        id,
        generation: 7n,
        progress,
        finished: false,
        state: "running",
        cleared: false,
      },
    }),
  );
}

export async function clickProgressCancel(host: HTMLElement) {
  const cancel = [...host.querySelectorAll("button")].find(
    (button) => button.textContent === "Common.Cancel",
  );
  expect(cancel).toBeDefined();
  await act(async () => cancel!.click());
}

export async function expectRestoredDownloadCancellation(
  harness: Harness,
  host: HTMLElement,
  id: string,
) {
  expect(host.textContent).not.toContain("Common.Cancel");
  await reportRunningProgress(harness, id);
  expect(harness.progressButtonProps?.inProgress).toBe(false);
  expect(host.querySelector("[data-progress]")?.textContent).toBe("45");
  await clickProgressCancel(host);
  expect(harness.cancelDownloadForProgress).toHaveBeenCalledExactlyOnceWith(id);
  expect(harness.cancelDownload).not.toHaveBeenCalled();
  expect(harness.clearProgress).not.toHaveBeenCalled();
  expect(host.querySelector("[data-progress]")).toBeNull();
  expect(host.textContent).not.toContain("Common.Cancel");
}
