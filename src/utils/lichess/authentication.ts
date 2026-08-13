import { tauri } from "@/platform/tauri";
import { getDefaultStore } from "jotai";
import { type AuthenticationStatus } from "@/bindings";
import { sessionsAtom } from "@/state/atoms";
import { getLichessAccount } from "@/utils/lichess/api";
import { upsertLichessSession } from "@/utils/session";

const POLL_INTERVAL_MS = 500;

// OAuth completion belongs to the application, rather than a mounted account-modal instance.
// The stable normalized username is the request key, so same-tick clicks cannot open two browser
// jobs before native returns the job correlation id. Different aliases may share one account.
const activeJobs = new Map<string, Promise<boolean>>();

async function poll(job: string): Promise<AuthenticationStatus> {
    while (true) {
        const status = await tauri.getAuthenticationStatus(job);
        if (status.state !== "pending") return status;
        await new Promise((resolve) => window.setTimeout(resolve, POLL_INTERVAL_MS));
    }
}

export async function authenticateLichess(alias: string, username: string): Promise<boolean> {
    const key = username.trim().toLocaleLowerCase();
    if (!key) throw new Error("authentication username is required");
    const existing = activeJobs.get(key);
    if (existing) return existing;
    const completion = (async () => {
        const started = await tauri.authenticate(username);
        const completed = await poll(started);
        if (completed.state !== "succeeded") return false;
        const metadata = completed.account;
        const account = await getLichessAccount({ handle: metadata.handle });
        if (!account) return false;
        const store = getDefaultStore();
        store.set(sessionsAtom, (sessions) =>
            upsertLichessSession(sessions, alias, {
                handle: metadata.handle,
                username: metadata.username,
                account,
            }),
        );
        return true;
    })().finally(() => activeJobs.delete(key));
    activeJobs.set(key, completion);
    return completion;
}
