import equal from "fast-deep-equal";
import type { AsyncStorage, AsyncStringStorage } from "jotai/vanilla/utils/atomWithStorage";
import { z } from "zod";
import i18n from "@/i18n";
import { tauri } from "@/platform/tauri";
import { warn } from "@/platform/native";
import { engineSchema, type Engine } from "@/utils/engines";
import { opponentSettingsSchema, type OpponentSettings } from "@/utils/opponentSettings";
import { pathRefKey } from "@/utils/pathCapabilities";
import { reportPersistError } from "./persistError";
import { decodeCompressedOrJson, serializeStorageValue } from "./store/debouncedStorage";

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

function collectEngineAttachments(engine: Engine, ids: Set<string>) {
    if (engine.imageHandle) ids.add(pathRefKey(engine.imageHandle.id));
    for (const setting of engine.settings ?? []) {
        if (setting.type === "resource") {
            for (const resource of setting.resources) ids.add(pathRefKey(resource.id));
        }
    }
}

export function collectAttachmentIds(key: EngineOwnerKey, value: unknown): string[] | null {
    const parsed = schemas[key].safeParse(value);
    if (!parsed.success || !equal(value, parsed.data)) return null;
    const ids = new Set<string>();
    if (key === "engines") {
        for (const engine of parsed.data as Engine[]) collectEngineAttachments(engine, ids);
    } else {
        const opponent = parsed.data as OpponentSettings;
        if (opponent.type === "engine") {
            if (opponent.engine) collectEngineAttachments(opponent.engine, ids);
            for (const setting of opponent.engineSettings ?? []) {
                if (setting.type === "resource") {
                    for (const resource of setting.resources) ids.add(pathRefKey(resource.id));
                }
            }
        }
    }
    return [...ids].sort();
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
    const ids = collectAttachmentIds(key, decoded);
    return ids === null ? { trusted: false, ids: [] } : { trusted: true, ids };
}

let sequence = Promise.resolve();

export function saveEngineOwnerValue(
    key: EngineOwnerKey,
    encodedValue: string,
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
            localStorage.setItem(key, encodedValue);
        } catch (cause) {
            const error = new Error(i18n.t("Engines.SaveError"), { cause });
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

export function createEngineOwnerStringStorage(key: "engines"): AsyncStringStorage {
    return {
        async getItem(storageKey) {
            return localStorage.getItem(storageKey);
        },
        async setItem(storageKey, value) {
            if (storageKey !== key) throw new Error("engine owner storage key mismatch");
            await saveEngineOwnerValue(key, value);
        },
        async removeItem(storageKey) {
            if (storageKey !== key) throw new Error("engine owner storage key mismatch");
            await saveEngineOwnerValue(key, serializeStorageValue([]));
        },
    };
}

export function createEngineOwnerStorage<Value>(
    key: EngineOwnerKey,
    schema: z.ZodType<Value, z.ZodTypeDef, unknown>,
    initialValue: Value,
): AsyncStorage<Value> {
    const storage = {
        async getItem(storageKey: string, initialValue: Value) {
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
            const parsed = decoded === null ? null : schema.safeParse(decoded);
            if (!parsed || !parsed.success || !equal(decoded, parsed.data)) {
                warn(`Invalid persisted value for ${key}`);
                return initialValue;
            }
            return parsed.data;
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
