import { describe, expect, test } from "vitest";
import { formatMoveNumber } from "./format";

describe("formatMoveNumber", () => {
    test.each([
        [1, "1."],
        [2, "1..."],
        [3, "2."],
        [40, "20..."],
    ])("formats ply %i as %s", (halfMoves, expected) => {
        expect(formatMoveNumber(halfMoves)).toBe(expected);
    });
});
