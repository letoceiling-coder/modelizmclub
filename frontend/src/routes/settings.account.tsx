import { createFileRoute } from "@tanstack/react-router";
import { SettingsSectionShell } from "@/components/settings/SettingsSectionShell";

export const Route = createFileRoute("/settings/account")({
  component: () => (
    <SettingsSectionShell title="Профиль и аккаунт">
      <p className="text-[14px]" style={{ color: "var(--foreground-50)" }}>Скоро</p>
    </SettingsSectionShell>
  ),
});
