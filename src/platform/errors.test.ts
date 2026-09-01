import { describe, expect, test, vi } from "vitest";
import {
    errorUnlessCancelled,
    normalizeError,
    runAppliedMutationWithRefresh,
    runDestructiveWithRefresh,
    runWithAppliedRecovery,
} from "./errors";

describe("normalizeError", () => {
    const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

    test("redacts secrets without emitting a literal $1", () => {
        const bearer = normalizeError(new Error("Authorization: Bearer sk-abc123 rejected"));
        expect(bearer.message).toBe("Authorization: Bearer [redacted] rejected");
        expect(bearer.message).not.toContain("$1");
        expect(bearer.message).not.toContain("sk-abc123");

        const token = normalizeError(new Error("token=xyz expired"));
        expect(token.message).toBe("token=[redacted] expired");
        expect(token.message).not.toContain("$1");

        const password = normalizeError(new Error("password: hunter2 failed"));
        expect(password.message).toBe("password: [redacted] failed");
        expect(password.message).not.toContain("hunter2");

        const jsonPassword = normalizeError('{"password":"hunter2"}');
        expect(jsonPassword.message).toBe('{"password":"[redacted]"}');
        const jsonToken = normalizeError('{"token":"abc"}');
        expect(jsonToken.message).toBe('{"token":"[redacted]"}');
    });

    test("redacts filesystem paths and preserves chess notation", () => {
        const unix = normalizeError(new Error("failed at /home/felix/secret.pgn"));
        expect(unix.message).toBe("failed at [path]");

        const windows = normalizeError(new Error("failed at C:\\Users\\felix\\secret.pgn"));
        expect(windows.message).toBe("failed at [path]");

        const windowsForward = normalizeError(new Error("failed at C:/Users/felix/secret.pgn"));
        expect(windowsForward.message).toBe("failed at [path]");

        const unc = normalizeError(new Error("failed at \\\\server\\share\\file.pgn"));
        expect(unc.message).toBe("failed at [path]");

        const home = normalizeError(new Error("failed at ~/secret.pgn"));
        expect(home.message).toBe("failed at [path]");

        const rootFile = normalizeError(new Error("failed at /secret.pgn"));
        expect(rootFile.message).toBe("failed at [path]");

        const fen = normalizeError(new Error(`Invalid FEN: ${START_FEN}`));
        expect(fen.message).toBe(`Invalid FEN: ${START_FEN}`);

        const draw = normalizeError(new Error("1/2-1/2 result malformed"));
        expect(draw.message).toBe("1/2-1/2 result malformed");
    });

    test("classifies from the unredacted source", () => {
        const error = normalizeError(new Error("open /home/user/missing.pgn"));
        expect(error.category).toBe("not-found");
        expect(error.message).toBe("open [path]");
        expect(error.message).not.toContain("/home/user");
    });

    test("omits diagnostic", () => {
        expect(normalizeError(new Error("native failed")).diagnostic).toBeUndefined();
    });

    test("handles circular non-error values", () => {
        const circular: { self?: unknown } = {};
        circular.self = circular;
        expect(normalizeError(circular).message).toContain("[circular]");
    });

    test("does not throw on empty values", () => {
        expect(normalizeError(undefined).category).toBe("unexpected");
        expect(normalizeError(() => undefined).category).toBe("unexpected");
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
        const error = normalizeError(new Error(message));
        expect(error.category).toBe("applied-despite-error");
        expect(error.message).toBe(message);
    });

    test("keeps I/O in a partial-removal cause", () => {
        const error = normalizeError(
            new Error("Partially removed: 1 entries were deleted before failing: I/O failure"),
        );
        expect(error.category).toBe("applied-despite-error");
        expect(error.message).toBe(
            "Partially removed: 1 entries were deleted before failing: I/O failure",
        );
    });

    test.each([
        ["Engine timeout: waiting for readyok", "unexpected"],
        ["connection aborted", "network"],
        ["network failure", "network"],
        ["Cancellation", "cancelled"],
        ["Analysis cancelled", "cancelled"],
        ["Game not found: abc", "not-found"],
        ["Missing reference database", "not-found"],
        ["No moves found", "not-found"],
        ["No opening found", "not-found"],
        ["No puzzles", "not-found"],
        ["Invalid input: bad tag", "validation"],
        ["Invalid color: green", "validation"],
        ["Conflict: path already exists", "validation"],
        ["Resource limit: depth exceeded", "validation"],
        ["Game not in progress", "validation"],
        ["Not human's turn", "validation"],
        ["Not engine's turn", "validation"],
        ["Players aren't the same. They have played against each other", "validation"],
        ["OAuth failure: denied", "permission"],
        ["Credential operation failed", "permission"],
        ["Credential operation requires recovery", "permission"],
    ] as const)("maps owned Display %s to %s", (message, category) => {
        expect(normalizeError(new Error(message)).category).toBe(category);
        expect(normalizeError(message).category).toBe(category);
        expect(normalizeError(message).message).toBe(message);
    });

    test("categorizes cancellation and keeps it silent for Error and string IPC", () => {
        expect(normalizeError(new Error("Cancellation")).category).toBe("cancelled");
        expect(errorUnlessCancelled(new Error("Cancellation"))).toBeNull();
        expect(errorUnlessCancelled("Cancellation")).toBeNull();
    });

    test("keeps a real failure visible", () => {
        expect(errorUnlessCancelled(new Error("permission denied"))).toMatchObject({
            category: "permission",
        });
        expect(errorUnlessCancelled(new Error("connection aborted"))).toMatchObject({
            category: "network",
            message: "connection aborted",
        });
        expect(errorUnlessCancelled(new Error("operation timeout"))).not.toBeNull();
        expect(errorUnlessCancelled("Engine timeout: waiting for readyok")).toMatchObject({
            category: "unexpected",
            message: "Engine timeout: waiting for readyok",
        });
    });

    test("returns an already-normalised AppError and TauriCommandError details", () => {
        const existing = { category: "validation" as const, message: "Conflict: x" };
        expect(normalizeError(existing)).toBe(existing);

        const details = { category: "network" as const, message: "connection aborted" };
        const wrapped = Object.assign(new Error(details.message), { details });
        expect(normalizeError(wrapped)).toBe(details);
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
