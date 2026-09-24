import { atom } from "jotai";
import type { Atom } from "jotai/vanilla";
import type { SyncStringStorage } from "jotai/vanilla/utils/atomWithStorage";
import type { FileWorkspaceHandle } from "@/bindings";
import { fileWorkspaceKey } from "@/utils/pathCapabilities";
import { decodeCompressedOrJson, serializeStorageValue } from "./store/debouncedStorage";
import { reportPreferenceStorageFailure } from "./utils";

export const EXPANDED_DIRECTORIES_STORAGE_KEY = "expanded-directories";
export const MAX_EXPANDED_DIRECTORY_IDS = 1_000;
export const MAX_EXPANDED_DIRECTORY_JSON_BYTES = 65_536;

export type ExpandedDirectoriesRecord = {
    version: 1;
    workspaceId: string;
    ids: string[];
};

type ParsedExpandedDirectories =
    | { kind: "legacy"; ids: string[] }
    | {
          kind: "record";
          record: ExpandedDirectoriesRecord;
          ids: string[];
          needsRepair: boolean;
      }
    | { kind: "invalid" };

type StoredSnapshot =
    | { kind: "absent" }
    | { kind: "present"; value: unknown }
    | { kind: "unreadable"; cause: unknown };

type ExpandedMemory = { workspaceId: string; ids: string[] } | null;

const reportedReadFailures = new WeakSet<object>();
const attemptedRepairs = new WeakMap<object, Set<string>>();
const readFailureMarker = Symbol("expanded-directory-read-failure");

function recordFor(workspaceId: string, ids: string[]): ExpandedDirectoriesRecord {
    return { version: 1, workspaceId, ids };
}

function jsonByteLength(value: unknown): number {
    return new TextEncoder().encode(JSON.stringify(value)).length;
}

function uniqueInRecencyOrder(values: readonly unknown[]): string[] {
    const seen = new Set<string>();
    const reversed: string[] = [];
    for (let index = values.length - 1; index >= 0; index -= 1) {
        const value = values[index];
        if (typeof value !== "string" || value.length === 0) continue;
        if (seen.has(value)) continue;
        seen.add(value);
        reversed.push(value);
    }
    return reversed.reverse();
}

/** Normalizes to most-recent-last order, keeping both persisted budgets. */
export function normalizeExpandedDirectoryIds(
    values: readonly unknown[],
    workspaceId: string,
): string[] {
    const ids = uniqueInRecencyOrder(values);
    let first = 0;
    let jsonBytes = jsonByteLength(recordFor(workspaceId, ids));
    while (
        first < ids.length &&
        (ids.length - first > MAX_EXPANDED_DIRECTORY_IDS ||
            jsonBytes > MAX_EXPANDED_DIRECTORY_JSON_BYTES)
    ) {
        const oldest = ids[first];
        if (oldest !== undefined) {
            jsonBytes -= jsonByteLength(oldest) + (first < ids.length - 1 ? 1 : 0);
        }
        first += 1;
    }
    return ids.slice(first);
}

export function expandedDirectoryRecordJsonBytes(record: ExpandedDirectoriesRecord): number {
    return jsonByteLength(record);
}

/** Parses both the unscoped legacy array and the current versioned record. */
export function parseExpandedDirectoriesValue(value: unknown): ParsedExpandedDirectories {
    if (Array.isArray(value) && value.every((id) => typeof id === "string")) {
        return { kind: "legacy", ids: value };
    }
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return { kind: "invalid" };
    }
    const candidate = value as Record<string, unknown>;
    if (
        candidate.version !== 1 ||
        typeof candidate.workspaceId !== "string" ||
        candidate.workspaceId.length === 0 ||
        !Array.isArray(candidate.ids) ||
        !candidate.ids.every((id) => typeof id === "string" && id.length > 0) ||
        Object.keys(candidate).some((key) => !["version", "workspaceId", "ids"].includes(key))
    ) {
        return { kind: "invalid" };
    }
    const record = value as ExpandedDirectoriesRecord;
    const ids = normalizeExpandedDirectoryIds(record.ids, record.workspaceId);
    const needsRepair =
        ids.length !== record.ids.length ||
        ids.some((id, index) => id !== record.ids[index]) ||
        expandedDirectoryRecordJsonBytes(record) > MAX_EXPANDED_DIRECTORY_JSON_BYTES;
    return { kind: "record", record, ids, needsRepair };
}

function createSnapshotReader(storage: SyncStringStorage) {
    let cachedRaw: string | null | typeof readFailureMarker | undefined;
    let cachedSnapshot: StoredSnapshot | undefined;

    const read = (): StoredSnapshot => {
        let stored: string | null;
        try {
            stored = storage.getItem(EXPANDED_DIRECTORIES_STORAGE_KEY);
        } catch (cause) {
            if (cachedRaw === readFailureMarker && cachedSnapshot) return cachedSnapshot;
            cachedRaw = readFailureMarker;
            cachedSnapshot = { kind: "unreadable", cause };
            return cachedSnapshot;
        }
        if (cachedRaw === stored && cachedSnapshot) return cachedSnapshot;
        cachedRaw = stored;
        if (stored === null) {
            cachedSnapshot = { kind: "absent" };
        } else {
            const value = decodeCompressedOrJson(stored);
            cachedSnapshot =
                value === null
                    ? {
                          kind: "unreadable",
                          cause: new Error("Unreadable expanded directory storage"),
                      }
                    : { kind: "present", value };
        }
        return cachedSnapshot;
    };

    const noteWrite = (record: ExpandedDirectoriesRecord, encoded: string) => {
        cachedRaw = encoded;
        cachedSnapshot = { kind: "present", value: record };
    };

    return { read, noteWrite };
}

function reportReadFailureOnce(snapshot: StoredSnapshot, cause: unknown) {
    if (reportedReadFailures.has(snapshot)) return;
    reportedReadFailures.add(snapshot);
    reportPreferenceStorageFailure("read", cause);
}

function markRepairAttempt(snapshot: StoredSnapshot, workspaceId: string): boolean {
    let attempted = attemptedRepairs.get(snapshot);
    if (!attempted) {
        attempted = new Set();
        attemptedRepairs.set(snapshot, attempted);
    }
    if (attempted.has(workspaceId)) return false;
    attempted.add(workspaceId);
    return true;
}

function persistRecord(
    storage: SyncStringStorage,
    record: ExpandedDirectoriesRecord,
    operation: "save" | "repair",
    noteWrite: (record: ExpandedDirectoriesRecord, encoded: string) => void,
): boolean {
    const jsonBytes = expandedDirectoryRecordJsonBytes(record);
    if (jsonBytes > MAX_EXPANDED_DIRECTORY_JSON_BYTES) {
        reportPreferenceStorageFailure(
            operation,
            new RangeError(
                `Expanded directory record is ${jsonBytes} UTF-8 JSON bytes; maximum is ${MAX_EXPANDED_DIRECTORY_JSON_BYTES}`,
            ),
        );
        return false;
    }
    const encoded = serializeStorageValue(record);
    try {
        storage.setItem(EXPANDED_DIRECTORIES_STORAGE_KEY, encoded);
        noteWrite(record, encoded);
        return true;
    } catch (cause) {
        reportPreferenceStorageFailure(operation, cause);
        return false;
    }
}

function snapshotIds(
    snapshot: StoredSnapshot,
    workspaceId: string,
    storage: SyncStringStorage,
    noteWrite: (record: ExpandedDirectoriesRecord, encoded: string) => void,
): string[] {
    if (snapshot.kind === "absent") return [];
    if (snapshot.kind === "unreadable") {
        reportReadFailureOnce(snapshot, snapshot.cause);
        return [];
    }

    const parsed = parseExpandedDirectoriesValue(snapshot.value);
    if (parsed.kind === "invalid") {
        reportReadFailureOnce(snapshot, new Error("Invalid expanded directory record"));
        return [];
    }

    if (parsed.kind === "legacy") {
        const ids = normalizeExpandedDirectoryIds(parsed.ids, workspaceId);
        if (markRepairAttempt(snapshot, workspaceId)) {
            persistRecord(storage, recordFor(workspaceId, ids), "repair", noteWrite);
        }
        return ids;
    }

    if (parsed.record.workspaceId !== workspaceId) return [];
    if (parsed.needsRepair && markRepairAttempt(snapshot, workspaceId)) {
        persistRecord(storage, recordFor(workspaceId, parsed.ids), "repair", noteWrite);
    }
    return parsed.ids;
}

function tooLargeAsSingleId(workspaceId: string, id: string): boolean {
    return (
        expandedDirectoryRecordJsonBytes(recordFor(workspaceId, [id])) >
        MAX_EXPANDED_DIRECTORY_JSON_BYTES
    );
}

export function createExpandedDirectoriesAtom(
    workspaceAtom: Atom<FileWorkspaceHandle | null>,
    storage: SyncStringStorage,
) {
    const readSnapshot = createSnapshotReader(storage);
    const memoryAtom = atom<ExpandedMemory>(null);

    return atom(
        (get) => {
            const workspace = get(workspaceAtom);
            if (!workspace) return [];
            const workspaceId = fileWorkspaceKey(workspace);
            const memory = get(memoryAtom);
            if (memory?.workspaceId === workspaceId) return memory.ids;
            return snapshotIds(readSnapshot.read(), workspaceId, storage, readSnapshot.noteWrite);
        },
        (get, set, update: string[] | ((previous: string[]) => string[])) => {
            const workspace = get(workspaceAtom);
            if (!workspace) return;
            const workspaceId = fileWorkspaceKey(workspace);
            const snapshot = readSnapshot.read();
            const memory = get(memoryAtom);
            const previous =
                memory?.workspaceId === workspaceId
                    ? memory.ids
                    : snapshotIds(snapshot, workspaceId, storage, readSnapshot.noteWrite);
            const requested = typeof update === "function" ? update(previous) : update;
            const ids = uniqueInRecencyOrder(requested);

            const oversizedId = ids.find((id) => tooLargeAsSingleId(workspaceId, id));
            if (oversizedId !== undefined) {
                set(memoryAtom, { workspaceId, ids });
                const size = expandedDirectoryRecordJsonBytes(
                    recordFor(workspaceId, [oversizedId]),
                );
                reportPreferenceStorageFailure(
                    "save",
                    new RangeError(
                        `Expanded directory record is ${size} UTF-8 JSON bytes; maximum is ${MAX_EXPANDED_DIRECTORY_JSON_BYTES}`,
                    ),
                );
                return;
            }

            const boundedIds = normalizeExpandedDirectoryIds(ids, workspaceId);
            set(memoryAtom, { workspaceId, ids: boundedIds });

            // Invalid bytes stay intact. They cannot safely be replaced by a renderer guess.
            const currentSnapshot = readSnapshot.read();
            if (currentSnapshot.kind === "unreadable") return;
            if (
                currentSnapshot.kind === "present" &&
                parseExpandedDirectoriesValue(currentSnapshot.value).kind === "invalid"
            ) {
                return;
            }

            const record = recordFor(workspaceId, boundedIds);
            persistRecord(storage, record, "save", readSnapshot.noteWrite);
        },
    );
}
