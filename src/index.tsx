import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { createRoot } from "react-dom/client";
import App from "./App";
import i18n, { initializeI18n } from "./i18n";
import { initializePersistedSessions, SessionSanitizationError } from "./utils/session";
import { setAutoFreeze } from "immer";
import { I18nextProvider } from "react-i18next";
import { StartupStorageFailure } from "./components/home/StartupStorageFailure";
import { logFailureSafely, safeFailureContext } from "./platform/errors";
import { tauri } from "./platform/tauri";
import { initializeWorkspace } from "./state/atoms";

initializeWorkspace();

dayjs.extend(customParseFormat);

setAutoFreeze(false);

const container = document.getElementById("app");
const root = createRoot(container!);

const WINDOW_REVEAL_FAILURE = "StartupWindowRevealError";

function logStartupDiagnostic(
  operation: string,
  diagnostic: string,
  fallbackLabel: string,
): Promise<void> {
  return logFailureSafely(
    diagnostic,
    { operation, primaryFailure: { category: "unexpected", message: diagnostic } },
    fallbackLabel,
  );
}

/** Do not mount feature routes until credential-bearing legacy storage has been scrubbed and
 * native account metadata has reconciled into public renderer sessions. */
export const applicationStartup = (async () => {
  try {
    await tauri.releasePreviousDocumentOperations();
  } catch (error) {
    const primaryFailure = safeFailureContext(error);
    await logFailureSafely(
      `StartupReservationReleaseError: ${primaryFailure.category}: ${primaryFailure.message}`,
      { operation: "releasePreviousDocumentOperations", primaryFailure },
      "Startup reservation release failed",
    );
  }

  let sanitizationFailure: SessionSanitizationError | undefined;
  try {
    await initializePersistedSessions();
  } catch (error) {
    if (error instanceof SessionSanitizationError) sanitizationFailure = error;
    // Other failures happen after storage has been synchronously sanitized. The application
    // remains usable while the next launch retries native reconciliation.
  }

  try {
    await initializeI18n();
  } catch {
    // Rendering remains available if a locale bundle cannot be loaded on this launch.
  }

  if (sanitizationFailure) {
    const { legacySignInFound, allRevoked } = sanitizationFailure;
    root.render(
      <I18nextProvider i18n={i18n}>
        <StartupStorageFailure legacySignInFound={legacySignInFound} allRevoked={allRevoked} />
      </I18nextProvider>,
    );
    try {
      await tauri.closeSplashscreen();
    } catch {
      await logStartupDiagnostic(
        "closeSplashscreen",
        WINDOW_REVEAL_FAILURE,
        "Startup window reveal failed",
      );
    }
    // Only the class and public summary may leave this credential-handling boundary.
    const diagnostic = `SessionSanitizationError: legacySignInFound=${legacySignInFound}, allRevoked=${allRevoked}`;
    await logStartupDiagnostic(
      "initializePersistedSessions",
      diagnostic,
      "Session sanitization failed",
    );
    return;
  }

  root.render(
    <I18nextProvider i18n={i18n}>
      <App />
    </I18nextProvider>,
  );
})();
