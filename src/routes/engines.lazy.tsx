import { createLazyFileRoute } from "@tanstack/react-router";
import EnginesPage from "@/components/engines/EnginesPage";

export const Route = createLazyFileRoute("/engines")({
  component: EnginesPage,
});
