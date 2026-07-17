import { useEffect, useState, type ReactNode } from "react";
import { I18nextProvider } from "react-i18next";

import i18n, { readStoredLocale, setLocale } from "@/lib/i18n";

const FADE_MS = 160;

export { FADE_MS };

/**
 * Brief opacity dip on `languageChanged` so switching languages fades the
 * page content instead of snapping to the new text instantly. Intentionally
 * scoped to page content only (see __root.tsx) — overlays like toasts/call
 * screens must stay unaffected.
 */
export function useLocaleFade(): boolean {
  const [fading, setFading] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const handler = () => {
      setFading(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setFading(false), FADE_MS);
    };
    i18n.on("languageChanged", handler);
    return () => {
      i18n.off("languageChanged", handler);
      if (timer) clearTimeout(timer);
    };
  }, []);
  return fading;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = readStoredLocale();
    if (stored !== i18n.language) {
      setLocale(stored);
    } else if (typeof document !== "undefined") {
      document.documentElement.setAttribute("lang", stored);
    }
    setReady(true);
  }, []);

  // `ready` only forces a re-render once the stored locale is applied; the tree
  // still renders immediately in Russian for SSR/first paint.
  void ready;

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
