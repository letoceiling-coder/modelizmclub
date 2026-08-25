import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy URL for the safe-deal cabinet — keep as a permanent redirect. */
export const Route = createFileRoute("/safe-deals")({
  beforeLoad: () => {
    throw redirect({ to: "/deals", replace: true });
  },
});
