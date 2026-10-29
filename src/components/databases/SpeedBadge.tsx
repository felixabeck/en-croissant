import { Badge } from "@mantine/core";
import { match } from "ts-pattern";
import type { Speed } from "@/utils/db";

function SpeeedBadge({ speed }: { speed: Speed }) {
  const color = match(speed)
    .with("UltraBullet", () => "var(--cf-chart-7)")
    .with("Bullet", () => "var(--cf-chart-3)")
    .with("Blitz", () => "var(--cf-chart-4)")
    .with("Rapid", () => "var(--cf-chart-2)")
    .with("Classical", () => "var(--cf-chart-6)")
    .with("Correspondence", () => "var(--cf-chart-8)")
    .with("Unknown", () => "var(--cf-muted-foreground)")
    .exhaustive();
  return <Badge color={color}>{speed}</Badge>;
}

export default SpeeedBadge;
