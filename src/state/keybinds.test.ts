import { expect, test, vi } from "vitest";
vi.mock("@/platform/native", () => ({ platform: () => "linux" }));
import { createKeybindStorage } from "./keybinds";

const defaults = {
    OPEN: { name: "Open", keys: "ctrl+o" },
    CLOSE: { name: "Close", keys: "ctrl+w" },
};

test("keybind storage repairs malformed and stale records without throwing", () => {
    sessionStorage.clear();
    const storage = createKeybindStorage(defaults, sessionStorage);
    sessionStorage.setItem("keybinds", JSON.stringify({ OPEN: { name: "Wrong", keys: "" } }));

    expect(storage.getItem("keybinds", defaults)).toEqual(defaults);
    expect(JSON.parse(sessionStorage.getItem("keybinds")!)).toEqual(defaults);
});
