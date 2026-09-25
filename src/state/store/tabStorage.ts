import { warn } from "@/platform/native";
import { reportPersistError } from "@/state/persistError";
import { getResolvedPathLength } from "@/utils/treeReducer";
import { z } from "zod";
import type { PersistStorage, StorageValue } from "zustand/middleware";
import { decodeCompressedOrJson, serializeStorageValue } from "./debouncedStorage";

export const TREE_STORAGE_VERSION = 1;
const DEBOUNCE_MS = 300;
const FAILED_ADMISSION_PREFIX = "chessfable:failed-tab-admission:";
const FAILED_ADMISSION_VALUE = "1";
// Legacy tabs could use arbitrary IDs, including keys now owned by other stores.
const NON_TREE_SESSION_KEYS = new Set([
    "workspace",
    "tabs",
    "activeTab",
    "database-view",
    "expanded-directories",
]);
const tabIdSchema = z.string().uuid();
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

/** A game stamp is the lowercase hex SHA-256 of the game's exact bytes (`read_game`). */
const STAMP_PATTERN = /^[a-f0-9]{64}$/;

const persistedTreeSchema = z.object({
    root: treeNodeSchema,
    headers: headersSchema,
    position: pathSchema,
    dirty: z.boolean(),
    sourceStamp: z.string().regex(STAMP_PATTERN).nullable(),
    appendAttempted: z.boolean(),
    report: z.object({
        inProgress: z.boolean(),
        operationId: z.string().nullable().optional(),
    }),
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

function migrateReport(report: unknown): { inProgress: boolean; operationId: string | null } {
    if (!isRecord(report)) {
        return { inProgress: false, operationId: null };
    }
    return {
        inProgress: typeof report.inProgress === "boolean" ? report.inProgress : false,
        // Coerce a wrong-typed id to null: Zod would otherwise reject the whole tree.
        operationId: typeof report.operationId === "string" ? report.operationId : null,
    };
}

/** Adds fields that were absent before TreeState persistence was versioned. */
export function migrateTreeForStorage(value: unknown): unknown {
    if (!isRecord(value)) return value;
    const hasAppendAttempted = Object.prototype.hasOwnProperty.call(value, "appendAttempted");
    return {
        ...value,
        position: Array.isArray(value.position) ? value.position : [],
        dirty: typeof value.dirty === "boolean" ? value.dirty : false,
        sourceStamp:
            typeof value.sourceStamp === "string" && STAMP_PATTERN.test(value.sourceStamp)
                ? value.sourceStamp
                : null,
        appendAttempted:
            typeof value.appendAttempted === "boolean" ? value.appendAttempted : hasAppendAttempted,
        report: migrateReport(value.report),
    };
}

type StoredTree = StorageValue<unknown>;
type ValidatedStoredTree = StorageValue<z.infer<typeof persistedTreeSchema>>;

export type TabTreeStorageStatus =
    | { kind: "not-read" }
    | { kind: "absent" }
    | { kind: "available" }
    | { kind: "unreadable"; rawValue: string }
    | { kind: "unavailable"; error: unknown };

export type TabTreeReadResult =
    | { kind: "absent" }
    | { kind: "available"; value: StoredTree }
    | { kind: "unreadable"; rawValue: string }
    | { kind: "unavailable"; error: unknown };

export type TabTreeCloneResult =
    | { kind: "copied" }
    | Exclude<TabTreeReadResult, { kind: "available" }>
    | { kind: "copy-failed"; error: unknown };

const NOT_READ_STATUS: TabTreeStorageStatus = { kind: "not-read" };

function parseTree(value: unknown): ValidatedStoredTree | null {
    const candidate = migrateTreeForStorage(value);
    if (!isBoundedTreeForStorage(candidate)) return null;
    const parsed = persistedTreeSchema.safeParse(candidate);
    if (!parsed.success) return null;

    // A stored path is repaired against the tree it was stored with: the cursor and the drill path
    // clamp to their longest resolving prefix, and an unresolvable repertoire start is dropped.
    const state = parsed.data;
    state.position = state.position.slice(0, getResolvedPathLength(state.root, state.position));
    const { start } = state.headers;
    if (start !== undefined && getResolvedPathLength(state.root, start) !== start.length) {
        delete state.headers.start;
    }
    const { practicePath } = state;
    if (practicePath !== undefined && practicePath !== null) {
        state.practicePath = practicePath.slice(0, getResolvedPathLength(state.root, practicePath));
    }

    return { version: TREE_STORAGE_VERSION, state };
}

export function createTabStorageQuotaError(cause: unknown): Error {
    return new Error(
        "Could not open the game: the browser's session storage is full. Close some open tabs and try again.",
        { cause },
    );
}

export function persistStorageWriteError(cause: unknown): Error {
    if (
        typeof cause === "object" &&
        cause !== null &&
        "name" in cause &&
        String((cause as { name: unknown }).name) === "QuotaExceededError"
    ) {
        return createTabStorageQuotaError(cause);
    }
    // jsdom's DOMException is not an Error; the browser one is, so the first arm covers WebKit.
    if (cause instanceof Error || cause instanceof DOMException) return cause;
    return new Error("Could not save this game. Session storage rejected the write.", { cause });
}

export function parseLegacyTreeJson(value: string): unknown | null {
    try {
        return JSON.parse(value) as unknown;
    } catch {
        return null;
    }
}

export function decodeLegacyOrCompressed(value: string): ValidatedStoredTree | null {
    const decoded = decodeCompressedOrJson(value);
    const envelope = z
        .object({ version: z.number().int().nonnegative(), state: z.unknown() })
        .safeParse(decoded);
    if (envelope.success) return parseTree(envelope.data.state);

    // The earliest sessions stored TreeState itself as plain JSON, without the
    // zustand envelope or compression. Keep that recovery path deliberately
    // narrow so corrupt blobs are retained for explicit recovery rather than trusted.
    return parseTree(decoded);
}

/**
 * The sole owner of tab-tree storage. In particular, callers never read
 * sessionStorage directly: a clone or close observes not-yet-flushed edits.
 */
export class TabStorageRepository {
    private readonly pending = new Map<string, StoredTree>();
    private readonly readStatuses = new Map<string, TabTreeStorageStatus>();
    private readonly statusListeners = new Map<string, Set<() => void>>();
    private flushTimeout: ReturnType<typeof setTimeout> | null = null;
    private handlersBound = false;

    storageFor<S>(): PersistStorage<S> {
        return {
            getItem: (name) => this.read<S>(name),
            setItem: (name, value) => {
                this.write(name, value);
            },
            removeItem: (name) => this.remove(name),
        };
    }

    read<S>(tabId: string): StorageValue<S> | null {
        const result = this.readTree(tabId);
        return result.kind === "available" ? (result.value as StorageValue<S>) : null;
    }

    /** Read the exact tab key while keeping unreadable and refused reads distinct from absence. */
    readTree(tabId: string): TabTreeReadResult {
        const pending = this.pending.get(tabId);
        if (pending) {
            this.setReadStatus(tabId, { kind: "available" });
            return { kind: "available", value: pending };
        }
        if (NON_TREE_SESSION_KEYS.has(tabId)) {
            this.setReadStatus(tabId, { kind: "absent" });
            return { kind: "absent" };
        }

        let raw: string | null;
        try {
            raw = sessionStorage.getItem(tabId);
        } catch (error) {
            const result: TabTreeReadResult = { kind: "unavailable", error };
            this.setReadStatus(tabId, result);
            return result;
        }
        if (raw === null) {
            const result: TabTreeReadResult = { kind: "absent" };
            this.setReadStatus(tabId, result);
            return result;
        }

        const decoded = decodeLegacyOrCompressed(raw);
        if (!decoded) {
            const result: TabTreeReadResult = { kind: "unreadable", rawValue: raw };
            this.setReadStatus(tabId, result);
            return result;
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
        this.setReadStatus(tabId, { kind: "available" });
        return { kind: "available", value: decoded };
    }

    /** Re-reads the exact key after a storage refusal; pending valid edits remain authoritative. */
    retryRead(tabId: string): TabTreeReadResult {
        return this.readTree(tabId);
    }

    getStatus(tabId: string): TabTreeStorageStatus {
        return this.readStatuses.get(tabId) ?? NOT_READ_STATUS;
    }

    subscribeStatus(tabId: string, listener: () => void): () => void {
        let listeners = this.statusListeners.get(tabId);
        if (!listeners) {
            listeners = new Set();
            this.statusListeners.set(tabId, listeners);
        }
        listeners.add(listener);
        return () => {
            listeners?.delete(listener);
            if (listeners?.size === 0) this.statusListeners.delete(tabId);
        };
    }

    /** Returns the exact undecodable bytes captured during hydration for phase-2 recovery copy. */
    readRawValueForRecovery(tabId: string): string {
        const status = this.getStatus(tabId);
        if (status.kind !== "unreadable") {
            throw new Error("This tab has no readable undecodable tree value to copy.");
        }
        return status.rawValue;
    }

    /** Removes only a known undecodable value, clearing its write gate after verified removal. */
    discardUnreadable(tabId: string): boolean {
        const status = this.getStatus(tabId);
        if (status.kind !== "unreadable") return false;
        try {
            sessionStorage.removeItem(tabId);
            if (sessionStorage.getItem(tabId) !== null) {
                throw new Error("Session storage retained the unreadable tree after removal.");
            }
        } catch (error) {
            const reported = persistStorageWriteError(error);
            reportPersistError(reported);
            throw reported;
        }
        this.pending.delete(tabId);
        this.setReadStatus(tabId, { kind: "absent" });
        return true;
    }

    write<S>(tabId: string, value: StorageValue<S>) {
        if (this.writeBlocker(tabId)) return;
        this.pending.set(tabId, { version: TREE_STORAGE_VERSION, state: value.state });
        this.setReadStatus(tabId, { kind: "available" });
        this.scheduleFlush();
    }

    seed(tabId: string, state: unknown) {
        const value = parseTree(state);
        if (!value) throw new Error("Cannot persist an invalid game tree.");
        const blocker = this.writeBlocker(tabId);
        if (blocker) {
            throw new Error(
                "Cannot replace a tab tree while its storage is unreadable or unavailable.",
                { cause: blocker.kind === "unavailable" ? blocker.error : blocker },
            );
        }
        try {
            sessionStorage.setItem(tabId, serializeStorageValue(value));
            this.setReadStatus(tabId, { kind: "available" });
        } catch (error) {
            throw persistStorageWriteError(error);
        }
    }

    clone(sourceTabId: string, targetTabId: string): TabTreeCloneResult {
        const source = this.readTree(sourceTabId);
        if (source.kind !== "available") return source;
        const copy = this.validatedClone(source.value);
        if (!copy) {
            return {
                kind: "copy-failed",
                error: new Error("Could not validate the source tree."),
            };
        }
        const blocker = this.writeBlocker(targetTabId);
        if (blocker) {
            return {
                kind: "copy-failed",
                error:
                    blocker.kind === "unavailable"
                        ? blocker.error
                        : new Error("The destination tree key cannot be replaced."),
            };
        }
        this.pending.set(targetTabId, copy);
        this.setReadStatus(targetTabId, { kind: "available" });
        this.scheduleFlush();
        return { kind: "copied" };
    }

    /** Copies exact unreadable bytes to a fresh migration ID and verifies the durable target. */
    copyUnreadableForWorkspaceRepair(targetTabId: string, rawValue: string): void {
        const target = this.readTree(targetTabId);
        if (target.kind !== "absent") {
            throw target.kind === "unavailable"
                ? target.error
                : new Error("The destination tree key is already in use.");
        }

        let attemptedWrite = false;
        try {
            attemptedWrite = true;
            sessionStorage.setItem(targetTabId, rawValue);
            if (sessionStorage.getItem(targetTabId) !== rawValue) {
                throw new Error("Could not verify the copied unreadable tree value.");
            }
            this.setReadStatus(targetTabId, { kind: "unreadable", rawValue });
        } catch (error) {
            // The target was verified absent immediately before this write. Remove only bytes
            // produced by this copy; the original source remains the workspace's owner.
            let failure = error;
            if (attemptedWrite) {
                try {
                    if (sessionStorage.getItem(targetTabId) === rawValue) {
                        sessionStorage.removeItem(targetTabId);
                    }
                } catch (cleanupError) {
                    reportPersistError(persistStorageWriteError(cleanupError));
                    failure = cleanupError;
                }
            }
            this.setReadStatus(targetTabId, { kind: "unavailable", error: failure });
            throw failure;
        }
    }

    /** Creates an immediately durable clone without flushing any unrelated pending tree. */
    cloneDurable(sourceTabId: string, targetTabId: string) {
        const source = this.readTree(sourceTabId);
        if (source.kind !== "available") return;
        const copy = this.validatedClone(source.value);
        if (!copy) return;
        const blocker = this.writeBlocker(targetTabId);
        if (blocker) {
            throw new Error(
                "Cannot replace a tab tree while its storage is unreadable or unavailable.",
                { cause: blocker.kind === "unavailable" ? blocker.error : blocker },
            );
        }
        try {
            sessionStorage.setItem(targetTabId, serializeStorageValue(copy));
            this.setReadStatus(targetTabId, { kind: "available" });
        } catch (error) {
            throw persistStorageWriteError(error);
        }
    }

    remove(tabId: string) {
        this.pending.delete(tabId);
        sessionStorage.removeItem(tabId);
        this.setReadStatus(tabId, NOT_READ_STATUS);
    }

    /** Removes a known tree without letting cleanup failures abort its owning operation. */
    removeTreeSafely(tabId: string) {
        return !this.removeKnownTreesSafely([tabId]).has(tabId);
    }

    /** A refused admission records the exact tree to retry when rollback removal failed. */
    recordFailedAdmission(tabId: string) {
        try {
            sessionStorage.setItem(`${FAILED_ADMISSION_PREFIX}${tabId}`, FAILED_ADMISSION_VALUE);
        } catch (error) {
            reportPersistError(persistStorageWriteError(error));
        }
    }

    /** Replay only explicit refused-admission markers, independent of ownership snapshots. */
    replayFailedAdmissions(retainedIds: ReadonlySet<string>) {
        const markedIds = new Set<string>();
        const failedIds = new Set<string>();
        try {
            const markers = Array.from({ length: sessionStorage.length }, (_, index) =>
                sessionStorage.key(index),
            ).filter((key): key is string => key?.startsWith(FAILED_ADMISSION_PREFIX) ?? false);
            const validMarkers: Array<{ key: string; tabId: string }> = [];
            const invalidMarkers: string[] = [];
            const removable = new Set<string>();
            let storageReadError: unknown;
            for (const marker of markers) {
                const tabId = marker.slice(FAILED_ADMISSION_PREFIX.length);
                if (!tabIdSchema.safeParse(tabId).success) {
                    invalidMarkers.push(marker);
                    continue;
                }
                let value: string | null;
                try {
                    value = sessionStorage.getItem(marker);
                } catch (error) {
                    // Keep an unread marker's tree out of the sweep until its intent is known.
                    markedIds.add(tabId);
                    failedIds.add(tabId);
                    storageReadError ??= error;
                    continue;
                }
                if (value !== FAILED_ADMISSION_VALUE) {
                    invalidMarkers.push(marker);
                    continue;
                }
                validMarkers.push({ key: marker, tabId });
                if (!retainedIds.has(tabId)) {
                    markedIds.add(tabId);
                    try {
                        if (this.isStoredTree(tabId)) removable.add(tabId);
                    } catch (error) {
                        failedIds.add(tabId);
                        storageReadError ??= error;
                    }
                }
            }
            if (storageReadError !== undefined)
                reportPersistError(persistStorageWriteError(storageReadError));
            const failed = this.removeKnownTreesSafely(removable);
            for (const id of failed) failedIds.add(id);
            let markerError: unknown;
            let markerRemovalFailed = false;
            const markersToClear = [
                ...invalidMarkers,
                ...validMarkers.filter(({ tabId }) => !failedIds.has(tabId)).map(({ key }) => key),
            ];
            for (const key of markersToClear) {
                try {
                    sessionStorage.removeItem(key);
                } catch (error) {
                    markerRemovalFailed = true;
                    markerError ??= error;
                }
            }
            if (markerRemovalFailed) reportPersistError(persistStorageWriteError(markerError));
        } catch (error) {
            reportPersistError(persistStorageWriteError(error));
        }
        return { markedIds, failedIds };
    }

    /** Remove a known set and report one failure while retaining every refused ID for retry. */
    removeKnownTreesSafely(tabIds: Iterable<string>): Set<string> {
        const failed = new Set<string>();
        let firstError: unknown;
        let hadError = false;
        try {
            for (const tabId of tabIds) {
                try {
                    this.remove(tabId);
                } catch (error) {
                    failed.add(tabId);
                    hadError = true;
                    firstError ??= error;
                }
            }
        } catch (error) {
            hadError = true;
            firstError ??= error;
        }
        if (hadError) reportPersistError(persistStorageWriteError(firstError));
        return failed;
    }

    /** Check whether a session key still contains a decodable tree. */
    isStoredTree(tabId: string) {
        const raw = sessionStorage.getItem(tabId);
        // A null value also decodes to null; this guard keeps it out of the string-only API.
        // Stryker disable next-line ConditionalExpression: both branches return false for null.
        return raw !== null && decodeLegacyOrCompressed(raw) !== null;
    }

    /** Reclaim durable trees absent from the retained workspace; other session values stay untouched. */
    removeOrphanedTrees(retainedIds: ReadonlySet<string>) {
        this.removeKnownTreesSafely(this.storedTreeKeys(retainedIds));
    }

    /** Snapshot valid stored tree keys through the same bounded validator used by orphan cleanup. */
    snapshotStoredTreeKeys(
        maxTreeKeys: number,
        maxKeyLength: number,
        excludedKeys?: ReadonlySet<string>,
    ): string[] | null {
        const keys: string[] = [];
        try {
            for (const key of this.storedTreeKeys(excludedKeys)) {
                if (key.length > maxKeyLength || keys.length === maxTreeKeys) return null;
                keys.push(key);
            }
        } catch (error) {
            reportPersistError(persistStorageWriteError(error));
            return null;
        }
        return keys;
    }

    private *storedTreeKeys(excludedKeys?: ReadonlySet<string>): Generator<string> {
        const keys = Array.from({ length: sessionStorage.length }, (_, index) =>
            sessionStorage.key(index),
        );
        for (const key of keys) {
            if (!key || key.startsWith(FAILED_ADMISSION_PREFIX) || excludedKeys?.has(key)) continue;
            if (!this.isStoredTree(key)) continue;
            yield key;
        }
    }

    flush({ notify = false }: { notify?: boolean } = {}): string[] {
        if (this.flushTimeout) {
            clearTimeout(this.flushTimeout);
            this.flushTimeout = null;
        }
        const failedTabIds: string[] = [];
        let notifyError: unknown;
        for (const [tabId, value] of this.pending) {
            const blocker = this.writeBlocker(tabId);
            if (blocker) {
                failedTabIds.push(tabId);
                notifyError ??=
                    blocker.kind === "unavailable"
                        ? blocker.error
                        : new Error("Cannot persist a tab tree while its storage is unreadable.");
                continue;
            }
            try {
                sessionStorage.setItem(tabId, serializeStorageValue(value));
                this.pending.delete(tabId);
                this.setReadStatus(tabId, { kind: "available" });
            } catch (error) {
                failedTabIds.push(tabId);
                void warn(`Could not persist tree storage ${tabId}: ${String(error)}`);
                if (notifyError === undefined) notifyError = error;
            }
        }
        if (notify && notifyError !== undefined) {
            reportPersistError(persistStorageWriteError(notifyError));
        }
        return failedTabIds;
    }

    pendingCount() {
        return this.pending.size;
    }

    private scheduleFlush() {
        this.bindFlushHandlers();
        if (this.flushTimeout) clearTimeout(this.flushTimeout);
        this.flushTimeout = setTimeout(() => {
            this.flushTimeout = null;
            this.flush({ notify: true });
        }, DEBOUNCE_MS);
    }

    private writeBlocker(tabId: string): TabTreeStorageStatus | null {
        if (NON_TREE_SESSION_KEYS.has(tabId)) {
            return {
                kind: "unavailable",
                error: new Error("The key belongs to another session store."),
            };
        }
        let status = this.getStatus(tabId);
        if (status.kind === "not-read") {
            this.readTree(tabId);
            status = this.getStatus(tabId);
        }
        return status.kind === "unreadable" || status.kind === "unavailable" ? status : null;
    }

    private setReadStatus(tabId: string, status: TabTreeStorageStatus | TabTreeReadResult) {
        const next: TabTreeStorageStatus =
            status.kind === "available"
                ? { kind: "available" }
                : status.kind === "unreadable"
                  ? { kind: "unreadable", rawValue: status.rawValue }
                  : status.kind === "unavailable"
                    ? { kind: "unavailable", error: status.error }
                    : status;
        const current = this.getStatus(tabId);
        const unchanged =
            current.kind === next.kind &&
            (current.kind !== "unreadable" ||
                (next.kind === "unreadable" && current.rawValue === next.rawValue)) &&
            (current.kind !== "unavailable" ||
                (next.kind === "unavailable" && current.error === next.error));
        if (unchanged) return;
        if (next.kind === "not-read") this.readStatuses.delete(tabId);
        else this.readStatuses.set(tabId, next);
        for (const listener of this.statusListeners.get(tabId) ?? []) listener();
    }

    private validatedClone(source: StorageValue<unknown>): ValidatedStoredTree | null {
        // Round-trip through serialize/parse so a pending partialized store
        // (which still carries action functions) cannot reach structuredClone.
        const copy = decodeLegacyOrCompressed(serializeStorageValue(source));
        if (!copy) return null;
        // A duplicate tab must not share a live analysis lease.
        copy.state.report = { ...copy.state.report, inProgress: false, operationId: null };
        return copy;
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
