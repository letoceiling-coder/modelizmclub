// Public API/runtime config. Values come from build-time env (VITE_*) with
// production defaults so the app works even if env is not injected.

const stripTrailingSlash = (s: string): string => s.replace(/\/+$/, "");

export const API_BASE = stripTrailingSlash(
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
    "https://api.modelizmclub.ru/api/v1",
);

export const REVERB = {
  key: (import.meta.env.VITE_REVERB_APP_KEY as string | undefined) || "",
  host: (import.meta.env.VITE_REVERB_HOST as string | undefined) || "ws.modelizmclub.ru",
  port: Number((import.meta.env.VITE_REVERB_PORT as string | undefined) || "443"),
  scheme: (import.meta.env.VITE_REVERB_SCHEME as string | undefined) || "https",
};
