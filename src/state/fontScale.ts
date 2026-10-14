import { z } from "zod";

export const FONT_SCALE_DEFAULT = 100;
export const FONT_SCALE_MIN = 50;
export const FONT_SCALE_MAX = 200;
export const FONT_SCALE_STEP = 10;

export const fontScaleSchema = z
    .number()
    .int()
    .min(FONT_SCALE_MIN)
    .max(FONT_SCALE_MAX)
    .multipleOf(FONT_SCALE_STEP);
