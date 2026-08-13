import { warn } from "@/platform/native";
import { z } from "zod";
import type { PersistStorage, StorageValue } from "zustand/middleware";
import { deserializeStorageValue, serializeStorageValue } from "./debouncedStorage";

const TREE_STORAGE_VERSION = 1;
const DEBOUNCE_MS = 300;
const MAX_TREE_NODES = 100_000;
const MAX_TREE_DEPTH = 512;
const boundedText = z.string().max(100_000);
const pathSchema = z.array(z.number().int().nonnegative()).max(MAX_TREE_DEPTH);
const annotationSchema = z.enum([
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
]);
const scoreSchema = z.object({
    value: z.discriminatedUnion("type", [
        z.object({ type: z.literal("cp"), value: z.number().finite() }),
        z.object({ type: z.literal("mate"), value: z.number().int() }),
    ]),
    wdl: z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]).nullable(),
});
const roleSchema = z.enum(["pawn", "knight", "bishop", "rook", "queen", "king"]);
const boardSquareSchema = z
    .number()
    .int()
    .refine((square) => square >= 0 && square <= 63);
const moveSchema = z.union([
    z.object({
        from: boardSquareSchema,
        to: boardSquareSchema,
        promotion: roleSchema.optional(),
    }),
    z.object({ role: roleSchema, to: boardSquareSchema }),
]);
const shapeSchema = z.object({
    orig: z.string().regex(/^[a-h][1-8]$/),
    dest: z.string().regex(/^[a-h][1-8]$/),
    brush: z.string().max(64),
    modifiers: z
        .object({
            lineWidth: z.number().finite().optional(),
            opacity: z.number().finite().optional(),
        })
        .optional(),
});
const headersSchema = z.object({
    id: z.number().int(),
    fen: boundedText,
    event: boundedText,
    site: boundedText,
    date: boundedText.nullable().optional(),
    time: boundedText.nullable().optional(),
    round: boundedText.nullable().optional(),
    white: boundedText,
    white_elo: z.number().int().nullable().optional(),
    black: boundedText,
    black_elo: z.number().int().nullable().optional(),
    result: z.enum(["1-0", "0-1", "1/2-1/2", "*"]),
    time_control: boundedText.nullable().optional(),
    white_time_control: boundedText.nullable().optional(),
    black_time_control: boundedText.nullable().optional(),
    eco: boundedText.nullable().optional(),
    variant: boundedText.nullable().optional(),
    other: z.record(boundedText).optional(),
    start: pathSchema.optional(),
    orientation: z
        .string()
        .refine((orientation) => orientation === "white" || orientation === "black")
        .optional(),
});

type PersistedTreeNode = {
    fen: string;
    move:
        | { from: number; to: number; promotion?: z.infer<typeof roleSchema> }
        | { role: z.infer<typeof roleSchema>; to: number }
        | null;
    san: string | null;
    children: PersistedTreeNode[];
    score: {
        value: { type: "cp"; value: number } | { type: "mate"; value: number };
        wdl: [number, number, number] | null;
    } | null;
    depth: number | null;
    halfMoves: number;
    shapes: Array<{
        orig: string;
        dest: string;
        brush: string;
        modifiers?: { lineWidth?: number; opacity?: number };
    }>;
    annotations: z.infer<typeof annotationSchema>[];
    comment: string;
    clock?: number;
};

const treeNodeSchema: z.ZodType<PersistedTreeNode> = z.lazy(() =>
    z.object({
        fen: boundedText,
        move: moveSchema.nullable(),
        san: boundedText.nullable(),
        children: z.array(treeNodeSchema).max(MAX_TREE_NODES),
        score: scoreSchema.nullable(),
        depth: z.number().int().nonnegative().nullable(),
        halfMoves: z.number().int().nonnegative(),
        shapes: z.array(shapeSchema).max(10_000),
        annotations: z.array(annotationSchema).max(1_024),
        comment: boundedText,
        clock: z.number().finite().optional(),
    }),
);

const persistedTreeSchema = z.object({
    root: treeNodeSchema,
    headers: headersSchema,
    position: pathSchema,
    dirty: z.boolean(),
    report: z.object({ inProgress: z.boolean() }),
    practicePath: pathSchema.nullable().optional(),
});

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Fast preflight for untrusted storage before recursive Zod parsing. */
export function isBoundedTreeForStorage(value: unknown): boolean {
    let nodes = 0;
    const visit = (node: unknown, depth: number): boolean => {
        if (!isRecord(node) || depth > MAX_TREE_DEPTH || ++nodes > MAX_TREE_NODES) return false;
        // Zod owns structural validation. This preflight only bounds recursive work.
        if (Array.isArray(node.children)) {
            for (const child of node.children) {
                if (!visit(child, depth + 1)) return false;
            }
        }
        return true;
    };
    return isRecord(value) && visit(value.root, 0);
}

/** Adds fields that were absent before TreeState persistence was versioned. */
export function migrateTreeForStorage(value: unknown): unknown {
    if (!isRecord(value)) return value;
    return {
        ...value,
        position: Array.isArray(value.position) ? value.position : [],
        dirty: typeof value.dirty === "boolean" ? value.dirty : false,
        report:
            isRecord(value.report) && typeof value.report.inProgress === "boolean"
                ? value.report
                : { inProgress: false },
    };
}

function parseTree(value: unknown): StoredTree | null {
    const candidate = migrateTreeForStorage(value);
    if (!isBoundedTreeForStorage(candidate)) return null;
    const parsed = persistedTreeSchema.safeParse(candidate);
    return parsed.success ? { version: TREE_STORAGE_VERSION, state: parsed.data } : null;
}

type StoredTree = StorageValue<unknown>;

export function parseLegacyTreeJson(value: string): unknown | null {
    try {
        return JSON.parse(value) as unknown;
    } catch {
        return null;
    }
}

export function decodeLegacyOrCompressed(value: string): StoredTree | null {
    const compressed = deserializeStorageValue<unknown>(value);
    const decoded = compressed ?? parseLegacyTreeJson(value);
    const envelope = z
        .object({ version: z.number().int().nonnegative(), state: z.unknown() })
        .safeParse(decoded);
    if (envelope.success) return parseTree(envelope.data.state);

    // The earliest sessions stored TreeState itself as plain JSON, without the
    // zustand envelope or compression. Keep that recovery path deliberately
    // narrow so corrupt blobs are discarded rather than trusted.
    return parseTree(decoded);
}

/**
 * The sole owner of tab-tree storage. In particular, callers never read
 * sessionStorage directly: a clone or close observes not-yet-flushed edits.
 */
export class TabStorageRepository {
    private readonly pending = new Map<string, StoredTree>();
    private flushTimeout: ReturnType<typeof setTimeout> | null = null;
    private handlersBound = false;

    storageFor<S>(): PersistStorage<S> {
        return {
            getItem: (name) => this.read<S>(name),
            setItem: (name, value) => this.write(name, value),
            removeItem: (name) => this.remove(name),
        };
    }

    read<S>(tabId: string): StorageValue<S> | null {
        const pending = this.pending.get(tabId);
        if (pending) return pending as StorageValue<S>;
        const raw = sessionStorage.getItem(tabId);
        if (!raw) return null;

        const decoded = decodeLegacyOrCompressed(raw);
        if (!decoded) {
            sessionStorage.removeItem(tabId);
            return null;
        }

        // Both an old uncompressed JSON payload and a former v0 envelope are
        // rewritten immediately, before the next debounced store update.
        if (raw !== serializeStorageValue(decoded)) {
            try {
                sessionStorage.setItem(tabId, serializeStorageValue(decoded));
            } catch (error) {
                void warn(`Could not migrate tree storage ${tabId}: ${String(error)}`);
            }
        }
        return decoded as StorageValue<S>;
    }

    write<S>(tabId: string, value: StorageValue<S>) {
        this.pending.set(tabId, { version: TREE_STORAGE_VERSION, state: value.state });
        this.scheduleFlush();
    }

    seed(tabId: string, state: unknown) {
        const value = parseTree(state);
        if (!value) throw new Error("Cannot persist an invalid game tree.");
        try {
            sessionStorage.setItem(tabId, serializeStorageValue(value));
        } catch (error) {
            throw new Error(
                "Could not open the game: the browser's session storage is full. Close some open tabs and try again.",
                { cause: error },
            );
        }
    }

    clone(sourceTabId: string, targetTabId: string) {
        const source = this.read(sourceTabId);
        if (!source) return;
        this.write(targetTabId, structuredClone(source));
    }

    remove(tabId: string) {
        this.pending.delete(tabId);
        sessionStorage.removeItem(tabId);
    }

    flush() {
        if (this.flushTimeout) {
            clearTimeout(this.flushTimeout);
            this.flushTimeout = null;
        }
        for (const [tabId, value] of this.pending) {
            try {
                sessionStorage.setItem(tabId, serializeStorageValue(value));
                this.pending.delete(tabId);
            } catch (error) {
                void warn(`Could not persist tree storage ${tabId}: ${String(error)}`);
            }
        }
    }

    pendingCount() {
        return this.pending.size;
    }

    private scheduleFlush() {
        this.bindFlushHandlers();
        if (this.flushTimeout) clearTimeout(this.flushTimeout);
        this.flushTimeout = setTimeout(() => {
            this.flushTimeout = null;
            this.flush();
        }, DEBOUNCE_MS);
    }

    private bindFlushHandlers() {
        const addEventListener = globalThis.addEventListener;
        if (this.handlersBound || !addEventListener) return;
        const flush = () => this.flush();
        addEventListener.call(globalThis, "beforeunload", flush);
        addEventListener.call(globalThis, "pagehide", flush);
        this.handlersBound = true;
    }
}

export const tabStorage = new TabStorageRepository();
