import { describe, expect, test, vi } from "vitest";
import {
    errorUnlessCancelled,
    normalizeError,
    runAppliedMutationWithRefresh,
    runDestructiveWithRefresh,
    runWithAppliedRecovery,
} from "./errors";

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

    test("categorizes cancellation and keeps it silent", () => {
        expect(normalizeError(new Error("Cancellation")).category).toBe("cancelled");
        expect(errorUnlessCancelled(new Error("Cancellation"))).toBeNull();
    });

    test("keeps a real failure visible", () => {
        expect(errorUnlessCancelled(new Error("permission denied"))).toMatchObject({
            category: "permission",
        });
        expect(errorUnlessCancelled(new Error("connection aborted"))).toMatchObject({
            category: "cancelled",
            message: "connection aborted",
        });
        expect(errorUnlessCancelled(new Error("operation timeout"))).not.toBeNull();
    });
});

describe("runAppliedMutationWithRefresh", () => {
    test("refreshes and resolves an applied-despite-error mutation", async () => {
        const refresh = vi.fn();
        await expect(
            runAppliedMutationWithRefresh(
                async () =>
                    Promise.reject(
                        new Error("Committed but durability uncertain: registry replacement"),
                    ),
                refresh,
            ),
        ).resolves.toBeUndefined();
        expect(refresh).toHaveBeenCalledTimes(1);
    });

    test("does not refresh or swallow an ordinary rejection", async () => {
        const refresh = vi.fn();
        await expect(
            runAppliedMutationWithRefresh(
                async () => Promise.reject(new Error("native failed")),
                refresh,
            ),
        ).rejects.toThrow("native failed");
        expect(refresh).not.toHaveBeenCalled();
    });

    test("keeps the applied rejection when its refresh fails", async () => {
        const error = new Error("Committed but durability uncertain: registry replacement");
        await expect(
            runAppliedMutationWithRefresh(
                async () => Promise.reject(error),
                async () => Promise.reject(new Error("refresh failed")),
            ),
        ).rejects.toBe(error);
    });
});

test("runWithAppliedRecovery keeps the applied rejection when recovery fails", async () => {
    const error = new Error("Committed but durability uncertain: registry replacement");
    await expect(
        runWithAppliedRecovery(
            async () => Promise.reject(error),
            async () => {
                throw new Error("list failed");
            },
        ),
    ).rejects.toBe(error);
});

test("runWithAppliedRecovery returns the recovered committed object", async () => {
    const recovered = { id: "recovered" };
    await expect(
        runWithAppliedRecovery(
            async () =>
                Promise.reject(
                    new Error("Committed but durability uncertain: registry replacement"),
                ),
            async () => recovered,
        ),
    ).resolves.toBe(recovered);
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

    test("keeps the destructive rejection when refresh itself fails", async () => {
        const error = new Error(
            "Partially removed: 1 entries were deleted before failing: conflict",
        );
        await expect(
            runDestructiveWithRefresh(
                async () => Promise.reject(error),
                async () => {
                    throw new Error("relist failed");
                },
            ),
        ).rejects.toBe(error);
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
