import { Link, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Newspaper, Users2, Radio, MessageSquare, Megaphone, UserPlus, ClipboardList, Plus, ShoppingBag, ExternalLink } from "lucide-react";
import { ROUTES, getActiveSection } from "@/lib/routes";
import { useStore, selectors } from "@/lib/store";
import { FeedbackDialog } from "@/components/feedback/FeedbackDialog";

interface Item {
  to: "/feed" | "/ads" | "/ads/new" | "/my-ads" | "/communities" | "/channels" | "/messenger" | "/friends";
  labelKey: string;
  icon: typeof Newspaper;
  section: string;
  authOnly?: boolean;
}

const items: Item[] = [
  { to: ROUTES.feed,         labelKey: "nav.feed",     icon: Newspaper,     section: "feed" },
  { to: ROUTES.ads,          labelKey: "nav.catalog",  icon: Megaphone,     section: "ads" },
  { to: ROUTES.adCreate,     labelKey: "nav.adCreate", icon: Plus,          section: "ads" },
  { to: ROUTES.myAds,        labelKey: "nav.myAds",    icon: ClipboardList, section: "my-ads", authOnly: true },
  { to: ROUTES.communities,  labelKey: "nav.communities", icon: Users2,     section: "communities" },
  { to: ROUTES.channels,     labelKey: "nav.channels", icon: Radio,         section: "channels" },
  { to: ROUTES.messenger,    labelKey: "nav.messenger", icon: MessageSquare, section: "messenger" },
  { to: ROUTES.friends,      labelKey: "nav.friends",  icon: UserPlus,      section: "friends" },
];

export function Sidebar({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const activeSection = getActiveSection(pathname);
  const me = useStore(selectors.currentUser);
  const { t } = useTranslation();
  const isGuest = me.id === "guest";

  const fullInner = (
    <div className="h-full space-y-1 overflow-y-auto overflow-x-hidden py-4" style={{ scrollbarWidth: "none" }}>
      <nav className="space-y-0.5">
        {items.map(({ to, labelKey, icon: Icon, section, authOnly }) => {
          if (authOnly && isGuest) return null;
          const active = activeSection === section;
          return (
            <Link
              key={to}
              to={to}
              className={`relative flex items-center gap-3 rounded-lg pl-3 pr-3 py-2 text-sm transition-colors ${
                active ? "bg-accent/10 text-primary font-medium" : "text-foreground hover:bg-muted"
              }`}
              style={
                active
                  ? { borderLeft: "3px solid var(--accent)", paddingLeft: 9, background: "var(--accent-soft)", color: "var(--accent)" }
                  : undefined
              }
            >
              <Icon className="h-5 w-5" />
              {t(labelKey)}
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

      {/* Compact subscription status — управление только на /subscription */}
      <Link
        to={ROUTES.subscription}
        className="mt-4 flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-xs transition-colors hover:bg-muted"
      >
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--success, #22c55e)" }} />
        <span className="font-medium" style={{ color: "var(--foreground-70)" }}>{t("common.subscriptionActive")}</span>
      </Link>

      <div className="mt-2">
        <FeedbackDialog />
      </div>
    </div>
  );

  if (!collapsed) {
    return <aside className="hidden lg:block w-60 shrink-0">{fullInner}</aside>;
  }

  // collapsed (/ads): full sidebar on lg–xl, icon rail on xl+
  return (
    <>
      <aside className="hidden lg:block xl:hidden w-60 shrink-0">{fullInner}</aside>
      <aside className="hidden xl:flex w-16 shrink-0 flex-col">
        <nav className="flex flex-col items-center gap-1 py-4">
          {items.map(({ to, labelKey, icon: Icon, section, authOnly }) => {
            if (authOnly && isGuest) return null;
            const active = activeSection === section;
            return (
              <Link
                key={to}
                to={to}
                title={t(labelKey)}
                aria-label={t(labelKey)}
                className="grid h-10 w-10 place-items-center rounded-lg transition-colors hover:bg-muted"
                style={active ? { background: "var(--accent-soft)", color: "var(--accent)" } : { color: "var(--foreground-70)" }}
              >
                <Icon className="h-5 w-5" />
              </Link>
            );
          })}
          <a
            href="https://modelizm23.ru"
            target="_blank"
            rel="noreferrer"
            title={t("nav.market")}
            aria-label={t("nav.market")}
            className="grid h-10 w-10 place-items-center rounded-lg transition-colors hover:bg-muted"
            style={{ color: "var(--foreground-70)" }}
          >
            <ShoppingBag className="h-5 w-5" />
          </a>
        </nav>
      </aside>
    </>
  );
}
