import { MantineProvider } from "@mantine/core";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import type { NormalizedGame } from "@/bindings";
import { installMatchMediaStub } from "@/tests/matchMedia";
import GameCard from "./GameCard";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string, options?: any) => options?.defaultValue ?? key }),
}));
vi.mock("../common/GameInfo", () => ({ default: () => null }));
vi.mock("./GamePreview", () => ({ default: () => null }));
installMatchMediaStub();
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

test("visible game action delegates its exact record and remains allocated without selection", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const game = { id: 42, white: "Second", black: "Opponent", moves: "1. d4 *" } as NormalizedGame;
  const onOpen = vi.fn();
  const file = { id: { id: "database" }, kind: "database" } as const;
  const render = (selected: NormalizedGame | undefined, pending = false) =>
    act(async () =>
      root.render(
        <MantineProvider>
          <GameCard
            game={selected}
            file={file}
            mutate={vi.fn()}
            pending={pending}
            onOpen={onOpen}
          />
        </MantineProvider>,
      ),
    );
  try {
    await render(undefined);
    const button = [...host.querySelectorAll("button")].find(
      (item) => item.textContent === "Open game",
    )!;
    expect(button).toBeDefined();
    expect(button.disabled).toBe(true);
    await render(game);
    expect(host.contains(button)).toBe(true);
    expect(button.disabled).toBe(false);
    await act(async () => button.click());
    expect(onOpen).toHaveBeenCalledExactlyOnceWith(game);
    await render(game, true);
    expect(button.disabled).toBe(true);
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
