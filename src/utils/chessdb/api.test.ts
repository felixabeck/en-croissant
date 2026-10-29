import { INITIAL_FEN } from "chessops/fen";
import { beforeEach, afterEach, expect, test, vi } from "vitest";
import type { EngineOptions } from "@/bindings";
import type { ChessDBLine, ChessDBOutcome } from "./api";

let api: typeof import("./api");
let transport: ReturnType<typeof vi.fn>;
const roots = ["e2e4", "d2d4", "g1f3", "c2c4", "b1c3"];
const replies = ["e7e5", "d7d5", "g8f6", "c7c5", "b8c6"];

function move(uci: string, score = 35) {
    return { uci, san: "ignored", score, rank: 2, note: "! (30-11)", winrate: "49.92" };
}

function pv(uci = "e7e5", depth = 42) {
    return { status: "ok", depth, score: -999, pv: [uci], pvSAN: ["ignored"] };
}

function options(multipv = 1, fen = INITIAL_FEN): EngineOptions {
    return {
        fen,
        moves: [],
        extraOptions: [{ name: "MultiPV", type: "string", value: String(multipv) }],
    };
}

function lookup(multipv = 1, fen = INITIAL_FEN) {
    return api.getBestMoves("tab", { t: "Infinite" }, options(multipv, fen));
}

function lines(outcome: ChessDBOutcome): ChessDBLine[] {
    expect(Array.isArray(outcome)).toBe(true);
    if (!Array.isArray(outcome)) throw new Error("Expected analysis lines");
    expect(outcome[0]).toBe(100);
    return outcome[1];
}

function requests(action: string) {
    return transport.mock.calls
        .map(([input]) => new URL(String(input)))
        .filter((url) => url.searchParams.get("action") === action);
}

function respond(handler: (url: URL) => unknown | Promise<unknown>) {
    transport.mockImplementation(async (input) => {
        const data = await handler(new URL(String(input)));
        return new Response(JSON.stringify(data), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    });
}

beforeEach(async () => {
    vi.resetModules();
    transport = vi.fn();
    vi.stubGlobal("fetch", transport);
    api = await import("./api");
});

afterEach(() => vi.unstubAllGlobals());

function fullResponses(url: URL) {
    if (url.searchParams.get("action") === "queryall")
        return { status: "ok", moves: roots.map((uci, i) => move(uci, 35 - i)) };
    expect(url.searchParams.get("stable")).toBe("1");
    const board = url.searchParams.get("board")!;
    const index = board.includes("4P3")
        ? 0
        : board.includes("3P4")
          ? 1
          : board.includes("5N2")
            ? 2
            : board.includes("2P5")
              ? 3
              : 4;
    return pv(replies[index], 42 + index);
}

test("every displayed move has its own child continuation and depth, root score and annotations", async () => {
    respond(fullResponses);
    const result = lines(await lookup(5));
    expect(requests("queryall")).toHaveLength(1);
    expect(requests("querypv")).toHaveLength(5);
    expect(requests("querypv").every((url) => url.searchParams.get("board") !== INITIAL_FEN)).toBe(
        true,
    );
    for (const [i, line] of result.entries()) {
        expect(line).toMatchObject({
            uciMoves: [roots[i], replies[i]],
            depth: 42 + i,
            multipv: i + 1,
            score: { value: { type: "cp", value: 35 - i } },
            chessdb: { note: "! (30-11)", winrate: "49.92" },
        });
        expect(line.sanMoves).toHaveLength(2);
    }
    expect(result[0].sanMoves).toEqual(["e4", "e5"]);
});

test.each(["unknown", "nobestmove", "network", "malformed"])(
    "a %s child PV degrades to its single ranked move and is retried later",
    async (failure) => {
        respond((url) => {
            if (url.searchParams.get("action") === "queryall")
                return { status: "ok", moves: [move("e2e4")] };
            if (failure === "network") throw new Error("offline");
            if (failure === "malformed") return { status: "ok" };
            return { status: failure };
        });
        expect(lines(await lookup())[0]).toMatchObject({
            depth: 0,
            uciMoves: ["e2e4"],
            sanMoves: ["e4"],
        });
        expect(lines(await lookup())[0].depth).toBe(0);
        expect(requests("queryall")).toHaveLength(1);
        expect(requests("querypv")).toHaveLength(2);
    },
);

test("illegal PV moves truncate both UCI and SAN at the same move", async () => {
    respond((url) =>
        url.searchParams.get("action") === "queryall"
            ? { status: "ok", moves: [move("e2e4")] }
            : { ...pv(), pv: ["e7e5", "e2e3", "g1f3"], pvSAN: ["wrong"] },
    );
    expect(lines(await lookup())[0]).toMatchObject({
        uciMoves: ["e2e4", "e7e5"],
        sanMoves: ["e4", "e5"],
        depth: 42,
    });
});

test.each(["unknown", "empty"])(
    "%s is typed, queues once on repeat, and is never cached",
    async (status) => {
        respond((url) =>
            url.searchParams.get("action") === "queue"
                ? { status: "ok" }
                : status === "empty"
                  ? { status: "ok", moves: [] }
                  : { status },
        );
        expect(await lookup()).toEqual({ type: "not-in-database" });
        expect(await lookup()).toEqual({ type: "not-in-database" });
        expect(requests("queryall")).toHaveLength(2);
        expect(requests("querypv")).toHaveLength(0);
        expect(requests("queue")).toHaveLength(1);
        respond(fullResponses);
        expect(lines(await lookup())[0].depth).toBe(42);
    },
);

test("queue rejection never changes the unknown outcome", async () => {
    respond((url) => {
        if (url.searchParams.get("action") === "queue") throw new Error("offline");
        return { status: "unknown" };
    });
    expect(await lookup()).toEqual({ type: "not-in-database" });
    await Promise.resolve();
    expect(await lookup()).toEqual({ type: "not-in-database" });
    expect(requests("queue")).toHaveLength(1);
});

test("an unknown lookup resolves while queueing is pending and stays unchanged after release", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
        release = resolve;
    });
    let queueSettled = false;
    respond(async (url) => {
        if (url.searchParams.get("action") === "queue") {
            await gate;
            queueSettled = true;
            return { status: "ok" };
        }
        return { status: "unknown" };
    });
    const lookupResult = lookup();
    try {
        expect(await lookupResult).toEqual({ type: "not-in-database" });
        expect(requests("queue")).toHaveLength(1);
        expect(queueSettled).toBe(false);
    } finally {
        release();
    }
    await transport.mock.results[1].value;
    expect(queueSettled).toBe(true);
    expect(await lookupResult).toEqual({ type: "not-in-database" });
    expect(await lookup()).toEqual({ type: "not-in-database" });
    expect(requests("queue")).toHaveLength(1);
});

test.each([
    "invalid board",
    "checkmate",
    "stalemate",
    "nobestmove",
    "malformed",
    "network",
    "http",
])("a %s root lookup fails without caching or queueing", async (status) => {
    if (status === "http") transport.mockResolvedValue(new Response("", { status: 503 }));
    else
        respond(() => {
            if (status === "network") throw new Error("offline");
            return status === "malformed" ? { status: "ok" } : { status };
        });
    const expectedMessage =
        status === "network"
            ? "Remote request failed"
            : status === "http"
              ? "Remote request failed (503)"
              : status === "malformed"
                ? "Remote service returned an invalid response"
                : `ChessDB lookup failed (${status})`;
    await expect(lookup()).rejects.toThrow(expectedMessage);
    await expect(lookup()).rejects.toThrow(expectedMessage);
    expect(requests("queryall")).toHaveLength(2);
    expect(requests("queue")).toHaveLength(0);
});

test("MultiPV 1 then 5 reuses the move list and fetches only missing child PVs", async () => {
    respond(fullResponses);
    expect(lines(await lookup())).toHaveLength(1);
    const result = lines(await lookup(5));
    expect(result).toHaveLength(5);
    expect(result.every((line) => line.uciMoves.length === 2 && line.depth > 0)).toBe(true);
    expect(requests("queryall")).toHaveLength(1);
    expect(requests("querypv")).toHaveLength(5);
});

test("concurrent MultiPV 1 and 5 deduplicate the root and overlapping child requests", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
        release = resolve;
    });
    respond(async (url) => {
        await gate;
        return fullResponses(url);
    });
    const first = lookup();
    const larger = lookup(5);
    expect(requests("queryall")).toHaveLength(1);
    release();
    const [small, large] = await Promise.all([first, larger]);
    expect(lines(small)).toHaveLength(1);
    expect(lines(large)).toHaveLength(5);
    expect(lines(large).every((line) => line.uciMoves.length === 2 && line.depth > 0)).toBe(true);
    expect(requests("querypv")).toHaveLength(5);
});

test("selected child PV requests run concurrently and MultiPV is capped at five", async () => {
    let release!: () => void;
    let started!: () => void;
    const gate = new Promise<void>((resolve) => {
        release = resolve;
    });
    const allStarted = new Promise<void>((resolve) => {
        started = resolve;
    });
    let children = 0;
    respond(async (url) => {
        if (url.searchParams.get("action") === "queryall")
            return { status: "ok", moves: [...roots, "a2a3"].map((uci) => move(uci)) };
        if (url.searchParams.get("action") === "querypv") {
            if (++children === api.CHESSDB_MAX_MULTIPV) started();
            await gate;
        }
        return fullResponses(url);
    });
    const result = lookup(50);
    await allStarted;
    expect(requests("querypv")).toHaveLength(api.CHESSDB_MAX_MULTIPV);
    release();
    expect(lines(await result)).toHaveLength(api.CHESSDB_MAX_MULTIPV);
});

test("counter-independent positions share both move-list and child-PV cache entries", async () => {
    respond(fullResponses);
    const first = await lookup();
    expect(await lookup(1, INITIAL_FEN.replace("0 1", "17 24"))).toEqual(first);
    expect(requests("queryall")).toHaveLength(1);
    expect(requests("querypv")).toHaveLength(1);
});

test("regression coverage: sent FEN removes non-capturable ep and retains legal ep", async () => {
    respond(() => ({ status: "unknown" }));
    await api.getBestMoves("tab", { t: "Infinite" }, { ...options(), moves: ["e2e4"] });
    expect(requests("queryall")[0].searchParams.get("board")).toBe(
        "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
    );
    await api.getBestMoves(
        "tab",
        { t: "Infinite" },
        {
            ...options(1, "4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 7"),
            moves: ["d7d5"],
        },
    );
    expect(requests("queryall")[1].searchParams.get("board")).toBe(
        "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 8",
    );
});

test("regression coverage: black-to-move scores keep the white perspective", async () => {
    respond((url) =>
        url.searchParams.get("action") === "queryall"
            ? { status: "ok", moves: [move("e7e5", 68)] }
            : pv("g1f3"),
    );
    const result = lines(
        await api.getBestMoves("tab", { t: "Infinite" }, { ...options(), moves: ["e2e4"] }),
    );
    expect(result[0].score.value).toEqual({ type: "cp", value: -68 });
});

function positions(count: number) {
    return Array.from({ length: count }, (_, index) => {
        const pawns = Array.from({ length: 8 }, (_, file) =>
            file > 0 && file < 7 && index & (1 << (file - 1)) ? "P" : "1",
        ).join("");
        const pieces = `K${index & 64 ? "N" : "1"}4${index & 128 ? "N" : "1"}1`;
        return `7k/8/8/8/8/8/${pawns}/${pieces} w - - 0 1`;
    });
}

test.each(["queryall", "querypv"])(
    "%s cache evicts the least recently used position at its bound",
    async (action) => {
        const boards = positions(api.CHESSDB_CACHE_CAPACITY + 1);
        respond((url) =>
            url.searchParams.get("action") === "queryall"
                ? { status: "ok", moves: [move("a1a2")] }
                : { ...pv(), pv: [], pvSAN: [] },
        );
        for (const board of boards.slice(0, -1)) await lookup(1, board);
        await lookup(1, boards[0]);
        await lookup(1, boards.at(-1)!);
        const before = requests(action).length;
        await lookup(1, boards[0]);
        expect(requests(action)).toHaveLength(before);
        await lookup(1, boards[1]);
        expect(requests(action)).toHaveLength(before + 1);
    },
);

test("queue repeat suppression is bounded and refreshes recency", async () => {
    const boards = positions(api.CHESSDB_QUEUE_CAPACITY + 1);
    respond(() => ({ status: "unknown" }));
    for (const board of boards.slice(0, -1)) await lookup(1, board);
    await lookup(1, boards[0]);
    await lookup(1, boards.at(-1)!);
    expect(requests("queue")).toHaveLength(api.CHESSDB_QUEUE_CAPACITY + 1);
    await lookup(1, boards[0]);
    expect(requests("queue")).toHaveLength(api.CHESSDB_QUEUE_CAPACITY + 1);
    await lookup(1, boards[1]);
    expect(requests("queue")).toHaveLength(api.CHESSDB_QUEUE_CAPACITY + 2);
});

test("pending requests are bounded, shared at capacity, and released after failure", async () => {
    const boards = positions(api.CHESSDB_MAX_IN_FLIGHT + 1);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
        release = resolve;
    });
    respond(async () => {
        await gate;
        throw new Error("offline");
    });
    const pending = boards.slice(0, -1).map((board) => lookup(1, board).catch(() => null));
    const duplicate = lookup(1, boards[0]).catch(() => null);
    expect(requests("queryall")).toHaveLength(api.CHESSDB_MAX_IN_FLIGHT);
    await expect(lookup(1, boards.at(-1)!)).rejects.toThrow("Too many pending ChessDB requests");
    release();
    await Promise.all([...pending, duplicate]);
    respond(() => ({ status: "unknown" }));
    expect(await lookup(1, boards[0])).toEqual({ type: "not-in-database" });
});
