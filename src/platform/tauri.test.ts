import { describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    closeSplashscreen: vi.fn(),
}));

vi.mock("@/bindings/generated", () => ({
    commands: { closeSplashscreen: mocks.closeSplashscreen },
    events: {},
}));

import { normalizeError } from "./errors";
import { TauriCommandError, tauri } from "./tauri";

describe("tauri command facade", () => {
    test("returns command payloads instead of generated Result wrappers", async () => {
        mocks.closeSplashscreen.mockResolvedValue({ status: "ok", data: null });
        await expect(tauri.closeSplashscreen()).resolves.toBeNull();
    });

    test("normalizes and redacts generated errors", async () => {
        mocks.closeSplashscreen.mockResolvedValue({
            status: "error",
            error: "Bearer secret-value at /home/user/private.pgn",
        });
        let caught: unknown;
        try {
            await tauri.closeSplashscreen();
        } catch (error) {
            caught = error;
        }
        expect(caught).toBeInstanceOf(TauriCommandError);
        const error = caught as TauriCommandError;
        expect(error.message).not.toContain("secret-value");
        expect(error.message).not.toContain("/home/user");
        expect(error.message).not.toContain("$1");
        expect(error.details).toBe(normalizeError(error));
    });

    test("rethrows an already-normalised TauriCommandError", async () => {
        const inner = new TauriCommandError("Bearer secret-value at /home/user/private.pgn");
        mocks.closeSplashscreen.mockRejectedValue(inner);
        let caught: unknown;
        try {
            await tauri.closeSplashscreen();
        } catch (error) {
            caught = error;
        }
        expect(caught).toBe(inner);
    });
});
