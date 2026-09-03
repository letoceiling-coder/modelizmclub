import { Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { useCurrentUser, useSessionResolved } from "@/lib/session";
import {
  isAnonymousUser,
  isPhoneVerified,
  isPhoneVerificationRequired,
} from "@/lib/auth/verification";
import { isAuthenticated } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/demo-mode";

export function VerificationBanner() {
  const me = useCurrentUser();
  const sessionReady = useSessionResolved();

  // Guests must see login, not SMS. Also wait for the boot-time session probe
  // so GUEST_USER is not treated as an unverified account on reload.
  if (!sessionReady || isDemoMode()) return null;
  if (!isAuthenticated() || isAnonymousUser(me)) return null;
  if (!isPhoneVerificationRequired(me) || isPhoneVerified(me)) return null;

  return (
    <div
      className="flex items-start gap-[12px] rounded-[var(--r-card)] border px-[14px] py-[12px]"
      style={{
        borderColor: "color-mix(in oklab, var(--accent) 35%, var(--border))",
        background: "color-mix(in oklab, var(--accent) 8%, var(--background-elevated))",
      }}
    >
      <ShieldAlert size={18} className="mt-[2px] shrink-0" style={{ color: "var(--accent)" }} />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium" style={{ color: "var(--foreground)" }}>
          Подтвердите номер телефона
        </p>
        <p className="mt-[4px] text-[13px] leading-snug" style={{ color: "var(--foreground-70)" }}>
          Подтвердите номер телефона, чтобы получить доступ к этой функции
        </p>
        <Link
          to="/settings/account"
          className="mt-[8px] inline-block text-[13px] font-semibold transition-opacity hover:opacity-80"
          style={{ color: "var(--accent)" }}
        >
          Подтвердить номер →
        </Link>
      </div>
    </div>
  );
}
