import { act, createRef } from "react";
import { createRoot } from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { afterEach, expect, test, vi } from "vitest";

const api = {
  destroy: vi.fn(),
  set: vi.fn(),
  playPremove: vi.fn(() => false),
  cancelPremove: vi.fn(),
  selectSquare: vi.fn(),
  state: { premovable: { current: undefined as string[] | undefined } },
  getFen: vi.fn(() => "start"),
};
const createChessground = vi.fn(() => api);

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
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

vi.mock("@lichess-org/chessground", () => ({ Chessground: createChessground }));

afterEach(() => {
  api.destroy.mockClear();
  api.set.mockClear();
  createChessground.mockClear();
});

test("constructs Chessground once, updates it, and destroys it on unmount", async () => {
  const host = document.createElement("div");
  const root = createRoot(host);
  const chessgroundRef = createRef<import("./Chessground").ChessgroundRef>();
  const { Chessground } = await import("./Chessground");

  await act(async () => {
    root.render(
      <MantineProvider>
        <Chessground ref={chessgroundRef} fen="start" orientation="white" />
      </MantineProvider>,
    );
  });
  await act(async () => {
    root.render(
      <MantineProvider>
        <Chessground ref={chessgroundRef} fen="8/8/8/8/8/8/8/8" orientation="black" />
      </MantineProvider>,
    );
  });
  expect(createChessground).toHaveBeenCalledTimes(1);
  expect(api.set).toHaveBeenCalled();

  api.selectSquare
    .mockImplementationOnce(() => undefined)
    .mockImplementationOnce(() => {
      api.state.premovable.current = ["e2", "e4"];
    });
  expect(chessgroundRef.current?.queuePremove("e2", "e4")).toBe(true);
  expect(api.selectSquare).toHaveBeenNthCalledWith(1, "e2");
  expect(api.selectSquare).toHaveBeenNthCalledWith(2, "e4");

  await act(async () => root.unmount());
  expect(api.destroy).toHaveBeenCalledTimes(1);
});
