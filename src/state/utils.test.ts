import { beforeEach, describe, expect, test, vi } from "vitest";
import { z } from "zod";
import { deserializeStorageValue, serializeStorageValue } from "./store/debouncedStorage";

const warn = vi.hoisted(() => vi.fn());

vi.mock("@/platform/native", () => ({ warn }));

import { createAsyncZodStorage, createZodStorage } from "./utils";

beforeEach(() => warn.mockClear());

describe("validated storage diagnostics", () => {
    test("does not log an invalid synchronous stored value", () => {
        const secret = "legacy-bearer-secret";
        const storage = {
            getItem: vi.fn(() => JSON.stringify({ accessToken: secret })),
            setItem: vi.fn(),
            removeItem: vi.fn(),
        };

        createZodStorage(z.array(z.string()), storage).getItem("sessions", []);

        expect(warn).toHaveBeenCalledWith("Invalid persisted value for sessions");
        expect(JSON.stringify(warn.mock.calls)).not.toContain(secret);
    });

    test("does not log invalid asynchronous values or thrown details", async () => {
        const secret = "credential-from-malformed-storage";
        const invalidStorage = {
            getItem: vi.fn(async () => JSON.stringify({ accessToken: secret })),
            setItem: vi.fn(async () => undefined),
            removeItem: vi.fn(async () => undefined),
        };
        const throwingStorage = {
            getItem: vi.fn(async () => {
                throw new Error(secret);
            }),
            setItem: vi.fn(async () => undefined),
            removeItem: vi.fn(async () => undefined),
        };

        await createAsyncZodStorage(z.array(z.string()), invalidStorage).getItem("sessions", []);
        await createAsyncZodStorage(z.array(z.string()), throwingStorage).getItem("sessions", []);

        expect(warn).toHaveBeenCalledWith("Invalid persisted value for sessions");
        expect(warn).toHaveBeenCalledWith("Unable to read persisted value for sessions");
        expect(JSON.stringify(warn.mock.calls)).not.toContain(secret);
    });
});

describe("asynchronous validated storage", () => {
    test("awaits and exposes a rejected write", async () => {
        const error = new Error("quota exceeded");
        const storage = {
            getItem: vi.fn(async () => null),
            setItem: vi.fn(async () => {
                throw error;
            }),
            removeItem: vi.fn(async () => undefined),
        };

        const result = createAsyncZodStorage(z.array(z.string()), storage).setItem("items", [
            "one",
        ]);

        await expect(result).rejects.toBe(error);
        expect(storage.setItem).toHaveBeenCalledWith("items", serializeStorageValue(["one"]));
    });

    test("round-trips compressed values", async () => {
        let persisted: string | null = null;
        const storage = {
            getItem: vi.fn(async () => persisted),
            setItem: vi.fn(async (_key: string, value: string) => {
                persisted = value;
            }),
            removeItem: vi.fn(async () => undefined),
        };
        const validatedStorage = createAsyncZodStorage(z.array(z.string()), storage);

        await validatedStorage.setItem("items", ["one", "two"]);

        expect(deserializeStorageValue(persisted!)).toEqual(["one", "two"]);
        await expect(validatedStorage.getItem("items", [])).resolves.toEqual(["one", "two"]);
        expect(storage.setItem).toHaveBeenCalledTimes(1);
    });

    test("hydrates legacy pretty JSON and rewrites it compressed", async () => {
        const legacyValue = JSON.stringify(["one", "two"], null, 4);
        const storage = {
            getItem: vi.fn(async () => legacyValue),
            setItem: vi.fn(async () => undefined),
            removeItem: vi.fn(async () => undefined),
        };
        const validatedStorage = createAsyncZodStorage(z.array(z.string()), storage);

        await expect(validatedStorage.getItem("items", [])).resolves.toEqual(["one", "two"]);
        expect(storage.setItem).toHaveBeenCalledWith(
            "items",
            serializeStorageValue(["one", "two"]),
        );
    });
});
