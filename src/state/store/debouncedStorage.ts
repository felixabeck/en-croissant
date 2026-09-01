import { compressToUTF16, decompressFromUTF16 } from "lz-string";

// Tree state is persisted compressed. A ~6,600-node game serializes to ~1.5MB of JSON, which
// fills the ~5MB sessionStorage quota after a couple of tabs. compressToUTF16 shrinks it ~5x
// with an exact (lossless) round-trip and stays synchronous (no async hydration / flash). The
// seed writes in createTab / ImportModal use these same helpers so the store reads them back.
export function serializeStorageValue(value: unknown): string {
    return compressToUTF16(JSON.stringify(value));
}

export function deserializeStorageValue<T>(stored: string): T | null {
    try {
        const json = decompressFromUTF16(stored);
        return json ? (JSON.parse(json) as T) : null;
    } catch {
        return null;
    }
}

/** Compressed first; pretty JSON is the legacy fallback. */
export function decodeCompressedOrJson(stored: string | null): unknown | null {
    if (typeof stored !== "string") return null;
    const compressed = deserializeStorageValue<unknown>(stored);
    if (compressed !== null) return compressed;
    try {
        return JSON.parse(stored) as unknown;
    } catch {
        return null;
    }
}
