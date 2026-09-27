import { Box, Group, Stack } from "@mantine/core";
import { useAtomValue } from "jotai";
import { sessionsAtom } from "@/state/atoms";
import Accounts from "./Accounts";
import Databases from "./Databases";

function AccountsPage() {
  const sessions = useAtomValue(sessionsAtom);

  return (
    <Group wrap="wrap" px="lg" pb="lg" h="100%" style={{ overflowY: "auto" }}>
      <Stack h="100%" style={{ flex: "1 1 15rem", minWidth: 0 }}>
        <Accounts />
      </Stack>

      {sessions.length > 0 && (
        <Box h="100%" pt="md" style={{ flex: "1 1 15rem", minWidth: 0, overflow: "hidden" }}>
          <Databases />
        </Box>
      )}
    </Group>
  );
}

export default AccountsPage;
