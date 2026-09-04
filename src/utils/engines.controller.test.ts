import { beforeEach, describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({
    stopEngine: vi.fn(),
    killEngine: vi.fn(),
    retireEngine: vi.fn(),
    getBestMoves: vi.fn(),
    getEngineWorkspace: vi.fn(),
    engineArchiveDestination: vi.fn(),
    downloadEngineArchive: vi.fn(),
    registerInstalledEngine: vi.fn(),
    getEngineConfig: vi.fn(),
}));

vi.mock("@/platform/tauri", async () => {
    const actual = await vi.importActual<typeof import("@/platform/tauri")>("@/platform/tauri");
    return { ...actual, tauri: native };
});

import { TauriCommandError } from "@/platform/tauri";
import {
    getBestMoves,
    installDefaultEngine,
    killEngine,
    registerInstalledEngineHandle,
    retireEngine,
    stopEngine,
    type DefaultEngine,
} from "./engines";

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

describe("engine registration recovery", () => {
    const root = { id: { id: "engine-root" }, kind: "engineRoot" as const };
    const handle = { id: { id: "adopted-engine" }, kind: "engine" as const };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("recovers the adopted handle after an uncertain registry commit", async () => {
        native.registerInstalledEngine
            .mockRejectedValueOnce(
                new TauriCommandError({
                    tag: "backend-error",
                    category: "durability",
                    message: "Committed but durability uncertain: registry replacement",
                }),
            )
            .mockResolvedValueOnce(handle);

        await expect(registerInstalledEngineHandle(root, "stockfish/stockfish")).resolves.toBe(
            handle,
        );
        expect(native.registerInstalledEngine).toHaveBeenCalledTimes(2);
        expect(native.registerInstalledEngine).toHaveBeenNthCalledWith(
            2,
            root,
            "stockfish/stockfish",
        );
    });

    it("does not retry an ordinary registration failure", async () => {
        const failure = new Error("native failed");
        native.registerInstalledEngine.mockRejectedValueOnce(failure);

        await expect(registerInstalledEngineHandle(root, "stockfish")).rejects.toBe(failure);
        expect(native.registerInstalledEngine).toHaveBeenCalledTimes(1);
    });

    it("keeps the recovered handle when installing a default engine", async () => {
        const manifest: DefaultEngine = {
            type: "local",
            id: "manifest-1",
            name: "Stockfish",
            version: "17",
            path: "stockfish-17/stockfish",
            sha256: "a".repeat(64),
            signature: "sig",
            downloadLink: "https://www.encroissant.org/engines/stockfish.zip",
        };
        native.getEngineWorkspace.mockResolvedValue(root);
        native.engineArchiveDestination.mockResolvedValue({ id: "dest" });
        native.downloadEngineArchive.mockResolvedValue(undefined);
        native.registerInstalledEngine
            .mockRejectedValueOnce(
                // Fallback-path coverage: classify() still matches this owned Display literal.
                new Error("Committed but durability uncertain: registry replacement"),
            )
            .mockResolvedValueOnce(handle);
        native.getEngineConfig.mockResolvedValue({
            name: "Stockfish 17",
            options: [
                { type: "spin", value: { name: "MultiPV", default: 1 } },
                { type: "spin", value: { name: "Threads", default: 1 } },
                { type: "spin", value: { name: "Hash", default: 16 } },
            ],
        });
        const uuid = vi
            .spyOn(crypto, "randomUUID")
            .mockReturnValueOnce("00000000-0000-4000-8000-00000000000a")
            .mockReturnValueOnce("00000000-0000-4000-8000-00000000000b");

        try {
            const installed = await installDefaultEngine(manifest, "engine_0");
            expect(installed.handle).toBe(handle);
            expect(installed.id).toBe("00000000-0000-4000-8000-00000000000b");
            expect(installed.filename).toBe("stockfish");
            expect(installed.downloadLink).toBe(manifest.downloadLink);
            expect(native.getEngineConfig).toHaveBeenCalledWith(handle);
        } finally {
            uuid.mockRestore();
        }
    });
});
