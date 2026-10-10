import { MantineProvider } from "@mantine/core";
import { INITIAL_FEN } from "chessops/fen";
import { Provider, createStore } from "jotai";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { NormalizedGame } from "@/bindings";
import { tabsAtom } from "@/state/atoms";
import { activeDatabaseViewStore } from "@/state/store/database";
import { tabStorage } from "@/state/store/tabStorage";
import { defaultTree } from "@/utils/treeReducer";
import type { SuccessDatabaseInfo } from "@/utils/db";
import { installMatchMediaStub } from "@/tests/matchMedia";
import { DatabaseViewStateContext } from "./DatabaseViewStateContext";
import GameTable from "./GameTable";

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), parsePGN: vi.fn(), notify: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => mocks.navigate }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string, options?: any) => options?.defaultValue ?? key }),
}));
vi.mock("@mantine/notifications", () => ({ notifications: { show: mocks.notify } }));
vi.mock("@/utils/chess", async (original) => ({
  ...(await original<typeof import("@/utils/chess")>()),
  parsePGN: mocks.parsePGN,
}));
vi.mock("swr", async (original) => ({
  ...(await original<typeof import("swr")>()),
  default: () => ({ data: { data: games, count: games.length }, mutate: vi.fn() }),
}));
vi.mock("./PlayerSearchInput", () => ({ PlayerSearchInput: () => null }));
vi.mock("./SideInput", () => ({ SideInput: () => null }));
vi.mock("./GamePreview", () => ({ default: ({ pgn }: { pgn: string }) => <div>{pgn}</div> }));
vi.mock("../common/GameInfo", () => ({ default: () => null }));
vi.mock("mantine-datatable", () => ({
  DataTable: ({ records, customRowAttributes, onRowClick, onRowDoubleClick }: any) => (
    <table>
      <tbody>
        {records.map((record: NormalizedGame, index: number) => (
          <tr
            key={record.id}
            onClick={() => onRowClick({ record, index })}
            onDoubleClick={() => onRowDoubleClick?.({ record, index })}
            {...customRowAttributes?.(record, index)}
          >
            <td>
              {record.white}
              <input aria-label="nested filter" />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  ),
}));

const file = { id: { id: "captured-database" }, kind: "database" } as const;
const games: NormalizedGame[] = [
  {
    id: 11,
    white: "First",
    white_id: 1,
    black: "A",
    black_id: 2,
    event: "First event",
    event_id: 1,
    site: "?",
    site_id: 1,
    result: "*",
    moves: "1. e4 *",
    fen: INITIAL_FEN,
  },
  {
    id: 22,
    white: "Second",
    white_id: 3,
    black: "B",
    black_id: 4,
    event: "Second event",
    event_id: 2,
    site: "?",
    site_id: 1,
    result: "*",
    moves: "7... d5 *",
    fen: "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 7",
  },
];
installMatchMediaStub();
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let host: HTMLDivElement;
let root: Root;
let jotai: ReturnType<typeof createStore>;
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  localStorage.clear();
  mocks.parsePGN
    .mockReset()
    .mockImplementation(async (_pgn: string, fen?: string) => defaultTree(fen));
  activeDatabaseViewStore.getState().setDatabase({ file, title: "Fixture" } as SuccessDatabaseInfo);
  jotai = createStore();
  jotai.set(tabsAtom, []);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  activeDatabaseViewStore.getState().clearDatabase();
});
async function render() {
  await act(async () =>
    root.render(
      <MantineProvider>
        <Provider store={jotai}>
          <DatabaseViewStateContext.Provider value={activeDatabaseViewStore}>
            <GameTable />
          </DatabaseViewStateContext.Provider>
        </Provider>
      </MantineProvider>,
    ),
  );
}
function openButton() {
  return [...host.querySelectorAll("button")].find((button) => button.textContent === "Open game")!;
}
function row(index: number) {
  return host.querySelectorAll("tr")[index];
}
async function doubleClick(index: number) {
  await act(async () => {
    row(index).dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
  });
}

test("single click previews, labelled button admits the selected content and database identity", async () => {
  const seed = vi.spyOn(tabStorage, "seed");
  await render();
  expect(openButton().disabled).toBe(true);
  await act(async () => row(1).click());
  expect(jotai.get(tabsAtom)).toHaveLength(0);
  expect(row(1).getAttribute("aria-selected")).toBe("true");
  expect(host.textContent).toContain(games[1].moves);
  await act(async () => openButton().click());
  expect(mocks.parsePGN).toHaveBeenCalledWith(games[1].moves, games[1].fen);
  expect(seed).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({ headers: games[1] }),
  );
  expect(jotai.get(tabsAtom)).toEqual([
    expect.objectContaining({
      name: "Second - B",
      gameOrigin: { kind: "database", database: file, gameId: 22 },
    }),
  ]);
  const stored = tabStorage.read<ReturnType<typeof defaultTree>>(jotai.get(tabsAtom)[0].value);
  expect(stored?.state.headers).toMatchObject({
    id: games[1].id,
    fen: games[1].fen,
    event: games[1].event,
    site: games[1].site,
    white: games[1].white,
    black: games[1].black,
    result: games[1].result,
  });
  expect(stored?.state.root.fen).toBe(games[1].fen);
  expect(stored?.state.root.halfMoves).toBe(13);
  expect(mocks.navigate).toHaveBeenCalledExactlyOnceWith({ to: "/" });
});

test("direct non-first double-click captures its target and all gestures share admission", async () => {
  let settle!: (tree: ReturnType<typeof defaultTree>) => void;
  mocks.parsePGN.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        settle = resolve;
      }),
  );
  await render();
  await doubleClick(1);
  await act(async () => {
    row(0).click();
    row(0).dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    openButton().click();
    row(1).dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
  });
  expect(mocks.parsePGN).toHaveBeenCalledTimes(1);
  expect(jotai.get(tabsAtom)).toHaveLength(0);
  await act(async () => settle(defaultTree(games[1].fen)));
  expect(jotai.get(tabsAtom)).toHaveLength(1);
  expect(jotai.get(tabsAtom)[0].gameOrigin).toEqual({
    kind: "database",
    database: file,
    gameId: 22,
  });
});

test("row Enter opens its own game and ignores repeated keys and nested inputs", async () => {
  await render();
  expect(row(1).tabIndex).toBe(0);
  await act(async () => {
    row(1).dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", repeat: true, bubbles: true }),
    );
    row(1)
      .querySelector("input")!
      .dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
  expect(mocks.parsePGN).not.toHaveBeenCalled();
  await act(async () => {
    row(1).dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
  expect(jotai.get(tabsAtom)[0].gameOrigin).toEqual({
    kind: "database",
    database: file,
    gameId: 22,
  });
});

test("refused storage admission and rejected parsing stay on the source and allow retry", async () => {
  await render();
  const seed = vi.spyOn(tabStorage, "seed").mockImplementationOnce(() => {
    throw new DOMException("quota", "QuotaExceededError");
  });
  await doubleClick(1);
  expect(jotai.get(tabsAtom)).toHaveLength(0);
  expect(mocks.navigate).not.toHaveBeenCalled();
  seed.mockRestore();
  mocks.parsePGN.mockRejectedValueOnce(new Error("parse refused"));
  await doubleClick(1);
  expect(mocks.notify).toHaveBeenCalledWith(expect.objectContaining({ message: "parse refused" }));
  expect(mocks.navigate).not.toHaveBeenCalled();
  await doubleClick(1);
  expect(jotai.get(tabsAtom)).toHaveLength(1);
  expect(mocks.navigate).toHaveBeenCalledOnce();
});
