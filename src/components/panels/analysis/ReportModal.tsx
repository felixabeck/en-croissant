import { Button, Checkbox, Group, NumberInput, Select, Stack } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useAtom, useAtomValue } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { memo, useContext, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import type { GoMode } from "@/bindings";
import { tauri } from "@/platform/tauri";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import AppModal from "../../common/AppModal";
import { enginesAtom, referenceDbAtom } from "@/state/atoms";
import { createZodStorage } from "@/state/utils";
import { captureReportOwner, isReportOwnerCurrent, waitForReportOwner } from "@/state/store/tree";
import { goModeSchema, type LocalEngine } from "@/utils/engines";
import { normalizeEngineOptions } from "@/utils/engineOptions";
import { z } from "zod";
import { notifyUnlessCancelled } from "@/components/files/notifyError";

type ReportGoMode = Extract<GoMode, { t: "Depth" | "Time" | "Nodes" }>;

const reportGoModeSchema = goModeSchema.superRefine((mode, context): mode is ReportGoMode => {
  if (mode.t === "Infinite" || mode.t === "PlayersTime") {
    context.addIssue({ code: z.ZodIssueCode.custom });
    return false;
  }
  if (!Number.isFinite(mode.c)) {
    context.addIssue({ code: z.ZodIssueCode.custom });
    return false;
  }
  return true;
});

type ReportSettings = {
  novelty: boolean;
  reversed: boolean;
  variations: boolean;
  goMode: ReportGoMode;
  engine: string;
};

const defaultReportSettings: ReportSettings = {
  novelty: true,
  reversed: true,
  variations: true,
  goMode: { t: "Time", c: 500 },
  engine: "",
};

const reportSettingsSchema: z.ZodType<ReportSettings, z.ZodTypeDef, unknown> = z.object({
  novelty: z.boolean().catch(defaultReportSettings.novelty),
  reversed: z.boolean().catch(defaultReportSettings.reversed),
  variations: z.boolean().catch(defaultReportSettings.variations),
  goMode: reportGoModeSchema.catch(defaultReportSettings.goMode),
  engine: z.string().catch(defaultReportSettings.engine),
});

const reportSettingsAtom = atomWithStorage(
  "report-settings",
  defaultReportSettings,
  createZodStorage(reportSettingsSchema, localStorage),
);

function ReportModal({
  tab,
  initialFen,
  moves,
  reportingMode,
  closeReportingMode,
  setInProgress,
  registerOperation,
  isCurrentOperation,
}: {
  tab: string;
  initialFen: string;
  moves: string[];
  reportingMode: boolean;
  closeReportingMode: () => void;
  setInProgress: (value: boolean) => void;
  registerOperation: (id: string) => void;
  isCurrentOperation: (id: string, fingerprint: string) => boolean;
}) {
  const { t } = useTranslation();

  const referenceDb = useAtomValue(referenceDbAtom);
  const engines = useAtomValue(enginesAtom);
  const localEngines = useMemo(
    () => (engines ?? []).filter((e): e is LocalEngine => e.type === "local"),
    [engines],
  );
  const store = useContext(TreeStateContext)!;
  const addAnalysis = useStore(store, (s) => s.addAnalysis);
  const prepareGeneration = useRef(0);
  const pendingPreparation = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      prepareGeneration.current += 1;
      pendingPreparation.current?.abort();
    },
    [],
  );

  const [reportSettings, setReportSettings] = useAtom(reportSettingsAtom);
  const form = useForm({
    initialValues: reportSettings,
    validate: {
      engine: (value) => {
        if (!value) return t("Board.Analysis.EngineRequired");
      },
      novelty: (value) => {
        if (value && !referenceDb) return t("Board.Analysis.RefDBRequired");
      },
    },
  });

  useEffect(() => {
    const engine =
      localEngines.length === 0
        ? ""
        : !reportSettings.engine || !localEngines.some((l) => l.id === reportSettings.engine)
          ? localEngines[0].id
          : reportSettings.engine;

    form.setValues({ ...reportSettings, engine });
  }, [form, localEngines, reportSettings]);

  async function analyze() {
    pendingPreparation.current?.abort();
    const preparation = new AbortController();
    pendingPreparation.current = preparation;
    const generation = ++prepareGeneration.current;
    const ownerEpoch = captureReportOwner(tab);
    setReportSettings(form.values);
    const rootFingerprint = `${initialFen}\u0000${moves.join("\u0000")}`;
    const variations = form.values.variations;
    const engine = localEngines.find((e) => e.id === form.values.engine);
    if (!engine) return;
    let operationId: string;
    try {
      operationId = await tauri.prepareAnalysis(tab, { signal: preparation.signal });
    } catch (error) {
      notifyUnlessCancelled(t("Common.Error"), error);
      return;
    } finally {
      if (pendingPreparation.current === preparation) pendingPreparation.current = null;
    }
    if (generation !== prepareGeneration.current || !isReportOwnerCurrent(tab, ownerEpoch)) {
      try {
        await tauri.cancelAnalysis(operationId);
      } catch (error) {
        notifyUnlessCancelled(t("Common.Error"), error);
      }
      return;
    }
    registerOperation(operationId);
    setInProgress(true);
    closeReportingMode();
    const engineSettings = normalizeEngineOptions(engine?.settings ?? []);

    tauri
      .analyzeGame(
        operationId,
        tab,
        engine.handle,
        engine.id,
        form.values.goMode,
        {
          annotateNovelties: form.values.novelty,
          fen: initialFen,
          referenceDb,
          reversed: form.values.reversed,
          moves,
        },
        engineSettings,
      )
      .then(async (analysis) => {
        // The immutable root fingerprint prevents a late completion from
        // applying to an edited/switched game even when a tab id is reused.
        if (
          (await waitForReportOwner(tab, ownerEpoch)) &&
          isReportOwnerCurrent(tab, ownerEpoch) &&
          isCurrentOperation(operationId, rootFingerprint)
        ) {
          addAnalysis(analysis, {
            showVariations: variations,
          });
        }
      })
      .catch(async (error) => {
        if ((await waitForReportOwner(tab, ownerEpoch)) && isReportOwnerCurrent(tab, ownerEpoch)) {
          notifyUnlessCancelled(t("Common.Error"), error);
        }
      })
      .finally(async () => {
        if (
          (await waitForReportOwner(tab, ownerEpoch)) &&
          isReportOwnerCurrent(tab, ownerEpoch) &&
          isCurrentOperation(operationId, rootFingerprint)
        )
          setInProgress(false);
      });
  }

  return (
    <AppModal
      opened={reportingMode}
      onClose={closeReportingMode}
      title={t("Board.Analysis.GenerateReport")}
    >
      <form onSubmit={form.onSubmit(() => analyze())}>
        <Stack>
          <Select
            allowDeselect={false}
            withAsterisk
            label={t("Common.Engine")}
            placeholder={t("Common.PickValue")}
            data={
              localEngines.map((engine) => {
                return {
                  value: engine.id,
                  label: engine.name,
                };
              }) ?? []
            }
            {...form.getInputProps("engine")}
          />
          <Group wrap="nowrap">
            <Select
              allowDeselect={false}
              comboboxProps={{
                position: "bottom",
                middlewares: { flip: false, shift: false },
              }}
              data={[
                { label: t("GoMode.Depth"), value: "Depth" },
                { label: t("Board.Analysis.Time"), value: "Time" },
                { label: t("GoMode.Nodes"), value: "Nodes" },
              ]}
              value={form.values.goMode.t}
              onChange={(v) => {
                const newGo = form.values.goMode;
                newGo.t = v as "Depth" | "Time" | "Nodes";
                form.setFieldValue("goMode", newGo);
              }}
            />
            <NumberInput
              min={1}
              value={form.values.goMode.c as number}
              onChange={(v) =>
                form.setFieldValue("goMode", {
                  ...(form.values.goMode as any),
                  c: (v || 1) as number,
                })
              }
            />
          </Group>

          <Checkbox
            label={t("Board.Analysis.Reversed")}
            description={t("Board.Analysis.Reversed.Desc")}
            {...form.getInputProps("reversed", { type: "checkbox" })}
          />

          <Checkbox
            label={t("Board.Analysis.AnnotateNovelties")}
            description={t("Board.Analysis.AnnotateNovelties.Desc")}
            {...form.getInputProps("novelty", { type: "checkbox" })}
          />

          <Checkbox
            label={t("Board.Analysis.ShowVariations")}
            description={t("Board.Analysis.ShowVariations.Desc")}
            {...form.getInputProps("variations", { type: "checkbox" })}
          />

          <Group justify="right">
            <Button type="submit">{t("Board.Analysis.Analyze")}</Button>
          </Group>
        </Stack>
      </form>
    </AppModal>
  );
}

export default memo(ReportModal);
