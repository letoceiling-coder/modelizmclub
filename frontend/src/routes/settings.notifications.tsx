import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { SettingsSectionShell } from "@/components/settings/SettingsSectionShell";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { isDemoMode } from "@/lib/demo-mode";
import {
  fetchNotifPrefs,
  saveNotifPref,
  saveMaxChannelPref,
  type CabinetNotifItem,
} from "@/lib/api/notification-prefs";
import { fetchMe } from "@/lib/api/auth";
import { setCurrentUser } from "@/lib/store";
import { useCurrentUser } from "@/lib/session";
import { isMaxOAuthUser } from "@/lib/auth/verification";

export const Route = createFileRoute("/settings/notifications")({
  component: NotificationsSettings,
});

function NotificationsSettings() {
  const { t } = useTranslation();
  const currentUser = useCurrentUser();
  const maxLinked = isMaxOAuthUser(currentUser);
  const [items, setItems] = useState<CabinetNotifItem[] | null>(null);
  const [groupLabels, setGroupLabels] = useState<Record<string, string>>({});
  const [maxEnabled, setMaxEnabled] = useState(true);

  const load = () => {
    fetchNotifPrefs()
      .then((state) => {
        setItems(state.items);
        setGroupLabels(state.groupLabels);
        setMaxEnabled(state.maxEnabled);
      })
      .catch(() => toast.error(t("pages.settings.notificationsLoadFailed")));
  };

  useEffect(() => {
    let alive = true;
    if (!isDemoMode()) {
      void fetchMe().then((u) => {
        if (alive && u) setCurrentUser(u);
      });
    }
    fetchNotifPrefs()
      .then((state) => {
        if (!alive) return;
        setItems(state.items);
        setGroupLabels(state.groupLabels);
        setMaxEnabled(state.maxEnabled);
      })
      .catch(() => { if (alive) toast.error(t("pages.settings.notificationsLoadFailed")); });
    return () => { alive = false; };
  }, [t]);

  const grouped = useMemo(() => {
    const map = new Map<string, CabinetNotifItem[]>();
    for (const item of items ?? []) {
      const list = map.get(item.group) ?? [];
      list.push(item);
      map.set(item.group, list);
    }
    return map;
  }, [items]);

  const toggle = (key: string, value: boolean) => {
    setItems((cur) => cur?.map((item) => (item.key === key ? { ...item, enabled: value } : item)) ?? cur);
    void saveNotifPref(key, value).catch(() => {
      load();
      toast.error(t("pages.settings.notificationsSaveFailed"));
    });
  };

  return (
    <SettingsSectionShell title={t("pages.settings.notificationsTitle")}>
      <p className="text-[13px]" style={{ color: "var(--foreground-50)" }}>
        {isDemoMode() ? t("pages.settings.notificationsDemo") : t("pages.settings.notificationsDesc")}
      </p>
      <Card className="p-[16px]" style={{ borderColor: "var(--border)", borderRadius: "var(--r-card)" }}>
        <div className="flex items-center justify-between gap-[12px]">
          <div className="min-w-0">
            <div className="text-[15px] font-medium" style={{ color: "var(--foreground)" }}>{t("pages.settings.maxTitle")}</div>
            <p className="mt-[4px] text-[13px] leading-relaxed" style={{ color: "var(--foreground-50)" }}>
              {maxLinked ? t("pages.settings.maxNotifyHint") : t("pages.settings.maxNotifyNeedLink")}
            </p>
          </div>
          {maxLinked ? (
            <Switch
              checked={maxEnabled}
              onCheckedChange={(v) => {
                setMaxEnabled(v);
                void saveMaxChannelPref(v).catch(() => {
                  setMaxEnabled(!v);
                  toast.error(t("pages.settings.notificationsSaveFailed"));
                });
              }}
              aria-label={t("pages.settings.maxNotifyToggle")}
            />
          ) : (
            <Button type="button" variant="outline" size="sm" asChild>
              <Link to="/settings/account" hash="max-account">{t("pages.settings.maxConnect")}</Link>
            </Button>
          )}
        </div>
      </Card>
      {items === null ? (
        <div className="flex items-center gap-[8px] py-[24px] text-[14px]" style={{ color: "var(--foreground-50)" }}>
          <Loader2 size={16} className="animate-spin" /> {t("pages.settings.loading")}
        </div>
      ) : (
        [...grouped.entries()].map(([group, rows]) => (
          <div key={group} className="space-y-[8px]">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide" style={{ color: "var(--foreground-50)" }}>
              {groupLabels[group] ?? group}
            </h2>
            <Card className="divide-y p-0" style={{ borderColor: "var(--border)", borderRadius: "var(--r-card)" }}>
              {rows.map((item) => {
                const hint = item.locked
                  ? t("pages.settings.notifLockedAlways")
                  : !item.meets_tier
                    ? (item.min_tier === "subscriber"
                      ? t("pages.settings.notifNeedSubscription")
                      : t("pages.settings.notifNeedVerified"))
                    : item.hint;
                return (
                  <div
                    key={item.key}
                    className="flex items-center justify-between gap-[12px] px-[16px] py-[14px]"
                    style={{ borderColor: "var(--border)", opacity: item.meets_tier ? 1 : 0.55 }}
                  >
                    <div className="min-w-0">
                      <span className="text-[15px]" style={{ color: "var(--foreground)" }}>{item.label}</span>
                      {hint ? (
                        <p className="mt-[4px] text-[12px] leading-relaxed" style={{ color: "var(--foreground-50)" }}>{hint}</p>
                      ) : null}
                    </div>
                    {item.can_toggle ? (
                      <Switch
                        checked={item.enabled}
                        onCheckedChange={(v) => toggle(item.key, v)}
                        aria-label={item.label}
                      />
                    ) : (
                      <Switch checked={item.enabled} disabled aria-label={item.label} />
                    )}
                  </div>
                );
              })}
            </Card>
          </div>
        ))
      )}
    </SettingsSectionShell>
  );
}
