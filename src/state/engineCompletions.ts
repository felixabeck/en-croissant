import { getDefaultStore } from "jotai";
import type { EngineCompletion } from "@/bindings";
import i18n from "@/i18n";
import { notifyUnlessCancelled } from "@/components/files/notifyError";
import { tauri, tauriSubscriptions } from "@/platform/tauri";
import { isErrorReported, markErrorReported, warnSafely } from "@/platform/errors";
import { enginesAtom, gamePlayer1SettingsAtom, gamePlayer2SettingsAtom } from "./atoms";
import {
    pruneEngineCompletionReceipts,
    type EngineOwnerCompletionUpdate,
} from "./engineOwnerStorage";
import { upgradeOpponentEngine } from "./opponentSettings";
import { installedEngineFromCompletion, upgradeEngineFromCatalog } from "@/utils/engines";

type Store = ReturnType<typeof getDefaultStore>;
type PendingEngineCompletion = { completion: EngineCompletion; applying: boolean };
const pending = new Map<string, PendingEngineCompletion>();
const listeners = new Set<() => void>();
const applications = new Map<string, Promise<void>>();
let sequence = Promise.resolve();
let documentActive = true;
let unlisten: (() => void) | undefined;
let initialization: Promise<void> | undefined;
const publish = () => listeners.forEach((listener) => listener());

function requireDocument(): void;
function requireDocument<Value>(value: Value): Value;
function requireDocument<Value>(value?: Value) {
    if (!documentActive) throw new Error("engine completion document disposed");
    return value;
}

async function acknowledgeCompletion(id: string) {
    await tauri.acknowledgeEngineCompletion(id);
    if (!documentActive) return;
    pending.delete(id);
    publish();
}

// Shared with the interactive catalog adapter. Startup owns this state and application queue.
export const engineCompletionState = { pending, listeners, publish, requireDocument };

function notifyCompletionError(error: unknown) {
    if (documentActive && !isErrorReported(error))
        notifyUnlessCancelled(i18n.t("Common.Error"), error, "engine");
}

function ownerUpdate<Value>(
    completionId: string,
    apply: (current: Value) => Value,
): EngineOwnerCompletionUpdate<Value> {
    return {
        completionId,
        apply(current) {
            const value = apply(requireDocument(current));
            return { value, disposition: value === current ? "skipped" : "applied" };
        },
    };
}

/** One application path for the originating promise, startup, events and explicit retry. Owner
 * receipts commit beside their values. Each later step rechecks current identity and selection. */
export function applyEngineCompletion(
    completion: EngineCompletion,
    store: Store = getDefaultStore(),
): Promise<void> {
    const { id } = completion;
    const existing = applications.get(id);
    if (existing) return existing;
    const run = sequence
        .then(async () => {
            requireDocument();
            const retained = requireDocument(await tauri.pendingEngineCompletions()).find(
                (entry) => entry.id === id,
            );
            if (!retained) {
                pending.delete(id);
                publish();
                // Another observer may have acknowledged this terminal response already. Its
                // failure still belongs to this caller without retaining document-wide tombstones.
                if (completion.outcome.state === "failed") {
                    markErrorReported(completion.outcome.result);
                    throw completion.outcome.result;
                }
                return;
            }
            completion = retained;
            if (completion.outcome.state === "running") return;
            pending.set(id, { completion, applying: true });
            publish();
            if (completion.outcome.state === "failed") {
                // Hand the retained failure to its reporting owner before native removes the
                // last durable copy. Document disposal during acknowledgement cannot hide it.
                notifyCompletionError(completion.outcome.result);
                markErrorReported(completion.outcome.result);
                await acknowledgeCompletion(id);
                throw completion.outcome.result;
            }
            const installed = completion.outcome.result;
            const { intent, name, version, elo, downloadSize, url } = completion.request;
            const catalog = { name, version, elo, downloadSize, downloadLink: url };
            const currentEngine = () =>
                store.get(enginesAtom)?.find((engine) => engine.id === intent.engine_id);
            const receipt = await store.set(
                enginesAtom,
                ownerUpdate(id, (current) => {
                    if (intent.kind === "add") {
                        if (current.some((engine) => engine.id === intent.engine_id))
                            return current;
                        return [
                            ...current,
                            installedEngineFromCompletion(intent.engine_id, catalog, installed),
                        ];
                    }
                    const target = current.find((engine) => engine.id === intent.engine_id);
                    if (target?.type !== "local" || target.handle.id.id !== intent.expected.id.id)
                        return current;
                    return current.map((engine) =>
                        engine === target
                            ? upgradeEngineFromCatalog(target, catalog, installed)
                            : engine,
                    );
                }),
            );
            if (!receipt.saved) throw receipt.error ?? new Error(i18n.t("Engines.SaveError"));
            requireDocument();
            if (intent.kind === "upgrade") {
                const target = currentEngine();
                const current = target?.type === "local" ? target.handle : null;
                requireDocument(await tauri.retireEngineCompletion(id, current));
                for (const owner of [gamePlayer1SettingsAtom, gamePlayer2SettingsAtom]) {
                    const saved = await store.set(
                        owner,
                        ownerUpdate(id, (opponent) => {
                            const live = currentEngine();
                            if (
                                live?.type !== "local" ||
                                live.handle.id.id !== installed.handle.id.id ||
                                receipt.completionDisposition === "skipped" ||
                                opponent.type !== "engine" ||
                                opponent.engine?.id !== intent.engine_id ||
                                opponent.engine.handle.id.id !== intent.expected.id.id
                            ) {
                                return opponent;
                            }
                            return upgradeOpponentEngine(
                                opponent,
                                intent.engine_id,
                                catalog,
                                installed,
                            );
                        }),
                    );
                    if (!saved.saved)
                        throw saved.error ?? new Error(i18n.t("Engines.Upgrade.SnapshotSaveError"));
                    requireDocument();
                }
            }
            await acknowledgeCompletion(id);
            requireDocument();
        })
        .catch(async (error) => {
            // The shared application owns reporting. Every observer and live caller still
            // receives this same rejection, while their notification catches stay silent.
            notifyCompletionError(error);
            markErrorReported(error);
            if (documentActive) {
                // A failed owner write remains a completion, so Install retries application. Its
                // progress display must not masquerade as a still-running network transfer.
                try {
                    await tauri.clearProgress(completion.request.progressId);
                } catch (cause) {
                    warnSafely(String(cause));
                }
            }
            throw error;
        })
        .finally(() => {
            applications.delete(id);
            if (!documentActive) return;
            const entry = pending.get(id);
            if (entry) pending.set(id, { ...entry, applying: false });
            publish();
        });
    applications.set(id, run);
    sequence = run.catch(() => undefined);
    return run;
}

export function observeEngineCompletions() {
    const observation = sequence.then(async () => {
        const snapshot = requireDocument(await tauri.pendingEngineCompletions());
        const ids = new Set(snapshot.map((completion) => completion.id));
        requireDocument(await pruneEngineCompletionReceipts(ids));
        pending.clear();
        for (const completion of snapshot)
            pending.set(completion.id, { completion, applying: applications.has(completion.id) });
        publish();
        return snapshot;
    });
    sequence = observation.then(
        () => undefined,
        () => undefined,
    );
    return observation;
}

async function refreshEngineCompletions(store: Store) {
    for (const completion of await observeEngineCompletions()) {
        if (completion.outcome.state !== "running")
            await applyEngineCompletion(completion, store).catch(notifyCompletionError);
    }
}

export function initializeEngineCompletions(store: Store = getDefaultStore()): Promise<void> {
    if (!initialization)
        initialization = (async () => {
            documentActive = true;
            unlisten?.();
            unlisten = undefined;
            // Subscribe before the snapshot. A terminal result cannot fall into the subscription gap.
            const dispose = await tauriSubscriptions.completionChanged(() => {
                if (documentActive)
                    void refreshEngineCompletions(store).catch(notifyCompletionError);
            });
            if (!documentActive) {
                dispose();
                return;
            }
            unlisten = dispose;
            window.addEventListener("pagehide", disposeEngineCompletions, { once: true });
            await refreshEngineCompletions(store);
        })().catch((error) => {
            initialization = undefined;
            notifyCompletionError(error);
            throw error;
        });
    return initialization;
}

export function disposeEngineCompletions() {
    documentActive = false;
    unlisten?.();
    unlisten = undefined;
    publish();
}

export function resetEngineCompletionsForTests() {
    disposeEngineCompletions();
    documentActive = true;
    initialization = undefined;
    pending.clear();
    applications.clear();
    listeners.clear();
    sequence = Promise.resolve();
}
