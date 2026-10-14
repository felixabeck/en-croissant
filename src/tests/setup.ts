import { afterEach } from "vitest";
import type { TabStorageRepository } from "@/state/store/tabStorage";
import { createTabStorageCleanup } from "@/utils/tests/tabStorageCleanup";

// Register only scheduled repositories. Do not preload tabStorage or its platform
// imports here, so each suite's hoisted mocks still apply to the first import.
const cleanup = createTabStorageCleanup();
(
    globalThis as typeof globalThis & {
        __chessfableTrackTabStorage?: (repository: TabStorageRepository) => void;
    }
).__chessfableTrackTabStorage = cleanup.track;

afterEach(() => cleanup.drain());
