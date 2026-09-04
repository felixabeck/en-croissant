import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { defaultTree } from "@/utils/treeReducer";
import { deserializeStorageValue } from "./debouncedStorage";
import {
    decodeLegacyOrCompressed,
    isBoundedTreeForStorage,
    migrateTreeForStorage,
    parseLegacyTreeJson,
    persistStorageWriteError,
    TabStorageRepository,
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
    sessionStorage.setItem("legacy-scrub", JSON.stringify(legacy));

    expect(storage.read("legacy-scrub")?.state).toMatchObject({
        dirty: false,
        position: [],
        report: { inProgress: false },
    });
    expect(deserializeStorageValue(sessionStorage.getItem("legacy-scrub")!)).not.toHaveProperty(
        "state.legacyBoardState",
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
        report: { inProgress: false, operationId: null },
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

    expect(storage.read("source-report")?.state).toMatchObject({
        report: { inProgress: true, operationId: "report_live" },
    });
    expect(storage.read("copy-report")?.state).toMatchObject({
        dirty: true,
        report: { inProgress: false, operationId: null },
    });
});

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

test("drops corrupt trees rather than letting hydration crash", () => {
    sessionStorage.setItem("broken", "not a tree");

    expect(storage.read("broken")).toBeNull();
    expect(sessionStorage.getItem("broken")).toBeNull();
    expect(decodeLegacyOrCompressed("not a tree")).toBeNull();
    expect(parseLegacyTreeJson("not a tree")).toBeNull();
});

test("rejects excessive recursive nesting before schema hydration", () => {
    const tree = defaultTree();
    let root = tree.root;
    for (let index = 0; index < 513; index++) root = { ...root, children: [root] };
    tree.root = root;
    sessionStorage.setItem("too-deep", JSON.stringify(tree));

    expect(storage.read("too-deep")).toBeNull();
    expect(sessionStorage.getItem("too-deep")).toBeNull();
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
    expect(sessionStorage.getItem("empty")).toBe("");
    setItem.mockRestore();
});
