// Central API client for the ModelizmClub backend.
// All data in the app flows through here — no mock data.

const DEFAULT_BASE_URL = "https://api.modelizmclub.ru/api/v1";

export const API_BASE_URL: string =
  (import.meta as { env?: Record<string, string | undefined> }).env
    ?.VITE_API_BASE_URL?.replace(/\/$/, "") || DEFAULT_BASE_URL;

const TOKEN_KEY = "mc_token";
const LANG_KEY = "mc_lang";

export type Locale = "ru" | "en" | "zh";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export function getLocale(): Locale {
  if (typeof window === "undefined") return "ru";
  try {
    const v = window.localStorage.getItem(LANG_KEY);
    return v === "en" || v === "zh" ? v : "ru";
  } catch {
    return "ru";
  }
}

export class ApiError extends Error {
  status: number;
  errors?: Record<string, string[]>;
  payload?: unknown;

  constructor(status: number, message: string, errors?: Record<string, string[]>, payload?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
    this.payload = payload;
  }
}

interface ApiOptions extends Omit<RequestInit, "body"> {
  json?: unknown;
  body?: BodyInit | null;
  auth?: boolean;
  query?: Record<string, string | number | boolean | undefined | null>;
}

function buildUrl(path: string, query?: ApiOptions["query"]): string {
  const url = path.startsWith("http")
    ? path
    : `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}${url.includes("?") ? "&" : "?"}${qs}` : url;
}

export async function api<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
  const { json, auth = true, query, headers, ...rest } = options;

  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    "Accept-Language": getLocale(),
    ...(headers as Record<string, string> | undefined),
  };

  let body = rest.body ?? undefined;
  if (json !== undefined) {
    finalHeaders["Content-Type"] = "application/json";
    body = JSON.stringify(json);
  }

  if (auth) {
    const token = getToken();
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(buildUrl(path, query), {
    ...rest,
    headers: finalHeaders,
    body,
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const obj = (data ?? {}) as { message?: string; errors?: Record<string, string[]> };
    throw new ApiError(res.status, obj.message || `HTTP ${res.status}`, obj.errors, data);
  }

  return data as T;
}
