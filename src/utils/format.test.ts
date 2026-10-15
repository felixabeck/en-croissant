import { describe, expect, test } from "vitest";
import { formatBytes, formatMoveNumber } from "./format";

describe("formatBytes", () => {
    test.each([
        [0, "0 Bytes"],
        [1, "1 Bytes"],
        [1023, "1023 Bytes"],
        [1024, "1 KB"],
        [1536, "1.5 KB"],
        [1024 ** 2 - 1, "1024 KB"],
        [1024 ** 2, "1 MB"],
        [1024 ** 3, "1 GB"],
        [1024 ** 4, "1 TB"],
        [1024 ** 5, "1024 TB"],
    ])("formats %i consistently for number, bigint and decimal string", (bytes, expected) => {
        expect(formatBytes(bytes)).toBe(expected);
        expect(formatBytes(BigInt(bytes))).toBe(expected);
        expect(formatBytes(bytes.toString())).toBe(expected);
    });

    test.each(["9007199254740991", "9007199254740992", "9007199254740993", "18446744073709551615"])(
        "keeps a finite TB label for the native byte count %s",
        (bytes) => {
            const formatted = formatBytes(bytes);
            expect(formatted).toMatch(/^\d+(\.\d+)? TB$/);
            expect(Number.isFinite(Number.parseFloat(formatted))).toBe(true);
            expect(formatted).toBe(formatBytes(BigInt(bytes)));
            expect(formatted).toBe(formatBytes(Number(bytes)));
        },
    );

    test("preserves rounding and the existing decimals argument", () => {
        expect(formatBytes("1264")).toBe("1.23 KB");
        expect(formatBytes("1264", 3)).toBe("1.234 KB");
        expect(formatBytes("1536", -1)).toBe("2 KB");
        expect(formatBytes("18446744073709551615")).toBe("16777216 TB");
    });
});

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
