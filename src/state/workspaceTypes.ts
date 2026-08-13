import { z } from "zod";
import { type FileMetadata, fileMetadataSchema } from "@/components/files/file";
import { databaseHandleSchema } from "@/utils/pathCapabilities";

const gameOriginSchema = z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("none") }),
    z.object({ kind: z.literal("file"), file: fileMetadataSchema, gameNumber: z.number() }),
    z.object({ kind: z.literal("temp_file"), file: fileMetadataSchema, gameNumber: z.number() }),
    z.object({ kind: z.literal("database"), database: databaseHandleSchema, gameId: z.number() }),
]);

export const tabSchema = z.object({
    name: z.string(),
    value: z.string(),
    type: z.enum(["new", "play", "analysis", "puzzles"]),
    gameOrigin: gameOriginSchema,
});

export type GameOrigin = z.infer<typeof gameOriginSchema>;
export type Tab = z.infer<typeof tabSchema>;
export type TabFile = FileMetadata;

export function newWorkspaceId(reservedIds: Iterable<string> = []) {
    const reserved = new Set(reservedIds);
    for (let attempt = 0; attempt < 32; attempt++) {
        const id = crypto.randomUUID();
        if (
            !reserved.has(id) &&
            (typeof sessionStorage === "undefined" || !sessionStorage.getItem(id))
        ) {
            return id;
        }
    }
    throw new Error("Could not allocate a unique tab ID.");
}
