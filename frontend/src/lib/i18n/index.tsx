import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { dictionaries, LANG_META, STORAGE_KEY, type AppLang } from "./locales";

type I18nContextValue = {
  lang: AppLang;
  setLang: (lang: AppLang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function readInitialLang(): AppLang {
  if (typeof window === "undefined") return "ru";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "en" || stored === "zh" || stored === "ru") return stored;
  const legacy = window.localStorage.getItem("chat-lang");
  if (legacy === "en" || legacy === "zh" || legacy === "ru") return legacy;
  return "ru";
}

function resolveLang(lang?: AppLang): AppLang {
  if (lang === "en" || lang === "zh" || lang === "ru") return lang;
  if (typeof window !== "undefined") return readInitialLang();
  return "ru";
}

export function translate(
  key: string,
  vars?: Record<string, string | number>,
  lang?: AppLang,
): string {
  const resolved = resolveLang(lang);
  let text = dictionaries[resolved][key] ?? dictionaries.ru[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(`{{${k}}}`, String(v));
    }
  }
  return text;
}

/** Static translation without React context (SSR head, utilities). */
export function tStatic(key: string, vars?: Record<string, string | number>, lang?: AppLang): string {
  return translate(key, vars, lang);
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<AppLang>(readInitialLang);

  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : lang;
  }, [lang]);

  const setLang = useCallback((next: AppLang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
      window.localStorage.setItem("chat-lang", next);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(key, vars, lang),
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

export function useTranslation() {
  return useI18n();
}

/** Sets document.title from a translation key. */
export function usePageTitle(key: string, vars?: Record<string, string | number>) {
  const { t } = useI18n();
  useEffect(() => {
    document.title = t(key, vars);
  }, [t, key, vars]);
}

export { LANG_META, type AppLang };
