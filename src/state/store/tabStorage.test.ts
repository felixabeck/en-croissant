import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { defaultTree } from "@/utils/treeReducer";
import { deserializeStorageValue, serializeStorageValue } from "./debouncedStorage";
import {
    decodeLegacyOrCompressed,
    isBoundedTreeForStorage,
    migrateTreeForStorage,
    persistStorageWriteError,
    TabStorageRepository,
    TREE_STORAGE_VERSION,
} from "./tabStorage";

const native = vi.hoisted(() => ({ warn: vi.fn() }));
const persistError = vi.hoisted(() => ({ reportPersistError: vi.fn() }));
vi.mock("@/platform/native", () => native);
vi.mock("@/state/persistError", () => persistError);

let storage: TabStorageRepository;

beforeEach(() => {
    sessionStorage.clear();
    storage = new TabStorageRepository();
    vi.useFakeTimers();
    native.warn.mockClear();
    persistError.reportPersistError.mockClear();
});

afterEach(() => vi.useRealTimers());

function treeWith(value: (tree: ReturnType<typeof defaultTree>) => void) {
    const tree = structuredClone(defaultTree());
    value(tree);
    return tree;
}

type StoredTreeForTest = ReturnType<typeof defaultTree> & { practicePath?: number[] | null };

function treeWithPaths(paths: {
    position?: number[];
    start?: number[];
    practicePath?: number[] | null;
}): StoredTreeForTest {
    const tree: StoredTreeForTest = defaultTree();
    const e4: typeof tree.root = {
        ...tree.root,
        fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
        san: "e4",
        halfMoves: 1,
        children: [],
    };
    e4.children.push({
        ...e4,
        fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
        san: "e5",
        halfMoves: 2,
        children: [],
    });
    const d4: typeof tree.root = {
        ...tree.root,
        fen: "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1",
        san: "d4",
        halfMoves: 1,
        children: [],
    };
    tree.root.children.push(e4, d4);

    if (paths.position !== undefined) tree.position = paths.position;
    if (paths.start !== undefined) tree.headers.start = paths.start;
    if ("practicePath" in paths) tree.practicePath = paths.practicePath;
    return tree;
}

function persistTree(tabId: string, state: unknown) {
    sessionStorage.setItem(tabId, serializeStorageValue({ version: TREE_STORAGE_VERSION, state }));
}

function expectSeedRejected(value: ReturnType<typeof defaultTree>) {
    expect(() => storage.seed("invalid", value)).toThrow("Cannot persist an invalid game tree.");
    expect(sessionStorage.getItem("invalid")).toBeNull();
}

test("preserves every supported tree schema field and enum boundary", () => {
    const tree = treeWith((state) => {
        state.root = {
            ...state.root,
            fen: "root-fen",
            move: { from: 0, to: 63, promotion: "queen" },
            san: "Qa8",
            children: [
                {
                    ...state.root,
                    fen: "child-fen",
                    move: { role: "pawn", to: 63 },
                    score: { value: { type: "mate", value: -3 }, wdl: [1, 0, 0] },
                    depth: 0,
                    halfMoves: 2,
                    shapes: [
                        {
                            orig: "a1",
                            dest: "h8",
                            brush: "",
                            modifiers: { lineWidth: 0 },
                        },
                    ],
                    annotations: [
                        "",
                        "!",
                        "!!",
                        "?",
                        "??",
                        "!?",
                        "?!",
                        "+-",
                        "±",
                        "⩲",
                        "=",
                        "∞",
                        "⩱",
                        "∓",
                        "-+",
                        "N",
                        "↑↑",
                        "↑",
                        "→",
                        "⇆",
                        "=∞",
                        "⊕",
                        "∆",
                        "□",
                        "⨀",
                        "⊗",
                    ],
                    comment: "child",
                    clock: 0,
                },
            ],
            score: { value: { type: "cp", value: 0 }, wdl: null },
            depth: null,
            shapes: [],
            annotations: [],
            comment: "root",
        };
        state.headers = {
            id: 0,
            fen: "header-fen",
            event: "event",
            site: "site",
            date: "2026.08.09",
            time: "12:00",
            round: "1",
            white: "White",
            white_elo: 0,
            black: "Black",
            black_elo: 0,
            result: "1/2-1/2",
            time_control: "600+0",
            white_time_control: "600+0",
            black_time_control: "600+0",
            eco: "A00",
            variant: "standard",
            other: { custom: "value" },
            start: [0, 1],
            orientation: "black",
        };
        state.position = [0, 1];
        (state as typeof state & { practicePath?: number[] }).practicePath = [0];
    });

    storage.seed("rich", tree);
    expect(storage.getStatus("rich")).toEqual({ kind: "available" });

    expect(storage.read("rich")?.state).toMatchObject({
        root: {
            move: { from: 0, to: 63, promotion: "queen" },
            score: { value: { type: "cp", value: 0 }, wdl: null },
            children: [
                {
                    move: { role: "pawn", to: 63 },
                    score: { value: { type: "mate", value: -3 }, wdl: [1, 0, 0] },
                    shapes: [{ orig: "a1", dest: "h8", brush: "" }],
                },
            ],
        },
        headers: { result: "1/2-1/2", orientation: "black", other: { custom: "value" } },
        practicePath: [0],
    });
});

test("accepts both coordinate move boundaries and both header orientations", () => {
    const boundary = treeWith((tree) => {
        tree.root.move = { from: 63, to: 0 };
        tree.headers.orientation = "black";
    });
    storage.seed("coordinate-boundary", boundary);
    expect(storage.read("coordinate-boundary")?.state).toMatchObject({
        root: { move: { from: 63, to: 0 } },
        headers: { orientation: "black" },
    });

    const drop = treeWith((tree) => (tree.root.move = { role: "king", to: 63 }));
    storage.seed("drop-boundary", drop);
    expect(storage.read("drop-boundary")?.state).toMatchObject({
        root: { move: { role: "king", to: 63 } },
    });

    expectSeedRejected(treeWith((tree) => (tree.headers.orientation = "green" as never)));
});

test("evaluates the complete static schema on a fresh ESM module instance", async () => {
    vi.resetModules();
    const { TabStorageRepository: FreshRepository } = await import("./tabStorage");
    const fresh = new FreshRepository();
    const tree = treeWith((state) => {
        state.root.move = { from: 0, to: 63, promotion: "queen" };
        state.root.score = { value: { type: "cp", value: 0 }, wdl: [0, 1, 0] };
        state.root.score = { value: { type: "cp", value: 0 }, wdl: [0, 1, 0] };
        state.root.children = [
            {
                ...state.root,
                move: { role: "king", to: 0 },
                score: { value: { type: "mate", value: 1 }, wdl: null },
                children: [],
            },
        ];
        state.root.shapes = [{ orig: "a1", dest: "h8", brush: "", modifiers: { lineWidth: 0 } }];
        state.root.annotations = [
            "",
            "!",
            "!!",
            "?",
            "??",
            "!?",
            "?!",
            "+-",
            "±",
            "⩲",
            "=",
            "∞",
            "⩱",
            "∓",
            "-+",
            "N",
            "↑↑",
            "↑",
            "→",
            "⇆",
            "=∞",
            "⊕",
            "∆",
            "□",
            "⨀",
            "⊗",
        ];
        state.headers = {
            ...state.headers,
            result: "0-1",
            orientation: "white",
            other: { custom: "value" },
        };
    });

    fresh.seed("fresh-schema", tree);
    expect(fresh.read("fresh-schema")?.state).toMatchObject({
        root: {
            move: { from: 0, to: 63, promotion: "queen" },
            score: { value: { type: "cp", value: 0 }, wdl: [0, 1, 0] },
            shapes: [{ orig: "a1", dest: "h8", brush: "", modifiers: { lineWidth: 0 } }],
            annotations: tree.root.annotations,
        },
        headers: { result: "0-1", orientation: "white", other: { custom: "value" } },
    });

    for (const result of ["1-0", "0-1", "1/2-1/2", "*"] as const) {
        const withResult = structuredClone(tree);
        withResult.headers.result = result;
        fresh.seed(`result-${result}`, withResult);
        expect(fresh.read(`result-${result}`)?.state).toMatchObject({ headers: { result } });
    }

    for (const role of ["pawn", "knight", "bishop", "rook", "queen", "king"] as const) {
        const withRole = structuredClone(tree);
        withRole.root.move = { role, to: 0 };
        fresh.seed(`role-${role}`, withRole);
        expect(fresh.read(`role-${role}`)?.state).toMatchObject({
            root: { move: { role, to: 0 } },
        });
    }

    for (const invalidShape of ["xa1", "a1x"] as const) {
        const invalid = structuredClone(tree);
        invalid.root.shapes = [{ orig: invalidShape, dest: "h8", brush: "" }] as never;
        expect(() => fresh.seed(`invalid-shape-${invalidShape}`, invalid)).toThrow(
            "Cannot persist an invalid game tree.",
        );
    }
    for (const invalidDestination of ["xh8", "h8x"] as const) {
        const invalid = structuredClone(tree);
        invalid.root.shapes = [{ orig: "a1", dest: invalidDestination, brush: "" }] as never;
        expect(() => fresh.seed(`invalid-destination-${invalidDestination}`, invalid)).toThrow(
            "Cannot persist an invalid game tree.",
        );
    }
});

test("rejects every persisted tree type, scalar, and structural boundary", () => {
    expectSeedRejected(treeWith((tree) => (tree.headers.event = "x".repeat(100_001))));
    expectSeedRejected(treeWith((tree) => (tree.position = Array(513).fill(0))));
    expectSeedRejected(treeWith((tree) => (tree.root.move = { from: -1, to: 0 } as never)));
    expectSeedRejected(treeWith((tree) => (tree.root.move = { from: 0, to: 64 } as never)));
    expectSeedRejected(treeWith((tree) => (tree.root.move = { role: "queen", to: -1 } as never)));
    expectSeedRejected(treeWith((tree) => (tree.root.move = { role: "queen", to: 64 } as never)));
    expectSeedRejected(treeWith((tree) => (tree.root.move = { role: "dragon", to: 0 } as never)));
    expectSeedRejected(
        treeWith(
            (tree) =>
                (tree.root.score = { value: { type: "cp", value: Infinity }, wdl: null } as never),
        ),
    );
    expectSeedRejected(
        treeWith(
            (tree) =>
                (tree.root.score = { value: { type: "mate", value: 0.5 }, wdl: null } as never),
        ),
    );
    expectSeedRejected(
        treeWith((tree) => (tree.root.shapes = [{ orig: "xa1", dest: "h8", brush: "" }] as never)),
    );
    expectSeedRejected(
        treeWith((tree) => (tree.root.shapes = [{ orig: "a1x", dest: "h8", brush: "" }] as never)),
    );
    expectSeedRejected(
        treeWith(
            (tree) =>
                (tree.root.shapes = [{ orig: "a1", dest: "h8", brush: "x".repeat(65) }] as never),
        ),
    );
    expectSeedRejected(treeWith((tree) => (tree.root.annotations = ["invalid"] as never)));
    expectSeedRejected(treeWith((tree) => (tree.root.halfMoves = -1)));
    expectSeedRejected(treeWith((tree) => (tree.root.depth = -1)));
    expectSeedRejected(treeWith((tree) => (tree.headers.id = 0.5)));
    expectSeedRejected(treeWith((tree) => (tree.headers.result = "invalid" as never)));
    expectSeedRejected(treeWith((tree) => (tree.headers.other = { custom: "x".repeat(100_001) })));
    expectSeedRejected(treeWith((tree) => (tree.root.children = null as never)));
    expect(isBoundedTreeForStorage({ root: null })).toBe(false);

    const tooManyChildren = treeWith((tree) => {
        tree.root.children = Array(100_001).fill({ ...tree.root, children: [] });
    });
    expect(isBoundedTreeForStorage(tooManyChildren)).toBe(false);
    const tooManyNodes = treeWith((tree) => {
        tree.root.children = Array(100_000).fill({ ...tree.root, children: [] });
    });
    expect(isBoundedTreeForStorage(tooManyNodes)).toBe(false);
});

test("hydrates legacy uncompressed trees and rewrites the compressed current envelope", () => {
    const tree = defaultTree();
    sessionStorage.setItem("legacy", JSON.stringify(tree));

    expect(storage.read("legacy")?.state).toMatchObject({ root: tree.root, position: [] });
    expect(deserializeStorageValue(sessionStorage.getItem("legacy")!)).toMatchObject({
        version: 1,
        state: { root: tree.root },
    });
});

test("scrubs legacy-only fields and supplies missing versioned tree fields before rewriting", () => {
    const legacy = structuredClone(defaultTree()) as unknown as Record<string, unknown>;
    delete legacy.report;
    delete legacy.dirty;
    delete legacy.position;
    legacy.legacyBoardState = { never: "persist this" };
    legacy.boardStateMap = { legacy: [] };
    sessionStorage.setItem("legacy-scrub", JSON.stringify(legacy));

    expect(storage.read("legacy-scrub")?.state).toMatchObject({
        dirty: false,
        position: [],
        report: { inProgress: false },
    });
    expect(deserializeStorageValue(sessionStorage.getItem("legacy-scrub")!)).not.toHaveProperty(
        "state.legacyBoardState",
    );
    expect(deserializeStorageValue(sessionStorage.getItem("legacy-scrub")!)).not.toHaveProperty(
        "state.boardStateMap",
    );
});

test("fresh migration evaluation supplies defaults for each omitted legacy field", async () => {
    vi.resetModules();
    const { TabStorageRepository: FreshRepository } = await import("./tabStorage");
    const fresh = new FreshRepository();
    const legacy = structuredClone(defaultTree()) as unknown as Record<string, unknown>;
    delete legacy.position;
    delete legacy.dirty;
    delete legacy.report;
    sessionStorage.setItem("fresh-legacy", JSON.stringify(legacy));

    expect(fresh.read("fresh-legacy")?.state).toMatchObject({
        position: [],
        dirty: false,
        report: { inProgress: false },
    });
});

test("tree migration preserves valid values and repairs every invalid legacy field", () => {
    expect(migrateTreeForStorage("not-a-tree")).toBe("not-a-tree");
    expect(
        migrateTreeForStorage({
            position: [0],
            dirty: true,
            report: { inProgress: true },
        }),
    ).toMatchObject({
        position: [0],
        dirty: true,
        report: { inProgress: true, operationId: null },
    });
    expect(
        migrateTreeForStorage({ position: "bad", dirty: 1, report: { inProgress: "bad" } }),
    ).toMatchObject({
        position: [],
        dirty: false,
        sourceStamp: null,
        appendAttempted: false,
        report: { inProgress: false, operationId: null },
    });
});

test("file stamp and append uncertainty survive a storage write and rehydrate", () => {
    const tree = treeWith((state) => {
        state.dirty = true;
        state.sourceStamp = "c".repeat(64);
        state.appendAttempted = true;
        state.headers.event = "Edited but not saved";
    });
    storage.write("stamped-tree", { version: TREE_STORAGE_VERSION, state: tree });
    storage.flush();

    const restored = new TabStorageRepository().read("stamped-tree")?.state;
    expect(restored).toMatchObject({
        dirty: true,
        sourceStamp: "c".repeat(64),
        appendAttempted: true,
        headers: { event: "Edited but not saved" },
    });
});

test("legacy and invalid file metadata fail closed without rejecting the tree", () => {
    const base = structuredClone(defaultTree()) as unknown as Record<string, unknown>;
    base.dirty = true;
    base.headers = { ...(base.headers as object), event: "Keep my edits" };
    delete base.sourceStamp;
    delete base.appendAttempted;
    expect(migrateTreeForStorage(base)).toMatchObject({
        dirty: true,
        sourceStamp: null,
        appendAttempted: false,
        headers: { event: "Keep my edits" },
    });

    const invalid = {
        ...base,
        sourceStamp: 42,
        appendAttempted: "unknown",
    };
    expect(migrateTreeForStorage(invalid)).toMatchObject({
        dirty: true,
        sourceStamp: null,
        appendAttempted: true,
        headers: { event: "Keep my edits" },
    });
    storage.seed("invalid-source-stamp", invalid);
    expect(storage.read("invalid-source-stamp")?.state).toMatchObject({
        dirty: true,
        sourceStamp: null,
        appendAttempted: true,
        headers: { event: "Keep my edits" },
    });
});

test.each([
    ["an array holding a stamp", ["d".repeat(64)]],
    ["a string that is not a stamp", "not-a-stamp"],
    ["a stamp with a leading character", `x${"d".repeat(64)}`],
    ["a stamp with a trailing character", `${"d".repeat(64)}x`],
    ["an upper-case stamp", "D".repeat(64)],
])("a stored source stamp that is %s hydrates as null with the tree kept", (_label, stamp) => {
    const tree = treeWith((state) => {
        state.dirty = true;
        state.headers.event = "Keep my edits";
    }) as unknown as Record<string, unknown>;
    tree.sourceStamp = stamp;
    expect(migrateTreeForStorage(tree)).toMatchObject({ sourceStamp: null, dirty: true });
    sessionStorage.setItem("malformed-stamp", JSON.stringify(tree));
    expect(storage.read("malformed-stamp")?.state).toMatchObject({
        sourceStamp: null,
        dirty: true,
        headers: { event: "Keep my edits" },
    });
});

test("report operationId survives a seed/read round trip", () => {
    const tree = treeWith((state) => {
        state.report = { inProgress: true, operationId: "report_tab_abc" };
    });
    storage.seed("report-id", tree);
    expect(storage.read("report-id")?.state).toMatchObject({
        report: { inProgress: true, operationId: "report_tab_abc" },
    });
});

test("a pre-upgrade report blob without operationId still hydrates", () => {
    const tree = structuredClone(defaultTree()) as unknown as Record<string, unknown>;
    tree.report = { inProgress: false };
    sessionStorage.setItem("pre-upgrade-report", JSON.stringify(tree));

    expect(storage.read("pre-upgrade-report")?.state).toMatchObject({
        report: { inProgress: false, operationId: null },
    });
    expect(sessionStorage.getItem("pre-upgrade-report")).not.toBeNull();
});

test("a wrong-typed report operationId hydrates as null instead of discarding the tab", () => {
    const tree = structuredClone(defaultTree()) as unknown as Record<string, unknown>;
    tree.report = { inProgress: true, operationId: 123 };
    sessionStorage.setItem("wrong-typed-report", JSON.stringify(tree));

    expect(storage.read("wrong-typed-report")?.state).toMatchObject({
        report: { inProgress: true, operationId: null },
        root: defaultTree().root,
    });
    expect(sessionStorage.getItem("wrong-typed-report")).not.toBeNull();
});

test("clone does not copy a live report operationId onto the duplicate tab", () => {
    const tree = treeWith((state) => {
        state.dirty = true;
        state.report = { inProgress: true, operationId: "report_live" };
    });
    storage.write("source-report", { version: 0, state: tree });
    storage.clone("source-report", "copy-report");
    expect(storage.getStatus("copy-report")).toEqual({ kind: "available" });

    expect(storage.read("source-report")?.state).toMatchObject({
        report: { inProgress: true, operationId: "report_live" },
    });
    expect(storage.read("copy-report")?.state).toMatchObject({
        dirty: true,
        report: { inProgress: false, operationId: null },
    });
});

test("cloneDurable copies pending edits immediately without flushing unrelated trees", () => {
    const source = treeWith((state) => {
        state.dirty = true;
        state.report = { inProgress: true, operationId: "live-report" };
    });
    storage.write("source", { version: 0, state: source });
    storage.write("unrelated", { version: 0, state: defaultTree() });

    storage.cloneDurable("source", "target");
    expect(sessionStorage.getItem("target")).not.toBeNull();
    expect(storage.getStatus("target")).toEqual({ kind: "available" });
    expect(sessionStorage.getItem("unrelated")).toBeNull();
    expect(storage.pendingCount()).toBe(2);
    expect(storage.read("target")?.state).toMatchObject({
        dirty: true,
        report: { inProgress: false, operationId: null },
    });
});

test("cloneDurable treats a legitimate tab without tree storage as an empty clone", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    storage.cloneDurable("blank-tab", "blank-copy");
    expect(setItem).not.toHaveBeenCalledWith("blank-copy", expect.any(String));
    expect(sessionStorage.getItem("blank-copy")).toBeNull();
    expect(storage.read("blank-copy")).toBeNull();
    expect(storage.pendingCount()).toBe(0);
    setItem.mockRestore();
});

test("cloneDurable refuses to duplicate an unreadable source as a clean tab", () => {
    const raw = "unreadable source tree";
    sessionStorage.setItem("source", raw);

    expect(() => storage.cloneDurable("source", "target")).toThrow(/unreadable/);

    expect(storage.getStatus("source")).toEqual({ kind: "unreadable", rawValue: raw });
    expect(sessionStorage.getItem("source")).toBe(raw);
    expect(sessionStorage.getItem("target")).toBeNull();
});

test("cloneDurable refuses to duplicate a source whose storage read is unavailable", () => {
    const stored = serializeStorageValue({ version: TREE_STORAGE_VERSION, state: defaultTree() });
    sessionStorage.setItem("source", stored);
    const failure = new DOMException("source read refused", "SecurityError");
    const originalGetItem = Storage.prototype.getItem;
    const getItem = vi
        .spyOn(Storage.prototype, "getItem")
        .mockImplementation(function (this: Storage, key) {
            if (key === "source") throw failure;
            return originalGetItem.call(this, key);
        });

    let cloneError: unknown;
    try {
        storage.cloneDurable("source", "target");
    } catch (error) {
        cloneError = error;
    }

    getItem.mockRestore();
    expect(cloneError).toMatchObject({
        message: "Could not read the source tree for duplication.",
        cause: failure,
    });
    expect(storage.getStatus("source")).toEqual({ kind: "unavailable", error: failure });
    expect(sessionStorage.getItem("source")).toBe(stored);
    expect(sessionStorage.getItem("target")).toBeNull();
});

test("cloneDurable rejects a pending source that fails storage validation", () => {
    storage.write("invalid-pending-source", { version: 0, state: { invalid: true } });

    expect(() => storage.cloneDurable("invalid-pending-source", "target")).toThrow(
        /validate the source tree/,
    );

    expect(sessionStorage.getItem("target")).toBeNull();
    expect(storage.pendingCount()).toBe(1);
});

test("cloning a legacy ID that belongs to another store preserves that store", () => {
    const databaseView = JSON.stringify({
        state: { database: { activeTab: "games" } },
        version: 0,
    });
    sessionStorage.setItem("database-view", databaseView);

    storage.clone("database-view", "ordinary-copy");
    storage.cloneDurable("database-view", "durable-copy");

    expect(sessionStorage.getItem("database-view")).toBe(databaseView);
    expect(sessionStorage.getItem("ordinary-copy")).toBeNull();
    expect(sessionStorage.getItem("durable-copy")).toBeNull();
    expect(storage.pendingCount()).toBe(0);
});

test("reading and writing reserved session keys never admits them as tab trees", () => {
    const reservedValues = new Map([
        [
            "workspace",
            serializeStorageValue({ version: TREE_STORAGE_VERSION, state: defaultTree() }),
        ],
        ["tabs", JSON.stringify([{ value: "other-tab" }])],
        ["activeTab", JSON.stringify("other-tab")],
        ["database-view", JSON.stringify({ activeTab: "games" })],
        ["expanded-directories", JSON.stringify({ expanded: ["/games"] })],
    ]);

    for (const [key, raw] of reservedValues) {
        sessionStorage.setItem(key, raw);
        expect(storage.readTree(key)).toEqual({ kind: "absent" });
        expect(storage.getStatus(key)).toEqual({ kind: "absent" });

        storage.write(key, { version: TREE_STORAGE_VERSION, state: defaultTree() });

        expect(storage.pendingCount()).toBe(0);
        expect(sessionStorage.getItem(key)).toBe(raw);
    }
});

test("clone reports validation and destination failures without replacing either tree", () => {
    storage.write("invalid-clone-source", {
        version: TREE_STORAGE_VERSION,
        state: { invalid: true },
    });

    const invalidCopy = storage.clone("invalid-clone-source", "invalid-clone-target");
    expect(invalidCopy).toMatchObject({
        kind: "copy-failed",
        error: { message: "Could not validate the source tree." },
    });
    expect(storage.pendingCount()).toBe(1);
    expect(sessionStorage.getItem("invalid-clone-target")).toBeNull();

    for (const kind of ["unreadable", "unavailable"] as const) {
        const targetId = `clone-${kind}-target`;
        const targetRaw =
            kind === "unreadable"
                ? "target bytes cannot be decoded"
                : serializeStorageValue({
                      version: TREE_STORAGE_VERSION,
                      state: defaultTree(),
                  });
        const failure = new DOMException("target read refused", "SecurityError");
        storage.seed(`clone-${kind}-source`, defaultTree());
        sessionStorage.setItem(targetId, targetRaw);
        const originalGetItem = Storage.prototype.getItem;
        const getItem =
            kind === "unavailable"
                ? vi
                      .spyOn(Storage.prototype, "getItem")
                      .mockImplementation(function (this: Storage, key) {
                          if (key === targetId) throw failure;
                          return originalGetItem.call(this, key);
                      })
                : null;

        const result = storage.clone(`clone-${kind}-source`, targetId);

        getItem?.mockRestore();
        expect(result.kind).toBe("copy-failed");
        const errorMatches =
            result.kind === "copy-failed" &&
            (kind === "unavailable"
                ? result.error === failure
                : result.error instanceof Error &&
                  result.error.message === "The destination tree key cannot be replaced.");
        expect(errorMatches).toBe(true);
        expect(sessionStorage.getItem(targetId)).toBe(targetRaw);
    }
});

test("legacy tab cloning preserves every reserved non-tree session key", () => {
    const reservedValues = new Map([
        ["workspace", JSON.stringify({ version: 1, tabs: [] })],
        ["tabs", JSON.stringify([{ name: "Other tab" }])],
        ["activeTab", JSON.stringify("other-tab")],
        ["expanded-directories", JSON.stringify({ expanded: ["/games"] })],
    ]);
    for (const [key, value] of reservedValues) {
        sessionStorage.setItem(key, value);
        storage.clone(key, `clone-${key}`);
        expect(sessionStorage.getItem(key)).toBe(value);
        expect(sessionStorage.getItem(`clone-${key}`)).toBeNull();
    }
});

test("cloneDurable propagates a normalized target write failure without changing its source", () => {
    const source = treeWith((state) => {
        state.dirty = true;
        state.headers.event = "Latest pending source";
    });
    storage.write("source", { version: 0, state: source });
    const originalSetItem = Storage.prototype.setItem;
    const setItem = vi
        .spyOn(Storage.prototype, "setItem")
        .mockImplementation(function (this: Storage, key, value) {
            if (key === "target") throw new DOMException("quota", "QuotaExceededError");
            return originalSetItem.call(this, key, value);
        });

    expect(() => storage.cloneDurable("source", "target")).toThrow(
        "Could not open the game: the browser's session storage is full.",
    );
    expect(sessionStorage.getItem("target")).toBeNull();
    expect(storage.read<ReturnType<typeof defaultTree>>("source")?.state).toMatchObject({
        dirty: true,
        headers: { event: "Latest pending source" },
    });
    expect(storage.pendingCount()).toBe(1);
    setItem.mockRestore();
});

test.each(["unreadable", "unavailable"] as const)(
    "cloneDurable preserves an %s target instead of replacing it",
    (kind) => {
        const source = serializeStorageValue({
            version: TREE_STORAGE_VERSION,
            state: defaultTree(),
        });
        const target =
            kind === "unreadable"
                ? "target bytes cannot be decoded"
                : serializeStorageValue({ version: TREE_STORAGE_VERSION, state: defaultTree() });
        sessionStorage.setItem("source", source);
        sessionStorage.setItem("target", target);
        const failure = new DOMException("target read refused", "SecurityError");
        const originalGetItem = Storage.prototype.getItem;
        const getItem =
            kind === "unavailable"
                ? vi
                      .spyOn(Storage.prototype, "getItem")
                      .mockImplementation(function (this: Storage, key) {
                          if (key === "target") throw failure;
                          return originalGetItem.call(this, key);
                      })
                : null;

        let cloneError: unknown;
        try {
            storage.cloneDurable("source", "target");
        } catch (error) {
            cloneError = error;
        }
        expect(cloneError).toMatchObject({
            message: "Cannot replace a tab tree while its storage is unreadable or unavailable.",
            cause: kind === "unavailable" ? failure : { kind: "unreadable", rawValue: target },
        });

        getItem?.mockRestore();
        expect(storage.read("source")?.state).toMatchObject({ root: defaultTree().root });
        expect(sessionStorage.getItem("target")).toBe(target);
    },
);

test.each(["unreadable", "unavailable"] as const)(
    "seed preserves an %s destination instead of replacing it",
    (kind) => {
        const target =
            kind === "unreadable"
                ? "target bytes cannot be decoded"
                : serializeStorageValue({ version: TREE_STORAGE_VERSION, state: defaultTree() });
        sessionStorage.setItem("target", target);
        const failure = new DOMException("target read refused", "SecurityError");
        const originalGetItem = Storage.prototype.getItem;
        const getItem =
            kind === "unavailable"
                ? vi
                      .spyOn(Storage.prototype, "getItem")
                      .mockImplementation(function (this: Storage, key) {
                          if (key === "target") throw failure;
                          return originalGetItem.call(this, key);
                      })
                : null;

        let seedError: unknown;
        try {
            storage.seed("target", defaultTree());
        } catch (error) {
            seedError = error;
        }
        expect(seedError).toMatchObject({
            message: "Cannot replace a tab tree while its storage is unreadable or unavailable.",
            cause: kind === "unavailable" ? failure : { kind: "unreadable", rawValue: target },
        });

        getItem?.mockRestore();
        expect(sessionStorage.getItem("target")).toBe(target);
    },
);

test("clone of a pending write carrying store actions succeeds without inheriting the report lease", () => {
    const tree = treeWith((state) => {
        state.dirty = true;
        state.report = { inProgress: true, operationId: "report_live" };
    });
    storage.write("pending-actions", {
        version: 0,
        state: {
            ...tree,
            setReportOperationId: () => undefined,
            setReportInProgress: () => undefined,
        },
    });

    expect(() => structuredClone(storage.read("pending-actions"))).toThrow(/could not be cloned/);
    expect(() => storage.clone("pending-actions", "copy-pending-actions")).not.toThrow();

    expect(storage.read("pending-actions")?.state).toMatchObject({
        report: { inProgress: true, operationId: "report_live" },
    });
    expect(storage.read("copy-pending-actions")?.state).toMatchObject({
        dirty: true,
        report: { inProgress: false, operationId: null },
    });
    expect(storage.read("copy-pending-actions")?.state).not.toHaveProperty("setReportOperationId");
});

test("preserves undecodable tree bytes and exposes them for recovery", () => {
    sessionStorage.setItem("broken", "not a tree");

    expect(storage.read("broken")).toBeNull();
    expect(sessionStorage.getItem("broken")).toBe("not a tree");
    expect(storage.getStatus("broken")).toEqual({ kind: "unreadable", rawValue: "not a tree" });
    expect(storage.readRawValueForRecovery("broken")).toBe("not a tree");
    expect(decodeLegacyOrCompressed("not a tree")).toBeNull();
});

test("raw recovery requires a value already known to be unreadable", () => {
    expect(() => storage.readRawValueForRecovery("not-read")).toThrow(/no readable undecodable/);
    storage.readTree("absent");
    expect(() => storage.readRawValueForRecovery("absent")).toThrow(/no readable undecodable/);

    const failure = new DOMException("storage refused the read", "SecurityError");
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation((key) => {
        if (key === "unavailable") throw failure;
        return null;
    });
    storage.readTree("unavailable");
    expect(() => storage.readRawValueForRecovery("unavailable")).toThrow(/no readable undecodable/);
    getItem.mockRestore();
});

test("unreadable workspace copies refuse occupied and reserved session keys", () => {
    const raw = "bytes preserved for workspace repair";
    const occupied = "an unrelated value";
    const workspaceMetadata = JSON.stringify({ version: 1, tabs: [] });
    sessionStorage.setItem("occupied-target", occupied);
    sessionStorage.setItem("workspace", workspaceMetadata);

    expect(() => storage.copyUnreadableForWorkspaceRepair("occupied-target", raw)).toThrow(
        /already in use/,
    );
    expect(() => storage.copyUnreadableForWorkspaceRepair("workspace", raw)).toThrow(
        /another session store/,
    );

    expect(sessionStorage.getItem("occupied-target")).toBe(occupied);
    expect(sessionStorage.getItem("workspace")).toBe(workspaceMetadata);
});

test("unreadable workspace copies preserve unavailable destinations", () => {
    const targetId = "unavailable-copy-target";
    const original = serializeStorageValue({
        version: TREE_STORAGE_VERSION,
        state: defaultTree(),
    });
    const failure = new DOMException("target read refused", "SecurityError");
    sessionStorage.setItem(targetId, original);
    const originalGetItem = Storage.prototype.getItem;
    const getItem = vi
        .spyOn(Storage.prototype, "getItem")
        .mockImplementation(function (this: Storage, key) {
            if (key === targetId) throw failure;
            return originalGetItem.call(this, key);
        });
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    expect(() => storage.copyUnreadableForWorkspaceRepair(targetId, "recovery bytes")).toThrow(
        failure,
    );

    getItem.mockRestore();
    setItem.mockRestore();
    expect(storage.getStatus(targetId)).toEqual({ kind: "unavailable", error: failure });
    expect(sessionStorage.getItem(targetId)).toBe(original);
    expect(setItem).not.toHaveBeenCalledWith(targetId, "recovery bytes");
});

test("unreadable workspace copies write and verify exact bytes to an empty key", () => {
    const targetId = "exact-copy-target";
    const raw = "\u0000unreadable bytes, preserved exactly\n";

    storage.copyUnreadableForWorkspaceRepair(targetId, raw);

    expect(sessionStorage.getItem(targetId)).toBe(raw);
    expect(storage.getStatus(targetId)).toEqual({ kind: "unreadable", rawValue: raw });
});

test("orphan cleanup never removes reserved metadata even when it resembles a tree", () => {
    const treeShapedMetadata = serializeStorageValue({
        version: TREE_STORAGE_VERSION,
        state: defaultTree(),
    });
    sessionStorage.setItem("workspace", treeShapedMetadata);

    storage.removeOrphanedTrees(new Set());

    expect(sessionStorage.getItem("workspace")).toBe(treeShapedMetadata);
});

test("unreadable workspace copy preserves replacement bytes when exact-byte readback fails", () => {
    const targetId = "copy-target";
    const raw = "bytes preserved for workspace repair";
    const originalGetItem = Storage.prototype.getItem;
    const originalSetItem = Storage.prototype.setItem;
    let targetWritten = false;
    let replacedTarget = false;
    const setItem = vi
        .spyOn(Storage.prototype, "setItem")
        .mockImplementation(function (this: Storage, key, value) {
            originalSetItem.call(this, key, value);
            if (key === targetId) targetWritten = true;
        });
    const getItem = vi
        .spyOn(Storage.prototype, "getItem")
        .mockImplementation(function (this: Storage, key) {
            if (key === targetId && targetWritten && !replacedTarget) {
                replacedTarget = true;
                originalSetItem.call(this, key, "replacement bytes from another writer");
            }
            return originalGetItem.call(this, key);
        });

    expect(() => storage.copyUnreadableForWorkspaceRepair(targetId, raw)).toThrow(/verify/);

    getItem.mockRestore();
    setItem.mockRestore();
    expect(sessionStorage.getItem(targetId)).toBe("replacement bytes from another writer");
    expect(storage.getStatus(targetId).kind).toBe("unavailable");
});

test("rejects excessive recursive nesting before schema hydration", () => {
    const tree = defaultTree();
    let root = tree.root;
    for (let index = 0; index < 513; index++) root = { ...root, children: [root] };
    tree.root = root;
    sessionStorage.setItem("too-deep", JSON.stringify(tree));

    expect(storage.read("too-deep")).toBeNull();
    expect(sessionStorage.getItem("too-deep")).toBe(JSON.stringify(tree));
    expect(storage.getStatus("too-deep").kind).toBe("unreadable");
});

test("accepts the maximum recursive depth and rejects its first overflow", () => {
    const tree = defaultTree();
    let root = tree.root;
    for (let index = 0; index < 512; index++) root = { ...root, children: [root] };
    tree.root = root;
    storage.seed("depth-boundary", tree);
    expect(storage.read("depth-boundary")).not.toBeNull();
});

test("accepts exactly the maximum tree-node count", () => {
    const tree = defaultTree();
    tree.root.children = Array(99_999).fill({ ...tree.root, children: [] });
    expect(isBoundedTreeForStorage(tree)).toBe(true);
});

test("an immediate clone reads the pending tree and close cancels both pending and persisted data", () => {
    const tree = defaultTree();
    tree.dirty = true;
    storage.write("source", { version: 0, state: tree });
    storage.clone("source", "copy");

    expect(storage.read("copy")?.state).toMatchObject({ dirty: true, root: tree.root });
    storage.remove("source");
    expect(storage.pendingCount()).toBe(1);
    vi.advanceTimersByTime(300);

    expect(sessionStorage.getItem("source")).toBeNull();
    expect(storage.pendingCount()).toBe(0);
    expect(sessionStorage.getItem("copy")).not.toBeNull();
    storage.remove("copy");
    expect(storage.pendingCount()).toBe(0);
    expect(sessionStorage.getItem("copy")).toBeNull();
});

test("storage adapter delegates all operations and seed reports invalid/quota writes", async () => {
    const adapter = storage.storageFor<ReturnType<typeof defaultTree>>();
    const tree = defaultTree();
    adapter.setItem("adapter", { version: 0, state: tree });
    expect((await adapter.getItem("adapter"))?.state).toMatchObject({ root: tree.root });
    adapter.removeItem("adapter");
    expect(storage.read("adapter")).toBeNull();

    expect(() => storage.seed("bad", { nope: true })).toThrow(
        "Cannot persist an invalid game tree.",
    );
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
        throw new DOMException("quota", "QuotaExceededError");
    });
    let quotaError: unknown;
    try {
        storage.seed("quota", defaultTree());
    } catch (error) {
        quotaError = error;
    }
    expect(quotaError).toMatchObject({
        message: expect.stringContaining("session storage is full"),
        cause: expect.any(DOMException),
    });
    setItem.mockRestore();

    const securityError = new DOMException("denied", "SecurityError");
    const securitySetItem = vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
        throw securityError;
    });
    expect(() => storage.seed("security", defaultTree())).toThrow(securityError);
    securitySetItem.mockRestore();
});

test("rewrite and deferred flush retain recoverable state when storage temporarily rejects writes", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    sessionStorage.setItem("rewrite-failure", JSON.stringify(defaultTree()));
    setItem.mockImplementationOnce(() => {
        throw new DOMException("quota", "QuotaExceededError");
    });
    expect(storage.read("rewrite-failure")?.state).toMatchObject({ root: defaultTree().root });
    expect(native.warn).toHaveBeenCalledWith(expect.stringContaining("migrate tree storage"));

    storage.write("flush-failure", { version: 0, state: defaultTree() });
    setItem.mockImplementationOnce(() => {
        throw new DOMException("quota", "QuotaExceededError");
    });
    expect(storage.flush()).toEqual(["flush-failure"]);
    expect(storage.pendingCount()).toBe(1);
    expect(native.warn).toHaveBeenCalledWith(expect.stringContaining("persist tree storage"));
    expect(persistError.reportPersistError).not.toHaveBeenCalled();
    setItem.mockRestore();
    expect(storage.flush()).toEqual([]);
    expect(storage.pendingCount()).toBe(0);
    expect(storage.read("flush-failure")).not.toBeNull();
});

test.each([42, null, undefined])(
    "wraps a non-Error storage failure with its original cause: %s",
    (cause) => {
        const reported = persistStorageWriteError(cause);

        expect(reported.message).toBe(
            "Could not save this game. Session storage rejected the write.",
        );
        expect(reported.cause).toBe(cause);
    },
);

test("recognizes a plain quota-shaped failure and retains its cause", () => {
    const cause = { name: "QuotaExceededError" };

    expect(persistStorageWriteError(cause)).toMatchObject({
        message:
            "Could not open the game: the browser's session storage is full. Close some open tabs and try again.",
        cause,
    });
});

test("returns a non-quota Error as-is", () => {
    const cause = new Error("disk went away");
    expect(persistStorageWriteError(cause)).toBe(cause);
});

test("live debounce reports a non-quota write failure without the session-full message", () => {
    const securityError = new DOMException("denied", "SecurityError");
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
        throw securityError;
    });

    storage.write("security-failure", { version: 0, state: defaultTree() });
    vi.advanceTimersByTime(300);

    const reported = persistError.reportPersistError.mock.calls[0][0] as Error;
    expect(reported.message).not.toContain("session storage is full");
    expect(reported).toBe(securityError);
    setItem.mockRestore();
});

test("live debounce reports quota failure with the seed error and retains pending state", () => {
    const quotaError = new DOMException("quota", "QuotaExceededError");
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
        throw quotaError;
    });

    storage.write("live-failure", { version: 0, state: defaultTree() });
    vi.advanceTimersByTime(300);

    expect(storage.pendingCount()).toBe(1);
    expect(persistError.reportPersistError).toHaveBeenCalledWith(
        expect.objectContaining({
            message:
                "Could not open the game: the browser's session storage is full. Close some open tabs and try again.",
            cause: quotaError,
        }),
    );
    setItem.mockRestore();
});

test("lifecycle flush failures warn and retain pending state without notifying", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new DOMException("quota", "QuotaExceededError");
    });
    storage.write("quit-failure", { version: 0, state: defaultTree() });

    expect(() => window.dispatchEvent(new Event("pagehide"))).not.toThrow();
    expect(() => window.dispatchEvent(new Event("beforeunload"))).not.toThrow();

    expect(storage.pendingCount()).toBe(1);
    expect(native.warn).toHaveBeenCalledWith(expect.stringContaining("persist tree storage"));
    expect(persistError.reportPersistError).not.toHaveBeenCalled();
    setItem.mockRestore();
});

test("notified flush reports the first write failure once when several keys fail", () => {
    storage.write("first", { version: 0, state: defaultTree() });
    storage.write("second", { version: 0, state: defaultTree() });
    const firstError = new DOMException("denied", "SecurityError");
    const secondError = new DOMException("quota", "QuotaExceededError");
    const errors = [firstError, secondError];
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw errors.shift() ?? secondError;
    });

    expect(storage.flush({ notify: true })).toEqual(["first", "second"]);
    expect(persistError.reportPersistError).toHaveBeenCalledOnce();
    expect(persistError.reportPersistError).toHaveBeenCalledWith(firstError);
    setItem.mockRestore();
});

test("flush continues after one failed key and persists the remaining key", () => {
    storage.write("first", { version: 0, state: defaultTree() });
    storage.write("second", { version: 0, state: defaultTree() });
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
        throw new DOMException("quota", "QuotaExceededError");
    });

    expect(storage.flush()).toEqual(["first"]);

    expect(storage.pendingCount()).toBe(1);
    expect(storage.read("first")).not.toBeNull();
    expect(sessionStorage.getItem("first")).toBeNull();
    expect(sessionStorage.getItem("second")).not.toBeNull();
    setItem.mockRestore();
});

test("scheduled lifecycle events flush once and a missing clone source stays absent", () => {
    storage.clone("missing", "target");
    expect(storage.read("target")).toBeNull();
    storage.write("event-flush", { version: 0, state: defaultTree() });
    window.dispatchEvent(new Event("pagehide"));
    expect(storage.pendingCount()).toBe(0);
    expect(storage.read("event-flush")).not.toBeNull();
    window.dispatchEvent(new Event("beforeunload"));
});

test("debounce scheduling replaces exactly one timer and installs one pair of lifecycle handlers", () => {
    const clearTimeout = vi.spyOn(globalThis, "clearTimeout");
    const addEventListener = vi.spyOn(window, "addEventListener");

    storage.write("first", { version: 0, state: defaultTree() });
    storage.write("second", { version: 0, state: defaultTree() });

    expect(clearTimeout).toHaveBeenCalledTimes(1);
    expect(addEventListener).toHaveBeenCalledTimes(2);
    expect(addEventListener).toHaveBeenNthCalledWith(1, "beforeunload", expect.any(Function));
    expect(addEventListener).toHaveBeenNthCalledWith(2, "pagehide", expect.any(Function));

    storage.flush();
    expect(clearTimeout).toHaveBeenCalledTimes(2);
    clearTimeout.mockRestore();
    addEventListener.mockRestore();
});

test("flush does not clear a timer when none is pending", () => {
    const clearTimeout = vi.spyOn(globalThis, "clearTimeout");
    storage.flush();
    expect(clearTimeout).not.toHaveBeenCalled();
    clearTimeout.mockRestore();
});

test("current envelopes do not rewrite, while empty raw keys stay untouched", () => {
    storage.seed("current", defaultTree());
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    expect(storage.read("current")).not.toBeNull();
    expect(setItem).not.toHaveBeenCalled();
    sessionStorage.setItem("empty", "");
    expect(storage.read("empty")).toBeNull();
    expect(storage.getStatus("empty")).toEqual({ kind: "unreadable", rawValue: "" });
    expect(storage.readRawValueForRecovery("empty")).toBe("");
    expect(sessionStorage.getItem("empty")).toBe("");
    setItem.mockRestore();
});

test("read refusal stays unavailable and a successful retry can load the exact key", () => {
    const id = "temporarily-unavailable";
    const stored = serializeStorageValue({
        version: TREE_STORAGE_VERSION,
        state: treeWith((tree) => {
            tree.headers.event = "Recovered after retry";
        }),
    });
    sessionStorage.setItem(id, stored);
    const failure = new DOMException("storage refused the read", "SecurityError");
    const originalGetItem = Storage.prototype.getItem;
    const getItem = vi
        .spyOn(Storage.prototype, "getItem")
        .mockImplementation(function (this: Storage, key) {
            if (key === id) throw failure;
            return originalGetItem.call(this, key);
        });

    expect(storage.read(id)).toBeNull();
    expect(storage.getStatus(id)).toEqual({ kind: "unavailable", error: failure });
    storage.write(id, { version: TREE_STORAGE_VERSION, state: defaultTree() });
    storage.flush();
    expect(storage.pendingCount()).toBe(0);

    getItem.mockRestore();
    expect(storage.readTree(id)).toMatchObject({
        kind: "available",
        value: { state: { headers: { event: "Recovered after retry" } } },
    });
    expect(storage.getStatus(id)).toEqual({ kind: "available" });
    expect(storage.read(id)?.state).toMatchObject({
        headers: { event: "Recovered after retry" },
    });
});

test("a failed retry remains unavailable and does not authorize a default write", () => {
    const id = "retry-still-refused";
    const failure = new DOMException("storage refused the read", "SecurityError");
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation((key) => {
        if (key === id) throw failure;
        return null;
    });

    expect(storage.read(id)).toBeNull();
    expect(storage.readTree(id)).toEqual({ kind: "unavailable", error: failure });
    storage.write(id, { version: TREE_STORAGE_VERSION, state: defaultTree() });
    storage.flush();

    expect(storage.getStatus(id)).toEqual({ kind: "unavailable", error: failure });
    expect(storage.pendingCount()).toBe(0);
    expect(getItem).toHaveBeenCalledWith(id);
    getItem.mockRestore();
});

test("status subscriptions notify only on state changes and clean up safely", () => {
    const id = "status-subscriptions";
    const first = vi.fn();
    const second = vi.fn();
    const stopFirst = storage.subscribeStatus(id, first);
    const stopSecond = storage.subscribeStatus(id, second);
    const internals = storage as unknown as {
        readStatuses: Map<string, unknown>;
        statusListeners: Map<string, Set<() => void>>;
    };

    expect(storage.getStatus(id)).toEqual({ kind: "not-read" });
    expect(storage.readTree(id)).toEqual({ kind: "absent" });
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    storage.readTree(id);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);

    storage.seed(id, defaultTree());
    expect(storage.getStatus(id)).toEqual({ kind: "available" });
    storage.readTree(id);
    expect(first).toHaveBeenCalledTimes(2);
    expect(second).toHaveBeenCalledTimes(2);

    sessionStorage.setItem(id, "unreadable A");
    storage.readTree(id);
    storage.readTree(id);
    expect(storage.getStatus(id)).toEqual({ kind: "unreadable", rawValue: "unreadable A" });
    expect(first).toHaveBeenCalledTimes(3);
    expect(second).toHaveBeenCalledTimes(3);
    sessionStorage.setItem(id, "unreadable B");
    storage.readTree(id);
    expect(first).toHaveBeenCalledTimes(4);
    expect(second).toHaveBeenCalledTimes(4);

    const firstFailure = new DOMException("read refused", "SecurityError");
    const secondFailure = new DOMException("read refused", "SecurityError");
    let readFailure = firstFailure;
    const originalGetItem = Storage.prototype.getItem;
    const getItem = vi
        .spyOn(Storage.prototype, "getItem")
        .mockImplementation(function (this: Storage, key) {
            if (key === id) throw readFailure;
            return originalGetItem.call(this, key);
        });
    storage.readTree(id);
    storage.readTree(id);
    expect(storage.getStatus(id)).toEqual({ kind: "unavailable", error: firstFailure });
    expect(first).toHaveBeenCalledTimes(5);
    expect(second).toHaveBeenCalledTimes(5);
    readFailure = secondFailure;
    storage.readTree(id);
    expect(storage.getStatus(id)).toEqual({ kind: "unavailable", error: secondFailure });
    expect(first).toHaveBeenCalledTimes(6);
    expect(second).toHaveBeenCalledTimes(6);
    getItem.mockRestore();

    sessionStorage.setItem(
        id,
        serializeStorageValue({ version: TREE_STORAGE_VERSION, state: defaultTree() }),
    );
    storage.readTree(id);
    expect(storage.getStatus(id)).toEqual({ kind: "available" });
    expect(first).toHaveBeenCalledTimes(7);
    expect(second).toHaveBeenCalledTimes(7);

    stopFirst();
    sessionStorage.setItem(id, "unreadable C");
    storage.readTree(id);
    expect(first).toHaveBeenCalledTimes(7);
    expect(second).toHaveBeenCalledTimes(8);
    stopSecond();
    expect(internals.statusListeners.has(id)).toBe(false);

    // An old unsubscribe must not remove a later listener set for the same tab.
    stopFirst();
    const later = vi.fn();
    const stopLater = storage.subscribeStatus(id, later);
    stopFirst();
    expect(internals.statusListeners.has(id)).toBe(true);
    sessionStorage.setItem(id, "unreadable D");
    storage.readTree(id);
    expect(later).toHaveBeenCalledOnce();

    storage.remove(id);
    expect(storage.getStatus(id)).toEqual({ kind: "not-read" });
    expect(internals.readStatuses.has(id)).toBe(false);
    stopLater();
    expect(internals.statusListeners.has(id)).toBe(false);
});

test("a first write is blocked by undecodable bytes already at its destination", () => {
    const id = "write-over-unreadable";
    const raw = "preserve before explicit recovery";
    sessionStorage.setItem(id, raw);

    storage.write(id, { version: TREE_STORAGE_VERSION, state: defaultTree() });

    expect(storage.getStatus(id)).toEqual({ kind: "unreadable", rawValue: raw });
    expect(storage.pendingCount()).toBe(0);
    expect(sessionStorage.getItem(id)).toBe(raw);
});

test("a write to a known available tree does not probe storage again", () => {
    const id = "write-known-available";
    storage.seed(id, defaultTree());
    const getItem = vi.spyOn(Storage.prototype, "getItem");

    storage.write(id, { version: TREE_STORAGE_VERSION, state: defaultTree() });

    expect(getItem).not.toHaveBeenCalled();
    expect(storage.pendingCount()).toBe(1);
    getItem.mockRestore();
});

test("pending edits remain authoritative without consulting refused storage", () => {
    const tree = treeWith((state) => {
        state.dirty = true;
        state.headers.event = "Latest pending edit";
    });
    storage.write("pending-authoritative", {
        version: TREE_STORAGE_VERSION,
        state: tree,
    });
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new DOMException("storage refused the read", "SecurityError");
    });

    expect(storage.read("pending-authoritative")?.state).toMatchObject({
        dirty: true,
        headers: { event: "Latest pending edit" },
    });
    expect(getItem).not.toHaveBeenCalled();
    expect(storage.getStatus("pending-authoritative")).toEqual({ kind: "available" });
    getItem.mockRestore();
});

test("failed discard retains the unreadable gate and reports its storage error", () => {
    sessionStorage.setItem("discard-refused", "corrupt bytes");
    storage.read("discard-refused");
    const failure = new DOMException("storage refused removal", "SecurityError");
    const removeItem = vi
        .spyOn(Storage.prototype, "removeItem")
        .mockImplementation(function (this: Storage, key) {
            if (key === "discard-refused") throw failure;
            return Storage.prototype.removeItem.call(this, key);
        });

    expect(() => storage.discardUnreadable("discard-refused")).toThrow(failure);
    expect(storage.getStatus("discard-refused")).toEqual({
        kind: "unreadable",
        rawValue: "corrupt bytes",
    });
    expect(sessionStorage.getItem("discard-refused")).toBe("corrupt bytes");
    expect(persistError.reportPersistError).toHaveBeenCalledWith(failure);
    removeItem.mockRestore();
});

test("successful discard clears only a readable unreadable gate", () => {
    sessionStorage.setItem("discard-success", "corrupt bytes");
    storage.read("discard-success");

    expect(storage.discardUnreadable("discard-success")).toBe(true);
    expect(sessionStorage.getItem("discard-success")).toBeNull();
    expect(storage.getStatus("discard-success")).toEqual({ kind: "absent" });
    expect(storage.discardUnreadable("discard-success")).toBe(false);
});

test("a discard that silently retains bytes keeps the unreadable write gate", () => {
    const id = "discard-silent-refusal";
    const raw = "keep these corrupt bytes";
    sessionStorage.setItem(id, raw);
    storage.readTree(id);
    const removeItem = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {});

    expect(() => storage.discardUnreadable(id)).toThrow(
        "Session storage retained the unreadable tree after removal.",
    );
    expect(storage.getStatus(id)).toEqual({ kind: "unreadable", rawValue: raw });
    expect(sessionStorage.getItem(id)).toBe(raw);
    expect(storage.pendingCount()).toBe(0);
    expect(persistError.reportPersistError).toHaveBeenCalledOnce();
    removeItem.mockRestore();
});

test.each([
    { position: [0, 0, 5], expected: [0, 0] },
    { position: [2], expected: [] },
])("read clamps unresolved position $position to its valid prefix", ({ position, expected }) => {
    persistTree("stale-position", treeWithPaths({ position }));

    expect(storage.read("stale-position")?.state).toMatchObject({ position: expected });
});

test("read removes an unresolved start header and retains a valid nested start", () => {
    persistTree("stale-start", treeWithPaths({ start: [0, 5] }));
    expect(storage.read("stale-start")?.state).not.toHaveProperty("headers.start");

    persistTree("valid-start", treeWithPaths({ start: [0, 0] }));
    expect(storage.read("valid-start")?.state).toMatchObject({ headers: { start: [0, 0] } });
});

test("read clamps practice paths and preserves null or absent practice state", () => {
    persistTree("stale-practice", treeWithPaths({ practicePath: [1, 3] }));
    expect(storage.read("stale-practice")?.state).toMatchObject({ practicePath: [1] });

    persistTree("null-practice", treeWithPaths({ practicePath: null }));
    expect(storage.read("null-practice")?.state).toMatchObject({ practicePath: null });

    persistTree("absent-practice", treeWithPaths({}));
    expect(storage.read("absent-practice")?.state).not.toHaveProperty("practicePath");
});

test("a healthy tree with three valid paths is unchanged and is not rewritten", () => {
    const tree = treeWithPaths({
        position: [0, 0],
        start: [0, 0],
        practicePath: [1],
    });
    storage.seed("healthy-paths", tree);
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    try {
        expect(storage.read("healthy-paths")?.state).toEqual(tree);
        expect(setItem).not.toHaveBeenCalled();
    } finally {
        setItem.mockRestore();
    }
});

test("read persists repaired paths back into the stored envelope", () => {
    persistTree(
        "repair-writeback",
        treeWithPaths({ position: [0, 0, 5], start: [0, 5], practicePath: [1, 3] }),
    );

    storage.read("repair-writeback");

    const raw = sessionStorage.getItem("repair-writeback");
    expect(raw).not.toBeNull();
    expect(deserializeStorageValue(raw!)).toMatchObject({
        state: { position: [0, 0], practicePath: [1] },
    });
    expect(deserializeStorageValue(raw!)).not.toHaveProperty("state.headers.start");
});

test("seed and both clone routes store repaired start headers", () => {
    const stale = treeWithPaths({ start: [0, 5] });

    // seed and cloneDurable write sessionStorage directly; the raw value is asserted because read
    // would repair a stale path on its own and hide a writer that stored it.
    storage.seed("seed-repair", stale);
    expect(deserializeStorageValue(sessionStorage.getItem("seed-repair")!)).not.toHaveProperty(
        "state.headers.start",
    );

    persistTree("clone-source-repair", stale);
    storage.clone("clone-source-repair", "clone-target-repair");
    expect(storage.read("clone-target-repair")?.state).not.toHaveProperty("headers.start");

    persistTree("durable-source-repair", stale);
    storage.cloneDurable("durable-source-repair", "durable-target-repair");
    expect(
        deserializeStorageValue(sessionStorage.getItem("durable-target-repair")!),
    ).not.toHaveProperty("state.headers.start");
});

test("failed-admission replay ignores malformed markers without touching their trees or unrelated keys", () => {
    const invalidId = "not-a-uuid";
    const invalidValueId = crypto.randomUUID();
    const validId = crypto.randomUUID();
    for (const id of [invalidId, invalidValueId, validId]) persistTree(id, defaultTree());
    const marker = (id: string) => `chessfable:failed-tab-admission:${id}`;
    sessionStorage.setItem(marker(invalidId), "1");
    sessionStorage.setItem(marker(invalidValueId), "unexpected");
    sessionStorage.setItem(marker(validId), "1");
    sessionStorage.setItem("Stryker was here", "keep");
    sessionStorage.setItem("undefined", "keep");

    const replay = storage.replayFailedAdmissions(new Set());

    expect(replay.markedIds).toEqual(new Set([validId]));
    expect(replay.failedIds.size).toBe(0);
    expect(sessionStorage.getItem(invalidId)).not.toBeNull();
    expect(sessionStorage.getItem(invalidValueId)).not.toBeNull();
    expect(sessionStorage.getItem(validId)).toBeNull();
    for (const id of [invalidId, invalidValueId, validId]) {
        expect(sessionStorage.getItem(marker(id))).toBeNull();
    }
    expect(sessionStorage.getItem("Stryker was here")).toBe("keep");
    expect(sessionStorage.getItem("undefined")).toBe("keep");
});

test("failed-admission replay skips a null storage-key slot and processes later markers", () => {
    const id = crypto.randomUUID();
    const marker = `chessfable:failed-tab-admission:${id}`;
    sessionStorage.setItem("unrelated", "keep");
    persistTree(id, defaultTree());
    sessionStorage.setItem(marker, "1");
    const originalKey = Storage.prototype.key;
    const key = vi
        .spyOn(Storage.prototype, "key")
        .mockImplementation(function (this: Storage, index) {
            if (index === 0) return null;
            return originalKey.call(this, index);
        });

    const replay = storage.replayFailedAdmissions(new Set());

    key.mockRestore();
    expect(replay.markedIds).toEqual(new Set([id]));
    expect(sessionStorage.getItem(id)).toBeNull();
    expect(sessionStorage.getItem(marker)).toBeNull();
    expect(sessionStorage.getItem("unrelated")).toBe("keep");
    expect(persistError.reportPersistError).not.toHaveBeenCalled();
});

test("failed-admission replay reports a storage-key enumeration failure", () => {
    const failure = new DOMException("key enumeration denied", "SecurityError");
    sessionStorage.setItem("unrelated", "keep");
    const key = vi.spyOn(Storage.prototype, "key").mockImplementation(() => {
        throw failure;
    });

    expect(storage.replayFailedAdmissions(new Set())).toEqual({
        markedIds: new Set(),
        failedIds: new Set(),
    });

    key.mockRestore();
    expect(persistError.reportPersistError).toHaveBeenCalledOnce();
    expect(persistError.reportPersistError).toHaveBeenCalledWith(failure);
});

test("failed-admission replay keeps a marker if its tree cannot be read and continues", () => {
    const unreadableId = crypto.randomUUID();
    const removableId = crypto.randomUUID();
    const marker = (id: string) => `chessfable:failed-tab-admission:${id}`;
    for (const id of [unreadableId, removableId]) {
        persistTree(id, defaultTree());
        sessionStorage.setItem(marker(id), "1");
    }
    const failure = new DOMException("tree read denied", "SecurityError");
    const originalGetItem = Storage.prototype.getItem;
    const getItem = vi
        .spyOn(Storage.prototype, "getItem")
        .mockImplementation(function (this: Storage, key) {
            if (key === unreadableId) throw failure;
            return originalGetItem.call(this, key);
        });

    const replay = storage.replayFailedAdmissions(new Set());

    getItem.mockRestore();
    expect(replay.markedIds).toEqual(new Set([unreadableId, removableId]));
    expect(replay.failedIds).toEqual(new Set([unreadableId]));
    expect(sessionStorage.getItem(unreadableId)).not.toBeNull();
    expect(sessionStorage.getItem(marker(unreadableId))).toBe("1");
    expect(sessionStorage.getItem(removableId)).toBeNull();
    expect(sessionStorage.getItem(marker(removableId))).toBeNull();
    expect(persistError.reportPersistError).toHaveBeenCalledWith(failure);
});

test("failed-admission replay reports the first marker cleanup error and preserves both markers", () => {
    const ids = [crypto.randomUUID(), crypto.randomUUID()];
    const markers = ids.map((id) => `chessfable:failed-tab-admission:${id}`);
    for (const key of markers) sessionStorage.setItem(key, "1");
    const firstError = new DOMException("first marker denied", "SecurityError");
    const secondError = new DOMException("second marker denied", "SecurityError");
    const originalRemoveItem = Storage.prototype.removeItem;
    const removeItem = vi
        .spyOn(Storage.prototype, "removeItem")
        .mockImplementation(function (this: Storage, key) {
            if (key === markers[0]) throw firstError;
            if (key === markers[1]) throw secondError;
            return originalRemoveItem.call(this, key);
        });

    storage.replayFailedAdmissions(new Set());

    removeItem.mockRestore();
    expect(sessionStorage.getItem(markers[0]!)).toBe("1");
    expect(sessionStorage.getItem(markers[1]!)).toBe("1");
    expect(persistError.reportPersistError).toHaveBeenCalledOnce();
    expect(persistError.reportPersistError).toHaveBeenCalledWith(firstError);
});

test("known-tree batch removal reports its first failure and survives a throwing iterator", () => {
    const ids = [crypto.randomUUID(), crypto.randomUUID()];
    for (const id of ids) persistTree(id, defaultTree());
    const firstError = new DOMException("first removal denied", "SecurityError");
    const secondError = new DOMException("second removal denied", "SecurityError");
    const originalRemoveItem = Storage.prototype.removeItem;
    const removeItem = vi
        .spyOn(Storage.prototype, "removeItem")
        .mockImplementation(function (this: Storage, key) {
            if (key === ids[0]) throw firstError;
            if (key === ids[1]) throw secondError;
            return originalRemoveItem.call(this, key);
        });

    expect(storage.removeKnownTreesSafely(ids)).toEqual(new Set(ids));
    expect(persistError.reportPersistError).toHaveBeenCalledOnce();
    expect(persistError.reportPersistError).toHaveBeenCalledWith(firstError);
    removeItem.mockRestore();
    persistError.reportPersistError.mockClear();
    const iteratorFailure = new Error("enumeration failed");
    function* brokenIds() {
        yield ids[0]!;
        throw iteratorFailure;
    }
    expect(storage.removeKnownTreesSafely(brokenIds())).toEqual(new Set());
    expect(sessionStorage.getItem(ids[0]!)).toBeNull();
    expect(persistError.reportPersistError).toHaveBeenCalledWith(iteratorFailure);
});

test("tree-key snapshot accepts the exact length bound and supports omitted exclusions", () => {
    const boundaryKey = "a".repeat(128);
    const oversizedKey = "b".repeat(129);
    persistTree(boundaryKey, defaultTree());
    expect(storage.snapshotStoredTreeKeys(1, 128)).toEqual([boundaryKey]);
    expect(storage.snapshotStoredTreeKeys(1, 128, new Set([boundaryKey]))).toEqual([]);
    persistTree(oversizedKey, defaultTree());
    expect(storage.snapshotStoredTreeKeys(2, 128)).toBeNull();
});
