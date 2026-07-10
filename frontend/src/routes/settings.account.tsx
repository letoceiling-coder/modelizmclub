import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "@/lib/toast";
import { ChevronRight } from "lucide-react";
import { SettingsSectionShell } from "@/components/settings/SettingsSectionShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Badge } from "@/components/ui/badge";
import { useStore, selectors } from "@/lib/store";
import { getAccountExtra, setAccountExtra, type AccountExtra } from "@/lib/settings-prefs";

export const Route = createFileRoute("/settings/account")({
  component: AccountSection,
});

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-[6px] block font-mono text-[12px] uppercase tracking-[0.05em]" style={{ color: "var(--foreground-50)" }}>{label}</span>
      {children}
    </label>
  );
}

function AccountSection() {
  const currentUser = useStore(selectors.currentUser);
  const [email, setEmail] = useState("");
  const [extra, setExtra] = useState<AccountExtra>(getAccountExtra);
  const [verifySent, setVerifySent] = useState(false);

  const currentEmail = extra.email ?? currentUser?.email ?? "";
  const emailPending = extra.email !== undefined && extra.emailVerified === false;

  const submitEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast.error("Введите корректный email"); return; }
    // На демо email реально меняется локально и логично уходит в «не подтверждён».
    // На бою — POST /account/email + верификация по ссылке из письма.
    const next = { ...extra, email, emailVerified: false };
    setExtra(next); setAccountExtra(next);
    setEmail(""); setVerifySent(false);
    toast.success("Email обновлён — подтвердите по ссылке из письма");
  };

  const resendVerification = () => {
    // Документированный POST /account/email/verify/resend (no-op в demo).
    setVerifySent(true);
  };

  const savePhone = () => {
    setAccountExtra(extra);
    toast.success("Телефон сохранён");
  };

  const saveSocials = () => {
    setAccountExtra(extra);
    toast.success("Соцсети сохранены");
  };

  return (
    <SettingsSectionShell title="Профиль и аккаунт">
      <Link
        to="/profile"
        className="flex items-center gap-[12px] rounded-[12px] border px-[16px] py-[14px] transition-colors hover:bg-[var(--background-surface)]"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-medium" style={{ color: "var(--foreground)" }}>Публичный профиль</div>
          <div className="text-[13px]" style={{ color: "var(--foreground-50)" }}>Аватар, обложка, имя, город, интересы</div>
        </div>
        <ChevronRight size={18} style={{ color: "var(--foreground-30)" }} />
      </Link>

      <Card className="p-[20px]" style={{ borderColor: "var(--border)", borderRadius: "var(--r-card)" }}>
        <h2 className="mb-[6px] text-[16px] font-semibold" style={{ color: "var(--foreground)" }}>Email</h2>
        {currentEmail ? (
          <>
            <div className="flex flex-wrap items-center gap-[8px]">
              <p className="text-[14px]" style={{ color: "var(--foreground)" }}>{currentEmail}</p>
              {emailPending && <Badge variant="draft" withIcon={false}>Не подтверждён</Badge>}
            </div>
            {verifySent ? (
              <p className="mt-[12px] text-[13px]" style={{ color: "var(--foreground-70)" }}>
                Письмо со ссылкой подтверждения отправлено на {currentEmail}.
              </p>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={resendVerification} className="mt-[12px] rounded-[10px]">
                Отправить письмо подтверждения
              </Button>
            )}
          </>
        ) : (
          <p className="text-[14px]" style={{ color: "var(--foreground-50)" }}>Email не указан</p>
        )}
      </Card>

      <Card className="p-[20px]" style={{ borderColor: "var(--border)", borderRadius: "var(--r-card)" }}>
        <h2 className="mb-[14px] text-[16px] font-semibold" style={{ color: "var(--foreground)" }}>Смена email</h2>
        <form onSubmit={submitEmail} className="space-y-[12px]">
          <Field label="Новый email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" /></Field>
          <Button type="submit" className="rounded-[10px]">Изменить email</Button>
        </form>
      </Card>

      <Card className="p-[20px]" style={{ borderColor: "var(--border)", borderRadius: "var(--r-card)" }}>
        <h2 className="mb-[14px] text-[16px] font-semibold" style={{ color: "var(--foreground)" }}>Телефон</h2>
        <Field label="Номер телефона">
          <PhoneInput defaultValue={extra.phone} onValueChange={(v) => setExtra((e) => ({ ...e, phone: v }))} />
        </Field>
        <Button type="button" onClick={savePhone} className="mt-[12px] rounded-[10px]">Сохранить</Button>
        <p className="mt-[8px] text-[12px]" style={{ color: "var(--foreground-50)" }}>
          Сохраняется в вашем аккаунте.
        </p>
      </Card>

      <Card className="p-[20px]" style={{ borderColor: "var(--border)", borderRadius: "var(--r-card)" }}>
        <h2 className="mb-[14px] text-[16px] font-semibold" style={{ color: "var(--foreground)" }}>Соцсети</h2>
        <div className="space-y-[12px]">
          <Field label="VK">
            <Input value={extra.vk} onChange={(e) => setExtra((x) => ({ ...x, vk: e.target.value }))} placeholder="https://vk.com/username" />
          </Field>
          <Field label="Telegram">
            <Input value={extra.telegram} onChange={(e) => setExtra((x) => ({ ...x, telegram: e.target.value }))} placeholder="https://t.me/username" />
          </Field>
          <Field label="Сайт">
            <Input value={extra.website} onChange={(e) => setExtra((x) => ({ ...x, website: e.target.value }))} placeholder="https://example.com" />
          </Field>
        </div>
        <Button type="button" onClick={saveSocials} className="mt-[12px] rounded-[10px]">Сохранить</Button>
        <p className="mt-[8px] text-[12px]" style={{ color: "var(--foreground-50)" }}>
          Сохраняется в вашем аккаунте.
        </p>
      </Card>
    </SettingsSectionShell>
  );
}
