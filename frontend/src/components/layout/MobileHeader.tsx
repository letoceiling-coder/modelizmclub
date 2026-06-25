import { Link } from "@tanstack/react-router";
import { Bell, Search, Radio } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";

export function MobileHeader() {
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
        <IconBtn aria-label="Уведомления">
          <span className="relative inline-flex">
            <Bell size={18} />
            <span
              className="absolute -top-[2px] -right-[2px] h-[6px] w-[6px] rounded-full"
              style={{ background: "var(--accent)", boxShadow: "0 0 0 2px var(--background)" }}
            />
          </span>
        </IconBtn>
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
