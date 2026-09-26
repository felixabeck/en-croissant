import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { PlayerGameInfo } from "@/bindings";

dayjs.extend(customParseFormat);

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@mantine/core", () => {
  const Container = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  return {
    Box: Container,
    Divider: () => <hr />,
    Group: Container,
    ScrollArea: Container,
    Stack: Container,
    Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  };
});
vi.mock("recharts", () => ({
  Bar: () => null,
  BarChart: ({ data }: { data: { name: string; count: number }[] }) => (
    <div data-testid="month-data">{data.map((row) => `${row.name}:${row.count}`).join("|")}</div>
  ),
  Area: () => null,
  AreaChart: ({ data }: { data: { date: number; player_elo: number }[] }) => (
    <div data-testid="rating-data">{data.map((row) => row.player_elo).join("|")}</div>
  ),
  CartesianGrid: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));
vi.mock("./ResultsChart", () => ({
  default: ({ won, draw, lost }: { won: number; draw: number; lost: number }) => (
    <div data-testid="result-counts">
      {won}:{draw}:{lost}
    </div>
  ),
}));
vi.mock("./TimeControlSelector", () => ({ default: () => null }));
vi.mock("./WebsiteAccountSelector", () => ({ default: () => null }));
vi.mock("./DateRangeTabs", () => ({
  DateRange: {
    SevenDays: "7 days",
    ThirtyDays: "30 days",
    NinetyDays: "90 days",
    OneYear: "1 year",
    AllTime: "All time",
  },
  default: () => null,
}));
vi.mock("./TimeRangeSlider", () => ({ default: () => null }));
vi.mock("@/platform/tauri", () => ({ tauri: { getOpeningFromName: vi.fn() } }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 120,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({ index, size: 120, start: index * 120 })),
  }),
}));
vi.mock("jotai", () => ({ useAtom: () => [[], vi.fn()], useAtomValue: () => 100 }));
vi.mock("@/state/atoms", () => ({ fontSizeAtom: {}, tabsAtom: {} }));
vi.mock("@/components/files/notifyError", () => ({ notifyUnlessCancelled: vi.fn() }));
vi.mock("@/utils/chess", () => ({ parsePGN: vi.fn() }));
vi.mock("@/utils/tabs", () => ({ createTab: vi.fn(), runTabCreation: vi.fn() }));
vi.mock("@/utils/treeReducer", () => ({ countMainPly: vi.fn(), defaultTree: vi.fn() }));

import OpeningsPanel from "./OpeningsPanel";
import OverviewPanel from "./OverviewPanel";
import RatingsPanel from "./RatingsPanel";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const duplicatedDailyStatistics: PlayerGameInfo = {
  site_stats_data: [
    {
      site: "Lichess",
      player: "Magnus",
      daily: [
        {
          date: "2026.09.02",
          time_control: "600+0",
          won: 2,
          drawn: 1,
          lost: 0,
          max_player_elo: 2_800,
        },
        {
          date: "2026.10.01",
          time_control: "600+0",
          won: 0,
          drawn: 0,
          lost: 1,
          max_player_elo: 2_810,
        },
      ],
      openings: [],
    },
    {
      site: "Lichess",
      player: "Magnus",
      daily: [
        {
          date: "2026.09.02",
          time_control: "600+0",
          won: 1,
          drawn: 0,
          lost: 1,
          max_player_elo: 2_820,
        },
      ],
      openings: [],
    },
  ],
};

const duplicatedOpeningStatistics: PlayerGameInfo = {
  site_stats_data: [
    {
      site: "Lichess",
      player: "Magnus",
      daily: [],
      openings: [
        {
          time_control: "600+0",
          is_player_white: true,
          opening: "Sicilian Defense",
          won: 2,
          drawn: 1,
          lost: 0,
        },
        {
          time_control: "600+0",
          is_player_white: true,
          opening: "French Defense",
          won: 0,
          drawn: 1,
          lost: 0,
        },
        {
          time_control: "600+0",
          is_player_white: false,
          opening: "Caro-Kann Defense",
          won: 0,
          drawn: 0,
          lost: 2,
        },
      ],
    },
    {
      site: "Lichess",
      player: "Magnus",
      daily: [],
      openings: [
        {
          time_control: "600+0",
          is_player_white: true,
          opening: "Sicilian Defense",
          won: 1,
          drawn: 0,
          lost: 1,
        },
        {
          time_control: "600+0",
          is_player_white: false,
          opening: "Caro-Kann Defense",
          won: 1,
          drawn: 1,
          lost: 0,
        },
      ],
    },
  ],
};

let container: HTMLDivElement;
let root: Root;

async function render(component: React.ReactNode) {
  await act(async () => root.render(component));
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

test("Overview sums duplicate daily keys into result totals and month buckets", async () => {
  await render(<OverviewPanel playerName="Magnus" info={duplicatedDailyStatistics} isDatabase />);

  expect(container.textContent).toContain("6 Common.Games");
  expect(container.querySelector("[data-testid='result-counts']")?.textContent).toBe("3:1:2");
  expect(container.querySelector("[data-testid='month-data']")?.textContent).toBe(
    "2026-09:5|2026-10:1",
  );
});

test("Ratings sums duplicate daily keys and takes the highest rating for each date", async () => {
  await render(<RatingsPanel playerName="Magnus" info={duplicatedDailyStatistics} isDatabase />);

  expect(container.textContent).toContain("6 Common.Games");
  expect(container.querySelector("[data-testid='result-counts']")?.textContent).toBe("3:1:2");
  expect(container.querySelector("[data-testid='rating-data']")?.textContent).toBe("2820|2810");
});

test("Openings sums duplicate opening keys and retains each colour's results", async () => {
  await render(<OpeningsPanel playerName="Magnus" info={duplicatedOpeningStatistics} isDatabase />);

  expect(container.textContent).toContain("Sicilian Defense");
  expect(container.textContent).toContain("83.33%");
  expect(container.textContent).toContain("French Defense");
  expect(container.textContent).toContain("16.67%");
  expect(container.textContent).toContain("Caro-Kann Defense");
  expect(container.textContent).toContain("100.00%");
  expect(
    Array.from(
      container.querySelectorAll("[data-testid='result-counts']"),
      (node) => node.textContent,
    ),
  ).toEqual(["3:1:1", "1:1:2", "0:1:0"]);
});
