import { z } from "zod";

export type CompletionDisposition = "applied" | "skipped";

// Match native MAX_ACCEPTED_OPERATIONS in src-tauri/src/infra/operations.rs. Each owner
// can retain one receipt per unacknowledged completion. A successful native snapshot prunes
// acknowledged IDs before recovery admits more receipts. Keep both limits aligned.
export const MAX_ENGINE_COMPLETION_RECEIPTS = 128;
export const completionReceiptsSchema = z
    .record(z.string().uuid(), z.enum(["applied", "skipped"]))
    .refine((receipts) => Object.keys(receipts).length <= MAX_ENGINE_COMPLETION_RECEIPTS);
const ownerEnvelopeSchema = z
    .object({
        version: z.literal(1),
        value: z.unknown(),
        receipts: completionReceiptsSchema,
    })
    .strict();

/** Shared by owner hydration, migrations, durable writes and the real-app verifier. */
export function decodeEngineOwnerValue(
    decoded: unknown,
): { value: unknown; receipts: Record<string, CompletionDisposition> } | null {
    if (
        typeof decoded === "object" &&
        decoded !== null &&
        !Array.isArray(decoded) &&
        ("version" in decoded || "receipts" in decoded || "value" in decoded)
    ) {
        const envelope = ownerEnvelopeSchema.safeParse(decoded);
        return envelope.success
            ? { value: envelope.data.value, receipts: envelope.data.receipts }
            : null;
    }
    return { value: decoded, receipts: {} };
}
