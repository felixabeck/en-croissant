import { notifications } from "@mantine/notifications";
import { afterEach, expect, test, vi } from "vitest";
import { notifyListenerError, notifyUnlessCancelled, runUnlessCancelled } from "./notifyError";

vi.mock("@mantine/notifications", () => ({
    notifications: { show: vi.fn() },
}));
vi.mock("@/i18n", () => ({
    default: { t: vi.fn(() => "Common.Error") },
}));

afterEach(() => {
    vi.mocked(notifications.show).mockClear();
});

test("keeps the pinned Cancellation display silent", () => {
    notifyUnlessCancelled("Common.Error", new Error("Cancellation"));
    expect(notifications.show).not.toHaveBeenCalled();
});

test("notifies a real failure", () => {
    notifyUnlessCancelled("Common.Error", new Error("permission denied"));
    expect(notifications.show).toHaveBeenCalledWith({
        color: "red",
        title: "Common.Error",
        message: "permission denied",
    });
});

test("does not treat abort-like diagnostics as picker cancellation", () => {
    notifyUnlessCancelled("Common.Error", new Error("connection aborted"));
    expect(notifications.show).toHaveBeenCalledWith({
        color: "red",
        title: "Common.Error",
        message: "connection aborted",
    });
});

test("notifies a real listener failure with the common error title", () => {
    notifyListenerError(new Error("listener unavailable"));
    expect(notifications.show).toHaveBeenCalledWith({
        color: "red",
        title: "Common.Error",
        message: "listener unavailable",
    });
});

test("keeps a pinned listener Cancellation silent", () => {
    notifyListenerError(new Error("Cancellation"));
    expect(notifications.show).not.toHaveBeenCalled();
});

test("runUnlessCancelled returns the adopted value and stays silent on Cancellation", async () => {
    await expect(runUnlessCancelled("Common.Error", async () => "handle")).resolves.toBe("handle");
    await expect(
        runUnlessCancelled("Common.Error", async () => {
            throw new Error("Cancellation");
        }),
    ).resolves.toBeUndefined();
    expect(notifications.show).not.toHaveBeenCalled();
});

test("runUnlessCancelled notifies a real failure and does not return a value", async () => {
    await expect(
        runUnlessCancelled("Common.Error", async () => {
            throw new Error("permission denied");
        }),
    ).resolves.toBeUndefined();
    expect(notifications.show).toHaveBeenCalledWith({
        color: "red",
        title: "Common.Error",
        message: "permission denied",
    });
});
