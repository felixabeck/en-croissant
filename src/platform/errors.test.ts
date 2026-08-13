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
});
