import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    getSoundServerPort: vi.fn(),
}));

vi.mock("@/platform/tauri", async () => {
    const actual = await vi.importActual<typeof import("@/platform/tauri")>("@/platform/tauri");
    return { ...actual, tauri: mocks };
});

type AudioStub = {
    play: ReturnType<typeof vi.fn>;
    src: string;
    volume: number;
};

const audioInstances: AudioStub[] = [];

class FakeAudio implements AudioStub {
    play = vi.fn().mockResolvedValue(undefined);
    src = "";
    volume = 0;

    constructor() {
        audioInstances.push(this);
    }
}

async function loadSound({ collection = "standard" } = {}) {
    const [{ getDefaultStore }, { soundCollectionAtom }, sound] = await Promise.all([
        import("jotai"),
        import("@/state/atoms"),
        import("./sound"),
    ]);
    getDefaultStore().set(soundCollectionAtom, collection);
    return sound;
}

async function settle() {
    await Promise.resolve();
    await Promise.resolve();
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-06T12:00:00Z"));
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal("Audio", FakeAudio);
    audioInstances.length = 0;
    localStorage.removeItem("sound-collection");
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe("playSound", () => {
    test.each([
        ["move", "standard", false, false, "Move"],
        ["capture", "standard", true, false, "Capture"],
        ["check in a persisted non-standard collection", "piano", false, true, "Check"],
    ] as const)(
        "plays a %s sound from the loopback server",
        async (_name, collection, capture, check, kind) => {
            mocks.getSoundServerPort.mockResolvedValue(43123);
            const { playSound } = await loadSound({ collection });

            playSound(capture, check);
            await settle();

            expect(mocks.getSoundServerPort).toHaveBeenCalledOnce();
            expect(audioInstances[0].src).toBe(`http://127.0.0.1:43123/${collection}/${kind}.mp3`);
        },
    );

    test("stays silent when the server port is 0", async () => {
        mocks.getSoundServerPort.mockResolvedValue(0);
        const { playSound } = await loadSound();

        playSound(false, false);
        await settle();

        expect(mocks.getSoundServerPort).toHaveBeenCalledOnce();
        expect(audioInstances.every(({ play }) => !play.mock.calls.length)).toBe(true);
    });

    test("does not play or throw when the server port request rejects", async () => {
        mocks.getSoundServerPort.mockRejectedValue(new Error("no sound server"));
        const { playSound } = await loadSound();

        expect(() => playSound(false, false)).not.toThrow();
        await settle();

        expect(audioInstances.every(({ play }) => !play.mock.calls.length)).toBe(true);
    });
});
