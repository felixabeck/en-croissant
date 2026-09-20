import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { MantineProvider } from "@mantine/core";

const mocks = vi.hoisted(() => ({
  getFidePlayer: vi.fn(),
}));

type FideInfoProps = {
  opened: boolean;
  setOpened: (opened: boolean) => void;
  name: string;
};

type FideInfoComponent = (props: FideInfoProps) => ReactNode;
type SwrConfigComponent = (typeof import("swr"))["SWRConfig"];
type SwrConfigValue = Parameters<SwrConfigComponent>[0]["value"];

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

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = MockResizeObserver;

// `react-i18next` and the FIDE API are mocked statically for the whole file. They were per-case
// `vi.doMock`s until the retry case stopped using fake timers, at which point the changed ordering
// exposed the leak the plan review had predicted: `vi.resetModules()` does not clear the mock
// registry, and a `vi.doUnmock` in `afterEach` left a later case rendering against the real
// `react-i18next` ("useTranslation is not a function"). Only `mantine-flagpack` varies per case,
// so only it is registered dynamically.
// `AppModal` is replaced by a plain dialog element. The real one is a Mantine `Modal`: it portals
// out of the container and runs a Transition, which produced unactioned state updates and a
// five-second timeout in the cases that re-render. Nothing here asserts modal chrome — the cases
// are about what the flag loader does — so the shell is mocked and `@mantine/core` itself is left
// real, because the flag components rendered by the real `mantine-flagpack` need it.
vi.mock("../common/AppModal", () => ({
  default: ({
    children,
    opened,
    title,
  }: {
    children?: ReactNode;
    opened: boolean;
    title?: ReactNode;
  }) =>
    opened ? (
      <div role="dialog">
        <div>{title}</div>
        {children}
      </div>
    ) : null,
}));

vi.mock("@/utils/lichess/api", () => ({ getFidePlayer: mocks.getFidePlayer }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { year?: number }) =>
      key === "Databases.FIDE.Born" ? `Born ${options?.year}` : key,
  }),
}));

function mockFideInfoDependencies({ rejectFlagpack }: { rejectFlagpack: boolean }) {
  if (rejectFlagpack) {
    vi.doMock("mantine-flagpack", () => {
      throw new Error("flag pack unavailable");
    });
  } else {
    vi.doUnmock("mantine-flagpack");
  }
}

async function importFideInfo({ rejectFlagpack = false } = {}) {
  vi.resetModules();
  mockFideInfoDependencies({ rejectFlagpack });
  const flagpack = await import("./flagpack");
  const loadFlagpack = vi.spyOn(flagpack, "loadFlagpack");
  const [{ default: FideInfo }, { SWRConfig }] = await Promise.all([
    import("./FideInfo"),
    import("swr"),
  ]);
  return {
    FideInfo,
    SWRConfig,
    loadFlagpack,
  };
}

function player(name: string) {
  return {
    id: 1,
    name,
    title: "GM",
    federation: "NOR",
    year: 1990,
    standard: 1500,
    rapid: 1600,
    blitz: 1700,
  };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.clearAllMocks();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.doUnmock("mantine-flagpack");
});

async function renderFideInfo(
  FideInfo: FideInfoComponent,
  SWRConfig: SwrConfigComponent,
  props: FideInfoProps,
  swrValue: SwrConfigValue = { provider: () => new Map() },
) {
  await act(async () => {
    root.render(
      <MantineProvider>
        <SWRConfig value={swrValue}>
          <FideInfo {...props} />
        </SWRConfig>
      </MantineProvider>,
    );
  });
}

function modalText() {
  return document.querySelector('[role="dialog"]')?.textContent || "";
}

function flagSvgs() {
  return document.querySelectorAll('svg[viewBox="0 0 32 24"]');
}

test("an open modal renders the real federation flag", async () => {
  const { FideInfo, SWRConfig, loadFlagpack } = await importFideInfo();
  mocks.getFidePlayer.mockResolvedValue(player("Magnus"));

  await renderFideInfo(FideInfo, SWRConfig, {
    opened: true,
    setOpened: vi.fn(),
    name: "Magnus",
  });

  await vi.waitFor(() => expect(flagSvgs()).toHaveLength(1), { timeout: 15_000 });
  expect(loadFlagpack).toHaveBeenCalledOnce();
  expect(modalText()).toContain("Magnus");
});

test("a rejected flag import is silent and does not retry", async () => {
  const { FideInfo, SWRConfig, loadFlagpack } = await importFideInfo({ rejectFlagpack: true });
  mocks.getFidePlayer.mockResolvedValue(player("Test Player"));

  // Real timers with a 10 ms retry interval, not fake timers: this file mocks modules and
  // imports the component dynamically, and freezing the clock across that made the case
  // order-dependent under Stryker's full-suite dry run. `errorRetryInterval` shortens the
  // window the assertion below waits out; it deliberately does NOT set `shouldRetryOnError`,
  // which is the property under test — delete it from `FideInfo` and this case goes red.
  await renderFideInfo(
    FideInfo,
    SWRConfig,
    { opened: true, setOpened: vi.fn(), name: "Test Player" },
    { provider: () => new Map(), errorRetryInterval: 10 },
  );
  await vi.waitFor(() => expect(loadFlagpack).toHaveBeenCalledOnce());
  await vi.waitFor(() => expect(modalText()).toContain("Test Player"));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 200));
  });

  expect(loadFlagpack).toHaveBeenCalledOnce();
  expect(modalText()).toContain("GM");
  expect(modalText()).toContain("1500");
  expect(modalText()).toContain("1600");
  expect(modalText()).toContain("1700");
  expect(modalText()).not.toMatch(/error/i);
  expect(flagSvgs()).toHaveLength(0);
});

test("a fresh mount after a rejection makes one new flag-pack attempt", async () => {
  const { FideInfo, SWRConfig, loadFlagpack } = await importFideInfo({ rejectFlagpack: true });
  mocks.getFidePlayer.mockResolvedValue(player("Reopened Player"));
  const swrValue = { provider: () => new Map() };
  const props = { setOpened: vi.fn(), name: "Reopened Player" };

  await renderFideInfo(FideInfo, SWRConfig, { ...props, opened: true }, swrValue);
  await vi.waitFor(() => expect(loadFlagpack).toHaveBeenCalledOnce());
  await vi.waitFor(() => expect(modalText()).toContain("Reopened Player"));

  // The component is unmounted between the two opens, not merely closed. Closing it leaves a
  // mounted hook whose key goes null, and whether its revalidator is deregistered before the
  // reopen re-registers one is a React scheduling detail, not a contract: under Stryker's
  // full-suite run this case saw one call, under a single-file run two. What SWR does guarantee
  // is the pair this file pins at both ends — a fresh mount with no live revalidator on the key
  // revalidates once (here), and a mount while another revalidator on that key already holds the
  // error does not revalidate at all (the next case).
  await act(async () => root.render(null));
  await renderFideInfo(FideInfo, SWRConfig, { ...props, opened: true }, swrValue);
  await vi.waitFor(() => expect(loadFlagpack).toHaveBeenCalledTimes(2));

  expect(modalText()).toContain("Reopened Player");
  expect(flagSvgs()).toHaveLength(0);
});

test("a closed modal does not start either lookup", async () => {
  const { FideInfo, SWRConfig, loadFlagpack } = await importFideInfo();

  await renderFideInfo(FideInfo, SWRConfig, {
    opened: false,
    setOpened: vi.fn(),
    name: "Closed Player",
  });

  expect(mocks.getFidePlayer).not.toHaveBeenCalled();
  expect(loadFlagpack).not.toHaveBeenCalled();
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(flagSvgs()).toHaveLength(0);
});

test("a second mounted instance suppresses a retry after a shared failure", async () => {
  const { FideInfo, SWRConfig, loadFlagpack } = await importFideInfo({ rejectFlagpack: true });
  mocks.getFidePlayer.mockImplementation(async (name: string) => player(name));
  const swrValue = { provider: () => new Map() };

  async function renderPair(whiteOpened: boolean) {
    await act(async () => {
      root.render(
        <MantineProvider>
          <SWRConfig value={swrValue}>
            <FideInfo opened={whiteOpened} setOpened={vi.fn()} name="White Player" />
            <FideInfo opened={true} setOpened={vi.fn()} name="Black Player" />
          </SWRConfig>
        </MantineProvider>,
      );
    });
  }

  await renderPair(true);
  await vi.waitFor(() => expect(loadFlagpack).toHaveBeenCalledOnce());
  await vi.waitFor(() => expect(document.body.textContent).toContain("Black Player"));

  await renderPair(false);
  await renderPair(true);

  expect(loadFlagpack).toHaveBeenCalledOnce();
  expect(document.body.textContent).not.toContain("Common.Loading");
  expect(flagSvgs()).toHaveLength(0);
});

test("a player named fide-flagpack keeps the player and flag SWR entries separate", async () => {
  const { FideInfo, SWRConfig, loadFlagpack } = await importFideInfo();
  mocks.getFidePlayer.mockResolvedValue(player("fide-flagpack"));

  await renderFideInfo(FideInfo, SWRConfig, {
    opened: true,
    setOpened: vi.fn(),
    name: "fide-flagpack",
  });

  await vi.waitFor(() => expect(flagSvgs()).toHaveLength(1), { timeout: 15_000 });
  expect(loadFlagpack).toHaveBeenCalledOnce();
  expect(mocks.getFidePlayer).toHaveBeenCalledWith("fide-flagpack");
  expect(modalText()).toContain("fide-flagpack");
});
