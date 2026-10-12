import { INITIAL_FEN } from "chessops/fen";
import { act } from "react";
import { engineTerminalFamily } from "@/state/atoms";
import { engineIdentity, engineLineContext } from "./analysisLineContext";
import { afterEach, expect, test, vi } from "vitest";
import { displayEngine, displayLines, engineDisplayHarness } from "@/tests/engineDisplay";
import { EngineSummary } from "./AnalysisPanel";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("./EngineSelection", () => ({ default: () => null }));
vi.mock("./LogsPanel", () => ({ default: () => null }));
vi.mock("./ReportPanel", () => ({ default: () => null }));
vi.mock("./TablebaseInfo", () => ({ default: () => null }));
let h: ReturnType<typeof engineDisplayHarness>;
afterEach(async () => h.close());
test("EngineSummary uses the shared dimmed fallback instead of ??? until a current result", async () => {
  h = engineDisplayHarness();
  await h.remember();
  const summary = (moves: string[]) => (
    <EngineSummary engine={displayEngine} fen={INITIAL_FEN} moves={moves} shorten={false} i={0} />
  );
  await h.render(summary([]));
  await h.render(summary(["e2e4"]));
  expect(h.host.querySelector("[inert]")?.textContent).toContain("0.34");
  expect(h.host.textContent).not.toContain("???");
  await h.remember(
    [{ ...displayLines[0], score: { value: { type: "cp", value: 55 }, wdl: null } }],
    ["e2e4"],
  );
  expect(h.host.querySelector("[inert]")).toBeNull();
  expect(h.host.textContent).toContain("0.55");
});

test.each([false, true])(
  "P2 EngineSummary shows failure with historical evaluation, partial lines %s",
  async (partial) => {
    h = engineDisplayHarness();
    if (partial) await h.remember();
    await h.render(
      <EngineSummary engine={displayEngine} fen={INITIAL_FEN} moves={[]} shorten={false} i={0} />,
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
    expect(h.host.querySelector("[inert]")?.textContent).toBe(partial ? "+0.34" : undefined);
  },
);
