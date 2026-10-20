import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { defaultTree } from "@/utils/treeReducer";
import { serializeStorageValue } from "./debouncedStorage";
import { TabStorageRepository, TREE_STORAGE_VERSION } from "./tabStorage";

vi.mock("@/platform/native", () => ({ warn: vi.fn().mockResolvedValue(undefined) }));

const locator = {
    collection: "22222222-2222-4222-8222-222222222222",
    generation: "source-generation",
    ordinal: 7,
    stamp: "a".repeat(64),
};

beforeEach(() => sessionStorage.clear());
afterEach(() => sessionStorage.clear());

test("a cold persisted dirty tree retains its exact linked occurrence for the next save", () => {
    const state = {
        ...defaultTree(),
        dirty: true,
        sourceStamp: locator.stamp,
        linkedSource: locator,
    };
    state.root.comment = "Unsaved annotation remains recoverable";
    sessionStorage.setItem(
        "linked-tab",
        serializeStorageValue({ version: TREE_STORAGE_VERSION, state }),
    );

    const cold = new TabStorageRepository();
    expect(cold.read("linked-tab")?.state).toMatchObject(state);
    expect(cold.clone("linked-tab", "copied-tab", true)).toEqual({ kind: "copied" });
    expect(cold.flush()).toEqual([]);
    expect(new TabStorageRepository().read("copied-tab")?.state).toMatchObject(state);
});

test("a pre-collection dirty tree hydrates without inventing a linked source", () => {
    const legacy = { ...defaultTree(), dirty: true };
    sessionStorage.setItem("legacy-tab", JSON.stringify(legacy));
    const restored = new TabStorageRepository().read("legacy-tab")?.state;
    expect(restored).toMatchObject({ dirty: true, sourceStamp: null });
    expect(restored).not.toHaveProperty("linkedSource");
});

test.each([
    { ...locator, collection: "not-a-native-collection" },
    { ...locator, generation: "" },
    { ...locator, generation: "g".repeat(257) },
    { ...locator, ordinal: -1 },
    { ...locator, ordinal: 1.5 },
    { ...locator, stamp: "A".repeat(64) },
    { ...locator, stamp: "not-a-game-stamp" },
])("invalid linked provenance retains the original recovery bytes: %j", (linkedSource) => {
    const state = { ...defaultTree(), dirty: true, linkedSource };
    const raw = serializeStorageValue({ version: TREE_STORAGE_VERSION, state });
    sessionStorage.setItem("unreadable-linked-tab", raw);
    const cold = new TabStorageRepository();
    expect(cold.readTree("unreadable-linked-tab")).toEqual({ kind: "unreadable", rawValue: raw });
    expect(() => cold.seed("unreadable-linked-tab", defaultTree())).toThrow(
        "unreadable or unavailable",
    );
    expect(sessionStorage.getItem("unreadable-linked-tab")).toBe(raw);
});
