import { createFileRoute } from "@tanstack/react-router";
import { Sun, Moon, Monitor } from "lucide-react";
import { SettingsSectionShell } from "@/components/settings/SettingsSectionShell";
import { RadioCard } from "@/components/ui-bespoke/RadioCard";
import { useTheme, type ThemePreference } from "@/components/ThemeProvider";

export const Route = createFileRoute("/settings/appearance")({
  component: AppearanceSection,
});

const OPTIONS: { value: ThemePreference; icon: typeof Sun; title: string; description: string }[] = [
  { value: "light", icon: Sun, title: "Светлая", description: "Всегда светлая тема" },
  { value: "dark", icon: Moon, title: "Тёмная", description: "Всегда тёмная тема" },
  { value: "system", icon: Monitor, title: "Системная", description: "Как в настройках устройства" },
];

function AppearanceSection() {
  const { preference, setPreference } = useTheme();

  return (
    <SettingsSectionShell title="Оформление">
      <div>
        <h2 className="mb-[4px] text-[16px] font-semibold" style={{ color: "var(--foreground)" }}>Тема</h2>
        <p className="mb-[14px] text-[13px]" style={{ color: "var(--foreground-50)" }}>
          «Системная» переключается автоматически вместе с темой устройства.
        </p>
        <div className="flex flex-col gap-[10px]" role="radiogroup" aria-label="Тема оформления">
          {OPTIONS.map((opt) => (
            <RadioCard
              key={opt.value}
              selected={preference === opt.value}
              onClick={() => setPreference(opt.value)}
              icon={opt.icon}
              title={opt.title}
              description={opt.description}
            />
          ))}
        </div>
      </div>
    </SettingsSectionShell>
  );
}
