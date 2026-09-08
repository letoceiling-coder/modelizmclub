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

/**
 * Полоса согласия на cookie.
 *
 * Свёрнутое состояние — одна строка высотой 56–64. До 06.09 здесь был блок в
 * 225 px: заголовок, абзац в две строки и три кнопки, которые на телефоне
 * вставали колонкой. Замер на 375×812: вместе с шапкой страницы и нижней
 * навигацией под содержимое оставалось 216 px — 27 % экрана. Он же оказывался
 * LCP-элементом на страницах сообщества и канала, где над сгибом нет крупной
 * картинки: браузер считал самым большим отрисованным элементом абзац этого
 * баннера.
 *
 * Категории согласия — за «Настроить». Разворачиваются только по нажатию,
 * поэтому свёрнутая высота не зависит от их числа.
 *
 * «Отказаться» оставлена в свёрнутом состоянии рядом с «Принять»: согласие,
 * которое нельзя отклонить так же просто, как дать, — это не согласие.
 */
export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [hiding, setHiding] = useState(false);
  const [configure, setConfigure] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [ads, setAds] = useState(false);

  useEffect(() => {
    setVisible(!hasCookieChoice());
  }, []);

  async function persist(analyticsOn: boolean, adsOn: boolean) {
    writeCookiePrefs({ analytics: analyticsOn, ads: adsOn });
    setHiding(true);
    window.setTimeout(() => setVisible(false), 280);
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
  }

  if (!visible) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[var(--z-banner)] border-t shadow-lg max-lg:bottom-[var(--bottom-nav-space)]"
      style={{
        background: "var(--background-surface)",
        borderColor: "var(--border)",
        opacity: hiding ? 0 : 1,
        transform: hiding ? "translateY(12px)" : "translateY(0)",
        transition: "opacity 280ms ease, transform 280ms ease",
        pointerEvents: hiding ? "none" : "auto",
      }}
      data-cookie-banner=""
      role="dialog"
      aria-label="Настройки cookie"
    >
      <div className="mx-auto max-w-[960px] px-4">
        {/*
          Одна строка: текст слева, две решающие кнопки справа. Текст может
          занять две строчки по 16 — это всё равно ниже кнопки, и высота
          полосы держится на 56.

          «Настроить» стоит ссылкой внутри текста, а не третьей кнопкой:
          три подписи рядом занимают около 240 px, на 375 текст рядом с ними
          сжимался до сотни, переносился, и полоса вырастала до 89. Решение
          принимают «Отказаться» и «Принять» — им и оставлены полные 44 px
          хит-зоны, как требует адаптив.
        */}
        <div className="flex min-h-[56px] items-center gap-[12px] py-[6px]">
          <p
            className="min-w-0 flex-1 text-[12px] leading-[16px] sm:text-[13px]"
            style={{ color: "var(--foreground-70)" }}
          >
            Мы используем cookie.{" "}
            <Link
              to="/legal/$slug"
              params={{ slug: "privacy" }}
              className="underline"
              style={{ color: "var(--accent)" }}
            >
              Политика
            </Link>
            {" · "}
            <button
              type="button"
              className="underline"
              style={{ color: "var(--accent)" }}
              onClick={() => setConfigure((v) => !v)}
              aria-expanded={configure}
            >
              Настроить
            </button>
          </p>
          <div className="flex shrink-0 items-center gap-[8px]">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-[44px] px-[10px] text-[13px]"
              onClick={() => persist(false, false)}
            >
              Отказаться
            </Button>
            {/*
              Свёрнутая полоса: «Принять» — это согласие на всё, как и раньше
              называлось «Принять все». Развёрнутая: сохраняет отмеченное,
              иначе кнопка молча отменяла бы только что поставленные галочки.
            */}
            <Button
              type="button"
              size="sm"
              className="h-[44px] px-[14px] text-[13px]"
              onClick={() => persist(configure ? analytics : true, configure ? ads : true)}
            >
              Принять
            </Button>
          </div>
        </div>

        {configure && (
          <div
            className="mb-[12px] space-y-[8px] rounded-[10px] border p-[12px] text-[13px]"
            style={{ borderColor: "var(--border)" }}
          >
            <label className="flex items-center gap-[8px] opacity-70">
              <input type="checkbox" checked disabled /> Необходимые — всегда включены
            </label>
            <label className="flex items-center gap-[8px]">
              <input
                type="checkbox"
                checked={analytics}
                onChange={(e) => setAnalytics(e.target.checked)}
              />{" "}
              Аналитика
            </label>
            <label className="flex items-center gap-[8px]">
              <input type="checkbox" checked={ads} onChange={(e) => setAds(e.target.checked)} />{" "}
              Реклама
            </label>
            <p className="pt-[2px]" style={{ color: "var(--foreground-50)" }}>
              «Принять» сохранит отмеченное.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
