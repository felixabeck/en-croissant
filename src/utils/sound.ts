import { getDefaultStore } from "jotai";
import { warn } from "@/platform/native";
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

    getSoundServerPort()
        .then(
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

                player.src = url;
                player.volume = volume;
                player.play().catch((e) => console.error("Audio playback error:", e));
            },
            (error) => {
                if (soundServerPortFailed) return;
                soundServerPortFailed = true;
                void warn(`Sound server port request failed: ${String(error)}`).catch((logError) =>
                    console.warn(
                        "Sound server port request failed, and the log facade did too:",
                        error,
                        logError,
                    ),
                );
            },
        )
        // Distinct from the playback error above: this one is the setup body throwing, most
        // plausibly `player.volume` on a persisted volume outside [0, 1]. It must not latch the
        // port off — it is not a port failure.
        .catch((e) => console.error("Audio setup error:", e));
}
