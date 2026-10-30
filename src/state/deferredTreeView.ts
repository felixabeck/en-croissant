import { useCallback, useSyncExternalStore } from "react";
import type { TreeStore } from "./store/tree";

type Snapshot = ReturnType<TreeStore["getState"]>;
type View = { retained: Snapshot | null; listeners: Set<() => void> };

// Store ownership bounds retention. Nothing here enters the persisted tree or storage.
const views = new WeakMap<TreeStore, View>();

function viewFor(store: TreeStore) {
    let view = views.get(store);
    if (!view) {
        view = { retained: null, listeners: new Set() };
        views.set(store, view);
    }
    return view;
}

export function deferTreeView(store: TreeStore) {
    viewFor(store).retained = store.getState();
}

export function isTreeViewDeferred(store: TreeStore) {
    return views.get(store)?.retained != null;
}

export function releaseTreeView(store: TreeStore) {
    const view = viewFor(store);
    view.retained = null;
    for (const listener of view.listeners) listener();
}

export function useTreeView(store: TreeStore) {
    return useSyncExternalStore(
        useCallback(
            (listener) => {
                const view = viewFor(store);
                view.listeners.add(listener);
                const unsubscribe = store.subscribe(listener);
                return () => {
                    unsubscribe();
                    view.listeners.delete(listener);
                };
            },
            [store],
        ),
        useCallback(() => views.get(store)?.retained ?? store.getState(), [store]),
    );
}
