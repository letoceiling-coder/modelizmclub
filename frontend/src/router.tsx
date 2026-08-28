import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { RoutePending } from "@/components/boot/RoutePending";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60_000,
        gcTime: 30 * 60_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPendingComponent: RoutePending,
    // Loaders that resolve from cache finish in a few ms — waiting a beat keeps
    // instant navigations from flashing a skeleton.
    defaultPendingMs: 120,
    defaultPendingMinMs: 240,
    defaultStaleTime: 30_000,
    defaultPreloadStaleTime: 30_000,
  });

  return router;
};
