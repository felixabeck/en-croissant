import { notifications } from "@mantine/notifications";
import { afterEach, expect, test, vi } from "vitest";
import { reportPersistError } from "./persistError";

vi.mock("@mantine/notifications", () => ({
    notifications: { show: vi.fn() },
}));
vi.mock("@/i18n", () => ({
    default: { t: vi.fn(() => "Common.Error") },
}));

afterEach(() => {
    vi.mocked(notifications.show).mockClear();
});

test("notifies a real persistence failure", () => {
    reportPersistError(new Error("storage unavailable"));
    expect(notifications.show).toHaveBeenCalledWith({
        color: "red",
        title: "Common.Error",
        message: "storage unavailable",
    });
});

test("keeps a persistence Cancellation silent", () => {
    reportPersistError(new Error("Cancellation"));
    expect(notifications.show).not.toHaveBeenCalled();
});
