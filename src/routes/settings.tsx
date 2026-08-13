import { createFileRoute } from "@tanstack/react-router";
import { getVersion } from "@/platform/native";

export const Route = createFileRoute("/settings")({
  loader: async () => ({ version: await getVersion() }),
});
