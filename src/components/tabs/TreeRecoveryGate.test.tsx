import { act, useContext } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { TreeStateContext, TreeStateProvider } from "@/components/common/TreeStateContext";
import { tabStorage } from "@/state/store/tabStorage";
import { closeTreeStore, createTreeStore, type TreeStore } from "@/state/store/tree";
import { defaultTree } from "@/utils/treeReducer";
import TreeRecoveryGate from "./TreeRecoveryGate";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

vi.mock("@mantine/core", () => ({
  Button: ({ children, disabled, onClick }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
  Group: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const tabId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const rawValue = '  {"tree":"broken 🧩"}\n\u0000';

let host: HTMLDivElement;
let root: Root;
let capturedStore: TreeStore | null;
let clipboardWrite: ReturnType<typeof vi.fn>;
let previousClipboard: PropertyDescriptor | undefined;

function CaptureStore() {
  capturedStore = useContext(TreeStateContext);
  return null;
}

function renderGate() {
  return act(async () =>
    root.render(
      <TreeStateProvider id={tabId}>
        <TreeRecoveryGate tabId={tabId}>
          <div data-testid="board-child">The editable board</div>
        </TreeRecoveryGate>
        <CaptureStore />
      </TreeStateProvider>,
    ),
  );
}

function refuseInitialRead({ always = false }: { always?: boolean } = {}) {
  const original = Storage.prototype.getItem;
  let refused = false;
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, key) {
    if (key === tabId && (always || !refused)) {
      refused = true;
      throw new DOMException("storage read refused", "SecurityError");
    }
    return original.call(this, key);
  });
}

async function retry() {
  const button = Array.from(host.querySelectorAll("button")).find((candidate) =>
    candidate.textContent?.includes("TreeRecovery.Retry"),
  );
  if (!button) throw new Error("Missing retry button");
  await act(async () => {
    button.click();
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  tabStorage.remove(tabId);
  closeTreeStore(tabId);
  sessionStorage.clear();
  capturedStore = null;
  previousClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  clipboardWrite = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: clipboardWrite },
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  tabStorage.remove(tabId);
  closeTreeStore(tabId);
  if (previousClipboard) Object.defineProperty(navigator, "clipboard", previousClipboard);
  else Reflect.deleteProperty(navigator, "clipboard");
});

const retryOutcomes = [
  { name: "a valid tree", outcome: "available" },
  { name: "an absent key", outcome: "absent" },
  { name: "present undecodable bytes", outcome: "unreadable" },
] as const;

test.each(retryOutcomes)(
  "retries $name through the same cached tree store",
  async ({ outcome }) => {
    let savedTree: ReturnType<typeof defaultTree> | undefined;
    if (outcome === "available") {
      savedTree = defaultTree();
      savedTree.headers.event = "Recovered from storage";
      savedTree.headers.white = "Saved player";
      tabStorage.seed(tabId, savedTree);
    } else if (outcome === "unreadable") {
      sessionStorage.setItem(tabId, rawValue);
    }
    refuseInitialRead();
    await renderGate();

    const cachedStore = capturedStore;
    expect(cachedStore).not.toBeNull();
    expect(tabStorage.getStatus(tabId).kind).toBe("unavailable");
    expect(host.querySelector('[data-tree-recovery="unavailable"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="board-child"]')).toBeNull();
    expect(host.textContent).not.toContain("TreeRecovery.DiscardValue");

    await retry();

    expect(createTreeStore(tabId)).toBe(cachedStore);
    expect(capturedStore).toBe(cachedStore);
    expect(tabStorage.getStatus(tabId).kind).toBe(outcome);
    expect(host.querySelector('[data-tree-recovery="unreadable"]') !== null).toBe(
      outcome === "unreadable",
    );
    expect(host.querySelector('[data-testid="board-child"]') !== null).toBe(
      outcome !== "unreadable",
    );
    expect(outcome === "unreadable" ? tabStorage.readRawValueForRecovery(tabId) : null).toBe(
      outcome === "unreadable" ? rawValue : null,
    );
    expect(cachedStore!.getState().headers.event).toBe(
      outcome === "available" ? "Recovered from storage" : defaultTree().headers.event,
    );
    expect(cachedStore!.getState().headers.white).toBe(
      outcome === "available" ? "Saved player" : defaultTree().headers.white,
    );
    expect(cachedStore!.getState().root.fen).toBe(defaultTree().root.fen);
    if (outcome === "absent") cachedStore!.getState().setComment("The absent key is editable");
    expect(cachedStore!.getState().root.comment).toBe(
      outcome === "absent" ? "The absent key is editable" : defaultTree().root.comment,
    );
    expect(cachedStore!.getState().dirty).toBe(outcome === "absent");
  },
);

test("keeps an unavailable tab gated after retry continues to refuse reads", async () => {
  sessionStorage.setItem(tabId, rawValue);
  refuseInitialRead({ always: true });
  await renderGate();
  const cachedStore = capturedStore;

  await retry();

  expect(capturedStore).toBe(cachedStore);
  expect(tabStorage.getStatus(tabId).kind).toBe("unavailable");
  expect(host.querySelector('[data-tree-recovery="unavailable"]')).not.toBeNull();
  expect(host.querySelector('[data-testid="board-child"]')).toBeNull();
  expect(host.textContent).toContain("TreeRecovery.RetryFailed");
  expect(host.textContent).not.toContain("TreeRecovery.DiscardValue");
});

test("copies the exact undecodable value and reports clipboard failure", async () => {
  sessionStorage.setItem(tabId, rawValue);
  tabStorage.readTree(tabId);
  await renderGate();

  const copyButton = Array.from(host.querySelectorAll("button")).find((candidate) =>
    candidate.textContent?.includes("TreeRecovery.CopyValue"),
  );
  if (!copyButton) throw new Error("Missing copy button");
  await act(async () => {
    copyButton.click();
    await Promise.resolve();
  });
  expect(clipboardWrite).toHaveBeenCalledWith(rawValue);
  expect(host.textContent).toContain("TreeRecovery.Copied");

  clipboardWrite.mockRejectedValueOnce(new Error("clipboard refused"));
  await act(async () => {
    copyButton.click();
    await Promise.resolve();
  });
  expect(host.textContent).toContain("TreeRecovery.CopyFailed");
  expect(host.querySelector('[data-tree-recovery="unreadable"]')).not.toBeNull();
});

test("reports storage refusal and keeps the unreadable bytes gated", async () => {
  sessionStorage.setItem(tabId, rawValue);
  tabStorage.readTree(tabId);
  await renderGate();
  const originalRemove = Storage.prototype.removeItem;
  vi.spyOn(Storage.prototype, "removeItem").mockImplementation(function (this: Storage, key) {
    if (key === tabId) throw new DOMException("storage write refused", "QuotaExceededError");
    originalRemove.call(this, key);
  });
  const discardButton = Array.from(host.querySelectorAll("button")).find((candidate) =>
    candidate.textContent?.includes("TreeRecovery.DiscardValue"),
  );
  if (!discardButton) throw new Error("Missing discard button");

  await act(async () => discardButton.click());

  expect(host.textContent).toContain("TreeRecovery.DiscardFailed");
  expect(host.querySelector('[data-tree-recovery="unreadable"]')).not.toBeNull();
  expect(host.querySelector('[data-testid="board-child"]')).toBeNull();
  expect(tabStorage.readRawValueForRecovery(tabId)).toBe(rawValue);
});

test("explicit discard starts a fresh editable tree", async () => {
  sessionStorage.setItem(tabId, rawValue);
  tabStorage.readTree(tabId);
  await renderGate();
  const discardButton = Array.from(host.querySelectorAll("button")).find((candidate) =>
    candidate.textContent?.includes("TreeRecovery.DiscardValue"),
  );
  if (!discardButton) throw new Error("Missing discard button");

  await act(async () => discardButton.click());

  expect(host.querySelector("[data-tree-recovery]")).toBeNull();
  expect(host.querySelector('[data-testid="board-child"]')).not.toBeNull();
  expect(tabStorage.getStatus(tabId).kind).toBe("available");
  expect(capturedStore!.getState().dirty).toBe(false);
});
