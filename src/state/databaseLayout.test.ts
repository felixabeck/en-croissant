import { createStore } from "jotai";
import { beforeEach, expect, test, vi } from "vitest";
const report = vi.hoisted(() => vi.fn());
vi.mock("./persistError", () => ({ reportPersistError: report }));
vi.mock("@/platform/native", () => ({ warn: vi.fn() }));
vi.mock("@/i18n", () => ({ default: { t: (key: string) => key } }));
import {
    adaptivePreviewGeometry,
    clampDatabasePercentage,
    createDatabaseSplitAtoms,
    databasePaneGeometry,
    DATABASE_SPLIT_KEY,
    databaseSplitSchema,
} from "./databaseLayout";

beforeEach(() => {
    localStorage.clear();
    report.mockClear();
});

test.each([null, "{bad", "null", '"50"', "1e400", "19", "81"])(
    "invalid or missing %s preference falls back to 50",
    (raw) => {
        if (raw !== null) localStorage.setItem(DATABASE_SPLIT_KEY, raw);
        const atoms = createDatabaseSplitAtoms(localStorage);
        expect(createStore().get(atoms.preferred)).toBe(50);
        expect(localStorage.getItem(DATABASE_SPLIT_KEY)).toBe(raw === null ? null : "50");
        expect(databaseSplitSchema.safeParse(Number.NaN).success).toBe(false);
    },
);

test("transient movement and container clamping do not write the committed shared preference", () => {
    localStorage.setItem(DATABASE_SPLIT_KEY, "25");
    const writes = vi.spyOn(Storage.prototype, "setItem");
    const atoms = createDatabaseSplitAtoms(localStorage);
    const store = createStore();
    const observed: number[] = [];
    const unsubscribe = store.sub(atoms.displayed, () => observed.push(store.get(atoms.displayed)));
    store.set(atoms.transient, 35);
    store.set(atoms.transient, 40);
    const geometry = databasePaneGeometry(800, 16);
    expect(clampDatabasePercentage(25, geometry.minimum)).toBeGreaterThan(40);
    expect(store.get(atoms.preferred)).toBe(25);
    store.set(atoms.transient, null);
    expect(store.get(atoms.displayed)).toBe(25);
    expect(writes).not.toHaveBeenCalled();
    store.set(atoms.commit, 60);
    expect(observed.at(-1)).toBe(60);
    expect(writes).toHaveBeenCalledOnce();
    expect(localStorage.getItem(DATABASE_SPLIT_KEY)).toBe("60");
    expect(createStore().get(createDatabaseSplitAtoms(localStorage).preferred)).toBe(60);
    unsubscribe();
    writes.mockRestore();
});

test("throwing reads and writes report failures while in-memory changes remain usable", () => {
    const storage = {
        getItem: () => {
            throw new Error("private read");
        },
        setItem: () => {
            throw new Error("private write");
        },
        removeItem: vi.fn(),
        clear: vi.fn(),
        key: () => null,
        length: 0,
    };
    const atoms = createDatabaseSplitAtoms(storage);
    const store = createStore();
    expect(store.get(atoms.displayed)).toBe(50);
    store.set(atoms.commit, 65);
    expect(store.get(atoms.displayed)).toBe(65);
    expect(report).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Common.PreferenceReadFailed" }),
    );
    expect(report).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Common.PreferenceSaveFailed" }),
    );
});

test("container floors scale with font size and both effective endpoints keep usable panes", () => {
    expect(databasePaneGeometry(645, 16).compact).toBe(true);
    expect(databasePaneGeometry(646, 16)).toEqual({ compact: false, minimum: 50 });
    expect(databasePaneGeometry(1200, 32).compact).toBe(true);
    const { minimum } = databasePaneGeometry(1000, 16);
    expect(clampDatabasePercentage(20, minimum) * 10 - 3).toBeCloseTo(320);
    expect((100 - clampDatabasePercentage(80, minimum)) * 10 - 3).toBeCloseTo(320);
    expect(databasePaneGeometry(2000, 16).minimum).toBe(20);
});

test("failed corrupt-value repair and commit preserve stored bytes and usable memory", () => {
    localStorage.setItem(DATABASE_SPLIT_KEY, "{malformed");
    const writes = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new DOMException("private quota detail", "QuotaExceededError");
    });
    try {
        const atoms = createDatabaseSplitAtoms(localStorage);
        const store = createStore();
        expect(store.get(atoms.preferred)).toBe(50);
        store.set(atoms.commit, 60);
        expect(store.get(atoms.displayed)).toBe(60);
        expect(localStorage.getItem(DATABASE_SPLIT_KEY)).toBe("{malformed");
        expect(report).toHaveBeenCalledWith(
            expect.objectContaining({ message: "Common.PreferenceRepairFailed" }),
        );
        expect(report).toHaveBeenCalledWith(
            expect.objectContaining({ message: "Common.PreferenceSaveFailed" }),
        );
        expect(writes).toHaveBeenCalledTimes(2);
    } finally {
        writes.mockRestore();
    }
});

test("adaptive geometry grows past half width, reserves notation and controls, and uses physical pixels", () => {
    expect(adaptivePreviewGeometry(900, 700, 16, false)).toMatchObject({
        stacked: false,
        boardSide: 692,
    });
    expect(adaptivePreviewGeometry(500, 850, 16, false)).toMatchObject({
        stacked: true,
        boardSide: 500,
    });
    expect(adaptivePreviewGeometry(500, 850, 32, true)).toMatchObject({
        stacked: true,
        boardSide: 500,
        notationHeight: 384,
    });
});
