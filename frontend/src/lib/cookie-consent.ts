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
export function loadAnalyticsIfConsented(): void {
  const prefs = readCookiePrefs();
  if (!prefs?.analytics) return;
  void import("@/lib/analytics/metrika").then((m) => m.loadMetrika());
}

export function loadAdsIfConsented(): void {
  const prefs = readCookiePrefs();
  if (!prefs?.ads) return;
}
