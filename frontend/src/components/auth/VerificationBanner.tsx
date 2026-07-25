import { Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { useStore, selectors } from "@/lib/store";
import { isFullyVerified, verificationMessage } from "@/lib/auth/verification";
import { isDemoMode } from "@/lib/demo-mode";

export function VerificationBanner() {
  const me = useStore(selectors.currentUser);

  if (isDemoMode() || isFullyVerified(me)) return null;

  const message = verificationMessage(me);

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
          Подтвердите аккаунт
        </p>
        <p className="mt-[4px] text-[13px] leading-snug" style={{ color: "var(--foreground-70)" }}>
          {message}
        </p>
        <Link
          to="/settings/account"
          className="mt-[8px] inline-block text-[13px] font-semibold transition-opacity hover:opacity-80"
          style={{ color: "var(--accent)" }}
        >
          Перейти в настройки →
        </Link>
      </div>
    </div>
  );
}
