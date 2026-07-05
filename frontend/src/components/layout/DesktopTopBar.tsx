import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Search, Bell, Heart } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Logo } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/messenger/LanguageSwitcher";
import { UserMenu } from "@/components/layout/UserMenu";
import { useUnreadNotifications } from "@/lib/hooks/useUnreadNotifications";
import { ROUTES } from "@/lib/routes";

export function DesktopTopBar() {
  const unread = useUnreadNotifications();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState("");

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

      <div className="relative min-w-0 max-w-[420px] flex-1">
        <Search
          size={16}
          className="pointer-events-none absolute left-[12px] top-1/2 -translate-y-1/2"
          style={{ color: "var(--foreground-50)" }}
        />
        <input
          type="search"
          placeholder={t("common.search")}
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const v = searchValue.trim();
              void navigate({ to: "/ads", search: v ? { q: v } : {} });
            }
          }}
          className="w-full text-[14px] outline-none transition-colors"
          style={{
            background: "var(--background-elevated)",
            color: "var(--foreground)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-input)",
            height: 40,
            padding: "0 12px 0 36px",
          }}
        />
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <LanguageSwitcher />
        <Link
          to={ROUTES.favorites}
          aria-label="Избранное"
          className="grid h-10 w-10 place-items-center rounded-full transition-colors hover:bg-[var(--background-surface)]"
          style={{ color: "var(--foreground-70)" }}
        >
          <Heart size={20} />
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
        <UserMenu />
      </div>
      </div>
    </header>
  );
}
