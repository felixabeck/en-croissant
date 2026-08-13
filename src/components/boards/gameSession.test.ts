import { expect, test, vi } from "vitest";
import {
    abortExactTabGame,
    isCurrentQueuedGameUpdate,
    isLiveGameSession,
    nextAcceptedGameRevision,
    SingleFlightGuard,
} from "./gameSession";

test("accepts a newer revision once and rejects equal or out-of-order payloads", () => {
    expect(
        nextAcceptedGameRevision(BigInt(-1), BigInt(7), {
            session: BigInt(7),
            revision: BigInt(4),
        }),
    ).toBe(BigInt(4));
    expect(
        nextAcceptedGameRevision(BigInt(4), BigInt(7), { session: BigInt(7), revision: BigInt(4) }),
    ).toBeNull();
    expect(
        nextAcceptedGameRevision(BigInt(4), BigInt(7), { session: BigInt(7), revision: BigInt(3) }),
    ).toBeNull();
});

test("rejects malformed and revisionless payloads", () => {
    for (const payload of [null, "stale-event", { revision: BigInt(5) }, { session: BigInt(7) }]) {
        expect(nextAcceptedGameRevision(BigInt(4), BigInt(7), payload)).toBeNull();
    }
    expect(
        nextAcceptedGameRevision(BigInt(4), BigInt(7), {
            session: BigInt(7),
            revision: BigInt(-1),
        }),
    ).toBeNull();
    expect(
        nextAcceptedGameRevision(BigInt(4), BigInt(7), { session: BigInt(7), revision: 4 }),
    ).toBeNull();
    expect(nextAcceptedGameRevision(BigInt(4), BigInt(7), {})).toBeNull();
    expect(
        nextAcceptedGameRevision(BigInt(4), BigInt(7), { session: BigInt(8), revision: BigInt(5) }),
    ).toBeNull();
});

test("accepts zero-valued revisions and sessions, but rejects every invalid scalar boundary", () => {
    expect(
        nextAcceptedGameRevision(BigInt(-1), BigInt(0), {
            session: BigInt(0),
            revision: BigInt(0),
        }),
    ).toBe(BigInt(0));
    expect(
        nextAcceptedGameRevision(BigInt(-1), null, { session: BigInt(99), revision: BigInt(1) }),
    ).toBeNull();
    expect(
        nextAcceptedGameRevision(
            BigInt(-1),
            null,
            { session: BigInt(99), revision: BigInt(1) },
            true,
        ),
    ).toBe(BigInt(1));

    expect(
        nextAcceptedGameRevision(BigInt(-1), BigInt(7), { session: BigInt(7), revision: "5" }),
    ).toBeNull();

    expect(
        nextAcceptedGameRevision(BigInt(-2), BigInt(7), {
            session: BigInt(7),
            revision: BigInt(-1),
        }),
    ).toBeNull();
    expect(
        nextAcceptedGameRevision(BigInt(-1), BigInt(-1), {
            session: BigInt(-1),
            revision: BigInt(5),
        }),
    ).toBeNull();
    expect(
        nextAcceptedGameRevision(BigInt(-1), null, { session: 7, revision: BigInt(5) }),
    ).toBeNull();
});

test("terminal move and terminal outcome converge in either arrival order", () => {
    const moveRevision = BigInt(11);
    const gameOverRevision = BigInt(12);

    // Normal human/engine delivery: move, then game-over.
    expect(
        nextAcceptedGameRevision(BigInt(-1), BigInt(7), {
            session: BigInt(7),
            revision: moveRevision,
        }),
    ).toBe(moveRevision);
    expect(
        nextAcceptedGameRevision(moveRevision, BigInt(7), {
            session: BigInt(7),
            revision: gameOverRevision,
        }),
    ).toBe(gameOverRevision);

    // A reordered terminal event wins; its predecessor cannot reopen the game.
    expect(
        nextAcceptedGameRevision(BigInt(-1), BigInt(7), {
            session: BigInt(7),
            revision: gameOverRevision,
        }),
    ).toBe(gameOverRevision);
    expect(
        nextAcceptedGameRevision(gameOverRevision, BigInt(7), {
            session: BigInt(7),
            revision: moveRevision,
        }),
    ).toBeNull();
});

test("poll results cannot cross a session handoff or cancellation", () => {
    expect(isLiveGameSession("board-game-2", "board-game-2", false)).toBe(true);
    expect(isLiveGameSession("board-game-3", "board-game-2", false)).toBe(false);
    expect(isLiveGameSession("board-game-2", "board-game-2", true)).toBe(false);
});

test("a pending move from the replaced session cannot apply after New Game", () => {
    // New Game first cancels the queue, then increments its local generation and
    // clears the authoritative session. A timer that was already queued must fail
    // this final gate, even if its callback runs after the handoff.
    expect(isCurrentQueuedGameUpdate(4, 4, BigInt(9), BigInt(9))).toBe(true);
    expect(isCurrentQueuedGameUpdate(4, 5, BigInt(9), BigInt(9))).toBe(false);
    expect(isCurrentQueuedGameUpdate(4, 4, BigInt(9), BigInt(10))).toBe(false);
    expect(isCurrentQueuedGameUpdate(null, 4, null, BigInt(9))).toBe(false);
});

test("events cannot adopt a cleared session during a replacement start", () => {
    expect(
        nextAcceptedGameRevision(BigInt(4), null, { session: BigInt(9), revision: BigInt(5) }),
    ).toBeNull();
});

test("a command guard permits exactly one takeback until its first attempt settles", () => {
    const guard = new SingleFlightGuard();
    expect(guard.acquire()).toBe(true);
    expect(guard.acquire()).toBe(false);
    guard.release();
    expect(guard.acquire()).toBe(true);
});

test("tab cleanup aborts the stored live game id, never a synthetic tab suffix", async () => {
    const abort = vi.fn(async () => undefined);
    await expect(
        abortExactTabGame(
            "tab-a",
            () => "tab-a-game-7",
            () => BigInt(7),
            abort,
        ),
    ).resolves.toBe("tab-a-game-7");
    expect(abort).toHaveBeenCalledWith("tab-a-game-7", BigInt(7));
    await expect(
        abortExactTabGame(
            "tab-b",
            () => null,
            () => null,
            abort,
        ),
    ).resolves.toBeNull();
    await expect(
        abortExactTabGame(
            "tab-c",
            () => "tab-c-game-2",
            () => null,
            abort,
        ),
    ).resolves.toBeNull();
    expect(abort).toHaveBeenCalledTimes(1);
});
