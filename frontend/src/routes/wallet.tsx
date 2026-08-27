import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy / QA alias — кошелёк живёт в настройках. */
export const Route = createFileRoute("/wallet")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/wallet", replace: true });
  },
});
