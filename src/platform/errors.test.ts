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
    // `partially-applied` were not tested first. The Rust literals these mirror are the
    // `#[error(...)]` text of `Error::PartialRemoval` and `Error::CommittedDurabilityUncertain`;
    // rewording either one turns this red, which is the point of pinning it here.
    test.each([
        "Partially removed: 2 entries were deleted before failing: child not found",
        "Committed but durability uncertain: parent not found",
        "Partially removed: 1 entries were deleted before failing: connection aborted",
        "Partially removed: 3 entries were deleted before failing: operation timeout",
        "Partially removed: 1 entries were deleted before failing: permission denied",
        "Committed but durability uncertain: invalid argument",
    ])("categorizes destructive changes that could not be fully reported", (message) => {
        expect(normalizeError(new Error(message)).category).toBe("partially-applied");
    });
});
