import equal from "fast-deep-equal";
import { z } from "zod";
import type { PathOwnerFamily, StartupPathOwners } from "@/bindings";
import { tauri } from "@/platform/tauri";
import { decodeCompressedOrJson } from "./store/debouncedStorage";
import { tabSchema } from "./workspaceTypes";
import {
    databaseHandleSchema,
    fileWorkspaceHandleSchema,
    pathRefKey,
    pathRefSchema,
} from "@/utils/pathCapabilities";
import { engineSchema, engineSettingsSchema } from "@/utils/engines";

type StorageRead = { present: false } | { present: true; value: unknown } | { failed: true };

function readJson(storage: Storage, key: string): StorageRead {
    try {
        const raw = storage.getItem(key);
        if (raw === null) return { present: false };
        return { present: true, value: JSON.parse(raw) as unknown };
    } catch {
        return { failed: true };
    }
}

function readCompressed(storage: Storage, key: string): StorageRead {
    try {
        const raw = storage.getItem(key);
        if (raw === null) return { present: false };
        const value = decodeCompressedOrJson(raw);
        return value === null ? { failed: true } : { present: true, value };
    } catch {
        return { failed: true };
    }
}

function collectEngineIds(value: z.output<typeof engineSchema>, ids: Set<string>) {
    if (value.imageHandle) ids.add(pathRefKey(value.imageHandle.id));
    for (const setting of value.settings ?? []) {
        if (setting.type === "resource") {
            for (const resource of setting.resources) ids.add(pathRefKey(resource.id));
        }
    }
    if (value.type === "local") ids.add(pathRefKey(value.handle.id));
}

const opponentOwnerSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("human") }).passthrough(),
    z
        .object({
            type: z.literal("engine"),
            engine: engineSchema.nullable(),
            engineSettings: engineSettingsSchema.optional(),
        })
        .passthrough(),
]);

function collectOne<T>(
    read: StorageRead,
    schema: z.ZodType<T, z.ZodTypeDef, unknown>,
    consume: (value: T) => void,
): boolean {
    if ("failed" in read) return false;
    if (!read.present) return true;
    const parsed = schema.safeParse(read.value);
    if (!parsed.success || !equal(read.value, parsed.data)) return false;
    consume(parsed.data);
    return true;
}

export function collectOriginalPathOwners(local?: Storage, session?: Storage): StartupPathOwners {
    const ids = new Set<string>();
    const trusted = new Set<PathOwnerFamily>();
    const trust = (family: PathOwnerFamily, ok: boolean) => {
        if (ok) trusted.add(family);
    };

    try {
        local ??= globalThis.localStorage;
        session ??= globalThis.sessionStorage;
    } catch {
        return { retainedIds: [], trustedFamilies: [] };
    }

    trust(
        "downloadDestination",
        collectOne(
            readJson(local, "download-destination-capability"),
            pathRefSchema.nullable(),
            (value) => value && ids.add(pathRefKey(value)),
        ),
    );
    trust(
        "fileWorkspace",
        collectOne(
            readJson(local, "file-workspace"),
            fileWorkspaceHandleSchema.nullable(),
            (value) => value && ids.add(pathRefKey(value.id)),
        ),
    );
    trust(
        "recentFiles",
        collectOne(
            readJson(local, "recent-files"),
            z.array(z.object({ handle: fileWorkspaceHandleSchema }).passthrough()),
            (values) => values.forEach(({ handle }) => ids.add(pathRefKey(handle.id))),
        ),
    );
    trust(
        "referenceDatabase",
        collectOne(
            readJson(local, "reference-database"),
            databaseHandleSchema.nullable(),
            (value) => value && ids.add(pathRefKey(value.id)),
        ),
    );
    trust(
        "puzzleDatabase",
        collectOne(
            readJson(local, "puzzle-db"),
            pathRefSchema.nullable(),
            (value) => value && ids.add(pathRefKey(value)),
        ),
    );
    trust(
        "openingBook",
        collectOne(
            readJson(local, "game-opening-book-handle"),
            z.object({ id: pathRefSchema, kind: z.literal("openingBook") }).nullable(),
            (value) => value && ids.add(pathRefKey(value.id)),
        ),
    );

    let enginesTrusted = true;
    const enginesRead = readCompressed(local, "engines");
    enginesTrusted =
        collectOne(enginesRead, z.array(engineSchema), (values) =>
            values.forEach((value) => collectEngineIds(value, ids)),
        ) && enginesTrusted;
    for (const key of ["game-player1-settings", "game-player2-settings"]) {
        enginesTrusted =
            collectOne(readCompressed(local, key), opponentOwnerSchema, (value) => {
                if (value.type === "engine") {
                    if (value.engine) collectEngineIds(value.engine, ids);
                    for (const setting of value.engineSettings ?? []) {
                        if (setting.type === "resource") {
                            for (const resource of setting.resources)
                                ids.add(pathRefKey(resource.id));
                        }
                    }
                }
            }) && enginesTrusted;
    }
    trust("engines", enginesTrusted);

    const workspaceSchema = z.object({ tabs: z.array(tabSchema) }).passthrough();
    const tabsSchema = z.array(tabSchema);
    const consumeTabs = (tabs: z.output<typeof tabsSchema>) => {
        for (const tab of tabs) {
            if (tab.gameOrigin.kind === "file" || tab.gameOrigin.kind === "temp_file") {
                ids.add(pathRefKey(tab.gameOrigin.file.handle.id));
            } else if (tab.gameOrigin.kind === "database") {
                ids.add(pathRefKey(tab.gameOrigin.database.id));
            }
        }
    };
    let workspaceTrusted = collectOne(
        readCompressed(session, "workspace"),
        workspaceSchema,
        (value) => consumeTabs(value.tabs),
    );
    workspaceTrusted =
        collectOne(readCompressed(session, "tabs"), tabsSchema, consumeTabs) && workspaceTrusted;
    trust("sessionWorkspace", workspaceTrusted);

    trust(
        "expandedDirectories",
        collectOne(
            readJson(session, "expanded-directories"),
            z.array(z.string().min(1)),
            (values) => values.forEach((id) => ids.add(id)),
        ),
    );
    trust(
        "databaseView",
        collectOne(
            readJson(session, "database-view"),
            z
                .object({
                    state: z
                        .object({
                            database: z
                                .object({ file: databaseHandleSchema })
                                .passthrough()
                                .optional(),
                        })
                        .passthrough(),
                })
                .passthrough(),
            (value) =>
                value.state.database?.file && ids.add(pathRefKey(value.state.database.file.id)),
        ),
    );

    let deckTrusted = true;
    try {
        for (let index = 0; index < local.length; index++) {
            const key = local.key(index);
            if (!key?.startsWith("deck-")) continue;
            const match = /^deck-(.+)-(-?\d+)$/.exec(key);
            if (!match || !pathRefSchema.safeParse({ id: match[1] }).success) {
                deckTrusted = false;
                continue;
            }
            ids.add(match[1]);
        }
    } catch {
        deckTrusted = false;
    }
    trust("practiceDeck", deckTrusted);

    return {
        retainedIds: [...ids].sort().map((id) => ({ id })),
        trustedFamilies: [...trusted].sort(),
    };
}

export const originalPathOwnersSnapshot = collectOriginalPathOwners();

let initialization: Promise<void> | undefined;
export function initializePathOwners(): Promise<void> {
    const current = (initialization ??= tauri
        .reconcileStartupPathOwners(originalPathOwnersSnapshot)
        .then(() => undefined));
    return current;
}

export function resetPathOwnerInitializationForTests() {
    initialization = undefined;
}
