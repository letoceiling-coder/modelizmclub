import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { ru } from "./locales/ru";
import { en } from "./locales/en";
import { zh } from "./locales/zh";

export type Locale = "ru" | "en" | "zh";
export const LOCALES: Locale[] = ["ru", "en", "zh"];
export const LANG_KEY = "mc_lang";

export function readStoredLocale(): Locale {
  if (typeof window === "undefined") return "ru";
  try {
    const v = window.localStorage.getItem(LANG_KEY);
    return v === "en" || v === "zh" ? v : "ru";
  } catch {
    return "ru";
  }
}

// Initialised synchronously with bundled resources so SSR and the first client
// render both produce Russian markup (no hydration mismatch). The stored locale
// is applied right after mount by the I18nProvider.
if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: {
      ru: ru,
      en: en,
      zh: zh,
    },
    lng: "ru",
    fallbackLng: "ru",
    defaultNS: "common",
    ns: ["common", "nav", "auth", "lang"],
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
}

export function setLocale(locale: Locale): void {
  void i18n.changeLanguage(locale);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(LANG_KEY, locale);
      document.documentElement.setAttribute("lang", locale);
    } catch {
      /* ignore */
    }
  }
}

export default i18n;
