import { beforeEach, describe, expect, test, vi } from "vitest";
import { z } from "zod";
import { deserializeStorageValue, serializeStorageValue } from "./store/debouncedStorage";

const warn = vi.hoisted(() => vi.fn());
const reportPersistError = vi.hoisted(() => vi.fn());
const normalizeError = vi.hoisted(() => vi.fn(() => ({ message: "safe cause" })));

vi.mock("@/platform/native", () => ({ warn }));
vi.mock("./persistError", () => ({ reportPersistError }));
vi.mock("@/platform/errors", () => ({ normalizeError }));
vi.mock("@/i18n", () => ({
    default: {
        t: (key: string, options?: { cause?: string }) =>
            options?.cause === undefined ? key : `${key}: ${options.cause}`,
    },
}));

import { createAsyncZodStorage, createZodStorage } from "./utils";

beforeEach(() => {
    warn.mockClear();
    reportPersistError.mockClear();
});

describe("validated storage diagnostics", () => {
    test("returns the default and reports when malformed JSON repair fails", () => {
        const quota = new DOMException("full", "QuotaExceededError");
        const storage = {
            getItem: vi.fn(() => "{malformed"),
            setItem: vi.fn(() => {
                throw quota;
            }),
            removeItem: vi.fn(),
        };

        expect(createZodStorage(z.array(z.string()), storage).getItem("sessions", [])).toEqual([]);

        expect(warn).toHaveBeenCalledWith("Invalid persisted value for sessions");
        expect(reportPersistError).toHaveBeenCalledWith(
            expect.objectContaining({
                message: "Common.PreferenceRepairFailed: Common.StorageQuotaExceeded",
                cause: quota,
            }),
        );
    });

    test("returns the default and reports a safe error when reading fails", () => {
        const storage = {
            getItem: vi.fn(() => {
                throw new Error("credential-from-storage-failure");
            }),
            setItem: vi.fn(),
            removeItem: vi.fn(),
        };

        expect(createZodStorage(z.array(z.string()), storage).getItem("sessions", [])).toEqual([]);

        expect(warn).toHaveBeenCalledWith("Unable to read persisted value for sessions");
        expect(reportPersistError).toHaveBeenCalledWith(
            expect.objectContaining({
                message: "Common.PreferenceReadFailed: safe cause",
            }),
        );
        const reported = reportPersistError.mock.calls[0]?.[0] as Error;
        expect(reported.message).toContain("safe cause");
        expect(reported.message).not.toContain("credential-from-storage-failure");
    });

    test("returns normalized data and reports when normalized repair fails", () => {
        const storage = {
            getItem: vi.fn(() => JSON.stringify({ value: "kept", obsolete: true })),
            setItem: vi.fn(() => {
                throw new Error("write denied");
            }),
            removeItem: vi.fn(),
        };
        const schema = z.object({ value: z.string() });

        expect(
            createZodStorage(schema, storage).getItem("preference", { value: "default" }),
        ).toEqual({ value: "kept" });
        expect(reportPersistError).toHaveBeenCalledWith(
            expect.objectContaining({
                message: "Common.PreferenceRepairFailed: safe cause",
            }),
        );
    });

    test("successfully repairs a normalized value", () => {
        const storage = {
            getItem: vi.fn(() => JSON.stringify({ value: "kept", obsolete: true })),
            setItem: vi.fn(),
            removeItem: vi.fn(),
        };
        const schema = z.object({ value: z.string() });

        expect(
            createZodStorage(schema, storage).getItem("preference", { value: "default" }),
        ).toEqual({ value: "kept" });
        expect(storage.setItem).toHaveBeenCalledWith(
            "preference",
            JSON.stringify({ value: "kept" }),
        );
        expect(reportPersistError).not.toHaveBeenCalled();
    });

    test("reports live preference write failures without throwing", () => {
        const storage = {
            getItem: vi.fn(() => null),
            setItem: vi.fn(() => {
                throw new Error("full");
            }),
            removeItem: vi.fn(),
        };

        expect(() =>
            createZodStorage(z.array(z.string()), storage).setItem("sessions", ["one"]),
        ).not.toThrow();
        expect(reportPersistError).toHaveBeenCalledWith(
            expect.objectContaining({
                message: "Common.PreferenceSaveFailed: safe cause",
            }),
        );
    });

    test("reports live preference removal failures without throwing", () => {
        const storage = {
            getItem: vi.fn(() => null),
            setItem: vi.fn(),
            removeItem: vi.fn(() => {
                throw new Error("remove denied");
            }),
        };

        expect(() =>
            createZodStorage(z.array(z.string()), storage).removeItem("sessions"),
        ).not.toThrow();
        expect(reportPersistError).toHaveBeenCalledWith(
            expect.objectContaining({
                message: "Common.PreferenceSaveFailed: safe cause",
            }),
        );
    });
});

describe("asynchronous validated storage", () => {
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
