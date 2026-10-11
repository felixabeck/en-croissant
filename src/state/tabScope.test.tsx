import { atom, createStore, Provider, useAtom, useSetAtom, type PrimitiveAtom } from "jotai";
import { atomFamily } from "jotai/utils";
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  activeTabAtom,
  closeWorkspaceTabAtom,
  disposeTabAtoms,
  practiceMoveControllerFamily,
  tabsAtom,
  type PracticeMoveController,
} from "./atoms";
import {
  EphemeralTabScope,
  useOwnerTab,
  useOwnerTabId,
  useTabAtom,
  WorkspaceTabScope,
} from "./tabScope";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let host: HTMLDivElement;
let root: Root;
let store: ReturnType<typeof createStore>;
let ownerAtom: PrimitiveAtom<PracticeMoveController | null>;

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  store = createStore();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  disposeTabAtoms("A");
  disposeTabAtoms("B");
});

function CleanupWriter() {
  ownerAtom = useTabAtom(practiceMoveControllerFamily);
  const setController = useSetAtom(ownerAtom);
  useEffect(() => () => setController(null), [setController]);
  return null;
}

const controller = (): PracticeMoveController => ({ canMove: true, submitMove: vi.fn() });

async function mountClosingTab(ids: string[]) {
  store.set(
    tabsAtom,
    ids.map((value) => ({
      value,
      name: value,
      type: "analysis" as const,
      gameOrigin: { kind: "none" as const },
    })),
    "A",
  );
  await act(async () =>
    root.render(
      <Provider store={store}>
        <WorkspaceTabScope tabId="A">
          <CleanupWriter />
        </WorkspaceTabScope>
      </Provider>,
    ),
  );
  store.set(ownerAtom, controller());
}

test("last-tab cleanup writes its captured atom after workspace close and disposal", async () => {
  const unrelated = atom({ untouched: true });
  const sentinel = store.get(unrelated);
  await mountClosingTab(["A"]);
  await act(async () => {
    expect(store.set(closeWorkspaceTabAtom, "A")).toBe(true);
  });
  const workspaceTabs = store.get(tabsAtom);
  expect(workspaceTabs).toEqual([]);
  expect(store.get(activeTabAtom)).toBeNull();
  expect([...practiceMoveControllerFamily.getParams()]).not.toContain("A");
  await expect(act(async () => root.unmount())).resolves.toBeUndefined();
  expect(store.get(ownerAtom)).toBeNull();
  expect(store.get(tabsAtom)).toBe(workspaceTabs);
  expect(store.get(activeTabAtom)).toBeNull();
  expect(store.get(unrelated)).toBe(sentinel);
  expect([...practiceMoveControllerFamily.getParams()]).not.toContain("A");
});

test("closing A and activating B keeps A's cleanup out of B's controller", async () => {
  await mountClosingTab(["A", "B"]);
  const neighbourAtom = practiceMoveControllerFamily("B");
  const neighbourController = controller();
  store.set(neighbourAtom, neighbourController);
  await act(async () => {
    expect(store.set(closeWorkspaceTabAtom, "A")).toBe(true);
  });
  expect(store.get(activeTabAtom)).toBe("B");
  const workspaceTabs = store.get(tabsAtom);
  await act(async () => root.unmount());
  expect(store.get(ownerAtom)).toBeNull();
  expect(store.get(neighbourAtom)).toBe(neighbourController);
  expect(store.get(tabsAtom)).toBe(workspaceTabs);
  expect(store.get(activeTabAtom)).toBe("B");
  expect([...practiceMoveControllerFamily.getParams()]).not.toContain("A");
});

test("useTabAtom requires a provider as a developer invariant", async () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
  try {
    await expect(act(async () => root.render(<CleanupWriter />))).rejects.toThrow(
      "useTabAtom used outside a TabScope",
    );
  } finally {
    consoleError.mockRestore();
  }
});

test("ephemeral scopes isolate siblings, survive rerender and never retain family keys", async () => {
  const family = atomFamily((_key: string) => atom(0));
  function Counter({ name }: { name: string }) {
    const [value, setValue] = useAtom(useTabAtom(family));
    return (
      <button onClick={() => setValue((previous) => previous + 1)}>
        {name}:{value}
      </button>
    );
  }
  function Scopes({ revision }: { revision: number }) {
    return (
      <Provider store={store}>
        <div data-revision={revision}>
          <EphemeralTabScope>
            <Counter name="first" />
          </EphemeralTabScope>
          <EphemeralTabScope>
            <Counter name="second" />
          </EphemeralTabScope>
        </div>
      </Provider>
    );
  }
  await act(async () => root.render(<Scopes revision={0} />));
  expect([...family.getParams()]).toEqual([]);
  await act(async () => host.querySelector("button")!.click());
  expect([...host.querySelectorAll("button")].map((button) => button.textContent)).toEqual([
    "first:1",
    "second:0",
  ]);
  await act(async () => root.render(<Scopes revision={1} />));
  expect([...host.querySelectorAll("button")].map((button) => button.textContent)).toEqual([
    "first:1",
    "second:0",
  ]);
  expect([...family.getParams()]).toEqual([]);
  await act(async () => root.unmount());
  expect([...family.getParams()]).toEqual([]);
});

test("owner tab reads and writes A while B is active and refuses writes after A leaves", async () => {
  let owner: ReturnType<typeof useOwnerTab> | undefined;
  function Owner() {
    owner = useOwnerTab();
    expect(useOwnerTabId()).toBe("A");
    return null;
  }
  store.set(
    tabsAtom,
    ["A", "B"].map((value) => ({
      value,
      name: value,
      type: "analysis" as const,
      gameOrigin: { kind: "none" as const },
    })),
    "B",
  );
  await act(async () =>
    root.render(
      <Provider store={store}>
        <WorkspaceTabScope tabId="A">
          <Owner />
        </WorkspaceTabScope>
      </Provider>,
    ),
  );
  expect(owner?.[0]?.value).toBe("A");
  const neighbour = store.get(tabsAtom).find((tab) => tab.value === "B");
  await act(async () => {
    expect(owner?.[1]((tab) => ({ ...tab, name: "Edited A" }))).toBe(true);
  });
  expect(store.get(tabsAtom).find((tab) => tab.value === "A")?.name).toBe("Edited A");
  expect(store.get(tabsAtom).find((tab) => tab.value === "B")).toEqual(neighbour);
  expect(store.get(activeTabAtom)).toBe("B");
  const setOwner = owner?.[1];
  await act(async () => {
    expect(store.set(closeWorkspaceTabAtom, "A")).toBe(true);
  });
  expect(owner?.[0]).toBeUndefined();
  const update = vi.fn((tab) => ({ ...tab, name: "Gone" }));
  expect(owner?.[1](update)).toBe(false);
  expect(setOwner?.(update)).toBe(false);
  expect(update).not.toHaveBeenCalled();
  expect(store.get(tabsAtom)).toEqual([neighbour]);
});

test("ephemeral owner has no workspace tab and refuses metadata writes", async () => {
  let owner: ReturnType<typeof useOwnerTab> | undefined;
  function Owner() {
    owner = useOwnerTab();
    return null;
  }
  await mountClosingTab(["A"]);
  await act(async () =>
    root.render(
      <Provider store={store}>
        <EphemeralTabScope>
          <Owner />
        </EphemeralTabScope>
      </Provider>,
    ),
  );
  const tabs = store.get(tabsAtom);
  expect(owner?.[0]).toBeUndefined();
  const update = vi.fn((tab) => ({ ...tab, name: "Preview" }));
  expect(owner?.[1](update)).toBe(false);
  expect(update).not.toHaveBeenCalled();
  expect(store.get(tabsAtom)).toBe(tabs);
});

test.each(["missing", "ephemeral"])(
  "useOwnerTabId rejects a %s workspace provider",
  async (scope) => {
    function OwnerId() {
      useOwnerTabId();
      return null;
    }
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await expect(
        act(async () =>
          root.render(
            scope === "ephemeral" ? (
              <EphemeralTabScope>
                <OwnerId />
              </EphemeralTabScope>
            ) : (
              <OwnerId />
            ),
          ),
        ),
      ).rejects.toThrow("useOwnerTabId used outside a WorkspaceTabScope");
    } finally {
      consoleError.mockRestore();
    }
  },
);
