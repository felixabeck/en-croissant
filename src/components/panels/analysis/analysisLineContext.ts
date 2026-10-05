import type { GoMode } from "@/bindings";
import type { Engine, EngineSettings } from "@/utils/engines";

// Replacing the handle or URL changes the executable identity under the same engine id.
export function engineIdentity(engine: Engine): string {
    return JSON.stringify(
        engine.type === "local"
            ? { type: engine.type, id: engine.id, handle: engine.handle }
            : { type: engine.type, id: engine.id, url: engine.url },
    );
}

/** Only settings that affect computed lines invalidate remembered analysis. */
export function engineLineContext(
    settings: { settings: EngineSettings; go: GoMode },
    engine: Engine,
): string {
    return JSON.stringify([
        JSON.stringify({ settings: settings.settings, go: settings.go }),
        engineIdentity(engine),
    ]);
}
