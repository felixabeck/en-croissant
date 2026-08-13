import { afterEach, describe, expect, test, vi } from "vitest";
import { z } from "zod";
import { AllowedOriginHttpClient, HttpError } from "./http";

const client = new AllowedOriginHttpClient(["https://api.example.test"]);

afterEach(() => vi.unstubAllGlobals());

describe("AllowedOriginHttpClient", () => {
    test("rejects an origin before it reaches fetch", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        await expect(
            client.get("https://other.example.test/data", {
                schema: z.object({ ok: z.boolean() }),
            }),
        ).rejects.toMatchObject({ kind: "network" } satisfies Partial<HttpError>);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    test("requires successful, schema-valid responses", async () => {
        vi.stubGlobal(
            "fetch",
            vi
                .fn()
                .mockResolvedValue(new Response(JSON.stringify({ nope: true }), { status: 200 })),
        );
        await expect(
            client.get("https://api.example.test/data", { schema: z.object({ ok: z.boolean() }) }),
        ).rejects.toMatchObject({ kind: "schema" } satisfies Partial<HttpError>);
    });

    test("classifies a missing manifest as a status failure", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
        await expect(
            client.get("https://api.example.test/manifest", { schema: z.array(z.unknown()) }),
        ).rejects.toMatchObject({ kind: "status", status: 404 } satisfies Partial<HttpError>);
    });

    test("classifies cancelled requests", async () => {
        const controller = new AbortController();
        controller.abort();
        vi.stubGlobal(
            "fetch",
            vi.fn().mockRejectedValue(new DOMException("Aborted", "AbortError")),
        );
        await expect(
            client.get("https://api.example.test/data", {
                schema: z.unknown(),
                signal: controller.signal,
            }),
        ).rejects.toMatchObject({ kind: "abort" } satisfies Partial<HttpError>);
    });
});
