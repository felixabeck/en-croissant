import { Accordion, Badge, Group, Paper, SimpleGrid, Stack, Text } from "@mantine/core";
import { parseUci } from "chessops";
import { useContext } from "react";
import { useTranslation } from "react-i18next";
import useSWRImmutable from "swr/immutable";
import { match, P } from "ts-pattern";
import { useStore } from "zustand";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import { getTablebaseInfo, type TablebaseCategory } from "@/utils/lichess/api";
import classes from "./TablebaseInfo.module.css";

function TablebaseInfo({ fen, turn }: { fen: string; turn: "white" | "black" }) {
  const { t } = useTranslation();
  const store = useContext(TreeStateContext)!;
  const makeMove = useStore(store, (s) => s.makeMove);
  const { data, error, isLoading } = useSWRImmutable(
    ["tablebase", fen],
    async ([_, fen]) => await getTablebaseInfo(fen),
  );

  // SWR owns `data`; sorting it in place changes the cache seen by every view.
  const sortedMoves = data ? [...data.moves].sort(compareTablebaseMoves) : undefined;

  return (
    <Paper withBorder>
      <Accordion
        styles={{
          label: {
            padding: 8,
          },
        }}
      >
        <Accordion.Item value="tablebase">
          <Accordion.Control>
            <Group>
              <Text fw="bold">{t("Board.Analysis.Tablebase")}</Text>
              {isLoading && (
                <Group p="xs">
                  <Badge variant="transparent">{t("Common.Loading")}</Badge>
                </Group>
              )}
              {error && (
                <Text>
                  {t("Common.Error")}: {error}
                </Text>
              )}
              {data && <OutcomeBadge category={data.category} turn={turn} wins />}
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            {data && (
              <Stack gap="xs">
                <SimpleGrid cols={3}>
                  {sortedMoves!.map((m) => (
                    <Paper
                      withBorder
                      key={m.san}
                      px="xs"
                      onClick={() => {
                        makeMove({ payload: parseUci(m.uci)! });
                      }}
                      className={classes.info}
                    >
                      <Group gap="xs" justify="space-between" wrap="nowrap">
                        <Text fz="0.9rem" fw={600} ta="center">
                          {m.san}
                        </Text>
                        <OutcomeBadge
                          category={m.category}
                          dtz={Math.abs(m.dtz)}
                          dtm={m.dtm}
                          turn={turn === "white" ? "black" : "white"}
                        />
                      </Group>
                    </Paper>
                  ))}
                </SimpleGrid>
              </Stack>
            )}
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Paper>
  );
}

const tablebaseRank: Record<TablebaseCategory, number> = {
  win: 0,
  "cursed-win": 1,
  draw: 2,
  "blessed-loss": 3,
  loss: 4,
  "maybe-win": 5,
  "maybe-loss": 6,
  unknown: 7,
};

export function compareTablebaseMoves(
  a: { category: TablebaseCategory; san: string },
  b: { category: TablebaseCategory; san: string },
) {
  return tablebaseRank[a.category] - tablebaseRank[b.category] || a.san.localeCompare(b.san);
}

function OutcomeBadge({
  category,
  turn,
  wins,
  dtz,
  dtm,
}: {
  category: TablebaseCategory;
  turn: "white" | "black";
  wins?: boolean;
  dtz?: number;
  dtm?: number;
}) {
  const { t } = useTranslation();
  const normalizedCategory = match(category)
    .with("win", () =>
      turn === "white"
        ? t("Board.Analysis.Tablebase.WhiteWins")
        : t("Board.Analysis.Tablebase.BlackWins"),
    )
    .with("loss", () =>
      turn === "white"
        ? t("Board.Analysis.Tablebase.BlackWins")
        : t("Board.Analysis.Tablebase.WhiteWins"),
    )
    .with(P.union("draw", "blessed-loss", "cursed-win"), () => t("Board.Analysis.Tablebase.Draw"))
    .with(P.union("unknown", "maybe-win", "maybe-loss"), () => t("Common.Unknown"))
    .exhaustive();

  const color = match(category)
    .with("win", () => (turn === "white" ? "white" : "black"))
    .with("loss", () => (turn === "white" ? "black" : "white"))
    .otherwise(() => "gray");

  const label = wins
    ? normalizedCategory
    : match(category)
        .with("draw", () => t("Board.Analysis.Tablebase.Draw"))
        .with("unknown", () => t("Common.Unknown"))
        .otherwise(() => (dtm ? `DTM ${Math.abs(dtm)}` : `DTZ ${dtz}`));

  return (
    <Group p="xs">
      <Badge autoContrast color={color}>
        {label}
      </Badge>
      {["blessed-loss", "cursed-win", "maybe-win", "maybe-loss"].includes(category) && wins && (
        <Text c="dimmed" fz="xs">
          {t("Board.Analysis.Tablebase.FiftyMoveRule")}
        </Text>
      )}
    </Group>
  );
}

export default TablebaseInfo;
