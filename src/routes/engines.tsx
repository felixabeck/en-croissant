import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const searchSchema = z.object({
  selected: z.number().optional(),
});

export const Route = createFileRoute("/engines")({
  validateSearch: searchSchema,
});
