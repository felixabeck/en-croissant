import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { createContext } from "react";
import { z } from "zod";
import { createZodStorage } from "./utils";

export const DATABASE_SPLIT_KEY = "database-table-percentage";
export const databaseSplitSchema = z.number().finite().min(20).max(80);

export function createDatabaseSplitAtoms(storage: Storage) {
    const preferred = atomWithStorage(
        DATABASE_SPLIT_KEY,
        50,
        createZodStorage(databaseSplitSchema, storage),
        { getOnInit: true },
    );
    const transient = atom<number | null>(null);
    const displayed = atom((get) => get(transient) ?? get(preferred));
    const commit = atom(null, (_get, set, percentage: number) => {
        const value = databaseSplitSchema.parse(percentage);
        set(transient, null);
        set(preferred, value);
    });
    return { preferred, transient, displayed, commit };
}

export const databaseSplitAtoms = createDatabaseSplitAtoms(localStorage);

// Mosaic's row divider extends three pixels into each tile.
export function databasePaneGeometry(width: number, rootFont: number) {
    const floor = 20 * rootFont;
    const compact = width < 2 * floor + 6;
    const minimum = compact ? 50 : Math.max(20, ((floor + 3) / width) * 100);
    return { compact, minimum };
}

export function clampDatabasePercentage(value: number, minimum: number) {
    return Math.max(minimum, Math.min(100 - minimum, value));
}

export const DatabaseLayoutContext = createContext({ compact: false, minimum: 20, rootFont: 16 });

export function fitPreviewSquare(width: number, height: number) {
    return Math.max(0, Math.min(width, height));
}

export function adaptivePreviewGeometry(
    width: number,
    height: number,
    rootFont: number,
    compact: boolean,
) {
    const gap = rootFont;
    const notationWidth = 12 * rootFont;
    const notationHeight = 8 * rootFont;
    // Four large actions and their gaps can wrap to two rows in a narrow frame.
    const controlsHeight = (width < 14 * rootFont ? 6 : 3) * rootFont;
    const beside = fitPreviewSquare(width - notationWidth - gap, height);
    const below = fitPreviewSquare(width, height - notationHeight - controlsHeight - 2 * gap);
    const stacked = compact || width < notationWidth + 8 * rootFont || below > beside;
    return {
        stacked,
        boardSide: compact ? width : stacked ? below : beside,
        notationHeight: compact ? 12 * rootFont : notationHeight,
    };
}
