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
import type { DatabaseHandle } from "@/bindings";

type ConvertProgress = {
  id: string;
  imported_games: number;
  elapsed_ms: number;
  source_file_name: string | null;
};

const target: DatabaseHandle = { id: { id: "import-db" }, kind: "database" };
const ownedId = "conversion:00000000-0000-4000-8000-000000000001";
const secondId = "conversion:00000000-0000-4000-8000-000000000002";

let eventHandler: ((event: { payload: ConvertProgress }) => void) | undefined;
let root: Root;
let container: HTMLDivElement;
const store = getDefaultStore();

function Probe() {
  useConversionProgress();
  const state = useAtomValue(databaseConversionStateAtom);
  return state.map((entry) => (
    <output
      key={entry.id}
      data-id={entry.id}
      data-total={entry.totalGames}
      data-elapsed={entry.elapsedSeconds}
      data-source={entry.sourceFileName ?? "none"}
      data-title={entry.targetDatabaseTitle ?? "none"}
    />
  ));
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
  store.set(databaseConversionStateAtom, [
    {
      id: ownedId,
      totalGames: 0,
      elapsedSeconds: 0,
      targetDatabase: target,
      targetDatabaseTitle: "Lichess import",
      sourceFileName: "games.pgn",
    },
  ]);
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
  await emit({
    id: ownedId,
    imported_games: 4000,
    elapsed_ms: 2500,
    source_file_name: "batch.pgn",
  });

  expect(read("data-total")).toBe("4000");
  expect(read("data-elapsed")).toBe("2.5");
  expect(read("data-source")).toBe("batch.pgn");
});

test("keeps the last known source file when the terminal frame omits it", async () => {
  await emit({
    id: ownedId,
    imported_games: 4000,
    elapsed_ms: 2500,
    source_file_name: "batch.pgn",
  });
  // The final emit after the counts are written carries no file name.
  await emit({ id: ownedId, imported_games: 5210, elapsed_ms: 3100, source_file_name: null });

  expect(read("data-source")).toBe("batch.pgn");
  expect(read("data-total")).toBe("5210");
});

test("never overwrites the conversion target the route owns", async () => {
  await emit({ id: ownedId, imported_games: 10, elapsed_ms: 100, source_file_name: null });

  expect(read("data-title")).toBe("Lichess import");
  expect(store.get(databaseConversionStateAtom)[0]?.targetDatabase).toEqual(target);
});

test("a registered operation can receive frames before its target exists", async () => {
  await act(async () =>
    store.set(databaseConversionStateAtom, (previous) =>
      previous.map((entry) => ({ ...entry, targetDatabase: null })),
    ),
  );
  await emit({
    id: ownedId,
    imported_games: 10,
    elapsed_ms: 1000,
    source_file_name: "created.pgn",
  });
  expect(store.get(databaseConversionStateAtom)[0]).toMatchObject({
    totalGames: 10,
    elapsedSeconds: 1,
    targetDatabase: null,
  });
});

test("ignores a ConvertProgress event with a foreign id", async () => {
  const previous = store.get(databaseConversionStateAtom);
  await emit({
    id: "conversion:foreign",
    imported_games: 9000,
    elapsed_ms: 4000,
    source_file_name: "foreign.pgn",
  });

  expect(store.get(databaseConversionStateAtom)).toBe(previous);
  expect(read("data-total")).toBe("0");
  expect(read("data-source")).toBe("games.pgn");
  expect(read("data-title")).toBe("Lichess import");
});

test("a frame never creates an entry when no conversion is in flight", async () => {
  await act(async () => {
    store.set(databaseConversionStateAtom, []);
  });
  const previous = store.get(databaseConversionStateAtom);

  await emit({
    id: ownedId,
    imported_games: 12,
    elapsed_ms: 500,
    source_file_name: "idle.pgn",
  });

  expect(store.get(databaseConversionStateAtom)).toBe(previous);
  expect(container.querySelectorAll("output")).toHaveLength(0);
});

test("two live operations receive only their own frames, even with the same target", async () => {
  const first = store.get(databaseConversionStateAtom)[0];
  if (!first) throw new Error("Missing first conversion");
  const second = { ...first, id: secondId, sourceFileName: "second.pgn" };
  await act(async () => store.set(databaseConversionStateAtom, [first, second]));
  await emit({ id: ownedId, imported_games: 100, elapsed_ms: 2000, source_file_name: "first.pgn" });
  expect(store.get(databaseConversionStateAtom)[1]).toBe(second);
  const updatedFirst = store.get(databaseConversionStateAtom)[0];
  await emit({ id: secondId, imported_games: 42, elapsed_ms: 500, source_file_name: null });
  expect(store.get(databaseConversionStateAtom)[0]).toBe(updatedFirst);
  expect(store.get(databaseConversionStateAtom)).toEqual([
    { ...first, totalGames: 100, elapsedSeconds: 2, sourceFileName: "first.pgn" },
    { ...second, totalGames: 42, elapsedSeconds: 0.5 },
  ]);
});

test("a removed id leaves the surviving registry referentially unchanged", async () => {
  await act(async () =>
    store.set(databaseConversionStateAtom, (previous) =>
      previous.map((entry) => ({ ...entry, id: secondId })),
    ),
  );
  const previous = store.get(databaseConversionStateAtom);
  await emit({ id: ownedId, imported_games: 9000, elapsed_ms: 4000, source_file_name: "late.pgn" });
  expect(store.get(databaseConversionStateAtom)).toBe(previous);
});
