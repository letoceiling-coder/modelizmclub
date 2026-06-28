import type { Message } from "@/lib/mock";
import { mapMessage } from "@/lib/api/chat";
import { getToken, API_BASE_URL } from "@/lib/api/client";

/* eslint-disable @typescript-eslint/no-explicit-any */

let echo: any = null;
let initTried = false;

function env(key: string): string | undefined {
  return (import.meta as { env?: Record<string, string | undefined> }).env?.[key];
}

async function getEcho(): Promise<any> {
  if (echo || initTried) return echo;
  initTried = true;
  const key = env("VITE_REVERB_APP_KEY");
  if (!key || typeof window === "undefined") return null;

  try {
    const [{ default: Echo }, PusherModule] = await Promise.all([
      import("laravel-echo"),
      import("pusher-js"),
    ]);
    (window as any).Pusher = (PusherModule as any).default ?? PusherModule;

    const port = Number(env("VITE_REVERB_PORT") ?? 443);
    echo = new Echo({
      broadcaster: "reverb",
      key,
      wsHost: env("VITE_REVERB_HOST"),
      wsPort: port,
      wssPort: port,
      forceTLS: (env("VITE_REVERB_SCHEME") ?? "https") === "https",
      enabledTransports: ["ws", "wss"],
      authEndpoint: API_BASE_URL.replace(/\/api\/v1\/?$/, "") + "/broadcasting/auth",
      auth: { headers: { Authorization: `Bearer ${getToken() ?? ""}` } },
    });
  } catch {
    echo = null;
  }
  return echo;
}

/**
 * Subscribe to a private conversation channel. Resolves to an unsubscribe
 * function. No-ops gracefully when Reverb is not configured.
 */
export async function subscribeConversation(
  uuid: string,
  onMessage: (m: Message) => void,
): Promise<() => void> {
  const e = await getEcho();
  if (!e) return () => {};
  try {
    const channel = e.private(`conversation.${uuid}`);
    channel.listen(".message.sent", (payload: { message: any }) => {
      if (payload?.message) onMessage(mapMessage(payload.message));
    });
  } catch {
    return () => {};
  }
  return () => {
    try {
      e.leave(`conversation.${uuid}`);
    } catch {
      /* ignore */
    }
  };
}

/**
 * Subscribe to the current user's private call-signaling channel.
 * `onSignal` receives every WebRTC signaling payload (offer/answer/ice/...).
 */
export async function subscribeCalls(
  userUuid: string,
  onSignal: (payload: { type: string; [k: string]: any }) => void,
): Promise<() => void> {
  const e = await getEcho();
  if (!e) return () => {};
  try {
    const channel = e.private(`calls.${userUuid}`);
    channel.listen(".call.signal", (payload: { type: string }) => {
      if (payload?.type) onSignal(payload);
    });
  } catch {
    return () => {};
  }
  return () => {
    try {
      e.leave(`calls.${userUuid}`);
    } catch {
      /* ignore */
    }
  };
}
