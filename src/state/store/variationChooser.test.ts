import { expect, test, vi } from "vitest";
import { closeTreeStore, createTreeStore } from "@/state/store/tree";
import {
    createVariationChooserStore,
    subscribeVariationChooser,
} from "@/state/store/variationChooser";
import { fixtureNode } from "@/tests/treeFixtures";
import { defaultTree } from "@/utils/treeReducer";

vi.mock("@/utils/sound", () => ({ playSound: vi.fn() }));

test.each([
    {
        input: "position",
        unchanged: ["root"] as const,
        change: (tree: ReturnType<typeof createTreeStore>) => tree.getState().goToMove([0]),
    },
    {
        input: "root",
        unchanged: ["position"] as const,
        change: (tree: ReturnType<typeof createTreeStore>) => tree.getState().setComment("changed"),
    },
    {
        input: "headers.start",
        unchanged: ["position", "root"] as const,
        change: (tree: ReturnType<typeof createTreeStore>) => tree.getState().setStart([0]),
    },
    {
        input: "practicePath",
        unchanged: ["position", "root"] as const,
        change: (tree: ReturnType<typeof createTreeStore>) => tree.getState().setPracticePath([1]),
    },
])("closes when $input changes", ({ unchanged, change }) => {
    const initial = defaultTree();
    initial.root.children = [fixtureNode("e4"), fixtureNode("d4")];
    const tree = createTreeStore(undefined, initial);
    const chooser = createVariationChooserStore();
    const unsubscribe = subscribeVariationChooser(tree, chooser);
    chooser.getState().open(tree.getState().root.children);
    const previous = tree.getState();
    change(tree);
    expect(chooser.getState().choice).toBeNull();
    for (const field of unchanged) expect(tree.getState()[field]).toBe(previous[field]);
    unsubscribe();
});

test("chooser actions are transient and never write to either storage or the tree", () => {
    const tree = createTreeStore("variation-chooser-storage-test");
    const previous = tree.getState();
    const storageWrite = vi.spyOn(Storage.prototype, "setItem");
    const chooser = createVariationChooserStore();
    const unsubscribe = subscribeVariationChooser(tree, chooser);
    try {
        chooser.getState().open([fixtureNode("e4"), fixtureNode("d4")]);
        chooser.getState().select(-1);
        expect(chooser.getState().choice?.selected).toBe(1);
        chooser.getState().selectIndex(0);
        chooser.getState().close();
        expect(storageWrite).not.toHaveBeenCalled();
        expect(tree.getState()).toBe(previous);
        expect(tree.getState()).not.toHaveProperty("choice");
    } finally {
        unsubscribe();
        storageWrite.mockRestore();
        closeTreeStore("variation-chooser-storage-test");
    }
});
