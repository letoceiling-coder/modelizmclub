import { createFileRoute, redirect } from "@tanstack/react-router";

// The former standalone /landing page has been merged into the unified home "/".
// Kept as a permanent redirect so old links / bookmarks resolve.
export const Route = createFileRoute("/landing")({
  beforeLoad: () => {
    throw redirect({ to: "/", replace: true });
  },
});
