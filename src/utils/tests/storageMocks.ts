import { vi } from "vitest";

export function denyStorageRemoval(key: string | (() => string)) {
    const originalRemoveItem = Storage.prototype.removeItem;
    return vi
        .spyOn(Storage.prototype, "removeItem")
        .mockImplementation(function (this: Storage, candidate) {
            const deniedKey = typeof key === "function" ? key() : key;
            if (candidate === deniedKey) throw new DOMException("denied", "SecurityError");
            return originalRemoveItem.call(this, candidate);
        });
}
