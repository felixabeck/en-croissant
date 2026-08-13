import { expect, test } from "vitest";
import { accessibleBoardGrid } from "./boardAccessibility";

test("ARIA grid contains all 64 squares in white visual order", () => {
    const grid = accessibleBoardGrid("white");
    expect(grid).toHaveLength(8);
    expect(grid.flat()).toHaveLength(64);
    expect(grid[0][0]).toBe("a8");
    expect(grid[7][7]).toBe("h1");
});

test("ARIA grid reverses rows and files for black orientation", () => {
    const grid = accessibleBoardGrid("black");
    expect(grid[0][0]).toBe("h1");
    expect(grid[7][7]).toBe("a8");
});
