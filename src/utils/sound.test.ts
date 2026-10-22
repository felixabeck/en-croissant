import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    getSoundServerPort: vi.fn(),
    warn: vi.fn(),
}));

vi.mock("@/platform/tauri", async () => {
    const actual = await vi.importActual<typeof import("@/platform/tauri")>("@/platform/tauri");
    return { ...actual, tauri: mocks };
});

vi.mock("@/platform/native", () => ({ warn: mocks.warn }));

// Warm the sound graph transform during collection; dynamic imports after vi.resetModules() only re-evaluate modules.
// Keep vi.resetModules() for the sound-server latch; loadSound() returns the fresh sound instance, never this top-level one.
import "./sound";

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
    // Five ticks drain the port await, the lookup's rejection handler, the warn call, warn's own
    // rejection, and the console fallback — the deepest chain any case here observes.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
}

function playbackWarning(index = 0) {
    const message = mocks.warn.mock.calls[index]?.[0];
    expect(message).toEqual(expect.stringContaining("Sound playback failed:"));
    return JSON.parse(message.slice(message.indexOf("{")));
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
            expect(mocks.warn).toHaveBeenCalledWith(
                `Sound server port request failed: ${String(soundError)}`,
            );
            expect(consoleWarn).toHaveBeenCalledOnce();
            expect(consoleWarn).toHaveBeenCalledWith(
                `Sound server port request failed: ${String(soundError)}`,
                { loggerFailure: expect.anything() },
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

    describe("playback diagnostics", () => {
        beforeEach(() => {
            mocks.getSoundServerPort.mockResolvedValue(43123);
            vi.spyOn(console, "error").mockImplementation(() => {});
        });

        afterEach(() => {
            vi.restoreAllMocks();
        });

        test.each([
            ["standard", false, true, "Move"],
            ["standard", true, true, "Capture"],
            ["piano", true, true, "Check"],
        ] as const)(
            "attributes rejected playback to %s and its resolved %s/%s kind",
            async (collection, capture, check, kind) => {
                const { playSound } = await loadSound({ collection });
                audioInstances[0].play.mockRejectedValue(new Error("decoder unavailable"));

                expect(playSound(capture, check)).toBeUndefined();
                await settle();

                expect(mocks.warn).toHaveBeenCalledOnce();
                expect(playbackWarning()).toEqual({
                    collection,
                    kind,
                    url: `http://127.0.0.1:43123/${collection}/${kind}.mp3`,
                    failure: { category: "unexpected", message: "decoder unavailable" },
                });
                expect(console.error).not.toHaveBeenCalled();
            },
        );

        test("reports a collection and kind only once across pool rotations", async () => {
            const { playSound, THROTTLE_MS } = await loadSound({ collection: "piano" });
            for (const player of audioInstances) {
                player.play.mockRejectedValue(new Error("decoder unavailable"));
            }

            for (let attempt = 0; attempt < 12; attempt++) {
                playSound(false, true);
                await settle();
                vi.advanceTimersByTime(THROTTLE_MS + 1);
            }

            expect(mocks.warn).toHaveBeenCalledOnce();
            expect(
                audioInstances.reduce((total, player) => total + player.play.mock.calls.length, 0),
            ).toBe(12);
        });

        test("reports distinct collections and kinds independently", async () => {
            const { playSound, THROTTLE_MS } = await loadSound();
            for (const player of audioInstances) {
                player.play.mockRejectedValue(new Error("decoder unavailable"));
            }

            playSound(false, false);
            await settle();
            vi.advanceTimersByTime(THROTTLE_MS + 1);
            playSound(true, false);
            await settle();
            await loadSound({ collection: "piano" });
            vi.advanceTimersByTime(THROTTLE_MS + 1);
            playSound(false, false);
            await settle();

            expect(mocks.warn).toHaveBeenCalledTimes(3);
            expect([playbackWarning(0), playbackWarning(1), playbackWarning(2)]).toMatchObject([
                { collection: "standard", kind: "Move" },
                { collection: "standard", kind: "Capture" },
                { collection: "piano", kind: "Move" },
            ]);
        });

        test("preserves a late rejection's identity after real pool reuse", async () => {
            const { playSound, THROTTLE_MS } = await loadSound({ collection: "piano" });
            const firstPlayback = Promise.withResolvers<void>();
            audioInstances[0].play.mockReturnValueOnce(firstPlayback.promise);

            playSound(false, true);
            await settle();
            await loadSound({ collection: "standard" });
            for (let attempt = 0; attempt < 5; attempt++) {
                vi.advanceTimersByTime(THROTTLE_MS + 1);
                playSound(true, false);
                await settle();
            }
            expect(audioInstances).toHaveLength(5);
            expect(audioInstances[0].play).toHaveBeenCalledTimes(2);
            expect(audioInstances[0].src).toBe("http://127.0.0.1:43123/standard/Capture.mp3");

            firstPlayback.reject(new Error("late decoder rejection"));
            await settle();

            expect(mocks.warn).toHaveBeenCalledOnce();
            expect(playbackWarning()).toMatchObject({
                collection: "piano",
                kind: "Check",
                url: "http://127.0.0.1:43123/piano/Check.mp3",
                failure: { message: "late decoder rejection" },
            });
        });

        test("falls back with the same context when the native playback warning rejects", async () => {
            const { playSound } = await loadSound({ collection: "woodland" });
            audioInstances[0].play.mockRejectedValue(new Error("decoder unavailable"));
            mocks.warn.mockRejectedValue(new Error("token=logger-secret /home/private/logger.log"));
            const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

            playSound(true, false);
            await settle();

            expect(mocks.warn).toHaveBeenCalledOnce();
            expect(playbackWarning()).toMatchObject({ collection: "woodland", kind: "Capture" });
            expect(consoleWarn).toHaveBeenCalledExactlyOnceWith(mocks.warn.mock.calls[0][0], {
                loggerFailure: { category: "unexpected", message: "token=[redacted] [path]" },
            });
        });

        test("caps reports at 24 without evicting keys or stopping playback", async () => {
            const { playSound, THROTTLE_MS } = await loadSound();
            for (const player of audioInstances) {
                player.play.mockRejectedValue(new Error("decoder unavailable"));
            }

            for (let index = 0; index < 30; index++) {
                await loadSound({ collection: `collection-${index}` });
                playSound(false, false);
                await settle();
                vi.advanceTimersByTime(THROTTLE_MS + 1);
            }
            await loadSound({ collection: "collection-0" });
            playSound(false, false);
            await settle();

            expect(mocks.warn).toHaveBeenCalledTimes(24);
            expect(playbackWarning(0).collection).toBe("collection-0");
            expect(playbackWarning(23).collection).toBe("collection-23");
            expect(
                audioInstances.reduce((total, player) => total + player.play.mock.calls.length, 0),
            ).toBe(31);
        });

        test.each([
            "password=collection-secret /home/private/sounds\nforged warning",
            `piano${"x".repeat(10000)}`,
        ])("sanitizes and bounds persisted collection context", async (collection) => {
            const { playSound } = await loadSound({ collection });
            audioInstances[0].play.mockRejectedValue(new Error("decoder unavailable"));

            playSound(false, true);
            await settle();

            expect(mocks.warn).toHaveBeenCalledOnce();
            const context = playbackWarning();
            expect(context.collection).toBe("[invalid collection]");
            expect(context.url).toBe("http://127.0.0.1:43123/[invalid collection]/Check.mp3");
            expect(mocks.warn.mock.calls[0][0]).not.toContain(collection);
            expect(mocks.warn.mock.calls[0][0].length).toBeLessThan(1024);
            // Diagnostics must not change the resource requested by playback.
            expect(audioInstances[0].src).toBe(`http://127.0.0.1:43123/${collection}/Check.mp3`);
        });

        test.each([
            new Error("password=error-secret /home/private/sound.mp3\nforged\u0000\u2028warning"),
            {
                category: "unexpected",
                message: "password=error-secret /home/private/sound.mp3\nforged\u0000\u2028warning",
            },
        ])("sanitizes arbitrary error messages before native logging", async (cause) => {
            const { playSound } = await loadSound();
            audioInstances[0].play.mockRejectedValue(cause);

            playSound(false, false);
            await settle();

            expect(mocks.warn).toHaveBeenCalledOnce();
            expect(playbackWarning().failure.message).toBe(
                "password=[redacted] [path] forged  warning",
            );
            expect(mocks.warn.mock.calls[0][0]).not.toContain("error-secret");
            expect(mocks.warn.mock.calls[0][0]).not.toContain("/home/private");
        });

        test("bounds error context after redaction even when a secret crosses the length limit", async () => {
            const { playSound } = await loadSound();
            audioInstances[0].play.mockRejectedValue(
                new Error(`${"x".repeat(240)} token=${"s".repeat(10000)}`),
            );

            playSound(false, false);
            await settle();

            expect(mocks.warn).toHaveBeenCalledOnce();
            expect(playbackWarning().failure.message).toHaveLength(256);
            expect(playbackWarning().failure.message).toContain("token=[redacted");
            expect(mocks.warn.mock.calls[0][0]).not.toContain("ssss");
            expect(mocks.warn.mock.calls[0][0].length).toBeLessThan(1024);
        });

        test("reports synchronous play failures through the same contextual reporter", async () => {
            const { playSound } = await loadSound({ collection: "nes" });
            audioInstances[0].play.mockImplementation(() => {
                throw new Error("password=sync-secret /home/private/sound.mp3");
            });

            expect(playSound(true, false)).toBeUndefined();
            await settle();

            expect(mocks.warn).toHaveBeenCalledOnce();
            expect(playbackWarning()).toEqual({
                collection: "nes",
                kind: "Capture",
                url: "http://127.0.0.1:43123/nes/Capture.mp3",
                failure: { category: "unexpected", message: "password=[redacted] [path]" },
            });
            expect(console.error).not.toHaveBeenCalled();
        });

        test("reports setup failures contextually without latching the port or leaking raw errors", async () => {
            const { playSound, THROTTLE_MS } = await loadSound({ collection: "robot" });
            Object.defineProperty(audioInstances[0], "volume", {
                set() {
                    throw new Error("password=setup-secret /home/private/sound.mp3");
                },
            });

            playSound(false, false);
            await settle();
            vi.advanceTimersByTime(THROTTLE_MS + 1);
            playSound(false, false);
            await settle();

            expect(mocks.warn).toHaveBeenCalledOnce();
            expect(playbackWarning()).toMatchObject({
                collection: "robot",
                kind: "Move",
                url: "http://127.0.0.1:43123/robot/Move.mp3",
                failure: { message: "password=[redacted] [path]" },
            });
            expect(audioInstances[0].play).not.toHaveBeenCalled();
            expect(audioInstances[1].play).toHaveBeenCalledOnce();
            expect(mocks.getSoundServerPort).toHaveBeenCalledOnce();
            expect(console.error).not.toHaveBeenCalled();
        });
    });
});
