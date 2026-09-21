import type { PlayerConfig } from "@/bindings";
import { normalizeEngineOptions } from "@/components/engines/engineOptions";
import type { Engine } from "@/utils/engines";
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
 *
 * `availableEngines` is the live engine list and is authoritative: removing an engine
 * permanently retires its application id (d-20260901-17), so a selection that survived the
 * removal — or one that cannot be proven live because the list has not hydrated yet
 * (`undefined`) — is rejected here rather than sent to a supervisor that will refuse it.
 */
export function toPlayerConfig(
    settings: OpponentSettings,
    availableEngines: readonly Engine[] | undefined,
): PlayerConfig {
    if (settings.type === "human") {
        return {
            type: "human",
            name: settings.name ?? "Player",
        };
    }
    const engine = settings.engine;
    if (!engine || engine.type !== "local") {
        throw new MissingLocalEngineError();
    }
    if (!availableEngines?.some((known) => known.type === "local" && known.id === engine.id)) {
        throw new MissingLocalEngineError(
            "The selected local engine is not in the current engine list",
        );
    }
    return {
        type: "engine",
        name: engine.name ?? "Engine",
        engineId: engine.id,
        handle: engine.handle,
        options: normalizeEngineOptions(settings.engineSettings ?? engine.settings ?? []).filter(
            (setting) => setting.name !== "MultiPV",
        ),
        go: settings.timeControl ? null : settings.go,
    };
}
