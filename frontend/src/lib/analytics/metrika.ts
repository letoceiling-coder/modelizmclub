/**
 * Яндекс.Метрика с Вебвизором.
 *
 * Три правила, каждое из которых нарушается по умолчанию, если счётчик
 * поставить «как в инструкции»:
 *
 *  1. **Только после согласия.** Счётчик не грузится, пока человек не выбрал
 *     «аналитика — да» в баннере. До выбора на страницу не уходит ни одного
 *     запроса к Яндексу: загрузка стоит за `loadAnalyticsIfConsented`.
 *  2. **Отложенно.** Скрипт подключается после первого кадра и в простое
 *     браузера, а не в разметке: счётчик не должен соревноваться с LCP.
 *     Замер 03.09 показал LCP 14–19 с на большинстве страниц — добавлять
 *     туда сторонний скрипт в критический путь нельзя.
 *  3. **Переходы считаются.** Приложение одностраничное: после первой
 *     загрузки адрес меняет роутер, а Метрика об этом не узнаёт. Без
 *     `hit` на каждую смену адреса в отчётах остался бы один просмотр
 *     на сессию.
 *
 * Вебвизор пишет страницу целиком, поэтому поля ввода маскируются все до
 * единого — см. `trackLinks`/`webvisor` ниже и `MASK_SELECTOR`.
 */

/** Номер счётчика. Без него модуль ничего не делает — и это штатно. */
const COUNTER = Number(
  (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_METRIKA_ID ?? "",
);

/**
 * Что маскировать в Вебвизоре.
 *
 * Не список «чувствительных» полей, а все поля ввода разом: пароль, карта,
 * телефон, переписка, адрес, поиск. Перечислять по одному — значит однажды
 * завести новое поле и забыть его добавить, а цена такой забывчивости —
 * запись чужого пароля в отчёте.
 *
 * `textarea` — это в том числе окно сообщения в мессенджере.
 */
export const MASK_SELECTOR = "input, textarea, select, [contenteditable], [data-private]";

interface YandexMetrikaWindow extends Window {
  ym?: ((id: number, action: string, ...args: unknown[]) => void) & { a?: unknown[][]; l?: number };
}

let loaded = false;

/** Счётчик настроен — то есть номер задан сборкой. */
export function isMetrikaConfigured(): boolean {
  return Number.isFinite(COUNTER) && COUNTER > 0;
}

/** Счётчик уже на странице. */
export function isMetrikaLoaded(): boolean {
  return loaded;
}

function queue(): YandexMetrikaWindow["ym"] {
  const w = window as YandexMetrikaWindow;
  if (!w.ym) {
    const ym = ((...args: unknown[]) => {
      (ym.a = ym.a ?? []).push(args as unknown[]);
    }) as NonNullable<YandexMetrikaWindow["ym"]>;
    ym.l = Date.now();
    w.ym = ym;
  }
  return w.ym;
}

/**
 * Подключить счётчик. Вызывается только из `loadAnalyticsIfConsented`.
 *
 * Идемпотентно: повторный вызов после согласия, перезахода или смены
 * маршрута ничего не делает.
 */
export function loadMetrika(): void {
  if (loaded || !isMetrikaConfigured() || typeof window === "undefined") return;
  loaded = true;

  const ym = queue();
  ym?.(COUNTER, "init", {
    // Переходы шлём сами: у одностраничного приложения автоматический
    // `trackHash` считает только якоря, а не смену маршрута.
    defer: true,
    clickmap: true,
    trackLinks: true,
    accurateTrackBounce: true,
    webvisor: true,
    // Поля ввода в записи Вебвизора закрыты все до единого.
    params: { maskSelector: MASK_SELECTOR },
  });

  const добавить = (): void => {
    const s = document.createElement("script");
    s.src = "https://mc.yandex.ru/metrika/tag.js";
    s.async = true;
    document.head.appendChild(s);
  };

  // После первого кадра и в простое: счётчик не должен стоять в очереди
  // перед отрисовкой. `requestIdleCallback` есть не везде — Safari до 17.
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => void })
    .requestIdleCallback;
  if (idle) idle(добавить);
  else window.setTimeout(добавить, 2000);
}

/** Просмотр страницы. Зовётся на каждую смену адреса роутером. */
export function metrikaHit(url: string): void {
  if (!loaded) return;
  (window as YandexMetrikaWindow).ym?.(COUNTER, "hit", url);
}

/**
 * Цели.
 *
 * Список закрытый: цель, которой нет здесь, в отчётах не появится, а
 * произвольная строка в вызове — это опечатка, которую никто не заметит.
 */
export const GOALS = {
  /** Регистрация завершена. */
  signup: "signup",
  /** Телефон подтверждён кодом. */
  phoneVerified: "phone_verified",
  /** Запись опубликована. */
  postPublished: "post_published",
  /** Объявление размещено. */
  listingPublished: "listing_published",
  /** Безопасная сделка создана. */
  dealCreated: "deal_created",
  /** Подписка оформлена. */
  subscribed: "subscribed",
  /** Вступление в сообщество. */
  communityJoined: "community_joined",
} as const;

export type Goal = (typeof GOALS)[keyof typeof GOALS];

export function metrikaGoal(goal: Goal, params?: Record<string, unknown>): void {
  if (!loaded) return;
  (window as YandexMetrikaWindow).ym?.(COUNTER, "reachGoal", goal, params);
}
