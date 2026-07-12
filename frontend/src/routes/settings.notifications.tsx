import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { SettingsSectionShell } from "@/components/settings/SettingsSectionShell";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/lib/toast";
import { isDemoMode } from "@/lib/demo-mode";
import type { NotifKey, NotificationPrefs } from "@/lib/settings-prefs";
import { fetchNotifPrefs, saveNotifPrefs } from "@/lib/api/notification-prefs";

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
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);

  useEffect(() => {
    let alive = true;
    fetchNotifPrefs()
      .then((p) => { if (alive) setPrefs(p); })
      .catch(() => { if (alive) toast.error("Не удалось загрузить настройки"); });
    return () => { alive = false; };
  }, []);

  // Optimistic toggle: flip immediately, persist the whole set, revert on error.
  const toggle = (key: NotifKey, value: boolean) => {
    setPrefs((cur) => {
      if (!cur) return cur;
      const next = { ...cur, [key]: value };
      saveNotifPrefs(next).catch(() => {
        setPrefs((c) => (c ? { ...c, [key]: !value } : c));
        toast.error("Не удалось сохранить");
      });
      return next;
    });
  };

  return (
    <SettingsSectionShell title="Уведомления">
      <p className="text-[13px]" style={{ color: "var(--foreground-50)" }}>
        {isDemoMode()
          ? "В демо-режиме настройки хранятся на этом устройстве."
          : "Выберите, о чём получать уведомления."}
      </p>
      {prefs === null ? (
        <div className="flex items-center gap-[8px] py-[24px] text-[14px]" style={{ color: "var(--foreground-50)" }}>
          <Loader2 size={16} className="animate-spin" /> Загрузка…
        </div>
      ) : (
        <Card className="divide-y p-0" style={{ borderColor: "var(--border)", borderRadius: "var(--r-card)" }}>
          {ROWS.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between gap-[12px] px-[16px] py-[14px]" style={{ borderColor: "var(--border)" }}>
              <span className="text-[15px]" style={{ color: "var(--foreground)" }}>{label}</span>
              <Switch checked={prefs[key]} onCheckedChange={(v) => toggle(key, v)} aria-label={label} />
            </div>
          ))}
        </Card>
      )}
    </SettingsSectionShell>
  );
}
