import { createLazyFileRoute } from "@tanstack/react-router";
import AccountsPage from "@/components/home/AccountsPage";

/** Account charts and remote-sync controls are not part of the application shell. */
export const Route = createLazyFileRoute("/accounts")({
  component: AccountsPage,
});
