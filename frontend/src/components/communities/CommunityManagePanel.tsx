import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DangerZone,
  ManageSection,
  SaveButton,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/entity/ManageFields";
import { DeleteCommunityDialog } from "@/components/communities/DeleteCommunityDialog";
import { CommunityBrandingForm } from "@/components/communities/CommunityBrandingForm";
import { fetchCommunityCategories, type CommunityCategoryOption } from "@/lib/api/entity-requests";
import {
  updateCommunity,
  fetchCommunityJoinRequests,
  decideCommunityJoinRequest,
  type CommunityJoinRequestRow,
} from "@/lib/api/communities";
import type { Community } from "@/lib/mock";
import { toast } from "@/lib/toast";
import {
  COMMUNITY_DESCRIPTION_MAX,
  COMMUNITY_NAME_MAX,
  COMMUNITY_RULES_MAX,
} from "@/lib/community-limits";
import { isDemoMode } from "@/lib/demo-mode";

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
    fetchCommunityCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
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
    fetchCommunityJoinRequests(community.id)
      .then(setRequests)
      .catch(() => setRequests([]));
  }, [community.id]);

  const resolvedCategoryId = categoryId ? Number(categoryId) : community.categoryId;

  const dirty =
    name.trim() !== community.name ||
    description.trim() !== community.description ||
    (resolvedCategoryId ?? 0) !== (community.categoryId ?? 0) ||
    accessType !== (community.accessType ?? "open") ||
    rules.trim() !== (community.rules ?? "") ||
    telegram.trim() !== (community.contacts?.telegram ?? "") ||
    website.trim() !== (community.contacts?.website ?? "") ||
    phone.trim() !== (community.contacts?.phone ?? "");

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
      <ManageSection title="Оформление" divided={false}>
        <CommunityBrandingForm community={community} Icon={Icon} onUpdated={onUpdated} />
      </ManageSection>

      <ManageSection title="Основное">
        <TextField label="Название" value={name} onChange={setName} max={COMMUNITY_NAME_MAX} />

        <TextAreaField
          label="Описание"
          value={description}
          onChange={setDescription}
          max={COMMUNITY_DESCRIPTION_MAX}
          rows={5}
          minHeight={120}
        />

        <SelectField label="Категория" value={categoryId} onChange={setCategoryId}>
          <option value="">Выберите категорию</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>

        <div className="grid gap-[8px] sm:grid-cols-2">
          {(["open", "request"] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => setAccessType(kind)}
              className="rounded-[12px] border p-3 text-left text-[13px]"
              style={{
                borderColor: accessType === kind ? "var(--accent)" : "var(--border)",
                background:
                  accessType === kind ? "var(--accent-soft)" : "var(--background-surface)",
                color: "var(--foreground)",
              }}
            >
              {kind === "open" ? "Открытое — вступление сразу" : "Закрытое — по заявке"}
            </button>
          ))}
        </div>

        <TextAreaField
          label="Правила"
          value={rules}
          onChange={setRules}
          max={COMMUNITY_RULES_MAX}
          rows={4}
          minHeight={96}
        />

        <TextField label="Telegram" value={telegram} onChange={setTelegram} />
        <TextField label="Сайт" value={website} onChange={setWebsite} />
        <TextField label="Телефон" value={phone} onChange={setPhone} />

        <SaveButton
          disabled={!dirty || saving}
          busy={saving}
          label="Сохранить изменения"
          busyLabel="Сохраняем…"
          onClick={() => void save()}
        />
      </ManageSection>

      {requests.length > 0 && (
        <ManageSection title="Заявки на вступление">
          {requests.map((row) => (
            <div
              key={row.id}
              className="flex items-center justify-between gap-3 rounded-[10px] border px-3 py-2"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="min-w-0">
                <div
                  className="truncate text-[14px] font-medium"
                  style={{ color: "var(--foreground)" }}
                >
                  {row.user.name}
                </div>
                {row.message && (
                  <div className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
                    {row.message}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    void decideCommunityJoinRequest(community.id, row.id, "approve").then(() =>
                      setRequests((prev) => prev.filter((r) => r.id !== row.id)),
                    )
                  }
                >
                  Принять
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void decideCommunityJoinRequest(community.id, row.id, "reject").then(() =>
                      setRequests((prev) => prev.filter((r) => r.id !== row.id)),
                    )
                  }
                >
                  Отклонить
                </Button>
              </div>
            </div>
          ))}
        </ManageSection>
      )}

      <DangerZone
        title="Опасная зона"
        warning="Удаление необратимо: сообщество исчезнет из поиска и списков для всех пользователей."
      >
        <DeleteCommunityDialog slug={community.id} name={community.name} onDeleted={onDeleted} />
      </DangerZone>
    </div>
  );
}
