import { setCurrentUser, upsertUsers } from "@/lib/mock";
import type { User } from "@/lib/mock";
import { hydrateStore } from "@/lib/store";
import { fetchMe, logout as apiLogout } from "@/lib/api/auth";
import { getToken, setToken } from "@/lib/api/client";
import { bootstrapAppData, resetAppDataBootstrap } from "./bootstrap-data";
import { disconnectEcho } from "@/lib/realtime/echo";
import { resetChatSubscriptions } from "@/lib/realtime/chat-listener";

let bootstrapped = false;
let bootstrapPromise: Promise<User | null> | null = null;

export function applySession(user: User, token: string): void {
  setToken(token);
  setCurrentUser(user);
  hydrateStore({ userId: user.id });
  resetAppDataBootstrap();
  void bootstrapAppData();
}

export function clearSession(): void {
  setToken(null);
  resetAppDataBootstrap();
  resetChatSubscriptions();
  disconnectEcho();
}

export async function signOut(): Promise<void> {
  await apiLogout();
  clearSession();
}

/** Load current user from token on app start (once). */
export function bootstrapSession(): Promise<User | null> {
  if (bootstrapped) return Promise.resolve(null);
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    if (!getToken()) {
      bootstrapped = true;
      return null;
    }
    try {
      const user = await fetchMe();
      if (user) {
        upsertUsers([user]);
        setCurrentUser(user);
        hydrateStore({ userId: user.id });
      } else {
        clearSession();
      }
      bootstrapped = true;
      return user;
    } catch {
      clearSession();
      bootstrapped = true;
      return null;
    } finally {
      void bootstrapAppData();
    }
  })();

  return bootstrapPromise;
}
