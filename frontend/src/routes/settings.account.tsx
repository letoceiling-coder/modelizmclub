import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "@/lib/toast";
import { ChevronRight, Loader2 } from "lucide-react";
import { SettingsSectionShell } from "@/components/settings/SettingsSectionShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Badge } from "@/components/ui/badge";
import { useStore, selectors, setCurrentUser } from "@/lib/store";
import { isDemoMode } from "@/lib/demo-mode";
import { fetchMe } from "@/lib/api/auth";
import { requestEmailChange, resendVerificationEmail, sendPhoneVerificationCode, verifyPhoneCode } from "@/lib/api/account";
import { ApiError } from "@/lib/api/client";

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
  const [loading, setLoading] = useState(!isDemoMode());
  const [accountEmail, setAccountEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(null);
  const [serverEmailVerified, setServerEmailVerified] = useState<boolean | null>(null);
  const [serverPhoneVerified, setServerPhoneVerified] = useState<boolean | null>(null);
  const [verifySent, setVerifySent] = useState(false);
  const [smsCode, setSmsCode] = useState("");
  const [smsSending, setSmsSending] = useState(false);
  const [smsVerifying, setSmsVerifying] = useState(false);
  const [smsSent, setSmsSent] = useState(false);
  const [smsCooldown, setSmsCooldown] = useState(0);

  useEffect(() => {
    if (smsCooldown <= 0) return;
    const t = window.setInterval(() => setSmsCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(t);
  }, [smsCooldown]);

  useEffect(() => {
    if (isDemoMode()) {
      setAccountEmail(currentUser?.email ?? "");
      setPhone(currentUser?.phone ?? "");
      setServerEmailVerified(currentUser?.email_verified ?? null);
      setServerPhoneVerified(currentUser?.phone_verified ?? null);
      setVerifiedPhone(currentUser?.phone ?? null);
      setLoading(false);
      return;
    }
    fetchMe().then((u) => {
      if (!u) return;
      setCurrentUser(u);
      setAccountEmail(u.email ?? "");
      setPhone(u.phone ?? "");
      setVerifiedPhone(u.phone_verified ? (u.phone ?? null) : null);
      setServerEmailVerified(u.email_verified === true);
      setServerPhoneVerified(u.phone_verified === true);
    }).catch(() => {
      toast.error("Не удалось загрузить данные аккаунта");
    }).finally(() => setLoading(false));
  }, [currentUser?.email, currentUser?.phone, currentUser?.email_verified, currentUser?.phone_verified]);

  const phoneMatchesVerified =
    serverPhoneVerified === true &&
    verifiedPhone !== null &&
    phone.replace(/\D/g, "") === verifiedPhone.replace(/\D/g, "");

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      toast.error("Введите корректный email");
      return;
    }
    if (isDemoMode()) {
      setAccountEmail(newEmail);
      setServerEmailVerified(false);
      setNewEmail("");
      toast.success("Email обновлён — подтвердите по ссылке из письма");
      return;
    }
    try {
      await requestEmailChange(newEmail);
      setAccountEmail(newEmail);
      setServerEmailVerified(false);
      setNewEmail("");
      setVerifySent(false);
      toast.success("Email обновлён — подтвердите по ссылке из письма");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Не удалось изменить email");
    }
  };

  const resendVerification = async () => {
    if (isDemoMode()) { setVerifySent(true); return; }
    try {
      await resendVerificationEmail();
      setVerifySent(true);
    } catch {
      toast.error("Не удалось отправить письмо");
    }
  };

  const sendSms = async () => {
    const normalized = phone.trim();
    if (!normalized || normalized.replace(/\D/g, "").length < 10) {
      toast.error("Введите корректный номер телефона");
      return;
    }
    setSmsSending(true);
    try {
      await sendPhoneVerificationCode(normalized);
      setSmsSent(true);
      setSmsCooldown(60);
      toast.success("Код отправлен по SMS");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Не удалось отправить SMS");
    } finally {
      setSmsSending(false);
    }
  };

  const confirmSms = async () => {
    const normalized = phone.trim();
    if (!normalized) return;
    if (!/^\d{6}$/.test(smsCode.trim())) {
      toast.error("Введите 6-значный код из SMS");
      return;
    }
    setSmsVerifying(true);
    try {
      const user = await verifyPhoneCode(normalized, smsCode.trim());
      setCurrentUser(user);
      setVerifiedPhone(user.phone ?? normalized);
      setServerPhoneVerified(user.phone_verified === true);
      setSmsCode("");
      setSmsSent(false);
      toast.success("Номер телефона подтверждён");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Неверный код");
    } finally {
      setSmsVerifying(false);
    }
  };

  const onPhoneChange = (v: string) => {
    setPhone(v);
    if (verifiedPhone && v.replace(/\D/g, "") !== verifiedPhone.replace(/\D/g, "")) {
      setServerPhoneVerified(false);
      setSmsSent(false);
      setSmsCode("");
    }
  };

  if (loading) {
    return (
      <SettingsSectionShell title="Профиль и аккаунт">
        <div className="flex items-center gap-[8px] py-[24px] text-[14px]" style={{ color: "var(--foreground-50)" }}>
          <Loader2 size={16} className="animate-spin" /> Загрузка…
        </div>
      </SettingsSectionShell>
    );
  }

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
        {accountEmail ? (
          <>
            <div className="flex flex-wrap items-center gap-[8px]">
              <p className="text-[14px]" style={{ color: "var(--foreground)" }}>{accountEmail}</p>
              {serverEmailVerified === true && (
                <Badge variant="published" withIcon={false}>Подтверждён</Badge>
              )}
              {serverEmailVerified === false && (
                <Badge variant="draft" withIcon={false}>Не подтверждён</Badge>
              )}
            </div>
            {serverEmailVerified === false && (
              verifySent ? (
                <p className="mt-[12px] text-[13px]" style={{ color: "var(--foreground-70)" }}>
                  Письмо со ссылкой подтверждения отправлено на {accountEmail}.
                </p>
              ) : (
                <Button type="button" variant="outline" size="sm" onClick={resendVerification} className="mt-[12px]">
                  Отправить письмо подтверждения
                </Button>
              )
            )}
          </>
        ) : (
          <p className="text-[14px]" style={{ color: "var(--foreground-50)" }}>Email не указан</p>
        )}
      </Card>

      <Card className="p-[20px]" style={{ borderColor: "var(--border)", borderRadius: "var(--r-card)" }}>
        <h2 className="mb-[14px] text-[16px] font-semibold" style={{ color: "var(--foreground)" }}>Смена email</h2>
        <form onSubmit={submitEmail} className="space-y-[12px]">
          <Field label="Новый email">
            <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
          </Field>
          <Button type="submit">Изменить email</Button>
        </form>
      </Card>

      <Card className="p-[20px]" style={{ borderColor: "var(--border)", borderRadius: "var(--r-card)" }}>
        <div className="mb-[14px] flex flex-wrap items-center gap-[8px]">
          <h2 className="text-[16px] font-semibold" style={{ color: "var(--foreground)" }}>Телефон</h2>
          {phoneMatchesVerified ? (
            <Badge variant="published" withIcon={false}>Подтверждён по SMS</Badge>
          ) : (
            <Badge variant="draft" withIcon={false}>Не подтверждён</Badge>
          )}
        </div>
        <Field label="Номер телефона">
          <PhoneInput key={phone || "empty"} defaultValue={phone} onValueChange={onPhoneChange} />
        </Field>

        {!phoneMatchesVerified && (
          <div className="mt-[12px] space-y-[12px]">
            <Button
              type="button"
              variant="outline"
              onClick={sendSms}
              disabled={smsSending || smsCooldown > 0}
            >
              {smsSending
                ? "Отправляем…"
                : smsCooldown > 0
                  ? `Повторить через ${smsCooldown} сек`
                  : smsSent
                    ? "Отправить SMS повторно"
                    : "Отправить SMS для подтверждения"}
            </Button>

            {smsSent && (
              <div className="flex flex-col gap-[8px] sm:flex-row sm:items-end">
                <Field label="Код из SMS">
                  <Input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={smsCode}
                    onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                  />
                </Field>
                <Button type="button" onClick={confirmSms} disabled={smsVerifying || smsCode.length !== 6}>
                  {smsVerifying ? "Проверяем…" : "Подтвердить"}
                </Button>
              </div>
            )}
          </div>
        )}

        <p className="mt-[12px] text-[12px] leading-relaxed" style={{ color: "var(--foreground-50)" }}>
          Подтверждение только по SMS-коду. Номер используется в реквизитах и для доступа к действиям на сайте.
        </p>
      </Card>
    </SettingsSectionShell>
  );
}
