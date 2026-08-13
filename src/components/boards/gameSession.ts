/** Payload ordering rules shared by commands, event listeners, and polling. */
export function nextAcceptedGameRevision(
    previous: bigint,
    expectedSession: bigint | null,
    payload: unknown,
    allowSessionAdoption = false,
): bigint | null {
    if (
        !payload ||
        typeof payload !== "object" ||
        !("revision" in payload) ||
        !("session" in payload)
    ) {
        return null;
    }
    const revision = payload.revision;
    const session = payload.session;
    if (
        typeof revision !== "bigint" ||
        revision < BigInt(0) ||
        typeof session !== "bigint" ||
        session < BigInt(0) ||
        (expectedSession === null && !allowSessionAdoption) ||
        (expectedSession !== null && session !== expectedSession)
    ) {
        return null;
    }
    return revision > previous ? revision : null;
}

export function isLiveGameSession(
    activeGameId: string | null,
    candidateGameId: string,
    cancelled: boolean,
): boolean {
    return !cancelled && activeGameId === candidateGameId;
}

/** A throttled renderer update belongs to exactly one native game session. */
export function isCurrentQueuedGameUpdate(
    queuedGeneration: number | null,
    currentGeneration: number,
    queuedSession: bigint | null,
    currentSession: bigint | null,
): boolean {
    return (
        queuedGeneration !== null &&
        queuedGeneration === currentGeneration &&
        queuedSession !== null &&
        queuedSession === currentSession
    );
}

/** Synchronous acquisition closes the double-click gap before React renders pending UI. */
export class SingleFlightGuard {
    #active = false;

    acquire(): boolean {
        if (this.#active) return false;
        this.#active = true;
        return true;
    }

    release(): void {
        this.#active = false;
    }
}

export async function abortExactTabGame(
    tabId: string,
    getGameId: (tabId: string) => string | null,
    getSession: (tabId: string) => bigint | null,
    abort: (gameId: string, expectedSession: bigint) => Promise<unknown>,
): Promise<string | null> {
    const gameId = getGameId(tabId);
    const session = getSession(tabId);
    if (!gameId || session === null) return null;
    await abort(gameId, session);
    return gameId;
}
