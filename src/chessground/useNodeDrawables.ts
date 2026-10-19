import { useAtomValue } from "jotai";
import { useStore } from "zustand";
import { eraseDrawablesOnClickAtom } from "@/state/atoms";
import type { TreeStore } from "@/state/store/tree";

export function useNodeDrawables(store: TreeStore) {
    const shapes = useStore(store, (s) => s.currentNode().shapes);
    const onChange = useStore(store, (s) => s.setShapes);
    const eraseOnMovablePieceClick = useAtomValue(eraseDrawablesOnClickAtom);
    return { shapes, onChange, eraseOnMovablePieceClick };
}
