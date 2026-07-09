import { createFileRoute } from "@tanstack/react-router";
import { Settings as SettingsIcon } from "lucide-react";

export const Route = createFileRoute("/settings/")({
  component: SettingsIndex,
});

function SettingsIndex() {
  // Desktop-only placeholder — on mobile the rail (the section list) fills the screen.
  return (
    <div className="hidden lg:flex h-full min-h-[320px] flex-col items-center justify-center gap-[10px] text-center" style={{ color: "var(--foreground-50)" }}>
      <SettingsIcon size={32} style={{ color: "var(--foreground-30)" }} />
      <p className="text-[14px]">Выберите раздел настроек</p>
    </div>
  );
}
