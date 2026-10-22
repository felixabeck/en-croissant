import { getDefaultStore } from "jotai";
import { safeFailureContext, warnSafely } from "@/platform/errors";
import { tauri } from "@/platform/tauri";
import { soundCollectionAtom, soundVolumeAtom } from "@/state/atoms";

type SoundKind = "Move" | "Capture" | "Check";

const POOL_SIZE = 5;
export const THROTTLE_MS = 75;
const audioPool = Array.from({ length: POOL_SIZE }, () => new Audio());
let poolIndex = 0;

let soundServerPort: number | null = null;
let soundServerPortFailed = false;

let lastTime = 0;

const MAX_PLAYBACK_REPORTS = 24;
const MAX_FAILURE_MESSAGE_LENGTH = 256;
const reportedPlaybackFailures = new Set<string>();

function reportPlaybackFailure(collection: string, kind: SoundKind, port: number, cause: unknown) {
    // Persisted collection values are untrusted. Accept bounded resource identifiers without
    // duplicating the collection catalogue, and collapse malformed values to a safe identity.
    const safeCollection = /^[a-z][a-z0-9_-]{0,63}$/i.test(collection)
        ? collection
        : "[invalid collection]";
    const key = `${safeCollection}/${kind}`;
    // Never evict: eviction would let a repeated failure consume another warning.
    if (
        reportedPlaybackFailures.size >= MAX_PLAYBACK_REPORTS ||
        reportedPlaybackFailures.has(key)
    ) {
        return;
    }
    reportedPlaybackFailures.add(key);

    const failure = safeFailureContext(cause);
    warnSafely(
        `Sound playback failed: ${JSON.stringify({
            collection: safeCollection,
            kind,
            url: `http://127.0.0.1:${port}/${safeCollection}/${kind}.mp3`,
            failure: {
                category: failure.category,
                message: failure.message
                    .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, " ")
                    .slice(0, MAX_FAILURE_MESSAGE_LENGTH),
            },
        })}`,
    );
}

async function getSoundServerPort(): Promise<number> {
    if (soundServerPort !== null) {
        return soundServerPort;
    }
    soundServerPort = await tauri.getSoundServerPort();
    return soundServerPort;
}

export function playSound(capture: boolean, check: boolean) {
    // The null check is deliberate, not redundant: two lookups can overlap, and one may reject
    // while the other resolves a real port. A known-good port then outranks the stale failure,
    // in either arrival order.
    if (soundServerPortFailed && soundServerPort === null) {
        return;
    }

    // only play at most 1 sound every THROTTLE_MS
    const now = Date.now();
    if (now - lastTime < THROTTLE_MS) {
        return;
    }
    lastTime = now;

    const store = getDefaultStore();
    const collection = store.get(soundCollectionAtom);
    const volume = store.get(soundVolumeAtom);

    let type: SoundKind = "Move";
    if (capture) {
        type = "Capture";
    }
    if (collection !== "standard" && check) {
        type = "Check";
    }

    getSoundServerPort().then(
        (port) => {
            // Port 0 means the backend has no sound server — no bundled sound resources, or the
            // server failed to start. Requesting http://127.0.0.1:0/ would only produce a console
            // error per move.
            if (port === 0) {
                return;
            }
            const url = `http://127.0.0.1:${port}/${collection}/${type}.mp3`;
            const player = audioPool[poolIndex];
            poolIndex = (poolIndex + 1) % POOL_SIZE;

            // Capture the request, never read player.src in a late rejection after pool reuse.
            const reportFailure = (cause: unknown) =>
                reportPlaybackFailure(collection, type, port, cause);
            try {
                player.src = url;
                player.volume = volume;
                player.play().catch(reportFailure);
            } catch (cause) {
                // Setup and synchronous play failures share the same request identity.
                reportFailure(cause);
            }
        },
        (error) => {
            if (soundServerPortFailed) return;
            soundServerPortFailed = true;
            warnSafely(`Sound server port request failed: ${String(error)}`);
        },
    );
}
