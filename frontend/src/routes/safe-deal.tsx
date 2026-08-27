import { createFileRoute, redirect } from "@tanstack/react-router";

/** Старый адрес юридического документа — постоянный редирект на хаб правил. */
export const Route = createFileRoute("/safe-deal")({
  beforeLoad: () => {
    throw redirect({ to: "/rules/$slug", params: { slug: "safe-deal" }, replace: true });
  },
});
