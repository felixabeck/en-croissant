import { expect, vi, type Mock } from "vitest";
import type { ArtifactPublication } from "@/bindings";
import { tauriSubscriptions } from "@/platform/tauri";

export async function assertAccountExportTicketOrder({
    progressMock,
    nativeMock,
    download,
    publication,
}: {
    progressMock: Pick<Mock<typeof tauriSubscriptions.progress>, "mockImplementation">;
    nativeMock: Pick<Mock<() => Promise<ArtifactPublication>>, "mockImplementation">;
    download: (onTicket: (ticket: string) => void) => Promise<ArtifactPublication>;
    publication: ArtifactPublication;
}) {
    let listener: Parameters<typeof tauriSubscriptions.progress>[0] | undefined;
    const observed = vi.fn();
    progressMock.mockImplementation(async (callback) => {
        listener = callback;
        return vi.fn<() => void>();
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
    nativeMock.mockImplementation(() => {
        listener?.(frame);
        return nativeResult;
    });
    const onTicket = vi.fn((ticket: string) => {
        void tauriSubscriptions.progress((event) => {
            if (event.payload.id === ticket) observed(event);
        });
    });
    let settled = false;
    const result = download(onTicket);
    void result.then(() => {
        settled = true;
    });
    await Promise.resolve();
    expect(onTicket).toHaveBeenCalledExactlyOnceWith("prepared-ticket");
    expect(observed).toHaveBeenCalledExactlyOnceWith(frame);
    expect(settled).toBe(false);
    resolve(publication);
    await expect(result).resolves.toEqual(publication);
}
