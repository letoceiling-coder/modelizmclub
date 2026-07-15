import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { toast } from "@/lib/toast";
import {
  applyChannel, applyCommunity, fetchCommunityCategories,
  type EntityKind, type CommunityCategoryOption,
} from "@/lib/api/entity-requests";

interface Props {
  kind: EntityKind;
  onClose: () => void;
  onSubmitted: () => void;
}

const TITLE: Record<EntityKind, string> = {
  channel: "Заявка на создание канала",
  community: "Заявка на создание сообщества",
};

const inputStyle = {
  background: "var(--background-surface)",
  borderColor: "var(--border)",
  color: "var(--foreground)",
} as const;

export function EntityRequestForm({ kind, onClose, onSubmitted }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");            // channel: free string
  const [categoryId, setCategoryId] = useState<number | "">(""); // community
  const [cats, setCats] = useState<CommunityCategoryOption[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (kind !== "community") return;
    fetchCommunityCategories().then((list) => {
      setCats(list);
      if (list.length > 0) setCategoryId(list[0].id);
    }).catch(() => {});
  }, [kind]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const submit = async () => {
    if (name.trim().length < 3) { toast.error("Название — минимум 3 символа"); return; }
    setSubmitting(true);
    try {
      if (kind === "community") {
        if (!categoryId) { toast.error("Выберите категорию"); setSubmitting(false); return; }
        await applyCommunity({ proposedName: name.trim(), description: description.trim() || undefined, categoryId: Number(categoryId) });
      } else {
        if (!category.trim()) { toast.error("Укажите тематику"); setSubmitting(false); return; }
        await applyChannel({ name: name.trim(), description: description.trim() || undefined, category: category.trim() });
      }
      toast.success("Заявка отправлена на рассмотрение");
      onSubmitted();
    } catch (e) {
      const already = e instanceof Error && /рассмотрении|pending|application/i.test(e.message);
      toast.error(already ? "У вас уже есть заявка на рассмотрении" : "Не удалось отправить заявку");
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full flex-col overflow-hidden rounded-t-[20px] sm:max-w-[520px] sm:rounded-[16px]"
        style={{ background: "var(--background-elevated)", border: "1px solid var(--border)", maxHeight: "90dvh" }}
      >
        <header className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
          <h2 className="flex-1 text-[16px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}>
            {TITLE[kind]}
          </h2>
          <button
            type="button" aria-label="Закрыть" onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full transition-colors hover:bg-[var(--background-surface)]"
            style={{ color: "var(--foreground-70)" }}
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex flex-col gap-3 overflow-y-auto px-4 py-4">
          <label className="flex flex-col gap-1">
            <span className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>Название</span>
            <input
              value={name} onChange={(e) => setName(e.target.value)} maxLength={120}
              placeholder={kind === "channel" ? "Название канала" : "Название сообщества"}
              className="h-11 rounded-[10px] border px-3 text-[14px] outline-none" style={inputStyle}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>
              Описание <span style={{ color: "var(--foreground-50)" }}>(необязательно)</span>
            </span>
            <textarea
              value={description} onChange={(e) => setDescription(e.target.value)} maxLength={5000} rows={3}
              placeholder="Коротко о теме"
              className="resize-none rounded-[10px] border px-3 py-2 text-[14px] outline-none" style={inputStyle}
            />
          </label>

          {kind === "community" ? (
            <label className="flex flex-col gap-1">
              <span className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>Категория</span>
              <select
                value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))}
                className="h-11 rounded-[10px] border px-3 text-[14px] outline-none" style={inputStyle}
              >
                {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          ) : (
            <label className="flex flex-col gap-1">
              <span className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>Тематика</span>
              <input
                value={category} onChange={(e) => setCategory(e.target.value)} maxLength={120}
                placeholder="Например: Стендовые модели"
                className="h-11 rounded-[10px] border px-3 text-[14px] outline-none" style={inputStyle}
              />
            </label>
          )}
        </div>

        <div className="border-t px-4 py-3" style={{ borderColor: "var(--border)", paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
          <button
            type="button" onClick={submit} disabled={submitting}
            className="h-12 w-full rounded-[12px] text-[15px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
          >
            {submitting ? "Отправляем…" : "Отправить заявку"}
          </button>
        </div>
      </div>
    </div>
  );
}
