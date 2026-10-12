import { Accordion } from "@mantine/core";
import { INITIAL_FEN } from "chessops/fen";
import { act } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { displayEngine, engineDisplayHarness } from "@/tests/engineDisplay";
import { engineTerminalFamily, engineRetryFamily } from "@/state/atoms";
import { analysisSearch } from "./analysisSearch";
import { engineIdentity, engineLineContext } from "./analysisLineContext";
import BestMoves from "./BestMoves";
import { errorUnlessCancelled } from "@/platform/errors";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("./EngineSettingsForm", () => ({ default: () => null }));
vi.mock("./AnalysisRow", () => ({
  default: ({ moves, inert, fen, halfMoves }: any) => (
    <tr data-inert={inert} data-fen={fen} data-ply={halfMoves}>
      <td>{moves.join(" ")}</td>
    </tr>
  ),
}));
let h: ReturnType<typeof engineDisplayHarness>;
beforeEach(() => {
  vi.useFakeTimers();
  h = engineDisplayHarness();
});
afterEach(async () => {
  await h.close();
  vi.useRealTimers();
});
const panel = (moves: string[] = []) => (
  <Accordion value="engine">
    <Accordion.Item value="engine">
      <BestMoves
        id={0}
        engine={displayEngine}
        fen={INITIAL_FEN}
        moves={moves}
        halfMoves={moves.length}
        dragHandleProps={{}}
        orientation="white"
      />
    </Accordion.Item>
  </Accordion>
);

function terminal(moves: string[] = []) {
  return {
    type: "completed-without-lines" as const,
    searchedKey: analysisSearch(INITIAL_FEN, moves, false).key,
    context: engineLineContext(h.store.get(h.settingsAtom), displayEngine),
    fingerprint: "attempt",
    engineIdentity: engineIdentity(displayEngine),
    generation: "generation",
    retry: 0,
  };
}

test("first start has neither skeleton rows nor Loading at 999 ms and has both at 1000 ms", async () => {
  await h.render(panel());
  await act(async () => vi.advanceTimersByTime(999));
  expect(h.host.querySelector(".mantine-Skeleton-root")).toBeNull();
  expect(h.host.textContent).not.toContain("Common.Loading");
  await act(async () => vi.advanceTimersByTime(1));
  expect(h.host.querySelectorAll(".mantine-Skeleton-root")).toHaveLength(1);
  expect(h.host.textContent).toContain("Common.Loading");
});

test.each([0, 1000])(
  "a marked key leaves the lines area empty without fallback, skeleton or Loading when marked at %i ms",
  async (elapsed) => {
    await h.remember();
    await h.render(panel());
    const moves = ["d2d4"];
    await h.render(panel(moves));
    await act(async () => vi.advanceTimersByTime(elapsed));
    await act(async () =>
      h.store.set(
        engineTerminalFamily({ tab: "display-tab", engine: displayEngine.id }),
        terminal(moves),
      ),
    );
    expect(h.host.querySelector('[data-inert="true"]')).toBeNull();
    expect(h.host.querySelector("tbody")?.children).toHaveLength(0);
    await act(async () => vi.advanceTimersByTime(1000));
    expect(h.host.querySelector(".mantine-Skeleton-root")).toBeNull();
    expect(h.host.textContent).not.toContain("Common.Loading");
    expect(h.host.textContent).not.toContain("Board.Analysis.NoAnalysisAvailable");
    await act(async () => vi.advanceTimersByTime(5000));
    expect(h.host.querySelector("tbody")?.children).toHaveLength(0);
    expect(h.host.textContent).not.toContain("Common.Loading");
  },
);

test("position change with previous lines renders dimmed inert rows without skeleton or badge and replaces them on result", async () => {
  await h.remember();
  await h.render(panel());
  await h.render(panel(["d2d4"]));
  expect(h.host.querySelector('[data-inert="true"]')?.textContent).toBe("e4 e5 Nf3");
  expect(h.host.querySelector('[data-inert="true"]')?.getAttribute("data-fen")).toBe(INITIAL_FEN);
  expect(h.host.querySelector('[style*="opacity: 0.5"]')).not.toBeNull();
  expect(h.host.querySelector(".mantine-Skeleton-root")).toBeNull();
  expect(h.host.textContent).not.toContain("Common.Loading");
  await h.remember(undefined, ["d2d4"]);
  expect(h.host.querySelector('[data-inert="true"]')).toBeNull();
});

test("inactive and no-analysis messages take precedence over delayed loading in the rendered panel", async () => {
  await act(async () => h.store.set(h.settingsAtom, (s) => ({ ...s, enabled: false })));
  await h.render(panel());
  await act(async () => vi.advanceTimersByTime(1000));
  expect(h.host.textContent).toContain("Board.Analysis.InactiveEngine");
  expect(h.host.textContent).not.toContain("Common.Loading");
  expect(h.host.querySelector(".mantine-Skeleton-root")).toBeNull();
  await act(async () => h.store.set(h.settingsAtom, (s) => ({ ...s, enabled: true })));
  await h.remember([]);
  await act(async () => vi.advanceTimersByTime(1000));
  expect(h.host.textContent).toContain("Board.Analysis.NoAnalysisAvailable");
  expect(h.host.textContent).not.toContain("Common.Loading");
  expect(h.host.querySelector(".mantine-Skeleton-root")).toBeNull();
});

test.each([false, true])(
  "P2 failure ends loading, progress and speed, partial lines %s",
  async (partial) => {
    if (partial) await h.remember();
    await h.render(panel());
    await act(async () =>
      h.store.set(engineTerminalFamily({ tab: "display-tab", engine: displayEngine.id }), {
        ...terminal(),
        type: "failed",
        snapshot: {
          kind: "process-exit",
          exitStatus: { code: 1, signal: null },
          reason: "<b>Safe failure</b>",
          entries: [],
        },
      }),
    );
    await act(async () => vi.advanceTimersByTime(5000));
    expect(h.host.textContent).toContain("Board.Analysis.EngineFailed");
    expect(h.host.textContent).toContain("<b>Safe failure</b>");
    expect(h.host.querySelector("b")).toBeNull();
    expect(h.host.textContent).not.toContain("n/s");
    expect(h.host.textContent).not.toContain("Common.Loading");
    expect(h.host.querySelector(".mantine-Skeleton-root")).toBeNull();
    expect(h.host.querySelector('[data-animated="true"]')).toBeNull();
    expect(h.host.querySelector('[data-inert="true"]') !== null).toBe(partial);
    const settings = h.store.get(h.settingsAtom);
    await act(async () =>
      [...h.host.querySelectorAll("button")]
        .find((b) => b.textContent === "Board.Analysis.RetryEngine")!
        .click(),
    );
    expect(h.store.get(engineRetryFamily({ tab: "display-tab", engine: displayEngine.id }))).toBe(
      1,
    );
    expect(h.store.get(h.settingsAtom)).toBe(settings);
    expect(h.host.textContent).not.toContain("Board.Analysis.EngineFailed");
  },
);

test("failed BestMoves shows the reason and the cleanup warning", async () => {
  await h.render(panel());
  await act(async () =>
    h.store.set(engineTerminalFamily({ tab: "display-tab", engine: displayEngine.id }), {
      ...terminal(),
      type: "failed",
      cleanupFailed: true,
      message: "Engine failed. Temporary cleanup also failed",
      snapshot: {
        kind: "process-exit",
        exitStatus: null,
        reason: "Safe engine reason",
        entries: [],
      },
    }),
  );
  expect(h.host.querySelector('[role="status"]')?.textContent).toContain(
    "Safe engine reason Board.Analysis.EngineCleanupFailed",
  );
});

test("a failure without a snapshot renders its retained safe message once", async () => {
  const raw = "Cannot launch /home/felixb/engines/stockfish token=secret";
  const message = "Cannot launch [path] token=[redacted]";
  const failure = errorUnlessCancelled(new Error(raw))!;
  expect(failure.message).toBe(message);
  await h.render(panel());
  await act(async () =>
    h.store.set(engineTerminalFamily({ tab: "display-tab", engine: displayEngine.id }), {
      ...terminal(),
      type: "failed",
      message: failure.message,
    }),
  );
  const status = h.host.querySelector('[role="status"]')!;
  expect(status.textContent?.split(message)).toHaveLength(2);
  expect(status.textContent?.split("Board.Analysis.EngineFailed")).toHaveLength(2);
  expect(status.textContent).not.toContain("/home/felixb/engines/stockfish");
  expect(status.textContent).not.toContain("secret");
  expect(status.textContent).not.toContain("Board.Analysis.EngineDisconnected");
});
