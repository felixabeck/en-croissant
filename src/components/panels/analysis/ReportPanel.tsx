import { tauri } from "@/platform/tauri";
import { Grid, Group, Paper, ScrollArea, Stack, Text } from "@mantine/core";
import { IconZoomCheck } from "@tabler/icons-react";
import cx from "clsx";
import equal from "fast-deep-equal";
import { useAtom, useAtomValue } from "jotai";
import React, { memo, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import EvalChart from "@/components/common/EvalChart";
import ProgressButton from "@/components/common/ProgressButton";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import { useProgress } from "@/hooks/useProgress";
import { activeTabAtom, currentReportModalOpenAtom } from "@/state/atoms";
import { ANNOTATION_INFO, isBasicAnnotation } from "@/utils/annotation";
import { getGameStats, getMainLine } from "@/utils/chess";
import classes from "./AnalysisPanel.module.css";
import ReportModal from "./ReportModal";

function ReportPanel() {
  const { t } = useTranslation();

  const activeTab = useAtomValue(activeTabAtom);

  const store = useContext(TreeStateContext)!;
  const root = useStore(store, (s) => s.root);
  const [reportingMode, setReportingMode] = useAtom(currentReportModalOpenAtom);

  const inProgress = useStore(store, (s) => s.report.inProgress);
  const operationId = useStore(store, (s) => s.report.operationId);
  const setInProgress = useStore(store, (s) => s.setReportInProgress);
  const setReportOperationId = useStore(store, (s) => s.setReportOperationId);
  const rootFingerprint = `${root.fen}\u0000${getMainLine(root).join("\u0000")}`;
  const rootFingerprintRef = useRef(rootFingerprint);
  rootFingerprintRef.current = rootFingerprint;

  // Inert placeholder that never matches an emitted event; useProgress requires a string.
  const IDLE_REPORT_PROGRESS_ID = `report_${activeTab}`;
  const progressId = operationId ?? IDLE_REPORT_PROGRESS_ID;
  const { finished } = useProgress(progressId);

  useEffect(() => {
    if (finished) {
      setInProgress(false);
    }
  }, [finished, setInProgress]);

  useEffect(() => {
    if (!inProgress) return;

    if (!operationId) {
      setInProgress(false);
      return;
    }

    let active = true;
    const queriedId = operationId;
    tauri
      .getProgress(queriedId)
      .then((item) => {
        if (!active) return;
        if (store.getState().report.operationId !== queriedId) return;
        if (item?.finished) {
          setInProgress(false);
          setReportOperationId(null);
        }
      })
      .catch(() => {
        // A lookup failure is not a finished job; leave in-flight state alone.
      });

    return () => {
      active = false;
    };
  }, [inProgress, operationId, setInProgress, setReportOperationId, store]);

  const stats = useMemo(() => getGameStats(root), [root]);

  const handleCancel = useCallback(() => {
    const id = store.getState().report.operationId;
    // Invalidate first: native cancellation is asynchronous and may still
    // resolve successfully after the user switches tabs.
    setReportOperationId(null);
    setInProgress(false);
    if (id) void tauri.cancelAnalysis(id);
  }, [setInProgress, setReportOperationId, store]);

  const isCurrentOperation = useCallback(
    (id: string, fingerprint: string) =>
      store.getState().report.operationId === id && rootFingerprintRef.current === fingerprint,
    [store],
  );

  const openReportingMode = useCallback(() => {
    setReportingMode(true);
  }, [setReportingMode]);

  const closeReportingMode = useCallback(() => {
    setReportingMode(false);
  }, [setReportingMode]);

  return (
    <ScrollArea offsetScrollbars>
      <ReportModal
        tab={activeTab!}
        initialFen={root.fen}
        moves={getMainLine(root)}
        reportingMode={reportingMode}
        closeReportingMode={closeReportingMode}
        setInProgress={setInProgress}
        registerOperation={setReportOperationId}
        isCurrentOperation={isCurrentOperation}
      />
      <Stack mb="lg" gap="0.4rem" mr="xs">
        <ProgressButton
          id={progressId}
          redoable
          disabled={root.children.length === 0}
          leftIcon={<IconZoomCheck size="0.875rem" />}
          onClick={openReportingMode}
          onCancel={handleCancel}
          initInstalled={false}
          completeOnProgressSuccess={false}
          labels={{
            action: t("Board.Analysis.GenerateReport"),
            completed: t("Board.Analysis.ReportGenerated"),
            inProgress: t("Board.Analysis.GeneratingReport"),
          }}
          inProgress={inProgress}
          setInProgress={setInProgress}
        />

        {stats.whiteAccuracy > 0 && stats.blackAccuracy > 0 && (
          <Group grow>
            <AccuracyCard
              color={t("Common.WHITE")}
              accuracy={stats.whiteAccuracy}
              cpl={stats.whiteCPL}
            />
            <AccuracyCard
              color={t("Common.BLACK")}
              accuracy={stats.blackAccuracy}
              cpl={stats.blackCPL}
            />
          </Group>
        )}

        <Paper withBorder p="md">
          <EvalChart isAnalysing={inProgress} startAnalysis={openReportingMode} />
        </Paper>

        <GameStats {...stats} />
      </Stack>
    </ScrollArea>
  );
}

type Stats = ReturnType<typeof getGameStats>;

const GameStats = memo(
  function GameStats({ whiteAnnotations, blackAnnotations }: Stats) {
    const { t } = useTranslation();

    const store = useContext(TreeStateContext)!;
    const goToAnnotation = useStore(store, (s) => s.goToAnnotation);

    return (
      <Paper withBorder>
        <Grid columns={12} align="center" p="md">
          {Object.keys(ANNOTATION_INFO)
            .filter((a) => isBasicAnnotation(a))
            .map((annotation) => {
              const s = annotation as "??" | "?" | "?!" | "!!" | "!" | "!?";
              const { name, color, translationKey } = ANNOTATION_INFO[s];
              const w = whiteAnnotations[s];
              const b = blackAnnotations[s];
              return (
                <React.Fragment key={annotation}>
                  <Grid.Col
                    className={cx(w > 0 && classes.label)}
                    span={3}
                    style={{ textAlign: "center" }}
                    c={w > 0 ? color : undefined}
                    onClick={() => {
                      if (w > 0) {
                        goToAnnotation(s, "white");
                      }
                    }}
                  >
                    {w}
                  </Grid.Col>
                  <Grid.Col
                    span={2}
                    style={{ textAlign: "center", fontWeight: "bold" }}
                    c={w + b > 0 ? color : undefined}
                  >
                    {annotation}
                  </Grid.Col>
                  <Grid.Col span={4} c={w + b > 0 ? color : undefined}>
                    {translationKey ? t(`Annotate.${translationKey}`) : name}
                  </Grid.Col>
                  <Grid.Col
                    className={cx(b > 0 && classes.label)}
                    span={3}
                    style={{ textAlign: "center" }}
                    c={b > 0 ? color : undefined}
                    onClick={() => {
                      if (b > 0) {
                        goToAnnotation(s, "black");
                      }
                    }}
                  >
                    {b}
                  </Grid.Col>
                </React.Fragment>
              );
            })}
        </Grid>
      </Paper>
    );
  },
  (prev, next) => {
    return (
      equal(prev.whiteAnnotations, next.whiteAnnotations) &&
      equal(prev.blackAnnotations, next.blackAnnotations)
    );
  },
);

function AccuracyCard({ color, cpl, accuracy }: { color: string; cpl: number; accuracy: number }) {
  const { t } = useTranslation();

  return (
    <Paper withBorder p="xs">
      <Group justify="space-between">
        <Stack gap={0} align="start">
          <Text c="dimmed">{color}</Text>
          <Text fz="sm">{cpl.toFixed(1)} ACPL</Text>
        </Stack>
        <Stack gap={0} align="center">
          <Text fz="xl" lh="normal">
            {accuracy.toFixed(1)}%
          </Text>
          <Text fz="sm" c="dimmed" lh="normal">
            {t("Board.Analysis.Accuracy")}
          </Text>
        </Stack>
      </Group>
    </Paper>
  );
}
export default ReportPanel;
