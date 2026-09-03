import type { QueryClient } from "@tanstack/react-query";

let client: QueryClient | null = null;

/**
 * Registered once from getRouter() on the client. Route guards
 * (`ensureSession`) and imperative helpers run outside React and must hit the
 * same QueryClient the <QueryClientProvider> uses — otherwise ['session']
 * would be two caches that disagree. Never set on the server: each SSR
 * request has its own client and a module singleton would leak across them.
 */
export function setSessionQueryClient(qc: QueryClient): void {
  client = qc;
}

export function getSessionQueryClient(): QueryClient | null {
  return client;
}
