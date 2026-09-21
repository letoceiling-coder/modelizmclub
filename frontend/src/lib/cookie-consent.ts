import { ignoreFailure } from "@/lib/errors/handle";

const KEY = "modelizm-cookie-key";

export function getAnonymousCookieKey(): string {
  if (typeof window === "undefined") return "";
  let key = localStorage.getItem(KEY);
  if (!key) {
    key = crypto.randomUUID();
    localStorage.setItem(KEY, key);
  }
  return key;
}

export interface StoredCookiePrefs {
  necessary: true;
  analytics: boolean;
  ads: boolean;
  savedAt: string;
}

const PREFS_KEY = "modelizm-cookie-prefs";

export function readCookiePrefs(): StoredCookiePrefs | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredCookiePrefs;
  } catch {
    return null;
  }
}

/**
 * Запись выбора по cookie.
 *
 * Принимает ровно то, что решает человек: аналитика и реклама. `necessary`
 * всегда `true` по смыслу, `savedAt` функция ставит сама — требовать их от
 * вызывающего значило бы просить данные, которые она тут же выбрасывает.
 * Прежняя сигнатура их требовала, и вызов из баннера не проходил проверку
 * типов.
 */
export function writeCookiePrefs(prefs: Pick<StoredCookiePrefs, "analytics" | "ads">): void {
  const payload: StoredCookiePrefs = {
    necessary: true,
    analytics: prefs.analytics,
    ads: prefs.ads,
    savedAt: new Date().toISOString(),
  };
  localStorage.setItem(PREFS_KEY, JSON.stringify(payload));
}

export function hasCookieChoice(): boolean {
  return readCookiePrefs() !== null;
}

/**
 * Подключить аналитику, если человек на неё согласился.
 *
 * Единственная дверь: счётчик не грузится ниоткуда больше. Пока согласия
 * нет — ни одного запроса к Яндексу со страницы не уходит.
 *
 * Без номера счётчика (`VITE_METRIKA_ID`) функция тоже молчит, и это
 * штатно: код приезжает раньше номера.
 */
const слушатели = new Set<() => void>();

/**
 * Согласие на аналитику разрешилось — счётчик либо запущен, либо нет.
 *
 * Нужно ровно одному месту — `Analytics`, — и ровно ради одного случая:
 * человек нажал «Принять» в баннере, а страница с этого момента уже
 * смонтирована. Без оповещения счётчик у него запустился бы, а первый
 * просмотр не ушёл бы до следующей перезагрузки.
 */
export function onAnalyticsConsent(cb: () => void): () => void {
  слушатели.add(cb);

  return () => слушатели.delete(cb);
}

export async function loadAnalyticsIfConsented(): Promise<void> {
  const prefs = readCookiePrefs();
  if (!prefs?.analytics) return;
  /*
   * Отказ импорта молчит, но с причиной: чанк мог уехать предыдущей
   * выкаткой или не отдаться в офлайне. Без обработчика это уходило в
   * `unhandledrejection` и ложилось в журнал ошибок приложения как поломка —
   * притом что аналитика не обязательна и подключится при следующем заходе.
   */
  await import("@/lib/analytics/metrika")
    .then((m) => m.loadMetrika())
    .catch(ignoreFailure("аналитика не обязательна: счётчик подключится при следующем заходе"));

  слушатели.forEach((cb) => cb());
}

export function loadAdsIfConsented(): void {
  const prefs = readCookiePrefs();
  if (!prefs?.ads) return;
}
