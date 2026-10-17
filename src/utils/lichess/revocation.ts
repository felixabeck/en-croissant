import type { TFunction } from "i18next";
import type { LichessRevocationOutcome } from "@/bindings";
import enUS from "@/translation/en-US.json";

export type RevocationReason =
    | Exclude<LichessRevocationOutcome, "revoked" | "already_invalid">
    | "unconfirmed";

/** Unknown IPC data is never proof that a credential no longer works. */
export function revocationReason(outcome: unknown): RevocationReason | null {
    switch (outcome) {
        case "revoked":
        case "already_invalid":
            return null;
        case "unreachable":
        case "rate_limited":
        case "rejected":
            return outcome;
        default:
            return "unconfirmed";
    }
}

/** A bounded, deterministic set, with no identities or per-token records. */
export function sanitizeRevocationReasons(reasons: readonly unknown[]): RevocationReason[] {
    return (["unreachable", "rate_limited", "rejected", "unconfirmed"] as const).filter((reason) =>
        reasons.includes(reason),
    );
}

export function revocationReasonText(reason: RevocationReason, t: TFunction): string {
    switch (reason) {
        case "unreachable":
            return (
                t("Lichess.Revocation.Unreachable", {}) ||
                enUS.translation["Lichess.Revocation.Unreachable"]
            );
        case "rate_limited":
            return (
                t("Lichess.Revocation.RateLimited", {}) ||
                enUS.translation["Lichess.Revocation.RateLimited"]
            );
        case "rejected":
            return (
                t("Lichess.Revocation.Rejected", {}) ||
                enUS.translation["Lichess.Revocation.Rejected"]
            );
        case "unconfirmed":
            return (
                t("Lichess.Revocation.Unconfirmed", {}) ||
                enUS.translation["Lichess.Revocation.Unconfirmed"]
            );
    }
}
