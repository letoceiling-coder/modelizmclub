import { Link, useRouterState } from "@tanstack/react-router";
import { Newspaper, Users2, MessageSquare, Megaphone, User, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Icon as SlotIcon } from "@/components/ui/Icon";
import { navSlotKey } from "@/lib/icon-slots";
import { getActiveSection, ROUTES } from "@/lib/routes";
import { scrollSectionToTop } from "@/lib/scroll-top";
import { useStore, selectors } from "@/lib/store";
import { useFeatureFlag } from "@/lib/config/featureFlags";
import { GuestGuardLink } from "@/components/access/GuestGuardLink";
import { NAV_ROUTE_TO_ACTION } from "@/lib/feed-guest-access/routes";

type Item = {
  to: "/feed" | "/communities" | "/messenger" | "/ads" | "/profile" | "/friends";
  labelKey: string;
  icon: typeof Newspaper;
  section: string;
};

const ALL_ITEMS: Item[] = [
  { to: "/feed", labelKey: "nav.feed", icon: Newspaper, section: "feed" },
  { to: "/communities", labelKey: "nav.communities", icon: Users2, section: "communities" },
  { to: "/messenger", labelKey: "nav.messagesTab", icon: MessageSquare, section: "messenger" },
  { to: "/ads", labelKey: "nav.ads", icon: Megaphone, section: "ads" },
  { to: "/profile", labelKey: "nav.profile", icon: User, section: "profile" },
  { to: "/friends", labelKey: "nav.friends", icon: UserPlus, section: "friends" },
];
export function BottomNav() {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const activeSection = getActiveSection(pathname);
  const communitiesEnabled = useFeatureFlag("communitiesEnabled");
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
        style={{
          height: "var(--bottom-nav-h)",
          gridTemplateColumns: `repeat(${ITEMS.length}, 1fr)`,
        }}
      >
        {ITEMS.map((it) => (
          <NavTab
            key={it.to}
            item={it}
            label={t(it.labelKey)}
            active={activeSection === it.section}
            badge={it.section === "messenger" ? unreadMessages : 0}
          />
        ))}
      </ul>
    </nav>
  );
}

function NavTab({
  item,
  label,
  active,
  badge,
}: {
  item: Item;
  label: string;
  active: boolean;
  badge: number;
}) {
  const actionKey = NAV_ROUTE_TO_ACTION[item.to];
  // VK/Авито-поведение: повторный тап по активному разделу не навигирует, а
  // прокручивает наверх и просит секцию обновиться. Ловим в фазе захвата, до
  // обработчика самой ссылки, поэтому Link/GuestGuardLink менять не нужно.
  const onReTap = active
    ? (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        scrollSectionToTop(item.section);
      }
    : undefined;
  const content = (
    <>
      <span className="relative inline-flex">
        <SlotIcon
          slot={navSlotKey(item.section)}
          inheritColor
          size={22}
          strokeWidth={active ? 2.4 : 2}
        />
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
      {/* Шесть вкладок на 375px: длинные названия («Сообщества», «Объявления»)
          не влезают в колонку в 62px и налезали на соседей. Кегль тянется по
          ширине экрана, truncate остаётся страховкой для узких устройств. */}
      <span
        className="w-full truncate text-center font-medium"
        style={{ fontSize: "clamp(9px, 2.6vw, 10.5px)", letterSpacing: "0", lineHeight: 1.15 }}
      >
        {label}
      </span>
    </>
  );

  return (
    <li className="flex min-w-0" onClickCapture={onReTap}>
      {actionKey ? (
        <GuestGuardLink
          actionKey={actionKey}
          to={item.to}
          className="flex min-w-0 flex-1 flex-col items-center justify-center gap-[3px] transition-colors duration-150"
          style={{ color: active ? "var(--accent)" : "var(--foreground-50)" }}
        >
          {content}
        </GuestGuardLink>
      ) : (
        <Link
          to={item.to}
          className="flex min-w-0 flex-1 flex-col items-center justify-center gap-[3px] transition-colors duration-150"
          style={{ color: active ? "var(--accent)" : "var(--foreground-50)" }}
        >
          {content}
        </Link>
      )}
    </li>
  );
}
