import { warn } from "@/platform/native";
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

export function createZodStorage<Value>(
    schema: z.ZodType<Value>,
    storage: SyncStringStorage,
): SyncStorage<Value> {
    return {
        getItem(key, initialValue) {
            const storedValue = storage.getItem(key);
            if (storedValue === null) {
                return initialValue;
            }
            try {
                const rawValue = JSON.parse(storedValue);
                const parsedValue = schema.parse(rawValue);
                if (!equal(rawValue, parsedValue)) {
                    this.setItem(key, parsedValue);
                }
                return parsedValue;
            } catch {
                warn(`Invalid persisted value for ${key}`);
                this.setItem(key, initialValue);
                return initialValue;
            }
        },
        setItem(key, value) {
            storage.setItem(key, JSON.stringify(value));
        },
        removeItem(key) {
            storage.removeItem(key);
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
    return createZodStorage(schemaForDefault(initialValue) as z.ZodType<Value>, storage);
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
