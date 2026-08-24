import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeleteCommunityDialog } from "@/components/communities/DeleteCommunityDialog";
import { CommunityBrandingForm } from "@/components/communities/CommunityBrandingForm";
import { fetchCommunityCategories, type CommunityCategoryOption } from "@/lib/api/entity-requests";
import { updateCommunity, fetchCommunityJoinRequests, decideCommunityJoinRequest, type CommunityJoinRequestRow } from "@/lib/api/communities";
import type { Community } from "@/lib/mock";
import { toast } from "@/lib/toast";
import { COMMUNITY_DESCRIPTION_MAX, COMMUNITY_NAME_MAX, COMMUNITY_RULES_MAX } from "@/lib/community-limits";
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
  const [accessType, setAccessType] = useState<"open" | "request">(community.accessType ?? "open");
  const [rules, setRules] = useState(community.rules ?? "");
  const [telegram, setTelegram] = useState(community.contacts?.telegram ?? "");
  const [website, setWebsite] = useState(community.contacts?.website ?? "");
  const [phone, setPhone] = useState(community.contacts?.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [requests, setRequests] = useState<CommunityJoinRequestRow[]>([]);

  useEffect(() => {
    fetchCommunityCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    setName(community.name);
    setDescription(community.description);
    setAccessType(community.accessType ?? "open");
    setRules(community.rules ?? "");
    setTelegram(community.contacts?.telegram ?? "");
    setWebsite(community.contacts?.website ?? "");
    setPhone(community.contacts?.phone ?? "");
    if (community.categoryId) {
      setCategoryId(String(community.categoryId));
      return;
    }
    const match = categories.find((c) => c.name === community.category);
    setCategoryId(match ? String(match.id) : "");
  }, [community, categories]);

  useEffect(() => {
    if (isDemoMode()) return;
    fetchCommunityJoinRequests(community.id).then(setRequests).catch(() => setRequests([]));
  }, [community.id]);

  const resolvedCategoryId = categoryId ? Number(categoryId) : community.categoryId;

  const dirty =
    name.trim() !== community.name
    || description.trim() !== community.description
    || (resolvedCategoryId ?? 0) !== (community.categoryId ?? 0)
    || accessType !== (community.accessType ?? "open")
    || rules.trim() !== (community.rules ?? "")
    || telegram.trim() !== (community.contacts?.telegram ?? "")
    || website.trim() !== (community.contacts?.website ?? "")
    || phone.trim() !== (community.contacts?.phone ?? "");

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
        accessType,
        rules: rules.trim() || null,
        contacts: {
          telegram: telegram.trim(),
          website: website.trim(),
          phone: phone.trim(),
        },
      });
      onUpdated(updated);
      toast.success("Настройки сохранены. Название и описание проходят модерацию.");
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
          <span className="flex items-center justify-between text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>
            <span>Название</span>
            <span className="font-mono text-[11px] tabular-nums" style={{ color: "var(--foreground-30)" }}>{name.length}/{COMMUNITY_NAME_MAX}</span>
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={COMMUNITY_NAME_MAX}
            className="h-11 rounded-[10px] border px-3 text-[14px] outline-none"
            style={inputStyle}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="flex items-center justify-between text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>
            <span>Описание</span>
            <span className="font-mono text-[11px] tabular-nums" style={{ color: "var(--foreground-30)" }}>{description.length}/{COMMUNITY_DESCRIPTION_MAX}</span>
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={COMMUNITY_DESCRIPTION_MAX}
            rows={5}
            className="rounded-[10px] border px-3 py-2.5 text-[14px] outline-none resize-y min-h-[120px] break-words"
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

        <div className="grid gap-[8px] sm:grid-cols-2">
          {(["open", "request"] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => setAccessType(kind)}
              className="rounded-[12px] border p-3 text-left text-[13px]"
              style={{
                borderColor: accessType === kind ? "var(--accent)" : "var(--border)",
                background: accessType === kind ? "var(--accent-soft)" : "var(--background-surface)",
                color: "var(--foreground)",
              }}
            >
              {kind === "open" ? "Открытое — вступление сразу" : "Закрытое — по заявке"}
            </button>
          ))}
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="flex items-center justify-between text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>
            <span>Правила</span>
            <span className="font-mono text-[11px] tabular-nums" style={{ color: "var(--foreground-30)" }}>{rules.length}/{COMMUNITY_RULES_MAX}</span>
          </span>
          <textarea
            value={rules}
            onChange={(e) => setRules(e.target.value)}
            maxLength={COMMUNITY_RULES_MAX}
            rows={4}
            className="rounded-[10px] border px-3 py-2.5 text-[14px] outline-none resize-y min-h-[96px]"
            style={inputStyle}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>Telegram</span>
          <input value={telegram} onChange={(e) => setTelegram(e.target.value)} className="h-11 rounded-[10px] border px-3 text-[14px] outline-none" style={inputStyle} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>Сайт</span>
          <input value={website} onChange={(e) => setWebsite(e.target.value)} className="h-11 rounded-[10px] border px-3 text-[14px] outline-none" style={inputStyle} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>Телефон</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="h-11 rounded-[10px] border px-3 text-[14px] outline-none" style={inputStyle} />
        </label>

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

      {requests.length > 0 && (
        <section className="space-y-3 border-t pt-5" style={{ borderColor: "var(--border)" }}>
          <h3 className="text-[13px] font-semibold uppercase tracking-wider" style={{ color: "var(--foreground-50)" }}>
            Заявки на вступление
          </h3>
          {requests.map((row) => (
            <div key={row.id} className="flex items-center justify-between gap-3 rounded-[10px] border px-3 py-2" style={{ borderColor: "var(--border)" }}>
              <div className="min-w-0">
                <div className="truncate text-[14px] font-medium" style={{ color: "var(--foreground)" }}>{row.user.name}</div>
                {row.message && <div className="text-[12px]" style={{ color: "var(--foreground-50)" }}>{row.message}</div>}
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => void decideCommunityJoinRequest(community.id, row.id, "approve").then(() => setRequests((prev) => prev.filter((r) => r.id !== row.id)))}>Принять</Button>
                <Button size="sm" variant="outline" onClick={() => void decideCommunityJoinRequest(community.id, row.id, "reject").then(() => setRequests((prev) => prev.filter((r) => r.id !== row.id)))}>Отклонить</Button>
              </div>
            </div>
          ))}
        </section>
      )}

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
