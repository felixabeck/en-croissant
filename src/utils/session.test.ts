import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    migrateLegacyLichessToken: vi.fn(),
    listLichessAccounts: vi.fn(),
    getLichessAccount: vi.fn(),
}));

vi.mock("@/bindings/generated", () => ({
    commands: {
        migrateLegacyLichessToken: mocks.migrateLegacyLichessToken,
        listLichessAccounts: mocks.listLichessAccounts,
    },
}));
vi.mock("@/utils/lichess/api", () => ({ getLichessAccount: mocks.getLichessAccount }));

beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    vi.clearAllMocks();
    mocks.listLichessAccounts.mockResolvedValue([]);
});

describe("initializePersistedSessions", () => {
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
        const { initializePersistedSessions } = await import("./session");

        await initializePersistedSessions();

        const sessions = JSON.parse(localStorage.getItem("sessions")!);
        expect(sessions[0].lichess.handle).toBe("migrated-handle");
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
        const { initializePersistedSessions } = await import("./session");

        await initializePersistedSessions();

        expect(localStorage.getItem("sessions")).not.toContain("credential-that-must-be-removed");
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
        const { initializePersistedSessions } = await import("./session");

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
        const { initializePersistedSessions } = await import("./session");

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
        const { initializePersistedSessions } = await import("./session");

        await initializePersistedSessions();
        await initializePersistedSessions();

        const sessions = JSON.parse(localStorage.getItem("sessions")!);
        expect(sessions).toHaveLength(1);
        expect(sessions[0].lichess.handle).toBe("native-handle");
    });
});
