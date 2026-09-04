import { describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    closeSplashscreen: vi.fn(),
}));

vi.mock("@/bindings/generated", () => ({
    commands: { closeSplashscreen: mocks.closeSplashscreen },
    events: {},
}));

import { normalizeError } from "./errors";
import { TauriCommandError, tauri, unwrapCommand } from "./tauri";

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

    test("maps a generated ErrorPayload through unwrapCommand", () => {
        const result = {
            status: "error" as const,
            error: {
                tag: "backend-error" as const,
                category: "permission" as const,
                message: "denied at /private/secret",
            },
        };
        let caught: unknown;
        try {
            unwrapCommand(result);
        } catch (error) {
            caught = error;
        }
        expect(caught).toBeInstanceOf(TauriCommandError);
        const commandError = caught as TauriCommandError;
        expect(commandError.details).toEqual({
            category: "permission",
            backendCategory: "permission",
            message: "denied at [path]",
        });
        expect(commandError.message).toBe("denied at [path]");
        expect(commandError.message).not.toContain("/private/secret");
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
