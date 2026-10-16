import { expect, test } from "vitest";
import { extractPgnDrawings, makePgnDrawings } from "./drawings";

test.each([
    "[%cal]",
    "[%csl ]",
    "[%cal Xa1a3,bad,$&]",
    "[%csl Oa9]",
    "[%cal Oe2e4",
    "[%other Oe2e4]",
    "[%other [%cal Oe2e4]]",
])("unrenderable drawing commands retain their exact bytes: %s", (text) => {
    expect(extractPgnDrawings(text)).toEqual({ text, shapes: [] });
});

test("empty residual entries retain their commas through repeated extraction", () => {
    const first = extractPgnDrawings("Lead [%cal ,Oe2e4,,Cf2f4,] tail");
    expect(first.shapes).toHaveLength(2);
    expect(first.text).toBe("Lead [%cal ,,] tail");
    expect(extractPgnDrawings(first.text)).toEqual({ text: first.text, shapes: [] });
});

test("legacy permissive command lengths retain shapes and normalize square endpoints", () => {
    const parsed = extractPgnDrawings("[%cal Oe4] [%csl Cf2f4] [%cal Ge2e2]");
    expect(parsed.shapes).toHaveLength(3);
    expect(parsed.shapes.map((shape) => shape.color)).toEqual(["orange", "cyan", "green"]);
    expect(
        makePgnDrawings([
            { orig: "e4", dest: "e4", brush: "orange" },
            { orig: "f2", dest: "f4", brush: "cyan" },
            { orig: "e2", brush: "green" },
        ]),
    ).toBe("[%csl Oe4,Ge2][%cal Cf2f4]");
});
