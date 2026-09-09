import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cancellationError } from "@/platform/tauri";

const mocks = vi.hoisted(() => ({
  lexPgn: vi.fn(),
  readGames: vi.fn(),
  notifyUnlessCancelled: vi.fn(),
}));

vi.mock("@/platform/tauri", async () => {
  const actual = await vi.importActual<typeof import("@/platform/tauri")>("@/platform/tauri");
  return {
    ...actual,
    tauri: {
      ...actual.tauri,
      lexPgn: mocks.lexPgn,
      readGames: mocks.readGames,
    },
  };
});

vi.mock("@/components/files/notifyError", () => ({
  notifyUnlessCancelled: mocks.notifyUnlessCancelled,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/chessground/Chessground", () => ({
  Chessground: () => <div data-testid="chessground" />,
}));

vi.mock("../common/GameNotation", () => ({
  default: () => <div data-testid="game-notation" />,
}));

vi.mock("../common/MoveControls", () => ({
  default: () => <div data-testid="move-controls" />,
}));

vi.mock("../common/OpeningName", () => ({
  default: () => <div data-testid="opening-name" />,
}));

import GamePreviewWrapper from "./GamePreview";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("GamePreviewWrapper", () => {
  let container: HTMLDivElement;
  let root: Root;
  const cache = new Map();

  beforeEach(() => {
    cache.clear();
    mocks.lexPgn.mockReset();
    mocks.readGames.mockReset();
    mocks.notifyUnlessCancelled.mockReset();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  function Tree({ pgn, sub1, sub2 }: { pgn: string; sub1: boolean; sub2: boolean }) {
    return (
      <SWRConfig value={{ provider: () => cache }}>
        {sub1 && <GamePreviewWrapper pgn={pgn} />}
        {sub2 && <GamePreviewWrapper pgn={pgn} />}
      </SWRConfig>
    );
  }

  test("shared request cancels only after last subscriber unmounts during lexing", async () => {
    let capturedSignal!: AbortSignal;
    mocks.lexPgn.mockImplementation((_pgn: string, options?: { signal?: AbortSignal }) => {
      if (options?.signal) capturedSignal = options.signal;
      return new Promise(() => {});
    });

    await act(async () => {
      root.render(<Tree pgn="1. e4 e5" sub1={true} sub2={true} />);
    });
    await vi.waitFor(() => expect(mocks.lexPgn).toHaveBeenCalledOnce());
    expect(capturedSignal).toBeDefined();
    expect(capturedSignal.aborted).toBe(false);

    // Unmount sub1: sub2 remains, so signal must not abort
    await act(async () => {
      root.render(<Tree pgn="1. e4 e5" sub1={false} sub2={true} />);
    });
    await act(async () => Promise.resolve());
    expect(capturedSignal.aborted).toBe(false);

    // Unmount sub2: last subscriber leaves, signal must abort
    await act(async () => {
      root.render(<Tree pgn="1. e4 e5" sub1={false} sub2={false} />);
    });
    await vi.waitFor(() => expect(capturedSignal.aborted).toBe(true));
    expect(mocks.notifyUnlessCancelled).not.toHaveBeenCalled();
  });

  test("key replacement cancels previous lexer work", async () => {
    let firstSignal!: AbortSignal;
    let secondSignal!: AbortSignal;
    mocks.lexPgn.mockImplementation((pgn: string, options?: { signal?: AbortSignal }) => {
      if (options?.signal) {
        if (pgn === "1. e4") {
          firstSignal = options.signal;
        } else {
          secondSignal = options.signal;
        }
      }
      return new Promise(() => {});
    });

    await act(async () => {
      root.render(<Tree pgn="1. e4" sub1={true} sub2={false} />);
    });
    await vi.waitFor(() => expect(mocks.lexPgn).toHaveBeenCalledOnce());
    expect(firstSignal.aborted).toBe(false);

    // Replace key with 1. d4
    await act(async () => {
      root.render(<Tree pgn="1. d4" sub1={true} sub2={false} />);
    });
    await vi.waitFor(() => expect(firstSignal.aborted).toBe(true));
    await vi.waitFor(() => expect(secondSignal).toBeDefined());
    expect(secondSignal.aborted).toBe(false);
  });

  test("genuine parser failures surface error notification while cancellation remains silent", async () => {
    // 1. Genuine parser error
    mocks.lexPgn.mockRejectedValueOnce(new Error("Corrupted PGN header"));

    await act(async () => {
      root.render(<Tree pgn="invalid-pgn" sub1={true} sub2={false} />);
    });
    await vi.waitFor(() =>
      expect(mocks.notifyUnlessCancelled).toHaveBeenCalledWith(
        "Common.Error",
        expect.objectContaining({ message: "Corrupted PGN header" }),
      ),
    );
    expect(container.querySelector("[data-testid='chessground']")).toBeNull();

    // 2. Cancellation error stays silent
    mocks.notifyUnlessCancelled.mockClear();
    mocks.lexPgn.mockRejectedValueOnce(cancellationError());

    await act(async () => {
      root.render(<Tree pgn="cancelled-pgn" sub1={true} sub2={false} />);
    });
    await vi.waitFor(() => expect(mocks.lexPgn).toHaveBeenCalledTimes(2));
    expect(container.querySelector("[data-testid='chessground']")).toBeNull();
  });

  test("cancel after readGames completed while lexer is held parsing: worker exits and neither data nor failure is published", async () => {
    const controller = new AbortController();
    mocks.readGames.mockResolvedValueOnce(["1. e4 e5 2. Nf3"]);

    let lexSignal!: AbortSignal;
    let rejectLex!: (reason?: unknown) => void;
    mocks.lexPgn.mockImplementation((_pgn: string, options?: { signal?: AbortSignal }) => {
      if (options?.signal) lexSignal = options.signal;
      return new Promise((_resolve, reject) => {
        rejectLex = reject;
        options?.signal?.addEventListener("abort", () => {
          reject(cancellationError());
        });
      });
    });

    // Simulate pipeline: readGames completes, then lexPgn is held
    const games = await mocks.readGames("file.pgn", 0, 0, { signal: controller.signal });
    expect(games).toEqual(["1. e4 e5 2. Nf3"]);

    // Component starts preview
    await act(async () => {
      root.render(<Tree pgn={games[0]} sub1={true} sub2={false} />);
    });
    await vi.waitFor(() => expect(mocks.lexPgn).toHaveBeenCalledOnce());
    expect(lexSignal).toBeDefined();
    expect(lexSignal.aborted).toBe(false);

    // Unmount before lexer finishes
    await act(async () => {
      root.render(<Tree pgn={games[0]} sub1={false} sub2={false} />);
    });
    await vi.waitFor(() => expect(lexSignal.aborted).toBe(true));

    // Allow mock cancellation to settle
    await act(async () => {
      rejectLex(cancellationError());
    });

    expect(mocks.notifyUnlessCancelled).not.toHaveBeenCalled();
    expect(container.querySelector("[data-testid='chessground']")).toBeNull();
  });

  test("late genuine parser rejection after last owner unmount does not notify", async () => {
    let rejectLex!: (reason?: unknown) => void;
    let lexSignal!: AbortSignal;
    mocks.lexPgn.mockImplementation((_pgn: string, options?: { signal?: AbortSignal }) => {
      if (options?.signal) lexSignal = options.signal;
      return new Promise((_resolve, reject) => {
        rejectLex = reject;
      });
    });

    await act(async () => {
      root.render(<Tree pgn="1. e4 e5" sub1={true} sub2={false} />);
    });
    await vi.waitFor(() => expect(mocks.lexPgn).toHaveBeenCalledOnce());
    expect(lexSignal.aborted).toBe(false);

    // Unmount subscriber
    await act(async () => {
      root.render(<Tree pgn="1. e4 e5" sub1={false} sub2={false} />);
    });
    expect(lexSignal.aborted).toBe(true);

    // Now lexer fails with genuine syntax/parser error
    await act(async () => {
      rejectLex(new Error("Malformed SAN move at ply 3"));
    });

    // Stale rejection after departure must remain silent
    expect(mocks.notifyUnlessCancelled).not.toHaveBeenCalled();
    expect(container.querySelector("[data-testid='chessground']")).toBeNull();
  });
});
