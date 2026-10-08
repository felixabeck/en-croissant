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
  AccountCard: (props: { title: string; logout: () => Promise<void> }) => {
    mocks.accountCard(props);
    return (
      <button
        type="button"
        aria-label={`Log out ${props.title}`}
        onClick={() => void props.logout()}
      >
        Log out
      </button>
    );
  },
}));
vi.mock("../home/EmptyAccounts", () => ({ EmptyAccounts: () => <div>Empty</div> }));
import AccountCards from "./AccountCards";

vi.mock("./IconAction", () => ({
  default: ({ label, onClick }: { label: string; onClick: () => void }) => (
    <button type="button" aria-label={label} onClick={onClick} />
  ),
}));
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
  TextInput: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: React.ChangeEventHandler<HTMLInputElement>;
  }) => <input value={value} onChange={onChange} />,
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

const collidingSessions = [
  {
    player: "bob",
    updatedAt: 1,
    lichess: {
      username: "carol",
      account: { id: "carol", username: "carol" },
    },
  },
  {
    player: "Alice",
    updatedAt: 1,
    lichess: {
      username: "bob",
      account: { id: "bob", username: "bob" },
    },
  },
];

function playerGroup(name: string) {
  const heading = Array.from(container.querySelectorAll("span")).find(
    (element) => element.textContent === name,
  );
  const group = heading?.parentElement?.parentElement;
  if (!group) throw new Error(`Player group ${name} not found`);
  return group;
}

async function renderCards(databases: ManagedDatabaseInfo[] = []) {
  await act(async () => {
    root.render(<AccountCards databases={databases} onAddAccount={vi.fn()} />);
  });
}

async function logout() {
  await act(async () => {
    container
      .querySelector('button[aria-label^="Log out "]')
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
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

describe("Player session grouping", () => {
  test("groups by player alias when another account has the same username", async () => {
    getDefaultStore().set(sessionsAtom, collidingSessions);
    await renderCards();

    expect(
      Array.from(container.querySelectorAll("span"), (element) => element.textContent),
    ).toEqual(["bob", "Alice"]);
    expect(
      Array.from(playerGroup("bob").querySelectorAll('button[aria-label^="Log out "]'), (button) =>
        button.getAttribute("aria-label"),
      ),
    ).toEqual(["Log out carol"]);
    expect(
      Array.from(
        playerGroup("Alice").querySelectorAll('button[aria-label^="Log out "]'),
        (button) => button.getAttribute("aria-label"),
      ),
    ).toEqual(["Log out bob"]);
  });

  test("removing a player group preserves another player's matching username", async () => {
    getDefaultStore().set(sessionsAtom, collidingSessions);
    await renderCards();

    await act(async () => {
      playerGroup("bob")
        .querySelector('button[aria-label="Accounts.Remove"]')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(getDefaultStore().get(sessionsAtom)).toEqual([collidingSessions[1]]);
  });

  test("renaming a player group preserves another player's matching username", async () => {
    getDefaultStore().set(sessionsAtom, collidingSessions);
    await renderCards();
    const group = playerGroup("bob");

    await act(async () => {
      group
        .querySelector('button[aria-label="Accounts.EditName"]')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const input = group.querySelector("input");
    if (!input) throw new Error("Player name input not found");
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(
        input,
        "Robert",
      );
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    await act(async () => {
      group
        .querySelector('button[aria-label="Accounts.SaveName"]')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(getDefaultStore().get(sessionsAtom)).toEqual([
      { ...collidingSessions[0], player: "Robert" },
      collidingSessions[1],
    ]);
  });
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
