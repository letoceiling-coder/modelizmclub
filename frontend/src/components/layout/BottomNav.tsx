import { Link, useRouterState } from "@tanstack/react-router";
import { Newspaper, Users2, MessageSquare, Megaphone, User } from "lucide-react";
import { getActiveSection } from "@/lib/routes";

type Item = {
  to: "/feed" | "/communities" | "/messenger" | "/ads" | "/profile";
  label: string;
  icon: typeof Newspaper;
  section: string;
};

const ITEMS: Item[] = [
  { to: "/feed", label: "Лента", icon: Newspaper, section: "feed" },
  { to: "/communities", label: "Сообщества", icon: Users2, section: "communities" },
  { to: "/messenger", label: "Сообщения", icon: MessageSquare, section: "messenger" },
  { to: "/ads", label: "Объявления", icon: Megaphone, section: "ads" },
  { to: "/profile", label: "Профиль", icon: User, section: "profile" },
];

export function BottomNav() {
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
        {ITEMS.map((it) => (
          <NavTab key={it.to} item={it} active={activeSection === it.section} />
        ))}
      </ul>
    </nav>
  );
}

function NavTab({ item, active }: { item: Item; active: boolean }) {
  const Icon = item.icon;
  return (
    <li>
      <Link
        to={item.to}
        className="flex h-full flex-col items-center justify-center gap-[3px] transition-colors duration-150"
        style={{
          color: active ? "var(--accent)" : "var(--foreground-50)",
          height: 60,
        }}
      >
        <Icon size={22} strokeWidth={active ? 2.4 : 2} />
        <span className="font-medium" style={{ fontSize: 10.5, letterSpacing: "0.01em", lineHeight: 1 }}>
          {item.label}
        </span>
      </Link>
    </li>
  );
}
