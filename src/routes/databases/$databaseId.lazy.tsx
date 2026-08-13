import { createLazyFileRoute } from "@tanstack/react-router";
import DatabaseView from "@/components/databases/DatabaseView";

export const Route = createLazyFileRoute("/databases/$databaseId")({
  component: DatabaseView,
});
