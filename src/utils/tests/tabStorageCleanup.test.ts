import { expect, onTestFinished, test, vi } from "vitest";
import { TabStorageRepository, tabStorage, TREE_STORAGE_VERSION } from "@/state/store/tabStorage";
import { defaultTree } from "@/utils/treeReducer";

const native = vi.hoisted(() => ({ warn: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/platform/native", () => native);
vi.mock("@/state/persistError", () => ({ reportPersistError: vi.fn() }));

test("shared teardown settles local repositories and preserves unrelated timers", () => {
    vi.useFakeTimers();
    const repository = new TabStorageRepository();
    const unrelated = setTimeout(() => undefined, 10_000);
    repository.write("local-cleanup", { version: TREE_STORAGE_VERSION, state: defaultTree() });
    expect(vi.getTimerCount()).toBe(2);
    onTestFinished(() => {
        try {
            // jsdom queues zero-delay storage events when flush writes to sessionStorage.
            // Deliver those events without advancing the 300 ms repository debounce.
            vi.advanceTimersByTime(0);
            expect(vi.getTimerCount()).toBe(1);
            expect(repository.pendingCount()).toBe(0);
            expect(sessionStorage.getItem("local-cleanup")).not.toBeNull();
        } finally {
            clearTimeout(unrelated);
            vi.useRealTimers();
            sessionStorage.clear();
        }
    });
});

test("shared teardown owns singleton writes across resetModules", async () => {
    vi.useFakeTimers();
    tabStorage.write("original-module", { version: TREE_STORAGE_VERSION, state: defaultTree() });
    vi.resetModules();
    const fresh = (await import("@/state/store/tabStorage")).tabStorage;
    expect(fresh).not.toBe(tabStorage);
    fresh.write("fresh-module", { version: TREE_STORAGE_VERSION, state: defaultTree() });
    expect(vi.getTimerCount()).toBe(2);
    onTestFinished(() => {
        try {
            vi.advanceTimersByTime(0);
            expect(vi.getTimerCount()).toBe(0);
            expect(tabStorage.pendingCount()).toBe(0);
            expect(fresh.pendingCount()).toBe(0);
            expect(sessionStorage.getItem("original-module")).not.toBeNull();
            expect(sessionStorage.getItem("fresh-module")).not.toBeNull();
        } finally {
            vi.useRealTimers();
            sessionStorage.clear();
        }
    });
});

test("shared teardown discards failed pending test writes before the next test", () => {
    vi.useFakeTimers();
    const repository = new TabStorageRepository();
    repository.write("refused-cleanup", { version: TREE_STORAGE_VERSION, state: defaultTree() });
    const refuse = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new DOMException("quota", "QuotaExceededError");
    });
    onTestFinished(() => {
        try {
            expect(vi.getTimerCount()).toBe(0);
            expect(repository.pendingCount()).toBe(0);
            expect(repository.read("refused-cleanup")).toBeNull();
        } finally {
            refuse.mockRestore();
            vi.useRealTimers();
            sessionStorage.clear();
        }
    });
});
