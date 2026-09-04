import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@/lib/toast";
import {
  fetchAdminFeedGuestAccess,
  updateAdminFeedGuestAccess,
  type AccessTier,
  type FeedGuestAccessConfig,
  type FeedGuestAccessRegistryItem,
} from "@/lib/api/feed-guest-access";
import { invalidateFeedGuestAccessCache, loadFeedGuestAccess } from "@/lib/feed-guest-access/store";

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

const textareaStyle: CSSProperties = {
  ...inputStyle,
  height: "auto",
  minHeight: "72px",
  padding: "10px 14px",
  resize: "vertical" as const,
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

function ActionRow({
  item,
  config,
  onChange,
}: {
  item: FeedGuestAccessRegistryItem;
  config: FeedGuestAccessConfig;
  onChange: (
    patch: Partial<{ min_tier: AccessTier; deny_mode: "inherit" | "popup" | "redirect" }>,
  ) => void;
}) {
  const { t } = useTranslation();
  const fallbackTier = item.default_min_tier ?? (item.default_allowed ? "guest" : "auth");
  const current = config.actions[item.key] ?? {
    min_tier: fallbackTier,
    allowed: fallbackTier === "guest",
    deny_mode: "inherit" as const,
  };
  const minTier = current.min_tier ?? fallbackTier;

  return (
    <div
      className="grid gap-3 border-b py-3 lg:grid-cols-[1fr_auto_auto]"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="min-w-0">
        <div className="text-[13.5px] font-semibold" style={{ color: "var(--foreground)" }}>
          {item.label}
        </div>
        <div className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
          {item.hint}
        </div>
        <code className="mt-1 block text-[11px]" style={{ color: "var(--foreground-30)" }}>
          {item.key}
        </code>
      </div>
      <select
        value={minTier}
        onChange={(e) => onChange({ min_tier: e.target.value as AccessTier })}
        style={{ ...inputStyle, width: 220 }}
        aria-label={t("pages.adminFeedGuestAccess.minTierLabel")}
      >
        <option value="guest">{t("pages.adminFeedGuestAccess.tierGuest")}</option>
        <option value="auth">{t("pages.adminFeedGuestAccess.tierAuth")}</option>
        <option value="subscription">{t("pages.adminFeedGuestAccess.tierSubscription")}</option>
      </select>
      <select
        value={current.deny_mode}
        onChange={(e) =>
          onChange({ deny_mode: e.target.value as "inherit" | "popup" | "redirect" })
        }
        disabled={minTier === "guest"}
        style={{ ...inputStyle, width: 160, opacity: minTier === "guest" ? 0.5 : 1 }}
      >
        <option value="inherit">{t("pages.adminFeedGuestAccess.denyInherit")}</option>
        <option value="popup">{t("pages.adminFeedGuestAccess.denyPopup")}</option>
        <option value="redirect">{t("pages.adminFeedGuestAccess.denyRedirect")}</option>
      </select>
    </div>
  );
}

export function FeedGuestAccessAdminCard() {
  const { t } = useTranslation();
  const [config, setConfig] = useState<FeedGuestAccessConfig | null>(null);
  const [registry, setRegistry] = useState<FeedGuestAccessRegistryItem[]>([]);
  const [groupLabels, setGroupLabels] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAdminFeedGuestAccess()
      .then((data) => {
        setConfig(data.config);
        setRegistry(data.registry);
        setGroupLabels(data.group_labels);
      })
      .catch(() => toast.error(t("pages.adminFeedGuestAccess.loadFailed")))
      .finally(() => setLoading(false));
  }, [t]);

  const grouped = useMemo(() => {
    const map = new Map<string, FeedGuestAccessRegistryItem[]>();
    for (const item of registry) {
      const list = map.get(item.group) ?? [];
      list.push(item);
      map.set(item.group, list);
    }
    return map;
  }, [registry]);

  const patchAction = (
    key: string,
    patch: Partial<{ min_tier: AccessTier; deny_mode: "inherit" | "popup" | "redirect" }>,
  ) => {
    setConfig((prev) => {
      if (!prev) return prev;
      const current = prev.actions[key] ?? {
        min_tier: "auth" as const,
        allowed: false,
        deny_mode: "inherit" as const,
      };
      const next = { ...current, ...patch };
      if (patch.min_tier) next.allowed = patch.min_tier === "guest";
      return {
        ...prev,
        actions: {
          ...prev.actions,
          [key]: next,
        },
      };
    });
  };

  const save = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const data = await updateAdminFeedGuestAccess(config);
      setConfig(data.config);
      invalidateFeedGuestAccessCache();
      await loadFeedGuestAccess();
      toast.success(t("pages.adminFeedGuestAccess.saved"));
    } catch {
      toast.error(t("pages.adminFeedGuestAccess.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  if (loading || !config) {
    return (
      <p className="text-sm" style={{ color: "var(--foreground-50)" }}>
        {t("pages.adminCommon.loading")}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          {t("pages.adminFeedGuestAccess.title")}
        </h2>
        <p className="mt-1 text-sm" style={{ color: "var(--foreground-50)" }}>
          {t("pages.adminFeedGuestAccess.subtitle")}
        </p>
      </div>

      <div
        className="rounded-[var(--r-card)] border p-4"
        style={{ borderColor: "var(--border)", background: "var(--background-elevated)" }}
      >
        <h3 className="mb-3 text-sm font-semibold">
          {t("pages.adminFeedGuestAccess.denyBehaviorTitle")}
        </h3>
        <div className="grid gap-3 lg:grid-cols-2">
          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="radio"
              name="default_deny_mode"
              checked={config.default_deny_mode === "popup"}
              onChange={() => setConfig({ ...config, default_deny_mode: "popup" })}
            />
            {t("pages.adminFeedGuestAccess.showPopup")}
          </label>
          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="radio"
              name="default_deny_mode"
              checked={config.default_deny_mode === "redirect"}
              onChange={() => setConfig({ ...config, default_deny_mode: "redirect" })}
            />
            {t("pages.adminFeedGuestAccess.redirectSubscription")}
          </label>
        </div>
        {/* Полей заголовка, кнопки и текста окна здесь больше нет. Карта их
            хранила, а окно рисует GateDialogShell со своими строками — ни один
            гейт эти тексты не читал. На проде они были переписаны на
            подписочные («Нужна подписка», «Оформить подписку»), и
            администратор, глядя в админку, был вправе считать, что гость видит
            именно их. Настройка, которая ни на что не влияет, вводит в
            заблуждение сильнее, чем её отсутствие. Тексты окна живут в
            переводах, рядом с самим окном. */}
      </div>

      {[...grouped.entries()].map(([group, items]) => (
        <div
          key={group}
          className="rounded-[var(--r-card)] border p-4"
          style={{ borderColor: "var(--border)", background: "var(--background-elevated)" }}
        >
          <h3 className="mb-2 text-sm font-semibold">{groupLabels[group] ?? group}</h3>
          <div
            className="mb-1 hidden gap-3 text-[11px] font-medium uppercase tracking-wide lg:grid lg:grid-cols-[1fr_auto_auto]"
            style={{ color: "var(--foreground-40)" }}
          >
            <span />
            <span className="w-[220px]">{t("pages.adminFeedGuestAccess.minTierLabel")}</span>
            <span className="w-[160px]">{t("pages.adminFeedGuestAccess.denyModeLabel")}</span>
          </div>
          {items.map((item) => (
            <ActionRow
              key={item.key}
              item={item}
              config={config}
              onChange={(patch) => patchAction(item.key, patch)}
            />
          ))}
        </div>
      ))}

      <button type="button" style={primaryBtn} disabled={saving} onClick={() => void save()}>
        {saving
          ? t("pages.adminFeedGuestAccess.saving")
          : t("pages.adminFeedGuestAccess.saveButton")}
      </button>
    </div>
  );
}
