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
    mocks.revokeLegacyLichessToken.mockReset().mockResolvedValue({ status: "ok", data: null });
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
        finishRevocation({ status: "ok", data: null });
        const error = await outcome;
        expect(error).toBeInstanceOf(SessionSanitizationError);
        expect(error).toMatchObject({ legacySignInFound: true, allRevoked: true });
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

    test("reconciles the opaque handle returned by a successful migration", async () => {
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
        await initializePersistedSessions();

        const sessions = JSON.parse(localStorage.getItem("sessions")!);
        expect(sessions[0].lichess.handle).toBe("migrated-handle");
        expect(mocks.revokeLegacyLichessToken).not.toHaveBeenCalled();
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
    });
});
