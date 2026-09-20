import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    getSoundServerPort: vi.fn(),
    warn: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/platform/tauri", async () => {
    const actual = await vi.importActual<typeof import("@/platform/tauri")>("@/platform/tauri");
    return { ...actual, tauri: mocks };
});

vi.mock("@/platform/native", () => ({ warn: mocks.warn }));

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
    // Five ticks drain the port await, outer catch, warn call, warn rejection, and console fallback.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-06T12:00:00Z"));
    vi.resetModules();
    vi.clearAllMocks();
    mocks.warn.mockResolvedValue(undefined);
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

    test("stops asking after the first failed port request", async () => {
        mocks.getSoundServerPort.mockRejectedValue(new Error("no sound server"));
        const { playSound, THROTTLE_MS } = await loadSound();

        playSound(false, false);
        await settle();
        vi.advanceTimersByTime(THROTTLE_MS + 1);
        playSound(false, false);
        await settle();

        expect(mocks.getSoundServerPort).toHaveBeenCalledOnce();
        expect(mocks.warn).toHaveBeenCalledOnce();
        expect(mocks.warn).toHaveBeenCalledWith(expect.stringContaining("no sound server"));
        expect(audioInstances.every(({ play }) => !play.mock.calls.length)).toBe(true);
    });

    test("reports one warning for overlapping failed port requests", async () => {
        const firstPort = Promise.withResolvers<number>();
        const secondPort = Promise.withResolvers<number>();
        mocks.getSoundServerPort
            .mockReturnValueOnce(firstPort.promise)
            .mockReturnValueOnce(secondPort.promise);
        const { playSound, THROTTLE_MS } = await loadSound();

        playSound(false, false);
        vi.advanceTimersByTime(THROTTLE_MS + 1);
        playSound(false, false);
        expect(mocks.getSoundServerPort).toHaveBeenCalledTimes(2);

        firstPort.reject(new Error("no sound server"));
        secondPort.reject(new Error("no sound server"));
        await settle();

        expect(mocks.warn).toHaveBeenCalledOnce();
    });

    test("plays both sounds for overlapping successful port requests", async () => {
        const firstPort = Promise.withResolvers<number>();
        const secondPort = Promise.withResolvers<number>();
        mocks.getSoundServerPort
            .mockReturnValueOnce(firstPort.promise)
            .mockReturnValueOnce(secondPort.promise);
        const { playSound, THROTTLE_MS } = await loadSound();

        playSound(false, false);
        vi.advanceTimersByTime(THROTTLE_MS + 1);
        playSound(false, false);

        firstPort.resolve(43123);
        secondPort.resolve(43123);
        await settle();

        expect(audioInstances.filter(({ play }) => play.mock.calls.length > 0)).toHaveLength(2);
    });

    test("keeps a cached port usable after an overlapping failure", async () => {
        const failedPort = Promise.withResolvers<number>();
        const validPort = Promise.withResolvers<number>();
        mocks.getSoundServerPort
            .mockReturnValueOnce(failedPort.promise)
            .mockReturnValueOnce(validPort.promise);
        const { playSound, THROTTLE_MS } = await loadSound();

        playSound(false, false);
        vi.advanceTimersByTime(THROTTLE_MS + 1);
        playSound(false, false);

        failedPort.reject(new Error("no sound server"));
        validPort.resolve(43123);
        await settle();

        vi.advanceTimersByTime(THROTTLE_MS + 1);
        playSound(false, false);
        await settle();

        expect(mocks.getSoundServerPort).toHaveBeenCalledTimes(2);
        expect(mocks.warn).toHaveBeenCalledOnce();
        expect(audioInstances.filter(({ play }) => play.mock.calls.length > 0)).toHaveLength(2);
    });

    test("falls back to console when reporting the port failure rejects", async () => {
        const soundError = new Error("no sound server");
        const logError = new Error("logger unavailable");
        mocks.getSoundServerPort.mockRejectedValue(soundError);
        mocks.warn.mockRejectedValue(logError);
        const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

        try {
            const { playSound } = await loadSound();
            playSound(false, false);
            await settle();

            expect(mocks.warn).toHaveBeenCalledOnce();
            expect(consoleWarn).toHaveBeenCalledOnce();
            expect(consoleWarn).toHaveBeenCalledWith(
                "Sound server port request failed, and the log facade did too:",
                soundError,
                logError,
            );
        } finally {
            consoleWarn.mockRestore();
        }
    });

    test("keeps playSound fire-and-forget", async () => {
        mocks.getSoundServerPort.mockResolvedValue(43123);
        const { playSound: playSuccessfulSound } = await loadSound();

        expect(playSuccessfulSound(false, false)).toBeUndefined();
        await settle();

        vi.resetModules();
        mocks.getSoundServerPort.mockRejectedValue(new Error("no sound server"));
        const { playSound: playFailedSound } = await loadSound();

        expect(playFailedSound(false, false)).toBeUndefined();
        await settle();
    });
});
