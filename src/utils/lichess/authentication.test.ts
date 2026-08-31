import { getDefaultStore } from "jotai";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { sessionsAtom } from "@/state/atoms";

const mocks = vi.hoisted(() => ({
    authenticate: vi.fn(),
    getAuthenticationStatus: vi.fn(),
    getLichessAccount: vi.fn(),
}));

vi.mock("@/platform/tauri", () => ({
    tauri: {
        authenticate: mocks.authenticate,
        getAuthenticationStatus: mocks.getAuthenticationStatus,
    },
}));
vi.mock("@/utils/lichess/api", () => ({ getLichessAccount: mocks.getLichessAccount }));

beforeEach(() => {
    vi.clearAllMocks();
    getDefaultStore().set(sessionsAtom, []);
    mocks.authenticate.mockResolvedValue("job-id");
    mocks.getLichessAccount.mockResolvedValue({ id: "player", username: "Player" });
});

describe("authenticateLichess", () => {
    test("returns failure without upserting when native authentication fails", async () => {
        mocks.getAuthenticationStatus.mockResolvedValue({ state: "failed" });
        const { authenticateLichess } = await import("./authentication");

        await expect(authenticateLichess("alias", "Player")).resolves.toEqual({ ok: false });
        expect(getDefaultStore().get(sessionsAtom)).toEqual([]);
    });

    test("upserts a successful native account", async () => {
        mocks.getAuthenticationStatus.mockResolvedValue({
            state: "succeeded",
            account: { handle: "native-handle", username: "Player" },
            durability_uncertain: false,
        });
        const { authenticateLichess } = await import("./authentication");

        await expect(authenticateLichess("alias", "Player")).resolves.toEqual({
            ok: true,
            durabilityUncertain: false,
        });
        expect(getDefaultStore().get(sessionsAtom)[0]).toMatchObject({
            player: "alias",
            lichess: { handle: "native-handle", username: "Player" },
        });
    });

    test("preserves the durability warning on successful authentication", async () => {
        mocks.getAuthenticationStatus.mockResolvedValue({
            state: "succeeded",
            account: { handle: "native-handle", username: "Player" },
            durability_uncertain: true,
        });
        const { authenticateLichess } = await import("./authentication");

        await expect(authenticateLichess("alias", "Player")).resolves.toEqual({
            ok: true,
            durabilityUncertain: true,
        });
        expect(getDefaultStore().get(sessionsAtom)).toHaveLength(1);
    });

    test("falls back to native metadata when the account profile is unavailable", async () => {
        mocks.getAuthenticationStatus.mockResolvedValue({
            state: "succeeded",
            account: { handle: "native-handle", username: "Player" },
        });
        mocks.getLichessAccount.mockResolvedValue(null);
        const { authenticateLichess } = await import("./authentication");

        await expect(authenticateLichess("alias", "Player")).resolves.toEqual({
            ok: true,
            durabilityUncertain: false,
        });
        expect(getDefaultStore().get(sessionsAtom)[0].lichess).toMatchObject({
            handle: "native-handle",
            username: "Player",
            account: { id: "player", username: "Player" },
        });
    });
});
