import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { SettingsSectionShell } from "@/components/settings/SettingsSectionShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InnInput } from "@/components/ui/inn-input";
import { CardNumberInput } from "@/components/ui/card-number-input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Button } from "@/components/ui/button";
import { isDemoMode } from "@/lib/demo-mode";
import { fetchMe } from "@/lib/api/auth";
import { fetchPayoutRequisites, savePayoutRequisites } from "@/lib/api/payout-requisites";
import { fetchDocumentRequisites, saveDocumentRequisites } from "@/lib/api/account";

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

interface RequisitesForm {
  fullName: string;
  inn: string;
  phone: string;
  address: string;
}

function RequisitesSection() {
  const [form, setForm] = useState<RequisitesForm>({ fullName: "", inn: "", phone: "", address: "" });
  const [accountPhone, setAccountPhone] = useState("");
  const [loading, setLoading] = useState(!isDemoMode());

  useEffect(() => {
    if (isDemoMode()) {
      setLoading(false);
      return;
    }
    let alive = true;
    Promise.all([fetchDocumentRequisites(), fetchMe()])
      .then(([r, me]) => {
        if (!alive) return;
        const mePhone = me?.phone ?? "";
        setAccountPhone(mePhone);
        setForm({
          fullName: r.full_name?.trim() || me?.name?.trim() || "",
          inn: r.inn ?? "",
          phone: r.phone?.trim() || mePhone,
          address: r.address ?? "",
        });
      })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await saveDocumentRequisites({
        full_name: form.fullName,
        inn: form.inn,
        phone: form.phone,
        address: form.address,
      });
      toast.success("Реквизиты сохранены");
    } catch {
      toast.error("Не удалось сохранить реквизиты");
    }
  };

  const set = (patch: Partial<RequisitesForm>) => setForm((f) => ({ ...f, ...patch }));

  return (
    <SettingsSectionShell title="Реквизиты">
      <p className="text-[13px]" style={{ color: "var(--foreground-50)" }}>
        Данные хранятся в аккаунте и используются при оформлении документов по сделкам.
        Телефон подтягивается из{" "}
        <Link to="/settings/account" className="font-medium underline-offset-2 hover:underline" style={{ color: "var(--accent)" }}>
          профиля и аккаунта
        </Link>
        .
      </p>
      <Card className="p-[20px]" style={{ borderColor: "var(--border)", borderRadius: "var(--r-card)" }}>
        {loading ? (
          <div className="flex items-center gap-[8px] py-[8px] text-[13px]" style={{ color: "var(--foreground-50)" }}>
            <Loader2 size={14} className="animate-spin" /> Загрузка…
          </div>
        ) : (
          <form onSubmit={save} className="space-y-[12px]">
            <Field label="Полное имя (ФИО)">
              <Input value={form.fullName} onChange={(e) => set({ fullName: e.target.value })} placeholder="Иванов Иван Иванович" />
            </Field>
            <Field label="ИНН (необязательно)">
              <InnInput value={form.inn} onChange={(e) => set({ inn: e.target.value })} placeholder="000000000000" />
            </Field>
            <Field label="Телефон">
              <PhoneInput key={`req-phone-${form.phone}`} defaultValue={form.phone} onValueChange={(formatted) => set({ phone: formatted })} />
            </Field>
            {accountPhone && form.phone.replace(/\D/g, "") !== accountPhone.replace(/\D/g, "") && (
              <p className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
                В аккаунте указан другой номер ({accountPhone}).{" "}
                <Link to="/settings/account" className="underline-offset-2 hover:underline" style={{ color: "var(--accent)" }}>
                  Изменить в профиле
                </Link>
              </p>
            )}
            <Field label="Адрес">
              <Input value={form.address} onChange={(e) => set({ address: e.target.value })} placeholder="Город, улица, дом" />
            </Field>
            <Button type="submit">Сохранить</Button>
          </form>
        )}
      </Card>

      <PayoutCard />
    </SettingsSectionShell>
  );
}

function PayoutCard() {
  const [last4, setLast4] = useState<string | null>(null);
  const [cardNumber, setCardNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchPayoutRequisites()
      .then((r) => { if (alive) setLast4(r.last4); })
      .catch(() => { if (alive) setLast4(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cardNumber.length < 16) { toast.error("Введите номер карты полностью (16 цифр)"); return; }
    if (isDemoMode()) { toast("В демо-режиме сохранение карты для выплат недоступно"); return; }

    setSaving(true);
    try {
      await savePayoutRequisites(cardNumber);
      setLast4(cardNumber.slice(-4));
      setCardNumber("");
      toast.success("Карта для выплат сохранена");
    } catch {
      toast.error("Не удалось сохранить карту");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mt-[16px] p-[20px]" style={{ borderColor: "var(--border)", borderRadius: "var(--r-card)" }}>
      <h3 className="mb-[4px] text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>Карта для выплат</h3>
      <p className="mb-[16px] text-[13px]" style={{ color: "var(--foreground-50)" }}>
        Номер карты хранится в зашифрованном виде и используется только для ручного
        перевода администратором — без автоматических выплат через эквайринг.
      </p>

      {loading ? (
        <div className="flex items-center gap-[8px] py-[8px] text-[13px]" style={{ color: "var(--foreground-50)" }}>
          <Loader2 size={14} className="animate-spin" /> Загрузка…
        </div>
      ) : (
        <>
          {last4 && (
            <p className="mb-[10px] text-[13px]" style={{ color: "var(--foreground-70)" }}>
              Сейчас сохранена карта •••• {last4}
            </p>
          )}
          <form onSubmit={save} className="space-y-[12px]">
            <Field label={last4 ? "Новый номер карты (чтобы заменить)" : "Номер карты"}>
              <CardNumberInput value={cardNumber} onValueChange={setCardNumber} />
            </Field>
            <Button type="submit" disabled={saving}>{saving ? "Сохранение…" : "Сохранить"}</Button>
          </form>
        </>
      )}
    </Card>
  );
}
