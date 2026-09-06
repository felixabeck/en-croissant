import { warn } from "@/platform/native";
import i18n from "@/i18n";
import equal from "fast-deep-equal";
import type {
    AsyncStorage,
    AsyncStringStorage,
    SyncStorage,
    SyncStringStorage,
} from "jotai/vanilla/utils/atomWithStorage";
import { z } from "zod";
import {
    decodeCompressedOrJson,
    deserializeStorageValue,
    serializeStorageValue,
} from "./store/debouncedStorage";
import { reportPersistError } from "./persistError";
import { storageErrorCause } from "./storageError";

function reportPreferenceStorageFailure(operation: "read" | "repair" | "save", cause: unknown) {
    const safeCause = storageErrorCause(cause);
    const message =
        operation === "read"
            ? i18n.t("Common.PreferenceReadFailed", { cause: safeCause })
            : operation === "repair"
              ? i18n.t("Common.PreferenceRepairFailed", { cause: safeCause })
              : i18n.t("Common.PreferenceSaveFailed", { cause: safeCause });
    reportPersistError(new Error(message, { cause }));
}

export function createZodStorage<Value>(
    schema: z.ZodType<Value, z.ZodTypeDef, unknown>,
    storage: SyncStringStorage,
): SyncStorage<Value> {
    const write = (key: string, value: Value, operation: "repair" | "save") => {
        try {
            storage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            reportPreferenceStorageFailure(operation, error);
            return false;
        }
    };

    return {
        getItem(key, initialValue) {
            let storedValue: string | null;
            try {
                storedValue = storage.getItem(key);
            } catch (error) {
                warn(`Unable to read persisted value for ${key}`);
                reportPreferenceStorageFailure("read", error);
                return initialValue;
            }
            if (storedValue === null) {
                return initialValue;
            }
            try {
                const rawValue = JSON.parse(storedValue);
                const parsedValue = schema.parse(rawValue);
                if (!equal(rawValue, parsedValue)) {
                    write(key, parsedValue, "repair");
                }
                return parsedValue;
            } catch {
                warn(`Invalid persisted value for ${key}`);
                write(key, initialValue, "repair");
                return initialValue;
            }
        },
        setItem(key, value) {
            write(key, value, "save");
        },
        removeItem(key) {
            try {
                storage.removeItem(key);
            } catch (error) {
                reportPreferenceStorageFailure("save", error);
            }
        },
    };
}

function schemaForDefault(value: unknown): z.ZodTypeAny {
    if (typeof value === "string") return z.string();
    if (typeof value === "number") return z.number().finite();
    if (typeof value === "boolean") return z.boolean();
    if (value === null) return z.null();
    if (Array.isArray(value)) {
        // Empty preference arrays have no element exemplar; their consumers own the
        // richer domain validation. They still cannot hydrate as a scalar/object.
        return z.array(value.length === 1 ? schemaForDefault(value[0]) : z.unknown());
    }
    if (typeof value === "object") {
        const shape = Object.fromEntries(
            Object.entries(value).map(([key, item]) => [key, schemaForDefault(item)]),
        );
        return Object.keys(shape).length > 0 ? z.object(shape) : z.record(z.unknown());
    }
    return z.unknown();
}

/**
 * Baseline validation for simple user preferences. Domain-shaped records use a
 * dedicated schema at their declaration; this prevents raw atomWithStorage
 * values from crashing module initialization or leaking stale scalar types.
 */
export function createPreferenceStorage<Value>(
    initialValue: Value,
    storage: SyncStringStorage = localStorage,
): SyncStorage<Value> {
    return createZodStorage(
        schemaForDefault(initialValue) as z.ZodType<Value, z.ZodTypeDef, unknown>,
        storage,
    );
}

export function createAsyncZodStorage<Input, Output>(
    schema: z.ZodType<Output, z.ZodTypeDef, Input>,
    storage: AsyncStringStorage,
): AsyncStorage<Output> {
    return {
        async getItem(key, initialValue) {
            try {
                const storedValue = await storage.getItem(key);
                if (storedValue === null) {
                    return initialValue;
                }
                const rawValue = decodeCompressedOrJson(storedValue);
                if (rawValue === null) {
                    throw new Error("unreadable persisted value");
                }
                const isLegacy = deserializeStorageValue(storedValue) === null;
                const res = schema.safeParse(rawValue);
                if (res.success) {
                    if (isLegacy || !equal(rawValue, res.data)) {
                        await this.setItem(key, res.data);
                    }
                    return res.data;
                }
                warn(`Invalid persisted value for ${key}`);
                await this.setItem(key, initialValue);
                return initialValue;
            } catch {
                warn(`Unable to read persisted value for ${key}`);
                return initialValue;
            }
        },
        async setItem(key, value) {
            await storage.setItem(key, serializeStorageValue(value));
        },
        async removeItem(key) {
            storage.removeItem(key);
        },
    };
}
