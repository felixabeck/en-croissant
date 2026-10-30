import { createStore } from "jotai";
import { expect, test, vi } from "vitest";
import type { CollectionDescriptor } from "@/bindings";

test("reference ownership survives reload and ignores stale or foreign workspace reconciliation", async () => {
    const atoms = await import("./atoms");
    const store = createStore();
    const workspace = { id: { id: "reference-library" }, kind: "fileWorkspace" as const };
    const database = { id: { id: "reference-index" }, kind: "database" as const };
    const collection: CollectionDescriptor = {
        id: "55555555-5555-4555-8555-555555555555",
        name: "Games",
        file: workspace,
        database,
        account: null,
        status: "trashed",
        generation: "",
        omitted: 0,
        retiredDatabase: null,
        fetchSinceMs: null,
    };
    store.set(atoms.fileWorkspaceAtom, workspace);
    store.set(atoms.referenceDbAtom, database);
    store.set(atoms.reconcileReferenceCollectionAtom, {
        workspace,
        reference: database,
        collections: [collection],
    });
    expect(store.get(atoms.referenceDbAtom)).toEqual(database);
    vi.resetModules();
    const reloaded = await import("./atoms");
    const next = createStore();
    const unmount = next.sub(reloaded.referenceDbAtom, () => {});
    next.set(reloaded.fileWorkspaceAtom, workspace);
    expect(next.get(reloaded.referenceDbAtom)).toEqual(database);
    next.set(reloaded.reconcileReferenceCollectionAtom, {
        workspace: { ...workspace, id: { id: "foreign" } },
        reference: database,
        collections: [],
    });
    expect(next.get(reloaded.referenceDbAtom)).toEqual(database);
    next.set(reloaded.reconcileReferenceCollectionAtom, {
        workspace,
        reference: { ...database, id: { id: "stale" } },
        collections: [],
    });
    expect(next.get(reloaded.referenceDbAtom)).toEqual(database);
    next.set(reloaded.reconcileReferenceCollectionAtom, {
        workspace,
        reference: database,
        collections: [],
    });
    expect(next.get(reloaded.referenceDbAtom)).toBeNull();
    unmount();
});
