// Keeps the label centred at minimum button height and wrapping at narrow widths and large font scales.
export const wrappingButton = {
    root: {
        display: "inline-flex",
        alignItems: "center",
        height: "auto",
        minHeight: "var(--button-height)",
        minWidth: 0,
        maxWidth: "100%",
    },
    inner: { width: "100%", minWidth: 0 },
    label: { whiteSpace: "normal", overflowWrap: "anywhere", minWidth: 0 },
} as const;
