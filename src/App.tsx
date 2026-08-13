import { localStorageColorSchemeManager, MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { attachConsole, getMatches, getVersion, info, warn } from "@/platform/native";
import { getDefaultStore, useAtomValue } from "jotai";
import { ContextMenuProvider } from "mantine-contextmenu";
import { useEffect, useMemo, useRef } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import {
  fontSizeAtom,
  pieceSetAtom,
  primaryColorAtom,
  referenceDbAtom,
  spellCheckAtom,
  telemetryEnabledAtom,
} from "./state/atoms";

import "@/styles/chessgroundBaseOverride.css";
import "@/styles/chessgroundColorsOverride.css";

import "@mantine/charts/styles.css";
import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/tiptap/styles.css";

import "mantine-contextmenu/styles.css";
import "mantine-datatable/styles.css";

import "@/styles/global.css";

import { analytics } from "./platform/analytics";
import { tauri } from "./platform/tauri";

const colorSchemeManager = localStorageColorSchemeManager({
  key: "mantine-color-scheme",
});

import ErrorComponent from "@/components/ErrorComponent";
import { useConversionProgress } from "@/hooks/useConversionProgress";
import { checkForUpdates } from "@/platform/updater";
import { initUserAgent } from "@/utils/http";
import { routeTree } from "./routeTree.gen";
import { appCssVariablesResolver, createAppTheme } from "./styles/theme";
import i18n from "./i18n";

const router = createRouter({
  routeTree,
  defaultErrorComponent: ErrorComponent,
  context: {},
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const preloadReferenceDb = async (
  store: ReturnType<typeof getDefaultStore>,
  signal: AbortSignal,
) => {
  const referenceDb = store.get(referenceDbAtom);
  if (referenceDb && !signal.aborted) {
    info(`Preloading reference database: ${referenceDb}`);
    try {
      await tauri.preloadReferenceDb(referenceDb);
    } catch (e) {
      if (signal.aborted) return;
      info(`Failed to preload reference database: ${e}`);
    }
  }
};

function useAppStartup() {
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const controller = new AbortController();
    const { signal } = controller;
    const startupSequence = async () => {
      let detach: (() => void) | undefined;
      try {
        await initUserAgent();
        if (signal.aborted) return undefined;

        detach = await attachConsole();
        if (signal.aborted) {
          detach();
          return undefined;
        }
        info("React app started successfully");

        await checkForUpdates({
          signal,
          onError: (startupError) => warn(`Failed to check for updates: ${startupError.message}`),
        });
        if (signal.aborted) return detach;

        const store = getDefaultStore();
        const telemetryEnabled = store.get(telemetryEnabledAtom);

        if (telemetryEnabled) {
          analytics.enable();
          analytics.capture("app_started", { version: await getVersion() });
        }
        if (signal.aborted) return detach;
        try {
          const matches = await getMatches();
          if (matches.args.file.occurrences > 0) {
            info(`Opening file from command line: ${matches.args.file.value}`);
            // CLI paths are intentionally not forwarded into the renderer. Use the native
            // capability picker so the backend can issue an opaque handle instead.
          }
        } catch (e) {
          warn(`Failed to parse CLI args: ${e}`);
        }

        await preloadReferenceDb(store, signal);
        return detach;
      } finally {
        if (!signal.aborted) await tauri.closeSplashscreen();
      }
    };

    let detachFn: (() => void) | undefined;
    void startupSequence()
      .then((fn) => {
        detachFn = fn;
      })
      .catch((startupError) => warn(`Application startup failed: ${String(startupError)}`));

    return () => {
      controller.abort();
      if (detachFn) detachFn();
    };
  }, []);
}

function useDocumentLanguage() {
  useEffect(() => {
    const updateLanguage = (language: string) => {
      document.documentElement.lang = language;
    };
    updateLanguage(i18n.resolvedLanguage || i18n.language || "en-US");
    i18n.on("languageChanged", updateLanguage);
    return () => i18n.off("languageChanged", updateLanguage);
  }, []);
}

export default function App() {
  const primaryColor = useAtomValue(primaryColorAtom);
  const pieceSet = useAtomValue(pieceSetAtom);
  const fontSize = useAtomValue(fontSizeAtom);
  const spellCheck = useAtomValue(spellCheckAtom);

  useAppStartup();
  useDocumentLanguage();
  useConversionProgress();

  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}%`;
  }, [fontSize]);

  const theme = useMemo(
    () => createAppTheme({ primaryColor, spellCheck }),
    [primaryColor, spellCheck],
  );

  return (
    <DndProvider backend={HTML5Backend}>
      <link rel="stylesheet" href={`/pieces/${pieceSet}.css`} />

      <MantineProvider
        colorSchemeManager={colorSchemeManager}
        cssVariablesResolver={appCssVariablesResolver}
        defaultColorScheme="dark"
        theme={theme}
      >
        <ContextMenuProvider>
          <Notifications />
          <RouterProvider router={router} />
        </ContextMenuProvider>
      </MantineProvider>
    </DndProvider>
  );
}
