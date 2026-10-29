import { isDrop, isNormal } from "chessops";
import { createStore } from "zustand/vanilla";
import type { TreeNode } from "@/utils/treeReducer";
import { nextContinuation, type TreeStore } from "@/state/store/tree";

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
            state.headers !== previous.headers ||
            state.practicePath !== previous.practicePath
        ) {
            chooser.getState().close();
        } else if (state.root !== previous.root) {
            const { choice, close } = chooser.getState();
            if (!choice) return;
            const continuation = nextContinuation(state);
            // Metadata writes can copy ancestor continuations without changing the listed moves.
            if (
                !continuation ||
                continuation.children.length !== choice.children.length ||
                !continuation.children.every((child, index) => {
                    const opened = choice.children[index];
                    if (child.san !== opened.san || child.halfMoves !== opened.halfMoves)
                        return false;
                    const move = child.move;
                    const openedMove = opened.move;
                    if (!move || !openedMove) return move === openedMove;
                    if (isNormal(move) && isNormal(openedMove)) {
                        return (
                            move.from === openedMove.from &&
                            move.to === openedMove.to &&
                            move.promotion === openedMove.promotion
                        );
                    }
                    return (
                        isDrop(move) &&
                        isDrop(openedMove) &&
                        move.role === openedMove.role &&
                        move.to === openedMove.to
                    );
                })
            ) {
                close();
            }
        }
    });
}
