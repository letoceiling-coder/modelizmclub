import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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

const ROW_KEYS: { key: NotifKey; labelKey: string }[] = [
  { key: "friend_requests", labelKey: "pages.settings.notifFriendRequests" },
  { key: "comments", labelKey: "pages.settings.notifComments" },
  { key: "likes", labelKey: "pages.settings.notifLikes" },
  { key: "messages", labelKey: "pages.settings.notifMessages" },
  { key: "subscription_posts", labelKey: "pages.settings.notifSubscriptionPosts" },
];

function NotificationsSettings() {
  const { t } = useTranslation();
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);

  useEffect(() => {
    let alive = true;
    fetchNotifPrefs()
      .then((p) => { if (alive) setPrefs(p); })
      .catch(() => { if (alive) toast.error(t("pages.settings.notificationsLoadFailed")); });
    return () => { alive = false; };
  }, [t]);

  const toggle = (key: NotifKey, value: boolean) => {
    setPrefs((cur) => {
      if (!cur) return cur;
      const next = { ...cur, [key]: value };
      saveNotifPrefs(next).catch(() => {
        setPrefs((c) => (c ? { ...c, [key]: !value } : c));
        toast.error(t("pages.settings.notificationsSaveFailed"));
      });
      return next;
    });
  };

  return (
    <SettingsSectionShell title={t("pages.settings.notificationsTitle")}>
      <p className="text-[13px]" style={{ color: "var(--foreground-50)" }}>
        {isDemoMode() ? t("pages.settings.notificationsDemo") : t("pages.settings.notificationsDesc")}
      </p>
      {prefs === null ? (
        <div className="flex items-center gap-[8px] py-[24px] text-[14px]" style={{ color: "var(--foreground-50)" }}>
          <Loader2 size={16} className="animate-spin" /> {t("pages.settings.loading")}
        </div>
      ) : (
        <Card className="divide-y p-0" style={{ borderColor: "var(--border)", borderRadius: "var(--r-card)" }}>
          {ROW_KEYS.map(({ key, labelKey }) => {
            const label = t(labelKey);
            return (
              <div key={key} className="flex items-center justify-between gap-[12px] px-[16px] py-[14px]" style={{ borderColor: "var(--border)" }}>
                <span className="text-[15px]" style={{ color: "var(--foreground)" }}>{label}</span>
                <Switch checked={prefs[key]} onCheckedChange={(v) => toggle(key, v)} aria-label={label} />
              </div>
            );
          })}
        </Card>
      )}
    </SettingsSectionShell>
  );
}
