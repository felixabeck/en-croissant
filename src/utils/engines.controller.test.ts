import { describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({
    stopEngine: vi.fn(),
    killEngine: vi.fn(),
    retireEngine: vi.fn(),
    getBestMoves: vi.fn(),
}));

vi.mock("@/platform/tauri", () => ({ tauri: native }));

import { getBestMoves, killEngine, retireEngine, stopEngine } from "./engines";

const engine = {
    type: "local" as const,
    id: "engine-1",
    name: "Stockfish",
    version: "17",
    filename: "stockfish",
    handle: { id: { id: "engine-capability" }, kind: "engine" as const },
};

describe("engine IPC controllers", () => {
    it("stops and kills the selected engine through the opaque engine id", async () => {
        native.stopEngine.mockResolvedValue(undefined);
        native.killEngine.mockResolvedValue(undefined);

        await expect(stopEngine(engine, "tab-1")).resolves.toBeUndefined();
        await expect(killEngine(engine, "tab-1")).resolves.toBeUndefined();

        expect(native.stopEngine).toHaveBeenCalledWith("engine-1", "tab-1");
        expect(native.killEngine).toHaveBeenCalledWith("engine-1", "tab-1");
    });

    it("retires every process owned by the immutable engine id", async () => {
        native.retireEngine.mockResolvedValue(undefined);

        await expect(retireEngine(engine)).resolves.toBeUndefined();

        expect(native.retireEngine).toHaveBeenCalledWith("engine-1");
    });

    it("returns native analysis results and preserves native failures", async () => {
        native.getBestMoves.mockResolvedValue([12, []]);

        await expect(
            getBestMoves(engine, "tab-2", { t: "Depth", c: 12 }, {} as never),
        ).resolves.toEqual([12, []]);
        expect(native.getBestMoves).toHaveBeenCalledWith(
            "engine-1",
            engine.handle,
            "tab-2",
            { t: "Depth", c: 12 },
            {},
        );

        const failure = new Error("native analysis failed");
        native.getBestMoves.mockRejectedValueOnce(failure);
        await expect(getBestMoves(engine, "tab-2", { t: "Infinite" }, {} as never)).rejects.toBe(
            failure,
        );
    });
});
