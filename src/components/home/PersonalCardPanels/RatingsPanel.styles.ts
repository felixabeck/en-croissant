export const tooltipContentStyle = {
    backgroundColor: "var(--mantine-color-body)",
    boxShadow: "var(--mantine-shadow-md)",
    borderRadius: "var(--mantine-radius-default)",
    border: "calc(0.0625rem * var(--mantine-scale)) solid var(--mantine-color-default-border)",
};

export const tooltipCursorStyle = {
    stroke: "var(--cf-border-strong)",
    strokeWidth: 1,
    strokeDasharray: "5 5",
};

export const linearGradientProps = {
    id: "colorRating",
    x1: "0",
    y1: "0",
    x2: "0",
    y2: "1",
};

export const gradientStops = [
    { offset: "5%", stopColor: "var(--cf-primary)", stopOpacity: 1 },
    { offset: "95%", stopColor: "var(--cf-primary)", stopOpacity: 0.1 },
];
