import { createLazyFileRoute } from "@tanstack/react-router";
import BoardsPage from "@/components/tabs/BoardsPage";

/** The workspace contains analysis, editor, and puzzle features, so it is loaded only for `/`. */
export const Route = createLazyFileRoute("/")({
  component: BoardsPage,
});
