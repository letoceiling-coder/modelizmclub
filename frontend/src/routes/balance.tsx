import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy / QA alias — баланс совпадает с кошельком. */
export const Route = createFileRoute("/balance")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/wallet", replace: true });
  },
});
