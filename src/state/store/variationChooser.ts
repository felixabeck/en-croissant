import { createStore } from "zustand/vanilla";
import type { TreeNode } from "@/utils/treeReducer";
import type { TreeStore } from "@/state/store/tree";

export type VariationChoice = { children: TreeNode[]; selected: number } | null;

export function createVariationChooserStore() {
    return createStore<{
        choice: VariationChoice;
        open: (children: TreeNode[]) => void;
        select: (step: number) => void;
        selectIndex: (index: number) => void;
        close: () => void;
    }>()((set) => ({
        choice: null,
        open: (children) => set({ choice: children.length ? { children, selected: 0 } : null }),
        select: (step) =>
            set(({ choice }) => ({
                choice: choice && {
                    ...choice,
                    selected:
                        (choice.selected + step + choice.children.length) % choice.children.length,
                },
            })),
        selectIndex: (index) =>
            set(({ choice }) => ({
                choice:
                    choice && index >= 0 && index < choice.children.length
                        ? { ...choice, selected: index }
                        : choice,
            })),
        close: () => set({ choice: null }),
    }));
}

export type VariationChooserStore = ReturnType<typeof createVariationChooserStore>;

export function subscribeVariationChooser(tree: TreeStore, chooser: VariationChooserStore) {
    return tree.subscribe((state, previous) => {
        if (
            state.position !== previous.position ||
            state.root !== previous.root ||
            state.headers !== previous.headers ||
            state.practicePath !== previous.practicePath
        ) {
            chooser.getState().close();
        }
    });
}
