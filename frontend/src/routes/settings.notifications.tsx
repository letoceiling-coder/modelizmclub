import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SettingsSectionShell } from "@/components/settings/SettingsSectionShell";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { getNotifPrefs, setNotifPref, type NotifKey } from "@/lib/settings-prefs";

export const Route = createFileRoute("/settings/notifications")({
  component: NotificationsSettings,
});

const ROWS: { key: NotifKey; label: string }[] = [
  { key: "friend_requests", label: "Заявки в друзья" },
  { key: "comments", label: "Комментарии" },
  { key: "likes", label: "Лайки" },
  { key: "messages", label: "Сообщения" },
  { key: "subscription_posts", label: "Посты в подписках" },
];

function NotificationsSettings() {
  const [prefs, setPrefs] = useState(getNotifPrefs);

  const toggle = (key: NotifKey, value: boolean) => {
    setNotifPref(key, value);
    setPrefs((p) => ({ ...p, [key]: value }));
  };

  return (
    <SettingsSectionShell title="Уведомления">
      <p className="text-[13px]" style={{ color: "var(--foreground-50)" }}>
        Настройки применяются на этом устройстве. Реальная доставка — в разработке.
      </p>
      <Card className="divide-y p-0" style={{ borderColor: "var(--border)", borderRadius: 14 }}>
        {ROWS.map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between gap-[12px] px-[16px] py-[14px]" style={{ borderColor: "var(--border)" }}>
            <span className="text-[15px]" style={{ color: "var(--foreground)" }}>{label}</span>
            <Switch checked={prefs[key]} onCheckedChange={(v) => toggle(key, v)} aria-label={label} />
          </div>
        ))}
      </Card>
    </SettingsSectionShell>
  );
}
