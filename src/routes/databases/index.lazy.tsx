import { createLazyFileRoute } from "@tanstack/react-router";
import DatabasesPage from "@/components/databases/DatabasesPage";

export const Route = createLazyFileRoute("/databases/")({
  component: DatabasesPage,
});
