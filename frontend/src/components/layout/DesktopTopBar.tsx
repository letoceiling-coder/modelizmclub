import { Link } from "@tanstack/react-router";
import { Bell, Heart, MessageSquare } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Logo } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/messenger/LanguageSwitcher";
import { UserMenu } from "@/components/layout/UserMenu";
import { GlobalSearch } from "@/components/layout/GlobalSearch";
import { useUnreadNotifications } from "@/lib/hooks/useUnreadNotifications";
import { useStore } from "@/lib/store";
import { ROUTES } from "@/lib/routes";

export function DesktopTopBar() {
  const unread = useUnreadNotifications();
  const favCount = useStore((s) => s.favoriteAdIds.length);
  const unreadMessages = useStore((s) =>
    Object.values(s.dialogs).reduce((n, d) => n + (d.unread ?? 0), 0),
  );
  const { t } = useTranslation();

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
        <LanguageSwitcher />
        <Link
          to={ROUTES.favorites}
          aria-label="Избранное"
          className="relative grid h-10 w-10 place-items-center rounded-full transition-colors hover:bg-[var(--background-surface)]"
          style={{ color: "var(--foreground-70)" }}
        >
          <Heart size={20} />
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
        </Link>
        <Link
          to={ROUTES.notifications}
          aria-label={t("nav.notifications")}
          className="relative grid h-10 w-10 place-items-center rounded-full transition-colors hover:bg-[var(--background-surface)]"
          style={{ color: "var(--foreground-70)" }}
        >
          <Bell size={20} />
          {unread > 0 && (
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
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Link>
        <Link
          to={ROUTES.messenger}
          aria-label="Сообщения"
          className="relative grid h-10 w-10 place-items-center rounded-full transition-colors hover:bg-[var(--background-surface)]"
          style={{ color: "var(--foreground-70)" }}
        >
          <MessageSquare size={20} />
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
        </Link>
        <UserMenu />
      </div>
      </div>
    </header>
  );
}
