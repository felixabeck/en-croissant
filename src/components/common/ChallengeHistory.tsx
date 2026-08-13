import { Group, Stack, Text } from "@mantine/core";
import { IconCheck, IconDots, IconX } from "@tabler/icons-react";
import { useAtomValue } from "jotai";
import { match } from "ts-pattern";
import { useTranslation } from "react-i18next";
import { hidePuzzleRatingAtom } from "@/state/atoms";
import type { Completion } from "@/utils/puzzles";
import IconAction from "./IconAction";

type Challenge = {
  completion: Completion;
  label?: string;
};

function ChallengeHistory({
  challenges,
  select,
  current,
}: {
  challenges: Challenge[];
  select: (i: number) => void;
  current: number;
}) {
  const hideRating = useAtomValue(hidePuzzleRatingAtom);
  const { t } = useTranslation();

  return (
    <Group>
      {challenges.map((p, i) => {
        const isCurrent = i === current;
        return match(p.completion)
          .with("correct", () => (
            <Stack key={i} gap={0}>
              <IconAction
                label={t("ChallengeHistory.Correct", {
                  defaultValue: "Challenge {{number}}: correct",
                  number: i + 1,
                })}
                onClick={() => {
                  select(i);
                }}
                variant="light"
                color="green"
                style={{ border: isCurrent ? "2px solid green" : "none" }}
              >
                <IconCheck color="green" />
              </IconAction>
              <Text ta="center" fz="xs" c="green">
                {p.label}
              </Text>
            </Stack>
          ))
          .with("incorrect", () => (
            <Stack key={i} gap={0}>
              <IconAction
                label={t("ChallengeHistory.Incorrect", {
                  defaultValue: "Challenge {{number}}: incorrect",
                  number: i + 1,
                })}
                onClick={() => select(i)}
                variant="light"
                key={i}
                color="red"
                style={{ border: isCurrent ? "2px solid red" : "none" }}
              >
                <IconX color="red" />
              </IconAction>
              <Text ta="center" fz="xs" c="red">
                {p.label}
              </Text>
            </Stack>
          ))
          .with("incomplete", () => (
            <Stack key={i} gap={0}>
              <IconAction
                label={t("ChallengeHistory.Incomplete", {
                  defaultValue: "Challenge {{number}}: incomplete",
                  number: i + 1,
                })}
                onClick={() => select(i)}
                variant="light"
                key={i}
                color="yellow"
                style={{ border: isCurrent ? "2px solid yellow" : "none" }}
              >
                <IconDots color="yellow" />
              </IconAction>
              <Text ta="center" fz="xs" c="yellow">
                {hideRating ? "?" : p.label}
              </Text>
            </Stack>
          ))
          .exhaustive();
      })}
    </Group>
  );
}

export default ChallengeHistory;
