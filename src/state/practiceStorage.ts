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
import { getBoardState } from "@/utils/treeReducer";
import { reportPersistError } from "./persistError";

export const PRACTICE_STORAGE_VERSION = 1;
export const PRACTICE_SYNC_DEBOUNCE_MS = 250;
export const PRACTICE_MAX_CONFLICT_RETRIES = 2;
export const PRACTICE_LOG_PAGE_SIZE = 100;

/** The old browser shape is retained only as migration input for phase 4. */
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
    error?: AppError;
};

export type PracticeDeckKey = { file: string; game: number };

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
    | { type: "repair" };

export type PracticeDeckAction =
    | PracticeDeckValue
    | PracticeDeckMutation
    | ((current: PracticeDeckValue) => PracticeDeckValue);

const positionsDocumentSchema = z.object({ positions: positionSchema.array() });

export let practiceMigrationReady: Promise<void> = Promise.resolve();
type PracticeDeckCreationGuard = (identity: PracticeDeckKey) => Promise<void>;
let practiceDeckCreationGuard: PracticeDeckCreationGuard = async () => undefined;

/** Phase 4 registers the startup migration pass; phase 3 deliberately resolves immediately. */
export function registerPracticeMigration(ready: Promise<void>): void {
    practiceMigrationReady = ready;
}

export function resetPracticeMigrationForTests(): void {
    practiceMigrationReady = Promise.resolve();
    practiceDeckCreationGuard = async () => undefined;
}

/** Phase 4 registers the legacy-key recheck used immediately before first deck creation. */
export function registerPracticeDeckCreationGuard(guard: PracticeDeckCreationGuard): void {
    practiceDeckCreationGuard = guard;
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
    return {
        ...current,
        status: "read-failed",
        error: normalizeError(error),
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
    await practiceMigrationReady;
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
    if (committed.revision === 0 && committed.generation === 0) {
        await practiceDeckCreationGuard(identity);
    }
    const committedCards = new Map(
        committed.positions.map((position) => [getBoardState(position.fen), position.card]),
    );
    const mergedPositions = positions.map((position) => {
        const committedCard = committedCards.get(getBoardState(position.fen));
        return committedCard ? { ...position, card: committedCard } : position;
    });
    const revision = await syncPracticePositions(
        identity.file,
        identity.game,
        committed.generation,
        committed.revision,
        positionsDocument(mergedPositions),
    );
    return readyState({ ...committed, revision }, mergedPositions);
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
        const sequence = ++controller.requestSequence;
        setState(initial);
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
                        setState(failureState(initial, error));
                    }
                },
            );
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
                                            committed.revision === 0xffffffff
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
