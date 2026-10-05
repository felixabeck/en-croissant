import { opposite, parseUci } from "chessops";
import { INITIAL_FEN, makeFen } from "chessops/fen";
import { positionFromFen, swapMove } from "@/utils/chessops";

/** The native searched position and its line-memory key, including threat mode. */
export function analysisSearch(fen: string, moves: string[], threat: boolean) {
    const [position] = positionFromFen(fen);
    if (position) {
        for (const uci of moves) {
            const move = parseUci(uci);
            if (!move) break;
            position.play(move);
        }
    }
    const finalFen = position ? makeFen(position.toSetup()) : null;
    const searchingFen = threat ? swapMove(finalFen || INITIAL_FEN) : fen;
    const searchingMoves = threat ? [] : moves;
    return {
        position,
        finalFen,
        searchingFen,
        searchingMoves,
        searchingTurn: position ? (threat ? opposite(position.turn) : position.turn) : null,
        key: `${searchingFen}:${searchingMoves.join(",")}`,
    };
}
