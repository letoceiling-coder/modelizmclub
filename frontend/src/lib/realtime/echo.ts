import Echo from "laravel-echo";
import Pusher from "pusher-js";
import { getAuthToken } from "@/lib/api/auth";
import { apiUrl } from "@/lib/api/config";

declare global {
  interface Window {
    Pusher: typeof Pusher;
    Echo?: Echo<"reverb">;
  }
}

type ChannelAuthData = { auth: string; channel_data?: string; shared_secret?: string };

const REVERB_KEY = import.meta.env.VITE_REVERB_APP_KEY ?? "";
const REVERB_HOST = import.meta.env.VITE_REVERB_HOST ?? "ws.modelizmclub.ru";
const REVERB_PORT = Number(import.meta.env.VITE_REVERB_PORT ?? 443);
const REVERB_SCHEME = import.meta.env.VITE_REVERB_SCHEME ?? "https";

export function getEcho(): Echo<"reverb"> | null {
  if (typeof window === "undefined") return null;
  if (!REVERB_KEY) return null;
  if (window.Echo) return window.Echo;

  const authUrl = apiUrl("/broadcasting/auth");

  window.Pusher = Pusher;
  window.Echo = new Echo({
    broadcaster: "reverb",
    key: REVERB_KEY,
    wsHost: REVERB_HOST,
    wsPort: REVERB_PORT,
    wssPort: REVERB_PORT,
    forceTLS: REVERB_SCHEME === "https",
    enabledTransports: ["ws", "wss"],
    // Custom authorizer so the auth token is read fresh on every channel
    // authorization request. The Echo instance is a singleton; a static
    // header would otherwise pin the token captured at creation time and
    // break realtime after re-login / token refresh without a page reload.
    authorizer: (channel: { name: string }) => ({
      authorize: (
        socketId: string,
        callback: (error: Error | null, data: ChannelAuthData | null) => void,
      ) => {
        fetch(authUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${getAuthToken() ?? ""}`,
          },
          body: JSON.stringify({ socket_id: socketId, channel_name: channel.name }),
        })
          .then((res) => {
            if (!res.ok) throw new Error(`broadcasting auth ${res.status}`);
            return res.json() as Promise<ChannelAuthData>;
          })
          .then((data) => callback(null, data))
          .catch((err: Error) => callback(err, null));
      },
    }),
  });

  return window.Echo;
}

export function subscribeConversation(
  conversationId: string,
  onMessage: (payload: { message: unknown }) => void,
): (() => void) | null {
  const echo = getEcho();
  const token = getAuthToken();
  if (!echo || !token) return null;

  const channel = echo.private(`conversation.${conversationId}`);
  channel.listen(".message.sent", onMessage);

  return () => {
    channel.stopListening(".message.sent");
    echo.leave(`conversation.${conversationId}`);
  };
}
