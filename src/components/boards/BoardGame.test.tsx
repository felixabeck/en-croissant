import { beforeEach, expect, test, vi } from "vitest";
import type { OpponentSettings } from "./OpponentForm";

const mocks = vi.hoisted(() => ({
  getGameEngineLogs: vi.fn(),
  notifyUnlessCancelled: vi.fn(),
}));

vi.mock("@/platform/tauri", () => ({
  tauri: { getGameEngineLogs: mocks.getGameEngineLogs },
  tauriSubscriptions: {},
}));
vi.mock("@/platform/native", () => ({
  platform: () => "linux",
}));
vi.mock("@/components/files/notifyError", () => ({
  notifyListenerError: vi.fn(),
  notifyUnlessCancelled: mocks.notifyUnlessCancelled,
  runUnlessCancelled: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

test("engine player config carries the immutable application engine id", async () => {
  const { toPlayerConfig } = await import("./BoardGame");
  const settings = {
    type: "engine",
    engine: {
      type: "local",
      id: "engine-application-id",
      name: "Engine",
      version: "17",
      filename: "engine",
      handle: { id: { id: "engine-path-ref" }, kind: "engine" },
      settings: [
        { name: "MultiPV", type: "string", value: "4" },
        { name: "Threads", type: "string", value: "2" },
      ],
    },
    go: { t: "Depth", c: 20 },
  } as OpponentSettings;

  const config = toPlayerConfig(settings);

  expect(config).toMatchObject({
    type: "engine",
    engineId: "engine-application-id",
    options: [{ name: "Threads", type: "string", value: "2" }],
  });
});

test("a rejected game log fetch notifies once and resolves without an unhandled rejection", async () => {
  const failure = new Error("engine disconnected");
  mocks.getGameEngineLogs.mockRejectedValue(failure);
  const { fetchGameEngineLogs } = await import("./BoardGame");

  await expect(fetchGameEngineLogs("game-1", 7n, "white", "Common.Error")).resolves.toBeUndefined();

  expect(mocks.notifyUnlessCancelled).toHaveBeenCalledTimes(1);
  expect(mocks.notifyUnlessCancelled).toHaveBeenCalledWith("Common.Error", failure);
});
