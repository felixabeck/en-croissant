import { getDefaultStore } from "jotai";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { sessionsAtom } from "@/state/atoms";
import type { ManagedDatabaseInfo } from "@/utils/db";

const mocks = vi.hoisted(() => ({
  removeLichessAccount: vi.fn(),
  notificationsShow: vi.fn(),
  accountCard: vi.fn(),
}));

vi.mock("@/platform/tauri", () => ({
  tauri: { removeLichessAccount: mocks.removeLichessAccount },
}));
vi.mock("@mantine/notifications", () => ({
  notifications: { show: mocks.notificationsShow },
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/utils/chess.com/api", () => ({ getChessComAccount: vi.fn(), getStats: vi.fn() }));
vi.mock("@/utils/lichess/api", () => ({ getLichessAccount: vi.fn() }));
vi.mock("../home/AccountCard", () => ({
  AccountCard: (props: { logout: () => Promise<void> }) => {
    mocks.accountCard(props);
    return (
      <button type="button" onClick={() => void props.logout()}>
        Log out
      </button>
    );
  },
}));
vi.mock("../home/EmptyAccounts", () => ({ EmptyAccounts: () => <div>Empty</div> }));
import AccountCards from "./AccountCards";

vi.mock("./IconAction", () => ({ default: () => null }));
vi.mock("@tabler/icons-react", () => ({
  IconCheck: () => null,
  IconEdit: () => null,
  IconX: () => null,
}));
vi.mock("@mantine/core", () => ({
  Divider: () => null,
  Group: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Stack: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  TextInput: () => null,
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let container: HTMLDivElement;
let root: Root;

const session = {
  player: "Player",
  updatedAt: 1,
  lichess: {
    handle: "native-handle",
    username: "Player",
    account: { id: "player", username: "Player" },
  },
};

async function renderCards(databases: ManagedDatabaseInfo[] = []) {
  await act(async () => {
    root.render(
      <AccountCards databases={databases} setDatabases={vi.fn()} onAddAccount={vi.fn()} />,
    );
  });
}

async function logout() {
  await act(async () => {
    container.querySelector("button")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  getDefaultStore().set(sessionsAtom, [session]);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("Lichess account removal", () => {
  test("logs out after an uncertain committed removal and shows a warning", async () => {
    mocks.removeLichessAccount.mockResolvedValue({
      state: "removed",
      revocation_pending: false,
      durability_uncertain: true,
    });
    await renderCards();

    await logout();

    expect(getDefaultStore().get(sessionsAtom)).toEqual([]);
    expect(mocks.notificationsShow).toHaveBeenCalledWith({
      message: "Home.Accounts.RemoveDurabilityUncertain",
      color: "orange",
    });
  });

  test("keeps the local session when native reports not found", async () => {
    mocks.removeLichessAccount.mockResolvedValue({ state: "not_found" });
    await renderCards();

    await logout();

    expect(getDefaultStore().get(sessionsAtom)).toEqual([session]);
    expect(mocks.notificationsShow).not.toHaveBeenCalled();
  });
});

test.each(["lichess", "chesscom"] as const)(
  "%s filename matches ignore unreadable databases and retain usable matches",
  async (type) => {
    if (type === "chesscom")
      getDefaultStore().set(sessionsAtom, [
        { player: "Player", updatedAt: 1, chessCom: { username: "Player", stats: {} } },
      ]);
    const broken: ManagedDatabaseInfo = {
      type: "error",
      file: { id: { id: "broken" }, kind: "database" },
      filename: `Player_${type}.db3`,
      indexed: false,
      error: "unfinished",
    };
    await renderCards([broken]);
    expect(mocks.accountCard).toHaveBeenLastCalledWith(
      expect.objectContaining({ type, database: null }),
    );
    const usable: ManagedDatabaseInfo = {
      type: "success",
      file: { id: { id: "usable" }, kind: "database" },
      filename: broken.filename,
      title: "Player",
      description: "",
      indexed: false,
      player_count: 0,
      game_count: 0,
      event_count: 0,
      storage_size: 0n,
    };
    await renderCards([broken, usable]);
    expect(mocks.accountCard).toHaveBeenLastCalledWith(
      expect.objectContaining({ type, database: usable }),
    );
    await renderCards([{ ...usable, filename: "Other.db3" }]);
    expect(mocks.accountCard).toHaveBeenLastCalledWith(
      expect.objectContaining({ type, database: null }),
    );
  },
);
