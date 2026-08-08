import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
      toast.success(t("pages.settings.requisitesSaved"));
    } catch {
      toast.error(t("pages.settings.requisitesSaveFailed"));
    }
  };

  const set = (patch: Partial<RequisitesForm>) => setForm((f) => ({ ...f, ...patch }));

  return (
    <SettingsSectionShell title={t("pages.settings.requisitesTitle")}>
      <p className="text-[13px]" style={{ color: "var(--foreground-50)" }}>
        {t("pages.settings.requisitesDesc")}{" "}
        <Link to="/settings/account" className="font-medium underline-offset-2 hover:underline" style={{ color: "var(--accent)" }}>
          {t("pages.settings.requisitesProfileLink")}
        </Link>
        .
      </p>
      <Card className="p-[20px]" style={{ borderColor: "var(--border)", borderRadius: "var(--r-card)" }}>
        {loading ? (
          <div className="flex items-center gap-[8px] py-[8px] text-[13px]" style={{ color: "var(--foreground-50)" }}>
            <Loader2 size={14} className="animate-spin" /> {t("pages.settings.loading")}
          </div>
        ) : (
          <form onSubmit={save} className="space-y-[12px]">
            <Field label={t("pages.settings.fullName")}>
              <Input value={form.fullName} onChange={(e) => set({ fullName: e.target.value })} placeholder={t("pages.settings.fullNamePlaceholder")} />
            </Field>
            <Field label={t("pages.settings.innOptional")}>
              <InnInput value={form.inn} onChange={(e) => set({ inn: e.target.value })} placeholder="000000000000" />
            </Field>
            <Field label={t("pages.settings.phone")}>
              <PhoneInput defaultValue={form.phone} onValueChange={(formatted) => set({ phone: formatted })} />
            </Field>
            {accountPhone && form.phone.replace(/\D/g, "") !== accountPhone.replace(/\D/g, "") && (
              <p className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
                {t("pages.settings.phoneMismatch", { phone: accountPhone })}{" "}
                <Link to="/settings/account" className="underline-offset-2 hover:underline" style={{ color: "var(--accent)" }}>
                  {t("pages.settings.changeInProfile")}
                </Link>
              </p>
            )}
            <Field label={t("pages.settings.address")}>
              <Input value={form.address} onChange={(e) => set({ address: e.target.value })} placeholder={t("pages.settings.addressPlaceholder")} />
            </Field>
            <Button type="submit">{t("pages.settings.save")}</Button>
          </form>
        )}
      </Card>

      <PayoutCard />
    </SettingsSectionShell>
  );
}

function PayoutCard() {
  const { t } = useTranslation();
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
    if (cardNumber.length < 16) { toast.error(t("pages.settings.payoutCardInvalid")); return; }
    if (isDemoMode()) { toast(t("pages.settings.payoutDemo")); return; }

    setSaving(true);
    try {
      await savePayoutRequisites(cardNumber);
      setLast4(cardNumber.slice(-4));
      setCardNumber("");
      toast.success(t("pages.settings.payoutCardSavedToast"));
    } catch {
      toast.error(t("pages.settings.payoutCardSaveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mt-[16px] p-[20px]" style={{ borderColor: "var(--border)", borderRadius: "var(--r-card)" }}>
      <h3 className="mb-[4px] text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>{t("pages.settings.payoutCardTitle")}</h3>
      <p className="mb-[16px] text-[13px]" style={{ color: "var(--foreground-50)" }}>
        {t("pages.settings.payoutCardDesc")}
      </p>

      {loading ? (
        <div className="flex items-center gap-[8px] py-[8px] text-[13px]" style={{ color: "var(--foreground-50)" }}>
          <Loader2 size={14} className="animate-spin" /> {t("pages.settings.loading")}
        </div>
      ) : (
        <>
          {last4 && (
            <p className="mb-[10px] text-[13px]" style={{ color: "var(--foreground-70)" }}>
              {t("pages.settings.payoutCardSaved", { last4 })}
            </p>
          )}
          <form onSubmit={save} className="space-y-[12px]">
            <Field label={last4 ? t("pages.settings.payoutCardNew") : t("pages.settings.payoutCardNumber")}>
              <CardNumberInput value={cardNumber} onValueChange={setCardNumber} />
            </Field>
            <Button type="submit" disabled={saving}>{saving ? t("pages.settings.saving") : t("pages.settings.save")}</Button>
          </form>
        </>
      )}
    </Card>
  );
}
