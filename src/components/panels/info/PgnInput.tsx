import { useOwnerTabId, useTabAtom } from "@/state/tabScope";
import {
  Box,
  Button,
  Checkbox,
  CopyButton,
  Group,
  rem,
  Stack,
  Text,
  Textarea,
} from "@mantine/core";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import deepEqual from "fast-deep-equal";
import { useAtom } from "jotai";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import { IconAction } from "@/components/common/IconAction";
import { closingTabsAtom, pgnOptionsFamily, tabsAtom } from "@/state/atoms";
import { getCachedTreeStore, type TreeStore } from "@/state/store/tree";
import { notifyUnlessCancelled } from "@/components/files/notifyError";
import { getPGN, parsePGN } from "@/utils/chess";
import { sameTabOwner, useTabActions } from "@/utils/tabs";

// Accepted edits belong to the cached document across panel remounts. One pending edit per
// store is retired by newer intent or document changes, and releases every subscription.
const pendingPgnEdits = new WeakMap<TreeStore, { retire: () => void }>();

function PgnInput() {
  const store = useContext(TreeStateContext)!;
  const tabId = useOwnerTabId();
  const { workspace, getTab } = useTabActions();
  const mounted = useRef(false);
  const root = useStore(store, (s) => s.root);
  const headers = useStore(store, (s) => s.headers);
  const setState = useStore(store, (s) => s.setState);
  const [options, setOptions] = useAtom(useTabAtom(pgnOptionsFamily));
  const { t } = useTranslation();

  const realPGN = useMemo(
    () =>
      getPGN(root, {
        headers: headers,
        glyphs: true,
        comments: true,
        variations: true,
        extraMarkups: true,
      }),
    [root, headers],
  );

  const pgn = useMemo(
    () =>
      getPGN(root, {
        headers: headers,
        glyphs: options.glyphs,
        comments: options.comments,
        variations: options.variations,
        extraMarkups: options.extraMarkups,
      }),
    [root, headers, options],
  );

  const [tmp, setTmp] = useState(pgn);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    setTmp(pgn);
  }, [pgn]);

  const controls = (
    <>
      <Text component="label" htmlFor="pgn-editor" fw="bold">
        {t("PgnInput.Editor", { defaultValue: "PGN editor" })}
      </Text>
      <Group my="sm">
        <Checkbox
          label={t("PgnInput.Comments")}
          size="xs"
          checked={options.comments}
          onChange={() => setOptions({ ...options, comments: !options.comments })}
        />
        <Checkbox
          label={t("PgnInput.Glyphs")}
          size="xs"
          checked={options.glyphs}
          onChange={() => setOptions({ ...options, glyphs: !options.glyphs })}
        />
        <Checkbox
          label={t("PgnInput.Variations")}
          size="xs"
          checked={options.variations}
          onChange={() => setOptions({ ...options, variations: !options.variations })}
        />
        <Checkbox
          label={t("PgnInput.ExtraMarkups")}
          size="xs"
          checked={options.extraMarkups}
          onChange={() => setOptions({ ...options, extraMarkups: !options.extraMarkups })}
        />
      </Group>
    </>
  );

  async function updatePgn() {
    const owner = getTab(tabId);
    if (!owner || getCachedTreeStore(tabId) !== store || workspace.get(closingTabsAtom).has(tabId))
      return;
    pendingPgnEdits.get(store)?.retire();
    const captured = store.getState();
    const source = {
      linkedSource: captured.linkedSource,
      sourceStamp: captured.sourceStamp,
      appendAttempted: captured.appendAttempted,
    };
    const controller = new AbortController();
    const subscriptions: Array<() => void> = [];
    const operation = {
      retire: () => {
        if (pendingPgnEdits.get(store) === operation) pendingPgnEdits.delete(store);
        for (const stop of subscriptions.splice(0)) stop();
        controller.abort();
      },
    };
    const isCurrent = () => {
      const current = getTab(tabId);
      const live = store.getState();
      return (
        pendingPgnEdits.get(store) === operation &&
        !controller.signal.aborted &&
        sameTabOwner(current, owner) &&
        deepEqual(current.gameOrigin, owner.gameOrigin) &&
        !workspace.get(closingTabsAtom).has(tabId) &&
        getCachedTreeStore(tabId) === store &&
        live.root === captured.root &&
        live.headers === captured.headers &&
        live.sourceStamp === source.sourceStamp &&
        live.linkedSource === source.linkedSource &&
        live.appendAttempted === source.appendAttempted
      );
    };
    const retireChangedDocument = () => {
      if (!isCurrent()) operation.retire();
    };
    pendingPgnEdits.set(store, operation);
    try {
      subscriptions.push(store.subscribe(retireChangedDocument));
      subscriptions.push(workspace.sub(tabsAtom, retireChangedDocument));
      subscriptions.push(workspace.sub(closingTabsAtom, retireChangedDocument));
      if (!isCurrent()) return;
      const tree = await parsePGN(tmp, undefined, { signal: controller.signal });
      if (!isCurrent()) return;
      // Release before publishing so our own accepted edit cannot retire its operation.
      operation.retire();
      if (deepEqual(tree.root, captured.root) && deepEqual(tree.headers, captured.headers)) {
        if (mounted.current) setTmp(pgn);
      } else {
        setState({
          ...tree,
          linkedSource: source.linkedSource,
          sourceStamp: source.sourceStamp,
          appendAttempted: source.appendAttempted,
          dirty: true,
          position: [],
        });
      }
    } catch (error) {
      if (isCurrent()) notifyUnlessCancelled(t("Common.Error"), error);
    } finally {
      operation.retire();
    }
  }

  const pgnArea = (
    <Box style={{ position: "relative" }}>
      <Textarea
        id="pgn-editor"
        autosize
        value={tmp}
        onChange={(e) => {
          pendingPgnEdits.get(store)?.retire();
          setTmp(e.currentTarget.value);
        }}
      />
      <CopyButton value={tmp} timeout={2000}>
        {({ copied, copy }) => (
          <IconAction
            label={copied ? t("Common.Copied") : t("Menu.Edit.Copy")}
            color={copied ? "teal" : "gray"}
            variant="subtle"
            onClick={copy}
            style={{ position: "absolute", top: 15, right: 15 }}
          >
            {copied ? (
              <IconCheck style={{ width: rem(16) }} />
            ) : (
              <IconCopy style={{ width: rem(16) }} />
            )}
          </IconAction>
        )}
      </CopyButton>
      {realPGN !== tmp && (
        <Button style={{ position: "absolute", bottom: 15, right: 15 }} onClick={() => updatePgn()}>
          {t("Common.Update")}
        </Button>
      )}
    </Box>
  );

  return (
    <Stack gap={0}>
      {controls}
      {pgnArea}
    </Stack>
  );
}

export default PgnInput;
