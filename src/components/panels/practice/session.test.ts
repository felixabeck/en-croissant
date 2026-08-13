import { describe, expect, it } from "vitest";
import {
    canSubmitPracticeMove,
    emptyPracticeStats,
    idlePracticeSession,
    isPracticePhase,
    practiceSessionReducer,
} from "./session";

describe("practiceSessionReducer", () => {
    it("accepts exactly one answer while waiting", () => {
        const waiting = practiceSessionReducer(idlePracticeSession(), {
            type: "start",
            token: 1,
            fen: "fen-a",
            positionIndex: 2,
        });
        const incorrect = practiceSessionReducer(waiting, {
            type: "incorrect",
            token: 1,
            answer: "e4",
            playedMove: "d4",
            timeTaken: 42,
        });
        expect(incorrect.phase).toBe("incorrect");
        expect(
            practiceSessionReducer(incorrect, {
                type: "incorrect",
                token: 1,
                answer: "e4",
                playedMove: "c4",
                timeTaken: 43,
            }),
        ).toBe(incorrect);
    });

    it("keeps correct and incorrect outcomes semantically distinct", () => {
        const waiting = practiceSessionReducer(idlePracticeSession(), {
            type: "start",
            token: 5,
            fen: "fen-a",
            positionIndex: 2,
        });

        expect(
            practiceSessionReducer(waiting, {
                type: "correct",
                token: 5,
                answer: "Nf3",
                timeTaken: 12,
            }),
        ).toEqual({
            phase: "correct",
            token: 5,
            currentFen: "fen-a",
            positionIndex: 2,
            answer: "Nf3",
            timeTaken: 12,
        });
        expect(
            practiceSessionReducer(waiting, {
                type: "incorrect",
                token: 5,
                answer: "Nf3",
                playedMove: "Nc3",
                timeTaken: 12,
            }),
        ).toEqual({
            phase: "incorrect",
            token: 5,
            currentFen: "fen-a",
            positionIndex: 2,
            answer: "Nf3",
            playedMove: "Nc3",
            timeTaken: 12,
        });
    });

    it("rejects delayed callbacks from stopped or switched sessions", () => {
        const waiting = practiceSessionReducer(idlePracticeSession(), {
            type: "start",
            token: 3,
            fen: "fen-a",
            positionIndex: 0,
        });
        const stopped = practiceSessionReducer(waiting, { type: "end", token: 3 });
        expect(
            practiceSessionReducer(stopped, {
                type: "correct",
                token: 3,
                answer: "e4",
                timeTaken: 20,
            }),
        ).toEqual(stopped);
        expect(
            practiceSessionReducer(waiting, {
                type: "correct",
                token: 4,
                answer: "e4",
                timeTaken: 20,
            }),
        ).toBe(waiting);
    });

    it("completion clears every active-card field before a later run starts", () => {
        const waiting = practiceSessionReducer(idlePracticeSession(), {
            type: "start",
            token: 7,
            fen: "history-card",
            positionIndex: 4,
        });
        const completed = practiceSessionReducer(
            practiceSessionReducer(waiting, {
                type: "correct",
                token: 7,
                answer: "Nf3",
                timeTaken: 100,
            }),
            { type: "end", token: 7 },
        );
        expect(completed).toEqual({ phase: "idle", token: 7 });
    });

    it("only unlocks the board for the current waiting card", () => {
        const waiting = practiceSessionReducer(idlePracticeSession(), {
            type: "start",
            token: 1,
            fen: "fen-a",
            positionIndex: 0,
        });
        expect(canSubmitPracticeMove(waiting, "fen-a")).toBe(true);
        expect(canSubmitPracticeMove(waiting, "fen-b")).toBe(false);
        expect(canSubmitPracticeMove({ ...waiting, phase: "correct" }, "fen-a")).toBe(false);
    });

    it("creates empty statistics and identifies every non-idle practice phase", () => {
        expect(idlePracticeSession()).toEqual({ phase: "idle", token: 0 });
        expect(idlePracticeSession(23)).toEqual({ phase: "idle", token: 23 });
        expect(emptyPracticeStats()).toEqual({
            mode: "anki",
            remainingPositions: [],
            correct: 0,
            incorrect: 0,
            streak: 0,
            bestStreak: 0,
        });
        expect(isPracticePhase("idle")).toBe(false);
        expect(isPracticePhase("waiting")).toBe(true);
        expect(isPracticePhase("correct")).toBe(true);
        expect(isPracticePhase("incorrect")).toBe(true);
    });
});
