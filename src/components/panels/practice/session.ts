import type { PracticePhase, PracticeSessionStats, PracticeState } from "@/state/atoms";

export type PracticeSession = PracticeState & {
    token: number;
};

export function idlePracticeSession(token = 0): PracticeSession {
    return { phase: "idle", token };
}

export type PracticeEvent =
    | { type: "start"; token: number; fen: string; positionIndex: number }
    | { type: "correct"; token: number; answer: string; timeTaken: number }
    | { type: "incorrect"; token: number; answer: string; playedMove: string; timeTaken: number }
    | { type: "end"; token: number };

/**
 * The session token makes delayed navigation and late board events harmless:
 * a transition may only affect the practice run that created it.
 */
export function practiceSessionReducer(
    state: PracticeSession,
    event: PracticeEvent,
): PracticeSession {
    if (event.type === "start") {
        return {
            phase: "waiting",
            token: event.token,
            currentFen: event.fen,
            positionIndex: event.positionIndex,
        };
    }
    if (event.token !== state.token) return state;
    if (event.type === "end") return idlePracticeSession(event.token);
    if (state.phase !== "waiting") return state;
    if (event.type === "correct") {
        return { ...state, phase: "correct", answer: event.answer, timeTaken: event.timeTaken };
    }
    return {
        ...state,
        phase: "incorrect",
        answer: event.answer,
        playedMove: event.playedMove,
        timeTaken: event.timeTaken,
    };
}

export function emptyPracticeStats(): PracticeSessionStats {
    return {
        mode: "anki",
        remainingPositions: [],
        correct: 0,
        incorrect: 0,
        streak: 0,
        bestStreak: 0,
    };
}

export function canSubmitPracticeMove(state: PracticeSession, currentFen: string): boolean {
    return state.phase === "waiting" && state.currentFen === currentFen;
}

export function isPracticePhase(phase: PracticePhase): boolean {
    return phase !== "idle";
}
