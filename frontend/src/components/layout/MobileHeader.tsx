import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, Search, Menu, Radio, Check, Languages, Heart, Clapperboard, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Logo } from "@/components/Logo";
import { useUnreadNotifications } from "@/lib/hooks/useUnreadNotifications";
import { setLocale, type Locale } from "@/lib/i18n";
import { useFeatureFlag } from "@/lib/config/featureFlags";
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
  DrawerTitle,
} from "@/components/ui/drawer";

const LANGS: { code: Locale; native: string; flag: string }[] = [
  { code: "ru", native: "Русский", flag: "🇷🇺" },
  { code: "en", native: "English", flag: "🇬🇧" },
  { code: "zh", native: "中文", flag: "🇨🇳" },
];

/**
 * Compact mobile header — brand on the left, max two context actions
 * (search + notifications) on the right, and a "more" button that opens a
 * bottom action sheet for the secondary actions (channels, theme, language).
 */
export function MobileHeader() {
  const { t } = useTranslation();
  const unread = useUnreadNotifications();

  return (
    <header
      className="lg:hidden sticky top-0 z-30"
      style={{
        paddingTop: "var(--safe-top)",
        background: "color-mix(in oklab, var(--background) 92%, transparent)",
        backdropFilter: "saturate(180%) blur(12px)",
        WebkitBackdropFilter: "saturate(180%) blur(12px)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div
        className="flex items-center justify-between gap-2 px-4"
        style={{ height: "var(--mobile-header-h)" }}
      >
        <Link to="/feed" className="inline-flex min-w-0 items-center" aria-label={t("pages.homeLink")}>
          <Logo size={34} />
        </Link>

        <div className="flex shrink-0 items-center gap-1">
          <Link
            to="/ads"
            aria-label="Поиск"
            className="grid h-10 w-10 place-items-center rounded-full transition-colors hover:bg-[var(--background-surface)]"
            style={{ color: "var(--foreground-70)" }}
          >
            <Search size={20} />
          </Link>

          <Link
            to="/favorites"
            aria-label="Избранное"
            className="grid h-10 w-10 place-items-center rounded-full transition-colors hover:bg-[var(--background-surface)]"
            style={{ color: "var(--foreground-70)" }}
          >
            <Heart size={20} />
          </Link>

          <Link
            to="/notifications"
            aria-label="Уведомления"
            className="grid h-10 w-10 place-items-center rounded-full transition-colors hover:bg-[var(--background-surface)]"
            style={{ color: "var(--foreground-70)" }}
          >
            <span className="relative inline-flex">
              <Bell size={20} />
              {unread > 0 && (
                <span
                  className="absolute -right-[6px] -top-[5px] grid min-w-[15px] place-items-center rounded-full px-[3px]"
                  style={{
                    height: 15,
                    fontSize: 9,
                    fontWeight: 700,
                    color: "#fff",
                    background: "var(--accent)",
                    boxShadow: "0 0 0 2px var(--background)",
                  }}
                >
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </span>
          </Link>

          <MoreMenu />
        </div>
      </div>
    </header>
  );
}

function MoreMenu() {
  const [open, setOpen] = useState(false);
  const { i18n } = useTranslation();
  const lang = (i18n.language as Locale) || "ru";
  const reviewsEnabled = useFeatureFlag("reviewsEnabled");

  return (
    <Drawer open={open} onOpenChange={setOpen} shouldScaleBackground={false}>
      <DrawerTrigger asChild>
        <button
          aria-label="Ещё"
          className="grid h-10 w-10 place-items-center rounded-full transition-colors hover:bg-[var(--background-surface)]"
          style={{ color: "var(--foreground-70)" }}
        >
          <Menu size={20} />
        </button>
      </DrawerTrigger>

      <DrawerContent className="pb-[calc(var(--safe-bottom)+12px)]">
        <div className="px-4 pt-3">
          <DrawerTitle className="text-base">Меню</DrawerTitle>
        </div>

        <div className="mt-2 flex flex-col px-2 pb-1">
          {/* Channels */}
          <Link
            to="/channels"
            onClick={() => setOpen(false)}
            className="flex min-h-[52px] items-center gap-3 rounded-[var(--r-card-sm)] px-3 transition-colors hover:bg-[var(--background-surface)]"
            style={{ color: "var(--foreground)" }}
          >
            <Radio size={20} style={{ color: "var(--foreground-70)" }} />
            <span className="text-[15px] font-medium">Каналы</span>
          </Link>

          {/* Reviews — Sidebar-only section, mirrored here for mobile reachability */}
          {reviewsEnabled && (
            <Link
              to="/reviews"
              onClick={() => setOpen(false)}
              className="flex min-h-[52px] items-center gap-3 rounded-[var(--r-card-sm)] px-3 transition-colors hover:bg-[var(--background-surface)]"
              style={{ color: "var(--foreground)" }}
            >
              <Clapperboard size={20} style={{ color: "var(--foreground-70)" }} />
              <span className="text-[15px] font-medium">Обзоры</span>
            </Link>
          )}

          {/* Settings */}
          <Link
            to="/settings"
            onClick={() => setOpen(false)}
            className="flex min-h-[52px] items-center gap-3 rounded-[var(--r-card-sm)] px-3 transition-colors hover:bg-[var(--background-surface)]"
            style={{ color: "var(--foreground)" }}
          >
            <Settings size={20} style={{ color: "var(--foreground-70)" }} />
            <span className="text-[15px] font-medium">Настройки</span>
          </Link>

          {/* Language */}
          <div className="mt-2 px-3 pb-1 pt-2">
            <span
              className="inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide"
              style={{ color: "var(--foreground-50)" }}
            >
              <Languages size={14} /> Язык
            </span>
          </div>
          {LANGS.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => {
                setLocale(l.code);
                setOpen(false);
              }}
              className="flex min-h-[52px] items-center gap-3 rounded-[var(--r-card-sm)] px-3 text-left transition-colors hover:bg-[var(--background-surface)]"
              style={{ color: "var(--foreground)" }}
            >
              <span style={{ fontSize: 18 }}>{l.flag}</span>
              <span className="flex-1 text-[15px] font-medium">{l.native}</span>
              {l.code === lang && <Check size={16} style={{ color: "var(--accent)" }} />}
            </button>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
