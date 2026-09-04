/// <reference lib="webworker" />

export {};

/**
 * Service worker МоДелизМ.
 *
 * Написан на голом Fetch API, без workbox-рантайма: правил всего три, и держать
 * их на виду дешевле, чем тянуть в бандл генератор стратегий.
 *
 * Что делает:
 *  - прекеш оболочки (офлайн-страница, иконки, favicon) — список подставляет
 *    vite-plugin-pwa в self.__WB_MANIFEST при сборке;
 *  - /assets/** (файлы с хешем в имени) — stale-while-revalidate;
 *  - /api/** — network-first с таймаутом: медленная сеть не должна держать
 *    экран, поэтому через NETWORK_TIMEOUT_MS отдаём последний удачный ответ;
 *  - навигации — network-first с офлайн-страницей как запасным вариантом.
 *
 * Обновление не применяется молча: новый worker ждёт SKIP_WAITING, который
 * присылает тост «Доступна новая версия» (components/pwa/PwaUpdatePrompt.tsx).
 */

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

const VERSION = "v1";
const SHELL_CACHE = `modelizm-shell-${VERSION}`;
const ASSET_CACHE = `modelizm-assets-${VERSION}`;
const API_CACHE = `modelizm-api-${VERSION}`;
const KNOWN_CACHES = [SHELL_CACHE, ASSET_CACHE, API_CACHE];

const OFFLINE_URL = "/offline.html";
const NETWORK_TIMEOUT_MS = 4000;
/** Ответы API стареют быстро — храним их только как «лучше, чем пустой экран». */
const API_CACHE_MAX_ENTRIES = 60;

const PRECACHE_URLS = Array.from(
  new Set([OFFLINE_URL, ...self.__WB_MANIFEST.map((entry) => entry.url)]),
);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      // Одна недокачанная иконка не должна ронять установку целиком.
      Promise.allSettled(
        PRECACHE_URLS.map((url) => cache.add(new Request(url, { cache: "reload" }))),
      ),
    ),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith("modelizm-") && !KNOWN_CACHES.includes(name))
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") void self.skipWaiting();
});

async function trimCache(cacheName: string, maxEntries: number): Promise<void> {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  await Promise.all(keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)));
}

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error("network-timeout")), ms);
  });
}

/** Отдаём кеш сразу, обновление тянем в фоне. */
async function staleWhileRevalidate(request: Request): Promise<Response> {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) void cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  if (cached) return cached;
  const fresh = await network;
  if (fresh) return fresh;
  return Response.error();
}

/** Сеть с таймаутом, иначе — последний удачный ответ. */
async function networkFirstApi(request: Request): Promise<Response> {
  const cache = await caches.open(API_CACHE);
  try {
    const response = (await Promise.race([
      fetch(request.clone()),
      timeout(NETWORK_TIMEOUT_MS),
    ])) as Response;
    if (response.ok) {
      void cache
        .put(request, response.clone())
        .then(() => trimCache(API_CACHE, API_CACHE_MAX_ENTRIES));
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ message: "Нет соединения" }), {
      status: 503,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
}

/** Страницы всегда с сервера (SSR), офлайн — понятная заглушка. */
async function networkFirstPage(request: Request): Promise<Response> {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(SHELL_CACHE);
    const offline = await cache.match(OFFLINE_URL);
    if (offline) return offline;
    return new Response("Нет соединения", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
    return;
  }

  // API живёт на отдельном хосте (api.modelizmclub.ru), поэтому проверяем путь
  // до проверки origin — иначе правило не сработало бы в проде.
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirstApi(request));
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/pwa/")) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
