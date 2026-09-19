import { beforeEach, describe, expect, test, vi } from "vitest";
import type { PathRef } from "@/bindings";

const mocks = vi.hoisted(() => ({
    downloadChessComGames: vi.fn(),
    releaseDownload: vi.fn(),
    withDownloadTicket: vi.fn(),
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
    };
});

import { downloadChessCom } from "./api";

const destination: PathRef = { id: "destination" };

beforeEach(() => {
    mocks.downloadChessComGames.mockReset().mockResolvedValue({ handle: { id: "artifact" } });
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
    test("passes the prepared ticket as the native job id", async () => {
        await downloadChessCom(destination, "player", 123);

        expect(mocks.downloadChessComGames).toHaveBeenCalledWith(
            destination,
            "player_chesscom.pgn",
            "player",
            123n,
            "prepared-ticket",
        );
        expect(mocks.releaseDownload).not.toHaveBeenCalled();
    });

    test("releases a prepared ticket when the command rejects", async () => {
        const failure = new Error("download failed");
        mocks.downloadChessComGames.mockRejectedValue(failure);

        await expect(downloadChessCom(destination, "player", null)).rejects.toBe(failure);
        expect(mocks.releaseDownload).toHaveBeenCalledWith("prepared-ticket");
    });
});
