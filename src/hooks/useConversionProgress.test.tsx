import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ listen: vi.fn() }));

vi.mock("@/bindings/generated", () => ({
  commands: {},
  events: { convertProgress: { listen: mocks.listen } },
}));

import { useConversionProgress } from "./useConversionProgress";
import { databaseConversionStateAtom } from "@/state/atoms";
import { getDefaultStore, Provider, useAtomValue } from "jotai";

type ConvertProgress = {
  imported_games: number;
  elapsed_ms: number;
  source_file_name: string | null;
};

let eventHandler: ((event: { payload: ConvertProgress }) => void) | undefined;
let root: Root;
let container: HTMLDivElement;
const store = getDefaultStore();

function Probe() {
  useConversionProgress();
  const state = useAtomValue(databaseConversionStateAtom);
  return (
    <output
      data-in-progress={String(state.inProgress)}
      data-total={state.totalGames}
      data-elapsed={state.elapsedSeconds}
      data-source={state.sourceFileName ?? "none"}
      data-title={state.targetDatabaseTitle ?? "none"}
    />
  );
}

function read(attribute: string) {
  return container.querySelector("output")?.getAttribute(attribute);
}

async function emit(payload: ConvertProgress) {
  await act(async () => eventHandler?.({ payload }));
}

beforeEach(async () => {
  eventHandler = undefined;
  mocks.listen.mockImplementation((handler: (event: { payload: ConvertProgress }) => void) => {
    eventHandler = handler;
    return Promise.resolve(() => {});
  });
  store.set(databaseConversionStateAtom, {
    inProgress: false,
    totalGames: 0,
    elapsedSeconds: 0,
    targetDatabasePath: null,
    targetDatabaseTitle: "Lichess import",
    sourceFileName: "games.pgn",
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root.render(
      <Provider store={store}>
        <Probe />
      </Provider>,
    ),
  );
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

test("feeds the live import counters from the native conversion event", async () => {
  await emit({ imported_games: 4000, elapsed_ms: 2500, source_file_name: "batch.pgn" });

  expect(read("data-in-progress")).toBe("true");
  expect(read("data-total")).toBe("4000");
  expect(read("data-elapsed")).toBe("2.5");
  expect(read("data-source")).toBe("batch.pgn");
});

test("keeps the last known source file when the terminal frame omits it", async () => {
  await emit({ imported_games: 4000, elapsed_ms: 2500, source_file_name: "batch.pgn" });
  // The final emit after the counts are written carries no file name.
  await emit({ imported_games: 5210, elapsed_ms: 3100, source_file_name: null });

  expect(read("data-source")).toBe("batch.pgn");
  expect(read("data-total")).toBe("5210");
});

test("never overwrites the conversion target the route owns", async () => {
  await emit({ imported_games: 10, elapsed_ms: 100, source_file_name: null });

  expect(read("data-title")).toBe("Lichess import");
});
