import type { Message } from "@/lib/mock";
import { mapMessage } from "@/lib/api/chat";
import { getToken, API_BASE_URL } from "@/lib/api/client";

/* eslint-disable @typescript-eslint/no-explicit-any */

let echo: any = null;
const connectionListeners = new Set<(connected: boolean) => void>();

function isPusherConnected(e: any): boolean {
  return e?.connector?.pusher?.connection?.state === "connected";
}

function bindConnectionWatch(e: any): void {
  const conn = e?.connector?.pusher?.connection;
  if (!conn || conn.__mcBound) return;
  conn.__mcBound = true;
  const notify = (): void => {
    const connected = conn.state === "connected";
    connectionListeners.forEach((cb) => cb(connected));
  };
  conn.bind("connected", notify);
  conn.bind("disconnected", notify);
  conn.bind("failed", notify);
  conn.bind("unavailable", notify);
  notify();
}

/** True when the Reverb/Pusher socket is up. */
export function isEchoConnected(): boolean {
  return isPusherConnected(echo);
}

/** React to WebSocket connect/disconnect (used for rare HTTP fallbacks). */
export function onEchoConnection(cb: (connected: boolean) => void): () => void {
  connectionListeners.add(cb);
  void getEcho().then((e) => {
    if (e) bindConnectionWatch(e);
    cb(isPusherConnected(e));
  });
  return () => connectionListeners.delete(cb);
}

function env(key: string): string | undefined {
  return (import.meta as { env?: Record<string, string | undefined> }).env?.[key];
}

/** Disconnect and allow Echo to re-initialise with a fresh auth token. */
export function resetEcho(): void {
  if (echo) {
    try {
      echo.disconnect();
    } catch {
      /* ignore */
    }
  }
  echo = null;
}

async function getEcho(): Promise<any> {
  if (echo) return echo;
  if (typeof window === "undefined") return null;

  const key = env("VITE_REVERB_APP_KEY");
  if (!key) return null;
  if (!getToken()) return null;

  try {
    const [{ default: Echo }, PusherModule] = await Promise.all([
      import("laravel-echo"),
      import("pusher-js"),
    ]);
    (window as any).Pusher = (PusherModule as any).default ?? PusherModule;

    const port = Number(env("VITE_REVERB_PORT") ?? 443);
    const authUrl = `${API_BASE_URL}/broadcasting/auth`;

    echo = new Echo({
      broadcaster: "reverb",
      key,
      wsHost: env("VITE_REVERB_HOST"),
      wsPort: port,
      wssPort: port,
      forceTLS: (env("VITE_REVERB_SCHEME") ?? "https") === "https",
      enabledTransports: ["ws", "wss"],
      authorizer: (channel: { name: string }) => ({
        authorize: (socketId: string, callback: (error: Error | null, data: { auth: string } | null) => void) => {
          fetch(authUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
              Authorization: `Bearer ${getToken() ?? ""}`,
            },
            body: JSON.stringify({
              socket_id: socketId,
              channel_name: channel.name,
            }),
          })
            .then(async (res) => {
              const data = (await res.json().catch(() => null)) as { auth?: string } | null;
              if (!res.ok || !data?.auth) {
                callback(new Error(`Broadcast auth ${res.status}`), null);
                return;
              }
              callback(null, { auth: data.auth });
            })
            .catch((err: Error) => callback(err, null));
        },
      }),
    } as ConstructorParameters<typeof Echo>[0]);
    bindConnectionWatch(echo);
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
  if (!getToken()) return () => {};
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

export async function subscribeUser(
  userUuid: string,
  onEvent: (payload: { type?: string; payload?: unknown }) => void,
): Promise<() => void> {
  if (!getToken()) return () => {};
  const e = await getEcho();
  if (!e) return () => {};
  try {
    const channel = e.private(`user.${userUuid}`);
    channel.listen(".user.event", (payload: { type?: string; payload?: unknown }) => {
      if (payload?.type) onEvent(payload);
    });
  } catch {
    return () => {};
  }
  return () => {
    try {
      e.leave(`user.${userUuid}`);
    } catch {
      /* ignore */
    }
  };
}

/**
 * Subscribe to the current user's private call-signaling channel.
 */
export async function subscribeCalls(
  userUuid: string,
  onSignal: (payload: { type: string; [k: string]: any }) => void,
): Promise<() => void> {
  if (!getToken()) return () => {};
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
