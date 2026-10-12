import { MantineProvider } from "@mantine/core";
import { createStore, Provider } from "jotai";
import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { installMatchMediaStub } from "@/tests/matchMedia";
import {
  DatabaseLayoutContext,
  databaseSplitAtoms,
  DATABASE_SPLIT_KEY,
} from "@/state/databaseLayout";
import GridLayout from "./GridLayout";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, options: { defaultValue: string }) => options.defaultValue,
  }),
}));
installMatchMediaStub();
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

test("shared mounted tiles observe keyboard commits, clamp without storage writes and retain preview ownership on compact reflow", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const store = createStore();
  store.set(databaseSplitAtoms.commit, 25);
  const writes = vi.spyOn(Storage.prototype, "setItem");
  const mounted = vi.fn();
  const unmounted = vi.fn();
  function Preview() {
    useEffect(() => {
      mounted();
      return unmounted;
    }, []);
    return <div data-preview-owner />;
  }
  const render = (compact: boolean, minimum: number) =>
    act(async () =>
      root.render(
        <Provider store={store}>
          <MantineProvider>
            <DatabaseLayoutContext.Provider value={{ compact, minimum, rootFont: 16 }}>
              {["games", "players", "tournaments"].map((id) => (
                <GridLayout key={id} search={<input />} table={<div />} preview={<Preview />} />
              ))}
            </DatabaseLayoutContext.Provider>
          </MantineProvider>
        </Provider>,
      ),
    );
  try {
    await render(false, 40);
    expect(
      [...host.querySelectorAll("[data-database-layout]")].map((element) =>
        element.getAttribute("data-percentage"),
      ),
    ).toEqual(["40", "40", "40"]);
    expect(writes).not.toHaveBeenCalled();
    expect(localStorage.getItem(DATABASE_SPLIT_KEY)).toBe("25");
    // An interrupted measurement can leave Mosaic's DOM rectangle empty before reflow.
    await act(async () => {
      host
        .querySelector(".mosaic-split")!
        .dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
      document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, button: 0 }));
    });
    expect(store.get(databaseSplitAtoms.preferred)).toBe(25);
    expect(writes).not.toHaveBeenCalled();
    const owners = [...host.querySelectorAll("[data-preview-owner]")];
    await render(true, 50);
    expect(host.querySelectorAll(".mosaic-split")).toHaveLength(0);
    expect([...host.querySelectorAll("[data-preview-owner]")]).toEqual(owners);
    await render(false, 20);
    expect(host.querySelector("[data-database-layout]")!.getAttribute("data-percentage")).toBe(
      "25",
    );
    expect(writes).not.toHaveBeenCalled();
    const action = host.querySelector('[aria-label="Enlarge preview"]') as HTMLButtonElement;
    await act(async () => action.click());
    expect(store.get(databaseSplitAtoms.preferred)).toBe(20);
    expect(writes).toHaveBeenCalledOnce();
    expect(
      [...host.querySelectorAll('[aria-label="Enlarge preview"]')].every(
        (element) => (element as HTMLButtonElement).disabled,
      ),
    ).toBe(true);
    expect(mounted).toHaveBeenCalledTimes(3);
    expect(unmounted).not.toHaveBeenCalled();
  } finally {
    await act(async () => root.unmount());
    host.remove();
    writes.mockRestore();
  }
});
