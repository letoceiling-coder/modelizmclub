/**
 * Яндекс.Метрика с Вебвизором.
 *
 * Четыре правила, каждое из которых нарушается по умолчанию, если счётчик
 * поставить «как в инструкции»:
 *
 *  1. **Только после согласия.** Счётчик не грузится, пока человек не выбрал
 *     «аналитика — да»: загрузка стоит за `loadAnalyticsIfConsented`, и до
 *     выбора на страницу не уходит ни одного запроса к Яндексу. Отзыв
 *     согласия перезагружает страницу — иначе `tag.js` продолжил бы писать
 *     запись, даже если снять `window.ym`.
 *  2. **Отложенно.** Скрипт подключается после первого кадра и в простое
 *     браузера, а не в разметке: счётчик не должен соревноваться с LCP.
 *     Замер 03.09 показал LCP 14–19 с на большинстве страниц — добавлять
 *     туда сторонний скрипт в критический путь нельзя.
 *  3. **Переходы считаются.** Приложение одностраничное: после первой
 *     загрузки адрес меняет роутер, а Метрика об этом не узнаёт. Просмотры
 *     шлёт `Analytics`, и только он — здесь автоматической отправки нет
 *     (`defer: true`).
 *  4. **Поля ввода в записи закрыты.** См. `markPrivateFields` ниже.
 */

import { getPublicBootstrapSync } from "@/lib/api/bootstrap";

/**
 * Номер счётчика. Без него модуль ничего не делает — и это штатно.
 *
 * Функция, а не константа: значение приходит с `/public/bootstrap`, и на
 * момент загрузки модуля его ещё нет. Константа вычислилась бы нулём
 * навсегда, и счётчик молча не заводился бы даже после вставки номера в
 * админке — а заметить это можно было бы только по отсутствию визитов
 * через сутки.
 *
 * `import.meta.env` остаётся запасным путём: для сборок, где номер вшит.
 */
function counter(): number {
  const изНастроек = Number(
    String(getPublicBootstrapSync()?.integration_keys?.metrika_id ?? "").trim(),
  );
  if (Number.isFinite(изНастроек) && изНастроек > 0) return изНастроек;

  return Number(
    (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_METRIKA_ID ?? "",
  );
}

/**
 * Разметка Метрики: не записывать вводимое в поле.
 *
 * Именно класс на узле, а не параметр счётчика. Параметра «маскировать по
 * селектору» у Метрики нет вовсе: содержимым полей в Вебвизоре управляют
 * две вещи — галочка «Записывать содержимое полей» в кабинете счётчика и
 * вот эти классы на самих узлах. До 22.09 здесь стоял `params:
 * { maskSelector: … }`; `params` в `init` — это параметры визита, то есть
 * селектор уезжал в отчёты как произвольные данные и не маскировал ничего.
 */
export const YM_DISABLE_KEYS = "ym-disable-keys";

/** Разметка Метрики: не записывать содержимое узла вовсе. */
export const YM_HIDE_CONTENT = "ym-hide-content";

/**
 * Поля, которые закрываются в записи Вебвизора.
 *
 * Не список «чувствительных», а все поля ввода разом: пароль, карта,
 * телефон, переписка, адрес, поиск. Перечислять по одному — значит однажды
 * завести новое поле и забыть его, а цена забывчивости — чужой пароль в
 * записи.
 */
export const FIELD_SELECTOR = "input, textarea, select, [contenteditable]";

/**
 * Узлы, содержимое которых не записывается целиком.
 *
 * Переписка — не поле ввода: Вебвизор пишет разметку, и список сообщений
 * попал бы в запись обычным текстом, сколько поле ввода ни закрывай.
 * `[data-private]` — ручная пометка для того же случая в других местах.
 */
export const CONTENT_SELECTOR = "[data-private]";

interface YandexMetrikaWindow extends Window {
  ym?: ((id: number, action: string, ...args: unknown[]) => void) & { a?: unknown[][]; l?: number };
}

let started = false;

/** Счётчик настроен — то есть номер задан сборкой. */
export function isMetrikaConfigured(): boolean {
  const n = counter();

  return Number.isFinite(n) && n > 0;
}

/**
 * Счётчик запущен: согласие есть, `init` поставлен в очередь.
 *
 * Именно «запущен», а не «скрипт загрузился»: очередь `ym.a` принимает
 * вызовы до прихода `tag.js` и доносит их в том же порядке. Ждать загрузки
 * значило бы терять просмотры первых двух секунд.
 */
export function isMetrikaStarted(): boolean {
  return started;
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

/** Проставить разметку Метрики на всё, что нашлось внутри узла. */
export function markPrivate(root: ParentNode): void {
  root.querySelectorAll(FIELD_SELECTOR).forEach((el) => el.classList.add(YM_DISABLE_KEYS));
  root.querySelectorAll(CONTENT_SELECTOR).forEach((el) => el.classList.add(YM_HIDE_CONTENT));
}

/**
 * Проставить разметку на все поля — и на те, которых ещё нет.
 *
 * Наблюдатель, а не обход при запуске: половина полей приложения
 * появляется позже счётчика — шторка входа, форма объявления, окно
 * сообщения, поля оплаты. Обход один раз закрыл бы ровно то, что было на
 * экране в момент простоя браузера.
 *
 * Расставлять классы руками по компонентам было бы надёжнее ровно до
 * первого нового поля: забытый `className` здесь не ломает ничего видимого
 * и живёт до следующего аудита.
 *
 * Остаётся одна вещь, которой код не управляет: галочка «Записывать
 * содержимое полей» в кабинете счётчика. Её надо держать выключенной —
 * разметка закрывает ввод, а не предзаполненное значение.
 */
function markPrivateFields(): () => void {
  markPrivate(document);

  if (typeof MutationObserver === "undefined") return () => {};

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof Element) {
          if (node.matches(FIELD_SELECTOR)) node.classList.add(YM_DISABLE_KEYS);
          if (node.matches(CONTENT_SELECTOR)) node.classList.add(YM_HIDE_CONTENT);
          markPrivate(node);
        }
      }
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  return () => observer.disconnect();
}

/**
 * Параметры `init`.
 *
 * Отдельной константой, чтобы их можно было прочитать проверкой: 21.09
 * здесь стояло `params: { maskSelector: … }`, и ошибка была не видна ни
 * сборке, ни глазу — маскировки просто не происходило.
 *
 * `defer` выключает автоматическую отправку просмотра при `init`: просмотры
 * шлёт `Analytics`, и только он, иначе первая страница считалась бы дважды.
 */
export const INIT_OPTIONS = {
  defer: true,
  clickmap: true,
  trackLinks: true,
  accurateTrackBounce: true,
  webvisor: true,
} as const;

/**
 * Подключить счётчик. Вызывается только из `loadAnalyticsIfConsented`.
 *
 * Идемпотентно: повторный вызов после согласия, перезахода или смены
 * маршрута ничего не делает.
 */
export function loadMetrika(): void {
  if (started || !isMetrikaConfigured() || typeof window === "undefined") return;
  started = true;

  markPrivateFields();

  const ym = queue();
  ym?.(counter(), "init", INIT_OPTIONS);

  const добавить = (): void => {
    const s = document.createElement("script");
    s.src = "https://mc.yandex.ru/metrika/tag.js";
    s.async = true;
    document.head.appendChild(s);
  };

  /*
   * После первого кадра и в простое: счётчик не должен стоять в очереди
   * перед отрисовкой. `timeout` обязателен — в фоновой вкладке простоя не
   * наступает вовсе, и без него ссылка, открытая в соседней вкладке, не
   * дала бы ни одного визита (то же, что в CLAUDE.md про наблюдателей в
   * скрытой вкладке). `requestIdleCallback` есть не везде — Safari до 17.
   */
  const idle = (
    window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void;
    }
  ).requestIdleCallback;
  if (idle) idle(добавить, { timeout: 2000 });
  else window.setTimeout(добавить, 2000);
}

/**
 * Просмотр страницы. Зовётся на каждую смену маршрута.
 *
 * `referer` передаём сами: внутри одностраничного приложения
 * `document.referrer` на весь визит остаётся внешним, и цепочка переходов
 * «каталог → карточка → сделка» в отчётах не собралась бы.
 */
export function metrikaHit(url: string, referer?: string): void {
  if (!started) return;
  (window as YandexMetrikaWindow).ym?.(counter(), "hit", url, referer ? { referer } : undefined);
}

/**
 * Цели.
 *
 * Список закрытый: цель, которой нет здесь, в отчётах не появится, а
 * произвольная строка в вызове — это опечатка, которую никто не заметит.
 *
 * **Считается событие, а не человек.** Повторная публикация объявления из
 * архива, смена номера телефона, выход из сообщества и повторное вступление
 * дают цель заново — и это решение, а не недосмотр: каждое из них человек
 * проделал по-настоящему. Уникальных людей Метрика считает сама, отдельным
 * показателем в отчёте по цели; выкинуть повтор отсюда значило бы потерять
 * различие между «разместил одно объявление» и «размещает каждую неделю».
 *
 * **Публикация считается по действию человека, а не по решению модератора.**
 * `listing_published` и `post_published` срабатывают на успешный ответ
 * сервера, то есть в том числе когда объявление ушло на проверку. Воронка
 * меряет, сколько людей дошли до конца формы, — а сколько из них прошли
 * модерацию, видно в самой модерации, и путать эти два числа хуже, чем
 * считать отправку.
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
  if (!started) return;
  (window as YandexMetrikaWindow).ym?.(counter(), "reachGoal", goal, params);
}
