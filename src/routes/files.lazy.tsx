import { createLazyFileRoute } from "@tanstack/react-router";
import FilesPage from "@/components/files/FilesPage";

export const Route = createLazyFileRoute("/files")({
  component: FilesPage,
});
