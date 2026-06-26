import ruJson from "./locales/ru.json";
import enJson from "./locales/en.json";
import zhJson from "./locales/zh.json";

export type AppLang = "ru" | "en" | "zh";

export type TranslationDict = Record<string, string | TranslationDict>;

export const STORAGE_KEY = "app-lang";

export const LANG_META: Record<AppLang, { native: string; flag: string }> = {
  ru: { native: "Русский", flag: "🇷🇺" },
  en: { native: "English", flag: "🇬🇧" },
  zh: { native: "中文", flag: "🇨🇳" },
};

function flatten(obj: TranslationDict, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      out[path] = value;
    } else {
      Object.assign(out, flatten(value, path));
    }
  }
  return out;
}

export const dictionaries: Record<AppLang, Record<string, string>> = {
  ru: flatten(ruJson as TranslationDict),
  en: flatten(enJson as TranslationDict),
  zh: flatten(zhJson as TranslationDict),
};
