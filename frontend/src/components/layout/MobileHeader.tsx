import { Link } from "@tanstack/react-router";
import { Bell, Search, Radio } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useUnreadNotifications } from "@/lib/hooks/useUnreadNotifications";

export function MobileHeader() {
  const unread = useUnreadNotifications();
  return (
    <header
      className="lg:hidden sticky top-0 z-30 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-[8px] px-[16px]"
      style={{
        height: 48,
        background: "color-mix(in oklab, var(--background) 92%, transparent)",
        backdropFilter: "saturate(180%) blur(12px)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <Link to="/feed" className="min-w-0 inline-flex items-center" aria-label="На главную">
        <Logo />
      </Link>
      <div className="flex shrink-0 items-center gap-[2px]">
        <Link
          to="/channels"
          aria-label="Каналы"
          className="grid h-[36px] w-[36px] place-items-center rounded-full transition-colors duration-150"
          style={{ color: "var(--foreground-70)" }}
        >
          <Radio size={18} />
        </Link>
        <IconBtn aria-label="Поиск"><Search size={18} /></IconBtn>
        <Link
          to="/notifications"
          aria-label="Уведомления"
          className="grid h-[36px] w-[36px] place-items-center rounded-full transition-colors duration-150"
          style={{ color: "var(--foreground-70)" }}
        >
          <span className="relative inline-flex">
            <Bell size={18} />
            {unread > 0 && (
              <span
                className="absolute -top-[5px] -right-[6px] grid min-w-[15px] place-items-center rounded-full px-[3px]"
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
        <ThemeToggle />
      </div>
    </header>
  );
}

function IconBtn({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className="grid h-[36px] w-[36px] place-items-center rounded-full transition-colors duration-150"
      style={{ color: "var(--foreground-70)" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--background-surface)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {children}
    </button>
  );
}
