import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const fixtures = vi.hoisted(() => ({
  saveToFile: vi.fn(),
  currentTab: Symbol("current-tab"),
}));

vi.mock("@/state/atoms", () => ({ currentTabAtom: fixtures.currentTab }));
vi.mock("jotai", () => ({ useAtom: () => [undefined, vi.fn()] }));
vi.mock("@/utils/tabs", () => ({ saveToFile: fixtures.saveToFile }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@mantine/core", () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  Group: ({ children }: any) => <div>{children}</div>,
  Modal: ({ opened, children }: any) => (opened ? <div role="dialog">{children}</div> : null),
  Stack: ({ children }: any) => <div>{children}</div>,
  Text: ({ children, ...props }: any) => <p {...props}>{children}</p>,
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let host: HTMLDivElement;
let root: Root;

const backgroundTab = {
  name: "Background",
  value: "background",
  type: "analysis" as const,
  gameOrigin: { kind: "none" as const },
};

beforeEach(() => {
  vi.clearAllMocks();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

test("a successful background save targets the pending tab before closing it", async () => {
  fixtures.saveToFile.mockImplementation(async ({ setCurrentTab }: any) => {
    setCurrentTab((tab: typeof backgroundTab) => ({ ...tab, name: "Saved background" }));
    return "saved";
  });
  const updateTab = vi.fn();
  const onSaved = vi.fn();
  const ConfirmChangesModal = (await import("./ConfirmChangesModal")).default;
  await act(async () =>
    root.render(
      <ConfirmChangesModal
        pendingClose={{ tabId: "background", store: {} as any }}
        tab={backgroundTab}
        updateTab={updateTab}
        onCancel={vi.fn()}
        onDiscard={vi.fn()}
        onSaved={onSaved}
      />,
    ),
  );

  await act(async () =>
    [...host.querySelectorAll("button")]
      .find((button) => button.textContent === "Tab.SaveAndClose")!
      .click(),
  );

  expect(updateTab).toHaveBeenCalledWith("background", expect.any(Function));
  expect(onSaved).toHaveBeenCalledOnce();
});

test("a failed save keeps the pending close open", async () => {
  fixtures.saveToFile.mockResolvedValue("failed");
  const onSaved = vi.fn();
  const ConfirmChangesModal = (await import("./ConfirmChangesModal")).default;
  await act(async () =>
    root.render(
      <ConfirmChangesModal
        pendingClose={{ tabId: "background", store: {} as any }}
        tab={backgroundTab}
        updateTab={vi.fn()}
        onCancel={vi.fn()}
        onDiscard={vi.fn()}
        onSaved={onSaved}
      />,
    ),
  );

  await act(async () =>
    [...host.querySelectorAll("button")]
      .find((button) => button.textContent === "Tab.SaveAndClose")!
      .click(),
  );

  expect(onSaved).not.toHaveBeenCalled();
  expect(host.querySelector('[role="dialog"]')?.textContent).toContain("Tab.SaveFailed");
});
