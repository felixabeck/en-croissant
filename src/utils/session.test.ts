import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    migrateLegacyLichessToken: vi.fn(),
    revokeLegacyLichessToken: vi.fn(),
    listLichessAccounts: vi.fn(),
    getLichessAccount: vi.fn(),
}));

vi.mock("@/bindings/generated", () => ({
    commands: {
        migrateLegacyLichessToken: mocks.migrateLegacyLichessToken,
        revokeLegacyLichessToken: mocks.revokeLegacyLichessToken,
        listLichessAccounts: mocks.listLichessAccounts,
    },
}));
vi.mock("@/utils/lichess/api", () => ({ getLichessAccount: mocks.getLichessAccount }));

import {
    initializePersistedSessions,
    sessionPlayerName,
    SessionSanitizationError,
} from "./session";

beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    vi.clearAllMocks();
    mocks.listLichessAccounts.mockResolvedValue([]);
    mocks.revokeLegacyLichessToken.mockReset().mockResolvedValue({ status: "ok", data: "revoked" });
});

test("session player names prefer the alias, then Lichess, then Chess.com, then empty", () => {
    const session = {
        player: "Alias",
        updatedAt: 1,
        lichess: { username: "lichess", account: { id: "account", username: "Account" } },
        chessCom: { username: "chesscom", stats: {} },
    };
    expect(sessionPlayerName(session)).toBe("Alias");
    expect(sessionPlayerName({ ...session, player: undefined })).toBe("lichess");
    expect(sessionPlayerName({ ...session, player: "" })).toBe("lichess");
    expect(sessionPlayerName({ ...session, player: undefined, lichess: undefined })).toBe(
        "chesscom",
    );
    expect(sessionPlayerName({ updatedAt: 1 })).toBe("");
});

describe("initializePersistedSessions", () => {
    test("persists one card for a listed native account after a successful profile read", async () => {
        const profile = { id: "player", username: "Player", count: { all: 42 } };
        mocks.listLichessAccounts.mockResolvedValue([
            { username: "Player", handle: "native-handle" },
        ]);
        mocks.getLichessAccount.mockResolvedValue(profile);

        await expect(initializePersistedSessions()).resolves.toBeUndefined();
        await expect(initializePersistedSessions()).resolves.toBeUndefined();

        expect(JSON.parse(localStorage.getItem("sessions")!)).toEqual([
            {
                player: "Player",
                updatedAt: expect.any(Number),
                lichess: { username: "Player", handle: "native-handle", account: profile },
            },
        ]);
        expect(mocks.getLichessAccount).toHaveBeenCalledExactlyOnceWith({
            handle: "native-handle",
        });
    });

    test.each(["rejects", "resolves null"])(
        "resolves without persisting a new card when the profile read %s",
        async (outcome) => {
            mocks.listLichessAccounts.mockResolvedValue([
                { username: "Player", handle: "native-handle" },
            ]);
            if (outcome === "rejects") {
                mocks.getLichessAccount.mockRejectedValue(new Error("Lichess account read failed"));
            } else {
                mocks.getLichessAccount.mockResolvedValue(null);
            }

            await expect(initializePersistedSessions()).resolves.toBeUndefined();

            expect(JSON.parse(localStorage.getItem("sessions")!)).toEqual([]);
            expect(mocks.getLichessAccount).toHaveBeenCalledExactlyOnceWith({
                handle: "native-handle",
            });
        },
    );

    function seedLegacySessions(tokens: string[]) {
        localStorage.setItem(
            "sessions",
            JSON.stringify(
                tokens.map((accessToken, index) => ({
                    updatedAt: 1,
                    lichess: {
                        username: `private-player-${index}`,
                        account: { id: `private-player-${index}` },
                        accessToken,
                    },
                })),
            ),
        );
    }

    function refuseSessionErasure() {
        const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
            throw new DOMException("quota exceeded", "QuotaExceededError");
        });
        const removeItem = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
            throw new DOMException("storage refused", "SecurityError");
        });
        return { setItem, removeItem };
    }

    test("revokes each unerased token before rejecting with only a safe summary", async () => {
        const tokens = ["first-private-token", "second-private-token"];
        seedLegacySessions(tokens);
        const original = localStorage.getItem("sessions");
        const erasure = refuseSessionErasure();
        let finishRevocation!: (value: unknown) => void;
        mocks.revokeLegacyLichessToken.mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    finishRevocation = resolve;
                }),
        );
        const startup = initializePersistedSessions();
        let settled = false;
        const outcome = startup.then(
            () => {
                settled = true;
                return null;
            },
            (cause: unknown) => {
                settled = true;
                return cause;
            },
        );
        expect(mocks.revokeLegacyLichessToken.mock.calls).toEqual(tokens.map((token) => [token]));
        expect(mocks.migrateLegacyLichessToken).not.toHaveBeenCalled();
        expect(mocks.listLichessAccounts).not.toHaveBeenCalled();
        await Promise.resolve();
        expect(settled).toBe(false);
        finishRevocation({ status: "ok", data: "already_invalid" });
        const error = await outcome;
        expect(error).toBeInstanceOf(SessionSanitizationError);
        expect(error).toMatchObject({
            legacySignInFound: true,
            allRevoked: true,
            unresolvedReasons: [],
        });
        for (const sensitive of [...tokens, "private-player-0", "private-player-1"]) {
            expect(String(error)).not.toContain(sensitive);
            expect((error as SessionSanitizationError).stack).not.toContain(sensitive);
            expect(JSON.stringify(error)).not.toContain(sensitive);
        }
        expect(mocks.migrateLegacyLichessToken).not.toHaveBeenCalled();
        expect(mocks.listLichessAccounts).not.toHaveBeenCalled();
        expect(mocks.getLichessAccount).not.toHaveBeenCalled();
        expect(erasure.setItem).toHaveBeenCalledTimes(1);
        expect(erasure.removeItem).toHaveBeenCalledExactlyOnceWith("sessions");
        expect(erasure.setItem.mock.invocationCallOrder[0]).toBeLessThan(
            erasure.removeItem.mock.invocationCallOrder[0],
        );
        expect(localStorage.getItem("sessions")).toBe(original);
    });

    test("catches a revoke rejection and still attempts every other token", async () => {
        seedLegacySessions(["failed-private-token", "revoked-private-token"]);
        refuseSessionErasure();
        mocks.revokeLegacyLichessToken.mockRejectedValueOnce(new Error("failed-private-token"));
        await expect(initializePersistedSessions()).rejects.toMatchObject({
            name: "SessionSanitizationError",
            legacySignInFound: true,
            allRevoked: false,
            unresolvedReasons: ["unconfirmed"],
        });
        expect(mocks.revokeLegacyLichessToken.mock.calls).toEqual([
            ["failed-private-token"],
            ["revoked-private-token"],
        ]);
        expect(mocks.migrateLegacyLichessToken).not.toHaveBeenCalled();
        expect(mocks.listLichessAccounts).not.toHaveBeenCalled();
        expect(mocks.getLichessAccount).not.toHaveBeenCalled();
    });

    test("treats a native error result as unconfirmed revocation", async () => {
        seedLegacySessions(["native-error-private-token"]);
        refuseSessionErasure();
        mocks.revokeLegacyLichessToken.mockResolvedValueOnce({
            status: "error",
            error: "unavailable",
        });
        await expect(initializePersistedSessions()).rejects.toMatchObject({
            name: "SessionSanitizationError",
            legacySignInFound: true,
            allRevoked: false,
        });
    });

    test("retains only distinct sanitized reasons across every provider outcome and IPC rejection", async () => {
        const tokens = Array.from({ length: 8 }, (_, index) => `private-token-${index}`);
        seedLegacySessions(tokens);
        refuseSessionErasure();
        const consoleError = vi.spyOn(console, "error");
        const consoleWarn = vi.spyOn(console, "warn");
        for (const outcome of [
            "already_invalid",
            "revoked",
            "rejected",
            "unreachable",
            "rate_limited",
            "rejected",
            "unreachable",
        ]) {
            mocks.revokeLegacyLichessToken.mockResolvedValueOnce({ status: "ok", data: outcome });
        }
        mocks.revokeLegacyLichessToken.mockRejectedValueOnce(new Error(tokens[7]));
        const error = await initializePersistedSessions().catch((cause: unknown) => cause);
        expect(error).toMatchObject({
            legacySignInFound: true,
            allRevoked: false,
            unresolvedReasons: ["unreachable", "rate_limited", "rejected", "unconfirmed"],
        });
        expect(mocks.revokeLegacyLichessToken.mock.calls).toEqual(tokens.map((token) => [token]));
        expect(mocks.migrateLegacyLichessToken).not.toHaveBeenCalled();
        expect(mocks.listLichessAccounts).not.toHaveBeenCalled();
        expect(mocks.getLichessAccount).not.toHaveBeenCalled();
        expect(consoleError).not.toHaveBeenCalled();
        expect(consoleWarn).not.toHaveBeenCalled();
        expect(JSON.stringify(error)).not.toMatch(/private-token|private-player/);
    });

    test("reports nothing found and skips revocation when storage has no legacy token", async () => {
        refuseSessionErasure();
        await expect(initializePersistedSessions()).rejects.toMatchObject({
            name: "SessionSanitizationError",
            legacySignInFound: false,
            allRevoked: true,
        });
        expect(mocks.revokeLegacyLichessToken).not.toHaveBeenCalled();
        expect(mocks.migrateLegacyLichessToken).not.toHaveBeenCalled();
        expect(mocks.listLichessAccounts).not.toHaveBeenCalled();
        expect(mocks.getLichessAccount).not.toHaveBeenCalled();
    });

    test("revokes a read token even when its record cannot be migrated", async () => {
        localStorage.setItem(
            "sessions",
            JSON.stringify([{ lichess: { accessToken: "malformed-private-token" } }]),
        );
        refuseSessionErasure();
        await expect(initializePersistedSessions()).rejects.toMatchObject({
            legacySignInFound: true,
            allRevoked: true,
        });
        expect(mocks.revokeLegacyLichessToken).toHaveBeenCalledExactlyOnceWith(
            "malformed-private-token",
        );
        expect(mocks.migrateLegacyLichessToken).not.toHaveBeenCalled();
    });

    test("retries sanitization and migrates exactly once when storage works on the next call", async () => {
        seedLegacySessions(["retry-private-token"]);
        const erasure = refuseSessionErasure();
        await expect(initializePersistedSessions()).rejects.toBeInstanceOf(
            SessionSanitizationError,
        );
        erasure.setItem.mockRestore();
        erasure.removeItem.mockRestore();
        mocks.migrateLegacyLichessToken.mockImplementation(async () => {
            expect(localStorage.getItem("sessions")).not.toContain("retry-private-token");
            expect(localStorage.getItem("sessions")).not.toContain("accessToken");
            return { status: "error", error: "revoked token" };
        });
        await initializePersistedSessions();
        await initializePersistedSessions();
        expect(mocks.migrateLegacyLichessToken).toHaveBeenCalledExactlyOnceWith(
            "private-player-0",
            "retry-private-token",
        );
        expect(mocks.revokeLegacyLichessToken).toHaveBeenCalledTimes(1);
    });

    test.each(["successful", "failed"])(
        "reconciles the opaque handle returned by a successful migration with %s listing",
        async (listing) => {
            localStorage.setItem(
                "sessions",
                JSON.stringify([
                    {
                        player: "player",
                        updatedAt: 1,
                        lichess: {
                            username: "player",
                            account: { id: "player", username: "player" },
                            accessToken: "legacy-token",
                        },
                    },
                ]),
            );
            mocks.migrateLegacyLichessToken.mockResolvedValue({
                account: { username: "player", handle: "migrated-handle" },
                durability_uncertain: false,
            });
            if (listing === "successful") {
                mocks.listLichessAccounts.mockResolvedValue([
                    { username: "PLAYER", handle: "migrated-handle" },
                ]);
            } else {
                mocks.listLichessAccounts.mockRejectedValue(new Error("native unavailable"));
            }
            await initializePersistedSessions();

            const sessions = JSON.parse(localStorage.getItem("sessions")!);
            expect(sessions[0].lichess.handle).toBe("migrated-handle");
            expect(mocks.revokeLegacyLichessToken).not.toHaveBeenCalled();
        },
    );

    test.each([
        { source: "persisted", populated: false },
        { source: "persisted", populated: true },
        { source: "earlier-migrated", populated: false },
        { source: "earlier-migrated", populated: true },
    ])(
        "confirmed absence clears a $source handle and cannot restore it on reload (populated: $populated)",
        async ({ source, populated }) => {
            const publicSession = {
                player: "Player alias",
                updatedAt: 123,
                lichess: {
                    username: "Player",
                    account: {
                        id: "player",
                        username: "Player",
                        perfs: { blitz: { rating: 1800 } },
                    },
                },
                chessCom: { username: "OtherProvider", stats: {} },
            };
            const matchingSession = {
                updatedAt: 456,
                lichess: { username: "Present", account: { id: "present", username: "Present" } },
            };
            localStorage.setItem(
                "sessions",
                JSON.stringify([
                    {
                        ...publicSession,
                        lichess: {
                            ...publicSession.lichess,
                            ...(source === "persisted"
                                ? { handle: "stale-handle" }
                                : { accessToken: "legacy-token" }),
                        },
                    },
                    matchingSession,
                ]),
            );
            mocks.migrateLegacyLichessToken.mockResolvedValue({
                account: { username: "PLAYER", handle: "earlier-migrated-handle" },
                durability_uncertain: false,
            });
            mocks.listLichessAccounts.mockResolvedValue(
                populated ? [{ username: "PRESENT", handle: "present-handle" }] : [],
            );

            await initializePersistedSessions();
            const expected = [
                publicSession,
                {
                    ...matchingSession,
                    lichess: {
                        ...matchingSession.lichess,
                        ...(populated ? { handle: "present-handle" } : {}),
                    },
                },
            ];
            expect(JSON.parse(localStorage.getItem("sessions")!)).toEqual(expected);
            expect(mocks.getLichessAccount).not.toHaveBeenCalled();

            await initializePersistedSessions();
            expect(JSON.parse(localStorage.getItem("sessions")!)).toEqual(expected);
            mocks.listLichessAccounts.mockRejectedValue(new Error("offline on reload"));
            await initializePersistedSessions();
            expect(JSON.parse(localStorage.getItem("sessions")!)).toEqual(expected);
            expect(mocks.migrateLegacyLichessToken).toHaveBeenCalledTimes(
                source === "persisted" ? 0 : 1,
            );
            expect(localStorage.getItem("sessions")).not.toContain("legacy-token");
        },
    );

    test("a later successful listing replaces an earlier migrated handle", async () => {
        seedLegacySessions(["legacy-token"]);
        mocks.migrateLegacyLichessToken.mockResolvedValue({
            account: { username: "private-player-0", handle: "earlier-handle" },
            durability_uncertain: false,
        });
        mocks.listLichessAccounts.mockResolvedValue([
            { username: "PRIVATE-PLAYER-0", handle: "latest-handle" },
        ]);

        await initializePersistedSessions();

        expect(JSON.parse(localStorage.getItem("sessions")!)[0].lichess.handle).toBe(
            "latest-handle",
        );
    });

    test("a failed listing preserves the offline public session and opaque handle across reload", async () => {
        const session = {
            player: "Alias",
            updatedAt: 123,
            lichess: {
                username: "Player",
                handle: "offline-handle",
                account: { id: "player", username: "Player" },
            },
            chessCom: { username: "OtherProvider", stats: {} },
        };
        localStorage.setItem("sessions", JSON.stringify([session]));
        mocks.listLichessAccounts.mockRejectedValue(new Error("native unavailable"));

        await initializePersistedSessions();
        await initializePersistedSessions();

        expect(JSON.parse(localStorage.getItem("sessions")!)).toEqual([session]);
    });

    test("removes credential storage when the sanitized overwrite fails", async () => {
        localStorage.setItem(
            "sessions",
            JSON.stringify([
                {
                    updatedAt: 1,
                    lichess: {
                        username: "player",
                        account: { id: "player" },
                        accessToken: "credential-that-must-be-removed",
                    },
                },
            ]),
        );
        vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
            throw new DOMException("quota exceeded", "QuotaExceededError");
        });
        mocks.migrateLegacyLichessToken.mockResolvedValue({
            status: "error",
            error: "unavailable",
        });
        await initializePersistedSessions();

        expect(localStorage.getItem("sessions")).not.toContain("credential-that-must-be-removed");
        expect(mocks.revokeLegacyLichessToken).not.toHaveBeenCalled();
    });

    test("scrubs a token even when a sibling record is malformed", async () => {
        localStorage.setItem(
            "sessions",
            JSON.stringify([
                null,
                {
                    player: "player",
                    updatedAt: 1,
                    lichess: {
                        username: "player",
                        account: { id: "player", username: "player" },
                        accessToken: "legacy-secret-among-malformed-records",
                    },
                },
                "invalid sibling",
            ]),
        );
        mocks.migrateLegacyLichessToken.mockResolvedValue({
            status: "error",
            error: "unavailable",
        });
        await initializePersistedSessions();

        expect(mocks.migrateLegacyLichessToken).toHaveBeenCalledWith(
            "player",
            "legacy-secret-among-malformed-records",
        );
        const persisted = localStorage.getItem("sessions")!;
        expect(persisted).not.toContain("legacy-secret-among-malformed-records");
        expect(persisted).not.toContain("accessToken");
        expect(JSON.parse(persisted)).toHaveLength(1);
    });

    test("erases a legacy bearer token before a failed native migration can persist it", async () => {
        localStorage.setItem(
            "sessions",
            JSON.stringify([
                {
                    player: "player",
                    updatedAt: 1,
                    lichess: {
                        username: "player",
                        account: { id: "player", username: "player" },
                        accessToken: "legacy-private-token",
                    },
                },
            ]),
        );
        mocks.migrateLegacyLichessToken.mockResolvedValue({
            status: "error",
            error: "unavailable",
        });
        await initializePersistedSessions();

        expect(mocks.migrateLegacyLichessToken).toHaveBeenCalledWith(
            "player",
            "legacy-private-token",
        );
        expect(localStorage.getItem("sessions")).not.toContain("legacy-private-token");
        expect(localStorage.getItem("sessions")).not.toContain("accessToken");
    });

    test("reconciles durable native accounts without duplicate public sessions", async () => {
        localStorage.setItem(
            "sessions",
            JSON.stringify([
                {
                    player: "Felix",
                    updatedAt: 1,
                    lichess: { username: "Felix", account: { id: "felix", username: "Felix" } },
                },
            ]),
        );
        mocks.listLichessAccounts.mockResolvedValue([
            { username: "felix", handle: "native-handle" },
        ]);
        await initializePersistedSessions();
        await initializePersistedSessions();

        const sessions = JSON.parse(localStorage.getItem("sessions")!);
        expect(sessions).toHaveLength(1);
        expect(sessions[0].lichess.handle).toBe("native-handle");
        expect(mocks.getLichessAccount).not.toHaveBeenCalled();
    });
});
