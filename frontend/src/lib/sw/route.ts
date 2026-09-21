/**
 * Какой стратегией обслуживать запрос в service worker.
 *
 * Вынесено из `src/sw.ts` не ради красоты: именно здесь 21.09 нашёлся изъян.
 * Картинки лежат по адресу `/api/v1/media/{uuid}` и попадали под правило для
 * API — сеть наперегонки с таймаутом в четыре секунды. Залп из полусотни
 * изображений в админском разделе «Медиа» выбивал сам себя: часть не
 * укладывалась в срок и получала синтезированный 503 «Нет соединения» при
 * живом сервере.
 *
 * Решение принимается по адресу и режиму запроса, никакой сети здесь нет —
 * значит, его можно проверить.
 */
export type SwRoute =
  /** Навигация: сеть, при отказе — офлайн-страница. */
  | "page"
  /** Файл по uuid: кэш вперёд, сеть следом, без сроков. */
  | "media"
  /** Данные: сеть с ожиданием, кэш как запасной. */
  | "api"
  /** Файл с хешем в имени: отдаём из кэша, обновляем в фоне. */
  | "asset"
  /** Не наше дело — пусть идёт как шло. */
  | null;

/** Медиа отдаётся по пути API, но это файл, а не ответ с данными. */
export const MEDIA_PATH = "/api/v1/media/";

export function swRoute(input: {
  method: string;
  mode: string;
  url: string;
  /** Origin самого worker'а: всё чужое, кроме API, мы не трогаем. */
  selfOrigin: string;
}): SwRoute {
  if (input.method !== "GET") return null;
  if (input.mode === "navigate") return "page";

  const url = new URL(input.url);

  // Путь проверяется до origin: API живёт на отдельном хосте, и по origin
  // правило в проде не сработало бы вовсе.
  if (url.pathname.startsWith(MEDIA_PATH)) return "media";
  if (url.pathname.startsWith("/api/")) return "api";

  if (url.origin !== input.selfOrigin) return null;
  if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/pwa/")) return "asset";

  return null;
}
