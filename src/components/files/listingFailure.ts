import { errorUnlessCancelled } from "@/platform/errors";

export type ListingFailure =
    | "silent"
    | "retry"
    | "changed"
    | "missing"
    | "unusable"
    | "permission"
    | "tooLarge";

/** Only the backend root label establishes that a listing needs another root. */
export function listingFailure(error: unknown): ListingFailure {
    if (error == null) return "silent";
    const visible = errorUnlessCancelled(error);
    if (!visible) return "silent";
    return visible.rootFailure === "too-large" ? "tooLarge" : (visible.rootFailure ?? "retry");
}
