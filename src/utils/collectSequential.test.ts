import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ logError: vi.fn() }));
vi.mock("@/platform/native", () => ({ error: mocks.logError }));

import { collectSequential } from "./collectSequential";

describe("collectSequential", () => {
    beforeEach(() => {
        mocks.logError.mockReset().mockResolvedValue(undefined);
    });

    test("retains successful siblings in input order and reports original indices", async () => {
        const indices: number[] = [];
        const result = await collectSequential(
            ["first", "failed", "third"],
            async (item, index) => {
                indices.push(index);
                if (item === "failed") throw new Error("broken");
                return item.toUpperCase();
            },
            { operation: "metadata" },
        );
        expect(result).toEqual(["FIRST", "THIRD"]);
        expect(indices).toEqual([0, 1, 2]);
        expect(mocks.logError).toHaveBeenCalledOnce();
    });

    test("cancellation after the final mapper resolution rejects without a diagnostic", async () => {
        const controller = new AbortController();
        let resolve!: (value: number) => void;
        const mapped = new Promise<number>((done) => {
            resolve = done;
        });
        const result = collectSequential([1], () => mapped, {
            operation: "metadata",
            signal: controller.signal,
        });
        await Promise.resolve();
        resolve(1);
        controller.abort();
        await expect(result).rejects.toMatchObject({ name: "AbortError" });
        expect(mocks.logError).not.toHaveBeenCalled();
    });

    test("logger rejection uses the console fallback and preserves siblings", async () => {
        mocks.logError.mockRejectedValue(new Error("logger unavailable"));
        const fallback = vi.spyOn(console, "error").mockImplementation(() => undefined);
        const result = await collectSequential(
            [1, 2],
            async (item) => {
                if (item === 1) throw new Error("failed item");
                return item;
            },
            { operation: "metadata" },
        );
        expect(result).toEqual([2]);
        expect(fallback).toHaveBeenCalledOnce();
        fallback.mockRestore();
    });
});
