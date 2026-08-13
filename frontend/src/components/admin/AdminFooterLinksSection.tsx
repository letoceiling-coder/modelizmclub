import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  adminDeleteFooterLink,
  adminFetchFooterLinks,
  adminReorderFooterLinks,
  adminUpsertFooterLink,
  type AdminFooterLink,
} from "@/lib/api/legal";
import { toast } from "@/lib/toast";
import { formatApiErrorMessage } from "@/lib/api/validationErrors";

export function AdminFooterLinksSection() {
  const qc = useQueryClient();
  const { data: links = [], isLoading } = useQuery({ queryKey: ["admin-footer-links"], queryFn: adminFetchFooterLinks });
  const [form, setForm] = useState<Partial<AdminFooterLink> | null>(null);

  const saveMut = useMutation({
    mutationFn: () => adminUpsertFooterLink(form?.id ?? null, form!),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin-footer-links"] });
      setForm(null);
      toast.success("Сохранено");
    },
    onError: (e) => toast.error(formatApiErrorMessage(e, "Ошибка")),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => adminDeleteFooterLink(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin-footer-links"] });
    },
  });

  async function move(id: number, dir: -1 | 1) {
    const sorted = [...links].sort((a, b) => a.sort - b.sort);
    const idx = sorted.findIndex((l) => l.id === id);
    const swap = idx + dir;
    if (swap < 0 || swap >= sorted.length) return;
    const a = sorted[idx];
    const b = sorted[swap];
    await adminReorderFooterLinks([
      { id: a.id, sort: b.sort },
      { id: b.id, sort: a.sort },
    ]);
    await qc.invalidateQueries({ queryKey: ["admin-footer-links"] });
  }

  if (isLoading) return <p>Загрузка…</p>;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="flex items-center justify-between">
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Ссылки подвала</h2>
        <Button
          type="button"
          size="sm"
          onClick={() =>
            setForm({
              group: "legal",
              label: "",
              target_type: "internal",
              target_value: "/legal/",
              sort: links.length * 10 + 10,
              is_visible: true,
            })
          }
        >
          Добавить
        </Button>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            <th className="py-2 text-left">Группа</th>
            <th className="py-2 text-left">Метка</th>
            <th className="py-2 text-left">URL</th>
            <th className="py-2 text-left">Видимость</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {[...links]
            .sort((a, b) => a.sort - b.sort)
            .map((l) => (
              <tr key={l.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td className="py-2">{l.group}</td>
                <td className="py-2">{l.label}</td>
                <td className="py-2 font-mono text-xs">{l.target_value}</td>
                <td className="py-2">{l.is_visible ? "Да" : "Скрыта"}</td>
                <td className="py-2 text-right">
                  <Button type="button" size="sm" variant="ghost" onClick={() => move(l.id, -1)}>
                    ↑
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => move(l.id, 1)}>
                    ↓
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setForm({ ...l })}>
                    Изм.
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => deleteMut.mutate(l.id)}>
                    ✕
                  </Button>
                </td>
              </tr>
            ))}
        </tbody>
      </table>

      {form && (
        <div className="grid gap-2 rounded-lg border p-4">
          <Input value={form.label ?? ""} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Подпись" />
          <Input value={form.target_value ?? ""} onChange={(e) => setForm({ ...form, target_value: e.target.value })} placeholder="/legal/rules" />
          <select
            className="rounded border px-2 py-2 text-sm"
            value={form.group ?? "legal"}
            onChange={(e) => setForm({ ...form, group: e.target.value })}
          >
            <option value="legal">legal</option>
            <option value="info">info</option>
            <option value="contacts">contacts</option>
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_visible ?? true} onChange={(e) => setForm({ ...form, is_visible: e.target.checked })} />
            Показывать
          </label>
          <div className="flex gap-2">
            <Button type="button" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
              Сохранить
            </Button>
            <Button type="button" variant="ghost" onClick={() => setForm(null)}>
              Отмена
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
