import { tauri } from "@/platform/tauri";
import { warn } from "@/platform/native";
import type { z } from "zod";

/** Raised when a bundled catalog document does not match its release signature. */
export class CatalogVerificationError extends Error {
    constructor(cause: unknown, message = "catalog signature verification failed") {
        super(message, { cause });
        this.name = "CatalogVerificationError";
    }
}

/**
 * Verifies a bundled catalog document against its detached Minisign signature and only then
 * parses it with `schema`. The exact bytes are verified; nothing is re-serialized.
 */
export async function loadSignedCatalog<T extends z.ZodTypeAny>(
    document: string,
    signature: string,
    schema: T,
): Promise<z.infer<T>> {
    try {
        await tauri.verifySignedBytes(document, signature);
    } catch (error) {
        warn(`Catalog signature verification failed: ${String(error)}`);
        throw new CatalogVerificationError(error);
    }
    // Parse only after the backend verified the exact bytes.
    return schema.parse(JSON.parse(document));
}
