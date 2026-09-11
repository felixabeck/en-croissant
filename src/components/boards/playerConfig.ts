import type { PlayerConfig } from "@/bindings";
import type { OpponentSettings } from "./OpponentForm";

/** A player configuration was incomplete before it could be sent to the backend. */
export class MissingLocalEngineError extends Error {
    readonly code = "missing-local-engine" as const;

    constructor(diagnostic = "A local engine must be selected for an engine player") {
        super(diagnostic);
        this.name = "MissingLocalEngineError";
    }
}

/**
 * Maps the form's opponent settings onto the backend's player contract.
 *
 * `engineId` carries the immutable application id rather than the path handle, so a result
 * arriving later stays bound to the engine that was actually asked. MultiPV is dropped because
 * a game engine plays one move, and a time control makes `go` the backend's decision.
 */
export function toPlayerConfig(settings: OpponentSettings): PlayerConfig {
    if (settings.type === "human") {
        return {
            type: "human",
            name: settings.name ?? "Player",
        };
    }
    if (!settings.engine || settings.engine.type !== "local") {
        throw new MissingLocalEngineError();
    }
    return {
        type: "engine",
        name: settings.engine.name ?? "Engine",
        engineId: settings.engine.id,
        handle: settings.engine.handle,
        options: (settings.engineSettings ?? settings.engine.settings ?? [])
            .filter((setting) => setting.name !== "MultiPV")
            .map((setting) =>
                setting.type === "resource"
                    ? setting
                    : { ...setting, value: setting.value.toString() },
            ),
        go: settings.timeControl ? null : settings.go,
    };
}
