import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { SettingsSectionShell } from "@/components/settings/SettingsSectionShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getRequisites, setRequisites, type Requisites } from "@/lib/settings-prefs";

export const Route = createFileRoute("/settings/requisites")({
  component: RequisitesSection,
});

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-[6px] block font-mono text-[12px] uppercase tracking-[0.05em]" style={{ color: "var(--foreground-50)" }}>{label}</span>
      {children}
    </label>
  );
}

function RequisitesSection() {
  const [form, setForm] = useState<Requisites>(getRequisites);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setRequisites(form);
    toast.success("Реквизиты сохранены");
  };

  const set = (patch: Partial<Requisites>) => setForm((f) => ({ ...f, ...patch }));

  return (
    <SettingsSectionShell title="Реквизиты">
      <p className="text-[13px]" style={{ color: "var(--foreground-50)" }}>
        Данные хранятся локально. Интеграция с документами сделок — в разработке.
      </p>
      <Card className="p-[20px]" style={{ borderColor: "var(--border)", borderRadius: 14 }}>
        <form onSubmit={save} className="space-y-[12px]">
          <Field label="Полное имя (ФИО)"><Input value={form.fullName} onChange={(e) => set({ fullName: e.target.value })} placeholder="Иванов Иван Иванович" /></Field>
          <Field label="ИНН (необязательно)"><Input value={form.inn} onChange={(e) => set({ inn: e.target.value })} placeholder="000000000000" inputMode="numeric" /></Field>
          <Field label="Телефон"><Input value={form.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="+7 900 000-00-00" inputMode="tel" /></Field>
          <Field label="Адрес"><Input value={form.address} onChange={(e) => set({ address: e.target.value })} placeholder="Город, улица, дом" /></Field>
          <Button type="submit" className="rounded-[10px]">Сохранить</Button>
        </form>
      </Card>
    </SettingsSectionShell>
  );
}
