import {
    ActionIcon,
    Autocomplete,
    type CSSVariablesResolver,
    createTheme,
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

/** Sole application theme factory; settings-derived values are injected here. */
export function createAppTheme({
    primaryColor,
    spellCheck,
}: {
    primaryColor: string;
    spellCheck: boolean;
}) {
    return createTheme({
        primaryColor,
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
