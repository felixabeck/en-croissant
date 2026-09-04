import { MantineProvider } from "@mantine/core";
import { Provider, createStore } from "jotai";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { ErrorCategory, PuzzleDatabaseInfo, PuzzleRootDescriptor } from "@/bindings";
import { TreeStateProvider } from "@/components/common/TreeStateContext";
import { selectedPuzzleDbAtom } from "@/state/atoms";
import { TauriCommandError } from "@/platform/tauri";
import Puzzles from "./Puzzles";

const mocks = vi.hoisted(() => ({
  getPuzzleWorkspace: vi.fn(),
  listPuzzleDatabases: vi.fn(),
  getPuzzleThemes: vi.fn(),
}));

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/platform/tauri", async () => {
  const actual = await vi.importActual<typeof import("@/platform/tauri")>("@/platform/tauri");
  return {
    ...actual,
    tauri: {
      getPuzzleWorkspace: mocks.getPuzzleWorkspace,
      listPuzzleDatabases: mocks.listPuzzleDatabases,
      getPuzzleThemes: mocks.getPuzzleThemes,
    },
  };
});
vi.mock("./PuzzleBoard", () => ({ default: () => null }));
vi.mock("./AddPuzzle", () => ({ default: () => null }));
vi.mock("../common/ConfirmModal", () => ({ default: () => null }));
vi.mock("../common/GameNotation", () => ({ default: () => null }));
vi.mock("../common/MoveControls", () => ({ default: () => null }));
vi.mock("../common/ChallengeHistory", () => ({ default: () => null }));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }),
});
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(window, "ResizeObserver", {
  writable: true,
  value: ResizeObserverStub,
});

const selectedDb = { id: "puzzle-db-1" };
const selectedDatabase: PuzzleDatabaseInfo = {
  title: "Tactics.db3",
  description: "Tactics",
  puzzleCount: 1,
  storageSize: 1n,
  path: selectedDb,
};
const workspace: PuzzleRootDescriptor = {
  root: { id: { id: "puzzle-root" }, kind: "puzzleRoot" },
  displayName: "Puzzles",
};

function commandError(category: ErrorCategory, message: string) {
  return new TauriCommandError({
    tag: "backend-error",
    category,
    message,
  });
}

function outdatedAlert() {
  return [...document.querySelectorAll('[role="alert"]')].find((element) =>
    element.textContent?.includes("Puzzle.DatabaseOutdated"),
  );
}

let root: Root;
let host: HTMLDivElement;
let portals: HTMLDivElement;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem("puzzle-db", JSON.stringify(selectedDb));
  mocks.getPuzzleWorkspace.mockResolvedValue(workspace);
  mocks.listPuzzleDatabases.mockResolvedValue([selectedDatabase]);
  host = document.createElement("div");
  portals = document.createElement("div");
  portals.innerHTML = `<div id="left"></div><div id="topRight"></div><div id="bottomRight"></div>`;
  document.body.append(portals, host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  portals.remove();
  localStorage.clear();
  sessionStorage.clear();
});

async function renderPuzzles() {
  const store = createStore();
  store.set(selectedPuzzleDbAtom, selectedDb);
  await act(async () => {
    root.render(
      <MantineProvider>
        <Provider store={store}>
          <TreeStateProvider>
            <Puzzles id="puzzles-test" />
          </TreeStateProvider>
        </Provider>
      </MantineProvider>,
    );
    await Promise.resolve();
  });
  await act(async () => {
    const settings = document.querySelector<HTMLButtonElement>('[aria-label="SideBar.Settings"]');
    settings?.click();
  });
}

test("shows the outdated-database alert for puzzle-themes-unavailable", async () => {
  // Message is neither the old Diesel substring nor the variant Display.
  mocks.getPuzzleThemes.mockRejectedValue(
    commandError("puzzle-themes-unavailable", "native failed"),
  );
  await renderPuzzles();
  await vi.waitFor(() => {
    expect(outdatedAlert()).toBeTruthy();
  });
});

test("does not show the alert for a database failure that still mentions no such table", async () => {
  mocks.getPuzzleThemes.mockRejectedValue(commandError("database", "no such table: themes"));
  await renderPuzzles();
  await vi.waitFor(() => {
    expect(mocks.getPuzzleThemes).toHaveBeenCalled();
  });
  expect(outdatedAlert()).toBeUndefined();
});

test("does not show the alert for a missing-resource failure that shares not-found", async () => {
  mocks.getPuzzleThemes.mockRejectedValue(commandError("missing-resource", "native failed"));
  await renderPuzzles();
  await vi.waitFor(() => {
    expect(mocks.getPuzzleThemes).toHaveBeenCalled();
  });
  expect(outdatedAlert()).toBeUndefined();
});

test("does not show the alert when puzzle themes load", async () => {
  mocks.getPuzzleThemes.mockResolvedValue(["fork"]);
  await renderPuzzles();
  await vi.waitFor(() => {
    expect(mocks.getPuzzleThemes).toHaveBeenCalled();
  });
  expect(outdatedAlert()).toBeUndefined();
});
