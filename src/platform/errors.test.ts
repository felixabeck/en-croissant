import { describe, expect, test, vi } from "vitest";
import { normalizeError, runDestructiveWithRefresh } from "./errors";

describe("normalizeError", () => {
    test("redacts bearer tokens and local paths", () => {
        const error = normalizeError(new Error("Bearer abc123 at /home/felix/secret.pgn"));
        expect(error.message).not.toContain("abc123");
        expect(error.message).not.toContain("/home/felix");
    });

    test("handles circular non-error values", () => {
        const circular: { self?: unknown } = {};
        circular.self = circular;
        expect(normalizeError(circular).message).toContain("[circular]");
    });

    // Each cause below is worded so that some *other* branch would claim it if
    // `applied-despite-error` were not tested first. These are copies of the Rust literals, so
    // this test pins only THIS side of the contract: rewording `Error::PartialRemoval` or
    // `Error::CommittedDurabilityUncertain` does not turn it red. The backend asserts the
    // literals it emits, in `infra::fs`'s tests, and that is the half that catches a reword.
    test.each([
        "Partially removed: 2 entries were deleted before failing: child not found",
        "Committed but durability uncertain: parent not found",
        "Partially removed: 1 entries were deleted before failing: connection aborted",
        "Partially removed: 3 entries were deleted before failing: operation timeout",
        "Partially removed: 1 entries were deleted before failing: permission denied",
        "Committed but durability uncertain: invalid argument",
    ])("categorizes destructive changes that could not be fully reported", (message) => {
        expect(normalizeError(new Error(message)).category).toBe("applied-despite-error");
    });
});

describe("runDestructiveWithRefresh", () => {
    test("refreshes after success", async () => {
        const refresh = vi.fn();
        await expect(runDestructiveWithRefresh(async () => "done", refresh)).resolves.toBe("done");
        expect(refresh).toHaveBeenCalledTimes(1);
    });

    test("refreshes and preserves an applied-despite-error rejection", async () => {
        const refresh = vi.fn();
        const error = new Error(
            "Partially removed: 1 entries were deleted before failing: conflict",
        );
        await expect(
            runDestructiveWithRefresh(async () => Promise.reject(error), refresh),
        ).rejects.toBe(error);
        expect(refresh).toHaveBeenCalledTimes(1);
    });

    test("does not refresh after an ordinary rejection", async () => {
        const refresh = vi.fn();
        await expect(
            runDestructiveWithRefresh(
                async () => Promise.reject(new Error("native failed")),
                refresh,
            ),
        ).rejects.toThrow("native failed");
        expect(refresh).not.toHaveBeenCalled();
    });
});
