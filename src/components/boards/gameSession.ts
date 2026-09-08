import { normalizeError } from "@/platform/errors";

/**
 * A throttled renderer update belongs to exactly one native game session.
 *
 * The asymmetry between the two null checks is deliberate, so do not "restore" it:
 * `currentGeneration` is a plain counter that is never null (`useRef(0)` in `BoardGame`),
 * so `queuedGeneration === currentGeneration` already excludes a null queue on its own.
 * `currentSession` really can be null — it is cleared during a session handoff — so without
 * the explicit check a queued update carrying no session would compare `null === null` and
 * be accepted as current, which is exactly the stale update this gate exists to reject.
 */
export function isCurrentQueuedGameUpdate(
    queuedGeneration: number | null,
    currentGeneration: number,
    queuedSession: bigint | null,
    currentSession: bigint | null,
): boolean {
    return (
        queuedGeneration === currentGeneration &&
        queuedSession !== null &&
        queuedSession === currentSession
    );
}

/** Synchronous acquisition closes the double-click gap before React renders pending UI. */
export class SingleFlightGuard<T = symbol> {
    #active: T | null = null;

    acquire(token: T): boolean {
        if (this.#active !== null) return false;
        this.#active = token;
        return true;
    }

    owns(token: T): boolean {
        return this.#active === token;
    }

    release(token: T): boolean {
        if (!this.owns(token)) return false;
        this.#active = null;
        return true;
    }
}

export async function abortExactGame(
    gameId: string,
    session: bigint,
    abort: (gameId: string, expectedSession: bigint) => Promise<unknown>,
): Promise<void> {
    try {
        await abort(gameId, session);
    } catch (error) {
        if (normalizeError(error).backendCategory !== "missing-resource") throw error;
    }
}

export async function abortExactTabGame(
    tabId: string,
    getGameId: (tabId: string) => string | null,
    getSession: (tabId: string) => bigint | null,
    abort: (gameId: string, expectedSession: bigint) => Promise<unknown>,
    clear?: (gameId: string, session: bigint) => void,
): Promise<string | null> {
    const gameId = getGameId(tabId);
    const session = getSession(tabId);
    if (!gameId || session === null) return null;
    await abortExactGame(gameId, session, abort);
    clear?.(gameId, session);
    return gameId;
}
