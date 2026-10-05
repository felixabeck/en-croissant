import { INITIAL_FEN } from "chessops/fen";
import { act } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { activeTabAtom, currentThreatAtom } from "@/state/atoms";
import { displayEngine, displayLines, engineDisplayHarness } from "@/tests/engineDisplay";
import { analysisSearch } from "./analysisSearch";
import { AnalysisLineMemory } from "./analysisLineMemory";
import { engineLineContext } from "./analysisLineContext";
import { useDisplayedEngineLines } from "./useDisplayedEngineLines";
import type { Engine } from "@/utils/engines";

let h: ReturnType<typeof engineDisplayHarness>;
let display: ReturnType<typeof useDisplayedEngineLines>;
function Probe({
  engine = displayEngine,
  fen = INITIAL_FEN,
  moves = [],
}: {
  engine?: Engine;
  fen?: string;
  moves?: string[];
}) {
  display = useDisplayedEngineLines(engine, fen, moves, moves.length);
  return null;
}
beforeEach(() => {
  vi.useFakeTimers();
  h = engineDisplayHarness();
});
afterEach(async () => {
  await h.close();
  vi.useRealTimers();
});

test("uses current lines immediately, then dimmed previous lines with their original position until 1000 ms", async () => {
  await h.remember();
  await h.render(<Probe />);
  expect(display.lines).toEqual(displayLines);
  expect(display.dimmed).toBe(false);
  await h.render(<Probe moves={["d2d4"]} />);
  expect(display.lines).toEqual(displayLines);
  expect(display.dimmed).toBe(true);
  expect(display.finalFen).toBe(INITIAL_FEN);
  expect(display.halfMoves).toBe(0);
  await act(async () => vi.advanceTimersByTime(999));
  expect(display.loading).toBe(false);
  await act(async () => vi.advanceTimersByTime(1));
  expect(display.loading).toBe(true);
  expect(display.lines).toBeUndefined();
  await h.remember(displayLines, ["d2d4"]);
  expect(display.loading).toBe(false);
  expect(display.dimmed).toBe(false);
});

test("first start stays empty until 1000 ms and navigation restarts the deadline", async () => {
  await h.render(<Probe />);
  await act(async () => vi.advanceTimersByTime(999));
  expect(display.lines).toBeUndefined();
  expect(display.loading).toBe(false);
  await h.render(<Probe moves={["e2e4"]} />);
  await act(async () => vi.advanceTimersByTime(999));
  expect(display.loading).toBe(false);
  await act(async () => vi.advanceTimersByTime(1));
  expect(display.loading).toBe(true);
});

test("invalid, game-over, inactive and explicit no-analysis entries take precedence", async () => {
  await h.remember();
  await h.render(<Probe />);
  await h.render(<Probe fen="invalid" />);
  expect(display.error).toBeTruthy();
  expect(display.lines).toBeUndefined();
  await h.render(<Probe fen="7k/6Q1/5K2/8/8/8/8/8 b - - 0 1" />);
  expect(display.isGameOver).toBe(true);
  expect(display.lines).toBeUndefined();
  await h.render(<Probe moves={["e2e4"]} />);
  await act(async () => h.store.set(h.settingsAtom, (s) => ({ ...s, enabled: false })));
  await act(async () => vi.advanceTimersByTime(1000));
  expect(display.lines).toBeUndefined();
  expect(display.loading).toBe(false);
  await h.remember([]);
  await h.render(<Probe />);
  expect(display.lines).toEqual([]);
  expect(display.dimmed).toBe(false);
});

test.each(["engine", "executable", "tab", "settings", "go", "mode"])(
  "resets the fallback on %s change",
  async (change) => {
    await h.remember();
    await h.render(<Probe />);
    await h.render(<Probe moves={["e2e4"]} />);
    expect(display.dimmed).toBe(true);
    if (change === "engine")
      await h.render(<Probe engine={{ ...displayEngine, id: "another" }} moves={["e2e4"]} />);
    if (change === "executable")
      await h.render(
        <Probe
          engine={{ ...displayEngine, handle: { ...displayEngine.handle, id: { id: "replaced" } } }}
          moves={["e2e4"]}
        />,
      );
    if (change === "tab") await act(async () => h.store.set(activeTabAtom, "another-tab"));
    if (change === "settings")
      await act(async () =>
        h.store.set(h.settingsAtom, (s) => ({
          ...s,
          settings: [{ type: "string", name: "Hash", value: "32" }],
        })),
      );
    if (change === "go")
      await act(async () =>
        h.store.set(h.settingsAtom, (s) => ({ ...s, go: { t: "Depth", c: 10 } })),
      );
    if (change === "mode") await act(async () => h.store.set(currentThreatAtom, true));
    expect(display.dimmed).toBe(false);
    expect(display.lines).toBeUndefined();
  },
);

test("rejects memory from old settings and reads remembered lines only for the current mode", async () => {
  const memory = new AnalysisLineMemory();
  memory.context = "old context";
  memory.set(analysisSearch(INITIAL_FEN, [], false).key, displayLines);
  await act(async () => h.store.set(h.memoryAtom, memory));
  await h.render(<Probe />);
  expect(display.lines).toBeUndefined();
  await act(async () =>
    h.store.set(h.memoryAtom, new Map([[analysisSearch(INITIAL_FEN, [], true).key, displayLines]])),
  );
  expect(display.lines).toBeUndefined();
  await act(async () => h.store.set(currentThreatAtom, true));
  expect(display.lines).toEqual(displayLines);
  expect(display.dimmed).toBe(false);
  await act(async () => h.store.set(currentThreatAtom, false));
  expect(display.lines).toBeUndefined();
});

test("a settings change discards previous lines even when those settings are selected again", async () => {
  await h.remember();
  await h.render(<Probe />);
  await h.render(<Probe moves={["e2e4"]} />);
  const original = h.store.get(h.settingsAtom);
  await act(async () => h.store.set(h.settingsAtom, { ...original, go: { t: "Depth", c: 10 } }));
  await act(async () => h.store.set(h.settingsAtom, original));
  expect(display.dimmed).toBe(false);
  expect(display.lines).toBeUndefined();
});

test("each mode retains its most recently displayed lines without exposing the other mode", async () => {
  await h.remember();
  await h.render(<Probe />);
  await h.render(<Probe moves={["e2e4"]} />);
  await act(async () => h.store.set(currentThreatAtom, true));
  expect(display.lines).toBeUndefined();
  const threats = [{ ...displayLines[0], depth: 33 }];
  await act(async () =>
    h.store.set(
      h.memoryAtom,
      new Map([[analysisSearch(INITIAL_FEN, ["e2e4"], true).key, threats]]),
    ),
  );
  expect(display.lines).toEqual(threats);
  await h.render(<Probe moves={["d2d4"]} />);
  expect(display.lines).toEqual(threats);
  expect(display.dimmed).toBe(true);
  await act(async () => h.store.set(currentThreatAtom, false));
  expect(display.lines).toEqual(displayLines);
  expect(display.dimmed).toBe(true);
});

test("the fallback tracks the latest displayed payload and its move-number anchor", async () => {
  await h.remember();
  await h.render(<Probe />);
  const latest = [{ ...displayLines[0], depth: 30 }];
  await h.remember(latest, ["e2e4"]);
  await h.render(<Probe moves={["e2e4"]} />);
  await h.render(<Probe moves={["d2d4"]} />);
  expect(display.lines).toEqual(latest);
  expect(display.halfMoves).toBe(1);
  expect(display.finalFen).toBe(analysisSearch(INITIAL_FEN, ["e2e4"], false).finalFen);
});

test("old deadlines are cancelled on navigation and unmount, and current results create no timer", async () => {
  await h.render(<Probe />);
  await act(async () => vi.advanceTimersByTime(500));
  await h.render(<Probe moves={["e2e4"]} />);
  await act(async () => vi.advanceTimersByTime(250));
  await h.render(<Probe />);
  await act(async () => vi.advanceTimersByTime(250));
  expect(display.loading).toBe(false);
  await h.remember();
  const timers = vi.getTimerCount();
  expect(timers).toBe(0);
  await h.render(<Probe moves={["d2d4"]} />);
  expect(vi.getTimerCount()).toBe(1);
  await h.render(null);
  expect(vi.getTimerCount()).toBe(0);
});

test("invalid and game-over positions suppress even remembered entries", async () => {
  const over = "7k/6Q1/5K2/8/8/8/8/8 b - - 0 1";
  await act(async () =>
    h.store.set(
      h.memoryAtom,
      new Map([
        ["invalid:", displayLines],
        [`${over}:`, displayLines],
      ]),
    ),
  );
  await h.render(<Probe fen="invalid" />);
  expect(display.lines).toBeUndefined();
  expect(display.isGameOver).toBe(false);
  await h.render(<Probe fen={over} />);
  expect(display.lines).toBeUndefined();
  await h.render(<Probe />);
  expect(display.lines).toBeUndefined();
});

test("matching contextual memory is eligible and remote executable identity scopes the fallback", async () => {
  const memory = new AnalysisLineMemory();
  memory.context = engineLineContext(h.store.get(h.settingsAtom), displayEngine);
  memory.set(analysisSearch(INITIAL_FEN, [], false).key, displayLines);
  await act(async () => h.store.set(h.memoryAtom, memory));
  await h.render(<Probe />);
  expect(display.lines).toEqual(displayLines);
  const remote: Engine = {
    type: "chessdb",
    id: displayEngine.id,
    name: "Cloud",
    url: "https://example.test",
  };
  await h.remember();
  await h.render(<Probe engine={remote} />);
  await h.render(<Probe engine={{ ...remote, url: "https://changed.test" }} moves={["e2e4"]} />);
  expect(display.lines).toBeUndefined();
});

test("contextual remembered lines remain current across pause, resume and sync toggles", async () => {
  const memory = new AnalysisLineMemory();
  memory.context = engineLineContext(h.store.get(h.settingsAtom), displayEngine);
  memory.set(analysisSearch(INITIAL_FEN, [], false).key, displayLines);
  await act(async () => h.store.set(h.memoryAtom, memory));
  await h.render(<Probe />);
  expect(display.lines).toEqual(displayLines);
  for (const enabled of [false, true]) {
    await act(async () =>
      h.store.set(h.settingsAtom, (s) => ({ ...s, enabled, synced: !s.synced })),
    );
    expect(display.lines).toEqual(displayLines);
    expect(display.dimmed).toBe(false);
    expect(display.loading).toBe(false);
  }
});

test("the shared reader initializes per-engine option and go defaults", async () => {
  const options = [{ type: "string" as const, name: "Hash", value: "32" }];
  await h.render(
    <Probe
      engine={{
        ...displayEngine,
        id: "default-engine",
        settings: options,
        go: { t: "Depth", c: 12 },
      }}
    />,
  );
  expect(display.settings.settings).toEqual(options);
  expect(display.settings.go).toEqual({ t: "Depth", c: 12 });
});
