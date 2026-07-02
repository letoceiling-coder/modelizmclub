import { redirect } from "@tanstack/react-router";
import { ensureSession } from "@/lib/auth/session";

/**
 * Route guard for the admin panel (runs client-only, after hydration).
 * Only enforces authentication here — redirects to /login when there is no
 * valid session. The superadmin role check (and the 403 screen) is handled in
 * the AdminPage component so it also works on direct load / F5, where
 * `beforeLoad` resolves during SSR and does not re-run on hydration.
 */
export async function requireAdmin(location?: {
  pathname: string;
  search?: string | Record<string, unknown>;
}): Promise<void> {
  if (typeof window === "undefined") return;

  const ok = await ensureSession();
  if (!ok) {
    const pathname = location?.pathname ?? window.location.pathname;
    const search =
      typeof location?.search === "string" ? location.search : window.location.search;
    throw redirect({ to: "/login", search: { redirect: pathname + search } });
  }
}
