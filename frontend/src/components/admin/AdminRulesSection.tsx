import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, History, Plus, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RulesDocumentView } from "@/components/legal/RulesDocumentView";
import {
  adminCreateRulePage,
  adminDeleteRulePage,
  adminDuplicateRulePage,
  adminFetchRulePageRevisions,
  adminFetchRulePages,
  adminPublishRulePage,
  adminRestoreRulePageRevision,
  adminUpdateRulePage,
  type AdminRulePage,
  type RuleSection,
  type RuleSectionType,
} from "@/lib/api/rules";
import { toast } from "@/lib/toast";
import { formatApiErrorMessage } from "@/lib/api/validationErrors";

const SECTION_TYPES: { value: RuleSectionType; label: string }[] = [
  { value: "intro", label: "Вступление" },
  { value: "section", label: "Раздел" },
  { value: "requisites", label: "Реквизиты" },
  { value: "footer_note", label: "Подпись" },
];

const EMPTY_PAGE = {
  slug: "",
  title: "",
  seo_title: "",
  seo_description: "",
  summary: "",
  sort: 100,
};

function emptySection(type: RuleSectionType, position: number): RuleSection {
  return { type, title: type === "section" ? "" : null, content: "", position, is_visible: true };
}

export function AdminRulesSection() {
  const qc = useQueryClient();
  const { data: pages = [], isLoading } = useQuery({ queryKey: ["admin-rule-pages"], queryFn: adminFetchRulePages });
  const [editing, setEditing] = useState<AdminRulePage | null>(null);
  const [creating, setCreating] = useState(false);
  const [meta, setMeta] = useState(EMPTY_PAGE);
  const [sections, setSections] = useState<RuleSection[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const revisionsQuery = useQuery({
    queryKey: ["admin-rule-revisions", editing?.id],
    queryFn: () => adminFetchRulePageRevisions(editing!.id),
    enabled: Boolean(editing?.id) && showHistory,
  });

  const payload = () => ({
    slug: meta.slug.trim(),
    title: meta.title.trim(),
    seo_title: meta.seo_title.trim() || undefined,
    seo_description: meta.seo_description.trim() || undefined,
    summary: meta.summary.trim() || undefined,
    sort: Number(meta.sort) || 0,
    sections: sections.map((s, i) => ({ ...s, position: i })),
  });

  const saveMut = useMutation({
    mutationFn: () => (editing ? adminUpdateRulePage(editing.id, payload()) : adminCreateRulePage(payload())),
    onSuccess: async (page) => {
      await qc.invalidateQueries({ queryKey: ["admin-rule-pages"] });
      toast.success(editing ? "Черновик сохранён" : "Страница создана как черновик");
      startEdit(page);
      setCreating(false);
    },
    onError: (e) => toast.error(formatApiErrorMessage(e, "Ошибка сохранения")),
  });

  const publishMut = useMutation({
    mutationFn: async () => {
      const saved = editing ? await adminUpdateRulePage(editing.id, payload()) : await adminCreateRulePage(payload());
      return adminPublishRulePage(saved.id);
    },
    onSuccess: async (page) => {
      await qc.invalidateQueries({ queryKey: ["admin-rule-pages"] });
      toast.success("Опубликовано");
      startEdit(page);
      setCreating(false);
    },
    onError: (e) => toast.error(formatApiErrorMessage(e, "Не удалось опубликовать")),
  });

  const duplicateMut = useMutation({
    mutationFn: (id: number) => adminDuplicateRulePage(id),
    onSuccess: async (page) => {
      await qc.invalidateQueries({ queryKey: ["admin-rule-pages"] });
      toast.success("Копия создана как черновик");
      startEdit(page);
    },
    onError: (e) => toast.error(formatApiErrorMessage(e, "Не удалось дублировать")),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => adminDeleteRulePage(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin-rule-pages"] });
      toast.success("Страница удалена");
      resetEditor();
    },
    onError: (e) => toast.error(formatApiErrorMessage(e, "Не удалось удалить")),
  });

  const restoreMut = useMutation({
    mutationFn: (revisionId: number) => adminRestoreRulePageRevision(editing!.id, revisionId),
    onSuccess: async (page) => {
      await qc.invalidateQueries({ queryKey: ["admin-rule-pages"] });
      await qc.invalidateQueries({ queryKey: ["admin-rule-revisions", page.id] });
      toast.success("Версия восстановлена как черновик");
      startEdit(page);
    },
    onError: (e) => toast.error(formatApiErrorMessage(e, "Не удалось восстановить")),
  });

  function resetEditor() {
    setEditing(null);
    setCreating(false);
    setMeta(EMPTY_PAGE);
    setSections([]);
    setShowHistory(false);
    setShowPreview(false);
  }

  function startEdit(p: AdminRulePage) {
    setCreating(false);
    setEditing(p);
    setMeta({
      slug: p.slug,
      title: p.title,
      seo_title: p.seo_title ?? "",
      seo_description: p.seo_description ?? "",
      summary: p.summary ?? "",
      sort: p.sort,
    });
    setSections(p.sections.map((s, i) => ({ ...s, position: i, is_visible: s.is_visible !== false })));
    setShowPreview(false);
  }

  function startCreate() {
    setEditing(null);
    setCreating(true);
    setMeta(EMPTY_PAGE);
    setSections([emptySection("intro", 0)]);
    setShowHistory(false);
    setShowPreview(false);
  }

  function move(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= sections.length) return;
    const copy = [...sections];
    [copy[index], copy[next]] = [copy[next], copy[index]];
    setSections(copy.map((s, i) => ({ ...s, position: i })));
  }

  const previewHub = useMemo(
    () => ({
      title: "Правила Моделизма",
      intro: "",
      documents: pages.map((p) => ({
        slug: p.slug,
        title: p.title,
        summary: p.summary,
        published_at: p.published_at,
        href: `/rules/${p.slug}`,
      })),
    }),
    [pages],
  );

  const previewPage = {
    slug: meta.slug || "preview",
    title: meta.title || "Без названия",
    seo_title: meta.seo_title,
    seo_description: meta.seo_description,
    summary: meta.summary,
    version: editing?.version ?? 1,
    published_at: editing?.published_at ?? null,
    sections: sections.filter((s) => s.is_visible !== false),
  };

  if (isLoading) return <p>Загрузка…</p>;

  const editorOpen = creating || Boolean(editing);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="flex items-center justify-between gap-3">
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Правила</h2>
        <Button type="button" size="sm" onClick={startCreate}>
          <Plus size={14} /> Создать страницу
        </Button>
      </div>
      <p className="text-xs" style={{ color: "var(--foreground-50)" }}>
        Хаб /rules собирается из опубликованных документов. Каждый документ редактируется блоками (вступление, разделы, реквизиты). Публикация сохраняет версию и дату редакции — без деплоя.
      </p>

      <div
        className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-4"
        style={{ borderColor: "var(--accent)", background: "var(--accent-soft)" }}
      >
        <div className="flex min-w-0 items-start gap-3">
          <Scale size={22} style={{ color: "var(--accent)", marginTop: 2 }} />
          <div>
            <div className="text-sm font-semibold">Раздел «Правила Моделизма»</div>
            <p className="mt-1 text-xs" style={{ color: "var(--foreground-70)" }}>
              Публичные адреса /rules, /rules/terms, /rules/ads, /rules/services-offer, /rules/safe-deal
            </p>
          </div>
        </div>
      </div>

      <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            <th className="py-2 text-left">Название</th>
            <th className="py-2 text-left">Slug</th>
            <th className="py-2 text-left">Версия</th>
            <th className="py-2 text-left">Редакция</th>
            <th className="py-2 text-left">Статус</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {pages.map((p) => (
            <tr key={p.id} style={{ borderBottom: "1px solid var(--border)" }}>
              <td className="py-2">{p.title}</td>
              <td className="py-2 font-mono text-xs">{p.slug}</td>
              <td className="py-2">{p.version}</td>
              <td className="py-2 text-xs">{p.published_at ? new Date(p.published_at).toLocaleDateString("ru-RU") : "—"}</td>
              <td className="py-2">{p.status === "published" ? "Опубликована" : p.status === "draft" ? "Черновик" : "Архив"}</td>
              <td className="py-2 text-right">
                <div className="flex flex-wrap justify-end gap-1">
                  <Button type="button" size="sm" variant="outline" onClick={() => startEdit(p)}>
                    Редактировать
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => duplicateMut.mutate(p.id)}>
                    Дублировать
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (confirm(`Удалить «${p.title}»?`)) deleteMut.mutate(p.id);
                    }}
                  >
                    Удалить
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editorOpen && (
        <div className="grid gap-4 rounded-lg border p-4" style={{ borderColor: "var(--border)" }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{creating ? "Новая страница" : `Редактирование: ${editing?.title}`}</h3>
            <Button type="button" size="sm" variant="ghost" onClick={resetEditor}>
              Закрыть
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-xs">
              Title (H1)
              <Input value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} />
            </label>
            <label className="grid gap-1 text-xs">
              Slug
              <Input value={meta.slug} onChange={(e) => setMeta({ ...meta, slug: e.target.value })} placeholder="terms" />
            </label>
            <label className="grid gap-1 text-xs">
              SEO title
              <Input value={meta.seo_title} onChange={(e) => setMeta({ ...meta, seo_title: e.target.value })} />
            </label>
            <label className="grid gap-1 text-xs">
              SEO description
              <Input value={meta.seo_description} onChange={(e) => setMeta({ ...meta, seo_description: e.target.value })} />
            </label>
            <label className="grid gap-1 text-xs md:col-span-2">
              Краткое описание для хаба
              <Input value={meta.summary} onChange={(e) => setMeta({ ...meta, summary: e.target.value })} />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold">Блоки</h4>
            <div className="flex flex-wrap gap-1">
              {SECTION_TYPES.map((t) => (
                <Button
                  key={t.value}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setSections((prev) => [...prev, emptySection(t.value, prev.length)])}
                >
                  + {t.label}
                </Button>
              ))}
            </div>
          </div>

          {sections.map((section, index) => (
            <div key={`${section.type}-${index}`} className="grid gap-2 rounded-md border p-3" style={{ borderColor: "var(--border)" }}>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="rounded-md border px-2 py-1 text-xs"
                  value={section.type}
                  onChange={(e) => {
                    const copy = [...sections];
                    copy[index] = { ...copy[index], type: e.target.value as RuleSectionType };
                    setSections(copy);
                  }}
                >
                  {SECTION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={section.is_visible !== false}
                    onChange={(e) => {
                      const copy = [...sections];
                      copy[index] = { ...copy[index], is_visible: e.target.checked };
                      setSections(copy);
                    }}
                  />
                  Показывать на сайте
                </label>
                <div className="ml-auto flex gap-1">
                  <Button type="button" size="sm" variant="ghost" onClick={() => move(index, -1)} disabled={index === 0}>
                    <ChevronUp size={14} />
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => move(index, 1)} disabled={index === sections.length - 1}>
                    <ChevronDown size={14} />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setSections((prev) => prev.filter((_, i) => i !== index))}
                  >
                    Удалить блок
                  </Button>
                </div>
              </div>
              {section.type !== "intro" && section.type !== "footer_note" && (
                <Input
                  placeholder="Заголовок блока"
                  value={section.title ?? ""}
                  onChange={(e) => {
                    const copy = [...sections];
                    copy[index] = { ...copy[index], title: e.target.value };
                    setSections(copy);
                  }}
                />
              )}
              <textarea
                className="min-h-[120px] w-full rounded-md border p-2 font-mono text-xs"
                style={{ borderColor: "var(--border)", background: "var(--background)" }}
                value={section.content}
                onChange={(e) => {
                  const copy = [...sections];
                  copy[index] = { ...copy[index], content: e.target.value };
                  setSections(copy);
                }}
                placeholder="HTML: абзацы, списки, ссылки"
              />
            </div>
          ))}

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => saveMut.mutate()} disabled={saveMut.isPending || publishMut.isPending}>
              Сохранить черновик
            </Button>
            <Button type="button" onClick={() => publishMut.mutate()} disabled={saveMut.isPending || publishMut.isPending}>
              Опубликовать
            </Button>
            <Button type="button" variant="outline" onClick={() => setShowPreview((v) => !v)}>
              Предпросмотр
            </Button>
            {editing?.status === "published" && (
              <Button type="button" variant="outline" onClick={() => window.open(`/rules/${editing.slug}`, "_blank")}>
                Открыть на сайте
              </Button>
            )}
            {editing && (
              <Button type="button" variant="outline" onClick={() => setShowHistory((v) => !v)}>
                <History size={14} /> История версий
              </Button>
            )}
          </div>

          {showPreview && (
            <div className="rounded-md border p-4" style={{ borderColor: "var(--border)", background: "var(--background)" }}>
              <RulesDocumentView page={previewPage} hub={previewHub} />
            </div>
          )}

          {showHistory && editing && (
            <div className="grid gap-2 text-sm">
              <h4 className="font-semibold">История публикаций</h4>
              {revisionsQuery.isLoading && <p>Загрузка…</p>}
              {(revisionsQuery.data ?? []).map((r) => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2" style={{ borderColor: "var(--border)" }}>
                  <span>
                    v{r.version} · {r.title} · {r.created_at ? new Date(r.created_at).toLocaleString("ru-RU") : ""}
                    {r.editor ? ` · ${r.editor}` : ""}
                  </span>
                  <Button type="button" size="sm" variant="outline" onClick={() => restoreMut.mutate(r.id)}>
                    Откатить
                  </Button>
                </div>
              ))}
              {!revisionsQuery.isLoading && (revisionsQuery.data ?? []).length === 0 && (
                <p className="text-xs" style={{ color: "var(--foreground-50)" }}>
                  Пока нет снимков. Они появляются при публикации и при первом редактировании опубликованной страницы.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
