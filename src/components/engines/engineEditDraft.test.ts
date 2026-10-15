import { expect, test } from "vitest";
import type { LocalEngine } from "@/utils/engines";
import { applyEngineEdit, EngineEditDraft } from "./engineEditDraft";

const engine: LocalEngine = {
    type: "local",
    id: "id",
    name: "Committed",
    version: "18",
    filename: "stockfish",
    handle: { id: { id: "old" }, kind: "engine" },
    legacyAssessment: null,
    settings: [{ type: "string", name: "Threads", value: "1" }],
};

test("field and named-option intents merge immutable current records with upgraded attachments", () => {
    const upgraded = {
        ...engine,
        handle: { ...engine.handle, id: { id: "new" } },
        downloadLink: "new-catalog",
        imageHandle: { id: { id: "image" }, kind: "engineImage" as const },
    };
    const renamed = applyEngineEdit(upgraded, { kind: "field", field: "name", value: "New" });
    const changed = applyEngineEdit(renamed, { kind: "option", name: "Hash", value: "32" });
    expect(changed).toMatchObject({
        name: "New",
        handle: upgraded.handle,
        imageHandle: upgraded.imageHandle,
        downloadLink: "new-catalog",
        legacyAssessment: null,
    });
    expect(changed.settings).toEqual([
        ...engine.settings!,
        { type: "string", name: "Hash", value: "32" },
    ]);
    expect(engine.name).toBe("Committed");
    expect(engine.settings).toHaveLength(1);
});

test("draft acknowledgements retain only newest input and failure cannot poison another field", () => {
    const draft = new EngineEditDraft();
    const old = { kind: "field", field: "name", value: "Old" } as const;
    const newest = { ...old, value: "Newest" };
    const version = { kind: "field", field: "version", value: "19" } as const;
    const oldId = draft.accept(old);
    const newestId = draft.accept(newest);
    const versionId = draft.accept(version);
    expect(draft.settle(old, oldId)).toBe(false);
    expect(draft.display(engine).name).toBe("Newest");
    expect(draft.settle(newest, newestId)).toBe(true);
    expect(draft.display(engine)).toMatchObject({ name: "Committed", version: "19" });
    draft.settle(version, versionId);
    expect(draft.display(engine)).toEqual(engine);
    const pendingId = draft.accept(old);
    draft.close();
    expect(draft.accept(version)).toBeNull();
    expect(draft.settle(old, pendingId)).toBe(false);
    expect(draft.display(engine)).toEqual(engine);
});

test("named resource intents preserve their type and removal composes with independent go", () => {
    const resource = { type: "resource" as const, name: "Book", resources: [] };
    const changed = applyEngineEdit(engine, { kind: "option", name: "Book", value: resource });
    const searching = applyEngineEdit(changed, {
        kind: "field",
        field: "go",
        value: { t: "Depth", c: 12 },
    });
    expect(searching.settings).toEqual([...engine.settings!, resource]);
    const removed = applyEngineEdit(searching, { kind: "option", name: "Book", value: null });
    expect(removed.settings).toEqual(engine.settings);
    expect(removed.go).toEqual({ t: "Depth", c: 12 });
    expect(engine.go).toBeUndefined();
});

test("single named replacement removes duplicate matches and retains unrelated option order immutably", () => {
    const book = { type: "resource" as const, name: "Book", resources: [] };
    const settings = [
        book,
        { type: "string" as const, name: "Hash", value: "16" },
        ...engine.settings!,
        { type: "string" as const, name: "Hash", value: "32" },
    ];
    const original = { ...engine, settings };
    Object.freeze(settings);
    const replaced = applyEngineEdit(original, { kind: "option", name: "Hash", value: "64" });
    expect(replaced.settings).toEqual([
        book,
        ...engine.settings!,
        { type: "string", name: "Hash", value: "64" },
    ]);
    expect(replaced.settings?.[0]).toBe(book);
    expect(
        applyEngineEdit(original, { kind: "option", name: "Hash", value: null }).settings,
    ).toEqual([book, ...engine.settings!]);
    expect(original.settings).toBe(settings);
    expect(original.settings).toHaveLength(4);
});

test("newest Hash intent after Reset displays in acceptance order while earlier saves are pending", () => {
    const draft = new EngineEditDraft();
    const first = { kind: "option", name: "Hash", value: "32" } as const;
    const reset = {
        kind: "reset",
        settings: [{ type: "string", name: "Hash", value: "16" }],
    } as const;
    const newest = { ...first, value: "64" };
    const firstId = draft.accept(first);
    expect(draft.display(engine).settings).toContainEqual({
        type: "string",
        name: "Hash",
        value: "32",
    });
    const resetIntent = { ...reset, settings: [...reset.settings] };
    const resetId = draft.accept(resetIntent);
    expect(draft.display(engine).settings).toEqual(reset.settings);
    const newestId = draft.accept(newest);
    expect(draft.display(engine).settings).toContainEqual({
        type: "string",
        name: "Hash",
        value: "64",
    });
    expect(draft.settle(first, firstId)).toBe(false);
    expect(draft.display(engine).settings).toContainEqual({
        type: "string",
        name: "Hash",
        value: "64",
    });
    draft.settle(resetIntent, resetId);
    const resetCommitted = applyEngineEdit(engine, resetIntent);
    expect(draft.display(resetCommitted).settings).toContainEqual({
        type: "string",
        name: "Hash",
        value: "64",
    });
    const newestCommitted = applyEngineEdit(resetCommitted, newest);
    draft.settle(newest, newestId);
    expect(draft.display(newestCommitted)).toEqual(newestCommitted);
});
