// Laravel Echo + Reverb realtime. Initialized once when user is authenticated.

import Echo from "laravel-echo";
import Pusher from "pusher-js";
import { API_BASE, REVERB } from "@/lib/api/config";
import { getToken } from "@/lib/api/client";

let echo: Echo | null = null;

declare global {
  interface Window {
    Pusher: typeof Pusher;
    Echo?: Echo;
  }
}

export function getEcho(): Echo | null {
  if (typeof window === "undefined") return null;
  if (!REVERB.key || !getToken()) return null;

  if (!echo) {
    window.Pusher = Pusher;
    echo = new Echo({
      broadcaster: "reverb",
      key: REVERB.key,
      wsHost: REVERB.host,
      wsPort: REVERB.port,
      wssPort: REVERB.port,
      forceTLS: REVERB.scheme === "https",
      enabledTransports: ["ws", "wss"],
      authEndpoint: `${API_BASE}/broadcasting/auth`,
      auth: {
        headers: {
          Authorization: `Bearer ${getToken()}`,
          Accept: "application/json",
        },
      },
    });
    window.Echo = echo;
  }

  return echo;
}

export function disconnectEcho(): void {
  echo?.disconnect();
  echo = null;
  if (typeof window !== "undefined") delete window.Echo;
}
