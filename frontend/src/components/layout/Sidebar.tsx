import { Link, useRouterState } from "@tanstack/react-router";
import { Newspaper, Users2, Radio, MessageSquare, Megaphone, UserPlus, User, ShoppingBag, HelpCircle, Crown, ExternalLink, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { ROUTES, getActiveSection } from "@/lib/routes";
import { ROUTE_SEARCH } from "@/lib/route-search";
import { useTranslation } from "@/lib/i18n";
import { useAuth } from "@/components/auth/AuthProvider";

const itemKeys = [
  { to: ROUTES.feed, search: ROUTE_SEARCH.feed, labelKey: "nav.feed", icon: Newspaper, section: "feed" },
  { to: ROUTES.communities, labelKey: "nav.communities", icon: Users2, section: "communities" },
  { to: ROUTES.channels, labelKey: "nav.channels", icon: Radio, section: "channels" },
  { to: ROUTES.messenger, search: ROUTE_SEARCH.messenger, labelKey: "nav.messenger", icon: MessageSquare, section: "messenger" },
  { to: ROUTES.ads, labelKey: "nav.ads", icon: Megaphone, section: "ads" },
  { to: ROUTES.friends, labelKey: "nav.friends", icon: UserPlus, section: "friends" },
  { to: ROUTES.profile, labelKey: "nav.profile", icon: User, section: "profile" },
  { to: ROUTES.subscription, search: ROUTE_SEARCH.subscription, labelKey: "nav.subscription", icon: Crown, section: "subscription" },
  { to: ROUTES.help, labelKey: "nav.help", icon: HelpCircle, section: "help" },
] as const;

export function Sidebar() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isStaff = user?.role === "admin" || user?.role === "moderator";
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const activeSection = getActiveSection(pathname);
  return (
    <aside className="hidden min-w-0 lg:block">
      <div className="sticky top-4 z-20 max-h-[calc(100dvh-2rem)] space-y-1 overflow-y-auto overscroll-contain">
        <div className="flex items-center justify-between px-3 py-3">
          <Link to={ROUTES.feed} search={ROUTE_SEARCH.feed}><Logo /></Link>
          <div className="flex items-center gap-1">
            <LanguageSwitcher compact showFooter={false} />
            <ThemeToggle />
          </div>
        </div>
        <nav className="space-y-0.5">
          {itemKeys.map((item) => {
            const { to, labelKey, icon: Icon, section } = item;
            const search = "search" in item ? item.search : undefined;
            const active = activeSection === section;
            return (
              <Link
                key={to}
                to={to}
                {...(search ? { search } : {})}
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
                <Icon className="h-4 w-4" />
                {t(labelKey)}
              </Link>
            );
          })}
          {isStaff && (
            <Link
              to={ROUTES.admin}
              className="relative flex items-center gap-3 rounded-lg pl-3 pr-3 py-2 text-sm transition-colors text-foreground hover:bg-muted"
              style={
                activeSection === "admin"
                  ? { borderLeft: "3px solid var(--accent)", paddingLeft: 9, background: "var(--accent-soft)", color: "var(--accent)" }
                  : undefined
              }
            >
              <ShieldCheck className="h-4 w-4" />
              {t("nav.admin")}
            </Link>
          )}
          <a
            href="https://modelizm23.ru"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-muted"
          >
            <span className="flex items-center gap-3">
              <ShoppingBag className="h-4 w-4" />
              {t("common.market")}
            </span>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
          </a>
        </nav>
        <div className="mt-4 rounded-xl border bg-card p-3">
          <div className="text-xs text-muted-foreground">{t("common.subscription")}</div>
          <div className="mt-1 text-sm font-medium">{t("common.subscriptionActive")}</div>
          <Link to={ROUTES.subscription} search={ROUTE_SEARCH.subscription} className="mt-2 inline-block text-xs text-primary hover:underline">
            {t("common.manage")}
          </Link>
        </div>
      </div>
    </aside>
  );
}
