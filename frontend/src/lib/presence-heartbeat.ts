import { api } from "@/lib/api/client";
import { getToken } from "@/lib/api/client";
import { isDemoMode } from "@/lib/demo-mode";

const HEARTBEAT_MS = 45_000;

let timer: ReturnType<typeof setInterval> | null = null;
let bound = false;

async function ping(): Promise<void> {
  if (!getToken() || isDemoMode()) return;
  try {
    await api("/users/me/presence", { method: "POST" });
  } catch {
    /* transient network error */
  }
}

function bindLifecycle(): void {
  if (bound || typeof window === "undefined") return;
  bound = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void ping();
  });
}

/** Keep last_seen_at fresh while the user is on the site. */
export function startPresenceHeartbeat(): void {
  if (typeof window === "undefined" || !getToken() || isDemoMode()) return;
  bindLifecycle();
  if (timer) return;
  void ping();
  timer = setInterval(() => {
    if (document.visibilityState === "hidden") return;
    void ping();
  }, HEARTBEAT_MS);
}

export function stopPresenceHeartbeat(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
