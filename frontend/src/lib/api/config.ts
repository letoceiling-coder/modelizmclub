/**
 * Public API config for Laravel backend integration.
 * Set VITE_API_BASE_URL in .env.production (see .env.example).
 */
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "https://api.modelizmclub.ru/api/v1";

export function apiUrl(path: string): string {
  const base = API_BASE_URL.replace(/\/$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}
