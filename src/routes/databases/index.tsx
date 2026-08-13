import { createFileRoute, redirect } from "@tanstack/react-router";
import { activeDatabaseViewStore } from "@/state/store/database";
import { databaseHandleKey } from "@/utils/db";

export const Route = createFileRoute("/databases/")({
  beforeLoad: async () => {
    const db = activeDatabaseViewStore.getState().database;

    if (db) {
      throw redirect({
        to: "/databases/$databaseId",
        params: { databaseId: databaseHandleKey(db.file) },
      });
    }
    return null;
  },
});
