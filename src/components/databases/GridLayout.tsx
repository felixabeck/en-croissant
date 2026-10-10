import { Box, Group } from "@mantine/core";
import type { ReactNode } from "react";
import classes from "./GridLayout.module.css";

// At this font-scaled width, the database panes and preview controls need to stack together.
export const COMPACT_DATABASE_WIDTH_EM = 36;

function GridLayout({
  search,
  table,
  preview,
}: {
  search: ReactNode;
  table: ReactNode;
  preview: ReactNode;
}) {
  return (
    <Group grow className={classes.layout}>
      <Box className={classes.pane}>
        <Box className={classes.search}>{search}</Box>
        <Box className={classes.table}>{table}</Box>
      </Box>

      <Box className={classes.pane}>{preview}</Box>
    </Group>
  );
}

export default GridLayout;
