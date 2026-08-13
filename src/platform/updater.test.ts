import { beforeEach, describe, expect, test, vi } from "vitest";
import { checkForUpdates } from "./updater";

const { check, ask, message, relaunch } = vi.hoisted(() => ({
    check: vi.fn(),
    ask: vi.fn(),
    message: vi.fn(),
    relaunch: vi.fn(),
}));

vi.mock("./native", () => ({ check, ask, message, relaunch }));
vi.mock("@/i18n", () => ({
    default: {
        t: (key: string) =>
            ({
                "Update.NoUpdate": "No updates available",
                "Update.InstallPrompt": "Do you want to install the new version now?",
                "Update.InstallTitle": "New version available",
            })[key],
    },
}));

describe("checkForUpdates", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test("has a stable no-update result and only reports it for a manual check", async () => {
        check.mockResolvedValue(null);

        await expect(checkForUpdates()).resolves.toBe("not-available");
        expect(message).not.toHaveBeenCalled();

        await expect(checkForUpdates({ interactive: true })).resolves.toBe("not-available");
        expect(message).toHaveBeenCalledWith("No updates available");
    });

    test("awaits installation and relaunch exactly once", async () => {
        const downloadAndInstall = vi.fn().mockResolvedValue(undefined);
        check.mockResolvedValue({ downloadAndInstall });
        ask.mockResolvedValue(true);

        await expect(checkForUpdates()).resolves.toBe("installed");
        expect(downloadAndInstall).toHaveBeenCalledOnce();
        expect(relaunch).toHaveBeenCalledOnce();
    });

    test("reports check failures through the deliberate error contract", async () => {
        const onError = vi.fn();
        check.mockRejectedValue(new Error("network unavailable"));

        await expect(checkForUpdates({ onError })).resolves.toBe("failed");
        expect(onError).toHaveBeenCalledWith(
            expect.objectContaining({ category: "network", message: "network unavailable" }),
        );
    });

    test("reports prompt and installation failures without relaunching", async () => {
        const onError = vi.fn();
        check.mockResolvedValue({ downloadAndInstall: vi.fn() });
        ask.mockRejectedValue(new Error("prompt unavailable"));
        await expect(checkForUpdates({ onError })).resolves.toBe("failed");

        const downloadAndInstall = vi.fn().mockRejectedValue(new Error("install unavailable"));
        check.mockResolvedValue({ downloadAndInstall });
        ask.mockResolvedValue(true);
        await expect(checkForUpdates({ onError })).resolves.toBe("failed");
        expect(relaunch).not.toHaveBeenCalled();
        expect(onError).toHaveBeenLastCalledWith(
            expect.objectContaining({ message: "install unavailable" }),
        );
    });

    test("is silent when cancellation wins a pending check", async () => {
        let resolve!: (value: null) => void;
        check.mockReturnValue(new Promise((done) => (resolve = done)));
        const controller = new AbortController();
        const pending = checkForUpdates({ interactive: true, signal: controller.signal });
        controller.abort();
        resolve(null);

        await expect(pending).resolves.toBe("cancelled");
        expect(message).not.toHaveBeenCalled();
    });
});
