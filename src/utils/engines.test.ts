import { describe, expect, it } from "vitest";
import {
    defaultEngineManifestSchema,
    engineSchema,
    isManifestEngineInstalled,
    type LocalEngine,
} from "./engines";

const manifestEntry = {
    type: "local" as const,
    name: "Stockfish",
    version: "17",
    downloadLink: "https://www.encroissant.org/engines/stockfish.zip",
    sha256: "a".repeat(64),
    signature: "minisign signature",
    os: "linux" as const,
    bmi2: true,
};

function parseManifestPath(path: string) {
    return defaultEngineManifestSchema.safeParse({ ...manifestEntry, path });
}

describe("default engine manifest paths", () => {
    it("accepts single- and multi-component engine paths", () => {
        const accepted = ["stockfish", "stockfish-17/stockfish-ubuntu-x86-64-bmi2"];
        // Compared as a whole so a failure names the offending path; `expect` takes no message
        // argument under oxlint's `valid-expect`.
        expect(accepted.map((path) => [path, parseManifestPath(path).success])).toStrictEqual(
            accepted.map((path) => [path, true]),
        );
    });

    it("rejects paths the backend cannot safely resolve", () => {
        const rejected = [
            ["/etc/passwd", "leading slash"],
            ["../../evil", "parent-directory segment"],
            ["a//b", "empty segment from a doubled slash"],
            ["a/./b", "current-directory segment"],
            ["a/", "trailing empty segment"],
            ["/a", "leading slash"],
            ["a\0b", "NUL"],
            ["C:\\Windows\\system32", "backslash"],
            ["C:/Windows/system32", "Windows drive prefix"],
            ["C:evil", "Windows drive prefix"],
        ] as const;

        expect(
            rejected.map(([path, reason]) => [
                `${path}: ${reason}`,
                parseManifestPath(path).success,
            ]),
        ).toStrictEqual(rejected.map(([path, reason]) => [`${path}: ${reason}`, false]));
    });
});

describe("default-engine installed identity", () => {
    const stockfish: LocalEngine = {
        type: "local",
        id: "installed-1",
        name: "Stockfish",
        version: "17",
        filename: "stockfish",
        handle: { id: { id: "capability-1" }, kind: "engine" },
        downloadLink: "https://www.encroissant.org/engines/stockfish.zip",
    };

    it("does not treat a distinct download as installed just because the names match", () => {
        expect(
            isManifestEngineInstalled([stockfish], {
                downloadLink: "https://www.encroissant.org/engines/stockfish-dev.zip",
            }),
        ).toBe(false);
    });

    it("treats a renamed engine as installed when the download URL still matches", () => {
        expect(
            isManifestEngineInstalled([{ ...stockfish, name: "My Fish" }], {
                downloadLink: stockfish.downloadLink,
            }),
        ).toBe(true);
    });

    it("does not match a locally added engine that has no download URL", () => {
        expect(
            isManifestEngineInstalled([{ ...stockfish, downloadLink: undefined }], {
                downloadLink: stockfish.downloadLink,
            }),
        ).toBe(false);
    });
});

describe("engine persistence", () => {
    it("accepts public metadata with an opaque native handle", () => {
        expect(
            engineSchema.safeParse({
                type: "local",
                id: "engine-1",
                name: "Stockfish",
                version: "17",
                filename: "stockfish",
                handle: { id: { id: "capability-1" }, kind: "engine" },
            }).success,
        ).toBe(true);
    });

    it("rejects legacy physical-path engine state", () => {
        expect(
            engineSchema.safeParse({
                type: "local",
                id: "engine-1",
                name: "Stockfish",
                version: "17",
                path: "/usr/bin/stockfish",
            }).success,
        ).toBe(false);
    });

    it("scrubs legacy renderer-visible image paths instead of persisting them", () => {
        const parsed = engineSchema.parse({
            type: "local",
            id: "engine-1",
            name: "Stockfish",
            version: "17",
            filename: "stockfish",
            handle: { id: { id: "capability-1" }, kind: "engine" },
            image: "/home/felix/private.png",
        });
        expect(parsed).not.toHaveProperty("image");
        expect(parsed.imageHandle).toBeUndefined();
    });

    it("persists only opaque native engine-image handles", () => {
        expect(
            engineSchema.safeParse({
                type: "local",
                id: "engine-1",
                name: "Stockfish",
                version: "17",
                filename: "stockfish",
                handle: { id: { id: "capability-1" }, kind: "engine" },
                imageHandle: { id: { id: "image-capability-1" }, kind: "engineImage" },
            }).success,
        ).toBe(true);
    });

    it("scrubs legacy raw UCI resource paths and retains opaque resource descriptors", () => {
        const base = {
            type: "local" as const,
            id: "engine-1",
            name: "Stockfish",
            version: "17",
            filename: "stockfish",
            handle: { id: { id: "capability-1" }, kind: "engine" as const },
        };
        const legacy = engineSchema.parse({
            ...base,
            settings: [{ type: "string", name: "SyzygyPath", value: "/private/tables" }],
        });
        expect(legacy.settings).toEqual([]);

        const current = engineSchema.parse({
            ...base,
            settings: [
                {
                    type: "resource",
                    name: "SyzygyPath",
                    resources: [
                        {
                            id: { id: "resource-capability" },
                            kind: "directory",
                            displayName: "tables",
                        },
                    ],
                },
            ],
        });
        expect(current.settings?.[0]).toMatchObject({
            type: "resource",
            resources: [{ displayName: "tables" }],
        });

        const lastLegacyValue = engineSchema.parse({
            ...base,
            settings: [
                current.settings![0],
                { type: "string", name: "SyzygyPath", value: "/private/tables" },
            ],
        });
        expect(lastLegacyValue.settings).toEqual([]);
    });

    it("collapses duplicate persisted options by name with the last value winning", () => {
        const parsed = engineSchema.parse({
            type: "local",
            id: "engine-1",
            name: "Stockfish",
            version: "17",
            filename: "stockfish",
            handle: { id: { id: "capability-1" }, kind: "engine" },
            settings: [
                { type: "string", name: "MultiPV", value: "2" },
                { type: "string", name: "Threads", value: "8" },
                { type: "string", name: "MultiPV", value: "4" },
            ],
        });

        expect(parsed.settings).toEqual([
            { type: "string", name: "MultiPV", value: "4" },
            { type: "string", name: "Threads", value: "8" },
        ]);
    });
});
