import { afterEach, expect, test, vi } from "vitest";
import { createWindowsStateStorage, defaultWindowsState } from "./layoutStorage";

const native = vi.hoisted(() => ({ warn: vi.fn() }));
const persistError = vi.hoisted(() => ({ reportPersistError: vi.fn() }));
vi.mock("@/platform/native", () => native);
vi.mock("./persistError", () => persistError);

afterEach(() => {
    localStorage.clear();
    native.warn.mockClear();
    persistError.reportPersistError.mockClear();
    vi.restoreAllMocks();
});

test("round-trips a valid bounded Mosaic layout", () => {
    const storage = createWindowsStateStorage(localStorage);
    const layout = {
        currentNode: {
            direction: "column" as const,
            first: "bottomRight" as const,
            second: {
                direction: "row" as const,
                first: "left" as const,
                second: "topRight" as const,
                splitPercentage: 35,
            },
        },
    };

    storage.setItem("windowsState", layout);

    expect(storage.getItem("windowsState", defaultWindowsState())).toEqual(layout);
});

test.each([
    { currentNode: "obsoletePane" },
    {
        currentNode: {
            direction: "row",
            first: "left",
            second: "left",
        },
    },
    {
        currentNode: {
            direction: "row",
            first: "left",
            second: "topRight",
            obsolete: true,
        },
    },
])("repairs corrupt or obsolete hydration to the safe layout", (stored) => {
    localStorage.setItem("windowsState", JSON.stringify(stored));
    const storage = createWindowsStateStorage(localStorage);

    expect(storage.getItem("windowsState", defaultWindowsState())).toEqual(defaultWindowsState());
    expect(JSON.parse(localStorage.getItem("windowsState")!)).toEqual(defaultWindowsState());
    expect(native.warn).toHaveBeenCalledWith("Invalid persisted value for windowsState");
});

test("reports a quota-failed write and preserves the last valid layout for reload", () => {
    const storage = createWindowsStateStorage(localStorage);
    const durable = { currentNode: "left" as const };
    storage.setItem("windowsState", durable);
    const originalSetItem = Storage.prototype.setItem;
    const quotaError = new DOMException("quota", "QuotaExceededError");
    const setItem = vi
        .spyOn(Storage.prototype, "setItem")
        .mockImplementation(function (this: Storage, key, value) {
            if (key === "windowsState") throw quotaError;
            return originalSetItem.call(this, key, value);
        });

    storage.setItem("windowsState", { currentNode: "topRight" });
    setItem.mockRestore();

    expect(persistError.reportPersistError).toHaveBeenCalledOnce();
    expect(
        createWindowsStateStorage(localStorage).getItem("windowsState", defaultWindowsState()),
    ).toEqual(durable);
});
