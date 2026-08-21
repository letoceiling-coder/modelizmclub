import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon as SlotIcon } from "@/components/ui/Icon";
import { ROUTES } from "@/lib/routes";
import { fetchStats } from "@/lib/api/content";
import { isDemoMode } from "@/lib/demo-mode";

export const INVITE_FRIEND_SECTION_ID = ROUTES.subscriptionInviteHash;

export function scrollToInviteFriendBlock(behavior: ScrollBehavior = "smooth"): void {
  document.getElementById(INVITE_FRIEND_SECTION_ID)?.scrollIntoView({ behavior, block: "start" });
}

interface Props {
  className?: string;
  onNavigate?: () => void;
}

/** Sidebar / mobile menu entry → /subscription#invite-friend */
export function InviteFriendNavLink({ className, onNavigate }: Props) {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hash = useRouterState({ select: (s) => s.location.hash });
  const active = pathname === ROUTES.subscription && hash === INVITE_FRIEND_SECTION_ID;
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (isDemoMode()) return;
    let activeReq = true;
    fetchStats()
      .then((s) => {
        if (activeReq) setEnabled(s.referral?.enabled ?? true);
      })
      .catch(() => {});
    return () => {
      activeReq = false;
    };
  }, []);

  if (!enabled) return null;

  const handleClick = () => {
    onNavigate?.();
    if (pathname === ROUTES.subscription) {
      window.setTimeout(() => scrollToInviteFriendBlock(), 0);
    }
  };

  return (
    <Link
      to={ROUTES.subscription}
      hash={INVITE_FRIEND_SECTION_ID}
      onClick={handleClick}
      className={
        className
        ?? `flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted ${
          active ? "bg-accent/10 font-medium text-primary" : "text-foreground"
        }`
      }
      style={
        active
          ? { borderLeft: "3px solid var(--accent)", paddingLeft: 9, background: "var(--accent-soft)", color: "var(--accent)" }
          : undefined
      }
    >
      <SlotIcon slot="nav.invite-friend" className="h-4 w-4" size={16} inheritColor />
      {t("nav.inviteFriend")}
    </Link>
  );
}
