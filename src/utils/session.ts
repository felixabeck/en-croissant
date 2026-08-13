import { tauri } from "@/platform/tauri";
import { z } from "zod";
import type { ChessComStats } from "@/utils/chess.com/api";
import { getLichessAccount, type LichessAccount } from "@/utils/lichess/api";

export type LichessSession = {
    /** Opaque native credential identifier. It is never a bearer token. */
    handle?: string;
    username: string;
    account: LichessAccount;
};

export type ChessComSession = {
    username: string;
    stats: ChessComStats;
};

export type Session = {
    lichess?: LichessSession;
    chessCom?: ChessComSession;
    player?: string;
    updatedAt: number;
};

/** Storage boundary: the Lichess object is deliberately `strip`ped so an old `accessToken`
 * field can never be hydrated into Jotai state, even when Account screens never mount. */
export const sessionSchema = z
    .object({
        lichess: z
            .object({
                handle: z.string().optional(),
                username: z.string(),
                account: z.custom<LichessAccount>(
                    (value) => value !== null && typeof value === "object",
                ),
            })
            .strip()
            .optional(),
        chessCom: z
            .object({
                username: z.string(),
                stats: z.custom<ChessComStats>(
                    (value) => value !== null && typeof value === "object",
                ),
            })
            .strip()
            .optional(),
        player: z.string().optional(),
        updatedAt: z.number(),
    })
    .strip();

export const sessionsSchema: z.ZodType<Session[]> = z.array(sessionSchema);

const SESSION_STORAGE_KEY = "sessions";

export class SessionSanitizationError extends Error {
    constructor() {
        super("account storage could not be sanitized");
        this.name = "SessionSanitizationError";
    }
}

function parsePersistedSessions(): unknown[] {
    try {
        const raw = localStorage.getItem(SESSION_STORAGE_KEY);
        const parsed: unknown = raw === null ? [] : JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        // Never log storage contents: a legacy record can contain a bearer token.
        return [];
    }
}

function persistSessions(sessions: Session[]): void {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessions));
}

function persistSanitizedSessions(sessions: Session[]): void {
    try {
        persistSessions(sessions);
    } catch {
        try {
            localStorage.removeItem(SESSION_STORAGE_KEY);
        } catch {
            throw new SessionSanitizationError();
        }
    }
}

/**
 * Removes plaintext bearer tokens synchronously, before React mounts any feature.  The returned
 * migration input stays only in this startup call's memory; no retry path can re-persist it.
 */
function sanitizeLegacySessions(): {
    sessions: Session[];
    migrations: { username: string; token: string }[];
} {
    const migrations: { username: string; token: string }[] = [];
    const sessions: Session[] = [];
    for (const storedSession of parsePersistedSessions()) {
        if (
            storedSession === null ||
            typeof storedSession !== "object" ||
            Array.isArray(storedSession)
        ) {
            continue;
        }
        const session = { ...storedSession } as Record<string, unknown>;
        const storedLichess = session.lichess;
        if (
            storedLichess !== null &&
            typeof storedLichess === "object" &&
            !Array.isArray(storedLichess)
        ) {
            const { accessToken, ...lichess } = storedLichess as Record<string, unknown>;
            if (
                typeof accessToken === "string" &&
                accessToken !== "" &&
                typeof lichess.username === "string" &&
                lichess.username !== ""
            ) {
                migrations.push({ username: lichess.username, token: accessToken });
            }
            session.lichess = lichess;
        }
        const parsed = sessionSchema.safeParse(session);
        if (parsed.success) sessions.push(parsed.data);
    }
    // This write is deliberately before any await: an app crash during native migration cannot
    // resurrect plaintext credentials on the next launch.
    persistSanitizedSessions(sessions);
    return { sessions, migrations };
}

/**
 * Application bootstrap for native Lichess accounts. It runs before mounting React: legacy
 * token records are scrubbed synchronously, migrated once in memory, then native metadata is
 * reconciled into a deduplicated public-session list.
 */
export async function initializePersistedSessions(): Promise<void> {
    const { sessions: sanitized, migrations } = sanitizeLegacySessions();
    const migrated = await Promise.all(
        migrations.map(async ({ username, token }) => {
            try {
                const result = await tauri.migrateLegacyLichessToken(username, token);
                return result;
            } catch {
                return null;
            }
        }),
    );

    let accounts: Awaited<ReturnType<typeof tauri.listLichessAccounts>> = [];
    try {
        accounts = await tauri.listLichessAccounts();
    } catch {
        // The sanitized public sessions remain usable offline. A later startup reconciles them.
    }
    const authoritative = new Map(
        [
            ...accounts,
            ...migrated.filter(
                (account): account is NonNullable<typeof account> =>
                    account !== null &&
                    account !== undefined &&
                    typeof account.username === "string" &&
                    typeof account.handle === "string",
            ),
        ].map((account: { username: string; handle: string }) => [
            account.username.toLocaleLowerCase(),
            account,
        ]),
    );
    const reconciled = sanitized.map((session) => {
        const lichess = session.lichess;
        if (!lichess) return session;
        const account = authoritative.get(lichess.username.toLocaleLowerCase());
        return account ? { ...session, lichess: { ...lichess, handle: account.handle } } : session;
    });
    const existing = new Set(
        reconciled.flatMap((session) =>
            session.lichess?.username ? [session.lichess.username.toLocaleLowerCase()] : [],
        ),
    );
    for (const account of authoritative.values()) {
        const key = account.username.toLocaleLowerCase();
        if (existing.has(key)) continue;
        try {
            const profile = await getLichessAccount({ handle: account.handle });
            if (!profile) continue;
            reconciled.push({
                player: account.username,
                updatedAt: Date.now(),
                lichess: { username: account.username, handle: account.handle, account: profile },
            });
            existing.add(key);
        } catch {
            // A native credential is still retained; its public card appears after the next
            // successful reconciliation rather than synthesising unverified profile data.
        }
    }
    persistSessions(reconciled);
}

export function upsertLichessSession(
    sessions: Session[],
    player: string,
    lichess: LichessSession,
): Session[] {
    return [
        ...sessions.filter((session) => session.lichess?.username !== lichess.username),
        {
            lichess,
            player: player || lichess.username,
            updatedAt: Date.now(),
        },
    ];
}
