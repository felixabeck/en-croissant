import { createStore } from "jotai";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

vi.mock("@/platform/native", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/platform/native")>()),
    warn: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
});

afterEach(() => {
    localStorage.clear();
    document.documentElement.style.fontSize = "";
});

test.each([5000, 0, -20, 155, 150.5, "150", null])(
    "repairs invalid stored font scale %j to 100 during real atom hydration",
    async (storedValue) => {
        localStorage.setItem("font-size", JSON.stringify(storedValue));
        const { fontSizeAtom } = await import("./atoms");
        const store = createStore();
        const unsubscribe = store.sub(fontSizeAtom, () => {});
        try {
            expect(store.get(fontSizeAtom)).toBe(100);
            expect(localStorage.getItem("font-size")).toBe("100");
        } finally {
            unsubscribe();
        }
    },
);

test("preserves valid stored font scale 150 during real atom hydration", async () => {
    localStorage.setItem("font-size", "150");
    const { fontSizeAtom } = await import("./atoms");
    const store = createStore();
    const unsubscribe = store.sub(fontSizeAtom, () => {});
    try {
        expect(store.get(fontSizeAtom)).toBe(150);
        expect(localStorage.getItem("font-size")).toBe("150");
    } finally {
        unsubscribe();
    }
});

test.each([50, 200])("persists and rehydrates supported setter endpoint %i", async (value) => {
    const { fontSizeAtom } = await import("./atoms");
    const store = createStore();
    store.set(fontSizeAtom, value);
    expect(store.get(fontSizeAtom)).toBe(value);
    expect(localStorage.getItem("font-size")).toBe(String(value));

    const reloaded = createStore();
    const unsubscribe = reloaded.sub(fontSizeAtom, () => {});
    try {
        expect(reloaded.get(fontSizeAtom)).toBe(value);
        expect(localStorage.getItem("font-size")).toBe(String(value));
    } finally {
        unsubscribe();
    }
});

test("uses safe default 100 even when document font size is corrupted", async () => {
    document.documentElement.style.fontSize = "5000%";
    const { fontSizeAtom } = await import("./atoms");
    const store = createStore();
    expect(store.get(fontSizeAtom)).toBe(100);
    const unsubscribe = store.sub(fontSizeAtom, () => {});
    try {
        expect(store.get(fontSizeAtom)).toBe(100);
    } finally {
        unsubscribe();
    }
});
