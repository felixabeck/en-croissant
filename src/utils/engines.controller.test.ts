import { beforeEach, describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({
    stopEngine: vi.fn(),
    killEngine: vi.fn(),
    retireEngine: vi.fn(),
    getBestMoves: vi.fn(),
    prepareEngineSearch: vi.fn(),
    getEngineWorkspace: vi.fn(),
    engineArchiveDestination: vi.fn(),
    downloadEngineArchive: vi.fn(),
    registerInstalledEngine: vi.fn(),
    getEngineConfig: vi.fn(),
    isBmi2Compatible: vi.fn(),
    verifySignedBytes: vi.fn(),
}));

const remote = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/platform/http", () => ({ remoteHttp: remote }));
vi.mock("@/platform/native", () => ({ warn: vi.fn() }));

vi.mock("@/platform/tauri", async () => {
    const actual = await vi.importActual<typeof import("@/platform/tauri")>("@/platform/tauri");
    return { ...actual, tauri: native };
});

import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { SWRConfig } from "swr";
import { TauriCommandError } from "@/platform/tauri";
import engineCatalogDocument from "@/catalogs/engines.json?raw";
import engineCatalogSignature from "@/catalogs/engines.json.minisig?raw";
import {
    EngineCatalogVerificationError,
    loadDefaultEngineCatalog,
    useDefaultEngines,
    getBestMoves,
    prepareEngineSearch,
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
        await expect(stopEngine(engine, "tab-1", "9007199254740993")).resolves.toBeUndefined();
        await expect(killEngine(engine, "tab-1")).resolves.toBeUndefined();

        expect(native.stopEngine).toHaveBeenNthCalledWith(1, "engine-1", "tab-1", null);
        expect(native.stopEngine).toHaveBeenNthCalledWith(
            2,
            "engine-1",
            "tab-1",
            "9007199254740993",
        );
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
            getBestMoves(engine, "tab-2", { t: "Depth", c: 12 }, {} as never, "42"),
        ).resolves.toEqual([12, []]);
        expect(native.getBestMoves).toHaveBeenCalledWith(
            "engine-1",
            engine.handle,
            "tab-2",
            { t: "Depth", c: 12 },
            {},
            "42",
        );

        const failure = new Error("native analysis failed");
        native.getBestMoves.mockRejectedValueOnce(failure);
        await expect(
            getBestMoves(engine, "tab-2", { t: "Infinite" }, {} as never, "42"),
        ).rejects.toBe(failure);
    });

    it("prepares an opaque native search generation for the exact engine handle", async () => {
        native.prepareEngineSearch.mockResolvedValue("9007199254740993");

        await expect(prepareEngineSearch(engine, "tab-2")).resolves.toBe("9007199254740993");
        expect(native.prepareEngineSearch).toHaveBeenCalledWith("engine-1", engine.handle, "tab-2");
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
            downloadLink: "https://example.com/engines/stockfish.zip",
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

describe("bundled default-engine catalog", () => {
    beforeEach(() => {
        native.verifySignedBytes.mockReset();
        native.isBmi2Compatible.mockReset();
        remote.get.mockReset();
    });

    it("verifies the exact bundled bytes before parsing", async () => {
        native.verifySignedBytes.mockResolvedValue(null);
        const engines = await loadDefaultEngineCatalog();
        expect(native.verifySignedBytes).toHaveBeenCalledWith(
            engineCatalogDocument,
            engineCatalogSignature,
        );
        expect(engines.length).toBeGreaterThan(0);
        expect(engines.every((entry) => entry.type === "local")).toBe(true);
        expect(
            engines.every(
                (entry) =>
                    entry.imageUrl === undefined ||
                    /^\/engines\/[A-Za-z0-9._-]+\.(png|svg|jpe?g|webp)$/.test(entry.imageUrl),
            ),
        ).toBe(true);
    });

    it("reports a failed document signature as a distinct error without parsing", async () => {
        const failure = new Error("artifact manifest signature verification failed");
        native.verifySignedBytes.mockRejectedValue(failure);
        const parse = vi.spyOn(JSON, "parse");
        const error = await loadDefaultEngineCatalog("not json", "sig").catch((e: unknown) => e);
        expect(error).toBeInstanceOf(EngineCatalogVerificationError);
        expect((error as EngineCatalogVerificationError).cause).toBe(failure);
        expect(parse).not.toHaveBeenCalledWith("not json");
        parse.mockRestore();
    });

    async function renderDefaultEngines() {
        const seen: Array<ReturnType<typeof useDefaultEngines>> = [];
        function Probe() {
            seen.push(useDefaultEngines("linux", true));
            return null;
        }
        const container = document.createElement("div");
        const root = createRoot(container);
        await act(async () => {
            root.render(
                createElement(
                    SWRConfig,
                    { value: { provider: () => new Map(), dedupingInterval: 0 } },
                    createElement(Probe),
                ),
            );
        });
        await vi.waitFor(() => expect(seen.at(-1)?.isLoading).toBe(false));
        const result = seen.at(-1)!;
        act(() => root.unmount());
        return result;
    }

    it("filters the verified catalog by OS and BMI2 without any HTTP call", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch");
        native.isBmi2Compatible.mockResolvedValue(true);
        native.verifySignedBytes.mockResolvedValue(null);
        const { defaultEngines, error } = await renderDefaultEngines();
        expect(error).toBeUndefined();
        expect(defaultEngines?.length).toBeGreaterThan(0);
        expect(
            defaultEngines?.every(
                (entry) =>
                    (entry as typeof entry & { os: string; bmi2: boolean }).os === "linux" &&
                    (entry as typeof entry & { os: string; bmi2: boolean }).bmi2 === true,
            ),
        ).toBe(true);
        expect(remote.get).not.toHaveBeenCalled();
        expect(fetchSpy).not.toHaveBeenCalled();
        fetchSpy.mockRestore();
    });

    it("exposes a verification failure as an error rather than an empty list", async () => {
        native.isBmi2Compatible.mockResolvedValue(true);
        native.verifySignedBytes.mockRejectedValue(new Error("verification failed"));
        const { defaultEngines, error } = await renderDefaultEngines();
        expect(defaultEngines).toBeUndefined();
        expect(error).toBeInstanceOf(EngineCatalogVerificationError);
        expect(remote.get).not.toHaveBeenCalled();
    });
});
