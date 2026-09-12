import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { bootstrapTheme } from "@/lib/theme-manager";
import { useCurrentUser } from "@/lib/session";
import { saveThemePreference } from "@/lib/api/social";
import { ignoreFailure } from "@/lib/errors/handle";

type Theme = "dark" | "light";
/** User's stored choice: an explicit theme, or "system" to follow the OS. */
export type ThemePreference = Theme | "system";

interface ThemeContextValue {
  /** Resolved theme actually applied to the DOM (system → OS value). */
  theme: Theme;
  /** What the user picked — "system" means "follow the OS". */
  preference: ThemePreference;
  /** Desktop quick-toggle: flips between light/dark, always sets an explicit preference. */
  toggleTheme: () => void;
  /** Explicit theme pick (kept for back-compat call sites). */
  setTheme: (theme: Theme) => void;
  /** Settings page: light / dark / system. */
  setPreference: (pref: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const PREF_KEY = "theme-preference";
/*
 * Признак осознанного выбора. `PREF_KEY` записывается при каждом монтировании
 * — по нему «выбирал ли человек тему на этом устройстве» не определить, там
 * всегда что-то лежит. Серверное значение подхватываем только там, где этой
 * отметки нет, то есть на новом устройстве; местный выбор оно не перебивает.
 */
const EXPLICIT_KEY = "theme-preference-explicit";
const LEGACY_KEY = "theme";

function systemPrefersDark(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function getInitialPreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(PREF_KEY);
  if (stored === "dark" || stored === "light" || stored === "system") return stored;
  // Legacy binary toggle left a bare "theme" key — honor it as an explicit
  // pick so returning users don't get silently switched to "system".
  const legacy = window.localStorage.getItem(LEGACY_KEY);
  if (legacy === "dark" || legacy === "light") return legacy;
  return "system";
}

function resolve(pref: ThemePreference): Theme {
  return pref === "system" ? (systemPrefersDark() ? "dark" : "light") : pref;
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.classList.toggle("dark", theme === "dark");
}

function markExplicit(): void {
  try {
    window.localStorage.setItem(EXPLICIT_KEY, "1");
  } catch {
    /* приватный режим: синхронизации не будет, тема останется местной */
  }
}

function wasChosenHere(): boolean {
  try {
    return window.localStorage.getItem(EXPLICIT_KEY) === "1";
  } catch {
    return false;
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(getInitialPreference);
  const [theme, setThemeState] = useState<Theme>(() => resolve(getInitialPreference()));
  const me = useCurrentUser();

  /*
   * Выбор пользователя — на сервер. Отказ гасим: тема уже применена локально,
   * синхронизация только догоняет, и ронять из-за неё нечего.
   */
  const choose = useCallback((next: ThemePreference) => {
    markExplicit();
    setPreferenceState(next);
    void saveThemePreference(next).catch(ignoreFailure("синхронизация темы"));
  }, []);

  /*
   * На устройстве без своего выбора берём тему из учётной записи. Первый кадр
   * при этом уже нарисован скриптом из `__root.tsx` по `localStorage` — ждать
   * ответа сервера ради темы значило бы моргать на каждой загрузке.
   */
  useEffect(() => {
    const fromServer = me?.themePreference;
    if (!fromServer || wasChosenHere()) return;
    if (fromServer !== "light" && fromServer !== "dark" && fromServer !== "system") return;
    markExplicit();
    setPreferenceState(fromServer);
  }, [me?.themePreference]);

  useEffect(() => {
    const resolved = resolve(preference);
    setThemeState(resolved);
    applyTheme(resolved);
    try {
      window.localStorage.setItem(PREF_KEY, preference);
      // Keep the legacy key in sync too (older code paths may still read it).
      window.localStorage.setItem(LEGACY_KEY, resolved);
    } catch {
      /* ignore */
    }
  }, [preference]);

  // Apply saved accent (admin Design System) on mount.
  useEffect(() => {
    bootstrapTheme();
  }, []);

  // Live-follow the OS only while preference is "system".
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    function onChange(e: MediaQueryListEvent) {
      setPreferenceState((prev) => {
        if (prev !== "system") return prev;
        const resolved: Theme = e.matches ? "dark" : "light";
        setThemeState(resolved);
        applyTheme(resolved);
        try {
          window.localStorage.setItem(LEGACY_KEY, resolved);
        } catch {
          /* ignore */
        }
        return prev;
      });
    }
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const toggleTheme = useCallback(() => {
    setPreferenceState((prev) => {
      const next: ThemePreference = resolve(prev) === "dark" ? "light" : "dark";
      markExplicit();
      void saveThemePreference(next).catch(ignoreFailure("синхронизация темы"));
      return next;
    });
  }, []);

  const setTheme = useCallback((next: Theme) => choose(next), [choose]);
  const setPreference = useCallback((pref: ThemePreference) => choose(pref), [choose]);

  return (
    <ThemeContext.Provider value={{ theme, preference, toggleTheme, setTheme, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
