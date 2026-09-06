import { expect, test, vi } from "vitest";

vi.mock("@/i18n", () => ({
    default: { t: (key: string) => `translated:${key}` },
}));

import { storageErrorCause } from "./storageError";

test("uses translated quota fallback for quota DOMExceptions", () => {
    const cause = new DOMException("quota at /home/felix/secret.pgn", "QuotaExceededError");

    expect(storageErrorCause(cause)).toBe("translated:Common.StorageQuotaExceeded");
});

test("normalizes and redacts ordinary error messages", () => {
    const cause = new Error("token=secret at /home/felix/secret.pgn");

    const message = storageErrorCause(cause);

    expect(message).toContain("token=[redacted]");
    expect(message).not.toContain("secret");
    expect(message).not.toContain("/home/felix");
});

test("normalizes non-Error DOMException messages", () => {
    const cause = new DOMException("backend rejected /home/felix/secret.pgn", "UnknownError");

    const message = storageErrorCause(cause);

    expect(message).toContain("backend rejected");
    expect(message).not.toContain("/home/felix");
});

test("uses translated fallback when the failure has no useful message", () => {
    expect(storageErrorCause({})).toBe("translated:Common.StorageRejected");
});
