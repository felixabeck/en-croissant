import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const native = vi.hoisted(() => ({
  getEngineWorkspace: vi.fn(),
  openEngineWorkspace: vi.fn(),
}));

vi.mock("@/platform/tauri", () => ({ tauri: native }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("./IconAction", () => ({
  IconAction: ({ label, onClick }: { label: string; onClick: () => void }) => (
    <button type="button" aria-label={label} onClick={onClick}>
      Open
    </button>
  ),
}));

import OpenFolderButton from "./OpenFolderButton";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  native.getEngineWorkspace.mockResolvedValue({ id: { id: "engine-root" }, kind: "engineRoot" });
  native.openEngineWorkspace.mockResolvedValue(undefined);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

test("opens only the native engine workspace capability", async () => {
  await act(async () => root.render(<OpenFolderButton />));
  await act(async () => container.querySelector("button")!.click());

  expect(native.getEngineWorkspace).toHaveBeenCalledOnce();
  expect(native.openEngineWorkspace).toHaveBeenCalledWith({
    id: { id: "engine-root" },
    kind: "engineRoot",
  });
});
