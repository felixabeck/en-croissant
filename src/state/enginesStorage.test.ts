import { expect, test, vi } from "vitest";

const reportPersistError = vi.hoisted(() => vi.fn());
const t = vi.hoisted(() => vi.fn(() => "The engine list could not be saved."));

vi.mock("./persistError", () => ({ reportPersistError }));
vi.mock("@/i18n", () => ({ default: { t } }));

import { enginesStorage } from "./atoms";

test("reports an engine-list quota failure without rejecting", async () => {
    const cause = new DOMException("Storage quota exceeded", "QuotaExceededError");
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
        throw cause;
    });

    await expect(enginesStorage.setItem("engines", "payload")).resolves.toBeUndefined();

    expect(t).toHaveBeenCalledWith("Engines.SaveError");
    expect(reportPersistError).toHaveBeenCalledOnce();
    const error = reportPersistError.mock.calls[0][0] as Error;
    expect(error.message).toBe("The engine list could not be saved.");
    expect(error.cause).toBe(cause);
    setItem.mockRestore();
});
