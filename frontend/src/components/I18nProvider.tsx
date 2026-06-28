import { useEffect, useState, type ReactNode } from "react";
import { I18nextProvider } from "react-i18next";

import i18n, { readStoredLocale, setLocale } from "@/lib/i18n";

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
