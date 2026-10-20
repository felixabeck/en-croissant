import type { DatabaseList, ManagedDatabaseInfo } from "@/utils/db";
import { capabilityKey } from "@/utils/pathCapabilities";

export function accountDatabaseFilename(username: string, type: "lichess" | "chesscom"): string {
    return `${username}_${type}.db3`;
}

export type AccountDatabaseListing = Pick<DatabaseList, "databases" | "unread" | "collections">;
export type AccountDatabaseIssue = { type: "unavailable"; filenames: string[]; error?: string };

/** Canonical links win. Legacy case variants require one distinct, fully readable association. */
export function findAccountDatabase(
    listing: AccountDatabaseListing | undefined,
    provider: "lichess" | "chesscom",
    username: string,
    listingAvailable = true,
): ManagedDatabaseInfo | AccountDatabaseIssue | null {
    if (!listing || !listingAvailable) return { type: "unavailable", filenames: [] };
    const canonical = username.toLowerCase();
    const linked = listing.databases.filter(
        (db) =>
            db.collection?.account?.provider === provider &&
            db.collection.account.account.toLowerCase() === canonical,
    );
    const registered =
        listing.collections?.filter(
            (collection) =>
                collection.status !== "retired" &&
                collection.account?.provider === provider &&
                collection.account.account.toLowerCase() === canonical,
        ) ?? [];
    if (registered.length > 1 || (registered.length > 0 && linked.length === 0)) {
        return { type: "unavailable", filenames: registered.map((collection) => collection.name) };
    }
    const suffix = `_${provider}.db3`;
    const legacyMatches = (filename: string) =>
        filename.endsWith(suffix) && filename.slice(0, -suffix.length).toLowerCase() === canonical;
    const candidates =
        linked.length > 0
            ? linked
            : listing.databases.filter(
                  (db) => !db.collection?.account && legacyMatches(db.filename),
              );
    const distinct = [...new Map(candidates.map((db) => [capabilityKey(db.file), db])).values()];
    const unread =
        linked.length > 0 ? [] : listing.unread.filter((db) => legacyMatches(db.filename));
    if (distinct.length + unread.length > 1 || unread.length > 0) {
        return {
            type: "unavailable",
            filenames: [...distinct, ...unread].map((db) => db.filename),
            error: distinct.length === 0 && unread.length === 1 ? unread[0].error : undefined,
        };
    }
    return distinct[0] ?? null;
}
