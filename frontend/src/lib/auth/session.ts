import { fetchMe, logout as apiLogout } from "@/lib/api/auth";
import { getToken } from "@/lib/api/client";
import { setCurrentUser } from "@/lib/store";

let restored = false;

// Restore the authenticated user into the store on app boot.
// Safe to call multiple times — runs the network fetch only once.
export async function restoreSession(): Promise<void> {
  if (restored) return;
  restored = true;
  if (!getToken()) return;
  const me = await fetchMe();
  if (me) setCurrentUser(me);
}

export function isAuthenticated(): boolean {
  return Boolean(getToken());
}

export async function signOut(): Promise<void> {
  await apiLogout();
  restored = false;
}
