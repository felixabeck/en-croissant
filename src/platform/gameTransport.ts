import type {
    ClockUpdateEvent,
    GameConfig,
    GameMoveEvent,
    GameOverEvent,
    GameState,
    OpeningBookConfig,
    TimeControl,
} from "@/bindings";

const MAX_SAFE_COUNTER = BigInt(Number.MAX_SAFE_INTEGER);

type GameCounterFields = Pick<GameState, "session" | "revision">;
type GameCounterWireInput<T extends GameCounterFields> = Omit<T, keyof GameCounterFields> & {
    [Field in keyof GameCounterFields]: number | GameCounterFields[Field];
};

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

export function normalizeGameState(value: GameCounterWireInput<GameState>): GameState {
    return normalizeCounterPair(value);
}

export function normalizeGameMoveEvent(value: GameCounterWireInput<GameMoveEvent>): GameMoveEvent {
    return normalizeCounterPair(value);
}

export function normalizeClockUpdateEvent(
    value: GameCounterWireInput<ClockUpdateEvent>,
): ClockUpdateEvent {
    return normalizeCounterPair(value);
}

export function normalizeGameOverEvent(value: GameCounterWireInput<GameOverEvent>): GameOverEvent {
    return normalizeCounterPair(value);
}

function normalizeCounterPair<T extends GameCounterFields>(
    value: GameCounterWireInput<T>,
): Omit<T, keyof GameCounterFields> & GameCounterFields {
    return {
        ...value,
        session: decodeGameCounter(value.session, "session"),
        revision: decodeGameCounter(value.revision, "revision"),
    };
}
