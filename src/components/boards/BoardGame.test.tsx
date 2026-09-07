import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const atoms: Record<PropertyKey, symbol> = new Proxy({} as Record<PropertyKey, symbol>, {
    get: (target: Record<PropertyKey, symbol>, key) => (target[key] ??= Symbol(String(key))),
  });
  return {
    atoms,
    setHeaders: vi.fn(),
    startGame: vi.fn(),
    setters: new Map(),
  };
});

vi.mock("@/state/atoms", () => mocks.atoms);
vi.mock("jotai", () => ({
  useAtomValue: (atom: symbol) => {
    const a = mocks.atoms;
    if (atom === a.activeTabAtom) return "tab-1";
    if (atom === a.flipBoardAfterMoveAtom) return false;
    return undefined;
  },
  useAtom: (atom: symbol) => {
    const a = mocks.atoms;
    const values = new Map<symbol, unknown>([
      [a.gameInputColorAtom, "white"],
      [a.gamePlayer1SettingsAtom, { type: "human", name: "Alice" }],
      [a.gamePlayer2SettingsAtom, { type: "human", name: "Bob" }],
      [a.currentGameStateAtom, "settingUp"],
      [a.currentPlayersAtom, { white: { type: "human" }, black: { type: "human" } }],
      [a.currentGameIdAtom, null],
      [a.currentGameSessionAtom, null],
      [a.gameOpeningBookHandleAtom, null],
      [a.gameOpeningBookEnabledAtom, false],
      [a.gameOpeningBookMaxPlyAtom, 20],
      [a.gameSameTimeControlAtom, true],
      [a.tabsAtom, []],
    ]);
    if (!mocks.setters.has(atom)) mocks.setters.set(atom, vi.fn());
    return [values.get(atom), mocks.setters.get(atom)] as any;
  },
}));
vi.mock("zustand", () => ({
  useStore: (_store: unknown, selector: (state: unknown) => unknown) =>
    selector({
      root: { fen: "start", children: [] },
      headers: {},
      setFen: vi.fn(),
      setHeaders: mocks.setHeaders,
      setResult: vi.fn(),
      appendMove: vi.fn(),
      reset: vi.fn(),
    }),
}));
vi.mock("@/utils/chessops", () => ({ positionFromFen: () => [{ turn: "white" }, null] }));
vi.mock("@/platform/tauri", () => ({
  tauri: {
    startGame: mocks.startGame,
    abortGame: vi.fn(async () => undefined),
  },
  tauriSubscriptions: {
    gameMove: vi.fn(),
    clockUpdate: vi.fn(),
    gameOver: vi.fn(),
  },
}));
vi.mock("@/platform/useTauriListener", () => ({ useTauriListener: vi.fn() }));
vi.mock("@mantine/hooks", () => ({ useToggle: () => [false, vi.fn()] }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@mantine/core", () => {
  const Box = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    Box,
    Button: ({ children, onClick, disabled }: any) => (
      <button onClick={onClick} disabled={disabled}>
        {children}
      </button>
    ),
    Checkbox: () => null,
    Divider: () => null,
    Group: Box,
    NumberInput: () => null,
    Paper: Box,
    Portal: Box,
    ScrollArea: Box,
    SegmentedControl: () => null,
    Stack: Box,
    Text: Box,
  };
});
vi.mock("./OpponentForm", () => ({ OpponentForm: () => null }));
vi.mock("./Board", () => ({ default: () => null }));
vi.mock("./BoardControls", () => ({ default: () => null }));
vi.mock("./EditingCard", () => ({ default: () => null }));
vi.mock("../common/EngineLogsView", () => ({ default: () => null }));
vi.mock("../common/FileInput", () => ({ default: () => null }));
vi.mock("../common/GameInfo", () => ({ default: () => null }));
vi.mock("../common/GameNotation", () => ({ default: () => null }));
vi.mock("../common/MoveControls", () => ({ default: () => null }));
vi.mock("../common/IconAction", () => ({ default: () => null }));

import BoardGame from "./BoardGame";

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  mocks.setHeaders.mockReset();
  mocks.setters.clear();
  mocks.startGame.mockReset().mockResolvedValue({
    session: 1n,
    revision: 0n,
    initialFen: "start",
    moves: [],
    whitePlayer: "Alice",
    blackPlayer: "Bob",
    whiteTime: null,
    blackTime: null,
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

test("starting a human game records ChessFable as the PGN Site", async () => {
  await act(async () => root.render(<BoardGame />));
  const start = [...host.querySelectorAll("button")].find(
    (button) => button.textContent === "Board.Opponent.StartGame",
  );
  expect(start).toBeDefined();
  await act(async () => start?.click());
  expect(mocks.startGame).toHaveBeenCalledOnce();
  expect(mocks.setHeaders).toHaveBeenCalledWith(expect.objectContaining({ site: "ChessFable" }));
});
