import { expect, test } from "vitest";
import { catalogueI18n } from "@/tests/catalogues";
import { remoteHttpGuidance } from "./remoteHttpGuidance";

test.each(["en-US", "de-DE"] as const)(
    "maps status boundaries using the %s catalogue",
    async (locale) => {
        const catalogue = await catalogueI18n(locale);
        const cases = [
            {
                status: 401,
                authorizationSent: true,
                key: "Common.RemoteRequest.AuthorizationRejected",
            },
            { status: 401, authorizationSent: false, key: "Common.RemoteRequest.Unauthorized" },
            { status: 403, authorizationSent: true, key: "Common.RemoteRequest.AccessDenied" },
            { status: 404, authorizationSent: false, key: "Common.RemoteRequest.NotFound" },
            { status: 429, authorizationSent: false, key: "Common.RemoteRequest.RateLimited" },
            { status: 500, authorizationSent: false, key: "Common.RemoteRequest.ServerFailed" },
            { status: 599, authorizationSent: true, key: "Common.RemoteRequest.ServerFailed" },
            { status: 400, authorizationSent: false, key: "Common.RemoteRequest.Rejected" },
            { status: 499, authorizationSent: true, key: "Common.RemoteRequest.Rejected" },
            { status: 600, authorizationSent: true, key: "Common.RemoteRequest.Rejected" },
        ];
        for (const { status, authorizationSent, key } of cases) {
            const message = remoteHttpGuidance({ status, authorizationSent }, catalogue.t);
            expect(message).toBe(catalogue.t(key));
            expect(message).not.toBe(key);
        }
    },
);
