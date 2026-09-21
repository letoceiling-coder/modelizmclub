/// <reference lib="webworker" />

export {};

import { swRoute } from "@/lib/sw/route";

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
 *  - /api/v1/media/** — мимо worker'а: кэшировать нельзя, гонка вредна;
 *  - /api/** — network-first: через NETWORK_TIMEOUT_MS отдаём последний
 *    удачный ответ, но саму сеть не бросаем — таймаут не отказ;
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
/**
 * Через сколько отдать последний удачный ответ, не дожидаясь сети.
 *
 * Это срок ожидания, а не приговор: по его истечении мы отдаём кэш, если он
 * есть, но саму сеть не бросаем. Раньше таймаут считался отказом, и медленный
 * ответ был неотличим от пропавшей сети — см. `networkFirstApi`.
 */
const NETWORK_TIMEOUT_MS = 4000;
/**
 * Предел ожидания, за которым сеть считается мёртвой.
 *
 * Не четыре секунды: столько ждать нормально. Но и не бесконечность —
 * см. `networkFirstApi`.
 */
const NETWORK_HARD_LIMIT_MS = 45_000;
/** Ответы API стареют быстро — храним их только как «лучше, чем пустой экран». */
const API_CACHE_MAX_ENTRIES = 60;
/* MEDIA_PATH живёт рядом с решением о маршруте — см. lib/sw/route.ts. */

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

/**
 * Сеть с ожиданием, а не с приговором.
 *
 * Прежняя правка гоняла `fetch` наперегонки с таймаутом и считала проигрыш
 * отказом: если ответа в кэше не было, человек получал синтезированный 503
 * «Нет соединения» при живом сервере. В админском разделе «Медиа» так падала
 * половина картинок: страница запрашивает полсотни файлов разом, и часть не
 * укладывалась в четыре секунды (приёмка 21.09; в журнале nginx 503 за сутки
 * было ровно ноль).
 *
 * Теперь таймаут — повод отдать кэш, а не бросить сеть:
 *
 *  - есть кэш и сеть не уложилась в срок — отдаём кэш, запрос продолжается
 *    и обновит кэш к следующему разу;
 *  - кэша нет — **ждём сеть сколько нужно**. Медленный ответ лучше ложного
 *    «нет соединения»;
 *  - сеть действительно отказала (`fetch` отклонился) — вот тогда кэш, а
 *    если и его нет — 503.
 */
async function networkFirstApi(request: Request): Promise<Response> {
  const cache = await caches.open(API_CACHE);

  const network = fetch(request.clone()).then((response) => {
    if (response.ok) {
      void cache
        .put(request, response.clone())
        .then(() => trimCache(API_CACHE, API_CACHE_MAX_ENTRIES));
    }
    return response;
  });
  // Отказ сети разбирается ниже; здесь гасим «unhandled rejection» у ветки,
  // которую могли не дождаться.
  network.catch(() => undefined);

  const settled = await Promise.race([
    network.then((r) => ({ ok: true as const, r })).catch(() => ({ ok: false as const })),
    timeout(NETWORK_TIMEOUT_MS).then(
      () => ({ slow: true as const }),
      () => ({ slow: true as const }),
    ),
  ]);

  if ("ok" in settled && settled.ok) return settled.r;

  const cached = await cache.match(request);
  if (cached) return cached;

  /*
   * Кэша нет. Если это была лишь задержка — досматриваем сеть, но не вечно.
   *
   * У `fetch` своего срока нет, и залипшее соединение — перехватывающий
   * портал, потерянная сота посреди запроса — держало бы экран без конца:
   * промис не отклоняется, значит «Повторить» человеку никто не покажет.
   * Настоящий офлайн сюда не попадает: там `fetch` отклоняется сразу.
   */
  if ("slow" in settled) {
    try {
      return (await Promise.race([network, timeout(NETWORK_HARD_LIMIT_MS)])) as Response;
    } catch {
      /* сеть отказала или залипла — ниже общий ответ */
    }
  }

  return new Response(JSON.stringify({ message: "Нет соединения" }), {
    status: 503,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
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
  // Само решение — в lib/sw/route.ts: оно чистое, и на нём стоят проверки.
  const route = swRoute({
    method: request.method,
    mode: request.mode,
    url: request.url,
    selfOrigin: self.location.origin,
  });

  /*
   * Медиа уходит мимо worker'а — `respondWith` для него не зовём вовсе.
   *
   * Вся починка была в том, чтобы убрать его из гонки с таймаутом; кэшировать
   * его нельзя, и попытка это сделать была бы хуже прежнего дефекта:
   *
   *  - картинки грузятся обычным `<img src>` на чужой origin без
   *    `crossorigin`, то есть режимом `no-cors`. Ответ выходит opaque:
   *    `status: 0`, `ok: false` — класть в кэш нечего, и «кэш вперёд» никогда
   *    бы не сработал. Отсюда же и сам дефект: запасного ответа по истечении
   *    четырёх секунд не находилось, и рождался синтезированный 503;
   *  - зато вложения споров идут через `openAuthorizedMedia` заголовком
   *    `Authorization` — режимом `cors`, с настоящим 200. Доступ к ним
   *    проверяет сервер (`ServeMediaController::mayViewPrivate`), а Cache API
   *    сопоставляет только по адресу: `Vary` прокси не шлёт. То есть в кэш
   *    легло бы ровно то единственное, чего кэшировать нельзя, и следующий
   *    человек в этом браузере получил бы файл, минуя проверку прав;
   *  - и там же видео с запросами диапазонов: `cache.put` на 206 отклоняется,
   *    а полный 200 из кэша в ответ на `Range` ломает перемотку.
   *
   * Решение видно в `swRoute` и проверено: маршрут «медиа» существует не как
   * стратегия, а как явный отказ от неё.
   */
  if (route === "media") return;

  if (route === "page") event.respondWith(networkFirstPage(request));
  else if (route === "api") event.respondWith(networkFirstApi(request));
  else if (route === "asset") event.respondWith(staleWhileRevalidate(request));
});
