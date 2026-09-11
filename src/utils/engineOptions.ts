import type { EngineOption } from "@/bindings";

export function normalizeEngineOptions(options: readonly EngineOption[]): EngineOption[] {
    return options.map((option) =>
        option.type === "resource" ? option : { ...option, value: option.value.toString() },
    );
}
