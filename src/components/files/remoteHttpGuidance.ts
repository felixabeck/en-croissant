import type { TFunction } from "i18next";
import type { RemoteHttpRejection } from "@/bindings";
import i18n from "@/i18n";

export function remoteHttpGuidance(
    { status, authorizationSent }: RemoteHttpRejection,
    t: TFunction = i18n.t,
): string {
    switch (status) {
        case 401:
            return authorizationSent
                ? t("Common.RemoteRequest.AuthorizationRejected", {
                      defaultValue:
                          "The service rejected this account's authorization. Reconnect the account, then try again.",
                  })
                : t("Common.RemoteRequest.Unauthorized", {
                      defaultValue: "The service rejected the request as unauthorized.",
                  });
        case 403:
            return t("Common.RemoteRequest.AccessDenied", {
                defaultValue: "The service denied access to this request.",
            });
        case 404:
            return t("Common.RemoteRequest.NotFound", {
                defaultValue: "The remote resource is not available.",
            });
        case 429:
            return t("Common.RemoteRequest.RateLimited", {
                defaultValue: "The service is limiting requests. Wait, then try again.",
            });
        default:
            return status >= 500 && status <= 599
                ? t("Common.RemoteRequest.ServerFailed", {
                      defaultValue: "The service failed temporarily. Try again later.",
                  })
                : t("Common.RemoteRequest.Rejected", {
                      defaultValue: "The service rejected the request.",
                  });
    }
}
