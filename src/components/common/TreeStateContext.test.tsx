import { act, useContext } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test } from "vitest";

import { closeTreeStore, createTreeStore, type TreeStore } from "@/state/store/tree";
import { serializeStorageValue } from "@/state/store/debouncedStorage";
import { tabStorage, TREE_STORAGE_VERSION } from "@/state/store/tabStorage";
import { defaultTree } from "@/utils/treeReducer";
import { TreeStateContext, TreeStateProvider } from "./TreeStateContext";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const roots: ReturnType<typeof createRoot>[] = [];

afterEach(async () => {
  while (roots.length) await act(async () => roots.pop()!.unmount());
  closeTreeStore("report-remount");
  closeTreeStore("stale-report-hydration");
  tabStorage.remove("report-remount");
  tabStorage.remove("stale-report-hydration");
  sessionStorage.clear();
});

function mountStore(id: string): TreeStore {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  let captured: TreeStore | null = null;
  function Capture() {
    captured = useContext(TreeStateContext);
    return null;
  }
  act(() =>
    root.render(
      <TreeStateProvider id={id}>
        <Capture />
      </TreeStateProvider>,
    ),
  );
  return captured!;
}

test("tab report store survives provider switching and is replaced only by actual close", async () => {
  const first = mountStore("report-remount");
  await act(async () => roots.pop()!.unmount());

  const remounted = mountStore("report-remount");
  expect(remounted).toBe(first);
  first.getState().setReportOperationId("completed-after-switch");
  expect(remounted.getState().report.operationId).toBe("completed-after-switch");

  closeTreeStore("report-remount");
  expect(createTreeStore("report-remount")).not.toBe(first);
});

test("hydration clears a report whose JavaScript completion owner expired with the renderer", () => {
  const persisted = defaultTree();
  persisted.report = { inProgress: true, operationId: "expired-operation" };
  sessionStorage.setItem(
    "stale-report-hydration",
    serializeStorageValue({ version: TREE_STORAGE_VERSION, state: persisted }),
  );

  const hydrated = createTreeStore("stale-report-hydration").getState();

  expect(hydrated.report).toEqual({ inProgress: false, operationId: null });
});
