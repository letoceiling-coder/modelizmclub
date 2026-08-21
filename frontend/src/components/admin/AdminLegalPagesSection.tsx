import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  adminArchiveLegalPage,
  adminCreateLegalPage,
  adminFetchLegalPages,
  adminPublishLegalPage,
  adminUpdateLegalPage,
  type AdminLegalPage,
} from "@/lib/api/legal";
import { toast } from "@/lib/toast";
import { formatApiErrorMessage } from "@/lib/api/validationErrors";

const EMPTY_DRAFT = { slug: "", title: "", content_html: "" };

export function AdminLegalPagesSection() {
  const qc = useQueryClient();
  const { data: pages = [], isLoading } = useQuery({ queryKey: ["admin-legal-pages"], queryFn: adminFetchLegalPages });
  const [editing, setEditing] = useState<AdminLegalPage | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [preview, setPreview] = useState(false);

  const saveMut = useMutation({
    mutationFn: () => adminUpdateLegalPage(editing!.id, draft),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin-legal-pages"] });
      toast.success("Черновик сохранён (версия +1)");
      setEditing(null);
    },
    onError: (e) => toast.error(formatApiErrorMessage(e, "Ошибка сохранения")),
  });

  const createMut = useMutation({
    mutationFn: () => adminCreateLegalPage(draft),
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

  function startEdit(p: AdminLegalPage) {
    setCreating(false);
    setEditing(p);
    setDraft({ slug: p.slug, title: p.title, content_html: p.content_html });
    setPreview(false);
  }

  function startCreate() {
    setEditing(null);
    setCreating(true);
    setDraft(EMPTY_DRAFT);
    setPreview(false);
  }

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
        Опубликованные страницы доступны по адресу /legal/slug и /info/slug. Создайте страницу, сохраните HTML и опубликуйте.
      </p>
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
            <tr key={p.id} style={{ borderBottom: "1px solid var(--border)" }}>
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
          <div className="mb-3 font-semibold">{creating ? "Новая страница" : `Редактор: ${editing?.slug}`}</div>
          <div className="grid gap-2">
            {creating && (
              <Input
                value={draft.slug}
                onChange={(e) => setDraft((d) => ({ ...d, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))}
                placeholder="slug (about, company, advertising…)"
              />
            )}
            <Input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} placeholder="Заголовок" />
            {!preview ? (
              <textarea
                className="min-h-[320px] w-full rounded-md border p-3 font-mono text-xs"
                value={draft.content_html}
                onChange={(e) => setDraft((d) => ({ ...d, content_html: e.target.value }))}
              />
            ) : (
              <div className="legal-document min-h-[200px] rounded-md border p-4" dangerouslySetInnerHTML={{ __html: draft.content_html }} />
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setPreview((v) => !v)}>
              {preview ? "Редактор" : "Превью HTML"}
            </Button>
            {creating ? (
              <Button type="button" disabled={createMut.isPending || !draft.slug || !draft.title || !draft.content_html} onClick={() => createMut.mutate()}>
                Создать черновик
              </Button>
            ) : (
              <>
                <Button type="button" disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>
                  Сохранить черновик
                </Button>
                <Button type="button" variant="secondary" disabled={publishMut.isPending} onClick={() => publishMut.mutate(editing!.id)}>
                  Опубликовать
                </Button>
                <Button type="button" variant="outline" disabled={archiveMut.isPending} onClick={() => archiveMut.mutate(editing!.id)}>
                  В архив
                </Button>
              </>
            )}
            <Button type="button" variant="ghost" onClick={() => { setEditing(null); setCreating(false); }}>
              Закрыть
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
