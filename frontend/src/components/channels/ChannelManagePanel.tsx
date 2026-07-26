import { useEffect, useMemo, useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeleteChannelDialog } from "@/components/channels/DeleteChannelDialog";
import { ChannelBrandingForm } from "@/components/channels/ChannelBrandingForm";
import {
  updateChannel,
  kindLabel,
  type Channel,
  type ChannelKind,
} from "@/lib/channels";
import { usePostCategories } from "@/lib/hooks/useCategories";
import { toast } from "@/lib/toast";
import { isDemoMode } from "@/lib/demo-mode";

const OTHER_DIRECTION = "Другое";

const EDITABLE_KINDS: ChannelKind[] = ["author", "expert", "brand", "shop"];

const inputStyle = {
  background: "var(--background-surface)",
  borderColor: "var(--border)",
  color: "var(--foreground)",
} as const;

interface Props {
  channel: Channel;
  onUpdated: (channel: Channel) => void;
  onDeleted: () => void;
}

export function ChannelManagePanel({ channel, onUpdated, onDeleted }: Props) {
  const directions = usePostCategories();
  const directionNames = useMemo(() => directions.map((d) => d.name), [directions]);

  const [name, setName] = useState(channel.name);
  const [description, setDescription] = useState(channel.description);
  const [kind, setKind] = useState<ChannelKind>(channel.kind);
  const [category, setCategory] = useState(
    channel.category && !directionNames.includes(channel.category) ? OTHER_DIRECTION : channel.category,
  );
  const [customCategory, setCustomCategory] = useState(
    channel.category && !directionNames.includes(channel.category) ? channel.category : "",
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(channel.name);
    setDescription(channel.description);
    setKind(channel.kind);
    const inList = directionNames.includes(channel.category);
    setCategory(inList ? channel.category : channel.category ? OTHER_DIRECTION : "");
    setCustomCategory(inList ? "" : channel.category);
  }, [channel, directionNames]);

  const resolvedCategory = category === OTHER_DIRECTION ? customCategory.trim() : category.trim();

  const dirty =
    name.trim() !== channel.name
    || description.trim() !== channel.description
    || resolvedCategory !== (channel.category ?? "")
    || (channel.kind !== "official" && kind !== channel.kind);

  const save = async () => {
    if (!name.trim()) {
      toast.error("Укажите название канала");
      return;
    }
    if (category === OTHER_DIRECTION && !customCategory.trim()) {
      toast.error("Укажите тематику канала");
      return;
    }

    setSaving(true);
    try {
      if (isDemoMode()) {
        toast.success("Изменения сохранены (демо)");
        onUpdated({
          ...channel,
          name: name.trim(),
          description: description.trim(),
          category: resolvedCategory,
          kind: channel.kind === "official" ? channel.kind : kind,
        });
        return;
      }

      const updated = await updateChannel(channel.slug, {
        name: name.trim(),
        description: description.trim(),
        category: resolvedCategory || undefined,
        ...(channel.kind !== "official" ? { kind } : {}),
      });
      onUpdated(updated);
      toast.success("Настройки канала сохранены");
    } catch {
      toast.error("Не удалось сохранить настройки");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <section className="space-y-4">
        <h3 className="text-[13px] font-semibold uppercase tracking-wider" style={{ color: "var(--foreground-50)" }}>
          Оформление
        </h3>
        <ChannelBrandingForm channel={channel} onUpdated={onUpdated} />
      </section>

      <section className="space-y-4 border-t pt-5" style={{ borderColor: "var(--border)" }}>
        <h3 className="text-[13px] font-semibold uppercase tracking-wider" style={{ color: "var(--foreground-50)" }}>
          Основное
        </h3>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>Название</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              className="h-11 rounded-[10px] border px-3 text-[14px] outline-none"
              style={inputStyle}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>Описание</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={5000}
              rows={5}
              className="rounded-[10px] border px-3 py-2.5 text-[14px] outline-none resize-y min-h-[120px]"
              style={inputStyle}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>Тематика</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-11 rounded-[10px] border px-3 text-[14px] outline-none"
              style={inputStyle}
            >
              <option value="">Выберите направление</option>
              {directions.map((d) => (
                <option key={d.id} value={d.name}>{d.name}</option>
              ))}
              <option value={OTHER_DIRECTION}>{OTHER_DIRECTION}</option>
            </select>
          </label>

          {category === OTHER_DIRECTION && (
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>Уточните тематику</span>
              <input
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                maxLength={120}
                placeholder="Например: Стендовые модели"
                className="h-11 rounded-[10px] border px-3 text-[14px] outline-none"
                style={inputStyle}
              />
            </label>
          )}

          {channel.kind !== "official" ? (
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>Тип канала</span>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as ChannelKind)}
                className="h-11 rounded-[10px] border px-3 text-[14px] outline-none"
                style={inputStyle}
              >
                {EDITABLE_KINDS.map((k) => (
                  <option key={k} value={k}>{kindLabel(k)}</option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-[13px]" style={{ color: "var(--foreground-50)" }}>
              Тип: {kindLabel(channel.kind)} (официальный канал, изменение недоступно)
            </p>
          )}

          <div
            className="rounded-[10px] border p-3 text-[13px]"
            style={{ borderColor: "var(--border)", background: "var(--background-surface)", color: "var(--foreground-70)" }}
          >
            Каналы на платформе публичные: их видят все пользователи. Настройка приватности пока недоступна.
          </div>

          <Button
            type="button"
            onClick={() => void save()}
            disabled={!dirty || saving}
            className="w-full rounded-[12px] gap-2 sm:w-auto"
          >
            <Save size={16} />
            {saving ? "Сохраняем…" : "Сохранить изменения"}
          </Button>
      </section>

      <section className="space-y-4 border-t pt-5" style={{ borderColor: "var(--border)" }}>
        <h3 className="text-[13px] font-semibold uppercase tracking-wider" style={{ color: "var(--foreground-50)" }}>
          Опасная зона
        </h3>
        <p className="text-[14px] leading-relaxed" style={{ color: "var(--foreground-70)" }}>
          Удаление необратимо: канал исчезнет из каталога, подписчики потеряют доступ ко всем постам.
        </p>
        <DeleteChannelDialog slug={channel.slug} name={channel.name} onDeleted={onDeleted} />
      </section>
    </div>
  );
}
