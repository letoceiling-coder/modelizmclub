import { createFileRoute, notFound } from "@tanstack/react-router";

/** Prototype route map — closed on every environment, including production. */
export const Route = createFileRoute("/diag")({
  beforeLoad: () => {
    throw notFound();
  },
});
