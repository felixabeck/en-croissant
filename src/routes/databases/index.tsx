import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/databases/")({
  beforeLoad: () => {
    throw redirect({ to: "/library" });
  },
});
