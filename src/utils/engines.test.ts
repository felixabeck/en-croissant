import { describe, expect, it } from "vitest";
import { engineSchema } from "./engines";

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
    });
});
