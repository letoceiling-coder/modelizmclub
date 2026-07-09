import { createFileRoute } from "@tanstack/react-router";
import { SettingsSectionShell } from "@/components/settings/SettingsSectionShell";

export const Route = createFileRoute("/settings/history")({
  component: () => (
    <SettingsSectionShell title="История просмотров">
      <p className="text-[14px]" style={{ color: "var(--foreground-50)" }}>Скоро</p>
    </SettingsSectionShell>
  ),
});
