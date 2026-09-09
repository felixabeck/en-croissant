import type { MosaicNode } from "react-mosaic-component";
import type { SyncStorage, SyncStringStorage } from "jotai/vanilla/utils/atomWithStorage";
import { z } from "zod";
import { createZodStorage } from "./utils";

export type ViewId = "left" | "topRight" | "bottomRight";

export interface WindowsState {
    currentNode: MosaicNode<ViewId> | null;
}

const viewIdSchema = z.enum(["left", "topRight", "bottomRight"]);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBoundedMosaicNode(value: unknown): value is MosaicNode<ViewId> {
    const pending: Array<{ node: unknown; depth: number }> = [{ node: value, depth: 0 }];
    const panes = new Set<ViewId>();
    let nodeCount = 0;
    while (pending.length > 0) {
        const current = pending.pop();
        if (!current) return false;
        const { node, depth } = current;
        if (++nodeCount > 5 || depth > 2) return false;
        const pane = viewIdSchema.safeParse(node);
        if (pane.success) {
            if (panes.has(pane.data)) return false;
            panes.add(pane.data);
            continue;
        }
        if (!isRecord(node)) return false;
        if (
            Object.keys(node).some(
                (key) => !["direction", "first", "second", "splitPercentage"].includes(key),
            )
        ) {
            return false;
        }
        if (node.direction !== "row" && node.direction !== "column") return false;
        if (!("first" in node) || !("second" in node)) return false;
        if (
            node.splitPercentage !== undefined &&
            (typeof node.splitPercentage !== "number" ||
                !Number.isFinite(node.splitPercentage) ||
                node.splitPercentage < 0 ||
                node.splitPercentage > 100)
        ) {
            return false;
        }
        pending.push({ node: node.first, depth: depth + 1 });
        pending.push({ node: node.second, depth: depth + 1 });
    }
    return true;
}

const mosaicNodeSchema = z.custom<MosaicNode<ViewId>>(isBoundedMosaicNode);
const windowsStateSchema = z.object({ currentNode: mosaicNodeSchema.nullable() }).strict();

export function defaultWindowsState(): WindowsState {
    return {
        currentNode: {
            direction: "row",
            first: "left",
            second: {
                direction: "column",
                first: "topRight",
                second: "bottomRight",
            },
        },
    };
}

export function createWindowsStateStorage(
    storage: SyncStringStorage = localStorage,
): SyncStorage<WindowsState> {
    return createZodStorage(windowsStateSchema, storage);
}
