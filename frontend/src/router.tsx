import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { RoutePending } from "@/components/boot/RoutePending";
import { routeTree } from "./routeTree.gen";
import { setSessionQueryClient } from "@/lib/session/queryClient";

export const getRouter = () => {
  // On the server every request gets its own client that is thrown away right
  // after dehydration, but each query still arms a gc timer for its gcTime.
  // Those timers hold the event loop open, so a 30-minute gcTime kept the
  // process alive for half an hour after SIGTERM and systemd had to SIGKILL it
  // mid-deploy. The browser is where a long gcTime actually pays off.
  const isServer = typeof window === "undefined";

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60_000,
        gcTime: isServer ? 1_000 : 30 * 60_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: 1,
      },
    },
  });

  // Guards and imperative session helpers run outside React — hand them the
  // same client the provider uses. Client only: SSR gets a client per request.
  if (!isServer) setSessionQueryClient(queryClient);

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
    // Fetch the route chunk (and its loader data) on hover/touch-start, so the
    // click has nothing left to download. Every route loader is a read-only
    // GET, and `defaultPreloadStaleTime` keeps a repeated hover from refetching.
    defaultPreload: "intent",
    // Long enough that dragging the pointer across a nav bar does not preload
    // every link it crosses, short enough to finish before the click lands.
    defaultPreloadDelay: 120,
    defaultPreloadStaleTime: 30_000,
  });

  return router;
};
