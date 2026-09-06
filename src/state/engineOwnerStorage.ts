import equal from "fast-deep-equal";
import type { AsyncStorage } from "jotai/vanilla/utils/atomWithStorage";
import { z } from "zod";
import i18n from "@/i18n";
import { tauri } from "@/platform/tauri";
import { warn } from "@/platform/native";
import { engineSchema, type Engine } from "@/utils/engines";
import { opponentSettingsSchema, type OpponentSettings } from "@/state/opponentSettings";
import { pathRefKey } from "@/utils/pathCapabilities";
import { reportPersistError } from "./persistError";
import { decodeCompressedOrJson, serializeStorageValue } from "./store/debouncedStorage";
import { storageErrorCause } from "./storageError";

export const ENGINE_OWNER_KEYS = [
    "engines",
    "game-player1-settings",
    "game-player2-settings",
] as const;
export type EngineOwnerKey = (typeof ENGINE_OWNER_KEYS)[number];

export interface EngineOwnerSaveReceipt {
    operationId: string;
    key: EngineOwnerKey;
    saved: boolean;
    synchronized: boolean;
    error?: unknown;
}

const schemas: Record<EngineOwnerKey, z.ZodTypeAny> = {
    engines: z.array(engineSchema),
    "game-player1-settings": opponentSettingsSchema,
    "game-player2-settings": opponentSettingsSchema,
};

export interface EngineOwnerInspection {
    capabilityIds: string[];
    attachmentIds: string[];
}

export interface EngineOwnerStartupSnapshot {
    capabilityIds: string[];
    attachmentIds: string[] | null;
    trusted: boolean;
}

function collectEngineIds(engine: Engine, capabilityIds: Set<string>, attachmentIds: Set<string>) {
    if (engine.imageHandle) {
        const id = pathRefKey(engine.imageHandle.id);
        capabilityIds.add(id);
        attachmentIds.add(id);
    }
    for (const setting of engine.settings ?? []) {
        if (setting.type === "resource") {
            for (const resource of setting.resources) {
                const id = pathRefKey(resource.id);
                capabilityIds.add(id);
                attachmentIds.add(id);
            }
        }
    }
    if (engine.type === "local") capabilityIds.add(pathRefKey(engine.handle.id));
}

function inspectParsedEngineOwner(key: EngineOwnerKey, parsed: unknown): EngineOwnerInspection {
    const capabilityIds = new Set<string>();
    const attachmentIds = new Set<string>();

    if (key === "engines") {
        for (const engine of parsed as Engine[]) {
            collectEngineIds(engine, capabilityIds, attachmentIds);
        }
    } else {
        const opponent = parsed as OpponentSettings;
        if (opponent.type === "engine") {
            if (opponent.engine) {
                collectEngineIds(opponent.engine, capabilityIds, attachmentIds);
            }
            for (const setting of opponent.engineSettings ?? []) {
                if (setting.type === "resource") {
                    for (const resource of setting.resources) {
                        const id = pathRefKey(resource.id);
                        capabilityIds.add(id);
                        attachmentIds.add(id);
                    }
                }
            }
        }
    }

    return {
        capabilityIds: [...capabilityIds].sort(),
        attachmentIds: [...attachmentIds].sort(),
    };
}

/** Strict owner validation used by startup evidence and every durable write. */
export function inspectEngineOwnerValue(
    key: EngineOwnerKey,
    value: unknown,
): EngineOwnerInspection | null {
    const parsed = schemas[key].safeParse(value);
    if (!parsed.success || !equal(value, parsed.data)) return null;
    return inspectParsedEngineOwner(key, parsed.data);
}

export function collectAttachmentIds(key: EngineOwnerKey, value: unknown): string[] | null {
    return inspectEngineOwnerValue(key, value)?.attachmentIds ?? null;
}

/** Reads each owner key once, preserving strict raw evidence for both startup owner families. */
export function collectOriginalEngineOwnerSnapshot(local: Storage): EngineOwnerStartupSnapshot {
    const capabilityIds = new Set<string>();
    const attachmentIds = new Set<string>();
    let trusted = true;

    for (const key of ENGINE_OWNER_KEYS) {
        let raw: string | null;
        try {
            raw = local.getItem(key);
        } catch {
            trusted = false;
            continue;
        }
        if (raw === null) continue;
        const decoded = decodeCompressedOrJson(raw);
        const inspected = decoded === null ? null : inspectEngineOwnerValue(key, decoded);
        if (inspected === null) {
            trusted = false;
            continue;
        }
        inspected.capabilityIds.forEach((id) => capabilityIds.add(id));
        inspected.attachmentIds.forEach((id) => attachmentIds.add(id));
    }

    return {
        capabilityIds: [...capabilityIds].sort(),
        attachmentIds: trusted ? [...attachmentIds].sort() : null,
        trusted,
    };
}

function readOwner(key: EngineOwnerKey): { trusted: boolean; ids: string[] } {
    let raw: string | null;
    try {
        raw = localStorage.getItem(key);
    } catch {
        return { trusted: false, ids: [] };
    }
    if (raw === null) return { trusted: true, ids: [] };
    const decoded = decodeCompressedOrJson(raw);
    if (decoded === null) return { trusted: false, ids: [] };
    const inspected = inspectEngineOwnerValue(key, decoded);
    return inspected === null
        ? { trusted: false, ids: [] }
        : { trusted: true, ids: inspected.attachmentIds };
}

let sequence = Promise.resolve();

const LEGACY_OWNER_CONFLICT = "persisted engine owner changed during identity migration";

function ownerStorageError(cause: unknown) {
    return new Error(`${i18n.t("Engines.SaveError")} ${storageErrorCause(cause)}`, { cause });
}

function enqueueEngineOwnerSave(
    key: EngineOwnerKey,
    encodedValue: string,
    expectedRaw?: string,
): Promise<EngineOwnerSaveReceipt> {
    const operationId = crypto.randomUUID();
    const run = sequence.then(async (): Promise<EngineOwnerSaveReceipt> => {
        const decoded = decodeCompressedOrJson(encodedValue);
        const changedIds = decoded === null ? null : collectAttachmentIds(key, decoded);
        if (changedIds === null) {
            const error = new Error("refusing to persist an invalid engine owner record");
            reportPersistError(error);
            return { operationId, key, saved: false, synchronized: false, error };
        }

        const union = new Set(changedIds);
        let allTrusted = true;
        for (const ownerKey of ENGINE_OWNER_KEYS) {
            if (ownerKey === key) continue;
            const owner = readOwner(ownerKey);
            allTrusted &&= owner.trusted;
            owner.ids.forEach((id) => union.add(id));
        }
        const retainedIds = [...union].sort().map((id) => ({ id }));
        try {
            await tauri.reconcileEngineAttachments({
                action: "prepare",
                retained_ids: retainedIds,
            });
        } catch (error) {
            reportPersistError(error instanceof Error ? error : new Error(String(error)));
            return { operationId, key, saved: false, synchronized: false, error };
        }
        try {
            if (expectedRaw !== undefined && localStorage.getItem(key) !== expectedRaw) {
                return {
                    operationId,
                    key,
                    saved: false,
                    synchronized: false,
                    error: new Error(LEGACY_OWNER_CONFLICT),
                };
            }
            localStorage.setItem(key, encodedValue);
        } catch (cause) {
            const error = ownerStorageError(cause);
            reportPersistError(error);
            return { operationId, key, saved: false, synchronized: false, error };
        }
        if (!allTrusted) return { operationId, key, saved: true, synchronized: false };
        try {
            await tauri.reconcileEngineAttachments({
                action: "reconcile",
                retained_ids: retainedIds,
                abandoned_ids: [],
                startup: false,
            });
            return { operationId, key, saved: true, synchronized: true };
        } catch (error) {
            reportPersistError(error instanceof Error ? error : new Error(String(error)));
            return { operationId, key, saved: true, synchronized: false, error };
        }
    });
    sequence = run.then(
        () => undefined,
        () => undefined,
    );
    return run;
}

export function saveEngineOwnerValue(
    key: EngineOwnerKey,
    encodedValue: string,
): Promise<EngineOwnerSaveReceipt> {
    return enqueueEngineOwnerSave(key, encodedValue);
}

function migrateEngineOwnerValue(
    key: EngineOwnerKey,
    encodedValue: string,
    expectedRaw: string,
): Promise<EngineOwnerSaveReceipt> {
    return enqueueEngineOwnerSave(key, encodedValue, expectedRaw);
}

function enqueueNativeAttachmentAction(
    action: Parameters<typeof tauri.reconcileEngineAttachments>[0],
) {
    const run = sequence.then(() => tauri.reconcileEngineAttachments(action));
    sequence = run.then(
        () => undefined,
        () => undefined,
    );
    return run;
}

export function abandonEngineAttachments(ids: Array<{ id: string }>) {
    if (ids.length === 0) return Promise.resolve();
    return enqueueNativeAttachmentAction({
        action: "reconcile",
        retained_ids: null,
        abandoned_ids: ids,
        startup: false,
    });
}

export function reconcileStartupEngineAttachments(
    retainedIds: Array<{ id: string }> | null,
    prerequisite: Promise<unknown>,
) {
    // Reserve this position synchronously. A save beginning while native startup is delayed queues
    // behind the original snapshot instead of being retired by that older evidence afterwards.
    const run = sequence.then(async () => {
        await prerequisite;
        if (retainedIds === null) return;
        await tauri.reconcileEngineAttachments({
            action: "reconcile",
            retained_ids: retainedIds,
            abandoned_ids: [],
            startup: true,
        });
    });
    sequence = run.then(
        () => undefined,
        () => undefined,
    );
    return run;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compareLegacyEngineFields(raw: unknown, parsed: unknown): boolean {
    if (!isRecord(raw) || !isRecord(parsed)) return false;
    const { id: _rawId, ...rawWithoutId } = raw;
    const { id: _parsedId, ...parsedWithoutId } = parsed;
    return equal(rawWithoutId, parsedWithoutId);
}

function isAllowedEngineIdentityRepair(
    raw: unknown,
    parsed: unknown,
    rawIds: Set<string>,
    seenRawIds: Set<string>,
    seenParsedIds: Set<string>,
): boolean {
    if (!isRecord(raw) || !isRecord(parsed) || typeof parsed.id !== "string") return false;
    if (!compareLegacyEngineFields(raw, parsed)) return false;
    if (typeof raw.id !== "string") {
        return !rawIds.has(parsed.id) && !seenParsedIds.has(parsed.id);
    }
    if (raw.id === parsed.id) return true;
    return seenRawIds.has(raw.id) && !rawIds.has(parsed.id) && !seenParsedIds.has(parsed.id);
}

function isLegacyIdentityMigration(key: EngineOwnerKey, raw: unknown, parsed: unknown): boolean {
    let migrated = false;
    if (key === "engines") {
        if (!Array.isArray(raw) || !Array.isArray(parsed) || raw.length !== parsed.length) {
            return false;
        }
        const rawIds = new Set(
            raw.flatMap((value) =>
                isRecord(value) && typeof value.id === "string" ? [value.id] : [],
            ),
        );
        const seenRawIds = new Set<string>();
        const seenParsedIds = new Set<string>();
        for (const [index, value] of raw.entries()) {
            const parsedValue = parsed[index];
            if (
                !isAllowedEngineIdentityRepair(
                    value,
                    parsedValue,
                    rawIds,
                    seenRawIds,
                    seenParsedIds,
                )
            ) {
                return false;
            }
            if (isRecord(value) && typeof value.id === "string") {
                migrated ||= value.id !== (parsedValue as { id: string }).id;
                seenRawIds.add(value.id);
            } else {
                migrated = true;
            }
            seenParsedIds.add((parsedValue as { id: string }).id);
        }
        return migrated;
    }
    if (!isRecord(raw) || !isRecord(parsed) || raw.type !== "engine" || parsed.type !== "engine") {
        return false;
    }
    const { engine: rawEngine, ...rawWithoutEngine } = raw;
    const { engine: parsedEngine, ...parsedWithoutEngine } = parsed;
    if (!equal(rawWithoutEngine, parsedWithoutEngine)) return false;
    if (rawEngine === null || parsedEngine === null) return false;
    const wasMissing = isRecord(rawEngine) && rawEngine.id === undefined;
    return (
        wasMissing &&
        isRecord(parsedEngine) &&
        typeof parsedEngine.id === "string" &&
        compareLegacyEngineFields(rawEngine, parsedEngine)
    );
}

function parseHydratableOwner(
    key: EngineOwnerKey,
    decoded: unknown,
    schema: z.ZodTypeAny = schemas[key],
) {
    const parsed = schema.safeParse(decoded);
    if (!parsed.success) return null;
    if (equal(decoded, parsed.data)) return { value: parsed.data, migrate: false };
    if (!isLegacyIdentityMigration(key, decoded, parsed.data)) return null;
    return { value: parsed.data, migrate: true };
}

export function createEngineOwnerStorage<Value>(
    key: EngineOwnerKey,
    schema: z.ZodType<Value, z.ZodTypeDef, unknown>,
    initialValue: Value,
): AsyncStorage<Value> {
    const getItem = async (
        storageKey: string,
        initialValue: Value,
        allowMigrationRetry: boolean,
    ): Promise<Value> => {
        if (storageKey !== key) throw new Error("engine owner storage key mismatch");
        let raw: string | null;
        try {
            raw = localStorage.getItem(key);
        } catch {
            warn(`Unable to read persisted value for ${key}`);
            return initialValue;
        }
        if (raw === null) return initialValue;
        const decoded = decodeCompressedOrJson(raw);
        const hydrated = decoded === null ? null : parseHydratableOwner(key, decoded, schema);
        if (!hydrated) {
            warn(`Invalid persisted value for ${key}`);
            return initialValue;
        }
        if (!hydrated.migrate || !allowMigrationRetry) return hydrated.value as Value;

        const migrated = await migrateEngineOwnerValue(
            key,
            serializeStorageValue(hydrated.value),
            raw,
        );
        if (!migrated.saved && migrated.error instanceof Error) {
            if (migrated.error.message === LEGACY_OWNER_CONFLICT) {
                return getItem(storageKey, initialValue, false);
            }
            return hydrated.value as Value;
        }
        return hydrated.value as Value;
    };
    const storage = {
        getItem(storageKey: string, initialValue: Value): Promise<Value> {
            return getItem(storageKey, initialValue, true);
        },
        async setItem(storageKey: string, value: Value) {
            if (storageKey !== key) throw new Error("engine owner storage key mismatch");
            return saveEngineOwnerValue(key, serializeStorageValue(value));
        },
        async removeItem(storageKey: string) {
            if (storageKey !== key) throw new Error("engine owner storage key mismatch");
            return saveEngineOwnerValue(key, serializeStorageValue(initialValue));
        },
    };
    // Jotai forwards the async storage result from atom writes. AsyncStorage narrows that result
    // to Promise<void>, while the dedicated owner atom recovers the runtime receipt.
    return storage as unknown as AsyncStorage<Value>;
}

export function resetEngineOwnerCoordinatorForTests() {
    sequence = Promise.resolve();
}
