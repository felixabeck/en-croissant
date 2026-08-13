import { z } from "zod";

export class HttpError extends Error {
    constructor(
        readonly kind: "abort" | "timeout" | "network" | "status" | "schema",
        message: string,
        readonly status?: number,
    ) {
        super(message);
    }
}

type HttpOptions<T> = Omit<RequestInit, "signal"> & {
    schema: z.ZodType<T, z.ZodTypeDef, unknown>;
    signal?: AbortSignal;
    timeoutMs?: number;
};

export class AllowedOriginHttpClient {
    private readonly origins: Set<string>;

    constructor(origins: readonly string[]) {
        this.origins = new Set(origins);
    }

    async get<T>(path: string, options: HttpOptions<T>): Promise<T> {
        const url = new URL(path);
        if (!this.origins.has(url.origin))
            throw new HttpError("network", "Disallowed remote origin");
        const timeout = AbortSignal.timeout(options.timeoutMs ?? 15_000);
        const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
        let response: Response;
        try {
            response = await fetch(url, { ...options, signal });
        } catch {
            if (options.signal?.aborted) throw new HttpError("abort", "Request cancelled");
            if (timeout.aborted) throw new HttpError("timeout", "Request timed out");
            throw new HttpError("network", "Remote request failed");
        }
        if (!response.ok)
            throw new HttpError(
                "status",
                `Remote request failed (${response.status})`,
                response.status,
            );
        const parsed = options.schema.safeParse(await response.json());
        if (!parsed.success)
            throw new HttpError("schema", "Remote service returned an invalid response");
        return parsed.data;
    }
}

/** Fixed public origins used by unauthenticated renderer requests. */
export const remoteHttp = new AllowedOriginHttpClient([
    "https://www.encroissant.org",
    "https://api.chess.com",
    "https://www.chess.com",
    "https://lichess.org",
    "https://explorer.lichess.org",
    "https://tablebase.lichess.org",
    "https://www.chessdb.cn",
]);
