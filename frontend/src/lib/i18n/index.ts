import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { ru } from "./locales/ru";

export type Locale = "ru" | "en" | "zh";
export const LOCALES: Locale[] = ["ru", "en", "zh"];
export const LANG_KEY = "mc_lang";

/** The locale that ships inside the initial bundle (SSR + first paint). */
export const DEFAULT_LOCALE: Locale = "ru";

export function readStoredLocale(): Locale {
  return DEFAULT_LOCALE;
}

// Initialised synchronously with the default locale only, so SSR and the first
// client render both produce Russian markup (no hydration mismatch) without
// dragging ~490 KB of en/zh dictionaries into the entry chunk. The other
// locales arrive as separate chunks the first time someone switches to them.
if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    // A single default namespace holding a nested dictionary, so callers use
    // dot-path keys like t("nav.feed") / t("common.save").
    resources: {
      ru: { translation: ru },
    },
    lng: DEFAULT_LOCALE,
    fallbackLng: DEFAULT_LOCALE,
    defaultNS: "translation",
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    // Silence the Locize promo message in production consoles.
    showSupportNotice: false,
  });
}

type LazyLocale = Exclude<Locale, typeof DEFAULT_LOCALE>;

// Static `import()` calls (not a computed specifier) so Rollup can see both
// chunks at build time and emit them separately.
const LOADERS: Record<LazyLocale, () => Promise<Record<string, unknown>>> = {
  en: () => import("./locales/en").then((m) => m.en as Record<string, unknown>),
  zh: () => import("./locales/zh").then((m) => m.zh as Record<string, unknown>),
};

const loading = new Map<Locale, Promise<void>>();

/**
 * Makes sure the dictionary for `locale` is registered in i18next. Resolves
 * immediately for the bundled default locale, and de-duplicates concurrent
 * calls for the lazy ones.
 */
export function loadLocale(locale: Locale): Promise<void> {
  if (locale === DEFAULT_LOCALE || i18n.hasResourceBundle(locale, "translation")) {
    return Promise.resolve();
  }
  const pending = loading.get(locale);
  if (pending) return pending;

  const loader = LOADERS[locale as LazyLocale];
  if (!loader) return Promise.resolve();

  const task = loader()
    .then((bundle) => {
      i18n.addResourceBundle(locale, "translation", bundle, true, true);
    })
    .catch(() => {
      // Keep the current language on a failed chunk fetch instead of showing
      // raw keys; the next attempt re-downloads.
      loading.delete(locale);
    });

  loading.set(locale, task);
  return task;
}

/**
 * Досылает словарь админки.
 *
 * Тридцать три её раздела весят 45 КБ и лежали в общем словаре — то есть в
 * главном чанке у каждого посетителя, включая тех, кто админку не откроет
 * никогда. Ключи не менялись (`pages.adminUsers.…`), кусок домешивается в тот
 * же словарь глубоким слиянием, поэтому места вызова остались прежними.
 *
 * Зовётся из `beforeLoad` маршрута /admin — до того, как что-то отрисуется,
 * иначе первый кадр показал бы точечные пути вместо подписей.
 *
 * Английский и китайский раньше несли админские ключи прямо в общем файле —
 * то есть ровно ту тяжесть, ради избавления от которой русскую часть и
 * вынесли, и вдобавок расхождение с `TranslationSchema` на тысячу ключей: в
 * `ru.ts` этих ключей уже не было, а в `en.ts` и `zh.ts` они остались. Теперь
 * у каждого языка свой кусок, и грузится тот, на котором смотрят.
 */
const ADMIN_BUNDLES: Record<Locale, () => Promise<Record<string, unknown>>> = {
  ru: () => import("./locales/ru-admin").then((m) => m.ruAdmin as Record<string, unknown>),
  en: () => import("./locales/en-admin").then((m) => m.enAdmin as Record<string, unknown>),
  zh: () => import("./locales/zh-admin").then((m) => m.zhAdmin as Record<string, unknown>),
};

const adminBundles = new Map<Locale, Promise<void>>();

export function loadAdminLocale(): Promise<void> {
  const locale =
    (i18n.language as Locale) in ADMIN_BUNDLES ? (i18n.language as Locale) : DEFAULT_LOCALE;

  if (i18n.hasResourceBundle(locale, "translation")) {
    const existing = i18n.getResourceBundle(locale, "translation") as {
      pages?: Record<string, unknown>;
    };
    if (existing?.pages?.adminShell) return Promise.resolve();
  }

  const pending = adminBundles.get(locale);
  if (pending) return pending;

  const promise = ADMIN_BUNDLES[locale]().then((bundle) => {
    // deep = true, overwrite = false: досылаем недостающее, не затирая уже
    // загруженный словарь.
    i18n.addResourceBundle(locale, "translation", bundle, true, false);
  });

  adminBundles.set(locale, promise);

  return promise;
}

export function setLocale(locale: Locale): void {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(LANG_KEY, locale);
    } catch {
      /* ignore */
    }
  }
  // Switch only once the dictionary is in place, otherwise i18next renders the
  // dot-path keys for a frame.
  void loadLocale(locale).then(() => {
    if (!i18n.hasResourceBundle(locale, "translation")) return;
    void i18n.changeLanguage(locale);
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("lang", locale);
    }
  });
}

export default i18n;
