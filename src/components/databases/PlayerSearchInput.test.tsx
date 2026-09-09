import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { DatabaseHandle } from "@/bindings";

const mocks = vi.hoisted(() => ({
  queryPlayers: vi.fn(),
  getPlayer: vi.fn(),
  notify: vi.fn(),
}));
vi.mock("@/utils/db", () => ({ query_players: mocks.queryPlayers }));
vi.mock("@/platform/tauri", () => ({ tauri: { getPlayer: mocks.getPlayer } }));
vi.mock("@/components/files/notifyError", () => ({ notifyUnlessCancelled: mocks.notify }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@tabler/icons-react", () => ({ IconSearch: () => null }));
vi.mock("@mantine/core", () => ({
  Autocomplete: ({
    value,
    data,
    onChange,
  }: {
    value: string;
    data: string[];
    onChange: (value: string) => void;
    leftSection?: ReactNode;
  }) => (
    <>
      <input value={value} onChange={(event) => onChange(event.currentTarget.value)} />
      <button type="button" onClick={() => onChange("Ada")}>
        search
      </button>
      <output>{data.join(",")}</output>
    </>
  ),
}));

import { PlayerSearchInput } from "./PlayerSearchInput";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const file = (id: string): DatabaseHandle => ({ id: { id }, kind: "database" });
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getPlayer.mockResolvedValue(null);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function render(database: DatabaseHandle) {
  await act(async () =>
    root.render(<PlayerSearchInput label="Player" file={database} setValue={vi.fn()} />),
  );
}

test("file replacement cancels the active native search and refuses its stale result", async () => {
  let resolve!: (value: { data: Array<{ id: number; name: string }>; count: number }) => void;
  let signal!: AbortSignal;
  mocks.queryPlayers.mockImplementation(
    (_file: unknown, _query: unknown, options: { signal: AbortSignal }) =>
      new Promise((done) => {
        signal = options.signal;
        resolve = done;
      }),
  );
  await render(file("first"));
  await act(async () => {
    container.querySelector("button")!.click();
  });
  await vi.waitFor(() => expect(mocks.queryPlayers).toHaveBeenCalledOnce());
  await render(file("second"));
  expect(signal.aborted).toBe(true);
  resolve({ data: [{ id: 1, name: "Ada" }], count: 1 });
  await act(async () => Promise.resolve());
  expect(container.querySelector("output")?.textContent).toBe("");
  expect(mocks.notify).not.toHaveBeenCalled();
});

test("unmount cancels an active lookup while an ordinary failure is surfaced", async () => {
  let signal!: AbortSignal;
  mocks.queryPlayers.mockImplementationOnce(
    (_file: unknown, _query: unknown, options: { signal: AbortSignal }) => {
      signal = options.signal;
      return new Promise(() => undefined);
    },
  );
  await render(file("first"));
  await act(async () => {
    container.querySelector("button")!.click();
  });
  await vi.waitFor(() => expect(mocks.queryPlayers).toHaveBeenCalledOnce());
  await act(async () => root.render(null));
  expect(signal.aborted).toBe(true);

  mocks.queryPlayers.mockRejectedValueOnce(new Error("lookup failed"));
  await render(file("second"));
  await act(async () => {
    container.querySelector("button")!.click();
  });
  await vi.waitFor(() => expect(mocks.notify).toHaveBeenCalledOnce());
});
