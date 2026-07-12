import { Link } from "@tanstack/react-router";
import { UserCog, Bell, Wallet, CreditCard, ClipboardList, FileText, Star, History, ShieldCheck, Palette, BarChart3, ChevronRight, ExternalLink } from "lucide-react";

type Row = { to: string; label: string; icon: typeof UserCog };

const ROWS: Row[] = [
  { to: "/settings/dashboard", label: "Статистика", icon: BarChart3 },
  { to: "/settings/account", label: "Профиль и аккаунт", icon: UserCog },
  { to: "/settings/security", label: "Безопасность", icon: ShieldCheck },
  { to: "/settings/appearance", label: "Оформление", icon: Palette },
  { to: "/settings/notifications", label: "Уведомления", icon: Bell },
  { to: "/settings/wallet", label: "Кошелёк", icon: Wallet },
  { to: "/settings/payment-methods", label: "Способы оплаты", icon: CreditCard },
  { to: "/settings/requisites", label: "Реквизиты", icon: FileText },
  { to: "/settings/rating", label: "Рейтинг и отзывы", icon: Star },
  { to: "/settings/history", label: "История просмотров", icon: History },
];

export function SettingsNav({ activePath }: { activePath: string }) {
  return (
    <nav className="flex flex-col gap-[4px]">
      {ROWS.map(({ to, label, icon: Icon }) => {
        const active = activePath === to;
        return (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-[12px] rounded-[12px] px-[14px] py-[12px] transition-colors"
            style={
              active
                ? { background: "var(--accent-soft)", color: "var(--accent)" }
                : { color: "var(--foreground)" }
            }
          >
            <Icon size={20} style={{ color: active ? "var(--accent)" : "var(--foreground-70)" }} />
            <span className="flex-1 text-[15px] font-medium">{label}</span>
            <ChevronRight size={16} className="lg:hidden" style={{ color: "var(--foreground-30)" }} />
          </Link>
        );
      })}
      {/* Listing management lives at /my-ads — link, do not duplicate */}
      <Link
        to="/my-ads"
        className="flex items-center gap-[12px] rounded-[12px] px-[14px] py-[12px] transition-colors"
        style={{ color: "var(--foreground)" }}
      >
        <ClipboardList size={20} style={{ color: "var(--foreground-70)" }} />
        <span className="flex-1 text-[15px] font-medium">Мои объявления</span>
        <ExternalLink size={15} className="lg:hidden" style={{ color: "var(--foreground-30)" }} />
      </Link>
    </nav>
  );
}
