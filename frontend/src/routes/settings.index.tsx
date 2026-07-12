import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Settings as SettingsIcon } from "lucide-react";

export const Route = createFileRoute("/settings/")({
  component: SettingsIndex,
});

function SettingsIndex() {
  const navigate = useNavigate();

  // Desktop-only redirect to the base tab ("Профиль и аккаунт"). On mobile
  // this component is never actually visible — the parent layout
  // (settings.tsx) shows SettingsNav's section list instead at the bare
  // /settings path and hides this Outlet content below the lg breakpoint —
  // so the effect is gated on the same >=1024px breakpoint to avoid firing
  // (and touching the URL) on mobile at all. On desktop it used to be the
  // ONLY thing shown at /settings: a blank "Choose a section" placeholder
  // with no real content. Always land on the base tab instead — never the
  // empty state, and there's no last-visited-tab state to fall back to.
  useEffect(() => {
    if (window.matchMedia("(min-width: 1024px)").matches) {
      navigate({ to: "/settings/account", replace: true });
    }
  }, [navigate]);

  return (
    <div className="hidden lg:flex h-full min-h-[320px] flex-col items-center justify-center gap-[10px] text-center" style={{ color: "var(--foreground-50)" }}>
      <SettingsIcon size={32} style={{ color: "var(--foreground-30)" }} />
      <p className="text-[14px]">Выберите раздел настроек</p>
    </div>
  );
}
