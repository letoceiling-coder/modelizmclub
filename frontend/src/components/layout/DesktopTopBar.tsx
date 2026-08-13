import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Icon as SlotIcon } from "@/components/ui/Icon";
import { useTranslation } from "react-i18next";
import { Logo } from "@/components/Logo";
import { UserMenu } from "@/components/layout/UserMenu";
import { GlobalSearch } from "@/components/layout/GlobalSearch";
import { GuestGuardLink } from "@/components/access/GuestGuardLink";
import { useUnreadNotifications } from "@/lib/hooks/useUnreadNotifications";
import { useStore } from "@/lib/store";
import { getToken } from "@/lib/api/client";
import { ROUTES } from "@/lib/routes";

export function DesktopTopBar() {
  const unread = useUnreadNotifications();
  const favCount = useStore((s) => s.favoriteAdIds.length);
  const unreadMessages = useStore((s) =>
    Object.values(s.dialogs).reduce((n, d) => n + (d.unread ?? 0), 0),
  );
  const { t } = useTranslation();
  const isGuest = !getToken();

  const iconClass = "relative grid h-10 w-10 place-items-center rounded-full transition-colors hover:bg-[var(--background-surface)]";
  const iconStyle = { color: "var(--foreground-70)" };

  const NavIcon = ({ actionKey, to, label, children }: { actionKey: string; to: string; label: string; children: ReactNode }) =>
    isGuest ? (
      <GuestGuardLink actionKey={actionKey} to={to} aria-label={label} className={iconClass} style={iconStyle}>
        {children}
      </GuestGuardLink>
    ) : (
      <Link to={to as "/feed"} aria-label={label} className={iconClass} style={iconStyle}>
        {children}
      </Link>
    );

  return (
    <header
      className="hidden shrink-0 lg:block"
      style={{
        height: "var(--desktop-topbar-h)",
        background: "var(--background)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div className="mx-auto flex h-full w-full max-w-[var(--container-max)] items-center gap-4 px-[var(--container-pad)]">
      <Link to={ROUTES.feed} className="flex shrink-0 items-center" aria-label={t("nav.feed")}>
        <Logo size={36} />
      </Link>

      <GlobalSearch />

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <NavIcon actionKey="layout.nav.favorites" to={ROUTES.favorites} label={t("nav.favorites")}>
          <SlotIcon slot="header.favorites" size={20} inheritColor />
          {favCount > 0 && (
            <span
              className="absolute right-[6px] top-[5px] grid min-w-[15px] place-items-center rounded-full px-[3px]"
              style={{
                height: 15,
                fontSize: 9,
                fontWeight: 700,
                color: "#fff",
                background: "var(--accent)",
                boxShadow: "0 0 0 2px var(--background)",
              }}
            >
              {favCount > 9 ? "9+" : favCount}
            </span>
          )}
        </NavIcon>
        <NavIcon actionKey="layout.header.notifications" to={ROUTES.notifications} label={t("nav.notifications")}>
          <span className="relative inline-flex h-5 w-5 items-center justify-center">
            <SlotIcon slot="header.notifications" size={20} inheritColor />
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
        </NavIcon>
        <NavIcon actionKey="layout.nav.messenger" to={ROUTES.messenger} label={t("nav.messenger")}>
          <SlotIcon slot="header.messenger" size={20} inheritColor />
          {unreadMessages > 0 && (
            <span
              className="absolute right-[6px] top-[5px] grid min-w-[15px] place-items-center rounded-full px-[3px]"
              style={{
                height: 15,
                fontSize: 9,
                fontWeight: 700,
                color: "#fff",
                background: "var(--accent)",
                boxShadow: "0 0 0 2px var(--background)",
              }}
            >
              {unreadMessages > 9 ? "9+" : unreadMessages}
            </span>
          )}
        </NavIcon>
        <UserMenu />
      </div>
      </div>
    </header>
  );
}
