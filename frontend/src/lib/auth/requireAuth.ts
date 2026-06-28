import { redirect } from "@tanstack/react-router";
import { ensureSession } from "@/lib/auth/session";

/**
 * Route guard: redirects to /login when there is no valid session.
 * Skips on SSR (client-only check after hydration).
 */
export async function requireAuth(location?: { pathname: string; search?: string | Record<string, unknown> }): Promise<void> {
  if (typeof window === "undefined") return;

  const ok = await ensureSession();
  if (!ok) {
    const pathname = location?.pathname ?? window.location.pathname;
    const search =
      typeof location?.search === "string"
        ? location.search
        : window.location.search;
    throw redirect({
      to: "/login",
      search: { redirect: pathname + search },
    });
  }
}
