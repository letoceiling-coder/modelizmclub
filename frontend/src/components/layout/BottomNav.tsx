import { Link, useRouterState } from "@tanstack/react-router";
import { Newspaper, Users2, MessageSquare, Megaphone, User, UserPlus } from "lucide-react";
import { Icon as SlotIcon } from "@/components/ui/Icon";
import { navSlotKey } from "@/lib/icon-slots";
import { getActiveSection } from "@/lib/routes";
import { useStore } from "@/lib/store";
import { useFeatureFlag } from "@/lib/config/featureFlags";

type Item = {
  to: "/feed" | "/communities" | "/messenger" | "/ads" | "/profile" | "/friends";
  label: string;
  icon: typeof Newspaper;
  section: string;
};

const ALL_ITEMS: Item[] = [
  { to: "/feed", label: "Лента", icon: Newspaper, section: "feed" },
  { to: "/communities", label: "Сообщества", icon: Users2, section: "communities" },
  { to: "/messenger", label: "Сообщения", icon: MessageSquare, section: "messenger" },
  { to: "/ads", label: "Объявления", icon: Megaphone, section: "ads" },
  { to: "/profile", label: "Профиль", icon: User, section: "profile" },
  { to: "/friends", label: "Друзья", icon: UserPlus, section: "friends" },
];
export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const activeSection = getActiveSection(pathname);
  const communitiesEnabled = useFeatureFlag("communitiesEnabled");
  // Обзоры (reviews) lives in the mobile "…" menu, not the tab bar; Друзья
  // takes the tab-bar slot. Only communities remains flag-gated here.
  const ITEMS = ALL_ITEMS.filter((i) => i.to !== "/communities" || communitiesEnabled);
  // Aggregate unread messages — live via the realtime store. Stays 0 until
  // conversations are loaded, so the badge only shows when data exists.
  const unreadMessages = useStore((s) =>
    Object.values(s.dialogs).reduce((n, d) => n + (d.unread ?? 0), 0),
  );

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40"
      style={{
        background: "color-mix(in oklab, var(--background) 94%, transparent)",
        backdropFilter: "saturate(180%) blur(14px)",
        WebkitBackdropFilter: "saturate(180%) blur(14px)",
        borderTop: "1px solid var(--border)",
        paddingBottom: "var(--safe-bottom)",
      }}
    >
      <ul
        className="grid items-stretch"
        style={{ height: "var(--bottom-nav-h)", gridTemplateColumns: `repeat(${ITEMS.length}, 1fr)` }}
      >
        {ITEMS.map((it) => (
          <NavTab
            key={it.to}
            item={it}
            active={activeSection === it.section}
            badge={it.section === "messenger" ? unreadMessages : 0}
          />
        ))}
      </ul>
    </nav>
  );
}

function NavTab({ item, active, badge }: { item: Item; active: boolean; badge: number }) {
  return (
    <li className="flex">
      <Link
        to={item.to}
        className="flex flex-1 flex-col items-center justify-center gap-[3px] transition-colors duration-150"
        style={{ color: active ? "var(--accent)" : "var(--foreground-50)" }}
      >
        <span className="relative inline-flex">
          <SlotIcon slot={navSlotKey(item.section)} inheritColor size={22} strokeWidth={active ? 2.4 : 2} />
          {badge > 0 && (
            <span
              className="absolute -right-[7px] -top-[5px] grid min-w-[15px] place-items-center rounded-full px-[3px] tabular-nums"
              style={{
                height: 15,
                fontSize: 9,
                fontWeight: 700,
                color: "var(--accent-foreground)",
                background: "var(--accent)",
                boxShadow: "0 0 0 2px var(--background)",
              }}
            >
              {badge > 9 ? "9+" : badge}
            </span>
          )}
        </span>
        <span
          className="font-medium"
          style={{ fontSize: 10.5, letterSpacing: "0.01em", lineHeight: 1 }}
        >
          {item.label}
        </span>
      </Link>
    </li>
  );
}
