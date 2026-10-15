import { Box } from "@mantine/core";
import { useElementSize, useForceUpdate } from "@mantine/hooks";
import { type Move, makeUci, type NormalMove, parseSquare } from "chessops";
import { chessgroundDests, chessgroundMove } from "chessops/compat";
import { useAtom, useAtomValue } from "jotai";
import { useContext, useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import { useTranslation } from "react-i18next";
import { notifyUnlessCancelled } from "@/components/files/notifyError";
import { validateMoveSequence } from "@/state/store/tree";
import { Chessground } from "@/chessground/Chessground";
import type { PathRef } from "@/bindings";
import { jumpToNextPuzzleAtom, moveHighlightAtom, showCoordinatesAtom } from "@/state/atoms";
import classes from "@/styles/Chessboard.module.css";
import { positionFromFen } from "@/utils/chessops";
import { capabilityKey } from "@/utils/pathCapabilities";
import {
  captureTreePositionOwner,
  getPuzzleProgress,
  puzzleMoveMatches,
  type Completion,
  type Puzzle,
} from "@/utils/puzzles";
import { getNodeAtPath } from "@/utils/treeReducer";
import BoardFrame from "@/components/boards/BoardFrame";
import { chooserArrows, continuationBrushes } from "@/components/boards/continuationArrows";
import { useVariationChooser } from "@/components/common/TreeStateContext";
import PromotionModal from "../boards/PromotionModal";
import { TreeStateContext } from "../common/TreeStateContext";

function PuzzleBoard({
  puzzles,
  currentPuzzle,
  changeCompletion,
  generatePuzzle,
  db,
  blocked = false,
}: {
  puzzles: Puzzle[];
  currentPuzzle: number;
  changeCompletion: (
    completion: Completion,
    isCurrent?: () => boolean,
    refreshOwner?: () => void,
  ) => Promise<boolean | void>;
  generatePuzzle: (db: PathRef, isCurrent?: () => boolean) => Promise<void>;
  db: PathRef | null;
  blocked?: boolean;
}) {
  const { t } = useTranslation();
  const store = useContext(TreeStateContext)!;
  const root = useStore(store, (s) => s.root);
  const position = useStore(store, (s) => s.position);
  const moveHighlight = useAtomValue(moveHighlightAtom);
  const { choice } = useVariationChooser();
  const boardShapes = useStore(store, (s) => s.currentNode().shapes);
  const makeMove = useStore(store, (s) => s.makeMove);
  const makeMoves = useStore(store, (s) => s.makeMoves);
  const reset = useForceUpdate();
  const [jumpToNextPuzzleImmediately] = useAtom(jumpToNextPuzzleAtom);

  const currentNode = getNodeAtPath(root, position);

  let puzzle: Puzzle | null = null;
  if (puzzles.length > 0) {
    puzzle = puzzles[currentPuzzle];
  }
  const databaseKey = db ? capabilityKey(db) : null;
  const latest = useRef({ puzzle, currentPuzzle, databaseKey });
  latest.current = { puzzle, currentPuzzle, databaseKey };
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  function captureOwner(expectedRoot = root, expectedPosition = position): () => boolean {
    const ownsSession = store.getState().capturePuzzleSessionOwner();
    const attemptId = store.getState().puzzleSession?.selectedAttemptId;
    const ownsPosition = captureTreePositionOwner(store, {
      root: expectedRoot,
      position: expectedPosition,
    });
    return () => {
      return (
        mounted.current &&
        ownsSession() &&
        (attemptId !== undefined ||
          (latest.current.puzzle === puzzle && latest.current.currentPuzzle === currentPuzzle)) &&
        latest.current.databaseKey === databaseKey &&
        ownsPosition()
      );
    };
  }

  const [pos] = positionFromFen(currentNode.fen);
  const [puzzlePos] = puzzle ? positionFromFen(puzzle.fen) : [null];
  const progress = getPuzzleProgress(puzzle, root, position);
  const currentMove = progress.step ?? 0;
  const orientation = puzzlePos ? (puzzlePos.turn === "white" ? "black" : "white") : "white";
  const [pendingMove, setPendingMove] = useState<NormalMove | null>(null);

  const dests = pos ? chessgroundDests(pos) : new Map();
  const turn = pos?.turn || "white";
  const showCoordinates = useAtomValue(showCoordinatesAtom);
  const canPlay =
    !blocked &&
    puzzle &&
    puzzlePos &&
    progress.atFrontier &&
    (puzzle.completion === "incomplete" || puzzle.completion === "incorrect");

  async function checkMove(move: Move) {
    const isCurrent = captureOwner();
    if (!isCurrent() || !pos || !puzzle || !canPlay || !pos.isLegal(move)) return;
    const sequence = validateMoveSequence(puzzle.fen, puzzle.moves);
    if (!sequence.success) {
      notifyUnlessCancelled(t("Common.Error"), sequence.error);
      reset();
      return;
    }

    const newPos = pos.clone();
    const uci = makeUci(move);
    newPos.play(move);

    if (puzzleMoveMatches(pos, move, puzzle.moves[currentMove]) || newPos.isCheckmate()) {
      const newMoves = [
        uci,
        ...(newPos.isCheckmate() ? [] : puzzle.moves.slice(currentMove + 1, currentMove + 2)),
      ];
      const result = makeMoves({
        payload: newMoves,
        mainline: true,
        changeHeaders: false,
      });
      if (!result.success) {
        notifyUnlessCancelled(t("Common.Error"), result.error);
        reset();
        return;
      }
      const state = store.getState();
      let ownsAfterMove = captureOwner(state.root, state.position);
      const isCurrentAfterMove = () => ownsAfterMove();
      const refreshOwner = () => {
        ownsAfterMove = captureOwner(store.getState().root, store.getState().position);
      };
      if (currentMove === puzzle.moves.length - 1 || newPos.isCheckmate()) {
        if (puzzle.completion !== "incorrect") {
          const saved = await changeCompletion("correct", isCurrentAfterMove, refreshOwner);
          if (saved === false) return;
          if (!isCurrentAfterMove()) return;
        }

        if (db && jumpToNextPuzzleImmediately) {
          await generatePuzzle(db, isCurrentAfterMove);
          if (!isCurrentAfterMove()) return;
          reset();
          return;
        }
      }
    } else {
      makeMove({
        payload: move,
        changePosition: false,
        changeHeaders: false,
      });
      const state = store.getState();
      let ownsAfterMove = captureOwner(state.root, state.position);
      const isCurrentAfterMove = () => ownsAfterMove();
      if (puzzle.completion === "incomplete") {
        await changeCompletion("incorrect", isCurrentAfterMove, () => {
          ownsAfterMove = captureOwner(store.getState().root, store.getState().position);
        });
        if (!isCurrentAfterMove()) return;
      }
    }
    reset();
  }

  const { ref: parentRef, height: parentHeight } = useElementSize();

  return (
    <Box w="100%" h="100%" ref={parentRef}>
      <BoardFrame style={{ maxWidth: parentHeight }}>
        <Box className={classes.chessboard}>
          <PromotionModal
            pendingMove={pendingMove}
            cancelMove={() => setPendingMove(null)}
            confirmMove={async (p) => {
              if (pendingMove) {
                await checkMove({ ...pendingMove, promotion: p });
                setPendingMove(null);
              }
            }}
            turn={turn}
            orientation={orientation}
          />
          <Chessground
            animation={{
              enabled: true,
            }}
            coordinates={showCoordinates !== "no"}
            coordinatesOnSquares={showCoordinates === "all"}
            orientation={orientation}
            drawable={{
              enabled: true,
              visible: true,
              autoShapes: [...chooserArrows(choice), ...boardShapes],
              brushes: continuationBrushes,
            }}
            movable={{
              free: false,
              color: canPlay ? turn : undefined,
              dests: dests,
              events: {
                after: (orig, dest) => {
                  const from = parseSquare(orig)!;
                  const to = parseSquare(dest)!;
                  const move: NormalMove = { from, to };
                  if (
                    pos?.board.get(from)?.role === "pawn" &&
                    ((dest[1] === "8" && turn === "white") || (dest[1] === "1" && turn === "black"))
                  ) {
                    setPendingMove(move);
                  } else {
                    checkMove(move);
                  }
                },
              },
            }}
            lastMove={
              moveHighlight && currentNode.move ? chessgroundMove(currentNode.move) : undefined
            }
            turnColor={turn}
            fen={currentNode.fen}
            check={moveHighlight && pos?.isCheck()}
          />
        </Box>
      </BoardFrame>
    </Box>
  );
}

export default PuzzleBoard;
