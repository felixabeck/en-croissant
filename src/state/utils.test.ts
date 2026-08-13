import { beforeEach, describe, expect, test, vi } from "vitest";
import { z } from "zod";

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
