import { act } from "react";
import type { Root } from "react-dom/client";
import { vi } from "vitest";

// Prevent a failed portrait case's late verification from crossing the next mock reset.
// Keep signed bytes, verification, parsing and SWR publication real, inside React's act boundary.
// Remove this helper when portrait tests no longer load catalogs through dynamic imports.
// Deliberately held native promises still need their test's explicit release and await.
export async function settlePortraitCatalog() {
    await act(async () => {
        await vi.dynamicImportSettled();
    });
}

export async function cleanupPortraitTest(root: Root, host: HTMLDivElement) {
    try {
        await act(async () => root.unmount());
    } finally {
        try {
            await settlePortraitCatalog();
        } finally {
            host.remove();
        }
    }
}
