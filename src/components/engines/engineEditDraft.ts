import { useAtom, useStore } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { notifyUnlessCancelled } from "@/components/files/notifyError";
import { enginesAtom } from "@/state/atoms";
import type { Engine, LocalEngine } from "@/utils/engines";
import type { EngineOption } from "@/bindings";

export type EngineEditIntent =
    | { kind: "field"; field: "name"; value: string }
    | { kind: "field"; field: "version"; value: string }
    | { kind: "field"; field: "elo"; value: number | undefined }
    | { kind: "field"; field: "go"; value: LocalEngine["go"] }
    | { kind: "option"; name: string; value: string | EngineOption | null }
    | { kind: "defaults"; settings: EngineOption[] }
    | { kind: "reset"; settings: EngineOption[] | undefined };

export function mergeEngineOptions(
    current: EngineOption[],
    changed: EngineOption[],
    removed: string[] = [],
): EngineOption[] {
    const names = new Set([...removed, ...changed.map((option) => option.name)]);
    return [...current.filter((option) => !names.has(option.name)), ...changed];
}

/** Applies only the accepted fields to the latest record. Missing identities stay missing. */
export function applyEngineEdit(engine: Engine, intent: EngineEditIntent): Engine {
    if (intent.kind === "field") {
        if (intent.field !== "name" && engine.type !== "local") return engine;
        return { ...engine, [intent.field]: intent.value };
    }
    if (intent.kind === "reset") return { ...engine, settings: intent.settings };
    if (intent.kind === "defaults") {
        const settings = engine.settings ?? [];
        return {
            ...engine,
            settings: [
                ...settings,
                ...intent.settings.filter(
                    (option) => !settings.some((stored) => stored.name === option.name),
                ),
            ],
        };
    }
    const settings = mergeEngineOptions(
        engine.settings ?? [],
        intent.value === null
            ? []
            : [
                  typeof intent.value === "string"
                      ? { type: "string", name: intent.name, value: intent.value }
                      : intent.value,
              ],
        [intent.name],
    );
    return { ...engine, settings };
}

function intentKey(intent: EngineEditIntent) {
    return intent.kind === "field"
        ? intent.field
        : intent.kind === "option"
          ? `option:${intent.name}`
          : "settings";
}

/** Retains at most the latest intent for each currently edited field or option. */
export class EngineEditDraft {
    private intents = new Map<string, { identity: symbol; intent: EngineEditIntent }>();
    private closed = false;

    accept(intent: EngineEditIntent) {
        if (this.closed) return null;
        const identity = Symbol();
        const key = intentKey(intent);
        this.intents.delete(key);
        this.intents.set(key, { identity, intent });
        return identity;
    }

    settle(intent: EngineEditIntent, identity: symbol | null) {
        const key = intentKey(intent);
        if (this.closed || this.intents.get(key)?.identity !== identity) return false;
        this.intents.delete(key);
        return true;
    }

    display<T extends Engine>(engine: T): T {
        let displayed: Engine = engine;
        for (const { intent } of this.intents.values())
            displayed = applyEngineEdit(displayed, intent);
        return displayed as T;
    }

    close() {
        this.closed = true;
        this.intents.clear();
    }
}

export function useEngineEditDraft<T extends Engine>(engine: T) {
    const [, save] = useAtom(enginesAtom);
    const store = useStore();
    const { t } = useTranslation();
    const owner = useRef(new EngineEditDraft());
    const [, render] = useState(0);
    useEffect(() => {
        const draft = new EngineEditDraft();
        owner.current = draft;
        return () => draft.close();
    }, [engine.id]);

    const submit = useCallback(
        (intent: EngineEditIntent) => {
            const draft = owner.current;
            const identity = draft.accept(intent);
            if (identity === null) return;
            render((value) => value + 1);
            void (async () => {
                try {
                    await save((current) =>
                        current.map((item) =>
                            item.id === engine.id ? applyEngineEdit(item, intent) : item,
                        ),
                    );
                } catch (error) {
                    notifyUnlessCancelled(t("Common.Error"), error);
                } finally {
                    if (draft.settle(intent, identity)) render((value) => value + 1);
                }
            })();
        },
        [engine.id, save, t],
    );

    const readDisplayed = useCallback(
        () =>
            owner.current.display(
                (store.get(enginesAtom)?.find((item) => item.id === engine.id) ?? engine) as T,
            ),
        [engine, store],
    );
    return { displayed: readDisplayed(), readDisplayed, submit };
}
