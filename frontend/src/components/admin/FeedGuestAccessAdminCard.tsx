import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { toast } from "@/lib/toast";
import {
  fetchAdminFeedGuestAccess,
  updateAdminFeedGuestAccess,
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
  onChange: (patch: Partial<{ allowed: boolean; deny_mode: "inherit" | "popup" | "redirect" }>) => void;
}) {
  const current = config.actions[item.key] ?? { allowed: item.default_allowed, deny_mode: "inherit" as const };

  return (
    <div
      className="grid gap-3 border-b py-3 lg:grid-cols-[1fr_auto_auto]"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="min-w-0">
        <div className="text-[13.5px] font-semibold" style={{ color: "var(--foreground)" }}>{item.label}</div>
        <div className="text-[12px]" style={{ color: "var(--foreground-50)" }}>{item.hint}</div>
        <code className="mt-1 block text-[11px]" style={{ color: "var(--foreground-30)" }}>{item.key}</code>
      </div>
      <label className="flex items-center gap-2 text-[13px]" style={{ color: "var(--foreground-70)" }}>
        <input
          type="checkbox"
          checked={current.allowed}
          onChange={(e) => onChange({ allowed: e.target.checked })}
        />
        Доступно гостям
      </label>
      <select
        value={current.deny_mode}
        onChange={(e) => onChange({ deny_mode: e.target.value as "inherit" | "popup" | "redirect" })}
        disabled={current.allowed}
        style={{ ...inputStyle, width: 160, opacity: current.allowed ? 0.5 : 1 }}
      >
        <option value="inherit">По умолчанию</option>
        <option value="popup">Попап</option>
        <option value="redirect">Редирект</option>
      </select>
    </div>
  );
}

export function FeedGuestAccessAdminCard() {
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
      .catch(() => toast.error("Не удалось загрузить права доступа"))
      .finally(() => setLoading(false));
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, FeedGuestAccessRegistryItem[]>();
    for (const item of registry) {
      const list = map.get(item.group) ?? [];
      list.push(item);
      map.set(item.group, list);
    }
    return map;
  }, [registry]);

  const patchAction = (key: string, patch: Partial<{ allowed: boolean; deny_mode: "inherit" | "popup" | "redirect" }>) => {
    setConfig((prev) => {
      if (!prev) return prev;
      const current = prev.actions[key] ?? { allowed: true, deny_mode: "inherit" as const };
      return {
        ...prev,
        actions: {
          ...prev.actions,
          [key]: { ...current, ...patch },
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
      toast.success("Права доступа сохранены");
    } catch {
      toast.error("Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !config) {
    return <p className="text-sm" style={{ color: "var(--foreground-50)" }}>Загрузка…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>Права гостей на /feed</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--foreground-50)" }}>
          Управление доступом для неавторизованных пользователей: клики в ленте, меню и переходы по URL.
        </p>
      </div>

      <div className="rounded-[var(--r-card)] border p-4" style={{ borderColor: "var(--border)", background: "var(--background-elevated)" }}>
        <h3 className="mb-3 text-sm font-semibold">Поведение при запрете</h3>
        <div className="grid gap-3 lg:grid-cols-2">
          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="radio"
              name="default_deny_mode"
              checked={config.default_deny_mode === "popup"}
              onChange={() => setConfig({ ...config, default_deny_mode: "popup" })}
            />
            Показывать попап
          </label>
          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="radio"
              name="default_deny_mode"
              checked={config.default_deny_mode === "redirect"}
              onChange={() => setConfig({ ...config, default_deny_mode: "redirect" })}
            />
            Перенаправлять на /subscription
          </label>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <label className="block text-[12px]" style={{ color: "var(--foreground-70)" }}>
            Заголовок попапа
            <input
              style={{ ...inputStyle, marginTop: 6 }}
              value={config.popup.title}
              onChange={(e) => setConfig({ ...config, popup: { ...config.popup, title: e.target.value } })}
            />
          </label>
          <label className="block text-[12px]" style={{ color: "var(--foreground-70)" }}>
            Кнопка «Оформить»
            <input
              style={{ ...inputStyle, marginTop: 6 }}
              value={config.popup.primary_cta}
              onChange={(e) => setConfig({ ...config, popup: { ...config.popup, primary_cta: e.target.value } })}
            />
          </label>
          <label className="block text-[12px] lg:col-span-2" style={{ color: "var(--foreground-70)" }}>
            Текст попапа
            <textarea
              style={{ ...textareaStyle, marginTop: 6 }}
              value={config.popup.description}
              onChange={(e) => setConfig({ ...config, popup: { ...config.popup, description: e.target.value } })}
            />
          </label>
        </div>
      </div>

      {[...grouped.entries()].map(([group, items]) => (
        <div key={group} className="rounded-[var(--r-card)] border p-4" style={{ borderColor: "var(--border)", background: "var(--background-elevated)" }}>
          <h3 className="mb-2 text-sm font-semibold">{groupLabels[group] ?? group}</h3>
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
        {saving ? "Сохранение…" : "Сохранить права доступа"}
      </button>
    </div>
  );
}
