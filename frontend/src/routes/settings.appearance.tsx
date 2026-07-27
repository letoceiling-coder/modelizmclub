import { createFileRoute } from "@tanstack/react-router";
import { Sun, Moon, Monitor } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SettingsSectionShell } from "@/components/settings/SettingsSectionShell";
import { RadioCard } from "@/components/ui-bespoke/RadioCard";
import { useTheme, type ThemePreference } from "@/components/ThemeProvider";

export const Route = createFileRoute("/settings/appearance")({
  component: AppearanceSection,
});

const OPTIONS: { value: ThemePreference; icon: typeof Sun; titleKey: string; descKey: string }[] = [
  { value: "light", icon: Sun, titleKey: "pages.settings.themeLight", descKey: "pages.settings.themeLightDesc" },
  { value: "dark", icon: Moon, titleKey: "pages.settings.themeDark", descKey: "pages.settings.themeDarkDesc" },
  { value: "system", icon: Monitor, titleKey: "pages.settings.themeSystem", descKey: "pages.settings.themeSystemDesc" },
];

function AppearanceSection() {
  const { t } = useTranslation();
  const { preference, setPreference } = useTheme();

  return (
    <SettingsSectionShell title={t("pages.settings.appearanceTitle")}>
      <div>
        <h2 className="mb-[4px] text-[16px] font-semibold" style={{ color: "var(--foreground)" }}>{t("pages.settings.themeTitle")}</h2>
        <p className="mb-[14px] text-[13px]" style={{ color: "var(--foreground-50)" }}>
          {t("pages.settings.themeDesc")}
        </p>
        <div className="flex flex-col gap-[10px]" role="radiogroup" aria-label={t("pages.settings.themeAria")}>
          {OPTIONS.map((opt) => (
            <RadioCard
              key={opt.value}
              selected={preference === opt.value}
              onClick={() => setPreference(opt.value)}
              icon={opt.icon}
              title={t(opt.titleKey)}
              description={t(opt.descKey)}
            />
          ))}
        </div>
      </div>
    </SettingsSectionShell>
  );
}
