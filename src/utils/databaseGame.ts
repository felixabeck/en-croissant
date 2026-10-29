import type { DatabaseHandle, NormalizedGame } from "@/bindings";
import type { createTab } from "./tabs";

/** Keep all headers and the qualified linked occurrence on every database opening path. */
export function databaseGameSeed(
    game: NormalizedGame,
    database?: DatabaseHandle | null,
): Omit<Parameters<typeof createTab>[0], "setTabs"> {
    return {
        tab: { name: `${game.white} - ${game.black}`, type: "analysis" },
        pgn: game.moves,
        headers: game,
        gameOrigin: database
            ? {
                  kind: "database",
                  database,
                  gameId: game.id,
                  linked: game.linked ?? undefined,
              }
            : undefined,
    };
}
