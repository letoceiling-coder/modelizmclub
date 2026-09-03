import { queryOptions } from "@tanstack/react-query";
import { SESSION_KEY, type Session } from "./types";

/**
 * Shared by useSession() and the imperative helpers in lib/auth/session — one
 * key, one fetcher. The fetcher is loaded lazily: lib/auth/session pulls in
 * the store, subscription and realtime modules, several of which read this
 * package back, and a static import here would close that cycle (Rollup then
 * splits the two into chunks that depend on each other).
 */
export const sessionQueryOptions = queryOptions({
  queryKey: SESSION_KEY,
  queryFn: async (): Promise<Session | null> => (await import("@/lib/auth/session")).fetchSession(),
  staleTime: 5 * 60_000,
  gcTime: Infinity,
});
