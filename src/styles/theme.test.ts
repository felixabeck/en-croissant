import { DEFAULT_THEME } from "@mantine/core";
import { describe, expect, test } from "vitest";
import { createAppTheme, scaleBreakpoint } from "./theme";

describe("scaled theme breakpoints", () => {
    test("preserves Mantine's default breakpoints at 100%", () => {
        expect(
            createAppTheme({ primaryColor: "blue", spellCheck: false, fontSize: 100 }).breakpoints,
        ).toEqual(DEFAULT_THEME.breakpoints);
    });

    test.each([
        [50, { xs: "18em", sm: "24em", md: "31em", lg: "37.5em", xl: "44em" }],
        [200, { xs: "72em", sm: "96em", md: "124em", lg: "150em", xl: "176em" }],
        [110, { xs: "39.6em", sm: "52.8em", md: "68.2em", lg: "82.5em", xl: "96.8em" }],
    ])(
        "scales every default breakpoint at %s%% without floating-point noise",
        (fontSize, expected) => {
            expect(
                createAppTheme({ primaryColor: "blue", spellCheck: false, fontSize }).breakpoints,
            ).toEqual(expected);
        },
    );
});

test.each([
    [48, 110, "52.8em"],
    [30, 110, "33em"],
    [50, 110, "55em"],
    [37.5, 50, "18.75em"],
])("scales %sem at %s%% to %s", (widthEm, fontSize, expected) => {
    expect(scaleBreakpoint(widthEm, fontSize)).toBe(expected);
});
