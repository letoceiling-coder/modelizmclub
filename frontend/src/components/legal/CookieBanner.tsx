import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  getAnonymousCookieKey,
  hasCookieChoice,
  loadAdsIfConsented,
  loadAnalyticsIfConsented,
  writeCookiePrefs,
} from "@/lib/cookie-consent";
import { saveCookiePreferences } from "@/lib/api/legal";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [configure, setConfigure] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [ads, setAds] = useState(false);

  useEffect(() => {
    setVisible(!hasCookieChoice());
  }, []);

  async function persist(analyticsOn: boolean, adsOn: boolean) {
    writeCookiePrefs({ analytics: analyticsOn, ads: adsOn });
    try {
      await saveCookiePreferences({
        anonymous_key: getAnonymousCookieKey(),
        analytics: analyticsOn,
        ads: adsOn,
      });
    } catch {
      /* local prefs still apply */
    }
    loadAnalyticsIfConsented();
    loadAdsIfConsented();
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[200] border-t px-4 py-4 shadow-lg"
      style={{ background: "var(--background-surface)", borderColor: "var(--border)" }}
      role="dialog"
      aria-label="Настройки cookie"
    >
      <div className="mx-auto flex max-w-[960px] flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-[640px] text-sm" style={{ color: "var(--foreground-70)" }}>
          <div className="font-semibold" style={{ color: "var(--foreground)" }}>
            Мы используем cookie
          </div>
          <p className="mt-1 leading-relaxed">
            Необходимые cookie нужны для работы сайта. Аналитика и реклама — только с вашего согласия.{" "}
            <Link to="/legal/privacy" className="underline" style={{ color: "var(--accent)" }}>
              Политика конфиденциальности
            </Link>
          </p>
          {configure && (
            <div className="mt-3 space-y-2 rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
              <label className="flex items-center gap-2 opacity-70">
                <input type="checkbox" checked disabled /> Необходимые (всегда включены)
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} /> Аналитика
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={ads} onChange={(e) => setAds(e.target.checked)} /> Реклама
              </label>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {configure ? (
            <Button type="button" onClick={() => persist(analytics, ads)}>
              Сохранить
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => persist(false, false)}>
                Отказаться
              </Button>
              <Button type="button" variant="outline" onClick={() => setConfigure(true)}>
                Настроить
              </Button>
              <Button type="button" onClick={() => persist(true, true)}>
                Принять все
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
