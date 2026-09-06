import type { PathRef } from "@/bindings";
import { abandonEngineAttachments, type EngineOwnerSaveReceipt } from "@/state/engineOwnerStorage";

type Attachment = { id: PathRef };
export type EngineAttachmentSubmission = ReadonlyArray<{
    slot: string;
    id: string;
    generation: number;
}>;

async function abandon(ids: PathRef[]) {
    if (ids.length === 0) return;
    await abandonEngineAttachments(ids);
}

/** Owns picker results from issuance through correlated durable adoption or draft disposal. */
export class EngineAttachmentDraft {
    private generations = new Map<string, number>();
    private attachments = new Map<
        string,
        { attachment: Attachment; generation: number; token: string }
    >();
    private outstanding = new Map<string, Attachment>();
    private closed = false;

    private token(slot: string, generation: number) {
        return `${slot}\0${generation}`;
    }

    private isCurrent(slot: string, generation: number, id: string) {
        const current = this.attachments.get(slot);
        return (
            !this.closed &&
            this.generations.get(slot) === generation &&
            current?.generation === generation &&
            current.attachment.id.id === id
        );
    }

    private async disposeTokens(tokens: readonly string[]) {
        const selected = new Set(tokens);
        const ids = new Map<string, PathRef>();
        for (const token of selected) {
            const attachment = this.outstanding.get(token);
            if (!attachment) continue;
            const shared = [...this.outstanding].some(
                ([otherToken, other]) =>
                    !selected.has(otherToken) && other.id.id === attachment.id.id,
            );
            if (!shared) ids.set(attachment.id.id, attachment.id);
        }
        await abandon([...ids.values()]);
        for (const token of selected) this.outstanding.delete(token);
    }

    async issue<T extends Attachment>(
        slot: string,
        picker: () => Promise<T>,
        apply: (
            attachment: T,
            isCurrent: () => boolean,
        ) => void | boolean | Promise<void | boolean>,
    ): Promise<T | null> {
        const generation = (this.generations.get(slot) ?? 0) + 1;
        this.generations.set(slot, generation);
        const attachment = await picker();
        const token = this.token(slot, generation);
        this.outstanding.set(token, attachment);
        // Record ownership before consulting stale state: every issued handle gets a terminal path.
        const stale = this.closed || this.generations.get(slot) !== generation;
        if (stale) {
            await this.disposeTokens([token]);
            return null;
        }
        const previous = this.attachments.get(slot);
        if (previous) await this.disposeTokens([previous.token]);
        if (this.closed || this.generations.get(slot) !== generation) {
            await this.disposeTokens([token]);
            return null;
        }
        this.attachments.set(slot, { attachment, generation, token });
        const applied = await apply(attachment, () =>
            this.isCurrent(slot, generation, attachment.id.id),
        );
        if (applied === false) {
            if (this.attachments.get(slot)?.token === token) this.attachments.delete(slot);
            await this.disposeTokens([token]);
            return null;
        }
        if (this.closed || this.generations.get(slot) !== generation) return null;
        return attachment;
    }

    invalidate(slot: string) {
        this.generations.set(slot, (this.generations.get(slot) ?? 0) + 1);
    }

    attachmentIds(): string[] {
        return [...this.attachments.values()].map(({ attachment }) => attachment.id.id);
    }

    submission(): EngineAttachmentSubmission {
        return [...this.attachments].map(([slot, { attachment, generation }]) => ({
            slot,
            id: attachment.id.id,
            generation,
        }));
    }

    async adopt(receipt: EngineOwnerSaveReceipt, submitted: EngineAttachmentSubmission) {
        if (!receipt.saved) return;
        for (const item of submitted) {
            const current = this.attachments.get(item.slot);
            if (current?.generation === item.generation && current.attachment.id.id === item.id) {
                this.attachments.delete(item.slot);
                this.outstanding.delete(current.token);
            }
        }
    }

    async close() {
        if (!this.closed) {
            this.closed = true;
            for (const slot of this.generations.keys()) this.invalidate(slot);
        }
        const tokens = [...this.outstanding.keys()];
        await this.disposeTokens(tokens);
        for (const [slot, current] of this.attachments) {
            if (!this.outstanding.has(current.token)) this.attachments.delete(slot);
        }
    }
}

export function replaceEngineById<T extends { id: string }>(
    engines: readonly T[],
    targetId: string,
    replacement: T,
): T[] {
    return engines.map((engine) =>
        engine.id === targetId ? { ...replacement, id: targetId } : engine,
    );
}
