import { act, type HTMLAttributes, type InputHTMLAttributes } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const fixtures = vi.hoisted(() => ({
  createFile: vi.fn(),
  createTab: vi.fn(),
  ensureFileWorkspace: vi.fn(),
  navigate: vi.fn(),
  storeSet: vi.fn(),
}));

vi.mock("@/platform/errors", () => ({
  normalizeError: (cause: unknown) => (cause instanceof Error ? cause : new Error(String(cause))),
}));
vi.mock("@/state/atoms", () => ({
  activeTabAtom: Symbol("active-tab"),
  addRecentFileAtom: Symbol("add-recent-file"),
  tabFamily: () => Symbol("tab-family"),
  tabsAtom: Symbol("tabs"),
}));
vi.mock("@/utils/chess", () => ({ headersToPGN: () => '[Event "White"]\n\n*' }));
vi.mock("@/utils/files", () => ({
  createFile: fixtures.createFile,
  ensureFileWorkspace: fixtures.ensureFileWorkspace,
}));
vi.mock("@/utils/tabs", () => ({ createTab: fixtures.createTab }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => fixtures.navigate }));
vi.mock("jotai", () => ({
  useAtom: () => [[], vi.fn()],
  useSetAtom: () => vi.fn(),
  useStore: () => ({ set: fixtures.storeSet }),
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("../common/AppModal", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@mantine/core", () => ({
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props} />,
  SegmentedControl: () => <div />,
  Stack: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>{children}</div>
  ),
  Text: ({ children, ...props }: HTMLAttributes<HTMLSpanElement>) => (
    <span {...props}>{children}</span>
  ),
  TextInput: (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

import CreateRepertoireModal from "./CreateRepertoireModal";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let container: HTMLDivElement;
let root: Root;
const setOpened = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  fixtures.ensureFileWorkspace.mockResolvedValue({ id: { id: "workspace" } });
  fixtures.createFile.mockResolvedValue({
    isErr: false,
    value: {
      type: "file",
      name: "White",
      handle: { id: { id: "file" }, kind: "fileWorkspace" },
      numGames: 1,
      metadata: { type: "repertoire", tags: [] },
      lastModified: 1,
    },
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function submitRepertoire() {
  await act(async () => {
    root.render(<CreateRepertoireModal opened setOpened={setOpened} />);
  });
  const input = container.querySelector("input")!;
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    valueSetter.call(input, "White");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    container
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await vi.waitFor(() => expect(fixtures.createTab).toHaveBeenCalledOnce());
}

test("keeps the modal state and metadata untouched when tab admission is refused", async () => {
  fixtures.createTab.mockResolvedValueOnce(null);

  await submitRepertoire();

  expect(fixtures.storeSet).not.toHaveBeenCalled();
  expect(fixtures.navigate).not.toHaveBeenCalled();
  expect(setOpened).not.toHaveBeenCalled();
});

test("acknowledges practice and recent metadata after successful admission", async () => {
  fixtures.createTab.mockResolvedValueOnce("tab-id");

  await submitRepertoire();

  expect(fixtures.storeSet).toHaveBeenCalledTimes(2);
  expect(fixtures.navigate).toHaveBeenCalledWith({ to: "/" });
  expect(setOpened).toHaveBeenCalledWith(false);
});
