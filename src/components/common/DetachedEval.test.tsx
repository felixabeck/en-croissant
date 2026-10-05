import { act } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { createTreeStore } from "@/state/store/tree";
import { currentDetachedEngineAtom, enginesAtom } from "@/state/atoms";
import { displayEngine, displayLines, engineDisplayHarness } from "@/tests/engineDisplay";
import { TreeStateContext } from "./TreeStateContext";
import DetachedEval from "./DetachedEval";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/utils/sound", () => ({ playSound: vi.fn() }));
let h: ReturnType<typeof engineDisplayHarness>;
afterEach(async () => h.close());
test("DetachedEval uses the shared dimmed fallback and replaces it with current lines", async () => {
  h = engineDisplayHarness();
  const tree = createTreeStore();
  await h.store.set(enginesAtom, [displayEngine]);
  h.store.set(currentDetachedEngineAtom, displayEngine.id);
  await h.remember();
  await h.render(
    <TreeStateContext.Provider value={tree}>
      <DetachedEval />
    </TreeStateContext.Provider>,
  );
  expect(h.host.textContent).toContain("e4 e5 Nf3");
  await act(async () => tree.getState().makeMoves({ payload: ["d4"] }));
  expect(h.host.querySelector("[inert]")?.textContent).toContain("e4 e5 Nf3");
  await h.remember([{ ...displayLines[0], sanMoves: ["d5"], uciMoves: ["d7d5"] }], ["d2d4"]);
  expect(h.host.querySelector("[inert]")).toBeNull();
  expect(h.host.textContent).toContain("d5");
  tree.dispose();
});
