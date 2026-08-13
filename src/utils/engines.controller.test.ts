import { describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({
    stopEngine: vi.fn(),
    killEngine: vi.fn(),
    getBestMoves: vi.fn(),
}));
const unwrap = vi.hoisted(() => vi.fn((value) => value));

vi.mock("@/platform/tauri", () => ({ tauri: native }));
vi.mock("./unwrap", () => ({ unwrap }));

import { getBestMoves, killEngine, stopEngine } from "./engines";

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
        native.stopEngine.mockResolvedValue({ ok: true });
        native.killEngine.mockResolvedValue({ ok: true });

        await expect(stopEngine(engine, "tab-1")).resolves.toBeUndefined();
        await expect(killEngine(engine, "tab-1")).resolves.toBeUndefined();

        expect(native.stopEngine).toHaveBeenCalledWith("engine-1", "tab-1");
        expect(native.killEngine).toHaveBeenCalledWith("engine-1", "tab-1");
        expect(unwrap).toHaveBeenCalledWith({ ok: true });
    });

    it("returns native analysis results and preserves native failures", async () => {
        native.getBestMoves.mockResolvedValue({ ok: [12, []] });
        unwrap.mockImplementationOnce((value) => value.ok);

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
