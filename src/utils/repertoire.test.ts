import { beforeEach, expect, test, vi } from "vitest";
import type { DatabaseHandle } from "@/bindings";

const mocks = vi.hoisted(() => ({ searchPosition: vi.fn() }));
vi.mock("./db", () => ({ searchPosition: mocks.searchPosition }));

import { fetchPositionMoves } from "./repertoire";

const database: DatabaseHandle = { id: { id: "db" }, kind: "database" };

beforeEach(() => vi.clearAllMocks());

test("native cancellation propagates even when the renderer signal itself was not aborted", async () => {
    mocks.searchPosition.mockRejectedValue({
        tag: "backend-error",
        category: "cancellation",
        message: "native owner cancelled",
    });
    const signal = new AbortController().signal;
    await expect(fetchPositionMoves(database, "fen", signal)).rejects.toMatchObject({
        category: "cancellation",
    });
    expect(signal.aborted).toBe(false);
});

test("renderer cancellation never becomes empty repertoire success", async () => {
    const controller = new AbortController();
    const failure = new DOMException("Cancellation", "AbortError");
    mocks.searchPosition.mockImplementation(async () => {
        controller.abort();
        throw failure;
    });
    await expect(fetchPositionMoves(database, "fen", controller.signal)).rejects.toBe(failure);
});

test("ordinary search failure rejects instead of publishing empty full coverage", async () => {
    const failure = new Error("database unavailable");
    mocks.searchPosition.mockRejectedValue(failure);
    await expect(fetchPositionMoves(database, "fen")).rejects.toBe(failure);
});
