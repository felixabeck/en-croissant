import { expect, test } from "vitest";
import { formatClock } from "./Clock";

test("keeps a zero clock visible", () => {
    expect(formatClock(0)).toBe("00:00.0");
});

test("clamps negative elapsed time at zero", () => {
    expect(formatClock(-100)).toBe("00:00.0");
});
