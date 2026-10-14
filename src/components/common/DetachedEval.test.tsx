import { act } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { createTreeStore } from "@/state/store/tree";
import { currentDetachedEngineAtom, enginesAtom, engineTerminalFamily } from "@/state/atoms";
import { INITIAL_FEN } from "chessops/fen";
import { engineIdentity, engineLineContext } from "../panels/analysis/analysisLineContext";
import { displayEngine, displayLines, engineDisplayHarness } from "@/tests/engineDisplay";
import { TreeStateContext } from "./TreeStateContext";
import DetachedEval from "./DetachedEval";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/utils/sound", () => ({ playSound: vi.fn() }));
vi.mock("@/platform/tauri", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/platform/tauri")>();
  return {
    ...actual,
    tauri: { ...actual.tauri, reconcileEngineAttachments: vi.fn().mockResolvedValue(undefined) },
  };
});
let h: ReturnType<typeof engineDisplayHarness>;
afterEach(async () => h.close());
test("DetachedEval uses the shared dimmed fallback and replaces it with current lines", async () => {
  h = engineDisplayHarness();
  const tree = createTreeStore();
  expect((await h.store.set(enginesAtom, [displayEngine])).saved).toBe(true);
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

test.each([false, true])(
  "P2 DetachedEval shows failure with historical evaluation, partial lines %s",
  async (partial) => {
    h = engineDisplayHarness();
    const tree = createTreeStore();
    expect((await h.store.set(enginesAtom, [displayEngine])).saved).toBe(true);
    h.store.set(currentDetachedEngineAtom, displayEngine.id);
    if (partial) await h.remember();
    await h.render(
      <TreeStateContext.Provider value={tree}>
        <DetachedEval />
      </TreeStateContext.Provider>,
    );
    await act(async () =>
      h.store.set(engineTerminalFamily({ tab: "display-tab", engine: displayEngine.id }), {
        type: "failed",
        searchedKey: `${INITIAL_FEN}:`,
        fingerprint: "attempt",
        generation: "generation",
        retry: 0,
        context: engineLineContext(h.store.get(h.settingsAtom), displayEngine),
        engineIdentity: engineIdentity(displayEngine),
      }),
    );
    expect(h.host.textContent).toContain("Board.Analysis.EngineFailed");
    expect(h.host.querySelector("[inert]") !== null).toBe(partial);
    expect(h.host.querySelector("[inert]")?.textContent).toBe(
      partial ? "+0.34e4 e5 Nf3" : undefined,
    );
    tree.dispose();
  },
);
