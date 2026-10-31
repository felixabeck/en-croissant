import { createStore } from "jotai";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import "./atoms";

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
});

test.each([65, 105, 72, 70.5, "80", null, 5000])(
    "repairs invalid stored piece size %j to 100 during real atom hydration",
    async (storedValue) => {
        localStorage.setItem("piece-size", JSON.stringify(storedValue));
        const { pieceSizeAtom } = await import("./atoms");
        const store = createStore();
        const unsubscribe = store.sub(pieceSizeAtom, () => {});
        try {
            expect(store.get(pieceSizeAtom)).toBe(100);
            expect(localStorage.getItem("piece-size")).toBe("100");
        } finally {
            unsubscribe();
        }
    },
);

test.each([70, 85])(
    "preserves valid stored piece size %i during real atom hydration",
    async (value) => {
        localStorage.setItem("piece-size", String(value));
        const { pieceSizeAtom } = await import("./atoms");
        const store = createStore();
        const unsubscribe = store.sub(pieceSizeAtom, () => {});
        try {
            expect(store.get(pieceSizeAtom)).toBe(value);
            expect(localStorage.getItem("piece-size")).toBe(String(value));
        } finally {
            unsubscribe();
        }
    },
);
