import { describe, expect, test, vi } from "vitest";
import { createEngineFormValidation, type EngineValidationKey } from "./engineFormValidation";

const translations: Record<EngineValidationKey, string> = {
    "Common.RequireName": "translated name required",
    "Common.NameAlreadyUsed": "translated name already used",
    "Common.RequirePath": "translated path required",
};

function translator(key: EngineValidationKey): string {
    return translations[key];
}

describe("createEngineFormValidation", () => {
    test("returns translated errors for missing fields and duplicate names", () => {
        const t = vi.fn(translator);
        const validate = createEngineFormValidation([{ id: "existing", name: "Stockfish" }], t);

        expect(validate.name("")).toBe("translated name required");
        expect(validate.filename("")).toBe("translated path required");
        expect(validate.name("Stockfish")).toBe("translated name already used");
        expect(t).toHaveBeenCalledWith("Common.RequireName");
        expect(t).toHaveBeenCalledWith("Common.RequirePath");
        expect(t).toHaveBeenCalledWith("Common.NameAlreadyUsed");
    });

    test("returns no error for valid fields", () => {
        const validate = createEngineFormValidation([], translator);

        expect(validate.name("Stockfish")).toBeUndefined();
        expect(validate.filename("/engines/stockfish")).toBeUndefined();
    });

    test("accepts the copied current engine when its immutable id matches", () => {
        const validate = createEngineFormValidation(
            [{ id: "current", name: "Stockfish" }],
            translator,
            "current",
        );

        expect(validate.name("Stockfish")).toBeUndefined();
    });

    test("rejects the same name when another engine id owns it", () => {
        const validate = createEngineFormValidation(
            [
                { id: "current", name: "Stockfish" },
                { id: "other", name: "Stockfish" },
            ],
            translator,
            "current",
        );

        expect(validate.name("Stockfish")).toBe("translated name already used");
    });
});
