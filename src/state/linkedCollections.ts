import { useEffect, useRef, useState } from "react";
import { useSWRConfig } from "swr";
import type { CollectionDescriptor, DatabaseHandle } from "@/bindings";
import { tauri } from "@/platform/tauri";
import { registerCollectionCheck } from "./fileFreshness";
import { capabilityKey } from "@/utils/pathCapabilities";

export function isCollectionConsumer(key: unknown) {
    return (
        key === "databases" ||
        (Array.isArray(key) &&
            [
                "file-workspace",
                "games",
                "players",
                "tournaments",
                "personalDatabases",
                "personalInfo",
            ].includes(String(key[0])))
    );
}

export function useCollectionCurrencies(collections: readonly CollectionDescriptor[]) {
    const { mutate } = useSWRConfig();
    const inputs = useRef(collections);
    inputs.current = collections;
    const key = collections
        .map(
            (collection) =>
                `${collection.id}:${collection.database ? capabilityKey(collection.database) : ""}`,
        )
        .join(",");
    useEffect(() => {
        if (!key) return;
        const cleanups = inputs.current.flatMap((collection) => {
            const database = collection.database;
            if (!database || collection.status === "retired") return [];
            let signature = `${collection.status}:${collection.generation}`;
            return [
                registerCollectionCheck(capabilityKey(database), {
                    read: (signal) => tauri.collectionForDatabase(database, { signal }),
                    rebuild: (id) => tauri.rebuildLinkedCollection(id, false),
                    receive: (current, error) => {
                        const next = error
                            ? "unavailable"
                            : current
                              ? `${current.status}:${current.generation}`
                              : "missing";
                        if (next !== signature) {
                            signature = next;
                            void mutate(isCollectionConsumer);
                        }
                    },
                }),
            ];
        });
        return () => cleanups.forEach((cleanup) => cleanup());
    }, [key, mutate]);
}

export function useCollectionCurrency(
    file: DatabaseHandle | null | undefined,
    initial?: CollectionDescriptor,
) {
    const { mutate } = useSWRConfig();
    const key = file ? capabilityKey(file) : null;
    const inputs = useRef({ file, initial });
    inputs.current = { file, initial };
    const [snapshot, setSnapshot] = useState<{
        key: string | null;
        collection: CollectionDescriptor | null;
        error?: unknown;
        pending: boolean;
    }>({ key, collection: initial ?? null, pending: !!file });
    useEffect(() => {
        const { file, initial } = inputs.current;
        if (!file || !key) {
            setSnapshot({ key, collection: null, pending: false });
            return;
        }
        let signature = initial ? `${initial.status}:${initial.generation}` : undefined;
        setSnapshot({ key, collection: initial ?? null, pending: true });
        return registerCollectionCheck(key, {
            read: (signal) => tauri.collectionForDatabase(file, { signal }),
            rebuild: (collection) => tauri.rebuildLinkedCollection(collection, false),
            receive: (collection, error) => {
                setSnapshot({ key, collection, error, pending: false });
                const next = collection
                    ? `${collection.status}:${collection.generation}`
                    : undefined;
                if (signature !== next) {
                    signature = next;
                    void mutate(isCollectionConsumer);
                }
            },
        });
    }, [key, initial?.id, mutate]);
    return snapshot.key === key ? snapshot : { key, collection: null, pending: !!file };
}
