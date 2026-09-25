import { vi } from "vitest";

export function denyStorageRemoval(
    key: string | (() => string) | ((candidate: string) => boolean),
) {
    const originalRemoveItem = Storage.prototype.removeItem;
    return vi
        .spyOn(Storage.prototype, "removeItem")
        .mockImplementation(function (this: Storage, candidate) {
            const match =
                typeof key === "function"
                    ? (key as (candidate: string) => string | boolean)(candidate)
                    : key;
            if (typeof match === "boolean" ? match : candidate === match) {
                throw new DOMException("denied", "SecurityError");
            }
            return originalRemoveItem.call(this, candidate);
        });
}
