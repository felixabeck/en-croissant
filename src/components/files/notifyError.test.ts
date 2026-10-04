import { notifications } from "@mantine/notifications";
import { afterEach, expect, test, vi } from "vitest";
import { notifyListenerError, notifyUnlessCancelled, runUnlessCancelled } from "./notifyError";

vi.mock("@mantine/notifications", () => ({
    notifications: { show: vi.fn() },
}));
vi.mock("@/i18n", () => ({
    default: {
        t: vi.fn(
            (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
        ),
    },
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

test.each([
    ["database", "This database folder is no longer available. Choose another."],
    ["puzzle", "This puzzle folder is no longer available. Choose another in Settings."],
    ["engine", "This engine folder is no longer available. Choose another in Settings."],
    ["files", "This collection is no longer available. Choose another."],
] as const)("%s notifies its root sentence through both entry points", async (domain, message) => {
    const error = {
        tag: "backend-error",
        category: "io",
        message: "native failure",
        rootFailure: "missing",
    };
    notifyUnlessCancelled("Common.Error", error, domain);
    await runUnlessCancelled(
        "Common.Error",
        async () => {
            throw error;
        },
        domain,
    );
    expect(notifications.show).toHaveBeenCalledTimes(2);
    expect(notifications.show).toHaveBeenNthCalledWith(1, {
        color: "red",
        title: "Common.Error",
        message,
    });
    expect(notifications.show).toHaveBeenNthCalledWith(2, {
        color: "red",
        title: "Common.Error",
        message,
    });
});

test.each(["database", "puzzle", "engine", "files"] as const)(
    "%s preserves unlabelled errors and cancellation",
    (domain) => {
        notifyUnlessCancelled(
            "Common.Error",
            { tag: "backend-error", category: "conflict", message: "workspace root changed" },
            domain,
        );
        expect(notifications.show).toHaveBeenCalledWith({
            color: "red",
            title: "Common.Error",
            message: "workspace root changed",
        });
        vi.mocked(notifications.show).mockClear();
        notifyUnlessCancelled(
            "Common.Error",
            {
                tag: "backend-error",
                category: "cancellation",
                message: "Cancellation",
                rootFailure: "changed",
            },
            domain,
        );
        expect(notifications.show).not.toHaveBeenCalled();
    },
);

test.each(["puzzle", "engine"] as const)(
    "%s retains the backend message for too-large",
    (domain) => {
        notifyUnlessCancelled(
            "Common.Error",
            {
                tag: "backend-error",
                category: "resource-limit",
                message: "listing bound reached",
                rootFailure: "too-large",
            },
            domain,
        );
        expect(notifications.show).toHaveBeenCalledWith({
            color: "red",
            title: "Common.Error",
            message: "listing bound reached",
        });
    },
);
