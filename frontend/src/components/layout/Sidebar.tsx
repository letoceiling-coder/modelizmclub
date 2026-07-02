import { Link, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Newspaper, Users2, Radio, MessageSquare, Megaphone, UserPlus, User, ShoppingBag, HelpCircle, Crown, ExternalLink, Bell } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/messenger/LanguageSwitcher";
import { ROUTES, getActiveSection } from "@/lib/routes";
import { useUnreadNotifications } from "@/lib/hooks/useUnreadNotifications";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { FeedbackDialog } from "@/components/feedback/FeedbackDialog";

interface Item {
  to: "/feed" | "/communities" | "/channels" | "/messenger" | "/ads" | "/friends" | "/notifications" | "/profile" | "/subscription" | "/help";
  labelKey: string;
  icon: typeof Newspaper;
  section: string;
}

const items: Item[] = [
  { to: ROUTES.feed,         labelKey: "nav.feed",          icon: Newspaper,    section: "feed" },
  { to: ROUTES.communities,  labelKey: "nav.communities",   icon: Users2,       section: "communities" },
  { to: ROUTES.channels,     labelKey: "nav.channels",      icon: Radio,        section: "channels" },
  { to: ROUTES.messenger,    labelKey: "nav.messenger",     icon: MessageSquare, section: "messenger" },
  { to: ROUTES.ads,          labelKey: "nav.ads",           icon: Megaphone,    section: "ads" },
  { to: ROUTES.friends,      labelKey: "nav.friends",       icon: UserPlus,     section: "friends" },
  { to: ROUTES.notifications, labelKey: "nav.notifications", icon: Bell,        section: "notifications" },
  { to: ROUTES.profile,      labelKey: "nav.profile",       icon: User,         section: "profile" },
  { to: ROUTES.subscription, labelKey: "nav.subscription",  icon: Crown,        section: "subscription" },
  { to: ROUTES.help,         labelKey: "nav.help",          icon: HelpCircle,   section: "help" },
];

export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const activeSection = getActiveSection(pathname);
  const unread = useUnreadNotifications();
  const { t } = useTranslation();
  return (
    <aside className="hidden lg:block w-60 shrink-0">
      {/* sticky: keeps sidebar in view while center column scrolls */}
      {/* h-full: parent <aside> is stretched to 100dvh by AppLayout's items-stretch.
           No sticky needed — the shell itself is overflow:hidden on desktop. */}
      <div className="h-full space-y-1 overflow-y-auto overflow-x-hidden py-4" style={{ scrollbarWidth: "none" }}>
        <div className="flex items-center justify-between gap-2 px-3 pb-1">
          {/* logo takes the flexible slot and shrinks; controls stay fixed 40px each */}
          <Link to={ROUTES.feed} className="flex min-w-0 flex-1 items-center overflow-hidden"><Logo size={40} /></Link>
          <div className="flex shrink-0 items-center gap-1">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
        <p className="px-3 pb-3 text-[11px] italic" style={{ color: "var(--foreground-50)" }}>
          Моделизм — это жизнь, остальное детали
        </p>
        <nav className="space-y-0.5">
          {items.map(({ to, labelKey, icon: Icon, section }) => {
            const active = activeSection === section;
            return (
              <Link
                key={to}
                to={to}
                className={`relative flex items-center gap-3 rounded-lg pl-3 pr-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-accent/10 text-primary font-medium"
                    : "text-foreground hover:bg-muted"
                }`}
                style={
                  active
                    ? {
                        borderLeft: "3px solid var(--accent)",
                        paddingLeft: 9,
                        background: "var(--accent-soft)",
                        color: "var(--accent)",
                      }
                    : undefined
                }
              >
                <Icon className="h-5 w-5" />
                {t(labelKey)}
                {section === "notifications" && unread > 0 && (
                  <span
                    className="ml-auto grid min-w-[18px] place-items-center rounded-full px-[5px] text-[10px] font-bold text-[var(--accent-foreground)]"
                    style={{ height: 18, background: "var(--accent)" }}
                  >
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>
            );
          })}
          <a
            href="https://modelizm23.ru"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-muted"
          >
            <span className="flex items-center gap-3">
              <ShoppingBag className="h-5 w-5" />
              {t("nav.market")}
            </span>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
          </a>
        </nav>
        <div className="mt-4 rounded-xl border bg-card p-3">
          <div className="text-xs text-muted-foreground">{t("nav.subscription")}</div>
          <div className="mt-1 text-sm font-medium">{t("common.subscriptionActive")}</div>
          <Link to={ROUTES.subscription} className="mt-2 inline-block text-xs text-primary hover:underline">
            {t("common.manage")}
          </Link>
        </div>
        <div className="mt-2">
          <FeedbackDialog />
        </div>
        <div className="mt-1 px-1">
          <LogoutButton />
        </div>
      </div>
    </aside>
  );
}
