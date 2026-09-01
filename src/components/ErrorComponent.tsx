import { Anchor, Button, Code, CopyButton, Group, Stack, Text, Title } from "@mantine/core";
import { useNavigate } from "@tanstack/react-router";
import { Trans, useTranslation } from "react-i18next";
import { normalizeError } from "@/platform/errors";

export default function ErrorComponent({ error }: { error: unknown }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const normalized = normalizeError(error);

  return (
    <Stack p="md">
      <Title>{t("Error.Title")}</Title>
      <Text>
        <b>{t("Error.Unexpected")}:</b> {normalized.message}
      </Text>
      {normalized.diagnostic && normalized.diagnostic !== normalized.message && (
        <Code>{normalized.diagnostic}</Code>
      )}
      <Group>
        {normalized.diagnostic && normalized.diagnostic !== normalized.message && (
          <CopyButton value={normalized.diagnostic}>
            {({ copied, copy }) => (
              <Button color={copied ? "teal" : undefined} onClick={copy}>
                {copied ? t("Common.Copied") : t("Error.CopyStackTrace")}
              </Button>
            )}
          </CopyButton>
        )}
        <Button onClick={() => navigate({ to: "/" }).then(() => window.location.reload())}>
          {t("Menu.View.Reload")}
        </Button>
      </Group>

      <Text>
        <Trans
          i18nKey="Error.ReportIssue"
          components={{
            github: (
              <Anchor
                href="https://github.com/franciscoBSalgueiro/en-croissant/issues/new?assignees=&labels=bug&projects=&template=bug.yml"
                target="_blank"
              />
            ),
            discord: <Anchor href="https://discord.com/invite/tdYzfDbSSW" target="_blank" />,
          }}
        />
      </Text>
    </Stack>
  );
}
