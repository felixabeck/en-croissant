import { Button, Container, MantineProvider, Stack, Text, Title } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { appCssVariablesResolver, createAppTheme } from "@/styles/theme";
import enUS from "@/translation/en-US.json";

// Match the preference defaults without hydrating feature state. App's root scaling is not mounted.
const DEFAULT_PRIMARY_COLOR = "blue";
const DEFAULT_SPELL_CHECK = false;
const DEFAULT_FONT_SIZE = 100;
const theme = createAppTheme({
  primaryColor: DEFAULT_PRIMARY_COLOR,
  spellCheck: DEFAULT_SPELL_CHECK,
  fontSize: DEFAULT_FONT_SIZE,
});

export function StartupStorageFailure({
  legacySignInFound,
  allRevoked,
}: {
  legacySignInFound: boolean;
  allRevoked: boolean;
}) {
  const { t } = useTranslation(undefined, { useSuspense: false });
  // Before i18n initializes, t() returns no value; keep the shipped fallback readable too.
  const explanation = !legacySignInFound
    ? t("Startup.StorageFailure.NoLegacySignIn", {}) ||
      enUS.translation["Startup.StorageFailure.NoLegacySignIn"]
    : allRevoked
      ? t("Startup.StorageFailure.Revoked", {}) ||
        enUS.translation["Startup.StorageFailure.Revoked"]
      : t("Startup.StorageFailure.NotRevoked", {}) ||
        enUS.translation["Startup.StorageFailure.NotRevoked"];

  return (
    <MantineProvider
      cssVariablesResolver={appCssVariablesResolver}
      defaultColorScheme="dark"
      theme={theme}
    >
      <Container size="sm" py="xl">
        <Stack align="flex-start" gap="md">
          <Title order={1}>
            {t("Startup.StorageFailure.Title", {}) ||
              enUS.translation["Startup.StorageFailure.Title"]}
          </Title>
          <Text>{explanation}</Text>
          <Button onClick={() => window.location.reload()}>
            {t("Startup.StorageFailure.TryAgain", {}) ||
              enUS.translation["Startup.StorageFailure.TryAgain"]}
          </Button>
        </Stack>
      </Container>
    </MantineProvider>
  );
}
