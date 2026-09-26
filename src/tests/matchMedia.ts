import { vi } from "vitest";

type MatchMediaStubOptions = {
    matches?: (query: string) => boolean;
    media?: (query: string) => string;
    trackCalls?: boolean;
};

export function installMatchMediaStub(options: MatchMediaStubOptions = {}) {
    const createMediaQueryList = (query: string) => ({
        matches: options.matches?.(query) ?? false,
        media: options.media?.(query) ?? "",
        onchange: null,
        addEventListener: options.trackCalls ? vi.fn() : () => undefined,
        removeEventListener: options.trackCalls ? vi.fn() : () => undefined,
        addListener: options.trackCalls ? vi.fn() : () => undefined,
        removeListener: options.trackCalls ? vi.fn() : () => undefined,
        dispatchEvent: options.trackCalls ? vi.fn() : () => false,
    });

    Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: options.trackCalls
            ? vi.fn().mockReturnValue(createMediaQueryList(""))
            : createMediaQueryList,
    });
}
