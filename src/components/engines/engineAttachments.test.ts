import { beforeEach, expect, test, vi } from "vitest";
import { EngineAttachmentDraft, replaceEngineById } from "./engineAttachments";

const reconcile = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("@/platform/tauri", () => ({
    tauri: { reconcileEngineAttachments: reconcile },
}));
beforeEach(() => reconcile.mockReset().mockResolvedValue(undefined));

test("abandons a stale picker result recorded after close", async () => {
    let resolve!: (value: { id: { id: string } }) => void;
    const draft = new EngineAttachmentDraft();
    const issued = draft.issue("image", () => new Promise((done) => (resolve = done)), vi.fn());
    await draft.close();
    resolve({ id: { id: "stale" } });
    expect(await issued).toBeNull();
    expect(reconcile).toHaveBeenCalledWith(
        expect.objectContaining({ retained_ids: null, abandoned_ids: [{ id: "stale" }] }),
    );
});

test("replacement abandons the prior slot while failed adoption remains closable", async () => {
    const draft = new EngineAttachmentDraft();
    await draft.issue("image", async () => ({ id: { id: "old" } }), vi.fn());
    await draft.issue("image", async () => ({ id: { id: "new" } }), vi.fn());
    await draft.adopt(
        { operationId: "save", key: "engines", saved: false, synchronized: false },
        draft.submission(),
    );
    await draft.close();
    expect(reconcile).toHaveBeenCalledWith(
        expect.objectContaining({ abandoned_ids: [{ id: "old" }] }),
    );
    expect(reconcile).toHaveBeenCalledWith(
        expect.objectContaining({ abandoned_ids: [{ id: "new" }] }),
    );
});

test("replacement cleanup rejection keeps both issued handles for close retry", async () => {
    const failure = new Error("cleanup rejected");
    reconcile.mockRejectedValueOnce(failure).mockResolvedValueOnce(undefined);
    const draft = new EngineAttachmentDraft();
    const applyNew = vi.fn();
    await draft.issue("image", async () => ({ id: { id: "old" } }), vi.fn());

    await expect(draft.issue("image", async () => ({ id: { id: "new" } }), applyNew)).rejects.toBe(
        failure,
    );
    expect(applyNew).not.toHaveBeenCalled();
    await draft.close();

    expect(reconcile.mock.calls[0][0]).toEqual(
        expect.objectContaining({ abandoned_ids: [{ id: "old" }] }),
    );
    expect(reconcile.mock.calls[1][0]).toEqual(
        expect.objectContaining({ abandoned_ids: [{ id: "old" }, { id: "new" }] }),
    );
});

test("failed close preserves outstanding ownership for an explicit retry", async () => {
    reconcile
        .mockRejectedValueOnce(new Error("first close failed"))
        .mockResolvedValueOnce(undefined);
    const draft = new EngineAttachmentDraft();
    await draft.issue("image", async () => ({ id: { id: "retry" } }), vi.fn());
    await expect(draft.close()).rejects.toThrow("first close failed");
    await expect(draft.close()).resolves.toBeUndefined();
    expect(reconcile).toHaveBeenCalledTimes(2);
});

test("rechecks staleness after awaiting replacement cleanup", async () => {
    let release!: () => void;
    reconcile.mockImplementationOnce(() => new Promise<void>((done) => (release = done)));
    const draft = new EngineAttachmentDraft();
    const apply = vi.fn();
    await draft.issue("image", async () => ({ id: { id: "old" } }), vi.fn());
    const replacement = draft.issue("image", async () => ({ id: { id: "new" } }), apply);
    await vi.waitFor(() => expect(release).toBeTypeOf("function"));
    const close = draft.close();
    release();
    expect(await replacement).toBeNull();
    await close;
    expect(apply).not.toHaveBeenCalled();
    expect(reconcile).toHaveBeenCalledWith(
        expect.objectContaining({ abandoned_ids: [{ id: "new" }] }),
    );
});

test("correlated adoption does not clear a newer generation that reused the same id", async () => {
    const draft = new EngineAttachmentDraft();
    await draft.issue("image", async () => ({ id: { id: "submitted" } }), vi.fn());
    const submitted = draft.submission();
    await draft.issue("image", async () => ({ id: { id: "submitted" } }), vi.fn());
    await draft.adopt(
        { operationId: "save", key: "engines", saved: true, synchronized: true },
        submitted,
    );
    expect(draft.attachmentIds()).toEqual(["submitted"]);
    await draft.close();
    expect(reconcile).toHaveBeenCalledWith(
        expect.objectContaining({ abandoned_ids: [{ id: "submitted" }] }),
    );
});

test("latest immutable id wins and JSON cannot replace actor identity", () => {
    expect(
        replaceEngineById(
            [
                { id: "first", name: "A" },
                { id: "target", name: "B" },
            ],
            "target",
            { id: "injected", name: "edited" },
        ),
    ).toEqual([
        { id: "first", name: "A" },
        { id: "target", name: "edited" },
    ]);
});
