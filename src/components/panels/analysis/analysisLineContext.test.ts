import { expect, test } from "vitest";
import type { Engine } from "@/utils/engines";
import { engineIdentity, engineLineContext } from "./analysisLineContext";

const local = {
    type: "local" as const,
    id: "engine-1",
    name: "Stockfish",
    version: "17",
    filename: "stockfish",
    handle: { id: { id: "handle-1" }, kind: "engine" as const },
};
const settings = { enabled: true, synced: true, settings: [], go: { t: "Infinite" as const } };

test("line context includes options, go mode and executable identity, excluding enabled and synced", () => {
    const context = engineLineContext(settings, local);
    const paused = { ...settings, enabled: false, synced: false };
    expect(engineLineContext(paused, local)).toBe(context);
    expect(
        engineLineContext(
            { ...settings, settings: [{ type: "string", name: "Hash", value: "256" }] },
            local,
        ),
    ).not.toBe(context);
    expect(engineLineContext({ ...settings, go: { t: "Depth", c: 20 } }, local)).not.toBe(context);
    expect(engineLineContext(settings, { ...local, name: "Renamed", loaded: false })).toBe(context);
    expect(
        engineLineContext(settings, {
            ...local,
            handle: { ...local.handle, id: { id: "replacement" } },
        }),
    ).not.toBe(context);
    expect(engineLineContext(settings, { ...local, id: "engine-2" })).not.toBe(context);
});

test("engine identity keeps same-name and same-handle engines independent and binds remote URLs", () => {
    expect(engineIdentity({ ...local, id: "engine-2" })).not.toBe(engineIdentity(local));
    const remote: Engine = {
        type: "chessdb",
        id: local.id,
        name: local.name,
        url: "https://example.test",
    };
    expect(engineIdentity(remote)).not.toBe(engineIdentity(local));
    expect(engineIdentity({ ...remote, url: "https://replacement.test" })).not.toBe(
        engineIdentity(remote),
    );
    expect(engineIdentity({ ...remote, name: "Renamed" })).toBe(engineIdentity(remote));
    expect(engineIdentity({ ...remote, type: "lichess" })).not.toBe(engineIdentity(remote));
});
