import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FileText, History, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  adminArchiveLegalPage,
  adminCreateLegalPage,
  adminFetchLegalPageRevisions,
  adminFetchLegalPages,
  adminPreviewLegalMarkdown,
  adminPublishLegalPage,
  adminRestoreLegalPageRevision,
  adminUpdateLegalPage,
  type AdminLegalPage,
} from "@/lib/api/legal";
import { toast } from "@/lib/toast";
import { formatApiErrorMessage } from "@/lib/api/validationErrors";
import { formatDate } from "@/lib/format/date";

const EMPTY_DRAFT = { slug: "", title: "", meta_description: "", content_html: "", content_md: "" };
const FEATURED_SLUG = "safe-deal";

type EditorMode = "html" | "markdown" | "preview";

export function AdminLegalPagesSection() {
  const qc = useQueryClient();
  const { data: pages = [], isLoading } = useQuery({
    queryKey: ["admin-legal-pages"],
    queryFn: adminFetchLegalPages,
  });
  const [editing, setEditing] = useState<AdminLegalPage | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [mode, setMode] = useState<EditorMode>("html");
  const [sourceMode, setSourceMode] = useState<"html" | "markdown">("html");
  const [previewHtml, setPreviewHtml] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const revisionsQuery = useQuery({
    queryKey: ["admin-legal-revisions", editing?.id],
    queryFn: () => adminFetchLegalPageRevisions(editing!.id),
    enabled: Boolean(editing?.id) && showHistory,
  });

  const saveMut = useMutation({
    mutationFn: () => adminUpdateLegalPage(editing!.id, savePayload()),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin-legal-pages"] });
      toast.success("Черновик сохранён (версия +1, предыдущая в истории)");
      setEditing(null);
      setShowHistory(false);
    },
    onError: (e) => toast.error(formatApiErrorMessage(e, "Ошибка сохранения")),
  });

  const createMut = useMutation({
    mutationFn: () => adminCreateLegalPage(savePayload()),
    onSuccess: async (page) => {
      await qc.invalidateQueries({ queryKey: ["admin-legal-pages"] });
      toast.success("Страница создана как черновик");
      setCreating(false);
      startEdit(page);
    },
    onError: (e) => toast.error(formatApiErrorMessage(e, "Ошибка создания")),
  });

  const publishMut = useMutation({
    mutationFn: (id: number) => adminPublishLegalPage(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin-legal-pages"] });
      toast.success("Опубликовано");
    },
  });

  const archiveMut = useMutation({
    mutationFn: (id: number) => adminArchiveLegalPage(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin-legal-pages"] });
      toast.success("В архиве");
    },
  });

  const restoreMut = useMutation({
    mutationFn: (revisionId: number) => adminRestoreLegalPageRevision(editing!.id, revisionId),
    onSuccess: async (page) => {
      await qc.invalidateQueries({ queryKey: ["admin-legal-pages"] });
      await qc.invalidateQueries({ queryKey: ["admin-legal-revisions", page.id] });
      toast.success("Версия восстановлена как черновик");
      startEdit(page);
    },
    onError: (e) => toast.error(formatApiErrorMessage(e, "Не удалось восстановить")),
  });

  function savePayload() {
    const base = {
      slug: draft.slug,
      title: draft.title,
      meta_description: draft.meta_description || undefined,
    };
    if (sourceMode === "markdown" && draft.content_md.trim()) {
      return { ...base, content_md: draft.content_md };
    }
    return { ...base, content_html: draft.content_html };
  }

  function startEdit(p: AdminLegalPage) {
    setCreating(false);
    setEditing(p);
    setDraft({
      slug: p.slug,
      title: p.title,
      meta_description: p.meta_description ?? "",
      content_html: p.content_html,
      content_md: p.content_md ?? "",
    });
    setMode(p.content_md ? "markdown" : "html");
    setSourceMode(p.content_md ? "markdown" : "html");
    setPreviewHtml(p.content_html);
    setShowHistory(p.slug === FEATURED_SLUG);
  }

  function startCreate() {
    setEditing(null);
    setCreating(true);
    setDraft(EMPTY_DRAFT);
    setMode("html");
    setSourceMode("html");
    setPreviewHtml("");
    setShowHistory(false);
  }

  async function openPreview() {
    if (mode === "markdown" && draft.content_md.trim()) {
      try {
        const html = await adminPreviewLegalMarkdown(draft.content_md);
        setPreviewHtml(html);
      } catch {
        setPreviewHtml(draft.content_html);
      }
    } else {
      setPreviewHtml(draft.content_html);
    }
    setMode("preview");
  }

  const featured = pages.find((p) => p.slug === FEATURED_SLUG);

  if (isLoading) return <p>Загрузка…</p>;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="flex items-center justify-between gap-3">
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Юридические и информационные страницы</h2>
        <Button type="button" size="sm" onClick={startCreate}>
          Новая страница
        </Button>
      </div>
      <p className="text-xs" style={{ color: "var(--foreground-50)" }}>
        Опубликованные страницы доступны по /legal/slug и /info/slug. Раздел «Правила» (/rules)
        редактируется отдельно, блоками. HTML или Markdown, без передеплоя.
      </p>

      {featured && (
        <div
          className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-4"
          style={{ borderColor: "var(--accent)", background: "var(--accent-soft)" }}
        >
          <div className="flex min-w-0 items-start gap-3">
            <ShieldCheck size={22} style={{ color: "var(--accent)", marginTop: 2 }} />
            <div>
              <div className="text-sm font-semibold">Правила безопасной сделки</div>
              <p className="mt-1 text-xs" style={{ color: "var(--foreground-70)" }}>
                Публичный документ раздела «Правила»: /rules/safe-deal. Эта запись остаётся по
                адресу /legal/safe-deal.
              </p>
              <p className="mt-1 text-xs" style={{ color: "var(--foreground-50)" }}>
                Регламент холда, СДЭК и споров. Редактируйте HTML или Markdown — история правок
                сохраняется.
              </p>
            </div>
          </div>
          <Button type="button" size="sm" onClick={() => startEdit(featured)}>
            <FileText size={14} /> Редактировать
          </Button>
        </div>
      )}

      <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            <th className="py-2 text-left">Slug</th>
            <th className="py-2 text-left">Заголовок</th>
            <th className="py-2 text-left">Статус</th>
            <th className="py-2 text-left">Версия</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {pages.map((p) => (
            <tr
              key={p.id}
              style={{
                borderBottom: "1px solid var(--border)",
                background: p.slug === FEATURED_SLUG ? "var(--accent-soft)" : undefined,
              }}
            >
              <td className="py-2 font-mono text-xs">{p.slug}</td>
              <td className="py-2">{p.title}</td>
              <td className="py-2">{p.status}</td>
              <td className="py-2">{p.version}</td>
              <td className="py-2 text-right">
                <Button type="button" size="sm" variant="outline" onClick={() => startEdit(p)}>
                  Редактировать
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {(editing || creating) && (
        <div className="rounded-lg border p-4" style={{ borderColor: "var(--border)" }}>
          <div className="mb-3 font-semibold">
            {creating ? "Новая страница" : `Редактор: ${editing?.slug}`}
          </div>
          <div className="grid gap-2">
            {creating && (
              <Input
                value={draft.slug}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                  }))
                }
                placeholder="slug (about, company, advertising…)"
              />
            )}
            <Input
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="Заголовок"
            />
            <Input
              value={draft.meta_description}
              onChange={(e) => setDraft((d) => ({ ...d, meta_description: e.target.value }))}
              placeholder="SEO description (до 320 символов)"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={mode === "html" ? "default" : "outline"}
                onClick={() => {
                  setMode("html");
                  setSourceMode("html");
                }}
              >
                HTML
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mode === "markdown" ? "default" : "outline"}
                onClick={() => {
                  setMode("markdown");
                  setSourceMode("markdown");
                }}
              >
                Markdown
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mode === "preview" ? "default" : "outline"}
                onClick={() => void openPreview()}
              >
                Превью
              </Button>
            </div>
            {mode === "html" && (
              <textarea
                className="min-h-[320px] w-full rounded-md border p-3 font-mono text-xs"
                value={draft.content_html}
                onChange={(e) => setDraft((d) => ({ ...d, content_html: e.target.value }))}
              />
            )}
            {mode === "markdown" && (
              <textarea
                className="min-h-[320px] w-full rounded-md border p-3 font-mono text-xs"
                value={draft.content_md}
                onChange={(e) => setDraft((d) => ({ ...d, content_md: e.target.value }))}
                placeholder={"## Заголовок раздела\n\nТекст абзаца. **Жирный**."}
              />
            )}
            {mode === "preview" && (
              <div
                className="legal-document min-h-[200px] rounded-md border p-4"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {creating ? (
              <Button
                type="button"
                disabled={
                  createMut.isPending ||
                  !draft.slug ||
                  !draft.title ||
                  (!draft.content_html && !draft.content_md)
                }
                onClick={() => createMut.mutate()}
              >
                Создать черновик
              </Button>
            ) : (
              <>
                <Button type="button" disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>
                  Сохранить черновик
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={publishMut.isPending}
                  onClick={() => publishMut.mutate(editing!.id)}
                >
                  Опубликовать
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={archiveMut.isPending}
                  onClick={() => archiveMut.mutate(editing!.id)}
                >
                  В архив
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowHistory((v) => !v)}>
                  <History size={14} /> История
                </Button>
              </>
            )}
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setEditing(null);
                setCreating(false);
                setShowHistory(false);
              }}
            >
              Закрыть
            </Button>
          </div>

          {editing && showHistory && (
            <div className="mt-4 rounded-md border p-3" style={{ borderColor: "var(--border)" }}>
              <div className="mb-2 text-sm font-semibold">История правок</div>
              {revisionsQuery.isLoading ? (
                <p className="text-xs" style={{ color: "var(--foreground-50)" }}>
                  Загрузка…
                </p>
              ) : (revisionsQuery.data ?? []).length === 0 ? (
                <p className="text-xs" style={{ color: "var(--foreground-50)" }}>
                  Пока нет сохранённых версий. Они появятся после первого изменения.
                </p>
              ) : (
                <ul className="grid gap-2 text-sm">
                  {(revisionsQuery.data ?? []).map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        v{r.version} · {r.title} · {r.status}
                        {r.created_at ? ` · ${formatDate(r.created_at, "absolute")}` : ""}
                        {r.editor ? ` · ${r.editor}` : ""}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={restoreMut.isPending}
                        onClick={() => restoreMut.mutate(r.id)}
                      >
                        Восстановить
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
