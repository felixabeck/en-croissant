import { getDefaultStore } from "jotai";
import { tauri } from "@/platform/tauri";
import { soundCollectionAtom, soundVolumeAtom } from "@/state/atoms";

type SoundKind = "Move" | "Capture" | "Check";

const POOL_SIZE = 5;
const audioPool = Array.from({ length: POOL_SIZE }, () => new Audio());
let poolIndex = 0;

let soundServerPort: number | null = null;

let lastTime = 0;

async function getSoundServerPort(): Promise<number> {
    if (soundServerPort !== null) {
        return soundServerPort;
    }
    soundServerPort = await tauri.getSoundServerPort();
    return soundServerPort;
}

export function playSound(capture: boolean, check: boolean) {
    // only play at most 1 sound every 75ms
    const now = Date.now();
    if (now - lastTime < 75) {
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
        .then((port) => {
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
        })
        .catch(() => {
            // fails if Tauri APIs are unavailable (e.g., in tests)
        });
}
