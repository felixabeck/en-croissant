import { Progress } from "@mantine/core";
import { useProgress } from "@/hooks/useProgress";

function DatabaseLoader({ isLoading, tab }: { isLoading: boolean; tab: string | null }) {
  const { progress, isActive, item } = useProgress(tab ?? "");
  const isLoadingFromMemory = isLoading && (!isActive || progress === 0);
  // Reported progress is monotonic in the progress store, so a search that
  // failed or was cancelled never returns to zero on its own. Without this the
  // bar would stay frozen at the last percentage it reached until the store
  // entry expires.
  const endedWithoutResult = item !== null && item.finished && item.state !== "succeeded";

  return (
    <Progress
      animated={isLoadingFromMemory}
      value={isLoadingFromMemory ? 100 : endedWithoutResult ? 0 : progress}
      size="xs"
      mt="xs"
    />
  );
}

export default DatabaseLoader;
