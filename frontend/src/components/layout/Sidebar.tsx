import { Link, useRouterState } from "@tanstack/react-router";
import { Newspaper, Users2, Radio, MessageSquare, Megaphone, UserPlus, User, ShoppingBag, HelpCircle, Crown, ExternalLink } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ROUTES, getActiveSection } from "@/lib/routes";

interface Item {
  to: "/feed" | "/communities" | "/channels" | "/messenger" | "/ads" | "/friends" | "/profile" | "/subscription" | "/help";
  label: string;
  icon: typeof Newspaper;
  section: string;
}

const items: Item[] = [
  { to: ROUTES.feed,         label: "Лента",        icon: Newspaper,    section: "feed" },
  { to: ROUTES.communities,  label: "Сообщества",   icon: Users2,       section: "communities" },
  { to: ROUTES.channels,     label: "Каналы",       icon: Radio,        section: "channels" },
  { to: ROUTES.messenger,    label: "Мессенджер",   icon: MessageSquare, section: "messenger" },
  { to: ROUTES.ads,          label: "Объявления",   icon: Megaphone,    section: "ads" },
  { to: ROUTES.friends,      label: "Друзья",       icon: UserPlus,     section: "friends" },
  { to: ROUTES.profile,      label: "Профиль",      icon: User,         section: "profile" },
  { to: ROUTES.subscription, label: "Подписка",     icon: Crown,        section: "subscription" },
  { to: ROUTES.help,         label: "Помощь",       icon: HelpCircle,   section: "help" },
];

export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const activeSection = getActiveSection(pathname);
  return (
    <aside className="hidden lg:block w-60 shrink-0">
      <div className="sticky top-4 space-y-1">
        <div className="flex items-center justify-between px-3 py-3">
          <Link to={ROUTES.feed}><Logo /></Link>
          <ThemeToggle />
        </div>
        <nav className="space-y-0.5">
          {items.map(({ to, label, icon: Icon, section }) => {
            const active = activeSection === section;
            return (
              <Link
                key={to}
                to={to}
                className={`relative flex items-center gap-3 rounded-lg pl-3 pr-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-accent/10 text-primary font-medium"
                    : "text-foreground hover:bg-muted"
                }`}
                style={
                  active
                    ? {
                        borderLeft: "3px solid var(--accent)",
                        paddingLeft: 9,
                        background: "var(--accent-soft)",
                        color: "var(--accent)",
                      }
                    : undefined
                }
              >
                <Icon className="h-4 w-4" />
                {label}
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
              <ShoppingBag className="h-4 w-4" />
              Маркет
            </span>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
          </a>
        </nav>
        <div className="mt-4 rounded-xl border bg-card p-3">
          <div className="text-xs text-muted-foreground">Подписка</div>
          <div className="mt-1 text-sm font-medium">Год · активна</div>
          <Link to={ROUTES.subscription} className="mt-2 inline-block text-xs text-primary hover:underline">
            Управлять
          </Link>
        </div>
      </div>
    </aside>
  );
}
