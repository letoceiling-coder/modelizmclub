import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getFeatureFlags, loadFeatureFlagsFromServer } from "@/lib/config/featureFlags";

export const Route = createFileRoute("/reviews")({
  beforeLoad: async () => {
    await loadFeatureFlagsFromServer();
    if (!getFeatureFlags().reviewsEnabled) {
      throw redirect({ to: "/feed", replace: true });
    }
  },
  component: () => <Outlet />,
});
