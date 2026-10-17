import { createInstance } from "i18next";
import { expect, test } from "vitest";
import enUS from "@/translation/en-US.json";
import { revocationReason, revocationReasonText, sanitizeRevocationReasons } from "./revocation";

test.each(["revoked", "already_invalid"])("%s confirms unusability", (outcome) => {
    expect(revocationReason(outcome)).toBeNull();
});

test.each(["unreachable", "rate_limited", "rejected"] as const)(
    "%s remains a distinct pending reason",
    (outcome) => {
        expect(revocationReason(outcome)).toBe(outcome);
    },
);

test.each([null, undefined, "private-token", { token: "private-token" }])(
    "unknown data remains unconfirmed without echoing it",
    (outcome) => {
        expect(revocationReason(outcome)).toBe("unconfirmed");
    },
);

test("summaries are bounded sets and never retain arbitrary data", () => {
    expect(
        sanitizeRevocationReasons([
            "rejected",
            "private-token",
            null,
            "unreachable",
            "rejected",
            "unconfirmed",
            "rate_limited",
        ]),
    ).toEqual(["unreachable", "rate_limited", "rejected", "unconfirmed"]);
});

test("every reason has localized text and a pre-initialization English fallback", async () => {
    const i18n = createInstance();
    const reasons = ["unreachable", "rate_limited", "rejected", "unconfirmed"] as const;
    const fallback = reasons.map((reason) => revocationReasonText(reason, i18n.t));
    expect(new Set(fallback).size).toBe(4);
    expect(fallback.every((text) => Boolean(text) && !text.startsWith("Lichess."))).toBe(true);
    await i18n.init({ lng: "en-US", keySeparator: false, resources: { "en-US": enUS } });
    expect(reasons.map((reason) => revocationReasonText(reason, i18n.t))).toEqual(fallback);
});
