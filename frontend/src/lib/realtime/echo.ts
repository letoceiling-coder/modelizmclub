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

const REVERB_KEY = import.meta.env.VITE_REVERB_APP_KEY ?? "";
const REVERB_HOST = import.meta.env.VITE_REVERB_HOST ?? "ws.modelizmclub.ru";
const REVERB_PORT = Number(import.meta.env.VITE_REVERB_PORT ?? 443);
const REVERB_SCHEME = import.meta.env.VITE_REVERB_SCHEME ?? "https";

export function getEcho(): Echo<"reverb"> | null {
  if (typeof window === "undefined") return null;
  if (!REVERB_KEY) return null;
  if (window.Echo) return window.Echo;

  window.Pusher = Pusher;
  window.Echo = new Echo({
    broadcaster: "reverb",
    key: REVERB_KEY,
    wsHost: REVERB_HOST,
    wsPort: REVERB_PORT,
    wssPort: REVERB_PORT,
    forceTLS: REVERB_SCHEME === "https",
    enabledTransports: ["ws", "wss"],
    authEndpoint: apiUrl("/broadcasting/auth"),
    auth: {
      headers: {
        Authorization: `Bearer ${getAuthToken() ?? ""}`,
        Accept: "application/json",
      },
    },
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
