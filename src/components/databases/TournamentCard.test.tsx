import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { DatabaseHandle, Event as Tournament } from "@/bindings";
import { DatabaseViewStateContext } from "./DatabaseViewStateContext";

const mocks = vi.hoisted(() => ({ getTournamentGames: vi.fn(), notify: vi.fn() }));
vi.mock("@/utils/db", () => ({ getTournamentGames: mocks.getTournamentGames }));
vi.mock("@/components/files/notifyError", () => ({ notifyUnlessCancelled: mocks.notify }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("zustand", () => ({
  useStore: (_store: unknown, selector: (state: unknown) => unknown) =>
    selector({ tournaments: { activeTab: "games" }, setTournamentsActiveTab: vi.fn() }),
}));
vi.mock("jotai", () => ({ useAtom: () => [[], vi.fn()], useSetAtom: () => vi.fn() }));
vi.mock("@/state/atoms", () => ({ activeTabAtom: {}, tabsAtom: {} }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@tabler/icons-react", () => ({ IconEye: () => null }));
vi.mock("mantine-datatable", () => ({ DataTable: () => null }));
vi.mock("@/components/common/IconAction", () => ({ IconAction: () => null }));
vi.mock("@/utils/tabs", () => ({ createTab: vi.fn() }));
vi.mock("@mantine/core", () => ({
  Paper: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Stack: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  useMantineTheme: () => ({ primaryColor: "blue" }),
  Tabs: Object.assign(({ children }: { children: ReactNode }) => <div>{children}</div>, {
    List: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    Tab: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    Panel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  }),
}));

import TournamentCard from "./TournamentCard";

const tournament = { id: 7, name: "Candidates" } as Tournament;
const file = (id: string): DatabaseHandle => ({ id: { id }, kind: "database" });
let root: Root;
let container: HTMLDivElement;
const cache = new Map();

beforeEach(() => {
  cache.clear();
  vi.clearAllMocks();
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
    root.render(
      <SWRConfig value={{ provider: () => cache }}>
        <DatabaseViewStateContext.Provider value={{} as never}>
          <TournamentCard tournament={tournament} file={database} />
        </DatabaseViewStateContext.Provider>
      </SWRConfig>,
    ),
  );
}

test("file replacement and unmount cancel the exact TournamentCard native request", async () => {
  const signals: AbortSignal[] = [];
  mocks.getTournamentGames.mockImplementation(
    (_file: unknown, _id: unknown, signal: AbortSignal) =>
      new Promise((_resolve, reject) => {
        signals.push(signal);
        signal.addEventListener(
          "abort",
          () => reject(new DOMException("Cancellation", "AbortError")),
          { once: true },
        );
      }),
  );
  await render(file("first"));
  await vi.waitFor(() => expect(signals).toHaveLength(1));
  await render(file("second"));
  await vi.waitFor(() => expect(signals).toHaveLength(2));
  expect(signals[0].aborted).toBe(true);
  expect(signals[1].aborted).toBe(false);
  await act(async () => root.render(null));
  await vi.waitFor(() => expect(signals[1].aborted).toBe(true));
  expect(mocks.notify).not.toHaveBeenCalled();
});

test("TournamentCard surfaces a genuine lookup failure", async () => {
  const failure = new Error("tournament lookup failed");
  mocks.getTournamentGames.mockRejectedValue(failure);
  await render(file("failed"));
  await vi.waitFor(() => expect(mocks.notify).toHaveBeenCalledWith("Common.Error", failure));
});
