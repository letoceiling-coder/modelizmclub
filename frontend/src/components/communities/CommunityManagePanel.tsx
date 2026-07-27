import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeleteCommunityDialog } from "@/components/communities/DeleteCommunityDialog";
import { CommunityBrandingForm } from "@/components/communities/CommunityBrandingForm";
import { fetchCommunityCategories, type CommunityCategoryOption } from "@/lib/api/entity-requests";
import { updateCommunity } from "@/lib/api/communities";
import type { Community } from "@/lib/mock";
import { toast } from "@/lib/toast";
import { isDemoMode } from "@/lib/demo-mode";

const inputStyle = {
  background: "var(--background-surface)",
  borderColor: "var(--border)",
  color: "var(--foreground)",
} as const;

interface Props {
  community: Community;
  Icon: LucideIcon;
  onUpdated: (community: Community) => void;
  onDeleted: () => void;
}

export function CommunityManagePanel({ community, Icon, onUpdated, onDeleted }: Props) {
  const [categories, setCategories] = useState<CommunityCategoryOption[]>([]);
  const [name, setName] = useState(community.name);
  const [description, setDescription] = useState(community.description);
  const [categoryId, setCategoryId] = useState(String(community.categoryId ?? ""));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCommunityCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    setName(community.name);
    setDescription(community.description);
    if (community.categoryId) {
      setCategoryId(String(community.categoryId));
      return;
    }
    const match = categories.find((c) => c.name === community.category);
    setCategoryId(match ? String(match.id) : "");
  }, [community, categories]);

  const resolvedCategoryId = categoryId ? Number(categoryId) : community.categoryId;

  const dirty =
    name.trim() !== community.name
    || description.trim() !== community.description
    || (resolvedCategoryId ?? 0) !== (community.categoryId ?? 0);

  const save = async () => {
    if (!name.trim()) {
      toast.error("Укажите название сообщества");
      return;
    }
    if (!categoryId) {
      toast.error("Выберите категорию");
      return;
    }

    setSaving(true);
    try {
      if (isDemoMode()) {
        toast.success("Изменения сохранены (демо)");
        onUpdated({
          ...community,
          name: name.trim(),
          description: description.trim(),
          categoryId: Number(categoryId),
          category: categories.find((c) => c.id === Number(categoryId))?.name ?? community.category,
        });
        return;
      }

      const updated = await updateCommunity(community.id, {
        name: name.trim(),
        description: description.trim(),
        categoryId: Number(categoryId),
      });
      onUpdated(updated);
      toast.success("Изменения отправлены на модерацию. После проверки они будут опубликованы автоматически.");
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
        <CommunityBrandingForm community={community} Icon={Icon} onUpdated={onUpdated} />
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
          <span className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>Категория</span>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="h-11 rounded-[10px] border px-3 text-[14px] outline-none"
            style={inputStyle}
          >
            <option value="">Выберите категорию</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>

        <div
          className="rounded-[10px] border p-3 text-[13px]"
          style={{ borderColor: "var(--border)", background: "var(--background-surface)", color: "var(--foreground-70)" }}
        >
          Сообщества на платформе публичные: их видят все пользователи. Настройка приватности пока недоступна.
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
          Удаление необратимо: сообщество исчезнет из поиска и списков для всех пользователей.
        </p>
        <DeleteCommunityDialog slug={community.id} name={community.name} onDeleted={onDeleted} />
      </section>
    </div>
  );
}
