export type EngineNameEntry = {
    id: string;
    name: string;
};

export type EngineValidationKey =
    | "Common.RequireName"
    | "Common.NameAlreadyUsed"
    | "Common.RequirePath";

export type EngineValidationTranslator = (key: EngineValidationKey) => string;

type ValidationRule = (value: string) => string | undefined;

export type EngineFormValidation = {
    name: ValidationRule;
    filename: ValidationRule;
};

export function createEngineFormValidation(
    engines: readonly EngineNameEntry[],
    t: EngineValidationTranslator,
    editedEngineId?: string,
): EngineFormValidation {
    return {
        name: (value) => {
            if (!value) return t("Common.RequireName");
            if (engines.some((engine) => engine.name === value && engine.id !== editedEngineId)) {
                return t("Common.NameAlreadyUsed");
            }
            return undefined;
        },
        filename: (value) => (!value ? t("Common.RequirePath") : undefined),
    };
}
