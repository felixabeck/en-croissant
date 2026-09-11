import { beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ logError: vi.fn() }));
vi.mock("@/platform/native", () => ({ error: mocks.logError }));

import { logFailureSafely, safeFailureContext } from "./failureDiagnostic";

beforeEach(() => {
    mocks.logError.mockReset().mockResolvedValue(undefined);
});

test("safeFailureContext preserves category and redacts diagnostic details", () => {
    expect(safeFailureContext(new Error("token=secret at /private/game.pgn"))).toEqual({
        category: "unexpected",
        message: "token=[redacted] at [path]",
    });
});

test("logFailureSafely keeps original and logger diagnostics sanitized", async () => {
    mocks.logError.mockRejectedValueOnce(new Error("logger failed at /private/logger.log"));
    const fallback = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await logFailureSafely(
        "operation failed: original [path]",
        {
            operation: "metadata",
            itemIndex: 2,
            primaryFailure: safeFailureContext(new Error("original at /home/user/file.pgn")),
        },
        "Failure logging failed",
    );

    expect(fallback).toHaveBeenCalledWith("Failure logging failed", {
        operation: "metadata",
        itemIndex: 2,
        primaryFailure: { category: "unexpected", message: "original at [path]" },
        loggerFailure: { category: "unexpected", message: "logger failed at [path]" },
    });
    fallback.mockRestore();
});
