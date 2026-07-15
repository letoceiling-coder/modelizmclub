import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, Search, Menu, Check, Languages, Heart, ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Logo } from "@/components/Logo";
import { useUnreadNotifications } from "@/lib/hooks/useUnreadNotifications";
import { setLocale, type Locale } from "@/lib/i18n";
import { useFeatureFlag } from "@/lib/config/featureFlags";
import { useStore, selectors } from "@/lib/store";
import { FeedbackDialog } from "@/components/feedback/FeedbackDialog";
import { MobileSearchOverlay } from "@/components/layout/MobileSearchOverlay";
import { MOBILE_MENU_SECTIONS, assertMobileNavCoverage } from "@/lib/nav";
import { Icon as SlotIcon } from "@/components/ui/Icon";
import { navSlotKey } from "@/lib/icon-slots";
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
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <>
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
          <button
            type="button"
            aria-label="Поиск"
            onClick={() => setSearchOpen(true)}
            className="grid h-10 w-10 place-items-center rounded-full transition-colors hover:bg-[var(--background-surface)]"
            style={{ color: "var(--foreground-70)" }}
          >
            <Search size={20} />
          </button>

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
                  className="absolute -right-[6px] -top-[5px] grid min-w-[15px] place-items-center rounded-full px-[3px] tabular-nums"
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
      <MobileSearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}

function MoreMenu() {
  const [open, setOpen] = useState(false);
  const { i18n } = useTranslation();
  const lang = (i18n.language as Locale) || "ru";
  const reviewsEnabled = useFeatureFlag("reviewsEnabled");
  const communitiesEnabled = useFeatureFlag("communitiesEnabled");
  const marketEnabled = useFeatureFlag("marketEnabled");
  const isGuest = useStore(selectors.currentUser).id === "guest";

  // Dev-time guarantee that every section is reachable on mobile (no-op in prod).
  useEffect(() => { assertMobileNavCoverage(); }, []);

  const flags = { reviewsEnabled, communitiesEnabled, marketEnabled } as const;
  const visible = MOBILE_MENU_SECTIONS.filter(
    (s) => (!s.authOnly || !isGuest) && (!s.flag || flags[s.flag]),
  );
  const content = visible.filter((s) => s.group === "content");
  const account = visible.filter((s) => s.group === "account");

  const rowClass =
    "flex min-h-[52px] items-center gap-3 rounded-[var(--r-card-sm)] px-3 transition-colors hover:bg-[var(--background-surface)]";

  const renderRow = (s: (typeof MOBILE_MENU_SECTIONS)[number]) => {
    const inner = (
      <>
        {/* inheritColor wrapper keeps the fixed foreground-70 tint (burger icons
            aren't state-coloured) while making the glyph override-aware. */}
        <span style={{ display: "inline-flex", color: "var(--foreground-70)" }}>
          <SlotIcon slot={navSlotKey(s.key)} inheritColor size={20} />
        </span>
        <span className="flex-1 text-[15px] font-medium">{s.label}</span>
        {s.href && <ExternalLink size={15} style={{ color: "var(--foreground-50)" }} />}
      </>
    );
    if (s.href) {
      return (
        <a key={s.key} href={s.href} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)} className={rowClass} style={{ color: "var(--foreground)" }}>
          {inner}
        </a>
      );
    }
    return (
      <Link key={s.key} to={s.to!} onClick={() => setOpen(false)} className={rowClass} style={{ color: "var(--foreground)" }}>
        {inner}
      </Link>
    );
  };

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

        <div className="mt-2 flex max-h-[70dvh] flex-col overflow-y-auto px-2 pb-1">
          {content.map(renderRow)}

          <div className="my-1 h-px" style={{ background: "var(--border)" }} />
          {account.map(renderRow)}
          {/* Feedback is a dialog, not a route — lives in the account group. */}
          <div onClick={() => setOpen(false)}>
            <FeedbackMenuRow />
          </div>

          {/* Language */}
          <div className="mt-1 px-3 pb-1 pt-2">
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

/** Feedback dialog styled as a menu row (matches the min-h-[52px] rows above). */
function FeedbackMenuRow() {
  return (
    <div className="[&_button]:min-h-[52px] [&_button]:gap-3 [&_button]:rounded-[var(--r-card-sm)] [&_button]:px-3 [&_button]:py-0 [&_button]:text-[15px] [&_svg]:h-5 [&_svg]:w-5 [&_svg]:text-[var(--foreground-70)]">
      <FeedbackDialog />
    </div>
  );
}
