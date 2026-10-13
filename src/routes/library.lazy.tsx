import { createLazyFileRoute } from "@tanstack/react-router";
import LibraryPage from "@/components/library/LibraryPage";

export const Route = createLazyFileRoute("/library")({ component: LibraryPage });
