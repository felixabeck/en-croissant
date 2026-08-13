import { z } from "zod";
import type { FileWorkspaceHandle, WorkspaceEntry } from "@/bindings";
import { fileWorkspaceHandleSchema } from "@/utils/pathCapabilities";

const fileTypeSchema = z.enum(["repertoire", "game", "tournament", "puzzle", "other"]);
export type FileType = z.infer<typeof fileTypeSchema>;

export const fileInfoMetadataSchema = z.object({
    type: fileTypeSchema,
    tags: z.array(z.string()),
});
export type FileInfoMetadata = z.infer<typeof fileInfoMetadataSchema>;

export const fileMetadataSchema = z.object({
    type: z.literal("file"),
    handle: fileWorkspaceHandleSchema,
    name: z.string(),
    numGames: z.number(),
    metadata: fileInfoMetadataSchema,
    lastModified: z.number(),
});
export type FileMetadata = z.infer<typeof fileMetadataSchema>;

export type Directory = {
    type: "directory";
    handle: FileWorkspaceHandle;
    children: (FileMetadata | Directory)[];
    name: string;
    lastModified: number;
};

export type Entry = FileMetadata | Directory;

export function workspaceEntryToEntry(entry: WorkspaceEntry): Entry {
    if (entry.kind === "directory") {
        return {
            type: "directory",
            handle: entry.handle,
            name: entry.name,
            children: entry.children.map(workspaceEntryToEntry),
            lastModified: Number(entry.lastModified),
        };
    }
    if (!entry.metadata || entry.gameCount === null) {
        throw new Error("Native workspace returned an incomplete PGN entry");
    }
    return {
        type: "file",
        handle: entry.handle,
        name: entry.name,
        numGames: entry.gameCount,
        metadata: { type: entry.metadata.type, tags: entry.metadata.tags },
        lastModified: Number(entry.lastModified),
    };
}
