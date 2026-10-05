import { act } from "react";

export function press(
    key: string,
    { shiftKey = false, ctrlKey = false }: { shiftKey?: boolean; ctrlKey?: boolean } = {},
) {
    const code = key.length === 1 ? `Key${key.toUpperCase()}` : key;
    act(() => {
        document.dispatchEvent(
            new KeyboardEvent("keydown", { key, code, shiftKey, ctrlKey, bubbles: true }),
        );
        document.dispatchEvent(
            new KeyboardEvent("keyup", { key, code, shiftKey, ctrlKey, bubbles: true }),
        );
    });
}
