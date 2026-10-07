import { beforeEach, describe, expect, test, vi } from "vitest";
import type { ArtifactPublication, PathRef } from "@/bindings";
import { tauriSubscriptions } from "@/platform/tauri";

const mocks = vi.hoisted(() => ({
    downloadChessComGames: vi.fn(),
    releaseDownload: vi.fn(),
    withDownloadTicket: vi.fn(),
    progress: vi.fn(),
}));

vi.mock("@/platform/tauri", async () => {
    const actual = await vi.importActual<typeof import("@/platform/tauri")>("@/platform/tauri");
    return {
        ...actual,
        tauri: {
            ...actual.tauri,
            downloadChessComGames: mocks.downloadChessComGames,
        },
        withDownloadTicket: mocks.withDownloadTicket,
        tauriSubscriptions: { ...actual.tauriSubscriptions, progress: mocks.progress },
    };
});

import { downloadChessCom } from "./api";

const destination: PathRef = { id: "destination" };
const publication: ArtifactPublication = {
    handle: { id: { id: "artifact" }, kind: "fileWorkspace" },
    durability: "Durable",
};

beforeEach(() => {
    mocks.downloadChessComGames.mockReset().mockResolvedValue(publication);
    mocks.releaseDownload.mockReset().mockResolvedValue(undefined);
    mocks.withDownloadTicket
        .mockReset()
        .mockImplementation(async (run: (ticket: string) => Promise<unknown>) => {
            try {
                return await run("prepared-ticket");
            } catch (error) {
                await mocks.releaseDownload("prepared-ticket");
                throw error;
            }
        });
});

describe("downloadChessCom", () => {
    test("installs the ticket listener before the native entry frame while download is pending", async () => {
        let listener: Parameters<typeof tauriSubscriptions.progress>[0] | undefined;
        const observed = vi.fn();
        mocks.progress.mockImplementation(async (callback) => {
            listener = callback;
            return vi.fn();
        });
        let resolve!: (value: ArtifactPublication) => void;
        const nativeResult = new Promise<ArtifactPublication>((settle) => {
            resolve = settle;
        });
        const frame = {
            payload: {
                id: "prepared-ticket",
                generation: 1n,
                progress: 12,
                finished: false,
                state: "running" as const,
                cleared: false,
            },
        };
        mocks.downloadChessComGames.mockImplementation(() => {
            listener?.(frame);
            return nativeResult;
        });
        const onTicket = vi.fn((ticket: string) => {
            void tauriSubscriptions.progress((event) => {
                if (event.payload.id === ticket) observed(event);
            });
        });
        let settled = false;
        const result = downloadChessCom(destination, "player", null, onTicket);
        void result.then(() => {
            settled = true;
        });
        await Promise.resolve();
        expect(onTicket).toHaveBeenCalledExactlyOnceWith("prepared-ticket");
        expect(observed).toHaveBeenCalledExactlyOnceWith(frame);
        expect(settled).toBe(false);
        resolve(publication);
        await expect(result).resolves.toEqual(publication);
    });

    test("passes the prepared ticket as the native job id", async () => {
        await expect(downloadChessCom(destination, "player", 123, vi.fn())).resolves.toEqual(
            publication,
        );

        expect(mocks.downloadChessComGames).toHaveBeenCalledWith(
            destination,
            "player_chesscom.pgn",
            "player",
            123n,
            "prepared-ticket",
        );
        expect(mocks.releaseDownload).not.toHaveBeenCalled();
    });

    test("returns an uncertain publication unchanged", async () => {
        const uncertain: ArtifactPublication = {
            handle: publication.handle,
            durability: { DurabilityUncertain: "DownloadTargetReplacement" },
        };
        mocks.downloadChessComGames.mockResolvedValue(uncertain);

        await expect(downloadChessCom(destination, "player", null, vi.fn())).resolves.toEqual(
            uncertain,
        );
        expect(mocks.downloadChessComGames).toHaveBeenCalledTimes(1);
        expect(mocks.releaseDownload).not.toHaveBeenCalled();
    });

    test("releases a prepared ticket when the command rejects", async () => {
        const failure = new Error("download failed");
        mocks.downloadChessComGames.mockRejectedValue(failure);

        await expect(downloadChessCom(destination, "player", null, vi.fn())).rejects.toBe(failure);
        expect(mocks.releaseDownload).toHaveBeenCalledWith("prepared-ticket");
    });
});
