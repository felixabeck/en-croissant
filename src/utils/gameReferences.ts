import type {
    DatabaseHandle,
    ErrorCategory,
    NormalizedGame,
    Outcome,
    Player,
    QueryResponse,
} from "@/bindings";
import { normalizeError, type AppErrorCategory } from "@/platform/errors";
import { getDatabases, query_games, query_players } from "./db";

export type ReferencePlayer = { surname: string; initials: string; rating?: number };
export type GameReference = {
    start: number;
    end: number;
    label: string;
    outcome: Outcome;
    white: ReferencePlayer;
    black: ReferencePlayer;
    /** Visible tail, interpreted only against a candidate's event/site headers. */
    context: string;
    /** The recognizer found an explicit closing round, rather than an ambiguous tail. */
    closed: boolean;
    /** Lexical label hints, never query filters or verified game metadata. */
    event?: string;
    year?: string;
    round?: string;
};

const surname = String.raw`[\p{L}\p{M}][\p{L}\p{M}'’\-]*(?: +[\p{L}\p{M}][\p{L}\p{M}'’\-]*)*`;
const player = String.raw`(${surname}),\s*([\p{L}](?:[.\-]?[\p{Lu}])*\.?)(?![\p{L}\p{M}])(?:\s*\((\d{3,4})\))?`;
const pair = new RegExp(
    String.raw`(?<![\p{L}\p{N}/-])(1-0|0-1|1/2-1/2|½-½)\s+${player}\s*-\s*${player}`,
    "gu",
);

/** Offsets refer to visible text from the safe comment reader, never stored Markdown. */
export function recognizeGameReferences(text: string): GameReference[] {
    const references: GameReference[] = [];
    const pairs = [...text.matchAll(pair)];
    for (const [index, match] of pairs.entries()) {
        const start = match.index;
        const pairEnd = start + match[0].length;
        const tail = text.slice(pairEnd, pairs[index + 1]?.index).split("\n")[0];
        // A round closes the visible citation. Preserve an unterminated tail rather than
        // treating an event's first numeral as the date or discarding its remaining site.
        const terminator = / +\((\d+(?:\.\d+)*|[A-Za-z])\)/.exec(tail);
        const visibleTail = (
            terminator ? tail.slice(0, terminator.index + terminator[0].length) : tail
        ).trimEnd();
        const context = visibleTail.trim();
        const end = terminator ? pairEnd + visibleTail.length : pairEnd;
        const metadata =
            /^(?:(.*?) +)?((?:18|19|20|21)\d{2})(?: +\((\d+(?:\.\d+)*|[A-Za-z])\))?$/.exec(context);
        const withoutYear = metadata ? null : /^(.*?) *\((\d+(?:\.\d+)*|[A-Za-z])\)$/.exec(context);
        let event: string | undefined;
        let year: string | undefined;
        let round: string | undefined;
        if (metadata && !/(?:1-0|0-1|1\/2-1\/2|½-½)/.test(metadata[1] ?? "")) {
            event = metadata[1]?.trim() || undefined;
            year = metadata[2];
            round = metadata[3];
        } else if (withoutYear && !/(?:1-0|0-1|1\/2-1\/2|½-½)/.test(withoutYear[1])) {
            event = withoutYear[1].trim();
            round = withoutYear[2];
        }
        references.push({
            start,
            end,
            label: text.slice(start, end),
            outcome: match[1] === "½-½" ? "1/2-1/2" : (match[1] as Outcome),
            white: {
                surname: match[2],
                initials: match[3],
                rating: match[4] ? Number(match[4]) : undefined,
            },
            black: {
                surname: match[5],
                initials: match[6],
                rating: match[7] ? Number(match[7]) : undefined,
            },
            context,
            closed: Boolean(terminator),
            event,
            year,
            round,
        });
    }
    return references.filter(
        (reference, index) => index === 0 || reference.start >= references[index - 1].end,
    );
}

const normalized = (text: string) =>
    text.normalize("NFC").toLocaleLowerCase("en").replace(/’/g, "'").replace(/\s+/g, " ").trim();
const initialsOf = (text: string) => normalized(text).replace(/[.\s-]/g, "");

export function matchesReferencePlayer(reference: ReferencePlayer, name: string | null): boolean {
    if (!name) return false;
    const comma = name.indexOf(",");
    let given: string;
    if (comma >= 0) {
        if (normalized(name.slice(0, comma)) !== normalized(reference.surname)) return false;
        given = name.slice(comma + 1).trim();
    } else {
        const suffix = ` ${normalized(reference.surname)}`;
        if (!normalized(name).endsWith(suffix)) return false;
        given = normalized(name).slice(0, -suffix.length);
    }
    if (!given) return false;
    const wanted = initialsOf(reference.initials);
    const words = given.split(/[\s-]+/).filter(Boolean);
    const abbreviated =
        words.every((word) => [...word.replace(/\./g, "")].length === 1) ||
        /^[\p{L}](?:\.[\p{L}])+\.?$/u.test(given) ||
        /^[\p{Lu}]{2,4}$/u.test(given);
    const actual = abbreviated
        ? initialsOf(given)
        : words.map((word) => [...normalized(word)][0]).join("");
    return actual.startsWith(wanted);
}

type ReferenceVerification = "verified" | "unverified" | "rejected";

function metadataVerification(
    reference: GameReference,
    game: NormalizedGame,
): ReferenceVerification {
    const context = normalized(reference.context);
    if (!context) return "verified";
    const known = (value: string) => (value && !/^\?+$/.test(value) ? normalized(value) : "");
    const event = known(game.event);
    const site = known(game.site);
    const prefixes = [
        { text: event && site ? `${event} ${site}` : "", includesSite: true },
        { text: event, includesSite: false },
        { text: site, includesSite: true },
    ]
        .filter((prefix) => prefix.text)
        .sort((a, b) => b.text.length - a.text.length);
    const prefix = prefixes.find(({ text }) => context === text || context.startsWith(`${text} `));
    const startsFields = /^(?:(?:18|19|20|21)\d{2}(?:\s|$)|\()/;
    if (!prefix && !startsFields.test(context) && reference.closed && event) return "rejected";
    const remaining = prefix ? context.slice(prefix.text.length).trim() : context;
    // An unclosed non-field tail is prose. Its incidental years are not citation dates.
    if (!reference.closed && remaining && !startsFields.test(remaining)) return "unverified";
    // A closed citation or field-led tail still supplies metadata constraints.
    if (
        reference.closed &&
        prefix &&
        !prefix.includesSite &&
        site &&
        remaining &&
        !startsFields.test(remaining)
    )
        return "rejected";

    const years = /(?<![\p{L}\p{N}])((?:18|19|20|21)\d{2})(?![\p{L}\p{N}])/gu;
    const rounds = /\((\d+(?:\.\d+)*|[A-Za-z])\)/g;
    let verified = true;
    for (const [, year] of remaining.matchAll(years)) {
        const actual = /^\d{4}/.exec(game.date ?? "")?.[0];
        if (actual && actual !== year) return "rejected";
        if (!actual) verified = false;
    }
    for (const [, round] of remaining.matchAll(rounds)) {
        const actual = known(game.round ?? "");
        if (actual && actual !== normalized(round)) return "rejected";
        if (!actual) verified = false;
    }
    const residual = remaining.replace(years, "").replace(rounds, "").trim();
    if (
        prefix &&
        !prefix.includesSite &&
        site &&
        residual &&
        (reference.closed || startsFields.test(remaining))
    )
        return "rejected";
    return verified && !residual ? "verified" : "unverified";
}

function referenceGameVerification(
    reference: GameReference,
    game: NormalizedGame,
): ReferenceVerification {
    if (
        !(
            matchesReferencePlayer(reference.white, game.white) &&
            matchesReferencePlayer(reference.black, game.black) &&
            game.result === reference.outcome &&
            (reference.white.rating === undefined || game.white_elo === reference.white.rating) &&
            (reference.black.rating === undefined || game.black_elo === reference.black.rating)
        )
    )
        return "rejected";
    return metadataVerification(reference, game);
}

/** Whether an occurrence may be offered. Lookup retains its separate metadata certainty. */
export function matchesReferenceGame(reference: GameReference, game: NormalizedGame): boolean {
    return referenceGameVerification(reference, game) !== "rejected";
}

export type ReferenceOccurrence = {
    database: DatabaseHandle;
    source: string;
    game: NormalizedGame;
    verification: Exclude<ReferenceVerification, "rejected">;
};
export type ReferenceFailure = {
    source: string;
    category: AppErrorCategory | "unavailable" | "omitted" | "budget";
    /** Discovery already provides localized, safe guidance. Query failures use category keys. */
    message?: string;
    backendCategory?: ErrorCategory;
    databaseAdmission?: true;
};
function sourceFailure(source: string, error: unknown): ReferenceFailure {
    const failure = normalizeError(error);
    return {
        source,
        category: failure.category,
        ...(failure.backendCategory ? { backendCategory: failure.backendCategory } : {}),
        ...(failure.databaseAdmission ? { databaseAdmission: true } : {}),
    };
}
export type ReferenceSearch = {
    candidates: ReferenceOccurrence[];
    failures: ReferenceFailure[];
    complete: boolean;
};
export const REFERENCE_SEARCH_LIMITS = {
    pageSize: 100,
    requests: 256,
    sources: 64,
    candidates: 100,
    players: 256,
    failures: 100,
} as const;
const apis = { getDatabases, query_games, query_players };

/** One fresh read-only traversal. Every page, retained ID and result has an explicit bound. */
export async function lookupGameReference(
    reference: GameReference,
    signal: AbortSignal,
    api: typeof apis = apis,
): Promise<ReferenceSearch> {
    const candidates: ReferenceOccurrence[] = [];
    const failures: ReferenceFailure[] = [];
    const addFailure = (failure: ReferenceFailure) => {
        if (failures.length < REFERENCE_SEARCH_LIMITS.failures) failures.push(failure);
        else failures[REFERENCE_SEARCH_LIMITS.failures - 1] = { source: "", category: "budget" };
    };
    let requests = 0;
    const check = () => signal.throwIfAborted();
    const budget = (source: string) => {
        if (!failures.some((failure) => failure.source === source && failure.category === "budget"))
            addFailure({ source, category: "budget" });
    };
    const pages = async <T>(
        source: string,
        query: (page: number) => Promise<QueryResponse<T[]>>,
        visit: (item: T) => boolean,
    ) => {
        for (let page = 1; ; page++) {
            check();
            if (requests >= REFERENCE_SEARCH_LIMITS.requests) {
                budget(source);
                return;
            }
            requests++;
            const response = await query(page);
            check();
            for (const item of response.data)
                if (!visit(item)) {
                    budget(source);
                    return;
                }
            if (
                response.count !== null
                    ? page * REFERENCE_SEARCH_LIMITS.pageSize >= response.count
                    : response.data.length < REFERENCE_SEARCH_LIMITS.pageSize
            )
                return;
            // An unexpectedly empty page before count is not proof of an exhaustive read.
            if (response.data.length === 0) {
                budget(source);
                return;
            }
        }
    };
    let library;
    try {
        library = await api.getDatabases({ signal });
        check();
    } catch (error) {
        check();
        return {
            candidates,
            failures: [sourceFailure("", error)],
            complete: false,
        };
    }
    for (const unread of library.unread)
        addFailure({ source: unread.filename, category: "unavailable", message: unread.error });
    for (const collection of library.collections ?? []) {
        if (collection.status === "retired") continue;
        if (!collection.database) addFailure({ source: collection.name, category: "unavailable" });
        if (collection.omitted > 0) addFailure({ source: collection.name, category: "omitted" });
    }
    if (library.databases.length > REFERENCE_SEARCH_LIMITS.sources) budget("");
    for (const database of library.databases.slice(0, REFERENCE_SEARCH_LIMITS.sources)) {
        check();
        const source =
            database.type === "success" && database.title !== database.filename
                ? `${database.title} (${database.filename})`
                : database.filename;
        if (database.type !== "success") {
            addFailure({ source, category: "unavailable", message: database.error });
            continue;
        }
        try {
            const players = async (person: ReferencePlayer) => {
                const ids: Player[] = [];
                // SQLite NOCASE is ASCII-only. NFC keeps the ASCII fragment invariant across
                // composed/decomposed spellings. Scan all players only without such a fragment.
                await pages<Player>(
                    source,
                    (page) =>
                        api.query_players(
                            database.file,
                            {
                                name: person.surname
                                    .normalize("NFC")
                                    .match(/[A-Za-z]+/g)
                                    ?.sort((a, b) => b.length - a.length)[0],
                                nameMatch: "contains",
                                options: {
                                    page,
                                    pageSize: REFERENCE_SEARCH_LIMITS.pageSize,
                                    sort: "id",
                                    direction: "asc",
                                    skipCount: false,
                                },
                            },
                            { signal },
                        ),
                    (player) => {
                        if (matchesReferencePlayer(person, player.name)) {
                            if (ids.length >= REFERENCE_SEARCH_LIMITS.players) return false;
                            ids.push(player);
                        }
                        return true;
                    },
                );
                return ids;
            };
            const whites = await players(reference.white);
            if (!whites.length) continue;
            const blacks = await players(reference.black);
            const seen = new Set<number>();
            pairs: for (const white of whites)
                for (const black of blacks) {
                    await pages<NormalizedGame>(
                        source,
                        (page) =>
                            api.query_games(
                                database.file,
                                {
                                    player1: white.id,
                                    player2: black.id,
                                    sides: "WhiteBlack",
                                    outcome: reference.outcome,
                                    options: {
                                        page,
                                        pageSize: REFERENCE_SEARCH_LIMITS.pageSize,
                                        sort: "id",
                                        direction: "asc",
                                        skipCount: false,
                                    },
                                },
                                { signal },
                            ),
                        (game) => {
                            const verification = referenceGameVerification(reference, game);
                            if (!seen.has(game.id) && verification !== "rejected") {
                                if (candidates.length >= REFERENCE_SEARCH_LIMITS.candidates)
                                    return false;
                                seen.add(game.id);
                                candidates.push({
                                    database: database.file,
                                    source,
                                    game,
                                    verification,
                                });
                            }
                            return true;
                        },
                    );
                    if (
                        requests >= REFERENCE_SEARCH_LIMITS.requests ||
                        candidates.length >= REFERENCE_SEARCH_LIMITS.candidates
                    ) {
                        budget(source);
                        break pairs;
                    }
                }
        } catch (error) {
            check();
            addFailure(sourceFailure(source, error));
        }
    }
    check();
    return { candidates, failures, complete: failures.length === 0 };
}
