import { createContext, useEffect, useRef } from "react";
import { createTreeStore, type TreeStore } from "@/state/store/tree";
import type { TreeState } from "@/utils/treeReducer";

export const TreeStateContext = createContext<TreeStore | null>(null);

export function TreeStateProvider({
  id,
  initial,
  children,
}: {
  id?: string;
  initial?: TreeState;
  children: React.ReactNode;
}) {
  const storeRef = useRef<TreeStore | null>(null);
  if (storeRef.current === null) {
    storeRef.current = createTreeStore(id, initial);
  }
  const store = storeRef.current;

  useEffect(() => () => store.dispose(), [store]);

  return <TreeStateContext.Provider value={store}>{children}</TreeStateContext.Provider>;
}
