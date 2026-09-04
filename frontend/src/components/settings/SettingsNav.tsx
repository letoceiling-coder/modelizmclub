import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  UserCog,
  Bell,
  Wallet,
  CreditCard,
  ClipboardList,
  FileText,
  Star,
  History,
  ShieldCheck,
  Palette,
  BarChart3,
  ChevronRight,
  ExternalLink,
  Radio,
  Shield,
} from "lucide-react";

type Row = { to: string; labelKey: string; icon: typeof UserCog };

const ROWS: Row[] = [
  { to: "/settings/dashboard", labelKey: "components.settingsNav.dashboard", icon: BarChart3 },
  { to: "/settings/account", labelKey: "components.settingsNav.account", icon: UserCog },
  { to: "/settings/security", labelKey: "components.settingsNav.security", icon: ShieldCheck },
  { to: "/settings/consents", labelKey: "components.settingsNav.consents", icon: Shield },
  { to: "/settings/appearance", labelKey: "components.settingsNav.appearance", icon: Palette },
  { to: "/settings/notifications", labelKey: "components.settingsNav.notifications", icon: Bell },
  { to: "/settings/wallet", labelKey: "components.settingsNav.wallet", icon: Wallet },
  {
    to: "/settings/payment-methods",
    labelKey: "components.settingsNav.paymentMethods",
    icon: CreditCard,
  },
  { to: "/settings/requisites", labelKey: "components.settingsNav.requisites", icon: FileText },
  { to: "/settings/rating", labelKey: "components.settingsNav.rating", icon: Star },
  { to: "/settings/spaces", labelKey: "components.settingsNav.spaces", icon: Radio },
  { to: "/settings/history", labelKey: "components.settingsNav.history", icon: History },
];

export function SettingsNav({ activePath }: { activePath: string }) {
  const { t } = useTranslation();
  return (
    <nav className="flex flex-col gap-[4px]">
      {ROWS.map(({ to, labelKey, icon: Icon }) => {
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
            <span className="flex-1 text-[15px] font-medium">{t(labelKey)}</span>
            <ChevronRight
              size={16}
              className="lg:hidden"
              style={{ color: "var(--foreground-30)" }}
            />
          </Link>
        );
      })}
      <Link
        to="/deals"
        className="flex items-center gap-[12px] rounded-[12px] px-[14px] py-[12px] transition-colors"
        style={{ color: "var(--foreground)" }}
      >
        <ShieldCheck size={20} style={{ color: "var(--foreground-70)" }} />
        <span className="flex-1 text-[15px] font-medium">{t("nav.deals")}</span>
        <ExternalLink size={15} className="lg:hidden" style={{ color: "var(--foreground-30)" }} />
      </Link>
      <Link
        to="/my-ads"
        className="flex items-center gap-[12px] rounded-[12px] px-[14px] py-[12px] transition-colors"
        style={{ color: "var(--foreground)" }}
      >
        <ClipboardList size={20} style={{ color: "var(--foreground-70)" }} />
        <span className="flex-1 text-[15px] font-medium">{t("components.settingsNav.myAds")}</span>
        <ExternalLink size={15} className="lg:hidden" style={{ color: "var(--foreground-30)" }} />
      </Link>
    </nav>
  );
}
