import { Box, Group } from "@mantine/core";
import { IconArrowLeft, IconArrowRight } from "@tabler/icons-react";
import { useAtomValue, useSetAtom } from "jotai";
import { useContext, useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Mosaic, type MosaicNode } from "react-mosaic-component";
import { IconAction } from "@/components/common/IconAction";
import {
  clampDatabasePercentage,
  databaseSplitAtoms,
  DATABASE_SPLIT_STEP_PERCENT,
  DatabaseLayoutContext,
} from "@/state/databaseLayout";
import "react-mosaic-component/react-mosaic-component.css";
import "@/styles/react-mosaic.css";
import classes from "./GridLayout.module.css";

type Tile = "table" | "preview";

function GridLayout({
  search,
  table,
  preview,
}: {
  search: ReactNode;
  table: ReactNode;
  preview: ReactNode;
}) {
  const { t } = useTranslation();
  const { compact, minimum } = useContext(DatabaseLayoutContext);
  const ratio = useAtomValue(databaseSplitAtoms.displayed);
  const setTransient = useSetAtom(databaseSplitAtoms.transient);
  const commit = useSetAtom(databaseSplitAtoms.commit);
  const effective = clampDatabasePercentage(ratio, minimum);
  // Reflow interrupts a gesture. It never commits the unfinished pointer movement.
  useEffect(() => {
    if (compact) setTransient(null);
  }, [compact, setTransient]);
  useEffect(() => () => setTransient(null), [setTransient]);
  const update = (node: MosaicNode<Tile> | null, released: boolean) => {
    if (!node || typeof node === "string" || compact) return;
    const requested = node.splitPercentage ?? 50;
    if (!Number.isFinite(requested)) return;
    const percentage = clampDatabasePercentage(requested, minimum);
    if (released) commit(percentage);
    else setTransient(percentage);
  };
  return (
    <Box
      className={classes.layout}
      data-database-layout
      data-compact={compact || undefined}
      data-percentage={effective}
    >
      {!compact && (
        <Group justify="end" gap="xs" className={classes.splitControls}>
          <IconAction
            label={t("Databases.Layout.EnlargeTable", { defaultValue: "Enlarge table" })}
            variant="default"
            disabled={effective >= 100 - minimum}
            onClick={() =>
              commit(clampDatabasePercentage(effective + DATABASE_SPLIT_STEP_PERCENT, minimum))
            }
          >
            <IconArrowRight size="1rem" />
          </IconAction>
          <IconAction
            label={t("Databases.Layout.EnlargePreview", { defaultValue: "Enlarge preview" })}
            variant="default"
            disabled={effective <= minimum}
            onClick={() =>
              commit(clampDatabasePercentage(effective - DATABASE_SPLIT_STEP_PERCENT, minimum))
            }
          >
            <IconArrowLeft size="1rem" />
          </IconAction>
        </Group>
      )}
      <Box className={classes.mosaicFrame}>
        <Mosaic<Tile>
          value={{
            direction: "row",
            first: "table",
            second: "preview",
            splitPercentage: effective,
          }}
          resize={compact ? "DISABLED" : { minimumPaneSizePercentage: minimum }}
          onChange={(node) => update(node, false)}
          onRelease={(node) => update(node, true)}
          renderTile={(id) => (
            <Box className={classes.pane} data-database-pane={id}>
              {id === "table" ? (
                <>
                  <Box className={classes.search}>{search}</Box>
                  <Box className={classes.table}>{table}</Box>
                </>
              ) : (
                <Box className={classes.previewContent}>{preview}</Box>
              )}
            </Box>
          )}
        />
      </Box>
    </Box>
  );
}

export default GridLayout;
