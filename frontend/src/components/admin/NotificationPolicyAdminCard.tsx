import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@/lib/toast";
import {
  fetchAdminNotificationPolicy,
  updateAdminNotificationPolicy,
  type NotificationPolicyChannel,
  type NotificationPolicyConfig,
  type NotificationPolicyRegistryItem,
  type NotificationPolicyTier,
  type NotificationPolicyTypeConfig,
} from "@/lib/api/notification-policy";

const inputStyle: CSSProperties = {
  height: "40px",
  background: "var(--background)",
  border: "1.5px solid var(--border)",
  borderRadius: "var(--r-input)",
  padding: "0 14px",
  fontSize: "13px",
  color: "var(--foreground)",
  width: "100%",
};

const primaryBtn: CSSProperties = {
  height: "40px",
  padding: "0 18px",
  borderRadius: "var(--r-button)",
  background: "var(--accent)",
  color: "var(--accent-foreground)",
  fontSize: "13px",
  fontWeight: 600,
  border: "none",
  cursor: "pointer",
};

function fallbackConfig(item: NotificationPolicyRegistryItem): NotificationPolicyTypeConfig {
  return {
    enabled: item.default_enabled,
    min_tier: item.default_min_tier,
    user_can_toggle: item.default_user_can_toggle,
    default_enabled: item.default_enabled,
    channels: item.default_channels,
  };
}

function TypeRow({
  item,
  config,
  onChange,
}: {
  item: NotificationPolicyRegistryItem;
  config: NotificationPolicyConfig;
  onChange: (patch: Partial<NotificationPolicyTypeConfig>) => void;
}) {
  const { t } = useTranslation();
  const current = config.types[item.key] ?? fallbackConfig(item);
  const channels = current.channels ?? [];

  const toggleChannel = (channel: NotificationPolicyChannel, on: boolean) => {
    const next = on
      ? Array.from(new Set([...channels, channel]))
      : channels.filter((c) => c !== channel);
    onChange({ channels: next.length > 0 ? next : channels });
  };

  return (
    <div className="grid gap-3 border-b py-3 lg:grid-cols-[1fr_auto]" style={{ borderColor: "var(--border)" }}>
      <div className="min-w-0">
        <div className="text-[13.5px] font-semibold" style={{ color: "var(--foreground)" }}>{item.label}</div>
        <div className="text-[12px]" style={{ color: "var(--foreground-50)" }}>{item.hint}</div>
        <code className="mt-1 block text-[11px]" style={{ color: "var(--foreground-30)" }}>{item.key}</code>
        {!item.show_in_cabinet && (
          <div className="mt-1 text-[11px]" style={{ color: "var(--foreground-50)" }}>
            {t("pages.adminNotificationPolicy.staffOnly")}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2 lg:min-w-[280px]">
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={current.enabled} onChange={(e) => onChange({ enabled: e.target.checked })} />
          {t("pages.adminNotificationPolicy.enabled")}
        </label>
        <select
          value={current.min_tier}
          onChange={(e) => onChange({ min_tier: e.target.value as NotificationPolicyTier })}
          style={inputStyle}
          aria-label={t("pages.adminNotificationPolicy.minTierLabel")}
        >
          <option value="registered">{t("pages.adminNotificationPolicy.tierRegistered")}</option>
          <option value="verified">{t("pages.adminNotificationPolicy.tierVerified")}</option>
          <option value="subscriber">{t("pages.adminNotificationPolicy.tierSubscriber")}</option>
        </select>
        <label className="flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={current.user_can_toggle}
            onChange={(e) => onChange({ user_can_toggle: e.target.checked })}
          />
          {t("pages.adminNotificationPolicy.userCanToggle")}
        </label>
        <label className="flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={current.default_enabled}
            onChange={(e) => onChange({ default_enabled: e.target.checked })}
          />
          {t("pages.adminNotificationPolicy.defaultOn")}
        </label>
        <div className="flex flex-wrap gap-3 text-[13px]">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={channels.includes("in_app")}
              onChange={(e) => toggleChannel("in_app", e.target.checked)}
            />
            {t("pages.adminNotificationPolicy.channelInApp")}
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={channels.includes("max")}
              onChange={(e) => toggleChannel("max", e.target.checked)}
            />
            {t("pages.adminNotificationPolicy.channelMax")}
          </label>
        </div>
      </div>
    </div>
  );
}

export function NotificationPolicyAdminCard() {
  const { t } = useTranslation();
  const [config, setConfig] = useState<NotificationPolicyConfig | null>(null);
  const [registry, setRegistry] = useState<NotificationPolicyRegistryItem[]>([]);
  const [groupLabels, setGroupLabels] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAdminNotificationPolicy()
      .then((data) => {
        setConfig(data.config);
        setRegistry(data.registry);
        setGroupLabels(data.group_labels);
      })
      .catch(() => toast.error(t("pages.adminNotificationPolicy.loadFailed")))
      .finally(() => setLoading(false));
  }, [t]);

  const grouped = useMemo(() => {
    const map = new Map<string, NotificationPolicyRegistryItem[]>();
    for (const item of registry) {
      const list = map.get(item.group) ?? [];
      list.push(item);
      map.set(item.group, list);
    }
    return map;
  }, [registry]);

  const patchType = (key: string, patch: Partial<NotificationPolicyTypeConfig>) => {
    setConfig((prev) => {
      if (!prev) return prev;
      const item = registry.find((row) => row.key === key);
      const current = prev.types[key] ?? (item ? fallbackConfig(item) : {
        enabled: true,
        min_tier: "registered" as const,
        user_can_toggle: true,
        default_enabled: true,
        channels: ["in_app", "max"] as NotificationPolicyChannel[],
      });
      return {
        ...prev,
        types: {
          ...prev.types,
          [key]: { ...current, ...patch },
        },
      };
    });
  };

  const save = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const data = await updateAdminNotificationPolicy(config);
      setConfig(data.config);
      toast.success(t("pages.adminNotificationPolicy.saved"));
    } catch {
      toast.error(t("pages.adminNotificationPolicy.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  if (loading || !config) {
    return <p className="text-sm" style={{ color: "var(--foreground-50)" }}>{t("pages.adminCommon.loading")}</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          {t("pages.adminNotificationPolicy.title")}
        </h2>
        <p className="mt-1 text-sm" style={{ color: "var(--foreground-50)" }}>
          {t("pages.adminNotificationPolicy.subtitle")}
        </p>
      </div>

      {[...grouped.entries()].map(([group, items]) => (
        <div key={group} className="rounded-[var(--r-card)] border p-4" style={{ borderColor: "var(--border)", background: "var(--background-elevated)" }}>
          <h3 className="mb-2 text-sm font-semibold">{groupLabels[group] ?? group}</h3>
          {items.map((item) => (
            <TypeRow
              key={item.key}
              item={item}
              config={config}
              onChange={(patch) => patchType(item.key, patch)}
            />
          ))}
        </div>
      ))}

      <button type="button" style={primaryBtn} disabled={saving} onClick={() => void save()}>
        {saving ? t("pages.adminNotificationPolicy.saving") : t("pages.adminNotificationPolicy.saveButton")}
      </button>
    </div>
  );
}
