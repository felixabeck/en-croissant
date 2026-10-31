import { z } from "zod";

export const PIECE_SCALE_DEFAULT = 100;
export const PIECE_SCALE_MIN = 70;
export const PIECE_SCALE_MAX = 100;
export const PIECE_SCALE_STEP = 5;
export const PIECE_SCALE_MARKS = [PIECE_SCALE_MIN, 85, PIECE_SCALE_MAX];

export const pieceScaleSchema = z
    .number()
    .int()
    .min(PIECE_SCALE_MIN)
    .max(PIECE_SCALE_MAX)
    .multipleOf(PIECE_SCALE_STEP);
