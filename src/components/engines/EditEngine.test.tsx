import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { LocalEngine } from "@/utils/engines";

const mocks = vi.hoisted(() => ({
  engines: [] as LocalEngine[],
  saveEngines: vi.fn(),
  submit: undefined as undefined | ((value: LocalEngine) => Promise<unknown>),
}));
vi.mock("jotai", () => ({
  useAtom: () => [mocks.engines, mocks.saveEngines],
}));
vi.mock("@/state/atoms", () => ({ enginesAtom: {} }));
vi.mock("./EngineForm", () => ({
  default: ({ onSubmit }: { onSubmit: (value: LocalEngine) => Promise<unknown> }) => {
    mocks.submit = onSubmit;
    return null;
  },
}));
vi.mock("@mantine/form", () => ({ useForm: () => ({}) }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import EditEngine from "./EditEngine";

const original: LocalEngine = {
  type: "local",
  id: "target",
  name: "Original",
  version: "1",
  filename: "engine",
  handle: { id: { id: "binary" }, kind: "engine" },
};

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  mocks.engines = [original];
  mocks.saveEngines.mockImplementation(async (update) => {
    mocks.engines = update(mocks.engines);
    return { operationId: "operation", key: "engines", saved: true, synchronized: true };
  });
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.clearAllMocks();
});

test("resolves the immutable target id against latest state and preserves it", async () => {
  await act(async () => root.render(<EditEngine initialEngine={original} />));
  mocks.engines = [
    { ...original, id: "inserted", name: "Inserted" },
    { ...original, name: "Latest" },
  ];
  await act(async () => {
    await mocks.submit?.({ ...original, id: "json-injected", name: "Edited" });
  });
  expect(mocks.engines.map(({ id, name }) => ({ id, name }))).toEqual([
    { id: "inserted", name: "Inserted" },
    { id: "target", name: "Edited" },
  ]);
  expect(mocks.saveEngines).toHaveBeenCalledOnce();
});

test("does not resurrect a target deleted while the editor was open", async () => {
  await act(async () => root.render(<EditEngine initialEngine={original} />));
  mocks.engines = [];
  await act(async () => {
    await mocks.submit?.({ ...original, name: "Edited" });
  });
  expect(mocks.engines).toEqual([]);
});
