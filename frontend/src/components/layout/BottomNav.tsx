import { Link, useRouterState } from "@tanstack/react-router";
import { Newspaper, Users2, MessageSquare, Megaphone, User } from "lucide-react";
import { getActiveSection } from "@/lib/routes";
import { ROUTE_SEARCH } from "@/lib/route-search";
import { useTranslation } from "@/lib/i18n";

const ITEM_KEYS = [
  { to: "/feed", search: ROUTE_SEARCH.feed, labelKey: "nav.feed", icon: Newspaper, section: "feed" },
  { to: "/communities", labelKey: "nav.communities", icon: Users2, section: "communities" },
  { to: "/messenger", search: ROUTE_SEARCH.messenger, labelKey: "nav.messages", icon: MessageSquare, section: "messenger" },
  { to: "/ads", labelKey: "nav.ads", icon: Megaphone, section: "ads" },
  { to: "/profile", labelKey: "nav.profile", icon: User, section: "profile" },
] as const;

export function BottomNav() {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const activeSection = getActiveSection(pathname);

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40"
      style={{
        background: "color-mix(in oklab, var(--background) 94%, transparent)",
        backdropFilter: "saturate(180%) blur(14px)",
        WebkitBackdropFilter: "saturate(180%) blur(14px)",
        borderTop: "1px solid var(--border)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <ul className="grid grid-cols-5 items-center" style={{ height: 60 }}>
        {ITEM_KEYS.map((it) => (
          <NavTab key={it.to} item={it} label={t(it.labelKey)} active={activeSection === it.section} />
        ))}
      </ul>
    </nav>
  );
}

function NavTab({
  item,
  label,
  active,
}: {
  item: (typeof ITEM_KEYS)[number];
  label: string;
  active: boolean;
}) {
  const Icon = item.icon;
  return (
    <li>
      <Link
        to={item.to}
        {...("search" in item && item.search ? { search: item.search } : {})}
        className="flex h-full flex-col items-center justify-center gap-[3px] transition-colors duration-150"
        style={{
          color: active ? "var(--accent)" : "var(--foreground-50)",
          height: 60,
        }}
      >
        <Icon size={22} strokeWidth={active ? 2.4 : 2} />
        <span className="font-medium" style={{ fontSize: 10.5, letterSpacing: "0.01em", lineHeight: 1 }}>
          {label}
        </span>
      </Link>
    </li>
  );
}
