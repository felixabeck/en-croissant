import { atom, type WritableAtom } from "jotai";
import equal from "fast-deep-equal";
import type {
    PracticeDeckInventory,
    PracticeDeckSnapshot,
    PracticeMigrationOutcome,
    PracticeReviewPage,
} from "@/bindings";
import { normalizeError, type AppError } from "@/platform/errors";
import { tauri } from "@/platform/tauri";
import i18n from "@/i18n";
import type { ReviewLog } from "ts-fsrs";
import { z } from "zod";
import { type Position, positionSchema } from "@/components/files/opening";
import { pathRefSchema } from "@/utils/pathCapabilities";
import { getBoardState } from "@/utils/treeReducer";
import { reportPersistError } from "./persistError";

export const PRACTICE_SYNC_DEBOUNCE_MS = 250;
export const PRACTICE_MAX_CONFLICT_RETRIES = 2;
export const PRACTICE_LOG_PAGE_SIZE = 100;
/** Mirrors the native u32::MAX refusal for optimistic practice revisions. */
const PRACTICE_REVISION_MAX = 0xffffffff;

/** The old browser shape is retained only as input for startup and inline migration. */
export const reviewLogSchema = z
    .object({
        fen: z.string(),
    })
    .passthrough();

export const practiceDataSchema = z.object({
    positions: positionSchema.array(),
    logs: reviewLogSchema.array(),
});

export type PracticeData = {
    positions: Position[];
    logs: (ReviewLog & { fen: string })[];
};

export type PracticeDeckStatus =
    | "loading"
    | "ready"
    | "read-failed"
    | "write-blocked"
    | "write-pending";

export type PracticeDeckValue = {
    positions: Position[];
    revision: number;
    generation: number;
    unappliedReviews: number;
    orphansAcknowledged: boolean;
    status: PracticeDeckStatus;
    repairable?: boolean;
    error?: AppError;
};

export type PracticeDeckKey = { file: string; game: number };

export type PracticeLegacyDeckKey = {
    key: string;
    identity: PracticeDeckKey;
};

export type PracticeLegacyDeckScan = {
    keys: PracticeLegacyDeckKey[];
    trusted: boolean;
    complete: boolean;
};

export type PracticeMigrationDeckOutcome = {
    key: string;
    identity: PracticeDeckKey;
    status: PracticeMigrationOutcome["status"] | "failed";
    entries?: number;
    positions?: number;
    error?: AppError;
};

export type PracticeMigrationPassResult = {
    outcomes: PracticeMigrationDeckOutcome[];
    inventory: PracticeDeckInventory | null;
    scanTrusted: boolean;
    inventoryTrusted: boolean;
};

export type PracticeRatingMutation = {
    type: "rating";
    positions: Position[];
    entry: ReviewLog & { fen: string };
    entryId: string;
    sourcePosition: Position;
};

export type PracticeDeckMutation =
    | PracticeRatingMutation
    | { type: "sync"; positions: Position[] }
    | { type: "reset"; positions: Position[] }
    | { type: "acknowledge" }
    | { type: "repair" }
    | { type: "retry" };

export type PracticeDeckAction =
    | PracticeDeckValue
    | PracticeDeckMutation
    | ((current: PracticeDeckValue) => PracticeDeckValue);

const positionsDocumentSchema = z.object({ positions: positionSchema.array() });

type PracticeMigrationFailure = { error: AppError; repairable: boolean };
let practiceMigrationFailures = new Map<string, PracticeMigrationFailure>();
let practiceWritesBlocked = false;
let reportedInventoryAnomalies = new Set<string>();
let practiceMigrationPromise: Promise<PracticeMigrationPassResult> | undefined;

const LEGACY_DECK_KEY = /^deck-(.+)-(-?\d+)$/;

function identityKey(identity: PracticeDeckKey): string {
    return `${identity.file}\u0000${identity.game}`;
}

function displayIdentity(identity: PracticeDeckKey): string {
    return `${identity.file} (${identity.game})`;
}

function errorAsAppError(error: unknown): AppError {
    return normalizeError(error);
}

class PracticeMigrationBlockedError extends Error {
    constructor(
        readonly appError: AppError,
        readonly repairable: boolean,
    ) {
        super(appError.message, { cause: appError });
    }
}

function reportMigrationFailures(
    failures: Array<{ identity?: PracticeDeckKey; label?: string }>,
    reasonKey:
        | "Board.Practice.MigrationFailed"
        | "Board.Practice.MigrationScanFailed"
        | "Board.Practice.InventoryDamaged",
): void {
    const labels = failures.map(({ identity, label }) =>
        identity ? displayIdentity(identity) : (label ?? i18n.t("Board.Practice.Data")),
    );
    if (typeof reportPersistError === "function") {
        reportPersistError(
            new Error(
                i18n.t(reasonKey, {
                    decks: labels.length > 0 ? labels.join(", ") : i18n.t("Board.Practice.Data"),
                }),
            ),
        );
    }
}

/** Enumerate only legacy deck key names; values are intentionally not read here. */
export function scanLegacyPracticeDeckKeys(storage?: Storage): PracticeLegacyDeckScan {
    const keys: PracticeLegacyDeckKey[] = [];
    let trusted = true;
    try {
        const source = storage ?? globalThis.localStorage;
        for (let index = 0; index < source.length; index += 1) {
            const key = source.key(index);
            if (!key?.startsWith("deck-")) continue;
            const match = LEGACY_DECK_KEY.exec(key);
            const game = match ? Number(match[2]) : Number.NaN;
            if (
                !match ||
                !Number.isSafeInteger(game) ||
                !pathRefSchema.safeParse({ id: match[1] }).success
            ) {
                trusted = false;
                continue;
            }
            keys.push({ key, identity: { file: match[1], game } });
        }
        return { keys, trusted, complete: true };
    } catch {
        return { keys, trusted: false, complete: false };
    }
}

export function reportPracticeInventoryAnomalies(inventory: PracticeDeckInventory): void {
    const newAnomalies = inventory.anomalies.filter((anomaly) => {
        const key = `${anomaly.kind}\u0000${anomaly.leaf}`;
        if (reportedInventoryAnomalies.has(key)) return false;
        reportedInventoryAnomalies.add(key);
        return true;
    });
    if (newAnomalies.length === 0) return;
    for (const anomaly of newAnomalies) {
        if (anomaly.fileId !== null && anomaly.game !== null) {
            practiceMigrationFailures.set(
                identityKey({ file: anomaly.fileId, game: anomaly.game }),
                {
                    error: {
                        ...errorAsAppError(new Error(i18n.t("Board.Practice.InventoryDamaged"))),
                        ...(anomaly.kind === "Unreadable"
                            ? { backendCategory: "io" as const }
                            : {}),
                    },
                    repairable: anomaly.kind !== "Unreadable",
                },
            );
        }
    }
    reportMigrationFailures(
        newAnomalies.map((anomaly) =>
            anomaly.fileId !== null && anomaly.game !== null
                ? { identity: { file: anomaly.fileId, game: anomaly.game } }
                : { label: anomaly.leaf },
        ),
        "Board.Practice.InventoryDamaged",
    );
}

function sameIdentity(left: PracticeDeckKey, right: { fileId: string; game: number }): boolean {
    return left.file === right.fileId && left.game === right.game;
}

function clearIdentityFromMigrationResult(
    result: PracticeMigrationPassResult,
    identity: PracticeDeckKey,
): PracticeMigrationPassResult {
    const key = identityKey(identity);
    return {
        ...result,
        outcomes: result.outcomes.filter(
            (outcome) => identityKey(outcome.identity) !== key || outcome.status !== "failed",
        ),
        inventory: result.inventory
            ? {
                  ...result.inventory,
                  anomalies: result.inventory.anomalies.filter(
                      (anomaly) =>
                          anomaly.fileId === null ||
                          anomaly.game === null ||
                          !sameIdentity(identity, {
                              fileId: anomaly.fileId,
                              game: anomaly.game,
                          }),
                  ),
              }
            : null,
    };
}

function clearPracticeIdentityState(identity: PracticeDeckKey, rerunMigration: boolean): void {
    practiceMigrationFailures.delete(identityKey(identity));
    const previous = practiceMigrationPromise;
    if (!previous) return;
    const cleaned = previous.then((result) => clearIdentityFromMigrationResult(result, identity));
    practiceMigrationPromise = rerunMigration ? cleaned.then(() => migrationPass()) : cleaned;
}

function inventoryIdentity(identity: { fileId: string; game: number }): string {
    return identityKey({ file: identity.fileId, game: identity.game });
}

function healthyNativeIdentities(inventory: PracticeDeckInventory): Set<string> {
    const damaged = new Set(
        inventory.anomalies
            .filter((anomaly) => anomaly.fileId !== null && anomaly.game !== null)
            .map((anomaly) => inventoryIdentity({ fileId: anomaly.fileId!, game: anomaly.game! })),
    );
    return new Set(
        inventory.decks.map(inventoryIdentity).filter((identity) => !damaged.has(identity)),
    );
}

function legacyDocument(
    storage: Storage,
    legacy: PracticeLegacyDeckKey,
): { raw: string; data: PracticeData } {
    const raw = storage.getItem(legacy.key);
    if (raw === null) {
        throw new Error(i18n.t("Board.Practice.MigrationValueMissing"));
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw) as unknown;
    } catch (error) {
        throw new Error(i18n.t("Board.Practice.MigrationValueInvalid"), { cause: error });
    }
    const result = practiceDataSchema.safeParse(parsed);
    if (!result.success) {
        throw new Error(i18n.t("Board.Practice.MigrationValueInvalid"), { cause: result.error });
    }
    return { raw, data: result.data as unknown as PracticeData };
}

function outcomeForHeldDeck(legacy: PracticeLegacyDeckKey): PracticeMigrationDeckOutcome {
    return { key: legacy.key, identity: legacy.identity, status: "alreadyMigrated" };
}

async function migrateLegacyDeck(
    storage: Storage,
    legacy: PracticeLegacyDeckKey,
): Promise<PracticeMigrationDeckOutcome> {
    try {
        const document = legacyDocument(storage, legacy);
        const outcome = await migratePracticeDeck(
            legacy.identity.file,
            legacy.identity.game,
            document.raw,
        );
        if (
            outcome.status === "migrated" &&
            (outcome.entries !== document.data.logs.length ||
                outcome.positions !== document.data.positions.length)
        ) {
            throw new Error(i18n.t("Board.Practice.MigrationCountMismatch"));
        }
        practiceMigrationFailures.delete(identityKey(legacy.identity));
        return {
            key: legacy.key,
            identity: legacy.identity,
            status: outcome.status,
            entries: outcome.entries,
            positions: outcome.positions,
        };
    } catch (error) {
        const appError = errorAsAppError(error);
        practiceMigrationFailures.set(identityKey(legacy.identity), {
            error: appError,
            repairable: true,
        });
        return { key: legacy.key, identity: legacy.identity, status: "failed", error: appError };
    }
}

async function migrationPass(): Promise<PracticeMigrationPassResult> {
    const scan = scanLegacyPracticeDeckKeys();
    let inventory: PracticeDeckInventory | null = null;
    let inventoryTrusted = true;
    let globalFailure: string | undefined;
    try {
        inventory = await listPracticeDecks();
        reportPracticeInventoryAnomalies(inventory);
    } catch (error) {
        inventoryTrusted = false;
        practiceWritesBlocked = true;
        globalFailure = errorAsAppError(error).message;
    }

    if (!scan.complete || !scan.trusted) {
        practiceWritesBlocked = true;
        if (!scan.complete) globalFailure ??= "saved-data enumeration failed";
        else globalFailure ??= "saved-data enumeration found an invalid deck key";
    }

    const outcomes: PracticeMigrationDeckOutcome[] = [];
    if (scan.complete && inventoryTrusted && inventory) {
        const held = healthyNativeIdentities(inventory);
        let storage: Storage | null;
        try {
            storage = globalThis.localStorage;
        } catch {
            storage = null;
        }
        if (!storage) {
            practiceWritesBlocked = true;
            globalFailure ??= "saved-data storage is unavailable";
        } else {
            for (const legacy of scan.keys) {
                const outcome = held.has(identityKey(legacy.identity))
                    ? outcomeForHeldDeck(legacy)
                    : await migrateLegacyDeck(storage, legacy);
                outcomes.push(outcome);
            }
        }
    } else {
        for (const legacy of scan.keys) {
            const error = new Error(i18n.t("Board.Practice.MigrationScanFailed"));
            const appError = errorAsAppError(error);
            practiceMigrationFailures.set(identityKey(legacy.identity), {
                error: appError,
                repairable: true,
            });
            outcomes.push({
                key: legacy.key,
                identity: legacy.identity,
                status: "failed",
                error: appError,
            });
        }
    }

    const failures = outcomes.filter((outcome) => outcome.status === "failed");
    if (globalFailure) {
        reportMigrationFailures(
            [
                { label: globalFailure },
                ...failures.map((failure) => ({ identity: failure.identity })),
            ],
            "Board.Practice.MigrationScanFailed",
        );
    } else if (failures.length > 0) {
        reportMigrationFailures(
            failures.map((failure) => ({ identity: failure.identity })),
            "Board.Practice.MigrationFailed",
        );
    }
    if (scan.complete && scan.trusted && inventoryTrusted) practiceWritesBlocked = false;
    let result: PracticeMigrationPassResult = {
        outcomes,
        inventory,
        scanTrusted: scan.trusted,
        inventoryTrusted,
    };
    for (const outcome of outcomes) {
        if (outcome.status !== "failed") {
            result = clearIdentityFromMigrationResult(result, outcome.identity);
        }
    }
    return result;
}

function startPracticeMigrationPass(): Promise<PracticeMigrationPassResult> {
    const run = migrationPass().catch((error) => {
        practiceWritesBlocked = true;
        const appError = errorAsAppError(error);
        reportMigrationFailures(
            [{ label: appError.message }],
            "Board.Practice.MigrationScanFailed",
        );
        return {
            outcomes: [],
            inventory: null,
            scanTrusted: false,
            inventoryTrusted: false,
        } satisfies PracticeMigrationPassResult;
    });
    return run;
}

export function ensurePracticeMigration(): Promise<PracticeMigrationPassResult> {
    practiceMigrationPromise ??= startPracticeMigrationPass();
    return practiceMigrationPromise;
}

export function runPracticeMigrationPass(): Promise<PracticeMigrationPassResult> {
    const run = startPracticeMigrationPass();
    practiceMigrationPromise = run;
    return run;
}

function migrationBlock(identity: PracticeDeckKey): Error | null {
    if (practiceWritesBlocked) return new Error(i18n.t("Board.Practice.MigrationScanFailed"));
    const failure = practiceMigrationFailures.get(identityKey(identity));
    return failure ? new PracticeMigrationBlockedError(failure.error, failure.repairable) : null;
}

async function migrateLegacyDeckInline(identity: PracticeDeckKey): Promise<void> {
    const scan = scanLegacyPracticeDeckKeys();
    if (!scan.complete) {
        practiceWritesBlocked = true;
        throw new Error(i18n.t("Board.Practice.MigrationScanFailed"));
    }
    const legacy = scan.keys.find((entry) => identityKey(entry.identity) === identityKey(identity));
    if (!legacy) return;

    if (!scan.trusted) practiceWritesBlocked = true;

    let inventory: PracticeDeckInventory;
    try {
        inventory = await listPracticeDecks();
    } catch (error) {
        practiceWritesBlocked = true;
        throw error;
    }
    if (healthyNativeIdentities(inventory).has(identityKey(identity))) return;

    const outcome = await migrateLegacyDeck(globalThis.localStorage, legacy);
    if (outcome.status === "failed") {
        throw new Error(outcome.error?.message ?? i18n.t("Board.Practice.MigrationFailed"));
    }
    clearPracticeIdentityState(identity, false);
}

export function resetPracticeMigrationForTests(): void {
    practiceMigrationPromise = undefined;
    practiceMigrationFailures = new Map();
    practiceWritesBlocked = false;
    reportedInventoryAnomalies = new Set();
}

const emptyDeck = (status: PracticeDeckStatus = "loading"): PracticeDeckValue => ({
    positions: [],
    revision: 0,
    generation: 0,
    unappliedReviews: 0,
    orphansAcknowledged: true,
    status,
});

function invokePractice<T>(call: () => Promise<T>): Promise<T> {
    return call().catch((error) => {
        // Keep the backend category attached: conflict retry must not branch on the renderer's
        // coarser `validation` category or on a localized message.
        throw normalizeError(error);
    });
}

export async function loadPracticeDeck(
    fileId: string,
    game: number,
): Promise<PracticeDeckSnapshot | null> {
    return invokePractice(() => tauri.loadPracticeDeck(fileId, game));
}

export async function recordPracticeReview(
    fileId: string,
    game: number,
    generation: number,
    revision: number,
    baseRevision: number,
    positionsDocument: string,
    entry: string,
    entryId: string,
): Promise<number> {
    return invokePractice(() =>
        tauri.recordPracticeReview(
            fileId,
            game,
            generation,
            revision,
            baseRevision,
            positionsDocument,
            entry,
            entryId,
        ),
    );
}

export async function syncPracticePositions(
    fileId: string,
    game: number,
    generation: number,
    revision: number,
    positionsDocument: string,
): Promise<number> {
    return invokePractice(() =>
        tauri.syncPracticePositions(fileId, game, generation, revision, positionsDocument),
    );
}

export async function resetPracticeDeck(
    fileId: string,
    game: number,
    generation: number,
    revision: number,
    positionsDocument: string,
): Promise<number> {
    return invokePractice(() =>
        tauri.resetPracticeDeck(fileId, game, generation, revision, positionsDocument),
    );
}

export async function loadPracticeReviews(
    fileId: string,
    game: number,
    cursor: string | null,
    limit: number,
): Promise<PracticeReviewPage> {
    return invokePractice(() => tauri.loadPracticeReviews(fileId, game, cursor, limit));
}

export async function migratePracticeDeck(
    fileId: string,
    game: number,
    legacyDocument: string,
): Promise<PracticeMigrationOutcome> {
    return invokePractice(() => tauri.migratePracticeDeck(fileId, game, legacyDocument));
}

export async function acknowledgePracticeOrphans(
    fileId: string,
    game: number,
    generation: number,
    acknowledgedCount: number,
): Promise<null> {
    return invokePractice(() =>
        tauri.acknowledgePracticeOrphans(fileId, game, generation, acknowledgedCount),
    );
}

export async function repairPracticeDeck(fileId: string, game: number): Promise<null> {
    return invokePractice(() => tauri.repairPracticeDeck(fileId, game));
}

export async function listPracticeDecks(): Promise<PracticeDeckInventory> {
    return invokePractice(() => tauri.listPracticeDecks());
}

function parsePositionsDocument(document: string): Position[] {
    const parsed: unknown = JSON.parse(document);
    return positionsDocumentSchema.parse(parsed).positions as unknown as Position[];
}

function positionsDocument(positions: Position[]): string {
    return JSON.stringify({ positions });
}

function deckFromSnapshot(snapshot: PracticeDeckSnapshot): PracticeDeckValue {
    return {
        positions: parsePositionsDocument(snapshot.positionsDocument),
        revision: snapshot.revision,
        generation: snapshot.generation,
        unappliedReviews: snapshot.unappliedReviews,
        orphansAcknowledged: snapshot.orphansAcknowledged,
        status: "ready",
    };
}

function failureState(current: PracticeDeckValue, error: unknown): PracticeDeckValue {
    const practiceError = error instanceof PracticeMigrationBlockedError ? error : null;
    const normalized = normalizeError(practiceError?.appError ?? error);
    return {
        ...current,
        status: "read-failed",
        repairable: practiceError?.repairable ?? normalized.backendCategory !== "io",
        error: normalized,
    };
}

function writeFailureState(current: PracticeDeckValue, error: unknown): PracticeDeckValue {
    return {
        ...current,
        status: "write-blocked",
        error: normalizeError(error),
    };
}

function isMutation(update: PracticeDeckAction): update is PracticeDeckMutation {
    return typeof update === "object" && update !== null && "type" in update;
}

function readyState(value: PracticeDeckValue, positions: Position[]): PracticeDeckValue {
    return {
        ...value,
        positions,
        status: "ready",
        error: undefined,
    };
}

function sameCard(left: Position["card"], right: Position["card"]): boolean {
    return equal(JSON.parse(JSON.stringify(left)), JSON.parse(JSON.stringify(right)));
}

type DeckController = {
    identity: PracticeDeckKey;
    mounted: boolean;
    requestSequence: number;
    writeBlocked: boolean;
    committed: PracticeDeckValue | null;
    writeChain: Promise<void>;
    syncTimer: ReturnType<typeof setTimeout> | null;
    syncResolve: (() => void) | null;
};

function reportWriteFailure(error: unknown): void {
    reportPersistError(error);
}

function queuedWriteNotSaved(): Error {
    return new Error(i18n.t("Board.Practice.QueuedWriteNotSaved"));
}

class PracticeRatingDroppedError extends Error {
    constructor(
        readonly deck: PracticeDeckValue,
        cause: unknown,
    ) {
        super(i18n.t("Board.Practice.RatingDropped"), { cause });
    }
}

async function hydrate(identity: PracticeDeckKey): Promise<PracticeDeckValue> {
    if (identity.file === "") return emptyDeck("ready");
    await ensurePracticeMigration();
    const blocked = migrationBlock(identity);
    if (blocked) throw blocked;
    const snapshot = await loadPracticeDeck(identity.file, identity.game);
    return snapshot ? deckFromSnapshot(snapshot) : emptyDeck("ready");
}

async function persistRating(
    identity: PracticeDeckKey,
    committed: PracticeDeckValue,
    mutation: PracticeRatingMutation,
): Promise<PracticeDeckValue> {
    const baseRevision = committed.revision;
    let revision = committed.revision;
    let generation = committed.generation;
    let positions = mutation.positions;

    for (let retry = 0; ; retry += 1) {
        try {
            const nextRevision = await recordPracticeReview(
                identity.file,
                identity.game,
                generation,
                revision,
                baseRevision,
                positionsDocument(positions),
                JSON.stringify(mutation.entry),
                mutation.entryId,
            );
            return readyState(
                {
                    ...committed,
                    revision: nextRevision,
                    generation,
                },
                positions,
            );
        } catch (cause) {
            const error = normalizeError(cause);
            if (error.backendCategory !== "conflict") throw error;
            if (retry >= PRACTICE_MAX_CONFLICT_RETRIES) {
                throw new Error(i18n.t("Board.Practice.ConflictRetryExhausted"), {
                    cause: error,
                });
            }

            const reloaded = await loadPracticeDeck(identity.file, identity.game);
            if (!reloaded) {
                throw new Error(i18n.t("Board.Practice.DeckDisappeared"), {
                    cause: error,
                });
            }
            const reloadedDeck = deckFromSnapshot(reloaded);
            if (reloadedDeck.generation !== committed.generation) {
                throw new PracticeRatingDroppedError(reloadedDeck, error);
            }
            const boardState = getBoardState(mutation.sourcePosition.fen);
            const reloadedIndex = reloadedDeck.positions.findIndex(
                (position) => getBoardState(position.fen) === boardState,
            );
            const updatedPosition = positions.find(
                (position) => getBoardState(position.fen) === boardState,
            );
            const reloadedPosition =
                reloadedIndex === -1 ? undefined : reloadedDeck.positions[reloadedIndex];
            if (
                !reloadedPosition ||
                !updatedPosition ||
                !sameCard(reloadedPosition.card, mutation.sourcePosition.card)
            ) {
                throw new PracticeRatingDroppedError(reloadedDeck, error);
            }
            positions = reloadedDeck.positions.map((position, index) =>
                index === reloadedIndex ? { ...position, card: updatedPosition.card } : position,
            );
            revision = reloadedDeck.revision;
            generation = reloadedDeck.generation;
        }
    }
}

async function persistSync(
    identity: PracticeDeckKey,
    committed: PracticeDeckValue,
    positions: Position[],
    computedGeneration: number,
): Promise<PracticeDeckValue> {
    if (committed.generation !== computedGeneration) {
        return readyState(committed, committed.positions);
    }
    let effectiveCommitted = committed;
    if (committed.revision === 0 && committed.generation === 0) {
        await ensurePracticeMigration();
        await migrateLegacyDeckInline(identity);
        const snapshot = await loadPracticeDeck(identity.file, identity.game);
        if (snapshot) effectiveCommitted = deckFromSnapshot(snapshot);
    }
    const committedCards = new Map(
        effectiveCommitted.positions.map((position) => [
            getBoardState(position.fen),
            position.card,
        ]),
    );
    const mergedPositions = positions.map((position) => {
        const committedCard = committedCards.get(getBoardState(position.fen));
        return committedCard ? { ...position, card: committedCard } : position;
    });
    const revision = await syncPracticePositions(
        identity.file,
        identity.game,
        effectiveCommitted.generation,
        effectiveCommitted.revision,
        positionsDocument(mergedPositions),
    );
    return readyState({ ...effectiveCommitted, revision }, mergedPositions);
}

async function persistReset(
    identity: PracticeDeckKey,
    committed: PracticeDeckValue,
    positions: Position[],
): Promise<PracticeDeckValue> {
    const revision = await resetPracticeDeck(
        identity.file,
        identity.game,
        committed.generation,
        committed.revision,
        positionsDocument(positions),
    );
    clearPracticeIdentityState(identity, false);
    return readyState(
        {
            ...committed,
            revision,
            generation: committed.generation + 1,
            unappliedReviews: 0,
            orphansAcknowledged: true,
        },
        positions,
    );
}

type QueuedWrite = {
    allowWhenBlocked?: boolean;
    task: (committed: PracticeDeckValue | null) => Promise<PracticeDeckValue>;
};

function enqueueWrite(controller: DeckController, write: QueuedWrite): Promise<PracticeDeckValue> {
    const run = controller.writeChain.then(async () => {
        if (controller.writeBlocked && !write.allowWhenBlocked) {
            throw queuedWriteNotSaved();
        }
        if (!write.allowWhenBlocked && !controller.committed) {
            throw queuedWriteNotSaved();
        }
        try {
            const next = await write.task(controller.committed);
            controller.committed = next;
            return next;
        } catch (error) {
            if (error instanceof PracticeRatingDroppedError) {
                controller.committed = error.deck;
            } else {
                controller.writeBlocked = true;
            }
            throw error;
        }
    });
    controller.writeChain = run.then(
        () => undefined,
        () => undefined,
    );
    return run;
}

function createController(identity: PracticeDeckKey): DeckController {
    return {
        identity,
        mounted: false,
        requestSequence: 0,
        writeBlocked: false,
        committed: null,
        writeChain: Promise.resolve(),
        syncTimer: null,
        syncResolve: null,
    };
}

export function createPracticeDeckAtom(
    identity: PracticeDeckKey,
): WritableAtom<PracticeDeckValue, [PracticeDeckAction], Promise<void> | void> {
    const controller = createController(identity);
    const initial = emptyDeck(identity.file === "" ? "ready" : "loading");
    const stateAtom = atom<PracticeDeckValue>(initial);

    stateAtom.onMount = (setState) => {
        controller.mounted = true;
        controller.writeBlocked = false;
        controller.committed = identity.file === "" ? initial : null;
        setState(initial);
        const startHydration = (sequence: number, loading: PracticeDeckValue) => {
            const writesBeforeHydration = controller.writeChain;
            void writesBeforeHydration
                .then(() => hydrate(identity))
                .then(
                    (next) => {
                        controller.committed = next;
                        controller.writeBlocked = false;
                        if (controller.mounted && sequence === controller.requestSequence) {
                            setState(next);
                        }
                    },
                    (error) => {
                        controller.committed = null;
                        controller.writeBlocked = true;
                        if (controller.mounted && sequence === controller.requestSequence) {
                            setState(failureState(loading, error));
                        }
                    },
                );
        };
        const sequence = ++controller.requestSequence;
        startHydration(sequence, initial);
        return () => {
            controller.mounted = false;
            controller.requestSequence += 1;
            if (controller.syncTimer) clearTimeout(controller.syncTimer);
            controller.syncTimer = null;
            // A pending tree sync may be dropped on unmount; syncDeck rebuilds it on next open.
            controller.syncResolve?.();
            controller.syncResolve = null;
        };
    };

    const deckAtom = atom(
        (get) => get(stateAtom),
        (get, set, update: PracticeDeckAction) => {
            const current = get(stateAtom);
            const mutation: PracticeDeckMutation = isMutation(update)
                ? update
                : {
                      type: "sync",
                      positions:
                          typeof update === "function"
                              ? update(current).positions
                              : update.positions,
                  };

            if (identity.file === "") {
                if (mutation.type === "sync") {
                    set(stateAtom, readyState(current, mutation.positions));
                }
                return Promise.resolve();
            }

            if (mutation.type === "retry") {
                const sequence = ++controller.requestSequence;
                const loading = emptyDeck("loading");
                controller.writeBlocked = false;
                controller.committed = null;
                set(stateAtom, loading);
                const run = controller.writeChain.then(async () => {
                    clearPracticeIdentityState(identity, true);
                    await ensurePracticeMigration();
                    return hydrate(identity);
                });
                void run.then(
                    (next) => {
                        controller.committed = next;
                        controller.writeBlocked = false;
                        if (controller.mounted && sequence === controller.requestSequence) {
                            set(stateAtom, next);
                        }
                    },
                    (error) => {
                        controller.committed = null;
                        controller.writeBlocked = true;
                        if (controller.mounted && sequence === controller.requestSequence) {
                            set(stateAtom, failureState(loading, error));
                        }
                    },
                );
                return run.then(
                    () => undefined,
                    () => undefined,
                );
            }

            const observeWrite = (
                run: Promise<PracticeDeckValue>,
                sequence: number,
                pending: PracticeDeckValue,
            ): Promise<void> =>
                run.then(
                    (next) => {
                        if (controller.mounted && sequence === controller.requestSequence) {
                            set(stateAtom, next);
                        }
                    },
                    (error) => {
                        reportWriteFailure(error);
                        if (!controller.mounted || sequence !== controller.requestSequence) return;
                        if (error instanceof PracticeRatingDroppedError) {
                            set(stateAtom, error.deck);
                            return;
                        }
                        if (
                            mutation.type === "reset" &&
                            normalizeError(error).category === "applied-despite-error"
                        ) {
                            const committed = controller.committed ?? pending;
                            set(
                                stateAtom,
                                writeFailureState(
                                    {
                                        ...pending,
                                        revision:
                                            committed.revision === PRACTICE_REVISION_MAX
                                                ? 1
                                                : committed.revision + 1,
                                        generation: committed.generation + 1,
                                        unappliedReviews: 0,
                                        orphansAcknowledged: true,
                                    },
                                    error,
                                ),
                            );
                            return;
                        }
                        set(stateAtom, writeFailureState(pending, error));
                    },
                );

            if (mutation.type === "repair") {
                const sequence = ++controller.requestSequence;
                const pending = {
                    ...current,
                    status: "write-pending" as const,
                    error: undefined,
                };
                set(stateAtom, pending);
                const run = enqueueWrite(controller, {
                    allowWhenBlocked: true,
                    task: async () => {
                        await repairPracticeDeck(identity.file, identity.game);
                        controller.writeBlocked = false;
                        clearPracticeIdentityState(identity, true);
                        return emptyDeck("ready");
                    },
                });
                return observeWrite(run, sequence, pending);
            }

            if (current.status === "loading" || current.status === "read-failed") {
                return Promise.resolve();
            }
            if (controller.writeBlocked || current.status === "write-blocked") {
                reportWriteFailure(queuedWriteNotSaved());
                return Promise.resolve();
            }

            if (mutation.type === "acknowledge") {
                const sequence = ++controller.requestSequence;
                const pending = {
                    ...current,
                    status: "write-pending" as const,
                    error: undefined,
                };
                set(stateAtom, pending);
                const run = enqueueWrite(controller, {
                    task: async (committed) => {
                        if (!committed) throw queuedWriteNotSaved();
                        await acknowledgePracticeOrphans(
                            identity.file,
                            identity.game,
                            committed.generation,
                            committed.unappliedReviews,
                        );
                        return readyState(
                            { ...committed, orphansAcknowledged: true },
                            committed.positions,
                        );
                    },
                });
                return observeWrite(run, sequence, pending);
            }

            const sequence = ++controller.requestSequence;
            const syncGeneration = current.generation;
            const pending = {
                ...current,
                positions: mutation.positions,
                status: "write-pending" as const,
                error: undefined,
            };
            set(stateAtom, pending);

            const run = () =>
                enqueueWrite(controller, {
                    task: async (committed) => {
                        if (!committed) throw queuedWriteNotSaved();
                        if (mutation.type === "rating") {
                            return persistRating(controller.identity, committed, mutation);
                        }
                        if (mutation.type === "reset") {
                            return persistReset(controller.identity, committed, mutation.positions);
                        }
                        return persistSync(
                            controller.identity,
                            committed,
                            mutation.positions,
                            syncGeneration,
                        );
                    },
                });

            if (mutation.type !== "sync") {
                return observeWrite(run(), sequence, pending);
            }

            if (controller.syncTimer) clearTimeout(controller.syncTimer);
            controller.syncResolve?.();
            return new Promise<void>((resolve) => {
                controller.syncResolve = resolve;
                controller.syncTimer = setTimeout(() => {
                    controller.syncTimer = null;
                    controller.syncResolve = null;
                    void observeWrite(run(), sequence, pending).finally(resolve);
                }, PRACTICE_SYNC_DEBOUNCE_MS);
            });
        },
    );
    return deckAtom;
}
