import {
    ActionIcon,
    Autocomplete,
    type CSSVariablesResolver,
    createTheme,
    DEFAULT_THEME,
    Input,
    Modal,
    Textarea,
    TextInput,
} from "@mantine/core";

/** Keep semantic secondary text and primary light actions WCAG-AA compliant in light mode. */
export const appCssVariablesResolver: CSSVariablesResolver = (theme) => ({
    variables: {},
    light: {
        "--mantine-color-dimmed": theme.colors.gray[9],
        [`--mantine-color-${theme.primaryColor}-light-color`]: theme.colors[theme.primaryColor][9],
    },
    dark: {},
});

/** Media-query em uses the initial font size, so scale it with the app's root font. */
export function scaleBreakpoint(widthEm: number, fontSize: number): string {
    return `${Number((widthEm * (fontSize / 100)).toFixed(10))}em`;
}

/** Sole application theme factory. Settings-derived values are injected here. */
export function createAppTheme({
    primaryColor,
    spellCheck,
    fontSize,
}: {
    primaryColor: string;
    spellCheck: boolean;
    fontSize: number;
}) {
    return createTheme({
        primaryColor,
        breakpoints: Object.fromEntries(
            Object.entries(DEFAULT_THEME.breakpoints).map(([key, value]) => [
                key,
                scaleBreakpoint(Number.parseFloat(value), fontSize),
            ]),
        ),
        colors: {
            dark: [
                "#C1C2C5",
                "#A6A7AB",
                "#909296",
                "#5c5f66",
                "#373A40",
                "#2C2E33",
                "#25262b",
                "#1A1B1E",
                "#141517",
                "#101113",
            ],
        },
        components: {
            ActionIcon: ActionIcon.extend({
                defaultProps: { variant: "transparent", color: "gray" },
            }),
            Modal: Modal.extend({
                // AppModal supplies the localized variant. This protects legacy callers while
                // they are migrated and prevents an unnamed native close control.
                defaultProps: { closeButtonProps: { "aria-label": "Close dialog" } },
            }),
            TextInput: TextInput.extend({ defaultProps: { spellCheck } }),
            Autocomplete: Autocomplete.extend({ defaultProps: { spellCheck } }),
            Textarea: Textarea.extend({ defaultProps: { spellCheck } }),
            Input: Input.extend({
                defaultProps: {
                    // Mantine's generic input prop omits the native spelling attribute.
                    // @ts-expect-error Mantine forwards native input attributes.
                    spellCheck,
                },
            }),
        },
    });
}
