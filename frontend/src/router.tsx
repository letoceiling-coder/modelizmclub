import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { RoutePending } from "@/components/boot/RoutePending";
import { routeTree } from "./routeTree.gen";
import { setSessionQueryClient } from "@/lib/session/queryClient";

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

  // Guards and imperative session helpers run outside React — hand them the
  // same client the provider uses. Client only: SSR gets a client per request.
  if (typeof window !== "undefined") setSessionQueryClient(queryClient);

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPendingComponent: RoutePending,
    // Show a skeleton only if the loader is actually slow. A min-pending
    // window forced a 240ms flash even when data was already in cache.
    defaultPendingMs: 200,
    defaultPendingMinMs: 0,
    defaultStaleTime: 30_000,
    defaultPreloadStaleTime: 30_000,
  });

  return router;
};
