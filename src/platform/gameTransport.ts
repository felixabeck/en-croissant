import type {
    ClockUpdateEvent,
    GameConfig,
    GameMoveEvent,
    GameOverEvent,
    GameState,
    OpeningBookConfig,
    TimeControl,
} from "@/bindings/generated";

const MAX_SAFE_COUNTER = BigInt(Number.MAX_SAFE_INTEGER);

export type GameConfigInput = Omit<
    GameConfig,
    "whiteTimeControl" | "blackTimeControl" | "openingBook"
> & {
    whiteTimeControl: NumericTimeControl | null;
    blackTimeControl: NumericTimeControl | null;
    openingBook: NumericOpeningBookConfig | null;
};

type NumericTimeControl = Omit<TimeControl, "initialTime" | "increment"> & {
    initialTime: number;
    increment: number;
};

type NumericOpeningBookConfig = Omit<OpeningBookConfig, "maxPly"> & {
    maxPly?: number;
};

export function decodeGameCounter(value: unknown, field: string): bigint {
    if (typeof value === "bigint") {
        if (value >= 0 && value <= MAX_SAFE_COUNTER) return value;
    } else if (typeof value === "number") {
        if (Number.isSafeInteger(value) && value >= 0) return BigInt(value);
    }
    throw new TypeError(`${field} must be a nonnegative safe integer`);
}

export function encodeGameCounter(value: bigint, field = "expectedSession"): number {
    if (typeof value !== "bigint" || value < 0 || value > MAX_SAFE_COUNTER) {
        throw new TypeError(`${field} must be a nonnegative safe integer`);
    }
    return Number(value);
}

export function normalizeGameState(value: GameState): GameState {
    return normalizeCounterPair(value);
}

export function normalizeGameMoveEvent(value: GameMoveEvent): GameMoveEvent {
    return normalizeCounterPair(value);
}

export function normalizeClockUpdateEvent(value: ClockUpdateEvent): ClockUpdateEvent {
    return normalizeCounterPair(value);
}

export function normalizeGameOverEvent(value: GameOverEvent): GameOverEvent {
    return normalizeCounterPair(value);
}

function normalizeCounterPair<T extends { session: bigint; revision: bigint }>(value: T): T {
    return {
        ...value,
        session: decodeGameCounter(value.session, "session"),
        revision: decodeGameCounter(value.revision, "revision"),
    };
}
