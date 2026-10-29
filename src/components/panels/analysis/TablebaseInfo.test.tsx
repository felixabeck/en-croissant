import { MantineProvider } from "@mantine/core";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { installMatchMediaStub } from "@/tests/matchMedia";
import { installResizeObserverStub } from "@/tests/resizeObserver";
import TablebaseInfo from "./TablebaseInfo";

const mocks = vi.hoisted(() => ({ makeMove: vi.fn() }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("swr/immutable", () => ({
  default: () => ({
    data: {
      category: "win",
      moves: [{ category: "win", uci: "e2e4", san: "e4", dtz: 1, dtm: null }],
    },
    error: undefined,
    isLoading: false,
  }),
}));
vi.mock("@/utils/lichess/api", () => ({ getTablebaseInfo: vi.fn() }));
vi.mock("@/components/common/TreeStateContext", async () => {
  const { createContext } = await import("react");
  return { TreeStateContext: createContext(null) };
});
vi.mock("zustand", () => ({
  useStore: (_store: unknown, select: (state: { makeMove: typeof mocks.makeMove }) => unknown) =>
    select({ makeMove: mocks.makeMove }),
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
installMatchMediaStub();
installResizeObserverStub();

let root: ReturnType<typeof createRoot>;
let host: HTMLDivElement;
afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  mocks.makeMove.mockClear();
});

async function render(children: ReactNode) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<MantineProvider>{children}</MantineProvider>));
}

test.each([
  ["white", "WhiteWins", "var(--cf-eval-bar-light)", "var(--cf-eval-bar-dark)"],
  ["black", "BlackWins", "var(--cf-eval-bar-dark)", "var(--cf-eval-bar-light)"],
] as const)(
  "keeps %s as a chess side and inverts it for child outcomes",
  async (turn, winner, parentFill, childFill) => {
    await render(<TablebaseInfo fen="8/8/8/8/8/8/4P3/8 w - - 0 1" turn={turn} />);
    await act(async () =>
      host.querySelector<HTMLButtonElement>(".mantine-Accordion-control")!.click(),
    );
    const badges = [...host.querySelectorAll<HTMLElement>(".mantine-Badge-root")];
    const parent = badges.find((badge) => badge.textContent?.endsWith(winner))!;
    const child = badges.find((badge) => badge.textContent === "DTZ 1")!;
    expect(parent.style.getPropertyValue("--badge-bg")).toBe(parentFill);
    expect(child.style.getPropertyValue("--badge-bg")).toBe(childFill);

    await act(async () => child.closest<HTMLElement>(".mantine-Paper-root")!.click());
    expect(mocks.makeMove).toHaveBeenCalledExactlyOnceWith({ payload: { from: 12, to: 28 } });
  },
);
