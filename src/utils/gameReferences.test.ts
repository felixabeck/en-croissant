import { expect, test, vi } from "vitest";
import type { NormalizedGame, Player } from "@/bindings";
import type { DatabaseList } from "./db";
import {
    lookupGameReference,
    matchesReferenceGame,
    matchesReferencePlayer,
    recognizeGameReferences,
    REFERENCE_SEARCH_LIMITS,
} from "./gameReferences";

vi.mock("./db", () => ({ getDatabases: vi.fn(), query_games: vi.fn(), query_players: vi.fn() }));

const beerdsen =
    "0-1 Beerdsen,T (2520)-Bluebaum,M (2651) Elllobregat op 3rd Sant Boi de Llobregat 2022 (3)";
const srinath =
    "0-1 Srinath,R (2255)-Deac,B (2690) Titled Tuesday intern op 19th Dec Late Chess.com INT blitz 2023 (6)";
const reference = recognizeGameReferences(beerdsen)[0];
const database = { id: { id: "source-a" }, kind: "database" as const };
const root = { id: { id: "root" }, kind: "databaseRoot" as const };
const game: NormalizedGame = {
    id: 1,
    fen: "start",
    white: "Beerdsen, Thomas",
    white_id: 11,
    white_elo: 2520,
    black: "Bluebaum, Matthias",
    black_id: 22,
    black_elo: 2651,
    event: "Elllobregat op 3rd",
    event_id: 1,
    site: "Sant Boi de Llobregat",
    site_id: 1,
    date: "2022.12.01",
    round: "3",
    result: "0-1",
    moves: "1. e4 c5 0-1",
};
function setup() {
    const library: DatabaseList = {
        root,
        unread: [],
        databases: [
            {
                type: "success",
                file: database,
                filename: "source-a.db3",
                title: "Source A",
                description: "",
                indexed: false,
                game_count: 1,
                player_count: 2,
                event_count: 1,
                storage_size: "4096",
            },
        ],
    };
    const api = {
        getDatabases: vi.fn(async () => library),
        query_players: vi.fn(async (_database, query) => ({
            data: [
                query.name === "Beerdsen"
                    ? { id: 11, name: game.white, elo: 2520 }
                    : { id: 22, name: game.black, elo: 2651 },
            ],
            count: 1,
        })),
        query_games: vi.fn(async () => ({ data: [game], count: 1 })),
    } as {
        getDatabases: ReturnType<typeof vi.fn<typeof import("./db").getDatabases>>;
        query_players: ReturnType<typeof vi.fn<typeof import("./db").query_players>>;
        query_games: ReturnType<typeof vi.fn<typeof import("./db").query_games>>;
    };
    return {
        library,
        api,
        search: (signal = new AbortController().signal) =>
            lookupGameReference(reference, signal, api),
    };
}

function querySensitiveSource(games: NormalizedGame[]) {
    const { api } = setup();
    api.query_games.mockImplementation(async (_database, query) => {
        const matching = games.filter(
            (candidate) =>
                (!query.start_date ||
                    (candidate.date != null && candidate.date >= query.start_date)) &&
                (!query.end_date || (candidate.date != null && candidate.date <= query.end_date)),
        );
        const pageSize = query.options?.pageSize ?? 100;
        const start = ((query.options?.page ?? 1) - 1) * pageSize;
        return { data: matching.slice(start, start + pageSize), count: matching.length };
    });
    return api;
}

test.each(["????.??.??", "2023.01.01"])(
    "event year retains its candidate with actual Date %s through native date predicates",
    async (date) => {
        const citation = recognizeGameReferences(
            "0-1 Beerdsen,T (2520)-Bluebaum,M (2651) BEL-NED 2017 ICCF",
        )[0];
        const candidate = { ...game, event: "BEL-NED 2017", site: "ICCF", date };
        const api = querySensitiveSource([candidate]);
        const result = await lookupGameReference(citation, new AbortController().signal, api);
        expect(result.candidates.map((occurrence) => occurrence.game)).toEqual([candidate]);
        expect(matchesReferenceGame(citation, candidate)).toBe(true);
        expect(result).toMatchObject({
            complete: true,
            candidates: [{ verification: "verified" }],
        });
        expect(api.query_games.mock.calls[0][1].start_date).toBeUndefined();
        expect(api.query_games.mock.calls[0][1].end_date).toBeUndefined();
    },
);

test.each([
    { tail: "BEL-NED 2017 ICCF 2023 (3)", event: "BEL-NED 2017", site: "ICCF", date: "2023.01.01" },
    {
        tail: "Tournament 2024 City 2025 (3)",
        event: "Tournament 2024",
        site: "City",
        date: "2025.01.01",
    },
    {
        tail: "Tournament City 2024 2025 (3)",
        event: "Tournament",
        site: "City 2024",
        date: "2025.01.01",
    },
])(
    "candidate header boundaries resolve $tail before actual date and round",
    async ({ tail, ...headers }) => {
        const citation = recognizeGameReferences(
            `0-1 Beerdsen,T (2520)-Bluebaum,M (2651) ${tail}`,
        )[0];
        const candidate = { ...game, ...headers };
        const result = await lookupGameReference(
            citation,
            new AbortController().signal,
            querySensitiveSource([candidate]),
        );
        expect(matchesReferenceGame(citation, candidate)).toBe(true);
        expect(result).toMatchObject({
            complete: true,
            candidates: [{ game: candidate, verification: "verified" }],
        });
        for (const conflicting of [
            { date: "2021.01.01" },
            { round: "4" },
            { event: "Unrelated event" },
            { site: "Unrelated site" },
            { white_elo: 2519 },
            { black_elo: 2600 },
            { result: "1-0" as const },
            { white: "Beerdsen, Alice" },
        ]) {
            const conflict = { ...candidate, ...conflicting };
            expect(matchesReferenceGame(citation, conflict)).toBe(false);
            const rejected = await lookupGameReference(
                citation,
                new AbortController().signal,
                querySensitiveSource([conflict]),
            );
            expect(rejected.candidates).toEqual([]);
        }
    },
);

test("unverified remaining context preserves source completeness and requires a choice", async () => {
    const citation = recognizeGameReferences(
        "0-1 Beerdsen,T (2520)-Bluebaum,M (2651) Elllobregat op 3rd Sant Boi de Llobregat unclear context 2022 (3)",
    )[0];
    const result = await lookupGameReference(
        citation,
        new AbortController().signal,
        querySensitiveSource([game]),
    );
    expect(matchesReferenceGame(citation, game)).toBe(true);
    expect(result).toMatchObject({
        complete: true,
        failures: [],
        candidates: [{ game, verification: "unverified" }],
    });
    expect(matchesReferenceGame(citation, { ...game, date: "2021.01.01" })).toBe(false);
    expect(matchesReferenceGame(citation, { ...game, round: "4" })).toBe(false);
});

test.each([
    "White was better.",
    "Elllobregat op 3rd White was better.",
    "White was better before 2020.",
    "Elllobregat op 3rd White was better before 2020.",
    "Elllobregat op 3rd Sant Boi de Llobregat White was better before 2020.",
])(
    "open tail retains one unverified occurrence through query-sensitive lookup: %s",
    async (context) => {
        const label = "0-1 Beerdsen,T-Bluebaum,M";
        const citation = recognizeGameReferences(`${label} ${context}`)[0];
        const api = querySensitiveSource([game]);
        const result = await lookupGameReference(citation, new AbortController().signal, api);
        expect(citation).toMatchObject({ label, context });
        expect(result).toMatchObject({ complete: true, failures: [] });
        expect(result.candidates).toEqual([
            { database, source: "Source A (source-a.db3)", game, verification: "unverified" },
        ]);
        expect(api.query_games.mock.calls[0][1]).toMatchObject({
            player1: 11,
            player2: 22,
            sides: "WhiteBlack",
            outcome: "0-1",
        });
        expect(api.query_games.mock.calls[0][1].start_date).toBeUndefined();
        expect(api.query_games.mock.calls[0][1].end_date).toBeUndefined();
        for (const conflict of [
            { white: "Beerdsen, Alice" },
            { black: "Beerdsen, Thomas" },
            { result: "1-0" as const },
        ])
            expect(matchesReferenceGame(citation, { ...game, ...conflict })).toBe(false);
    },
);

test.each([
    "Elllobregat op 3rd Sant Boi de Llobregat",
    "Elllobregat op 3rd Sant Boi de Llobregat 2022",
])("actual event/site context without a closing round verifies: %s", async (context) => {
    const citation = recognizeGameReferences(`0-1 Beerdsen,T-Bluebaum,M ${context}`)[0];
    const result = await lookupGameReference(
        citation,
        new AbortController().signal,
        querySensitiveSource([game]),
    );
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].verification).toBe("verified");
});

test.each(["Elllobregat op 3rd 2021", "Elllobregat op 3rd Sant Boi de Llobregat (4)"])(
    "identifiable date and round contradictions still reject: %s",
    async (context) => {
        const citation = recognizeGameReferences(`0-1 Beerdsen,T-Bluebaum,M ${context}`)[0];
        const result = await lookupGameReference(
            citation,
            new AbortController().signal,
            querySensitiveSource([game]),
        );
        expect(result.candidates).toEqual([]);
    },
);

test("an unrelated site after a numeral cannot be offered as unverified context", async () => {
    const citation = recognizeGameReferences("0-1 Beerdsen,T-Bluebaum,M BEL-NED 2017 ICCF")[0];
    const candidate = { ...game, event: "BEL-NED", site: "Unrelated site", date: "2017.01.01" };
    expect(matchesReferenceGame(citation, candidate)).toBe(false);
    expect(
        (
            await lookupGameReference(
                citation,
                new AbortController().signal,
                querySensitiveSource([candidate]),
            )
        ).candidates,
    ).toEqual([]);
});

test.each([{ date: "????.??.??" }, { round: "?" }])(
    "missing actual metadata retains only an unverified occurrence: %j",
    async (missing) => {
        const candidate = { ...game, ...missing };
        const result = await lookupGameReference(
            reference,
            new AbortController().signal,
            querySensitiveSource([candidate]),
        );
        expect(result).toMatchObject({
            complete: true,
            candidates: [{ verification: "unverified" }],
        });
    },
);

test("both screenshot citations retain hard constraints and verified lookup", async () => {
    const second = {
        ...game,
        white: "Srinath, Rao",
        black: "Deac, Bogdan",
        white_elo: 2255,
        black_elo: 2690,
        event: "Titled Tuesday intern op 19th Dec Late",
        site: "Chess.com INT blitz",
        date: "2023.12.19",
        round: "6",
    };
    for (const [label, candidate] of [
        [beerdsen, game],
        [srinath, second],
    ] as const) {
        const citation = recognizeGameReferences(label)[0];
        const api = querySensitiveSource([candidate]);
        api.query_players.mockResolvedValue({
            data: [
                { id: 11, name: candidate.white, elo: candidate.white_elo! },
                { id: 22, name: candidate.black, elo: candidate.black_elo! },
            ],
            count: 2,
        });
        const result = await lookupGameReference(citation, new AbortController().signal, api);
        expect(result).toMatchObject({
            complete: true,
            candidates: [{ game: candidate, verification: "verified" }],
        });
        for (const conflict of [
            { white_elo: 0 },
            { black_elo: 0 },
            { white: "Srinath, Alice" },
            { result: "1-0" as const },
        ])
            expect(matchesReferenceGame(citation, { ...candidate, ...conflict })).toBe(false);
    }
});

test("recognizes the two exact screenshot citations without surrounding prose", () => {
    const text = `Before ${beerdsen} This is ordinary prose. ${srinath} More prose.`;
    const found = recognizeGameReferences(text);
    expect(found.map((entry) => entry.label)).toEqual([beerdsen, srinath]);
    expect(found[0]).toMatchObject({
        outcome: "0-1",
        white: { surname: "Beerdsen", initials: "T", rating: 2520 },
        black: { surname: "Bluebaum", initials: "M", rating: 2651 },
        year: "2022",
        round: "3",
    });
    expect(found[1]).toMatchObject({
        event: "Titled Tuesday intern op 19th Dec Late Chess.com INT blitz",
        year: "2023",
        round: "6",
    });
    for (const foundReference of found)
        expect(text.slice(foundReference.start, foundReference.end)).toBe(foundReference.label);
});

test("keeps an unterminated tail for verification without extending the visible label", () => {
    const label = "0-1 Beerdsen,T (2520)-Bluebaum,M (2651)";
    const context = "BEL-NED 2017 ICCF and this is ordinary preparation prose.";
    const text = `${label} ${context}`;
    const [citation] = recognizeGameReferences(text);

    expect(citation).toMatchObject({ label, context });
    expect(text.slice(citation.start, citation.end)).toBe(label);
});

test("recognizes Unicode, hyphens, apostrophes, optional ratings and missing metadata", () => {
    const found = recognizeGameReferences(
        "½-½ Duda-Krüger,J.K.-O’Kelly,A ICCF Europe (2.1) then 1-0 Šarić,I-Deac,B",
    );
    expect(found).toHaveLength(2);
    expect(found[0]).toMatchObject({
        white: { surname: "Duda-Krüger", initials: "J.K." },
        black: { surname: "O’Kelly", initials: "A" },
        event: "ICCF Europe",
        round: "2.1",
    });
    expect(found[1].year).toBeUndefined();
    expect(recognizeGameReferences("0-1 some ordinary prose and 1-0 Smithson-Black")).toEqual([]);
});

test.each([
    ["Beerdsen, Thomas", true],
    ["Thomas Beerdsen", true],
    ["Beerdsen,T", true],
    ["Beerdsen, Tim", true],
    ["Beerdsen, A T", false],
    ["Van Beerdsen, Thomas", false],
    ["Thomas Beerdsen Jr", false],
    ["Beerdsenberg, Thomas", false],
    ["Tomas Beerd", false],
])("surname identity and given initial constrain %s", (name, expected) => {
    expect(matchesReferencePlayer(reference.white, name)).toBe(expected);
});

test("normalizes Unicode and distinguishes surname letters from initials", () => {
    expect(
        matchesReferencePlayer({ surname: "Šarić", initials: "I" }, "S\u030caric\u0301, Ivan"),
    ).toBe(true);
    expect(matchesReferencePlayer({ surname: "Smith", initials: "M" }, "Smith, Alice")).toBe(false);
    expect(
        matchesReferencePlayer({ surname: "Duda-Krüger", initials: "JK" }, "Duda-Krüger, Jan-Karl"),
    ).toBe(true);
});

test("every supplied field constrains candidates", () => {
    expect(matchesReferenceGame(reference, game)).toBe(true);
    for (const conflict of [
        { white: "Beerdsen, Alice" },
        { black: "Deac, Bogdan" },
        { white_elo: 2519 },
        { black_elo: null },
        { result: "1-0" as const },
        { date: "2021.12.01" },
        { round: "4" },
        { event: "Another tournament" },
        { site: "Another city" },
    ]) {
        expect(matchesReferenceGame(reference, { ...game, ...conflict })).toBe(false);
    }
});

test("uses database-local IDs, ordered sides and outcome without premature date filters", async () => {
    const { api, search } = setup();
    const result = await search();
    expect(result.complete).toBe(true);
    expect(result.candidates).toEqual([
        { database, source: "Source A (source-a.db3)", game, verification: "verified" },
    ]);
    expect(api.query_games).toHaveBeenCalledWith(
        database,
        expect.objectContaining({
            player1: 11,
            player2: 22,
            sides: "WhiteBlack",
            outcome: "0-1",
            options: expect.objectContaining({ page: 1, pageSize: 100 }),
        }),
        expect.anything(),
    );
    expect(api.query_games.mock.calls[0][1].start_date).toBeUndefined();
    expect(api.query_games.mock.calls[0][1].end_date).toBeUndefined();
});

test("reads later player and game pages before establishing uniqueness", async () => {
    const { api, search } = setup();
    api.query_players.mockImplementation(async (_db, query) =>
        query.name === "Bluebaum"
            ? { data: [{ id: 22, name: game.black, elo: 2651 }], count: 1 }
            : {
                  data:
                      query.options.page === 1
                          ? Array.from(
                                { length: 100 },
                                (_, id): Player => ({
                                    id: id + 100,
                                    name: "Beerdsenberg, Thomas",
                                    elo: 2520,
                                }),
                            )
                          : [{ id: 11, name: game.white, elo: 2520 }],
                  count: 101,
              },
    );
    api.query_games.mockImplementation(async (_db, query) => ({
        data:
            query.options?.page === 1
                ? [
                      game,
                      ...Array.from({ length: 99 }, (_, id) => ({
                          ...game,
                          id: id + 100,
                          round: "9",
                      })),
                  ]
                : [{ ...game, id: 2 }],
        count: 101,
    }));
    const result = await search();
    expect(result.complete).toBe(true);
    expect(result.candidates.map((entry) => entry.game.id)).toEqual([1, 2]);
    expect(api.query_games).toHaveBeenCalledTimes(2);
});

test("keeps distinct source-qualified occurrences even with the same game ID", async () => {
    const { library, search } = setup();
    library.databases.push({
        ...library.databases[0],
        file: { ...database, id: { id: "source-b" } },
    });
    expect((await search()).candidates).toHaveLength(2);
});

test("empty Library is a complete no-match", async () => {
    const { library, search } = setup();
    library.databases = [];
    expect(await search()).toEqual({ candidates: [], failures: [], complete: true });
});

test("preserves unread, unavailable and omitted source guidance alongside successful candidates", async () => {
    const { library, search } = setup();
    library.unread.push({ filename: "Unread", error: "Select this source again" });
    library.databases.push({
        type: "error",
        file: database,
        filename: "Broken",
        error: "Permission guidance",
        indexed: false,
    });
    library.collections = [
        {
            id: "collection",
            name: "Collection",
            file: { id: { id: "pgn" }, kind: "fileWorkspace" },
            database: null,
            account: null,
            status: "unavailable",
            generation: "1",
            omitted: 1,
            retiredDatabase: null,
            fetchSinceMs: null,
        },
    ];
    const result = await search();
    expect(result.complete).toBe(false);
    expect(result.candidates).toHaveLength(1);
    expect(result.failures).toEqual(
        expect.arrayContaining([
            { source: "Unread", category: "unavailable", message: "Select this source again" },
            { source: "Broken", category: "unavailable", message: "Permission guidance" },
            { source: "Collection", category: "omitted" },
            { source: "Collection", category: "unavailable" },
        ]),
    );
});

test.each(["permission", "missing-resource", "database"] as const)(
    "retains safe %s category without exposing native diagnostics",
    async (category) => {
        const { api, search } = setup();
        api.query_games.mockRejectedValueOnce({
            tag: "backend-error",
            category,
            message: "secret raw native diagnostic",
        });
        const result = await search();
        expect(result.complete).toBe(false);
        expect(result.failures[0]).toEqual({
            source: "Source A (source-a.db3)",
            backendCategory: category,
            category:
                category === "missing-resource"
                    ? "not-found"
                    : category === "permission"
                      ? "permission"
                      : "unexpected",
        });
        expect(JSON.stringify(result)).not.toContain("diagnostic");
        expect((await search()).complete).toBe(true);
    },
);

test("discovery failure is incomplete even without candidates", async () => {
    const { api, search } = setup();
    api.getDatabases.mockRejectedValueOnce(new Error("permission denied"));
    expect(await search()).toMatchObject({
        complete: false,
        failures: [{ source: "", category: "permission" }],
    });
});

test("unknown month and day remain eligible when the year is identifiable", async () => {
    const { api, search } = setup();
    api.query_games.mockResolvedValue({ data: [{ ...game, date: "2022.??.??" }], count: 1 });
    expect((await search()).candidates).toHaveLength(1);
    expect(api.query_games.mock.calls[0][1].start_date).toBeUndefined();
    expect(api.query_games.mock.calls[0][1].end_date).toBeUndefined();
});

test("Unicode discovery uses invariant ASCII fragments and supports stored dotted initials", async () => {
    const { api } = setup();
    const unicode = recognizeGameReferences("1-0 Šarić,I.K.-O'Kelly,A 2022 (3)")[0];
    api.query_players.mockResolvedValue({
        data: [
            { id: 1, name: "Šarić,I.K.", elo: null },
            { id: 2, name: "O’Kelly, Andrew", elo: null },
        ],
        count: 2,
    });
    api.query_games.mockResolvedValue({
        data: [{ ...game, white: "Šarić,I.K.", black: "O’Kelly, Andrew", result: "1-0" }],
        count: 1,
    });
    const result = await lookupGameReference(unicode, new AbortController().signal, api);
    expect(result.complete).toBe(true);
    expect(result.candidates).toHaveLength(1);
    expect(api.query_players.mock.calls.map((call) => call[1].name)).toEqual(["ari", "Kelly"]);
});

test.each(["Tõnisson", "To\u0303nisson", "TÕNISSON"])(
    "selectively discovers %s beyond the all-player budget in a large source",
    async (surname) => {
        const { library, api } = setup();
        const targetId = REFERENCE_SEARCH_LIMITS.requests * REFERENCE_SEARCH_LIMITS.pageSize + 1;
        const white = { id: targetId, name: "TÕNISSON, Tõnu".normalize("NFD"), elo: 2520 };
        const black = { id: targetId + 1, name: game.black, elo: 2651 };
        const largeGame = { ...game, white: white.name, white_id: white.id, black_id: black.id };
        if (library.databases[0].type === "success")
            library.databases[0].player_count = targetId + 1;
        api.query_players.mockImplementation(async (_db, query) => {
            if (query.name) {
                const matches = [white, black].filter((player) =>
                    player.name.toLowerCase().includes(query.name!.toLowerCase()),
                );
                return { data: matches, count: matches.length };
            }
            const start = ((query.options.page ?? 1) - 1) * REFERENCE_SEARCH_LIMITS.pageSize;
            return {
                data: Array.from(
                    { length: Math.min(REFERENCE_SEARCH_LIMITS.pageSize, targetId + 1 - start) },
                    (_, index) => {
                        const id = start + index + 1;
                        return id === white.id
                            ? white
                            : id === black.id
                              ? black
                              : { id, name: "Unrelated, A", elo: null };
                    },
                ),
                count: targetId + 1,
            };
        });
        api.query_games.mockResolvedValue({ data: [largeGame], count: 1 });
        const citation = recognizeGameReferences(
            `0-1 ${surname},T (2520)-Bluebaum,M (2651) 2022 (3)`,
        )[0];
        const result = await lookupGameReference(citation, new AbortController().signal, api);
        expect(result.complete).toBe(true);
        expect(result.candidates).toEqual([
            {
                database,
                source: "Source A (source-a.db3)",
                game: largeGame,
                verification: "verified",
            },
        ]);
        expect(api.query_players).toHaveBeenCalledTimes(2);
        expect(api.query_players.mock.calls.map((call) => call[1].name?.toLowerCase())).toEqual([
            "nisson",
            "bluebaum",
        ]);
        expect(api.query_games.mock.calls[0][1]).toMatchObject({
            player1: targetId,
            player2: targetId + 1,
            sides: "WhiteBlack",
        });
    },
);

test("surnames without an ASCII run fall back to bounded full player queries", async () => {
    const { api } = setup();
    api.query_players.mockResolvedValue({
        data: [
            { id: 1, name: "李, Lin", elo: null },
            { id: 2, name: "王, Wei", elo: null },
        ],
        count: 2,
    });
    api.query_games.mockResolvedValue({
        data: [{ ...game, white: "李, Lin", black: "王, Wei" }],
        count: 1,
    });
    const citation = recognizeGameReferences("0-1 李,L-王,W")[0];
    const result = await lookupGameReference(citation, new AbortController().signal, api);
    expect(result.complete).toBe(true);
    expect(result.candidates).toHaveLength(1);
    expect(api.query_players.mock.calls.map((call) => call[1].name)).toEqual([
        undefined,
        undefined,
    ]);
});

test("bounded failure retention never hides an incomplete search", async () => {
    const { library, search } = setup();
    library.unread = Array.from({ length: 101 }, (_, index) => ({
        filename: `Unread ${index}`,
        error: "Unread source",
    }));
    const result = await search();
    expect(result.complete).toBe(false);
    expect(result.failures).toHaveLength(REFERENCE_SEARCH_LIMITS.failures);
    expect(result.failures.at(-1)).toEqual({ source: "", category: "budget" });
});

test("request and retention limits remain visibly incomplete", async () => {
    const { api, search } = setup();
    api.query_players.mockResolvedValue({
        data: Array.from({ length: 100 }, (_, id) => ({ id, name: "Unrelated, A", elo: null })),
        count: null,
    });
    const result = await search();
    expect(api.query_players).toHaveBeenCalledTimes(REFERENCE_SEARCH_LIMITS.requests);
    expect(result).toMatchObject({
        complete: false,
        failures: [{ source: "Source A (source-a.db3)", category: "budget" }],
    });
    const next = setup();
    next.api.query_games.mockImplementation(async (_db, query) => ({
        data: Array.from({ length: 100 }, (_, id) => ({
            ...game,
            id: ((query.options?.page ?? 1) - 1) * 100 + id,
        })),
        count: 200,
    }));
    const bounded = await next.search();
    expect(bounded.candidates).toHaveLength(100);
    expect(bounded.complete).toBe(false);
});

test("aborted lookup rejects after late native responses", async () => {
    const { api, search } = setup();
    const controller = new AbortController();
    api.query_games.mockImplementationOnce(async () => {
        controller.abort();
        return { data: [game], count: 1 };
    });
    await expect(search(controller.signal)).rejects.toMatchObject({ name: "AbortError" });
});
