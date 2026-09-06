import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    convertFileSrc: vi.fn((path: string) => `asset://localhost/${path}`),
    getSoundServerPort: vi.fn(),
    platform: vi.fn(),
    soundResourcePath: vi.fn(),
}));

vi.mock("@/platform/native", () => ({
    convertFileSrc: mocks.convertFileSrc,
    platform: mocks.platform,
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

async function loadSound({ collection = "standard", platform = "win32" } = {}) {
    mocks.platform.mockReturnValue(platform);
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
    mocks.soundResourcePath.mockResolvedValue("/resource/sound/standard/Move.mp3");
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
        "uses the bounded resource path for a %s sound",
        async (_name, collection, capture, check, kind) => {
            const returnedPath = `/resource/sound/${collection}/${kind}.mp3`;
            mocks.soundResourcePath.mockResolvedValue(returnedPath);
            const { playSound } = await loadSound({ collection });

            playSound(capture, check);
            await settle();

            expect(mocks.soundResourcePath).toHaveBeenCalledWith(collection, kind);
            expect(mocks.convertFileSrc).toHaveBeenCalledWith(returnedPath);
            expect(audioInstances[0].src).toBe(`asset://localhost/${returnedPath}`);
        },
    );

    test("does not play or throw when the backend rejects the resource path", async () => {
        mocks.soundResourcePath.mockRejectedValue(new Error("invalid collection"));
        const { playSound } = await loadSound();

        expect(() => playSound(false, false)).not.toThrow();
        await settle();

        expect(audioInstances.every(({ play }) => !play.mock.calls.length)).toBe(true);
        expect(mocks.convertFileSrc).not.toHaveBeenCalled();
    });

    test("uses the sound server on Linux without requesting a resource path", async () => {
        mocks.getSoundServerPort.mockResolvedValue(43123);
        const { playSound } = await loadSound({ platform: "linux" });

        playSound(false, false);
        await settle();

        expect(mocks.getSoundServerPort).toHaveBeenCalledOnce();
        expect(mocks.soundResourcePath).not.toHaveBeenCalled();
        expect(audioInstances[0].src).toBe("http://127.0.0.1:43123/standard/Move.mp3");
    });
});
