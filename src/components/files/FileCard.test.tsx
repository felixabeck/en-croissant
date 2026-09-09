import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cancellationError } from "@/platform/tauri";

const mocks = vi.hoisted(() => ({
  readGames: vi.fn(),
  navigate: vi.fn(),
  notifyUnlessCancelled: vi.fn(),
}));

vi.mock("@/platform/tauri", async () => {
  const actual = await vi.importActual<typeof import("@/platform/tauri")>("@/platform/tauri");
  return {
    ...actual,
    tauri: {
      ...actual.tauri,
      readGames: mocks.readGames,
    },
  };
});

vi.mock("@/components/files/notifyError", () => ({
  notifyUnlessCancelled: mocks.notifyUnlessCancelled,
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
}));

const t = (key: string) => key;
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t }),
}));

vi.mock("../databases/GamePreview", () => ({
  default: ({ pgn }: { pgn: string }) => <div data-testid="game-preview">{pgn}</div>,
}));

vi.mock("../panels/info/GameSelector", () => ({
  default: () => <div data-testid="game-selector" />,
}));

import { MantineProvider } from "@mantine/core";
import FileCard from "./FileCard";
import type { FileMetadata } from "./file";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: () => ({
    matches: false,
    media: "",
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

function renderWithMantine(ui: React.ReactNode, root: Root) {
  return act(async () => {
    root.render(<MantineProvider>{ui}</MantineProvider>);
  });
}

describe("FileCard", () => {
  let container: HTMLDivElement;
  let root: Root;

  const sampleFileA: FileMetadata = {
    type: "file",
    handle: { id: { id: "token-a" }, kind: "fileWorkspace" },
    name: "fileA",
    numGames: 5,
    metadata: { type: "game", tags: [] },
    lastModified: 1,
  };

  const sampleFileB: FileMetadata = {
    type: "file",
    handle: { id: { id: "token-b" }, kind: "fileWorkspace" },
    name: "fileB",
    numGames: 3,
    metadata: { type: "game", tags: [] },
    lastModified: 2,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  test("rapid file replacement aborts previous signal and prevents stale publication", async () => {
    const signals: AbortSignal[] = [];
    const resolvers: Array<(val: string[]) => void> = [];

    mocks.readGames.mockImplementation(
      (_handle: unknown, _start: number, _end: number, options?: { signal?: AbortSignal }) => {
        if (options?.signal) signals.push(options.signal);
        return new Promise<string[]>((resolve) => {
          resolvers.push(resolve);
        });
      },
    );

    await renderWithMantine(
      <FileCard
        selected={sampleFileA}
        games={new Map()}
        setGames={vi.fn()}
        toggleEditModal={vi.fn()}
      />,
      root,
    );

    expect(mocks.readGames).toHaveBeenCalledTimes(1);
    expect(signals[0].aborted).toBe(false);

    // Rapid switch to file B
    await renderWithMantine(
      <FileCard
        selected={sampleFileB}
        games={new Map()}
        setGames={vi.fn()}
        toggleEditModal={vi.fn()}
      />,
      root,
    );

    expect(signals[0].aborted).toBe(true);
    expect(mocks.readGames).toHaveBeenCalledTimes(2);
    expect(signals[1].aborted).toBe(false);

    // Resolve stale request from file A
    await act(async () => {
      resolvers[0](["pgn-from-file-A"]);
    });
    // Stale result should NOT be published
    expect(container.querySelector("[data-testid='game-preview']")).toBeNull();

    // Resolve request from file B
    await act(async () => {
      resolvers[1](["pgn-from-file-B"]);
    });
    expect(container.querySelector("[data-testid='game-preview']")?.textContent).toBe(
      "pgn-from-file-B",
    );
  });

  test("unmount aborts in-flight readGames signal", async () => {
    let capturedSignal!: AbortSignal;
    mocks.readGames.mockImplementation(
      (_handle: unknown, _start: number, _end: number, options?: { signal?: AbortSignal }) => {
        if (options?.signal) capturedSignal = options.signal;
        return new Promise(() => {});
      },
    );

    await renderWithMantine(
      <FileCard
        selected={sampleFileA}
        games={new Map()}
        setGames={vi.fn()}
        toggleEditModal={vi.fn()}
      />,
      root,
    );

    expect(capturedSignal).toBeDefined();
    expect(capturedSignal.aborted).toBe(false);

    await act(async () => {
      root.unmount();
    });
    expect(capturedSignal.aborted).toBe(true);
  });

  test("cancelled readGames does not show failure notification", async () => {
    mocks.readGames.mockRejectedValue(cancellationError());

    await renderWithMantine(
      <FileCard
        selected={sampleFileA}
        games={new Map()}
        setGames={vi.fn()}
        toggleEditModal={vi.fn()}
      />,
      root,
    );

    expect(mocks.notifyUnlessCancelled).not.toHaveBeenCalled();
    expect(container.querySelector("[data-testid='game-preview']")).toBeNull();
  });

  test("active readGames error triggers notification", async () => {
    const error = new Error("Failed to read game");
    mocks.readGames.mockRejectedValue(error);

    await renderWithMantine(
      <FileCard
        selected={sampleFileA}
        games={new Map()}
        setGames={vi.fn()}
        toggleEditModal={vi.fn()}
      />,
      root,
    );

    expect(mocks.notifyUnlessCancelled).toHaveBeenCalledWith("Common.Error", error);
    expect(container.querySelector("[data-testid='game-preview']")).toBeNull();
  });

  test("obsolete readGames failure after switch stays silent", async () => {
    let rejectA!: (err: unknown) => void;
    mocks.readGames.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectA = reject;
        }),
    );

    await renderWithMantine(
      <FileCard
        selected={sampleFileA}
        games={new Map()}
        setGames={vi.fn()}
        toggleEditModal={vi.fn()}
      />,
      root,
    );

    // Switch to file B before A fails
    mocks.readGames.mockResolvedValueOnce(["pgn-b"]);
    await renderWithMantine(
      <FileCard
        selected={sampleFileB}
        games={new Map()}
        setGames={vi.fn()}
        toggleEditModal={vi.fn()}
      />,
      root,
    );

    // Now A fails late
    await act(async () => {
      rejectA(new Error("Stale disk read error"));
    });

    expect(mocks.notifyUnlessCancelled).not.toHaveBeenCalled();
    expect(container.querySelector("[data-testid='game-preview']")?.textContent).toBe("pgn-b");
  });
});
