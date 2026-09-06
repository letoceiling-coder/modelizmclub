// Central API client for the ModelizmClub backend.
// All data in the app flows through here — no mock data.

const DEFAULT_BASE_URL = "https://api.modelizmclub.ru/api/v1";

export const API_BASE_URL: string =
  (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_API_BASE_URL?.replace(
    /\/$/,
    "",
  ) || DEFAULT_BASE_URL;

/** Происхождение API — нужно шапке документа, чтобы заранее открыть к нему
 *  соединение: LCP-картинка ленты лежит именно там. */
export const API_ORIGIN: string = (() => {
  try {
    return new URL(API_BASE_URL, "https://modelizmclub.ru").origin;
  } catch {
    return "https://api.modelizmclub.ru";
  }
})();

const TOKEN_KEY = "mc_token";
const LANG_KEY = "mc_lang";

export type Locale = "ru" | "en" | "zh";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY) ?? window.sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Persists the auth token. `remember` decides where: `true` (default) writes
 * to localStorage (survives browser restarts — "Запомнить меня" checked),
 * `false` writes to sessionStorage only (cleared when the tab/browser closes).
 * Always clears the other store so a stale copy can't resurrect the session.
 */
export function setToken(token: string | null, remember = true): void {
  if (typeof window === "undefined") return;
  try {
    if (token) {
      if (remember) {
        window.localStorage.setItem(TOKEN_KEY, token);
        window.sessionStorage.removeItem(TOKEN_KEY);
      } else {
        window.sessionStorage.setItem(TOKEN_KEY, token);
        window.localStorage.removeItem(TOKEN_KEY);
      }
    } else {
      window.localStorage.removeItem(TOKEN_KEY);
      window.sessionStorage.removeItem(TOKEN_KEY);
    }
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

  constructor(
    status: number,
    message: string,
    errors?: Record<string, string[]>,
    payload?: unknown,
  ) {
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

/**
 * Адреса, которые без токена отвечают только 401.
 *
 * Это «мои» данные (`/users/me/*`, `/me/*`) плюс поиск людей: он живёт под
 * `auth:sanctum` в том же маршрутном блоке, хотя по имени на личный не похож.
 * Список сверен с `backend/app/Modules/User/routes/api.php`.
 */
function isAuthOnlyPath(path: string): boolean {
  const clean = path.split("?")[0];
  return (
    clean.startsWith("/users/me/") ||
    clean === "/users/me" ||
    clean.startsWith("/me/") ||
    clean === "/users/search"
  );
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

  // Личные адреса без токена — это гарантированный 401, и ходить за ним
  // незачем. Гость собирал их на /friends, /favorites, /my-ads и раньше на
  // /profile и странице сообщества: запросы уходили из эффектов, которые
  // выполняются до того, как страница решит показать заглушку. Каждый такой
  // ответ ложится в консоль красной строкой, и в ней тонут настоящие ошибки.
  //
  // Ошибка та же, что вернул бы сервер, — вызывающий код её уже обрабатывает,
  // — но без сетевого запроса. Одна проверка здесь дешевле, чем `if (!token)`
  // в двух десятках мест, и следующий такой вызов уже не появится.
  if (auth && isAuthOnlyPath(path) && !getToken()) {
    throw new ApiError(401, "Unauthenticated.", undefined, { code: "no_token" });
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
    const obj = (data ?? {}) as {
      message?: string;
      errors?: Record<string, string[]>;
      code?: string;
    };
    const code = obj.code;
    if (
      typeof window !== "undefined" &&
      getToken() &&
      (code === "subscription_required" || code === "phone_not_verified")
    ) {
      window.dispatchEvent(new CustomEvent("modelizm:access-gate", { detail: { code } }));
    }
    throw new ApiError(res.status, obj.message || `HTTP ${res.status}`, obj.errors, data);
  }

  return data as T;
}
