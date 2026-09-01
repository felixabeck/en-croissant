import { tauri } from "@/platform/tauri";
import { remoteHttp } from "@/platform/http";
import { runWithAppliedRecovery } from "@/platform/errors";
import type { Platform } from "@/platform/native";
import useSWR from "swr";
import { z } from "zod";
import {
    type BestMoves,
    type EngineHandle,
    type EngineImageHandle,
    type EngineResourceHandle,
    type EngineOption,
    type EngineOptions,
    type EngineRootHandle,
    type GoMode,
} from "@/bindings";

export const requiredEngineSettings = ["MultiPV", "Threads", "Hash"];

const goModeSchema: z.ZodSchema<GoMode> = z.union([
    z.object({
        t: z.literal("Depth"),
        c: z.number(),
    }),
    z.object({
        t: z.literal("Time"),
        c: z.number(),
    }),
    z.object({
        t: z.literal("Nodes"),
        c: z.number(),
    }),
    z.object({
        t: z.literal("Infinite"),
    }),
]);

const engineResourceHandleSchema: z.ZodType<EngineResourceHandle> = z.object({
    id: z.object({ id: z.string().min(1) }),
    kind: z.enum(["file", "directory"]),
    displayName: z.string().min(1),
});
const engineSettingsSchema: z.ZodType<EngineOption[]> = z.array(
    z.discriminatedUnion("type", [
        z.object({ type: z.literal("string"), name: z.string(), value: z.string() }),
        z.object({
            type: z.literal("resource"),
            name: z.string(),
            resources: z.array(engineResourceHandleSchema).min(1),
        }),
    ]),
);

export type EngineSettings = z.infer<typeof engineSettingsSchema>;

export function isEngineResourcePathOptionName(name: string): boolean {
    return name.toLocaleLowerCase().includes("path");
}

export function isEngineResourceFileOptionName(name: string): boolean {
    return name.toLocaleLowerCase().includes("file");
}

export function isEngineResourceOptionName(name: string): boolean {
    return isEngineResourcePathOptionName(name) || isEngineResourceFileOptionName(name);
}

export function engineOptionValue(option: EngineOption): string | undefined {
    return option.type === "string"
        ? option.value
        : option.resources.map((resource) => resource.displayName).join(":");
}

const persistedEngineSettingsSchema = engineSettingsSchema.transform((settings) => {
    const collapsed = new Map<string, EngineOption>();
    for (const option of settings) {
        collapsed.set(option.name, option);
    }
    return [...collapsed.values()].filter(
        (option) => option.type === "resource" || !isEngineResourceOptionName(option.name),
    );
});

const engineImageHandleSchema: z.ZodType<EngineImageHandle> = z.object({
    id: z.object({ id: z.string().min(1) }),
    kind: z.literal("engineImage"),
});

const engineHandleSchema: z.ZodType<EngineHandle> = z.object({
    id: z.object({ id: z.string().min(1) }),
    kind: z.literal("engine"),
});

const localEngineSchema = z.object({
    type: z.literal("local"),
    id: z.string().default(() => crypto.randomUUID()),
    name: z.string(),
    version: z.string(),
    handle: engineHandleSchema,
    filename: z.string().min(1),
    imageHandle: engineImageHandleSchema.nullish(),
    elo: z.number().nullish(),
    downloadSize: z.number().nullish(),
    downloadLink: z.string().nullish(),
    loaded: z.boolean().nullish(),
    go: goModeSchema.nullish(),
    enabled: z.boolean().nullish(),
    settings: persistedEngineSettingsSchema.nullish(),
});

export type LocalEngine = z.output<typeof localEngineSchema>;

export function isManifestEngineInstalled(
    installed: readonly LocalEngine[],
    manifest: { downloadLink?: string | null },
): boolean {
    const link = manifest.downloadLink;
    return Boolean(link) && installed.some((engine) => engine.downloadLink === link);
}

export function defaultEngineProgressId(downloadLink: string): string {
    return `engine:${downloadLink}`;
}

export function manifestEngineInstallCard(
    installed: readonly LocalEngine[],
    manifest: { downloadLink?: string | null },
): { progressId: string | null; initInstalled: boolean } {
    const link = manifest.downloadLink;
    if (!link) {
        return { progressId: null, initInstalled: false };
    }
    return {
        progressId: defaultEngineProgressId(link),
        initInstalled: isManifestEngineInstalled(installed, { downloadLink: link }),
    };
}

export async function registerInstalledEngineHandle(
    root: EngineRootHandle,
    relativePath: string,
): Promise<EngineHandle> {
    // A second register is get_or_create on the adopted path (a lookup), not a
    // retry of the registry write. Picker commands cannot recover this way.
    return runWithAppliedRecovery(
        () => tauri.registerInstalledEngine(root, relativePath),
        () => tauri.registerInstalledEngine(root, relativePath),
    );
}

/** Server manifest entry used only during installation; it is never persisted as an engine. */
export type DefaultEngine = Omit<LocalEngine, "handle" | "filename"> & {
    path: string;
    sha256: string;
    signature: string;
    imageUrl?: string;
};

/**
 * The manifest document is unsigned. Per-entry signatures authenticate only the download URL and
 * SHA-256, so path and other metadata remain untrusted until the backend validates them.
 */
export const defaultEngineManifestSchema = z
    .object({
        type: z.literal("local"),
        name: z.string().min(1),
        version: z.string(),
        path: z
            .string()
            .min(1)
            // DEFENCE IN DEPTH: mirror the backend's relative-component checks; the backend
            // remains the containment boundary (`src-tauri/src/infra/path_authority.rs`).
            .refine(
                (path) =>
                    !path.includes("\0") &&
                    !path.includes("\\") &&
                    !path.startsWith("/") &&
                    !/^[A-Za-z]:/.test(path) &&
                    !path.includes("//") &&
                    !path.endsWith("/") &&
                    path.split("/").every((segment) => segment !== "." && segment !== ".."),
                "path must contain only relative, non-traversing components",
            ),
        downloadLink: z.string().url(),
        sha256: z.string().regex(/^[a-fA-F0-9]{64}$/),
        signature: z.string().min(1),
        imageUrl: z.string().url().optional(),
        os: z.enum([
            "linux",
            "macos",
            "ios",
            "freebsd",
            "dragonfly",
            "netbsd",
            "openbsd",
            "solaris",
            "android",
            "windows",
        ]),
        bmi2: z.boolean(),
    })
    .passthrough();

const remoteEngineSchema = z.object({
    type: z.enum(["chessdb", "lichess"]),
    id: z.string().default(() => crypto.randomUUID()),
    name: z.string(),
    url: z.string(),
    imageHandle: engineImageHandleSchema.nullish(),
    loaded: z.boolean().nullish(),
    enabled: z.boolean().nullish(),
    go: goModeSchema.nullish(),
    settings: persistedEngineSettingsSchema.nullish(),
});

export type RemoteEngine = z.output<typeof remoteEngineSchema>;

export const engineSchema = z.union([localEngineSchema, remoteEngineSchema]);
export type Engine = z.output<typeof engineSchema>;

export function parsePersistedEngineJson(value: string) {
    let parsed: unknown;
    try {
        parsed = JSON.parse(value);
    } catch {
        return { success: false as const };
    }
    return engineSchema.safeParse(parsed);
}

export async function stopEngine(engine: LocalEngine, tab: string): Promise<void> {
    await tauri.stopEngine(engine.id, tab);
}

export async function killEngine(engine: LocalEngine, tab: string): Promise<void> {
    await tauri.killEngine(engine.id, tab);
}

export async function retireEngine(engine: LocalEngine): Promise<void> {
    await tauri.retireEngine(engine.id);
}

export function getBestMoves(
    engine: LocalEngine,
    tab: string,
    goMode: GoMode,
    options: EngineOptions,
): Promise<[number, BestMoves[]] | null> {
    return tauri.getBestMoves(engine.id, engine.handle, tab, goMode, options);
}

export function useDefaultEngines(os: Platform | undefined, opened: boolean) {
    const { data, error, isLoading } = useSWR(opened ? os : null, async (os: Platform) => {
        const bmi2: boolean = await tauri.isBmi2Compatible();
        // The manifest document is unsigned: per-entry signatures authenticate only
        // `${downloadLink}\n${sha256}`; `path` and the other metadata are not covered.
        const url = new URL("/engines", "https://www.encroissant.org");
        url.searchParams.set("os", os);
        url.searchParams.set("bmi2", String(bmi2));
        const data = await remoteHttp.get(url.toString(), {
            schema: z.array(defaultEngineManifestSchema),
        });
        return data.filter(
            (engine) => engine.os === os && engine.bmi2 === bmi2,
        ) as unknown as DefaultEngine[];
    });
    return {
        defaultEngines: data,
        error,
        isLoading,
    };
}

export async function installDefaultEngine(
    engine: DefaultEngine,
    progressId: string,
): Promise<LocalEngine> {
    const url = engine.downloadLink;
    if (!url) {
        throw new Error("engine download link is required");
    }
    const root = await tauri.getEngineWorkspace();
    const destination = await tauri.engineArchiveDestination(root);
    const archiveName = url.slice(url.lastIndexOf("/") + 1);
    await tauri.downloadEngineArchive(
        progressId,
        url,
        destination,
        archiveName,
        crypto.randomUUID(),
        {
            sha256: engine.sha256,
            signature: engine.signature,
        },
    );
    const handle = await registerInstalledEngineHandle(root, engine.path);
    const config = await tauri.getEngineConfig(handle);
    return {
        ...engine,
        id: crypto.randomUUID(),
        type: "local",
        handle,
        filename: engine.path.split("/").at(-1) || engine.name,
        loaded: true,
        settings: config.options
            .filter((option) => requiredEngineSettings.includes(option.value.name))
            .map((option) => ({
                type: "string" as const,
                name: option.value.name,
                value: String("default" in option.value ? (option.value.default ?? "") : ""),
            })),
    };
}
