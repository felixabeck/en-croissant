import { Button, Center, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { IconUserPlus } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

export function EmptyAccounts({ onAddAccount }: { onAddAccount: () => void }) {
  const { t } = useTranslation();

  // Grows with its content rather than holding the column's height: content taller than the column
  // then scrolls with the page, where a fixed height would centre it and push its top out of reach.
  return (
    <Center style={{ flex: "1 0 auto" }} maw="100%" miw={0}>
      <Stack align="center" gap="md" maw="100%" miw={0}>
        <ThemeIcon size={80} radius="100%" variant="light" color="blue">
          <IconUserPlus size={40} />
        </ThemeIcon>
        <Title order={3} ta="center" className="wrap-anywhere">
          {t("Home.Accounts.Empty.Title")}
        </Title>
        <Text c="dimmed" ta="center" maw={400}>
          {t("Home.Accounts.Empty.Description")}
        </Text>
        <Button onClick={onAddAccount} size="md" mt="sm" maw="100%" className="wrap-button">
          {t("Home.Accounts.Add")}
        </Button>
      </Stack>
    </Center>
  );
}
