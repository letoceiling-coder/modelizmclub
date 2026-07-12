import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { bootstrapTheme } from "@/lib/theme-manager";

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

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(getInitialPreference);
  const [theme, setThemeState] = useState<Theme>(() => resolve(getInitialPreference()));

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
  useEffect(() => { bootstrapTheme(); }, []);

  // Live-follow the OS only while preference is "system".
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    function onChange(e: MediaQueryListEvent) {
      setPreferenceState((prev) => {
        if (prev !== "system") return prev;
        const resolved: Theme = e.matches ? "dark" : "light";
        setThemeState(resolved);
        applyTheme(resolved);
        try { window.localStorage.setItem(LEGACY_KEY, resolved); } catch { /* ignore */ }
        return prev;
      });
    }
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const toggleTheme = useCallback(() => {
    setPreferenceState((prev) => (resolve(prev) === "dark" ? "light" : "dark"));
  }, []);

  const setTheme = useCallback((next: Theme) => setPreferenceState(next), []);
  const setPreference = useCallback((pref: ThemePreference) => setPreferenceState(pref), []);

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
