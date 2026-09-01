import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  scoreTypeFamily: vi.fn((_engineId: string) => Symbol("scoreType")),
}));

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/state/atoms", () => ({
  moveHighlightAtom: Symbol("moveHighlightAtom"),
  previewBoardOnHoverAtom: Symbol("previewBoardOnHoverAtom"),
  scoreTypeFamily: mocks.scoreTypeFamily,
}));
vi.mock("jotai", () => ({
  useAtom: () => ["cp", vi.fn()],
  useAtomValue: () => false,
}));
vi.mock("@/utils/chessops", () => ({ positionFromFen: () => [null] }));
vi.mock("@mantine/hooks", () => ({ useForceUpdate: () => vi.fn() }));
vi.mock("@mantine/core", () => {
  const Container = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    Box: Container,
    CopyButton: ({ value, children }: any) => (
      <div data-testid="copy-value" data-value={value}>
        {children({ copied: false, copy: vi.fn() })}
      </div>
    ),
    Flex: Container,
    Portal: Container,
    rem: (value: number) => value,
    Table: { Tr: Container, Td: Container, Th: Container },
  };
});
vi.mock("@tabler/icons-react", () => ({
  IconCheck: () => null,
  IconChevronDown: () => null,
  IconCopy: () => null,
}));
vi.mock("@/components/common/IconAction", () => ({
  IconAction: ({ label, onClick, children }: any) => (
    <button type="button" aria-label={label} onClick={onClick}>
      {children}
    </button>
  ),
}));
vi.mock("./ScoreBubble", () => ({ default: () => null }));
vi.mock("@/components/common/MoveCell", () => ({ default: () => null }));
vi.mock("@/chessground/Chessground", () => ({ Chessground: () => null }));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.clearAllMocks();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

test("keys score display by id while copied output keeps the engine name", async () => {
  const AnalysisRow = (await import("./AnalysisRow")).default;
  await act(async () => {
    root.render(
      <>
        <AnalysisRow
          engineId="engine-uuid-1"
          engineName="Duplicate"
          score={{ value: { type: "cp", value: 34 }, wdl: null }}
          moves={[]}
          halfMoves={0}
          threat={false}
          fen="irrelevant"
          orientation="white"
        />
        <AnalysisRow
          engineId="engine-uuid-2"
          engineName="Duplicate"
          score={{ value: { type: "cp", value: 21 }, wdl: null }}
          moves={[]}
          halfMoves={0}
          threat={false}
          fen="irrelevant"
          orientation="white"
        />
      </>,
    );
  });

  expect(mocks.scoreTypeFamily.mock.calls.map(([id]) => id)).toEqual([
    "engine-uuid-1",
    "engine-uuid-2",
  ]);
  await act(async () => {
    (host.querySelectorAll('[aria-label="Board.Analysis.Expand"]')[0] as HTMLButtonElement).click();
  });
  const copied = host.querySelector('[data-testid="copy-value"]')?.getAttribute("data-value");
  expect(copied).toContain("Duplicate");
  expect(copied).not.toContain("engine-uuid-1");
});
