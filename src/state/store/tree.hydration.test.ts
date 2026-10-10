import { parseUci } from "chessops";
import { afterEach, expect, test, vi } from "vitest";
import {
    createNode,
    defaultTree,
    getBoardState,
    getMemoizedBoardStateMap,
} from "@/utils/treeReducer";
import { serializeStorageValue } from "./debouncedStorage";
import { tabStorage, TREE_STORAGE_VERSION } from "./tabStorage";
import {
    captureReportOwner,
    closeTreeStore,
    createTreeStore,
    discardTreeStoreStorage,
    retryTreeStoreStorage,
    retargetTreeStore,
} from "./tree";

const ids: string[] = [];

afterEach(() => {
    vi.restoreAllMocks();
    for (const id of ids.splice(0)) {
        closeTreeStore(id);
        tabStorage.remove(id);
    }
});

test("hydrates the referenced physical tree without reading the logical tab key", () => {
    const logical = crypto.randomUUID();
    const physical = crypto.randomUUID();
    ids.push(logical, physical);
    const legacy = defaultTree();
    legacy.headers.event = "Discarded game";
    const candidate = defaultTree();
    candidate.headers.event = "Referenced game";
    candidate.sourceStamp = "a".repeat(64);
    tabStorage.seed(logical, legacy);
    tabStorage.seed(physical, candidate);
    const store = createTreeStore(logical, undefined, physical);
    expect(store.getState().headers.event).toBe("Referenced game");
    expect(createTreeStore(logical, undefined, physical)).toBe(store);
    store.getState().setComment("edit on referenced tree");
    expect(tabStorage.flush()).toEqual([]);
    expect(tabStorage.read<TreeStoreSnapshot>(logical)?.state.headers.event).toBe("Discarded game");
    expect(tabStorage.read<TreeStoreSnapshot>(physical)?.state.root.comment).toBe(
        "edit on referenced tree",
    );
});

type TreeStoreSnapshot = ReturnType<typeof defaultTree>;

test.each(["missing", "refused"] as const)(
    "retargeted legacy cached store requires its physical generation after a %s read",
    async (failure) => {
        const logical = crypto.randomUUID();
        const physical = crypto.randomUUID();
        ids.push(logical, physical);
        const store = createTreeStore(logical);
        const reportOwner = captureReportOwner(logical);
        expect(tabStorage.getStatus(logical).kind).toBe("absent");
        const replacement = defaultTree();
        replacement.headers.event = "Durable replacement";
        tabStorage.seed(physical, replacement);
        retargetTreeStore(logical, physical, replacement);
        expect(tabStorage.flush()).toEqual([]);
        const bytes = sessionStorage.getItem(physical)!;
        const installed = store.getState();
        sessionStorage.removeItem(physical);
        if (failure === "refused") {
            const get = Storage.prototype.getItem;
            vi.spyOn(Storage.prototype, "getItem").mockImplementation(
                function (this: Storage, key) {
                    if (key === physical) throw new DOMException("refused", "SecurityError");
                    return get.call(this, key);
                },
            );
        }
        expect(await retryTreeStoreStorage(logical)).toMatchObject({ kind: "unavailable" });
        expect(store.getState()).toEqual(installed);
        store.getState().setComment("blocked edit after retarget");
        expect(tabStorage.pendingCount()).toBe(0);
        vi.restoreAllMocks();
        expect(sessionStorage.getItem(physical)).toBeNull();
        expect(sessionStorage.getItem(logical)).toBeNull();
        sessionStorage.setItem(physical, bytes);
        expect(await retryTreeStoreStorage(logical)).toEqual({ kind: "available" });
        expect(createTreeStore(logical)).toBe(store);
        expect(captureReportOwner(logical)).toBe(reportOwner);
        expect(store.getState().headers.event).toBe("Durable replacement");
        expect(store.getState().root.comment).toBe("");
        store.getState().setComment("recovered physical edit");
        expect(tabStorage.flush()).toEqual([]);
        expect(tabStorage.read<TreeStoreSnapshot>(physical, true)?.state.root.comment).toBe(
            "recovered physical edit",
        );
        expect(sessionStorage.getItem(logical)).toBeNull();
    },
);

test.each(["missing", "unreadable", "unavailable"] as const)(
    "referenced %s tree remains write gated until explicit recovery",
    async (kind) => {
        const logical = crypto.randomUUID();
        const physical = crypto.randomUUID();
        ids.push(logical, physical);
        if (kind === "unreadable") sessionStorage.setItem(physical, "corrupt referenced bytes");
        if (kind === "unavailable") {
            const get = Storage.prototype.getItem;
            vi.spyOn(Storage.prototype, "getItem").mockImplementation(
                function (this: Storage, key) {
                    if (key === physical) throw new DOMException("refused", "SecurityError");
                    return get.call(this, key);
                },
            );
        }
        const store = createTreeStore(logical, undefined, physical);
        expect(tabStorage.getStatus(physical).kind).toBe(kind === "missing" ? "unavailable" : kind);
        store.getState().setComment("must not overwrite reference");
        expect(tabStorage.pendingCount()).toBe(0);
        vi.restoreAllMocks();
        expect(sessionStorage.getItem(physical)).toBe(
            kind === "unreadable" ? "corrupt referenced bytes" : null,
        );
        if (kind === "unreadable") discardTreeStoreStorage(logical, physical);
        tabStorage.flush();
        const recovered = defaultTree();
        recovered.headers.event = "Recovered physical generation";
        sessionStorage.setItem(
            physical,
            serializeStorageValue({ version: TREE_STORAGE_VERSION, state: recovered }),
        );
        expect(await retryTreeStoreStorage(logical)).toEqual({ kind: "available" });
        expect(store.getState().headers.event).toBe("Recovered physical generation");
        expect(createTreeStore(logical)).toBe(store);
    },
);

test.each([0, TREE_STORAGE_VERSION])(
    "restores saved moves and metadata from a version %i tree envelope",
    (version) => {
        const id = `tree-hydration-version-${version}`;
        ids.push(id);
        const saved = defaultTree();
        saved.headers.event = "Saved game";
        saved.position = [0];
        const child = createNode({
            fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
            move: parseUci("e2e4")!,
            san: "e4",
            halfMoves: 1,
        });
        child.comment = "Saved annotation";
        saved.root.children.push(child);
        sessionStorage.setItem(id, serializeStorageValue({ version, state: saved }));

        const restored = createTreeStore(id).getState();

        expect(restored.headers.event).toBe("Saved game");
        expect(restored.position).toEqual([0]);
        expect(restored.root.children).toHaveLength(1);
        expect(restored.root.children[0]).toMatchObject({
            san: "e4",
            comment: "Saved annotation",
            halfMoves: 1,
        });
    },
);

test("rehydration repairs stale paths before deriving the whole-tree board map", () => {
    const id = "tree-hydration-stale-paths";
    ids.push(id);
    const saved = defaultTree();
    saved.position = [0, 0, 5];
    saved.headers.start = [0, 5];

    const e4 = createNode({
        fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
        move: parseUci("e2e4")!,
        san: "e4",
        halfMoves: 1,
    });
    const e5 = createNode({
        fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
        move: parseUci("e7e5")!,
        san: "e5",
        halfMoves: 2,
    });
    e4.children.push(e5);
    const d4 = createNode({
        fen: "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1",
        move: parseUci("d2d4")!,
        san: "d4",
        halfMoves: 1,
    });
    saved.root.children.push(e4, d4);
    sessionStorage.setItem(
        id,
        serializeStorageValue({ version: TREE_STORAGE_VERSION, state: saved }),
    );

    const restored = createTreeStore(id).getState();

    expect(restored.headers.start).toBeUndefined();
    expect(restored.position).toEqual([0, 0]);
    const map = getMemoizedBoardStateMap(restored.root, restored.headers.start ?? []);
    expect(map[getBoardState(d4.fen)]?.map(({ path }) => path)).toEqual([[1]]);
    expect(Object.values(map).flat()).toHaveLength(4);
});
