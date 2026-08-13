import { describe, expect, test } from "vitest";
import type { FileWorkspaceHandle, PathRef } from "@/bindings";
import {
    capabilityDisplayName,
    capabilityKey,
    databaseHandleSchema,
    fileWorkspaceHandleSchema,
    fileWorkspaceKey,
    pathRefKey,
    pathRefSchema,
} from "./pathCapabilities";

const pathRef = (id: string): PathRef => ({ id });
const fileHandle = (id: string): FileWorkspaceHandle => ({
    id: pathRef(id),
    kind: "fileWorkspace",
});

describe("opaque capability projections", () => {
    test("projects direct and nested handles to the same primitive widget key", () => {
        expect(pathRefKey(pathRef("direct"))).toBe("direct");
        expect(capabilityKey(pathRef("direct"))).toBe("direct");
        expect(capabilityKey(fileHandle("nested"))).toBe("nested");
        expect(fileWorkspaceKey(fileHandle("workspace"))).toBe("workspace");
    });

    test("keeps a trimmed display label and falls back only for whitespace", () => {
        expect(capabilityDisplayName("  My games  ", "Fallback")).toBe("My games");
        expect(capabilityDisplayName("   ", "Fallback")).toBe("Fallback");
    });
});

describe("opaque capability schemas", () => {
    test("accept exact nonempty handle kinds", () => {
        expect(pathRefSchema.parse(pathRef("path"))).toEqual(pathRef("path"));
        expect(fileWorkspaceHandleSchema.parse(fileHandle("file"))).toEqual(fileHandle("file"));
        expect(databaseHandleSchema.parse({ id: pathRef("database"), kind: "database" })).toEqual({
            id: pathRef("database"),
            kind: "database",
        });
    });

    test("rejects empty IDs, flattened handles, and cross-kind handles", () => {
        expect(pathRefSchema.safeParse(pathRef("")).success).toBe(false);
        expect(
            fileWorkspaceHandleSchema.safeParse({ id: "flat", kind: "fileWorkspace" }).success,
        ).toBe(false);
        expect(
            fileWorkspaceHandleSchema.safeParse({ id: pathRef("id"), kind: "database" }).success,
        ).toBe(false);
        expect(databaseHandleSchema.safeParse(fileHandle("id")).success).toBe(false);
    });
});
