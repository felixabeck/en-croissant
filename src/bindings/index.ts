import type {
    BestMoves as BestMovesT,
    DatabaseHandle,
    DatabaseInfo as DatabaseInfoT,
    GameQuery,
    Score as ScoreT,
    ScoreValue as ScoreValueT,
} from "./generated";

/** Renderer callers may import generated types, never generated command/event values. */
export type * from "./generated";
export type ScoreValue = ScoreValueT | { type: "dtz"; value: number };
export type Score = Omit<ScoreT, "value"> & { value: ScoreValue };
export type BestMoves = Omit<BestMovesT, "score"> & {
    score: Score;
};

export type DatabaseInfo =
    | (DatabaseInfoT & {
          type: "success";
          file: DatabaseHandle;
          downloadLink?: string;
          filter?: GameQuery;
      })
    | {
          type: "error";
          file: DatabaseHandle;
          filename: string;
          error: string;
          indexed: boolean;
      };
