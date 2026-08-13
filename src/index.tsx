import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { createRoot } from "react-dom/client";
import App from "./App";
import i18n, { initializeI18n } from "./i18n";
import { initializePersistedSessions, SessionSanitizationError } from "./utils/session";
import { setAutoFreeze } from "immer";
import { I18nextProvider } from "react-i18next";

dayjs.extend(customParseFormat);

setAutoFreeze(false);

const container = document.getElementById("app");
const root = createRoot(container!);

/** Do not mount feature routes until credential-bearing legacy storage has been scrubbed and
 * native account metadata has reconciled into public renderer sessions. */
export const applicationStartup = (async () => {
  try {
    await initializePersistedSessions();
  } catch (error) {
    if (error instanceof SessionSanitizationError) throw error;
    // Session bootstrap is defensive; storage has already been synchronously sanitized. The
    // application remains usable while the next launch retries native reconciliation.
  }

  try {
    await initializeI18n();
  } catch {
    // Rendering remains available if a locale bundle cannot be loaded on this launch.
  }

  root.render(
    <I18nextProvider i18n={i18n}>
      <App />
    </I18nextProvider>,
  );
})();
