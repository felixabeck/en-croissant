import { beforeEach, describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({ verifySignedBytes: vi.fn() }));
const log = vi.hoisted(() => ({ warn: vi.fn() }));
vi.mock("@/platform/native", () => log);
vi.mock("@/platform/tauri", () => ({ tauri: native }));

import { z } from "zod";
import { CatalogVerificationError, loadSignedCatalog } from "@/utils/signedCatalog";

const schema = z.array(z.object({ title: z.string() }));

describe("loadSignedCatalog", () => {
    beforeEach(() => {
        native.verifySignedBytes.mockReset();
        log.warn.mockReset();
    });

    it("verifies the exact bytes, then parses them with the schema", async () => {
        native.verifySignedBytes.mockResolvedValue(null);
        const document = '[{"title":"a"}]';
        await expect(loadSignedCatalog(document, "sig", schema)).resolves.toStrictEqual([
            { title: "a" },
        ]);
        expect(native.verifySignedBytes).toHaveBeenCalledWith(document, "sig");
    });

    it("rejects a bad signature with CatalogVerificationError and never parses", async () => {
        const failure = new Error("artifact manifest signature verification failed");
        native.verifySignedBytes.mockRejectedValue(failure);
        const parse = vi.spyOn(JSON, "parse");
        const schemaParse = vi.spyOn(schema, "parse");
        const error = await loadSignedCatalog("not json", "bad", schema).catch((e: unknown) => e);
        expect(error).toBeInstanceOf(CatalogVerificationError);
        expect((error as CatalogVerificationError).cause).toBe(failure);
        expect(parse).not.toHaveBeenCalledWith("not json");
        expect(schemaParse).not.toHaveBeenCalled();
        expect(log.warn).toHaveBeenCalledTimes(1);
        parse.mockRestore();
        schemaParse.mockRestore();
    });

    it("surfaces schema violations after a successful verify, not as verification errors", async () => {
        native.verifySignedBytes.mockResolvedValue(null);
        const error = await loadSignedCatalog('[{"title":1}]', "sig", schema).catch(
            (e: unknown) => e,
        );
        expect(error).toBeInstanceOf(z.ZodError);
        expect(error).not.toBeInstanceOf(CatalogVerificationError);
    });
});
