import { describe, expect, test } from "vitest";
import { normalizeError } from "./errors";

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
