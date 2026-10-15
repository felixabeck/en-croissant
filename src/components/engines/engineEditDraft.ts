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
    const settings = (engine.settings ?? []).filter((option) => option.name !== intent.name);
    if (intent.value !== null)
        settings.push(
            typeof intent.value === "string"
                ? { type: "string", name: intent.name, value: intent.value }
                : intent.value,
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
    const owner = useRef({ id: engine.id, draft: new EngineEditDraft() });
    const [, render] = useState(0);
    useEffect(() => {
        const draft = new EngineEditDraft();
        owner.current = { id: engine.id, draft };
        return () => draft.close();
    }, [engine.id]);

    const submit = useCallback(
        (action: EngineEditIntent | EngineEditIntent[]) => {
            const draft = owner.current.draft;
            if (
                owner.current.id !== engine.id ||
                !store.get(enginesAtom)?.some((item) => item.id === engine.id)
            )
                return;
            const intents = Array.isArray(action) ? action : [action];
            if (intents.length === 0) return;
            const accepted = intents.map((intent) => ({ intent, identity: draft.accept(intent) }));
            if (accepted.some(({ identity }) => identity === null)) return;
            render((value) => value + 1);
            void (async () => {
                try {
                    await save((current) =>
                        current.map((item) =>
                            item.id === engine.id ? intents.reduce(applyEngineEdit, item) : item,
                        ),
                    );
                } catch (error) {
                    notifyUnlessCancelled(t("Common.Error"), error);
                } finally {
                    let settled = false;
                    for (const { intent, identity } of accepted) {
                        if (draft.settle(intent, identity)) settled = true;
                    }
                    if (settled) render((value) => value + 1);
                }
            })();
        },
        [engine.id, save, store, t],
    );

    const readDisplayed = useCallback(
        () =>
            owner.current.draft.display(
                (store.get(enginesAtom)?.find((item) => item.id === engine.id) ?? engine) as T,
            ),
        [engine, store],
    );
    return { displayed: readDisplayed(), readDisplayed, submit };
}
