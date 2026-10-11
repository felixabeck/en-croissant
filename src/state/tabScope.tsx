import { useAtomValue, useSetAtom, type PrimitiveAtom } from "jotai";
import type { AtomFamily } from "jotai/vanilla/utils/atomFamily";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { tabsAtom, updateTabAtom } from "./atoms";
import type { Tab } from "./workspaceTypes";

type TabScope = {
  tabId: string | null;
  resolve<T>(family: AtomFamily<string, PrimitiveAtom<T>>): PrimitiveAtom<T>;
};

const TabScopeContext = createContext<TabScope | null>(null);

export function WorkspaceTabScope({ tabId, children }: { tabId: string; children: ReactNode }) {
  const scope = useMemo<TabScope>(() => ({ tabId, resolve: (family) => family(tabId) }), [tabId]);
  return <TabScopeContext.Provider value={scope}>{children}</TabScopeContext.Provider>;
}

export function EphemeralTabScope({ children }: { children: ReactNode }) {
  const [scope] = useState<TabScope>(() => {
    const key = `ephemeral:${crypto.randomUUID()}`;
    const atoms = new Map<unknown, unknown>();
    return {
      tabId: null,
      resolve<T>(family: AtomFamily<string, PrimitiveAtom<T>>) {
        if (!atoms.has(family)) {
          const scopedAtom = family(key);
          // Keep the atom in this scope only, without retaining its key in the family.
          family.remove(key);
          atoms.set(family, scopedAtom);
        }
        return atoms.get(family) as PrimitiveAtom<T>;
      },
    };
  });
  return <TabScopeContext.Provider value={scope}>{children}</TabScopeContext.Provider>;
}

/**
 * Capture the owner's atom so callbacks and unmount cleanup keep writing to that tab.
 * The captured object never recreates a family entry already removed by disposeTabAtoms.
 */
export function useTabAtom<T>(family: AtomFamily<string, PrimitiveAtom<T>>): PrimitiveAtom<T> {
  const scope = useContext(TabScopeContext);
  // A missing provider is a developer invariant, never an untrusted-input failure.
  if (!scope) throw new Error("useTabAtom used outside a TabScope");
  return useMemo(() => scope.resolve(family), [scope, family]);
}

export function useOwnerTabId(): string {
  const scope = useContext(TabScopeContext);
  // A missing provider is a developer invariant, never an untrusted-input failure.
  if (!scope || scope.tabId === null)
    throw new Error("useOwnerTabId used outside a WorkspaceTabScope");
  return scope.tabId;
}

export function useOwnerTab(): [Tab | undefined, (update: Tab | ((tab: Tab) => Tab)) => boolean] {
  const scope = useContext(TabScopeContext);
  // A missing provider is a developer invariant, never an untrusted-input failure.
  if (!scope) throw new Error("useOwnerTab used outside a TabScope");
  const tabs = useAtomValue(tabsAtom);
  const updateTab = useSetAtom(updateTabAtom);
  const tabId = scope.tabId;
  const setTab = useCallback(
    (update: Tab | ((tab: Tab) => Tab)) => tabId !== null && updateTab(tabId, update),
    [tabId, updateTab],
  );
  return [tabs.find((tab) => tab.value === tabId), setTab];
}
