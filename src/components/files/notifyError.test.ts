import { notifications } from "@mantine/notifications";
import { afterEach, expect, test, vi } from "vitest";
import { notifyUnlessCancelled } from "./notifyError";

vi.mock("@mantine/notifications", () => ({
    notifications: { show: vi.fn() },
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
